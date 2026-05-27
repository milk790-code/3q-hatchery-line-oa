-- 004: Social publisher content queue
-- Stores scheduled posts for Threads, Instagram, TikTok, Google Business Profile

CREATE TABLE IF NOT EXISTS content_queue (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  platform     TEXT NOT NULL,           -- threads | instagram | tiktok | google_biz
  image_url    TEXT,                    -- public URL (GitHub Pages CDN) or null for text-only
  caption_seed TEXT,                    -- topic keywords → AI expands into full caption
  caption      TEXT,                    -- AI-generated final caption (filled before publish)
  topic_tag    TEXT,                    -- Threads Topic Tag (1 per post, max 1)
  scheduled_at TEXT,                    -- ISO 8601 UTC; null = publish at next cron run
  published_at TEXT,                    -- filled after successful publish
  status       TEXT NOT NULL DEFAULT 'pending', -- pending | published | failed | skipped
  error_msg    TEXT,
  source_oa    TEXT NOT NULL DEFAULT '3q-hatchery',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_content_queue_platform_status ON content_queue(platform, status);
CREATE INDEX IF NOT EXISTS idx_content_queue_scheduled       ON content_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_content_queue_created         ON content_queue(created_at);
