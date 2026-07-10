# 3Q Growth Loop Goal Completion Audit

BLUF: Overall: not_complete_data_and_external_gates. Local Week 0 automation is prepared, but the full seven-day acquisition flywheel is not proven until P0/P1/trusted-scoring evidence is complete and owner-gated remote effects are approved.

Generated: 2026-07-10T21:48:20.571Z
Week: 2026-06-29 to 2026-07-05
Mode: week0_data_collection

## Overall

- Overall: not_complete_data_and_external_gates
- Reason: required P0/P1/trusted-scoring evidence is incomplete, and external deployment and public traffic effects remain blocked.
- Current real events observed by local JSONL runner: 0
- Latest D1 sync: ok / scope=local / rows=0
- Latest D1 guard: scoring_allowed=no / smoke_rows=0 / policy=review_export_only_not_sample_gate_input
- Event input quality gate: ok / rows=0 / issues=0 / sensitive=no
- Full funnel aggregate import: ok / mode=full_funnel_preview / preview_events=48 / apply_performed=no / data_lp_events_write_performed=no
- Real-data apply guard: ok / mode=real_data_apply_fixture_dry_run / scenarios=4 / data_lp_events_write_performed=no
- Real-data decision replay: ok / mode=real_data_decision_replay_fixture_dry_run / scenarios=6 / ledger=yes / compile=yes / data_lp_events_write_performed=no / external_effect=no
- Source readiness: ok / status=waiting_for_real_data / missing_stages=7 / public_ready=no / data_lp_events_write_performed=no
- Source capture pack: ok / rows=42 / importable_links=6 / live_inputs=no / data_lp_events_write_performed=no
- Source capture compile: ok / status=waiting_for_filled_counts / input_kind=template / filled_rows=0 / preview_rows=0 / data_lp_events_write_performed=no
- Source capture compile fixtures: ok / scenarios=7 / data_lp_events_write_performed=no
- Real-data intake plan: ok / status=no_real_input_files / ready_apply=0 / missing_inputs=2 / data_lp_events_write_performed=no
- Data collection brief: ok / status=waiting_for_owner_aggregate_counts / tasks=42 / data_lp_events_write_performed=no
- Data collection progress: ok / status=waiting_for_p0_sample_gate_counts / tasks=0/42 / pending=42 / p0_pending=18 / p1_pending=24 / data_lp_events_write_performed=no / external_effect=no
- Next P0 owner form: ok / status=ready_local_next_p0_owner_form / rows=9 / browser_only=yes / fixture=ok / scenarios=4 / data_lp_events_write_performed=no / external_effect=no
- Next P0 owner intake: ok / status=waiting_for_next_p0_owner_download / found=no / preview_rows=0 / staged=no / fixture=ok / scenarios=5 / data_lp_events_write_performed=no / external_effect=no
- Sample gate plan: waiting_for_sample_gate_counts / p0_tasks=18 / p0_links=6
- Manual conversion import: ok / mode=preview / preview_events=10 / apply_performed=no
- LINE inbound playbook: ok / scenarios=6 / line_push_performed=no / customer_data_mutation_performed=no
- Manual publish evidence form: ok / status=ready_local_manual_publish_evidence_form / browser_only=yes / network_calls=no / url_fetch=no / live_inputs=no
- Manual publish evidence form fixtures: ok / scenarios=4 / data_lp_events_write_performed=no / external_effect=no
- Weekly local runner: success / launchd_installed=yes / install_performed=yes
- Worker dry run: ok / dry_run_exit=yes / production_deploy_performed=no / external_effect=no
- Browser smoke: ok / checks=5/5 / event_write_performed=no
- Tracking link smoke: ok / links=7/7 / real_event_write_performed=no
- Event contract smoke: ok / synthetic_counts={"cta_click":1,"page_view":1} / real_event_write_performed=no
- Win-rule fixtures: ok / scenarios=6 / real_event_write_performed=no
- Week archive: ok / files=326/326 / immutable_snapshot=yes
- Next round plan: continue_current_round / decision=continue_current_round_until_sample_threshold / next_variable=cta_text
- Funnel breakdown: content_variant_attribution / rows=6 / content_variant_links=3 / real_events=0
- Owner approval pack: owner_approval_required / pending=5 / local_preflight_ok=yes
- Champion retained: yes
- Challenger promotion performed: no
- Production deploy performed: no
- Public link change performed: no
- Formal post / LINE push performed: no
- Customer data / payment / delete action performed: no

