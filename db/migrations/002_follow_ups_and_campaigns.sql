-- 002: Add follow-up tracking + campaign registrations table

-- Add follow-up status columns to inquiries
ALTER TABLE inquiries ADD COLUMN followed_up_24h INTEGER DEFAULT 0;
ALTER TABLE inquiries ADD COLUMN followed_up_72h INTEGER DEFAULT 0;
ALTER TABLE inquiries ADD COLUMN followed_up_168h INTEGER DEFAULT 0;

-- Campaign registrations table (separate from KV slots for permanent record)
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  price INTEGER NOT NULL,
  sample_pick TEXT,
  fulfilled INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at);
