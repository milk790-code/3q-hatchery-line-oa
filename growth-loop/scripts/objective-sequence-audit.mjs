import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const JSON_PATH = path.join(ROOT, "objective_sequence_audit.json");
const MD_PATH = path.join(ROOT, "objective_sequence_audit.md");
const STATUS_PATH = path.join(ROOT, "data", "objective_sequence_audit_status.json");

const EXPECTED_SEQUENCE = [
  "collect_data",
  "score_assets",
  "winners_losers",
  "content_mix",
  "generate_lp_challenger",
  "deploy_candidate_worker",
  "create_ab_plan",
  "weekly_report",
  "approval_queue",
];

const REQUIRED_OUTPUTS = [
  "weekly_report.md",
  "growth_scores.json",
  "approval_queue.json",
  "ab_test_status.json",
  "landing_page_candidate.html",
  "worker.ts",
  "worker_dry_run.md",
  "data/worker_dry_run_status.json",
  "prepared_but_blocked.json",
  "pipeline_status.json",
  "next_round_plan.json",
  "content_variants.json",
  "tracking_links.json",
  "funnel_breakdown.json",
  "funnel_breakdown.md",
  "goal_completion_audit.md",
  "data/goal_completion_audit_status.json",
  "north_star_funnel.json",
  "north_star_funnel.md",
  "schedule_catchup_status.md",
  "data/schedule_catchup_status.json",
  "data/approval_resume_fixture_status.json",
  "owner_approval_form.html",
  "data/owner_approval_form_status.json",
  "owner_approval_form_fixture_report.md",
  "data/owner_approval_form_fixture_status.json",
  "line_inbound_playbook.md",
  "line_inbound_playbook.json",
  "line_inbound_fixture_report.md",
  "data/line_inbound_fixture_status.json",
  "variable_rotation_fixture_report.md",
  "data/variable_rotation_fixture_status.json",
  "data/funnel_aggregate_status.json",
  "data/funnel_aggregates.example.csv",
  "data/funnel_aggregates.preview.jsonl",
  "data/funnel_aggregate_fixture_status.json",
  "funnel_aggregate_fixture_report.md",
  "data/real_data_apply_fixture_status.json",
  "real_data_apply_fixture_report.md",
  "data/real_data_input_pack_status.json",
  "real_data_input_pack.md",
  "data/real_data_input_pack/funnel_aggregates.fill-template.csv",
  "data/real_data_input_pack/manual_conversions.fill-template.csv",
  "data/source_readiness_status.json",
  "source_readiness.md",
  "data/champion_contract_audit_status.json",
  "data/cloudflare_3q_site_metrics_observation.json",
  "champion_contract_audit.md",
  "scripts/champion-contract-audit.mjs",
  "integrations/3q-site/champion-integration.config.json",
  "integrations/3q-site/wrangler.jsonc",
  "integrations/3q-site/source/worker.origin-main.js",
  "integrations/3q-site/generated/worker.candidate.js",
  "integrations/3q-site/generated/worker.candidate.patch",
  "scripts/build-champion-integration-candidate.mjs",
  "champion_integration_candidate.md",
  "data/champion_integration_candidate_status.json",
  "scripts/champion-integration-smoke.mjs",
  "champion_integration_smoke.md",
  "data/champion_integration_smoke_status.json",
  "scripts/cloudflare-d1-readiness.mjs",
  "cloudflare_d1_readiness.md",
  "data/cloudflare_d1_readiness_status.json",
  "data/cloudflare_d1_inventory_snapshot.json",
  "scripts/live-telemetry-readiness.mjs",
  "live_telemetry_readiness.md",
  "data/live_telemetry_readiness_status.json",
  "data/live_telemetry_observation_snapshot.json",
  "scripts/live-telemetry-readiness-fixtures.mjs",
  "live_telemetry_readiness_fixture_report.md",
  "data/live_telemetry_readiness_fixture_status.json",
  "scripts/lib/champion-source-lock.mjs",
  "scripts/champion-source-lock-fixtures.mjs",
  "champion_source_lock_fixtures.md",
  "data/champion_source_lock_fixture_status.json",
  "scripts/lib/run-lock-policy.mjs",
  "scripts/weekly-runner-lock-fixtures.mjs",
  "weekly_runner_lock_fixtures.md",
  "data/weekly_runner_lock_fixture_status.json",
  "scripts/d1-schema-contract.mjs",
  "d1_schema_contract.md",
  "data/d1_schema_contract_status.json",
  "scripts/approved-d1-config.mjs",
  "approved_d1_config.md",
  "data/approved_d1_config_status.json",
  "d1_collection_mode.md",
  "data/d1_collection_mode_status.json",
  "d1_collection_mode_plan.md",
  "data/d1_collection_mode_plan_status.json",
  "d1_collection_mode_fixture_report.md",
  "data/d1_collection_mode_fixture_status.json",
  "d1_aggregate_export_fixture_report.md",
  "data/d1_aggregate_export_fixture_status.json",
  "scripts/champion-local-branch.mjs",
  "champion_local_branch.md",
  "data/champion_local_branch_status.json",
  "scripts/champion-release-preflight.mjs",
  "champion_release_preflight.md",
  "data/champion_release_preflight_status.json",
  "data/champion_live_deployment_snapshot.json",
  "champion_release_owner_packet.md",
  "champion_release_owner_packet.json",
  "scripts/champion-github-handoff.mjs",
  "champion_github_handoff.md",
  "champion_github_pr_body.md",
  "data/champion_github_handoff_status.json",
  "data/source_capture_status.json",
  "source_capture_pack.md",
  "data/source_capture/source_capture_checklist.json",
  "data/source_capture/source_capture_ledger.fill-template.csv",
  "data/source_capture/sample_gate_ledger.fill-template.csv",
  "sample_gate_ledger.md",
  "data/sample_gate_ledger_status.json",
  "sample_gate_replay_fixture_report.md",
  "data/sample_gate_replay_fixture_status.json",
  "source_capture_compile_report.md",
  "data/source_capture_compile_status.json",
  "source_capture_compile_fixture_report.md",
  "data/source_capture_compile_fixture_status.json",
  "data/source_capture/compiled/funnel_aggregates.owner-preview.csv",
  "data/source_capture/compiled/manual_conversions.owner-preview.csv",
  "data/real_data_intake_status.json",
  "real_data_intake_plan.md",
  "data_collection_queue.json",
  "data_collection_brief.md",
  "data/data_collection_brief_status.json",
  "data_collection_progress.md",
  "data_collection_progress.json",
  "data/data_collection_progress_status.json",
  "source_trust_matrix.md",
  "source_trust_matrix.json",
  "data/source_trust_matrix_status.json",
  "scripts/source-trust-matrix.mjs",
  "next_p0_owner_inputs.md",
  "next_p0_owner_inputs.json",
  "data/next_p0_owner_inputs_status.json",
  "next_p0_owner_form.html",
  "data/next_p0_owner_form_status.json",
  "next_p0_owner_form_fixture_report.md",
  "data/next_p0_owner_form_fixture_status.json",
  "next_p0_owner_intake.md",
  "data/next_p0_owner_intake_status.json",
  "next_p0_owner_intake_fixture_report.md",
  "data/next_p0_owner_intake_fixture_status.json",
  "data/next_p0_owner_intake/funnel_aggregates.owner-preview.csv",
  "data/next_p0_owner_intake/manual_conversions.owner-preview.csv",
  "owner_data_preflight.md",
  "owner_data_preflight.json",
  "data/owner_data_preflight_status.json",
  "sample_gate_capture_calendar.json",
  "sample_gate_capture_calendar.md",
  "sample_gate_capture_calendar.ics",
  "data/sample_gate_capture_calendar_status.json",
  "sample_gate_due_status.json",
  "sample_gate_due_status.md",
  "data/sample_gate_due_status_status.json",
  "week0_owner_capture_queue.md",
  "week0_owner_capture_queue.json",
  "data/week0_owner_capture_queue_status.json",
  "owner_sample_gate_status.md",
  "owner_sample_gate_status.json",
  "data/owner_sample_gate_status.json",
  "sample_gate_owner_worksheet.md",
  "sample_gate_owner_worksheet.json",
  "data/sample_gate_owner_worksheet_status.json",
  "sample_gate_owner_form.html",
  "data/sample_gate_owner_form_status.json",
  "sample_gate_owner_form_fixture_report.md",
  "data/sample_gate_owner_form_fixture_status.json",
  "sample_gate_batch_handoff.md",
  "sample_gate_batch_handoff.json",
  "data/sample_gate_batch_handoff_status.json",
  "sample_gate_batch_1_paste_block.txt",
  "sample_gate_batch_2_paste_block.txt",
  "sample_gate_collection_sprint.md",
  "sample_gate_collection_sprint.json",
  "data/sample_gate_collection_sprint_status.json",
  "owner_sample_gate_fixture_report.md",
  "data/owner_sample_gate_fixture_status.json",
  "owner_quality_review.md",
  "owner_quality_review.example.json",
  "data/owner_quality_review_status.json",
  "owner_quality_review_form.html",
  "data/owner_quality_review_form_status.json",
  "owner_quality_review_form_fixture_report.md",
  "data/owner_quality_review_form_fixture_status.json",
  "owner_quality_review_fixture_report.md",
  "data/owner_quality_review_fixture_status.json",
  "candidate_retirement_fixture_report.md",
  "data/candidate_retirement_fixture_status.json",
  "sample_gate_collection_plan.json",
  "sample_gate_collection_plan.md",
  "data/sample_gate_collection_plan_status.json",
  "iteration_history.json",
  "iteration_history.md",
  "data/event_input_quality_status.json",
  "d1_collection_guard.md",
  "scripts/export-d1-events.mjs",
  "tracking_link_smoke.md",
  "data/tracking_link_smoke_status.json",
  "data/event_contract_smoke_status.json",
  "github_export_manifest.md",
  "data/github_export_status.json",
  "artifact_retention.md",
  "data/artifact_retention_status.json",
  "artifact_retention_review_pack.md",
  "artifact_retention_review_pack.json",
  "data/artifact_retention_review_status.json",
  "data/real_data_decision_replay_status.json",
  "real_data_decision_replay_report.md",
  "owner_gate_evidence.md",
  "owner_gate_evidence.example.json",
  "data/owner_gate_evidence_status.json",
  "owner_gate_evidence_fixture_report.md",
  "data/owner_gate_evidence_fixture_status.json",
  "post_gate_verification.md",
  "data/post_gate_verification_status.json",
  "post_gate_verification_fixture_report.md",
  "data/post_gate_verification_fixture_status.json",
  "redline_priority.md",
  "redline_priority.json",
  "data/redline_priority_status.json",
  ".github/workflows/3q-growth-loop-weekly.yml",
];

const REQUIRED_APPROVAL_IDS = [
  "collect-first-real-events",
  "approve-d1-create-and-migrate",
  "approve-candidate-worker-deploy",
  "approve-small-ab-link",
  "review-weekly-report",
  "review-next-round-plan",
  "review-owner-approval-pack",
  "review-real-data-input-pack",
  "review-source-readiness",
  "review-champion-integration-candidate",
  "approve-champion-integration-production-deploy",
  "review-source-capture-pack",
  "review-source-capture-compile",
  "review-real-data-intake-plan",
  "review-data-collection-brief",
  "approve-github-repo-and-pr",
];

const REQUIRED_BLOCKED_ACTIONS = [
  "change_primary_social_or_bio_link",
  "formal_social_post_or_line_push",
  "github_push_or_pr_creation",
  "customer_data_or_ecpay_payment_mutation",
];

const RED_LINE_FLAGS = [
  "public_link_change_performed",
  "production_deploy_performed",
  "github_push_or_pr_performed",
  "formal_post_performed",
  "line_push_performed",
  "customer_data_mutation_performed",
  "payment_action_performed",
  "delete_action_performed",
];