## Data Evidence Gates

| gate | status | blocks completion | observed | artifact |
|---|---|---|---|---|
| p0_sample_gate_evidence | unmet | yes | {"p0_pending_count":18,"sample_threshold_met":false} | next_p0_owner_form.html |
| p1_outcome_quality_evidence | unmet | yes | {"p1_pending_count":24} | north_star_outcome_form.html |
| trusted_scoring_input | unmet | yes | {"scoring_allowed_now":false,"trusted_scoring_source_count":0,"real_event_rows":0} | source_trust_matrix.md |

## Requirement Audit

| requirement | status | evidence |
|---|---|---|
| North star funnel uses link_click -> line_add -> lead_submit -> deal. | local_prepared | growth_scores.json counts link_clicks, line_adds, leads, deals; weekly_report.md states the north star. |
| Collect data and set lp_events. | local_schema_ready_no_real_events | schema/d1-week0.sql defines lp_events; data/lp_events.jsonl events=0; D1 sync scope=local rows=0. |
| Gate real lp_events input before scoring and block PII or malformed rows. | local_verified | data/event_input_quality_status.json ok=yes; rows=0; issues=0; sensitive=no; scoring_allowed=yes; data_lp_events_write_performed=no. |
| Full-funnel aggregate import previews link clicks, visits, CTA clicks, LINE adds, leads, deals, and quality flags without scoring them. | local_preview_ready_not_scored | data/funnel_aggregate_status.json mode=full_funnel_preview events=48; apply_performed=no; data_lp_events_write_performed=no; sensitive_columns=no; sensitive_values=no. |
| Full-funnel aggregate fixtures block unknown assets, missing attribution, sensitive fields, sensitive values, and unsafe apply attempts. | local_verified_fixture_guard | data/funnel_aggregate_fixture_status.json ok=yes; mode=funnel_aggregate_fixture_dry_run; scenarios=6; real_event_write_performed=no; data_lp_events_write_performed=no; external_effect=no. |
| Real-data apply fixtures block example/template or unconfirmed aggregate rows from being scored. | local_verified_apply_guard | data/real_data_apply_fixture_status.json ok=yes; mode=real_data_apply_fixture_dry_run; scenarios=4; real_event_write_performed=no; data_lp_events_write_performed=no; external_effect=no. |
| Real-data decision replay connects filled source-capture ledgers, compiled owner-preview CSVs, aggregate import previews, scoring, A/B decisions, and next-round planning. | local_verified_decision_replay | data/real_data_decision_replay_status.json ok=yes; mode=real_data_decision_replay_fixture_dry_run; scenarios=6; source_capture_ledger=yes; source_compile_commands=yes; local_importer_previews=yes; real_event_write_performed=no; data_lp_events_write_performed=no; external_effect=no. |
| Source readiness identifies every funnel-stage data source before public iteration decisions. | local_verified_source_monitor | data/source_readiness_status.json status=waiting_for_real_data; stages=7; missing_stages=7; ready_for_public_iteration_decision=no; data_lp_events_write_performed=no; external_effect=no. |
| Source trust matrix blocks review-only D1 smoke rows and owner-preview artifacts from scoring decisions. | local_verified_source_trust_gate | data/source_trust_matrix_status.json status=waiting_for_trusted_scoring_input; trusted_scoring_sources=0; sample_gate_sources=0; real_event_rows=0; p0_pending=18; scoring_allowed_now=no; data_lp_events_write_performed=no; external_effect=no. |
| Source capture pack maps every funnel-stage source to aggregate-only owner capture templates. | local_capture_pack_ready | data/source_capture_status.json status=waiting_for_owner_aggregate_capture; rows=42; importable_links=6; ab_router_gates=1; template_only=yes; live_input_files_created=no; data_lp_events_write_performed=no; external_effect=no. |
| Source capture compile validates filled ledger rows and emits owner-preview aggregate CSVs without live writes. | local_compile_preview_ready | data/source_capture_compile_status.json status=waiting_for_filled_counts; input_kind=template; filled_rows=0; funnel_rows=0; manual_rows=0; issues=0; live_input_files_created=no; data_lp_events_write_performed=no; external_effect=no. |
| Source capture compile fixtures prove valid filled rows and invalid sensitive/malformed rows are handled safely. | local_verified_fixture_guard | data/source_capture_compile_fixture_status.json ok=yes; mode=source_capture_compile_fixture_dry_run; scenarios=7; execution_performed=no; data_lp_events_write_performed=no; external_effect=no. |
| Real-data intake plan checks for reviewed aggregate CSV inputs and produces owner-gated local apply commands without writing real events. | local_intake_plan_ready | data/real_data_intake_status.json status=no_real_input_files; ready_apply=0; missing_inputs=2; blocked_inputs=0; real_events_unchanged=yes; data_lp_events_write_performed=no. |
| Data collection brief turns missing funnel-stage source data into an owner-reviewed aggregate-count task queue. | local_collection_queue_ready | data/data_collection_brief_status.json status=waiting_for_owner_aggregate_counts; tasks=42; stages=7; importable_links=6; sample_gate_status=waiting_for_sample_gate_counts; sample_gate_p0_tasks=18; sample_gate_p0_links=6; filled_ledger_exists=no; live_input_files_created=no; data_lp_events_write_performed=no; external_effect=no. |
| Data collection progress turns the 42 owner aggregate-count tasks into a machine-readable completion dashboard. | local_progress_dashboard_ready | data/data_collection_progress_status.json status=waiting_for_p0_sample_gate_counts; tasks=0/42; pending=42; p0_pending=18; p1_pending=24; next_owner_inputs=9; live_input_files_created=no; data_lp_events_write_performed=no; external_effect=no. |
| Manual aggregate conversion import for LINE adds, leads, deals, and quality flags. | local_preview_ready_not_scored | data/manual_conversion_status.json mode=preview events=10; apply_performed=no; sensitive_columns=no; sensitive_values=no. |
| LINE inbound customer-service handoff maps LINE adds, leads, deals, and quality flags without storing customer data. | local_verified_inbound_only | data/line_inbound_fixture_status.json ok=yes; mode=line_inbound_fixture_dry_run; scenarios=6; line_push_performed=no; customer_data_mutation_performed=no; data_lp_events_write_performed=no. |
| Manual publish evidence browser form prepares owner evidence input without network calls or live writes. | local_verified_browser_form | data/manual_publish_evidence_form_status.json status=ready_local_manual_publish_evidence_form; packets=3; browser_only=yes; network_calls=no; post_url_fetch=no; live_input_files_created=no; fixture=ok; scenarios=4; data_lp_events_write_performed=no; external_effect=no. |
| Score, rank, winners/losers, and preserve champion when sample is insufficient. | local_prepared | growth_scores.json generated; ab_test_status=sample_insufficient_keep_champion; champion retained when sample_threshold_met=false. |
| Draft content variants while changing only one variable. | local_prepared | changed_variable=cta_text; drafts=3. |
| Content variants have unique post-level tracking links and attribution breakdown. | local_prepared | funnel_breakdown.json rows=6; content_variant_links=3; real_events=0; public_link_change_performed=no. |
| Decide the next seven-day iteration without violating one-variable-per-round or sample-insufficient gates. | local_prepared | next_round_plan.json decision=continue_current_round_until_sample_threshold; current_variable=cta_text; next_variable=cta_text; start_new_variable_round=no; sample_threshold_met=no. |
| Generate landing page challenger and candidate Worker. | local_prepared_and_dry_run_verified | landing_page_candidate.html and worker.ts generated; worker_dry_run_status ok=yes; dry_run_exit=yes; production_deploy_performed=no; report=/Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/worker_dry_run.md. |
| Prepare a source-locked live champion contact repair with privacy-safe telemetry and an isolated two-Worker smoke. | local_prepared_and_isolated_smoke_verified | champion_integration_candidate.md, champion_integration_smoke.md, cloudflare_d1_readiness.md, champion_local_branch.md, champion_release_preflight.md, and champion_release_owner_packet.md; the patch is committed locally from the exact source lock, D1 prerequisites are metadata-verified, production CLI flags pass dry-run, and push/deploy/public-link changes remain blocked. |
| Prepare A/B small traffic without public link changes. | local_prepared_human_link_gate | http://127.0.0.1:8787/ab/ab-week0-cta-text-001; allocation 90/10; public_link_change_performed=false. |
| Retire non-main candidates without deleting data or changing public links. | local_prepared | candidate_retirement_queue.json status=no_retirement_sample_insufficient_or_not_needed; retirement_ready=0; no_data_delete=true. |
| Weekly Sunday sequence represented end to end. | local_prepared | pipeline_status.json steps=9; schedule target is Sunday Taipei via wrangler cron. |
| Weekly local runner and install-safe schedule template exist. | installed | data/schedule_status.json command=npm run weekly:local; launchd_template=launchd/com.angelia.3q-growth-loop.weekly.plist; launchd_installed=yes; file_installed=yes; service_loaded=yes; last_runner_status=success; rollback=npm run schedule:uninstall. |
| Browser/route smoke verifies local Worker candidate, candidate page, A/B status, and champion placeholder gate without event writes. | local_verified | data/browser_smoke_status.json ok=yes; checks=5/5; event_write_performed=no; log=/Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/logs/browser-smoke-20260710T214611Z.log. |
| Generated tracking links redirect correctly in isolated local smoke without following external URLs or writing real events. | local_verified_isolated_fixture | data/tracking_link_smoke_status.json ok=yes; links=7/7; isolated_link_click_events=7; real_event_write_performed=no; data_lp_events_write_performed=no; log=/Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/logs/tracking-link-smoke-20260710T214615Z.log. |
| Worker event contract accepts funnel events and rejects sensitive metadata in isolated local D1. | local_verified_isolated_fixture | data/event_contract_smoke_status.json ok=yes; synthetic_counts={"cta_click":1,"page_view":1}; sensitive_rejection=yes; invalid_event_rejection=yes; real_event_write_performed=no; data_lp_events_write_performed=no. |
| Win-rule fixtures cover sample-insufficient, human-promotion-only, underperform, and quality-regression paths. | local_verified | data/win_rule_fixture_status.json ok=yes; scenarios=6; real_event_write_performed=no; challenger_promotion_performed=no. |
| Weekly evidence archive preserves reports, scores, approval queue, A/B status, candidate, dry-run states, and red-line evidence. | local_snapshot_ready | data/week_archive_status.json ok=yes; files=326/326; missing=0; archive_dir=/Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/archive/2026-06-29/20260710T214814771Z; external_effect=false. |
| GitHub handoff exists without external push or PR creation. | prepared_but_blocked | champion_local_branch.md proves the source patch has a clean local feature commit with no remote branch; github_handoff.md covers the separate engine bundle; approval_queue.json and prepared_but_blocked.json retain the GitHub push/PR gate. |
| Owner approval pack exists for D1, Worker deploy, public A/B routing, GitHub, and manual-only actions. | prepared_but_blocked | owner_approval_pack.md and launch_readiness.json generated; pending_human_approvals=5; local_preflight_ok=yes. |
| Prohibited external actions are not performed. | verified_not_performed | pipeline_status.json flags production_deploy/formal_post/line_push/customer_data/payment/delete=false; prepared_but_blocked.json queues redlines. |
| Full seven-day automatic flywheel is live. | not_complete_data_and_external_gates | P0/P1/trusted-scoring evidence is incomplete; remote D1 creation, production deploy, and public small-traffic routing remain owner-gated. |

