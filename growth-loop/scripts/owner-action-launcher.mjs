import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const COMMAND_PATH = path.join(ROOT, "OPEN-3Q-GROWTH-LOOP.command");
const REPORT_PATH = path.join(ROOT, "owner_action_launcher.md");
const STATUS_PATH = path.join(ROOT, "data", "owner_action_launcher_status.json");

const OPEN_TARGETS = [
  {
    id: "owner_console",
    label: "Owner console",
    path: "owner_console.html",
    purpose: "Review current funnel, gates, red lines, archive, and weekly runner status.",
  },
  {
    id: "owner_next_action",
    label: "Next action card",
    path: "owner_next_action.md",
    purpose: "See the single safest next owner action before any external move.",
  },
  {
    id: "north_star_outcome_preflight",
    label: "North Star outcome preflight",
    path: "north_star_outcome_preflight.md",
    purpose: "Check whether the P1 link-click, lead, deal, and quality aggregate rows are ready for local source compile.",
  },
  {
    id: "north_star_outcome_preflight_status",
    label: "North Star outcome preflight status",
    path: "data/north_star_outcome_preflight_status.json",
    purpose: "Review compact P1 outcome filled, pending, invalid, and ready-for-compile state.",
  },
  {
    id: "north_star_outcome_form",
    label: "North Star outcome form",
    path: "north_star_outcome_form.html",
    purpose: "Fill the 24 P1 link-click, lead, deal, and quality aggregate rows in a browser-only local form.",
  },
  {
    id: "north_star_outcome_form_guard",
    label: "North Star outcome form guard",
    path: "north_star_outcome_form_fixture_report.md",
    purpose: "Review the static local-only fixture guard for the P1 outcome browser form.",
  },
  {
    id: "owner_p1_outcome_intake",
    label: "P1 outcome intake",
    path: "owner_p1_outcome_intake.md",
    purpose: "Review any downloaded P1 outcome CSV before staging it as the local owner-filled working file.",
  },
  {
    id: "owner_p1_outcome_intake_json",
    label: "P1 outcome intake JSON",
    path: "owner_p1_outcome_intake.json",
    purpose: "Review full P1 outcome download validation, source compile preview, and red-line flags before staging.",
  },
  {
    id: "owner_p1_outcome_intake_status",
    label: "P1 outcome intake status",
    path: "data/owner_p1_outcome_intake_status.json",
    purpose: "Review compact P1 outcome intake status without staging the downloaded file.",
  },
  {
    id: "owner_p1_outcome_postfill_check",
    label: "P1 outcome post-fill check",
    path: "owner_p1_outcome_postfill_check.md",
    purpose: "Review the local-only command sequence to run after the P1 outcome aggregate rows are filled.",
  },
  {
    id: "owner_p1_outcome_postfill_check_json",
    label: "P1 outcome post-fill check JSON",
    path: "owner_p1_outcome_postfill_check.json",
    purpose: "Review full P1 outcome post-fill readiness, command whitelist, and red-line flags before running the checker.",
  },
  {
    id: "owner_p1_outcome_postfill_check_status",
    label: "P1 outcome post-fill check status",
    path: "data/owner_p1_outcome_postfill_check_status.json",
    purpose: "Review compact P1 outcome post-fill checker status without executing the checker command.",
  },
  {
    id: "owner_p0_now_html",
    label: "P0 now cockpit",
    path: "owner_p0_now.html",
    purpose: "Open the compact browser cockpit for the current P0 sample-count action before the full handoff set.",
  },
  {
    id: "owner_p0_now",
    label: "P0 now markdown",
    path: "owner_p0_now.md",
    purpose: "Open the shortest current P0 sample-count action card as Markdown.",
  },
  {
    id: "sample_gate_collection_sprint",
    label: "Collection sprint",
    path: "sample_gate_collection_sprint.md",
    purpose: "Open the timeboxed local sprint for Day 3 / Day 7 P0 sample-count collection.",
  },
  {
    id: "prepared_but_blocked_report",
    label: "PreparedButBlocked handoff",
    path: "prepared_but_blocked.md",
    purpose: "Review every human-only or external blocked action before any owner-approved move.",
  },
  {
    id: "d1_schema_contract",
    label: "D1 schema contract",
    path: "d1_schema_contract.md",
    purpose: "Review the isolated two-pass migration, integrity, seed, and constraint proof before any remote D1 approval.",
  },
  {
    id: "approved_d1_config_guard",
    label: "D1 config guard",
    path: "approved_d1_config.md",
    purpose: "Review the exact-name and exact-id guard that keeps wrangler.jsonc unchanged until explicit owner approval and live metadata match.",
  },
  {
    id: "champion_github_handoff",
    label: "Champion GitHub handoff",
    path: "champion_github_handoff.md",
    purpose: "Review the known repository, branch, commit, and draft PR commands without pushing, opening, merging, or deploying.",
  },
  {
    id: "champion_github_pr_body",
    label: "Champion draft PR body",
    path: "champion_github_pr_body.md",
    purpose: "Review the exact draft PR description and downstream D1 and deploy gates.",
  },
  {
    id: "approval_queue",
    label: "Approval queue",
    path: "approval_queue.json",
    purpose: "Review every local, owner, and external-gate approval item before any irreversible move.",
  },
  {
    id: "approval_queue_status",
    label: "Approval queue status",
    path: "data/approval_queue_status.json",
    purpose: "Review compact approval queue counts, next local review, next human gate, and policy flags.",
  },
  {
    id: "sample_gate_recovery",
    label: "Sample gate recovery",
    path: "sample_gate_recovery_pack.md",
    purpose: "Recover a Day 3 / Day 7 sample-gate miss with exact aggregate rows and local-only commands.",
  },
  {
    id: "owner_sample_count_handoff",
    label: "Sample count handoff",
    path: "owner_sample_count_handoff.md",
    purpose: "Open the one-screen owner handoff for the exact missing aggregate counts and after-fill commands.",
  },
  {
    id: "owner_sample_count_paste_block",
    label: "Sample count paste block",
    path: "owner_sample_count_paste_block.txt",
    purpose: "Copy the exact aggregate-count keys into the focused paste template without copying Markdown.",
  },
  {
    id: "sample_gate_batch_handoff",
    label: "Full P0 batch handoff",
    path: "sample_gate_batch_handoff.md",
    purpose: "Review the full 18-row P0 handoff split into the focused batch and the remaining content-variant batch.",
  },
  {
    id: "sample_gate_batch_preflight",
    label: "Full P0 batch preflight",
    path: "sample_gate_batch_preflight.md",
    purpose: "Check whether the full 18-row owner-filled sample-gate ledger is ready for local source compile.",
  },
  {
    id: "sample_gate_batch_preflight_status",
    label: "Full P0 batch preflight status",
    path: "data/sample_gate_batch_preflight_status.json",
    purpose: "Review compact full-P0 batch filled, pending, invalid, and ready-for-compile state.",
  },
  {
    id: "sample_gate_batch_1_paste_block",
    label: "P0 batch 1 paste block",
    path: "sample_gate_batch_1_paste_block.txt",
    purpose: "Copy the 9 focused champion / challenger / LINE CTA aggregate keys first.",
  },
  {
    id: "sample_gate_batch_2_paste_block",
    label: "P0 batch 2 paste block",
    path: "sample_gate_batch_2_paste_block.txt",
    purpose: "Copy the remaining 9 content-variant aggregate keys before treating Week 0 P0 as fully covered.",
  },
  {
    id: "owner_sample_count_recovery",
    label: "Sample count recovery",
    path: "owner_sample_count_recovery.md",
    purpose: "Review whether quick capture, focused intake, owner preflight, and weekly verification recovered after counts were filled.",
  },
  {
    id: "owner_p0_postfill_check",
    label: "P0 post-fill check",
    path: "owner_p0_postfill_check.md",
    purpose: "Review the local-only command sequence to run after Batch 1 and Batch 2 aggregate counts are filled.",
  },
  {
    id: "owner_p0_postfill_check_json",
    label: "P0 post-fill check JSON",
    path: "owner_p0_postfill_check.json",
    purpose: "Review full post-fill readiness, command whitelist, and red-line flags before running the checker.",
  },
  {
    id: "owner_p0_postfill_check_status",
    label: "P0 post-fill check status",
    path: "data/owner_p0_postfill_check_status.json",
    purpose: "Review compact post-fill checker status without executing the checker command.",
  },
  {
    id: "worker_dry_run",
    label: "Worker dry-run report",
    path: "worker_dry_run.md",
    purpose: "Review candidate Worker dry-run evidence before approving any production deploy.",
  },
  {
    id: "worker_dry_run_status",
    label: "Worker dry-run status",
    path: "data/worker_dry_run_status.json",
    purpose: "Review compact Wrangler dry-run status; this launcher does not run Wrangler.",
  },
  {
    id: "next_p0_form",
    label: "Next P0 form",
    path: "next_p0_owner_form.html",
    purpose: "Fill only the current focused P0 aggregate rows in a browser-only local form.",
  },
  {
    id: "next_p0_intake",
    label: "Next P0 intake",
    path: "next_p0_owner_intake.md",
    purpose: "Review the focused owner download intake and local preview CSVs before staging.",
  },
  {
    id: "next_p0_quick_capture",
    label: "Next P0 quick capture",
    path: "next_p0_quick_capture.md",
    purpose: "Use the local rank-count adapter when aggregate Day 3 counts are available as short text.",
  },
  {
    id: "next_p0_paste_template",
    label: "Next P0 paste template",
    path: "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
    purpose: "Fill the exact 9 focused aggregate count rows that the next weekly run can auto-read into preview.",
  },
  {
    id: "p0_counts_preflight",
    label: "P0 counts preflight",
    path: "p0_counts_preflight.md",
    purpose: "Check whether the focused P0 paste template is waiting, partial, ready, or invalid before running quick capture.",
  },
  {
    id: "capture_calendar",
    label: "Capture calendar",
    path: "sample_gate_capture_calendar.md",
    purpose: "Review Day 3 / Day 7 sample-gate checkpoints before any winner or traffic decision.",
  },
  {
    id: "sample_gate_due_status",
    label: "Due status",
    path: "sample_gate_due_status.md",
    purpose: "Review whether the current Day 3 / Day 7 sample gate is due, waiting, or still sample-insufficient.",
  },
  {
    id: "sample_gate_form",
    label: "Sample gate form",
    path: "sample_gate_owner_form.html",
    purpose: "Fill the 18 P0 aggregate sample-gate rows in a browser-only local form.",
  },
  {
    id: "owner_approval_form",
    label: "Owner approval form",
    path: "owner_approval_form.html",
    purpose: "Prepare non-secret owner approval metadata for external gates without executing them.",
  },
  {
    id: "manual_publish_packet",
    label: "Manual publish packet",
    path: "manual_publish_packet.md",
    purpose: "Review draft-only post packets before any manual platform publish.",
  },
  {
    id: "manual_publish_evidence_form",
    label: "Manual publish evidence form",
    path: "manual_publish_evidence_form.html",
    purpose: "After an owner-manual post, capture one non-sensitive post evidence reference locally.",
  },
  {
    id: "quality_review_form",
    label: "Quality review form",
    path: "owner_quality_review_form.html",
    purpose: "After a sample-rate win candidate appears, capture aggregate no-quality-regression evidence locally.",
  },
];

