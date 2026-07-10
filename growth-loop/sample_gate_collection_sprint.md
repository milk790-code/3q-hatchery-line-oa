# 3Q Growth Loop Sample Gate Collection Sprint

BLUF: P0 sample collection is still the blocker: 18/18 P0 rows are pending, due status is day7_due_waiting_for_owner_counts, and the champion must stay active until the sample gate is proven.

Generated: 2026-07-10T21:45:47.491Z
Mode: sample_gate_collection_sprint_local_only
Status: sample_gate_due_collection_sprint_active
External effect: no
data/lp_events.jsonl write performed: no

## Current Sprint State

- Real event rows: 0
- Sample threshold met: no
- Challenger win rule met: no
- Champion action: keep_champion_sample_insufficient
- Due status: day7_due_waiting_for_owner_counts
- Due date: 2026-07-05
- Next due date: 2026-07-05
- Preferred check date: 2026-07-05
- Focused missing counts: 9
- Full P0 pending: 18/18

## Sprint Steps

| order | phase | status | artifact | owner action | timebox |
|---:|---|---|---|---|---:|
| 1 | batch_1_focused_counts | waiting_for_owner_aggregate_counts | `sample_gate_batch_1_paste_block.txt` | yes | 20m |
| 2 | preflight_and_preview | waiting_for_owner_p0_counts | `p0_counts_preflight.md` | no | 10m |
| 3 | batch_2_remaining_counts | waiting_for_full_p0_coverage | `sample_gate_batch_2_paste_block.txt` | yes | 20m |
| 4 | local_recompute | queued_after_owner_counts | `RUN-P0-POST-FILL-CHECK.command` | no | 10m |
| 5 | sample_gate_decision | day7_due_waiting_for_owner_counts | `owner_sample_gate_status.md` | no | 5m |

## Source Groups

| source | rows | missing | event types |
|---|---:|---:|---|
| candidate Worker D1 / landing page analytics | 6 | 6 | cta_click, page_view |
| LINE OA 管理後台 / inbound customer-service aggregate | 3 | 3 | line_add |

## Owner Open Order

1. `owner_p0_now.html`
2. `sample_gate_batch_1_paste_block.txt`
3. `data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt`
4. `p0_counts_preflight.md`
5. `sample_gate_batch_2_paste_block.txt`
6. `sample_gate_owner_form.html`
7. `RUN-P0-POST-FILL-CHECK.command`

## Commands After Owner Counts

```zsh
npm run p0:counts-preflight
npm run next-p0:quick
npm run next-p0:intake
npm run owner:data-preflight
npm run owner:sample-gate
npm run owner:next-action
npm run weekly:local
node scripts/verify-artifacts.mjs
```

## Acceptance Checks

- Batch 1 focused P0 counts are filled with non-negative integers.
- Batch 2 remaining P0 counts are filled before Week 0 is treated as covered.
- capture_date, evidence_ref, reviewer, and pii_checked=yes are present.
- Only aggregate counts are used; no customer-level rows or LINE chat text are pasted.
- sample_threshold_met remains false until visits, CTA clicks, LINE adds, and minimum days are all met.
- No challenger promotion, variable rotation, public link change, deploy, post, LINE push, GitHub push/PR, payment, customer mutation, or delete occurs from this sprint.

## Blocked Actions

- estimate_or_backfill_missing_counts
- stage_owner_download_without_review
- append_to_data_lp_events_jsonl
- promote_challenger_or_rotate_variable
- formal_social_post_or_schedule
- line_push_or_broadcast
- public_link_change_or_ab_route_change
- production_worker_deploy
- github_push_or_pr_creation
- customer_data_mutation
- ecpay_payment_refund_or_capture
- delete_data_or_live_assets

## Safety

- Aggregate counts only.
- No customer names, phone, email, LINE IDs, chat text, payment data, order IDs, refund data, private notes, or customer-level rows.
- No production deploy, GitHub push/PR, public link change, formal post, LINE push, customer-data mutation, payment action, or delete action.
