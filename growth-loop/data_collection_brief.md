# 3Q Growth Loop Data Collection Brief

BLUF: The weekly engine is ready, but this week still needs owner-reviewed aggregate counts before it can score real funnel performance. This brief converts the missing source data into a concrete collection queue.

Generated: 2026-07-10T21:44:51.068Z
Mode: data_collection_brief
Status: waiting_for_owner_aggregate_counts
Week: 2026-06-29 to 2026-07-05
Changed variable: cta_text
Importable links: 6
Gated links: 1
Collection tasks: 42
Filled ledger exists: no
Sample threshold met: no
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

## Sample Gate Gaps

- Visits: 0/100 gap=100
- CTA clicks: 0/20 gap=20
- LINE adds: 0/5 gap=5
- Test days: 0/3 preferred=7 gap=3

## Sample Gate Fast Path

- Artifact: sample_gate_collection_plan.md / sample_gate_collection_plan.json / data/sample_gate_collection_plan_status.json
- Status: waiting_for_sample_gate_counts
- P0 sample-gate tasks: 18
- P0 links to inspect: 6
- Sample-gate fill template: data/source_capture/sample_gate_ledger.fill-template.csv
- Sample-gate owner-filled path: data/source_capture/sample_gate_ledger.filled.csv
- Required event types: page_view, cta_click, line_add
- Rule: collect sample-gate counts first; do not replace the champion until thresholds and win rule are both satisfied.

## Immediate Actions

| action | status | command | note |
|---|---|---|---|
| create_owner_filled_ledger_copy | owner_local_review_required | `cp data/source_capture/source_capture_ledger.fill-template.csv data/source_capture/source_capture_ledger.filled.csv` | Run locally only after reviewing the template. This creates an owner working copy, not a live scoring input. |
| fill_aggregate_counts | owner_manual_input_required | `Open data/source_capture/source_capture_ledger.filled.csv and fill aggregate_count plus evidence fields.` | Use aggregate counts only. Do not paste customer rows or chat text. |

## Stage Priorities

| event_type | priority | sample_gap | source_surface | target_live_file |
|---|---|---:|---|---|
| link_click | P1_funnel_completeness | 0 | 社群平台連結點擊報表 / remote D1 link_click | data/funnel_aggregates.csv |
| page_view | P0_sample_gate | 100 | candidate Worker D1 / landing page analytics | data/funnel_aggregates.csv |
| cta_click | P0_sample_gate | 20 | candidate Worker D1 / landing page analytics | data/funnel_aggregates.csv |
| line_add | P0_sample_gate | 5 | LINE OA 管理後台 / inbound customer-service aggregate | data/manual_conversions.csv |
| lead_submit | P1_funnel_completeness | 0 | LINE 客服手動分桶 / lead qualification aggregate | data/manual_conversions.csv |
| deal | P1_funnel_completeness | 0 | owner-confirmed aggregate deal log | data/manual_conversions.csv |
| quality_flag | P1_funnel_completeness | 0 | LINE 客服手動分桶 / quality aggregate | data/manual_conversions.csv |

## Collection Queue

