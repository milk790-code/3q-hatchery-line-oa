-- 3Q Hatchery CRM — D1 database `3q-hatchery-crm`
-- Database UUID: e54671b1-d15e-4552-babf-cef367267568

CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  service TEXT,
  budget TEXT,
  timeline TEXT,
  free_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inquiries_user_id ON inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at);