## Artifact Audit

| artifact | status |
|---|---|
| weekly_report.md | present_generated |
| growth_scores.json | present_generated |
| approval_queue.json | present_generated |
| ab_test_status.json | present_generated |
| landing_page_candidate.html | present_generated |
| worker.ts | present_generated |
| worker_dry_run.md | present_worker_dry_run_report |
| data/worker_dry_run_status.json | present_worker_dry_run_status |
| champion_integration_candidate.md | present_source_locked_contact_repair_candidate |
| data/champion_integration_candidate_status.json | present_source_lock_and_dry_run_status |
| champion_integration_smoke.md | present_two_worker_isolated_smoke |
| data/champion_integration_smoke_status.json | present_two_worker_smoke_status |
| cloudflare_d1_readiness.md / data/cloudflare_d1_readiness_status.json | present_read_only_d1_metadata_readiness |
| champion_local_branch.md / data/champion_local_branch_status.json | present_isolated_local_feature_commit |
| champion_release_preflight.md | present_clean_archive_release_preflight |
| data/champion_release_preflight_status.json | present_release_preflight_status |
| data/champion_live_deployment_snapshot.json | present_read_only_live_deployment_snapshot |
| champion_release_owner_packet.md / champion_release_owner_packet.json | present_owner_deploy_and_rollback_packet |
| prepared_but_blocked.json | present_generated |
| github_handoff.md | present_github_publish_handoff |
| launch_readiness.json | present_owner_gate_map |
| owner_approval_pack.md | present_owner_review_pack |
| approval_resume_plan.md | present_resume_dry_run_plan_after_weekly_runner |
| data/approval_resume_status.json | present_resume_dry_run_status_after_weekly_runner |
| post_gate_verification.md | present_post_gate_verification_plan_after_weekly_runner |
| data/post_gate_verification_status.json | present_post_gate_verification_status_after_weekly_runner |
| owner_approval_input.example.json | present_non_secret_example_input_after_weekly_runner |
| tracking_links.json | present_generated |
| content_variants.md / content_variants.json | present_generated |
| funnel_breakdown.md / funnel_breakdown.json | present_content_variant_attribution |
| next_round_plan.md / next_round_plan.json | present_next_round_decision |
| pipeline_status.json | present_generated |
| data/schedule_status.json | present_generated |
| data/launchagent_status.json | present_installed_local_schedule |
| launchd/com.angelia.3q-growth-loop.weekly.plist | present_launchagent_template |
| candidate_retirement_queue.json | present_generated |
| data/d1_sync_status.json | present_d1_sync_available |
| data/event_input_quality_status.json | present_event_input_quality_passed |
| data/lp_events.d1-local.jsonl | present_local_d1_export |
| data/funnel_aggregates.example.csv | present_full_funnel_aggregate_template |
| data/funnel_aggregates.preview.jsonl | present_preview_not_scored |
| data/funnel_aggregate_status.json | present_full_funnel_preview_status |
| data/funnel_aggregate_fixture_status.json | present_full_funnel_fixture_status |
| funnel_aggregate_fixture_report.md | present_full_funnel_fixture_report |
| data/real_data_apply_fixture_status.json | present_real_data_apply_guard_status |
| real_data_apply_fixture_report.md | present_real_data_apply_guard_report |
| data/real_data_decision_replay_status.json | present_real_data_decision_replay_status |
| real_data_decision_replay_report.md | present_real_data_decision_replay_report |
| data/source_readiness_status.json | present_source_readiness_status |
| source_readiness.md | present_source_readiness_report |
| source_trust_matrix.md | present_source_trust_report |
| source_trust_matrix.json | present_source_trust_matrix |
| data/source_trust_matrix_status.json | present_source_trust_status |
| data/source_capture_status.json | present_source_capture_status |
| source_capture_pack.md | present_source_capture_pack |
| data/source_capture/source_capture_checklist.json | present_source_capture_checklist |
| data/source_capture/source_capture_ledger.fill-template.csv | present_source_capture_ledger_template |
| data/source_capture/sample_gate_ledger.fill-template.csv | present_sample_gate_ledger_template |
| sample_gate_ledger.md | present_sample_gate_ledger_report |
| data/sample_gate_ledger_status.json | present_sample_gate_ledger_status |
| sample_gate_ledger_compile_probe.md | present_sample_gate_compile_probe_report |
| data/sample_gate_ledger_compile_probe_status.json | present_sample_gate_compile_probe_status |
| data/source_capture/sample_gate_compile_probe/funnel_aggregates.owner-preview.csv | present_sample_gate_compile_probe_funnel |
| data/source_capture/sample_gate_compile_probe/manual_conversions.owner-preview.csv | present_sample_gate_compile_probe_manual |
| source_capture_compile_report.md | present_source_capture_compile_report |
| data/source_capture_compile_status.json | present_source_capture_compile_status |
| source_capture_compile_fixture_report.md | present_source_capture_compile_fixture_report |
| data/source_capture_compile_fixture_status.json | present_source_capture_compile_fixture_status |
| data/source_capture/compiled/funnel_aggregates.owner-preview.csv | present_source_capture_funnel_owner_preview |
| data/source_capture/compiled/manual_conversions.owner-preview.csv | present_source_capture_manual_owner_preview |
| data/real_data_intake_status.json | present_real_data_intake_status |
| real_data_intake_plan.md | present_real_data_intake_plan |
| data_collection_queue.json | present_data_collection_queue |
| data_collection_brief.md | present_data_collection_brief |
| data/data_collection_brief_status.json | present_data_collection_brief_status |
| data_collection_progress.md / data_collection_progress.json / data/data_collection_progress_status.json | present_data_collection_progress |
| next_p0_owner_inputs.md / next_p0_owner_inputs.json / data/next_p0_owner_inputs_status.json | present_next_p0_owner_inputs |
| next_p0_owner_form.html / data/next_p0_owner_form_status.json | present_next_p0_owner_form |
| next_p0_owner_form_fixture_report.md / data/next_p0_owner_form_fixture_status.json | present_next_p0_owner_form_fixture |
| next_p0_owner_intake.md / data/next_p0_owner_intake_status.json | present_next_p0_owner_intake |
| next_p0_owner_intake_fixture_report.md / data/next_p0_owner_intake_fixture_status.json | present_next_p0_owner_intake_fixture |
| sample_gate_collection_plan.json | present_sample_gate_plan |
| sample_gate_collection_plan.md | present_sample_gate_plan_report |
| data/sample_gate_collection_plan_status.json | present_sample_gate_status |
| data/manual_conversions.example.csv | present_aggregate_only_template |
| data/manual_conversions.preview.jsonl | present_preview_not_scored |
| data/manual_conversion_status.json | present_manual_preview_status |
| line_inbound_playbook.md | present_inbound_manual_playbook |
| line_inbound_playbook.json | present_machine_readable_inbound_playbook |
| line_inbound_fixture_report.md | present_inbound_fixture_report |
| data/line_inbound_fixture_status.json | present_inbound_fixture_status |
| manual_publish_evidence_form.html | present_manual_publish_evidence_browser_form |
| data/manual_publish_evidence_form_status.json | present_manual_publish_evidence_form_status |
| manual_publish_evidence_form_fixture_report.md | present_manual_publish_evidence_form_fixture_report |
| data/manual_publish_evidence_form_fixture_status.json | present_manual_publish_evidence_form_fixture_status |
| data/browser_smoke_status.json | present_local_browser_smoke |
| tracking_link_smoke.md | present_tracking_link_smoke_report |
| data/tracking_link_smoke_status.json | present_tracking_link_smoke_passed |
| data/event_contract_smoke_status.json | present_event_contract_smoke_passed |
| data/win_rule_fixture_status.json | present_win_rule_fixture_passed |
| win_rule_fixture_report.md | present_win_rule_fixture_report |
| data/week_archive_status.json | present_week_archive_snapshot |
| archive/<week>/<timestamp>/manifest.json | present_manifest_hashes |

