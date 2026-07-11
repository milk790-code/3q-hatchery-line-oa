# 3Q Growth Loop Source Capture Compile Preview

BLUF: This is an owner-preview compiler for filled aggregate source-capture ledgers. It creates reviewed CSV candidates only; it does not create live input files, score rows, append data/lp_events.jsonl, deploy, post, push LINE, touch customer data, process payments, or delete data.

Generated: 2026-07-10T21:44:41.897Z
Mode: source_capture_compile_preview
Status: waiting_for_filled_counts
Input kind: sample_gate_template
Input: data/source_capture/sample_gate_ledger.fill-template.csv
Filled rows: 0
Empty rows: 18
Funnel preview rows: 0
Manual preview rows: 0
Issues: 0
Warnings: 0
Live input files created: no
data/lp_events.jsonl write performed: no
External effect: no

## Preview Artifacts

- Funnel preview: data/source_capture/sample_gate_compile_probe/funnel_aggregates.owner-preview.csv
- Manual preview: data/source_capture/sample_gate_compile_probe/manual_conversions.owner-preview.csv
- Status: data/sample_gate_ledger_compile_probe_status.json
- Report: sample_gate_ledger_compile_probe.md

## If Counts Are Missing

Copy the template to the owner-filled path, fill aggregate counts and evidence, then rerun:

```zsh
cp data/source_capture/source_capture_ledger.fill-template.csv data/source_capture/source_capture_ledger.filled.csv
npm run source:compile
```

Fill only aggregate_count, capture_date, evidence_ref, reviewer, and pii_checked. Keep customer names, phone, email, LINE user IDs, chat text, payment data, order IDs, refund data, and private notes out of the ledger.

For `quality_flag` rows only, `quality_score` may be filled as an aggregate score from 0 to 1. Use `0` for low-quality/spam flags and `1` for normal-quality flags when the quality guard needs to be tested.

## Owner Review Rule

The compiled files are owner-preview only. Copy them to live CSV names only after review:

- data/source_capture/sample_gate_compile_probe/funnel_aggregates.owner-preview.csv -> data/funnel_aggregates.csv
- data/source_capture/sample_gate_compile_probe/manual_conversions.owner-preview.csv -> data/manual_conversions.csv

Then run `npm run real-data:intake` before any local apply.

## Issues

| row | field | message |
|---|---|---|
| none | none | none |

## Warnings

| row | field | message |
|---|---|---|
| none | none | none |
