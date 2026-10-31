# Repository Guidelines

## Project Overview

omppackages.com is a catalog of oh-my-pi (omp) plugins. It also tracks whether pi packages work on omp. A cron job syncs packages from npm into D1. Users and our own install tests send works/broken reports, and each package page shows the resulting status, an install command, the README, and a README badge. The guiding principle is status before popularity (`PRODUCT.md`).

## Architecture & Data Flow

One Cloudflare Worker (`src/index.ts`) with one D1 database. Pages are rendered on the server from template strings. There is no framework and no client-side JS beyond the copy-button `SCRIPT`.

- **Sync**: the cron (`*/30`) runs `sync()`. Each run reads up to 5 pages of 250 for one keyword and stores a resume cursor in `meta.cursor`, because npm returns 429 on bursts. A full crawl takes about 6 hours.
  - The upsert skips no-op updates. Downloads count as changed only when they move more than 25%. Changed rows are sent to IndexNow.
- **Status** is computed in SQL by `statusCase()`. Precedence: broken (broken > works) → native (omp keyword) → works → untested. The sync upsert and `report()` share it.
  - Catalog-wide counts are cached in `meta.counts` (`REFRESH_COUNTS`). They refresh after a full crawl and after each report, because live counts would scan every row.
- **Requests**: `route()` → D1 batch reads → view function → `html()` or `markdown()`. The `fetch()` wrapper then adds cache and security headers. If anything throws, the response is a 503 with `Retry-After: 3600`, so crawlers back off instead of dropping pages. The usual cause is the D1 daily read limit.
- **Edge cache** (Workers Cache, `cache.enabled`): a GET with status 200 gets `public, max-age=0, s-maxage=600` unless the handler set its own value. The badge and the sitemap use 1h.
  - Cache tags: `list` (home, search, browse, `/report`) and `pkg:<name>` (package page, badge).
  - `POST /packages/<name>/report` is the only purge point. It purges both tags. Each deploy also starts a fresh cache, because the cache key includes the Worker version.
- **Search** lives at `/search`, and `/?q=` returns 301 to it. Free Cloudflare rules can match only on path, so a zone JS challenge and a 3-per-10-seconds rate limit protect `/search`. Those rules live in Cloudflare, not in this repo.
  - The query uses the FTS5 trigram table `packages_fts` (3+ characters), capped at `SEARCH_CAP` (1,000).
  - The `CROSS JOIN` keeps FTS as the outer loop. Without it, a status filter scans every package with that status. Keep the CROSS JOIN.
- **Package page**: a D1 batch and `npmExtra()` run in parallel. `npmExtra()` fetches the live registry document, and its failure is soft (the page renders without a README). The README goes through `renderReadme()`.
- **Markdown negotiation**: if `Accept` contains `text/markdown`, the list and package pages return Markdown (`listMarkdown`, `detailMarkdown`).

## Key Directories

- `src/`: the Worker. `index.ts` (sync, router, handlers), `views.ts` (types, constants, HTML/Markdown/SVG renderers, CSS), `readme.ts` (README sanitizer).
- `migrations/`: numbered D1 migrations (`NNNN_name.sql`). Append only, and they can migrate data (see 0002).
- `public/`: static assets, served before the Worker runs: `robots.txt`, `llms.txt`, `_headers`, `og.png`, `favicon.svg`, and the IndexNow key file.
- `DESIGN.md`, `PRODUCT.md`, `.impeccable/design.json`: design and product docs. `src/views.ts` is the design source of truth.

## Development Commands

```sh
npm install
npx wrangler d1 migrations apply omp-packages --local   # local Miniflare D1
npm run dev            # wrangler dev --test-scheduled on :8787
curl localhost:8787/__scheduled   # run one sync (calls real npm and real IndexNow)
npm run check          # wrangler types && tsc --noEmit
npm run deploy         # applies D1 migrations --remote, then wrangler deploy
```

- Remote SQL (read-only checks): `npx wrangler d1 execute omp-packages --remote --json --command "..."`. `meta.rows_read` shows the cost.
- `npm run deploy` changes production. Run it only when asked.
- `wrangler dev --remote` and `--remote` SQL use the production database and count against the shared daily read limit.

## Code Conventions & Common Patterns

- **TypeScript**: `strict`. Type external JSON with local interfaces (`NpmObject`, `NpmDoc`, `Manifest`) plus `typeof` guards. Use `unknown` plus guards, never `any`. D1 rows use `.first<T>()` or `as Pkg[]`.
- **Errors**: fail fast. Use `try/catch` only where the failure is expected and handled: the top-level 503, `decodeURIComponent`, URL parsing in `readme.ts`, and the soft `npmExtra()`.
- **SQL**: numbered params (`?1`, which can repeat). Interpolate only constants (`SORTS[sort].sql`, `statusCase()`, `SEARCH_CAP`), never user input. Check user input against an allowlist first (`STATUSES.find`, `Object.hasOwn(SORTS, …)`). Clamp lengths and pages.
- **D1 read cost** is the constraint behind most design choices. Before adding a query, check `rows_read`.
  - Known hot spots: OFFSET pagination (which is why `robots.txt` blocks `/*sort=`), `/sitemap.xml` (every row), `REFRESH_COUNTS` on each report, `/report` (scans `reports`).
  - A new page that reads D1 must be edge-cacheable and carry a cache tag that the report purge covers.