async function main() {
  const generatedAt = new Date();
  const config = await readJson("config/growth-loop.config.json");
  const pipeline = await readJson("pipeline_status.json");
  const scores = await readJson("growth_scores.json");
  const ab = await readJson("ab_test_status.json");
  const approval = await readJson("approval_queue.json");
  const blocked = await readJson("prepared_but_blocked.json");
  const variants = await readJson("content_variants.json");
  const trackingLinks = await readJson("tracking_links.json");
  const funnelBreakdown = await readJson("funnel_breakdown.json");
  const northStar = await readJson("north_star_funnel.json");
  const nextRound = await readJson("next_round_plan.json");
  const schedule = await readJson("data/schedule_status.json");
  const scheduleCatchup = await readJson("data/schedule_catchup_status.json");
  const launchReadiness = await readJson("launch_readiness.json");
  const manual = await readJson("data/manual_conversion_status.json");
  const funnelAggregate = await readJson("data/funnel_aggregate_status.json");
  const funnelAggregateFixtures = await readJson("data/funnel_aggregate_fixture_status.json");
  const realDataApplyFixtures = await readJson("data/real_data_apply_fixture_status.json");
  const realDataInputPack = await readJson("data/real_data_input_pack_status.json");
  const sourceReadiness = await readJson("data/source_readiness_status.json");
  const championContractAudit = await readJson("data/champion_contract_audit_status.json");
  const championIntegrationCandidate = await readJson("data/champion_integration_candidate_status.json");
  const championSourceLockFixtures = await readJson("data/champion_source_lock_fixture_status.json");
  const championIntegrationSmoke = await readJson("data/champion_integration_smoke_status.json");
  const cloudflareD1Readiness = await readJson("data/cloudflare_d1_readiness_status.json");
  const cloudflareD1Inventory = await readJson("data/cloudflare_d1_inventory_snapshot.json");
  const liveTelemetryReadiness = await readJson("data/live_telemetry_readiness_status.json");
  const liveTelemetryReadinessFixtures = await readJson("data/live_telemetry_readiness_fixture_status.json");
  const d1SchemaContract = await readJson("data/d1_schema_contract_status.json");
  const approvedD1Config = await readJson("data/approved_d1_config_status.json");
  const d1CollectionMode = await readJson("data/d1_collection_mode_status.json");
  const d1CollectionModePlan = await readJson("data/d1_collection_mode_plan_status.json");
  const d1CollectionModeFixtures = await readJson("data/d1_collection_mode_fixture_status.json");
  const d1AggregateExportFixtures = await readJson("data/d1_aggregate_export_fixture_status.json");
  const championLocalBranch = await readJson("data/champion_local_branch_status.json");
  const championReleasePreflight = await readJson("data/champion_release_preflight_status.json");
  const championLiveSnapshot = await readJson("data/champion_live_deployment_snapshot.json");
  const championReleaseOwnerPacket = await readJson("champion_release_owner_packet.json");
  const championGithubHandoff = await readJson("data/champion_github_handoff_status.json");
  const sourceCapture = await readJson("data/source_capture_status.json");
  const sampleGateReplay = await readJson("data/sample_gate_replay_fixture_status.json");
  const sourceCompile = await readJson("data/source_capture_compile_status.json");
  const sourceCompileFixtures = await readJson("data/source_capture_compile_fixture_status.json");
  const realDataIntake = await readJson("data/real_data_intake_status.json");
  const dataCollection = await readJson("data_collection_queue.json");
  const dataCollectionStatus = await readJson("data/data_collection_brief_status.json");
  const dataCollectionProgress = await readJson("data/data_collection_progress_status.json");
  const sourceTrustMatrix = await readJson("source_trust_matrix.json");
  const sourceTrustMatrixStatus = await readJson("data/source_trust_matrix_status.json");
  const nextP0OwnerInputs = await readJson("data/next_p0_owner_inputs_status.json");
  const nextP0OwnerForm = await readJson("data/next_p0_owner_form_status.json");
  const nextP0OwnerFormFixtures = await readJson("data/next_p0_owner_form_fixture_status.json");
  const nextP0OwnerIntake = await readJson("data/next_p0_owner_intake_status.json");
  const nextP0OwnerIntakeFixtures = await readJson("data/next_p0_owner_intake_fixture_status.json");
  const ownerDataPreflight = await readJson("data/owner_data_preflight_status.json");
  const sampleGateCaptureCalendar = await readJson("data/sample_gate_capture_calendar_status.json");
  const sampleGateDueStatus = await readJson("data/sample_gate_due_status_status.json");
  const ownerCaptureQueue = await readJson("data/week0_owner_capture_queue_status.json");
  const ownerSampleGate = await readJson("data/owner_sample_gate_status.json");
  const sampleGateOwnerWorksheet = await readJson("data/sample_gate_owner_worksheet_status.json");
  const sampleGateOwnerForm = await readJson("data/sample_gate_owner_form_status.json");
  const sampleGateOwnerFormFixtures = await readJson("data/sample_gate_owner_form_fixture_status.json");
  const sampleGateBatchHandoff = await readJson("data/sample_gate_batch_handoff_status.json");
  const sampleGateCollectionSprint = await readJson("data/sample_gate_collection_sprint_status.json");
  const ownerSampleGateFixtures = await readJson("data/owner_sample_gate_fixture_status.json");
  const ownerQualityReview = await readJson("data/owner_quality_review_status.json");
  const ownerQualityReviewForm = await readJson("data/owner_quality_review_form_status.json");
  const ownerQualityReviewFormFixtures = await readJson("data/owner_quality_review_form_fixture_status.json");
  const ownerQualityReviewFixtures = await readJson("data/owner_quality_review_fixture_status.json");
  const candidateRetirementFixtures = await readJson("data/candidate_retirement_fixture_status.json");
  const sampleGatePlan = await readJson("sample_gate_collection_plan.json");
  const sampleGateStatus = await readJson("data/sample_gate_collection_plan_status.json");
  const iterationHistory = await readJson("iteration_history.json");
  const approvalFixtures = await readJson("data/approval_resume_fixture_status.json");
  const lineInbound = await readJson("data/line_inbound_fixture_status.json");
  const variableRotation = await readJson("data/variable_rotation_fixture_status.json");
  const eventInputQuality = await readJson("data/event_input_quality_status.json");
  const browser = await readJson("data/browser_smoke_status.json");
  const workerDryRun = await readJson("data/worker_dry_run_status.json");
  const trackingSmoke = await readJson("data/tracking_link_smoke_status.json");
  const eventSmoke = await readJson("data/event_contract_smoke_status.json");
  const fixtures = await readJson("data/win_rule_fixture_status.json");
  const decisionReplay = await readJson("data/real_data_decision_replay_status.json");
  const githubExport = await readJson("data/github_export_status.json");
  const artifactRetention = await readJson("data/artifact_retention_status.json");
  const artifactRetentionReview = await readJson("data/artifact_retention_review_status.json");
  const githubWorkflow = await readFile(".github/workflows/3q-growth-loop-weekly.yml", "utf8");
  const ownerApprovalForm = await readJson("data/owner_approval_form_status.json");
  const ownerApprovalFormFixtures = await readJson("data/owner_approval_form_fixture_status.json");
  const ownerEvidence = await readJson("data/owner_gate_evidence_status.json");
  const ownerEvidenceFixtures = await readJson("data/owner_gate_evidence_fixture_status.json");
  const postGate = await readJson("data/post_gate_verification_status.json");
  const postGateFixtures = await readJson("data/post_gate_verification_fixture_status.json");
  const redlinePriority = await readJson("data/redline_priority_status.json");
  const weeklyRunner = await readOptionalJson("data/weekly_runner_status.json");
  const weeklyRunnerLockFixtures = await readJson("data/weekly_runner_lock_fixture_status.json");
  const weeklyRunnerSource = await readFile("scripts/weekly-runner.mjs", "utf8");
  const launchAgentRuntimeProof = launchAgentRuntimeProofStatus(schedule, weeklyRunner);
  const outputStatus = await fileStatus(REQUIRED_OUTPUTS);
  const checks = [];
  const requiredBlockedActions = [
    ...REQUIRED_BLOCKED_ACTIONS,
    liveTelemetryReadiness.candidate_worker?.deployment_observed === true
      && liveTelemetryReadiness.candidate_worker?.health_ok === true
      && liveTelemetryReadiness.candidate_worker?.deploy_required === false
      ? "confirm_existing_candidate_worker_provenance"
      : liveTelemetryReadiness.candidate_worker?.deployment_observed === true
        && liveTelemetryReadiness.candidate_worker?.health_ok === true
        ? "deploy_candidate_worker_security_update"
        : "deploy_candidate_worker",
    cloudflareD1Readiness.decision?.dedicated_database_present === true
      && cloudflareD1Readiness.decision?.configured_id_matches === true
      ? "verify_existing_cloudflare_d1_and_apply_schema"
      : "create_cloudflare_d1_and_apply_schema",
  ];

  check(checks, "config_weekly_sequence_exact", sameList(config.weekly_sequence, EXPECTED_SEQUENCE), "config/growth-loop.config.json matches the requested Sunday sequence.");
  check(checks, "weekly_runner_lock_policy_fixtures", weeklyRunnerLockFixturesCheck(weeklyRunnerLockFixtures), "Lock fixtures prove a live PID always owns the run regardless of age and only dead/invalid owners are recovered.");
  check(checks, "pipeline_weekly_sequence_exact", sameList(pipeline.weekly_sequence, EXPECTED_SEQUENCE), "pipeline_status.json preserves the requested sequence.");
  check(checks, "pipeline_steps_exact_order", sameList((pipeline.steps ?? []).map((step) => step.step), EXPECTED_SEQUENCE), "pipeline_status.json has one evidence row per requested step.");
  check(checks, "weekly_runner_concurrency_guard", weeklyRunnerConcurrencyCheck(weeklyRunnerSource), "Weekly runner uses an atomic process lock and atomic status replacement so overlapping manual, LaunchAgent, or agent invocations cannot corrupt the authoritative run state.");
  check(checks, "all_requested_outputs_present", outputStatus.every((file) => file.present), "All objective output artifacts exist.");
  check(checks, "north_star_event_types_scored", scores.assets.every((asset) => ["link_clicks", "line_adds", "leads", "deals"].every((key) => key in asset)), "Scores include link clicks, LINE adds, leads, and deals.");
  check(checks, "north_star_funnel_contract", northStarCheck(northStar, scores, funnelBreakdown, ownerSampleGate), "North Star funnel reports LINE adds, leads, and deals per 100 link clicks without event writes or external effects.");
  check(checks, "one_variable_allowed", config.one_variable_per_round.includes(ab.changed_variable), "The changed variable is one of hook / offer / visual_claim / cta_text.");
  check(checks, "one_variable_consistent", variants.one_variable_rule_ok === true && variants.drafts.every((draft) => draft.changed_variable === ab.changed_variable), "Content drafts only change the active variable.");
  check(checks, "one_variable_rotation_fixtures_cover_all_variables", variableRotationCheck(variableRotation, config.one_variable_per_round), "Fixture-only rotation coverage proves hook, offer, visual_claim, and cta_text can each vary alone.");
  check(checks, "content_variant_tracking_unique", contentVariantTrackingCheck(trackingLinks, variants, funnelBreakdown), "Each draft has a unique post-level tracking link and content attribution row.");
  check(checks, "sample_gate_exact", thresholdsMatch(scores.thresholds), "Sample thresholds match the objective.");
  check(checks, "next_round_keeps_variable_when_sample_insufficient", sampleGateCheck(ab, nextRound), "Sample-insufficient rounds keep the current champion and variable.");
  check(checks, "win_rule_exact", winRuleMatch(scores.win_rule), "Win rule requires 1.15 lift, sample threshold, and no quality regression.");
  check(checks, "winning_challenger_never_auto_promotes", ab.decision !== "queue_human_promotion_review" || ab.challenger_win_rule_met === true, "Winning challenger can only be queued for human review.");
  check(checks, "ab_small_traffic_local_only", ab.traffic_allocation?.champion === 90 && ab.traffic_allocation?.challenger === 10 && ab.public_link_change_performed === false, "A/B plan is 90/10 and does not change public links.");
  check(checks, "manual_conversion_preview_only", manual.mode === "preview" && manual.apply_performed === false && manual.external_effect === false, "Manual conversion import remains preview-only.");
  check(checks, "line_inbound_playbook_aggregate_only", lineInboundCheck(lineInbound), "LINE inbound playbook stays manual, inbound-only, aggregate-only, and blocks sensitive customer fields.");
  check(checks, "event_input_quality_gate", eventInputQualityCheck(eventInputQuality), "Real lp_events input is scanned for PII, unknown assets, duplicates, and malformed rows before scoring.");
  check(checks, "funnel_aggregate_preview_only", funnelAggregateCheck(funnelAggregate), "Full-funnel aggregate import previews top-to-bottom event counts without scoring or writing real lp_events.");
  check(checks, "funnel_aggregate_fixtures_cover_import_gates", funnelAggregateFixtureCheck(funnelAggregateFixtures), "Full-funnel aggregate fixtures block unknown assets, missing attribution, sensitive columns, sensitive values, and unsafe apply attempts.");
  check(checks, "real_data_apply_fixtures_block_examples", realDataApplyFixtureCheck(realDataApplyFixtures), "Real-data apply fixtures block unconfirmed apply commands and copied example/template CSVs before they can write data/lp_events.jsonl.");
  check(checks, "real_data_input_pack_template_only", realDataInputPackCheck(realDataInputPack), "Real-data input pack creates fill templates only and never creates live input CSVs or writes data/lp_events.jsonl.");
  check(checks, "source_readiness_covers_funnel_stages", sourceReadinessCheck(sourceReadiness), "Source readiness covers every north-star funnel event stage and remains read-only.");
  check(checks, "champion_contract_audit_blocks_false_leads", championContractAuditCheck(championContractAudit), "Live champion URL and LINE destination are observed read-only; local-only success UI is never counted as a lead.");
  check(checks, "champion_integration_candidate_source_locked", championIntegrationCandidateCheck(championIntegrationCandidate), "Source-locked 3q-site candidate removes false-success lead UI and prepares no-PII page_view/cta_click telemetry without deployment.");
  check(checks, "champion_source_lock_fixture_matrix", championSourceLockFixturesCheck(championSourceLockFixtures), "Isolated fixtures prove pinned-ref, ancestry, target-drift, tuple-integrity, and missing-repo fail-closed behavior.");
  check(checks, "cloudflare_d1_metadata_readiness", cloudflareD1ReadinessCheck(cloudflareD1Readiness, cloudflareD1Inventory), "Read-only D1 metadata inventory detects whether the dedicated Growth Loop database exists without querying tables, reading customer data, or reusing CRM databases.");
  check(checks, "live_telemetry_chain_observed_and_owner_gated", liveTelemetryReadinessCheck(liveTelemetryReadiness), "Live observation mirrors the validated Candidate/Champion/D1 evidence state while keeping all reads aggregate-only and any redeploy separately gated.");
  check(checks, "live_telemetry_readiness_fixture_states", liveTelemetryReadinessFixtureCheck(liveTelemetryReadinessFixtures), "Fixture states prove deployment observation, schema evidence, and recurring aggregate-read authorization are independent without a live network refresh, table query, event POST, or external effect.");
  check(checks, "d1_schema_idempotency_contract", d1SchemaContract.ok === true && Object.values(d1SchemaContract.checks ?? {}).every(Boolean) && d1SchemaContract.remote_d1_migration_performed === false && d1SchemaContract.external_effect === false, "Week 0 D1 schema applies twice in disposable local state and passes integrity, seed, and constraint checks without remote D1 access.");
  check(checks, "approved_d1_config_guard_preview", approvedD1Config.ok === true && approvedD1Config.mode === "approved_d1_config_preview_local_only" && approvedD1Config.local_config_write_performed === false && approvedD1Config.remote_d1_migration_performed === false, "D1 id config guard remains preview-only until explicit owner approval and exact live metadata match.");
  check(checks, "d1_collection_selector_defaults_local", d1CollectionMode.ok === true && d1CollectionMode.mode === "owner_evidence_driven_d1_collection_selector" && ["local_review_only", "remote_aggregate_only"].includes(d1CollectionMode.selected_scope) && d1CollectionMode.remote_read_authorized === (d1CollectionMode.selected_scope === "remote_aggregate_only") && d1CollectionMode.remote_read_performed === (d1CollectionMode.selected_scope === "remote_aggregate_only") && d1CollectionMode.raw_event_rows_read_performed === false && d1CollectionMode.customer_data_read_performed === false, "Weekly collect_data stays local until matching evidence exists, then permits only the approved aggregate-only remote path.");
  check(checks, "d1_collection_selector_fixture_gates", d1CollectionModePlan.ok === true && d1CollectionModePlan.plan_only === true && d1CollectionModeFixtures.ok === true && d1CollectionModeFixtures.scenario_count === 5 && d1CollectionModeFixtures.scenarios?.find((item) => item.id === "valid_owner_evidence_selects_remote_aggregate_plan")?.remote_read_authorized === true && d1CollectionModeFixtures.remote_read_performed === false, "Plan-only fixtures prove only matching owner evidence, recurring-read approval, and post-gate readiness select remote aggregate collection.");
  check(checks, "d1_remote_export_aggregate_only_fixture", d1AggregateExportFixtures.ok === true && d1AggregateExportFixtures.scenario_count === 2 && d1AggregateExportFixtures.real_remote_cli_performed === false && d1AggregateExportFixtures.raw_event_rows_read_performed === false && d1AggregateExportFixtures.customer_data_read_performed === false && d1AggregateExportFixtures.scenarios?.find((item) => item.id === "fixture_wrangler_proves_aggregate_only_export")?.sql_has_forbidden_fields === false, "Fixture Wrangler proves the approved remote path reads grouped counts only and excludes raw session, URL, referrer, metadata, and customer fields.");
  check(checks, "champion_local_feature_commit", championLocalBranchCheck(championLocalBranch, championIntegrationCandidate), "Champion release stack descends from the exact source lock, changes only the Worker and optional binding-preservation workflow, and this audit performs no GitHub write.");
  check(checks, "champion_release_preflight_clean_source", championReleasePreflightCheck(championReleasePreflight, championLiveSnapshot, championReleaseOwnerPacket), "Champion patch applies to a clean git archive or locked snapshot, matches the generated candidate byte-for-byte, and passes both Wrangler dry-run command shapes with an owner-gated rollback packet.");
  check(checks, "champion_github_handoff_exact_and_gated", championGithubHandoff.ok === true && championGithubHandoff.repository?.slug === "milk790-code/3q-hatchery-line-oa" && championGithubHandoff.pull_request?.draft_required === true && championGithubHandoff.pull_request?.merge_permitted === false && championGithubHandoff.github_push_or_pr_performed === false, "Champion GitHub handoff targets the exact known repo, branch, and commit, stops at a draft PR, and performs no GitHub write.");
  check(checks, "source_capture_pack_template_only", sourceCaptureCheck(sourceCapture), "Source capture pack maps tracking links and funnel stages to aggregate-only owner capture rows without creating live inputs or writing data/lp_events.jsonl.");
  check(checks, "sample_gate_replay_fixtures_cover_fast_path", sampleGateReplayCheck(sampleGateReplay), "Sample-gate replay fixtures prove the 18-row owner-filled fast path can compile and preview sample decisions without writing data/lp_events.jsonl.");
  check(checks, "source_capture_compile_preview_only", sourceCompileCheck(sourceCompile), "Source capture compile validates filled owner ledgers and emits owner-preview CSVs without creating live inputs or writing data/lp_events.jsonl.");
  check(checks, "source_capture_compile_fixtures_cover_gates", sourceCompileFixtureCheck(sourceCompileFixtures), "Source capture compile fixtures cover valid filled rows, empty templates, partial blanks, PII, bad dates, and invalid target files.");
  check(checks, "real_data_intake_plan_owner_gated", realDataIntakeCheck(realDataIntake), "Real-data intake plan checks reviewed aggregate CSVs and produces owner-gated local apply commands without writing data/lp_events.jsonl.");
  check(checks, "data_collection_brief_owner_queue", dataCollectionBriefCheck(dataCollection, dataCollectionStatus, sampleGatePlan, sampleGateStatus), "Data collection brief converts missing funnel-stage source data into owner-reviewed aggregate-count tasks without creating live inputs or writing data/lp_events.jsonl.");
  check(checks, "source_trust_matrix_blocks_untrusted_inputs", sourceTrustMatrixCheck(sourceTrustMatrix, sourceTrustMatrixStatus, dataCollectionProgress), "Source trust matrix separates scoring-ready inputs from local D1 smoke rows and owner-preview artifacts before sample-gate decisions.");
  check(checks, "next_p0_owner_form_safe", nextP0OwnerFormCheck(nextP0OwnerForm, nextP0OwnerInputs), "Focused Next P0 browser form exposes only the current owner aggregate rows, exports review files locally, and performs no network calls, staging, or event writes.");
  check(checks, "next_p0_owner_form_fixtures_safe", nextP0OwnerFormFixtureCheck(nextP0OwnerFormFixtures, nextP0OwnerForm), "Focused Next P0 browser form fixture verifies local-only HTML, aggregate-only export contract, and false red-line flags.");
  check(checks, "next_p0_owner_intake_preview_only", nextP0OwnerIntakeCheck(nextP0OwnerIntake, nextP0OwnerInputs), "Focused Next P0 owner-download intake validates aggregate CSVs and emits owner-preview CSVs without event writes or external effects.");
  check(checks, "next_p0_owner_intake_fixtures_safe", nextP0OwnerIntakeFixtureCheck(nextP0OwnerIntakeFixtures, nextP0OwnerInputs), "Focused Next P0 intake fixtures cover valid preview, quick-preview auto-intake, sensitive blocking, and confirmed temp staging without writing project live inputs.");
  check(checks, "owner_data_preflight_local_only", ownerDataPreflightCheck(ownerDataPreflight), "Owner data preflight previews sample-gate and win-rule decisions from aggregate preview CSVs without applying data or executing external gates.");
  check(checks, "sample_gate_capture_calendar_local_only", sampleGateCaptureCalendarCheck(sampleGateCaptureCalendar, nextP0OwnerInputs, dataCollectionProgress), "Sample-gate capture calendar turns Day 3 / Day 7 checkpoints into local-only review artifacts without importing calendars or creating reminders.");
  check(checks, "sample_gate_due_status_local_only", sampleGateDueStatusCheck(sampleGateDueStatus, sampleGateCaptureCalendar, nextP0OwnerInputs, dataCollectionProgress), "Sample-gate due status turns Day 3 / Day 7 timing into a local operator signal without importing calendars, opening browsers, writing events, or changing winners.");
  check(checks, "week0_owner_capture_queue_shortens_sample_gate_collection", ownerCaptureQueueCheck(ownerCaptureQueue, sampleGateStatus), "Week 0 owner capture queue reduces collection to P0 sample-gate counts and remains local-only.");
  check(checks, "owner_sample_gate_status_keeps_promotion_blocked", ownerSampleGateCheck(ownerSampleGate), "Owner sample-gate status reads filled aggregate counts, reports threshold gaps, and never promotes or applies data automatically.");
  check(checks, "sample_gate_owner_worksheet_safe", sampleGateOwnerWorksheetCheck(sampleGateOwnerWorksheet, ownerSampleGate), "Owner sample-gate worksheet covers 18 P0 rows and remains local-only.");
  check(checks, "sample_gate_owner_form_safe", sampleGateOwnerFormCheck(sampleGateOwnerForm), "Owner sample-gate browser form covers 18 P0 rows, exports local files only, and performs no network calls or event writes.");
  check(checks, "sample_gate_owner_form_fixtures_safe", sampleGateOwnerFormFixtureCheck(sampleGateOwnerFormFixtures), "Owner sample-gate browser form fixtures replay downloaded CSVs through source compile and owner sample-gate status without live writes or promotion.");
  check(checks, "sample_gate_batch_handoff_full_p0_coverage", sampleGateBatchHandoffCheck(sampleGateBatchHandoff, sampleGateStatus, nextP0OwnerInputs), "P0 sample-gate batch handoff maps the full 18-row coverage into focused and remaining owner-count batches without event writes or external effects.");
  check(checks, "sample_gate_collection_sprint_local_only", sampleGateCollectionSprintCheck(sampleGateCollectionSprint, sampleGateBatchHandoff, dataCollectionProgress), "Sample-gate collection sprint turns due state and P0 gaps into a local owner queue without event writes or external effects.");
  check(checks, "owner_sample_gate_fixtures_cover_decision_paths", ownerSampleGateFixtureCheck(ownerSampleGateFixtures), "Owner sample-gate fixtures cover missing, partial, insufficient, winning-review, underperform, and sensitive-evidence paths without real writes or promotion.");
  check(checks, "owner_quality_review_gate_local_only", ownerQualityReviewCheck(ownerQualityReview, ownerSampleGate), "Owner quality review validates aggregate no-quality-regression evidence after a sample-rate winner and still never promotes.");
  check(checks, "owner_quality_review_form_safe", ownerQualityReviewFormCheck(ownerQualityReviewForm, ownerQualityReview), "Owner quality-review browser form exports local aggregate JSON only and performs no network calls, event writes, approval queue writes, or promotion.");
  check(checks, "owner_quality_review_form_fixtures_safe", ownerQualityReviewFormFixtureCheck(ownerQualityReviewFormFixtures), "Owner quality-review browser form fixtures replay downloaded JSON through quality review without live writes, approval queue writes, or promotion.");
  check(checks, "owner_quality_review_fixtures_cover_quality_paths", ownerQualityReviewFixtureCheck(ownerQualityReviewFixtures), "Owner quality-review fixtures cover waiting, missing evidence, passing evidence, regression, sensitive evidence, and missing fields without external effects.");
  check(checks, "candidate_retirement_fixtures_cover_rotation_paths", candidateRetirementFixtureCheck(candidateRetirementFixtures), "Candidate retirement fixtures cover sample-insufficient keep-testing, owner promotion review, underperforming retirement, quality-regression retirement, unknown candidates, and mixed summaries without deletion or external effects.");
  check(checks, "iteration_history_local_only", iterationHistoryCheck(iterationHistory, nextRound), "Iteration history records the 7-day loop status, sample gate, archive history, and next safe actions without external effects.");
  check(checks, "worker_dry_run_no_deploy", workerDryRunCheck(workerDryRun), "Candidate Worker dry-run validates the bundle and bindings while preserving no-deploy and no-external-effect flags.");
  check(checks, "browser_smoke_no_event_write", browser.ok === true && browser.event_write_performed === false && browser.external_effect === false, "Browser route smoke is local and does not write events.");
  check(checks, "tracking_link_smoke_covers_generated_links", trackingLinkSmokeCheck(trackingSmoke, trackingLinks), "Generated tracking links redirect correctly in isolated local smoke without following external URLs or writing real events.");
  check(checks, "event_contract_smoke_isolated", eventContractCheck(eventSmoke), "Worker /e writes expected synthetic funnel events into isolated local D1, rejects sensitive metadata, and preserves redirect attribution.");
  check(checks, "champion_integration_smoke_isolated", championIntegrationSmokeCheck(championIntegrationSmoke), "3q-site candidate and collector pass a two-Worker localhost smoke with exact-origin CORS, no sensitive rows, and no inferred line_add.");
  check(checks, "win_rule_fixtures_cover_gates", fixtureCheck(fixtures), "Win-rule fixtures cover sample insufficient, winner review only, underperform, and quality regression.");
  check(checks, "real_data_decision_replay_covers_import_to_decision", decisionReplayCheck(decisionReplay), "Real-data-shaped filled source-capture ledgers compile to owner-preview aggregate CSVs, then replay through scoring, A/B decision, and next-round planning without writing data/lp_events.jsonl.");
  check(checks, "sunday_local_schedule", schedule.cadence === "weekly_sunday" && schedule.local_schedule?.weekday === "Sunday" && schedule.local_runner_command === "npm run weekly:local", "Local weekly schedule targets Sunday and weekly:local.");
  check(checks, "launchagent_runtime_proof", launchAgentRuntimeProof.ok, launchAgentRuntimeProof.proof_kind === "completed_exit_zero" ? "The installed macOS LaunchAgent has completed at least one real weekly runner invocation with exit code 0." : "This audit is executing inside the loaded LaunchAgent after every pre-audit weekly command succeeded; completion remains pending until launchd records exit code 0.");
  check(checks, "schedule_catchup_monitor_local_only", scheduleCatchupCheck(scheduleCatchup), "Local catch-up monitor detects missed weekly windows without invoking weekly:local or external actions.");
  check(checks, "approval_queue_has_required_gates", REQUIRED_APPROVAL_IDS.filter((id) => id !== "collect-first-real-events").every((id) => approval.items.some((item) => item.id === id)) && (approval.items.some((item) => item.id === "collect-first-real-events") || sourceTrustMatrix.real_event_rows > 0), "Approval queue includes every unresolved review or external gate and may retire the first-event item after trusted events arrive.");
  check(checks, "approval_resume_fixtures_plan_only", approvalFixtureCheck(approvalFixtures), "Owner approval resume fixtures stay dry-run only and cover placeholders, valid metadata, secret rejection, URL validation, and manual-only gates.");
  check(checks, "owner_approval_form_safe", ownerApprovalFormCheck(ownerApprovalForm), "Owner approval browser form exports non-secret approval metadata only and performs no network call, live input write, gate execution, deploy, GitHub, public link, LINE, payment, customer-data, or delete action.");
  check(checks, "owner_approval_form_fixtures_plan_only", ownerApprovalFormFixtureCheck(ownerApprovalFormFixtures), "Owner approval form fixtures replay exports through the dry-run resume planner, block placeholders and sensitive metadata, and never create live input files or execute external actions.");
  check(checks, "owner_gate_evidence_intake_evidence_only", ownerEvidenceCheck(ownerEvidence), "Owner gate evidence intake validates non-secret post-gate metadata only and performs no external action.");
  check(checks, "owner_gate_evidence_fixtures_cover_intake_gates", ownerEvidenceFixtureCheck(ownerEvidenceFixtures), "Owner gate evidence fixtures cover missing, placeholder, valid, sensitive, invalid A/B, duplicate, manual-only, and invalid GitHub evidence without external action.");
  check(checks, "post_gate_verification_plan_local_only", postGateVerificationCheck(postGate), "Post-gate verification remains local-only and performs no network, remote CLI, deploy, push, public link, LINE, payment, customer-data, or delete action.");
  check(checks, "post_gate_verification_fixtures_cover_plan_gates", postGateVerificationFixtureCheck(postGateFixtures), "Post-gate verification fixtures separate schema evidence readiness from recurring-read authorization while covering dependencies, manual-only gates, and invalid evidence without external action.");
  check(checks, "github_export_bundle_local_only", githubExportCheck(githubExport), "GitHub export bundle is repo-ready locally, excludes live owner inputs, and performs no git init, commit, push, PR, deploy, send, payment, customer-data, or delete actions.");
  check(checks, "artifact_retention_monitor_local_only", artifactRetentionCheck(artifactRetention), "Artifact retention monitor reports local bundle/archive/log growth for owner review without generating or executing cleanup commands.");
  check(checks, "artifact_retention_review_pack_local_only", artifactRetentionReviewCheck(artifactRetentionReview, artifactRetention), "Artifact retention review pack converts monitor output into owner-only cleanup review without commands, mutation, deletion, or external effects.");
  check(checks, "github_actions_weekly_verify_only", githubActionsWorkflowCheck(githubWorkflow), "GitHub Actions workflow is prepared for weekly verify/artifact upload only, with no deploy, push, LINE, payment, customer-data, or delete step.");
  check(checks, "prepared_but_blocked_has_required_redlines", requiredBlockedActions.every((action) => blocked.items.some((item) => item.action === action)), "PreparedButBlocked includes current-state red-line actions without asking for duplicate resource creation.");
  check(checks, "redline_priority_covers_blocked_queue", redlinePriorityCheck(redlinePriority, blocked), "Red-line priority queue covers every PreparedButBlocked action and keeps external gates non-autorun.");
  check(checks, "launch_readiness_owner_gated", launchReadiness.status === "owner_approval_required" && launchReadiness.owner_decision_required === true, "Launch readiness remains owner-gated.");
  check(checks, "red_line_flags_false", redLineFlagsFalse([pipeline, ab, nextRound.next_round ?? {}, launchReadiness.safety_invariants ?? {}, weeklyRunner ?? {}]), "No local artifact claims prohibited external actions.");

  const audit = {
    ok: checks.every((item) => item.ok),
    generated_at: generatedAt.toISOString(),
    status: "local_objective_contract_verified_external_gated",
    mode: config.mode,
    week: scores.week,
    objective_sequence: EXPECTED_SEQUENCE,
    sequence_status: {
      config_sequence_ok: sameList(config.weekly_sequence, EXPECTED_SEQUENCE),
      pipeline_sequence_ok: sameList(pipeline.weekly_sequence, EXPECTED_SEQUENCE),
      pipeline_steps_ok: sameList((pipeline.steps ?? []).map((step) => step.step), EXPECTED_SEQUENCE),
      weekly_runner_command_present: (weeklyRunner?.commands ?? []).some((command) => command.step === "objective_sequence_audit"),
    },
    weekly_runner_concurrency: {
      atomic_run_lock: weeklyRunnerSource.includes("mkdir(RUN_LOCK_PATH") && weeklyRunnerSource.includes('open(path.join(RUN_LOCK_PATH, RUN_LOCK_CLAIM_NAME), "wx"'),
      overlapping_run_skips_without_status_overwrite: weeklyRunnerSource.includes('status: "already_running"'),
      stale_lock_recovery: weeklyRunnerSource.includes("recoveryClaimDecision") && weeklyRunnerSource.includes("observeProcessIdentity"),
      lock_policy_fixtures_ok: weeklyRunnerLockFixtures.ok === true,
      atomic_status_replace: weeklyRunnerSource.includes("rename(temporaryPath, STATUS_PATH)"),
    },
    north_star_per_100_clicks: (scores.assets ?? []).map(per100Clicks),
    one_variable_contract: {
      changed_variable: ab.changed_variable,
      allowed_variables: config.one_variable_per_round,
      one_variable_rule_ok: ab.one_variable_rule_ok === true && variants.one_variable_rule_ok === true,
      locked_variables: variants.locked_variables,
    },
    variable_rotation_fixtures: {
      ok: variableRotation.ok,
      mode: variableRotation.mode,
      scenario_count: variableRotation.scenario_count,
      candidate_template_count: variableRotation.candidate_template_count,
      allowed_variables: variableRotation.allowed_variables,
      expected_variables: variableRotation.expected_variables,
      live_config_write_performed: variableRotation.live_config_write_performed,
      external_effect: variableRotation.external_effect,
      scenarios: (variableRotation.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        changed_variable: scenario.changed_variable,
        ok: scenario.ok,
        draft_count: scenario.draft_count,
        changed_value_count: scenario.changed_value_count,
        locked_variables_ok: scenario.locked_variables_ok,
        changed_only_ok: scenario.changed_only_ok,
      })),
    },
    funnel_breakdown: {
      ok: contentVariantTrackingCheck(trackingLinks, variants, funnelBreakdown),
      mode: funnelBreakdown.mode,
      rows: funnelBreakdown.summary?.rows,
      content_variant_links: funnelBreakdown.summary?.content_variant_links,
      real_events: funnelBreakdown.summary?.real_events,
      external_effect: funnelBreakdown.external_effect,
      public_link_change_performed: funnelBreakdown.public_link_change_performed,
      formal_post_performed: funnelBreakdown.formal_post_performed,
    },
    sample_gate: {
      thresholds: scores.thresholds,
      sample_threshold_met: ab.sample_threshold_met,
      next_round_decision: nextRound.decision,
      next_changed_variable: nextRound.next_round?.changed_variable,
      start_new_variable_round: nextRound.next_round?.start_new_variable_round,
    },
    worker_dry_run: {
      ok: workerDryRun.ok,
      mode: workerDryRun.mode,
      command: workerDryRun.command,
      exit_code: workerDryRun.exit_code,
      dry_run_exit_observed: workerDryRun.dry_run_exit_observed,
      required_markers_present: workerDryRun.required_markers_present,
      failed_markers: workerDryRun.failed_markers ?? [],
      total_upload_line: workerDryRun.total_upload_line ?? null,
      production_deploy_performed: workerDryRun.production_deploy_performed,
      deploy_performed: workerDryRun.deploy_performed,
      external_effect: workerDryRun.external_effect,
      report_path: workerDryRun.report_path,
      log_path: workerDryRun.log_path,
    },
    event_contract_smoke: {
      ok: eventSmoke.ok,
      mode: eventSmoke.mode,
      event_type_counts: eventSmoke.event_type_counts,
      sensitive_rejection_ok: eventSmoke.sensitive_rejection?.ok,
      sensitive_token_rejection_ok: eventSmoke.sensitive_token_rejection?.ok,
      phone_campaign_rejection_ok: eventSmoke.phone_campaign_rejection?.ok,
      missing_origin_rejection_ok: eventSmoke.cors_contract?.missing_origin_post?.status === 403,
      invalid_event_rejection_ok: eventSmoke.invalid_event_rejection?.ok,
      redirect_attribution_ok: eventSmoke.redirect_attribution?.ok,
      redirect_attribution_observed: eventSmoke.redirect_attribution?.observed ?? null,
      ab_redirect_attribution_ok: eventSmoke.ab_redirect_attribution?.ok,
      ab_redirect_attribution_observed: eventSmoke.ab_redirect_attribution?.observed ?? null,
      scheduled_quality_regression_ok: eventSmoke.scheduled_quality_regression?.ok,
      scheduled_quality_regression_decision: eventSmoke.scheduled_quality_regression?.challenger?.decision ?? null,
      scheduled_quality_regression_no_quality_regression: eventSmoke.scheduled_quality_regression?.challenger?.no_quality_regression ?? null,
      real_event_write_performed: eventSmoke.real_event_write_performed,
      data_lp_events_write_performed: eventSmoke.data_lp_events_write_performed,
    },
    champion_integration_candidate: {
      ok: championIntegrationCandidate.ok,
      mode: championIntegrationCandidate.mode,
      source_lock_verified: championIntegrationCandidate.source?.exact_source_lock_verified,
      source_commit: championIntegrationCandidate.source?.commit,
      observed_ref_commit: championIntegrationCandidate.source?.observed_ref_commit,
      ref_advanced: championIntegrationCandidate.source?.ref_advanced,
      ancestry_verified: championIntegrationCandidate.source?.ancestry_verified,
      lock_commit_is_ancestor: championIntegrationCandidate.source?.lock_commit_is_ancestor,
      ref_file_matches_lock: championIntegrationCandidate.source?.ref_file_matches_lock,
      expected_lock_tuple_verified: championIntegrationCandidate.source?.expected_lock_tuple_verified,
      syntax_ok: championIntegrationCandidate.syntax_check?.ok,
      worker_dry_run_ok: championIntegrationCandidate.worker_dry_run?.ok,
      customer_fields_collected: championIntegrationCandidate.privacy_contract?.customer_fields_collected,
      credentials_sent: championIntegrationCandidate.privacy_contract?.credentials_sent,
      line_add_inferred_from_click: championIntegrationCandidate.privacy_contract?.line_add_inferred_from_click,
      external_effect: championIntegrationCandidate.external_effect,
      production_deploy_performed: championIntegrationCandidate.production_deploy_performed,
    },
    champion_source_lock_fixtures: {
      ok: championSourceLockFixtures.ok,
      mode: championSourceLockFixtures.mode,
      case_count: championSourceLockFixtures.cases?.length ?? 0,
      case_ids: (championSourceLockFixtures.cases ?? []).map((item) => item.id),
      external_effect: championSourceLockFixtures.external_effect,
    },
    champion_integration_smoke: {
      ok: championIntegrationSmoke.ok,
      mode: championIntegrationSmoke.mode,
      page_contract_ok: championIntegrationSmoke.page_contract?.ok,
      cors_contract_ok: championIntegrationSmoke.cors_contract?.ok,
      allowed_page_view_rows: championIntegrationSmoke.database_contract?.allowed_page_view_rows,
      allowed_cta_click_rows: championIntegrationSmoke.database_contract?.allowed_cta_click_rows,
      denied_origin_rows: championIntegrationSmoke.database_contract?.denied_origin_rows,
      line_add_rows: championIntegrationSmoke.database_contract?.line_add_rows,
      sensitive_rows: championIntegrationSmoke.database_contract?.sensitive_rows,
      missing_origin_rejected: championIntegrationSmoke.missing_origin_write?.status === 403,
      sensitive_token_rejected: championIntegrationSmoke.sensitive_token_write?.status === 400,
      real_event_write_performed: championIntegrationSmoke.real_event_write_performed,
      data_lp_events_write_performed: championIntegrationSmoke.data_lp_events_write_performed,
      external_effect: championIntegrationSmoke.external_effect,
    },
    cloudflare_d1_readiness: {
      ok: cloudflareD1Readiness.ok,
      status: cloudflareD1Readiness.status,
      inventory_checked_at: cloudflareD1Readiness.inventory?.snapshot_checked_at,
      total_database_count: cloudflareD1Readiness.inventory?.total_database_count,
      exact_match_count: cloudflareD1Readiness.inventory?.exact_match_count,
      dedicated_database_present: cloudflareD1Readiness.decision?.dedicated_database_present,
      configured_id_is_placeholder: cloudflareD1Readiness.expected?.configured_id_is_placeholder,
      remote_table_query_performed: cloudflareD1Readiness.remote_table_query_performed,
      customer_data_read_performed: cloudflareD1Readiness.customer_data_read_performed,
      resource_create_performed: cloudflareD1Readiness.resource_create_performed,
      external_effect: cloudflareD1Readiness.external_effect,
    },
    live_telemetry_readiness: {
      ok: liveTelemetryReadiness.ok,
      status: liveTelemetryReadiness.status,
      snapshot_checked_at: liveTelemetryReadiness.snapshot_checked_at,
      candidate_deployment_observed: liveTelemetryReadiness.candidate_worker?.deployment_observed,
      candidate_deployment_id: liveTelemetryReadiness.candidate_worker?.deployment_id,
      candidate_version_id: liveTelemetryReadiness.candidate_worker?.version_id,
      candidate_operation_mode: liveTelemetryReadiness.candidate_worker?.operation_mode,
      candidate_security_contract: liveTelemetryReadiness.candidate_worker?.security_contract,
      candidate_security_contract_ok: liveTelemetryReadiness.candidate_worker?.security_contract_ok,
      candidate_deploy_required: liveTelemetryReadiness.candidate_worker?.deploy_required,
      champion_collector_origin_matches: liveTelemetryReadiness.champion?.collector_origin_matches,
      privacy_event_contract_ok: liveTelemetryReadiness.champion?.privacy_event_contract_ok,
      d1_exact_target_ready: liveTelemetryReadiness.d1?.exact_target_ready,
      inventory_reported_num_tables: liveTelemetryReadiness.d1?.inventory_reported_num_tables,
      inventory_table_count_authoritative: liveTelemetryReadiness.d1?.inventory_table_count_authoritative,
      schema_absence_inferred_from_inventory: liveTelemetryReadiness.d1?.schema_absence_inferred_from_inventory,
      schema_evidence_valid: liveTelemetryReadiness.d1?.schema_evidence_valid,
      recurring_aggregate_read_approved: liveTelemetryReadiness.d1?.recurring_aggregate_read_approved,
      observed_live_chain_ready_for_owner_evidence: liveTelemetryReadiness.decisions?.observed_live_chain_ready_for_owner_evidence,
      live_ingest_readiness_proven: liveTelemetryReadiness.decisions?.live_ingest_readiness_proven,
      weekly_aggregate_read_authorized: liveTelemetryReadiness.decisions?.weekly_aggregate_read_authorized,
      remote_table_query_performed: liveTelemetryReadiness.remote_table_query_performed,
      event_post_performed: liveTelemetryReadiness.event_post_performed,
      customer_data_read_performed: liveTelemetryReadiness.customer_data_read_performed,
      production_deploy_performed: liveTelemetryReadiness.production_deploy_performed,
      external_effect: liveTelemetryReadiness.external_effect,
    },
    live_telemetry_readiness_fixtures: {
      ok: liveTelemetryReadinessFixtures.ok,
      scenario_count: liveTelemetryReadinessFixtures.scenario_count,
      live_network_refresh_performed: liveTelemetryReadinessFixtures.live_network_refresh_performed,
      remote_table_query_performed: liveTelemetryReadinessFixtures.remote_table_query_performed,
      event_post_performed: liveTelemetryReadinessFixtures.event_post_performed,
      customer_data_read_performed: liveTelemetryReadinessFixtures.customer_data_read_performed,
      external_effect: liveTelemetryReadinessFixtures.external_effect,
      scenario_ids: (liveTelemetryReadinessFixtures.scenarios ?? []).map((scenario) => scenario.id),
    },
    d1_schema_contract: {
      ok: d1SchemaContract.ok,
      status: d1SchemaContract.status,
      check_count: Object.keys(d1SchemaContract.checks ?? {}).length,
      failed_check_count: Object.values(d1SchemaContract.checks ?? {}).filter((value) => !value).length,
      migration_idempotent: d1SchemaContract.checks?.migration_idempotent,
      remote_d1_migration_performed: d1SchemaContract.remote_d1_migration_performed,
      external_effect: d1SchemaContract.external_effect,
    },
    approved_d1_config: {
      ok: approvedD1Config.ok,
      mode: approvedD1Config.mode,
      status: approvedD1Config.status,
      ready_to_apply: approvedD1Config.ready_to_apply,
      local_config_write_performed: approvedD1Config.local_config_write_performed,
      remote_d1_migration_performed: approvedD1Config.remote_d1_migration_performed,
      external_effect: approvedD1Config.external_effect,
    },
    d1_collection_mode: {
      ok: d1CollectionMode.ok,
      status: d1CollectionMode.status,
      selected_scope: d1CollectionMode.selected_scope,
      remote_read_authorized: d1CollectionMode.remote_read_authorized,
      recurring_aggregate_read_approved: d1CollectionMode.recurring_aggregate_read_approved,
      collection_execution_performed: d1CollectionMode.collection_execution_performed,
      remote_read_performed: d1CollectionMode.remote_read_performed,
      raw_event_rows_read_performed: d1CollectionMode.raw_event_rows_read_performed,
      customer_data_read_performed: d1CollectionMode.customer_data_read_performed,
      data_lp_events_write_performed: d1CollectionMode.data_lp_events_write_performed,
      external_effect: d1CollectionMode.external_effect,
    },
    d1_collection_mode_fixtures: {
      ok: d1CollectionModeFixtures.ok,
      scenario_count: d1CollectionModeFixtures.scenario_count,
      approved_remote_plan_covered: d1CollectionModeFixtures.scenarios?.some((item) => item.id === "valid_owner_evidence_selects_remote_aggregate_plan" && item.remote_read_authorized === true),
      remote_read_performed: d1CollectionModeFixtures.remote_read_performed,
      customer_data_read_performed: d1CollectionModeFixtures.customer_data_read_performed,
      external_effect: d1CollectionModeFixtures.external_effect,
    },
    d1_aggregate_export_fixtures: {
      ok: d1AggregateExportFixtures.ok,
      scenario_count: d1AggregateExportFixtures.scenario_count,
      aggregate_sql_covered: d1AggregateExportFixtures.scenarios?.some((item) => item.id === "fixture_wrangler_proves_aggregate_only_export" && item.aggregate_sql_present === true && item.sql_has_forbidden_fields === false),
      real_remote_cli_performed: d1AggregateExportFixtures.real_remote_cli_performed,
      raw_event_rows_read_performed: d1AggregateExportFixtures.raw_event_rows_read_performed,
      customer_data_read_performed: d1AggregateExportFixtures.customer_data_read_performed,
      project_real_events_write_performed: d1AggregateExportFixtures.project_real_events_write_performed,
      external_effect: d1AggregateExportFixtures.external_effect,
    },
    champion_local_branch: {
      ok: championLocalBranch.ok,
      status: championLocalBranch.status,
      branch: championLocalBranch.local_branch?.name,
      commit: championLocalBranch.local_branch?.commit,
      parent_commit: championLocalBranch.local_branch?.parent_commit,
      changed_paths: championLocalBranch.local_branch?.changed_paths,
      remote_branch_present: championLocalBranch.remote_observation?.branch_present,
      git_push_performed: championLocalBranch.git_push_performed,
      github_push_or_pr_performed: championLocalBranch.github_push_or_pr_performed,
      external_effect: championLocalBranch.external_effect,
    },
    champion_release_preflight: {
      ok: championReleasePreflight.ok,
      mode: championReleasePreflight.mode,
      status: championReleasePreflight.status,
      source_mode: championReleasePreflight.source?.mode,
      observed_ref_commit: championReleasePreflight.source?.observed_ref_commit,
      ref_advanced: championReleasePreflight.source?.ref_advanced,
      ancestry_verified: championReleasePreflight.source?.ancestry_verified,
      lock_commit_is_ancestor: championReleasePreflight.source?.lock_commit_is_ancestor,
      ref_file_matches_lock: championReleasePreflight.source?.ref_file_matches_lock,
      expected_lock_tuple_verified: championReleasePreflight.source?.expected_lock_tuple_verified,
      source_repo_present: championReleasePreflight.source?.repo_present,
      source_repository_unchanged: championReleasePreflight.source?.source_repository_unchanged,
      patch_byte_identical: championReleasePreflight.candidate?.byte_identical_after_patch,
      wrangler_dry_run_ok: championReleasePreflight.worker_dry_run?.ok,
      production_command_template_dry_run_ok: championReleasePreflight.production_command_template_dry_run?.ok,
      live_snapshot_checked_at: championLiveSnapshot.checked_at,
      live_version_id: championLiveSnapshot.deployed_version?.id,
      live_false_success_state_present: championLiveSnapshot.contact?.false_success_state_present,
      owner_packet_ok: championReleaseOwnerPacket.ok,
      owner_gate_count: championReleaseOwnerPacket.gates?.length ?? 0,
      rollback_target_version_id: championReleaseOwnerPacket.rollback?.target_version_id,
      external_effect: championReleasePreflight.external_effect,
      production_deploy_performed: championReleasePreflight.production_deploy_performed,
      source_repo_write_performed: championReleasePreflight.source_repo_write_performed,
      local_branch_commit: championReleasePreflight.local_branch?.commit,
      collector_readiness_status: championReleasePreflight.collector_readiness?.status,
    },
    champion_github_handoff: {
      ok: championGithubHandoff.ok,
      status: championGithubHandoff.status,
      repository: championGithubHandoff.repository?.slug,
      branch: championGithubHandoff.local_branch?.name,
      commit: championGithubHandoff.local_branch?.commit,
      draft_required: championGithubHandoff.pull_request?.draft_required,
      merge_permitted: championGithubHandoff.pull_request?.merge_permitted,
      github_push_or_pr_performed: championGithubHandoff.github_push_or_pr_performed,
      external_effect: championGithubHandoff.external_effect,
    },
    tracking_link_smoke: {
      ok: trackingSmoke.ok,
      mode: trackingSmoke.mode,
      links_checked: trackingSmoke.links_checked,
      expected_link_count: trackingSmoke.expected_link_count,
      isolated_link_click_events_written: trackingSmoke.isolated_link_click_events_written,
      checks_passed: (trackingSmoke.checks ?? []).filter((item) => item.ok).length,
      real_event_write_performed: trackingSmoke.real_event_write_performed,
      data_lp_events_write_performed: trackingSmoke.data_lp_events_write_performed,
      external_effect: trackingSmoke.external_effect,
      public_link_change_performed: trackingSmoke.public_link_change_performed,
      production_deploy_performed: trackingSmoke.production_deploy_performed,
      line_push_performed: trackingSmoke.line_push_performed,
      customer_data_mutation_performed: trackingSmoke.customer_data_mutation_performed,
      payment_action_performed: trackingSmoke.payment_action_performed,
      delete_action_performed: trackingSmoke.delete_action_performed,
    },
    event_input_quality_gate: {
      ok: eventInputQuality.ok,
      mode: eventInputQuality.mode,
      rows_scanned: eventInputQuality.rows_scanned,
      issue_count: (eventInputQuality.issues ?? []).length,
      scoring_allowed: eventInputQuality.scoring_allowed,
      pii_or_sensitive_data_detected: eventInputQuality.pii_or_sensitive_data_detected,
      data_lp_events_write_performed: eventInputQuality.data_lp_events_write_performed,
    },
    funnel_aggregate_preview: {
      ok: funnelAggregate.ok,
      mode: funnelAggregate.mode,
      events_written: funnelAggregate.events_written,
      counts_by_event_type: funnelAggregate.counts_by_event_type,
      contains_sensitive_columns: funnelAggregate.contains_sensitive_columns,
      contains_sensitive_values: funnelAggregate.contains_sensitive_values,
      apply_performed: funnelAggregate.apply_performed,
      data_lp_events_write_performed: funnelAggregate.data_lp_events_write_performed,
      external_effect: funnelAggregate.external_effect,
    },
    funnel_aggregate_fixtures: {
      ok: funnelAggregateFixtures.ok,
      mode: funnelAggregateFixtures.mode,
      scenario_count: funnelAggregateFixtures.scenario_count,
      execution_performed: funnelAggregateFixtures.execution_performed,
      real_event_write_performed: funnelAggregateFixtures.real_event_write_performed,
      data_lp_events_write_performed: funnelAggregateFixtures.data_lp_events_write_performed,
      external_effect: funnelAggregateFixtures.external_effect,
      scenarios: (funnelAggregateFixtures.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: scenario.ok,
        status_mode: scenario.status_mode,
        data_lp_events_write_performed: scenario.data_lp_events_write_performed,
      })),
    },
    real_data_apply_fixtures: {
      ok: realDataApplyFixtures.ok,
      mode: realDataApplyFixtures.mode,
      scenario_count: realDataApplyFixtures.scenario_count,
      execution_performed: realDataApplyFixtures.execution_performed,
      real_event_write_performed: realDataApplyFixtures.real_event_write_performed,
      data_lp_events_write_performed: realDataApplyFixtures.data_lp_events_write_performed,
      external_effect: realDataApplyFixtures.external_effect,
      scenarios: (realDataApplyFixtures.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        importer: scenario.importer,
        ok: scenario.ok,
        status_mode: scenario.status_mode,
        confirm_real_data: scenario.confirm_real_data,
        example_input_detected: scenario.example_input_detected,
        real_events_unchanged: scenario.real_events_unchanged,
        data_lp_events_write_performed: scenario.data_lp_events_write_performed,
      })),
    },
    real_data_input_pack: {
      ok: realDataInputPack.ok,
      mode: realDataInputPack.mode,
      status: realDataInputPack.status,
      template_only: realDataInputPack.template_only,
      template_count: (realDataInputPack.templates ?? []).length,
      live_input_files_created: realDataInputPack.live_input_files_created,
      real_events_unchanged: realDataInputPack.real_events_unchanged,
      data_lp_events_write_performed: realDataInputPack.data_lp_events_write_performed,
      external_effect: realDataInputPack.external_effect,
    },
    source_readiness: {
      ok: sourceReadiness.ok,
      mode: sourceReadiness.mode,
      status: sourceReadiness.status,
      real_event_rows: sourceReadiness.real_event_rows,
      missing_stage_count: sourceReadiness.missing_stage_count,
      ready_for_public_iteration_decision: sourceReadiness.ready_for_public_iteration_decision,
      sample_threshold_met: sourceReadiness.sample_progress?.sample_threshold_met,
      data_lp_events_write_performed: sourceReadiness.data_lp_events_write_performed,
      external_effect: sourceReadiness.external_effect,
    },
    source_capture_pack: {
      ok: sourceCapture.ok,
      mode: sourceCapture.mode,
      status: sourceCapture.status,
      tracking_links_total: sourceCapture.tracking_links_total,
      importable_tracking_links: sourceCapture.importable_tracking_links,
      ab_router_gate_count: sourceCapture.ab_router_gate_count,
      stage_count: sourceCapture.stage_count,
      ledger_rows: sourceCapture.ledger_rows,
      sample_gate_ledger_rows: sourceCapture.sample_gate_ledger_rows,
      template_only: sourceCapture.template_only,
      owner_review_required: sourceCapture.owner_review_required,
      live_input_files_created: sourceCapture.live_input_files_created,
      real_events_unchanged: sourceCapture.real_events_unchanged,
      data_lp_events_write_performed: sourceCapture.data_lp_events_write_performed,
      external_effect: sourceCapture.external_effect,
    },
    sample_gate_replay_fixtures: {
      ok: sampleGateReplay.ok,
      mode: sampleGateReplay.mode,
      template_rows: sampleGateReplay.template_rows,
      scenario_count: sampleGateReplay.scenario_count,
      sample_gate_ledger_replay_executed: sampleGateReplay.sample_gate_ledger_replay_executed,
      source_capture_compile_commands_executed: sampleGateReplay.source_capture_compile_commands_executed,
      importer_preview_commands_executed: sampleGateReplay.importer_preview_commands_executed,
      execution_performed: sampleGateReplay.execution_performed,
      real_event_write_performed: sampleGateReplay.real_event_write_performed,
      data_lp_events_write_performed: sampleGateReplay.data_lp_events_write_performed,
      external_effect: sampleGateReplay.external_effect,
      scenarios: (sampleGateReplay.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: scenario.ok,
        imported_events: scenario.imported_events,
        decision: scenario.sample_summary?.decision,
        challenger_sample_threshold_met: scenario.sample_summary?.challenger?.sample_threshold_met,
        challenger_beats_sample_rate: scenario.sample_summary?.challenger_beats_sample_rate,
        source_capture_compile_ok: scenario.source_capture_compile?.ok === true,
        source_capture_compile_status: scenario.source_capture_compile?.status ?? "missing",
        source_capture_compile_data_lp_events_write_performed: Boolean(scenario.source_capture_compile?.data_lp_events_write_performed),
        source_capture_compile_external_effect: Boolean(scenario.source_capture_compile?.external_effect),
      })),
    },
    source_capture_compile: {
      ok: sourceCompile.ok,
      mode: sourceCompile.mode,
      status: sourceCompile.status,
      input_kind: sourceCompile.input_kind,
      ledger_rows_read: sourceCompile.ledger_rows_read,
      filled_rows: sourceCompile.filled_rows,
      empty_rows: sourceCompile.empty_rows,
      funnel_rows: sourceCompile.funnel_rows,
      manual_rows: sourceCompile.manual_rows,
      issue_count: sourceCompile.issue_count,
      warning_count: sourceCompile.warning_count,
      owner_review_required: sourceCompile.owner_review_required,
      live_input_files_created: sourceCompile.live_input_files_created,
      apply_performed: sourceCompile.apply_performed,
      append_performed: sourceCompile.append_performed,
      data_lp_events_write_performed: sourceCompile.data_lp_events_write_performed,
      external_effect: sourceCompile.external_effect,
    },
    source_capture_compile_fixtures: {
      ok: sourceCompileFixtures.ok,
      mode: sourceCompileFixtures.mode,
      scenario_count: sourceCompileFixtures.scenario_count,
      local_fixture_commands_executed: sourceCompileFixtures.local_fixture_commands_executed,
      execution_performed: sourceCompileFixtures.execution_performed,
      real_event_write_performed: sourceCompileFixtures.real_event_write_performed,
      data_lp_events_write_performed: sourceCompileFixtures.data_lp_events_write_performed,
      external_effect: sourceCompileFixtures.external_effect,
      scenarios: (sourceCompileFixtures.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: scenario.ok,
        status_status: scenario.status_status,
        data_lp_events_write_performed: scenario.data_lp_events_write_performed,
      })),
    },
    real_data_intake_plan: {
      ok: realDataIntake.ok,
      mode: realDataIntake.mode,
      status: realDataIntake.status,
      ready_apply_count: realDataIntake.ready_apply_count,
      missing_input_count: realDataIntake.missing_input_count,
      blocked_input_count: realDataIntake.blocked_input_count,
      real_events_unchanged: realDataIntake.real_events_unchanged,
      data_lp_events_write_performed: realDataIntake.data_lp_events_write_performed,
      external_effect: realDataIntake.external_effect,
    },
    data_collection_brief: {
      ok: dataCollectionStatus.ok,
      mode: dataCollectionStatus.mode,
      status: dataCollectionStatus.status,
      task_count: dataCollectionStatus.task_count,
      stage_count: dataCollectionStatus.stage_count,
      importable_link_count: dataCollectionStatus.importable_link_count,
      gated_link_count: dataCollectionStatus.gated_link_count,
      sample_gate_status: dataCollectionStatus.sample_gate_status,
      sample_gate_p0_task_count: dataCollectionStatus.sample_gate_p0_task_count,
      sample_gate_p0_link_count: dataCollectionStatus.sample_gate_p0_link_count,
      sample_gate_stage_count: dataCollectionStatus.sample_gate_stage_count,
      filled_ledger_exists: dataCollectionStatus.filled_ledger_exists,
      sample_threshold_met: dataCollectionStatus.sample_threshold_met,
      missing_stage_count: dataCollectionStatus.missing_stage_count,
      real_events_unchanged: dataCollectionStatus.real_events_unchanged,
      live_input_files_created: dataCollectionStatus.live_input_files_created,
      data_lp_events_write_performed: dataCollectionStatus.data_lp_events_write_performed,
      external_effect: dataCollectionStatus.external_effect,
      queue_task_count: (dataCollection.tasks ?? []).length,
      stage_priorities: dataCollection.stage_priorities ?? [],
      immediate_actions: dataCollection.immediate_actions ?? [],
    },
    data_collection_progress: {
      ok: dataCollectionProgress.ok,
      mode: dataCollectionProgress.mode,
      status: dataCollectionProgress.status,
      total_task_count: dataCollectionProgress.total_task_count,
      filled_task_count: dataCollectionProgress.filled_task_count,
      pending_task_count: dataCollectionProgress.pending_task_count,
      p0_task_count: dataCollectionProgress.p0_task_count,
      p0_pending_count: dataCollectionProgress.p0_pending_count,
      p1_task_count: dataCollectionProgress.p1_task_count,
      p1_pending_count: dataCollectionProgress.p1_pending_count,
      next_owner_input_count: dataCollectionProgress.next_owner_input_count,
      real_events_unchanged: dataCollectionProgress.real_events_unchanged,
      live_input_files_created: dataCollectionProgress.live_input_files_created,
      data_lp_events_write_performed: dataCollectionProgress.data_lp_events_write_performed,
      external_effect: dataCollectionProgress.external_effect,
    },
    next_p0_owner_inputs: {
      ok: nextP0OwnerInputs.ok,
      mode: nextP0OwnerInputs.mode,
      status: nextP0OwnerInputs.status,
      source_progress_status: nextP0OwnerInputs.source_progress_status,
      current_input_count: nextP0OwnerInputs.current_input_count,
      p0_pending_count: nextP0OwnerInputs.p0_pending_count,
      p1_pending_count: nextP0OwnerInputs.p1_pending_count,
      source_group_count: nextP0OwnerInputs.source_group_count,
      recommended_open_command: nextP0OwnerInputs.recommended_open_command,
      real_events_unchanged: nextP0OwnerInputs.real_events_unchanged,
      live_input_files_created: nextP0OwnerInputs.live_input_files_created,
      data_lp_events_write_performed: nextP0OwnerInputs.data_lp_events_write_performed,
      external_effect: nextP0OwnerInputs.external_effect,
    },
    next_p0_owner_form: {
      ok: nextP0OwnerForm.ok,
      mode: nextP0OwnerForm.mode,
      status: nextP0OwnerForm.status,
      source_progress_status: nextP0OwnerForm.source_progress_status,
      owner_sample_gate_status: nextP0OwnerForm.owner_sample_gate_status,
      row_count: nextP0OwnerForm.row_count,
      current_input_count: nextP0OwnerForm.current_input_count,
      p0_pending_count: nextP0OwnerForm.p0_pending_count,
      p1_pending_count: nextP0OwnerForm.p1_pending_count,
      source_group_count: nextP0OwnerForm.source_group_count,
      export_headers: nextP0OwnerForm.export_headers,
      download_filename: nextP0OwnerForm.download_filename,
      json_download_filename: nextP0OwnerForm.json_download_filename,
      target_live_files: nextP0OwnerForm.target_live_files,
      owner_fill_paths: nextP0OwnerForm.owner_fill_paths,
      browser_only: nextP0OwnerForm.browser_only,
      browser_persistence: nextP0OwnerForm.browser_persistence,
      network_calls_performed: nextP0OwnerForm.network_calls_performed,
      export_contract: nextP0OwnerForm.export_contract,
      real_events_unchanged: nextP0OwnerForm.real_events_unchanged,
      live_input_files_created: nextP0OwnerForm.live_input_files_created,
      data_lp_events_write_performed: nextP0OwnerForm.data_lp_events_write_performed,
      external_effect: nextP0OwnerForm.external_effect,
    },
    next_p0_owner_form_fixtures: {
      ok: nextP0OwnerFormFixtures.ok,
      mode: nextP0OwnerFormFixtures.mode,
      row_count: nextP0OwnerFormFixtures.row_count,
      expected_row_count: nextP0OwnerFormFixtures.expected_row_count,
      scenario_count: nextP0OwnerFormFixtures.scenario_count,
      browser_form_static_checks_executed: nextP0OwnerFormFixtures.browser_form_static_checks_executed,
      export_contract_verified: nextP0OwnerFormFixtures.export_contract_verified,
      local_fixture_commands_executed: nextP0OwnerFormFixtures.local_fixture_commands_executed,
      real_events_unchanged: nextP0OwnerFormFixtures.real_events_unchanged,
      live_input_files_created: nextP0OwnerFormFixtures.live_input_files_created,
      data_lp_events_write_performed: nextP0OwnerFormFixtures.data_lp_events_write_performed,
      external_effect: nextP0OwnerFormFixtures.external_effect,
      scenarios: (nextP0OwnerFormFixtures.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: scenario.ok,
        live_input_files_created: scenario.live_input_files_created,
        data_lp_events_write_performed: scenario.data_lp_events_write_performed,
        external_effect: scenario.external_effect,
      })),
    },
    next_p0_owner_intake: {
      ok: nextP0OwnerIntake.ok,
      mode: nextP0OwnerIntake.mode,
      status: nextP0OwnerIntake.status,
      candidate_found: nextP0OwnerIntake.candidate_found,
      candidate_valid: nextP0OwnerIntake.candidate_valid,
      expected_row_count: nextP0OwnerIntake.expected_row_count,
      downloaded_row_count: nextP0OwnerIntake.downloaded_row_count,
      filled_rows: nextP0OwnerIntake.filled_rows,
      funnel_preview_rows: nextP0OwnerIntake.funnel_preview_rows,
      manual_preview_rows: nextP0OwnerIntake.manual_preview_rows,
      stage_performed: nextP0OwnerIntake.stage_performed,
      live_input_files_created: nextP0OwnerIntake.live_input_files_created,
      data_lp_events_write_performed: nextP0OwnerIntake.data_lp_events_write_performed,
      external_effect: nextP0OwnerIntake.external_effect,
    },
    next_p0_owner_intake_fixtures: {
      ok: nextP0OwnerIntakeFixtures.ok,
      mode: nextP0OwnerIntakeFixtures.mode,
      row_count: nextP0OwnerIntakeFixtures.row_count,
      scenario_count: nextP0OwnerIntakeFixtures.scenario_count,
      local_fixture_commands_executed: nextP0OwnerIntakeFixtures.local_fixture_commands_executed,
      live_project_inputs_created: nextP0OwnerIntakeFixtures.live_project_inputs_created,
      data_lp_events_write_performed: nextP0OwnerIntakeFixtures.data_lp_events_write_performed,
      external_effect: nextP0OwnerIntakeFixtures.external_effect,
      scenarios: (nextP0OwnerIntakeFixtures.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: scenario.ok,
        status: scenario.status,
        exit_code: scenario.exit_code,
        live_project_inputs_created: scenario.live_project_inputs_created,
        data_lp_events_write_performed: scenario.data_lp_events_write_performed,
        external_effect: scenario.external_effect,
      })),
    },
    owner_data_preflight: {
      ok: ownerDataPreflight.ok,
      mode: ownerDataPreflight.mode,
      status: ownerDataPreflight.status,
      selected_source_id: ownerDataPreflight.selected_source_id,
      selected_source_row_count: ownerDataPreflight.selected_source_row_count,
      selected_source_event_total: ownerDataPreflight.selected_source_event_total,
      sample_threshold_met: ownerDataPreflight.sample_threshold_met,
      no_quality_regression: ownerDataPreflight.no_quality_regression,
      challenger_win_rule_met: ownerDataPreflight.challenger_win_rule_met,
      next_round_decision: ownerDataPreflight.next_round_decision,
      owner_review_required: ownerDataPreflight.owner_review_required,
      real_events_unchanged: ownerDataPreflight.real_events_unchanged,
      data_lp_events_write_performed: ownerDataPreflight.data_lp_events_write_performed,
      external_effect: ownerDataPreflight.external_effect,
    },
    sample_gate_capture_calendar: {
      ok: sampleGateCaptureCalendar.ok,
      mode: sampleGateCaptureCalendar.mode,
      status: sampleGateCaptureCalendar.status,
      event_count: sampleGateCaptureCalendar.event_count,
      next_due_event_id: sampleGateCaptureCalendar.next_due_event_id,
      next_due_date: sampleGateCaptureCalendar.next_due_date,
      p0_input_count: sampleGateCaptureCalendar.p0_input_count,
      p0_pending_count: sampleGateCaptureCalendar.p0_pending_count,
      progress_status: sampleGateCaptureCalendar.progress_status,
      calendar_import_performed: sampleGateCaptureCalendar.calendar_import_performed,
      system_reminder_created: sampleGateCaptureCalendar.system_reminder_created,
      browser_open_performed: sampleGateCaptureCalendar.browser_open_performed,
      data_lp_events_write_performed: sampleGateCaptureCalendar.data_lp_events_write_performed,
      external_effect: sampleGateCaptureCalendar.external_effect,
    },
    sample_gate_due_status: {
      ok: sampleGateDueStatus.ok,
      mode: sampleGateDueStatus.mode,
      status: sampleGateDueStatus.status,
      today: sampleGateDueStatus.today,
      min_check_date: sampleGateDueStatus.min_check_date,
      preferred_check_date: sampleGateDueStatus.preferred_check_date,
      due_phase: sampleGateDueStatus.due_phase,
      due_event_id: sampleGateDueStatus.due_event_id,
      due_date: sampleGateDueStatus.due_date,
      due_now: sampleGateDueStatus.due_now,
      sample_threshold_met: sampleGateDueStatus.sample_threshold_met,
      sample_rate_win_candidate: sampleGateDueStatus.sample_rate_win_candidate,
      p0_input_count: sampleGateDueStatus.p0_input_count,
      p0_pending_count: sampleGateDueStatus.p0_pending_count,
      progress_status: sampleGateDueStatus.progress_status,
      owner_sample_gate_status: sampleGateDueStatus.owner_sample_gate_status,
      capture_calendar_status: sampleGateDueStatus.capture_calendar_status,
      capture_calendar_next_due_date: sampleGateDueStatus.capture_calendar_next_due_date,
      capture_calendar_next_due_event_id: sampleGateDueStatus.capture_calendar_next_due_event_id,
      champion_action: sampleGateDueStatus.champion_action,
      challenger_promotion_allowed: sampleGateDueStatus.challenger_promotion_allowed,
      next_variable_rotation_allowed: sampleGateDueStatus.next_variable_rotation_allowed,
      next_safe_command: sampleGateDueStatus.next_safe_command,
      calendar_import_performed: sampleGateDueStatus.calendar_import_performed,
      system_reminder_created: sampleGateDueStatus.system_reminder_created,
      browser_open_performed: sampleGateDueStatus.browser_open_performed,
      data_lp_events_write_performed: sampleGateDueStatus.data_lp_events_write_performed,
      external_effect: sampleGateDueStatus.external_effect,
    },
    north_star_funnel: {
      ok: northStar.ok,
      mode: northStar.mode,
      status: northStar.status,
      path: northStar.north_star?.path,
      primary_metric: northStar.north_star?.primary_metric,
      link_clicks: northStar.totals?.link_clicks,
      line_adds: northStar.totals?.line_adds,
      leads: northStar.totals?.leads,
      deals: northStar.totals?.deals,
      line_adds_per_100_clicks: northStar.totals?.line_adds_per_100_clicks,
      leads_per_100_clicks: northStar.totals?.leads_per_100_clicks,
      deals_per_100_clicks: northStar.totals?.deals_per_100_clicks,
      sample_threshold_met: northStar.sample_threshold_met,
      challenger_win_rule_met: northStar.challenger_win_rule_met,
      quality_guard_status: northStar.quality_guard_status,
      owner_review_required: northStar.owner_review_required,
      promotion_performed: northStar.promotion_performed,
      asset_count: northStar.summary?.asset_count,
      attribution_row_count: northStar.summary?.attribution_row_count,
      real_events_unchanged: northStar.real_events_unchanged,
      data_lp_events_write_performed: northStar.data_lp_events_write_performed,
      external_effect: northStar.external_effect,
    },
    week0_owner_capture_queue: {
      ok: ownerCaptureQueue.ok,
      mode: ownerCaptureQueue.mode,
      status: ownerCaptureQueue.status,
      p0_task_count: ownerCaptureQueue.p0_task_count,
      p0_link_count: ownerCaptureQueue.p0_link_count,
      source_group_count: ownerCaptureQueue.source_group_count,
      sample_filled_exists: ownerCaptureQueue.sample_filled_exists,
      owner_fill_path: ownerCaptureQueue.owner_fill_path,
      next_safe_command_after_owner_fill: ownerCaptureQueue.next_safe_command_after_owner_fill,
      real_events_unchanged: ownerCaptureQueue.real_events_unchanged,
      live_input_files_created: ownerCaptureQueue.live_input_files_created,
      data_lp_events_write_performed: ownerCaptureQueue.data_lp_events_write_performed,
      external_effect: ownerCaptureQueue.external_effect,
    },
    owner_sample_gate_status: {
      ok: ownerSampleGate.ok,
      mode: ownerSampleGate.mode,
      status: ownerSampleGate.status,
      input_exists: ownerSampleGate.input_exists,
      filled_rows: ownerSampleGate.filled_rows,
      pending_rows: ownerSampleGate.pending_rows,
      issue_count: ownerSampleGate.issue_count,
      sample_threshold_met: ownerSampleGate.sample_threshold_met,
      sample_rate_win_candidate: ownerSampleGate.sample_rate_win_candidate,
      challenger_win_rule_met: ownerSampleGate.challenger_win_rule_met,
      quality_guard_status: ownerSampleGate.quality_guard_status,
      decision: ownerSampleGate.decision,
      owner_review_required: ownerSampleGate.owner_review_required,
      promotion_performed: ownerSampleGate.promotion_performed,
      real_events_unchanged: ownerSampleGate.real_events_unchanged,
      live_input_files_created: ownerSampleGate.live_input_files_created,
      data_lp_events_write_performed: ownerSampleGate.data_lp_events_write_performed,
      external_effect: ownerSampleGate.external_effect,
    },
    sample_gate_owner_worksheet: {
      ok: sampleGateOwnerWorksheet.ok,
      mode: sampleGateOwnerWorksheet.mode,
      status: sampleGateOwnerWorksheet.status,
      owner_sample_gate_status: sampleGateOwnerWorksheet.owner_sample_gate_status,
      owner_filled_exists: sampleGateOwnerWorksheet.owner_filled_exists,
      row_count: sampleGateOwnerWorksheet.row_count,
      link_count: sampleGateOwnerWorksheet.link_count,
      source_group_count: sampleGateOwnerWorksheet.source_group_count,
      required_owner_fields: sampleGateOwnerWorksheet.required_owner_fields,
      real_events_unchanged: sampleGateOwnerWorksheet.real_events_unchanged,
      live_input_files_created: sampleGateOwnerWorksheet.live_input_files_created,
      data_lp_events_write_performed: sampleGateOwnerWorksheet.data_lp_events_write_performed,
      external_effect: sampleGateOwnerWorksheet.external_effect,
    },
    sample_gate_owner_form: {
      ok: sampleGateOwnerForm.ok,
      mode: sampleGateOwnerForm.mode,
      status: sampleGateOwnerForm.status,
      owner_filled_exists: sampleGateOwnerForm.owner_filled_exists,
      worksheet_status: sampleGateOwnerForm.worksheet_status,
      row_count: sampleGateOwnerForm.row_count,
      link_count: sampleGateOwnerForm.link_count,
      source_group_count: sampleGateOwnerForm.source_group_count,
      required_owner_fields: sampleGateOwnerForm.required_owner_fields,
      optional_owner_fields: sampleGateOwnerForm.optional_owner_fields,
      download_filename: sampleGateOwnerForm.download_filename,
      browser_only: sampleGateOwnerForm.browser_only,
      browser_persistence: sampleGateOwnerForm.browser_persistence,
      network_calls_performed: sampleGateOwnerForm.network_calls_performed,
      real_events_unchanged: sampleGateOwnerForm.real_events_unchanged,
      live_input_files_created: sampleGateOwnerForm.live_input_files_created,
      data_lp_events_write_performed: sampleGateOwnerForm.data_lp_events_write_performed,
      external_effect: sampleGateOwnerForm.external_effect,
    },
    sample_gate_owner_form_fixtures: {
      ok: sampleGateOwnerFormFixtures.ok,
      mode: sampleGateOwnerFormFixtures.mode,
      scenario_count: sampleGateOwnerFormFixtures.scenario_count,
      local_fixture_commands_executed: sampleGateOwnerFormFixtures.local_fixture_commands_executed,
      form_export_replay_executed: sampleGateOwnerFormFixtures.form_export_replay_executed,
      source_capture_compile_commands_executed: sampleGateOwnerFormFixtures.source_capture_compile_commands_executed,
      owner_sample_gate_commands_executed: sampleGateOwnerFormFixtures.owner_sample_gate_commands_executed,
      real_events_unchanged: sampleGateOwnerFormFixtures.real_events_unchanged,
      live_input_files_created: sampleGateOwnerFormFixtures.live_input_files_created,
      data_lp_events_write_performed: sampleGateOwnerFormFixtures.data_lp_events_write_performed,
      external_effect: sampleGateOwnerFormFixtures.external_effect,
      scenarios: (sampleGateOwnerFormFixtures.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: scenario.ok,
        compile_status: scenario.compile_status,
        owner_status: scenario.owner_status,
        owner_decision: scenario.owner_decision,
        sample_threshold_met: scenario.sample_threshold_met,
        sample_rate_win_candidate: scenario.sample_rate_win_candidate,
        challenger_win_rule_met: scenario.challenger_win_rule_met,
        quality_guard_status: scenario.quality_guard_status,
        promotion_performed: scenario.promotion_performed,
      })),
    },
    sample_gate_batch_handoff: {
      ok: sampleGateBatchHandoff.ok,
      mode: sampleGateBatchHandoff.mode,
      status: sampleGateBatchHandoff.status,
      p0_task_count: sampleGateBatchHandoff.p0_task_count,
      all_p0_row_count: sampleGateBatchHandoff.all_p0_row_count,
      focused_batch_row_count: sampleGateBatchHandoff.focused_batch_row_count,
      remaining_batch_row_count: sampleGateBatchHandoff.remaining_batch_row_count,
      p0_pending_count: sampleGateBatchHandoff.p0_pending_count,
      focused_pending_count: sampleGateBatchHandoff.focused_pending_count,
      remaining_pending_count: sampleGateBatchHandoff.remaining_pending_count,
      full_coverage_ready: sampleGateBatchHandoff.full_coverage_ready,
      batch_count: sampleGateBatchHandoff.batch_count,
      live_input_files_created: sampleGateBatchHandoff.live_input_files_created,
      data_lp_events_write_performed: sampleGateBatchHandoff.data_lp_events_write_performed,
      external_effect: sampleGateBatchHandoff.external_effect,
      delete_action_performed: sampleGateBatchHandoff.delete_action_performed,
    },
    sample_gate_collection_sprint: {
      ok: sampleGateCollectionSprint.ok,
      mode: sampleGateCollectionSprint.mode,
      status: sampleGateCollectionSprint.status,
      due_status: sampleGateCollectionSprint.due_status,
      due_now: sampleGateCollectionSprint.due_now,
      p0_full_task_count: sampleGateCollectionSprint.p0_full_task_count,
      p0_full_row_count: sampleGateCollectionSprint.p0_full_row_count,
      p0_pending_count: sampleGateCollectionSprint.p0_pending_count,
      focused_missing_count: sampleGateCollectionSprint.focused_missing_count,
      sprint_step_count: sampleGateCollectionSprint.sprint_step_count,
      owner_open_target_count: sampleGateCollectionSprint.owner_open_target_count,
      owner_review_required: sampleGateCollectionSprint.owner_review_required,
      data_lp_events_write_performed: sampleGateCollectionSprint.data_lp_events_write_performed,
      external_effect: sampleGateCollectionSprint.external_effect,
      delete_action_performed: sampleGateCollectionSprint.delete_action_performed,
    },
    owner_sample_gate_fixtures: {
      ok: ownerSampleGateFixtures.ok,
      mode: ownerSampleGateFixtures.mode,
      scenario_count: ownerSampleGateFixtures.scenario_count,
      owner_sample_gate_commands_executed: ownerSampleGateFixtures.owner_sample_gate_commands_executed,
      real_events_unchanged: ownerSampleGateFixtures.real_events_unchanged,
      data_lp_events_write_performed: ownerSampleGateFixtures.data_lp_events_write_performed,
      external_effect: ownerSampleGateFixtures.external_effect,
      scenarios: (ownerSampleGateFixtures.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: scenario.ok,
        status: scenario.status,
        decision: scenario.decision,
        sample_threshold_met: scenario.sample_threshold_met,
        sample_rate_win_candidate: scenario.sample_rate_win_candidate,
        challenger_win_rule_met: scenario.challenger_win_rule_met,
        quality_guard_status: scenario.quality_guard_status,
        promotion_performed: scenario.promotion_performed,
      })),
    },
    owner_quality_review: {
      ok: ownerQualityReview.ok,
      mode: ownerQualityReview.mode,
      status: ownerQualityReview.status,
      owner_sample_gate_status: ownerQualityReview.owner_sample_gate_status,
      input_exists: ownerQualityReview.input_exists,
      sample_threshold_met: ownerQualityReview.sample_threshold_met,
      sample_rate_win_candidate: ownerQualityReview.sample_rate_win_candidate,
      quality_guard_status: ownerQualityReview.quality_guard_status,
      no_quality_regression: ownerQualityReview.no_quality_regression,
      challenger_win_rule_met: ownerQualityReview.challenger_win_rule_met,
      promotion_review_queued: ownerQualityReview.promotion_review_queued,
      promotion_performed: ownerQualityReview.promotion_performed,
      issue_count: ownerQualityReview.issue_count,
      quality_regression_count: ownerQualityReview.quality_regression_count,
      live_input_files_created: ownerQualityReview.live_input_files_created,
      data_lp_events_write_performed: ownerQualityReview.data_lp_events_write_performed,
      approval_queue_write_performed: ownerQualityReview.approval_queue_write_performed,
      external_effect: ownerQualityReview.external_effect,
    },
    owner_quality_review_form: {
      ok: ownerQualityReviewForm.ok,
      mode: ownerQualityReviewForm.mode,
      status: ownerQualityReviewForm.status,
      owner_sample_gate_status: ownerQualityReviewForm.owner_sample_gate_status,
      owner_quality_review_status: ownerQualityReviewForm.owner_quality_review_status,
      owner_filled_exists: ownerQualityReviewForm.owner_filled_exists,
      sample_rate_win_candidate: ownerQualityReviewForm.sample_rate_win_candidate,
      required_owner_fields: ownerQualityReviewForm.required_owner_fields,
      optional_owner_fields: ownerQualityReviewForm.optional_owner_fields,
      download_filename: ownerQualityReviewForm.download_filename,
      review_download_filename: ownerQualityReviewForm.review_download_filename,
      thresholds: ownerQualityReviewForm.thresholds,
      browser_only: ownerQualityReviewForm.browser_only,
      browser_persistence: ownerQualityReviewForm.browser_persistence,
      form_action: ownerQualityReviewForm.form_action,
      network_calls_performed: ownerQualityReviewForm.network_calls_performed,
      real_events_unchanged: ownerQualityReviewForm.real_events_unchanged,
      live_input_files_created: ownerQualityReviewForm.live_input_files_created,
      data_lp_events_write_performed: ownerQualityReviewForm.data_lp_events_write_performed,
      approval_queue_write_performed: ownerQualityReviewForm.approval_queue_write_performed,
      external_effect: ownerQualityReviewForm.external_effect,
      promotion_performed: ownerQualityReviewForm.promotion_performed,
    },
    owner_quality_review_form_fixtures: {
      ok: ownerQualityReviewFormFixtures.ok,
      mode: ownerQualityReviewFormFixtures.mode,
      form_status: ownerQualityReviewFormFixtures.form_status,
      form_download_filename: ownerQualityReviewFormFixtures.form_download_filename,
      scenario_count: ownerQualityReviewFormFixtures.scenario_count,
      local_fixture_commands_executed: ownerQualityReviewFormFixtures.local_fixture_commands_executed,
      form_export_replay_executed: ownerQualityReviewFormFixtures.form_export_replay_executed,
      owner_quality_review_commands_executed: ownerQualityReviewFormFixtures.owner_quality_review_commands_executed,
      real_events_unchanged: ownerQualityReviewFormFixtures.real_events_unchanged,
      live_input_files_created: ownerQualityReviewFormFixtures.live_input_files_created,
      data_lp_events_write_performed: ownerQualityReviewFormFixtures.data_lp_events_write_performed,
      approval_queue_write_performed: ownerQualityReviewFormFixtures.approval_queue_write_performed,
      external_effect: ownerQualityReviewFormFixtures.external_effect,
      promotion_performed: ownerQualityReviewFormFixtures.promotion_performed,
      scenarios: (ownerQualityReviewFormFixtures.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: scenario.ok,
        owner_status: scenario.owner_status,
        owner_decision: scenario.owner_decision,
        sample_rate_win_candidate: scenario.sample_rate_win_candidate,
        quality_guard_status: scenario.quality_guard_status,
        no_quality_regression: scenario.no_quality_regression,
        challenger_win_rule_met: scenario.challenger_win_rule_met,
        promotion_review_queued: scenario.promotion_review_queued,
        promotion_performed: scenario.promotion_performed,
        issue_count: scenario.issue_count,
        quality_regression_count: scenario.quality_regression_count,
      })),
    },
    owner_quality_review_fixtures: {
      ok: ownerQualityReviewFixtures.ok,
      mode: ownerQualityReviewFixtures.mode,
      scenario_count: ownerQualityReviewFixtures.scenario_count,
      local_fixture_commands_executed: ownerQualityReviewFixtures.local_fixture_commands_executed,
      owner_quality_review_commands_executed: ownerQualityReviewFixtures.owner_quality_review_commands_executed,
      real_events_unchanged: ownerQualityReviewFixtures.real_events_unchanged,
      data_lp_events_write_performed: ownerQualityReviewFixtures.data_lp_events_write_performed,
      approval_queue_write_performed: ownerQualityReviewFixtures.approval_queue_write_performed,
      external_effect: ownerQualityReviewFixtures.external_effect,
      scenarios: (ownerQualityReviewFixtures.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: scenario.ok,
        status: scenario.status,
        decision: scenario.decision,
        no_quality_regression: scenario.no_quality_regression,
        challenger_win_rule_met: scenario.challenger_win_rule_met,
        promotion_review_queued: scenario.promotion_review_queued,
        promotion_performed: scenario.promotion_performed,
        issue_count: scenario.issue_count,
      })),
    },
    candidate_retirement_fixtures: {
      ok: candidateRetirementFixtures.ok,
      mode: candidateRetirementFixtures.mode,
      scenario_count: candidateRetirementFixtures.scenario_count,
      current_queue_safety: candidateRetirementFixtures.current_queue_safety,
      real_events_unchanged: candidateRetirementFixtures.real_events_unchanged,
      data_lp_events_write_performed: candidateRetirementFixtures.data_lp_events_write_performed,
      external_effect: candidateRetirementFixtures.external_effect,
      public_link_change_performed: candidateRetirementFixtures.public_link_change_performed,
      champion_promotion_performed: candidateRetirementFixtures.champion_promotion_performed,
      delete_action_performed: candidateRetirementFixtures.delete_action_performed,
      scenarios: (candidateRetirementFixtures.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: scenario.ok,
        queue_status: scenario.queue_status,
        retirement_ready: scenario.summary?.retirement_ready,
        keep_testing: scenario.summary?.keep_testing,
        promotion_reviews: scenario.summary?.promotion_reviews,
        target_status: scenario.target_item?.status,
      })),
    },
    iteration_history: {
      ok: iterationHistory.ok,
      mode: iterationHistory.mode,
      status: iterationHistory.status,
      cadence: iterationHistory.cadence,
      current_changed_variable: iterationHistory.current_round?.changed_variable,
      sample_threshold_met: iterationHistory.sample_gate?.sample_threshold_met,
      archives_scanned: iterationHistory.archive_summary?.archives_scanned,
      next_safe_action_count: (iterationHistory.next_safe_actions ?? []).length,
      pending_human_count: iterationHistory.owner_gate_summary?.pending_human_count,
      ready_local_review_count: iterationHistory.owner_gate_summary?.ready_local_review_count,
      external_effect: iterationHistory.external_effect,
      public_link_change_performed: iterationHistory.public_link_change_performed,
      production_deploy_performed: iterationHistory.production_deploy_performed,
      github_push_or_pr_performed: iterationHistory.github_push_or_pr_performed,
      formal_post_performed: iterationHistory.formal_post_performed,
      line_push_performed: iterationHistory.line_push_performed,
      customer_data_mutation_performed: iterationHistory.customer_data_mutation_performed,
      payment_action_performed: iterationHistory.payment_action_performed,
      delete_action_performed: iterationHistory.delete_action_performed,
    },
    line_inbound_playbook: {
      ok: lineInbound.ok,
      mode: lineInbound.mode,
      scenario_count: lineInbound.scenario_count,
      execution_performed: lineInbound.execution_performed,
      external_effect: lineInbound.external_effect,
      line_push_performed: lineInbound.line_push_performed,
      customer_data_mutation_performed: lineInbound.customer_data_mutation_performed,
      data_lp_events_write_performed: lineInbound.data_lp_events_write_performed,
    },
    win_rule_contract: {
      ...scores.win_rule,
      challenger_win_rule_met: ab.challenger_win_rule_met,
      decision: ab.decision,
      promotion_performed: false,
    },
    real_data_decision_replay: {
      ok: decisionReplay.ok,
      mode: decisionReplay.mode,
      scenario_count: decisionReplay.scenario_count,
      scenario_ids: decisionReplay.scenario_ids,
      local_fixture_commands_executed: decisionReplay.local_fixture_commands_executed,
      local_importer_preview_commands_executed: decisionReplay.local_importer_preview_commands_executed,
      source_capture_ledger_replay_executed: decisionReplay.source_capture_ledger_replay_executed,
      source_capture_compile_commands_executed: decisionReplay.source_capture_compile_commands_executed,
      ledger_to_decision_replay_performed: decisionReplay.ledger_to_decision_replay_performed,
      execution_performed: decisionReplay.execution_performed,
      real_event_write_performed: decisionReplay.real_event_write_performed,
      data_lp_events_write_performed: decisionReplay.data_lp_events_write_performed,
      external_effect: decisionReplay.external_effect,
      scenarios: (decisionReplay.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: scenario.ok,
        imported_events: scenario.imported_events,
        challenger_decision: scenario.challenger_summary?.decision,
        ab_decision: scenario.ab_status?.decision,
        next_round_decision: scenario.next_round_summary?.decision,
        next_changed_variable: scenario.next_round_summary?.changed_variable,
        start_new_variable_round: scenario.next_round_summary?.start_new_variable_round,
        quality_regression_reasons: scenario.challenger_summary?.quality_regression_reasons ?? [],
        source_capture_compile_ok: scenario.source_capture_compile?.ok === true,
        source_capture_compile_status: scenario.source_capture_compile?.status ?? "missing",
        source_capture_compile_data_lp_events_write_performed: Boolean(scenario.source_capture_compile?.data_lp_events_write_performed),
        source_capture_compile_external_effect: Boolean(scenario.source_capture_compile?.external_effect),
      })),
    },
    output_status: outputStatus,
    approval_gate_ids: approval.items.map((item) => item.id),
    approval_resume_fixtures: {
      ok: approvalFixtures.ok,
      mode: approvalFixtures.mode,
      scenario_count: approvalFixtures.scenario_count,
      execution_performed: approvalFixtures.execution_performed,
      external_effect: approvalFixtures.external_effect,
      scenarios: (approvalFixtures.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: scenario.ok,
        ready_gate_count: scenario.ready_gate_count,
        sensitive_approval_detected: scenario.sensitive_approval_detected,
      })),
    },
    owner_approval_form: {
      ok: ownerApprovalForm.ok,
      mode: ownerApprovalForm.mode,
      status: ownerApprovalForm.status,
      approval_input_exists: ownerApprovalForm.approval_input_exists,
      form_gate_count: ownerApprovalForm.form_gate_count,
      excluded_manual_gate_count: ownerApprovalForm.excluded_manual_gate_count,
      download_filename: ownerApprovalForm.download_filename,
      review_download_filename: ownerApprovalForm.review_download_filename,
      browser_only: ownerApprovalForm.browser_only,
      browser_persistence: ownerApprovalForm.browser_persistence,
      form_action: ownerApprovalForm.form_action,
      network_calls_performed: ownerApprovalForm.network_calls_performed,
      live_input_files_created: ownerApprovalForm.live_input_files_created,
      approval_input_write_performed: ownerApprovalForm.approval_input_write_performed,
      real_events_unchanged: ownerApprovalForm.real_events_unchanged,
      data_lp_events_write_performed: ownerApprovalForm.data_lp_events_write_performed,
      external_effect: ownerApprovalForm.external_effect,
      public_link_change_performed: ownerApprovalForm.public_link_change_performed,
      production_deploy_performed: ownerApprovalForm.production_deploy_performed,
      github_push_or_pr_performed: ownerApprovalForm.github_push_or_pr_performed,
      formal_post_performed: ownerApprovalForm.formal_post_performed,
      line_push_performed: ownerApprovalForm.line_push_performed,
      customer_data_mutation_performed: ownerApprovalForm.customer_data_mutation_performed,
      payment_action_performed: ownerApprovalForm.payment_action_performed,
      delete_action_performed: ownerApprovalForm.delete_action_performed,
    },
    owner_approval_form_fixtures: {
      ok: ownerApprovalFormFixtures.ok,
      mode: ownerApprovalFormFixtures.mode,
      scenario_count: ownerApprovalFormFixtures.scenario_count,
      form_export_replay_executed: ownerApprovalFormFixtures.form_export_replay_executed,
      approval_resume_commands_executed: ownerApprovalFormFixtures.approval_resume_commands_executed,
      live_input_files_created: ownerApprovalFormFixtures.live_input_files_created,
      approval_input_write_performed: ownerApprovalFormFixtures.approval_input_write_performed,
      execution_performed: ownerApprovalFormFixtures.execution_performed,
      external_effect: ownerApprovalFormFixtures.external_effect,
      public_link_change_performed: ownerApprovalFormFixtures.public_link_change_performed,
      production_deploy_performed: ownerApprovalFormFixtures.production_deploy_performed,
      github_push_or_pr_performed: ownerApprovalFormFixtures.github_push_or_pr_performed,
      formal_post_performed: ownerApprovalFormFixtures.formal_post_performed,
      line_push_performed: ownerApprovalFormFixtures.line_push_performed,
      customer_data_mutation_performed: ownerApprovalFormFixtures.customer_data_mutation_performed,
      payment_action_performed: ownerApprovalFormFixtures.payment_action_performed,
      delete_action_performed: ownerApprovalFormFixtures.delete_action_performed,
      contract_checks: (ownerApprovalFormFixtures.contract_checks ?? []).map((item) => ({
        id: item.id,
        ok: item.ok,
      })),
      scenarios: (ownerApprovalFormFixtures.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: scenario.ok,
        ready_gate_count: scenario.ready_gate_count,
        sensitive_approval_detected: scenario.sensitive_approval_detected,
        github_push_or_pr_performed: scenario.github_push_or_pr_performed,
        external_effect: scenario.external_effect,
      })),
    },
    owner_gate_evidence: {
      ok: ownerEvidence.ok,
      mode: ownerEvidence.mode,
      status: ownerEvidence.status,
      input_exists: ownerEvidence.input_exists,
      evidence_only: ownerEvidence.evidence_only,
      ready_gate_count: ownerEvidence.ready_gate_count,
      non_manual_gate_count: ownerEvidence.non_manual_gate_count,
      issue_count: ownerEvidence.issue_count,
      execution_performed: ownerEvidence.execution_performed,
      external_effect: ownerEvidence.external_effect,
      ready_for_post_gate_verification: ownerEvidence.ready_for_post_gate_verification,
      gates: (ownerEvidence.gates ?? []).map((gate) => ({
        gate_id: gate.gate_id,
        evidence_detected: gate.evidence_detected,
        evidence_valid: gate.evidence_valid,
        ready_for_post_gate_verification: gate.ready_for_post_gate_verification,
        executed_by_this_script: gate.executed_by_this_script,
      })),
    },
    owner_gate_evidence_fixtures: {
      ok: ownerEvidenceFixtures.ok,
      mode: ownerEvidenceFixtures.mode,
      scenario_count: ownerEvidenceFixtures.scenario_count,
      local_fixture_commands_executed: ownerEvidenceFixtures.local_fixture_commands_executed,
      owner_gate_evidence_fixture_executed: ownerEvidenceFixtures.owner_gate_evidence_fixture_executed,
      execution_performed: ownerEvidenceFixtures.execution_performed,
      external_effect: ownerEvidenceFixtures.external_effect,
      scenarios: (ownerEvidenceFixtures.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: scenario.ok,
        intake_status: scenario.intake_status,
        ready_gate_count: scenario.ready_gate_count,
        issue_count: scenario.issue_count,
        sensitive_evidence_detected: scenario.sensitive_evidence_detected,
      })),
    },
    post_gate_verification: {
      ok: postGate.ok,
      mode: postGate.mode,
      status: postGate.status,
      owner_gate_evidence_status: postGate.owner_gate_evidence_status,
      ready_gate_count: postGate.ready_gate_count,
      non_manual_gate_count: postGate.non_manual_gate_count,
      no_network_read_performed: postGate.no_network_read_performed,
      no_remote_cli_performed: postGate.no_remote_cli_performed,
      no_actual_evidence_values_persisted: postGate.no_actual_evidence_values_persisted,
      execution_performed: postGate.execution_performed,
      external_effect: postGate.external_effect,
      gates: (postGate.gates ?? []).map((gate) => ({
        gate_id: gate.gate_id,
        owner_evidence_valid: gate.owner_evidence_valid,
        post_gate_verification_ready: gate.post_gate_verification_ready,
        safe_to_run_automatically: gate.safe_to_run_automatically,
      })),
    },
    post_gate_verification_fixtures: {
      ok: postGateFixtures.ok,
      mode: postGateFixtures.mode,
      scenario_count: postGateFixtures.scenario_count,
      local_fixture_commands_executed: postGateFixtures.local_fixture_commands_executed,
      owner_gate_evidence_fixture_executed: postGateFixtures.owner_gate_evidence_fixture_executed,
      post_gate_verification_fixture_executed: postGateFixtures.post_gate_verification_fixture_executed,
      execution_performed: postGateFixtures.execution_performed,
      external_effect: postGateFixtures.external_effect,
      scenarios: (postGateFixtures.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: scenario.ok,
        owner_evidence_status: scenario.owner_evidence_status,
        post_gate_status: scenario.post_gate_status,
        ready_gate_count: scenario.ready_gate_count,
        no_network_read_performed: scenario.no_network_read_performed,
        no_remote_cli_performed: scenario.no_remote_cli_performed,
      })),
    },
    github_export_bundle: {
      ok: githubExport.ok,
      mode: githubExport.mode,
      file_count: githubExport.file_count,
      repo_dir: githubExport.repo_dir,
      manifest_path: githubExport.manifest_path,
      report_path: githubExport.report_path,
      excluded_live_or_owner_inputs: githubExport.excluded_live_or_owner_inputs,
      external_effect: githubExport.external_effect,
      git_init_performed: githubExport.git_init_performed,
      git_commit_performed: githubExport.git_commit_performed,
      github_push_or_pr_performed: githubExport.github_push_or_pr_performed,
    },
    artifact_retention_monitor: {
      ok: artifactRetention.ok,
      mode: artifactRetention.mode,
      status: artifactRetention.status,
      total_human: artifactRetention.total_human,
      warning_count: artifactRetention.warning_count,
      cleanup_candidate_count: artifactRetention.cleanup_candidate_count,
      owner_review_required: artifactRetention.owner_review_required,
      cleanup_execution_policy: artifactRetention.cleanup_execution_policy,
      cleanup_command_generated: artifactRetention.cleanup_command_generated,
      cleanup_command_executed: artifactRetention.cleanup_command_executed,
      blocked_actions: artifactRetention.blocked_actions,
      external_effect: artifactRetention.external_effect,
      delete_action_performed: artifactRetention.delete_action_performed,
      sections: (artifactRetention.sections ?? []).map((section) => ({
        id: section.id,
        item_count: section.item_count,
        total_human: section.total_human,
        warning_count: section.warning_count,
        cleanup_candidate_count: section.cleanup_candidate_count,
        delete_action_performed: section.delete_action_performed,
        external_effect: section.external_effect,
      })),
    },
    artifact_retention_review_pack: {
      ok: artifactRetentionReview.ok,
      mode: artifactRetentionReview.mode,
      status: artifactRetentionReview.status,
      source_status_path: artifactRetentionReview.source_status_path,
      total_human: artifactRetentionReview.total_human,
      warning_count: artifactRetentionReview.warning_count,
      cleanup_candidate_count: artifactRetentionReview.cleanup_candidate_count,
      cleanup_candidates_reviewed_count: artifactRetentionReview.cleanup_candidates_reviewed_count,
      section_count: artifactRetentionReview.section_count,
      review_required: artifactRetentionReview.review_required,
      highest_priority_section_id: artifactRetentionReview.highest_priority_section_id,
      cleanup_execution_policy: artifactRetentionReview.cleanup_execution_policy,
      cleanup_command_generated: artifactRetentionReview.cleanup_command_generated,
      cleanup_command_executed: artifactRetentionReview.cleanup_command_executed,
      filesystem_mutation_performed: artifactRetentionReview.filesystem_mutation_performed,
      live_data_touched: artifactRetentionReview.live_data_touched,
      external_effect: artifactRetentionReview.external_effect,
      delete_action_performed: artifactRetentionReview.delete_action_performed,
    },
    github_actions_workflow: {
      ok: githubActionsWorkflowCheck(githubWorkflow),
      path: ".github/workflows/3q-growth-loop-weekly.yml",
      schedule_cron: "10 16 * * 6",
      taipei_time: "Sunday 00:10",
      workflow_dispatch: githubWorkflow.includes("workflow_dispatch:"),
      verify_command: githubWorkflow.includes("npm run verify"),
      upload_artifact: githubWorkflow.includes("actions/upload-artifact@v4"),
      deploy_step_present: /\bwrangler\s+deploy\b|npm run worker:deploy|production_deploy/i.test(githubWorkflow),
      git_write_step_present: /\bgit\s+(push|commit|tag|remote\s+add)\b|gh pr create/i.test(githubWorkflow),
      external_effect: false,
    },
    launchagent_runtime: {
      service_loaded: schedule.launchagent_status?.service_loaded ?? false,
      state: schedule.launchagent_status?.state ?? null,
      active_count: schedule.launchagent_status?.active_count ?? null,
      run_count: schedule.launchagent_status?.run_count ?? null,
      last_exit_code: schedule.launchagent_status?.last_exit_code ?? null,
      observed_successful_run: schedule.launchagent_status?.observed_successful_run ?? false,
      current_launchd_invocation_observed: schedule.launchagent_status?.current_launchd_invocation_observed ?? false,
      current_process_descends_from_service: schedule.launchagent_status?.current_process_descends_from_service ?? false,
      proof_kind: launchAgentRuntimeProof.proof_kind,
      proof_ok: launchAgentRuntimeProof.ok,
      external_effect: schedule.launchagent_status?.external_effect ?? false,
    },
    schedule_catchup: {
      ok: scheduleCatchup.ok,
      mode: scheduleCatchup.mode,
      status: scheduleCatchup.status,
      catchup_required: scheduleCatchup.catchup_required,
      latest_expected_run: scheduleCatchup.latest_expected_run,
      next_expected_run: scheduleCatchup.next_expected_run,
      weekly_runner_status: scheduleCatchup.weekly_runner?.status ?? null,
      weekly_runner_finished_at: scheduleCatchup.weekly_runner?.finished_at ?? null,
      weekly_runner_commands: scheduleCatchup.weekly_runner?.commands ?? null,
      weekly_runner_failed_commands: scheduleCatchup.weekly_runner?.failed_commands ?? null,
      weekly_runner_pending_commands: scheduleCatchup.weekly_runner?.pending_commands ?? null,
      weekly_runner_invoked: scheduleCatchup.weekly_runner_invoked,
      catchup_run_performed: scheduleCatchup.catchup_run_performed,
      next_safe_action: scheduleCatchup.next_safe_action,
      external_effect: scheduleCatchup.external_effect,
    },
    redline_priority: {
      ok: redlinePriority.ok,
      mode: redlinePriority.mode,
      status: redlinePriority.status,
      action_count: redlinePriority.action_count,
      local_action_count: redlinePriority.local_action_count,
      gate_action_count: redlinePriority.gate_action_count,
      manual_only_action_count: redlinePriority.manual_only_action_count,
      redline_queue_covered: redlinePriority.redline_queue_covered,
      uncovered_blocked_actions: redlinePriority.uncovered_blocked_actions,
      next_operator_action: redlinePriority.next_operator_action,
      no_autorun_for_external_gates: redlinePriority.no_autorun_for_external_gates,
      gates_execute_in_order: redlinePriority.gates_execute_in_order,
      execution_performed: redlinePriority.execution_performed,
      external_effect: redlinePriority.external_effect,
    },
    blocked_actions: blocked.items.map((item) => item.action),
    red_line_flags: collectRedLineFlags([pipeline, ab, nextRound.next_round ?? {}, launchReadiness.safety_invariants ?? {}, weeklyRunner ?? {}]),
    checks,
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };

  const status = buildStatus(audit, ownerApprovalForm, ownerApprovalFormFixtures);

  await writeJson(JSON_PATH, audit);
  await writeJson(STATUS_PATH, status);
  await writeFile(MD_PATH, renderMarkdown(audit));

  if (!audit.ok) {
    const failed = checks.filter((item) => !item.ok).map((item) => item.id).join(", ");
    throw new Error(`Objective sequence audit failed: ${failed}`);
  }

  console.log(JSON.stringify({ ok: true, output_json: JSON_PATH, output_md: MD_PATH, output_status: STATUS_PATH, checks: checks.length }, null, 2));
}

