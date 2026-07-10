# 3Q Growth Loop Win Rule Fixture Report

BLUF: The fixture simulator validates sample thresholds, challenger win logic, quality regression blocking, and the rule that even a winning challenger only queues human promotion review.

Generated: 2026-07-10T21:47:10.182Z
Mode: win_rule_fixture_dry_run
Overall: pass
Real event write performed: no
External effect: none

## Scenarios

| scenario | result | sample_met | no_quality_regression | regression_reasons | challenger_decision | ab_decision | promotion_performed |
|---|---|---|---|---|---|---|---|
| sample_insufficient_keeps_champion | pass | no | yes | none | keep_testing_sample_insufficient | do_not_promote_challenger | no |
| win_rule_queues_human_promotion_only | pass | yes | yes | none | eligible_for_human_promotion_review | queue_human_promotion_review | no |
| sample_met_underperform_rework | pass | yes | yes | none | retire_or_rework_candidate | do_not_promote_challenger | no |
| quality_regression_blocks_promotion | pass | yes | no | spam_flag_rate_above_limit, close_rate_retention_below_champion | reject_quality_regression | do_not_promote_challenger | no |
| lead_rate_regression_blocks_promotion | pass | yes | no | lead_rate_retention_below_champion | reject_quality_regression | do_not_promote_challenger | no |
| close_rate_regression_blocks_promotion | pass | yes | no | close_rate_retention_below_champion | reject_quality_regression | do_not_promote_challenger | no |

## Safety Invariants

- Production deploy performed: no
- Public link change performed: no
- Challenger promotion performed: no
- Formal post performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
