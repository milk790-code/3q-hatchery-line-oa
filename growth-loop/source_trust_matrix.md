# Source Trust Matrix

BLUF: waiting_for_trusted_scoring_input. Collect owner-reviewed P0 aggregate counts; do not score local D1 smoke rows.

- Trusted scoring sources: 0
- Sample-gate-ready sources: 0
- Real event rows: 0
- P0 pending rows: 18
- Sample threshold met: no
- Scoring allowed now: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Matrix

| source | status | rows | scoring input | sample-gate input | trust level | next action |
|---|---:|---:|---|---|---|---|
| real_lp_events_jsonl | empty_clean_input | 0 | no | no | trusted_schema_empty_or_ready | Collect owner-reviewed aggregate counts or approved remote D1 export first. |
| local_d1_export | review_only_local_smoke_export | 0 | no | no | local_review_only | Do not score local D1 smoke rows; keep as Worker smoke evidence only. |
| funnel_aggregate_preview | full_funnel_preview | 48 | no | no | preview_only | Owner review is required before any local apply command can append real events. |
| manual_conversion_preview | preview | 10 | no | no | preview_only | Keep LINE add / lead / deal aggregates preview-only until owner review. |
| line_oa_account_metrics_observation | account_wide_non_attributable | 0 | no | no | diagnostic_account_total_only | Do not allocate account-wide totals to Growth Loop variants; require tracking-context aggregates for scoring. |
| source_capture_owner_preview | waiting_for_filled_counts | 0 | no | no | waiting_for_filled_counts | Use real-data intake preview next; do not create live CSVs from this matrix. |
| next_p0_owner_intake | waiting_for_next_p0_owner_download | 0 | no | no | waiting_for_owner_download | Finish focused P0 counts, then run the post-fill local check. |
| owner_data_preflight | waiting_for_owner_preview_rows | 0 | no | no | preview_sample_gate_not_ready | Do not rotate champion; collect owner-reviewed aggregate counts first. |

## Red Lines

- No formal posting.
- No primary link change.
- No challenger promotion.
- No LINE push.
- No ECPay/payment/refund action.
- No customer-data mutation.
- No production deploy.
- No deletion.
