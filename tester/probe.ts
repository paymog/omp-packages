// Usage: bun probe.ts [package]. Prints one JSON line describing install and load results.
import { mkdtempSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Frame = { id?: string; type?: string; level?: string; success?: boolean; data?: { commands?: { source: string; name: string }[]; dumpTools?: { name: string }[]; systemPrompt?: unknown } };

const pkg = process.argv[2];
const home = mkdtempSync("/tmp/home-");
const env = { ...process.env, HOME: home, ANTHROPIC_API_KEY: "sk-ant-dummy-no-calls", NO_COLOR: "1", TERM: "dumb" };
const out: Record<string, unknown> = { pkg };

async function run(cmd: string[], cwd: string, timeoutMs: number) {
  const p = Bun.spawn(cmd, { cwd, env, stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => p.kill(), timeoutMs);
  const [stdout, stderr, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  clearTimeout(timer);
  return { stdout, stderr, code };
}

if (pkg) {
  const r = await run(["omp", "plugin", "install", pkg, "--json"], home, 240_000);
  out.installCode = r.code;
  out.installErr = (r.stderr || (r.code ? r.stdout : "")).slice(-2000);
  try {
    const j = JSON.parse(r.stdout);
    out.manifest = j.manifest;
    out.version = j.version;
  } catch {}
  const dir = join(home, ".omp/plugins/node_modules", pkg);
  if (existsSync(join(dir, "package.json"))) {
    const pj = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    out.version ??= pj.version;
    out.pkgPi = pj.pi ?? null;
    out.pkgOmp = pj.omp ?? null;
    out.dirs = ["extensions", "skills", "prompts", "themes", "tools", "commands", "hooks", "agents"].filter((d) => existsSync(join(dir, d)));
  }
  if (r.code !== 0) {
    console.log(JSON.stringify(out));
    process.exit(0);
  }
}

const work = join(home, "work");
mkdirSync(work);
const p = Bun.spawn(["omp", "--mode", "rpc", "--no-ui"], { cwd: work, env, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
const frames: Frame[] = [];
let ready = false;
const reader = (async () => {
  let buf = "";
  const dec = new TextDecoder();
  for await (const chunk of p.stdout) {
    buf += dec.decode(chunk);
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      try {
        const f = JSON.parse(line) as Frame;
        frames.push(f);
        if (f.type === "ready") ready = true;
      } catch {}
    }
  }
})();
const stderrP = new Response(p.stderr).text();
const start = Date.now();
while (!ready && Date.now() - start < 90_000 && p.exitCode === null) await Bun.sleep(200);
if (ready) {
  p.stdin.write(JSON.stringify({ id: "c", type: "get_available_commands" }) + "\n");
  p.stdin.write(JSON.stringify({ id: "s", type: "get_state" }) + "\n");
  p.stdin.flush();
  await Bun.sleep(10_000);
}
p.stdin.end();
const killer = setTimeout(() => p.kill(), 20_000);
await p.exited;
clearTimeout(killer);
await reader;
out.ready = ready;
out.exitCode = p.exitCode;
out.stderr = (await stderrP).slice(-2000);
const c = frames.find((f) => f.id === "c" && f.success);
const s = frames.find((f) => f.id === "s" && f.success);
out.commands = (c?.data?.commands ?? []).map((x) => `${x.source}:${x.name}`);
out.tools = (s?.data?.dumpTools ?? []).map((t) => t.name);
out.devices = [...JSON.stringify(s?.data?.systemPrompt ?? "").matchAll(/xd:\/\/([A-Za-z0-9_.-]+)|\\n- ([A-Za-z0-9_.-]+) — /g)].map((m) => m[1] ?? m[2]);
out.errors = frames.filter((f) => f.type === "extension_error" || (f.type === "notice" && f.level === "error"));
console.log(JSON.stringify(out));