async function main() {
  const generatedAt = new Date();
  const ownerNextAction = await readJson("data/owner_next_action_status.json", {});
  const ownerP0Now = await readJson("data/owner_p0_now_status.json", {});
  const ownerSampleGate = await readJson("data/owner_sample_gate_status.json", {});
  const northStarOutcomePreflight = await readJson("data/north_star_outcome_preflight_status.json", {});
  const northStarOutcomeForm = await readJson("data/north_star_outcome_form_status.json", {});
  const northStarOutcomeFormFixtures = await readJson("data/north_star_outcome_form_fixture_status.json", {});
  const ownerP1OutcomeIntake = await readJson("data/owner_p1_outcome_intake_status.json", {});
  const ownerP1OutcomePostfillCheck = await readJson("data/owner_p1_outcome_postfill_check_status.json", {});
  const nextP0QuickCapture = await readJson("data/next_p0_quick_capture_status.json", {});
  const p0CountsPreflight = await readJson("data/p0_counts_preflight_status.json", {});
  const ownerSampleCountHandoff = await readJson("data/owner_sample_count_handoff_status.json", {});
  const ownerSampleCountRecovery = await readJson("data/owner_sample_count_recovery_status.json", {});
  const ownerP0PostfillCheck = await readJson("data/owner_p0_postfill_check_status.json", {});
  const sourceTrust = await readJson("data/source_trust_matrix_status.json", {});
  const workerDryRun = await readJson("data/worker_dry_run_status.json", {});
  const sampleGateBatchHandoff = await readJson("data/sample_gate_batch_handoff_status.json", {});
  const sampleGateBatchPreflight = await readJson("data/sample_gate_batch_preflight_status.json", {});
  const sampleGateCollectionSprint = await readJson("data/sample_gate_collection_sprint_status.json", {});
  const preparedButBlockedReport = await readJson("data/prepared_but_blocked_report_status.json", {});
  const approvalStatus = await readJson("data/approval_queue_status.json", {});
  const manualPublishEvidence = await readJson("data/manual_publish_evidence_status.json", {});
  const launchReadiness = await readJson("launch_readiness.json", {});

  const targets = [];
  for (const target of OPEN_TARGETS) {
    const absolutePath = path.join(ROOT, target.path);
    const exists = await fileExists(absolutePath);
    targets.push({
      ...target,
      absolute_path: absolutePath,
      exists,
    });
  }

  const missingTargets = targets.filter((target) => !target.exists).map((target) => target.path);
  const context = {
    generatedAt,
    targets,
    ownerNextAction,
    ownerP0Now,
    ownerSampleGate,
    northStarOutcomePreflight,
    northStarOutcomeForm,
    northStarOutcomeFormFixtures,
    ownerP1OutcomeIntake,
    ownerP1OutcomePostfillCheck,
    nextP0QuickCapture,
    p0CountsPreflight,
    ownerSampleCountHandoff,
    ownerSampleCountRecovery,
    ownerP0PostfillCheck,
    sourceTrust,
    workerDryRun,
    sampleGateBatchHandoff,
    sampleGateBatchPreflight,
    sampleGateCollectionSprint,
    preparedButBlockedReport,
    approvalStatus,
    manualPublishEvidence,
    launchReadiness,
  };
  const command = renderCommand(targets, context);
  const report = renderReport(context);
  const status = {
    ok: missingTargets.length === 0,
    generated_at: generatedAt.toISOString(),
    mode: "owner_action_launcher",
    command_path: COMMAND_PATH,
    report_path: REPORT_PATH,
    target_count: targets.length,
    targets,
    missing_targets: missingTargets,
    primary_action_id: ownerNextAction.primary_action_id ?? "unknown",
    primary_action_command: ownerNextAction.primary_action_command ?? "unknown",
    owner_p0_now_status: ownerP0Now.status ?? "unknown",
    owner_p0_now_p0_focused_missing_count: ownerP0Now.p0_focused_missing_count ?? 0,
    owner_p0_now_p0_focused_total_count: ownerP0Now.p0_focused_total_count ?? 0,
    owner_p0_now_p0_full_row_count: ownerP0Now.p0_full_row_count ?? 0,
    owner_p0_now_p0_full_task_count: ownerP0Now.p0_full_task_count ?? 0,
    owner_p0_now_primary_open_target_count: ownerP0Now.primary_open_target_count ?? 0,
    owner_p0_now_sample_gate_form_status: ownerP0Now.sample_gate_form_status ?? "unknown",
    owner_p0_now_sample_gate_form_row_count: ownerP0Now.sample_gate_form_row_count ?? 0,
    owner_p0_now_sample_gate_intake_status: ownerP0Now.sample_gate_intake_status ?? "unknown",
    owner_p0_now_sample_gate_intake_candidate_found: ownerP0Now.sample_gate_intake_candidate_found ?? false,
    owner_p0_now_sample_gate_intake_stage_performed: ownerP0Now.sample_gate_intake_stage_performed ?? false,
    owner_next_action_status: ownerNextAction.status ?? "unknown",
    owner_sample_gate_status: ownerSampleGate.status ?? "unknown",
    sample_threshold_met: Boolean(ownerSampleGate.sample_threshold_met),
    north_star_outcome_preflight_status: northStarOutcomePreflight.status ?? "unknown",
    north_star_outcome_preflight_input_kind: northStarOutcomePreflight.input_kind ?? "unknown",
    north_star_outcome_preflight_owner_filled_exists: northStarOutcomePreflight.owner_filled_exists === true,
    north_star_outcome_preflight_expected_outcome_row_count: northStarOutcomePreflight.expected_outcome_row_count ?? 0,
    north_star_outcome_preflight_filled_outcome_row_count: northStarOutcomePreflight.filled_outcome_row_count ?? 0,
    north_star_outcome_preflight_pending_outcome_row_count: northStarOutcomePreflight.pending_outcome_row_count ?? 0,
    north_star_outcome_preflight_invalid_outcome_row_count: northStarOutcomePreflight.invalid_outcome_row_count ?? 0,
    north_star_outcome_preflight_ready_for_source_compile: northStarOutcomePreflight.ready_for_source_compile === true,
    north_star_outcome_preflight_external_effect: northStarOutcomePreflight.external_effect === true,
    north_star_outcome_preflight_data_lp_events_write_performed: northStarOutcomePreflight.data_lp_events_write_performed === true,
    north_star_outcome_form_status: northStarOutcomeForm.status ?? "unknown",
    north_star_outcome_form_row_count: northStarOutcomeForm.row_count ?? 0,
    north_star_outcome_form_browser_only: northStarOutcomeForm.browser_only === true,
    north_star_outcome_form_network_calls_performed: northStarOutcomeForm.network_calls_performed === true,
    north_star_outcome_form_data_lp_events_write_performed: northStarOutcomeForm.data_lp_events_write_performed === true,
    north_star_outcome_form_external_effect: northStarOutcomeForm.external_effect === true,
    north_star_outcome_form_guard_ok: northStarOutcomeFormFixtures.ok === true,
    north_star_outcome_form_guard_check_count: northStarOutcomeFormFixtures.check_count ?? 0,
    north_star_outcome_form_guard_external_effect: northStarOutcomeFormFixtures.external_effect === true,
    owner_p1_outcome_intake_status: ownerP1OutcomeIntake.status ?? "unknown",
    owner_p1_outcome_intake_candidate_found: ownerP1OutcomeIntake.candidate_found === true,
    owner_p1_outcome_intake_candidate_valid: ownerP1OutcomeIntake.candidate_valid === true,
    owner_p1_outcome_intake_preflight_ready_for_source_compile: ownerP1OutcomeIntake.preflight_ready_for_source_compile === true,
    owner_p1_outcome_intake_filled_outcome_row_count: ownerP1OutcomeIntake.filled_outcome_row_count ?? 0,
    owner_p1_outcome_intake_pending_outcome_row_count: ownerP1OutcomeIntake.pending_outcome_row_count ?? 0,
    owner_p1_outcome_intake_stage_performed: ownerP1OutcomeIntake.stage_performed === true,
    owner_p1_outcome_intake_external_effect: ownerP1OutcomeIntake.external_effect === true,
    owner_p1_outcome_intake_data_lp_events_write_performed: ownerP1OutcomeIntake.data_lp_events_write_performed === true,
    owner_p1_outcome_postfill_check_status: ownerP1OutcomePostfillCheck.status ?? "unknown",
    owner_p1_outcome_postfill_check_current_stage: ownerP1OutcomePostfillCheck.current_stage ?? "unknown",
    owner_p1_outcome_postfill_check_postfill_ready: Boolean(ownerP1OutcomePostfillCheck.postfill_ready),
    owner_p1_outcome_postfill_check_expected_to_advance_now: Boolean(ownerP1OutcomePostfillCheck.expected_to_advance_now),
    owner_p1_outcome_postfill_check_safe_command_count: ownerP1OutcomePostfillCheck.safe_command_count ?? 0,
    owner_p1_outcome_postfill_check_command_runs_local_scripts_only: ownerP1OutcomePostfillCheck.command_runs_local_scripts_only === true,
    owner_p1_outcome_postfill_check_external_effect: ownerP1OutcomePostfillCheck.external_effect === true,
    owner_p1_outcome_postfill_check_data_lp_events_write_performed: ownerP1OutcomePostfillCheck.data_lp_events_write_performed === true,
    owner_p1_outcome_postfill_check_command_path: ownerP1OutcomePostfillCheck.command_path ?? "RUN-P1-OUTCOME-POST-FILL-CHECK.command",
    next_p0_quick_capture_status: nextP0QuickCapture.status ?? "unknown",
    next_p0_quick_capture_expected_row_count: nextP0QuickCapture.expected_row_count ?? null,
    next_p0_quick_capture_quick_count_count: nextP0QuickCapture.quick_count_count ?? 0,
    next_p0_quick_capture_filled_rank_count: nextP0QuickCapture.filled_rank_count ?? 0,
    next_p0_quick_capture_missing_rank_count: nextP0QuickCapture.missing_rank_count ?? null,
    next_p0_quick_capture_missing_ranks: nextP0QuickCapture.missing_ranks ?? [],
    next_p0_quick_capture_partial_waiting: nextP0QuickCapture.partial_waiting ?? false,
    p0_counts_preflight_status: p0CountsPreflight.status ?? "unknown",
    p0_counts_preflight_ready_for_quick_preview: p0CountsPreflight.ready_for_quick_preview ?? false,
    p0_counts_preflight_filled_count_key_count: p0CountsPreflight.filled_count_key_count ?? 0,
    p0_counts_preflight_expected_count_key_count: p0CountsPreflight.expected_count_key_count ?? 0,
    p0_counts_preflight_placeholder_count_key_count: p0CountsPreflight.placeholder_count_key_count ?? 0,
    p0_counts_preflight_issue_count: p0CountsPreflight.issue_count ?? 0,
    owner_sample_count_handoff_status: ownerSampleCountHandoff.status ?? "unknown",
    owner_sample_count_handoff_after_fill_command_count: ownerSampleCountHandoff.after_fill_command_count ?? 0,
    owner_sample_count_handoff_paste_block_path: ownerSampleCountHandoff.paste_block_path ?? "owner_sample_count_paste_block.txt",
    owner_sample_count_handoff_paste_key_count: ownerSampleCountHandoff.paste_key_count ?? 0,
    owner_sample_count_handoff_paste_block_line_count: ownerSampleCountHandoff.paste_block_line_count ?? 0,
    owner_sample_count_recovery_status: ownerSampleCountRecovery.status ?? "unknown",
    owner_sample_count_recovery_full_p0_row_count: ownerSampleCountRecovery.full_p0_row_count ?? 0,
    owner_sample_count_recovery_full_p0_pending_count: ownerSampleCountRecovery.full_p0_pending_count ?? 0,
    owner_sample_count_recovery_full_p0_form_status: ownerSampleCountRecovery.full_p0_form_status ?? "unknown",
    owner_sample_count_recovery_full_p0_form_row_count: ownerSampleCountRecovery.full_p0_form_row_count ?? 0,
    owner_sample_count_recovery_full_p0_intake_status: ownerSampleCountRecovery.full_p0_intake_status ?? "unknown",
    owner_sample_count_recovery_full_p0_intake_ready: Boolean(ownerSampleCountRecovery.full_p0_intake_ready),
    owner_sample_count_recovery_full_p0_staged_ready: Boolean(ownerSampleCountRecovery.full_p0_staged_ready),
    owner_sample_count_recovery_full_p0_after_command_count: ownerSampleCountRecovery.full_p0_after_command_count ?? 0,
    owner_sample_count_recovery_red_line_violation_count: ownerSampleCountRecovery.red_line_violation_count ?? 0,
    owner_p0_postfill_check_status: ownerP0PostfillCheck.status ?? "unknown",
    owner_p0_postfill_check_current_stage: ownerP0PostfillCheck.current_stage ?? "unknown",
    owner_p0_postfill_check_postfill_ready: Boolean(ownerP0PostfillCheck.postfill_ready),
    owner_p0_postfill_check_expected_to_advance_now: Boolean(ownerP0PostfillCheck.expected_to_advance_now),
    owner_p0_postfill_check_safe_command_count: ownerP0PostfillCheck.safe_command_count ?? 0,
    owner_p0_postfill_check_command_runs_local_scripts_only: ownerP0PostfillCheck.command_runs_local_scripts_only === true,
    owner_p0_postfill_check_external_effect: ownerP0PostfillCheck.external_effect === true,
    owner_p0_postfill_check_data_lp_events_write_performed: ownerP0PostfillCheck.data_lp_events_write_performed === true,
    owner_p0_postfill_check_command_path: ownerP0PostfillCheck.command_path ?? "RUN-P0-POST-FILL-CHECK.command",
    source_trust_status: sourceTrust.status ?? "unknown",
    source_trust_trusted_scoring_source_count: sourceTrust.trusted_scoring_source_count ?? 0,
    source_trust_sample_gate_source_count: sourceTrust.sample_gate_source_count ?? 0,
    source_trust_scoring_allowed_now: sourceTrust.scoring_allowed_now === true,
    source_trust_real_event_rows: sourceTrust.real_event_rows ?? 0,
    source_trust_p0_pending_count: sourceTrust.p0_pending_count ?? 0,
    source_trust_sample_threshold_met: sourceTrust.sample_threshold_met === true,
    source_trust_ready_for_public_iteration_decision: sourceTrust.ready_for_public_iteration_decision === true,
    source_trust_external_effect: sourceTrust.external_effect === true,
    source_trust_data_lp_events_write_performed: sourceTrust.data_lp_events_write_performed === true,
    worker_dry_run_status: workerDryRun.ok === true ? "ok" : "not_ready",
    worker_dry_run_exit_observed: Boolean(workerDryRun.dry_run_exit_observed),
    worker_dry_run_required_markers_present: Boolean(workerDryRun.required_markers_present),
    worker_dry_run_production_deploy_performed: workerDryRun.production_deploy_performed === true,
    worker_dry_run_external_effect: workerDryRun.external_effect === true,
    worker_dry_run_report_path: workerDryRun.report_path ?? "worker_dry_run.md",
    worker_dry_run_log_path: workerDryRun.log_path ?? null,
    sample_gate_batch_handoff_status: sampleGateBatchHandoff.status ?? "unknown",
    sample_gate_batch_handoff_p0_task_count: sampleGateBatchHandoff.p0_task_count ?? 0,
    sample_gate_batch_handoff_all_p0_row_count: sampleGateBatchHandoff.all_p0_row_count ?? 0,
    sample_gate_batch_handoff_focused_batch_row_count: sampleGateBatchHandoff.focused_batch_row_count ?? 0,
    sample_gate_batch_handoff_remaining_batch_row_count: sampleGateBatchHandoff.remaining_batch_row_count ?? 0,
    sample_gate_batch_handoff_p0_pending_count: sampleGateBatchHandoff.p0_pending_count ?? 0,
    sample_gate_batch_handoff_batch_count: sampleGateBatchHandoff.batch_count ?? 0,
    sample_gate_batch_handoff_full_coverage_ready: Boolean(sampleGateBatchHandoff.full_coverage_ready),
    sample_gate_batch_preflight_status: sampleGateBatchPreflight.status ?? "unknown",
    sample_gate_batch_preflight_input_kind: sampleGateBatchPreflight.input_kind ?? "unknown",
    sample_gate_batch_preflight_owner_filled_exists: sampleGateBatchPreflight.owner_filled_exists === true,
    sample_gate_batch_preflight_expected_p0_row_count: sampleGateBatchPreflight.expected_p0_row_count ?? 0,
    sample_gate_batch_preflight_filled_p0_row_count: sampleGateBatchPreflight.filled_p0_row_count ?? 0,
    sample_gate_batch_preflight_pending_p0_row_count: sampleGateBatchPreflight.pending_p0_row_count ?? 0,
    sample_gate_batch_preflight_invalid_p0_row_count: sampleGateBatchPreflight.invalid_p0_row_count ?? 0,
    sample_gate_batch_preflight_ready_for_source_compile: sampleGateBatchPreflight.ready_for_source_compile === true,
    sample_gate_batch_preflight_external_effect: sampleGateBatchPreflight.external_effect === true,
    sample_gate_batch_preflight_data_lp_events_write_performed: sampleGateBatchPreflight.data_lp_events_write_performed === true,
    sample_gate_collection_sprint_status: sampleGateCollectionSprint.status ?? "unknown",
    sample_gate_collection_sprint_p0_pending_count: sampleGateCollectionSprint.p0_pending_count ?? 0,
    sample_gate_collection_sprint_step_count: sampleGateCollectionSprint.sprint_step_count ?? 0,
    prepared_but_blocked_report_status: preparedButBlockedReport.status ?? "unknown",
    prepared_but_blocked_blocked_item_count: preparedButBlockedReport.blocked_item_count ?? 0,
    prepared_but_blocked_pending_human_approval_count: preparedButBlockedReport.pending_human_approval_count ?? 0,
    prepared_but_blocked_redline_queue_covered: Boolean(preparedButBlockedReport.redline_queue_covered),
    prepared_but_blocked_no_autorun_for_external_gates: Boolean(preparedButBlockedReport.no_autorun_for_external_gates),
    approval_queue_status: approvalStatus.status ?? "unknown",
    approval_queue_item_count: approvalStatus.item_count ?? 0,
    approval_queue_ready_local_review_count: approvalStatus.ready_local_review_count ?? 0,
    approval_queue_pending_human_count: approvalStatus.pending_human_count ?? 0,
    approval_queue_high_risk_pending_count: approvalStatus.high_risk_pending_count ?? 0,
    approval_queue_next_ready_local_review_id: approvalStatus.next_ready_local_review_id ?? "none",
    approval_queue_next_pending_human_id: approvalStatus.next_pending_human_id ?? "none",
    approval_queue_policy_ok: approvalStatus.policy_ok === true,
    approval_queue_pending_human_ids: approvalStatus.pending_human_ids ?? [],
    approval_queue_ready_local_review_ids: approvalStatus.ready_local_review_ids ?? [],
    manual_publish_evidence_status: manualPublishEvidence.status ?? "unknown",
    launch_readiness_status: launchReadiness.status ?? "unknown",
    command_opens_local_files_only: true,
    opens_external_urls: false,
    network_calls_performed: false,
    browser_persistence: false,
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
    note: "Local launcher only. The generated .command opens local review files and forms; it does not submit, publish, deploy, push, send LINE, mutate customer data, process payments, or delete data.",
  };

  await writeFile(COMMAND_PATH, command);
  await chmod(COMMAND_PATH, 0o755);
  await writeFile(REPORT_PATH, report);
  await writeJson(STATUS_PATH, status);
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

function renderCommand(targets, context) {
  const openLines = targets
    .map((target) => `open "$ROOT/${target.path}"`)
    .join("\n");
  const quick = context.nextP0QuickCapture ?? {};
  const missingRanks = Array.isArray(quick.missing_ranks) && quick.missing_ranks.length > 0
    ? quick.missing_ranks.join(",")
    : "none";
  const primaryAction = context.ownerNextAction?.primary_action_id ?? "unknown";
  const approval = context.approvalStatus ?? {};
  const p0Now = context.ownerP0Now ?? {};
  const preflight = context.p0CountsPreflight ?? {};
  const recovery = context.ownerSampleCountRecovery ?? {};
  const postfill = context.ownerP0PostfillCheck ?? {};
  const sourceTrust = context.sourceTrust ?? {};
  const workerDryRun = context.workerDryRun ?? {};
  const outcomePreflight = context.northStarOutcomePreflight ?? {};
  const outcomeForm = context.northStarOutcomeForm ?? {};
  const outcomeFormFixtures = context.northStarOutcomeFormFixtures ?? {};
  const p1Intake = context.ownerP1OutcomeIntake ?? {};
  const p1Postfill = context.ownerP1OutcomePostfillCheck ?? {};
  const batchPreflight = context.sampleGateBatchPreflight ?? {};
  const sprint = context.sampleGateCollectionSprint ?? {};

  return `#!/bin/zsh
set -eu

ROOT="${ROOT}"
cd "$ROOT"

echo "Opening 3Q Growth Loop local owner review files..."
echo "No external URLs, deploys, posts, LINE sends, payments, customer-data changes, or removal actions are performed by this launcher."
echo "Primary action: ${escapeForDoubleQuotedShell(primaryAction)}"
echo "Primary action details: owner_next_action.md"
echo "P0 now: ${escapeForDoubleQuotedShell(p0Now.status ?? "unknown")} / focused missing ${Number(p0Now.p0_focused_missing_count ?? 0)}/${Number(p0Now.p0_focused_total_count ?? 0)}, full P0 ${Number(p0Now.p0_full_row_count ?? 0)}/${Number(p0Now.p0_full_task_count ?? 0)}"
echo "Full P0 form/intake: form ${escapeForDoubleQuotedShell(p0Now.sample_gate_form_status ?? "unknown")} rows ${Number(p0Now.sample_gate_form_row_count ?? 0)}, intake ${escapeForDoubleQuotedShell(p0Now.sample_gate_intake_status ?? "unknown")}, candidate ${p0Now.sample_gate_intake_candidate_found ? "yes" : "no"}, staged ${p0Now.sample_gate_intake_stage_performed ? "yes" : "no"}"
echo "Quick count progress: filled ${Number(quick.filled_rank_count ?? 0)}/${Number(quick.expected_row_count ?? 0)}, missing ${Number(quick.missing_rank_count ?? 0)}, partial ${quick.partial_waiting ? "yes" : "no"}"
echo "P0 counts preflight: ${escapeForDoubleQuotedShell(preflight.status ?? "unknown")} / ready ${preflight.ready_for_quick_preview ? "yes" : "no"} / filled ${Number(preflight.filled_count_key_count ?? 0)}/${Number(preflight.expected_count_key_count ?? 0)} / placeholders ${Number(preflight.placeholder_count_key_count ?? 0)} / issues ${Number(preflight.issue_count ?? 0)}"
echo "North Star outcome preflight: ${escapeForDoubleQuotedShell(outcomePreflight.status ?? "unknown")} / input ${escapeForDoubleQuotedShell(outcomePreflight.input_kind ?? "unknown")} / filled ${Number(outcomePreflight.filled_outcome_row_count ?? 0)}/${Number(outcomePreflight.expected_outcome_row_count ?? 0)} / pending ${Number(outcomePreflight.pending_outcome_row_count ?? 0)} / invalid ${Number(outcomePreflight.invalid_outcome_row_count ?? 0)} / ready compile ${outcomePreflight.ready_for_source_compile ? "yes" : "no"}"
echo "North Star outcome form: ${escapeForDoubleQuotedShell(outcomeForm.status ?? "unknown")} / rows ${Number(outcomeForm.row_count ?? 0)} / browser ${outcomeForm.browser_only ? "yes" : "no"} / network ${outcomeForm.network_calls_performed ? "yes" : "no"} / guard ${outcomeFormFixtures.ok ? "ok" : "not_ready"}"
echo "P1 outcome intake: ${escapeForDoubleQuotedShell(p1Intake.status ?? "unknown")} / candidate ${p1Intake.candidate_found ? "yes" : "no"} / valid ${p1Intake.candidate_valid ? "yes" : "no"} / filled ${Number(p1Intake.filled_outcome_row_count ?? 0)}/${Number(p1Intake.expected_outcome_row_count ?? 0)} / pending ${Number(p1Intake.pending_outcome_row_count ?? 0)} / staged ${p1Intake.stage_performed ? "yes" : "no"}"
echo "P1 outcome post-fill check: ${escapeForDoubleQuotedShell(p1Postfill.status ?? "unknown")} / stage ${escapeForDoubleQuotedShell(p1Postfill.current_stage ?? "unknown")} / ready ${p1Postfill.postfill_ready ? "yes" : "no"} / expected advance ${p1Postfill.expected_to_advance_now ? "yes" : "no"} / safe commands ${Number(p1Postfill.safe_command_count ?? 0)}"
echo "Missing ranks: ${escapeForDoubleQuotedShell(missingRanks)}"
echo "Sample count recovery: ${escapeForDoubleQuotedShell(recovery.status ?? "unknown")} / full P0 ${Number(recovery.full_p0_row_count ?? 0)} rows, pending ${Number(recovery.full_p0_pending_count ?? 0)}, form ${escapeForDoubleQuotedShell(recovery.full_p0_form_status ?? "unknown")} rows ${Number(recovery.full_p0_form_row_count ?? 0)}, intake ${escapeForDoubleQuotedShell(recovery.full_p0_intake_status ?? "unknown")}, intake ready ${recovery.full_p0_intake_ready ? "yes" : "no"}, staged ${recovery.full_p0_staged_ready ? "yes" : "no"}, after commands ${Number(recovery.full_p0_after_command_count ?? 0)}"
echo "P0 post-fill check: ${escapeForDoubleQuotedShell(postfill.status ?? "unknown")} / stage ${escapeForDoubleQuotedShell(postfill.current_stage ?? "unknown")} / ready ${postfill.postfill_ready ? "yes" : "no"} / expected advance ${postfill.expected_to_advance_now ? "yes" : "no"} / safe commands ${Number(postfill.safe_command_count ?? 0)}"
echo "Source trust: ${escapeForDoubleQuotedShell(sourceTrust.status ?? "unknown")} / trusted ${Number(sourceTrust.trusted_scoring_source_count ?? 0)} / sample gate ${Number(sourceTrust.sample_gate_source_count ?? 0)} / scoring ${sourceTrust.scoring_allowed_now ? "yes" : "no"} / P0 pending ${Number(sourceTrust.p0_pending_count ?? 0)}"
echo "Post-fill command: ./RUN-P0-POST-FILL-CHECK.command (not auto-run by this launcher)"
echo "P1 outcome post-fill command: ./RUN-P1-OUTCOME-POST-FILL-CHECK.command (not auto-run by this launcher)"
echo "Worker dry run: ${workerDryRun.ok ? "ok" : "not_ready"} / exit ${workerDryRun.dry_run_exit_observed ? "yes" : "no"} / production deploy ${workerDryRun.production_deploy_performed ? "yes" : "no"} / external ${workerDryRun.external_effect ? "yes" : "no"}"
echo "Full P0 batch handoff: rows ${Number(context.sampleGateBatchHandoff?.all_p0_row_count ?? 0)}/${Number(context.sampleGateBatchHandoff?.p0_task_count ?? 0)}, focused ${Number(context.sampleGateBatchHandoff?.focused_batch_row_count ?? 0)}, remaining ${Number(context.sampleGateBatchHandoff?.remaining_batch_row_count ?? 0)}"
echo "Full P0 batch preflight: ${escapeForDoubleQuotedShell(batchPreflight.status ?? "unknown")} / input ${escapeForDoubleQuotedShell(batchPreflight.input_kind ?? "unknown")} / filled ${Number(batchPreflight.filled_p0_row_count ?? 0)}/${Number(batchPreflight.expected_p0_row_count ?? 0)} / pending ${Number(batchPreflight.pending_p0_row_count ?? 0)} / invalid ${Number(batchPreflight.invalid_p0_row_count ?? 0)} / ready compile ${batchPreflight.ready_for_source_compile ? "yes" : "no"}"
echo "Collection sprint: ${escapeForDoubleQuotedShell(sprint.status ?? "unknown")} / pending ${Number(sprint.p0_pending_count ?? 0)}/${Number(sprint.p0_full_task_count ?? 0)} / steps ${Number(sprint.sprint_step_count ?? 0)}"
echo "Approval queue: ${escapeForDoubleQuotedShell(approval.status ?? "unknown")} / items ${Number(approval.item_count ?? 0)}, ready ${Number(approval.ready_local_review_count ?? 0)}, pending ${Number(approval.pending_human_count ?? 0)}, high-risk ${Number(approval.high_risk_pending_count ?? 0)}, next human ${escapeForDoubleQuotedShell(approval.next_pending_human_id ?? "none")}"

${openLines}

echo ""
echo "Opened local files:"
${targets.map((target) => `echo "- ${target.path}"`).join("\n")}
echo ""
echo "Next: fill batch 1 first, then batch 2, then follow the After Fill Commands in owner_sample_count_handoff.md."
echo "Close this Terminal window when finished."
`;
}

function renderReport(context) {
  const rows = context.targets
    .map((target) => `| ${target.label} | ${target.path} | ${target.exists ? "yes" : "missing"} | ${target.purpose} |`)
    .join("\n");

  const sampleGateBatch = context.sampleGateBatchHandoff ?? {};
  const batchPreflight = context.sampleGateBatchPreflight ?? {};
  const approval = context.approvalStatus ?? {};
  const recovery = context.ownerSampleCountRecovery ?? {};
  const postfill = context.ownerP0PostfillCheck ?? {};
  const sourceTrust = context.sourceTrust ?? {};
  const workerDryRun = context.workerDryRun ?? {};
  const outcomePreflight = context.northStarOutcomePreflight ?? {};
  const outcomeForm = context.northStarOutcomeForm ?? {};
  const outcomeFormFixtures = context.northStarOutcomeFormFixtures ?? {};
  const p1Intake = context.ownerP1OutcomeIntake ?? {};
  const p1Postfill = context.ownerP1OutcomePostfillCheck ?? {};
  const sprint = context.sampleGateCollectionSprint ?? {};

  return `# 3Q Growth Loop Owner Action Launcher

BLUF: This is a local one-click starting point for the current owner task. It opens the local console, next-action card, P0-now card, P1 North Star outcome preflight/form/guard/intake/post-fill status, PreparedButBlocked handoff, approval queue, approval queue status, sample-gate recovery pack, sample-count handoff, full P0 batch handoff, full P0 batch preflight, copy-only batch paste blocks, sample-count recovery status, P0 post-fill check report/status, Worker dry-run report/status, focused Next P0 form, focused Next P0 intake, focused paste template, sample-gate capture calendar, sample-gate due status, sample-gate form, manual publish packet, manual publish evidence form, and quality review form. It performs no external action and does not auto-stage P1 outcome downloads, auto-run RUN-P0-POST-FILL-CHECK.command, auto-run RUN-P1-OUTCOME-POST-FILL-CHECK.command, or run wrangler.

Generated: ${context.generatedAt.toISOString()}
Command: OPEN-3Q-GROWTH-LOOP.command
Primary action: ${context.ownerNextAction.primary_action_id ?? "unknown"}
Primary action command: ${context.ownerNextAction.primary_action_command ?? "unknown"}
P0 now: ${context.ownerP0Now.status ?? "unknown"} / focused=${context.ownerP0Now.p0_focused_missing_count ?? 0}/${context.ownerP0Now.p0_focused_total_count ?? 0} / full=${context.ownerP0Now.p0_full_row_count ?? 0}/${context.ownerP0Now.p0_full_task_count ?? 0} / open_targets=${context.ownerP0Now.primary_open_target_count ?? 0}
Full P0 form/intake: form=${context.ownerP0Now.sample_gate_form_status ?? "unknown"} / rows=${context.ownerP0Now.sample_gate_form_row_count ?? 0} / intake=${context.ownerP0Now.sample_gate_intake_status ?? "unknown"} / candidate=${context.ownerP0Now.sample_gate_intake_candidate_found ? "yes" : "no"} / staged=${context.ownerP0Now.sample_gate_intake_stage_performed ? "yes" : "no"}
Owner next-action status: ${context.ownerNextAction.status ?? "unknown"}
Owner sample-gate status: ${context.ownerSampleGate.status ?? "unknown"}
Sample threshold met: ${context.ownerSampleGate.sample_threshold_met ? "yes" : "no"}
Quick count status: ${context.nextP0QuickCapture.status ?? "unknown"}
Quick count progress: filled ${context.nextP0QuickCapture.filled_rank_count ?? 0}/${context.nextP0QuickCapture.expected_row_count ?? 0}, missing ${context.nextP0QuickCapture.missing_rank_count ?? "n/a"}, partial ${context.nextP0QuickCapture.partial_waiting ? "yes" : "no"}
P0 counts preflight: ${context.p0CountsPreflight.status ?? "unknown"} / ready=${context.p0CountsPreflight.ready_for_quick_preview ? "yes" : "no"} / filled=${context.p0CountsPreflight.filled_count_key_count ?? 0}/${context.p0CountsPreflight.expected_count_key_count ?? 0} / placeholders=${context.p0CountsPreflight.placeholder_count_key_count ?? 0} / issues=${context.p0CountsPreflight.issue_count ?? 0}
North Star outcome preflight: ${outcomePreflight.status ?? "unknown"} / input=${outcomePreflight.input_kind ?? "unknown"} / filled=${outcomePreflight.filled_outcome_row_count ?? 0}/${outcomePreflight.expected_outcome_row_count ?? 0} / pending=${outcomePreflight.pending_outcome_row_count ?? 0} / invalid=${outcomePreflight.invalid_outcome_row_count ?? 0} / ready_compile=${outcomePreflight.ready_for_source_compile ? "yes" : "no"} / data_write=${outcomePreflight.data_lp_events_write_performed ? "yes" : "no"} / external=${outcomePreflight.external_effect ? "yes" : "no"}
North Star outcome form: ${outcomeForm.status ?? "unknown"} / rows=${outcomeForm.row_count ?? 0} / browser=${outcomeForm.browser_only ? "yes" : "no"} / network=${outcomeForm.network_calls_performed ? "yes" : "no"} / data_write=${outcomeForm.data_lp_events_write_performed ? "yes" : "no"} / external=${outcomeForm.external_effect ? "yes" : "no"} / guard=${outcomeFormFixtures.ok ? "ok" : "not_ready"} / checks=${outcomeFormFixtures.check_count ?? 0}
P1 outcome intake: ${p1Intake.status ?? "unknown"} / candidate=${p1Intake.candidate_found ? "yes" : "no"} / valid=${p1Intake.candidate_valid ? "yes" : "no"} / filled=${p1Intake.filled_outcome_row_count ?? 0}/${p1Intake.expected_outcome_row_count ?? 0} / pending=${p1Intake.pending_outcome_row_count ?? 0} / staged=${p1Intake.stage_performed ? "yes" : "no"} / data_write=${p1Intake.data_lp_events_write_performed ? "yes" : "no"} / external=${p1Intake.external_effect ? "yes" : "no"}
P1 outcome post-fill check: ${p1Postfill.status ?? "unknown"} / stage=${p1Postfill.current_stage ?? "unknown"} / ready=${p1Postfill.postfill_ready ? "yes" : "no"} / expected_advance=${p1Postfill.expected_to_advance_now ? "yes" : "no"} / commands=${p1Postfill.safe_command_count ?? 0} / local_only=${p1Postfill.command_runs_local_scripts_only ? "yes" : "no"} / data_write=${p1Postfill.data_lp_events_write_performed ? "yes" : "no"} / external=${p1Postfill.external_effect ? "yes" : "no"}
Missing ranks: ${Array.isArray(context.nextP0QuickCapture.missing_ranks) && context.nextP0QuickCapture.missing_ranks.length > 0 ? context.nextP0QuickCapture.missing_ranks.join(", ") : "none"}
Sample count handoff: ${context.ownerSampleCountHandoff.status ?? "unknown"} / paste_keys=${context.ownerSampleCountHandoff.paste_key_count ?? 0} / paste_block_lines=${context.ownerSampleCountHandoff.paste_block_line_count ?? 0} / after_fill_commands=${context.ownerSampleCountHandoff.after_fill_command_count ?? 0}
Sample count recovery: ${recovery.status ?? "unknown"} / full=${recovery.full_p0_row_count ?? 0} / pending=${recovery.full_p0_pending_count ?? 0} / form=${recovery.full_p0_form_status ?? "unknown"}:${recovery.full_p0_form_row_count ?? 0} / intake=${recovery.full_p0_intake_status ?? "unknown"} / intake_ready=${recovery.full_p0_intake_ready ? "yes" : "no"} / staged=${recovery.full_p0_staged_ready ? "yes" : "no"} / after_commands=${recovery.full_p0_after_command_count ?? 0} / redlines=${recovery.red_line_violation_count ?? 0}
P0 post-fill check: ${postfill.status ?? "unknown"} / stage=${postfill.current_stage ?? "unknown"} / ready=${postfill.postfill_ready ? "yes" : "no"} / expected_advance=${postfill.expected_to_advance_now ? "yes" : "no"} / safe_commands=${postfill.safe_command_count ?? 0} / local_only=${postfill.command_runs_local_scripts_only ? "yes" : "no"} / data_write=${postfill.data_lp_events_write_performed ? "yes" : "no"} / external=${postfill.external_effect ? "yes" : "no"}
Source trust: ${sourceTrust.status ?? "unknown"} / trusted=${sourceTrust.trusted_scoring_source_count ?? 0} / sample_gate=${sourceTrust.sample_gate_source_count ?? 0} / scoring=${sourceTrust.scoring_allowed_now ? "yes" : "no"} / real_rows=${sourceTrust.real_event_rows ?? 0} / p0_pending=${sourceTrust.p0_pending_count ?? 0} / public_ready=${sourceTrust.ready_for_public_iteration_decision ? "yes" : "no"} / data_write=${sourceTrust.data_lp_events_write_performed ? "yes" : "no"} / external=${sourceTrust.external_effect ? "yes" : "no"}
P0 post-fill command: RUN-P0-POST-FILL-CHECK.command is intentionally not opened by this launcher; run it manually only after Batch 1 and Batch 2 aggregate counts are filled.
P1 outcome post-fill command: RUN-P1-OUTCOME-POST-FILL-CHECK.command is intentionally not opened by this launcher; run it manually only after the P1 outcome aggregate rows are filled and reviewed.
Worker dry run: ${workerDryRun.ok ? "ok" : "not_ready"} / dry_run_exit=${workerDryRun.dry_run_exit_observed ? "yes" : "no"} / bindings=${workerDryRun.required_markers_present ? "yes" : "no"} / production_deploy=${workerDryRun.production_deploy_performed ? "yes" : "no"} / external=${workerDryRun.external_effect ? "yes" : "no"} / report=${workerDryRun.report_path ?? "worker_dry_run.md"}
Full P0 batch handoff: ${sampleGateBatch.status ?? "unknown"} / rows=${sampleGateBatch.all_p0_row_count ?? 0}/${sampleGateBatch.p0_task_count ?? 0} / batches=${sampleGateBatch.batch_count ?? 0} / focused=${sampleGateBatch.focused_batch_row_count ?? 0} / remaining=${sampleGateBatch.remaining_batch_row_count ?? 0} / pending=${sampleGateBatch.p0_pending_count ?? 0} / full=${sampleGateBatch.full_coverage_ready ? "yes" : "no"}
Full P0 batch preflight: ${batchPreflight.status ?? "unknown"} / input=${batchPreflight.input_kind ?? "unknown"} / filled=${batchPreflight.filled_p0_row_count ?? 0}/${batchPreflight.expected_p0_row_count ?? 0} / pending=${batchPreflight.pending_p0_row_count ?? 0} / invalid=${batchPreflight.invalid_p0_row_count ?? 0} / ready_compile=${batchPreflight.ready_for_source_compile ? "yes" : "no"} / data_write=${batchPreflight.data_lp_events_write_performed ? "yes" : "no"} / external=${batchPreflight.external_effect ? "yes" : "no"}
Collection sprint: ${sprint.status ?? "unknown"} / pending=${sprint.p0_pending_count ?? 0}/${sprint.p0_full_task_count ?? 0} / steps=${sprint.sprint_step_count ?? 0}
PreparedButBlocked: ${context.preparedButBlockedReport.status ?? "unknown"} / blocked=${context.preparedButBlockedReport.blocked_item_count ?? 0} / pending=${context.preparedButBlockedReport.pending_human_approval_count ?? 0} / autorun=${context.preparedButBlockedReport.no_autorun_for_external_gates ? "no" : "attention"}
Approval queue: ${approval.status ?? "unknown"} / items=${approval.item_count ?? 0} / ready=${approval.ready_local_review_count ?? 0} / pending=${approval.pending_human_count ?? 0} / high_risk=${approval.high_risk_pending_count ?? 0} / next_ready=${approval.next_ready_local_review_id ?? "none"} / next_human=${approval.next_pending_human_id ?? "none"} / policy_ok=${approval.policy_ok ? "yes" : "no"}
Manual publish evidence status: ${context.manualPublishEvidence.status ?? "unknown"}
Launch readiness: ${context.launchReadiness.status ?? "unknown"}

## Open Targets

| target | local path | exists | purpose |
|---|---|---|---|
${rows}

## Safety Contract

- Opens local files only: yes
- External URLs: no
- Network calls: no
- Browser persistence: no
- Live input files created by generator: no
- data/lp_events.jsonl write: no
- Formal post / schedule / send: no
- LINE push: no
- Production deploy: no
- GitHub push / PR: no
- Public link change: no
- Customer data mutation: no
- Payment action: no
- Delete action: no

## Intended Use

1. Run or double-click OPEN-3Q-GROWTH-LOOP.command.
2. Check sample_gate_capture_calendar.md for the current Day 3 / Day 7 sample-gate review timing.
3. Check sample_gate_due_status.md to see whether the current checkpoint is due now.
4. Open sample_gate_batch_handoff.md. Fill sample_gate_batch_1_paste_block.txt first, then sample_gate_batch_2_paste_block.txt before treating P0 as fully covered.
5. Open p0_counts_preflight.md before running quick capture; it must be ready before npm run next-p0:quick can create a preview from the paste template.
6. Copy owner_sample_count_paste_block.txt into the focused paste template when using the quick path, then replace only aggregate placeholders; or use the focused Next P0 form / full sample-gate form when you need a browser export.
7. Use north_star_outcome_form.html for the P1 outcome rows only after P0 sample-count collection is clear enough to protect the click -> LINE -> lead -> deal funnel.
8. Open owner_p1_outcome_intake.md after downloading source_capture_ledger.filled.csv from the P1 form. Stage only after review with npm run owner:p1-outcome-intake -- --input=<reviewed-csv-path> --stage --confirm-owner-reviewed.
9. Open owner_p1_outcome_postfill_check.md and confirm it is still local-only. After the P1 outcome aggregate rows are staged, run ./RUN-P1-OUTCOME-POST-FILL-CHECK.command manually; this launcher does not auto-run it.
10. Open owner_p0_postfill_check.md and confirm it is still local-only. After Batch 1 and Batch 2 aggregate counts are filled, run ./RUN-P0-POST-FILL-CHECK.command manually; this launcher does not auto-run it.
11. Follow the refreshed local reports after the post-fill commands finish: weekly_report.md, owner_sample_count_recovery.md, source_trust_matrix.md, approval_queue.json, and redline_priority.md.
12. Keep all external actions in owner_approval_pack.md as separate owner gates.
`;
}

function escapeForDoubleQuotedShell(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"")
    .replaceAll("$", "\\$")
    .replaceAll("`", "\\`");
}

async function readJson(relativePath, fallback) {
  try {
    return JSON.parse(await readFile(path.join(ROOT, relativePath), "utf8"));
  } catch {
    return fallback;
  }
}

async function fileExists(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main();
