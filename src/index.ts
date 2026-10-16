const OMP_KEYWORDS = ["omp-package", "omp-plugin", "omp-extension", "oh-my-pi"];
const KEYWORDS = [...OMP_KEYWORDS, "pi-package"];
const NPM_PAGE = 250;
const PAGES_PER_RUN = 5; // ponytail: npm search returns 429 on bursts; full crawl takes ~1h at one run per 5 min
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

interface Row {
  name: string;
  version: string;
  description: string;
  author: string;
  repo_url: string | null;
  monthly_downloads: number;
  published_at: string | null;
  source: "omp" | "pi";
  works: number;
  broken: number;
}

async function sync(db: D1Database): Promise<void> {
  const saved = await db.prepare("SELECT value FROM meta WHERE key = 'cursor'").first<string>("value");
  let cur: { k: number; from: number } = saved ? JSON.parse(saved) : { k: 0, from: 0 };
  const upsert = db.prepare(
    `INSERT INTO packages (name, version, description, keywords, author, repo_url, monthly_downloads, published_at, source, synced_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
     ON CONFLICT (name) DO UPDATE SET version = ?2, description = ?3, keywords = ?4, author = ?5, repo_url = ?6,
       monthly_downloads = ?7, published_at = ?8, source = ?9, synced_at = ?10`,
  );
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
    if (!objects.length || cur.from >= total) cur = { k: (cur.k + 1) % KEYWORDS.length, from: 0 };
  }
  await db
    .prepare("INSERT INTO meta (key, value) VALUES ('cursor', ?1) ON CONFLICT (key) DO UPDATE SET value = ?1")
    .bind(JSON.stringify(cur))
    .run();
}

function repoUrl(raw?: string): string | null {
  if (!raw) return null;
  const url = raw.replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://");
  return url.startsWith("https://") ? url : null;
}

const SELECT = `SELECT p.name, p.version, p.description, p.author, p.repo_url, p.monthly_downloads, p.published_at, p.source,
  COALESCE(SUM(r.status = 'works'), 0) AS works, COALESCE(SUM(r.status = 'broken'), 0) AS broken
  FROM packages p LEFT JOIN reports r ON r.name = p.name`;

const FILTERS: Record<string, { label: string; where?: string; having?: string }> = {
  all: { label: "All" },
  omp: { label: "Built for omp", where: "p.source = 'omp'" },
  works: { label: "Reported working", having: "works > 0 AND works >= broken" },
  broken: { label: "Reported broken", having: "broken > works" },
};

