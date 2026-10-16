import { renderReadme } from "./readme";
import { OMP_KEYWORDS, SCRIPT, SORTS, detailPage, esc, layout, listPage, listingPage, messagePage, type Extra, type Pkg, type Report, type Status } from "./views";

const KEYWORDS = [...OMP_KEYWORDS, "pi-package"];
const NPM_PAGE = 250;
const PAGES_PER_RUN = 5; // ponytail: npm search returns 429 on bursts; full crawl takes ~6h at one run per 30 min
const LIST_PAGE = 50;

interface NpmObject {
  package: {
    name: string;
    version: string;
    description?: string;
    keywords?: string[];
    date?: string;
    links?: { repository?: string };
    publisher?: { username?: string };
  };
  downloads?: { monthly?: number };
}

async function sync(db: D1Database): Promise<void> {
  const saved = await db.prepare("SELECT value FROM meta WHERE key = 'cursor'").first<string>("value");
  let cur: { k: number; from: number } = saved ? JSON.parse(saved) : { k: 0, from: 0 };
  const upsert = db.prepare(
    `INSERT INTO packages (name, version, description, keywords, author, repo_url, monthly_downloads, published_at, source, synced_at, status)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, CASE ?9 WHEN 'omp' THEN 'native' ELSE 'untested' END)
     ON CONFLICT (name) DO UPDATE SET version = ?2, description = ?3, keywords = ?4, author = ?5, repo_url = ?6,
       monthly_downloads = ?7, published_at = ?8, source = ?9, synced_at = ?10, status = ${statusCase("?9")}
     WHERE version IS NOT ?2 OR description IS NOT ?3 OR keywords IS NOT ?4 OR author IS NOT ?5 OR repo_url IS NOT ?6
       OR published_at IS NOT ?8 OR source IS NOT ?9 OR abs(monthly_downloads - ?7) * 4 > monthly_downloads`,
  );
  let wrapped = false;
  const now = new Date().toISOString();
  for (let i = 0; i < PAGES_PER_RUN; i++) {
    const kw = KEYWORDS[cur.k];
    const res = await fetch(`https://registry.npmjs.org/-/v1/search?text=keywords:${kw}&size=${NPM_PAGE}&from=${cur.from}`);
    if (!res.ok) {
      console.warn(`npm search ${res.status} for ${kw}@${cur.from}; resuming next run`);
      break;
    }
    const { objects, total } = (await res.json()) as { objects: NpmObject[]; total: number };
    const rows = objects.filter((o) => o.package.keywords?.includes(kw));
    if (rows.length) {
      await db.batch(
        rows.map(({ package: p, downloads }) => {
          const kws = p.keywords ?? [];
          return upsert.bind(
            p.name,
            p.version,
            p.description ?? "",
            JSON.stringify(kws),
            p.publisher?.username ?? "",
            repoUrl(p.links?.repository),
            downloads?.monthly ?? 0,
            p.date ?? null,
            kws.some((k) => OMP_KEYWORDS.includes(k)) ? "omp" : "pi",
            now,
          );
        }),
      );
    }
    cur.from += NPM_PAGE;
    if (!objects.length || cur.from >= total) {
      cur = { k: (cur.k + 1) % KEYWORDS.length, from: 0 };
      wrapped ||= cur.k === 0;
    }
  }
  await db.batch([
    db.prepare("INSERT INTO meta (key, value) VALUES ('cursor', ?1) ON CONFLICT (key) DO UPDATE SET value = ?1").bind(JSON.stringify(cur)),
    ...(wrapped ? [db.prepare(REFRESH_COUNTS)] : []),
  ]);
}

function repoUrl(raw?: string): string | null {
  if (!raw) return null;
  const url = raw.replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://");
  return url.startsWith("https://") ? url : null;
}

// Status precedence: broken reports beat everything; then the author's omp tag; then works reports.
const statusCase = (source: string) =>
  `CASE WHEN broken > works THEN 'broken' WHEN ${source} = 'omp' THEN 'native' WHEN works > 0 THEN 'works' ELSE 'untested' END`;
