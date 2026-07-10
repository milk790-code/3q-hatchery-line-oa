# Manual Publish Packet

BLUF: These are draft-only publish packets for owner review. They prepare copy, tracking URLs, candidate landing targets, and LINE inbound handoff notes, but they do not publish, schedule, deploy, push LINE, change links, mutate customer data, process payments, create GitHub activity, or delete data.

Generated: 2026-07-10T21:45:57.212Z
Mode: manual_publish_packet_local_review
Status: ready_local_review
Round: week0-cta-text
Changed variable: cta_text
One-variable rule ok: yes
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

## Packet Index

| Content | Variant | CTA | Status | Tracking URL |
| --- | --- | --- | --- | --- |
| week0-post-001 | cta-v1-diagnostic | 加 LINE 領 48h 成交診斷 | draft_only_human_publish_required | http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v1-diagnostic&content_id=week0-post-001 |
| week0-post-002 | cta-v2-audit | 丟頁面，先抓成交斷點 | draft_only_human_publish_required | http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v2-audit&content_id=week0-post-002 |
| week0-post-003 | cta-v3-sample | 先拿一版可測 CTA | draft_only_human_publish_required | http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v3-sample&content_id=week0-post-003 |

## manual-publish-01-week0-post-001-cta-v1-diagnostic

Status: draft_only_human_publish_required
Surface: Facebook / Threads / LINE draft
Changed variable: cta_text
Human gate: Owner must explicitly approve the exact copy, surface, timing, and link before any public post or schedule action.

### Draft Caption

頁面有流量但沒人加 LINE，通常不是你不會賣，而是 hook、offer、視覺主張、CTA 有一段斷掉。這輪我只測 CTA，不動主連結、不碰客戶資料。想先知道漏在哪，先走 48h 成交診斷。

### Tracking URL

`http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v1-diagnostic&content_id=week0-post-001`

### LINE Handoff

- Inbound only: yes
- Manual reply only: yes
- Aggregate-only local recording: yes
- Primary reply prompt: 我先幫你抓漏斗斷點。你不用重做整站，先回覆目前最像哪一段卡住：有點擊沒進 LINE / 進 LINE 不留資 / 留資不成交 / 還不確定。

### Owner Manual Steps

1. Review the caption and tracking URL in this packet.
1. If approved, paste the caption and the local tracking URL manually into the chosen surface.
1. Verify the platform preview manually before publishing or scheduling.
1. After traffic arrives, record aggregate-only page_view, cta_click, and line_add counts in the sample-gate worksheet.
1. Use line_inbound_playbook.md for inbound replies only; do not push or broadcast LINE messages.

### Blocked Actions

- formal_social_post
- schedule_social_post
- change_primary_social_or_bio_link
- promote_challenger_to_champion
- line_push_or_broadcast
- ecpay_payment_refund_or_capture
- customer_data_mutation
- production_worker_deploy
- github_push_or_pr_creation
- delete_data_or_retire_live_assets

## manual-publish-02-week0-post-002-cta-v2-audit

Status: draft_only_human_publish_required
Surface: Facebook / Threads / LINE draft
Changed variable: cta_text
Human gate: Owner must explicitly approve the exact copy, surface, timing, and link before any public post or schedule action.

### Draft Caption

不用先重做整站。先看 100 次點擊裡，哪一步掉最多：進頁、CTA、LINE、留資、成交。這輪只改 CTA 文字，其他不動，避免看不出真正原因。

### Tracking URL

`http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v2-audit&content_id=week0-post-002`

### LINE Handoff

- Inbound only: yes
- Manual reply only: yes
- Aggregate-only local recording: yes
- Primary reply prompt: 我先幫你抓漏斗斷點。你不用重做整站，先回覆目前最像哪一段卡住：有點擊沒進 LINE / 進 LINE 不留資 / 留資不成交 / 還不確定。

### Owner Manual Steps

1. Review the caption and tracking URL in this packet.
1. If approved, paste the caption and the local tracking URL manually into the chosen surface.
1. Verify the platform preview manually before publishing or scheduling.
1. After traffic arrives, record aggregate-only page_view, cta_click, and line_add counts in the sample-gate worksheet.
1. Use line_inbound_playbook.md for inbound replies only; do not push or broadcast LINE messages.

### Blocked Actions

- formal_social_post
- schedule_social_post
- change_primary_social_or_bio_link
- promote_challenger_to_champion
- line_push_or_broadcast
- ecpay_payment_refund_or_capture
- customer_data_mutation
- production_worker_deploy
- github_push_or_pr_creation
- delete_data_or_retire_live_assets

## manual-publish-03-week0-post-003-cta-v3-sample

Status: draft_only_human_publish_required
Surface: Facebook / Threads / LINE draft
Changed variable: cta_text
Human gate: Owner must explicitly approve the exact copy, surface, timing, and link before any public post or schedule action.

### Draft Caption

如果你的貼文有點擊，但 LINE 沒進線，先別急著加內容。給我現有頁面，我回一版只改 CTA 的候選頁，樣本不足不換冠軍。

### Tracking URL

`http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v3-sample&content_id=week0-post-003`

### LINE Handoff

- Inbound only: yes
- Manual reply only: yes
- Aggregate-only local recording: yes
- Primary reply prompt: 我先幫你抓漏斗斷點。你不用重做整站，先回覆目前最像哪一段卡住：有點擊沒進 LINE / 進 LINE 不留資 / 留資不成交 / 還不確定。

### Owner Manual Steps

1. Review the caption and tracking URL in this packet.
1. If approved, paste the caption and the local tracking URL manually into the chosen surface.
1. Verify the platform preview manually before publishing or scheduling.
1. After traffic arrives, record aggregate-only page_view, cta_click, and line_add counts in the sample-gate worksheet.
1. Use line_inbound_playbook.md for inbound replies only; do not push or broadcast LINE messages.

### Blocked Actions

- formal_social_post
- schedule_social_post
- change_primary_social_or_bio_link
- promote_challenger_to_champion
- line_push_or_broadcast
- ecpay_payment_refund_or_capture
- customer_data_mutation
- production_worker_deploy
- github_push_or_pr_creation
- delete_data_or_retire_live_assets

