# 3Q Growth Loop Owner Sample Gate Fixture Report

BLUF: owner_sample_gate_fixture_ok。This fixture proves owner-filled sample-gate status handling for missing input, partial rows, insufficient visits, insufficient test days, sample-rate winners, underperformers, and sensitive evidence without applying data or promoting challengers.

Generated: 2026-07-10T21:45:30.226Z
Mode: owner_sample_gate_fixture_dry_run
Scenarios: 7
Owner sample gate commands executed: yes
data/lp_events.jsonl write performed: no
External effect: no
Promotion performed: no

## Scenario Summary

| scenario | result | status | decision | filled | pending | sample met | rate win candidate | quality guard | promoted |
|---|---|---|---|---:|---:|---|---|---|---|
| missing_input_waits_for_owner_counts | ok | waiting_for_owner_sample_gate_counts | continue_collecting_sample_gate_counts | 0 | 18 | no | no | not_evaluated_from_sample_gate | no |
| partial_counts_keep_collecting | ok | owner_counts_incomplete | continue_collecting_sample_gate_counts | 6 | 12 | no | no | not_evaluated_from_sample_gate | no |
| sample_insufficient_due_visits | ok | sample_insufficient_keep_champion | continue_collecting_sample_gate_counts | 18 | 0 | no | no | not_evaluated_from_sample_gate | no |
| sample_insufficient_due_test_days | ok | sample_insufficient_keep_champion | continue_collecting_sample_gate_counts | 18 | 0 | no | no | not_evaluated_from_sample_gate | no |
| sample_rate_win_needs_quality_review | ok | sample_rate_win_needs_quality_review | queue_owner_quality_review_no_auto_promotion | 18 | 0 | yes | yes | not_evaluated_from_sample_gate | no |
| sample_ready_challenger_underperforms | ok | sample_ready_challenger_underperforms | plan_rework_or_next_variable_after_owner_review | 18 | 0 | yes | no | not_evaluated_from_sample_gate | no |
| sensitive_evidence_blocks_status | ok | blocked_invalid_owner_sample_gate | fix_owner_sample_gate_ledger | 0 | 0 | no | no | not_evaluated_from_sample_gate | no |

## Owner Boundary

All files are temporary except this report and `data/owner_sample_gate_fixture_status.json`. The fixture does not create `data/source_capture/sample_gate_ledger.filled.csv`, does not create live aggregate CSVs, does not append `data/lp_events.jsonl`, and does not promote a challenger.