## Red-Line Queue

| action | blocked_by | prepared_artifact |
|---|---|---|
| verify_existing_cloudflare_d1_and_apply_schema | Read-only Cloudflare inventory confirms the exact dedicated Growth Loop D1 now exists and matches wrangler.jsonc, but no table query or remote schema migration has been approved or performed. | schema/d1-week0.sql |
| confirm_existing_candidate_worker_provenance | Read-only observation confirms Candidate deployment 5073984b-bcc0-40f1-a331-daaadd741071 / version 133d27b0-36e5-41e8-96ec-b55925b7b30a is healthy and wired to the Champion, but owner provenance evidence is not recorded. A redeploy is not currently required. | live_telemetry_readiness.md |
| confirm_champion_live_contract_provenance_before_redeploy | The LINE-only Champion contract is observable live, but deployment provenance is not owner evidence and any redeploy remains a production action. | champion_integration_candidate.md |
| change_primary_social_or_bio_link | Primary link changes affect public acquisition flow. | ab_test_status.json |
| formal_social_post_or_line_push | External posting and LINE push remain human-only. | weekly_report.md |
| github_push_or_pr_creation | The Champion feature commit and exact draft PR packet are prepared locally (integration_already_merged_followup_repairs_only), but branch push / PR creation is an external GitHub write; the engine bundle remains a separate local-only handoff. | champion_github_handoff.md |
| execute_owner_approved_launch_sequence | The launch sequence combines remote D1, production Worker, public A/B route, and GitHub publishing decisions. | owner_approval_pack.md |
| customer_data_or_ecpay_payment_mutation | Customer data, payments, refunds, and ECPay are hard red lines. | n/a |

