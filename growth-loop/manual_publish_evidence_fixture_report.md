# Manual Publish Evidence Fixtures

BLUF: manual_publish_evidence_fixtures_ok. These fixtures validate missing input, valid recent evidence, valid Day 7 evidence, unknown packet blocking, sensitive value blocking, multiple-packet blocking, and missing confirmation blocking. They use temporary files only.

Generated: 2026-07-10T21:46:04.960Z
Mode: manual_publish_evidence_fixture_dry_run
Scenarios: 7
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

| scenario | result | status | issues | external | data write |
|---|---|---|---:|---|---|
| no_input_waits_for_owner_publish_evidence | ok | waiting_for_owner_manual_publish_evidence | 0 | no | no |
| valid_recent_publish_waits_until_day3 | ok | waiting_until_day_3 | 0 | no | no |
| valid_old_publish_ready_for_day7 | ok | ready_for_day_7_counts | 0 | no | no |
| unknown_packet_blocked | ok | blocked_invalid_manual_publish_evidence | 1 | no | no |
| sensitive_value_blocked | ok | blocked_invalid_manual_publish_evidence | 1 | no | no |
| multiple_packets_blocked | ok | blocked_invalid_manual_publish_evidence | 1 | no | no |
| missing_confirmation_blocked | ok | blocked_invalid_manual_publish_evidence | 1 | no | no |
