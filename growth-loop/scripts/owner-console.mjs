import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OUTPUT_PATH = path.join(ROOT, "owner_console.html");
const STATUS_PATH = path.join(ROOT, "data", "owner_console_status.json");

const JSON_SOURCES = {
  scores: "growth_scores.json",
  retirementFixtures: "data/candidate_retirement_fixture_status.json",
  ab: "ab_test_status.json",
  approval: "approval_queue.json",
  approvalStatus: "data/approval_queue_status.json",
  blocked: "prepared_but_blocked.json",
  objectiveAudit: "objective_sequence_audit.json",
  goalCompletion: "data/goal_completion_audit_status.json",
  nextRound: "next_round_plan.json",
  iterationHistory: "iteration_history.json",
  funnelBreakdown: "funnel_breakdown.json",
  northStar: "north_star_funnel.json",
  launchReadiness: "launch_readiness.json",
  githubExport: "data/github_export_status.json",
  githubWorkflowGuard: "data/github_workflow_guard_status.json",
  artifactRetention: "data/artifact_retention_status.json",
  artifactRetentionReview: "data/artifact_retention_review_status.json",
  archive: "data/week_archive_status.json",
  runner: "data/weekly_runner_status.json",
  schedule: "data/schedule_status.json",
  launchAgent: "data/launchagent_status.json",
  scheduleCatchup: "data/schedule_catchup_status.json",
  d1Sync: "data/d1_sync_status.json",
  d1CollectionMode: "data/d1_collection_mode_status.json",
  d1CollectionModePlan: "data/d1_collection_mode_plan_status.json",
  d1CollectionModeFixtures: "data/d1_collection_mode_fixture_status.json",
  d1AggregateExportFixtures: "data/d1_aggregate_export_fixture_status.json",
  ownerEvidence: "data/owner_gate_evidence_status.json",
  ownerEvidenceFixtures: "data/owner_gate_evidence_fixture_status.json",
  postGate: "data/post_gate_verification_status.json",
  postGateFixtures: "data/post_gate_verification_fixture_status.json",
  gateReadiness: "data/gate_readiness_status.json",
  redlinePriority: "data/redline_priority_status.json",
  preparedButBlockedReport: "data/prepared_but_blocked_report_status.json",
  approvalFixtures: "data/approval_resume_fixture_status.json",
  ownerApprovalForm: "data/owner_approval_form_status.json",
  ownerApprovalFormFixtures: "data/owner_approval_form_fixture_status.json",
  lineInbound: "data/line_inbound_fixture_status.json",
  manualPublishPacket: "data/manual_publish_packet_status.json",
  manualPublishCapturePlan: "data/manual_publish_capture_plan_status.json",
  manualPublishBrief: "data/manual_publish_brief_status.json",
  publicTrackingUrlPack: "data/public_tracking_url_pack_status.json",
  ownerPublicUrlApprovalPreview: "data/owner_public_url_approval_preview_status.json",
  manualPublishEvidence: "data/manual_publish_evidence_status.json",
  manualPublishEvidenceForm: "data/manual_publish_evidence_form_status.json",
  manualPublishEvidenceFormFixtures: "data/manual_publish_evidence_form_fixture_status.json",
  manualPublishEvidenceFixtures: "data/manual_publish_evidence_fixture_status.json",
  eventInputQuality: "data/event_input_quality_status.json",
  funnelAggregate: "data/funnel_aggregate_status.json",
  funnelAggregateFixtures: "data/funnel_aggregate_fixture_status.json",
  realDataApplyFixtures: "data/real_data_apply_fixture_status.json",
  decisionReplay: "data/real_data_decision_replay_status.json",
  realDataInputPack: "data/real_data_input_pack_status.json",
  sourceReadiness: "data/source_readiness_status.json",
  cloudflareD1Readiness: "data/cloudflare_d1_readiness_status.json",
  liveTelemetryReadiness: "data/live_telemetry_readiness_status.json",
  liveTelemetryReadinessFixtures: "data/live_telemetry_readiness_fixture_status.json",
  d1SchemaContract: "data/d1_schema_contract_status.json",
  approvedD1Config: "data/approved_d1_config_status.json",
  championLocalBranch: "data/champion_local_branch_status.json",
  championReleasePreflight: "data/champion_release_preflight_status.json",
  championGithubHandoff: "data/champion_github_handoff_status.json",
  sourceCapture: "data/source_capture_status.json",
  sourceTrust: "data/source_trust_matrix_status.json",
  sampleGateLedger: "data/sample_gate_ledger_status.json",
  sampleGateReplay: "data/sample_gate_replay_fixture_status.json",
  sourceCompile: "data/source_capture_compile_status.json",
  sourceCompileFixtures: "data/source_capture_compile_fixture_status.json",
  realDataIntake: "data/real_data_intake_status.json",
  dataCollection: "data_collection_queue.json",
  dataCollectionStatus: "data/data_collection_brief_status.json",
  dataCollectionProgress: "data/data_collection_progress_status.json",
  nextP0OwnerInputs: "data/next_p0_owner_inputs_status.json",
  nextP0OwnerForm: "data/next_p0_owner_form_status.json",
  nextP0OwnerFormFixtures: "data/next_p0_owner_form_fixture_status.json",
  nextP0QuickCapture: "data/next_p0_quick_capture_status.json",
  nextP0QuickCaptureFixtures: "data/next_p0_quick_capture_fixture_status.json",
  p0CountsPreflight: "data/p0_counts_preflight_status.json",
  p0CountsPreflightFixtures: "data/p0_counts_preflight_fixture_status.json",
  nextP0OwnerIntake: "data/next_p0_owner_intake_status.json",
  nextP0OwnerIntakeFixtures: "data/next_p0_owner_intake_fixture_status.json",
  ownerDataPreflight: "data/owner_data_preflight_status.json",
  sampleGateCaptureCalendar: "data/sample_gate_capture_calendar_status.json",
  sampleGateDueStatus: "data/sample_gate_due_status_status.json",
  sampleGateDueFixtures: "data/sample_gate_due_fixture_status.json",
  ownerCaptureQueue: "data/week0_owner_capture_queue_status.json",
  ownerSampleGate: "data/owner_sample_gate_status.json",
  sampleGateOwnerWorksheet: "data/sample_gate_owner_worksheet_status.json",
  sampleGateOwnerForm: "data/sample_gate_owner_form_status.json",
  sampleGateOwnerFormFixtures: "data/sample_gate_owner_form_fixture_status.json",
  ownerSampleGateIntake: "data/owner_sample_gate_intake_status.json",
  ownerSampleGateIntakeFixtures: "data/owner_sample_gate_intake_fixture_status.json",
  ownerNextAction: "data/owner_next_action_status.json",
  northStarOutcomePreflight: "data/north_star_outcome_preflight_status.json",
  northStarOutcomeForm: "data/north_star_outcome_form_status.json",
  northStarOutcomeFormFixtures: "data/north_star_outcome_form_fixture_status.json",
  ownerP1OutcomeIntake: "data/owner_p1_outcome_intake_status.json",
  ownerP1OutcomeIntakeFixtures: "data/owner_p1_outcome_intake_fixture_status.json",
  ownerP1OutcomePostfillCheck: "data/owner_p1_outcome_postfill_check_status.json",
  sampleGateRecovery: "data/sample_gate_recovery_pack_status.json",
  sampleGateBatchHandoff: "data/sample_gate_batch_handoff_status.json",
  sampleGateBatchPreflight: "data/sample_gate_batch_preflight_status.json",
  ownerSampleCountHandoff: "data/owner_sample_count_handoff_status.json",
  ownerP0Now: "data/owner_p0_now_status.json",
  sampleGateCollectionSprint: "data/sample_gate_collection_sprint_status.json",
  ownerP0Launcher: "data/owner_p0_launcher_status.json",
  ownerSampleCountRecovery: "data/owner_sample_count_recovery_status.json",
  ownerP0PostfillCheck: "data/owner_p0_postfill_check_status.json",
  ownerSampleCountRecoveryFixtures: "data/owner_sample_count_recovery_fixture_status.json",
  ownerActionLauncher: "data/owner_action_launcher_status.json",
  ownerSampleGateFixtures: "data/owner_sample_gate_fixture_status.json",
  ownerQualityReview: "data/owner_quality_review_status.json",
  ownerQualityReviewForm: "data/owner_quality_review_form_status.json",
  ownerQualityReviewFormFixtures: "data/owner_quality_review_form_fixture_status.json",
  ownerQualityReviewFixtures: "data/owner_quality_review_fixture_status.json",
  sampleGate: "data/sample_gate_collection_plan_status.json",
  manual: "data/manual_conversion_status.json",
  workerDryRun: "data/worker_dry_run_status.json",
  browser: "data/browser_smoke_status.json",
  trackingLinkSmoke: "data/tracking_link_smoke_status.json",
  eventContract: "data/event_contract_smoke_status.json",
  fixtures: "data/win_rule_fixture_status.json",
};

async function main() {
  const generatedAt = new Date();
  const data = {};
  const sourceStatus = [];

  for (const [key, relativePath] of Object.entries(JSON_SOURCES)) {
    try {
      data[key] = await readJson(relativePath);
      sourceStatus.push({ file: relativePath, ok: true });
    } catch (error) {
      data[key] = null;
      sourceStatus.push({ file: relativePath, ok: false, error: error.message });
    }
  }

  const html = renderConsole(data, generatedAt);
  await writeFile(OUTPUT_PATH, html);

  const status = {
    ok: sourceStatus.every((source) => source.ok),
    generated_at: generatedAt.toISOString(),
    output_path: OUTPUT_PATH,
    source_status: sourceStatus,
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    note: "Local owner review console only. It reads local artifacts and writes owner_console.html.",
  };
  await writeJson(STATUS_PATH, status);
  console.log(JSON.stringify(status, null, 2));
}

