# Public Tracking URL Pack

BLUF: The selected post is still local-only; this pack shows the exact public URL shape but blocks activation until owner-run D1, Worker, and route gates are verified.

Generated: 2026-07-10T21:46:00.744Z
Mode: public_tracking_url_pack_local_only
Status: prepared_but_blocked_owner_public_url
Round: week0-cta-text
Changed variable: cta_text
Selected packet: manual-publish-01-week0-post-001-cta-v1-diagnostic
Selected link: post-week0-post-001-cta-v1-diagnostic

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

## Current Gate

- Current local tracking URL: http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v1-diagnostic&content_id=week0-post-001
- Current tracking URL public-ready: no
- Current Worker base: https://3q-growth-loop-candidate.milk790.workers.dev
- Current Worker base public-ready: yes
- Public tracking URL ready: no
- Formal publish ready: no

## Public URL Preview

Use these only after the owner has executed and verified the required gates.

- Owner Worker URL placeholder: https://<OWNER_APPROVED_WORKER_URL>
- Selected public tracking URL preview: https://<OWNER_APPROVED_WORKER_URL>/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v1-diagnostic&content_id=week0-post-001
- Selected candidate page preview: https://<OWNER_APPROVED_WORKER_URL>/candidate?utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&content_id=week0-post-001&variant_id=cta-v1-diagnostic&asset_id=challenger-week0-cta-text-v1
- LINE CTA tracking URL preview: https://<OWNER_APPROVED_WORKER_URL>/r/challenger-week0-cta-text-v1?to=line&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=challenger-week0-cta-text-v1-line&content_id=2026-06-29-line-cta
- A/B router preview: https://<OWNER_APPROVED_WORKER_URL>/ab/ab-week0-cta-text-001?utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&content_id=2026-06-29-ab-router

## Gate Order

1. remote_d1_create_and_migrate
2. candidate_worker_production_deploy
3. public_ab_small_traffic_link
4. owner_day0_manual_publish_one_packet
5. manual_publish_evidence_intake

## Gate Status

- remote_d1_create_and_migrate: owner_approval=no / ready_for_owner_execution=no / blocker=owner_approval_input.json has no approval entry for this gate.
- candidate_worker_production_deploy: owner_approval=no / ready_for_owner_execution=no / blocker=owner_approval_input.json has no approval entry for this gate.
- public_ab_small_traffic_link: owner_approval=no / ready_for_owner_execution=no / blocker=owner_approval_input.json has no approval entry for this gate.

## Post-Gate Verification

- candidate_worker_production_deploy: ready=no / blocker=owner_evidence_not_ready:owner_gate_evidence.json has no evidence entry for this gate.
- public_ab_small_traffic_link: ready=no / blocker=owner_evidence_not_ready:owner_gate_evidence.json has no evidence entry for this gate.

## Owner Copy Fields

- approved_worker_url: https://<OWNER_APPROVED_WORKER_URL>
- selected_public_tracking_url_preview: https://<OWNER_APPROVED_WORKER_URL>/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v1-diagnostic&content_id=week0-post-001
- selected_public_candidate_url_preview: https://<OWNER_APPROVED_WORKER_URL>/candidate?utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&content_id=week0-post-001&variant_id=cta-v1-diagnostic&asset_id=challenger-week0-cta-text-v1
- line_cta_public_tracking_url_preview: https://<OWNER_APPROVED_WORKER_URL>/r/challenger-week0-cta-text-v1?to=line&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=challenger-week0-cta-text-v1-line&content_id=2026-06-29-line-cta
- ab_router_public_url_preview: https://<OWNER_APPROVED_WORKER_URL>/ab/ab-week0-cta-text-001?utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&content_id=2026-06-29-ab-router

## Selected Caption

頁面有流量但沒人加 LINE，通常不是你不會賣，而是 hook、offer、視覺主張、CTA 有一段斷掉。這輪我只測 CTA，不動主連結、不碰客戶資料。想先知道漏在哪，先走 48h 成交診斷。

## Next Safe Actions

1. Review this pack locally and confirm the selected public URL shape before any platform post.
1. Owner executes remote D1 and Worker gates outside this runner, then records non-secret evidence in owner_gate_evidence.json.
1. Run npm run owner:evidence && npm run post:verify && npm run gate:readiness after owner evidence exists.
1. Only after post-gate verification passes, manually publish exactly one reviewed packet and record aggregate evidence.

## Blocked Actions

- remote_d1_create_or_migration
- production_worker_deploy
- public_tracking_url_activation
- public_ab_or_bio_link_change
- formal_social_post_or_schedule
- line_push_or_broadcast
- github_push_or_pr_creation
- customer_data_mutation
- ecpay_payment_refund_or_capture
- delete_data_or_retire_live_assets
