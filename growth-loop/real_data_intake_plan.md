# 3Q Growth Loop Real Data Intake Plan

BLUF: No real input CSV exists yet; the weekly loop is healthy but still waiting for aggregate data.

Generated: 2026-07-10T21:44:49.990Z
Mode: real_data_intake_plan
Status: no_real_input_files
External effect: no
data/lp_events.jsonl write performed: no
Real events unchanged: yes

## Input Status

| source | status | input exists | preview events | ready for owner apply | data write | evidence / next action |
|---|---|---|---:|---|---|---|
| funnel_aggregates | missing_input | no | 0 | no | no | Copy data/funnel_aggregates.example.csv to data/funnel_aggregates.csv and fill aggregate counts from the latest reviewed analytics export. |
| manual_conversions | missing_input | no | 0 | no | no | Copy data/manual_conversions.example.csv to data/manual_conversions.csv and fill aggregate counts from reviewed LINE/customer-service outcomes. |

## Owner Apply Commands

No owner apply commands are ready because no reviewed real input CSV exists yet.

## Rules

- Preview files are not scored.
- Apply commands are local-only but change data/lp_events.jsonl, so owner review is required.
- CSVs must be aggregate-only and must not include phone, email, LINE user ID, customer name, address, payment fields, private notes, messages, or conversation text.
- Copied example/template CSVs are blocked by the importer even when --confirm-real-data is present.
- After apply, run event quality and regenerate Week 0 artifacts before interpreting winners.