- **HTML**: template strings only. Pass every untrusted value through `esc()`. `layout()` adds a canonical URL when `Head.path` is set, and otherwise marks the page `noindex,follow`. JSON-LD escapes `<`.
- **CSP**: `script-src` allows only the SHA-256 of `SCRIPT`, which is computed once per isolate. Add behaviour by editing `SCRIPT`, never with another inline script. Styles are inline in `CSS`.
- **README sanitizer** (`readme.ts`):
  - It is an allowlist. Dropped tags (script, iframe, svg, form, …) lose their content. Unknown tags are unwrapped. Unlisted attributes are stripped.
  - Links: http, https, mailto or `#` only, with `rel="nofollow ugc noopener"`. Images: http or https only.
  - README `h1`–`h5` move down one level, because the page owns the only `h1`.
- **Naming**: handlers are short and lowercase (`list`, `detail`, `report`, `browse`, `badgeSvg`). Constants are `UPPER_SNAKE`. The handler object uses `satisfies ExportedHandler<Env>`.
- **Comments**: one line, and only for a non-obvious reason or hazard. Mark a deliberate shortcut with its limit: `// ponytail: <ceiling>, <upgrade path>`.
- **User-facing wording**:
  - Long labels: Built for omp / Works on omp / Broken on omp / Untested on omp. The internal key for Built for omp is `native`.
  - Our install-test reports have `ip_hash = 'omppackages-load-test'` (`OUR_TESTS`). They show as "Tested by omp packages", never "load test".
  - The badge reads `<status> · tested` when our test passed and the package is not broken.
  - Never claim affiliation with oh-my-pi.
- **UI**: follow `DESIGN.md`: registry-style, system sans font, OKLCH tokens with `prefers-color-scheme` dark mode. Always show a status colour together with its label, and never make untested look broken. Respect reduced motion and focus outlines.

## Important Files

- `src/index.ts`: `sync()`, `route()`, `list()`, `detail()`, `report()`, `badgeSvg()`, `testReport()`, `sitemap()`, `browse()`, and the `fetch`/`scheduled` export.
- `src/views.ts`: `STATUS`, `SORTS`, `SITE`, `esc()`, `badge()` (Verdana width table, shields-style template), `layout()`, the page renderers, `CSS`, `SCRIPT`, `TESTED_POOL`.
- `wrangler.jsonc`: D1 binding `DB` (database `omp-packages`), cron, `cache.enabled`, custom domain `omppackages.com`, `assets` → `public/`.
- `migrations/0003_search_fts.sql`: the external-content FTS5 table, kept in sync by INSERT/DELETE/UPDATE triggers that join on `rowid`. Keep `packages` a rowid table.
- `worker-configuration.d.ts`: generated by `wrangler types` and gitignored. Do not edit it.

## Runtime/Tooling Preferences

- Node with npm (`package-lock.json`). Not Bun.
- Wrangler 4, TypeScript 5.9. The only runtime dependency is `marked`.
- `compatibility_date` is `2026-10-01`, with no `nodejs_compat`. Use Workers APIs (`HTMLRewriter`, `crypto.subtle`, D1 `batch`), not Node built-ins.
- Free tiers only. The account allows 5M D1 rows read and 100k Worker requests per day. An external watchdog (cf-guard) replaces the Worker with a stub when omp-packages passes 2M rows read in a day. Any deploy resumes the site.

## Testing & QA

- There are no tests, test runner or CI. `npm run check` is the only automated gate. Run it after every change, including after a `wrangler.jsonc` change, so the bindings are regenerated.
- Smoke test:
  1. Run `npm run dev`. The local D1 in `.wrangler/` already holds data.
  2. curl the routes you changed: `/`, `/search?q=mcp`, `/packages/<name>`, `/badge/<name>.svg`, `/browse/a`, `/report`, `/sitemap.xml`.
  3. Request one list page and one package page with `-H 'Accept: text/markdown'`.
- After a migration, apply it with `--local` before you smoke-test.
- After a deploy: curl production with `-A curl/8`. Cloudflare's Browser Integrity Check blocks bare user agents, and `/search` returns 403 with `cf-mitigated: challenge` to scripts by design.
- Copy that restates code goes stale and must be changed by hand: the status rules in `README.md`, `public/llms.txt`, `aboutPage()` and `PRODUCT.md`, and the "top 200" in `llms.txt` (which must match `TESTED_POOL`). Update these when you change behaviour. `.impeccable/design.json` duplicates `DESIGN.md`, so edit them together.
