# D1 Collection Mode Fixture Report

BLUF: d1_collection_mode_fixtures_ok. All scenarios are plan-only and perform no D1 query.

| scenario | status | selected_scope | remote_authorized | blocked_checks |
|---|---|---|---|---|
| missing_owner_evidence_stays_local | ok | local_review_only | no | owner_evidence_input_present, owner_evidence_valid, recurring_aggregate_read_approved, post_gate_verification_ready, evidence_database_name_matches, evidence_database_id_matches |
| recurring_read_not_approved_stays_local | ok | local_review_only | no | recurring_aggregate_read_approved |
| post_gate_not_ready_stays_local | ok | local_review_only | no | post_gate_verification_ready |
| mismatched_d1_target_stays_local | ok | local_review_only | no | evidence_database_name_matches, evidence_database_id_matches |
| valid_owner_evidence_selects_remote_aggregate_plan | ok | remote_aggregate_only | yes | none |

- Collection execution performed: no
- Remote read performed: no
- Raw event rows read: no
- Customer data read: no
- External effect: no
