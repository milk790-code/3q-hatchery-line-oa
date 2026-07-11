# 3Q Growth Loop Sample Gate Replay Fixture

BLUF: sample_gate_replay_fixture_ok。This fixture proves the 18-row sample-gate filled ledger can compile into owner-preview CSVs and replay into sample-threshold decisions without writing real events or taking external action.

Generated: 2026-07-10T21:44:42.873Z
Mode: sample_gate_replay_fixture_dry_run
Template rows: 18
Scenarios: 3
Sample event types: page_view, cta_click, line_add
Source capture compile commands executed: yes
Importer preview commands executed: yes
Sample gate ledger replay: yes
data/lp_events.jsonl write performed: no
External effect: no
Promotion performed: no

## Scenario Summary

| scenario | result | challenger visits | challenger CTA | challenger LINE | sample met | lift | decision |
|---|---:|---:|---:|---:|---|---:|---|
| sample_gate_insufficient_keeps_collecting | ok | 99 | 20 | 6 | no | 1.212 | continue_collecting_sample_gate_counts |
| sample_gate_ready_challenger_beats_rate | ok | 120 | 25 | 8 | yes | 1.334 | queue_owner_review_no_auto_promotion |
| sample_gate_ready_challenger_underperforms | ok | 100 | 20 | 5 | yes | 0.625 | plan_rework_or_next_variable_after_owner_review |

## Owner Boundary

This is a temporary fixture only. It does not create `data/source_capture/sample_gate_ledger.filled.csv`, does not create live aggregate CSVs, does not append `data/lp_events.jsonl`, and does not promote a challenger. A real owner-filled ledger must still be reviewed before local apply.
