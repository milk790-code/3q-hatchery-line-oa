# 3Q Growth Loop Full P0 Batch Preflight

BLUF: waiting_for_full_p0_counts. Create a reviewed working copy from data/source_capture/sample_gate_ledger.fill-template.csv, fill all 18 aggregate rows, then rerun npm run sample-gate:batch-preflight.

Generated: 2026-07-10T21:45:45.438Z
Mode: sample_gate_batch_preflight_local_only
Input: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/data/source_capture/sample_gate_ledger.fill-template.csv
Input kind: template
Owner-filled file exists: no
Ready for source compile: no
Expected P0 rows: 18
Filled P0 rows: 0
Pending P0 rows: 18
Partial P0 rows: 0
Invalid P0 rows: 0
Issue count: 0
Warning count: 0
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

## Row Status

| row | state | tracking link | event | asset | content | variant | count |
|---:|---|---|---|---|---|---|---:|
| 2 | pending | track-champion-3q-line-v0 | page_view | champion-3q-line-v0 | 2026-06-29-champion | champion-3q-line-v0 |  |
| 3 | pending | track-champion-3q-line-v0 | cta_click | champion-3q-line-v0 | 2026-06-29-champion | champion-3q-line-v0 |  |
| 4 | pending | track-champion-3q-line-v0 | line_add | champion-3q-line-v0 | 2026-06-29-champion | champion-3q-line-v0 |  |
| 5 | pending | track-challenger-week0-cta-text-v1 | page_view | challenger-week0-cta-text-v1 | 2026-06-29-challenger | challenger-week0-cta-text-v1 |  |
| 6 | pending | track-challenger-week0-cta-text-v1 | cta_click | challenger-week0-cta-text-v1 | 2026-06-29-challenger | challenger-week0-cta-text-v1 |  |
| 7 | pending | track-challenger-week0-cta-text-v1 | line_add | challenger-week0-cta-text-v1 | 2026-06-29-challenger | challenger-week0-cta-text-v1 |  |
| 8 | pending | track-challenger-week0-cta-text-v1-line | page_view | challenger-week0-cta-text-v1 | 2026-06-29-line-cta | challenger-week0-cta-text-v1-line |  |
| 9 | pending | track-challenger-week0-cta-text-v1-line | cta_click | challenger-week0-cta-text-v1 | 2026-06-29-line-cta | challenger-week0-cta-text-v1-line |  |
| 10 | pending | track-challenger-week0-cta-text-v1-line | line_add | challenger-week0-cta-text-v1 | 2026-06-29-line-cta | challenger-week0-cta-text-v1-line |  |
| 11 | pending | post-week0-post-001-cta-v1-diagnostic | page_view | challenger-week0-cta-text-v1 | week0-post-001 | cta-v1-diagnostic |  |
| 12 | pending | post-week0-post-001-cta-v1-diagnostic | cta_click | challenger-week0-cta-text-v1 | week0-post-001 | cta-v1-diagnostic |  |
| 13 | pending | post-week0-post-001-cta-v1-diagnostic | line_add | challenger-week0-cta-text-v1 | week0-post-001 | cta-v1-diagnostic |  |
| 14 | pending | post-week0-post-002-cta-v2-audit | page_view | challenger-week0-cta-text-v1 | week0-post-002 | cta-v2-audit |  |
| 15 | pending | post-week0-post-002-cta-v2-audit | cta_click | challenger-week0-cta-text-v1 | week0-post-002 | cta-v2-audit |  |
| 16 | pending | post-week0-post-002-cta-v2-audit | line_add | challenger-week0-cta-text-v1 | week0-post-002 | cta-v2-audit |  |
| 17 | pending | post-week0-post-003-cta-v3-sample | page_view | challenger-week0-cta-text-v1 | week0-post-003 | cta-v3-sample |  |
| 18 | pending | post-week0-post-003-cta-v3-sample | cta_click | challenger-week0-cta-text-v1 | week0-post-003 | cta-v3-sample |  |
| 19 | pending | post-week0-post-003-cta-v3-sample | line_add | challenger-week0-cta-text-v1 | week0-post-003 | cta-v3-sample |  |

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
open sample_gate_owner_worksheet.md
open sample_gate_owner_form.html
npm run sample-gate:batch-preflight
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
