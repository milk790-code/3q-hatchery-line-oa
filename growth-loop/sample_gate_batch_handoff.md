# 3Q Growth Loop P0 Sample-Gate Batch Handoff

BLUF: P0 is 18/18 rows mapped. Fill batch 1 (9 focused rows) first, then batch 2 (9 remaining content-variant rows) before treating Week 0 sample-gate collection as covered.

Generated: 2026-07-10T21:45:44.783Z
Mode: sample_gate_batch_handoff_local_only
Status: p0_full_coverage_batched_for_owner_counts
Week: 2026-06-29 to 2026-07-05
Changed variable: cta_text
Current real event rows: 0
Sample threshold met: no
Quick capture status: waiting_for_quick_counts
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

## Coverage

| item | count |
|---|---:|
| P0 planned rows | 18 |
| Rows mapped in this handoff | 18 |
| Focused batch rows | 9 |
| Remaining batch rows | 9 |
| P0 pending rows | 18 |
| Focused pending rows | 9 |
| Remaining pending rows | 9 |

## Focused Next P0 quick-capture batch

- Batch ID: batch_1_focused_next_p0
- Rows: 9
- Accepted by: npm run next-p0:quick
- Owner path: `open next_p0_owner_form.html`
- Purpose: Fastest path to get champion/challenger/line_cta sample-gate counts into local preview.

| rank | paste key | role | tracking link | event | source | evidence rule |
|---:|---|---|---|---|---|---|
| 1 | `champion.visits` | champion | track-champion-3q-line-v0 | page_view | candidate Worker D1 / landing page analytics | 只記 aggregate page views；不要存 IP、User-Agent、個人識別。 |
| 2 | `champion.cta` | champion | track-champion-3q-line-v0 | cta_click | candidate Worker D1 / landing page analytics | 只記 aggregate CTA clicks；不要存個別 session 明細。 |
| 3 | `champion.line` | champion | track-champion-3q-line-v0 | line_add | LINE OA 管理後台 / inbound customer-service aggregate | 只記新增數或進線數；不要貼 LINE user id、暱稱、聊天內容。 |
| 4 | `challenger.visits` | challenger | track-challenger-week0-cta-text-v1 | page_view | candidate Worker D1 / landing page analytics | 只記 aggregate page views；不要存 IP、User-Agent、個人識別。 |
| 5 | `challenger.cta` | challenger | track-challenger-week0-cta-text-v1 | cta_click | candidate Worker D1 / landing page analytics | 只記 aggregate CTA clicks；不要存個別 session 明細。 |
| 6 | `challenger.line` | challenger | track-challenger-week0-cta-text-v1 | line_add | LINE OA 管理後台 / inbound customer-service aggregate | 只記新增數或進線數；不要貼 LINE user id、暱稱、聊天內容。 |
| 7 | `line_cta.visits` | line_cta | track-challenger-week0-cta-text-v1-line | page_view | candidate Worker D1 / landing page analytics | 只記 aggregate page views；不要存 IP、User-Agent、個人識別。 |
| 8 | `line_cta.cta` | line_cta | track-challenger-week0-cta-text-v1-line | cta_click | candidate Worker D1 / landing page analytics | 只記 aggregate CTA clicks；不要存個別 session 明細。 |
| 9 | `line_cta.line` | line_cta | track-challenger-week0-cta-text-v1-line | line_add | LINE OA 管理後台 / inbound customer-service aggregate | 只記新增數或進線數；不要貼 LINE user id、暱稱、聊天內容。 |

### Paste Block

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

## Remaining P0 content-variant coverage batch

- Batch ID: batch_2_remaining_content_variants
- Rows: 9
- Accepted by: sample_gate_owner_worksheet.md / data/source_capture/sample_gate_ledger.filled.csv
- Owner path: `open sample_gate_owner_worksheet.md`
- Purpose: Completes the full 18-row P0 sample-gate coverage after the focused batch is captured.