function launchAgentRuntimeProofStatus(schedule, weeklyRunner) {
  const runtime = schedule.launchagent_status ?? {};
  const completedExitZero = runtime.service_loaded === true
    && (runtime.run_count ?? 0) >= 1
    && runtime.last_exit_code === 0
    && runtime.observed_successful_run === true;
  if (completedExitZero) {
    return { ok: true, proof_kind: "completed_exit_zero" };
  }

  const successfulSteps = new Set(
    (weeklyRunner?.commands ?? [])
      .filter((command) => command.status === "success")
      .map((command) => command.step)
  );
  const currentRunReady = process.env.XPC_SERVICE_NAME === "com.angelia.3q-growth-loop.weekly"
    && runtime.service_loaded === true
    && runtime.state === "running"
    && (runtime.active_count ?? 0) > 0
    && runtime.current_launchd_invocation_observed === true
    && runtime.current_process_descends_from_service === true
    && ["running", "success"].includes(weeklyRunner?.status)
    && !(weeklyRunner?.commands ?? []).some((command) => command.status === "failed")
    && successfulSteps.has("launchagent_status_readback")
    && successfulSteps.has("artifact_retention_review");
  return {
    ok: currentRunReady,
    proof_kind: currentRunReady ? "current_run_pending_exit" : "none",
  };
}

