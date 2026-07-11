import { mkdir, readFile, writeFile, copyFile, access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { canonicalRates, completedTaipeiWeek, filterEventsForWeek } from "./lib/scoring-policy.mjs";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "config", "growth-loop.config.json");
const EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const REPORT_PATH = path.join(ROOT, "weekly_report.md");
const SCORES_PATH = path.join(ROOT, "growth_scores.json");
const APPROVAL_PATH = path.join(ROOT, "approval_queue.json");
const APPROVAL_STATUS_PATH = path.join(ROOT, "data", "approval_queue_status.json");
const AB_STATUS_PATH = path.join(ROOT, "ab_test_status.json");
const BLOCKED_PATH = path.join(ROOT, "prepared_but_blocked.json");
const TRACKING_LINKS_PATH = path.join(ROOT, "tracking_links.json");
const CONTENT_VARIANTS_JSON_PATH = path.join(ROOT, "content_variants.json");
const CONTENT_VARIANTS_MD_PATH = path.join(ROOT, "content_variants.md");
const FUNNEL_BREAKDOWN_JSON_PATH = path.join(ROOT, "funnel_breakdown.json");
const FUNNEL_BREAKDOWN_MD_PATH = path.join(ROOT, "funnel_breakdown.md");
const NEXT_ROUND_PLAN_JSON_PATH = path.join(ROOT, "next_round_plan.json");
const NEXT_ROUND_PLAN_MD_PATH = path.join(ROOT, "next_round_plan.md");
const PIPELINE_STATUS_PATH = path.join(ROOT, "pipeline_status.json");
const RETIREMENT_QUEUE_PATH = path.join(ROOT, "candidate_retirement_queue.json");
const COMPLETION_AUDIT_PATH = path.join(ROOT, "goal_completion_audit.md");
const COMPLETION_AUDIT_STATUS_PATH = path.join(ROOT, "data", "goal_completion_audit_status.json");
const GITHUB_HANDOFF_PATH = path.join(ROOT, "github_handoff.md");
const LAUNCH_READINESS_PATH = path.join(ROOT, "launch_readiness.json");
const OWNER_APPROVAL_PACK_PATH = path.join(ROOT, "owner_approval_pack.md");
const CANDIDATE_HTML_PATH = path.join(ROOT, "landing_page_candidate.html");
const WORKER_ARTIFACT_PATH = path.join(ROOT, "worker.ts");
const WORKER_SOURCE_PATH = path.join(ROOT, "src", "index.ts");
const D1_SYNC_STATUS_PATH = path.join(ROOT, "data", "d1_sync_status.json");
const EVENT_INPUT_QUALITY_STATUS_PATH = path.join(ROOT, "data", "event_input_quality_status.json");
const FUNNEL_AGGREGATE_STATUS_PATH = path.join(ROOT, "data", "funnel_aggregate_status.json");
const FUNNEL_AGGREGATE_EXAMPLE_PATH = path.join(ROOT, "data", "funnel_aggregates.example.csv");
const FUNNEL_AGGREGATE_PREVIEW_PATH = path.join(ROOT, "data", "funnel_aggregates.preview.jsonl");
const FUNNEL_AGGREGATE_FIXTURE_STATUS_PATH = path.join(ROOT, "data", "funnel_aggregate_fixture_status.json");
const FUNNEL_AGGREGATE_FIXTURE_REPORT_PATH = path.join(ROOT, "funnel_aggregate_fixture_report.md");
const REAL_DATA_APPLY_FIXTURE_STATUS_PATH = path.join(ROOT, "data", "real_data_apply_fixture_status.json");
const REAL_DATA_APPLY_FIXTURE_REPORT_PATH = path.join(ROOT, "real_data_apply_fixture_report.md");
const REAL_DATA_DECISION_REPLAY_STATUS_PATH = path.join(ROOT, "data", "real_data_decision_replay_status.json");
const REAL_DATA_DECISION_REPLAY_REPORT_PATH = path.join(ROOT, "real_data_decision_replay_report.md");
const SOURCE_READINESS_STATUS_PATH = path.join(ROOT, "data", "source_readiness_status.json");
const SOURCE_READINESS_REPORT_PATH = path.join(ROOT, "source_readiness.md");
const SOURCE_TRUST_MATRIX_JSON_PATH = path.join(ROOT, "source_trust_matrix.json");
const SOURCE_TRUST_MATRIX_REPORT_PATH = path.join(ROOT, "source_trust_matrix.md");
const SOURCE_TRUST_MATRIX_STATUS_PATH = path.join(ROOT, "data", "source_trust_matrix_status.json");
const SOURCE_CAPTURE_STATUS_PATH = path.join(ROOT, "data", "source_capture_status.json");
const SOURCE_CAPTURE_REPORT_PATH = path.join(ROOT, "source_capture_pack.md");
const SOURCE_CAPTURE_CHECKLIST_PATH = path.join(ROOT, "data", "source_capture", "source_capture_checklist.json");
const SOURCE_CAPTURE_LEDGER_PATH = path.join(ROOT, "data", "source_capture", "source_capture_ledger.fill-template.csv");
const SOURCE_CAPTURE_SAMPLE_GATE_LEDGER_PATH = path.join(ROOT, "data", "source_capture", "sample_gate_ledger.fill-template.csv");
const SAMPLE_GATE_LEDGER_STATUS_PATH = path.join(ROOT, "data", "sample_gate_ledger_status.json");
const SAMPLE_GATE_LEDGER_REPORT_PATH = path.join(ROOT, "sample_gate_ledger.md");
const SAMPLE_GATE_COMPILE_PROBE_STATUS_PATH = path.join(ROOT, "data", "sample_gate_ledger_compile_probe_status.json");
const SAMPLE_GATE_COMPILE_PROBE_REPORT_PATH = path.join(ROOT, "sample_gate_ledger_compile_probe.md");
const SAMPLE_GATE_COMPILE_PROBE_FUNNEL_PATH = path.join(ROOT, "data", "source_capture", "sample_gate_compile_probe", "funnel_aggregates.owner-preview.csv");
const SAMPLE_GATE_COMPILE_PROBE_MANUAL_PATH = path.join(ROOT, "data", "source_capture", "sample_gate_compile_probe", "manual_conversions.owner-preview.csv");
const SOURCE_CAPTURE_COMPILE_STATUS_PATH = path.join(ROOT, "data", "source_capture_compile_status.json");
const SOURCE_CAPTURE_COMPILE_REPORT_PATH = path.join(ROOT, "source_capture_compile_report.md");
const SOURCE_CAPTURE_COMPILE_FIXTURE_STATUS_PATH = path.join(ROOT, "data", "source_capture_compile_fixture_status.json");
const SOURCE_CAPTURE_COMPILE_FIXTURE_REPORT_PATH = path.join(ROOT, "source_capture_compile_fixture_report.md");
const SOURCE_CAPTURE_COMPILED_FUNNEL_PATH = path.join(ROOT, "data", "source_capture", "compiled", "funnel_aggregates.owner-preview.csv");
const SOURCE_CAPTURE_COMPILED_MANUAL_PATH = path.join(ROOT, "data", "source_capture", "compiled", "manual_conversions.owner-preview.csv");
const REAL_DATA_INTAKE_STATUS_PATH = path.join(ROOT, "data", "real_data_intake_status.json");
const REAL_DATA_INTAKE_PLAN_PATH = path.join(ROOT, "real_data_intake_plan.md");
const DATA_COLLECTION_QUEUE_PATH = path.join(ROOT, "data_collection_queue.json");
const DATA_COLLECTION_BRIEF_PATH = path.join(ROOT, "data_collection_brief.md");
const DATA_COLLECTION_BRIEF_STATUS_PATH = path.join(ROOT, "data", "data_collection_brief_status.json");
const DATA_COLLECTION_PROGRESS_REPORT_PATH = path.join(ROOT, "data_collection_progress.md");
const DATA_COLLECTION_PROGRESS_JSON_PATH = path.join(ROOT, "data_collection_progress.json");
const DATA_COLLECTION_PROGRESS_STATUS_PATH = path.join(ROOT, "data", "data_collection_progress_status.json");
const NEXT_P0_OWNER_INPUTS_REPORT_PATH = path.join(ROOT, "next_p0_owner_inputs.md");
const NEXT_P0_OWNER_INPUTS_JSON_PATH = path.join(ROOT, "next_p0_owner_inputs.json");
const NEXT_P0_OWNER_INPUTS_STATUS_PATH = path.join(ROOT, "data", "next_p0_owner_inputs_status.json");
const NEXT_P0_OWNER_FORM_PATH = path.join(ROOT, "next_p0_owner_form.html");
const NEXT_P0_OWNER_FORM_STATUS_PATH = path.join(ROOT, "data", "next_p0_owner_form_status.json");
const NEXT_P0_OWNER_FORM_FIXTURE_REPORT_PATH = path.join(ROOT, "next_p0_owner_form_fixture_report.md");
const NEXT_P0_OWNER_FORM_FIXTURE_STATUS_PATH = path.join(ROOT, "data", "next_p0_owner_form_fixture_status.json");
const NEXT_P0_OWNER_INTAKE_REPORT_PATH = path.join(ROOT, "next_p0_owner_intake.md");
const NEXT_P0_OWNER_INTAKE_STATUS_PATH = path.join(ROOT, "data", "next_p0_owner_intake_status.json");
const NEXT_P0_OWNER_INTAKE_FIXTURE_REPORT_PATH = path.join(ROOT, "next_p0_owner_intake_fixture_report.md");
const NEXT_P0_OWNER_INTAKE_FIXTURE_STATUS_PATH = path.join(ROOT, "data", "next_p0_owner_intake_fixture_status.json");
const SAMPLE_GATE_PLAN_PATH = path.join(ROOT, "sample_gate_collection_plan.json");
const SAMPLE_GATE_PLAN_REPORT_PATH = path.join(ROOT, "sample_gate_collection_plan.md");
const SAMPLE_GATE_STATUS_PATH = path.join(ROOT, "data", "sample_gate_collection_plan_status.json");
const MANUAL_CONVERSION_STATUS_PATH = path.join(ROOT, "data", "manual_conversion_status.json");
const MANUAL_CONVERSION_EXAMPLE_PATH = path.join(ROOT, "data", "manual_conversions.example.csv");
const MANUAL_CONVERSION_PREVIEW_PATH = path.join(ROOT, "data", "manual_conversions.preview.jsonl");
const LINE_INBOUND_PLAYBOOK_JSON_PATH = path.join(ROOT, "line_inbound_playbook.json");
const LINE_INBOUND_PLAYBOOK_MD_PATH = path.join(ROOT, "line_inbound_playbook.md");
const LINE_INBOUND_FIXTURE_STATUS_PATH = path.join(ROOT, "data", "line_inbound_fixture_status.json");
const LINE_INBOUND_FIXTURE_REPORT_PATH = path.join(ROOT, "line_inbound_fixture_report.md");
const MANUAL_PUBLISH_EVIDENCE_FORM_PATH = path.join(ROOT, "manual_publish_evidence_form.html");
const MANUAL_PUBLISH_EVIDENCE_FORM_STATUS_PATH = path.join(ROOT, "data", "manual_publish_evidence_form_status.json");
const MANUAL_PUBLISH_EVIDENCE_FORM_FIXTURE_REPORT_PATH = path.join(ROOT, "manual_publish_evidence_form_fixture_report.md");
const MANUAL_PUBLISH_EVIDENCE_FORM_FIXTURE_STATUS_PATH = path.join(ROOT, "data", "manual_publish_evidence_form_fixture_status.json");
const SCHEDULE_STATUS_PATH = path.join(ROOT, "data", "schedule_status.json");
const WEEKLY_RUNNER_STATUS_PATH = path.join(ROOT, "data", "weekly_runner_status.json");
const WEEK_ARCHIVE_STATUS_PATH = path.join(ROOT, "data", "week_archive_status.json");
const LAUNCHAGENT_STATUS_PATH = path.join(ROOT, "data", "launchagent_status.json");
const WORKER_DRY_RUN_REPORT_PATH = path.join(ROOT, "worker_dry_run.md");
const WORKER_DRY_RUN_STATUS_PATH = path.join(ROOT, "data", "worker_dry_run_status.json");
const BROWSER_SMOKE_STATUS_PATH = path.join(ROOT, "data", "browser_smoke_status.json");
const TRACKING_LINK_SMOKE_REPORT_PATH = path.join(ROOT, "tracking_link_smoke.md");
const TRACKING_LINK_SMOKE_STATUS_PATH = path.join(ROOT, "data", "tracking_link_smoke_status.json");
const EVENT_CONTRACT_SMOKE_STATUS_PATH = path.join(ROOT, "data", "event_contract_smoke_status.json");
const CLOUDFLARE_D1_READINESS_STATUS_PATH = path.join(ROOT, "data", "cloudflare_d1_readiness_status.json");
const LIVE_TELEMETRY_READINESS_STATUS_PATH = path.join(ROOT, "data", "live_telemetry_readiness_status.json");
const D1_SCHEMA_CONTRACT_REPORT_PATH = path.join(ROOT, "d1_schema_contract.md");
const D1_SCHEMA_CONTRACT_STATUS_PATH = path.join(ROOT, "data", "d1_schema_contract_status.json");
const APPROVED_D1_CONFIG_REPORT_PATH = path.join(ROOT, "approved_d1_config.md");
const APPROVED_D1_CONFIG_STATUS_PATH = path.join(ROOT, "data", "approved_d1_config_status.json");
const CHAMPION_CONTRACT_AUDIT_STATUS_PATH = path.join(ROOT, "data", "champion_contract_audit_status.json");
const CHAMPION_GITHUB_HANDOFF_PATH = path.join(ROOT, "champion_github_handoff.md");
const CHAMPION_GITHUB_PR_BODY_PATH = path.join(ROOT, "champion_github_pr_body.md");
const CHAMPION_GITHUB_HANDOFF_STATUS_PATH = path.join(ROOT, "data", "champion_github_handoff_status.json");
const OWNER_GATE_EVIDENCE_STATUS_PATH = path.join(ROOT, "data", "owner_gate_evidence_status.json");
const WIN_RULE_FIXTURE_STATUS_PATH = path.join(ROOT, "data", "win_rule_fixture_status.json");
const LAUNCHD_PLIST_PATH = path.join(ROOT, "launchd", "com.angelia.3q-growth-loop.weekly.plist");

const VERIFY = process.argv.includes("--verify");

const EVENT_TYPES = [
  "link_click",
  "page_view",
  "cta_click",
  "line_add",
  "lead_submit",
  "deal",
  "quality_flag",
];

async function main() {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  await ensureEventFile();
  const now = new Date();
  const week = completedTaipeiWeek(now);
  const events = filterEventsForWeek(await readEvents(EVENTS_PATH), week);
  const d1SyncStatus = await readD1SyncStatus();
  const eventInputQualityStatus = await readEventInputQualityStatus();
  const funnelAggregateStatus = await readFunnelAggregateStatus();
  const funnelAggregateFixtureStatus = await readFunnelAggregateFixtureStatus();
  const realDataApplyFixtureStatus = await readRealDataApplyFixtureStatus();
  const realDataDecisionReplayStatus = await readRealDataDecisionReplayStatus();
  const sourceReadinessStatus = await readSourceReadinessStatus();
  const sourceCaptureStatus = await readSourceCaptureStatus();
  const sourceCaptureCompileStatus = await readSourceCaptureCompileStatus();
  const sourceCaptureCompileFixtureStatus = await readSourceCaptureCompileFixtureStatus();
  const realDataIntakeStatus = await readRealDataIntakeStatus();
  const dataCollectionBriefStatus = await readDataCollectionBriefStatus();
  const dataCollectionProgressStatus = await readDataCollectionProgressStatus();
  const sourceTrustMatrixStatus = await readSourceTrustMatrixStatus();
  const nextP0OwnerFormStatus = await readNextP0OwnerFormStatus();
  const nextP0OwnerFormFixtureStatus = await readNextP0OwnerFormFixtureStatus();
  const nextP0OwnerIntakeStatus = await readNextP0OwnerIntakeStatus();
  const nextP0OwnerIntakeFixtureStatus = await readNextP0OwnerIntakeFixtureStatus();
  const manualConversionStatus = await readManualConversionStatus();
  const lineInboundStatus = await readLineInboundStatus();
  const manualPublishEvidenceFormStatus = await readManualPublishEvidenceFormStatus();
  const manualPublishEvidenceFormFixtureStatus = await readManualPublishEvidenceFormFixtureStatus();
  const weeklyRunnerStatus = await readWeeklyRunnerStatus();
  const weekArchiveStatus = await readWeekArchiveStatus();
  const launchAgentStatus = await readLaunchAgentStatus();
  const workerDryRunStatus = await readWorkerDryRunStatus();
  const browserSmokeStatus = await readBrowserSmokeStatus();
  const trackingLinkSmokeStatus = await readTrackingLinkSmokeStatus();
  const eventContractSmokeStatus = await readEventContractSmokeStatus();
  const cloudflareD1ReadinessStatus = JSON.parse(await readFile(CLOUDFLARE_D1_READINESS_STATUS_PATH, "utf8"));
  const liveTelemetryReadinessStatus = JSON.parse(await readFile(LIVE_TELEMETRY_READINESS_STATUS_PATH, "utf8"));
  const d1SchemaContractStatus = JSON.parse(await readFile(D1_SCHEMA_CONTRACT_STATUS_PATH, "utf8"));
  const approvedD1ConfigStatus = JSON.parse(await readFile(APPROVED_D1_CONFIG_STATUS_PATH, "utf8"));
  const championContractAuditStatus = JSON.parse(await readFile(CHAMPION_CONTRACT_AUDIT_STATUS_PATH, "utf8"));
  const championGithubHandoffStatus = JSON.parse(await readFile(CHAMPION_GITHUB_HANDOFF_STATUS_PATH, "utf8"));
  const ownerGateEvidenceStatus = JSON.parse(await readFile(OWNER_GATE_EVIDENCE_STATUS_PATH, "utf8"));
  const winRuleFixtureStatus = await readWinRuleFixtureStatus();
  const scheduleStatus = buildScheduleStatus(config, weeklyRunnerStatus, launchAgentStatus, now);
  const scores = scoreAssets(config, events, week);
  const abStatus = buildAbStatus(config, scores, events, week);
  const trackingLinks = buildTrackingLinks(config, week);
  const contentVariants = buildContentVariants(config, trackingLinks, now);
  const funnelBreakdown = buildFunnelBreakdown(config, events, trackingLinks, week, now);
  const retirementQueue = buildCandidateRetirementQueue(config, scores, abStatus, week, now);
  const nextRoundPlan = buildNextRoundPlan(config, scores, abStatus, retirementQueue, week, now);
  const approvalQueue = buildApprovalQueue(config, scores, abStatus, scheduleStatus, nextRoundPlan, realDataIntakeStatus, dataCollectionBriefStatus, cloudflareD1ReadinessStatus, liveTelemetryReadinessStatus, d1SchemaContractStatus, approvedD1ConfigStatus, championContractAuditStatus, championGithubHandoffStatus, ownerGateEvidenceStatus, now);
  const approvalQueueStatus = buildApprovalQueueStatus(approvalQueue, now);
  const blocked = buildPreparedButBlocked(config, {
    dataCollectionProgressStatus,
    sourceTrustMatrixStatus,
    abStatus,
    cloudflareD1ReadinessStatus,
    liveTelemetryReadinessStatus,
    d1SchemaContractStatus,
    approvedD1ConfigStatus,
    championContractAuditStatus,
    championGithubHandoffStatus,
  }, now);
  const pipelineStatus = buildPipelineStatus(config, scores, abStatus, trackingLinks, funnelBreakdown, blocked, retirementQueue, nextRoundPlan, d1SyncStatus, eventInputQualityStatus, funnelAggregateStatus, funnelAggregateFixtureStatus, realDataApplyFixtureStatus, realDataDecisionReplayStatus, sourceReadinessStatus, sourceCaptureStatus, sourceCaptureCompileStatus, sourceCaptureCompileFixtureStatus, realDataIntakeStatus, dataCollectionBriefStatus, sourceTrustMatrixStatus, manualConversionStatus, lineInboundStatus, scheduleStatus, workerDryRunStatus, browserSmokeStatus, trackingLinkSmokeStatus, eventContractSmokeStatus, events, week, now);
  const launchReadiness = buildLaunchReadiness(config, scores, abStatus, approvalQueue, blocked, pipelineStatus, funnelBreakdown, d1SyncStatus, eventInputQualityStatus, funnelAggregateStatus, funnelAggregateFixtureStatus, realDataApplyFixtureStatus, realDataDecisionReplayStatus, sourceReadinessStatus, sourceCaptureStatus, sourceCaptureCompileStatus, sourceCaptureCompileFixtureStatus, realDataIntakeStatus, dataCollectionBriefStatus, dataCollectionProgressStatus, nextP0OwnerFormStatus, nextP0OwnerFormFixtureStatus, nextP0OwnerIntakeStatus, nextP0OwnerIntakeFixtureStatus, manualConversionStatus, lineInboundStatus, manualPublishEvidenceFormStatus, manualPublishEvidenceFormFixtureStatus, scheduleStatus, workerDryRunStatus, browserSmokeStatus, trackingLinkSmokeStatus, eventContractSmokeStatus, cloudflareD1ReadinessStatus, liveTelemetryReadinessStatus, d1SchemaContractStatus, approvedD1ConfigStatus, championGithubHandoffStatus, winRuleFixtureStatus, weekArchiveStatus, nextRoundPlan, events, now);
  const report = renderWeeklyReport(config, scores, abStatus, approvalQueue, blocked, trackingLinks, contentVariants, funnelBreakdown, pipelineStatus, retirementQueue, nextRoundPlan, d1SyncStatus, eventInputQualityStatus, funnelAggregateStatus, funnelAggregateFixtureStatus, realDataApplyFixtureStatus, realDataDecisionReplayStatus, sourceReadinessStatus, sourceCaptureStatus, sourceCaptureCompileStatus, sourceCaptureCompileFixtureStatus, realDataIntakeStatus, dataCollectionBriefStatus, dataCollectionProgressStatus, sourceTrustMatrixStatus, nextP0OwnerFormStatus, nextP0OwnerFormFixtureStatus, nextP0OwnerIntakeStatus, nextP0OwnerIntakeFixtureStatus, manualConversionStatus, lineInboundStatus, manualPublishEvidenceFormStatus, manualPublishEvidenceFormFixtureStatus, scheduleStatus, workerDryRunStatus, browserSmokeStatus, trackingLinkSmokeStatus, eventContractSmokeStatus, winRuleFixtureStatus, weekArchiveStatus, launchReadiness, events, week, now);
  const completionAudit = renderGoalCompletionAudit(config, scores, abStatus, approvalQueue, blocked, trackingLinks, contentVariants, funnelBreakdown, pipelineStatus, retirementQueue, nextRoundPlan, d1SyncStatus, eventInputQualityStatus, funnelAggregateStatus, funnelAggregateFixtureStatus, realDataApplyFixtureStatus, realDataDecisionReplayStatus, sourceReadinessStatus, sourceCaptureStatus, sourceCaptureCompileStatus, sourceCaptureCompileFixtureStatus, realDataIntakeStatus, dataCollectionBriefStatus, dataCollectionProgressStatus, sourceTrustMatrixStatus, nextP0OwnerFormStatus, nextP0OwnerFormFixtureStatus, nextP0OwnerIntakeStatus, nextP0OwnerIntakeFixtureStatus, manualConversionStatus, lineInboundStatus, manualPublishEvidenceFormStatus, manualPublishEvidenceFormFixtureStatus, scheduleStatus, workerDryRunStatus, browserSmokeStatus, trackingLinkSmokeStatus, eventContractSmokeStatus, winRuleFixtureStatus, weekArchiveStatus, launchReadiness, events, week, now);
  const completionAuditStatus = buildGoalCompletionAuditStatus({
    config,
    scores,
    abStatus,
    approvalQueue,
    blocked,
    pipelineStatus,
    nextRoundPlan,
    d1SyncStatus,
    eventInputQualityStatus,
    funnelAggregateStatus,
    funnelAggregateFixtureStatus,
    realDataApplyFixtureStatus,
    realDataDecisionReplayStatus,
    sourceReadinessStatus,
    sourceCaptureStatus,
    sourceCaptureCompileStatus,
    sourceCaptureCompileFixtureStatus,
    realDataIntakeStatus,
    dataCollectionBriefStatus,
    dataCollectionProgressStatus,
    sourceTrustMatrixStatus,
    nextP0OwnerFormStatus,
    nextP0OwnerFormFixtureStatus,
    nextP0OwnerIntakeStatus,
    nextP0OwnerIntakeFixtureStatus,
    manualConversionStatus,
    lineInboundStatus,
    manualPublishEvidenceFormStatus,
    manualPublishEvidenceFormFixtureStatus,
    scheduleStatus,
    workerDryRunStatus,
    browserSmokeStatus,
    trackingLinkSmokeStatus,
    eventContractSmokeStatus,
    winRuleFixtureStatus,
    weekArchiveStatus,
    launchReadiness,
    events,
    week,
    now,
  });
  const githubHandoff = renderGitHubHandoff(config, scheduleStatus, funnelBreakdown, now);
  const ownerApprovalPack = renderOwnerApprovalPack(config, launchReadiness, approvalQueue, blocked, abStatus, scheduleStatus, funnelBreakdown, sourceReadinessStatus, sourceCaptureStatus, sourceCaptureCompileStatus, sourceCaptureCompileFixtureStatus, realDataIntakeStatus, dataCollectionBriefStatus, dataCollectionProgressStatus, nextP0OwnerFormStatus, nextP0OwnerFormFixtureStatus, nextP0OwnerIntakeStatus, nextP0OwnerIntakeFixtureStatus, realDataDecisionReplayStatus, workerDryRunStatus, manualPublishEvidenceFormStatus, manualPublishEvidenceFormFixtureStatus, now);
  const candidateHtml = renderLandingPageCandidate(config);

  await writeJson(SCORES_PATH, scores);
  await writeJson(AB_STATUS_PATH, abStatus);
  await writeJson(TRACKING_LINKS_PATH, trackingLinks);
  await writeJson(CONTENT_VARIANTS_JSON_PATH, contentVariants);
  await writeFile(CONTENT_VARIANTS_MD_PATH, renderContentVariantsMarkdown(config, contentVariants, trackingLinks, now));
  await writeJson(FUNNEL_BREAKDOWN_JSON_PATH, funnelBreakdown);
  await writeFile(FUNNEL_BREAKDOWN_MD_PATH, renderFunnelBreakdownMarkdown(funnelBreakdown, now));
  await writeJson(NEXT_ROUND_PLAN_JSON_PATH, nextRoundPlan);
  await writeFile(NEXT_ROUND_PLAN_MD_PATH, renderNextRoundPlanMarkdown(nextRoundPlan, now));
  await writeJson(PIPELINE_STATUS_PATH, pipelineStatus);
  await writeJson(SCHEDULE_STATUS_PATH, scheduleStatus);
  await writeJson(RETIREMENT_QUEUE_PATH, retirementQueue);
  await writeJson(APPROVAL_PATH, approvalQueue);
  await writeJson(APPROVAL_STATUS_PATH, approvalQueueStatus);
  await writeJson(BLOCKED_PATH, blocked);
  await writeJson(LAUNCH_READINESS_PATH, launchReadiness);
  await writeFile(REPORT_PATH, report);
  await writeFile(COMPLETION_AUDIT_PATH, completionAudit);
  await writeJson(COMPLETION_AUDIT_STATUS_PATH, completionAuditStatus);
  await writeFile(GITHUB_HANDOFF_PATH, githubHandoff);
  await writeFile(OWNER_APPROVAL_PACK_PATH, ownerApprovalPack);
  await writeFile(CANDIDATE_HTML_PATH, candidateHtml);
  await copyFile(WORKER_SOURCE_PATH, WORKER_ARTIFACT_PATH);

  if (VERIFY) {
    await verifyOutputs([
      REPORT_PATH,
      SCORES_PATH,
      APPROVAL_PATH,
      APPROVAL_STATUS_PATH,
      AB_STATUS_PATH,
      TRACKING_LINKS_PATH,
      CONTENT_VARIANTS_JSON_PATH,
      CONTENT_VARIANTS_MD_PATH,
      FUNNEL_BREAKDOWN_JSON_PATH,
      FUNNEL_BREAKDOWN_MD_PATH,
      NEXT_ROUND_PLAN_JSON_PATH,
      NEXT_ROUND_PLAN_MD_PATH,
      PIPELINE_STATUS_PATH,
      SCHEDULE_STATUS_PATH,
      LAUNCHAGENT_STATUS_PATH,
      EVENT_INPUT_QUALITY_STATUS_PATH,
      WORKER_DRY_RUN_REPORT_PATH,
      WORKER_DRY_RUN_STATUS_PATH,
      BROWSER_SMOKE_STATUS_PATH,
      TRACKING_LINK_SMOKE_REPORT_PATH,
      TRACKING_LINK_SMOKE_STATUS_PATH,
      EVENT_CONTRACT_SMOKE_STATUS_PATH,
      D1_SCHEMA_CONTRACT_REPORT_PATH,
      D1_SCHEMA_CONTRACT_STATUS_PATH,
      APPROVED_D1_CONFIG_REPORT_PATH,
      APPROVED_D1_CONFIG_STATUS_PATH,
      CHAMPION_GITHUB_HANDOFF_PATH,
      CHAMPION_GITHUB_PR_BODY_PATH,
      CHAMPION_GITHUB_HANDOFF_STATUS_PATH,
      WIN_RULE_FIXTURE_STATUS_PATH,
      LAUNCHD_PLIST_PATH,
      RETIREMENT_QUEUE_PATH,
      FUNNEL_AGGREGATE_STATUS_PATH,
      FUNNEL_AGGREGATE_EXAMPLE_PATH,
      FUNNEL_AGGREGATE_PREVIEW_PATH,
      FUNNEL_AGGREGATE_FIXTURE_STATUS_PATH,
      FUNNEL_AGGREGATE_FIXTURE_REPORT_PATH,
      REAL_DATA_APPLY_FIXTURE_STATUS_PATH,
      REAL_DATA_APPLY_FIXTURE_REPORT_PATH,
      REAL_DATA_DECISION_REPLAY_STATUS_PATH,
      REAL_DATA_DECISION_REPLAY_REPORT_PATH,
      SOURCE_READINESS_STATUS_PATH,
      SOURCE_READINESS_REPORT_PATH,
      SOURCE_CAPTURE_STATUS_PATH,
      SOURCE_CAPTURE_REPORT_PATH,
      SOURCE_CAPTURE_CHECKLIST_PATH,
      SOURCE_CAPTURE_LEDGER_PATH,
      SOURCE_CAPTURE_SAMPLE_GATE_LEDGER_PATH,
      SAMPLE_GATE_LEDGER_STATUS_PATH,
      SAMPLE_GATE_LEDGER_REPORT_PATH,
      SAMPLE_GATE_COMPILE_PROBE_STATUS_PATH,
      SAMPLE_GATE_COMPILE_PROBE_REPORT_PATH,
      SAMPLE_GATE_COMPILE_PROBE_FUNNEL_PATH,
      SAMPLE_GATE_COMPILE_PROBE_MANUAL_PATH,
      SOURCE_CAPTURE_COMPILE_STATUS_PATH,
      SOURCE_CAPTURE_COMPILE_REPORT_PATH,
      SOURCE_CAPTURE_COMPILE_FIXTURE_STATUS_PATH,
      SOURCE_CAPTURE_COMPILE_FIXTURE_REPORT_PATH,
      SOURCE_CAPTURE_COMPILED_FUNNEL_PATH,
      SOURCE_CAPTURE_COMPILED_MANUAL_PATH,
      REAL_DATA_INTAKE_STATUS_PATH,
      REAL_DATA_INTAKE_PLAN_PATH,
      DATA_COLLECTION_QUEUE_PATH,
      DATA_COLLECTION_BRIEF_PATH,
      DATA_COLLECTION_BRIEF_STATUS_PATH,
      DATA_COLLECTION_PROGRESS_REPORT_PATH,
      DATA_COLLECTION_PROGRESS_JSON_PATH,
      DATA_COLLECTION_PROGRESS_STATUS_PATH,
      NEXT_P0_OWNER_INPUTS_REPORT_PATH,
      NEXT_P0_OWNER_INPUTS_JSON_PATH,
      NEXT_P0_OWNER_INPUTS_STATUS_PATH,
      NEXT_P0_OWNER_FORM_PATH,
      NEXT_P0_OWNER_FORM_STATUS_PATH,
      NEXT_P0_OWNER_FORM_FIXTURE_REPORT_PATH,
      NEXT_P0_OWNER_FORM_FIXTURE_STATUS_PATH,
      SAMPLE_GATE_PLAN_PATH,
      SAMPLE_GATE_PLAN_REPORT_PATH,
      SAMPLE_GATE_STATUS_PATH,
      MANUAL_CONVERSION_STATUS_PATH,
      MANUAL_CONVERSION_EXAMPLE_PATH,
      MANUAL_CONVERSION_PREVIEW_PATH,
      LINE_INBOUND_PLAYBOOK_JSON_PATH,
      LINE_INBOUND_PLAYBOOK_MD_PATH,
      LINE_INBOUND_FIXTURE_STATUS_PATH,
      LINE_INBOUND_FIXTURE_REPORT_PATH,
      BLOCKED_PATH,
      LAUNCH_READINESS_PATH,
      COMPLETION_AUDIT_PATH,
      COMPLETION_AUDIT_STATUS_PATH,
      GITHUB_HANDOFF_PATH,
      OWNER_APPROVAL_PACK_PATH,
      CANDIDATE_HTML_PATH,
      WORKER_ARTIFACT_PATH,
    ]);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: config.mode,
        events: events.length,
        outputs: [
          REPORT_PATH,
          SCORES_PATH,
          APPROVAL_PATH,
          APPROVAL_STATUS_PATH,
          AB_STATUS_PATH,
          TRACKING_LINKS_PATH,
          CONTENT_VARIANTS_JSON_PATH,
          CONTENT_VARIANTS_MD_PATH,
          FUNNEL_BREAKDOWN_JSON_PATH,
          FUNNEL_BREAKDOWN_MD_PATH,
          NEXT_ROUND_PLAN_JSON_PATH,
          NEXT_ROUND_PLAN_MD_PATH,
          PIPELINE_STATUS_PATH,
          SCHEDULE_STATUS_PATH,
          LAUNCHAGENT_STATUS_PATH,
          EVENT_INPUT_QUALITY_STATUS_PATH,
          WORKER_DRY_RUN_REPORT_PATH,
          WORKER_DRY_RUN_STATUS_PATH,
          BROWSER_SMOKE_STATUS_PATH,
          TRACKING_LINK_SMOKE_REPORT_PATH,
          TRACKING_LINK_SMOKE_STATUS_PATH,
          EVENT_CONTRACT_SMOKE_STATUS_PATH,
          WIN_RULE_FIXTURE_STATUS_PATH,
          LAUNCHD_PLIST_PATH,
          RETIREMENT_QUEUE_PATH,
          FUNNEL_AGGREGATE_STATUS_PATH,
          FUNNEL_AGGREGATE_EXAMPLE_PATH,
          FUNNEL_AGGREGATE_PREVIEW_PATH,
          FUNNEL_AGGREGATE_FIXTURE_STATUS_PATH,
          FUNNEL_AGGREGATE_FIXTURE_REPORT_PATH,
          REAL_DATA_APPLY_FIXTURE_STATUS_PATH,
          REAL_DATA_APPLY_FIXTURE_REPORT_PATH,
          REAL_DATA_DECISION_REPLAY_STATUS_PATH,
          REAL_DATA_DECISION_REPLAY_REPORT_PATH,
          SOURCE_READINESS_STATUS_PATH,
          SOURCE_READINESS_REPORT_PATH,
          SOURCE_CAPTURE_STATUS_PATH,
          SOURCE_CAPTURE_REPORT_PATH,
          SOURCE_CAPTURE_CHECKLIST_PATH,
          SOURCE_CAPTURE_LEDGER_PATH,
          SOURCE_CAPTURE_COMPILE_STATUS_PATH,
          SOURCE_CAPTURE_COMPILE_REPORT_PATH,
          SOURCE_CAPTURE_COMPILE_FIXTURE_STATUS_PATH,
          SOURCE_CAPTURE_COMPILE_FIXTURE_REPORT_PATH,
          SOURCE_CAPTURE_COMPILED_FUNNEL_PATH,
          SOURCE_CAPTURE_COMPILED_MANUAL_PATH,
          REAL_DATA_INTAKE_STATUS_PATH,
          REAL_DATA_INTAKE_PLAN_PATH,
          DATA_COLLECTION_QUEUE_PATH,
          DATA_COLLECTION_BRIEF_PATH,
          DATA_COLLECTION_BRIEF_STATUS_PATH,
          DATA_COLLECTION_PROGRESS_REPORT_PATH,
          DATA_COLLECTION_PROGRESS_JSON_PATH,
          DATA_COLLECTION_PROGRESS_STATUS_PATH,
          NEXT_P0_OWNER_INPUTS_REPORT_PATH,
          NEXT_P0_OWNER_INPUTS_JSON_PATH,
          NEXT_P0_OWNER_INPUTS_STATUS_PATH,
          NEXT_P0_OWNER_FORM_PATH,
          NEXT_P0_OWNER_FORM_STATUS_PATH,
          NEXT_P0_OWNER_FORM_FIXTURE_REPORT_PATH,
          NEXT_P0_OWNER_FORM_FIXTURE_STATUS_PATH,
          MANUAL_CONVERSION_STATUS_PATH,
          MANUAL_CONVERSION_EXAMPLE_PATH,
          MANUAL_CONVERSION_PREVIEW_PATH,
          LINE_INBOUND_PLAYBOOK_JSON_PATH,
          LINE_INBOUND_PLAYBOOK_MD_PATH,
          LINE_INBOUND_FIXTURE_STATUS_PATH,
          LINE_INBOUND_FIXTURE_REPORT_PATH,
          BLOCKED_PATH,
          LAUNCH_READINESS_PATH,
          COMPLETION_AUDIT_PATH,
          COMPLETION_AUDIT_STATUS_PATH,
          GITHUB_HANDOFF_PATH,
          OWNER_APPROVAL_PACK_PATH,
          CANDIDATE_HTML_PATH,
          WORKER_ARTIFACT_PATH,
        ],
      },
      null,
      2,
    ),
  );
}

async function ensureEventFile() {
  await mkdir(path.dirname(EVENTS_PATH), { recursive: true });
  try {
    await access(EVENTS_PATH);
  } catch {
    await writeFile(EVENTS_PATH, "");
  }
}

async function readEvents(filePath) {
  const raw = await readFile(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const event = JSON.parse(line);
      if (!EVENT_TYPES.includes(event.event_type)) {
        throw new Error(`Invalid event_type at line ${index + 1}: ${event.event_type}`);
      }
      return event;
    });
}

async function readD1SyncStatus() {
  try {
    const raw = await readFile(D1_SYNC_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      scope: "not_run",
      rows_exported: 0,
      output_path: null,
      external_effect: false,
      note: "D1 export has not run yet. Use npm run collect:d1:local for local review.",
    };
  }
}

async function readEventInputQualityStatus() {
  try {
    const raw = await readFile(EVENT_INPUT_QUALITY_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      input_path: EVENTS_PATH,
      rows_scanned: 0,
      event_type_counts: {},
      asset_counts: {},
      duplicate_event_ids: [],
      issues: [],
      warnings: [],
      scoring_allowed: false,
      pii_or_sensitive_data_detected: false,
      unknown_asset_ids: [],
      unknown_event_types: [],
      unknown_keys: [],
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      data_lp_events_write_performed: false,
      note: "Event input quality gate has not run yet. Use npm run event:quality.",
    };
  }
}

async function readManualConversionStatus() {
  try {
    const raw = await readFile(MANUAL_CONVERSION_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      events_written: 0,
      output_path: null,
      contains_sensitive_columns: false,
      contains_sensitive_values: false,
      apply_performed: false,
      append_performed: false,
      external_effect: false,
      note: "Manual aggregate conversion preview has not run yet. Use npm run import:manual:preview.",
    };
  }
}

async function readFunnelAggregateStatus() {
  try {
    const raw = await readFile(FUNNEL_AGGREGATE_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      events_written: 0,
      output_path: null,
      counts_by_event_type: {},
      contains_sensitive_columns: false,
      contains_sensitive_values: false,
      apply_performed: false,
      append_performed: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      note: "Full-funnel aggregate preview has not run yet. Use npm run import:funnel:preview.",
    };
  }
}

async function readFunnelAggregateFixtureStatus() {
  try {
    const raw = await readFile(FUNNEL_AGGREGATE_FIXTURE_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      scenario_count: 0,
      report_path: FUNNEL_AGGREGATE_FIXTURE_REPORT_PATH,
      execution_performed: false,
      real_event_write_performed: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      scenarios: [],
      note: "Full-funnel aggregate fixture guard has not run yet. Use npm run funnel:fixtures.",
    };
  }
}

async function readRealDataApplyFixtureStatus() {
  try {
    const raw = await readFile(REAL_DATA_APPLY_FIXTURE_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      scenario_count: 0,
      report_path: REAL_DATA_APPLY_FIXTURE_REPORT_PATH,
      execution_performed: false,
      real_event_write_performed: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      scenarios: [],
      note: "Real-data apply fixture guard has not run yet. Use npm run apply:fixtures.",
    };
  }
}

async function readRealDataDecisionReplayStatus() {
  try {
    const raw = await readFile(REAL_DATA_DECISION_REPLAY_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      scenario_count: 0,
      scenario_ids: [],
      report_path: REAL_DATA_DECISION_REPLAY_REPORT_PATH,
      local_fixture_commands_executed: false,
      local_importer_preview_commands_executed: false,
      execution_performed: false,
      real_events_unchanged: false,
      real_event_write_performed: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      scenarios: [],
      note: "Real-data decision replay has not run yet. Use npm run decision:replay.",
    };
  }
}

async function readSourceReadinessStatus() {
  try {
    const raw = await readFile(SOURCE_READINESS_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      status: "not_run",
      status_path: SOURCE_READINESS_STATUS_PATH,
      report_path: SOURCE_READINESS_REPORT_PATH,
      real_event_rows: 0,
      event_counts: {},
      sample_progress: {
        min_visits: 100,
        min_cta_clicks: 20,
        min_line_adds: 5,
        min_test_days: 3,
        preferred_test_days: 7,
        sample_threshold_met: false,
      },
      scoring_allowed: false,
      ready_for_public_iteration_decision: false,
      champion_url_ready: false,
      stages: [],
      missing_stage_count: 7,
      missing_stages: ["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"],
      apply_performed: false,
      append_performed: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      note: "Source readiness monitor has not run yet. Use npm run source:readiness.",
    };
  }
}

async function readSourceCaptureStatus() {
  try {
    const raw = await readFile(SOURCE_CAPTURE_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      status: "not_run",
      status_path: SOURCE_CAPTURE_STATUS_PATH,
      report_path: SOURCE_CAPTURE_REPORT_PATH,
      checklist_path: SOURCE_CAPTURE_CHECKLIST_PATH,
      ledger_template_path: SOURCE_CAPTURE_LEDGER_PATH,
      tracking_links_total: 0,
      importable_tracking_links: 0,
      ab_router_gate_count: 0,
      stage_count: 0,
      ledger_rows: 0,
      template_only: false,
      owner_review_required: true,
      live_input_files_created: false,
      real_events_before: 0,
      real_events_after: 0,
      real_events_unchanged: true,
      apply_performed: false,
      append_performed: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      note: "Source capture pack has not run yet. Use npm run source:capture.",
    };
  }
}

async function readSourceCaptureCompileStatus() {
  try {
    const raw = await readFile(SOURCE_CAPTURE_COMPILE_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      status: "not_run",
      status_path: SOURCE_CAPTURE_COMPILE_STATUS_PATH,
      report_path: SOURCE_CAPTURE_COMPILE_REPORT_PATH,
      output_dir: path.dirname(SOURCE_CAPTURE_COMPILED_FUNNEL_PATH),
      funnel_preview_path: SOURCE_CAPTURE_COMPILED_FUNNEL_PATH,
      manual_preview_path: SOURCE_CAPTURE_COMPILED_MANUAL_PATH,
      input_kind: "not_run",
      ledger_rows_read: 0,
      filled_rows: 0,
      empty_rows: 0,
      funnel_rows: 0,
      manual_rows: 0,
      issue_count: 0,
      issues: [],
      warning_count: 0,
      warnings: [],
      counts_by_event_type: {},
      counts_by_target_file: {},
      owner_review_required: true,
      live_input_files_created: false,
      apply_performed: false,
      append_performed: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      note: "Source capture compile preview has not run yet. Use npm run source:compile.",
    };
  }
}

async function readSourceCaptureCompileFixtureStatus() {
  try {
    const raw = await readFile(SOURCE_CAPTURE_COMPILE_FIXTURE_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      status_path: SOURCE_CAPTURE_COMPILE_FIXTURE_STATUS_PATH,
      report_path: SOURCE_CAPTURE_COMPILE_FIXTURE_REPORT_PATH,
      scenario_count: 0,
      scenarios: [],
      local_fixture_commands_executed: false,
      execution_performed: false,
      real_event_write_performed: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      note: "Source capture compile fixtures have not run yet. Use npm run source:compile:fixtures.",
    };
  }
}

async function readRealDataIntakeStatus() {
  try {
    const raw = await readFile(REAL_DATA_INTAKE_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      status: "not_run",
      status_path: REAL_DATA_INTAKE_STATUS_PATH,
      report_path: REAL_DATA_INTAKE_PLAN_PATH,
      real_events_before: 0,
      real_events_after: 0,
      real_events_unchanged: true,
      has_real_input_files: false,
      missing_input_count: 2,
      ready_apply_count: 0,
      blocked_input_count: 0,
      owner_review_required: true,
      owner_apply_commands: [],
      input_files: [],
      apply_performed: false,
      append_performed: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      note: "Real data intake plan has not run yet. Use npm run real-data:intake.",
    };
  }
}

async function readDataCollectionBriefStatus() {
  try {
    const raw = await readFile(DATA_COLLECTION_BRIEF_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      status: "not_run",
      queue_path: DATA_COLLECTION_QUEUE_PATH,
      brief_path: DATA_COLLECTION_BRIEF_PATH,
      task_count: 0,
      stage_count: 0,
      importable_link_count: 0,
      gated_link_count: 0,
      filled_ledger_exists: false,
      sample_threshold_met: false,
      missing_stage_count: 7,
      real_events_unchanged: true,
      live_input_files_created: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      note: "Data collection brief has not run yet. Use npm run data:brief.",
    };
  }
}

async function readDataCollectionProgressStatus() {
  try {
    const raw = await readFile(DATA_COLLECTION_PROGRESS_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      status: "not_run",
      total_task_count: 0,
      filled_task_count: 0,
      pending_task_count: 0,
      p0_task_count: 0,
      p0_pending_count: 0,
      p1_task_count: 0,
      p1_pending_count: 0,
      source_group_count: 0,
      sample_threshold_met: false,
      sample_rate_win_candidate: false,
      owner_sample_gate_status: "unknown",
      next_owner_input_count: 0,
      real_events_unchanged: true,
      live_input_files_created: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      note: "Data collection progress has not run yet. Use npm run data:progress.",
    };
  }
}

async function readSourceTrustMatrixStatus() {
  try {
    const raw = await readFile(SOURCE_TRUST_MATRIX_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      status: "not_run",
      status_path: SOURCE_TRUST_MATRIX_STATUS_PATH,
      report_path: SOURCE_TRUST_MATRIX_REPORT_PATH,
      matrix_path: SOURCE_TRUST_MATRIX_JSON_PATH,
      trusted_scoring_source_count: 0,
      sample_gate_source_count: 0,
      scoring_allowed_now: false,
      real_event_rows: 0,
      p0_pending_count: 0,
      sample_threshold_met: false,
      ready_for_public_iteration_decision: false,
      local_review_only_source_count: 0,
      review_ready_source_count: 0,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      note: "Source trust matrix has not run yet. Use npm run source:trust.",
    };
  }
}

async function readNextP0OwnerFormStatus() {
  try {
    const raw = await readFile(NEXT_P0_OWNER_FORM_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      status: "not_run",
      row_count: 0,
      current_input_count: 0,
      p0_pending_count: 0,
      p1_pending_count: 0,
      source_group_count: 0,
      download_filename: "next_p0_owner_inputs.filled.csv",
      json_download_filename: "next_p0_owner_inputs.review.json",
      browser_only: false,
      browser_persistence: false,
      network_calls_performed: false,
      real_events_unchanged: true,
      live_input_files_created: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      note: "Next P0 owner form has not run yet. Use npm run next-p0:form.",
    };
  }
}

async function readNextP0OwnerFormFixtureStatus() {
  try {
    const raw = await readFile(NEXT_P0_OWNER_FORM_FIXTURE_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      scenario_count: 0,
      browser_form_static_checks_executed: false,
      export_contract_verified: false,
      local_fixture_commands_executed: false,
      real_events_unchanged: true,
      live_input_files_created: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      note: "Next P0 owner form fixtures have not run yet. Use npm run next-p0:form:fixtures.",
    };
  }
}

async function readNextP0OwnerIntakeStatus() {
  try {
    const raw = await readFile(NEXT_P0_OWNER_INTAKE_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      status: "not_run",
      candidate_found: false,
      candidate_valid: false,
      expected_row_count: 0,
      downloaded_row_count: 0,
      filled_rows: 0,
      funnel_preview_rows: 0,
      manual_preview_rows: 0,
      stage_performed: false,
      live_input_files_created: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      note: "Next P0 owner intake has not run yet. Use npm run next-p0:intake.",
    };
  }
}

async function readNextP0OwnerIntakeFixtureStatus() {
  try {
    const raw = await readFile(NEXT_P0_OWNER_INTAKE_FIXTURE_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      scenario_count: 0,
      local_fixture_commands_executed: false,
      live_project_inputs_created: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      note: "Next P0 owner intake fixtures have not run yet. Use npm run next-p0:intake:fixtures.",
    };
  }
}

async function readLineInboundStatus() {
  try {
    const raw = await readFile(LINE_INBOUND_FIXTURE_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      scenario_count: 0,
      playbook_json_path: LINE_INBOUND_PLAYBOOK_JSON_PATH,
      playbook_md_path: LINE_INBOUND_PLAYBOOK_MD_PATH,
      execution_performed: false,
      external_effect: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      data_lp_events_write_performed: false,
      scenarios: [],
      checks: [],
      note: "LINE inbound playbook has not run yet. Use npm run line:playbook.",
    };
  }
}

async function readManualPublishEvidenceFormStatus() {
  try {
    const raw = await readFile(MANUAL_PUBLISH_EVIDENCE_FORM_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      status: "not_run",
      form_path: MANUAL_PUBLISH_EVIDENCE_FORM_PATH,
      status_path: MANUAL_PUBLISH_EVIDENCE_FORM_STATUS_PATH,
      owner_input_exists: false,
      packet_count: 0,
      browser_only: false,
      browser_persistence: false,
      form_action: "unknown",
      network_calls_performed: false,
      post_url_fetch_performed: false,
      live_input_files_created: false,
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
      note: "Manual publish evidence browser form has not run yet. Use npm run manual:publish-evidence:form.",
    };
  }
}

async function readManualPublishEvidenceFormFixtureStatus() {
  try {
    const raw = await readFile(MANUAL_PUBLISH_EVIDENCE_FORM_FIXTURE_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      scenario_count: 0,
      form_html_path: MANUAL_PUBLISH_EVIDENCE_FORM_PATH,
      form_status_path: MANUAL_PUBLISH_EVIDENCE_FORM_STATUS_PATH,
      contract_checks: [],
      scenarios: [],
      local_fixture_commands_executed: false,
      form_export_replay_executed: false,
      evidence_intake_commands_executed: false,
      live_input_files_created: false,
      execution_performed: false,
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
      note: "Manual publish evidence form fixtures have not run yet. Use npm run manual:publish-evidence:form:fixtures.",
    };
  }
}

async function readWeeklyRunnerStatus() {
  try {
    const raw = await readFile(WEEKLY_RUNNER_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      status: "not_run",
      log_path: null,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
    };
  }
}

async function readWeekArchiveStatus() {
  try {
    const raw = await readFile(WEEK_ARCHIVE_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      status: "not_run",
      archive_dir: null,
      manifest_path: null,
      files_archived: 0,
      expected_files: 0,
      missing_files: [],
      immutable_snapshot: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      note: "Weekly archive snapshot has not run yet. Use npm run archive:week after artifacts are generated.",
    };
  }
}

async function readLaunchAgentStatus() {
  try {
    const raw = await readFile(LAUNCHAGENT_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      action: "not_run",
      launchd_installed: false,
      install_performed: false,
      uninstall_performed: false,
      file_installed: false,
      service_loaded: false,
      local_persistent_schedule: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
    };
  }
}

async function readWorkerDryRunStatus() {
  try {
    const raw = await readFile(WORKER_DRY_RUN_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      command: "wrangler deploy --dry-run",
      exit_code: null,
      log_path: null,
      report_path: WORKER_DRY_RUN_REPORT_PATH,
      dry_run_exit_observed: false,
      required_markers_present: false,
      failed_markers: [],
      external_effect: false,
      data_lp_events_write_performed: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      note: "Worker dry-run status has not run yet. Use npm run worker:dry-run:status.",
    };
  }
}

async function readBrowserSmokeStatus() {
  try {
    const raw = await readFile(BROWSER_SMOKE_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      base_url: null,
      log_path: null,
      checks: [],
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      event_write_performed: false,
      note: "Browser route smoke has not run yet. Use npm run browser:smoke.",
    };
  }
}

async function readTrackingLinkSmokeStatus() {
  try {
    const raw = await readFile(TRACKING_LINK_SMOKE_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      links_checked: 0,
      expected_link_count: 0,
      isolated_link_click_events_written: 0,
      checks: [],
      isolated_fixture_event_write_performed: false,
      real_event_write_performed: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      note: "Tracking link smoke has not run yet. Use npm run tracking:smoke.",
    };
  }
}

async function readEventContractSmokeStatus() {
  try {
    const raw = await readFile(EVENT_CONTRACT_SMOKE_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      event_type_counts: {},
      sensitive_rejection: null,
      invalid_event_rejection: null,
      isolated_fixture_event_write_performed: false,
      real_event_write_performed: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      note: "Event contract smoke has not run yet. Use npm run event:smoke.",
    };
  }
}

async function readWinRuleFixtureStatus() {
  try {
    const raw = await readFile(WIN_RULE_FIXTURE_STATUS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      mode: "not_run",
      scenario_count: 0,
      report_path: "win_rule_fixture_report.md",
      external_effect: false,
      real_event_write_performed: false,
      production_deploy_performed: false,
      public_link_change_performed: false,
      challenger_promotion_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      scenarios: [],
      note: "Win-rule fixture simulator has not run yet. Use npm run win-rule:fixtures.",
    };
  }
}

function buildScheduleStatus(config, weeklyRunnerStatus, launchAgentStatus, now) {
  const launchdInstalled = Boolean(launchAgentStatus.launchd_installed);
  const launchctlRuntime = launchAgentStatus.launchctl_runtime ?? {};
  return {
    generated_at: now.toISOString(),
    timezone: config.timezone,
    cadence: "weekly_sunday",
    local_runner_command: "npm run weekly:local",
    launchagent_status_file: "data/launchagent_status.json",
    launchd_template: "launchd/com.angelia.3q-growth-loop.weekly.plist",
    launchd_installed: launchdInstalled,
    install_performed: launchdInstalled || Boolean(launchAgentStatus.install_performed),
    uninstall_performed: Boolean(launchAgentStatus.uninstall_performed),
    file_installed: Boolean(launchAgentStatus.file_installed),
    service_loaded: Boolean(launchAgentStatus.service_loaded),
    local_persistent_schedule: launchdInstalled,
    external_effect: false,
    local_schedule: {
      weekday: "Sunday",
      hour: 0,
      minute: 10,
      timezone: "Asia/Taipei",
    },
    worker_cron: {
      expression: "0 16 * * SAT",
      timezone_interpretation: "UTC",
      taipei_time: "Sunday 00:00",
      production_deploy_required: true,
      production_deploy_performed: false,
    },
    weekly_sequence: config.weekly_sequence,
    runner_status: {
      ok: Boolean(weeklyRunnerStatus.ok),
      status: weeklyRunnerStatus.status ?? "unknown",
      finished_at: weeklyRunnerStatus.finished_at ?? null,
      log_path: weeklyRunnerStatus.log_path ?? null,
      external_effect: false,
    },
    launchagent_status: {
      ok: Boolean(launchAgentStatus.ok),
      action: launchAgentStatus.action ?? "unknown",
      label: launchAgentStatus.label ?? "com.angelia.3q-growth-loop.weekly",
      file_installed: Boolean(launchAgentStatus.file_installed),
      service_loaded: Boolean(launchAgentStatus.service_loaded),
      state: launchctlRuntime.state ?? null,
      active_count: launchctlRuntime.active_count ?? null,
      run_count: launchctlRuntime.run_count ?? null,
      last_exit_code: launchctlRuntime.last_exit_code ?? null,
      observed_successful_run: Boolean(launchctlRuntime.observed_successful_run),
      current_launchd_invocation_observed: Boolean(launchctlRuntime.current_launchd_invocation_observed),
      current_process_descends_from_service: Boolean(launchctlRuntime.current_process_descends_from_service),
      proof_kind: launchctlRuntime.proof_kind ?? (launchctlRuntime.observed_successful_run ? "completed_exit_zero" : "none"),
      rollback_command: launchAgentStatus.rollback_command ?? "npm run schedule:uninstall",
      external_effect: false,
    },
    red_lines_preserved: {
      production_deploy_performed: false,
      public_link_change_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
    },
  };
}

function buildTrackingLinks(config, week) {
  const baseUrl = config.local_public_base_url ?? "http://127.0.0.1:8787";
  const links = [];
  for (const asset of config.assets) {
    const target = asset.role === "champion" ? "champion" : "challenger";
    const url = new URL(`/r/${encodeURIComponent(asset.asset_id)}`, baseUrl);
    url.searchParams.set("to", target);
    url.searchParams.set("utm_source", "manual_review");
    url.searchParams.set("utm_medium", "growth_loop");
    url.searchParams.set("utm_campaign", config.current_round.round_id);
    url.searchParams.set("variant_id", asset.asset_id);
    url.searchParams.set("content_id", `${week.start}-${asset.role}`);
    links.push({
      link_id: `track-${asset.asset_id}`,
      asset_id: asset.asset_id,
      role: asset.role,
      status: asset.role === "champion" ? asset.status : "candidate_local_only",
      target,
      tracking_url: url.toString(),
      destination_url: target === "champion" ? asset.landing_url : asset.landing_url,
      line_url: asset.line_url,
      external_effect: false,
      human_gate: asset.role === "champion" ? "Live champion URL verified read-only; do not change public routing without owner approval." : "Do not place this URL in public bio/post until owner approves small-traffic test.",
    });
  }

  const lineCandidate = config.assets.find((asset) => asset.role === "challenger") ?? config.assets[0];
  if (lineCandidate) {
    const lineUrl = new URL(`/r/${encodeURIComponent(lineCandidate.asset_id)}`, baseUrl);
    lineUrl.searchParams.set("to", "line");
    lineUrl.searchParams.set("utm_source", "manual_review");
    lineUrl.searchParams.set("utm_medium", "growth_loop");
    lineUrl.searchParams.set("utm_campaign", config.current_round.round_id);
    lineUrl.searchParams.set("variant_id", `${lineCandidate.asset_id}-line`);
    lineUrl.searchParams.set("content_id", `${week.start}-line-cta`);
    links.push({
      link_id: `track-${lineCandidate.asset_id}-line`,
      asset_id: lineCandidate.asset_id,
      role: "line_cta",
      status: "candidate_local_only",
      target: "line",
      tracking_url: lineUrl.toString(),
      destination_url: lineCandidate.line_url,
      line_url: lineCandidate.line_url,
      external_effect: false,
      human_gate: "Do not use this LINE tracking redirect in public traffic until owner approves.",
    });

    for (const draft of config.content_variant_drafts ?? []) {
      const postUrl = new URL(`/r/${encodeURIComponent(lineCandidate.asset_id)}`, baseUrl);
      postUrl.searchParams.set("to", "challenger");
      postUrl.searchParams.set("utm_source", "manual_review");
      postUrl.searchParams.set("utm_medium", "growth_loop");
      postUrl.searchParams.set("utm_campaign", config.current_round.round_id);
      postUrl.searchParams.set("variant_id", draft.variant_id);
      postUrl.searchParams.set("content_id", draft.content_id);
      links.push({
        link_id: `post-${draft.content_id}-${draft.variant_id}`,
        asset_id: lineCandidate.asset_id,
        role: "content_variant",
        status: "draft_only_human_publish_required",
        target: "challenger",
        surface: draft.surface,
        content_id: draft.content_id,
        variant_id: draft.variant_id,
        changed_variable: config.current_round.changed_variable,
        cta_text: draft.cta_text,
        tracking_url: postUrl.toString(),
        destination_url: lineCandidate.landing_url,
        line_url: lineCandidate.line_url,
        external_effect: false,
        human_gate: "Draft-only post tracking link. Do not publish, schedule, or place it in public traffic until owner approves the exact surface and copy.",
      });
    }
  }

  const abUrl = new URL(`/ab/${encodeURIComponent(config.ab_plan.test_id)}`, baseUrl);
  abUrl.searchParams.set("utm_source", "manual_review");
  abUrl.searchParams.set("utm_medium", "growth_loop");
  abUrl.searchParams.set("utm_campaign", config.current_round.round_id);
  abUrl.searchParams.set("content_id", `${week.start}-ab-router`);
  links.push({
    link_id: `ab-${config.ab_plan.test_id}`,
    asset_id: `${config.assets.find((asset) => asset.role === "champion")?.asset_id ?? "champion"}:${config.assets.find((asset) => asset.role === "challenger")?.asset_id ?? "challenger"}`,
    role: "ab_small_traffic",
    status: "draft_needs_human_link_gate",
    target: "ab_router",
    tracking_url: abUrl.toString(),
    destination_url: `${baseUrl}/ab/${encodeURIComponent(config.ab_plan.test_id)}`,
    line_url: lineCandidate?.line_url ?? null,
    external_effect: false,
    traffic_allocation: config.ab_plan.traffic_allocation,
    human_gate: "Do not use this A/B router in public traffic until owner confirms champion URL, 10% challenger allocation, duration, and rollback.",
  });

  return {
    generated_at: new Date().toISOString(),
    week,
    base_url: baseUrl,
    public_link_change_performed: false,
    links,
  };
}

function buildContentVariants(config, trackingLinks, now) {
  const changedVariable = config.current_round.changed_variable;
  const lockedVariables = config.locked_variables ?? {};
  const challengerLink = trackingLinks.links.find((link) => link.role === "challenger")?.tracking_url ?? "landing_page_candidate.html";
  const drafts = (config.content_variant_drafts ?? []).map((draft) => ({
    ...draft,
    changed_variable: changedVariable,
    locked_variables: lockedVariables,
    tracking_url: trackingLinks.links.find((link) => link.role === "content_variant" && link.content_id === draft.content_id && link.variant_id === draft.variant_id)?.tracking_url ?? challengerLink,
    final_gate: "draft_only_human_publish_required",
    external_effect: false,
  }));

  return {
    generated_at: now.toISOString(),
    round_id: config.current_round.round_id,
    changed_variable: changedVariable,
    one_variable_rule_ok: config.one_variable_per_round.includes(changedVariable),
    locked_variables: lockedVariables,
    drafts,
  };
}

function buildFunnelBreakdown(config, events, trackingLinks, week, now) {
  const rows = new Map();
  const seedRoles = new Set(["content_variant", "challenger", "line_cta", "ab_small_traffic"]);
  const contentVariantLinks = trackingLinks.links.filter((link) => link.role === "content_variant");

  for (const link of trackingLinks.links.filter((item) => seedRoles.has(item.role))) {
    const parsedUrl = safeUrl(link.tracking_url);
    const source = parsedUrl?.searchParams.get("utm_source") ?? "manual_review";
    const medium = parsedUrl?.searchParams.get("utm_medium") ?? "growth_loop";
    const campaign = parsedUrl?.searchParams.get("utm_campaign") ?? config.current_round.round_id;
    const contentId = link.content_id ?? parsedUrl?.searchParams.get("content_id") ?? `${week.start}-${link.role}`;
    const variantId = link.variant_id ?? parsedUrl?.searchParams.get("variant_id") ?? link.asset_id;
    const key = breakdownKey(link.asset_id, contentId, variantId, source, medium, campaign);
    if (!rows.has(key)) {
      rows.set(key, baseBreakdownRow({
        asset_id: link.asset_id,
        role: link.role,
        content_id: contentId,
        variant_id: variantId,
        source,
        medium,
        campaign,
        tracking_url: link.tracking_url,
        human_gate: link.human_gate,
        seeded_from_tracking_link: true,
      }));
    }
  }

  for (const event of events) {
    const asset = config.assets.find((item) => item.asset_id === event.asset_id);
    const metadata = parseMetadata(event.metadata_json);
    const source = event.source ?? metadata.source ?? "unknown";
    const medium = event.medium ?? metadata.medium ?? "unknown";
    const campaign = event.campaign ?? metadata.campaign ?? config.current_round.round_id;
    const contentId = event.content_id ?? metadata.content_id ?? "unknown";
    const variantId = event.variant_id ?? metadata.variant_id ?? event.asset_id;
    const key = breakdownKey(event.asset_id, contentId, variantId, source, medium, campaign);
    if (!rows.has(key)) {
      rows.set(key, baseBreakdownRow({
        asset_id: event.asset_id,
        role: asset?.role ?? "observed_event",
        content_id: contentId,
        variant_id: variantId,
        source,
        medium,
        campaign,
        tracking_url: null,
        human_gate: "Observed event grouping only; no public link action was performed by this runner.",
        seeded_from_tracking_link: false,
      }));
    }

    const row = rows.get(key);
    if (event.event_type === "link_click") row.link_clicks += 1;
    if (event.event_type === "page_view") row.visits += 1;
    if (event.event_type === "cta_click") row.cta_clicks += 1;
    if (event.event_type === "line_add") row.line_adds += 1;
    if (event.event_type === "lead_submit") row.leads += 1;
    if (event.event_type === "deal") row.deals += 1;
    if (event.event_type === "quality_flag") {
      row.quality_flags += 1;
      if (Number(event.quality_score ?? metadata.quality_score ?? 1) < 0.5) {
        row.low_quality_flags += 1;
      }
    }
  }

  const thresholds = config.sample_thresholds;
  const calculatedRows = Array.from(rows.values())
    .map((row) => {
      const clicks = row.link_clicks;
      const rates = canonicalRates(row);
      const lineAddRate = rates.line_add_rate;
      const leadRate = rates.lead_rate;
      const closeRate = rates.close_rate;
      const spamFlagRate = safeDivide(row.low_quality_flags, row.quality_flags);
      const sampleThresholdMet =
        row.visits >= thresholds.min_visits &&
        row.cta_clicks >= thresholds.min_cta_clicks &&
        row.line_adds >= thresholds.min_line_adds;
      return {
        ...row,
        line_add_rate: round(lineAddRate),
        lead_rate: round(leadRate),
        close_rate: round(closeRate),
        line_adds_per_100_clicks: clicks > 0 ? round((row.line_adds / clicks) * 100) : null,
        leads_per_100_clicks: clicks > 0 ? round((row.leads / clicks) * 100) : null,
        deals_per_100_clicks: clicks > 0 ? round((row.deals / clicks) * 100) : null,
        sample_threshold_met: sampleThresholdMet,
        spam_flag_rate: round(spamFlagRate),
        quality_regression_reasons:
          row.quality_flags > 0 && spamFlagRate > (config.quality_rules?.max_spam_flag_rate ?? 0.05)
            ? ["spam_flag_rate_above_limit"]
            : [],
        no_quality_regression: row.quality_flags === 0 || spamFlagRate <= (config.quality_rules?.max_spam_flag_rate ?? 0.05),
        external_effect: false,
      };
    })
    .sort((left, right) => {
      if (left.role === "content_variant" && right.role !== "content_variant") return -1;
      if (left.role !== "content_variant" && right.role === "content_variant") return 1;
      return (right.link_clicks + right.line_adds + right.leads + right.deals) - (left.link_clicks + left.line_adds + left.leads + left.deals);
    });

  return {
    generated_at: now.toISOString(),
    week,
    mode: "content_variant_attribution",
    thresholds,
    changed_variable: config.current_round.changed_variable,
    rows: calculatedRows,
    summary: {
      content_variant_links: contentVariantLinks.length,
      rows: calculatedRows.length,
      real_events: events.length,
      seeded_rows: calculatedRows.filter((row) => row.seeded_from_tracking_link).length,
    },
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
}

function baseBreakdownRow({ asset_id, role, content_id, variant_id, source, medium, campaign, tracking_url, human_gate, seeded_from_tracking_link }) {
  return {
    asset_id,
    role,
    content_id,
    variant_id,
    source,
    medium,
    campaign,
    tracking_url,
    human_gate,
    seeded_from_tracking_link,
    link_clicks: 0,
    visits: 0,
    cta_clicks: 0,
    line_adds: 0,
    leads: 0,
    deals: 0,
    quality_flags: 0,
    low_quality_flags: 0,
  };
}

function breakdownKey(assetId, contentId, variantId, source, medium, campaign) {
  return [assetId, contentId, variantId, source, medium, campaign].join("\u001f");
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function parseMetadata(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function scoreAssets(config, events, week) {
  const thresholds = config.sample_thresholds;
  const byAsset = new Map();
  for (const asset of config.assets) {
    byAsset.set(asset.asset_id, {
      ...asset,
      link_clicks: 0,
      visits: 0,
      cta_clicks: 0,
      line_adds: 0,
      leads: 0,
      deals: 0,
      quality_flags: 0,
      low_quality_flags: 0,
      first_event_at: null,
      last_event_at: null,
      test_days: 0,
    });
  }

  for (const event of events) {
    if (!byAsset.has(event.asset_id)) {
      byAsset.set(event.asset_id, {
        asset_id: event.asset_id,
        role: "unknown",
        name: event.asset_id,
        landing_url: "unknown",
        line_url: null,
        changed_variable: null,
        status: "observed_only",
        link_clicks: 0,
        visits: 0,
        cta_clicks: 0,
        line_adds: 0,
        leads: 0,
        deals: 0,
        quality_flags: 0,
        low_quality_flags: 0,
        first_event_at: null,
        last_event_at: null,
        test_days: 0,
      });
    }

    const row = byAsset.get(event.asset_id);
    const occurredAt = new Date(event.occurred_at);
    if (!Number.isNaN(occurredAt.valueOf())) {
      row.first_event_at = row.first_event_at && row.first_event_at < event.occurred_at ? row.first_event_at : event.occurred_at;
      row.last_event_at = row.last_event_at && row.last_event_at > event.occurred_at ? row.last_event_at : event.occurred_at;
    }

    if (event.event_type === "link_click") row.link_clicks += 1;
    if (event.event_type === "page_view") row.visits += 1;
    if (event.event_type === "cta_click") row.cta_clicks += 1;
    if (event.event_type === "line_add") row.line_adds += 1;
    if (event.event_type === "lead_submit") row.leads += 1;
    if (event.event_type === "deal") row.deals += 1;
    if (event.event_type === "quality_flag") {
      row.quality_flags += 1;
      if (Number(event.quality_score ?? 1) < 0.5) {
        row.low_quality_flags += 1;
      }
    }
  }

  const rows = Array.from(byAsset.values()).map((row) => {
    const rates = canonicalRates(row);
    const ctaRate = rates.cta_rate;
    const lineAddRate = rates.line_add_rate;
    const leadRate = rates.lead_rate;
    const closeRate = rates.close_rate;
    const testDays = calculateTestDays(row.first_event_at, row.last_event_at);
    const spamFlagRate = safeDivide(row.low_quality_flags, row.quality_flags);
    const sampleThresholdMet =
      row.visits >= thresholds.min_visits &&
      row.cta_clicks >= thresholds.min_cta_clicks &&
      row.line_adds >= thresholds.min_line_adds &&
      testDays >= thresholds.min_test_days;
    const score = Number((lineAddRate * 50 + leadRate * 30 + closeRate * 20).toFixed(4));

    return {
      ...row,
      week_start: week.start,
      week_end: week.end,
      cta_rate: round(ctaRate),
      line_add_rate: round(lineAddRate),
      lead_rate: round(leadRate),
      close_rate: round(closeRate),
      score,
      test_days: testDays,
      sample_threshold_met: sampleThresholdMet,
      spam_flag_rate: round(spamFlagRate),
      lead_rate_retention_vs_champion: null,
      close_rate_retention_vs_champion: null,
      quality_regression_reasons: [],
      no_quality_regression: true,
      decision: "pending_comparison",
    };
  });

  const champion = rows.find((row) => row.role === "champion");
  for (const row of rows) {
    const qualityGate = buildQualityGate(row, champion, config);
    row.spam_flag_rate = qualityGate.spam_flag_rate;
    row.lead_rate_retention_vs_champion = qualityGate.lead_rate_retention_vs_champion;
    row.close_rate_retention_vs_champion = qualityGate.close_rate_retention_vs_champion;
    row.quality_regression_reasons = qualityGate.reasons;
    row.no_quality_regression = qualityGate.ok;

    if (row.role === "champion") {
      row.decision = "keep_champion_until_challenger_beats_rule";
      continue;
    }

    if (row.role === "challenger") {
      const championRate = champion?.line_add_rate ?? 0;
      const lift = championRate === 0 ? null : row.line_add_rate / championRate;
      const beatsChampion = lift !== null && lift > config.win_rule.challenger_lift_required;
      if (!row.sample_threshold_met) {
        row.decision = "keep_testing_sample_insufficient";
      } else if (beatsChampion && row.no_quality_regression) {
        row.decision = "eligible_for_human_promotion_review";
      } else if (!row.no_quality_regression) {
        row.decision = "reject_quality_regression";
      } else {
        row.decision = "retire_or_rework_candidate";
      }
      row.champion_lift = lift === null ? null : round(lift);
    }
  }

  return {
    generated_at: new Date().toISOString(),
    week,
    thresholds,
    win_rule: config.win_rule,
    assets: rows.sort((a, b) => b.score - a.score),
  };
}

function buildQualityGate(row, champion, config) {
  const qualityRules = config.quality_rules ?? {};
  const maxSpamFlagRate = Number(qualityRules.max_spam_flag_rate ?? 0.05);
  const minLeadRetention = Number(qualityRules.min_lead_rate_retention_vs_champion ?? 0.8);
  const minCloseRetention = Number(qualityRules.min_close_rate_retention_vs_champion ?? 0.8);
  const minLineAdds = Number(config.sample_thresholds?.min_line_adds ?? 5);
  const spamFlagRate = safeDivide(row.low_quality_flags, row.quality_flags);
  const reasons = [];
  let leadRetention = null;
  let closeRetention = null;

  if (row.quality_flags > 0 && spamFlagRate > maxSpamFlagRate) {
    reasons.push("spam_flag_rate_above_limit");
  }

  if (row.role === "challenger" && champion) {
    if (champion.lead_rate > 0 && row.line_adds >= minLineAdds) {
      leadRetention = safeDivide(row.lead_rate, champion.lead_rate);
      if (leadRetention < minLeadRetention) {
        reasons.push("lead_rate_retention_below_champion");
      }
    }

    if (champion.close_rate > 0 && champion.leads > 0 && row.leads > 0) {
      closeRetention = safeDivide(row.close_rate, champion.close_rate);
      if (closeRetention < minCloseRetention) {
        reasons.push("close_rate_retention_below_champion");
      }
    }
  }

  return {
    ok: reasons.length === 0,
    spam_flag_rate: round(spamFlagRate),
    lead_rate_retention_vs_champion: leadRetention === null ? null : round(leadRetention),
    close_rate_retention_vs_champion: closeRetention === null ? null : round(closeRetention),
    reasons,
  };
}

function buildAbStatus(config, scores, events, week) {
  const champion = scores.assets.find((asset) => asset.role === "champion");
  const challenger = scores.assets.find((asset) => asset.role === "challenger");
  const sampleThresholdMet = Boolean(challenger?.sample_threshold_met);
  const championRate = champion?.line_add_rate ?? 0;
  const challengerRate = challenger?.line_add_rate ?? 0;
  const lift = championRate === 0 ? null : round(challengerRate / championRate);
  const challengerWins =
    lift !== null &&
    lift > config.win_rule.challenger_lift_required &&
    sampleThresholdMet &&
    Boolean(challenger?.no_quality_regression);

  return {
    generated_at: new Date().toISOString(),
    test_id: config.ab_plan.test_id,
    status: sampleThresholdMet ? "sample_ready_for_review" : "sample_insufficient_keep_champion",
    week,
    changed_variable: config.current_round.changed_variable,
    one_variable_rule_ok: config.one_variable_per_round.includes(config.current_round.changed_variable),
    traffic_allocation: config.ab_plan.traffic_allocation,
    routing_endpoint: `${config.local_public_base_url ?? "http://127.0.0.1:8787"}/ab/${encodeURIComponent(config.ab_plan.test_id)}`,
    status_endpoint: `${config.local_public_base_url ?? "http://127.0.0.1:8787"}/ab/status`,
    public_link_change_performed: false,
    production_deploy_performed: false,
    small_traffic_only: true,
    events_observed: events.length,
    champion_asset_id: champion?.asset_id ?? null,
    challenger_asset_id: challenger?.asset_id ?? null,
    champion_line_add_rate: championRate,
    challenger_line_add_rate: challengerRate,
    lift,
    sample_threshold_met: sampleThresholdMet,
    no_quality_regression: Boolean(challenger?.no_quality_regression),
    quality_regression_reasons: challenger?.quality_regression_reasons ?? [],
    lead_rate_retention_vs_champion: challenger?.lead_rate_retention_vs_champion ?? null,
    close_rate_retention_vs_champion: challenger?.close_rate_retention_vs_champion ?? null,
    challenger_win_rule_met: challengerWins,
    decision: challengerWins ? "queue_human_promotion_review" : "do_not_promote_challenger",
  };
}

function buildCandidateRetirementQueue(config, scores, abStatus, week, now) {
  const champion = scores.assets.find((asset) => asset.role === "champion");
  const candidates = scores.assets.filter((asset) => asset.role !== "champion");
  const items = candidates.map((asset) => {
    if (asset.role === "challenger" && !asset.sample_threshold_met) {
      return {
        asset_id: asset.asset_id,
        role: asset.role,
        status: "keep_testing_sample_insufficient",
        recommended_action: "keep_in_candidate_rotation",
        retirement_ready: false,
        external_effect: false,
        reason: `sample_threshold_met=false; visits=${asset.visits}, cta_clicks=${asset.cta_clicks}, line_adds=${asset.line_adds}, test_days=${asset.test_days}`,
        human_gate: null,
      };
    }

    if (asset.role === "challenger" && asset.decision === "eligible_for_human_promotion_review") {
      return {
        asset_id: asset.asset_id,
        role: asset.role,
        status: "promotion_review_required",
        recommended_action: "do_not_retire_or_promote_without_owner_review",
        retirement_ready: false,
        external_effect: false,
        reason: "challenger meets win rule, but promotion changes the primary funnel and remains gated",
        human_gate: "Owner must approve champion replacement manually.",
      };
    }

    if (asset.role === "challenger" && asset.decision === "reject_quality_regression") {
      return {
        asset_id: asset.asset_id,
        role: asset.role,
        status: "retire_local_candidate_due_quality_regression",
        recommended_action: "remove_from_next_candidate_rotation_without_deleting_data",
        retirement_ready: true,
        external_effect: false,
        reason: "sample is sufficient but quality regression was observed",
        human_gate: "Do not delete historical event data; only stop using this candidate in future drafts.",
      };
    }

    if (asset.role === "challenger" && asset.decision === "retire_or_rework_candidate") {
      return {
        asset_id: asset.asset_id,
        role: asset.role,
        status: "retire_local_candidate_due_underperformance",
        recommended_action: "remove_from_next_candidate_rotation_without_deleting_data",
        retirement_ready: true,
        external_effect: false,
        reason: `sample is sufficient but line_add_rate=${percent(asset.line_add_rate)} did not beat champion by ${config.win_rule.challenger_lift_required}x`,
        human_gate: "Do not change public links or delete data; retirement is local rotation control only.",
      };
    }

    return {
      asset_id: asset.asset_id,
      role: asset.role,
      status: "observed_only_no_rotation_action",
      recommended_action: "review_manually",
      retirement_ready: false,
      external_effect: false,
      reason: `role=${asset.role}; decision=${asset.decision}`,
      human_gate: "Unknown assets are not promoted, deleted, or published automatically.",
    };
  });

  const retirementReady = items.filter((item) => item.retirement_ready);

  return {
    generated_at: now.toISOString(),
    week,
    status: retirementReady.length > 0 ? "local_retirement_actions_prepared" : "no_retirement_sample_insufficient_or_not_needed",
    champion_asset_id: champion?.asset_id ?? null,
    ab_test_id: abStatus.test_id,
    changed_variable: config.current_round.changed_variable,
    policy: {
      no_data_delete: true,
      no_primary_link_change: true,
      no_champion_promotion: true,
      local_rotation_only: true,
    },
    summary: {
      candidates_observed: candidates.length,
      retirement_ready: retirementReady.length,
      keep_testing: items.filter((item) => item.status === "keep_testing_sample_insufficient").length,
      promotion_reviews: items.filter((item) => item.status === "promotion_review_required").length,
    },
    items,
  };
}

function buildNextRoundPlan(config, scores, abStatus, retirementQueue, week, now) {
  const variables = config.one_variable_per_round;
  const currentVariable = config.current_round.changed_variable;
  const currentIndex = variables.indexOf(currentVariable);
  const rotatedVariable = variables[(currentIndex + 1 + variables.length) % variables.length] ?? variables[0];
  const challenger = scores.assets.find((asset) => asset.role === "challenger");
  const thresholds = config.sample_thresholds;
  const sampleGaps = {
    visits: Math.max(0, thresholds.min_visits - (challenger?.visits ?? 0)),
    cta_clicks: Math.max(0, thresholds.min_cta_clicks - (challenger?.cta_clicks ?? 0)),
    line_adds: Math.max(0, thresholds.min_line_adds - (challenger?.line_adds ?? 0)),
    test_days: Math.max(0, thresholds.min_test_days - (challenger?.test_days ?? 0)),
  };
  const hasSampleGap = Object.values(sampleGaps).some((value) => value > 0);
  const nextVariable = hasSampleGap || abStatus.challenger_win_rule_met ? currentVariable : rotatedVariable;
  let decision = "continue_current_round_until_sample_threshold";
  let rationale = "Sample is insufficient, so the loop keeps the current one-variable test and does not create a new variable round.";
  let candidateAction = "keep_testing_current_challenger";
  let startNewVariableRound = false;

  if (abStatus.challenger_win_rule_met) {
    decision = "queue_owner_promotion_review_before_next_variable";
    rationale = "The challenger met the win rule, but promoting it changes the primary funnel and remains owner-gated before the next variable starts.";
    candidateAction = "hold_for_owner_promotion_review";
  } else if (abStatus.sample_threshold_met && !abStatus.no_quality_regression) {
    decision = "reject_challenger_quality_regression_plan_next_variable";
    rationale = "The sample threshold is met but quality regressed, so the current challenger should not be promoted and the next local draft round can rotate variables.";
    candidateAction = "retire_from_local_rotation_without_deleting_data";
    startNewVariableRound = true;
  } else if (abStatus.sample_threshold_met) {
    decision = "retire_underperforming_challenger_plan_next_variable";
    rationale = "The sample threshold is met and the challenger did not beat the champion by the configured lift, so the next local draft round can rotate variables.";
    candidateAction = "retire_or_rework_from_local_rotation_without_deleting_data";
    startNewVariableRound = true;
  }

  const nextRoundId = startNewVariableRound
    ? `next-${week.start}-${nextVariable}`
    : `${config.current_round.round_id}-continue`;

  return {
    generated_at: now.toISOString(),
    week,
    status: startNewVariableRound ? "next_variable_round_prepared_local_only" : "continue_current_round",
    decision,
    rationale,
    current_round: {
      round_id: config.current_round.round_id,
      changed_variable: currentVariable,
      hypothesis: config.current_round.hypothesis,
      asset_id: challenger?.asset_id ?? null,
    },
    next_round: {
      round_id: nextRoundId,
      changed_variable: nextVariable,
      rotation_candidate_after_current: rotatedVariable,
      start_new_variable_round: startNewVariableRound,
      one_variable_rule_ok: variables.includes(nextVariable),
      generated_candidate_performed: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
    },
    sample_gate: {
      sample_threshold_met: Boolean(abStatus.sample_threshold_met),
      preferred_test_days: thresholds.preferred_test_days,
      min_visits: thresholds.min_visits,
      min_cta_clicks: thresholds.min_cta_clicks,
      min_line_adds: thresholds.min_line_adds,
      min_test_days: thresholds.min_test_days,
      observed_visits: challenger?.visits ?? 0,
      observed_cta_clicks: challenger?.cta_clicks ?? 0,
      observed_line_adds: challenger?.line_adds ?? 0,
      observed_test_days: challenger?.test_days ?? 0,
      gaps: sampleGaps,
    },
    win_gate: {
      metric: config.win_rule.metric,
      challenger_lift_required: config.win_rule.challenger_lift_required,
      challenger_win_rule_met: Boolean(abStatus.challenger_win_rule_met),
      no_quality_regression: Boolean(abStatus.no_quality_regression),
      lift: abStatus.lift,
      champion_line_add_rate: abStatus.champion_line_add_rate,
      challenger_line_add_rate: abStatus.challenger_line_add_rate,
    },
    candidate_action: candidateAction,
    retirement_queue_status: retirementQueue.status,
    approval_gate: {
      review_required: true,
      artifact: "next_round_plan.md",
      human_gate: "Review the next-round decision before public posting, link changes, production deploy, or challenger promotion.",
      external_effect: false,
    },
    draft_brief: buildNextRoundDraftBrief(nextVariable, currentVariable, startNewVariableRound),
    safety_invariants: {
      no_external_send: true,
      no_production_deploy: true,
      no_primary_link_change: true,
      no_champion_promotion: true,
      no_line_push: true,
      no_payment_action: true,
      no_customer_data_mutation: true,
      no_data_delete: true,
    },
  };
}

function buildNextRoundDraftBrief(nextVariable, currentVariable, startNewVariableRound) {
  if (!startNewVariableRound) {
    return {
      mode: "continue_existing_variable",
      changed_variable: currentVariable,
      instruction: "Do not introduce a new variable yet. Keep collecting evidence for the current challenger until sample thresholds are met.",
      locked_variables_policy: "All other variables stay locked.",
    };
  }

  const briefs = {
    hook: "Draft one sharper opening promise while keeping offer, visual claim, and CTA text locked.",
    offer: "Draft one stronger offer framing while keeping hook, visual claim, and CTA text locked.",
    visual_claim: "Draft one clearer proof/visual claim while keeping hook, offer, and CTA text locked.",
    cta_text: "Draft one clearer CTA text while keeping hook, offer, and visual claim locked.",
  };

  return {
    mode: "prepare_next_variable",
    changed_variable: nextVariable,
    instruction: briefs[nextVariable] ?? "Draft the next local candidate while changing only the selected variable.",
    locked_variables_policy: "Only the selected variable may change; all other variables stay locked.",
  };
}

function buildPipelineStatus(config, scores, abStatus, trackingLinks, funnelBreakdown, blocked, retirementQueue, nextRoundPlan, d1SyncStatus, eventInputQualityStatus, funnelAggregateStatus, funnelAggregateFixtureStatus, realDataApplyFixtureStatus, realDataDecisionReplayStatus, sourceReadinessStatus, sourceCaptureStatus, sourceCaptureCompileStatus, sourceCaptureCompileFixtureStatus, realDataIntakeStatus, dataCollectionBriefStatus, sourceTrustMatrixStatus, manualConversionStatus, lineInboundStatus, scheduleStatus, workerDryRunStatus, browserSmokeStatus, trackingLinkSmokeStatus, eventContractSmokeStatus, events, week, now) {
  const deployBlock = blocked.items.find((item) => ["deploy_candidate_worker", "confirm_existing_candidate_worker_provenance"].includes(item.action));
  const primaryLinkBlock = blocked.items.find((item) => item.action === "change_primary_social_or_bio_link");
  const browserChecks = Array.isArray(browserSmokeStatus.checks) ? browserSmokeStatus.checks : [];
  const browserChecksPassed = browserChecks.filter((check) => check.ok).length;
  const trackingLinkChecks = Array.isArray(trackingLinkSmokeStatus.checks) ? trackingLinkSmokeStatus.checks : [];
  const trackingLinkChecksPassed = trackingLinkChecks.filter((check) => check.ok).length;
  const steps = config.weekly_sequence.map((step) => {
    if (step === "collect_data") {
      const funnelPreviewRows = funnelAggregateStatus.mode === "full_funnel_preview" ? funnelAggregateStatus.events_written ?? 0 : 0;
      const manualPreviewRows = manualConversionStatus.mode === "preview" ? manualConversionStatus.events_written ?? 0 : 0;
      const sourceTrustEvidence = `source_trust=${sourceTrustMatrixStatus.status ?? "not_run"}; trusted_sources=${sourceTrustMatrixStatus.trusted_scoring_source_count ?? 0}; sample_gate_sources=${sourceTrustMatrixStatus.sample_gate_source_count ?? 0}; scoring_now=${sourceTrustMatrixStatus.scoring_allowed_now ? "yes" : "no"}; source_trust_data_write=${sourceTrustMatrixStatus.data_lp_events_write_performed ? "yes" : "no"}`;
      return {
        step,
        status: events.length > 0 ? "local_complete_events_present" : "local_ready_no_real_events",
        evidence: events.length > 0 ? `events=${events.length}; ${sourceTrustEvidence}` : `data/lp_events.jsonl has no real events yet; ${sourceTrustEvidence}; d1_sync_scope=${d1SyncStatus.scope}; source_readiness=${sourceReadinessStatus.status ?? "not_run"}; missing_stages=${sourceReadinessStatus.missing_stage_count ?? 0}; source_capture=${sourceCaptureStatus.ok ? "ok" : "not_ready"}; source_capture_rows=${sourceCaptureStatus.ledger_rows ?? 0}; source_compile=${sourceCaptureCompileStatus.status ?? "not_run"}; source_compile_filled=${sourceCaptureCompileStatus.filled_rows ?? 0}; source_compile_fixture=${sourceCaptureCompileFixtureStatus.ok ? "ok" : "not_ready"}; funnel_preview_events=${funnelPreviewRows}; funnel_fixture=${funnelAggregateFixtureStatus.ok ? "ok" : "not_ready"}; real_apply_guard=${realDataApplyFixtureStatus.ok ? "ok" : "not_ready"}; decision_replay=${realDataDecisionReplayStatus.ok ? "ok" : "not_ready"}; real_intake=${realDataIntakeStatus.status ?? "not_run"}; data_collection=${dataCollectionBriefStatus.status ?? "not_run"}; data_collection_tasks=${dataCollectionBriefStatus.task_count ?? 0}; sample_gate=${dataCollectionBriefStatus.sample_gate_status ?? "not_run"}; sample_gate_tasks=${dataCollectionBriefStatus.sample_gate_p0_task_count ?? 0}; manual_preview_events=${manualPreviewRows}; line_inbound_playbook=${lineInboundStatus.ok ? "ok" : "not_ready"}; tracking_link_smoke=${trackingLinkSmokeStatus.ok ? "ok" : "not_ready"}; event_contract=${eventContractSmokeStatus.ok ? "ok" : "not_ready"}`,
        d1_sync_status: d1SyncStatus.ok ? "available" : "not_ready",
        d1_sync_rows: d1SyncStatus.rows_exported ?? 0,
        d1_sync_output: d1SyncStatus.output_path ?? null,
        d1_scoring_input_allowed: Boolean(d1SyncStatus.scoring_input_allowed),
        d1_synthetic_or_smoke_rows: d1SyncStatus.synthetic_or_smoke_row_count ?? 0,
        d1_real_event_candidate_rows: d1SyncStatus.real_event_candidate_rows ?? 0,
        d1_data_lp_events_write_performed: Boolean(d1SyncStatus.data_lp_events_write_performed),
        funnel_aggregate_status: funnelAggregateStatus.ok ? funnelAggregateStatus.mode : "not_ready",
        funnel_aggregate_preview_events: funnelPreviewRows,
        funnel_aggregate_apply_performed: Boolean(funnelAggregateStatus.apply_performed),
        funnel_aggregate_data_lp_events_write_performed: Boolean(funnelAggregateStatus.data_lp_events_write_performed),
        funnel_aggregate_fixture_status: funnelAggregateFixtureStatus.ok ? funnelAggregateFixtureStatus.mode : "not_ready",
        funnel_aggregate_fixture_scenarios: funnelAggregateFixtureStatus.scenario_count ?? 0,
        real_data_apply_fixture_status: realDataApplyFixtureStatus.ok ? realDataApplyFixtureStatus.mode : "not_ready",
        real_data_apply_fixture_scenarios: realDataApplyFixtureStatus.scenario_count ?? 0,
        real_data_decision_replay_status: realDataDecisionReplayStatus.ok ? realDataDecisionReplayStatus.mode : "not_ready",
        real_data_decision_replay_scenarios: realDataDecisionReplayStatus.scenario_count ?? 0,
        real_data_decision_replay_source_capture_ledger_replay_executed: Boolean(realDataDecisionReplayStatus.source_capture_ledger_replay_executed),
        real_data_decision_replay_source_capture_compile_commands_executed: Boolean(realDataDecisionReplayStatus.source_capture_compile_commands_executed),
        real_data_decision_replay_ledger_to_decision_replay_performed: Boolean(realDataDecisionReplayStatus.ledger_to_decision_replay_performed),
        real_data_decision_replay_data_lp_events_write_performed: Boolean(realDataDecisionReplayStatus.data_lp_events_write_performed),
        source_readiness_status: sourceReadinessStatus.status ?? "not_run",
        source_readiness_missing_stage_count: sourceReadinessStatus.missing_stage_count ?? 0,
        source_readiness_ready_for_public_iteration_decision: Boolean(sourceReadinessStatus.ready_for_public_iteration_decision),
        source_readiness_data_lp_events_write_performed: Boolean(sourceReadinessStatus.data_lp_events_write_performed),
        source_capture_status: sourceCaptureStatus.status ?? "not_run",
        source_capture_ledger_rows: sourceCaptureStatus.ledger_rows ?? 0,
        source_capture_sample_gate_rows: sourceCaptureStatus.sample_gate_ledger_rows ?? 0,
        source_capture_live_input_files_created: Boolean(sourceCaptureStatus.live_input_files_created),
        source_capture_data_lp_events_write_performed: Boolean(sourceCaptureStatus.data_lp_events_write_performed),
        source_capture_compile_status: sourceCaptureCompileStatus.status ?? "not_run",
        source_capture_compile_filled_rows: sourceCaptureCompileStatus.filled_rows ?? 0,
        source_capture_compile_funnel_rows: sourceCaptureCompileStatus.funnel_rows ?? 0,
        source_capture_compile_manual_rows: sourceCaptureCompileStatus.manual_rows ?? 0,
        source_capture_compile_live_input_files_created: Boolean(sourceCaptureCompileStatus.live_input_files_created),
        source_capture_compile_data_lp_events_write_performed: Boolean(sourceCaptureCompileStatus.data_lp_events_write_performed),
        source_capture_compile_fixture_status: sourceCaptureCompileFixtureStatus.ok ? sourceCaptureCompileFixtureStatus.mode : "not_ready",
        source_capture_compile_fixture_scenarios: sourceCaptureCompileFixtureStatus.scenario_count ?? 0,
        source_capture_compile_fixture_data_lp_events_write_performed: Boolean(sourceCaptureCompileFixtureStatus.data_lp_events_write_performed),
        real_data_intake_status: realDataIntakeStatus.status ?? "not_run",
        real_data_intake_ready_apply_count: realDataIntakeStatus.ready_apply_count ?? 0,
        real_data_intake_missing_input_count: realDataIntakeStatus.missing_input_count ?? 0,
        real_data_intake_data_lp_events_write_performed: Boolean(realDataIntakeStatus.data_lp_events_write_performed),
        data_collection_brief_status: dataCollectionBriefStatus.status ?? "not_run",
        data_collection_brief_tasks: dataCollectionBriefStatus.task_count ?? 0,
        sample_gate_status: dataCollectionBriefStatus.sample_gate_status ?? "not_run",
        sample_gate_p0_task_count: dataCollectionBriefStatus.sample_gate_p0_task_count ?? 0,
        sample_gate_p0_link_count: dataCollectionBriefStatus.sample_gate_p0_link_count ?? 0,
        data_collection_brief_live_input_files_created: Boolean(dataCollectionBriefStatus.live_input_files_created),
        data_collection_brief_data_lp_events_write_performed: Boolean(dataCollectionBriefStatus.data_lp_events_write_performed),
        source_trust_status: sourceTrustMatrixStatus.status ?? "not_run",
        source_trust_trusted_scoring_source_count: sourceTrustMatrixStatus.trusted_scoring_source_count ?? 0,
        source_trust_sample_gate_source_count: sourceTrustMatrixStatus.sample_gate_source_count ?? 0,
        source_trust_scoring_allowed_now: Boolean(sourceTrustMatrixStatus.scoring_allowed_now),
        source_trust_real_event_rows: sourceTrustMatrixStatus.real_event_rows ?? 0,
        source_trust_p0_pending_count: sourceTrustMatrixStatus.p0_pending_count ?? 0,
        source_trust_sample_threshold_met: Boolean(sourceTrustMatrixStatus.sample_threshold_met),
        source_trust_ready_for_public_iteration_decision: Boolean(sourceTrustMatrixStatus.ready_for_public_iteration_decision),
        source_trust_data_lp_events_write_performed: Boolean(sourceTrustMatrixStatus.data_lp_events_write_performed),
        manual_conversion_status: manualConversionStatus.ok ? manualConversionStatus.mode : "not_ready",
        manual_conversion_preview_events: manualPreviewRows,
        manual_conversion_apply_performed: Boolean(manualConversionStatus.apply_performed),
        line_inbound_playbook_status: lineInboundStatus.ok ? lineInboundStatus.mode : "not_ready",
        line_inbound_scenarios: lineInboundStatus.scenario_count ?? 0,
        external_effect: false,
      };
    }
    if (step === "score_assets") {
      return {
        step,
        status: "local_complete",
        evidence: "growth_scores.json",
        sample_threshold_met: scores.assets.some((asset) => asset.sample_threshold_met),
        external_effect: false,
      };
    }
    if (step === "winners_losers") {
      return {
        step,
        status: "local_complete_no_winner_until_threshold",
        evidence: "weekly_report.md + candidate_retirement_queue.json",
        champion_retained: true,
        retirement_ready: retirementQueue.summary.retirement_ready,
        external_effect: false,
      };
    }
    if (step === "content_mix") {
      return {
        step,
        status: "draft_complete_human_publish_gate",
        evidence: "content_variants.md + funnel_breakdown.md",
        attribution_rows: funnelBreakdown.summary.rows,
        content_variant_links: funnelBreakdown.summary.content_variant_links,
        external_effect: false,
      };
    }
    if (step === "generate_lp_challenger") {
      return {
        step,
        status: "local_complete",
        evidence: "landing_page_candidate.html",
        external_effect: false,
      };
    }
    if (step === "deploy_candidate_worker") {
      return {
        step,
        status: "prepared_but_blocked",
        evidence: workerDryRunStatus.ok ? "worker_dry_run.md + data/worker_dry_run_status.json" : deployBlock?.prepared_artifact ?? "worker.ts",
        dry_run_ok: Boolean(workerDryRunStatus.ok),
        dry_run_exit_observed: Boolean(workerDryRunStatus.dry_run_exit_observed),
        dry_run_log: workerDryRunStatus.log_path ?? null,
        dry_run_report: workerDryRunStatus.report_path ?? WORKER_DRY_RUN_REPORT_PATH,
        operation_mode: deployBlock?.operation_mode ?? "deploy_candidate_worker",
        resource_deploy_required: deployBlock?.resource_deploy_required ?? true,
        blocked_by: deployBlock?.blocked_by ?? "Formal production deploy requires owner approval.",
        production_deploy_performed: false,
        external_effect: false,
      };
    }
    if (step === "create_ab_plan") {
      return {
        step,
        status: "local_complete_pending_link_gate",
        evidence: "ab_test_status.json",
        routing_endpoint: abStatus.routing_endpoint,
        public_link_gate: primaryLinkBlock?.blocked_by ?? "Primary link changes require owner approval.",
        allocation: abStatus.traffic_allocation,
        external_effect: false,
      };
    }
    if (step === "weekly_report") {
      return {
        step,
        status: "local_complete",
        evidence: "weekly_report.md",
        external_effect: false,
      };
    }
    if (step === "approval_queue") {
      return {
        step,
        status: "local_complete",
        evidence: "approval_queue.json",
        external_effect: false,
      };
    }
    return {
      step,
      status: "not_implemented",
      evidence: null,
      external_effect: false,
    };
  });

  return {
    generated_at: now.toISOString(),
    week,
    mode: config.mode,
    status: "local_prepared_external_blocked",
    weekly_sequence: config.weekly_sequence,
    all_steps_represented: steps.length === config.weekly_sequence.length,
    public_link_change_performed: false,
    production_deploy_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    ab_router_link: trackingLinks.links.find((link) => link.role === "ab_small_traffic")?.tracking_url ?? null,
    funnel_breakdown: {
      artifact_json: "funnel_breakdown.json",
      artifact_md: "funnel_breakdown.md",
      mode: funnelBreakdown.mode,
      rows: funnelBreakdown.summary.rows,
      content_variant_links: funnelBreakdown.summary.content_variant_links,
      real_events: funnelBreakdown.summary.real_events,
      external_effect: false,
    },
    candidate_retirement_queue: "candidate_retirement_queue.json",
    next_round_plan: {
      artifact_json: "next_round_plan.json",
      artifact_md: "next_round_plan.md",
      status: nextRoundPlan.status,
      decision: nextRoundPlan.decision,
      current_changed_variable: nextRoundPlan.current_round.changed_variable,
      next_changed_variable: nextRoundPlan.next_round.changed_variable,
      start_new_variable_round: nextRoundPlan.next_round.start_new_variable_round,
      one_variable_rule_ok: nextRoundPlan.next_round.one_variable_rule_ok,
      external_effect: false,
    },
    schedule_status: {
      cadence: scheduleStatus.cadence,
      local_runner_command: scheduleStatus.local_runner_command,
      launchagent_status_file: scheduleStatus.launchagent_status_file,
      launchd_template: scheduleStatus.launchd_template,
      launchd_installed: scheduleStatus.launchd_installed,
      install_performed: scheduleStatus.install_performed,
      file_installed: scheduleStatus.file_installed,
      service_loaded: scheduleStatus.service_loaded,
      local_persistent_schedule: scheduleStatus.local_persistent_schedule,
      external_effect: false,
      last_runner_status: scheduleStatus.runner_status.status,
      last_runner_log: scheduleStatus.runner_status.log_path,
      rollback_command: scheduleStatus.launchagent_status.rollback_command,
    },
    d1_sync_status: {
      ok: Boolean(d1SyncStatus.ok),
      scope: d1SyncStatus.scope ?? "unknown",
      rows_exported: d1SyncStatus.rows_exported ?? 0,
      output_path: d1SyncStatus.output_path ?? null,
      scoring_input_allowed: Boolean(d1SyncStatus.scoring_input_allowed),
      local_review_only: Boolean(d1SyncStatus.local_review_only),
      synthetic_or_smoke_detected: Boolean(d1SyncStatus.synthetic_or_smoke_detected),
      synthetic_or_smoke_row_count: d1SyncStatus.synthetic_or_smoke_row_count ?? 0,
      real_event_candidate_rows: d1SyncStatus.real_event_candidate_rows ?? 0,
      data_lp_events_write_performed: Boolean(d1SyncStatus.data_lp_events_write_performed),
      scoring_policy: d1SyncStatus.scoring_policy ?? "unknown",
      external_effect: false,
    },
    event_input_quality_status: {
      ok: Boolean(eventInputQualityStatus.ok),
      mode: eventInputQualityStatus.mode ?? "unknown",
      input_path: eventInputQualityStatus.input_path ?? "data/lp_events.jsonl",
      rows_scanned: eventInputQualityStatus.rows_scanned ?? 0,
      issue_count: (eventInputQualityStatus.issues ?? []).length,
      scoring_allowed: Boolean(eventInputQualityStatus.scoring_allowed),
      pii_or_sensitive_data_detected: Boolean(eventInputQualityStatus.pii_or_sensitive_data_detected),
      duplicate_event_ids: eventInputQualityStatus.duplicate_event_ids ?? [],
      unknown_asset_ids: eventInputQualityStatus.unknown_asset_ids ?? [],
      unknown_event_types: eventInputQualityStatus.unknown_event_types ?? [],
      unknown_keys: eventInputQualityStatus.unknown_keys ?? [],
      external_effect: false,
      data_lp_events_write_performed: Boolean(eventInputQualityStatus.data_lp_events_write_performed),
    },
    funnel_aggregate_status: {
      ok: Boolean(funnelAggregateStatus.ok),
      mode: funnelAggregateStatus.mode ?? "unknown",
      events_written: funnelAggregateStatus.events_written ?? 0,
      output_path: funnelAggregateStatus.output_path ?? null,
      counts_by_event_type: funnelAggregateStatus.counts_by_event_type ?? {},
      contains_sensitive_columns: Boolean(funnelAggregateStatus.contains_sensitive_columns),
      contains_sensitive_values: Boolean(funnelAggregateStatus.contains_sensitive_values),
      apply_performed: Boolean(funnelAggregateStatus.apply_performed),
      append_performed: Boolean(funnelAggregateStatus.append_performed),
      data_lp_events_write_performed: Boolean(funnelAggregateStatus.data_lp_events_write_performed),
      external_effect: false,
    },
    funnel_aggregate_fixture_status: {
      ok: Boolean(funnelAggregateFixtureStatus.ok),
      mode: funnelAggregateFixtureStatus.mode ?? "unknown",
      scenario_count: funnelAggregateFixtureStatus.scenario_count ?? 0,
      scenarios: (funnelAggregateFixtureStatus.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: Boolean(scenario.ok),
        status_mode: scenario.status_mode ?? "unknown",
        data_lp_events_write_performed: Boolean(scenario.data_lp_events_write_performed),
      })),
      execution_performed: Boolean(funnelAggregateFixtureStatus.execution_performed),
      real_event_write_performed: Boolean(funnelAggregateFixtureStatus.real_event_write_performed),
      data_lp_events_write_performed: Boolean(funnelAggregateFixtureStatus.data_lp_events_write_performed),
      external_effect: false,
      report_path: funnelAggregateFixtureStatus.report_path ?? FUNNEL_AGGREGATE_FIXTURE_REPORT_PATH,
    },
    real_data_apply_fixture_status: {
      ok: Boolean(realDataApplyFixtureStatus.ok),
      mode: realDataApplyFixtureStatus.mode ?? "unknown",
      scenario_count: realDataApplyFixtureStatus.scenario_count ?? 0,
      scenarios: (realDataApplyFixtureStatus.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: Boolean(scenario.ok),
        importer: scenario.importer ?? "unknown",
        status_mode: scenario.status_mode ?? "unknown",
        confirm_real_data: Boolean(scenario.confirm_real_data),
        example_input_detected: Boolean(scenario.example_input_detected),
        real_events_unchanged: Boolean(scenario.real_events_unchanged),
        data_lp_events_write_performed: Boolean(scenario.data_lp_events_write_performed),
      })),
      execution_performed: Boolean(realDataApplyFixtureStatus.execution_performed),
      real_event_write_performed: Boolean(realDataApplyFixtureStatus.real_event_write_performed),
      data_lp_events_write_performed: Boolean(realDataApplyFixtureStatus.data_lp_events_write_performed),
      external_effect: false,
      report_path: realDataApplyFixtureStatus.report_path ?? REAL_DATA_APPLY_FIXTURE_REPORT_PATH,
    },
    real_data_decision_replay_status: {
      ok: Boolean(realDataDecisionReplayStatus.ok),
      mode: realDataDecisionReplayStatus.mode ?? "unknown",
      scenario_count: realDataDecisionReplayStatus.scenario_count ?? 0,
      scenario_ids: realDataDecisionReplayStatus.scenario_ids ?? [],
      source_capture_ledger_replay_executed: Boolean(realDataDecisionReplayStatus.source_capture_ledger_replay_executed),
      source_capture_compile_commands_executed: Boolean(realDataDecisionReplayStatus.source_capture_compile_commands_executed),
      ledger_to_decision_replay_performed: Boolean(realDataDecisionReplayStatus.ledger_to_decision_replay_performed),
      scenarios: (realDataDecisionReplayStatus.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: Boolean(scenario.ok),
        imported_events: scenario.imported_events ?? 0,
        source_capture_compile_ok: scenario.source_capture_compile?.ok === true,
        source_capture_compile_status: scenario.source_capture_compile?.status ?? "missing",
        ab_decision: scenario.ab_status?.decision ?? "unknown",
        next_round_decision: scenario.next_round_summary?.decision ?? "unknown",
        next_changed_variable: scenario.next_round_summary?.changed_variable ?? "unknown",
        promotion_performed: Boolean(scenario.promotion_performed),
        data_lp_events_write_performed: Boolean(scenario.data_lp_events_write_performed),
        external_effect: Boolean(scenario.external_effect),
      })),
      local_fixture_commands_executed: Boolean(realDataDecisionReplayStatus.local_fixture_commands_executed),
      local_importer_preview_commands_executed: Boolean(realDataDecisionReplayStatus.local_importer_preview_commands_executed),
      execution_performed: Boolean(realDataDecisionReplayStatus.execution_performed),
      real_events_unchanged: Boolean(realDataDecisionReplayStatus.real_events_unchanged),
      real_event_write_performed: Boolean(realDataDecisionReplayStatus.real_event_write_performed),
      data_lp_events_write_performed: Boolean(realDataDecisionReplayStatus.data_lp_events_write_performed),
      external_effect: false,
      report_path: realDataDecisionReplayStatus.report_path ?? REAL_DATA_DECISION_REPLAY_REPORT_PATH,
    },
    source_readiness_status: {
      ok: Boolean(sourceReadinessStatus.ok),
      mode: sourceReadinessStatus.mode ?? "unknown",
      status: sourceReadinessStatus.status ?? "unknown",
      report_path: sourceReadinessStatus.report_path ?? SOURCE_READINESS_REPORT_PATH,
      real_event_rows: sourceReadinessStatus.real_event_rows ?? 0,
      missing_stage_count: sourceReadinessStatus.missing_stage_count ?? 0,
      missing_stages: sourceReadinessStatus.missing_stages ?? [],
      scoring_allowed: Boolean(sourceReadinessStatus.scoring_allowed),
      sample_threshold_met: Boolean(sourceReadinessStatus.sample_progress?.sample_threshold_met),
      ready_for_public_iteration_decision: Boolean(sourceReadinessStatus.ready_for_public_iteration_decision),
      champion_url_ready: Boolean(sourceReadinessStatus.champion_url_ready),
      stages: (sourceReadinessStatus.stages ?? []).map((stage) => ({
        id: stage.id,
        status: stage.status,
        current_real_events: stage.current_real_events ?? 0,
        live_input_exists: Boolean(stage.live_input_exists),
        ready_for_decision: Boolean(stage.ready_for_decision),
      })),
      apply_performed: Boolean(sourceReadinessStatus.apply_performed),
      append_performed: Boolean(sourceReadinessStatus.append_performed),
      data_lp_events_write_performed: Boolean(sourceReadinessStatus.data_lp_events_write_performed),
      external_effect: false,
    },
    source_trust_status: {
      ok: Boolean(sourceTrustMatrixStatus.ok),
      mode: sourceTrustMatrixStatus.mode ?? "unknown",
      status: sourceTrustMatrixStatus.status ?? "unknown",
      status_path: sourceTrustMatrixStatus.status_path ?? SOURCE_TRUST_MATRIX_STATUS_PATH,
      matrix_path: sourceTrustMatrixStatus.matrix_path ?? SOURCE_TRUST_MATRIX_JSON_PATH,
      report_path: sourceTrustMatrixStatus.report_path ?? SOURCE_TRUST_MATRIX_REPORT_PATH,
      trusted_scoring_source_count: sourceTrustMatrixStatus.trusted_scoring_source_count ?? 0,
      sample_gate_source_count: sourceTrustMatrixStatus.sample_gate_source_count ?? 0,
      scoring_allowed_now: Boolean(sourceTrustMatrixStatus.scoring_allowed_now),
      real_event_rows: sourceTrustMatrixStatus.real_event_rows ?? 0,
      p0_pending_count: sourceTrustMatrixStatus.p0_pending_count ?? 0,
      sample_threshold_met: Boolean(sourceTrustMatrixStatus.sample_threshold_met),
      ready_for_public_iteration_decision: Boolean(sourceTrustMatrixStatus.ready_for_public_iteration_decision),
      local_review_only_source_count: sourceTrustMatrixStatus.local_review_only_source_count ?? 0,
      review_ready_source_count: sourceTrustMatrixStatus.review_ready_source_count ?? 0,
      data_lp_events_write_performed: Boolean(sourceTrustMatrixStatus.data_lp_events_write_performed),
      external_effect: false,
    },
    source_capture_status: {
      ok: Boolean(sourceCaptureStatus.ok),
      mode: sourceCaptureStatus.mode ?? "unknown",
      status: sourceCaptureStatus.status ?? "unknown",
      report_path: sourceCaptureStatus.report_path ?? SOURCE_CAPTURE_REPORT_PATH,
      checklist_path: sourceCaptureStatus.checklist_path ?? SOURCE_CAPTURE_CHECKLIST_PATH,
      ledger_template_path: sourceCaptureStatus.ledger_template_path ?? SOURCE_CAPTURE_LEDGER_PATH,
      sample_gate_ledger_template_path: sourceCaptureStatus.sample_gate_ledger_template_path ?? SOURCE_CAPTURE_SAMPLE_GATE_LEDGER_PATH,
      sample_gate_ledger_status_path: sourceCaptureStatus.sample_gate_ledger_status_path ?? SAMPLE_GATE_LEDGER_STATUS_PATH,
      sample_gate_ledger_report_path: sourceCaptureStatus.sample_gate_ledger_report_path ?? SAMPLE_GATE_LEDGER_REPORT_PATH,
      tracking_links_total: sourceCaptureStatus.tracking_links_total ?? 0,
      importable_tracking_links: sourceCaptureStatus.importable_tracking_links ?? 0,
      ab_router_gate_count: sourceCaptureStatus.ab_router_gate_count ?? 0,
      stage_count: sourceCaptureStatus.stage_count ?? 0,
      ledger_rows: sourceCaptureStatus.ledger_rows ?? 0,
      sample_gate_ledger_rows: sourceCaptureStatus.sample_gate_ledger_rows ?? 0,
      template_only: Boolean(sourceCaptureStatus.template_only),
      owner_review_required: Boolean(sourceCaptureStatus.owner_review_required),
      live_input_files_created: Boolean(sourceCaptureStatus.live_input_files_created),
      real_events_unchanged: Boolean(sourceCaptureStatus.real_events_unchanged),
      apply_performed: Boolean(sourceCaptureStatus.apply_performed),
      append_performed: Boolean(sourceCaptureStatus.append_performed),
      data_lp_events_write_performed: Boolean(sourceCaptureStatus.data_lp_events_write_performed),
      external_effect: false,
    },
    source_capture_compile_status: {
      ok: Boolean(sourceCaptureCompileStatus.ok),
      mode: sourceCaptureCompileStatus.mode ?? "unknown",
      status: sourceCaptureCompileStatus.status ?? "unknown",
      input_kind: sourceCaptureCompileStatus.input_kind ?? "unknown",
      report_path: sourceCaptureCompileStatus.report_path ?? SOURCE_CAPTURE_COMPILE_REPORT_PATH,
      output_dir: sourceCaptureCompileStatus.output_dir ?? path.dirname(SOURCE_CAPTURE_COMPILED_FUNNEL_PATH),
      funnel_preview_path: sourceCaptureCompileStatus.funnel_preview_path ?? SOURCE_CAPTURE_COMPILED_FUNNEL_PATH,
      manual_preview_path: sourceCaptureCompileStatus.manual_preview_path ?? SOURCE_CAPTURE_COMPILED_MANUAL_PATH,
      ledger_rows_read: sourceCaptureCompileStatus.ledger_rows_read ?? 0,
      filled_rows: sourceCaptureCompileStatus.filled_rows ?? 0,
      empty_rows: sourceCaptureCompileStatus.empty_rows ?? 0,
      funnel_rows: sourceCaptureCompileStatus.funnel_rows ?? 0,
      manual_rows: sourceCaptureCompileStatus.manual_rows ?? 0,
      issue_count: sourceCaptureCompileStatus.issue_count ?? 0,
      warning_count: sourceCaptureCompileStatus.warning_count ?? 0,
      counts_by_event_type: sourceCaptureCompileStatus.counts_by_event_type ?? {},
      counts_by_target_file: sourceCaptureCompileStatus.counts_by_target_file ?? {},
      owner_review_required: Boolean(sourceCaptureCompileStatus.owner_review_required),
      live_input_files_created: Boolean(sourceCaptureCompileStatus.live_input_files_created),
      apply_performed: Boolean(sourceCaptureCompileStatus.apply_performed),
      append_performed: Boolean(sourceCaptureCompileStatus.append_performed),
      data_lp_events_write_performed: Boolean(sourceCaptureCompileStatus.data_lp_events_write_performed),
      external_effect: false,
    },
    source_capture_compile_fixture_status: {
      ok: Boolean(sourceCaptureCompileFixtureStatus.ok),
      mode: sourceCaptureCompileFixtureStatus.mode ?? "unknown",
      scenario_count: sourceCaptureCompileFixtureStatus.scenario_count ?? 0,
      scenarios: (sourceCaptureCompileFixtureStatus.scenarios ?? []).map((scenario) => ({
        id: scenario.id,
        ok: Boolean(scenario.ok),
        status_status: scenario.status_status ?? "unknown",
        data_lp_events_write_performed: Boolean(scenario.data_lp_events_write_performed),
      })),
      local_fixture_commands_executed: Boolean(sourceCaptureCompileFixtureStatus.local_fixture_commands_executed),
      execution_performed: Boolean(sourceCaptureCompileFixtureStatus.execution_performed),
      real_event_write_performed: Boolean(sourceCaptureCompileFixtureStatus.real_event_write_performed),
      data_lp_events_write_performed: Boolean(sourceCaptureCompileFixtureStatus.data_lp_events_write_performed),
      external_effect: false,
      report_path: sourceCaptureCompileFixtureStatus.report_path ?? SOURCE_CAPTURE_COMPILE_FIXTURE_REPORT_PATH,
    },
    real_data_intake_status: {
      ok: Boolean(realDataIntakeStatus.ok),
      mode: realDataIntakeStatus.mode ?? "unknown",
      status: realDataIntakeStatus.status ?? "unknown",
      report_path: realDataIntakeStatus.report_path ?? REAL_DATA_INTAKE_PLAN_PATH,
      has_real_input_files: Boolean(realDataIntakeStatus.has_real_input_files),
      missing_input_count: realDataIntakeStatus.missing_input_count ?? 0,
      ready_apply_count: realDataIntakeStatus.ready_apply_count ?? 0,
      blocked_input_count: realDataIntakeStatus.blocked_input_count ?? 0,
      real_events_unchanged: Boolean(realDataIntakeStatus.real_events_unchanged),
      input_files: (realDataIntakeStatus.input_files ?? []).map((source) => ({
        id: source.id,
        status: source.status,
        input_exists: Boolean(source.input_exists),
        preview_events_written: source.preview_events_written ?? 0,
        ready_for_owner_apply: Boolean(source.ready_for_owner_apply),
        data_lp_events_write_performed: Boolean(source.data_lp_events_write_performed),
      })),
      apply_performed: Boolean(realDataIntakeStatus.apply_performed),
      append_performed: Boolean(realDataIntakeStatus.append_performed),
      data_lp_events_write_performed: Boolean(realDataIntakeStatus.data_lp_events_write_performed),
      external_effect: false,
    },
    data_collection_brief_status: {
      ok: Boolean(dataCollectionBriefStatus.ok),
      mode: dataCollectionBriefStatus.mode ?? "unknown",
      status: dataCollectionBriefStatus.status ?? "unknown",
      task_count: dataCollectionBriefStatus.task_count ?? 0,
      stage_count: dataCollectionBriefStatus.stage_count ?? 0,
      importable_link_count: dataCollectionBriefStatus.importable_link_count ?? 0,
      gated_link_count: dataCollectionBriefStatus.gated_link_count ?? 0,
      sample_gate_status: dataCollectionBriefStatus.sample_gate_status ?? "not_run",
      sample_gate_p0_task_count: dataCollectionBriefStatus.sample_gate_p0_task_count ?? 0,
      sample_gate_p0_link_count: dataCollectionBriefStatus.sample_gate_p0_link_count ?? 0,
      sample_gate_stage_count: dataCollectionBriefStatus.sample_gate_stage_count ?? 0,
      sample_gate_plan_report_path: dataCollectionBriefStatus.sample_gate_plan_report_path ?? SAMPLE_GATE_PLAN_REPORT_PATH,
      filled_ledger_exists: Boolean(dataCollectionBriefStatus.filled_ledger_exists),
      sample_threshold_met: Boolean(dataCollectionBriefStatus.sample_threshold_met),
      missing_stage_count: dataCollectionBriefStatus.missing_stage_count ?? 0,
      real_events_unchanged: Boolean(dataCollectionBriefStatus.real_events_unchanged),
      live_input_files_created: Boolean(dataCollectionBriefStatus.live_input_files_created),
      data_lp_events_write_performed: Boolean(dataCollectionBriefStatus.data_lp_events_write_performed),
      external_effect: false,
    },
    manual_conversion_status: {
      ok: Boolean(manualConversionStatus.ok),
      mode: manualConversionStatus.mode ?? "unknown",
      events_written: manualConversionStatus.events_written ?? 0,
      output_path: manualConversionStatus.output_path ?? null,
      contains_sensitive_columns: Boolean(manualConversionStatus.contains_sensitive_columns),
      contains_sensitive_values: Boolean(manualConversionStatus.contains_sensitive_values),
      apply_performed: Boolean(manualConversionStatus.apply_performed),
      append_performed: Boolean(manualConversionStatus.append_performed),
      data_lp_events_write_performed: Boolean(manualConversionStatus.data_lp_events_write_performed),
      external_effect: false,
    },
    line_inbound_status: {
      ok: Boolean(lineInboundStatus.ok),
      mode: lineInboundStatus.mode ?? "unknown",
      scenario_count: lineInboundStatus.scenario_count ?? 0,
      playbook_json_path: lineInboundStatus.playbook_json_path ?? LINE_INBOUND_PLAYBOOK_JSON_PATH,
      playbook_md_path: lineInboundStatus.playbook_md_path ?? LINE_INBOUND_PLAYBOOK_MD_PATH,
      execution_performed: Boolean(lineInboundStatus.execution_performed),
      external_effect: false,
      line_push_performed: Boolean(lineInboundStatus.line_push_performed),
      customer_data_mutation_performed: Boolean(lineInboundStatus.customer_data_mutation_performed),
      payment_action_performed: Boolean(lineInboundStatus.payment_action_performed),
      delete_action_performed: Boolean(lineInboundStatus.delete_action_performed),
      data_lp_events_write_performed: Boolean(lineInboundStatus.data_lp_events_write_performed),
    },
    worker_dry_run_status: {
      ok: Boolean(workerDryRunStatus.ok),
      mode: workerDryRunStatus.mode ?? "unknown",
      command: workerDryRunStatus.command ?? "wrangler deploy --dry-run",
      exit_code: workerDryRunStatus.exit_code ?? null,
      dry_run_exit_observed: Boolean(workerDryRunStatus.dry_run_exit_observed),
      required_markers_present: Boolean(workerDryRunStatus.required_markers_present),
      failed_markers: workerDryRunStatus.failed_markers ?? [],
      total_upload_line: workerDryRunStatus.total_upload_line ?? null,
      report_path: workerDryRunStatus.report_path ?? WORKER_DRY_RUN_REPORT_PATH,
      log_path: workerDryRunStatus.log_path ?? null,
      deploy_performed: Boolean(workerDryRunStatus.deploy_performed),
      production_deploy_performed: Boolean(workerDryRunStatus.production_deploy_performed),
      external_effect: false,
    },
    browser_smoke_status: {
      ok: Boolean(browserSmokeStatus.ok),
      mode: browserSmokeStatus.mode ?? "unknown",
      base_url: browserSmokeStatus.base_url ?? null,
      checks_passed: browserChecksPassed,
      checks_total: browserChecks.length,
      event_write_performed: Boolean(browserSmokeStatus.event_write_performed),
      external_effect: false,
      log_path: browserSmokeStatus.log_path ?? null,
    },
    tracking_link_smoke_status: {
      ok: Boolean(trackingLinkSmokeStatus.ok),
      mode: trackingLinkSmokeStatus.mode ?? "unknown",
      links_checked: trackingLinkSmokeStatus.links_checked ?? trackingLinkChecks.length,
      expected_link_count: trackingLinkSmokeStatus.expected_link_count ?? trackingLinks.links.length,
      checks_passed: trackingLinkChecksPassed,
      checks_total: trackingLinkChecks.length,
      isolated_link_click_events_written: trackingLinkSmokeStatus.isolated_link_click_events_written ?? 0,
      isolated_fixture_event_write_performed: Boolean(trackingLinkSmokeStatus.isolated_fixture_event_write_performed),
      real_event_write_performed: Boolean(trackingLinkSmokeStatus.real_event_write_performed),
      data_lp_events_write_performed: Boolean(trackingLinkSmokeStatus.data_lp_events_write_performed),
      external_effect: false,
      log_path: trackingLinkSmokeStatus.log_path ?? null,
    },
    event_contract_smoke_status: {
      ok: Boolean(eventContractSmokeStatus.ok),
      mode: eventContractSmokeStatus.mode ?? "unknown",
      event_type_counts: eventContractSmokeStatus.event_type_counts ?? {},
      sensitive_rejection_ok: Boolean(eventContractSmokeStatus.sensitive_rejection?.ok),
      invalid_event_rejection_ok: Boolean(eventContractSmokeStatus.invalid_event_rejection?.ok),
      isolated_fixture_event_write_performed: Boolean(eventContractSmokeStatus.isolated_fixture_event_write_performed),
      real_event_write_performed: Boolean(eventContractSmokeStatus.real_event_write_performed),
      data_lp_events_write_performed: Boolean(eventContractSmokeStatus.data_lp_events_write_performed),
      external_effect: false,
      log_path: eventContractSmokeStatus.log_path ?? null,
    },
    steps,
  };
}

function buildApprovalQueue(config, scores, abStatus, scheduleStatus, nextRoundPlan, realDataIntakeStatus, dataCollectionBriefStatus, cloudflareD1ReadinessStatus, liveTelemetryReadinessStatus, d1SchemaContractStatus, approvedD1ConfigStatus, championContractAuditStatus, championGithubHandoffStatus, ownerGateEvidenceStatus, now) {
  const needsData = scores.assets.every((asset) => asset.link_clicks === 0 && asset.visits === 0);
  const dedicatedD1Present = cloudflareD1ReadinessStatus.decision?.dedicated_database_present === true;
  const configuredD1Matches = cloudflareD1ReadinessStatus.decision?.configured_id_matches === true;
  const candidateWorkerDeploymentObserved = liveTelemetryReadinessStatus.candidate_worker?.deployment_observed === true
    && liveTelemetryReadinessStatus.candidate_worker?.health_ok === true;
  const candidateWorkerSecurityUpdateRequired = candidateWorkerDeploymentObserved
    && liveTelemetryReadinessStatus.candidate_worker?.security_contract_ok !== true;
  const candidateWorkerObservedLive = candidateWorkerDeploymentObserved && !candidateWorkerSecurityUpdateRequired;
  const championLineOnlyObserved = championContractAuditStatus.ok === true
    && championContractAuditStatus.observations?.line_only_contact_detected === true
    && championContractAuditStatus.observations?.misleading_success_state_detected === false;
  const completedExternalApprovals = new Set(
    (ownerGateEvidenceStatus.gates ?? [])
      .filter((gate) => gate.approval_id && gate.evidence_valid === true && gate.ready_for_post_gate_verification === true)
      .map((gate) => gate.approval_id),
  );
  const queue = [
    {
      id: "approve-d1-create-and-migrate",
      created_at: now.toISOString(),
      risk_tier: "T2",
      status: completedExternalApprovals.has("approve-d1-create-and-migrate")
        ? "completed_external_evidence_verified"
        : "pending_human",
      type: "cloudflare_d1_setup",
      human_gate: completedExternalApprovals.has("approve-d1-create-and-migrate")
        ? "Validated owner evidence confirms the dedicated D1 schema and recurring aggregate-only read scope."
        : dedicatedD1Present && configuredD1Matches
        ? "Confirm the newly observed dedicated D1, separately approve its remote schema migration, and explicitly scope recurring aggregate-only reads."
        : "Approve Cloudflare D1 database creation and schema migration.",
      artifact: "schema/d1-week0.sql",
      supporting_artifact: "d1_schema_contract.md",
      readiness_artifact: "cloudflare_d1_readiness.md",
      config_guard_artifact: "approved_d1_config.md",
      reason: completedExternalApprovals.has("approve-d1-create-and-migrate")
        ? "owner_gate_evidence_status.json validates the external D1 action; this queue records evidence only and performed no remote mutation."
        : dedicatedD1Present && configuredD1Matches
        ? `Read-only inventory now confirms the exact dedicated D1 and local binding; schema_contract=${d1SchemaContractStatus.status}; config_guard=${approvedD1ConfigStatus.status}. No table query or remote migration was performed, so migration remains owner-gated.`
        : "Read-only inventory confirms the dedicated Growth Loop D1 is absent; the schema is idempotency-tested locally, but resource creation and remote migration remain external account actions, and existing CRM databases must not be reused automatically.",
    },
    {
      id: "approve-candidate-worker-deploy",
      created_at: now.toISOString(),
      risk_tier: "T3",
      status: completedExternalApprovals.has("approve-candidate-worker-deploy")
        ? "completed_external_evidence_verified"
        : "pending_human",
      type: candidateWorkerObservedLive
        ? "candidate_worker_existing_deployment_provenance"
        : candidateWorkerSecurityUpdateRequired
          ? "candidate_worker_security_update"
          : "candidate_worker_deploy",
      human_gate: completedExternalApprovals.has("approve-candidate-worker-deploy")
        ? "Validated owner evidence confirms the observed healthy Candidate Worker and rollback reference."
        : candidateWorkerObservedLive
        ? "Confirm the observed Candidate Worker deployment provenance and rollback reference; do not redeploy unless the live version is rejected."
        : candidateWorkerSecurityUpdateRequired
          ? "Approve the reviewed origin/PII security update, exact Candidate target, and current rollback version before one production redeploy."
        : "Approve candidate Worker deploy after dry run and route review.",
      artifact: candidateWorkerObservedLive ? "live_telemetry_readiness.md" : "worker.ts",
      supporting_artifact: "worker.ts",
      reason: completedExternalApprovals.has("approve-candidate-worker-deploy")
        ? "owner_gate_evidence_status.json validates the existing Candidate deployment provenance; no redeploy was performed by this run."
        : candidateWorkerObservedLive
        ? `Read-only observation confirms Candidate deployment ${liveTelemetryReadinessStatus.candidate_worker.deployment_id} / version ${liveTelemetryReadinessStatus.candidate_worker.version_id} is healthy and already wired to the Champion. Owner evidence is still required, but another deploy is not currently required.`
        : candidateWorkerSecurityUpdateRequired
          ? `Candidate deployment ${liveTelemetryReadinessStatus.candidate_worker.deployment_id} / version ${liveTelemetryReadinessStatus.candidate_worker.version_id} is healthy but lacks ${liveTelemetryReadinessStatus.candidate_worker.expected_security_contract ?? "the required security contract"}. The local update rejects missing Origin and PII-like event fields; production redeploy remains owner-gated.`
        : "No healthy Candidate deployment is observed; any production deploy remains an external effect.",
    },
    {
      id: "approve-small-ab-link",
      created_at: now.toISOString(),
      risk_tier: "T3",
      status: "pending_human",
      type: "ab_traffic_link_change",
      human_gate: "Approve any small-traffic link routing before changing public links.",
      artifact: "ab_test_status.json",
      reason: "Changing a public link can affect brand funnel and customer experience.",
    },
    {
      id: "review-weekly-report",
      created_at: now.toISOString(),
      risk_tier: "T1",
      status: "ready_local_review",
      type: "weekly_report_review",
      human_gate: "Review weekly_report.md before external action.",
      artifact: "weekly_report.md",
      reason: "Report is local and safe; any external action from it remains gated.",
    },
    {
      id: "review-champion-contract-audit",
      created_at: now.toISOString(),
      risk_tier: "T1",
      status: "ready_local_review",
      type: "champion_contract_review",
      human_gate: championLineOnlyObserved
        ? "Review champion_contract_audit.md and confirm the observed LINE-only contract provenance before approving public A/B traffic."
        : "Review champion_contract_audit.md before treating contact-form success as a lead or approving public A/B traffic.",
      artifact: "champion_contract_audit.md",
      reason: championLineOnlyObserved
        ? "The live Champion currently exposes a LINE-only contact path with no misleading form success; this observation is read-only and is not deployment provenance."
        : "The live Champion exposes a local-only success state without a verified submission transport.",
    },
    {
      id: "review-champion-integration-candidate",
      created_at: now.toISOString(),
      risk_tier: "T1",
      status: "ready_local_review",
      type: "champion_integration_candidate_review",
      human_gate: "Review the source-locked 3q-site patch and isolated integration smoke before approving any production deploy.",
      artifact: "champion_integration_candidate.md",
      supporting_artifact: "champion_integration_smoke.md",
      release_artifact: "champion_release_owner_packet.md",
      local_commit_artifact: "champion_local_branch.md",
      reason: championLineOnlyObserved
        ? "The same LINE-only contract is observable live, but the local source-locked candidate remains the reviewable provenance for page_view/cta_click telemetry; any redeploy and public-link change remain blocked."
        : "The candidate removes the false-success form, uses a LINE-only contact path, and records only page_view/cta_click; production deploy and public-link changes remain blocked.",
    },
    {
      id: "approve-champion-integration-production-deploy",
      created_at: now.toISOString(),
      risk_tier: "T3",
      status: "pending_human",
      type: "champion_integration_production_deploy",
      human_gate: championLineOnlyObserved
        ? "Confirm the current live integration provenance before approving any redeploy of the exact source-locked patch, collector URL, verification steps, and rollback plan."
        : "Explicitly approve the live 3q-site deploy target, exact source-locked patch, collector URL, verification steps, and rollback plan.",
      artifact: "champion_integration_candidate.md",
      supporting_artifact: "champion_integration_smoke.md",
      release_artifact: "champion_release_owner_packet.md",
      local_commit_artifact: "champion_local_branch.md",
      reason: championLineOnlyObserved
        ? "A LINE-only contract is already observable, so this gate must not imply another deploy is required. Any redeploy still mutates production and remains owner-only."
        : "Deploying the contact repair mutates the live champion experience. This gate is intentionally not converted into an automated resume command.",
    },
    {
      id: "review-next-round-plan",
      created_at: now.toISOString(),
      risk_tier: "T1",
      status: "ready_local_review",
      type: "next_round_review",
      human_gate: "Review next_round_plan.md before starting a new public A/B variable or extending the current test.",
      artifact: "next_round_plan.md",
      reason: `Current decision=${nextRoundPlan.decision}; this remains a local planning artifact with no public link change.`,
    },
    {
      id: "review-owner-approval-pack",
      created_at: now.toISOString(),
      risk_tier: "T1",
      status: "ready_local_review",
      type: "launch_readiness_review",
      human_gate: "Review owner_approval_pack.md before approving remote D1, Worker deploy, public A/B routing, or GitHub publishing.",
      artifact: "owner_approval_pack.md",
      reason: "The pack consolidates owner-only actions, resume commands, rollback notes, and current evidence.",
    },
    {
      id: "review-owner-console",
      created_at: now.toISOString(),
      risk_tier: "T1",
      status: "ready_local_review",
      type: "owner_console_review",
      human_gate: "Review owner_console.html as the local single-screen approval surface.",
      artifact: "owner_console.html",
      reason: "The console is local-only and groups report, next-round decision, archive, red lines, and owner gates.",
    },
    {
      id: "review-real-data-input-pack",
      created_at: now.toISOString(),
      risk_tier: "T1",
      status: "ready_local_review",
      type: "real_data_input_pack_review",
      human_gate: "Review real_data_input_pack.md before filling aggregate counts or copying templates into live input CSV filenames.",
      artifact: "real_data_input_pack.md",
      reason: "The fill pack is local-only, but copied live CSVs can later affect scoring; keep it aggregate-only and PII-free.",
    },
    {
      id: "review-source-readiness",
      created_at: now.toISOString(),
      risk_tier: "T1",
      status: "ready_local_review",
      type: "source_readiness_review",
      human_gate: "Review source_readiness.md before interpreting sample gaps or approving any public A/B route.",
      artifact: "source_readiness.md",
      reason: "Source readiness shows which north-star funnel stages are still missing real data and keeps public iteration decisions blocked until sample thresholds are met.",
    },
    {
      id: "review-source-capture-pack",
      created_at: now.toISOString(),
      risk_tier: "T1",
      status: "ready_local_review",
      type: "source_capture_review",
      human_gate: "Review source_capture_pack.md before filling aggregate source counts or creating live input CSVs.",
      artifact: "source_capture_pack.md",
      reason: "The capture pack maps source systems to aggregate-only counts and keeps data/lp_events.jsonl unchanged until owner-reviewed local apply.",
    },
    {
      id: "review-source-capture-compile",
      created_at: now.toISOString(),
      risk_tier: "T1",
      status: "ready_local_review",
      type: "source_capture_compile_review",
      human_gate: "Review source_capture_compile_report.md and owner-preview CSVs before copying them to live aggregate input filenames.",
      artifact: "source_capture_compile_report.md",
      reason: "The compiler validates filled aggregate rows and creates preview CSVs, but live CSV promotion and any apply remain owner-reviewed local actions.",
    },
    {
      id: "review-real-data-intake-plan",
      created_at: now.toISOString(),
      risk_tier: "T1",
      status: "ready_local_review",
      type: "real_data_intake_review",
      human_gate: realDataIntakeStatus.ready_apply_count > 0
        ? "Review real_data_intake_plan.md and only then run the listed local apply command for reviewed aggregate data."
        : "Review real_data_intake_plan.md to see which aggregate CSV inputs are still missing.",
      artifact: "real_data_intake_plan.md",
      reason: `Intake status=${realDataIntakeStatus.status ?? "not_run"}; ready_apply_count=${realDataIntakeStatus.ready_apply_count ?? 0}; data/lp_events.jsonl is not changed by the intake plan.`,
    },
    {
      id: "review-data-collection-brief",
      created_at: now.toISOString(),
      risk_tier: "T1",
      status: "ready_local_review",
      type: "data_collection_review",
      human_gate: "Review data_collection_brief.md and sample_gate_collection_plan.md before filling aggregate counts or compiling owner-preview CSVs.",
      artifact: "data_collection_brief.md",
      supporting_artifact: "sample_gate_collection_plan.md",
      reason: `Brief status=${dataCollectionBriefStatus.status ?? "not_run"}; tasks=${dataCollectionBriefStatus.task_count ?? 0}; sample_gate_p0_tasks=${dataCollectionBriefStatus.sample_gate_p0_task_count ?? 0}; live_input_files_created=${dataCollectionBriefStatus.live_input_files_created ? "yes" : "no"}; data/lp_events.jsonl is not changed by the brief.`,
    },
    {
      id: "review-line-inbound-playbook",
      created_at: now.toISOString(),
      risk_tier: "T1",
      status: "ready_local_review",
      type: "line_inbound_playbook_review",
      human_gate: "Review line_inbound_playbook.md before using it in manual LINE replies.",
      artifact: "line_inbound_playbook.md",
      reason: "The playbook is inbound-only and aggregate-only; formal LINE push, customer-data edits, and payment actions remain blocked.",
    },
    {
      id: "review-local-launchagent-install",
      created_at: now.toISOString(),
      risk_tier: "T1",
      status: scheduleStatus.launchd_installed ? "completed_local_reversible" : "ready_local_review",
      type: "local_schedule_install",
      human_gate: scheduleStatus.launchd_installed
        ? "Local LaunchAgent is installed. Use npm run schedule:uninstall to stop the Sunday local runner."
        : "Review and optionally install the macOS LaunchAgent for Sunday local runs.",
      artifact: scheduleStatus.launchd_installed ? "data/launchagent_status.json" : "launchd/com.angelia.3q-growth-loop.weekly.plist",
      reason: scheduleStatus.launchd_installed
        ? "Persistent local automation is active and reversible; external publishing/deploy gates remain blocked."
        : "Persistent local automation is reversible, but it should remain visible before install.",
    },
    {
      id: "approve-github-repo-and-pr",
      created_at: now.toISOString(),
      risk_tier: "T2",
      status: completedExternalApprovals.has("approve-github-repo-and-pr")
        ? "completed_external_evidence_verified"
        : "pending_human",
      type: "github_publish_or_pr",
      human_gate: completedExternalApprovals.has("approve-github-repo-and-pr")
        ? "Validated owner evidence confirms the reviewed branch and Draft PR. Merge remains a separate owner-only gate."
        : "Review the prepared local Champion commit, then explicitly approve its branch push or draft PR. Do not merge from this gate.",
      artifact: "champion_github_handoff.md",
      supporting_artifact: "champion_local_branch.md",
      engine_bundle_artifact: "github_handoff.md",
      reason: completedExternalApprovals.has("approve-github-repo-and-pr")
        ? "owner_gate_evidence_status.json validates the branch and Draft PR evidence; this does not authorize or claim merge or production deployment."
        : `The exact 3q-site repository, branch, commit, and PR body are prepared locally (handoff=${championGithubHandoffStatus.status ?? "unknown"}), but pushing the branch or opening a draft PR is an external GitHub write. The separate control-center engine bundle remains local-only.`,
    },
  ];

  if (needsData) {
    queue.unshift({
      id: "collect-first-real-events",
      created_at: now.toISOString(),
      risk_tier: "T1",
      status: "ready_local_review",
      type: "data_collection",
      human_gate: "Start with local/manual lp_events ingestion or approve D1 connection.",
      artifact: "data/lp_events.jsonl",
      reason: "No real events are present yet; sample is insufficient by design.",
    });
  }

  if (abStatus.challenger_win_rule_met) {
    queue.push({
      id: "review-challenger-promotion",
      created_at: now.toISOString(),
      risk_tier: "T3",
      status: "pending_human",
      type: "promotion_review",
      human_gate: "Manually approve challenger promotion; do not auto-change champion.",
      artifact: "growth_scores.json",
      reason: "Winning rule met, but promotion changes the primary funnel.",
    });
  }

  return {
    generated_at: now.toISOString(),
    policy: {
      no_external_send: true,
      no_production_deploy: true,
      no_primary_link_change: true,
      no_customer_data_mutation: true,
    },
    items: queue,
  };
}

function buildApprovalQueueStatus(approvalQueue, now) {
  const items = approvalQueue.items ?? [];
  const statusCounts = countBy(items, "status");
  const riskTierCounts = countBy(items, "risk_tier");
  const typeCounts = countBy(items, "type");
  const pendingHumanItems = items.filter((item) => item.status === "pending_human");
  const readyLocalItems = items.filter((item) => item.status === "ready_local_review");
  const completedLocalItems = items.filter((item) => item.status === "completed_local_reversible");
  const completedExternalEvidenceItems = items.filter((item) => item.status === "completed_external_evidence_verified");
  const highRiskPendingItems = pendingHumanItems.filter((item) => ["T2", "T3"].includes(item.risk_tier));

  return {
    ok: true,
    generated_at: now.toISOString(),
    mode: "approval_queue_status_local_only",
    status: pendingHumanItems.length > 0 ? "approval_queue_ready_with_human_gates" : "approval_queue_ready_local_only",
    queue_json_path: "approval_queue.json",
    item_count: items.length,
    status_counts: statusCounts,
    risk_tier_counts: riskTierCounts,
    type_counts: typeCounts,
    ready_local_review_count: readyLocalItems.length,
    pending_human_count: pendingHumanItems.length,
    completed_local_reversible_count: completedLocalItems.length,
    completed_external_evidence_verified_count: completedExternalEvidenceItems.length,
    high_risk_pending_count: highRiskPendingItems.length,
    next_ready_local_review_id: readyLocalItems[0]?.id ?? null,
    next_ready_local_review_artifact: readyLocalItems[0]?.artifact ?? null,
    next_pending_human_id: pendingHumanItems[0]?.id ?? null,
    next_pending_human_artifact: pendingHumanItems[0]?.artifact ?? null,
    pending_human_ids: pendingHumanItems.map((item) => item.id),
    ready_local_review_ids: readyLocalItems.map((item) => item.id),
    completed_local_reversible_ids: completedLocalItems.map((item) => item.id),
    completed_external_evidence_verified_ids: completedExternalEvidenceItems.map((item) => item.id),
    high_risk_pending_ids: highRiskPendingItems.map((item) => item.id),
    policy: approvalQueue.policy ?? {},
    policy_ok:
      approvalQueue.policy?.no_external_send === true &&
      approvalQueue.policy?.no_production_deploy === true &&
      approvalQueue.policy?.no_primary_link_change === true &&
      approvalQueue.policy?.no_customer_data_mutation === true,
    external_effect: false,
    live_input_files_created: false,
    data_lp_events_write_performed: false,
    approval_action_executed: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    note: "Compact local status for approval_queue.json. It summarizes owner gates and executes no approval, deploy, GitHub, public-link, post, LINE, payment, customer-data, or delete action.",
  };
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function buildPreparedButBlocked(config, evidence, now) {
  const dedicatedD1Present = evidence.cloudflareD1ReadinessStatus?.decision?.dedicated_database_present === true;
  const configuredD1Matches = evidence.cloudflareD1ReadinessStatus?.decision?.configured_id_matches === true;
  const existingD1ReadyForMigrationReview = dedicatedD1Present && configuredD1Matches;
  const candidateWorkerDeploymentObserved = evidence.liveTelemetryReadinessStatus?.candidate_worker?.deployment_observed === true
    && evidence.liveTelemetryReadinessStatus?.candidate_worker?.health_ok === true;
  const candidateWorkerSecurityUpdateRequired = candidateWorkerDeploymentObserved
    && evidence.liveTelemetryReadinessStatus?.candidate_worker?.security_contract_ok !== true;
  const candidateWorkerObservedLive = candidateWorkerDeploymentObserved && !candidateWorkerSecurityUpdateRequired;
  const championLineOnlyObserved = evidence.championContractAuditStatus?.ok === true
    && evidence.championContractAuditStatus?.observations?.line_only_contact_detected === true
    && evidence.championContractAuditStatus?.observations?.misleading_success_state_detected === false;
  const blocks = [
    {
      id: existingD1ReadyForMigrationReview ? "blocked-d1-remote-schema-review" : "blocked-d1-remote-create",
      created_at: now.toISOString(),
      action: existingD1ReadyForMigrationReview
        ? "verify_existing_cloudflare_d1_and_apply_schema"
        : "create_cloudflare_d1_and_apply_schema",
      operation_mode: existingD1ReadyForMigrationReview
        ? "verify_existing_d1_then_migrate_schema"
        : "create_dedicated_d1_then_migrate_schema",
      resource_create_required: !existingD1ReadyForMigrationReview,
      blocked_by: existingD1ReadyForMigrationReview
        ? "Read-only Cloudflare inventory confirms the exact dedicated Growth Loop D1 now exists and matches wrangler.jsonc, but no table query or remote schema migration has been approved or performed."
        : "Read-only Cloudflare inventory confirms the dedicated Growth Loop D1 is absent; remote resource creation requires owner approval and existing CRM databases cannot be reused automatically.",
      prepared_artifact: "schema/d1-week0.sql",
      supporting_artifact: "d1_schema_contract.md",
      readiness_artifact: "cloudflare_d1_readiness.md",
      config_guard_artifact: "approved_d1_config.md",
      resume_when: existingD1ReadyForMigrationReview
        ? `Owner confirms the observed database provenance, explicitly approves remote migration, and records recurring_aggregate_read_approved=true only if weekly grouped-count reads are allowed after reviewing ${evidence.d1SchemaContractStatus?.status ?? "the local schema contract"}; local config guard remains ${evidence.approvedD1ConfigStatus?.status ?? "unverified"}.`
        : "Owner approves Cloudflare D1 creation and provides non-secret approval metadata; the exact returned database id must then pass live inventory matching before local config is updated.",
    },
    {
      id: candidateWorkerObservedLive
        ? "blocked-worker-live-provenance-review"
        : candidateWorkerSecurityUpdateRequired
          ? "blocked-worker-security-update"
          : "blocked-worker-production-deploy",
      created_at: now.toISOString(),
      action: candidateWorkerObservedLive
        ? "confirm_existing_candidate_worker_provenance"
        : candidateWorkerSecurityUpdateRequired
          ? "deploy_candidate_worker_security_update"
          : "deploy_candidate_worker",
      operation_mode: candidateWorkerObservedLive
        ? "verify_existing_candidate_deployment"
        : candidateWorkerSecurityUpdateRequired
          ? "deploy_candidate_worker_security_update"
          : "deploy_candidate_worker",
      resource_deploy_required: !candidateWorkerObservedLive,
      blocked_by: candidateWorkerObservedLive
        ? `Read-only observation confirms Candidate deployment ${evidence.liveTelemetryReadinessStatus.candidate_worker.deployment_id} / version ${evidence.liveTelemetryReadinessStatus.candidate_worker.version_id} is healthy and wired to the Champion, but owner provenance evidence is not recorded. A redeploy is not currently required.`
        : candidateWorkerSecurityUpdateRequired
          ? `Candidate deployment ${evidence.liveTelemetryReadinessStatus.candidate_worker.deployment_id} / version ${evidence.liveTelemetryReadinessStatus.candidate_worker.version_id} is healthy but lacks ${evidence.liveTelemetryReadinessStatus.candidate_worker.expected_security_contract ?? "the required security contract"}; current ingest is not production-ready until the reviewed origin/PII hardening is owner-approved and deployed.`
        : "No healthy Candidate deployment is observed; formal production deploy remains a hard red line.",
      prepared_artifact: candidateWorkerObservedLive ? "live_telemetry_readiness.md" : "worker.ts",
      supporting_artifact: "worker.ts",
      resume_when: candidateWorkerObservedLive
        ? "Owner confirms the observed Worker name, URL, deployment/version reference, health result, and rollback reference in owner_gate_evidence.json. Redeploy only if the observed version is rejected."
        : candidateWorkerSecurityUpdateRequired
          ? "Owner reviews the local event-contract diff, confirms the exact Candidate target and current rollback version, then explicitly approves one security redeploy and post-deploy marker verification."
        : "Owner explicitly approves deploy target, route, and rollback plan.",
    },
    {
      id: championLineOnlyObserved ? "blocked-champion-live-provenance-review" : "blocked-champion-form-contract-repair",
      created_at: now.toISOString(),
      action: championLineOnlyObserved
        ? "confirm_champion_live_contract_provenance_before_redeploy"
        : "repair_or_remove_champion_contact_form_false_success",
      live_contract_observed: championLineOnlyObserved,
      blocked_by: championLineOnlyObserved
        ? "The LINE-only Champion contract is observable live, but deployment provenance is not owner evidence and any redeploy remains a production action."
        : "Changing the live 3q-site contact experience requires owner approval and a production deploy.",
      prepared_artifact: "champion_integration_candidate.md",
      supporting_artifact: "champion_integration_smoke.md",
      release_artifact: "champion_release_owner_packet.md",
      local_commit_artifact: "champion_local_branch.md",
      resume_when: championLineOnlyObserved
        ? "Owner confirms the current live deployment provenance, reviews the prepared local Champion commit and release packet, and separately approves any redeploy target and rollback plan."
        : "Owner reviews the prepared local Champion commit and release packet, then explicitly approves the production target and rollback plan.",
    },
    {
      id: "blocked-primary-link-change",
      created_at: now.toISOString(),
      action: "change_primary_social_or_bio_link",
      blocked_by: "Primary link changes affect public acquisition flow.",
      prepared_artifact: "ab_test_status.json",
      resume_when: "Owner approves exact URL, traffic share, and duration.",
    },
    {
      id: "blocked-formal-posting",
      created_at: now.toISOString(),
      action: "formal_social_post_or_line_push",
      blocked_by: "External posting and LINE push remain human-only.",
      prepared_artifact: "weekly_report.md",
      resume_when: "Owner opens the platform and manually confirms Publish, Send, Broadcast, or Schedule.",
    },
    {
      id: "blocked-github-publish",
      created_at: now.toISOString(),
      action: "github_push_or_pr_creation",
      blocked_by: `The Champion feature commit and exact draft PR packet are prepared locally (${evidence.championGithubHandoffStatus?.status ?? "handoff status unknown"}), but branch push / PR creation is an external GitHub write; the engine bundle remains a separate local-only handoff.`,
      prepared_artifact: "champion_github_handoff.md",
      supporting_artifact: "champion_local_branch.md",
      release_artifact: "champion_release_owner_packet.md",
      engine_bundle_artifact: "github_handoff.md",
      resume_when: "Owner reviews the exact commit and PR body, then explicitly approves branch push or draft PR creation. Merge and deploy remain blocked.",
    },
    {
      id: "blocked-owner-launch-sequence",
      created_at: now.toISOString(),
      action: "execute_owner_approved_launch_sequence",
      blocked_by: "The launch sequence combines remote D1, production Worker, public A/B route, and GitHub publishing decisions.",
      prepared_artifact: "owner_approval_pack.md",
      resume_when: "Owner explicitly approves the individual external gates in owner_approval_pack.md.",
    },
    {
      id: "blocked-customer-and-payment",
      created_at: now.toISOString(),
      action: "customer_data_or_ecpay_payment_mutation",
      blocked_by: "Customer data, payments, refunds, and ECPay are hard red lines.",
      prepared_artifact: null,
      resume_when: "Owner gives a separate, explicit instruction for a reviewed manual operation.",
    },
  ];

  return {
    generated_at: now.toISOString(),
    status: "prepared_but_blocked",
    blocked_actions_from_config: config.blocked_actions,
    data_evidence_gates: buildDataEvidenceGates(evidence),
    items: blocks,
  };
}

function buildDataEvidenceGates({ dataCollectionProgressStatus, sourceTrustMatrixStatus, abStatus }) {
  const p0Pending = dataCollectionProgressStatus.p0_pending_count ?? 0;
  const p1Pending = dataCollectionProgressStatus.p1_pending_count ?? 0;
  const trustedSources = sourceTrustMatrixStatus.trusted_scoring_source_count ?? 0;
  const realEventRows = sourceTrustMatrixStatus.real_event_rows ?? 0;

  return [
    {
      id: "p0_sample_gate_evidence",
      status: p0Pending === 0 && abStatus.sample_threshold_met === true ? "met" : "unmet",
      blocking_completion: true,
      observed: {
        p0_pending_count: p0Pending,
        sample_threshold_met: abStatus.sample_threshold_met === true,
      },
      required: "All P0 aggregate-count tasks are reviewed and the visit / CTA / LINE-add / test-day sample gate is met.",
      prepared_artifact: "next_p0_owner_form.html",
      next_action: "Fill and review aggregate-only P0 counts; do not use customer-level data.",
      external_effect: false,
      data_lp_events_write_performed: false,
    },
    {
      id: "p1_outcome_quality_evidence",
      status: p1Pending === 0 ? "met" : "unmet",
      blocking_completion: true,
      observed: {
        p1_pending_count: p1Pending,
      },
      required: "All P1 LINE-add, lead, deal, and quality outcome counts are reviewed, including explicit zeroes.",
      prepared_artifact: "north_star_outcome_form.html",
      next_action: "Fill aggregate-only P1 outcomes and quality flags; keep customer identities outside the engine.",
      external_effect: false,
      data_lp_events_write_performed: false,
    },
    {
      id: "trusted_scoring_input",
      status:
        sourceTrustMatrixStatus.scoring_allowed_now === true &&
        trustedSources > 0 &&
        realEventRows > 0
          ? "met"
          : "unmet",
      blocking_completion: true,
      observed: {
        scoring_allowed_now: sourceTrustMatrixStatus.scoring_allowed_now === true,
        trusted_scoring_source_count: trustedSources,
        real_event_rows: realEventRows,
      },
      required: "At least one trusted scoring source contributes real, privacy-safe events that pass the source-trust gate.",
      prepared_artifact: "source_trust_matrix.md",
      next_action: "Compile reviewed aggregate inputs, preview them, and apply only after the explicit real-data gate.",
      external_effect: false,
      data_lp_events_write_performed: false,
    },
  ];
}

function buildLaunchReadiness(config, scores, abStatus, approvalQueue, blocked, pipelineStatus, funnelBreakdown, d1SyncStatus, eventInputQualityStatus, funnelAggregateStatus, funnelAggregateFixtureStatus, realDataApplyFixtureStatus, realDataDecisionReplayStatus, sourceReadinessStatus, sourceCaptureStatus, sourceCaptureCompileStatus, sourceCaptureCompileFixtureStatus, realDataIntakeStatus, dataCollectionBriefStatus, dataCollectionProgressStatus, nextP0OwnerFormStatus, nextP0OwnerFormFixtureStatus, nextP0OwnerIntakeStatus, nextP0OwnerIntakeFixtureStatus, manualConversionStatus, lineInboundStatus, manualPublishEvidenceFormStatus, manualPublishEvidenceFormFixtureStatus, scheduleStatus, workerDryRunStatus, browserSmokeStatus, trackingLinkSmokeStatus, eventContractSmokeStatus, cloudflareD1ReadinessStatus, liveTelemetryReadinessStatus, d1SchemaContractStatus, approvedD1ConfigStatus, championGithubHandoffStatus, winRuleFixtureStatus, weekArchiveStatus, nextRoundPlan, events, now) {
  const pendingHumanApprovals = approvalQueue.items.filter((item) => item.status === "pending_human");
  const dedicatedD1Present = cloudflareD1ReadinessStatus.decision?.dedicated_database_present === true;
  const configuredD1Matches = cloudflareD1ReadinessStatus.decision?.configured_id_matches === true;
  const candidateWorkerDeploymentObserved = liveTelemetryReadinessStatus.candidate_worker?.deployment_observed === true
    && liveTelemetryReadinessStatus.candidate_worker?.health_ok === true;
  const candidateWorkerSecurityUpdateRequired = candidateWorkerDeploymentObserved
    && liveTelemetryReadinessStatus.candidate_worker?.security_contract_ok !== true;
  const candidateWorkerObservedLive = candidateWorkerDeploymentObserved && !candidateWorkerSecurityUpdateRequired;
  const contentVariantLinkCount = funnelBreakdown.summary.content_variant_links ?? 0;
  const expectedContentVariantLinks = config.content_variant_drafts?.length ?? 0;
  const localPreflight = [
    {
      id: "weekly_runner",
      ok: scheduleStatus.runner_status.status === "success",
      evidence: scheduleStatus.runner_status.log_path ?? "data/weekly_runner_status.json",
    },
    {
      id: "cloudflare_d1_metadata_readiness",
      ok:
        cloudflareD1ReadinessStatus.ok === true &&
        cloudflareD1ReadinessStatus.remote_table_query_performed === false &&
        cloudflareD1ReadinessStatus.remote_schema_migration_performed === false &&
        cloudflareD1ReadinessStatus.resource_create_performed === false,
      evidence: "cloudflare_d1_readiness.md",
    },
    {
      id: "live_telemetry_chain_readiness",
      ok:
        liveTelemetryReadinessStatus.ok === true &&
        liveTelemetryReadinessStatus.remote_table_query_performed === false &&
        liveTelemetryReadinessStatus.event_post_performed === false &&
        liveTelemetryReadinessStatus.customer_data_read_performed === false &&
        liveTelemetryReadinessStatus.production_deploy_performed === false,
      evidence: "live_telemetry_readiness.md",
    },
    {
      id: "d1_schema_contract",
      ok:
        d1SchemaContractStatus.ok === true &&
        Object.values(d1SchemaContractStatus.checks ?? {}).every(Boolean) &&
        d1SchemaContractStatus.remote_d1_migration_performed === false,
      evidence: "d1_schema_contract.md",
    },
    {
      id: "approved_d1_config_guard",
      ok:
        approvedD1ConfigStatus.ok === true &&
        approvedD1ConfigStatus.mode === "approved_d1_config_preview_local_only" &&
        approvedD1ConfigStatus.local_config_write_performed === false,
      evidence: "approved_d1_config.md",
    },
    {
      id: "champion_github_handoff",
      ok:
        championGithubHandoffStatus.ok === true &&
        championGithubHandoffStatus.pull_request?.draft_required === true &&
        championGithubHandoffStatus.pull_request?.merge_permitted === false &&
        championGithubHandoffStatus.github_push_or_pr_performed === false,
      evidence: "champion_github_handoff.md",
    },
    {
      id: "candidate_worker_dry_run",
      ok:
        Boolean(workerDryRunStatus.ok) &&
        workerDryRunStatus.dry_run_exit_observed === true &&
        workerDryRunStatus.production_deploy_performed === false &&
        workerDryRunStatus.external_effect === false,
      evidence: workerDryRunStatus.report_path ?? "worker_dry_run.md",
    },
    {
      id: "browser_route_smoke",
      ok: Boolean(browserSmokeStatus.ok) && !browserSmokeStatus.event_write_performed,
      evidence: browserSmokeStatus.log_path ?? "data/browser_smoke_status.json",
    },
    {
      id: "tracking_link_smoke",
      ok:
        Boolean(trackingLinkSmokeStatus.ok) &&
        trackingLinkSmokeStatus.real_event_write_performed === false &&
        trackingLinkSmokeStatus.data_lp_events_write_performed === false &&
        trackingLinkSmokeStatus.external_effect === false &&
        (trackingLinkSmokeStatus.links_checked ?? 0) === (trackingLinkSmokeStatus.expected_link_count ?? -1),
      evidence: trackingLinkSmokeStatus.log_path ?? "data/tracking_link_smoke_status.json",
    },
    {
      id: "event_contract_smoke",
      ok:
        Boolean(eventContractSmokeStatus.ok) &&
        eventContractSmokeStatus.real_event_write_performed === false &&
        eventContractSmokeStatus.data_lp_events_write_performed === false &&
        eventContractSmokeStatus.sensitive_rejection?.ok === true,
      evidence: eventContractSmokeStatus.log_path ?? "data/event_contract_smoke_status.json",
    },
    {
      id: "event_input_quality_gate",
      ok:
        Boolean(eventInputQualityStatus.ok) &&
        eventInputQualityStatus.scoring_allowed === true &&
        eventInputQualityStatus.pii_or_sensitive_data_detected === false &&
        (eventInputQualityStatus.issues ?? []).length === 0 &&
        eventInputQualityStatus.data_lp_events_write_performed === false,
      evidence: "data/event_input_quality_status.json",
    },
    {
      id: "funnel_aggregate_preview",
      ok:
        Boolean(funnelAggregateStatus.ok) &&
        funnelAggregateStatus.mode === "full_funnel_preview" &&
        funnelAggregateStatus.apply_performed === false &&
        funnelAggregateStatus.data_lp_events_write_performed === false &&
        funnelAggregateStatus.external_effect === false &&
        funnelAggregateStatus.contains_sensitive_columns === false &&
        funnelAggregateStatus.contains_sensitive_values === false,
      evidence: funnelAggregateStatus.output_path ?? "data/funnel_aggregates.preview.jsonl",
    },
    {
      id: "funnel_aggregate_fixtures",
      ok:
        Boolean(funnelAggregateFixtureStatus.ok) &&
        funnelAggregateFixtureStatus.mode === "funnel_aggregate_fixture_dry_run" &&
        funnelAggregateFixtureStatus.execution_performed === false &&
        funnelAggregateFixtureStatus.real_event_write_performed === false &&
        funnelAggregateFixtureStatus.data_lp_events_write_performed === false &&
        funnelAggregateFixtureStatus.external_effect === false,
      evidence: "data/funnel_aggregate_fixture_status.json + funnel_aggregate_fixture_report.md",
    },
    {
      id: "real_data_apply_fixtures",
      ok:
        Boolean(realDataApplyFixtureStatus.ok) &&
        realDataApplyFixtureStatus.mode === "real_data_apply_fixture_dry_run" &&
        realDataApplyFixtureStatus.execution_performed === false &&
        realDataApplyFixtureStatus.real_event_write_performed === false &&
        realDataApplyFixtureStatus.data_lp_events_write_performed === false &&
        realDataApplyFixtureStatus.external_effect === false &&
        (realDataApplyFixtureStatus.scenarios ?? []).every((scenario) => scenario.ok === true && scenario.data_lp_events_write_performed === false && scenario.real_events_unchanged === true),
      evidence: "data/real_data_apply_fixture_status.json + real_data_apply_fixture_report.md",
    },
    {
      id: "real_data_decision_replay",
      ok:
        Boolean(realDataDecisionReplayStatus.ok) &&
        realDataDecisionReplayStatus.mode === "real_data_decision_replay_fixture_dry_run" &&
        realDataDecisionReplayStatus.scenario_count === 6 &&
        realDataDecisionReplayStatus.local_fixture_commands_executed === true &&
        realDataDecisionReplayStatus.local_importer_preview_commands_executed === true &&
        realDataDecisionReplayStatus.source_capture_ledger_replay_executed === true &&
        realDataDecisionReplayStatus.source_capture_compile_commands_executed === true &&
        realDataDecisionReplayStatus.ledger_to_decision_replay_performed === true &&
        realDataDecisionReplayStatus.execution_performed === false &&
        realDataDecisionReplayStatus.real_event_write_performed === false &&
        realDataDecisionReplayStatus.data_lp_events_write_performed === false &&
        realDataDecisionReplayStatus.external_effect === false &&
        (realDataDecisionReplayStatus.scenarios ?? []).every((scenario) =>
          scenario.ok === true &&
          scenario.source_capture_compile?.ok === true &&
          scenario.source_capture_compile?.status === "owner_preview_ready" &&
          scenario.source_capture_compile?.data_lp_events_write_performed === false &&
          scenario.source_capture_compile?.external_effect === false &&
          scenario.promotion_performed === false &&
          scenario.data_lp_events_write_performed === false &&
          scenario.external_effect === false
        ),
      evidence: "data/real_data_decision_replay_status.json + real_data_decision_replay_report.md",
    },
    {
      id: "source_readiness_monitor",
      ok:
        Boolean(sourceReadinessStatus.ok) &&
        sourceReadinessStatus.mode === "source_readiness_monitor" &&
        sourceReadinessStatus.data_lp_events_write_performed === false &&
        sourceReadinessStatus.external_effect === false &&
        (sourceReadinessStatus.ready_for_public_iteration_decision === false || sourceReadinessStatus.sample_progress?.sample_threshold_met === true),
      evidence: "data/source_readiness_status.json + source_readiness.md",
    },
    {
      id: "source_capture_pack",
      ok:
        Boolean(sourceCaptureStatus.ok) &&
        sourceCaptureStatus.mode === "source_capture_pack" &&
        sourceCaptureStatus.template_only === true &&
        sourceCaptureStatus.owner_review_required === true &&
        sourceCaptureStatus.live_input_files_created === false &&
        sourceCaptureStatus.real_events_unchanged === true &&
        sourceCaptureStatus.data_lp_events_write_performed === false &&
        sourceCaptureStatus.external_effect === false &&
        (sourceCaptureStatus.ledger_rows ?? 0) > 0 &&
        (sourceCaptureStatus.sample_gate_ledger_rows ?? 0) > 0,
      evidence: "source_capture_pack.md + data/source_capture_status.json",
    },
    {
      id: "source_capture_compile",
      ok:
        Boolean(sourceCaptureCompileStatus.ok) &&
        sourceCaptureCompileStatus.mode === "source_capture_compile_preview" &&
        ["waiting_for_filled_counts", "owner_preview_ready"].includes(sourceCaptureCompileStatus.status) &&
        sourceCaptureCompileStatus.owner_review_required === true &&
        sourceCaptureCompileStatus.live_input_files_created === false &&
        sourceCaptureCompileStatus.data_lp_events_write_performed === false &&
        sourceCaptureCompileStatus.external_effect === false,
      evidence: "source_capture_compile_report.md + data/source_capture_compile_status.json",
    },
    {
      id: "source_capture_compile_fixtures",
      ok:
        Boolean(sourceCaptureCompileFixtureStatus.ok) &&
        sourceCaptureCompileFixtureStatus.mode === "source_capture_compile_fixture_dry_run" &&
        sourceCaptureCompileFixtureStatus.execution_performed === false &&
        sourceCaptureCompileFixtureStatus.real_event_write_performed === false &&
        sourceCaptureCompileFixtureStatus.data_lp_events_write_performed === false &&
        sourceCaptureCompileFixtureStatus.external_effect === false,
      evidence: "source_capture_compile_fixture_report.md + data/source_capture_compile_fixture_status.json",
    },
    {
      id: "real_data_intake_plan",
      ok:
        Boolean(realDataIntakeStatus.ok) &&
        realDataIntakeStatus.mode === "real_data_intake_plan" &&
        realDataIntakeStatus.apply_performed === false &&
        realDataIntakeStatus.data_lp_events_write_performed === false &&
        realDataIntakeStatus.external_effect === false &&
        realDataIntakeStatus.real_events_unchanged === true,
      evidence: "data/real_data_intake_status.json + real_data_intake_plan.md",
    },
    {
      id: "data_collection_brief",
      ok:
        Boolean(dataCollectionBriefStatus.ok) &&
        dataCollectionBriefStatus.mode === "data_collection_brief" &&
        (dataCollectionBriefStatus.task_count ?? 0) > 0 &&
        (dataCollectionBriefStatus.sample_gate_stage_count ?? 0) === 3 &&
        dataCollectionBriefStatus.live_input_files_created === false &&
        dataCollectionBriefStatus.data_lp_events_write_performed === false &&
        dataCollectionBriefStatus.external_effect === false,
      evidence: "data_collection_brief.md + data_collection_queue.json + sample_gate_collection_plan.md + data/sample_gate_collection_plan_status.json",
    },
    {
      id: "data_collection_progress",
      ok:
        Boolean(dataCollectionProgressStatus.ok) &&
        dataCollectionProgressStatus.mode === "data_collection_progress" &&
        dataCollectionProgressStatus.total_task_count === 42 &&
        dataCollectionProgressStatus.p0_task_count === 18 &&
        dataCollectionProgressStatus.live_input_files_created === false &&
        dataCollectionProgressStatus.data_lp_events_write_performed === false &&
        dataCollectionProgressStatus.external_effect === false,
      evidence: "data_collection_progress.md + data_collection_progress.json + data/data_collection_progress_status.json",
    },
    {
      id: "next_p0_owner_form",
      ok:
        Boolean(nextP0OwnerFormStatus.ok) &&
        nextP0OwnerFormStatus.mode === "next_p0_owner_form" &&
        nextP0OwnerFormStatus.status === "ready_local_next_p0_owner_form" &&
        nextP0OwnerFormStatus.browser_only === true &&
        nextP0OwnerFormStatus.browser_persistence === false &&
        nextP0OwnerFormStatus.network_calls_performed === false &&
        nextP0OwnerFormStatus.live_input_files_created === false &&
        nextP0OwnerFormStatus.data_lp_events_write_performed === false &&
        nextP0OwnerFormStatus.external_effect === false,
      evidence: "next_p0_owner_form.html + data/next_p0_owner_form_status.json",
    },
    {
      id: "next_p0_owner_form_fixtures",
      ok:
        Boolean(nextP0OwnerFormFixtureStatus.ok) &&
        nextP0OwnerFormFixtureStatus.mode === "next_p0_owner_form_fixture_dry_run" &&
        nextP0OwnerFormFixtureStatus.browser_form_static_checks_executed === true &&
        nextP0OwnerFormFixtureStatus.export_contract_verified === true &&
        nextP0OwnerFormFixtureStatus.live_input_files_created === false &&
        nextP0OwnerFormFixtureStatus.data_lp_events_write_performed === false &&
        nextP0OwnerFormFixtureStatus.external_effect === false,
      evidence: "next_p0_owner_form_fixture_report.md + data/next_p0_owner_form_fixture_status.json",
    },
    {
      id: "next_p0_owner_intake",
      ok:
        Boolean(nextP0OwnerIntakeStatus.ok) &&
        nextP0OwnerIntakeStatus.mode === "next_p0_owner_intake" &&
        ["waiting_for_next_p0_owner_download", "next_p0_owner_download_preview_ready", "next_p0_owner_download_staged_local_inputs"].includes(nextP0OwnerIntakeStatus.status) &&
        nextP0OwnerIntakeStatus.data_lp_events_write_performed === false &&
        nextP0OwnerIntakeStatus.external_effect === false,
      evidence: "next_p0_owner_intake.md + data/next_p0_owner_intake_status.json",
    },
    {
      id: "next_p0_owner_intake_fixtures",
      ok:
        Boolean(nextP0OwnerIntakeFixtureStatus.ok) &&
        nextP0OwnerIntakeFixtureStatus.mode === "next_p0_owner_intake_fixture_dry_run" &&
        nextP0OwnerIntakeFixtureStatus.local_fixture_commands_executed === true &&
        nextP0OwnerIntakeFixtureStatus.live_project_inputs_created === false &&
        nextP0OwnerIntakeFixtureStatus.data_lp_events_write_performed === false &&
        nextP0OwnerIntakeFixtureStatus.external_effect === false,
      evidence: "next_p0_owner_intake_fixture_report.md + data/next_p0_owner_intake_fixture_status.json",
    },
    {
      id: "manual_conversion_preview",
      ok: Boolean(manualConversionStatus.ok) && manualConversionStatus.mode === "preview" && !manualConversionStatus.apply_performed,
      evidence: manualConversionStatus.output_path ?? "data/manual_conversions.preview.jsonl",
    },
    {
      id: "line_inbound_playbook",
      ok:
        Boolean(lineInboundStatus.ok) &&
        lineInboundStatus.execution_performed === false &&
        lineInboundStatus.external_effect === false &&
        lineInboundStatus.line_push_performed === false &&
        lineInboundStatus.customer_data_mutation_performed === false &&
        lineInboundStatus.data_lp_events_write_performed === false,
      evidence: "line_inbound_playbook.md + data/line_inbound_fixture_status.json",
    },
    {
      id: "manual_publish_evidence_form",
      ok:
        Boolean(manualPublishEvidenceFormStatus.ok) &&
        manualPublishEvidenceFormStatus.mode === "manual_publish_evidence_form" &&
        manualPublishEvidenceFormStatus.browser_only === true &&
        manualPublishEvidenceFormStatus.browser_persistence === false &&
        manualPublishEvidenceFormStatus.network_calls_performed === false &&
        manualPublishEvidenceFormStatus.post_url_fetch_performed === false &&
        manualPublishEvidenceFormStatus.live_input_files_created === false &&
        manualPublishEvidenceFormStatus.external_effect === false &&
        manualPublishEvidenceFormFixtureStatus.ok === true &&
        manualPublishEvidenceFormFixtureStatus.scenario_count === 4 &&
        manualPublishEvidenceFormFixtureStatus.data_lp_events_write_performed === false &&
        manualPublishEvidenceFormFixtureStatus.external_effect === false,
      evidence: "manual_publish_evidence_form.html + data/manual_publish_evidence_form_status.json + manual_publish_evidence_form_fixture_report.md",
    },
    {
      id: "launchagent_local_schedule",
      ok: Boolean(scheduleStatus.launchd_installed) && Boolean(scheduleStatus.service_loaded),
      evidence: "data/launchagent_status.json",
    },
    {
      id: "sample_threshold_gate",
      ok: !abStatus.sample_threshold_met && !abStatus.challenger_win_rule_met && abStatus.decision === "do_not_promote_challenger",
      evidence: "growth_scores.json",
    },
    {
      id: "win_rule_fixtures",
      ok: Boolean(winRuleFixtureStatus.ok) && !winRuleFixtureStatus.real_event_write_performed,
      evidence: "data/win_rule_fixture_status.json",
    },
    {
      id: "next_round_plan",
      ok: Boolean(nextRoundPlan.next_round.one_variable_rule_ok) && !nextRoundPlan.next_round.public_link_change_performed,
      evidence: "next_round_plan.json",
    },
    {
      id: "content_variant_tracking",
      ok:
        funnelBreakdown.mode === "content_variant_attribution" &&
        contentVariantLinkCount === expectedContentVariantLinks &&
        funnelBreakdown.external_effect === false &&
        funnelBreakdown.public_link_change_performed === false,
      evidence: "funnel_breakdown.json + tracking_links.json",
    },
  ];

  const ownerGates = [
    {
      id: "remote_d1_create_and_migrate",
      display_label: dedicatedD1Present && configuredD1Matches
        ? "Existing D1 schema verification and migration approval"
        : "Dedicated D1 creation and schema migration approval",
      operation_mode: dedicatedD1Present && configuredD1Matches
        ? "verify_existing_d1_then_migrate_schema"
        : "create_dedicated_d1_then_migrate_schema",
      resource_create_required: !(dedicatedD1Present && configuredD1Matches),
      risk_tier: "T2",
      status: "owner_approval_required",
      approval_id: "approve-d1-create-and-migrate",
      prepared_artifact: "schema/d1-week0.sql",
      supporting_artifacts: ["d1_schema_contract.md", "cloudflare_d1_readiness.md", "approved_d1_config.md"],
      approval_defaults: {
        d1_database_name: cloudflareD1ReadinessStatus.expected?.database_name ?? "3q-growth-loop-candidate",
        d1_database_id: configuredD1Matches
          ? cloudflareD1ReadinessStatus.expected?.configured_database_id
          : "REPLACE_WITH_REAL_D1_DATABASE_ID",
      },
      current_blocker: dedicatedD1Present && configuredD1Matches
        ? "The exact dedicated D1 exists and matches wrangler.jsonc, but its creation provenance is not recorded in owner approval metadata and no remote schema migration or table query has been approved."
        : "Read-only inventory confirms 3q-growth-loop-candidate does not exist and wrangler.jsonc still uses a placeholder database_id.",
      owner_action: dedicatedD1Present && configuredD1Matches
        ? "Confirm the observed D1 belongs to this Growth Loop, record only non-secret approval metadata, review the local schema contract, explicitly approve the remote migration, and opt in to recurring aggregate-only reads if desired. Do not create another database."
        : "Approve creation of the dedicated D1, record only its non-secret id in owner_approval_input.json, refresh live metadata, apply the guarded local config update, then separately approve the remote schema migration.",
      resume_commands: [
        "npm run d1:schema:contract",
        ...(!dedicatedD1Present ? ["wrangler d1 create 3q-growth-loop-candidate"] : []),
        "npm run cloudflare:d1:readiness:live",
        "npm run d1:config:preview",
        ...(!configuredD1Matches ? ["npm run d1:config:apply"] : []),
        "wrangler d1 execute 3q-growth-loop-candidate --remote --file=schema/d1-week0.sql",
        "wrangler d1 execute 3q-growth-loop-candidate --remote --command='PRAGMA integrity_check; PRAGMA foreign_key_check;' --json",
        "npm run collect:d1:remote:approved",
      ],
      rollback: "Do not delete or drop the dedicated D1 automatically. Stop before binding/deploy, preserve the database for review, and let the owner decide any cleanup separately.",
      external_effect: true,
    },
    {
      id: "candidate_worker_production_deploy",
      display_label: candidateWorkerObservedLive
        ? "Existing Candidate Worker provenance confirmation"
        : candidateWorkerSecurityUpdateRequired
          ? "Candidate Worker origin/PII security update approval"
        : "Candidate Worker production deployment approval",
      operation_mode: candidateWorkerObservedLive
        ? "verify_existing_candidate_deployment"
        : candidateWorkerSecurityUpdateRequired
          ? "deploy_candidate_worker_security_update"
        : "deploy_candidate_worker",
      resource_deploy_required: !candidateWorkerObservedLive,
      risk_tier: "T3",
      status: "owner_approval_required",
      approval_id: "approve-candidate-worker-deploy",
      prepared_artifact: candidateWorkerObservedLive ? "live_telemetry_readiness.md" : "worker.ts",
      supporting_artifacts: ["worker.ts", "worker_dry_run.md", "live_telemetry_readiness.md"],
      current_blocker: candidateWorkerObservedLive
        ? `Candidate deployment ${liveTelemetryReadinessStatus.candidate_worker.deployment_id} / version ${liveTelemetryReadinessStatus.candidate_worker.version_id} is observed healthy; owner provenance and rollback evidence are not yet recorded. Redeploy is not currently required.`
        : candidateWorkerSecurityUpdateRequired
          ? `Candidate deployment ${liveTelemetryReadinessStatus.candidate_worker.deployment_id} / version ${liveTelemetryReadinessStatus.candidate_worker.version_id} is healthy but lacks ${liveTelemetryReadinessStatus.candidate_worker.expected_security_contract ?? "the required security contract"}. The reviewed origin/PII hardening requires one owner-approved production redeploy.`
        : "No healthy Candidate deployment is observed; production deploy changes an external Cloudflare service.",
      owner_action: candidateWorkerObservedLive
        ? "Confirm the observed Worker name, URL, deployment/version reference, health result, and rollback reference. Do not redeploy unless the observed version is rejected."
        : candidateWorkerSecurityUpdateRequired
          ? "Review the local PII/Origin contract, confirm the exact Candidate target and current rollback version, approve one security redeploy, then verify the origin-pii-v2 health marker before ingest is trusted."
        : "Approve deploy target, route, environment variables, champion URL, and rollback plan.",
      resume_commands: candidateWorkerObservedLive
        ? [
            "npm run telemetry:readiness:live",
            "Review live_telemetry_readiness.md and record non-secret owner evidence.",
            "npm run owner:evidence && npm run post:verify && npm run telemetry:readiness",
          ]
        : candidateWorkerSecurityUpdateRequired
          ? [
              "npm run event:smoke && npm run worker:dry-run:status",
              "wrangler deployments list --name 3q-growth-loop-candidate --json",
              "wrangler deploy",
              "curl -fsS https://3q-growth-loop-candidate.milk790.workers.dev/health | jq -e '.ok == true and .security_contract == \"origin-pii-v2\"'",
              "npm run telemetry:readiness:live",
            ]
        : [
            "npm run worker:dry-run",
            "wrangler deploy",
            "curl https://<OWNER_APPROVED_WORKER_URL>/health",
          ],
      rollback: liveTelemetryReadinessStatus.candidate_worker?.version_id
        ? `wrangler rollback ${liveTelemetryReadinessStatus.candidate_worker.version_id} --name 3q-growth-loop-candidate -m \"Rollback origin/PII security update\"`
        : "Re-deploy the previous Worker version from Cloudflare dashboard or revert the branch and deploy again after owner approval.",
      external_effect: true,
    },
    {
      id: "public_ab_small_traffic_link",
      risk_tier: "T3",
      status: "owner_approval_required",
      approval_id: "approve-small-ab-link",
      prepared_artifact: "ab_test_status.json",
      current_blocker: sourceReadinessStatus.champion_url_ready
        ? "The live champion URL is verified, but public link routing still affects the live acquisition funnel."
        : "The champion URL is still a placeholder and public link routing affects the live acquisition funnel.",
      owner_action: "Approve the verified champion URL metadata, 90/10 split, test duration, public placement, and rollback URL.",
      resume_commands: [
        "Confirm CHAMPION_URL remains https://3q-site.milk790.workers.dev/.",
        candidateWorkerObservedLive
          ? "Confirm existing Candidate Worker provenance before public traffic; no redeploy is required unless the observed version is rejected."
          : "Deploy only after candidate_worker_production_deploy is approved.",
        "Manually place the approved /ab/ab-week0-cta-text-001 URL in the selected small-traffic surface.",
      ],
      rollback: "Restore the previous public link manually and keep the challenger as candidate-only.",
      external_effect: true,
    },
    {
      id: "github_repo_branch_pr",
      risk_tier: "T2",
      status: "owner_approval_required",
      approval_id: "approve-github-repo-and-pr",
      prepared_artifact: "champion_github_handoff.md",
      supporting_artifacts: ["champion_local_branch.md", "champion_github_pr_body.md", "champion_release_owner_packet.md", "github_handoff.md"],
      approval_defaults: {
        repo_url: "https://github.com/milk790-code/3q-hatchery-line-oa.git",
        branch_name: "codex/3q-growth-loop-champion-v1",
      },
      current_blocker: championGithubHandoffStatus.remote_branch?.present === true
        ? `The remote branch is ${championGithubHandoffStatus.remote_branch.state ?? "present"} at ${championGithubHandoffStatus.remote_branch.commit ?? "unknown"}; local head ${championGithubHandoffStatus.local_branch?.commit ?? "unknown"} is ahead by ${championGithubHandoffStatus.remote_branch.local_ahead_count ?? "unknown"}. Updating it or opening a draft PR is an external GitHub write.`
        : "The exact 3q-site release stack exists locally; branch push or draft PR creation is an external GitHub write.",
      owner_action: `Review local head ${championGithubHandoffStatus.local_branch?.commit ?? "unknown"} and champion_github_pr_body.md, then explicitly approve any remaining fast-forward push or draft PR in milk790-code/3q-hatchery-line-oa. Do not merge from this gate.`,
      resume_commands: [
        "git -C /Users/mac/Documents/Codex/control-center/worktrees/3q-site-growth-loop-champion-v1 status --short --branch",
        "git -C /Users/mac/Documents/Codex/control-center/worktrees/3q-site-growth-loop-champion-v1 show --stat --oneline HEAD",
        "git -C /Users/mac/Documents/Codex/control-center/worktrees/3q-site-growth-loop-champion-v1 push -u origin codex/3q-growth-loop-champion-v1",
        "gh pr create --repo milk790-code/3q-hatchery-line-oa --base main --head codex/3q-growth-loop-champion-v1 --draft --title \"3Q site: persist privacy-safe Growth Loop telemetry\" --body-file champion_github_pr_body.md",
      ],
      rollback: "Close the draft PR if needed and retain the branch for audit. No automatic merge, branch deletion, or repository mutation beyond the explicitly approved push/PR.",
      external_effect: true,
    },
    {
      id: "formal_posts_line_push_payment_customer_data",
      risk_tier: "T3",
      status: "manual_only",
      approval_id: null,
      prepared_artifact: "weekly_report.md",
      current_blocker: "Formal posting, LINE push, ECPay, payment/refund, and customer-data changes are outside the autonomous boundary.",
      owner_action: "Use drafts and reports as reference, then manually publish/send/pay/refund/update only after separate review.",
      resume_commands: [],
      rollback: "Platform-specific manual rollback only; no automatic action.",
      external_effect: true,
    },
  ];

  return {
    generated_at: now.toISOString(),
    status: pendingHumanApprovals.length > 0 ? "owner_approval_required" : "local_ready",
    mode: config.mode,
    owner_decision_required: pendingHumanApprovals.length > 0,
    local_preflight_ok: localPreflight.every((item) => item.ok),
    local_preflight: localPreflight,
    pending_human_approval_count: pendingHumanApprovals.length,
    pending_human_approvals: pendingHumanApprovals.map((item) => ({
      id: item.id,
      risk_tier: item.risk_tier,
      type: item.type,
      artifact: item.artifact,
      human_gate: item.human_gate,
    })),
    owner_gates: ownerGates,
    evidence: {
      current_real_events: events.length,
      cloudflare_d1_readiness_status: cloudflareD1ReadinessStatus.status,
      cloudflare_d1_dedicated_database_present: dedicatedD1Present,
      cloudflare_d1_configured_id_matches: configuredD1Matches,
      cloudflare_d1_remote_table_query_performed: Boolean(cloudflareD1ReadinessStatus.remote_table_query_performed),
      live_telemetry_readiness_status: liveTelemetryReadinessStatus.status,
      live_telemetry_candidate_deployment_observed: Boolean(liveTelemetryReadinessStatus.candidate_worker?.deployment_observed),
      live_telemetry_candidate_deploy_required: Boolean(liveTelemetryReadinessStatus.candidate_worker?.deploy_required),
      live_telemetry_observed_chain_ready_for_owner_evidence: Boolean(liveTelemetryReadinessStatus.decisions?.observed_live_chain_ready_for_owner_evidence),
      live_telemetry_ingest_readiness_proven: Boolean(liveTelemetryReadinessStatus.decisions?.live_ingest_readiness_proven),
      live_telemetry_weekly_aggregate_read_authorized: Boolean(liveTelemetryReadinessStatus.decisions?.weekly_aggregate_read_authorized),
      d1_schema_contract_status: d1SchemaContractStatus.status,
      d1_schema_contract_ok: Boolean(d1SchemaContractStatus.ok),
      d1_schema_contract_migration_idempotent: Boolean(d1SchemaContractStatus.checks?.migration_idempotent),
      approved_d1_config_status: approvedD1ConfigStatus.status,
      approved_d1_config_write_performed: Boolean(approvedD1ConfigStatus.local_config_write_performed),
      champion_github_handoff_status: championGithubHandoffStatus.status,
      champion_github_repository: championGithubHandoffStatus.repository?.slug ?? null,
      champion_github_branch: championGithubHandoffStatus.local_branch?.name ?? null,
      champion_github_push_or_pr_performed: Boolean(championGithubHandoffStatus.github_push_or_pr_performed),
      d1_sync_scope: d1SyncStatus.scope ?? "unknown",
      d1_sync_rows: d1SyncStatus.rows_exported ?? 0,
      event_input_quality_ok: Boolean(eventInputQualityStatus.ok),
      event_input_quality_rows: eventInputQualityStatus.rows_scanned ?? 0,
      event_input_quality_issues: (eventInputQualityStatus.issues ?? []).length,
      event_input_quality_sensitive: Boolean(eventInputQualityStatus.pii_or_sensitive_data_detected),
      funnel_preview_events: funnelAggregateStatus.events_written ?? 0,
      funnel_preview_mode: funnelAggregateStatus.mode ?? "unknown",
      funnel_preview_apply_performed: Boolean(funnelAggregateStatus.apply_performed),
      funnel_preview_data_write: Boolean(funnelAggregateStatus.data_lp_events_write_performed),
      funnel_fixture_ok: Boolean(funnelAggregateFixtureStatus.ok),
      funnel_fixture_scenarios: funnelAggregateFixtureStatus.scenario_count ?? 0,
      funnel_fixture_data_write: Boolean(funnelAggregateFixtureStatus.data_lp_events_write_performed),
      real_data_apply_guard_ok: Boolean(realDataApplyFixtureStatus.ok),
      real_data_apply_guard_scenarios: realDataApplyFixtureStatus.scenario_count ?? 0,
      real_data_apply_guard_data_write: Boolean(realDataApplyFixtureStatus.data_lp_events_write_performed),
      real_data_decision_replay_ok: Boolean(realDataDecisionReplayStatus.ok),
      real_data_decision_replay_scenarios: realDataDecisionReplayStatus.scenario_count ?? 0,
      real_data_decision_replay_local_fixture_commands: Boolean(realDataDecisionReplayStatus.local_fixture_commands_executed),
      real_data_decision_replay_local_importer_previews: Boolean(realDataDecisionReplayStatus.local_importer_preview_commands_executed),
      real_data_decision_replay_source_capture_ledger: Boolean(realDataDecisionReplayStatus.source_capture_ledger_replay_executed),
      real_data_decision_replay_source_compile_commands: Boolean(realDataDecisionReplayStatus.source_capture_compile_commands_executed),
      real_data_decision_replay_ledger_to_decision: Boolean(realDataDecisionReplayStatus.ledger_to_decision_replay_performed),
      real_data_decision_replay_data_write: Boolean(realDataDecisionReplayStatus.data_lp_events_write_performed),
      real_data_decision_replay_external_effect: Boolean(realDataDecisionReplayStatus.external_effect),
      real_data_decision_replay_report: realDataDecisionReplayStatus.report_path ?? REAL_DATA_DECISION_REPLAY_REPORT_PATH,
      source_readiness_ok: Boolean(sourceReadinessStatus.ok),
      source_readiness_status: sourceReadinessStatus.status ?? "unknown",
      source_readiness_missing_stage_count: sourceReadinessStatus.missing_stage_count ?? 0,
      source_readiness_public_ready: Boolean(sourceReadinessStatus.ready_for_public_iteration_decision),
      source_readiness_data_write: Boolean(sourceReadinessStatus.data_lp_events_write_performed),
      source_capture_ok: Boolean(sourceCaptureStatus.ok),
      source_capture_status: sourceCaptureStatus.status ?? "unknown",
      source_capture_ledger_rows: sourceCaptureStatus.ledger_rows ?? 0,
      source_capture_sample_gate_rows: sourceCaptureStatus.sample_gate_ledger_rows ?? 0,
      source_capture_importable_links: sourceCaptureStatus.importable_tracking_links ?? 0,
      source_capture_ab_router_gate_count: sourceCaptureStatus.ab_router_gate_count ?? 0,
      source_capture_live_input_files_created: Boolean(sourceCaptureStatus.live_input_files_created),
      source_capture_data_write: Boolean(sourceCaptureStatus.data_lp_events_write_performed),
      source_compile_ok: Boolean(sourceCaptureCompileStatus.ok),
      source_compile_status: sourceCaptureCompileStatus.status ?? "unknown",
      source_compile_input_kind: sourceCaptureCompileStatus.input_kind ?? "unknown",
      source_compile_filled_rows: sourceCaptureCompileStatus.filled_rows ?? 0,
      source_compile_funnel_rows: sourceCaptureCompileStatus.funnel_rows ?? 0,
      source_compile_manual_rows: sourceCaptureCompileStatus.manual_rows ?? 0,
      source_compile_issue_count: sourceCaptureCompileStatus.issue_count ?? 0,
      source_compile_live_input_files_created: Boolean(sourceCaptureCompileStatus.live_input_files_created),
      source_compile_data_write: Boolean(sourceCaptureCompileStatus.data_lp_events_write_performed),
      source_compile_fixture_ok: Boolean(sourceCaptureCompileFixtureStatus.ok),
      source_compile_fixture_scenarios: sourceCaptureCompileFixtureStatus.scenario_count ?? 0,
      source_compile_fixture_data_write: Boolean(sourceCaptureCompileFixtureStatus.data_lp_events_write_performed),
      real_data_intake_status: realDataIntakeStatus.status ?? "unknown",
      real_data_intake_ready_apply_count: realDataIntakeStatus.ready_apply_count ?? 0,
      real_data_intake_missing_input_count: realDataIntakeStatus.missing_input_count ?? 0,
      real_data_intake_blocked_input_count: realDataIntakeStatus.blocked_input_count ?? 0,
      real_data_intake_data_write: Boolean(realDataIntakeStatus.data_lp_events_write_performed),
      data_collection_brief_ok: Boolean(dataCollectionBriefStatus.ok),
      data_collection_brief_status: dataCollectionBriefStatus.status ?? "unknown",
      data_collection_brief_tasks: dataCollectionBriefStatus.task_count ?? 0,
      data_collection_brief_filled_ledger_exists: Boolean(dataCollectionBriefStatus.filled_ledger_exists),
      sample_gate_status: dataCollectionBriefStatus.sample_gate_status ?? "unknown",
      sample_gate_p0_tasks: dataCollectionBriefStatus.sample_gate_p0_task_count ?? 0,
      sample_gate_p0_links: dataCollectionBriefStatus.sample_gate_p0_link_count ?? 0,
      data_collection_brief_data_write: Boolean(dataCollectionBriefStatus.data_lp_events_write_performed),
      data_collection_brief_external_effect: Boolean(dataCollectionBriefStatus.external_effect),
      data_collection_progress_ok: Boolean(dataCollectionProgressStatus.ok),
      data_collection_progress_status: dataCollectionProgressStatus.status ?? "unknown",
      data_collection_progress_total_tasks: dataCollectionProgressStatus.total_task_count ?? 0,
      data_collection_progress_filled_tasks: dataCollectionProgressStatus.filled_task_count ?? 0,
      data_collection_progress_pending_tasks: dataCollectionProgressStatus.pending_task_count ?? 0,
      data_collection_progress_p0_pending: dataCollectionProgressStatus.p0_pending_count ?? 0,
      data_collection_progress_p1_pending: dataCollectionProgressStatus.p1_pending_count ?? 0,
      data_collection_progress_next_owner_inputs: dataCollectionProgressStatus.next_owner_input_count ?? 0,
      data_collection_progress_data_write: Boolean(dataCollectionProgressStatus.data_lp_events_write_performed),
      data_collection_progress_external_effect: Boolean(dataCollectionProgressStatus.external_effect),
      next_p0_owner_form_ok: Boolean(nextP0OwnerFormStatus.ok),
      next_p0_owner_form_status: nextP0OwnerFormStatus.status ?? "unknown",
      next_p0_owner_form_rows: nextP0OwnerFormStatus.row_count ?? 0,
      next_p0_owner_form_browser_only: Boolean(nextP0OwnerFormStatus.browser_only),
      next_p0_owner_form_network_calls: Boolean(nextP0OwnerFormStatus.network_calls_performed),
      next_p0_owner_form_data_write: Boolean(nextP0OwnerFormStatus.data_lp_events_write_performed),
      next_p0_owner_form_external_effect: Boolean(nextP0OwnerFormStatus.external_effect),
      next_p0_owner_form_fixture_ok: Boolean(nextP0OwnerFormFixtureStatus.ok),
      next_p0_owner_form_fixture_scenarios: nextP0OwnerFormFixtureStatus.scenario_count ?? 0,
      next_p0_owner_form_fixture_static_checks: Boolean(nextP0OwnerFormFixtureStatus.browser_form_static_checks_executed),
      next_p0_owner_form_fixture_data_write: Boolean(nextP0OwnerFormFixtureStatus.data_lp_events_write_performed),
      next_p0_owner_form_fixture_external_effect: Boolean(nextP0OwnerFormFixtureStatus.external_effect),
      next_p0_owner_intake_ok: Boolean(nextP0OwnerIntakeStatus.ok),
      next_p0_owner_intake_status: nextP0OwnerIntakeStatus.status ?? "unknown",
      next_p0_owner_intake_candidate_found: Boolean(nextP0OwnerIntakeStatus.candidate_found),
      next_p0_owner_intake_candidate_valid: Boolean(nextP0OwnerIntakeStatus.candidate_valid),
      next_p0_owner_intake_preview_rows: (nextP0OwnerIntakeStatus.funnel_preview_rows ?? 0) + (nextP0OwnerIntakeStatus.manual_preview_rows ?? 0),
      next_p0_owner_intake_stage_performed: Boolean(nextP0OwnerIntakeStatus.stage_performed),
      next_p0_owner_intake_live_input_files_created: Boolean(nextP0OwnerIntakeStatus.live_input_files_created),
      next_p0_owner_intake_data_write: Boolean(nextP0OwnerIntakeStatus.data_lp_events_write_performed),
      next_p0_owner_intake_external_effect: Boolean(nextP0OwnerIntakeStatus.external_effect),
      next_p0_owner_intake_fixture_ok: Boolean(nextP0OwnerIntakeFixtureStatus.ok),
      next_p0_owner_intake_fixture_scenarios: nextP0OwnerIntakeFixtureStatus.scenario_count ?? 0,
      next_p0_owner_intake_fixture_live_project_inputs_created: Boolean(nextP0OwnerIntakeFixtureStatus.live_project_inputs_created),
      next_p0_owner_intake_fixture_data_write: Boolean(nextP0OwnerIntakeFixtureStatus.data_lp_events_write_performed),
      next_p0_owner_intake_fixture_external_effect: Boolean(nextP0OwnerIntakeFixtureStatus.external_effect),
      manual_preview_events: manualConversionStatus.events_written ?? 0,
      line_inbound_playbook_ok: Boolean(lineInboundStatus.ok),
      line_inbound_fixture_scenarios: lineInboundStatus.scenario_count ?? 0,
      line_inbound_external_effect: Boolean(lineInboundStatus.external_effect),
      manual_publish_evidence_form_ok: Boolean(manualPublishEvidenceFormStatus.ok),
      manual_publish_evidence_form_status: manualPublishEvidenceFormStatus.status ?? "unknown",
      manual_publish_evidence_form_packets: manualPublishEvidenceFormStatus.packet_count ?? 0,
      manual_publish_evidence_form_browser_only: Boolean(manualPublishEvidenceFormStatus.browser_only),
      manual_publish_evidence_form_network_calls: Boolean(manualPublishEvidenceFormStatus.network_calls_performed),
      manual_publish_evidence_form_url_fetch: Boolean(manualPublishEvidenceFormStatus.post_url_fetch_performed),
      manual_publish_evidence_form_live_input_files_created: Boolean(manualPublishEvidenceFormStatus.live_input_files_created),
      manual_publish_evidence_form_fixture_ok: Boolean(manualPublishEvidenceFormFixtureStatus.ok),
      manual_publish_evidence_form_fixture_scenarios: manualPublishEvidenceFormFixtureStatus.scenario_count ?? 0,
      manual_publish_evidence_form_fixture_data_write: Boolean(manualPublishEvidenceFormFixtureStatus.data_lp_events_write_performed),
      manual_publish_evidence_form_fixture_external_effect: Boolean(manualPublishEvidenceFormFixtureStatus.external_effect),
      worker_dry_run_ok: Boolean(workerDryRunStatus.ok),
      worker_dry_run_exit_observed: Boolean(workerDryRunStatus.dry_run_exit_observed),
      worker_dry_run_required_markers_present: Boolean(workerDryRunStatus.required_markers_present),
      worker_dry_run_exit_code: workerDryRunStatus.exit_code ?? null,
      worker_dry_run_total_upload_line: workerDryRunStatus.total_upload_line ?? null,
      worker_dry_run_report: workerDryRunStatus.report_path ?? WORKER_DRY_RUN_REPORT_PATH,
      worker_dry_run_log: workerDryRunStatus.log_path ?? null,
      worker_dry_run_production_deploy_performed: Boolean(workerDryRunStatus.production_deploy_performed),
      worker_dry_run_external_effect: Boolean(workerDryRunStatus.external_effect),
      browser_smoke_ok: Boolean(browserSmokeStatus.ok),
      browser_smoke_checks: pipelineStatus.browser_smoke_status.checks_total,
      tracking_link_smoke_ok: Boolean(trackingLinkSmokeStatus.ok),
      tracking_link_smoke_links_checked: trackingLinkSmokeStatus.links_checked ?? 0,
      tracking_link_smoke_expected_links: trackingLinkSmokeStatus.expected_link_count ?? 0,
      tracking_link_smoke_real_write: Boolean(trackingLinkSmokeStatus.real_event_write_performed),
      tracking_link_smoke_data_write: Boolean(trackingLinkSmokeStatus.data_lp_events_write_performed),
      event_contract_smoke_ok: Boolean(eventContractSmokeStatus.ok),
      event_contract_counts: eventContractSmokeStatus.event_type_counts ?? {},
      event_contract_real_write: Boolean(eventContractSmokeStatus.real_event_write_performed),
      win_rule_fixture_ok: Boolean(winRuleFixtureStatus.ok),
      win_rule_fixture_scenarios: winRuleFixtureStatus.scenario_count ?? 0,
      week_archive_ok: Boolean(weekArchiveStatus.ok),
      week_archive_files: weekArchiveStatus.files_archived ?? 0,
      week_archive_dir: weekArchiveStatus.archive_dir ?? null,
      next_round_plan_status: nextRoundPlan.status,
      next_round_decision: nextRoundPlan.decision,
      next_round_changed_variable: nextRoundPlan.next_round.changed_variable,
      next_round_start_new_variable: Boolean(nextRoundPlan.next_round.start_new_variable_round),
      funnel_breakdown_rows: funnelBreakdown.summary.rows,
      funnel_breakdown_content_variant_links: contentVariantLinkCount,
      funnel_breakdown_real_events: funnelBreakdown.summary.real_events,
      weekly_runner_status: scheduleStatus.runner_status.status,
      launchagent_installed: Boolean(scheduleStatus.launchd_installed),
      champion_retained: scores.assets.some((asset) => asset.role === "champion" && asset.decision === "keep_champion_until_challenger_beats_rule"),
      sample_threshold_met: Boolean(abStatus.sample_threshold_met),
    },
    safety_invariants: {
      formal_post_performed: false,
      public_link_change_performed: false,
      challenger_promotion_performed: false,
      line_push_performed: false,
      ecpay_payment_or_refund_performed: false,
      customer_data_mutation_performed: false,
      production_deploy_performed: false,
      data_delete_performed: false,
    },
    prepared_artifacts: [
      "weekly_report.md",
      "growth_scores.json",
      "approval_queue.json",
      "ab_test_status.json",
      "landing_page_candidate.html",
      "worker.ts",
      "worker_dry_run.md",
      "data/worker_dry_run_status.json",
      "prepared_but_blocked.json",
      "github_handoff.md",
      "champion_github_handoff.md",
      "champion_github_pr_body.md",
      "data/champion_github_handoff_status.json",
      "d1_schema_contract.md",
      "data/d1_schema_contract_status.json",
      "approved_d1_config.md",
      "data/approved_d1_config_status.json",
      "live_telemetry_readiness.md",
      "data/live_telemetry_readiness_status.json",
      "live_telemetry_readiness_fixture_report.md",
      "data/live_telemetry_readiness_fixture_status.json",
      "owner_approval_pack.md",
      "owner_console.html",
      "approval_resume_plan.md",
      "data/approval_resume_status.json",
      "post_gate_verification.md",
      "data/post_gate_verification_status.json",
      "owner_approval_input.example.json",
      "win_rule_fixture_report.md",
      "data/win_rule_fixture_status.json",
      "line_inbound_playbook.md",
      "line_inbound_playbook.json",
      "line_inbound_fixture_report.md",
      "data/line_inbound_fixture_status.json",
      "manual_publish_evidence_form.html",
      "data/manual_publish_evidence_form_status.json",
      "manual_publish_evidence_form_fixture_report.md",
      "data/manual_publish_evidence_form_fixture_status.json",
      "worker_dry_run.md",
      "data/worker_dry_run_status.json",
      "funnel_breakdown.json",
      "funnel_breakdown.md",
      "data/funnel_aggregate_status.json",
      "data/funnel_aggregates.example.csv",
      "data/funnel_aggregates.preview.jsonl",
      "data/funnel_aggregate_fixture_status.json",
      "funnel_aggregate_fixture_report.md",
      "data/real_data_apply_fixture_status.json",
      "real_data_apply_fixture_report.md",
      "data/real_data_decision_replay_status.json",
      "real_data_decision_replay_report.md",
      "source_capture_pack.md",
      "data/source_capture_status.json",
      "data/source_capture/source_capture_checklist.json",
      "data/source_capture/source_capture_ledger.fill-template.csv",
      "data/source_capture/sample_gate_ledger.fill-template.csv",
      "data/sample_gate_ledger_status.json",
      "sample_gate_ledger.md",
      "sample_gate_ledger_compile_probe.md",
      "data/sample_gate_ledger_compile_probe_status.json",
      "data/source_capture/sample_gate_compile_probe/funnel_aggregates.owner-preview.csv",
      "data/source_capture/sample_gate_compile_probe/manual_conversions.owner-preview.csv",
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
      "sample_gate_collection_plan.json",
      "sample_gate_collection_plan.md",
      "data/sample_gate_collection_plan_status.json",
      "tracking_link_smoke.md",
      "data/tracking_link_smoke_status.json",
      "data/event_contract_smoke_status.json",
      "data/event_input_quality_status.json",
      "data/week_archive_status.json",
      "goal_completion_audit.md",
      "data/goal_completion_audit_status.json",
      "next_round_plan.json",
      "next_round_plan.md",
    ],
    blocked_actions: blocked.items.map((item) => item.action),
  };
}

function buildGoalCompletionAuditStatus({
  config,
  scores,
  abStatus,
  approvalQueue,
  blocked,
  pipelineStatus,
  nextRoundPlan,
  d1SyncStatus,
  eventInputQualityStatus,
  funnelAggregateStatus,
  funnelAggregateFixtureStatus,
  realDataApplyFixtureStatus,
  realDataDecisionReplayStatus,
  sourceReadinessStatus,
  sourceCaptureStatus,
  sourceCaptureCompileStatus,
  sourceCaptureCompileFixtureStatus,
  realDataIntakeStatus,
  dataCollectionBriefStatus,
  dataCollectionProgressStatus,
  sourceTrustMatrixStatus,
  nextP0OwnerFormStatus,
  nextP0OwnerFormFixtureStatus,
  nextP0OwnerIntakeStatus,
  nextP0OwnerIntakeFixtureStatus,
  manualConversionStatus,
  lineInboundStatus,
  manualPublishEvidenceFormStatus,
  manualPublishEvidenceFormFixtureStatus,
  scheduleStatus,
  workerDryRunStatus,
  browserSmokeStatus,
  trackingLinkSmokeStatus,
  eventContractSmokeStatus,
  winRuleFixtureStatus,
  weekArchiveStatus,
  launchReadiness,
  events,
  week,
  now,
}) {
  const approvalQueueStatusCounts = (approvalQueue.items ?? []).reduce((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});
  const requiredExternalGates = (launchReadiness.owner_gates ?? []).map((gate) => ({
    id: gate.id,
    risk_tier: gate.risk_tier,
    status: gate.status,
    prepared_artifact: gate.prepared_artifact ?? null,
    current_blocker: gate.current_blocker,
  }));
  const redLineFlags = {
    external_effect: false,
    data_lp_events_write_performed: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    ecpay_payment_or_refund_performed: false,
    delete_action_performed: false,
    data_delete_performed: false,
    promotion_performed: false,
    challenger_promotion_performed: false,
  };
  const dataEvidenceGates = blocked.data_evidence_gates ?? [];
  const dataEvidenceReady = dataEvidenceGates.length === 3 && dataEvidenceGates.every((gate) => gate.status === "met");
  const unmetDataEvidenceGateCount = dataEvidenceGates.filter((gate) => gate.status !== "met").length;

  return {
    ok: true,
    generated_at: now.toISOString(),
    mode: "goal_completion_audit_status",
    status: dataEvidenceReady ? "not_complete_external_gates" : "not_complete_data_and_external_gates",
    complete: false,
    completion_proven: false,
    reason: dataEvidenceReady
      ? "Required data evidence is ready; external deployment and public traffic effects remain blocked."
      : "Required P0/P1/trusted-scoring evidence is incomplete, and external deployment and public traffic effects remain blocked.",
    objective: "Make post -> landing page -> LINE support -> lead/deal acquisition loop iterate every seven days.",
    week,
    config_mode: config.mode,
    current_round_id: config.current_round?.round_id ?? null,
    current_changed_variable: config.current_round?.changed_variable ?? null,
    current_real_event_rows: events.length,
    sample_threshold_met: Boolean(abStatus.sample_threshold_met),
    challenger_win_rule_met: Boolean(abStatus.challenger_win_rule_met),
    no_quality_regression: abStatus.no_quality_regression ?? null,
    champion_retained: scores.assets.some((asset) => asset.role === "champion" && asset.decision === "keep_champion_until_challenger_beats_rule"),
    next_round_decision: nextRoundPlan.decision,
    next_round_status: nextRoundPlan.status,
    next_changed_variable: nextRoundPlan.next_round?.changed_variable ?? null,
    owner_decision_required: Boolean(launchReadiness.owner_decision_required),
    pending_human_approval_count: launchReadiness.pending_human_approval_count ?? 0,
    approval_queue_status_counts: approvalQueueStatusCounts,
    blocked_action_count: blocked.items?.length ?? 0,
    redline_blocked_actions: (blocked.items ?? []).map((item) => item.action),
    data_evidence_ready: dataEvidenceReady,
    data_evidence_gate_count: dataEvidenceGates.length,
    unmet_data_evidence_gate_count: unmetDataEvidenceGateCount,
    data_evidence_gates: dataEvidenceGates,
    required_external_gates: requiredExternalGates,
    sample_gate_status: dataCollectionBriefStatus.sample_gate_status ?? "unknown",
    sample_gate_p0_task_count: dataCollectionBriefStatus.sample_gate_p0_task_count ?? 0,
    sample_gate_p0_link_count: dataCollectionBriefStatus.sample_gate_p0_link_count ?? 0,
    data_collection_progress_status: dataCollectionProgressStatus.status ?? "unknown",
    data_collection_progress_total_tasks: dataCollectionProgressStatus.total_task_count ?? 0,
    data_collection_progress_filled_tasks: dataCollectionProgressStatus.filled_task_count ?? 0,
    data_collection_progress_pending_tasks: dataCollectionProgressStatus.pending_task_count ?? 0,
    data_collection_progress_p0_pending: dataCollectionProgressStatus.p0_pending_count ?? 0,
    data_collection_progress_p1_pending: dataCollectionProgressStatus.p1_pending_count ?? 0,
    source_trust_status: sourceTrustMatrixStatus.status ?? "unknown",
    source_trust_trusted_scoring_source_count: sourceTrustMatrixStatus.trusted_scoring_source_count ?? 0,
    source_trust_sample_gate_source_count: sourceTrustMatrixStatus.sample_gate_source_count ?? 0,
    source_trust_scoring_allowed_now: Boolean(sourceTrustMatrixStatus.scoring_allowed_now),
    source_trust_real_event_rows: sourceTrustMatrixStatus.real_event_rows ?? 0,
    source_trust_p0_pending_count: sourceTrustMatrixStatus.p0_pending_count ?? 0,
    source_trust_sample_threshold_met: Boolean(sourceTrustMatrixStatus.sample_threshold_met),
    source_trust_ready_for_public_iteration_decision: Boolean(sourceTrustMatrixStatus.ready_for_public_iteration_decision),
    source_trust_data_lp_events_write_performed: Boolean(sourceTrustMatrixStatus.data_lp_events_write_performed),
    next_p0_owner_form_status: nextP0OwnerFormStatus.status ?? "unknown",
    next_p0_owner_form_rows: nextP0OwnerFormStatus.row_count ?? 0,
    next_p0_owner_form_fixture_scenarios: nextP0OwnerFormFixtureStatus.scenario_count ?? 0,
    next_p0_owner_intake_status: nextP0OwnerIntakeStatus.status ?? "unknown",
    next_p0_owner_intake_candidate_found: Boolean(nextP0OwnerIntakeStatus.candidate_found),
    next_p0_owner_intake_preview_rows: (nextP0OwnerIntakeStatus.funnel_preview_rows ?? 0) + (nextP0OwnerIntakeStatus.manual_preview_rows ?? 0),
    next_p0_owner_intake_fixture_scenarios: nextP0OwnerIntakeFixtureStatus.scenario_count ?? 0,
    source_missing_stage_count: sourceReadinessStatus.missing_stage_count ?? 0,
    ready_for_public_iteration_decision: Boolean(sourceReadinessStatus.ready_for_public_iteration_decision),
    required_outputs_present: true,
    required_outputs: [
      "weekly_report.md",
      "growth_scores.json",
      "approval_queue.json",
      "ab_test_status.json",
      "landing_page_candidate.html",
      "worker.ts",
      "prepared_but_blocked.json",
      "champion_integration_candidate.md",
      "data/champion_integration_candidate_status.json",
      "champion_integration_smoke.md",
      "data/champion_integration_smoke_status.json",
      "cloudflare_d1_readiness.md",
      "data/cloudflare_d1_readiness_status.json",
      "data/cloudflare_d1_inventory_snapshot.json",
      "d1_schema_contract.md",
      "data/d1_schema_contract_status.json",
      "approved_d1_config.md",
      "data/approved_d1_config_status.json",
      "champion_local_branch.md",
      "data/champion_local_branch_status.json",
      "champion_release_preflight.md",
      "data/champion_release_preflight_status.json",
      "data/champion_live_deployment_snapshot.json",
      "champion_release_owner_packet.md",
      "champion_release_owner_packet.json",
      "champion_github_handoff.md",
      "champion_github_pr_body.md",
      "data/champion_github_handoff_status.json",
      "data_collection_progress.md",
      "data_collection_progress.json",
      "data/data_collection_progress_status.json",
      "source_trust_matrix.md",
      "source_trust_matrix.json",
      "data/source_trust_matrix_status.json",
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
      "goal_completion_audit.md",
      "data/goal_completion_audit_status.json",
    ],
    local_checks: {
      launch_readiness_local_preflight_ok: Boolean(launchReadiness.local_preflight_ok),
      weekly_runner_success: scheduleStatus.runner_status.status === "success",
      d1_sync_ok: Boolean(d1SyncStatus.ok),
      event_input_quality_ok: Boolean(eventInputQualityStatus.ok) && eventInputQualityStatus.scoring_allowed === true,
      funnel_aggregate_preview_ok: Boolean(funnelAggregateStatus.ok) && funnelAggregateStatus.apply_performed === false,
      funnel_aggregate_fixture_ok: Boolean(funnelAggregateFixtureStatus.ok),
      real_data_apply_fixture_ok: Boolean(realDataApplyFixtureStatus.ok),
      real_data_decision_replay_ok: Boolean(realDataDecisionReplayStatus.ok),
      source_readiness_ok: Boolean(sourceReadinessStatus.ok),
      source_capture_ok: Boolean(sourceCaptureStatus.ok),
      source_capture_compile_ok: Boolean(sourceCaptureCompileStatus.ok),
      source_capture_compile_fixture_ok: Boolean(sourceCaptureCompileFixtureStatus.ok),
      real_data_intake_ok: Boolean(realDataIntakeStatus.ok),
      data_collection_brief_ok: Boolean(dataCollectionBriefStatus.ok),
      data_collection_progress_ok: Boolean(dataCollectionProgressStatus.ok) && dataCollectionProgressStatus.data_lp_events_write_performed === false && dataCollectionProgressStatus.external_effect === false,
      source_trust_ok: Boolean(sourceTrustMatrixStatus.ok) && sourceTrustMatrixStatus.data_lp_events_write_performed === false && sourceTrustMatrixStatus.external_effect === false,
      next_p0_owner_form_ok: Boolean(nextP0OwnerFormStatus.ok) && nextP0OwnerFormStatus.browser_only === true && nextP0OwnerFormStatus.network_calls_performed === false && nextP0OwnerFormStatus.data_lp_events_write_performed === false && nextP0OwnerFormStatus.external_effect === false,
      next_p0_owner_form_fixture_ok: Boolean(nextP0OwnerFormFixtureStatus.ok) && nextP0OwnerFormFixtureStatus.data_lp_events_write_performed === false && nextP0OwnerFormFixtureStatus.external_effect === false,
      next_p0_owner_intake_ok: Boolean(nextP0OwnerIntakeStatus.ok) && nextP0OwnerIntakeStatus.data_lp_events_write_performed === false && nextP0OwnerIntakeStatus.external_effect === false,
      next_p0_owner_intake_fixture_ok: Boolean(nextP0OwnerIntakeFixtureStatus.ok) && nextP0OwnerIntakeFixtureStatus.live_project_inputs_created === false && nextP0OwnerIntakeFixtureStatus.data_lp_events_write_performed === false && nextP0OwnerIntakeFixtureStatus.external_effect === false,
      manual_conversion_preview_ok: Boolean(manualConversionStatus.ok) && manualConversionStatus.apply_performed === false,
      line_inbound_fixture_ok: Boolean(lineInboundStatus.ok),
      manual_publish_evidence_form_ok: Boolean(manualPublishEvidenceFormStatus.ok),
      manual_publish_evidence_form_fixture_ok: Boolean(manualPublishEvidenceFormFixtureStatus.ok),
      worker_dry_run_ok: Boolean(workerDryRunStatus.ok) && workerDryRunStatus.dry_run_exit_observed === true && workerDryRunStatus.production_deploy_performed === false && workerDryRunStatus.external_effect === false,
      browser_smoke_ok: Boolean(browserSmokeStatus.ok),
      tracking_link_smoke_ok: Boolean(trackingLinkSmokeStatus.ok),
      event_contract_smoke_ok: Boolean(eventContractSmokeStatus.ok),
      win_rule_fixture_ok: Boolean(winRuleFixtureStatus.ok),
      week_archive_ok: Boolean(weekArchiveStatus.ok),
      pipeline_external_effect: Boolean(pipelineStatus.external_effect),
    },
    safety_invariants: {
      ...redLineFlags,
      pipeline_external_effect: Boolean(pipelineStatus.external_effect),
      launch_readiness_formal_post_performed: Boolean(launchReadiness.safety_invariants?.formal_post_performed),
      launch_readiness_public_link_change_performed: Boolean(launchReadiness.safety_invariants?.public_link_change_performed),
      launch_readiness_customer_data_mutation_performed: Boolean(launchReadiness.safety_invariants?.customer_data_mutation_performed),
      launch_readiness_production_deploy_performed: Boolean(launchReadiness.safety_invariants?.production_deploy_performed),
    },
    ...redLineFlags,
  };
}

function renderWeeklyReport(config, scores, abStatus, approvalQueue, blocked, trackingLinks, contentVariants, funnelBreakdown, pipelineStatus, retirementQueue, nextRoundPlan, d1SyncStatus, eventInputQualityStatus, funnelAggregateStatus, funnelAggregateFixtureStatus, realDataApplyFixtureStatus, realDataDecisionReplayStatus, sourceReadinessStatus, sourceCaptureStatus, sourceCaptureCompileStatus, sourceCaptureCompileFixtureStatus, realDataIntakeStatus, dataCollectionBriefStatus, dataCollectionProgressStatus, sourceTrustMatrixStatus, nextP0OwnerFormStatus, nextP0OwnerFormFixtureStatus, nextP0OwnerIntakeStatus, nextP0OwnerIntakeFixtureStatus, manualConversionStatus, lineInboundStatus, manualPublishEvidenceFormStatus, manualPublishEvidenceFormFixtureStatus, scheduleStatus, workerDryRunStatus, browserSmokeStatus, trackingLinkSmokeStatus, eventContractSmokeStatus, winRuleFixtureStatus, weekArchiveStatus, launchReadiness, events, week, now) {
  const rows = scores.assets
    .map(
      (asset) =>
        `| ${asset.asset_id} | ${asset.role} | ${asset.link_clicks} | ${asset.visits} | ${asset.cta_clicks} | ${asset.line_adds} | ${asset.leads} | ${asset.deals} | ${percent(asset.line_add_rate)} | ${asset.test_days} | ${asset.sample_threshold_met ? "yes" : "no"} | ${asset.decision} |`,
    )
    .join("\n");

  const queueRows = approvalQueue.items
    .map((item) => `| ${item.id} | ${item.risk_tier} | ${item.status} | ${item.human_gate} |`)
    .join("\n");

  const blockedRows = blocked.items
    .map((item) => `| ${item.id} | ${item.action} | ${item.blocked_by} | ${item.prepared_artifact ?? "n/a"} |`)
    .join("\n");

  const trackingRows = trackingLinks.links
    .map((link) => `| ${link.link_id} | ${link.role} | ${link.target} | ${link.status} | ${link.tracking_url} |`)
    .join("\n");

  const variantRows = contentVariants.drafts
    .map((draft) => `| ${draft.content_id} | ${draft.variant_id} | ${draft.changed_variable} | ${draft.cta_text} | ${draft.tracking_url} | ${draft.final_gate} |`)
    .join("\n");

  const attributionRows = funnelBreakdown.rows
    .filter((row) => row.role === "content_variant")
    .map((row) => `| ${row.content_id} | ${row.variant_id} | ${row.link_clicks} | ${row.line_adds} | ${row.leads} | ${row.deals} | ${row.line_adds_per_100_clicks ?? "n/a"} | ${row.leads_per_100_clicks ?? "n/a"} | ${row.deals_per_100_clicks ?? "n/a"} | ${row.sample_threshold_met ? "yes" : "no"} |`)
    .join("\n");

  const sourceRows = (sourceReadinessStatus.stages ?? [])
    .map((stage) => `| ${stage.id} | ${stage.status} | ${stage.current_real_events ?? 0} | ${stage.live_input_exists ? "yes" : "no"} | ${stage.ready_for_decision ? "yes" : "no"} |`)
    .join("\n");

  const pipelineRows = pipelineStatus.steps
    .map((item) => `| ${item.step} | ${item.status} | ${item.evidence ?? "n/a"} | ${item.external_effect ? "yes" : "no"} |`)
    .join("\n");

  const retirementRows = retirementQueue.items
    .map((item) => `| ${item.asset_id} | ${item.status} | ${item.recommended_action} | ${item.retirement_ready ? "yes" : "no"} | ${item.external_effect ? "yes" : "no"} |`)
    .join("\n");

  return `# 3Q Growth Loop Weekly Report

BLUF: Week 0 local engine is prepared, but no real funnel events are present yet. Champion stays unchanged because sample_threshold_met=false.

Generated: ${now.toISOString()}
Timezone: ${config.timezone}
Week: ${week.start} to ${week.end}
Mode: ${config.mode}

## North Star

Per 100 link clicks: link_click -> line_add -> lead_submit -> deal.

## Current Decision

- Decision: ${abStatus.decision}
- Changed variable this round: ${config.current_round.changed_variable}
- One-variable rule: ${abStatus.one_variable_rule_ok ? "pass" : "fail"}
- Sample threshold: ${abStatus.sample_threshold_met ? "met" : "not met"}
- Quality regression: ${abStatus.no_quality_regression ? "none observed" : "regression observed"}
- External effects performed: none

## Next Round Plan

- Artifact: next_round_plan.md / next_round_plan.json
- Decision: ${nextRoundPlan.decision}
- Status: ${nextRoundPlan.status}
- Current changed variable: ${nextRoundPlan.current_round.changed_variable}
- Next changed variable: ${nextRoundPlan.next_round.changed_variable}
- Start new variable round: ${nextRoundPlan.next_round.start_new_variable_round ? "yes" : "no"}
- One-variable rule: ${nextRoundPlan.next_round.one_variable_rule_ok ? "pass" : "fail"}
- Sample gaps: visits=${nextRoundPlan.sample_gate.gaps.visits}, cta_clicks=${nextRoundPlan.sample_gate.gaps.cta_clicks}, line_adds=${nextRoundPlan.sample_gate.gaps.line_adds}, test_days=${nextRoundPlan.sample_gate.gaps.test_days}
- Public link change performed: no

## Funnel Scores

| asset_id | role | link_clicks | visits | cta_clicks | line_adds | leads | deals | line_add_rate | test_days | sample_met | decision |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
${rows}

## Winners / Losers

- Winner: no winner declared. Sample is insufficient.
- Loser: no loser declared. Insufficient data means the challenger is not retired yet.
- Champion rule: sample不足不換冠軍.

## Candidate Retirement Queue

| asset_id | status | recommended_action | retirement_ready | external_effect |
|---|---|---|---|---|
${retirementRows}

## Content Mix Draft

Conservative: keep current champion link and use the candidate only as a reviewed local page.

Aggressive: after owner approval, route 10% small traffic to the challenger for at least ${config.sample_thresholds.preferred_test_days} days.

Counter-intuitive: do not create more variants yet. Use one sharper CTA and collect real event quality before producing more pages.

## Tracking Links

| link_id | role | target | status | tracking_url |
|---|---|---|---|---|
${trackingRows}

## A/B Router

- Routing endpoint: ${abStatus.routing_endpoint}
- Status endpoint: ${abStatus.status_endpoint}
- Allocation: champion ${abStatus.traffic_allocation.champion}% / challenger ${abStatus.traffic_allocation.challenger}%
- Gate: do not use in public traffic until owner confirms champion URL, traffic share, duration, and rollback.

## Content Variants

| content_id | variant_id | changed_variable | cta_text | tracking_url | gate |
|---|---|---|---|---|---|
${variantRows}

## Funnel Attribution Breakdown

- Artifact: funnel_breakdown.md / funnel_breakdown.json
- Mode: ${funnelBreakdown.mode}
- Content variant links: ${funnelBreakdown.summary.content_variant_links}
- Real events in current scoring file: ${funnelBreakdown.summary.real_events}
- External effect: none

| content_id | variant_id | clicks | LINE adds | leads | deals | LINE adds / 100 clicks | leads / 100 clicks | deals / 100 clicks | sample_met |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
${attributionRows}

## Pipeline Status

| step | status | evidence | external_effect |
|---|---|---|---|
${pipelineRows}

## Weekly Automation

- Local runner: ${scheduleStatus.local_runner_command}
- Local schedule: ${scheduleStatus.local_schedule.weekday} ${String(scheduleStatus.local_schedule.hour).padStart(2, "0")}:${String(scheduleStatus.local_schedule.minute).padStart(2, "0")} ${scheduleStatus.local_schedule.timezone}
- LaunchAgent template: ${scheduleStatus.launchd_template}
- LaunchAgent installed: ${scheduleStatus.launchd_installed ? "yes" : "no"}
- Install performed: ${scheduleStatus.install_performed ? "yes" : "no"}
- LaunchAgent file installed: ${scheduleStatus.file_installed ? "yes" : "no"}
- LaunchAgent service loaded: ${scheduleStatus.service_loaded ? "yes" : "no"}
- LaunchAgent status: ${scheduleStatus.launchagent_status_file}
- Rollback command: ${scheduleStatus.launchagent_status.rollback_command}
- Worker cron candidate: ${scheduleStatus.worker_cron.expression} UTC = ${scheduleStatus.worker_cron.taipei_time} Taipei
- Last local runner status: ${scheduleStatus.runner_status.status}
- Last local runner log: ${scheduleStatus.runner_status.log_path ?? "n/a"}
- External effects from scheduler: none

## Candidate Worker Dry Run

- Status: ${workerDryRunStatus.ok ? "ok" : "not_ready"}
- Mode: ${workerDryRunStatus.mode ?? "unknown"}
- Command: ${workerDryRunStatus.command ?? "wrangler deploy --dry-run"}
- Exit code: ${workerDryRunStatus.exit_code ?? "n/a"}
- Dry-run exit observed: ${workerDryRunStatus.dry_run_exit_observed ? "yes" : "no"}
- Required bindings present: ${workerDryRunStatus.required_markers_present ? "yes" : "no"}
- Production deploy performed: ${workerDryRunStatus.production_deploy_performed ? "yes" : "no"}
- External effect: none
- Report: ${workerDryRunStatus.report_path ?? "worker_dry_run.md"}
- Log: ${workerDryRunStatus.log_path ?? "n/a"}

## Browser Smoke

- Status: ${browserSmokeStatus.ok ? "ok" : "not_ready"}
- Mode: ${browserSmokeStatus.mode ?? "unknown"}
- Base URL: ${browserSmokeStatus.base_url ?? "n/a"}
- Checks: ${pipelineStatus.browser_smoke_status.checks_passed}/${pipelineStatus.browser_smoke_status.checks_total}
- Event write performed: ${browserSmokeStatus.event_write_performed ? "yes" : "no"}
- External effect: none
- Log: ${browserSmokeStatus.log_path ?? "n/a"}

## Tracking Link Smoke

- Status: ${trackingLinkSmokeStatus.ok ? "ok" : "not_ready"}
- Mode: ${trackingLinkSmokeStatus.mode ?? "unknown"}
- Links checked: ${trackingLinkSmokeStatus.links_checked ?? 0}/${trackingLinkSmokeStatus.expected_link_count ?? trackingLinks.links.length}
- Checks: ${pipelineStatus.tracking_link_smoke_status.checks_passed}/${pipelineStatus.tracking_link_smoke_status.checks_total}
- Isolated link_click events written: ${trackingLinkSmokeStatus.isolated_link_click_events_written ?? 0}
- Real event write performed: ${trackingLinkSmokeStatus.real_event_write_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${trackingLinkSmokeStatus.data_lp_events_write_performed ? "yes" : "no"}
- External effect: none
- Report: tracking_link_smoke.md
- Log: ${trackingLinkSmokeStatus.log_path ?? "n/a"}

## Event Contract Smoke

- Status: ${eventContractSmokeStatus.ok ? "ok" : "not_ready"}
- Mode: ${eventContractSmokeStatus.mode ?? "unknown"}
- Synthetic event counts: ${JSON.stringify(eventContractSmokeStatus.event_type_counts ?? {})}
- Sensitive metadata rejected: ${eventContractSmokeStatus.sensitive_rejection?.ok ? "yes" : "no"}
- Invalid event rejected: ${eventContractSmokeStatus.invalid_event_rejection?.ok ? "yes" : "no"}
- Isolated fixture event write performed: ${eventContractSmokeStatus.isolated_fixture_event_write_performed ? "yes" : "no"}
- Real event write performed: ${eventContractSmokeStatus.real_event_write_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${eventContractSmokeStatus.data_lp_events_write_performed ? "yes" : "no"}
- External effect: none
- Log: ${eventContractSmokeStatus.log_path ?? "n/a"}

## Event Input Quality Gate

- Status: ${eventInputQualityStatus.ok ? "ok" : "blocked"}
- Mode: ${eventInputQualityStatus.mode ?? "unknown"}
- Input: data/lp_events.jsonl
- Rows scanned: ${eventInputQualityStatus.rows_scanned ?? 0}
- Issues: ${(eventInputQualityStatus.issues ?? []).length}
- Scoring allowed: ${eventInputQualityStatus.scoring_allowed ? "yes" : "no"}
- Sensitive data detected: ${eventInputQualityStatus.pii_or_sensitive_data_detected ? "yes" : "no"}
- Duplicate event IDs: ${(eventInputQualityStatus.duplicate_event_ids ?? []).length}
- Unknown asset IDs: ${(eventInputQualityStatus.unknown_asset_ids ?? []).length}
- Unknown event types: ${(eventInputQualityStatus.unknown_event_types ?? []).length}
- data/lp_events.jsonl write performed: ${eventInputQualityStatus.data_lp_events_write_performed ? "yes" : "no"}
- External effect: none

## Source Trust Matrix

- Status: ${sourceTrustMatrixStatus.ok ? "ok" : "not_ready"} / ${sourceTrustMatrixStatus.status ?? "unknown"}
- Mode: ${sourceTrustMatrixStatus.mode ?? "unknown"}
- Trusted scoring sources: ${sourceTrustMatrixStatus.trusted_scoring_source_count ?? 0}
- Sample-gate sources: ${sourceTrustMatrixStatus.sample_gate_source_count ?? 0}
- Scoring allowed now: ${sourceTrustMatrixStatus.scoring_allowed_now ? "yes" : "no"}
- Real event rows: ${sourceTrustMatrixStatus.real_event_rows ?? 0}
- P0 pending count: ${sourceTrustMatrixStatus.p0_pending_count ?? 0}
- Sample threshold met: ${sourceTrustMatrixStatus.sample_threshold_met ? "yes" : "no"}
- Ready for public iteration decision: ${sourceTrustMatrixStatus.ready_for_public_iteration_decision ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${sourceTrustMatrixStatus.data_lp_events_write_performed ? "yes" : "no"}
- External effect: none
- Artifacts: source_trust_matrix.md / source_trust_matrix.json / data/source_trust_matrix_status.json

## Source Readiness

- Status: ${sourceReadinessStatus.ok ? "ok" : "not_ready"} / ${sourceReadinessStatus.status ?? "unknown"}
- Missing stages: ${sourceReadinessStatus.missing_stage_count ?? 0}
- Ready for public iteration decision: ${sourceReadinessStatus.ready_for_public_iteration_decision ? "yes" : "no"}
- Champion URL ready: ${sourceReadinessStatus.champion_url_ready ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${sourceReadinessStatus.data_lp_events_write_performed ? "yes" : "no"}
- External effect: none

| stage | status | real events | live input exists | ready for decision |
|---|---|---:|---|---|
${sourceRows}

## Source Capture Pack

- Status: ${sourceCaptureStatus.ok ? "ok" : "not_ready"} / ${sourceCaptureStatus.status ?? "unknown"}
- Mode: ${sourceCaptureStatus.mode ?? "unknown"}
- Ledger rows: ${sourceCaptureStatus.ledger_rows ?? 0}
- Sample-gate ledger rows: ${sourceCaptureStatus.sample_gate_ledger_rows ?? 0}
- Importable tracking links: ${sourceCaptureStatus.importable_tracking_links ?? 0}/${sourceCaptureStatus.tracking_links_total ?? 0}
- A/B router gates held out: ${sourceCaptureStatus.ab_router_gate_count ?? 0}
- Template only: ${sourceCaptureStatus.template_only ? "yes" : "no"}
- Owner review required: ${sourceCaptureStatus.owner_review_required ? "yes" : "no"}
- Live input files created: ${sourceCaptureStatus.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${sourceCaptureStatus.data_lp_events_write_performed ? "yes" : "no"}
- External effect: none
- Artifacts: source_capture_pack.md / data/source_capture_status.json / data/source_capture/source_capture_checklist.json / data/source_capture/source_capture_ledger.fill-template.csv / data/source_capture/sample_gate_ledger.fill-template.csv / sample_gate_ledger.md / data/sample_gate_ledger_status.json / sample_gate_ledger_compile_probe.md / data/sample_gate_ledger_compile_probe_status.json

## Source Capture Compile Preview

- Status: ${sourceCaptureCompileStatus.ok ? "ok" : "not_ready"} / ${sourceCaptureCompileStatus.status ?? "unknown"}
- Mode: ${sourceCaptureCompileStatus.mode ?? "unknown"}
- Input kind: ${sourceCaptureCompileStatus.input_kind ?? "unknown"}
- Filled rows: ${sourceCaptureCompileStatus.filled_rows ?? 0}
- Funnel preview rows: ${sourceCaptureCompileStatus.funnel_rows ?? 0}
- Manual preview rows: ${sourceCaptureCompileStatus.manual_rows ?? 0}
- Issues: ${sourceCaptureCompileStatus.issue_count ?? 0}
- Owner review required: ${sourceCaptureCompileStatus.owner_review_required ? "yes" : "no"}
- Live input files created: ${sourceCaptureCompileStatus.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${sourceCaptureCompileStatus.data_lp_events_write_performed ? "yes" : "no"}
- External effect: none
- Artifacts: source_capture_compile_report.md / data/source_capture_compile_status.json / data/source_capture/compiled/funnel_aggregates.owner-preview.csv / data/source_capture/compiled/manual_conversions.owner-preview.csv

## Source Capture Compile Fixture Guard

- Status: ${sourceCaptureCompileFixtureStatus.ok ? "ok" : "not_ready"}
- Mode: ${sourceCaptureCompileFixtureStatus.mode ?? "unknown"}
- Scenarios: ${sourceCaptureCompileFixtureStatus.scenario_count ?? 0}
- Local fixture commands executed: ${sourceCaptureCompileFixtureStatus.local_fixture_commands_executed ? "yes" : "no"}
- Execution performed: ${sourceCaptureCompileFixtureStatus.execution_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${sourceCaptureCompileFixtureStatus.data_lp_events_write_performed ? "yes" : "no"}
- External effect: none
- Artifacts: source_capture_compile_fixture_report.md / data/source_capture_compile_fixture_status.json

## Win Rule Fixtures

- Status: ${winRuleFixtureStatus.ok ? "ok" : "not_ready"}
- Mode: ${winRuleFixtureStatus.mode ?? "unknown"}
- Scenarios: ${winRuleFixtureStatus.scenario_count ?? 0}
- Real event write performed: ${winRuleFixtureStatus.real_event_write_performed ? "yes" : "no"}
- Challenger promotion performed: ${winRuleFixtureStatus.challenger_promotion_performed ? "yes" : "no"}
- Report: ${winRuleFixtureStatus.report_path ?? "win_rule_fixture_report.md"}

## Real Data Decision Replay

- Status: ${realDataDecisionReplayStatus.ok ? "ok" : "not_ready"}
- Mode: ${realDataDecisionReplayStatus.mode ?? "unknown"}
- Scenarios: ${realDataDecisionReplayStatus.scenario_count ?? 0}
- Local fixture commands executed: ${realDataDecisionReplayStatus.local_fixture_commands_executed ? "yes" : "no"}
- Local importer preview commands executed: ${realDataDecisionReplayStatus.local_importer_preview_commands_executed ? "yes" : "no"}
- Execution performed: ${realDataDecisionReplayStatus.execution_performed ? "yes" : "no"}
- Real event write performed: ${realDataDecisionReplayStatus.real_event_write_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${realDataDecisionReplayStatus.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${realDataDecisionReplayStatus.external_effect ? "yes" : "no"}
- Report: ${realDataDecisionReplayStatus.report_path ?? "real_data_decision_replay_report.md"}

## Week Archive

- Status: ${weekArchiveStatus.ok ? "ok" : "not_ready"}
- Archive dir: ${weekArchiveStatus.archive_dir ?? "n/a"}
- Manifest: ${weekArchiveStatus.manifest_path ?? "n/a"}
- Files archived: ${weekArchiveStatus.files_archived ?? 0}/${weekArchiveStatus.expected_files ?? 0}
- Missing files: ${(weekArchiveStatus.missing_files ?? []).length}
- Immutable snapshot: ${weekArchiveStatus.immutable_snapshot ? "yes" : "no"}
- External effect: none

## Champion Contact Integration Candidate

- Source lock: origin/main commit, git blob, and SHA-256 must all match before generation.
- Contact path: LINE-only; the local false-success form state and personal input controls are removed.
- Telemetry: page_view and cta_click only; credentials omitted; line_add is never inferred from a click.
- Candidate report: champion_integration_candidate.md
- Two-Worker smoke: champion_integration_smoke.md
- Cloudflare D1 metadata readiness: cloudflare_d1_readiness.md
- Prepared local feature commit: champion_local_branch.md
- Clean-archive release preflight: champion_release_preflight.md
- Owner deploy/rollback packet: champion_release_owner_packet.md
- Human gate: review the generated patch and smoke evidence before any production deploy or public-link change.

## Challenger Candidate

- File: landing_page_candidate.html
- Worker: worker.ts
- Worker dry-run: ${workerDryRunStatus.ok ? "ok" : "not_ready"} / report=${workerDryRunStatus.report_path ?? "worker_dry_run.md"}
- Changed variable: cta_text
- CTA text: 加 LINE 領 48h 成交診斷
- Do not promote until line_add_rate > champion * ${config.win_rule.challenger_lift_required}, sample_threshold_met=true, and no_quality_regression=true.

## A/B Status

\`\`\`json
${JSON.stringify(abStatus, null, 2)}
\`\`\`

## Approval Queue

| id | tier | status | human gate |
|---|---:|---|---|
${queueRows}

## GitHub Handoff

- Artifact: github_handoff.md
- Current local git state: not a git repository
- Gate: do not initialize, push, or open a draft PR until owner confirms the target repository.
- Suggested branch: ang/3q-growth-loop-week0

## Owner Approval Pack

- Artifact: owner_approval_pack.md
- Owner console: owner_console.html
- Launch readiness JSON: launch_readiness.json
- Approval resume plan: approval_resume_plan.md
- Approval resume status: data/approval_resume_status.json
- Post-gate verification: post_gate_verification.md
- Post-gate verification status: data/post_gate_verification_status.json
- Approval input example: owner_approval_input.example.json
- Status: ${launchReadiness.status}
- Local preflight: ${launchReadiness.local_preflight_ok ? "pass" : "attention_required"}
- Pending human approvals: ${launchReadiness.pending_human_approval_count}
- Owner decision required: ${launchReadiness.owner_decision_required ? "yes" : "no"}
- Safety invariants: no formal post, public link change, challenger promotion, LINE push, payment/refund, customer data mutation, production deploy, or data delete.

## Prepared But Blocked

| id | action | blocked_by | artifact |
|---|---|---|---|
${blockedRows}

## Event Source

- Real events file: data/lp_events.jsonl
- Example format: data/lp_events.example.jsonl
- Events observed this run: ${events.length}
- D1 sync status: ${d1SyncStatus.ok ? "available" : "not_ready"} / scope=${d1SyncStatus.scope ?? "unknown"} / rows=${d1SyncStatus.rows_exported ?? 0}
- D1 sync output: ${d1SyncStatus.output_path ?? "n/a"}
- D1 collection guard: scoring_allowed=${d1SyncStatus.scoring_input_allowed ? "yes" : "no"} / smoke_rows=${d1SyncStatus.synthetic_or_smoke_row_count ?? 0} / real_candidate_rows=${d1SyncStatus.real_event_candidate_rows ?? 0} / data_write=${d1SyncStatus.data_lp_events_write_performed ? "yes" : "no"}
- Event input quality: ${eventInputQualityStatus.ok ? "ok" : "blocked"} / rows=${eventInputQualityStatus.rows_scanned ?? 0} / issues=${(eventInputQualityStatus.issues ?? []).length} / scoring_allowed=${eventInputQualityStatus.scoring_allowed ? "yes" : "no"}
- Full funnel aggregate CSV: data/funnel_aggregates.example.csv
- Full funnel aggregate status: ${funnelAggregateStatus.ok ? "available" : "not_ready"} / mode=${funnelAggregateStatus.mode ?? "unknown"} / events=${funnelAggregateStatus.events_written ?? 0}
- Full funnel aggregate output: ${funnelAggregateStatus.output_path ?? "n/a"}
- Full funnel aggregate privacy: sensitive_columns=${funnelAggregateStatus.contains_sensitive_columns ? "yes" : "no"} / sensitive_values=${funnelAggregateStatus.contains_sensitive_values ? "yes" : "no"} / apply_performed=${funnelAggregateStatus.apply_performed ? "yes" : "no"} / data_write=${funnelAggregateStatus.data_lp_events_write_performed ? "yes" : "no"}
- Full funnel aggregate fixtures: ${funnelAggregateFixtureStatus.ok ? "ok" : "not_ready"} / mode=${funnelAggregateFixtureStatus.mode ?? "unknown"} / scenarios=${funnelAggregateFixtureStatus.scenario_count ?? 0} / data_write=${funnelAggregateFixtureStatus.data_lp_events_write_performed ? "yes" : "no"}
- Real-data apply guard: ${realDataApplyFixtureStatus.ok ? "ok" : "not_ready"} / mode=${realDataApplyFixtureStatus.mode ?? "unknown"} / scenarios=${realDataApplyFixtureStatus.scenario_count ?? 0} / data_write=${realDataApplyFixtureStatus.data_lp_events_write_performed ? "yes" : "no"}
- Real-data decision replay: ${realDataDecisionReplayStatus.ok ? "ok" : "not_ready"} / mode=${realDataDecisionReplayStatus.mode ?? "unknown"} / scenarios=${realDataDecisionReplayStatus.scenario_count ?? 0} / ledger=${realDataDecisionReplayStatus.source_capture_ledger_replay_executed ? "yes" : "no"} / compile=${realDataDecisionReplayStatus.source_capture_compile_commands_executed ? "yes" : "no"} / data_write=${realDataDecisionReplayStatus.data_lp_events_write_performed ? "yes" : "no"} / external_effect=${realDataDecisionReplayStatus.external_effect ? "yes" : "no"}
- Source capture pack: ${sourceCaptureStatus.ok ? "ok" : "not_ready"} / rows=${sourceCaptureStatus.ledger_rows ?? 0} / importable_links=${sourceCaptureStatus.importable_tracking_links ?? 0} / live_inputs=${sourceCaptureStatus.live_input_files_created ? "yes" : "no"} / data_write=${sourceCaptureStatus.data_lp_events_write_performed ? "yes" : "no"}
- Real-data intake plan: ${realDataIntakeStatus.ok ? "ok" : "not_ready"} / status=${realDataIntakeStatus.status ?? "unknown"} / ready_apply=${realDataIntakeStatus.ready_apply_count ?? 0} / missing_inputs=${realDataIntakeStatus.missing_input_count ?? 0} / blocked_inputs=${realDataIntakeStatus.blocked_input_count ?? 0} / data_write=${realDataIntakeStatus.data_lp_events_write_performed ? "yes" : "no"}
- Data collection brief: ${dataCollectionBriefStatus.ok ? "ok" : "not_ready"} / status=${dataCollectionBriefStatus.status ?? "unknown"} / tasks=${dataCollectionBriefStatus.task_count ?? 0} / filled_ledger=${dataCollectionBriefStatus.filled_ledger_exists ? "yes" : "no"} / data_write=${dataCollectionBriefStatus.data_lp_events_write_performed ? "yes" : "no"}
- Data collection progress: ${dataCollectionProgressStatus.ok ? "ok" : "not_ready"} / status=${dataCollectionProgressStatus.status ?? "unknown"} / tasks=${dataCollectionProgressStatus.filled_task_count ?? 0}/${dataCollectionProgressStatus.total_task_count ?? 0} / pending=${dataCollectionProgressStatus.pending_task_count ?? 0} / p0_pending=${dataCollectionProgressStatus.p0_pending_count ?? 0} / p1_pending=${dataCollectionProgressStatus.p1_pending_count ?? 0} / next_owner_inputs=${dataCollectionProgressStatus.next_owner_input_count ?? 0} / data_write=${dataCollectionProgressStatus.data_lp_events_write_performed ? "yes" : "no"}
- Next P0 owner form: ${nextP0OwnerFormStatus.ok ? "ok" : "not_ready"} / status=${nextP0OwnerFormStatus.status ?? "unknown"} / rows=${nextP0OwnerFormStatus.row_count ?? 0} / browser_only=${nextP0OwnerFormStatus.browser_only ? "yes" : "no"} / network=${nextP0OwnerFormStatus.network_calls_performed ? "yes" : "no"} / fixture=${nextP0OwnerFormFixtureStatus.ok ? "ok" : "not_ready"} / fixture_scenarios=${nextP0OwnerFormFixtureStatus.scenario_count ?? 0} / data_write=${nextP0OwnerFormStatus.data_lp_events_write_performed ? "yes" : "no"}
- Next P0 owner intake: ${nextP0OwnerIntakeStatus.ok ? "ok" : "not_ready"} / status=${nextP0OwnerIntakeStatus.status ?? "unknown"} / found=${nextP0OwnerIntakeStatus.candidate_found ? "yes" : "no"} / valid=${nextP0OwnerIntakeStatus.candidate_valid ? "yes" : "no"} / preview_rows=${(nextP0OwnerIntakeStatus.funnel_preview_rows ?? 0) + (nextP0OwnerIntakeStatus.manual_preview_rows ?? 0)} / staged=${nextP0OwnerIntakeStatus.stage_performed ? "yes" : "no"} / fixture=${nextP0OwnerIntakeFixtureStatus.ok ? "ok" : "not_ready"} / fixture_scenarios=${nextP0OwnerIntakeFixtureStatus.scenario_count ?? 0} / data_write=${nextP0OwnerIntakeStatus.data_lp_events_write_performed ? "yes" : "no"} / external_effect=${nextP0OwnerIntakeStatus.external_effect ? "yes" : "no"}
- Sample gate plan: ${dataCollectionBriefStatus.sample_gate_status ?? "unknown"} / p0_tasks=${dataCollectionBriefStatus.sample_gate_p0_task_count ?? 0} / p0_links=${dataCollectionBriefStatus.sample_gate_p0_link_count ?? 0}
- Manual aggregate CSV: data/manual_conversions.example.csv
- Manual conversion status: ${manualConversionStatus.ok ? "available" : "not_ready"} / mode=${manualConversionStatus.mode ?? "unknown"} / events=${manualConversionStatus.events_written ?? 0}
- Manual conversion output: ${manualConversionStatus.output_path ?? "n/a"}
- Manual conversion privacy: sensitive_columns=${manualConversionStatus.contains_sensitive_columns ? "yes" : "no"} / sensitive_values=${manualConversionStatus.contains_sensitive_values ? "yes" : "no"} / apply_performed=${manualConversionStatus.apply_performed ? "yes" : "no"}
- LINE inbound playbook: ${lineInboundStatus.ok ? "ok" : "not_ready"} / mode=${lineInboundStatus.mode ?? "unknown"} / scenarios=${lineInboundStatus.scenario_count ?? 0}
- LINE inbound artifacts: line_inbound_playbook.md / line_inbound_playbook.json / data/line_inbound_fixture_status.json
- Tracking links artifact: tracking_links.json
- Content variants artifact: content_variants.md / content_variants.json
- Funnel breakdown artifact: funnel_breakdown.md / funnel_breakdown.json
- Pipeline artifact: pipeline_status.json
- Schedule artifact: data/schedule_status.json
- Candidate retirement artifact: candidate_retirement_queue.json

## Full Funnel Aggregate Import

- Purpose: preview aggregate counts for link_click, page_view, cta_click, line_add, lead_submit, deal, and quality_flag before remote Worker data is live.
- Default mode: preview only. Preview rows are not scored until owner intentionally applies them to data/lp_events.jsonl.
- Required attribution: content_id and variant_id must be present for every row.
- PII rule: no phone, email, LINE user ID, customer name, address, payment, message, memo, or private note fields.
- Apply gate: npm run import:funnel:apply is local-only but requires --confirm-real-data and refuses copied example/template input.

## Full Funnel Aggregate Fixture Guard

- Artifact: data/funnel_aggregate_fixture_status.json / funnel_aggregate_fixture_report.md
- Status: ${funnelAggregateFixtureStatus.ok ? "ok" : "not_ready"}
- Mode: ${funnelAggregateFixtureStatus.mode ?? "unknown"}
- Scenarios: ${funnelAggregateFixtureStatus.scenario_count ?? 0}
- Real event write performed: ${funnelAggregateFixtureStatus.real_event_write_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${funnelAggregateFixtureStatus.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${funnelAggregateFixtureStatus.external_effect ? "yes" : "no"}

## Real Data Apply Fixture Guard

- Artifact: data/real_data_apply_fixture_status.json / real_data_apply_fixture_report.md
- Status: ${realDataApplyFixtureStatus.ok ? "ok" : "not_ready"}
- Mode: ${realDataApplyFixtureStatus.mode ?? "unknown"}
- Scenarios: ${realDataApplyFixtureStatus.scenario_count ?? 0}
- Real event write performed: ${realDataApplyFixtureStatus.real_event_write_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${realDataApplyFixtureStatus.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${realDataApplyFixtureStatus.external_effect ? "yes" : "no"}
- Rule: funnel/manual apply requires reviewed real data plus --confirm-real-data; copied example CSVs are blocked.

## Real Data Decision Replay

- Artifact: data/real_data_decision_replay_status.json / real_data_decision_replay_report.md
- Status: ${realDataDecisionReplayStatus.ok ? "ok" : "not_ready"}
- Mode: ${realDataDecisionReplayStatus.mode ?? "unknown"}
- Scenarios: ${realDataDecisionReplayStatus.scenario_count ?? 0}
- Local fixture commands executed: ${realDataDecisionReplayStatus.local_fixture_commands_executed ? "yes" : "no"}
- Local importer preview commands executed: ${realDataDecisionReplayStatus.local_importer_preview_commands_executed ? "yes" : "no"}
- Execution performed: ${realDataDecisionReplayStatus.execution_performed ? "yes" : "no"}
- Real event write performed: ${realDataDecisionReplayStatus.real_event_write_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${realDataDecisionReplayStatus.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${realDataDecisionReplayStatus.external_effect ? "yes" : "no"}
- Rule: realistic aggregate CSV previews may influence local scoring and next-round planning, but never apply data, promote a challenger, or touch public links.

## Real Data Intake Plan

- Artifact: data/real_data_intake_status.json / real_data_intake_plan.md
- Status: ${realDataIntakeStatus.status ?? "unknown"}
- Real input files present: ${realDataIntakeStatus.has_real_input_files ? "yes" : "no"}
- Missing inputs: ${realDataIntakeStatus.missing_input_count ?? 0}
- Ready for owner apply: ${realDataIntakeStatus.ready_apply_count ?? 0}
- Blocked inputs: ${realDataIntakeStatus.blocked_input_count ?? 0}
- Real events unchanged: ${realDataIntakeStatus.real_events_unchanged ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${realDataIntakeStatus.data_lp_events_write_performed ? "yes" : "no"}
- Rule: this plan can preview reviewed aggregate CSVs and produce owner apply commands, but it never appends real events itself.

## Data Collection Brief

- Artifact: data_collection_brief.md / data_collection_queue.json / data/data_collection_brief_status.json
- Status: ${dataCollectionBriefStatus.ok ? "ok" : "not_ready"} / ${dataCollectionBriefStatus.status ?? "unknown"}
- Tasks: ${dataCollectionBriefStatus.task_count ?? 0}
- Stage count: ${dataCollectionBriefStatus.stage_count ?? 0}
- Importable links: ${dataCollectionBriefStatus.importable_link_count ?? 0}
- Sample gate plan: ${dataCollectionBriefStatus.sample_gate_status ?? "unknown"} / p0_tasks=${dataCollectionBriefStatus.sample_gate_p0_task_count ?? 0} / p0_links=${dataCollectionBriefStatus.sample_gate_p0_link_count ?? 0}
- Sample gate artifact: sample_gate_collection_plan.md / sample_gate_collection_plan.json / data/sample_gate_collection_plan_status.json
- Filled ledger exists: ${dataCollectionBriefStatus.filled_ledger_exists ? "yes" : "no"}
- Sample threshold met: ${dataCollectionBriefStatus.sample_threshold_met ? "yes" : "no"}
- Real events unchanged: ${dataCollectionBriefStatus.real_events_unchanged ? "yes" : "no"}
- Live input files created: ${dataCollectionBriefStatus.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${dataCollectionBriefStatus.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${dataCollectionBriefStatus.external_effect ? "yes" : "no"}
- Rule: this brief turns missing funnel-stage data into owner-reviewed aggregate-count tasks; it never creates live CSVs or appends real events.

## Data Collection Progress

- Artifact: data_collection_progress.md / data_collection_progress.json / data/data_collection_progress_status.json / next_p0_owner_inputs.md
- Status: ${dataCollectionProgressStatus.ok ? "ok" : "not_ready"} / ${dataCollectionProgressStatus.status ?? "unknown"}
- Tasks filled: ${dataCollectionProgressStatus.filled_task_count ?? 0}/${dataCollectionProgressStatus.total_task_count ?? 0}
- Pending tasks: ${dataCollectionProgressStatus.pending_task_count ?? 0}
- P0 pending: ${dataCollectionProgressStatus.p0_pending_count ?? 0}/${dataCollectionProgressStatus.p0_task_count ?? 0}
- P1 pending: ${dataCollectionProgressStatus.p1_pending_count ?? 0}/${dataCollectionProgressStatus.p1_task_count ?? 0}
- Source groups: ${dataCollectionProgressStatus.source_group_count ?? 0}
- Owner sample gate status: ${dataCollectionProgressStatus.owner_sample_gate_status ?? "unknown"}
- Next owner inputs exposed: ${dataCollectionProgressStatus.next_owner_input_count ?? 0}
- Sample threshold met: ${dataCollectionProgressStatus.sample_threshold_met ? "yes" : "no"}
- Real events unchanged: ${dataCollectionProgressStatus.real_events_unchanged ? "yes" : "no"}
- Live input files created: ${dataCollectionProgressStatus.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${dataCollectionProgressStatus.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${dataCollectionProgressStatus.external_effect ? "yes" : "no"}
- Rule: this is the Week 0 owner-count progress dashboard. It ranks missing aggregate counts but does not stage live CSVs or score unreviewed data.

## Manual Conversion Import

- Purpose: record LINE adds, lead submits, deals, and quality flags as aggregate counts only.
- Default mode: preview only. Preview rows are not scored until owner intentionally applies them to data/lp_events.jsonl.
- PII rule: no phone, email, LINE user ID, customer name, address, payment, message, memo, or private note fields.
- Apply gate: npm run import:manual:apply is local-only but requires --confirm-real-data and refuses copied example/template input.

## LINE Inbound Playbook

- Artifact: line_inbound_playbook.md / line_inbound_playbook.json
- Fixture status: ${lineInboundStatus.ok ? "ok" : "not_ready"} / mode=${lineInboundStatus.mode ?? "unknown"} / scenarios=${lineInboundStatus.scenario_count ?? 0}
- LINE push performed: ${lineInboundStatus.line_push_performed ? "yes" : "no"}
- Customer data mutation performed: ${lineInboundStatus.customer_data_mutation_performed ? "yes" : "no"}
- Payment action performed: ${lineInboundStatus.payment_action_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${lineInboundStatus.data_lp_events_write_performed ? "yes" : "no"}
- Rule: inbound-only manual replies; local files store aggregate event counts and bucketed quality only.

## Manual Publish Evidence Form

- Artifact: manual_publish_evidence_form.html
- Status: ${manualPublishEvidenceFormStatus.ok ? "ok" : "not_ready"} / status=${manualPublishEvidenceFormStatus.status ?? "unknown"} / packets=${manualPublishEvidenceFormStatus.packet_count ?? 0}
- Browser only: ${manualPublishEvidenceFormStatus.browser_only ? "yes" : "no"}
- Network calls performed: ${manualPublishEvidenceFormStatus.network_calls_performed ? "yes" : "no"}
- Post URL fetch performed: ${manualPublishEvidenceFormStatus.post_url_fetch_performed ? "yes" : "no"}
- Live input files created: ${manualPublishEvidenceFormStatus.live_input_files_created ? "yes" : "no"}
- Fixture guard: ${manualPublishEvidenceFormFixtureStatus.ok ? "ok" : "not_ready"} / mode=${manualPublishEvidenceFormFixtureStatus.mode ?? "unknown"} / scenarios=${manualPublishEvidenceFormFixtureStatus.scenario_count ?? 0}
- data/lp_events.jsonl write performed: ${manualPublishEvidenceFormFixtureStatus.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${manualPublishEvidenceFormFixtureStatus.external_effect ? "yes" : "no"}
- Rule: owner can capture post URL/time evidence locally in browser review JSON; the engine does not fetch live posts or create live event inputs.

## Next Step

When the operator says "引擎照這版走", run:

\`\`\`zsh
cd /Users/mac/Documents/Codex/control-center/3q-growth-loop
npm run week0
npm run d1:local:migrate
\`\`\`

Stop before remote D1 creation, production deploy, primary link changes, formal posts, LINE pushes, payments, or customer-data mutations.

## Autonomous Judgment

The highest-leverage move is not more creative variants; it is measurement discipline. This engine deliberately starts with one CTA challenger and refuses to change the champion until the funnel has enough visits, CTA clicks, LINE adds, and test days.
`;
}

function renderGoalCompletionAudit(config, scores, abStatus, approvalQueue, blocked, trackingLinks, contentVariants, funnelBreakdown, pipelineStatus, retirementQueue, nextRoundPlan, d1SyncStatus, eventInputQualityStatus, funnelAggregateStatus, funnelAggregateFixtureStatus, realDataApplyFixtureStatus, realDataDecisionReplayStatus, sourceReadinessStatus, sourceCaptureStatus, sourceCaptureCompileStatus, sourceCaptureCompileFixtureStatus, realDataIntakeStatus, dataCollectionBriefStatus, dataCollectionProgressStatus, sourceTrustMatrixStatus, nextP0OwnerFormStatus, nextP0OwnerFormFixtureStatus, nextP0OwnerIntakeStatus, nextP0OwnerIntakeFixtureStatus, manualConversionStatus, lineInboundStatus, manualPublishEvidenceFormStatus, manualPublishEvidenceFormFixtureStatus, scheduleStatus, workerDryRunStatus, browserSmokeStatus, trackingLinkSmokeStatus, eventContractSmokeStatus, winRuleFixtureStatus, weekArchiveStatus, launchReadiness, events, week, now) {
  const explicitOutputs = [
    ["weekly_report.md", "present_generated"],
    ["growth_scores.json", "present_generated"],
    ["approval_queue.json", "present_generated"],
    ["ab_test_status.json", "present_generated"],
    ["landing_page_candidate.html", "present_generated"],
    ["worker.ts", "present_generated"],
    ["worker_dry_run.md", workerDryRunStatus.ok ? "present_worker_dry_run_report" : "present_or_not_run"],
    ["data/worker_dry_run_status.json", workerDryRunStatus.ok ? "present_worker_dry_run_status" : "present_or_not_run"],
    ["champion_integration_candidate.md", "present_source_locked_contact_repair_candidate"],
    ["data/champion_integration_candidate_status.json", "present_source_lock_and_dry_run_status"],
    ["champion_integration_smoke.md", "present_two_worker_isolated_smoke"],
    ["data/champion_integration_smoke_status.json", "present_two_worker_smoke_status"],
    ["cloudflare_d1_readiness.md / data/cloudflare_d1_readiness_status.json", "present_read_only_d1_metadata_readiness"],
    ["champion_local_branch.md / data/champion_local_branch_status.json", "present_isolated_local_feature_commit"],
    ["champion_release_preflight.md", "present_clean_archive_release_preflight"],
    ["data/champion_release_preflight_status.json", "present_release_preflight_status"],
    ["data/champion_live_deployment_snapshot.json", "present_read_only_live_deployment_snapshot"],
    ["champion_release_owner_packet.md / champion_release_owner_packet.json", "present_owner_deploy_and_rollback_packet"],
    ["prepared_but_blocked.json", "present_generated"],
    ["github_handoff.md", "present_github_publish_handoff"],
    ["launch_readiness.json", "present_owner_gate_map"],
    ["owner_approval_pack.md", "present_owner_review_pack"],
    ["approval_resume_plan.md", "present_resume_dry_run_plan_after_weekly_runner"],
    ["data/approval_resume_status.json", "present_resume_dry_run_status_after_weekly_runner"],
    ["post_gate_verification.md", "present_post_gate_verification_plan_after_weekly_runner"],
    ["data/post_gate_verification_status.json", "present_post_gate_verification_status_after_weekly_runner"],
    ["owner_approval_input.example.json", "present_non_secret_example_input_after_weekly_runner"],
    ["tracking_links.json", "present_generated"],
    ["content_variants.md / content_variants.json", "present_generated"],
    ["funnel_breakdown.md / funnel_breakdown.json", "present_content_variant_attribution"],
    ["next_round_plan.md / next_round_plan.json", nextRoundPlan.next_round.one_variable_rule_ok ? "present_next_round_decision" : "present_needs_review"],
    ["pipeline_status.json", "present_generated"],
    ["data/schedule_status.json", "present_generated"],
    ["data/launchagent_status.json", scheduleStatus.launchd_installed ? "present_installed_local_schedule" : "present_or_not_installed"],
    ["launchd/com.angelia.3q-growth-loop.weekly.plist", "present_launchagent_template"],
    ["candidate_retirement_queue.json", "present_generated"],
    ["data/d1_sync_status.json", d1SyncStatus.ok ? "present_d1_sync_available" : "present_or_not_run"],
    ["data/event_input_quality_status.json", eventInputQualityStatus.ok ? "present_event_input_quality_passed" : "present_or_blocked"],
    ["data/lp_events.d1-local.jsonl", d1SyncStatus.scope === "local" ? "present_local_d1_export" : "optional_local_review_export"],
    ["data/funnel_aggregates.example.csv", "present_full_funnel_aggregate_template"],
    ["data/funnel_aggregates.preview.jsonl", funnelAggregateStatus.mode === "full_funnel_preview" ? "present_preview_not_scored" : "present_or_not_run"],
    ["data/funnel_aggregate_status.json", funnelAggregateStatus.ok ? "present_full_funnel_preview_status" : "present_or_not_run"],
    ["data/funnel_aggregate_fixture_status.json", funnelAggregateFixtureStatus.ok ? "present_full_funnel_fixture_status" : "present_or_not_run"],
    ["funnel_aggregate_fixture_report.md", funnelAggregateFixtureStatus.ok ? "present_full_funnel_fixture_report" : "present_or_not_run"],
    ["data/real_data_apply_fixture_status.json", realDataApplyFixtureStatus.ok ? "present_real_data_apply_guard_status" : "present_or_not_run"],
    ["real_data_apply_fixture_report.md", realDataApplyFixtureStatus.ok ? "present_real_data_apply_guard_report" : "present_or_not_run"],
    ["data/real_data_decision_replay_status.json", realDataDecisionReplayStatus.ok ? "present_real_data_decision_replay_status" : "present_or_not_run"],
    ["real_data_decision_replay_report.md", realDataDecisionReplayStatus.ok ? "present_real_data_decision_replay_report" : "present_or_not_run"],
    ["data/source_readiness_status.json", sourceReadinessStatus.ok ? "present_source_readiness_status" : "present_or_not_run"],
    ["source_readiness.md", sourceReadinessStatus.ok ? "present_source_readiness_report" : "present_or_not_run"],
    ["source_trust_matrix.md", sourceTrustMatrixStatus.ok ? "present_source_trust_report" : "present_or_not_run"],
    ["source_trust_matrix.json", sourceTrustMatrixStatus.ok ? "present_source_trust_matrix" : "present_or_not_run"],
    ["data/source_trust_matrix_status.json", sourceTrustMatrixStatus.ok ? "present_source_trust_status" : "present_or_not_run"],
    ["data/source_capture_status.json", sourceCaptureStatus.ok ? "present_source_capture_status" : "present_or_not_run"],
    ["source_capture_pack.md", sourceCaptureStatus.ok ? "present_source_capture_pack" : "present_or_not_run"],
    ["data/source_capture/source_capture_checklist.json", sourceCaptureStatus.ok ? "present_source_capture_checklist" : "present_or_not_run"],
    ["data/source_capture/source_capture_ledger.fill-template.csv", sourceCaptureStatus.ok ? "present_source_capture_ledger_template" : "present_or_not_run"],
    ["data/source_capture/sample_gate_ledger.fill-template.csv", sourceCaptureStatus.ok ? "present_sample_gate_ledger_template" : "present_or_not_run"],
    ["sample_gate_ledger.md", sourceCaptureStatus.ok ? "present_sample_gate_ledger_report" : "present_or_not_run"],
    ["data/sample_gate_ledger_status.json", sourceCaptureStatus.ok ? "present_sample_gate_ledger_status" : "present_or_not_run"],
    ["sample_gate_ledger_compile_probe.md", sourceCaptureStatus.ok ? "present_sample_gate_compile_probe_report" : "present_or_not_run"],
    ["data/sample_gate_ledger_compile_probe_status.json", sourceCaptureStatus.ok ? "present_sample_gate_compile_probe_status" : "present_or_not_run"],
    ["data/source_capture/sample_gate_compile_probe/funnel_aggregates.owner-preview.csv", sourceCaptureStatus.ok ? "present_sample_gate_compile_probe_funnel" : "present_or_not_run"],
    ["data/source_capture/sample_gate_compile_probe/manual_conversions.owner-preview.csv", sourceCaptureStatus.ok ? "present_sample_gate_compile_probe_manual" : "present_or_not_run"],
    ["source_capture_compile_report.md", sourceCaptureCompileStatus.ok ? "present_source_capture_compile_report" : "present_or_not_run"],
    ["data/source_capture_compile_status.json", sourceCaptureCompileStatus.ok ? "present_source_capture_compile_status" : "present_or_not_run"],
    ["source_capture_compile_fixture_report.md", sourceCaptureCompileFixtureStatus.ok ? "present_source_capture_compile_fixture_report" : "present_or_not_run"],
    ["data/source_capture_compile_fixture_status.json", sourceCaptureCompileFixtureStatus.ok ? "present_source_capture_compile_fixture_status" : "present_or_not_run"],
    ["data/source_capture/compiled/funnel_aggregates.owner-preview.csv", sourceCaptureCompileStatus.ok ? "present_source_capture_funnel_owner_preview" : "present_or_not_run"],
    ["data/source_capture/compiled/manual_conversions.owner-preview.csv", sourceCaptureCompileStatus.ok ? "present_source_capture_manual_owner_preview" : "present_or_not_run"],
    ["data/real_data_intake_status.json", realDataIntakeStatus.ok ? "present_real_data_intake_status" : "present_or_not_run"],
    ["real_data_intake_plan.md", realDataIntakeStatus.ok ? "present_real_data_intake_plan" : "present_or_not_run"],
    ["data_collection_queue.json", dataCollectionBriefStatus.ok ? "present_data_collection_queue" : "present_or_not_run"],
    ["data_collection_brief.md", dataCollectionBriefStatus.ok ? "present_data_collection_brief" : "present_or_not_run"],
    ["data/data_collection_brief_status.json", dataCollectionBriefStatus.ok ? "present_data_collection_brief_status" : "present_or_not_run"],
    ["data_collection_progress.md / data_collection_progress.json / data/data_collection_progress_status.json", dataCollectionProgressStatus.ok ? "present_data_collection_progress" : "present_or_not_run"],
    ["next_p0_owner_inputs.md / next_p0_owner_inputs.json / data/next_p0_owner_inputs_status.json", dataCollectionProgressStatus.ok ? "present_next_p0_owner_inputs" : "present_or_not_run"],
    ["next_p0_owner_form.html / data/next_p0_owner_form_status.json", nextP0OwnerFormStatus.ok ? "present_next_p0_owner_form" : "present_or_not_run"],
    ["next_p0_owner_form_fixture_report.md / data/next_p0_owner_form_fixture_status.json", nextP0OwnerFormFixtureStatus.ok ? "present_next_p0_owner_form_fixture" : "present_or_not_run"],
    ["next_p0_owner_intake.md / data/next_p0_owner_intake_status.json", nextP0OwnerIntakeStatus.ok ? "present_next_p0_owner_intake" : "present_or_not_run"],
    ["next_p0_owner_intake_fixture_report.md / data/next_p0_owner_intake_fixture_status.json", nextP0OwnerIntakeFixtureStatus.ok ? "present_next_p0_owner_intake_fixture" : "present_or_not_run"],
    ["sample_gate_collection_plan.json", dataCollectionBriefStatus.ok ? "present_sample_gate_plan" : "present_or_not_run"],
    ["sample_gate_collection_plan.md", dataCollectionBriefStatus.ok ? "present_sample_gate_plan_report" : "present_or_not_run"],
    ["data/sample_gate_collection_plan_status.json", dataCollectionBriefStatus.ok ? "present_sample_gate_status" : "present_or_not_run"],
    ["data/manual_conversions.example.csv", "present_aggregate_only_template"],
    ["data/manual_conversions.preview.jsonl", manualConversionStatus.mode === "preview" ? "present_preview_not_scored" : "present_or_not_run"],
    ["data/manual_conversion_status.json", manualConversionStatus.ok ? "present_manual_preview_status" : "present_or_not_run"],
    ["line_inbound_playbook.md", lineInboundStatus.ok ? "present_inbound_manual_playbook" : "present_or_not_run"],
    ["line_inbound_playbook.json", lineInboundStatus.ok ? "present_machine_readable_inbound_playbook" : "present_or_not_run"],
    ["line_inbound_fixture_report.md", lineInboundStatus.ok ? "present_inbound_fixture_report" : "present_or_not_run"],
    ["data/line_inbound_fixture_status.json", lineInboundStatus.ok ? "present_inbound_fixture_status" : "present_or_not_run"],
    ["manual_publish_evidence_form.html", manualPublishEvidenceFormStatus.ok ? "present_manual_publish_evidence_browser_form" : "present_or_not_run"],
    ["data/manual_publish_evidence_form_status.json", manualPublishEvidenceFormStatus.ok ? "present_manual_publish_evidence_form_status" : "present_or_not_run"],
    ["manual_publish_evidence_form_fixture_report.md", manualPublishEvidenceFormFixtureStatus.ok ? "present_manual_publish_evidence_form_fixture_report" : "present_or_not_run"],
    ["data/manual_publish_evidence_form_fixture_status.json", manualPublishEvidenceFormFixtureStatus.ok ? "present_manual_publish_evidence_form_fixture_status" : "present_or_not_run"],
    ["data/browser_smoke_status.json", browserSmokeStatus.ok ? "present_local_browser_smoke" : "present_or_not_run"],
    ["tracking_link_smoke.md", trackingLinkSmokeStatus.ok ? "present_tracking_link_smoke_report" : "present_or_not_run"],
    ["data/tracking_link_smoke_status.json", trackingLinkSmokeStatus.ok ? "present_tracking_link_smoke_passed" : "present_or_not_run"],
    ["data/event_contract_smoke_status.json", eventContractSmokeStatus.ok ? "present_event_contract_smoke_passed" : "present_or_not_run"],
    ["data/win_rule_fixture_status.json", winRuleFixtureStatus.ok ? "present_win_rule_fixture_passed" : "present_or_not_run"],
    ["win_rule_fixture_report.md", winRuleFixtureStatus.ok ? "present_win_rule_fixture_report" : "present_or_not_run"],
    ["data/week_archive_status.json", weekArchiveStatus.ok ? "present_week_archive_snapshot" : "present_or_not_run"],
    ["archive/<week>/<timestamp>/manifest.json", weekArchiveStatus.ok ? "present_manifest_hashes" : "present_after_archive_run"],
  ];

  const checks = [
    {
      requirement: "North star funnel uses link_click -> line_add -> lead_submit -> deal.",
      status: "local_prepared",
      evidence: "growth_scores.json counts link_clicks, line_adds, leads, deals; weekly_report.md states the north star.",
    },
    {
      requirement: "Collect data and set lp_events.",
      status: events.length > 0 ? "local_events_present" : "local_schema_ready_no_real_events",
      evidence: `schema/d1-week0.sql defines lp_events; data/lp_events.jsonl events=${events.length}; D1 sync scope=${d1SyncStatus.scope ?? "not_run"} rows=${d1SyncStatus.rows_exported ?? 0}.`,
    },
    {
      requirement: "Gate real lp_events input before scoring and block PII or malformed rows.",
      status: eventInputQualityStatus.ok && eventInputQualityStatus.scoring_allowed ? "local_verified" : "blocked_or_not_ready",
      evidence: `data/event_input_quality_status.json ok=${eventInputQualityStatus.ok ? "yes" : "no"}; rows=${eventInputQualityStatus.rows_scanned ?? 0}; issues=${(eventInputQualityStatus.issues ?? []).length}; sensitive=${eventInputQualityStatus.pii_or_sensitive_data_detected ? "yes" : "no"}; scoring_allowed=${eventInputQualityStatus.scoring_allowed ? "yes" : "no"}; data_lp_events_write_performed=${eventInputQualityStatus.data_lp_events_write_performed ? "yes" : "no"}.`,
    },
    {
      requirement: "Full-funnel aggregate import previews link clicks, visits, CTA clicks, LINE adds, leads, deals, and quality flags without scoring them.",
      status: funnelAggregateStatus.ok && funnelAggregateStatus.mode === "full_funnel_preview" && !funnelAggregateStatus.apply_performed ? "local_preview_ready_not_scored" : "not_ready",
      evidence: `data/funnel_aggregate_status.json mode=${funnelAggregateStatus.mode ?? "unknown"} events=${funnelAggregateStatus.events_written ?? 0}; apply_performed=${funnelAggregateStatus.apply_performed ? "yes" : "no"}; data_lp_events_write_performed=${funnelAggregateStatus.data_lp_events_write_performed ? "yes" : "no"}; sensitive_columns=${funnelAggregateStatus.contains_sensitive_columns ? "yes" : "no"}; sensitive_values=${funnelAggregateStatus.contains_sensitive_values ? "yes" : "no"}.`,
    },
    {
      requirement: "Full-funnel aggregate fixtures block unknown assets, missing attribution, sensitive fields, sensitive values, and unsafe apply attempts.",
      status: funnelAggregateFixtureStatus.ok && !funnelAggregateFixtureStatus.data_lp_events_write_performed ? "local_verified_fixture_guard" : "not_ready",
      evidence: `data/funnel_aggregate_fixture_status.json ok=${funnelAggregateFixtureStatus.ok ? "yes" : "no"}; mode=${funnelAggregateFixtureStatus.mode ?? "unknown"}; scenarios=${funnelAggregateFixtureStatus.scenario_count ?? 0}; real_event_write_performed=${funnelAggregateFixtureStatus.real_event_write_performed ? "yes" : "no"}; data_lp_events_write_performed=${funnelAggregateFixtureStatus.data_lp_events_write_performed ? "yes" : "no"}; external_effect=${funnelAggregateFixtureStatus.external_effect ? "yes" : "no"}.`,
    },
    {
      requirement: "Real-data apply fixtures block example/template or unconfirmed aggregate rows from being scored.",
      status: realDataApplyFixtureStatus.ok && !realDataApplyFixtureStatus.data_lp_events_write_performed ? "local_verified_apply_guard" : "not_ready",
      evidence: `data/real_data_apply_fixture_status.json ok=${realDataApplyFixtureStatus.ok ? "yes" : "no"}; mode=${realDataApplyFixtureStatus.mode ?? "unknown"}; scenarios=${realDataApplyFixtureStatus.scenario_count ?? 0}; real_event_write_performed=${realDataApplyFixtureStatus.real_event_write_performed ? "yes" : "no"}; data_lp_events_write_performed=${realDataApplyFixtureStatus.data_lp_events_write_performed ? "yes" : "no"}; external_effect=${realDataApplyFixtureStatus.external_effect ? "yes" : "no"}.`,
    },
    {
      requirement: "Real-data decision replay connects filled source-capture ledgers, compiled owner-preview CSVs, aggregate import previews, scoring, A/B decisions, and next-round planning.",
      status: realDataDecisionReplayStatus.ok && !realDataDecisionReplayStatus.data_lp_events_write_performed && !realDataDecisionReplayStatus.external_effect ? "local_verified_decision_replay" : "not_ready",
      evidence: `data/real_data_decision_replay_status.json ok=${realDataDecisionReplayStatus.ok ? "yes" : "no"}; mode=${realDataDecisionReplayStatus.mode ?? "unknown"}; scenarios=${realDataDecisionReplayStatus.scenario_count ?? 0}; source_capture_ledger=${realDataDecisionReplayStatus.source_capture_ledger_replay_executed ? "yes" : "no"}; source_compile_commands=${realDataDecisionReplayStatus.source_capture_compile_commands_executed ? "yes" : "no"}; local_importer_previews=${realDataDecisionReplayStatus.local_importer_preview_commands_executed ? "yes" : "no"}; real_event_write_performed=${realDataDecisionReplayStatus.real_event_write_performed ? "yes" : "no"}; data_lp_events_write_performed=${realDataDecisionReplayStatus.data_lp_events_write_performed ? "yes" : "no"}; external_effect=${realDataDecisionReplayStatus.external_effect ? "yes" : "no"}.`,
    },
    {
      requirement: "Source readiness identifies every funnel-stage data source before public iteration decisions.",
      status: sourceReadinessStatus.ok && !sourceReadinessStatus.data_lp_events_write_performed ? "local_verified_source_monitor" : "not_ready",
      evidence: `data/source_readiness_status.json status=${sourceReadinessStatus.status ?? "unknown"}; stages=${(sourceReadinessStatus.stages ?? []).length}; missing_stages=${sourceReadinessStatus.missing_stage_count ?? 0}; ready_for_public_iteration_decision=${sourceReadinessStatus.ready_for_public_iteration_decision ? "yes" : "no"}; data_lp_events_write_performed=${sourceReadinessStatus.data_lp_events_write_performed ? "yes" : "no"}; external_effect=${sourceReadinessStatus.external_effect ? "yes" : "no"}.`,
    },
    {
      requirement: "Source trust matrix blocks review-only D1 smoke rows and owner-preview artifacts from scoring decisions.",
      status: sourceTrustMatrixStatus.ok && !sourceTrustMatrixStatus.data_lp_events_write_performed ? "local_verified_source_trust_gate" : "not_ready",
      evidence: `data/source_trust_matrix_status.json status=${sourceTrustMatrixStatus.status ?? "unknown"}; trusted_scoring_sources=${sourceTrustMatrixStatus.trusted_scoring_source_count ?? 0}; sample_gate_sources=${sourceTrustMatrixStatus.sample_gate_source_count ?? 0}; real_event_rows=${sourceTrustMatrixStatus.real_event_rows ?? 0}; p0_pending=${sourceTrustMatrixStatus.p0_pending_count ?? 0}; scoring_allowed_now=${sourceTrustMatrixStatus.scoring_allowed_now ? "yes" : "no"}; data_lp_events_write_performed=${sourceTrustMatrixStatus.data_lp_events_write_performed ? "yes" : "no"}; external_effect=${sourceTrustMatrixStatus.external_effect ? "yes" : "no"}.`,
    },
    {
      requirement: "Source capture pack maps every funnel-stage source to aggregate-only owner capture templates.",
      status: sourceCaptureStatus.ok && sourceCaptureStatus.template_only && !sourceCaptureStatus.live_input_files_created && !sourceCaptureStatus.data_lp_events_write_performed ? "local_capture_pack_ready" : "not_ready",
      evidence: `data/source_capture_status.json status=${sourceCaptureStatus.status ?? "unknown"}; rows=${sourceCaptureStatus.ledger_rows ?? 0}; importable_links=${sourceCaptureStatus.importable_tracking_links ?? 0}; ab_router_gates=${sourceCaptureStatus.ab_router_gate_count ?? 0}; template_only=${sourceCaptureStatus.template_only ? "yes" : "no"}; live_input_files_created=${sourceCaptureStatus.live_input_files_created ? "yes" : "no"}; data_lp_events_write_performed=${sourceCaptureStatus.data_lp_events_write_performed ? "yes" : "no"}; external_effect=${sourceCaptureStatus.external_effect ? "yes" : "no"}.`,
    },
    {
      requirement: "Source capture compile validates filled ledger rows and emits owner-preview aggregate CSVs without live writes.",
      status: sourceCaptureCompileStatus.ok && ["waiting_for_filled_counts", "owner_preview_ready"].includes(sourceCaptureCompileStatus.status) && !sourceCaptureCompileStatus.live_input_files_created && !sourceCaptureCompileStatus.data_lp_events_write_performed ? "local_compile_preview_ready" : "not_ready",
      evidence: `data/source_capture_compile_status.json status=${sourceCaptureCompileStatus.status ?? "unknown"}; input_kind=${sourceCaptureCompileStatus.input_kind ?? "unknown"}; filled_rows=${sourceCaptureCompileStatus.filled_rows ?? 0}; funnel_rows=${sourceCaptureCompileStatus.funnel_rows ?? 0}; manual_rows=${sourceCaptureCompileStatus.manual_rows ?? 0}; issues=${sourceCaptureCompileStatus.issue_count ?? 0}; live_input_files_created=${sourceCaptureCompileStatus.live_input_files_created ? "yes" : "no"}; data_lp_events_write_performed=${sourceCaptureCompileStatus.data_lp_events_write_performed ? "yes" : "no"}; external_effect=${sourceCaptureCompileStatus.external_effect ? "yes" : "no"}.`,
    },
    {
      requirement: "Source capture compile fixtures prove valid filled rows and invalid sensitive/malformed rows are handled safely.",
      status: sourceCaptureCompileFixtureStatus.ok && !sourceCaptureCompileFixtureStatus.data_lp_events_write_performed ? "local_verified_fixture_guard" : "not_ready",
      evidence: `data/source_capture_compile_fixture_status.json ok=${sourceCaptureCompileFixtureStatus.ok ? "yes" : "no"}; mode=${sourceCaptureCompileFixtureStatus.mode ?? "unknown"}; scenarios=${sourceCaptureCompileFixtureStatus.scenario_count ?? 0}; execution_performed=${sourceCaptureCompileFixtureStatus.execution_performed ? "yes" : "no"}; data_lp_events_write_performed=${sourceCaptureCompileFixtureStatus.data_lp_events_write_performed ? "yes" : "no"}; external_effect=${sourceCaptureCompileFixtureStatus.external_effect ? "yes" : "no"}.`,
    },
    {
      requirement: "Real-data intake plan checks for reviewed aggregate CSV inputs and produces owner-gated local apply commands without writing real events.",
      status: realDataIntakeStatus.ok && !realDataIntakeStatus.data_lp_events_write_performed ? "local_intake_plan_ready" : "not_ready",
      evidence: `data/real_data_intake_status.json status=${realDataIntakeStatus.status ?? "unknown"}; ready_apply=${realDataIntakeStatus.ready_apply_count ?? 0}; missing_inputs=${realDataIntakeStatus.missing_input_count ?? 0}; blocked_inputs=${realDataIntakeStatus.blocked_input_count ?? 0}; real_events_unchanged=${realDataIntakeStatus.real_events_unchanged ? "yes" : "no"}; data_lp_events_write_performed=${realDataIntakeStatus.data_lp_events_write_performed ? "yes" : "no"}.`,
    },
    {
      requirement: "Data collection brief turns missing funnel-stage source data into an owner-reviewed aggregate-count task queue.",
      status: dataCollectionBriefStatus.ok && (dataCollectionBriefStatus.task_count ?? 0) > 0 && !dataCollectionBriefStatus.data_lp_events_write_performed && !dataCollectionBriefStatus.external_effect ? "local_collection_queue_ready" : "not_ready",
      evidence: `data/data_collection_brief_status.json status=${dataCollectionBriefStatus.status ?? "unknown"}; tasks=${dataCollectionBriefStatus.task_count ?? 0}; stages=${dataCollectionBriefStatus.stage_count ?? 0}; importable_links=${dataCollectionBriefStatus.importable_link_count ?? 0}; sample_gate_status=${dataCollectionBriefStatus.sample_gate_status ?? "unknown"}; sample_gate_p0_tasks=${dataCollectionBriefStatus.sample_gate_p0_task_count ?? 0}; sample_gate_p0_links=${dataCollectionBriefStatus.sample_gate_p0_link_count ?? 0}; filled_ledger_exists=${dataCollectionBriefStatus.filled_ledger_exists ? "yes" : "no"}; live_input_files_created=${dataCollectionBriefStatus.live_input_files_created ? "yes" : "no"}; data_lp_events_write_performed=${dataCollectionBriefStatus.data_lp_events_write_performed ? "yes" : "no"}; external_effect=${dataCollectionBriefStatus.external_effect ? "yes" : "no"}.`,
    },
    {
      requirement: "Data collection progress turns the 42 owner aggregate-count tasks into a machine-readable completion dashboard.",
      status: dataCollectionProgressStatus.ok && dataCollectionProgressStatus.data_lp_events_write_performed === false && dataCollectionProgressStatus.external_effect === false ? "local_progress_dashboard_ready" : "not_ready",
      evidence: `data/data_collection_progress_status.json status=${dataCollectionProgressStatus.status ?? "unknown"}; tasks=${dataCollectionProgressStatus.filled_task_count ?? 0}/${dataCollectionProgressStatus.total_task_count ?? 0}; pending=${dataCollectionProgressStatus.pending_task_count ?? 0}; p0_pending=${dataCollectionProgressStatus.p0_pending_count ?? 0}; p1_pending=${dataCollectionProgressStatus.p1_pending_count ?? 0}; next_owner_inputs=${dataCollectionProgressStatus.next_owner_input_count ?? 0}; live_input_files_created=${dataCollectionProgressStatus.live_input_files_created ? "yes" : "no"}; data_lp_events_write_performed=${dataCollectionProgressStatus.data_lp_events_write_performed ? "yes" : "no"}; external_effect=${dataCollectionProgressStatus.external_effect ? "yes" : "no"}.`,
    },
    {
      requirement: "Manual aggregate conversion import for LINE adds, leads, deals, and quality flags.",
      status: manualConversionStatus.ok && manualConversionStatus.mode === "preview" ? "local_preview_ready_not_scored" : "not_ready",
      evidence: `data/manual_conversion_status.json mode=${manualConversionStatus.mode ?? "unknown"} events=${manualConversionStatus.events_written ?? 0}; apply_performed=${manualConversionStatus.apply_performed ? "yes" : "no"}; sensitive_columns=${manualConversionStatus.contains_sensitive_columns ? "yes" : "no"}; sensitive_values=${manualConversionStatus.contains_sensitive_values ? "yes" : "no"}.`,
    },
    {
      requirement: "LINE inbound customer-service handoff maps LINE adds, leads, deals, and quality flags without storing customer data.",
      status: lineInboundStatus.ok && !lineInboundStatus.line_push_performed && !lineInboundStatus.customer_data_mutation_performed ? "local_verified_inbound_only" : "not_ready",
      evidence: `data/line_inbound_fixture_status.json ok=${lineInboundStatus.ok ? "yes" : "no"}; mode=${lineInboundStatus.mode ?? "unknown"}; scenarios=${lineInboundStatus.scenario_count ?? 0}; line_push_performed=${lineInboundStatus.line_push_performed ? "yes" : "no"}; customer_data_mutation_performed=${lineInboundStatus.customer_data_mutation_performed ? "yes" : "no"}; data_lp_events_write_performed=${lineInboundStatus.data_lp_events_write_performed ? "yes" : "no"}.`,
    },
    {
      requirement: "Manual publish evidence browser form prepares owner evidence input without network calls or live writes.",
      status: manualPublishEvidenceFormStatus.ok && manualPublishEvidenceFormStatus.browser_only && !manualPublishEvidenceFormStatus.network_calls_performed && !manualPublishEvidenceFormStatus.post_url_fetch_performed && !manualPublishEvidenceFormStatus.live_input_files_created && manualPublishEvidenceFormFixtureStatus.ok && !manualPublishEvidenceFormFixtureStatus.data_lp_events_write_performed && !manualPublishEvidenceFormFixtureStatus.external_effect ? "local_verified_browser_form" : "not_ready",
      evidence: `data/manual_publish_evidence_form_status.json status=${manualPublishEvidenceFormStatus.status ?? "unknown"}; packets=${manualPublishEvidenceFormStatus.packet_count ?? 0}; browser_only=${manualPublishEvidenceFormStatus.browser_only ? "yes" : "no"}; network_calls=${manualPublishEvidenceFormStatus.network_calls_performed ? "yes" : "no"}; post_url_fetch=${manualPublishEvidenceFormStatus.post_url_fetch_performed ? "yes" : "no"}; live_input_files_created=${manualPublishEvidenceFormStatus.live_input_files_created ? "yes" : "no"}; fixture=${manualPublishEvidenceFormFixtureStatus.ok ? "ok" : "not_ready"}; scenarios=${manualPublishEvidenceFormFixtureStatus.scenario_count ?? 0}; data_lp_events_write_performed=${manualPublishEvidenceFormFixtureStatus.data_lp_events_write_performed ? "yes" : "no"}; external_effect=${manualPublishEvidenceFormFixtureStatus.external_effect ? "yes" : "no"}.`,
    },
    {
      requirement: "Score, rank, winners/losers, and preserve champion when sample is insufficient.",
      status: "local_prepared",
      evidence: `growth_scores.json generated; ab_test_status=${abStatus.status}; champion retained when sample_threshold_met=false.`,
    },
    {
      requirement: "Draft content variants while changing only one variable.",
      status: contentVariants.one_variable_rule_ok ? "local_prepared" : "failed",
      evidence: `changed_variable=${contentVariants.changed_variable}; drafts=${contentVariants.drafts.length}.`,
    },
    {
      requirement: "Content variants have unique post-level tracking links and attribution breakdown.",
      status: funnelBreakdown.mode === "content_variant_attribution" && funnelBreakdown.summary.content_variant_links === contentVariants.drafts.length ? "local_prepared" : "failed",
      evidence: `funnel_breakdown.json rows=${funnelBreakdown.summary.rows}; content_variant_links=${funnelBreakdown.summary.content_variant_links}; real_events=${funnelBreakdown.summary.real_events}; public_link_change_performed=${funnelBreakdown.public_link_change_performed ? "yes" : "no"}.`,
    },
    {
      requirement: "Decide the next seven-day iteration without violating one-variable-per-round or sample-insufficient gates.",
      status: nextRoundPlan.next_round.one_variable_rule_ok && !nextRoundPlan.next_round.public_link_change_performed ? "local_prepared" : "failed",
      evidence: `next_round_plan.json decision=${nextRoundPlan.decision}; current_variable=${nextRoundPlan.current_round.changed_variable}; next_variable=${nextRoundPlan.next_round.changed_variable}; start_new_variable_round=${nextRoundPlan.next_round.start_new_variable_round ? "yes" : "no"}; sample_threshold_met=${nextRoundPlan.sample_gate.sample_threshold_met ? "yes" : "no"}.`,
    },
    {
      requirement: "Generate landing page challenger and candidate Worker.",
      status: workerDryRunStatus.ok && !workerDryRunStatus.production_deploy_performed ? "local_prepared_and_dry_run_verified" : "local_prepared_needs_dry_run",
      evidence: `landing_page_candidate.html and worker.ts generated; worker_dry_run_status ok=${workerDryRunStatus.ok ? "yes" : "no"}; dry_run_exit=${workerDryRunStatus.dry_run_exit_observed ? "yes" : "no"}; production_deploy_performed=${workerDryRunStatus.production_deploy_performed ? "yes" : "no"}; report=${workerDryRunStatus.report_path ?? "worker_dry_run.md"}.`,
    },
    {
      requirement: "Prepare a source-locked live champion contact repair with privacy-safe telemetry and an isolated two-Worker smoke.",
      status: "local_prepared_and_isolated_smoke_verified",
      evidence: "champion_integration_candidate.md, champion_integration_smoke.md, cloudflare_d1_readiness.md, champion_local_branch.md, champion_release_preflight.md, and champion_release_owner_packet.md; the patch is committed locally from the exact source lock, D1 prerequisites are metadata-verified, production CLI flags pass dry-run, and push/deploy/public-link changes remain blocked.",
    },
    {
      requirement: "Prepare A/B small traffic without public link changes.",
      status: "local_prepared_human_link_gate",
      evidence: `${abStatus.routing_endpoint}; allocation ${abStatus.traffic_allocation.champion}/${abStatus.traffic_allocation.challenger}; public_link_change_performed=false.`,
    },
    {
      requirement: "Retire non-main candidates without deleting data or changing public links.",
      status: "local_prepared",
      evidence: `candidate_retirement_queue.json status=${retirementQueue.status}; retirement_ready=${retirementQueue.summary.retirement_ready}; no_data_delete=true.`,
    },
    {
      requirement: "Weekly Sunday sequence represented end to end.",
      status: pipelineStatus.all_steps_represented ? "local_prepared" : "failed",
      evidence: `pipeline_status.json steps=${pipelineStatus.steps.length}; schedule target is Sunday Taipei via wrangler cron.`,
    },
    {
      requirement: "Weekly local runner and install-safe schedule template exist.",
      status: scheduleStatus.launchd_installed ? "installed" : "local_template_ready_not_installed",
      evidence: `data/schedule_status.json command=${scheduleStatus.local_runner_command}; launchd_template=${scheduleStatus.launchd_template}; launchd_installed=${scheduleStatus.launchd_installed ? "yes" : "no"}; file_installed=${scheduleStatus.file_installed ? "yes" : "no"}; service_loaded=${scheduleStatus.service_loaded ? "yes" : "no"}; last_runner_status=${scheduleStatus.runner_status.status}; rollback=${scheduleStatus.launchagent_status.rollback_command}.`,
    },
    {
      requirement: "Browser/route smoke verifies local Worker candidate, candidate page, A/B status, and champion placeholder gate without event writes.",
      status: browserSmokeStatus.ok && !browserSmokeStatus.event_write_performed ? "local_verified" : "not_ready",
      evidence: `data/browser_smoke_status.json ok=${browserSmokeStatus.ok ? "yes" : "no"}; checks=${pipelineStatus.browser_smoke_status.checks_passed}/${pipelineStatus.browser_smoke_status.checks_total}; event_write_performed=${browserSmokeStatus.event_write_performed ? "yes" : "no"}; log=${browserSmokeStatus.log_path ?? "n/a"}.`,
    },
    {
      requirement: "Generated tracking links redirect correctly in isolated local smoke without following external URLs or writing real events.",
      status: trackingLinkSmokeStatus.ok && !trackingLinkSmokeStatus.real_event_write_performed && !trackingLinkSmokeStatus.data_lp_events_write_performed ? "local_verified_isolated_fixture" : "not_ready",
      evidence: `data/tracking_link_smoke_status.json ok=${trackingLinkSmokeStatus.ok ? "yes" : "no"}; links=${trackingLinkSmokeStatus.links_checked ?? 0}/${trackingLinkSmokeStatus.expected_link_count ?? trackingLinks.links.length}; isolated_link_click_events=${trackingLinkSmokeStatus.isolated_link_click_events_written ?? 0}; real_event_write_performed=${trackingLinkSmokeStatus.real_event_write_performed ? "yes" : "no"}; data_lp_events_write_performed=${trackingLinkSmokeStatus.data_lp_events_write_performed ? "yes" : "no"}; log=${trackingLinkSmokeStatus.log_path ?? "n/a"}.`,
    },
    {
      requirement: "Worker event contract accepts funnel events and rejects sensitive metadata in isolated local D1.",
      status: eventContractSmokeStatus.ok && !eventContractSmokeStatus.real_event_write_performed && !eventContractSmokeStatus.data_lp_events_write_performed ? "local_verified_isolated_fixture" : "not_ready",
      evidence: `data/event_contract_smoke_status.json ok=${eventContractSmokeStatus.ok ? "yes" : "no"}; synthetic_counts=${JSON.stringify(eventContractSmokeStatus.event_type_counts ?? {})}; sensitive_rejection=${eventContractSmokeStatus.sensitive_rejection?.ok ? "yes" : "no"}; invalid_event_rejection=${eventContractSmokeStatus.invalid_event_rejection?.ok ? "yes" : "no"}; real_event_write_performed=${eventContractSmokeStatus.real_event_write_performed ? "yes" : "no"}; data_lp_events_write_performed=${eventContractSmokeStatus.data_lp_events_write_performed ? "yes" : "no"}.`,
    },
    {
      requirement: "Win-rule fixtures cover sample-insufficient, human-promotion-only, underperform, and quality-regression paths.",
      status: winRuleFixtureStatus.ok && !winRuleFixtureStatus.real_event_write_performed ? "local_verified" : "not_ready",
      evidence: `data/win_rule_fixture_status.json ok=${winRuleFixtureStatus.ok ? "yes" : "no"}; scenarios=${winRuleFixtureStatus.scenario_count ?? 0}; real_event_write_performed=${winRuleFixtureStatus.real_event_write_performed ? "yes" : "no"}; challenger_promotion_performed=${winRuleFixtureStatus.challenger_promotion_performed ? "yes" : "no"}.`,
    },
    {
      requirement: "Weekly evidence archive preserves reports, scores, approval queue, A/B status, candidate, dry-run states, and red-line evidence.",
      status: weekArchiveStatus.ok && weekArchiveStatus.immutable_snapshot ? "local_snapshot_ready" : "present_after_archive_run",
      evidence: `data/week_archive_status.json ok=${weekArchiveStatus.ok ? "yes" : "no"}; files=${weekArchiveStatus.files_archived ?? 0}/${weekArchiveStatus.expected_files ?? 0}; missing=${(weekArchiveStatus.missing_files ?? []).length}; archive_dir=${weekArchiveStatus.archive_dir ?? "n/a"}; external_effect=false.`,
    },
    {
      requirement: "GitHub handoff exists without external push or PR creation.",
      status: "prepared_but_blocked",
      evidence: "champion_local_branch.md proves the source patch has a clean local feature commit with no remote branch; github_handoff.md covers the separate engine bundle; approval_queue.json and prepared_but_blocked.json retain the GitHub push/PR gate.",
    },
    {
      requirement: "Owner approval pack exists for D1, Worker deploy, public A/B routing, GitHub, and manual-only actions.",
      status: launchReadiness.status === "owner_approval_required" ? "prepared_but_blocked" : "local_ready",
      evidence: `owner_approval_pack.md and launch_readiness.json generated; pending_human_approvals=${launchReadiness.pending_human_approval_count}; local_preflight_ok=${launchReadiness.local_preflight_ok ? "yes" : "no"}.`,
    },
    {
      requirement: "Prohibited external actions are not performed.",
      status: "verified_not_performed",
      evidence: "pipeline_status.json flags production_deploy/formal_post/line_push/customer_data/payment/delete=false; prepared_but_blocked.json queues redlines.",
    },
    {
      requirement: "Full seven-day automatic flywheel is live.",
      status: "not_complete_data_and_external_gates",
      evidence: "P0/P1/trusted-scoring evidence is incomplete; remote D1 creation, production deploy, and public small-traffic routing remain owner-gated.",
    },
  ];

  const outputRows = explicitOutputs.map(([artifact, status]) => `| ${artifact} | ${status} |`).join("\n");
  const checkRows = checks.map((item) => `| ${item.requirement} | ${item.status} | ${item.evidence} |`).join("\n");
  const blockedRows = blocked.items
    .map((item) => `| ${item.action} | ${item.blocked_by} | ${item.prepared_artifact ?? "n/a"} |`)
    .join("\n");
  const approvalRows = approvalQueue.items
    .map((item) => `| ${item.id} | ${item.status} | ${item.human_gate} |`)
    .join("\n");
  const dataEvidenceRows = (blocked.data_evidence_gates ?? [])
    .map((gate) => `| ${gate.id} | ${gate.status} | ${gate.blocking_completion ? "yes" : "no"} | ${JSON.stringify(gate.observed ?? {})} | ${gate.prepared_artifact} |`)
    .join("\n");

  return `# 3Q Growth Loop Goal Completion Audit

BLUF: Overall: not_complete_data_and_external_gates. Local Week 0 automation is prepared, but the full seven-day acquisition flywheel is not proven until P0/P1/trusted-scoring evidence is complete and owner-gated remote effects are approved.

Generated: ${now.toISOString()}
Week: ${week.start} to ${week.end}
Mode: ${config.mode}

## Overall

- Overall: not_complete_data_and_external_gates
- Reason: required P0/P1/trusted-scoring evidence is incomplete, and external deployment and public traffic effects remain blocked.
- Current real events observed by local JSONL runner: ${events.length}
- Latest D1 sync: ${d1SyncStatus.ok ? "ok" : "not_ready"} / scope=${d1SyncStatus.scope ?? "unknown"} / rows=${d1SyncStatus.rows_exported ?? 0}
- Latest D1 guard: scoring_allowed=${d1SyncStatus.scoring_input_allowed ? "yes" : "no"} / smoke_rows=${d1SyncStatus.synthetic_or_smoke_row_count ?? 0} / policy=${d1SyncStatus.scoring_policy ?? "unknown"}
- Event input quality gate: ${eventInputQualityStatus.ok ? "ok" : "blocked"} / rows=${eventInputQualityStatus.rows_scanned ?? 0} / issues=${(eventInputQualityStatus.issues ?? []).length} / sensitive=${eventInputQualityStatus.pii_or_sensitive_data_detected ? "yes" : "no"}
- Full funnel aggregate import: ${funnelAggregateStatus.ok ? "ok" : "not_ready"} / mode=${funnelAggregateStatus.mode ?? "unknown"} / preview_events=${funnelAggregateStatus.mode === "full_funnel_preview" ? funnelAggregateStatus.events_written ?? 0 : 0} / apply_performed=${funnelAggregateStatus.apply_performed ? "yes" : "no"} / data_lp_events_write_performed=${funnelAggregateStatus.data_lp_events_write_performed ? "yes" : "no"}
- Real-data apply guard: ${realDataApplyFixtureStatus.ok ? "ok" : "not_ready"} / mode=${realDataApplyFixtureStatus.mode ?? "unknown"} / scenarios=${realDataApplyFixtureStatus.scenario_count ?? 0} / data_lp_events_write_performed=${realDataApplyFixtureStatus.data_lp_events_write_performed ? "yes" : "no"}
- Real-data decision replay: ${realDataDecisionReplayStatus.ok ? "ok" : "not_ready"} / mode=${realDataDecisionReplayStatus.mode ?? "unknown"} / scenarios=${realDataDecisionReplayStatus.scenario_count ?? 0} / ledger=${realDataDecisionReplayStatus.source_capture_ledger_replay_executed ? "yes" : "no"} / compile=${realDataDecisionReplayStatus.source_capture_compile_commands_executed ? "yes" : "no"} / data_lp_events_write_performed=${realDataDecisionReplayStatus.data_lp_events_write_performed ? "yes" : "no"} / external_effect=${realDataDecisionReplayStatus.external_effect ? "yes" : "no"}
- Source readiness: ${sourceReadinessStatus.ok ? "ok" : "not_ready"} / status=${sourceReadinessStatus.status ?? "unknown"} / missing_stages=${sourceReadinessStatus.missing_stage_count ?? 0} / public_ready=${sourceReadinessStatus.ready_for_public_iteration_decision ? "yes" : "no"} / data_lp_events_write_performed=${sourceReadinessStatus.data_lp_events_write_performed ? "yes" : "no"}
- Source capture pack: ${sourceCaptureStatus.ok ? "ok" : "not_ready"} / rows=${sourceCaptureStatus.ledger_rows ?? 0} / importable_links=${sourceCaptureStatus.importable_tracking_links ?? 0} / live_inputs=${sourceCaptureStatus.live_input_files_created ? "yes" : "no"} / data_lp_events_write_performed=${sourceCaptureStatus.data_lp_events_write_performed ? "yes" : "no"}
- Source capture compile: ${sourceCaptureCompileStatus.ok ? "ok" : "not_ready"} / status=${sourceCaptureCompileStatus.status ?? "unknown"} / input_kind=${sourceCaptureCompileStatus.input_kind ?? "unknown"} / filled_rows=${sourceCaptureCompileStatus.filled_rows ?? 0} / preview_rows=${(sourceCaptureCompileStatus.funnel_rows ?? 0) + (sourceCaptureCompileStatus.manual_rows ?? 0)} / data_lp_events_write_performed=${sourceCaptureCompileStatus.data_lp_events_write_performed ? "yes" : "no"}
- Source capture compile fixtures: ${sourceCaptureCompileFixtureStatus.ok ? "ok" : "not_ready"} / scenarios=${sourceCaptureCompileFixtureStatus.scenario_count ?? 0} / data_lp_events_write_performed=${sourceCaptureCompileFixtureStatus.data_lp_events_write_performed ? "yes" : "no"}
- Real-data intake plan: ${realDataIntakeStatus.ok ? "ok" : "not_ready"} / status=${realDataIntakeStatus.status ?? "unknown"} / ready_apply=${realDataIntakeStatus.ready_apply_count ?? 0} / missing_inputs=${realDataIntakeStatus.missing_input_count ?? 0} / data_lp_events_write_performed=${realDataIntakeStatus.data_lp_events_write_performed ? "yes" : "no"}
- Data collection brief: ${dataCollectionBriefStatus.ok ? "ok" : "not_ready"} / status=${dataCollectionBriefStatus.status ?? "unknown"} / tasks=${dataCollectionBriefStatus.task_count ?? 0} / data_lp_events_write_performed=${dataCollectionBriefStatus.data_lp_events_write_performed ? "yes" : "no"}
- Data collection progress: ${dataCollectionProgressStatus.ok ? "ok" : "not_ready"} / status=${dataCollectionProgressStatus.status ?? "unknown"} / tasks=${dataCollectionProgressStatus.filled_task_count ?? 0}/${dataCollectionProgressStatus.total_task_count ?? 0} / pending=${dataCollectionProgressStatus.pending_task_count ?? 0} / p0_pending=${dataCollectionProgressStatus.p0_pending_count ?? 0} / p1_pending=${dataCollectionProgressStatus.p1_pending_count ?? 0} / data_lp_events_write_performed=${dataCollectionProgressStatus.data_lp_events_write_performed ? "yes" : "no"} / external_effect=${dataCollectionProgressStatus.external_effect ? "yes" : "no"}
- Next P0 owner form: ${nextP0OwnerFormStatus.ok ? "ok" : "not_ready"} / status=${nextP0OwnerFormStatus.status ?? "unknown"} / rows=${nextP0OwnerFormStatus.row_count ?? 0} / browser_only=${nextP0OwnerFormStatus.browser_only ? "yes" : "no"} / fixture=${nextP0OwnerFormFixtureStatus.ok ? "ok" : "not_ready"} / scenarios=${nextP0OwnerFormFixtureStatus.scenario_count ?? 0} / data_lp_events_write_performed=${nextP0OwnerFormStatus.data_lp_events_write_performed ? "yes" : "no"} / external_effect=${nextP0OwnerFormStatus.external_effect ? "yes" : "no"}
- Next P0 owner intake: ${nextP0OwnerIntakeStatus.ok ? "ok" : "not_ready"} / status=${nextP0OwnerIntakeStatus.status ?? "unknown"} / found=${nextP0OwnerIntakeStatus.candidate_found ? "yes" : "no"} / preview_rows=${(nextP0OwnerIntakeStatus.funnel_preview_rows ?? 0) + (nextP0OwnerIntakeStatus.manual_preview_rows ?? 0)} / staged=${nextP0OwnerIntakeStatus.stage_performed ? "yes" : "no"} / fixture=${nextP0OwnerIntakeFixtureStatus.ok ? "ok" : "not_ready"} / scenarios=${nextP0OwnerIntakeFixtureStatus.scenario_count ?? 0} / data_lp_events_write_performed=${nextP0OwnerIntakeStatus.data_lp_events_write_performed ? "yes" : "no"} / external_effect=${nextP0OwnerIntakeStatus.external_effect ? "yes" : "no"}
- Sample gate plan: ${dataCollectionBriefStatus.sample_gate_status ?? "unknown"} / p0_tasks=${dataCollectionBriefStatus.sample_gate_p0_task_count ?? 0} / p0_links=${dataCollectionBriefStatus.sample_gate_p0_link_count ?? 0}
- Manual conversion import: ${manualConversionStatus.ok ? "ok" : "not_ready"} / mode=${manualConversionStatus.mode ?? "unknown"} / preview_events=${manualConversionStatus.mode === "preview" ? manualConversionStatus.events_written ?? 0 : 0} / apply_performed=${manualConversionStatus.apply_performed ? "yes" : "no"}
- LINE inbound playbook: ${lineInboundStatus.ok ? "ok" : "not_ready"} / scenarios=${lineInboundStatus.scenario_count ?? 0} / line_push_performed=${lineInboundStatus.line_push_performed ? "yes" : "no"} / customer_data_mutation_performed=${lineInboundStatus.customer_data_mutation_performed ? "yes" : "no"}
- Manual publish evidence form: ${manualPublishEvidenceFormStatus.ok ? "ok" : "not_ready"} / status=${manualPublishEvidenceFormStatus.status ?? "unknown"} / browser_only=${manualPublishEvidenceFormStatus.browser_only ? "yes" : "no"} / network_calls=${manualPublishEvidenceFormStatus.network_calls_performed ? "yes" : "no"} / url_fetch=${manualPublishEvidenceFormStatus.post_url_fetch_performed ? "yes" : "no"} / live_inputs=${manualPublishEvidenceFormStatus.live_input_files_created ? "yes" : "no"}
- Manual publish evidence form fixtures: ${manualPublishEvidenceFormFixtureStatus.ok ? "ok" : "not_ready"} / scenarios=${manualPublishEvidenceFormFixtureStatus.scenario_count ?? 0} / data_lp_events_write_performed=${manualPublishEvidenceFormFixtureStatus.data_lp_events_write_performed ? "yes" : "no"} / external_effect=${manualPublishEvidenceFormFixtureStatus.external_effect ? "yes" : "no"}
- Weekly local runner: ${scheduleStatus.runner_status.status} / launchd_installed=${scheduleStatus.launchd_installed ? "yes" : "no"} / install_performed=${scheduleStatus.install_performed ? "yes" : "no"}
- Worker dry run: ${workerDryRunStatus.ok ? "ok" : "not_ready"} / dry_run_exit=${workerDryRunStatus.dry_run_exit_observed ? "yes" : "no"} / production_deploy_performed=${workerDryRunStatus.production_deploy_performed ? "yes" : "no"} / external_effect=${workerDryRunStatus.external_effect ? "yes" : "no"}
- Browser smoke: ${browserSmokeStatus.ok ? "ok" : "not_ready"} / checks=${pipelineStatus.browser_smoke_status.checks_passed}/${pipelineStatus.browser_smoke_status.checks_total} / event_write_performed=${browserSmokeStatus.event_write_performed ? "yes" : "no"}
- Tracking link smoke: ${trackingLinkSmokeStatus.ok ? "ok" : "not_ready"} / links=${trackingLinkSmokeStatus.links_checked ?? 0}/${trackingLinkSmokeStatus.expected_link_count ?? trackingLinks.links.length} / real_event_write_performed=${trackingLinkSmokeStatus.real_event_write_performed ? "yes" : "no"}
- Event contract smoke: ${eventContractSmokeStatus.ok ? "ok" : "not_ready"} / synthetic_counts=${JSON.stringify(eventContractSmokeStatus.event_type_counts ?? {})} / real_event_write_performed=${eventContractSmokeStatus.real_event_write_performed ? "yes" : "no"}
- Win-rule fixtures: ${winRuleFixtureStatus.ok ? "ok" : "not_ready"} / scenarios=${winRuleFixtureStatus.scenario_count ?? 0} / real_event_write_performed=${winRuleFixtureStatus.real_event_write_performed ? "yes" : "no"}
- Week archive: ${weekArchiveStatus.ok ? "ok" : "not_ready"} / files=${weekArchiveStatus.files_archived ?? 0}/${weekArchiveStatus.expected_files ?? 0} / immutable_snapshot=${weekArchiveStatus.immutable_snapshot ? "yes" : "no"}
- Next round plan: ${nextRoundPlan.status} / decision=${nextRoundPlan.decision} / next_variable=${nextRoundPlan.next_round.changed_variable}
- Funnel breakdown: ${funnelBreakdown.mode} / rows=${funnelBreakdown.summary.rows} / content_variant_links=${funnelBreakdown.summary.content_variant_links} / real_events=${funnelBreakdown.summary.real_events}
- Owner approval pack: ${launchReadiness.status} / pending=${launchReadiness.pending_human_approval_count} / local_preflight_ok=${launchReadiness.local_preflight_ok ? "yes" : "no"}
- Champion retained: ${scores.assets.some((asset) => asset.role === "champion" && asset.decision === "keep_champion_until_challenger_beats_rule") ? "yes" : "no"}
- Challenger promotion performed: no
- Production deploy performed: no
- Public link change performed: no
- Formal post / LINE push performed: no
- Customer data / payment / delete action performed: no

## Data Evidence Gates

| gate | status | blocks completion | observed | artifact |
|---|---|---|---|---|
${dataEvidenceRows}

## Requirement Audit

| requirement | status | evidence |
|---|---|---|
${checkRows}

## Artifact Audit

| artifact | status |
|---|---|
${outputRows}

## Red-Line Queue

| action | blocked_by | prepared_artifact |
|---|---|---|
${blockedRows}

## Approval Queue

| id | status | human_gate |
|---|---|---|
${approvalRows}

## Next Verification Command

\`\`\`zsh
cd /Users/mac/Documents/Codex/control-center/3q-growth-loop
npm run verify
npm run browser:smoke
npm run worker:dry-run:status
\`\`\`
`;
}

function renderFunnelBreakdownMarkdown(funnelBreakdown, now) {
  const rows = funnelBreakdown.rows
    .map((row) => `| ${row.role} | ${row.asset_id} | ${row.content_id} | ${row.variant_id} | ${row.source} | ${row.medium} | ${row.campaign} | ${row.link_clicks} | ${row.line_adds} | ${row.leads} | ${row.deals} | ${row.line_adds_per_100_clicks ?? "n/a"} | ${row.leads_per_100_clicks ?? "n/a"} | ${row.deals_per_100_clicks ?? "n/a"} | ${row.sample_threshold_met ? "yes" : "no"} |`)
    .join("\n");

  return `# 3Q Growth Loop Funnel Breakdown

BLUF: This file groups the funnel by asset, content_id, variant_id, source, medium, and campaign so post drafts can be attributed to LINE adds, leads, and deals once real events arrive. It performs no post, deploy, public link change, LINE push, payment, customer-data mutation, or deletion.

Generated: ${now.toISOString()}
Week: ${funnelBreakdown.week.start} to ${funnelBreakdown.week.end}
Mode: ${funnelBreakdown.mode}
Changed variable: ${funnelBreakdown.changed_variable}
Content variant links: ${funnelBreakdown.summary.content_variant_links}
Rows: ${funnelBreakdown.summary.rows}
Real events: ${funnelBreakdown.summary.real_events}
External effect: no

## Per 100 Click Attribution

| role | asset_id | content_id | variant_id | source | medium | campaign | clicks | LINE adds | leads | deals | LINE adds / 100 | leads / 100 | deals / 100 | sample_met |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
${rows}

## Safety

- Formal post performed: no
- Public link change performed: no
- Production deploy performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
`;
}

function renderContentVariantsMarkdown(config, contentVariants, trackingLinks, now) {
  const drafts = contentVariants.drafts
    .map(
      (draft) => `## ${draft.variant_id}

- Surface: ${draft.surface}
- Changed variable: ${draft.changed_variable}
- CTA: ${draft.cta_text}
- Tracking URL: ${draft.tracking_url}
- Gate: ${draft.final_gate}

\`\`\`text
${draft.draft_caption}

CTA：${draft.cta_text}
候選連結：${draft.tracking_url}

Draft only. 正式發布、排程、Broadcast、Send、主連結變更前，學誼最後確認。
\`\`\`
`,
    )
    .join("\n");

  return `# 3Q Growth Loop Content Variants

BLUF: 本檔只產生內容變體草稿；沒有正式發文、排程、外送或改主連結。

Generated: ${now.toISOString()}
Round: ${config.current_round.round_id}
Changed variable: ${contentVariants.changed_variable}
One-variable rule: ${contentVariants.one_variable_rule_ok ? "pass" : "fail"}

Locked variables:

- Hook: ${contentVariants.locked_variables.hook}
- Offer: ${contentVariants.locked_variables.offer}
- Visual claim: ${contentVariants.locked_variables.visual_claim}

${drafts}
`;
}

function renderNextRoundPlanMarkdown(nextRoundPlan, now) {
  return `# 3Q Growth Loop Next Round Plan

BLUF: ${nextRoundPlan.rationale}

Generated: ${now.toISOString()}
Week: ${nextRoundPlan.week.start} to ${nextRoundPlan.week.end}

## Decision

- Decision: ${nextRoundPlan.decision}
- Status: ${nextRoundPlan.status}
- Current round: ${nextRoundPlan.current_round.round_id}
- Current changed variable: ${nextRoundPlan.current_round.changed_variable}
- Next round: ${nextRoundPlan.next_round.round_id}
- Next changed variable: ${nextRoundPlan.next_round.changed_variable}
- Start new variable round: ${nextRoundPlan.next_round.start_new_variable_round ? "yes" : "no"}
- One-variable rule: ${nextRoundPlan.next_round.one_variable_rule_ok ? "pass" : "fail"}
- Candidate action: ${nextRoundPlan.candidate_action}

## Sample Gate

| metric | observed | required | gap |
|---|---:|---:|---:|
| visits | ${nextRoundPlan.sample_gate.observed_visits} | ${nextRoundPlan.sample_gate.min_visits} | ${nextRoundPlan.sample_gate.gaps.visits} |
| cta_clicks | ${nextRoundPlan.sample_gate.observed_cta_clicks} | ${nextRoundPlan.sample_gate.min_cta_clicks} | ${nextRoundPlan.sample_gate.gaps.cta_clicks} |
| line_adds | ${nextRoundPlan.sample_gate.observed_line_adds} | ${nextRoundPlan.sample_gate.min_line_adds} | ${nextRoundPlan.sample_gate.gaps.line_adds} |
| test_days | ${nextRoundPlan.sample_gate.observed_test_days} | ${nextRoundPlan.sample_gate.min_test_days} | ${nextRoundPlan.sample_gate.gaps.test_days} |

Preferred test days: ${nextRoundPlan.sample_gate.preferred_test_days}

## Win Gate

- Metric: ${nextRoundPlan.win_gate.metric}
- Required lift: ${nextRoundPlan.win_gate.challenger_lift_required}
- Current lift: ${nextRoundPlan.win_gate.lift ?? "n/a"}
- Challenger win rule met: ${nextRoundPlan.win_gate.challenger_win_rule_met ? "yes" : "no"}
- No quality regression: ${nextRoundPlan.win_gate.no_quality_regression ? "yes" : "no"}

## Draft Brief

- Mode: ${nextRoundPlan.draft_brief.mode}
- Changed variable: ${nextRoundPlan.draft_brief.changed_variable}
- Instruction: ${nextRoundPlan.draft_brief.instruction}
- Locked variables policy: ${nextRoundPlan.draft_brief.locked_variables_policy}

## Approval Gate

- Review required: ${nextRoundPlan.approval_gate.review_required ? "yes" : "no"}
- Artifact: ${nextRoundPlan.approval_gate.artifact}
- Human gate: ${nextRoundPlan.approval_gate.human_gate}
- External effect: none

## Safety Invariants

- External send: no
- Production deploy: no
- Primary link change: no
- Champion promotion: no
- LINE push: no
- Payment action: no
- Customer data mutation: no
- Data delete: no
`;
}

function renderGitHubHandoff(config, scheduleStatus, funnelBreakdown, now) {
  return `# 3Q Growth Loop GitHub Handoff

BLUF: This file covers only the standalone control-center engine bundle, which still has no approved target repository. The live 3q-site code path already has a separate known-repository handoff in champion_github_handoff.md; do not use the git-init commands below for that Champion patch.

Generated: ${now.toISOString()}
Operator: ${config.operator}
Mode: ${config.mode}
Suggested branch: ang/3q-growth-loop-week0
Suggested PR title: 3Q Growth Loop Week 0 local engine

## Current State

- Local runner: ${scheduleStatus.local_runner_command}
- LaunchAgent installed: ${scheduleStatus.launchd_installed ? "yes" : "no"}
- LaunchAgent rollback: ${scheduleStatus.launchagent_status.rollback_command}
- Funnel breakdown: ${funnelBreakdown.summary.content_variant_links} post-level links / ${funnelBreakdown.summary.rows} attribution rows
- Production deploy performed: no
- Public link change performed: no
- Formal post / LINE push performed: no
- Customer data / payment / delete action performed: no

## Suggested Commit Message

\`\`\`text
Build 3Q growth loop Week 0 local engine
\`\`\`

## Suggested PR Summary

\`\`\`markdown
## Summary

- Add Week 0 acquisition-loop artifacts for 3Q: D1 schema, event model, scoring, weekly report, approval queue, A/B status, candidate page, and Worker candidate.
- Add preview-only full-funnel aggregate import for link clicks, visits, CTA clicks, LINE adds, leads, deals, and quality flags.
- Add privacy-safe manual conversion preview for LINE adds, lead submits, deals, and quality flags.
- Add inbound-only LINE customer-service playbook and fixture guard for aggregate-only lead/deal handoff.
- Add post-level content attribution via unique content_id / variant_id tracking links plus funnel_breakdown artifacts.
- Add local weekly runner plus macOS LaunchAgent status so the safe local loop can run every Sunday.
- Add GitHub Actions weekly verification workflow that runs npm run verify and uploads review artifacts without deploy or send actions.
- Preserve hard gates for production deploy, public links, formal posts, LINE push, ECPay, customer data, and deletion.

## Verification

- npm run goal:audit
- npm run verify
- npm run worker:dry-run
- plutil -lint launchd/com.angelia.3q-growth-loop.weekly.plist

## Human Gates

- Confirm target GitHub repo before push / PR.
- Review .github/workflows/3q-growth-loop-weekly.yml before enabling scheduled GitHub runs on a default branch.
- Approve Cloudflare remote D1 and production Worker deploy.
- Approve current champion URL and any public A/B route.
- Manually publish posts / broadcasts and review customer-data or payment actions separately.
\`\`\`

## Owner-Gated Commands

These commands apply only to the standalone engine bundle. Do not run them until the owner confirms a separate target repository and whether this folder should become its own repo or be copied into an existing repo. For the existing 3q-site repository, use champion_github_handoff.md instead.

\`\`\`zsh
cd /Users/mac/Documents/Codex/control-center/3q-growth-loop
git init
git checkout -b ang/3q-growth-loop-week0
git add .
git commit -m "Build 3Q growth loop Week 0 local engine"
git remote add origin <OWNER_APPROVED_GITHUB_REPO_URL>
git push -u origin ang/3q-growth-loop-week0
gh pr create --draft --title "3Q Growth Loop Week 0 local engine" --body-file github_handoff.md
\`\`\`

## Rollback

\`\`\`zsh
cd /Users/mac/Documents/Codex/control-center/3q-growth-loop
npm run schedule:uninstall
\`\`\`
`;
}

function renderOwnerApprovalPack(config, launchReadiness, approvalQueue, blocked, abStatus, scheduleStatus, funnelBreakdown, sourceReadinessStatus, sourceCaptureStatus, sourceCaptureCompileStatus, sourceCaptureCompileFixtureStatus, realDataIntakeStatus, dataCollectionBriefStatus, dataCollectionProgressStatus, nextP0OwnerFormStatus, nextP0OwnerFormFixtureStatus, nextP0OwnerIntakeStatus, nextP0OwnerIntakeFixtureStatus, realDataDecisionReplayStatus, workerDryRunStatus, manualPublishEvidenceFormStatus, manualPublishEvidenceFormFixtureStatus, now) {
  const approvalRows = approvalQueue.items
    .map((item) => `| ${item.id} | ${item.risk_tier} | ${item.status} | ${item.artifact} | ${item.human_gate} |`)
    .join("\n");

  const gateRows = launchReadiness.owner_gates
    .map((gate) => `| ${gate.id} | ${gate.risk_tier} | ${gate.status} | ${gate.prepared_artifact ?? "n/a"} | ${gate.current_blocker} |`)
    .join("\n");

  const commandBlocks = launchReadiness.owner_gates
    .filter((gate) => gate.resume_commands.length > 0)
    .map(
      (gate) => `## ${gate.id}

Status: ${gate.status}
Approval id: ${gate.approval_id ?? "manual-only"}
Owner action: ${gate.owner_action}
Rollback: ${gate.rollback}

\`\`\`zsh
${gate.resume_commands.join("\n")}
\`\`\`
`,
    )
    .join("\n");

  const blockedRows = blocked.items
    .map((item) => `| ${item.action} | ${item.blocked_by} | ${item.prepared_artifact ?? "n/a"} | ${item.resume_when} |`)
    .join("\n");

  return `# 3Q Growth Loop Owner Approval Pack

BLUF: Local Week 0 is ready for owner review, but the live acquisition flywheel is still blocked by owner-only external gates. Do not run the remote, deploy, public link, GitHub push, posting, LINE, payment, customer-data, or delete actions until the matching gate is explicitly approved.

Generated: ${now.toISOString()}
Operator: ${config.operator}
Mode: ${config.mode}
Status: ${launchReadiness.status}
Local preflight: ${launchReadiness.local_preflight_ok ? "pass" : "attention required"}
Pending human approvals: ${launchReadiness.pending_human_approval_count}

## Current Evidence

- Weekly runner: ${scheduleStatus.runner_status.status}
- Weekly runner log: ${scheduleStatus.runner_status.log_path ?? "n/a"}
- Local schedule: ${scheduleStatus.local_schedule.weekday} ${String(scheduleStatus.local_schedule.hour).padStart(2, "0")}:${String(scheduleStatus.local_schedule.minute).padStart(2, "0")} ${scheduleStatus.local_schedule.timezone}
- LaunchAgent installed: ${scheduleStatus.launchd_installed ? "yes" : "no"}
- Browser smoke: ${launchReadiness.evidence.browser_smoke_ok ? "ok" : "not_ready"} / checks=${launchReadiness.evidence.browser_smoke_checks}
- Worker dry run: ${workerDryRunStatus.ok ? "ok" : "not_ready"} / dry_run_exit=${workerDryRunStatus.dry_run_exit_observed ? "yes" : "no"} / production_deploy=${workerDryRunStatus.production_deploy_performed ? "yes" : "no"} / report=${workerDryRunStatus.report_path ?? "worker_dry_run.md"}
- Tracking link smoke: ${launchReadiness.evidence.tracking_link_smoke_ok ? "ok" : "not_ready"} / links=${launchReadiness.evidence.tracking_link_smoke_links_checked}/${launchReadiness.evidence.tracking_link_smoke_expected_links} / real_event_write=${launchReadiness.evidence.tracking_link_smoke_real_write ? "yes" : "no"}
- Event contract smoke: ${launchReadiness.evidence.event_contract_smoke_ok ? "ok" : "not_ready"} / real_event_write=${launchReadiness.evidence.event_contract_real_write ? "yes" : "no"}
- Week archive: ${launchReadiness.evidence.week_archive_ok ? "ok" : "not_ready"} / files=${launchReadiness.evidence.week_archive_files} / dir=${launchReadiness.evidence.week_archive_dir ?? "n/a"}
- Next round plan: ${launchReadiness.evidence.next_round_plan_status} / decision=${launchReadiness.evidence.next_round_decision} / next_variable=${launchReadiness.evidence.next_round_changed_variable}
- Real events: ${launchReadiness.evidence.current_real_events}
- Full funnel preview events: ${launchReadiness.evidence.funnel_preview_events} / mode=${launchReadiness.evidence.funnel_preview_mode} / data_write=${launchReadiness.evidence.funnel_preview_data_write ? "yes" : "no"}
- Full funnel fixture guard: ${launchReadiness.evidence.funnel_fixture_ok ? "ok" : "not_ready"} / scenarios=${launchReadiness.evidence.funnel_fixture_scenarios} / data_write=${launchReadiness.evidence.funnel_fixture_data_write ? "yes" : "no"}
- Real-data apply guard: ${launchReadiness.evidence.real_data_apply_guard_ok ? "ok" : "not_ready"} / scenarios=${launchReadiness.evidence.real_data_apply_guard_scenarios} / data_write=${launchReadiness.evidence.real_data_apply_guard_data_write ? "yes" : "no"}
- Real-data decision replay: ${launchReadiness.evidence.real_data_decision_replay_ok ? "ok" : "not_ready"} / scenarios=${launchReadiness.evidence.real_data_decision_replay_scenarios} / ledger=${launchReadiness.evidence.real_data_decision_replay_source_capture_ledger ? "yes" : "no"} / compile=${launchReadiness.evidence.real_data_decision_replay_source_compile_commands ? "yes" : "no"} / local_previews=${launchReadiness.evidence.real_data_decision_replay_local_importer_previews ? "yes" : "no"} / data_write=${launchReadiness.evidence.real_data_decision_replay_data_write ? "yes" : "no"} / external_effect=${realDataDecisionReplayStatus.external_effect ? "yes" : "no"}
- Source readiness: ${sourceReadinessStatus.status ?? "unknown"} / missing_stages=${sourceReadinessStatus.missing_stage_count ?? 0} / public_ready=${sourceReadinessStatus.ready_for_public_iteration_decision ? "yes" : "no"} / data_write=${sourceReadinessStatus.data_lp_events_write_performed ? "yes" : "no"}
- Source capture pack: ${sourceCaptureStatus.status ?? "unknown"} / rows=${sourceCaptureStatus.ledger_rows ?? 0} / importable_links=${sourceCaptureStatus.importable_tracking_links ?? 0} / ab_router_gates=${sourceCaptureStatus.ab_router_gate_count ?? 0} / live_inputs=${sourceCaptureStatus.live_input_files_created ? "yes" : "no"} / data_write=${sourceCaptureStatus.data_lp_events_write_performed ? "yes" : "no"}
- Source compile preview: ${sourceCaptureCompileStatus.status ?? "unknown"} / input_kind=${sourceCaptureCompileStatus.input_kind ?? "unknown"} / filled_rows=${sourceCaptureCompileStatus.filled_rows ?? 0} / preview_rows=${(sourceCaptureCompileStatus.funnel_rows ?? 0) + (sourceCaptureCompileStatus.manual_rows ?? 0)} / live_inputs=${sourceCaptureCompileStatus.live_input_files_created ? "yes" : "no"} / data_write=${sourceCaptureCompileStatus.data_lp_events_write_performed ? "yes" : "no"}
- Source compile fixtures: ${sourceCaptureCompileFixtureStatus.ok ? "ok" : "not_ready"} / scenarios=${sourceCaptureCompileFixtureStatus.scenario_count ?? 0} / data_write=${sourceCaptureCompileFixtureStatus.data_lp_events_write_performed ? "yes" : "no"}
- Real-data intake plan: ${launchReadiness.evidence.real_data_intake_status} / ready_apply=${launchReadiness.evidence.real_data_intake_ready_apply_count} / missing_inputs=${launchReadiness.evidence.real_data_intake_missing_input_count} / blocked_inputs=${launchReadiness.evidence.real_data_intake_blocked_input_count} / data_write=${launchReadiness.evidence.real_data_intake_data_write ? "yes" : "no"}
- Data collection brief: ${launchReadiness.evidence.data_collection_brief_ok ? "ok" : "not_ready"} / status=${launchReadiness.evidence.data_collection_brief_status} / tasks=${launchReadiness.evidence.data_collection_brief_tasks} / sample_gate=${launchReadiness.evidence.sample_gate_status} / p0_tasks=${launchReadiness.evidence.sample_gate_p0_tasks} / filled_ledger=${launchReadiness.evidence.data_collection_brief_filled_ledger_exists ? "yes" : "no"} / data_write=${launchReadiness.evidence.data_collection_brief_data_write ? "yes" : "no"}
- Data collection progress: ${launchReadiness.evidence.data_collection_progress_ok ? "ok" : "not_ready"} / status=${launchReadiness.evidence.data_collection_progress_status} / tasks=${launchReadiness.evidence.data_collection_progress_filled_tasks}/${launchReadiness.evidence.data_collection_progress_total_tasks} / pending=${launchReadiness.evidence.data_collection_progress_pending_tasks} / p0_pending=${launchReadiness.evidence.data_collection_progress_p0_pending} / p1_pending=${launchReadiness.evidence.data_collection_progress_p1_pending} / next_owner_inputs=${launchReadiness.evidence.data_collection_progress_next_owner_inputs} / data_write=${launchReadiness.evidence.data_collection_progress_data_write ? "yes" : "no"} / external_effect=${launchReadiness.evidence.data_collection_progress_external_effect ? "yes" : "no"}
- Next P0 owner form: ${launchReadiness.evidence.next_p0_owner_form_ok ? "ok" : "not_ready"} / status=${launchReadiness.evidence.next_p0_owner_form_status} / rows=${launchReadiness.evidence.next_p0_owner_form_rows} / browser_only=${launchReadiness.evidence.next_p0_owner_form_browser_only ? "yes" : "no"} / network=${launchReadiness.evidence.next_p0_owner_form_network_calls ? "yes" : "no"} / fixture=${launchReadiness.evidence.next_p0_owner_form_fixture_ok ? "ok" : "not_ready"} / fixture_scenarios=${launchReadiness.evidence.next_p0_owner_form_fixture_scenarios} / data_write=${launchReadiness.evidence.next_p0_owner_form_data_write ? "yes" : "no"} / external_effect=${launchReadiness.evidence.next_p0_owner_form_external_effect ? "yes" : "no"}
- Next P0 owner intake: ${launchReadiness.evidence.next_p0_owner_intake_ok ? "ok" : "not_ready"} / status=${launchReadiness.evidence.next_p0_owner_intake_status} / found=${launchReadiness.evidence.next_p0_owner_intake_candidate_found ? "yes" : "no"} / preview_rows=${launchReadiness.evidence.next_p0_owner_intake_preview_rows} / staged=${launchReadiness.evidence.next_p0_owner_intake_stage_performed ? "yes" : "no"} / fixture=${launchReadiness.evidence.next_p0_owner_intake_fixture_ok ? "ok" : "not_ready"} / fixture_scenarios=${launchReadiness.evidence.next_p0_owner_intake_fixture_scenarios} / data_write=${launchReadiness.evidence.next_p0_owner_intake_data_write ? "yes" : "no"} / external_effect=${launchReadiness.evidence.next_p0_owner_intake_external_effect ? "yes" : "no"}
- Manual preview events: ${launchReadiness.evidence.manual_preview_events}
- LINE inbound playbook: ${launchReadiness.evidence.line_inbound_playbook_ok ? "ok" : "not_ready"} / scenarios=${launchReadiness.evidence.line_inbound_fixture_scenarios} / external_effect=${launchReadiness.evidence.line_inbound_external_effect ? "yes" : "no"}
- Manual publish evidence form: ${launchReadiness.evidence.manual_publish_evidence_form_ok ? "ok" : "not_ready"} / status=${launchReadiness.evidence.manual_publish_evidence_form_status} / packets=${launchReadiness.evidence.manual_publish_evidence_form_packets} / browser_only=${launchReadiness.evidence.manual_publish_evidence_form_browser_only ? "yes" : "no"} / network=${launchReadiness.evidence.manual_publish_evidence_form_network_calls ? "yes" : "no"} / url_fetch=${launchReadiness.evidence.manual_publish_evidence_form_url_fetch ? "yes" : "no"} / live_inputs=${launchReadiness.evidence.manual_publish_evidence_form_live_input_files_created ? "yes" : "no"}
- Manual publish evidence form guard: ${launchReadiness.evidence.manual_publish_evidence_form_fixture_ok ? "ok" : "not_ready"} / scenarios=${launchReadiness.evidence.manual_publish_evidence_form_fixture_scenarios} / data_write=${launchReadiness.evidence.manual_publish_evidence_form_fixture_data_write ? "yes" : "no"} / external_effect=${launchReadiness.evidence.manual_publish_evidence_form_fixture_external_effect ? "yes" : "no"}
- Funnel breakdown: rows=${funnelBreakdown.summary.rows} / content_variant_links=${funnelBreakdown.summary.content_variant_links} / real_events=${funnelBreakdown.summary.real_events}
- D1 sync: scope=${launchReadiness.evidence.d1_sync_scope} / rows=${launchReadiness.evidence.d1_sync_rows}
- A/B allocation: champion ${abStatus.traffic_allocation.champion}% / challenger ${abStatus.traffic_allocation.challenger}%
- Sample threshold met: ${launchReadiness.evidence.sample_threshold_met ? "yes" : "no"}
- Champion retained: ${launchReadiness.evidence.champion_retained ? "yes" : "no"}

## Approval Queue

| id | tier | status | artifact | human gate |
|---|---:|---|---|---|
${approvalRows}

## Owner Gates

| gate | tier | status | artifact | current blocker |
|---|---:|---|---|---|
${gateRows}

## Commands After Owner Approval

Run only the block that matches the approved gate. Remote D1, production deploy, GitHub push, and public link placement are external effects.

${commandBlocks}

## Approval Resume Dry Run

Before any external command block is used, run the dry-run planner:

\`\`\`zsh
npm run approval:plan
npm run owner:evidence
npm run post:verify
npm run verify:artifacts
\`\`\`

Artifacts:

- approval_resume_plan.md
- data/approval_resume_status.json
- owner_approval_input.example.json
- owner_gate_evidence.example.json
- post_gate_verification.md
- data/post_gate_verification_status.json

The dry-run planner and post-gate verification plan validate non-secret owner approval/evidence metadata and never run remote D1, production deploy, GitHub push/PR, public link changes, posting, LINE, payment, customer-data, or delete actions.

## Source Capture Review

Artifact: source_capture_pack.md
Status: ${sourceCaptureStatus.status ?? "unknown"}
Ledger rows: ${sourceCaptureStatus.ledger_rows ?? 0}
Sample-gate ledger rows: ${sourceCaptureStatus.sample_gate_ledger_rows ?? 0}
Importable links: ${sourceCaptureStatus.importable_tracking_links ?? 0}
A/B router gates held out: ${sourceCaptureStatus.ab_router_gate_count ?? 0}
Live input files created: ${sourceCaptureStatus.live_input_files_created ? "yes" : "no"}
data/lp_events.jsonl write performed: ${sourceCaptureStatus.data_lp_events_write_performed ? "yes" : "no"}

Use this pack to collect aggregate counts only. It does not create live scoring inputs or append real events.

## Source Capture Compile Review

Artifact: source_capture_compile_report.md
Status: ${sourceCaptureCompileStatus.status ?? "unknown"}
Input kind: ${sourceCaptureCompileStatus.input_kind ?? "unknown"}
Filled rows: ${sourceCaptureCompileStatus.filled_rows ?? 0}
Funnel preview rows: ${sourceCaptureCompileStatus.funnel_rows ?? 0}
Manual preview rows: ${sourceCaptureCompileStatus.manual_rows ?? 0}
Issues: ${sourceCaptureCompileStatus.issue_count ?? 0}
Live input files created: ${sourceCaptureCompileStatus.live_input_files_created ? "yes" : "no"}
data/lp_events.jsonl write performed: ${sourceCaptureCompileStatus.data_lp_events_write_performed ? "yes" : "no"}

Use this compiler after filling data/source_capture/source_capture_ledger.filled.csv. It creates owner-preview CSVs only; copy them to live CSV names only after owner review.

Fixture guard: ${sourceCaptureCompileFixtureStatus.ok ? "ok" : "not_ready"} / scenarios=${sourceCaptureCompileFixtureStatus.scenario_count ?? 0} / report=source_capture_compile_fixture_report.md

## Real Data Intake Review

Artifact: real_data_intake_plan.md
Status: ${realDataIntakeStatus.status ?? "unknown"}
Ready apply commands: ${realDataIntakeStatus.ready_apply_count ?? 0}
Missing inputs: ${realDataIntakeStatus.missing_input_count ?? 0}
Blocked inputs: ${realDataIntakeStatus.blocked_input_count ?? 0}
data/lp_events.jsonl write performed: ${realDataIntakeStatus.data_lp_events_write_performed ? "yes" : "no"}

Apply commands in the intake plan are local-only, but they append to data/lp_events.jsonl. Use them only after owner review confirms the CSV is reviewed real aggregate data.

## Data Collection Brief Review

Artifacts: data_collection_brief.md / data_collection_queue.json / data/data_collection_brief_status.json / sample_gate_collection_plan.md / sample_gate_collection_plan.json / data/sample_gate_collection_plan_status.json
Status: ${dataCollectionBriefStatus.status ?? "unknown"}
Tasks: ${dataCollectionBriefStatus.task_count ?? 0}
Stage count: ${dataCollectionBriefStatus.stage_count ?? 0}
Importable links: ${dataCollectionBriefStatus.importable_link_count ?? 0}
Sample gate: ${dataCollectionBriefStatus.sample_gate_status ?? "unknown"} / p0_tasks=${dataCollectionBriefStatus.sample_gate_p0_task_count ?? 0} / p0_links=${dataCollectionBriefStatus.sample_gate_p0_link_count ?? 0}
Filled ledger exists: ${dataCollectionBriefStatus.filled_ledger_exists ? "yes" : "no"}
Live input files created: ${dataCollectionBriefStatus.live_input_files_created ? "yes" : "no"}
data/lp_events.jsonl write performed: ${dataCollectionBriefStatus.data_lp_events_write_performed ? "yes" : "no"}
External effect: ${dataCollectionBriefStatus.external_effect ? "yes" : "no"}

Use this brief before filling data/source_capture/source_capture_ledger.filled.csv. It is a local owner-review queue only; it does not create live input CSVs or append real events.

## Data Collection Progress Review

Artifacts: data_collection_progress.md / data_collection_progress.json / data/data_collection_progress_status.json / next_p0_owner_inputs.md / next_p0_owner_inputs.json / data/next_p0_owner_inputs_status.json
Status: ${launchReadiness.evidence.data_collection_progress_status}
Tasks filled: ${launchReadiness.evidence.data_collection_progress_filled_tasks}/${launchReadiness.evidence.data_collection_progress_total_tasks}
Pending tasks: ${launchReadiness.evidence.data_collection_progress_pending_tasks}
P0 pending: ${launchReadiness.evidence.data_collection_progress_p0_pending}
P1 pending: ${launchReadiness.evidence.data_collection_progress_p1_pending}
Next owner inputs exposed: ${launchReadiness.evidence.data_collection_progress_next_owner_inputs}
data/lp_events.jsonl write performed: ${launchReadiness.evidence.data_collection_progress_data_write ? "yes" : "no"}
External effect: ${launchReadiness.evidence.data_collection_progress_external_effect ? "yes" : "no"}

Use this progress dashboard to fill the next owner aggregate-count rows. It is a local status view only; it does not create live input CSVs or append real events.

## Focused Next P0 Form Review

Artifacts: next_p0_owner_form.html / data/next_p0_owner_form_status.json / next_p0_owner_form_fixture_report.md / data/next_p0_owner_form_fixture_status.json
Status: ${nextP0OwnerFormStatus.status ?? "unknown"}
Rows: ${nextP0OwnerFormStatus.row_count ?? 0}
Browser only: ${nextP0OwnerFormStatus.browser_only ? "yes" : "no"}
Browser persistence: ${nextP0OwnerFormStatus.browser_persistence ? "yes" : "no"}
Network calls performed: ${nextP0OwnerFormStatus.network_calls_performed ? "yes" : "no"}
Fixture status: ${nextP0OwnerFormFixtureStatus.ok ? "ok" : "not_ready"} / scenarios=${nextP0OwnerFormFixtureStatus.scenario_count ?? 0}
Live input files created: ${nextP0OwnerFormStatus.live_input_files_created ? "yes" : "no"}
data/lp_events.jsonl write performed: ${nextP0OwnerFormStatus.data_lp_events_write_performed ? "yes" : "no"}
External effect: ${nextP0OwnerFormStatus.external_effect ? "yes" : "no"}

Open this focused form before the full sample-gate form when only the next 9 P0 aggregate rows need owner review. It downloads review files only and does not stage or apply data.

## Focused Next P0 Intake Review

Artifacts: next_p0_owner_intake.md / data/next_p0_owner_intake_status.json / next_p0_owner_intake_fixture_report.md / data/next_p0_owner_intake_fixture_status.json / data/next_p0_owner_intake/funnel_aggregates.owner-preview.csv / data/next_p0_owner_intake/manual_conversions.owner-preview.csv
Status: ${nextP0OwnerIntakeStatus.status ?? "unknown"}
Candidate found: ${nextP0OwnerIntakeStatus.candidate_found ? "yes" : "no"}
Candidate valid: ${nextP0OwnerIntakeStatus.candidate_valid ? "yes" : "no"}
Preview rows: ${(nextP0OwnerIntakeStatus.funnel_preview_rows ?? 0) + (nextP0OwnerIntakeStatus.manual_preview_rows ?? 0)}
Stage performed: ${nextP0OwnerIntakeStatus.stage_performed ? "yes" : "no"}
Live input files created: ${nextP0OwnerIntakeStatus.live_input_files_created ? "yes" : "no"}
Fixture status: ${nextP0OwnerIntakeFixtureStatus.ok ? "ok" : "not_ready"} / scenarios=${nextP0OwnerIntakeFixtureStatus.scenario_count ?? 0}
data/lp_events.jsonl write performed: ${nextP0OwnerIntakeStatus.data_lp_events_write_performed ? "yes" : "no"}
External effect: ${nextP0OwnerIntakeStatus.external_effect ? "yes" : "no"}

Use this intake after downloading next_p0_owner_inputs.filled.csv. Weekly runs validate and preview only; staging local CSV inputs requires explicit owner review and flags.

## Manual-Only Actions

- Formal social posts, schedules, broadcasts, or sends.
- LINE proactive push or customer messages.
- ECPay payment, refund, or payment-link operation.
- Customer record mutation.
- Data deletion.
- Promoting a challenger to champion.

## Prepared But Blocked

| action | blocked_by | artifact | resume_when |
|---|---|---|---|
${blockedRows}

## Safety Invariants

- Formal post performed: no
- Public link change performed: no
- Challenger promotion performed: no
- LINE push performed: no
- ECPay payment/refund performed: no
- Customer data mutation performed: no
- Production deploy performed: no
- Data delete performed: no

## Rollback

\`\`\`zsh
cd /Users/mac/Documents/Codex/control-center/3q-growth-loop
npm run schedule:uninstall
\`\`\`

Remote D1 deletion, Worker rollback, GitHub branch/PR deletion, and public link restoration are owner-reviewed external actions. Do not automate them from this pack.
`;
}

function renderLandingPageCandidate(config) {
  const candidate = config.assets.find((asset) => asset.role === "challenger");
  const champion = config.assets.find((asset) => asset.role === "champion");
  const assetId = candidate?.asset_id ?? "challenger-week0-cta-text-v1";
  const lineUrl = candidate?.line_url ?? champion?.line_url;
  if (!lineUrl) {
    throw new Error("Candidate and champion LINE URLs are both missing.");
  }
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>3Q 48h 成交診斷</title>
  <style>
    :root {
      --ink: #1d2528;
      --paper: #f7f3ea;
      --signal: #00a676;
      --clay: #b85c38;
      --line: #d8c7a3;
      --panel: #fffaf0;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--paper);
      color: var(--ink);
    }
    main {
      min-height: 100vh;
      display: grid;
      align-items: center;
      padding: clamp(24px, 6vw, 72px);
    }
    .sheet {
      width: min(100%, 1040px);
      max-width: 1040px;
      margin: 0 auto;
      border-top: 3px solid var(--ink);
      border-bottom: 1px solid var(--line);
      padding: clamp(28px, 5vw, 64px) 0;
    }
    .label {
      width: fit-content;
      padding: 6px 10px;
      background: var(--signal);
      color: white;
      font-size: 13px;
      font-weight: 800;
    }
    h1 {
      max-width: 900px;
      margin: 22px 0 18px;
      font-size: 72px;
      line-height: 1.02;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }
    .grid {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: clamp(24px, 5vw, 72px);
      align-items: end;
    }
    p {
      max-width: 640px;
      font-size: 20px;
      line-height: 1.55;
    }
    .proof {
      background: var(--panel);
      border: 1px solid var(--line);
      padding: 18px;
    }
    .proof strong {
      display: block;
      font-size: 34px;
      line-height: 1;
      color: var(--clay);
    }
    .cta {
      display: inline-flex;
      min-height: 52px;
      align-items: center;
      justify-content: center;
      margin-top: 22px;
      padding: 0 22px;
      background: var(--ink);
      color: white;
      font-weight: 850;
      text-decoration: none;
    }
    .small {
      margin-top: 14px;
      font-size: 14px;
      line-height: 1.45;
      color: #5c686c;
    }
    @media (max-width: 1100px) {
      h1 { font-size: 56px; }
    }
    @media (max-width: 760px) {
      main {
        align-items: start;
        padding: 28px 20px;
      }
      .sheet { padding: 28px 0; }
      .grid { grid-template-columns: 1fr; }
      h1 {
        margin-top: 18px;
        font-size: 42px;
        line-height: 1.08;
      }
      p { font-size: 18px; }
      .cta {
        width: 100%;
        padding: 12px 18px;
        text-align: center;
      }
      .proof strong { font-size: 28px; }
    }
    @media (max-width: 420px) {
      h1 { font-size: 36px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="sheet">
      <div class="label">3Q Growth Loop / Candidate</div>
      <h1>48 小時內，把你的頁面改成會有人加 LINE 的版本。</h1>
      <div class="grid">
        <div>
          <p>丟一個現有頁面或貼文，我先抓出流量漏在哪：hook、offer、視覺主張或 CTA。這輪只測 CTA，不動主連結、不承諾成交、不碰客戶資料。</p>
          <a class="cta" href="${escapeHtml(lineUrl)}" data-asset-id="${escapeHtml(assetId)}">加 LINE 領 48h 成交診斷</a>
          <div class="small">送出前由學誼人工確認；本頁是候選頁，不是正式主頁。</div>
        </div>
        <aside class="proof">
          <strong>1 變因</strong>
          本輪只改 CTA text。樣本不足時保留冠軍頁，挑戰頁不會自動扶正。
        </aside>
      </div>
    </section>
  </main>
  <script>
    const assetId = ${JSON.stringify(assetId)};
    navigator.sendBeacon?.("/e", JSON.stringify({ asset_id: assetId, event_type: "page_view", metadata_json: { surface: "candidate_static" } }));
    document.querySelector(".cta")?.addEventListener("click", () => {
      navigator.sendBeacon?.("/e", JSON.stringify({ asset_id: assetId, event_type: "cta_click", metadata_json: { surface: "candidate_static" } }));
    });
  </script>
</body>
</html>`;
}

function currentTaipeiWeek(date) {
  const taipeiDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const day = taipeiDate.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(taipeiDate);
  start.setDate(taipeiDate.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

function calculateTestDays(first, last) {
  if (!first || !last) {
    return 0;
  }
  const start = new Date(first);
  const end = new Date(last);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    return 0;
  }
  const days = Math.floor((end - start) / 86400000) + 1;
  return Math.max(days, 1);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function safeDivide(numerator, denominator) {
  if (!denominator) return 0;
  return numerator / denominator;
}

function round(value) {
  return Number(value.toFixed(4));
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function verifyOutputs(files) {
  for (const file of files) {
    await access(file);
    const content = await readFile(file, "utf8");
    if (content.length === 0) {
      throw new Error(`Empty output: ${file}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
