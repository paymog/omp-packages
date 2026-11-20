// Install test of the top pi packages on the latest omp. CI runs: prepare (D1 read) → test (no secrets) → publish (D1 write).
// Usage: node tester/run.ts prepare|test|publish. prepare and publish need CLOUDFLARE_API_TOKEN with D1 edit.
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { promisify } from "node:util";
import { OUR_TESTS, REFRESH_COUNTS, statusCase } from "../src/sql.ts";
import { TESTED_POOL } from "../src/views.ts";

const exec = promisify(execFile);
const OUT = "tester/out";
const IMAGE = "omptest";
const ACCOUNT = "e7f962b617a3a8306e35e781cdad1b04";
const DATABASE = "52dc0d35-f42b-4c58-8348-19114b2b59df";
// These fail on any host (platform binaries, broken manifests), so their result says nothing about omp.
const EXCLUDE = [/^@agimon-ai\/po-runner-/, /^pi-harness-runtime$/, /^@explyt\/ai-agent$/];
// A bigger drop between runs is more likely a harness fault than an omp change; FORCE=true publishes anyway.
const MAX_WORKS_DROP = 10;

type Top = { name: string; version: string };
type Probe = {
  pkg?: string;
  harnessError?: string;
  installCode?: number;
  installErr?: string;
  version?: string;
  ready?: boolean;
  stderr?: string;
  commands?: string[];
  tools?: string[];
  devices?: string[];
  errors?: { error?: string; event?: string }[];
};
type Cls = "harness" | "install_fail" | "no_ready" | "ext_error" | "loaded" | "loaded_nothing";
type Report = { name: string; version: string; status: "works" | "broken"; note: string };

const save = (file: string, data: unknown) => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${file}`, JSON.stringify(data, null, 1));
};

async function d1(batch: { sql: string; params?: string[] }[]): Promise<Record<string, unknown>[][]> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DATABASE}/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ batch }),
  });
  const body = (await res.json()) as { success: boolean; errors: unknown; result: { results: Record<string, unknown>[] }[] };
  if (!body.success) throw new Error(`D1 ${res.status}: ${JSON.stringify(body.errors)}`);
  return body.result.map((r) => r.results);
}

async function probe(pkg?: string): Promise<Probe> {
  try {
    const args = ["run", "--rm", "--memory=2g", IMAGE, "bun", "/probe.ts", ...(pkg ? [pkg] : [])];
    const { stdout } = await exec("docker", args, { timeout: 600_000, maxBuffer: 64 << 20 });
    return JSON.parse(stdout.trim().split("\n").at(-1) ?? "");
  } catch (e) {
    return { pkg, harnessError: String(e).slice(0, 500) };
  }
}

function classify(r: Probe, base: Probe): { cls: Cls; added: string[] } {
  if (r.harnessError) return { cls: "harness", added: [] };
  if (r.installCode !== undefined && r.installCode !== 0) return { cls: "install_fail", added: [] };
  if (!r.ready) return { cls: "no_ready", added: [] };
  if (r.errors?.length) return { cls: "ext_error", added: [] };
  const minus = (a: string[] = [], b: string[] = []) => a.filter((x) => !b.includes(x));
  const added = [
    ...new Set([
      ...minus(r.commands, base.commands),
      ...minus(r.tools, base.tools).map((t) => `tool:${t}`),
      ...minus(r.devices, base.devices).map((t) => `tool:${t}`),
    ]),
  ].sort();
  return { cls: added.length ? "loaded" : "loaded_nothing", added };
}

function firstError(r: Probe, cls: Cls): string {
  if (cls === "ext_error") {
    const e = r.errors![0];
    return `${e.error} (during ${e.event})`;
  }
  const lines = (r.installErr || r.stderr || "").split("\n").map((l) => l.trim()).filter(Boolean);
  for (const l of lines) {
    if (l.includes("Failed to load extension:")) return l.split("Failed to load extension:")[1].trim();
    if (cls === "no_ready" && /^(\w*Error|error):/.test(l)) return l.replace(/^error:\s*/, "");
  }
  return lines.at(-1) ?? "";
}

function describe(added: string[]): string {
  const list = (xs: string[]) => xs.slice(0, 6).join(", ") + (xs.length > 6 ? "…" : "");
  const cmds = added.filter((x) => /^(extension|custom|file):/.test(x)).map((x) => "/" + x.slice(x.indexOf(":") + 1));
  const tools = added.filter((x) => x.startsWith("tool:")).map((x) => x.slice(5));
  const skills = added.filter((x) => x.startsWith("skill:")).length;
  return [
    cmds.length ? `commands ${list(cmds)}` : "",
    tools.length ? `tools ${list(tools)}` : "",
    skills ? `${skills} skill${skills > 1 ? "s" : ""}` : "",
  ]
    .filter(Boolean)
    .join("; ");
}

const STAGE: Partial<Record<Cls, string>> = {
  install_fail: "`omp plugin install` fails",
  no_ready: "omp fails to start",
  ext_error: "the extension throws at startup",
};

async function prepare() {
  const [top] = await d1([{ sql: `SELECT name, version FROM packages WHERE source = 'pi' ORDER BY monthly_downloads DESC LIMIT ${TESTED_POOL}` }]);
  save("top.json", top);
  console.log(`top ${top.length}: ${top[0].name} … ${top.at(-1)!.name}`);
}

async function test() {
  const top: Top[] = JSON.parse(readFileSync(`${OUT}/top.json`, "utf8"));
  const latest: unknown = await (await fetch("https://registry.npmjs.org/@oh-my-pi/pi-coding-agent/latest")).json();
  const omp = latest && typeof latest === "object" && "version" in latest && typeof latest.version === "string" ? latest.version : null;
  if (!omp) throw new Error(`npm returned no omp version: ${JSON.stringify(latest).slice(0, 200)}`);
  await exec("docker", ["build", "-q", "-t", IMAGE, "--build-arg", `OMP_VERSION=${omp}`, "tester"], { timeout: 900_000 });
  const base = await probe();
  if (!base.ready || !base.commands?.length) throw new Error(`omp ${omp} with no packages did not start: ${JSON.stringify(base).slice(0, 2000)}`);

  const results: (Probe & { cls: Cls; added: string[] })[] = new Array(top.length);
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < top.length; i = next++) {
      const r = await probe(top[i].name);
      results[i] = { ...r, pkg: top[i].name, ...classify(r, base) };
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, availableParallelism()) }, worker));

  const reports: Report[] = [];
  for (const [i, r] of results.entries()) {
    if (EXCLUDE.some((re) => re.test(r.pkg!))) continue;
    const prefix = `Tested on omp ${omp}:`;
    const version = String(r.version ?? top[i].version).slice(0, 40);
    if (r.cls === "loaded") {
      const note = `${prefix} \`omp plugin install\` succeeds and the package loads with no errors. It adds ${describe(r.added)}. Its tools were not called.`;
      reports.push({ name: r.pkg!, version, status: "works", note: note.slice(0, 500) });
    } else if (STAGE[r.cls]) {
      const error = firstError(r, r.cls).replace(/\/tmp\/home-[^/]+\/\.omp\/plugins\/node_modules\//g, "").replace(/\?mtime=\d+/g, "");
      reports.push({ name: r.pkg!, version, status: "broken", note: `${prefix} ${STAGE[r.cls]}. Error: ${error}`.slice(0, 500) });
    }
  }
  save("base.json", base);
  save("results.json", results);
  save("reports.json", reports);
  const count = (cls: Cls) => results.filter((r) => r.cls === cls).length;
  console.log(`omp ${omp}: ${(["loaded", "loaded_nothing", "install_fail", "no_ready", "ext_error", "harness"] as Cls[]).map((c) => `${c} ${count(c)}`).join(", ")}`);
  console.log(`publishable: ${reports.filter((r) => r.status === "works").length} works, ${reports.filter((r) => r.status === "broken").length} broken`);
}

