export type Status = "native" | "works" | "broken" | "untested";

export interface Pkg {
  name: string;
  version: string;
  description: string;
  keywords: string;
  author: string;
  repo_url: string | null;
  monthly_downloads: number;
  published_at: string | null;
  works: number;
  broken: number;
  status: Status;
}

export interface Report {
  version: string;
  status: "works" | "broken";
  note: string;
  created_at: string;
}

export interface Extra {
  readme: string; // sanitized HTML
  license: string | null;
  homepage: string | null;
  issues: string | null;
  versions: number;
  created: string | null;
  maintainers: string[];
  deps: string[];
  peers: string[];
  engines: Record<string, string>;
  provides: [string, number][];
  size: number | null;
  files: number | null;
}

export interface ListView {
  q: string;
  status: Status | "all";
  sort: string;
  page: number;
  pageSize: number;
  rows: Pkg[];
  hasNext: boolean;
  counts: Record<Status, number>;
}

export const OMP_KEYWORDS = ["omp-package", "omp-plugin", "omp-extension", "oh-my-pi"];

const STATUS: Record<Status, { label: string; pill: string; icon: string }> = {
  native: { label: "Built for omp", pill: "built for omp", icon: "badge" },
  works: { label: "Works on omp", pill: "works", icon: "check" },
  broken: { label: "Broken on omp", pill: "broken", icon: "x" },
  untested: { label: "Untested on omp", pill: "untested", icon: "help" },
};

export const SORTS: Record<string, { label: string; sql: string }> = {
  downloads: { label: "Downloads", sql: "monthly_downloads DESC" },
  recent: { label: "Recently published", sql: "published_at DESC" },
  name: { label: "Name", sql: "name" },
};

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en");
const bytes = new Intl.NumberFormat("en", { notation: "compact", style: "unit", unit: "byte", unitDisplay: "narrow", maximumFractionDigits: 1 });

