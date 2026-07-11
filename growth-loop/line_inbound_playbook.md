# LINE Inbound Playbook

BLUF: This is a local, inbound-only customer-service handoff for the 3Q growth loop. It gives manual reply templates and aggregate event mapping, but it does not send LINE messages, push broadcasts, store customer data, process payments, or mutate external systems.

Generated: 2026-07-10T21:45:56.412Z
Mode: line_inbound_local_playbook
Round: week0-cta-text
Changed variable: cta_text
One-variable rule: pass

## Policy

- Inbound only: yes
- Manual reply only: yes
- LINE push performed: no
- Formal post performed: no
- Customer data storage: no
- Raw chat export: no
- Aggregate or pseudonymous metrics only: yes
- Payment action: no
- Delete action: no
- External effect: no

## Qualification Buckets

- funnel_block_bucket: click_no_line / line_no_lead / lead_no_deal / unknown
- business_type_bucket: local_service / ecommerce / course_consulting / b2b / other
- traffic_bucket_7d: 0_99 / 100_499 / 500_plus / unknown

## Blocked Local Fields

- phone
- email
- line_user_id
- customer_name
- address
- payment
- card
- message
- conversation
- private_note

## line_add

- Event type: line_add
- Trigger: User voluntarily adds LINE or sends the first inbound message after seeing a draft or candidate page.
- Operator goal: Acknowledge the inbound lead and keep the local metric as an aggregate LINE-add count.
- Requested fields: funnel_block_bucket
- Local recording: Add one aggregate line_add count for the matching asset_id. Do not store chat text or personal identifiers.

```text
我先幫你抓漏斗斷點。你不用重做整站，先回覆目前最像哪一段卡住：有點擊沒進 LINE / 進 LINE 不留資 / 留資不成交 / 還不確定。
```

Aggregate CSV example:

```json
{
  "date": "2026-07-08",
  "asset_id": "challenger-week0-cta-text-v1",
  "event_type": "line_add",
  "count": "1",
  "source": "line_inbound_manual",
  "medium": "line",
  "campaign": "week0-cta-text",
  "content_id": "week0-cta-text-line-inbound",
  "variant_id": "challenger-week0-cta-text-v1",
  "quality_score": ""
}
```

## lead_submit

- Event type: lead_submit
- Trigger: User gives enough business context for a diagnostic follow-up inside the inbound LINE thread.
- Operator goal: Count a lead only when the user shares a business-type bucket and current funnel block bucket.
- Requested fields: business_type_bucket, traffic_bucket_7d
- Local recording: Add one aggregate lead_submit count only after business context is sufficient. Do not copy the conversation into local files.

```text
收到。我會用 48h 成交診斷看三件事：入口、CTA、LINE 後續。請用選項回：在地服務 / 電商 / 課程顧問 / B2B / 其他，還有近 7 天點擊量大概 0-99 / 100-499 / 500+ / 不確定。
```

Aggregate CSV example:

```json
{
  "date": "2026-07-08",
  "asset_id": "challenger-week0-cta-text-v1",
  "event_type": "lead_submit",
  "count": "1",
  "source": "line_inbound_manual",
  "medium": "line",
  "campaign": "week0-cta-text",
  "content_id": "week0-cta-text-lead-qualified",
  "variant_id": "challenger-week0-cta-text-v1",
  "quality_score": ""
}
```

## deal

- Event type: deal
- Trigger: Owner manually confirms a paid or committed conversion after separate review.
- Operator goal: Record only an aggregate deal count after the owner confirms the outcome.
- Requested fields: none
- Local recording: Add one aggregate deal count only after owner confirmation. Never process ECPay or payment actions here.

```text
這一步不自動成交、不收款、不改客戶資料。成交狀態只由學誼人工確認後，回填 aggregate deal count。
```

Aggregate CSV example:

```json
{
  "date": "2026-07-08",
  "asset_id": "challenger-week0-cta-text-v1",
  "event_type": "deal",
  "count": "1",
  "source": "line_inbound_manual",
  "medium": "line",
  "campaign": "week0-cta-text",
  "content_id": "week0-cta-text-owner-confirmed-deal",
  "variant_id": "challenger-week0-cta-text-v1",
  "quality_score": ""
}
```

## quality_flag

- Event type: quality_flag
- Trigger: Inbound thread is spam, irrelevant, duplicate, or lower-quality than the champion baseline.
- Operator goal: Protect no_quality_regression without storing raw chat content.
- Requested fields: quality_score_bucket
- Local recording: Add aggregate quality_flag with quality_score only. Do not store the reason text if it contains customer details.

```text
若這筆進線明顯不相關，只記 aggregate quality_flag，不保存對話內容。
```

Aggregate CSV example:

```json
{
  "date": "2026-07-08",
  "asset_id": "challenger-week0-cta-text-v1",
  "event_type": "quality_flag",
  "count": "1",
  "source": "line_inbound_manual",
  "medium": "line",
  "campaign": "week0-cta-text",
  "content_id": "week0-cta-text-quality-guard",
  "variant_id": "challenger-week0-cta-text-v1",
  "quality_score": "0.25"
}
```


## Manual Conversion Contract

- Artifact: data/manual_conversions.example.csv
- Preview command: npm run import:manual:preview
- Apply command: npm run import:manual:apply
- Default mode: preview_only
- Apply gate: local_apply_requires_explicit_command_and_review
- Allowed columns: date, asset_id, event_type, count, source, medium, campaign, content_id, variant_id, quality_score
- Allowed event types: line_add, lead_submit, deal, quality_flag

## Human Gate

Formal LINE broadcast, proactive push, customer-data edits, payment/refund action, and production deploy remain owner-only gates. This playbook is copyable operating guidance and local aggregate mapping only.
