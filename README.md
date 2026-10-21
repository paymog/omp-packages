# omp packages

A package catalog for [oh-my-pi](https://github.com/can1357/oh-my-pi) (omp). Live at https://omppackages.com.

Many pi packages do not work on omp. This site lists them and lets users report whether each one works.

## How it works

- One Cloudflare Worker renders HTML on the server. `src/index.ts` has the routes, the sync, and the SQL. `src/views.ts` has the markup and CSS.
- D1 stores packages, reports, and a `meta` table (sync cursor and status counts). See `migrations/`.
- A cron trigger runs every 30 minutes. It reads a few pages of npm search for the keywords `omp-package`, `omp-plugin`, `omp-extension`, `oh-my-pi`, and `pi-package`, then saves its cursor. A full crawl takes about 6 hours. The sync writes a row only when the npm data changed. Download counts update only when they change by more than 25%.
- Each package has a stored status. Precedence: more broken than works reports → "broken"; an omp keyword → "built for omp"; any works reports → "works"; else "untested". The sync and each new report keep the status current.
- Status counts for the filter rail are stored in `meta`. They refresh after each full crawl and after each report.
- A package page also fetches the npm registry document on each view. It shows the README, license, dependencies, and other details from it. `src/readme.ts` converts the README to HTML and keeps only allowlisted tags and attributes. A Content-Security-Policy header allows only the site's own script.
- Only packages published to npm are listed. Git-only packages are not discovered.
- Users can send one report (works or broken) per package. The Worker stores a hash of the IP address and package name. A new report replaces the old one.
- `/badge/<name>.svg` renders the package's stored status as a README badge. Each package page shows the Markdown to copy. Unknown names get a "not listed" badge, not a 404, so a README never shows a broken image.
- SEO: each page sets its own title, description, canonical URL, Open Graph tags, and JSON-LD. Search results (`/search?q=`) are `noindex` and blocked in `robots.txt`; keyword links to them are `nofollow`. `/sitemap.xml` lists every package from D1. `public/` holds `robots.txt`, `llms.txt`, `_headers`, the favicon, `og.png`, and the IndexNow key file; Workers static assets serve them before the Worker runs.
- Workers Caching (`"cache"` in `wrangler.jsonc`) serves GET pages from the edge for 10 minutes (`s-maxage=600`) without running the Worker or reading D1. Responses carry `Cache-Tag` (`list`, `pkg:<name>`), and a new report purges its package and every list. Free-tier D1 allows 5 million row reads a day for the whole account, so crawlers can exhaust it without the cache.
- Search uses an FTS5 trigram index (`packages_fts`) and reads only matching rows. It lives at `/search` because the free Cloudflare rate-limit rule matches only on path; a zone rule allows 10 searches per 10 seconds per IP. `/?q=` redirects there.
- If a request throws (usually the D1 daily limit), the Worker returns 503 with `Retry-After: 3600` so crawlers retry instead of dropping pages.
- Agents: send `Accept: text/markdown` to the list or a package page to get Markdown. `/llms.txt` describes the site. `/about` and `/privacy` explain the data and what is stored.
- After each sync run, the Worker sends the URLs of changed packages to IndexNow (Bing, Yandex, and others). Google reads the sitemap through Search Console. The domain is verified in Google Search Console and Bing Webmaster Tools by DNS records on the Cloudflare zone; do not delete the `google-site-verification` TXT record or the Bing CNAME.
- Design notes: `PRODUCT.md` and `DESIGN.md`.

## Develop

```sh
npm install
npx wrangler d1 migrations apply omp-packages --local
npm run dev                         # http://localhost:8787
curl localhost:8787/__scheduled     # run one sync
npm run check                       # types
```

## Deploy

```sh
npm run deploy
```
