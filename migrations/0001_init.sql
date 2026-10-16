CREATE TABLE packages (
  name TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  keywords TEXT NOT NULL DEFAULT '[]',
  author TEXT NOT NULL DEFAULT '',
  repo_url TEXT,
  monthly_downloads INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  source TEXT NOT NULL CHECK (source IN ('omp', 'pi')),
  synced_at TEXT NOT NULL
);
CREATE INDEX packages_downloads ON packages (monthly_downloads DESC);

CREATE TABLE reports (
  name TEXT NOT NULL REFERENCES packages (name),
  ip_hash TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('works', 'broken')),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  PRIMARY KEY (name, ip_hash)
);

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