async function publish() {
  const reports: Report[] = JSON.parse(readFileSync(`${OUT}/reports.json`, "utf8"));
  const works = reports.filter((r) => r.status === "works").length;
  const [[prev]] = await d1([
    {
      sql: "SELECT COUNT(*) AS works FROM reports WHERE ip_hash = ?1 AND status = 'works' AND created_at = (SELECT MAX(created_at) FROM reports WHERE ip_hash = ?1)",
      params: [OUR_TESTS],
    },
  ]);
  const drop = Number(prev.works) - works;
  if (drop > MAX_WORKS_DROP && process.env.FORCE !== "true") {
    throw new Error(`works fell from ${prev.works} to ${works}; check results.json for a harness fault, then rerun with force`);
  }
  // Every row shares one created_at: /report shows only the rows with the newest one.
  const now = new Date().toISOString();
  const run = "SELECT name FROM reports WHERE ip_hash = ?1 AND created_at = ?2";
  await d1([
    ...reports.map((r) => ({
      sql: `INSERT INTO reports (name, ip_hash, version, status, note, created_at) SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE EXISTS (SELECT 1 FROM packages WHERE name = ?1)
        ON CONFLICT (name, ip_hash) DO UPDATE SET version = ?3, status = ?4, note = ?5, created_at = ?6`,
      params: [r.name, OUR_TESTS, r.version, r.status, r.note, now],
    })),
    {
      sql: `UPDATE packages SET works = (SELECT COUNT(*) FROM reports r WHERE r.name = packages.name AND r.status = 'works'),
        broken = (SELECT COUNT(*) FROM reports r WHERE r.name = packages.name AND r.status = 'broken') WHERE name IN (${run})`,
      params: [OUR_TESTS, now],
    },
    { sql: `UPDATE packages SET status = ${statusCase("source")} WHERE name IN (${run})`, params: [OUR_TESTS, now] },
    { sql: REFRESH_COUNTS },
  ]);
  console.log(`published ${reports.length} reports at ${now}: ${works} works (last run ${prev.works})`);
}

const steps: Record<string, () => Promise<void>> = { prepare, test, publish };
const step = steps[process.argv[2]];
if (!step) throw new Error("usage: node tester/run.ts prepare|test|publish");
await step();
