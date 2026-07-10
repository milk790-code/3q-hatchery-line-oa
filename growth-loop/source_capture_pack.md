# 3Q Growth Loop Source Capture Pack

BLUF: The local engine can score safely, but it still needs reviewed aggregate source counts. This pack tells the owner exactly which aggregate metric to collect, where it goes, and what evidence is acceptable without customer data.

Generated: 2026-07-10T21:44:41.023Z
Mode: source_capture_pack
Status: waiting_for_owner_aggregate_capture
Week: 2026-06-29 to 2026-07-05
Real event rows: 0
Missing stages: 7
Tracking links: 7
Importable links: 6
Ledger rows: 42
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

## Source-To-Template Matrix

| event_type | source surface | aggregate metric | target fill template |
|---|---|---|---|
| link_click | 社群平台連結點擊報表 / remote D1 link_click | link clicks by content_id / variant_id | data/real_data_input_pack/funnel_aggregates.fill-template.csv |
| page_view | candidate Worker D1 / landing page analytics | page_view count by asset_id / content_id / variant_id | data/real_data_input_pack/funnel_aggregates.fill-template.csv |
| cta_click | candidate Worker D1 / landing page analytics | cta_click count by asset_id / content_id / variant_id | data/real_data_input_pack/funnel_aggregates.fill-template.csv |
| line_add | LINE OA 管理後台 / inbound customer-service aggregate | line_add aggregate count by tracking context | data/real_data_input_pack/manual_conversions.fill-template.csv |
| lead_submit | LINE 客服手動分桶 / lead qualification aggregate | lead_submit aggregate count | data/real_data_input_pack/manual_conversions.fill-template.csv |
| deal | owner-confirmed aggregate deal log | deal aggregate count | data/real_data_input_pack/manual_conversions.fill-template.csv |
| quality_flag | LINE 客服手動分桶 / quality aggregate | quality_flag count and optional aggregate quality_score | data/real_data_input_pack/manual_conversions.fill-template.csv |

## Tracking Link Coverage

| link_id | role | content_id | variant_id | importable now |
|---|---|---|---|---|
| track-champion-3q-line-v0 | champion | 2026-06-29-champion | champion-3q-line-v0 | yes |
| track-challenger-week0-cta-text-v1 | challenger | 2026-06-29-challenger | challenger-week0-cta-text-v1 | yes |
| track-challenger-week0-cta-text-v1-line | line_cta | 2026-06-29-line-cta | challenger-week0-cta-text-v1-line | yes |
| post-week0-post-001-cta-v1-diagnostic | content_variant | week0-post-001 | cta-v1-diagnostic | yes |
| post-week0-post-002-cta-v2-audit | content_variant | week0-post-002 | cta-v2-audit | yes |
| post-week0-post-003-cta-v3-sample | content_variant | week0-post-003 | cta-v3-sample | yes |
| ab-ab-week0-cta-text-001 | ab_small_traffic | 2026-06-29-ab-router | n/a | gate |

## A/B Router Gates

| link_id | status | note |
|---|---|---|
| ab-ab-week0-cta-text-001 | owner_gate_before_public_traffic | Do not place this A/B router in public traffic until owner approves champion URL, candidate Worker production deploy, test duration, and rollback. |

## Files To Use

- Ledger fill template: data/source_capture/source_capture_ledger.fill-template.csv
- Sample-gate fill template: data/source_capture/sample_gate_ledger.fill-template.csv
- Sample-gate owner-filled path: data/source_capture/sample_gate_ledger.filled.csv
- Sample-gate report: sample_gate_ledger.md
- Owner-filled ledger path: data/source_capture/source_capture_ledger.filled.csv
- Machine checklist: data/source_capture/source_capture_checklist.json
- Compile preview report: source_capture_compile_report.md
- Compile preview CSVs: data/source_capture/compiled/*.owner-preview.csv
- Funnel fill template: data/real_data_input_pack/funnel_aggregates.fill-template.csv
- Manual conversion fill template: data/real_data_input_pack/manual_conversions.fill-template.csv

## Owner Capture Rules

- Do not fill the template directly; the weekly runner regenerates it. Copy it to data/source_capture/source_capture_ledger.filled.csv first.
- For the first sample gate, copy data/source_capture/sample_gate_ledger.fill-template.csv to data/source_capture/sample_gate_ledger.filled.csv and fill only page_view, cta_click, and line_add counts.
- Fill aggregate counts only.
- Use local screenshot/export paths as evidence references; do not paste raw customer rows.
- Keep phone, email, LINE user ID, customer name, chat text, payment data, private notes, and order/refund details out of every file.
- After counts are filled, run `npm run source:compile` and review the owner-preview CSVs before copying anything to live CSV names.
- To preview only the sample-gate ledger, run `npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled`.
- After owner review, copy compiled owner-preview CSVs to live CSVs, run `npm run real-data:intake`, then review before any apply.
