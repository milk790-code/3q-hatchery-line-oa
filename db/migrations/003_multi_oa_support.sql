-- 003: Multi-OA support + social tracking
-- source_oa identifies which LINE OA wrote the record

ALTER TABLE inquiries ADD COLUMN source_oa TEXT DEFAULT '3q-hatchery';
ALTER TABLE campaigns ADD COLUMN source_oa TEXT DEFAULT '3q-hatchery';

CREATE INDEX IF NOT EXISTS idx_inquiries_source_oa ON inquiries(source_oa);
CREATE INDEX IF NOT EXISTS idx_campaigns_source_oa  ON campaigns(source_oa);

-- Social platform UTM click / event tracking
CREATE TABLE IF NOT EXISTS social_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  utm_source   TEXT,                    -- instagram | threads | tiktok | line
  utm_medium   TEXT,                    -- post | story | bio | reel
  utm_campaign TEXT,                    -- campaign slug e.g. 好物好照-2026-06
  utm_content  TEXT,                    -- optional creative ID
  event_type   TEXT DEFAULT 'click',    -- click | inquiry | conversion
  user_id      TEXT,                    -- LINE userId if known
  ip_hash      TEXT,                    -- first 16 chars of SHA-256 of IP
  referrer     TEXT,                    -- raw Referer header
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_social_events_campaign ON social_events(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_social_events_source   ON social_events(utm_source);
CREATE INDEX IF NOT EXISTS idx_social_events_created  ON social_events(created_at);
