# Manual Publish Brief

BLUF: This selected packet is copy-ready for local review, but public posting is blocked until the tracking URL / Worker gate is owner-approved.

Generated: 2026-07-10T21:45:59.846Z
Mode: manual_publish_brief_local_only
Status: prepared_but_blocked_public_tracking_url
Round: week0-cta-text
Changed variable: cta_text
Selected packet: manual-publish-01-week0-post-001-cta-v1-diagnostic
Selected content: week0-post-001 / cta-v1-diagnostic

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

## Public Link Gate

- Tracking URL public-ready: no
- Formal publish ready: no
- Gate reason: selected tracking URL is local-only or missing; do not place it in public traffic

## Selected Caption

頁面有流量但沒人加 LINE，通常不是你不會賣，而是 hook、offer、視覺主張、CTA 有一段斷掉。這輪我只測 CTA，不動主連結、不碰客戶資料。想先知道漏在哪，先走 48h 成交診斷。

## Tracking URL

`http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v1-diagnostic&content_id=week0-post-001`

## LINE Inbound Handoff

- Inbound only: yes
- Manual reply only: yes
- Aggregate-only local recording: yes
- First reply: 我先幫你抓漏斗斷點。你不用重做整站，先回覆目前最像哪一段卡住：有點擊沒進 LINE / 進 LINE 不留資 / 留資不成交 / 還不確定。
- Qualification reply: 收到。我會用 48h 成交診斷看三件事：入口、CTA、LINE 後續。請用選項回：在地服務 / 電商 / 課程顧問 / B2B / 其他，還有近 7 天點擊量大概 0-99 / 100-499 / 500+ / 不確定。

## Capture After Owner Publish

- Sample-gate rows: 3
- North Star / quality rows: 7
- Required sample events: page_view, cta_click, line_add
- North Star events: link_click, line_add, lead_submit, deal
- Evidence form: manual_publish_evidence_form.html
- Evidence intake: manual_publish_evidence.md

## Next Safe Actions

1. Review the selected caption and LINE handoff locally only.
1. Approve or prepare the public tracking URL / candidate Worker gate before any formal post.
1. After the owner manually publishes exactly one reviewed packet, fill manual_publish_evidence_form.html with non-sensitive evidence only.

## Blocked Actions

- formal_social_post
- schedule_social_post
- change_primary_social_or_bio_link
- promote_challenger_to_champion
- line_push_or_broadcast
- production_worker_deploy
- github_push_or_pr_creation
- customer_data_mutation
- ecpay_payment_refund_or_capture
- delete_data_or_retire_live_assets
