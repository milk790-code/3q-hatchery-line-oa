PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS lp_assets (
  asset_id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('champion', 'challenger', 'retired')),
  name TEXT NOT NULL,
  landing_url TEXT NOT NULL,
  line_url TEXT,
  changed_variable TEXT CHECK (
    changed_variable IS NULL OR changed_variable IN ('hook', 'offer', 'visual_claim', 'cta_text')
  ),
  status TEXT NOT NULL DEFAULT 'candidate_local_only',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS lp_events (
  event_id TEXT PRIMARY KEY,
  occurred_at TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  variant_id TEXT,
  content_id TEXT,
  session_id TEXT,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'link_click',
      'page_view',
      'cta_click',
      'line_add',
      'lead_submit',
      'deal',
      'quality_flag'
    )
  ),
  url TEXT,
  referrer TEXT,
  user_agent_hash TEXT,
  ip_country TEXT,
  value_amount REAL,
  quality_score REAL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (asset_id) REFERENCES lp_assets(asset_id)
);

CREATE INDEX IF NOT EXISTS idx_lp_events_asset_time ON lp_events(asset_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_lp_events_type_time ON lp_events(event_type, occurred_at);
CREATE INDEX IF NOT EXISTS idx_lp_events_campaign ON lp_events(campaign, content_id, variant_id);

CREATE TABLE IF NOT EXISTS ab_tests (
  test_id TEXT PRIMARY KEY,
  champion_asset_id TEXT NOT NULL,
  challenger_asset_id TEXT NOT NULL,
  changed_variable TEXT NOT NULL CHECK (changed_variable IN ('hook', 'offer', 'visual_claim', 'cta_text')),
  started_at TEXT,
  planned_end_at TEXT,
  min_test_days INTEGER NOT NULL DEFAULT 3,
  preferred_test_days INTEGER NOT NULL DEFAULT 7,
  allocation_champion INTEGER NOT NULL DEFAULT 90,
  allocation_challenger INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'draft_needs_human_link_gate',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (champion_asset_id) REFERENCES lp_assets(asset_id),
  FOREIGN KEY (challenger_asset_id) REFERENCES lp_assets(asset_id)
);

CREATE TABLE IF NOT EXISTS weekly_growth_scores (
  score_id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  link_clicks INTEGER NOT NULL DEFAULT 0,
  visits INTEGER NOT NULL DEFAULT 0,
  cta_clicks INTEGER NOT NULL DEFAULT 0,
  line_adds INTEGER NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  deals INTEGER NOT NULL DEFAULT 0,
  cta_rate REAL NOT NULL DEFAULT 0,
  line_add_rate REAL NOT NULL DEFAULT 0,
  lead_rate REAL NOT NULL DEFAULT 0,
  close_rate REAL NOT NULL DEFAULT 0,
  score REAL NOT NULL DEFAULT 0,
  sample_threshold_met INTEGER NOT NULL DEFAULT 0,
  no_quality_regression INTEGER NOT NULL DEFAULT 1,
  decision TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (asset_id) REFERENCES lp_assets(asset_id)
);

CREATE TABLE IF NOT EXISTS iteration_decisions (
  decision_id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  current_round_id TEXT NOT NULL,
  current_changed_variable TEXT NOT NULL CHECK (current_changed_variable IN ('hook', 'offer', 'visual_claim', 'cta_text')),
  next_round_id TEXT NOT NULL,
  next_changed_variable TEXT NOT NULL CHECK (next_changed_variable IN ('hook', 'offer', 'visual_claim', 'cta_text')),
  decision TEXT NOT NULL,
  sample_threshold_met INTEGER NOT NULL DEFAULT 0,
  challenger_win_rule_met INTEGER NOT NULL DEFAULT 0,
  no_quality_regression INTEGER NOT NULL DEFAULT 1,
  start_new_variable_round INTEGER NOT NULL DEFAULT 0,
  owner_review_required INTEGER NOT NULL DEFAULT 1,
  external_effect INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS approval_queue (
  queue_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  type TEXT NOT NULL,
  risk_tier TEXT NOT NULL CHECK (risk_tier IN ('T0', 'T1', 'T2', 'T3')),
  status TEXT NOT NULL DEFAULT 'pending_human',
  human_gate TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS prepared_but_blocked (
  block_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  action TEXT NOT NULL,
  blocked_by TEXT NOT NULL,
  prepared_artifact TEXT,
  resume_when TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}'
);

INSERT OR IGNORE INTO lp_assets (
  asset_id,
  role,
  name,
  landing_url,
  line_url,
  changed_variable,
  status,
  metadata_json
) VALUES
  (
    'champion-3q-line-v0',
    'champion',
    'Current 3Q subsidy landing page',
    'https://3q-site.milk790.workers.dev/',
    'https://lin.ee/VZvs7sj',
    NULL,
    'champion_live_verified_read_only',
    '{"source":"week0_seed","verified_live_read_only":"2026-07-10"}'
  ),
  (
    'challenger-week0-cta-text-v1',
    'challenger',
    '48h diagnostic CTA challenger',
    'landing_page_candidate.html',
    'https://lin.ee/VZvs7sj',
    'cta_text',
    'candidate_local_only',
    '{"source":"week0_seed"}'
  );

-- Upgrade only the known Week 0 placeholders; preserve any later owner-reviewed state.
UPDATE lp_assets
SET
  name = 'Current 3Q subsidy landing page',
  landing_url = 'https://3q-site.milk790.workers.dev/',
  line_url = 'https://lin.ee/VZvs7sj',
  status = 'champion_live_verified_read_only',
  metadata_json = '{"source":"week0_seed","verified_live_read_only":"2026-07-10"}'
WHERE asset_id = 'champion-3q-line-v0'
  AND (
    landing_url = 'PENDING_CURRENT_MAIN_LINK'
    OR status = 'champion_placeholder'
  );

UPDATE lp_assets
SET line_url = 'https://lin.ee/VZvs7sj'
WHERE asset_id = 'challenger-week0-cta-text-v1'
  AND line_url = 'https://lin.ee/80AW8WV';

INSERT OR IGNORE INTO ab_tests (
  test_id,
  champion_asset_id,
  challenger_asset_id,
  changed_variable,
  min_test_days,
  preferred_test_days,
  allocation_champion,
  allocation_challenger,
  status,
  metadata_json
) VALUES (
  'ab-week0-cta-text-001',
  'champion-3q-line-v0',
  'challenger-week0-cta-text-v1',
  'cta_text',
  3,
  7,
  90,
  10,
  'draft_needs_human_link_gate',
  '{"rule":"one_variable_only","blocked_until":"human_approves_small_traffic_link"}'
);