function check(checks, id, ok, evidence) {
  checks.push({ id, ok: Boolean(ok), evidence, external_effect: false });
}

function buildStatus(audit, ownerApprovalForm, ownerApprovalFormFixtures) {
  const failedChecks = audit.checks.filter((item) => !item.ok);
  return {
    ok: audit.ok,
    generated_at: audit.generated_at,
    mode: "objective_sequence_audit_status",
    status: audit.status,
    check_count: audit.checks.length,
    failed_check_count: failedChecks.length,
    failed_checks: failedChecks.map((item) => item.id),
    sequence_ok: Boolean(
      audit.sequence_status.config_sequence_ok
      && audit.sequence_status.pipeline_sequence_ok
      && audit.sequence_status.pipeline_steps_ok
    ),
    weekly_runner_atomic_lock_ok: Object.values(audit.weekly_runner_concurrency ?? {}).every((value) => value === true),
    output_count: audit.output_status.length,
    missing_output_count: audit.output_status.filter((item) => !item.present).length,
    sample_threshold_met: audit.sample_gate.sample_threshold_met,
    launchagent_runtime_ok: audit.launchagent_runtime.proof_ok === true,
    launchagent_proof_kind: audit.launchagent_runtime.proof_kind,
    launchagent_current_run_pending_exit: audit.launchagent_runtime.proof_kind === "current_run_pending_exit",
    launchagent_run_count: audit.launchagent_runtime.run_count,
    launchagent_last_exit_code: audit.launchagent_runtime.last_exit_code,
    launchagent_state: audit.launchagent_runtime.state,
    owner_approval_form_ok: ownerApprovalFormCheck(ownerApprovalForm),
    owner_approval_form_fixture_ok: ownerApprovalFormFixtureCheck(ownerApprovalFormFixtures),
    owner_approval_form_status: ownerApprovalForm.status,
    owner_approval_form_gate_count: ownerApprovalForm.form_gate_count,
    owner_approval_form_fixture_scenarios: ownerApprovalFormFixtures.scenario_count,
    sample_gate_batch_handoff_ok: audit.sample_gate_batch_handoff.ok === true,
    sample_gate_batch_handoff_status: audit.sample_gate_batch_handoff.status,
    sample_gate_batch_handoff_full_coverage_ready: audit.sample_gate_batch_handoff.full_coverage_ready,
    sample_gate_batch_handoff_rows: audit.sample_gate_batch_handoff.all_p0_row_count,
    sample_gate_collection_sprint_ok: audit.sample_gate_collection_sprint.ok === true,
    sample_gate_collection_sprint_status: audit.sample_gate_collection_sprint.status,
    sample_gate_collection_sprint_p0_pending_count: audit.sample_gate_collection_sprint.p0_pending_count,
    sample_gate_collection_sprint_step_count: audit.sample_gate_collection_sprint.sprint_step_count,
    artifact_retention_ok: audit.artifact_retention_monitor.ok === true,
    artifact_retention_status: audit.artifact_retention_monitor.status,
    artifact_retention_warning_count: audit.artifact_retention_monitor.warning_count,
    artifact_retention_cleanup_candidate_count: audit.artifact_retention_monitor.cleanup_candidate_count,
    artifact_retention_cleanup_command_executed: audit.artifact_retention_monitor.cleanup_command_executed,
    artifact_retention_review_ok: audit.artifact_retention_review_pack.ok === true,
    artifact_retention_review_status: audit.artifact_retention_review_pack.status,
    artifact_retention_review_required: audit.artifact_retention_review_pack.review_required,
    artifact_retention_review_cleanup_candidate_count: audit.artifact_retention_review_pack.cleanup_candidate_count,
    artifact_retention_review_cleanup_command_executed: audit.artifact_retention_review_pack.cleanup_command_executed,
    artifact_retention_review_delete_action_performed: audit.artifact_retention_review_pack.delete_action_performed,
    cloudflare_d1_readiness_ok: audit.cloudflare_d1_readiness.ok === true,
    cloudflare_d1_readiness_status: audit.cloudflare_d1_readiness.status,
    cloudflare_d1_exact_match_count: audit.cloudflare_d1_readiness.exact_match_count,
    cloudflare_d1_dedicated_database_present: audit.cloudflare_d1_readiness.dedicated_database_present,
    live_telemetry_readiness_ok: audit.live_telemetry_readiness.ok === true,
    live_telemetry_readiness_status: audit.live_telemetry_readiness.status,
    live_telemetry_candidate_deployment_observed: audit.live_telemetry_readiness.candidate_deployment_observed === true,
    live_telemetry_candidate_operation_mode: audit.live_telemetry_readiness.candidate_operation_mode,
    live_telemetry_candidate_deploy_required: audit.live_telemetry_readiness.candidate_deploy_required === true,
    live_telemetry_observed_chain_ready_for_owner_evidence: audit.live_telemetry_readiness.observed_live_chain_ready_for_owner_evidence === true,
    live_telemetry_ingest_readiness_proven: audit.live_telemetry_readiness.live_ingest_readiness_proven === true,
    live_telemetry_weekly_aggregate_read_authorized: audit.live_telemetry_readiness.weekly_aggregate_read_authorized === true,
    live_telemetry_fixture_ok: audit.live_telemetry_readiness_fixtures.ok === true,
    live_telemetry_fixture_scenario_count: audit.live_telemetry_readiness_fixtures.scenario_count,
    d1_schema_contract_ok: audit.d1_schema_contract.ok === true,
    d1_schema_contract_status: audit.d1_schema_contract.status,
    d1_schema_contract_check_count: audit.d1_schema_contract.check_count,
    d1_schema_contract_failed_check_count: audit.d1_schema_contract.failed_check_count,
    d1_schema_migration_idempotent: audit.d1_schema_contract.migration_idempotent === true,
    approved_d1_config_status: audit.approved_d1_config.status,
    approved_d1_config_write_performed: audit.approved_d1_config.local_config_write_performed === true,
    d1_collection_mode_ok: audit.d1_collection_mode.ok === true,
    d1_collection_selected_scope: audit.d1_collection_mode.selected_scope,
    d1_collection_remote_read_authorized: audit.d1_collection_mode.remote_read_authorized === true,
    d1_collection_remote_read_performed: audit.d1_collection_mode.remote_read_performed === true,
    d1_collection_raw_event_rows_read_performed: audit.d1_collection_mode.raw_event_rows_read_performed === true,
    d1_collection_customer_data_read_performed: audit.d1_collection_mode.customer_data_read_performed === true,
    d1_collection_mode_fixture_ok: audit.d1_collection_mode_fixtures.ok === true,
    d1_aggregate_export_fixture_ok: audit.d1_aggregate_export_fixtures.ok === true,
    champion_local_branch_ok: audit.champion_local_branch.ok === true,
    champion_local_branch_status: audit.champion_local_branch.status,
    champion_local_branch_name: audit.champion_local_branch.branch,
    champion_local_branch_commit: audit.champion_local_branch.commit,
    champion_local_branch_remote_present: audit.champion_local_branch.remote_branch_present,
    champion_release_preflight_ok: audit.champion_release_preflight.ok === true,
    champion_release_preflight_status: audit.champion_release_preflight.status,
    champion_release_source_mode: audit.champion_release_preflight.source_mode,
    champion_release_template_dry_run_ok: audit.champion_release_preflight.production_command_template_dry_run_ok === true,
    champion_release_rollback_target_version_id: audit.champion_release_preflight.rollback_target_version_id,
    champion_github_handoff_ok: audit.champion_github_handoff.ok === true,
    champion_github_handoff_status: audit.champion_github_handoff.status,
    champion_github_repository: audit.champion_github_handoff.repository,
    champion_github_branch: audit.champion_github_handoff.branch,
    champion_github_commit: audit.champion_github_handoff.commit,
    champion_github_push_or_pr_performed: audit.champion_github_handoff.github_push_or_pr_performed === true,
    external_effect: false,
    data_lp_events_write_performed: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };
}

function thresholdsMatch(thresholds = {}) {
  return thresholds.min_visits === 100
    && thresholds.min_cta_clicks === 20
    && thresholds.min_line_adds === 5
    && thresholds.min_test_days === 3
    && thresholds.preferred_test_days === 7;
}

function weeklyRunnerConcurrencyCheck(source = "") {
  return source.includes("mkdir(RUN_LOCK_PATH")
    && source.includes('open(path.join(RUN_LOCK_PATH, RUN_LOCK_CLAIM_NAME), "wx"')
    && source.includes('status: "already_running"')
    && source.includes("did not overwrite weekly_runner_status.json")
    && source.includes("existingRunLockDecision")
    && source.includes("isProcessActive")
    && source.includes("observeProcessIdentity")
    && source.includes("recoveryClaimDecision")
    && source.includes("sameLockSnapshot")
    && source.includes("releaseRunLock(runLock)")
    && source.includes("rename(temporaryPath, STATUS_PATH)");
}

function weeklyRunnerLockFixturesCheck(status = {}) {
  return status.ok === true
    && status.mode === "isolated_weekly_runner_lock_policy_fixtures"
    && status.cases?.some((item) => item.id === "active_owner_over_four_hours_is_never_recovered" && item.observed === "keep_active_owner" && item.ok === true)
    && status.cases?.some((item) => item.id === "dead_owner_is_recovered" && item.observed === "recover_stale_or_dead_owner" && item.ok === true)
    && status.cases?.some((item) => item.id === "pid_reuse_identity_mismatch_is_recovered" && item.observed === "recover_pid_reused_owner" && item.ok === true)
    && status.cases?.some((item) => item.id === "two_recoverers_have_one_exclusive_claim" && item.observed === "one_recoverer_claimed" && item.ok === true)
    && status.cases?.some((item) => item.id === "filesystem_recovery_race_preserves_replacement_owner" && item.observed === "replacement_owner_preserved" && item.ok === true)
    && status.exclusive_recovery_claim_proven === true
    && status.filesystem_replacement_owner_preserved === true
    && status.pid_reuse_detected === true
    && status.external_effect === false;
}

function winRuleMatch(rule = {}) {
  return rule.metric === "line_add_rate"
    && rule.challenger_lift_required === 1.15
    && rule.require_sample_threshold_met === true
    && rule.require_no_quality_regression === true;
}

function sampleGateCheck(ab, nextRound) {
  if (ab.sample_threshold_met) {
    return true;
  }
  return ab.decision === "do_not_promote_challenger"
    && nextRound.decision === "continue_current_round_until_sample_threshold"
    && nextRound.next_round?.changed_variable === ab.changed_variable
    && nextRound.next_round?.start_new_variable_round === false;
}

function variableRotationCheck(status = {}, allowedVariables = []) {
  const required = ["hook", "offer", "visual_claim", "cta_text"];
  return status.ok === true
    && status.mode === "variable_rotation_fixture_dry_run"
    && status.scenario_count === required.length
    && status.candidate_template_count >= required.length * 3
    && status.live_config_write_performed === false
    && status.execution_performed === false
    && status.external_effect === false
    && status.public_link_change_performed === false
    && status.production_deploy_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && sameList(status.allowed_variables, allowedVariables)
    && sameList(status.expected_variables, required)
    && required.every((variable) => status.scenarios?.some((scenario) =>
      scenario.changed_variable === variable
      && scenario.ok === true
      && scenario.allowed_by_config === true
      && scenario.draft_count >= 3
      && scenario.changed_value_count >= 2
      && scenario.locked_variables_ok === true
      && scenario.changed_only_ok === true
      && scenario.external_effect === false
    ));
}

function fixtureCheck(fixtures) {
  const required = [
    "sample_insufficient_keeps_champion",
    "win_rule_queues_human_promotion_only",
    "sample_met_underperform_rework",
    "quality_regression_blocks_promotion",
    "lead_rate_regression_blocks_promotion",
    "close_rate_regression_blocks_promotion",
  ];
  return fixtures.ok === true
    && fixtures.real_event_write_performed === false
    && required.every((id) => fixtures.scenarios?.some((scenario) => scenario.id === id && scenario.ok === true));
}

function decisionReplayCheck(status = {}) {
  const required = [
    "sample_insufficient_replay",
    "winning_replay_owner_review_only",
    "underperform_replay_next_variable",
    "spam_regression_replay",
    "lead_regression_replay",
    "close_regression_replay",
  ];
  return status.ok === true
    && status.mode === "real_data_decision_replay_fixture_dry_run"
    && status.scenario_count === required.length
    && status.local_fixture_commands_executed === true
    && status.local_importer_preview_commands_executed === true
    && status.source_capture_ledger_replay_executed === true
    && status.source_capture_compile_commands_executed === true
    && status.ledger_to_decision_replay_performed === true
    && status.execution_performed === false
    && status.real_event_write_performed === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.public_link_change_performed === false
    && status.production_deploy_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && required.every((id) => status.scenarios?.some((scenario) =>
      scenario.id === id
      && scenario.ok === true
      && scenario.real_event_write_performed === false
      && scenario.data_lp_events_write_performed === false
      && scenario.external_effect === false
      && scenario.source_capture_compile?.ok === true
      && scenario.source_capture_compile?.status === "owner_preview_ready"
      && scenario.source_capture_compile?.data_lp_events_write_performed === false
      && scenario.source_capture_compile?.external_effect === false
      && scenario.importer_status?.funnel_ok === true
      && scenario.importer_status?.manual_ok === true
    ));
}

function sampleGateReplayCheck(status = {}) {
  const required = [
    "sample_gate_insufficient_keeps_collecting",
    "sample_gate_ready_challenger_beats_rate",
    "sample_gate_ready_challenger_underperforms",
  ];
  return status.ok === true
    && status.mode === "sample_gate_replay_fixture_dry_run"
    && status.template_rows === 18
    && status.scenario_count === required.length
    && status.local_fixture_commands_executed === true
    && status.sample_gate_ledger_replay_executed === true
    && status.source_capture_compile_commands_executed === true
    && status.importer_preview_commands_executed === true
    && status.execution_performed === false
    && status.real_event_write_performed === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.public_link_change_performed === false
    && status.production_deploy_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && required.every((id) => status.scenarios?.some((scenario) =>
      scenario.id === id
      && scenario.ok === true
      && scenario.real_event_write_performed === false
      && scenario.data_lp_events_write_performed === false
      && scenario.external_effect === false
      && scenario.source_capture_compile?.ok === true
      && scenario.source_capture_compile?.status === "owner_preview_ready"
      && scenario.source_capture_compile?.data_lp_events_write_performed === false
      && scenario.source_capture_compile?.external_effect === false
      && scenario.importer_status?.funnel_ok === true
      && scenario.importer_status?.manual_ok === true
    ));
}

