import { renderReadme } from "./readme";
import { OMP_KEYWORDS, SCRIPT, SITE, SORTS, STATUS, aboutPage, badge, detailMarkdown, detailPage, esc, layout, listMarkdown, listPage, listingPage, messagePage, privacyPage, type Extra, type Head, type ListView, type Pkg, type Report, type Status } from "./views";

const KEYWORDS = [...OMP_KEYWORDS, "pi-package"];
const NPM_PAGE = 250;
const PAGES_PER_RUN = 5; // ponytail: npm search returns 429 on bursts; full crawl takes ~6h at one run per 30 min
const LIST_PAGE = 50;
const INDEXNOW_KEY = "a3b4b96ec6b1788a83a65e91f983cbf1"; // public by design; public/<key>.txt proves ownership

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
  const changed: string[] = [];
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
      const results = await db.batch(
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
      results.forEach((r, j) => r.meta.changes && changed.push(rows[j].package.name));
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
  if (changed.length) {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: new URL(SITE).host, key: INDEXNOW_KEY, urlList: changed.map((n) => `${SITE}/packages/${n}`) }),
    });
    if (!res.ok) console.warn(`IndexNow ${res.status} for ${changed.length} URLs`);
  }
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
// Reporter id on reports written by our own install tests; real ip_hash values are hex digests, so it cannot collide.
const OUR_TESTS = "omppackages-load-test";
const SEARCH_CAP = 1000;

async function list(db: D1Database, url: URL, md: boolean): Promise<Response> {
  const q = url.searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const rawStatus = url.searchParams.get("status") ?? "";
  const status = STATUSES.find((s) => s === rawStatus) ?? "all";
  const rawSort = url.searchParams.get("sort") ?? "";
  const sort = Object.hasOwn(SORTS, rawSort) ? rawSort : "downloads";
  const page = Math.floor(Math.min(1000, Math.max(1, Number(url.searchParams.get("page")) || 1)));
  // Trigram FTS matches substrings like LIKE '%q%' but reads only matching rows; it needs at least 3 characters.
  // Sorting and counting read every match, so cap matches to bound the rows a broad search reads.
  const searchable = [...q].length >= 3;
  const match = searchable ? "packages_fts MATCH ?1" : "0";
  const from = q ? `(SELECT rowid FROM packages_fts WHERE ${match} LIMIT ${SEARCH_CAP}) f JOIN packages p ON p.rowid = f.rowid` : "packages p";
  const phrase = `"${q.replaceAll('"', '""')}"`;
  const where: string[] = [];
  const params: string[] = q && searchable ? [phrase] : [];
  if (status !== "all") {
    where.push(`p.status = ?${params.length + 1}`);
    params.push(status);
  }
  const [rows, counts] = await db.batch([
    db
      .prepare(
        `SELECT p.* FROM ${from} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY ${SORTS[sort].sql} LIMIT ${LIST_PAGE + 1} OFFSET ${(page - 1) * LIST_PAGE}`,
      )
      .bind(...params),
    q
      ? db.prepare(`SELECT json_group_object(status, n) AS value FROM (SELECT p.status, COUNT(*) AS n FROM ${from} GROUP BY p.status)`).bind(...(searchable ? [phrase] : []))
      : db.prepare("SELECT value FROM meta WHERE key = 'counts'"),
  ]);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  Object.assign(byStatus, JSON.parse((counts.results[0] as { value?: string } | undefined)?.value ?? "{}"));
  const results = rows.results as Pkg[];
  const canonical = new URLSearchParams();
  if (status !== "all") canonical.set("status", status);
  if (page > 1) canonical.set("page", String(page));
  const head: Head = { q, path: q ? undefined : `/${canonical.size ? `?${canonical}` : ""}` };
  if (status !== "all") head.description = `${STATUS[status].label}: ${byStatus[status]} npm packages for oh-my-pi (omp), with user compatibility reports.`;
  if (head.path === "/") {
    head.jsonld = [{ "@type": "WebSite", "@id": `${SITE}/#website`, name: "omp packages", url: `${SITE}/`, potentialAction: { "@type": "SearchAction", target: `${SITE}/search?q={search_term_string}`, "query-input": "required name=search_term_string" } }];
  }
  const title = q ? `“${q}”` : status === "all" ? "omp packages: plugins for oh-my-pi" : LIST_TITLE[status];
  const capped = q !== "" && Object.values(byStatus).reduce((a, b) => a + b, 0) >= SEARCH_CAP;
  const view: ListView = { q, status, sort, page, pageSize: LIST_PAGE, rows: results.slice(0, LIST_PAGE), hasNext: results.length > LIST_PAGE, counts: byStatus, capped };
  const res = md
    ? markdown(listMarkdown(title, head.description, view, url))
    : html(`${title}${page > 1 ? ` · page ${page}` : ""}${status === "all" && !q ? "" : " · omp packages"}`, listPage(view), 200, head);
  res.headers.set("cache-tag", "list");
  return res;
}