// ponytail: catalog-wide counts refresh once per full crawl and on each report; live counts would scan every row per page view.
const REFRESH_COUNTS = `INSERT INTO meta (key, value) SELECT 'counts', json_group_object(status, n) FROM (SELECT status, COUNT(*) AS n FROM packages GROUP BY status)
  WHERE true ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
const STATUSES: Status[] = ["native", "works", "broken", "untested"];

async function list(db: D1Database, url: URL): Promise<Response> {
  const q = url.searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const rawStatus = url.searchParams.get("status") ?? "";
  const status = STATUSES.find((s) => s === rawStatus) ?? "all";
  const rawSort = url.searchParams.get("sort") ?? "";
  const sort = Object.hasOwn(SORTS, rawSort) ? rawSort : "downloads";
  const page = Math.floor(Math.min(1000, Math.max(1, Number(url.searchParams.get("page")) || 1)));
  const match = "(name LIKE ?1 OR description LIKE ?1)";
  const pattern = `%${q}%`;
  const where = q ? [match] : [];
  const params: string[] = q ? [pattern] : [];
  if (status !== "all") {
    where.push(`status = ?${params.length + 1}`);
    params.push(status);
  }
  const [rows, counts] = await db.batch([
    db
      .prepare(
        `SELECT * FROM packages ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY ${SORTS[sort].sql} LIMIT ${LIST_PAGE + 1} OFFSET ${(page - 1) * LIST_PAGE}`,
      )
      .bind(...params),
    q
      ? db.prepare(`SELECT json_group_object(status, n) AS value FROM (SELECT status, COUNT(*) AS n FROM packages WHERE ${match} GROUP BY status)`).bind(pattern)
      : db.prepare("SELECT value FROM meta WHERE key = 'counts'"),
  ]);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  Object.assign(byStatus, JSON.parse((counts.results[0] as { value?: string } | undefined)?.value ?? "{}"));
  const results = rows.results as Pkg[];
  return html(
    q ? `“${q}” · omp packages` : "omp packages: plugins for oh-my-pi",
    listPage({ q, status, sort, page, pageSize: LIST_PAGE, rows: results.slice(0, LIST_PAGE), hasNext: results.length > LIST_PAGE, counts: byStatus }),
    200,
    { q },
  );
}

async function detail(db: D1Database, name: string): Promise<Response> {
  const [[pkg, reports], extra] = await Promise.all([
    db.batch([
      db.prepare("SELECT * FROM packages WHERE name = ?1").bind(name),
      db.prepare("SELECT version, status, note, created_at FROM reports WHERE name = ?1 ORDER BY created_at DESC LIMIT 100").bind(name),
    ]),
    npmExtra(name),
  ]);
  const p = pkg.results[0] as Pkg | undefined;
  if (!p) return notFound(`No package named <code>${esc(name)}</code> is listed. It may not be on npm, or the sync has not reached it yet.`);
  if (extra?.readme) extra.readme = await renderReadme(extra.readme, p.repo_url);
  return html(`${p.name} · omp packages`, detailPage(p, reports.results as Report[], extra));
}

interface Manifest {
  license?: string | { type?: string };
  homepage?: string;
  bugs?: string | { url?: string };
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  omp?: Record<string, unknown>;
  pi?: Record<string, unknown>;
  dist?: { unpackedSize?: number; fileCount?: number };
}

interface NpmDoc {
  readme?: string;
  "dist-tags"?: { latest?: string };
  versions?: Record<string, Manifest>;
  time?: Record<string, string>;
  maintainers?: { name: string }[];
}

// The full registry document is the only npm source with the README; a failed fetch renders the page without it.
async function npmExtra(name: string): Promise<Extra | null> {
  const res = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}`, { cf: { cacheTtl: 600, cacheEverything: true } }).catch(() => null);
  if (!res?.ok) return null;
  const doc = await res.json<NpmDoc>().catch(() => null);
  const m = doc?.versions?.[doc["dist-tags"]?.latest ?? ""];
  if (!doc || !m) return null;
  const license = typeof m.license === "string" ? m.license : m.license?.type;
  const bugs = typeof m.bugs === "string" ? m.bugs : m.bugs?.url;
  const http = (u?: string) => (u && /^https?:\/\//.test(u) ? u : null);
  return {
    readme: doc.readme && doc.readme !== "ERROR: No README data found!" ? doc.readme : "",
    license: license ?? null,
    homepage: http(m.homepage),
    issues: http(bugs),
    versions: Object.keys(doc.versions ?? {}).length,
    created: doc.time?.created ?? null,
    maintainers: (doc.maintainers ?? []).map((x) => x.name),
    deps: Object.keys(m.dependencies ?? {}),
    peers: Object.keys(m.peerDependencies ?? {}),
    engines: m.engines ?? {},
    provides: Object.entries(m.omp ?? m.pi ?? {}).flatMap(([k, v]) => (Array.isArray(v) ? [[k, v.length] as [string, number]] : [])),
    size: m.dist?.unpackedSize ?? null,
    files: m.dist?.fileCount ?? null,
  };
}

