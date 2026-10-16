# omp packages

A package catalog for [oh-my-pi](https://github.com/can1357/oh-my-pi) (omp). Live at https://omp-packages.paymahn.workers.dev.

Many pi packages do not work on omp. This site lists them and lets users report whether each one works.

## How it works

- One Cloudflare Worker (`src/index.ts`) renders HTML on the server.
- D1 stores packages and compatibility reports (`migrations/`).
- A cron trigger runs every 5 minutes. It reads a few pages of npm search for the keywords `omp-package`, `omp-plugin`, `omp-extension`, `oh-my-pi`, and `pi-package`, then saves its cursor. A full crawl takes about an hour.
- A package with one of the omp keywords is "omp-native". Other packages are "pi · untested" until users report.
- Only packages published to npm are listed. Git-only packages are not discovered.
- Users can send one report (works or broken) per package. The Worker stores a hash of the IP address and package name. A new report replaces the old one.

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