const LIST_TITLE: Record<Status, string> = {
  native: "Plugins built for oh-my-pi",
  works: "pi packages that work on omp",
  broken: "pi packages broken on omp",
  untested: "pi packages not yet tested on omp",
};

async function detail(db: D1Database, name: string, md: boolean): Promise<Response> {
  const [[pkg, reports], extra] = await Promise.all([
    db.batch([
      db.prepare("SELECT * FROM packages WHERE name = ?1").bind(name),
      db.prepare("SELECT version, status, note, created_at, ip_hash = ?2 AS ours FROM reports WHERE name = ?1 ORDER BY ours DESC, created_at DESC LIMIT 100").bind(name, OUR_TESTS),
    ]),
    npmExtra(name),
  ]);
  const p = pkg.results[0] as Pkg | undefined;
  if (!p) return notFound(`No package named <code>${esc(name)}</code> is listed. It may not be on npm, or the sync has not reached it yet.`);
  const tag = `pkg:${p.name}`;
  if (md) {
    const res = markdown(detailMarkdown(p, reports.results as Report[], extra?.readme ?? ""));
    res.headers.set("cache-tag", tag);
    return res;
  }
  if (extra?.readme) extra.readme = await renderReadme(extra.readme, p.repo_url);
  const deps = [...(extra?.deps ?? []), ...(extra?.peers ?? [])].slice(0, 100);
  const listed = deps.length
    ? (await db.prepare(`SELECT name FROM packages WHERE name IN (${deps.map((_, i) => `?${i + 1}`).join(",")})`).bind(...deps).all<{ name: string }>()).results.map((r) => r.name)
    : [];
  const path = `/packages/${p.name}`;
  const total = p.works + p.broken;
  const description = `${STATUS[p.status].label}${total ? ` (${p.works} works, ${p.broken} broken reports)` : ""}. ${p.description}`.slice(0, 200);
  const jsonld = [
    {
      "@type": "SoftwareSourceCode",
      "@id": `${SITE + path}#package`,
      isPartOf: { "@id": `${SITE}/#website` },
      name: p.name,
      description: p.description || undefined,
      url: SITE + path,
      version: p.version,
      codeRepository: p.repo_url ?? undefined,
      license: extra?.license ?? undefined,
      author: p.author ? { "@type": "Person", name: p.author } : undefined,
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${SITE + path}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Packages", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: p.name, item: SITE + path },
      ],
    },
  ];
  const res = html(`${p.name}: ${STATUS[p.status].label} · omp packages`, detailPage(p, reports.results as Report[], extra, new Set(listed)), 200, { description, path, jsonld });
  res.headers.set("cache-tag", tag);
  return res;
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

async function report(db: D1Database, req: Request, name: string, ctx: ExecutionContext): Promise<Response> {
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
  // Workers Caching serves pages without running the Worker; drop this package's pages and every list (counts changed).
  await ctx.cache?.purge({ tags: [`pkg:${name}`, "list"] });
  return new Response(null, { status: 303, headers: { location: `/packages/${name}` } });
}

