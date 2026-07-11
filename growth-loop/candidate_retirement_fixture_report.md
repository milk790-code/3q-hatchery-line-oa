# Candidate Retirement Fixture Report

BLUF: candidate_retirement_fixture_ok. This fixture proves non-main candidate retirement stays local-only, sample-insufficient candidates keep testing, winning challengers require owner review, and underperforming or quality-regressed candidates can only be removed from future local rotation without deleting data.

Generated: 2026-07-10T21:47:22.037Z
Mode: candidate_retirement_fixture_dry_run

## Safety

- Current queue safety: ok (current_queue_safe)
- Real events unchanged: yes
- data/lp_events.jsonl write performed: no
- External effect: no
- Public link change performed: no
- Champion promotion performed: no
- Delete action performed: no

## Scenarios

| scenario | status | queue | retire ready | keep testing | promotion reviews | target item |
|---|---|---|---:|---:|---:|---|
| sample_insufficient_keeps_testing | ok | no_retirement_sample_insufficient_or_not_needed | 0 | 1 | 0 | keep_testing_sample_insufficient |
| winning_challenger_requires_owner_review | ok | no_retirement_sample_insufficient_or_not_needed | 0 | 0 | 1 | promotion_review_required |
| underperforming_challenger_ready_for_local_retirement | ok | local_retirement_actions_prepared | 1 | 0 | 0 | retire_local_candidate_due_underperformance |
| quality_regression_ready_for_local_retirement | ok | local_retirement_actions_prepared | 1 | 0 | 0 | retire_local_candidate_due_quality_regression |
| unknown_candidate_observed_only | ok | no_retirement_sample_insufficient_or_not_needed | 0 | 0 | 0 | observed_only_no_rotation_action |
| mixed_candidates_summary_counts | ok | local_retirement_actions_prepared | 1 | 1 | 1 | retire_local_candidate_due_underperformance |

## Note

This script does not edit candidate_retirement_queue.json. It only writes data/candidate_retirement_fixture_status.json and candidate_retirement_fixture_report.md.
