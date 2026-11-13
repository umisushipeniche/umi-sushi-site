-- UMI SUSHI Voucher V3 — Cloudflare D1
-- Apply once through Cloudflare D1 SQL Console before enabling the application.
CREATE TABLE IF NOT EXISTS vouchers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 code TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN ('value','meal')),
 meal TEXT CHECK(meal IN ('lunch','dinner') OR meal IS NULL),
 people INTEGER NOT NULL DEFAULT 1 CHECK(people BETWEEN 1 AND 20),
 amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 100 AND 100000),
 issued_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'unused' CHECK(status IN ('unused','used','cancelled')),
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 redeemed_at TEXT,
 cancelled_at TEXT
);
CREATE INDEX IF NOT EXISTS vouchers_status_idx ON vouchers(status,created_at);
CREATE TABLE IF NOT EXISTS voucher_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 voucher_code TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('created','redeemed','cancelled')),
 actor_email TEXT NOT NULL,
 occurred_at TEXT NOT NULL,
 FOREIGN KEY(voucher_code) REFERENCES vouchers(code)
);
CREATE INDEX IF NOT EXISTS voucher_events_code_idx ON voucher_events(voucher_code,id);