function renderConsole(data, generatedAt) {
  const scores = data.scores ?? {};
  const retirementFixtures = data.retirementFixtures ?? { scenarios: [] };
  const ab = data.ab ?? {};
  const approval = data.approval ?? { items: [] };
  const approvalStatus = data.approvalStatus ?? {};
  const blocked = data.blocked ?? { items: [] };
  const objectiveAudit = data.objectiveAudit ?? { checks: [], objective_sequence: [] };
  const goalCompletion = data.goalCompletion ?? {};
  const nextRound = data.nextRound ?? {};
  const iterationHistory = data.iterationHistory ?? { archive_summary: {}, next_safe_actions: [], owner_gate_summary: {} };
  const funnelBreakdown = data.funnelBreakdown ?? { rows: [], summary: {} };
  const northStar = data.northStar ?? { totals: {}, summary: {}, sample_gaps: {} };
  const launchReadiness = data.launchReadiness ?? {};
  const githubExport = data.githubExport ?? {};
  const githubWorkflowGuard = data.githubWorkflowGuard ?? {};
  const artifactRetention = data.artifactRetention ?? { sections: [], warnings: [], cleanup_candidates: [] };
  const artifactRetentionReview = data.artifactRetentionReview ?? {};
  const archive = data.archive ?? {};
  const runner = data.runner ?? { commands: [] };
  const schedule = data.schedule ?? {};
  const launchAgent = data.launchAgent ?? {};
  const launchAgentRuntime = launchAgent.launchctl_runtime ?? {};
  const scheduleCatchup = data.scheduleCatchup ?? {};
  const d1Sync = data.d1Sync ?? {};
  const d1CollectionMode = data.d1CollectionMode ?? {};
  const d1CollectionModePlan = data.d1CollectionModePlan ?? {};
  const d1CollectionModeFixtures = data.d1CollectionModeFixtures ?? {};
  const d1AggregateExportFixtures = data.d1AggregateExportFixtures ?? {};
  const sourceTrust = data.sourceTrust ?? {};
  const ownerEvidence = data.ownerEvidence ?? { gates: [] };
  const ownerEvidenceFixtures = data.ownerEvidenceFixtures ?? { scenarios: [] };
  const postGate = data.postGate ?? { gates: [] };
  const postGateFixtures = data.postGateFixtures ?? { scenarios: [] };
  const gateReadiness = data.gateReadiness ?? { gates: [] };
  const redlinePriority = data.redlinePriority ?? {};
  const preparedButBlockedReport = data.preparedButBlockedReport ?? {};
  const gateMetadataActions = gateReadiness.parallel_metadata_actions ?? [];
  const publicAbMetadataAction = gateMetadataActions.find((action) => action.gate_id === "public_ab_small_traffic_link") ?? null;
  const approvalFixtures = data.approvalFixtures ?? { scenarios: [] };
  const ownerApprovalForm = data.ownerApprovalForm ?? {};
  const ownerApprovalFormFixtures = data.ownerApprovalFormFixtures ?? { scenarios: [] };
  const lineInbound = data.lineInbound ?? { scenarios: [] };
  const manualPublishPacket = data.manualPublishPacket ?? {};
  const manualPublishCapturePlan = data.manualPublishCapturePlan ?? {};
  const manualPublishBrief = data.manualPublishBrief ?? {};
  const publicTrackingUrlPack = data.publicTrackingUrlPack ?? {};
  const ownerPublicUrlApprovalPreview = data.ownerPublicUrlApprovalPreview ?? {};
  const manualPublishEvidence = data.manualPublishEvidence ?? {};
  const manualPublishEvidenceForm = data.manualPublishEvidenceForm ?? {};
  const manualPublishEvidenceFormFixtures = data.manualPublishEvidenceFormFixtures ?? { scenarios: [] };
  const manualPublishEvidenceFixtures = data.manualPublishEvidenceFixtures ?? { scenarios: [] };
  const eventInputQuality = data.eventInputQuality ?? {};
  const funnelAggregate = data.funnelAggregate ?? {};
  const funnelAggregateFixtures = data.funnelAggregateFixtures ?? { scenarios: [] };
  const realDataApplyFixtures = data.realDataApplyFixtures ?? { scenarios: [] };
  const decisionReplay = data.decisionReplay ?? { scenarios: [] };
  const realDataInputPack = data.realDataInputPack ?? { templates: [] };
  const sourceReadiness = data.sourceReadiness ?? { stages: [], sample_progress: {} };
  const cloudflareD1Readiness = data.cloudflareD1Readiness ?? {};
  const liveTelemetryReadiness = data.liveTelemetryReadiness ?? {};
  const liveTelemetryReadinessFixtures = data.liveTelemetryReadinessFixtures ?? { scenarios: [] };
  const d1SchemaContract = data.d1SchemaContract ?? {};
  const approvedD1Config = data.approvedD1Config ?? {};
  const championLocalBranch = data.championLocalBranch ?? {};
  const championReleasePreflight = data.championReleasePreflight ?? {};
  const championGithubHandoff = data.championGithubHandoff ?? {};
  const sourceCapture = data.sourceCapture ?? {};
  const sampleGateLedger = data.sampleGateLedger ?? {};
  const sampleGateReplay = data.sampleGateReplay ?? { scenarios: [] };
  const sourceCompile = data.sourceCompile ?? {};
  const sourceCompileFixtures = data.sourceCompileFixtures ?? { scenarios: [] };
  const realDataIntake = data.realDataIntake ?? {};
  const dataCollection = data.dataCollection ?? { tasks: [], stage_priorities: [] };
  const dataCollectionStatus = data.dataCollectionStatus ?? {};
  const dataCollectionProgress = data.dataCollectionProgress ?? {};
  const nextP0OwnerInputs = data.nextP0OwnerInputs ?? {};
  const nextP0OwnerForm = data.nextP0OwnerForm ?? {};
  const nextP0OwnerFormFixtures = data.nextP0OwnerFormFixtures ?? { scenarios: [] };
  const nextP0QuickCapture = data.nextP0QuickCapture ?? {};
  const nextP0QuickCaptureFixtures = data.nextP0QuickCaptureFixtures ?? { scenarios: [] };
  const p0CountsPreflight = data.p0CountsPreflight ?? {};
  const p0CountsPreflightFixtures = data.p0CountsPreflightFixtures ?? { scenarios: [] };
  const nextP0OwnerIntake = data.nextP0OwnerIntake ?? {};
  const nextP0OwnerIntakeFixtures = data.nextP0OwnerIntakeFixtures ?? { scenarios: [] };
  const ownerDataPreflight = data.ownerDataPreflight ?? {};
  const sampleGateCaptureCalendar = data.sampleGateCaptureCalendar ?? {};
  const sampleGateDueStatus = data.sampleGateDueStatus ?? {};
  const sampleGateDueFixtures = data.sampleGateDueFixtures ?? { scenarios: [] };
  const ownerCaptureQueue = data.ownerCaptureQueue ?? {};
  const ownerSampleGate = data.ownerSampleGate ?? {};
  const sampleGateOwnerWorksheet = data.sampleGateOwnerWorksheet ?? {};
  const sampleGateOwnerForm = data.sampleGateOwnerForm ?? {};
  const sampleGateOwnerFormFixtures = data.sampleGateOwnerFormFixtures ?? { scenarios: [] };
  const ownerSampleGateIntake = data.ownerSampleGateIntake ?? {};
  const ownerSampleGateIntakeFixtures = data.ownerSampleGateIntakeFixtures ?? { scenarios: [] };
  const ownerNextAction = data.ownerNextAction ?? {};
  const northStarOutcomePreflight = data.northStarOutcomePreflight ?? {};
  const northStarOutcomeForm = data.northStarOutcomeForm ?? {};
  const northStarOutcomeFormFixtures = data.northStarOutcomeFormFixtures ?? { checks: [] };
  const ownerP1OutcomeIntake = data.ownerP1OutcomeIntake ?? {};
  const ownerP1OutcomeIntakeFixtures = data.ownerP1OutcomeIntakeFixtures ?? { scenarios: [] };
  const ownerP1OutcomePostfillCheck = data.ownerP1OutcomePostfillCheck ?? {};
  const sampleGateRecovery = data.sampleGateRecovery ?? {};
  const sampleGateBatchHandoff = data.sampleGateBatchHandoff ?? {};
  const sampleGateBatchPreflight = data.sampleGateBatchPreflight ?? {};
  const ownerSampleCountHandoff = data.ownerSampleCountHandoff ?? {};
  const ownerP0Now = data.ownerP0Now ?? {};
  const sampleGateCollectionSprint = data.sampleGateCollectionSprint ?? {};
  const ownerP0Launcher = data.ownerP0Launcher ?? {};
  const ownerSampleCountRecovery = data.ownerSampleCountRecovery ?? {};
  const ownerP0PostfillCheck = data.ownerP0PostfillCheck ?? {};
  const ownerSampleCountRecoveryFixtures = data.ownerSampleCountRecoveryFixtures ?? { scenarios: [] };
  const ownerActionLauncher = data.ownerActionLauncher ?? {};
  const ownerSampleGateFixtures = data.ownerSampleGateFixtures ?? { scenarios: [] };
  const ownerQualityReview = data.ownerQualityReview ?? {};
  const ownerQualityReviewForm = data.ownerQualityReviewForm ?? {};
  const ownerQualityReviewFormFixtures = data.ownerQualityReviewFormFixtures ?? { scenarios: [] };
  const ownerQualityReviewFixtures = data.ownerQualityReviewFixtures ?? { scenarios: [] };
  const sampleGate = data.sampleGate ?? {};
  const manual = data.manual ?? {};
  const workerDryRun = data.workerDryRun ?? {};
  const browser = data.browser ?? { checks: [] };
  const trackingLinkSmoke = data.trackingLinkSmoke ?? { checks: [] };
  const eventContract = data.eventContract ?? {};
  const fixtures = data.fixtures ?? { scenarios: [] };
  const assets = scores.assets ?? [];
  const champion = assets.find((asset) => asset.role === "champion") ?? {};
  const challenger = assets.find((asset) => asset.role === "challenger") ?? {};
  const approvalItems = approval.items ?? [];
  const pendingHuman = approvalItems.filter((item) => item.status === "pending_human");
  const readyLocal = approvalItems.filter((item) => item.status === "ready_local_review");
  const runnerCommands = runner.commands ?? [];
  const runnerSuccess = runnerCommands.filter((command) => command.status === "success").length;
  const localSchedule = schedule.local_schedule ?? launchAgent.schedule ?? {};
  const browserChecks = browser.checks ?? [];
  const fixtureScenarios = fixtures.scenarios ?? [];
  const funnelFixtureScenarios = funnelAggregateFixtures.scenarios ?? [];
  const realDataApplyScenarios = realDataApplyFixtures.scenarios ?? [];
  const decisionReplayScenarios = decisionReplay.scenarios ?? [];
  const sampleGateReplayScenarios = sampleGateReplay.scenarios ?? [];
  const sampleGateDueFixtureScenarios = sampleGateDueFixtures.scenarios ?? [];
  const approvalFixtureScenarios = approvalFixtures.scenarios ?? [];

  return `<!doctype html>
<html lang="zh-Hant-TW" data-external-effect="false">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>3Q Growth Loop Owner Console</title>
  <style>
    :root {
      --ink: #16201b;
      --muted: #68736d;
      --line: #d9ded8;
      --paper: #f7f8f4;
      --panel: #ffffff;
      --panel-2: #eef2ec;
      --green: #2d6f55;
      --green-soft: #dce9e1;
      --amber: #8a5b16;
      --amber-soft: #f2e5ce;
      --red: #8b2e2e;
      --red-soft: #f2dada;
      --blue: #315f7d;
      --blue-soft: #dce8ef;
      --mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    html { background: var(--paper); color: var(--ink); font-family: var(--sans); }
    body { margin: 0; min-width: 320px; }
    a { color: inherit; text-decoration-thickness: 1px; text-underline-offset: 3px; }
    .shell { max-width: 1440px; margin: 0 auto; padding: 24px; }
    .topbar {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(300px, .8fr);
      gap: 16px;
      align-items: stretch;
      border-bottom: 1px solid var(--line);
      padding-bottom: 18px;
      margin-bottom: 18px;
    }
    .title-block h1 { margin: 0 0 8px; font-size: 30px; line-height: 1.08; letter-spacing: 0; }
    .title-block p { margin: 0; color: var(--muted); font-size: 14px; max-width: 820px; line-height: 1.55; text-wrap: pretty; }
    .stamp {
      border: 1px solid var(--line);
      background: var(--panel);
      padding: 14px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      border-radius: 6px;
    }
    .stamp div { min-width: 0; }
    .label { display: block; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
    .value { display: block; font-family: var(--mono); font-size: 12px; overflow-wrap: anywhere; }
    .grid { display: grid; gap: 14px; }
    .grid.metrics { grid-template-columns: repeat(6, minmax(0, 1fr)); margin-bottom: 14px; }
    .grid.main { grid-template-columns: minmax(0, 1.2fr) minmax(360px, .8fr); align-items: start; }
    .grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .panel {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 6px;
      overflow: hidden;
    }
    .panel header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      background: var(--panel-2);
    }
    .panel h2 { margin: 0; font-size: 14px; letter-spacing: 0; }
    .panel .body { padding: 14px; }
    .metric {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 6px;
      padding: 14px;
      min-height: 104px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 12px;
    }
    .metric .number { font-family: var(--mono); font-size: 28px; line-height: 1; }
    .metric .caption { color: var(--muted); font-size: 12px; line-height: 1.45; }
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 11px;
      font-family: var(--mono);
      white-space: nowrap;
      background: var(--blue-soft);
      color: var(--blue);
      border: 1px solid color-mix(in srgb, var(--blue) 24%, transparent);
    }
    .badge.ok { background: var(--green-soft); color: var(--green); border-color: color-mix(in srgb, var(--green) 24%, transparent); }
    .badge.warn { background: var(--amber-soft); color: var(--amber); border-color: color-mix(in srgb, var(--amber) 24%, transparent); }
    .badge.block { background: var(--red-soft); color: var(--red); border-color: color-mix(in srgb, var(--red) 24%, transparent); }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { padding: 8px 9px; border-bottom: 1px solid var(--line); vertical-align: top; text-align: left; }
    th { color: var(--muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
    td code, .code { font-family: var(--mono); font-size: 11px; overflow-wrap: anywhere; }
    tr:last-child td { border-bottom: 0; }
    .split-list { display: grid; gap: 8px; }
    .row {
      display: grid;
      grid-template-columns: 150px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
      font-size: 12px;
      border-bottom: 1px solid var(--line);
      padding: 8px 0;
    }
    .row:first-child { padding-top: 0; }
    .row:last-child { border-bottom: 0; padding-bottom: 0; }
    .row strong { font-size: 12px; }
    .row span:last-child { color: var(--muted); overflow-wrap: anywhere; }
    .artifact-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .artifact {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 9px;
      background: #fbfcf9;
      font-size: 12px;
      min-height: 48px;
    }
    .artifact span { display: block; color: var(--muted); font-size: 11px; margin-top: 3px; }
    .gate-list { display: grid; gap: 8px; }
    .gate {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px;
      background: #fbfcf9;
    }
    .gate strong { display: block; font-size: 12px; margin-bottom: 5px; }
    .gate p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .foot {
      margin-top: 16px;
      border-top: 1px solid var(--line);
      padding-top: 12px;
      color: var(--muted);
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    @media (max-width: 1020px) {
      .topbar, .grid.main, .grid.two { grid-template-columns: 1fr; }
      .grid.metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .artifact-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 640px) {
      .shell { padding: 14px; }
      .grid.metrics, .artifact-grid, .stamp { grid-template-columns: 1fr; }
      .row { grid-template-columns: 1fr; gap: 3px; }
      th, td { padding: 7px 6px; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="topbar">
      <div class="title-block">
        <h1>3Q Growth Loop Owner Console</h1>
        <p>本地審核台。它只讀取本機產物並集中顯示漏斗、下一輪決策、approval queue、紅線、archive 與 weekly runner 狀態。</p>
      </div>
      <div class="stamp" aria-label="console status">
        ${kv("Generated", generatedAt.toISOString())}
        ${kv("Week", `${scores.week?.start ?? "n/a"} to ${scores.week?.end ?? "n/a"}`)}
        ${kv("Mode", launchReadiness.mode ?? "n/a")}
        ${kv("External effect", "false")}
      </div>
    </section>

    <section class="grid metrics" aria-label="north star metrics">
      ${metric("Real events", String(ab.events_observed ?? 0), "data/lp_events.jsonl scored rows")}
      ${metric("Goal complete", goalCompletion.complete ? "yes" : "no", goalCompletion.status ?? "goal completion audit")}
      ${metric("Funnel preview", String(funnelAggregate.events_written ?? 0), "full-funnel aggregate, not applied")}
      ${metric("Funnel guard", String(funnelAggregateFixtures.scenario_count ?? 0), "aggregate importer fixtures")}
      ${metric("Apply guard", String(realDataApplyFixtures.scenario_count ?? 0), "real-data apply fixtures")}
      ${metric("Decision replay", String(decisionReplay.scenario_count ?? 0), `${decisionReplay.mode ?? "n/a"} / ledger=${decisionReplay.source_capture_ledger_replay_executed ? "yes" : "no"} / compile=${decisionReplay.source_capture_compile_commands_executed ? "yes" : "no"} / data_write=${decisionReplay.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("Input pack", String((realDataInputPack.templates ?? []).length), `${realDataInputPack.status ?? "n/a"} / template-only`)}
      ${metric("Sources", `${(sourceReadiness.stages ?? []).filter((stage) => stage.ready_for_decision).length}/${(sourceReadiness.stages ?? []).length}`, `source readiness: ${sourceReadiness.status ?? "unknown"}`)}
      ${metric("Source capture", String(sourceCapture.ledger_rows ?? 0), `${sourceCapture.status ?? "n/a"} / template-only`)}
      ${metric("Sample ledger", String(sampleGateLedger.row_count ?? sourceCapture.sample_gate_ledger_rows ?? 0), `${sampleGateLedger.status ?? "sample gate ledger"} / links=${sampleGateLedger.link_count ?? 0}`)}
      ${metric("Sample replay", String(sampleGateReplay.scenario_count ?? 0), `${sampleGateReplay.mode ?? "n/a"} / data_write=${sampleGateReplay.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("Source compile", String(sourceCompile.filled_rows ?? 0), `${sourceCompile.status ?? "n/a"} / owner-preview`)}
      ${metric("Compile guard", String(sourceCompileFixtures.scenario_count ?? 0), "source compile fixtures")}
      ${metric("Intake ready", String(realDataIntake.ready_apply_count ?? 0), realDataIntake.status ?? "real-data intake plan")}
      ${metric("Data queue", String(dataCollection.task_count ?? (dataCollection.tasks ?? []).length), dataCollection.status ?? "data collection brief")}
      ${metric("Data progress", `${dataCollectionProgress.filled_task_count ?? 0}/${dataCollectionProgress.total_task_count ?? 0}`, `${dataCollectionProgress.status ?? "n/a"} / P0 pending=${dataCollectionProgress.p0_pending_count ?? 0}`)}
      ${metric("Next P0 inputs", String(nextP0OwnerInputs.current_input_count ?? 0), `${nextP0OwnerInputs.status ?? "n/a"} / source groups=${nextP0OwnerInputs.source_group_count ?? 0}`)}
      ${metric("Next P0 form", String(nextP0OwnerForm.row_count ?? 0), `${nextP0OwnerForm.status ?? "n/a"} / browser=${nextP0OwnerForm.browser_only ? "yes" : "no"} / network=${nextP0OwnerForm.network_calls_performed ? "yes" : "no"}`)}
      ${metric("Next P0 form guard", String(nextP0OwnerFormFixtures.scenario_count ?? 0), `${nextP0OwnerFormFixtures.mode ?? "n/a"} / static=${nextP0OwnerFormFixtures.browser_form_static_checks_executed ? "yes" : "no"} / external=${nextP0OwnerFormFixtures.external_effect ? "yes" : "no"}`)}
      ${metric("Next P0 quick", nextP0QuickCapture.filled_preview_created ? "preview" : nextP0QuickCapture.partial_waiting ? "partial" : "wait", `${nextP0QuickCapture.status ?? "n/a"} / counts=${nextP0QuickCapture.quick_count_count ?? 0}/${nextP0QuickCapture.expected_row_count ?? 0} / filled=${nextP0QuickCapture.filled_rank_count ?? 0}/${nextP0QuickCapture.expected_row_count ?? 0} / missing=${nextP0QuickCapture.missing_rank_count ?? 0} / partial=${nextP0QuickCapture.partial_waiting ? "yes" : "no"} / template=${nextP0QuickCapture.template_created ? "yes" : "no"}`)}
      ${metric("Quick guard", String(nextP0QuickCaptureFixtures.scenario_count ?? 0), `${nextP0QuickCaptureFixtures.mode ?? "n/a"} / inbox=${nextP0QuickCaptureFixtures.owner_inbox_write_performed ? "yes" : "no"} / data_write=${nextP0QuickCaptureFixtures.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("P0 preflight", p0CountsPreflight.ready_for_quick_preview ? "ready" : p0CountsPreflight.filled_count_key_count > 0 ? "partial" : "wait", `${p0CountsPreflight.status ?? "n/a"} / filled=${p0CountsPreflight.filled_count_key_count ?? 0}/${p0CountsPreflight.expected_count_key_count ?? 0} / placeholders=${p0CountsPreflight.placeholder_count_key_count ?? 0} / issues=${p0CountsPreflight.issue_count ?? 0} / data_write=${p0CountsPreflight.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("Preflight guard", String(p0CountsPreflightFixtures.scenario_count ?? 0), `${p0CountsPreflightFixtures.mode ?? "n/a"} / data_write=${p0CountsPreflightFixtures.data_lp_events_write_performed ? "yes" : "no"} / external=${p0CountsPreflightFixtures.external_effect ? "yes" : "no"}`)}
      ${metric("Next P0 intake", nextP0OwnerIntake.candidate_found ? nextP0OwnerIntake.candidate_valid ? "ready" : "blocked" : "wait", `${nextP0OwnerIntake.status ?? "n/a"} / preview=${(nextP0OwnerIntake.funnel_preview_rows ?? 0) + (nextP0OwnerIntake.manual_preview_rows ?? 0)} / staged=${nextP0OwnerIntake.stage_performed ? "yes" : "no"}`)}
      ${metric("Next P0 intake guard", String(nextP0OwnerIntakeFixtures.scenario_count ?? 0), `${nextP0OwnerIntakeFixtures.mode ?? "n/a"} / live_project_inputs=${nextP0OwnerIntakeFixtures.live_project_inputs_created ? "yes" : "no"} / data_write=${nextP0OwnerIntakeFixtures.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("Owner data preflight", String(ownerDataPreflight.selected_source_row_count ?? 0), `${ownerDataPreflight.status ?? "n/a"} / sample=${ownerDataPreflight.sample_threshold_met ? "ready" : "wait"} / win=${ownerDataPreflight.challenger_win_rule_met ? "yes" : "no"} / data_write=${ownerDataPreflight.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("Capture calendar", String(sampleGateCaptureCalendar.event_count ?? 0), `${sampleGateCaptureCalendar.status ?? "n/a"} / next=${sampleGateCaptureCalendar.next_due_date ?? "n/a"} / import=${sampleGateCaptureCalendar.calendar_import_performed ? "yes" : "no"}`)}
      ${metric("Owner capture", String(ownerCaptureQueue.p0_task_count ?? 0), `${ownerCaptureQueue.status ?? "n/a"} / links=${ownerCaptureQueue.p0_link_count ?? 0}`)}
      ${metric("Owner sample gate", String(ownerSampleGate.filled_rows ?? 0), `${ownerSampleGate.status ?? "n/a"} / win=${ownerSampleGate.challenger_win_rule_met ? "yes" : "no"}`)}
      ${metric("Sample form guard", String(sampleGateOwnerFormFixtures.scenario_count ?? 0), `${sampleGateOwnerFormFixtures.mode ?? "n/a"} / compile=${sampleGateOwnerFormFixtures.source_capture_compile_commands_executed ? "yes" : "no"} / sample_gate=${sampleGateOwnerFormFixtures.owner_sample_gate_commands_executed ? "yes" : "no"} / data_write=${sampleGateOwnerFormFixtures.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("Sample intake", ownerSampleGateIntake.candidate_found ? ownerSampleGateIntake.candidate_valid ? "ready" : "blocked" : "wait", `${ownerSampleGateIntake.status ?? "n/a"} / staged=${ownerSampleGateIntake.stage_performed ? "yes" : "no"}`)}
      ${metric("Intake guard", String(ownerSampleGateIntakeFixtures.scenario_count ?? 0), `${ownerSampleGateIntakeFixtures.mode ?? "n/a"} / data_write=${ownerSampleGateIntakeFixtures.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("Next action", ownerNextAction.ok ? "ready" : "wait", `${ownerNextAction.primary_action_id ?? "n/a"} / ${ownerNextAction.status ?? "n/a"}`)}
      ${metric("Outcome preflight", northStarOutcomePreflight.ready_for_source_compile ? "ready" : "wait", `${northStarOutcomePreflight.status ?? "n/a"} / filled=${northStarOutcomePreflight.filled_outcome_row_count ?? 0}/${northStarOutcomePreflight.expected_outcome_row_count ?? 0} / pending=${northStarOutcomePreflight.pending_outcome_row_count ?? 0} / ready_compile=${northStarOutcomePreflight.ready_for_source_compile ? "yes" : "no"} / write=${northStarOutcomePreflight.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("Outcome form", String(northStarOutcomeForm.row_count ?? 0), `${northStarOutcomeForm.status ?? "n/a"} / browser=${northStarOutcomeForm.browser_only ? "yes" : "no"} / network=${northStarOutcomeForm.network_calls_performed ? "yes" : "no"} / write=${northStarOutcomeForm.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("Outcome form guard", String(northStarOutcomeFormFixtures.check_count ?? 0), `${northStarOutcomeFormFixtures.mode ?? "n/a"} / static=${northStarOutcomeFormFixtures.browser_form_static_checks_executed ? "yes" : "no"} / external=${northStarOutcomeFormFixtures.external_effect ? "yes" : "no"}`)}
      ${metric("P1 outcome intake", ownerP1OutcomeIntake.candidate_found ? ownerP1OutcomeIntake.candidate_valid ? "ready" : "blocked" : "wait", `${ownerP1OutcomeIntake.status ?? "n/a"} / filled=${ownerP1OutcomeIntake.filled_outcome_row_count ?? 0}/${ownerP1OutcomeIntake.expected_outcome_row_count ?? 0} / staged=${ownerP1OutcomeIntake.stage_performed ? "yes" : "no"} / write=${ownerP1OutcomeIntake.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("P1 intake guard", String(ownerP1OutcomeIntakeFixtures.scenario_count ?? 0), `${ownerP1OutcomeIntakeFixtures.mode ?? "n/a"} / data_write=${ownerP1OutcomeIntakeFixtures.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerP1OutcomeIntakeFixtures.external_effect ? "yes" : "no"}`)}
      ${metric("P1 outcome post-fill", ownerP1OutcomePostfillCheck.postfill_ready ? "ready" : "wait", `${ownerP1OutcomePostfillCheck.status ?? "n/a"} / stage=${ownerP1OutcomePostfillCheck.current_stage ?? "n/a"} / commands=${ownerP1OutcomePostfillCheck.safe_command_count ?? 0} / local_only=${ownerP1OutcomePostfillCheck.command_runs_local_scripts_only ? "yes" : "no"} / trust=${ownerP1OutcomePostfillCheck.source_trust_status ?? "n/a"} / trusted=${ownerP1OutcomePostfillCheck.source_trust_trusted_scoring_source_count ?? 0} / data_write=${ownerP1OutcomePostfillCheck.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerP1OutcomePostfillCheck.external_effect ? "yes" : "no"}`)}
      ${metric("Recovery pack", sampleGateRecovery.due_now ? "due" : "wait", `${sampleGateRecovery.status ?? "n/a"} / missing=${sampleGateRecovery.missing_rank_count ?? 0}/${sampleGateRecovery.p0_input_count ?? 0} / write=${sampleGateRecovery.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("P0 batches", `${sampleGateBatchHandoff.focused_batch_row_count ?? 0}+${sampleGateBatchHandoff.remaining_batch_row_count ?? 0}`, `${sampleGateBatchHandoff.status ?? "n/a"} / full=${sampleGateBatchHandoff.full_coverage_ready ? "yes" : "no"} / write=${sampleGateBatchHandoff.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("Count handoff", ownerSampleCountHandoff.ok ? "ready" : "wait", `${ownerSampleCountHandoff.status ?? "n/a"} / focused_missing=${ownerSampleCountHandoff.missing_count ?? 0}/${ownerSampleCountHandoff.p0_input_count ?? 0} / full_p0=${ownerSampleCountHandoff.full_p0_row_count ?? 0}/${ownerSampleCountHandoff.full_p0_task_count ?? 0} / remaining=${ownerSampleCountHandoff.full_p0_remaining_batch_row_count ?? 0} / write=${ownerSampleCountHandoff.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("P0 now", ownerP0Now.ok ? "ready" : "wait", `${ownerP0Now.status ?? "n/a"} / focused=${ownerP0Now.p0_focused_missing_count ?? 0}/${ownerP0Now.p0_focused_total_count ?? 0} / full=${ownerP0Now.p0_full_row_count ?? 0}/${ownerP0Now.p0_full_task_count ?? 0} / quick_missing=${ownerP0Now.quick_missing_rank_count ?? 0} / next=${ownerP0Now.approval_queue_next_pending_human_id ?? "n/a"} / write=${ownerP0Now.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("Collection sprint", sampleGateCollectionSprint.ok ? "active" : "wait", `${sampleGateCollectionSprint.status ?? "n/a"} / pending=${sampleGateCollectionSprint.p0_pending_count ?? 0}/${sampleGateCollectionSprint.p0_full_task_count ?? 0} / steps=${sampleGateCollectionSprint.sprint_step_count ?? 0} / due=${sampleGateCollectionSprint.due_status ?? "n/a"} / report=sample_gate_collection_sprint.md / write=${sampleGateCollectionSprint.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("P0 launcher", ownerP0Launcher.ok ? "ready" : "wait", `${ownerP0Launcher.mode ?? "n/a"} / targets=${ownerP0Launcher.target_count ?? 0} / focused_missing=${ownerP0Launcher.owner_p0_now_focused_missing_count ?? 0}/${ownerP0Launcher.owner_p0_now_focused_total_count ?? 0} / local_only=${ownerP0Launcher.command_opens_local_files_only ? "yes" : "no"} / external=${ownerP0Launcher.external_effect ? "yes" : "no"}`)}
      ${metric("Count recovery", ownerSampleCountRecovery.ok ? "ready" : "wait", `${ownerSampleCountRecovery.status ?? "n/a"} / preview=${ownerSampleCountRecovery.owner_preview_rows ?? 0} / full=${ownerSampleCountRecovery.full_p0_row_count ?? 0} / full_intake=${ownerSampleCountRecovery.full_p0_intake_ready ? "yes" : "no"} / staged=${ownerSampleCountRecovery.full_p0_staged_ready ? "yes" : "no"} / sample=${ownerSampleCountRecovery.sample_threshold_met ? "yes" : "no"} / write=${ownerSampleCountRecovery.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("Count recovery guard", String(ownerSampleCountRecoveryFixtures.scenario_count ?? 0), `${ownerSampleCountRecoveryFixtures.mode ?? "n/a"} / data_write=${ownerSampleCountRecoveryFixtures.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerSampleCountRecoveryFixtures.external_effect ? "yes" : "no"}`)}
      ${metric("Owner launcher", ownerActionLauncher.ok ? "ready" : "wait", `${ownerActionLauncher.mode ?? "n/a"} / targets=${ownerActionLauncher.target_count ?? 0} / external=${ownerActionLauncher.external_effect ? "yes" : "no"}`)}
      ${metric("Approval queue", String(approvalStatus.item_count ?? approvalItems.length), `${approvalStatus.status ?? "n/a"} / ready=${approvalStatus.ready_local_review_count ?? readyLocal.length} / pending=${approvalStatus.pending_human_count ?? pendingHuman.length} / high=${approvalStatus.high_risk_pending_count ?? 0}`)}
      ${metric("Approval form", ownerApprovalForm.ok ? "ready" : "wait", `${ownerApprovalForm.status ?? "n/a"} / gates=${ownerApprovalForm.form_gate_count ?? 0} / network=${ownerApprovalForm.network_calls_performed ? "yes" : "no"}`)}
      ${metric("Approval form guard", String(ownerApprovalFormFixtures.scenario_count ?? 0), `${ownerApprovalFormFixtures.mode ?? "n/a"} / replay=${ownerApprovalFormFixtures.form_export_replay_executed ? "yes" : "no"} / external=${ownerApprovalFormFixtures.external_effect ? "yes" : "no"}`)}
      ${metric("Sample gate guard", String(ownerSampleGateFixtures.scenario_count ?? 0), `${ownerSampleGateFixtures.mode ?? "n/a"} / data_write=${ownerSampleGateFixtures.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("Quality review", ownerQualityReview.no_quality_regression === null ? "n/a" : ownerQualityReview.no_quality_regression ? "pass" : "fail", `${ownerQualityReview.status ?? "n/a"} / queued=${ownerQualityReview.promotion_review_queued ? "yes" : "no"}`)}
      ${metric("Quality form", ownerQualityReviewForm.sample_rate_win_candidate ? "ready" : "wait", `${ownerQualityReviewForm.status ?? "n/a"} / browser_only=${ownerQualityReviewForm.browser_only ? "yes" : "no"} / network=${ownerQualityReviewForm.network_calls_performed ? "yes" : "no"}`)}
      ${metric("Quality form guard", String(ownerQualityReviewFormFixtures.scenario_count ?? 0), `${ownerQualityReviewFormFixtures.mode ?? "n/a"} / data_write=${ownerQualityReviewFormFixtures.data_lp_events_write_performed ? "yes" : "no"} / approval_write=${ownerQualityReviewFormFixtures.approval_queue_write_performed ? "yes" : "no"}`)}
      ${metric("Quality guard", String(ownerQualityReviewFixtures.scenario_count ?? 0), `${ownerQualityReviewFixtures.mode ?? "n/a"} / data_write=${ownerQualityReviewFixtures.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("Retirement guard", String(retirementFixtures.scenario_count ?? 0), `${retirementFixtures.mode ?? "n/a"} / delete=${retirementFixtures.delete_action_performed ? "yes" : "no"}`)}
      ${metric("Sample gate", String(sampleGate.p0_task_count ?? dataCollectionStatus.sample_gate_p0_task_count ?? 0), `${sampleGate.status ?? dataCollectionStatus.sample_gate_status ?? "n/a"} / links=${sampleGate.p0_link_count ?? dataCollectionStatus.sample_gate_p0_link_count ?? 0}`)}
      ${metric("Due status", sampleGateDueStatus.due_now ? "due" : "wait", `${sampleGateDueStatus.status ?? "n/a"} / phase=${sampleGateDueStatus.due_phase ?? "n/a"}`)}
      ${metric("Due guard", String(sampleGateDueFixtures.scenario_count ?? 0), `${sampleGateDueFixtures.mode ?? "n/a"} / project_overwrite=${sampleGateDueFixtures.project_due_status_write_performed ? "yes" : "no"} / external=${sampleGateDueFixtures.external_effect ? "yes" : "no"}`)}
      ${metric("Manual preview", String(manual.events_written ?? 0), "aggregate-only, not applied")}
      ${metric("Manual packet", String(manualPublishPacket.packet_count ?? 0), `${manualPublishPacket.status ?? "n/a"} / post=${manualPublishPacket.formal_post_performed ? "yes" : "no"}`)}
      ${metric("Capture plan", String(manualPublishCapturePlan.sample_gate_row_count ?? 0), `${manualPublishCapturePlan.status ?? "n/a"} / north=${manualPublishCapturePlan.north_star_capture_row_count ?? 0}`)}
      ${metric("Publish brief", manualPublishBrief.formal_publish_ready ? "ready" : "blocked", `${manualPublishBrief.status ?? "n/a"} / public_url=${manualPublishBrief.tracking_url_public_ready ? "yes" : "no"} / selected=${manualPublishBrief.selected_packet_id ?? "n/a"}`)}
      ${metric("Public URL pack", publicTrackingUrlPack.public_tracking_url_ready ? "ready" : "blocked", `${publicTrackingUrlPack.status ?? "n/a"} / previews=${publicTrackingUrlPack.preview_count ?? 0} / selected=${publicTrackingUrlPack.selected_link_id ?? "n/a"}`)}
      ${metric("Public URL approval", ownerPublicUrlApprovalPreview.public_tracking_url_ready ? "ready" : "blocked", `${ownerPublicUrlApprovalPreview.status ?? "n/a"} / gates=${ownerPublicUrlApprovalPreview.required_gate_count ?? 0} / fields=${ownerPublicUrlApprovalPreview.required_field_count ?? 0} / live_input=${ownerPublicUrlApprovalPreview.live_input_files_created ? "yes" : "no"}`)}
      ${metric("Publish evidence", manualPublishEvidence.input_exists ? String(manualPublishEvidence.valid_evidence_count ?? 0) : "wait", `${manualPublishEvidence.status ?? "n/a"} / day3=${manualPublishEvidence.day_3_capture_date ?? "n/a"} / day7=${manualPublishEvidence.day_7_capture_date ?? "n/a"}`)}
      ${metric("Publish evidence form", manualPublishEvidenceForm.owner_input_exists ? "review" : "ready", `${manualPublishEvidenceForm.status ?? "n/a"} / browser=${manualPublishEvidenceForm.browser_only ? "yes" : "no"} / network=${manualPublishEvidenceForm.network_calls_performed ? "yes" : "no"} / input=${manualPublishEvidenceForm.owner_input_exists ? "present" : "missing"}`)}
      ${metric("Publish evidence form guard", String(manualPublishEvidenceFormFixtures.scenario_count ?? 0), `${manualPublishEvidenceFormFixtures.mode ?? "n/a"} / data_write=${manualPublishEvidenceFormFixtures.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("Publish evidence guard", String(manualPublishEvidenceFixtures.scenario_count ?? 0), `${manualPublishEvidenceFixtures.mode ?? "n/a"} / data_write=${manualPublishEvidenceFixtures.data_lp_events_write_performed ? "yes" : "no"}`)}
      ${metric("North Star", per100Display(northStar.totals?.line_adds_per_100_clicks), `LINE / 100 clicks / clicks=${northStar.totals?.link_clicks ?? 0}`)}
      ${metric("Content links", String(funnelBreakdown.summary?.content_variant_links ?? 0), "draft-only post attribution")}
      ${metric("Tracking smoke", `${trackingLinkSmoke.links_checked ?? 0}/${trackingLinkSmoke.expected_link_count ?? 0}`, "generated links isolated smoke")}
      ${metric("Runner", `${runnerSuccess}/${runnerCommands.length}`, "weekly local commands succeeded")}
      ${metric("Schedule", schedule.local_persistent_schedule || launchAgent.local_persistent_schedule ? "active" : "wait", `${schedule.cadence ?? "n/a"} / ${localSchedule.weekday ?? "n/a"} ${String(localSchedule.hour ?? "n/a").padStart(2, "0")}:${String(localSchedule.minute ?? "n/a").padStart(2, "0")} ${localSchedule.timezone ?? ""}`)}
      ${metric("Catch-up", scheduleCatchup.catchup_required ? "review" : "current", `${scheduleCatchup.status ?? "n/a"} / next=${scheduleCatchup.next_expected_run?.taipei ?? "n/a"} / invoked=${scheduleCatchup.weekly_runner_invoked ? "yes" : "no"}`)}
      ${metric("LaunchAgent", launchAgentRuntime.observed_successful_run ? "verified" : launchAgentRuntime.current_launchd_invocation_observed ? "running-verified" : launchAgent.service_loaded ? "loaded" : "wait", `${launchAgent.label ?? "n/a"} / runs=${launchAgentRuntime.run_count ?? "n/a"} / exit=${launchAgentRuntime.last_exit_code ?? "n/a"} / proof=${launchAgentRuntime.proof_kind ?? "none"} / external=${launchAgent.external_effect ? "yes" : "no"}`)}
      ${metric("History", String(iterationHistory.archive_summary?.archives_scanned ?? 0), iterationHistory.status ?? "iteration history")}
      ${metric("GitHub guard", githubWorkflowGuard.ok ? "ok" : "review", `${githubWorkflowGuard.mode ?? "n/a"} / checks=${githubWorkflowGuard.check_count ?? 0} / failed=${githubWorkflowGuard.failed_check_count ?? 0}`)}
      ${metric("GitHub bundle", String(githubExport.file_count ?? 0), githubExport.ok ? "repo-ready local copy" : "not ready")}
      ${metric("Retention", String(artifactRetention.warning_count ?? 0), `${artifactRetention.status ?? "n/a"} / total=${artifactRetention.total_human ?? "n/a"} / delete=${artifactRetention.delete_action_performed ? "yes" : "no"}`)}
      ${metric("Retention review", artifactRetentionReview.review_required ? "review" : "ok", `${artifactRetentionReview.status ?? "n/a"} / candidates=${artifactRetentionReview.cleanup_candidate_count ?? 0} / commands=${artifactRetentionReview.cleanup_command_generated ? "yes" : "no"} / delete=${artifactRetentionReview.delete_action_performed ? "yes" : "no"}`)}
      ${metric("Gate evidence", `${ownerEvidence.ready_gate_count ?? 0}/${ownerEvidence.non_manual_gate_count ?? 0}`, ownerEvidence.status ?? "waiting_for_owner_evidence")}
      ${metric("Evidence guard", String(ownerEvidenceFixtures.scenario_count ?? 0), `${ownerEvidenceFixtures.mode ?? "n/a"} / external=${ownerEvidenceFixtures.external_effect ? "yes" : "no"}`)}
      ${metric("Post-gate", `${postGate.ready_gate_count ?? 0}/${postGate.non_manual_gate_count ?? 0}`, postGate.status ?? "waiting_for_owner_evidence")}
      ${metric("Post-gate guard", String(postGateFixtures.scenario_count ?? 0), `${postGateFixtures.mode ?? "n/a"} / external=${postGateFixtures.external_effect ? "yes" : "no"}`)}
      ${metric("Owner gates", String(launchReadiness.pending_human_approval_count ?? pendingHuman.length), "pending external-effect approvals")}
      ${metric("Gate matrix", `${gateReadiness.ready_gate_count ?? 0}/${gateReadiness.gate_count ?? 0}`, `gate readiness: ${gateReadiness.status ?? "unknown"}`)}
      ${metric("Red-line priority", redlinePriority.ok ? String(redlinePriority.action_count ?? 0) : "wait", `${redlinePriority.status ?? "n/a"} / next=${redlinePriority.next_operator_action ?? "n/a"}`)}
      ${metric("Gate metadata", String(gateMetadataActions.length), `${publicAbMetadataAction?.gate_id ?? "public_ab_small_traffic_link"} / ${publicAbMetadataAction?.status ?? "not listed"}`)}
    </section>

    <section class="grid main">
      <div class="grid">
        <section class="panel">
          <header>
            <h2>Funnel Decision</h2>
            ${badge(ab.decision ?? "unknown", ab.challenger_win_rule_met ? "warn" : "ok")}
          </header>
          <div class="body">
            <div class="grid two">
              ${assetCard("Champion", champion)}
              ${assetCard("Challenger", challenger)}
            </div>
          </div>
        </section>

        <section class="panel">
          <header>
            <h2>Next Round</h2>
            ${badge(nextRound.decision ?? "unknown", nextRound.next_round?.start_new_variable_round ? "warn" : "ok")}
          </header>
          <div class="body">
            <div class="split-list">
              ${row("Current variable", nextRound.current_round?.changed_variable ?? "n/a")}
              ${row("Next variable", nextRound.next_round?.changed_variable ?? "n/a")}
              ${row("Start new round", nextRound.next_round?.start_new_variable_round ? "yes" : "no")}
              ${row("Sample gaps", sampleGaps(nextRound))}
              ${row("Human gate", nextRound.approval_gate?.human_gate ?? "Review before external action.")}
            </div>
          </div>
        </section>

        <section class="panel">
          <header>
            <h2>Iteration History</h2>
            ${badge(iterationHistory.ok ? "history ok" : "attention", iterationHistory.ok ? "ok" : "warn")}
          </header>
          <div class="body">
            <div class="split-list">
              ${row("Status", iterationHistory.status ?? "n/a")}
              ${row("Cadence", iterationHistory.cadence ?? "n/a")}
              ${row("Current variable", iterationHistory.current_round?.changed_variable ?? "n/a")}
              ${row("Sample met", iterationHistory.sample_gate?.sample_threshold_met ? "yes" : "no")}
              ${row("Archives scanned", String(iterationHistory.archive_summary?.archives_scanned ?? 0))}
              ${row("Next safe actions", String((iterationHistory.next_safe_actions ?? []).length))}
            </div>
          </div>
        </section>

        <section class="panel">
          <header>
            <h2>Funnel Breakdown</h2>
            ${badge(funnelBreakdown.mode === "content_variant_attribution" ? "attribution ready" : "attention", funnelBreakdown.mode === "content_variant_attribution" ? "ok" : "warn")}
          </header>
          <div class="body">
            <div class="split-list">
              ${row("Rows", String(funnelBreakdown.summary?.rows ?? 0))}
              ${row("Content links", String(funnelBreakdown.summary?.content_variant_links ?? 0))}
              ${row("Real events", String(funnelBreakdown.summary?.real_events ?? 0))}
              ${row("External effect", funnelBreakdown.external_effect ? "yes" : "no")}
            </div>
          </div>
        </section>

        <section class="panel">
          <header>
            <h2>Objective Contract</h2>
            ${badge(objectiveAudit.ok ? "contract ok" : "attention", objectiveAudit.ok ? "ok" : "warn")}
          </header>
          <div class="body">
            ${objectiveContractTable(objectiveAudit)}
          </div>
        </section>

        <section class="panel">
          <header>
            <h2>Approval Queue</h2>
            ${badge(`${approvalStatus.pending_human_count ?? pendingHuman.length} pending`, (approvalStatus.pending_human_count ?? pendingHuman.length) > 0 ? "block" : "ok")}
          </header>
          <div class="body">
            <div class="rows">
              ${row("Approval queue status", `${approvalStatus.status ?? "n/a"} / items=${approvalStatus.item_count ?? approvalItems.length} / ready=${approvalStatus.ready_local_review_count ?? readyLocal.length} / pending=${approvalStatus.pending_human_count ?? pendingHuman.length} / high_risk=${approvalStatus.high_risk_pending_count ?? 0} / policy_ok=${approvalStatus.policy_ok ? "yes" : "no"} / external=${approvalStatus.external_effect ? "yes" : "no"}`)}
              ${row("Next local review", `${approvalStatus.next_ready_local_review_id ?? "n/a"} / ${approvalStatus.next_ready_local_review_artifact ?? "n/a"}`)}
              ${row("Next human gate", `${approvalStatus.next_pending_human_id ?? "n/a"} / ${approvalStatus.next_pending_human_artifact ?? "n/a"}`)}
            </div>
            ${approvalTable(approvalItems)}
          </div>
        </section>

        <section class="panel">
          <header>
            <h2>Local Verification</h2>
            ${badge(launchReadiness.local_preflight_ok ? "preflight ok" : "attention", launchReadiness.local_preflight_ok ? "ok" : "warn")}
          </header>
          <div class="body">
            <div class="split-list">
              ${row("Worker dry run", workerDryRun.ok ? "ok" : "not ready")}
              ${row("Dry-run exit", workerDryRun.dry_run_exit_observed ? "yes" : "no")}
              ${row("Exit code", String(workerDryRun.exit_code ?? "n/a"))}
              ${row("Production deploy", workerDryRun.production_deploy_performed ? "yes" : "no")}
              ${row("Report", workerDryRun.report_path ?? "worker_dry_run.md")}
              ${row("Log", workerDryRun.log_path ?? "n/a")}
              ${row("D1 readiness", `${cloudflareD1Readiness.status ?? "n/a"} / exact=${cloudflareD1Readiness.inventory?.exact_match_count ?? 0} / table_query=${cloudflareD1Readiness.remote_table_query_performed ? "yes" : "no"}`)}
              ${row("Live telemetry chain", `${liveTelemetryReadiness.status ?? "n/a"} / candidate=${liveTelemetryReadiness.candidate_worker?.deployment_observed ? "observed" : "missing"} / operation=${liveTelemetryReadiness.candidate_worker?.operation_mode ?? "n/a"} / deploy_required=${liveTelemetryReadiness.candidate_worker?.deploy_required ? "yes" : "no"} / ingest=${liveTelemetryReadiness.decisions?.live_ingest_readiness_proven ? "proven" : "blocked"} / weekly_read=${liveTelemetryReadiness.decisions?.weekly_aggregate_read_authorized ? "authorized" : "blocked"}`)}
              ${row("Live telemetry guard", `${liveTelemetryReadinessFixtures.ok ? "ok" : "not ready"} / scenarios=${liveTelemetryReadinessFixtures.scenario_count ?? 0} / live_network=${liveTelemetryReadinessFixtures.live_network_refresh_performed ? "attention" : "no"} / table_query=${liveTelemetryReadinessFixtures.remote_table_query_performed ? "attention" : "no"}`)}
              ${row("D1 schema contract", `${d1SchemaContract.status ?? "n/a"} / checks=${Object.keys(d1SchemaContract.checks ?? {}).length} / remote=${d1SchemaContract.remote_d1_migration_performed ? "yes" : "no"}`)}
              ${row("D1 config guard", `${approvedD1Config.status ?? "n/a"} / ready=${approvedD1Config.ready_to_apply ? "yes" : "no"} / write=${approvedD1Config.local_config_write_performed ? "yes" : "no"}`)}
              ${row("D1 auto collection", `${d1CollectionMode.status ?? "n/a"} / scope=${d1CollectionMode.selected_scope ?? "n/a"} / remote_authorized=${d1CollectionMode.remote_read_authorized ? "yes" : "no"} / raw_rows=${d1CollectionMode.raw_event_rows_read_performed ? "attention" : "no"} / customer_data=${d1CollectionMode.customer_data_read_performed ? "attention" : "no"}`)}
              ${row("D1 selector guard", `${d1CollectionModeFixtures.ok ? "ok" : "not ready"} / scenarios=${d1CollectionModeFixtures.scenario_count ?? 0} / remote_read=${d1CollectionModeFixtures.remote_read_performed ? "attention" : "no"}`)}
              ${row("D1 aggregate guard", `${d1AggregateExportFixtures.ok ? "ok" : "not ready"} / scenarios=${d1AggregateExportFixtures.scenario_count ?? 0} / real_remote=${d1AggregateExportFixtures.real_remote_cli_performed ? "attention" : "no"} / customer_data=${d1AggregateExportFixtures.customer_data_read_performed ? "attention" : "no"}`)}
              ${row("Champion local commit", `${championLocalBranch.status ?? "n/a"} / ${championLocalBranch.local_branch?.commit?.slice(0, 12) ?? "n/a"} / remote=${championLocalBranch.remote_observation?.branch_present ? "yes" : "no"}`)}
              ${row("Champion release", `${championReleasePreflight.status ?? "n/a"} / dry_run=${championReleasePreflight.worker_dry_run?.ok ? "pass" : "fail"} / deploy=${championReleasePreflight.production_deploy_performed ? "yes" : "no"}`)}
              ${row("Champion GitHub", `${championGithubHandoff.status ?? "n/a"} / repo=${championGithubHandoff.repository?.slug ?? "n/a"} / push_pr=${championGithubHandoff.github_push_or_pr_performed ? "yes" : "no"}`)}
            </div>
            ${verificationTable(runnerCommands, browserChecks, fixtureScenarios, funnelFixtureScenarios, realDataApplyScenarios, decisionReplayScenarios, sampleGateReplayScenarios, sampleGateDueFixtureScenarios, approvalFixtureScenarios)}
          </div>
        </section>
      </div>

      <aside class="grid">
        <section class="panel">
          <header>
            <h2>Hard Red Lines</h2>
            ${badge("preserved", "ok")}
          </header>
          <div class="body">
            <div class="gate-list">
              ${redLine("Production deploy", runner.production_deploy_performed)}
              ${redLine("Public link change", runner.public_link_change_performed)}
              ${redLine("Formal post", runner.formal_post_performed)}
              ${redLine("LINE push", runner.line_push_performed)}
              ${redLine("Customer data mutation", runner.customer_data_mutation_performed)}
              ${redLine("Payment action", runner.payment_action_performed)}
              ${redLine("Delete action", runner.delete_action_performed)}
            </div>
          </div>
        </section>

        <section class="panel">
          <header>
            <h2>Archive</h2>
            ${badge(archive.ok ? "snapshot ok" : "not ready", archive.ok ? "ok" : "warn")}
          </header>
          <div class="body">
            <div class="split-list">
              ${row("Files", `${archive.files_archived ?? 0}/${archive.expected_files ?? 0}`)}
              ${row("Missing", String((archive.missing_files ?? []).length))}
              ${row("Manifest", archive.manifest_path ?? "n/a")}
              ${row("Directory", archive.archive_dir ?? "n/a")}
            </div>
          </div>
        </section>

        <section class="panel">
          <header>
            <h2>Artifacts</h2>
            ${badge("local links", "ok")}
          </header>
          <div class="body">
            <div class="artifact-grid">
              ${artifact("Weekly report", "weekly_report.md")}
              ${artifact("Schedule status", "data/schedule_status.json")}
              ${artifact("Catch-up status", "schedule_catchup_status.md")}
              ${artifact("Catch-up JSON", "data/schedule_catchup_status.json")}
              ${artifact("LaunchAgent status", "data/launchagent_status.json")}
              ${artifact("LaunchAgent plist", "launchd/com.angelia.3q-growth-loop.weekly.plist")}
              ${artifact("Growth scores", "growth_scores.json")}
              ${artifact("A/B status", "ab_test_status.json")}
              ${artifact("Next round", "next_round_plan.md")}
              ${artifact("Iteration history", "iteration_history.md")}
              ${artifact("North Star", "north_star_funnel.md")}
              ${artifact("Funnel breakdown", "funnel_breakdown.md")}
              ${artifact("Worker dry run", "worker_dry_run.md")}
              ${artifact("D1 readiness", "cloudflare_d1_readiness.md")}
              ${artifact("Live telemetry readiness", "live_telemetry_readiness.md")}
              ${artifact("Live telemetry fixtures", "live_telemetry_readiness_fixture_report.md")}
              ${artifact("D1 schema contract", "d1_schema_contract.md")}
              ${artifact("D1 config guard", "approved_d1_config.md")}
              ${artifact("D1 collection mode", "d1_collection_mode.md")}
              ${artifact("D1 selector fixtures", "d1_collection_mode_fixture_report.md")}
              ${artifact("D1 aggregate fixtures", "d1_aggregate_export_fixture_report.md")}
              ${artifact("Champion local commit", "champion_local_branch.md")}
              ${artifact("Champion release", "champion_release_preflight.md")}
              ${artifact("Champion owner packet", "champion_release_owner_packet.md")}
              ${artifact("Champion GitHub", "champion_github_handoff.md")}
              ${artifact("Champion PR body", "champion_github_pr_body.md")}
              ${artifact("Tracking smoke", "tracking_link_smoke.md")}
              ${artifact("Funnel preview", "data/funnel_aggregates.preview.jsonl")}
              ${artifact("Funnel guard", "funnel_aggregate_fixture_report.md")}
              ${artifact("Apply guard", "real_data_apply_fixture_report.md")}
              ${artifact("Decision replay", "real_data_decision_replay_report.md")}
              ${artifact("Source capture", "source_capture_pack.md")}
              ${artifact("Sample ledger", "sample_gate_ledger.md")}
              ${artifact("Sample replay", "sample_gate_replay_fixture_report.md")}
              ${artifact("Source compile", "source_capture_compile_report.md")}
              ${artifact("Compile guard", "source_capture_compile_fixture_report.md")}
              ${artifact("Intake plan", "real_data_intake_plan.md")}
              ${artifact("Data brief", "data_collection_brief.md")}
              ${artifact("Owner capture", "week0_owner_capture_queue.md")}
              ${artifact("Owner sample gate", "owner_sample_gate_status.md")}
              ${artifact("Outcome preflight", "north_star_outcome_preflight.md")}
              ${artifact("Outcome preflight JSON", "north_star_outcome_preflight.json")}
              ${artifact("Outcome form", "north_star_outcome_form.html")}
              ${artifact("Outcome form guard", "north_star_outcome_form_fixture_report.md")}
              ${artifact("P1 outcome intake", "owner_p1_outcome_intake.md")}
              ${artifact("P1 outcome intake JSON", "owner_p1_outcome_intake.json")}
              ${artifact("P1 outcome intake guard", "owner_p1_outcome_intake_fixture_report.md")}
              ${artifact("P1 outcome post-fill", "owner_p1_outcome_postfill_check.md")}
              ${artifact("P1 outcome post-fill JSON", "owner_p1_outcome_postfill_check.json")}
              ${artifact("P1 outcome post-fill command", "RUN-P1-OUTCOME-POST-FILL-CHECK.command")}
              ${artifact("Sample worksheet", "sample_gate_owner_worksheet.md")}
              ${artifact("Sample form", "sample_gate_owner_form.html")}
              ${artifact("Sample form guard", "sample_gate_owner_form_fixture_report.md")}
              ${artifact("Sample intake", "owner_sample_gate_intake.md")}
              ${artifact("Intake guard", "owner_sample_gate_intake_fixture_report.md")}
              ${artifact("Next action", "owner_next_action.md")}
              ${artifact("Sample gate recovery", "sample_gate_recovery_pack.md")}
              ${artifact("Sample gate recovery JSON", "sample_gate_recovery_pack.json")}
              ${artifact("P0 batch handoff", "sample_gate_batch_handoff.md")}
              ${artifact("P0 batch handoff JSON", "sample_gate_batch_handoff.json")}
              ${artifact("P0 batch preflight", "sample_gate_batch_preflight.md")}
              ${artifact("P0 batch preflight JSON", "sample_gate_batch_preflight.json")}
              ${artifact("P0 batch 1 paste block", "sample_gate_batch_1_paste_block.txt")}
              ${artifact("P0 batch 2 paste block", "sample_gate_batch_2_paste_block.txt")}
              ${artifact("Sample count handoff", "owner_sample_count_handoff.md")}
              ${artifact("Sample count paste block", "owner_sample_count_paste_block.txt")}
              ${artifact("Sample count handoff JSON", "owner_sample_count_handoff.json")}
              ${artifact("P0 now cockpit", "owner_p0_now.html")}
              ${artifact("P0 now", "owner_p0_now.md")}
              ${artifact("P0 now JSON", "owner_p0_now.json")}
              ${artifact("P0 now status", "data/owner_p0_now_status.json")}
              ${artifact("P0 launcher", "owner_p0_launcher.md")}
              ${artifact("P0 open command", "OPEN-P0-SAMPLE-GATE.command")}
              ${artifact("Sample count recovery", "owner_sample_count_recovery.md")}
              ${artifact("Sample count recovery JSON", "owner_sample_count_recovery.json")}
              ${artifact("P0 post-fill check", "owner_p0_postfill_check.md")}
              ${artifact("P0 post-fill check JSON", "owner_p0_postfill_check.json")}
              ${artifact("P0 post-fill command", "RUN-P0-POST-FILL-CHECK.command")}
              ${artifact("Sample count recovery guard", "owner_sample_count_recovery_fixture_report.md")}
              ${artifact("Owner launcher", "owner_action_launcher.md")}
              ${artifact("Open command", "OPEN-3Q-GROWTH-LOOP.command")}
              ${artifact("Sample gate guard", "owner_sample_gate_fixture_report.md")}
              ${artifact("Quality review", "owner_quality_review.md")}
              ${artifact("Quality form", "owner_quality_review_form.html")}
              ${artifact("Quality form guard", "owner_quality_review_form_fixture_report.md")}
              ${artifact("Quality guard", "owner_quality_review_fixture_report.md")}
              ${artifact("Retirement guard", "candidate_retirement_fixture_report.md")}
              ${artifact("Sample gate", "sample_gate_collection_plan.md")}
              ${artifact("Data queue", "data_collection_queue.json")}
              ${artifact("Data progress", "data_collection_progress.md")}
              ${artifact("Next P0 inputs", "next_p0_owner_inputs.md")}
              ${artifact("Next P0 form", "next_p0_owner_form.html")}
              ${artifact("Next P0 form guard", "next_p0_owner_form_fixture_report.md")}
              ${artifact("Next P0 quick", "next_p0_quick_capture.md")}
              ${artifact("Next P0 quick guard", "next_p0_quick_capture_fixture_report.md")}
              ${artifact("Next P0 quick template", "data/next_p0_quick_capture/next_p0_owner_inputs.quick-template.csv")}
              ${artifact("Next P0 paste template", "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt")}
              ${artifact("P0 counts preflight", "p0_counts_preflight.md")}
              ${artifact("P0 counts preflight JSON", "p0_counts_preflight.json")}
              ${artifact("P0 counts preflight status", "data/p0_counts_preflight_status.json")}
              ${artifact("P0 counts preflight guard", "p0_counts_preflight_fixture_report.md")}
              ${artifact("P0 counts preflight guard status", "data/p0_counts_preflight_fixture_status.json")}
              ${artifact("Next P0 intake", "next_p0_owner_intake.md")}
              ${artifact("Next P0 intake guard", "next_p0_owner_intake_fixture_report.md")}
              ${artifact("Owner data preflight", "owner_data_preflight.md")}
              ${artifact("Owner data preflight JSON", "owner_data_preflight.json")}
              ${artifact("Capture calendar", "sample_gate_capture_calendar.md")}
              ${artifact("Due status", "sample_gate_due_status.md")}
              ${artifact("Due guard", "sample_gate_due_fixture_report.md")}
              ${artifact("Approval queue", "approval_queue.json")}
              ${artifact("Goal completion", "goal_completion_audit.md")}
              ${artifact("Goal completion status", "data/goal_completion_audit_status.json")}
              ${artifact("Owner pack", "owner_approval_pack.md")}
              ${artifact("Approval form", "owner_approval_form.html")}
              ${artifact("Approval form guard", "owner_approval_form_fixture_report.md")}
              ${artifact("LINE inbound", "line_inbound_playbook.md")}
              ${artifact("Manual publish packet", "manual_publish_packet.md")}
              ${artifact("Manual capture plan", "manual_publish_capture_plan.md")}
              ${artifact("Manual publish brief", "manual_publish_brief.md")}
              ${artifact("Manual publish brief JSON", "manual_publish_brief.json")}
              ${artifact("Public tracking URL pack", "public_tracking_url_pack.md")}
              ${artifact("Public tracking URL pack JSON", "public_tracking_url_pack.json")}
              ${artifact("Owner public URL approval preview", "owner_public_url_approval_preview.md")}
              ${artifact("Owner public URL approval JSON", "owner_public_url_approval_preview.json")}
              ${artifact("Manual publish evidence", "manual_publish_evidence.md")}
              ${artifact("Manual publish evidence form", "manual_publish_evidence_form.html")}
              ${artifact("Manual publish evidence form guard", "manual_publish_evidence_form_fixture_report.md")}
              ${artifact("Manual publish evidence guard", "manual_publish_evidence_fixture_report.md")}
              ${artifact("Resume plan", "approval_resume_plan.md")}
              ${artifact("Gate evidence", "owner_gate_evidence.md")}
              ${artifact("Evidence guard", "owner_gate_evidence_fixture_report.md")}
              ${artifact("Post-gate verify", "post_gate_verification.md")}
              ${artifact("Post-gate guard", "post_gate_verification_fixture_report.md")}
              ${artifact("Gate readiness", "gate_readiness.md")}
              ${artifact("Red-line priority", "redline_priority.md")}
              ${artifact("Red-line priority JSON", "redline_priority.json")}
              ${artifact("PreparedButBlocked handoff", "prepared_but_blocked.md")}
              ${artifact("PreparedButBlocked status", "data/prepared_but_blocked_report_status.json")}
              ${artifact("GitHub workflow guard", "github_workflow_guard.md")}
              ${artifact("GitHub workflow guard JSON", "github_workflow_guard.json")}
              ${artifact("GitHub bundle", "github_export_manifest.md")}
              ${artifact("Artifact retention", "artifact_retention.md")}
              ${artifact("Artifact retention JSON", "data/artifact_retention_status.json")}
              ${artifact("Retention review", "artifact_retention_review_pack.md")}
              ${artifact("Retention review JSON", "artifact_retention_review_pack.json")}
              ${artifact("Retention review status", "data/artifact_retention_review_status.json")}
              ${artifact("Blocked queue", "prepared_but_blocked.json")}
              ${artifact("Candidate page", "landing_page_candidate.html")}
            </div>
          </div>
        </section>

        <section class="panel">
          <header>
            <h2>Data Sources</h2>
            ${badge(d1CollectionMode.remote_read_authorized ? "aggregate approved" : "local only", "ok")}
          </header>
          <div class="body">
            <div class="split-list">
              ${row("D1 export", `${d1Sync.scope ?? "n/a"} / rows=${d1Sync.rows_exported ?? 0} / scoring=${d1Sync.scoring_input_allowed ? "allowed" : "blocked"} / smoke=${d1Sync.synthetic_or_smoke_row_count ?? 0} / data_write=${d1Sync.data_lp_events_write_performed ? "yes" : "no"}`)}
              ${row("D1 collection selector", `${d1CollectionMode.status ?? "n/a"} / scope=${d1CollectionMode.selected_scope ?? "n/a"} / recurring=${d1CollectionMode.recurring_aggregate_read_approved ? "approved" : "blocked"} / remote_read=${d1CollectionMode.remote_read_performed ? "yes" : "no"} / raw_rows=${d1CollectionMode.raw_event_rows_read_performed ? "attention" : "no"} / customer_data=${d1CollectionMode.customer_data_read_performed ? "attention" : "no"}`)}
              ${row("D1 collection plan", `${d1CollectionModePlan.status ?? "n/a"} / plan_only=${d1CollectionModePlan.plan_only ? "yes" : "no"} / remote_read=${d1CollectionModePlan.remote_read_performed ? "attention" : "no"}`)}
              ${row("Source trust", `${sourceTrust.status ?? "n/a"} / trusted=${sourceTrust.trusted_scoring_source_count ?? 0} / sample_gate=${sourceTrust.sample_gate_source_count ?? 0} / p0_pending=${sourceTrust.p0_pending_count ?? 0} / scoring=${sourceTrust.scoring_allowed_now ? "allowed" : "blocked"}`)}
              ${row("Weekly schedule", `${schedule.local_persistent_schedule ? "active" : "not active"} / cadence=${schedule.cadence ?? "n/a"} / runner=${schedule.local_runner_command ?? "n/a"} / launchd=${schedule.launchd_installed ? "installed" : "not installed"} / external=${schedule.external_effect ? "yes" : "no"}`)}
              ${row("Catch-up status", `${scheduleCatchup.status ?? "n/a"} / required=${scheduleCatchup.catchup_required ? "yes" : "no"} / latest=${scheduleCatchup.latest_expected_run?.taipei ?? "n/a"} / action=${scheduleCatchup.next_safe_action ?? "n/a"} / external=${scheduleCatchup.external_effect ? "yes" : "no"}`)}
              ${row("LaunchAgent", `${launchAgent.service_loaded ? "loaded" : "not loaded"} / label=${launchAgent.label ?? "n/a"} / file=${launchAgent.file_installed ? "yes" : "no"} / runs=${launchAgentRuntime.run_count ?? "n/a"} / last_exit=${launchAgentRuntime.last_exit_code ?? "n/a"} / successful_run=${launchAgentRuntime.observed_successful_run ? "yes" : "no"} / current_launchd_invocation=${launchAgentRuntime.current_launchd_invocation_observed ? "yes" : "no"} / proof=${launchAgentRuntime.proof_kind ?? "none"} / rollback=${launchAgent.rollback_command ?? "n/a"} / external=${launchAgent.external_effect ? "yes" : "no"}`)}
              ${row("Gate evidence", `${ownerEvidence.ok ? "ok" : "blocked"} / status=${ownerEvidence.status ?? "n/a"} / input=${ownerEvidence.input_exists ? "present" : "missing"} / ready=${ownerEvidence.ready_gate_count ?? 0}/${ownerEvidence.non_manual_gate_count ?? 0} / issues=${ownerEvidence.issue_count ?? 0} / executed=${ownerEvidence.execution_performed ? "yes" : "no"}`)}
              ${row("Evidence guard", `${ownerEvidenceFixtures.ok ? "ok" : "not ready"} / scenarios=${ownerEvidenceFixtures.scenario_count ?? 0} / executed=${ownerEvidenceFixtures.execution_performed ? "yes" : "no"} / external=${ownerEvidenceFixtures.external_effect ? "yes" : "no"}`)}
              ${row("Post-gate verify", `${postGate.ok ? "ok" : "blocked"} / status=${postGate.status ?? "n/a"} / ready=${postGate.ready_gate_count ?? 0}/${postGate.non_manual_gate_count ?? 0} / network=${postGate.no_network_read_performed ? "no" : "attention"} / remote_cli=${postGate.no_remote_cli_performed ? "no" : "attention"} / executed=${postGate.execution_performed ? "yes" : "no"}`)}
              ${row("Post-gate guard", `${postGateFixtures.ok ? "ok" : "not ready"} / scenarios=${postGateFixtures.scenario_count ?? 0} / network=${postGateFixtures.scenarios?.every((scenario) => scenario.no_network_read_performed) ? "no" : "attention"} / remote_cli=${postGateFixtures.scenarios?.every((scenario) => scenario.no_remote_cli_performed) ? "no" : "attention"} / executed=${postGateFixtures.execution_performed ? "yes" : "no"} / external=${postGateFixtures.external_effect ? "yes" : "no"}`)}
              ${row("Gate readiness", `${gateReadiness.ok ? "ok" : "not ready"} / status=${gateReadiness.status ?? "n/a"} / ready=${gateReadiness.ready_gate_count ?? 0}/${gateReadiness.gate_count ?? 0} / autorun=${gateReadiness.no_autorun_for_external_gates ? "no" : "attention"} / executed=${gateReadiness.execution_performed ? "yes" : "no"}`)}
              ${row("Red-line priority", `${redlinePriority.ok ? "ok" : "not ready"} / status=${redlinePriority.status ?? "n/a"} / actions=${redlinePriority.action_count ?? 0} / covered=${redlinePriority.redline_queue_covered ? "yes" : "no"} / autorun=${redlinePriority.no_autorun_for_external_gates ? "no" : "attention"} / external=${redlinePriority.external_effect ? "yes" : "no"}`)}
              ${row("PreparedButBlocked handoff", `${preparedButBlockedReport.ok ? "ok" : "not ready"} / status=${preparedButBlockedReport.status ?? "n/a"} / blocked=${preparedButBlockedReport.blocked_item_count ?? 0} / pending=${preparedButBlockedReport.pending_human_approval_count ?? 0} / covered=${preparedButBlockedReport.redline_queue_covered ? "yes" : "no"} / autorun=${preparedButBlockedReport.no_autorun_for_external_gates ? "no" : "attention"} / external=${preparedButBlockedReport.external_effect ? "yes" : "no"}`)}
              ${row("Gate metadata", `${gateMetadataActions.length} plan-only / external=${gateMetadataActions.some((action) => action.external_effect || action.execution_performed) ? "attention" : "no"} / order_enforced=${gateMetadataActions.every((action) => action.execution_order_still_enforced) ? "yes" : "attention"}`)}
              ${row("Public A/B metadata", publicAbMetadataAction ? `fields=${(publicAbMetadataAction.fields_needing_input ?? []).join(", ") || "none"} / blockers=${(publicAbMetadataAction.blocking_dependencies ?? []).join(", ") || "none"}` : "public_ab_small_traffic_link not listed")}
              ${row("GitHub workflow guard", `${githubWorkflowGuard.ok ? "ok" : "not ready"} / checks=${githubWorkflowGuard.check_count ?? 0} / failed=${githubWorkflowGuard.failed_check_count ?? 0} / read_only=${githubWorkflowGuard.workflow_uses_read_only_permissions ? "yes" : "no"} / macos_readback=${githubWorkflowGuard.workflow_avoids_macos_launchagent_readback ? "blocked" : "attention"} / external=${githubWorkflowGuard.external_effect ? "yes" : "no"}`)}
              ${row("GitHub bundle", `${githubExport.ok ? "ok" : "not ready"} / files=${githubExport.file_count ?? 0} / git_init=${githubExport.git_init_performed ? "yes" : "no"} / push_pr=${githubExport.github_push_or_pr_performed ? "yes" : "no"} / manifest=${githubExport.manifest_path ?? "n/a"}`)}
              ${row("Artifact retention", `${artifactRetention.ok ? "ok" : "not ready"} / status=${artifactRetention.status ?? "n/a"} / total=${artifactRetention.total_human ?? "n/a"} / warnings=${artifactRetention.warning_count ?? 0} / candidates=${artifactRetention.cleanup_candidate_count ?? 0} / cleanup=${artifactRetention.cleanup_command_executed ? "yes" : "no"} / delete=${artifactRetention.delete_action_performed ? "yes" : "no"} / external=${artifactRetention.external_effect ? "yes" : "no"}`)}
              ${row("Retention review", `${artifactRetentionReview.ok ? "ok" : "not ready"} / status=${artifactRetentionReview.status ?? "n/a"} / review=${artifactRetentionReview.review_required ? "yes" : "no"} / candidates=${artifactRetentionReview.cleanup_candidate_count ?? 0} / section=${artifactRetentionReview.highest_priority_section_id ?? "n/a"} / command=${artifactRetentionReview.cleanup_command_generated ? "yes" : "no"} / cleanup=${artifactRetentionReview.cleanup_command_executed ? "yes" : "no"} / delete=${artifactRetentionReview.delete_action_performed ? "yes" : "no"} / external=${artifactRetentionReview.external_effect ? "yes" : "no"}`)}
              ${row("Iteration history", `${iterationHistory.ok ? "ok" : "not ready"} / status=${iterationHistory.status ?? "n/a"} / archives=${iterationHistory.archive_summary?.archives_scanned ?? 0} / actions=${(iterationHistory.next_safe_actions ?? []).length} / external=${iterationHistory.external_effect ? "yes" : "no"}`)}
              ${row("Approval fixtures", `${approvalFixtures.ok ? "ok" : "not ready"} / scenarios=${approvalFixtures.scenario_count ?? 0}`)}
              ${row("Approval form", `${ownerApprovalForm.ok ? "ok" : "not ready"} / status=${ownerApprovalForm.status ?? "n/a"} / gates=${ownerApprovalForm.form_gate_count ?? 0} / manual_excluded=${ownerApprovalForm.excluded_manual_gate_count ?? 0} / browser_only=${ownerApprovalForm.browser_only ? "yes" : "no"} / network=${ownerApprovalForm.network_calls_performed ? "yes" : "no"} / live_created=${ownerApprovalForm.live_input_files_created ? "yes" : "no"} / approval_write=${ownerApprovalForm.approval_input_write_performed ? "yes" : "no"} / external=${ownerApprovalForm.external_effect ? "yes" : "no"}`)}
              ${row("Approval form guard", `${ownerApprovalFormFixtures.ok ? "ok" : "not ready"} / scenarios=${ownerApprovalFormFixtures.scenario_count ?? 0} / form_replay=${ownerApprovalFormFixtures.form_export_replay_executed ? "yes" : "no"} / live_created=${ownerApprovalFormFixtures.live_input_files_created ? "yes" : "no"} / approval_write=${ownerApprovalFormFixtures.approval_input_write_performed ? "yes" : "no"} / external=${ownerApprovalFormFixtures.external_effect ? "yes" : "no"}`)}
              ${row("LINE inbound", `${lineInbound.ok ? "ok" : "not ready"} / scenarios=${lineInbound.scenario_count ?? 0}`)}
              ${row("Manual publish packet", `${manualPublishPacket.ok ? "ok" : "not ready"} / status=${manualPublishPacket.status ?? "n/a"} / packets=${manualPublishPacket.packet_count ?? 0} / post=${manualPublishPacket.formal_post_performed ? "yes" : "no"} / line_push=${manualPublishPacket.line_push_performed ? "yes" : "no"} / external=${manualPublishPacket.external_effect ? "yes" : "no"}`)}
              ${row("Manual capture plan", `${manualPublishCapturePlan.ok ? "ok" : "not ready"} / status=${manualPublishCapturePlan.status ?? "n/a"} / packets=${manualPublishCapturePlan.packet_count ?? 0} / sample_rows=${manualPublishCapturePlan.sample_gate_row_count ?? 0} / north_rows=${manualPublishCapturePlan.north_star_capture_row_count ?? 0} / data_write=${manualPublishCapturePlan.data_lp_events_write_performed ? "yes" : "no"} / external=${manualPublishCapturePlan.external_effect ? "yes" : "no"}`)}
              ${row("Manual publish brief", `${manualPublishBrief.ok ? "ok" : "not ready"} / status=${manualPublishBrief.status ?? "n/a"} / selected=${manualPublishBrief.selected_packet_id ?? "n/a"} / public_url=${manualPublishBrief.tracking_url_public_ready ? "yes" : "no"} / formal_ready=${manualPublishBrief.formal_publish_ready ? "yes" : "no"} / post=${manualPublishBrief.formal_post_performed ? "yes" : "no"} / external=${manualPublishBrief.external_effect ? "yes" : "no"}`)}
              ${row("Public tracking URL pack", `${publicTrackingUrlPack.ok ? "ok" : "not ready"} / status=${publicTrackingUrlPack.status ?? "n/a"} / selected=${publicTrackingUrlPack.selected_link_id ?? "n/a"} / previews=${publicTrackingUrlPack.preview_count ?? 0} / ready=${publicTrackingUrlPack.public_tracking_url_ready ? "yes" : "no"} / formal_ready=${publicTrackingUrlPack.formal_publish_ready ? "yes" : "no"} / external=${publicTrackingUrlPack.external_effect ? "yes" : "no"}`)}
              ${row("Public URL approval preview", `${ownerPublicUrlApprovalPreview.ok ? "ok" : "not ready"} / status=${ownerPublicUrlApprovalPreview.status ?? "n/a"} / gates=${ownerPublicUrlApprovalPreview.required_gate_count ?? 0} / fields=${ownerPublicUrlApprovalPreview.required_field_count ?? 0} / live_created=${ownerPublicUrlApprovalPreview.live_input_files_created ? "yes" : "no"} / approval_write=${ownerPublicUrlApprovalPreview.owner_approval_input_write_performed ? "yes" : "no"} / external=${ownerPublicUrlApprovalPreview.external_effect ? "yes" : "no"}`)}
              ${row("Manual publish evidence", `${manualPublishEvidence.ok ? "ok" : "blocked"} / status=${manualPublishEvidence.status ?? "n/a"} / input=${manualPublishEvidence.input_exists ? "present" : "missing"} / active=${manualPublishEvidence.active_packet_id ?? "none"} / day3=${manualPublishEvidence.day_3_capture_date ?? "n/a"} / day7=${manualPublishEvidence.day_7_capture_date ?? "n/a"} / data_write=${manualPublishEvidence.data_lp_events_write_performed ? "yes" : "no"} / external=${manualPublishEvidence.external_effect ? "yes" : "no"}`)}
              ${row("Manual publish evidence form", `${manualPublishEvidenceForm.ok ? "ok" : "not ready"} / status=${manualPublishEvidenceForm.status ?? "n/a"} / packets=${manualPublishEvidenceForm.packet_count ?? 0} / browser_only=${manualPublishEvidenceForm.browser_only ? "yes" : "no"} / persistence=${manualPublishEvidenceForm.browser_persistence ? "yes" : "no"} / network=${manualPublishEvidenceForm.network_calls_performed ? "yes" : "no"} / url_fetch=${manualPublishEvidenceForm.post_url_fetch_performed ? "yes" : "no"} / live_created=${manualPublishEvidenceForm.live_input_files_created ? "yes" : "no"} / external=${manualPublishEvidenceForm.external_effect ? "yes" : "no"}`)}
              ${row("Manual publish evidence form guard", `${manualPublishEvidenceFormFixtures.ok ? "ok" : "not ready"} / scenarios=${manualPublishEvidenceFormFixtures.scenario_count ?? 0} / form_replay=${manualPublishEvidenceFormFixtures.form_export_replay_executed ? "yes" : "no"} / data_write=${manualPublishEvidenceFormFixtures.data_lp_events_write_performed ? "yes" : "no"} / external=${manualPublishEvidenceFormFixtures.external_effect ? "yes" : "no"}`)}
              ${row("Manual publish evidence guard", `${manualPublishEvidenceFixtures.ok ? "ok" : "not ready"} / scenarios=${manualPublishEvidenceFixtures.scenario_count ?? 0} / data_write=${manualPublishEvidenceFixtures.data_lp_events_write_performed ? "yes" : "no"} / external=${manualPublishEvidenceFixtures.external_effect ? "yes" : "no"}`)}
              ${row("North Star", `${northStar.ok ? "ok" : "not ready"} / mode=${northStar.mode ?? "n/a"} / clicks=${northStar.totals?.link_clicks ?? 0} / line_per_100=${per100Display(northStar.totals?.line_adds_per_100_clicks)} / sample_met=${northStar.sample_threshold_met ? "yes" : "no"} / data_write=${northStar.data_lp_events_write_performed ? "yes" : "no"} / external=${northStar.external_effect ? "yes" : "no"}`)}
              ${row("Funnel breakdown", `${funnelBreakdown.mode ?? "n/a"} / rows=${funnelBreakdown.summary?.rows ?? 0}`)}
              ${row("Funnel aggregate", `${funnelAggregate.mode ?? "n/a"} / events=${funnelAggregate.events_written ?? 0} / data_write=${funnelAggregate.data_lp_events_write_performed ? "yes" : "no"}`)}
              ${row("Funnel guard", `${funnelAggregateFixtures.ok ? "ok" : "not ready"} / scenarios=${funnelAggregateFixtures.scenario_count ?? 0} / data_write=${funnelAggregateFixtures.data_lp_events_write_performed ? "yes" : "no"}`)}
              ${row("Apply guard", `${realDataApplyFixtures.ok ? "ok" : "not ready"} / scenarios=${realDataApplyFixtures.scenario_count ?? 0} / data_write=${realDataApplyFixtures.data_lp_events_write_performed ? "yes" : "no"}`)}
              ${row("Decision replay", `${decisionReplay.ok ? "ok" : "not ready"} / scenarios=${decisionReplay.scenario_count ?? 0} / ledger=${decisionReplay.source_capture_ledger_replay_executed ? "yes" : "no"} / compile=${decisionReplay.source_capture_compile_commands_executed ? "yes" : "no"} / importer_previews=${decisionReplay.local_importer_preview_commands_executed ? "yes" : "no"} / data_write=${decisionReplay.data_lp_events_write_performed ? "yes" : "no"} / external=${decisionReplay.external_effect ? "yes" : "no"}`)}
              ${row("Sample replay", `${sampleGateReplay.ok ? "ok" : "not ready"} / scenarios=${sampleGateReplay.scenario_count ?? 0} / ledger=${sampleGateReplay.sample_gate_ledger_replay_executed ? "yes" : "no"} / compile=${sampleGateReplay.source_capture_compile_commands_executed ? "yes" : "no"} / data_write=${sampleGateReplay.data_lp_events_write_performed ? "yes" : "no"} / external=${sampleGateReplay.external_effect ? "yes" : "no"}`)}
              ${row("Input pack", `${realDataInputPack.ok ? "ok" : "not ready"} / status=${realDataInputPack.status ?? "n/a"} / templates=${(realDataInputPack.templates ?? []).length} / live_created=${realDataInputPack.live_input_files_created ? "yes" : "no"} / data_write=${realDataInputPack.data_lp_events_write_performed ? "yes" : "no"}`)}
              ${row("Source readiness", `${sourceReadiness.ok ? "ok" : "not ready"} / status=${sourceReadiness.status ?? "n/a"} / missing=${sourceReadiness.missing_stage_count ?? 0} / public_ready=${sourceReadiness.ready_for_public_iteration_decision ? "yes" : "no"} / data_write=${sourceReadiness.data_lp_events_write_performed ? "yes" : "no"}`)}
              ${row("Source capture", `${sourceCapture.ok ? "ok" : "not ready"} / status=${sourceCapture.status ?? "n/a"} / rows=${sourceCapture.ledger_rows ?? 0} / live_created=${sourceCapture.live_input_files_created ? "yes" : "no"} / data_write=${sourceCapture.data_lp_events_write_performed ? "yes" : "no"}`)}
              ${row("Source compile", `${sourceCompile.ok ? "ok" : "not ready"} / status=${sourceCompile.status ?? "n/a"} / filled=${sourceCompile.filled_rows ?? 0} / preview_rows=${(sourceCompile.funnel_rows ?? 0) + (sourceCompile.manual_rows ?? 0)} / live_created=${sourceCompile.live_input_files_created ? "yes" : "no"} / data_write=${sourceCompile.data_lp_events_write_performed ? "yes" : "no"}`)}
              ${row("Compile guard", `${sourceCompileFixtures.ok ? "ok" : "not ready"} / scenarios=${sourceCompileFixtures.scenario_count ?? 0} / data_write=${sourceCompileFixtures.data_lp_events_write_performed ? "yes" : "no"}`)}
              ${row("Intake plan", `${realDataIntake.ok ? "ok" : "not ready"} / status=${realDataIntake.status ?? "n/a"} / ready_apply=${realDataIntake.ready_apply_count ?? 0} / missing=${realDataIntake.missing_input_count ?? 0} / data_write=${realDataIntake.data_lp_events_write_performed ? "yes" : "no"}`)}
              ${row("Data queue", `${dataCollectionStatus.ok ? "ok" : "not ready"} / status=${dataCollection.status ?? "n/a"} / tasks=${dataCollection.task_count ?? 0} / filled_ledger=${dataCollection.filled_ledger_exists ? "yes" : "no"} / data_write=${dataCollection.data_lp_events_write_performed ? "yes" : "no"}`)}
              ${row("Next P0 inputs", `${nextP0OwnerInputs.ok ? "ok" : "not ready"} / status=${nextP0OwnerInputs.status ?? "n/a"} / current_inputs=${nextP0OwnerInputs.current_input_count ?? 0} / p0_pending=${nextP0OwnerInputs.p0_pending_count ?? 0} / data_write=${nextP0OwnerInputs.data_lp_events_write_performed ? "yes" : "no"} / external=${nextP0OwnerInputs.external_effect ? "yes" : "no"}`)}
              ${row("Next P0 quick", `${nextP0QuickCapture.ok ? "ok" : "not ready"} / status=${nextP0QuickCapture.status ?? "n/a"} / counts=${nextP0QuickCapture.quick_count_count ?? 0}/${nextP0QuickCapture.expected_row_count ?? 0} / filled=${nextP0QuickCapture.filled_rank_count ?? 0}/${nextP0QuickCapture.expected_row_count ?? 0} / missing=${nextP0QuickCapture.missing_rank_count ?? 0} / missing_ranks=${(nextP0QuickCapture.missing_ranks ?? []).join(",") || "none"} / partial=${nextP0QuickCapture.partial_waiting ? "yes" : "no"} / paste_template=${nextP0QuickCapture.paste_template_created ? "yes" : "no"} / preview=${nextP0QuickCapture.filled_preview_created ? "yes" : "no"} / inbox=${nextP0QuickCapture.owner_inbox_write_performed ? "yes" : "no"} / data_write=${nextP0QuickCapture.data_lp_events_write_performed ? "yes" : "no"} / external=${nextP0QuickCapture.external_effect ? "yes" : "no"}`)}
              ${row("Quick guard", `${nextP0QuickCaptureFixtures.ok ? "ok" : "not ready"} / scenarios=${nextP0QuickCaptureFixtures.scenario_count ?? 0} / inbox=${nextP0QuickCaptureFixtures.owner_inbox_write_performed ? "yes" : "no"} / stage=${nextP0QuickCaptureFixtures.stage_performed ? "yes" : "no"} / data_write=${nextP0QuickCaptureFixtures.data_lp_events_write_performed ? "yes" : "no"} / external=${nextP0QuickCaptureFixtures.external_effect ? "yes" : "no"}`)}
              ${row("P0 counts preflight", `${p0CountsPreflight.ok ? "ok" : "not ready"} / status=${p0CountsPreflight.status ?? "n/a"} / ready=${p0CountsPreflight.ready_for_quick_preview ? "yes" : "no"} / filled=${p0CountsPreflight.filled_count_key_count ?? 0}/${p0CountsPreflight.expected_count_key_count ?? 0} / placeholders=${p0CountsPreflight.placeholder_count_key_count ?? 0} / invalid=${p0CountsPreflight.invalid_count_key_count ?? 0} / issues=${p0CountsPreflight.issue_count ?? 0} / data_write=${p0CountsPreflight.data_lp_events_write_performed ? "yes" : "no"} / external=${p0CountsPreflight.external_effect ? "yes" : "no"}`)}
              ${row("P0 preflight guard", `${p0CountsPreflightFixtures.ok ? "ok" : "not ready"} / scenarios=${p0CountsPreflightFixtures.scenario_count ?? 0} / data_write=${p0CountsPreflightFixtures.data_lp_events_write_performed ? "yes" : "no"} / external=${p0CountsPreflightFixtures.external_effect ? "yes" : "no"}`)}
              ${row("Next P0 intake", `${nextP0OwnerIntake.ok ? "ok" : "not ready"} / status=${nextP0OwnerIntake.status ?? "n/a"} / found=${nextP0OwnerIntake.candidate_found ? "yes" : "no"} / valid=${nextP0OwnerIntake.candidate_valid ? "yes" : "no"} / preview=${(nextP0OwnerIntake.funnel_preview_rows ?? 0) + (nextP0OwnerIntake.manual_preview_rows ?? 0)} / staged=${nextP0OwnerIntake.stage_performed ? "yes" : "no"} / live_created=${nextP0OwnerIntake.live_input_files_created ? "yes" : "no"} / data_write=${nextP0OwnerIntake.data_lp_events_write_performed ? "yes" : "no"} / external=${nextP0OwnerIntake.external_effect ? "yes" : "no"}`)}
              ${row("Owner data preflight", `${ownerDataPreflight.ok ? "ok" : "not ready"} / status=${ownerDataPreflight.status ?? "n/a"} / source=${ownerDataPreflight.selected_source_id ?? "n/a"} / rows=${ownerDataPreflight.selected_source_row_count ?? 0} / sample_met=${ownerDataPreflight.sample_threshold_met ? "yes" : "no"} / win=${ownerDataPreflight.challenger_win_rule_met ? "yes" : "no"} / data_write=${ownerDataPreflight.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerDataPreflight.external_effect ? "yes" : "no"}`)}
              ${row("Capture calendar", `${sampleGateCaptureCalendar.ok ? "ok" : "not ready"} / status=${sampleGateCaptureCalendar.status ?? "n/a"} / events=${sampleGateCaptureCalendar.event_count ?? 0} / next=${sampleGateCaptureCalendar.next_due_date ?? "n/a"} / import=${sampleGateCaptureCalendar.calendar_import_performed ? "yes" : "no"} / reminder=${sampleGateCaptureCalendar.system_reminder_created ? "yes" : "no"} / external=${sampleGateCaptureCalendar.external_effect ? "yes" : "no"}`)}
              ${row("Due status", `${sampleGateDueStatus.ok ? "ok" : "not ready"} / status=${sampleGateDueStatus.status ?? "n/a"} / phase=${sampleGateDueStatus.due_phase ?? "n/a"} / due_now=${sampleGateDueStatus.due_now ? "yes" : "no"} / date=${sampleGateDueStatus.due_date ?? "n/a"} / champion=${sampleGateDueStatus.champion_action ?? "n/a"} / external=${sampleGateDueStatus.external_effect ? "yes" : "no"}`)}
              ${row("Due guard", `${sampleGateDueFixtures.ok ? "ok" : "not ready"} / scenarios=${sampleGateDueFixtures.scenario_count ?? 0} / project_overwrite=${sampleGateDueFixtures.project_due_status_write_performed ? "yes" : "no"} / data_write=${sampleGateDueFixtures.data_lp_events_write_performed ? "yes" : "no"} / external=${sampleGateDueFixtures.external_effect ? "yes" : "no"}`)}
              ${row("Owner capture", `${ownerCaptureQueue.ok ? "ok" : "not ready"} / status=${ownerCaptureQueue.status ?? "n/a"} / p0=${ownerCaptureQueue.p0_task_count ?? 0} / links=${ownerCaptureQueue.p0_link_count ?? 0} / source_groups=${ownerCaptureQueue.source_group_count ?? 0} / data_write=${ownerCaptureQueue.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerCaptureQueue.external_effect ? "yes" : "no"}`)}
              ${row("Owner sample gate", `${ownerSampleGate.ok ? "ok" : "not ready"} / status=${ownerSampleGate.status ?? "n/a"} / filled=${ownerSampleGate.filled_rows ?? 0} / pending=${ownerSampleGate.pending_rows ?? 0} / sample_met=${ownerSampleGate.sample_threshold_met ? "yes" : "no"} / quality=${ownerSampleGate.quality_guard_status ?? "n/a"} / promoted=${ownerSampleGate.promotion_performed ? "yes" : "no"} / data_write=${ownerSampleGate.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerSampleGate.external_effect ? "yes" : "no"}`)}
              ${row("Sample worksheet", `${sampleGateOwnerWorksheet.ok ? "ok" : "not ready"} / status=${sampleGateOwnerWorksheet.status ?? "n/a"} / rows=${sampleGateOwnerWorksheet.row_count ?? 0} / links=${sampleGateOwnerWorksheet.link_count ?? 0} / filled=${sampleGateOwnerWorksheet.owner_filled_exists ? "yes" : "no"} / live_created=${sampleGateOwnerWorksheet.live_input_files_created ? "yes" : "no"} / data_write=${sampleGateOwnerWorksheet.data_lp_events_write_performed ? "yes" : "no"} / external=${sampleGateOwnerWorksheet.external_effect ? "yes" : "no"}`)}
              ${row("Sample form", `${sampleGateOwnerForm.ok ? "ok" : "not ready"} / status=${sampleGateOwnerForm.status ?? "n/a"} / rows=${sampleGateOwnerForm.row_count ?? 0} / browser_only=${sampleGateOwnerForm.browser_only ? "yes" : "no"} / persistence=${sampleGateOwnerForm.browser_persistence ? "yes" : "no"} / network=${sampleGateOwnerForm.network_calls_performed ? "yes" : "no"} / data_write=${sampleGateOwnerForm.data_lp_events_write_performed ? "yes" : "no"} / external=${sampleGateOwnerForm.external_effect ? "yes" : "no"}`)}
              ${row("Sample form guard", `${sampleGateOwnerFormFixtures.ok ? "ok" : "not ready"} / scenarios=${sampleGateOwnerFormFixtures.scenario_count ?? 0} / form_replay=${sampleGateOwnerFormFixtures.form_export_replay_executed ? "yes" : "no"} / compile=${sampleGateOwnerFormFixtures.source_capture_compile_commands_executed ? "yes" : "no"} / sample_gate=${sampleGateOwnerFormFixtures.owner_sample_gate_commands_executed ? "yes" : "no"} / data_write=${sampleGateOwnerFormFixtures.data_lp_events_write_performed ? "yes" : "no"} / external=${sampleGateOwnerFormFixtures.external_effect ? "yes" : "no"}`)}
              ${row("Sample intake", `${ownerSampleGateIntake.ok ? "ok" : "not ready"} / status=${ownerSampleGateIntake.status ?? "n/a"} / found=${ownerSampleGateIntake.candidate_found ? "yes" : "no"} / valid=${ownerSampleGateIntake.candidate_valid ? "yes" : "no"} / filled=${ownerSampleGateIntake.filled_rows ?? 0} / pending=${ownerSampleGateIntake.pending_rows ?? "n/a"} / staged=${ownerSampleGateIntake.stage_performed ? "yes" : "no"} / live_created=${ownerSampleGateIntake.live_input_files_created ? "yes" : "no"} / data_write=${ownerSampleGateIntake.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerSampleGateIntake.external_effect ? "yes" : "no"}`)}
              ${row("Intake guard", `${ownerSampleGateIntakeFixtures.ok ? "ok" : "not ready"} / scenarios=${ownerSampleGateIntakeFixtures.scenario_count ?? 0} / commands=${ownerSampleGateIntakeFixtures.owner_sample_gate_intake_commands_executed ? "yes" : "no"} / compile=${ownerSampleGateIntakeFixtures.source_capture_compile_commands_executed ? "yes" : "no"} / sample_gate=${ownerSampleGateIntakeFixtures.owner_sample_gate_commands_executed ? "yes" : "no"} / data_write=${ownerSampleGateIntakeFixtures.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerSampleGateIntakeFixtures.external_effect ? "yes" : "no"}`)}
              ${row("Next action", `${ownerNextAction.ok ? "ok" : "not ready"} / primary=${ownerNextAction.primary_action_id ?? "n/a"} / status=${ownerNextAction.status ?? "n/a"} / trust=${ownerNextAction.source_trust_status ?? "n/a"} / trusted=${ownerNextAction.source_trust_trusted_scoring_source_count ?? 0} / sample_gate=${ownerNextAction.source_trust_sample_gate_source_count ?? 0} / scoring=${ownerNextAction.source_trust_scoring_allowed_now ? "yes" : "no"} / sample_met=${ownerNextAction.sample_threshold_met ? "yes" : "no"} / rate_win=${ownerNextAction.sample_rate_win_candidate ? "yes" : "no"} / owner_review=${ownerNextAction.owner_review_required ? "yes" : "no"} / external=${ownerNextAction.external_effect ? "yes" : "no"}`)}
              ${row("Outcome preflight", `${northStarOutcomePreflight.ok ? "ok" : "not ready"} / status=${northStarOutcomePreflight.status ?? "n/a"} / filled=${northStarOutcomePreflight.filled_outcome_row_count ?? 0}/${northStarOutcomePreflight.expected_outcome_row_count ?? 0} / pending=${northStarOutcomePreflight.pending_outcome_row_count ?? 0} / ready_compile=${northStarOutcomePreflight.ready_for_source_compile ? "yes" : "no"} / data_write=${northStarOutcomePreflight.data_lp_events_write_performed ? "yes" : "no"} / external=${northStarOutcomePreflight.external_effect ? "yes" : "no"}`)}
              ${row("Outcome form", `${northStarOutcomeForm.ok ? "ok" : "not ready"} / status=${northStarOutcomeForm.status ?? "n/a"} / rows=${northStarOutcomeForm.row_count ?? 0} / browser_only=${northStarOutcomeForm.browser_only ? "yes" : "no"} / persistence=${northStarOutcomeForm.browser_persistence ? "yes" : "no"} / network=${northStarOutcomeForm.network_calls_performed ? "yes" : "no"} / data_write=${northStarOutcomeForm.data_lp_events_write_performed ? "yes" : "no"} / external=${northStarOutcomeForm.external_effect ? "yes" : "no"}`)}
              ${row("Outcome form guard", `${northStarOutcomeFormFixtures.ok ? "ok" : "not ready"} / checks=${northStarOutcomeFormFixtures.check_count ?? 0} / static=${northStarOutcomeFormFixtures.browser_form_static_checks_executed ? "yes" : "no"} / data_write=${northStarOutcomeFormFixtures.data_lp_events_write_performed ? "yes" : "no"} / external=${northStarOutcomeFormFixtures.external_effect ? "yes" : "no"}`)}
              ${row("P1 outcome intake", `${ownerP1OutcomeIntake.ok ? "ok" : "not ready"} / status=${ownerP1OutcomeIntake.status ?? "n/a"} / candidate=${ownerP1OutcomeIntake.candidate_found ? "yes" : "no"} / valid=${ownerP1OutcomeIntake.candidate_valid ? "yes" : "no"} / filled=${ownerP1OutcomeIntake.filled_outcome_row_count ?? 0}/${ownerP1OutcomeIntake.expected_outcome_row_count ?? 0} / pending=${ownerP1OutcomeIntake.pending_outcome_row_count ?? 0} / staged=${ownerP1OutcomeIntake.stage_performed ? "yes" : "no"} / data_write=${ownerP1OutcomeIntake.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerP1OutcomeIntake.external_effect ? "yes" : "no"}`)}
              ${row("P1 intake guard", `${ownerP1OutcomeIntakeFixtures.ok ? "ok" : "not ready"} / scenarios=${ownerP1OutcomeIntakeFixtures.scenario_count ?? 0} / data_write=${ownerP1OutcomeIntakeFixtures.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerP1OutcomeIntakeFixtures.external_effect ? "yes" : "no"}`)}
              ${row("P1 outcome post-fill", `${ownerP1OutcomePostfillCheck.ok ? "ok" : "not ready"} / status=${ownerP1OutcomePostfillCheck.status ?? "n/a"} / stage=${ownerP1OutcomePostfillCheck.current_stage ?? "n/a"} / ready=${ownerP1OutcomePostfillCheck.postfill_ready ? "yes" : "no"} / trust=${ownerP1OutcomePostfillCheck.source_trust_status ?? "n/a"} / trusted=${ownerP1OutcomePostfillCheck.source_trust_trusted_scoring_source_count ?? 0} / scoring=${ownerP1OutcomePostfillCheck.source_trust_scoring_allowed_now ? "yes" : "no"} / commands=${ownerP1OutcomePostfillCheck.safe_command_count ?? 0} / local_only=${ownerP1OutcomePostfillCheck.command_runs_local_scripts_only ? "yes" : "no"} / data_write=${ownerP1OutcomePostfillCheck.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerP1OutcomePostfillCheck.external_effect ? "yes" : "no"}`)}
              ${row("Recovery pack", `${sampleGateRecovery.ok ? "ok" : "not ready"} / status=${sampleGateRecovery.status ?? "n/a"} / due=${sampleGateRecovery.due_now ? "yes" : "no"} / missing=${sampleGateRecovery.missing_rank_count ?? 0}/${sampleGateRecovery.p0_input_count ?? 0} / commands=${sampleGateRecovery.command_count ?? 0} / data_write=${sampleGateRecovery.data_lp_events_write_performed ? "yes" : "no"} / external=${sampleGateRecovery.external_effect ? "yes" : "no"}`)}
              ${row("P0 batch handoff", `${sampleGateBatchHandoff.ok ? "ok" : "not ready"} / status=${sampleGateBatchHandoff.status ?? "n/a"} / rows=${sampleGateBatchHandoff.all_p0_row_count ?? 0}/${sampleGateBatchHandoff.p0_task_count ?? 0} / batches=${sampleGateBatchHandoff.batch_count ?? 0} / focused=${sampleGateBatchHandoff.focused_batch_row_count ?? 0} / remaining=${sampleGateBatchHandoff.remaining_batch_row_count ?? 0} / full=${sampleGateBatchHandoff.full_coverage_ready ? "yes" : "no"} / data_write=${sampleGateBatchHandoff.data_lp_events_write_performed ? "yes" : "no"} / external=${sampleGateBatchHandoff.external_effect ? "yes" : "no"}`)}
              ${row("P0 batch preflight", `${sampleGateBatchPreflight.ok ? "ok" : "not ready"} / status=${sampleGateBatchPreflight.status ?? "n/a"} / input=${sampleGateBatchPreflight.input_kind ?? "n/a"} / filled=${sampleGateBatchPreflight.filled_p0_row_count ?? 0}/${sampleGateBatchPreflight.expected_p0_row_count ?? 0} / pending=${sampleGateBatchPreflight.pending_p0_row_count ?? 0} / invalid=${sampleGateBatchPreflight.invalid_p0_row_count ?? 0} / ready_compile=${sampleGateBatchPreflight.ready_for_source_compile ? "yes" : "no"} / data_write=${sampleGateBatchPreflight.data_lp_events_write_performed ? "yes" : "no"} / external=${sampleGateBatchPreflight.external_effect ? "yes" : "no"}`)}
              ${row("Sample count handoff", `${ownerSampleCountHandoff.ok ? "ok" : "not ready"} / status=${ownerSampleCountHandoff.status ?? "n/a"} / due=${ownerSampleCountHandoff.due_now ? "yes" : "no"} / focused_missing=${ownerSampleCountHandoff.missing_count ?? 0}/${ownerSampleCountHandoff.p0_input_count ?? 0} / full_p0=${ownerSampleCountHandoff.full_p0_row_count ?? 0}/${ownerSampleCountHandoff.full_p0_task_count ?? 0} / remaining=${ownerSampleCountHandoff.full_p0_remaining_batch_row_count ?? 0} / commands=${ownerSampleCountHandoff.after_fill_command_count ?? 0} / data_write=${ownerSampleCountHandoff.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerSampleCountHandoff.external_effect ? "yes" : "no"}`)}
              ${row("P0 now", `${ownerP0Now.ok ? "ok" : "not ready"} / status=${ownerP0Now.status ?? "n/a"} / focused=${ownerP0Now.p0_focused_missing_count ?? 0}/${ownerP0Now.p0_focused_total_count ?? 0} / full=${ownerP0Now.p0_full_row_count ?? 0}/${ownerP0Now.p0_full_task_count ?? 0} / batch2=${ownerP0Now.p0_batch_2_row_count ?? 0} / quick_missing=${ownerP0Now.quick_missing_rank_count ?? 0} / open_targets=${ownerP0Now.primary_open_target_count ?? 0} / next=${ownerP0Now.approval_queue_next_pending_human_id ?? "n/a"} / data_write=${ownerP0Now.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerP0Now.external_effect ? "yes" : "no"}`)}
              ${row("Collection sprint", `${sampleGateCollectionSprint.ok ? "ok" : "not ready"} / status=${sampleGateCollectionSprint.status ?? "n/a"} / pending=${sampleGateCollectionSprint.p0_pending_count ?? 0}/${sampleGateCollectionSprint.p0_full_task_count ?? 0} / focused=${sampleGateCollectionSprint.focused_missing_count ?? 0} / steps=${sampleGateCollectionSprint.sprint_step_count ?? 0} / open_targets=${sampleGateCollectionSprint.owner_open_target_count ?? 0} / owner_review=${sampleGateCollectionSprint.owner_review_required ? "yes" : "no"} / report=sample_gate_collection_sprint.md / data_write=${sampleGateCollectionSprint.data_lp_events_write_performed ? "yes" : "no"} / external=${sampleGateCollectionSprint.external_effect ? "yes" : "no"}`)}
              ${row("P0 launcher", `${ownerP0Launcher.ok ? "ok" : "not ready"} / targets=${ownerP0Launcher.target_count ?? 0} / focused=${ownerP0Launcher.owner_p0_now_focused_missing_count ?? 0}/${ownerP0Launcher.owner_p0_now_focused_total_count ?? 0} / full=${ownerP0Launcher.owner_p0_now_full_row_count ?? 0}/${ownerP0Launcher.owner_p0_now_full_task_count ?? 0} / local_only=${ownerP0Launcher.command_opens_local_files_only ? "yes" : "no"} / network=${ownerP0Launcher.network_calls_performed ? "yes" : "no"} / external=${ownerP0Launcher.external_effect ? "yes" : "no"}`)}
              ${row("Sample count recovery", `${ownerSampleCountRecovery.ok ? "ok" : "not ready"} / status=${ownerSampleCountRecovery.status ?? "n/a"} / quick=${ownerSampleCountRecovery.quick_preview_ready ? "yes" : "no"} / intake=${ownerSampleCountRecovery.intake_preview_ready ? "yes" : "no"} / full=${ownerSampleCountRecovery.full_p0_row_count ?? 0} / full_intake=${ownerSampleCountRecovery.full_p0_intake_ready ? "yes" : "no"} / full_staged=${ownerSampleCountRecovery.full_p0_staged_ready ? "yes" : "no"} / preflight=${ownerSampleCountRecovery.owner_preflight_ready ? "yes" : "no"} / rows=${ownerSampleCountRecovery.owner_preview_rows ?? 0} / sample_met=${ownerSampleCountRecovery.sample_threshold_met ? "yes" : "no"} / data_write=${ownerSampleCountRecovery.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerSampleCountRecovery.external_effect ? "yes" : "no"}`)}
              ${row("P0 post-fill check", `${ownerP0PostfillCheck.ok ? "ok" : "not ready"} / status=${ownerP0PostfillCheck.status ?? "n/a"} / stage=${ownerP0PostfillCheck.current_stage ?? "n/a"} / ready=${ownerP0PostfillCheck.postfill_ready ? "yes" : "no"} / trust=${ownerP0PostfillCheck.source_trust_status ?? "n/a"} / trusted=${ownerP0PostfillCheck.source_trust_trusted_scoring_source_count ?? 0} / sample_gate=${ownerP0PostfillCheck.source_trust_sample_gate_source_count ?? 0} / scoring=${ownerP0PostfillCheck.source_trust_scoring_allowed_now ? "yes" : "no"} / commands=${ownerP0PostfillCheck.safe_command_count ?? 0} / local_only=${ownerP0PostfillCheck.command_runs_local_scripts_only ? "yes" : "no"} / data_write=${ownerP0PostfillCheck.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerP0PostfillCheck.external_effect ? "yes" : "no"}`)}
              ${row("Sample count recovery guard", `${ownerSampleCountRecoveryFixtures.ok ? "ok" : "not ready"} / scenarios=${ownerSampleCountRecoveryFixtures.scenario_count ?? 0} / commands=${ownerSampleCountRecoveryFixtures.owner_sample_count_recovery_commands_executed ? "yes" : "no"} / project_write=${ownerSampleCountRecoveryFixtures.live_project_write_performed ? "yes" : "no"} / data_write=${ownerSampleCountRecoveryFixtures.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerSampleCountRecoveryFixtures.external_effect ? "yes" : "no"}`)}
              ${row("Owner launcher", `${ownerActionLauncher.ok ? "ok" : "not ready"} / targets=${ownerActionLauncher.target_count ?? 0} / trust=${ownerActionLauncher.source_trust_status ?? "n/a"} / trusted=${ownerActionLauncher.source_trust_trusted_scoring_source_count ?? 0} / sample_gate=${ownerActionLauncher.source_trust_sample_gate_source_count ?? 0} / scoring=${ownerActionLauncher.source_trust_scoring_allowed_now ? "yes" : "no"} / local_only=${ownerActionLauncher.command_opens_local_files_only ? "yes" : "no"} / network=${ownerActionLauncher.network_calls_performed ? "yes" : "no"} / external=${ownerActionLauncher.external_effect ? "yes" : "no"}`)}
              ${row("Sample gate guard", `${ownerSampleGateFixtures.ok ? "ok" : "not ready"} / scenarios=${ownerSampleGateFixtures.scenario_count ?? 0} / commands=${ownerSampleGateFixtures.owner_sample_gate_commands_executed ? "yes" : "no"} / data_write=${ownerSampleGateFixtures.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerSampleGateFixtures.external_effect ? "yes" : "no"}`)}
              ${row("Quality review", `${ownerQualityReview.ok ? "ok" : "blocked"} / status=${ownerQualityReview.status ?? "n/a"} / sample_win=${ownerQualityReview.sample_rate_win_candidate ? "yes" : "no"} / no_quality_regression=${ownerQualityReview.no_quality_regression === null ? "n/a" : ownerQualityReview.no_quality_regression ? "yes" : "no"} / promotion_queue=${ownerQualityReview.promotion_review_queued ? "yes" : "no"} / data_write=${ownerQualityReview.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerQualityReview.external_effect ? "yes" : "no"}`)}
              ${row("Quality form", `${ownerQualityReviewForm.ok ? "ok" : "not ready"} / status=${ownerQualityReviewForm.status ?? "n/a"} / sample_win=${ownerQualityReviewForm.sample_rate_win_candidate ? "yes" : "no"} / browser_only=${ownerQualityReviewForm.browser_only ? "yes" : "no"} / persistence=${ownerQualityReviewForm.browser_persistence ? "yes" : "no"} / network=${ownerQualityReviewForm.network_calls_performed ? "yes" : "no"} / data_write=${ownerQualityReviewForm.data_lp_events_write_performed ? "yes" : "no"} / approval_write=${ownerQualityReviewForm.approval_queue_write_performed ? "yes" : "no"} / external=${ownerQualityReviewForm.external_effect ? "yes" : "no"}`)}
              ${row("Quality form guard", `${ownerQualityReviewFormFixtures.ok ? "ok" : "not ready"} / scenarios=${ownerQualityReviewFormFixtures.scenario_count ?? 0} / commands=${ownerQualityReviewFormFixtures.owner_quality_review_commands_executed ? "yes" : "no"} / data_write=${ownerQualityReviewFormFixtures.data_lp_events_write_performed ? "yes" : "no"} / approval_write=${ownerQualityReviewFormFixtures.approval_queue_write_performed ? "yes" : "no"} / external=${ownerQualityReviewFormFixtures.external_effect ? "yes" : "no"}`)}
              ${row("Quality guard", `${ownerQualityReviewFixtures.ok ? "ok" : "not ready"} / scenarios=${ownerQualityReviewFixtures.scenario_count ?? 0} / commands=${ownerQualityReviewFixtures.owner_quality_review_commands_executed ? "yes" : "no"} / data_write=${ownerQualityReviewFixtures.data_lp_events_write_performed ? "yes" : "no"} / external=${ownerQualityReviewFixtures.external_effect ? "yes" : "no"}`)}
              ${row("Retirement guard", `${retirementFixtures.ok ? "ok" : "not ready"} / scenarios=${retirementFixtures.scenario_count ?? 0} / current_queue=${retirementFixtures.current_queue_safety?.status ?? "n/a"} / delete=${retirementFixtures.delete_action_performed ? "yes" : "no"} / external=${retirementFixtures.external_effect ? "yes" : "no"}`)}
              ${row("Event input quality", `${eventInputQuality.ok ? "ok" : "blocked"} / rows=${eventInputQuality.rows_scanned ?? 0} / issues=${(eventInputQuality.issues ?? []).length}`)}
              ${row("Manual import", `${manual.mode ?? "n/a"} / events=${manual.events_written ?? 0}`)}
              ${row("Tracking smoke", `${trackingLinkSmoke.ok ? "ok" : "not ready"} / links=${trackingLinkSmoke.links_checked ?? 0}/${trackingLinkSmoke.expected_link_count ?? 0} / real_write=${trackingLinkSmoke.real_event_write_performed ? "yes" : "no"} / data_write=${trackingLinkSmoke.data_lp_events_write_performed ? "yes" : "no"}`)}
              ${row("Event contract", eventContract.ok ? "ok / isolated fixture only" : "not ready")}
              ${row("Fixture event writes", eventContract.isolated_fixture_event_write_performed ? "isolated yes" : "no")}
              ${row("Sensitive columns", manual.contains_sensitive_columns ? "yes" : "no")}
              ${row("Sensitive values", manual.contains_sensitive_values ? "yes" : "no")}
            </div>
          </div>
        </section>
      </aside>
    </section>

    <section class="panel" style="margin-top:14px">
      <header>
        <h2>Prepared But Blocked</h2>
        ${badge(`${(blocked.items ?? []).length} queued`, "block")}
      </header>
      <div class="body">
        ${blockedTable(blocked.items ?? [])}
      </div>
    </section>

    <div class="foot">
      <span>Local console only. No form, no fetch, no publish, no deploy.</span>
      <span class="code">${escapeHtml(OUTPUT_PATH)}</span>
    </div>
  </main>
</body>
</html>`;
}

function metric(label, number, caption) {
  return `<article class="metric"><span class="label">${escapeHtml(label)}</span><span class="number">${escapeHtml(number)}</span><span class="caption">${escapeHtml(caption)}</span></article>`;
}

function assetCard(label, asset) {
  return `<div class="panel">
    <header><h2>${escapeHtml(label)}</h2>${badge(asset.decision ?? asset.status ?? "n/a", asset.role === "champion" ? "ok" : "warn")}</header>
    <div class="body">
      <div class="split-list">
        ${row("Asset", asset.asset_id ?? "n/a")}
        ${row("Line add rate", percent(asset.line_add_rate))}
        ${row("Visits", String(asset.visits ?? 0))}
        ${row("CTA clicks", String(asset.cta_clicks ?? 0))}
        ${row("LINE adds", String(asset.line_adds ?? 0))}
        ${row("Test days", String(asset.test_days ?? 0))}
      </div>
    </div>
  </div>`;
}

function approvalTable(items) {
  const rows = items
    .map(
      (item) => `<tr>
        <td><code>${escapeHtml(item.id)}</code></td>
        <td>${badge(item.risk_tier ?? "T?", item.status === "pending_human" ? "block" : "ok")}</td>
        <td>${escapeHtml(item.status ?? "n/a")}</td>
        <td>${escapeHtml(item.human_gate ?? "")}</td>
      </tr>`,
    )
    .join("");
  return `<table><thead><tr><th>ID</th><th>Tier</th><th>Status</th><th>Gate</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function verificationTable(commands, checks, scenarios, funnelScenarios, realDataApplyScenarios, decisionReplayScenarios, sampleGateReplayScenarios, sampleGateDueScenarios, approvalScenarios) {
  const commandRows = commands
    .map((command) => `<tr><td><code>${escapeHtml(command.step)}</code></td><td>${escapeHtml(command.status)}</td><td>${escapeHtml(String(command.external_effect))}</td></tr>`)
    .join("");
  const checkRows = checks
    .map((check) => `<tr><td><code>${escapeHtml(check.name)}</code></td><td>${escapeHtml(check.ok ? "ok" : "fail")}</td><td>${escapeHtml(String(check.external_effect))}</td></tr>`)
    .join("");
  const scenarioRows = scenarios
    .map((scenario) => `<tr><td><code>${escapeHtml(scenario.id)}</code></td><td>${escapeHtml(scenario.ok ? "ok" : "fail")}</td><td>${escapeHtml(String(scenario.external_effect))}</td></tr>`)
    .join("");
  const funnelScenarioRows = funnelScenarios
    .map((scenario) => `<tr><td><code>${escapeHtml(scenario.id)}</code></td><td>${escapeHtml(scenario.ok ? "ok" : "fail")}</td><td>${escapeHtml(String(scenario.external_effect))}</td></tr>`)
    .join("");
  const realDataApplyRows = realDataApplyScenarios
    .map((scenario) => `<tr><td><code>${escapeHtml(scenario.id)}</code></td><td>${escapeHtml(scenario.ok ? "ok" : "fail")}</td><td>${escapeHtml(String(scenario.external_effect))}</td></tr>`)
    .join("");
  const decisionReplayRows = decisionReplayScenarios
    .map((scenario) => `<tr><td><code>${escapeHtml(scenario.id)}</code></td><td>${escapeHtml(scenario.ok ? "ok" : "fail")}</td><td>${escapeHtml(String(scenario.external_effect))}</td></tr>`)
    .join("");
  const sampleGateReplayRows = sampleGateReplayScenarios
    .map((scenario) => `<tr><td><code>${escapeHtml(scenario.id)}</code></td><td>${escapeHtml(scenario.ok ? "ok" : "fail")}</td><td>${escapeHtml(String(scenario.external_effect))}</td></tr>`)
    .join("");
  const sampleGateDueRows = sampleGateDueScenarios
    .map((scenario) => `<tr><td><code>${escapeHtml(scenario.id)}</code></td><td>${escapeHtml(scenario.ok ? "ok" : "fail")}</td><td>${escapeHtml(String(scenario.external_effect))}</td></tr>`)
    .join("");
  const approvalScenarioRows = approvalScenarios
    .map((scenario) => `<tr><td><code>${escapeHtml(scenario.id)}</code></td><td>${escapeHtml(scenario.ok ? "ok" : "fail")}</td><td>${escapeHtml(String(scenario.external_effect))}</td></tr>`)
    .join("");
  return `<table><thead><tr><th>Check</th><th>Status</th><th>External effect</th></tr></thead><tbody>${commandRows}${checkRows}${scenarioRows}${funnelScenarioRows}${realDataApplyRows}${decisionReplayRows}${sampleGateReplayRows}${sampleGateDueRows}${approvalScenarioRows}</tbody></table>`;
}

function objectiveContractTable(audit) {
  const checks = audit.checks ?? [];
  const failed = checks.filter((check) => check.ok !== true);
  const sequence = audit.objective_sequence ?? [];
  return `<div class="split-list">
    ${row("Status", audit.status ?? "n/a")}
    ${row("Sequence", sequence.join(" -> ") || "n/a")}
    ${row("Checks", `${checks.length - failed.length}/${checks.length}`)}
    ${row("One variable", audit.one_variable_contract?.changed_variable ?? "n/a")}
    ${row("Sample gate", audit.sample_gate?.sample_threshold_met ? "met" : "not met")}
    ${row("External effect", String(audit.external_effect ?? false))}
  </div>`;
}

function blockedTable(items) {
  const rows = items
    .map(
      (item) => `<tr>
        <td><code>${escapeHtml(item.action)}</code></td>
        <td>${escapeHtml(item.blocked_by ?? "")}</td>
        <td><code>${escapeHtml(item.prepared_artifact ?? "n/a")}</code></td>
      </tr>`,
    )
    .join("");
  return `<table><thead><tr><th>Action</th><th>Blocked by</th><th>Artifact</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function redLine(label, performed) {
  return `<div class="gate"><strong>${escapeHtml(label)} ${badge(performed ? "performed" : "no", performed ? "block" : "ok")}</strong><p>${escapeHtml(performed ? "Review immediately. This console must not perform external effects." : "No autonomous external effect recorded.")}</p></div>`;
}

function artifact(label, href) {
  return `<a class="artifact" href="${escapeHtml(href)}">${escapeHtml(label)}<span>${escapeHtml(href)}</span></a>`;
}

function row(label, value) {
  return `<div class="row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`;
}

function kv(label, value) {
  return `<div><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></div>`;
}

function badge(text, tone = "info") {
  return `<span class="badge ${escapeHtml(tone)}">${escapeHtml(text)}</span>`;
}

function sampleGaps(nextRound) {
  const gaps = nextRound.sample_gate?.gaps ?? {};
  return `visits ${gaps.visits ?? 0}, cta ${gaps.cta_clicks ?? 0}, line ${gaps.line_adds ?? 0}, days ${gaps.test_days ?? 0}`;
}

function per100Display(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  return value.toFixed(2);
}

function percent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0.0%";
  }
  return `${(value * 100).toFixed(1)}%`;
}

async function readJson(relativePath) {
  const raw = await readFile(path.join(ROOT, relativePath), "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

main();
