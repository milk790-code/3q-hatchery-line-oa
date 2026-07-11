# Owner Sample Count Handoff

BLUF: Owner sample-count handoff is ready for Batch 1: 9/9 focused P0 rows still need aggregate counts. Full P0 coverage is 18/18 rows mapped, with 9 remaining content-variant rows; fill Batch 1 first, then Batch 2 before treating Week 0 P0 as covered.

Generated: 2026-07-10T21:45:46.059Z
Mode: owner_sample_count_handoff_local_only
Status: waiting_for_owner_sample_counts
Due status: day7_due_waiting_for_owner_counts
Real event rows: 0
Sample threshold met: no

## Quick Count Progress

- Quick capture status: waiting_for_quick_counts
- Filled ranks: 0/9 (none)
- Missing ranks: 9/9 (1, 2, 3, 4, 5, 6, 7, 8, 9)
- Partial waiting: no
- Partial auto counts: no
- Paste template: `/Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt`
- Filled preview created: no

## Full P0 Coverage

- Scope of this handoff: batch_1_focused_next_p0
- Full P0 status: p0_full_coverage_batched_for_owner_counts
- Full P0 rows mapped: 18/18
- Full P0 pending rows: 18
- Batch count: 2
- Batch 1 focused rows: 9
- Batch 2 remaining content-variant rows: 9
- Full coverage ready: yes
- Full handoff: `sample_gate_batch_handoff.md`
- Batch 1 paste block: `sample_gate_batch_1_paste_block.txt`
- Batch 2 paste block: `sample_gate_batch_2_paste_block.txt`

## One Screen Action

1. Open `sample_gate_batch_handoff.md` for the full 18-row P0 map.
2. Fill Batch 1 focused rows through `/Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt` or `next_p0_owner_form.html`.
3. Use `owner_sample_count_paste_block.txt` for the focused quick path, then fill `sample_gate_batch_2_paste_block.txt` before treating Week 0 P0 as covered.
4. Run the local commands in order after owner review.

Primary owner action: `open sample_gate_batch_handoff.md`
Next operator action: p0_collect_sample_gate_counts: Open next_p0_owner_form.html or next_p0_quick_capture.md, fill aggregate-only P0 counts, then rerun owner intake/weekly verification.

## Batch 1 Focused Copy/Paste Block

Paste this block into `/Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt`, then replace only the metadata placeholders and `<count>` values.

Copy-only file: `owner_sample_count_paste_block.txt`

```txt
capture_date=2026-07-11
evidence_ref=<aggregate_ref>
reviewer=<alias>
pii_checked=yes
champion.visits=<count>
champion.cta=<count>
champion.line=<count>
challenger.visits=<count>
challenger.cta=<count>
challenger.line=<count>
line_cta.visits=<count>
line_cta.cta=<count>
line_cta.line=<count>
```

## Batch 1 Focused Missing Rows

| rank | paste key | role | event | source | evidence rule |
|---:|---|---|---|---|---|
| 1 | `champion.visits` | champion | page_view | candidate Worker D1 / landing page analytics | 只記 aggregate page views；不要存 IP、User-Agent、個人識別。 |
| 2 | `champion.cta` | champion | cta_click | candidate Worker D1 / landing page analytics | 只記 aggregate CTA clicks；不要存個別 session 明細。 |
| 3 | `champion.line` | champion | line_add | LINE OA 管理後台 / inbound customer-service aggregate | 只記新增數或進線數；不要貼 LINE user id、暱稱、聊天內容。 |
| 4 | `challenger.visits` | challenger | page_view | candidate Worker D1 / landing page analytics | 只記 aggregate page views；不要存 IP、User-Agent、個人識別。 |
| 5 | `challenger.cta` | challenger | cta_click | candidate Worker D1 / landing page analytics | 只記 aggregate CTA clicks；不要存個別 session 明細。 |
| 6 | `challenger.line` | challenger | line_add | LINE OA 管理後台 / inbound customer-service aggregate | 只記新增數或進線數；不要貼 LINE user id、暱稱、聊天內容。 |
| 7 | `line_cta.visits` | line_cta | page_view | candidate Worker D1 / landing page analytics | 只記 aggregate page views；不要存 IP、User-Agent、個人識別。 |
| 8 | `line_cta.cta` | line_cta | cta_click | candidate Worker D1 / landing page analytics | 只記 aggregate CTA clicks；不要存個別 session 明細。 |
| 9 | `line_cta.line` | line_cta | line_add | LINE OA 管理後台 / inbound customer-service aggregate | 只記新增數或進線數；不要貼 LINE user id、暱稱、聊天內容。 |

## Source Groups

| source | rows | missing | events |
|---|---:|---:|---|
| candidate Worker D1 / landing page analytics | 6 | 6 | cta_click, page_view |
| LINE OA 管理後台 / inbound customer-service aggregate | 3 | 3 | line_add |

## Acceptance Checks

- Every missing rank has a non-negative integer count.
- capture_date is present and ISO-like.
- evidence_ref points to aggregate analytics or LINE OA aggregate source only.
- reviewer is non-sensitive and pii_checked=yes.
- No customer name, phone, email, chat message, payment, or row-level lead data is pasted.

## After Fill Commands

1. `npm run next-p0:quick`
2. `npm run next-p0:intake`
3. `npm run owner:data-preflight`
4. `npm run data:progress`
5. `npm run owner:sample-gate`
6. `npm run owner:next-action`
7. `npm run sample-gate:recovery`
8. `npm run weekly:local`

## Blocked Actions

- fake_or_backfill_counts_without_owner_source
- paste_customer_rows_or_chat_text
- create_live_input_files_without_owner_review
- append_to_data_lp_events_jsonl
- promote_challenger_to_champion
- rotate_next_variable
- formal_social_post_or_schedule
- line_push_or_broadcast
- public_link_change
- production_worker_deploy
- github_push_or_pr_creation
- customer_data_mutation
- payment_or_refund_action
- delete_data

## Safety

- External effect: no
- Live input files created: no
- data/lp_events.jsonl write performed: no
- Public link change performed: no
- Production deploy performed: no
- GitHub push / PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer-data mutation performed: no
- Payment action performed: no
- Delete action performed: no
