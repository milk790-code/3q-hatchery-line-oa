# Funnel Aggregate Fixture Report

BLUF: funnel_aggregate_fixtures_ok. Fixture-only regression guard for full-funnel aggregate imports. No real event file is written.

Generated: 2026-07-10T21:44:08.486Z
Mode: funnel_aggregate_fixture_dry_run
Scenarios: 6
Execution performed: no
Real event write performed: no
data/lp_events.jsonl write performed: no
External effect: no

| scenario | status | exit | importer_mode | events | sensitive_columns | sensitive_values | data_write |
|---|---|---:|---|---:|---|---|---|
| valid_full_funnel_preview | ok | 0 | full_funnel_preview | 28 | no | no | no |
| blocked_unknown_asset | ok | 1 | failed | 0 | no | no | no |
| blocked_missing_content_id | ok | 1 | failed | 0 | no | no | no |
| blocked_sensitive_column | ok | 1 | blocked | 0 | yes | no | no |
| blocked_sensitive_value | ok | 1 | blocked | 0 | no | yes | no |
| blocked_apply_without_append | ok | 2 | blocked | 0 | no | no | no |

## Covered Gates

- valid_full_funnel_preview
- blocked_unknown_asset
- blocked_missing_content_id
- blocked_sensitive_column
- blocked_sensitive_value
- blocked_apply_without_append

## Safety Invariants

- Production deploy performed: no
- Public link change performed: no
- GitHub push or PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
