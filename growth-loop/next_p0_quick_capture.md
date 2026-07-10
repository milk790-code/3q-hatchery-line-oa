# 3Q Growth Loop Next P0 Quick Capture

BLUF: waiting_for_quick_counts. This local adapter turns pasted aggregate rank counts into the same focused owner-download CSV contract used by next-p0:intake.

Generated: 2026-07-10T21:45:04.133Z
Mode: next_p0_quick_capture
Status: waiting_for_quick_counts
Expected rows: 9
Quick counts supplied: 0
Filled ranks: 0/9
Missing ranks: 1, 2, 3, 4, 5, 6, 7, 8, 9
Template: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/data/next_p0_quick_capture/next_p0_owner_inputs.quick-template.csv
Paste template: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt
Paste template preserved: no
Filled preview: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/data/next_p0_quick_capture/next_p0_owner_inputs.quick-filled.preview.csv
Filled preview created: no
Counts source: none
Auto counts file used: no
Partial auto counts: no
Partial waiting: no
Owner inbox write performed: no
Live input files created: no
data/lp_events.jsonl write performed: no
External effect: no

## Accepted Formats

- `--counts=1=100,2=20,3=5`
- `--counts='1:100;2:20;3:5'`
- `--counts='champion.visits=100;champion.cta=20;champion.line=5'`
- `--counts='track-champion-3q-line-v0.page_view=100;track-champion-3q-line-v0.cta_click=20'`
- `--counts-file=data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt` after replacing metadata placeholders and every `<count>`
- Auto-read `data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt` after metadata and all counts are complete; partial owner edits are preserved.

Required with counts: `--capture-date=YYYY-MM-DD --evidence-ref=<aggregate_ref> --reviewer=<alias> --pii-checked=yes`, or the same metadata lines inside the paste template.

## Rows

| rank | role | tracking link | event type | target live file |
|---:|---|---|---|---|
| 1 | champion | track-champion-3q-line-v0 | page_view | data/funnel_aggregates.csv |
| 2 | champion | track-champion-3q-line-v0 | cta_click | data/funnel_aggregates.csv |
| 3 | champion | track-champion-3q-line-v0 | line_add | data/manual_conversions.csv |
| 4 | challenger | track-challenger-week0-cta-text-v1 | page_view | data/funnel_aggregates.csv |
| 5 | challenger | track-challenger-week0-cta-text-v1 | cta_click | data/funnel_aggregates.csv |
| 6 | challenger | track-challenger-week0-cta-text-v1 | line_add | data/manual_conversions.csv |
| 7 | line_cta | track-challenger-week0-cta-text-v1-line | page_view | data/funnel_aggregates.csv |
| 8 | line_cta | track-challenger-week0-cta-text-v1-line | cta_click | data/funnel_aggregates.csv |
| 9 | line_cta | track-challenger-week0-cta-text-v1-line | line_add | data/manual_conversions.csv |

## Issues

| field | message |
|---|---|
| - | none |

## Next Safe Action

Provide aggregate counts with --counts plus --capture-date, --evidence-ref, --reviewer, and --pii-checked=yes; fill the paste template completely for weekly auto-read; or use next_p0_owner_form.html.
