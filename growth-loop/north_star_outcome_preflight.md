# 3Q Growth Loop North Star Outcome Preflight

BLUF: waiting_for_north_star_outcome_counts. Create a reviewed working copy from data/source_capture/source_capture_ledger.fill-template.csv, fill the 24 P1 outcome rows, then rerun npm run north-star:outcome-preflight.

Generated: 2026-07-10T21:44:55.211Z
Mode: north_star_outcome_preflight_local_only
Input: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/data/source_capture/source_capture_ledger.fill-template.csv
Input kind: template
Owner-filled file exists: no
Ready for source compile: no
Expected outcome rows: 24
Filled outcome rows: 0
Pending outcome rows: 24
Partial outcome rows: 0
Invalid outcome rows: 0
Issue count: 0
Warning count: 0
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

## Scope

This preflight covers the P1 North Star outcome rows that complete the funnel after the P0 sample gate:

- link_click: denominator for every 100 clicks
- lead_submit: qualified lead aggregate
- deal: owner-confirmed conversion aggregate
- quality_flag: no-quality-regression guard

P0 page_view, cta_click, and line_add rows stay governed by the sample-gate preflight.

## Row Status

| row | state | event | tracking link | asset | content | variant | target | count |
|---:|---|---|---|---|---|---|---|---:|
| 2 | pending | link_click | track-champion-3q-line-v0 | champion-3q-line-v0 | 2026-06-29-champion | champion-3q-line-v0 | data/funnel_aggregates.csv |  |
| 6 | pending | lead_submit | track-champion-3q-line-v0 | champion-3q-line-v0 | 2026-06-29-champion | champion-3q-line-v0 | data/funnel_aggregates.csv |  |
| 7 | pending | deal | track-champion-3q-line-v0 | champion-3q-line-v0 | 2026-06-29-champion | champion-3q-line-v0 | data/funnel_aggregates.csv |  |
| 8 | pending | quality_flag | track-champion-3q-line-v0 | champion-3q-line-v0 | 2026-06-29-champion | champion-3q-line-v0 | data/funnel_aggregates.csv |  |
| 9 | pending | link_click | track-challenger-week0-cta-text-v1 | challenger-week0-cta-text-v1 | 2026-06-29-challenger | challenger-week0-cta-text-v1 | data/funnel_aggregates.csv |  |
| 13 | pending | lead_submit | track-challenger-week0-cta-text-v1 | challenger-week0-cta-text-v1 | 2026-06-29-challenger | challenger-week0-cta-text-v1 | data/manual_conversions.csv |  |
| 14 | pending | deal | track-challenger-week0-cta-text-v1 | challenger-week0-cta-text-v1 | 2026-06-29-challenger | challenger-week0-cta-text-v1 | data/manual_conversions.csv |  |
| 15 | pending | quality_flag | track-challenger-week0-cta-text-v1 | challenger-week0-cta-text-v1 | 2026-06-29-challenger | challenger-week0-cta-text-v1 | data/manual_conversions.csv |  |
| 16 | pending | link_click | track-challenger-week0-cta-text-v1-line | challenger-week0-cta-text-v1 | 2026-06-29-line-cta | challenger-week0-cta-text-v1-line | data/funnel_aggregates.csv |  |
| 20 | pending | lead_submit | track-challenger-week0-cta-text-v1-line | challenger-week0-cta-text-v1 | 2026-06-29-line-cta | challenger-week0-cta-text-v1-line | data/manual_conversions.csv |  |
| 21 | pending | deal | track-challenger-week0-cta-text-v1-line | challenger-week0-cta-text-v1 | 2026-06-29-line-cta | challenger-week0-cta-text-v1-line | data/manual_conversions.csv |  |
| 22 | pending | quality_flag | track-challenger-week0-cta-text-v1-line | challenger-week0-cta-text-v1 | 2026-06-29-line-cta | challenger-week0-cta-text-v1-line | data/manual_conversions.csv |  |
| 23 | pending | link_click | post-week0-post-001-cta-v1-diagnostic | challenger-week0-cta-text-v1 | week0-post-001 | cta-v1-diagnostic | data/funnel_aggregates.csv |  |
| 27 | pending | lead_submit | post-week0-post-001-cta-v1-diagnostic | challenger-week0-cta-text-v1 | week0-post-001 | cta-v1-diagnostic | data/manual_conversions.csv |  |
| 28 | pending | deal | post-week0-post-001-cta-v1-diagnostic | challenger-week0-cta-text-v1 | week0-post-001 | cta-v1-diagnostic | data/manual_conversions.csv |  |
| 29 | pending | quality_flag | post-week0-post-001-cta-v1-diagnostic | challenger-week0-cta-text-v1 | week0-post-001 | cta-v1-diagnostic | data/manual_conversions.csv |  |
| 30 | pending | link_click | post-week0-post-002-cta-v2-audit | challenger-week0-cta-text-v1 | week0-post-002 | cta-v2-audit | data/funnel_aggregates.csv |  |
| 34 | pending | lead_submit | post-week0-post-002-cta-v2-audit | challenger-week0-cta-text-v1 | week0-post-002 | cta-v2-audit | data/manual_conversions.csv |  |
| 35 | pending | deal | post-week0-post-002-cta-v2-audit | challenger-week0-cta-text-v1 | week0-post-002 | cta-v2-audit | data/manual_conversions.csv |  |
| 36 | pending | quality_flag | post-week0-post-002-cta-v2-audit | challenger-week0-cta-text-v1 | week0-post-002 | cta-v2-audit | data/manual_conversions.csv |  |
| 37 | pending | link_click | post-week0-post-003-cta-v3-sample | challenger-week0-cta-text-v1 | week0-post-003 | cta-v3-sample | data/funnel_aggregates.csv |  |
| 41 | pending | lead_submit | post-week0-post-003-cta-v3-sample | challenger-week0-cta-text-v1 | week0-post-003 | cta-v3-sample | data/manual_conversions.csv |  |
| 42 | pending | deal | post-week0-post-003-cta-v3-sample | challenger-week0-cta-text-v1 | week0-post-003 | cta-v3-sample | data/manual_conversions.csv |  |
| 43 | pending | quality_flag | post-week0-post-003-cta-v3-sample | challenger-week0-cta-text-v1 | week0-post-003 | cta-v3-sample | data/manual_conversions.csv |  |

## Ready Counts By Event Type

| event_type | aggregate count | ready rows |
|---|---:|---:|
| link_click | 0 | 0 |
| lead_submit | 0 | 0 |
| deal | 0 | 0 |
| quality_flag | 0 | 0 |

## Issues

| row | field | code | message |
|---:|---|---|---|
| - | - | - | none |

## Warnings

| row | field | code | message |
|---:|---|---|---|
| - | - | - | none |

## Recommended Commands

```zsh
open data_collection_progress.md
open line_inbound_playbook.md
npm run north-star:outcome-preflight
```

## Safety

- Aggregate counts only.
- Do not paste phone, email, LINE user ID, customer name, chat text, order ID, payment ID, refund data, or private notes.
- Production deploy performed: no
- Public link change performed: no
- GitHub push / PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer-data mutation performed: no
- Payment action performed: no
- Delete action performed: no