| priority | event_type | tracking_link_id | role | source_metric | target_live_file |
|---|---|---|---|---|---|
| P1_funnel_completeness | link_click | track-champion-3q-line-v0 | champion | link clicks by content_id / variant_id | data/funnel_aggregates.csv |
| P0_sample_gate | page_view | track-champion-3q-line-v0 | champion | page_view count by asset_id / content_id / variant_id | data/funnel_aggregates.csv |
| P0_sample_gate | cta_click | track-champion-3q-line-v0 | champion | cta_click count by asset_id / content_id / variant_id | data/funnel_aggregates.csv |
| P0_sample_gate | line_add | track-champion-3q-line-v0 | champion | line_add aggregate count by tracking context | data/manual_conversions.csv |
| P1_funnel_completeness | lead_submit | track-champion-3q-line-v0 | champion | lead_submit aggregate count | data/manual_conversions.csv |
| P1_funnel_completeness | deal | track-champion-3q-line-v0 | champion | deal aggregate count | data/manual_conversions.csv |
| P1_funnel_completeness | quality_flag | track-champion-3q-line-v0 | champion | quality_flag count and optional aggregate quality_score | data/manual_conversions.csv |
| P1_funnel_completeness | link_click | track-challenger-week0-cta-text-v1 | challenger | link clicks by content_id / variant_id | data/funnel_aggregates.csv |
| P0_sample_gate | page_view | track-challenger-week0-cta-text-v1 | challenger | page_view count by asset_id / content_id / variant_id | data/funnel_aggregates.csv |
| P0_sample_gate | cta_click | track-challenger-week0-cta-text-v1 | challenger | cta_click count by asset_id / content_id / variant_id | data/funnel_aggregates.csv |
| P0_sample_gate | line_add | track-challenger-week0-cta-text-v1 | challenger | line_add aggregate count by tracking context | data/manual_conversions.csv |
| P1_funnel_completeness | lead_submit | track-challenger-week0-cta-text-v1 | challenger | lead_submit aggregate count | data/manual_conversions.csv |
| P1_funnel_completeness | deal | track-challenger-week0-cta-text-v1 | challenger | deal aggregate count | data/manual_conversions.csv |
| P1_funnel_completeness | quality_flag | track-challenger-week0-cta-text-v1 | challenger | quality_flag count and optional aggregate quality_score | data/manual_conversions.csv |
| P1_funnel_completeness | link_click | track-challenger-week0-cta-text-v1-line | line_cta | link clicks by content_id / variant_id | data/funnel_aggregates.csv |
| P0_sample_gate | page_view | track-challenger-week0-cta-text-v1-line | line_cta | page_view count by asset_id / content_id / variant_id | data/funnel_aggregates.csv |
| P0_sample_gate | cta_click | track-challenger-week0-cta-text-v1-line | line_cta | cta_click count by asset_id / content_id / variant_id | data/funnel_aggregates.csv |
| P0_sample_gate | line_add | track-challenger-week0-cta-text-v1-line | line_cta | line_add aggregate count by tracking context | data/manual_conversions.csv |
| P1_funnel_completeness | lead_submit | track-challenger-week0-cta-text-v1-line | line_cta | lead_submit aggregate count | data/manual_conversions.csv |
| P1_funnel_completeness | deal | track-challenger-week0-cta-text-v1-line | line_cta | deal aggregate count | data/manual_conversions.csv |
| P1_funnel_completeness | quality_flag | track-challenger-week0-cta-text-v1-line | line_cta | quality_flag count and optional aggregate quality_score | data/manual_conversions.csv |
| P1_funnel_completeness | link_click | post-week0-post-001-cta-v1-diagnostic | content_variant | link clicks by content_id / variant_id | data/funnel_aggregates.csv |
| P0_sample_gate | page_view | post-week0-post-001-cta-v1-diagnostic | content_variant | page_view count by asset_id / content_id / variant_id | data/funnel_aggregates.csv |
| P0_sample_gate | cta_click | post-week0-post-001-cta-v1-diagnostic | content_variant | cta_click count by asset_id / content_id / variant_id | data/funnel_aggregates.csv |
| P0_sample_gate | line_add | post-week0-post-001-cta-v1-diagnostic | content_variant | line_add aggregate count by tracking context | data/manual_conversions.csv |
| P1_funnel_completeness | lead_submit | post-week0-post-001-cta-v1-diagnostic | content_variant | lead_submit aggregate count | data/manual_conversions.csv |
| P1_funnel_completeness | deal | post-week0-post-001-cta-v1-diagnostic | content_variant | deal aggregate count | data/manual_conversions.csv |
| P1_funnel_completeness | quality_flag | post-week0-post-001-cta-v1-diagnostic | content_variant | quality_flag count and optional aggregate quality_score | data/manual_conversions.csv |
| P1_funnel_completeness | link_click | post-week0-post-002-cta-v2-audit | content_variant | link clicks by content_id / variant_id | data/funnel_aggregates.csv |
| P0_sample_gate | page_view | post-week0-post-002-cta-v2-audit | content_variant | page_view count by asset_id / content_id / variant_id | data/funnel_aggregates.csv |
| P0_sample_gate | cta_click | post-week0-post-002-cta-v2-audit | content_variant | cta_click count by asset_id / content_id / variant_id | data/funnel_aggregates.csv |
| P0_sample_gate | line_add | post-week0-post-002-cta-v2-audit | content_variant | line_add aggregate count by tracking context | data/manual_conversions.csv |
| P1_funnel_completeness | lead_submit | post-week0-post-002-cta-v2-audit | content_variant | lead_submit aggregate count | data/manual_conversions.csv |
| P1_funnel_completeness | deal | post-week0-post-002-cta-v2-audit | content_variant | deal aggregate count | data/manual_conversions.csv |
| P1_funnel_completeness | quality_flag | post-week0-post-002-cta-v2-audit | content_variant | quality_flag count and optional aggregate quality_score | data/manual_conversions.csv |
| P1_funnel_completeness | link_click | post-week0-post-003-cta-v3-sample | content_variant | link clicks by content_id / variant_id | data/funnel_aggregates.csv |
| P0_sample_gate | page_view | post-week0-post-003-cta-v3-sample | content_variant | page_view count by asset_id / content_id / variant_id | data/funnel_aggregates.csv |
| P0_sample_gate | cta_click | post-week0-post-003-cta-v3-sample | content_variant | cta_click count by asset_id / content_id / variant_id | data/funnel_aggregates.csv |
| P0_sample_gate | line_add | post-week0-post-003-cta-v3-sample | content_variant | line_add aggregate count by tracking context | data/manual_conversions.csv |
| P1_funnel_completeness | lead_submit | post-week0-post-003-cta-v3-sample | content_variant | lead_submit aggregate count | data/manual_conversions.csv |
| P1_funnel_completeness | deal | post-week0-post-003-cta-v3-sample | content_variant | deal aggregate count | data/manual_conversions.csv |
| P1_funnel_completeness | quality_flag | post-week0-post-003-cta-v3-sample | content_variant | quality_flag count and optional aggregate quality_score | data/manual_conversions.csv |

## Gated Links

| link_id | role | human_gate |
|---|---|---|
| ab-ab-week0-cta-text-001 | ab_small_traffic | Do not use this A/B router in public traffic until owner confirms champion URL, 10% challenger allocation, duration, and rollback. |

## Rules

- Fill aggregate counts only.
- Do not include phone, email, LINE user ID, customer name, chat text, payment data, private notes, order IDs, or refund details.
- Evidence refs should be local screenshot/export paths or short source labels.
- Do not copy owner-preview CSVs into live input filenames until the compiled report is reviewed.
- Do not run any apply command until real_data_intake_plan.md is reviewed.
