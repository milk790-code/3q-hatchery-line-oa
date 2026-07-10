# 3Q Growth Loop Next P0 Quick Capture Fixture Report

BLUF: next_p0_quick_capture_fixture_ok. This fixture verifies the quick rank-count adapter using temporary paths only.

Generated: 2026-07-10T21:45:09.277Z
Mode: next_p0_quick_capture_fixture_dry_run
Rows: 9
Scenarios: 9
Live project inputs created: no
Owner inbox write performed: no
data/lp_events.jsonl write performed: no
External effect: no

| scenario | result | exit | status | checks |
|---|---|---:|---|---:|
| waiting_without_counts | ok | 0 | waiting_for_quick_counts | 11/11 |
| valid_quick_counts_preview_ready | ok | 0 | quick_counts_preview_ready | 12/12 |
| labelled_quick_counts_preview_ready | ok | 0 | quick_counts_preview_ready | 12/12 |
| labelled_counts_file_preview_ready | ok | 0 | quick_counts_preview_ready | 12/12 |
| auto_paste_template_preview_ready | ok | 0 | quick_counts_preview_ready | 16/16 |
| partial_auto_paste_template_waiting | ok | 0 | partial_quick_counts_waiting | 17/17 |
| incomplete_quick_counts_blocked | ok | 0 | blocked_invalid_quick_counts | 11/11 |
| sensitive_evidence_blocked | ok | 0 | blocked_invalid_quick_counts | 11/11 |
| strict_sensitive_evidence_fails | ok | 1 | blocked_invalid_quick_counts | 11/11 |

## Safety Contract

- Temporary fixture paths only.
- No project inbox, live CSV, or real event writes.
- Labelled pasted counts such as champion.visits, champion.cta, and champion.line resolve to the correct focused rows.
- The paste-template output is generated for owner editing but does not create live inputs.
- A fully filled paste template can be auto-read into a preview CSV while preserving the owner-filled file.
- A partially filled paste template reports filled and missing ranks while preserving the owner-filled file and creating no preview.
- The labelled counts-file path resolves through the same aggregate-only preview contract.
- Sensitive-looking quick evidence is soft-blocked by default so weekly artifacts can continue, and `--strict` still fails fast for CI-style checks.
- The quick adapter only creates a preview CSV that must still pass next-p0:intake before any owner-confirmed staging.
