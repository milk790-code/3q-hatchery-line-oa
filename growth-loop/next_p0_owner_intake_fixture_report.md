# 3Q Growth Loop Next P0 Owner Intake Fixture Report

BLUF: next_p0_owner_intake_fixture_ok。This fixture verifies the focused Next P0 owner-download intake without touching project live CSVs, scoring events, or external systems.

Generated: 2026-07-10T21:45:14.655Z
Mode: next_p0_owner_intake_fixture_dry_run
Rows: 9
Scenarios: 5
Live project inputs created: no
data/lp_events.jsonl write performed: no
External effect: no

| scenario | result | exit | status | checks |
|---|---|---:|---|---:|
| valid_download_preview_ready | ok | 0 | next_p0_owner_download_preview_ready | 9/9 |
| quick_preview_auto_intake_ready | ok | 0 | next_p0_owner_download_preview_ready | 11/11 |
| sensitive_evidence_blocked | ok | 1 | blocked_invalid_next_p0_owner_download | 7/7 |
| stage_without_confirmation_blocked | ok | 1 | next_p0_owner_download_ready_needs_confirmed_stage | 8/8 |
| confirmed_stage_writes_temp_live_inputs_only | ok | 0 | next_p0_owner_download_staged_local_inputs | 9/9 |

## Safety Contract

- Fixture stage writes only to temporary live paths.
- Project `data/funnel_aggregates.csv`, `data/manual_conversions.csv`, and `data/lp_events.jsonl` are not written by this fixture.
- Sensitive-looking owner evidence is blocked.
- Stage requires explicit `--confirm-owner-reviewed`.
- A complete quick-filled preview from `next-p0:quick` can be auto-intaken into owner-preview CSVs without `--input`.
