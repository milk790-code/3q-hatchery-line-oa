# 3Q Growth Loop Sample Gate Due Fixture Report

BLUF: sample_gate_due_fixtures_ok. This fixture verifies Day 3 waiting, due, overdue recovery, and Day 7 due states with temporary outputs only.

Generated: 2026-07-10T21:45:17.514Z
Mode: sample_gate_due_fixture_dry_run
Scenarios: 4
Project due-status write performed: no
data/lp_events.jsonl write performed: no
External effect: no

| scenario | today | result | exit | status | phase | event | checks |
|---|---|---|---:|---|---|---|---:|
| waiting_before_day3 | 2026-07-07 | ok | 0 | waiting_until_day3 | pre_minimum_check | minimum_sample_check_day3 | 14/14 |
| day3_due | 2026-07-08 | ok | 0 | day3_due_waiting_for_owner_counts | minimum_check_due | minimum_sample_check_day3 | 14/14 |
| day3_overdue_recovery | 2026-07-09 | ok | 0 | day3_overdue_waiting_for_owner_counts | minimum_check_overdue | minimum_sample_check_day3_overdue | 14/14 |
| day7_due | 2026-07-12 | ok | 0 | day7_due_waiting_for_owner_counts | preferred_check_due | preferred_sample_check_day7 | 14/14 |

## Safety Contract

- Temporary fixture paths only.
- No project sample-gate due-status overwrite.
- No Calendar import, browser open, event write, deploy, post, LINE push, GitHub action, customer-data mutation, payment action, or delete action.
- Overdue recovery still keeps the champion unchanged and asks only for aggregate owner counts.
