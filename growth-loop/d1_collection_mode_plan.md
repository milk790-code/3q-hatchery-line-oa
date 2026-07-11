# D1 Collection Mode

BLUF: Remote collection is not authorized; weekly collection remains local-review-only.

- Status: local_review_collection_only
- Selected scope: local_review_only
- Selected command: npm run collect:d1:local
- Plan only: yes
- Remote read authorized: no
- Aggregate-only policy: yes
- Raw event rows allowed: no
- Customer data read: no
- Customer data mutation: no
- External effect: no

## Authorization Checks

| check | status | reason |
|---|---|---|
| owner_evidence_input_present | blocked | Owner D1 evidence input is required. |
| owner_evidence_valid | ok | Owner D1 evidence must pass the local evidence contract. |
| recurring_aggregate_read_approved | blocked | Owner must explicitly approve recurring aggregate-only D1 reads. |
| post_gate_verification_ready | ok | D1 post-gate verification plan must be ready. |
| dedicated_database_present | ok | The dedicated Growth Loop D1 must be present. |
| configured_id_matches | ok | The configured D1 id must match read-only inventory. |
| evidence_database_name_matches | blocked | Owner evidence D1 name must match the configured dedicated database. |
| evidence_database_id_matches | blocked | Owner evidence D1 id must match the configured dedicated database. |

## Safety

Without valid owner evidence, recurring aggregate-read approval, post-gate readiness, exact D1 metadata, and matching evidence target, the selector always runs local review collection. It never falls back to a raw remote row query.
