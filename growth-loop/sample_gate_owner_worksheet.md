# 3Q Growth Loop Sample Gate Owner Worksheet

BLUF: Fill these 18 aggregate-only rows first. This is the shortest path from Week 0 setup to a valid sample gate, without changing public links, deploying production, pushing LINE, touching customer data, or writing data/lp_events.jsonl.

Generated: 2026-07-10T21:45:19.204Z
Mode: sample_gate_owner_worksheet
Status: waiting_for_owner_sample_gate_counts
Rows: 18
Links: 6
Owner-filled file exists: no
Owner sample gate status: waiting_for_owner_sample_gate_counts
Live input files created: no
data/lp_events.jsonl write performed: no
External effect: no

## Fast Fill Order

1. Make a reviewed working copy only after you are ready to fill counts:

```zsh
cp data/source_capture/sample_gate_ledger.fill-template.csv data/source_capture/sample_gate_ledger.filled.csv
```

2. Fill only these fields in `data/source_capture/sample_gate_ledger.filled.csv`:

| field | rule |
|---|---|
| capture_date | YYYY-MM-DD, the date the aggregate count was captured. |
| aggregate_count | Non-negative integer only. |
| evidence_ref | Local screenshot/export path or short report reference only; no customer identifiers. |
| reviewer | Owner/operator name or initials; no email/phone/customer identifier. |
| pii_checked | yes/true/checked/ok/1 only after confirming no PII was pasted. |

3. Preview the filled ledger. This creates owner-preview CSVs only:

```zsh
npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled
npm run owner:sample-gate
npm run north-star
```

## Source Groups

| group | event types | rows | links | source surface |
|---|---|---:|---:|---|
| Landing analytics aggregate | page_view, cta_click | 12 | 6 | candidate Worker D1 / landing page analytics |
| LINE OA aggregate | line_add | 6 | 6 | LINE OA 管理後台 / inbound customer-service aggregate |

## 18-Row Checklist

| CSV row | tracking link | event | asset | content | variant | source group |
|---:|---|---|---|---|---|---|
| 2 | track-champion-3q-line-v0 | page_view | champion-3q-line-v0 | 2026-06-29-champion | champion-3q-line-v0 | Landing analytics aggregate |
| 3 | track-champion-3q-line-v0 | cta_click | champion-3q-line-v0 | 2026-06-29-champion | champion-3q-line-v0 | Landing analytics aggregate |
| 4 | track-champion-3q-line-v0 | line_add | champion-3q-line-v0 | 2026-06-29-champion | champion-3q-line-v0 | LINE OA aggregate |
| 5 | track-challenger-week0-cta-text-v1 | page_view | challenger-week0-cta-text-v1 | 2026-06-29-challenger | challenger-week0-cta-text-v1 | Landing analytics aggregate |
| 6 | track-challenger-week0-cta-text-v1 | cta_click | challenger-week0-cta-text-v1 | 2026-06-29-challenger | challenger-week0-cta-text-v1 | Landing analytics aggregate |
| 7 | track-challenger-week0-cta-text-v1 | line_add | challenger-week0-cta-text-v1 | 2026-06-29-challenger | challenger-week0-cta-text-v1 | LINE OA aggregate |
| 8 | track-challenger-week0-cta-text-v1-line | page_view | challenger-week0-cta-text-v1 | 2026-06-29-line-cta | challenger-week0-cta-text-v1-line | Landing analytics aggregate |
| 9 | track-challenger-week0-cta-text-v1-line | cta_click | challenger-week0-cta-text-v1 | 2026-06-29-line-cta | challenger-week0-cta-text-v1-line | Landing analytics aggregate |
| 10 | track-challenger-week0-cta-text-v1-line | line_add | challenger-week0-cta-text-v1 | 2026-06-29-line-cta | challenger-week0-cta-text-v1-line | LINE OA aggregate |
| 11 | post-week0-post-001-cta-v1-diagnostic | page_view | challenger-week0-cta-text-v1 | week0-post-001 | cta-v1-diagnostic | Landing analytics aggregate |
| 12 | post-week0-post-001-cta-v1-diagnostic | cta_click | challenger-week0-cta-text-v1 | week0-post-001 | cta-v1-diagnostic | Landing analytics aggregate |
| 13 | post-week0-post-001-cta-v1-diagnostic | line_add | challenger-week0-cta-text-v1 | week0-post-001 | cta-v1-diagnostic | LINE OA aggregate |
| 14 | post-week0-post-002-cta-v2-audit | page_view | challenger-week0-cta-text-v1 | week0-post-002 | cta-v2-audit | Landing analytics aggregate |
| 15 | post-week0-post-002-cta-v2-audit | cta_click | challenger-week0-cta-text-v1 | week0-post-002 | cta-v2-audit | Landing analytics aggregate |
| 16 | post-week0-post-002-cta-v2-audit | line_add | challenger-week0-cta-text-v1 | week0-post-002 | cta-v2-audit | LINE OA aggregate |
| 17 | post-week0-post-003-cta-v3-sample | page_view | challenger-week0-cta-text-v1 | week0-post-003 | cta-v3-sample | Landing analytics aggregate |
| 18 | post-week0-post-003-cta-v3-sample | cta_click | challenger-week0-cta-text-v1 | week0-post-003 | cta-v3-sample | Landing analytics aggregate |
| 19 | post-week0-post-003-cta-v3-sample | line_add | challenger-week0-cta-text-v1 | week0-post-003 | cta-v3-sample | LINE OA aggregate |

## Hard Rules

- Use aggregate counts only.
- Evidence refs must be local screenshot/export references, not raw customer rows.
- Do not paste phone, email, LINE user ID, customer name, chat text, payment data, order IDs, refund details, or private notes.
- Do not create `data/funnel_aggregates.csv`, `data/manual_conversions.csv`, or append `data/lp_events.jsonl` from this worksheet.
- Sample-insufficient rounds keep the current champion and current variable.