## Approval Queue

| id | status | human_gate |
|---|---|---|
| collect-first-real-events | ready_local_review | Start with local/manual lp_events ingestion or approve D1 connection. |
| approve-d1-create-and-migrate | pending_human | Confirm the newly observed dedicated D1, separately approve its remote schema migration, and explicitly scope recurring aggregate-only reads. |
| approve-candidate-worker-deploy | pending_human | Confirm the observed Candidate Worker deployment provenance and rollback reference; do not redeploy unless the live version is rejected. |
| approve-small-ab-link | pending_human | Approve any small-traffic link routing before changing public links. |
| review-weekly-report | ready_local_review | Review weekly_report.md before external action. |
| review-champion-contract-audit | ready_local_review | Review champion_contract_audit.md and confirm the observed LINE-only contract provenance before approving public A/B traffic. |
| review-champion-integration-candidate | ready_local_review | Review the source-locked 3q-site patch and isolated integration smoke before approving any production deploy. |
| approve-champion-integration-production-deploy | pending_human | Confirm the current live integration provenance before approving any redeploy of the exact source-locked patch, collector URL, verification steps, and rollback plan. |
| review-next-round-plan | ready_local_review | Review next_round_plan.md before starting a new public A/B variable or extending the current test. |
| review-owner-approval-pack | ready_local_review | Review owner_approval_pack.md before approving remote D1, Worker deploy, public A/B routing, or GitHub publishing. |
| review-owner-console | ready_local_review | Review owner_console.html as the local single-screen approval surface. |
| review-real-data-input-pack | ready_local_review | Review real_data_input_pack.md before filling aggregate counts or copying templates into live input CSV filenames. |
| review-source-readiness | ready_local_review | Review source_readiness.md before interpreting sample gaps or approving any public A/B route. |
| review-source-capture-pack | ready_local_review | Review source_capture_pack.md before filling aggregate source counts or creating live input CSVs. |
| review-source-capture-compile | ready_local_review | Review source_capture_compile_report.md and owner-preview CSVs before copying them to live aggregate input filenames. |
| review-real-data-intake-plan | ready_local_review | Review real_data_intake_plan.md to see which aggregate CSV inputs are still missing. |
| review-data-collection-brief | ready_local_review | Review data_collection_brief.md and sample_gate_collection_plan.md before filling aggregate counts or compiling owner-preview CSVs. |
| review-line-inbound-playbook | ready_local_review | Review line_inbound_playbook.md before using it in manual LINE replies. |
| review-local-launchagent-install | completed_local_reversible | Local LaunchAgent is installed. Use npm run schedule:uninstall to stop the Sunday local runner. |
| approve-github-repo-and-pr | pending_human | Review the prepared local Champion commit, then explicitly approve its branch push or draft PR. Do not merge from this gate. |

## Next Verification Command

```zsh
cd /Users/mac/Documents/Codex/control-center/3q-growth-loop
npm run verify
npm run browser:smoke
npm run worker:dry-run:status
```
