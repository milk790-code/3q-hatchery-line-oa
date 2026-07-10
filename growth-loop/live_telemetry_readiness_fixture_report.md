# Live Telemetry Readiness Fixture Report

BLUF: live_telemetry_readiness_fixtures_ok. Fixture-only chain states; no live network refresh, D1 table query, event POST, deploy, or external write.

| scenario | result | status | candidate operation | ingest proven | weekly read authorized |
|---|---|---|---|---|---|
| candidate_missing_requires_deploy_gate | ok | candidate_worker_deployment_not_observed | deploy_candidate_worker | no | no |
| deployed_candidate_missing_security_contract_requires_update | ok | candidate_worker_security_update_required | deploy_candidate_worker_security_update | no | no |
| live_chain_observed_requires_owner_provenance_and_schema_evidence | ok | live_chain_observed_owner_provenance_and_schema_evidence_required | verify_existing_candidate_deployment | no | no |
| collector_origin_mismatch_blocks_chain | ok | champion_telemetry_wiring_not_ready | verify_existing_candidate_deployment | no | no |
| schema_and_deployment_evidence_valid_recurring_read_false | ok | live_ingest_ready_recurring_read_not_approved | verify_existing_candidate_deployment | yes | no |
| full_evidence_enables_weekly_aggregate_read_plan | ok | live_ingest_and_weekly_aggregate_read_ready | verify_existing_candidate_deployment | yes | yes |

## Invariants

- A healthy deployment switches to provenance verification only when the required origin/PII security contract marker is current; an older deployment requires one owner-gated security update.
- D1 inventory num_tables is explicitly non-authoritative and never proves schema absence.
- Schema evidence and recurring aggregate-read authorization are independent.
- Remote table query performed: no
- Event POST performed: no
- External effect: no
