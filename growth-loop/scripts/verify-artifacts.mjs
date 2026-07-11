import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

function launchAgentRuntimeProofStatus(launchAgent, weeklyRunner) {
  const runtime = launchAgent.launchctl_runtime ?? {};
  const completedExitZero = launchAgent.service_loaded === true
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
    && launchAgent.service_loaded === true
    && runtime.state === "running"
    && (runtime.active_count ?? 0) > 0
    && runtime.current_launchd_invocation_observed === true
    && runtime.current_process_descends_from_service === true
    && weeklyRunner?.status === "success"
    && !(weeklyRunner?.commands ?? []).some((command) => command.status === "failed")
    && successfulSteps.has("launchagent_status_readback")
    && successfulSteps.has("artifact_retention_review")
    && successfulSteps.has("owner_console_smoke");
  return {
    ok: currentRunReady,
    proof_kind: currentRunReady ? "current_run_pending_exit" : "none",
  };
}

const objectiveSequence = [
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

const requiredFiles = [
  "config/growth-loop.config.json",
  "weekly_report.md",
  "growth_scores.json",
  "approval_queue.json",
  "data/approval_queue_status.json",
  "ab_test_status.json",
  "tracking_links.json",
  "content_variants.json",
  "content_variants.md",
  "funnel_breakdown.json",
  "funnel_breakdown.md",
  "north_star_funnel.json",
  "north_star_funnel.md",
  "next_round_plan.json",
  "next_round_plan.md",
  "pipeline_status.json",
  "data/schedule_status.json",
  "data/launchagent_status.json",
  "data/schedule_catchup_status.json",
  "schedule_catchup_status.md",
  "data/week_archive_status.json",
  "launchd/com.angelia.3q-growth-loop.weekly.plist",
  "data/d1_sync_status.json",
  "d1_collection_guard.md",
  "scripts/export-d1-events.mjs",
  "scripts/collect-d1-auto.mjs",
  "scripts/export-d1-aggregate-events.mjs",
  "scripts/d1-collection-mode-fixtures.mjs",
  "scripts/d1-aggregate-export-fixtures.mjs",
  "d1_collection_mode.md",
  "data/d1_collection_mode_status.json",
  "d1_collection_mode_plan.md",
  "data/d1_collection_mode_plan_status.json",
  "d1_collection_mode_fixture_report.md",
  "data/d1_collection_mode_fixture_status.json",
  "d1_aggregate_export_fixture_report.md",
  "data/d1_aggregate_export_fixture_status.json",
  "data/event_input_quality_status.json",
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
  "scripts/lib/champion-source-lock.mjs",
  "scripts/champion-source-lock-fixtures.mjs",
  "champion_source_lock_fixtures.md",
  "data/champion_source_lock_fixture_status.json",
  "scripts/lib/run-lock-policy.mjs",
  "scripts/weekly-runner-lock-fixtures.mjs",
  "weekly_runner_lock_fixtures.md",
  "data/weekly_runner_lock_fixture_status.json",
  "champion_integration_candidate.md",
  "data/champion_integration_candidate_status.json",
  "scripts/champion-integration-smoke.mjs",
  "champion_integration_smoke.md",
  "data/champion_integration_smoke_status.json",
  "scripts/cloudflare-d1-readiness.mjs",
  "cloudflare_d1_readiness.md",
  "data/cloudflare_d1_readiness_status.json",
  "data/cloudflare_d1_inventory_snapshot.json",
  "data/cloudflare_d1_schema_observation.json",
  "cloudflare_d1_schema_observation.md",
  "scripts/live-telemetry-readiness.mjs",
  "live_telemetry_readiness.md",
  "data/live_telemetry_readiness_status.json",
  "data/live_telemetry_observation_snapshot.json",
  "scripts/live-telemetry-readiness-fixtures.mjs",
  "live_telemetry_readiness_fixture_report.md",
  "data/live_telemetry_readiness_fixture_status.json",
  "scripts/d1-schema-contract.mjs",
  "d1_schema_contract.md",
  "data/d1_schema_contract_status.json",
  "scripts/approved-d1-config.mjs",
  "approved_d1_config.md",
  "data/approved_d1_config_status.json",
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
  "sample_gate_ledger_compile_probe.md",
  "data/sample_gate_ledger_compile_probe_status.json",
  "data/source_capture/sample_gate_compile_probe/funnel_aggregates.owner-preview.csv",
  "data/source_capture/sample_gate_compile_probe/manual_conversions.owner-preview.csv",
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
  "line_oa_account_metrics_observation.md",
  "data/line_oa_account_metrics_observation.json",
  "scripts/source-trust-matrix.mjs",
  "next_p0_owner_inputs.md",
  "next_p0_owner_inputs.json",
  "data/next_p0_owner_inputs_status.json",
  "next_p0_owner_form.html",
  "data/next_p0_owner_form_status.json",
  "next_p0_owner_form_fixture_report.md",
  "data/next_p0_owner_form_fixture_status.json",
  "next_p0_quick_capture.md",
  "data/next_p0_quick_capture_status.json",
  "next_p0_quick_capture_fixture_report.md",
  "data/next_p0_quick_capture_fixture_status.json",
  "data/next_p0_quick_capture/next_p0_owner_inputs.quick-template.csv",
  "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
  "data/next_p0_quick_capture/next_p0_owner_inputs.quick-filled.preview.csv",
  "p0_counts_preflight.md",
  "p0_counts_preflight.json",
  "data/p0_counts_preflight_status.json",
  "p0_counts_preflight_fixture_report.md",
  "data/p0_counts_preflight_fixture_status.json",
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
  "sample_gate_due_fixture_report.md",
  "data/sample_gate_due_fixture_status.json",
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
  "owner_sample_gate_intake.md",
  "data/owner_sample_gate_intake_status.json",
  "owner_sample_gate_intake_fixture_report.md",
  "data/owner_sample_gate_intake_fixture_status.json",
  "owner_next_action.md",
  "owner_next_action.json",
  "data/owner_next_action_status.json",
  "north_star_outcome_preflight.md",
  "north_star_outcome_preflight.json",
  "data/north_star_outcome_preflight_status.json",
  "north_star_outcome_form.html",
  "data/north_star_outcome_form_status.json",
  "north_star_outcome_form_fixture_report.md",
  "data/north_star_outcome_form_fixture_status.json",
  "owner_p1_outcome_intake.md",
  "owner_p1_outcome_intake.json",
  "data/owner_p1_outcome_intake_status.json",
  "owner_p1_outcome_intake_fixture_report.md",
  "data/owner_p1_outcome_intake_fixture_status.json",
  "owner_p1_outcome_postfill_check.md",
  "owner_p1_outcome_postfill_check.json",
  "RUN-P1-OUTCOME-POST-FILL-CHECK.command",
  "data/owner_p1_outcome_postfill_check_status.json",
  "sample_gate_recovery_pack.md",
  "sample_gate_recovery_pack.json",
  "data/sample_gate_recovery_pack_status.json",
  "sample_gate_batch_handoff.md",
  "sample_gate_batch_handoff.json",
  "data/sample_gate_batch_handoff_status.json",
  "sample_gate_batch_preflight.md",
  "sample_gate_batch_preflight.json",
  "data/sample_gate_batch_preflight_status.json",
  "sample_gate_batch_1_paste_block.txt",
  "sample_gate_batch_2_paste_block.txt",
  "owner_sample_count_handoff.md",
  "owner_sample_count_paste_block.txt",
  "owner_sample_count_handoff.json",
  "data/owner_sample_count_handoff_status.json",
  "owner_p0_now.html",
  "owner_p0_now.md",
  "owner_p0_now.json",
  "data/owner_p0_now_status.json",
  "sample_gate_collection_sprint.md",
  "sample_gate_collection_sprint.json",
  "data/sample_gate_collection_sprint_status.json",
  "owner_p0_launcher.md",
  "OPEN-P0-SAMPLE-GATE.command",
  "data/owner_p0_launcher_status.json",
  "owner_sample_count_recovery.md",
  "owner_sample_count_recovery.json",
  "data/owner_sample_count_recovery_status.json",
  "owner_p0_postfill_check.md",
  "owner_p0_postfill_check.json",
  "RUN-P0-POST-FILL-CHECK.command",
  "data/owner_p0_postfill_check_status.json",
  "owner_sample_count_recovery_fixture_report.md",
  "data/owner_sample_count_recovery_fixture_status.json",
  "owner_next_action_fixture_report.md",
  "data/owner_next_action_fixture_status.json",
  "owner_action_launcher.md",
  "OPEN-3Q-GROWTH-LOOP.command",
  "data/owner_action_launcher_status.json",
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
  "sample_gate_collection_plan.json",
  "sample_gate_collection_plan.md",
  "data/sample_gate_collection_plan_status.json",
  "iteration_history.json",
  "iteration_history.md",
  "data/manual_conversion_status.json",
  "data/manual_conversions.example.csv",
  "data/manual_conversions.preview.jsonl",
  "line_inbound_playbook.md",
  "line_inbound_playbook.json",
  "line_inbound_fixture_report.md",
  "data/line_inbound_fixture_status.json",
  "manual_publish_packet.md",
  "manual_publish_packet.json",
  "data/manual_publish_packet_status.json",
  "manual_publish_capture_plan.md",
  "manual_publish_capture_plan.json",
  "data/manual_publish_capture_plan_status.json",
  "manual_publish_brief.md",
  "manual_publish_brief.json",
  "data/manual_publish_brief_status.json",
  "public_tracking_url_pack.md",
  "public_tracking_url_pack.json",
  "data/public_tracking_url_pack_status.json",
  "owner_public_url_approval_preview.md",
  "owner_public_url_approval_preview.json",
  "data/owner_public_url_approval_preview_status.json",
  "manual_publish_evidence.md",
  "manual_publish_evidence.example.json",
  "data/manual_publish_evidence_status.json",
  "manual_publish_evidence_form.html",
  "data/manual_publish_evidence_form_status.json",
  "manual_publish_evidence_form_fixture_report.md",
  "data/manual_publish_evidence_form_fixture_status.json",
  "manual_publish_evidence_fixture_report.md",
  "data/manual_publish_evidence_fixture_status.json",
  "variable_rotation_fixture_report.md",
  "data/variable_rotation_fixture_status.json",
  "worker_dry_run.md",
  "data/worker_dry_run_status.json",
  "data/browser_smoke_status.json",
  "tracking_link_smoke.md",
  "data/tracking_link_smoke_status.json",
  "data/event_contract_smoke_status.json",
  "data/win_rule_fixture_status.json",
  "data/real_data_decision_replay_status.json",
  "data/approval_resume_fixture_status.json",
  "win_rule_fixture_report.md",
  "real_data_decision_replay_report.md",
  "approval_resume_fixture_report.md",
  "owner_console.html",
  "data/owner_console_status.json",
  "data/owner_console_smoke_status.json",
  "candidate_retirement_queue.json",
  "candidate_retirement_fixture_report.md",
  "data/candidate_retirement_fixture_status.json",
  "goal_completion_audit.md",
  "data/goal_completion_audit_status.json",
  "objective_sequence_audit.md",
  "objective_sequence_audit.json",
  "data/objective_sequence_audit_status.json",
  ".github/workflows/3q-growth-loop-weekly.yml",
  "github_workflow_guard.md",
  "github_workflow_guard.json",
  "data/github_workflow_guard_status.json",
  "github_handoff.md",
  "github_export_manifest.md",
  "data/github_export_status.json",
  "artifact_retention.md",
  "data/artifact_retention_status.json",
  "artifact_retention_review_pack.md",
  "artifact_retention_review_pack.json",
  "data/artifact_retention_review_status.json",
  "launch_readiness.json",
  "owner_approval_pack.md",
  "approval_resume_plan.md",
  "data/approval_resume_status.json",
  "owner_approval_form.html",
  "data/owner_approval_form_status.json",
  "owner_approval_form_fixture_report.md",
  "data/owner_approval_form_fixture_status.json",
  "owner_gate_evidence.md",
  "owner_gate_evidence.example.json",
  "data/owner_gate_evidence_status.json",
  "owner_gate_evidence_fixture_report.md",
  "data/owner_gate_evidence_fixture_status.json",
  "post_gate_verification.md",
  "data/post_gate_verification_status.json",
  "post_gate_verification_fixture_report.md",
  "data/post_gate_verification_fixture_status.json",
  "gate_readiness.md",
  "data/gate_readiness_status.json",
  "redline_priority.md",
  "redline_priority.json",
  "data/redline_priority_status.json",
  "owner_approval_input.example.json",
  "landing_page_candidate.html",
  "worker.ts",
  "prepared_but_blocked.json",
  "prepared_but_blocked.md",
  "data/prepared_but_blocked_report_status.json",
  "scripts/prepared-but-blocked-report.mjs",
  "scripts/artifact-retention-monitor.mjs",
  "scripts/artifact-retention-review-pack.mjs",
  "scripts/sample-gate-collection-sprint.mjs",
  "scripts/worker-dry-run-status.mjs",
  "scripts/sample-gate-batch-handoff.mjs",
  "schema/d1-week0.sql",
];

const checks = [];

async function readRequired(file) {
  const content = await readFile(path.join(ROOT, file), "utf8");
  if (!content.trim()) {
    throw new Error(`${file} is empty`);
  }
  checks.push({ file, ok: true, bytes: content.length });
  return content;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNoRedLineFlags(value, label) {
  for (const field of [
    "external_effect",
    "data_lp_events_write_performed",
    "public_link_change_performed",
    "production_deploy_performed",
    "github_push_or_pr_performed",
    "formal_post_performed",
    "line_push_performed",
    "customer_data_mutation_performed",
    "payment_action_performed",
    "delete_action_performed",
  ]) {
    assert(value?.[field] === false, `${label} must keep ${field}=false`);
  }
}

function isPublicHttpUrlForVerifier(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return ["http:", "https:"].includes(url.protocol)
      && host !== "localhost"
      && host !== "127.0.0.1"
      && host !== "::1"
      && !host.startsWith("192.168.")
      && !host.startsWith("10.")
      && !/^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
  } catch {
    return false;
  }
}

for (const file of requiredFiles) {
  await readRequired(file);
}

const config = JSON.parse(await readRequired("config/growth-loop.config.json"));
const scores = JSON.parse(await readRequired("growth_scores.json"));
const ab = JSON.parse(await readRequired("ab_test_status.json"));
const approval = JSON.parse(await readRequired("approval_queue.json"));
const approvalStatus = JSON.parse(await readRequired("data/approval_queue_status.json"));
const blocked = JSON.parse(await readRequired("prepared_but_blocked.json"));
const preparedButBlockedReport = await readRequired("prepared_but_blocked.md");
const preparedButBlockedStatus = JSON.parse(await readRequired("data/prepared_but_blocked_report_status.json"));
const links = JSON.parse(await readRequired("tracking_links.json"));
const variants = JSON.parse(await readRequired("content_variants.json"));
const funnelBreakdown = JSON.parse(await readRequired("funnel_breakdown.json"));
const funnelBreakdownMd = await readRequired("funnel_breakdown.md");
const northStar = JSON.parse(await readRequired("north_star_funnel.json"));
const northStarMd = await readRequired("north_star_funnel.md");
const nextRoundPlan = JSON.parse(await readRequired("next_round_plan.json"));
const pipeline = JSON.parse(await readRequired("pipeline_status.json"));
const schedule = JSON.parse(await readRequired("data/schedule_status.json"));
const launchAgent = JSON.parse(await readRequired("data/launchagent_status.json"));
const scheduleCatchup = JSON.parse(await readRequired("data/schedule_catchup_status.json"));
const scheduleCatchupMd = await readRequired("schedule_catchup_status.md");
const weeklyRunnerStatus = JSON.parse(await readRequired("data/weekly_runner_status.json"));
const launchAgentRuntimeProof = launchAgentRuntimeProofStatus(launchAgent, weeklyRunnerStatus);
const weeklyRunnerLockFixtures = JSON.parse(await readRequired("data/weekly_runner_lock_fixture_status.json"));
const d1Sync = JSON.parse(await readRequired("data/d1_sync_status.json"));
const d1CollectionGuardMd = await readRequired("d1_collection_guard.md");
const d1CollectionMode = JSON.parse(await readRequired("data/d1_collection_mode_status.json"));
const d1CollectionModeMd = await readRequired("d1_collection_mode.md");
const d1CollectionModePlan = JSON.parse(await readRequired("data/d1_collection_mode_plan_status.json"));
const d1CollectionModePlanMd = await readRequired("d1_collection_mode_plan.md");
const d1CollectionModeFixtures = JSON.parse(await readRequired("data/d1_collection_mode_fixture_status.json"));
const d1CollectionModeFixtureReport = await readRequired("d1_collection_mode_fixture_report.md");
const d1AggregateExportFixtures = JSON.parse(await readRequired("data/d1_aggregate_export_fixture_status.json"));
const d1AggregateExportFixtureReport = await readRequired("d1_aggregate_export_fixture_report.md");
const eventInputQuality = JSON.parse(await readRequired("data/event_input_quality_status.json"));
const funnelAggregate = JSON.parse(await readRequired("data/funnel_aggregate_status.json"));
const funnelAggregateFixture = JSON.parse(await readRequired("data/funnel_aggregate_fixture_status.json"));
const realDataApplyFixture = JSON.parse(await readRequired("data/real_data_apply_fixture_status.json"));
const realDataInputPack = JSON.parse(await readRequired("data/real_data_input_pack_status.json"));
const realDataInputPackMd = await readRequired("real_data_input_pack.md");
const realDataInputPackFunnelCsv = await readRequired("data/real_data_input_pack/funnel_aggregates.fill-template.csv");
const realDataInputPackManualCsv = await readRequired("data/real_data_input_pack/manual_conversions.fill-template.csv");
const sourceReadiness = JSON.parse(await readRequired("data/source_readiness_status.json"));
const sourceReadinessMd = await readRequired("source_readiness.md");
const sourceCapture = JSON.parse(await readRequired("data/source_capture_status.json"));
const sourceCapturePackMd = await readRequired("source_capture_pack.md");
const sourceCaptureChecklist = JSON.parse(await readRequired("data/source_capture/source_capture_checklist.json"));
const sourceCaptureLedgerCsv = await readRequired("data/source_capture/source_capture_ledger.fill-template.csv");
const sampleGateLedgerCsv = await readRequired("data/source_capture/sample_gate_ledger.fill-template.csv");
const sampleGateLedgerMd = await readRequired("sample_gate_ledger.md");
const sampleGateLedgerStatus = JSON.parse(await readRequired("data/sample_gate_ledger_status.json"));
const sampleGateCompileProbe = JSON.parse(await readRequired("data/sample_gate_ledger_compile_probe_status.json"));
const sampleGateCompileProbeReport = await readRequired("sample_gate_ledger_compile_probe.md");
const sampleGateCompileProbeFunnelCsv = await readRequired("data/source_capture/sample_gate_compile_probe/funnel_aggregates.owner-preview.csv");
const sampleGateCompileProbeManualCsv = await readRequired("data/source_capture/sample_gate_compile_probe/manual_conversions.owner-preview.csv");
const sampleGateReplay = JSON.parse(await readRequired("data/sample_gate_replay_fixture_status.json"));
const sampleGateReplayReport = await readRequired("sample_gate_replay_fixture_report.md");
const sourceCompile = JSON.parse(await readRequired("data/source_capture_compile_status.json"));
const sourceCompileReport = await readRequired("source_capture_compile_report.md");
const sourceCompileFixture = JSON.parse(await readRequired("data/source_capture_compile_fixture_status.json"));
const sourceCompileFixtureReport = await readRequired("source_capture_compile_fixture_report.md");
const sourceCompileFunnelCsv = await readRequired("data/source_capture/compiled/funnel_aggregates.owner-preview.csv");
const sourceCompileManualCsv = await readRequired("data/source_capture/compiled/manual_conversions.owner-preview.csv");
const realDataIntake = JSON.parse(await readRequired("data/real_data_intake_status.json"));
const realDataIntakePlan = await readRequired("real_data_intake_plan.md");
const dataCollection = JSON.parse(await readRequired("data_collection_queue.json"));
const dataCollectionStatus = JSON.parse(await readRequired("data/data_collection_brief_status.json"));
const dataCollectionBrief = await readRequired("data_collection_brief.md");
const dataCollectionProgress = JSON.parse(await readRequired("data_collection_progress.json"));
const dataCollectionProgressStatus = JSON.parse(await readRequired("data/data_collection_progress_status.json"));
const dataCollectionProgressReport = await readRequired("data_collection_progress.md");
const sourceTrustMatrix = JSON.parse(await readRequired("source_trust_matrix.json"));
const sourceTrustMatrixStatus = JSON.parse(await readRequired("data/source_trust_matrix_status.json"));
const sourceTrustMatrixReport = await readRequired("source_trust_matrix.md");
const lineOaAccountMetricsObservation = JSON.parse(await readRequired("data/line_oa_account_metrics_observation.json"));
const lineOaAccountMetricsObservationReport = await readRequired("line_oa_account_metrics_observation.md");
const nextP0OwnerInputs = JSON.parse(await readRequired("next_p0_owner_inputs.json"));
const nextP0OwnerInputsStatus = JSON.parse(await readRequired("data/next_p0_owner_inputs_status.json"));
const nextP0OwnerInputsReport = await readRequired("next_p0_owner_inputs.md");
const nextP0OwnerFormHtml = await readRequired("next_p0_owner_form.html");
const nextP0OwnerFormStatus = JSON.parse(await readRequired("data/next_p0_owner_form_status.json"));
const nextP0OwnerFormFixture = JSON.parse(await readRequired("data/next_p0_owner_form_fixture_status.json"));
const nextP0OwnerFormFixtureReport = await readRequired("next_p0_owner_form_fixture_report.md");
const nextP0QuickCaptureReport = await readRequired("next_p0_quick_capture.md");
const nextP0QuickCapture = JSON.parse(await readRequired("data/next_p0_quick_capture_status.json"));
const nextP0QuickCaptureFixtureReport = await readRequired("next_p0_quick_capture_fixture_report.md");
const nextP0QuickCaptureFixture = JSON.parse(await readRequired("data/next_p0_quick_capture_fixture_status.json"));
const nextP0QuickTemplateCsv = await readRequired("data/next_p0_quick_capture/next_p0_owner_inputs.quick-template.csv");
const nextP0QuickPasteTemplate = await readRequired("data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt");
const nextP0QuickFilledPreviewCsv = await readRequired("data/next_p0_quick_capture/next_p0_owner_inputs.quick-filled.preview.csv");
const p0CountsPreflightReport = await readRequired("p0_counts_preflight.md");
const p0CountsPreflight = JSON.parse(await readRequired("p0_counts_preflight.json"));
const p0CountsPreflightStatus = JSON.parse(await readRequired("data/p0_counts_preflight_status.json"));
const p0CountsPreflightFixtureReport = await readRequired("p0_counts_preflight_fixture_report.md");
const p0CountsPreflightFixture = JSON.parse(await readRequired("data/p0_counts_preflight_fixture_status.json"));
const nextP0OwnerIntakeReport = await readRequired("next_p0_owner_intake.md");
const nextP0OwnerIntake = JSON.parse(await readRequired("data/next_p0_owner_intake_status.json"));
const nextP0OwnerIntakeFixtureReport = await readRequired("next_p0_owner_intake_fixture_report.md");
const nextP0OwnerIntakeFixture = JSON.parse(await readRequired("data/next_p0_owner_intake_fixture_status.json"));
const nextP0OwnerIntakeFunnelPreview = await readRequired("data/next_p0_owner_intake/funnel_aggregates.owner-preview.csv");
const nextP0OwnerIntakeManualPreview = await readRequired("data/next_p0_owner_intake/manual_conversions.owner-preview.csv");
const ownerDataPreflight = JSON.parse(await readRequired("owner_data_preflight.json"));
const ownerDataPreflightStatus = JSON.parse(await readRequired("data/owner_data_preflight_status.json"));
const ownerDataPreflightMd = await readRequired("owner_data_preflight.md");
const sampleGateCaptureCalendar = JSON.parse(await readRequired("sample_gate_capture_calendar.json"));
const sampleGateCaptureCalendarStatus = JSON.parse(await readRequired("data/sample_gate_capture_calendar_status.json"));
const sampleGateCaptureCalendarMd = await readRequired("sample_gate_capture_calendar.md");
const sampleGateCaptureCalendarIcs = await readRequired("sample_gate_capture_calendar.ics");
const sampleGateDueStatus = JSON.parse(await readRequired("sample_gate_due_status.json"));
const sampleGateDueStatusCompact = JSON.parse(await readRequired("data/sample_gate_due_status_status.json"));
const sampleGateDueStatusMd = await readRequired("sample_gate_due_status.md");
const sampleGateDueFixtureReport = await readRequired("sample_gate_due_fixture_report.md");
const sampleGateDueFixture = JSON.parse(await readRequired("data/sample_gate_due_fixture_status.json"));
const ownerCaptureQueue = JSON.parse(await readRequired("week0_owner_capture_queue.json"));
const ownerCaptureQueueStatus = JSON.parse(await readRequired("data/week0_owner_capture_queue_status.json"));
const ownerCaptureQueueMd = await readRequired("week0_owner_capture_queue.md");
const ownerSampleGate = JSON.parse(await readRequired("owner_sample_gate_status.json"));
const ownerSampleGateStatus = JSON.parse(await readRequired("data/owner_sample_gate_status.json"));
const ownerSampleGateMd = await readRequired("owner_sample_gate_status.md");
const sampleGateOwnerWorksheet = JSON.parse(await readRequired("sample_gate_owner_worksheet.json"));
const sampleGateOwnerWorksheetStatus = JSON.parse(await readRequired("data/sample_gate_owner_worksheet_status.json"));
const sampleGateOwnerWorksheetMd = await readRequired("sample_gate_owner_worksheet.md");
const sampleGateOwnerFormHtml = await readRequired("sample_gate_owner_form.html");
const sampleGateOwnerFormStatus = JSON.parse(await readRequired("data/sample_gate_owner_form_status.json"));
const sampleGateOwnerFormFixture = JSON.parse(await readRequired("data/sample_gate_owner_form_fixture_status.json"));
const sampleGateOwnerFormFixtureReport = await readRequired("sample_gate_owner_form_fixture_report.md");
const ownerSampleGateIntake = JSON.parse(await readRequired("data/owner_sample_gate_intake_status.json"));
const ownerSampleGateIntakeReport = await readRequired("owner_sample_gate_intake.md");
const ownerSampleGateIntakeFixture = JSON.parse(await readRequired("data/owner_sample_gate_intake_fixture_status.json"));
const ownerSampleGateIntakeFixtureReport = await readRequired("owner_sample_gate_intake_fixture_report.md");
const ownerNextAction = JSON.parse(await readRequired("owner_next_action.json"));
const ownerNextActionStatus = JSON.parse(await readRequired("data/owner_next_action_status.json"));
const ownerNextActionReport = await readRequired("owner_next_action.md");
const northStarOutcomePreflight = JSON.parse(await readRequired("north_star_outcome_preflight.json"));
const northStarOutcomePreflightStatus = JSON.parse(await readRequired("data/north_star_outcome_preflight_status.json"));
const northStarOutcomePreflightReport = await readRequired("north_star_outcome_preflight.md");
const northStarOutcomeFormHtml = await readRequired("north_star_outcome_form.html");
const northStarOutcomeFormStatus = JSON.parse(await readRequired("data/north_star_outcome_form_status.json"));
const northStarOutcomeFormFixture = JSON.parse(await readRequired("data/north_star_outcome_form_fixture_status.json"));
const northStarOutcomeFormFixtureReport = await readRequired("north_star_outcome_form_fixture_report.md");
const ownerP1OutcomeIntake = JSON.parse(await readRequired("owner_p1_outcome_intake.json"));
const ownerP1OutcomeIntakeStatus = JSON.parse(await readRequired("data/owner_p1_outcome_intake_status.json"));
const ownerP1OutcomeIntakeReport = await readRequired("owner_p1_outcome_intake.md");
const ownerP1OutcomeIntakeFixture = JSON.parse(await readRequired("data/owner_p1_outcome_intake_fixture_status.json"));
const ownerP1OutcomeIntakeFixtureReport = await readRequired("owner_p1_outcome_intake_fixture_report.md");
const ownerP1OutcomePostfillCheck = JSON.parse(await readRequired("owner_p1_outcome_postfill_check.json"));
const ownerP1OutcomePostfillCheckStatus = JSON.parse(await readRequired("data/owner_p1_outcome_postfill_check_status.json"));
const ownerP1OutcomePostfillCheckReport = await readRequired("owner_p1_outcome_postfill_check.md");
const ownerP1OutcomePostfillCheckCommand = await readRequired("RUN-P1-OUTCOME-POST-FILL-CHECK.command");
const sampleGateRecovery = JSON.parse(await readRequired("sample_gate_recovery_pack.json"));
const sampleGateRecoveryStatus = JSON.parse(await readRequired("data/sample_gate_recovery_pack_status.json"));
const sampleGateRecoveryReport = await readRequired("sample_gate_recovery_pack.md");
const sampleGateBatchHandoff = JSON.parse(await readRequired("sample_gate_batch_handoff.json"));
const sampleGateBatchHandoffStatus = JSON.parse(await readRequired("data/sample_gate_batch_handoff_status.json"));
const sampleGateBatchHandoffReport = await readRequired("sample_gate_batch_handoff.md");
const sampleGateBatchPreflight = JSON.parse(await readRequired("sample_gate_batch_preflight.json"));
const sampleGateBatchPreflightStatus = JSON.parse(await readRequired("data/sample_gate_batch_preflight_status.json"));
const sampleGateBatchPreflightReport = await readRequired("sample_gate_batch_preflight.md");
const sampleGateBatch1PasteBlock = await readRequired("sample_gate_batch_1_paste_block.txt");
const sampleGateBatch2PasteBlock = await readRequired("sample_gate_batch_2_paste_block.txt");
const ownerSampleCountHandoff = JSON.parse(await readRequired("owner_sample_count_handoff.json"));
const ownerSampleCountHandoffStatus = JSON.parse(await readRequired("data/owner_sample_count_handoff_status.json"));
const ownerSampleCountHandoffReport = await readRequired("owner_sample_count_handoff.md");
const ownerSampleCountPasteBlock = await readRequired("owner_sample_count_paste_block.txt");
const ownerP0Now = JSON.parse(await readRequired("owner_p0_now.json"));
const ownerP0NowStatus = JSON.parse(await readRequired("data/owner_p0_now_status.json"));
const ownerP0NowReport = await readRequired("owner_p0_now.md");
const ownerP0NowHtml = await readRequired("owner_p0_now.html");
const sampleGateCollectionSprint = JSON.parse(await readRequired("sample_gate_collection_sprint.json"));
const sampleGateCollectionSprintStatus = JSON.parse(await readRequired("data/sample_gate_collection_sprint_status.json"));
const sampleGateCollectionSprintReport = await readRequired("sample_gate_collection_sprint.md");
const ownerP0LauncherReport = await readRequired("owner_p0_launcher.md");
const ownerP0LauncherCommand = await readRequired("OPEN-P0-SAMPLE-GATE.command");
const ownerP0LauncherStatus = JSON.parse(await readRequired("data/owner_p0_launcher_status.json"));
const ownerSampleCountRecovery = JSON.parse(await readRequired("owner_sample_count_recovery.json"));
const ownerSampleCountRecoveryStatus = JSON.parse(await readRequired("data/owner_sample_count_recovery_status.json"));
const ownerSampleCountRecoveryReport = await readRequired("owner_sample_count_recovery.md");
const ownerP0PostfillCheck = JSON.parse(await readRequired("owner_p0_postfill_check.json"));
const ownerP0PostfillCheckStatus = JSON.parse(await readRequired("data/owner_p0_postfill_check_status.json"));
const ownerP0PostfillCheckReport = await readRequired("owner_p0_postfill_check.md");
const ownerP0PostfillCheckCommand = await readRequired("RUN-P0-POST-FILL-CHECK.command");
const ownerSampleCountRecoveryFixture = JSON.parse(await readRequired("data/owner_sample_count_recovery_fixture_status.json"));
const ownerSampleCountRecoveryFixtureReport = await readRequired("owner_sample_count_recovery_fixture_report.md");
const ownerNextActionFixture = JSON.parse(await readRequired("data/owner_next_action_fixture_status.json"));
const ownerNextActionFixtureReport = await readRequired("owner_next_action_fixture_report.md");
const ownerActionLauncherReport = await readRequired("owner_action_launcher.md");
const ownerActionLauncherCommand = await readRequired("OPEN-3Q-GROWTH-LOOP.command");
const ownerActionLauncherStatus = JSON.parse(await readRequired("data/owner_action_launcher_status.json"));
const ownerSampleGateFixtures = JSON.parse(await readRequired("data/owner_sample_gate_fixture_status.json"));
const ownerSampleGateFixtureReport = await readRequired("owner_sample_gate_fixture_report.md");
const ownerQualityReview = JSON.parse(await readRequired("data/owner_quality_review_status.json"));
const ownerQualityReviewMd = await readRequired("owner_quality_review.md");
const ownerQualityReviewExample = JSON.parse(await readRequired("owner_quality_review.example.json"));
const ownerQualityReviewFormHtml = await readRequired("owner_quality_review_form.html");
const ownerQualityReviewForm = JSON.parse(await readRequired("data/owner_quality_review_form_status.json"));
const ownerQualityReviewFormFixture = JSON.parse(await readRequired("data/owner_quality_review_form_fixture_status.json"));
const ownerQualityReviewFormFixtureReport = await readRequired("owner_quality_review_form_fixture_report.md");
const ownerQualityReviewFixture = JSON.parse(await readRequired("data/owner_quality_review_fixture_status.json"));
const ownerQualityReviewFixtureReport = await readRequired("owner_quality_review_fixture_report.md");
const sampleGatePlan = JSON.parse(await readRequired("sample_gate_collection_plan.json"));
const sampleGatePlanMd = await readRequired("sample_gate_collection_plan.md");
const sampleGateStatus = JSON.parse(await readRequired("data/sample_gate_collection_plan_status.json"));
const iterationHistory = JSON.parse(await readRequired("iteration_history.json"));
const iterationHistoryMd = await readRequired("iteration_history.md");
const manualConversion = JSON.parse(await readRequired("data/manual_conversion_status.json"));
const lineInbound = JSON.parse(await readRequired("data/line_inbound_fixture_status.json"));
const lineInboundPlaybookJson = JSON.parse(await readRequired("line_inbound_playbook.json"));
const manualPublishPacket = JSON.parse(await readRequired("manual_publish_packet.json"));
const manualPublishPacketStatus = JSON.parse(await readRequired("data/manual_publish_packet_status.json"));
const manualPublishCapturePlan = JSON.parse(await readRequired("manual_publish_capture_plan.json"));
const manualPublishCapturePlanStatus = JSON.parse(await readRequired("data/manual_publish_capture_plan_status.json"));
const manualPublishBrief = JSON.parse(await readRequired("manual_publish_brief.json"));
const manualPublishBriefStatus = JSON.parse(await readRequired("data/manual_publish_brief_status.json"));
const publicTrackingUrlPack = JSON.parse(await readRequired("public_tracking_url_pack.json"));
const publicTrackingUrlPackStatus = JSON.parse(await readRequired("data/public_tracking_url_pack_status.json"));
const ownerPublicUrlApprovalPreview = JSON.parse(await readRequired("owner_public_url_approval_preview.json"));
const ownerPublicUrlApprovalPreviewStatus = JSON.parse(await readRequired("data/owner_public_url_approval_preview_status.json"));
const manualPublishEvidenceExample = JSON.parse(await readRequired("manual_publish_evidence.example.json"));
const manualPublishEvidenceStatus = JSON.parse(await readRequired("data/manual_publish_evidence_status.json"));
const manualPublishEvidenceFormHtml = await readRequired("manual_publish_evidence_form.html");
const manualPublishEvidenceFormStatus = JSON.parse(await readRequired("data/manual_publish_evidence_form_status.json"));
const manualPublishEvidenceFormFixtures = JSON.parse(await readRequired("data/manual_publish_evidence_form_fixture_status.json"));
const manualPublishEvidenceFixtures = JSON.parse(await readRequired("data/manual_publish_evidence_fixture_status.json"));
const variableRotation = JSON.parse(await readRequired("data/variable_rotation_fixture_status.json"));
const workerDryRunMd = await readRequired("worker_dry_run.md");
const workerDryRun = JSON.parse(await readRequired("data/worker_dry_run_status.json"));
const browserSmoke = JSON.parse(await readRequired("data/browser_smoke_status.json"));
const trackingLinkSmoke = JSON.parse(await readRequired("data/tracking_link_smoke_status.json"));
const trackingLinkSmokeMd = await readRequired("tracking_link_smoke.md");
const eventContractSmoke = JSON.parse(await readRequired("data/event_contract_smoke_status.json"));
const winRuleFixture = JSON.parse(await readRequired("data/win_rule_fixture_status.json"));
const decisionReplay = JSON.parse(await readRequired("data/real_data_decision_replay_status.json"));
const championContractAudit = JSON.parse(await readRequired("data/champion_contract_audit_status.json"));
const championContractAuditMd = await readRequired("champion_contract_audit.md");
const championIntegrationConfig = JSON.parse(await readRequired("integrations/3q-site/champion-integration.config.json"));
const championIntegrationBuildSource = await readRequired("scripts/build-champion-integration-candidate.mjs");
const championDeploymentWorkflow = await readFile(path.join(championIntegrationConfig.local_release_worktree, championIntegrationConfig.deployment_workflow_path), "utf8");
const championIntegrationWrangler = await readRequired("integrations/3q-site/wrangler.jsonc");
const championIntegrationSourceSnapshot = await readRequired("integrations/3q-site/source/worker.origin-main.js");
const championIntegrationWorker = await readRequired("integrations/3q-site/generated/worker.candidate.js");
const championIntegrationPatch = await readRequired("integrations/3q-site/generated/worker.candidate.patch");
const championIntegrationReport = await readRequired("champion_integration_candidate.md");
const championIntegrationCandidate = JSON.parse(await readRequired("data/champion_integration_candidate_status.json"));
const championSourceLockFixtures = JSON.parse(await readRequired("data/champion_source_lock_fixture_status.json"));
const championIntegrationSmokeReport = await readRequired("champion_integration_smoke.md");
const championIntegrationSmoke = JSON.parse(await readRequired("data/champion_integration_smoke_status.json"));
const cloudflareD1ReadinessSource = await readRequired("scripts/cloudflare-d1-readiness.mjs");
const cloudflareD1ReadinessReport = await readRequired("cloudflare_d1_readiness.md");
const cloudflareD1Readiness = JSON.parse(await readRequired("data/cloudflare_d1_readiness_status.json"));
const cloudflareD1Inventory = JSON.parse(await readRequired("data/cloudflare_d1_inventory_snapshot.json"));
const cloudflareD1SchemaObservation = JSON.parse(await readRequired("data/cloudflare_d1_schema_observation.json"));
const cloudflareD1SchemaObservationMd = await readRequired("cloudflare_d1_schema_observation.md");
const liveTelemetryReadinessSource = await readRequired("scripts/live-telemetry-readiness.mjs");
const liveTelemetryReadinessReport = await readRequired("live_telemetry_readiness.md");
const liveTelemetryReadiness = JSON.parse(await readRequired("data/live_telemetry_readiness_status.json"));
const candidateNeedsSecurityUpdate = liveTelemetryReadiness.candidate_worker?.operation_mode === "deploy_candidate_worker_security_update"
  && liveTelemetryReadiness.candidate_worker?.deploy_required === true;
const candidateNeedsProvenanceConfirmation = liveTelemetryReadiness.candidate_worker?.operation_mode === "verify_existing_candidate_deployment"
  && liveTelemetryReadiness.candidate_worker?.deploy_required === false;
const liveTelemetryObservation = JSON.parse(await readRequired("data/live_telemetry_observation_snapshot.json"));
const liveTelemetryReadinessFixturesSource = await readRequired("scripts/live-telemetry-readiness-fixtures.mjs");
const liveTelemetryReadinessFixtureReport = await readRequired("live_telemetry_readiness_fixture_report.md");
const liveTelemetryReadinessFixtures = JSON.parse(await readRequired("data/live_telemetry_readiness_fixture_status.json"));
const d1SchemaContractSource = await readRequired("scripts/d1-schema-contract.mjs");
const d1SchemaContractReport = await readRequired("d1_schema_contract.md");
const d1SchemaContract = JSON.parse(await readRequired("data/d1_schema_contract_status.json"));
const approvedD1ConfigSource = await readRequired("scripts/approved-d1-config.mjs");
const approvedD1ConfigReport = await readRequired("approved_d1_config.md");
const approvedD1Config = JSON.parse(await readRequired("data/approved_d1_config_status.json"));
const championLocalBranchSource = await readRequired("scripts/champion-local-branch.mjs");
const championLocalBranchReport = await readRequired("champion_local_branch.md");
const championLocalBranch = JSON.parse(await readRequired("data/champion_local_branch_status.json"));
const championReleasePreflightSource = await readRequired("scripts/champion-release-preflight.mjs");
const championReleasePreflightReport = await readRequired("champion_release_preflight.md");
const championReleasePreflight = JSON.parse(await readRequired("data/champion_release_preflight_status.json"));
const championLiveDeploymentSnapshot = JSON.parse(await readRequired("data/champion_live_deployment_snapshot.json"));
const championReleaseOwnerPacketMd = await readRequired("champion_release_owner_packet.md");
const championReleaseOwnerPacket = JSON.parse(await readRequired("champion_release_owner_packet.json"));
const championGithubHandoffSource = await readRequired("scripts/champion-github-handoff.mjs");
const championGithubHandoffMd = await readRequired("champion_github_handoff.md");
const championGithubPrBody = await readRequired("champion_github_pr_body.md");
const championGithubHandoff = JSON.parse(await readRequired("data/champion_github_handoff_status.json"));
const ownerConsoleStatus = JSON.parse(await readRequired("data/owner_console_status.json"));
const ownerConsoleSmoke = JSON.parse(await readRequired("data/owner_console_smoke_status.json"));
const weekArchive = JSON.parse(await readRequired("data/week_archive_status.json"));
const retirement = JSON.parse(await readRequired("candidate_retirement_queue.json"));
const retirementFixture = JSON.parse(await readRequired("data/candidate_retirement_fixture_status.json"));
const retirementFixtureReport = await readRequired("candidate_retirement_fixture_report.md");
const launchReadiness = JSON.parse(await readRequired("launch_readiness.json"));
const approvalResumeStatus = JSON.parse(await readRequired("data/approval_resume_status.json"));
const ownerApprovalFormHtml = await readRequired("owner_approval_form.html");
const ownerApprovalFormStatus = JSON.parse(await readRequired("data/owner_approval_form_status.json"));
const ownerApprovalFormFixture = JSON.parse(await readRequired("data/owner_approval_form_fixture_status.json"));
const ownerApprovalFormFixtureReport = await readRequired("owner_approval_form_fixture_report.md");
const ownerGateEvidence = JSON.parse(await readRequired("data/owner_gate_evidence_status.json"));
const ownerGateEvidenceMd = await readRequired("owner_gate_evidence.md");
const ownerGateEvidenceExample = JSON.parse(await readRequired("owner_gate_evidence.example.json"));
const ownerGateEvidenceFixture = JSON.parse(await readRequired("data/owner_gate_evidence_fixture_status.json"));
const ownerGateEvidenceFixtureReport = await readRequired("owner_gate_evidence_fixture_report.md");
const postGateVerification = JSON.parse(await readRequired("data/post_gate_verification_status.json"));
const postGateVerificationMd = await readRequired("post_gate_verification.md");
const postGateVerificationFixture = JSON.parse(await readRequired("data/post_gate_verification_fixture_status.json"));
const postGateVerificationFixtureReport = await readRequired("post_gate_verification_fixture_report.md");
const d1EvidenceGate = ownerGateEvidence.gates?.find((gate) => gate.gate_id === "remote_d1_create_and_migrate");
const candidateEvidenceGate = ownerGateEvidence.gates?.find((gate) => gate.gate_id === "candidate_worker_production_deploy");
const d1PostGate = postGateVerification.gates?.find((gate) => gate.gate_id === "remote_d1_create_and_migrate");
const candidatePostGate = postGateVerification.gates?.find((gate) => gate.gate_id === "candidate_worker_production_deploy");
const expectedLiveIngestProven = d1EvidenceGate?.evidence_valid === true
  && candidateEvidenceGate?.evidence_valid === true
  && d1PostGate?.post_gate_verification_ready === true
  && candidatePostGate?.post_gate_verification_ready === true;
const expectedWeeklyAggregateReadAuthorized = expectedLiveIngestProven
  && d1EvidenceGate?.recurring_aggregate_read_approved === true;
const gateReadiness = JSON.parse(await readRequired("data/gate_readiness_status.json"));
const gateReadinessMd = await readRequired("gate_readiness.md");
const redlinePriority = JSON.parse(await readRequired("redline_priority.json"));
const redlinePriorityStatus = JSON.parse(await readRequired("data/redline_priority_status.json"));
const redlinePriorityMd = await readRequired("redline_priority.md");
const approvalResumeFixture = JSON.parse(await readRequired("data/approval_resume_fixture_status.json"));
const manualCsv = await readRequired("data/manual_conversions.example.csv");
const funnelAggregateCsv = await readRequired("data/funnel_aggregates.example.csv");
const approvalInputExample = JSON.parse(await readRequired("owner_approval_input.example.json"));
const funnelAggregatePreviewRaw = await readRequired("data/funnel_aggregates.preview.jsonl");
const manualPreviewRaw = await readRequired("data/manual_conversions.preview.jsonl");
const launchdPlist = await readRequired("launchd/com.angelia.3q-growth-loop.weekly.plist");
const report = await readRequired("weekly_report.md");
const audit = await readRequired("goal_completion_audit.md");
const completionAuditStatus = JSON.parse(await readRequired("data/goal_completion_audit_status.json"));
const objectiveAuditMd = await readRequired("objective_sequence_audit.md");
const objectiveAudit = JSON.parse(await readRequired("objective_sequence_audit.json"));
const objectiveAuditStatus = JSON.parse(await readRequired("data/objective_sequence_audit_status.json"));
const nextRoundPlanMd = await readRequired("next_round_plan.md");
const githubWorkflow = await readRequired(".github/workflows/3q-growth-loop-weekly.yml");
const githubWorkflowGuardMd = await readRequired("github_workflow_guard.md");
const githubWorkflowGuard = JSON.parse(await readRequired("github_workflow_guard.json"));
const githubWorkflowGuardStatus = JSON.parse(await readRequired("data/github_workflow_guard_status.json"));
const githubHandoff = await readRequired("github_handoff.md");
const githubExportReport = await readRequired("github_export_manifest.md");
const githubExport = JSON.parse(await readRequired("data/github_export_status.json"));
const artifactRetentionReport = await readRequired("artifact_retention.md");
const artifactRetention = JSON.parse(await readRequired("data/artifact_retention_status.json"));
const artifactRetentionReviewReport = await readRequired("artifact_retention_review_pack.md");
const artifactRetentionReview = JSON.parse(await readRequired("artifact_retention_review_pack.json"));
const artifactRetentionReviewStatus = JSON.parse(await readRequired("data/artifact_retention_review_status.json"));
const ownerApprovalPack = await readRequired("owner_approval_pack.md");
const approvalResumePlan = await readRequired("approval_resume_plan.md");
const winRuleFixtureReport = await readRequired("win_rule_fixture_report.md");
const decisionReplayReport = await readRequired("real_data_decision_replay_report.md");
const funnelAggregateFixtureReport = await readRequired("funnel_aggregate_fixture_report.md");
const realDataApplyFixtureReport = await readRequired("real_data_apply_fixture_report.md");
const approvalResumeFixtureReport = await readRequired("approval_resume_fixture_report.md");
const lineInboundPlaybookMd = await readRequired("line_inbound_playbook.md");
const lineInboundFixtureReport = await readRequired("line_inbound_fixture_report.md");
const manualPublishPacketMd = await readRequired("manual_publish_packet.md");
const manualPublishCapturePlanMd = await readRequired("manual_publish_capture_plan.md");
const manualPublishBriefMd = await readRequired("manual_publish_brief.md");
const publicTrackingUrlPackMd = await readRequired("public_tracking_url_pack.md");
const ownerPublicUrlApprovalPreviewMd = await readRequired("owner_public_url_approval_preview.md");
const manualPublishEvidenceMd = await readRequired("manual_publish_evidence.md");
const manualPublishEvidenceFormFixtureReport = await readRequired("manual_publish_evidence_form_fixture_report.md");
const manualPublishEvidenceFixtureReport = await readRequired("manual_publish_evidence_fixture_report.md");
const variableRotationReport = await readRequired("variable_rotation_fixture_report.md");
const ownerConsoleHtml = await readRequired("owner_console.html");
const schemaSql = await readRequired("schema/d1-week0.sql");
const packageJson = JSON.parse(await readRequired("package.json"));
const weeklyRunnerSource = await readRequired("scripts/weekly-runner.mjs");
const collectD1AutoSource = await readRequired("scripts/collect-d1-auto.mjs");
const exportD1RawSource = await readRequired("scripts/export-d1-events.mjs");
const exportD1AggregateSource = await readRequired("scripts/export-d1-aggregate-events.mjs");
const d1CollectionModeFixturesSource = await readRequired("scripts/d1-collection-mode-fixtures.mjs");
const d1AggregateExportFixturesSource = await readRequired("scripts/d1-aggregate-export-fixtures.mjs");
const sourceTrustMatrixSource = await readRequired("scripts/source-trust-matrix.mjs");
const githubWorkflowGuardSource = await readRequired("scripts/github-workflow-guard.mjs");
const githubExportBundleSource = await readRequired("scripts/github-export-bundle.mjs");
const sampleGateRecoverySource = await readRequired("scripts/sample-gate-recovery-pack.mjs");
const sampleGateBatchHandoffSource = await readRequired("scripts/sample-gate-batch-handoff.mjs");
const sampleGateBatchPreflightSource = await readRequired("scripts/sample-gate-batch-preflight.mjs");
const northStarOutcomePreflightSource = await readRequired("scripts/north-star-outcome-preflight.mjs");
const northStarOutcomeFormSource = await readRequired("scripts/north-star-outcome-form.mjs");
const northStarOutcomeFormFixturesSource = await readRequired("scripts/north-star-outcome-form-fixtures.mjs");
const ownerP1OutcomeIntakeSource = await readRequired("scripts/owner-p1-outcome-intake.mjs");
const ownerP1OutcomeIntakeFixturesSource = await readRequired("scripts/owner-p1-outcome-intake-fixtures.mjs");
const ownerP1OutcomePostfillCheckSource = await readRequired("scripts/owner-p1-outcome-postfill-check.mjs");
const ownerSampleCountHandoffSource = await readRequired("scripts/owner-sample-count-handoff.mjs");
const ownerP0NowSource = await readRequired("scripts/owner-p0-now.mjs");
const sampleGateCollectionSprintSource = await readRequired("scripts/sample-gate-collection-sprint.mjs");
const ownerP0LauncherSource = await readRequired("scripts/owner-p0-launcher.mjs");
const ownerSampleCountRecoverySource = await readRequired("scripts/owner-sample-count-recovery.mjs");
const ownerP0PostfillCheckSource = await readRequired("scripts/owner-p0-postfill-check.mjs");
const ownerSampleCountRecoveryFixturesSource = await readRequired("scripts/owner-sample-count-recovery-fixtures.mjs");
const p0CountsPreflightSource = await readRequired("scripts/p0-counts-preflight.mjs");
const p0CountsPreflightFixturesSource = await readRequired("scripts/p0-counts-preflight-fixtures.mjs");
const ownerActionLauncherSource = await readRequired("scripts/owner-action-launcher.mjs");
const ownerApprovalFormSource = await readRequired("scripts/owner-approval-form.mjs");
const ownerApprovalFormFixturesSource = await readRequired("scripts/owner-approval-form-fixtures.mjs");
const growthLoopSource = await readRequired("scripts/growth-loop.mjs");
const lineInboundPlaybookSource = await readRequired("scripts/line-inbound-playbook.mjs");
const manualPublishPacketSource = await readRequired("scripts/manual-publish-packet.mjs");
const manualPublishCapturePlanSource = await readRequired("scripts/manual-publish-capture-plan.mjs");
const manualPublishBriefSource = await readRequired("scripts/manual-publish-brief.mjs");
const publicTrackingUrlPackSource = await readRequired("scripts/public-tracking-url-pack.mjs");
const ownerPublicUrlApprovalPreviewSource = await readRequired("scripts/owner-public-url-approval-preview.mjs");
const manualPublishEvidenceSource = await readRequired("scripts/manual-publish-evidence.mjs");
const manualPublishEvidenceFormSource = await readRequired("scripts/manual-publish-evidence-form.mjs");
const manualPublishEvidenceFormFixturesSource = await readRequired("scripts/manual-publish-evidence-form-fixtures.mjs");
const manualPublishEvidenceFixturesSource = await readRequired("scripts/manual-publish-evidence-fixtures.mjs");
const artifactRetentionSource = await readRequired("scripts/artifact-retention-monitor.mjs");
const artifactRetentionReviewSource = await readRequired("scripts/artifact-retention-review-pack.mjs");
const archiveManifestPath = path.isAbsolute(weekArchive.manifest_path)
  ? weekArchive.manifest_path
  : path.join(ROOT, weekArchive.manifest_path);
const archiveManifest = JSON.parse(await readFile(archiveManifestPath, "utf8"));
const manualPreviewEvents = manualPreviewRaw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const funnelAggregatePreviewEvents = funnelAggregatePreviewRaw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line));

assert(scores.thresholds.min_visits === 100, "min_visits must stay 100");
assert(scores.thresholds.min_cta_clicks === 20, "min_cta_clicks must stay 20");
assert(scores.thresholds.min_line_adds === 5, "min_line_adds must stay 5");
assert(scores.thresholds.min_test_days === 3, "min_test_days must stay 3");
assert(scores.thresholds.preferred_test_days === 7, "preferred_test_days must stay 7");
assert(championContractAudit.ok === true, "champion contract audit must complete");
assert(championContractAudit.mode === "champion_contract_audit_read_only", "champion contract audit must stay read-only");
assert(championContractAudit.champion?.url === "https://3q-site.milk790.workers.dev/", "champion contract audit must verify the live 3Q URL");
assert(
  championContractAudit.observations?.misleading_success_state_detected === true
    ? championContractAudit.prepared_but_blocked?.action === "repair_or_remove_champion_contact_form_false_success"
    : championContractAudit.observations?.line_only_contact_detected === true && championContractAudit.prepared_but_blocked === null,
  "champion contract audit must either block a false-success state or verify the LINE-only replacement",
);
assert(championContractAudit.observations?.lead_capture_transport_detected === false, "champion contract audit must not treat local UI success as lead transport");
assert(championContractAudit.scoring_policy?.worker_invocations_scoring_eligible === false, "Worker invocations must not be scored as visits");
assert(championContractAudit.scoring_policy?.champion_form_submission_scoring_eligible === false, "Champion browser UI must remain ineligible for lead scoring");
assert(championContractAudit.customer_data_read_performed === false && championContractAudit.external_effect === false, "champion contract audit must not read customer data or cause external effects");
assert(championContractAuditMd.includes("Safe to count form success as lead: no"), "champion contract report must state the lead-counting rule");
assert(championIntegrationCandidate.ok === true, "champion integration candidate must build successfully");
assert(championIntegrationCandidate.mode === "champion_integration_candidate_local_only", "champion integration candidate must stay local-only");
assert(championIntegrationCandidate.source?.exact_source_lock_verified === true, "champion integration source lock must be exact");
assert(championIntegrationCandidate.source?.lock_commit_is_ancestor === true, "champion integration current ref must descend from the locked commit");
assert(championIntegrationCandidate.source?.ancestry_verified === true, "champion integration ancestry must be verified from a present repository");
assert(championIntegrationCandidate.source?.expected_lock_tuple_verified === true, "champion integration expected commit/path/blob/SHA tuple must be internally verified");
assert(championIntegrationCandidate.source?.ref_file_matches_lock === true, "champion integration target file must still match the locked blob and SHA-256");
assert(typeof championIntegrationCandidate.source?.observed_ref_commit === "string" && championIntegrationCandidate.source.observed_ref_commit.length === 40, "champion integration must record the observed source ref commit");
assert(championIntegrationCandidate.source?.mode === "git_ref_pinned", "champion integration source must use one pinned git commit; snapshot fallback is not release-ready");
assert(championSourceLockFixtures.ok === true && championSourceLockFixtures.mode === "isolated_local_champion_source_lock_fixtures", "champion source-lock fixture matrix must pass");
for (const id of ["exact_lock_passes", "descendant_with_same_target_passes", "annotated_ref_is_pinned_to_commit", "ref_advances_between_checks_with_same_target_passes", "blob_match_with_sha_mismatch_fails", "missing_repo_fallback_is_unverified_and_blocked", "descendant_target_drift_fails", "non_ancestor_with_same_target_fails"]) {
  assert(championSourceLockFixtures.cases?.some((item) => item.id === id && item.ok === true), `champion source-lock fixture must pass: ${id}`);
}
assert(championIntegrationBuildSource.includes("inspectChampionSourceLock") && championIntegrationBuildSource.includes("await writeFile(REPORT_PATH"), "candidate build must use the shared source guard and replace stale human reports on failure");
assert(championIntegrationCandidate.source?.commit === championIntegrationConfig.expected_commit, "champion integration commit must match locked config");
assert(championIntegrationCandidate.source?.blob_sha === championIntegrationConfig.expected_blob_sha, "champion integration blob must match locked config");
assert(championIntegrationCandidate.source?.sha256 === championIntegrationConfig.expected_sha256, "champion integration sha256 must match locked config");
assert(createHash("sha256").update(championIntegrationSourceSnapshot).digest("hex") === championIntegrationConfig.expected_sha256, "champion integration source snapshot must match locked SHA-256");
assert(Object.values(championIntegrationCandidate.checks ?? {}).every((value) => value === true), "all champion integration candidate checks must pass");
assert(championIntegrationCandidate.syntax_check?.ok === true && championIntegrationCandidate.worker_dry_run?.ok === true, "champion integration candidate syntax and dry run must pass");
assert(championIntegrationCandidate.privacy_contract?.customer_fields_collected === false, "champion integration candidate must not collect customer fields");
assert(championIntegrationCandidate.privacy_contract?.credentials_sent === false, "champion integration candidate must omit credentials");
assert(championIntegrationCandidate.privacy_contract?.line_add_inferred_from_click === false, "champion integration candidate must not infer LINE adds");
assert(championIntegrationCandidate.external_effect === false && championIntegrationCandidate.production_deploy_performed === false, "champion integration candidate must not deploy or cause external effects");
assert(championIntegrationWrangler.includes(`"GROWTH_LOOP_COLLECTOR_URL": "${championIntegrationConfig.collector_public_url}"`), "champion integration Wrangler config must expose the exact HTTPS collector URL binding");
assert(championIntegrationWorker.includes('data-growth-contact-mode="line-only"'), "champion integration worker must contain LINE-only mode");
assert(championIntegrationWorker.includes("credentials: 'omit'"), "champion integration telemetry must omit credentials");
assert(championIntegrationWorker.includes("3q_growth_loop_attribution_v1") && championIntegrationWorker.includes("const safeToken = (value)") && championIntegrationWorker.includes("const safeSessionId = (value)"), "champion integration telemetry must persist only sanitized attribution with UUID sessions");
assert(championIntegrationWorker.includes("configuredCollector === expectedCollector") && championIntegrationWorker.includes("collector_url_matches_expected"), "champion integration telemetry must fail closed unless the exact collector origin is configured");
assert(championIntegrationWorker.includes("containsPiiLike") && championIntegrationWorker.includes("phoneLikePattern") && championIntegrationWorker.includes("emailLikePattern"), "champion integration telemetry must reject embedded phone and email-like attribution");
assert(championIntegrationWorker.includes("replaceAll('<', '\\\\u003c')"), "champion collector literal must neutralize script-closing markup");
assert(championIntegrationWorker.includes("匿名瀏覽與 CTA 成效事件") && !championIntegrationWorker.includes("本頁不會自動送出任何資料"), "champion privacy disclosure must match automatic anonymous telemetry behavior");
assert(!championIntegrationWorker.includes("Math.random()"), "champion session ids must not use Math.random fallback");
assert(!championIntegrationWorker.includes("send('line_add')"), "champion integration telemetry must not infer line_add");
assert(
  championIntegrationPatch.includes("data-growth-contact-mode=\"line-only\"")
    || (championIntegrationPatch.startsWith("# No source diff:") && championIntegrationSourceSnapshot === championIntegrationWorker),
  "champion integration patch must contain the LINE-only repair or prove the locked source is already byte-identical",
);
assert(championIntegrationReport.includes("Nothing was deployed or pushed"), "champion integration report must preserve external gate wording");
assert(championIntegrationSmoke.ok === true, "champion integration smoke must pass");
assert(championIntegrationSmoke.mode === "isolated_local_champion_integration_smoke", "champion integration smoke must stay isolated and local");
assert(Object.values(championIntegrationSmoke.page_contract?.checks ?? {}).every((value) => value === true), "champion integration page contract checks must pass");
assert(championIntegrationSmoke.cors_contract?.ok === true && championIntegrationSmoke.cors_contract?.allow_origin === championIntegrationSmoke.champion_url, "champion integration CORS must allow only the local candidate origin");
assert(championIntegrationSmoke.database_contract?.allowed_page_view_rows === 1, "champion integration smoke must write one isolated page_view");
assert(championIntegrationSmoke.database_contract?.allowed_cta_click_rows === 1, "champion integration smoke must write one isolated cta_click");
assert(championIntegrationSmoke.database_contract?.denied_origin_rows === 0, "denied champion integration origin must write zero rows");
assert(championIntegrationSmoke.database_contract?.line_add_rows === 0, "champion integration smoke must not infer line_add");
assert(championIntegrationSmoke.database_contract?.sensitive_rows === 0, "champion integration smoke must write zero sensitive rows");
assert(championIntegrationSmoke.denied_write?.status === 403 && championIntegrationSmoke.denied_write?.body?.error === "origin_not_allowed", "champion integration smoke must reject denied origins");
assert(championIntegrationSmoke.missing_origin_write?.status === 403 && championIntegrationSmoke.missing_origin_write?.body?.error === "origin_not_allowed", "champion integration smoke must reject missing Origin headers");
assert(championIntegrationSmoke.sensitive_write?.status === 400 && championIntegrationSmoke.sensitive_write?.body?.error === "blocked_metadata_key", "champion integration smoke must reject sensitive metadata");
assert(championIntegrationSmoke.sensitive_token_write?.status === 400 && championIntegrationSmoke.sensitive_token_write?.body?.error === "invalid_session_id", "champion integration smoke must reject top-level PII-like tokens");
assert(championIntegrationSmoke.embedded_phone_write?.status === 400 && championIntegrationSmoke.embedded_phone_write?.body?.error === "invalid_campaign", "champion integration smoke must reject embedded phone-like campaign values");
assert(championIntegrationSmoke.url_path_pii_write?.status === 400 && championIntegrationSmoke.url_path_pii_write?.body?.error === "invalid_url", "champion integration smoke must reject encoded PII in URL paths");
assert(championIntegrationSmoke.page_contract?.checks?.foreign_phone_campaign_rejected === true, "champion integration smoke must reject non-Taiwan phone-like campaign attribution");
assert(championIntegrationSmoke.blocked_conversion_write?.status === 400 && championIntegrationSmoke.blocked_conversion_write?.body?.error === "event_type_not_allowed_public", "champion integration smoke must reject conversion events from public ingest");
assert(championIntegrationSmoke.wrong_binding_contract?.ok === true, "champion integration must fail closed for a non-exact collector binding");
assertNoRedLineFlags(championIntegrationSmoke, "champion integration smoke");
assert(championIntegrationSmokeReport.includes("Production deploy and public-link changes remain owner approval gates"), "champion integration smoke report must preserve owner gates");
assert(cloudflareD1Readiness.ok === true && cloudflareD1Readiness.mode === "cloudflare_d1_metadata_readiness", "Cloudflare D1 readiness monitor must pass");
assert(cloudflareD1Readiness.expected?.database_name === "3q-growth-loop-candidate", "D1 readiness must target the dedicated Growth Loop database");
assert(cloudflareD1Readiness.inventory?.snapshot_checked_at === cloudflareD1Inventory.checked_at, "D1 readiness must use the recorded metadata snapshot");
assert(cloudflareD1Readiness.decision?.automatic_reuse_allowed === false && cloudflareD1Readiness.decision?.crm_database_reuse_allowed === false, "D1 readiness must never auto-reuse existing CRM databases");
assert(cloudflareD1Readiness.decision?.inventory_table_count_authoritative === false && cloudflareD1Readiness.decision?.schema_absence_inferred_from_inventory === false, "D1 readiness must never treat inventory num_tables as authoritative schema evidence");
assert(cloudflareD1Readiness.remote_table_query_performed === false && cloudflareD1Readiness.customer_data_read_performed === false, "D1 readiness must not query tables or read customer data");
assert(cloudflareD1Readiness.resource_create_performed === false && cloudflareD1Readiness.remote_schema_migration_performed === false, "D1 readiness must not create or migrate resources");
assert(cloudflareD1Inventory.mode === "read_only_cloudflare_d1_inventory" && cloudflareD1Inventory.external_effect === false, "D1 inventory snapshot must be read-only");
assert(cloudflareD1ReadinessSource.includes('["d1", "list", "--json"]'), "D1 readiness must use metadata-only wrangler d1 list");
assert(!cloudflareD1ReadinessSource.includes('"d1", "execute"'), "D1 readiness must never execute remote SQL");
assert(cloudflareD1ReadinessReport.includes("No D1 database was created, bound, migrated, queried, or deleted"), "D1 readiness report must preserve no-write guardrails");
assertNoRedLineFlags(cloudflareD1Readiness, "Cloudflare D1 readiness");
assert(cloudflareD1SchemaObservation.ok === true && cloudflareD1SchemaObservation.mode === "read_only_remote_d1_schema_observation", "remote D1 schema observation must be a passing read-only observation");
assert(cloudflareD1SchemaObservation.database?.name === "3q-growth-loop-candidate" && cloudflareD1SchemaObservation.database?.id === cloudflareD1Readiness.expected?.configured_database_id, "remote D1 schema observation must target the exact dedicated database");
assert(cloudflareD1SchemaObservation.schema?.expected_tables_exact === true && cloudflareD1SchemaObservation.schema?.expected_indexes_present === true, "remote D1 schema observation must prove the expected table and index contract");
assert(cloudflareD1SchemaObservation.seed?.assets_exact === true && cloudflareD1SchemaObservation.seed?.ab_test_exact === true, "remote D1 schema observation must prove the expected Week 0 seed contract");
assert(cloudflareD1SchemaObservation.privacy?.raw_event_rows_read_performed === false && cloudflareD1SchemaObservation.privacy?.customer_data_read_performed === false, "remote D1 schema observation must not read raw events or customer data");
assert(cloudflareD1SchemaObservation.external_effect === false && cloudflareD1SchemaObservation.rows_written === 0, "remote D1 schema observation must not write or cause an external effect");
assert(cloudflareD1SchemaObservationMd.includes("Remote D1 Schema Observation") && cloudflareD1SchemaObservationMd.includes("Raw event rows read: no"), "remote D1 schema observation report must disclose its read-only privacy boundary");

assert(liveTelemetryReadiness.ok === true && liveTelemetryReadiness.mode === "live_telemetry_chain_readiness", "live telemetry readiness monitor must pass");
assert(["candidate_worker_security_update_required", "live_chain_observed_owner_provenance_and_schema_evidence_required", "live_ingest_ready_recurring_read_not_approved", "live_ingest_and_weekly_aggregate_read_ready"].includes(liveTelemetryReadiness.status), "live telemetry readiness must expose a recognized Candidate state");
assert(liveTelemetryReadiness.snapshot_checked_at === liveTelemetryObservation.checked_at, "live telemetry readiness must use the sanitized observation snapshot");
assert(liveTelemetryReadiness.candidate_worker?.deployment_observed === true && liveTelemetryReadiness.candidate_worker?.health_ok === true && liveTelemetryReadiness.candidate_worker?.page_ok === true, "live telemetry readiness must observe a healthy existing Candidate deployment");
assert(candidateNeedsSecurityUpdate || candidateNeedsProvenanceConfirmation, "live Candidate must select either security update or existing-deployment provenance mode");
assert(liveTelemetryReadiness.candidate_worker?.expected_security_contract === "origin-pii-v2", "live Candidate must expose the expected origin/PII security contract");
assert(candidateNeedsSecurityUpdate
  ? liveTelemetryReadiness.candidate_worker?.security_contract_ok === false && liveTelemetryReadiness.candidate_worker?.redeploy_required === true
  : liveTelemetryReadiness.candidate_worker?.security_contract_ok === true && liveTelemetryReadiness.candidate_worker?.redeploy_required === false, "Candidate mode must match the observed security contract");
assert(liveTelemetryReadiness.champion?.collector_configured === true && liveTelemetryReadiness.champion?.collector_origin_matches === true, "Champion must be wired to the exact observed Candidate origin");
assert(liveTelemetryReadiness.champion?.privacy_event_contract_ok === true && liveTelemetryReadiness.champion?.line_add_marker === false, "Champion live telemetry must preserve no-inferred-line_add privacy contract");
assert(liveTelemetryReadiness.d1?.exact_target_ready === true, "live telemetry readiness must bind the exact dedicated D1 target");
assert(liveTelemetryReadiness.d1?.inventory_table_count_authoritative === false && liveTelemetryReadiness.d1?.schema_absence_inferred_from_inventory === false, "live telemetry readiness must treat inventory num_tables as non-authoritative");
assert(liveTelemetryReadiness.d1?.schema_evidence_valid === (d1EvidenceGate?.evidence_valid === true && d1PostGate?.post_gate_verification_ready === true), "schema readiness must mirror validated owner evidence and post-gate readiness");
assert(liveTelemetryReadiness.d1?.recurring_aggregate_read_approved === (d1EvidenceGate?.recurring_aggregate_read_approved === true), "recurring aggregate-read readiness must mirror the explicit owner-evidence scope");
assert(typeof liveTelemetryReadiness.decisions?.observed_live_chain_ready_for_owner_evidence === "boolean", "live telemetry must expose observed-chain readiness explicitly");
assert(liveTelemetryReadiness.decisions?.live_ingest_readiness_proven === expectedLiveIngestProven, "live ingest proof must require both D1 and Candidate owner evidence plus post-gate readiness");
assert(liveTelemetryReadiness.decisions?.weekly_aggregate_read_authorized === expectedWeeklyAggregateReadAuthorized, "weekly aggregate-read authorization must additionally require explicit recurring-read approval");
assert(liveTelemetryReadiness.remote_table_query_performed === false && liveTelemetryReadiness.raw_event_rows_read_performed === false && liveTelemetryReadiness.customer_data_read_performed === false, "live telemetry monitor must not query remote tables or read raw/customer rows");
assert(liveTelemetryReadiness.event_post_performed === false && liveTelemetryReadiness.data_lp_events_write_performed === false, "live telemetry monitor must not post events or write real events");
assert(liveTelemetryReadinessSource.includes('["deployments", "list", "--name", candidateConfig.name, "--json"]'), "live telemetry monitor must use read-only Candidate deployment metadata");
assert(liveTelemetryReadinessSource.includes('method: "GET"'), "live telemetry monitor public probes must use GET only");
assert(!liveTelemetryReadinessSource.includes('"d1", "execute"'), "live telemetry monitor must not execute D1 SQL");
assert(liveTelemetryReadinessReport.includes("Inventory-reported num_tables") && liveTelemetryReadinessReport.includes("not authoritative"), "live telemetry report must disclose non-authoritative D1 inventory metadata");
assertNoRedLineFlags(liveTelemetryObservation, "live telemetry observation snapshot");
assertNoRedLineFlags(liveTelemetryReadiness, "live telemetry readiness");

assert(liveTelemetryReadinessFixtures.ok === true && liveTelemetryReadinessFixtures.mode === "live_telemetry_readiness_fixture_dry_run", "live telemetry readiness fixtures must pass");
assert(liveTelemetryReadinessFixtures.scenario_count === 6, "live telemetry readiness fixtures must cover six chain states");
for (const expected of [
  "candidate_missing_requires_deploy_gate",
  "deployed_candidate_missing_security_contract_requires_update",
  "live_chain_observed_requires_owner_provenance_and_schema_evidence",
  "collector_origin_mismatch_blocks_chain",
  "schema_and_deployment_evidence_valid_recurring_read_false",
  "full_evidence_enables_weekly_aggregate_read_plan",
]) {
  assert(liveTelemetryReadinessFixtures.scenarios.some((scenario) => scenario.id === expected && scenario.ok === true), `live telemetry readiness fixture missing passing scenario ${expected}`);
}
const schemaWithoutRecurringFixture = liveTelemetryReadinessFixtures.scenarios.find((scenario) => scenario.id === "schema_and_deployment_evidence_valid_recurring_read_false");
assert(schemaWithoutRecurringFixture?.live_ingest_readiness_proven === true && schemaWithoutRecurringFixture?.weekly_aggregate_read_authorized === false, "valid schema/deployment evidence must not imply recurring-read approval");
const fullyApprovedTelemetryFixture = liveTelemetryReadinessFixtures.scenarios.find((scenario) => scenario.id === "full_evidence_enables_weekly_aggregate_read_plan");
assert(fullyApprovedTelemetryFixture?.weekly_aggregate_read_authorized === true, "full evidence fixture must enable only the weekly aggregate-read plan");
assert(liveTelemetryReadinessFixtures.scenarios.every((scenario) => scenario.inventory_table_count_authoritative === false && scenario.schema_absence_inferred_from_inventory === false), "all telemetry fixtures must reject num_tables schema inference");
assert(liveTelemetryReadinessFixtures.live_network_refresh_performed === false && liveTelemetryReadinessFixtures.remote_table_query_performed === false && liveTelemetryReadinessFixtures.event_post_performed === false, "telemetry fixtures must not use live network, table query, or event POST");
assert(liveTelemetryReadinessFixturesSource.includes("--snapshot") && liveTelemetryReadinessFixturesSource.includes("--status"), "telemetry fixtures must isolate snapshot and status paths");
assert(liveTelemetryReadinessFixtureReport.includes("Schema evidence and recurring aggregate-read authorization are independent"), "telemetry fixture report must document independent schema/read scopes");
assertNoRedLineFlags(liveTelemetryReadinessFixtures, "live telemetry readiness fixtures");
assert(packageJson.scripts["telemetry:readiness"] === "node scripts/live-telemetry-readiness.mjs", "package.json must expose cached live telemetry readiness");
assert(packageJson.scripts["telemetry:readiness:live"] === "node scripts/live-telemetry-readiness.mjs --refresh-live", "package.json must expose read-only live telemetry refresh");
assert(packageJson.scripts["telemetry:readiness:fixtures"] === "node scripts/live-telemetry-readiness-fixtures.mjs", "package.json must expose live telemetry readiness fixtures");
assert(packageJson.scripts.verify.includes("npm run telemetry:readiness:fixtures") && packageJson.scripts.verify.includes("npm run telemetry:readiness"), "verify chain must include live telemetry fixtures and cached evaluation");
assert(weeklyRunnerSource.includes('step: "live_telemetry_readiness"') && weeklyRunnerSource.includes('step: "live_telemetry_readiness_after_evidence"'), "weekly runner must refresh and re-evaluate live telemetry readiness");
assert(weeklyRunnerSource.includes('step: "live_telemetry_readiness_fixtures"'), "weekly runner must execute live telemetry readiness fixtures");
assert(weeklyRunnerSource.includes("mkdir(RUN_LOCK_PATH") && weeklyRunnerSource.includes('open(path.join(RUN_LOCK_PATH, RUN_LOCK_CLAIM_NAME), "wx"'), "weekly runner must use an atomic lock directory and exclusive recovery claim");
assert(weeklyRunnerSource.includes('status: "already_running"') && weeklyRunnerSource.includes("did not overwrite weekly_runner_status.json"), "overlapping weekly invocations must skip without overwriting authoritative status");
assert(weeklyRunnerSource.includes("existingRunLockDecision") && weeklyRunnerSource.includes("isProcessActive") && weeklyRunnerSource.includes("observeProcessIdentity"), "weekly runner lock must validate PID plus process identity with a fail-closed fallback");
assert(weeklyRunnerSource.includes("recoveryClaimDecision") && weeklyRunnerSource.includes("sameLockSnapshot"), "weekly runner recovery must compare the claimed lock before renaming it");
assert(weeklyRunnerLockFixtures.ok === true && weeklyRunnerLockFixtures.mode === "isolated_weekly_runner_lock_policy_fixtures", "weekly runner lock fixtures must pass");
assert(weeklyRunnerLockFixtures.cases?.some((item) => item.id === "active_owner_over_four_hours_is_never_recovered" && item.observed === "keep_active_owner" && item.ok === true), "active weekly owner must retain the lock beyond four hours");
assert(weeklyRunnerLockFixtures.cases?.some((item) => item.id === "dead_owner_is_recovered" && item.observed === "recover_stale_or_dead_owner" && item.ok === true), "dead weekly owner must be recoverable");
assert(weeklyRunnerLockFixtures.cases?.some((item) => item.id === "pid_reuse_identity_mismatch_is_recovered" && item.observed === "recover_pid_reused_owner" && item.ok === true), "PID reuse must not inherit weekly lock ownership");
assert(weeklyRunnerLockFixtures.cases?.some((item) => item.id === "two_recoverers_have_one_exclusive_claim" && item.observed === "one_recoverer_claimed" && item.ok === true), "two recoverers must serialize through one exclusive claim");
assert(weeklyRunnerLockFixtures.cases?.some((item) => item.id === "filesystem_recovery_race_preserves_replacement_owner" && item.observed === "replacement_owner_preserved" && item.ok === true), "stale recovery must preserve a replacement owner lock");
assert(weeklyRunnerLockFixtures.exclusive_recovery_claim_proven === true && weeklyRunnerLockFixtures.filesystem_replacement_owner_preserved === true && weeklyRunnerLockFixtures.pid_reuse_detected === true, "weekly lock fixture status must expose race and PID-reuse proof");
assert(weeklyRunnerSource.includes("releaseRunLock(runLock)"), "weekly runner must release its owned lock in a finally block");
assert(weeklyRunnerSource.includes("rename(temporaryPath, STATUS_PATH)"), "weekly runner status updates must use atomic replacement");
assert(weeklyRunnerStatus.commands.some((command) => command.step === "live_telemetry_readiness" && command.status === "success"), "weekly runner must record successful live telemetry refresh");
assert(weeklyRunnerStatus.commands.some((command) => command.step === "weekly_runner_lock_fixtures" && command.status === "success"), "weekly runner must execute the lock policy fixtures");
assert(weeklyRunnerStatus.commands.some((command) => command.step === "champion_source_lock_fixtures" && command.status === "success"), "weekly runner must execute the Champion source-lock fixture matrix");
assert(weeklyRunnerStatus.commands.some((command) => command.step === "live_telemetry_readiness_fixtures" && command.status === "success"), "weekly runner must record successful live telemetry fixtures");
assert(weeklyRunnerStatus.commands.some((command) => command.step === "live_telemetry_readiness_after_evidence" && command.status === "success"), "weekly runner must record successful post-evidence telemetry evaluation");

assert(d1SchemaContract.ok === true && d1SchemaContract.mode === "isolated_local_d1_schema_contract", "D1 schema contract must pass in isolated local mode");
assert(Object.values(d1SchemaContract.checks ?? {}).every((value) => value === true), "D1 schema contract checks must all pass");
assert(d1SchemaContract.schema_sha256 === createHash("sha256").update(schemaSql).digest("hex"), "D1 schema contract hash must match schema/d1-week0.sql");
assert(d1SchemaContract.checks?.migration_idempotent === true && d1SchemaContract.checks?.second_migration_apply_ok === true, "D1 schema migration must be safe to apply twice locally");
assert(d1SchemaContract.checks?.sqlite_integrity_ok === true && d1SchemaContract.checks?.foreign_key_check_clean === true, "D1 schema must pass integrity and foreign-key checks");
assert(d1SchemaContract.checks?.event_type_constraint_enforced === true && d1SchemaContract.checks?.asset_role_constraint_enforced === true && d1SchemaContract.checks?.foreign_key_constraint_enforced === true, "D1 schema must enforce event, role, and foreign-key constraints");
assert(d1SchemaContract.remote_d1_create_performed === false && d1SchemaContract.remote_d1_migration_performed === false && d1SchemaContract.remote_d1_query_performed === false, "D1 schema contract must never touch remote D1");
assert(d1SchemaContractSource.includes('"--local"') && !d1SchemaContractSource.includes('"--remote"'), "D1 schema contract must invoke Wrangler in local mode only");
assert(d1SchemaContractReport.includes("applied twice to a disposable local D1"), "D1 schema report must explain its idempotency proof");
assertNoRedLineFlags(d1SchemaContract, "D1 schema contract");

assert(approvedD1Config.ok === true && approvedD1Config.mode === "approved_d1_config_preview_local_only", "approved D1 config guard must default to preview mode");
assert(approvedD1Config.local_config_write_performed === false, "weekly approved D1 config preview must not write wrangler.jsonc");
assert(approvedD1Config.remote_d1_create_performed === false && approvedD1Config.remote_d1_migration_performed === false && approvedD1Config.remote_d1_query_performed === false, "approved D1 config guard must never execute remote D1 actions");
assert(approvedD1ConfigSource.includes('process.argv.includes("--apply")'), "approved D1 config mutation must require explicit --apply");
assert(approvedD1ConfigSource.includes("inventoryMatch"), "approved D1 config guard must require an exact live inventory match");
assert(approvedD1ConfigReport.includes("never creates, queries, migrates, or deletes a remote D1"), "approved D1 config report must preserve remote no-write policy");
assertNoRedLineFlags(approvedD1Config, "approved D1 config guard");
assertNoRedLineFlags(cloudflareD1Inventory, "Cloudflare D1 inventory snapshot");
assert(championLocalBranch.ok === true && championLocalBranch.mode === "champion_local_feature_branch_review", "Champion local feature branch must be review-ready");
const championIntegrationAlreadyMerged = championLocalBranch.status === "integration_already_merged_at_source_lock"
  && championLocalBranch.source_lock?.integration_already_merged === true;
assert(championIntegrationAlreadyMerged || championLocalBranch.status === "local_feature_commit_ready_owner_push_pr_gate", "Champion state must be either merged at the source lock or behind the owner push/PR gate");
assert(championLocalBranch.source_lock?.commit === championIntegrationConfig.expected_commit, "Champion local branch source lock must match config");
assert(championIntegrationAlreadyMerged || championLocalBranch.local_branch?.source_lock_base_commit === championIntegrationConfig.expected_commit, "Champion release stack must expose the locked source base");
assert(championIntegrationAlreadyMerged || championLocalBranch.local_branch?.worker_commit_parent === championIntegrationConfig.expected_commit, "Champion Worker commit parent must be the locked source commit");
assert(championIntegrationAlreadyMerged || championLocalBranch.local_branch?.changed_paths?.includes(championIntegrationConfig.source_path), "Champion release stack must include the Worker source");
assert(championIntegrationAlreadyMerged || championLocalBranch.local_branch?.changed_paths?.every((changedPath) => [championIntegrationConfig.source_path, championIntegrationConfig.deployment_workflow_path].includes(changedPath)), "Champion release stack must change only the Worker and deployment workflow");
assert(championIntegrationAlreadyMerged || (championLocalBranch.local_branch?.commit_count >= 1 && championLocalBranch.checks?.commit_stack_scoped === true), "Champion release stack must contain only individually scoped commits");
if (championLocalBranch.local_branch?.workflow_commit) {
  assert(championLocalBranch.local_branch.changed_paths.includes(championIntegrationConfig.deployment_workflow_path), "Champion workflow commit must include the configured deployment workflow path");
}
assert(championLocalBranch.local_branch?.candidate_sha256 === championLocalBranch.local_branch?.committed_source_sha256, "Champion local committed Worker must match generated candidate");
assert(Object.values(championLocalBranch.checks ?? {}).every((value) => value === true), "Champion local branch checks must all pass");
assert(["absent", "reviewed_ancestor_local_ahead", "up_to_date_with_local"].includes(championLocalBranch.remote_observation?.state), "Champion remote branch must be absent or a reviewed part of the local history");
if (!championIntegrationAlreadyMerged && championLocalBranch.remote_observation?.branch_present === true) {
  assert((championLocalBranch.local_branch.commits ?? []).some((item) => item.commit === championLocalBranch.remote_observation.commit), "Champion remote branch must point to a reviewed release-stack commit");
}
assert(championLocalBranch.git_push_performed === false && championLocalBranch.github_push_or_pr_performed === false, "Champion local branch preparation must not push or open a PR");
assert(championLocalBranchSource.includes('process.argv.includes("--prepare")'), "Champion local branch mutation must require explicit --prepare");
assert(championLocalBranchReport.includes("This audit performed no push, PR, deploy, public-link change, or external send"), "Champion local branch report must preserve run-scoped external gates");
assertNoRedLineFlags(championLocalBranch, "champion local branch");
assert(championIntegrationConfig.production_worker_name === "3q-site", "champion integration production worker name must be explicit");
assert(championIntegrationConfig.production_compatibility_date === "2024-12-01", "champion release compatibility date must match the observed live baseline");
assert(championIntegrationConfig.live_base_url === "https://3q-site.milk790.workers.dev", "champion live base URL must be explicit");
assert(championIntegrationConfig.deployment_workflow_path === ".github/workflows/deploy-3q-site.yml", "champion deployment workflow path must be explicit");
assert(championIntegrationConfig.collector_public_url === "https://3q-growth-loop-candidate.milk790.workers.dev", "champion collector public URL must be explicit");
assert(championDeploymentWorkflow.includes("${api}/settings") && championDeploymentWorkflow.includes("${api}/content"), "Champion deploy workflow must preflight settings and use Cloudflare content-only upload");
assert(championDeploymentWorkflow.includes("binding_fingerprint") && championDeploymentWorkflow.includes("REQUIRED_BINDING: GROWTH_LOOP_COLLECTOR_URL"), "Champion deploy workflow must fail closed when required or existing bindings drift");
assert(championDeploymentWorkflow.includes("verify_collector_security_contract") && championDeploymentWorkflow.includes('security_contract == "origin-pii-v2"'), "Champion deploy workflow must verify the collector security contract before and after content upload");
assert(championDeploymentWorkflow.includes(".text == $expected") && championDeploymentWorkflow.includes("collector_origin == $expected") && championDeploymentWorkflow.includes("collector_url_matches_expected == true"), "Champion deploy workflow must verify the exact collector binding and runtime origin");
assert(championDeploymentWorkflow.includes('growth-loop-telemetry-v2') && championDeploymentWorkflow.includes('/growth-loop/status') && championDeploymentWorkflow.includes('匿名瀏覽與 CTA 成效事件'), "Champion deploy workflow must verify build, collector wiring, and contact telemetry disclosure after deploy");
assert(!championDeploymentWorkflow.includes('/subdomain"') && !championDeploymentWorkflow.includes("--arg collector"), "Champion deploy workflow must not mutate subdomain or reconstruct a partial binding list");
assert(championReleasePreflight.ok === true, "champion release preflight must pass");
assert(championReleasePreflight.mode === "clean_archive_champion_release_preflight_local_only", "champion release preflight mode must stay local-only");
assert(championReleasePreflight.status === "prepared_but_blocked_production_prerequisites", "champion release preflight must stay production-blocked");
assert(championReleasePreflight.source?.mode === "git_ref_pinned", "champion release source must use one pinned git commit; snapshot fallback must block release");
assert(championReleasePreflight.source?.commit === championIntegrationConfig.expected_commit, "champion release source commit must match lock");
assert(championReleasePreflight.source?.lock_commit_is_ancestor === true, "champion release observed ref must descend from the locked commit");
assert(championReleasePreflight.source?.ancestry_verified === true, "champion release source ancestry must be verified");
assert(championReleasePreflight.source?.expected_lock_tuple_verified === true, "champion release expected commit/path/blob/SHA tuple must be verified");
assert(championReleasePreflight.source?.ref_file_matches_lock === true, "champion release observed target file must match the locked blob and SHA-256");
assert(typeof championReleasePreflight.source?.observed_ref_commit === "string" && championReleasePreflight.source.observed_ref_commit.length === 40, "champion release must record the observed source ref commit");
assert(championReleasePreflight.source?.blob_sha === championIntegrationConfig.expected_blob_sha, "champion release source blob must match lock");
assert(championReleasePreflight.source?.sha256 === championIntegrationConfig.expected_sha256, "champion release source SHA-256 must match lock");
assert(championReleasePreflight.source?.source_repository_unchanged === true, "champion release preflight must not alter the source repository");
assert(championReleasePreflight.candidate?.byte_identical_after_patch === true, "patched source must be byte-identical to generated candidate");
assert(championReleasePreflight.candidate?.generated_sha256 === createHash("sha256").update(championIntegrationWorker).digest("hex"), "champion release candidate hash must match generated worker");
assert(Object.values(championReleasePreflight.checks ?? {}).every((value) => value === true), "all champion release checks must pass");
assert(championReleasePreflight.worker_dry_run?.ok === true, "champion release config dry-run must pass");
assert(championReleasePreflight.production_command_template_dry_run?.ok === true, "champion release production CLI template dry-run must pass");
assert(championReleasePreflight.production_command_template_dry_run?.upload_performed === false, "champion release production template dry-run must not upload");
assert(championReleasePreflight.local_branch?.ok === true && championReleasePreflight.local_branch?.commit === championLocalBranch.local_branch?.commit, "champion release preflight must bind the local feature commit");
assert(championReleasePreflight.collector_readiness?.ok === true && championReleasePreflight.collector_readiness?.status === cloudflareD1Readiness.status, "champion release preflight must bind current D1 readiness");
assert(championReleasePreflight.checks?.live_telemetry_readiness_monitor_ok === true, "champion release preflight must bind the live telemetry readiness monitor");
assert(championReleasePreflight.collector_readiness?.candidate_deployment_observed === true
  && championReleasePreflight.collector_readiness?.candidate_deploy_required === candidateNeedsSecurityUpdate, "champion release preflight must mirror the current Candidate deploy/provenance mode");
assert(championReleasePreflight.collector_readiness?.observed_live_chain_ready_for_owner_evidence === true && championReleasePreflight.collector_readiness?.live_ingest_readiness_proven === expectedLiveIngestProven, "champion release preflight must mirror the current observed and proven ingest state");
assert(championLiveDeploymentSnapshot.ok === true && championLiveDeploymentSnapshot.mode === "read_only_cloudflare_live_snapshot", "champion live snapshot must be a successful read-only observation");
assert(championLiveDeploymentSnapshot.worker_name === "3q-site", "champion live snapshot must target 3q-site");
assert(championLiveDeploymentSnapshot.deployed_version?.id === championReleaseOwnerPacket.current_live?.version_id, "owner packet live version must match snapshot");
assert(championLiveDeploymentSnapshot.deployed_version?.compatibility_date === championIntegrationConfig.production_compatibility_date, "live compatibility date must match release baseline");
assert(championLiveDeploymentSnapshot.external_effect === false, "champion live snapshot must not cause external effects");
assert(championReleaseOwnerPacket.ok === true && championReleaseOwnerPacket.mode === "champion_release_owner_packet_review_only", "champion release owner packet must be review-only");
assert(championReleaseOwnerPacket.rollback?.target_version_id === championLiveDeploymentSnapshot.deployed_version?.id, "champion rollback target must match observed live version");
assert(championReleaseOwnerPacket.gates?.some((gate) => gate.id === "provision_production_collector" && gate.risk_tier === "T3" && ["existing_collector_security_update_owner_approval_required", "existing_collector_observed_owner_provenance_and_schema_evidence_required", "existing_collector_provenance_and_schema_verified"].includes(gate.status)), "owner packet must recognize the live collector and expose its current evidence state");
assert(championReleaseOwnerPacket.gates?.some((gate) => gate.id === "approve_champion_production_deploy" && gate.risk_tier === "T3"), "owner packet must keep champion production deploy behind T3 approval");
assert(championReleaseOwnerPacket.gates?.some((gate) => gate.id === "approve_github_branch_push_or_pr" && gate.risk_tier === "T2"), "owner packet must keep GitHub push/PR behind T2 approval");
assert(championReleaseOwnerPacket.local_branch?.commit === championLocalBranch.local_branch?.commit, "owner packet must reference the prepared local feature commit");
assert(championReleaseOwnerPacket.collector_readiness?.status === cloudflareD1Readiness.status, "owner packet must reference current D1 readiness");
assert(championReleaseOwnerPacket.collector_readiness?.candidate_deployment_observed === true
  && championReleaseOwnerPacket.collector_readiness?.candidate_deploy_required === candidateNeedsSecurityUpdate
  && championReleaseOwnerPacket.collector_readiness?.candidate_security_contract_ok === !candidateNeedsSecurityUpdate, "owner packet must expose the current Candidate security/provenance mode without treating ingest as ready");
assert(championReleaseOwnerPacket.collector_readiness?.live_ingest_readiness_proven === expectedLiveIngestProven && championReleaseOwnerPacket.collector_readiness?.weekly_aggregate_read_authorized === expectedWeeklyAggregateReadAuthorized, "owner packet must mirror validated ingest proof and recurring-read authorization");
assert(championReleaseOwnerPacket.review_artifacts?.d1_schema_contract === "d1_schema_contract.md", "owner packet must link the local D1 schema contract");
assert(championReleaseOwnerPacket.review_artifacts?.d1_config_guard === "approved_d1_config.md", "owner packet must link the guarded D1 config updater");
assert(championReleaseOwnerPacket.review_artifacts?.github_handoff === "champion_github_handoff.md", "owner packet must link the exact Champion GitHub handoff");
assert(championReleaseOwnerPacket.review_artifacts?.github_pr_body === "champion_github_pr_body.md", "owner packet must link the draft PR body");
assert(championReleaseOwnerPacket.safe_review_commands.every((command) => !command.includes("rm -rf")), "owner packet safe review commands must not contain destructive cleanup");
assert(championReleaseOwnerPacket.production_commands_after_owner_approval.deploy_template_do_not_run_without_owner_approval.some((command) => command.includes("gh workflow run deploy-3q-site.yml")), "owner packet deploy template must route through the reviewed content-only GitHub workflow");
assert(championReleaseOwnerPacket.production_deploy_performed === false && championReleaseOwnerPacket.external_effect === false, "owner packet must not deploy or cause external effects");
assert(championReleasePreflightSource.includes("inspectChampionSourceLock") && championReleasePreflightSource.includes("observedRefCommit"), "champion release preflight must use the shared pinned-ref fail-closed source guard");
assert(championReleasePreflightSource.includes("await writeJson(OWNER_PACKET_JSON_PATH, failedOwnerPacket)") && championReleasePreflightSource.includes("await writeFile(OWNER_PACKET_MD_PATH"), "champion release failure must replace stale owner packets with explicit blocked artifacts");
assert(championReleasePreflightSource.includes("productionTemplateDryRun"), "champion release preflight must validate the production CLI template");
assert(championReleasePreflightReport.includes("Production remains blocked"), "champion release report must preserve production gate");
assert(championReleaseOwnerPacketMd.includes("Do not run this block until every T3 gate"), "owner packet markdown must preserve T3 deploy gate");
assertNoRedLineFlags(championReleasePreflight, "champion release preflight");
assertNoRedLineFlags(championLiveDeploymentSnapshot, "champion live deployment snapshot");
assertNoRedLineFlags(championReleaseOwnerPacket, "champion release owner packet");

assert(championGithubHandoff.ok === true && championGithubHandoff.mode === "champion_github_handoff_local_only", "Champion GitHub handoff must be ready and local-only");
assert(championGithubHandoff.repository?.slug === "milk790-code/3q-hatchery-line-oa", "Champion GitHub handoff must target the known source repository");
assert(championGithubHandoff.local_branch?.name === championIntegrationConfig.local_release_branch, "Champion GitHub handoff branch must match integration config");
assert(championGithubHandoff.local_branch?.commit === championLocalBranch.local_branch?.commit, "Champion GitHub handoff commit must match the prepared local commit");
assert(JSON.stringify(championGithubHandoff.local_branch?.changed_paths) === JSON.stringify(championLocalBranch.local_branch?.changed_paths), "Champion GitHub handoff changed paths must match the reviewed release stack");
assert(championGithubHandoff.remote_branch?.state === championLocalBranch.remote_observation?.state, "Champion GitHub handoff must expose current reviewed remote state");
assert(championGithubHandoff.pull_request?.draft_required === true && championGithubHandoff.pull_request?.merge_permitted === false, "Champion GitHub handoff must stop at a draft PR");
assert(championGithubHandoff.git_push_performed === false && championGithubHandoff.github_pr_created === false && championGithubHandoff.github_push_or_pr_performed === false, "Champion GitHub handoff must not push or create a PR");
assert(!championGithubHandoffSource.includes("node:child_process"), "Champion GitHub handoff generator must not execute git or gh");
assert(championGithubHandoffMd.includes("Do not run until the owner explicitly approves") && championGithubHandoffMd.includes("Do not merge") && !championGithubHandoffMd.includes("push --force"), "Champion GitHub handoff must preserve owner push and merge gates without a force-push command");
assert(championGithubPrBody.includes("Keep this PR draft") && championGithubPrBody.includes("Do not merge"), "Champion draft PR body must retain provenance, D1, and merge gates");
if (championReleasePreflight.collector_readiness?.live_ingest_readiness_proven === true) {
  assert(championGithubPrBody.includes("dedicated D1 schema and aggregate-only collection evidence are already validated"), "Champion draft PR body must state the current verified D1 evidence");
} else {
  assert(championGithubPrBody.includes("verify the remote D1 schema before relying on live telemetry"), "Champion draft PR body must preserve the unresolved remote D1 evidence gate");
}
assert(championReleasePreflight.collector_readiness?.candidate_deploy_required !== false
  || (!championGithubPrBody.includes("review and deploy the separate collector-side PII/Origin hardening")
    && championGithubPrBody.includes("no collector redeploy is currently required")),
"Champion draft PR body must not request a collector redeploy when the observed security-current deployment only needs provenance and schema evidence");
assertNoRedLineFlags(championGithubHandoff, "Champion GitHub handoff");
assert(packageJson.scripts["champion:release:preflight"] === "node scripts/champion-release-preflight.mjs", "package must expose deterministic champion release preflight");
assert(packageJson.scripts["champion:release:preflight:live"] === "node scripts/champion-release-preflight.mjs --refresh-live", "package must expose explicit read-only live snapshot refresh");
assert(githubExportBundleSource.includes('"output/playwright"'), "GitHub export must exclude local Playwright diagnostic evidence");
assert(packageJson.scripts["cloudflare:d1:readiness"] === "node scripts/cloudflare-d1-readiness.mjs", "package must expose cached D1 readiness");
assert(packageJson.scripts["cloudflare:d1:readiness:live"] === "node scripts/cloudflare-d1-readiness.mjs --refresh-live", "package must expose live metadata-only D1 readiness");
assert(packageJson.scripts["champion:branch:status"] === "node scripts/champion-local-branch.mjs", "package must expose read-only local branch status");
assert(packageJson.scripts["champion:branch:prepare"] === "node scripts/champion-local-branch.mjs --prepare", "package must expose explicit local branch preparation");
assert(packageJson.scripts.verify.includes("npm run cloudflare:d1:readiness"), "verify chain must include cached D1 readiness");
assert(packageJson.scripts.verify.includes("npm run champion:release:preflight"), "verify chain must include champion release preflight");
assert(weeklyRunnerSource.includes("cloudflare_d1_readiness") && weeklyRunnerSource.includes("cloudflare:d1:readiness:live"), "weekly runner must refresh D1 metadata readiness");
assert(weeklyRunnerSource.includes('args: ["run", "collect:d1:auto"]'), "weekly runner collect_data must use owner-evidence-driven D1 collection");
assert(weeklyRunnerSource.includes("d1_collection_mode_fixtures") && weeklyRunnerSource.includes("d1:collection:fixtures"), "weekly runner must include D1 collection selector fixtures");
assert(weeklyRunnerSource.includes("d1_aggregate_export_fixtures") && weeklyRunnerSource.includes("d1:aggregate:fixtures"), "weekly runner must include D1 aggregate exporter fixtures");
assert(weeklyRunnerSource.includes("champion_local_branch_status") && weeklyRunnerSource.includes("champion:branch:status"), "weekly runner must audit the local feature commit without mutation");
assert(weeklyRunnerSource.includes("champion_release_preflight"), "weekly runner must include champion release preflight step");
assert(weeklyRunnerSource.includes("champion:release:preflight"), "weekly runner must run champion release preflight");
assert(weeklyRunnerSource.indexOf('step: "champion_release_preflight_after_evidence"') > weeklyRunnerSource.indexOf('step: "live_telemetry_readiness_after_evidence"'), "weekly runner must rebuild Champion release evidence after telemetry consumes refreshed owner evidence");
assert(weeklyRunnerSource.indexOf('step: "generate_weekly_artifacts_after_evidence"') > weeklyRunnerSource.indexOf('step: "champion_github_handoff_after_evidence"'), "weekly runner must regenerate owner-facing artifacts after post-evidence release and GitHub handoff state");
assert(ab.changed_variable === "cta_text", "week0 changed_variable must be cta_text");
assert(ab.one_variable_rule_ok === true, "one-variable rule must pass");
assert(growthLoopSource.includes("one_variable_rule_ok: config.one_variable_per_round.includes(changedVariable)"), "content variant one-variable rule must be config-driven");
assert(!growthLoopSource.includes("one_variable_rule_ok: changedVariable === \"cta_text\""), "content variant one-variable rule must not hardcode cta_text");
assert(!lineInboundPlaybookSource.includes("playbook.round.changed_variable === \"cta_text\""), "LINE inbound one-variable check must not hardcode cta_text");
assert(ab.decision !== "queue_human_promotion_review" || ab.challenger_win_rule_met === true, "promotion queue requires win rule");
assert(approval.policy.no_external_send === true, "approval queue must block external send");
assert(approval.policy.no_production_deploy === true, "approval queue must block production deploy");
assert(approval.policy.no_primary_link_change === true, "approval queue must block primary link changes");
const approvalStatusCounts = approval.items.reduce((counts, item) => {
  counts[item.status] = (counts[item.status] ?? 0) + 1;
  return counts;
}, {});
const approvalRiskCounts = approval.items.reduce((counts, item) => {
  counts[item.risk_tier] = (counts[item.risk_tier] ?? 0) + 1;
  return counts;
}, {});
const approvalPendingHuman = approval.items.filter((item) => item.status === "pending_human");
const approvalReadyLocal = approval.items.filter((item) => item.status === "ready_local_review");
const approvalCompletedLocal = approval.items.filter((item) => item.status === "completed_local_reversible");
const approvalCompletedExternalEvidence = approval.items.filter((item) => item.status === "completed_external_evidence_verified");
const approvalHighRiskPending = approvalPendingHuman.filter((item) => ["T2", "T3"].includes(item.risk_tier));
assert(approvalStatus.ok === true, "approval queue compact status must be ok");
assert(approvalStatus.mode === "approval_queue_status_local_only", "approval queue compact status must be local-only");
assert(approvalStatus.queue_json_path === "approval_queue.json", "approval queue compact status must point to source queue");
assert(approvalStatus.item_count === approval.items.length, "approval queue compact status item count must match queue");
assert(JSON.stringify(approvalStatus.status_counts) === JSON.stringify(approvalStatusCounts), "approval queue compact status counts must match queue");
assert(JSON.stringify(approvalStatus.risk_tier_counts) === JSON.stringify(approvalRiskCounts), "approval queue compact risk counts must match queue");
assert(approvalStatus.ready_local_review_count === approvalReadyLocal.length, "approval queue compact ready count must match queue");
assert(approvalStatus.pending_human_count === approvalPendingHuman.length, "approval queue compact pending-human count must match queue");
assert(approvalStatus.completed_local_reversible_count === approvalCompletedLocal.length, "approval queue compact completed-local count must match queue");
assert(approvalStatus.completed_external_evidence_verified_count === approvalCompletedExternalEvidence.length, "approval queue compact completed-external-evidence count must match queue");
assert(approvalStatus.high_risk_pending_count === approvalHighRiskPending.length, "approval queue compact high-risk count must match queue");
assert(JSON.stringify(approvalStatus.pending_human_ids) === JSON.stringify(approvalPendingHuman.map((item) => item.id)), "approval queue compact pending-human ids must match queue");
assert(JSON.stringify(approvalStatus.ready_local_review_ids) === JSON.stringify(approvalReadyLocal.map((item) => item.id)), "approval queue compact ready-local ids must match queue");
assert(approvalStatus.policy_ok === true, "approval queue compact status must confirm policy flags");
assert(approvalStatus.external_effect === false, "approval queue compact status must have no external effect");
assert(approvalStatus.approval_action_executed === false, "approval queue compact status must not execute approvals");
assertNoRedLineFlags(approvalStatus, "approval queue compact status");
assert(approval.items.some((item) => item.id === "review-local-launchagent-install"), "approval queue must include local LaunchAgent install review");
assert(approval.items.some((item) => item.id === "approve-github-repo-and-pr"), "approval queue must include GitHub repo / PR approval");
for (const [approvalId, gateId] of [
  ["approve-d1-create-and-migrate", "remote_d1_create_and_migrate"],
  ["approve-candidate-worker-deploy", "candidate_worker_production_deploy"],
  ["approve-github-repo-and-pr", "github_repo_branch_pr"],
]) {
  const evidenceValid = ownerGateEvidence.gates?.some((gate) => gate.gate_id === gateId && gate.evidence_valid === true);
  const expectedStatus = evidenceValid ? "completed_external_evidence_verified" : "pending_human";
  assert(approval.items.some((item) => item.id === approvalId && item.status === expectedStatus), `${approvalId} status must match current owner evidence`);
}
assert(approvalStatus.pending_human_ids.includes("approve-small-ab-link") && approvalStatus.pending_human_ids.includes("approve-champion-integration-production-deploy"), "approval queue must retain public A/B and Champion production gates as pending human actions");
assert(approval.items.some((item) =>
  item.id === "approve-d1-create-and-migrate" &&
  item.supporting_artifact === "d1_schema_contract.md" &&
  item.readiness_artifact === "cloudflare_d1_readiness.md" &&
  item.config_guard_artifact === "approved_d1_config.md"
), "D1 approval gate must include schema, live metadata, and config-guard evidence");
const candidateApprovalGate = approval.items.find((item) => item.id === "approve-candidate-worker-deploy");
assert(candidateApprovalGate
  && candidateApprovalGate.type === (candidateNeedsSecurityUpdate
    ? "candidate_worker_security_update"
    : "candidate_worker_existing_deployment_provenance")
  && candidateApprovalGate.artifact === (candidateNeedsSecurityUpdate ? "worker.ts" : "live_telemetry_readiness.md")
  && candidateApprovalGate.supporting_artifact === "worker.ts",
"Candidate approval gate must match the current security-update or existing-deployment provenance mode");
assert(approval.items.some((item) => item.id === "review-owner-approval-pack"), "approval queue must include owner approval pack review");
assert(approval.items.some((item) => item.id === "review-next-round-plan"), "approval queue must include next-round plan review");
assert(approval.items.some((item) => item.id === "review-owner-console"), "approval queue must include owner console review");
assert(approval.items.some((item) => item.id === "review-real-data-input-pack"), "approval queue must include real-data input pack review");
assert(approval.items.some((item) => item.id === "review-source-readiness"), "approval queue must include source readiness review");
assert(approval.items.some((item) => item.id === "review-champion-integration-candidate" && item.artifact === "champion_integration_candidate.md" && item.supporting_artifact === "champion_integration_smoke.md" && item.release_artifact === "champion_release_owner_packet.md" && item.local_commit_artifact === "champion_local_branch.md"), "approval queue must include champion integration candidate, local commit, and release packet");
assert(approval.items.some((item) => item.id === "approve-champion-integration-production-deploy" && item.risk_tier === "T3" && item.status === "pending_human" && item.artifact === "champion_integration_candidate.md" && item.release_artifact === "champion_release_owner_packet.md"), "approval queue must keep the live champion integration production deploy behind an explicit T3 human gate");
assert(approval.items.some((item) => item.id === "review-source-capture-pack"), "approval queue must include source capture pack review");
assert(approval.items.some((item) => item.id === "review-source-capture-compile"), "approval queue must include source capture compile review");
assert(approval.items.some((item) => item.id === "review-real-data-intake-plan"), "approval queue must include real-data intake plan review");
assert(approval.items.some((item) => item.id === "review-data-collection-brief"), "approval queue must include data collection brief review");
assert(blocked.status === "prepared_but_blocked", "blocked status must be prepared_but_blocked");
const expectedCandidateBlockedAction = liveTelemetryReadiness.candidate_worker?.deployment_observed === true
  && liveTelemetryReadiness.candidate_worker?.health_ok === true
  && liveTelemetryReadiness.candidate_worker?.deploy_required === false
  ? "confirm_existing_candidate_worker_provenance"
  : liveTelemetryReadiness.candidate_worker?.deployment_observed === true
    && liveTelemetryReadiness.candidate_worker?.health_ok === true
    ? "deploy_candidate_worker_security_update"
    : "deploy_candidate_worker";
assert(blocked.items.some((item) => item.action === expectedCandidateBlockedAction), "Candidate deploy/provenance block is missing");
if (expectedCandidateBlockedAction === "confirm_existing_candidate_worker_provenance") {
  const candidateProvenanceBlock = blocked.items.find((item) => item.action === expectedCandidateBlockedAction);
  assert(candidateProvenanceBlock?.operation_mode === "verify_existing_candidate_deployment", "existing Candidate block must use provenance verification mode");
  assert(candidateProvenanceBlock?.resource_deploy_required === false, "existing healthy Candidate block must not require redeploy");
  assert(candidateProvenanceBlock?.prepared_artifact === "live_telemetry_readiness.md", "existing Candidate block must point to live telemetry readiness evidence");
}
if (expectedCandidateBlockedAction === "deploy_candidate_worker_security_update") {
  const candidateSecurityBlock = blocked.items.find((item) => item.action === expectedCandidateBlockedAction);
  assert(candidateSecurityBlock?.operation_mode === "deploy_candidate_worker_security_update", "outdated Candidate block must expose security update mode");
  assert(candidateSecurityBlock?.resource_deploy_required === true, "Candidate security update must remain a production deploy gate");
  assert(candidateSecurityBlock?.prepared_artifact === "worker.ts", "Candidate security update block must point to the reviewed Worker source");
}
const expectedD1BlockedAction = cloudflareD1Readiness.decision?.configured_id_matches === true
  ? "verify_existing_cloudflare_d1_and_apply_schema"
  : "create_cloudflare_d1_and_apply_schema";
assert(blocked.items.some((item) =>
  item.action === expectedD1BlockedAction &&
  item.supporting_artifact === "d1_schema_contract.md" &&
  item.readiness_artifact === "cloudflare_d1_readiness.md" &&
  item.config_guard_artifact === "approved_d1_config.md"
), "D1 block must include schema, live metadata, and config-guard evidence");
if (cloudflareD1Readiness.decision?.configured_id_matches === true) {
  const currentD1Block = blocked.items.find((item) => item.action === expectedD1BlockedAction);
  assert(currentD1Block?.operation_mode === "verify_existing_d1_then_migrate_schema", "D1 block must use existing-database verification mode");
  assert(currentD1Block?.resource_create_required === false, "D1 block must explicitly reject duplicate resource creation");
}
const expectedChampionBlockedAction = championContractAudit.observations?.line_only_contact_detected === true
  && championContractAudit.observations?.misleading_success_state_detected === false
  ? "confirm_champion_live_contract_provenance_before_redeploy"
  : "repair_or_remove_champion_contact_form_false_success";
assert(blocked.items.some((item) => item.action === expectedChampionBlockedAction && item.prepared_artifact === "champion_integration_candidate.md" && item.supporting_artifact === "champion_integration_smoke.md" && item.release_artifact === "champion_release_owner_packet.md" && item.local_commit_artifact === "champion_local_branch.md"), "champion contract block must match current live evidence and point to the candidate, smoke evidence, local commit, and release packet");
assert(blocked.items.some((item) => item.action === "formal_social_post_or_line_push"), "formal post / LINE push block is missing");
assert(blocked.items.some((item) => item.action === "github_push_or_pr_creation" && item.supporting_artifact === "champion_local_branch.md"), "GitHub push / PR block must include the local feature commit");
assert(blocked.items.some((item) => item.action === "execute_owner_approved_launch_sequence"), "owner launch sequence block is missing");
assert(preparedButBlockedStatus.ok === true, "PreparedButBlocked report compact status must be ok");
assert(preparedButBlockedStatus.mode === "prepared_but_blocked_report_local_only", "PreparedButBlocked report mode must be local-only");
assert(preparedButBlockedStatus.status === blocked.status, "PreparedButBlocked report status must match source JSON");
assert(preparedButBlockedStatus.blocked_item_count === blocked.items.length, "PreparedButBlocked report item count must match source JSON");
assert(preparedButBlockedReport.includes("champion_release_owner_packet.md"), "PreparedButBlocked report must surface the champion release owner packet");
assert(preparedButBlockedReport.includes("cloudflare_d1_readiness.md") && preparedButBlockedReport.includes("champion_local_branch.md"), "PreparedButBlocked report must surface D1 readiness and local commit evidence");
assert(preparedButBlockedStatus.redline_queue_covered === true, "PreparedButBlocked report must read covered red-line queue");
assert(preparedButBlockedStatus.no_autorun_for_external_gates === true, "PreparedButBlocked report must keep external gates non-autorun");
assert(Array.isArray(blocked.data_evidence_gates), "PreparedButBlocked must separate data evidence gates from red-line actions");
assert(blocked.data_evidence_gates.length === 3, "PreparedButBlocked must expose P0, P1, and trusted-scoring evidence gates");
assert(blocked.data_evidence_gates.every((gate) => gate.blocking_completion === true), "every data evidence gate must block completion until met");
assert(blocked.data_evidence_gates.every((gate) => gate.external_effect === false), "data evidence gates must remain local-only");
assert(preparedButBlockedStatus.data_evidence_gate_count === blocked.data_evidence_gates.length, "PreparedButBlocked compact status must expose data evidence gate count");
assert(preparedButBlockedStatus.unmet_data_evidence_gate_count === blocked.data_evidence_gates.filter((gate) => gate.status !== "met").length, "PreparedButBlocked compact status must expose unmet data evidence gate count");
assert(preparedButBlockedStatus.data_evidence_ready === blocked.data_evidence_gates.every((gate) => gate.status === "met"), "PreparedButBlocked compact status must expose aggregate data evidence readiness");
assertNoRedLineFlags(preparedButBlockedStatus, "PreparedButBlocked report compact status");
assert(preparedButBlockedReport.includes("PreparedButBlocked Report"), "PreparedButBlocked report must include title");
assert(preparedButBlockedReport.includes("External effect: no"), "PreparedButBlocked report must state no external effect");
assert(preparedButBlockedReport.includes("No autorun for external gates: yes"), "PreparedButBlocked report must state no autorun");
assert(preparedButBlockedReport.includes("Data Evidence Gates"), "PreparedButBlocked report must show data evidence separately from red-line actions");
for (const item of blocked.items) {
  assert(preparedButBlockedReport.includes(item.action), `PreparedButBlocked report must include blocked action: ${item.action}`);
  if (item.prepared_artifact) {
    assert(preparedButBlockedReport.includes(item.prepared_artifact), `PreparedButBlocked report must include artifact: ${item.prepared_artifact}`);
  }
}
assert(links.public_link_change_performed === false, "tracking links must not claim public link changes");
assert(links.links.some((link) => link.role === "challenger"), "challenger tracking link missing");
assert(links.links.some((link) => link.role === "ab_small_traffic"), "A/B small traffic router link missing");
assert(variants.one_variable_rule_ok === true, "content variants must obey one-variable rule");
assert(variants.drafts.every((draft) => draft.final_gate === "draft_only_human_publish_required"), "all variants must be draft gated");
const contentVariantLinks = links.links.filter((link) => link.role === "content_variant");
const contentVariantUrls = new Set(contentVariantLinks.map((link) => link.tracking_url));
assert(contentVariantLinks.length === variants.drafts.length, "each content variant draft must have one tracking link");
assert(contentVariantUrls.size === contentVariantLinks.length, "content variant tracking URLs must be unique");
for (const draft of variants.drafts) {
  const link = contentVariantLinks.find((item) => item.content_id === draft.content_id && item.variant_id === draft.variant_id);
  assert(Boolean(link), `content variant link missing for ${draft.content_id}/${draft.variant_id}`);
  assert(draft.tracking_url === link.tracking_url, `draft tracking URL must match link for ${draft.variant_id}`);
  assert(link.external_effect === false, `content variant link must have no external effect: ${draft.variant_id}`);
  assert(link.status === "draft_only_human_publish_required", `content variant link must stay draft gated: ${draft.variant_id}`);
  assert(link.tracking_url.includes(`content_id=${encodeURIComponent(draft.content_id)}`), `tracking URL missing content_id for ${draft.variant_id}`);
  assert(link.tracking_url.includes(`variant_id=${encodeURIComponent(draft.variant_id)}`), `tracking URL missing variant_id for ${draft.variant_id}`);
}
assert(packageJson.scripts["manual:publish-packet"] === "node scripts/manual-publish-packet.mjs", "package.json must expose manual publish packet script");
assert(packageJson.scripts.verify.includes("npm run manual:publish-packet"), "verify chain must include manual publish packet");
assert(weeklyRunnerSource.includes("manual_publish_packet"), "weekly runner must include manual publish packet step");
assert(weeklyRunnerSource.includes("manual:publish-packet"), "weekly runner must run manual:publish-packet");
assert(manualPublishPacketSource.includes("draft_only_human_publish_required"), "manual publish packet script must keep draft-only gate");
assert(manualPublishPacket.ok === true, "manual publish packet must be ok");
assert(manualPublishPacket.mode === "manual_publish_packet_local_review", "manual publish packet mode must be local review");
assert(manualPublishPacket.status === "ready_local_review", "manual publish packet must be ready for local review");
assert(manualPublishPacket.one_variable_rule_ok === true, "manual publish packet must preserve one-variable rule");
assert(manualPublishPacket.packet_count === variants.drafts.length, "manual publish packet count must match content drafts");
assert(manualPublishPacket.draft_count === variants.drafts.length, "manual publish draft count must match content drafts");
assert(manualPublishPacket.tracking_link_count === contentVariantLinks.length, "manual publish tracking link count must match content links");
assert(Array.isArray(manualPublishPacket.issues) && manualPublishPacket.issues.length === 0, "manual publish packet must have no issues");
assert(manualPublishPacket.publish_policy?.draft_only === true, "manual publish packet must be draft-only");
assert(manualPublishPacket.publish_policy?.owner_manual_publish_required === true, "manual publish packet must require owner manual publish");
assert(manualPublishPacket.blocked_actions.includes("formal_social_post"), "manual publish packet must block formal posts");
assert(manualPublishPacket.blocked_actions.includes("line_push_or_broadcast"), "manual publish packet must block LINE push");
assert(manualPublishPacket.blocked_actions.includes("production_worker_deploy"), "manual publish packet must block production deploy");
assertNoRedLineFlags(manualPublishPacket, "manual publish packet");
assert(manualPublishPacketStatus.ok === true, "manual publish packet status must be ok");
assert(manualPublishPacketStatus.mode === "manual_publish_packet_local_review", "manual publish packet status mode must match");
assert(manualPublishPacketStatus.packet_count === manualPublishPacket.packet_count, "manual publish packet status count must match packet");
assert(manualPublishPacketStatus.owner_manual_publish_required === true, "manual publish packet status must require owner manual publish");
assertNoRedLineFlags(manualPublishPacketStatus, "manual publish packet status");
for (const draft of variants.drafts) {
  const packet = manualPublishPacket.packets.find((item) => item.content_id === draft.content_id && item.variant_id === draft.variant_id);
  const link = contentVariantLinks.find((item) => item.content_id === draft.content_id && item.variant_id === draft.variant_id);
  assert(Boolean(packet), `manual publish packet missing draft ${draft.content_id}/${draft.variant_id}`);
  assert(packet.status === "draft_only_human_publish_required", `manual publish packet must stay draft-gated: ${draft.variant_id}`);
  assert(packet.draft_caption === draft.draft_caption, `manual publish caption mismatch: ${draft.variant_id}`);
  assert(packet.cta_text === draft.cta_text, `manual publish CTA mismatch: ${draft.variant_id}`);
  assert(packet.tracking.tracking_url === link.tracking_url, `manual publish tracking URL mismatch: ${draft.variant_id}`);
  assert(packet.tracking.status === "draft_only_human_publish_required", `manual publish tracking gate mismatch: ${draft.variant_id}`);
  assert(packet.line_handoff_summary.inbound_only === true, `manual publish LINE handoff must be inbound-only: ${draft.variant_id}`);
  assert(packet.line_handoff_summary.manual_reply_only === true, `manual publish LINE handoff must be manual reply only: ${draft.variant_id}`);
  assert(packet.line_handoff_summary.aggregate_or_pseudonymous_only === true, `manual publish LINE handoff must stay aggregate-only: ${draft.variant_id}`);
  assert(packet.owner_manual_steps.length >= 5, `manual publish packet must include owner manual steps: ${draft.variant_id}`);
  assert(packet.blocked_actions.includes("change_primary_social_or_bio_link"), `manual publish packet must block main-link changes: ${draft.variant_id}`);
  assertNoRedLineFlags(packet, `manual publish packet item ${draft.variant_id}`);
}
assert(manualPublishPacketMd.includes("Manual Publish Packet"), "manual publish packet markdown must have title");
assert(manualPublishPacketMd.includes("External effect: no"), "manual publish packet markdown must state no external effect");
assert(manualPublishPacketMd.includes("Formal post performed: no"), "manual publish packet markdown must state no formal post");
assert(manualPublishPacketMd.includes("LINE push performed: no"), "manual publish packet markdown must state no LINE push");
assert(manualPublishPacketMd.includes("data/lp_events.jsonl write performed: no"), "manual publish packet markdown must state no lp_events write");
assert(packageJson.scripts["manual:capture-plan"] === "node scripts/manual-publish-capture-plan.mjs", "package.json must expose manual capture plan script");
assert(packageJson.scripts.verify.includes("npm run manual:capture-plan"), "verify chain must include manual capture plan");
assert(weeklyRunnerSource.includes("manual_publish_capture_plan"), "weekly runner must include manual publish capture plan step");
assert(weeklyRunnerSource.includes("manual:capture-plan"), "weekly runner must run manual:capture-plan");
assert(manualPublishCapturePlanSource.includes("manual_publish_capture_plan_local_only"), "manual capture plan script must stay local-only");
assert(manualPublishCapturePlan.ok === true, "manual capture plan must be ok");
assert(manualPublishCapturePlan.mode === "manual_publish_capture_plan_local_only", "manual capture plan mode must be local-only");
assert(manualPublishCapturePlan.status === "waiting_for_owner_manual_publish_and_counts", "manual capture plan must wait for owner publish and counts");
assert(manualPublishCapturePlan.packet_count === manualPublishPacket.packet_count, "manual capture plan packet count must match manual packet");
assert(manualPublishCapturePlan.sample_gate_row_count === manualPublishPacket.packet_count * 3, "manual capture plan must expose three sample-gate rows per packet");
assert(manualPublishCapturePlan.north_star_capture_row_count === manualPublishPacket.packet_count * 7, "manual capture plan must expose seven North Star/quality rows per packet");
assert(manualPublishCapturePlan.plan_policy?.owner_manual_publish_required === true, "manual capture plan must require owner manual publish");
assert(manualPublishCapturePlan.plan_policy?.aggregate_only === true, "manual capture plan must be aggregate-only");
assert(manualPublishCapturePlan.plan_policy?.sample_insufficient_keeps_champion === true, "manual capture plan must preserve champion while sample is insufficient");
assert(Array.isArray(manualPublishCapturePlan.issues) && manualPublishCapturePlan.issues.length === 0, "manual capture plan must have no issues");
assertNoRedLineFlags(manualPublishCapturePlan, "manual capture plan");
assert(manualPublishCapturePlanStatus.ok === true, "manual capture plan status must be ok");
assert(manualPublishCapturePlanStatus.mode === "manual_publish_capture_plan_local_only", "manual capture plan status mode must match");
assert(manualPublishCapturePlanStatus.packet_count === manualPublishCapturePlan.packet_count, "manual capture plan status packet count must match");
assert(manualPublishCapturePlanStatus.sample_gate_row_count === manualPublishCapturePlan.sample_gate_row_count, "manual capture plan status sample row count must match");
assert(manualPublishCapturePlanStatus.north_star_capture_row_count === manualPublishCapturePlan.north_star_capture_row_count, "manual capture plan status North Star row count must match");
assertNoRedLineFlags(manualPublishCapturePlanStatus, "manual capture plan status");
for (const packet of manualPublishPacket.packets) {
  const capture = manualPublishCapturePlan.plans.find((item) => item.content_id === packet.content_id && item.variant_id === packet.variant_id);
  assert(Boolean(capture), `manual capture plan missing packet ${packet.content_id}/${packet.variant_id}`);
  assert(capture.publish_status === "waiting_for_owner_manual_publish", `manual capture plan must wait for owner publish: ${packet.variant_id}`);
  assert(capture.tracking_url === packet.tracking.tracking_url, `manual capture plan tracking URL mismatch: ${packet.variant_id}`);
  assert(JSON.stringify(capture.sample_gate_required_events) === JSON.stringify(["page_view", "cta_click", "line_add"]), `manual capture plan sample events mismatch: ${packet.variant_id}`);
  assert(JSON.stringify(capture.north_star_events) === JSON.stringify(["link_click", "line_add", "lead_submit", "deal"]), `manual capture plan North Star events mismatch: ${packet.variant_id}`);
  assert(capture.sample_gate_rows.length === 3, `manual capture plan must include three sample rows: ${packet.variant_id}`);
  assert(capture.north_star_capture_rows.length === 7, `manual capture plan must include seven capture rows: ${packet.variant_id}`);
  assert(capture.observation_checkpoints.some((checkpoint) => checkpoint.checkpoint === "day_3"), `manual capture plan must include day_3 checkpoint: ${packet.variant_id}`);
  assert(capture.observation_checkpoints.some((checkpoint) => checkpoint.checkpoint === "day_7"), `manual capture plan must include day_7 checkpoint: ${packet.variant_id}`);
  assert(capture.blocked_actions.includes("automatic_publish_or_schedule"), `manual capture plan must block automatic publish: ${packet.variant_id}`);
  assert(capture.blocked_actions.includes("line_push_or_broadcast"), `manual capture plan must block LINE push: ${packet.variant_id}`);
  assertNoRedLineFlags(capture, `manual capture plan item ${packet.variant_id}`);
  for (const row of capture.sample_gate_rows) {
    assert(sampleGateOwnerWorksheet.rows.some((worksheetRow) =>
      worksheetRow.content_id === packet.content_id
      && worksheetRow.variant_id === packet.variant_id
      && worksheetRow.stage === row.event_type
      && worksheetRow.row_number === row.worksheet_row_number
    ), `manual capture sample row must map to owner worksheet: ${packet.variant_id}/${row.event_type}`);
    assert(row.aggregate_only === true, `manual capture sample row must be aggregate-only: ${packet.variant_id}/${row.event_type}`);
    assert(row.customer_data_allowed === false, `manual capture sample row must block customer data: ${packet.variant_id}/${row.event_type}`);
    assertNoRedLineFlags(row, `manual capture sample row ${packet.variant_id}/${row.event_type}`);
  }
  for (const row of capture.north_star_capture_rows) {
    assert(row.aggregate_only === true, `manual capture North Star row must be aggregate-only: ${packet.variant_id}/${row.event_type}`);
    assert(row.customer_data_allowed === false, `manual capture North Star row must block customer data: ${packet.variant_id}/${row.event_type}`);
    assertNoRedLineFlags(row, `manual capture North Star row ${packet.variant_id}/${row.event_type}`);
  }
}
assert(manualPublishCapturePlanMd.includes("Manual Publish Capture Plan"), "manual capture plan markdown must have title");
assert(manualPublishCapturePlanMd.includes("Day 3") || manualPublishCapturePlanMd.includes("day_3"), "manual capture plan markdown must include day 3 checkpoint");
assert(manualPublishCapturePlanMd.includes("Day 7") || manualPublishCapturePlanMd.includes("day_7"), "manual capture plan markdown must include day 7 checkpoint");
assert(manualPublishCapturePlanMd.includes("External effect: no"), "manual capture plan markdown must state no external effect");
assert(manualPublishCapturePlanMd.includes("Formal post performed: no"), "manual capture plan markdown must state no formal post");
assert(manualPublishCapturePlanMd.includes("data/lp_events.jsonl write performed: no"), "manual capture plan markdown must state no lp_events write");
assert(packageJson.scripts["manual:publish-brief"] === "node scripts/manual-publish-brief.mjs", "package.json must expose manual publish brief script");
assert(packageJson.scripts.verify.includes("npm run manual:publish-brief"), "verify chain must include manual publish brief");
assert(weeklyRunnerSource.includes("manual_publish_brief"), "weekly runner must include manual publish brief step");
assert(weeklyRunnerSource.includes("manual:publish-brief"), "weekly runner must run manual:publish-brief");
assert(manualPublishBriefSource.includes("manual_publish_brief_local_only"), "manual publish brief script must stay local-only");
assert(manualPublishBriefSource.includes("public_tracking_url_required_before_formal_publish"), "manual publish brief script must gate local-only tracking URLs");
assert(manualPublishBrief.ok === true, "manual publish brief must be ok");
assert(manualPublishBrief.mode === "manual_publish_brief_local_only", "manual publish brief mode must be local-only");
assert(["prepared_but_blocked_public_tracking_url", "ready_owner_day0_manual_publish_review"].includes(manualPublishBrief.status), "manual publish brief status is invalid");
assert(manualPublishBrief.selected_packet_id === manualPublishPacket.packets[0].packet_id, "manual publish brief must select the first current packet deterministically");
assert(manualPublishBrief.selected_content_id === manualPublishPacket.packets[0].content_id, "manual publish brief selected content must match packet");
assert(manualPublishBrief.selected_variant_id === manualPublishPacket.packets[0].variant_id, "manual publish brief selected variant must match packet");
assert(manualPublishBrief.draft_caption === manualPublishPacket.packets[0].draft_caption, "manual publish brief caption must match selected packet");
assert(manualPublishBrief.tracking_url === manualPublishPacket.packets[0].tracking.tracking_url, "manual publish brief tracking URL must match selected packet");
assert(manualPublishBrief.packet_count === manualPublishPacket.packet_count, "manual publish brief packet count must match manual publish packet");
assert(manualPublishBrief.sample_gate_row_count === 3, "manual publish brief must expose selected packet sample-gate rows");
assert(manualPublishBrief.north_star_capture_row_count === 7, "manual publish brief must expose selected packet North Star rows");
assert(manualPublishBrief.owner_manual_publish_required === true, "manual publish brief must require owner manual publish");
assert(manualPublishBrief.owner_exact_copy_surface_time_required === true, "manual publish brief must require exact copy/surface/time review");
assert(manualPublishBrief.line_inbound_only === true, "manual publish brief must keep LINE inbound-only");
assert(manualPublishBrief.line_manual_reply_only === true, "manual publish brief must keep LINE replies manual");
assert(manualPublishBrief.aggregate_or_pseudonymous_only === true, "manual publish brief must keep aggregate-only recording");
assert(manualPublishBrief.blocked_actions.includes("formal_social_post"), "manual publish brief must block formal posting");
assert(manualPublishBrief.blocked_actions.includes("production_worker_deploy"), "manual publish brief must block production deploy");
assert(manualPublishBrief.blocked_actions.includes("line_push_or_broadcast"), "manual publish brief must block LINE push");
assert(manualPublishBrief.tracking_url_public_ready === isPublicHttpUrlForVerifier(manualPublishBrief.tracking_url), "manual publish brief public URL readiness must match local URL check");
if (manualPublishBrief.tracking_url_public_ready === false) {
  assert(manualPublishBrief.formal_publish_ready === false, "manual publish brief must block formal publish when tracking URL is local-only");
  assert(manualPublishBrief.public_tracking_url_required_before_formal_publish === true, "manual publish brief must require public tracking URL before formal publish");
  assert(manualPublishBrief.status === "prepared_but_blocked_public_tracking_url", "manual publish brief must surface local URL gate as prepared-but-blocked");
}
assertNoRedLineFlags(manualPublishBrief, "manual publish brief");
assert(manualPublishBriefStatus.ok === true, "manual publish brief status must be ok");
assert(manualPublishBriefStatus.mode === "manual_publish_brief_local_only", "manual publish brief compact mode must match");
assert(manualPublishBriefStatus.status === manualPublishBrief.status, "manual publish brief compact status must match");
assert(manualPublishBriefStatus.selected_packet_id === manualPublishBrief.selected_packet_id, "manual publish brief compact packet id must match");
assert(manualPublishBriefStatus.formal_publish_ready === manualPublishBrief.formal_publish_ready, "manual publish brief compact formal publish readiness must match");
assertNoRedLineFlags(manualPublishBriefStatus, "manual publish brief status");
assert(manualPublishBriefMd.includes("Manual Publish Brief"), "manual publish brief markdown must have title");
assert(manualPublishBriefMd.includes("Public Link Gate"), "manual publish brief markdown must include public link gate");
assert(manualPublishBriefMd.includes("Formal post performed: no"), "manual publish brief markdown must state no formal post");
assert(manualPublishBriefMd.includes("LINE push performed: no"), "manual publish brief markdown must state no LINE push");
assert(manualPublishBriefMd.includes("data/lp_events.jsonl write performed: no"), "manual publish brief markdown must state no lp_events write");
assert(packageJson.scripts["public:tracking-pack"] === "node scripts/public-tracking-url-pack.mjs", "package.json must expose public tracking URL pack script");
assert(packageJson.scripts.verify.includes("npm run public:tracking-pack"), "verify chain must include public tracking URL pack");
assert(weeklyRunnerSource.includes("public_tracking_url_pack"), "weekly runner must include public tracking URL pack step");
assert(weeklyRunnerSource.includes("public:tracking-pack"), "weekly runner must run public:tracking-pack");
assert(publicTrackingUrlPackSource.includes("public_tracking_url_pack_local_only"), "public tracking URL pack script must stay local-only");
assert(publicTrackingUrlPackSource.includes("OWNER_APPROVED_WORKER_URL"), "public tracking URL pack must use owner-approved Worker URL placeholder");
assert(publicTrackingUrlPack.ok === true, "public tracking URL pack must be ok");
assert(publicTrackingUrlPack.mode === "public_tracking_url_pack_local_only", "public tracking URL pack mode must be local-only");
assert(publicTrackingUrlPack.status === "prepared_but_blocked_owner_public_url" || publicTrackingUrlPack.status === "ready_owner_public_tracking_review", "public tracking URL pack status is invalid");
assert(publicTrackingUrlPack.selected_packet_id === manualPublishBrief.selected_packet_id, "public tracking URL pack selected packet must match manual brief");
assert(publicTrackingUrlPack.selected_content_id === manualPublishBrief.selected_content_id, "public tracking URL pack selected content must match manual brief");
assert(publicTrackingUrlPack.selected_variant_id === manualPublishBrief.selected_variant_id, "public tracking URL pack selected variant must match manual brief");
assert(publicTrackingUrlPack.selected_link_id === links.links.find((link) => link.content_id === manualPublishBrief.selected_content_id && link.variant_id === manualPublishBrief.selected_variant_id)?.link_id, "public tracking URL pack selected link must match tracking_links.json");
assert(publicTrackingUrlPack.current_local_tracking_url === manualPublishBrief.tracking_url, "public tracking URL pack current URL must match manual brief");
assert(publicTrackingUrlPack.current_tracking_url_public_ready === isPublicHttpUrlForVerifier(publicTrackingUrlPack.current_local_tracking_url), "public tracking URL pack current URL readiness must match verifier");
assert(publicTrackingUrlPack.current_tracking_url_public_ready === false, "public tracking URL pack must keep current local URL blocked");
assert(publicTrackingUrlPack.current_worker_base_public_ready === isPublicHttpUrlForVerifier(publicTrackingUrlPack.current_worker_public_base), "public tracking URL pack Worker base readiness must match the observed config URL");
assert(publicTrackingUrlPack.public_tracking_url_ready === false, "public tracking URL pack must not mark public tracking ready without owner gates");
assert(publicTrackingUrlPack.formal_publish_ready === false, "public tracking URL pack must block formal publish");
assert(publicTrackingUrlPack.owner_decision_required === true, "public tracking URL pack must require owner decision");
assert(publicTrackingUrlPack.selected_public_tracking_url_preview.includes("OWNER_APPROVED_WORKER_URL"), "public tracking URL pack must use owner-approved placeholder in selected URL preview");
assert(publicTrackingUrlPack.selected_public_tracking_url_preview.includes("/r/challenger-week0-cta-text-v1"), "public tracking URL pack selected preview must preserve tracking route");
assert(publicTrackingUrlPack.selected_public_candidate_url_preview.includes("/candidate?"), "public tracking URL pack candidate preview must include candidate route");
assert(publicTrackingUrlPack.line_cta_public_tracking_url_preview.includes("to=line"), "public tracking URL pack LINE preview must preserve line target");
assert(publicTrackingUrlPack.ab_router_public_url_preview.includes("/ab/ab-week0-cta-text-001"), "public tracking URL pack A/B preview must preserve router route");
assert(publicTrackingUrlPack.gate_order.includes("remote_d1_create_and_migrate"), "public tracking URL pack must include remote D1 gate order");
assert(publicTrackingUrlPack.gate_order.includes("candidate_worker_production_deploy"), "public tracking URL pack must include Worker deploy gate order");
assert(publicTrackingUrlPack.gate_order.includes("public_ab_small_traffic_link"), "public tracking URL pack must include public A/B gate order");
assert(publicTrackingUrlPack.blocked_actions.includes("production_worker_deploy"), "public tracking URL pack must block production Worker deploy");
assert(publicTrackingUrlPack.blocked_actions.includes("public_tracking_url_activation"), "public tracking URL pack must block public URL activation");
assert(publicTrackingUrlPack.blocked_actions.includes("formal_social_post_or_schedule"), "public tracking URL pack must block formal social post");
assert(publicTrackingUrlPack.gates.length === 3, "public tracking URL pack must expose three owner gate summaries");
assert(publicTrackingUrlPack.post_gate_verification.length === 2, "public tracking URL pack must expose post-gate verification summaries");
assertNoRedLineFlags(publicTrackingUrlPack, "public tracking URL pack");
assert(publicTrackingUrlPackStatus.ok === true, "public tracking URL pack compact status must be ok");
assert(publicTrackingUrlPackStatus.mode === "public_tracking_url_pack_local_only", "public tracking URL pack compact mode must match");
assert(publicTrackingUrlPackStatus.status === publicTrackingUrlPack.status, "public tracking URL pack compact status must match");
assert(publicTrackingUrlPackStatus.public_tracking_url_ready === publicTrackingUrlPack.public_tracking_url_ready, "public tracking URL pack compact readiness must match");
assert(publicTrackingUrlPackStatus.preview_count === 4, "public tracking URL pack compact status must count four previews");
assertNoRedLineFlags(publicTrackingUrlPackStatus, "public tracking URL pack status");
assert(publicTrackingUrlPackMd.includes("Public Tracking URL Pack"), "public tracking URL pack markdown must have title");
assert(publicTrackingUrlPackMd.includes("Formal post performed: no"), "public tracking URL pack markdown must state no formal post");
assert(publicTrackingUrlPackMd.includes("Production deploy performed: no"), "public tracking URL pack markdown must state no production deploy");
assert(publicTrackingUrlPackMd.includes("data/lp_events.jsonl write performed: no"), "public tracking URL pack markdown must state no lp_events write");
assert(packageJson.scripts["owner:public-url-approval-preview"] === "node scripts/owner-public-url-approval-preview.mjs", "package.json must expose owner public URL approval preview script");
assert(packageJson.scripts.verify.includes("npm run owner:public-url-approval-preview"), "verify chain must include owner public URL approval preview");
assert(weeklyRunnerSource.includes("owner_public_url_approval_preview"), "weekly runner must include owner public URL approval preview step");
assert(weeklyRunnerSource.includes("owner:public-url-approval-preview"), "weekly runner must run owner public URL approval preview");
assert(ownerPublicUrlApprovalPreviewSource.includes("owner_public_url_approval_preview_local_only"), "owner public URL approval preview script must stay local-only");
assert(ownerPublicUrlApprovalPreviewSource.includes("owner_approval_input_write_performed: false"), "owner public URL approval preview must record no owner approval input write");
assert(ownerPublicUrlApprovalPreview.ok === true, "owner public URL approval preview must be ok");
assert(ownerPublicUrlApprovalPreview.mode === "owner_public_url_approval_preview_local_only", "owner public URL approval preview mode must be local-only");
assert(ownerPublicUrlApprovalPreview.status === "prepared_but_blocked_owner_approval_input", "owner public URL approval preview must stay prepared-but-blocked until owner metadata exists");
assert(ownerPublicUrlApprovalPreview.selected_packet_id === publicTrackingUrlPack.selected_packet_id, "owner public URL approval preview selected packet must match public tracking pack");
assert(ownerPublicUrlApprovalPreview.selected_content_id === publicTrackingUrlPack.selected_content_id, "owner public URL approval preview selected content must match public tracking pack");
assert(ownerPublicUrlApprovalPreview.selected_variant_id === publicTrackingUrlPack.selected_variant_id, "owner public URL approval preview selected variant must match public tracking pack");
assert(ownerPublicUrlApprovalPreview.selected_public_tracking_url_preview === publicTrackingUrlPack.selected_public_tracking_url_preview, "owner public URL approval preview selected URL must match public tracking pack");
assert(ownerPublicUrlApprovalPreview.required_gate_ids.length === 3, "owner public URL approval preview must focus on three public URL gates");
for (const expectedGate of ["remote_d1_create_and_migrate", "candidate_worker_production_deploy", "public_ab_small_traffic_link"]) {
  assert(ownerPublicUrlApprovalPreview.required_gate_ids.includes(expectedGate), `owner public URL approval preview missing gate ${expectedGate}`);
  assert(Array.isArray(ownerPublicUrlApprovalPreview.focused_owner_fields[expectedGate]), `owner public URL approval preview missing fields for ${expectedGate}`);
}
assert(ownerPublicUrlApprovalPreview.required_field_count === 15, "owner public URL approval preview must expose 15 required owner fields");
assert(ownerPublicUrlApprovalPreview.owner_approval_input_patch_preview.preview_only === true, "owner public URL approval preview patch must be preview-only");
assert(ownerPublicUrlApprovalPreview.owner_approval_input_patch_preview.write_target === "owner_approval_input.json", "owner public URL approval preview patch target must be owner_approval_input.json");
assert(ownerPublicUrlApprovalPreview.owner_approval_input_patch_preview.approvals.length === 3, "owner public URL approval preview patch must include three approval rows");
assert(ownerPublicUrlApprovalPreview.owner_approval_input_patch_preview.context_only_not_part_of_owner_approval_input.selected_public_tracking_url_preview === publicTrackingUrlPack.selected_public_tracking_url_preview, "owner public URL approval preview context must preserve selected URL preview");
assert(ownerPublicUrlApprovalPreview.commands_after_owner_fills_preview.includes("npm run approval:plan"), "owner public URL approval preview must include approval plan command");
assert(ownerPublicUrlApprovalPreview.commands_after_owner_fills_preview.includes("npm run post:verify"), "owner public URL approval preview must include post-gate verification command");
assert(ownerPublicUrlApprovalPreview.commands_after_owner_fills_preview.includes("npm run public:tracking-pack"), "owner public URL approval preview must include public tracking pack refresh command");
assert(ownerPublicUrlApprovalPreview.blocked_actions.includes("create_live_owner_approval_input"), "owner public URL approval preview must block live approval input creation");
assert(ownerPublicUrlApprovalPreview.blocked_actions.includes("production_worker_deploy"), "owner public URL approval preview must block production Worker deploy");
assert(ownerPublicUrlApprovalPreview.blocked_actions.includes("public_tracking_url_activation"), "owner public URL approval preview must block public URL activation");
assert(ownerPublicUrlApprovalPreview.blocked_actions.includes("formal_social_post_or_schedule"), "owner public URL approval preview must block formal social post");
assert(ownerPublicUrlApprovalPreview.live_input_files_created === false, "owner public URL approval preview must not create live input files");
assert(ownerPublicUrlApprovalPreview.owner_approval_input_write_performed === false, "owner public URL approval preview must not write owner_approval_input.json");
assert(ownerPublicUrlApprovalPreview.gate_summaries.every((gate) => gate.external_effect === false && gate.execution_performed === false), "owner public URL approval preview gate summaries must be plan-only");
assertNoRedLineFlags(ownerPublicUrlApprovalPreview, "owner public URL approval preview");
assert(ownerPublicUrlApprovalPreviewStatus.ok === true, "owner public URL approval preview compact status must be ok");
assert(ownerPublicUrlApprovalPreviewStatus.mode === "owner_public_url_approval_preview_local_only", "owner public URL approval preview compact mode must match");
assert(ownerPublicUrlApprovalPreviewStatus.status === ownerPublicUrlApprovalPreview.status, "owner public URL approval preview compact status must match");
assert(ownerPublicUrlApprovalPreviewStatus.required_gate_count === 3, "owner public URL approval preview compact status must count three gates");
assert(ownerPublicUrlApprovalPreviewStatus.required_field_count === 15, "owner public URL approval preview compact status must count 15 fields");
assert(ownerPublicUrlApprovalPreviewStatus.live_input_files_created === false, "owner public URL approval preview compact status must not create live input files");
assert(ownerPublicUrlApprovalPreviewStatus.owner_approval_input_write_performed === false, "owner public URL approval preview compact status must not write owner approval input");
assertNoRedLineFlags(ownerPublicUrlApprovalPreviewStatus, "owner public URL approval preview status");
assert(ownerPublicUrlApprovalPreviewMd.includes("Owner Public URL Approval Preview"), "owner public URL approval preview markdown must have title");
assert(ownerPublicUrlApprovalPreviewMd.includes("owner_approval_input.json write performed: no"), "owner public URL approval preview markdown must state no approval input write");
assert(ownerPublicUrlApprovalPreviewMd.includes("Production deploy performed: no"), "owner public URL approval preview markdown must state no production deploy");
assert(ownerPublicUrlApprovalPreviewMd.includes("Public link change performed: no"), "owner public URL approval preview markdown must state no public link change");
assert(ownerPublicUrlApprovalPreviewMd.includes("data/lp_events.jsonl write performed: no"), "owner public URL approval preview markdown must state no lp_events write");
assert(packageJson.scripts["manual:publish-evidence"] === "node scripts/manual-publish-evidence.mjs", "package.json must expose manual publish evidence intake");
assert(packageJson.scripts["manual:publish-evidence:form"] === "node scripts/manual-publish-evidence-form.mjs", "package.json must expose manual publish evidence browser form");
assert(packageJson.scripts["manual:publish-evidence:form:fixtures"] === "node scripts/manual-publish-evidence-form-fixtures.mjs", "package.json must expose manual publish evidence form fixtures");
assert(packageJson.scripts["manual:publish-evidence:fixtures"] === "node scripts/manual-publish-evidence-fixtures.mjs", "package.json must expose manual publish evidence fixtures");
assert(packageJson.scripts.verify.includes("npm run manual:publish-evidence"), "verify chain must include manual publish evidence intake");
assert(packageJson.scripts.verify.includes("npm run manual:publish-evidence:form"), "verify chain must include manual publish evidence browser form");
assert(packageJson.scripts.verify.includes("npm run manual:publish-evidence:form:fixtures"), "verify chain must include manual publish evidence form fixtures");
assert(packageJson.scripts.verify.includes("npm run manual:publish-evidence:fixtures"), "verify chain must include manual publish evidence fixtures");
assert(weeklyRunnerSource.includes("manual_publish_evidence"), "weekly runner must include manual publish evidence step");
assert(weeklyRunnerSource.includes("manual:publish-evidence"), "weekly runner must run manual:publish-evidence");
assert(weeklyRunnerSource.includes("manual_publish_evidence_form"), "weekly runner must include manual publish evidence form step");
assert(weeklyRunnerSource.includes("manual:publish-evidence:form"), "weekly runner must run manual:publish-evidence:form");
assert(weeklyRunnerSource.includes("manual_publish_evidence_form_fixtures"), "weekly runner must include manual publish evidence form fixture step");
assert(weeklyRunnerSource.includes("manual:publish-evidence:form:fixtures"), "weekly runner must run manual:publish-evidence:form:fixtures");
assert(manualPublishEvidenceSource.includes("manual_publish_evidence_local_only"), "manual publish evidence script must stay local-only");
assert(manualPublishEvidenceSource.includes("no_post_url_fetch"), "manual publish evidence script must not fetch post URLs");
assert(manualPublishEvidenceFormSource.includes("manual_publish_evidence_form"), "manual publish evidence form script must keep form mode");
assert(manualPublishEvidenceFormSource.includes("network_calls_performed: false"), "manual publish evidence form script must record no network calls");
assert(manualPublishEvidenceFormSource.includes("post_url_fetch_performed: false"), "manual publish evidence form script must record no URL fetch");
assert(manualPublishEvidenceFormFixturesSource.includes("manual_publish_evidence_form_fixture_dry_run"), "manual publish evidence form fixtures must be dry-run fixtures");
assert(manualPublishEvidenceFixturesSource.includes("manual_publish_evidence_fixture_dry_run"), "manual publish evidence fixtures must be dry-run fixtures");
assert(manualPublishEvidenceStatus.ok === true, "manual publish evidence status must be ok in waiting or valid state");
assert(manualPublishEvidenceStatus.mode === "manual_publish_evidence_local_only", "manual publish evidence status mode must match");
assert(["waiting_for_owner_manual_publish_evidence", "waiting_until_day_3", "ready_for_day_3_counts", "ready_for_day_7_counts", "manual_publish_evidence_ready"].includes(manualPublishEvidenceStatus.status), "manual publish evidence status is invalid");
assert(manualPublishEvidenceStatus.owner_manual_publish_required === true, "manual publish evidence must require owner manual publish");
assert(manualPublishEvidenceStatus.live_input_files_created === false, "manual publish evidence must not create live input files");
assertNoRedLineFlags(manualPublishEvidenceStatus, "manual publish evidence status");
assert(Array.isArray(manualPublishEvidenceStatus.issues) && manualPublishEvidenceStatus.issues.length === 0, "manual publish evidence status must have no issues when ok");
assert(manualPublishEvidenceExample.mode === "manual_publish_evidence_example", "manual publish evidence example mode must match");
assert(Array.isArray(manualPublishEvidenceExample.evidence) && manualPublishEvidenceExample.evidence.length === 1, "manual publish evidence example must include one evidence row");
assert(manualPublishEvidenceExample.evidence[0].packet_id === manualPublishPacket.packets[0].packet_id, "manual publish evidence example must use an existing packet id");
assert(manualPublishEvidenceExample.evidence[0].manual_publish_confirmed === true, "manual publish evidence example must include true manual confirmation");
assert(manualPublishEvidenceExample.evidence[0].pii_checked === true, "manual publish evidence example must include true PII check");
assert(manualPublishEvidenceFormStatus.ok === true, "manual publish evidence form status must be ok");
assert(manualPublishEvidenceFormStatus.mode === "manual_publish_evidence_form", "manual publish evidence form status mode must match");
assert(["ready_local_manual_publish_evidence_form", "manual_publish_evidence_input_detected_review_before_overwrite"].includes(manualPublishEvidenceFormStatus.status), "manual publish evidence form status is invalid");
assert(manualPublishEvidenceFormStatus.packet_count === manualPublishPacket.packet_count, "manual publish evidence form packet count must match manual packet");
assert(manualPublishEvidenceFormStatus.browser_only === true, "manual publish evidence form must be browser-only");
assert(manualPublishEvidenceFormStatus.browser_persistence === false, "manual publish evidence form must not persist in browser");
assert(manualPublishEvidenceFormStatus.form_action === "none", "manual publish evidence form action must be none");
assert(manualPublishEvidenceFormStatus.network_calls_performed === false, "manual publish evidence form must perform no network calls");
assert(manualPublishEvidenceFormStatus.post_url_fetch_performed === false, "manual publish evidence form must perform no post URL fetch");
assert(manualPublishEvidenceFormStatus.live_input_files_created === false, "manual publish evidence form must not create live owner input");
assert(manualPublishEvidenceFormStatus.download_filename === "manual_publish_evidence.json", "manual publish evidence form download filename must match owner input");
assert(manualPublishEvidenceFormStatus.review_download_filename === "manual_publish_evidence_form.review.json", "manual publish evidence form review filename must match");
assertNoRedLineFlags(manualPublishEvidenceFormStatus, "manual publish evidence form status");
assert(manualPublishEvidenceFormHtml.includes("Manual Publish Evidence"), "manual publish evidence form HTML must have title");
assert(manualPublishEvidenceFormHtml.includes("manual_publish_evidence.json"), "manual publish evidence form HTML must include download filename");
assert(manualPublishEvidenceFormHtml.includes('action="none"'), "manual publish evidence form HTML must use action none");
assert(manualPublishEvidenceFormHtml.includes('data-external-effect="false"'), "manual publish evidence form HTML must mark no external effect");
assert(!/\bfetch\s*\(/.test(manualPublishEvidenceFormHtml), "manual publish evidence form HTML must not call fetch");
assert(!/XMLHttpRequest|sendBeacon/i.test(manualPublishEvidenceFormHtml), "manual publish evidence form HTML must not call XHR or sendBeacon");
assert(manualPublishEvidenceFormFixtures.ok === true, "manual publish evidence form fixtures must be ok");
assert(manualPublishEvidenceFormFixtures.mode === "manual_publish_evidence_form_fixture_dry_run", "manual publish evidence form fixture mode must match");
assert(manualPublishEvidenceFormFixtures.scenario_count === 4, "manual publish evidence form fixtures must cover four scenarios");
assert(manualPublishEvidenceFormFixtures.live_input_files_created === false, "manual publish evidence form fixtures must not create live input files");
assert(manualPublishEvidenceFormFixtures.execution_performed === false, "manual publish evidence form fixtures must not claim execution");
assert(manualPublishEvidenceFormFixtures.contract_checks.every((item) => item.ok === true), "manual publish evidence form contract checks must pass");
assertNoRedLineFlags(manualPublishEvidenceFormFixtures, "manual publish evidence form fixtures");
for (const expectedScenario of [
  "form_export_valid_recent_waits_until_day3",
  "form_export_valid_old_ready_for_day7",
  "form_export_sensitive_post_ref_blocked",
  "form_export_missing_pii_check_blocked",
]) {
  assert(manualPublishEvidenceFormFixtures.scenarios.some((scenario) => scenario.id === expectedScenario && scenario.ok === true), `manual publish evidence form fixture missing or failed: ${expectedScenario}`);
}
assert(manualPublishEvidenceFormFixtureReport.includes("manual_publish_evidence_form_fixtures_ok"), "manual publish evidence form fixture report must state fixtures ok");
assert(manualPublishEvidenceFormFixtureReport.includes("form_export_sensitive_post_ref_blocked"), "manual publish evidence form fixture report must include sensitive post ref block");
assert(manualPublishEvidenceFormFixtureReport.includes("data/lp_events.jsonl write performed: no"), "manual publish evidence form fixture report must state no real event write");
assert(manualPublishEvidenceFixtures.ok === true, "manual publish evidence fixtures must be ok");
assert(manualPublishEvidenceFixtures.mode === "manual_publish_evidence_fixture_dry_run", "manual publish evidence fixture mode must match");
assert(manualPublishEvidenceFixtures.scenario_count === 7, "manual publish evidence fixtures must cover seven scenarios");
assert(manualPublishEvidenceFixtures.live_input_files_created === false, "manual publish evidence fixtures must not create live input files");
assertNoRedLineFlags(manualPublishEvidenceFixtures, "manual publish evidence fixtures");
for (const expectedScenario of [
  "no_input_waits_for_owner_publish_evidence",
  "valid_recent_publish_waits_until_day3",
  "valid_old_publish_ready_for_day7",
  "unknown_packet_blocked",
  "sensitive_value_blocked",
  "multiple_packets_blocked",
  "missing_confirmation_blocked",
]) {
  assert(manualPublishEvidenceFixtures.scenarios.some((scenario) => scenario.id === expectedScenario && scenario.ok === true), `manual publish evidence fixture missing or failed: ${expectedScenario}`);
}
assert(manualPublishEvidenceMd.includes("Manual Publish Evidence Intake"), "manual publish evidence markdown must have title");
assert(manualPublishEvidenceMd.includes("Post URL fetch performed: no"), "manual publish evidence markdown must state no URL fetch");
assert(manualPublishEvidenceMd.includes("data/lp_events.jsonl write performed: no"), "manual publish evidence markdown must state no lp_events write");
assert(manualPublishEvidenceFixtureReport.includes("manual_publish_evidence_fixtures_ok"), "manual publish evidence fixture report must state fixtures ok");
assert(manualPublishEvidenceFixtureReport.includes("sensitive_value_blocked"), "manual publish evidence fixture report must include sensitive-value block");
assert(manualPublishEvidenceFixtureReport.includes("multiple_packets_blocked"), "manual publish evidence fixture report must include multiple-packet block");
assert(manualPublishEvidenceFixtureReport.includes("data/lp_events.jsonl write performed: no"), "manual publish evidence fixture report must state no real event write");
assert(funnelBreakdown.mode === "content_variant_attribution", "funnel breakdown mode must be content_variant_attribution");
assert(funnelBreakdown.external_effect === false, "funnel breakdown must not claim external effects");
assert(funnelBreakdown.public_link_change_performed === false, "funnel breakdown must not claim public link changes");
assert(funnelBreakdown.formal_post_performed === false, "funnel breakdown must not claim formal posts");
assert(funnelBreakdown.line_push_performed === false, "funnel breakdown must not claim LINE push");
assert(funnelBreakdown.customer_data_mutation_performed === false, "funnel breakdown must not mutate customer data");
assert(funnelBreakdown.payment_action_performed === false, "funnel breakdown must not touch payments");
assert(funnelBreakdown.delete_action_performed === false, "funnel breakdown must not delete data");
assert(funnelBreakdown.summary.content_variant_links === variants.drafts.length, "funnel breakdown content variant link count mismatch");
assert(funnelBreakdown.rows.filter((row) => row.role === "content_variant").length === variants.drafts.length, "funnel breakdown must include each content variant row");
for (const draft of variants.drafts) {
  assert(funnelBreakdown.rows.some((row) => row.role === "content_variant" && row.content_id === draft.content_id && row.variant_id === draft.variant_id), `funnel breakdown missing row for ${draft.variant_id}`);
}
assert(funnelBreakdownMd.includes("Per 100 Click Attribution"), "funnel breakdown markdown must include attribution table");
assert(funnelBreakdownMd.includes("Formal post performed: no"), "funnel breakdown markdown must state no formal post");
assert(northStar.ok === true, "north star funnel status must be ok");
assert(northStar.mode === "north_star_funnel_local_only", "north star funnel mode must be local-only");
assert(JSON.stringify(northStar.north_star?.path) === JSON.stringify(["link_click", "line_add", "lead_submit", "deal"]), "north star funnel path mismatch");
assert(northStar.north_star?.unit === "per_100_link_clicks", "north star funnel unit must be per 100 link clicks");
assert(northStar.north_star?.primary_metric === "line_adds_per_100_clicks", "north star primary metric must be LINE adds per 100 clicks");
assert(northStar.totals.link_clicks === scores.assets.reduce((total, asset) => total + Number(asset.link_clicks ?? 0), 0), "north star click total must match scores");
assert(northStar.totals.line_adds === scores.assets.reduce((total, asset) => total + Number(asset.line_adds ?? 0), 0), "north star LINE add total must match scores");
assert(northStar.totals.leads === scores.assets.reduce((total, asset) => total + Number(asset.leads ?? 0), 0), "north star lead total must match scores");
assert(northStar.totals.deals === scores.assets.reduce((total, asset) => total + Number(asset.deals ?? 0), 0), "north star deal total must match scores");
assert(northStar.asset_rows.length === scores.assets.length, "north star must include every asset row");
assert(northStar.attribution_rows.length === funnelBreakdown.rows.length, "north star must include every attribution row");
assert(northStar.sample_threshold_met === ownerSampleGateStatus.sample_threshold_met, "north star sample threshold must match owner sample gate");
assert(northStar.challenger_win_rule_met === ownerSampleGateStatus.challenger_win_rule_met, "north star final win rule must match owner sample gate");
assert(northStar.real_events_unchanged === true, "north star must leave real events unchanged");
assert(northStar.data_lp_events_write_performed === false, "north star must not write data/lp_events.jsonl");
assert(northStar.external_effect === false, "north star must not claim external effects");
assert(northStar.public_link_change_performed === false, "north star must not change public links");
assert(northStar.production_deploy_performed === false, "north star must not deploy production");
assert(northStar.formal_post_performed === false, "north star must not formally post");
assert(northStar.line_push_performed === false, "north star must not push LINE");
assert(northStar.customer_data_mutation_performed === false, "north star must not mutate customer data");
assert(northStar.payment_action_performed === false, "north star must not touch payments");
assert(northStar.delete_action_performed === false, "north star must not delete data");
assert(northStarMd.includes("3Q North Star Funnel"), "north star markdown must include title");
assert(northStarMd.includes("Every 100 link clicks"), "north star markdown must state per-100-click path");
assert(northStarMd.includes("data/lp_events.jsonl write performed: no"), "north star markdown must state no lp_events write");
assert(nextRoundPlan.current_round.changed_variable === ab.changed_variable, "next round plan must reference current A/B variable");
assert(nextRoundPlan.next_round.one_variable_rule_ok === true, "next round plan must obey one-variable rule");
assert(nextRoundPlan.approval_gate.review_required === true, "next round plan must remain review gated");
assert(nextRoundPlan.approval_gate.external_effect === false, "next round review gate must have no external effect");
assert(nextRoundPlan.next_round.public_link_change_performed === false, "next round plan must not change public links");
assert(nextRoundPlan.next_round.production_deploy_performed === false, "next round plan must not deploy production");
assert(nextRoundPlan.next_round.formal_post_performed === false, "next round plan must not formally post");
assert(nextRoundPlan.next_round.line_push_performed === false, "next round plan must not push LINE");
assert(nextRoundPlan.next_round.customer_data_mutation_performed === false, "next round plan must not mutate customer data");
assert(nextRoundPlan.next_round.payment_action_performed === false, "next round plan must not touch payments");
assert(nextRoundPlan.next_round.delete_action_performed === false, "next round plan must not delete data");
assert(nextRoundPlan.safety_invariants.no_champion_promotion === true, "next round plan must block champion promotion");
assert(nextRoundPlan.safety_invariants.no_primary_link_change === true, "next round plan must block primary link changes");
assert(nextRoundPlan.sample_gate.min_visits === 100, "next round min_visits must stay 100");
assert(nextRoundPlan.sample_gate.min_cta_clicks === 20, "next round min_cta_clicks must stay 20");
assert(nextRoundPlan.sample_gate.min_line_adds === 5, "next round min_line_adds must stay 5");
assert(nextRoundPlan.sample_gate.min_test_days === 3, "next round min_test_days must stay 3");
assert(nextRoundPlan.sample_gate.preferred_test_days === 7, "next round preferred_test_days must stay 7");
if (!ab.sample_threshold_met) {
  assert(nextRoundPlan.decision === "continue_current_round_until_sample_threshold", "sample-insufficient week must continue the current round");
  assert(nextRoundPlan.next_round.changed_variable === ab.changed_variable, "sample-insufficient week must not rotate the changed variable");
  assert(nextRoundPlan.next_round.start_new_variable_round === false, "sample-insufficient week must not start a new variable round");
}
assert(pipeline.status === "local_prepared_external_blocked", "pipeline status must remain external-blocked");
assert(pipeline.public_link_change_performed === false, "pipeline must not claim public link changes");
assert(pipeline.production_deploy_performed === false, "pipeline must not claim production deploy");
assert(pipeline.delete_action_performed === false, "pipeline must not claim data deletion");
assert(pipeline.schedule_status.external_effect === false, "pipeline schedule status must not claim external effects");
assert(pipeline.schedule_status.launchd_installed === true, "LaunchAgent must be reported installed after local schedule install");
assert(pipeline.schedule_status.install_performed === true, "LaunchAgent install must be reflected in pipeline");
assert(pipeline.schedule_status.file_installed === true, "LaunchAgent plist must be installed");
assert(pipeline.schedule_status.service_loaded === true, "LaunchAgent service must be loaded");
assert(pipeline.schedule_status.local_persistent_schedule === true, "local persistent schedule must be active");
assert(pipeline.schedule_status.local_runner_command === "npm run weekly:local", "pipeline must point to weekly local runner");
assert(pipeline.steps.some((step) => step.step === "deploy_candidate_worker" && step.status === "prepared_but_blocked"), "deploy step must be prepared_but_blocked");
assert(pipeline.steps.some((step) => step.step === "create_ab_plan" && step.status === "local_complete_pending_link_gate"), "A/B plan step must be local complete and link gated");
assert(pipeline.candidate_retirement_queue === "candidate_retirement_queue.json", "pipeline must point to candidate retirement queue");
assert(pipeline.next_round_plan.artifact_json === "next_round_plan.json", "pipeline must point to next round plan JSON");
assert(pipeline.next_round_plan.artifact_md === "next_round_plan.md", "pipeline must point to next round plan markdown");
assert(pipeline.next_round_plan.external_effect === false, "pipeline next round plan must have no external effect");
assert(pipeline.next_round_plan.one_variable_rule_ok === true, "pipeline next round plan must obey one-variable rule");
assert(pipeline.funnel_breakdown.artifact_json === "funnel_breakdown.json", "pipeline must point to funnel breakdown JSON");
assert(pipeline.funnel_breakdown.artifact_md === "funnel_breakdown.md", "pipeline must point to funnel breakdown markdown");
assert(pipeline.funnel_breakdown.content_variant_links === variants.drafts.length, "pipeline funnel breakdown link count mismatch");
assert(pipeline.funnel_breakdown.external_effect === false, "pipeline funnel breakdown must have no external effect");
assert(pipeline.d1_sync_status.external_effect === false, "D1 sync status must have no external effect");
assert(pipeline.d1_sync_status.scoring_input_allowed === (pipeline.d1_sync_status.scope === "remote_aggregate_only"), "only the owner-approved remote aggregate export may become scoring input");
assert(pipeline.d1_sync_status.data_lp_events_write_performed === (pipeline.d1_sync_status.scope === "remote_aggregate_only"), "only the owner-approved remote aggregate export may refresh data/lp_events.jsonl");
assert(Number.isInteger(pipeline.d1_sync_status.synthetic_or_smoke_row_count), "pipeline D1 sync must include smoke row count");
assert(Number.isInteger(pipeline.d1_sync_status.real_event_candidate_rows), "pipeline D1 sync must include real event candidate row count");
assert(pipeline.event_input_quality_status.ok === true, "pipeline must include passing event input quality gate");
assert(pipeline.event_input_quality_status.external_effect === false, "pipeline event input quality gate must have no external effect");
assert(pipeline.event_input_quality_status.scoring_allowed === true, "pipeline event input quality gate must allow clean scoring");
assert(pipeline.event_input_quality_status.pii_or_sensitive_data_detected === false, "pipeline event input quality gate must not detect PII");
assert(pipeline.event_input_quality_status.data_lp_events_write_performed === false, "pipeline event input quality gate must be read-only");
assert(pipeline.funnel_aggregate_status.ok === true, "pipeline must include passing full-funnel aggregate preview");
assert(pipeline.funnel_aggregate_status.mode === "full_funnel_preview", "pipeline full-funnel aggregate must be preview mode");
assert(pipeline.funnel_aggregate_status.external_effect === false, "pipeline full-funnel aggregate must have no external effect");
assert(pipeline.funnel_aggregate_status.apply_performed === false, "pipeline full-funnel aggregate preview must not apply to real events");
assert(pipeline.funnel_aggregate_status.data_lp_events_write_performed === false, "pipeline full-funnel aggregate preview must not write real events");
assert(pipeline.funnel_aggregate_status.contains_sensitive_columns === false, "pipeline full-funnel aggregate must not contain sensitive columns");
assert(pipeline.funnel_aggregate_status.contains_sensitive_values === false, "pipeline full-funnel aggregate must not contain sensitive values");
assert(pipeline.funnel_aggregate_fixture_status.ok === true, "pipeline must include passing full-funnel aggregate fixtures");
assert(pipeline.funnel_aggregate_fixture_status.mode === "funnel_aggregate_fixture_dry_run", "pipeline full-funnel aggregate fixtures must be fixture dry-run");
assert(pipeline.funnel_aggregate_fixture_status.scenario_count === 6, "pipeline full-funnel aggregate fixtures must cover six scenarios");
assert(pipeline.funnel_aggregate_fixture_status.execution_performed === false, "pipeline full-funnel aggregate fixtures must not execute external commands");
assert(pipeline.funnel_aggregate_fixture_status.real_event_write_performed === false, "pipeline full-funnel aggregate fixtures must not write real events");
assert(pipeline.funnel_aggregate_fixture_status.data_lp_events_write_performed === false, "pipeline full-funnel aggregate fixtures must not write data/lp_events.jsonl");
assert(pipeline.funnel_aggregate_fixture_status.external_effect === false, "pipeline full-funnel aggregate fixtures must have no external effect");
assert(pipeline.real_data_apply_fixture_status.ok === true, "pipeline must include passing real-data apply fixtures");
assert(pipeline.real_data_apply_fixture_status.mode === "real_data_apply_fixture_dry_run", "pipeline real-data apply fixtures must be fixture dry-run");
assert(pipeline.real_data_apply_fixture_status.scenario_count === 4, "pipeline real-data apply fixtures must cover four scenarios");
assert(pipeline.real_data_apply_fixture_status.execution_performed === false, "pipeline real-data apply fixtures must not execute external commands");
assert(pipeline.real_data_apply_fixture_status.real_event_write_performed === false, "pipeline real-data apply fixtures must not write real events");
assert(pipeline.real_data_apply_fixture_status.data_lp_events_write_performed === false, "pipeline real-data apply fixtures must not write data/lp_events.jsonl");
assert(pipeline.real_data_apply_fixture_status.external_effect === false, "pipeline real-data apply fixtures must have no external effect");
assert(pipeline.steps.some((step) => step.step === "collect_data" && step.real_data_apply_fixture_status === "real_data_apply_fixture_dry_run"), "collect_data evidence must include real-data apply guard status");
assert(pipeline.real_data_decision_replay_status.ok === true, "pipeline must include passing real-data decision replay");
assert(pipeline.real_data_decision_replay_status.mode === "real_data_decision_replay_fixture_dry_run", "pipeline real-data decision replay must be dry-run");
assert(pipeline.real_data_decision_replay_status.scenario_count === 6, "pipeline real-data decision replay must cover six scenarios");
assert(pipeline.real_data_decision_replay_status.local_fixture_commands_executed === true, "pipeline real-data decision replay must execute local fixture commands");
assert(pipeline.real_data_decision_replay_status.local_importer_preview_commands_executed === true, "pipeline real-data decision replay must execute local importer previews");
assert(pipeline.real_data_decision_replay_status.execution_performed === false, "pipeline real-data decision replay must not execute external commands");
assert(pipeline.real_data_decision_replay_status.real_event_write_performed === false, "pipeline real-data decision replay must not write real events");
assert(pipeline.real_data_decision_replay_status.data_lp_events_write_performed === false, "pipeline real-data decision replay must not write data/lp_events.jsonl");
assert(pipeline.real_data_decision_replay_status.external_effect === false, "pipeline real-data decision replay must have no external effect");
assert(pipeline.steps.some((step) => step.step === "collect_data" && step.real_data_decision_replay_status === "real_data_decision_replay_fixture_dry_run"), "collect_data evidence must include real-data decision replay status");
assert(pipeline.steps.some((step) => step.step === "collect_data" && step.real_data_decision_replay_source_capture_ledger_replay_executed === true), "collect_data evidence must include source-capture ledger replay");
assert(pipeline.steps.some((step) => step.step === "collect_data" && step.real_data_decision_replay_source_capture_compile_commands_executed === true), "collect_data evidence must include source-capture compile commands");
assert(pipeline.steps.some((step) => step.step === "collect_data" && step.real_data_decision_replay_ledger_to_decision_replay_performed === true), "collect_data evidence must include ledger-to-decision replay");
assert(pipeline.steps.some((step) => step.step === "collect_data" && step.real_data_decision_replay_data_lp_events_write_performed === false), "collect_data evidence must include no real-data decision replay data write");
assert(pipeline.source_readiness_status.ok === true, "pipeline must include source readiness status");
assert(pipeline.source_readiness_status.mode === "source_readiness_monitor", "pipeline source readiness mode must be source_readiness_monitor");
assert(pipeline.source_readiness_status.data_lp_events_write_performed === false, "pipeline source readiness must not write real events");
assert(pipeline.source_readiness_status.external_effect === false, "pipeline source readiness must have no external effect");
assert(pipeline.source_trust_status.ok === true, "pipeline must include source trust status");
assert(pipeline.source_trust_status.mode === "source_trust_matrix_local_only", "pipeline source trust mode must be local-only");
assert(pipeline.source_trust_status.status === sourceTrustMatrixStatus.status, "pipeline source trust status must match compact status");
assert(pipeline.source_trust_status.trusted_scoring_source_count === sourceTrustMatrixStatus.trusted_scoring_source_count, "pipeline source trust trusted source count must match");
assert(pipeline.source_trust_status.sample_gate_source_count === sourceTrustMatrixStatus.sample_gate_source_count, "pipeline source trust sample-gate source count must match");
assert(pipeline.source_trust_status.scoring_allowed_now === sourceTrustMatrixStatus.scoring_allowed_now, "pipeline source trust scoring flag must match");
assert(pipeline.source_trust_status.real_event_rows === sourceTrustMatrixStatus.real_event_rows, "pipeline source trust real event rows must match");
assert(pipeline.source_trust_status.p0_pending_count === sourceTrustMatrixStatus.p0_pending_count, "pipeline source trust P0 pending count must match");
assert(pipeline.source_trust_status.data_lp_events_write_performed === false, "pipeline source trust must not write real events");
assert(pipeline.source_trust_status.external_effect === false, "pipeline source trust must have no external effect");
assert(pipeline.steps.some((step) => step.step === "collect_data" && step.source_trust_status === sourceTrustMatrixStatus.status), "collect_data evidence must include source trust status");
assert(pipeline.steps.some((step) => step.step === "collect_data" && step.source_trust_trusted_scoring_source_count === sourceTrustMatrixStatus.trusted_scoring_source_count), "collect_data evidence must include source trust trusted count");
assert(pipeline.steps.some((step) => step.step === "collect_data" && step.source_trust_scoring_allowed_now === sourceTrustMatrixStatus.scoring_allowed_now), "collect_data evidence must include source trust scoring flag");
assert(pipeline.steps.some((step) => step.step === "collect_data" && step.source_trust_data_lp_events_write_performed === false), "collect_data evidence must include no source trust data write");
assert(pipeline.source_capture_status.ok === true, "pipeline must include source capture status");
assert(pipeline.source_capture_status.mode === "source_capture_pack", "pipeline source capture mode must be source_capture_pack");
assert(pipeline.source_capture_status.template_only === true, "pipeline source capture must remain template-only");
assert(pipeline.source_capture_status.live_input_files_created === false, "pipeline source capture must not create live input files");
assert(pipeline.source_capture_status.data_lp_events_write_performed === false, "pipeline source capture must not write data/lp_events.jsonl");
assert(pipeline.source_capture_status.external_effect === false, "pipeline source capture must have no external effect");
assert(pipeline.steps.some((step) => step.step === "collect_data" && step.source_capture_data_lp_events_write_performed === false), "collect_data evidence must include no source capture data write");
assert(pipeline.source_capture_compile_status.ok === true, "pipeline must include source capture compile status");
assert(pipeline.source_capture_compile_status.mode === "source_capture_compile_preview", "pipeline source capture compile mode must be preview");
assert(["waiting_for_filled_counts", "owner_preview_ready"].includes(pipeline.source_capture_compile_status.status), "pipeline source capture compile status is invalid");
assert(pipeline.source_capture_compile_status.live_input_files_created === false, "pipeline source capture compile must not create live input files");
assert(pipeline.source_capture_compile_status.data_lp_events_write_performed === false, "pipeline source capture compile must not write data/lp_events.jsonl");
assert(pipeline.source_capture_compile_status.external_effect === false, "pipeline source capture compile must have no external effect");
assert(pipeline.steps.some((step) => step.step === "collect_data" && step.source_capture_compile_data_lp_events_write_performed === false), "collect_data evidence must include no source compile data write");
assert(pipeline.source_capture_compile_fixture_status.ok === true, "pipeline must include source capture compile fixture status");
assert(pipeline.source_capture_compile_fixture_status.mode === "source_capture_compile_fixture_dry_run", "pipeline source capture compile fixtures must be dry-run");
assert(pipeline.source_capture_compile_fixture_status.scenario_count === 7, "pipeline source capture compile fixtures must cover seven scenarios");
assert(pipeline.source_capture_compile_fixture_status.execution_performed === false, "pipeline source capture compile fixtures must not execute external commands");
assert(pipeline.source_capture_compile_fixture_status.data_lp_events_write_performed === false, "pipeline source capture compile fixtures must not write data/lp_events.jsonl");
assert(pipeline.source_capture_compile_fixture_status.external_effect === false, "pipeline source capture compile fixtures must have no external effect");
assert(pipeline.steps.some((step) => step.step === "collect_data" && step.source_capture_compile_fixture_data_lp_events_write_performed === false), "collect_data evidence must include no source compile fixture data write");
assert(pipeline.real_data_intake_status.ok === true, "pipeline must include real-data intake status");
assert(pipeline.real_data_intake_status.mode === "real_data_intake_plan", "pipeline real-data intake mode must be real_data_intake_plan");
assert(pipeline.real_data_intake_status.data_lp_events_write_performed === false, "pipeline real-data intake must not write real events");
assert(pipeline.real_data_intake_status.external_effect === false, "pipeline real-data intake must have no external effect");
assert(pipeline.real_data_intake_status.real_events_unchanged === true, "pipeline real-data intake must leave real events unchanged");
assert(pipeline.steps.some((step) => step.step === "collect_data" && step.real_data_intake_data_lp_events_write_performed === false), "collect_data evidence must include no real-data intake write");
assert(pipeline.data_collection_brief_status.ok === true, "pipeline must include data collection brief status");
assert(pipeline.data_collection_brief_status.mode === "data_collection_brief", "pipeline data collection brief mode must match");
assert(["waiting_for_owner_aggregate_counts", "owner_filled_ledger_detected_compile_next"].includes(pipeline.data_collection_brief_status.status), "pipeline data collection brief status is invalid");
assert(pipeline.data_collection_brief_status.task_count === dataCollectionStatus.task_count, "pipeline data collection task count must match status");
assert(pipeline.data_collection_brief_status.live_input_files_created === false, "pipeline data collection brief must not create live input files");
assert(pipeline.data_collection_brief_status.data_lp_events_write_performed === false, "pipeline data collection brief must not write data/lp_events.jsonl");
assert(pipeline.data_collection_brief_status.external_effect === false, "pipeline data collection brief must have no external effect");
assert(pipeline.steps.some((step) => step.step === "collect_data" && step.data_collection_brief_status === dataCollectionStatus.status), "collect_data evidence must include data collection brief status");
assert(pipeline.steps.some((step) => step.step === "collect_data" && step.data_collection_brief_data_lp_events_write_performed === false), "collect_data evidence must include no data collection brief write");
assert(pipeline.manual_conversion_status.external_effect === false, "manual conversion status must have no external effect");
assert(pipeline.manual_conversion_status.mode === "preview", "manual conversion status must remain preview during verification");
assert(pipeline.manual_conversion_status.apply_performed === false, "manual conversion preview must not apply to real events");
assert(pipeline.line_inbound_status.ok === true, "pipeline must include passing LINE inbound playbook status");
assert(pipeline.line_inbound_status.mode === "line_inbound_fixture_dry_run", "pipeline LINE inbound mode must be fixture dry-run");
assert(pipeline.line_inbound_status.execution_performed === false, "pipeline LINE inbound playbook must not execute external commands");
assert(pipeline.line_inbound_status.external_effect === false, "pipeline LINE inbound playbook must have no external effect");
assert(pipeline.line_inbound_status.line_push_performed === false, "pipeline LINE inbound playbook must not push LINE");
assert(pipeline.line_inbound_status.customer_data_mutation_performed === false, "pipeline LINE inbound playbook must not mutate customer data");
assert(pipeline.line_inbound_status.payment_action_performed === false, "pipeline LINE inbound playbook must not touch payments");
assert(pipeline.line_inbound_status.delete_action_performed === false, "pipeline LINE inbound playbook must not delete data");
assert(pipeline.line_inbound_status.data_lp_events_write_performed === false, "pipeline LINE inbound playbook must not write real lp_events");
assert(pipeline.worker_dry_run_status.ok === true, "pipeline must include successful Worker dry-run status");
assert(pipeline.worker_dry_run_status.dry_run_exit_observed === true, "pipeline Worker dry-run must observe dry-run exit");
assert(pipeline.worker_dry_run_status.required_markers_present === true, "pipeline Worker dry-run must include required bindings");
assert(pipeline.worker_dry_run_status.deploy_performed === false, "pipeline Worker dry-run must not deploy");
assert(pipeline.worker_dry_run_status.production_deploy_performed === false, "pipeline Worker dry-run must not claim production deploy");
assert(pipeline.worker_dry_run_status.external_effect === false, "pipeline Worker dry-run must not claim external effects");
assert(pipeline.steps.some((step) => step.step === "deploy_candidate_worker" && step.dry_run_ok === true && step.production_deploy_performed === false), "deploy_candidate_worker step must include dry-run evidence without production deploy");
assert(pipeline.browser_smoke_status.ok === true, "pipeline must include successful browser smoke status");
assert(pipeline.browser_smoke_status.event_write_performed === false, "browser smoke must not write funnel events");
assert(pipeline.browser_smoke_status.external_effect === false, "browser smoke status must not claim external effects");
assert(pipeline.tracking_link_smoke_status.ok === true, "pipeline must include successful tracking link smoke status");
assert(pipeline.tracking_link_smoke_status.links_checked === links.links.length, "pipeline tracking link smoke must check every link");
assert(pipeline.tracking_link_smoke_status.real_event_write_performed === false, "pipeline tracking link smoke must not write real events");
assert(pipeline.tracking_link_smoke_status.data_lp_events_write_performed === false, "pipeline tracking link smoke must not write data/lp_events.jsonl");
assert(pipeline.tracking_link_smoke_status.external_effect === false, "pipeline tracking link smoke must not claim external effects");
assert(JSON.stringify(pipeline.weekly_sequence) === JSON.stringify(objectiveSequence), "pipeline sequence must match objective sequence");
assert(pipeline.all_steps_represented === true, "pipeline must represent all objective steps");
assert(JSON.stringify(pipeline.steps.map((step) => step.step)) === JSON.stringify(objectiveSequence), "pipeline step evidence must match objective order");
assert(d1Sync.external_effect === false, "D1 sync must not claim external effects");
assert(["local", "remote_aggregate_only", "not_run"].includes(d1Sync.scope), "D1 sync scope is invalid");
assert(d1Sync.scope !== "remote_aggregate_only" || d1Sync.ok === true, "remote aggregate D1 sync must only be recorded after approved success");
assert(d1Sync.scope !== "local" || d1Sync.scoring_input_allowed === false, "local D1 sync must never be scoring input");
assert(d1Sync.scope !== "local" || d1Sync.local_review_only === true, "local D1 sync must be review-only");
assert(d1Sync.scope !== "local" || d1Sync.data_lp_events_write_performed === false, "local D1 sync must not write data/lp_events.jsonl");
assert(d1Sync.scope === "remote_aggregate_only"
  ? Number.isInteger(d1Sync.aggregate_rows_read) && Number.isInteger(d1Sync.rows_exported)
  : Number.isInteger(d1Sync.synthetic_or_smoke_row_count) && Number.isInteger(d1Sync.real_event_candidate_rows),
"D1 sync must expose aggregate counts for remote scope or smoke/real-candidate counts for local scope");
assert(d1CollectionGuardMd.includes("# D1 Collection Guard"), "D1 collection guard report must have a title");
assert(d1CollectionGuardMd.includes(`Scoring input allowed: ${expectedWeeklyAggregateReadAuthorized ? "yes" : "no"}`), "D1 collection guard must mirror whether the validated aggregate export is scoring-eligible");
assert(d1CollectionGuardMd.includes(`data/lp_events.jsonl write performed: ${expectedWeeklyAggregateReadAuthorized ? "yes" : "no"}`), "D1 collection guard must mirror whether the authorized aggregate export refreshed local scoring events");
assert(d1CollectionMode.ok === true, "D1 collection mode selector must complete");
assert(d1CollectionMode.mode === "owner_evidence_driven_d1_collection_selector", "D1 collection mode must use owner evidence");
assert(d1CollectionMode.selected_scope === (expectedWeeklyAggregateReadAuthorized ? "remote_aggregate_only" : "local_review_only"), "D1 collection scope must mirror recurring aggregate-read authorization");
assert(d1CollectionMode.remote_read_authorized === expectedWeeklyAggregateReadAuthorized, "D1 collection remote authorization must mirror validated owner evidence");
assert(d1CollectionMode.remote_read_performed === expectedWeeklyAggregateReadAuthorized, "D1 collection must perform only the authorized aggregate read path");
assert(d1CollectionMode.raw_event_rows_read_performed === false && d1CollectionMode.customer_data_read_performed === false, "D1 collection must never read raw event rows or customer data");
assert(d1CollectionMode.raw_event_rows_read_performed === false, "D1 collection must never read raw remote event rows");
assert(d1CollectionMode.customer_data_read_performed === false, "D1 collection must not read customer data");
assert(d1CollectionMode.data_lp_events_write_performed === expectedWeeklyAggregateReadAuthorized, "D1 collection may refresh real events only through the authorized aggregate path");
assert(d1CollectionModeMd.includes(`Remote read authorized: ${expectedWeeklyAggregateReadAuthorized ? "yes" : "no"}`), "D1 collection report must mirror the current remote-read authorization");
assert(d1CollectionModePlan.ok === true && d1CollectionModePlan.plan_only === true, "D1 collection plan must be a passing plan-only selector run");
assert(d1CollectionModePlan.remote_read_performed === false, "D1 collection plan must not perform remote reads");
assert(d1CollectionModePlanMd.includes("Raw event rows allowed: no"), "D1 collection plan report must forbid raw rows");
assert(d1CollectionModeFixtures.ok === true && d1CollectionModeFixtures.scenario_count === 5, "D1 collection mode fixtures must cover five authorization paths");
assert(d1CollectionModeFixtures.scenarios.find((item) => item.id === "valid_owner_evidence_selects_remote_aggregate_plan")?.remote_read_authorized === true, "D1 selector fixture must prove the approved aggregate-only path");
assert(d1CollectionModeFixtures.scenarios.filter((item) => item.id !== "valid_owner_evidence_selects_remote_aggregate_plan").every((item) => item.selected_scope === "local_review_only"), "all unapproved D1 selector fixtures must stay local");
assert(d1CollectionModeFixtures.remote_read_performed === false && d1CollectionModeFixtures.customer_data_read_performed === false, "D1 selector fixtures must not read remote or customer data");
assert(d1CollectionModeFixtureReport.includes("d1_collection_mode_fixtures_ok"), "D1 selector fixture report must state success");
assert(d1AggregateExportFixtures.ok === true && d1AggregateExportFixtures.scenario_count === 2, "D1 aggregate exporter fixtures must cover blocked and fixture-query paths");
const aggregateFixture = d1AggregateExportFixtures.scenarios.find((item) => item.id === "fixture_wrangler_proves_aggregate_only_export");
assert(aggregateFixture?.aggregate_sql_present === true && aggregateFixture?.sql_has_forbidden_fields === false, "D1 aggregate fixture must prove grouped SQL excludes raw fields");
assert(aggregateFixture?.experiment_campaign_scoped === true, "D1 aggregate fixture must prove scoring input is restricted to the active experiment campaign");
assert(aggregateFixture?.rows_exported === 6 && aggregateFixture?.deterministic_ids === true, "D1 aggregate fixture must expand deterministic scoring events");
assert(d1AggregateExportFixtures.real_remote_cli_performed === false && d1AggregateExportFixtures.customer_data_read_performed === false, "D1 aggregate fixtures must not perform real remote or customer-data reads");
assert(d1AggregateExportFixtureReport.includes("d1_aggregate_export_fixtures_ok"), "D1 aggregate fixture report must state success");
assert(packageJson.scripts["collect:d1:auto"] === "node scripts/collect-d1-auto.mjs", "package must expose owner-evidence-driven D1 auto collection");
assert(packageJson.scripts["collect:d1:remote:approved"] === "node scripts/export-d1-aggregate-events.mjs --allow-remote", "approved remote collection must use aggregate-only exporter");
assert(packageJson.scripts.verify.includes("d1:collection:fixtures") && packageJson.scripts.verify.includes("d1:aggregate:fixtures"), "verify chain must cover D1 selector and aggregate exporter fixtures");
assert(collectD1AutoSource.includes("recurring_aggregate_read_approved") && collectD1AutoSource.includes("post_gate_verification_ready"), "D1 auto selector must require recurring-read approval and post-gate readiness");
assert(exportD1RawSource.includes("Raw remote event export is disabled"), "legacy D1 exporter must block raw remote reads");
assert(exportD1AggregateSource.includes("COUNT(*) AS event_count") && exportD1AggregateSource.includes("RAW_FIELDS_EXCLUDED"), "D1 aggregate exporter must query grouped counts and declare raw-field exclusions");
assert(exportD1AggregateSource.includes("WHERE campaign =") && exportD1AggregateSource.includes("experiment_campaign"), "D1 aggregate exporter must exclude QA and unscoped traffic from scoring input");
assert(d1CollectionModeFixturesSource.includes("valid_owner_evidence_selects_remote_aggregate_plan"), "D1 selector fixtures must include the approved path");
assert(d1AggregateExportFixturesSource.includes("fixture_wrangler_proves_aggregate_only_export"), "D1 aggregate fixtures must include a fixture Wrangler path");
assert(eventInputQuality.ok === true, "event input quality gate must pass");
assert(eventInputQuality.mode === "real_event_input_quality_gate", "event input quality mode must be real_event_input_quality_gate");
assert(eventInputQuality.external_effect === false, "event input quality gate must not claim external effects");
assert(eventInputQuality.scoring_allowed === true, "event input quality gate must allow scoring only when clean");
assert(eventInputQuality.pii_or_sensitive_data_detected === false, "event input quality gate must not detect PII");
assert(eventInputQuality.data_lp_events_write_performed === false, "event input quality gate must be read-only");
assert(Array.isArray(eventInputQuality.issues) && eventInputQuality.issues.length === 0, "event input quality gate must have no issues");
assert(Array.isArray(eventInputQuality.duplicate_event_ids) && eventInputQuality.duplicate_event_ids.length === 0, "event input quality gate must reject duplicate event IDs");
assert(Array.isArray(eventInputQuality.unknown_asset_ids) && eventInputQuality.unknown_asset_ids.length === 0, "event input quality gate must reject unknown assets");
assert(Array.isArray(eventInputQuality.unknown_event_types) && eventInputQuality.unknown_event_types.length === 0, "event input quality gate must reject unknown event types");
assert(Array.isArray(eventInputQuality.unknown_keys) && eventInputQuality.unknown_keys.length === 0, "event input quality gate must reject unknown keys");
assert(eventInputQuality.privacy_rules?.aggregate_or_pseudonymous_only === true, "event input quality gate must document aggregate/pseudonymous-only policy");
assert(funnelAggregate.ok === true, "full-funnel aggregate preview status must be ok");
assert(funnelAggregate.mode === "full_funnel_preview", "full-funnel aggregate verification must use preview mode");
assert(funnelAggregate.external_effect === false, "full-funnel aggregate import must not claim external effects");
assert(funnelAggregate.apply_performed === false, "full-funnel aggregate preview must not write to real events");
assert(funnelAggregate.append_performed === false, "full-funnel aggregate preview must not append");
assert(funnelAggregate.data_lp_events_write_performed === false, "full-funnel aggregate preview must not write data/lp_events.jsonl");
assert(funnelAggregate.contains_sensitive_columns === false, "full-funnel aggregate CSV must not contain sensitive columns");
assert(funnelAggregate.contains_sensitive_values === false, "full-funnel aggregate CSV must not contain sensitive values");
assert(funnelAggregate.output_path.endsWith("/data/funnel_aggregates.preview.jsonl"), "full-funnel aggregate preview must write to preview JSONL");
assert(funnelAggregate.events_written === funnelAggregatePreviewEvents.length, "full-funnel aggregate preview count must match JSONL lines");
for (const expected of ["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"]) {
  assert(funnelAggregate.allowed_event_types.includes(expected), `full-funnel aggregate must allow ${expected}`);
}
assert(["link_click", "page_view", "cta_click"].every((eventType) => (funnelAggregate.counts_by_event_type?.[eventType] ?? 0) > 0), "full-funnel aggregate preview must cover top-of-funnel events");
assert(funnelAggregatePreviewEvents.every((event) => ["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"].includes(event.event_type)), "full-funnel preview must only include allowed event types");
assert(funnelAggregatePreviewEvents.every((event) => event.content_id && event.variant_id), "full-funnel preview events must include content attribution");
assert(funnelAggregatePreviewEvents.every((event) => event.metadata_json?.aggregate_only === true), "full-funnel preview events must be aggregate-only");
assert(!/phone|email|line_user_id|customer_name|address|payment|card|note|memo|message|conversation/i.test(funnelAggregateCsv), "full-funnel example CSV must not include sensitive columns");
assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(funnelAggregatePreviewRaw), "full-funnel preview must not include email-like values");
assert(funnelAggregateFixture.ok === true, "full-funnel aggregate fixture status must be ok");
assert(funnelAggregateFixture.mode === "funnel_aggregate_fixture_dry_run", "full-funnel aggregate fixture mode must be dry-run");
assert(funnelAggregateFixture.scenario_count === 6, "full-funnel aggregate fixtures must cover six scenarios");
assert(funnelAggregateFixture.execution_performed === false, "full-funnel aggregate fixtures must not execute external commands");
assert(funnelAggregateFixture.real_event_write_performed === false, "full-funnel aggregate fixtures must not write real events");
assert(funnelAggregateFixture.data_lp_events_write_performed === false, "full-funnel aggregate fixtures must not write data/lp_events.jsonl");
assert(funnelAggregateFixture.external_effect === false, "full-funnel aggregate fixtures must not claim external effects");
assert(funnelAggregateFixture.public_link_change_performed === false, "full-funnel aggregate fixtures must not change public links");
assert(funnelAggregateFixture.production_deploy_performed === false, "full-funnel aggregate fixtures must not deploy production");
assert(funnelAggregateFixture.github_push_or_pr_performed === false, "full-funnel aggregate fixtures must not push or create PR");
assert(funnelAggregateFixture.formal_post_performed === false, "full-funnel aggregate fixtures must not formally post");
assert(funnelAggregateFixture.line_push_performed === false, "full-funnel aggregate fixtures must not push LINE");
assert(funnelAggregateFixture.customer_data_mutation_performed === false, "full-funnel aggregate fixtures must not mutate customer data");
assert(funnelAggregateFixture.payment_action_performed === false, "full-funnel aggregate fixtures must not touch payments");
assert(funnelAggregateFixture.delete_action_performed === false, "full-funnel aggregate fixtures must not delete data");
for (const expected of [
  "valid_full_funnel_preview",
  "blocked_unknown_asset",
  "blocked_missing_content_id",
  "blocked_sensitive_column",
  "blocked_sensitive_value",
  "blocked_apply_without_append",
]) {
  const scenario = funnelAggregateFixture.scenarios.find((item) => item.id === expected);
  assert(scenario?.ok === true, `full-funnel aggregate fixture missing passing scenario ${expected}`);
  assert(scenario.data_lp_events_write_performed === false, `full-funnel aggregate fixture must not write real events: ${expected}`);
}
assert(funnelAggregateFixture.scenarios.find((item) => item.id === "blocked_sensitive_column")?.contains_sensitive_columns === true, "full-funnel aggregate fixture must detect sensitive columns");
assert(funnelAggregateFixture.scenarios.find((item) => item.id === "blocked_sensitive_value")?.contains_sensitive_values === true, "full-funnel aggregate fixture must detect sensitive values");
assert(funnelAggregateFixture.scenarios.find((item) => item.id === "blocked_apply_without_append")?.real_events_unchanged === true, "full-funnel aggregate apply-without-append fixture must leave real events unchanged");
assert(realDataApplyFixture.ok === true, "real-data apply fixture status must be ok");
assert(realDataApplyFixture.mode === "real_data_apply_fixture_dry_run", "real-data apply fixture mode must be dry-run");
assert(realDataApplyFixture.scenario_count === 4, "real-data apply fixtures must cover four scenarios");
assert(realDataApplyFixture.execution_performed === false, "real-data apply fixtures must not execute external commands");
assert(realDataApplyFixture.real_event_write_performed === false, "real-data apply fixtures must not write real events");
assert(realDataApplyFixture.data_lp_events_write_performed === false, "real-data apply fixtures must not write data/lp_events.jsonl");
assert(realDataApplyFixture.external_effect === false, "real-data apply fixtures must not claim external effects");
assert(realDataApplyFixture.public_link_change_performed === false, "real-data apply fixtures must not change public links");
assert(realDataApplyFixture.production_deploy_performed === false, "real-data apply fixtures must not deploy production");
assert(realDataApplyFixture.github_push_or_pr_performed === false, "real-data apply fixtures must not push or create PR");
assert(realDataApplyFixture.formal_post_performed === false, "real-data apply fixtures must not formally post");
assert(realDataApplyFixture.line_push_performed === false, "real-data apply fixtures must not push LINE");
assert(realDataApplyFixture.customer_data_mutation_performed === false, "real-data apply fixtures must not mutate customer data");
assert(realDataApplyFixture.payment_action_performed === false, "real-data apply fixtures must not touch payments");
assert(realDataApplyFixture.delete_action_performed === false, "real-data apply fixtures must not delete data");
for (const expected of [
  "funnel_apply_requires_confirm_real_data",
  "funnel_copied_example_never_applies",
  "manual_apply_requires_confirm_real_data",
  "manual_copied_example_never_applies",
]) {
  const scenario = realDataApplyFixture.scenarios.find((item) => item.id === expected);
  assert(scenario?.ok === true, `real-data apply fixture missing passing scenario ${expected}`);
  assert(scenario.data_lp_events_write_performed === false, `real-data apply fixture must not write real events: ${expected}`);
  assert(scenario.real_events_unchanged === true, `real-data apply fixture must leave real events unchanged: ${expected}`);
}
assert(realDataApplyFixture.scenarios.find((item) => item.id === "funnel_copied_example_never_applies")?.example_input_detected === true, "real-data apply fixture must detect copied full-funnel example input");
assert(realDataApplyFixture.scenarios.find((item) => item.id === "manual_copied_example_never_applies")?.example_input_detected === true, "real-data apply fixture must detect copied manual example input");
assert(packageJson.scripts["import:funnel:apply"].includes("--confirm-real-data"), "funnel apply script must require --confirm-real-data");
assert(packageJson.scripts["import:manual:apply"].includes("--confirm-real-data"), "manual apply script must require --confirm-real-data");
assert(packageJson.scripts["apply:fixtures"] === "node scripts/real-data-apply-fixtures.mjs", "package must expose real-data apply fixtures");
assert(packageJson.scripts["real-data:pack"] === "node scripts/real-data-input-pack.mjs", "package must expose real-data input pack");
assert(packageJson.scripts["source:readiness"] === "node scripts/source-readiness.mjs", "package must expose source readiness monitor");
assert(packageJson.scripts["source:capture"] === "node scripts/source-capture-pack.mjs", "package must expose source capture pack");
assert(packageJson.scripts["sample-gate:compile-probe"]?.includes("sample_gate_ledger.fill-template.csv"), "package must expose sample-gate compile probe");
assert(packageJson.scripts["sample-gate:replay"] === "node scripts/sample-gate-replay-fixtures.mjs", "package must expose sample-gate replay fixtures");
assert(packageJson.scripts.verify.includes("sample-gate:replay"), "package verify chain must run sample-gate replay fixtures");
assert(packageJson.scripts["source:compile"] === "node scripts/source-capture-compile.mjs", "package must expose source capture compile preview");
assert(packageJson.scripts["source:compile:fixtures"] === "node scripts/source-capture-compile-fixtures.mjs", "package must expose source capture compile fixtures");
assert(packageJson.scripts["real-data:intake"] === "node scripts/real-data-intake-plan.mjs", "package must expose real-data intake plan");
assert(packageJson.scripts["data:brief"] === "node scripts/data-collection-brief.mjs", "package must expose data collection brief");
assert(packageJson.scripts["data:progress"] === "node scripts/data-collection-progress.mjs", "package must expose data collection progress");
assert(packageJson.scripts["source:trust"] === "node scripts/source-trust-matrix.mjs", "package must expose source trust matrix");
assert(packageJson.scripts.verify.includes("source:trust"), "package verify chain must run source trust matrix");
assert(sourceTrustMatrixSource.includes("selected_source_row_count"), "source trust matrix must read owner data preflight selected row count");
assert(sourceTrustMatrixSource.includes("trusted_preview_below_threshold"), "source trust matrix must distinguish trusted owner-preview rows from sample threshold completion");
assert(packageJson.scripts["next-p0:form"] === "node scripts/next-p0-owner-form.mjs", "package must expose focused next P0 owner form");
assert(packageJson.scripts.verify.includes("next-p0:form"), "package verify chain must run focused next P0 owner form");
assert(packageJson.scripts["next-p0:quick"] === "node scripts/next-p0-quick-capture.mjs", "package must expose focused next P0 quick capture");
assert(packageJson.scripts.verify.includes("next-p0:quick"), "package verify chain must run focused next P0 quick capture");
assert(packageJson.scripts["p0:counts-preflight"] === "node scripts/p0-counts-preflight.mjs", "package must expose P0 counts preflight");
assert(packageJson.scripts.verify.includes("p0:counts-preflight"), "package verify chain must run P0 counts preflight");
assert(packageJson.scripts["next-p0:intake"] === "node scripts/next-p0-owner-intake.mjs", "package must expose focused next P0 owner intake");
assert(packageJson.scripts.verify.includes("next-p0:intake"), "package verify chain must run focused next P0 owner intake");
assert(packageJson.scripts["next-p0:form:fixtures"] === "node scripts/next-p0-owner-form-fixtures.mjs", "package must expose focused next P0 owner form fixtures");
assert(packageJson.scripts.verify.includes("next-p0:form:fixtures"), "package verify chain must run focused next P0 owner form fixtures");
assert(packageJson.scripts["next-p0:quick:fixtures"] === "node scripts/next-p0-quick-capture-fixtures.mjs", "package must expose focused next P0 quick capture fixtures");
assert(packageJson.scripts.verify.includes("next-p0:quick:fixtures"), "package verify chain must run focused next P0 quick capture fixtures");
assert(packageJson.scripts["p0:counts-preflight:fixtures"] === "node scripts/p0-counts-preflight-fixtures.mjs", "package must expose P0 counts preflight fixtures");
assert(packageJson.scripts.verify.includes("p0:counts-preflight:fixtures"), "package verify chain must run P0 counts preflight fixtures");
assert(packageJson.scripts["next-p0:intake:fixtures"] === "node scripts/next-p0-owner-intake-fixtures.mjs", "package must expose focused next P0 owner intake fixtures");
assert(packageJson.scripts.verify.includes("next-p0:intake:fixtures"), "package verify chain must run focused next P0 owner intake fixtures");
assert(packageJson.scripts["sample-gate:calendar"] === "node scripts/sample-gate-capture-calendar.mjs", "package must expose sample-gate capture calendar");
assert(packageJson.scripts.verify.includes("sample-gate:calendar"), "package verify chain must run sample-gate capture calendar");
assert(packageJson.scripts["sample-gate:due:fixtures"] === "node scripts/sample-gate-due-fixtures.mjs", "package must expose sample-gate due fixtures");
assert(packageJson.scripts.verify.includes("sample-gate:due:fixtures"), "package verify chain must run sample-gate due fixtures");
assert(packageJson.scripts["owner:capture-queue"] === "node scripts/week0-owner-capture-queue.mjs", "package must expose Week 0 owner capture queue");
assert(packageJson.scripts.verify.includes("owner:capture-queue"), "package verify chain must run Week 0 owner capture queue");
assert(packageJson.scripts["owner:sample-gate"] === "node scripts/owner-sample-gate-status.mjs", "package must expose owner sample-gate status");
assert(packageJson.scripts.verify.includes("owner:sample-gate"), "package verify chain must run owner sample-gate status");
assert(packageJson.scripts["owner:worksheet"] === "node scripts/sample-gate-owner-worksheet.mjs", "package must expose sample gate owner worksheet");
assert(packageJson.scripts.verify.includes("owner:worksheet"), "package verify chain must run sample gate owner worksheet");
assert(packageJson.scripts["owner:form"] === "node scripts/sample-gate-owner-form.mjs", "package must expose sample gate owner form");
assert(packageJson.scripts.verify.includes("owner:form"), "package verify chain must run sample gate owner form");
assert(packageJson.scripts["owner:form:fixtures"] === "node scripts/sample-gate-owner-form-fixtures.mjs", "package must expose sample gate owner form fixtures");
assert(packageJson.scripts.verify.includes("owner:form:fixtures"), "package verify chain must run sample gate owner form fixtures");
assert(packageJson.scripts["owner:intake"] === "node scripts/owner-sample-gate-intake.mjs", "package must expose owner sample-gate intake guard");
assert(packageJson.scripts.verify.includes("owner:intake"), "package verify chain must run owner sample-gate intake guard");
assert(packageJson.scripts["owner:intake:fixtures"] === "node scripts/owner-sample-gate-intake-fixtures.mjs", "package must expose owner sample-gate intake fixtures");
assert(packageJson.scripts.verify.includes("owner:intake:fixtures"), "package verify chain must run owner sample-gate intake fixtures");
assert(packageJson.scripts["owner:next-action"] === "node scripts/owner-next-action.mjs", "package must expose owner next-action card");
assert(packageJson.scripts.verify.includes("owner:next-action"), "package verify chain must run owner next-action card");
assert(packageJson.scripts["owner:next-action:fixtures"] === "node scripts/owner-next-action-fixtures.mjs", "package must expose owner next-action fixtures");
assert(packageJson.scripts.verify.includes("owner:next-action:fixtures"), "package verify chain must run owner next-action fixtures");
assert(packageJson.scripts["owner:launcher"] === "node scripts/owner-action-launcher.mjs", "package must expose owner action launcher");
assert(packageJson.scripts.verify.includes("owner:launcher"), "package verify chain must run owner action launcher");
assert(packageJson.scripts["owner:approval-form"] === "node scripts/owner-approval-form.mjs", "package must expose owner approval form");
assert(packageJson.scripts["owner:approval-form:fixtures"] === "node scripts/owner-approval-form-fixtures.mjs", "package must expose owner approval form fixtures");
assert(packageJson.scripts.verify.includes("owner:approval-form"), "package verify chain must run owner approval form");
assert(packageJson.scripts.verify.includes("owner:approval-form:fixtures"), "package verify chain must run owner approval form fixtures");
assert(packageJson.scripts["owner:sample-gate:fixtures"] === "node scripts/owner-sample-gate-fixtures.mjs", "package must expose owner sample-gate fixtures");
assert(packageJson.scripts.verify.includes("owner:sample-gate:fixtures"), "package verify chain must run owner sample-gate fixtures");
assert(packageJson.scripts["owner:quality-review"] === "node scripts/owner-quality-review.mjs", "package must expose owner quality-review gate");
assert(packageJson.scripts.verify.includes("owner:quality-review"), "package verify chain must run owner quality-review gate");
assert(packageJson.scripts["owner:quality-review:form"] === "node scripts/owner-quality-review-form.mjs", "package must expose owner quality-review browser form");
assert(packageJson.scripts.verify.includes("owner:quality-review:form"), "package verify chain must run owner quality-review browser form");
assert(packageJson.scripts["owner:quality-review:form:fixtures"] === "node scripts/owner-quality-review-form-fixtures.mjs", "package must expose owner quality-review browser form fixtures");
assert(packageJson.scripts.verify.includes("owner:quality-review:form:fixtures"), "package verify chain must run owner quality-review browser form fixtures");
assert(packageJson.scripts["owner:quality-review:fixtures"] === "node scripts/owner-quality-review-fixtures.mjs", "package must expose owner quality-review fixtures");
assert(packageJson.scripts.verify.includes("owner:quality-review:fixtures"), "package verify chain must run owner quality-review fixtures");
assert(packageJson.scripts["retirement:fixtures"] === "node scripts/candidate-retirement-fixtures.mjs", "package must expose candidate retirement fixtures");
assert(packageJson.scripts.verify.includes("retirement:fixtures"), "package verify chain must run candidate retirement fixtures");
assert(packageJson.scripts["history:iteration"] === "node scripts/iteration-history.mjs", "package must expose iteration history");
assert(packageJson.scripts["github:bundle"] === "node scripts/github-export-bundle.mjs", "package must expose GitHub export bundle");
assert(packageJson.scripts["owner:evidence"] === "node scripts/owner-gate-evidence.mjs", "package must expose owner gate evidence intake");
assert(packageJson.scripts["owner:evidence:fixtures"] === "node scripts/owner-gate-evidence-fixtures.mjs", "package must expose owner gate evidence fixtures");
assert(packageJson.scripts.verify.includes("owner:evidence:fixtures"), "package verify chain must run owner gate evidence fixtures");
assert(packageJson.scripts["post:verify"] === "node scripts/post-gate-verification.mjs", "package must expose post-gate verification plan");
assert(packageJson.scripts["post:verify:fixtures"] === "node scripts/post-gate-verification-fixtures.mjs", "package must expose post-gate verification fixtures");
assert(packageJson.scripts.verify.includes("post:verify:fixtures"), "package verify chain must run post-gate verification fixtures");
assert(packageJson.scripts["gate:readiness"] === "node scripts/gate-readiness-matrix.mjs", "package must expose gate readiness matrix");
assert(packageJson.scripts["variable:fixtures"] === "node scripts/variable-rotation-fixtures.mjs", "package must expose variable rotation fixtures");
assert(packageJson.scripts["decision:replay"] === "node scripts/real-data-decision-replay.mjs", "package must expose real-data decision replay");
assert(packageJson.scripts["north-star"] === "node scripts/north-star-funnel.mjs", "package must expose North Star funnel contract");
assert(packageJson.scripts.verify.includes("north-star"), "package verify chain must run North Star funnel contract");
assert(weeklyRunnerSource.includes("real_data_apply_fixtures"), "weekly runner must include real-data apply fixtures step");
assert(weeklyRunnerSource.includes("apply:fixtures"), "weekly runner must run apply:fixtures");
assert(weeklyRunnerSource.includes("real_data_input_pack"), "weekly runner must include real-data input pack step");
assert(weeklyRunnerSource.includes("real-data:pack"), "weekly runner must run real-data:pack");
assert(weeklyRunnerSource.includes("source_readiness_monitor"), "weekly runner must include source readiness monitor step");
assert(weeklyRunnerSource.includes("source:readiness"), "weekly runner must run source:readiness");
assert(weeklyRunnerSource.includes("source_capture_pack"), "weekly runner must include source capture pack step");
assert(weeklyRunnerSource.includes("source:capture"), "weekly runner must run source:capture");
assert(weeklyRunnerSource.includes("sample_gate_compile_probe"), "weekly runner must include sample-gate compile probe step");
assert(weeklyRunnerSource.includes("sample-gate:compile-probe"), "weekly runner must run sample-gate compile probe");
assert(weeklyRunnerSource.includes("sample_gate_replay_fixtures"), "weekly runner must include sample-gate replay fixture step");
assert(weeklyRunnerSource.includes("sample-gate:replay"), "weekly runner must run sample-gate replay fixtures");
assert(weeklyRunnerSource.includes("source_capture_compile"), "weekly runner must include source capture compile step");
assert(weeklyRunnerSource.includes("source:compile"), "weekly runner must run source:compile");
assert(weeklyRunnerSource.includes("source_capture_compile_fixtures"), "weekly runner must include source capture compile fixtures step");
assert(weeklyRunnerSource.includes("source:compile:fixtures"), "weekly runner must run source:compile:fixtures");
assert(weeklyRunnerSource.includes("data_collection_brief"), "weekly runner must include data collection brief step");
assert(weeklyRunnerSource.includes("data:brief"), "weekly runner must run data:brief");
assert(weeklyRunnerSource.includes("week0_owner_capture_queue"), "weekly runner must include Week 0 owner capture queue step");
assert(weeklyRunnerSource.includes("owner:capture-queue"), "weekly runner must run owner:capture-queue");
assert(weeklyRunnerSource.includes("owner_sample_gate_status"), "weekly runner must include owner sample-gate status step");
assert(weeklyRunnerSource.includes("owner:sample-gate"), "weekly runner must run owner:sample-gate");
assert(weeklyRunnerSource.includes("data_collection_progress"), "weekly runner must include data collection progress step");
assert(weeklyRunnerSource.includes("data:progress"), "weekly runner must run data:progress");
assert(weeklyRunnerSource.includes("source_trust_matrix"), "weekly runner must include source trust matrix step");
assert(weeklyRunnerSource.includes("source:trust"), "weekly runner must run source:trust");
assert(weeklyRunnerSource.includes("next_p0_owner_form"), "weekly runner must include focused next P0 owner form step");
assert(weeklyRunnerSource.includes("next-p0:form"), "weekly runner must run next-p0:form");
assert(weeklyRunnerSource.includes("next_p0_quick_capture"), "weekly runner must include focused next P0 quick capture step");
assert(weeklyRunnerSource.includes("next-p0:quick"), "weekly runner must run next-p0:quick");
assert(weeklyRunnerSource.includes("p0_counts_preflight"), "weekly runner must include P0 counts preflight step");
assert(weeklyRunnerSource.includes("p0:counts-preflight"), "weekly runner must run P0 counts preflight");
assert(weeklyRunnerSource.includes("next_p0_owner_intake"), "weekly runner must include focused next P0 owner intake step");
assert(weeklyRunnerSource.includes("next-p0:intake"), "weekly runner must run next-p0:intake");
assert(weeklyRunnerSource.includes("next_p0_owner_form_fixtures"), "weekly runner must include focused next P0 owner form fixture step");
assert(weeklyRunnerSource.includes("next-p0:form:fixtures"), "weekly runner must run next-p0:form:fixtures");
assert(weeklyRunnerSource.includes("next_p0_quick_capture_fixtures"), "weekly runner must include focused next P0 quick capture fixture step");
assert(weeklyRunnerSource.includes("next-p0:quick:fixtures"), "weekly runner must run next-p0:quick:fixtures");
assert(weeklyRunnerSource.includes("p0_counts_preflight_fixtures"), "weekly runner must include P0 counts preflight fixture step");
assert(weeklyRunnerSource.includes("p0:counts-preflight:fixtures"), "weekly runner must run P0 counts preflight fixtures");
assert(weeklyRunnerSource.includes("next_p0_owner_intake_fixtures"), "weekly runner must include focused next P0 owner intake fixture step");
assert(weeklyRunnerSource.includes("next-p0:intake:fixtures"), "weekly runner must run next-p0:intake:fixtures");
assert(weeklyRunnerSource.includes("sample_gate_capture_calendar"), "weekly runner must include sample-gate capture calendar step");
assert(weeklyRunnerSource.includes("sample-gate:calendar"), "weekly runner must run sample-gate:calendar");
assert(packageJson.scripts["sample-gate:due"] === "node scripts/sample-gate-due-status.mjs", "package.json must expose sample-gate due status script");
assert(packageJson.scripts.verify.includes("npm run sample-gate:due"), "verify chain must include sample-gate due status");
assert(weeklyRunnerSource.includes("sample_gate_due_status"), "weekly runner must include sample-gate due status step");
assert(weeklyRunnerSource.includes("sample-gate:due"), "weekly runner must run sample-gate:due");
assert(weeklyRunnerSource.includes("sample_gate_due_status_fixtures"), "weekly runner must include sample-gate due fixture step");
assert(weeklyRunnerSource.includes("sample-gate:due:fixtures"), "weekly runner must run sample-gate due fixtures");
assert(weeklyRunnerSource.includes("sample_gate_owner_worksheet"), "weekly runner must include sample gate owner worksheet step");
assert(weeklyRunnerSource.includes("owner:worksheet"), "weekly runner must run owner:worksheet");
assert(weeklyRunnerSource.includes("sample_gate_owner_form"), "weekly runner must include sample gate owner form step");
assert(weeklyRunnerSource.includes("owner:form"), "weekly runner must run owner:form");
assert(weeklyRunnerSource.includes("sample_gate_owner_form_fixtures"), "weekly runner must include sample gate owner form fixture step");
assert(weeklyRunnerSource.includes("owner:form:fixtures"), "weekly runner must run owner:form:fixtures");
assert(weeklyRunnerSource.includes("owner_sample_gate_intake"), "weekly runner must include owner sample-gate intake step");
assert(weeklyRunnerSource.includes("owner:intake"), "weekly runner must run owner:intake");
assert(weeklyRunnerSource.includes("owner_sample_gate_intake_fixtures"), "weekly runner must include owner sample-gate intake fixture step");
assert(weeklyRunnerSource.includes("owner:intake:fixtures"), "weekly runner must run owner:intake:fixtures");
assert(weeklyRunnerSource.includes("owner_next_action"), "weekly runner must include owner next-action step");
assert(weeklyRunnerSource.includes("owner:next-action"), "weekly runner must run owner:next-action");
assert(packageJson.scripts["north-star:outcome-preflight"] === "node scripts/north-star-outcome-preflight.mjs", "package.json must expose North Star outcome preflight");
assert(packageJson.scripts.verify.includes("north-star:outcome-preflight"), "verify chain must include North Star outcome preflight");
assert(weeklyRunnerSource.includes("north_star_outcome_preflight"), "weekly runner must include North Star outcome preflight step");
assert(weeklyRunnerSource.includes("north-star:outcome-preflight"), "weekly runner must run North Star outcome preflight");
assert(packageJson.scripts["north-star:outcome-form"] === "node scripts/north-star-outcome-form.mjs", "package.json must expose North Star outcome browser form");
assert(packageJson.scripts["north-star:outcome-form:fixtures"] === "node scripts/north-star-outcome-form-fixtures.mjs", "package.json must expose North Star outcome form fixtures");
assert(packageJson.scripts.verify.includes("north-star:outcome-form"), "verify chain must include North Star outcome form");
assert(packageJson.scripts.verify.includes("north-star:outcome-form:fixtures"), "verify chain must include North Star outcome form fixtures");
assert(weeklyRunnerSource.includes("north_star_outcome_form"), "weekly runner must include North Star outcome form step");
assert(weeklyRunnerSource.includes("north-star:outcome-form"), "weekly runner must run North Star outcome form");
assert(weeklyRunnerSource.includes("north_star_outcome_form_fixtures"), "weekly runner must include North Star outcome form fixture step");
assert(weeklyRunnerSource.includes("north-star:outcome-form:fixtures"), "weekly runner must run North Star outcome form fixtures");
assert(packageJson.scripts["owner:p1-outcome-intake"] === "node scripts/owner-p1-outcome-intake.mjs", "package.json must expose owner P1 outcome intake");
assert(packageJson.scripts["owner:p1-outcome-intake:fixtures"] === "node scripts/owner-p1-outcome-intake-fixtures.mjs", "package.json must expose owner P1 outcome intake fixtures");
assert(packageJson.scripts.verify.includes("owner:p1-outcome-intake"), "verify chain must include owner P1 outcome intake");
assert(packageJson.scripts.verify.includes("owner:p1-outcome-intake:fixtures"), "verify chain must include owner P1 outcome intake fixtures");
assert(weeklyRunnerSource.includes("owner_p1_outcome_intake"), "weekly runner must include owner P1 outcome intake step");
assert(weeklyRunnerSource.includes("owner:p1-outcome-intake"), "weekly runner must run owner P1 outcome intake");
assert(weeklyRunnerSource.includes("owner_p1_outcome_intake_fixtures"), "weekly runner must include owner P1 outcome intake fixture step");
assert(weeklyRunnerSource.includes("owner:p1-outcome-intake:fixtures"), "weekly runner must run owner P1 outcome intake fixtures");
assert(packageJson.scripts["owner:p1-outcome-postfill-check"] === "node scripts/owner-p1-outcome-postfill-check.mjs", "package.json must expose owner P1 outcome post-fill check");
assert(packageJson.scripts.verify.includes("owner:p1-outcome-postfill-check"), "verify chain must include owner P1 outcome post-fill check");
assert(weeklyRunnerSource.includes("owner_p1_outcome_postfill_check"), "weekly runner must include owner P1 outcome post-fill check step");
assert(weeklyRunnerSource.includes("owner:p1-outcome-postfill-check"), "weekly runner must run owner P1 outcome post-fill check");
assert(packageJson.scripts["sample-gate:recovery"] === "node scripts/sample-gate-recovery-pack.mjs", "package.json must expose sample gate recovery pack");
assert(packageJson.scripts.verify.includes("sample-gate:recovery"), "verify chain must include sample gate recovery pack");
assert(weeklyRunnerSource.includes("sample_gate_recovery_pack"), "weekly runner must include sample gate recovery step");
assert(weeklyRunnerSource.includes("sample-gate:recovery"), "weekly runner must run sample-gate:recovery");
assert(packageJson.scripts["sample-gate:batches"] === "node scripts/sample-gate-batch-handoff.mjs", "package.json must expose sample gate batch handoff");
assert(packageJson.scripts.verify.includes("sample-gate:batches"), "verify chain must include sample gate batch handoff");
assert(weeklyRunnerSource.includes("sample_gate_batch_handoff"), "weekly runner must include sample gate batch handoff step");
assert(weeklyRunnerSource.includes("sample-gate:batches"), "weekly runner must run sample-gate:batches");
assert(packageJson.scripts["sample-gate:batch-preflight"] === "node scripts/sample-gate-batch-preflight.mjs", "package.json must expose sample gate batch preflight");
assert(packageJson.scripts.verify.includes("sample-gate:batch-preflight"), "verify chain must include sample gate batch preflight");
assert(weeklyRunnerSource.includes("sample_gate_batch_preflight"), "weekly runner must include sample gate batch preflight step");
assert(weeklyRunnerSource.includes("sample-gate:batch-preflight"), "weekly runner must run sample-gate:batch-preflight");
assert(packageJson.scripts["owner:sample-count-handoff"] === "node scripts/owner-sample-count-handoff.mjs", "package.json must expose owner sample count handoff");
assert(packageJson.scripts.verify.includes("owner:sample-count-handoff"), "verify chain must include owner sample count handoff");
assert(weeklyRunnerSource.includes("owner_sample_count_handoff"), "weekly runner must include owner sample count handoff step");
assert(weeklyRunnerSource.includes("owner:sample-count-handoff"), "weekly runner must run owner sample count handoff");
assert(packageJson.scripts["owner:p0-now"] === "node scripts/owner-p0-now.mjs", "package.json must expose owner P0-now card");
assert(packageJson.scripts.verify.includes("owner:p0-now"), "verify chain must include owner P0-now card");
assert(weeklyRunnerSource.includes("owner_p0_now"), "weekly runner must include owner P0-now step");
assert(weeklyRunnerSource.includes("owner:p0-now"), "weekly runner must run owner P0-now card");
assert(packageJson.scripts["owner:p0-launcher"] === "node scripts/owner-p0-launcher.mjs", "package.json must expose owner P0 launcher");
assert(packageJson.scripts.verify.includes("owner:p0-launcher"), "verify chain must include owner P0 launcher");
assert(weeklyRunnerSource.includes("owner_p0_launcher"), "weekly runner must include owner P0 launcher step");
assert(weeklyRunnerSource.includes("owner:p0-launcher"), "weekly runner must run owner P0 launcher");
assert(packageJson.scripts["owner:sample-count-recovery"] === "node scripts/owner-sample-count-recovery.mjs", "package.json must expose owner sample count recovery");
assert(packageJson.scripts.verify.includes("owner:sample-count-recovery"), "verify chain must include owner sample count recovery");
assert(weeklyRunnerSource.includes("owner_sample_count_recovery"), "weekly runner must include owner sample count recovery step");
assert(weeklyRunnerSource.includes("owner:sample-count-recovery"), "weekly runner must run owner sample count recovery");
assert(packageJson.scripts["owner:p0-postfill-check"] === "node scripts/owner-p0-postfill-check.mjs", "package.json must expose owner P0 post-fill check");
assert(packageJson.scripts.verify.includes("owner:p0-postfill-check"), "verify chain must include owner P0 post-fill check");
assert(weeklyRunnerSource.includes("owner_p0_postfill_check"), "weekly runner must include owner P0 post-fill check step");
assert(weeklyRunnerSource.includes("owner:p0-postfill-check"), "weekly runner must run owner P0 post-fill check");
assert(packageJson.scripts["owner:sample-count-recovery:fixtures"] === "node scripts/owner-sample-count-recovery-fixtures.mjs", "package.json must expose owner sample count recovery fixtures");
assert(packageJson.scripts.verify.includes("owner:sample-count-recovery:fixtures"), "verify chain must include owner sample count recovery fixtures");
assert(weeklyRunnerSource.includes("owner_sample_count_recovery_fixtures"), "weekly runner must include owner sample count recovery fixtures step");
assert(weeklyRunnerSource.includes("owner:sample-count-recovery:fixtures"), "weekly runner must run owner sample count recovery fixtures");
assert(weeklyRunnerSource.includes("owner_next_action_fixtures"), "weekly runner must include owner next-action fixture step");
assert(weeklyRunnerSource.includes("owner:next-action:fixtures"), "weekly runner must run owner next-action fixtures");
assert(weeklyRunnerSource.includes("owner_action_launcher"), "weekly runner must include owner action launcher step");
assert(weeklyRunnerSource.includes("owner:launcher"), "weekly runner must run owner action launcher");
assert(weeklyRunnerSource.includes("owner_approval_form"), "weekly runner must include owner approval form step");
assert(weeklyRunnerSource.includes("owner:approval-form"), "weekly runner must run owner approval form");
assert(weeklyRunnerSource.includes("owner_approval_form_fixtures"), "weekly runner must include owner approval form fixture step");
assert(weeklyRunnerSource.includes("owner:approval-form:fixtures"), "weekly runner must run owner approval form fixtures");
assert(weeklyRunnerSource.includes("owner_sample_gate_fixtures"), "weekly runner must include owner sample-gate fixture step");
assert(weeklyRunnerSource.includes("owner:sample-gate:fixtures"), "weekly runner must run owner:sample-gate:fixtures");
assert(weeklyRunnerSource.includes("owner_quality_review"), "weekly runner must include owner quality-review step");
assert(weeklyRunnerSource.includes("owner:quality-review"), "weekly runner must run owner:quality-review");
assert(weeklyRunnerSource.includes("owner_quality_review_form"), "weekly runner must include owner quality-review form step");
assert(weeklyRunnerSource.includes("owner:quality-review:form"), "weekly runner must run owner:quality-review:form");
assert(weeklyRunnerSource.includes("owner_quality_review_form_fixtures"), "weekly runner must include owner quality-review form fixture step");
assert(weeklyRunnerSource.includes("owner:quality-review:form:fixtures"), "weekly runner must run owner:quality-review:form:fixtures");
assert(weeklyRunnerSource.includes("owner_quality_review_fixtures"), "weekly runner must include owner quality-review fixture step");
assert(weeklyRunnerSource.includes("owner:quality-review:fixtures"), "weekly runner must run owner:quality-review:fixtures");
assert(weeklyRunnerSource.includes("candidate_retirement_fixtures"), "weekly runner must include candidate retirement fixture step");
assert(weeklyRunnerSource.includes("retirement:fixtures"), "weekly runner must run retirement:fixtures");
assert(weeklyRunnerSource.includes("iteration_history"), "weekly runner must include iteration history step");
assert(weeklyRunnerSource.includes("history:iteration"), "weekly runner must run history:iteration");
assert(weeklyRunnerSource.includes("variable_rotation_fixtures"), "weekly runner must include variable rotation fixture step");
assert(weeklyRunnerSource.includes("variable:fixtures"), "weekly runner must run variable:fixtures");
assert(weeklyRunnerSource.includes("real_data_decision_replay"), "weekly runner must include real-data decision replay step");
assert(weeklyRunnerSource.includes("decision:replay"), "weekly runner must run decision:replay");
assert(weeklyRunnerSource.includes("launchagent_status_readback"), "weekly runner must include LaunchAgent status readback step");
assert(weeklyRunnerSource.includes("schedule:status"), "weekly runner must refresh LaunchAgent status before generating weekly artifacts");
assert(weeklyRunnerSource.includes("final_gate_readiness"), "weekly runner must refresh gate readiness after recording final success");
assert(weeklyRunnerSource.includes("final_redline_priority"), "weekly runner must refresh red-line priority after final gate readiness");
assert(weeklyRunnerSource.includes("final_prepared_but_blocked_report"), "weekly runner must refresh PreparedButBlocked after final gate readiness");
assert(weeklyRunnerSource.includes("north_star_funnel"), "weekly runner must include North Star funnel step");
assert(weeklyRunnerSource.includes("north-star"), "weekly runner must run north-star");
assert(packageJson.scripts["github:workflow-guard"] === "node scripts/github-workflow-guard.mjs", "package.json must expose GitHub workflow guard");
assert(packageJson.scripts.verify.includes("github:workflow-guard"), "verify chain must include GitHub workflow guard");
assert(weeklyRunnerSource.includes("github_workflow_guard"), "weekly runner must include GitHub workflow guard step");
assert(weeklyRunnerSource.includes("github:workflow-guard"), "weekly runner must run GitHub workflow guard");
assert(weeklyRunnerSource.includes("github_export_bundle"), "weekly runner must include GitHub export bundle step");
assert(weeklyRunnerSource.includes("github:bundle"), "weekly runner must run github:bundle");
assert(packageJson.scripts["artifacts:retention"] === "node scripts/artifact-retention-monitor.mjs", "package.json must expose artifact retention monitor");
assert(packageJson.scripts.verify.includes("artifacts:retention"), "verify chain must include artifact retention monitor");
assert(packageJson.scripts["artifacts:retention-review"] === "node scripts/artifact-retention-review-pack.mjs", "package.json must expose artifact retention review pack");
assert(packageJson.scripts.verify.includes("artifacts:retention-review"), "verify chain must include artifact retention review pack");
assert(weeklyRunnerSource.includes("artifact_retention_monitor_pre_export"), "weekly runner must include pre-export artifact retention monitor step");
assert(weeklyRunnerSource.includes("artifact_retention_review_pre_export"), "weekly runner must include pre-export artifact retention review step");
assert(weeklyRunnerSource.includes("artifact_retention_monitor"), "weekly runner must include artifact retention monitor step");
assert(weeklyRunnerSource.includes("artifact_retention_review"), "weekly runner must include artifact retention review step");
assert(weeklyRunnerSource.includes("artifacts:retention"), "weekly runner must run artifact retention monitor");
assert(weeklyRunnerSource.includes("artifacts:retention-review"), "weekly runner must run artifact retention review pack");
assert(weeklyRunnerSource.includes("owner_gate_evidence"), "weekly runner must include owner gate evidence step");
assert(weeklyRunnerSource.includes("owner:evidence"), "weekly runner must run owner:evidence");
assert(weeklyRunnerSource.includes("owner_gate_evidence_fixtures"), "weekly runner must include owner gate evidence fixture step");
assert(weeklyRunnerSource.includes("owner:evidence:fixtures"), "weekly runner must run owner:evidence:fixtures");
assert(weeklyRunnerSource.includes("post_gate_verification"), "weekly runner must include post-gate verification step");
assert(weeklyRunnerSource.includes("post:verify"), "weekly runner must run post:verify");
assert(weeklyRunnerSource.includes("post_gate_verification_fixtures"), "weekly runner must include post-gate verification fixture step");
assert(weeklyRunnerSource.includes("post:verify:fixtures"), "weekly runner must run post:verify:fixtures");
assert(weeklyRunnerSource.includes("gate_readiness_matrix"), "weekly runner must include gate readiness matrix step");
assert(weeklyRunnerSource.includes("gate:readiness"), "weekly runner must run gate:readiness");
assert(realDataInputPack.ok === true, "real-data input pack status must be ok");
assert(realDataInputPack.mode === "real_data_input_pack", "real-data input pack mode must be real_data_input_pack");
assert(realDataInputPack.status === "template_ready", "real-data input pack status must be template_ready");
assert(realDataInputPack.template_only === true, "real-data input pack must be template-only");
assert(realDataInputPack.live_input_files_created === false, "real-data input pack must not create live input CSVs");
assert(realDataInputPack.apply_performed === false, "real-data input pack must not apply data");
assert(realDataInputPack.append_performed === false, "real-data input pack must not append data");
assert(realDataInputPack.data_lp_events_write_performed === false, "real-data input pack must not write data/lp_events.jsonl");
assert(realDataInputPack.external_effect === false, "real-data input pack must not claim external effects");
assert(realDataInputPack.public_link_change_performed === false, "real-data input pack must not change public links");
assert(realDataInputPack.production_deploy_performed === false, "real-data input pack must not deploy production");
assert(realDataInputPack.github_push_or_pr_performed === false, "real-data input pack must not push or create PR");
assert(realDataInputPack.formal_post_performed === false, "real-data input pack must not formally post");
assert(realDataInputPack.line_push_performed === false, "real-data input pack must not push LINE");
assert(realDataInputPack.customer_data_mutation_performed === false, "real-data input pack must not mutate customer data");
assert(realDataInputPack.payment_action_performed === false, "real-data input pack must not touch payments");
assert(realDataInputPack.delete_action_performed === false, "real-data input pack must not delete data");
assert(realDataInputPack.real_events_unchanged === true, "real-data input pack must leave real events unchanged");
assert(Array.isArray(realDataInputPack.templates) && realDataInputPack.templates.length === 2, "real-data input pack must expose two templates");
assert(realDataInputPack.templates.every((item) => item.template_path.includes("data/real_data_input_pack/") && !item.template_path.endsWith("data/funnel_aggregates.csv") && !item.template_path.endsWith("data/manual_conversions.csv")), "input pack templates must not be live CSV targets");
assert(realDataInputPack.templates.some((item) => item.source_id === "funnel_aggregates" && item.rows >= 7), "input pack must include full-funnel rows");
assert(realDataInputPack.templates.some((item) => item.source_id === "manual_conversions" && item.rows >= 4), "input pack must include manual conversion rows");
assert(realDataInputPackMd.includes("Real Data Input Pack"), "real-data input pack markdown must have title");
assert(realDataInputPackMd.includes("Live input files created: no"), "real-data input pack markdown must state no live CSV creation");
assert(realDataInputPackMd.includes("data/lp_events.jsonl write performed: no"), "real-data input pack markdown must state no data write");
assert(realDataInputPackFunnelCsv.startsWith("date,asset_id,event_type,count,source,medium,campaign,content_id,variant_id,quality_score"), "funnel input pack CSV header is wrong");
assert(realDataInputPackManualCsv.startsWith("date,asset_id,event_type,count,source,medium,campaign,content_id,variant_id,quality_score"), "manual input pack CSV header is wrong");
assert(realDataInputPackFunnelCsv.includes(",link_click,,") && realDataInputPackFunnelCsv.includes(",line_add,,"), "funnel input pack must keep count blank for fill-only rows");
assert(realDataInputPackManualCsv.includes(",line_add,,") && realDataInputPackManualCsv.includes(",deal,,"), "manual input pack must keep count blank for fill-only rows");
assert(sourceReadiness.ok === true, "source readiness status must be ok");
assert(sourceReadiness.mode === "source_readiness_monitor", "source readiness mode must be source_readiness_monitor");
assert(["waiting_for_real_data", "real_data_sources_present"].includes(sourceReadiness.status), "source readiness status is invalid");
assert(sourceReadiness.apply_performed === false, "source readiness must not apply data");
assert(sourceReadiness.append_performed === false, "source readiness must not append data");
assert(sourceReadiness.data_lp_events_write_performed === false, "source readiness must not write data/lp_events.jsonl");
assert(sourceReadiness.external_effect === false, "source readiness must not claim external effects");
assert(sourceReadiness.public_link_change_performed === false, "source readiness must not change public links");
assert(sourceReadiness.production_deploy_performed === false, "source readiness must not deploy production");
assert(sourceReadiness.github_push_or_pr_performed === false, "source readiness must not push or create PR");
assert(sourceReadiness.formal_post_performed === false, "source readiness must not formally post");
assert(sourceReadiness.line_push_performed === false, "source readiness must not push LINE");
assert(sourceReadiness.customer_data_mutation_performed === false, "source readiness must not mutate customer data");
assert(sourceReadiness.payment_action_performed === false, "source readiness must not touch payments");
assert(sourceReadiness.delete_action_performed === false, "source readiness must not delete data");
assert(Array.isArray(sourceReadiness.stages) && sourceReadiness.stages.length === 7, "source readiness must cover all seven funnel event stages");
assert(["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"].every((eventType) => sourceReadiness.stages.some((stage) => stage.id === eventType)), "source readiness must cover all required event types");
assert(sourceReadiness.sample_progress.min_visits === 100, "source readiness min_visits must stay 100");
assert(sourceReadiness.sample_progress.min_cta_clicks === 20, "source readiness min_cta_clicks must stay 20");
assert(sourceReadiness.sample_progress.min_line_adds === 5, "source readiness min_line_adds must stay 5");
assert(sourceReadiness.sample_progress.min_test_days === 3, "source readiness min_test_days must stay 3");
assert(sourceReadiness.sample_progress.preferred_test_days === 7, "source readiness preferred_test_days must stay 7");
assert(sourceReadiness.ready_for_public_iteration_decision === false || sourceReadiness.sample_progress.sample_threshold_met === true, "source readiness cannot be public-ready without sample threshold");
assert(sourceReadiness.source_inputs.input_pack.data_lp_events_write_performed === false, "source readiness must preserve input pack no-write flag");
assert(sourceReadiness.source_inputs.intake.data_lp_events_write_performed === false, "source readiness must preserve intake no-write flag");
assert(sourceReadinessMd.includes("Source Readiness"), "source readiness markdown must have title");
assert(sourceReadinessMd.includes("data/lp_events.jsonl write performed: no"), "source readiness markdown must state no data write");
assert(sourceCapture.ok === true, "source capture status must be ok");
assert(sourceCapture.mode === "source_capture_pack", "source capture mode must be source_capture_pack");
assert(["waiting_for_owner_aggregate_capture", "capture_pack_ready_real_events_present"].includes(sourceCapture.status), "source capture status must distinguish zero-event waiting from trusted events already present");
assert(sourceCapture.template_only === true, "source capture must be template-only");
assert(sourceCapture.owner_review_required === true, "source capture must require owner review");
assert(sourceCapture.live_input_files_created === false, "source capture must not create live input files");
assert(sourceCapture.apply_performed === false, "source capture must not apply data");
assert(sourceCapture.append_performed === false, "source capture must not append data");
assert(sourceCapture.data_lp_events_write_performed === false, "source capture must not write data/lp_events.jsonl");
assert(sourceCapture.external_effect === false, "source capture must not claim external effects");
assert(sourceCapture.public_link_change_performed === false, "source capture must not change public links");
assert(sourceCapture.production_deploy_performed === false, "source capture must not deploy production");
assert(sourceCapture.github_push_or_pr_performed === false, "source capture must not push or create PR");
assert(sourceCapture.formal_post_performed === false, "source capture must not formally post");
assert(sourceCapture.line_push_performed === false, "source capture must not push LINE");
assert(sourceCapture.customer_data_mutation_performed === false, "source capture must not mutate customer data");
assert(sourceCapture.payment_action_performed === false, "source capture must not touch payments");
assert(sourceCapture.delete_action_performed === false, "source capture must not delete data");
assert(sourceCapture.real_events_unchanged === true, "source capture must leave real events unchanged");
assert(sourceCapture.stage_count === 7, "source capture must cover seven funnel stages");
assert(sourceCapture.tracking_links_total === links.links.length, "source capture must see every tracking link");
assert(sourceCapture.importable_tracking_links === links.links.filter((link) => link.role !== "ab_small_traffic" && !String(link.asset_id).includes(":")).length, "source capture importable link count mismatch");
assert(sourceCapture.ab_router_gate_count >= 1, "source capture must keep A/B router behind owner gate");
assert(sourceCapture.ledger_rows === sourceCapture.importable_tracking_links * sourceCapture.stage_count, "source capture ledger rows must equal importable links times funnel stages");
assert(sourceCapture.sample_gate_ledger_rows === sourceCapture.importable_tracking_links * 3, "source capture sample-gate ledger rows must equal importable links times three sample stages");
assert(sourceCapturePackMd.includes("Source Capture Pack"), "source capture markdown must have title");
assert(sourceCapturePackMd.includes("sample_gate_ledger.fill-template.csv"), "source capture markdown must link sample-gate ledger template");
assert(sourceCapturePackMd.includes("Live input files created: no"), "source capture markdown must state no live input file creation");
assert(sourceCapturePackMd.includes("data/lp_events.jsonl write performed: no"), "source capture markdown must state no data write");
assert(sourceCapturePackMd.includes("source_capture_ledger.filled.csv"), "source capture markdown must tell owner to use filled ledger path");
assert(sourceCapturePackMd.includes("npm run source:compile"), "source capture markdown must point to source compile command");
assert(sourceCapturePackMd.includes("aggregate") && sourceCapturePackMd.includes("without customer data"), "source capture markdown must state aggregate-only handling");
assert(sourceCaptureChecklist.mode === "source_capture_checklist", "source capture checklist mode must match");
assert(sourceCaptureChecklist.input_pack.live_input_files_created === false, "source capture checklist must preserve no live input creation");
assert(sourceCaptureChecklist.ledger.rows === sourceCapture.ledger_rows, "source capture checklist ledger rows must match status");
assert(sourceCaptureChecklist.ledger.sample_gate_rows === sourceCapture.sample_gate_ledger_rows, "source capture checklist sample-gate rows must match status");
assert(sourceCaptureChecklist.ledger.filled_path?.endsWith("source_capture_ledger.filled.csv"), "source capture checklist must include filled ledger path");
assert(sourceCaptureChecklist.ledger.sample_gate_filled_path?.endsWith("sample_gate_ledger.filled.csv"), "source capture checklist must include sample-gate filled ledger path");
assert(sourceCaptureChecklist.ledger.required_columns.includes("aggregate_count"), "source capture checklist must require aggregate_count");
assert(sourceCaptureChecklist.ledger.required_columns.includes("quality_score"), "source capture checklist must include optional aggregate quality_score");
assert(sourceCaptureChecklist.ledger.required_columns.includes("pii_checked"), "source capture checklist must require pii_checked");
assert(sampleGateLedgerStatus.ok === true, "sample-gate ledger status must be ok");
assert(sampleGateLedgerStatus.mode === "sample_gate_ledger_pack", "sample-gate ledger mode must match");
assert(sampleGateLedgerStatus.status === "sample_gate_template_ready", "sample-gate ledger status must be template ready");
assert(sampleGateLedgerStatus.row_count === sourceCapture.sample_gate_ledger_rows, "sample-gate ledger row count must match source capture");
assert(sampleGateLedgerStatus.link_count === sourceCapture.importable_tracking_links, "sample-gate ledger link count must match source capture");
assert(JSON.stringify(sampleGateLedgerStatus.required_event_types) === JSON.stringify(["page_view", "cta_click", "line_add"]), "sample-gate ledger must contain the sample event types");
assert(sampleGateLedgerStatus.template_only === true, "sample-gate ledger must be template-only");
assert(sampleGateLedgerStatus.owner_review_required === true, "sample-gate ledger must require owner review");
assert(sampleGateLedgerStatus.live_input_files_created === false, "sample-gate ledger must not create live input files");
assert(sampleGateLedgerStatus.data_lp_events_write_performed === false, "sample-gate ledger must not write data/lp_events.jsonl");
assert(sampleGateLedgerStatus.external_effect === false, "sample-gate ledger must not claim external effects");
assert(sampleGateLedgerStatus.compile_preview_command.includes("sample_gate_ledger.filled.csv"), "sample-gate ledger must expose compile preview command");
assert(sampleGateLedgerCsv.trim().split(/\r?\n/).slice(1).length === sampleGateLedgerStatus.row_count, "sample-gate ledger CSV row count must match status");
assert(["page_view", "cta_click", "line_add"].every((eventType) => sampleGateLedgerCsv.includes(`,${eventType},`)), "sample-gate ledger CSV must include all sample event types");
assert(!sampleGateLedgerCsv.includes(",link_click,"), "sample-gate ledger CSV must omit link_click rows");
assert(!sampleGateLedgerCsv.includes(",lead_submit,"), "sample-gate ledger CSV must omit lead_submit rows");
assert(!sampleGateLedgerCsv.includes(",deal,"), "sample-gate ledger CSV must omit deal rows");
assert(!sampleGateLedgerCsv.includes(",quality_flag,"), "sample-gate ledger CSV must omit quality_flag rows");
assert(sampleGateLedgerMd.includes("Sample Gate Ledger"), "sample-gate ledger markdown must have title");
assert(sampleGateLedgerMd.includes("sample_gate_ledger.filled.csv"), "sample-gate ledger markdown must include owner-filled path");
assert(sampleGateCompileProbe.ok === true, "sample-gate compile probe must be ok");
assert(sampleGateCompileProbe.mode === "source_capture_compile_preview", "sample-gate compile probe mode must match compiler");
assert(sampleGateCompileProbe.status === "waiting_for_filled_counts", "sample-gate compile probe must wait for filled counts");
assert(sampleGateCompileProbe.input_kind === "sample_gate_template", "sample-gate compile probe input kind must be sample_gate_template");
assert(sampleGateCompileProbe.ledger_rows_read === sampleGateLedgerStatus.row_count, "sample-gate compile probe must read every sample-gate template row");
assert(sampleGateCompileProbe.filled_rows === 0, "sample-gate compile probe must not have filled rows");
assert(sampleGateCompileProbe.empty_rows === sampleGateLedgerStatus.row_count, "sample-gate compile probe empty rows must match template rows");
assert(sampleGateCompileProbe.issue_count === 0, "sample-gate compile probe must have no issues");
assert(sampleGateCompileProbe.live_input_files_created === false, "sample-gate compile probe must not create live input files");
assert(sampleGateCompileProbe.data_lp_events_write_performed === false, "sample-gate compile probe must not write data/lp_events.jsonl");
assert(sampleGateCompileProbe.external_effect === false, "sample-gate compile probe must not claim external effects");
assert(sampleGateCompileProbeReport.includes("Source Capture Compile Preview"), "sample-gate compile probe report must use compiler report");
assert(sampleGateCompileProbeFunnelCsv.trim() === "date,asset_id,event_type,count,source,medium,campaign,content_id,variant_id,quality_score", "sample-gate compile probe funnel CSV must be header-only");
assert(sampleGateCompileProbeManualCsv.trim() === "date,asset_id,event_type,count,source,medium,campaign,content_id,variant_id,quality_score", "sample-gate compile probe manual CSV must be header-only");
assert(sampleGateReplay.ok === true, "sample-gate replay fixture must be ok");
assert(sampleGateReplay.mode === "sample_gate_replay_fixture_dry_run", "sample-gate replay fixture mode must match");
assert(sampleGateReplay.template_rows === sampleGateLedgerStatus.row_count, "sample-gate replay template rows must match sample-gate ledger status");
assert(sampleGateReplay.scenario_count === 3, "sample-gate replay must cover three scenarios");
assert(sampleGateReplay.sample_gate_ledger_replay_executed === true, "sample-gate replay must execute sample-gate ledger replay");
assert(sampleGateReplay.source_capture_compile_commands_executed === true, "sample-gate replay must run source capture compiler");
assert(sampleGateReplay.importer_preview_commands_executed === true, "sample-gate replay must run importer previews");
assert(sampleGateReplay.execution_performed === false, "sample-gate replay must not execute external actions");
assert(sampleGateReplay.real_event_write_performed === false, "sample-gate replay must not write real events");
assert(sampleGateReplay.data_lp_events_write_performed === false, "sample-gate replay must not write data/lp_events.jsonl");
assert(sampleGateReplay.external_effect === false, "sample-gate replay must not claim external effects");
for (const expected of ["sample_gate_insufficient_keeps_collecting", "sample_gate_ready_challenger_beats_rate", "sample_gate_ready_challenger_underperforms"]) {
  const scenario = sampleGateReplay.scenarios.find((item) => item.id === expected);
  assert(scenario?.ok === true, `sample-gate replay scenario must pass: ${expected}`);
  assert(scenario.source_capture_compile?.ok === true, `sample-gate replay source compile must pass: ${expected}`);
  assert(scenario.source_capture_compile?.status === "owner_preview_ready", `sample-gate replay source compile must produce owner preview: ${expected}`);
  assert(scenario.source_capture_compile?.filled_rows === sampleGateLedgerStatus.row_count, `sample-gate replay must fill all sample rows: ${expected}`);
  assert(scenario.source_capture_compile?.data_lp_events_write_performed === false, `sample-gate replay source compile must not write real events: ${expected}`);
  assert(scenario.importer_status?.funnel_ok === true, `sample-gate replay funnel importer must pass: ${expected}`);
  assert(scenario.importer_status?.manual_ok === true, `sample-gate replay manual importer must pass: ${expected}`);
  assert(scenario.data_lp_events_write_performed === false, `sample-gate replay scenario must not write data/lp_events.jsonl: ${expected}`);
}
assert(sampleGateReplayReport.includes("sample_gate_replay_fixture_ok"), "sample-gate replay report must state fixture ok");
assert(sampleGateReplayReport.includes("sample_gate_ready_challenger_beats_rate"), "sample-gate replay report must include winning sample-gate scenario");
assert(sampleGateReplayReport.includes("data/lp_events.jsonl write performed: no"), "sample-gate replay report must state no real event write");
assert(sourceCaptureChecklist.links.some((link) => link.role === "ab_small_traffic" && link.importable_in_current_templates === false), "source capture checklist must keep A/B router non-importable");
assert(sourceCaptureChecklist.safety_rules.some((rule) => rule.includes("aggregate counts only")), "source capture checklist must state aggregate counts only");
assert(sourceCaptureLedgerCsv.startsWith("week_start,week_end,capture_date,stage,stage_label,asset_id,content_id,variant_id,tracking_link_id,tracking_url,source_surface,source_metric,target_template,target_live_file,aggregate_count,quality_score,evidence_ref,reviewer,pii_checked,notes"), "source capture ledger CSV header is wrong");
assert(sourceCaptureLedgerCsv.split(/\r?\n/).filter(Boolean).length === sourceCapture.ledger_rows + 1, "source capture ledger row count must match status");
assert(sourceCaptureLedgerCsv.includes(",link_click,"), "source capture ledger must include link_click rows");
assert(sourceCaptureLedgerCsv.includes(",line_add,"), "source capture ledger must include line_add rows");
assert(!/phone|email|line_user_id|customer_name|address|payment|card|order_id|refund|chat text/i.test(sourceCaptureLedgerCsv.split(/\r?\n/)[0]), "source capture ledger header must not include sensitive customer fields");
assert(sourceCompile.ok === true, "source capture compile status must be ok");
assert(sourceCompile.mode === "source_capture_compile_preview", "source capture compile mode must be preview");
assert(["waiting_for_filled_counts", "owner_preview_ready"].includes(sourceCompile.status), "source capture compile status is invalid");
assert(sourceCompile.owner_review_required === true, "source capture compile must require owner review");
assert(sourceCompile.live_input_files_created === false, "source capture compile must not create live input files");
assert(sourceCompile.apply_performed === false, "source capture compile must not apply data");
assert(sourceCompile.append_performed === false, "source capture compile must not append data");
assert(sourceCompile.data_lp_events_write_performed === false, "source capture compile must not write data/lp_events.jsonl");
assert(sourceCompile.external_effect === false, "source capture compile must not claim external effects");
assert(sourceCompile.public_link_change_performed === false, "source capture compile must not change public links");
assert(sourceCompile.production_deploy_performed === false, "source capture compile must not deploy production");
assert(sourceCompile.github_push_or_pr_performed === false, "source capture compile must not push or create PR");
assert(sourceCompile.formal_post_performed === false, "source capture compile must not formally post");
assert(sourceCompile.line_push_performed === false, "source capture compile must not push LINE");
assert(sourceCompile.customer_data_mutation_performed === false, "source capture compile must not mutate customer data");
assert(sourceCompile.payment_action_performed === false, "source capture compile must not touch payments");
assert(sourceCompile.delete_action_performed === false, "source capture compile must not delete data");
assert(sourceCompile.issue_count === 0, "source capture compile must have no issues");
assert(sourceCompile.status !== "waiting_for_filled_counts" || sourceCompile.filled_rows === 0, "waiting source compile must have zero filled rows");
assert(sourceCompile.status !== "owner_preview_ready" || sourceCompile.filled_rows > 0, "ready source compile must have filled rows");
assert(sourceCompileFunnelCsv.startsWith("date,asset_id,event_type,count,source,medium,campaign,content_id,variant_id,quality_score"), "source compile funnel preview header is wrong");
assert(sourceCompileManualCsv.startsWith("date,asset_id,event_type,count,source,medium,campaign,content_id,variant_id,quality_score"), "source compile manual preview header is wrong");
assert(sourceCompileReport.includes("Source Capture Compile Preview"), "source compile report must have title");
assert(sourceCompileReport.includes("data/lp_events.jsonl write performed: no"), "source compile report must state no data write");
assert(sourceCompileReport.includes("Live input files created: no"), "source compile report must state no live input files");
assert(sourceCompileFixture.ok === true, "source capture compile fixture status must be ok");
assert(sourceCompileFixture.mode === "source_capture_compile_fixture_dry_run", "source capture compile fixture mode must be dry-run");
assert(sourceCompileFixture.scenario_count === 7, "source capture compile fixtures must cover seven scenarios");
assert(sourceCompileFixture.local_fixture_commands_executed === true, "source capture compile fixtures must execute local fixture commands");
assert(sourceCompileFixture.execution_performed === false, "source capture compile fixtures must not execute external commands");
assert(sourceCompileFixture.real_event_write_performed === false, "source capture compile fixtures must not write real events");
assert(sourceCompileFixture.data_lp_events_write_performed === false, "source capture compile fixtures must not write data/lp_events.jsonl");
assert(sourceCompileFixture.external_effect === false, "source capture compile fixtures must not claim external effects");
assert(sourceCompileFixture.public_link_change_performed === false, "source capture compile fixtures must not change public links");
assert(sourceCompileFixture.production_deploy_performed === false, "source capture compile fixtures must not deploy production");
assert(sourceCompileFixture.github_push_or_pr_performed === false, "source capture compile fixtures must not push or create PR");
assert(sourceCompileFixture.formal_post_performed === false, "source capture compile fixtures must not formally post");
assert(sourceCompileFixture.line_push_performed === false, "source capture compile fixtures must not push LINE");
assert(sourceCompileFixture.customer_data_mutation_performed === false, "source capture compile fixtures must not mutate customer data");
assert(sourceCompileFixture.payment_action_performed === false, "source capture compile fixtures must not touch payments");
assert(sourceCompileFixture.delete_action_performed === false, "source capture compile fixtures must not delete data");
for (const expected of [
  "valid_filled_compile_preview",
  "empty_template_waits_for_counts",
  "partial_blank_count_warns_not_blocks",
  "blocked_missing_pii_checked",
  "blocked_sensitive_evidence",
  "blocked_invalid_date",
  "blocked_invalid_target_file",
]) {
  const scenario = sourceCompileFixture.scenarios.find((item) => item.id === expected);
  assert(scenario?.ok === true, `source compile fixture missing passing scenario ${expected}`);
  assert(scenario.data_lp_events_write_performed === false, `source compile fixture must not write real events: ${expected}`);
}
assert(sourceCompileFixture.scenarios.find((item) => item.id === "valid_filled_compile_preview")?.status_status === "owner_preview_ready", "valid source compile fixture must produce owner preview");
assert(sourceCompileFixture.scenarios.find((item) => item.id === "valid_filled_compile_preview")?.manual_quality_score_zero === true, "valid source compile fixture must preserve quality_score=0 for quality_flag rows");
assert(sourceCompileFixture.scenarios.find((item) => item.id === "empty_template_waits_for_counts")?.status_status === "waiting_for_filled_counts", "empty source compile fixture must wait for counts");
assert(sourceCompileFixture.scenarios.find((item) => item.id === "partial_blank_count_warns_not_blocks")?.warning_count === 1, "partial blank count fixture must warn once");
assert(sourceCompileFixture.scenarios.filter((item) => item.id.startsWith("blocked_")).every((item) => item.status_status === "blocked_invalid_filled_ledger" && item.issue_count > 0), "blocked source compile fixtures must fail closed");
assert(sourceCompileFixtureReport.includes("Source Capture Compile Fixture Report"), "source compile fixture report must have title");
assert(sourceCompileFixtureReport.includes("data/lp_events.jsonl write performed: no"), "source compile fixture report must state no data write");
assert(sourceCompileFixtureReport.includes("valid_filled_compile_preview"), "source compile fixture report must include valid scenario");
assert(weeklyRunnerSource.includes("real_data_intake_plan"), "weekly runner must include real-data intake plan step");
assert(weeklyRunnerSource.includes("real-data:intake"), "weekly runner must run real-data:intake");
assert(realDataIntake.ok === true, "real-data intake status must be ok");
assert(realDataIntake.mode === "real_data_intake_plan", "real-data intake mode must be real_data_intake_plan");
assert(["no_real_input_files", "preview_ready_owner_apply_required", "input_attention_required"].includes(realDataIntake.status), "real-data intake status is invalid");
assert(realDataIntake.apply_performed === false, "real-data intake must not apply data");
assert(realDataIntake.append_performed === false, "real-data intake must not append data");
assert(realDataIntake.data_lp_events_write_performed === false, "real-data intake must not write data/lp_events.jsonl");
assert(realDataIntake.external_effect === false, "real-data intake must not claim external effects");
assert(realDataIntake.public_link_change_performed === false, "real-data intake must not change public links");
assert(realDataIntake.production_deploy_performed === false, "real-data intake must not deploy production");
assert(realDataIntake.github_push_or_pr_performed === false, "real-data intake must not push or create PR");
assert(realDataIntake.formal_post_performed === false, "real-data intake must not formally post");
assert(realDataIntake.line_push_performed === false, "real-data intake must not push LINE");
assert(realDataIntake.customer_data_mutation_performed === false, "real-data intake must not mutate customer data");
assert(realDataIntake.payment_action_performed === false, "real-data intake must not touch payments");
assert(realDataIntake.delete_action_performed === false, "real-data intake must not delete data");
assert(realDataIntake.real_events_unchanged === true, "real-data intake must leave real events unchanged");
assert(Array.isArray(realDataIntake.input_files) && realDataIntake.input_files.length === 2, "real-data intake must check both aggregate input files");
assert(Array.isArray(realDataIntake.owner_apply_commands), "real-data intake must expose owner apply commands array");
assert(realDataIntake.owner_apply_commands.every((item) => item.command.includes(":apply") && item.follow_up_commands.includes("npm run event:quality")), "real-data intake owner commands must be local apply plus quality follow-up");
assert(realDataIntake.input_files.every((item) => item.data_lp_events_write_performed === false), "real-data intake source previews must not write real events");
assert(realDataIntakePlan.includes("Real Data Intake Plan"), "real-data intake markdown must have title");
assert(realDataIntakePlan.includes("data/lp_events.jsonl write performed: no"), "real-data intake markdown must state no data write");
assert(ownerDataPreflight.ok === true, "owner data preflight must be ok");
assert(ownerDataPreflightStatus.ok === true, "compact owner data preflight status must be ok");
assert(ownerDataPreflight.mode === "owner_data_preflight_local_only", "owner data preflight mode must be local-only");
assert(ownerDataPreflightStatus.mode === ownerDataPreflight.mode, "compact owner data preflight mode must match");
assert([
  "waiting_for_owner_preview_rows",
  "owner_preview_keep_collecting",
  "owner_preview_sample_ready_no_auto_promotion",
  "owner_preview_win_needs_quality_and_promotion_review",
].includes(ownerDataPreflight.status), "owner data preflight status is invalid");
assert(ownerDataPreflightStatus.status === ownerDataPreflight.status, "compact owner data preflight status must match");
assert(ownerDataPreflight.real_events_unchanged === true, "owner data preflight must leave real events unchanged");
assert(ownerDataPreflight.data_lp_events_write_performed === false, "owner data preflight must not write data/lp_events.jsonl");
assert(ownerDataPreflight.apply_performed === false, "owner data preflight must not apply data");
assert(ownerDataPreflight.append_performed === false, "owner data preflight must not append data");
assert(ownerDataPreflight.live_input_files_created === false, "owner data preflight must not create live input files");
assert(ownerDataPreflight.external_effect === false, "owner data preflight must not claim external effects");
assert(ownerDataPreflight.production_deploy_performed === false, "owner data preflight must not deploy production");
assert(ownerDataPreflight.public_link_change_performed === false, "owner data preflight must not change public links");
assert(ownerDataPreflight.github_push_or_pr_performed === false, "owner data preflight must not push or create PR");
assert(ownerDataPreflight.formal_post_performed === false, "owner data preflight must not formally post");
assert(ownerDataPreflight.line_push_performed === false, "owner data preflight must not push LINE");
assert(ownerDataPreflight.customer_data_mutation_performed === false, "owner data preflight must not mutate customer data");
assert(ownerDataPreflight.payment_action_performed === false, "owner data preflight must not touch payments");
assert(ownerDataPreflight.delete_action_performed === false, "owner data preflight must not delete data");
assert(ownerDataPreflight.selected_source_id === "next_p0_owner_intake" || ownerDataPreflight.selected_source_row_count > 0, "owner data preflight must prefer the focused Next P0 preview while waiting");
assert(ownerDataPreflight.owner_review_required === true, "owner data preflight must keep owner review required");
assert(ownerDataPreflight.next_safe_action && ownerDataPreflight.next_safe_action.length > 20, "owner data preflight must provide next safe action");
assert(ownerDataPreflightMd.includes("3Q Growth Loop Owner Data Preflight"), "owner data preflight markdown must include title");
assert(ownerDataPreflightMd.includes("External effect: no"), "owner data preflight markdown must state no external effect");
assert(ownerDataPreflightMd.includes("data/lp_events.jsonl write performed: no"), "owner data preflight markdown must state no data write");
assert(packageJson.scripts["owner:data-preflight"] === "node scripts/owner-data-preflight.mjs", "package.json must expose owner data preflight script");
assert(packageJson.scripts.verify.includes("npm run owner:data-preflight"), "verify chain must include owner data preflight");
assert(weeklyRunnerSource.includes("owner_data_preflight"), "weekly runner must include owner data preflight step");
assert(weeklyRunnerSource.includes("owner:data-preflight"), "weekly runner must run owner:data-preflight");
assert(dataCollection.ok === true, "data collection queue must be ok");
assert(dataCollectionStatus.ok === true, "data collection brief status must be ok");
assert(dataCollection.mode === "data_collection_brief", "data collection queue mode must be data_collection_brief");
assert(dataCollectionStatus.mode === "data_collection_brief", "data collection status mode must be data_collection_brief");
assert(["waiting_for_owner_aggregate_counts", "owner_filled_ledger_detected_compile_next"].includes(dataCollection.status), "data collection queue status is invalid");
assert(dataCollectionStatus.status === dataCollection.status, "data collection status must match queue status");
assert(dataCollectionStatus.stage_count === 7, "data collection brief must cover seven funnel stages");
assert(dataCollectionStatus.importable_link_count === sourceCapture.importable_tracking_links, "data collection importable link count must match source capture");
assert(dataCollectionStatus.gated_link_count === sourceCapture.ab_router_gate_count, "data collection gated link count must match A/B router gate count");
assert(dataCollectionStatus.task_count === dataCollectionStatus.stage_count * dataCollectionStatus.importable_link_count, "data collection task count must equal stages times importable links");
assert(Array.isArray(dataCollection.tasks) && dataCollection.tasks.length === dataCollectionStatus.task_count, "data collection queue task count must match status");
assert(Array.isArray(dataCollection.stage_priorities) && dataCollection.stage_priorities.length === dataCollectionStatus.stage_count, "data collection stage priorities must match stage count");
assert(dataCollectionStatus.sample_threshold_met === false, "data collection brief must preserve sample-insufficient gate");
assert(dataCollectionStatus.missing_stage_count === sourceReadiness.missing_stage_count, "data collection missing stage count must match source readiness");
assert(dataCollectionStatus.filled_ledger_exists === dataCollection.filled_ledger_exists, "data collection filled ledger flag must match queue");
assert(dataCollectionStatus.real_events_unchanged === true, "data collection brief must leave real events unchanged");
assert(dataCollectionStatus.live_input_files_created === false, "data collection brief must not create live input files");
assert(dataCollectionStatus.data_lp_events_write_performed === false, "data collection brief must not write data/lp_events.jsonl");
assert(dataCollectionStatus.external_effect === false, "data collection brief must not claim external effects");
assert(dataCollectionStatus.public_link_change_performed === false, "data collection brief must not change public links");
assert(dataCollectionStatus.production_deploy_performed === false, "data collection brief must not deploy production");
assert(dataCollectionStatus.github_push_or_pr_performed === false, "data collection brief must not push or create PR");
assert(dataCollectionStatus.formal_post_performed === false, "data collection brief must not formally post");
assert(dataCollectionStatus.line_push_performed === false, "data collection brief must not push LINE");
assert(dataCollectionStatus.customer_data_mutation_performed === false, "data collection brief must not mutate customer data");
assert(dataCollectionStatus.payment_action_performed === false, "data collection brief must not touch payments");
assert(dataCollectionStatus.delete_action_performed === false, "data collection brief must not delete data");
assert(dataCollection.real_events_unchanged === true, "data collection queue must leave real events unchanged");
assert(dataCollection.live_input_files_created === false, "data collection queue must not create live input files");
assert(dataCollection.data_lp_events_write_performed === false, "data collection queue must not write data/lp_events.jsonl");
assert(dataCollection.external_effect === false, "data collection queue must not claim external effects");
assert(dataCollection.sample_gate_collection_plan?.status === sampleGateStatus.status, "data collection queue must summarize sample gate status");
assert(dataCollection.sample_gate_collection_plan?.p0_task_count === sampleGateStatus.p0_task_count, "data collection queue sample gate task count must match status");
assert(dataCollection.sample_gate_collection_plan?.p0_link_count === sampleGateStatus.p0_link_count, "data collection queue sample gate link count must match status");
assert(dataCollectionProgress.ok === true, "data collection progress must be ok");
assert(dataCollectionProgressStatus.ok === true, "data collection progress compact status must be ok");
assert(dataCollectionProgress.mode === "data_collection_progress", "data collection progress mode must match");
assert(dataCollectionProgressStatus.mode === "data_collection_progress", "data collection progress compact mode must match");
assert(dataCollectionProgressStatus.status === dataCollectionProgress.status, "data collection progress compact status must match full JSON");
assert(["waiting_for_p0_sample_gate_counts", "waiting_for_p1_funnel_counts", "all_collection_rows_filled_review_next"].includes(dataCollectionProgress.status), "data collection progress status is invalid");
assert(dataCollectionProgress.total_task_count === dataCollectionStatus.task_count, "data collection progress task count must match queue status");
assert(dataCollectionProgress.pending_task_count + dataCollectionProgress.filled_task_count === dataCollectionProgress.total_task_count, "data collection progress filled and pending counts must add up");
assert(dataCollectionProgress.p0_task_count === sampleGateStatus.p0_task_count, "data collection progress P0 task count must match sample gate status");
assert(dataCollectionProgress.p0_pending_count + dataCollectionProgress.p0_filled_count === dataCollectionProgress.p0_task_count, "data collection progress P0 counts must add up");
assert(dataCollectionProgress.p1_pending_count + dataCollectionProgress.p1_filled_count === dataCollectionProgress.p1_task_count, "data collection progress P1 counts must add up");
assert(dataCollectionProgress.sample_threshold_met === ownerSampleGateStatus.sample_threshold_met, "data collection progress sample threshold must match owner sample gate");
assert(dataCollectionProgress.owner_sample_gate_status === ownerSampleGateStatus.status, "data collection progress owner sample status must match compact owner sample gate");
assert(dataCollectionProgress.source_group_count === ownerCaptureQueueStatus.source_group_count, "data collection progress source group count must match owner capture queue");
assert(Array.isArray(dataCollectionProgress.event_type_progress) && dataCollectionProgress.event_type_progress.length === dataCollectionStatus.stage_count, "data collection progress must cover each data collection stage");
assert(dataCollectionProgress.event_type_progress.every((row) => row.total === row.filled + row.pending), "data collection progress event rows must add up");
assert(dataCollectionProgress.source_surface_progress.every((row) => row.total === row.filled + row.pending), "data collection progress source rows must add up");
assert(dataCollectionProgress.p0_pending_count > 0 ? dataCollectionProgressStatus.status === "waiting_for_p0_sample_gate_counts" : true, "data collection progress must prioritize pending P0 sample-gate counts");
assert(dataCollectionProgressStatus.pending_task_count === dataCollectionProgress.pending_task_count, "data collection progress compact pending count must match");
assert(dataCollectionProgressStatus.next_owner_input_count === Math.min(dataCollectionProgress.p0_pending_count, 9), "data collection progress next owner inputs must expose up to nine P0 rows");
assert(dataCollectionProgressReport.includes("Data Collection Progress"), "data collection progress report must have a title");
assert(dataCollectionProgressReport.includes("data/lp_events.jsonl write performed: no"), "data collection progress report must state no event write");
assert(dataCollectionProgressReport.includes("next_p0_owner_inputs.md"), "data collection progress report must point to next P0 owner inputs");
assert(dataCollectionProgress.real_events_unchanged === true, "data collection progress must leave real events unchanged");
assert(dataCollectionProgressStatus.real_events_unchanged === true, "data collection progress compact status must leave real events unchanged");
assertNoRedLineFlags(dataCollectionProgress, "data collection progress");
assertNoRedLineFlags(dataCollectionProgressStatus, "data collection progress compact status");
assert(sourceTrustMatrix.ok === true, "source trust matrix must be ok");
assert(sourceTrustMatrixStatus.ok === true, "source trust matrix compact status must be ok");
assert(sourceTrustMatrix.mode === "source_trust_matrix_local_only", "source trust matrix mode must be local-only");
assert(sourceTrustMatrixStatus.mode === sourceTrustMatrix.mode, "source trust matrix compact mode must match");
assert(sourceTrustMatrixStatus.status === sourceTrustMatrix.status, "source trust matrix compact status must match");
assert(Array.isArray(sourceTrustMatrix.sources) && sourceTrustMatrix.sources.length >= 6, "source trust matrix must classify core data sources");
assert(sourceTrustMatrix.sources.some((source) => source.id === "real_lp_events_jsonl"), "source trust matrix must include real lp_events source");
assert(sourceTrustMatrix.sources.some((source) => source.id === "local_d1_export"), "source trust matrix must include local D1 export source");
assert(sourceTrustMatrix.sources.some((source) => source.id === "owner_data_preflight"), "source trust matrix must include owner data preflight source");
const lineOaDiagnosticSource = sourceTrustMatrix.sources.find((source) => source.id === "line_oa_account_metrics_observation");
assert(lineOaDiagnosticSource?.status === "account_wide_non_attributable", "source trust matrix must classify LINE OA totals as account-wide and non-attributable");
assert(lineOaDiagnosticSource?.rows === 0, "LINE OA account total must contribute zero attributable scoring rows");
assert(lineOaDiagnosticSource?.scoring_input_allowed === false, "LINE OA account total must never become scoring input");
assert(lineOaDiagnosticSource?.sample_gate_input_allowed === false, "LINE OA account total must never satisfy the sample gate");
assert(lineOaAccountMetricsObservation.scoring_eligible === false && lineOaAccountMetricsObservation.sample_gate_eligible === false, "LINE OA observation must explicitly block scoring and sample-gate use");
assert(lineOaAccountMetricsObservation.customer_level_data_stored === false, "LINE OA observation must store no customer-level data");
assert(lineOaAccountMetricsObservationReport.includes("must not be entered into P0/P1 scoring rows"), "LINE OA observation report must state the non-attribution rule");
assert(sourceTrustMatrixReport.includes("line_oa_account_metrics_observation"), "source trust report must expose the LINE OA diagnostic observation");
assert(sourceTrustMatrix.real_event_rows === eventInputQuality.rows_scanned, "source trust real event row count must match event quality rows");
assert(sourceTrustMatrix.p0_pending_count === dataCollectionProgressStatus.p0_pending_count, "source trust P0 pending count must match data progress");
assert(sourceTrustMatrix.sample_threshold_met === dataCollectionProgressStatus.sample_threshold_met, "source trust sample threshold must match data progress");
assert(sourceTrustMatrix.scoring_allowed_now === (sourceTrustMatrix.trusted_scoring_source_count > 0), "source trust scoring flag must match trusted source count");
assert(sourceTrustMatrix.sources.find((source) => source.id === "local_d1_export")?.scoring_input_allowed === Boolean(d1Sync.scoring_input_allowed), "source trust must mirror D1 scoring allowance");
assert(sourceTrustMatrix.sources.find((source) => source.id === "local_d1_export")?.trust_level === (d1Sync.scope === "remote_aggregate_only" ? "owner_approved_remote_export" : "local_review_only"), "D1 source trust must distinguish owner-approved remote aggregates from local review exports");
assert(sourceTrustMatrix.sources.find((source) => source.id === "owner_data_preflight")?.rows === ownerDataPreflight.selected_source_row_count, "source trust owner preflight rows must match owner data preflight selected rows");
assert(sourceTrustMatrix.sources.find((source) => source.id === "owner_data_preflight")?.sample_gate_input_allowed === (ownerDataPreflight.ok === true && ownerDataPreflight.selected_source_row_count > 0 && ownerDataPreflight.issue_count === 0), "source trust owner preflight sample-gate flag must follow trusted owner-preview rows, not just threshold completion");
assert(sourceTrustMatrixStatus.scoring_allowed_now === sourceTrustMatrix.scoring_allowed_now, "source trust compact scoring flag must match full matrix");
assert(sourceTrustMatrixStatus.data_lp_events_write_performed === false, "source trust compact status must not write data/lp_events.jsonl");
assert(sourceTrustMatrixReport.includes("Source Trust Matrix"), "source trust report must have title");
assert(sourceTrustMatrixReport.includes("data/lp_events.jsonl write performed: no"), "source trust report must state no event write");
assert(sourceTrustMatrixReport.includes("No production deploy"), "source trust report must state red lines");
assertNoRedLineFlags(sourceTrustMatrix, "source trust matrix");
assertNoRedLineFlags(sourceTrustMatrixStatus, "source trust matrix compact status");
assert(nextP0OwnerInputs.ok === true, "next P0 owner inputs must be ok");
assert(nextP0OwnerInputsStatus.ok === true, "next P0 owner inputs status must be ok");
assert(nextP0OwnerInputs.mode === "next_p0_owner_inputs", "next P0 owner inputs mode must match");
assert(nextP0OwnerInputsStatus.mode === "next_p0_owner_inputs", "next P0 owner inputs compact mode must match");
assert(nextP0OwnerInputsStatus.status === nextP0OwnerInputs.status, "next P0 owner inputs compact status must match full JSON");
assert(nextP0OwnerInputs.source_progress_status === dataCollectionProgress.status, "next P0 owner inputs must link back to data collection progress status");
assert(nextP0OwnerInputs.current_input_count === dataCollectionProgress.next_owner_inputs.length || nextP0OwnerInputs.current_input_count === dataCollectionProgress.fallback_owner_inputs.length, "next P0 owner input count must match progress next/fallback inputs");
assert(nextP0OwnerInputs.current_input_count === nextP0OwnerInputs.inputs.length, "next P0 owner inputs count must match rows");
assert(nextP0OwnerInputsStatus.current_input_count === nextP0OwnerInputs.current_input_count, "next P0 owner inputs compact count must match");
assert(nextP0OwnerInputs.p0_pending_count === dataCollectionProgress.p0_pending_count, "next P0 owner inputs P0 pending must match progress");
assert(nextP0OwnerInputs.inputs.every((row) => row.external_effect === false), "next P0 owner input rows must have no external effect");
assert(nextP0OwnerInputs.inputs.every((row) => row.required_fields?.includes("aggregate_count") && row.required_fields?.includes("evidence_ref") && row.required_fields?.includes("pii_checked")), "next P0 owner input rows must require aggregate count, evidence ref, and pii check");
assert(nextP0OwnerInputs.recommended_open_command === "open next_p0_owner_form.html", "next P0 owner inputs must recommend focused owner form");
assert(nextP0OwnerInputsReport.includes("Next P0 Owner Inputs"), "next P0 owner inputs report must have a title");
assert(nextP0OwnerInputsReport.includes("data/lp_events.jsonl write performed: no"), "next P0 owner inputs report must state no event write");
assert(nextP0OwnerInputs.real_events_unchanged === true, "next P0 owner inputs must leave real events unchanged");
assertNoRedLineFlags(nextP0OwnerInputs, "next P0 owner inputs");
assertNoRedLineFlags(nextP0OwnerInputsStatus, "next P0 owner inputs compact status");
assert(nextP0OwnerFormStatus.ok === true, "next P0 owner form status must be ok");
assert(nextP0OwnerFormStatus.mode === "next_p0_owner_form", "next P0 owner form mode must match");
assert(nextP0OwnerFormStatus.status === "ready_local_next_p0_owner_form", "next P0 owner form status must be ready");
assert(nextP0OwnerFormStatus.row_count === nextP0OwnerInputs.current_input_count, "next P0 owner form rows must match next input count");
assert(nextP0OwnerFormStatus.row_count === 9, "next P0 owner form must expose the focused nine-row batch");
assert(nextP0OwnerFormStatus.source_group_count === nextP0OwnerInputs.source_groups.length, "next P0 owner form source groups must match next inputs");
assert(nextP0OwnerFormStatus.download_filename === "next_p0_owner_inputs.filled.csv", "next P0 owner form must export focused CSV filename");
assert(nextP0OwnerFormStatus.json_download_filename === "next_p0_owner_inputs.review.json", "next P0 owner form must export focused review JSON filename");
assert(nextP0OwnerFormStatus.export_headers.includes("aggregate_count"), "next P0 owner form export headers must include aggregate_count");
assert(nextP0OwnerFormStatus.export_headers.includes("pii_checked"), "next P0 owner form export headers must include pii_checked");
assert(/not a live input CSV/i.test(nextP0OwnerFormStatus.export_contract), "next P0 owner form must declare download is not a live input CSV");
assert(nextP0OwnerFormStatus.browser_only === true, "next P0 owner form must be browser-only");
assert(nextP0OwnerFormStatus.browser_persistence === false, "next P0 owner form must not persist browser data");
assert(nextP0OwnerFormStatus.form_action === "none", "next P0 owner form must declare no form action");
assert(nextP0OwnerFormStatus.network_calls_performed === false, "next P0 owner form must not perform network calls");
assert(nextP0OwnerFormStatus.real_events_unchanged === true, "next P0 owner form must leave real events unchanged");
assertNoRedLineFlags(nextP0OwnerFormStatus, "next P0 owner form status");
assert(nextP0OwnerFormHtml.includes("3Q Growth Loop Next P0 Owner Form"), "next P0 owner form HTML must have title");
assert(nextP0OwnerFormHtml.includes('data-external-effect="false"'), "next P0 owner form HTML must mark no external effect");
assert(nextP0OwnerFormHtml.includes('data-network="none"'), "next P0 owner form HTML must mark no network");
assert(nextP0OwnerFormHtml.includes("next_p0_owner_inputs.filled.csv"), "next P0 owner form HTML must mention focused CSV download");
assert(nextP0OwnerFormHtml.includes("Download CSV"), "next P0 owner form HTML must include CSV download control");
assert(nextP0OwnerInputs.inputs.every((row) => nextP0OwnerFormHtml.includes(row.tracking_link_id)), "next P0 owner form HTML must include all focused tracking links");
assert(!/\bfetch\s*\(/.test(nextP0OwnerFormHtml), "next P0 owner form must not call fetch");
assert(!/sendBeacon|XMLHttpRequest/i.test(nextP0OwnerFormHtml), "next P0 owner form must not send beacons or XHR");
assert(!/localStorage|sessionStorage|indexedDB/i.test(nextP0OwnerFormHtml), "next P0 owner form must not persist browser data");
assert(!/href=["']https?:\/\//i.test(nextP0OwnerFormHtml), "next P0 owner form must not link to external URLs");
assert(nextP0OwnerFormFixture.ok === true, "next P0 owner form fixture status must be ok");
assert(nextP0OwnerFormFixture.mode === "next_p0_owner_form_fixture_dry_run", "next P0 owner form fixture mode must match");
assert(nextP0OwnerFormFixture.row_count === nextP0OwnerFormStatus.row_count, "next P0 owner form fixture row count must match form");
assert(nextP0OwnerFormFixture.expected_row_count === nextP0OwnerInputs.current_input_count, "next P0 owner form fixture expected count must match next inputs");
assert(nextP0OwnerFormFixture.scenario_count === 4, "next P0 owner form fixture must cover four scenarios");
assert(nextP0OwnerFormFixture.browser_form_static_checks_executed === true, "next P0 owner form fixture must execute static checks");
assert(nextP0OwnerFormFixture.export_contract_verified === true, "next P0 owner form fixture must verify export contract");
assert(nextP0OwnerFormFixture.local_fixture_commands_executed === true, "next P0 owner form fixture must execute fixture checks");
assert(nextP0OwnerFormFixture.real_events_unchanged === true, "next P0 owner form fixture must leave real events unchanged");
assertNoRedLineFlags(nextP0OwnerFormFixture, "next P0 owner form fixture");
for (const expectedScenario of [
  "html_contains_all_focused_inputs",
  "no_network_or_browser_persistence",
  "exports_aggregate_only_review_contract",
  "red_line_flags_false",
]) {
  assert(nextP0OwnerFormFixture.scenarios.some((scenario) => scenario.id === expectedScenario && scenario.ok === true), `next P0 owner form fixture missing ${expectedScenario}`);
}
assert(nextP0OwnerFormFixture.scenarios.every((scenario) => scenario.live_input_files_created === false), "next P0 owner form fixture scenarios must not create live input files");
assert(nextP0OwnerFormFixture.scenarios.every((scenario) => scenario.data_lp_events_write_performed === false), "next P0 owner form fixture scenarios must not write real events");
assert(nextP0OwnerFormFixture.scenarios.every((scenario) => scenario.external_effect === false), "next P0 owner form fixture scenarios must not claim external effects");
assert(nextP0OwnerFormFixtureReport.includes("Next P0 Owner Form Fixture Report"), "next P0 owner form fixture report must have title");
assert(nextP0OwnerFormFixtureReport.includes("no_network_or_browser_persistence"), "next P0 owner form fixture report must include network/persistence scenario");
assert(nextP0OwnerFormFixtureReport.includes("data/lp_events.jsonl write performed: no"), "next P0 owner form fixture report must state no event write");
assert(nextP0QuickCapture.mode === "next_p0_quick_capture", "next P0 quick capture mode must match");
assert(["waiting_for_quick_counts", "partial_quick_counts_waiting", "quick_counts_preview_ready", "blocked_invalid_quick_counts"].includes(nextP0QuickCapture.status), "next P0 quick capture status is invalid");
if (nextP0QuickCapture.status === "blocked_invalid_quick_counts") {
  assert(nextP0QuickCapture.ok === false, "blocked next P0 quick capture should expose ok=false without breaking weekly");
  assert(nextP0QuickCapture.issue_count > 0, "blocked next P0 quick capture must expose issues");
  assert(nextP0QuickCapture.filled_preview_created === false, "blocked next P0 quick capture must not create preview CSV");
} else {
  assert(nextP0QuickCapture.ok === true, "next P0 quick capture status must be ok when waiting, partial, or preview-ready");
}
assert(nextP0QuickCapture.expected_row_count === nextP0OwnerInputs.current_input_count, "next P0 quick capture rows must match focused inputs");
assert(nextP0QuickCapture.template_created === true, "next P0 quick capture must create a quick template");
assert(nextP0QuickCapture.paste_template_created === true, "next P0 quick capture must create a paste template");
assert(nextP0QuickCapture.auto_counts_file_used === false || nextP0QuickCapture.counts_source === "auto_paste_template", "next P0 quick auto counts source must be explicit");
assert(nextP0QuickCapture.paste_template_preserved === true || nextP0QuickCapture.paste_template_preserved === false, "next P0 quick capture must expose paste-template preservation state");
assert(Number.isInteger(nextP0QuickCapture.filled_rank_count), "next P0 quick capture must expose filled rank count");
assert(Array.isArray(nextP0QuickCapture.filled_ranks), "next P0 quick capture must expose filled ranks");
assert(nextP0QuickCapture.partial_auto_counts === true || nextP0QuickCapture.partial_auto_counts === false, "next P0 quick capture must expose partial auto-count state");
assert(nextP0QuickCapture.partial_waiting === true || nextP0QuickCapture.partial_waiting === false, "next P0 quick capture must expose partial waiting state");
if (nextP0QuickCapture.partial_waiting === true) {
  assert(nextP0QuickCapture.filled_preview_created === false, "next P0 quick partial waiting must not create preview CSV");
}
assert(nextP0QuickCapture.live_input_files_created === false, "next P0 quick capture must not create live input files");
assert(nextP0QuickCapture.owner_inbox_write_performed === false, "next P0 quick capture must not write owner inbox files");
assert(nextP0QuickCapture.stage_performed === false, "next P0 quick capture must not stage files");
assert(nextP0QuickCapture.real_events_unchanged === true, "next P0 quick capture must leave real events unchanged");
assertNoRedLineFlags(nextP0QuickCapture, "next P0 quick capture");
assert(nextP0QuickTemplateCsv.startsWith("rank,capture_date,role,tracking_link_id,event_type,stage_label,source_surface,target_live_file,aggregate_count,evidence_ref,reviewer,pii_checked"), "next P0 quick template must use focused owner download headers");
assert(nextP0QuickPasteTemplate.includes("Next P0 Paste Counts Template"), "next P0 quick paste template must have title");
assert(nextP0QuickPasteTemplate.includes("capture_date="), "next P0 quick paste template must include capture_date metadata");
assert(nextP0QuickPasteTemplate.includes("evidence_ref=<aggregate_ref>"), "next P0 quick paste template must include evidence_ref metadata placeholder");
assert(nextP0QuickPasteTemplate.includes("reviewer=<alias>"), "next P0 quick paste template must include reviewer metadata placeholder");
assert(nextP0QuickPasteTemplate.includes("pii_checked=<yes_after_aggregate_only_review>"), "next P0 quick paste template must include pii_checked metadata placeholder");
assert(nextP0QuickPasteTemplate.includes("champion.visits=<count>"), "next P0 quick paste template must include champion visits placeholder");
assert(nextP0QuickPasteTemplate.includes("challenger.cta=<count>"), "next P0 quick paste template must include challenger cta placeholder");
assert(nextP0QuickPasteTemplate.includes("line_cta.line=<count>"), "next P0 quick paste template must include line cta line placeholder");
assert(nextP0QuickPasteTemplate.includes("preserve partial edits") && nextP0QuickPasteTemplate.includes("metadata and all counts are complete"), "next P0 quick paste template must explain complete auto-read and partial preservation");
assert(nextP0QuickPasteTemplate.includes("Keep this aggregate-only"), "next P0 quick paste template must warn aggregate-only");
assert(nextP0QuickFilledPreviewCsv.startsWith("rank,capture_date,role,tracking_link_id,event_type,stage_label,source_surface,target_live_file,aggregate_count,evidence_ref,reviewer,pii_checked"), "next P0 quick filled preview must use focused owner download headers");
assert(nextP0QuickCaptureReport.includes("Next P0 Quick Capture"), "next P0 quick capture report must have title");
assert(nextP0QuickCaptureReport.includes("Paste template:"), "next P0 quick capture report must link paste template");
assert(nextP0QuickCaptureReport.includes("Auto counts file used:"), "next P0 quick capture report must include auto counts state");
assert(nextP0QuickCaptureReport.includes("Partial auto counts:") && nextP0QuickCaptureReport.includes("Partial waiting:"), "next P0 quick capture report must include partial progress state");
assert(nextP0QuickCaptureReport.includes("metadata and all counts are complete") && nextP0QuickCaptureReport.includes("partial owner edits are preserved"), "next P0 quick capture report must document safe paste-template auto-read");
assert(nextP0QuickCaptureReport.includes("champion.visits"), "next P0 quick capture report must document labelled pasted counts");
assert(nextP0QuickCaptureReport.includes("Owner inbox write performed: no"), "next P0 quick capture report must state no inbox write");
assert(nextP0QuickCaptureReport.includes("data/lp_events.jsonl write performed: no"), "next P0 quick capture report must state no event write");
assert(nextP0QuickCaptureFixture.ok === true, "next P0 quick capture fixture status must be ok");
assert(nextP0QuickCaptureFixture.mode === "next_p0_quick_capture_fixture_dry_run", "next P0 quick capture fixture mode must match");
assert(nextP0QuickCaptureFixture.row_count === nextP0OwnerInputs.current_input_count, "next P0 quick capture fixture rows must match focused inputs");
assert(nextP0QuickCaptureFixture.scenario_count === 9, "next P0 quick capture fixtures must cover nine scenarios");
assert(nextP0QuickCaptureFixture.local_fixture_commands_executed === true, "next P0 quick capture fixtures must execute local fixture commands");
assert(nextP0QuickCaptureFixture.scenarios.every((scenario) => scenario.checks.some((check) => check.name === "paste_template_created" && check.ok === true)), "next P0 quick capture fixtures must check paste template creation");
assert(nextP0QuickCaptureFixture.live_project_inputs_created === false, "next P0 quick capture fixtures must not create project live inputs");
assert(nextP0QuickCaptureFixture.owner_inbox_write_performed === false, "next P0 quick capture fixtures must not write project inbox");
assert(nextP0QuickCaptureFixture.stage_performed === false, "next P0 quick capture fixtures must not stage project files");
assertNoRedLineFlags(nextP0QuickCaptureFixture, "next P0 quick capture fixture");
for (const expectedScenario of [
  "waiting_without_counts",
  "valid_quick_counts_preview_ready",
  "labelled_quick_counts_preview_ready",
  "labelled_counts_file_preview_ready",
  "auto_paste_template_preview_ready",
  "partial_auto_paste_template_waiting",
  "incomplete_quick_counts_blocked",
  "sensitive_evidence_blocked",
  "strict_sensitive_evidence_fails",
]) {
  assert(nextP0QuickCaptureFixture.scenarios.some((scenario) => scenario.id === expectedScenario && scenario.ok === true), `next P0 quick capture fixture missing ${expectedScenario}`);
}
{
  const incompleteQuickScenario = nextP0QuickCaptureFixture.scenarios.find((scenario) => scenario.id === "incomplete_quick_counts_blocked");
  const sensitiveQuickScenario = nextP0QuickCaptureFixture.scenarios.find((scenario) => scenario.id === "sensitive_evidence_blocked");
  const strictQuickScenario = nextP0QuickCaptureFixture.scenarios.find((scenario) => scenario.id === "strict_sensitive_evidence_fails");
  assert(incompleteQuickScenario?.exit_code === 0, "incomplete quick counts must soft-block with exit 0 by default");
  assert(sensitiveQuickScenario?.exit_code === 0, "sensitive quick evidence must soft-block with exit 0 by default");
  assert((strictQuickScenario?.exit_code ?? 0) !== 0, "strict quick evidence scenario must fail fast with nonzero exit");
}
assert(nextP0QuickCaptureFixture.scenarios.every((scenario) => scenario.owner_inbox_write_performed === false), "next P0 quick capture fixture scenarios must not write owner inbox");
assert(nextP0QuickCaptureFixture.scenarios.every((scenario) => scenario.data_lp_events_write_performed === false), "next P0 quick capture fixture scenarios must not write real events");
assert(nextP0QuickCaptureFixture.scenarios.every((scenario) => scenario.external_effect === false), "next P0 quick capture fixture scenarios must not claim external effects");
assert(nextP0QuickCaptureFixtureReport.includes("Next P0 Quick Capture Fixture Report"), "next P0 quick capture fixture report must have title");
assert(nextP0QuickCaptureFixtureReport.includes("labelled_quick_counts_preview_ready"), "next P0 quick capture fixture report must include labelled pasted counts scenario");
assert(nextP0QuickCaptureFixtureReport.includes("auto_paste_template_preview_ready"), "next P0 quick capture fixture report must include auto paste-template scenario");
assert(nextP0QuickCaptureFixtureReport.includes("partial_auto_paste_template_waiting"), "next P0 quick capture fixture report must include partial auto paste-template scenario");
assert(nextP0QuickCaptureFixtureReport.includes("partially filled paste template"), "next P0 quick capture fixture report must document partial paste-template progress");
assert(nextP0QuickCaptureFixtureReport.includes("sensitive_evidence_blocked"), "next P0 quick capture fixture report must include sensitive block scenario");
assert(nextP0QuickCaptureFixtureReport.includes("data/lp_events.jsonl write performed: no"), "next P0 quick capture fixture report must state no event write");
assert(p0CountsPreflightSource.includes("p0_counts_preflight_local_only"), "P0 counts preflight source must stay local-only");
assert(p0CountsPreflightSource.includes("blocked_invalid_p0_counts"), "P0 counts preflight source must expose invalid-count block");
assert(p0CountsPreflightSource.includes("ready_for_next_p0_quick"), "P0 counts preflight source must expose ready-for-quick state");
assert(p0CountsPreflightFixturesSource.includes("p0_counts_preflight_fixture_dry_run"), "P0 counts preflight fixtures must stay dry-run");
assert(p0CountsPreflight.mode === "p0_counts_preflight_local_only", "P0 counts preflight mode must be local-only");
assert(["waiting_for_owner_p0_counts", "partial_p0_counts_waiting", "ready_for_next_p0_quick", "blocked_invalid_p0_counts"].includes(p0CountsPreflight.status), "P0 counts preflight status is invalid");
if (p0CountsPreflight.status === "blocked_invalid_p0_counts") {
  assert(p0CountsPreflight.ok === false, "blocked P0 counts preflight should expose ok=false without breaking weekly");
  assert(p0CountsPreflight.issue_count > 0, "blocked P0 counts preflight must expose issues");
} else {
  assert(p0CountsPreflight.ok === true, "P0 counts preflight must be ok when waiting, partial, or ready");
}
assert(p0CountsPreflight.expected_count_key_count === nextP0OwnerInputs.current_input_count, "P0 counts preflight expected count keys must match focused inputs");
assert(p0CountsPreflight.filled_count_key_count + p0CountsPreflight.placeholder_count_key_count + p0CountsPreflight.invalid_count_key_count === p0CountsPreflight.expected_count_key_count, "P0 counts preflight count states must total expected keys");
assert(p0CountsPreflight.ready_for_quick_preview === (p0CountsPreflight.status === "ready_for_next_p0_quick"), "P0 counts preflight ready flag must match ready status");
assert(p0CountsPreflightStatus.status === p0CountsPreflight.status, "P0 counts preflight compact status must match full report");
assert(p0CountsPreflightStatus.expected_count_key_count === p0CountsPreflight.expected_count_key_count, "P0 counts preflight compact expected count must match");
assert(p0CountsPreflightStatus.filled_count_key_count === p0CountsPreflight.filled_count_key_count, "P0 counts preflight compact filled count must match");
assert(p0CountsPreflightStatus.placeholder_count_key_count === p0CountsPreflight.placeholder_count_key_count, "P0 counts preflight compact placeholder count must match");
assert(p0CountsPreflightStatus.issue_count === p0CountsPreflight.issue_count, "P0 counts preflight compact issue count must match");
assert(p0CountsPreflight.live_input_files_created === false, "P0 counts preflight must not create live input files");
assert(p0CountsPreflight.owner_inbox_write_performed === false, "P0 counts preflight must not write owner inbox");
assert(p0CountsPreflight.stage_performed === false, "P0 counts preflight must not stage files");
assertNoRedLineFlags(p0CountsPreflight, "P0 counts preflight");
assertNoRedLineFlags(p0CountsPreflightStatus, "P0 counts preflight compact status");
assert(p0CountsPreflightReport.includes("3Q Growth Loop P0 Counts Preflight"), "P0 counts preflight report must have title");
assert(p0CountsPreflightReport.includes("Ready for quick preview:"), "P0 counts preflight report must expose quick-preview readiness");
assert(p0CountsPreflightReport.includes("Count keys filled:"), "P0 counts preflight report must expose filled count progress");
assert(p0CountsPreflightReport.includes("data/lp_events.jsonl write performed: no"), "P0 counts preflight report must state no event write");
assert(p0CountsPreflightReport.includes("GitHub push / PR performed: no"), "P0 counts preflight report must state no GitHub push or PR");
assert(p0CountsPreflightFixture.ok === true, "P0 counts preflight fixtures must be ok");
assert(p0CountsPreflightFixture.mode === "p0_counts_preflight_fixture_dry_run", "P0 counts preflight fixture mode must match");
assert(p0CountsPreflightFixture.scenario_count === 4, "P0 counts preflight fixtures must cover four scenarios");
for (const expectedScenario of [
  "waiting_placeholders",
  "partial_counts_waiting",
  "ready_for_quick",
  "sensitive_metadata_blocked",
]) {
  assert(p0CountsPreflightFixture.scenarios.some((scenario) => scenario.id === expectedScenario && scenario.ok === true), `P0 counts preflight fixture missing ${expectedScenario}`);
}
assert(p0CountsPreflightFixture.live_project_inputs_created === false, "P0 counts preflight fixtures must not create project live inputs");
assert(p0CountsPreflightFixture.owner_inbox_write_performed === false, "P0 counts preflight fixtures must not write owner inbox");
assert(p0CountsPreflightFixture.stage_performed === false, "P0 counts preflight fixtures must not stage files");
assertNoRedLineFlags(p0CountsPreflightFixture, "P0 counts preflight fixtures");
assert(p0CountsPreflightFixture.scenarios.every((scenario) => scenario.data_lp_events_write_performed === false), "P0 counts preflight fixture scenarios must not write real events");
assert(p0CountsPreflightFixture.scenarios.every((scenario) => scenario.external_effect === false), "P0 counts preflight fixture scenarios must not claim external effects");
assert(p0CountsPreflightFixtureReport.includes("p0_counts_preflight_fixtures_ok"), "P0 counts preflight fixture report must state fixtures ok");
assert(p0CountsPreflightFixtureReport.includes("sensitive_metadata_blocked"), "P0 counts preflight fixture report must include sensitive metadata block");
assert(p0CountsPreflightFixtureReport.includes("data/lp_events.jsonl write performed: no"), "P0 counts preflight fixture report must state no event write");
assert(nextP0OwnerIntake.ok === true, "next P0 owner intake status must be ok");
assert(nextP0OwnerIntake.mode === "next_p0_owner_intake", "next P0 owner intake mode must match");
assert([
  "waiting_for_next_p0_owner_download",
  "next_p0_owner_download_preview_ready",
].includes(nextP0OwnerIntake.status), "weekly next P0 owner intake must wait or preview without staging");
assert(nextP0OwnerIntake.expected_row_count === nextP0OwnerInputs.current_input_count, "next P0 owner intake expected rows must match focused inputs");
assert(nextP0OwnerIntake.stage_requested === false, "weekly next P0 owner intake must not request staging");
assert(nextP0OwnerIntake.confirm_owner_reviewed === false, "weekly next P0 owner intake must not claim owner confirmation");
assert(nextP0OwnerIntake.stage_performed === false, "weekly next P0 owner intake must not stage live inputs");
assert(nextP0OwnerIntake.live_input_files_created === false, "weekly next P0 owner intake must not create live input files");
assert(nextP0OwnerIntake.real_events_unchanged === true, "next P0 owner intake must leave real events unchanged");
assert((nextP0OwnerIntake.candidate_paths_checked ?? []).some((item) => item.includes("next_p0_owner_inputs.quick-filled.preview.csv")), "next P0 owner intake must check quick-filled preview as a default candidate");
assertNoRedLineFlags(nextP0OwnerIntake, "next P0 owner intake");
assert(nextP0OwnerIntakeFunnelPreview.startsWith("date,asset_id,event_type,count,source,medium,campaign,content_id,variant_id,quality_score"), "next P0 owner intake funnel preview must use aggregate CSV headers");
assert(nextP0OwnerIntakeManualPreview.startsWith("date,asset_id,event_type,count,source,medium,campaign,content_id,variant_id,quality_score"), "next P0 owner intake manual preview must use aggregate CSV headers");
if (nextP0OwnerIntake.candidate_found) {
  assert(nextP0OwnerIntake.candidate_valid === true, "found next P0 owner intake candidate must validate");
  assert(["project_inbox", "quick_preview", "downloads", "explicit_input"].includes(nextP0OwnerIntake.candidate_source), "next P0 owner intake candidate source must be explicit");
  assert(nextP0OwnerIntake.downloaded_row_count === nextP0OwnerInputs.current_input_count, "next P0 owner intake downloaded rows must match focused inputs");
  assert(nextP0OwnerIntake.filled_rows === nextP0OwnerInputs.current_input_count, "next P0 owner intake filled rows must match focused inputs");
  assert(nextP0OwnerIntake.funnel_preview_rows + nextP0OwnerIntake.manual_preview_rows === nextP0OwnerInputs.current_input_count, "next P0 owner intake preview rows must match focused inputs");
} else {
  assert(nextP0OwnerIntake.funnel_preview_rows === 0, "waiting next P0 owner intake must have zero funnel preview rows");
  assert(nextP0OwnerIntake.manual_preview_rows === 0, "waiting next P0 owner intake must have zero manual preview rows");
}
assert(nextP0OwnerIntakeReport.includes("Next P0 Owner Intake"), "next P0 owner intake report must have title");
assert(nextP0OwnerIntakeReport.includes("data/lp_events.jsonl write performed: no"), "next P0 owner intake report must state no event write");
assert(nextP0OwnerIntakeReport.includes("Staging live local CSVs requires"), "next P0 owner intake report must gate staging");
assert(nextP0OwnerIntakeFixture.ok === true, "next P0 owner intake fixture status must be ok");
assert(nextP0OwnerIntakeFixture.mode === "next_p0_owner_intake_fixture_dry_run", "next P0 owner intake fixture mode must match");
assert(nextP0OwnerIntakeFixture.row_count === nextP0OwnerInputs.current_input_count, "next P0 owner intake fixture rows must match focused inputs");
assert(nextP0OwnerIntakeFixture.scenario_count === 5, "next P0 owner intake fixture must cover five scenarios");
assert(nextP0OwnerIntakeFixture.local_fixture_commands_executed === true, "next P0 owner intake fixture must execute local fixture commands");
assert(nextP0OwnerIntakeFixture.live_project_inputs_created === false, "next P0 owner intake fixture must not create project live inputs");
assertNoRedLineFlags(nextP0OwnerIntakeFixture, "next P0 owner intake fixture");
for (const expectedScenario of [
  "valid_download_preview_ready",
  "quick_preview_auto_intake_ready",
  "sensitive_evidence_blocked",
  "stage_without_confirmation_blocked",
  "confirmed_stage_writes_temp_live_inputs_only",
]) {
  assert(nextP0OwnerIntakeFixture.scenarios.some((scenario) => scenario.id === expectedScenario && scenario.ok === true), `next P0 owner intake fixture missing ${expectedScenario}`);
}
assert(nextP0OwnerIntakeFixture.scenarios.every((scenario) => scenario.live_project_inputs_created === false), "next P0 owner intake fixture scenarios must not create project live inputs");
assert(nextP0OwnerIntakeFixture.scenarios.every((scenario) => scenario.data_lp_events_write_performed === false), "next P0 owner intake fixture scenarios must not write real events");
assert(nextP0OwnerIntakeFixture.scenarios.every((scenario) => scenario.external_effect === false), "next P0 owner intake fixture scenarios must not claim external effects");
assert(nextP0OwnerIntakeFixtureReport.includes("Next P0 Owner Intake Fixture Report"), "next P0 owner intake fixture report must have title");
assert(nextP0OwnerIntakeFixtureReport.includes("quick_preview_auto_intake_ready"), "next P0 owner intake fixture report must include quick-preview auto-intake scenario");
assert(nextP0OwnerIntakeFixtureReport.includes("sensitive_evidence_blocked"), "next P0 owner intake fixture report must include sensitive block scenario");
assert(nextP0OwnerIntakeFixtureReport.includes("data/lp_events.jsonl write performed: no"), "next P0 owner intake fixture report must state no event write");
assert(sampleGateCaptureCalendar.ok === true, "sample-gate capture calendar must be ok");
assert(sampleGateCaptureCalendarStatus.ok === true, "sample-gate capture calendar compact status must be ok");
assert(sampleGateCaptureCalendar.mode === "sample_gate_capture_calendar", "sample-gate capture calendar mode must match");
assert(sampleGateCaptureCalendarStatus.mode === "sample_gate_capture_calendar", "sample-gate capture calendar compact mode must match");
assert(sampleGateCaptureCalendarStatus.status === sampleGateCaptureCalendar.status, "sample-gate capture calendar compact status must match full JSON");
assert(["waiting_for_owner_sample_gate_counts", "sample_threshold_met_review_quality_gate"].includes(sampleGateCaptureCalendar.status), "sample-gate capture calendar status is invalid");
assert(Array.isArray(sampleGateCaptureCalendar.events) && sampleGateCaptureCalendar.events.length >= 3, "sample-gate capture calendar must include at least three events");
assert(sampleGateCaptureCalendarStatus.event_count === sampleGateCaptureCalendar.events.length, "sample-gate capture calendar compact event count must match");
assert(sampleGateCaptureCalendar.events.some((event) => event.id === "minimum_sample_check_day3"), "sample-gate capture calendar must include Day 3 minimum sample check");
assert(sampleGateCaptureCalendar.events.some((event) => event.id === "preferred_sample_check_day7"), "sample-gate capture calendar must include Day 7 preferred sample check");
assert(sampleGateCaptureCalendar.events.every((event) => event.owner_review_required === true), "sample-gate capture calendar events must require owner review");
assert(sampleGateCaptureCalendar.events.every((event) => event.external_effect === false), "sample-gate capture calendar events must have no external effect");
assert(sampleGateCaptureCalendar.p0_input_count === nextP0OwnerInputs.current_input_count, "sample-gate capture calendar P0 input count must match focused inputs");
assert(sampleGateCaptureCalendarStatus.p0_input_count === sampleGateCaptureCalendar.p0_input_count, "sample-gate capture calendar compact input count must match");
assert(sampleGateCaptureCalendar.p0_pending_count === dataCollectionProgressStatus.p0_pending_count, "sample-gate capture calendar P0 pending count must match data progress");
assert(sampleGateCaptureCalendar.progress_status === dataCollectionProgressStatus.status, "sample-gate capture calendar progress status must match data progress");
assert(sampleGateCaptureCalendarStatus.progress_status === sampleGateCaptureCalendar.progress_status, "sample-gate capture calendar compact progress status must match");
assert(sampleGateCaptureCalendar.next_due_event?.id === sampleGateCaptureCalendarStatus.next_due_event_id, "sample-gate capture calendar next due id must match compact status");
assert(sampleGateCaptureCalendar.next_due_event?.date === sampleGateCaptureCalendarStatus.next_due_date, "sample-gate capture calendar next due date must match compact status");
assert(sampleGateCaptureCalendar.calendar_import_performed === false, "sample-gate capture calendar must not import into Calendar");
assert(sampleGateCaptureCalendar.system_reminder_created === false, "sample-gate capture calendar must not create system reminders");
assert(sampleGateCaptureCalendar.browser_open_performed === false, "sample-gate capture calendar must not open browser automatically");
assert(sampleGateCaptureCalendarStatus.calendar_import_performed === false, "sample-gate capture calendar compact status must not import Calendar");
assert(sampleGateCaptureCalendarStatus.system_reminder_created === false, "sample-gate capture calendar compact status must not create reminders");
assert(sampleGateCaptureCalendarStatus.browser_open_performed === false, "sample-gate capture calendar compact status must not open browser");
assertNoRedLineFlags(sampleGateCaptureCalendar, "sample-gate capture calendar");
assertNoRedLineFlags(sampleGateCaptureCalendarStatus, "sample-gate capture calendar compact status");
assert(sampleGateCaptureCalendarMd.includes("3Q Growth Loop Sample Gate Capture Calendar"), "sample-gate capture calendar markdown must have title");
assert(sampleGateCaptureCalendarMd.includes("Calendar import performed: no"), "sample-gate capture calendar markdown must state no Calendar import");
assert(sampleGateCaptureCalendarMd.includes("System reminder created: no"), "sample-gate capture calendar markdown must state no reminder");
assert(sampleGateCaptureCalendarMd.includes("External effect: no"), "sample-gate capture calendar markdown must state no external effect");
assert(sampleGateCaptureCalendarIcs.includes("BEGIN:VCALENDAR"), "sample-gate capture calendar ICS must be a calendar");
assert(sampleGateCaptureCalendarIcs.includes("minimum_sample_check_day3@3q-growth-loop.local"), "sample-gate capture calendar ICS must include Day 3 event UID");
assert(sampleGateCaptureCalendarIcs.includes("preferred_sample_check_day7@3q-growth-loop.local"), "sample-gate capture calendar ICS must include Day 7 event UID");
assert(!/https?:\/\//i.test(sampleGateCaptureCalendarIcs), "sample-gate capture calendar ICS must not include external URLs");
assert(sampleGateDueStatus.ok === true, "sample-gate due status must be ok");
assert(sampleGateDueStatusCompact.ok === true, "sample-gate due compact status must be ok");
assert(sampleGateDueStatus.mode === "sample_gate_due_status", "sample-gate due status mode must match");
assert(sampleGateDueStatusCompact.mode === "sample_gate_due_status", "sample-gate due compact mode must match");
assert(sampleGateDueStatusCompact.status === sampleGateDueStatus.status, "sample-gate due compact status must match full status");
assert([
  "waiting_until_day3",
  "day3_due_waiting_for_owner_counts",
  "day3_overdue_waiting_for_owner_counts",
  "day7_due_waiting_for_owner_counts",
  "counts_filled_sample_insufficient_continue_champion",
  "sample_threshold_met_quality_gate_next",
  "sample_rate_candidate_due_quality_review",
].includes(sampleGateDueStatus.status), "sample-gate due status is invalid");
assert(Boolean(sampleGateDueStatus.today), "sample-gate due status must include today");
assert(Boolean(sampleGateDueStatus.min_check_date), "sample-gate due status must include minimum check date");
assert(Boolean(sampleGateDueStatus.preferred_check_date), "sample-gate due status must include preferred check date");
assert(Boolean(sampleGateDueStatus.due_event_id), "sample-gate due status must include due event id");
assert(Boolean(sampleGateDueStatus.due_date), "sample-gate due status must include due date");
assert(sampleGateDueStatus.p0_input_count === nextP0OwnerInputs.current_input_count, "sample-gate due P0 input count must match focused inputs");
assert(sampleGateDueStatusCompact.p0_input_count === sampleGateDueStatus.p0_input_count, "sample-gate due compact input count must match");
assert(sampleGateDueStatus.p0_pending_count === dataCollectionProgressStatus.p0_pending_count, "sample-gate due P0 pending count must match data progress");
assert(sampleGateDueStatus.progress_status === dataCollectionProgressStatus.status, "sample-gate due progress status must match data progress");
assert(sampleGateDueStatus.capture_calendar_status === sampleGateCaptureCalendar.status, "sample-gate due status must read capture calendar status");
assert(sampleGateDueStatus.capture_calendar_next_due_date === sampleGateCaptureCalendarStatus.next_due_date, "sample-gate due status must read capture calendar next due date");
assert(sampleGateDueStatus.capture_calendar_next_due_event_id === sampleGateCaptureCalendarStatus.next_due_event_id, "sample-gate due status must read capture calendar next due event");
assert(sampleGateDueStatus.challenger_promotion_allowed === false, "sample-gate due status must not allow challenger promotion");
assert(sampleGateDueStatus.next_variable_rotation_allowed === false, "sample-gate due status must not allow variable rotation");
assert(sampleGateDueStatus.calendar_import_performed === false, "sample-gate due status must not import Calendar");
assert(sampleGateDueStatus.system_reminder_created === false, "sample-gate due status must not create system reminders");
assert(sampleGateDueStatus.browser_open_performed === false, "sample-gate due status must not open browser automatically");
assert(sampleGateDueStatusCompact.calendar_import_performed === false, "sample-gate due compact status must not import Calendar");
assert(sampleGateDueStatusCompact.system_reminder_created === false, "sample-gate due compact status must not create reminders");
assert(sampleGateDueStatusCompact.browser_open_performed === false, "sample-gate due compact status must not open browser");
assertNoRedLineFlags(sampleGateDueStatus, "sample-gate due status");
assertNoRedLineFlags(sampleGateDueStatusCompact, "sample-gate due compact status");
assert(sampleGateDueStatusMd.includes("3Q Growth Loop Sample Gate Due Status"), "sample-gate due markdown must have title");
assert(sampleGateDueStatusMd.includes("Challenger promotion allowed: no"), "sample-gate due markdown must state no promotion");
assert(sampleGateDueStatusMd.includes("Next variable rotation allowed: no"), "sample-gate due markdown must state no rotation");
assert(sampleGateDueStatusMd.includes("External effect: no"), "sample-gate due markdown must state no external effect");
assert(sampleGateDueFixture.ok === true, "sample-gate due fixture status must be ok");
assert(sampleGateDueFixture.mode === "sample_gate_due_fixture_dry_run", "sample-gate due fixture mode must match");
assert(sampleGateDueFixture.scenario_count === 4, "sample-gate due fixtures must cover four timing states");
assert(sampleGateDueFixture.local_fixture_commands_executed === true, "sample-gate due fixtures must execute local fixture commands");
assert(sampleGateDueFixture.project_due_status_write_performed === false, "sample-gate due fixtures must not overwrite project due status artifacts");
assert(sampleGateDueFixture.data_lp_events_write_performed === false, "sample-gate due fixtures must not write data/lp_events.jsonl");
assertNoRedLineFlags(sampleGateDueFixture, "sample-gate due fixture");
for (const expectedScenario of ["waiting_before_day3", "day3_due", "day3_overdue_recovery", "day7_due"]) {
  assert(sampleGateDueFixture.scenarios.some((scenario) => scenario.id === expectedScenario && scenario.ok === true), `sample-gate due fixture missing ${expectedScenario}`);
}
assert(sampleGateDueFixture.scenarios.some((scenario) => scenario.status === "day3_overdue_waiting_for_owner_counts" && scenario.due_phase === "minimum_check_overdue"), "sample-gate due fixture must prove Day 3 overdue recovery");
assert(sampleGateDueFixture.scenarios.every((scenario) => scenario.project_due_status_write_performed === false), "sample-gate due fixture scenarios must not overwrite project due status");
assert(sampleGateDueFixture.scenarios.every((scenario) => scenario.data_lp_events_write_performed === false), "sample-gate due fixture scenarios must not write events");
assert(sampleGateDueFixture.scenarios.every((scenario) => scenario.external_effect === false), "sample-gate due fixture scenarios must not claim external effects");
assert(sampleGateDueFixtureReport.includes("Sample Gate Due Fixture Report"), "sample-gate due fixture report must have title");
assert(sampleGateDueFixtureReport.includes("day3_overdue_recovery"), "sample-gate due fixture report must include overdue recovery scenario");
assert(sampleGateDueFixtureReport.includes("Project due-status write performed: no"), "sample-gate due fixture report must state no project due-status overwrite");
assert(sampleGatePlan.ok === true, "sample gate collection plan must be ok");
assert(sampleGateStatus.ok === true, "sample gate collection status must be ok");
assert(sampleGatePlan.mode === "sample_gate_collection_plan", "sample gate plan mode must match");
assert(sampleGateStatus.mode === "sample_gate_collection_plan", "sample gate status mode must match");
assert(["waiting_for_sample_gate_counts", "sample_threshold_met"].includes(sampleGatePlan.status), "sample gate plan status is invalid");
assert(sampleGateStatus.status === sampleGatePlan.status, "sample gate status must match plan");
assert(JSON.stringify(sampleGatePlan.required_event_types) === JSON.stringify(["page_view", "cta_click", "line_add"]), "sample gate plan must focus on page_view, cta_click, and line_add");
assert(sampleGateStatus.sample_stage_count === 3, "sample gate plan must cover three sample-gate event types");
const expectedSampleGateTasks = sampleGatePlan.status === "sample_threshold_met" ? 0 : sampleGateStatus.sample_stage_count * dataCollectionStatus.importable_link_count;
const expectedSampleGateLinks = expectedSampleGateTasks === 0 ? 0 : dataCollectionStatus.importable_link_count;
assert(sampleGateStatus.p0_task_count === expectedSampleGateTasks, "sample gate task count must match current sample gate status");
assert(sampleGateStatus.p0_link_count === expectedSampleGateLinks, "sample gate link count must match current sample gate status");
assert(sampleGatePlan.event_summaries.length === 3, "sample gate plan must summarize three event types");
assert(sampleGatePlan.link_groups.length === sampleGateStatus.p0_link_count, "sample gate plan link groups must match status");
assert(sampleGatePlan.link_groups.every((group) => ["page_view", "cta_click", "line_add"].every((eventType) => group.tasks_by_event_type[eventType]?.external_effect === false)), "sample gate link tasks must have no external effect");
assert(sampleGatePlan.global_sample_gaps.visits === (dataCollection.sample_progress.gaps.visits ?? 0), "sample gate visits gap must match data collection");
assert(sampleGatePlan.global_sample_gaps.cta_clicks === (dataCollection.sample_progress.gaps.cta_clicks ?? 0), "sample gate CTA gap must match data collection");
assert(sampleGatePlan.global_sample_gaps.line_adds === (dataCollection.sample_progress.gaps.line_adds ?? 0), "sample gate LINE gap must match data collection");
assert(sampleGatePlan.global_sample_gaps.test_days === (dataCollection.sample_progress.gaps.test_days ?? 0), "sample gate test-days gap must match data collection");
assert(sampleGatePlan.real_events_unchanged === true, "sample gate plan must leave real events unchanged");
assert(sampleGatePlan.live_input_files_created === false, "sample gate plan must not create live input files");
assert(sampleGatePlan.data_lp_events_write_performed === false, "sample gate plan must not write data/lp_events.jsonl");
assert(sampleGatePlan.external_effect === false, "sample gate plan must not claim external effects");
assert(sampleGateStatus.live_input_files_created === false, "sample gate status must not create live input files");
assert(sampleGateStatus.data_lp_events_write_performed === false, "sample gate status must not write data/lp_events.jsonl");
assert(sampleGateStatus.external_effect === false, "sample gate status must not claim external effects");
assert(sampleGatePlanMd.includes("Sample Gate Collection Plan"), "sample gate markdown must have title");
assert(sampleGatePlanMd.includes("P0 Event Summary"), "sample gate markdown must include event summary");
assert(sampleGatePlanMd.includes("source_capture_ledger.filled.csv"), "sample gate markdown must point to owner filled ledger");
assert(sampleGatePlanMd.includes("line_add_rate beats champion by 1.15x"), "sample gate markdown must preserve win rule");
assert(ownerCaptureQueue.ok === true, "Week 0 owner capture queue must be ok");
assert(ownerCaptureQueueStatus.ok === true, "Week 0 owner capture queue status must be ok");
assert(ownerCaptureQueue.mode === "week0_owner_capture_queue", "Week 0 owner capture queue mode must match");
assert(ownerCaptureQueueStatus.mode === "week0_owner_capture_queue", "Week 0 owner capture queue status mode must match");
assert(["waiting_for_owner_sample_gate_counts", "owner_sample_gate_filled_compile_next"].includes(ownerCaptureQueue.status), "Week 0 owner capture queue status is invalid");
assert(ownerCaptureQueueStatus.status === ownerCaptureQueue.status, "Week 0 owner capture queue status must match queue");
assert(ownerCaptureQueue.p0_task_count === sampleGateStatus.p0_task_count, "Week 0 owner capture queue task count must match sample gate status");
assert(ownerCaptureQueueStatus.p0_task_count === ownerCaptureQueue.p0_task_count, "Week 0 owner capture queue status task count must match queue");
assert(ownerCaptureQueue.p0_link_count === sampleGateStatus.p0_link_count, "Week 0 owner capture queue link count must match sample gate status");
assert(ownerCaptureQueueStatus.p0_link_count === ownerCaptureQueue.p0_link_count, "Week 0 owner capture queue status link count must match queue");
assert(ownerCaptureQueue.p0_task_count === 18, "Week 0 owner capture queue must contain the 18-row sample-gate fast path");
assert(ownerCaptureQueue.p0_link_count === 6, "Week 0 owner capture queue must cover six importable sample-gate links");
assert(Array.isArray(ownerCaptureQueue.capture_rows) && ownerCaptureQueue.capture_rows.length === ownerCaptureQueue.p0_task_count, "Week 0 owner capture queue rows must match p0 task count");
assert(Array.isArray(ownerCaptureQueue.source_groups) && ownerCaptureQueue.source_groups.length === ownerCaptureQueue.source_group_count, "Week 0 owner capture source groups must match count");
assert(ownerCaptureQueue.source_group_count >= 2, "Week 0 owner capture queue must group Worker analytics and LINE OA surfaces");
assert(ownerCaptureQueue.capture_rows.every((row) => ["page_view", "cta_click", "line_add"].includes(row.event_type)), "Week 0 owner capture queue must only include sample-gate event types");
assert(ownerCaptureQueue.capture_rows.every((row) => row.external_effect === false), "Week 0 owner capture rows must have no external effect");
assert(ownerCaptureQueue.owner_fill?.owner_fill_path === "data/source_capture/sample_gate_ledger.filled.csv", "Week 0 owner capture queue must point to the sample-gate filled ledger");
assert(ownerCaptureQueue.owner_fill?.required_fields.includes("aggregate_count"), "Week 0 owner capture queue must require aggregate_count");
assert(ownerCaptureQueue.owner_fill?.required_fields.includes("evidence_ref"), "Week 0 owner capture queue must require evidence_ref");
assert(ownerCaptureQueue.owner_fill?.required_fields.includes("pii_checked"), "Week 0 owner capture queue must require pii_checked");
assert(ownerCaptureQueue.next_safe_command_after_owner_fill.includes("source:compile"), "Week 0 owner capture queue must point to preview compile command");
assert(ownerCaptureQueue.real_events_unchanged === true, "Week 0 owner capture queue must leave real events unchanged");
assert(ownerCaptureQueue.live_input_files_created === false, "Week 0 owner capture queue must not create live input files");
assert(ownerCaptureQueue.data_lp_events_write_performed === false, "Week 0 owner capture queue must not write data/lp_events.jsonl");
assert(ownerCaptureQueue.external_effect === false, "Week 0 owner capture queue must not claim external effects");
assert(ownerCaptureQueue.production_deploy_performed === false, "Week 0 owner capture queue must not deploy production");
assert(ownerCaptureQueue.public_link_change_performed === false, "Week 0 owner capture queue must not change public links");
assert(ownerCaptureQueue.github_push_or_pr_performed === false, "Week 0 owner capture queue must not push or create PR");
assert(ownerCaptureQueue.formal_post_performed === false, "Week 0 owner capture queue must not formally post");
assert(ownerCaptureQueue.line_push_performed === false, "Week 0 owner capture queue must not push LINE");
assert(ownerCaptureQueue.customer_data_mutation_performed === false, "Week 0 owner capture queue must not mutate customer data");
assert(ownerCaptureQueue.payment_action_performed === false, "Week 0 owner capture queue must not touch payments");
assert(ownerCaptureQueue.delete_action_performed === false, "Week 0 owner capture queue must not delete data");
assert(ownerCaptureQueueStatus.live_input_files_created === false, "Week 0 owner capture status must not create live input files");
assert(ownerCaptureQueueStatus.data_lp_events_write_performed === false, "Week 0 owner capture status must not write data/lp_events.jsonl");
assert(ownerCaptureQueueStatus.external_effect === false, "Week 0 owner capture status must not claim external effects");
assert(ownerCaptureQueueMd.includes("Week 0 Owner Capture Queue"), "Week 0 owner capture markdown must have title");
assert(ownerCaptureQueueMd.includes("Source Groups"), "Week 0 owner capture markdown must include source groups");
assert(ownerCaptureQueueMd.includes("Fastest Path"), "Week 0 owner capture markdown must include fastest path");
assert(ownerSampleGate.ok === true, "owner sample gate status must be ok");
assert(ownerSampleGateStatus.ok === true, "owner sample gate compact status must be ok");
assert(ownerSampleGate.mode === "owner_sample_gate_status", "owner sample gate mode must match");
assert(ownerSampleGateStatus.mode === "owner_sample_gate_status", "owner sample gate compact mode must match");
assert(ownerSampleGateStatus.status === ownerSampleGate.status, "owner sample gate compact status must match full JSON");
assert(["waiting_for_owner_sample_gate_counts", "owner_counts_incomplete", "sample_insufficient_keep_champion", "sample_rate_win_needs_quality_review", "sample_ready_challenger_underperforms"].includes(ownerSampleGate.status), "owner sample gate status is invalid");
assert(ownerSampleGate.quality_guard_status === "not_evaluated_from_sample_gate", "owner sample gate must not claim quality regression was fully evaluated");
assert(ownerSampleGate.no_quality_regression === null, "owner sample gate must keep no_quality_regression null");
assert(ownerSampleGate.challenger_win_rule_met === false, "owner sample gate must not mark final win rule met");
assert(ownerSampleGate.promotion_performed === false, "owner sample gate must not promote challenger");
assert(ownerSampleGate.live_input_files_created === false, "owner sample gate must not create live input files");
assert(ownerSampleGate.data_lp_events_write_performed === false, "owner sample gate must not write data/lp_events.jsonl");
assert(ownerSampleGate.external_effect === false, "owner sample gate must not claim external effects");
assert(ownerSampleGate.public_link_change_performed === false, "owner sample gate must not change public links");
assert(ownerSampleGate.production_deploy_performed === false, "owner sample gate must not deploy production");
assert(ownerSampleGate.formal_post_performed === false, "owner sample gate must not formally post");
assert(ownerSampleGate.line_push_performed === false, "owner sample gate must not push LINE");
assert(ownerSampleGate.customer_data_mutation_performed === false, "owner sample gate must not mutate customer data");
assert(ownerSampleGate.payment_action_performed === false, "owner sample gate must not touch payments");
assert(ownerSampleGate.delete_action_performed === false, "owner sample gate must not delete data");
assert(ownerSampleGateMd.includes("Owner Sample Gate Status"), "owner sample gate markdown must have title");
assert(ownerSampleGateMd.includes("Quality guard: not_evaluated_from_sample_gate"), "owner sample gate markdown must preserve quality review gate");
assert(ownerSampleGateMd.includes("Promotion performed: no"), "owner sample gate markdown must state no promotion");
assert(sampleGateOwnerWorksheet.ok === true, "sample gate owner worksheet must be ok");
assert(sampleGateOwnerWorksheetStatus.ok === true, "sample gate owner worksheet compact status must be ok");
assert(sampleGateOwnerWorksheet.mode === "sample_gate_owner_worksheet", "sample gate owner worksheet mode must match");
assert(sampleGateOwnerWorksheetStatus.mode === "sample_gate_owner_worksheet", "sample gate owner worksheet compact mode must match");
assert(sampleGateOwnerWorksheetStatus.status === sampleGateOwnerWorksheet.status, "sample gate owner worksheet compact status must match full JSON");
assert(sampleGateOwnerWorksheet.row_count === 18, "sample gate owner worksheet must cover 18 P0 rows");
assert(sampleGateOwnerWorksheetStatus.row_count === 18, "sample gate owner worksheet compact status must cover 18 rows");
assert(sampleGateOwnerWorksheet.link_count === 6, "sample gate owner worksheet must cover six importable links");
assert(sampleGateOwnerWorksheet.source_group_count === 2, "sample gate owner worksheet must group landing analytics and LINE aggregate sources");
assert(JSON.stringify(sampleGateOwnerWorksheet.p0_event_types) === JSON.stringify(["page_view", "cta_click", "line_add"]), "sample gate owner worksheet must focus on P0 events");
assert(["waiting_for_owner_sample_gate_counts", "owner_filled_ledger_detected_review_compile_next"].includes(sampleGateOwnerWorksheet.status), "sample gate owner worksheet status is invalid");
assert(sampleGateOwnerWorksheet.owner_sample_gate_status === ownerSampleGateStatus.status, "sample gate owner worksheet must read owner sample gate status");
assert(sampleGateOwnerWorksheet.required_owner_fields.every((field) => ["capture_date", "aggregate_count", "evidence_ref", "reviewer", "pii_checked"].includes(field)), "sample gate owner worksheet fields must be owner-safe");
assert(sampleGateOwnerWorksheet.rows.every((row) => ["page_view", "cta_click", "line_add"].includes(row.stage)), "sample gate owner worksheet rows must only include P0 events");
assert(sampleGateOwnerWorksheet.rows.every((row) => row.fill_fields.includes("aggregate_count") && row.fill_fields.includes("pii_checked")), "sample gate owner worksheet rows must include required fill fields");
assert(sampleGateOwnerWorksheet.rows.every((row) => row.pii_rule && !/customer rows|visitor identifiers/i.test(row.evidence_ref ?? "")), "sample gate owner worksheet rows must carry privacy rules");
assert(sampleGateOwnerWorksheet.live_input_files_created === false, "sample gate owner worksheet must not create live input files");
assert(sampleGateOwnerWorksheet.data_lp_events_write_performed === false, "sample gate owner worksheet must not write data/lp_events.jsonl");
assert(sampleGateOwnerWorksheet.external_effect === false, "sample gate owner worksheet must not claim external effects");
assert(sampleGateOwnerWorksheet.public_link_change_performed === false, "sample gate owner worksheet must not change public links");
assert(sampleGateOwnerWorksheet.production_deploy_performed === false, "sample gate owner worksheet must not deploy production");
assert(sampleGateOwnerWorksheet.github_push_or_pr_performed === false, "sample gate owner worksheet must not push or create PR");
assert(sampleGateOwnerWorksheet.formal_post_performed === false, "sample gate owner worksheet must not formally post");
assert(sampleGateOwnerWorksheet.line_push_performed === false, "sample gate owner worksheet must not push LINE");
assert(sampleGateOwnerWorksheet.customer_data_mutation_performed === false, "sample gate owner worksheet must not mutate customer data");
assert(sampleGateOwnerWorksheet.payment_action_performed === false, "sample gate owner worksheet must not touch payments");
assert(sampleGateOwnerWorksheet.delete_action_performed === false, "sample gate owner worksheet must not delete data");
assert(sampleGateOwnerWorksheetMd.includes("Sample Gate Owner Worksheet"), "sample gate owner worksheet markdown must have title");
assert(sampleGateOwnerWorksheetMd.includes("18-Row Checklist"), "sample gate owner worksheet markdown must include the row checklist");
assert(sampleGateOwnerWorksheetMd.includes("data/lp_events.jsonl write performed: no"), "sample gate owner worksheet markdown must state no event write");
assert(sampleGateOwnerFormStatus.ok === true, "sample gate owner form status must be ok");
assert(sampleGateOwnerFormStatus.mode === "sample_gate_owner_form", "sample gate owner form mode must match");
assert(["ready_local_browser_fill", "owner_filled_ledger_detected_review_before_overwrite"].includes(sampleGateOwnerFormStatus.status), "sample gate owner form status is invalid");
assert(sampleGateOwnerFormStatus.row_count === 18, "sample gate owner form must cover 18 P0 rows");
assert(sampleGateOwnerFormStatus.link_count === 6, "sample gate owner form must cover six importable links");
assert(sampleGateOwnerFormStatus.source_group_count === 2, "sample gate owner form must group landing analytics and LINE aggregate sources");
assert(sampleGateOwnerFormStatus.required_owner_fields.includes("aggregate_count"), "sample gate owner form must require aggregate_count");
assert(sampleGateOwnerFormStatus.required_owner_fields.includes("pii_checked"), "sample gate owner form must require pii_checked");
assert(sampleGateOwnerFormStatus.download_filename === "sample_gate_ledger.filled.csv", "sample gate owner form must export the filled ledger filename");
assert(sampleGateOwnerFormStatus.browser_only === true, "sample gate owner form must be browser-only");
assert(sampleGateOwnerFormStatus.browser_persistence === false, "sample gate owner form must not persist browser data");
assert(sampleGateOwnerFormStatus.form_action === "none", "sample gate owner form status must declare no form action");
assert(sampleGateOwnerFormStatus.network_calls_performed === false, "sample gate owner form must not perform network calls");
assert(sampleGateOwnerFormStatus.live_input_files_created === false, "sample gate owner form must not create live input files");
assert(sampleGateOwnerFormStatus.real_events_unchanged === true, "sample gate owner form must leave real events unchanged");
assert(sampleGateOwnerFormStatus.data_lp_events_write_performed === false, "sample gate owner form must not write data/lp_events.jsonl");
assert(sampleGateOwnerFormStatus.external_effect === false, "sample gate owner form must not claim external effects");
assert(sampleGateOwnerFormStatus.public_link_change_performed === false, "sample gate owner form must not change public links");
assert(sampleGateOwnerFormStatus.production_deploy_performed === false, "sample gate owner form must not deploy production");
assert(sampleGateOwnerFormStatus.github_push_or_pr_performed === false, "sample gate owner form must not push or create PR");
assert(sampleGateOwnerFormStatus.formal_post_performed === false, "sample gate owner form must not formally post");
assert(sampleGateOwnerFormStatus.line_push_performed === false, "sample gate owner form must not push LINE");
assert(sampleGateOwnerFormStatus.customer_data_mutation_performed === false, "sample gate owner form must not mutate customer data");
assert(sampleGateOwnerFormStatus.payment_action_performed === false, "sample gate owner form must not touch payments");
assert(sampleGateOwnerFormStatus.delete_action_performed === false, "sample gate owner form must not delete data");
assert(sampleGateOwnerFormHtml.includes("3Q Growth Loop Sample Gate Owner Form"), "sample gate owner form HTML must have title");
assert(sampleGateOwnerFormHtml.includes('data-external-effect="false"'), "sample gate owner form must mark no external effect");
assert(sampleGateOwnerFormHtml.includes('data-network="none"'), "sample gate owner form must mark no network");
assert(sampleGateOwnerFormHtml.includes("sample_gate_ledger.filled.csv"), "sample gate owner form must mention filled ledger download");
assert(sampleGateOwnerFormHtml.includes("<form id=\"ownerForm\""), "sample gate owner form must include the local owner form");
assert(sampleGateOwnerFormHtml.includes("Download CSV"), "sample gate owner form must include CSV download control");
assert(!/\bfetch\s*\(/.test(sampleGateOwnerFormHtml), "sample gate owner form must not call fetch");
assert(!/sendBeacon|XMLHttpRequest/i.test(sampleGateOwnerFormHtml), "sample gate owner form must not send beacons or XHR");
assert(!/localStorage|sessionStorage|indexedDB/i.test(sampleGateOwnerFormHtml), "sample gate owner form must not persist browser data");
assert(!/href=["']https?:\/\//i.test(sampleGateOwnerFormHtml), "sample gate owner form must not link to external URLs");
assert(sampleGateOwnerFormFixture.ok === true, "sample gate owner form fixture status must be ok");
assert(sampleGateOwnerFormFixture.mode === "sample_gate_owner_form_fixture_dry_run", "sample gate owner form fixture mode must match");
assert(sampleGateOwnerFormFixture.scenario_count === 3, "sample gate owner form fixtures must cover three scenarios");
assert(sampleGateOwnerFormFixture.template_rows === 18, "sample gate owner form fixtures must replay 18 template rows");
assert(sampleGateOwnerFormFixture.form_download_filename === "sample_gate_ledger.filled.csv", "sample gate owner form fixtures must replay the browser download filename");
assert(sampleGateOwnerFormFixture.local_fixture_commands_executed === true, "sample gate owner form fixtures must execute local fixture commands");
assert(sampleGateOwnerFormFixture.form_export_replay_executed === true, "sample gate owner form fixtures must replay browser form export");
assert(sampleGateOwnerFormFixture.source_capture_compile_commands_executed === true, "sample gate owner form fixtures must run source compile commands");
assert(sampleGateOwnerFormFixture.owner_sample_gate_commands_executed === true, "sample gate owner form fixtures must run owner sample gate commands");
assert(sampleGateOwnerFormFixture.real_events_unchanged === true, "sample gate owner form fixtures must leave real events unchanged");
assert(sampleGateOwnerFormFixture.live_input_files_created === false, "sample gate owner form fixtures must not create live input files");
assert(sampleGateOwnerFormFixture.real_event_write_performed === false, "sample gate owner form fixtures must not write real events");
assert(sampleGateOwnerFormFixture.data_lp_events_write_performed === false, "sample gate owner form fixtures must not write data/lp_events.jsonl");
assert(sampleGateOwnerFormFixture.external_effect === false, "sample gate owner form fixtures must not claim external effects");
assert(sampleGateOwnerFormFixture.public_link_change_performed === false, "sample gate owner form fixtures must not change public links");
assert(sampleGateOwnerFormFixture.production_deploy_performed === false, "sample gate owner form fixtures must not deploy production");
assert(sampleGateOwnerFormFixture.github_push_or_pr_performed === false, "sample gate owner form fixtures must not push or create PR");
assert(sampleGateOwnerFormFixture.formal_post_performed === false, "sample gate owner form fixtures must not formally post");
assert(sampleGateOwnerFormFixture.line_push_performed === false, "sample gate owner form fixtures must not push LINE");
assert(sampleGateOwnerFormFixture.customer_data_mutation_performed === false, "sample gate owner form fixtures must not mutate customer data");
assert(sampleGateOwnerFormFixture.payment_action_performed === false, "sample gate owner form fixtures must not touch payments");
assert(sampleGateOwnerFormFixture.delete_action_performed === false, "sample gate owner form fixtures must not delete data");
for (const expectedScenario of [
  "form_export_sample_insufficient_keeps_collecting",
  "form_export_ready_queues_owner_review",
  "form_export_sensitive_evidence_blocked",
]) {
  assert(sampleGateOwnerFormFixture.scenarios.some((scenario) => scenario.id === expectedScenario && scenario.ok === true), `sample gate owner form fixture missing ${expectedScenario}`);
}
assert(sampleGateOwnerFormFixture.scenarios.find((scenario) => scenario.id === "form_export_sample_insufficient_keeps_collecting")?.owner_status === "sample_insufficient_keep_champion", "sample gate owner form fixture must keep champion when sample is insufficient");
assert(sampleGateOwnerFormFixture.scenarios.find((scenario) => scenario.id === "form_export_ready_queues_owner_review")?.owner_status === "sample_rate_win_needs_quality_review", "sample gate owner form fixture must queue quality review for sample-rate win");
assert(sampleGateOwnerFormFixture.scenarios.find((scenario) => scenario.id === "form_export_ready_queues_owner_review")?.owner_review_required === true, "sample-rate win form fixture must require owner review");
assert(sampleGateOwnerFormFixture.scenarios.find((scenario) => scenario.id === "form_export_sensitive_evidence_blocked")?.owner_status === "blocked_invalid_owner_sample_gate", "sensitive evidence form fixture must block owner sample gate");
assert(sampleGateOwnerFormFixture.scenarios.find((scenario) => scenario.id === "form_export_sensitive_evidence_blocked")?.compile_status === "blocked_invalid_filled_ledger", "sensitive evidence form fixture must block source compile");
assert(sampleGateOwnerFormFixture.scenarios.every((scenario) => scenario.quality_guard_status === "not_evaluated_from_sample_gate"), "sample gate owner form fixtures must keep quality guard unevaluated");
assert(sampleGateOwnerFormFixture.scenarios.every((scenario) => scenario.challenger_win_rule_met === false), "sample gate owner form fixtures must not mark final win rule met");
assert(sampleGateOwnerFormFixture.scenarios.every((scenario) => scenario.promotion_performed === false), "sample gate owner form fixtures must not promote");
assert(sampleGateOwnerFormFixture.scenarios.every((scenario) => scenario.data_lp_events_write_performed === false), "sample gate owner form fixture scenarios must not write real events");
assert(sampleGateOwnerFormFixture.scenarios.every((scenario) => scenario.external_effect === false), "sample gate owner form fixture scenarios must not claim external effects");
assert(sampleGateOwnerFormFixtureReport.includes("Sample Gate Owner Form Fixture Report"), "sample gate owner form fixture report must have title");
assert(sampleGateOwnerFormFixtureReport.includes("form_export_ready_queues_owner_review"), "sample gate owner form fixture report must include owner review scenario");
assert(sampleGateOwnerFormFixtureReport.includes("form_export_sensitive_evidence_blocked"), "sample gate owner form fixture report must include sensitive evidence scenario");
assert(sampleGateOwnerFormFixtureReport.includes("Promotion performed: no"), "sample gate owner form fixture report must state no promotion");
assert(ownerSampleGateIntake.ok === true, "owner sample-gate intake status must be ok");
assert(ownerSampleGateIntake.mode === "owner_sample_gate_intake", "owner sample-gate intake mode must match");
assert([
  "waiting_for_owner_download",
  "owner_download_ready_for_review",
  "blocked_invalid_owner_download",
  "owner_download_ready_needs_confirmed_stage",
  "owner_download_staged_for_sample_gate",
].includes(ownerSampleGateIntake.status), "owner sample-gate intake status is invalid");
assert(ownerSampleGateIntake.stage_requested === false, "weekly owner sample-gate intake must not request staging");
assert(ownerSampleGateIntake.stage_performed === false, "weekly owner sample-gate intake must not stage files automatically");
assert(ownerSampleGateIntake.live_input_files_created === false, "weekly owner sample-gate intake must not create live input files");
assert(ownerSampleGateIntake.real_events_unchanged === true, "owner sample-gate intake must leave real events unchanged");
assert(ownerSampleGateIntake.data_lp_events_write_performed === false, "owner sample-gate intake must not write data/lp_events.jsonl");
assert(ownerSampleGateIntake.external_effect === false, "owner sample-gate intake must not claim external effects");
assert(ownerSampleGateIntake.public_link_change_performed === false, "owner sample-gate intake must not change public links");
assert(ownerSampleGateIntake.production_deploy_performed === false, "owner sample-gate intake must not deploy production");
assert(ownerSampleGateIntake.github_push_or_pr_performed === false, "owner sample-gate intake must not push or create PR");
assert(ownerSampleGateIntake.formal_post_performed === false, "owner sample-gate intake must not formally post");
assert(ownerSampleGateIntake.line_push_performed === false, "owner sample-gate intake must not push LINE");
assert(ownerSampleGateIntake.customer_data_mutation_performed === false, "owner sample-gate intake must not mutate customer data");
assert(ownerSampleGateIntake.payment_action_performed === false, "owner sample-gate intake must not touch payments");
assert(ownerSampleGateIntake.delete_action_performed === false, "owner sample-gate intake must not delete data");
assert(ownerSampleGateIntakeReport.includes("Owner Sample Gate Intake"), "owner sample-gate intake report must have title");
assert(ownerSampleGateIntakeReport.includes("External effect: no"), "owner sample-gate intake report must state no external effect");
assert(ownerSampleGateIntakeFixture.ok === true, "owner sample-gate intake fixtures must be ok");
assert(ownerSampleGateIntakeFixture.mode === "owner_sample_gate_intake_fixture_dry_run", "owner sample-gate intake fixture mode must match");
assert(ownerSampleGateIntakeFixture.scenario_count === 5, "owner sample-gate intake fixtures must cover five scenarios");
for (const expectedScenario of [
  "no_download_waits_safely",
  "valid_download_ready_for_review",
  "sensitive_download_blocks_stage",
  "stage_requires_owner_confirm",
  "confirmed_stage_uses_temp_target_only",
]) {
  assert(ownerSampleGateIntakeFixture.scenarios.some((scenario) => scenario.id === expectedScenario && scenario.ok === true), `owner sample-gate intake fixture missing ${expectedScenario}`);
}
assert(ownerSampleGateIntakeFixture.scenarios.find((scenario) => scenario.id === "valid_download_ready_for_review")?.status === "owner_download_ready_for_review", "owner sample-gate intake fixture must detect valid download");
assert(ownerSampleGateIntakeFixture.scenarios.find((scenario) => scenario.id === "sensitive_download_blocks_stage")?.status === "blocked_invalid_owner_download", "owner sample-gate intake fixture must block sensitive download");
assert(ownerSampleGateIntakeFixture.scenarios.find((scenario) => scenario.id === "stage_requires_owner_confirm")?.stage_performed === false, "owner sample-gate intake fixture must require confirmation before stage");
assert(ownerSampleGateIntakeFixture.scenarios.find((scenario) => scenario.id === "confirmed_stage_uses_temp_target_only")?.stage_performed === true, "owner sample-gate intake fixture must cover confirmed temp stage");
assert(ownerSampleGateIntakeFixture.owner_sample_gate_intake_commands_executed === true, "owner sample-gate intake fixtures must run intake commands");
assert(ownerSampleGateIntakeFixture.source_capture_compile_commands_executed === true, "owner sample-gate intake fixtures must run source compile commands");
assert(ownerSampleGateIntakeFixture.owner_sample_gate_commands_executed === true, "owner sample-gate intake fixtures must run owner sample-gate commands");
assert(ownerSampleGateIntakeFixture.real_events_unchanged === true, "owner sample-gate intake fixtures must leave real events unchanged");
assert(ownerSampleGateIntakeFixture.data_lp_events_write_performed === false, "owner sample-gate intake fixtures must not write data/lp_events.jsonl");
assert(ownerSampleGateIntakeFixture.external_effect === false, "owner sample-gate intake fixtures must not claim external effects");
assert(ownerSampleGateIntakeFixture.public_link_change_performed === false, "owner sample-gate intake fixtures must not change public links");
assert(ownerSampleGateIntakeFixture.production_deploy_performed === false, "owner sample-gate intake fixtures must not deploy production");
assert(ownerSampleGateIntakeFixture.github_push_or_pr_performed === false, "owner sample-gate intake fixtures must not push or create PR");
assert(ownerSampleGateIntakeFixture.formal_post_performed === false, "owner sample-gate intake fixtures must not formally post");
assert(ownerSampleGateIntakeFixture.line_push_performed === false, "owner sample-gate intake fixtures must not push LINE");
assert(ownerSampleGateIntakeFixture.customer_data_mutation_performed === false, "owner sample-gate intake fixtures must not mutate customer data");
assert(ownerSampleGateIntakeFixture.payment_action_performed === false, "owner sample-gate intake fixtures must not touch payments");
assert(ownerSampleGateIntakeFixture.delete_action_performed === false, "owner sample-gate intake fixtures must not delete data");
assert(ownerSampleGateIntakeFixtureReport.includes("Owner Sample Gate Intake Fixture Report"), "owner sample-gate intake fixture report must have title");
assert(ownerSampleGateIntakeFixtureReport.includes("sensitive_download_blocks_stage"), "owner sample-gate intake fixture report must include sensitive block scenario");
assert(ownerNextAction.ok === true, "owner next-action card must be ok");
assert(ownerNextAction.mode === "owner_next_action_card", "owner next-action card mode must match");
assert(ownerNextActionStatus.ok === true, "owner next-action compact status must be ok");
assert(ownerNextActionStatus.mode === "owner_next_action_card", "owner next-action compact mode must match");
assert(ownerNextActionStatus.status === ownerNextAction.status, "owner next-action compact status must match full JSON");
assert(ownerNextAction.primary_action.id === ownerNextActionStatus.primary_action_id, "owner next-action compact primary action must match full JSON");
assert(Array.isArray(ownerNextAction.next_actions) && ownerNextAction.next_actions.length === 3, "owner next-action must expose exactly three next actions");
assert(ownerNextAction.next_actions.every((item) => item.external_effect === false), "owner next-action items must have no external effect");
assert(ownerNextAction.sample_threshold_met === ownerSampleGateStatus.sample_threshold_met, "owner next-action sample threshold must match owner sample gate");
assert(ownerNextAction.sample_rate_win_candidate === ownerSampleGateStatus.sample_rate_win_candidate, "owner next-action sample-rate candidate must match owner sample gate");
assert(northStarOutcomePreflightSource.includes("north_star_outcome_preflight_local_only"), "North Star outcome preflight source must stay local-only");
assert(northStarOutcomePreflightSource.includes("source_capture_ledger.filled.csv"), "North Star outcome preflight source must inspect owner-filled source capture ledger");
assert(northStarOutcomePreflight.ok === true, "North Star outcome preflight must be ok while waiting or ready");
assert(northStarOutcomePreflight.mode === "north_star_outcome_preflight_local_only", "North Star outcome preflight mode must match");
assert(northStarOutcomePreflight.expected_outcome_row_count === dataCollectionProgressStatus.p1_task_count, "North Star outcome preflight expected rows must match P1 progress task count");
assert(northStarOutcomePreflight.ledger_row_count >= northStarOutcomePreflight.expected_outcome_row_count, "North Star outcome preflight must inspect enough ledger rows");
assert(northStarOutcomePreflight.filled_outcome_row_count + northStarOutcomePreflight.pending_outcome_row_count + northStarOutcomePreflight.partial_outcome_row_count >= northStarOutcomePreflight.expected_outcome_row_count, "North Star outcome preflight row states must cover expected rows");
assert(northStarOutcomePreflight.issue_count === 0, "North Star outcome preflight must not have blocking issues in current project state");
assert(northStarOutcomePreflight.ready_for_source_compile === (northStarOutcomePreflight.status === "ready_for_outcome_source_compile"), "North Star outcome preflight compile flag must match status");
assert(Array.isArray(northStarOutcomePreflight.p1_event_types) && northStarOutcomePreflight.p1_event_types.includes("lead_submit") && northStarOutcomePreflight.p1_event_types.includes("deal"), "North Star outcome preflight must cover lead and deal outcomes");
assert(northStarOutcomePreflight.recommended_commands.includes("npm run north-star:outcome-preflight") || northStarOutcomePreflight.recommended_commands.some((command) => command.includes("source:compile")), "North Star outcome preflight must expose a safe next command");
assertNoRedLineFlags(northStarOutcomePreflight, "North Star outcome preflight");
assert(northStarOutcomePreflightStatus.mode === "north_star_outcome_preflight_local_only", "North Star outcome preflight compact mode must match");
assert(northStarOutcomePreflightStatus.status === northStarOutcomePreflight.status, "North Star outcome preflight compact status must match full JSON");
assert(northStarOutcomePreflightStatus.expected_outcome_row_count === northStarOutcomePreflight.expected_outcome_row_count, "North Star outcome preflight compact row count must match full JSON");
assert(northStarOutcomePreflightStatus.filled_outcome_row_count === northStarOutcomePreflight.filled_outcome_row_count, "North Star outcome preflight compact filled count must match full JSON");
assert(northStarOutcomePreflightStatus.pending_outcome_row_count === northStarOutcomePreflight.pending_outcome_row_count, "North Star outcome preflight compact pending count must match full JSON");
assertNoRedLineFlags(northStarOutcomePreflightStatus, "North Star outcome preflight compact status");
assert(northStarOutcomePreflightReport.includes("North Star Outcome Preflight"), "North Star outcome preflight report must have title");
assert(northStarOutcomePreflightReport.includes("lead_submit"), "North Star outcome preflight report must include lead_submit");
assert(northStarOutcomePreflightReport.includes("deal"), "North Star outcome preflight report must include deal");
assert(northStarOutcomePreflightReport.includes("data/lp_events.jsonl write performed: no"), "North Star outcome preflight report must state no event write");
assert(northStarOutcomePreflightReport.includes("GitHub push / PR performed: no"), "North Star outcome preflight report must state no GitHub action");
assert(northStarOutcomeFormSource.includes("north_star_outcome_form_local_browser_only"), "North Star outcome form source must declare local browser-only mode");
assert(northStarOutcomeFormSource.includes("source_capture_ledger.fill-template.csv"), "North Star outcome form source must read source capture fill template");
assert(northStarOutcomeFormSource.includes("source_capture_ledger.filled.csv"), "North Star outcome form source must export owner-filled source capture ledger");
assert(northStarOutcomeFormFixturesSource.includes("north_star_outcome_form_fixture_static_guard"), "North Star outcome form fixture source must declare static guard mode");
assert(northStarOutcomeFormStatus.ok === true, "North Star outcome form status must be ok");
assert(northStarOutcomeFormStatus.mode === "north_star_outcome_form_local_browser_only", "North Star outcome form mode must match");
assert(["ready_local_browser_fill", "owner_filled_source_capture_detected_review_before_overwrite"].includes(northStarOutcomeFormStatus.status), "North Star outcome form status is invalid");
assert(northStarOutcomeFormStatus.row_count === northStarOutcomePreflightStatus.expected_outcome_row_count, "North Star outcome form rows must match P1 expected outcome rows");
assert(northStarOutcomeFormStatus.row_count === dataCollectionProgressStatus.p1_task_count, "North Star outcome form row count must match P1 task count");
assert(Array.isArray(northStarOutcomeFormStatus.event_types) && ["link_click", "lead_submit", "deal", "quality_flag"].every((eventType) => northStarOutcomeFormStatus.event_types.includes(eventType)), "North Star outcome form must cover all P1 outcome event types");
assert(northStarOutcomeFormStatus.required_owner_fields.includes("aggregate_count"), "North Star outcome form must require aggregate_count");
assert(northStarOutcomeFormStatus.required_owner_fields.includes("pii_checked"), "North Star outcome form must require pii_checked");
assert(northStarOutcomeFormStatus.download_filename === "source_capture_ledger.filled.csv", "North Star outcome form must export source capture filled ledger filename");
assert(northStarOutcomeFormStatus.output_filename === "source_capture_ledger.filled.csv", "North Star outcome form output filename must match filled ledger");
assert(northStarOutcomeFormStatus.browser_only === true, "North Star outcome form must be browser-only");
assert(northStarOutcomeFormStatus.browser_persistence === false, "North Star outcome form must not persist browser data");
assert(northStarOutcomeFormStatus.form_action === "none", "North Star outcome form status must declare no form action");
assert(northStarOutcomeFormStatus.network_calls_performed === false, "North Star outcome form must not perform network calls");
assert(northStarOutcomeFormStatus.live_input_files_created === false, "North Star outcome form must not create live input files");
assert(northStarOutcomeFormStatus.real_events_unchanged === true, "North Star outcome form must leave real events unchanged");
assert(northStarOutcomeFormStatus.data_lp_events_write_performed === false, "North Star outcome form must not write data/lp_events.jsonl");
assertNoRedLineFlags(northStarOutcomeFormStatus, "North Star outcome form");
assert(northStarOutcomeFormHtml.includes("3Q Growth Loop North Star Outcome Form"), "North Star outcome form HTML must have title");
assert(northStarOutcomeFormHtml.includes('data-external-effect="false"'), "North Star outcome form must mark no external effect");
assert(northStarOutcomeFormHtml.includes('data-network="none"'), "North Star outcome form must mark no network");
assert(northStarOutcomeFormHtml.includes("source_capture_ledger.filled.csv"), "North Star outcome form must mention filled ledger download");
assert(northStarOutcomeFormHtml.includes('<form id="ownerForm" novalidate>'), "North Star outcome form must include the local owner form with no action");
assert(!/<form[^>]*\saction=/i.test(northStarOutcomeFormHtml), "North Star outcome form must not include a form action");
assert(northStarOutcomeFormHtml.includes("Download CSV"), "North Star outcome form must include CSV download control");
assert(!/\bfetch\s*\(/.test(northStarOutcomeFormHtml), "North Star outcome form must not call fetch");
assert(!/sendBeacon|XMLHttpRequest/i.test(northStarOutcomeFormHtml), "North Star outcome form must not send beacons or XHR");
assert(!/localStorage|sessionStorage|indexedDB/i.test(northStarOutcomeFormHtml), "North Star outcome form must not persist browser data");
assert(!/href=["']https?:\/\//i.test(northStarOutcomeFormHtml), "North Star outcome form must not link to external URLs");
assert(northStarOutcomeFormFixture.ok === true, "North Star outcome form fixture status must be ok");
assert(northStarOutcomeFormFixture.mode === "north_star_outcome_form_fixture_static_guard", "North Star outcome form fixture mode must match");
assert(northStarOutcomeFormFixture.row_count === northStarOutcomeFormStatus.row_count, "North Star outcome form fixture rows must match form rows");
assert(northStarOutcomeFormFixture.form_download_filename === "source_capture_ledger.filled.csv", "North Star outcome form fixture must guard the browser download filename");
assert(northStarOutcomeFormFixture.check_count >= 20, "North Star outcome form fixture must run static guard checks");
assert(northStarOutcomeFormFixture.browser_form_static_checks_executed === true, "North Star outcome form fixture must execute browser static checks");
assert(northStarOutcomeFormFixture.form_export_replay_executed === false, "North Star outcome form fixture must not replay export into live inputs");
assert(northStarOutcomeFormFixture.source_capture_compile_commands_executed === false, "North Star outcome form fixture must not run source compile commands");
assert(northStarOutcomeFormFixture.real_events_unchanged === true, "North Star outcome form fixture must leave real events unchanged");
assert(northStarOutcomeFormFixture.live_input_files_created === false, "North Star outcome form fixture must not create live input files");
assert(northStarOutcomeFormFixture.data_lp_events_write_performed === false, "North Star outcome form fixture must not write data/lp_events.jsonl");
assertNoRedLineFlags(northStarOutcomeFormFixture, "North Star outcome form fixture");
assert(northStarOutcomeFormFixture.checks.every((check) => check.ok === true), "North Star outcome form fixture checks must all pass");
for (const expectedCheck of ["html_no_fetch", "html_no_xhr", "html_no_persistence", "html_no_external_links", "html_no_form_action", "quality_score_guard"]) {
  assert(northStarOutcomeFormFixture.checks.some((check) => check.name === expectedCheck && check.ok === true), `North Star outcome form fixture missing ${expectedCheck}`);
}
assert(northStarOutcomeFormFixtureReport.includes("North Star Outcome Form Fixture Report"), "North Star outcome form fixture report must have title");
assert(northStarOutcomeFormFixtureReport.includes("data/lp_events.jsonl write performed: no"), "North Star outcome form fixture report must state no event write");
assert(northStarOutcomeFormFixtureReport.includes("GitHub push / PR performed: no"), "North Star outcome form fixture report must state no GitHub action");
assert(ownerP1OutcomeIntakeSource.includes("owner_p1_outcome_intake"), "P1 outcome intake source must declare intake mode");
assert(ownerP1OutcomeIntakeSource.includes("source_capture_ledger.filled.csv"), "P1 outcome intake must detect source capture filled ledger downloads");
assert(ownerP1OutcomeIntakeSource.includes("--stage"), "P1 outcome intake must keep staging behind an explicit flag");
assert(ownerP1OutcomeIntakeSource.includes("--confirm-owner-reviewed"), "P1 outcome intake must require owner review before staging");
assert(ownerP1OutcomeIntakeSource.includes("north-star-outcome-preflight.mjs"), "P1 outcome intake must validate with North Star outcome preflight");
assert(ownerP1OutcomeIntakeSource.includes("source-capture-compile.mjs"), "P1 outcome intake must validate with source capture compile");
assert(ownerP1OutcomeIntake.ok === true, "P1 outcome intake must be ok while waiting or review-ready");
assert(ownerP1OutcomeIntake.mode === "owner_p1_outcome_intake", "P1 outcome intake mode must match");
assert(ownerP1OutcomeIntakeStatus.mode === ownerP1OutcomeIntake.mode, "P1 outcome intake compact mode must match full JSON");
assert(ownerP1OutcomeIntakeStatus.status === ownerP1OutcomeIntake.status, "P1 outcome intake compact status must match full JSON");
assert(ownerP1OutcomeIntakeStatus.candidate_found === ownerP1OutcomeIntake.candidate_found, "P1 outcome intake compact candidate flag must match full JSON");
assert(ownerP1OutcomeIntakeStatus.candidate_valid === ownerP1OutcomeIntake.candidate_valid, "P1 outcome intake compact valid flag must match full JSON");
assert(ownerP1OutcomeIntakeStatus.stage_performed === ownerP1OutcomeIntake.stage_performed, "P1 outcome intake compact stage flag must match full JSON");
assert(ownerP1OutcomeIntakeStatus.stage_performed === false, "weekly P1 outcome intake must not stage owner downloads");
assert(ownerP1OutcomeIntakeStatus.expected_outcome_row_count === northStarOutcomePreflightStatus.expected_outcome_row_count, "P1 outcome intake must expose expected outcome row count");
assert(ownerP1OutcomeIntakeStatus.filled_outcome_row_count === ownerP1OutcomeIntake.filled_outcome_row_count, "P1 outcome intake compact filled rows must match full JSON");
assert(ownerP1OutcomeIntakeStatus.pending_outcome_row_count === ownerP1OutcomeIntake.pending_outcome_row_count, "P1 outcome intake compact pending rows must match full JSON");
assert(ownerP1OutcomeIntakeStatus.preflight_ready_for_source_compile === ownerP1OutcomeIntake.preflight_ready_for_source_compile, "P1 outcome intake compact preflight readiness must match full JSON");
assert(ownerP1OutcomeIntakeStatus.compile_filled_rows === ownerP1OutcomeIntake.compile_filled_rows, "P1 outcome intake compact compile rows must match full JSON");
assert(ownerP1OutcomeIntakeStatus.live_input_files_created === false, "P1 outcome intake weekly status must not create live input files");
assert(ownerP1OutcomeIntakeStatus.data_lp_events_write_performed === false, "P1 outcome intake compact status must not write events");
assertNoRedLineFlags(ownerP1OutcomeIntake, "P1 outcome intake full JSON");
assertNoRedLineFlags(ownerP1OutcomeIntakeStatus, "P1 outcome intake compact status");
assert(ownerP1OutcomeIntakeReport.includes("P1 Outcome Download Intake"), "P1 outcome intake report must have title");
assert(ownerP1OutcomeIntakeReport.includes("Stage Command"), "P1 outcome intake report must show explicit stage command");
assert(ownerP1OutcomeIntakeReport.includes("data/lp_events.jsonl write performed"), "P1 outcome intake report must state event-write status");
assert(ownerP1OutcomeIntakeFixturesSource.includes("owner_p1_outcome_intake_fixtures"), "P1 outcome intake fixture source must declare fixture mode");
assert(ownerP1OutcomeIntakeFixturesSource.includes("sensitive_value_blocked"), "P1 outcome intake fixtures must cover sensitive-value blocking");
assert(ownerP1OutcomeIntakeFixture.ok === true, "P1 outcome intake fixtures must pass");
assert(ownerP1OutcomeIntakeFixture.mode === "owner_p1_outcome_intake_fixtures", "P1 outcome intake fixture mode must match");
assert(ownerP1OutcomeIntakeFixture.scenario_count >= 5, "P1 outcome intake fixtures must cover at least five scenarios");
for (const expectedScenario of ["waiting_no_candidate", "valid_review_only", "stage_requires_confirmation", "confirmed_stage_temp_target", "sensitive_value_blocked"]) {
  assert(ownerP1OutcomeIntakeFixture.scenarios.some((scenario) => scenario.name === expectedScenario && scenario.ok === true), `P1 outcome intake fixtures missing ${expectedScenario}`);
}
assertNoRedLineFlags(ownerP1OutcomeIntakeFixture, "P1 outcome intake fixture status");
assert(ownerP1OutcomeIntakeFixtureReport.includes("Owner P1 Outcome Intake Fixture Report"), "P1 outcome intake fixture report must have title");
assert(ownerP1OutcomeIntakeFixtureReport.includes("data/lp_events.jsonl write performed: no"), "P1 outcome intake fixture report must state no event write");
assert(ownerP1OutcomePostfillCheckSource.includes("owner_p1_outcome_postfill_check_local_only"), "P1 outcome post-fill source must declare local-only mode");
assert(ownerP1OutcomePostfillCheckSource.includes("RUN-P1-OUTCOME-POST-FILL-CHECK.command"), "P1 outcome post-fill source must generate the local command");
assert(ownerP1OutcomePostfillCheck.ok === true, "P1 outcome post-fill check must be ok while waiting or ready");
assert(ownerP1OutcomePostfillCheck.mode === "owner_p1_outcome_postfill_check_local_only", "P1 outcome post-fill mode must match");
assert(ownerP1OutcomePostfillCheckStatus.mode === ownerP1OutcomePostfillCheck.mode, "P1 outcome post-fill compact mode must match full JSON");
assert(ownerP1OutcomePostfillCheckStatus.status === ownerP1OutcomePostfillCheck.status, "P1 outcome post-fill compact status must match full JSON");
assert(ownerP1OutcomePostfillCheckStatus.current_stage === ownerP1OutcomePostfillCheck.current_stage, "P1 outcome post-fill compact stage must match full JSON");
assert(ownerP1OutcomePostfillCheckStatus.safe_command_count === ownerP1OutcomePostfillCheck.safe_command_count, "P1 outcome post-fill compact command count must match full JSON");
assert(ownerP1OutcomePostfillCheck.p1_outcome_filled_row_count === northStarOutcomePreflightStatus.filled_outcome_row_count, "P1 outcome post-fill must expose P1 filled row count");
assert(ownerP1OutcomePostfillCheck.p1_outcome_pending_row_count === northStarOutcomePreflightStatus.pending_outcome_row_count, "P1 outcome post-fill must expose P1 pending row count");
assert(ownerP1OutcomePostfillCheck.p1_outcome_ready_for_source_compile === northStarOutcomePreflightStatus.ready_for_source_compile, "P1 outcome post-fill must expose source compile readiness");
assert(ownerP1OutcomePostfillCheck.outcome_form_guard_ok === northStarOutcomeFormFixture.ok, "P1 outcome post-fill must expose outcome form guard status");
assert(ownerP1OutcomePostfillCheck.source_trust_status === sourceTrustMatrixStatus.status, "P1 outcome post-fill must expose source trust status");
assert(ownerP1OutcomePostfillCheck.source_trust_trusted_scoring_source_count === sourceTrustMatrixStatus.trusted_scoring_source_count, "P1 outcome post-fill must expose trusted source count");
assert(ownerP1OutcomePostfillCheck.source_trust_scoring_allowed_now === sourceTrustMatrixStatus.scoring_allowed_now, "P1 outcome post-fill must expose scoring permission");
assert(ownerP1OutcomePostfillCheck.safe_commands.every((command) => command.external_effect === false), "P1 outcome post-fill safe commands must be local-only metadata");
assert(ownerP1OutcomePostfillCheck.safe_command_scripts.includes("north-star:outcome-preflight"), "P1 outcome post-fill must run outcome preflight");
assert(ownerP1OutcomePostfillCheck.safe_command_scripts.includes("source:compile"), "P1 outcome post-fill must run source compile preview");
assert(ownerP1OutcomePostfillCheck.safe_command_scripts.includes("source:trust"), "P1 outcome post-fill must refresh source trust");
assert(ownerP1OutcomePostfillCheck.command_runs_local_scripts_only === true, "P1 outcome post-fill command policy must be local-only");
assert(ownerP1OutcomePostfillCheck.command_has_external_url === false, "P1 outcome post-fill command must not include external URLs");
assert(ownerP1OutcomePostfillCheck.command_has_forbidden_remote_cli === false, "P1 outcome post-fill command must not include remote CLI");
assert(ownerP1OutcomePostfillCheck.command_has_forbidden_git_cli === false, "P1 outcome post-fill command must not include git/gh");
assert(ownerP1OutcomePostfillCheck.command_has_apply_or_stage_flags === false, "P1 outcome post-fill command must not include apply or stage flags");
assertNoRedLineFlags(ownerP1OutcomePostfillCheck, "P1 outcome post-fill full JSON");
assertNoRedLineFlags(ownerP1OutcomePostfillCheckStatus, "P1 outcome post-fill compact status");
assert(ownerP1OutcomePostfillCheckReport.includes("P1 Outcome Post-Fill Local Check"), "P1 outcome post-fill report must have title");
assert(ownerP1OutcomePostfillCheckReport.includes("Safe Command Sequence"), "P1 outcome post-fill report must list safe commands");
assert(ownerP1OutcomePostfillCheckReport.includes("data/lp_events.jsonl write performed: no"), "P1 outcome post-fill report must state no event write");
assert(ownerP1OutcomePostfillCheckReport.includes("GitHub push / PR: no"), "P1 outcome post-fill report must state no GitHub action");
assert(ownerP1OutcomePostfillCheckCommand.startsWith("#!/bin/zsh"), "P1 outcome post-fill command must be zsh executable");
assert(ownerP1OutcomePostfillCheckCommand.includes("npm run north-star:outcome-preflight"), "P1 outcome post-fill command must run outcome preflight");
assert(ownerP1OutcomePostfillCheckCommand.includes("npm run source:compile"), "P1 outcome post-fill command must run source compile preview");
assert(ownerP1OutcomePostfillCheckCommand.includes("npm run source:trust"), "P1 outcome post-fill command must refresh source trust");
assert(!/https?:\/\//.test(ownerP1OutcomePostfillCheckCommand), "P1 outcome post-fill command must not include external URLs");
assert(!/\b(wrangler|git|gh|curl|wget)\b/.test(ownerP1OutcomePostfillCheckCommand), "P1 outcome post-fill command must not run remote, deploy, GitHub, or download commands");
assert(!/--apply|--stage|--allow-remote|--remote|--append|--confirm-real-data/.test(ownerP1OutcomePostfillCheckCommand), "P1 outcome post-fill command must not include apply, stage, remote, append, or real-data confirm flags");
assert(!/rm\s+-|trash|delete|launchctl|osascript/i.test(ownerP1OutcomePostfillCheckCommand), "P1 outcome post-fill command must not delete, alter launchd, or automate UI");
assert(ownerNextAction.current_gate.owner_sample_gate_status === ownerSampleGateStatus.status, "owner next-action must read current owner sample-gate status");
assert(ownerNextAction.current_gate.data_collection_progress_status === dataCollectionProgressStatus.status, "owner next-action must read data collection progress status");
assert(ownerNextAction.current_gate.data_collection_p0_pending_count === dataCollectionProgressStatus.p0_pending_count, "owner next-action must read data collection P0 pending count");
assert(ownerNextAction.current_gate.next_p0_owner_inputs_status === nextP0OwnerInputsStatus.status, "owner next-action must read next P0 owner input status");
assert(ownerNextAction.current_gate.next_p0_owner_input_count === nextP0OwnerInputsStatus.current_input_count, "owner next-action must read next P0 owner input count");
assert(ownerNextAction.current_gate.next_p0_owner_form_status === nextP0OwnerFormStatus.status, "owner next-action must read next P0 owner form status");
assert(ownerNextAction.current_gate.next_p0_owner_form_row_count === nextP0OwnerFormStatus.row_count, "owner next-action must read next P0 owner form row count");
assert(ownerNextAction.current_gate.next_p0_quick_capture_status === nextP0QuickCapture.status, "owner next-action must read next P0 quick capture status");
assert(ownerNextAction.current_gate.next_p0_quick_capture_expected_row_count === nextP0QuickCapture.expected_row_count, "owner next-action must read next P0 quick capture expected row count");
assert(ownerNextAction.current_gate.next_p0_quick_capture_quick_count_count === nextP0QuickCapture.quick_count_count, "owner next-action must read next P0 quick count count");
assert(ownerNextAction.current_gate.next_p0_quick_capture_filled_rank_count === nextP0QuickCapture.filled_rank_count, "owner next-action must read next P0 quick filled rank count");
assert(Array.isArray(ownerNextAction.current_gate.next_p0_quick_capture_filled_ranks), "owner next-action must expose next P0 quick filled ranks");
assert(ownerNextAction.current_gate.next_p0_quick_capture_missing_rank_count === nextP0QuickCapture.missing_rank_count, "owner next-action must read next P0 quick missing rank count");
assert(Array.isArray(ownerNextAction.current_gate.next_p0_quick_capture_missing_ranks), "owner next-action must expose next P0 quick missing ranks");
assert(ownerNextAction.current_gate.next_p0_quick_capture_partial_waiting === nextP0QuickCapture.partial_waiting, "owner next-action must read next P0 quick partial waiting flag");
assert(ownerNextAction.current_gate.next_p0_quick_capture_partial_auto_counts === nextP0QuickCapture.partial_auto_counts, "owner next-action must read next P0 quick partial auto-count flag");
assert(ownerNextAction.current_gate.next_p0_quick_capture_template_created === nextP0QuickCapture.template_created, "owner next-action must read next P0 quick capture template state");
assert(ownerNextAction.current_gate.next_p0_quick_capture_paste_template_created === nextP0QuickCapture.paste_template_created, "owner next-action must read next P0 quick capture paste template state");
assert(ownerNextAction.current_gate.next_p0_quick_capture_paste_template_path === nextP0QuickCapture.paste_template_path, "owner next-action must read next P0 quick capture paste template path");
assert(ownerNextAction.current_gate.next_p0_quick_capture_filled_preview_created === nextP0QuickCapture.filled_preview_created, "owner next-action must read next P0 quick capture preview state");
assert(ownerNextAction.current_gate.p0_counts_preflight_status === p0CountsPreflightStatus.status, "owner next-action must read P0 counts preflight status");
assert(ownerNextAction.current_gate.p0_counts_preflight_ready_for_quick_preview === p0CountsPreflightStatus.ready_for_quick_preview, "owner next-action must read P0 counts preflight ready flag");
assert(ownerNextAction.current_gate.p0_counts_preflight_expected_count_key_count === p0CountsPreflightStatus.expected_count_key_count, "owner next-action must read P0 counts preflight expected count");
assert(ownerNextAction.current_gate.p0_counts_preflight_filled_count_key_count === p0CountsPreflightStatus.filled_count_key_count, "owner next-action must read P0 counts preflight filled count");
assert(ownerNextAction.current_gate.p0_counts_preflight_placeholder_count_key_count === p0CountsPreflightStatus.placeholder_count_key_count, "owner next-action must read P0 counts preflight placeholder count");
assert(ownerNextAction.current_gate.p0_counts_preflight_issue_count === p0CountsPreflightStatus.issue_count, "owner next-action must read P0 counts preflight issue count");
assert(ownerNextAction.current_gate.next_p0_owner_intake_status === nextP0OwnerIntake.status, "owner next-action must read next P0 owner intake status");
assert(ownerNextAction.current_gate.next_p0_owner_intake_candidate_found === nextP0OwnerIntake.candidate_found, "owner next-action must read next P0 owner intake candidate state");
assert(ownerNextAction.current_gate.next_p0_owner_intake_stage_performed === nextP0OwnerIntake.stage_performed, "owner next-action must read next P0 owner intake stage state");
assert(ownerNextAction.current_gate.sample_gate_batch_handoff_status === sampleGateBatchHandoffStatus.status, "owner next-action must read sample gate batch handoff status");
assert(ownerNextAction.current_gate.sample_gate_batch_handoff_p0_task_count === sampleGateBatchHandoffStatus.p0_task_count, "owner next-action must read sample gate batch task count");
assert(ownerNextAction.current_gate.sample_gate_batch_handoff_all_p0_row_count === sampleGateBatchHandoffStatus.all_p0_row_count, "owner next-action must read sample gate batch all-row count");
assert(ownerNextAction.current_gate.sample_gate_batch_handoff_focused_batch_row_count === sampleGateBatchHandoffStatus.focused_batch_row_count, "owner next-action must read sample gate focused batch count");
assert(ownerNextAction.current_gate.sample_gate_batch_handoff_remaining_batch_row_count === sampleGateBatchHandoffStatus.remaining_batch_row_count, "owner next-action must read sample gate remaining batch count");
assert(ownerNextAction.current_gate.sample_gate_batch_handoff_p0_pending_count === sampleGateBatchHandoffStatus.p0_pending_count, "owner next-action must read sample gate pending count");
assert(ownerNextAction.current_gate.sample_gate_batch_handoff_batch_count === sampleGateBatchHandoffStatus.batch_count, "owner next-action must read sample gate batch count");
assert(ownerNextAction.current_gate.sample_gate_batch_handoff_full_coverage_ready === sampleGateBatchHandoffStatus.full_coverage_ready, "owner next-action must read sample gate full coverage flag");
assert(ownerNextAction.current_gate.real_data_intake_status === realDataIntake.status, "owner next-action must read real-data intake status");
assert(ownerNextAction.current_gate.real_data_intake_ready_apply_count === realDataIntake.ready_apply_count, "owner next-action must read real-data intake ready apply count");
assert(ownerNextAction.current_gate.real_data_intake_missing_input_count === realDataIntake.missing_input_count, "owner next-action must read real-data intake missing input count");
assert(ownerNextAction.current_gate.real_data_intake_blocked_input_count === realDataIntake.blocked_input_count, "owner next-action must read real-data intake blocked input count");
assert(ownerNextAction.current_gate.source_trust_status === sourceTrustMatrixStatus.status, "owner next-action must read source trust status");
assert(ownerNextAction.current_gate.source_trust_trusted_scoring_source_count === sourceTrustMatrixStatus.trusted_scoring_source_count, "owner next-action must read source trust trusted source count");
assert(ownerNextAction.current_gate.source_trust_sample_gate_source_count === sourceTrustMatrixStatus.sample_gate_source_count, "owner next-action must read source trust sample-gate source count");
assert(ownerNextAction.current_gate.source_trust_scoring_allowed_now === sourceTrustMatrixStatus.scoring_allowed_now, "owner next-action must read source trust scoring flag");
assert(ownerNextAction.current_gate.source_trust_real_event_rows === sourceTrustMatrixStatus.real_event_rows, "owner next-action must read source trust real event rows");
assert(ownerNextAction.current_gate.source_trust_p0_pending_count === sourceTrustMatrixStatus.p0_pending_count, "owner next-action must read source trust P0 pending count");
assert(ownerNextAction.current_gate.source_trust_sample_threshold_met === sourceTrustMatrixStatus.sample_threshold_met, "owner next-action must read source trust sample threshold flag");
assert(ownerNextAction.current_gate.source_trust_ready_for_public_iteration_decision === sourceTrustMatrixStatus.ready_for_public_iteration_decision, "owner next-action must read source trust public iteration flag");
assert(ownerNextActionStatus.source_trust_status === sourceTrustMatrixStatus.status, "owner next-action compact status must expose source trust status");
assert(ownerNextActionStatus.source_trust_trusted_scoring_source_count === sourceTrustMatrixStatus.trusted_scoring_source_count, "owner next-action compact status must expose source trust trusted source count");
assert(ownerNextActionStatus.source_trust_sample_gate_source_count === sourceTrustMatrixStatus.sample_gate_source_count, "owner next-action compact status must expose source trust sample-gate source count");
assert(ownerNextActionStatus.source_trust_scoring_allowed_now === sourceTrustMatrixStatus.scoring_allowed_now, "owner next-action compact status must expose source trust scoring flag");
assert(ownerNextAction.current_gate.sample_gate_capture_calendar_status === sampleGateCaptureCalendar.status, "owner next-action must read sample-gate capture calendar status");
assert(ownerNextAction.current_gate.sample_gate_capture_calendar_event_count === sampleGateCaptureCalendar.events.length, "owner next-action must read sample-gate capture calendar event count");
assert(ownerNextAction.current_gate.sample_gate_capture_calendar_next_due_date === sampleGateCaptureCalendarStatus.next_due_date, "owner next-action must read capture calendar next due date");
assert(ownerNextAction.current_gate.sample_gate_capture_calendar_next_due_event_id === sampleGateCaptureCalendarStatus.next_due_event_id, "owner next-action must read capture calendar next due event");
assert(ownerNextAction.current_gate.sample_gate_due_status === sampleGateDueStatus.status, "owner next-action must read sample-gate due status");
assert(ownerNextAction.current_gate.sample_gate_due_phase === sampleGateDueStatus.due_phase, "owner next-action must read sample-gate due phase");
assert(ownerNextAction.current_gate.sample_gate_due_now === sampleGateDueStatus.due_now, "owner next-action must read sample-gate due now flag");
assert(ownerNextAction.current_gate.sample_gate_due_date === sampleGateDueStatus.due_date, "owner next-action must read sample-gate due date");
assert(ownerNextAction.current_gate.sample_gate_due_event_id === sampleGateDueStatus.due_event_id, "owner next-action must read sample-gate due event");
assert(ownerNextAction.current_gate.approval_queue_status === approvalStatus.status, "owner next-action must read approval queue compact status");
assert(ownerNextAction.current_gate.approval_queue_item_count === approvalStatus.item_count, "owner next-action must read approval queue item count");
assert(ownerNextAction.current_gate.approval_queue_ready_local_review_count === approvalStatus.ready_local_review_count, "owner next-action must read approval queue ready-local count");
assert(ownerNextAction.current_gate.approval_queue_pending_human_count === approvalStatus.pending_human_count, "owner next-action must read approval queue pending-human count");
assert(ownerNextAction.current_gate.approval_queue_completed_local_reversible_count === approvalStatus.completed_local_reversible_count, "owner next-action must read approval queue completed-local count");
assert(ownerNextAction.current_gate.approval_queue_high_risk_pending_count === approvalStatus.high_risk_pending_count, "owner next-action must read approval queue high-risk count");
assert(ownerNextAction.current_gate.approval_queue_next_ready_local_review_id === approvalStatus.next_ready_local_review_id, "owner next-action must read approval queue next local review id");
assert(ownerNextAction.current_gate.approval_queue_next_ready_local_review_artifact === approvalStatus.next_ready_local_review_artifact, "owner next-action must read approval queue next local review artifact");
assert(ownerNextAction.current_gate.approval_queue_next_pending_human_id === approvalStatus.next_pending_human_id, "owner next-action must read approval queue next human gate id");
assert(ownerNextAction.current_gate.approval_queue_next_pending_human_artifact === approvalStatus.next_pending_human_artifact, "owner next-action must read approval queue next human gate artifact");
assert(ownerNextAction.current_gate.approval_queue_policy_ok === approvalStatus.policy_ok, "owner next-action must read approval queue policy flag");
assert(ownerNextActionStatus.next_p0_owner_intake_status === nextP0OwnerIntake.status, "owner next-action compact status must expose next P0 owner intake status");
assert(ownerNextActionStatus.sample_gate_batch_handoff_status === sampleGateBatchHandoffStatus.status, "owner next-action compact status must expose sample gate batch handoff status");
assert(ownerNextActionStatus.sample_gate_batch_handoff_p0_task_count === sampleGateBatchHandoffStatus.p0_task_count, "owner next-action compact status must expose sample gate batch task count");
assert(ownerNextActionStatus.sample_gate_batch_handoff_all_p0_row_count === sampleGateBatchHandoffStatus.all_p0_row_count, "owner next-action compact status must expose sample gate batch all-row count");
assert(ownerNextActionStatus.sample_gate_batch_handoff_focused_batch_row_count === sampleGateBatchHandoffStatus.focused_batch_row_count, "owner next-action compact status must expose sample gate focused batch count");
assert(ownerNextActionStatus.sample_gate_batch_handoff_remaining_batch_row_count === sampleGateBatchHandoffStatus.remaining_batch_row_count, "owner next-action compact status must expose sample gate remaining batch count");
assert(ownerNextActionStatus.sample_gate_batch_handoff_p0_pending_count === sampleGateBatchHandoffStatus.p0_pending_count, "owner next-action compact status must expose sample gate pending count");
assert(ownerNextActionStatus.sample_gate_batch_handoff_batch_count === sampleGateBatchHandoffStatus.batch_count, "owner next-action compact status must expose sample gate batch count");
assert(ownerNextActionStatus.sample_gate_batch_handoff_full_coverage_ready === sampleGateBatchHandoffStatus.full_coverage_ready, "owner next-action compact status must expose sample gate full coverage flag");
assert(ownerNextActionStatus.next_p0_quick_capture_status === nextP0QuickCapture.status, "owner next-action compact status must expose next P0 quick capture status");
assert(ownerNextActionStatus.next_p0_quick_capture_expected_row_count === nextP0QuickCapture.expected_row_count, "owner next-action compact status must expose next P0 quick expected row count");
assert(ownerNextActionStatus.next_p0_quick_capture_quick_count_count === nextP0QuickCapture.quick_count_count, "owner next-action compact status must expose next P0 quick count count");
assert(ownerNextActionStatus.next_p0_quick_capture_filled_rank_count === nextP0QuickCapture.filled_rank_count, "owner next-action compact status must expose next P0 quick filled rank count");
assert(Array.isArray(ownerNextActionStatus.next_p0_quick_capture_filled_ranks), "owner next-action compact status must expose next P0 quick filled ranks");
assert(ownerNextActionStatus.next_p0_quick_capture_missing_rank_count === nextP0QuickCapture.missing_rank_count, "owner next-action compact status must expose next P0 quick missing rank count");
assert(Array.isArray(ownerNextActionStatus.next_p0_quick_capture_missing_ranks), "owner next-action compact status must expose next P0 quick missing ranks");
assert(ownerNextActionStatus.next_p0_quick_capture_partial_waiting === nextP0QuickCapture.partial_waiting, "owner next-action compact status must expose next P0 quick partial waiting flag");
assert(ownerNextActionStatus.next_p0_quick_capture_partial_auto_counts === nextP0QuickCapture.partial_auto_counts, "owner next-action compact status must expose next P0 quick partial auto-count flag");
assert(ownerNextActionStatus.next_p0_quick_capture_template_created === nextP0QuickCapture.template_created, "owner next-action compact status must expose next P0 quick capture template state");
assert(ownerNextActionStatus.next_p0_quick_capture_paste_template_created === nextP0QuickCapture.paste_template_created, "owner next-action compact status must expose next P0 quick capture paste template state");
assert(ownerNextActionStatus.next_p0_quick_capture_paste_template_path === nextP0QuickCapture.paste_template_path, "owner next-action compact status must expose next P0 quick capture paste template path");
assert(ownerNextActionStatus.next_p0_quick_capture_filled_preview_created === nextP0QuickCapture.filled_preview_created, "owner next-action compact status must expose next P0 quick capture preview state");
assert(ownerNextActionStatus.p0_counts_preflight_status === p0CountsPreflightStatus.status, "owner next-action compact status must expose P0 counts preflight status");
assert(ownerNextActionStatus.p0_counts_preflight_ready_for_quick_preview === p0CountsPreflightStatus.ready_for_quick_preview, "owner next-action compact status must expose P0 counts preflight ready flag");
assert(ownerNextActionStatus.p0_counts_preflight_expected_count_key_count === p0CountsPreflightStatus.expected_count_key_count, "owner next-action compact status must expose P0 counts preflight expected count");
assert(ownerNextActionStatus.p0_counts_preflight_filled_count_key_count === p0CountsPreflightStatus.filled_count_key_count, "owner next-action compact status must expose P0 counts preflight filled count");
assert(ownerNextActionStatus.p0_counts_preflight_placeholder_count_key_count === p0CountsPreflightStatus.placeholder_count_key_count, "owner next-action compact status must expose P0 counts preflight placeholder count");
assert(ownerNextActionStatus.p0_counts_preflight_issue_count === p0CountsPreflightStatus.issue_count, "owner next-action compact status must expose P0 counts preflight issue count");
assert(ownerNextActionStatus.next_p0_owner_intake_candidate_found === nextP0OwnerIntake.candidate_found, "owner next-action compact status must expose next P0 owner intake candidate state");
assert(ownerNextActionStatus.next_p0_owner_intake_stage_performed === nextP0OwnerIntake.stage_performed, "owner next-action compact status must expose next P0 owner intake stage state");
assert(ownerNextActionStatus.real_data_intake_status === realDataIntake.status, "owner next-action compact status must expose real-data intake status");
assert(ownerNextActionStatus.real_data_intake_ready_apply_count === realDataIntake.ready_apply_count, "owner next-action compact status must expose real-data intake ready apply count");
assert(ownerNextActionStatus.real_data_intake_missing_input_count === realDataIntake.missing_input_count, "owner next-action compact status must expose real-data intake missing input count");
assert(ownerNextActionStatus.real_data_intake_blocked_input_count === realDataIntake.blocked_input_count, "owner next-action compact status must expose real-data intake blocked input count");
assert(ownerNextActionStatus.sample_gate_capture_calendar_status === sampleGateCaptureCalendar.status, "owner next-action compact status must expose capture calendar status");
assert(ownerNextActionStatus.sample_gate_capture_calendar_next_due_date === sampleGateCaptureCalendarStatus.next_due_date, "owner next-action compact status must expose capture calendar due date");
assert(ownerNextActionStatus.sample_gate_capture_calendar_next_due_event_id === sampleGateCaptureCalendarStatus.next_due_event_id, "owner next-action compact status must expose capture calendar due event");
assert(ownerNextActionStatus.sample_gate_due_status === sampleGateDueStatus.status, "owner next-action compact status must expose due status");
assert(ownerNextActionStatus.sample_gate_due_phase === sampleGateDueStatus.due_phase, "owner next-action compact status must expose due phase");
assert(ownerNextActionStatus.sample_gate_due_now === sampleGateDueStatus.due_now, "owner next-action compact status must expose due now");
assert(ownerNextActionStatus.sample_gate_due_date === sampleGateDueStatus.due_date, "owner next-action compact status must expose due date");
assert(ownerNextActionStatus.sample_gate_due_event_id === sampleGateDueStatus.due_event_id, "owner next-action compact status must expose due event");
assert(ownerNextActionStatus.approval_queue_status === approvalStatus.status, "owner next-action compact status must expose approval queue status");
assert(ownerNextActionStatus.approval_queue_item_count === approvalStatus.item_count, "owner next-action compact status must expose approval queue item count");
assert(ownerNextActionStatus.approval_queue_ready_local_review_count === approvalStatus.ready_local_review_count, "owner next-action compact status must expose approval queue ready-local count");
assert(ownerNextActionStatus.approval_queue_pending_human_count === approvalStatus.pending_human_count, "owner next-action compact status must expose approval queue pending-human count");
assert(ownerNextActionStatus.approval_queue_completed_local_reversible_count === approvalStatus.completed_local_reversible_count, "owner next-action compact status must expose approval queue completed-local count");
assert(ownerNextActionStatus.approval_queue_high_risk_pending_count === approvalStatus.high_risk_pending_count, "owner next-action compact status must expose approval queue high-risk count");
assert(ownerNextActionStatus.approval_queue_next_ready_local_review_id === approvalStatus.next_ready_local_review_id, "owner next-action compact status must expose approval queue next local review");
assert(ownerNextActionStatus.approval_queue_next_pending_human_id === approvalStatus.next_pending_human_id, "owner next-action compact status must expose approval queue next human gate");
assert(ownerNextActionStatus.approval_queue_policy_ok === approvalStatus.policy_ok, "owner next-action compact status must expose approval queue policy flag");
const ownerNextPublicAbMetadata = (gateReadiness.parallel_metadata_actions ?? []).find((action) => action.gate_id === "public_ab_small_traffic_link");
assert(ownerNextAction.current_gate.gate_readiness_status === gateReadiness.status, "owner next-action must read gate readiness status");
assert(ownerNextAction.current_gate.gate_parallel_metadata_action_count === gateReadiness.parallel_metadata_action_count, "owner next-action must read gate metadata action count");
assert(ownerNextAction.current_gate.public_ab_metadata_status === ownerNextPublicAbMetadata?.status, "owner next-action must read public A/B metadata status");
assert(ownerNextAction.current_gate.public_ab_metadata_fields_needing_input.includes("champion_url"), "owner next-action must expose public A/B champion URL metadata need");
assert(ownerNextAction.current_gate.public_ab_metadata_fields_needing_input.includes("rollback_url"), "owner next-action must expose public A/B rollback URL metadata need");
assert(ownerNextAction.current_gate.public_ab_metadata_blocking_dependencies.includes("candidate_worker_production_deploy_owner_executed") === !expectedLiveIngestProven, "owner next-action must retain the Worker dependency only until Candidate/D1 evidence is validated");
assert(ownerNextActionStatus.gate_readiness_status === gateReadiness.status, "owner next-action compact status must expose gate readiness status");
assert(ownerNextActionStatus.gate_parallel_metadata_action_count === gateReadiness.parallel_metadata_action_count, "owner next-action compact status must expose gate metadata action count");
assert(ownerNextActionStatus.public_ab_metadata_status === ownerNextPublicAbMetadata?.status, "owner next-action compact status must expose public A/B metadata status");
assert(ownerNextActionStatus.public_ab_metadata_fields_needing_input.includes("champion_url"), "owner next-action compact status must expose champion URL metadata need");
assert(ownerNextActionStatus.public_ab_metadata_blocking_dependencies.includes("candidate_worker_production_deploy_owner_executed") === !expectedLiveIngestProven, "owner next-action compact status must mirror whether the public A/B Worker dependency remains unresolved");
assert(ownerNextAction.next_actions.some((item) => item.id === "prepare_public_ab_metadata"), "owner next-action must include public A/B metadata as a safe next action");
const ownerNextPublicAbAction = ownerNextAction.next_actions.find((item) => item.id === "prepare_public_ab_metadata");
assert(ownerNextPublicAbAction.command === "open owner_approval_form.html", "public A/B metadata next action must open owner approval form");
assert(ownerNextPublicAbAction.artifacts.includes("gate_readiness.md"), "public A/B metadata next action must point to gate readiness report");
assert(ownerNextPublicAbAction.artifacts.includes("data/gate_readiness_status.json"), "public A/B metadata next action must point to gate readiness status");
assert(ownerNextAction.review_artifacts.includes("data_collection_progress.md"), "owner next-action must include data collection progress report");
assert(ownerNextAction.review_artifacts.includes("real_data_intake_plan.md"), "owner next-action must include real-data intake plan");
assert(ownerNextAction.review_artifacts.includes("data/real_data_intake_status.json"), "owner next-action must include real-data intake status");
assert(ownerNextAction.review_artifacts.includes("next_p0_owner_inputs.md"), "owner next-action must include next P0 owner inputs report");
assert(ownerNextAction.review_artifacts.includes("next_p0_owner_form.html"), "owner next-action must include next P0 owner form");
assert(ownerNextAction.review_artifacts.includes("next_p0_quick_capture.md"), "owner next-action must include next P0 quick capture report");
assert(ownerNextAction.review_artifacts.includes("p0_counts_preflight.md"), "owner next-action must include P0 counts preflight report");
assert(ownerNextAction.review_artifacts.includes("p0_counts_preflight.json"), "owner next-action must include P0 counts preflight JSON");
assert(ownerNextAction.review_artifacts.includes("data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt"), "owner next-action must include next P0 paste template");
assert(ownerNextAction.review_artifacts.includes("next_p0_owner_intake.md"), "owner next-action must include next P0 owner intake report");
assert(ownerNextAction.review_artifacts.includes("sample_gate_batch_handoff.md"), "owner next-action must include sample gate batch handoff report");
assert(ownerNextAction.review_artifacts.includes("sample_gate_batch_1_paste_block.txt"), "owner next-action must include sample gate batch 1 paste block");
assert(ownerNextAction.review_artifacts.includes("sample_gate_batch_2_paste_block.txt"), "owner next-action must include sample gate batch 2 paste block");
assert(ownerNextAction.review_artifacts.includes("sample_gate_capture_calendar.md"), "owner next-action must include sample-gate capture calendar report");
assert(ownerNextAction.review_artifacts.includes("sample_gate_due_status.md"), "owner next-action must include sample-gate due status report");
assert(ownerNextAction.review_artifacts.includes("gate_readiness.md"), "owner next-action must include gate readiness report");
assert(ownerNextAction.review_artifacts.includes("data/gate_readiness_status.json"), "owner next-action must include gate readiness status");
assert(ownerNextAction.review_artifacts.includes("owner_approval_form.html"), "owner next-action must include owner approval form");
assert(ownerNextAction.review_artifacts.includes("data/approval_queue_status.json"), "owner next-action must include approval queue compact status");
if (!ownerSampleGateStatus.sample_threshold_met) {
  if (realDataIntake.status === "input_attention_required") {
    assert(ownerNextAction.primary_action.id === "fix_real_data_input_preview", "real-data input attention must make preview fix the primary owner action");
    assert(ownerNextAction.primary_action.command === "npm run real-data:intake", "real-data input attention must rerun real-data intake preview");
  } else if (nextP0QuickCapture.status === "blocked_invalid_quick_counts" || p0CountsPreflightStatus.status === "blocked_invalid_p0_counts") {
    assert(ownerNextAction.primary_action.id === "fix_invalid_p0_counts", "invalid P0 counts must make paste fix the primary owner action");
    assert(ownerNextAction.primary_action.command === "open p0_counts_preflight.md", "invalid P0 counts must open P0 preflight");
    assert(ownerNextActionStatus.primary_action_command === "open p0_counts_preflight.md", "owner next-action compact status must expose P0 preflight fix command");
    assert(ownerNextAction.primary_action.artifacts.includes("p0_counts_preflight.md"), "invalid P0 action must point to P0 preflight report");
    assert(ownerNextAction.primary_action.artifacts.includes("data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt"), "invalid P0 action must point to paste template");
  } else if (realDataIntake.status === "preview_ready_owner_apply_required" && Number(realDataIntake.ready_apply_count ?? 0) > 0) {
    assert(ownerNextAction.primary_action.id === "review_real_data_apply", "preview-ready real data must make owner apply review the primary owner action");
    assert(ownerNextAction.primary_action.command === "open real_data_intake_plan.md", "preview-ready real data must open real-data intake plan");
    assert(ownerNextAction.owner_review_required === true, "preview-ready real data must require owner review");
  } else if (nextP0OwnerIntake.stage_performed === true || nextP0OwnerIntake.status === "next_p0_owner_download_staged_local_inputs") {
    assert(ownerNextAction.primary_action.id === "preview_staged_real_data_inputs", "staged next P0 inputs must make real-data preview the primary owner action");
    assert(ownerNextAction.primary_action.command === "npm run real-data:intake", "staged next P0 inputs must expose real-data intake preview command");
  } else if ([
    "next_p0_owner_download_preview_ready",
    "next_p0_owner_download_ready_needs_confirmed_stage",
    "next_p0_owner_download_stage_blocked_live_inputs_exist",
  ].includes(nextP0OwnerIntake.status)) {
    assert(ownerNextAction.primary_action.id === "stage_reviewed_next_p0_download", "preview-ready next P0 intake must make local staging the primary owner action");
    assert(ownerNextAction.primary_action.command === "npm run next-p0:intake -- --stage --confirm-owner-reviewed", "preview-ready next P0 intake must expose owner-confirmed staging command");
    assert(ownerNextActionStatus.primary_action_command === "npm run next-p0:intake -- --stage --confirm-owner-reviewed", "owner next-action compact status must expose next P0 staging command");
    assert(ownerNextAction.primary_action.artifacts.includes("next_p0_owner_intake.md"), "preview-ready next P0 action must point to intake report");
  } else {
    assert(ownerNextAction.decision === "collect_owner_sample_gate_counts", "sample-insufficient owner next-action must collect sample counts when no staged or preview-ready input exists");
    if (nextP0QuickCapture.filled_preview_created === true) {
      assert(ownerNextAction.primary_action.id === "preview_quick_next_p0_counts", "quick-filled preview must make preview intake the primary owner action");
      assert(ownerNextAction.primary_action.command === "npm run next-p0:intake -- --input=data/next_p0_quick_capture/next_p0_owner_inputs.quick-filled.preview.csv", "quick-filled preview must expose focused intake preview command");
      assert(ownerNextActionStatus.primary_action_command === "npm run next-p0:intake -- --input=data/next_p0_quick_capture/next_p0_owner_inputs.quick-filled.preview.csv", "owner next-action compact status must expose focused intake preview command");
      assert(ownerNextAction.primary_action.artifacts.includes("data/next_p0_quick_capture/next_p0_owner_inputs.quick-filled.preview.csv"), "quick-filled preview action must point to preview CSV");
    } else {
      if (nextP0QuickCapture.partial_waiting === true || (Number(nextP0QuickCapture.filled_rank_count ?? 0) > 0 && Number(nextP0QuickCapture.missing_rank_count ?? 0) > 0)) {
        assert(ownerNextAction.primary_action.command === "open data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt", "partial sample-insufficient owner next-action must point back to the focused paste template");
        assert(ownerNextActionStatus.primary_action_command === "open data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt", "partial owner next-action compact status must expose focused paste-template command");
      } else {
        assert(ownerNextAction.primary_action.command === "open sample_gate_batch_handoff.md", "empty sample-insufficient owner next-action must point to the full P0 batch handoff");
        assert(ownerNextActionStatus.primary_action_command === "open sample_gate_batch_handoff.md", "owner next-action compact status must expose full P0 batch handoff command");
        assert(ownerNextAction.primary_action.artifacts.includes("sample_gate_batch_handoff.md"), "full P0 owner next-action must point to sample gate batch handoff");
        assert(ownerNextAction.primary_action.artifacts.includes("sample_gate_batch_1_paste_block.txt"), "full P0 owner next-action must point to batch 1 paste block");
        assert(ownerNextAction.primary_action.artifacts.includes("sample_gate_batch_2_paste_block.txt"), "full P0 owner next-action must point to batch 2 paste block");
      }
    }
    assert(ownerNextAction.primary_action.artifacts.includes("data_collection_progress.md"), "sample-insufficient owner next-action must point to data collection progress");
    assert(ownerNextAction.primary_action.artifacts.includes("next_p0_owner_inputs.md"), "sample-insufficient owner next-action must point to next P0 owner inputs");
    assert(ownerNextAction.primary_action.artifacts.includes("next_p0_owner_form.html"), "sample-insufficient owner next-action must point to next P0 owner form");
    assert(ownerNextAction.primary_action.artifacts.includes("next_p0_quick_capture.md"), "sample-insufficient owner next-action must point to next P0 quick capture");
assert(ownerNextAction.primary_action.artifacts.includes("data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt"), "sample-insufficient owner next-action must point to next P0 paste template");
    assert(ownerNextAction.primary_action.artifacts.includes("sample_gate_capture_calendar.md"), "sample-insufficient owner next-action must point to sample-gate capture calendar");
    assert(ownerNextAction.primary_action.artifacts.includes("sample_gate_due_status.md"), "sample-insufficient owner next-action must point to sample-gate due status");
  }
}
assert(ownerNextActionFixture.ok === true, "owner next-action fixtures must be ok");
assert(ownerNextActionFixture.mode === "owner_next_action_fixture", "owner next-action fixture mode must match");
assert(ownerNextActionFixture.scenario_count === 6, "owner next-action fixtures must cover six routes");
assert(ownerNextActionFixture.scenario_ids.includes("waiting_counts_prioritizes_full_p0_batch_handoff"), "owner next-action fixtures must cover full P0 batch handoff route");
assert(ownerNextActionFixture.scenario_ids.includes("staged_next_p0_prompts_real_data_preview"), "owner next-action fixtures must cover staged Next P0 route");
assert(ownerNextActionFixture.scenario_ids.includes("real_data_preview_ready_prompts_owner_apply_review"), "owner next-action fixtures must cover real-data preview-ready route");
assert(ownerNextActionFixture.scenario_ids.includes("real_data_input_attention_blocks_apply"), "owner next-action fixtures must cover real-data input attention route");
assert(ownerNextActionFixture.scenario_ids.includes("partial_quick_counts_keep_collect_action"), "owner next-action fixtures must cover partial quick-count route");
assert(ownerNextActionFixture.scenario_ids.includes("invalid_p0_counts_prioritize_fix_card"), "owner next-action fixtures must cover invalid P0 count fix route");
assert(ownerNextActionFixtureReport.includes("waiting_counts_prioritizes_full_p0_batch_handoff"), "owner next-action fixture report must include full P0 batch handoff route");
assert(ownerNextActionFixtureReport.includes("partial_quick_counts_keep_collect_action"), "owner next-action fixture report must include partial quick-count route");
assert(ownerNextActionFixtureReport.includes("invalid_p0_counts_prioritize_fix_card"), "owner next-action fixture report must include invalid P0 count route");
assert(ownerNextActionFixture.scenarios.every((scenario) => scenario.next_action_ids.includes("prepare_public_ab_metadata")), "owner next-action fixtures must include public A/B metadata secondary action");
assert(ownerNextActionFixture.scenarios.every((scenario) => scenario.data_lp_events_write_performed === false), "owner next-action fixtures must not write data/lp_events.jsonl");
assert(ownerNextActionFixture.scenarios.every((scenario) => scenario.external_effect === false), "owner next-action fixtures must not create external effects");
assert(ownerNextActionFixture.live_project_write_performed === false, "owner next-action fixtures must not write live project artifacts");
assert(ownerNextActionFixture.data_lp_events_write_performed === false, "owner next-action fixtures must not write real events");
assert(ownerNextActionFixture.external_effect === false, "owner next-action fixtures must not claim external effects");
assert(ownerNextActionFixture.public_link_change_performed === false, "owner next-action fixtures must not change public links");
assert(ownerNextActionFixture.production_deploy_performed === false, "owner next-action fixtures must not deploy production");
assert(ownerNextActionFixture.github_push_or_pr_performed === false, "owner next-action fixtures must not push or create PR");
assert(ownerNextActionFixture.formal_post_performed === false, "owner next-action fixtures must not formally post");
assert(ownerNextActionFixture.line_push_performed === false, "owner next-action fixtures must not push LINE");
assert(ownerNextActionFixture.customer_data_mutation_performed === false, "owner next-action fixtures must not mutate customer data");
assert(ownerNextActionFixture.payment_action_performed === false, "owner next-action fixtures must not touch payments");
assert(ownerNextActionFixture.delete_action_performed === false, "owner next-action fixtures must not delete data");
assert(ownerNextActionFixtureReport.includes("Owner Next Action Fixture Report"), "owner next-action fixture report must have title");
assert(ownerNextActionFixtureReport.includes("staged_next_p0_prompts_real_data_preview"), "owner next-action fixture report must include staged Next P0 route");
assert(ownerNextActionFixtureReport.includes("real_data_preview_ready_prompts_owner_apply_review"), "owner next-action fixture report must include preview-ready route");
assert(ownerNextActionFixtureReport.includes("real_data_input_attention_blocks_apply"), "owner next-action fixture report must include input-attention route");
assert(ownerNextActionFixtureReport.includes("prepare_public_ab_metadata_secondary_action"), "owner next-action fixture report must include public A/B metadata secondary route");
assert(ownerNextAction.external_effect === false, "owner next-action must not claim external effects");
assert(ownerNextAction.live_input_files_created === false, "owner next-action must not create live input files");
assert(ownerNextAction.data_lp_events_write_performed === false, "owner next-action must not write data/lp_events.jsonl");
assert(ownerNextAction.public_link_change_performed === false, "owner next-action must not change public links");
assert(ownerNextAction.production_deploy_performed === false, "owner next-action must not deploy production");
assert(ownerNextAction.github_push_or_pr_performed === false, "owner next-action must not push or create PR");
assert(ownerNextAction.formal_post_performed === false, "owner next-action must not formally post");
assert(ownerNextAction.line_push_performed === false, "owner next-action must not push LINE");
assert(ownerNextAction.customer_data_mutation_performed === false, "owner next-action must not mutate customer data");
assert(ownerNextAction.payment_action_performed === false, "owner next-action must not touch payments");
assert(ownerNextAction.delete_action_performed === false, "owner next-action must not delete data");
assert(ownerNextActionReport.includes("3Q Growth Loop Owner Next Action"), "owner next-action report must have title");
assert(ownerNextActionReport.includes("Next Three Actions"), "owner next-action report must list the three next actions");
assert(ownerNextActionReport.includes("Full P0 batch handoff"), "owner next-action report must include full P0 batch handoff status");
assert(ownerNextActionReport.includes("Source trust:"), "owner next-action report must include source trust status");
assert(ownerNextActionReport.includes(`trusted=${sourceTrustMatrixStatus.trusted_scoring_source_count}`), "owner next-action report must include source trust trusted count");
assert(ownerNextActionReport.includes("Approval queue:"), "owner next-action report must include approval queue compact status");
assert(ownerNextActionReport.includes("Approval queue next human gate"), "owner next-action report must include approval queue next human gate");
assert(ownerNextActionReport.includes("External effect: no"), "owner next-action report must state no external effect");
assert(ownerNextActionReport.includes("data/lp_events.jsonl write performed: no"), "owner next-action report must state no data write");
assert(sampleGateRecoverySource.includes("sample_gate_recovery_pack_local_only"), "sample gate recovery source must stay local-only");
assert(sampleGateRecoverySource.includes("fake_or_backfill_counts_without_owner_source"), "sample gate recovery source must block fake or backfilled counts");
assert(sampleGateRecovery.ok === true, "sample gate recovery pack must be ok");
assert(sampleGateRecovery.mode === "sample_gate_recovery_pack_local_only", "sample gate recovery pack mode must match");
assert([
  "day3_overdue_recovery_ready",
  "sample_gate_due_recovery_ready",
  "sample_gate_waiting_recovery_prepared",
  "sample_gate_met_recovery_not_needed",
].includes(sampleGateRecovery.status), "sample gate recovery pack status must be valid");
assert(sampleGateRecovery.due_status === sampleGateDueStatus.status, "sample gate recovery due status must match sample due status");
assert(sampleGateRecovery.p0_input_count === nextP0OwnerInputs.current_input_count, "sample gate recovery P0 count must match focused owner inputs");
assert(sampleGateRecovery.missing_rank_count === nextP0QuickCapture.missing_rank_count, "sample gate recovery missing rank count must match quick capture");
assert(sampleGateRecovery.quick_count_count === nextP0QuickCapture.quick_count_count, "sample gate recovery quick count count must match quick capture");
assert(sampleGateRecovery.current_real_event_rows === sourceReadiness.real_event_rows, "sample gate recovery real event rows must match source readiness");
assert(sampleGateRecovery.sample_threshold_met === ownerSampleGateStatus.sample_threshold_met, "sample gate recovery sample threshold must match owner sample gate");
assert(sampleGateRecovery.challenger_promotion_allowed === false, "sample gate recovery must not allow challenger promotion");
assert(sampleGateRecovery.next_variable_rotation_allowed === false, "sample gate recovery must not allow variable rotation");
assert(sampleGateRecovery.blocked_actions.includes("fake_or_backfill_counts_without_owner_source"), "sample gate recovery must block fake count backfills");
assert(sampleGateRecovery.blocked_actions.includes("append_to_data_lp_events_jsonl"), "sample gate recovery must block event writes");
assert(sampleGateRecovery.command_sequence_after_owner_counts.includes("npm run weekly:local"), "sample gate recovery must include weekly rerun command after owner counts");
assert(sampleGateRecovery.recovery_rows.length === nextP0OwnerInputs.current_input_count, "sample gate recovery rows must match focused owner inputs");
assert(sampleGateRecovery.source_groups.length >= 2, "sample gate recovery must group rows by source surface");
assertNoRedLineFlags(sampleGateRecovery, "sample gate recovery pack");
assert(sampleGateRecoveryStatus.ok === true, "sample gate recovery compact status must be ok");
assert(sampleGateRecoveryStatus.mode === "sample_gate_recovery_pack_local_only", "sample gate recovery compact mode must match");
assert(sampleGateRecoveryStatus.status === sampleGateRecovery.status, "sample gate recovery compact status must match full JSON");
assert(sampleGateRecoveryStatus.missing_rank_count === sampleGateRecovery.missing_rank_count, "sample gate recovery compact missing rank count must match full JSON");
assertNoRedLineFlags(sampleGateRecoveryStatus, "sample gate recovery compact status");
assert(sampleGateRecoveryReport.includes("Sample Gate Recovery Pack"), "sample gate recovery report must have title");
assert(sampleGateRecoveryReport.includes("Current Gate"), "sample gate recovery report must include current gate section");
assert(sampleGateRecoveryReport.includes("data/lp_events.jsonl write performed: no"), "sample gate recovery report must state no event write");
assert(sampleGateRecoveryReport.includes("Formal post performed: no"), "sample gate recovery report must state no formal post");
assert(sampleGateBatchHandoffSource.includes("sample_gate_batch_handoff_local_only"), "sample gate batch handoff source must stay local-only");
assert(sampleGateBatchHandoffSource.includes("fake_or_backfill_counts_without_owner_source"), "sample gate batch handoff source must block fake or backfilled counts");
assert(sampleGateBatchHandoff.ok === true, "sample gate batch handoff must be ok");
assert(sampleGateBatchHandoff.mode === "sample_gate_batch_handoff_local_only", "sample gate batch handoff mode must match");
assert(sampleGateBatchHandoff.status === "p0_full_coverage_batched_for_owner_counts", "sample gate batch handoff must expose full P0 coverage status");
assert(sampleGateBatchHandoff.p0_task_count === sampleGateStatus.p0_task_count, "sample gate batch handoff planned rows must match sample gate plan");
assert(sampleGateBatchHandoff.p0_task_count === 18, "sample gate batch handoff must preserve 18 planned P0 rows");
assert(sampleGateBatchHandoff.all_p0_row_count === 18, "sample gate batch handoff must map all 18 P0 rows");
assert(sampleGateBatchHandoff.focused_batch_row_count === nextP0OwnerInputs.current_input_count, "sample gate batch handoff focused batch must match current focused inputs");
assert(sampleGateBatchHandoff.focused_batch_row_count === 9, "sample gate batch handoff focused batch must contain 9 rows");
assert(sampleGateBatchHandoff.remaining_batch_row_count === 9, "sample gate batch handoff remaining batch must contain 9 rows");
assert(sampleGateBatchHandoff.focused_batch_row_count + sampleGateBatchHandoff.remaining_batch_row_count === sampleGateBatchHandoff.all_p0_row_count, "sample gate batch handoff batches must add up to all P0 rows");
assert(sampleGateBatchHandoff.full_coverage_ready === true, "sample gate batch handoff must mark full coverage ready");
assert(Array.isArray(sampleGateBatchHandoff.batches) && sampleGateBatchHandoff.batches.length === 2, "sample gate batch handoff must have two batches");
assert(sampleGateBatchHandoff.batches[0].id === "batch_1_focused_next_p0", "sample gate batch handoff first batch id must match");
assert(sampleGateBatchHandoff.batches[0].row_count === 9, "sample gate batch handoff first batch must have 9 rows");
assert(sampleGateBatchHandoff.batches[0].accepted_by === "npm run next-p0:quick", "sample gate batch 1 must route through quick capture");
assert(sampleGateBatchHandoff.batches[1].id === "batch_2_remaining_content_variants", "sample gate batch handoff second batch id must match");
assert(sampleGateBatchHandoff.batches[1].row_count === 9, "sample gate batch handoff second batch must have 9 rows");
assert(sampleGateBatchHandoff.batches[1].accepted_by.includes("sample_gate_owner_worksheet.md"), "sample gate batch 2 must route through worksheet");
assert(sampleGateBatchHandoff.all_rows.length === 18, "sample gate batch handoff full JSON must include all rows");
assert(sampleGateBatchHandoff.all_rows.filter((row) => row.role === "content_variant").length === 9, "sample gate batch handoff must preserve 9 content-variant P0 rows");
assert(sampleGateBatchHandoff.blocked_actions.includes("append_to_data_lp_events_jsonl"), "sample gate batch handoff must block event writes");
assert(sampleGateBatchHandoff.blocked_actions.includes("paste_customer_rows_or_chat_text"), "sample gate batch handoff must block customer row paste");
assert(sampleGateBatchHandoff.outputs.batch_1_paste_block === "sample_gate_batch_1_paste_block.txt", "sample gate batch handoff must expose batch 1 paste block");
assert(sampleGateBatchHandoff.outputs.batch_2_paste_block === "sample_gate_batch_2_paste_block.txt", "sample gate batch handoff must expose batch 2 paste block");
assert(sampleGateBatch1PasteBlock.trim() === sampleGateBatchHandoff.batches[0].paste_block.trim(), "sample gate batch 1 paste block file must match JSON");
assert(sampleGateBatch2PasteBlock.trim() === sampleGateBatchHandoff.batches[1].paste_block.trim(), "sample gate batch 2 paste block file must match JSON");
assert(sampleGateBatch1PasteBlock.includes("champion.visits=<count>"), "sample gate batch 1 paste block must include champion visits key");
assert(sampleGateBatch2PasteBlock.includes("post_week0_post_001_cta_v1_diagnostic.visits=<count>"), "sample gate batch 2 paste block must include content-variant visits key");
assertNoRedLineFlags(sampleGateBatchHandoff, "sample gate batch handoff");
assert(sampleGateBatchHandoffStatus.ok === true, "sample gate batch handoff compact status must be ok");
assert(sampleGateBatchHandoffStatus.mode === "sample_gate_batch_handoff_local_only", "sample gate batch handoff compact mode must match");
assert(sampleGateBatchHandoffStatus.status === sampleGateBatchHandoff.status, "sample gate batch handoff compact status must match full JSON");
assert(sampleGateBatchHandoffStatus.all_p0_row_count === sampleGateBatchHandoff.all_p0_row_count, "sample gate batch handoff compact row count must match full JSON");
assert(sampleGateBatchHandoffStatus.full_coverage_ready === true, "sample gate batch handoff compact status must mark full coverage ready");
assertNoRedLineFlags(sampleGateBatchHandoffStatus, "sample gate batch handoff compact status");
assert(sampleGateBatchHandoffReport.includes("P0 Sample-Gate Batch Handoff"), "sample gate batch handoff report must have title");
assert(sampleGateBatchHandoffReport.includes("P0 is 18/18 rows mapped"), "sample gate batch handoff report must state 18/18 coverage");
assert(sampleGateBatchHandoffReport.includes("Focused Next P0 quick-capture batch"), "sample gate batch handoff report must include focused batch");
assert(sampleGateBatchHandoffReport.includes("Remaining P0 content-variant coverage batch"), "sample gate batch handoff report must include remaining batch");
assert(sampleGateBatchHandoffReport.includes("data/lp_events.jsonl write performed: no"), "sample gate batch handoff report must state no event write");
assert(sampleGateBatchPreflightSource.includes("sample_gate_batch_preflight_local_only"), "sample gate batch preflight source must stay local-only");
assert(sampleGateBatchPreflightSource.includes("data/source_capture/sample_gate_ledger.filled.csv"), "sample gate batch preflight source must inspect owner-filled sample gate ledger");
assert(sampleGateBatchPreflight.ok === true, "sample gate batch preflight must be ok while waiting or ready");
assert(sampleGateBatchPreflight.mode === "sample_gate_batch_preflight_local_only", "sample gate batch preflight mode must match");
assert(sampleGateBatchPreflight.expected_p0_row_count === sampleGateBatchHandoff.all_p0_row_count, "sample gate batch preflight expected rows must match handoff all rows");
assert(sampleGateBatchPreflight.ledger_row_count >= sampleGateBatchPreflight.expected_p0_row_count, "sample gate batch preflight must inspect enough ledger rows");
assert(sampleGateBatchPreflight.filled_p0_row_count + sampleGateBatchPreflight.pending_p0_row_count + sampleGateBatchPreflight.partial_p0_row_count >= sampleGateBatchPreflight.expected_p0_row_count, "sample gate batch preflight row states must cover expected rows");
assert(sampleGateBatchPreflight.issue_count === 0, "sample gate batch preflight must not have blocking issues in current project state");
assert(sampleGateBatchPreflight.ready_for_source_compile === (sampleGateBatchPreflight.status === "ready_for_source_compile"), "sample gate batch preflight compile flag must match status");
assert(sampleGateBatchPreflight.recommended_commands.includes("npm run sample-gate:batch-preflight") || sampleGateBatchPreflight.recommended_commands.some((command) => command.includes("source:compile")), "sample gate batch preflight must expose a safe next command");
assertNoRedLineFlags(sampleGateBatchPreflight, "sample gate batch preflight");
assert(sampleGateBatchPreflightStatus.mode === "sample_gate_batch_preflight_local_only", "sample gate batch preflight compact mode must match");
assert(sampleGateBatchPreflightStatus.status === sampleGateBatchPreflight.status, "sample gate batch preflight compact status must match full JSON");
assert(sampleGateBatchPreflightStatus.expected_p0_row_count === sampleGateBatchPreflight.expected_p0_row_count, "sample gate batch preflight compact row count must match full JSON");
assert(sampleGateBatchPreflightStatus.filled_p0_row_count === sampleGateBatchPreflight.filled_p0_row_count, "sample gate batch preflight compact filled count must match full JSON");
assert(sampleGateBatchPreflightStatus.pending_p0_row_count === sampleGateBatchPreflight.pending_p0_row_count, "sample gate batch preflight compact pending count must match full JSON");
assertNoRedLineFlags(sampleGateBatchPreflightStatus, "sample gate batch preflight compact status");
assert(sampleGateBatchPreflightReport.includes("Full P0 Batch Preflight"), "sample gate batch preflight report must have title");
assert(sampleGateBatchPreflightReport.includes("Ready for source compile:"), "sample gate batch preflight report must expose compile readiness");
assert(sampleGateBatchPreflightReport.includes("data/lp_events.jsonl write performed: no"), "sample gate batch preflight report must state no event write");
assert(sampleGateBatchPreflightReport.includes("GitHub push / PR performed: no"), "sample gate batch preflight report must state no GitHub action");
assert(sampleGateCollectionSprintSource.includes("sample_gate_collection_sprint_local_only"), "sample gate collection sprint source must stay local-only");
assert(sampleGateCollectionSprintSource.includes("append_to_data_lp_events_jsonl"), "sample gate collection sprint source must block event writes");
assert(sampleGateCollectionSprint.ok === true, "sample gate collection sprint must be ok");
assert(sampleGateCollectionSprint.mode === "sample_gate_collection_sprint_local_only", "sample gate collection sprint mode must match");
assert([
  "sample_gate_met_sprint_not_needed",
  "day3_overdue_collection_sprint_active",
  "sample_gate_due_collection_sprint_active",
  "sample_gate_collection_sprint_prepared",
].includes(sampleGateCollectionSprint.status), "sample gate collection sprint status must be known");
assert(sampleGateCollectionSprint.sample_threshold_met === ownerSampleGateStatus.sample_threshold_met, "sample gate collection sprint sample threshold must match owner sample gate");
assert(sampleGateCollectionSprint.p0_full_task_count === sampleGateBatchHandoffStatus.p0_task_count, "sample gate collection sprint P0 task count must match batch handoff");
assert(sampleGateCollectionSprint.p0_full_row_count === sampleGateBatchHandoffStatus.all_p0_row_count, "sample gate collection sprint P0 row count must match batch handoff");
assert(sampleGateCollectionSprint.p0_pending_count === dataCollectionProgressStatus.p0_pending_count, "sample gate collection sprint pending count must match data progress");
assert(sampleGateCollectionSprint.focused_missing_count === ownerSampleCountHandoffStatus.missing_count, "sample gate collection sprint focused missing count must match count handoff");
assert(sampleGateCollectionSprint.current_real_event_rows === sourceReadiness.real_event_rows, "sample gate collection sprint real event rows must match source readiness");
assert(Array.isArray(sampleGateCollectionSprint.sprint_steps) && sampleGateCollectionSprint.sprint_steps.length === sampleGateCollectionSprintStatus.sprint_step_count, "sample gate collection sprint step count must match compact status");
assert(sampleGateCollectionSprint.sprint_steps.some((step) => step.phase === "batch_1_focused_counts"), "sample gate collection sprint must include focused count step");
assert(sampleGateCollectionSprint.sprint_steps.some((step) => step.phase === "batch_2_remaining_counts"), "sample gate collection sprint must include remaining count step");
assert(sampleGateCollectionSprint.owner_open_order.includes("owner_p0_now.html"), "sample gate collection sprint must route owner to P0 now");
assert(sampleGateCollectionSprint.owner_open_order.includes("sample_gate_batch_1_paste_block.txt"), "sample gate collection sprint must route owner to batch 1 paste block");
assert(sampleGateCollectionSprint.owner_open_order.includes("sample_gate_batch_2_paste_block.txt"), "sample gate collection sprint must route owner to batch 2 paste block");
assert(sampleGateCollectionSprint.command_sequence_after_owner_counts.includes("npm run weekly:local"), "sample gate collection sprint must include weekly rerun command");
assert(sampleGateCollectionSprint.command_sequence_after_owner_counts.includes("node scripts/verify-artifacts.mjs"), "sample gate collection sprint must include artifact verifier command");
assert(sampleGateCollectionSprint.acceptance_checks.some((item) => item.includes("Batch 1")), "sample gate collection sprint must require Batch 1 acceptance");
assert(sampleGateCollectionSprint.acceptance_checks.some((item) => item.includes("Batch 2")), "sample gate collection sprint must require Batch 2 acceptance");
assert(sampleGateCollectionSprint.blocked_actions.includes("append_to_data_lp_events_jsonl"), "sample gate collection sprint must block event writes");
assert(sampleGateCollectionSprint.blocked_actions.includes("production_worker_deploy"), "sample gate collection sprint must block production deploy");
assert(sampleGateCollectionSprint.outputs.sprint_md === "sample_gate_collection_sprint.md", "sample gate collection sprint outputs must include markdown report");
assert(sampleGateCollectionSprint.review_artifacts.includes("sample_gate_collection_sprint.md"), "sample gate collection sprint review artifacts must include itself");
assertNoRedLineFlags(sampleGateCollectionSprint, "sample gate collection sprint");
assert(sampleGateCollectionSprint.live_input_files_created === false, "sample gate collection sprint must not create live inputs");
assert(sampleGateCollectionSprintStatus.ok === true, "sample gate collection sprint compact status must be ok");
assert(sampleGateCollectionSprintStatus.mode === sampleGateCollectionSprint.mode, "sample gate collection sprint compact mode must match");
assert(sampleGateCollectionSprintStatus.status === sampleGateCollectionSprint.status, "sample gate collection sprint compact status must match full JSON");
assert(sampleGateCollectionSprintStatus.p0_pending_count === sampleGateCollectionSprint.p0_pending_count, "sample gate collection sprint compact pending count must match full JSON");
assert(sampleGateCollectionSprintStatus.sprint_step_count === sampleGateCollectionSprint.sprint_steps.length, "sample gate collection sprint compact step count must match full JSON");
assertNoRedLineFlags(sampleGateCollectionSprintStatus, "sample gate collection sprint compact status");
assert(sampleGateCollectionSprintReport.includes("Sample Gate Collection Sprint"), "sample gate collection sprint report must have title");
assert(sampleGateCollectionSprintReport.includes("data/lp_events.jsonl write performed: no"), "sample gate collection sprint report must state no event write");
assert(sampleGateCollectionSprintReport.includes("No production deploy"), "sample gate collection sprint report must state no production deploy");
assert(ownerSampleCountHandoffSource.includes("owner_sample_count_handoff_local_only"), "owner sample count handoff source must stay local-only");
assert(ownerSampleCountHandoffSource.includes("paste_customer_rows_or_chat_text"), "owner sample count handoff source must block customer row or chat text paste");
assert(ownerSampleCountHandoffSource.includes("data/sample_gate_batch_handoff_status.json"), "owner sample count handoff source must read full P0 batch status");
assert(ownerSampleCountHandoff.ok === true, "owner sample count handoff must be ok");
assert(ownerSampleCountHandoff.mode === "owner_sample_count_handoff_local_only", "owner sample count handoff mode must match");
assert(["waiting_for_owner_sample_counts", "sample_counts_collected_preview_ready", "sample_counts_not_needed_sample_met"].includes(ownerSampleCountHandoff.status), "owner sample count handoff status must be valid");
assert(ownerSampleCountHandoff.due_status === sampleGateRecovery.due_status, "owner sample count handoff due status must match recovery pack");
assert(ownerSampleCountHandoff.p0_input_count === sampleGateRecovery.p0_input_count, "owner sample count handoff P0 count must match recovery pack");
assert(ownerSampleCountHandoff.missing_count === sampleGateRecovery.missing_rank_count, "owner sample count handoff missing count must match recovery pack");
assert(ownerSampleCountHandoff.focused_quick_path_scope === "batch_1_focused_next_p0", "owner sample count handoff must label focused quick path scope");
assert(ownerSampleCountHandoff.full_p0_status === sampleGateBatchHandoffStatus.status, "owner sample count handoff must expose full P0 batch status");
assert(ownerSampleCountHandoff.full_p0_task_count === sampleGateBatchHandoffStatus.p0_task_count, "owner sample count handoff must expose full P0 task count");
assert(ownerSampleCountHandoff.full_p0_row_count === sampleGateBatchHandoffStatus.all_p0_row_count, "owner sample count handoff must expose full P0 row count");
assert(ownerSampleCountHandoff.full_p0_pending_count === sampleGateBatchHandoffStatus.p0_pending_count, "owner sample count handoff must expose full P0 pending count");
assert(ownerSampleCountHandoff.full_p0_focused_batch_row_count === sampleGateBatchHandoffStatus.focused_batch_row_count, "owner sample count handoff must expose focused batch row count");
assert(ownerSampleCountHandoff.full_p0_remaining_batch_row_count === sampleGateBatchHandoffStatus.remaining_batch_row_count, "owner sample count handoff must expose remaining batch row count");
assert(ownerSampleCountHandoff.full_p0_batch_count === sampleGateBatchHandoffStatus.batch_count, "owner sample count handoff must expose full P0 batch count");
assert(ownerSampleCountHandoff.full_p0_coverage_ready === sampleGateBatchHandoffStatus.full_coverage_ready, "owner sample count handoff must expose full P0 coverage flag");
assert(ownerSampleCountHandoff.full_p0_batch_status_path === "data/sample_gate_batch_handoff_status.json", "owner sample count handoff must expose full P0 batch status path");
assert(ownerSampleCountHandoff.full_p0_batch_handoff_path === "sample_gate_batch_handoff.md", "owner sample count handoff must expose full P0 batch handoff path");
assert(ownerSampleCountHandoff.full_p0_batch_1_paste_block_path === "sample_gate_batch_1_paste_block.txt", "owner sample count handoff must expose batch 1 paste block path");
assert(ownerSampleCountHandoff.full_p0_batch_2_paste_block_path === "sample_gate_batch_2_paste_block.txt", "owner sample count handoff must expose batch 2 paste block path");
assert(ownerSampleCountHandoff.quick_count_count === nextP0QuickCapture.quick_count_count, "owner sample count handoff quick count count must match quick capture");
assert(ownerSampleCountHandoff.quick_capture_status === nextP0QuickCapture.status, "owner sample count handoff quick capture status must match quick capture");
assert(ownerSampleCountHandoff.quick_expected_row_count === nextP0QuickCapture.expected_row_count, "owner sample count handoff quick expected rows must match quick capture");
assert(ownerSampleCountHandoff.quick_filled_rank_count === nextP0QuickCapture.filled_rank_count, "owner sample count handoff quick filled rank count must match quick capture");
assert(JSON.stringify(ownerSampleCountHandoff.quick_filled_ranks) === JSON.stringify(nextP0QuickCapture.filled_ranks), "owner sample count handoff quick filled ranks must match quick capture");
assert(ownerSampleCountHandoff.quick_missing_rank_count === nextP0QuickCapture.missing_rank_count, "owner sample count handoff quick missing rank count must match quick capture");
assert(JSON.stringify(ownerSampleCountHandoff.quick_missing_ranks) === JSON.stringify(nextP0QuickCapture.missing_ranks), "owner sample count handoff quick missing ranks must match quick capture");
assert(ownerSampleCountHandoff.quick_partial_waiting === nextP0QuickCapture.partial_waiting, "owner sample count handoff quick partial waiting flag must match quick capture");
assert(ownerSampleCountHandoff.quick_partial_auto_counts === nextP0QuickCapture.partial_auto_counts, "owner sample count handoff quick partial auto-count flag must match quick capture");
assert(ownerSampleCountHandoff.quick_template_created === nextP0QuickCapture.template_created, "owner sample count handoff quick template state must match quick capture");
assert(ownerSampleCountHandoff.quick_paste_template_created === nextP0QuickCapture.paste_template_created, "owner sample count handoff quick paste-template state must match quick capture");
assert(ownerSampleCountHandoff.quick_paste_template_preserved === nextP0QuickCapture.paste_template_preserved, "owner sample count handoff quick paste-template preservation state must match quick capture");
assert(ownerSampleCountHandoff.quick_filled_preview_created === nextP0QuickCapture.filled_preview_created, "owner sample count handoff quick preview state must match quick capture");
assert(ownerSampleCountHandoff.current_real_event_rows === sourceReadiness.real_event_rows, "owner sample count handoff real event rows must match source readiness");
assert(ownerSampleCountHandoff.sample_threshold_met === ownerSampleGateStatus.sample_threshold_met, "owner sample count handoff sample threshold must match owner sample gate");
assert(ownerSampleCountHandoff.one_screen_rows.length === nextP0OwnerInputs.current_input_count, "owner sample count handoff rows must match focused owner inputs");
assert(ownerSampleCountHandoff.missing_rows.length === ownerSampleCountHandoff.missing_count, "owner sample count handoff missing rows must match missing count");
assert(ownerSampleCountHandoff.source_groups.length >= 2, "owner sample count handoff must group rows by source surface");
assert(ownerSampleCountHandoff.required_fields.includes("pii_checked=yes"), "owner sample count handoff must require pii_checked=yes");
assert(typeof ownerSampleCountHandoff.paste_block === "string" && ownerSampleCountHandoff.paste_block.includes("pii_checked=yes"), "owner sample count handoff must include paste block");
assert(ownerSampleCountHandoff.paste_block_path === "owner_sample_count_paste_block.txt", "owner sample count handoff must point to paste block file");
assert(ownerSampleCountHandoff.outputs.paste_block_txt === "owner_sample_count_paste_block.txt", "owner sample count handoff outputs must include paste block file");
assert(ownerSampleCountHandoff.review_artifacts.includes("owner_sample_count_paste_block.txt"), "owner sample count handoff review artifacts must include paste block file");
assert(ownerSampleCountHandoff.review_artifacts.includes("sample_gate_batch_handoff.md"), "owner sample count handoff review artifacts must include full P0 batch handoff");
assert(ownerSampleCountHandoff.review_artifacts.includes("sample_gate_batch_1_paste_block.txt"), "owner sample count handoff review artifacts must include batch 1 paste block");
assert(ownerSampleCountHandoff.review_artifacts.includes("sample_gate_batch_2_paste_block.txt"), "owner sample count handoff review artifacts must include batch 2 paste block");
assert(ownerSampleCountPasteBlock.trim() === ownerSampleCountHandoff.paste_block.trim(), "owner sample count paste block file must match handoff JSON paste block");
assert(ownerSampleCountHandoff.paste_block.includes("evidence_ref=<aggregate_ref>"), "owner sample count handoff paste block must include evidence ref placeholder");
assert(ownerSampleCountHandoff.paste_block.includes("reviewer=<alias>"), "owner sample count handoff paste block must include reviewer placeholder");
assert(ownerSampleCountHandoff.paste_block_line_count === ownerSampleCountHandoff.paste_block_lines.length, "owner sample count handoff paste block line count must match lines");
assert(ownerSampleCountHandoff.paste_key_count === ownerSampleCountHandoff.missing_count, "owner sample count handoff paste key count must match missing count");
for (const row of ownerSampleCountHandoff.missing_rows) {
  assert(ownerSampleCountHandoff.paste_block.includes(`${row.paste_key}=<count>`), `owner sample count handoff paste block missing ${row.paste_key}`);
}
assert(ownerSampleCountHandoff.after_fill_commands.includes("npm run weekly:local"), "owner sample count handoff must include weekly rerun command");
assert(ownerSampleCountHandoff.blocked_actions.includes("append_to_data_lp_events_jsonl"), "owner sample count handoff must block event writes");
assert(ownerSampleCountHandoff.blocked_actions.includes("paste_customer_rows_or_chat_text"), "owner sample count handoff must block customer row paste");
assertNoRedLineFlags(ownerSampleCountHandoff, "owner sample count handoff");
assert(ownerSampleCountHandoffStatus.ok === true, "owner sample count handoff compact status must be ok");
assert(ownerSampleCountHandoffStatus.mode === "owner_sample_count_handoff_local_only", "owner sample count handoff compact mode must match");
assert(ownerSampleCountHandoffStatus.status === ownerSampleCountHandoff.status, "owner sample count handoff compact status must match full JSON");
assert(ownerSampleCountHandoffStatus.missing_count === ownerSampleCountHandoff.missing_count, "owner sample count handoff compact missing count must match full JSON");
assert(ownerSampleCountHandoffStatus.focused_quick_path_scope === ownerSampleCountHandoff.focused_quick_path_scope, "owner sample count handoff compact status must expose focused quick path scope");
assert(ownerSampleCountHandoffStatus.full_p0_status === ownerSampleCountHandoff.full_p0_status, "owner sample count handoff compact status must expose full P0 status");
assert(ownerSampleCountHandoffStatus.full_p0_task_count === ownerSampleCountHandoff.full_p0_task_count, "owner sample count handoff compact status must expose full P0 task count");
assert(ownerSampleCountHandoffStatus.full_p0_row_count === ownerSampleCountHandoff.full_p0_row_count, "owner sample count handoff compact status must expose full P0 row count");
assert(ownerSampleCountHandoffStatus.full_p0_pending_count === ownerSampleCountHandoff.full_p0_pending_count, "owner sample count handoff compact status must expose full P0 pending count");
assert(ownerSampleCountHandoffStatus.full_p0_focused_batch_row_count === ownerSampleCountHandoff.full_p0_focused_batch_row_count, "owner sample count handoff compact status must expose focused batch row count");
assert(ownerSampleCountHandoffStatus.full_p0_remaining_batch_row_count === ownerSampleCountHandoff.full_p0_remaining_batch_row_count, "owner sample count handoff compact status must expose remaining batch row count");
assert(ownerSampleCountHandoffStatus.full_p0_batch_count === ownerSampleCountHandoff.full_p0_batch_count, "owner sample count handoff compact status must expose full P0 batch count");
assert(ownerSampleCountHandoffStatus.full_p0_coverage_ready === ownerSampleCountHandoff.full_p0_coverage_ready, "owner sample count handoff compact status must expose full P0 coverage flag");
assert(ownerSampleCountHandoffStatus.full_p0_batch_status_path === ownerSampleCountHandoff.full_p0_batch_status_path, "owner sample count handoff compact status must expose full P0 status path");
assert(ownerSampleCountHandoffStatus.full_p0_batch_handoff_path === ownerSampleCountHandoff.full_p0_batch_handoff_path, "owner sample count handoff compact status must expose full P0 handoff path");
assert(ownerSampleCountHandoffStatus.full_p0_batch_1_paste_block_path === ownerSampleCountHandoff.full_p0_batch_1_paste_block_path, "owner sample count handoff compact status must expose batch 1 paste block path");
assert(ownerSampleCountHandoffStatus.full_p0_batch_2_paste_block_path === ownerSampleCountHandoff.full_p0_batch_2_paste_block_path, "owner sample count handoff compact status must expose batch 2 paste block path");
assert(ownerSampleCountHandoffStatus.paste_block_line_count === ownerSampleCountHandoff.paste_block_line_count, "owner sample count handoff compact status must expose paste block line count");
assert(ownerSampleCountHandoffStatus.paste_key_count === ownerSampleCountHandoff.paste_key_count, "owner sample count handoff compact status must expose paste key count");
assert(ownerSampleCountHandoffStatus.paste_block_path === ownerSampleCountHandoff.paste_block_path, "owner sample count handoff compact status must expose paste block path");
assert(ownerSampleCountHandoffStatus.quick_capture_status === nextP0QuickCapture.status, "owner sample count handoff compact status must expose quick capture status");
assert(ownerSampleCountHandoffStatus.quick_expected_row_count === nextP0QuickCapture.expected_row_count, "owner sample count handoff compact status must expose quick expected rows");
assert(ownerSampleCountHandoffStatus.quick_filled_rank_count === nextP0QuickCapture.filled_rank_count, "owner sample count handoff compact status must expose quick filled rank count");
assert(JSON.stringify(ownerSampleCountHandoffStatus.quick_filled_ranks) === JSON.stringify(nextP0QuickCapture.filled_ranks), "owner sample count handoff compact status must expose quick filled ranks");
assert(ownerSampleCountHandoffStatus.quick_missing_rank_count === nextP0QuickCapture.missing_rank_count, "owner sample count handoff compact status must expose quick missing rank count");
assert(JSON.stringify(ownerSampleCountHandoffStatus.quick_missing_ranks) === JSON.stringify(nextP0QuickCapture.missing_ranks), "owner sample count handoff compact status must expose quick missing ranks");
assert(ownerSampleCountHandoffStatus.quick_partial_waiting === nextP0QuickCapture.partial_waiting, "owner sample count handoff compact status must expose quick partial waiting flag");
assert(ownerSampleCountHandoffStatus.quick_partial_auto_counts === nextP0QuickCapture.partial_auto_counts, "owner sample count handoff compact status must expose quick partial auto-count flag");
assert(ownerSampleCountHandoffStatus.quick_filled_preview_created === nextP0QuickCapture.filled_preview_created, "owner sample count handoff compact status must expose quick preview state");
assertNoRedLineFlags(ownerSampleCountHandoffStatus, "owner sample count handoff compact status");
assert(ownerSampleCountHandoffReport.includes("Owner Sample Count Handoff"), "owner sample count handoff report must have title");
assert(ownerSampleCountHandoffReport.includes("Quick Count Progress"), "owner sample count handoff report must include quick count progress");
assert(ownerSampleCountHandoffReport.includes("Full P0 Coverage"), "owner sample count handoff report must include full P0 coverage section");
assert(ownerSampleCountHandoffReport.includes("Copy/Paste Block"), "owner sample count handoff report must include copy/paste block");
assert(ownerSampleCountHandoffReport.includes("Batch 1 Focused Missing Rows"), "owner sample count handoff report must label focused missing rows");
assert(ownerSampleCountHandoffReport.includes("sample_gate_batch_handoff.md"), "owner sample count handoff report must link full P0 batch handoff");
assert(ownerSampleCountHandoffReport.includes("sample_gate_batch_1_paste_block.txt"), "owner sample count handoff report must link batch 1 paste block");
assert(ownerSampleCountHandoffReport.includes("sample_gate_batch_2_paste_block.txt"), "owner sample count handoff report must link batch 2 paste block");
assert(ownerSampleCountHandoffReport.includes("owner_sample_count_paste_block.txt"), "owner sample count handoff report must link paste block file");
assert(ownerSampleCountHandoffReport.includes("champion.visits=<count>"), "owner sample count handoff report must include champion visits paste key");
assert(ownerSampleCountHandoffReport.includes("line_cta.line=<count>"), "owner sample count handoff report must include line CTA line paste key");
assert(ownerSampleCountHandoffReport.includes("Filled ranks:"), "owner sample count handoff report must include filled rank progress");
assert(ownerSampleCountHandoffReport.includes("Missing ranks:"), "owner sample count handoff report must include missing rank progress");
assert(ownerSampleCountHandoffReport.includes(ownerSampleCountHandoff.paste_template_path), "owner sample count handoff report must include paste template path");
assert(ownerSampleCountHandoffReport.includes("Acceptance Checks"), "owner sample count handoff report must include acceptance checks");
assert(ownerSampleCountHandoffReport.includes("data/lp_events.jsonl write performed: no"), "owner sample count handoff report must state no event write");
assert(ownerSampleCountHandoffReport.includes("LINE push performed: no"), "owner sample count handoff report must state no LINE push");
assert(ownerP0NowSource.includes("owner_p0_now_local_only"), "owner P0-now source must stay local-only");
assert(ownerP0NowSource.includes("data/p0_counts_preflight_status.json"), "owner P0-now source must read P0 counts preflight status");
assert(ownerP0NowSource.includes("Do not invent, backfill, or estimate sample counts"), "owner P0-now source must block fake or backfilled counts");
assert(ownerP0Now.ok === true, "owner P0-now card must be ok");
assert(ownerP0Now.mode === "owner_p0_now_local_only", "owner P0-now mode must match");
assert(ownerP0Now.status === ownerP0NowStatus.status, "owner P0-now compact status must match full JSON");
assert(ownerP0Now.current_real_event_rows === completionAuditStatus.current_real_event_rows, "owner P0-now must read goal audit real event rows");
assert(ownerP0Now.sample_threshold_met === completionAuditStatus.sample_threshold_met, "owner P0-now must read goal audit sample threshold");
assert(ownerP0Now.sample_gate_status === completionAuditStatus.sample_gate_status, "owner P0-now must read goal audit sample gate status");
assert(ownerP0Now.p0_focused_missing_count === ownerSampleCountHandoffStatus.missing_count, "owner P0-now focused missing count must match sample count handoff");
assert(ownerP0Now.p0_focused_total_count === ownerSampleCountHandoffStatus.p0_input_count, "owner P0-now focused total must match sample count handoff");
assert(ownerP0Now.p0_full_row_count === sampleGateBatchHandoffStatus.all_p0_row_count, "owner P0-now full P0 row count must match batch handoff");
assert(ownerP0Now.p0_full_task_count === sampleGateBatchHandoffStatus.p0_task_count, "owner P0-now full P0 task count must match batch handoff");
assert(ownerP0Now.p0_full_pending_count === sampleGateBatchHandoffStatus.p0_pending_count, "owner P0-now full P0 pending count must match batch handoff");
assert(ownerP0Now.p0_batch_1_row_count === sampleGateBatchHandoffStatus.focused_batch_row_count, "owner P0-now batch 1 count must match batch handoff");
assert(ownerP0Now.p0_batch_2_row_count === sampleGateBatchHandoffStatus.remaining_batch_row_count, "owner P0-now batch 2 count must match batch handoff");
assert(ownerP0Now.quick_status === nextP0QuickCapture.status, "owner P0-now quick status must match quick capture");
assert(ownerP0Now.quick_filled_rank_count === nextP0QuickCapture.filled_rank_count, "owner P0-now quick filled count must match quick capture");
assert(ownerP0Now.quick_missing_rank_count === nextP0QuickCapture.missing_rank_count, "owner P0-now quick missing count must match quick capture");
assert(ownerP0Now.p0_counts_preflight_status === p0CountsPreflightStatus.status, "owner P0-now must read P0 counts preflight status");
assert(ownerP0Now.p0_counts_preflight_ready_for_quick_preview === p0CountsPreflightStatus.ready_for_quick_preview, "owner P0-now must read P0 counts preflight ready flag");
assert(ownerP0Now.p0_counts_preflight_expected_count_key_count === p0CountsPreflightStatus.expected_count_key_count, "owner P0-now must read P0 counts preflight expected count");
assert(ownerP0Now.p0_counts_preflight_filled_count_key_count === p0CountsPreflightStatus.filled_count_key_count, "owner P0-now must read P0 counts preflight filled count");
assert(ownerP0Now.p0_counts_preflight_placeholder_count_key_count === p0CountsPreflightStatus.placeholder_count_key_count, "owner P0-now must read P0 counts preflight placeholder count");
assert(ownerP0Now.p0_counts_preflight_issue_count === p0CountsPreflightStatus.issue_count, "owner P0-now must read P0 counts preflight issue count");
assert(ownerP0Now.sample_gate_form_status === sampleGateOwnerFormStatus.status, "owner P0-now must read full P0 owner form status");
assert(ownerP0Now.sample_gate_form_row_count === sampleGateOwnerFormStatus.row_count, "owner P0-now must read full P0 owner form row count");
assert(ownerP0Now.sample_gate_form_network_calls_performed === sampleGateOwnerFormStatus.network_calls_performed, "owner P0-now must expose full P0 form network flag");
assert(ownerP0Now.sample_gate_intake_status === ownerSampleGateIntake.status, "owner P0-now must read full P0 owner intake status");
assert(ownerP0Now.sample_gate_intake_candidate_found === ownerSampleGateIntake.candidate_found, "owner P0-now must read full P0 intake candidate-found flag");
assert(ownerP0Now.sample_gate_intake_candidate_valid === ownerSampleGateIntake.candidate_valid, "owner P0-now must read full P0 intake candidate-valid flag");
assert(ownerP0Now.sample_gate_intake_stage_performed === ownerSampleGateIntake.stage_performed, "owner P0-now must read full P0 intake stage flag");
assert(ownerP0Now.sample_gate_intake_live_input_files_created === ownerSampleGateIntake.live_input_files_created, "owner P0-now must read full P0 intake live-input flag");
assert(ownerP0Now.approval_queue_status === approvalStatus.status, "owner P0-now must read approval queue status");
assert(ownerP0Now.approval_queue_pending_human_count === approvalStatus.pending_human_count, "owner P0-now must read approval queue pending-human count");
assert(ownerP0Now.approval_queue_next_pending_human_id === approvalStatus.next_pending_human_id, "owner P0-now must expose next approval human gate");
assert(ownerP0Now.primary_open_targets.includes("sample_gate_batch_1_paste_block.txt"), "owner P0-now must open batch 1 paste block first");
assert(ownerP0Now.primary_open_targets.includes("sample_gate_batch_2_paste_block.txt"), "owner P0-now must include batch 2 paste block");
assert(ownerP0Now.primary_open_targets.includes("owner_sample_count_handoff.md"), "owner P0-now must link full sample count handoff");
assert(ownerP0Now.primary_open_targets.includes("owner_p0_now.html"), "owner P0-now must include compact browser cockpit");
assert(ownerP0Now.primary_open_targets.includes("p0_counts_preflight.md"), "owner P0-now must include P0 counts preflight");
assert(ownerP0Now.primary_open_targets.includes("sample_gate_owner_form.html"), "owner P0-now must include full P0 owner form");
assert(ownerP0Now.primary_open_targets.includes("owner_sample_gate_intake.md"), "owner P0-now must include full P0 intake report");
assert(Array.isArray(ownerP0Now.copy_blocks) && ownerP0Now.copy_blocks.length === 2, "owner P0-now must expose two copy blocks");
assert(ownerP0Now.copy_blocks.some((block) => block.id === "batch_1_focused_counts" && block.text === sampleGateBatch1PasteBlock.trim()), "owner P0-now batch 1 copy block must match paste block file");
assert(ownerP0Now.copy_blocks.some((block) => block.id === "batch_2_remaining_counts" && block.text === sampleGateBatch2PasteBlock.trim()), "owner P0-now batch 2 copy block must match paste block file");
assert(ownerP0Now.copy_blocks.some((block) => block.text.includes("champion.visits=<count>")), "owner P0-now copy blocks must include champion visit paste key");
assert(ownerP0Now.copy_blocks.some((block) => block.text.includes("post_week0_post_001_cta_v1_diagnostic.visits=<count>")), "owner P0-now copy blocks must include content-variant visit paste key");
assert(ownerP0Now.after_fill_commands.includes("npm run weekly:local"), "owner P0-now must keep weekly rerun after fill");
assert(ownerP0Now.after_full_p0_commands.includes("npm run weekly:local"), "owner P0-now must keep weekly rerun after full P0 fill");
assert(ownerP0Now.stop_lines.some((line) => line.includes("Do not append data/lp_events.jsonl")), "owner P0-now must block event writes");
assert(ownerP0NowStatus.mode === "owner_p0_now_local_only", "owner P0-now compact mode must match");
assert(ownerP0NowStatus.p0_focused_missing_count === ownerP0Now.p0_focused_missing_count, "owner P0-now compact missing count must match full JSON");
assert(ownerP0NowStatus.p0_counts_preflight_status === ownerP0Now.p0_counts_preflight_status, "owner P0-now compact status must expose P0 preflight status");
assert(ownerP0NowStatus.p0_counts_preflight_ready_for_quick_preview === ownerP0Now.p0_counts_preflight_ready_for_quick_preview, "owner P0-now compact status must expose P0 preflight ready flag");
assert(ownerP0NowStatus.p0_counts_preflight_expected_count_key_count === ownerP0Now.p0_counts_preflight_expected_count_key_count, "owner P0-now compact status must expose P0 preflight expected count");
assert(ownerP0NowStatus.p0_counts_preflight_filled_count_key_count === ownerP0Now.p0_counts_preflight_filled_count_key_count, "owner P0-now compact status must expose P0 preflight filled count");
assert(ownerP0NowStatus.p0_counts_preflight_placeholder_count_key_count === ownerP0Now.p0_counts_preflight_placeholder_count_key_count, "owner P0-now compact status must expose P0 preflight placeholders");
assert(ownerP0NowStatus.p0_counts_preflight_issue_count === ownerP0Now.p0_counts_preflight_issue_count, "owner P0-now compact status must expose P0 preflight issue count");
assert(ownerP0NowStatus.sample_gate_form_status === ownerP0Now.sample_gate_form_status, "owner P0-now compact status must expose full P0 form status");
assert(ownerP0NowStatus.sample_gate_form_row_count === ownerP0Now.sample_gate_form_row_count, "owner P0-now compact status must expose full P0 form row count");
assert(ownerP0NowStatus.sample_gate_intake_status === ownerP0Now.sample_gate_intake_status, "owner P0-now compact status must expose full P0 intake status");
assert(ownerP0NowStatus.sample_gate_intake_stage_performed === ownerP0Now.sample_gate_intake_stage_performed, "owner P0-now compact status must expose full P0 intake stage flag");
assert(ownerP0NowStatus.primary_open_target_count === ownerP0Now.primary_open_targets.length, "owner P0-now compact target count must match full JSON");
assert(ownerP0NowStatus.copy_block_count === ownerP0Now.copy_blocks.length, "owner P0-now compact copy block count must match full JSON");
assert(ownerP0NowStatus.copy_block_line_count === ownerP0Now.copy_blocks.reduce((sum, block) => sum + block.text.split(/\r?\n/).filter(Boolean).length, 0), "owner P0-now compact copy block line count must match full JSON");
assert(ownerP0NowStatus.after_fill_command_count === ownerP0Now.after_fill_commands.length, "owner P0-now compact command count must match full JSON");
assert(ownerP0NowStatus.after_full_p0_command_count === ownerP0Now.after_full_p0_commands.length, "owner P0-now compact full P0 command count must match full JSON");
assertNoRedLineFlags(ownerP0Now, "owner P0-now card");
assertNoRedLineFlags(ownerP0NowStatus, "owner P0-now compact status");
assert(ownerP0NowReport.includes("3Q Growth Loop P0 Now"), "owner P0-now report must have title");
assert(ownerP0NowReport.includes("Do First"), "owner P0-now report must include do-first section");
assert(ownerP0NowReport.includes("P0 preflight status"), "owner P0-now report must include P0 preflight status");
assert(ownerP0NowReport.includes("Full P0 form status"), "owner P0-now report must include full P0 form status");
assert(ownerP0NowReport.includes("Full P0 intake status"), "owner P0-now report must include full P0 intake status");
assert(ownerP0NowReport.includes("sample_gate_batch_1_paste_block.txt"), "owner P0-now report must link batch 1 paste block");
assert(ownerP0NowReport.includes("sample_gate_batch_2_paste_block.txt"), "owner P0-now report must link batch 2 paste block");
assert(ownerP0NowReport.includes("p0_counts_preflight.md"), "owner P0-now report must link P0 counts preflight");
assert(ownerP0NowReport.includes("sample_gate_owner_form.html"), "owner P0-now report must link full P0 owner form");
assert(ownerP0NowReport.includes("owner_sample_gate_intake.md"), "owner P0-now report must link full P0 intake report");
assert(ownerP0NowReport.includes("Copy Blocks"), "owner P0-now report must include copy blocks");
assert(ownerP0NowReport.includes("champion.visits=<count>"), "owner P0-now report must include batch 1 copy block contents");
assert(ownerP0NowReport.includes("post_week0_post_001_cta_v1_diagnostic.visits=<count>"), "owner P0-now report must include batch 2 copy block contents");
assert(ownerP0NowReport.includes("After Full P0 Commands"), "owner P0-now report must include full P0 commands");
assert(ownerP0NowReport.includes("data/lp_events.jsonl write performed: no"), "owner P0-now report must state no event write");
assert(ownerP0NowReport.includes("GitHub push / PR performed: no"), "owner P0-now report must state no GitHub push or PR");
assert(ownerP0NowHtml.includes("3Q Growth Loop P0 Now"), "owner P0-now HTML must have title");
assert(ownerP0NowHtml.includes('data-external-effect="false"'), "owner P0-now HTML must mark no external effect");
assert(ownerP0NowHtml.includes("P0 preflight"), "owner P0-now HTML must include P0 preflight status");
assert(ownerP0NowHtml.includes("Full P0 form"), "owner P0-now HTML must include full P0 form status");
assert(ownerP0NowHtml.includes("Full P0 intake"), "owner P0-now HTML must include full P0 intake status");
assert(ownerP0NowHtml.includes("sample_gate_batch_1_paste_block.txt"), "owner P0-now HTML must link batch 1 paste block");
assert(ownerP0NowHtml.includes("sample_gate_batch_2_paste_block.txt"), "owner P0-now HTML must link batch 2 paste block");
assert(ownerP0NowHtml.includes("p0_counts_preflight.md"), "owner P0-now HTML must link P0 counts preflight");
assert(ownerP0NowHtml.includes("sample_gate_owner_form.html"), "owner P0-now HTML must link full P0 owner form");
assert(ownerP0NowHtml.includes("owner_sample_gate_intake.md"), "owner P0-now HTML must link full P0 intake report");
assert(ownerP0NowHtml.includes("copy blocks"), "owner P0-now HTML must include copy blocks section");
assert(ownerP0NowHtml.includes("champion.visits=&lt;count&gt;"), "owner P0-now HTML must include escaped batch 1 copy block contents");
assert(ownerP0NowHtml.includes("post_week0_post_001_cta_v1_diagnostic.visits=&lt;count&gt;"), "owner P0-now HTML must include escaped batch 2 copy block contents");
assert(ownerP0NowHtml.includes("After Full P0 Commands"), "owner P0-now HTML must include full P0 commands");
assert(ownerP0NowHtml.includes("data/lp_events.jsonl write performed: no"), "owner P0-now HTML must state no event write");
assert(ownerP0NowHtml.includes("GitHub push / PR performed: no"), "owner P0-now HTML must state no GitHub push or PR");
assert(!/<form[\s>]/i.test(ownerP0NowHtml), "owner P0-now HTML must not include forms");
assert(!/\bfetch\s*\(/.test(ownerP0NowHtml), "owner P0-now HTML must not call fetch");
assert(!/sendBeacon|XMLHttpRequest/i.test(ownerP0NowHtml), "owner P0-now HTML must not send beacons or XHR");
assert(!/href=["']https?:\/\//i.test(ownerP0NowHtml), "owner P0-now HTML must not link external URLs");
assert(ownerSampleCountRecoverySource.includes("owner_sample_count_recovery_local_only"), "owner sample count recovery source must stay local-only");
assert(ownerSampleCountRecoverySource.includes("append_to_data_lp_events_jsonl"), "owner sample count recovery source must block event writes");
assert(ownerSampleCountRecovery.ok === true, "owner sample count recovery must be ok");
assert(ownerSampleCountRecovery.mode === "owner_sample_count_recovery_local_only", "owner sample count recovery mode must match");
assert([
  "waiting_for_owner_sample_counts",
  "quick_preview_ready_run_intake",
  "focused_intake_preview_ready_run_preflight",
  "full_p0_intake_ready_needs_owner_reviewed_stage",
  "full_p0_staged_run_sample_gate",
  "owner_preview_scored_keep_collecting",
  "owner_preview_sample_ready_no_auto_promotion",
  "owner_review_required_before_promotion",
].includes(ownerSampleCountRecovery.status), "owner sample count recovery status must be valid");
assert(ownerSampleCountRecovery.p0_input_count === ownerSampleCountHandoff.p0_input_count, "owner sample count recovery P0 count must match handoff");
assert(ownerSampleCountRecovery.missing_count === ownerSampleCountHandoff.missing_count, "owner sample count recovery missing count must match handoff");
assert(ownerSampleCountRecovery.full_p0_row_count === sampleGateBatchHandoff.all_p0_row_count, "owner sample count recovery full P0 count must match batch handoff");
assert(ownerSampleCountRecovery.full_p0_form_status === sampleGateOwnerFormStatus.status, "owner sample count recovery full form status must match form status");
assert(ownerSampleCountRecovery.full_p0_form_row_count === sampleGateOwnerFormStatus.row_count, "owner sample count recovery full form rows must match form status");
assert(ownerSampleCountRecovery.full_p0_intake_status === ownerSampleGateIntake.status, "owner sample count recovery full intake status must match owner sample-gate intake");
assert(ownerSampleCountRecovery.full_p0_intake_candidate_valid === (ownerSampleGateIntake.candidate_valid === true), "owner sample count recovery full intake valid flag must match owner sample-gate intake");
assert(ownerSampleCountRecovery.full_p0_intake_stage_performed === (ownerSampleGateIntake.stage_performed === true), "owner sample count recovery full intake stage flag must match owner sample-gate intake");
assert(ownerSampleCountRecovery.quick_count_count === nextP0QuickCapture.quick_count_count, "owner sample count recovery quick count must match quick capture");
assert(ownerSampleCountRecovery.quick_preview_ready === nextP0QuickCapture.filled_preview_created, "owner sample count recovery quick preview flag must match quick capture");
assert(ownerSampleCountRecovery.intake_preview_ready === (nextP0OwnerIntake.candidate_valid === true && ((nextP0OwnerIntake.funnel_preview_rows ?? 0) + (nextP0OwnerIntake.manual_preview_rows ?? 0)) > 0), "owner sample count recovery intake flag must match focused intake");
assert(ownerSampleCountRecovery.owner_preflight_ready === (ownerDataPreflight.selected_source_row_count > 0), "owner sample count recovery preflight flag must match owner data preflight row count");
assert(ownerSampleCountRecovery.sample_threshold_met === (ownerDataPreflight.sample_threshold_met === true || ownerSampleGateStatus.sample_threshold_met === true), "owner sample count recovery sample threshold must match current owner statuses");
assert(ownerSampleCountRecovery.challenger_win_rule_met === (ownerDataPreflight.challenger_win_rule_met === true || ownerSampleGateStatus.challenger_win_rule_met === true), "owner sample count recovery win rule must match current owner statuses");
assert(ownerSampleCountRecovery.chain.length === 4, "owner sample count recovery must expose four recovery chain steps");
assert(ownerSampleCountRecovery.full_p0_chain.length === 4, "owner sample count recovery must expose four full P0 recovery chain steps");
assert(ownerSampleCountRecovery.next_safe_commands.length > 0, "owner sample count recovery must include next safe commands");
assert(ownerSampleCountRecovery.full_p0_after_commands.includes("npm run weekly:local"), "owner sample count recovery must include full P0 after commands");
assert(ownerSampleCountRecovery.blocked_actions.includes("append_to_data_lp_events_jsonl"), "owner sample count recovery must block event writes");
assert(ownerSampleCountRecovery.blocked_actions.includes("github_push_or_pr_creation"), "owner sample count recovery must block GitHub push or PR");
assertNoRedLineFlags(ownerSampleCountRecovery, "owner sample count recovery");
assert(ownerSampleCountRecoveryStatus.ok === true, "owner sample count recovery compact status must be ok");
assert(ownerSampleCountRecoveryStatus.mode === "owner_sample_count_recovery_local_only", "owner sample count recovery compact mode must match");
assert(ownerSampleCountRecoveryStatus.status === ownerSampleCountRecovery.status, "owner sample count recovery compact status must match full JSON");
assert(ownerSampleCountRecoveryStatus.owner_preview_rows === ownerSampleCountRecovery.owner_preview_rows, "owner sample count recovery compact preview rows must match full JSON");
assert(ownerSampleCountRecoveryStatus.full_p0_row_count === ownerSampleCountRecovery.full_p0_row_count, "owner sample count recovery compact full P0 rows must match full JSON");
assert(ownerSampleCountRecoveryStatus.full_p0_intake_status === ownerSampleCountRecovery.full_p0_intake_status, "owner sample count recovery compact full P0 intake status must match full JSON");
assertNoRedLineFlags(ownerSampleCountRecoveryStatus, "owner sample count recovery compact status");
assert(ownerSampleCountRecoveryReport.includes("Owner Sample Count Recovery"), "owner sample count recovery report must have title");
assert(ownerSampleCountRecoveryReport.includes("Recovery Chain"), "owner sample count recovery report must include recovery chain");
assert(ownerSampleCountRecoveryReport.includes("Full P0 Recovery Chain"), "owner sample count recovery report must include full P0 recovery chain");
assert(ownerSampleCountRecoveryReport.includes("Full P0 After Commands"), "owner sample count recovery report must include full P0 after commands");
assert(ownerSampleCountRecoveryReport.includes("data/lp_events.jsonl write performed: no"), "owner sample count recovery report must state no event write");
assert(ownerSampleCountRecoveryReport.includes("GitHub push / PR performed: no"), "owner sample count recovery report must state no GitHub push or PR");
assert(ownerSampleCountRecoveryFixturesSource.includes("OWNER_SAMPLE_COUNT_RECOVERY_ROOT"), "owner sample count recovery fixtures must use temporary root override");
assert(ownerSampleCountRecoveryFixturesSource.includes("red_line_violation_blocks_recovery"), "owner sample count recovery fixtures must cover red-line violation blocking");
assert(ownerSampleCountRecoveryFixture.ok === true, "owner sample count recovery fixtures must be ok");
assert(ownerSampleCountRecoveryFixture.mode === "owner_sample_count_recovery_fixture_dry_run", "owner sample count recovery fixtures mode must match");
assert(ownerSampleCountRecoveryFixture.scenario_count === 9, "owner sample count recovery fixtures must cover nine scenarios");
for (const expectedScenario of [
  "waiting_without_owner_counts",
  "quick_preview_ready_prompts_intake",
  "focused_intake_ready_prompts_preflight",
  "full_p0_intake_ready_prompts_owner_reviewed_stage",
  "full_p0_owner_reviewed_stage_prompts_sample_gate",
  "preflight_sample_insufficient_keeps_collecting",
  "sample_ready_no_auto_promotion",
  "win_rule_requires_owner_review",
  "red_line_violation_blocks_recovery",
]) {
  assert(ownerSampleCountRecoveryFixture.scenarios.some((scenario) => scenario.id === expectedScenario && scenario.ok === true), `owner sample count recovery fixtures missing passing scenario ${expectedScenario}`);
}
assert(ownerSampleCountRecoveryFixture.live_project_write_performed === false, "owner sample count recovery fixtures must not write project files");
assert(ownerSampleCountRecoveryFixture.data_lp_events_write_performed === false, "owner sample count recovery fixtures must not write data/lp_events.jsonl");
assert(ownerSampleCountRecoveryFixture.github_push_or_pr_performed === false, "owner sample count recovery fixtures must not push GitHub or create PR");
assert(ownerSampleCountRecoveryFixture.production_deploy_performed === false, "owner sample count recovery fixtures must not deploy");
assert(ownerSampleCountRecoveryFixture.formal_post_performed === false, "owner sample count recovery fixtures must not formally post");
assert(ownerSampleCountRecoveryFixture.line_push_performed === false, "owner sample count recovery fixtures must not push LINE");
assert(ownerSampleCountRecoveryFixture.customer_data_mutation_performed === false, "owner sample count recovery fixtures must not mutate customer data");
assert(ownerSampleCountRecoveryFixture.payment_action_performed === false, "owner sample count recovery fixtures must not touch payments");
assert(ownerSampleCountRecoveryFixture.delete_action_performed === false, "owner sample count recovery fixtures must not delete data");
assert(ownerSampleCountRecoveryFixture.external_effect === false, "owner sample count recovery fixtures must not create external effects");
assert(ownerSampleCountRecoveryFixtureReport.includes("Owner Sample Count Recovery Fixture Report"), "owner sample count recovery fixture report must have title");
assert(ownerSampleCountRecoveryFixtureReport.includes("owner_sample_count_recovery_fixtures_ok"), "owner sample count recovery fixture report must state fixtures ok");
assert(ownerSampleCountRecoveryFixtureReport.includes("red_line_violation_blocks_recovery"), "owner sample count recovery fixture report must include red-line scenario");
assert(ownerSampleCountRecoveryFixtureReport.includes("data/lp_events.jsonl write performed: no"), "owner sample count recovery fixture report must state no event write");
assert(ownerP0LauncherSource.includes("owner_p0_launcher"), "owner P0 launcher source must keep launcher mode");
assert(ownerP0LauncherSource.includes("data/owner_p0_now_status.json"), "owner P0 launcher source must read owner P0-now status");
assert(ownerP0LauncherSource.includes("data/p0_counts_preflight_status.json"), "owner P0 launcher source must read P0 counts preflight status");
assert(ownerP0LauncherSource.includes("data/sample_gate_due_status_status.json"), "owner P0 launcher source must read sample-gate due status");
assert(ownerP0LauncherSource.includes("data/sample_gate_collection_sprint_status.json"), "owner P0 launcher source must read collection sprint status");
assert(ownerP0LauncherSource.includes("data/owner_sample_count_recovery_status.json"), "owner P0 launcher source must read sample-count recovery status");
assert(ownerP0LauncherStatus.ok === true, "owner P0 launcher status must be ok");
assert(ownerP0LauncherStatus.mode === "owner_p0_launcher", "owner P0 launcher mode must match");
assert(ownerP0LauncherStatus.target_count === 13, "owner P0 launcher must open thirteen local targets");
assert(ownerP0LauncherStatus.missing_targets.length === 0, "owner P0 launcher must not have missing targets");
assert(ownerP0LauncherStatus.owner_p0_now_status === ownerP0NowStatus.status, "owner P0 launcher must expose P0-now status");
assert(ownerP0LauncherStatus.owner_p0_now_focused_missing_count === ownerP0NowStatus.p0_focused_missing_count, "owner P0 launcher must expose focused missing count");
assert(ownerP0LauncherStatus.owner_p0_now_focused_total_count === ownerP0NowStatus.p0_focused_total_count, "owner P0 launcher must expose focused total count");
assert(ownerP0LauncherStatus.owner_p0_now_full_row_count === ownerP0NowStatus.p0_full_row_count, "owner P0 launcher must expose full P0 row count");
assert(ownerP0LauncherStatus.owner_p0_now_full_task_count === ownerP0NowStatus.p0_full_task_count, "owner P0 launcher must expose full P0 task count");
assert(ownerP0LauncherStatus.owner_p0_now_copy_block_count === ownerP0NowStatus.copy_block_count, "owner P0 launcher must expose P0 copy block count");
assert(ownerP0LauncherStatus.owner_p0_now_copy_block_line_count === ownerP0NowStatus.copy_block_line_count, "owner P0 launcher must expose P0 copy block line count");
assert(ownerP0LauncherStatus.quick_capture_status === nextP0QuickCapture.status, "owner P0 launcher must expose quick capture status");
assert(ownerP0LauncherStatus.quick_capture_filled_rank_count === nextP0QuickCapture.filled_rank_count, "owner P0 launcher must expose quick filled rank count");
assert(ownerP0LauncherStatus.quick_capture_missing_rank_count === nextP0QuickCapture.missing_rank_count, "owner P0 launcher must expose quick missing rank count");
assert(ownerP0LauncherStatus.p0_counts_preflight_status === p0CountsPreflightStatus.status, "owner P0 launcher must expose P0 preflight status");
assert(ownerP0LauncherStatus.p0_counts_preflight_ready_for_quick_preview === p0CountsPreflightStatus.ready_for_quick_preview, "owner P0 launcher must expose P0 preflight readiness");
assert(ownerP0LauncherStatus.p0_counts_preflight_filled_count_key_count === p0CountsPreflightStatus.filled_count_key_count, "owner P0 launcher must expose P0 preflight filled count");
assert(ownerP0LauncherStatus.p0_counts_preflight_expected_count_key_count === p0CountsPreflightStatus.expected_count_key_count, "owner P0 launcher must expose P0 preflight expected count");
assert(ownerP0LauncherStatus.sample_gate_batch_handoff_status === sampleGateBatchHandoffStatus.status, "owner P0 launcher must expose sample gate batch status");
assert(ownerP0LauncherStatus.sample_gate_batch_handoff_focused_batch_row_count === sampleGateBatchHandoffStatus.focused_batch_row_count, "owner P0 launcher must expose sample gate focused batch row count");
assert(ownerP0LauncherStatus.sample_gate_batch_handoff_remaining_batch_row_count === sampleGateBatchHandoffStatus.remaining_batch_row_count, "owner P0 launcher must expose sample gate remaining batch row count");
assert(ownerP0LauncherStatus.sample_gate_collection_sprint_status === sampleGateCollectionSprintStatus.status, "owner P0 launcher must expose collection sprint status");
assert(ownerP0LauncherStatus.sample_gate_collection_sprint_p0_pending_count === sampleGateCollectionSprintStatus.p0_pending_count, "owner P0 launcher must expose collection sprint pending count");
assert(ownerP0LauncherStatus.owner_sample_count_handoff_status === ownerSampleCountHandoffStatus.status, "owner P0 launcher must expose sample count handoff status");
assert(ownerP0LauncherStatus.owner_sample_count_recovery_status === ownerSampleCountRecoveryStatus.status, "owner P0 launcher must expose sample count recovery status");
assert(ownerP0LauncherStatus.owner_sample_count_recovery_full_p0_row_count === ownerSampleCountRecoveryStatus.full_p0_row_count, "owner P0 launcher must expose sample count recovery full P0 row count");
assert(ownerP0LauncherStatus.owner_sample_count_recovery_full_p0_intake_ready === ownerSampleCountRecoveryStatus.full_p0_intake_ready, "owner P0 launcher must expose sample count recovery full P0 intake readiness");
assert(ownerP0LauncherStatus.sample_gate_due_status === sampleGateDueStatus.status, "owner P0 launcher must expose sample gate due status");
assert(ownerP0LauncherStatus.sample_gate_due_now === sampleGateDueStatus.due_now, "owner P0 launcher must expose sample gate due-now flag");
assert(ownerP0LauncherStatus.approval_queue_status === approvalStatus.status, "owner P0 launcher must expose approval queue status");
assert(ownerP0LauncherStatus.command_opens_local_files_only === true, "owner P0 launcher must open local files only");
assert(ownerP0LauncherStatus.opens_external_urls === false, "owner P0 launcher must not open external URLs");
assert(ownerP0LauncherStatus.network_calls_performed === false, "owner P0 launcher must not perform network calls");
assert(ownerP0LauncherStatus.browser_persistence === false, "owner P0 launcher must not use browser persistence");
assert(ownerP0LauncherStatus.live_input_files_created === false, "owner P0 launcher must not create live input files");
assertNoRedLineFlags(ownerP0LauncherStatus, "owner P0 launcher status");
assert(ownerP0LauncherStatus.targets.every((target) => target.exists === true && !/^https?:\/\//.test(target.path)), "owner P0 launcher targets must exist and stay local");
for (const expectedTarget of [
  "owner_p0_now.html",
  "owner_p0_now.md",
  "sample_gate_batch_handoff.md",
  "sample_gate_collection_sprint.md",
  "sample_gate_batch_1_paste_block.txt",
  "sample_gate_batch_2_paste_block.txt",
  "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
  "p0_counts_preflight.md",
  "sample_gate_owner_form.html",
  "owner_sample_gate_intake.md",
  "owner_sample_count_handoff.md",
  "owner_sample_count_recovery.md",
  "sample_gate_due_status.md",
]) {
  assert(ownerP0LauncherStatus.targets.some((target) => target.path === expectedTarget), `owner P0 launcher missing target ${expectedTarget}`);
  assert(ownerP0LauncherCommand.includes(`open "$ROOT/${expectedTarget}"`), `owner P0 launcher command must open ${expectedTarget}`);
}
const ownerP0LauncherStat = await stat(path.join(ROOT, "OPEN-P0-SAMPLE-GATE.command"));
assert((ownerP0LauncherStat.mode & 0o111) !== 0, "owner P0 launcher command must be executable");
assert(ownerP0LauncherCommand.startsWith("#!/bin/zsh"), "owner P0 launcher command must be zsh executable");
assert(!/https?:\/\//.test(ownerP0LauncherCommand), "owner P0 launcher command must not include external URLs");
assert(!/\b(curl|wget|wrangler|git|gh|npm|node)\b/.test(ownerP0LauncherCommand), "owner P0 launcher command must not run network, deploy, GitHub, npm, or node commands");
assert(!/rm\s+-|trash|delete|launchctl|osascript/i.test(ownerP0LauncherCommand), "owner P0 launcher command must not delete, alter launchd, or automate UI");
assert(ownerP0LauncherCommand.includes("P0 sample-gate files"), "owner P0 launcher command must identify sample-gate files");
assert(ownerP0LauncherCommand.includes("Due status:"), "owner P0 launcher command must print due status");
assert(ownerP0LauncherCommand.includes("P0 now:"), "owner P0 launcher command must print P0-now status");
assert(ownerP0LauncherCommand.includes("Copy blocks:"), "owner P0 launcher command must print copy block counts");
assert(ownerP0LauncherCommand.includes("Quick count progress:"), "owner P0 launcher command must print quick count progress");
assert(ownerP0LauncherCommand.includes("P0 counts preflight:"), "owner P0 launcher command must print preflight status");
assert(ownerP0LauncherCommand.includes("Full P0 form/intake:"), "owner P0 launcher command must print full P0 form/intake status");
assert(ownerP0LauncherCommand.includes("Collection sprint:"), "owner P0 launcher command must print collection sprint status");
assert(ownerP0LauncherCommand.includes("Sample count recovery:"), "owner P0 launcher command must print sample count recovery status");
assert(ownerP0LauncherCommand.includes("owner_sample_count_handoff.md"), "owner P0 launcher command must point after-fill handling to sample count handoff");
assert(ownerP0LauncherReport.includes("3Q Growth Loop P0 Sample-Gate Launcher"), "owner P0 launcher report must have title");
assert(ownerP0LauncherReport.includes("P0 now:"), "owner P0 launcher report must include P0-now status");
assert(ownerP0LauncherReport.includes("Quick count progress:"), "owner P0 launcher report must include quick count progress");
assert(ownerP0LauncherReport.includes("P0 counts preflight:"), "owner P0 launcher report must include P0 counts preflight");
assert(ownerP0LauncherReport.includes("Full P0 form/intake:"), "owner P0 launcher report must include full P0 form/intake");
assert(ownerP0LauncherReport.includes("Collection sprint:"), "owner P0 launcher report must include collection sprint status");
assert(ownerP0LauncherReport.includes("Opens local files only: yes"), "owner P0 launcher report must state local-only behavior");
assert(ownerP0LauncherReport.includes("External URLs: no"), "owner P0 launcher report must state no external URLs");
assert(ownerP0LauncherReport.includes("GitHub push / PR: no"), "owner P0 launcher report must state no GitHub push or PR");
assert(ownerP0LauncherReport.includes("sample_gate_batch_1_paste_block.txt"), "owner P0 launcher report must include batch 1 paste block");
assert(ownerP0LauncherReport.includes("sample_gate_batch_2_paste_block.txt"), "owner P0 launcher report must include batch 2 paste block");
assert(ownerP0LauncherReport.includes("next_p0_owner_inputs.counts-paste-template.txt"), "owner P0 launcher report must include focused paste template");
assert(ownerP0PostfillCheckSource.includes("owner_p0_postfill_check_local_only"), "owner P0 post-fill checker source must keep local-only mode");
assert(ownerP0PostfillCheckSource.includes("RUN-P0-POST-FILL-CHECK.command"), "owner P0 post-fill checker source must generate command file");
assert(ownerP0PostfillCheckSource.includes("data/owner_sample_count_recovery_status.json"), "owner P0 post-fill checker source must read sample count recovery status");
assert(ownerP0PostfillCheckSource.includes("data/p0_counts_preflight_status.json"), "owner P0 post-fill checker source must read P0 preflight status");
assert(ownerP0PostfillCheckSource.includes("data/source_trust_matrix_status.json"), "owner P0 post-fill checker source must read source trust status");
assert(ownerP0PostfillCheck.ok === true, "owner P0 post-fill check must be ok");
assert(ownerP0PostfillCheck.mode === "owner_p0_postfill_check_local_only", "owner P0 post-fill check mode must match");
assert(ownerP0PostfillCheckStatus.mode === ownerP0PostfillCheck.mode, "owner P0 post-fill compact mode must match");
assert(ownerP0PostfillCheckStatus.status === ownerP0PostfillCheck.status, "owner P0 post-fill compact status must match full JSON");
assert(ownerP0PostfillCheckStatus.current_stage === ownerP0PostfillCheck.current_stage, "owner P0 post-fill compact stage must match");
assert(ownerP0PostfillCheckStatus.safe_command_count === ownerP0PostfillCheck.safe_commands.length, "owner P0 post-fill compact command count must match full JSON");
assert(ownerP0PostfillCheck.safe_command_count === ownerP0PostfillCheck.safe_commands.length, "owner P0 post-fill command count must match command list");
assert(ownerP0PostfillCheck.sample_count_recovery_status === ownerSampleCountRecoveryStatus.status, "owner P0 post-fill check must expose sample count recovery status");
assert(ownerP0PostfillCheck.p0_counts_preflight_status === p0CountsPreflightStatus.status, "owner P0 post-fill check must expose P0 preflight status");
assert(ownerP0PostfillCheck.next_p0_quick_status === nextP0QuickCapture.status, "owner P0 post-fill check must expose quick capture status");
assert(ownerP0PostfillCheck.next_p0_intake_status === nextP0OwnerIntake.status, "owner P0 post-fill check must expose focused intake status");
assert(ownerP0PostfillCheck.owner_data_preflight_status === ownerDataPreflight.status, "owner P0 post-fill check must expose owner data preflight status");
assert(ownerP0PostfillCheck.owner_sample_gate_status === ownerSampleGate.status, "owner P0 post-fill check must expose owner sample-gate status");
assert(ownerP0PostfillCheck.source_trust_status === sourceTrustMatrixStatus.status, "owner P0 post-fill check must expose source trust status");
assert(ownerP0PostfillCheck.source_trust_trusted_scoring_source_count === sourceTrustMatrixStatus.trusted_scoring_source_count, "owner P0 post-fill check trusted source count must match source trust");
assert(ownerP0PostfillCheck.source_trust_sample_gate_source_count === sourceTrustMatrixStatus.sample_gate_source_count, "owner P0 post-fill check sample-gate source count must match source trust");
assert(ownerP0PostfillCheck.source_trust_scoring_allowed_now === sourceTrustMatrixStatus.scoring_allowed_now, "owner P0 post-fill check scoring flag must match source trust");
assert(ownerP0PostfillCheck.source_trust_data_lp_events_write_performed === false, "owner P0 post-fill check source trust must not write events");
assert(ownerP0PostfillCheck.source_trust_external_effect === false, "owner P0 post-fill check source trust must not claim external effects");
assert(ownerP0PostfillCheckStatus.source_trust_status === sourceTrustMatrixStatus.status, "owner P0 post-fill compact status must expose source trust status");
assert(ownerP0PostfillCheckStatus.source_trust_trusted_scoring_source_count === sourceTrustMatrixStatus.trusted_scoring_source_count, "owner P0 post-fill compact trusted source count must match source trust");
assert(ownerP0PostfillCheckStatus.source_trust_sample_gate_source_count === sourceTrustMatrixStatus.sample_gate_source_count, "owner P0 post-fill compact sample-gate source count must match source trust");
assert(ownerP0PostfillCheckStatus.source_trust_scoring_allowed_now === sourceTrustMatrixStatus.scoring_allowed_now, "owner P0 post-fill compact scoring flag must match source trust");
assert(ownerP0PostfillCheck.approval_queue_status === approvalStatus.status, "owner P0 post-fill check must expose approval queue status");
assert(ownerP0PostfillCheck.command_runs_local_scripts_only === true, "owner P0 post-fill command must run local scripts only");
assert(ownerP0PostfillCheck.command_has_external_url === false, "owner P0 post-fill command must not include external URLs");
assert(ownerP0PostfillCheck.command_has_forbidden_remote_cli === false, "owner P0 post-fill command must not include remote CLI");
assert(ownerP0PostfillCheck.command_has_forbidden_git_cli === false, "owner P0 post-fill command must not include GitHub CLI");
assert(ownerP0PostfillCheck.command_has_apply_or_stage_flags === false, "owner P0 post-fill command must not include apply or stage flags");
assert(ownerP0PostfillCheck.command_has_delete_or_launchd_action === false, "owner P0 post-fill command must not include delete or launchd actions");
assertNoRedLineFlags(ownerP0PostfillCheck, "owner P0 post-fill check");
assertNoRedLineFlags(ownerP0PostfillCheckStatus, "owner P0 post-fill check status");
const ownerP0PostfillExpectedScripts = [
  "p0:counts-preflight",
  "next-p0:quick",
  "next-p0:intake",
  "owner:intake",
  "owner:data-preflight",
  "data:progress",
  "owner:sample-gate",
  "source:trust",
  "owner:sample-count-recovery",
  "owner:next-action",
  "sample-gate:recovery",
  "owner:p0-now",
  "owner:p0-launcher",
  "weekly:local",
];
for (const expectedScript of ownerP0PostfillExpectedScripts) {
  assert(packageJson.scripts[expectedScript], `owner P0 post-fill expected package script missing ${expectedScript}`);
  assert(ownerP0PostfillCheck.safe_command_scripts.includes(expectedScript), `owner P0 post-fill status missing safe script ${expectedScript}`);
  assert(ownerP0PostfillCheckCommand.includes(`run_step npm run ${expectedScript}`), `owner P0 post-fill command must run safe script ${expectedScript}`);
}
assert(ownerP0PostfillCheck.safe_command_scripts.length === ownerP0PostfillExpectedScripts.length, "owner P0 post-fill script whitelist size must match expected scripts");
const ownerP0PostfillStat = await stat(path.join(ROOT, "RUN-P0-POST-FILL-CHECK.command"));
assert((ownerP0PostfillStat.mode & 0o111) !== 0, "owner P0 post-fill command must be executable");
assert(ownerP0PostfillCheckCommand.startsWith("#!/bin/zsh"), "owner P0 post-fill command must be zsh executable");
assert(!/https?:\/\//.test(ownerP0PostfillCheckCommand), "owner P0 post-fill command must not include external URLs");
assert(!/\b(curl|wget|wrangler|git|gh)\b/i.test(ownerP0PostfillCheckCommand), "owner P0 post-fill command must not run network, deploy, or GitHub commands");
assert(!/--stage|--apply|--confirm-owner-reviewed|collect:d1:remote:approved|import:funnel:apply|import:manual:apply/.test(ownerP0PostfillCheckCommand), "owner P0 post-fill command must not include stage/apply/remote apply commands");
assert(!/rm\s+-|trash|launchctl|osascript/i.test(ownerP0PostfillCheckCommand), "owner P0 post-fill command must not delete, alter launchd, or automate UI");
assert(ownerP0PostfillCheckReport.includes("3Q Growth Loop P0 Post-Fill Local Check"), "owner P0 post-fill report must have title");
assert(ownerP0PostfillCheckReport.includes("Safe Command Sequence"), "owner P0 post-fill report must include safe command sequence");
assert(ownerP0PostfillCheckReport.includes("Source trust:"), "owner P0 post-fill report must include source trust status");
assert(ownerP0PostfillCheckReport.includes(`trusted=${sourceTrustMatrixStatus.trusted_scoring_source_count}`), "owner P0 post-fill report must include source trust trusted count");
assert(ownerP0PostfillCheckCommand.includes("source_trust_matrix.md"), "owner P0 post-fill command must point to source trust review");
assert(ownerP0PostfillCheckReport.includes("data/lp_events.jsonl write performed: no"), "owner P0 post-fill report must state no event write");
assert(ownerP0PostfillCheckReport.includes("GitHub push / PR: no"), "owner P0 post-fill report must state no GitHub push or PR");
assert(ownerActionLauncherSource.includes("owner_action_launcher"), "owner action launcher source must keep launcher mode");
assert(ownerActionLauncherSource.includes("data/approval_queue_status.json"), "owner action launcher source must read approval queue compact status");
assert(ownerActionLauncherSource.includes("data/owner_p0_now_status.json"), "owner action launcher source must read owner P0-now status");
assert(ownerActionLauncherSource.includes("data/p0_counts_preflight_status.json"), "owner action launcher source must read P0 counts preflight status");
assert(ownerActionLauncherSource.includes("data/owner_sample_count_recovery_status.json"), "owner action launcher source must read sample count recovery compact status");
assert(ownerActionLauncherSource.includes("data/owner_p0_postfill_check_status.json"), "owner action launcher source must read P0 post-fill compact status");
assert(ownerActionLauncherSource.includes("data/source_trust_matrix_status.json"), "owner action launcher source must read source trust compact status");
assert(ownerActionLauncherSource.includes("data/worker_dry_run_status.json"), "owner action launcher source must read Worker dry-run compact status");
assert(ownerActionLauncherSource.includes("data/north_star_outcome_preflight_status.json"), "owner action launcher source must read North Star outcome preflight compact status");
assert(ownerActionLauncherSource.includes("data/north_star_outcome_form_status.json"), "owner action launcher source must read North Star outcome form compact status");
assert(ownerActionLauncherSource.includes("data/north_star_outcome_form_fixture_status.json"), "owner action launcher source must read North Star outcome form fixture status");
assert(ownerActionLauncherSource.includes("data/owner_p1_outcome_intake_status.json"), "owner action launcher source must read P1 outcome intake compact status");
assert(ownerActionLauncherSource.includes("data/owner_p1_outcome_postfill_check_status.json"), "owner action launcher source must read P1 outcome post-fill compact status");
assert(ownerActionLauncherSource.includes("data/sample_gate_batch_preflight_status.json"), "owner action launcher source must read sample gate batch preflight compact status");
assert(ownerActionLauncherSource.includes("data/sample_gate_collection_sprint_status.json"), "owner action launcher source must read collection sprint compact status");
assert(ownerActionLauncherStatus.ok === true, "owner action launcher status must be ok");
assert(ownerActionLauncherStatus.mode === "owner_action_launcher", "owner action launcher mode must match");
assert(ownerActionLauncherStatus.target_count === 48, "owner action launcher must open forty-eight local targets");
assert(ownerActionLauncherStatus.missing_targets.length === 0, "owner action launcher must not have missing targets");
assert(ownerActionLauncherStatus.primary_action_command === ownerNextActionStatus.primary_action_command, "owner action launcher must expose current primary action command in status");
assert(ownerActionLauncherStatus.owner_p0_now_status === ownerP0NowStatus.status, "owner action launcher must expose owner P0-now status");
assert(ownerActionLauncherStatus.owner_p0_now_p0_focused_missing_count === ownerP0NowStatus.p0_focused_missing_count, "owner action launcher must expose P0-now focused missing count");
assert(ownerActionLauncherStatus.owner_p0_now_p0_focused_total_count === ownerP0NowStatus.p0_focused_total_count, "owner action launcher must expose P0-now focused total count");
assert(ownerActionLauncherStatus.owner_p0_now_p0_full_row_count === ownerP0NowStatus.p0_full_row_count, "owner action launcher must expose P0-now full row count");
assert(ownerActionLauncherStatus.owner_p0_now_p0_full_task_count === ownerP0NowStatus.p0_full_task_count, "owner action launcher must expose P0-now full task count");
assert(ownerActionLauncherStatus.owner_p0_now_primary_open_target_count === ownerP0NowStatus.primary_open_target_count, "owner action launcher must expose P0-now open target count");
assert(ownerActionLauncherStatus.owner_p0_now_sample_gate_form_status === ownerP0NowStatus.sample_gate_form_status, "owner action launcher must expose P0-now full form status");
assert(ownerActionLauncherStatus.owner_p0_now_sample_gate_form_row_count === ownerP0NowStatus.sample_gate_form_row_count, "owner action launcher must expose P0-now full form row count");
assert(ownerActionLauncherStatus.owner_p0_now_sample_gate_intake_status === ownerP0NowStatus.sample_gate_intake_status, "owner action launcher must expose P0-now full intake status");
assert(ownerActionLauncherStatus.owner_p0_now_sample_gate_intake_candidate_found === ownerP0NowStatus.sample_gate_intake_candidate_found, "owner action launcher must expose P0-now full intake candidate flag");
assert(ownerActionLauncherStatus.owner_p0_now_sample_gate_intake_stage_performed === ownerP0NowStatus.sample_gate_intake_stage_performed, "owner action launcher must expose P0-now full intake stage flag");
assert(ownerActionLauncherStatus.next_p0_quick_capture_status === nextP0QuickCapture.status, "owner action launcher must expose next P0 quick capture status");
assert(ownerActionLauncherStatus.next_p0_quick_capture_filled_rank_count === nextP0QuickCapture.filled_rank_count, "owner action launcher must expose quick filled rank count");
assert(ownerActionLauncherStatus.next_p0_quick_capture_missing_rank_count === nextP0QuickCapture.missing_rank_count, "owner action launcher must expose quick missing rank count");
assert(ownerActionLauncherStatus.next_p0_quick_capture_partial_waiting === nextP0QuickCapture.partial_waiting, "owner action launcher must expose quick partial state");
assert(ownerActionLauncherStatus.p0_counts_preflight_status === p0CountsPreflightStatus.status, "owner action launcher must expose P0 counts preflight status");
assert(ownerActionLauncherStatus.p0_counts_preflight_ready_for_quick_preview === p0CountsPreflightStatus.ready_for_quick_preview, "owner action launcher must expose P0 counts preflight readiness");
assert(ownerActionLauncherStatus.p0_counts_preflight_filled_count_key_count === p0CountsPreflightStatus.filled_count_key_count, "owner action launcher must expose P0 counts preflight filled count");
assert(ownerActionLauncherStatus.p0_counts_preflight_expected_count_key_count === p0CountsPreflightStatus.expected_count_key_count, "owner action launcher must expose P0 counts preflight expected count");
assert(ownerActionLauncherStatus.p0_counts_preflight_placeholder_count_key_count === p0CountsPreflightStatus.placeholder_count_key_count, "owner action launcher must expose P0 counts preflight placeholder count");
assert(ownerActionLauncherStatus.p0_counts_preflight_issue_count === p0CountsPreflightStatus.issue_count, "owner action launcher must expose P0 counts preflight issue count");
assert(ownerActionLauncherStatus.north_star_outcome_preflight_status === northStarOutcomePreflightStatus.status, "owner action launcher must expose North Star outcome preflight status");
assert(ownerActionLauncherStatus.north_star_outcome_preflight_input_kind === northStarOutcomePreflightStatus.input_kind, "owner action launcher must expose North Star outcome preflight input kind");
assert(ownerActionLauncherStatus.north_star_outcome_preflight_filled_outcome_row_count === northStarOutcomePreflightStatus.filled_outcome_row_count, "owner action launcher must expose North Star outcome preflight filled count");
assert(ownerActionLauncherStatus.north_star_outcome_preflight_pending_outcome_row_count === northStarOutcomePreflightStatus.pending_outcome_row_count, "owner action launcher must expose North Star outcome preflight pending count");
assert(ownerActionLauncherStatus.north_star_outcome_preflight_invalid_outcome_row_count === northStarOutcomePreflightStatus.invalid_outcome_row_count, "owner action launcher must expose North Star outcome preflight invalid count");
assert(ownerActionLauncherStatus.north_star_outcome_preflight_ready_for_source_compile === northStarOutcomePreflightStatus.ready_for_source_compile, "owner action launcher must expose North Star outcome preflight compile readiness");
assert(ownerActionLauncherStatus.north_star_outcome_preflight_external_effect === northStarOutcomePreflightStatus.external_effect, "owner action launcher must expose North Star outcome preflight no external effect");
assert(ownerActionLauncherStatus.north_star_outcome_preflight_data_lp_events_write_performed === northStarOutcomePreflightStatus.data_lp_events_write_performed, "owner action launcher must expose North Star outcome preflight no event write");
assert(ownerActionLauncherStatus.north_star_outcome_form_status === northStarOutcomeFormStatus.status, "owner action launcher must expose North Star outcome form status");
assert(ownerActionLauncherStatus.north_star_outcome_form_row_count === northStarOutcomeFormStatus.row_count, "owner action launcher must expose North Star outcome form row count");
assert(ownerActionLauncherStatus.north_star_outcome_form_browser_only === northStarOutcomeFormStatus.browser_only, "owner action launcher must expose North Star outcome form browser-only flag");
assert(ownerActionLauncherStatus.north_star_outcome_form_network_calls_performed === northStarOutcomeFormStatus.network_calls_performed, "owner action launcher must expose North Star outcome form network flag");
assert(ownerActionLauncherStatus.north_star_outcome_form_data_lp_events_write_performed === northStarOutcomeFormStatus.data_lp_events_write_performed, "owner action launcher must expose North Star outcome form event write flag");
assert(ownerActionLauncherStatus.north_star_outcome_form_external_effect === northStarOutcomeFormStatus.external_effect, "owner action launcher must expose North Star outcome form external effect flag");
assert(ownerActionLauncherStatus.north_star_outcome_form_guard_ok === northStarOutcomeFormFixture.ok, "owner action launcher must expose North Star outcome form guard status");
assert(ownerActionLauncherStatus.north_star_outcome_form_guard_check_count === northStarOutcomeFormFixture.check_count, "owner action launcher must expose North Star outcome form guard check count");
assert(ownerActionLauncherStatus.north_star_outcome_form_guard_external_effect === northStarOutcomeFormFixture.external_effect, "owner action launcher must expose North Star outcome form guard external effect flag");
assert(ownerActionLauncherStatus.owner_p1_outcome_intake_status === ownerP1OutcomeIntakeStatus.status, "owner action launcher must expose P1 outcome intake status");
assert(ownerActionLauncherStatus.owner_p1_outcome_intake_candidate_found === ownerP1OutcomeIntakeStatus.candidate_found, "owner action launcher must expose P1 outcome intake candidate flag");
assert(ownerActionLauncherStatus.owner_p1_outcome_intake_candidate_valid === ownerP1OutcomeIntakeStatus.candidate_valid, "owner action launcher must expose P1 outcome intake valid flag");
assert(ownerActionLauncherStatus.owner_p1_outcome_intake_preflight_ready_for_source_compile === ownerP1OutcomeIntakeStatus.preflight_ready_for_source_compile, "owner action launcher must expose P1 outcome intake readiness");
assert(ownerActionLauncherStatus.owner_p1_outcome_intake_filled_outcome_row_count === ownerP1OutcomeIntakeStatus.filled_outcome_row_count, "owner action launcher must expose P1 outcome intake filled rows");
assert(ownerActionLauncherStatus.owner_p1_outcome_intake_pending_outcome_row_count === ownerP1OutcomeIntakeStatus.pending_outcome_row_count, "owner action launcher must expose P1 outcome intake pending rows");
assert(ownerActionLauncherStatus.owner_p1_outcome_intake_stage_performed === ownerP1OutcomeIntakeStatus.stage_performed, "owner action launcher must expose P1 outcome intake stage flag");
assert(ownerActionLauncherStatus.owner_p1_outcome_intake_external_effect === ownerP1OutcomeIntakeStatus.external_effect, "owner action launcher must expose P1 outcome intake external effect flag");
assert(ownerActionLauncherStatus.owner_p1_outcome_intake_data_lp_events_write_performed === ownerP1OutcomeIntakeStatus.data_lp_events_write_performed, "owner action launcher must expose P1 outcome intake event write flag");
assert(ownerActionLauncherStatus.owner_p1_outcome_postfill_check_status === ownerP1OutcomePostfillCheckStatus.status, "owner action launcher must expose P1 outcome post-fill status");
assert(ownerActionLauncherStatus.owner_p1_outcome_postfill_check_current_stage === ownerP1OutcomePostfillCheckStatus.current_stage, "owner action launcher must expose P1 outcome post-fill stage");
assert(ownerActionLauncherStatus.owner_p1_outcome_postfill_check_postfill_ready === ownerP1OutcomePostfillCheckStatus.postfill_ready, "owner action launcher must expose P1 outcome post-fill readiness");
assert(ownerActionLauncherStatus.owner_p1_outcome_postfill_check_expected_to_advance_now === ownerP1OutcomePostfillCheckStatus.expected_to_advance_now, "owner action launcher must expose P1 outcome post-fill expected advance flag");
assert(ownerActionLauncherStatus.owner_p1_outcome_postfill_check_safe_command_count === ownerP1OutcomePostfillCheckStatus.safe_command_count, "owner action launcher must expose P1 outcome post-fill safe command count");
assert(ownerActionLauncherStatus.owner_p1_outcome_postfill_check_command_runs_local_scripts_only === ownerP1OutcomePostfillCheckStatus.command_runs_local_scripts_only, "owner action launcher must expose P1 outcome post-fill local-only command policy");
assert(ownerActionLauncherStatus.owner_p1_outcome_postfill_check_external_effect === ownerP1OutcomePostfillCheckStatus.external_effect, "owner action launcher must expose P1 outcome post-fill external effect flag");
assert(ownerActionLauncherStatus.owner_p1_outcome_postfill_check_data_lp_events_write_performed === ownerP1OutcomePostfillCheckStatus.data_lp_events_write_performed, "owner action launcher must expose P1 outcome post-fill event write flag");
assert(ownerActionLauncherStatus.owner_sample_count_handoff_after_fill_command_count === ownerSampleCountHandoffStatus.after_fill_command_count, "owner action launcher must expose sample count handoff after-fill command count");
assert(ownerActionLauncherStatus.owner_sample_count_handoff_after_fill_command_count === ownerSampleCountHandoff.after_fill_commands.length, "owner action launcher handoff count must match full handoff commands");
assert(ownerActionLauncherStatus.owner_sample_count_handoff_paste_block_path === ownerSampleCountHandoffStatus.paste_block_path, "owner action launcher must expose sample count paste block path");
assert(ownerActionLauncherStatus.owner_sample_count_handoff_paste_key_count === ownerSampleCountHandoffStatus.paste_key_count, "owner action launcher must expose sample count paste key count");
assert(ownerActionLauncherStatus.owner_sample_count_handoff_paste_block_line_count === ownerSampleCountHandoffStatus.paste_block_line_count, "owner action launcher must expose sample count paste block line count");
assert(ownerActionLauncherStatus.owner_sample_count_recovery_status === ownerSampleCountRecoveryStatus.status, "owner action launcher must expose sample count recovery status");
assert(ownerActionLauncherStatus.owner_sample_count_recovery_full_p0_row_count === ownerSampleCountRecoveryStatus.full_p0_row_count, "owner action launcher must expose sample count recovery full P0 rows");
assert(ownerActionLauncherStatus.owner_sample_count_recovery_full_p0_pending_count === ownerSampleCountRecoveryStatus.full_p0_pending_count, "owner action launcher must expose sample count recovery full P0 pending rows");
assert(ownerActionLauncherStatus.owner_sample_count_recovery_full_p0_form_status === ownerSampleCountRecoveryStatus.full_p0_form_status, "owner action launcher must expose sample count recovery full P0 form status");
assert(ownerActionLauncherStatus.owner_sample_count_recovery_full_p0_form_row_count === ownerSampleCountRecoveryStatus.full_p0_form_row_count, "owner action launcher must expose sample count recovery full P0 form rows");
assert(ownerActionLauncherStatus.owner_sample_count_recovery_full_p0_intake_status === ownerSampleCountRecoveryStatus.full_p0_intake_status, "owner action launcher must expose sample count recovery full P0 intake status");
assert(ownerActionLauncherStatus.owner_sample_count_recovery_full_p0_intake_ready === ownerSampleCountRecoveryStatus.full_p0_intake_ready, "owner action launcher must expose sample count recovery full P0 intake readiness");
assert(ownerActionLauncherStatus.owner_sample_count_recovery_full_p0_staged_ready === ownerSampleCountRecoveryStatus.full_p0_staged_ready, "owner action launcher must expose sample count recovery full P0 staged readiness");
assert(ownerActionLauncherStatus.owner_sample_count_recovery_full_p0_after_command_count === ownerSampleCountRecoveryStatus.full_p0_after_command_count, "owner action launcher must expose sample count recovery full P0 after-command count");
assert(ownerActionLauncherStatus.owner_sample_count_recovery_full_p0_after_command_count === ownerSampleCountRecovery.full_p0_after_commands.length, "owner action launcher sample count recovery command count must match full JSON");
assert(ownerActionLauncherStatus.owner_sample_count_recovery_red_line_violation_count === ownerSampleCountRecoveryStatus.red_line_violation_count, "owner action launcher must expose sample count recovery red-line count");
assert(ownerActionLauncherStatus.owner_p0_postfill_check_status === ownerP0PostfillCheckStatus.status, "owner action launcher must expose P0 post-fill status");
assert(ownerActionLauncherStatus.owner_p0_postfill_check_current_stage === ownerP0PostfillCheckStatus.current_stage, "owner action launcher must expose P0 post-fill stage");
assert(ownerActionLauncherStatus.owner_p0_postfill_check_postfill_ready === ownerP0PostfillCheckStatus.postfill_ready, "owner action launcher must expose P0 post-fill readiness");
assert(ownerActionLauncherStatus.owner_p0_postfill_check_expected_to_advance_now === ownerP0PostfillCheckStatus.expected_to_advance_now, "owner action launcher must expose P0 post-fill expected advance flag");
assert(ownerActionLauncherStatus.owner_p0_postfill_check_safe_command_count === ownerP0PostfillCheckStatus.safe_command_count, "owner action launcher must expose P0 post-fill safe command count");
assert(ownerActionLauncherStatus.owner_p0_postfill_check_command_runs_local_scripts_only === ownerP0PostfillCheckStatus.command_runs_local_scripts_only, "owner action launcher must expose P0 post-fill local-only command policy");
assert(ownerActionLauncherStatus.owner_p0_postfill_check_external_effect === ownerP0PostfillCheckStatus.external_effect, "owner action launcher must expose P0 post-fill external effect flag");
assert(ownerActionLauncherStatus.owner_p0_postfill_check_data_lp_events_write_performed === ownerP0PostfillCheckStatus.data_lp_events_write_performed, "owner action launcher must expose P0 post-fill event write flag");
assert(ownerActionLauncherStatus.source_trust_status === sourceTrustMatrixStatus.status, "owner action launcher must expose source trust status");
assert(ownerActionLauncherStatus.source_trust_trusted_scoring_source_count === sourceTrustMatrixStatus.trusted_scoring_source_count, "owner action launcher must expose source trust trusted source count");
assert(ownerActionLauncherStatus.source_trust_sample_gate_source_count === sourceTrustMatrixStatus.sample_gate_source_count, "owner action launcher must expose source trust sample-gate source count");
assert(ownerActionLauncherStatus.source_trust_scoring_allowed_now === sourceTrustMatrixStatus.scoring_allowed_now, "owner action launcher must expose source trust scoring flag");
assert(ownerActionLauncherStatus.source_trust_real_event_rows === sourceTrustMatrixStatus.real_event_rows, "owner action launcher must expose source trust real event rows");
assert(ownerActionLauncherStatus.source_trust_p0_pending_count === sourceTrustMatrixStatus.p0_pending_count, "owner action launcher must expose source trust P0 pending count");
assert(ownerActionLauncherStatus.source_trust_sample_threshold_met === sourceTrustMatrixStatus.sample_threshold_met, "owner action launcher must expose source trust sample threshold flag");
assert(ownerActionLauncherStatus.source_trust_ready_for_public_iteration_decision === sourceTrustMatrixStatus.ready_for_public_iteration_decision, "owner action launcher must expose source trust public iteration flag");
assert(ownerActionLauncherStatus.source_trust_external_effect === sourceTrustMatrixStatus.external_effect, "owner action launcher must expose source trust external effect flag");
assert(ownerActionLauncherStatus.source_trust_data_lp_events_write_performed === sourceTrustMatrixStatus.data_lp_events_write_performed, "owner action launcher must expose source trust event write flag");
assert(ownerActionLauncherStatus.worker_dry_run_status === "ok", "owner action launcher must expose Worker dry-run ok status");
assert(ownerActionLauncherStatus.worker_dry_run_exit_observed === true, "owner action launcher must expose Worker dry-run exit");
assert(ownerActionLauncherStatus.worker_dry_run_required_markers_present === true, "owner action launcher must expose Worker dry-run required markers");
assert(ownerActionLauncherStatus.worker_dry_run_production_deploy_performed === false, "owner action launcher must expose Worker dry-run no production deploy");
assert(ownerActionLauncherStatus.worker_dry_run_external_effect === false, "owner action launcher must expose Worker dry-run no external effect");
assert(ownerActionLauncherStatus.sample_gate_batch_handoff_status === sampleGateBatchHandoffStatus.status, "owner action launcher must expose sample gate batch handoff status");
assert(ownerActionLauncherStatus.sample_gate_batch_handoff_p0_task_count === sampleGateBatchHandoffStatus.p0_task_count, "owner action launcher must expose sample gate batch task count");
assert(ownerActionLauncherStatus.sample_gate_batch_handoff_all_p0_row_count === sampleGateBatchHandoffStatus.all_p0_row_count, "owner action launcher must expose sample gate batch all-row count");
assert(ownerActionLauncherStatus.sample_gate_batch_handoff_focused_batch_row_count === sampleGateBatchHandoffStatus.focused_batch_row_count, "owner action launcher must expose sample gate focused batch count");
assert(ownerActionLauncherStatus.sample_gate_batch_handoff_remaining_batch_row_count === sampleGateBatchHandoffStatus.remaining_batch_row_count, "owner action launcher must expose sample gate remaining batch count");
assert(ownerActionLauncherStatus.sample_gate_batch_handoff_p0_pending_count === sampleGateBatchHandoffStatus.p0_pending_count, "owner action launcher must expose sample gate pending count");
assert(ownerActionLauncherStatus.sample_gate_batch_handoff_batch_count === sampleGateBatchHandoffStatus.batch_count, "owner action launcher must expose sample gate batch count");
assert(ownerActionLauncherStatus.sample_gate_batch_handoff_full_coverage_ready === sampleGateBatchHandoffStatus.full_coverage_ready, "owner action launcher must expose sample gate full coverage status");
assert(ownerActionLauncherStatus.sample_gate_batch_preflight_status === sampleGateBatchPreflightStatus.status, "owner action launcher must expose sample gate batch preflight status");
assert(ownerActionLauncherStatus.sample_gate_batch_preflight_input_kind === sampleGateBatchPreflightStatus.input_kind, "owner action launcher must expose sample gate batch preflight input kind");
assert(ownerActionLauncherStatus.sample_gate_batch_preflight_filled_p0_row_count === sampleGateBatchPreflightStatus.filled_p0_row_count, "owner action launcher must expose sample gate batch preflight filled count");
assert(ownerActionLauncherStatus.sample_gate_batch_preflight_pending_p0_row_count === sampleGateBatchPreflightStatus.pending_p0_row_count, "owner action launcher must expose sample gate batch preflight pending count");
assert(ownerActionLauncherStatus.sample_gate_batch_preflight_invalid_p0_row_count === sampleGateBatchPreflightStatus.invalid_p0_row_count, "owner action launcher must expose sample gate batch preflight invalid count");
assert(ownerActionLauncherStatus.sample_gate_batch_preflight_ready_for_source_compile === sampleGateBatchPreflightStatus.ready_for_source_compile, "owner action launcher must expose sample gate batch preflight compile readiness");
assert(ownerActionLauncherStatus.sample_gate_batch_preflight_external_effect === sampleGateBatchPreflightStatus.external_effect, "owner action launcher must expose sample gate batch preflight no external effect");
assert(ownerActionLauncherStatus.sample_gate_batch_preflight_data_lp_events_write_performed === sampleGateBatchPreflightStatus.data_lp_events_write_performed, "owner action launcher must expose sample gate batch preflight no event write");
assert(ownerActionLauncherStatus.sample_gate_collection_sprint_status === sampleGateCollectionSprintStatus.status, "owner action launcher must expose collection sprint status");
assert(ownerActionLauncherStatus.sample_gate_collection_sprint_p0_pending_count === sampleGateCollectionSprintStatus.p0_pending_count, "owner action launcher must expose collection sprint pending count");
assert(ownerActionLauncherStatus.sample_gate_collection_sprint_step_count === sampleGateCollectionSprintStatus.sprint_step_count, "owner action launcher must expose collection sprint step count");
assert(ownerActionLauncherStatus.prepared_but_blocked_report_status === preparedButBlockedStatus.status, "owner action launcher must expose PreparedButBlocked report status");
assert(ownerActionLauncherStatus.prepared_but_blocked_blocked_item_count === preparedButBlockedStatus.blocked_item_count, "owner action launcher must expose PreparedButBlocked blocked count");
assert(ownerActionLauncherStatus.prepared_but_blocked_pending_human_approval_count === preparedButBlockedStatus.pending_human_approval_count, "owner action launcher must expose PreparedButBlocked pending approval count");
assert(ownerActionLauncherStatus.prepared_but_blocked_redline_queue_covered === preparedButBlockedStatus.redline_queue_covered, "owner action launcher must expose PreparedButBlocked red-line coverage");
assert(ownerActionLauncherStatus.prepared_but_blocked_no_autorun_for_external_gates === preparedButBlockedStatus.no_autorun_for_external_gates, "owner action launcher must expose PreparedButBlocked no-autorun policy");
assert(ownerActionLauncherStatus.approval_queue_status === approvalStatus.status, "owner action launcher must expose approval queue status");
assert(ownerActionLauncherStatus.approval_queue_item_count === approvalStatus.item_count, "owner action launcher must expose approval queue item count");
assert(ownerActionLauncherStatus.approval_queue_ready_local_review_count === approvalStatus.ready_local_review_count, "owner action launcher must expose approval queue ready local review count");
assert(ownerActionLauncherStatus.approval_queue_pending_human_count === approvalStatus.pending_human_count, "owner action launcher must expose approval queue pending human count");
assert(ownerActionLauncherStatus.approval_queue_high_risk_pending_count === approvalStatus.high_risk_pending_count, "owner action launcher must expose approval queue high-risk pending count");
assert(ownerActionLauncherStatus.approval_queue_next_ready_local_review_id === approvalStatus.next_ready_local_review_id, "owner action launcher must expose next local review id");
assert(ownerActionLauncherStatus.approval_queue_next_pending_human_id === approvalStatus.next_pending_human_id, "owner action launcher must expose next pending human gate id");
assert(ownerActionLauncherStatus.approval_queue_policy_ok === approvalStatus.policy_ok, "owner action launcher must expose approval queue policy status");
assert(JSON.stringify(ownerActionLauncherStatus.approval_queue_pending_human_ids) === JSON.stringify(approvalStatus.pending_human_ids), "owner action launcher must expose approval queue pending human ids");
assert(JSON.stringify(ownerActionLauncherStatus.approval_queue_ready_local_review_ids) === JSON.stringify(approvalStatus.ready_local_review_ids), "owner action launcher must expose approval queue ready local review ids");
assert(ownerActionLauncherStatus.command_opens_local_files_only === true, "owner action launcher must open local files only");
assert(ownerActionLauncherStatus.opens_external_urls === false, "owner action launcher must not open external URLs");
assert(ownerActionLauncherStatus.network_calls_performed === false, "owner action launcher must not perform network calls");
assert(ownerActionLauncherStatus.browser_persistence === false, "owner action launcher must not use browser persistence");
assert(ownerActionLauncherStatus.live_input_files_created === false, "owner action launcher must not create live input files");
assertNoRedLineFlags(ownerActionLauncherStatus, "owner action launcher status");
assert(ownerActionLauncherStatus.targets.every((target) => target.exists === true && !/^https?:\/\//.test(target.path)), "owner action launcher targets must exist and stay local");
for (const expectedTarget of [
  "owner_console.html",
  "owner_next_action.md",
  "north_star_outcome_preflight.md",
  "data/north_star_outcome_preflight_status.json",
  "north_star_outcome_form.html",
  "north_star_outcome_form_fixture_report.md",
  "owner_p1_outcome_intake.md",
  "owner_p1_outcome_intake.json",
  "data/owner_p1_outcome_intake_status.json",
  "owner_p1_outcome_postfill_check.md",
  "owner_p1_outcome_postfill_check.json",
  "data/owner_p1_outcome_postfill_check_status.json",
  "owner_p0_now.html",
  "owner_p0_now.md",
  "sample_gate_collection_sprint.md",
  "prepared_but_blocked.md",
  "approval_queue.json",
  "data/approval_queue_status.json",
  "sample_gate_recovery_pack.md",
  "owner_sample_count_handoff.md",
  "owner_sample_count_paste_block.txt",
  "sample_gate_batch_handoff.md",
  "sample_gate_batch_1_paste_block.txt",
  "sample_gate_batch_2_paste_block.txt",
  "owner_sample_count_recovery.md",
  "owner_p0_postfill_check.md",
  "owner_p0_postfill_check.json",
  "data/owner_p0_postfill_check_status.json",
  "worker_dry_run.md",
  "data/worker_dry_run_status.json",
  "sample_gate_batch_preflight.md",
  "data/sample_gate_batch_preflight_status.json",
  "next_p0_owner_form.html",
  "next_p0_owner_intake.md",
  "next_p0_quick_capture.md",
  "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
  "p0_counts_preflight.md",
  "sample_gate_capture_calendar.md",
  "sample_gate_due_status.md",
  "sample_gate_owner_form.html",
  "owner_approval_form.html",
  "manual_publish_packet.md",
  "manual_publish_evidence_form.html",
  "owner_quality_review_form.html",
]) {
  assert(ownerActionLauncherStatus.targets.some((target) => target.path === expectedTarget), `owner action launcher missing target ${expectedTarget}`);
  assert(ownerActionLauncherCommand.includes(`open "$ROOT/${expectedTarget}"`), `owner action launcher command must open ${expectedTarget}`);
}
const ownerLauncherStat = await stat(path.join(ROOT, "OPEN-3Q-GROWTH-LOOP.command"));
assert((ownerLauncherStat.mode & 0o111) !== 0, "owner action launcher command must be executable");
assert(ownerActionLauncherCommand.startsWith("#!/bin/zsh"), "owner action launcher command must be zsh executable");
assert(!/https?:\/\//.test(ownerActionLauncherCommand), "owner action launcher command must not include external URLs");
assert(!/\b(curl|wget|wrangler|git|gh|npm|node)\b/.test(ownerActionLauncherCommand), "owner action launcher command must not run network, deploy, GitHub, npm, or node commands");
assert(!/rm\s+-|trash|delete|launchctl|osascript/i.test(ownerActionLauncherCommand), "owner action launcher command must not delete, alter launchd, or automate UI");
assert(ownerActionLauncherCommand.includes("Primary action details: owner_next_action.md"), "owner action launcher command must point primary action details to the local card");
assert(ownerActionLauncherCommand.includes("P0 now:"), "owner action launcher command must print P0-now status");
assert(ownerActionLauncherCommand.includes("Full P0 form/intake:"), "owner action launcher command must print full P0 form/intake status");
assert(ownerActionLauncherCommand.includes("Quick count progress:"), "owner action launcher command must print quick count progress");
assert(ownerActionLauncherCommand.includes("P0 counts preflight:"), "owner action launcher command must print P0 counts preflight status");
assert(ownerActionLauncherCommand.includes("North Star outcome preflight:"), "owner action launcher command must print North Star outcome preflight status");
assert(ownerActionLauncherCommand.includes("North Star outcome form:"), "owner action launcher command must print North Star outcome form status");
assert(ownerActionLauncherCommand.includes("P1 outcome intake:"), "owner action launcher command must print P1 outcome intake status");
assert(ownerActionLauncherCommand.includes("P1 outcome post-fill check:"), "owner action launcher command must print P1 outcome post-fill status");
assert(ownerActionLauncherCommand.includes("Missing ranks:"), "owner action launcher command must print missing quick ranks");
assert(ownerActionLauncherCommand.includes("Sample count recovery:"), "owner action launcher command must print sample count recovery status");
assert(ownerActionLauncherCommand.includes("P0 post-fill check:"), "owner action launcher command must print P0 post-fill status");
assert(ownerActionLauncherCommand.includes("Source trust:"), "owner action launcher command must print source trust status");
assert(ownerActionLauncherCommand.includes("Post-fill command: ./RUN-P0-POST-FILL-CHECK.command"), "owner action launcher command must point to manual post-fill command");
assert(ownerActionLauncherCommand.includes("P1 outcome post-fill command: ./RUN-P1-OUTCOME-POST-FILL-CHECK.command"), "owner action launcher command must point to manual P1 post-fill command");
assert(!ownerActionLauncherCommand.includes('open "$ROOT/RUN-P0-POST-FILL-CHECK.command"'), "owner action launcher must not auto-open or auto-run post-fill command");
assert(!ownerActionLauncherCommand.includes('open "$ROOT/RUN-P1-OUTCOME-POST-FILL-CHECK.command"'), "owner action launcher must not auto-open or auto-run P1 post-fill command");
assert(ownerActionLauncherCommand.includes("Worker dry run:"), "owner action launcher command must print Worker dry-run status");
assert(!ownerActionLauncherCommand.includes("npm run worker:dry-run:status"), "owner action launcher command must not run Worker dry-run status");
assert(ownerActionLauncherCommand.includes("Full P0 batch handoff:"), "owner action launcher command must print full P0 batch handoff status");
assert(ownerActionLauncherCommand.includes("Full P0 batch preflight:"), "owner action launcher command must print full P0 batch preflight status");
assert(ownerActionLauncherCommand.includes("Collection sprint:"), "owner action launcher command must print collection sprint status");
assert(ownerActionLauncherCommand.includes("Approval queue:"), "owner action launcher command must print approval queue status");
assert(ownerActionLauncherCommand.includes("owner_sample_count_handoff.md"), "owner action launcher command must point after-fill handling to sample count handoff");
assert(ownerActionLauncherCommand.includes("owner_sample_count_paste_block.txt"), "owner action launcher command must open sample count paste block");
assert(ownerActionLauncherCommand.includes("sample_gate_batch_handoff.md"), "owner action launcher command must open sample gate batch handoff");
assert(ownerActionLauncherCommand.includes("sample_gate_batch_preflight.md"), "owner action launcher command must open sample gate batch preflight");
assert(ownerActionLauncherCommand.includes("data/sample_gate_batch_preflight_status.json"), "owner action launcher command must open sample gate batch preflight compact status");
assert(ownerActionLauncherCommand.includes("sample_gate_batch_1_paste_block.txt"), "owner action launcher command must open sample gate batch 1 paste block");
assert(ownerActionLauncherCommand.includes("sample_gate_batch_2_paste_block.txt"), "owner action launcher command must open sample gate batch 2 paste block");
assert(ownerActionLauncherCommand.includes("owner_p0_postfill_check.md"), "owner action launcher command must open P0 post-fill report");
assert(ownerActionLauncherCommand.includes("owner_p0_postfill_check.json"), "owner action launcher command must open P0 post-fill JSON");
assert(ownerActionLauncherCommand.includes("data/owner_p0_postfill_check_status.json"), "owner action launcher command must open P0 post-fill compact status");
assert(ownerActionLauncherCommand.includes("worker_dry_run.md"), "owner action launcher command must open Worker dry-run report");
assert(ownerActionLauncherCommand.includes("data/worker_dry_run_status.json"), "owner action launcher command must open Worker dry-run compact status");
assert(ownerActionLauncherCommand.includes("approval_queue.json"), "owner action launcher command must open approval queue");
assert(ownerActionLauncherCommand.includes("data/approval_queue_status.json"), "owner action launcher command must open approval queue status");
assert(ownerActionLauncherCommand.includes("owner_p0_now.html"), "owner action launcher command must open P0-now cockpit");
assert(ownerActionLauncherCommand.includes("owner_p0_now.md"), "owner action launcher command must open P0-now card");
assert(ownerActionLauncherCommand.includes("north_star_outcome_preflight.md"), "owner action launcher command must open North Star outcome preflight");
assert(ownerActionLauncherCommand.includes("data/north_star_outcome_preflight_status.json"), "owner action launcher command must open North Star outcome preflight compact status");
assert(ownerActionLauncherCommand.includes("north_star_outcome_form.html"), "owner action launcher command must open North Star outcome form");
assert(ownerActionLauncherCommand.includes("north_star_outcome_form_fixture_report.md"), "owner action launcher command must open North Star outcome form fixture report");
assert(ownerActionLauncherCommand.includes("owner_p1_outcome_postfill_check.md"), "owner action launcher command must open P1 outcome post-fill report");
assert(ownerActionLauncherCommand.includes("owner_p1_outcome_postfill_check.json"), "owner action launcher command must open P1 outcome post-fill JSON");
assert(ownerActionLauncherCommand.includes("data/owner_p1_outcome_postfill_check_status.json"), "owner action launcher command must open P1 outcome post-fill compact status");
assert(ownerActionLauncherCommand.includes("p0_counts_preflight.md"), "owner action launcher command must open P0 counts preflight");
assert(ownerActionLauncherReport.includes("3Q Growth Loop Owner Action Launcher"), "owner action launcher report must have title");
assert(ownerActionLauncherReport.includes("Primary action command:"), "owner action launcher report must include primary action command");
assert(ownerActionLauncherReport.includes("P0 now:"), "owner action launcher report must include P0-now status");
assert(ownerActionLauncherReport.includes("Full P0 form/intake:"), "owner action launcher report must include full P0 form/intake status");
assert(ownerActionLauncherReport.includes("Quick count progress:"), "owner action launcher report must include quick count progress");
assert(ownerActionLauncherReport.includes("P0 counts preflight:"), "owner action launcher report must include P0 counts preflight status");
assert(ownerActionLauncherReport.includes("North Star outcome preflight:"), "owner action launcher report must include North Star outcome preflight status");
assert(ownerActionLauncherReport.includes("North Star outcome form:"), "owner action launcher report must include North Star outcome form status");
assert(ownerActionLauncherReport.includes("P1 outcome post-fill check:"), "owner action launcher report must include P1 outcome post-fill status");
assert(ownerActionLauncherReport.includes("Sample count handoff:"), "owner action launcher report must include sample count handoff status");
assert(ownerActionLauncherReport.includes("Sample count recovery:"), "owner action launcher report must include sample count recovery status");
assert(ownerActionLauncherReport.includes("P0 post-fill check:"), "owner action launcher report must include P0 post-fill status");
assert(ownerActionLauncherReport.includes("Source trust:"), "owner action launcher report must include source trust status");
assert(ownerActionLauncherReport.includes(`trusted=${sourceTrustMatrixStatus.trusted_scoring_source_count}`), "owner action launcher report must include source trust trusted count");
assert(ownerActionLauncherReport.includes("RUN-P0-POST-FILL-CHECK.command is intentionally not opened"), "owner action launcher report must state post-fill command is not auto-opened");
assert(ownerActionLauncherReport.includes("RUN-P1-OUTCOME-POST-FILL-CHECK.command is intentionally not opened"), "owner action launcher report must state P1 post-fill command is not auto-opened");
assert(ownerActionLauncherReport.includes("Full P0 batch handoff:"), "owner action launcher report must include full P0 batch handoff status");
assert(ownerActionLauncherReport.includes("Full P0 batch preflight:"), "owner action launcher report must include full P0 batch preflight status");
assert(ownerActionLauncherReport.includes("Collection sprint:"), "owner action launcher report must include collection sprint status");
assert(ownerActionLauncherReport.includes("Approval queue:"), "owner action launcher report must include approval queue status");
assert(ownerActionLauncherReport.includes("next_human="), "owner action launcher report must include next pending human gate");
assert(ownerActionLauncherReport.includes("paste_keys="), "owner action launcher report must include sample count paste key count");
assert(ownerActionLauncherReport.includes("intake_ready="), "owner action launcher report must include full P0 intake readiness");
assert(ownerActionLauncherReport.includes("after_commands="), "owner action launcher report must include sample count recovery after-command count");
assert(ownerActionLauncherReport.includes("Opens local files only: yes"), "owner action launcher report must state local-only behavior");
assert(ownerActionLauncherReport.includes("External URLs: no"), "owner action launcher report must state no external URLs");
assert(ownerActionLauncherReport.includes("GitHub push / PR: no"), "owner action launcher report must state no GitHub push or PR");
assert(ownerActionLauncherReport.includes("sample_gate_recovery_pack.md"), "owner action launcher report must include sample gate recovery pack");
assert(ownerActionLauncherReport.includes("owner_sample_count_handoff.md"), "owner action launcher report must include sample count handoff");
assert(ownerActionLauncherReport.includes("owner_sample_count_paste_block.txt"), "owner action launcher report must include sample count paste block");
assert(ownerActionLauncherReport.includes("owner_p0_now.html"), "owner action launcher report must include P0-now cockpit");
assert(ownerActionLauncherReport.includes("p0_counts_preflight.md"), "owner action launcher report must include P0 counts preflight report");
assert(ownerActionLauncherReport.includes("owner_p0_now.md"), "owner action launcher report must include P0-now card");
assert(ownerActionLauncherReport.includes("sample_gate_batch_handoff.md"), "owner action launcher report must include sample gate batch handoff");
assert(ownerActionLauncherReport.includes("sample_gate_batch_preflight.md"), "owner action launcher report must include sample gate batch preflight");
assert(ownerActionLauncherReport.includes("data/sample_gate_batch_preflight_status.json"), "owner action launcher report must include sample gate batch preflight status");
assert(ownerActionLauncherReport.includes("sample_gate_batch_1_paste_block.txt"), "owner action launcher report must include sample gate batch 1 paste block");
assert(ownerActionLauncherReport.includes("sample_gate_batch_2_paste_block.txt"), "owner action launcher report must include sample gate batch 2 paste block");
assert(ownerActionLauncherReport.includes("approval_queue.json"), "owner action launcher report must include approval queue");
assert(ownerActionLauncherReport.includes("data/approval_queue_status.json"), "owner action launcher report must include approval queue status");
assert(ownerActionLauncherReport.includes("owner_sample_count_recovery.md"), "owner action launcher report must include sample count recovery");
assert(ownerActionLauncherReport.includes("owner_p0_postfill_check.md"), "owner action launcher report must include P0 post-fill report");
assert(ownerActionLauncherReport.includes("owner_p0_postfill_check.json"), "owner action launcher report must include P0 post-fill JSON");
assert(ownerActionLauncherReport.includes("data/owner_p0_postfill_check_status.json"), "owner action launcher report must include P0 post-fill compact status");
assert(ownerActionLauncherReport.includes("Worker dry run:"), "owner action launcher report must include Worker dry-run status");
assert(ownerActionLauncherReport.includes("worker_dry_run.md"), "owner action launcher report must include Worker dry-run report");
assert(ownerActionLauncherReport.includes("data/worker_dry_run_status.json"), "owner action launcher report must include Worker dry-run compact status");
assert(ownerActionLauncherReport.includes("next_p0_owner_inputs.counts-paste-template.txt"), "owner action launcher report must include focused paste template");
assert(ownerSampleGateFixtures.ok === true, "owner sample gate fixtures must be ok");
assert(ownerSampleGateFixtures.mode === "owner_sample_gate_fixture_dry_run", "owner sample gate fixture mode must match");
assert(ownerSampleGateFixtures.scenario_count === 7, "owner sample gate fixtures must cover seven scenarios");
for (const expectedScenario of [
  "missing_input_waits_for_owner_counts",
  "partial_counts_keep_collecting",
  "sample_insufficient_due_visits",
  "sample_insufficient_due_test_days",
  "sample_rate_win_needs_quality_review",
  "sample_ready_challenger_underperforms",
  "sensitive_evidence_blocks_status",
]) {
  assert(ownerSampleGateFixtures.scenarios.some((scenario) => scenario.id === expectedScenario && scenario.ok === true), `owner sample gate fixture missing ${expectedScenario}`);
}
assert(ownerSampleGateFixtures.scenarios.every((scenario) => scenario.quality_guard_status === "not_evaluated_from_sample_gate"), "owner sample gate fixtures must keep quality guard unevaluated");
assert(ownerSampleGateFixtures.scenarios.every((scenario) => scenario.challenger_win_rule_met === false), "owner sample gate fixtures must not mark final win rule met");
assert(ownerSampleGateFixtures.scenarios.every((scenario) => scenario.promotion_performed === false), "owner sample gate fixtures must not promote");
assert(ownerSampleGateFixtures.owner_sample_gate_commands_executed === true, "owner sample gate fixtures must run owner sample gate commands");
assert(ownerSampleGateFixtures.real_events_unchanged === true, "owner sample gate fixtures must leave real events unchanged");
assert(ownerSampleGateFixtures.data_lp_events_write_performed === false, "owner sample gate fixtures must not write data/lp_events.jsonl");
assert(ownerSampleGateFixtures.external_effect === false, "owner sample gate fixtures must not claim external effects");
assert(ownerSampleGateFixtureReport.includes("Owner Sample Gate Fixture Report"), "owner sample gate fixture report must have title");
assert(ownerSampleGateFixtureReport.includes("sample_rate_win_needs_quality_review"), "owner sample gate fixture report must include winning-review scenario");
assert(ownerSampleGateFixtureReport.includes("sensitive_evidence_blocks_status"), "owner sample gate fixture report must include sensitive-evidence block scenario");
assert(ownerQualityReview.ok === true, "owner quality review status must be ok");
assert(ownerQualityReview.mode === "owner_quality_review", "owner quality review mode must match");
assert(["waiting_for_sample_rate_candidate", "waiting_for_owner_quality_evidence", "owner_quality_review_passed_no_auto_promotion", "owner_quality_review_failed_keep_champion"].includes(ownerQualityReview.status), "owner quality review status is invalid");
assert(ownerQualityReview.owner_sample_gate_status === ownerSampleGateStatus.status, "owner quality review must read current owner sample gate status");
assert(ownerQualityReview.sample_rate_win_candidate === (ownerSampleGateStatus.sample_rate_win_candidate === true || ownerSampleGateStatus.status === "sample_rate_win_needs_quality_review"), "owner quality review sample-rate candidate must match sample gate");
assert(ownerQualityReview.promotion_performed === false, "owner quality review must not promote challenger");
assert(ownerQualityReview.live_input_files_created === false, "owner quality review must not create live input files");
assert(ownerQualityReview.data_lp_events_write_performed === false, "owner quality review must not write data/lp_events.jsonl");
assert(ownerQualityReview.approval_queue_write_performed === false, "owner quality review must not write approval_queue.json");
assert(ownerQualityReview.external_effect === false, "owner quality review must not claim external effects");
assert(ownerQualityReview.public_link_change_performed === false, "owner quality review must not change public links");
assert(ownerQualityReview.production_deploy_performed === false, "owner quality review must not deploy production");
assert(ownerQualityReview.github_push_or_pr_performed === false, "owner quality review must not push or create PR");
assert(ownerQualityReview.formal_post_performed === false, "owner quality review must not formally post");
assert(ownerQualityReview.line_push_performed === false, "owner quality review must not push LINE");
assert(ownerQualityReview.customer_data_mutation_performed === false, "owner quality review must not mutate customer data");
assert(ownerQualityReview.payment_action_performed === false, "owner quality review must not touch payments");
assert(ownerQualityReview.delete_action_performed === false, "owner quality review must not delete data");
if (ownerQualityReview.status === "owner_quality_review_passed_no_auto_promotion") {
  assert(ownerQualityReview.no_quality_regression === true, "passed owner quality review must set no_quality_regression true");
  assert(ownerQualityReview.challenger_win_rule_met === true, "passed owner quality review may mark final win rule met for owner review");
  assert(ownerQualityReview.promotion_review_queued === true, "passed owner quality review must queue owner promotion review only");
} else {
  assert(ownerQualityReview.challenger_win_rule_met === false, "non-passing owner quality review must not mark final win rule met");
  assert(ownerQualityReview.promotion_review_queued === false, "non-passing owner quality review must not queue promotion review");
}
assert(ownerQualityReviewMd.includes("Owner Quality Review"), "owner quality review markdown must have title");
assert(ownerQualityReviewMd.includes("Promotion performed: no"), "owner quality review markdown must state no promotion");
assert(ownerQualityReviewMd.includes("Approval queue write performed: no"), "owner quality review markdown must state no approval queue write");
assert(ownerQualityReviewExample.pii_checked === "yes", "owner quality review example must require pii_checked");
assert(typeof ownerQualityReviewExample.evidence_ref === "string" && !/@/.test(ownerQualityReviewExample.evidence_ref), "owner quality review example must use aggregate evidence ref");
assert(ownerQualityReviewForm.ok === true, "owner quality review form status must be ok");
assert(ownerQualityReviewForm.mode === "owner_quality_review_form", "owner quality review form mode must match");
assert(["waiting_for_sample_rate_candidate_local_form_ready", "ready_local_quality_review_fill", "owner_quality_review_input_detected_review_before_overwrite"].includes(ownerQualityReviewForm.status), "owner quality review form status is invalid");
assert(ownerQualityReviewForm.owner_quality_review_status === ownerQualityReview.status, "owner quality review form must read current quality review status");
assert(ownerQualityReviewForm.sample_rate_win_candidate === ownerQualityReview.sample_rate_win_candidate, "owner quality review form sample-rate candidate must match quality review status");
assert(ownerQualityReviewForm.required_owner_fields.includes("reviewer"), "owner quality review form must require reviewer");
assert(ownerQualityReviewForm.required_owner_fields.includes("pii_checked"), "owner quality review form must require pii_checked");
assert(ownerQualityReviewForm.required_owner_fields.includes("evidence_ref"), "owner quality review form must require evidence_ref");
assert(ownerQualityReviewForm.required_owner_fields.includes("lead_rate_retention_vs_champion"), "owner quality review form must require lead retention");
assert(ownerQualityReviewForm.required_owner_fields.includes("close_rate_retention_vs_champion"), "owner quality review form must require close retention");
assert(ownerQualityReviewForm.required_owner_fields.includes("spam_flag_rate"), "owner quality review form must require spam flag rate");
assert(ownerQualityReviewForm.download_filename === "owner_quality_review.filled.json", "owner quality review form must export owner filled JSON filename");
assert(ownerQualityReviewForm.review_download_filename === "owner_quality_review_form.review.json", "owner quality review form must expose review JSON filename");
assert(ownerQualityReviewForm.browser_only === true, "owner quality review form must be browser-only");
assert(ownerQualityReviewForm.browser_persistence === false, "owner quality review form must not persist browser data");
assert(ownerQualityReviewForm.form_action === "none", "owner quality review form status must declare no form action");
assert(ownerQualityReviewForm.network_calls_performed === false, "owner quality review form must not perform network calls");
assert(ownerQualityReviewForm.live_input_files_created === false, "owner quality review form must not create live input files");
assert(ownerQualityReviewForm.real_events_unchanged === true, "owner quality review form must leave real events unchanged");
assert(ownerQualityReviewForm.data_lp_events_write_performed === false, "owner quality review form must not write data/lp_events.jsonl");
assert(ownerQualityReviewForm.approval_queue_write_performed === false, "owner quality review form must not write approval_queue.json");
assert(ownerQualityReviewForm.promotion_performed === false, "owner quality review form must not promote challenger");
assert(ownerQualityReviewForm.external_effect === false, "owner quality review form must not claim external effects");
assert(ownerQualityReviewForm.public_link_change_performed === false, "owner quality review form must not change public links");
assert(ownerQualityReviewForm.production_deploy_performed === false, "owner quality review form must not deploy production");
assert(ownerQualityReviewForm.github_push_or_pr_performed === false, "owner quality review form must not push or create PR");
assert(ownerQualityReviewForm.formal_post_performed === false, "owner quality review form must not formally post");
assert(ownerQualityReviewForm.line_push_performed === false, "owner quality review form must not push LINE");
assert(ownerQualityReviewForm.customer_data_mutation_performed === false, "owner quality review form must not mutate customer data");
assert(ownerQualityReviewForm.payment_action_performed === false, "owner quality review form must not touch payments");
assert(ownerQualityReviewForm.delete_action_performed === false, "owner quality review form must not delete data");
assert(ownerQualityReviewFormHtml.includes("3Q Growth Loop Quality Review Form"), "owner quality review form HTML must have title");
assert(ownerQualityReviewFormHtml.includes('data-external-effect="false"'), "owner quality review form must mark no external effect");
assert(ownerQualityReviewFormHtml.includes('data-network="none"'), "owner quality review form must mark no network");
assert(ownerQualityReviewFormHtml.includes("owner_quality_review.filled.json"), "owner quality review form must mention filled JSON download");
assert(ownerQualityReviewFormHtml.includes("<form id=\"qualityForm\""), "owner quality review form must include the local quality form");
assert(ownerQualityReviewFormHtml.includes("Download JSON"), "owner quality review form must include JSON download control");
assert(!/\bfetch\s*\(/.test(ownerQualityReviewFormHtml), "owner quality review form must not call fetch");
assert(!/sendBeacon|XMLHttpRequest/i.test(ownerQualityReviewFormHtml), "owner quality review form must not send beacons or XHR");
assert(!/localStorage|sessionStorage|indexedDB/i.test(ownerQualityReviewFormHtml), "owner quality review form must not persist browser data");
assert(!/href=["']https?:\/\//i.test(ownerQualityReviewFormHtml), "owner quality review form must not link to external URLs");
assert(ownerQualityReviewFormFixture.ok === true, "owner quality review form fixtures must be ok");
assert(ownerQualityReviewFormFixture.mode === "owner_quality_review_form_fixture_dry_run", "owner quality review form fixture mode must match");
assert(ownerQualityReviewFormFixture.scenario_count === 4, "owner quality review form fixtures must cover four scenarios");
assert(ownerQualityReviewFormFixture.form_download_filename === "owner_quality_review.filled.json", "owner quality review form fixtures must replay the browser download filename");
assert(ownerQualityReviewFormFixture.local_fixture_commands_executed === true, "owner quality review form fixtures must execute local fixture commands");
assert(ownerQualityReviewFormFixture.form_export_replay_executed === true, "owner quality review form fixtures must replay browser form export");
assert(ownerQualityReviewFormFixture.owner_quality_review_commands_executed === true, "owner quality review form fixtures must run owner quality-review commands");
assert(ownerQualityReviewFormFixture.real_events_unchanged === true, "owner quality review form fixtures must leave real events unchanged");
assert(ownerQualityReviewFormFixture.live_input_files_created === false, "owner quality review form fixtures must not create live input files");
assert(ownerQualityReviewFormFixture.real_event_write_performed === false, "owner quality review form fixtures must not write real events");
assert(ownerQualityReviewFormFixture.data_lp_events_write_performed === false, "owner quality review form fixtures must not write data/lp_events.jsonl");
assert(ownerQualityReviewFormFixture.approval_queue_write_performed === false, "owner quality review form fixtures must not write approval_queue.json");
assert(ownerQualityReviewFormFixture.promotion_performed === false, "owner quality review form fixtures must not promote challenger");
assert(ownerQualityReviewFormFixture.external_effect === false, "owner quality review form fixtures must not claim external effects");
assert(ownerQualityReviewFormFixture.public_link_change_performed === false, "owner quality review form fixtures must not change public links");
assert(ownerQualityReviewFormFixture.production_deploy_performed === false, "owner quality review form fixtures must not deploy production");
assert(ownerQualityReviewFormFixture.github_push_or_pr_performed === false, "owner quality review form fixtures must not push or create PR");
assert(ownerQualityReviewFormFixture.formal_post_performed === false, "owner quality review form fixtures must not formally post");
assert(ownerQualityReviewFormFixture.line_push_performed === false, "owner quality review form fixtures must not push LINE");
assert(ownerQualityReviewFormFixture.customer_data_mutation_performed === false, "owner quality review form fixtures must not mutate customer data");
assert(ownerQualityReviewFormFixture.payment_action_performed === false, "owner quality review form fixtures must not touch payments");
assert(ownerQualityReviewFormFixture.delete_action_performed === false, "owner quality review form fixtures must not delete data");
for (const expectedScenario of [
  "quality_form_export_waits_for_sample_rate_candidate",
  "quality_form_export_pass_queues_owner_review",
  "quality_form_export_regression_keeps_champion",
  "quality_form_export_sensitive_notes_blocked",
]) {
  assert(ownerQualityReviewFormFixture.scenarios.some((scenario) => scenario.id === expectedScenario && scenario.ok === true), `owner quality review form fixture missing ${expectedScenario}`);
}
assert(ownerQualityReviewFormFixture.scenarios.some((scenario) => scenario.owner_status === "waiting_for_sample_rate_candidate" && scenario.no_quality_regression === null), "owner quality review form fixtures must cover waiting for sample-rate candidate");
assert(ownerQualityReviewFormFixture.scenarios.some((scenario) => scenario.owner_status === "owner_quality_review_passed_no_auto_promotion" && scenario.no_quality_regression === true && scenario.promotion_review_queued === true), "owner quality review form fixtures must cover passing quality review");
assert(ownerQualityReviewFormFixture.scenarios.some((scenario) => scenario.owner_status === "owner_quality_review_failed_keep_champion" && scenario.no_quality_regression === false && scenario.quality_regression_count > 0), "owner quality review form fixtures must cover quality regression");
assert(ownerQualityReviewFormFixture.scenarios.some((scenario) => scenario.owner_status === "blocked_invalid_owner_quality_review" && scenario.issue_count > 0), "owner quality review form fixtures must cover invalid/sensitive input");
assert(ownerQualityReviewFormFixture.scenarios.every((scenario) => scenario.promotion_performed === false), "owner quality review form fixture scenarios must not promote");
assert(ownerQualityReviewFormFixture.scenarios.every((scenario) => scenario.data_lp_events_write_performed === false), "owner quality review form fixture scenarios must not write data/lp_events.jsonl");
assert(ownerQualityReviewFormFixture.scenarios.every((scenario) => scenario.approval_queue_write_performed === false), "owner quality review form fixture scenarios must not write approval queue");
assert(ownerQualityReviewFormFixture.scenarios.every((scenario) => scenario.external_effect === false), "owner quality review form fixture scenarios must not claim external effects");
assert(ownerQualityReviewFormFixtureReport.includes("Owner Quality Review Form Fixture Report"), "owner quality review form fixture report must have title");
assert(ownerQualityReviewFormFixtureReport.includes("quality_form_export_pass_queues_owner_review"), "owner quality review form fixture report must include pass scenario");
assert(ownerQualityReviewFormFixtureReport.includes("quality_form_export_regression_keeps_champion"), "owner quality review form fixture report must include regression scenario");
assert(ownerQualityReviewFormFixtureReport.includes("quality_form_export_sensitive_notes_blocked"), "owner quality review form fixture report must include sensitive scenario");
assert(ownerQualityReviewFormFixtureReport.includes("Promotion performed: no"), "owner quality review form fixture report must state no promotion");
assert(ownerQualityReviewFixture.ok === true, "owner quality review fixtures must be ok");
assert(ownerQualityReviewFixture.mode === "owner_quality_review_fixture_dry_run", "owner quality review fixture mode must match");
assert(ownerQualityReviewFixture.scenario_count === 6, "owner quality review fixtures must cover six scenarios");
for (const expectedScenario of [
  "waiting_for_sample_rate_candidate_no_input",
  "sample_rate_win_waits_for_quality_evidence",
  "sample_rate_win_quality_pass_queues_review",
  "sample_rate_win_quality_regression_keeps_champion",
  "sensitive_evidence_blocks_review",
  "missing_required_fields_blocks_review",
]) {
  assert(ownerQualityReviewFixture.scenarios.some((scenario) => scenario.id === expectedScenario && scenario.ok === true), `owner quality review fixture missing ${expectedScenario}`);
}
assert(ownerQualityReviewFixture.scenarios.some((scenario) => scenario.status === "owner_quality_review_passed_no_auto_promotion" && scenario.no_quality_regression === true && scenario.promotion_review_queued === true), "owner quality review fixtures must cover passing quality review");
assert(ownerQualityReviewFixture.scenarios.some((scenario) => scenario.status === "owner_quality_review_failed_keep_champion" && scenario.no_quality_regression === false && scenario.quality_regression_count > 0), "owner quality review fixtures must cover quality regression");
assert(ownerQualityReviewFixture.scenarios.some((scenario) => scenario.status === "blocked_invalid_owner_quality_review" && scenario.issue_count > 0), "owner quality review fixtures must cover invalid/sensitive input");
assert(ownerQualityReviewFixture.scenarios.every((scenario) => scenario.promotion_performed === false), "owner quality review fixture scenarios must not promote");
assert(ownerQualityReviewFixture.scenarios.every((scenario) => scenario.data_lp_events_write_performed === false), "owner quality review fixture scenarios must not write data/lp_events.jsonl");
assert(ownerQualityReviewFixture.scenarios.every((scenario) => scenario.approval_queue_write_performed === false), "owner quality review fixture scenarios must not write approval queue");
assert(ownerQualityReviewFixture.scenarios.every((scenario) => scenario.external_effect === false), "owner quality review fixture scenarios must not claim external effects");
assert(ownerQualityReviewFixture.owner_quality_review_commands_executed === true, "owner quality review fixtures must run owner quality-review commands");
assert(ownerQualityReviewFixture.real_events_unchanged === true, "owner quality review fixtures must leave real events unchanged");
assert(ownerQualityReviewFixture.data_lp_events_write_performed === false, "owner quality review fixtures must not write data/lp_events.jsonl");
assert(ownerQualityReviewFixture.approval_queue_write_performed === false, "owner quality review fixtures must not write approval queue");
assert(ownerQualityReviewFixture.external_effect === false, "owner quality review fixtures must not claim external effects");
assert(ownerQualityReviewFixture.public_link_change_performed === false, "owner quality review fixtures must not change public links");
assert(ownerQualityReviewFixture.production_deploy_performed === false, "owner quality review fixtures must not deploy production");
assert(ownerQualityReviewFixture.github_push_or_pr_performed === false, "owner quality review fixtures must not push or create PR");
assert(ownerQualityReviewFixture.formal_post_performed === false, "owner quality review fixtures must not formally post");
assert(ownerQualityReviewFixture.line_push_performed === false, "owner quality review fixtures must not push LINE");
assert(ownerQualityReviewFixture.customer_data_mutation_performed === false, "owner quality review fixtures must not mutate customer data");
assert(ownerQualityReviewFixture.payment_action_performed === false, "owner quality review fixtures must not touch payments");
assert(ownerQualityReviewFixture.delete_action_performed === false, "owner quality review fixtures must not delete data");
assert(ownerQualityReviewFixtureReport.includes("Owner Quality Review Fixture Report"), "owner quality review fixture report must have title");
assert(ownerQualityReviewFixtureReport.includes("sample_rate_win_quality_pass_queues_review"), "owner quality review fixture report must include pass scenario");
assert(ownerQualityReviewFixtureReport.includes("sample_rate_win_quality_regression_keeps_champion"), "owner quality review fixture report must include regression scenario");
assert(ownerQualityReviewFixtureReport.includes("Promotion performed: no"), "owner quality review fixture report must state no promotion");
for (const expectedStage of ["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"]) {
  assert(dataCollection.stage_priorities.some((stage) => stage.event_type === expectedStage), `data collection must include stage ${expectedStage}`);
  assert(dataCollection.tasks.some((task) => task.event_type === expectedStage), `data collection tasks must include ${expectedStage}`);
}
for (const [eventType, sampleKey, gap] of [
  ["page_view", "visits", sourceReadiness.sample_progress.gaps.visits],
  ["cta_click", "cta_clicks", sourceReadiness.sample_progress.gaps.cta_clicks],
  ["line_add", "line_adds", sourceReadiness.sample_progress.gaps.line_adds],
]) {
  const priority = dataCollection.stage_priorities.find((stage) => stage.event_type === eventType);
  assert(priority?.priority === "P0_sample_gate", `data collection ${eventType} must be P0 sample gate`);
  assert(priority?.sample_gate_key === sampleKey, `data collection ${eventType} sample key mismatch`);
  assert(Number(priority?.sample_gap ?? 0) === gap, `data collection ${eventType} sample gap mismatch`);
}
assert(dataCollection.tasks.every((task) => task.external_effect === false), "data collection tasks must have no external effect");
assert(dataCollection.tasks.every((task) => task.required_owner_fields?.includes("aggregate_count") && task.required_owner_fields?.includes("evidence_ref") && task.required_owner_fields?.includes("pii_checked")), "data collection tasks must require aggregate count, evidence ref, and pii check");
assert(dataCollection.tasks.every((task) => task.owner_fill_path === "data/source_capture/source_capture_ledger.filled.csv"), "data collection tasks must point to filled ledger path");
assert(dataCollection.immediate_actions.some((action) => action.id === "create_owner_filled_ledger_copy"), "data collection brief must tell owner to create a filled ledger copy");
assert(dataCollection.gated_links.some((link) => link.role === "ab_small_traffic"), "data collection brief must keep A/B router gated");
assert(dataCollection.safety_rules.some((rule) => rule.includes("Aggregate counts only")), "data collection safety rules must state aggregate-only handling");
assert(dataCollectionBrief.includes("Data Collection Brief"), "data collection brief markdown must have title");
assert(dataCollectionBrief.includes("Sample Gate Fast Path"), "data collection brief must include sample gate fast path");
assert(dataCollectionBrief.includes("Live input files created: no"), "data collection brief markdown must state no live input files");
assert(dataCollectionBrief.includes("data/lp_events.jsonl write performed: no"), "data collection brief markdown must state no data write");
assert(dataCollectionBrief.includes("source_capture_ledger.filled.csv"), "data collection brief must point to filled ledger path");
assert(dataCollectionBrief.includes("Aggregate counts only") || dataCollectionBrief.includes("aggregate counts only"), "data collection brief must state aggregate-only handling");
assert(iterationHistory.ok === true, "iteration history must be ok");
assert(iterationHistory.mode === "iteration_history_local_only", "iteration history mode must be local-only");
assert(iterationHistory.cadence === "weekly_7_day_iteration", "iteration history cadence must be weekly 7-day iteration");
assert(["collect_more_data", "sample_ready_owner_review_required"].includes(iterationHistory.status), "iteration history status is invalid");
assert(iterationHistory.iteration_policy.one_variable_only === true, "iteration history must preserve one-variable policy");
assert(JSON.stringify(iterationHistory.iteration_policy.allowed_variables) === JSON.stringify(["hook", "offer", "visual_claim", "cta_text"]), "iteration history allowed variables mismatch");
assert(iterationHistory.current_round.changed_variable === nextRoundPlan.current_round.changed_variable, "iteration history current variable must match next-round plan");
assert(iterationHistory.sample_gate.sample_threshold_met === nextRoundPlan.sample_gate.sample_threshold_met, "iteration history sample gate must match next-round plan");
assert(Array.isArray(iterationHistory.north_star_per_100_clicks) && iterationHistory.north_star_per_100_clicks.length === scores.assets.length, "iteration history must include north-star rows for every asset");
assert(Number.isInteger(iterationHistory.archive_summary.archives_scanned), "iteration history must include archive scan count");
assert(Array.isArray(iterationHistory.archive_summary.latest_archives), "iteration history must include latest archive rows");
assert(Array.isArray(iterationHistory.next_safe_actions) && iterationHistory.next_safe_actions.length > 0, "iteration history must include next safe actions");
assert(iterationHistory.next_safe_actions.every((item) => item.external_effect === false), "iteration history next actions must have no external effects");
assert(iterationHistory.red_line_summary.violations.length === 0, "iteration history must not detect red-line violations");
assert(iterationHistory.external_effect === false, "iteration history must not claim external effects");
assert(iterationHistory.public_link_change_performed === false, "iteration history must not change public links");
assert(iterationHistory.production_deploy_performed === false, "iteration history must not deploy production");
assert(iterationHistory.github_push_or_pr_performed === false, "iteration history must not push or create PR");
assert(iterationHistory.formal_post_performed === false, "iteration history must not formally post");
assert(iterationHistory.line_push_performed === false, "iteration history must not push LINE");
assert(iterationHistory.customer_data_mutation_performed === false, "iteration history must not mutate customer data");
assert(iterationHistory.payment_action_performed === false, "iteration history must not touch payments");
assert(iterationHistory.delete_action_performed === false, "iteration history must not delete data");
assert(iterationHistoryMd.includes("Iteration History"), "iteration history markdown must have title");
assert(iterationHistoryMd.includes("iteration_history_ok"), "iteration history markdown must state ok");
assert(iterationHistoryMd.includes("External effect: no"), "iteration history markdown must state no external effect");
assert(iterationHistoryMd.includes("Next Safe Actions"), "iteration history markdown must include next safe actions");
assert(schedule.cadence === "weekly_sunday", "schedule cadence must be weekly_sunday");
assert(schedule.local_runner_command === "npm run weekly:local", "schedule must use weekly local runner");
assert(schedule.local_schedule.weekday === "Sunday", "local schedule must target Sunday");
assert(schedule.local_schedule.hour === 0, "local schedule hour must be 0");
assert(schedule.local_schedule.minute === 10, "local schedule minute must be 10");
assert(schedule.launchd_template === "launchd/com.angelia.3q-growth-loop.weekly.plist", "schedule must point to launchd template");
assert(schedule.launchd_installed === true, "schedule must claim LaunchAgent installed after local schedule install");
assert(schedule.install_performed === true, "schedule must record LaunchAgent install");
assert(schedule.file_installed === true, "schedule must record installed plist file");
assert(schedule.service_loaded === true, "schedule must record loaded LaunchAgent service");
assert(schedule.local_persistent_schedule === true, "schedule must record active local persistent schedule");
assert(schedule.external_effect === false, "schedule status must not claim external effects");
assert(schedule.worker_cron.production_deploy_performed === false, "worker cron must not claim production deploy");
assert(schedule.red_lines_preserved.production_deploy_performed === false, "schedule must preserve production deploy gate");
assert(schedule.red_lines_preserved.public_link_change_performed === false, "schedule must preserve public link gate");
assert(scheduleCatchup.ok === true, "schedule catch-up status must be ok");
assert(scheduleCatchup.mode === "weekly_schedule_catchup_monitor", "schedule catch-up must use monitor mode");
assert(scheduleCatchup.schedule.cadence === "weekly_sunday", "schedule catch-up must preserve weekly cadence");
assert(scheduleCatchup.schedule.weekday === "Sunday", "schedule catch-up must target Sunday");
assert(scheduleCatchup.schedule.timezone === "Asia/Taipei", "schedule catch-up must use Taipei timezone");
assert(typeof scheduleCatchup.latest_expected_run.utc === "string", "schedule catch-up must expose latest expected UTC run");
assert(typeof scheduleCatchup.next_expected_run.utc === "string", "schedule catch-up must expose next expected UTC run");
assert(typeof scheduleCatchup.next_safe_action === "string" && scheduleCatchup.next_safe_action.length > 0, "schedule catch-up must expose next safe action");
assert(scheduleCatchup.weekly_runner.ok === weeklyRunnerStatus.ok, "schedule catch-up weekly runner ok must match final weekly status");
assert(scheduleCatchup.weekly_runner.status === weeklyRunnerStatus.status, "schedule catch-up weekly runner status must match final weekly status");
assert(scheduleCatchup.weekly_runner.finished_at === weeklyRunnerStatus.finished_at, "schedule catch-up weekly runner finished_at must match final weekly status");
assert(scheduleCatchup.weekly_runner.commands === weeklyRunnerStatus.commands.length, "schedule catch-up weekly runner command count must match final weekly status");
assert(scheduleCatchup.weekly_runner.failed_commands === weeklyRunnerStatus.commands.filter((command) => command.status === "failed").length, "schedule catch-up failed command count must match final weekly status");
assert(scheduleCatchup.weekly_runner.pending_commands === weeklyRunnerStatus.commands.filter((command) => command.status === "pending").length, "schedule catch-up pending command count must match final weekly status");
assert(scheduleCatchup.weekly_runner.status !== "running", "schedule catch-up must not snapshot a running weekly status after weekly completion");
if (weeklyRunnerStatus.ok === true) {
  assert(scheduleCatchup.weekly_runner.status === "success", "schedule catch-up must see successful weekly status after weekly completion");
  assert(scheduleCatchup.weekly_runner.pending_commands === 0, "schedule catch-up must see zero pending weekly commands after weekly completion");
  assert(scheduleCatchup.weekly_runner.failed_commands === 0, "schedule catch-up must see zero failed weekly commands after weekly completion");
  assert(scheduleCatchup.status === "current_weekly_run_confirmed", "schedule catch-up must confirm the current weekly run after weekly completion");
  assert(scheduleCatchup.catchup_required === false, "schedule catch-up must not require catch-up after successful weekly completion");
}
assert(scheduleCatchup.weekly_runner_invoked === false, "schedule catch-up monitor must not invoke weekly runner");
assert(scheduleCatchup.catchup_run_performed === false, "schedule catch-up monitor must not perform catch-up run");
assert(scheduleCatchup.external_effect === false, "schedule catch-up must not claim external effects");
assert(scheduleCatchup.public_link_change_performed === false, "schedule catch-up must not change public links");
assert(scheduleCatchup.production_deploy_performed === false, "schedule catch-up must not deploy production");
assert(scheduleCatchup.github_push_or_pr_performed === false, "schedule catch-up must not push GitHub or PR");
assert(scheduleCatchup.formal_post_performed === false, "schedule catch-up must not formally post");
assert(scheduleCatchup.line_push_performed === false, "schedule catch-up must not push LINE");
assert(scheduleCatchup.customer_data_mutation_performed === false, "schedule catch-up must not mutate customer data");
assert(scheduleCatchup.payment_action_performed === false, "schedule catch-up must not touch payment");
assert(scheduleCatchup.delete_action_performed === false, "schedule catch-up must not delete data");
assert(scheduleCatchupMd.includes("Schedule Catch-Up Status"), "schedule catch-up report must include title");
assert(scheduleCatchupMd.includes(`Weekly runner status: ${weeklyRunnerStatus.status}`), "schedule catch-up report must show the completed weekly runner status");
assert(scheduleCatchupMd.includes("Pending commands at monitor time: 0"), "schedule catch-up report must show zero pending commands after weekly completion");
assert(scheduleCatchupMd.includes("Weekly runner invoked: no"), "schedule catch-up report must state it did not invoke weekly runner");
assert(scheduleCatchupMd.includes("External effect: no"), "schedule catch-up report must state no external effect");
assert(launchAgent.launchd_installed === true, "launchagent status must report installed");
assert(launchAgent.file_installed === true, "launchagent status must report installed plist");
assert(launchAgent.service_loaded === true, "launchagent status must report loaded service");
assert(launchAgent.local_persistent_schedule === true, "launchagent status must report persistent local schedule");
assert(launchAgent.launchctl_runtime?.run_count >= 1, "launchagent status must report at least one real service invocation");
assert(launchAgentRuntimeProof.ok === true, "launchagent status must prove either a completed exit-zero run or the current verified LaunchAgent run pending exit");
assert(["completed_exit_zero", "current_run_pending_exit"].includes(launchAgentRuntimeProof.proof_kind), "launchagent runtime proof kind must be explicit");
assert(launchAgent.external_effect === false, "launchagent install must not claim external effects");
assert(launchAgent.public_link_change_performed === false, "launchagent install must not claim public link changes");
assert(launchAgent.production_deploy_performed === false, "launchagent install must not claim production deploy");
assert(launchAgent.formal_post_performed === false, "launchagent install must not claim formal post");
assert(launchAgent.line_push_performed === false, "launchagent install must not claim LINE push");
assert(launchAgent.customer_data_mutation_performed === false, "launchagent install must not claim customer data mutation");
assert(launchAgent.payment_action_performed === false, "launchagent install must not claim payment action");
assert(launchAgent.delete_action_performed === false, "launchagent install must not claim delete action");
assert(launchdPlist.includes("npm run weekly:local"), "LaunchAgent template must call weekly local runner");
assert(launchdPlist.includes("/Users/mac/.local/bin"), "LaunchAgent template must include explicit local npm PATH");
assert(launchdPlist.includes("<key>Weekday</key>"), "LaunchAgent template must define weekday");
assert(launchdPlist.includes("<integer>0</integer>"), "LaunchAgent template must include Sunday / midnight values");
assert(manualConversion.ok === true, "manual conversion preview status must be ok");
assert(manualConversion.mode === "preview", "manual conversion verification must use preview mode");
assert(manualConversion.external_effect === false, "manual conversion import must not claim external effects");
assert(manualConversion.apply_performed === false, "manual conversion preview must not write to real events");
assert(manualConversion.append_performed === false, "manual conversion preview must not append");
assert(manualConversion.contains_sensitive_columns === false, "manual conversion CSV must not contain sensitive columns");
assert(manualConversion.contains_sensitive_values === false, "manual conversion CSV must not contain sensitive values");
assert(manualConversion.output_path.endsWith("/data/manual_conversions.preview.jsonl"), "manual conversion preview must write to preview JSONL");
assert(manualConversion.events_written === manualPreviewEvents.length, "manual conversion preview count must match JSONL lines");
assert(manualPreviewEvents.every((event) => ["line_add", "lead_submit", "deal", "quality_flag"].includes(event.event_type)), "manual preview must only include downstream aggregate event types");
assert(manualPreviewEvents.every((event) => event.metadata_json?.aggregate_only === true), "manual preview events must be aggregate-only");
assert(!/phone|email|line_user_id|customer_name|address|payment|card|note|memo|message|conversation/i.test(manualCsv), "manual example CSV must not include sensitive columns");
assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(manualPreviewRaw), "manual preview must not include email-like values");
assert(lineInbound.ok === true, "LINE inbound fixture status must be ok");
assert(lineInbound.mode === "line_inbound_fixture_dry_run", "LINE inbound fixture mode must be dry-run");
assert(lineInbound.scenario_count >= 6, "LINE inbound fixtures must cover at least six scenarios");
assert(lineInbound.execution_performed === false, "LINE inbound fixtures must not execute external commands");
assert(lineInbound.external_effect === false, "LINE inbound fixtures must not claim external effects");
assert(lineInbound.line_push_performed === false, "LINE inbound fixtures must not push LINE");
assert(lineInbound.customer_data_mutation_performed === false, "LINE inbound fixtures must not mutate customer data");
assert(lineInbound.payment_action_performed === false, "LINE inbound fixtures must not touch payments");
assert(lineInbound.delete_action_performed === false, "LINE inbound fixtures must not delete data");
assert(lineInbound.data_lp_events_write_performed === false, "LINE inbound fixtures must not write data/lp_events.jsonl");
for (const expected of [
  "allowed_line_add_count_row",
  "allowed_lead_submit_count_row",
  "blocked_phone_column",
  "blocked_email_value",
  "blocked_chat_message_column",
  "deal_stays_owner_confirmed_aggregate",
]) {
  assert(lineInbound.scenarios.some((scenario) => scenario.id === expected && scenario.ok === true), `LINE inbound fixture missing passing scenario ${expected}`);
}
assert(lineInboundPlaybookJson.policy.inbound_only === true, "LINE inbound playbook must be inbound-only");
assert(lineInboundPlaybookJson.policy.manual_reply_only === true, "LINE inbound playbook must be manual reply only");
assert(lineInboundPlaybookJson.policy.no_line_push === true, "LINE inbound playbook must block LINE push");
assert(lineInboundPlaybookJson.policy.no_customer_data_storage === true, "LINE inbound playbook must block customer-data storage");
assert(lineInboundPlaybookJson.policy.aggregate_or_pseudonymous_only === true, "LINE inbound playbook must be aggregate-only");
assert(lineInboundPlaybookJson.stages.every((stage) => ["line_add", "lead_submit", "deal", "quality_flag"].includes(stage.event_type)), "LINE inbound stages must map to allowed funnel events");
assert(lineInboundPlaybookJson.manual_conversion_contract.allowed_columns.every((column) => !/phone|email|line_user_id|customer_name|address|payment|card|note|memo|message|conversation/i.test(column)), "LINE inbound manual contract must not allow sensitive columns");
assert(variableRotation.ok === true, "variable rotation fixture status must be ok");
assert(variableRotation.mode === "variable_rotation_fixture_dry_run", "variable rotation fixture mode must be dry-run");
assert(variableRotation.scenario_count === 4, "variable rotation fixture must cover four variables");
assert(variableRotation.candidate_template_count >= 12, "variable rotation fixture must create at least three candidates per variable");
assert(JSON.stringify(variableRotation.allowed_variables) === JSON.stringify(["hook", "offer", "visual_claim", "cta_text"]), "variable rotation allowed variables must match objective");
assert(variableRotation.live_config_write_performed === false, "variable rotation fixture must not write live config");
assert(variableRotation.execution_performed === false, "variable rotation fixture must not execute external commands");
assert(variableRotation.external_effect === false, "variable rotation fixture must not claim external effects");
assert(variableRotation.public_link_change_performed === false, "variable rotation fixture must not change public links");
assert(variableRotation.production_deploy_performed === false, "variable rotation fixture must not deploy production");
assert(variableRotation.formal_post_performed === false, "variable rotation fixture must not formally post");
assert(variableRotation.line_push_performed === false, "variable rotation fixture must not push LINE");
assert(variableRotation.customer_data_mutation_performed === false, "variable rotation fixture must not mutate customer data");
assert(variableRotation.payment_action_performed === false, "variable rotation fixture must not touch payments");
assert(variableRotation.delete_action_performed === false, "variable rotation fixture must not delete data");
for (const expected of ["hook", "offer", "visual_claim", "cta_text"]) {
  const scenario = variableRotation.scenarios.find((item) => item.changed_variable === expected);
  assert(Boolean(scenario), `variable rotation fixture missing ${expected}`);
  assert(scenario.ok === true, `variable rotation fixture scenario must pass for ${expected}`);
  assert(scenario.allowed_by_config === true, `variable rotation fixture must be allowed by config for ${expected}`);
  assert(scenario.draft_count >= 3, `variable rotation fixture must have three drafts for ${expected}`);
  assert(scenario.changed_value_count >= 2, `variable rotation fixture must vary ${expected}`);
  assert(scenario.locked_variables_ok === true, `variable rotation fixture must keep locked variables stable for ${expected}`);
  assert(scenario.changed_only_ok === true, `variable rotation fixture must change only ${expected}`);
  assert(scenario.external_effect === false, `variable rotation fixture scenario must have no external effect for ${expected}`);
}
assert(workerDryRun.ok === true, "worker dry-run status must be ok");
assert(workerDryRun.mode === "worker_deploy_dry_run_status", "worker dry-run mode must match");
assert(workerDryRun.command === "wrangler deploy --dry-run", "worker dry-run command must be wrangler deploy --dry-run");
assert(workerDryRun.exit_code === 0, "worker dry-run exit code must be 0");
assert(workerDryRun.dry_run_exit_observed === true, "worker dry-run must observe dry-run exit");
assert(workerDryRun.required_markers_present === true, "worker dry-run must detect required bindings");
assert(Array.isArray(workerDryRun.failed_markers) && workerDryRun.failed_markers.length === 0, "worker dry-run must have no failed markers");
assert(workerDryRun.deploy_performed === false, "worker dry-run must not deploy");
assert(workerDryRun.production_deploy_performed === false, "worker dry-run must not claim production deploy");
assert(workerDryRun.external_effect === false, "worker dry-run must not claim external effects");
assert(workerDryRun.public_link_change_performed === false, "worker dry-run must not change public links");
assert(workerDryRun.formal_post_performed === false, "worker dry-run must not formally post");
assert(workerDryRun.line_push_performed === false, "worker dry-run must not push LINE");
assert(workerDryRun.customer_data_mutation_performed === false, "worker dry-run must not mutate customer data");
assert(workerDryRun.payment_action_performed === false, "worker dry-run must not touch payments");
assert(workerDryRun.delete_action_performed === false, "worker dry-run must not delete data");
assert(workerDryRunMd.includes("worker_dry_run_ok"), "worker dry-run report must state ok");
assert(workerDryRunMd.includes("Production deploy performed: no"), "worker dry-run report must state no production deploy");
assert(workerDryRunMd.includes("External effect: no"), "worker dry-run report must state no external effect");
assert(browserSmoke.ok === true, "browser smoke status must be ok");
assert(browserSmoke.external_effect === false, "browser smoke must not claim external effects");
assert(browserSmoke.event_write_performed === false, "browser smoke must not write events");
assert(browserSmoke.public_link_change_performed === false, "browser smoke must not change public links");
assert(browserSmoke.production_deploy_performed === false, "browser smoke must not deploy production");
assert(browserSmoke.formal_post_performed === false, "browser smoke must not formally post");
assert(browserSmoke.line_push_performed === false, "browser smoke must not push LINE");
assert(browserSmoke.customer_data_mutation_performed === false, "browser smoke must not mutate customer data");
assert(browserSmoke.payment_action_performed === false, "browser smoke must not touch payment actions");
assert(browserSmoke.delete_action_performed === false, "browser smoke must not delete data");
assert(Array.isArray(browserSmoke.checks) && browserSmoke.checks.length >= 5, "browser smoke checks missing");
for (const expected of ["health", "candidate_page", "candidate_attribution_script", "ab_status", "ab_champion_target_ready"]) {
  assert(browserSmoke.checks.some((check) => check.name === expected && check.ok === true), `browser smoke missing successful ${expected} check`);
}
assert(browserSmoke.checks.every((check) => check.external_effect === false), "browser smoke checks must not claim external effects");
assert(trackingLinkSmoke.ok === true, "tracking link smoke status must be ok");
assert(trackingLinkSmoke.mode === "isolated_local_tracking_link_smoke", "tracking link smoke must use isolated local mode");
assert(trackingLinkSmoke.external_effect === false, "tracking link smoke must not claim external effects");
assert(trackingLinkSmoke.isolated_fixture_event_write_performed === true, "tracking link smoke must write isolated fixture link clicks");
assert(trackingLinkSmoke.real_event_write_performed === false, "tracking link smoke must not write real events");
assert(trackingLinkSmoke.data_lp_events_write_performed === false, "tracking link smoke must not write data/lp_events.jsonl");
assert(trackingLinkSmoke.public_link_change_performed === false, "tracking link smoke must not change public links");
assert(trackingLinkSmoke.production_deploy_performed === false, "tracking link smoke must not deploy production");
assert(trackingLinkSmoke.github_push_or_pr_performed === false, "tracking link smoke must not push or create PR");
assert(trackingLinkSmoke.formal_post_performed === false, "tracking link smoke must not formally post");
assert(trackingLinkSmoke.line_push_performed === false, "tracking link smoke must not push LINE");
assert(trackingLinkSmoke.customer_data_mutation_performed === false, "tracking link smoke must not mutate customer data");
assert(trackingLinkSmoke.payment_action_performed === false, "tracking link smoke must not touch payments");
assert(trackingLinkSmoke.delete_action_performed === false, "tracking link smoke must not delete data");
assert(trackingLinkSmoke.links_checked === links.links.length, "tracking link smoke must check every generated tracking link");
assert(trackingLinkSmoke.expected_link_count === links.links.length, "tracking link smoke expected link count must match tracking_links.json");
assert(trackingLinkSmoke.isolated_link_click_events_written >= links.links.length, "tracking link smoke must write isolated link_click rows for generated links");
assert(Array.isArray(trackingLinkSmoke.checks) && trackingLinkSmoke.checks.length === links.links.length, "tracking link smoke checks must match link count");
assert(trackingLinkSmoke.checks.every((check) => check.ok === true && check.status === 302), "tracking link smoke checks must all pass as 302 redirects");
assert(trackingLinkSmoke.checks.every((check) => check.external_effect === false && check.followed_external_url === false), "tracking link smoke must not follow external URLs or claim effects");
for (const link of links.links) {
  const check = trackingLinkSmoke.checks.find((item) => item.link_id === link.link_id);
  assert(Boolean(check), `tracking link smoke missing ${link.link_id}`);
  if (link.target === "challenger") {
    const linkUrl = new URL(link.tracking_url);
    const expectedContentId = link.content_id ?? linkUrl.searchParams.get("content_id");
    const expectedVariantId = link.variant_id ?? linkUrl.searchParams.get("variant_id");
    assert(check.observed?.pathname === "/candidate", `tracking link smoke must redirect ${link.link_id} to candidate`);
    assert(check.observed?.asset_id === link.asset_id, `tracking link smoke asset mismatch for ${link.link_id}`);
    assert(check.observed?.content_id === expectedContentId, `tracking link smoke content_id mismatch for ${link.link_id}`);
    assert(check.observed?.variant_id === expectedVariantId, `tracking link smoke variant_id mismatch for ${link.link_id}`);
    assert(check.observed?.utm_source === "manual_review", `tracking link smoke utm_source mismatch for ${link.link_id}`);
    assert(check.observed?.utm_medium === "growth_loop", `tracking link smoke utm_medium mismatch for ${link.link_id}`);
    assert(check.observed?.utm_campaign === "week0-cta-text", `tracking link smoke utm_campaign mismatch for ${link.link_id}`);
  }
}
assert(trackingLinkSmoke.checks.some((check) => check.role === "ab_small_traffic" && check.observed?.variant_id === "ab-week0-cta-text-001:challenger" && /-ab-router$/.test(check.observed?.content_id ?? "")), "tracking link smoke must verify A/B challenger attribution for the scored week");
const expectedLineDestination = links.links.find((link) => link.target === "line")?.destination_url;
const expectedChampionDestination = links.links.find((link) => link.target === "champion")?.destination_url;
const sameUrlOriginAndPath = (actual, expected) => {
  try {
    const actualUrl = new URL(actual);
    const expectedUrl = new URL(expected);
    return actualUrl.origin === expectedUrl.origin && actualUrl.pathname === expectedUrl.pathname;
  } catch {
    return false;
  }
};
assert(trackingLinkSmoke.checks.some((check) => check.target === "line" && check.location === expectedLineDestination), "tracking link smoke must verify configured LINE redirect without following it");
assert(trackingLinkSmoke.checks.some((check) => check.target === "champion" && sameUrlOriginAndPath(check.location, expectedChampionDestination)), "tracking link smoke must verify the live champion origin/path without following it while allowing generated attribution parameters");
assert(trackingLinkSmokeMd.includes("Tracking Link Smoke"), "tracking link smoke markdown must include title");
assert(trackingLinkSmokeMd.includes("External effect: no"), "tracking link smoke markdown must state no external effect");
assert(eventContractSmoke.ok === true, "event contract smoke status must be ok");
assert(eventContractSmoke.mode === "isolated_local_event_contract_smoke", "event contract smoke must use isolated local mode");
assert(eventContractSmoke.external_effect === false, "event contract smoke must not claim external effects");
assert(eventContractSmoke.isolated_fixture_event_write_performed === true, "event contract smoke must write synthetic fixture events");
assert(eventContractSmoke.real_event_write_performed === false, "event contract smoke must not write real events");
assert(eventContractSmoke.data_lp_events_write_performed === false, "event contract smoke must not write data/lp_events.jsonl");
assert(eventContractSmoke.public_link_change_performed === false, "event contract smoke must not change public links");
assert(eventContractSmoke.production_deploy_performed === false, "event contract smoke must not deploy production");
assert(eventContractSmoke.github_push_or_pr_performed === false, "event contract smoke must not push or create PR");
assert(eventContractSmoke.formal_post_performed === false, "event contract smoke must not formally post");
assert(eventContractSmoke.line_push_performed === false, "event contract smoke must not push LINE");
assert(eventContractSmoke.customer_data_mutation_performed === false, "event contract smoke must not mutate customer data");
assert(eventContractSmoke.payment_action_performed === false, "event contract smoke must not touch payments");
assert(eventContractSmoke.delete_action_performed === false, "event contract smoke must not delete data");
assert(eventContractSmoke.sensitive_rows_written === 0, "event contract smoke must not write sensitive rows");
assert(eventContractSmoke.sensitive_rejection?.ok === true, "event contract smoke must reject sensitive metadata");
assert(eventContractSmoke.invalid_event_rejection?.ok === true, "event contract smoke must reject invalid event types");
assert(eventContractSmoke.sensitive_token_rejection?.ok === true, "event contract smoke must reject PII-like top-level session tokens");
assert(eventContractSmoke.phone_campaign_rejection?.ok === true, "event contract smoke must reject phone-like campaign tokens");
assert(eventContractSmoke.embedded_phone_session_rejection?.ok === true, "event contract smoke must reject embedded phone-like session tokens");
assert(eventContractSmoke.numeric_phone_metadata_rejection?.ok === true, "event contract smoke must reject numeric phone-like metadata values");
assert(eventContractSmoke.url_path_pii_rejection?.ok === true, "event contract smoke must reject encoded PII in URL paths");
assert(eventContractSmoke.public_event_field_rejection?.ok === true, "event contract smoke must reject conversion and quality fields from public ingest");
assert(eventContractSmoke.body_limit?.declared_length_rejected === true && eventContractSmoke.body_limit?.chunked_stream_rejected === true, "event contract smoke must enforce the 8KB body limit for declared and chunked bodies");
assert(eventContractSmoke.cors_contract?.ok === true, "event contract smoke must verify champion cross-origin ingestion");
assert(eventContractSmoke.cors_contract?.preflight?.status === 204, "event contract smoke must allow champion CORS preflight");
assert(eventContractSmoke.cors_contract?.missing_origin_post?.status === 403 && eventContractSmoke.cors_contract?.missing_origin_post?.body?.error === "origin_not_allowed", "event contract smoke must reject POSTs without Origin");
assert(eventContractSmoke.cors_contract?.preflight?.allow_origin === "https://3q-site.milk790.workers.dev", "event CORS must use the exact champion origin");
assert(eventContractSmoke.cors_contract?.allowed_post?.status === 200, "event CORS must allow the configured champion origin");
assert(eventContractSmoke.cors_contract?.denied_post?.status === 403, "event CORS must reject unconfigured origins");
assert(eventContractSmoke.cors_contract?.allowed_event_rows === 1 && eventContractSmoke.cors_contract?.denied_event_rows === 0, "event CORS must persist only the allowed-origin fixture");
assert(eventContractSmoke.redirect_attribution?.ok === true, "event contract smoke must preserve redirect attribution into candidate URL");
assert(eventContractSmoke.redirect_attribution?.observed?.asset_id === "challenger-week0-cta-text-v1", "redirect attribution must preserve asset_id");
assert(eventContractSmoke.redirect_attribution?.observed?.content_id === "event-contract-redirect-content", "redirect attribution must preserve content_id");
assert(eventContractSmoke.redirect_attribution?.observed?.variant_id === "event-contract-redirect-variant", "redirect attribution must preserve variant_id");
assert(eventContractSmoke.ab_redirect_attribution?.ok === true, "event contract smoke must preserve A/B challenger redirect attribution into candidate URL");
assert(eventContractSmoke.ab_redirect_attribution?.observed?.asset_id === "challenger-week0-cta-text-v1", "A/B redirect attribution must preserve challenger asset_id");
assert(eventContractSmoke.ab_redirect_attribution?.observed?.content_id === "event-contract-ab-content", "A/B redirect attribution must preserve content_id");
assert(eventContractSmoke.ab_redirect_attribution?.observed?.variant_id === "ab-week0-cta-text-001:challenger", "A/B redirect attribution must preserve generated challenger variant_id");
assert(eventContractSmoke.invalid_ab_sid_rejection?.ok === true && eventContractSmoke.embedded_phone_ab_sid_rejection?.ok === true, "A/B route must reject non-UUID and embedded-phone session ids");
for (const eventType of ["page_view", "cta_click"]) {
  assert(eventContractSmoke.event_type_counts?.[eventType] === 1, `event contract smoke must write one synthetic ${eventType}`);
}
for (const eventType of ["link_click", "line_add", "lead_submit", "deal", "quality_flag"]) {
  assert(!eventContractSmoke.event_type_counts?.[eventType], `public event contract must not write ${eventType}`);
  assert(eventContractSmoke.blocked_public_events?.some((item) => item.event_type === eventType && item.status === 400 && item.error === "event_type_not_allowed_public"), `public event contract must reject ${eventType}`);
}
assert(eventContractSmoke.scheduled_trigger?.ok === true, "event contract smoke must trigger the isolated scheduled handler");
assert(eventContractSmoke.scheduled_quality_regression?.ok === true, "event contract smoke must verify scheduled quality-regression blocking");
assert(eventContractSmoke.scheduled_quality_regression?.challenger?.decision === "reject_quality_regression", "scheduled scorer must reject quality regression");
assert(Number(eventContractSmoke.scheduled_quality_regression?.challenger?.sample_threshold_met) === 1, "scheduled quality-regression fixture must meet sample threshold");
assert(Number(eventContractSmoke.scheduled_quality_regression?.challenger?.no_quality_regression) === 0, "scheduled quality-regression fixture must fail no_quality_regression");
assert(Number(eventContractSmoke.scheduled_quality_regression?.challenger?.metadata?.low_quality_flags) > 0, "scheduled quality-regression metadata must record low quality flags");
assert(winRuleFixture.ok === true, "win-rule fixture status must be ok");
assert(winRuleFixture.mode === "win_rule_fixture_dry_run", "win-rule fixture mode must be dry-run");
assert(winRuleFixture.scenario_count >= 4, "win-rule fixture must cover at least four scenarios");
assert(winRuleFixture.real_event_write_performed === false, "win-rule fixture must not write real events");
assert(winRuleFixture.external_effect === false, "win-rule fixture must not claim external effects");
assert(winRuleFixture.production_deploy_performed === false, "win-rule fixture must not deploy production");
assert(winRuleFixture.public_link_change_performed === false, "win-rule fixture must not change public links");
assert(winRuleFixture.challenger_promotion_performed === false, "win-rule fixture must not promote challenger");
assert(winRuleFixture.formal_post_performed === false, "win-rule fixture must not formally post");
assert(winRuleFixture.line_push_performed === false, "win-rule fixture must not push LINE");
assert(winRuleFixture.customer_data_mutation_performed === false, "win-rule fixture must not mutate customer data");
assert(winRuleFixture.payment_action_performed === false, "win-rule fixture must not touch payment");
assert(winRuleFixture.delete_action_performed === false, "win-rule fixture must not delete data");
for (const expected of [
  "sample_insufficient_keeps_champion",
  "win_rule_queues_human_promotion_only",
  "sample_met_underperform_rework",
  "quality_regression_blocks_promotion",
  "lead_rate_regression_blocks_promotion",
  "close_rate_regression_blocks_promotion",
]) {
  assert(winRuleFixture.scenarios.some((scenario) => scenario.id === expected && scenario.ok === true), `win-rule fixture missing passing scenario ${expected}`);
}
const fixtureWinScenario = winRuleFixture.scenarios.find((scenario) => scenario.id === "win_rule_queues_human_promotion_only");
assert(fixtureWinScenario?.ab_status?.decision === "queue_human_promotion_review", "winning fixture must queue human promotion review");
assert(fixtureWinScenario?.promotion_performed === false, "winning fixture must not perform promotion");
assert(decisionReplay.ok === true, "real-data decision replay status must be ok");
assert(decisionReplay.mode === "real_data_decision_replay_fixture_dry_run", "real-data decision replay mode must be dry-run");
assert(decisionReplay.scenario_count === 6, "real-data decision replay must cover six scenarios");
assert(decisionReplay.local_fixture_commands_executed === true, "real-data decision replay must execute local fixture commands");
assert(decisionReplay.local_importer_preview_commands_executed === true, "real-data decision replay must execute local importer previews");
assert(decisionReplay.source_capture_ledger_replay_executed === true, "real-data decision replay must execute source-capture ledger replay");
assert(decisionReplay.source_capture_compile_commands_executed === true, "real-data decision replay must execute source-capture compile commands");
assert(decisionReplay.ledger_to_decision_replay_performed === true, "real-data decision replay must cover ledger-to-decision path");
assert(decisionReplay.execution_performed === false, "real-data decision replay must not execute external commands");
assert(decisionReplay.real_events_unchanged === true, "real-data decision replay must leave real events unchanged");
assert(decisionReplay.real_event_write_performed === false, "real-data decision replay must not write real events");
assert(decisionReplay.data_lp_events_write_performed === false, "real-data decision replay must not write data/lp_events.jsonl");
assert(decisionReplay.external_effect === false, "real-data decision replay must not claim external effects");
assert(decisionReplay.production_deploy_performed === false, "real-data decision replay must not deploy production");
assert(decisionReplay.public_link_change_performed === false, "real-data decision replay must not change public links");
assert(decisionReplay.github_push_or_pr_performed === false, "real-data decision replay must not push or create PR");
assert(decisionReplay.formal_post_performed === false, "real-data decision replay must not formally post");
assert(decisionReplay.line_push_performed === false, "real-data decision replay must not push LINE");
assert(decisionReplay.customer_data_mutation_performed === false, "real-data decision replay must not mutate customer data");
assert(decisionReplay.payment_action_performed === false, "real-data decision replay must not touch payment");
assert(decisionReplay.delete_action_performed === false, "real-data decision replay must not delete data");
for (const expected of [
  "sample_insufficient_replay",
  "winning_replay_owner_review_only",
  "underperform_replay_next_variable",
  "spam_regression_replay",
  "lead_regression_replay",
  "close_regression_replay",
]) {
  const scenario = decisionReplay.scenarios.find((item) => item.id === expected);
  assert(scenario?.ok === true, `real-data decision replay missing passing scenario ${expected}`);
  assert(scenario.source_capture_compile?.ok === true, `real-data decision replay source compile failed for ${expected}`);
  assert(scenario.source_capture_compile?.status === "owner_preview_ready", `real-data decision replay source compile must produce owner preview for ${expected}`);
  assert(scenario.source_capture_compile?.data_lp_events_write_performed === false, `real-data decision replay source compile must not write real events: ${expected}`);
  assert(scenario.source_capture_compile?.external_effect === false, `real-data decision replay source compile must have no external effect: ${expected}`);
  assert(scenario.importer_status?.funnel_ok === true, `real-data decision replay funnel import failed for ${expected}`);
  assert(scenario.importer_status?.manual_ok === true, `real-data decision replay manual import failed for ${expected}`);
  assert(scenario.data_lp_events_write_performed === false, `real-data decision replay must not write real events: ${expected}`);
  assert(scenario.external_effect === false, `real-data decision replay must have no external effect: ${expected}`);
}
const replayWinScenario = decisionReplay.scenarios.find((scenario) => scenario.id === "winning_replay_owner_review_only");
assert(replayWinScenario?.ab_status?.decision === "queue_human_promotion_review", "winning real-data replay must queue human promotion review");
assert(replayWinScenario?.promotion_performed === false, "winning real-data replay must not perform promotion");
const replaySampleScenario = decisionReplay.scenarios.find((scenario) => scenario.id === "sample_insufficient_replay");
assert(replaySampleScenario?.next_round_summary?.decision === "continue_current_round_until_sample_threshold", "sample-insufficient replay must keep current round");
const replayUnderperformScenario = decisionReplay.scenarios.find((scenario) => scenario.id === "underperform_replay_next_variable");
assert(replayUnderperformScenario?.next_round_summary?.changed_variable === "hook", "underperform replay must rotate next variable to hook after cta_text");
assert(launchReadiness.status === "owner_approval_required", "launch readiness must remain owner-gated");
assert(launchReadiness.owner_decision_required === true, "launch readiness must require owner decision");
assert(launchReadiness.local_preflight_ok === true, "launch readiness local preflight must pass");
assert(launchReadiness.pending_human_approval_count === approvalStatus.pending_human_count, "launch readiness pending human count must match current evidence-backed approval queue");
assert(launchReadiness.local_preflight.some((item) => item.id === "candidate_worker_dry_run" && item.ok === true), "launch readiness must include passing candidate Worker dry-run preflight");
assert(launchReadiness.local_preflight.some((item) => item.id === "live_telemetry_chain_readiness" && item.ok === true), "launch readiness must include passing live telemetry readiness monitor");
assert(launchReadiness.evidence.worker_dry_run_ok === true, "launch readiness evidence must include Worker dry-run ok");
assert(launchReadiness.evidence.worker_dry_run_exit_observed === true, "launch readiness evidence must include Worker dry-run exit");
assert(launchReadiness.evidence.worker_dry_run_required_markers_present === true, "launch readiness evidence must include Worker dry-run bindings");
assert(launchReadiness.evidence.worker_dry_run_production_deploy_performed === false, "launch readiness Worker dry-run must not claim production deploy");
assert(launchReadiness.evidence.worker_dry_run_external_effect === false, "launch readiness Worker dry-run must not claim external effects");
assert(launchReadiness.local_preflight.some((item) => item.id === "real_data_decision_replay" && item.ok === true), "launch readiness must include passing real-data decision replay preflight");
assert(launchReadiness.evidence.real_data_decision_replay_ok === true, "launch readiness evidence must include real-data decision replay ok");
assert(launchReadiness.evidence.real_data_decision_replay_scenarios === 6, "launch readiness evidence must include six decision replay scenarios");
assert(launchReadiness.evidence.real_data_decision_replay_local_importer_previews === true, "launch readiness evidence must include decision replay importer previews");
assert(launchReadiness.evidence.real_data_decision_replay_source_capture_ledger === true, "launch readiness evidence must include decision replay source-capture ledger");
assert(launchReadiness.evidence.real_data_decision_replay_source_compile_commands === true, "launch readiness evidence must include decision replay source compile commands");
assert(launchReadiness.evidence.real_data_decision_replay_ledger_to_decision === true, "launch readiness evidence must include decision replay ledger-to-decision path");
assert(launchReadiness.evidence.real_data_decision_replay_data_write === false, "launch readiness decision replay must not write data/lp_events.jsonl");
assert(launchReadiness.evidence.real_data_decision_replay_external_effect === false, "launch readiness decision replay must not claim external effects");
assert(launchReadiness.prepared_artifacts.includes("real_data_decision_replay_report.md"), "launch readiness must include real-data decision replay report artifact");
assert(launchReadiness.prepared_artifacts.includes("data/real_data_decision_replay_status.json"), "launch readiness must include real-data decision replay status artifact");
for (const expected of [
  "remote_d1_create_and_migrate",
  "candidate_worker_production_deploy",
  "public_ab_small_traffic_link",
  "github_repo_branch_pr",
  "formal_posts_line_push_payment_customer_data",
]) {
  assert(launchReadiness.owner_gates.some((gate) => gate.id === expected), `launch readiness missing owner gate ${expected}`);
}
const launchD1Gate = launchReadiness.owner_gates.find((gate) => gate.id === "remote_d1_create_and_migrate");
assert(launchD1Gate?.supporting_artifacts?.includes("d1_schema_contract.md"), "launch D1 gate must link the local idempotency contract");
assert(launchD1Gate?.supporting_artifacts?.includes("approved_d1_config.md"), "launch D1 gate must link the approved-id config guard");
if (cloudflareD1Readiness.decision?.configured_id_matches === true) {
  assert(launchD1Gate?.operation_mode === "verify_existing_d1_then_migrate_schema", "launch D1 gate must switch to existing-database verification mode");
  assert(launchD1Gate?.resource_create_required === false, "launch D1 gate must state that no new D1 resource is required");
  assert(launchD1Gate?.display_label?.includes("Existing D1"), "launch D1 gate must present an existing-D1 approval label");
  assert(!launchD1Gate?.resume_commands?.some((command) => command.includes("d1 create")), "launch D1 gate must not recreate an already matched dedicated database");
  assert(!launchD1Gate?.resume_commands?.includes("npm run d1:config:apply"), "launch D1 gate must not rewrite an already matched D1 binding");
} else {
  assert(launchD1Gate?.resume_commands?.includes("npm run d1:config:apply"), "launch D1 gate must include the guarded local config apply step when binding is not matched");
}
assert(launchD1Gate?.resume_commands?.some((command) => command.includes("PRAGMA integrity_check")), "launch D1 gate must include post-migration integrity verification");
const launchWorkerGate = launchReadiness.owner_gates.find((gate) => gate.id === "candidate_worker_production_deploy");
assert(["deploy_candidate_worker_security_update", "verify_existing_candidate_deployment"].includes(launchWorkerGate?.operation_mode), "launch Candidate gate must expose the current security/provenance mode");
assert(launchWorkerGate?.resource_deploy_required === candidateNeedsSecurityUpdate, "launch Candidate gate must mirror whether a security redeploy is currently required");
assert(launchWorkerGate?.prepared_artifact === (candidateNeedsSecurityUpdate ? "worker.ts" : "live_telemetry_readiness.md"), "launch Candidate gate must use the current review artifact");
assert(candidateNeedsSecurityUpdate
  ? launchWorkerGate?.resume_commands?.some((command) => command.trim() === "wrangler deploy")
  : !launchWorkerGate?.resume_commands?.some((command) => command.trim() === "wrangler deploy"), "launch Candidate gate deploy command must follow the current owner-gated mode");
const launchGithubGate = launchReadiness.owner_gates.find((gate) => gate.id === "github_repo_branch_pr");
assert(launchGithubGate?.prepared_artifact === "champion_github_handoff.md", "launch GitHub gate must use the exact Champion repository handoff");
assert(launchGithubGate?.current_blocker?.includes("external GitHub write"), "launch GitHub gate must describe the remaining external GitHub write");
assert(launchGithubGate?.owner_action?.includes(championGithubHandoff.local_branch.commit), "launch GitHub gate must target the current reviewed local head");
assert(launchGithubGate?.resume_commands?.some((command) => command.includes("milk790-code/3q-hatchery-line-oa")), "launch GitHub gate must target the known source repository");
assert(launchGithubGate?.resume_commands?.some((command) => command.includes("codex/3q-growth-loop-champion-v1")), "launch GitHub gate must target the prepared feature branch");
assert(!launchGithubGate?.resume_commands?.some((command) => command.includes("git init")), "launch GitHub gate must not tell the owner to initialize a new repository for the Champion patch");
assert(launchReadiness.owner_gates.every((gate) => gate.status === "owner_approval_required" || gate.status === "manual_only"), "launch owner gates must remain approval/manual only");
assert(launchReadiness.owner_gates.every((gate) => gate.external_effect === true), "launch owner gates must be marked external effect");
assert(launchReadiness.safety_invariants.formal_post_performed === false, "launch readiness must not claim formal post");
assert(launchReadiness.safety_invariants.public_link_change_performed === false, "launch readiness must not claim public link change");
assert(launchReadiness.safety_invariants.challenger_promotion_performed === false, "launch readiness must not claim challenger promotion");
assert(launchReadiness.safety_invariants.line_push_performed === false, "launch readiness must not claim LINE push");
assert(launchReadiness.safety_invariants.ecpay_payment_or_refund_performed === false, "launch readiness must not claim ECPay action");
assert(launchReadiness.safety_invariants.customer_data_mutation_performed === false, "launch readiness must not claim customer data mutation");
assert(launchReadiness.safety_invariants.production_deploy_performed === false, "launch readiness must not claim production deploy");
assert(launchReadiness.safety_invariants.data_delete_performed === false, "launch readiness must not claim data delete");
assert(launchReadiness.prepared_artifacts.includes("owner_approval_pack.md"), "launch readiness must point to owner approval pack");
assert(launchReadiness.prepared_artifacts.includes("approval_resume_plan.md"), "launch readiness must point to approval resume plan");
assert(launchReadiness.prepared_artifacts.includes("post_gate_verification.md"), "launch readiness must point to post-gate verification plan");
assert(launchReadiness.prepared_artifacts.includes("data/post_gate_verification_status.json"), "launch readiness must point to post-gate verification status");
assert(launchReadiness.prepared_artifacts.includes("win_rule_fixture_report.md"), "launch readiness must point to win-rule fixture report");
assert(launchReadiness.prepared_artifacts.includes("data/week_archive_status.json"), "launch readiness must point to week archive status");
assert(launchReadiness.prepared_artifacts.includes("data/event_contract_smoke_status.json"), "launch readiness must point to event contract smoke status");
assert(launchReadiness.prepared_artifacts.includes("d1_schema_contract.md"), "launch readiness must point to the D1 schema contract");
assert(launchReadiness.prepared_artifacts.includes("data/d1_schema_contract_status.json"), "launch readiness must point to D1 schema contract status");
assert(launchReadiness.prepared_artifacts.includes("approved_d1_config.md"), "launch readiness must point to the approved D1 config guard");
assert(launchReadiness.prepared_artifacts.includes("live_telemetry_readiness.md"), "launch readiness must point to live telemetry readiness");
assert(launchReadiness.prepared_artifacts.includes("data/live_telemetry_readiness_status.json"), "launch readiness must point to live telemetry readiness status");
assert(launchReadiness.prepared_artifacts.includes("live_telemetry_readiness_fixture_report.md"), "launch readiness must point to live telemetry readiness fixtures");
assert(launchReadiness.prepared_artifacts.includes("champion_github_handoff.md"), "launch readiness must point to the Champion GitHub handoff");
assert(launchReadiness.prepared_artifacts.includes("champion_github_pr_body.md"), "launch readiness must point to the Champion draft PR body");
assert(launchReadiness.prepared_artifacts.includes("data/event_input_quality_status.json"), "launch readiness must point to event input quality status");
assert(launchReadiness.prepared_artifacts.includes("data/funnel_aggregate_status.json"), "launch readiness must point to full-funnel aggregate status");
assert(launchReadiness.prepared_artifacts.includes("data/funnel_aggregates.example.csv"), "launch readiness must point to full-funnel aggregate example");
assert(launchReadiness.prepared_artifacts.includes("data/funnel_aggregates.preview.jsonl"), "launch readiness must point to full-funnel aggregate preview");
assert(launchReadiness.prepared_artifacts.includes("data/real_data_apply_fixture_status.json"), "launch readiness must point to real-data apply fixture status");
assert(launchReadiness.prepared_artifacts.includes("real_data_apply_fixture_report.md"), "launch readiness must point to real-data apply fixture report");
assert(launchReadiness.prepared_artifacts.includes("source_capture_pack.md"), "launch readiness must point to source capture pack");
assert(launchReadiness.prepared_artifacts.includes("data/source_capture_status.json"), "launch readiness must point to source capture status");
assert(launchReadiness.prepared_artifacts.includes("data/source_capture/source_capture_checklist.json"), "launch readiness must point to source capture checklist");
assert(launchReadiness.prepared_artifacts.includes("data/source_capture/source_capture_ledger.fill-template.csv"), "launch readiness must point to source capture ledger template");
assert(launchReadiness.prepared_artifacts.includes("data/source_capture/sample_gate_ledger.fill-template.csv"), "launch readiness must point to sample-gate ledger template");
assert(launchReadiness.prepared_artifacts.includes("sample_gate_ledger.md"), "launch readiness must point to sample-gate ledger report");
assert(launchReadiness.prepared_artifacts.includes("data/sample_gate_ledger_status.json"), "launch readiness must point to sample-gate ledger status");
assert(launchReadiness.prepared_artifacts.includes("sample_gate_ledger_compile_probe.md"), "launch readiness must point to sample-gate compile probe report");
assert(launchReadiness.prepared_artifacts.includes("data/sample_gate_ledger_compile_probe_status.json"), "launch readiness must point to sample-gate compile probe status");
assert(launchReadiness.prepared_artifacts.includes("source_capture_compile_report.md"), "launch readiness must point to source compile report");
assert(launchReadiness.prepared_artifacts.includes("data/source_capture_compile_status.json"), "launch readiness must point to source compile status");
assert(launchReadiness.prepared_artifacts.includes("source_capture_compile_fixture_report.md"), "launch readiness must point to source compile fixture report");
assert(launchReadiness.prepared_artifacts.includes("data/source_capture_compile_fixture_status.json"), "launch readiness must point to source compile fixture status");
assert(launchReadiness.prepared_artifacts.includes("data/source_capture/compiled/funnel_aggregates.owner-preview.csv"), "launch readiness must point to source compile funnel preview");
assert(launchReadiness.prepared_artifacts.includes("data/source_capture/compiled/manual_conversions.owner-preview.csv"), "launch readiness must point to source compile manual preview");
assert(launchReadiness.prepared_artifacts.includes("data/real_data_intake_status.json"), "launch readiness must point to real-data intake status");
assert(launchReadiness.prepared_artifacts.includes("real_data_intake_plan.md"), "launch readiness must point to real-data intake plan");
assert(launchReadiness.prepared_artifacts.includes("data_collection_queue.json"), "launch readiness must point to data collection queue");
assert(launchReadiness.prepared_artifacts.includes("data_collection_brief.md"), "launch readiness must point to data collection brief");
assert(launchReadiness.prepared_artifacts.includes("data/data_collection_brief_status.json"), "launch readiness must point to data collection brief status");
assert(launchReadiness.prepared_artifacts.includes("data_collection_progress.md"), "launch readiness must point to data collection progress report");
assert(launchReadiness.prepared_artifacts.includes("data_collection_progress.json"), "launch readiness must point to data collection progress JSON");
assert(launchReadiness.prepared_artifacts.includes("data/data_collection_progress_status.json"), "launch readiness must point to data collection progress status");
assert(launchReadiness.prepared_artifacts.includes("next_p0_owner_inputs.md"), "launch readiness must point to next P0 owner inputs report");
assert(launchReadiness.prepared_artifacts.includes("next_p0_owner_inputs.json"), "launch readiness must point to next P0 owner inputs JSON");
assert(launchReadiness.prepared_artifacts.includes("data/next_p0_owner_inputs_status.json"), "launch readiness must point to next P0 owner inputs status");
assert(launchReadiness.prepared_artifacts.includes("next_p0_owner_form.html"), "launch readiness must point to next P0 owner form");
assert(launchReadiness.prepared_artifacts.includes("data/next_p0_owner_form_status.json"), "launch readiness must point to next P0 owner form status");
assert(launchReadiness.prepared_artifacts.includes("next_p0_owner_form_fixture_report.md"), "launch readiness must point to next P0 owner form fixture report");
assert(launchReadiness.prepared_artifacts.includes("data/next_p0_owner_form_fixture_status.json"), "launch readiness must point to next P0 owner form fixture status");
assert(launchReadiness.prepared_artifacts.includes("next_p0_owner_intake.md"), "launch readiness must point to next P0 owner intake report");
assert(launchReadiness.prepared_artifacts.includes("data/next_p0_owner_intake_status.json"), "launch readiness must point to next P0 owner intake status");
assert(launchReadiness.prepared_artifacts.includes("next_p0_owner_intake_fixture_report.md"), "launch readiness must point to next P0 owner intake fixture report");
assert(launchReadiness.prepared_artifacts.includes("data/next_p0_owner_intake_fixture_status.json"), "launch readiness must point to next P0 owner intake fixture status");
assert(launchReadiness.prepared_artifacts.includes("data/next_p0_owner_intake/funnel_aggregates.owner-preview.csv"), "launch readiness must point to next P0 owner intake funnel preview");
assert(launchReadiness.prepared_artifacts.includes("data/next_p0_owner_intake/manual_conversions.owner-preview.csv"), "launch readiness must point to next P0 owner intake manual preview");
assert(launchReadiness.prepared_artifacts.includes("sample_gate_collection_plan.md"), "launch readiness must point to sample gate collection plan");
assert(launchReadiness.prepared_artifacts.includes("sample_gate_collection_plan.json"), "launch readiness must point to sample gate collection plan JSON");
assert(launchReadiness.prepared_artifacts.includes("data/sample_gate_collection_plan_status.json"), "launch readiness must point to sample gate collection status");
assert(launchReadiness.prepared_artifacts.includes("line_inbound_playbook.md"), "launch readiness must point to LINE inbound playbook");
assert(launchReadiness.prepared_artifacts.includes("data/line_inbound_fixture_status.json"), "launch readiness must point to LINE inbound fixture status");
assert(launchReadiness.prepared_artifacts.includes("tracking_link_smoke.md"), "launch readiness must point to tracking link smoke report");
assert(launchReadiness.prepared_artifacts.includes("data/tracking_link_smoke_status.json"), "launch readiness must point to tracking link smoke status");
assert(launchReadiness.prepared_artifacts.includes("funnel_breakdown.json"), "launch readiness must point to funnel breakdown JSON");
assert(launchReadiness.prepared_artifacts.includes("funnel_breakdown.md"), "launch readiness must point to funnel breakdown markdown");
assert(launchReadiness.prepared_artifacts.includes("next_round_plan.json"), "launch readiness must point to next round plan JSON");
assert(launchReadiness.prepared_artifacts.includes("next_round_plan.md"), "launch readiness must point to next round plan markdown");
assert(launchReadiness.local_preflight.some((item) => item.id === "next_round_plan" && item.ok === true), "launch readiness must preflight next round plan");
assert(launchReadiness.local_preflight.some((item) => item.id === "tracking_link_smoke" && item.ok === true), "launch readiness must preflight tracking link smoke");
assert(launchReadiness.local_preflight.some((item) => item.id === "event_contract_smoke" && item.ok === true), "launch readiness must preflight event contract smoke");
assert(launchReadiness.local_preflight.some((item) => item.id === "event_input_quality_gate" && item.ok === true), "launch readiness must preflight event input quality gate");
assert(launchReadiness.local_preflight.some((item) => item.id === "funnel_aggregate_preview" && item.ok === true), "launch readiness must preflight full-funnel aggregate preview");
assert(launchReadiness.local_preflight.some((item) => item.id === "real_data_apply_fixtures" && item.ok === true), "launch readiness must preflight real-data apply fixtures");
assert(launchReadiness.local_preflight.some((item) => item.id === "source_capture_pack" && item.ok === true), "launch readiness must preflight source capture pack");
assert(launchReadiness.local_preflight.some((item) => item.id === "source_capture_compile" && item.ok === true), "launch readiness must preflight source capture compile");
assert(launchReadiness.local_preflight.some((item) => item.id === "source_capture_compile_fixtures" && item.ok === true), "launch readiness must preflight source capture compile fixtures");
assert(launchReadiness.local_preflight.some((item) => item.id === "real_data_intake_plan" && item.ok === true), "launch readiness must preflight real-data intake plan");
assert(launchReadiness.local_preflight.some((item) => item.id === "data_collection_brief" && item.ok === true), "launch readiness must preflight data collection brief");
assert(launchReadiness.local_preflight.some((item) => item.id === "data_collection_progress" && item.ok === true), "launch readiness must preflight data collection progress");
assert(launchReadiness.local_preflight.some((item) => item.id === "next_p0_owner_form" && item.ok === true), "launch readiness must preflight next P0 owner form");
assert(launchReadiness.local_preflight.some((item) => item.id === "next_p0_owner_form_fixtures" && item.ok === true), "launch readiness must preflight next P0 owner form fixtures");
assert(launchReadiness.local_preflight.some((item) => item.id === "next_p0_owner_intake" && item.ok === true), "launch readiness must preflight next P0 owner intake");
assert(launchReadiness.local_preflight.some((item) => item.id === "next_p0_owner_intake_fixtures" && item.ok === true), "launch readiness must preflight next P0 owner intake fixtures");
assert(launchReadiness.local_preflight.some((item) => item.id === "line_inbound_playbook" && item.ok === true), "launch readiness must preflight LINE inbound playbook");
assert(launchReadiness.local_preflight.some((item) => item.id === "content_variant_tracking" && item.ok === true), "launch readiness must preflight content variant tracking");
assert(launchReadiness.evidence.real_data_apply_guard_ok === true, "launch readiness evidence must include real-data apply guard ok");
assert(launchReadiness.evidence.real_data_apply_guard_scenarios === 4, "launch readiness evidence must include four real-data apply scenarios");
assert(launchReadiness.evidence.real_data_apply_guard_data_write === false, "launch readiness evidence must show real-data apply guard does not write data/lp_events.jsonl");
assert(launchReadiness.evidence.source_capture_ok === true, "launch readiness evidence must include source capture ok");
assert(launchReadiness.evidence.data_collection_progress_status === dataCollectionProgressStatus.status, "launch readiness evidence must include data collection progress status");
assert(launchReadiness.evidence.data_collection_progress_total_tasks === dataCollectionProgressStatus.total_task_count, "launch readiness evidence must include data collection progress total tasks");
assert(launchReadiness.evidence.data_collection_progress_pending_tasks === dataCollectionProgressStatus.pending_task_count, "launch readiness evidence must include data collection progress pending tasks");
assert(launchReadiness.evidence.data_collection_progress_p0_pending === dataCollectionProgressStatus.p0_pending_count, "launch readiness evidence must include data collection progress P0 pending count");
assert(launchReadiness.evidence.data_collection_progress_p1_pending === dataCollectionProgressStatus.p1_pending_count, "launch readiness evidence must include data collection progress P1 pending count");
assert(launchReadiness.evidence.data_collection_progress_data_write === false, "launch readiness data collection progress must not write data/lp_events.jsonl");
assert(launchReadiness.evidence.data_collection_progress_external_effect === false, "launch readiness data collection progress must not claim external effects");
assert(launchReadiness.evidence.next_p0_owner_form_status === nextP0OwnerFormStatus.status, "launch readiness evidence must include next P0 owner form status");
assert(launchReadiness.evidence.next_p0_owner_form_rows === nextP0OwnerFormStatus.row_count, "launch readiness evidence must include next P0 owner form rows");
assert(launchReadiness.evidence.next_p0_owner_form_browser_only === true, "launch readiness evidence must mark next P0 owner form browser-only");
assert(launchReadiness.evidence.next_p0_owner_form_network_calls === false, "launch readiness evidence must show next P0 owner form has no network calls");
assert(launchReadiness.evidence.next_p0_owner_form_data_write === false, "launch readiness evidence must show next P0 owner form does not write data/lp_events.jsonl");
assert(launchReadiness.evidence.next_p0_owner_form_external_effect === false, "launch readiness evidence must show next P0 owner form has no external effect");
assert(launchReadiness.evidence.next_p0_owner_form_fixture_ok === true, "launch readiness evidence must include next P0 owner form fixture ok");
assert(launchReadiness.evidence.next_p0_owner_form_fixture_scenarios === nextP0OwnerFormFixture.scenario_count, "launch readiness evidence must include next P0 owner form fixture scenarios");
assert(launchReadiness.evidence.next_p0_owner_form_fixture_data_write === false, "launch readiness evidence must show next P0 owner form fixture does not write data/lp_events.jsonl");
assert(launchReadiness.evidence.next_p0_owner_form_fixture_external_effect === false, "launch readiness evidence must show next P0 owner form fixture has no external effect");
assert(launchReadiness.evidence.next_p0_owner_intake_status === nextP0OwnerIntake.status, "launch readiness evidence must include next P0 owner intake status");
assert(launchReadiness.evidence.next_p0_owner_intake_candidate_found === nextP0OwnerIntake.candidate_found, "launch readiness evidence must include next P0 owner intake candidate state");
assert(launchReadiness.evidence.next_p0_owner_intake_preview_rows === nextP0OwnerIntake.funnel_preview_rows + nextP0OwnerIntake.manual_preview_rows, "launch readiness evidence must include next P0 owner intake preview rows");
assert(launchReadiness.evidence.next_p0_owner_intake_stage_performed === false, "launch readiness evidence must show next P0 owner intake does not stage");
assert(launchReadiness.evidence.next_p0_owner_intake_live_input_files_created === false, "launch readiness evidence must show next P0 owner intake creates no live inputs");
assert(launchReadiness.evidence.next_p0_owner_intake_data_write === false, "launch readiness evidence must show next P0 owner intake does not write data/lp_events.jsonl");
assert(launchReadiness.evidence.next_p0_owner_intake_external_effect === false, "launch readiness evidence must show next P0 owner intake has no external effect");
assert(launchReadiness.evidence.next_p0_owner_intake_fixture_ok === true, "launch readiness evidence must include next P0 owner intake fixture ok");
assert(launchReadiness.evidence.next_p0_owner_intake_fixture_scenarios === nextP0OwnerIntakeFixture.scenario_count, "launch readiness evidence must include next P0 owner intake fixture scenarios");
assert(launchReadiness.evidence.next_p0_owner_intake_fixture_live_project_inputs_created === false, "launch readiness evidence must show next P0 owner intake fixture creates no project live inputs");
assert(launchReadiness.evidence.next_p0_owner_intake_fixture_data_write === false, "launch readiness evidence must show next P0 owner intake fixture does not write data/lp_events.jsonl");
assert(launchReadiness.evidence.next_p0_owner_intake_fixture_external_effect === false, "launch readiness evidence must show next P0 owner intake fixture has no external effect");
assert(launchReadiness.evidence.source_capture_ledger_rows === sourceCapture.ledger_rows, "launch readiness source capture rows must match status");
assert(launchReadiness.evidence.source_capture_sample_gate_rows === sourceCapture.sample_gate_ledger_rows, "launch readiness sample-gate source capture rows must match status");
assert(launchReadiness.evidence.source_capture_live_input_files_created === false, "launch readiness evidence must show source capture creates no live inputs");
assert(launchReadiness.evidence.source_capture_data_write === false, "launch readiness evidence must show source capture does not write data/lp_events.jsonl");
assert(launchReadiness.evidence.source_compile_ok === true, "launch readiness evidence must include source compile ok");
assert(launchReadiness.evidence.source_compile_status === sourceCompile.status, "launch readiness source compile status must match");
assert(launchReadiness.evidence.source_compile_filled_rows === sourceCompile.filled_rows, "launch readiness source compile filled rows must match");
assert(launchReadiness.evidence.source_compile_live_input_files_created === false, "launch readiness evidence must show source compile creates no live inputs");
assert(launchReadiness.evidence.source_compile_data_write === false, "launch readiness evidence must show source compile does not write data/lp_events.jsonl");
assert(launchReadiness.evidence.source_compile_fixture_ok === true, "launch readiness evidence must include source compile fixture ok");
assert(launchReadiness.evidence.source_compile_fixture_scenarios === sourceCompileFixture.scenario_count, "launch readiness source compile fixture scenarios must match");
assert(launchReadiness.evidence.source_compile_fixture_data_write === false, "launch readiness evidence must show source compile fixtures do not write data/lp_events.jsonl");
assert(["no_real_input_files", "preview_ready_owner_apply_required", "input_attention_required"].includes(launchReadiness.evidence.real_data_intake_status), "launch readiness evidence must include valid real-data intake status");
assert(launchReadiness.evidence.real_data_intake_data_write === false, "launch readiness evidence must show real-data intake does not write data/lp_events.jsonl");
assert(launchReadiness.evidence.data_collection_brief_ok === true, "launch readiness evidence must include data collection brief ok");
assert(launchReadiness.evidence.data_collection_brief_tasks === dataCollectionStatus.task_count, "launch readiness data collection task count must match status");
assert(launchReadiness.evidence.sample_gate_p0_tasks === sampleGateStatus.p0_task_count, "launch readiness sample gate task count must match status");
assert(launchReadiness.evidence.sample_gate_p0_links === sampleGateStatus.p0_link_count, "launch readiness sample gate link count must match status");
assert(launchReadiness.evidence.data_collection_brief_data_write === false, "launch readiness evidence must show data collection brief does not write data/lp_events.jsonl");
assert(launchReadiness.evidence.data_collection_brief_external_effect === false, "launch readiness evidence must show data collection brief has no external effect");
assert(launchReadiness.evidence.tracking_link_smoke_ok === true, "launch readiness evidence must include tracking link smoke ok");
assert(launchReadiness.evidence.tracking_link_smoke_links_checked === links.links.length, "launch readiness evidence must include tracking link count");
assert(launchReadiness.evidence.tracking_link_smoke_real_write === false, "launch readiness evidence must show tracking smoke does not write real events");
assert(launchReadiness.evidence.tracking_link_smoke_data_write === false, "launch readiness evidence must show tracking smoke does not write data/lp_events.jsonl");
assert(launchReadiness.evidence.live_telemetry_readiness_status === liveTelemetryReadiness.status, "launch readiness evidence must mirror live telemetry readiness status");
assert(launchReadiness.evidence.live_telemetry_candidate_deployment_observed === true
  && launchReadiness.evidence.live_telemetry_candidate_deploy_required === candidateNeedsSecurityUpdate,
"launch readiness evidence must recognize the existing Candidate and mirror its current security-update or provenance-only mode");
assert(launchReadiness.evidence.live_telemetry_observed_chain_ready_for_owner_evidence === true, "launch readiness evidence must expose observed chain readiness for owner evidence");
assert(launchReadiness.evidence.live_telemetry_ingest_readiness_proven === expectedLiveIngestProven && launchReadiness.evidence.live_telemetry_weekly_aggregate_read_authorized === expectedWeeklyAggregateReadAuthorized, "launch readiness evidence must mirror current ingest proof and recurring-read authorization");
assert(approvalResumeStatus.status === "prepared_but_blocked" || approvalResumeStatus.status === "owner_approval_detected_plan_only", "approval resume status must stay plan-only");
assert(approvalResumeStatus.execution_performed === false, "approval resume plan must not execute external commands");
assert(approvalResumeStatus.external_effect === false, "approval resume plan must not claim external effects");
assert(approvalResumeStatus.remote_d1_create_performed === false, "approval resume plan must not create remote D1");
assert(approvalResumeStatus.remote_d1_migration_performed === false, "approval resume plan must not migrate remote D1");
assert(approvalResumeStatus.production_deploy_performed === false, "approval resume plan must not deploy production");
assert(approvalResumeStatus.public_link_change_performed === false, "approval resume plan must not change public links");
assert(approvalResumeStatus.github_push_or_pr_performed === false, "approval resume plan must not push or create PR");
assert(approvalResumeStatus.formal_post_performed === false, "approval resume plan must not formally post");
assert(approvalResumeStatus.line_push_performed === false, "approval resume plan must not push LINE");
assert(approvalResumeStatus.customer_data_mutation_performed === false, "approval resume plan must not mutate customer data");
assert(approvalResumeStatus.payment_action_performed === false, "approval resume plan must not touch payments");
assert(approvalResumeStatus.delete_action_performed === false, "approval resume plan must not delete data");
for (const expected of [
  "remote_d1_create_and_migrate",
  "candidate_worker_production_deploy",
  "public_ab_small_traffic_link",
  "github_repo_branch_pr",
  "formal_posts_line_push_payment_customer_data",
]) {
  assert(approvalResumeStatus.owner_gate_plans.some((gate) => gate.gate_id === expected), `approval resume missing gate ${expected}`);
}
assert(approvalResumeStatus.owner_gate_plans.every((gate) => gate.execution_policy === "dry_run_plan_only"), "approval resume gates must be dry-run plan only");
assert(ownerGateEvidence.ok === true, "owner gate evidence status must be ok while missing input is waiting or supplied input is valid");
assert(ownerGateEvidence.mode === "owner_gate_evidence_intake", "owner gate evidence mode must be owner_gate_evidence_intake");
assert(["waiting_for_owner_evidence", "partial_owner_evidence_validated", "owner_evidence_validated_ready_for_post_gate_verification", "owner_evidence_detected_no_gate_ready"].includes(ownerGateEvidence.status), "owner gate evidence status is invalid");
assert(ownerGateEvidence.evidence_only === true, "owner gate evidence must be evidence-only");
assert(ownerGateEvidence.owner_decision_required === true, "owner gate evidence must require owner decision");
assert(ownerGateEvidence.execution_performed === false, "owner gate evidence must not execute commands");
assert(ownerGateEvidence.external_effect === false, "owner gate evidence must not claim external effects");
assert(ownerGateEvidence.remote_d1_create_performed === false, "owner gate evidence must not create remote D1");
assert(ownerGateEvidence.remote_d1_migration_performed === false, "owner gate evidence must not migrate remote D1");
assert(ownerGateEvidence.production_deploy_performed === false, "owner gate evidence must not deploy production");
assert(ownerGateEvidence.public_link_change_performed === false, "owner gate evidence must not change public links");
assert(ownerGateEvidence.github_push_or_pr_performed === false, "owner gate evidence must not push or create PR");
assert(ownerGateEvidence.formal_post_performed === false, "owner gate evidence must not formally post");
assert(ownerGateEvidence.line_push_performed === false, "owner gate evidence must not push LINE");
assert(ownerGateEvidence.customer_data_mutation_performed === false, "owner gate evidence must not mutate customer data");
assert(ownerGateEvidence.payment_action_performed === false, "owner gate evidence must not touch payments");
assert(ownerGateEvidence.delete_action_performed === false, "owner gate evidence must not delete data");
assert(ownerGateEvidence.sensitive_evidence_detected === false, "owner gate evidence must not contain sensitive evidence");
assert(ownerGateEvidence.issue_count === 0, "owner gate evidence must have no validation issues unless intentionally blocking bad owner evidence");
assert(Array.isArray(ownerGateEvidence.gates) && ownerGateEvidence.gates.length === launchReadiness.owner_gates.length, "owner gate evidence must cover every launch owner gate");
for (const expected of [
  "remote_d1_create_and_migrate",
  "candidate_worker_production_deploy",
  "public_ab_small_traffic_link",
  "github_repo_branch_pr",
  "formal_posts_line_push_payment_customer_data",
]) {
  assert(ownerGateEvidence.gates.some((gate) => gate.gate_id === expected), `owner gate evidence missing gate ${expected}`);
}
assert(ownerGateEvidence.gates.every((gate) => gate.evidence_intake_external_effect === false && gate.executed_by_this_script === false), "owner gate evidence gates must not execute or create external effects");
assert(ownerGateEvidenceExample.evidence.some((item) => item.gate_id === "remote_d1_create_and_migrate"), "owner gate evidence example must include remote D1 evidence shape");
assert(ownerGateEvidenceExample.evidence.find((item) => item.gate_id === "remote_d1_create_and_migrate")?.recurring_aggregate_read_approved === true, "owner gate evidence example must explicitly scope recurring aggregate-only reads");
assert(ownerGateEvidenceExample.evidence.some((item) => item.gate_id === "github_repo_branch_pr"), "owner gate evidence example must include GitHub evidence shape");
assert(ownerGateEvidence.expected_github_target?.commit_ref === championGithubHandoff.local_branch.commit, "owner evidence validator must derive the current Champion head from the handoff");
assert(ownerGateEvidenceExample.evidence.find((item) => item.gate_id === "github_repo_branch_pr")?.commit_ref === championGithubHandoff.local_branch.commit, "owner evidence example must use the current Champion head");
assert(ownerGateEvidenceMd.includes("Owner Gate Evidence"), "owner gate evidence markdown must have title");
assert(ownerGateEvidenceMd.includes("Evidence only: yes"), "owner gate evidence markdown must state evidence-only");
assert(ownerGateEvidenceMd.includes("Execution performed: no"), "owner gate evidence markdown must state no execution");
assert(ownerGateEvidenceMd.includes("External effect: no"), "owner gate evidence markdown must state no external effect");
assert(ownerGateEvidenceFixture.ok === true, "owner gate evidence fixture status must be ok");
assert(ownerGateEvidenceFixture.mode === "owner_gate_evidence_fixture_dry_run", "owner gate evidence fixture mode must be dry-run");
assert(ownerGateEvidenceFixture.scenario_count >= 9, "owner gate evidence fixtures must cover at least nine scenarios");
assert(ownerGateEvidenceFixture.local_fixture_commands_executed === true, "owner gate evidence fixtures must execute local fixture commands");
assert(ownerGateEvidenceFixture.owner_gate_evidence_fixture_executed === true, "owner gate evidence fixtures must execute owner evidence verifier");
assert(ownerGateEvidenceFixture.execution_performed === false, "owner gate evidence fixtures must not execute external commands");
assert(ownerGateEvidenceFixture.external_effect === false, "owner gate evidence fixtures must not claim external effects");
assert(ownerGateEvidenceFixture.remote_d1_create_performed === false, "owner gate evidence fixtures must not create remote D1");
assert(ownerGateEvidenceFixture.remote_d1_migration_performed === false, "owner gate evidence fixtures must not migrate remote D1");
assert(ownerGateEvidenceFixture.production_deploy_performed === false, "owner gate evidence fixtures must not deploy production");
assert(ownerGateEvidenceFixture.public_link_change_performed === false, "owner gate evidence fixtures must not change public links");
assert(ownerGateEvidenceFixture.github_push_or_pr_performed === false, "owner gate evidence fixtures must not push or create PR");
assert(ownerGateEvidenceFixture.formal_post_performed === false, "owner gate evidence fixtures must not formally post");
assert(ownerGateEvidenceFixture.line_push_performed === false, "owner gate evidence fixtures must not push LINE");
assert(ownerGateEvidenceFixture.customer_data_mutation_performed === false, "owner gate evidence fixtures must not mutate customer data");
assert(ownerGateEvidenceFixture.payment_action_performed === false, "owner gate evidence fixtures must not touch payments");
assert(ownerGateEvidenceFixture.delete_action_performed === false, "owner gate evidence fixtures must not delete data");
for (const expected of [
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
]) {
  const scenario = ownerGateEvidenceFixture.scenarios.find((item) => item.id === expected);
  assert(scenario?.ok === true, `owner gate evidence fixture missing passing scenario ${expected}`);
  assert(scenario.execution_performed === false, `owner gate evidence fixture must not execute external action: ${expected}`);
  assert(scenario.external_effect === false, `owner gate evidence fixture must not claim external effect: ${expected}`);
}
assert(ownerGateEvidenceFixture.scenarios.find((item) => item.id === "valid_all_non_manual_evidence_ready_for_post_gate_verification")?.ready_gate_count === 4, "owner evidence fixture must prove all non-manual gates can become post-gate ready");
assert(ownerGateEvidenceFixture.scenarios.find((item) => item.id === "remote_d1_without_recurring_read_approval_keeps_schema_evidence_valid")?.ready_gate_count === 1, "owner evidence fixture must keep valid schema evidence while recurring remote reads remain separately disabled");
assert(ownerGateEvidenceFixture.scenarios.find((item) => item.id === "manual_only_acknowledgement_never_opens_post_gate")?.ready_gate_count === 0, "manual-only evidence fixture must not open a post-gate ready state");
assert(ownerGateEvidenceFixtureReport.includes("owner_gate_evidence_fixtures_ok"), "owner gate evidence fixture report must state fixtures ok");
assert(ownerGateEvidenceFixtureReport.includes("sensitive_or_customer_evidence_blocks_gate"), "owner gate evidence fixture report must include sensitive/customer block scenario");
assert(ownerGateEvidenceFixtureReport.includes("manual_only_acknowledgement_never_opens_post_gate"), "owner gate evidence fixture report must include manual-only scenario");
assert(ownerGateEvidenceFixtureReport.includes("Execution performed: no"), "owner gate evidence fixture report must state no execution");
assert(postGateVerification.ok === true, "post-gate verification status must be ok");
assert(postGateVerification.mode === "post_gate_verification_plan", "post-gate verification mode must be post_gate_verification_plan");
assert(["waiting_for_owner_evidence", "owner_evidence_detected_no_post_gate_verification_ready", "partial_post_gate_verification_plan_ready", "post_gate_verification_plan_ready"].includes(postGateVerification.status), "post-gate verification status is invalid");
assert(postGateVerification.no_network_read_performed === true, "post-gate verification must not perform network reads");
assert(postGateVerification.no_remote_cli_performed === true, "post-gate verification must not run remote CLI");
assert(postGateVerification.no_actual_evidence_values_persisted === true, "post-gate verification must not persist actual evidence values");
assert(postGateVerification.execution_performed === false, "post-gate verification must not execute external follow-up");
assert(postGateVerification.external_effect === false, "post-gate verification must not claim external effects");
assert(postGateVerification.remote_d1_create_performed === false, "post-gate verification must not create remote D1");
assert(postGateVerification.remote_d1_migration_performed === false, "post-gate verification must not migrate remote D1");
assert(postGateVerification.production_deploy_performed === false, "post-gate verification must not deploy production");
assert(postGateVerification.public_link_change_performed === false, "post-gate verification must not change public links");
assert(postGateVerification.github_push_or_pr_performed === false, "post-gate verification must not push or create PR");
assert(postGateVerification.formal_post_performed === false, "post-gate verification must not formally post");
assert(postGateVerification.line_push_performed === false, "post-gate verification must not push LINE");
assert(postGateVerification.customer_data_mutation_performed === false, "post-gate verification must not mutate customer data");
assert(postGateVerification.payment_action_performed === false, "post-gate verification must not touch payments");
assert(postGateVerification.delete_action_performed === false, "post-gate verification must not delete data");
assert(Array.isArray(postGateVerification.gates) && postGateVerification.gates.length === launchReadiness.owner_gates.length, "post-gate verification must cover every launch owner gate");
for (const expected of [
  "remote_d1_create_and_migrate",
  "candidate_worker_production_deploy",
  "public_ab_small_traffic_link",
  "github_repo_branch_pr",
  "formal_posts_line_push_payment_customer_data",
]) {
  assert(postGateVerification.gates.some((gate) => gate.gate_id === expected), `post-gate verification missing gate ${expected}`);
}
assert(postGateVerification.gates.every((gate) => gate.safe_to_run_automatically === false && gate.external_effect === false && gate.execution_performed === false), "post-gate verification gates must not be automatic or external-effecting");
const postGateD1 = postGateVerification.gates.find((gate) => gate.gate_id === "remote_d1_create_and_migrate");
assert(typeof postGateD1?.recurring_aggregate_read_approved === "boolean", "post-gate D1 plan must expose recurring aggregate-read approval state");
assert(postGateVerificationMd.includes("Post-Gate Verification"), "post-gate verification markdown must have title");
assert(postGateVerificationMd.includes("recurring_aggregate_read_approved"), "post-gate verification markdown must expose recurring aggregate-read approval");
assert(postGateVerificationMd.includes("No network read performed: yes"), "post-gate verification markdown must state no network read");
assert(postGateVerificationMd.includes("No remote CLI performed: yes"), "post-gate verification markdown must state no remote CLI");
assert(postGateVerificationMd.includes("External effect: no"), "post-gate verification markdown must state no external effect");
assert(postGateVerificationFixture.ok === true, "post-gate verification fixture status must be ok");
assert(postGateVerificationFixture.mode === "post_gate_verification_fixture_dry_run", "post-gate verification fixture mode must be dry-run");
assert(postGateVerificationFixture.scenario_count >= 9, "post-gate verification fixtures must cover at least nine scenarios");
assert(postGateVerificationFixture.local_fixture_commands_executed === true, "post-gate verification fixtures must execute local fixture commands");
assert(postGateVerificationFixture.owner_gate_evidence_fixture_executed === true, "post-gate verification fixtures must execute owner evidence verifier");
assert(postGateVerificationFixture.post_gate_verification_fixture_executed === true, "post-gate verification fixtures must execute post-gate verifier");
assert(postGateVerificationFixture.execution_performed === false, "post-gate verification fixtures must not execute external commands");
assert(postGateVerificationFixture.external_effect === false, "post-gate verification fixtures must not claim external effects");
assert(postGateVerificationFixture.remote_d1_create_performed === false, "post-gate verification fixtures must not create remote D1");
assert(postGateVerificationFixture.remote_d1_migration_performed === false, "post-gate verification fixtures must not migrate remote D1");
assert(postGateVerificationFixture.production_deploy_performed === false, "post-gate verification fixtures must not deploy production");
assert(postGateVerificationFixture.public_link_change_performed === false, "post-gate verification fixtures must not change public links");
assert(postGateVerificationFixture.github_push_or_pr_performed === false, "post-gate verification fixtures must not push or create PR");
assert(postGateVerificationFixture.formal_post_performed === false, "post-gate verification fixtures must not formally post");
assert(postGateVerificationFixture.line_push_performed === false, "post-gate verification fixtures must not push LINE");
assert(postGateVerificationFixture.customer_data_mutation_performed === false, "post-gate verification fixtures must not mutate customer data");
assert(postGateVerificationFixture.payment_action_performed === false, "post-gate verification fixtures must not touch payments");
assert(postGateVerificationFixture.delete_action_performed === false, "post-gate verification fixtures must not delete data");
for (const expected of [
  "waiting_for_owner_evidence_stays_plan_only",
  "remote_d1_evidence_ready_only",
  "remote_d1_without_recurring_read_approval_allows_schema_plan_only",
  "worker_evidence_requires_remote_d1_ready",
  "public_ab_requires_worker_evidence_ready",
  "github_evidence_ready_plan_only",
  "all_non_manual_evidence_ready_plan_only",
  "manual_only_acknowledgement_never_opens_post_gate",
  "invalid_owner_evidence_blocks_post_verify",
]) {
  const scenario = postGateVerificationFixture.scenarios.find((item) => item.id === expected);
  assert(scenario?.ok === true, `post-gate verification fixture missing passing scenario ${expected}`);
  assert(scenario.no_network_read_performed === true, `post-gate verification fixture must not read network: ${expected}`);
  assert(scenario.no_remote_cli_performed === true, `post-gate verification fixture must not run remote CLI: ${expected}`);
  assert(scenario.execution_performed === false, `post-gate verification fixture must not execute external action: ${expected}`);
  assert(scenario.external_effect === false, `post-gate verification fixture must not claim external effect: ${expected}`);
}
assert(postGateVerificationFixture.scenarios.find((item) => item.id === "all_non_manual_evidence_ready_plan_only")?.ready_gate_count === 4, "post-gate fixtures must prove all non-manual gates can become ready for plan-only follow-up");
assert(postGateVerificationFixture.scenarios.find((item) => item.id === "manual_only_acknowledgement_never_opens_post_gate")?.ready_gate_count === 0, "post-gate fixtures must keep manual-only acknowledgement out of post-gate readiness");
assert(postGateVerificationFixture.scenarios.find((item) => item.id === "invalid_owner_evidence_blocks_post_verify")?.post_gate_status === "blocked_invalid_owner_evidence", "post-gate fixtures must block invalid owner evidence");
assert(postGateVerificationFixtureReport.includes("post_gate_verification_fixtures_ok"), "post-gate verification fixture report must state fixtures ok");
assert(postGateVerificationFixtureReport.includes("remote_d1_without_recurring_read_approval_allows_schema_plan_only"), "post-gate verification fixture report must include separate schema/read-scope scenario");
assert(postGateVerificationFixtureReport.includes("worker_evidence_requires_remote_d1_ready"), "post-gate verification fixture report must include Worker dependency scenario");
assert(postGateVerificationFixtureReport.includes("manual_only_acknowledgement_never_opens_post_gate"), "post-gate verification fixture report must include manual-only scenario");
assert(postGateVerificationFixtureReport.includes("Execution performed: no"), "post-gate verification fixture report must state no execution");
assert(gateReadiness.ok === true, "gate readiness status must be ok");
assert(gateReadiness.mode === "gate_readiness_matrix", "gate readiness mode must be gate_readiness_matrix");
assert(["prepared_but_blocked", "owner_metadata_ready_plan_only"].includes(gateReadiness.status), "gate readiness status is invalid");
assert(gateReadiness.no_gate_execution === true, "gate readiness must explicitly perform no gate execution");
assert(gateReadiness.no_autorun_for_external_gates === true, "gate readiness must keep external gates out of autorun");
assert(typeof gateReadiness.post_gate_verification_status === "string", "gate readiness must include post-gate verification status");
assert(Number.isInteger(gateReadiness.post_gate_ready_count), "gate readiness must include post-gate ready count");
assert(gateReadiness.execution_performed === false, "gate readiness must not execute commands");
assert(gateReadiness.external_effect === false, "gate readiness must not claim external effects");
assert(gateReadiness.remote_d1_create_performed === false, "gate readiness must not create remote D1");
assert(gateReadiness.remote_d1_migration_performed === false, "gate readiness must not migrate remote D1");
assert(gateReadiness.production_deploy_performed === false, "gate readiness must not deploy production");
assert(gateReadiness.public_link_change_performed === false, "gate readiness must not change public links");
assert(gateReadiness.github_push_or_pr_performed === false, "gate readiness must not push or create PR");
assert(gateReadiness.formal_post_performed === false, "gate readiness must not formally post");
assert(gateReadiness.line_push_performed === false, "gate readiness must not push LINE");
assert(gateReadiness.customer_data_mutation_performed === false, "gate readiness must not mutate customer data");
assert(gateReadiness.payment_action_performed === false, "gate readiness must not touch payments");
assert(gateReadiness.delete_action_performed === false, "gate readiness must not delete data");
assert(gateReadiness.git_repo_present === false, "control-center bundle must not be mistaken for the Champion git repo");
assert(gateReadiness.champion_repo_prepared === true, "gate readiness must recognize the verified Champion repository handoff");
assert(gateReadiness.champion_repository === "milk790-code/3q-hatchery-line-oa", "gate readiness must expose the exact Champion repository");
assert(gateReadiness.champion_branch === "codex/3q-growth-loop-champion-v1", "gate readiness must expose the exact Champion branch");
assert(gateReadiness.weekly_runner_ok === true, "final gate readiness must read a completed successful weekly status");
assert(Array.isArray(gateReadiness.gates) && gateReadiness.gates.length === launchReadiness.owner_gates.length, "gate readiness must cover every launch owner gate");
for (const expected of [
  "remote_d1_create_and_migrate",
  "candidate_worker_production_deploy",
  "public_ab_small_traffic_link",
  "github_repo_branch_pr",
  "formal_posts_line_push_payment_customer_data",
]) {
  assert(gateReadiness.gates.some((gate) => gate.gate_id === expected), `gate readiness missing gate ${expected}`);
}
assert(gateReadiness.gates.every((gate) => gate.no_autorun === true && gate.ready_for_autorun === false && gate.executed === false), "gate readiness gates must never be autorun-ready or executed");
assert(gateReadiness.gates.every((gate) => ["plan_only_owner_executes", "manual_only"].includes(gate.execution_policy)), "gate readiness execution policies must remain plan-only/manual-only");
assert(gateReadiness.gates.some((gate) => gate.gate_id === "remote_d1_create_and_migrate" && gate.order === 1), "gate readiness must put remote D1 first");
const d1GateReadiness = gateReadiness.gates.find((gate) => gate.gate_id === "remote_d1_create_and_migrate");
assert(d1GateReadiness?.operation_mode === "verify_existing_d1_then_migrate_schema", "gate readiness must expose existing-D1 schema verification mode");
assert(d1GateReadiness?.resource_create_required === false, "gate readiness must explicitly block duplicate D1 creation");
const workerGateReadiness = gateReadiness.gates.find((gate) => gate.gate_id === "candidate_worker_production_deploy");
assert(workerGateReadiness?.dependencies.find((dependency) => dependency.id === "worker:dry-run")?.ok === true, "final gate readiness must preserve the completed Worker dry-run dependency");
assert(["deploy_candidate_worker_security_update", "verify_existing_candidate_deployment"].includes(workerGateReadiness?.operation_mode), "gate readiness must expose the current Candidate security/provenance mode");
assert(workerGateReadiness?.resource_deploy_required === candidateNeedsSecurityUpdate, "gate readiness must mirror whether the Candidate security update is required");
const workerGateEvidenceText = [
  workerGateReadiness?.display_label,
  workerGateReadiness?.current_blocker,
  workerGateReadiness?.owner_action,
  workerGateReadiness?.next_owner_action,
].filter(Boolean).join(" ").toLowerCase();
assert(workerGateEvidenceText.includes(candidateNeedsSecurityUpdate ? "origin-pii-v2" : "provenance"), "gate readiness must state the current Candidate owner evidence requirement");
assert(gateReadiness.gates.some((gate) => gate.gate_id === "public_ab_small_traffic_link" && gate.dependencies.some((dependency) => dependency.id === "candidate_worker_production_deploy_owner_executed")), "public A/B gate must depend on owner-confirmed Candidate deployment evidence");
const githubGateReadiness = gateReadiness.gates.find((gate) => gate.gate_id === "github_repo_branch_pr");
assert(githubGateReadiness?.prepared_artifact === "champion_github_handoff.md", "GitHub gate must use the Champion handoff artifact");
assert(githubGateReadiness?.dependencies.find((dependency) => dependency.id === "target_github_repo")?.ok === true, "GitHub gate must recognize the exact prepared Champion repository");
assert(githubGateReadiness?.dependencies.find((dependency) => dependency.id === "safe_branch_name")?.ok === true, "GitHub gate must recognize the exact prepared Champion branch");
assert(githubGateReadiness?.dependencies.find((dependency) => dependency.id === "approval_metadata.github_repo_branch_pr")?.ok === false, "GitHub gate must remain blocked without owner approval metadata");
assert(githubGateReadiness?.owner_approval_detected === false && githubGateReadiness?.ready_for_owner_execution === false, "prepared Champion target must not imply owner approval or external execution readiness");
assert(gateReadiness.gates.some((gate) => gate.gate_id === "formal_posts_line_push_payment_customer_data" && gate.execution_policy === "manual_only"), "formal/LINE/payment/customer-data gate must stay manual-only");
assert(gateReadiness.next_safe_action.includes("remote_d1_create_and_migrate") || gateReadiness.ready_gate_count > 0, "gate readiness must provide a concrete next safe action");
assert(Array.isArray(gateReadiness.parallel_metadata_actions), "gate readiness must include parallel metadata actions");
assert(Number.isInteger(gateReadiness.parallel_metadata_action_count), "gate readiness must include parallel metadata action count");
assert(gateReadiness.parallel_metadata_action_count === gateReadiness.parallel_metadata_actions.length, "gate readiness metadata action count must match actions");
assert(gateReadiness.parallel_metadata_actions.length >= 4, "gate readiness must expose non-manual owner metadata capture actions");
assert(gateReadiness.parallel_metadata_actions.every((action) =>
  action.plan_only === true &&
  action.no_execution === true &&
  action.execution_order_still_enforced === true &&
  action.external_effect === false &&
  action.execution_performed === false
), "gate readiness metadata actions must stay local plan-only");
const publicAbMetadataAction = gateReadiness.parallel_metadata_actions.find((action) => action.gate_id === "public_ab_small_traffic_link");
assert(publicAbMetadataAction, "gate readiness must expose public A/B metadata capture");
for (const expectedField of ["approved_by", "approved_at", "champion_url", "public_surface", "rollback_url"]) {
  assert(publicAbMetadataAction.metadata_fields.includes(expectedField), `public A/B metadata capture missing field ${expectedField}`);
}
for (const expectedField of ["champion_url", "public_surface", "rollback_url"]) {
  assert(publicAbMetadataAction.business_metadata_fields.includes(expectedField), `public A/B business metadata missing field ${expectedField}`);
}
assert(publicAbMetadataAction.blocking_dependencies.includes("candidate_worker_production_deploy_owner_executed") === !expectedLiveIngestProven, "public A/B metadata capture must keep the Worker dependency only until Candidate/D1 evidence is validated");
assert(gateReadinessMd.includes("Gate Readiness Matrix"), "gate readiness markdown must include title");
assert(gateReadinessMd.includes("Parallel Metadata Capture"), "gate readiness markdown must include parallel metadata capture section");
assert(gateReadinessMd.includes("verify_existing_d1_then_migrate_schema"), "gate readiness markdown must show existing-D1 schema verification mode");
assert(gateReadinessMd.includes("deploy_candidate_worker_security_update") || gateReadinessMd.includes("verify_existing_candidate_deployment"), "gate readiness markdown must show Candidate security/provenance mode");
assert(gateReadinessMd.includes("No autorun for external gates: yes"), "gate readiness markdown must state no autorun");
assert(gateReadinessMd.includes("Champion repository prepared: yes"), "gate readiness markdown must distinguish the prepared Champion repo from the control-center directory");
assert(gateReadinessMd.includes("milk790-code/3q-hatchery-line-oa / codex/3q-growth-loop-champion-v1"), "gate readiness markdown must show the exact Champion target");
assert(gateReadinessMd.includes("Post-gate verification:"), "gate readiness markdown must include post-gate verification status");
assert(gateReadinessMd.includes("Execution performed: no"), "gate readiness markdown must state no execution");
assert(redlinePriority.ok === true, "red-line priority status must be ok");
assert(redlinePriorityStatus.ok === true, "compact red-line priority status must be ok");
assert(redlinePriority.mode === "redline_priority_local_only", "red-line priority mode must be local-only");
assert(redlinePriorityStatus.mode === redlinePriority.mode, "compact red-line priority mode must match");
assert(redlinePriority.status === "prioritize_p0_sample_gate_counts" || redlinePriority.status === redlinePriorityStatus.status, "red-line priority status must be stable");
assert(redlinePriority.redline_queue_covered === true, "red-line priority must cover the blocked queue");
assert(Array.isArray(redlinePriority.uncovered_blocked_actions) && redlinePriority.uncovered_blocked_actions.length === 0, "red-line priority must not leave blocked actions uncovered");
assert(redlinePriority.action_count >= blocked.items.length, "red-line priority must include at least every blocked action");
assert(redlinePriority.ordered_actions.length === redlinePriority.action_count, "red-line priority action count must match ordered actions");
assert(redlinePriority.local_action_count > 0, "red-line priority must include local review actions");
assert(redlinePriority.gate_action_count >= 5, "red-line priority must include external gate sequence actions");
assert(redlinePriority.manual_only_action_count >= 2, "red-line priority must include manual-only red lines");
assert(redlinePriority.approval_queue_status === approvalStatus.status, "red-line priority must read approval queue compact status");
assert(redlinePriority.approval_queue_item_count === approvalStatus.item_count, "red-line priority must read approval queue item count");
assert(redlinePriority.approval_queue_ready_local_review_count === approvalStatus.ready_local_review_count, "red-line priority must read approval queue ready-local count");
assert(redlinePriority.approval_queue_pending_human_count === approvalStatus.pending_human_count, "red-line priority must read approval queue pending-human count");
assert(redlinePriority.approval_queue_high_risk_pending_count === approvalStatus.high_risk_pending_count, "red-line priority must read approval queue high-risk count");
assert(redlinePriority.approval_queue_next_ready_local_review_id === approvalStatus.next_ready_local_review_id, "red-line priority must read approval queue next local review");
assert(redlinePriority.approval_queue_next_pending_human_id === approvalStatus.next_pending_human_id, "red-line priority must read approval queue next human gate");
assert(redlinePriority.approval_queue_policy_ok === approvalStatus.policy_ok, "red-line priority must read approval queue policy flag");
assert(redlinePriority.next_operator_action.includes("p0_collect_sample_gate_counts") || redlinePriority.current_real_event_rows > 0, "red-line priority must point to P0 sample collection while real events are empty");
assert(redlinePriority.no_autorun_for_external_gates === true, "red-line priority must keep external gates out of autorun");
assert(redlinePriority.gates_execute_in_order === true, "red-line priority must preserve external gate order");
assert(redlinePriority.owner_decision_required === true, "red-line priority must require owner decision");
assert(redlinePriority.execution_performed === false, "red-line priority must not execute commands");
assert(redlinePriority.external_effect === false, "red-line priority must not claim external effects");
assert(redlinePriority.production_deploy_performed === false, "red-line priority must not deploy production");
assert(redlinePriority.public_link_change_performed === false, "red-line priority must not change public links");
assert(redlinePriority.github_push_or_pr_performed === false, "red-line priority must not push or create PR");
assert(redlinePriority.formal_post_performed === false, "red-line priority must not formally post");
assert(redlinePriority.line_push_performed === false, "red-line priority must not push LINE");
assert(redlinePriority.customer_data_mutation_performed === false, "red-line priority must not mutate customer data");
assert(redlinePriority.payment_action_performed === false, "red-line priority must not touch payments");
assert(redlinePriority.delete_action_performed === false, "red-line priority must not delete data");
assert(redlinePriorityStatus.redline_queue_covered === true, "compact red-line priority must expose covered queue");
assert(redlinePriorityStatus.no_autorun_for_external_gates === true, "compact red-line priority must expose no-autorun policy");
assert(redlinePriorityStatus.approval_queue_status === approvalStatus.status, "compact red-line priority must expose approval queue status");
assert(redlinePriorityStatus.approval_queue_pending_human_count === approvalStatus.pending_human_count, "compact red-line priority must expose approval queue pending-human count");
assert(redlinePriorityStatus.approval_queue_high_risk_pending_count === approvalStatus.high_risk_pending_count, "compact red-line priority must expose approval queue high-risk count");
assert(redlinePriority.ordered_actions.some((item) => item.approval_queue_context?.status === approvalStatus.status), "red-line priority local actions must include approval queue context");
assert(redlinePriorityMd.includes("3Q Growth Loop Red-Line Priority"), "red-line priority markdown must include title");
assert(redlinePriorityMd.includes("Approval Queue Status"), "red-line priority markdown must include approval queue status section");
assert(redlinePriorityMd.includes("Approval queue pending human"), "red-line priority markdown must include pending-human queue count");
assert(redlinePriorityMd.includes("External effect: no"), "red-line priority markdown must state no external effect");
assert(redlinePriorityMd.includes("Execution performed: no"), "red-line priority markdown must state no execution");
assert(redlinePriorityMd.includes("p0_collect_sample_gate_counts"), "red-line priority markdown must include P0 sample-gate next action");
assert(packageJson.scripts["redline:priority"] === "node scripts/redline-priority.mjs", "package.json must expose red-line priority script");
assert(packageJson.scripts.verify.includes("npm run redline:priority"), "verify chain must include red-line priority script");
assert(packageJson.scripts["blocked:report"] === "node scripts/prepared-but-blocked-report.mjs", "package.json must expose PreparedButBlocked report script");
assert(packageJson.scripts.verify.includes("npm run blocked:report"), "verify chain must include PreparedButBlocked report script");
assert(weeklyRunnerSource.includes("redline_priority"), "weekly runner must include red-line priority step");
assert(weeklyRunnerSource.includes("redline:priority"), "weekly runner must run redline:priority");
assert(weeklyRunnerSource.includes("prepared_but_blocked_report"), "weekly runner must include PreparedButBlocked report step");
assert(weeklyRunnerSource.includes("blocked:report"), "weekly runner must run PreparedButBlocked report");
assert(approvalResumeFixture.ok === true, "approval resume fixture status must be ok");
assert(approvalResumeFixture.mode === "approval_resume_fixture_dry_run", "approval resume fixture mode must be dry-run");
assert(approvalResumeFixture.scenario_count >= 6, "approval resume fixtures must cover at least six scenarios");
assert(approvalResumeFixture.execution_performed === false, "approval resume fixtures must not execute external commands");
assert(approvalResumeFixture.external_effect === false, "approval resume fixtures must not claim external effects");
assert(approvalResumeFixture.remote_d1_create_performed === false, "approval resume fixtures must not create remote D1");
assert(approvalResumeFixture.remote_d1_migration_performed === false, "approval resume fixtures must not migrate remote D1");
assert(approvalResumeFixture.production_deploy_performed === false, "approval resume fixtures must not deploy production");
assert(approvalResumeFixture.public_link_change_performed === false, "approval resume fixtures must not change public links");
assert(approvalResumeFixture.github_push_or_pr_performed === false, "approval resume fixtures must not push or create PR");
assert(approvalResumeFixture.formal_post_performed === false, "approval resume fixtures must not formally post");
assert(approvalResumeFixture.line_push_performed === false, "approval resume fixtures must not push LINE");
assert(approvalResumeFixture.customer_data_mutation_performed === false, "approval resume fixtures must not mutate customer data");
assert(approvalResumeFixture.payment_action_performed === false, "approval resume fixtures must not touch payments");
assert(approvalResumeFixture.delete_action_performed === false, "approval resume fixtures must not delete data");
for (const expected of [
  "no_input_keeps_all_gates_blocked",
  "copied_example_placeholders_block_ready_state",
  "valid_github_gate_becomes_plan_only_ready",
  "sensitive_approval_value_blocks_gate",
  "public_ab_requires_absolute_champion_url",
  "manual_only_gate_never_becomes_automated",
  "invalid_d1_metadata_blocks_remote_gate",
  "invalid_worker_url_blocks_deploy_gate",
  "invalid_github_metadata_blocks_pr_gate",
  "wrong_valid_github_target_blocks_pr_gate",
  "invalid_approval_timestamp_blocks_gate",
]) {
  assert(approvalResumeFixture.scenarios.some((scenario) => scenario.id === expected && scenario.ok === true), `approval resume fixture missing passing scenario ${expected}`);
}
const validGithubFixture = approvalResumeFixture.scenarios.find((scenario) => scenario.id === "valid_github_gate_becomes_plan_only_ready");
assert(validGithubFixture?.status === "owner_approval_detected_plan_only", "valid GitHub approval fixture must stay plan-only");
assert(validGithubFixture?.ready_gate_count === 1, "valid GitHub approval fixture must prepare exactly one gate");
const copiedExampleFixture = approvalResumeFixture.scenarios.find((scenario) => scenario.id === "copied_example_placeholders_block_ready_state");
assert(copiedExampleFixture?.ready_gate_count === 0, "copied example approval input must not make gates ready");
const sensitiveFixture = approvalResumeFixture.scenarios.find((scenario) => scenario.id === "sensitive_approval_value_blocks_gate");
assert(sensitiveFixture?.sensitive_approval_detected === true, "sensitive approval fixture must detect sensitive metadata");
assert(sensitiveFixture?.ready_gate_count === 0, "sensitive approval fixture must block ready gates");
const manualOnlyFixture = approvalResumeFixture.scenarios.find((scenario) => scenario.id === "manual_only_gate_never_becomes_automated");
assert(manualOnlyFixture?.ready_gate_count === 0, "manual-only approval fixture must never become automated");
const invalidD1Fixture = approvalResumeFixture.scenarios.find((scenario) => scenario.id === "invalid_d1_metadata_blocks_remote_gate");
assert(invalidD1Fixture?.ready_gate_count === 0, "invalid D1 metadata fixture must block ready gates");
assert(JSON.stringify(invalidD1Fixture?.gate_summary ?? []).includes("invalid_d1_database_id"), "invalid D1 fixture must expose D1 id validation error");
const invalidWorkerFixture = approvalResumeFixture.scenarios.find((scenario) => scenario.id === "invalid_worker_url_blocks_deploy_gate");
assert(invalidWorkerFixture?.ready_gate_count === 0, "invalid worker URL fixture must block deploy gate");
assert(JSON.stringify(invalidWorkerFixture?.gate_summary ?? []).includes("invalid_worker_url"), "invalid worker fixture must expose worker URL validation error");
const invalidGithubFixture = approvalResumeFixture.scenarios.find((scenario) => scenario.id === "invalid_github_metadata_blocks_pr_gate");
assert(invalidGithubFixture?.ready_gate_count === 0, "invalid GitHub metadata fixture must block PR gate");
assert(JSON.stringify(invalidGithubFixture?.gate_summary ?? []).includes("invalid_repo_url"), "invalid GitHub fixture must expose repo URL validation error");
assert(JSON.stringify(invalidGithubFixture?.gate_summary ?? []).includes("invalid_branch_name"), "invalid GitHub fixture must expose branch validation error");
const wrongGithubTargetFixture = approvalResumeFixture.scenarios.find((scenario) => scenario.id === "wrong_valid_github_target_blocks_pr_gate");
assert(wrongGithubTargetFixture?.ready_gate_count === 0, "wrong valid GitHub target fixture must block the prepared Champion PR gate");
assert(JSON.stringify(wrongGithubTargetFixture?.gate_summary ?? []).includes("unexpected_repo_url"), "wrong GitHub target fixture must expose exact repository validation");
assert(JSON.stringify(wrongGithubTargetFixture?.gate_summary ?? []).includes("unexpected_branch_name"), "wrong GitHub target fixture must expose exact branch validation");
const invalidTimestampFixture = approvalResumeFixture.scenarios.find((scenario) => scenario.id === "invalid_approval_timestamp_blocks_gate");
assert(invalidTimestampFixture?.ready_gate_count === 0, "invalid approval timestamp fixture must block ready gates");
assert(JSON.stringify(invalidTimestampFixture?.gate_summary ?? []).includes("invalid_datetime"), "invalid timestamp fixture must expose approved_at validation error");
assert(Array.isArray(approvalInputExample.approvals) && approvalInputExample.approvals.length >= 4, "approval input example must include gate templates");
const approvalInputGithub = approvalInputExample.approvals.find((item) => item.gate_id === "github_repo_branch_pr");
assert(approvalInputGithub?.repo_url === "https://github.com/milk790-code/3q-hatchery-line-oa.git", "approval input example must prefill the exact Champion repository");
assert(approvalInputGithub?.branch_name === "codex/3q-growth-loop-champion-v1", "approval input example must prefill the exact Champion branch");
assert(ownerApprovalFormSource.includes("owner_approval_form"), "owner approval form source must keep form mode");
assert(ownerApprovalFormSource.includes("network_calls_performed: false"), "owner approval form source must record no network calls");
assert(ownerApprovalFormSource.includes("approval_input_write_performed: false"), "owner approval form source must record no approval input write");
assert(ownerApprovalFormFixturesSource.includes("owner_approval_form_fixture_dry_run"), "owner approval form fixtures must be dry-run fixtures");
assert(ownerApprovalFormStatus.ok === true, "owner approval form status must be ok");
assert(ownerApprovalFormStatus.mode === "owner_approval_form", "owner approval form mode must match");
assert(["ready_local_owner_approval_form", "owner_approval_input_detected_review_before_overwrite"].includes(ownerApprovalFormStatus.status), "owner approval form status is invalid");
assert(ownerApprovalFormStatus.form_gate_count === 4, "owner approval form must expose four owner-gated metadata blocks");
assert(ownerApprovalFormStatus.excluded_manual_gate_count >= 1, "owner approval form must exclude manual-only gate");
assert(ownerApprovalFormStatus.browser_only === true, "owner approval form must be browser-only");
assert(ownerApprovalFormStatus.browser_persistence === false, "owner approval form must not persist browser state");
assert(ownerApprovalFormStatus.form_action === "none", "owner approval form action must be none");
assert(ownerApprovalFormStatus.network_calls_performed === false, "owner approval form must perform no network calls");
assert(ownerApprovalFormStatus.live_input_files_created === false, "owner approval form must not create live owner input");
assert(ownerApprovalFormStatus.approval_input_write_performed === false, "owner approval form must not write owner_approval_input.json");
assert(ownerApprovalFormHtml.includes("https://github.com/milk790-code/3q-hatchery-line-oa.git"), "owner approval form must prefill the exact Champion repository metadata");
assert(ownerApprovalFormHtml.includes("codex/3q-growth-loop-champion-v1"), "owner approval form must prefill the exact Champion branch metadata");
assert(ownerApprovalFormHtml.includes(cloudflareD1Readiness.expected.configured_database_id), "owner approval form must prefill the currently observed dedicated D1 id as non-secret metadata");
assert(ownerApprovalFormHtml.includes("Existing D1 schema verification and migration approval"), "owner approval form must label the observed D1 as existing rather than asking for duplicate creation");
assert(ownerApprovalFormHtml.includes("verify_existing_d1_then_migrate_schema"), "owner approval form must expose the existing-D1 operation mode");
assert(ownerApprovalFormStatus.download_filename === "owner_approval_input.json", "owner approval form download filename must match");
assert(ownerApprovalFormStatus.review_download_filename === "owner_approval_form.review.json", "owner approval form review filename must match");
assertNoRedLineFlags(ownerApprovalFormStatus, "owner approval form status");
assert(ownerApprovalFormHtml.includes("Owner Approval Metadata"), "owner approval form HTML must have title");
assert(ownerApprovalFormHtml.includes("owner_approval_input.json"), "owner approval form HTML must include download filename");
assert(ownerApprovalFormHtml.includes('action="none"'), "owner approval form HTML must use action none");
assert(ownerApprovalFormHtml.includes('data-external-effect="false"'), "owner approval form HTML must mark no external effect");
assert(!/\bfetch\s*\(/.test(ownerApprovalFormHtml), "owner approval form HTML must not call fetch");
assert(!/XMLHttpRequest|sendBeacon/i.test(ownerApprovalFormHtml), "owner approval form HTML must not call XHR or sendBeacon");
assert(ownerApprovalFormFixture.ok === true, "owner approval form fixture status must be ok");
assert(ownerApprovalFormFixture.mode === "owner_approval_form_fixture_dry_run", "owner approval form fixture mode must match");
assert(ownerApprovalFormFixture.scenario_count === 4, "owner approval form fixtures must cover four scenarios");
assert(ownerApprovalFormFixture.live_input_files_created === false, "owner approval form fixtures must not create live input files");
assert(ownerApprovalFormFixture.approval_input_write_performed === false, "owner approval form fixtures must not write live approval input");
assert(ownerApprovalFormFixture.execution_performed === false, "owner approval form fixtures must not execute external commands");
assert(ownerApprovalFormFixture.contract_checks.every((item) => item.ok === true), "owner approval form fixture contract checks must pass");
assertNoRedLineFlags(ownerApprovalFormFixture, "owner approval form fixtures");
for (const expectedScenario of [
  "form_static_contract",
  "form_export_valid_github_plan_only",
  "form_export_placeholder_blocked",
  "form_export_sensitive_value_blocked",
]) {
  assert(ownerApprovalFormFixture.scenarios.some((scenario) => scenario.id === expectedScenario && scenario.ok === true), `owner approval form fixture missing or failed: ${expectedScenario}`);
}
const ownerApprovalFormValidGithub = ownerApprovalFormFixture.scenarios.find((scenario) => scenario.id === "form_export_valid_github_plan_only");
assert(ownerApprovalFormValidGithub?.ready_gate_count === 1, "owner approval form valid GitHub fixture must prepare exactly one gate");
assert(ownerApprovalFormValidGithub?.github_push_or_pr_performed === false, "owner approval form valid GitHub fixture must not push or create PR");
const ownerApprovalFormSensitive = ownerApprovalFormFixture.scenarios.find((scenario) => scenario.id === "form_export_sensitive_value_blocked");
assert(ownerApprovalFormSensitive?.sensitive_approval_detected === true, "owner approval form sensitive fixture must detect sensitive metadata");
assert(ownerApprovalFormSensitive?.ready_gate_count === 0, "owner approval form sensitive fixture must block ready gates");
assert(ownerApprovalFormFixtureReport.includes("owner_approval_form_fixtures_ok"), "owner approval form fixture report must state fixtures ok");
assert(ownerApprovalFormFixtureReport.includes("form_export_sensitive_value_blocked"), "owner approval form fixture report must include sensitive block");
assert(ownerApprovalFormFixtureReport.includes("Owner approval input write performed: no"), "owner approval form fixture report must state no live approval write");
assert(retirement.policy.no_data_delete === true, "retirement queue must not delete data");
assert(retirement.policy.no_primary_link_change === true, "retirement queue must not change primary links");
assert(retirement.policy.no_champion_promotion === true, "retirement queue must not promote champions");
assert(retirement.items.every((item) => item.external_effect === false), "retirement queue items must have no external effect");
assert(retirementFixture.ok === true, "candidate retirement fixture status must be ok");
assert(retirementFixture.mode === "candidate_retirement_fixture_dry_run", "candidate retirement fixture mode must be dry-run");
assert(retirementFixture.scenario_count === 6, "candidate retirement fixtures must cover six scenarios");
assert(retirementFixture.current_queue_safety?.ok === true, "candidate retirement fixtures must verify current queue safety");
assert(retirementFixture.real_events_unchanged === true, "candidate retirement fixtures must leave real events unchanged");
assert(retirementFixture.data_lp_events_write_performed === false, "candidate retirement fixtures must not write data/lp_events.jsonl");
assert(retirementFixture.external_effect === false, "candidate retirement fixtures must not claim external effects");
assert(retirementFixture.public_link_change_performed === false, "candidate retirement fixtures must not change public links");
assert(retirementFixture.champion_promotion_performed === false, "candidate retirement fixtures must not promote champions");
assert(retirementFixture.delete_action_performed === false, "candidate retirement fixtures must not delete data");
for (const expected of [
  "sample_insufficient_keeps_testing",
  "winning_challenger_requires_owner_review",
  "underperforming_challenger_ready_for_local_retirement",
  "quality_regression_ready_for_local_retirement",
  "unknown_candidate_observed_only",
  "mixed_candidates_summary_counts",
]) {
  assert(retirementFixture.scenarios.some((scenario) => scenario.id === expected && scenario.ok === true), `candidate retirement fixture missing passing scenario ${expected}`);
}
const retirementSampleGap = retirementFixture.scenarios.find((scenario) => scenario.id === "sample_insufficient_keeps_testing");
assert(retirementSampleGap?.target_item?.status === "keep_testing_sample_insufficient", "sample-insufficient retirement fixture must keep testing");
assert(retirementSampleGap?.target_item?.retirement_ready === false, "sample-insufficient retirement fixture must not retire candidate");
const retirementWinner = retirementFixture.scenarios.find((scenario) => scenario.id === "winning_challenger_requires_owner_review");
assert(retirementWinner?.target_item?.status === "promotion_review_required", "winning retirement fixture must require promotion review");
assert(retirementWinner?.target_item?.retirement_ready === false, "winning retirement fixture must not retire candidate");
const retirementUnderperform = retirementFixture.scenarios.find((scenario) => scenario.id === "underperforming_challenger_ready_for_local_retirement");
assert(retirementUnderperform?.target_item?.status === "retire_local_candidate_due_underperformance", "underperforming retirement fixture must mark local retirement");
assert(retirementUnderperform?.target_item?.retirement_ready === true, "underperforming retirement fixture must be retirement-ready");
const retirementQuality = retirementFixture.scenarios.find((scenario) => scenario.id === "quality_regression_ready_for_local_retirement");
assert(retirementQuality?.target_item?.status === "retire_local_candidate_due_quality_regression", "quality-regression retirement fixture must mark local retirement");
assert(retirementQuality?.target_item?.retirement_ready === true, "quality-regression retirement fixture must be retirement-ready");
const retirementUnknown = retirementFixture.scenarios.find((scenario) => scenario.id === "unknown_candidate_observed_only");
assert(retirementUnknown?.target_item?.status === "observed_only_no_rotation_action", "unknown candidate retirement fixture must observe only");
assert(retirementUnknown?.target_item?.retirement_ready === false, "unknown candidate retirement fixture must not retire");
assert(retirementFixture.scenarios.every((scenario) => scenario.external_effect === false && scenario.public_link_change_performed === false && scenario.champion_promotion_performed === false && scenario.delete_action_performed === false), "candidate retirement fixture scenarios must preserve red lines");
assert(retirementFixtureReport.includes("Candidate Retirement Fixture Report"), "candidate retirement fixture report must include title");
assert(retirementFixtureReport.includes("sample_insufficient_keeps_testing"), "candidate retirement fixture report must include sample-insufficient scenario");
assert(retirementFixtureReport.includes("winning_challenger_requires_owner_review"), "candidate retirement fixture report must include owner review scenario");
assert(retirementFixtureReport.includes("underperforming_challenger_ready_for_local_retirement"), "candidate retirement fixture report must include underperforming scenario");
assert(retirementFixtureReport.includes("quality_regression_ready_for_local_retirement"), "candidate retirement fixture report must include quality regression scenario");
assert(retirementFixtureReport.includes("Delete action performed: no"), "candidate retirement fixture report must state no delete action");
try {
  const weeklyRunner = weeklyRunnerStatus;
  assert(weeklyRunner.external_effect === false, "weekly runner must not claim external effects");
  assert(weeklyRunner.public_link_change_performed === false, "weekly runner must not claim public link changes");
  assert(weeklyRunner.production_deploy_performed === false, "weekly runner must not claim production deploy");
  assert(weeklyRunner.formal_post_performed === false, "weekly runner must not claim formal posting");
  assert(weeklyRunner.line_push_performed === false, "weekly runner must not claim LINE push");
  assert(weeklyRunner.customer_data_mutation_performed === false, "weekly runner must not mutate customer data");
  assert(weeklyRunner.payment_action_performed === false, "weekly runner must not claim payment actions");
  assert(weeklyRunner.delete_action_performed === false, "weekly runner must not claim deletion");
  assert(weeklyRunner.commands.every((command) => command.external_effect === false), "weekly runner commands must have no external effects");
  assert(packageJson.scripts["d1:local:migrate"] === "wrangler d1 execute 3q-growth-loop-candidate --local --file=schema/d1-week0.sql", "package.json must expose the local-only D1 schema bootstrap");
  assert(weeklyRunnerSource.includes("bootstrap_local_d1_schema") && weeklyRunnerSource.includes("d1:local:migrate"), "weekly runner source must bootstrap local D1 before export");
  assert(weeklyRunner.commands.some((command) => command.step === "bootstrap_local_d1_schema" && command.status === "success"), "weekly runner must include successful local D1 schema bootstrap");
  assert(weeklyRunner.commands.findIndex((command) => command.step === "bootstrap_local_d1_schema") < weeklyRunner.commands.findIndex((command) => command.step === "collect_data"), "weekly runner must bootstrap local D1 before collecting local rows");
  assert(weeklyRunner.commands.some((command) => command.step === "collect_data" && command.command === "npm run collect:d1:auto" && command.status === "success"), "weekly runner collect_data must execute the guarded automatic selector");
  assert(weeklyRunner.commands.some((command) => command.step === "d1_collection_mode_fixtures" && command.status === "success"), "weekly runner must include D1 collection selector fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "d1_aggregate_export_fixtures" && command.status === "success"), "weekly runner must include D1 aggregate exporter fixtures");
  if (weeklyRunner.commands.some((command) => command.step === "event_input_quality_gate")) {
    assert(weeklyRunner.commands.some((command) => command.step === "event_input_quality_gate" && command.status === "success"), "weekly runner event input quality gate step must pass when present");
  }
  assert(weeklyRunner.commands.some((command) => command.step === "funnel_aggregate_preview" && command.status === "success"), "weekly runner must include full-funnel aggregate preview");
  assert(weeklyRunner.commands.some((command) => command.step === "real_data_apply_fixtures" && command.status === "success"), "weekly runner must include real-data apply fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "source_capture_pack" && command.status === "success"), "weekly runner must include source capture pack");
  assert(weeklyRunner.commands.some((command) => command.step === "sample_gate_compile_probe" && command.status === "success"), "weekly runner must include sample-gate compile probe");
  assert(weeklyRunner.commands.some((command) => command.step === "sample_gate_replay_fixtures" && command.status === "success"), "weekly runner must include sample-gate replay fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "source_capture_compile" && command.status === "success"), "weekly runner must include source capture compile");
  assert(weeklyRunner.commands.some((command) => command.step === "source_capture_compile_fixtures" && command.status === "success"), "weekly runner must include source capture compile fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "data_collection_brief" && command.status === "success"), "weekly runner must include data collection brief");
  assert(weeklyRunner.commands.some((command) => command.step === "week0_owner_capture_queue" && command.status === "success"), "weekly runner must include Week 0 owner capture queue");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_sample_gate_status" && command.status === "success"), "weekly runner must include owner sample-gate status");
  assert(weeklyRunner.commands.some((command) => command.step === "data_collection_progress" && command.status === "success"), "weekly runner must include data collection progress");
  assert(weeklyRunner.commands.some((command) => command.step === "next_p0_owner_form" && command.status === "success"), "weekly runner must include next P0 owner form");
  assert(weeklyRunner.commands.some((command) => command.step === "next_p0_quick_capture" && command.status === "success"), "weekly runner must include next P0 quick capture");
  assert(weeklyRunner.commands.some((command) => command.step === "p0_counts_preflight" && command.status === "success"), "weekly runner must include P0 counts preflight");
  assert(weeklyRunner.commands.some((command) => command.step === "next_p0_owner_intake" && command.status === "success"), "weekly runner must include next P0 owner intake");
  assert(weeklyRunner.commands.some((command) => command.step === "next_p0_owner_form_fixtures" && command.status === "success"), "weekly runner must include next P0 owner form fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "next_p0_quick_capture_fixtures" && command.status === "success"), "weekly runner must include next P0 quick capture fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "p0_counts_preflight_fixtures" && command.status === "success"), "weekly runner must include P0 counts preflight fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "next_p0_owner_intake_fixtures" && command.status === "success"), "weekly runner must include next P0 owner intake fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "sample_gate_capture_calendar" && command.status === "success"), "weekly runner must include sample-gate capture calendar");
  assert(weeklyRunner.commands.some((command) => command.step === "sample_gate_due_status" && command.status === "success"), "weekly runner must include sample-gate due status");
  assert(weeklyRunner.commands.some((command) => command.step === "sample_gate_due_status_fixtures" && command.status === "success"), "weekly runner must include sample-gate due status fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "sample_gate_owner_worksheet" && command.status === "success"), "weekly runner must include sample gate owner worksheet");
  assert(weeklyRunner.commands.some((command) => command.step === "sample_gate_owner_form" && command.status === "success"), "weekly runner must include sample gate owner form");
  assert(weeklyRunner.commands.some((command) => command.step === "sample_gate_owner_form_fixtures" && command.status === "success"), "weekly runner must include sample gate owner form fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_sample_gate_fixtures" && command.status === "success"), "weekly runner must include owner sample-gate fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_quality_review" && command.status === "success"), "weekly runner must include owner quality-review gate");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_quality_review_fixtures" && command.status === "success"), "weekly runner must include owner quality-review fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_next_action" && command.status === "success"), "weekly runner must include owner next-action card");
  assert(weeklyRunner.commands.some((command) => command.step === "north_star_outcome_preflight" && command.status === "success"), "weekly runner must include North Star outcome preflight");
  assert(weeklyRunner.commands.some((command) => command.step === "north_star_outcome_form" && command.status === "success"), "weekly runner must include North Star outcome form");
  assert(weeklyRunner.commands.some((command) => command.step === "north_star_outcome_form_fixtures" && command.status === "success"), "weekly runner must include North Star outcome form fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_p1_outcome_intake" && command.status === "success"), "weekly runner must include P1 outcome intake");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_p1_outcome_intake_fixtures" && command.status === "success"), "weekly runner must include P1 outcome intake fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_p1_outcome_postfill_check" && command.status === "success"), "weekly runner must include P1 outcome post-fill check");
  assert(weeklyRunner.commands.some((command) => command.step === "sample_gate_recovery_pack" && command.status === "success"), "weekly runner must include sample gate recovery pack");
  assert(weeklyRunner.commands.some((command) => command.step === "sample_gate_batch_handoff" && command.status === "success"), "weekly runner must include sample gate batch handoff");
  assert(weeklyRunner.commands.some((command) => command.step === "sample_gate_batch_preflight" && command.status === "success"), "weekly runner must include sample gate batch preflight");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_sample_count_handoff" && command.status === "success"), "weekly runner must include owner sample count handoff");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_p0_now" && command.status === "success"), "weekly runner must include owner P0-now card");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_p0_launcher" && command.status === "success"), "weekly runner must include owner P0 launcher");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_sample_count_recovery" && command.status === "success"), "weekly runner must include owner sample count recovery");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_p0_postfill_check" && command.status === "success"), "weekly runner must include owner P0 post-fill check");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_sample_count_recovery_fixtures" && command.status === "success"), "weekly runner must include owner sample count recovery fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "candidate_retirement_fixtures" && command.status === "success"), "weekly runner must include candidate retirement fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "line_inbound_playbook" && command.status === "success"), "weekly runner must include LINE inbound playbook");
  assert(weeklyRunner.commands.some((command) => command.step === "manual_publish_packet" && command.status === "success"), "weekly runner must include manual publish packet");
  assert(weeklyRunner.commands.some((command) => command.step === "manual_publish_capture_plan" && command.status === "success"), "weekly runner must include manual publish capture plan");
  assert(weeklyRunner.commands.some((command) => command.step === "manual_publish_brief" && command.status === "success"), "weekly runner must include manual publish brief");
  assert(weeklyRunner.commands.some((command) => command.step === "public_tracking_url_pack" && command.status === "success"), "weekly runner must include public tracking URL pack");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_public_url_approval_preview" && command.status === "success"), "weekly runner must include owner public URL approval preview");
  assert(weeklyRunner.commands.some((command) => command.step === "manual_publish_evidence" && command.status === "success"), "weekly runner must include manual publish evidence intake");
  assert(weeklyRunner.commands.some((command) => command.step === "manual_publish_evidence_form" && command.status === "success"), "weekly runner must include manual publish evidence browser form");
  assert(weeklyRunner.commands.some((command) => command.step === "manual_publish_evidence_form_fixtures" && command.status === "success"), "weekly runner must include manual publish evidence form fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "manual_publish_evidence_fixtures" && command.status === "success"), "weekly runner must include manual publish evidence fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "variable_rotation_fixtures" && command.status === "success"), "weekly runner must include variable rotation fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "browser_route_smoke" && command.status === "success"), "weekly runner must include successful browser route smoke");
  assert(weeklyRunner.commands.some((command) => command.step === "tracking_link_smoke" && command.status === "success"), "weekly runner must include successful tracking link smoke");
  if (weeklyRunner.commands.some((command) => command.step === "event_contract_smoke")) {
    assert(weeklyRunner.commands.some((command) => command.step === "event_contract_smoke" && command.status === "success"), "weekly runner event contract smoke step must pass when present");
  }
  assert(weeklyRunner.commands.some((command) => command.step === "win_rule_fixtures" && command.status === "success"), "weekly runner must include win-rule fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "real_data_decision_replay" && command.status === "success"), "weekly runner must include real-data decision replay");
  assert(weeklyRunner.commands.some((command) => command.step === "launchagent_status_readback" && command.status === "success"), "weekly runner must include LaunchAgent status readback");
  assert(weeklyRunner.commands.some((command) => command.step === "north_star_funnel" && command.status === "success"), "weekly runner must include North Star funnel contract");
  assert(weeklyRunner.commands.some((command) => command.step === "iteration_history" && command.status === "success"), "weekly runner must include iteration history");
  assert(weeklyRunner.commands.some((command) => command.step === "approval_resume_plan" && command.status === "success"), "weekly runner must include approval resume plan");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_approval_form" && command.status === "success"), "weekly runner must include owner approval form");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_approval_form_fixtures" && command.status === "success"), "weekly runner must include owner approval form fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_gate_evidence" && command.status === "success"), "weekly runner must include owner gate evidence intake");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_gate_evidence_fixtures" && command.status === "success"), "weekly runner must include owner gate evidence fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "post_gate_verification" && command.status === "success"), "weekly runner must include post-gate verification plan");
  assert(weeklyRunner.commands.some((command) => command.step === "post_gate_verification_fixtures" && command.status === "success"), "weekly runner must include post-gate verification fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "gate_readiness_matrix" && command.status === "success"), "weekly runner must include gate readiness matrix");
  assert(weeklyRunner.commands.some((command) => command.step === "approval_resume_fixtures" && command.status === "success"), "weekly runner must include approval resume fixtures");
  assert(weeklyRunner.commands.some((command) => command.step === "github_workflow_guard" && command.status === "success"), "weekly runner must include GitHub workflow guard");
  assert(weeklyRunner.commands.some((command) => command.step === "artifact_retention_monitor_pre_export" && command.status === "success"), "weekly runner must include pre-export artifact retention monitor");
  assert(weeklyRunner.commands.some((command) => command.step === "artifact_retention_review_pre_export" && command.status === "success"), "weekly runner must include pre-export artifact retention review");
  assert(weeklyRunner.commands.some((command) => command.step === "github_export_bundle" && command.status === "success"), "weekly runner must include GitHub export bundle");
  assert(weeklyRunner.commands.some((command) => command.step === "artifact_retention_monitor" && command.status === "success"), "weekly runner must include artifact retention monitor");
  assert(weeklyRunner.commands.some((command) => command.step === "artifact_retention_review" && command.status === "success"), "weekly runner must include artifact retention review");
  assert(weeklyRunner.commands.some((command) => command.step === "archive_weekly_run" && command.status === "success"), "weekly runner must include weekly archive step");
  if (weeklyRunner.commands.some((command) => command.step === "objective_sequence_audit")) {
    assert(weeklyRunner.commands.some((command) => command.step === "objective_sequence_audit" && command.status === "success"), "weekly runner objective audit step must pass when present");
  }
  assert(weeklyRunner.commands.some((command) => command.step === "owner_console" && command.status === "success"), "weekly runner must include owner console step");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_action_launcher" && command.status === "success"), "weekly runner must include owner action launcher step");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_action_launcher_refresh_after_console" && command.status === "success"), "weekly runner must refresh owner action launcher after console");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_console_refresh_after_launcher" && command.status === "success"), "weekly runner must refresh owner console after launcher");
  assert(weeklyRunner.commands.some((command) => command.step === "owner_console_smoke" && command.status === "success"), "weekly runner must include owner console smoke step");
} catch (error) {
  if (error.code !== "ENOENT") {
    throw error;
  }
}
assert(ab.traffic_allocation.champion === 90, "A/B champion allocation must stay 90");
assert(ab.traffic_allocation.challenger === 10, "A/B challenger allocation must stay 10");
assert(ab.public_link_change_performed === false, "A/B status must not claim public link changes");
assert(report.includes("Tracking Links"), "weekly report must include tracking links");
assert(report.includes("Next Round Plan"), "weekly report must include next round plan");
assert(report.includes("Content Variants"), "weekly report must include content variants");
assert(report.includes("Funnel Attribution Breakdown"), "weekly report must include funnel attribution breakdown");
assert(report.includes("Pipeline Status"), "weekly report must include pipeline status");
assert(report.includes("Weekly Automation"), "weekly report must include weekly automation status");
assert(report.includes("Candidate Worker Dry Run"), "weekly report must include Worker dry-run status");
assert(report.includes("worker_dry_run.md"), "weekly report must include Worker dry-run report artifact");
assert(report.includes("Browser Smoke"), "weekly report must include browser smoke status");
assert(report.includes("Tracking Link Smoke"), "weekly report must include tracking link smoke status");
assert(report.includes("Event Contract Smoke"), "weekly report must include event contract smoke status");
assert(report.includes("Event Input Quality Gate"), "weekly report must include event input quality gate status");
assert(report.includes("Source Trust Matrix"), "weekly report must include source trust matrix status");
assert(report.includes("source_trust_matrix.md"), "weekly report must include source trust report artifact");
assert(report.includes("Source Capture Pack"), "weekly report must include source capture pack status");
assert(report.includes("Source Capture Compile Preview"), "weekly report must include source capture compile status");
assert(report.includes("Source Capture Compile Fixture Guard"), "weekly report must include source capture compile fixture guard");
assert(report.includes("Win Rule Fixtures"), "weekly report must include win-rule fixture status");
assert(report.includes("Real Data Decision Replay"), "weekly report must include real-data decision replay status");
assert(report.includes("GitHub Handoff"), "weekly report must include GitHub handoff");
assert(report.includes("Owner Approval Pack"), "weekly report must include owner approval pack");
assert(report.includes("owner_console.html"), "weekly report must include owner console artifact");
assert(report.includes("Approval resume plan"), "weekly report must include approval resume plan");
assert(report.includes("Candidate Retirement Queue"), "weekly report must include candidate retirement queue");
assert(report.includes("Full Funnel Aggregate Import"), "weekly report must include full-funnel aggregate import status");
assert(report.includes("Full Funnel Aggregate Fixture Guard"), "weekly report must include full-funnel aggregate fixture guard");
assert(report.includes("Real Data Apply Fixture Guard"), "weekly report must include real-data apply fixture guard");
assert(report.includes("Manual Conversion Import"), "weekly report must include manual conversion import status");
assert(report.includes("LINE Inbound Playbook"), "weekly report must include LINE inbound playbook status");
assert(report.includes("Manual Publish Evidence Form"), "weekly report must include manual publish evidence form status");
assert(report.includes("manual_publish_evidence_form.html"), "weekly report must include manual publish evidence form artifact");
assert(audit.includes("Overall: not_complete_data_and_external_gates"), "completion audit must expose both missing data evidence and external gates");
assert(audit.includes("Data Evidence Gates"), "completion audit must include a dedicated data evidence gate section");
assert(audit.includes("Manual aggregate conversion import"), "completion audit must include manual aggregate conversion import");
assert(audit.includes("Full-funnel aggregate import"), "completion audit must include full-funnel aggregate import");
assert(audit.includes("Full-funnel aggregate fixtures block unknown assets"), "completion audit must include full-funnel aggregate fixture guard");
assert(audit.includes("Worker dry run:"), "completion audit must include Worker dry-run summary");
assert(audit.includes("worker_dry_run.md"), "completion audit must include Worker dry-run artifact");
assert(audit.includes("Real-data apply fixtures block example/template"), "completion audit must include real-data apply fixture guard");
assert(audit.includes("Real-data decision replay connects filled source-capture ledgers"), "completion audit must include real-data decision replay");
assert(audit.includes("Source readiness identifies every funnel-stage data source"), "completion audit must include source readiness monitor");
assert(audit.includes("Source trust matrix blocks review-only D1 smoke rows"), "completion audit must include source trust matrix gate");
assert(audit.includes("Source capture pack maps every funnel-stage source"), "completion audit must include source capture pack");
assert(audit.includes("LINE inbound customer-service handoff"), "completion audit must include LINE inbound customer-service handoff");
assert(audit.includes("Manual publish evidence browser form"), "completion audit must include manual publish evidence form requirement");
assert(audit.includes("manual_publish_evidence_form.html"), "completion audit must include manual publish evidence form artifact");
assert(audit.includes("unique post-level tracking links"), "completion audit must include post-level tracking links");
assert(audit.includes("Gate real lp_events input"), "completion audit must include event input quality gate");
assert(audit.includes("Decide the next seven-day iteration"), "completion audit must include next seven-day iteration decision");
assert(audit.includes("Weekly local runner"), "completion audit must include weekly local runner");
assert(audit.includes("Browser/route smoke"), "completion audit must include browser route smoke");
assert(audit.includes("Generated tracking links redirect correctly"), "completion audit must include tracking link smoke");
assert(audit.includes("Worker event contract accepts funnel events"), "completion audit must include event contract smoke");
assert(audit.includes("Win-rule fixtures"), "completion audit must include win-rule fixtures");
assert(audit.includes("GitHub handoff exists"), "completion audit must include GitHub handoff");
assert(audit.includes("Owner approval pack exists"), "completion audit must include owner approval pack");
assert(audit.includes("Production deploy performed: no"), "completion audit must state production deploy was not performed");
assert(audit.includes("Public link change performed: no"), "completion audit must state public link changes were not performed");
assert(completionAuditStatus.ok === true, "completion audit status must be ok");
assert(completionAuditStatus.mode === "goal_completion_audit_status", "completion audit status mode must match");
assert(completionAuditStatus.status === "not_complete_data_and_external_gates", "completion audit status must expose both missing data evidence and external gates");
assert(completionAuditStatus.complete === false, "completion audit status complete must stay false while external gates remain");
assert(completionAuditStatus.completion_proven === false, "completion audit status must not claim completion proof");
assert(completionAuditStatus.data_evidence_ready === false, "completion audit status must keep data evidence unready while P0/P1 rows are pending");
assert(completionAuditStatus.data_evidence_gate_count === blocked.data_evidence_gates.length, "completion audit status must expose the same data evidence gate count as PreparedButBlocked");
assert(completionAuditStatus.unmet_data_evidence_gate_count === blocked.data_evidence_gates.filter((gate) => gate.status !== "met").length, "completion audit status must expose the same unmet data evidence count as PreparedButBlocked");
assert(completionAuditStatus.current_real_event_rows === ab.events_observed, "completion audit status event rows must match A/B status");
assert(completionAuditStatus.sample_threshold_met === ab.sample_threshold_met, "completion audit status sample gate must match A/B status");
assert(completionAuditStatus.challenger_win_rule_met === ab.challenger_win_rule_met, "completion audit status win rule must match A/B status");
assert(completionAuditStatus.pending_human_approval_count === launchReadiness.pending_human_approval_count, "completion audit status approval count must match launch readiness");
assert(completionAuditStatus.pending_human_approval_count >= 2, "completion audit status must retain all unresolved owner approval gates");
assert(completionAuditStatus.owner_decision_required === true, "completion audit status must require owner decision");
assert(completionAuditStatus.required_outputs_present === true, "completion audit status must mark requested local outputs present");
assert(completionAuditStatus.required_outputs.includes("data/goal_completion_audit_status.json"), "completion audit status must list itself as required output");
assert(completionAuditStatus.required_outputs.includes("data_collection_progress.md"), "completion audit status must list data collection progress report as required output");
assert(completionAuditStatus.required_outputs.includes("data_collection_progress.json"), "completion audit status must list data collection progress JSON as required output");
assert(completionAuditStatus.required_outputs.includes("data/data_collection_progress_status.json"), "completion audit status must list data collection progress status as required output");
assert(completionAuditStatus.required_outputs.includes("source_trust_matrix.md"), "completion audit status must list source trust report as required output");
assert(completionAuditStatus.required_outputs.includes("source_trust_matrix.json"), "completion audit status must list source trust matrix JSON as required output");
assert(completionAuditStatus.required_outputs.includes("data/source_trust_matrix_status.json"), "completion audit status must list source trust status as required output");
assert(completionAuditStatus.required_outputs.includes("next_p0_owner_inputs.md"), "completion audit status must list next P0 owner inputs report as required output");
assert(completionAuditStatus.required_outputs.includes("next_p0_owner_inputs.json"), "completion audit status must list next P0 owner inputs JSON as required output");
assert(completionAuditStatus.required_outputs.includes("data/next_p0_owner_inputs_status.json"), "completion audit status must list next P0 owner inputs status as required output");
assert(completionAuditStatus.required_outputs.includes("next_p0_owner_form.html"), "completion audit status must list next P0 owner form as required output");
assert(completionAuditStatus.required_outputs.includes("data/next_p0_owner_form_status.json"), "completion audit status must list next P0 owner form status as required output");
assert(completionAuditStatus.required_outputs.includes("next_p0_owner_form_fixture_report.md"), "completion audit status must list next P0 owner form fixture report as required output");
assert(completionAuditStatus.required_outputs.includes("data/next_p0_owner_form_fixture_status.json"), "completion audit status must list next P0 owner form fixture status as required output");
assert(completionAuditStatus.required_outputs.includes("next_p0_owner_intake.md"), "completion audit status must list next P0 owner intake report as required output");
assert(completionAuditStatus.required_outputs.includes("data/next_p0_owner_intake_status.json"), "completion audit status must list next P0 owner intake status as required output");
assert(completionAuditStatus.required_outputs.includes("next_p0_owner_intake_fixture_report.md"), "completion audit status must list next P0 owner intake fixture report as required output");
assert(completionAuditStatus.required_outputs.includes("data/next_p0_owner_intake_fixture_status.json"), "completion audit status must list next P0 owner intake fixture status as required output");
assert(completionAuditStatus.data_collection_progress_status === dataCollectionProgressStatus.status, "completion audit status must include data collection progress status");
assert(completionAuditStatus.data_collection_progress_total_tasks === dataCollectionProgressStatus.total_task_count, "completion audit status must include data collection progress total tasks");
assert(completionAuditStatus.data_collection_progress_pending_tasks === dataCollectionProgressStatus.pending_task_count, "completion audit status must include data collection progress pending tasks");
assert(completionAuditStatus.data_collection_progress_p0_pending === dataCollectionProgressStatus.p0_pending_count, "completion audit status must include data collection progress P0 pending count");
assert(completionAuditStatus.data_collection_progress_p1_pending === dataCollectionProgressStatus.p1_pending_count, "completion audit status must include data collection progress P1 pending count");
assert(completionAuditStatus.source_trust_status === sourceTrustMatrixStatus.status, "completion audit status must include source trust status");
assert(completionAuditStatus.source_trust_trusted_scoring_source_count === sourceTrustMatrixStatus.trusted_scoring_source_count, "completion audit status must include source trust trusted source count");
assert(completionAuditStatus.source_trust_sample_gate_source_count === sourceTrustMatrixStatus.sample_gate_source_count, "completion audit status must include source trust sample-gate source count");
assert(completionAuditStatus.source_trust_scoring_allowed_now === sourceTrustMatrixStatus.scoring_allowed_now, "completion audit status must include source trust scoring flag");
assert(completionAuditStatus.source_trust_real_event_rows === sourceTrustMatrixStatus.real_event_rows, "completion audit status must include source trust real event rows");
assert(completionAuditStatus.source_trust_p0_pending_count === sourceTrustMatrixStatus.p0_pending_count, "completion audit status must include source trust P0 pending count");
assert(completionAuditStatus.source_trust_data_lp_events_write_performed === false, "completion audit status must include no source trust data write");
assert(completionAuditStatus.next_p0_owner_form_status === nextP0OwnerFormStatus.status, "completion audit status must include next P0 owner form status");
assert(completionAuditStatus.next_p0_owner_form_rows === nextP0OwnerFormStatus.row_count, "completion audit status must include next P0 owner form rows");
assert(completionAuditStatus.next_p0_owner_form_fixture_scenarios === nextP0OwnerFormFixture.scenario_count, "completion audit status must include next P0 owner form fixture scenarios");
assert(completionAuditStatus.next_p0_owner_intake_status === nextP0OwnerIntake.status, "completion audit status must include next P0 owner intake status");
assert(completionAuditStatus.next_p0_owner_intake_candidate_found === nextP0OwnerIntake.candidate_found, "completion audit status must include next P0 owner intake candidate state");
assert(completionAuditStatus.next_p0_owner_intake_preview_rows === nextP0OwnerIntake.funnel_preview_rows + nextP0OwnerIntake.manual_preview_rows, "completion audit status must include next P0 owner intake preview rows");
assert(completionAuditStatus.next_p0_owner_intake_fixture_scenarios === nextP0OwnerIntakeFixture.scenario_count, "completion audit status must include next P0 owner intake fixture scenarios");
assert(completionAuditStatus.local_checks.launch_readiness_local_preflight_ok === launchReadiness.local_preflight_ok, "completion audit local preflight must match launch readiness");
assert(completionAuditStatus.local_checks.weekly_runner_success === (schedule.runner_status.status === "success"), "completion audit weekly runner status must match schedule");
assert(completionAuditStatus.local_checks.data_collection_progress_ok === true, "completion audit must check data collection progress");
assert(completionAuditStatus.local_checks.source_trust_ok === true, "completion audit must check source trust matrix");
assert(completionAuditStatus.local_checks.next_p0_owner_form_ok === true, "completion audit must check next P0 owner form");
assert(completionAuditStatus.local_checks.next_p0_owner_form_fixture_ok === true, "completion audit must check next P0 owner form fixture");
assert(completionAuditStatus.local_checks.next_p0_owner_intake_ok === true, "completion audit must check next P0 owner intake");
assert(completionAuditStatus.local_checks.next_p0_owner_intake_fixture_ok === true, "completion audit must check next P0 owner intake fixture");
assert(completionAuditStatus.local_checks.pipeline_external_effect === false, "completion audit must preserve pipeline external-effect flag");
for (const requiredGate of [
  "remote_d1_create_and_migrate",
  "candidate_worker_production_deploy",
  "public_ab_small_traffic_link",
  "github_repo_branch_pr",
  "formal_posts_line_push_payment_customer_data",
]) {
  assert(completionAuditStatus.required_external_gates.some((gate) => gate.id === requiredGate), `completion audit status missing gate ${requiredGate}`);
}
assertNoRedLineFlags(completionAuditStatus, "completion audit status");
assert(completionAuditStatus.safety_invariants.external_effect === false, "completion audit safety invariants must keep external_effect=false");
assert(completionAuditStatus.safety_invariants.production_deploy_performed === false, "completion audit safety invariants must not claim production deploy");
assert(completionAuditStatus.safety_invariants.github_push_or_pr_performed === false, "completion audit safety invariants must not claim GitHub push or PR");
assert(completionAuditStatus.safety_invariants.formal_post_performed === false, "completion audit safety invariants must not claim formal post");
assert(completionAuditStatus.safety_invariants.line_push_performed === false, "completion audit safety invariants must not claim LINE push");
assert(completionAuditStatus.safety_invariants.customer_data_mutation_performed === false, "completion audit safety invariants must not claim customer data mutation");
assert(completionAuditStatus.safety_invariants.payment_action_performed === false, "completion audit safety invariants must not claim payment action");
assert(completionAuditStatus.safety_invariants.delete_action_performed === false, "completion audit safety invariants must not claim delete action");
assert(objectiveAudit.ok === true, "objective sequence audit must pass");
assert(objectiveAudit.status === "local_objective_contract_verified_external_gated", "objective audit must stay local/external-gated");
assert(JSON.stringify(objectiveAudit.objective_sequence) === JSON.stringify(objectiveSequence), "objective audit sequence mismatch");
assert(objectiveAudit.sequence_status.config_sequence_ok === true, "objective audit config sequence must pass");
assert(objectiveAudit.sequence_status.pipeline_sequence_ok === true, "objective audit pipeline sequence must pass");
assert(objectiveAudit.sequence_status.pipeline_steps_ok === true, "objective audit pipeline steps must pass");
assert(objectiveAudit.checks.some((item) => item.id === "champion_release_preflight_clean_source" && item.ok === true), "objective audit must verify champion release preflight");
assert(objectiveAudit.champion_release_preflight.ok === true, "objective audit champion release preflight must pass");
assert(objectiveAudit.champion_release_preflight.patch_byte_identical === true, "objective audit must preserve champion patch byte identity");
assert(objectiveAudit.champion_release_preflight.production_command_template_dry_run_ok === true, "objective audit must preserve production CLI template dry-run");
assert(objectiveAudit.champion_release_preflight.rollback_target_version_id === championLiveDeploymentSnapshot.deployed_version.id, "objective audit rollback target must match live snapshot");
assert(objectiveAudit.champion_release_preflight.production_deploy_performed === false, "objective audit champion release must not deploy");
assert(objectiveAudit.champion_release_preflight.external_effect === false, "objective audit champion release must not cause external effects");
assert(objectiveAudit.one_variable_contract.changed_variable === ab.changed_variable, "objective audit must reference current changed variable");
assert(objectiveAudit.one_variable_contract.one_variable_rule_ok === true, "objective audit one-variable rule must pass");
assert(objectiveAudit.variable_rotation_fixtures.ok === true, "objective audit variable rotation fixtures must pass");
assert(objectiveAudit.variable_rotation_fixtures.mode === "variable_rotation_fixture_dry_run", "objective audit variable rotation mode must be dry-run");
assert(objectiveAudit.variable_rotation_fixtures.scenario_count === 4, "objective audit variable rotation must cover four scenarios");
assert(objectiveAudit.variable_rotation_fixtures.candidate_template_count >= 12, "objective audit variable rotation must include candidate templates");
assert(objectiveAudit.variable_rotation_fixtures.live_config_write_performed === false, "objective audit variable rotation must not write live config");
assert(objectiveAudit.variable_rotation_fixtures.external_effect === false, "objective audit variable rotation must not claim external effects");
assert(["hook", "offer", "visual_claim", "cta_text"].every((variable) => objectiveAudit.variable_rotation_fixtures.scenarios.some((scenario) => scenario.changed_variable === variable && scenario.ok === true && scenario.locked_variables_ok === true && scenario.changed_only_ok === true)), "objective audit variable rotation must prove every variable can vary alone");
assert(objectiveAudit.north_star_funnel.ok === true, "objective audit North Star funnel must pass");
assert(objectiveAudit.north_star_funnel.mode === "north_star_funnel_local_only", "objective audit North Star mode must match");
assert(JSON.stringify(objectiveAudit.north_star_funnel.path) === JSON.stringify(["link_click", "line_add", "lead_submit", "deal"]), "objective audit North Star path mismatch");
assert(objectiveAudit.north_star_funnel.primary_metric === "line_adds_per_100_clicks", "objective audit North Star primary metric mismatch");
assert(objectiveAudit.north_star_funnel.link_clicks === northStar.totals.link_clicks, "objective audit North Star clicks must match status");
assert(objectiveAudit.north_star_funnel.line_adds === northStar.totals.line_adds, "objective audit North Star LINE adds must match status");
assert(objectiveAudit.north_star_funnel.leads === northStar.totals.leads, "objective audit North Star leads must match status");
assert(objectiveAudit.north_star_funnel.deals === northStar.totals.deals, "objective audit North Star deals must match status");
assert(objectiveAudit.north_star_funnel.data_lp_events_write_performed === false, "objective audit North Star must not write data/lp_events.jsonl");
assert(objectiveAudit.north_star_funnel.external_effect === false, "objective audit North Star must not claim external effects");
assert(objectiveAudit.funnel_breakdown.ok === true, "objective audit funnel breakdown must pass");
assert(objectiveAudit.funnel_breakdown.content_variant_links === variants.drafts.length, "objective audit funnel link count mismatch");
assert(objectiveAudit.funnel_breakdown.external_effect === false, "objective audit funnel breakdown must not claim external effect");
assert(objectiveAudit.funnel_breakdown.public_link_change_performed === false, "objective audit funnel breakdown must not claim public link change");
assert(objectiveAudit.funnel_breakdown.formal_post_performed === false, "objective audit funnel breakdown must not claim formal post");
assert(objectiveAudit.sample_gate.thresholds.min_visits === 100, "objective audit min_visits must stay 100");
assert(objectiveAudit.sample_gate.thresholds.min_cta_clicks === 20, "objective audit min_cta_clicks must stay 20");
assert(objectiveAudit.sample_gate.thresholds.min_line_adds === 5, "objective audit min_line_adds must stay 5");
assert(objectiveAudit.sample_gate.thresholds.min_test_days === 3, "objective audit min_test_days must stay 3");
assert(objectiveAudit.sample_gate.thresholds.preferred_test_days === 7, "objective audit preferred_test_days must stay 7");
assert(objectiveAudit.win_rule_contract.metric === "line_add_rate", "objective audit win metric must be line_add_rate");
assert(objectiveAudit.win_rule_contract.challenger_lift_required === 1.15, "objective audit lift rule must stay 1.15");
assert(objectiveAudit.win_rule_contract.require_sample_threshold_met === true, "objective audit must require sample threshold");
assert(objectiveAudit.win_rule_contract.require_no_quality_regression === true, "objective audit must require no quality regression");
assert(config.quality_rules.min_lead_rate_retention_vs_champion === 0.8, "quality rule must retain at least 80% of champion lead rate");
assert(config.quality_rules.min_close_rate_retention_vs_champion === 0.8, "quality rule must retain at least 80% of champion close rate");
assert(scores.assets.every((asset) => Array.isArray(asset.quality_regression_reasons)), "scores must include quality regression reasons");
assert(objectiveAudit.tracking_link_smoke.ok === true, "objective audit must include passing tracking link smoke");
assert(objectiveAudit.tracking_link_smoke.mode === "isolated_local_tracking_link_smoke", "objective audit tracking smoke must be isolated local");
assert(objectiveAudit.tracking_link_smoke.links_checked === links.links.length, "objective audit tracking smoke must check every generated link");
assert(objectiveAudit.tracking_link_smoke.real_event_write_performed === false, "objective audit tracking smoke must not write real events");
assert(objectiveAudit.tracking_link_smoke.data_lp_events_write_performed === false, "objective audit tracking smoke must not write data/lp_events.jsonl");
assert(objectiveAudit.tracking_link_smoke.external_effect === false, "objective audit tracking smoke must not claim external effects");
assert(objectiveAudit.event_contract_smoke.ok === true, "objective audit must include passing event contract smoke");
assert(objectiveAudit.event_contract_smoke.sensitive_rejection_ok === true, "objective audit event contract must reject sensitive metadata");
assert(objectiveAudit.event_contract_smoke.invalid_event_rejection_ok === true, "objective audit event contract must reject invalid events");
assert(objectiveAudit.event_contract_smoke.scheduled_quality_regression_ok === true, "objective audit event contract must verify scheduled quality regression rejection");
assert(objectiveAudit.event_contract_smoke.scheduled_quality_regression_decision === "reject_quality_regression", "objective audit event contract scheduled quality regression decision must reject");
assert(objectiveAudit.event_contract_smoke.redirect_attribution_ok === true, "objective audit event contract must verify redirect attribution propagation");
assert(objectiveAudit.event_contract_smoke.ab_redirect_attribution_ok === true, "objective audit event contract must verify A/B redirect attribution propagation");
assert(objectiveAudit.event_contract_smoke.real_event_write_performed === false, "objective audit event contract must not write real events");
assert(objectiveAudit.event_contract_smoke.data_lp_events_write_performed === false, "objective audit event contract must not write data/lp_events.jsonl");
assert(objectiveAudit.event_input_quality_gate.ok === true, "objective audit must include passing event input quality gate");
assert(objectiveAudit.event_input_quality_gate.scoring_allowed === true, "objective audit event input quality must allow clean scoring");
assert(objectiveAudit.event_input_quality_gate.pii_or_sensitive_data_detected === false, "objective audit event input quality must not detect PII");
assert(objectiveAudit.event_input_quality_gate.data_lp_events_write_performed === false, "objective audit event input quality must not write data/lp_events.jsonl");
assert(objectiveAudit.funnel_aggregate_preview.ok === true, "objective audit must include passing full-funnel aggregate preview");
assert(objectiveAudit.funnel_aggregate_preview.mode === "full_funnel_preview", "objective audit full-funnel aggregate must be preview mode");
assert(objectiveAudit.funnel_aggregate_preview.apply_performed === false, "objective audit full-funnel aggregate must not apply");
assert(objectiveAudit.funnel_aggregate_preview.data_lp_events_write_performed === false, "objective audit full-funnel aggregate must not write data/lp_events.jsonl");
assert(objectiveAudit.funnel_aggregate_fixtures.ok === true, "objective audit must include passing full-funnel aggregate fixtures");
assert(objectiveAudit.funnel_aggregate_fixtures.mode === "funnel_aggregate_fixture_dry_run", "objective audit full-funnel aggregate fixtures must be dry-run");
assert(objectiveAudit.funnel_aggregate_fixtures.scenario_count === 6, "objective audit full-funnel aggregate fixtures must cover six scenarios");
assert(objectiveAudit.funnel_aggregate_fixtures.execution_performed === false, "objective audit full-funnel aggregate fixtures must not execute external commands");
assert(objectiveAudit.funnel_aggregate_fixtures.real_event_write_performed === false, "objective audit full-funnel aggregate fixtures must not write real events");
assert(objectiveAudit.funnel_aggregate_fixtures.data_lp_events_write_performed === false, "objective audit full-funnel aggregate fixtures must not write data/lp_events.jsonl");
assert(objectiveAudit.funnel_aggregate_fixtures.external_effect === false, "objective audit full-funnel aggregate fixtures must not claim external effects");
assert(objectiveAudit.real_data_apply_fixtures.ok === true, "objective audit must include passing real-data apply fixtures");
assert(objectiveAudit.real_data_apply_fixtures.mode === "real_data_apply_fixture_dry_run", "objective audit real-data apply fixtures must be dry-run");
assert(objectiveAudit.real_data_apply_fixtures.scenario_count === 4, "objective audit real-data apply fixtures must cover four scenarios");
assert(objectiveAudit.real_data_apply_fixtures.real_event_write_performed === false, "objective audit real-data apply fixtures must not write real events");
assert(objectiveAudit.real_data_apply_fixtures.data_lp_events_write_performed === false, "objective audit real-data apply fixtures must not write data/lp_events.jsonl");
assert(objectiveAudit.real_data_apply_fixtures.external_effect === false, "objective audit real-data apply fixtures must not claim external effects");
assert(objectiveAudit.real_data_decision_replay.ok === true, "objective audit must include passing real-data decision replay");
assert(objectiveAudit.real_data_decision_replay.mode === "real_data_decision_replay_fixture_dry_run", "objective audit real-data decision replay must be dry-run");
assert(objectiveAudit.real_data_decision_replay.scenario_count === 6, "objective audit real-data decision replay must cover six scenarios");
assert(objectiveAudit.real_data_decision_replay.local_fixture_commands_executed === true, "objective audit real-data decision replay must execute local fixture commands");
assert(objectiveAudit.real_data_decision_replay.source_capture_ledger_replay_executed === true, "objective audit real-data decision replay must execute source-capture ledger replay");
assert(objectiveAudit.real_data_decision_replay.source_capture_compile_commands_executed === true, "objective audit real-data decision replay must execute source-capture compile commands");
assert(objectiveAudit.real_data_decision_replay.ledger_to_decision_replay_performed === true, "objective audit real-data decision replay must cover ledger-to-decision path");
assert(objectiveAudit.real_data_decision_replay.execution_performed === false, "objective audit real-data decision replay must not execute external commands");
assert(objectiveAudit.real_data_decision_replay.real_event_write_performed === false, "objective audit real-data decision replay must not write real events");
assert(objectiveAudit.real_data_decision_replay.data_lp_events_write_performed === false, "objective audit real-data decision replay must not write data/lp_events.jsonl");
assert(objectiveAudit.real_data_decision_replay.external_effect === false, "objective audit real-data decision replay must not claim external effects");
for (const expected of [
  "sample_insufficient_replay",
  "winning_replay_owner_review_only",
  "underperform_replay_next_variable",
  "spam_regression_replay",
  "lead_regression_replay",
  "close_regression_replay",
]) {
  const scenario = objectiveAudit.real_data_decision_replay.scenarios.find((item) => item.id === expected);
  assert(scenario?.ok === true, `objective audit real-data decision replay missing ${expected}`);
  assert(scenario.source_capture_compile_ok === true, `objective audit real-data decision replay source compile failed for ${expected}`);
  assert(scenario.source_capture_compile_status === "owner_preview_ready", `objective audit real-data decision replay source compile must produce owner preview for ${expected}`);
  assert(scenario.source_capture_compile_data_lp_events_write_performed === false, `objective audit real-data decision replay source compile must not write real events for ${expected}`);
  assert(scenario.source_capture_compile_external_effect === false, `objective audit real-data decision replay source compile must have no external effect for ${expected}`);
}
assert(objectiveAudit.source_readiness.ok === true, "objective audit must include passing source readiness monitor");
assert(objectiveAudit.source_readiness.mode === "source_readiness_monitor", "objective audit source readiness mode must match");
assert(objectiveAudit.source_readiness.data_lp_events_write_performed === false, "objective audit source readiness must not write data/lp_events.jsonl");
assert(objectiveAudit.source_readiness.external_effect === false, "objective audit source readiness must not claim external effects");
assert(objectiveAudit.source_readiness.ready_for_public_iteration_decision === false || objectiveAudit.source_readiness.sample_threshold_met === true, "objective audit source readiness cannot be public-ready without sample threshold");
assert(objectiveAudit.source_capture_pack.ok === true, "objective audit must include passing source capture pack");
assert(objectiveAudit.source_capture_pack.mode === "source_capture_pack", "objective audit source capture mode must match");
assert(objectiveAudit.source_capture_pack.template_only === true, "objective audit source capture must be template-only");
assert(objectiveAudit.source_capture_pack.live_input_files_created === false, "objective audit source capture must not create live input files");
assert(objectiveAudit.source_capture_pack.data_lp_events_write_performed === false, "objective audit source capture must not write data/lp_events.jsonl");
assert(objectiveAudit.source_capture_pack.external_effect === false, "objective audit source capture must not claim external effects");
assert(objectiveAudit.sample_gate_replay_fixtures.ok === true, "objective audit must include passing sample-gate replay fixtures");
assert(objectiveAudit.sample_gate_replay_fixtures.mode === "sample_gate_replay_fixture_dry_run", "objective audit sample-gate replay mode must match");
assert(objectiveAudit.sample_gate_replay_fixtures.template_rows === sampleGateLedgerStatus.row_count, "objective audit sample-gate replay template rows must match");
assert(objectiveAudit.sample_gate_replay_fixtures.scenario_count === 3, "objective audit sample-gate replay must cover three scenarios");
assert(objectiveAudit.sample_gate_replay_fixtures.sample_gate_ledger_replay_executed === true, "objective audit sample-gate replay must execute ledger replay");
assert(objectiveAudit.sample_gate_replay_fixtures.source_capture_compile_commands_executed === true, "objective audit sample-gate replay must execute source compile");
assert(objectiveAudit.sample_gate_replay_fixtures.data_lp_events_write_performed === false, "objective audit sample-gate replay must not write data/lp_events.jsonl");
assert(objectiveAudit.sample_gate_replay_fixtures.external_effect === false, "objective audit sample-gate replay must not claim external effects");
assert(objectiveAudit.source_capture_compile.ok === true, "objective audit must include passing source capture compile");
assert(objectiveAudit.source_capture_compile.mode === "source_capture_compile_preview", "objective audit source capture compile mode must match");
assert(["waiting_for_filled_counts", "owner_preview_ready"].includes(objectiveAudit.source_capture_compile.status), "objective audit source capture compile status is invalid");
assert(objectiveAudit.source_capture_compile.live_input_files_created === false, "objective audit source capture compile must not create live input files");
assert(objectiveAudit.source_capture_compile.data_lp_events_write_performed === false, "objective audit source capture compile must not write data/lp_events.jsonl");
assert(objectiveAudit.source_capture_compile.external_effect === false, "objective audit source capture compile must not claim external effects");
assert(objectiveAudit.source_capture_compile_fixtures.ok === true, "objective audit must include passing source capture compile fixtures");
assert(objectiveAudit.source_capture_compile_fixtures.mode === "source_capture_compile_fixture_dry_run", "objective audit source capture compile fixtures mode must match");
assert(objectiveAudit.source_capture_compile_fixtures.scenario_count === 7, "objective audit source capture compile fixtures must cover seven scenarios");
assert(objectiveAudit.source_capture_compile_fixtures.data_lp_events_write_performed === false, "objective audit source capture compile fixtures must not write data/lp_events.jsonl");
assert(objectiveAudit.source_capture_compile_fixtures.external_effect === false, "objective audit source capture compile fixtures must not claim external effects");
assert(objectiveAudit.real_data_intake_plan.ok === true, "objective audit must include passing real-data intake plan");
assert(objectiveAudit.real_data_intake_plan.data_lp_events_write_performed === false, "objective audit real-data intake must not write data/lp_events.jsonl");
assert(objectiveAudit.data_collection_brief.ok === true, "objective audit must include passing data collection brief");
assert(objectiveAudit.data_collection_brief.mode === "data_collection_brief", "objective audit data collection brief mode must match");
assert(objectiveAudit.data_collection_brief.task_count === dataCollectionStatus.task_count, "objective audit data collection task count must match status");
assert(objectiveAudit.data_collection_brief.sample_gate_p0_task_count === sampleGateStatus.p0_task_count, "objective audit sample gate task count must match status");
assert(objectiveAudit.data_collection_brief.live_input_files_created === false, "objective audit data collection brief must not create live input files");
assert(objectiveAudit.data_collection_brief.data_lp_events_write_performed === false, "objective audit data collection brief must not write data/lp_events.jsonl");
assert(objectiveAudit.data_collection_brief.external_effect === false, "objective audit data collection brief must not claim external effects");
assert(objectiveAudit.data_collection_progress.ok === true, "objective audit must include passing data collection progress");
assert(objectiveAudit.data_collection_progress.mode === "data_collection_progress", "objective audit data collection progress mode must match");
assert(objectiveAudit.data_collection_progress.next_owner_input_count === nextP0OwnerInputs.current_input_count, "objective audit data collection progress next inputs must match focused inputs");
assert(objectiveAudit.data_collection_progress.data_lp_events_write_performed === false, "objective audit data collection progress must not write data/lp_events.jsonl");
assert(objectiveAudit.data_collection_progress.external_effect === false, "objective audit data collection progress must not claim external effects");
assert(objectiveAudit.next_p0_owner_inputs.ok === true, "objective audit must include next P0 owner inputs");
assert(objectiveAudit.next_p0_owner_inputs.current_input_count === nextP0OwnerInputs.current_input_count, "objective audit next P0 input count must match");
assert(objectiveAudit.next_p0_owner_inputs.recommended_open_command === "open next_p0_owner_form.html", "objective audit next P0 inputs must recommend focused form");
assert(objectiveAudit.next_p0_owner_inputs.data_lp_events_write_performed === false, "objective audit next P0 inputs must not write data/lp_events.jsonl");
assert(objectiveAudit.next_p0_owner_inputs.external_effect === false, "objective audit next P0 inputs must not claim external effects");
assert(objectiveAudit.next_p0_owner_form.ok === true, "objective audit must include passing next P0 owner form");
assert(objectiveAudit.next_p0_owner_form.mode === "next_p0_owner_form", "objective audit next P0 owner form mode must match");
assert(objectiveAudit.next_p0_owner_form.row_count === nextP0OwnerFormStatus.row_count, "objective audit next P0 owner form row count must match status");
assert(objectiveAudit.next_p0_owner_form.download_filename === "next_p0_owner_inputs.filled.csv", "objective audit next P0 owner form filename must match");
assert(objectiveAudit.next_p0_owner_form.browser_only === true, "objective audit next P0 owner form must be browser-only");
assert(objectiveAudit.next_p0_owner_form.browser_persistence === false, "objective audit next P0 owner form must not persist browser data");
assert(objectiveAudit.next_p0_owner_form.network_calls_performed === false, "objective audit next P0 owner form must not perform network calls");
assert(objectiveAudit.next_p0_owner_form.live_input_files_created === false, "objective audit next P0 owner form must not create live inputs");
assert(objectiveAudit.next_p0_owner_form.data_lp_events_write_performed === false, "objective audit next P0 owner form must not write data/lp_events.jsonl");
assert(objectiveAudit.next_p0_owner_form.external_effect === false, "objective audit next P0 owner form must not claim external effects");
assert(objectiveAudit.next_p0_owner_form_fixtures.ok === true, "objective audit must include passing next P0 owner form fixtures");
assert(objectiveAudit.next_p0_owner_form_fixtures.mode === "next_p0_owner_form_fixture_dry_run", "objective audit next P0 owner form fixture mode must match");
assert(objectiveAudit.next_p0_owner_form_fixtures.scenario_count === 4, "objective audit next P0 owner form fixture count must match");
assert(objectiveAudit.next_p0_owner_form_fixtures.browser_form_static_checks_executed === true, "objective audit next P0 owner form fixtures must execute static checks");
assert(objectiveAudit.next_p0_owner_form_fixtures.export_contract_verified === true, "objective audit next P0 owner form fixtures must verify export contract");
assert(objectiveAudit.next_p0_owner_form_fixtures.live_input_files_created === false, "objective audit next P0 owner form fixtures must not create live inputs");
assert(objectiveAudit.next_p0_owner_form_fixtures.data_lp_events_write_performed === false, "objective audit next P0 owner form fixtures must not write data/lp_events.jsonl");
assert(objectiveAudit.next_p0_owner_form_fixtures.external_effect === false, "objective audit next P0 owner form fixtures must not claim external effects");
assert(objectiveAudit.next_p0_owner_intake.ok === true, "objective audit must include passing next P0 owner intake");
assert(objectiveAudit.next_p0_owner_intake.mode === "next_p0_owner_intake", "objective audit next P0 owner intake mode must match");
assert(objectiveAudit.next_p0_owner_intake.status === nextP0OwnerIntake.status, "objective audit next P0 owner intake status must match");
assert(objectiveAudit.next_p0_owner_intake.expected_row_count === nextP0OwnerInputs.current_input_count, "objective audit next P0 owner intake expected rows must match focused inputs");
assert(objectiveAudit.next_p0_owner_intake.stage_performed === false, "objective audit next P0 owner intake must not stage live inputs");
assert(objectiveAudit.next_p0_owner_intake.live_input_files_created === false, "objective audit next P0 owner intake must not create live inputs");
assert(objectiveAudit.next_p0_owner_intake.data_lp_events_write_performed === false, "objective audit next P0 owner intake must not write data/lp_events.jsonl");
assert(objectiveAudit.next_p0_owner_intake.external_effect === false, "objective audit next P0 owner intake must not claim external effects");
assert(objectiveAudit.next_p0_owner_intake_fixtures.ok === true, "objective audit must include passing next P0 owner intake fixtures");
assert(objectiveAudit.next_p0_owner_intake_fixtures.mode === "next_p0_owner_intake_fixture_dry_run", "objective audit next P0 owner intake fixture mode must match");
assert(objectiveAudit.next_p0_owner_intake_fixtures.scenario_count === 5, "objective audit next P0 owner intake fixture count must match");
assert(objectiveAudit.next_p0_owner_intake_fixtures.local_fixture_commands_executed === true, "objective audit next P0 owner intake fixtures must execute local commands");
assert(objectiveAudit.next_p0_owner_intake_fixtures.live_project_inputs_created === false, "objective audit next P0 owner intake fixtures must not create project live inputs");
assert(objectiveAudit.next_p0_owner_intake_fixtures.data_lp_events_write_performed === false, "objective audit next P0 owner intake fixtures must not write data/lp_events.jsonl");
assert(objectiveAudit.next_p0_owner_intake_fixtures.external_effect === false, "objective audit next P0 owner intake fixtures must not claim external effects");
assert(objectiveAudit.owner_data_preflight.ok === true, "objective audit must include passing owner data preflight");
assert(objectiveAudit.owner_data_preflight.mode === "owner_data_preflight_local_only", "objective audit owner data preflight mode must match");
assert(objectiveAudit.owner_data_preflight.status === ownerDataPreflight.status, "objective audit owner data preflight status must match");
assert(objectiveAudit.owner_data_preflight.selected_source_row_count === ownerDataPreflight.selected_source_row_count, "objective audit owner data preflight row count must match");
assert(objectiveAudit.owner_data_preflight.owner_review_required === true, "objective audit owner data preflight must keep owner review required");
assert(objectiveAudit.owner_data_preflight.real_events_unchanged === true, "objective audit owner data preflight must leave real events unchanged");
assert(objectiveAudit.owner_data_preflight.data_lp_events_write_performed === false, "objective audit owner data preflight must not write data/lp_events.jsonl");
assert(objectiveAudit.owner_data_preflight.external_effect === false, "objective audit owner data preflight must not claim external effects");
assert(objectiveAudit.sample_gate_capture_calendar.ok === true, "objective audit must include passing sample-gate capture calendar");
assert(objectiveAudit.sample_gate_capture_calendar.mode === "sample_gate_capture_calendar", "objective audit sample-gate capture calendar mode must match");
assert(objectiveAudit.sample_gate_capture_calendar.event_count === sampleGateCaptureCalendar.events.length, "objective audit sample-gate capture calendar event count must match");
assert(objectiveAudit.sample_gate_capture_calendar.next_due_event_id === sampleGateCaptureCalendarStatus.next_due_event_id, "objective audit sample-gate capture calendar next due id must match");
assert(objectiveAudit.sample_gate_capture_calendar.p0_input_count === nextP0OwnerInputs.current_input_count, "objective audit sample-gate capture calendar P0 inputs must match");
assert(objectiveAudit.sample_gate_capture_calendar.progress_status === dataCollectionProgressStatus.status, "objective audit sample-gate capture calendar progress must match");
assert(objectiveAudit.sample_gate_capture_calendar.calendar_import_performed === false, "objective audit sample-gate capture calendar must not import Calendar");
assert(objectiveAudit.sample_gate_capture_calendar.system_reminder_created === false, "objective audit sample-gate capture calendar must not create reminders");
assert(objectiveAudit.sample_gate_capture_calendar.browser_open_performed === false, "objective audit sample-gate capture calendar must not open browser");
assert(objectiveAudit.sample_gate_capture_calendar.data_lp_events_write_performed === false, "objective audit sample-gate capture calendar must not write data/lp_events.jsonl");
assert(objectiveAudit.sample_gate_capture_calendar.external_effect === false, "objective audit sample-gate capture calendar must not claim external effects");
assert(objectiveAudit.sample_gate_due_status.ok === true, "objective audit must include passing sample-gate due status");
assert(objectiveAudit.sample_gate_due_status.mode === "sample_gate_due_status", "objective audit sample-gate due mode must match");
assert(objectiveAudit.sample_gate_due_status.status === sampleGateDueStatus.status, "objective audit sample-gate due status must match");
assert(objectiveAudit.sample_gate_due_status.due_event_id === sampleGateDueStatus.due_event_id, "objective audit sample-gate due event must match");
assert(objectiveAudit.sample_gate_due_status.p0_input_count === nextP0OwnerInputs.current_input_count, "objective audit sample-gate due P0 inputs must match");
assert(objectiveAudit.sample_gate_due_status.progress_status === dataCollectionProgressStatus.status, "objective audit sample-gate due progress must match");
assert(objectiveAudit.sample_gate_due_status.capture_calendar_next_due_event_id === sampleGateCaptureCalendarStatus.next_due_event_id, "objective audit sample-gate due calendar event must match");
assert(objectiveAudit.sample_gate_due_status.challenger_promotion_allowed === false, "objective audit sample-gate due must not allow promotion");
assert(objectiveAudit.sample_gate_due_status.next_variable_rotation_allowed === false, "objective audit sample-gate due must not allow rotation");
assert(objectiveAudit.sample_gate_due_status.calendar_import_performed === false, "objective audit sample-gate due must not import Calendar");
assert(objectiveAudit.sample_gate_due_status.system_reminder_created === false, "objective audit sample-gate due must not create reminders");
assert(objectiveAudit.sample_gate_due_status.browser_open_performed === false, "objective audit sample-gate due must not open browser");
assert(objectiveAudit.sample_gate_due_status.data_lp_events_write_performed === false, "objective audit sample-gate due must not write data/lp_events.jsonl");
assert(objectiveAudit.sample_gate_due_status.external_effect === false, "objective audit sample-gate due must not claim external effects");
assert(objectiveAudit.week0_owner_capture_queue.ok === true, "objective audit must include passing Week 0 owner capture queue");
assert(objectiveAudit.week0_owner_capture_queue.mode === "week0_owner_capture_queue", "objective audit Week 0 owner capture queue mode must match");
assert(objectiveAudit.week0_owner_capture_queue.p0_task_count === sampleGateStatus.p0_task_count, "objective audit owner capture queue task count must match sample gate status");
assert(objectiveAudit.week0_owner_capture_queue.p0_link_count === sampleGateStatus.p0_link_count, "objective audit owner capture queue link count must match sample gate status");
assert(objectiveAudit.week0_owner_capture_queue.source_group_count >= 2, "objective audit owner capture queue must include source groups");
assert(objectiveAudit.week0_owner_capture_queue.live_input_files_created === false, "objective audit owner capture queue must not create live input files");
assert(objectiveAudit.week0_owner_capture_queue.data_lp_events_write_performed === false, "objective audit owner capture queue must not write data/lp_events.jsonl");
assert(objectiveAudit.week0_owner_capture_queue.external_effect === false, "objective audit owner capture queue must not claim external effects");
assert(objectiveAudit.owner_sample_gate_status.ok === true, "objective audit must include passing owner sample gate status");
assert(objectiveAudit.owner_sample_gate_status.mode === "owner_sample_gate_status", "objective audit owner sample gate mode must match");
assert(objectiveAudit.owner_sample_gate_status.quality_guard_status === "not_evaluated_from_sample_gate", "objective audit owner sample gate must preserve quality review gate");
assert(objectiveAudit.owner_sample_gate_status.challenger_win_rule_met === false, "objective audit owner sample gate must not mark final win rule met");
assert(objectiveAudit.owner_sample_gate_status.promotion_performed === false, "objective audit owner sample gate must not promote challenger");
assert(objectiveAudit.owner_sample_gate_status.live_input_files_created === false, "objective audit owner sample gate must not create live input files");
assert(objectiveAudit.owner_sample_gate_status.data_lp_events_write_performed === false, "objective audit owner sample gate must not write data/lp_events.jsonl");
assert(objectiveAudit.owner_sample_gate_status.external_effect === false, "objective audit owner sample gate must not claim external effects");
assert(objectiveAudit.sample_gate_owner_worksheet.ok === true, "objective audit must include passing sample gate owner worksheet");
assert(objectiveAudit.sample_gate_owner_worksheet.mode === "sample_gate_owner_worksheet", "objective audit sample gate owner worksheet mode must match");
assert(objectiveAudit.sample_gate_owner_worksheet.row_count === 18, "objective audit sample gate owner worksheet must cover 18 rows");
assert(objectiveAudit.sample_gate_owner_worksheet.link_count === 6, "objective audit sample gate owner worksheet must cover six links");
assert(objectiveAudit.sample_gate_owner_worksheet.live_input_files_created === false, "objective audit sample gate owner worksheet must not create live input files");
assert(objectiveAudit.sample_gate_owner_worksheet.data_lp_events_write_performed === false, "objective audit sample gate owner worksheet must not write data/lp_events.jsonl");
assert(objectiveAudit.sample_gate_owner_worksheet.external_effect === false, "objective audit sample gate owner worksheet must not claim external effects");
assert(objectiveAudit.sample_gate_owner_form.ok === true, "objective audit must include passing sample gate owner form");
assert(objectiveAudit.sample_gate_owner_form.mode === "sample_gate_owner_form", "objective audit sample gate owner form mode must match");
assert(objectiveAudit.sample_gate_owner_form.row_count === 18, "objective audit sample gate owner form must cover 18 rows");
assert(objectiveAudit.sample_gate_owner_form.link_count === 6, "objective audit sample gate owner form must cover six links");
assert(objectiveAudit.sample_gate_owner_form.download_filename === "sample_gate_ledger.filled.csv", "objective audit sample gate owner form must export filled ledger filename");
assert(objectiveAudit.sample_gate_owner_form.browser_only === true, "objective audit sample gate owner form must be browser-only");
assert(objectiveAudit.sample_gate_owner_form.browser_persistence === false, "objective audit sample gate owner form must not persist browser data");
assert(objectiveAudit.sample_gate_owner_form.network_calls_performed === false, "objective audit sample gate owner form must not perform network calls");
assert(objectiveAudit.sample_gate_owner_form.live_input_files_created === false, "objective audit sample gate owner form must not create live input files");
assert(objectiveAudit.sample_gate_owner_form.data_lp_events_write_performed === false, "objective audit sample gate owner form must not write data/lp_events.jsonl");
assert(objectiveAudit.sample_gate_owner_form.external_effect === false, "objective audit sample gate owner form must not claim external effects");
assert(objectiveAudit.sample_gate_owner_form_fixtures.ok === true, "objective audit must include passing sample gate owner form fixtures");
assert(objectiveAudit.sample_gate_owner_form_fixtures.mode === "sample_gate_owner_form_fixture_dry_run", "objective audit sample gate owner form fixture mode must match");
assert(objectiveAudit.sample_gate_owner_form_fixtures.scenario_count === 3, "objective audit sample gate owner form fixture count must match");
assert(objectiveAudit.sample_gate_owner_form_fixtures.form_export_replay_executed === true, "objective audit sample gate owner form fixtures must replay form export");
assert(objectiveAudit.sample_gate_owner_form_fixtures.source_capture_compile_commands_executed === true, "objective audit sample gate owner form fixtures must execute source compile");
assert(objectiveAudit.sample_gate_owner_form_fixtures.owner_sample_gate_commands_executed === true, "objective audit sample gate owner form fixtures must execute owner sample gate");
assert(objectiveAudit.sample_gate_owner_form_fixtures.scenarios.some((scenario) => scenario.id === "form_export_ready_queues_owner_review" && scenario.owner_status === "sample_rate_win_needs_quality_review"), "objective audit sample gate owner form fixtures must include owner-review scenario");
assert(objectiveAudit.sample_gate_owner_form_fixtures.scenarios.some((scenario) => scenario.id === "form_export_sensitive_evidence_blocked" && scenario.owner_status === "blocked_invalid_owner_sample_gate"), "objective audit sample gate owner form fixtures must include sensitive-evidence block scenario");
assert(objectiveAudit.sample_gate_owner_form_fixtures.scenarios.every((scenario) => scenario.promotion_performed === false), "objective audit sample gate owner form fixtures must not promote");
assert(objectiveAudit.sample_gate_owner_form_fixtures.live_input_files_created === false, "objective audit sample gate owner form fixtures must not create live input files");
assert(objectiveAudit.sample_gate_owner_form_fixtures.data_lp_events_write_performed === false, "objective audit sample gate owner form fixtures must not write data/lp_events.jsonl");
assert(objectiveAudit.sample_gate_owner_form_fixtures.external_effect === false, "objective audit sample gate owner form fixtures must not claim external effects");
assert(objectiveAudit.owner_sample_gate_fixtures.ok === true, "objective audit must include passing owner sample gate fixtures");
assert(objectiveAudit.owner_sample_gate_fixtures.mode === "owner_sample_gate_fixture_dry_run", "objective audit owner sample gate fixture mode must match");
assert(objectiveAudit.owner_sample_gate_fixtures.scenario_count === 7, "objective audit owner sample gate fixture count must match");
assert(objectiveAudit.owner_sample_gate_fixtures.scenarios.some((scenario) => scenario.id === "sample_rate_win_needs_quality_review"), "objective audit owner sample gate fixtures must include winning-review scenario");
assert(objectiveAudit.owner_sample_gate_fixtures.scenarios.some((scenario) => scenario.id === "sensitive_evidence_blocks_status"), "objective audit owner sample gate fixtures must include sensitive-evidence scenario");
assert(objectiveAudit.owner_sample_gate_fixtures.real_events_unchanged === true, "objective audit owner sample gate fixtures must leave real events unchanged");
assert(objectiveAudit.owner_sample_gate_fixtures.data_lp_events_write_performed === false, "objective audit owner sample gate fixtures must not write data/lp_events.jsonl");
assert(objectiveAudit.owner_sample_gate_fixtures.external_effect === false, "objective audit owner sample gate fixtures must not claim external effects");
assert(objectiveAudit.owner_quality_review.ok === true, "objective audit must include passing owner quality review");
assert(objectiveAudit.owner_quality_review.mode === "owner_quality_review", "objective audit owner quality review mode must match");
assert(objectiveAudit.owner_quality_review.sample_rate_win_candidate === ownerQualityReview.sample_rate_win_candidate, "objective audit owner quality review sample-rate candidate must match status");
assert(objectiveAudit.owner_quality_review.promotion_performed === false, "objective audit owner quality review must not promote challenger");
assert(objectiveAudit.owner_quality_review.data_lp_events_write_performed === false, "objective audit owner quality review must not write data/lp_events.jsonl");
assert(objectiveAudit.owner_quality_review.approval_queue_write_performed === false, "objective audit owner quality review must not write approval queue");
assert(objectiveAudit.owner_quality_review.external_effect === false, "objective audit owner quality review must not claim external effects");
assert(objectiveAudit.owner_quality_review_form.ok === true, "objective audit must include passing owner quality review form");
assert(objectiveAudit.owner_quality_review_form.mode === "owner_quality_review_form", "objective audit owner quality review form mode must match");
assert(objectiveAudit.owner_quality_review_form.sample_rate_win_candidate === ownerQualityReviewForm.sample_rate_win_candidate, "objective audit owner quality review form sample-rate candidate must match status");
assert(objectiveAudit.owner_quality_review_form.browser_only === true, "objective audit owner quality review form must be browser-only");
assert(objectiveAudit.owner_quality_review_form.network_calls_performed === false, "objective audit owner quality review form must not perform network calls");
assert(objectiveAudit.owner_quality_review_form.data_lp_events_write_performed === false, "objective audit owner quality review form must not write data/lp_events.jsonl");
assert(objectiveAudit.owner_quality_review_form.approval_queue_write_performed === false, "objective audit owner quality review form must not write approval queue");
assert(objectiveAudit.owner_quality_review_form.promotion_performed === false, "objective audit owner quality review form must not promote");
assert(objectiveAudit.owner_quality_review_form.external_effect === false, "objective audit owner quality review form must not claim external effects");
assert(objectiveAudit.owner_quality_review_form_fixtures.ok === true, "objective audit must include passing owner quality review form fixtures");
assert(objectiveAudit.owner_quality_review_form_fixtures.mode === "owner_quality_review_form_fixture_dry_run", "objective audit owner quality review form fixture mode must match");
assert(objectiveAudit.owner_quality_review_form_fixtures.scenario_count === 4, "objective audit owner quality review form fixture count must match");
assert(objectiveAudit.owner_quality_review_form_fixtures.scenarios.some((scenario) => scenario.id === "quality_form_export_pass_queues_owner_review" && scenario.no_quality_regression === true && scenario.promotion_review_queued === true), "objective audit owner quality review form fixtures must include pass scenario");
assert(objectiveAudit.owner_quality_review_form_fixtures.scenarios.some((scenario) => scenario.id === "quality_form_export_regression_keeps_champion" && scenario.no_quality_regression === false), "objective audit owner quality review form fixtures must include quality regression scenario");
assert(objectiveAudit.owner_quality_review_form_fixtures.scenarios.some((scenario) => scenario.id === "quality_form_export_sensitive_notes_blocked" && scenario.issue_count > 0), "objective audit owner quality review form fixtures must include sensitive input block");
assert(objectiveAudit.owner_quality_review_form_fixtures.scenarios.every((scenario) => scenario.promotion_performed === false), "objective audit owner quality review form fixtures must not promote");
assert(objectiveAudit.owner_quality_review_form_fixtures.data_lp_events_write_performed === false, "objective audit owner quality review form fixtures must not write data/lp_events.jsonl");
assert(objectiveAudit.owner_quality_review_form_fixtures.approval_queue_write_performed === false, "objective audit owner quality review form fixtures must not write approval queue");
assert(objectiveAudit.owner_quality_review_form_fixtures.external_effect === false, "objective audit owner quality review form fixtures must not claim external effects");
assert(objectiveAudit.owner_quality_review_fixtures.ok === true, "objective audit must include passing owner quality review fixtures");
assert(objectiveAudit.owner_quality_review_fixtures.mode === "owner_quality_review_fixture_dry_run", "objective audit owner quality review fixture mode must match");
assert(objectiveAudit.owner_quality_review_fixtures.scenario_count === 6, "objective audit owner quality review fixture count must match");
assert(objectiveAudit.owner_quality_review_fixtures.scenarios.some((scenario) => scenario.id === "sample_rate_win_quality_pass_queues_review" && scenario.no_quality_regression === true && scenario.promotion_review_queued === true), "objective audit owner quality review fixtures must include pass scenario");
assert(objectiveAudit.owner_quality_review_fixtures.scenarios.some((scenario) => scenario.id === "sample_rate_win_quality_regression_keeps_champion" && scenario.no_quality_regression === false), "objective audit owner quality review fixtures must include quality regression scenario");
assert(objectiveAudit.owner_quality_review_fixtures.scenarios.some((scenario) => scenario.id === "sensitive_evidence_blocks_review" && scenario.issue_count > 0), "objective audit owner quality review fixtures must include sensitive evidence block");
assert(objectiveAudit.owner_quality_review_fixtures.scenarios.every((scenario) => scenario.promotion_performed === false), "objective audit owner quality review fixtures must not promote");
assert(objectiveAudit.owner_quality_review_fixtures.data_lp_events_write_performed === false, "objective audit owner quality review fixtures must not write data/lp_events.jsonl");
assert(objectiveAudit.owner_quality_review_fixtures.approval_queue_write_performed === false, "objective audit owner quality review fixtures must not write approval queue");
assert(objectiveAudit.owner_quality_review_fixtures.external_effect === false, "objective audit owner quality review fixtures must not claim external effects");
assert(objectiveAudit.candidate_retirement_fixtures.ok === true, "objective audit must include passing candidate retirement fixtures");
assert(objectiveAudit.candidate_retirement_fixtures.mode === "candidate_retirement_fixture_dry_run", "objective audit candidate retirement fixture mode must match");
assert(objectiveAudit.candidate_retirement_fixtures.scenario_count === 6, "objective audit candidate retirement fixture count must match");
assert(objectiveAudit.candidate_retirement_fixtures.scenarios.some((scenario) => scenario.id === "sample_insufficient_keeps_testing" && scenario.target_status === "keep_testing_sample_insufficient"), "objective audit candidate retirement fixtures must include sample-insufficient keep-testing scenario");
assert(objectiveAudit.candidate_retirement_fixtures.scenarios.some((scenario) => scenario.id === "winning_challenger_requires_owner_review" && scenario.target_status === "promotion_review_required"), "objective audit candidate retirement fixtures must include owner promotion review scenario");
assert(objectiveAudit.candidate_retirement_fixtures.scenarios.some((scenario) => scenario.id === "underperforming_challenger_ready_for_local_retirement" && scenario.target_status === "retire_local_candidate_due_underperformance"), "objective audit candidate retirement fixtures must include underperforming retirement scenario");
assert(objectiveAudit.candidate_retirement_fixtures.scenarios.some((scenario) => scenario.id === "quality_regression_ready_for_local_retirement" && scenario.target_status === "retire_local_candidate_due_quality_regression"), "objective audit candidate retirement fixtures must include quality-regression retirement scenario");
assert(objectiveAudit.candidate_retirement_fixtures.current_queue_safety?.ok === true, "objective audit candidate retirement fixtures must verify current queue safety");
assert(objectiveAudit.candidate_retirement_fixtures.real_events_unchanged === true, "objective audit candidate retirement fixtures must leave real events unchanged");
assert(objectiveAudit.candidate_retirement_fixtures.data_lp_events_write_performed === false, "objective audit candidate retirement fixtures must not write data/lp_events.jsonl");
assert(objectiveAudit.candidate_retirement_fixtures.delete_action_performed === false, "objective audit candidate retirement fixtures must not delete data");
assert(objectiveAudit.candidate_retirement_fixtures.external_effect === false, "objective audit candidate retirement fixtures must not claim external effects");
assert(objectiveAudit.iteration_history.ok === true, "objective audit must include passing iteration history");
assert(objectiveAudit.iteration_history.mode === "iteration_history_local_only", "objective audit iteration history mode must match");
assert(objectiveAudit.iteration_history.cadence === "weekly_7_day_iteration", "objective audit iteration history cadence must match");
assert(objectiveAudit.iteration_history.current_changed_variable === nextRoundPlan.current_round.changed_variable, "objective audit iteration history variable must match next-round plan");
assert(objectiveAudit.iteration_history.sample_threshold_met === nextRoundPlan.sample_gate.sample_threshold_met, "objective audit iteration history sample gate must match next-round plan");
assert(objectiveAudit.iteration_history.next_safe_action_count > 0, "objective audit iteration history must include next safe actions");
assert(objectiveAudit.iteration_history.external_effect === false, "objective audit iteration history must not claim external effects");
assert(objectiveAudit.iteration_history.public_link_change_performed === false, "objective audit iteration history must not change public links");
assert(objectiveAudit.iteration_history.production_deploy_performed === false, "objective audit iteration history must not deploy production");
assert(objectiveAudit.iteration_history.github_push_or_pr_performed === false, "objective audit iteration history must not push or create PR");
assert(objectiveAudit.iteration_history.formal_post_performed === false, "objective audit iteration history must not formally post");
assert(objectiveAudit.iteration_history.line_push_performed === false, "objective audit iteration history must not push LINE");
assert(objectiveAudit.iteration_history.customer_data_mutation_performed === false, "objective audit iteration history must not mutate customer data");
assert(objectiveAudit.iteration_history.payment_action_performed === false, "objective audit iteration history must not touch payments");
assert(objectiveAudit.iteration_history.delete_action_performed === false, "objective audit iteration history must not delete data");
assert(objectiveAudit.line_inbound_playbook.ok === true, "objective audit must include passing LINE inbound playbook");
assert(objectiveAudit.line_inbound_playbook.execution_performed === false, "objective audit LINE inbound playbook must not execute");
assert(objectiveAudit.line_inbound_playbook.external_effect === false, "objective audit LINE inbound playbook must not claim external effects");
assert(objectiveAudit.line_inbound_playbook.line_push_performed === false, "objective audit LINE inbound playbook must not push LINE");
assert(objectiveAudit.line_inbound_playbook.customer_data_mutation_performed === false, "objective audit LINE inbound playbook must not mutate customer data");
assert(objectiveAudit.line_inbound_playbook.data_lp_events_write_performed === false, "objective audit LINE inbound playbook must not write data/lp_events.jsonl");
assert(objectiveAudit.owner_gate_evidence.ok === true, "objective audit must include passing owner gate evidence intake");
assert(objectiveAudit.owner_gate_evidence.mode === "owner_gate_evidence_intake", "objective audit owner gate evidence mode must match");
assert(objectiveAudit.owner_gate_evidence.evidence_only === true, "objective audit owner gate evidence must be evidence-only");
assert(objectiveAudit.owner_gate_evidence.issue_count === 0, "objective audit owner gate evidence issue count must be zero");
assert(objectiveAudit.owner_gate_evidence.execution_performed === false, "objective audit owner gate evidence must not execute");
assert(objectiveAudit.owner_gate_evidence.external_effect === false, "objective audit owner gate evidence must not claim external effects");
assert(objectiveAudit.owner_gate_evidence_fixtures.ok === true, "objective audit must include passing owner gate evidence fixtures");
assert(objectiveAudit.owner_gate_evidence_fixtures.mode === "owner_gate_evidence_fixture_dry_run", "objective audit owner gate evidence fixture mode must match");
assert(objectiveAudit.owner_gate_evidence_fixtures.scenario_count >= 9, "objective audit owner gate evidence fixtures must cover scenarios");
assert(objectiveAudit.owner_gate_evidence_fixtures.local_fixture_commands_executed === true, "objective audit owner gate evidence fixtures must execute local fixture commands");
assert(objectiveAudit.owner_gate_evidence_fixtures.execution_performed === false, "objective audit owner gate evidence fixtures must not execute");
assert(objectiveAudit.owner_gate_evidence_fixtures.external_effect === false, "objective audit owner gate evidence fixtures must not claim external effects");
assert(objectiveAudit.post_gate_verification.ok === true, "objective audit must include passing post-gate verification plan");
assert(objectiveAudit.post_gate_verification.mode === "post_gate_verification_plan", "objective audit post-gate mode must match");
assert(objectiveAudit.post_gate_verification.no_network_read_performed === true, "objective audit post-gate plan must not perform network reads");
assert(objectiveAudit.post_gate_verification.no_remote_cli_performed === true, "objective audit post-gate plan must not run remote CLI");
assert(objectiveAudit.post_gate_verification.no_actual_evidence_values_persisted === true, "objective audit post-gate plan must not persist actual evidence values");
assert(objectiveAudit.post_gate_verification.execution_performed === false, "objective audit post-gate plan must not execute");
assert(objectiveAudit.post_gate_verification.external_effect === false, "objective audit post-gate plan must not claim external effects");
assert(objectiveAudit.post_gate_verification_fixtures.ok === true, "objective audit must include passing post-gate verification fixtures");
assert(objectiveAudit.post_gate_verification_fixtures.mode === "post_gate_verification_fixture_dry_run", "objective audit post-gate fixture mode must match");
assert(objectiveAudit.post_gate_verification_fixtures.scenario_count >= 9, "objective audit post-gate fixtures must cover scenarios");
assert(objectiveAudit.post_gate_verification_fixtures.local_fixture_commands_executed === true, "objective audit post-gate fixtures must execute local fixture commands");
assert(objectiveAudit.post_gate_verification_fixtures.post_gate_verification_fixture_executed === true, "objective audit post-gate fixtures must execute post-gate verifier");
assert(objectiveAudit.post_gate_verification_fixtures.execution_performed === false, "objective audit post-gate fixtures must not execute");
assert(objectiveAudit.post_gate_verification_fixtures.external_effect === false, "objective audit post-gate fixtures must not claim external effects");
assert(objectiveAudit.owner_approval_form.ok === true, "objective audit must include passing owner approval form");
assert(objectiveAudit.owner_approval_form.mode === "owner_approval_form", "objective audit owner approval form mode must match");
assert(objectiveAudit.owner_approval_form.form_gate_count === 4, "objective audit owner approval form must expose four metadata gates");
assert(objectiveAudit.owner_approval_form.excluded_manual_gate_count >= 1, "objective audit owner approval form must exclude manual-only gates");
assert(objectiveAudit.owner_approval_form.download_filename === "owner_approval_input.json", "objective audit owner approval form download filename must match");
assert(objectiveAudit.owner_approval_form.browser_only === true, "objective audit owner approval form must be browser-only");
assert(objectiveAudit.owner_approval_form.network_calls_performed === false, "objective audit owner approval form must not perform network calls");
assert(objectiveAudit.owner_approval_form.approval_input_write_performed === false, "objective audit owner approval form must not write live approval input");
assert(objectiveAudit.owner_approval_form.live_input_files_created === false, "objective audit owner approval form must not create live input files");
assert(objectiveAudit.owner_approval_form.external_effect === false, "objective audit owner approval form must not claim external effects");
assert(objectiveAudit.owner_approval_form_fixtures.ok === true, "objective audit must include passing owner approval form fixtures");
assert(objectiveAudit.owner_approval_form_fixtures.mode === "owner_approval_form_fixture_dry_run", "objective audit owner approval form fixture mode must match");
assert(objectiveAudit.owner_approval_form_fixtures.scenario_count === 4, "objective audit owner approval form fixtures must cover four scenarios");
assert(objectiveAudit.owner_approval_form_fixtures.form_export_replay_executed === true, "objective audit owner approval form fixtures must replay form exports");
assert(objectiveAudit.owner_approval_form_fixtures.approval_resume_commands_executed === true, "objective audit owner approval form fixtures must run approval resume commands");
assert(objectiveAudit.owner_approval_form_fixtures.live_input_files_created === false, "objective audit owner approval form fixtures must not create live input files");
assert(objectiveAudit.owner_approval_form_fixtures.approval_input_write_performed === false, "objective audit owner approval form fixtures must not write live approval input");
assert(objectiveAudit.owner_approval_form_fixtures.execution_performed === false, "objective audit owner approval form fixtures must not execute external actions");
assert(objectiveAudit.owner_approval_form_fixtures.external_effect === false, "objective audit owner approval form fixtures must not claim external effects");
assert(objectiveAudit.owner_approval_form_fixtures.scenarios.some((scenario) => scenario.id === "form_export_valid_github_plan_only" && scenario.ready_gate_count === 1 && scenario.github_push_or_pr_performed === false), "objective audit owner approval form fixtures must include plan-only GitHub scenario");
assert(objectiveAudit.owner_approval_form_fixtures.scenarios.some((scenario) => scenario.id === "form_export_placeholder_blocked" && scenario.ready_gate_count === 0), "objective audit owner approval form fixtures must include placeholder block");
assert(objectiveAudit.owner_approval_form_fixtures.scenarios.some((scenario) => scenario.id === "form_export_sensitive_value_blocked" && scenario.ready_gate_count === 0 && scenario.sensitive_approval_detected === true), "objective audit owner approval form fixtures must include sensitive metadata block");
assert(objectiveAudit.github_export_bundle.ok === true, "objective audit must include passing GitHub export bundle");
assert(objectiveAudit.github_export_bundle.mode === "github_export_bundle_local_only", "objective audit GitHub export mode must be local-only");
assert(objectiveAudit.github_export_bundle.file_count === githubExport.file_count, "objective audit GitHub export file count must match status");
assert(objectiveAudit.github_export_bundle.external_effect === false, "objective audit GitHub export must not claim external effects");
assert(objectiveAudit.github_export_bundle.git_init_performed === false, "objective audit GitHub export must not git init");
assert(objectiveAudit.github_export_bundle.git_commit_performed === false, "objective audit GitHub export must not commit");
assert(objectiveAudit.github_export_bundle.github_push_or_pr_performed === false, "objective audit GitHub export must not push or create PR");
assert(objectiveAudit.schedule_catchup.ok === true, "objective audit must include passing schedule catch-up monitor");
assert(objectiveAudit.schedule_catchup.mode === "weekly_schedule_catchup_monitor", "objective audit schedule catch-up mode must match");
assert(objectiveAudit.schedule_catchup.status === scheduleCatchup.status, "objective audit schedule catch-up status must match final schedule catch-up status");
assert(objectiveAudit.schedule_catchup.weekly_runner_status === scheduleCatchup.weekly_runner.status, "objective audit schedule catch-up weekly runner status must match final schedule catch-up status");
assert(objectiveAudit.schedule_catchup.weekly_runner_pending_commands === scheduleCatchup.weekly_runner.pending_commands, "objective audit schedule catch-up pending count must match final schedule catch-up status");
assert(objectiveAudit.schedule_catchup.weekly_runner_invoked === false, "objective audit schedule catch-up must not invoke weekly runner");
assert(objectiveAudit.schedule_catchup.catchup_run_performed === false, "objective audit schedule catch-up must not perform catch-up");
assert(objectiveAudit.schedule_catchup.external_effect === false, "objective audit schedule catch-up must not claim external effects");
assert(objectiveAudit.redline_priority.ok === true, "objective audit must include passing red-line priority");
assert(objectiveAudit.redline_priority.mode === "redline_priority_local_only", "objective audit red-line priority mode must match");
assert(objectiveAudit.redline_priority.redline_queue_covered === true, "objective audit red-line priority must cover blocked queue");
assert(objectiveAudit.redline_priority.no_autorun_for_external_gates === true, "objective audit red-line priority must keep external gates non-autorun");
assert(objectiveAudit.redline_priority.gates_execute_in_order === true, "objective audit red-line priority must preserve gate order");
assert(objectiveAudit.redline_priority.execution_performed === false, "objective audit red-line priority must not execute");
assert(objectiveAudit.redline_priority.external_effect === false, "objective audit red-line priority must not claim external effects");
assert(objectiveAudit.output_status.every((item) => item.present === true), "objective audit output status must be complete");
assert(objectiveAudit.checks.every((item) => item.ok === true), "all objective audit checks must pass");
assert(objectiveAudit.external_effect === false, "objective audit must not claim external effects");
assert(objectiveAudit.public_link_change_performed === false, "objective audit must not claim public link changes");
assert(objectiveAudit.production_deploy_performed === false, "objective audit must not claim production deploy");
assert(objectiveAudit.github_push_or_pr_performed === false, "objective audit must not claim GitHub push or PR");
assert(objectiveAudit.formal_post_performed === false, "objective audit must not claim formal post");
assert(objectiveAudit.line_push_performed === false, "objective audit must not claim LINE push");
assert(objectiveAudit.customer_data_mutation_performed === false, "objective audit must not claim customer data mutation");
assert(objectiveAudit.payment_action_performed === false, "objective audit must not claim payment action");
assert(objectiveAudit.delete_action_performed === false, "objective audit must not claim delete action");
assert(objectiveAuditStatus.ok === true, "objective audit status must be ok");
assert(objectiveAuditStatus.mode === "objective_sequence_audit_status", "objective audit status mode must match");
assert(objectiveAuditStatus.status === objectiveAudit.status, "objective audit status must mirror audit status");
assert(objectiveAuditStatus.check_count === objectiveAudit.checks.length, "objective audit status check count must match audit checks");
assert(objectiveAuditStatus.failed_check_count === 0, "objective audit status must have zero failed checks");
assert(objectiveAuditStatus.sequence_ok === true, "objective audit status sequence must pass");
assert(objectiveAuditStatus.weekly_runner_atomic_lock_ok === true, "objective audit status must include weekly-runner concurrency protection");
assert(objectiveAuditStatus.missing_output_count === 0, "objective audit status must have no missing outputs");
assert(objectiveAuditStatus.launchagent_runtime_ok === true, "objective audit status must expose successful LaunchAgent runtime proof");
assert(objectiveAuditStatus.launchagent_run_count >= 1, "objective audit status must expose at least one LaunchAgent run");
assert(objectiveAuditStatus.launchagent_last_exit_code === 0 || (launchAgentRuntimeProof.proof_kind === "current_run_pending_exit" && objectiveAuditStatus.launchagent_proof_kind === "current_run_pending_exit"), "objective audit must expose exit code 0 or an explicit current-run pending-exit proof inside LaunchAgent");
assert(objectiveAudit.d1_schema_contract.ok === true && objectiveAudit.d1_schema_contract.migration_idempotent === true, "objective audit must include the passing idempotent D1 schema contract");
assert(objectiveAudit.approved_d1_config.mode === "approved_d1_config_preview_local_only" && objectiveAudit.approved_d1_config.local_config_write_performed === false, "objective audit must include the preview-only D1 config guard");
assert(objectiveAudit.champion_github_handoff.ok === true && objectiveAudit.champion_github_handoff.repository === "milk790-code/3q-hatchery-line-oa", "objective audit must include the exact Champion GitHub handoff");
assert(objectiveAudit.champion_github_handoff.draft_required === true && objectiveAudit.champion_github_handoff.merge_permitted === false, "objective audit Champion GitHub handoff must stop at draft PR");
assert(objectiveAuditStatus.d1_schema_contract_ok === true && objectiveAuditStatus.d1_schema_migration_idempotent === true, "objective audit status must include passing D1 schema contract");
assert(objectiveAuditStatus.approved_d1_config_write_performed === false, "objective audit status must confirm no D1 config write");
assert(objectiveAuditStatus.live_telemetry_readiness_ok === true && objectiveAuditStatus.live_telemetry_readiness_status === liveTelemetryReadiness.status, "objective audit status must include live telemetry readiness");
assert(objectiveAuditStatus.live_telemetry_candidate_deployment_observed === true && ["deploy_candidate_worker_security_update", "verify_existing_candidate_deployment"].includes(objectiveAuditStatus.live_telemetry_candidate_operation_mode), "objective audit status must expose the current Candidate security/provenance mode");
assert(objectiveAuditStatus.live_telemetry_candidate_deploy_required === candidateNeedsSecurityUpdate && typeof objectiveAuditStatus.live_telemetry_observed_chain_ready_for_owner_evidence === "boolean", "objective audit status must mirror the current collector deploy/provenance state and readiness");
assert(objectiveAuditStatus.live_telemetry_ingest_readiness_proven === expectedLiveIngestProven && objectiveAuditStatus.live_telemetry_weekly_aggregate_read_authorized === expectedWeeklyAggregateReadAuthorized, "objective audit status must mirror current ingest proof and recurring-read authorization");
assert(objectiveAuditStatus.live_telemetry_fixture_ok === true && objectiveAuditStatus.live_telemetry_fixture_scenario_count === 6, "objective audit status must include all live telemetry fixtures");
assert(objectiveAudit.d1_collection_mode.selected_scope === d1CollectionMode.selected_scope && objectiveAudit.d1_collection_mode.remote_read_performed === d1CollectionMode.remote_read_performed, "objective audit must mirror the current guarded D1 collection mode");
assert(objectiveAudit.d1_collection_mode_fixtures.approved_remote_plan_covered === true, "objective audit must prove the approved recurring aggregate-read plan path");
assert(objectiveAudit.d1_aggregate_export_fixtures.aggregate_sql_covered === true && objectiveAudit.d1_aggregate_export_fixtures.customer_data_read_performed === false, "objective audit must prove aggregate-only D1 SQL without customer-data reads");
assert(objectiveAuditStatus.d1_collection_mode_ok === true, "objective audit status must include D1 collection selector ok");
assert(objectiveAuditStatus.d1_collection_selected_scope === d1CollectionMode.selected_scope, "objective audit status must mirror the selected D1 collection scope");
assert(objectiveAuditStatus.d1_collection_remote_read_authorized === d1CollectionMode.remote_read_authorized && objectiveAuditStatus.d1_collection_remote_read_performed === d1CollectionMode.remote_read_performed, "objective audit status must mirror the guarded remote D1 read state");
assert(objectiveAuditStatus.d1_collection_raw_event_rows_read_performed === false && objectiveAuditStatus.d1_collection_customer_data_read_performed === false, "objective audit status must show no raw or customer-data reads");
assert(objectiveAuditStatus.d1_collection_mode_fixture_ok === true && objectiveAuditStatus.d1_aggregate_export_fixture_ok === true, "objective audit status must include both D1 collection fixture guards");
assert(objectiveAuditStatus.champion_github_handoff_ok === true, "objective audit status must include Champion GitHub handoff ok");
assert(objectiveAuditStatus.champion_github_repository === "milk790-code/3q-hatchery-line-oa", "objective audit status must mirror Champion GitHub repository");
assert(objectiveAuditStatus.champion_github_push_or_pr_performed === false, "objective audit status must confirm no Champion GitHub write");
assert(objectiveAuditStatus.champion_release_preflight_ok === true, "objective audit status must include champion release preflight ok");
assert(objectiveAuditStatus.champion_release_preflight_status === championReleasePreflight.status, "objective audit status must mirror champion release preflight status");
assert(objectiveAuditStatus.champion_release_template_dry_run_ok === true, "objective audit status must include production template dry-run ok");
assert(objectiveAuditStatus.champion_release_rollback_target_version_id === championLiveDeploymentSnapshot.deployed_version.id, "objective audit status rollback target must match live snapshot");
assert(objectiveAuditStatus.owner_approval_form_ok === true, "objective audit status must include owner approval form ok");
assert(objectiveAuditStatus.owner_approval_form_fixture_ok === true, "objective audit status must include owner approval form fixture ok");
assert(objectiveAuditStatus.owner_approval_form_gate_count === 4, "objective audit status owner approval form gate count must match");
assert(objectiveAudit.checks.some((item) => item.id === "sample_gate_collection_sprint_local_only" && item.ok === true), "objective audit checks must include sample gate collection sprint");
assert(objectiveAudit.sample_gate_collection_sprint.ok === true, "objective audit must include collection sprint ok");
assert(objectiveAudit.sample_gate_collection_sprint.status === sampleGateCollectionSprintStatus.status, "objective audit must mirror collection sprint status");
assert(objectiveAudit.sample_gate_collection_sprint.p0_pending_count === sampleGateCollectionSprintStatus.p0_pending_count, "objective audit must mirror collection sprint pending count");
assert(objectiveAudit.sample_gate_collection_sprint.data_lp_events_write_performed === false, "objective audit collection sprint must not write events");
assert(objectiveAudit.sample_gate_collection_sprint.external_effect === false, "objective audit collection sprint must stay local-only");
assert(objectiveAuditStatus.sample_gate_collection_sprint_ok === true, "objective audit status must include collection sprint ok");
assert(objectiveAuditStatus.sample_gate_collection_sprint_status === sampleGateCollectionSprintStatus.status, "objective audit status must mirror collection sprint status");
assert(objectiveAuditStatus.sample_gate_collection_sprint_p0_pending_count === sampleGateCollectionSprintStatus.p0_pending_count, "objective audit status must mirror collection sprint pending count");
assert(objectiveAuditStatus.artifact_retention_ok === true, "objective audit status must include artifact retention ok");
assert(objectiveAuditStatus.artifact_retention_status === artifactRetention.status, "objective audit status must mirror artifact retention status");
assert(objectiveAuditStatus.artifact_retention_cleanup_command_executed === false, "objective audit status must confirm retention cleanup was not executed");
assert(objectiveAudit.checks.some((item) => item.id === "artifact_retention_review_pack_local_only" && item.ok === true), "objective audit checks must include artifact retention review pack");
assert(objectiveAudit.artifact_retention_review_pack.ok === true, "objective audit must include artifact retention review pack ok");
assert(objectiveAudit.artifact_retention_review_pack.status === artifactRetentionReviewStatus.status, "objective audit must mirror artifact retention review status");
assert(objectiveAudit.artifact_retention_review_pack.cleanup_candidate_count === artifactRetentionReviewStatus.cleanup_candidate_count, "objective audit must mirror artifact retention review candidate count");
assert(objectiveAudit.artifact_retention_review_pack.cleanup_command_executed === false, "objective audit must confirm retention review cleanup was not executed");
assert(objectiveAudit.artifact_retention_review_pack.delete_action_performed === false, "objective audit must confirm retention review did not delete");
assert(objectiveAuditStatus.artifact_retention_review_ok === true, "objective audit status must include artifact retention review ok");
assert(objectiveAuditStatus.artifact_retention_review_status === artifactRetentionReviewStatus.status, "objective audit status must mirror artifact retention review status");
assert(objectiveAuditStatus.artifact_retention_review_cleanup_candidate_count === artifactRetentionReviewStatus.cleanup_candidate_count, "objective audit status must mirror retention review candidate count");
assert(objectiveAuditStatus.artifact_retention_review_cleanup_command_executed === false, "objective audit status must confirm retention review cleanup was not executed");
assert(objectiveAuditStatus.artifact_retention_review_delete_action_performed === false, "objective audit status must confirm retention review did not delete");
assert(objectiveAuditStatus.external_effect === false, "objective audit status must not claim external effects");
assert(objectiveAuditStatus.production_deploy_performed === false, "objective audit status must not claim production deploy");
assert(objectiveAuditStatus.github_push_or_pr_performed === false, "objective audit status must not claim GitHub push or PR");
assert(objectiveAuditStatus.formal_post_performed === false, "objective audit status must not claim formal post");
assert(objectiveAuditStatus.line_push_performed === false, "objective audit status must not claim LINE push");
assert(objectiveAuditStatus.customer_data_mutation_performed === false, "objective audit status must not claim customer data mutation");
assert(objectiveAuditStatus.payment_action_performed === false, "objective audit status must not claim payment action");
assert(objectiveAuditStatus.delete_action_performed === false, "objective audit status must not claim delete action");
assert(objectiveAuditMd.includes("objective_contract_ok"), "objective audit markdown must state objective contract ok");
assert(objectiveAuditMd.includes("North Star Funnel Contract"), "objective audit markdown must include North Star funnel contract");
assert(objectiveAuditMd.includes("Funnel Attribution Contract"), "objective audit markdown must include funnel attribution contract");
assert(objectiveAuditMd.includes("Full Funnel Aggregate Preview"), "objective audit markdown must include full-funnel aggregate preview");
assert(objectiveAuditMd.includes("Full Funnel Aggregate Fixtures"), "objective audit markdown must include full-funnel aggregate fixtures");
assert(objectiveAuditMd.includes("Real Data Apply Fixtures"), "objective audit markdown must include real-data apply fixtures");
assert(objectiveAuditMd.includes("Real Data Decision Replay"), "objective audit markdown must include real-data decision replay");
assert(objectiveAuditMd.includes("Artifact Retention Review Pack"), "objective audit markdown must include artifact retention review pack");
assert(objectiveAuditMd.includes("Filesystem mutation performed: no"), "objective audit markdown must state retention review did not mutate files");
assert(objectiveAuditMd.includes("Sample Gate Replay Fixtures"), "objective audit markdown must include sample-gate replay fixtures");
assert(objectiveAuditMd.includes("Source Capture Pack"), "objective audit markdown must include source capture pack");
assert(objectiveAuditMd.includes("Source Capture Compile Preview"), "objective audit markdown must include source capture compile");
assert(objectiveAuditMd.includes("Source Capture Compile Fixtures"), "objective audit markdown must include source capture compile fixtures");
assert(objectiveAuditMd.includes("Data Collection Brief"), "objective audit markdown must include data collection brief");
assert(objectiveAuditMd.includes("Next P0 Owner Form"), "objective audit markdown must include next P0 owner form");
assert(objectiveAuditMd.includes("Next P0 Owner Form Fixtures"), "objective audit markdown must include next P0 owner form fixtures");
assert(objectiveAuditMd.includes("Next P0 Owner Intake"), "objective audit markdown must include next P0 owner intake");
assert(objectiveAuditMd.includes("Next P0 Owner Intake Fixtures"), "objective audit markdown must include next P0 owner intake fixtures");
assert(objectiveAuditMd.includes("Owner Data Preflight"), "objective audit markdown must include owner data preflight");
assert(objectiveAuditMd.includes("Sample Gate Capture Calendar"), "objective audit markdown must include sample-gate capture calendar");
assert(objectiveAuditMd.includes("Week 0 Owner Capture Queue"), "objective audit markdown must include Week 0 owner capture queue");
assert(objectiveAuditMd.includes("Owner Sample Gate Status"), "objective audit markdown must include owner sample gate status");
assert(objectiveAuditMd.includes("Sample Gate Owner Worksheet"), "objective audit markdown must include sample gate owner worksheet");
assert(objectiveAuditMd.includes("Sample Gate Owner Form"), "objective audit markdown must include sample gate owner form");
assert(objectiveAuditMd.includes("Sample Gate Owner Form Fixtures"), "objective audit markdown must include sample gate owner form fixtures");
assert(objectiveAuditMd.includes("Owner Sample Gate Fixtures"), "objective audit markdown must include owner sample gate fixtures");
assert(objectiveAuditMd.includes("Candidate Retirement Fixtures"), "objective audit markdown must include candidate retirement fixtures");
assert(objectiveAuditMd.includes("Iteration History"), "objective audit markdown must include iteration history");
assert(objectiveAuditMd.includes("Owner Gate Evidence Intake"), "objective audit markdown must include owner gate evidence intake");
assert(objectiveAuditMd.includes("Post-Gate Verification Plan"), "objective audit markdown must include post-gate verification plan");
assert(objectiveAuditMd.includes("Post-Gate Verification Fixtures"), "objective audit markdown must include post-gate verification fixtures");
assert(objectiveAuditMd.includes("Owner Approval Form"), "objective audit markdown must include owner approval form");
assert(objectiveAuditMd.includes("Owner Approval Form Fixtures"), "objective audit markdown must include owner approval form fixtures");
assert(objectiveAuditMd.includes("GitHub Export Bundle"), "objective audit markdown must include GitHub export bundle");
assert(objectiveAuditMd.includes("Artifact Retention Monitor"), "objective audit markdown must include artifact retention monitor");
assert(objectiveAuditMd.includes("GitHub Actions Weekly Verify"), "objective audit markdown must include GitHub Actions weekly verify");
assert(objectiveAuditMd.includes("Schedule Catch-Up Monitor"), "objective audit markdown must include schedule catch-up monitor");
assert(objectiveAuditMd.includes("Red-Line Priority Queue"), "objective audit markdown must include red-line priority queue");
assert(objectiveAuditMd.includes("Production deploy performed: no"), "objective audit markdown must state no production deploy");
assert(githubWorkflow.includes("name: 3Q Growth Loop Weekly Verification"), "GitHub workflow must have expected title");
assert(githubWorkflow.includes("workflow_dispatch:"), "GitHub workflow must support manual dispatch");
assert(githubWorkflow.includes('cron: "10 16 * * 6"'), "GitHub workflow must run Sunday 00:10 Taipei via UTC cron");
assert(githubWorkflow.includes("contents: read"), "GitHub workflow must use read-only contents permission");
assert(githubWorkflow.includes("npm run verify"), "GitHub workflow must run verify");
assert(githubWorkflow.includes("actions/upload-artifact@v4"), "GitHub workflow must upload review artifacts");
assert(!/\bwrangler\s+deploy\b/.test(githubWorkflow), "GitHub workflow must not deploy with wrangler");
assert(!/npm run worker:deploy/.test(githubWorkflow), "GitHub workflow must not call worker deploy script");
assert(!/\bgit\s+(push|commit|tag|remote\s+add)\b/.test(githubWorkflow), "GitHub workflow must not perform git writes");
assert(!/gh pr create/.test(githubWorkflow), "GitHub workflow must not create PRs");
assert(!/LINE_CHANNEL|ECPAY|SECRET|TOKEN|PASSWORD/i.test(githubWorkflow), "GitHub workflow must not reference secrets or payment/LINE credentials");
assert(githubWorkflowGuardSource.includes("github_workflow_guard_local_only"), "GitHub workflow guard source must be local-only");
assert(githubWorkflowGuard.ok === true, "GitHub workflow guard must pass");
assert(githubWorkflowGuard.mode === "github_workflow_guard_local_only", "GitHub workflow guard mode must match");
assert(githubWorkflowGuardStatus.ok === true, "GitHub workflow guard compact status must pass");
assert(githubWorkflowGuardStatus.mode === "github_workflow_guard_local_only", "GitHub workflow guard compact mode must match");
assert(githubWorkflowGuard.check_count >= 20, "GitHub workflow guard must run enough checks");
assert(githubWorkflowGuard.failed_check_count === 0, "GitHub workflow guard must have no failed checks");
assert(githubWorkflowGuard.workflow_runs_verify_only === true, "GitHub workflow guard must prove workflow runs verify only");
assert(githubWorkflowGuard.workflow_uses_read_only_permissions === true, "GitHub workflow guard must prove read-only permissions");
assert(githubWorkflowGuard.workflow_uploads_review_artifacts === true, "GitHub workflow guard must prove review artifacts are uploaded");
assert(githubWorkflowGuard.workflow_avoids_macos_launchagent_readback === true, "GitHub workflow guard must keep macOS LaunchAgent readback out of CI");
assert(githubWorkflowGuard.verify_avoids_owner_apply_or_external_gates === true, "GitHub workflow guard must prove verify avoids owner apply/external gates");
assert(githubWorkflowGuard.external_effect === false, "GitHub workflow guard must not claim external effects");
assert(githubWorkflowGuard.github_push_or_pr_performed === false, "GitHub workflow guard must not push or create PR");
assert(githubWorkflowGuard.production_deploy_performed === false, "GitHub workflow guard must not deploy production");
assert(githubWorkflowGuard.public_link_change_performed === false, "GitHub workflow guard must not change public links");
assert(githubWorkflowGuard.formal_post_performed === false, "GitHub workflow guard must not formally post");
assert(githubWorkflowGuard.line_push_performed === false, "GitHub workflow guard must not push LINE");
assert(githubWorkflowGuard.customer_data_mutation_performed === false, "GitHub workflow guard must not mutate customer data");
assert(githubWorkflowGuard.payment_action_performed === false, "GitHub workflow guard must not touch payment");
assert(githubWorkflowGuard.delete_action_performed === false, "GitHub workflow guard must not delete data");
assert(githubWorkflowGuardMd.includes("github_workflow_guard_ok"), "GitHub workflow guard report must state ok");
assert(githubWorkflowGuardMd.includes("Avoids macOS LaunchAgent readback in CI: yes"), "GitHub workflow guard report must state CI avoids macOS readback");
assert(githubWorkflowGuardMd.includes("External effect: no"), "GitHub workflow guard report must state no external effect");
assert(githubHandoff.includes("standalone control-center engine bundle"), "generic GitHub handoff must identify its separate engine-bundle scope");
assert(githubHandoff.includes("use champion_github_handoff.md instead"), "generic GitHub handoff must route the existing 3q-site repository to the exact Champion packet");
assert(githubHandoff.includes("Do not run them until the owner confirms"), "generic GitHub handoff must gate engine push / PR commands");
assert(githubHandoff.includes("gh pr create --draft"), "GitHub handoff must include draft PR command");
assert(githubHandoff.includes("inbound-only LINE customer-service playbook"), "GitHub handoff must mention LINE inbound playbook");
assert(githubHandoff.includes("post-level content attribution"), "GitHub handoff must mention post-level content attribution");
assert(githubExport.ok === true, "GitHub export bundle status must be ok");
assert(githubExport.mode === "github_export_bundle_local_only", "GitHub export bundle mode must be local-only");
assert(Number.isInteger(githubExport.file_count) && githubExport.file_count > 20, "GitHub export bundle must copy repo-ready files");
assert(typeof githubExport.repo_dir === "string" && githubExport.repo_dir.includes(`${path.sep}github_export${path.sep}`), "GitHub export repo dir must live under github_export/");
assert(typeof githubExport.manifest_path === "string" && githubExport.manifest_path.includes(`${path.sep}github_export${path.sep}`), "GitHub export manifest path must live under github_export/");
assert(Array.isArray(githubExport.missing_files) && githubExport.missing_files.length === 0, "GitHub export bundle must not miss files");
assert(Array.isArray(githubExport.excluded_live_or_owner_inputs) && githubExport.excluded_live_or_owner_inputs.includes("data/lp_events.jsonl"), "GitHub export must exclude live lp_events input");
assert(githubExport.excluded_live_or_owner_inputs.includes("data/source_capture/source_capture_ledger.filled.csv"), "GitHub export must exclude owner-filled source capture ledger");
assert(githubExport.excluded_live_or_owner_inputs.includes("data/source_capture/sample_gate_ledger.filled.csv"), "GitHub export must exclude owner-filled sample-gate ledger");
assert(githubExport.excluded_live_or_owner_inputs.includes("owner_approval_input.json"), "GitHub export must exclude owner approval input");
assert(githubExport.excluded_live_or_owner_inputs.includes("owner_gate_evidence.json"), "GitHub export must exclude owner gate evidence input");
assert(githubExport.excluded_live_or_owner_inputs.includes("manual_publish_evidence.json"), "GitHub export must exclude owner manual publish evidence input");
assert(githubExport.external_effect === false, "GitHub export must not claim external effects");
assert(githubExport.git_init_performed === false, "GitHub export must not git init");
assert(githubExport.git_commit_performed === false, "GitHub export must not commit");
assert(githubExport.git_push_or_pr_performed === false, "GitHub export must not push or create PR");
assert(githubExport.github_push_or_pr_performed === false, "GitHub export must not claim GitHub push or PR");
assert(githubExport.production_deploy_performed === false, "GitHub export must not deploy production");
assert(githubExport.public_link_change_performed === false, "GitHub export must not change public links");
assert(githubExport.formal_post_performed === false, "GitHub export must not formally post");
assert(githubExport.line_push_performed === false, "GitHub export must not push LINE");
assert(githubExport.customer_data_mutation_performed === false, "GitHub export must not mutate customer data");
assert(githubExport.payment_action_performed === false, "GitHub export must not touch payments");
assert(githubExport.delete_action_performed === false, "GitHub export must not delete data");
assert(githubExportReport.includes("GitHub Export Bundle Manifest"), "GitHub export report must have title");
assert(githubExportReport.includes("External effect: no"), "GitHub export report must state no external effect");
assert(githubExportReport.includes("Owner-Gated Next Step"), "GitHub export report must gate next step");
const githubExportManifest = JSON.parse(await readFile(githubExport.manifest_path, "utf8"));
assert(githubExportManifest.ok === true, "GitHub export manifest must be ok");
assert(githubExportManifest.file_count === githubExport.file_count, "GitHub export manifest file count must match status");
assert(githubExportManifest.root_sha256 === githubExport.root_sha256, "GitHub export manifest root hash must match status");
assert(Array.isArray(githubExportManifest.files) && githubExportManifest.files.length === githubExport.file_count, "GitHub export manifest files must match count");
assert(githubExportManifest.files.some((file) => file.path === ".github/workflows/3q-growth-loop-weekly.yml"), "GitHub export manifest must include weekly workflow");
assert(artifactRetention.ok === true, "artifact retention status must be ok");
assert(artifactRetention.mode === "artifact_retention_monitor_local_only", "artifact retention mode must be local-only");
assert(["owner_cleanup_review_recommended", "within_review_budget"].includes(artifactRetention.status), "artifact retention status must be a known review state");
assert(typeof artifactRetention.total_human === "string" && artifactRetention.total_human.length > 0, "artifact retention must report total size");
assert(Number.isInteger(artifactRetention.total_bytes) && artifactRetention.total_bytes >= 0, "artifact retention must report total bytes");
assert(Number.isInteger(artifactRetention.warning_count), "artifact retention must report warning count");
assert(Number.isInteger(artifactRetention.cleanup_candidate_count), "artifact retention must report cleanup candidate count");
const artifactRetentionSections = new Map((artifactRetention.sections ?? []).map((section) => [section.id, section]));
for (const expectedRetentionSection of ["github_export_bundles", "archive_snapshots", "logs"]) {
  assert(artifactRetentionSections.has(expectedRetentionSection), `artifact retention missing section ${expectedRetentionSection}`);
}
const retentionTotalFromSections = [...artifactRetentionSections.values()].reduce((sum, section) => sum + section.total_bytes, 0);
assert(retentionTotalFromSections === artifactRetention.total_bytes, "artifact retention total bytes must match sections");
for (const section of artifactRetentionSections.values()) {
  assert(Number.isInteger(section.item_count), `artifact retention section ${section.id} must report item count`);
  assert(Number.isInteger(section.total_bytes), `artifact retention section ${section.id} must report total bytes`);
  assert(section.delete_action_performed === false, `artifact retention section ${section.id} must not delete`);
  assert(section.external_effect === false, `artifact retention section ${section.id} must have no external effect`);
  if (section.item_count > section.thresholds.count_warn) {
    assert((artifactRetention.warnings ?? []).some((warning) => warning.id === `${section.id}_count_over_review_budget`), `artifact retention must warn when ${section.id} count exceeds threshold`);
  }
  if (section.total_bytes > section.thresholds.bytes_warn) {
    assert((artifactRetention.warnings ?? []).some((warning) => warning.id === `${section.id}_bytes_over_review_budget`), `artifact retention must warn when ${section.id} bytes exceed threshold`);
  }
}
assert(Array.isArray(artifactRetention.blocked_actions), "artifact retention must list blocked cleanup actions");
assert(artifactRetention.blocked_actions.includes("delete_github_export_bundles"), "artifact retention must block GitHub export bundle deletion");
assert(artifactRetention.blocked_actions.includes("delete_weekly_archives"), "artifact retention must block archive deletion");
assert(artifactRetention.blocked_actions.includes("delete_logs"), "artifact retention must block log deletion");
assert(artifactRetention.cleanup_command_generated === false, "artifact retention must not generate cleanup commands");
assert(artifactRetention.cleanup_command_executed === false, "artifact retention must not execute cleanup commands");
assert(artifactRetention.external_effect === false, "artifact retention must not claim external effects");
assert(artifactRetention.public_link_change_performed === false, "artifact retention must not change public links");
assert(artifactRetention.production_deploy_performed === false, "artifact retention must not deploy production");
assert(artifactRetention.github_push_or_pr_performed === false, "artifact retention must not push or create PR");
assert(artifactRetention.formal_post_performed === false, "artifact retention must not post");
assert(artifactRetention.line_push_performed === false, "artifact retention must not push LINE");
assert(artifactRetention.customer_data_mutation_performed === false, "artifact retention must not mutate customer data");
assert(artifactRetention.payment_action_performed === false, "artifact retention must not touch payments");
assert(artifactRetention.delete_action_performed === false, "artifact retention must not delete data");
assert(artifactRetentionReport.includes("Artifact Retention Monitor"), "artifact retention report must have title");
assert(artifactRetentionReport.includes("External effect: no"), "artifact retention report must state no external effect");
assert(artifactRetentionReport.includes("Delete action performed: no"), "artifact retention report must state no delete action");
assert(artifactRetentionReport.includes("Cleanup command generated: no"), "artifact retention report must state no cleanup command was generated");
assert(artifactRetentionReport.includes("Cleanup command executed: no"), "artifact retention report must state no cleanup command was executed");
assert(artifactRetentionSource.includes("cleanup_command_executed: false"), "artifact retention source must hard-code no cleanup execution");
assert(!/\brm\s+-rf\b|unlink\(|rmSync\(|remove\(|trash\(/.test(artifactRetentionSource), "artifact retention source must not include deletion primitives");
assert(artifactRetentionReview.ok === true, "artifact retention review pack must be ok");
assert(artifactRetentionReview.mode === "artifact_retention_review_pack_local_only", "artifact retention review pack mode must be local-only");
assert(["owner_review_recommended", "within_review_budget"].includes(artifactRetentionReview.status), "artifact retention review status must be known");
assert(artifactRetentionReview.source_status_path === "data/artifact_retention_status.json", "artifact retention review must read retention status");
assert(artifactRetentionReviewStatus.ok === true, "artifact retention review compact status must be ok");
assert(artifactRetentionReviewStatus.mode === artifactRetentionReview.mode, "artifact retention review compact status mode must match");
assert(artifactRetentionReviewStatus.status === artifactRetentionReview.status, "artifact retention review compact status must match report status");
assert(artifactRetentionReviewStatus.cleanup_candidate_count === artifactRetentionReview.cleanup_candidate_count, "artifact retention review compact status must mirror cleanup candidate count");
assert(artifactRetentionReview.total_bytes === artifactRetention.total_bytes, "artifact retention review total bytes must mirror monitor");
assert(artifactRetentionReview.total_human === artifactRetention.total_human, "artifact retention review total size must mirror monitor");
assert(artifactRetentionReview.source_warning_count === artifactRetention.warning_count, "artifact retention review warning count must mirror monitor");
assert(artifactRetentionReview.cleanup_candidate_count === artifactRetention.cleanup_candidate_count, "artifact retention review cleanup candidate count must mirror monitor");
assert(artifactRetentionReview.section_count === (artifactRetention.sections ?? []).length, "artifact retention review section count must mirror monitor");
assert(artifactRetentionReview.review_required === (artifactRetention.warning_count > 0 || artifactRetention.cleanup_candidate_count > 0), "artifact retention review required flag must match monitor warnings or candidates");
assert(Array.isArray(artifactRetentionReview.sections), "artifact retention review must list sections");
for (const section of artifactRetentionReview.sections) {
  const sourceSection = artifactRetentionSections.get(section.id);
  assert(sourceSection, `artifact retention review section has unknown source ${section.id}`);
  assert(section.cleanup_candidate_count === sourceSection.cleanup_candidate_count, `artifact retention review section ${section.id} must mirror candidate count`);
  assert(section.total_bytes === sourceSection.total_bytes, `artifact retention review section ${section.id} must mirror total bytes`);
  assert(section.manual_review_only === true, `artifact retention review section ${section.id} must be manual review only`);
  assert(section.owner_decision_required === section.review_required, `artifact retention review section ${section.id} owner decision flag must match review flag`);
  assert(section.cleanup_command_generated === false, `artifact retention review section ${section.id} must not generate cleanup commands`);
  assert(section.cleanup_command_executed === false, `artifact retention review section ${section.id} must not execute cleanup commands`);
  assert(section.delete_action_performed === false, `artifact retention review section ${section.id} must not delete`);
  assert(section.external_effect === false, `artifact retention review section ${section.id} must have no external effect`);
}
assert((artifactRetentionReview.next_owner_actions ?? []).length >= 1, "artifact retention review must include next owner actions");
assert((artifactRetentionReview.acceptance_checks_after_owner_cleanup ?? []).includes("npm run artifacts:retention-review"), "artifact retention review must include its acceptance check");
assert(artifactRetentionReview.cleanup_execution_policy === "owner_only_manual_after_review", "artifact retention review cleanup policy must remain owner-only");
assert(artifactRetentionReview.cleanup_command_generated === false, "artifact retention review must not generate cleanup commands");
assert(artifactRetentionReview.cleanup_command_executed === false, "artifact retention review must not execute cleanup commands");
assert(artifactRetentionReview.filesystem_mutation_performed === false, "artifact retention review must not mutate files");
assert(artifactRetentionReview.live_data_touched === false, "artifact retention review must not touch live data");
assert(artifactRetentionReview.external_effect === false, "artifact retention review must not claim external effects");
assert(artifactRetentionReview.public_link_change_performed === false, "artifact retention review must not change public links");
assert(artifactRetentionReview.production_deploy_performed === false, "artifact retention review must not deploy production");
assert(artifactRetentionReview.github_push_or_pr_performed === false, "artifact retention review must not push or create PR");
assert(artifactRetentionReview.formal_post_performed === false, "artifact retention review must not post");
assert(artifactRetentionReview.line_push_performed === false, "artifact retention review must not push LINE");
assert(artifactRetentionReview.customer_data_mutation_performed === false, "artifact retention review must not mutate customer data");
assert(artifactRetentionReview.payment_action_performed === false, "artifact retention review must not touch payments");
assert(artifactRetentionReview.delete_action_performed === false, "artifact retention review must not delete data");
assert(artifactRetentionReviewStatus.cleanup_command_generated === false, "artifact retention review compact status must not generate cleanup commands");
assert(artifactRetentionReviewStatus.cleanup_command_executed === false, "artifact retention review compact status must not execute cleanup commands");
assert(artifactRetentionReviewStatus.filesystem_mutation_performed === false, "artifact retention review compact status must not mutate files");
assert(artifactRetentionReviewStatus.live_data_touched === false, "artifact retention review compact status must not touch live data");
assert(artifactRetentionReviewStatus.external_effect === false, "artifact retention review compact status must not claim external effects");
assert(artifactRetentionReviewStatus.delete_action_performed === false, "artifact retention review compact status must not delete data");
assert(artifactRetentionReviewReport.includes("Artifact Retention Review Pack"), "artifact retention review report must have title");
assert(artifactRetentionReviewReport.includes("Cleanup command generated: no"), "artifact retention review report must state no cleanup command was generated");
assert(artifactRetentionReviewReport.includes("Cleanup command executed: no"), "artifact retention review report must state no cleanup command was executed");
assert(artifactRetentionReviewReport.includes("Filesystem mutation performed: no"), "artifact retention review report must state no filesystem mutation happened");
assert(artifactRetentionReviewReport.includes("Delete action performed: no"), "artifact retention review report must state no delete action");
assert(artifactRetentionReviewSource.includes("cleanup_command_generated: false"), "artifact retention review source must hard-code no cleanup command generation");
assert(artifactRetentionReviewSource.includes("cleanup_command_executed: false"), "artifact retention review source must hard-code no cleanup execution");
assert(artifactRetentionReviewSource.includes("filesystem_mutation_performed: false"), "artifact retention review source must hard-code no filesystem mutation");
assert(!/\brm\s+-rf\b|unlink\(|rmSync\(|remove\(|trash\(/.test(artifactRetentionReviewSource), "artifact retention review source must not include deletion primitives");
for (const expectedExportPath of [
  "artifact_retention.md",
  "data/artifact_retention_status.json",
  "scripts/artifact-retention-monitor.mjs",
  "artifact_retention_review_pack.md",
  "artifact_retention_review_pack.json",
  "data/artifact_retention_review_status.json",
  "scripts/artifact-retention-review-pack.mjs",
  "next_p0_owner_form.html",
  "next_p0_owner_form_fixture_report.md",
  "data/next_p0_owner_form_status.json",
  "data/next_p0_owner_form_fixture_status.json",
  "scripts/next-p0-owner-form.mjs",
  "scripts/next-p0-owner-form-fixtures.mjs",
  "next_p0_quick_capture.md",
  "next_p0_quick_capture_fixture_report.md",
  "data/next_p0_quick_capture_status.json",
  "data/next_p0_quick_capture_fixture_status.json",
  "data/next_p0_quick_capture/next_p0_owner_inputs.quick-template.csv",
  "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
  "data/next_p0_quick_capture/next_p0_owner_inputs.quick-filled.preview.csv",
  "scripts/next-p0-quick-capture.mjs",
  "scripts/next-p0-quick-capture-fixtures.mjs",
  "p0_counts_preflight.md",
  "p0_counts_preflight.json",
  "data/p0_counts_preflight_status.json",
  "p0_counts_preflight_fixture_report.md",
  "data/p0_counts_preflight_fixture_status.json",
  "scripts/p0-counts-preflight.mjs",
  "scripts/p0-counts-preflight-fixtures.mjs",
  "next_p0_owner_intake.md",
  "next_p0_owner_intake_fixture_report.md",
  "data/next_p0_owner_intake_status.json",
  "data/next_p0_owner_intake_fixture_status.json",
  "data/next_p0_owner_intake/funnel_aggregates.owner-preview.csv",
  "data/next_p0_owner_intake/manual_conversions.owner-preview.csv",
  "scripts/next-p0-owner-intake.mjs",
  "scripts/next-p0-owner-intake-fixtures.mjs",
  "owner_data_preflight.md",
  "owner_data_preflight.json",
  "data/owner_data_preflight_status.json",
  "scripts/owner-data-preflight.mjs",
  "sample_gate_capture_calendar.json",
  "sample_gate_capture_calendar.md",
  "sample_gate_capture_calendar.ics",
  "data/sample_gate_capture_calendar_status.json",
  "scripts/sample-gate-capture-calendar.mjs",
  "sample_gate_due_status.json",
  "sample_gate_due_status.md",
  "data/sample_gate_due_status_status.json",
  "sample_gate_due_fixture_report.md",
  "data/sample_gate_due_fixture_status.json",
  "scripts/sample-gate-due-status.mjs",
  "scripts/sample-gate-due-fixtures.mjs",
  "schedule_catchup_status.md",
  "data/schedule_catchup_status.json",
  "scripts/schedule-catchup-status.mjs",
  "github_workflow_guard.md",
  "github_workflow_guard.json",
  "data/github_workflow_guard_status.json",
  "scripts/github-workflow-guard.mjs",
  "redline_priority.md",
  "redline_priority.json",
  "data/redline_priority_status.json",
  "scripts/redline-priority.mjs",
  "owner_quality_review_form.html",
  "owner_quality_review_form_fixture_report.md",
  "data/owner_quality_review_form_status.json",
  "data/owner_quality_review_form_fixture_status.json",
  "scripts/owner-quality-review-form.mjs",
  "scripts/owner-quality-review-form-fixtures.mjs",
  "owner_sample_gate_intake.md",
  "owner_sample_gate_intake_fixture_report.md",
  "data/owner_sample_gate_intake_status.json",
  "data/owner_sample_gate_intake_fixture_status.json",
  "scripts/owner-sample-gate-intake.mjs",
  "scripts/owner-sample-gate-intake-fixtures.mjs",
  "owner_next_action.md",
  "owner_next_action.json",
  "data/owner_next_action_status.json",
  "scripts/owner-next-action.mjs",
  "sample_gate_recovery_pack.md",
  "sample_gate_recovery_pack.json",
  "data/sample_gate_recovery_pack_status.json",
  "scripts/sample-gate-recovery-pack.mjs",
  "owner_sample_count_handoff.md",
  "owner_sample_count_handoff.json",
  "data/owner_sample_count_handoff_status.json",
  "scripts/owner-sample-count-handoff.mjs",
  "owner_p0_now.html",
  "owner_p0_now.md",
  "owner_p0_now.json",
  "data/owner_p0_now_status.json",
  "scripts/owner-p0-now.mjs",
  "owner_p0_launcher.md",
  "OPEN-P0-SAMPLE-GATE.command",
  "data/owner_p0_launcher_status.json",
  "scripts/owner-p0-launcher.mjs",
  "owner_sample_count_recovery.md",
  "owner_sample_count_recovery.json",
  "data/owner_sample_count_recovery_status.json",
  "scripts/owner-sample-count-recovery.mjs",
  "owner_p0_postfill_check.md",
  "owner_p0_postfill_check.json",
  "RUN-P0-POST-FILL-CHECK.command",
  "data/owner_p0_postfill_check_status.json",
  "scripts/owner-p0-postfill-check.mjs",
  "owner_sample_count_recovery_fixture_report.md",
  "data/owner_sample_count_recovery_fixture_status.json",
  "scripts/owner-sample-count-recovery-fixtures.mjs",
  "owner_action_launcher.md",
  "OPEN-3Q-GROWTH-LOOP.command",
  "data/owner_action_launcher_status.json",
  "scripts/owner-action-launcher.mjs",
  "owner_approval_form.html",
  "data/owner_approval_form_status.json",
  "owner_approval_form_fixture_report.md",
  "data/owner_approval_form_fixture_status.json",
  "scripts/owner-approval-form.mjs",
  "scripts/owner-approval-form-fixtures.mjs",
  "manual_publish_packet.md",
  "manual_publish_packet.json",
  "data/manual_publish_packet_status.json",
  "scripts/manual-publish-packet.mjs",
  "manual_publish_capture_plan.md",
  "manual_publish_capture_plan.json",
  "data/manual_publish_capture_plan_status.json",
  "scripts/manual-publish-capture-plan.mjs",
  "manual_publish_brief.md",
  "manual_publish_brief.json",
  "data/manual_publish_brief_status.json",
  "scripts/manual-publish-brief.mjs",
  "public_tracking_url_pack.md",
  "public_tracking_url_pack.json",
  "data/public_tracking_url_pack_status.json",
  "scripts/public-tracking-url-pack.mjs",
  "owner_public_url_approval_preview.md",
  "owner_public_url_approval_preview.json",
  "data/owner_public_url_approval_preview_status.json",
  "scripts/owner-public-url-approval-preview.mjs",
  "manual_publish_evidence.md",
  "manual_publish_evidence.example.json",
  "data/manual_publish_evidence_status.json",
  "manual_publish_evidence_form.html",
  "data/manual_publish_evidence_form_status.json",
  "manual_publish_evidence_form_fixture_report.md",
  "data/manual_publish_evidence_form_fixture_status.json",
  "scripts/manual-publish-evidence-form.mjs",
  "scripts/manual-publish-evidence-form-fixtures.mjs",
  "manual_publish_evidence_fixture_report.md",
  "data/manual_publish_evidence_fixture_status.json",
  "scripts/manual-publish-evidence.mjs",
  "scripts/manual-publish-evidence-fixtures.mjs",
]) {
  assert(githubExportManifest.files.some((file) => file.path === expectedExportPath), `GitHub export manifest missing ${expectedExportPath}`);
}
for (const exportedFile of githubExportManifest.files) {
  assert(typeof exportedFile.path === "string" && exportedFile.path.length > 0, "GitHub export file path must be present");
  assert(typeof exportedFile.sha256 === "string" && exportedFile.sha256.length === 64, `GitHub export file missing sha256: ${exportedFile.path}`);
  assert(Number.isInteger(exportedFile.bytes) && exportedFile.bytes > 0, `GitHub export file must be non-empty: ${exportedFile.path}`);
}
assert(ownerApprovalPack.includes("Do not run the remote, deploy, public link, GitHub push"), "owner approval pack must gate external commands");
assert(ownerApprovalPack.includes("remote_d1_create_and_migrate"), "owner approval pack must include remote D1 gate");
assert(ownerApprovalPack.includes("candidate_worker_production_deploy"), "owner approval pack must include worker deploy gate");
assert(ownerApprovalPack.includes("public_ab_small_traffic_link"), "owner approval pack must include public A/B gate");
assert(ownerApprovalPack.includes("github_repo_branch_pr"), "owner approval pack must include GitHub gate");
assert(ownerApprovalPack.includes("Production deploy performed: no"), "owner approval pack must state no production deploy");
assert(ownerApprovalPack.includes("Worker dry run:"), "owner approval pack must include Worker dry-run evidence");
assert(ownerApprovalPack.includes("worker_dry_run.md"), "owner approval pack must include Worker dry-run report");
assert(ownerApprovalPack.includes("Approval Resume Dry Run"), "owner approval pack must include approval resume dry run");
assert(ownerApprovalPack.includes("npm run post:verify"), "owner approval pack must include post-gate verification command");
assert(ownerApprovalPack.includes("post_gate_verification.md"), "owner approval pack must include post-gate verification artifact");
assert(ownerApprovalPack.includes("Next round plan"), "owner approval pack must include next-round evidence");
assert(ownerApprovalPack.includes("LINE inbound playbook"), "owner approval pack must include LINE inbound evidence");
assert(ownerApprovalPack.includes("Funnel breakdown"), "owner approval pack must include funnel breakdown evidence");
assert(ownerApprovalPack.includes("Full funnel preview events"), "owner approval pack must include full-funnel aggregate evidence");
assert(ownerApprovalPack.includes("Full funnel fixture guard"), "owner approval pack must include full-funnel aggregate fixture guard");
assert(ownerApprovalPack.includes("Real-data apply guard"), "owner approval pack must include real-data apply guard evidence");
assert(ownerApprovalPack.includes("Real-data decision replay"), "owner approval pack must include real-data decision replay evidence");
assert(ownerApprovalPack.includes("Manual publish evidence form"), "owner approval pack must include manual publish evidence form evidence");
assert(ownerApprovalPack.includes("Source Capture Compile Review"), "owner approval pack must include source compile review");
assert(ownerApprovalPack.includes("source_capture_compile_fixture_report.md"), "owner approval pack must include source compile fixture report");
assert(ownerApprovalPack.includes("Data Collection Brief Review"), "owner approval pack must include data collection brief review");
assert(ownerApprovalPack.includes("data_collection_brief.md"), "owner approval pack must include data collection brief artifact");
assert(ownerApprovalPack.includes("next_p0_owner_inputs.md"), "owner approval pack must include next P0 owner inputs artifact");
assert(ownerApprovalPack.includes("Focused Next P0 Form Review"), "owner approval pack must include focused next P0 form review");
assert(ownerApprovalPack.includes("next_p0_owner_form.html"), "owner approval pack must include next P0 owner form artifact");
assert(ownerApprovalPack.includes("next_p0_owner_form_fixture_report.md"), "owner approval pack must include next P0 owner form fixture artifact");
assert(ownerApprovalPack.includes("Focused Next P0 Intake Review"), "owner approval pack must include focused next P0 intake review");
assert(ownerApprovalPack.includes("next_p0_owner_intake.md"), "owner approval pack must include next P0 owner intake artifact");
assert(ownerApprovalPack.includes("next_p0_owner_intake_fixture_report.md"), "owner approval pack must include next P0 owner intake fixture artifact");
assert(ownerApprovalPack.includes("review-owner-console"), "owner approval pack must include owner console review item");
assert(approvalResumePlan.includes("dry-run resume plan"), "approval resume plan must say dry-run");
assert(approvalResumePlan.includes("Execution performed: no"), "approval resume plan must state no execution");
assert(approvalResumePlan.includes("Remote D1 create performed: no"), "approval resume plan must state no remote D1 create");
assert(approvalResumePlan.includes("Sensitive approval detected:"), "approval resume plan must state sensitive approval detection status");
assert(winRuleFixtureReport.includes("sample_insufficient_keeps_champion"), "win-rule fixture report must include sample insufficient scenario");
assert(winRuleFixtureReport.includes("win_rule_queues_human_promotion_only"), "win-rule fixture report must include human promotion queue scenario");
assert(winRuleFixtureReport.includes("lead_rate_regression_blocks_promotion"), "win-rule fixture report must include lead-rate regression scenario");
assert(winRuleFixtureReport.includes("close_rate_regression_blocks_promotion"), "win-rule fixture report must include close-rate regression scenario");
assert(winRuleFixtureReport.includes("regression_reasons"), "win-rule fixture report must include regression reasons");
assert(winRuleFixtureReport.includes("Challenger promotion performed: no"), "win-rule fixture report must state no auto promotion");
assert(decisionReplayReport.includes("real_data_decision_replay_ok"), "real-data decision replay report must state replay ok");
assert(decisionReplayReport.includes("Source capture ledger replay: yes"), "real-data decision replay report must state source-capture ledger replay");
assert(decisionReplayReport.includes("Source capture compile commands executed: yes"), "real-data decision replay report must state source-capture compile commands ran");
assert(decisionReplayReport.includes("sample_insufficient_replay"), "real-data decision replay report must include sample insufficient scenario");
assert(decisionReplayReport.includes("winning_replay_owner_review_only"), "real-data decision replay report must include winner review scenario");
assert(decisionReplayReport.includes("underperform_replay_next_variable"), "real-data decision replay report must include underperform next-variable scenario");
assert(decisionReplayReport.includes("spam_regression_replay"), "real-data decision replay report must include spam regression scenario");
assert(decisionReplayReport.includes("lead_regression_replay"), "real-data decision replay report must include lead regression scenario");
assert(decisionReplayReport.includes("close_regression_replay"), "real-data decision replay report must include close regression scenario");
assert(decisionReplayReport.includes("data/lp_events.jsonl write performed: no"), "real-data decision replay report must state no real event write");
assert(funnelAggregateFixtureReport.includes("funnel_aggregate_fixtures_ok"), "full-funnel aggregate fixture report must state fixtures ok");
assert(funnelAggregateFixtureReport.includes("blocked_unknown_asset"), "full-funnel aggregate fixture report must include unknown-asset block scenario");
assert(funnelAggregateFixtureReport.includes("blocked_missing_content_id"), "full-funnel aggregate fixture report must include missing content_id scenario");
assert(funnelAggregateFixtureReport.includes("blocked_sensitive_column"), "full-funnel aggregate fixture report must include sensitive-column scenario");
assert(funnelAggregateFixtureReport.includes("blocked_sensitive_value"), "full-funnel aggregate fixture report must include sensitive-value scenario");
assert(funnelAggregateFixtureReport.includes("blocked_apply_without_append"), "full-funnel aggregate fixture report must include unsafe apply scenario");
assert(funnelAggregateFixtureReport.includes("data/lp_events.jsonl write performed: no"), "full-funnel aggregate fixture report must state no real event write");
assert(realDataApplyFixtureReport.includes("real_data_apply_fixtures_ok"), "real-data apply fixture report must state fixtures ok");
assert(realDataApplyFixtureReport.includes("funnel_apply_requires_confirm_real_data"), "real-data apply fixture report must include funnel confirmation scenario");
assert(realDataApplyFixtureReport.includes("funnel_copied_example_never_applies"), "real-data apply fixture report must include copied full-funnel example scenario");
assert(realDataApplyFixtureReport.includes("manual_apply_requires_confirm_real_data"), "real-data apply fixture report must include manual confirmation scenario");
assert(realDataApplyFixtureReport.includes("manual_copied_example_never_applies"), "real-data apply fixture report must include copied manual example scenario");
assert(realDataApplyFixtureReport.includes("data/lp_events.jsonl write performed: no"), "real-data apply fixture report must state no real event write");
assert(approvalResumeFixtureReport.includes("approval_resume_fixtures_ok"), "approval resume fixture report must state fixtures ok");
assert(approvalResumeFixtureReport.includes("copied_example_placeholders_block_ready_state"), "approval resume fixture report must include copied-example placeholder scenario");
assert(approvalResumeFixtureReport.includes("sensitive_approval_value_blocks_gate"), "approval resume fixture report must include sensitive-value scenario");
assert(approvalResumeFixtureReport.includes("Execution performed: no"), "approval resume fixture report must state no execution");
assert(lineInboundPlaybookMd.includes("Inbound only: yes"), "LINE inbound playbook must state inbound-only policy");
assert(lineInboundPlaybookMd.includes("Manual Conversion Contract"), "LINE inbound playbook must include manual conversion contract");
assert(lineInboundFixtureReport.includes("line_inbound_fixture_ok"), "LINE inbound fixture report must state fixtures ok");
assert(lineInboundFixtureReport.includes("blocked_phone_column"), "LINE inbound fixture report must include phone-column block scenario");
assert(lineInboundFixtureReport.includes("blocked_chat_message_column"), "LINE inbound fixture report must include chat-message block scenario");
assert(variableRotationReport.includes("All one-variable rotation fixtures pass"), "variable rotation report must state fixtures pass");
assert(variableRotationReport.includes("| hook | ok |"), "variable rotation report must include hook scenario");
assert(variableRotationReport.includes("| offer | ok |"), "variable rotation report must include offer scenario");
assert(variableRotationReport.includes("| visual_claim | ok |"), "variable rotation report must include visual_claim scenario");
assert(variableRotationReport.includes("| cta_text | ok |"), "variable rotation report must include cta_text scenario");
assert(variableRotationReport.includes("Live config write performed: no"), "variable rotation report must state no live config write");
assert(ownerConsoleStatus.ok === true, "owner console status must be ok");
assert(ownerConsoleSmoke.ok === true, "owner console smoke must be ok");
assert(ownerConsoleStatus.external_effect === false, "owner console must not claim external effects");
assert(ownerConsoleStatus.production_deploy_performed === false, "owner console must not claim production deploy");
assert(ownerConsoleStatus.public_link_change_performed === false, "owner console must not claim public link changes");
assert(ownerConsoleStatus.github_push_or_pr_performed === false, "owner console must not claim GitHub push or PR");
assert(ownerConsoleStatus.formal_post_performed === false, "owner console must not claim formal post");
assert(ownerConsoleStatus.line_push_performed === false, "owner console must not claim LINE push");
assert(ownerConsoleStatus.customer_data_mutation_performed === false, "owner console must not mutate customer data");
assert(ownerConsoleStatus.payment_action_performed === false, "owner console must not touch payments");
assert(ownerConsoleStatus.delete_action_performed === false, "owner console must not delete data");
assert(ownerConsoleSmoke.external_effect === false, "owner console smoke must not claim external effects");
assert(ownerConsoleHtml.includes("3Q Growth Loop Owner Console"), "owner console HTML must include title");
assert(ownerConsoleHtml.includes("Approval Queue"), "owner console must include approval queue");
assert(ownerConsoleHtml.includes("Approval queue status"), "owner console must include approval queue compact status");
assert(ownerConsoleHtml.includes("high_risk="), "owner console must include high-risk approval gate count");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/approval_queue_status.json" && source.ok === true), "owner console status must read approval queue compact status");
assert(ownerConsoleHtml.includes("Hard Red Lines"), "owner console must include red lines");
assert(ownerConsoleHtml.includes("weekly_report.md"), "owner console must link weekly report");
assert(ownerConsoleHtml.includes("owner_approval_pack.md"), "owner console must link owner approval pack");
assert(ownerConsoleHtml.includes("Approval form"), "owner console must include owner approval form status");
assert(ownerConsoleHtml.includes("owner_approval_form.html"), "owner console must link owner approval form");
assert(ownerConsoleHtml.includes("Approval form guard"), "owner console must include owner approval form guard");
assert(ownerConsoleHtml.includes("owner_approval_form_fixture_report.md"), "owner console must link owner approval form fixture report");
assert(ownerConsoleHtml.includes("Gate readiness"), "owner console must include gate readiness status");
assert(ownerConsoleHtml.includes("Gate metadata"), "owner console must include gate metadata status");
assert(ownerConsoleHtml.includes("Public A/B metadata"), "owner console must include public A/B metadata status");
assert(ownerConsoleHtml.includes("Public URL approval"), "owner console must include public URL approval status");
assert(ownerConsoleHtml.includes("Owner public URL approval preview"), "owner console must link owner public URL approval preview");
assert(ownerConsoleHtml.includes("owner_public_url_approval_preview.md"), "owner console must link owner public URL approval markdown");
assert(ownerConsoleHtml.includes("owner_public_url_approval_preview.json"), "owner console must link owner public URL approval JSON");
assert(ownerConsoleHtml.includes("public_ab_small_traffic_link"), "owner console must include public A/B gate id");
assert(ownerConsoleHtml.includes("champion_url"), "owner console must expose champion URL metadata need");
assert(ownerConsoleHtml.includes("gate_readiness.md"), "owner console must link gate readiness markdown");
assert(ownerConsoleHtml.includes("Red-line priority"), "owner console must include red-line priority queue");
assert(ownerConsoleHtml.includes("redline_priority.md"), "owner console must link red-line priority report");
assert(ownerConsoleHtml.includes("redline_priority.json"), "owner console must link red-line priority JSON");
assert(ownerConsoleHtml.includes("PreparedButBlocked handoff"), "owner console must include PreparedButBlocked handoff status");
assert(ownerConsoleHtml.includes("prepared_but_blocked.md"), "owner console must link PreparedButBlocked handoff report");
assert(ownerConsoleHtml.includes("data/prepared_but_blocked_report_status.json"), "owner console must link PreparedButBlocked handoff status");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/redline_priority_status.json" && source.ok === true), "owner console status must read red-line priority status");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/prepared_but_blocked_report_status.json" && source.ok === true), "owner console status must read PreparedButBlocked report status");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/owner_public_url_approval_preview_status.json" && source.ok === true), "owner console status must read owner public URL approval preview status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_redline_priority" && check.ok === true), "owner console smoke must check red-line priority queue");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_prepared_but_blocked_report" && check.ok === true), "owner console smoke must check PreparedButBlocked handoff");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_owner_public_url_approval_preview" && check.ok === true), "owner console smoke must check owner public URL approval preview");
assert(ownerConsoleHtml.includes("Gate evidence"), "owner console must include owner gate evidence status");
assert(ownerConsoleHtml.includes("owner_gate_evidence.md"), "owner console must link owner gate evidence markdown");
assert(ownerConsoleHtml.includes("Evidence guard"), "owner console must include owner gate evidence fixture status");
assert(ownerConsoleHtml.includes("owner_gate_evidence_fixture_report.md"), "owner console must link owner gate evidence fixture report");
assert(ownerConsoleHtml.includes("Post-gate verify"), "owner console must include post-gate verification status");
assert(ownerConsoleHtml.includes("post_gate_verification.md"), "owner console must link post-gate verification markdown");
assert(ownerConsoleHtml.includes("Post-gate guard"), "owner console must include post-gate verification fixture guard");
assert(ownerConsoleHtml.includes("post_gate_verification_fixture_report.md"), "owner console must link post-gate verification fixture report");
assert(ownerConsoleHtml.includes("GitHub workflow guard"), "owner console must include GitHub workflow guard status");
assert(ownerConsoleHtml.includes("github_workflow_guard.md"), "owner console must link GitHub workflow guard report");
assert(ownerConsoleHtml.includes("github_workflow_guard.json"), "owner console must link GitHub workflow guard JSON");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/github_workflow_guard_status.json" && source.ok === true), "owner console status must read GitHub workflow guard status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_github_workflow_guard" && check.ok === true), "owner console smoke must check GitHub workflow guard");
assert(ownerConsoleHtml.includes("GitHub bundle"), "owner console must include GitHub export bundle status");
assert(ownerConsoleHtml.includes("github_export_manifest.md"), "owner console must link GitHub export bundle report");
assert(ownerConsoleHtml.includes("Artifact retention"), "owner console must include artifact retention monitor status");
assert(ownerConsoleHtml.includes("artifact_retention.md"), "owner console must link artifact retention report");
assert(ownerConsoleHtml.includes("data/artifact_retention_status.json"), "owner console must link artifact retention JSON");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/artifact_retention_status.json" && source.ok === true), "owner console status must read artifact retention status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_artifact_retention" && check.ok === true), "owner console smoke must check artifact retention monitor");
assert(ownerConsoleHtml.includes("Retention review"), "owner console must include artifact retention review status");
assert(ownerConsoleHtml.includes("artifact_retention_review_pack.md"), "owner console must link artifact retention review report");
assert(ownerConsoleHtml.includes("artifact_retention_review_pack.json"), "owner console must link artifact retention review JSON");
assert(ownerConsoleHtml.includes("data/artifact_retention_review_status.json"), "owner console must link artifact retention review status JSON");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/artifact_retention_review_status.json" && source.ok === true), "owner console status must read artifact retention review status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_artifact_retention_review" && check.ok === true), "owner console smoke must check artifact retention review pack");
assert(ownerConsoleHtml.includes("Approval fixtures"), "owner console must include approval fixtures");
assert(ownerConsoleHtml.includes("LINE inbound"), "owner console must include LINE inbound status");
assert(ownerConsoleHtml.includes("Manual publish packet"), "owner console must include manual publish packet status");
assert(ownerConsoleHtml.includes("manual_publish_packet.md"), "owner console must link manual publish packet markdown");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_manual_publish_packet" && check.ok === true), "owner console smoke must check manual publish packet");
assert(ownerConsoleHtml.includes("Manual capture plan"), "owner console must include manual capture plan status");
assert(ownerConsoleHtml.includes("manual_publish_capture_plan.md"), "owner console must link manual capture plan markdown");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_manual_capture_plan" && check.ok === true), "owner console smoke must check manual capture plan");
assert(ownerConsoleHtml.includes("Manual publish brief"), "owner console must include manual publish brief status");
assert(ownerConsoleHtml.includes("manual_publish_brief.md"), "owner console must link manual publish brief markdown");
assert(ownerConsoleHtml.includes("manual_publish_brief.json"), "owner console must link manual publish brief JSON");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_manual_publish_brief" && check.ok === true), "owner console smoke must check manual publish brief");
assert(ownerConsoleHtml.includes("Public tracking URL pack"), "owner console must include public tracking URL pack status");
assert(ownerConsoleHtml.includes("public_tracking_url_pack.md"), "owner console must link public tracking URL pack markdown");
assert(ownerConsoleHtml.includes("public_tracking_url_pack.json"), "owner console must link public tracking URL pack JSON");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_public_tracking_url_pack" && check.ok === true), "owner console smoke must check public tracking URL pack");
assert(ownerConsoleHtml.includes("Manual publish evidence"), "owner console must include manual publish evidence status");
assert(ownerConsoleHtml.includes("manual_publish_evidence.md"), "owner console must link manual publish evidence markdown");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_manual_publish_evidence" && check.ok === true), "owner console smoke must check manual publish evidence");
assert(ownerConsoleHtml.includes("Manual publish evidence form"), "owner console must include manual publish evidence form status");
assert(ownerConsoleHtml.includes("manual_publish_evidence_form.html"), "owner console must link manual publish evidence form");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_manual_publish_evidence_form" && check.ok === true), "owner console smoke must check manual publish evidence form");
assert(ownerConsoleHtml.includes("Manual publish evidence form guard"), "owner console must include manual publish evidence form fixture status");
assert(ownerConsoleHtml.includes("manual_publish_evidence_form_fixture_report.md"), "owner console must link manual publish evidence form fixture report");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_manual_publish_evidence_form_guard" && check.ok === true), "owner console smoke must check manual publish evidence form guard");
assert(ownerConsoleHtml.includes("Manual publish evidence guard"), "owner console must include manual publish evidence fixture status");
assert(ownerConsoleHtml.includes("manual_publish_evidence_fixture_report.md"), "owner console must link manual publish evidence fixture report");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_manual_publish_evidence_guard" && check.ok === true), "owner console smoke must check manual publish evidence guard");
assert(ownerConsoleHtml.includes("North Star"), "owner console must include North Star funnel status");
assert(ownerConsoleHtml.includes("north_star_funnel.md"), "owner console must link North Star funnel markdown");
assert(ownerConsoleHtml.includes("Funnel breakdown"), "owner console must include funnel breakdown status");
assert(ownerConsoleHtml.includes("funnel_breakdown.md"), "owner console must link funnel breakdown markdown");
assert(ownerConsoleHtml.includes("Tracking smoke"), "owner console must include tracking smoke status");
assert(ownerConsoleHtml.includes("tracking_link_smoke.md"), "owner console must link tracking smoke markdown");
assert(ownerConsoleHtml.includes("Funnel aggregate"), "owner console must include full-funnel aggregate status");
assert(ownerConsoleHtml.includes("Funnel guard"), "owner console must include full-funnel aggregate fixture status");
assert(ownerConsoleHtml.includes("Apply guard"), "owner console must include real-data apply fixture status");
assert(ownerConsoleHtml.includes("Decision replay"), "owner console must include real-data decision replay status");
assert(ownerConsoleHtml.includes("Source capture"), "owner console must include source capture status");
assert(ownerConsoleHtml.includes("source_capture_pack.md"), "owner console must link source capture pack");
assert(ownerConsoleHtml.includes("Sample ledger"), "owner console must include sample-gate ledger status");
assert(ownerConsoleHtml.includes("sample_gate_ledger.md"), "owner console must link sample-gate ledger report");
assert(ownerConsoleHtml.includes("Sample replay"), "owner console must include sample-gate replay status");
assert(ownerConsoleHtml.includes("sample_gate_replay_fixture_report.md"), "owner console must link sample-gate replay report");
assert(ownerConsoleHtml.includes("Source compile"), "owner console must include source compile status");
assert(ownerConsoleHtml.includes("source_capture_compile_report.md"), "owner console must link source compile report");
assert(ownerConsoleHtml.includes("Compile guard"), "owner console must include source compile fixture guard");
assert(ownerConsoleHtml.includes("source_capture_compile_fixture_report.md"), "owner console must link source compile fixture report");
assert(ownerConsoleHtml.includes("Data queue"), "owner console must include data collection queue status");
assert(ownerConsoleHtml.includes("data_collection_brief.md"), "owner console must link data collection brief");
assert(ownerConsoleHtml.includes("data_collection_queue.json"), "owner console must link data collection queue");
assert(ownerConsoleHtml.includes("Data progress"), "owner console must include data collection progress status");
assert(ownerConsoleHtml.includes("data_collection_progress.md"), "owner console must link data collection progress");
assert(ownerConsoleHtml.includes("Next P0 inputs"), "owner console must include next P0 owner inputs status");
assert(ownerConsoleHtml.includes("next_p0_owner_inputs.md"), "owner console must link next P0 owner inputs");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_data_progress" && check.ok === true), "owner console smoke must check data collection progress");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_next_p0_inputs" && check.ok === true), "owner console smoke must check next P0 owner inputs");
assert(ownerConsoleHtml.includes("Next P0 form"), "owner console must include next P0 owner form status");
assert(ownerConsoleHtml.includes("next_p0_owner_form.html"), "owner console must link next P0 owner form");
assert(ownerConsoleHtml.includes("Next P0 form guard"), "owner console must include next P0 owner form fixture status");
assert(ownerConsoleHtml.includes("next_p0_owner_form_fixture_report.md"), "owner console must link next P0 owner form fixture report");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_next_p0_form" && check.ok === true), "owner console smoke must check next P0 owner form");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_next_p0_form_guard" && check.ok === true), "owner console smoke must check next P0 owner form guard");
assert(ownerConsoleHtml.includes("Next P0 quick"), "owner console must include next P0 quick capture status");
assert(ownerConsoleHtml.includes("next_p0_quick_capture.md"), "owner console must link next P0 quick capture report");
assert(ownerConsoleHtml.includes("next_p0_quick_capture_fixture_report.md"), "owner console must link next P0 quick capture fixture report");
assert(ownerConsoleHtml.includes("data/next_p0_quick_capture/next_p0_owner_inputs.quick-template.csv"), "owner console must link next P0 quick capture template");
assert(ownerConsoleHtml.includes("data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt"), "owner console must link next P0 quick capture paste template");
assert(ownerConsoleHtml.includes("filled=") && ownerConsoleHtml.includes("missing=") && ownerConsoleHtml.includes("partial="), "owner console must expose next P0 quick fill progress");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/next_p0_quick_capture_status.json" && source.ok === true), "owner console status must read next P0 quick capture status");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/next_p0_quick_capture_fixture_status.json" && source.ok === true), "owner console status must read next P0 quick capture fixture status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_next_p0_quick" && check.ok === true), "owner console smoke must check next P0 quick capture");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_next_p0_quick_progress" && check.ok === true), "owner console smoke must check next P0 quick fill progress");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_next_p0_quick_guard" && check.ok === true), "owner console smoke must check next P0 quick capture guard");
assert(ownerConsoleHtml.includes("P0 counts preflight"), "owner console must include P0 counts preflight status");
assert(ownerConsoleHtml.includes("p0_counts_preflight.md"), "owner console must link P0 counts preflight report");
assert(ownerConsoleHtml.includes("p0_counts_preflight.json"), "owner console must link P0 counts preflight JSON");
assert(ownerConsoleHtml.includes("p0_counts_preflight_fixture_report.md"), "owner console must link P0 counts preflight fixture report");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/p0_counts_preflight_status.json" && source.ok === true), "owner console status must read P0 counts preflight status");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/p0_counts_preflight_fixture_status.json" && source.ok === true), "owner console status must read P0 counts preflight fixture status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_p0_counts_preflight" && check.ok === true), "owner console smoke must check P0 counts preflight");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_p0_counts_preflight_guard" && check.ok === true), "owner console smoke must check P0 counts preflight guard");
assert(ownerConsoleHtml.includes("Next P0 intake"), "owner console must include next P0 owner intake status");
assert(ownerConsoleHtml.includes("next_p0_owner_intake.md"), "owner console must link next P0 owner intake report");
assert(ownerConsoleHtml.includes("Next P0 intake guard"), "owner console must include next P0 owner intake fixture status");
assert(ownerConsoleHtml.includes("next_p0_owner_intake_fixture_report.md"), "owner console must link next P0 owner intake fixture report");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_next_p0_intake" && check.ok === true), "owner console smoke must check next P0 owner intake");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_next_p0_intake_guard" && check.ok === true), "owner console smoke must check next P0 owner intake guard");
assert(ownerConsoleHtml.includes("Owner data preflight"), "owner console must include owner data preflight status");
assert(ownerConsoleHtml.includes("owner_data_preflight.md"), "owner console must link owner data preflight report");
assert(ownerConsoleHtml.includes("owner_data_preflight.json"), "owner console must link owner data preflight JSON");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/owner_data_preflight_status.json" && source.ok === true), "owner console status must read owner data preflight status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_owner_data_preflight" && check.ok === true), "owner console smoke must check owner data preflight");
assert(ownerConsoleHtml.includes("Capture calendar"), "owner console must include sample-gate capture calendar status");
assert(ownerConsoleHtml.includes("sample_gate_capture_calendar.md"), "owner console must link sample-gate capture calendar");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_sample_gate_capture_calendar" && check.ok === true), "owner console smoke must check sample-gate capture calendar");
assert(ownerConsoleHtml.includes("Due status"), "owner console must include sample-gate due status");
assert(ownerConsoleHtml.includes("sample_gate_due_status.md"), "owner console must link sample-gate due status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_sample_gate_due_status" && check.ok === true), "owner console smoke must check sample-gate due status");
assert(ownerConsoleHtml.includes("Due guard"), "owner console must include sample-gate due fixture guard");
assert(ownerConsoleHtml.includes("sample_gate_due_fixture_report.md"), "owner console must link sample-gate due fixture report");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_sample_gate_due_guard" && check.ok === true), "owner console smoke must check sample-gate due fixture guard");
assert(ownerConsoleHtml.includes("Schedule status"), "owner console must include local schedule status");
assert(ownerConsoleHtml.includes("data/schedule_status.json"), "owner console must link schedule status");
assert(ownerConsoleHtml.includes("Weekly schedule"), "owner console must include weekly schedule data source row");
assert(ownerConsoleHtml.includes("Catch-up status"), "owner console must include schedule catch-up status");
assert(ownerConsoleHtml.includes("schedule_catchup_status.md"), "owner console must link schedule catch-up report");
assert(ownerConsoleHtml.includes("data/schedule_catchup_status.json"), "owner console must link schedule catch-up status");
assert(ownerConsoleHtml.includes("LaunchAgent status"), "owner console must include LaunchAgent status");
assert(ownerConsoleHtml.includes("data/launchagent_status.json"), "owner console must link LaunchAgent status");
assert(ownerConsoleHtml.includes("launchd/com.angelia.3q-growth-loop.weekly.plist"), "owner console must link LaunchAgent plist");
assert(ownerConsoleHtml.includes("successful_run=yes") || (launchAgentRuntimeProof.proof_kind === "current_run_pending_exit" && ownerConsoleHtml.includes("current_launchd_invocation=yes")), "owner console must expose completed or current pending-exit LaunchAgent runtime proof");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/schedule_status.json" && source.ok === true), "owner console status must read schedule status");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/schedule_catchup_status.json" && source.ok === true), "owner console status must read schedule catch-up status");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/launchagent_status.json" && source.ok === true), "owner console status must read LaunchAgent status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_schedule_status" && check.ok === true), "owner console smoke must check local schedule status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_schedule_catchup_status" && check.ok === true), "owner console smoke must check schedule catch-up status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_launchagent_status" && check.ok === true), "owner console smoke must check LaunchAgent status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_launchagent_runtime_proof" && check.ok === true), "owner console smoke must check successful LaunchAgent runtime proof");
assert(ownerConsoleHtml.includes("D1 auto collection") && ownerConsoleHtml.includes("d1_collection_mode.md"), "owner console must expose D1 automatic collection mode");
assert(ownerConsoleHtml.includes("D1 selector guard") && ownerConsoleHtml.includes("D1 aggregate guard"), "owner console must expose D1 selector and aggregate-only guards");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_d1_collection_mode" && check.ok === true), "owner console smoke must check D1 collection mode");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_d1_collection_guards" && check.ok === true), "owner console smoke must check D1 collection guards");
assert(ownerConsoleHtml.includes("Owner capture"), "owner console must include Week 0 owner capture queue status");
assert(ownerConsoleHtml.includes("week0_owner_capture_queue.md"), "owner console must link Week 0 owner capture queue");
assert(ownerConsoleHtml.includes("Owner sample gate"), "owner console must include owner sample gate status");
assert(ownerConsoleHtml.includes("owner_sample_gate_status.md"), "owner console must link owner sample gate report");
assert(ownerConsoleHtml.includes("Sample worksheet"), "owner console must include sample gate owner worksheet");
assert(ownerConsoleHtml.includes("sample_gate_owner_worksheet.md"), "owner console must link sample gate owner worksheet");
assert(ownerConsoleHtml.includes("Sample form"), "owner console must include sample gate owner form");
assert(ownerConsoleHtml.includes("sample_gate_owner_form.html"), "owner console must link sample gate owner form");
assert(ownerConsoleHtml.includes("Sample form guard"), "owner console must include sample gate owner form guard");
assert(ownerConsoleHtml.includes("sample_gate_owner_form_fixture_report.md"), "owner console must link sample gate owner form fixture report");
assert(ownerConsoleHtml.includes("Sample intake"), "owner console must include owner sample-gate intake status");
assert(ownerConsoleHtml.includes("owner_sample_gate_intake.md"), "owner console must link owner sample-gate intake report");
assert(ownerConsoleHtml.includes("Intake guard"), "owner console must include owner sample-gate intake fixture guard");
assert(ownerConsoleHtml.includes("owner_sample_gate_intake_fixture_report.md"), "owner console must link owner sample-gate intake fixture report");
assert(ownerConsoleHtml.includes("Next action"), "owner console must include owner next-action status");
assert(ownerConsoleHtml.includes("owner_next_action.md"), "owner console must link owner next-action report");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_owner_next_action" && check.ok === true), "owner console smoke must check owner next-action card");
assert(ownerConsoleHtml.includes("Recovery pack"), "owner console must include sample gate recovery status");
assert(ownerConsoleHtml.includes("sample_gate_recovery_pack.md"), "owner console must link sample gate recovery report");
assert(ownerConsoleHtml.includes("sample_gate_recovery_pack.json"), "owner console must link sample gate recovery JSON");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/sample_gate_recovery_pack_status.json" && source.ok === true), "owner console status must read sample gate recovery status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_sample_gate_recovery" && check.ok === true), "owner console smoke must check sample gate recovery pack");
assert(ownerConsoleHtml.includes("Outcome preflight"), "owner console must include North Star outcome preflight status");
assert(ownerConsoleHtml.includes("north_star_outcome_preflight.md"), "owner console must link North Star outcome preflight report");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/north_star_outcome_preflight_status.json" && source.ok === true), "owner console status must read North Star outcome preflight status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_north_star_outcome_preflight" && check.ok === true), "owner console smoke must check North Star outcome preflight");
assert(ownerConsoleHtml.includes("Outcome form"), "owner console must include North Star outcome form status");
assert(ownerConsoleHtml.includes("north_star_outcome_form.html"), "owner console must link North Star outcome form");
assert(ownerConsoleHtml.includes("Outcome form guard"), "owner console must include North Star outcome form guard status");
assert(ownerConsoleHtml.includes("north_star_outcome_form_fixture_report.md"), "owner console must link North Star outcome form fixture report");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/north_star_outcome_form_status.json" && source.ok === true), "owner console status must read North Star outcome form status");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/north_star_outcome_form_fixture_status.json" && source.ok === true), "owner console status must read North Star outcome form fixture status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_north_star_outcome_form" && check.ok === true), "owner console smoke must check North Star outcome form");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_north_star_outcome_form_guard" && check.ok === true), "owner console smoke must check North Star outcome form guard");
assert(ownerConsoleHtml.includes("P1 outcome intake"), "owner console must include P1 outcome intake status");
assert(ownerConsoleHtml.includes("owner_p1_outcome_intake.md"), "owner console must link P1 outcome intake report");
assert(ownerConsoleHtml.includes("owner_p1_outcome_intake.json"), "owner console must link P1 outcome intake JSON");
assert(ownerConsoleHtml.includes("P1 intake guard"), "owner console must include P1 outcome intake fixture guard");
assert(ownerConsoleHtml.includes("owner_p1_outcome_intake_fixture_report.md"), "owner console must link P1 outcome intake fixture report");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/owner_p1_outcome_intake_status.json" && source.ok === true), "owner console status must read P1 outcome intake status");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/owner_p1_outcome_intake_fixture_status.json" && source.ok === true), "owner console status must read P1 outcome intake fixture status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_p1_outcome_intake" && check.ok === true), "owner console smoke must check P1 outcome intake");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_p1_outcome_intake_guard" && check.ok === true), "owner console smoke must check P1 outcome intake fixture guard");
assert(ownerConsoleHtml.includes("P1 outcome post-fill"), "owner console must include P1 outcome post-fill status");
assert(ownerConsoleHtml.includes("owner_p1_outcome_postfill_check.md"), "owner console must link P1 outcome post-fill report");
assert(ownerConsoleHtml.includes("owner_p1_outcome_postfill_check.json"), "owner console must link P1 outcome post-fill JSON");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/owner_p1_outcome_postfill_check_status.json" && source.ok === true), "owner console status must read P1 outcome post-fill status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_p1_outcome_postfill_check" && check.ok === true), "owner console smoke must check P1 outcome post-fill");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_p1_outcome_postfill_source_trust" && check.ok === true), "owner console smoke must check P1 outcome post-fill source trust state");
assert(ownerConsoleHtml.includes("P0 batch handoff"), "owner console must include sample gate batch handoff status");
assert(ownerConsoleHtml.includes("sample_gate_batch_handoff.md"), "owner console must link sample gate batch handoff report");
assert(ownerConsoleHtml.includes("sample_gate_batch_1_paste_block.txt"), "owner console must link sample gate batch 1 paste block");
assert(ownerConsoleHtml.includes("sample_gate_batch_2_paste_block.txt"), "owner console must link sample gate batch 2 paste block");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/sample_gate_batch_handoff_status.json" && source.ok === true), "owner console status must read sample gate batch handoff status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_sample_gate_batch_handoff" && check.ok === true), "owner console smoke must check sample gate batch handoff");
assert(ownerConsoleHtml.includes("P0 batch preflight"), "owner console must include sample gate batch preflight status");
assert(ownerConsoleHtml.includes("sample_gate_batch_preflight.md"), "owner console must link sample gate batch preflight report");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/sample_gate_batch_preflight_status.json" && source.ok === true), "owner console status must read sample gate batch preflight status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_sample_gate_batch_preflight" && check.ok === true), "owner console smoke must check sample gate batch preflight");
assert(ownerConsoleHtml.includes("Count handoff"), "owner console must include sample count handoff status");
assert(ownerConsoleHtml.includes("full_p0="), "owner console must include full P0 sample count handoff coverage");
assert(ownerConsoleHtml.includes("owner_sample_count_handoff.md"), "owner console must link sample count handoff report");
assert(ownerConsoleHtml.includes("owner_sample_count_paste_block.txt"), "owner console must link sample count paste block file");
assert(ownerConsoleHtml.includes("owner_sample_count_handoff.json"), "owner console must link sample count handoff JSON");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/owner_sample_count_handoff_status.json" && source.ok === true), "owner console status must read sample count handoff status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_sample_count_handoff" && check.ok === true), "owner console smoke must check sample count handoff");
assert(ownerConsoleHtml.includes("P0 now"), "owner console must include owner P0-now status");
assert(ownerConsoleHtml.includes("owner_p0_now.html"), "owner console must link owner P0-now cockpit");
assert(ownerConsoleHtml.includes("owner_p0_now.md"), "owner console must link owner P0-now report");
assert(ownerConsoleHtml.includes("owner_p0_now.json"), "owner console must link owner P0-now JSON");
assert(ownerConsoleHtml.includes("data/owner_p0_now_status.json"), "owner console must link owner P0-now compact status");
assert(ownerConsoleHtml.includes("quick_missing="), "owner console must expose P0-now quick-count missing progress");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/owner_p0_now_status.json" && source.ok === true), "owner console status must read owner P0-now status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_owner_p0_now" && check.ok === true), "owner console smoke must check owner P0-now card");
assert(ownerConsoleHtml.includes("Collection sprint"), "owner console must include sample-gate collection sprint status");
assert(ownerConsoleHtml.includes("sample_gate_collection_sprint.md"), "owner console must link sample-gate collection sprint report");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/sample_gate_collection_sprint_status.json" && source.ok === true), "owner console status must read sample gate collection sprint status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_sample_gate_collection_sprint" && check.ok === true), "owner console smoke must check sample gate collection sprint");
assert(ownerConsoleHtml.includes("P0 launcher"), "owner console must include owner P0 launcher status");
assert(ownerConsoleHtml.includes("owner_p0_launcher.md"), "owner console must link owner P0 launcher report");
assert(ownerConsoleHtml.includes("OPEN-P0-SAMPLE-GATE.command"), "owner console must link owner P0 launcher command");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/owner_p0_launcher_status.json" && source.ok === true), "owner console status must read owner P0 launcher status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_owner_p0_launcher" && check.ok === true), "owner console smoke must check owner P0 launcher");
assert(ownerConsoleHtml.includes("Count recovery"), "owner console must include sample count recovery status");
assert(ownerConsoleHtml.includes("owner_sample_count_recovery.md"), "owner console must link sample count recovery report");
assert(ownerConsoleHtml.includes("owner_sample_count_recovery.json"), "owner console must link sample count recovery JSON");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/owner_sample_count_recovery_status.json" && source.ok === true), "owner console status must read sample count recovery status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_sample_count_recovery" && check.ok === true), "owner console smoke must check sample count recovery");
assert(ownerConsoleHtml.includes("P0 post-fill check"), "owner console must include P0 post-fill check status");
assert(ownerConsoleHtml.includes("owner_p0_postfill_check.md"), "owner console must link P0 post-fill check report");
assert(ownerConsoleHtml.includes("owner_p0_postfill_check.json"), "owner console must link P0 post-fill check JSON");
assert(ownerConsoleHtml.includes("RUN-P0-POST-FILL-CHECK.command"), "owner console must link P0 post-fill check command");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/owner_p0_postfill_check_status.json" && source.ok === true), "owner console status must read P0 post-fill check status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_p0_postfill_check" && check.ok === true), "owner console smoke must check P0 post-fill check");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_p0_postfill_source_trust" && check.ok === true), "owner console smoke must check P0 post-fill source trust state");
assert(ownerConsoleHtml.includes("worker_dry_run.md"), "owner console must link Worker dry-run report");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/worker_dry_run_status.json" && source.ok === true), "owner console status must read Worker dry-run status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_worker_dry_run" && check.ok === true), "owner console smoke must check Worker dry-run proof");
assert(ownerConsoleHtml.includes("cloudflare_d1_readiness.md") && ownerConsoleStatus.source_status.some((source) => source.file === "data/cloudflare_d1_readiness_status.json" && source.ok === true), "owner console must expose D1 metadata readiness");
assert(ownerConsoleHtml.includes("Live telemetry chain") && ownerConsoleHtml.includes("live_telemetry_readiness.md") && ownerConsoleStatus.source_status.some((source) => source.file === "data/live_telemetry_readiness_status.json" && source.ok === true), "owner console must expose live telemetry readiness");
assert(ownerConsoleHtml.includes("Live telemetry guard") && ownerConsoleHtml.includes("live_telemetry_readiness_fixture_report.md") && ownerConsoleStatus.source_status.some((source) => source.file === "data/live_telemetry_readiness_fixture_status.json" && source.ok === true), "owner console must expose live telemetry fixture guard");
assert(ownerConsoleHtml.includes("champion_local_branch.md") && ownerConsoleStatus.source_status.some((source) => source.file === "data/champion_local_branch_status.json" && source.ok === true), "owner console must expose the local Champion commit");
assert(ownerConsoleHtml.includes("champion_release_owner_packet.md") && ownerConsoleStatus.source_status.some((source) => source.file === "data/champion_release_preflight_status.json" && source.ok === true), "owner console must expose Champion release readiness");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_cloudflare_d1_readiness" && check.ok === true), "owner console smoke must check D1 readiness");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_live_telemetry_readiness" && check.ok === true), "owner console smoke must check live telemetry readiness");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_live_telemetry_guard" && check.ok === true), "owner console smoke must check live telemetry guard");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_champion_local_commit" && check.ok === true), "owner console smoke must check Champion local commit");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_champion_release" && check.ok === true), "owner console smoke must check Champion release readiness");
assert(ownerConsoleHtml.includes("Count recovery guard"), "owner console must include sample count recovery fixture status");
assert(ownerConsoleHtml.includes("owner_sample_count_recovery_fixture_report.md"), "owner console must link sample count recovery fixture report");
assert(ownerConsoleStatus.source_status.some((source) => source.file === "data/owner_sample_count_recovery_fixture_status.json" && source.ok === true), "owner console status must read sample count recovery fixture status");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_sample_count_recovery_guard" && check.ok === true), "owner console smoke must check sample count recovery guard");
assert(ownerConsoleHtml.includes("Owner launcher"), "owner console must include owner launcher status");
assert(ownerConsoleHtml.includes("owner_action_launcher.md"), "owner console must link owner launcher report");
assert(ownerConsoleHtml.includes("Open command"), "owner console must include owner launcher command");
assert(ownerConsoleHtml.includes("OPEN-3Q-GROWTH-LOOP.command"), "owner console must link owner launcher command");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_owner_launcher" && check.ok === true), "owner console smoke must check owner launcher");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_open_command" && check.ok === true), "owner console smoke must check open command");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_owner_approval_form" && check.ok === true), "owner console smoke must check owner approval form");
assert(ownerConsoleSmoke.checks.some((check) => check.name === "has_owner_approval_form_guard" && check.ok === true), "owner console smoke must check owner approval form guard");
assert(ownerConsoleHtml.includes("Sample gate guard"), "owner console must include owner sample gate fixture guard");
assert(ownerConsoleHtml.includes("owner_sample_gate_fixture_report.md"), "owner console must link owner sample gate fixture report");
assert(ownerConsoleHtml.includes("Quality review"), "owner console must include owner quality review status");
assert(ownerConsoleHtml.includes("owner_quality_review.md"), "owner console must link owner quality review report");
assert(ownerConsoleHtml.includes("Quality form"), "owner console must include owner quality review form status");
assert(ownerConsoleHtml.includes("owner_quality_review_form.html"), "owner console must link owner quality review form");
assert(ownerConsoleHtml.includes("Quality form guard"), "owner console must include owner quality review form fixture guard");
assert(ownerConsoleHtml.includes("owner_quality_review_form_fixture_report.md"), "owner console must link owner quality review form fixture report");
assert(ownerConsoleHtml.includes("Quality guard"), "owner console must include owner quality review fixture guard");
assert(ownerConsoleHtml.includes("owner_quality_review_fixture_report.md"), "owner console must link owner quality review fixture report");
assert(ownerConsoleHtml.includes("Retirement guard"), "owner console must include candidate retirement fixture guard");
assert(ownerConsoleHtml.includes("candidate_retirement_fixture_report.md"), "owner console must link candidate retirement fixture report");
assert(ownerConsoleHtml.includes("sample_gate_collection_plan.md"), "owner console must link sample gate collection plan");
assert(ownerConsoleHtml.includes("Iteration History"), "owner console must include iteration history status");
assert(ownerConsoleHtml.includes("iteration_history.md"), "owner console must link iteration history markdown");
assert(ownerConsoleHtml.includes("data/funnel_aggregates.preview.jsonl"), "owner console must link full-funnel aggregate preview");
assert(ownerConsoleHtml.includes("funnel_aggregate_fixture_report.md"), "owner console must link full-funnel aggregate fixture report");
assert(ownerConsoleHtml.includes("real_data_apply_fixture_report.md"), "owner console must link real-data apply fixture report");
assert(ownerConsoleHtml.includes("real_data_decision_replay_report.md"), "owner console must link real-data decision replay report");
assert(!/<form[\s>]/i.test(ownerConsoleHtml), "owner console must not include forms");
assert(!/\bfetch\s*\(/.test(ownerConsoleHtml), "owner console must not call fetch");
assert(!/sendBeacon|XMLHttpRequest/i.test(ownerConsoleHtml), "owner console must not send beacons or XHR");
assert(!/href=["']https?:\/\//i.test(ownerConsoleHtml), "owner console must not link to external URLs");
assert(nextRoundPlanMd.includes("External send: no"), "next round plan must state no external send");
assert(nextRoundPlanMd.includes("Primary link change: no"), "next round plan must state no primary link change");
assert(nextRoundPlanMd.includes("Champion promotion: no"), "next round plan must state no champion promotion");
assert(weekArchive.ok === true, "week archive status must be ok");
assert(weekArchive.immutable_snapshot === true, "week archive must be immutable snapshot");
assert(weekArchive.external_effect === false, "week archive must not claim external effects");
assert(weekArchive.production_deploy_performed === false, "week archive must not claim production deploy");
assert(weekArchive.public_link_change_performed === false, "week archive must not claim public link changes");
assert(weekArchive.github_push_or_pr_performed === false, "week archive must not claim GitHub push or PR");
assert(weekArchive.formal_post_performed === false, "week archive must not claim formal post");
assert(weekArchive.line_push_performed === false, "week archive must not claim LINE push");
assert(weekArchive.customer_data_mutation_performed === false, "week archive must not mutate customer data");
assert(weekArchive.payment_action_performed === false, "week archive must not touch payments");
assert(weekArchive.delete_action_performed === false, "week archive must not delete data");
assert(Array.isArray(weekArchive.missing_files) && weekArchive.missing_files.length === 0, "week archive must not miss required files");
assert(weekArchive.files_archived >= 20, "week archive must include the core weekly evidence bundle");
assert(weekArchive.archive_dir.includes(`${path.sep}archive${path.sep}`), "week archive dir must live under archive/");
assert(archiveManifest.ok === true, "archive manifest must be ok");
assert(archiveManifest.archive_dir === weekArchive.archive_dir, "archive manifest archive_dir must match status");
assert(archiveManifest.manifest_path === undefined || archiveManifest.manifest_path === weekArchive.manifest_path, "archive manifest path mismatch");
assert(Array.isArray(archiveManifest.files), "archive manifest files must be an array");
assert(archiveManifest.files.length === weekArchive.files_archived, "archive manifest file count must match status");
for (const archivedFile of archiveManifest.files) {
  assert(archivedFile.copied === true, `archive file not copied: ${archivedFile.source}`);
  assert(typeof archivedFile.sha256 === "string" && archivedFile.sha256.length === 64, `archive file missing sha256: ${archivedFile.source}`);
  const expectedEmptyLocalD1Export = archivedFile.source === "data/lp_events.d1-local.jsonl"
    && archivedFile.bytes === 0;
  assert(Number.isInteger(archivedFile.bytes) && (archivedFile.bytes > 0 || expectedEmptyLocalD1Export), `archive file must be non-empty unless it is the verified zero-row local D1 export: ${archivedFile.source}`);
}
const archivedScheduleCatchupFile = archiveManifest.files.find((file) => file.source === "data/schedule_catchup_status.json");
const archivedWeeklyRunnerFile = archiveManifest.files.find((file) => file.source === "data/weekly_runner_status.json");
assert(archivedScheduleCatchupFile, "archive manifest must include schedule catch-up status");
assert(archivedWeeklyRunnerFile, "archive manifest must include weekly runner status");
const archivedScheduleCatchup = JSON.parse(await readFile(archivedScheduleCatchupFile.archive_path, "utf8"));
const archivedWeeklyRunner = JSON.parse(await readFile(archivedWeeklyRunnerFile.archive_path, "utf8"));
assert(archivedWeeklyRunner.ok === weeklyRunnerStatus.ok, "archived weekly runner ok must match final weekly status");
assert(archivedWeeklyRunner.status === weeklyRunnerStatus.status, "archived weekly runner status must match final weekly status");
assert(archivedWeeklyRunner.finished_at === weeklyRunnerStatus.finished_at, "archived weekly runner finished_at must match final weekly status");
assert(archivedScheduleCatchup.status === scheduleCatchup.status, "archived schedule catch-up status must match final schedule catch-up status");
assert(archivedScheduleCatchup.weekly_runner.status === scheduleCatchup.weekly_runner.status, "archived schedule catch-up weekly runner status must match final schedule catch-up status");
assert(archivedScheduleCatchup.weekly_runner.pending_commands === scheduleCatchup.weekly_runner.pending_commands, "archived schedule catch-up pending commands must match final schedule catch-up status");
assert(archivedScheduleCatchup.weekly_runner.status === weeklyRunnerStatus.status, "archived schedule catch-up must snapshot the completed weekly runner status");
assert(archivedScheduleCatchup.weekly_runner.pending_commands === 0, "archived schedule catch-up must snapshot zero pending weekly commands");
for (const expected of [
  "weekly_report.md",
  "growth_scores.json",
  "next_round_plan.json",
  "next_round_plan.md",
  "funnel_breakdown.json",
  "funnel_breakdown.md",
  "north_star_funnel.json",
  "north_star_funnel.md",
  "schedule_catchup_status.md",
  "data/schedule_catchup_status.json",
  "objective_sequence_audit.json",
  "objective_sequence_audit.md",
  "data/objective_sequence_audit_status.json",
  "github_export_manifest.md",
  "data/github_export_status.json",
  "prepared_but_blocked.json",
  "prepared_but_blocked.md",
  "data/prepared_but_blocked_report_status.json",
  "cloudflare_d1_readiness.md",
  "data/cloudflare_d1_readiness_status.json",
  "data/cloudflare_d1_inventory_snapshot.json",
  "live_telemetry_readiness.md",
  "data/live_telemetry_readiness_status.json",
  "data/live_telemetry_observation_snapshot.json",
  "live_telemetry_readiness_fixture_report.md",
  "data/live_telemetry_readiness_fixture_status.json",
  "champion_local_branch.md",
  "data/champion_local_branch_status.json",
  "champion_release_preflight.md",
  "data/champion_release_preflight_status.json",
  "data/champion_live_deployment_snapshot.json",
  "champion_release_owner_packet.md",
  "champion_release_owner_packet.json",
  "owner_sample_count_paste_block.txt",
  "launch_readiness.json",
  "approval_resume_plan.md",
  "owner_approval_form.html",
  "data/owner_approval_form_status.json",
  "owner_approval_form_fixture_report.md",
  "data/owner_approval_form_fixture_status.json",
  "owner_gate_evidence.md",
  "owner_gate_evidence.example.json",
  "data/owner_gate_evidence_status.json",
  "owner_gate_evidence_fixture_report.md",
  "data/owner_gate_evidence_fixture_status.json",
  "post_gate_verification.md",
  "data/post_gate_verification_status.json",
  "post_gate_verification_fixture_report.md",
  "data/post_gate_verification_fixture_status.json",
  "gate_readiness.md",
  "data/gate_readiness_status.json",
  "redline_priority.md",
  "redline_priority.json",
  "data/redline_priority_status.json",
  "candidate_retirement_fixture_report.md",
  "data/candidate_retirement_fixture_status.json",
  "data/win_rule_fixture_status.json",
  "data/real_data_decision_replay_status.json",
  "real_data_decision_replay_report.md",
  "tracking_link_smoke.md",
  "data/tracking_link_smoke_status.json",
  "data/event_contract_smoke_status.json",
  "data/event_input_quality_status.json",
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
    "source_capture_pack.md",
    "data/source_capture_status.json",
    "data/source_capture/source_capture_checklist.json",
    "data/source_capture/source_capture_ledger.fill-template.csv",
    "data/source_capture/sample_gate_ledger.fill-template.csv",
    "sample_gate_ledger.md",
    "data/sample_gate_ledger_status.json",
    "sample_gate_ledger_compile_probe.md",
    "data/sample_gate_ledger_compile_probe_status.json",
    "data/source_capture/sample_gate_compile_probe/funnel_aggregates.owner-preview.csv",
    "data/source_capture/sample_gate_compile_probe/manual_conversions.owner-preview.csv",
    "sample_gate_replay_fixture_report.md",
    "data/sample_gate_replay_fixture_status.json",
    "source_capture_compile_report.md",
    "data/source_capture_compile_status.json",
    "source_capture_compile_fixture_report.md",
    "data/source_capture_compile_fixture_status.json",
    "data/source_capture/compiled/funnel_aggregates.owner-preview.csv",
    "data/source_capture/compiled/manual_conversions.owner-preview.csv",
    "data_collection_queue.json",
    "data_collection_brief.md",
    "data/data_collection_brief_status.json",
    "data_collection_progress.md",
    "data_collection_progress.json",
    "data/data_collection_progress_status.json",
    "next_p0_owner_inputs.md",
    "next_p0_owner_inputs.json",
    "data/next_p0_owner_inputs_status.json",
    "next_p0_owner_form.html",
    "data/next_p0_owner_form_status.json",
    "next_p0_owner_form_fixture_report.md",
    "data/next_p0_owner_form_fixture_status.json",
    "next_p0_quick_capture.md",
    "data/next_p0_quick_capture_status.json",
    "next_p0_quick_capture_fixture_report.md",
    "data/next_p0_quick_capture_fixture_status.json",
    "data/next_p0_quick_capture/next_p0_owner_inputs.quick-template.csv",
    "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
    "data/next_p0_quick_capture/next_p0_owner_inputs.quick-filled.preview.csv",
    "p0_counts_preflight.md",
    "p0_counts_preflight.json",
    "data/p0_counts_preflight_status.json",
    "p0_counts_preflight_fixture_report.md",
    "data/p0_counts_preflight_fixture_status.json",
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
    "sample_gate_due_fixture_report.md",
    "data/sample_gate_due_fixture_status.json",
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
    "owner_sample_gate_intake.md",
    "data/owner_sample_gate_intake_status.json",
	    "owner_sample_gate_intake_fixture_report.md",
	    "data/owner_sample_gate_intake_fixture_status.json",
	    "owner_next_action.md",
	    "owner_next_action.json",
	    "data/owner_next_action_status.json",
      "north_star_outcome_preflight.md",
      "north_star_outcome_preflight.json",
      "data/north_star_outcome_preflight_status.json",
      "north_star_outcome_form.html",
      "data/north_star_outcome_form_status.json",
      "north_star_outcome_form_fixture_report.md",
      "data/north_star_outcome_form_fixture_status.json",
      "owner_p1_outcome_intake.md",
      "owner_p1_outcome_intake.json",
      "data/owner_p1_outcome_intake_status.json",
      "owner_p1_outcome_intake_fixture_report.md",
      "data/owner_p1_outcome_intake_fixture_status.json",
      "owner_p1_outcome_postfill_check.md",
      "owner_p1_outcome_postfill_check.json",
      "RUN-P1-OUTCOME-POST-FILL-CHECK.command",
      "data/owner_p1_outcome_postfill_check_status.json",
  "sample_gate_recovery_pack.md",
  "sample_gate_recovery_pack.json",
  "data/sample_gate_recovery_pack_status.json",
  "sample_gate_batch_handoff.md",
  "sample_gate_batch_handoff.json",
  "data/sample_gate_batch_handoff_status.json",
  "sample_gate_batch_1_paste_block.txt",
  "sample_gate_batch_2_paste_block.txt",
  "owner_sample_count_handoff.md",
	    "owner_sample_count_paste_block.txt",
	    "owner_sample_count_handoff.json",
	    "data/owner_sample_count_handoff_status.json",
	    "owner_p0_launcher.md",
	    "OPEN-P0-SAMPLE-GATE.command",
	    "data/owner_p0_launcher_status.json",
	    "owner_sample_count_recovery.md",
	    "owner_sample_count_recovery.json",
	    "data/owner_sample_count_recovery_status.json",
	    "owner_p0_postfill_check.md",
	    "owner_p0_postfill_check.json",
	    "RUN-P0-POST-FILL-CHECK.command",
	    "data/owner_p0_postfill_check_status.json",
	    "owner_sample_count_recovery_fixture_report.md",
	    "data/owner_sample_count_recovery_fixture_status.json",
	    "owner_action_launcher.md",
    "OPEN-3Q-GROWTH-LOOP.command",
    "data/owner_action_launcher_status.json",
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
    "sample_gate_collection_plan.json",
    "sample_gate_collection_plan.md",
    "data/sample_gate_collection_plan_status.json",
    "iteration_history.json",
    "iteration_history.md",
    "line_inbound_playbook.md",
  "line_inbound_playbook.json",
  "line_inbound_fixture_report.md",
  "data/line_inbound_fixture_status.json",
  "manual_publish_packet.md",
  "manual_publish_packet.json",
  "data/manual_publish_packet_status.json",
  "manual_publish_capture_plan.md",
  "manual_publish_capture_plan.json",
  "data/manual_publish_capture_plan_status.json",
  "manual_publish_brief.md",
  "manual_publish_brief.json",
  "data/manual_publish_brief_status.json",
  "public_tracking_url_pack.md",
  "public_tracking_url_pack.json",
  "data/public_tracking_url_pack_status.json",
  "owner_public_url_approval_preview.md",
  "owner_public_url_approval_preview.json",
  "data/owner_public_url_approval_preview_status.json",
  "manual_publish_evidence.md",
  "manual_publish_evidence.example.json",
  "data/manual_publish_evidence_status.json",
  "manual_publish_evidence_form.html",
  "data/manual_publish_evidence_form_status.json",
  "manual_publish_evidence_form_fixture_report.md",
  "data/manual_publish_evidence_form_fixture_status.json",
  "manual_publish_evidence_fixture_report.md",
  "data/manual_publish_evidence_fixture_status.json",
  "variable_rotation_fixture_report.md",
  "data/variable_rotation_fixture_status.json",
  "win_rule_fixture_report.md",
  "goal_completion_audit.md",
  "data/goal_completion_audit_status.json",
  "data/approval_resume_fixture_status.json",
  "approval_resume_fixture_report.md",
  "github_workflow_guard.md",
  "github_workflow_guard.json",
  "data/github_workflow_guard_status.json",
  "artifact_retention.md",
  "data/artifact_retention_status.json",
  "artifact_retention_review_pack.md",
  "artifact_retention_review_pack.json",
  "data/artifact_retention_review_status.json",
]) {
  assert(archiveManifest.files.some((file) => file.source === expected), `archive manifest missing ${expected}`);
}
assert(report.includes("Week Archive"), "weekly report must include week archive status");
assert(report.includes("Data Collection Brief"), "weekly report must include data collection brief status");
assert(report.includes("Data Collection Progress"), "weekly report must include data collection progress status");
assert(report.includes(`p0_pending=${dataCollectionProgressStatus.p0_pending_count}`), "weekly report must include data collection P0 pending count");
assert(audit.includes("Weekly evidence archive"), "completion audit must include weekly evidence archive");
assert(audit.includes("Data collection brief"), "completion audit must include data collection brief status");
assert(audit.includes("Data collection progress"), "completion audit must include data collection progress status");
assert(audit.includes(`p0_pending=${dataCollectionProgressStatus.p0_pending_count}`), "completion audit must include data collection P0 pending count");
assert(ownerApprovalPack.includes("Week archive"), "owner approval pack must include week archive evidence");
assert(ownerApprovalPack.includes("Data Collection Progress Review"), "owner approval pack must include data collection progress review");
assert(schemaSql.includes("CREATE TABLE IF NOT EXISTS iteration_decisions"), "D1 schema must include iteration decisions table");
assert(schemaSql.includes("next_changed_variable"), "D1 schema must track next changed variable");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked_files: requiredFiles.length,
      checks,
    },
    null,
    2,
  ),
);
