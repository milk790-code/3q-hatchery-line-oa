# 3Q Growth Loop Source Capture Compile Fixture Report

BLUF: Source capture compile fixtures verify valid filled ledgers, empty templates, partial blank-count warnings, PII rejection, bad date rejection, and invalid target-file rejection. They use temporary files only and never write live CSVs or data/lp_events.jsonl.

Generated: 2026-07-10T21:44:48.218Z
Mode: source_capture_compile_fixture_dry_run
Status: pass
Scenarios: 7
Temp dir: /var/folders/y1/xtffpl7x0mx416zw23bkp8n40000gn/T/3q-growth-loop-source-compile-fixtures-MRMDZO
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

| scenario | result | exit | compiler status | issues | data write |
|---|---|---:|---|---:|---|
| valid_filled_compile_preview | pass | 0 | owner_preview_ready | 0 | no |
| empty_template_waits_for_counts | pass | 0 | waiting_for_filled_counts | 0 | no |
| partial_blank_count_warns_not_blocks | pass | 0 | waiting_for_filled_counts | 0 | no |
| blocked_missing_pii_checked | pass | 1 | blocked_invalid_filled_ledger | 1 | no |
| blocked_sensitive_evidence | pass | 1 | blocked_invalid_filled_ledger | 1 | no |
| blocked_invalid_date | pass | 1 | blocked_invalid_filled_ledger | 1 | no |
| blocked_invalid_target_file | pass | 1 | blocked_invalid_filled_ledger | 1 | no |
