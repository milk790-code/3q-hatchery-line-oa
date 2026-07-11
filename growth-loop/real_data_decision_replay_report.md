# Real Data Decision Replay Report

BLUF: real_data_decision_replay_ok. The replay connects filled source-capture ledgers, owner-preview CSV compilation, aggregate import previews, scoring, A/B decision, and next-round planning without touching real event input or external systems.

Generated: 2026-07-10T21:47:11.181Z
Mode: real_data_decision_replay_fixture_dry_run
Scenarios: 6
Source capture ledger replay: yes
Source capture compile commands executed: yes
Ledger-to-decision replay performed: yes
Local importer preview commands executed: yes
Execution performed: no
Real event write performed: no
data/lp_events.jsonl write performed: no
External effect: no

| scenario | status | source compile | imported events | challenger decision | A/B decision | next-round decision | quality reasons |
|---|---|---|---:|---|---|---|---|
| sample_insufficient_replay | ok | owner_preview_ready | 533 | keep_testing_sample_insufficient | do_not_promote_challenger | continue_current_round_until_sample_threshold | none |
| winning_replay_owner_review_only | ok | owner_preview_ready | 579 | eligible_for_human_promotion_review | queue_human_promotion_review | queue_owner_promotion_review_before_next_variable | none |
| underperform_replay_next_variable | ok | owner_preview_ready | 572 | retire_or_rework_candidate | do_not_promote_challenger | retire_underperforming_challenger_plan_next_variable | none |
| spam_regression_replay | ok | owner_preview_ready | 588 | reject_quality_regression | do_not_promote_challenger | reject_challenger_quality_regression_plan_next_variable | spam_flag_rate_above_limit, close_rate_retention_below_champion |
| lead_regression_replay | ok | owner_preview_ready | 580 | reject_quality_regression | do_not_promote_challenger | reject_challenger_quality_regression_plan_next_variable | lead_rate_retention_below_champion |
| close_regression_replay | ok | owner_preview_ready | 580 | reject_quality_regression | do_not_promote_challenger | reject_challenger_quality_regression_plan_next_variable | close_rate_retention_below_champion |

## Covered Decisions

- sample_insufficient_replay
- winning_replay_owner_review_only
- underperform_replay_next_variable
- spam_regression_replay
- lead_regression_replay
- close_regression_replay

## Safety Invariants

- Production deploy performed: no
- Public link change performed: no
- GitHub push or PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
