-- 007_referral_system.sql
-- v3.7: user-to-user referral tracking

CREATE TABLE IF NOT EXISTS referrals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_uid    TEXT    NOT NULL,
  invitee_uid     TEXT    NOT NULL,
  code            TEXT    NOT NULL,
  reward_granted  INTEGER NOT NULL DEFAULT 0,
  converted       INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_invitee  ON referrals(invitee_uid);
CREATE INDEX        IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_uid);
CREATE INDEX        IF NOT EXISTS idx_referrals_code     ON referrals(code);
