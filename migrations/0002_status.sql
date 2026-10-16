ALTER TABLE packages ADD COLUMN works INTEGER NOT NULL DEFAULT 0;
ALTER TABLE packages ADD COLUMN broken INTEGER NOT NULL DEFAULT 0;
ALTER TABLE packages ADD COLUMN status TEXT NOT NULL DEFAULT 'untested' CHECK (status IN ('native', 'works', 'broken', 'untested'));

UPDATE packages SET
  works = (SELECT COUNT(*) FROM reports r WHERE r.name = packages.name AND r.status = 'works'),
  broken = (SELECT COUNT(*) FROM reports r WHERE r.name = packages.name AND r.status = 'broken');
UPDATE packages SET status = CASE WHEN broken > works THEN 'broken' WHEN source = 'omp' THEN 'native' WHEN works > 0 THEN 'works' ELSE 'untested' END;

CREATE INDEX packages_status_downloads ON packages (status, monthly_downloads DESC);
CREATE INDEX packages_published ON packages (published_at DESC);

INSERT INTO meta (key, value) SELECT 'counts', json_group_object(status, n) FROM (SELECT status, COUNT(*) AS n FROM packages GROUP BY status)
  WHERE true ON CONFLICT (key) DO UPDATE SET value = excluded.value;
