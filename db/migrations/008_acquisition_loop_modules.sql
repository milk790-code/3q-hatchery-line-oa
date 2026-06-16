-- 008: Acquisition loop modules M1-M7
-- Adds new tables for redeem review and weekly report archives.
-- lead_score/status/booking columns already exist on the live D1 and are defined
-- in 002 for clean rebuilds, so they are intentionally not ALTERed here.

CREATE TABLE IF NOT EXISTS pending_redeem (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  message_id TEXT,
  source_oa TEXT NOT NULL DEFAULT '3q-hatchery',
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_redeem_status ON pending_redeem(status);
CREATE INDEX IF NOT EXISTS idx_pending_redeem_user_id ON pending_redeem(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_redeem_created_at ON pending_redeem(created_at);

CREATE TABLE IF NOT EXISTS weekly_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_key TEXT NOT NULL UNIQUE,
  report_md TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_created_at ON weekly_reports(created_at);