function championIntegrationCandidateCheck(status = {}) {
  return status.ok === true
    && status.mode === "champion_integration_candidate_local_only"
    && status.source?.exact_source_lock_verified === true
    && status.source?.lock_commit_is_ancestor === true
    && status.source?.ancestry_verified === true
    && status.source?.expected_lock_tuple_verified === true
    && status.source?.ref_file_matches_lock === true
    && status.source?.mode === "git_ref_pinned"
    && typeof status.source?.observed_ref_commit === "string"
    && status.source.observed_ref_commit.length === 40
    && Object.values(status.checks ?? {}).every((value) => value === true)
    && status.syntax_check?.ok === true
    && status.worker_dry_run?.ok === true
    && status.privacy_contract?.customer_fields_collected === false
    && status.privacy_contract?.credentials_sent === false
    && status.privacy_contract?.line_add_inferred_from_click === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function championSourceLockFixturesCheck(status = {}) {
  const required = new Set([
    "exact_lock_passes",
    "descendant_with_same_target_passes",
    "annotated_ref_is_pinned_to_commit",
    "ref_advances_between_checks_with_same_target_passes",
    "blob_match_with_sha_mismatch_fails",
    "missing_repo_fallback_is_unverified_and_blocked",
    "descendant_target_drift_fails",
    "non_ancestor_with_same_target_fails",
  ]);
  const passed = new Set((status.cases ?? []).filter((item) => item.ok === true).map((item) => item.id));
  return status.ok === true
    && status.mode === "isolated_local_champion_source_lock_fixtures"
    && [...required].every((id) => passed.has(id))
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.github_push_or_pr_performed === false;
}

function championIntegrationSmokeCheck(status = {}) {
  return status.ok === true
    && status.mode === "isolated_local_champion_integration_smoke"
    && status.page_contract?.ok === true
    && Object.values(status.page_contract?.checks ?? {}).every((value) => value === true)
    && status.cors_contract?.ok === true
    && status.cors_contract?.allow_origin === status.champion_url
    && status.database_contract?.ok === true
    && status.database_contract?.allowed_page_view_rows === 1
    && status.database_contract?.allowed_cta_click_rows === 1
    && status.database_contract?.denied_origin_rows === 0
    && status.database_contract?.line_add_rows === 0
    && status.database_contract?.sensitive_rows === 0
    && status.denied_write?.status === 403
    && status.denied_write?.body?.error === "origin_not_allowed"
    && status.missing_origin_write?.status === 403
    && status.missing_origin_write?.body?.error === "origin_not_allowed"
    && status.sensitive_write?.status === 400
    && status.sensitive_write?.body?.error === "blocked_metadata_key"
    && status.sensitive_token_write?.status === 400
    && status.sensitive_token_write?.body?.error === "invalid_session_id"
    && status.real_event_write_performed === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function cloudflareD1ReadinessCheck(status = {}, inventory = {}) {
  const relatedNames = new Set((status.inventory?.related_databases ?? []).map((database) => database.name));
  const snapshotNames = new Set((inventory.related_databases ?? []).map((database) => database.name));
  return status.ok === true
    && status.mode === "cloudflare_d1_metadata_readiness"
    && status.expected?.database_name === "3q-growth-loop-candidate"
    && status.inventory?.snapshot_checked_at === inventory.checked_at
    && relatedNames.size === snapshotNames.size
    && [...relatedNames].every((name) => snapshotNames.has(name))
    && status.decision?.automatic_reuse_allowed === false
    && status.decision?.crm_database_reuse_allowed === false
    && status.decision?.inventory_table_count_authoritative === false
    && status.decision?.schema_absence_inferred_from_inventory === false
    && status.remote_table_query_performed === false
    && status.customer_data_read_performed === false
    && status.resource_create_performed === false
    && status.remote_schema_migration_performed === false
    && status.external_effect === false
    && inventory.mode === "read_only_cloudflare_d1_inventory"
    && inventory.remote_table_query_performed === false
    && inventory.customer_data_read_performed === false
    && inventory.resource_create_performed === false
    && inventory.external_effect === false;
}

function liveTelemetryReadinessCheck(status = {}) {
  const candidate = status.candidate_worker ?? {};
  const securityUpdateRequired = candidate.operation_mode === "deploy_candidate_worker_security_update"
    && candidate.security_contract_ok === false
    && candidate.deploy_required === true
    && candidate.redeploy_required === true;
  const provenanceVerificationRequired = candidate.operation_mode === "verify_existing_candidate_deployment"
    && candidate.security_contract_ok === true
    && candidate.deploy_required === false
    && candidate.redeploy_required === false;
  return status.ok === true
    && status.mode === "live_telemetry_chain_readiness"
    && ["candidate_worker_security_update_required", "live_chain_observed_owner_provenance_and_schema_evidence_required", "live_ingest_ready_recurring_read_not_approved", "live_ingest_and_weekly_aggregate_read_ready"].includes(status.status)
    && status.candidate_worker?.deployment_observed === true
    && status.candidate_worker?.health_ok === true
    && status.candidate_worker?.page_ok === true
    && status.candidate_worker?.expected_security_contract === "origin-pii-v2"
    && (securityUpdateRequired || provenanceVerificationRequired)
    && status.champion?.collector_configured === true
    && status.champion?.collector_origin_matches === true
    && status.champion?.privacy_event_contract_ok === true
    && status.d1?.exact_target_ready === true
    && status.d1?.inventory_table_count_authoritative === false
    && status.d1?.schema_absence_inferred_from_inventory === false
    && typeof status.d1?.schema_evidence_valid === "boolean"
    && typeof status.d1?.recurring_aggregate_read_approved === "boolean"
    && typeof status.decisions?.observed_live_chain_ready_for_owner_evidence === "boolean"
    && status.decisions?.live_ingest_readiness_proven === status.d1.schema_evidence_valid
    && status.decisions?.weekly_aggregate_read_authorized === (status.decisions.live_ingest_readiness_proven && status.d1.recurring_aggregate_read_approved)
    && status.remote_table_query_performed === false
    && status.raw_event_rows_read_performed === false
    && status.customer_data_read_performed === false
    && status.event_post_performed === false
    && status.data_lp_events_write_performed === false
    && status.production_deploy_performed === false
    && status.external_effect === false;
}

function liveTelemetryReadinessFixtureCheck(status = {}) {
  const expected = new Set([
    "candidate_missing_requires_deploy_gate",
    "deployed_candidate_missing_security_contract_requires_update",
    "live_chain_observed_requires_owner_provenance_and_schema_evidence",
    "collector_origin_mismatch_blocks_chain",
    "schema_and_deployment_evidence_valid_recurring_read_false",
    "full_evidence_enables_weekly_aggregate_read_plan",
  ]);
  const scenarios = status.scenarios ?? [];
  const ids = new Set(scenarios.map((scenario) => scenario.id));
  return status.ok === true
    && status.mode === "live_telemetry_readiness_fixture_dry_run"
    && status.scenario_count === expected.size
    && scenarios.every((scenario) => scenario.ok === true)
    && [...expected].every((id) => ids.has(id))
    && scenarios.find((scenario) => scenario.id === "schema_and_deployment_evidence_valid_recurring_read_false")?.live_ingest_readiness_proven === true
    && scenarios.find((scenario) => scenario.id === "schema_and_deployment_evidence_valid_recurring_read_false")?.weekly_aggregate_read_authorized === false
    && scenarios.find((scenario) => scenario.id === "full_evidence_enables_weekly_aggregate_read_plan")?.weekly_aggregate_read_authorized === true
    && scenarios.every((scenario) => scenario.inventory_table_count_authoritative === false)
    && scenarios.every((scenario) => scenario.schema_absence_inferred_from_inventory === false)
    && status.live_network_refresh_performed === false
    && status.remote_table_query_performed === false
    && status.raw_event_rows_read_performed === false
    && status.customer_data_read_performed === false
    && status.event_post_performed === false
    && status.data_lp_events_write_performed === false
    && status.production_deploy_performed === false
    && status.external_effect === false;
}

function championLocalBranchCheck(status = {}, candidate = {}) {
  const changedPaths = status.local_branch?.changed_paths ?? [];
  const alreadyMerged = status.status === "integration_already_merged_at_source_lock"
    && status.source_lock?.integration_already_merged === true
    && status.source_lock?.origin_main_commit === candidate.source?.commit;
  return status.ok === true
    && status.mode === "champion_local_feature_branch_review"
    && (alreadyMerged || status.status === "local_feature_commit_ready_owner_push_pr_gate")
    && status.source_lock?.commit === candidate.source?.commit
    && (alreadyMerged || status.local_branch?.source_lock_base_commit === candidate.source?.commit)
    && (alreadyMerged || status.local_branch?.worker_commit_parent === candidate.source?.commit)
    && (alreadyMerged || changedPaths.includes(candidate.source?.path))
    && (alreadyMerged || (changedPaths.length >= 1 && changedPaths.length <= 2))
    && typeof status.local_branch?.commit === "string"
    && status.local_branch.commit.length === 40
    && Number.isInteger(status.local_branch?.commit_count)
    && (alreadyMerged || status.local_branch.commit_count >= 1)
    && status.checks?.commit_stack_scoped === true
    && typeof status.local_branch?.candidate_sha256 === "string"
    && status.local_branch.candidate_sha256 === status.local_branch.committed_source_sha256
    && Object.values(status.checks ?? {}).every((value) => value === true)
    && ["absent", "reviewed_ancestor_local_ahead", "up_to_date_with_local"].includes(status.remote_observation?.state)
    && status.git_push_performed === false
    && status.github_push_or_pr_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function championReleasePreflightCheck(status = {}, liveSnapshot = {}, ownerPacket = {}) {
  const gateIds = new Set((ownerPacket.gates ?? []).map((gate) => gate.id));
  const liveContactStateKnown = (
    liveSnapshot.contact?.false_success_state_present === true
    && liveSnapshot.contact?.line_only_mode_present === false
  ) || (
    liveSnapshot.contact?.false_success_state_present === false
    && liveSnapshot.contact?.line_only_mode_present === true
  );
  return status.ok === true
    && status.mode === "clean_archive_champion_release_preflight_local_only"
    && status.status === "prepared_but_blocked_production_prerequisites"
    && status.source?.mode === "git_ref_pinned"
    && status.source?.lock_commit_is_ancestor === true
    && status.source?.ancestry_verified === true
    && status.source?.expected_lock_tuple_verified === true
    && status.source?.ref_file_matches_lock === true
    && typeof status.source?.observed_ref_commit === "string"
    && status.source.observed_ref_commit.length === 40
    && status.source?.source_repository_unchanged === true
    && status.candidate?.byte_identical_after_patch === true
    && Object.values(status.checks ?? {}).every((value) => value === true)
    && status.worker_dry_run?.ok === true
    && status.production_command_template_dry_run?.ok === true
    && status.production_command_template_dry_run?.upload_performed === false
    && liveSnapshot.ok === true
    && liveSnapshot.mode === "read_only_cloudflare_live_snapshot"
    && liveContactStateKnown
    && liveSnapshot.external_effect === false
    && ownerPacket.ok === true
    && ownerPacket.mode === "champion_release_owner_packet_review_only"
    && ownerPacket.current_live?.version_id === liveSnapshot.deployed_version?.id
    && ownerPacket.rollback?.target_version_id === liveSnapshot.deployed_version?.id
    && gateIds.has("review_champion_patch")
    && gateIds.has("provision_production_collector")
    && gateIds.has("approve_champion_production_deploy")
    && gateIds.has("approve_github_branch_push_or_pr")
    && ownerPacket.local_branch?.commit === status.local_branch?.commit
    && ownerPacket.collector_readiness?.status === status.collector_readiness?.status
    && ownerPacket.production_deploy_performed === false
    && ownerPacket.external_effect === false
    && status.source_repo_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function eventContractCheck(status) {
  const publicTypes = ["page_view", "cta_click"];
  const blockedTypes = ["link_click", "line_add", "lead_submit", "deal", "quality_flag"];
  return status.ok === true
    && status.external_effect === false
    && status.real_event_write_performed === false
    && status.data_lp_events_write_performed === false
    && status.sensitive_rows_written === 0
    && status.sensitive_rejection?.ok === true
    && status.invalid_event_rejection?.ok === true
    && status.sensitive_token_rejection?.ok === true
    && status.phone_campaign_rejection?.ok === true
    && status.cors_contract?.missing_origin_post?.status === 403
    && status.cors_contract?.missing_origin_post?.body?.error === "origin_not_allowed"
    && status.redirect_attribution?.ok === true
    && status.redirect_attribution?.observed?.asset_id === "challenger-week0-cta-text-v1"
    && status.redirect_attribution?.observed?.content_id === "event-contract-redirect-content"
    && status.redirect_attribution?.observed?.variant_id === "event-contract-redirect-variant"
    && status.ab_redirect_attribution?.ok === true
    && status.ab_redirect_attribution?.observed?.asset_id === "challenger-week0-cta-text-v1"
    && status.ab_redirect_attribution?.observed?.content_id === "event-contract-ab-content"
    && status.ab_redirect_attribution?.observed?.variant_id === "ab-week0-cta-text-001:challenger"
    && status.scheduled_quality_regression?.ok === true
    && status.scheduled_quality_regression?.challenger?.decision === "reject_quality_regression"
    && Number(status.scheduled_quality_regression?.challenger?.no_quality_regression) === 0
    && publicTypes.every((eventType) => status.event_type_counts?.[eventType] === 1)
    && blockedTypes.every((eventType) => !status.event_type_counts?.[eventType])
    && (status.blocked_public_events ?? []).every((event) => event.status === 400 && event.error === "event_type_not_allowed_public")
    && status.invalid_ab_sid_rejection?.ok === true
    && status.embedded_phone_ab_sid_rejection?.ok === true
    && status.embedded_phone_session_rejection?.ok === true
    && status.url_path_pii_rejection?.ok === true
    && status.public_event_field_rejection?.ok === true
    && status.body_limit?.declared_length_rejected === true
    && status.body_limit?.chunked_stream_rejected === true;
}

function workerDryRunCheck(status) {
  return status.ok === true
    && status.mode === "worker_deploy_dry_run_status"
    && status.command === "wrangler deploy --dry-run"
    && status.exit_code === 0
    && status.dry_run_exit_observed === true
    && status.required_markers_present === true
    && (status.failed_markers ?? []).length === 0
    && status.deploy_performed === false
    && status.production_deploy_performed === false
    && status.external_effect === false
    && status.public_link_change_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function trackingLinkSmokeCheck(status, trackingLinks) {
  const expectedIds = new Set((trackingLinks.links ?? []).map((link) => link.link_id));
  const checkedIds = new Set((status.checks ?? []).map((check) => check.link_id));
  const lineDestination = (trackingLinks.links ?? []).find((link) => link.target === "line")?.destination_url;
  const championDestination = (trackingLinks.links ?? []).find((link) => link.target === "champion")?.destination_url;
  return status.ok === true
    && status.mode === "isolated_local_tracking_link_smoke"
    && status.external_effect === false
    && status.real_event_write_performed === false
    && status.data_lp_events_write_performed === false
    && status.public_link_change_performed === false
    && status.production_deploy_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && status.links_checked === expectedIds.size
    && status.expected_link_count === expectedIds.size
    && status.isolated_link_click_events_written >= expectedIds.size
    && (status.checks ?? []).every((check) => check.ok === true && check.status === 302 && check.external_effect === false && check.followed_external_url === false)
    && Array.from(expectedIds).every((id) => checkedIds.has(id))
    && (status.checks ?? []).some((check) => check.role === "ab_small_traffic" && check.observed?.variant_id === "ab-week0-cta-text-001:challenger")
    && (status.checks ?? []).some((check) => check.target === "line" && sameRouteTarget(check.location, lineDestination))
    && (status.checks ?? []).some((check) => check.target === "champion" && sameRouteTarget(check.location, championDestination));
}

function sameRouteTarget(observed, expected) {
  try {
    const observedUrl = new URL(observed);
    const expectedUrl = new URL(expected);
    return observedUrl.origin === expectedUrl.origin && observedUrl.pathname === expectedUrl.pathname;
  } catch {
    return observed === expected;
  }
}

function championContractAuditCheck(status = {}) {
  const observations = status.observations ?? {};
  const falseLeadStateHandled = observations.misleading_success_state_detected === true
    ? status.prepared_but_blocked?.action === "repair_or_remove_champion_contact_form_false_success"
    : observations.line_only_contact_detected === true && status.prepared_but_blocked === null;
  return status.ok === true
    && status.mode === "champion_contract_audit_read_only"
    && status.champion?.url === "https://3q-site.milk790.workers.dev/"
    && falseLeadStateHandled
    && observations.lead_capture_transport_detected === false
    && status.scoring_policy?.worker_invocations_scoring_eligible === false
    && status.scoring_policy?.champion_form_submission_scoring_eligible === false
    && status.customer_data_read_performed === false
    && status.customer_data_mutation_performed === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.external_effect === false;
}

function eventInputQualityCheck(status) {
  return status.ok === true
    && status.external_effect === false
    && status.scoring_allowed === true
    && status.pii_or_sensitive_data_detected === false
    && status.data_lp_events_write_performed === false
    && (status.issues ?? []).length === 0
    && (status.duplicate_event_ids ?? []).length === 0
    && (status.unknown_asset_ids ?? []).length === 0
    && (status.unknown_event_types ?? []).length === 0
    && (status.unknown_keys ?? []).length === 0;
}

function lineInboundCheck(status) {
  const requiredScenarios = [
    "allowed_line_add_count_row",
    "allowed_lead_submit_count_row",
    "blocked_phone_column",
    "blocked_email_value",
    "blocked_chat_message_column",
    "deal_stays_owner_confirmed_aggregate",
  ];
  return status.ok === true
    && status.mode === "line_inbound_fixture_dry_run"
    && status.execution_performed === false
    && status.external_effect === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && status.data_lp_events_write_performed === false
    && requiredScenarios.every((id) => status.scenarios?.some((scenario) => scenario.id === id && scenario.ok === true));
}

function funnelAggregateCheck(status) {
  const requiredTypes = ["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"];
  return status.ok === true
    && status.mode === "full_funnel_preview"
    && status.external_effect === false
    && status.apply_performed === false
    && status.append_performed === false
    && status.data_lp_events_write_performed === false
    && status.contains_sensitive_columns === false
    && status.contains_sensitive_values === false
    && requiredTypes.every((eventType) => status.allowed_event_types?.includes(eventType))
    && ["link_click", "page_view", "cta_click"].every((eventType) => Number(status.counts_by_event_type?.[eventType] ?? 0) > 0);
}

function funnelAggregateFixtureCheck(status) {
  const required = [
    "valid_full_funnel_preview",
    "blocked_unknown_asset",
    "blocked_missing_content_id",
    "blocked_sensitive_column",
    "blocked_sensitive_value",
    "blocked_apply_without_append",
  ];
  return status.ok === true
    && status.mode === "funnel_aggregate_fixture_dry_run"
    && status.execution_performed === false
    && status.real_event_write_performed === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && required.every((id) => status.scenarios?.some((scenario) => scenario.id === id && scenario.ok === true && scenario.data_lp_events_write_performed === false));
}

function realDataApplyFixtureCheck(status) {
  const required = [
    "funnel_apply_requires_confirm_real_data",
    "funnel_copied_example_never_applies",
    "manual_apply_requires_confirm_real_data",
    "manual_copied_example_never_applies",
  ];
  return status.ok === true
    && status.mode === "real_data_apply_fixture_dry_run"
    && status.scenario_count === required.length
    && status.execution_performed === false
    && status.real_event_write_performed === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && required.every((id) => status.scenarios?.some((scenario) => scenario.id === id && scenario.ok === true && scenario.data_lp_events_write_performed === false && scenario.real_events_unchanged === true));
}

function realDataInputPackCheck(status = {}) {
  return status.ok === true
    && status.mode === "real_data_input_pack"
    && status.status === "template_ready"
    && status.template_only === true
    && status.live_input_files_created === false
    && status.apply_performed === false
    && status.append_performed === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && status.real_events_unchanged === true
    && Array.isArray(status.templates)
    && status.templates.length === 2
    && status.templates.every((item) => typeof item.template_path === "string" && item.template_path.includes("data/real_data_input_pack/"))
    && status.templates.every((item) => typeof item.live_target === "string" && !item.template_path.endsWith(item.live_target));
}

function sourceReadinessCheck(status = {}) {
  const requiredStages = ["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"];
  return status.ok === true
    && status.mode === "source_readiness_monitor"
    && ["waiting_for_real_data", "real_data_sources_present"].includes(status.status)
    && status.apply_performed === false
    && status.append_performed === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && Array.isArray(status.stages)
    && requiredStages.every((stage) => status.stages.some((item) => item.id === stage))
    && status.sample_progress?.min_visits === 100
    && status.sample_progress?.min_cta_clicks === 20
    && status.sample_progress?.min_line_adds === 5
    && status.sample_progress?.min_test_days === 3
    && status.sample_progress?.preferred_test_days === 7
    && (status.ready_for_public_iteration_decision === false || status.sample_progress.sample_threshold_met === true);
}

function sourceCaptureCheck(status = {}) {
  return status.ok === true
    && status.mode === "source_capture_pack"
    && ["waiting_for_owner_aggregate_capture", "capture_pack_ready_real_events_present"].includes(status.status)
    && status.template_only === true
    && status.owner_review_required === true
    && status.live_input_files_created === false
    && status.apply_performed === false
    && status.append_performed === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && status.real_events_unchanged === true
    && status.stage_count === 7
    && (status.ledger_rows ?? 0) > 0
    && (status.sample_gate_ledger_rows ?? 0) > 0
    && (status.importable_tracking_links ?? 0) > 0
    && (status.ab_router_gate_count ?? 0) >= 1;
}

function sourceCompileCheck(status = {}) {
  const allowedStatuses = ["waiting_for_filled_counts", "owner_preview_ready"];
  return status.ok === true
    && status.mode === "source_capture_compile_preview"
    && allowedStatuses.includes(status.status)
    && status.owner_review_required === true
    && status.live_input_files_created === false
    && status.apply_performed === false
    && status.append_performed === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && (status.issue_count ?? 0) === 0
    && (status.status !== "waiting_for_filled_counts" || (status.filled_rows ?? 0) === 0)
    && (status.status !== "owner_preview_ready" || (status.filled_rows ?? 0) > 0)
    && typeof status.funnel_preview_path === "string"
    && typeof status.manual_preview_path === "string";
}

function sourceCompileFixtureCheck(status = {}) {
  const required = [
    "valid_filled_compile_preview",
    "empty_template_waits_for_counts",
    "partial_blank_count_warns_not_blocks",
    "blocked_missing_pii_checked",
    "blocked_sensitive_evidence",
    "blocked_invalid_date",
    "blocked_invalid_target_file",
  ];
  return status.ok === true
    && status.mode === "source_capture_compile_fixture_dry_run"
    && status.scenario_count === required.length
    && status.local_fixture_commands_executed === true
    && status.execution_performed === false
    && status.real_event_write_performed === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && required.every((id) => status.scenarios?.some((scenario) => scenario.id === id && scenario.ok === true && scenario.data_lp_events_write_performed === false));
}

function realDataIntakeCheck(status = {}) {
  const allowedStatuses = ["no_real_input_files", "preview_ready_owner_apply_required", "input_attention_required"];
  return status.ok === true
    && status.mode === "real_data_intake_plan"
    && allowedStatuses.includes(status.status)
    && status.apply_performed === false
    && status.append_performed === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.real_events_unchanged === true
    && Array.isArray(status.input_files)
    && Array.isArray(status.owner_apply_commands)
    && status.owner_apply_commands.every((item) => typeof item.command === "string" && item.command.includes(":apply"));
}

function dataCollectionBriefCheck(queue = {}, status = {}, sampleGatePlan = {}, sampleGateStatus = {}) {
  const allowedStatuses = ["waiting_for_owner_aggregate_counts", "owner_filled_ledger_detected_compile_next"];
  const tasks = queue.tasks ?? [];
  const priorities = queue.stage_priorities ?? [];
  const expectedSampleTasks = sampleGateStatus.status === "sample_threshold_met" ? 0 : (sampleGateStatus.sample_stage_count ?? 0) * (status.importable_link_count ?? 0);
  const expectedSampleLinks = expectedSampleTasks === 0 ? 0 : status.importable_link_count;
  return status.ok === true
    && queue.ok === true
    && sampleGatePlan.ok === true
    && sampleGateStatus.ok === true
    && status.mode === "data_collection_brief"
    && queue.mode === "data_collection_brief"
    && sampleGatePlan.mode === "sample_gate_collection_plan"
    && sampleGateStatus.mode === "sample_gate_collection_plan"
    && allowedStatuses.includes(status.status)
    && allowedStatuses.includes(queue.status)
    && status.task_count === tasks.length
    && status.task_count === status.stage_count * status.importable_link_count
    && status.stage_count === 7
    && sampleGateStatus.sample_stage_count === 3
    && sampleGateStatus.p0_task_count === expectedSampleTasks
    && sampleGateStatus.p0_link_count === expectedSampleLinks
    && status.sample_gate_status === sampleGateStatus.status
    && status.sample_gate_p0_task_count === sampleGateStatus.p0_task_count
    && status.sample_gate_p0_link_count === sampleGateStatus.p0_link_count
    && status.importable_link_count > 0
    && status.gated_link_count >= 1
    && status.real_events_unchanged === true
    && status.live_input_files_created === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && queue.live_input_files_created === false
    && queue.data_lp_events_write_performed === false
    && queue.external_effect === false
    && queue.real_events_unchanged === true
    && sampleGatePlan.data_lp_events_write_performed === false
    && sampleGatePlan.external_effect === false
    && sampleGateStatus.data_lp_events_write_performed === false
    && sampleGateStatus.external_effect === false
    && tasks.every((task) =>
      task.external_effect === false
      && Array.isArray(task.required_owner_fields)
      && task.required_owner_fields.includes("aggregate_count")
      && task.required_owner_fields.includes("evidence_ref")
      && task.required_owner_fields.includes("pii_checked")
      && typeof task.owner_fill_path === "string"
      && task.owner_fill_path.endsWith("source_capture_ledger.filled.csv")
    )
    && ["page_view", "cta_click", "line_add"].every((eventType) => {
      const priority = priorities.find((stage) => stage.event_type === eventType);
      return status.sample_threshold_met
        ? Boolean(priority)
        : priority?.priority === "P0_sample_gate" && Number(priority.sample_gap ?? 0) > 0;
    });
}

function sourceTrustMatrixCheck(matrix = {}, compact = {}, dataProgress = {}) {
  const sources = Array.isArray(matrix.sources) ? matrix.sources : [];
  const localD1 = sources.find((source) => source.id === "local_d1_export");
  const realEvents = sources.find((source) => source.id === "real_lp_events_jsonl");
  const ownerPreflight = sources.find((source) => source.id === "owner_data_preflight");
  return matrix.ok === true
    && compact.ok === true
    && matrix.mode === "source_trust_matrix_local_only"
    && compact.mode === matrix.mode
    && compact.status === matrix.status
    && sources.length >= 6
    && Boolean(localD1)
    && Boolean(realEvents)
    && Boolean(ownerPreflight)
    && localD1.data_lp_events_write_performed === false
    && realEvents.data_lp_events_write_performed === false
    && ownerPreflight.data_lp_events_write_performed === false
    && ((localD1.status === "remote_aggregate_only" && localD1.trust_level === "owner_approved_remote_export" && localD1.scoring_input_allowed === true)
      || (localD1.trust_level === "local_review_only" && localD1.scoring_input_allowed === false))
    && matrix.p0_pending_count === dataProgress.p0_pending_count
    && matrix.sample_threshold_met === dataProgress.sample_threshold_met
    && matrix.scoring_allowed_now === (matrix.trusted_scoring_source_count > 0)
    && matrix.ready_for_public_iteration_decision === false
    && matrix.data_lp_events_write_performed === false
    && matrix.live_input_files_created === false
    && matrix.external_effect === false
    && matrix.public_link_change_performed === false
    && matrix.production_deploy_performed === false
    && matrix.github_push_or_pr_performed === false
    && matrix.formal_post_performed === false
    && matrix.line_push_performed === false
    && matrix.customer_data_mutation_performed === false
    && matrix.payment_action_performed === false
    && matrix.delete_action_performed === false;
}

function ownerCaptureQueueCheck(status = {}, sampleGateStatus = {}) {
  const allowedStatuses = ["waiting_for_owner_sample_gate_counts", "owner_sample_gate_filled_compile_next"];
  return status.ok === true
    && status.mode === "week0_owner_capture_queue"
    && allowedStatuses.includes(status.status)
    && status.p0_task_count === sampleGateStatus.p0_task_count
    && status.p0_link_count === sampleGateStatus.p0_link_count
    && status.p0_task_count === 18
    && status.p0_link_count === 6
    && status.source_group_count >= 2
    && typeof status.owner_fill_path === "string"
    && status.owner_fill_path.endsWith("sample_gate_ledger.filled.csv")
    && typeof status.next_safe_command_after_owner_fill === "string"
    && status.next_safe_command_after_owner_fill.includes("source:compile")
    && status.real_events_unchanged === true
    && status.live_input_files_created === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function ownerSampleGateCheck(status = {}) {
  const allowedStatuses = [
    "waiting_for_owner_sample_gate_counts",
    "owner_counts_incomplete",
    "sample_insufficient_keep_champion",
    "sample_rate_win_needs_quality_review",
    "sample_ready_challenger_underperforms",
  ];
  return status.ok === true
    && status.mode === "owner_sample_gate_status"
    && allowedStatuses.includes(status.status)
    && typeof status.decision === "string"
    && status.quality_guard_status === "not_evaluated_from_sample_gate"
    && status.challenger_win_rule_met === false
    && status.promotion_performed === false
    && status.real_events_unchanged === true
    && status.live_input_files_created === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function sampleGateOwnerWorksheetCheck(status = {}, ownerSampleGate = {}) {
  const allowedStatuses = [
    "waiting_for_owner_sample_gate_counts",
    "owner_filled_ledger_detected_review_compile_next",
  ];
  return status.ok === true
    && status.mode === "sample_gate_owner_worksheet"
    && allowedStatuses.includes(status.status)
    && status.owner_sample_gate_status === ownerSampleGate.status
    && status.row_count === 18
    && status.link_count === 6
    && status.source_group_count === 2
    && (status.required_owner_fields ?? []).includes("aggregate_count")
    && (status.required_owner_fields ?? []).includes("pii_checked")
    && status.real_events_unchanged === true
    && status.live_input_files_created === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function nextP0OwnerFormCheck(status = {}, nextP0OwnerInputs = {}) {
  const requiredHeaders = [
    "rank",
    "capture_date",
    "role",
    "tracking_link_id",
    "event_type",
    "stage_label",
    "source_surface",
    "target_live_file",
    "aggregate_count",
    "evidence_ref",
    "reviewer",
    "pii_checked",
  ];
  return status.ok === true
    && status.mode === "next_p0_owner_form"
    && status.status === "ready_local_next_p0_owner_form"
    && status.row_count === nextP0OwnerInputs.current_input_count
    && status.current_input_count === nextP0OwnerInputs.current_input_count
    && status.row_count > 0
    && status.source_group_count === nextP0OwnerInputs.source_group_count
    && status.download_filename === "next_p0_owner_inputs.filled.csv"
    && status.json_download_filename === "next_p0_owner_inputs.review.json"
    && sameList(status.export_headers ?? [], requiredHeaders)
    && /not a live input CSV/i.test(status.export_contract ?? "")
    && status.browser_only === true
    && status.browser_persistence === false
    && status.form_action === "none"
    && status.network_calls_performed === false
    && status.real_events_unchanged === true
    && status.live_input_files_created === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function nextP0OwnerFormFixtureCheck(status = {}, formStatus = {}) {
  const requiredScenarioIds = [
    "html_contains_all_focused_inputs",
    "no_network_or_browser_persistence",
    "exports_aggregate_only_review_contract",
    "red_line_flags_false",
  ];
  const scenarios = status.scenarios ?? [];
  return status.ok === true
    && status.mode === "next_p0_owner_form_fixture_dry_run"
    && status.row_count === formStatus.row_count
    && status.expected_row_count === formStatus.row_count
    && status.scenario_count === requiredScenarioIds.length
    && requiredScenarioIds.every((id) => scenarios.some((scenario) => scenario.id === id && scenario.ok === true))
    && status.browser_form_static_checks_executed === true
    && status.export_contract_verified === true
    && status.local_fixture_commands_executed === true
    && scenarios.every((scenario) => scenario.live_input_files_created === false)
    && scenarios.every((scenario) => scenario.data_lp_events_write_performed === false)
    && scenarios.every((scenario) => scenario.external_effect === false)
    && status.real_events_unchanged === true
    && status.live_input_files_created === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function nextP0OwnerIntakeCheck(status = {}, nextP0OwnerInputs = {}) {
  const allowedStatuses = [
    "waiting_for_next_p0_owner_download",
    "next_p0_owner_download_preview_ready",
    "next_p0_owner_download_staged_local_inputs",
  ];
  return status.ok === true
    && status.mode === "next_p0_owner_intake"
    && allowedStatuses.includes(status.status)
    && status.expected_row_count === nextP0OwnerInputs.current_input_count
    && (status.candidate_paths_checked ?? []).some((item) => item.includes("next_p0_owner_inputs.quick-filled.preview.csv"))
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.public_link_change_performed === false
    && status.production_deploy_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function nextP0OwnerIntakeFixtureCheck(status = {}, nextP0OwnerInputs = {}) {
  const requiredScenarioIds = [
    "valid_download_preview_ready",
    "quick_preview_auto_intake_ready",
    "sensitive_evidence_blocked",
    "stage_without_confirmation_blocked",
    "confirmed_stage_writes_temp_live_inputs_only",
  ];
  const scenarios = status.scenarios ?? [];
  return status.ok === true
    && status.mode === "next_p0_owner_intake_fixture_dry_run"
    && status.row_count === nextP0OwnerInputs.current_input_count
    && status.scenario_count === requiredScenarioIds.length
    && requiredScenarioIds.every((id) => scenarios.some((scenario) => scenario.id === id && scenario.ok === true))
    && status.local_fixture_commands_executed === true
    && status.live_project_inputs_created === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && scenarios.every((scenario) => scenario.live_project_inputs_created === false)
    && scenarios.every((scenario) => scenario.data_lp_events_write_performed === false)
    && scenarios.every((scenario) => scenario.external_effect === false)
    && status.public_link_change_performed === false
    && status.production_deploy_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function ownerDataPreflightCheck(status = {}) {
  const allowedStatuses = [
    "waiting_for_owner_preview_rows",
    "owner_preview_keep_collecting",
    "owner_preview_sample_ready_no_auto_promotion",
    "owner_preview_win_needs_quality_and_promotion_review",
  ];
  return status.ok === true
    && status.mode === "owner_data_preflight_local_only"
    && allowedStatuses.includes(status.status)
    && Number.isInteger(status.selected_source_row_count)
    && Number.isInteger(status.selected_source_event_total)
    && status.owner_review_required === true
    && status.real_events_unchanged === true
    && status.data_lp_events_write_performed === false
    && status.apply_performed === false
    && status.append_performed === false
    && status.live_input_files_created === false
    && status.external_effect === false
    && status.public_link_change_performed === false
    && status.production_deploy_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function sampleGateCaptureCalendarCheck(status = {}, nextP0OwnerInputs = {}, dataCollectionProgress = {}) {
  const allowedStatuses = [
    "waiting_for_owner_sample_gate_counts",
    "sample_threshold_met_review_quality_gate",
  ];
  return status.ok === true
    && status.mode === "sample_gate_capture_calendar"
    && allowedStatuses.includes(status.status)
    && Number(status.event_count ?? 0) >= 3
    && Boolean(status.next_due_event_id)
    && Boolean(status.next_due_date)
    && status.p0_input_count === nextP0OwnerInputs.current_input_count
    && status.p0_pending_count === dataCollectionProgress.p0_pending_count
    && status.progress_status === dataCollectionProgress.status
    && status.calendar_import_performed === false
    && status.system_reminder_created === false
    && status.browser_open_performed === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.public_link_change_performed === false
    && status.production_deploy_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function sampleGateDueStatusCheck(status = {}, captureCalendar = {}, nextP0OwnerInputs = {}, dataCollectionProgress = {}) {
  const allowedStatuses = [
    "waiting_until_day3",
    "day3_due_waiting_for_owner_counts",
    "day3_overdue_waiting_for_owner_counts",
    "day7_due_waiting_for_owner_counts",
    "counts_filled_sample_insufficient_continue_champion",
    "sample_threshold_met_quality_gate_next",
    "sample_rate_candidate_due_quality_review",
  ];
  return status.ok === true
    && status.mode === "sample_gate_due_status"
    && allowedStatuses.includes(status.status)
    && Boolean(status.today)
    && Boolean(status.min_check_date)
    && Boolean(status.preferred_check_date)
    && Boolean(status.due_event_id)
    && Boolean(status.due_date)
    && status.p0_input_count === nextP0OwnerInputs.current_input_count
    && status.p0_pending_count === dataCollectionProgress.p0_pending_count
    && status.progress_status === dataCollectionProgress.status
    && status.capture_calendar_status === captureCalendar.status
    && status.capture_calendar_next_due_date === captureCalendar.next_due_date
    && status.capture_calendar_next_due_event_id === captureCalendar.next_due_event_id
    && status.challenger_promotion_allowed === false
    && status.next_variable_rotation_allowed === false
    && status.calendar_import_performed === false
    && status.system_reminder_created === false
    && status.browser_open_performed === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.public_link_change_performed === false
    && status.production_deploy_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function sampleGateOwnerFormCheck(status = {}) {
  const allowedStatuses = [
    "ready_local_browser_fill",
    "owner_filled_ledger_detected_review_before_overwrite",
  ];
  return status.ok === true
    && status.mode === "sample_gate_owner_form"
    && allowedStatuses.includes(status.status)
    && status.row_count === 18
    && status.link_count === 6
    && status.source_group_count === 2
    && (status.required_owner_fields ?? []).includes("aggregate_count")
    && (status.required_owner_fields ?? []).includes("pii_checked")
    && status.download_filename === "sample_gate_ledger.filled.csv"
    && status.browser_only === true
    && status.browser_persistence === false
    && status.form_action === "none"
    && status.network_calls_performed === false
    && status.real_events_unchanged === true
    && status.live_input_files_created === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function sampleGateOwnerFormFixtureCheck(status = {}) {
  const requiredScenarioIds = [
    "form_export_sample_insufficient_keeps_collecting",
    "form_export_ready_queues_owner_review",
    "form_export_sensitive_evidence_blocked",
  ];
  const scenarios = status.scenarios ?? [];
  return status.ok === true
    && status.mode === "sample_gate_owner_form_fixture_dry_run"
    && status.scenario_count === requiredScenarioIds.length
    && requiredScenarioIds.every((id) => scenarios.some((scenario) => scenario.id === id && scenario.ok === true))
    && scenarios.some((scenario) => scenario.owner_status === "sample_insufficient_keep_champion")
    && scenarios.some((scenario) => scenario.owner_status === "sample_rate_win_needs_quality_review" && scenario.owner_review_required === true)
    && scenarios.some((scenario) => scenario.owner_status === "blocked_invalid_owner_sample_gate" && scenario.owner_issue_count > 0)
    && scenarios.every((scenario) => scenario.quality_guard_status === "not_evaluated_from_sample_gate")
    && scenarios.every((scenario) => scenario.challenger_win_rule_met === false)
    && scenarios.every((scenario) => scenario.promotion_performed === false)
    && scenarios.every((scenario) => scenario.live_input_files_created === false)
    && scenarios.every((scenario) => scenario.data_lp_events_write_performed === false)
    && scenarios.every((scenario) => scenario.external_effect === false)
    && status.local_fixture_commands_executed === true
    && status.form_export_replay_executed === true
    && status.source_capture_compile_commands_executed === true
    && status.owner_sample_gate_commands_executed === true
    && status.real_events_unchanged === true
    && status.live_input_files_created === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function sampleGateBatchHandoffCheck(status = {}, sampleGateStatus = {}, nextP0OwnerInputs = {}) {
  return status.ok === true
    && status.mode === "sample_gate_batch_handoff_local_only"
    && ["p0_full_coverage_batched_for_owner_counts", "sample_gate_already_met"].includes(status.status)
    && status.p0_task_count === sampleGateStatus.p0_task_count
    && status.p0_task_count === 18
    && status.all_p0_row_count === 18
    && status.focused_batch_row_count > 0
    && status.focused_batch_row_count <= Math.max(9, nextP0OwnerInputs.current_input_count ?? 0)
    && status.remaining_batch_row_count >= 0
    && status.focused_batch_row_count + status.remaining_batch_row_count === status.all_p0_row_count
    && status.p0_pending_count <= status.p0_task_count
    && status.focused_pending_count + status.remaining_pending_count === status.p0_pending_count
    && status.batch_count === 2
    && status.full_coverage_ready === true
    && status.live_input_files_created === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function sampleGateCollectionSprintCheck(status = {}, batchStatus = {}, dataProgress = {}) {
  return status.ok === true
    && status.mode === "sample_gate_collection_sprint_local_only"
    && [
      "sample_gate_met_sprint_not_needed",
      "day3_overdue_collection_sprint_active",
      "sample_gate_due_collection_sprint_active",
      "sample_gate_collection_sprint_prepared",
    ].includes(status.status)
    && status.p0_full_task_count === batchStatus.p0_task_count
    && status.p0_full_row_count === batchStatus.all_p0_row_count
    && status.p0_pending_count === dataProgress.p0_pending_count
    && status.p0_pending_count <= status.p0_full_task_count
    && status.focused_missing_count >= 0
    && status.sprint_step_count >= 1
    && status.owner_open_target_count >= 1
    && status.owner_review_required === true
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.live_input_files_created === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function ownerSampleGateFixtureCheck(status = {}) {
  const requiredScenarioIds = [
    "missing_input_waits_for_owner_counts",
    "partial_counts_keep_collecting",
    "sample_insufficient_due_visits",
    "sample_insufficient_due_test_days",
    "sample_rate_win_needs_quality_review",
    "sample_ready_challenger_underperforms",
    "sensitive_evidence_blocks_status",
  ];
  const scenarios = status.scenarios ?? [];
  return status.ok === true
    && status.mode === "owner_sample_gate_fixture_dry_run"
    && status.scenario_count === requiredScenarioIds.length
    && requiredScenarioIds.every((id) => scenarios.some((scenario) => scenario.id === id && scenario.ok === true))
    && scenarios.every((scenario) => scenario.quality_guard_status === "not_evaluated_from_sample_gate")
    && scenarios.every((scenario) => scenario.challenger_win_rule_met === false)
    && scenarios.every((scenario) => scenario.promotion_performed === false)
    && status.owner_sample_gate_commands_executed === true
    && status.real_events_unchanged === true
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function ownerQualityReviewCheck(status = {}, ownerSampleGate = {}) {
  const allowedStatuses = [
    "waiting_for_sample_rate_candidate",
    "waiting_for_owner_quality_evidence",
    "owner_quality_review_passed_no_auto_promotion",
    "owner_quality_review_failed_keep_champion",
  ];
  const ownerSampleRateCandidate = Boolean(ownerSampleGate.sample_rate_win_candidate)
    || ownerSampleGate.status === "sample_rate_win_needs_quality_review";
  const passStateOk = status.status !== "owner_quality_review_passed_no_auto_promotion"
    || (
      status.no_quality_regression === true
      && status.challenger_win_rule_met === true
      && status.promotion_review_queued === true
    );
  const nonPassStateOk = status.status === "owner_quality_review_passed_no_auto_promotion"
    || (
      status.challenger_win_rule_met === false
      && status.promotion_review_queued === false
    );
  return status.ok === true
    && status.mode === "owner_quality_review"
    && allowedStatuses.includes(status.status)
    && status.sample_rate_win_candidate === ownerSampleRateCandidate
    && passStateOk
    && nonPassStateOk
    && status.promotion_performed === false
    && status.live_input_files_created === false
    && status.data_lp_events_write_performed === false
    && status.approval_queue_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function ownerQualityReviewFormCheck(status = {}, ownerQualityReview = {}) {
  const allowedStatuses = [
    "waiting_for_sample_rate_candidate_local_form_ready",
    "ready_local_quality_review_fill",
    "owner_quality_review_input_detected_review_before_overwrite",
  ];
  return status.ok === true
    && status.mode === "owner_quality_review_form"
    && allowedStatuses.includes(status.status)
    && status.owner_quality_review_status === ownerQualityReview.status
    && status.sample_rate_win_candidate === ownerQualityReview.sample_rate_win_candidate
    && (status.required_owner_fields ?? []).includes("reviewer")
    && (status.required_owner_fields ?? []).includes("pii_checked")
    && (status.required_owner_fields ?? []).includes("evidence_ref")
    && (status.required_owner_fields ?? []).includes("lead_rate_retention_vs_champion")
    && (status.required_owner_fields ?? []).includes("close_rate_retention_vs_champion")
    && (status.required_owner_fields ?? []).includes("spam_flag_rate")
    && status.download_filename === "owner_quality_review.filled.json"
    && status.review_download_filename === "owner_quality_review_form.review.json"
    && status.browser_only === true
    && status.browser_persistence === false
    && status.form_action === "none"
    && status.network_calls_performed === false
    && status.real_events_unchanged === true
    && status.live_input_files_created === false
    && status.data_lp_events_write_performed === false
    && status.approval_queue_write_performed === false
    && status.external_effect === false
    && status.promotion_performed === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function ownerQualityReviewFormFixtureCheck(status = {}) {
  const requiredScenarioIds = [
    "quality_form_export_waits_for_sample_rate_candidate",
    "quality_form_export_pass_queues_owner_review",
    "quality_form_export_regression_keeps_champion",
    "quality_form_export_sensitive_notes_blocked",
  ];
  const scenarios = status.scenarios ?? [];
  return status.ok === true
    && status.mode === "owner_quality_review_form_fixture_dry_run"
    && status.scenario_count === requiredScenarioIds.length
    && requiredScenarioIds.every((id) => scenarios.some((scenario) => scenario.id === id && scenario.ok === true))
    && scenarios.some((scenario) => scenario.owner_status === "waiting_for_sample_rate_candidate" && scenario.no_quality_regression === null)
    && scenarios.some((scenario) => scenario.owner_status === "owner_quality_review_passed_no_auto_promotion" && scenario.no_quality_regression === true && scenario.promotion_review_queued === true)
    && scenarios.some((scenario) => scenario.owner_status === "owner_quality_review_failed_keep_champion" && scenario.no_quality_regression === false && scenario.quality_regression_count > 0)
    && scenarios.some((scenario) => scenario.owner_status === "blocked_invalid_owner_quality_review" && scenario.issue_count > 0)
    && scenarios.every((scenario) => scenario.promotion_performed === false)
    && scenarios.every((scenario) => scenario.data_lp_events_write_performed === false)
    && scenarios.every((scenario) => scenario.approval_queue_write_performed === false)
    && scenarios.every((scenario) => scenario.external_effect === false)
    && status.local_fixture_commands_executed === true
    && status.form_export_replay_executed === true
    && status.owner_quality_review_commands_executed === true
    && status.real_events_unchanged === true
    && status.live_input_files_created === false
    && status.real_event_write_performed === false
    && status.data_lp_events_write_performed === false
    && status.approval_queue_write_performed === false
    && status.external_effect === false
    && status.promotion_performed === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function ownerQualityReviewFixtureCheck(status = {}) {
  const requiredScenarioIds = [
    "waiting_for_sample_rate_candidate_no_input",
    "sample_rate_win_waits_for_quality_evidence",
    "sample_rate_win_quality_pass_queues_review",
    "sample_rate_win_quality_regression_keeps_champion",
    "sensitive_evidence_blocks_review",
    "missing_required_fields_blocks_review",
  ];
  const scenarios = status.scenarios ?? [];
  return status.ok === true
    && status.mode === "owner_quality_review_fixture_dry_run"
    && status.scenario_count === requiredScenarioIds.length
    && requiredScenarioIds.every((id) => scenarios.some((scenario) => scenario.id === id && scenario.ok === true))
    && scenarios.some((scenario) => scenario.status === "waiting_for_sample_rate_candidate" && scenario.no_quality_regression === null)
    && scenarios.some((scenario) => scenario.status === "waiting_for_owner_quality_evidence" && scenario.owner_review_required === true)
    && scenarios.some((scenario) => scenario.status === "owner_quality_review_passed_no_auto_promotion" && scenario.no_quality_regression === true && scenario.promotion_review_queued === true)
    && scenarios.some((scenario) => scenario.status === "owner_quality_review_failed_keep_champion" && scenario.no_quality_regression === false && scenario.quality_regression_count > 0)
    && scenarios.some((scenario) => scenario.status === "blocked_invalid_owner_quality_review" && scenario.issue_count > 0)
    && scenarios.every((scenario) => scenario.promotion_performed === false)
    && scenarios.every((scenario) => scenario.data_lp_events_write_performed === false)
    && scenarios.every((scenario) => scenario.approval_queue_write_performed === false)
    && scenarios.every((scenario) => scenario.external_effect === false)
    && status.local_fixture_commands_executed === true
    && status.owner_quality_review_commands_executed === true
    && status.real_events_unchanged === true
    && status.data_lp_events_write_performed === false
    && status.approval_queue_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function northStarCheck(status = {}, scores = {}, funnelBreakdown = {}, ownerSampleGate = {}) {
  const path = status.north_star?.path ?? [];
  return status.ok === true
    && status.mode === "north_star_funnel_local_only"
    && sameList(path, ["link_click", "line_add", "lead_submit", "deal"])
    && status.north_star?.unit === "per_100_link_clicks"
    && status.north_star?.primary_metric === "line_adds_per_100_clicks"
    && status.totals?.link_clicks === (scores.assets ?? []).reduce((total, asset) => total + Number(asset.link_clicks ?? 0), 0)
    && status.totals?.line_adds === (scores.assets ?? []).reduce((total, asset) => total + Number(asset.line_adds ?? 0), 0)
    && status.totals?.leads === (scores.assets ?? []).reduce((total, asset) => total + Number(asset.leads ?? 0), 0)
    && status.totals?.deals === (scores.assets ?? []).reduce((total, asset) => total + Number(asset.deals ?? 0), 0)
    && (status.asset_rows ?? []).length === (scores.assets ?? []).length
    && (status.attribution_rows ?? []).length === (funnelBreakdown.rows ?? []).length
    && status.sample_threshold_met === (ownerSampleGate.sample_threshold_met === true)
    && status.challenger_win_rule_met === (ownerSampleGate.challenger_win_rule_met === true)
    && status.promotion_performed === false
    && status.real_events_unchanged === true
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function candidateRetirementFixtureCheck(status = {}) {
  const requiredScenarioIds = [
    "sample_insufficient_keeps_testing",
    "winning_challenger_requires_owner_review",
    "underperforming_challenger_ready_for_local_retirement",
    "quality_regression_ready_for_local_retirement",
    "unknown_candidate_observed_only",
    "mixed_candidates_summary_counts",
  ];
  const scenarios = status.scenarios ?? [];
  return status.ok === true
    && status.mode === "candidate_retirement_fixture_dry_run"
    && status.scenario_count === requiredScenarioIds.length
    && requiredScenarioIds.every((id) => scenarios.some((scenario) => scenario.id === id && scenario.ok === true))
    && scenarios.some((scenario) => scenario.target_item?.status === "keep_testing_sample_insufficient" && scenario.target_item?.retirement_ready === false)
    && scenarios.some((scenario) => scenario.target_item?.status === "promotion_review_required" && scenario.target_item?.retirement_ready === false)
    && scenarios.some((scenario) => scenario.target_item?.status === "retire_local_candidate_due_underperformance" && scenario.target_item?.retirement_ready === true)
    && scenarios.some((scenario) => scenario.target_item?.status === "retire_local_candidate_due_quality_regression" && scenario.target_item?.retirement_ready === true)
    && scenarios.some((scenario) => scenario.target_item?.status === "observed_only_no_rotation_action" && scenario.target_item?.retirement_ready === false)
    && status.current_queue_safety?.ok === true
    && status.real_events_unchanged === true
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && status.champion_promotion_performed === false;
}

function iterationHistoryCheck(history = {}, nextRound = {}) {
  return history.ok === true
    && history.mode === "iteration_history_local_only"
    && history.cadence === "weekly_7_day_iteration"
    && ["collect_more_data", "sample_ready_owner_review_required"].includes(history.status)
    && history.iteration_policy?.one_variable_only === true
    && sameList(history.iteration_policy?.allowed_variables, ["hook", "offer", "visual_claim", "cta_text"])
    && history.current_round?.changed_variable === nextRound.current_round?.changed_variable
    && history.sample_gate?.sample_threshold_met === nextRound.sample_gate?.sample_threshold_met
    && Array.isArray(history.north_star_per_100_clicks)
    && history.north_star_per_100_clicks.length >= 2
    && Number.isInteger(history.archive_summary?.archives_scanned)
    && Array.isArray(history.archive_summary?.latest_archives)
    && Array.isArray(history.next_safe_actions)
    && history.next_safe_actions.length > 0
    && history.next_safe_actions.every((item) => item.external_effect === false)
    && history.red_line_summary?.violations?.length === 0
    && history.external_effect === false
    && history.public_link_change_performed === false
    && history.production_deploy_performed === false
    && history.github_push_or_pr_performed === false
    && history.formal_post_performed === false
    && history.line_push_performed === false
    && history.customer_data_mutation_performed === false
    && history.payment_action_performed === false
    && history.delete_action_performed === false;
}

function contentVariantTrackingCheck(trackingLinks, variants, breakdown) {
  const drafts = variants.drafts ?? [];
  const contentLinks = trackingLinks.links?.filter((link) => link.role === "content_variant") ?? [];
  const urls = new Set(contentLinks.map((link) => link.tracking_url));
  const rowKeys = new Set((breakdown.rows ?? [])
    .filter((row) => row.role === "content_variant")
    .map((row) => `${row.content_id}:${row.variant_id}`));

  return breakdown.mode === "content_variant_attribution"
    && breakdown.external_effect === false
    && breakdown.public_link_change_performed === false
    && breakdown.formal_post_performed === false
    && contentLinks.length === drafts.length
    && urls.size === contentLinks.length
    && drafts.every((draft) => {
      const link = contentLinks.find((item) => item.content_id === draft.content_id && item.variant_id === draft.variant_id);
      return Boolean(link)
        && link.external_effect === false
        && link.status === "draft_only_human_publish_required"
        && link.tracking_url.includes(`content_id=${encodeURIComponent(draft.content_id)}`)
        && link.tracking_url.includes(`variant_id=${encodeURIComponent(draft.variant_id)}`)
        && draft.tracking_url === link.tracking_url
        && rowKeys.has(`${draft.content_id}:${draft.variant_id}`);
    });
}

function approvalFixtureCheck(status) {
  const required = [
    "no_input_keeps_all_gates_blocked",
    "copied_example_placeholders_block_ready_state",
    "valid_github_gate_becomes_plan_only_ready",
    "sensitive_approval_value_blocks_gate",
    "public_ab_requires_absolute_champion_url",
    "manual_only_gate_never_becomes_automated",
    "invalid_d1_metadata_blocks_remote_gate",
    "invalid_worker_url_blocks_deploy_gate",
    "invalid_github_metadata_blocks_pr_gate",
    "invalid_approval_timestamp_blocks_gate",
  ];
  return status.ok === true
    && status.mode === "approval_resume_fixture_dry_run"
    && status.execution_performed === false
    && status.external_effect === false
    && status.remote_d1_create_performed === false
    && status.remote_d1_migration_performed === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && required.every((id) => status.scenarios?.some((scenario) => scenario.id === id && scenario.ok === true));
}

function ownerApprovalFormCheck(status = {}) {
  return status.ok === true
    && status.mode === "owner_approval_form"
    && ["ready_local_owner_approval_form", "owner_approval_input_detected_review_before_overwrite"].includes(status.status)
    && status.form_gate_count === 4
    && Number(status.excluded_manual_gate_count ?? 0) >= 1
    && status.download_filename === "owner_approval_input.json"
    && status.review_download_filename === "owner_approval_form.review.json"
    && status.browser_only === true
    && status.browser_persistence === false
    && status.form_action === "none"
    && status.network_calls_performed === false
    && status.live_input_files_created === false
    && status.approval_input_write_performed === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.public_link_change_performed === false
    && status.production_deploy_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function ownerApprovalFormFixtureCheck(status = {}) {
  const required = [
    "form_static_contract",
    "form_export_valid_github_plan_only",
    "form_export_placeholder_blocked",
    "form_export_sensitive_value_blocked",
  ];
  const scenarios = status.scenarios ?? [];
  return status.ok === true
    && status.mode === "owner_approval_form_fixture_dry_run"
    && status.scenario_count === required.length
    && status.form_export_replay_executed === true
    && status.approval_resume_commands_executed === true
    && status.live_input_files_created === false
    && status.approval_input_write_performed === false
    && status.execution_performed === false
    && status.external_effect === false
    && status.public_link_change_performed === false
    && status.production_deploy_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && (status.contract_checks ?? []).every((item) => item.ok === true)
    && required.every((id) => scenarios.some((scenario) => scenario.id === id && scenario.ok === true))
    && scenarios.some((scenario) => scenario.id === "form_export_valid_github_plan_only" && scenario.ready_gate_count === 1 && scenario.github_push_or_pr_performed === false)
    && scenarios.some((scenario) => scenario.id === "form_export_placeholder_blocked" && scenario.ready_gate_count === 0)
    && scenarios.some((scenario) => scenario.id === "form_export_sensitive_value_blocked" && scenario.ready_gate_count === 0 && scenario.sensitive_approval_detected === true);
}

function ownerEvidenceCheck(status = {}) {
  const expectedGates = [
    "remote_d1_create_and_migrate",
    "candidate_worker_production_deploy",
    "public_ab_small_traffic_link",
    "github_repo_branch_pr",
    "formal_posts_line_push_payment_customer_data",
  ];
  return status.ok === true
    && status.mode === "owner_gate_evidence_intake"
    && ["waiting_for_owner_evidence", "partial_owner_evidence_validated", "owner_evidence_validated_ready_for_post_gate_verification", "owner_evidence_detected_no_gate_ready"].includes(status.status)
    && status.evidence_only === true
    && status.execution_performed === false
    && status.external_effect === false
    && status.remote_d1_create_performed === false
    && status.remote_d1_migration_performed === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && status.sensitive_evidence_detected === false
    && Number.isInteger(status.issue_count)
    && status.issue_count === 0
    && Array.isArray(status.gates)
    && expectedGates.every((gateId) => status.gates.some((gate) => gate.gate_id === gateId))
    && status.gates.every((gate) => gate.evidence_intake_external_effect === false && gate.executed_by_this_script === false);
}

function ownerEvidenceFixtureCheck(status = {}) {
  const required = [
    "no_input_waits_for_owner_evidence",
    "copied_example_placeholders_block_evidence",
    "valid_remote_d1_evidence_enables_post_gate_plan",
    "remote_d1_without_recurring_read_approval_keeps_schema_evidence_valid",
    "valid_all_non_manual_evidence_ready_for_post_gate_verification",
    "sensitive_or_customer_evidence_blocks_gate",
    "invalid_public_ab_evidence_blocks_route",
    "duplicate_and_unknown_gate_evidence_blocks_input",
    "manual_only_acknowledgement_never_opens_post_gate",
    "invalid_github_evidence_blocks_review",
  ];
  return status.ok === true
    && status.mode === "owner_gate_evidence_fixture_dry_run"
    && status.scenario_count === required.length
    && status.local_fixture_commands_executed === true
    && status.owner_gate_evidence_fixture_executed === true
    && status.execution_performed === false
    && status.external_effect === false
    && status.remote_d1_create_performed === false
    && status.remote_d1_migration_performed === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && required.every((id) => status.scenarios?.some((scenario) => scenario.id === id && scenario.ok === true && scenario.execution_performed === false && scenario.external_effect === false));
}

function postGateVerificationCheck(status = {}) {
  const expectedGates = [
    "remote_d1_create_and_migrate",
    "candidate_worker_production_deploy",
    "public_ab_small_traffic_link",
    "github_repo_branch_pr",
    "formal_posts_line_push_payment_customer_data",
  ];
  return status.ok === true
    && status.mode === "post_gate_verification_plan"
    && ["waiting_for_owner_evidence", "owner_evidence_detected_no_post_gate_verification_ready", "partial_post_gate_verification_plan_ready", "post_gate_verification_plan_ready"].includes(status.status)
    && status.no_network_read_performed === true
    && status.no_remote_cli_performed === true
    && status.no_actual_evidence_values_persisted === true
    && status.execution_performed === false
    && status.external_effect === false
    && status.remote_d1_create_performed === false
    && status.remote_d1_migration_performed === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && Array.isArray(status.gates)
    && expectedGates.every((gateId) => status.gates.some((gate) => gate.gate_id === gateId))
    && status.gates.every((gate) => gate.safe_to_run_automatically === false && gate.external_effect === false && gate.execution_performed === false);
}

function postGateVerificationFixtureCheck(status = {}) {
  const required = [
    "waiting_for_owner_evidence_stays_plan_only",
    "remote_d1_evidence_ready_only",
    "remote_d1_without_recurring_read_approval_allows_schema_plan_only",
    "worker_evidence_requires_remote_d1_ready",
    "public_ab_requires_worker_evidence_ready",
    "github_evidence_ready_plan_only",
    "all_non_manual_evidence_ready_plan_only",
    "manual_only_acknowledgement_never_opens_post_gate",
    "invalid_owner_evidence_blocks_post_verify",
  ];
  return status.ok === true
    && status.mode === "post_gate_verification_fixture_dry_run"
    && status.scenario_count === required.length
    && status.local_fixture_commands_executed === true
    && status.owner_gate_evidence_fixture_executed === true
    && status.post_gate_verification_fixture_executed === true
    && status.execution_performed === false
    && status.external_effect === false
    && status.remote_d1_create_performed === false
    && status.remote_d1_migration_performed === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && required.every((id) => status.scenarios?.some((scenario) =>
      scenario.id === id &&
      scenario.ok === true &&
      scenario.no_network_read_performed === true &&
      scenario.no_remote_cli_performed === true &&
      scenario.execution_performed === false &&
      scenario.external_effect === false
    ));
}

function githubExportCheck(status = {}) {
  return status.ok === true
    && status.mode === "github_export_bundle_local_only"
    && Number.isInteger(status.file_count)
    && status.file_count > 20
    && typeof status.repo_dir === "string"
    && status.repo_dir.includes("github_export")
    && typeof status.manifest_path === "string"
    && status.manifest_path.includes("github_export")
    && Array.isArray(status.missing_files)
    && status.missing_files.length === 0
    && Array.isArray(status.excluded_live_or_owner_inputs)
    && status.excluded_live_or_owner_inputs.includes("data/lp_events.jsonl")
    && status.excluded_live_or_owner_inputs.includes("owner_approval_input.json")
    && status.excluded_live_or_owner_inputs.includes("owner_gate_evidence.json")
    && status.external_effect === false
    && status.git_init_performed === false
    && status.git_add_performed === false
    && status.git_commit_performed === false
    && status.git_remote_add_performed === false
    && status.git_push_or_pr_performed === false
    && status.github_push_or_pr_performed === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function artifactRetentionCheck(status = {}) {
  const sectionIds = new Set((status.sections ?? []).map((section) => section.id));
  return status.ok === true
    && status.mode === "artifact_retention_monitor_local_only"
    && ["owner_cleanup_review_recommended", "within_review_budget"].includes(status.status)
    && typeof status.total_human === "string"
    && Number.isInteger(status.warning_count)
    && Number.isInteger(status.cleanup_candidate_count)
    && sectionIds.has("github_export_bundles")
    && sectionIds.has("archive_snapshots")
    && sectionIds.has("logs")
    && Array.isArray(status.blocked_actions)
    && status.blocked_actions.includes("delete_github_export_bundles")
    && status.blocked_actions.includes("delete_weekly_archives")
    && status.blocked_actions.includes("delete_logs")
    && status.cleanup_command_generated === false
    && status.cleanup_command_executed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && (status.sections ?? []).every((section) => section.delete_action_performed === false && section.external_effect === false);
}

function artifactRetentionReviewCheck(status = {}, retention = {}) {
  return status.ok === true
    && status.mode === "artifact_retention_review_pack_local_only"
    && ["owner_review_recommended", "within_review_budget"].includes(status.status)
    && status.source_status_path === "data/artifact_retention_status.json"
    && status.section_count === (retention.sections ?? []).length
    && status.warning_count === retention.warning_count
    && status.cleanup_candidate_count === retention.cleanup_candidate_count
    && status.review_required === ((retention.warning_count ?? 0) > 0 || (retention.cleanup_candidate_count ?? 0) > 0)
    && status.cleanup_execution_policy === "owner_only_manual_after_review"
    && status.cleanup_command_generated === false
    && status.cleanup_command_executed === false
    && status.filesystem_mutation_performed === false
    && status.live_data_touched === false
    && status.external_effect === false
    && status.public_link_change_performed === false
    && status.production_deploy_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function githubActionsWorkflowCheck(source = "") {
  return source.includes("name: 3Q Growth Loop Weekly Verification")
    && source.includes("workflow_dispatch:")
    && source.includes('cron: "10 16 * * 6"')
    && source.includes("permissions:")
    && source.includes("contents: read")
    && source.includes("npm ci")
    && source.includes("npm run verify")
    && source.includes("actions/upload-artifact@v4")
    && !/\bwrangler\s+deploy\b/.test(source)
    && !/npm run worker:deploy/.test(source)
    && !/\bgit\s+(push|commit|tag|remote\s+add)\b/.test(source)
    && !/gh pr create/.test(source)
    && !/LINE_CHANNEL|ECPAY|SECRET|TOKEN|PASSWORD/i.test(source);
}

function scheduleCatchupCheck(status = {}) {
  return status.ok === true
    && status.mode === "weekly_schedule_catchup_monitor"
    && status.schedule?.cadence === "weekly_sunday"
    && status.schedule?.weekday === "Sunday"
    && status.schedule?.timezone === "Asia/Taipei"
    && typeof status.latest_expected_run?.utc === "string"
    && typeof status.next_expected_run?.utc === "string"
    && typeof status.next_safe_action === "string"
    && status.next_safe_action.length > 0
    && status.weekly_runner_invoked === false
    && status.catchup_run_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function redlinePriorityCheck(status = {}, blocked = {}) {
  const blockedActions = new Set((blocked.items ?? []).map((item) => item.action));
  const uncovered = status.uncovered_blocked_actions ?? [];
  return status.ok === true
    && status.mode === "redline_priority_local_only"
    && status.redline_queue_covered === true
    && uncovered.length === 0
    && status.action_count >= blockedActions.size
    && typeof status.next_operator_action === "string"
    && status.next_operator_action.length > 0
    && status.no_autorun_for_external_gates === true
    && status.gates_execute_in_order === true
    && status.owner_decision_required === true
    && status.execution_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

function redLineFlagsFalse(objects) {
  return collectRedLineFlags(objects).every((item) => item.value === false || item.value === undefined);
}

function collectRedLineFlags(objects) {
  return objects.flatMap((object, objectIndex) => RED_LINE_FLAGS.map((flag) => ({
    source_index: objectIndex,
    flag,
    value: object?.[flag],
  })));
}

function per100Clicks(asset) {
  const clicks = Number(asset.link_clicks ?? 0);
  return {
    asset_id: asset.asset_id,
    role: asset.role,
    link_clicks: clicks,
    line_adds_per_100_clicks: clicks > 0 ? round((asset.line_adds / clicks) * 100) : null,
    leads_per_100_clicks: clicks > 0 ? round((asset.leads / clicks) * 100) : null,
    deals_per_100_clicks: clicks > 0 ? round((asset.deals / clicks) * 100) : null,
    sample_threshold_met: asset.sample_threshold_met,
    decision: asset.decision,
  };
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

async function fileStatus(files) {
  return Promise.all(files.map(async (file) => {
    try {
      await access(path.join(ROOT, file));
      return { file, present: true };
    } catch {
      return { file, present: false };
    }
  }));
}

function sameList(left = [], right = []) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

async function readJson(relativePath) {
  const raw = await readFile(path.join(ROOT, relativePath), "utf8");
  return JSON.parse(raw);
}

async function readOptionalJson(relativePath) {
  try {
    return await readJson(relativePath);
  } catch {
    return null;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function renderMarkdown(audit) {
  const checkRows = audit.checks
    .map((item) => `| ${item.id} | ${item.ok ? "ok" : "fail"} | ${item.evidence} |`)
    .join("\n");
  const outputRows = audit.output_status
    .map((item) => `| ${item.file} | ${item.present ? "present" : "missing"} |`)
    .join("\n");
  const metricRows = audit.north_star_per_100_clicks
    .map((item) => `| ${item.asset_id} | ${item.role} | ${item.link_clicks} | ${item.line_adds_per_100_clicks ?? "n/a"} | ${item.leads_per_100_clicks ?? "n/a"} | ${item.deals_per_100_clicks ?? "n/a"} | ${item.decision} |`)
    .join("\n");
  const rotationRows = (audit.variable_rotation_fixtures.scenarios ?? [])
    .map((item) => `| ${item.changed_variable} | ${item.ok ? "ok" : "fail"} | ${item.draft_count} | ${item.changed_value_count} | ${item.locked_variables_ok ? "yes" : "no"} | ${item.changed_only_ok ? "yes" : "no"} |`)
    .join("\n");

  return `# 3Q Growth Loop Objective Sequence Audit

BLUF: ${audit.ok ? "objective_contract_ok" : "objective_contract_failed"}。This local audit checks the user's original weekly sequence, one-variable rule, sample gate, win rule, outputs, approval queue, and hard red lines. It performs no external action.

Generated: ${audit.generated_at}
Status: ${audit.status}
External effect: no

## Requested Weekly Sequence

${audit.objective_sequence.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## North Star Per 100 Clicks

| asset | role | clicks | LINE adds / 100 | leads / 100 | deals / 100 | decision |
|---|---:|---:|---:|---:|---:|---|
${metricRows}

## North Star Funnel Contract

- Status: ${audit.north_star_funnel.ok ? "ok" : "fail"}
- Mode: ${audit.north_star_funnel.mode ?? "n/a"}
- Path: ${(audit.north_star_funnel.path ?? []).join(" -> ") || "n/a"}
- Primary metric: ${audit.north_star_funnel.primary_metric ?? "n/a"}
- Link clicks: ${audit.north_star_funnel.link_clicks ?? 0}
- LINE adds: ${audit.north_star_funnel.line_adds ?? 0}
- Leads: ${audit.north_star_funnel.leads ?? 0}
- Deals: ${audit.north_star_funnel.deals ?? 0}
- LINE adds / 100 clicks: ${audit.north_star_funnel.line_adds_per_100_clicks ?? "n/a"}
- Leads / 100 clicks: ${audit.north_star_funnel.leads_per_100_clicks ?? "n/a"}
- Deals / 100 clicks: ${audit.north_star_funnel.deals_per_100_clicks ?? "n/a"}
- Sample threshold met: ${audit.north_star_funnel.sample_threshold_met ? "yes" : "no"}
- Challenger final win rule met: ${audit.north_star_funnel.challenger_win_rule_met ? "yes" : "no"}
- Promotion performed: ${audit.north_star_funnel.promotion_performed ? "yes" : "no"}
- Real events unchanged: ${audit.north_star_funnel.real_events_unchanged ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.north_star_funnel.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.north_star_funnel.external_effect ? "yes" : "no"}

## Funnel Attribution Contract

- Status: ${audit.funnel_breakdown.ok ? "ok" : "fail"}
- Mode: ${audit.funnel_breakdown.mode ?? "n/a"}
- Rows: ${audit.funnel_breakdown.rows ?? 0}
- Content variant links: ${audit.funnel_breakdown.content_variant_links ?? 0}
- Real events: ${audit.funnel_breakdown.real_events ?? 0}
- External effect: ${audit.funnel_breakdown.external_effect ? "yes" : "no"}
- Public link change performed: ${audit.funnel_breakdown.public_link_change_performed ? "yes" : "no"}
- Formal post performed: ${audit.funnel_breakdown.formal_post_performed ? "yes" : "no"}

## Variable Rotation Fixtures

- Status: ${audit.variable_rotation_fixtures.ok ? "ok" : "fail"}
- Mode: ${audit.variable_rotation_fixtures.mode ?? "n/a"}
- Scenarios: ${audit.variable_rotation_fixtures.scenario_count ?? 0}
- Candidate templates: ${audit.variable_rotation_fixtures.candidate_template_count ?? 0}
- Live config write performed: ${audit.variable_rotation_fixtures.live_config_write_performed ? "yes" : "no"}
- External effect: ${audit.variable_rotation_fixtures.external_effect ? "yes" : "no"}

| variable | status | drafts | changed values | locked variables ok | changed only ok |
|---|---|---:|---:|---|---|
${rotationRows}

## Contract Checks

| check | status | evidence |
|---|---|---|
${checkRows}

## Candidate Worker Dry Run

- Status: ${audit.worker_dry_run.ok ? "ok" : "not_ready"}
- Mode: ${audit.worker_dry_run.mode ?? "n/a"}
- Command: ${audit.worker_dry_run.command ?? "n/a"}
- Exit code: ${audit.worker_dry_run.exit_code ?? "n/a"}
- Dry-run exit observed: ${audit.worker_dry_run.dry_run_exit_observed ? "yes" : "no"}
- Required markers present: ${audit.worker_dry_run.required_markers_present ? "yes" : "no"}
- Production deploy performed: ${audit.worker_dry_run.production_deploy_performed ? "yes" : "no"}
- External effect: ${audit.worker_dry_run.external_effect ? "yes" : "no"}
- Report: ${audit.worker_dry_run.report_path ?? "worker_dry_run.md"}
- Log: ${audit.worker_dry_run.log_path ?? "n/a"}

## Cloudflare D1 Readiness

- Status: ${audit.cloudflare_d1_readiness.status ?? "n/a"}
- Inventory checked: ${audit.cloudflare_d1_readiness.inventory_checked_at ?? "n/a"}
- Total databases observed: ${audit.cloudflare_d1_readiness.total_database_count ?? 0}
- Exact dedicated matches: ${audit.cloudflare_d1_readiness.exact_match_count ?? 0}
- Dedicated database present: ${audit.cloudflare_d1_readiness.dedicated_database_present ? "yes" : "no"}
- Config placeholder ID: ${audit.cloudflare_d1_readiness.configured_id_is_placeholder ? "yes" : "no"}
- Remote table query performed: ${audit.cloudflare_d1_readiness.remote_table_query_performed ? "yes" : "no"}
- Customer data read performed: ${audit.cloudflare_d1_readiness.customer_data_read_performed ? "yes" : "no"}
- Resource create performed: ${audit.cloudflare_d1_readiness.resource_create_performed ? "yes" : "no"}

## Live Telemetry Readiness

- Status: ${audit.live_telemetry_readiness.status ?? "n/a"}
- Snapshot checked: ${audit.live_telemetry_readiness.snapshot_checked_at ?? "n/a"}
- Candidate deployment observed: ${audit.live_telemetry_readiness.candidate_deployment_observed ? "yes" : "no"}
- Candidate deployment / version: ${audit.live_telemetry_readiness.candidate_deployment_id ?? "n/a"} / ${audit.live_telemetry_readiness.candidate_version_id ?? "n/a"}
- Candidate operation: ${audit.live_telemetry_readiness.candidate_operation_mode ?? "n/a"}
- Candidate deploy required: ${audit.live_telemetry_readiness.candidate_deploy_required ? "yes" : "no"}
- Champion collector origin matches: ${audit.live_telemetry_readiness.champion_collector_origin_matches ? "yes" : "no"}
- Privacy event contract: ${audit.live_telemetry_readiness.privacy_event_contract_ok ? "ok" : "not_ready"}
- D1 inventory-reported num_tables: ${audit.live_telemetry_readiness.inventory_reported_num_tables ?? "n/a"} (not authoritative)
- Schema absence inferred from inventory: ${audit.live_telemetry_readiness.schema_absence_inferred_from_inventory ? "yes" : "no"}
- Schema evidence valid: ${audit.live_telemetry_readiness.schema_evidence_valid ? "yes" : "no"}
- Recurring aggregate read approved: ${audit.live_telemetry_readiness.recurring_aggregate_read_approved ? "yes" : "no"}
- Live ingest readiness proven: ${audit.live_telemetry_readiness.live_ingest_readiness_proven ? "yes" : "no"}
- Weekly aggregate read authorized: ${audit.live_telemetry_readiness.weekly_aggregate_read_authorized ? "yes" : "no"}
- Fixture scenarios: ${audit.live_telemetry_readiness_fixtures.scenario_count ?? 0}
- Fixture live network refresh: ${audit.live_telemetry_readiness_fixtures.live_network_refresh_performed ? "yes" : "no"}
- Remote table query performed: ${audit.live_telemetry_readiness.remote_table_query_performed ? "yes" : "no"}
- Event POST performed: ${audit.live_telemetry_readiness.event_post_performed ? "yes" : "no"}
- External effect: ${audit.live_telemetry_readiness.external_effect ? "yes" : "no"}

## D1 Automatic Collection Gate

- Status: ${audit.d1_collection_mode.status ?? "n/a"}
- Selected scope: ${audit.d1_collection_mode.selected_scope ?? "n/a"}
- Remote read authorized: ${audit.d1_collection_mode.remote_read_authorized ? "yes" : "no"}
- Recurring aggregate read approved: ${audit.d1_collection_mode.recurring_aggregate_read_approved ? "yes" : "no"}
- Collection executed: ${audit.d1_collection_mode.collection_execution_performed ? "yes" : "no"}
- Remote read performed: ${audit.d1_collection_mode.remote_read_performed ? "yes" : "no"}
- Raw event rows read: ${audit.d1_collection_mode.raw_event_rows_read_performed ? "yes" : "no"}
- Customer data read: ${audit.d1_collection_mode.customer_data_read_performed ? "yes" : "no"}
- Selector fixture scenarios: ${audit.d1_collection_mode_fixtures.scenario_count ?? 0}
- Approved aggregate plan covered: ${audit.d1_collection_mode_fixtures.approved_remote_plan_covered ? "yes" : "no"}
- Aggregate exporter fixture scenarios: ${audit.d1_aggregate_export_fixtures.scenario_count ?? 0}
- Grouped SQL covered: ${audit.d1_aggregate_export_fixtures.aggregate_sql_covered ? "yes" : "no"}
- Real remote CLI performed by fixtures: ${audit.d1_aggregate_export_fixtures.real_remote_cli_performed ? "yes" : "no"}

## Champion Local Feature Commit

- Status: ${audit.champion_local_branch.status ?? "n/a"}
- Branch: ${audit.champion_local_branch.branch ?? "n/a"}
- Commit: ${audit.champion_local_branch.commit ?? "n/a"}
- Parent: ${audit.champion_local_branch.parent_commit ?? "n/a"}
- Changed paths: ${(audit.champion_local_branch.changed_paths ?? []).join(", ") || "n/a"}
- Remote branch present: ${audit.champion_local_branch.remote_branch_present ? "yes" : "no"}
- Git push performed: ${audit.champion_local_branch.git_push_performed ? "yes" : "no"}
- GitHub push / PR performed: ${audit.champion_local_branch.github_push_or_pr_performed ? "yes" : "no"}

## Champion Release Preflight

- Status: ${audit.champion_release_preflight.ok ? "ok" : "not_ready"}
- Mode: ${audit.champion_release_preflight.mode ?? "n/a"}
- Source mode: ${audit.champion_release_preflight.source_mode ?? "n/a"}
- Source repository unchanged: ${audit.champion_release_preflight.source_repository_unchanged ? "yes" : "no"}
- Patch byte-identical: ${audit.champion_release_preflight.patch_byte_identical ? "yes" : "no"}
- Wrangler dry-run: ${audit.champion_release_preflight.wrangler_dry_run_ok ? "pass" : "fail"}
- Production CLI template dry-run: ${audit.champion_release_preflight.production_command_template_dry_run_ok ? "pass" : "fail"}
- Live snapshot checked: ${audit.champion_release_preflight.live_snapshot_checked_at ?? "n/a"}
- Live version: ${audit.champion_release_preflight.live_version_id ?? "n/a"}
- Live false-success state present: ${audit.champion_release_preflight.live_false_success_state_present ? "yes" : "no"}
- Rollback target: ${audit.champion_release_preflight.rollback_target_version_id ?? "n/a"}
- Owner gates: ${audit.champion_release_preflight.owner_gate_count ?? 0}
- Local branch commit: ${audit.champion_release_preflight.local_branch_commit ?? "n/a"}
- Collector readiness: ${audit.champion_release_preflight.collector_readiness_status ?? "n/a"}
- Source repo write performed: ${audit.champion_release_preflight.source_repo_write_performed ? "yes" : "no"}
- Production deploy performed: ${audit.champion_release_preflight.production_deploy_performed ? "yes" : "no"}
- External effect: ${audit.champion_release_preflight.external_effect ? "yes" : "no"}

## Tracking Link Smoke

- Status: ${audit.tracking_link_smoke.ok ? "ok" : "not_ready"}
- Mode: ${audit.tracking_link_smoke.mode ?? "n/a"}
- Links checked: ${audit.tracking_link_smoke.links_checked ?? 0}/${audit.tracking_link_smoke.expected_link_count ?? 0}
- Isolated link_click events written: ${audit.tracking_link_smoke.isolated_link_click_events_written ?? 0}
- Checks passed: ${audit.tracking_link_smoke.checks_passed ?? 0}
- Real event write performed: ${audit.tracking_link_smoke.real_event_write_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.tracking_link_smoke.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.tracking_link_smoke.external_effect ? "yes" : "no"}

## Event Contract Smoke

- Status: ${audit.event_contract_smoke.ok ? "ok" : "not_ready"}
- Mode: ${audit.event_contract_smoke.mode ?? "n/a"}
- Synthetic event counts: ${JSON.stringify(audit.event_contract_smoke.event_type_counts ?? {})}
- Sensitive metadata rejected: ${audit.event_contract_smoke.sensitive_rejection_ok ? "yes" : "no"}
- Invalid event rejected: ${audit.event_contract_smoke.invalid_event_rejection_ok ? "yes" : "no"}
- Redirect attribution preserved: ${audit.event_contract_smoke.redirect_attribution_ok ? "yes" : "no"}
- A/B redirect attribution preserved: ${audit.event_contract_smoke.ab_redirect_attribution_ok ? "yes" : "no"}
- Scheduled quality regression rejected: ${audit.event_contract_smoke.scheduled_quality_regression_ok ? "yes" : "no"}
- Scheduled quality regression decision: ${audit.event_contract_smoke.scheduled_quality_regression_decision ?? "n/a"}
- Real event write performed: ${audit.event_contract_smoke.real_event_write_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.event_contract_smoke.data_lp_events_write_performed ? "yes" : "no"}

## Event Input Quality Gate

- Status: ${audit.event_input_quality_gate.ok ? "ok" : "blocked"}
- Mode: ${audit.event_input_quality_gate.mode ?? "n/a"}
- Rows scanned: ${audit.event_input_quality_gate.rows_scanned ?? 0}
- Issues: ${audit.event_input_quality_gate.issue_count ?? 0}
- Scoring allowed: ${audit.event_input_quality_gate.scoring_allowed ? "yes" : "no"}
- Sensitive data detected: ${audit.event_input_quality_gate.pii_or_sensitive_data_detected ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.event_input_quality_gate.data_lp_events_write_performed ? "yes" : "no"}

## Full Funnel Aggregate Preview

- Status: ${audit.funnel_aggregate_preview.ok ? "ok" : "not_ready"}
- Mode: ${audit.funnel_aggregate_preview.mode ?? "n/a"}
- Events written: ${audit.funnel_aggregate_preview.events_written ?? 0}
- Event counts: ${JSON.stringify(audit.funnel_aggregate_preview.counts_by_event_type ?? {})}
- Sensitive columns: ${audit.funnel_aggregate_preview.contains_sensitive_columns ? "yes" : "no"}
- Sensitive values: ${audit.funnel_aggregate_preview.contains_sensitive_values ? "yes" : "no"}
- Apply performed: ${audit.funnel_aggregate_preview.apply_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.funnel_aggregate_preview.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.funnel_aggregate_preview.external_effect ? "yes" : "no"}

## Full Funnel Aggregate Fixtures

- Status: ${audit.funnel_aggregate_fixtures.ok ? "ok" : "not_ready"}
- Mode: ${audit.funnel_aggregate_fixtures.mode ?? "n/a"}
- Scenarios: ${audit.funnel_aggregate_fixtures.scenario_count ?? 0}
- Execution performed: ${audit.funnel_aggregate_fixtures.execution_performed ? "yes" : "no"}
- Real event write performed: ${audit.funnel_aggregate_fixtures.real_event_write_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.funnel_aggregate_fixtures.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.funnel_aggregate_fixtures.external_effect ? "yes" : "no"}

## Real Data Apply Fixtures

- Status: ${audit.real_data_apply_fixtures.ok ? "ok" : "not_ready"}
- Mode: ${audit.real_data_apply_fixtures.mode ?? "n/a"}
- Scenarios: ${audit.real_data_apply_fixtures.scenario_count ?? 0}
- Execution performed: ${audit.real_data_apply_fixtures.execution_performed ? "yes" : "no"}
- Real event write performed: ${audit.real_data_apply_fixtures.real_event_write_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.real_data_apply_fixtures.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.real_data_apply_fixtures.external_effect ? "yes" : "no"}

## Real Data Decision Replay

- Status: ${audit.real_data_decision_replay.ok ? "ok" : "not_ready"}
- Mode: ${audit.real_data_decision_replay.mode ?? "n/a"}
- Scenarios: ${audit.real_data_decision_replay.scenario_count ?? 0}
- Source capture ledger replay executed: ${audit.real_data_decision_replay.source_capture_ledger_replay_executed ? "yes" : "no"}
- Source capture compile commands executed: ${audit.real_data_decision_replay.source_capture_compile_commands_executed ? "yes" : "no"}
- Ledger-to-decision replay performed: ${audit.real_data_decision_replay.ledger_to_decision_replay_performed ? "yes" : "no"}
- Local importer preview commands executed: ${audit.real_data_decision_replay.local_importer_preview_commands_executed ? "yes" : "no"}
- Execution performed: ${audit.real_data_decision_replay.execution_performed ? "yes" : "no"}
- Real event write performed: ${audit.real_data_decision_replay.real_event_write_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.real_data_decision_replay.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.real_data_decision_replay.external_effect ? "yes" : "no"}

## Sample Gate Replay Fixtures

- Status: ${audit.sample_gate_replay_fixtures.ok ? "ok" : "not_ready"}
- Mode: ${audit.sample_gate_replay_fixtures.mode ?? "n/a"}
- Template rows: ${audit.sample_gate_replay_fixtures.template_rows ?? 0}
- Scenarios: ${audit.sample_gate_replay_fixtures.scenario_count ?? 0}
- Sample-gate ledger replay executed: ${audit.sample_gate_replay_fixtures.sample_gate_ledger_replay_executed ? "yes" : "no"}
- Source capture compile commands executed: ${audit.sample_gate_replay_fixtures.source_capture_compile_commands_executed ? "yes" : "no"}
- Importer preview commands executed: ${audit.sample_gate_replay_fixtures.importer_preview_commands_executed ? "yes" : "no"}
- Execution performed: ${audit.sample_gate_replay_fixtures.execution_performed ? "yes" : "no"}
- Real event write performed: ${audit.sample_gate_replay_fixtures.real_event_write_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.sample_gate_replay_fixtures.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.sample_gate_replay_fixtures.external_effect ? "yes" : "no"}

## Real Data Input Pack

- Status: ${audit.real_data_input_pack.ok ? "ok" : "not_ready"}
- Mode: ${audit.real_data_input_pack.mode ?? "n/a"}
- Pack status: ${audit.real_data_input_pack.status ?? "n/a"}
- Template only: ${audit.real_data_input_pack.template_only ? "yes" : "no"}
- Templates: ${audit.real_data_input_pack.template_count ?? 0}
- Live input files created: ${audit.real_data_input_pack.live_input_files_created ? "yes" : "no"}
- Real events unchanged: ${audit.real_data_input_pack.real_events_unchanged ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.real_data_input_pack.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.real_data_input_pack.external_effect ? "yes" : "no"}

## Source Readiness

- Status: ${audit.source_readiness.ok ? "ok" : "not_ready"}
- Mode: ${audit.source_readiness.mode ?? "n/a"}
- Readiness status: ${audit.source_readiness.status ?? "n/a"}
- Real event rows: ${audit.source_readiness.real_event_rows ?? 0}
- Missing stages: ${audit.source_readiness.missing_stage_count ?? 0}
- Sample threshold met: ${audit.source_readiness.sample_threshold_met ? "yes" : "no"}
- Ready for public iteration decision: ${audit.source_readiness.ready_for_public_iteration_decision ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.source_readiness.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.source_readiness.external_effect ? "yes" : "no"}

## Source Capture Pack

- Status: ${audit.source_capture_pack.ok ? "ok" : "not_ready"}
- Mode: ${audit.source_capture_pack.mode ?? "n/a"}
- Capture status: ${audit.source_capture_pack.status ?? "n/a"}
- Tracking links: ${audit.source_capture_pack.importable_tracking_links ?? 0}/${audit.source_capture_pack.tracking_links_total ?? 0}
- A/B router gates held out: ${audit.source_capture_pack.ab_router_gate_count ?? 0}
- Funnel stages: ${audit.source_capture_pack.stage_count ?? 0}
- Ledger rows: ${audit.source_capture_pack.ledger_rows ?? 0}
- Sample-gate ledger rows: ${audit.source_capture_pack.sample_gate_ledger_rows ?? 0}
- Template only: ${audit.source_capture_pack.template_only ? "yes" : "no"}
- Live input files created: ${audit.source_capture_pack.live_input_files_created ? "yes" : "no"}
- Real events unchanged: ${audit.source_capture_pack.real_events_unchanged ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.source_capture_pack.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.source_capture_pack.external_effect ? "yes" : "no"}

## Source Capture Compile Preview

- Status: ${audit.source_capture_compile.ok ? "ok" : "not_ready"}
- Mode: ${audit.source_capture_compile.mode ?? "n/a"}
- Compile status: ${audit.source_capture_compile.status ?? "n/a"}
- Input kind: ${audit.source_capture_compile.input_kind ?? "n/a"}
- Ledger rows read: ${audit.source_capture_compile.ledger_rows_read ?? 0}
- Filled rows: ${audit.source_capture_compile.filled_rows ?? 0}
- Funnel preview rows: ${audit.source_capture_compile.funnel_rows ?? 0}
- Manual preview rows: ${audit.source_capture_compile.manual_rows ?? 0}
- Issues: ${audit.source_capture_compile.issue_count ?? 0}
- Owner review required: ${audit.source_capture_compile.owner_review_required ? "yes" : "no"}
- Live input files created: ${audit.source_capture_compile.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.source_capture_compile.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.source_capture_compile.external_effect ? "yes" : "no"}

## Source Capture Compile Fixtures

- Status: ${audit.source_capture_compile_fixtures.ok ? "ok" : "not_ready"}
- Mode: ${audit.source_capture_compile_fixtures.mode ?? "n/a"}
- Scenarios: ${audit.source_capture_compile_fixtures.scenario_count ?? 0}
- Local fixture commands executed: ${audit.source_capture_compile_fixtures.local_fixture_commands_executed ? "yes" : "no"}
- Execution performed: ${audit.source_capture_compile_fixtures.execution_performed ? "yes" : "no"}
- Real event write performed: ${audit.source_capture_compile_fixtures.real_event_write_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.source_capture_compile_fixtures.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.source_capture_compile_fixtures.external_effect ? "yes" : "no"}

## Real Data Intake Plan

- Status: ${audit.real_data_intake_plan.ok ? "ok" : "not_ready"}
- Mode: ${audit.real_data_intake_plan.mode ?? "n/a"}
- Intake status: ${audit.real_data_intake_plan.status ?? "n/a"}
- Ready apply commands: ${audit.real_data_intake_plan.ready_apply_count ?? 0}
- Missing inputs: ${audit.real_data_intake_plan.missing_input_count ?? 0}
- Blocked inputs: ${audit.real_data_intake_plan.blocked_input_count ?? 0}
- Real events unchanged: ${audit.real_data_intake_plan.real_events_unchanged ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.real_data_intake_plan.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.real_data_intake_plan.external_effect ? "yes" : "no"}

## Data Collection Brief

- Status: ${audit.data_collection_brief.ok ? "ok" : "not_ready"}
- Mode: ${audit.data_collection_brief.mode ?? "n/a"}
- Brief status: ${audit.data_collection_brief.status ?? "n/a"}
- Tasks: ${audit.data_collection_brief.task_count ?? 0}
- Stage count: ${audit.data_collection_brief.stage_count ?? 0}
- Importable links: ${audit.data_collection_brief.importable_link_count ?? 0}
- Gated links: ${audit.data_collection_brief.gated_link_count ?? 0}
- Sample gate: ${audit.data_collection_brief.sample_gate_status ?? "n/a"} / p0_tasks=${audit.data_collection_brief.sample_gate_p0_task_count ?? 0} / p0_links=${audit.data_collection_brief.sample_gate_p0_link_count ?? 0}
- Filled ledger exists: ${audit.data_collection_brief.filled_ledger_exists ? "yes" : "no"}
- Sample threshold met: ${audit.data_collection_brief.sample_threshold_met ? "yes" : "no"}
- Missing stages: ${audit.data_collection_brief.missing_stage_count ?? 0}
- Real events unchanged: ${audit.data_collection_brief.real_events_unchanged ? "yes" : "no"}
- Live input files created: ${audit.data_collection_brief.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.data_collection_brief.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.data_collection_brief.external_effect ? "yes" : "no"}

## Data Collection Progress

- Status: ${audit.data_collection_progress.ok ? "ok" : "not_ready"}
- Mode: ${audit.data_collection_progress.mode ?? "n/a"}
- Progress status: ${audit.data_collection_progress.status ?? "n/a"}
- Tasks filled: ${audit.data_collection_progress.filled_task_count ?? 0}/${audit.data_collection_progress.total_task_count ?? 0}
- Pending tasks: ${audit.data_collection_progress.pending_task_count ?? 0}
- P0 pending: ${audit.data_collection_progress.p0_pending_count ?? 0}
- P1 pending: ${audit.data_collection_progress.p1_pending_count ?? 0}
- Next owner inputs: ${audit.data_collection_progress.next_owner_input_count ?? 0}
- Live input files created: ${audit.data_collection_progress.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.data_collection_progress.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.data_collection_progress.external_effect ? "yes" : "no"}

## Next P0 Owner Inputs

- Status: ${audit.next_p0_owner_inputs.ok ? "ok" : "not_ready"}
- Mode: ${audit.next_p0_owner_inputs.mode ?? "n/a"}
- Input status: ${audit.next_p0_owner_inputs.status ?? "n/a"}
- Current inputs: ${audit.next_p0_owner_inputs.current_input_count ?? 0}
- P0 pending: ${audit.next_p0_owner_inputs.p0_pending_count ?? 0}
- P1 pending: ${audit.next_p0_owner_inputs.p1_pending_count ?? 0}
- Source groups: ${audit.next_p0_owner_inputs.source_group_count ?? 0}
- Recommended open command: ${audit.next_p0_owner_inputs.recommended_open_command ?? "n/a"}
- Live input files created: ${audit.next_p0_owner_inputs.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.next_p0_owner_inputs.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.next_p0_owner_inputs.external_effect ? "yes" : "no"}

## Next P0 Owner Form

- Status: ${audit.next_p0_owner_form.ok ? "ok" : "not_ready"}
- Mode: ${audit.next_p0_owner_form.mode ?? "n/a"}
- Form status: ${audit.next_p0_owner_form.status ?? "n/a"}
- Rows: ${audit.next_p0_owner_form.row_count ?? 0}
- Source groups: ${audit.next_p0_owner_form.source_group_count ?? 0}
- Download filename: ${audit.next_p0_owner_form.download_filename ?? "n/a"}
- JSON download filename: ${audit.next_p0_owner_form.json_download_filename ?? "n/a"}
- Browser only: ${audit.next_p0_owner_form.browser_only ? "yes" : "no"}
- Browser persistence: ${audit.next_p0_owner_form.browser_persistence ? "yes" : "no"}
- Network calls performed: ${audit.next_p0_owner_form.network_calls_performed ? "yes" : "no"}
- Live input files created: ${audit.next_p0_owner_form.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.next_p0_owner_form.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.next_p0_owner_form.external_effect ? "yes" : "no"}

## Next P0 Owner Form Fixtures

- Status: ${audit.next_p0_owner_form_fixtures.ok ? "ok" : "not_ready"}
- Mode: ${audit.next_p0_owner_form_fixtures.mode ?? "n/a"}
- Rows: ${audit.next_p0_owner_form_fixtures.row_count ?? 0}/${audit.next_p0_owner_form_fixtures.expected_row_count ?? 0}
- Scenarios: ${audit.next_p0_owner_form_fixtures.scenario_count ?? 0}
- Static checks executed: ${audit.next_p0_owner_form_fixtures.browser_form_static_checks_executed ? "yes" : "no"}
- Export contract verified: ${audit.next_p0_owner_form_fixtures.export_contract_verified ? "yes" : "no"}
- Live input files created: ${audit.next_p0_owner_form_fixtures.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.next_p0_owner_form_fixtures.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.next_p0_owner_form_fixtures.external_effect ? "yes" : "no"}
- Scenario IDs: ${(audit.next_p0_owner_form_fixtures.scenarios ?? []).map((scenario) => scenario.id).join(", ") || "n/a"}

## Next P0 Owner Intake

- Status: ${audit.next_p0_owner_intake.ok ? "ok" : "not_ready"}
- Mode: ${audit.next_p0_owner_intake.mode ?? "n/a"}
- Intake status: ${audit.next_p0_owner_intake.status ?? "n/a"}
- Candidate found: ${audit.next_p0_owner_intake.candidate_found ? "yes" : "no"}
- Candidate valid: ${audit.next_p0_owner_intake.candidate_valid ? "yes" : "no"}
- Expected rows: ${audit.next_p0_owner_intake.expected_row_count ?? 0}
- Downloaded rows: ${audit.next_p0_owner_intake.downloaded_row_count ?? 0}
- Filled rows: ${audit.next_p0_owner_intake.filled_rows ?? 0}
- Funnel preview rows: ${audit.next_p0_owner_intake.funnel_preview_rows ?? 0}
- Manual preview rows: ${audit.next_p0_owner_intake.manual_preview_rows ?? 0}
- Stage performed: ${audit.next_p0_owner_intake.stage_performed ? "yes" : "no"}
- Live input files created: ${audit.next_p0_owner_intake.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.next_p0_owner_intake.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.next_p0_owner_intake.external_effect ? "yes" : "no"}

## Next P0 Owner Intake Fixtures

- Status: ${audit.next_p0_owner_intake_fixtures.ok ? "ok" : "not_ready"}
- Mode: ${audit.next_p0_owner_intake_fixtures.mode ?? "n/a"}
- Rows: ${audit.next_p0_owner_intake_fixtures.row_count ?? 0}
- Scenarios: ${audit.next_p0_owner_intake_fixtures.scenario_count ?? 0}
- Local fixture commands executed: ${audit.next_p0_owner_intake_fixtures.local_fixture_commands_executed ? "yes" : "no"}
- Live project inputs created: ${audit.next_p0_owner_intake_fixtures.live_project_inputs_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.next_p0_owner_intake_fixtures.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.next_p0_owner_intake_fixtures.external_effect ? "yes" : "no"}
- Scenario IDs: ${(audit.next_p0_owner_intake_fixtures.scenarios ?? []).map((scenario) => scenario.id).join(", ") || "n/a"}

## Owner Data Preflight

- Status: ${audit.owner_data_preflight.ok ? "ok" : "not_ready"}
- Mode: ${audit.owner_data_preflight.mode ?? "n/a"}
- Preflight status: ${audit.owner_data_preflight.status ?? "n/a"}
- Selected source: ${audit.owner_data_preflight.selected_source_id ?? "n/a"}
- Preview rows: ${audit.owner_data_preflight.selected_source_row_count ?? 0}
- Preview event total: ${audit.owner_data_preflight.selected_source_event_total ?? 0}
- Sample threshold met: ${audit.owner_data_preflight.sample_threshold_met ? "yes" : "no"}
- No quality regression: ${audit.owner_data_preflight.no_quality_regression ? "yes" : "no"}
- Challenger win rule met: ${audit.owner_data_preflight.challenger_win_rule_met ? "yes" : "no"}
- Next round decision: ${audit.owner_data_preflight.next_round_decision ?? "n/a"}
- Owner review required: ${audit.owner_data_preflight.owner_review_required ? "yes" : "no"}
- Real events unchanged: ${audit.owner_data_preflight.real_events_unchanged ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.owner_data_preflight.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.owner_data_preflight.external_effect ? "yes" : "no"}

## Sample Gate Capture Calendar

- Status: ${audit.sample_gate_capture_calendar.ok ? "ok" : "not_ready"}
- Mode: ${audit.sample_gate_capture_calendar.mode ?? "n/a"}
- Calendar status: ${audit.sample_gate_capture_calendar.status ?? "n/a"}
- Events: ${audit.sample_gate_capture_calendar.event_count ?? 0}
- Next due: ${audit.sample_gate_capture_calendar.next_due_date ?? "n/a"} / ${audit.sample_gate_capture_calendar.next_due_event_id ?? "n/a"}
- P0 inputs: ${audit.sample_gate_capture_calendar.p0_input_count ?? 0}
- P0 pending: ${audit.sample_gate_capture_calendar.p0_pending_count ?? 0}
- Progress status: ${audit.sample_gate_capture_calendar.progress_status ?? "n/a"}
- Calendar import performed: ${audit.sample_gate_capture_calendar.calendar_import_performed ? "yes" : "no"}
- System reminder created: ${audit.sample_gate_capture_calendar.system_reminder_created ? "yes" : "no"}
- Browser open performed: ${audit.sample_gate_capture_calendar.browser_open_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.sample_gate_capture_calendar.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.sample_gate_capture_calendar.external_effect ? "yes" : "no"}

## Sample Gate Due Status

- Status: ${audit.sample_gate_due_status.ok ? "ok" : "not_ready"}
- Mode: ${audit.sample_gate_due_status.mode ?? "n/a"}
- Due status: ${audit.sample_gate_due_status.status ?? "n/a"}
- Today: ${audit.sample_gate_due_status.today ?? "n/a"}
- Minimum check: ${audit.sample_gate_due_status.min_check_date ?? "n/a"}
- Preferred check: ${audit.sample_gate_due_status.preferred_check_date ?? "n/a"}
- Due: ${audit.sample_gate_due_status.due_date ?? "n/a"} / ${audit.sample_gate_due_status.due_event_id ?? "n/a"} / now=${audit.sample_gate_due_status.due_now ? "yes" : "no"}
- Due phase: ${audit.sample_gate_due_status.due_phase ?? "n/a"}
- P0 inputs: ${audit.sample_gate_due_status.p0_input_count ?? 0}
- P0 pending: ${audit.sample_gate_due_status.p0_pending_count ?? 0}
- Progress status: ${audit.sample_gate_due_status.progress_status ?? "n/a"}
- Capture calendar: ${audit.sample_gate_due_status.capture_calendar_status ?? "n/a"} / next=${audit.sample_gate_due_status.capture_calendar_next_due_date ?? "n/a"} / event=${audit.sample_gate_due_status.capture_calendar_next_due_event_id ?? "n/a"}
- Champion action: ${audit.sample_gate_due_status.champion_action ?? "n/a"}
- Challenger promotion allowed: ${audit.sample_gate_due_status.challenger_promotion_allowed ? "yes" : "no"}
- Next variable rotation allowed: ${audit.sample_gate_due_status.next_variable_rotation_allowed ? "yes" : "no"}
- Calendar import performed: ${audit.sample_gate_due_status.calendar_import_performed ? "yes" : "no"}
- System reminder created: ${audit.sample_gate_due_status.system_reminder_created ? "yes" : "no"}
- Browser open performed: ${audit.sample_gate_due_status.browser_open_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.sample_gate_due_status.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.sample_gate_due_status.external_effect ? "yes" : "no"}

## Week 0 Owner Capture Queue

- Status: ${audit.week0_owner_capture_queue.ok ? "ok" : "not_ready"}
- Mode: ${audit.week0_owner_capture_queue.mode ?? "n/a"}
- Queue status: ${audit.week0_owner_capture_queue.status ?? "n/a"}
- P0 tasks: ${audit.week0_owner_capture_queue.p0_task_count ?? 0}
- P0 links: ${audit.week0_owner_capture_queue.p0_link_count ?? 0}
- Source groups: ${audit.week0_owner_capture_queue.source_group_count ?? 0}
- Owner fill path: ${audit.week0_owner_capture_queue.owner_fill_path ?? "n/a"}
- Next safe command: ${audit.week0_owner_capture_queue.next_safe_command_after_owner_fill ?? "n/a"}
- Live input files created: ${audit.week0_owner_capture_queue.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.week0_owner_capture_queue.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.week0_owner_capture_queue.external_effect ? "yes" : "no"}

## Owner Sample Gate Status

- Status: ${audit.owner_sample_gate_status.ok ? "ok" : "not_ready"}
- Mode: ${audit.owner_sample_gate_status.mode ?? "n/a"}
- Gate status: ${audit.owner_sample_gate_status.status ?? "n/a"}
- Input exists: ${audit.owner_sample_gate_status.input_exists ? "yes" : "no"}
- Filled rows: ${audit.owner_sample_gate_status.filled_rows ?? 0}
- Pending rows: ${audit.owner_sample_gate_status.pending_rows ?? 0}
- Sample threshold met: ${audit.owner_sample_gate_status.sample_threshold_met ? "yes" : "no"}
- Sample-rate win candidate: ${audit.owner_sample_gate_status.sample_rate_win_candidate ? "yes" : "no"}
- Challenger final win rule met: ${audit.owner_sample_gate_status.challenger_win_rule_met ? "yes" : "no"}
- Quality guard: ${audit.owner_sample_gate_status.quality_guard_status ?? "n/a"}
- Decision: ${audit.owner_sample_gate_status.decision ?? "n/a"}
- Promotion performed: ${audit.owner_sample_gate_status.promotion_performed ? "yes" : "no"}
- Live input files created: ${audit.owner_sample_gate_status.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.owner_sample_gate_status.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.owner_sample_gate_status.external_effect ? "yes" : "no"}

## Owner Quality Review

- Status: ${audit.owner_quality_review.ok ? "ok" : "not_ready"}
- Mode: ${audit.owner_quality_review.mode ?? "n/a"}
- Gate status: ${audit.owner_quality_review.status ?? "n/a"}
- Owner sample gate status: ${audit.owner_quality_review.owner_sample_gate_status ?? "n/a"}
- Input exists: ${audit.owner_quality_review.input_exists ? "yes" : "no"}
- Sample threshold met: ${audit.owner_quality_review.sample_threshold_met ? "yes" : "no"}
- Sample-rate win candidate: ${audit.owner_quality_review.sample_rate_win_candidate ? "yes" : "no"}
- Quality guard: ${audit.owner_quality_review.quality_guard_status ?? "n/a"}
- No quality regression: ${audit.owner_quality_review.no_quality_regression === null ? "not evaluated" : audit.owner_quality_review.no_quality_regression ? "yes" : "no"}
- Challenger final win rule met: ${audit.owner_quality_review.challenger_win_rule_met ? "yes" : "no"}
- Promotion review queued: ${audit.owner_quality_review.promotion_review_queued ? "yes" : "no"}
- Promotion performed: ${audit.owner_quality_review.promotion_performed ? "yes" : "no"}
- Approval queue write performed: ${audit.owner_quality_review.approval_queue_write_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.owner_quality_review.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.owner_quality_review.external_effect ? "yes" : "no"}

## Owner Quality Review Form

- Status: ${audit.owner_quality_review_form.ok ? "ok" : "not_ready"}
- Mode: ${audit.owner_quality_review_form.mode ?? "n/a"}
- Form status: ${audit.owner_quality_review_form.status ?? "n/a"}
- Owner quality review status: ${audit.owner_quality_review_form.owner_quality_review_status ?? "n/a"}
- Owner-filled file exists: ${audit.owner_quality_review_form.owner_filled_exists ? "yes" : "no"}
- Sample-rate win candidate: ${audit.owner_quality_review_form.sample_rate_win_candidate ? "yes" : "no"}
- Download filename: ${audit.owner_quality_review_form.download_filename ?? "n/a"}
- Review filename: ${audit.owner_quality_review_form.review_download_filename ?? "n/a"}
- Browser only: ${audit.owner_quality_review_form.browser_only ? "yes" : "no"}
- Browser persistence: ${audit.owner_quality_review_form.browser_persistence ? "yes" : "no"}
- Network calls performed: ${audit.owner_quality_review_form.network_calls_performed ? "yes" : "no"}
- Approval queue write performed: ${audit.owner_quality_review_form.approval_queue_write_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.owner_quality_review_form.data_lp_events_write_performed ? "yes" : "no"}
- Promotion performed: ${audit.owner_quality_review_form.promotion_performed ? "yes" : "no"}
- External effect: ${audit.owner_quality_review_form.external_effect ? "yes" : "no"}

## Sample Gate Owner Worksheet

- Status: ${audit.sample_gate_owner_worksheet.ok ? "ok" : "not_ready"}
- Mode: ${audit.sample_gate_owner_worksheet.mode ?? "n/a"}
- Worksheet status: ${audit.sample_gate_owner_worksheet.status ?? "n/a"}
- Owner sample gate status: ${audit.sample_gate_owner_worksheet.owner_sample_gate_status ?? "n/a"}
- Owner-filled file exists: ${audit.sample_gate_owner_worksheet.owner_filled_exists ? "yes" : "no"}
- Rows: ${audit.sample_gate_owner_worksheet.row_count ?? 0}
- Links: ${audit.sample_gate_owner_worksheet.link_count ?? 0}
- Source groups: ${audit.sample_gate_owner_worksheet.source_group_count ?? 0}
- Required fields: ${(audit.sample_gate_owner_worksheet.required_owner_fields ?? []).join(", ") || "n/a"}
- Live input files created: ${audit.sample_gate_owner_worksheet.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.sample_gate_owner_worksheet.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.sample_gate_owner_worksheet.external_effect ? "yes" : "no"}

## Sample Gate Owner Form

- Status: ${audit.sample_gate_owner_form.ok ? "ok" : "not_ready"}
- Mode: ${audit.sample_gate_owner_form.mode ?? "n/a"}
- Form status: ${audit.sample_gate_owner_form.status ?? "n/a"}
- Owner-filled file exists: ${audit.sample_gate_owner_form.owner_filled_exists ? "yes" : "no"}
- Rows: ${audit.sample_gate_owner_form.row_count ?? 0}
- Links: ${audit.sample_gate_owner_form.link_count ?? 0}
- Source groups: ${audit.sample_gate_owner_form.source_group_count ?? 0}
- Download filename: ${audit.sample_gate_owner_form.download_filename ?? "n/a"}
- Browser only: ${audit.sample_gate_owner_form.browser_only ? "yes" : "no"}
- Browser persistence: ${audit.sample_gate_owner_form.browser_persistence ? "yes" : "no"}
- Network calls performed: ${audit.sample_gate_owner_form.network_calls_performed ? "yes" : "no"}
- Live input files created: ${audit.sample_gate_owner_form.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.sample_gate_owner_form.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.sample_gate_owner_form.external_effect ? "yes" : "no"}

## Sample Gate Owner Form Fixtures

- Status: ${audit.sample_gate_owner_form_fixtures.ok ? "ok" : "not_ready"}
- Mode: ${audit.sample_gate_owner_form_fixtures.mode ?? "n/a"}
- Scenarios: ${audit.sample_gate_owner_form_fixtures.scenario_count ?? 0}
- Form export replay executed: ${audit.sample_gate_owner_form_fixtures.form_export_replay_executed ? "yes" : "no"}
- Source compile commands executed: ${audit.sample_gate_owner_form_fixtures.source_capture_compile_commands_executed ? "yes" : "no"}
- Owner sample gate commands executed: ${audit.sample_gate_owner_form_fixtures.owner_sample_gate_commands_executed ? "yes" : "no"}
- Live input files created: ${audit.sample_gate_owner_form_fixtures.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.sample_gate_owner_form_fixtures.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.sample_gate_owner_form_fixtures.external_effect ? "yes" : "no"}
- Scenario IDs: ${(audit.sample_gate_owner_form_fixtures.scenarios ?? []).map((scenario) => scenario.id).join(", ") || "n/a"}

## Sample Gate Batch Handoff

- Status: ${audit.sample_gate_batch_handoff.ok ? "ok" : "not_ready"}
- Mode: ${audit.sample_gate_batch_handoff.mode ?? "n/a"}
- Handoff status: ${audit.sample_gate_batch_handoff.status ?? "n/a"}
- P0 rows: ${audit.sample_gate_batch_handoff.all_p0_row_count ?? 0}/${audit.sample_gate_batch_handoff.p0_task_count ?? 0}
- Focused batch rows: ${audit.sample_gate_batch_handoff.focused_batch_row_count ?? 0}
- Remaining batch rows: ${audit.sample_gate_batch_handoff.remaining_batch_row_count ?? 0}
- Full coverage ready: ${audit.sample_gate_batch_handoff.full_coverage_ready ? "yes" : "no"}
- Live input files created: ${audit.sample_gate_batch_handoff.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.sample_gate_batch_handoff.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.sample_gate_batch_handoff.external_effect ? "yes" : "no"}
- Delete action performed: ${audit.sample_gate_batch_handoff.delete_action_performed ? "yes" : "no"}

## Sample Gate Collection Sprint

- Status: ${audit.sample_gate_collection_sprint.ok ? "ok" : "not_ready"}
- Mode: ${audit.sample_gate_collection_sprint.mode ?? "n/a"}
- Sprint status: ${audit.sample_gate_collection_sprint.status ?? "n/a"}
- Due status: ${audit.sample_gate_collection_sprint.due_status ?? "n/a"}
- P0 pending: ${audit.sample_gate_collection_sprint.p0_pending_count ?? 0}/${audit.sample_gate_collection_sprint.p0_full_task_count ?? 0}
- Focused missing count: ${audit.sample_gate_collection_sprint.focused_missing_count ?? 0}
- Sprint steps: ${audit.sample_gate_collection_sprint.sprint_step_count ?? 0}
- Owner open targets: ${audit.sample_gate_collection_sprint.owner_open_target_count ?? 0}
- Owner review required: ${audit.sample_gate_collection_sprint.owner_review_required ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.sample_gate_collection_sprint.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.sample_gate_collection_sprint.external_effect ? "yes" : "no"}
- Delete action performed: ${audit.sample_gate_collection_sprint.delete_action_performed ? "yes" : "no"}

## Owner Sample Gate Fixtures

- Status: ${audit.owner_sample_gate_fixtures.ok ? "ok" : "not_ready"}
- Mode: ${audit.owner_sample_gate_fixtures.mode ?? "n/a"}
- Scenarios: ${audit.owner_sample_gate_fixtures.scenario_count ?? 0}
- Commands executed: ${audit.owner_sample_gate_fixtures.owner_sample_gate_commands_executed ? "yes" : "no"}
- Real events unchanged: ${audit.owner_sample_gate_fixtures.real_events_unchanged ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.owner_sample_gate_fixtures.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.owner_sample_gate_fixtures.external_effect ? "yes" : "no"}
- Scenario IDs: ${(audit.owner_sample_gate_fixtures.scenarios ?? []).map((scenario) => scenario.id).join(", ") || "n/a"}

## Owner Quality Review Form Fixtures

- Status: ${audit.owner_quality_review_form_fixtures.ok ? "ok" : "not_ready"}
- Mode: ${audit.owner_quality_review_form_fixtures.mode ?? "n/a"}
- Scenarios: ${audit.owner_quality_review_form_fixtures.scenario_count ?? 0}
- Form export replay executed: ${audit.owner_quality_review_form_fixtures.form_export_replay_executed ? "yes" : "no"}
- Commands executed: ${audit.owner_quality_review_form_fixtures.owner_quality_review_commands_executed ? "yes" : "no"}
- Real events unchanged: ${audit.owner_quality_review_form_fixtures.real_events_unchanged ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.owner_quality_review_form_fixtures.data_lp_events_write_performed ? "yes" : "no"}
- Approval queue write performed: ${audit.owner_quality_review_form_fixtures.approval_queue_write_performed ? "yes" : "no"}
- Promotion performed: ${audit.owner_quality_review_form_fixtures.promotion_performed ? "yes" : "no"}
- External effect: ${audit.owner_quality_review_form_fixtures.external_effect ? "yes" : "no"}
- Scenario IDs: ${(audit.owner_quality_review_form_fixtures.scenarios ?? []).map((scenario) => scenario.id).join(", ") || "n/a"}

## Owner Quality Review Fixtures

- Status: ${audit.owner_quality_review_fixtures.ok ? "ok" : "not_ready"}
- Mode: ${audit.owner_quality_review_fixtures.mode ?? "n/a"}
- Scenarios: ${audit.owner_quality_review_fixtures.scenario_count ?? 0}
- Commands executed: ${audit.owner_quality_review_fixtures.owner_quality_review_commands_executed ? "yes" : "no"}
- Real events unchanged: ${audit.owner_quality_review_fixtures.real_events_unchanged ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.owner_quality_review_fixtures.data_lp_events_write_performed ? "yes" : "no"}
- Approval queue write performed: ${audit.owner_quality_review_fixtures.approval_queue_write_performed ? "yes" : "no"}
- External effect: ${audit.owner_quality_review_fixtures.external_effect ? "yes" : "no"}
- Scenario IDs: ${(audit.owner_quality_review_fixtures.scenarios ?? []).map((scenario) => scenario.id).join(", ") || "n/a"}

## Candidate Retirement Fixtures

- Status: ${audit.candidate_retirement_fixtures.ok ? "ok" : "not_ready"}
- Mode: ${audit.candidate_retirement_fixtures.mode ?? "n/a"}
- Scenarios: ${audit.candidate_retirement_fixtures.scenario_count ?? 0}
- Current queue safety: ${audit.candidate_retirement_fixtures.current_queue_safety?.status ?? "n/a"}
- Real events unchanged: ${audit.candidate_retirement_fixtures.real_events_unchanged ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.candidate_retirement_fixtures.data_lp_events_write_performed ? "yes" : "no"}
- Public link change performed: ${audit.candidate_retirement_fixtures.public_link_change_performed ? "yes" : "no"}
- Champion promotion performed: ${audit.candidate_retirement_fixtures.champion_promotion_performed ? "yes" : "no"}
- Delete action performed: ${audit.candidate_retirement_fixtures.delete_action_performed ? "yes" : "no"}
- External effect: ${audit.candidate_retirement_fixtures.external_effect ? "yes" : "no"}
- Scenario IDs: ${(audit.candidate_retirement_fixtures.scenarios ?? []).map((scenario) => scenario.id).join(", ") || "n/a"}

## Iteration History

- Status: ${audit.iteration_history.ok ? "ok" : "not_ready"}
- Mode: ${audit.iteration_history.mode ?? "n/a"}
- Cadence: ${audit.iteration_history.cadence ?? "n/a"}
- History status: ${audit.iteration_history.status ?? "n/a"}
- Current changed variable: ${audit.iteration_history.current_changed_variable ?? "n/a"}
- Sample threshold met: ${audit.iteration_history.sample_threshold_met ? "yes" : "no"}
- Archives scanned: ${audit.iteration_history.archives_scanned ?? 0}
- Next safe actions: ${audit.iteration_history.next_safe_action_count ?? 0}
- Pending human approvals: ${audit.iteration_history.pending_human_count ?? 0}
- Ready local reviews: ${audit.iteration_history.ready_local_review_count ?? 0}
- Production deploy performed: ${audit.iteration_history.production_deploy_performed ? "yes" : "no"}
- Public link change performed: ${audit.iteration_history.public_link_change_performed ? "yes" : "no"}
- External effect: ${audit.iteration_history.external_effect ? "yes" : "no"}

## LINE Inbound Playbook

- Status: ${audit.line_inbound_playbook.ok ? "ok" : "not_ready"}
- Mode: ${audit.line_inbound_playbook.mode ?? "n/a"}
- Scenarios: ${audit.line_inbound_playbook.scenario_count ?? 0}
- Execution performed: ${audit.line_inbound_playbook.execution_performed ? "yes" : "no"}
- LINE push performed: ${audit.line_inbound_playbook.line_push_performed ? "yes" : "no"}
- Customer data mutation performed: ${audit.line_inbound_playbook.customer_data_mutation_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.line_inbound_playbook.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.line_inbound_playbook.external_effect ? "yes" : "no"}

## Approval Resume Fixtures

- Status: ${audit.approval_resume_fixtures.ok ? "ok" : "not_ready"}
- Mode: ${audit.approval_resume_fixtures.mode ?? "n/a"}
- Scenarios: ${audit.approval_resume_fixtures.scenario_count ?? 0}
- Execution performed: ${audit.approval_resume_fixtures.execution_performed ? "yes" : "no"}
- External effect: ${audit.approval_resume_fixtures.external_effect ? "yes" : "no"}

## Owner Approval Form

- Status: ${audit.owner_approval_form.ok ? "ok" : "not_ready"}
- Mode: ${audit.owner_approval_form.mode ?? "n/a"}
- Form status: ${audit.owner_approval_form.status ?? "n/a"}
- Approval input exists: ${audit.owner_approval_form.approval_input_exists ? "yes" : "no"}
- Metadata gates exposed: ${audit.owner_approval_form.form_gate_count ?? 0}
- Manual-only gates excluded: ${audit.owner_approval_form.excluded_manual_gate_count ?? 0}
- Download filename: ${audit.owner_approval_form.download_filename ?? "n/a"}
- Review filename: ${audit.owner_approval_form.review_download_filename ?? "n/a"}
- Browser only: ${audit.owner_approval_form.browser_only ? "yes" : "no"}
- Browser persistence: ${audit.owner_approval_form.browser_persistence ? "yes" : "no"}
- Network calls performed: ${audit.owner_approval_form.network_calls_performed ? "yes" : "no"}
- Approval input write performed: ${audit.owner_approval_form.approval_input_write_performed ? "yes" : "no"}
- Live input files created: ${audit.owner_approval_form.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${audit.owner_approval_form.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${audit.owner_approval_form.external_effect ? "yes" : "no"}

## Owner Approval Form Fixtures

- Status: ${audit.owner_approval_form_fixtures.ok ? "ok" : "not_ready"}
- Mode: ${audit.owner_approval_form_fixtures.mode ?? "n/a"}
- Scenarios: ${audit.owner_approval_form_fixtures.scenario_count ?? 0}
- Form export replay executed: ${audit.owner_approval_form_fixtures.form_export_replay_executed ? "yes" : "no"}
- Approval resume commands executed: ${audit.owner_approval_form_fixtures.approval_resume_commands_executed ? "yes" : "no"}
- Live input files created: ${audit.owner_approval_form_fixtures.live_input_files_created ? "yes" : "no"}
- Approval input write performed: ${audit.owner_approval_form_fixtures.approval_input_write_performed ? "yes" : "no"}
- Execution performed: ${audit.owner_approval_form_fixtures.execution_performed ? "yes" : "no"}
- External effect: ${audit.owner_approval_form_fixtures.external_effect ? "yes" : "no"}
- Scenario IDs: ${(audit.owner_approval_form_fixtures.scenarios ?? []).map((scenario) => scenario.id).join(", ") || "n/a"}

## Owner Gate Evidence Intake

- Status: ${audit.owner_gate_evidence.ok ? "ok" : "not_ready"}
- Mode: ${audit.owner_gate_evidence.mode ?? "n/a"}
- Evidence status: ${audit.owner_gate_evidence.status ?? "n/a"}
- Input exists: ${audit.owner_gate_evidence.input_exists ? "yes" : "no"}
- Ready gates: ${audit.owner_gate_evidence.ready_gate_count ?? 0}/${audit.owner_gate_evidence.non_manual_gate_count ?? 0}
- Issue count: ${audit.owner_gate_evidence.issue_count ?? 0}
- Evidence only: ${audit.owner_gate_evidence.evidence_only ? "yes" : "no"}
- Execution performed: ${audit.owner_gate_evidence.execution_performed ? "yes" : "no"}
- External effect: ${audit.owner_gate_evidence.external_effect ? "yes" : "no"}

## Owner Gate Evidence Fixtures

- Status: ${audit.owner_gate_evidence_fixtures.ok ? "ok" : "not_ready"}
- Mode: ${audit.owner_gate_evidence_fixtures.mode ?? "n/a"}
- Scenarios: ${audit.owner_gate_evidence_fixtures.scenario_count ?? 0}
- Local fixture commands executed: ${audit.owner_gate_evidence_fixtures.local_fixture_commands_executed ? "yes" : "no"}
- Owner gate evidence fixture executed: ${audit.owner_gate_evidence_fixtures.owner_gate_evidence_fixture_executed ? "yes" : "no"}
- Execution performed: ${audit.owner_gate_evidence_fixtures.execution_performed ? "yes" : "no"}
- External effect: ${audit.owner_gate_evidence_fixtures.external_effect ? "yes" : "no"}

## Post-Gate Verification Plan

- Status: ${audit.post_gate_verification.ok ? "ok" : "not_ready"}
- Mode: ${audit.post_gate_verification.mode ?? "n/a"}
- Verification status: ${audit.post_gate_verification.status ?? "n/a"}
- Ready gates: ${audit.post_gate_verification.ready_gate_count ?? 0}/${audit.post_gate_verification.non_manual_gate_count ?? 0}
- No network read performed: ${audit.post_gate_verification.no_network_read_performed ? "yes" : "no"}
- No remote CLI performed: ${audit.post_gate_verification.no_remote_cli_performed ? "yes" : "no"}
- Actual evidence values persisted: ${audit.post_gate_verification.no_actual_evidence_values_persisted ? "no" : "yes"}
- Execution performed: ${audit.post_gate_verification.execution_performed ? "yes" : "no"}
- External effect: ${audit.post_gate_verification.external_effect ? "yes" : "no"}

## Post-Gate Verification Fixtures

- Status: ${audit.post_gate_verification_fixtures.ok ? "ok" : "not_ready"}
- Mode: ${audit.post_gate_verification_fixtures.mode ?? "n/a"}
- Scenarios: ${audit.post_gate_verification_fixtures.scenario_count ?? 0}
- Local fixture commands executed: ${audit.post_gate_verification_fixtures.local_fixture_commands_executed ? "yes" : "no"}
- Owner gate evidence fixture executed: ${audit.post_gate_verification_fixtures.owner_gate_evidence_fixture_executed ? "yes" : "no"}
- Post-gate verification fixture executed: ${audit.post_gate_verification_fixtures.post_gate_verification_fixture_executed ? "yes" : "no"}
- Execution performed: ${audit.post_gate_verification_fixtures.execution_performed ? "yes" : "no"}
- External effect: ${audit.post_gate_verification_fixtures.external_effect ? "yes" : "no"}

## GitHub Export Bundle

- Status: ${audit.github_export_bundle.ok ? "ok" : "not_ready"}
- Mode: ${audit.github_export_bundle.mode ?? "n/a"}
- Files copied: ${audit.github_export_bundle.file_count ?? 0}
- Repo dir: ${audit.github_export_bundle.repo_dir ?? "n/a"}
- Manifest: ${audit.github_export_bundle.manifest_path ?? "n/a"}
- Report: ${audit.github_export_bundle.report_path ?? "n/a"}
- Excluded live / owner inputs: ${(audit.github_export_bundle.excluded_live_or_owner_inputs ?? []).join(", ") || "n/a"}
- Git init performed: ${audit.github_export_bundle.git_init_performed ? "yes" : "no"}
- Git commit performed: ${audit.github_export_bundle.git_commit_performed ? "yes" : "no"}
- GitHub push or PR performed: ${audit.github_export_bundle.github_push_or_pr_performed ? "yes" : "no"}
- External effect: ${audit.github_export_bundle.external_effect ? "yes" : "no"}

## Artifact Retention Monitor

- Status: ${audit.artifact_retention_monitor.status ?? "n/a"}
- Mode: ${audit.artifact_retention_monitor.mode ?? "n/a"}
- Total local artifact size: ${audit.artifact_retention_monitor.total_human ?? "n/a"}
- Warnings: ${audit.artifact_retention_monitor.warning_count ?? 0}
- Owner-only cleanup candidates: ${audit.artifact_retention_monitor.cleanup_candidate_count ?? 0}
- Owner review required: ${audit.artifact_retention_monitor.owner_review_required ? "yes" : "no"}
- Cleanup policy: ${audit.artifact_retention_monitor.cleanup_execution_policy ?? "n/a"}
- Cleanup command generated: ${audit.artifact_retention_monitor.cleanup_command_generated ? "yes" : "no"}
- Cleanup command executed: ${audit.artifact_retention_monitor.cleanup_command_executed ? "yes" : "no"}
- Delete action performed: ${audit.artifact_retention_monitor.delete_action_performed ? "yes" : "no"}
- External effect: ${audit.artifact_retention_monitor.external_effect ? "yes" : "no"}

## Artifact Retention Review Pack

- Status: ${audit.artifact_retention_review_pack.status ?? "n/a"}
- Mode: ${audit.artifact_retention_review_pack.mode ?? "n/a"}
- Source status: ${audit.artifact_retention_review_pack.source_status_path ?? "n/a"}
- Total local artifact size: ${audit.artifact_retention_review_pack.total_human ?? "n/a"}
- Owner cleanup candidates: ${audit.artifact_retention_review_pack.cleanup_candidate_count ?? 0}
- Review required: ${audit.artifact_retention_review_pack.review_required ? "yes" : "no"}
- Highest priority section: ${audit.artifact_retention_review_pack.highest_priority_section_id ?? "n/a"}
- Cleanup policy: ${audit.artifact_retention_review_pack.cleanup_execution_policy ?? "n/a"}
- Cleanup command generated: ${audit.artifact_retention_review_pack.cleanup_command_generated ? "yes" : "no"}
- Cleanup command executed: ${audit.artifact_retention_review_pack.cleanup_command_executed ? "yes" : "no"}
- Filesystem mutation performed: ${audit.artifact_retention_review_pack.filesystem_mutation_performed ? "yes" : "no"}
- Delete action performed: ${audit.artifact_retention_review_pack.delete_action_performed ? "yes" : "no"}
- External effect: ${audit.artifact_retention_review_pack.external_effect ? "yes" : "no"}

## GitHub Actions Weekly Verify

- Status: ${audit.github_actions_workflow.ok ? "ok" : "not_ready"}
- Path: ${audit.github_actions_workflow.path}
- Cron: ${audit.github_actions_workflow.schedule_cron} (${audit.github_actions_workflow.taipei_time})
- Manual dispatch: ${audit.github_actions_workflow.workflow_dispatch ? "yes" : "no"}
- Verify command: ${audit.github_actions_workflow.verify_command ? "yes" : "no"}
- Upload artifact: ${audit.github_actions_workflow.upload_artifact ? "yes" : "no"}
- Deploy step present: ${audit.github_actions_workflow.deploy_step_present ? "yes" : "no"}
- Git write step present: ${audit.github_actions_workflow.git_write_step_present ? "yes" : "no"}
- External effect now: no

## LaunchAgent Runtime Proof

- Service loaded: ${audit.launchagent_runtime.service_loaded ? "yes" : "no"}
- State: ${audit.launchagent_runtime.state ?? "n/a"}
- Active count: ${audit.launchagent_runtime.active_count ?? "n/a"}
- Run count: ${audit.launchagent_runtime.run_count ?? "n/a"}
- Last exit code: ${audit.launchagent_runtime.last_exit_code ?? "n/a"}
- Successful run observed: ${audit.launchagent_runtime.observed_successful_run ? "yes" : "no"}
- Current LaunchAgent invocation observed: ${audit.launchagent_runtime.current_launchd_invocation_observed ? "yes" : "no"}
- Current process descends from service: ${audit.launchagent_runtime.current_process_descends_from_service ? "yes" : "no"}
- Proof kind: ${audit.launchagent_runtime.proof_kind}
- External effect: ${audit.launchagent_runtime.external_effect ? "yes" : "no"}

## Schedule Catch-Up Monitor

- Status: ${audit.schedule_catchup.status ?? "n/a"}
- Mode: ${audit.schedule_catchup.mode ?? "n/a"}
- Latest expected run: ${audit.schedule_catchup.latest_expected_run?.taipei ?? "n/a"}
- Next expected run: ${audit.schedule_catchup.next_expected_run?.taipei ?? "n/a"}
- Catch-up required: ${audit.schedule_catchup.catchup_required ? "yes" : "no"}
- Weekly runner status observed: ${audit.schedule_catchup.weekly_runner_status ?? "n/a"}
- Weekly runner pending commands observed: ${audit.schedule_catchup.weekly_runner_pending_commands ?? "n/a"}
- Weekly runner invoked by monitor: ${audit.schedule_catchup.weekly_runner_invoked ? "yes" : "no"}
- Catch-up run performed by monitor: ${audit.schedule_catchup.catchup_run_performed ? "yes" : "no"}
- Next safe action: ${audit.schedule_catchup.next_safe_action ?? "n/a"}
- External effect: ${audit.schedule_catchup.external_effect ? "yes" : "no"}

## Red-Line Priority Queue

- Status: ${audit.redline_priority.status ?? "n/a"}
- Mode: ${audit.redline_priority.mode ?? "n/a"}
- Actions: ${audit.redline_priority.action_count ?? 0}
- Local actions: ${audit.redline_priority.local_action_count ?? 0}
- External gate actions: ${audit.redline_priority.gate_action_count ?? 0}
- Manual-only actions: ${audit.redline_priority.manual_only_action_count ?? 0}
- Red-line queue covered: ${audit.redline_priority.redline_queue_covered ? "yes" : "no"}
- Next operator action: ${audit.redline_priority.next_operator_action ?? "n/a"}
- No autorun for external gates: ${audit.redline_priority.no_autorun_for_external_gates ? "yes" : "no"}
- Gates execute in order: ${audit.redline_priority.gates_execute_in_order ? "yes" : "no"}
- Execution performed: ${audit.redline_priority.execution_performed ? "yes" : "no"}
- External effect: ${audit.redline_priority.external_effect ? "yes" : "no"}

## Required Outputs

| artifact | status |
|---|---|
${outputRows}

## Human Gates Preserved

- Production deploy performed: no
- Public link change performed: no
- Formal post performed: no
- GitHub push or PR performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
`;
}

main();
