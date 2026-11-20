// Shared with tester/run.ts, so keep this file free of Worker imports.

// Status precedence: broken reports beat everything; then the author's omp tag; then works reports.
export const statusCase = (source: string) =>
  `CASE WHEN broken > works THEN 'broken' WHEN ${source} = 'omp' THEN 'native' WHEN works > 0 THEN 'works' ELSE 'untested' END`;
// ponytail: catalog-wide counts refresh once per full crawl and on each report; live counts would scan every row per page view.
export const REFRESH_COUNTS = `INSERT INTO meta (key, value) SELECT 'counts', json_group_object(status, n) FROM (SELECT status, COUNT(*) AS n FROM packages GROUP BY status)
  WHERE true ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
// Reporter id on reports written by our own install tests; real ip_hash values are hex digests, so it cannot collide.
export const OUR_TESTS = "omppackages-load-test";
