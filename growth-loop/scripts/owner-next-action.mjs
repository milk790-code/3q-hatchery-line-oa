import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.env.OWNER_NEXT_ACTION_ROOT
  ? path.resolve(process.env.OWNER_NEXT_ACTION_ROOT)
  : path.resolve(new URL("..", import.meta.url).pathname);
const JSON_PATH = path.join(ROOT, "owner_next_action.json");
const REPORT_PATH = path.join(ROOT, "owner_next_action.md");
const COMPACT_STATUS_PATH = path.join(ROOT, "data", "owner_next_action_status.json");

async function main() {
  const generatedAt = new Date();
  const ownerSampleGate = await readJson("data/owner_sample_gate_status.json", {});
  const ownerSampleGateFull = await readJson("owner_sample_gate_status.json", {});
  const ownerSampleGateIntake = await readJson("data/owner_sample_gate_intake_status.json", {});
  const ownerQualityReview = await readJson("data/owner_quality_review_status.json", {});
  const dataCollectionProgress = await readJson("data/data_collection_progress_status.json", {});
  const nextP0OwnerInputs = await readJson("data/next_p0_owner_inputs_status.json", {});
  const nextP0OwnerForm = await readJson("data/next_p0_owner_form_status.json", {});
  const nextP0QuickCapture = await readJson("data/next_p0_quick_capture_status.json", {});
  const p0CountsPreflight = await readJson("data/p0_counts_preflight_status.json", {});
  const nextP0OwnerIntake = await readJson("data/next_p0_owner_intake_status.json", {});
  const sampleGateBatchHandoff = await readJson("data/sample_gate_batch_handoff_status.json", {});
  const realDataIntake = await readJson("data/real_data_intake_status.json", {});
  const sourceTrust = await readJson("data/source_trust_matrix_status.json", {});
  const sampleGateCaptureCalendar = await readJson("data/sample_gate_capture_calendar_status.json", {});
  const sampleGateDueStatus = await readJson("data/sample_gate_due_status_status.json", {});
  const sampleGatePlan = await readJson("sample_gate_collection_plan.json", {});
  const nextRoundPlan = await readJson("next_round_plan.json", {});
  const approvalQueue = await readJson("approval_queue.json", { items: [] });
  const approvalQueueStatus = await readJson("data/approval_queue_status.json", {});
  const launchReadiness = await readJson("launch_readiness.json", {});
  const gateReadiness = await readJson("data/gate_readiness_status.json", {});

  const actionCard = buildActionCard({
    generatedAt,
    ownerSampleGate,
    ownerSampleGateFull,
    ownerSampleGateIntake,
    ownerQualityReview,
    dataCollectionProgress,
    nextP0OwnerInputs,
    nextP0OwnerForm,
    nextP0QuickCapture,
    p0CountsPreflight,
    nextP0OwnerIntake,
    sampleGateBatchHandoff,
    realDataIntake,
    sourceTrust,
    sampleGateCaptureCalendar,
    sampleGateDueStatus,
    sampleGatePlan,
    nextRoundPlan,
    approvalQueue,
    approvalQueueStatus,
    launchReadiness,
    gateReadiness,
  });

  await writeJson(JSON_PATH, actionCard);
  await writeFile(REPORT_PATH, renderReport(actionCard));
  await writeJson(COMPACT_STATUS_PATH, compactStatus(actionCard));
  console.log(JSON.stringify(compactStatus(actionCard), null, 2));
}

