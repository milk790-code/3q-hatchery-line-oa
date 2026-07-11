# Manual Publish Evidence Form Fixtures

BLUF: manual_publish_evidence_form_fixtures_ok. These fixtures verify the browser-only form contract and replay form-shaped evidence JSON through the local evidence intake.

Generated: 2026-07-10T21:46:03.646Z
Mode: manual_publish_evidence_form_fixture_dry_run
Scenarios: 4
Execution performed: no
External effect: no
Formal post performed: no
LINE push performed: no
Public link change performed: no
Production deploy performed: no
GitHub push or PR performed: no
Customer data mutation performed: no
Payment action performed: no
Delete action performed: no
data/lp_events.jsonl write performed: no

## Browser Contract

| check | result | message |
|---|---|---|
| form_status_ok | ok | form status must be ok |
| browser_only | ok | form must be browser-only |
| no_network_calls | ok | form must perform no network calls |
| no_url_fetch | ok | form must not fetch post URLs |
| no_fetch_in_html | ok | HTML must not call fetch |
| no_xhr_or_beacon | ok | HTML must not call XHR or sendBeacon |
| form_action_none | ok | form action must be none |
| download_filename | ok | form must download manual_publish_evidence.json |
| no_live_input_created | ok | form must not create live owner input |

## Replay Scenarios

| scenario | result | status | issues | data write |
|---|---|---|---:|---|
| form_export_valid_recent_waits_until_day3 | ok | waiting_until_day_3 | 0 | no |
| form_export_valid_old_ready_for_day7 | ok | ready_for_day_7_counts | 0 | no |
| form_export_sensitive_post_ref_blocked | ok | blocked_invalid_manual_publish_evidence | 1 | no |
| form_export_missing_pii_check_blocked | ok | blocked_invalid_manual_publish_evidence | 1 | no |
