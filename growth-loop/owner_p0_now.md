# 3Q Growth Loop P0 Now

BLUF: P0 now: fill 9/9 focused aggregate rows first, then Batch 2 through the full P0 form before treating Week 0 P0 as covered. Preflight is waiting_for_owner_p0_counts (0/9 count keys); full P0 coverage is 18/18; full form is ready_local_browser_fill; intake is waiting_for_owner_download; next human gate is approve-d1-create-and-migrate.

Generated: 2026-07-10T21:45:46.800Z
Status: waiting_for_owner_sample_counts
Real event rows: 0
Sample threshold met: no
Sample gate status: waiting_for_sample_gate_counts

## Do First

1. Open `sample_gate_batch_1_paste_block.txt` and copy Batch 1 focused counts.
2. Paste into `data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt` and replace placeholders with aggregate counts only.
3. Open `p0_counts_preflight.md` and confirm the focused paste template is ready or fix listed issues.
4. Open `sample_gate_batch_2_paste_block.txt`, then use `sample_gate_owner_form.html` when all 18 P0 rows need one reviewed CSV.
5. Review `owner_sample_gate_intake.md` after downloading the full P0 CSV.
6. Run after-fill commands from this card.

## Current Counts

| item | value |
|---|---:|
| Focused missing rows | 9/9 |
| Full P0 rows mapped | 18/18 |
| Full P0 pending rows | 18 |
| Batch 1 focused rows | 9 |
| Batch 2 remaining rows | 9 |
| Quick filled ranks | 0/9 |
| Quick missing ranks | 1, 2, 3, 4, 5, 6, 7, 8, 9 |
| P0 preflight status | waiting_for_owner_p0_counts |
| P0 preflight count keys | 0/9 |
| P0 preflight placeholders | 9 |
| P0 preflight issues | 0 |
| Full P0 form status | ready_local_browser_fill |
| Full P0 form rows | 18 |
| Full P0 intake status | waiting_for_owner_download |
| Full P0 intake candidate found | no |
| Full P0 intake staged | no |
| Approval queue pending human | 5 |
| Approval queue next human gate | approve-d1-create-and-migrate |

## Open These First

- `owner_p0_now.html`
- `owner_p0_now.md`
- `sample_gate_batch_1_paste_block.txt`
- `data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt`
- `p0_counts_preflight.md`
- `sample_gate_batch_2_paste_block.txt`
- `sample_gate_owner_form.html`
- `owner_sample_gate_intake.md`
- `owner_sample_count_handoff.md`

## Missing Focused Rows

| rank | role | event | paste key | source |
|---:|---|---|---|---|
| 1 | champion | page_view | `champion.visits` | candidate Worker D1 / landing page analytics |
| 2 | champion | cta_click | `champion.cta` | candidate Worker D1 / landing page analytics |
| 3 | champion | line_add | `champion.line` | LINE OA 管理後台 / inbound customer-service aggregate |
| 4 | challenger | page_view | `challenger.visits` | candidate Worker D1 / landing page analytics |
| 5 | challenger | cta_click | `challenger.cta` | candidate Worker D1 / landing page analytics |
| 6 | challenger | line_add | `challenger.line` | LINE OA 管理後台 / inbound customer-service aggregate |
| 7 | line_cta | page_view | `line_cta.visits` | candidate Worker D1 / landing page analytics |
| 8 | line_cta | cta_click | `line_cta.cta` | candidate Worker D1 / landing page analytics |
| 9 | line_cta | line_add | `line_cta.line` | LINE OA 管理後台 / inbound customer-service aggregate |

## Copy Blocks

### Batch 1 focused counts

Path: `sample_gate_batch_1_paste_block.txt`
Rows: 9

```text
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

### Batch 2 remaining counts

Path: `sample_gate_batch_2_paste_block.txt`
Rows: 9

```text
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

## After Fill Commands

```bash
npm run next-p0:quick
npm run next-p0:intake
npm run owner:data-preflight
npm run data:progress
npm run owner:sample-gate
npm run owner:next-action
npm run sample-gate:recovery
npm run weekly:local
```

## After Full P0 Commands

```bash
npm run owner:intake
npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled
npm run owner:sample-gate
npm run weekly:local
```

## Stop Lines

- Do not invent, backfill, or estimate sample counts without an owner-reviewed aggregate source.
- Do not paste customer names, phone, email, LINE user IDs, chat text, payment data, order IDs, or lead rows.
- Do not append data/lp_events.jsonl from this card.
- Do not promote a challenger, change public links, deploy production, post, push LINE, create a PR, touch payments, mutate customer data, or delete data.

## Safety

- External effect: no
- Live input files created: no
- data/lp_events.jsonl write performed: no
- Public link change performed: no
- Production deploy performed: no
- GitHub push / PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