function buildActionCard({
  generatedAt,
  ownerSampleGate,
  ownerSampleGateFull,
  ownerSampleGateIntake,
  ownerQualityReview,
  dataCollectionProgress,
  nextP0OwnerInputs,
  nextP0OwnerForm,
  nextP0QuickCapture,
  p0CountsPreflight,
  nextP0OwnerIntake,
  sampleGateBatchHandoff,
  realDataIntake,
  sourceTrust,
  sampleGateCaptureCalendar,
  sampleGateDueStatus,
  sampleGatePlan,
  nextRoundPlan,
  approvalQueue,
  approvalQueueStatus,
  launchReadiness,
  gateReadiness,
}) {
  const sampleGaps = sampleGatePlan.global_sample_gaps
    ?? ownerSampleGateFull.challenger?.gaps
    ?? {
      visits: ownerSampleGate.sample_threshold_met ? 0 : 100,
      cta_clicks: ownerSampleGate.sample_threshold_met ? 0 : 20,
      line_adds: ownerSampleGate.sample_threshold_met ? 0 : 5,
      test_days: ownerSampleGate.sample_threshold_met ? 0 : 3,
    };
  const pendingHumanCount = approvalQueueStatus.pending_human_count
    ?? (approvalQueue.items ?? []).filter((item) => item.status === "pending_human").length;
  const ownerApprovalRequired = launchReadiness.owner_decision_required === true
    || launchReadiness.status === "owner_approval_required";
  const gateMetadataActions = gateReadiness.parallel_metadata_actions ?? [];
  const publicAbMetadataAction = gateMetadataActions.find((action) => action.gate_id === "public_ab_small_traffic_link") ?? null;

  const primary = choosePrimaryAction({
    ownerSampleGate,
    ownerSampleGateIntake,
    ownerQualityReview,
    nextP0OwnerIntake,
    nextP0OwnerForm,
    nextP0QuickCapture,
    p0CountsPreflight,
    sampleGateBatchHandoff,
    realDataIntake,
    sampleGateDueStatus,
    nextRoundPlan,
    sampleGaps,
  });

  const nextActions = normalizeThreeActions([
    primary,
    ...secondaryActions({
      primary,
      publicAbMetadataAction,
      ownerSampleGate,
      ownerSampleGateIntake,
      ownerQualityReview,
      nextRoundPlan,
    }),
  ]);

  return {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "owner_next_action_card",
    status: primary.status,
    decision: primary.id,
    bluf: primary.bluf,
    current_round: nextRoundPlan.current_round ?? ownerSampleGateFull.current_round ?? null,
    current_gate: {
      owner_sample_gate_status: ownerSampleGate.status ?? "unknown",
      owner_sample_gate_decision: ownerSampleGate.decision ?? "unknown",
      data_collection_progress_status: dataCollectionProgress.status ?? "unknown",
      data_collection_p0_pending_count: dataCollectionProgress.p0_pending_count ?? null,
      next_p0_owner_inputs_status: nextP0OwnerInputs.status ?? "unknown",
      next_p0_owner_input_count: nextP0OwnerInputs.current_input_count ?? null,
      next_p0_owner_form_status: nextP0OwnerForm.status ?? "unknown",
      next_p0_owner_form_row_count: nextP0OwnerForm.row_count ?? null,
      next_p0_quick_capture_status: nextP0QuickCapture.status ?? "unknown",
      next_p0_quick_capture_expected_row_count: nextP0QuickCapture.expected_row_count ?? null,
      next_p0_quick_capture_quick_count_count: nextP0QuickCapture.quick_count_count ?? 0,
      next_p0_quick_capture_filled_rank_count: nextP0QuickCapture.filled_rank_count ?? 0,
      next_p0_quick_capture_filled_ranks: nextP0QuickCapture.filled_ranks ?? [],
      next_p0_quick_capture_missing_rank_count: nextP0QuickCapture.missing_rank_count ?? null,
      next_p0_quick_capture_missing_ranks: nextP0QuickCapture.missing_ranks ?? [],
      next_p0_quick_capture_partial_waiting: nextP0QuickCapture.partial_waiting ?? false,
      next_p0_quick_capture_partial_auto_counts: nextP0QuickCapture.partial_auto_counts ?? false,
      next_p0_quick_capture_template_created: nextP0QuickCapture.template_created ?? false,
      next_p0_quick_capture_paste_template_created: nextP0QuickCapture.paste_template_created ?? false,
      next_p0_quick_capture_paste_template_path: nextP0QuickCapture.paste_template_path ?? null,
      next_p0_quick_capture_filled_preview_created: nextP0QuickCapture.filled_preview_created ?? false,
      p0_counts_preflight_status: p0CountsPreflight.status ?? "unknown",
      p0_counts_preflight_ready_for_quick_preview: p0CountsPreflight.ready_for_quick_preview ?? false,
      p0_counts_preflight_expected_count_key_count: p0CountsPreflight.expected_count_key_count ?? null,
      p0_counts_preflight_filled_count_key_count: p0CountsPreflight.filled_count_key_count ?? 0,
      p0_counts_preflight_placeholder_count_key_count: p0CountsPreflight.placeholder_count_key_count ?? null,
      p0_counts_preflight_issue_count: p0CountsPreflight.issue_count ?? 0,
      next_p0_owner_intake_status: nextP0OwnerIntake.status ?? "unknown",
      next_p0_owner_intake_candidate_found: nextP0OwnerIntake.candidate_found ?? false,
      next_p0_owner_intake_stage_performed: nextP0OwnerIntake.stage_performed ?? false,
      sample_gate_batch_handoff_status: sampleGateBatchHandoff.status ?? "unknown",
      sample_gate_batch_handoff_p0_task_count: sampleGateBatchHandoff.p0_task_count ?? null,
      sample_gate_batch_handoff_all_p0_row_count: sampleGateBatchHandoff.all_p0_row_count ?? null,
      sample_gate_batch_handoff_focused_batch_row_count: sampleGateBatchHandoff.focused_batch_row_count ?? null,
      sample_gate_batch_handoff_remaining_batch_row_count: sampleGateBatchHandoff.remaining_batch_row_count ?? null,
      sample_gate_batch_handoff_p0_pending_count: sampleGateBatchHandoff.p0_pending_count ?? null,
      sample_gate_batch_handoff_batch_count: sampleGateBatchHandoff.batch_count ?? null,
      sample_gate_batch_handoff_full_coverage_ready: sampleGateBatchHandoff.full_coverage_ready ?? false,
      real_data_intake_status: realDataIntake.status ?? "unknown",
      real_data_intake_ready_apply_count: realDataIntake.ready_apply_count ?? 0,
      real_data_intake_missing_input_count: realDataIntake.missing_input_count ?? null,
      real_data_intake_blocked_input_count: realDataIntake.blocked_input_count ?? null,
      source_trust_status: sourceTrust.status ?? "unknown",
      source_trust_trusted_scoring_source_count: sourceTrust.trusted_scoring_source_count ?? 0,
      source_trust_sample_gate_source_count: sourceTrust.sample_gate_source_count ?? 0,
      source_trust_scoring_allowed_now: sourceTrust.scoring_allowed_now ?? false,
      source_trust_real_event_rows: sourceTrust.real_event_rows ?? 0,
      source_trust_p0_pending_count: sourceTrust.p0_pending_count ?? null,
      source_trust_sample_threshold_met: sourceTrust.sample_threshold_met ?? false,
      source_trust_ready_for_public_iteration_decision: sourceTrust.ready_for_public_iteration_decision ?? false,
      sample_gate_capture_calendar_status: sampleGateCaptureCalendar.status ?? "unknown",
      sample_gate_capture_calendar_event_count: sampleGateCaptureCalendar.event_count ?? null,
      sample_gate_capture_calendar_next_due_date: sampleGateCaptureCalendar.next_due_date ?? null,
      sample_gate_capture_calendar_next_due_event_id: sampleGateCaptureCalendar.next_due_event_id ?? null,
      sample_gate_due_status: sampleGateDueStatus.status ?? "unknown",
      sample_gate_due_phase: sampleGateDueStatus.due_phase ?? null,
      sample_gate_due_now: sampleGateDueStatus.due_now ?? false,
      sample_gate_due_date: sampleGateDueStatus.due_date ?? null,
      sample_gate_due_event_id: sampleGateDueStatus.due_event_id ?? null,
      owner_sample_gate_intake_status: ownerSampleGateIntake.status ?? "unknown",
      owner_quality_review_status: ownerQualityReview.status ?? "unknown",
      next_round_decision: nextRoundPlan.decision ?? "unknown",
      approval_queue_status: approvalQueueStatus.status ?? "unknown",
      approval_queue_item_count: approvalQueueStatus.item_count ?? (approvalQueue.items ?? []).length,
      approval_queue_ready_local_review_count: approvalQueueStatus.ready_local_review_count ?? null,
      approval_queue_pending_human_count: approvalQueueStatus.pending_human_count ?? pendingHumanCount,
      approval_queue_completed_local_reversible_count: approvalQueueStatus.completed_local_reversible_count ?? null,
      approval_queue_high_risk_pending_count: approvalQueueStatus.high_risk_pending_count ?? null,
      approval_queue_next_ready_local_review_id: approvalQueueStatus.next_ready_local_review_id ?? null,
      approval_queue_next_ready_local_review_artifact: approvalQueueStatus.next_ready_local_review_artifact ?? null,
      approval_queue_next_pending_human_id: approvalQueueStatus.next_pending_human_id ?? null,
      approval_queue_next_pending_human_artifact: approvalQueueStatus.next_pending_human_artifact ?? null,
      approval_queue_policy_ok: approvalQueueStatus.policy_ok ?? false,
      gate_readiness_status: gateReadiness.status ?? "unknown",
      gate_parallel_metadata_action_count: gateReadiness.parallel_metadata_action_count ?? gateMetadataActions.length,
      public_ab_metadata_status: publicAbMetadataAction?.status ?? "not_listed",
      public_ab_metadata_fields_needing_input: publicAbMetadataAction?.fields_needing_input ?? [],
      public_ab_metadata_blocking_dependencies: publicAbMetadataAction?.blocking_dependencies ?? [],
    },
    sample_gaps: {
      visits: Number(sampleGaps.visits ?? 0),
      cta_clicks: Number(sampleGaps.cta_clicks ?? 0),
      line_adds: Number(sampleGaps.line_adds ?? 0),
      test_days: Number(sampleGaps.test_days ?? 0),
      preferred_test_days: Number(sampleGaps.preferred_test_days ?? sampleGatePlan.sample_progress?.preferred_test_days ?? 7),
    },
    sample_threshold_met: ownerSampleGate.sample_threshold_met === true,
    sample_rate_win_candidate: ownerSampleGate.sample_rate_win_candidate === true,
    owner_review_required: ownerSampleGate.owner_review_required === true
      || ownerQualityReview.owner_review_required === true
      || realDataIntake.status === "preview_ready_owner_apply_required",
    pending_human_approval_count: pendingHumanCount,
    owner_approval_required: ownerApprovalRequired,
    primary_action: primary,
    next_actions: nextActions,
    review_artifacts: [
      "owner_next_action.md",
      "real_data_intake_plan.md",
      "data/real_data_intake_status.json",
      "source_trust_matrix.md",
      "data/source_trust_matrix_status.json",
      "owner_sample_gate_status.md",
      "owner_sample_gate_intake.md",
      "next_p0_owner_intake.md",
      "sample_gate_batch_handoff.md",
      "sample_gate_batch_1_paste_block.txt",
      "sample_gate_batch_2_paste_block.txt",
      "next_p0_quick_capture.md",
      "p0_counts_preflight.md",
      "p0_counts_preflight.json",
      "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
      "next_p0_owner_form.html",
      "sample_gate_owner_form.html",
      "next_p0_owner_inputs.md",
      "sample_gate_collection_plan.md",
      "sample_gate_capture_calendar.md",
      "sample_gate_due_status.md",
      "data_collection_progress.md",
      "owner_quality_review.md",
      "approval_queue.json",
      "data/approval_queue_status.json",
      "gate_readiness.md",
      "data/gate_readiness_status.json",
      "owner_approval_form.html",
    ],
    safety_rules: [
      "Aggregate counts only.",
      "Do not paste phone, email, LINE user ID, customer name, chat text, payment data, private notes, order IDs, or refund details.",
      "Sample-insufficient weeks keep the champion and the current variable.",
      "A sample-rate winner still needs owner quality review before any promotion decision.",
      "External posting, public link changes, LINE push, ECPay, customer-data changes, production deploy, deletion, GitHub push, and PR creation remain blocked.",
      "Public A/B metadata can be prepared in owner_approval_form.html, but it does not authorize Worker deploy, public routing, or main-link changes.",
    ],
    external_effect: false,
    live_input_files_created: false,
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

function choosePrimaryAction({
  ownerSampleGate,
  ownerSampleGateIntake,
  ownerQualityReview,
  nextP0OwnerIntake,
  nextP0OwnerForm,
  nextP0QuickCapture,
  p0CountsPreflight,
  sampleGateBatchHandoff,
  realDataIntake,
  sampleGateDueStatus,
  nextRoundPlan,
  sampleGaps,
}) {
  if (ownerSampleGateIntake.status === "blocked_invalid_owner_download") {
    return action({
      id: "fix_invalid_owner_download",
      status: "owner_download_blocked",
      title: "Fix the downloaded sample-gate CSV before staging.",
      bluf: "The owner download was found but failed validation. Fix the CSV or regenerate it from the local form.",
      command: "npm run owner:intake",
      artifacts: ["owner_sample_gate_intake.md", "sample_gate_owner_form.html"],
      human_gate: "Owner must remove sensitive fields or invalid values before any staging command.",
    });
  }

  if (nextP0OwnerIntake.status === "blocked_invalid_next_p0_owner_download") {
    return action({
      id: "fix_invalid_next_p0_owner_download",
      status: "next_p0_owner_download_blocked",
      title: "Fix the focused Next P0 CSV before using it.",
      bluf: "The focused Next P0 owner download exists but failed validation. Regenerate it from the local form or remove invalid/sensitive fields.",
      command: "npm run next-p0:intake",
      artifacts: ["next_p0_owner_intake.md", "next_p0_owner_form.html"],
      human_gate: "Owner must keep the file aggregate-only and remove customer identifiers before any local staging.",
    });
  }

  if (realDataIntake.status === "input_attention_required") {
    return action({
      id: "fix_real_data_input_preview",
      status: "real_data_input_attention_required",
      title: "Fix the staged aggregate CSV before local apply.",
      bluf: "A local aggregate input exists, but preview validation failed or was blocked. Fix the CSV before any owner-approved apply.",
      command: "npm run real-data:intake",
      artifacts: ["real_data_intake_plan.md", "data/real_data_intake_status.json", "data/funnel_aggregates.csv", "data/manual_conversions.csv"],
      human_gate: "Owner must keep the CSV aggregate-only and remove invalid or sensitive fields before applying.",
    });
  }

  if (nextP0QuickCapture.status === "blocked_invalid_quick_counts"
    || p0CountsPreflight.status === "blocked_invalid_p0_counts") {
    return action({
      id: "fix_invalid_p0_counts",
      status: "blocked_invalid_p0_counts",
      title: "Fix invalid focused P0 aggregate counts before quick preview.",
      bluf: "The focused P0 paste template has invalid, incomplete, or sensitive-looking values. Keep weekly artifacts alive, but fix the paste before any quick preview, staging, scoring, or public decision.",
      command: "open p0_counts_preflight.md",
      artifacts: ["p0_counts_preflight.md", "p0_counts_preflight.json", "data/p0_counts_preflight_status.json", "next_p0_quick_capture.md", "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt"],
      human_gate: "Owner must replace invalid values with aggregate-only counts and non-sensitive evidence metadata; never paste customer identifiers or chat text.",
    });
  }

  if (realDataIntake.status === "preview_ready_owner_apply_required" && Number(realDataIntake.ready_apply_count ?? 0) > 0) {
    return action({
      id: "review_real_data_apply",
      status: "owner_review_required_before_local_event_apply",
      title: "Review the real-data intake plan before local scoring.",
      bluf: "Reviewed aggregate inputs passed preview. The next gate is owner-approved local append into data/lp_events.jsonl, then a weekly rescore.",
      command: "open real_data_intake_plan.md",
      artifacts: ["real_data_intake_plan.md", "data/real_data_intake_status.json", "data/real_data_intake/"],
      human_gate: "Owner must review the preview and run only the listed local apply command for aggregate real data.",
    });
  }

  if (nextP0OwnerIntake.stage_performed === true
    || nextP0OwnerIntake.status === "next_p0_owner_download_staged_local_inputs") {
    return action({
      id: "preview_staged_real_data_inputs",
      status: "local_inputs_staged_needs_real_data_preview",
      title: "Preview staged local aggregate CSVs before scoring.",
      bluf: "Focused Next P0 counts have been staged into local aggregate CSVs. Run the real-data intake preview before any owner-approved append to lp_events.",
      command: "npm run real-data:intake",
      artifacts: ["real_data_intake_plan.md", "data/real_data_intake_status.json", "data/funnel_aggregates.csv", "data/manual_conversions.csv", "next_p0_owner_intake.md"],
      human_gate: "The preview is safe; applying to data/lp_events.jsonl still requires owner review and the listed apply command.",
    });
  }

  if (nextP0OwnerIntake.status === "next_p0_owner_download_preview_ready"
    || nextP0OwnerIntake.status === "next_p0_owner_download_ready_needs_confirmed_stage"
    || nextP0OwnerIntake.status === "next_p0_owner_download_stage_blocked_live_inputs_exist") {
    return action({
      id: "stage_reviewed_next_p0_download",
      status: "owner_review_required_before_next_p0_stage",
      title: "Stage the reviewed focused Next P0 download into local aggregate CSVs.",
      bluf: "A valid focused Next P0 download is available. Review the preview, then stage local CSV inputs before re-running real-data intake.",
      command: "npm run next-p0:intake -- --stage --confirm-owner-reviewed",
      artifacts: ["next_p0_owner_intake.md", "data/next_p0_owner_intake/funnel_aggregates.owner-preview.csv", "data/next_p0_owner_intake/manual_conversions.owner-preview.csv"],
      human_gate: "Owner must confirm the download contains aggregate counts only; use --replace-live only if existing local live CSVs should be replaced.",
    });
  }

  if (ownerSampleGateIntake.status === "owner_download_ready_for_review"
    || ownerSampleGateIntake.status === "owner_download_ready_needs_confirmed_stage") {
    return action({
      id: "stage_owner_reviewed_sample_gate_download",
      status: "owner_review_required_before_stage",
      title: "Stage the reviewed sample-gate download into the working ledger.",
      bluf: "A valid owner download is available. Stage it only after owner review confirms aggregate-only contents.",
      command: "npm run owner:intake -- --stage --confirm-owner-reviewed",
      artifacts: ["owner_sample_gate_intake.md", "data/source_capture/sample_gate_ledger.filled.csv"],
      human_gate: "Owner must confirm the download contains aggregate counts only.",
    });
  }

  if (ownerSampleGate.status === "sample_rate_win_needs_quality_review"
    || ownerQualityReview.status === "waiting_for_owner_quality_evidence") {
    return action({
      id: "complete_owner_quality_review",
      status: "waiting_for_owner_quality_review",
      title: "Complete the aggregate quality review before any challenger promotion review.",
      bluf: "The sample-rate gate is ready, but final win status is blocked until owner quality evidence is reviewed.",
      command: "npm run owner:quality-review",
      artifacts: ["owner_quality_review.md", "owner_quality_review_form.html", "approval_queue.json"],
      human_gate: "Owner must provide aggregate quality evidence; no customer messages or PII.",
    });
  }

  if (ownerSampleGate.sample_threshold_met !== true) {
    const dueSuffix = sampleGateDueStatus.due_now
      ? ` Due status: ${sampleGateDueStatus.status ?? "due_now"}.`
      : "";
    if (nextP0QuickCapture.filled_preview_created === true) {
      return action({
        id: "preview_quick_next_p0_counts",
        status: "quick_counts_preview_ready",
        title: "Preview the quick-filled Next P0 counts before any staging.",
        bluf: `Sample is still short: visits gap ${sampleGaps.visits ?? 0}, CTA gap ${sampleGaps.cta_clicks ?? 0}, LINE add gap ${sampleGaps.line_adds ?? 0}, days gap ${sampleGaps.test_days ?? 0}. A quick-filled preview CSV already exists.${dueSuffix}`,
        command: "npm run next-p0:intake -- --input=data/next_p0_quick_capture/next_p0_owner_inputs.quick-filled.preview.csv",
        artifacts: ["data/next_p0_quick_capture/next_p0_owner_inputs.quick-filled.preview.csv", "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt", "next_p0_quick_capture.md", "next_p0_owner_intake.md", "next_p0_owner_inputs.md", "next_p0_owner_form.html", "sample_gate_capture_calendar.md", "sample_gate_due_status.md", "sample_gate_owner_form.html", "sample_gate_collection_plan.md", "week0_owner_capture_queue.md", "data_collection_progress.md"],
        human_gate: "Owner must review the preview and confirm aggregate-only contents before local staging.",
      });
    }
    if (nextP0QuickCapture.partial_waiting === true
      || (Number(nextP0QuickCapture.filled_rank_count ?? 0) > 0 && Number(nextP0QuickCapture.missing_rank_count ?? 0) > 0)) {
      const filled = Number(nextP0QuickCapture.filled_rank_count ?? 0);
      const expected = Number(nextP0QuickCapture.expected_row_count ?? nextP0OwnerForm.row_count ?? 0);
      const missing = Array.isArray(nextP0QuickCapture.missing_ranks)
        ? nextP0QuickCapture.missing_ranks.join(", ")
        : "unknown";
      return action({
        id: "collect_owner_sample_gate_counts",
        status: "partial_quick_counts_waiting",
        title: "Finish the partially filled Next P0 paste-template counts.",
        bluf: `Sample is still short: visits gap ${sampleGaps.visits ?? 0}, CTA gap ${sampleGaps.cta_clicks ?? 0}, LINE add gap ${sampleGaps.line_adds ?? 0}, days gap ${sampleGaps.test_days ?? 0}. The paste template is partially filled: ${filled}/${expected} ranks done; missing ranks: ${missing}.${dueSuffix}`,
        command: "open data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
        artifacts: ["data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt", "next_p0_quick_capture.md", "next_p0_owner_inputs.md", "next_p0_owner_form.html", "sample_gate_capture_calendar.md", "sample_gate_due_status.md", "sample_gate_owner_form.html", "sample_gate_collection_plan.md", "week0_owner_capture_queue.md", "data_collection_progress.md"],
        human_gate: "Owner must complete the remaining aggregate counts only; partial quick counts are preserved but do not create a preview CSV.",
      });
    }
    if (nextP0QuickCapture.paste_template_created === true) {
      return action({
        id: "collect_owner_sample_gate_counts",
        status: "waiting_for_owner_sample_gate_counts",
        title: "Fill the full P0 sample-gate batch handoff.",
        bluf: `Sample is still short: visits gap ${sampleGaps.visits ?? 0}, CTA gap ${sampleGaps.cta_clicks ?? 0}, LINE add gap ${sampleGaps.line_adds ?? 0}, days gap ${sampleGaps.test_days ?? 0}. Full P0 coverage is ${sampleGateBatchHandoff.all_p0_row_count ?? 0}/${sampleGateBatchHandoff.p0_task_count ?? 0} rows: fill batch 1 (${sampleGateBatchHandoff.focused_batch_row_count ?? nextP0OwnerForm.row_count ?? 0}) first, then batch 2 (${sampleGateBatchHandoff.remaining_batch_row_count ?? 0}) before treating Week 0 sample collection as covered.${dueSuffix}`,
        command: "open sample_gate_batch_handoff.md",
        artifacts: ["sample_gate_batch_handoff.md", "sample_gate_batch_1_paste_block.txt", "sample_gate_batch_2_paste_block.txt", "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt", "next_p0_quick_capture.md", "next_p0_owner_inputs.md", "next_p0_owner_form.html", "sample_gate_capture_calendar.md", "sample_gate_due_status.md", "sample_gate_owner_form.html", "sample_gate_collection_plan.md", "week0_owner_capture_queue.md", "data_collection_progress.md"],
        human_gate: "Owner must collect aggregate counts from landing analytics and LINE OA without exporting customer rows; batch 1 can use the quick paste template, and batch 2 completes the remaining content-variant coverage.",
      });
    }
    return action({
      id: "collect_owner_sample_gate_counts",
      status: "waiting_for_owner_sample_gate_counts",
      title: "Fill the full P0 aggregate-count handoff first.",
      bluf: `Sample is still short: visits gap ${sampleGaps.visits ?? 0}, CTA gap ${sampleGaps.cta_clicks ?? 0}, LINE add gap ${sampleGaps.line_adds ?? 0}, days gap ${sampleGaps.test_days ?? 0}. Full P0 coverage is ${sampleGateBatchHandoff.all_p0_row_count ?? 0}/${sampleGateBatchHandoff.p0_task_count ?? 0} rows.${dueSuffix}`,
      command: "open sample_gate_batch_handoff.md",
      artifacts: ["sample_gate_batch_handoff.md", "sample_gate_batch_1_paste_block.txt", "sample_gate_batch_2_paste_block.txt", "next_p0_owner_form.html", "next_p0_quick_capture.md", "next_p0_owner_inputs.md", "sample_gate_capture_calendar.md", "sample_gate_due_status.md", "sample_gate_owner_form.html", "sample_gate_collection_plan.md", "week0_owner_capture_queue.md", "data_collection_progress.md"],
      human_gate: "Owner must collect aggregate counts from landing analytics and LINE OA without exporting customer rows.",
    });
  }

  if (nextRoundPlan.decision === "retire_underperforming_challenger_plan_next_variable") {
    return action({
      id: "review_next_variable_round",
      status: "local_next_round_ready_for_review",
      title: "Review the next one-variable local round before changing any public traffic.",
      bluf: "The sample is ready but the challenger did not win. The next local one-variable draft can be reviewed.",
      command: "npm run weekly:local",
      artifacts: ["next_round_plan.md", "candidate_retirement_queue.json", "content_variants.md"],
      human_gate: "Owner must approve any public test URL or posting plan.",
    });
  }

  return action({
    id: "review_approval_queue",
    status: "owner_approval_queue_ready",
    title: "Review the approval queue and keep external gates manual.",
    bluf: "Local evidence is ready for review. External actions remain blocked until owner approval.",
    command: "open owner_console.html",
    artifacts: ["owner_console.html", "owner_approval_pack.md", "approval_queue.json"],
    human_gate: "Owner must explicitly approve any GitHub push, PR, public link, deploy, post, or LINE action.",
  });
}

function secondaryActions({
  primary,
  publicAbMetadataAction,
  ownerSampleGate,
  ownerSampleGateIntake,
  ownerQualityReview,
  nextRoundPlan,
}) {
  const actions = [];
  if (publicAbMetadataAction && primary.id !== "prepare_public_ab_metadata") {
    actions.push(action({
      id: "prepare_public_ab_metadata",
      status: publicAbMetadataAction.status ?? "unknown",
      title: "Prepare public A/B metadata without changing links.",
      bluf: `Capture non-secret public A/B metadata now: ${(publicAbMetadataAction.fields_needing_input ?? []).join(", ") || "none"}. Execution order and owner gates still apply.`,
      command: "open owner_approval_form.html",
      artifacts: ["owner_approval_form.html", "gate_readiness.md", "data/gate_readiness_status.json"],
      human_gate: "This is metadata capture only; do not deploy a Worker, place an A/B URL, change the main link, or promote a challenger from this action.",
    }));
  }
  if (primary.id !== "collect_owner_sample_gate_counts") {
    actions.push(action({
      id: "review_sample_gate_status",
      status: ownerSampleGate.status ?? "unknown",
      title: "Review the current sample gate gaps.",
      bluf: "Confirm the champion stays in place until sample thresholds and win rules are both met.",
      command: "npm run owner:sample-gate",
      artifacts: ["owner_sample_gate_status.md"],
      human_gate: "Do not promote a challenger from this status alone.",
    }));
  }
  if (primary.id !== "stage_owner_reviewed_sample_gate_download") {
    actions.push(action({
      id: "check_owner_download_intake",
      status: ownerSampleGateIntake.status ?? "unknown",
      title: "Check whether a downloaded sample-gate CSV is ready.",
      bluf: "This only inspects known local download locations and never stages automatically.",
      command: "npm run owner:intake",
      artifacts: ["owner_sample_gate_intake.md"],
      human_gate: "Staging still requires --confirm-owner-reviewed.",
    }));
  }
  if (primary.id !== "complete_owner_quality_review") {
    actions.push(action({
      id: "keep_quality_review_gate_visible",
      status: ownerQualityReview.status ?? "unknown",
      title: "Keep the quality-review gate visible.",
      bluf: "A rate win is not enough; quality regression must stay false before promotion review.",
      command: "npm run owner:quality-review",
      artifacts: ["owner_quality_review.md"],
      human_gate: "Owner quality evidence must be aggregate-only.",
    }));
  }
  actions.push(action({
    id: "review_next_round_plan",
    status: nextRoundPlan.status ?? "unknown",
    title: "Review the current one-variable next-round plan.",
    bluf: "Sample-insufficient weeks keep the current variable and do not rotate early.",
    command: "open next_round_plan.md",
    artifacts: ["next_round_plan.md"],
    human_gate: "Do not change public traffic from this local plan alone.",
  }));
  return actions;
}

function action({ id, status, title, bluf, command, artifacts, human_gate }) {
  return {
    id,
    status,
    title,
    bluf,
    command,
    artifacts,
    human_gate,
    external_effect: false,
  };
}

function normalizeThreeActions(actions) {
  const seen = new Set();
  const output = [];
  for (const item of actions) {
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    output.push(item);
    if (output.length === 3) break;
  }
  while (output.length < 3) {
    output.push(action({
      id: `hold_red_lines_${output.length + 1}`,
      status: "manual_only",
      title: "Hold external red lines.",
      bluf: "No external action is allowed from this local card.",
      command: "open prepared_but_blocked.json",
      artifacts: ["prepared_but_blocked.json"],
      human_gate: "Owner approval is required for every external or irreversible action.",
    }));
  }
  return output;
}

function compactStatus(card) {
  return {
    ok: card.ok,
    generated_at: card.generated_at,
    mode: card.mode,
    status: card.status,
    decision: card.decision,
    primary_action_id: card.primary_action.id,
    sample_threshold_met: card.sample_threshold_met,
    sample_rate_win_candidate: card.sample_rate_win_candidate,
    owner_review_required: card.owner_review_required,
    next_action_count: card.next_actions.length,
    next_p0_owner_inputs_status: card.current_gate.next_p0_owner_inputs_status,
    next_p0_owner_input_count: card.current_gate.next_p0_owner_input_count,
    next_p0_owner_form_status: card.current_gate.next_p0_owner_form_status,
    next_p0_owner_form_row_count: card.current_gate.next_p0_owner_form_row_count,
    next_p0_quick_capture_status: card.current_gate.next_p0_quick_capture_status,
    next_p0_quick_capture_expected_row_count: card.current_gate.next_p0_quick_capture_expected_row_count,
    next_p0_quick_capture_quick_count_count: card.current_gate.next_p0_quick_capture_quick_count_count,
    next_p0_quick_capture_filled_rank_count: card.current_gate.next_p0_quick_capture_filled_rank_count,
    next_p0_quick_capture_filled_ranks: card.current_gate.next_p0_quick_capture_filled_ranks,
    next_p0_quick_capture_missing_rank_count: card.current_gate.next_p0_quick_capture_missing_rank_count,
    next_p0_quick_capture_missing_ranks: card.current_gate.next_p0_quick_capture_missing_ranks,
    next_p0_quick_capture_partial_waiting: card.current_gate.next_p0_quick_capture_partial_waiting,
    next_p0_quick_capture_partial_auto_counts: card.current_gate.next_p0_quick_capture_partial_auto_counts,
    next_p0_quick_capture_template_created: card.current_gate.next_p0_quick_capture_template_created,
    next_p0_quick_capture_paste_template_created: card.current_gate.next_p0_quick_capture_paste_template_created,
    next_p0_quick_capture_paste_template_path: card.current_gate.next_p0_quick_capture_paste_template_path,
    next_p0_quick_capture_filled_preview_created: card.current_gate.next_p0_quick_capture_filled_preview_created,
    p0_counts_preflight_status: card.current_gate.p0_counts_preflight_status,
    p0_counts_preflight_ready_for_quick_preview: card.current_gate.p0_counts_preflight_ready_for_quick_preview,
    p0_counts_preflight_expected_count_key_count: card.current_gate.p0_counts_preflight_expected_count_key_count,
    p0_counts_preflight_filled_count_key_count: card.current_gate.p0_counts_preflight_filled_count_key_count,
    p0_counts_preflight_placeholder_count_key_count: card.current_gate.p0_counts_preflight_placeholder_count_key_count,
    p0_counts_preflight_issue_count: card.current_gate.p0_counts_preflight_issue_count,
    next_p0_owner_intake_status: card.current_gate.next_p0_owner_intake_status,
    next_p0_owner_intake_candidate_found: card.current_gate.next_p0_owner_intake_candidate_found,
    next_p0_owner_intake_stage_performed: card.current_gate.next_p0_owner_intake_stage_performed,
    sample_gate_batch_handoff_status: card.current_gate.sample_gate_batch_handoff_status,
    sample_gate_batch_handoff_p0_task_count: card.current_gate.sample_gate_batch_handoff_p0_task_count,
    sample_gate_batch_handoff_all_p0_row_count: card.current_gate.sample_gate_batch_handoff_all_p0_row_count,
    sample_gate_batch_handoff_focused_batch_row_count: card.current_gate.sample_gate_batch_handoff_focused_batch_row_count,
    sample_gate_batch_handoff_remaining_batch_row_count: card.current_gate.sample_gate_batch_handoff_remaining_batch_row_count,
    sample_gate_batch_handoff_p0_pending_count: card.current_gate.sample_gate_batch_handoff_p0_pending_count,
    sample_gate_batch_handoff_batch_count: card.current_gate.sample_gate_batch_handoff_batch_count,
    sample_gate_batch_handoff_full_coverage_ready: card.current_gate.sample_gate_batch_handoff_full_coverage_ready,
    real_data_intake_status: card.current_gate.real_data_intake_status,
    real_data_intake_ready_apply_count: card.current_gate.real_data_intake_ready_apply_count,
    real_data_intake_missing_input_count: card.current_gate.real_data_intake_missing_input_count,
    real_data_intake_blocked_input_count: card.current_gate.real_data_intake_blocked_input_count,
    source_trust_status: card.current_gate.source_trust_status,
    source_trust_trusted_scoring_source_count: card.current_gate.source_trust_trusted_scoring_source_count,
    source_trust_sample_gate_source_count: card.current_gate.source_trust_sample_gate_source_count,
    source_trust_scoring_allowed_now: card.current_gate.source_trust_scoring_allowed_now,
    source_trust_real_event_rows: card.current_gate.source_trust_real_event_rows,
    source_trust_p0_pending_count: card.current_gate.source_trust_p0_pending_count,
    source_trust_sample_threshold_met: card.current_gate.source_trust_sample_threshold_met,
    source_trust_ready_for_public_iteration_decision: card.current_gate.source_trust_ready_for_public_iteration_decision,
    sample_gate_capture_calendar_status: card.current_gate.sample_gate_capture_calendar_status,
    sample_gate_capture_calendar_next_due_date: card.current_gate.sample_gate_capture_calendar_next_due_date,
    sample_gate_capture_calendar_next_due_event_id: card.current_gate.sample_gate_capture_calendar_next_due_event_id,
    sample_gate_due_status: card.current_gate.sample_gate_due_status,
    sample_gate_due_phase: card.current_gate.sample_gate_due_phase,
    sample_gate_due_now: card.current_gate.sample_gate_due_now,
    sample_gate_due_date: card.current_gate.sample_gate_due_date,
    sample_gate_due_event_id: card.current_gate.sample_gate_due_event_id,
    approval_queue_status: card.current_gate.approval_queue_status,
    approval_queue_item_count: card.current_gate.approval_queue_item_count,
    approval_queue_ready_local_review_count: card.current_gate.approval_queue_ready_local_review_count,
    approval_queue_pending_human_count: card.current_gate.approval_queue_pending_human_count,
    approval_queue_completed_local_reversible_count: card.current_gate.approval_queue_completed_local_reversible_count,
    approval_queue_high_risk_pending_count: card.current_gate.approval_queue_high_risk_pending_count,
    approval_queue_next_ready_local_review_id: card.current_gate.approval_queue_next_ready_local_review_id,
    approval_queue_next_ready_local_review_artifact: card.current_gate.approval_queue_next_ready_local_review_artifact,
    approval_queue_next_pending_human_id: card.current_gate.approval_queue_next_pending_human_id,
    approval_queue_next_pending_human_artifact: card.current_gate.approval_queue_next_pending_human_artifact,
    approval_queue_policy_ok: card.current_gate.approval_queue_policy_ok,
    gate_readiness_status: card.current_gate.gate_readiness_status,
    gate_parallel_metadata_action_count: card.current_gate.gate_parallel_metadata_action_count,
    public_ab_metadata_status: card.current_gate.public_ab_metadata_status,
    public_ab_metadata_fields_needing_input: card.current_gate.public_ab_metadata_fields_needing_input,
    public_ab_metadata_blocking_dependencies: card.current_gate.public_ab_metadata_blocking_dependencies,
    next_action_ids: card.next_actions.map((item) => item.id),
    primary_action_command: card.primary_action.command,
    external_effect: false,
    live_input_files_created: false,
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

function renderReport(card) {
  const nextRows = card.next_actions
    .map((item, index) => `| ${index + 1} | ${item.id} | ${item.status} | \`${item.command}\` | ${item.human_gate} |`)
    .join("\n");
  const artifactRows = card.review_artifacts
    .map((artifact) => `- ${artifact}`)
    .join("\n");
  const safetyRows = card.safety_rules
    .map((rule) => `- ${rule}`)
    .join("\n");

  return `# 3Q Growth Loop Owner Next Action

BLUF: ${card.bluf}

Generated: ${card.generated_at}
Mode: ${card.mode}
Status: ${card.status}
Decision: ${card.decision}
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

## Current Gate

- Owner sample-gate status: ${card.current_gate.owner_sample_gate_status}
- Owner sample-gate decision: ${card.current_gate.owner_sample_gate_decision}
- Next P0 owner inputs: ${card.current_gate.next_p0_owner_inputs_status} / current_inputs=${card.current_gate.next_p0_owner_input_count ?? 0}
- Next P0 owner form: ${card.current_gate.next_p0_owner_form_status} / rows=${card.current_gate.next_p0_owner_form_row_count ?? 0}
- Next P0 quick capture: ${card.current_gate.next_p0_quick_capture_status} / filled=${card.current_gate.next_p0_quick_capture_filled_rank_count ?? 0}/${card.current_gate.next_p0_quick_capture_expected_row_count ?? 0} / missing=${card.current_gate.next_p0_quick_capture_missing_rank_count ?? "n/a"} / partial=${card.current_gate.next_p0_quick_capture_partial_waiting ? "yes" : "no"} / template=${card.current_gate.next_p0_quick_capture_template_created ? "yes" : "no"} / paste_template=${card.current_gate.next_p0_quick_capture_paste_template_created ? "yes" : "no"} / preview=${card.current_gate.next_p0_quick_capture_filled_preview_created ? "yes" : "no"}
- P0 counts preflight: ${card.current_gate.p0_counts_preflight_status} / ready=${card.current_gate.p0_counts_preflight_ready_for_quick_preview ? "yes" : "no"} / filled=${card.current_gate.p0_counts_preflight_filled_count_key_count ?? 0}/${card.current_gate.p0_counts_preflight_expected_count_key_count ?? 0} / placeholders=${card.current_gate.p0_counts_preflight_placeholder_count_key_count ?? "n/a"} / issues=${card.current_gate.p0_counts_preflight_issue_count ?? 0}
- Next P0 owner intake: ${card.current_gate.next_p0_owner_intake_status} / found=${card.current_gate.next_p0_owner_intake_candidate_found ? "yes" : "no"} / staged=${card.current_gate.next_p0_owner_intake_stage_performed ? "yes" : "no"}
- Full P0 batch handoff: ${card.current_gate.sample_gate_batch_handoff_status} / rows=${card.current_gate.sample_gate_batch_handoff_all_p0_row_count ?? 0}/${card.current_gate.sample_gate_batch_handoff_p0_task_count ?? 0} / batches=${card.current_gate.sample_gate_batch_handoff_batch_count ?? 0} / focused=${card.current_gate.sample_gate_batch_handoff_focused_batch_row_count ?? 0} / remaining=${card.current_gate.sample_gate_batch_handoff_remaining_batch_row_count ?? 0} / pending=${card.current_gate.sample_gate_batch_handoff_p0_pending_count ?? "n/a"} / full=${card.current_gate.sample_gate_batch_handoff_full_coverage_ready ? "yes" : "no"}
- Real-data intake: ${card.current_gate.real_data_intake_status} / ready_apply=${card.current_gate.real_data_intake_ready_apply_count} / missing_inputs=${card.current_gate.real_data_intake_missing_input_count ?? "n/a"} / blocked_inputs=${card.current_gate.real_data_intake_blocked_input_count ?? "n/a"}
- Source trust: ${card.current_gate.source_trust_status} / trusted=${card.current_gate.source_trust_trusted_scoring_source_count ?? 0} / sample_gate=${card.current_gate.source_trust_sample_gate_source_count ?? 0} / scoring_now=${card.current_gate.source_trust_scoring_allowed_now ? "yes" : "no"} / real_rows=${card.current_gate.source_trust_real_event_rows ?? 0} / p0_pending=${card.current_gate.source_trust_p0_pending_count ?? "n/a"} / public_ready=${card.current_gate.source_trust_ready_for_public_iteration_decision ? "yes" : "no"}
- Capture calendar: ${card.current_gate.sample_gate_capture_calendar_status} / next=${card.current_gate.sample_gate_capture_calendar_next_due_date ?? "n/a"} / event=${card.current_gate.sample_gate_capture_calendar_next_due_event_id ?? "n/a"}
- Due status: ${card.current_gate.sample_gate_due_status} / phase=${card.current_gate.sample_gate_due_phase ?? "n/a"} / due_now=${card.current_gate.sample_gate_due_now ? "yes" : "no"} / date=${card.current_gate.sample_gate_due_date ?? "n/a"} / event=${card.current_gate.sample_gate_due_event_id ?? "n/a"}
- Owner sample-gate intake status: ${card.current_gate.owner_sample_gate_intake_status}
- Owner quality-review status: ${card.current_gate.owner_quality_review_status}
- Next-round decision: ${card.current_gate.next_round_decision}
- Approval queue: ${card.current_gate.approval_queue_status} / items=${card.current_gate.approval_queue_item_count ?? 0} / ready=${card.current_gate.approval_queue_ready_local_review_count ?? 0} / pending=${card.current_gate.approval_queue_pending_human_count ?? 0} / high_risk=${card.current_gate.approval_queue_high_risk_pending_count ?? 0} / policy_ok=${card.current_gate.approval_queue_policy_ok ? "yes" : "no"}
- Approval queue next local review: ${card.current_gate.approval_queue_next_ready_local_review_id ?? "n/a"} / ${card.current_gate.approval_queue_next_ready_local_review_artifact ?? "n/a"}
- Approval queue next human gate: ${card.current_gate.approval_queue_next_pending_human_id ?? "n/a"} / ${card.current_gate.approval_queue_next_pending_human_artifact ?? "n/a"}
- Gate readiness: ${card.current_gate.gate_readiness_status} / parallel_metadata=${card.current_gate.gate_parallel_metadata_action_count}
- Public A/B metadata: ${card.current_gate.public_ab_metadata_status} / fields=${card.current_gate.public_ab_metadata_fields_needing_input.join(", ") || "none"} / blockers=${card.current_gate.public_ab_metadata_blocking_dependencies.join(", ") || "none"}
- Sample threshold met: ${card.sample_threshold_met ? "yes" : "no"}
- Sample-rate win candidate: ${card.sample_rate_win_candidate ? "yes" : "no"}
- Owner review required: ${card.owner_review_required ? "yes" : "no"}

## Sample Gaps

| gate | gap |
|---|---:|
| visits | ${card.sample_gaps.visits} |
| cta_clicks | ${card.sample_gaps.cta_clicks} |
| line_adds | ${card.sample_gaps.line_adds} |
| test_days | ${card.sample_gaps.test_days} |
| preferred_test_days | ${card.sample_gaps.preferred_test_days} |

## Primary Action

- ID: ${card.primary_action.id}
- Status: ${card.primary_action.status}
- Title: ${card.primary_action.title}
- Command: \`${card.primary_action.command}\`
- Human gate: ${card.primary_action.human_gate}

## Next Three Actions

| order | action | status | command | human gate |
|---:|---|---|---|---|
${nextRows}

## Review Artifacts

${artifactRows}

## Safety Rules

${safetyRows}

## Red Lines

- Production deploy performed: no
- Public link change performed: no
- GitHub push or PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer-data mutation performed: no
- Payment action performed: no
- Delete action performed: no
`;
}

async function readJson(relativePath, fallback) {
  try {
    return JSON.parse(await readFile(path.join(ROOT, relativePath), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch(async (error) => {
  const status = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "owner_next_action_card",
    status: "failed",
    error: error instanceof Error ? error.message : "unknown_error",
    external_effect: false,
    live_input_files_created: false,
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
  await writeJson(COMPACT_STATUS_PATH, status);
  console.error(error);
  process.exitCode = 1;
});