async function badgeSvg(db: D1Database, name: string): Promise<Response> {
  const row = await db.prepare("SELECT status FROM packages WHERE name = ?1").bind(name).first<{ status: Status }>();
  return new Response(badge(row?.status ?? null), { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=3600", "cache-tag": `pkg:${name}` } });
}

async function sitemap(db: D1Database): Promise<Response> {
  const { results } = await db.prepare("SELECT name, published_at FROM packages ORDER BY name").all<{ name: string; published_at: string | null }>();
  const loc = (path: string, lastmod?: string | null) => `<url><loc>${esc(SITE + path)}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ""}</url>`;
  const urls = [...["/", "/get-listed", "/about", "/privacy", ...STATUSES.map((s) => `/?status=${s}`)].map((p) => loc(p)), ...results.map((r) => loc(`/packages/${r.name}`, r.published_at))];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}

// README HTML is untrusted; the CSP backs up the sanitizer by allowing only the page's own copy script.
let csp = "";
async function initCsp(): Promise<void> {
  const hash = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SCRIPT)))));
  csp = `default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src https: http: data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`;
}

function html(title: string, body: string, status = 200, head: Head = {}): Response {
  return new Response(layout(title, body, head), {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": csp, vary: "accept", link: '</llms.txt>; rel="describedby"; type="text/markdown"' },
  });
}

function markdown(text: string): Response {
  return new Response(text, { headers: { "content-type": "text/markdown; charset=utf-8", vary: "accept" } });
}

const notFound = (body: string) => html("Not found · omp packages", messagePage("Not found", body), 404);

async function route(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const md = req.headers.get("accept")?.includes("text/markdown") ?? false;
  // Search has its own path because the free rate-limit rule can match only on path.
  if (url.pathname === "/" && url.searchParams.has("q")) return new Response(null, { status: 301, headers: { location: `/search${url.search}` } });
  if (url.pathname === "/" || url.pathname === "/search") return list(env.DB, url, md);
  if (url.pathname === "/get-listed") return html("Get listed · omp packages", listingPage(), 200, { nav: "listing", path: "/get-listed", description: "Publish an oh-my-pi (omp) plugin to npm with an omp keyword and it appears in the omp packages catalog." });
  if (url.pathname === "/about") return html("About · omp packages", aboutPage(), 200, { path: "/about", description: "What omp packages is, where its data comes from, and how it decides whether a pi package works on oh-my-pi (omp)." });
  if (url.pathname === "/privacy") return html("Privacy · omp packages", privacyPage(), 200, { path: "/privacy", description: "What omp packages stores about visitors and reporters: a one-way hash of the IP address and package name, and nothing else." });
  if (url.pathname === "/sitemap.xml") return sitemap(env.DB);
  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return notFound("This page does not exist.");
  }
  const b = path.match(/^\/badge\/(.+)\.svg$/);
  if (b && req.method === "GET") return badgeSvg(env.DB, b[1]);
  const m = path.match(/^\/packages\/(.+?)(\/report)?$/);
  if (!m) return notFound("This page does not exist.");
  const name = m[1];
  if (m[2] && req.method === "POST") return report(env.DB, req, name, ctx);
  if (!m[2] && req.method === "GET") return detail(env.DB, name, md);
  return new Response("Method not allowed", { status: 405 });
}

export default {
  async fetch(req, env, ctx): Promise<Response> {
    if (!csp) await initCsp();
    let res: Response;
    try {
      res = await route(req, env, ctx);
    } catch (e) {
      // Most likely the D1 daily read limit; 503 + Retry-After tells crawlers to back off instead of dropping pages.
      console.error(e);
      res = html("Temporarily unavailable · omp packages", messagePage("Temporarily unavailable", "The catalog cannot read its database right now. Try again in an hour."), 503);
      res.headers.set("retry-after", "3600");
    }
    if (!res.headers.has("cache-control")) res.headers.set("cache-control", req.method === "GET" && res.status === 200 ? "public, max-age=0, s-maxage=600" : "no-store");
    res.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
    res.headers.set("x-content-type-options", "nosniff");
    res.headers.set("referrer-policy", "strict-origin-when-cross-origin");
    return res;
  },
  async scheduled(_event, env): Promise<void> {
    await sync(env.DB);
  },
} satisfies ExportedHandler<Env>;
