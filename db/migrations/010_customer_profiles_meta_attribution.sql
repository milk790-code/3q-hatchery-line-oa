-- Apply once, before the worker branch is merged/deployed.
-- Runtime ensureTables() repeats these operations fail-safe for older databases.
ALTER TABLE customer_profiles ADD COLUMN meta_cid TEXT;
ALTER TABLE customer_profiles ADD COLUMN source TEXT;

CREATE INDEX IF NOT EXISTS idx_customer_profiles_meta_cid
  ON customer_profiles(meta_cid);
