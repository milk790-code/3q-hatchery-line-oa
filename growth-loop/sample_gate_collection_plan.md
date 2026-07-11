# 3Q Growth Loop Sample Gate Collection Plan

BLUF: Collect only the P0 sample-gate counts first: page views, CTA clicks, and LINE adds. This is the shortest safe path from Week 0 setup to a valid champion/challenger decision.

Generated: 2026-07-10T21:44:51.068Z
Mode: sample_gate_collection_plan
Status: waiting_for_sample_gate_counts
Week: 2026-06-29 to 2026-07-05
Changed variable: cta_text
P0 sample-gate tasks: 18
P0 links to inspect: 6
Owner fill path: data/source_capture/source_capture_ledger.filled.csv
Sample-gate fill template: data/source_capture/sample_gate_ledger.fill-template.csv
Sample-gate owner-filled path: data/source_capture/sample_gate_ledger.filled.csv
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

## Global Sample Gaps

- Visits: 0/100 gap=100
- CTA clicks: 0/20 gap=20
- LINE adds: 0/5 gap=5
- Test days: 0/3 preferred=7 gap=3

## P0 Event Summary

| event_type | tasks | current/target | global_gap | source_surface | target_live_file |
|---|---:|---:|---:|---|---|
| page_view | 6 | 0/100 | 100 | candidate Worker D1 / landing page analytics | data/funnel_aggregates.csv |
| cta_click | 6 | 0/20 | 20 | candidate Worker D1 / landing page analytics | data/funnel_aggregates.csv |
| line_add | 6 | 0/5 | 5 | LINE OA 管理後台 / inbound customer-service aggregate | data/manual_conversions.csv |

## Link Capture Order

| order | tracking_link_id | role | asset | content | variant | page_view | cta_click | line_add |
|---:|---|---|---|---|---|---|---|---|
| 1 | track-champion-3q-line-v0 | champion | champion-3q-line-v0 | 2026-06-29-champion | champion-3q-line-v0 | collect | collect | collect |
| 2 | track-challenger-week0-cta-text-v1 | challenger | challenger-week0-cta-text-v1 | 2026-06-29-challenger | challenger-week0-cta-text-v1 | collect | collect | collect |
| 3 | track-challenger-week0-cta-text-v1-line | line_cta | challenger-week0-cta-text-v1 | 2026-06-29-line-cta | challenger-week0-cta-text-v1-line | collect | collect | collect |
| 4 | post-week0-post-001-cta-v1-diagnostic | content_variant | challenger-week0-cta-text-v1 | week0-post-001 | cta-v1-diagnostic | collect | collect | collect |
| 5 | post-week0-post-002-cta-v2-audit | content_variant | challenger-week0-cta-text-v1 | week0-post-002 | cta-v2-audit | collect | collect | collect |
| 6 | post-week0-post-003-cta-v3-sample | content_variant | challenger-week0-cta-text-v1 | week0-post-003 | cta-v3-sample | collect | collect | collect |

## Immediate Actions

| action | status | command |
|---|---|---|
| open_sample_gate_plan | ready_local_review | `Open sample_gate_collection_plan.md and collect page_view / cta_click / line_add aggregate counts first.` |
| create_sample_gate_filled_ledger_copy | owner_local_review_required | `cp data/source_capture/sample_gate_ledger.fill-template.csv data/source_capture/sample_gate_ledger.filled.csv` |
| preview_sample_gate_ledger | ready_after_owner_counts | `npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled` |
| create_owner_filled_ledger_copy | owner_local_review_required | `cp data/source_capture/source_capture_ledger.fill-template.csv data/source_capture/source_capture_ledger.filled.csv` |
| fill_aggregate_counts | owner_manual_input_required | `Open data/source_capture/source_capture_ledger.filled.csv and fill aggregate_count plus evidence fields.` |

## Sample-Gate Fill Pack

- Template: data/source_capture/sample_gate_ledger.fill-template.csv
- Owner-filled path: data/source_capture/sample_gate_ledger.filled.csv
- Rows: 18
- Compile preview command: `npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled`

## Rules

- Use aggregate counts only.
- Do not paste phone, email, LINE user ID, customer name, chat text, payment data, private notes, order IDs, or refund details.
- Do not rotate a new winner until visits, CTA clicks, LINE adds, and minimum test days pass their gates.
- Do not promote a challenger unless line_add_rate beats champion by 1.15x, sample_threshold_met=true, and no_quality_regression=true.
- This plan never creates live CSVs, appends data/lp_events.jsonl, deploys, posts, pushes LINE, changes public links, mutates customer data, touches payments, or deletes data.
