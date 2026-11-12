-- Contact form submissions. ip_hash is SHA-256(ip + secret pepper); raw IPs are never stored.
CREATE TABLE IF NOT EXISTS submissions (
	id TEXT PRIMARY KEY,
	created_at TEXT NOT NULL, -- ISO 8601 UTC, e.g. 2026-11-11T23:44:52.598Z (sorts lexically)
	name TEXT NOT NULL,
	phone TEXT NOT NULL,
	email TEXT,
	country TEXT,
	ip_hash TEXT NOT NULL,
	notified INTEGER NOT NULL DEFAULT 0
);

-- Serves the rolling-hour rate limit: count rows for one ip_hash newer than a timestamp.
CREATE INDEX IF NOT EXISTS idx_submissions_ip_created ON submissions (ip_hash, created_at);
