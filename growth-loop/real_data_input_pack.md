# 3Q Growth Loop Real Data Input Pack

BLUF: Template-only input pack is ready. It reduces the Week 0 real-data handoff to filling aggregate counts, but it does not create live input files, score rows, append data/lp_events.jsonl, publish, deploy, push LINE, mutate customer data, touch payment, or delete anything.

Generated: 2026-07-10T21:44:14.154Z
Mode: real_data_input_pack
Status: template_ready
Week: 2026-07-06 to 2026-07-12
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no
Real events unchanged: yes

## Templates

| source | fill template | live target after owner fill | rows | event types |
|---|---|---|---:|---|
| funnel_aggregates | data/real_data_input_pack/funnel_aggregates.fill-template.csv | data/funnel_aggregates.csv | 42 | link_click, page_view, cta_click, line_add, lead_submit, deal, quality_flag |
| manual_conversions | data/real_data_input_pack/manual_conversions.fill-template.csv | data/manual_conversions.csv | 20 | line_add, lead_submit, deal, quality_flag |

## Live Input Status

| source | live target | exists now |
|---|---|---|
| funnel_aggregates | data/funnel_aggregates.csv | no |
| manual_conversions | data/manual_conversions.csv | no |

## After Filling Counts

```zsh
cp data/real_data_input_pack/funnel_aggregates.fill-template.csv data/funnel_aggregates.csv
cp data/real_data_input_pack/manual_conversions.fill-template.csv data/manual_conversions.csv
npm run real-data:intake
npm run event:quality
npm run week0
```

## Rules

- Fill only aggregate counts. Never paste customer-level rows.
- Leave phone, email, LINE user ID, customer name, address, payment fields, private notes, messages, and conversation text out of every CSV.
- Blank count cells are intentional; importers reject them until reviewed numbers are filled.
- After copying into the live target, run the intake preview first. Apply remains owner-gated.
