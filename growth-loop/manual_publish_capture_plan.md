# Manual Publish Capture Plan

BLUF: This plan starts after the owner manually publishes one approved packet. It tells the owner what aggregate counts to collect at Day 3 and Day 7 so the local weekly loop can score the funnel. It does not publish, schedule, change links, push LINE, deploy, create GitHub activity, mutate customer data, process payments, delete data, or write data/lp_events.jsonl.

Generated: 2026-07-10T21:45:58.864Z
Mode: manual_publish_capture_plan_local_only
Status: waiting_for_owner_manual_publish_and_counts
Round: week0-cta-text
Changed variable: cta_text
Packets: 3
Sample-gate rows: 9
North Star capture rows: 21
Owner sample gate status: waiting_for_owner_sample_gate_counts
Sample threshold met: no

External effect: no
Formal post performed: no
LINE push performed: no
Public link change performed: no
Production deploy performed: no
GitHub push or PR performed: no
Customer data mutation performed: no
Payment action performed: no
Delete action performed: no
data/lp_events.jsonl write performed: no

## Thresholds

| threshold | value |
|---|---:|
| min_visits | 100 |
| min_cta_clicks | 20 |
| min_line_adds | 5 |
| min_test_days | 3 |
| preferred_test_days | 7 |

## manual-publish-01-week0-post-001-cta-v1-diagnostic

Content: week0-post-001
Variant: cta-v1-diagnostic
CTA: 加 LINE 領 48h 成交診斷
Publish status: waiting_for_owner_manual_publish
Tracking URL: `http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v1-diagnostic&content_id=week0-post-001`

### Observation Checkpoints

| checkpoint | status | owner action |
|---|---|---|
| day_0 | owner_manual_publish_gate | If approved, manually publish exactly one packet and record the surface plus timestamp outside this runner. |
| day_3 | minimum_test_day_check | Collect aggregate page_view, cta_click, and line_add counts for this packet only. |
| day_7 | preferred_test_window_check | Refresh aggregate counts, then run the local owner sample-gate and North Star checks. |

### Sample Gate Required Rows

| event | source | target file | worksheet row | PII rule |
|---|---|---|---:|---|
| page_view | Landing analytics aggregate | data/funnel_aggregates.csv | 11 | Do not paste IP, User-Agent, session rows, or visitor identifiers. |
| cta_click | Landing analytics aggregate | data/funnel_aggregates.csv | 12 | Do not paste IP, User-Agent, session rows, or visitor identifiers. |
| line_add | LINE OA aggregate | data/manual_conversions.csv | 13 | Do not paste LINE user IDs, names, chat text, notes, or customer rows. |

### North Star / Quality Rows

| event | source | target file | aggregate only | customer data allowed |
|---|---|---|---|---|
| link_click | Tracking redirect aggregate | data/funnel_aggregates.csv | yes | no |
| page_view | Landing analytics aggregate | data/funnel_aggregates.csv | yes | no |
| cta_click | Landing analytics aggregate | data/funnel_aggregates.csv | yes | no |
| line_add | LINE OA aggregate | data/manual_conversions.csv | yes | no |
| lead_submit | LINE OA aggregate | data/manual_conversions.csv | yes | no |
| deal | LINE OA aggregate | data/manual_conversions.csv | yes | no |
| quality_flag | LINE OA aggregate | data/manual_conversions.csv | yes | no |

## manual-publish-02-week0-post-002-cta-v2-audit

Content: week0-post-002
Variant: cta-v2-audit
CTA: 丟頁面，先抓成交斷點
Publish status: waiting_for_owner_manual_publish
Tracking URL: `http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v2-audit&content_id=week0-post-002`

### Observation Checkpoints

| checkpoint | status | owner action |
|---|---|---|
| day_0 | owner_manual_publish_gate | If approved, manually publish exactly one packet and record the surface plus timestamp outside this runner. |
| day_3 | minimum_test_day_check | Collect aggregate page_view, cta_click, and line_add counts for this packet only. |
| day_7 | preferred_test_window_check | Refresh aggregate counts, then run the local owner sample-gate and North Star checks. |

### Sample Gate Required Rows

| event | source | target file | worksheet row | PII rule |
|---|---|---|---:|---|
| page_view | Landing analytics aggregate | data/funnel_aggregates.csv | 14 | Do not paste IP, User-Agent, session rows, or visitor identifiers. |
| cta_click | Landing analytics aggregate | data/funnel_aggregates.csv | 15 | Do not paste IP, User-Agent, session rows, or visitor identifiers. |
| line_add | LINE OA aggregate | data/manual_conversions.csv | 16 | Do not paste LINE user IDs, names, chat text, notes, or customer rows. |

### North Star / Quality Rows

| event | source | target file | aggregate only | customer data allowed |
|---|---|---|---|---|
| link_click | Tracking redirect aggregate | data/funnel_aggregates.csv | yes | no |
| page_view | Landing analytics aggregate | data/funnel_aggregates.csv | yes | no |
| cta_click | Landing analytics aggregate | data/funnel_aggregates.csv | yes | no |
| line_add | LINE OA aggregate | data/manual_conversions.csv | yes | no |
| lead_submit | LINE OA aggregate | data/manual_conversions.csv | yes | no |
| deal | LINE OA aggregate | data/manual_conversions.csv | yes | no |
| quality_flag | LINE OA aggregate | data/manual_conversions.csv | yes | no |

## manual-publish-03-week0-post-003-cta-v3-sample

Content: week0-post-003
Variant: cta-v3-sample
CTA: 先拿一版可測 CTA
Publish status: waiting_for_owner_manual_publish
Tracking URL: `http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v3-sample&content_id=week0-post-003`

### Observation Checkpoints

| checkpoint | status | owner action |
|---|---|---|
| day_0 | owner_manual_publish_gate | If approved, manually publish exactly one packet and record the surface plus timestamp outside this runner. |
| day_3 | minimum_test_day_check | Collect aggregate page_view, cta_click, and line_add counts for this packet only. |
| day_7 | preferred_test_window_check | Refresh aggregate counts, then run the local owner sample-gate and North Star checks. |

### Sample Gate Required Rows

| event | source | target file | worksheet row | PII rule |
|---|---|---|---:|---|
| page_view | Landing analytics aggregate | data/funnel_aggregates.csv | 17 | Do not paste IP, User-Agent, session rows, or visitor identifiers. |
| cta_click | Landing analytics aggregate | data/funnel_aggregates.csv | 18 | Do not paste IP, User-Agent, session rows, or visitor identifiers. |
| line_add | LINE OA aggregate | data/manual_conversions.csv | 19 | Do not paste LINE user IDs, names, chat text, notes, or customer rows. |

### North Star / Quality Rows

| event | source | target file | aggregate only | customer data allowed |
|---|---|---|---|---|
| link_click | Tracking redirect aggregate | data/funnel_aggregates.csv | yes | no |
| page_view | Landing analytics aggregate | data/funnel_aggregates.csv | yes | no |
| cta_click | Landing analytics aggregate | data/funnel_aggregates.csv | yes | no |
| line_add | LINE OA aggregate | data/manual_conversions.csv | yes | no |
| lead_submit | LINE OA aggregate | data/manual_conversions.csv | yes | no |
| deal | LINE OA aggregate | data/manual_conversions.csv | yes | no |
| quality_flag | LINE OA aggregate | data/manual_conversions.csv | yes | no |

