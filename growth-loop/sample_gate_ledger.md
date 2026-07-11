# 3Q Growth Loop Sample Gate Ledger

BLUF: This is the 18-row owner fill pack for the first sample gate. It keeps only page_view, cta_click, and line_add rows so the owner can collect the minimum viable counts before any champion/challenger decision.

Generated: 2026-07-10T21:44:41.023Z
Mode: sample_gate_ledger_pack
Status: sample_gate_template_ready
Week: 2026-06-29 to 2026-07-05
Rows: 18
Links: 6
Template: data/source_capture/sample_gate_ledger.fill-template.csv
Owner-filled path: data/source_capture/sample_gate_ledger.filled.csv
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

## Event Rows

| event_type | rows | target_live_file |
|---|---:|---|
| page_view | 6 | data/funnel_aggregates.csv |
| cta_click | 6 | data/funnel_aggregates.csv |
| line_add | 6 | data/funnel_aggregates.csv, data/manual_conversions.csv |

## Link Rows

| order | tracking_link_id | asset_id | content_id | variant_id |
|---:|---|---|---|---|
| 1 | track-champion-3q-line-v0 | champion-3q-line-v0 | 2026-06-29-champion | champion-3q-line-v0 |
| 2 | track-challenger-week0-cta-text-v1 | challenger-week0-cta-text-v1 | 2026-06-29-challenger | challenger-week0-cta-text-v1 |
| 3 | track-challenger-week0-cta-text-v1-line | challenger-week0-cta-text-v1 | 2026-06-29-line-cta | challenger-week0-cta-text-v1-line |
| 4 | post-week0-post-001-cta-v1-diagnostic | challenger-week0-cta-text-v1 | week0-post-001 | cta-v1-diagnostic |
| 5 | post-week0-post-002-cta-v2-audit | challenger-week0-cta-text-v1 | week0-post-002 | cta-v2-audit |
| 6 | post-week0-post-003-cta-v3-sample | challenger-week0-cta-text-v1 | week0-post-003 | cta-v3-sample |

## Owner Flow

```zsh
cp data/source_capture/sample_gate_ledger.fill-template.csv data/source_capture/sample_gate_ledger.filled.csv
# Fill aggregate_count, capture_date, evidence_ref, reviewer, and pii_checked only.
npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled
```

Keep customer names, phone, email, LINE user IDs, chat text, payment data, order IDs, refund data, and private notes out of the ledger. The compile command creates owner-preview CSVs only; it does not create live input files or append data/lp_events.jsonl.
