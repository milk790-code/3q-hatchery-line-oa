-- 3Q Hatchery CRM — migration 006: referral engine (v3.7)
-- Shared across OAs (code prefix H = hatchery, G = gongwan). One engine, no split.

CREATE TABLE IF NOT EXISTS referrals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL,                       -- inviter referral code, e.g. H0042
  inviter_uid  TEXT NOT NULL,
  invitee_uid  TEXT NOT NULL,
  source_oa    TEXT DEFAULT '3q-hatchery',
  status       TEXT NOT NULL DEFAULT 'pending',     -- pending|qualified|rewarded|review|void
  inquiry_id   INTEGER,                             -- qualifying inquiries/campaigns row
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  qualified_at TEXT
);
-- one attribution per invitee for their whole lifetime
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_invitee ON referrals(invitee_uid);
CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON referrals(inviter_uid);
CREATE INDEX IF NOT EXISTS idx_referrals_code    ON referrals(code);

CREATE TABLE IF NOT EXISTS rewards (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  uid           TEXT NOT NULL,
  role          TEXT NOT NULL,                      -- inviter|invitee
  ref_id        INTEGER,                            -- referrals.id
  value_type    TEXT NOT NULL,                      -- discount_pct|discount_amt|credit|perk
  value         REAL,
  label_public  TEXT,                               -- host-voice label shown to the member
  discount_code TEXT,                               -- real redeemable code (back-office)
  status        TEXT NOT NULL DEFAULT 'granted',    -- granted|redeemed|expired
  expires_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rewards_uid ON rewards(uid);
