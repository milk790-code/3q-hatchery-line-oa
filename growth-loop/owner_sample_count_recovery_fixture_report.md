# Owner Sample Count Recovery Fixture Report

BLUF: owner_sample_count_recovery_fixtures_ok. Fixture-only recovery scenarios validate post-count state transitions without project writes.

Generated: 2026-07-10T21:45:50.150Z
Mode: owner_sample_count_recovery_fixture_dry_run
Scenarios: 9
Live project write performed: no
data/lp_events.jsonl write performed: no
External effect: no

| scenario | result | exit | status | checks |
|---|---|---:|---|---:|
| waiting_without_owner_counts | ok | 0 | waiting_for_owner_sample_counts | 25/25 |
| quick_preview_ready_prompts_intake | ok | 0 | quick_preview_ready_run_intake | 25/25 |
| focused_intake_ready_prompts_preflight | ok | 0 | focused_intake_preview_ready_run_preflight | 25/25 |
| full_p0_intake_ready_prompts_owner_reviewed_stage | ok | 0 | full_p0_intake_ready_needs_owner_reviewed_stage | 27/27 |
| full_p0_owner_reviewed_stage_prompts_sample_gate | ok | 0 | full_p0_staged_run_sample_gate | 27/27 |
| preflight_sample_insufficient_keeps_collecting | ok | 0 | owner_preview_scored_keep_collecting | 25/25 |
| sample_ready_no_auto_promotion | ok | 0 | owner_preview_sample_ready_no_auto_promotion | 25/25 |
| win_rule_requires_owner_review | ok | 0 | owner_review_required_before_promotion | 25/25 |
| red_line_violation_blocks_recovery | ok | 1 | blocked_red_line_violation_detected | 15/15 |

## Safety Contract

- Temporary fixture roots only.
- No project inbox, live CSV, or real event writes.
- No GitHub push / PR, production deploy, formal post, LINE push, payment, customer-data mutation, or delete action.
- Win-rule scenarios stop at owner review; they do not promote a challenger or rotate variables.
- Red-line violations are detected as blocked fixture failures, not hidden as success.
