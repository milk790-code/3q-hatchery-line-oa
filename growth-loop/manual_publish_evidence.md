# Manual Publish Evidence Intake

BLUF: waiting_for_owner_manual_publish_evidence. This local intake reads owner-supplied proof that one reviewed packet was manually published, then calculates Day 3 and Day 7 aggregate-count checkpoints. It does not publish, schedule, fetch URLs, change links, push LINE, deploy, create GitHub activity, mutate customer data, process payments, delete data, or write data/lp_events.jsonl.

Generated: 2026-07-10T21:46:02.217Z
Mode: manual_publish_evidence_local_only
Status: waiting_for_owner_manual_publish_evidence
Input exists: no
Evidence count: 0
Valid evidence count: 0
Active packet: none
Next safe action: After the owner manually publishes exactly one reviewed packet, copy manual_publish_evidence.example.json to manual_publish_evidence.json, fill non-sensitive evidence only, then rerun npm run manual:publish-evidence.

External effect: no
Formal post performed by this runner: no
LINE push performed: no
Public link change performed: no
Production deploy performed: no
GitHub push or PR performed: no
Customer data mutation performed: no
Payment action performed: no
Delete action performed: no
data/lp_events.jsonl write performed: no
Post URL fetch performed: no

## Evidence

| packet | valid | checkpoint | published date | Day 3 | Day 7 | next counts |
|---|---|---|---|---|---|---|
| n/a | n/a | waiting | n/a | n/a | n/a | wait |

## Required Owner Fields

- packet_id
- published_at
- surface
- post_ref
- reviewer
- manual_publish_confirmed
- pii_checked
- published_packet_only

## Issues

- none