| rank | paste key | role | tracking link | event | source | evidence rule |
|---:|---|---|---|---|---|---|
| 10 | `post_week0_post_001_cta_v1_diagnostic.visits` | content_variant | post-week0-post-001-cta-v1-diagnostic | page_view | candidate Worker D1 / landing page analytics | 只記 aggregate page views；不要存 IP、User-Agent、個人識別。 |
| 11 | `post_week0_post_001_cta_v1_diagnostic.cta` | content_variant | post-week0-post-001-cta-v1-diagnostic | cta_click | candidate Worker D1 / landing page analytics | 只記 aggregate CTA clicks；不要存個別 session 明細。 |
| 12 | `post_week0_post_001_cta_v1_diagnostic.line` | content_variant | post-week0-post-001-cta-v1-diagnostic | line_add | LINE OA 管理後台 / inbound customer-service aggregate | 只記新增數或進線數；不要貼 LINE user id、暱稱、聊天內容。 |
| 13 | `post_week0_post_002_cta_v2_audit.visits` | content_variant | post-week0-post-002-cta-v2-audit | page_view | candidate Worker D1 / landing page analytics | 只記 aggregate page views；不要存 IP、User-Agent、個人識別。 |
| 14 | `post_week0_post_002_cta_v2_audit.cta` | content_variant | post-week0-post-002-cta-v2-audit | cta_click | candidate Worker D1 / landing page analytics | 只記 aggregate CTA clicks；不要存個別 session 明細。 |
| 15 | `post_week0_post_002_cta_v2_audit.line` | content_variant | post-week0-post-002-cta-v2-audit | line_add | LINE OA 管理後台 / inbound customer-service aggregate | 只記新增數或進線數；不要貼 LINE user id、暱稱、聊天內容。 |
| 16 | `post_week0_post_003_cta_v3_sample.visits` | content_variant | post-week0-post-003-cta-v3-sample | page_view | candidate Worker D1 / landing page analytics | 只記 aggregate page views；不要存 IP、User-Agent、個人識別。 |
| 17 | `post_week0_post_003_cta_v3_sample.cta` | content_variant | post-week0-post-003-cta-v3-sample | cta_click | candidate Worker D1 / landing page analytics | 只記 aggregate CTA clicks；不要存個別 session 明細。 |
| 18 | `post_week0_post_003_cta_v3_sample.line` | content_variant | post-week0-post-003-cta-v3-sample | line_add | LINE OA 管理後台 / inbound customer-service aggregate | 只記新增數或進線數；不要貼 LINE user id、暱稱、聊天內容。 |

### Paste Block

```txt
capture_date=2026-07-11
evidence_ref=<aggregate_ref>
reviewer=<alias>
pii_checked=yes
post_week0_post_001_cta_v1_diagnostic.visits=<count>
post_week0_post_001_cta_v1_diagnostic.cta=<count>
post_week0_post_001_cta_v1_diagnostic.line=<count>
post_week0_post_002_cta_v2_audit.visits=<count>
post_week0_post_002_cta_v2_audit.cta=<count>
post_week0_post_002_cta_v2_audit.line=<count>
post_week0_post_003_cta_v3_sample.visits=<count>
post_week0_post_003_cta_v3_sample.cta=<count>
post_week0_post_003_cta_v3_sample.line=<count>
```


## Safe Command Order

After batch 1:

```zsh
npm run next-p0:quick
npm run next-p0:intake
npm run owner:data-preflight
npm run owner:sample-count-recovery
```

After all P0 rows:

```zsh
npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled
npm run owner:sample-gate
npm run north-star
npm run data:progress
npm run owner:next-action
npm run weekly:local
```

## Safety

- Aggregate counts only.
- Do not paste names, phones, email, LINE user IDs, chat text, order IDs, payment data, refund data, or row-level customer exports.
- Batch 1 paste block is a helper for focused quick capture; batch 2 is a coverage handoff for the full sample-gate worksheet.
- Sample-insufficient weeks keep the current champion and current variable.
- Production deploy performed: no
- Public link change performed: no
- GitHub push / PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer-data mutation performed: no
- Payment action performed: no
- Delete action performed: no
