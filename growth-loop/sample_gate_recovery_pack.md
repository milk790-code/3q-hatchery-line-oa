# Sample Gate Recovery Pack

BLUF: Day 3 sample-gate recovery is ready locally: 9/9 focused rows still need aggregate counts, and the champion stays active until thresholds are proven.

Generated: 2026-07-10T21:45:44.010Z
Mode: sample_gate_recovery_pack_local_only
Status: sample_gate_due_recovery_ready
Due status: day7_due_waiting_for_owner_counts
Due phase: preferred_check_due
Due date: 2026-07-05
Days since minimum check: 10
Preferred check date: 2026-07-05

External effect: no
Live input files created: no
data/lp_events.jsonl write performed: no
Formal post performed: no
LINE push performed: no
Public link change performed: no
Production deploy performed: no
GitHub push or PR performed: no
Customer data mutation performed: no
Payment action performed: no
Delete action performed: no

## Current Gate

- Current real event rows: 0
- P0 focused rows: 9
- P0 pending rows: 18
- Quick counts supplied: 0
- Missing ranks: 1, 2, 3, 4, 5, 6, 7, 8, 9
- Sample threshold met: no
- Sample gaps: visits=100, cta_clicks=20, line_adds=5, test_days=3
- Champion action: keep_champion_sample_insufficient
- Challenger promotion allowed: no
- Next variable rotation allowed: no

## Owner Fast Path

1. Open the paste template or focused browser form. Artifact: `/Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt`.
2. Fill only aggregate counts for the missing ranks, plus capture_date, evidence_ref, reviewer, and pii_checked=yes. Artifact: `next_p0_owner_inputs.json`.
3. Run the local preview commands; do not stage, publish, deploy, change links, push LINE, or mutate customer data. Artifact: `next_p0_owner_intake.md`.

## Missing Rows

| rank | role | event | source | target file | missing |
|---:|---|---|---|---|---|
| 1 | champion | page_view | candidate Worker D1 / landing page analytics | data/funnel_aggregates.csv | yes |
| 2 | champion | cta_click | candidate Worker D1 / landing page analytics | data/funnel_aggregates.csv | yes |
| 3 | champion | line_add | LINE OA 管理後台 / inbound customer-service aggregate | data/manual_conversions.csv | yes |
| 4 | challenger | page_view | candidate Worker D1 / landing page analytics | data/funnel_aggregates.csv | yes |
| 5 | challenger | cta_click | candidate Worker D1 / landing page analytics | data/funnel_aggregates.csv | yes |
| 6 | challenger | line_add | LINE OA 管理後台 / inbound customer-service aggregate | data/manual_conversions.csv | yes |
| 7 | line_cta | page_view | candidate Worker D1 / landing page analytics | data/funnel_aggregates.csv | yes |
| 8 | line_cta | cta_click | candidate Worker D1 / landing page analytics | data/funnel_aggregates.csv | yes |
| 9 | line_cta | line_add | LINE OA 管理後台 / inbound customer-service aggregate | data/manual_conversions.csv | yes |

## Source Groups

| source | rows | missing | events | target files |
|---|---:|---:|---|---|
| candidate Worker D1 / landing page analytics | 6 | 6 | cta_click, page_view | data/funnel_aggregates.csv |
| LINE OA 管理後台 / inbound customer-service aggregate | 3 | 3 | line_add | data/manual_conversions.csv |

## Local Command Sequence After Owner Counts

- `npm run next-p0:quick`
- `npm run next-p0:intake`
- `npm run owner:data-preflight`
- `npm run data:progress`
- `npm run owner:sample-gate`
- `npm run owner:next-action`
- `npm run sample-gate:recovery`
- `npm run weekly:local`

## Blocked Actions

- fake_or_backfill_counts_without_owner_source
- stage_owner_download_without_review
- append_to_data_lp_events_jsonl
- promote_challenger_to_champion
- rotate_next_variable
- formal_social_post_or_schedule
- line_push_or_broadcast
- public_ab_or_bio_link_change
- production_worker_deploy
- github_push_or_pr_creation
- customer_data_mutation
- ecpay_payment_refund_or_capture
- delete_data_or_retire_live_assets