async function report(db: D1Database, req: Request, name: string): Promise<Response> {
  const form = await req.formData();
  const status = form.get("status");
  if (status !== "works" && status !== "broken") {
    return html("Report not saved · omp packages", messagePage("Report not saved", `Choose “It works” or “It's broken”, then submit again. <a href="/packages/${esc(name)}">Back to ${esc(name)}</a>`), 400);
  }
  const exists = await db.prepare("SELECT 1 FROM packages WHERE name = ?1").bind(name).first();
  if (!exists) return notFound(`No package named <code>${esc(name)}</code> is listed, so the report was not saved.`);
  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}\n${name}`));
  const ipHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  await db.batch([
    db
      .prepare(
        `INSERT INTO reports (name, ip_hash, version, status, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT (name, ip_hash) DO UPDATE SET version = ?3, status = ?4, note = ?5, created_at = ?6`,
      )
      .bind(name, ipHash, String(form.get("version") ?? "").slice(0, 40), status, String(form.get("note") ?? "").slice(0, 500), new Date().toISOString()),
    db
      .prepare(
        `UPDATE packages SET works = (SELECT COUNT(*) FROM reports WHERE name = ?1 AND status = 'works'),
           broken = (SELECT COUNT(*) FROM reports WHERE name = ?1 AND status = 'broken') WHERE name = ?1`,
      )
      .bind(name),
    db.prepare(`UPDATE packages SET status = ${statusCase("source")} WHERE name = ?1`).bind(name),
    db.prepare(REFRESH_COUNTS),
  ]);
  return Response.redirect(new URL(`/packages/${name}`, req.url).toString(), 303);
}

// README HTML is untrusted; the CSP backs up the sanitizer by allowing only the page's own copy script.
let csp = "";
async function initCsp(): Promise<void> {
  const hash = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SCRIPT)))));
  csp = `default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src https: http: data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`;
}

function html(title: string, body: string, status = 200, opts: { q?: string; nav?: "listing" } = {}): Response {
  return new Response(layout(title, body, opts), { status, headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": csp } });
}

const notFound = (body: string) => html("Not found · omp packages", messagePage("Not found", body), 404);

export default {
  async fetch(req, env): Promise<Response> {
    if (!csp) await initCsp();
    const url = new URL(req.url);
    if (url.pathname === "/") return list(env.DB, url);
    if (url.pathname === "/get-listed") return html("Get listed · omp packages", listingPage(), 200, { nav: "listing" });
    const m = url.pathname.match(/^\/packages\/(.+?)(\/report)?$/);
    if (!m) return notFound("This page does not exist.");
    const name = decodeURIComponent(m[1]);
    if (m[2] && req.method === "POST") return report(env.DB, req, name);
    if (!m[2] && req.method === "GET") return detail(env.DB, name);
    return new Response("Method not allowed", { status: 405 });
  },
  async scheduled(_event, env): Promise<void> {
    await sync(env.DB);
  },
} satisfies ExportedHandler<Env>;