function ago(iso: string | null): string {
  if (!iso) return "unknown";
  const s = (Date.now() - Date.parse(iso)) / 1000;
  const units = [[31536000, "year"], [2592000, "month"], [86400, "day"], [3600, "hour"], [60, "minute"]] as const;
  for (const [n, unit] of units) {
    const v = Math.floor(s / n);
    if (v >= 1) return `${v} ${unit}${v > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

// Lucide icons (ISC), 24px grid, 2px stroke.
const ICONS: Record<string, string> = {
  package:
    '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  done: '<path d="M20 6 9 17l-5-5"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3"/>',
  download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  branch: '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  badge:
    '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  x: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  left: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  right: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  issue: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/>',
  scale:
    '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
};

const icon = (name: string, size = 16) =>
  `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const pill = (s: Status) => `<span class="pill s-${s}">${icon(STATUS[s].icon, 14)}${STATUS[s].pill}</span>`;

const copyButton = (text: string, label: string) =>
  `<button type="button" class="copy" data-copy="${esc(text)}" aria-label="Copy: ${esc(text)}">${icon("copy", 15)}${icon("done", 15)}<span>${label}</span></button>`;

const pkgHref = (name: string) => `/packages/${esc(name)}`;

export function listPage(v: ListView): string {
  const link = (over: Partial<Record<"status" | "sort" | "page", string | number>>) => {
    const p = new URLSearchParams();
    if (v.q) p.set("q", v.q);
    const status = String(over.status ?? v.status);
    const sort = String(over.sort ?? v.sort);
    const page = Number(over.page ?? v.page);
    if (status !== "all") p.set("status", status);
    if (sort !== "downloads") p.set("sort", sort);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return esc(qs ? `/?${qs}` : "/");
  };
  const total = Object.values(v.counts).reduce((a, b) => a + b, 0);
  const shown = v.status === "all" ? total : v.counts[v.status];
  const facet = (key: Status | "all", label: string, n: number, ico: string) =>
    `<li><a href="${link({ status: key, page: 1 })}"${v.status === key ? ' aria-current="page"' : ""} class="${key === "all" ? "" : `s-${key}`}">${icon(ico)}<span>${label}</span><span class="n num">${whole.format(n)}</span></a></li>`;
  const first = (v.page - 1) * v.pageSize + 1;
  const range = v.rows.length ? `${whole.format(first)}–${whole.format(first + v.rows.length - 1)} of ${whole.format(shown)}` : "No";

  const rows = v.rows
    .map(
      (p) => `<li class="row">
  <div class="row-main">
    <div class="row-head"><a class="row-name" href="${pkgHref(p.name)}">${esc(p.name)}</a><span class="ver">${esc(p.version)}</span>${pill(p.status)}</div>
    ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ""}
    <div class="meta">
      ${p.author ? `<span>${icon("user", 14)}${esc(p.author)}</span>` : ""}
      <span class="num">${icon("download", 14)}${compact.format(p.monthly_downloads)}/mo</span>
      <span>${icon("clock", 14)}${ago(p.published_at)}</span>
    </div>
  </div>
  ${copyButton(`omp plugin install ${p.name}`, "Install")}
</li>`,
    )
    .join("");

  const empty = `<div class="empty">
  <h2>No packages match${v.q ? ` “${esc(v.q)}”` : ""}</h2>
  <p>Try a shorter search, or <a href="${link({ status: "all", page: 1 })}">show every status</a>. Packages appear here after they are published to npm with an omp or pi keyword.</p>
</div>`;

  return `<div class="wrap catalog">
  <aside class="facets" aria-label="Filter by omp status">
    <h2>omp status</h2>
    <ul>
      ${facet("all", "All packages", total, "list")}
      ${(Object.keys(STATUS) as Status[]).map((s) => facet(s, STATUS[s].label, v.counts[s], STATUS[s].icon)).join("")}
    </ul>
    <p class="facet-note"><strong>Built for omp</strong> means the author tagged the package for omp. Other packages target pi; their status comes from user reports.</p>
  </aside>
  <section class="results" aria-label="Packages">
    <div class="toolbar">
      <p class="count num">${range} ${v.q ? `results for <strong>“${esc(v.q)}”</strong>` : "packages"}</p>
      <nav class="sort" aria-label="Sort">${Object.entries(SORTS)
        .map(([key, s]) => `<a href="${link({ sort: key, page: 1 })}"${key === v.sort ? ' aria-current="true"' : ""}>${s.label}</a>`)
        .join("")}</nav>
    </div>
    ${rows ? `<ul class="rows">${rows}</ul>` : empty}
    ${v.page > 1 || v.hasNext ? `<nav class="pager" aria-label="Pages">
      ${v.page > 1 ? `<a href="${link({ page: v.page - 1 })}">${icon("left", 14)}Previous</a>` : "<span></span>"}
      <span class="num">Page ${v.page}</span>
      ${v.hasNext ? `<a href="${link({ page: v.page + 1 })}">Next${icon("right", 14)}</a>` : "<span></span>"}
    </nav>` : ""}
  </section>
</div>`;
}

function verdict(p: Pkg): { title: string; body: string } {
  const total = p.works + p.broken;
  const tagged = JSON.parse(p.keywords).find((k: string) => OMP_KEYWORDS.includes(k));
  switch (p.status) {
    case "native":
      return {
        title: "Built for omp",
        body: `The author tagged this package <code>${esc(tagged ?? "omp")}</code>.${p.works ? ` ${p.works} ${p.works === 1 ? "person confirms" : "people confirm"} it works.` : ""}`,
      };
    case "broken":
      return {
        title: "Reported broken on omp",
        body: `${p.broken} of ${total} ${total === 1 ? "report says" : "reports say"} this package does not work on omp. Read the notes before you install it.`,
      };
    case "works":
      return { title: "Works on omp", body: `${p.works} of ${total} ${total === 1 ? "report says" : "reports say"} this package works on omp.` };
    default:
      return {
        title: "Untested on omp",
        body: "This is a pi package. No one has reported whether it works on omp yet. If you try it, add your result below.",
      };
  }
}

export function detailPage(p: Pkg, reports: Report[], x: Extra | null): string {
  const v = verdict(p);
  const total = p.works + p.broken;
  const keywords: string[] = JSON.parse(p.keywords);
  const tally = total
    ? `<div class="tally" role="img" aria-label="${p.works} works, ${p.broken} broken">
        <span class="t-works" style="flex:${p.works}"></span><span class="t-broken" style="flex:${p.broken}"></span>
      </div>
      <p class="tally-legend num"><span class="s-works">${icon("check", 14)}${p.works} works</span><span class="s-broken">${icon("x", 14)}${p.broken} broken</span></p>`
    : "";
  const reportList = reports.length
    ? `<ul class="reports">${reports
        .map(
          (r) => `<li>${pill(r.status)}<span class="r-meta num">v${esc(r.version || "?")} · ${ago(r.created_at)}</span>${r.note ? `<p>${esc(r.note)}</p>` : ""}</li>`,
        )
        .join("")}</ul>`
    : `<p class="quiet">No reports yet.</p>`;
  const npmHref = (n: string) => `https://www.npmjs.com/package/${esc(n)}`;
  const depList = (title: string, names: string[]) =>
    names.length
      ? `<section class="box"><h2>${title} <span class="quiet num">${names.length}</span></h2><ul class="deps">${names
          .map((n) => `<li><a href="${npmHref(n)}">${esc(n)}</a></li>`)
          .join("")}</ul></section>`
      : "";
  const row = (k: string, v: string | null | undefined, cls = "") => (v ? `<dt>${k}</dt><dd${cls ? ` class="${cls}"` : ""}>${v}</dd>` : "");

  return `<div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Packages</a><span aria-hidden="true">/</span><span>${esc(p.name)}</span></nav>
  <header class="pkg-head">
    <h1><span class="pkg-name">${esc(p.name)}</span><span class="ver">${esc(p.version)}</span></h1>
    ${p.description ? `<p class="lede">${esc(p.description)}</p>` : ""}
    <div class="meta">
      ${p.author ? `<span>${icon("user", 14)}${esc(p.author)}</span>` : ""}
      <span>${icon("clock", 14)}Published ${ago(p.published_at)}</span>
      ${x?.license ? `<span>${icon("scale", 14)}${esc(x.license)}</span>` : ""}
      <span class="num">${icon("download", 14)}${whole.format(p.monthly_downloads)} downloads/mo</span>
    </div>
  </header>
  <div class="pkg-grid">
    <section class="compat" aria-labelledby="verdict">
      <div class="summary">
        <div class="verdict s-${p.status}">
          ${icon(STATUS[p.status].icon, 28)}
          <div><h2 id="verdict">${v.title}</h2><p>${v.body}</p></div>
        </div>
        ${tally}
      </div>
      <form method="post" action="${pkgHref(p.name)}/report" class="report-form">
        <h3>Did it work for you?</h3>
        <fieldset class="choice">
          <legend class="sr">Result</legend>
          <label class="s-works"><input type="radio" name="status" value="works" required>${icon("check")}It works</label>
          <label class="s-broken"><input type="radio" name="status" value="broken">${icon("x")}It's broken</label>
        </fieldset>
        <div class="fields">
          <label>Package version<input name="version" value="${esc(p.version)}" maxlength="40" class="mono" autocomplete="off"></label>
          <label><span>Notes <span class="quiet">(optional)</span></span><textarea name="note" rows="3" maxlength="500" placeholder="Your omp version, and what failed or what you tested"></textarea></label>
        </div>
        <div class="form-foot"><button type="submit" class="primary">Submit report</button><p class="quiet">One report per person. A new report replaces your old one.</p></div>
      </form>
      <h3 class="reports-h">Reports <span class="quiet num">${reports.length}</span></h3>
      ${reportList}
      ${x?.readme ? `<section class="readme" aria-labelledby="readme-h"><h2 id="readme-h">Readme</h2><div class="md">${x.readme}</div></section>` : ""}
    </section>
    <aside class="side">
      <section class="box install">
        <h2>Install</h2>
        <div class="cmd"><code><span class="prompt" aria-hidden="true">$ </span>omp plugin install ${esc(p.name)}</code>${copyButton(`omp plugin install ${p.name}`, "Copy")}</div>
      </section>
      <section class="box">
        <h2>Links</h2>
        <ul class="links">
          <li><a href="${npmHref(p.name)}">${icon("package")}npm${icon("external", 13)}</a></li>
          ${p.repo_url ? `<li><a href="${esc(p.repo_url)}">${icon("branch")}Repository${icon("external", 13)}</a></li>` : ""}
          ${x?.homepage && !x.homepage.startsWith(p.repo_url ?? "\0") ? `<li><a href="${esc(x.homepage)}">${icon("globe")}Homepage${icon("external", 13)}</a></li>` : ""}
          ${x?.issues ? `<li><a href="${esc(x.issues)}">${icon("issue")}Issues${icon("external", 13)}</a></li>` : ""}
        </ul>
      </section>
      <section class="box">
        <h2>Details</h2>
        <dl>
          <dt>Version</dt><dd class="mono">${esc(p.version)}</dd>
          ${row("License", x?.license && esc(x.license))}
          <dt>Published</dt><dd>${p.published_at ? esc(p.published_at.slice(0, 10)) : "unknown"}</dd>
          ${row("First published", x?.created && esc(x.created.slice(0, 10)))}
          ${row("Versions", x && whole.format(x.versions), "num")}
          <dt>Downloads</dt><dd class="num">${whole.format(p.monthly_downloads)} / month</dd>
          ${row("Unpacked size", x?.size ? bytes.format(x.size) : null, "num")}
          ${row("Files", x?.files ? whole.format(x.files) : null, "num")}
          ${row("Provides", x?.provides.map(([k, n]) => `${esc(k)} <span class="quiet num">${n}</span>`).join(", "))}
          ${row("Engines", x && Object.entries(x.engines).map(([k, v]) => `${esc(k)} ${esc(String(v))}`).join(", "), "mono")}
          ${row("Maintainers", x?.maintainers.map((n) => esc(String(n))).join(", "))}
        </dl>
        ${keywords.length ? `<ul class="tags">${keywords
          .slice(0, 12)
          .map((k) => `<li><a href="/?q=${encodeURIComponent(k)}">${esc(k)}</a></li>`)
          .join("")}</ul>` : ""}
      </section>
      ${depList("Dependencies", x?.deps ?? [])}
      ${depList("Peer dependencies", x?.peers ?? [])}
    </aside>
  </div>
</div>`;
}

export function listingPage(): string {
  return `<div class="wrap prose">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Packages</a><span aria-hidden="true">/</span><span>Get listed</span></nav>
  <h1>Get your package listed</h1>
  <p class="lede">This catalog reads the npm registry. Publish to npm with the right keyword, and your package appears here.</p>
  <h2>1. Add an omp keyword</h2>
  <p>Add one of ${OMP_KEYWORDS.map((k) => `<code>${k}</code>`).join(", ")} to <code>keywords</code> in <code>package.json</code>. Packages with one of these keywords show as <strong>Built for omp</strong>.</p>
  <pre><code>{
  "name": "my-omp-plugin",
  "keywords": ["omp-plugin"]
}</code></pre>
  <h2>2. Declare what omp loads</h2>
  <p>omp reads the <code>omp</code> field in <code>package.json</code>. List your extension entry points there.</p>
  <pre><code>"omp": {
  "extensions": ["./extensions/my-plugin.ts"]
}</code></pre>
  <h2>3. Publish to npm</h2>
  <pre><code>npm publish --access public</code></pre>
  <h2>4. Wait for the sync</h2>
  <p>The catalog reads npm every 5 minutes, a few pages at a time. A full pass takes about an hour. Then users can install your package with <code>omp plugin install &lt;name&gt;</code>.</p>
  <h2>pi packages</h2>
  <p>Packages with only the <code>pi-package</code> keyword are listed as <strong>Untested on omp</strong> until users report a result. Packages that are only on GitHub are not listed.</p>
</div>`;
}

export function messagePage(title: string, body: string): string {
  return `<div class="wrap prose message"><h1>${esc(title)}</h1><p>${body}</p><p><a href="/">Back to all packages</a></p></div>`;
}

/* Direction contract
THESIS: A package registry where omp compatibility is the headline, not a footnote. Refuses the pi.dev catalog grid and download-first ranking cards.
OWN-WORLD: Registry canon (crates.io, jsr, hex, pkg.go.dev): ink-violet header band with a central search, cool neutral page, one violet accent. Status pills in four fixed colours: violet built-for-omp, green works, red broken, grey untested. System sans, mono only for commands and versions. Lucide icons.
FIRST VIEWPORT: Search in the band; left facet rail with status counts; dense list rows of name, version, status pill, description, meta, one-click Install copy.
SIGNATURE: Package page opens on a verdict panel with a works/broken tally and an inline report form; install box with copy in the sidebar.
RISK: Canon layout is familiar by design; distinctiveness rests on the status system.
*/

const CSS = `*,*::before,*::after{box-sizing:border-box}
:root{color-scheme:light;
--bg:oklch(0.99 0.003 285);--surface:oklch(0.965 0.006 285);--fg:oklch(0.23 0.02 285);--fg-2:oklch(0.36 0.02 285);--muted:oklch(0.49 0.02 285);--border:oklch(0.9 0.01 285);
--accent:oklch(0.5 0.2 292);--accent-fg:oklch(0.99 0 0);--link:oklch(0.47 0.19 292);
--band:oklch(0.25 0.07 292);--band-fg:oklch(0.97 0.01 292);--band-muted:oklch(0.82 0.04 292);--band-accent:oklch(0.8 0.13 292);
--native:oklch(0.5 0.2 292);--native-bg:oklch(0.95 0.035 292);--works:oklch(0.5 0.13 150);--works-bg:oklch(0.95 0.04 150);
--broken:oklch(0.52 0.19 27);--broken-bg:oklch(0.95 0.03 27);--untested:oklch(0.47 0.02 285);--untested-bg:oklch(0.94 0.006 285);
--field-border:oklch(0.68 0.02 285);
--shadow:0 1px 2px oklch(0.2 0.02 285/0.06),0 4px 12px oklch(0.2 0.02 285/0.05)}
@media(prefers-color-scheme:dark){:root{color-scheme:dark;
--bg:oklch(0.17 0.012 285);--surface:oklch(0.21 0.014 285);--fg:oklch(0.94 0.01 285);--fg-2:oklch(0.84 0.012 285);--muted:oklch(0.72 0.015 285);--border:oklch(0.3 0.015 285);
--accent:oklch(0.74 0.14 292);--accent-fg:oklch(0.17 0.03 292);--link:oklch(0.78 0.12 292);
--band:oklch(0.13 0.03 292);--band-fg:oklch(0.96 0.01 292);--band-muted:oklch(0.78 0.03 292);--band-accent:oklch(0.78 0.13 292);
--native:oklch(0.78 0.13 292);--native-bg:oklch(0.3 0.07 292);--works:oklch(0.8 0.14 150);--works-bg:oklch(0.29 0.05 150);
--broken:oklch(0.76 0.15 27);--broken-bg:oklch(0.3 0.06 27);--untested:oklch(0.78 0.015 285);--untested-bg:oklch(0.27 0.012 285);
--field-border:oklch(0.48 0.015 285);
--shadow:0 1px 2px oklch(0 0 0/0.3),0 4px 12px oklch(0 0 0/0.25)}
.band .search{background:var(--surface)}}
html{background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%;accent-color:var(--accent);caret-color:var(--accent);scrollbar-color:var(--border) transparent}
body{margin:0;min-height:100vh;display:flex;flex-direction:column}
::selection{background:var(--accent);color:var(--accent-fg)}
a{color:var(--link);text-decoration-thickness:1px;text-underline-offset:.2em}
a:hover{text-decoration-thickness:2px}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
.band :focus-visible{outline-color:var(--band-accent)}
h1,h2,h3{line-height:1.2;text-wrap:balance;margin:0}
code,pre,.mono,.ver{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
code{font-size:.9em}
.num{font-variant-numeric:tabular-nums}
.i{flex:none;vertical-align:-.15em}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.quiet{color:var(--muted);font-weight:400}
.wrap{width:100%;max-width:1160px;margin:0 auto;padding:0 1.5rem}
.band{background:var(--band);color:var(--band-fg)}
.band .wrap{display:flex;align-items:center;gap:2rem;min-height:68px}
.brand{display:flex;align-items:center;gap:.55rem;color:inherit;text-decoration:none;font-weight:700;font-size:1.1rem;letter-spacing:-.01em;white-space:nowrap}
.brand .i{color:var(--band-accent)}
.search{flex:1;max-width:600px;display:flex;align-items:center;gap:.5rem;background:var(--bg);color:var(--fg);border-radius:8px;padding-left:.8rem;border:1px solid oklch(from var(--band-fg) l c h/0.22);transition:box-shadow .2s cubic-bezier(.16,1,.3,1)}
.search:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px oklch(from var(--accent) l c h/0.35)}
.search .i{color:var(--muted)}
.search input{flex:1;min-width:0;border:0;background:none;color:inherit;font:inherit;padding:.65rem 0;outline:none}
.search input::placeholder{color:var(--muted)}
.search button{border:0;background:var(--accent);color:var(--accent-fg);font:inherit;font-weight:600;padding:.5rem 1rem;margin:.25rem;border-radius:6px;cursor:pointer}
.band nav{display:flex;gap:1.5rem;margin-left:auto;white-space:nowrap}
.band nav a{color:var(--band-muted);text-decoration:none;font-weight:500;display:flex;align-items:center;gap:.3rem}
.band nav a:hover,.band nav a[aria-current]{color:var(--band-fg)}
main{flex:1;padding:2.25rem 0 4rem}
.site-foot{border-top:1px solid var(--border);color:var(--muted);font-size:.85rem;padding:1.5rem 0}
.site-foot a{color:inherit}
.pill{display:inline-flex;align-items:center;gap:.3rem;font-size:.75rem;font-weight:600;line-height:1;padding:.3rem .55rem .3rem .4rem;border-radius:999px;background:var(--st-bg);color:var(--st);white-space:nowrap}
.s-native{--st:var(--native);--st-bg:var(--native-bg)}.s-works{--st:var(--works);--st-bg:var(--works-bg)}
.s-broken{--st:var(--broken);--st-bg:var(--broken-bg)}.s-untested{--st:var(--untested);--st-bg:var(--untested-bg)}
.catalog{display:grid;grid-template-columns:232px minmax(0,1fr);gap:3rem;align-items:start}
.facets{position:sticky;top:1.5rem}
.facets h2{font-size:.95rem;font-weight:600;margin-bottom:.6rem}
.facets ul{list-style:none;margin:0;padding:0;display:grid;gap:2px}
.facets a{display:flex;align-items:center;gap:.6rem;padding:.5rem .65rem;border-radius:6px;color:var(--fg);text-decoration:none}
.facets a .i{color:var(--st,var(--muted))}
.facets a:hover{background:var(--surface)}
.facets a[aria-current]{background:var(--surface);font-weight:600;box-shadow:inset 0 0 0 1px var(--border)}
.facets .n{margin-left:auto;color:var(--muted);font-size:.85rem;font-weight:400}
.facet-note{font-size:.85rem;color:var(--muted);margin:1.25rem 0 0;padding:0 .65rem}
.facet-note strong{color:var(--fg-2)}
.toolbar{display:flex;justify-content:space-between;align-items:center;gap:.5rem 1.5rem;flex-wrap:wrap;padding-bottom:.9rem;border-bottom:1px solid var(--border)}
.count{margin:0;color:var(--muted)}
.count strong{color:var(--fg)}
.sort{display:flex;gap:.25rem;background:var(--surface);padding:3px;border-radius:8px}
.sort a{padding:.3rem .7rem;border-radius:6px;color:var(--muted);text-decoration:none;font-size:.875rem;font-weight:500}
.sort a:hover{color:var(--fg)}
.sort a[aria-current]{background:var(--bg);color:var(--fg);box-shadow:var(--shadow)}
.rows{list-style:none;margin:0;padding:0}
.row{display:flex;align-items:flex-start;gap:1.5rem;padding:1.15rem 0;border-bottom:1px solid var(--border)}
.row-main{flex:1;min-width:0}
.row-head{display:flex;align-items:center;flex-wrap:wrap;gap:.35rem .6rem}
.row-name{font-weight:650;font-size:1.05rem;color:var(--fg);text-decoration:none;overflow-wrap:anywhere}
.row-name:hover{color:var(--link);text-decoration:underline}
.ver{font-size:.82rem;color:var(--muted)}
.desc{margin:.35rem 0 .5rem;color:var(--fg-2);max-width:75ch;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.meta{display:flex;flex-wrap:wrap;gap:.35rem 1.1rem;color:var(--muted);font-size:.85rem}
.meta span{display:inline-flex;align-items:center;gap:.35rem}
.copy{display:inline-flex;align-items:center;gap:.4rem;flex:none;font:inherit;font-size:.85rem;font-weight:500;color:var(--fg-2);background:var(--bg);border:1px solid var(--field-border);border-radius:6px;padding:.4rem .7rem;cursor:pointer;transition:background .15s,border-color .15s,color .15s}
.copy:hover{background:var(--surface);color:var(--fg)}
.copy .i:nth-child(2){display:none}
.copy[data-state=failed]{color:var(--broken);border-color:var(--broken)}
.copy[data-state=copied]{color:var(--works);border-color:var(--works);background:var(--works-bg)}
.copy[data-state=copied] .i:first-child{display:none}.copy[data-state=copied] .i:nth-child(2){display:inline}
.pager{display:flex;justify-content:space-between;align-items:center;padding-top:1.5rem;color:var(--muted)}
.pager a{font-weight:500;display:inline-flex;align-items:center;gap:.35rem}
.empty{padding:3rem 0;max-width:60ch}
.empty h2{font-size:1.2rem;margin-bottom:.5rem}
.empty p{color:var(--fg-2)}
.crumbs{display:flex;gap:.5rem;font-size:.875rem;color:var(--muted);margin-bottom:1rem;overflow-wrap:anywhere}
.crumbs a{color:var(--muted)}
.pkg-head{padding-bottom:1.75rem;border-bottom:1px solid var(--border);margin-bottom:2rem}
.pkg-head h1{display:flex;align-items:baseline;flex-wrap:wrap;gap:.25rem .75rem;font-size:clamp(1.6rem,4vw,2.2rem);letter-spacing:-.02em}
.pkg-name{overflow-wrap:anywhere}
.pkg-head .ver{font-size:1rem;font-weight:500;letter-spacing:0}
.lede{font-size:1.1rem;color:var(--fg-2);margin:.6rem 0 .9rem;max-width:70ch}
.pkg-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:3rem;align-items:start}
.verdict{display:flex;gap:1rem;align-items:flex-start;background:var(--st-bg);border-radius:12px;padding:1.25rem 1.4rem}
.verdict>.i{color:var(--st);margin-top:.1rem}
.verdict h2{font-size:1.35rem;color:var(--st)}
.verdict p{margin:.35rem 0 0;color:var(--fg)}
.tally{display:flex;gap:3px;height:8px;margin-top:1.25rem;border-radius:999px;overflow:hidden}
.t-works{background:var(--works)}.t-broken{background:var(--broken)}
.tally-legend{display:flex;gap:1.25rem;font-size:.875rem;margin:.5rem 0 0;font-weight:600}
.tally-legend span{display:inline-flex;align-items:center;gap:.3rem;color:var(--st)}
.report-form{margin-top:2.5rem;padding-top:2rem;border-top:1px solid var(--border)}
.report-form h3,.reports-h{font-size:1.1rem;margin-bottom:1rem}
.choice{display:flex;gap:.75rem;border:0;padding:0;margin:0 0 1rem}
.choice label{display:flex;align-items:center;gap:.5rem;flex:1;max-width:220px;padding:.7rem 1rem;border:1px solid var(--field-border);border-radius:8px;cursor:pointer;font-weight:600;transition:background .15s,border-color .15s}
.choice label .i{color:var(--st)}
.choice input{margin:0}
.choice label:hover{background:var(--surface)}
.choice label:has(input:checked){border-color:var(--st);background:var(--st-bg);color:var(--st)}
.choice label:has(input:focus-visible){outline:2px solid var(--accent);outline-offset:2px}
.fields{display:grid;gap:1rem;max-width:560px}
.fields label{display:grid;gap:.35rem;font-size:.875rem;font-weight:600}
.fields input,.fields textarea{font:inherit;font-size:.95rem;font-weight:400;color:var(--fg);background:var(--bg);border:1px solid var(--field-border);border-radius:8px;padding:.55rem .7rem}
.fields input.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.875rem;max-width:220px}
.fields textarea{resize:vertical;min-height:5rem}
.fields input:focus,.fields textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px oklch(from var(--accent) l c h/0.25)}
.fields textarea::placeholder{color:var(--muted)}
.form-foot{display:flex;align-items:center;flex-wrap:wrap;gap:.5rem 1rem;margin-top:1.25rem}
.form-foot p{margin:0;font-size:.85rem}
.primary{font:inherit;font-weight:600;background:var(--accent);color:var(--accent-fg);border:0;border-radius:8px;padding:.65rem 1.2rem;cursor:pointer;transition:filter .15s}
.primary:hover{filter:brightness(1.1)}
.reports-h{margin-top:2.5rem;display:flex;gap:.5rem;align-items:baseline}
.reports{list-style:none;margin:0;padding:0}
.reports li{padding:.9rem 0;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .75rem}
.reports p{flex-basis:100%;margin:0;color:var(--fg-2);max-width:70ch;overflow-wrap:anywhere;white-space:pre-line}
.r-meta{font-size:.85rem;color:var(--muted)}
.side{display:grid;grid-template-columns:minmax(0,1fr);gap:1rem;min-width:0}
.box{border:1px solid var(--border);border-radius:12px;padding:1.1rem 1.2rem;background:var(--bg)}
.box h2{font-size:.95rem;margin-bottom:.75rem}
.cmd{display:flex;align-items:flex-start;gap:.5rem;background:var(--surface);border-radius:8px;padding:.35rem .35rem .35rem .75rem}
.cmd code{flex:1;min-width:0;font-size:.82rem;line-height:1.5;padding:.3rem 0;overflow-wrap:anywhere}
.cmd .prompt{color:var(--muted);user-select:none}
.cmd .copy{padding:.35rem .55rem}
.links{list-style:none;margin:0;padding:0;display:grid;gap:.5rem}
.links a{display:inline-flex;align-items:center;gap:.5rem;font-weight:500}
.links a .i:last-child{color:var(--muted)}
dl{display:grid;grid-template-columns:auto 1fr;gap:.45rem 1rem;margin:0;font-size:.9rem}
dt{color:var(--muted)}dd{margin:0;text-align:right}
.tags{list-style:none;margin:1rem 0 0;padding:1rem 0 0;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:.4rem}
.tags a{display:block;font-size:.8rem;padding:.2rem .55rem;border-radius:999px;background:var(--surface);color:var(--fg-2);text-decoration:none}
.tags a:hover{color:var(--link)}
.deps{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.35rem .4rem;font:.78rem/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.deps a{display:block;padding:.15rem .45rem;border-radius:6px;background:var(--surface);color:var(--fg-2);text-decoration:none;overflow-wrap:anywhere}
.deps a:hover{color:var(--link)}
.readme{margin-top:3rem;padding-top:2rem;border-top:1px solid var(--border);min-width:0}
.readme>h2{font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:1.25rem}
.md{overflow-wrap:break-word;color:var(--fg-2)}
.md>:first-child{margin-top:0}
.md h1,.md h2,.md h3,.md h4{color:var(--fg);margin:1.75em 0 .6em}
.md h1{font-size:1.6rem}.md h2{font-size:1.3rem;padding-bottom:.3em;border-bottom:1px solid var(--border)}.md h3{font-size:1.1rem}.md h4{font-size:1rem}
.md p,.md ul,.md ol,.md blockquote,.md table,.md pre,.md details{margin:0 0 1em}
.md img{max-width:100%;height:auto;vertical-align:middle}
.md pre{background:var(--surface);border-radius:8px;padding:.9rem 1rem;overflow-x:auto;font-size:.85rem;line-height:1.5}
.md :not(pre)>code{background:var(--surface);padding:.1em .35em;border-radius:4px}
.md blockquote{border-left:3px solid var(--border);padding:0 1em;color:var(--muted)}
.md table{display:block;max-width:100%;overflow-x:auto;border-collapse:collapse;font-size:.9rem}
.md th,.md td{border:1px solid var(--border);padding:.4rem .7rem}
.md th{background:var(--surface)}
.md hr{border:0;border-top:1px solid var(--border);margin:1.5em 0}
.md [align=center]{text-align:center}
.prose{max-width:760px}
.prose h1{font-size:2rem;letter-spacing:-.02em}
.prose h2{font-size:1.2rem;margin:2.25rem 0 .6rem}
.prose p{max-width:68ch}
.prose pre{background:var(--surface);border-radius:8px;padding:.9rem 1rem;overflow-x:auto;font-size:.875rem;line-height:1.5}
.prose p code,.facet-note code,.verdict code{background:var(--surface);padding:.1em .35em;border-radius:4px}
.verdict code{background:oklch(from var(--st) l c h/0.12)}
.message{padding:2rem 0}
@media(max-width:900px){
.catalog{grid-template-columns:minmax(0,1fr);gap:1.5rem}
.facets{position:static}
.facets ul{display:flex;flex-wrap:wrap;gap:.4rem}
.facets a{white-space:nowrap;border:1px solid var(--border);border-radius:999px;padding:.4rem .75rem}
.facet-note{font-size:.8rem;margin-top:.75rem;padding:0}
.facets h2{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.pkg-grid{grid-template-columns:minmax(0,1fr);gap:2rem}
.side,.compat{display:contents}.summary{order:-2}.install{order:-1}.side>.box:not(.install){order:1}.readme{order:2}}
@media(max-width:640px){
.band .wrap{flex-wrap:wrap;gap:.75rem 1rem;padding-top:.75rem;padding-bottom:.75rem}
.search{order:3;flex-basis:100%;max-width:none}
.band nav{gap:1rem}
.wrap{padding:0 1rem}
main{padding-top:1.5rem}
.row{gap:.75rem}
.row .copy{padding:.45rem}
.row .copy span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.choice label{max-width:none}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}`;

export const SCRIPT = `document.addEventListener("click",e=>{const b=e.target.closest("[data-copy]");if(!b)return;const l=b.querySelector("span"),t=l.textContent,live=document.getElementById("live"),done=(s,m)=>{b.dataset.state=s;l.textContent=m;live.textContent=m;setTimeout(()=>{delete b.dataset.state;l.textContent=t},1600)};navigator.clipboard.writeText(b.dataset.copy).then(()=>done("copied","Copied"),()=>done("failed","Copy failed"))})`;

export function layout(title: string, body: string, opts: { q?: string; nav?: "listing" } = {}): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="Find oh-my-pi (omp) plugins and see whether pi packages work on omp."><style>${CSS}</style></head>
<body><p id="live" class="sr" aria-live="polite"></p>
<header class="band"><div class="wrap">
  <a class="brand" href="/">${icon("package", 22)}omp packages</a>
  <form class="search" action="/" role="search">${icon("search", 18)}<input type="search" name="q" value="${esc(opts.q ?? "")}" placeholder="Search packages" aria-label="Search packages"><button>Search</button></form>
  <nav aria-label="Site"><a href="/get-listed"${opts.nav === "listing" ? ' aria-current="page"' : ""}>Get listed</a><a href="https://github.com/can1357/oh-my-pi">oh-my-pi${icon("external", 13)}</a></nav>
</div></header>
<main>${body}</main>
<footer class="site-foot"><div class="wrap">Package data from the npm registry, synced every 5 minutes. Not affiliated with oh-my-pi. <a href="https://github.com/paymog/omp-packages">Source on GitHub</a>.</div></footer>
<script>${SCRIPT}</script>
</body></html>`;
}
