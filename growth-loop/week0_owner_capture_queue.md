# Week 0 Owner Capture Queue

BLUF: waiting_for_owner_sample_gate_counts. This is the shortest owner-facing queue for collecting the Week 0 sample-gate counts: page_view, cta_click, and line_add only. It is local and read-only.

Generated: 2026-07-10T21:44:52.010Z
Week: 2026-06-29 to 2026-07-05
Changed variable: cta_text
P0 rows: 18
P0 links: 6
Owner fill path: data/source_capture/sample_gate_ledger.filled.csv
Template: data/source_capture/sample_gate_ledger.fill-template.csv
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

## Sample Gaps

| gate | gap |
|---|---:|
| visits | 100 |
| cta_clicks | 20 |
| line_adds | 5 |
| test_days | 3 |

## Source Groups

| source | events | rows | links | instruction |
|---|---|---:|---:|---|
| candidate Worker D1 / landing page analytics | page_view, cta_click | 12 | 6 | Collect aggregate page_view / cta_click counts by asset_id, content_id, variant_id, and tracking_link_id. Do not mutate D1 or export row-level visitor data. |
| LINE OA 管理後台 / inbound customer-service aggregate | line_add | 6 | 6 | Collect only aggregate line_add counts from LINE OA or inbound customer-service summaries. Do not export user IDs, names, chat text, notes, or customer rows. |

## Capture Rows

| order | tracking link | role | event | content | variant | source |
|---:|---|---|---|---|---|---|
| 1 | track-champion-3q-line-v0 | champion | page_view | 2026-06-29-champion | champion-3q-line-v0 | candidate Worker D1 / landing page analytics |
| 1 | track-champion-3q-line-v0 | champion | cta_click | 2026-06-29-champion | champion-3q-line-v0 | candidate Worker D1 / landing page analytics |
| 1 | track-champion-3q-line-v0 | champion | line_add | 2026-06-29-champion | champion-3q-line-v0 | LINE OA 管理後台 / inbound customer-service aggregate |
| 2 | track-challenger-week0-cta-text-v1 | challenger | page_view | 2026-06-29-challenger | challenger-week0-cta-text-v1 | candidate Worker D1 / landing page analytics |
| 2 | track-challenger-week0-cta-text-v1 | challenger | cta_click | 2026-06-29-challenger | challenger-week0-cta-text-v1 | candidate Worker D1 / landing page analytics |
| 2 | track-challenger-week0-cta-text-v1 | challenger | line_add | 2026-06-29-challenger | challenger-week0-cta-text-v1 | LINE OA 管理後台 / inbound customer-service aggregate |
| 3 | track-challenger-week0-cta-text-v1-line | line_cta | page_view | 2026-06-29-line-cta | challenger-week0-cta-text-v1-line | candidate Worker D1 / landing page analytics |
| 3 | track-challenger-week0-cta-text-v1-line | line_cta | cta_click | 2026-06-29-line-cta | challenger-week0-cta-text-v1-line | candidate Worker D1 / landing page analytics |
| 3 | track-challenger-week0-cta-text-v1-line | line_cta | line_add | 2026-06-29-line-cta | challenger-week0-cta-text-v1-line | LINE OA 管理後台 / inbound customer-service aggregate |
| 4 | post-week0-post-001-cta-v1-diagnostic | content_variant | page_view | week0-post-001 | cta-v1-diagnostic | candidate Worker D1 / landing page analytics |
| 4 | post-week0-post-001-cta-v1-diagnostic | content_variant | cta_click | week0-post-001 | cta-v1-diagnostic | candidate Worker D1 / landing page analytics |
| 4 | post-week0-post-001-cta-v1-diagnostic | content_variant | line_add | week0-post-001 | cta-v1-diagnostic | LINE OA 管理後台 / inbound customer-service aggregate |
| 5 | post-week0-post-002-cta-v2-audit | content_variant | page_view | week0-post-002 | cta-v2-audit | candidate Worker D1 / landing page analytics |
| 5 | post-week0-post-002-cta-v2-audit | content_variant | cta_click | week0-post-002 | cta-v2-audit | candidate Worker D1 / landing page analytics |
| 5 | post-week0-post-002-cta-v2-audit | content_variant | line_add | week0-post-002 | cta-v2-audit | LINE OA 管理後台 / inbound customer-service aggregate |
| 6 | post-week0-post-003-cta-v3-sample | content_variant | page_view | week0-post-003 | cta-v3-sample | candidate Worker D1 / landing page analytics |
| 6 | post-week0-post-003-cta-v3-sample | content_variant | cta_click | week0-post-003 | cta-v3-sample | candidate Worker D1 / landing page analytics |
| 6 | post-week0-post-003-cta-v3-sample | content_variant | line_add | week0-post-003 | cta-v3-sample | LINE OA 管理後台 / inbound customer-service aggregate |

## Fastest Path

| order | action | status | command |
|---:|---|---|---|
| 1 | create_sample_gate_working_copy | owner_local_review_required | `cp data/source_capture/sample_gate_ledger.fill-template.csv data/source_capture/sample_gate_ledger.filled.csv` |
| 2 | fill_18_aggregate_rows | owner_manual_input_required | `Open data/source_capture/sample_gate_ledger.filled.csv and fill capture_date, aggregate_count, evidence_ref, reviewer, pii_checked.` |
| 3 | compile_owner_preview | ready_after_owner_counts | `npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled` |
| 4 | review_decision_artifacts | ready_after_compile | `Open source_capture_compile_report.md, sample_gate_collection_plan.md, and next_round_plan.md.` |

## Fields To Fill

- capture_date
- aggregate_count
- evidence_ref
- reviewer
- pii_checked

## Safety Rules

- Only aggregate counts are allowed.
- Evidence refs must be local screenshot/export references, not raw customer rows.
- Do not paste phone, email, LINE user ID, customer name, chat text, payment data, order IDs, refund details, or private notes.
- Sample-insufficient rounds must keep the current champion and current variable.
- This queue never creates live CSVs, appends data/lp_events.jsonl, deploys, posts, pushes LINE, changes public links, mutates customer data, touches payments, or deletes data.
