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