async function list(db: D1Database, url: URL): Promise<Response> {
  const q = url.searchParams.get("q")?.trim() ?? "";
  const raw = url.searchParams.get("filter") ?? "";
  const filter = Object.hasOwn(FILTERS, raw) ? raw : "all";
  const page = Math.floor(Math.min(1000, Math.max(1, Number(url.searchParams.get("page")) || 1)));
  const f = FILTERS[filter];
  const where = [q && "(p.name LIKE ?1 OR p.description LIKE ?1)", f.where].filter(Boolean);
  const sql = `${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} GROUP BY p.name
    ${f.having ? `HAVING ${f.having}` : ""} ORDER BY p.monthly_downloads DESC LIMIT ${LIST_PAGE + 1} OFFSET ${(page - 1) * LIST_PAGE}`;
  const stmt = db.prepare(sql);
  const { results } = await (q ? stmt.bind(`%${q}%`) : stmt).all<Row>();
  const total = await db.prepare("SELECT COUNT(*) AS n FROM packages").first<number>("n");

  const link = (params: Record<string, string | number>) =>
    "/?" + new URLSearchParams({ ...(q && { q }), filter, page: String(page), ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const tabs = Object.entries(FILTERS)
    .map(([key, { label }]) => `<a href="${esc(link({ filter: key, page: 1 }))}"${key === filter ? ' class="on"' : ""}>${label}</a>`)
    .join("");
  const nav = [
    page > 1 && `<a href="${esc(link({ page: page - 1 }))}">← Prev</a>`,
    results.length > LIST_PAGE && `<a href="${esc(link({ page: page + 1 }))}">Next →</a>`,
  ].filter(Boolean).join(" ");

  return html(
    "Packages",
    `<p class="muted">${total ?? 0} packages indexed from npm. Packages tagged ${OMP_KEYWORDS.map((k) => `<code>${k}</code>`).join(", ")} are built for omp. Everything else is a pi package and is untested on omp until someone reports.</p>
    <form class="search"><input type="search" name="q" value="${esc(q)}" placeholder="Search packages" autofocus><input type="hidden" name="filter" value="${esc(filter)}"><button>Search</button></form>
    <nav class="tabs">${tabs}</nav>
    ${results.slice(0, LIST_PAGE).map(card).join("") || '<p class="muted">No packages found.</p>'}
    <nav class="pager">${nav}</nav>`,
  );
}

function card(p: Row): string {
  return `<article class="card">
    <h2><a href="/packages/${esc(p.name)}">${esc(p.name)}</a> <span class="muted">${esc(p.version)}</span> ${badge(p)}</h2>
    <p>${esc(p.description)}</p>
    <p class="muted">${esc(p.author)} · ${fmt(p.monthly_downloads)}/mo${p.published_at ? ` · ${p.published_at.slice(0, 10)}` : ""}</p>
  </article>`;
}

function badge(p: Row): string {
  if (p.source === "omp") return '<span class="badge ok">omp-native</span>';
  if (p.works > 0 && p.works >= p.broken) return `<span class="badge ok">works on omp (${p.works})</span>`;
  if (p.broken > p.works) return `<span class="badge bad">broken on omp (${p.broken})</span>`;
  return '<span class="badge">pi · untested</span>';
}

async function detail(db: D1Database, name: string): Promise<Response> {
  const p = await db.prepare(`${SELECT} WHERE p.name = ?1 GROUP BY p.name`).bind(name).first<Row>();
  if (!p) return html("Not found", "<p>No such package.</p>", 404);
  const { results: reports } = await db
    .prepare("SELECT version, status, note, created_at FROM reports WHERE name = ?1 ORDER BY created_at DESC LIMIT 100")
    .bind(name)
    .all<{ version: string; status: string; note: string; created_at: string }>();
  return html(
    p.name,
    `<h1>${esc(p.name)} <span class="muted">${esc(p.version)}</span> ${badge(p)}</h1>
    <p>${esc(p.description)}</p>
    <pre><code>omp plugin install ${esc(p.name)}</code></pre>
    <p><a href="https://www.npmjs.com/package/${esc(p.name)}">npm</a>${p.repo_url ? ` · <a href="${esc(p.repo_url)}">repo</a>` : ""} · ${esc(p.author)} · ${fmt(p.monthly_downloads)}/mo</p>
    <h2>Does it work on omp?</h2>
    <form method="post" action="/packages/${esc(p.name)}/report" class="report">
      <label><input type="radio" name="status" value="works" required> Works</label>
      <label><input type="radio" name="status" value="broken"> Broken</label>
      <input name="version" value="${esc(p.version)}" placeholder="package version" maxlength="40">
      <textarea name="note" placeholder="omp version, what failed (optional)" maxlength="500"></textarea>
      <button>Submit report</button>
    </form>
    <p class="muted">One report per person per package. A new report replaces your old one.</p>
    ${reports
      .map(
        (r) => `<div class="report-row"><span class="badge ${r.status === "works" ? "ok" : "bad"}">${r.status}</span>
        <span class="muted">v${esc(r.version)} · ${r.created_at.slice(0, 10)}</span>${r.note ? `<p>${esc(r.note)}</p>` : ""}</div>`,
      )
      .join("")}`,
  );
}

async function report(db: D1Database, req: Request, name: string): Promise<Response> {
  const form = await req.formData();
  const status = form.get("status");
  if (status !== "works" && status !== "broken") return new Response("Bad status", { status: 400 });
  const exists = await db.prepare("SELECT 1 FROM packages WHERE name = ?1").bind(name).first();
  if (!exists) return new Response("Unknown package", { status: 404 });
  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}\n${name}`));
  const ipHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  await db
    .prepare(
      `INSERT INTO reports (name, ip_hash, version, status, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT (name, ip_hash) DO UPDATE SET version = ?3, status = ?4, note = ?5, created_at = ?6`,
    )
    .bind(
      name,
      ipHash,
      String(form.get("version") ?? "").slice(0, 40),
      status,
      String(form.get("note") ?? "").slice(0, 500),
      new Date().toISOString(),
    )
    .run();
  return Response.redirect(new URL(`/packages/${name}`, req.url).toString(), 303);
}

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const CSS = `:root{color-scheme:light dark;--fg:#1a1a1a;--muted:#666;--border:#ddd;--ok:#1a7f37;--bad:#cf222e}
@media(prefers-color-scheme:dark){:root{--fg:#e6e6e6;--muted:#999;--border:#333;--ok:#3fb950;--bad:#f85149}}
body{font:16px/1.5 system-ui,sans-serif;color:var(--fg);max-width:860px;margin:0 auto;padding:1rem}
header{display:flex;gap:1rem;align-items:baseline;border-bottom:1px solid var(--border);margin-bottom:1rem}
header a{color:inherit;text-decoration:none}a{color:inherit}.muted{color:var(--muted)}
.card{border-bottom:1px solid var(--border);padding:.5rem 0}.card h2{font-size:1.1rem;margin:0}.card p{margin:.25rem 0}
.badge{font-size:.75rem;border:1px solid var(--border);border-radius:1rem;padding:0 .5rem;font-weight:normal;color:var(--muted)}
.badge.ok{color:var(--ok);border-color:var(--ok)}.badge.bad{color:var(--bad);border-color:var(--bad)}
.search{display:flex;gap:.5rem}.search input{flex:1}input,textarea,button{font:inherit;padding:.4rem}
.tabs,.pager{display:flex;gap:1rem;margin:1rem 0}.tabs a.on{font-weight:bold}
pre{border:1px solid var(--border);padding:.5rem;overflow:auto}
.report{display:grid;gap:.5rem;max-width:480px}.report-row{border-top:1px solid var(--border);padding:.5rem 0}.report-row p{margin:.25rem 0}`;

function html(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · omp packages</title><style>${CSS}</style></head>
<body><header><h1><a href="/">omp packages</a></h1><a href="https://github.com/can1357/oh-my-pi">oh-my-pi</a></header>${body}</body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export default {
  async fetch(req, env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/") return list(env.DB, url);
    const m = url.pathname.match(/^\/packages\/(.+?)(\/report)?$/);
    if (!m) return html("Not found", "<p>Not found.</p>", 404);
    const name = decodeURIComponent(m[1]);
    if (m[2] && req.method === "POST") return report(env.DB, req, name);
    if (!m[2] && req.method === "GET") return detail(env.DB, name);
    return new Response("Method not allowed", { status: 405 });
  },
  async scheduled(_event, env): Promise<void> {
    await sync(env.DB);
  },
} satisfies ExportedHandler<Env>;
