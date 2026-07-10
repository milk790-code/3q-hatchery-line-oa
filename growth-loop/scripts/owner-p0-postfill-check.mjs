import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const COMMAND_PATH = path.join(ROOT, "RUN-P0-POST-FILL-CHECK.command");
const REPORT_PATH = path.join(ROOT, "owner_p0_postfill_check.md");
const JSON_PATH = path.join(ROOT, "owner_p0_postfill_check.json");
const STATUS_PATH = path.join(ROOT, "data", "owner_p0_postfill_check_status.json");

const SAFE_COMMANDS = [
  {
    id: "p0_counts_preflight",
    command: "npm run p0:counts-preflight",
    purpose: "Read the focused paste template and report whether all P0 aggregate count keys are ready.",
  },
  {
    id: "next_p0_quick_capture",
    command: "npm run next-p0:quick",
    purpose: "Convert fully filled focused aggregate counts into a preview-only owner CSV.",
  },
  {
    id: "next_p0_owner_intake",
    command: "npm run next-p0:intake",
    purpose: "Validate the focused owner CSV and write preview-only funnel/manual conversion files.",
  },
  {
    id: "full_p0_owner_intake",
    command: "npm run owner:intake",
    purpose: "Validate the full P0 sample-gate browser download when present, without staging unless owner later runs the explicit stage command.",
  },
  {
    id: "owner_data_preflight",
    command: "npm run owner:data-preflight",
    purpose: "Score owner-preview rows against sample thresholds and win rules without applying events.",
  },
  {
    id: "data_collection_progress",
    command: "npm run data:progress",
    purpose: "Refresh the Week 0 data collection progress card.",
  },
  {
    id: "owner_sample_gate_status",
    command: "npm run owner:sample-gate",
    purpose: "Refresh full P0 sample-gate status from owner-reviewed aggregate counts.",
  },
  {
    id: "source_trust_matrix",
    command: "npm run source:trust",
    purpose: "Recompute whether the latest owner-reviewed previews are trusted for sample-gate or scoring decisions.",
  },
  {
    id: "owner_sample_count_recovery",
    command: "npm run owner:sample-count-recovery",
    purpose: "Re-score the current focused/full P0 recovery stage after counts are filled.",
  },
  {
    id: "owner_next_action",
    command: "npm run owner:next-action",
    purpose: "Refresh the single next local action after post-fill checks.",
  },
  {
    id: "sample_gate_recovery",
    command: "npm run sample-gate:recovery",
    purpose: "Refresh the Day 3 / Day 7 recovery pack.",
  },
  {
    id: "owner_p0_now",
    command: "npm run owner:p0-now",
    purpose: "Refresh the P0-now cockpit with the latest count state.",
  },
  {
    id: "owner_p0_launcher",
    command: "npm run owner:p0-launcher",
    purpose: "Refresh the narrow P0 launcher after the post-fill check.",
  },
  {
    id: "weekly_local",
    command: "npm run weekly:local",
    purpose: "Run the full local weekly chain and final artifact verifier.",
  },
];

const BLOCKED_ACTIONS = [
  "remote_d1_create_or_migrate",
  "append_to_data_lp_events_jsonl",
  "import_funnel_or_manual_apply",
  "stage_live_input_without_owner_review",
  "promote_challenger_to_champion",
  "rotate_next_variable",
  "formal_social_post_or_schedule",
  "line_push_or_broadcast",
  "public_link_change",
  "production_worker_deploy",
  "github_push_or_pr_creation",
  "customer_data_mutation",
  "payment_or_refund_action",
  "delete_data",
];

const RED_LINE_FALSE = {
  external_effect: false,
  network_calls_performed: false,
  live_input_files_created: false,
  owner_inbox_write_performed: false,
  stage_performed: false,
  apply_performed: false,
  append_performed: false,
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

const SOURCE_PATHS = {
  quick: "data/next_p0_quick_capture_status.json",
  focusedIntake: "data/next_p0_owner_intake_status.json",
  p0CountsPreflight: "data/p0_counts_preflight_status.json",
  ownerDataPreflight: "data/owner_data_preflight_status.json",
  ownerSampleGate: "data/owner_sample_gate_status.json",
  sampleGateIntake: "data/owner_sample_gate_intake_status.json",
  sampleGateBatch: "data/sample_gate_batch_handoff_status.json",
  sampleCountHandoff: "data/owner_sample_count_handoff_status.json",
  p0Now: "data/owner_p0_now_status.json",
  p0Launcher: "data/owner_p0_launcher_status.json",
  sampleCountRecovery: "data/owner_sample_count_recovery_status.json",
  sourceTrust: "data/source_trust_matrix_status.json",
  goalCompletion: "data/goal_completion_audit_status.json",
  approvalStatus: "data/approval_queue_status.json",
};

async function main() {
  const generatedAt = new Date();
  const sources = {};
  const sourceStatus = [];

  for (const [key, relativePath] of Object.entries(SOURCE_PATHS)) {
    try {
      sources[key] = await readJson(relativePath);
      sourceStatus.push({ key, file: relativePath, ok: true });
    } catch (error) {
      sources[key] = {};
      sourceStatus.push({ key, file: relativePath, ok: false, error: error.message });
    }
  }

  const postfill = buildPostfillCheck(sources, sourceStatus, generatedAt);
  const command = renderCommand(postfill);

  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeFile(COMMAND_PATH, command);
  await chmod(COMMAND_PATH, 0o755);
  await writeJson(JSON_PATH, postfill);
  await writeFile(REPORT_PATH, renderMarkdown(postfill));
  await writeJson(STATUS_PATH, buildStatus(postfill));

  console.log(JSON.stringify(buildStatus(postfill), null, 2));
  if (!postfill.ok) {
    process.exitCode = 1;
  }
}

function buildPostfillCheck(sources, sourceStatus, generatedAt) {
  const quick = sources.quick ?? {};
  const focusedIntake = sources.focusedIntake ?? {};
  const p0CountsPreflight = sources.p0CountsPreflight ?? {};
  const ownerDataPreflight = sources.ownerDataPreflight ?? {};
  const ownerSampleGate = sources.ownerSampleGate ?? {};
  const sampleGateIntake = sources.sampleGateIntake ?? {};
  const sampleGateBatch = sources.sampleGateBatch ?? {};
  const sampleCountHandoff = sources.sampleCountHandoff ?? {};
  const p0Now = sources.p0Now ?? {};
  const sampleCountRecovery = sources.sampleCountRecovery ?? {};
  const sourceTrust = sources.sourceTrust ?? {};
  const goalCompletion = sources.goalCompletion ?? {};
  const approvalStatus = sources.approvalStatus ?? {};

  const focusedReady = p0CountsPreflight.ready_for_quick_preview === true
    || quick.filled_preview_created === true
    || focusedIntake.candidate_valid === true;
  const fullP0Ready = sampleGateIntake.candidate_valid === true
    || sampleGateIntake.stage_performed === true
    || ownerSampleGate.input_exists === true;
  const previewRows = Number(focusedIntake.funnel_preview_rows ?? 0) + Number(focusedIntake.manual_preview_rows ?? 0);
  const ownerPreviewRows = Number(ownerDataPreflight.selected_source_row_count ?? 0);
  const redLineViolationCount = Number(sampleCountRecovery.red_line_violation_count ?? 0);
  const sourceMissing = sourceStatus.filter((source) => !source.ok);
  const stage = chooseStage({
    redLineViolationCount,
    ownerDataPreflight,
    ownerSampleGate,
    sampleGateIntake,
    focusedIntake,
    quick,
    p0CountsPreflight,
    sampleCountRecovery,
    previewRows,
    ownerPreviewRows,
  });

  const safeCommands = SAFE_COMMANDS.map((item, index) => ({
    order: index + 1,
    ...item,
    script: item.command.replace(/^npm run /, ""),
    external_effect: false,
  }));

  return {
    ok: sourceMissing.length === 0 && redLineViolationCount === 0,
    generated_at: generatedAt.toISOString(),
    mode: "owner_p0_postfill_check_local_only",
    status: redLineViolationCount > 0 ? "blocked_red_line_violation_detected" : stage,
    current_stage: stage,
    postfill_ready: focusedReady || fullP0Ready || ownerPreviewRows > 0 || ownerSampleGate.input_exists === true,
    expected_to_advance_now: focusedReady || fullP0Ready || ownerPreviewRows > 0,
    focused_path_ready: focusedReady,
    full_p0_path_ready: fullP0Ready,
    p0_counts_preflight_status: p0CountsPreflight.status ?? "unknown",
    p0_counts_preflight_ready_for_quick_preview: p0CountsPreflight.ready_for_quick_preview === true,
    p0_counts_preflight_filled_count_key_count: Number(p0CountsPreflight.filled_count_key_count ?? 0),
    p0_counts_preflight_expected_count_key_count: Number(p0CountsPreflight.expected_count_key_count ?? 0),
    p0_counts_preflight_placeholder_count_key_count: Number(p0CountsPreflight.placeholder_count_key_count ?? 0),
    next_p0_quick_status: quick.status ?? "unknown",
    next_p0_quick_filled_rank_count: Number(quick.filled_rank_count ?? 0),
    next_p0_quick_missing_rank_count: Number(quick.missing_rank_count ?? 0),
    next_p0_quick_filled_preview_created: quick.filled_preview_created === true,
    next_p0_intake_status: focusedIntake.status ?? "unknown",
    next_p0_intake_candidate_found: focusedIntake.candidate_found === true,
    next_p0_intake_candidate_valid: focusedIntake.candidate_valid === true,
    next_p0_intake_preview_rows: previewRows,
    owner_data_preflight_status: ownerDataPreflight.status ?? "unknown",
    owner_data_preflight_selected_source_row_count: ownerPreviewRows,
    owner_data_preflight_sample_threshold_met: ownerDataPreflight.sample_threshold_met === true,
    owner_data_preflight_challenger_win_rule_met: ownerDataPreflight.challenger_win_rule_met === true,
    owner_sample_gate_status: ownerSampleGate.status ?? "unknown",
    owner_sample_gate_input_exists: ownerSampleGate.input_exists === true,
    owner_sample_gate_filled_rows: Number(ownerSampleGate.filled_rows ?? 0),
    owner_sample_gate_pending_rows: Number(ownerSampleGate.pending_rows ?? 0),
    sample_gate_intake_status: sampleGateIntake.status ?? "unknown",
    sample_gate_intake_candidate_valid: sampleGateIntake.candidate_valid === true,
    sample_gate_intake_stage_performed: sampleGateIntake.stage_performed === true,
    sample_gate_batch_all_p0_row_count: Number(sampleGateBatch.all_p0_row_count ?? 0),
    sample_gate_batch_p0_pending_count: Number(sampleGateBatch.p0_pending_count ?? 0),
    sample_count_handoff_status: sampleCountHandoff.status ?? "unknown",
    sample_count_handoff_after_fill_command_count: Number(sampleCountHandoff.after_fill_command_count ?? 0),
    p0_now_status: p0Now.status ?? "unknown",
    p0_now_focused_missing_count: Number(p0Now.p0_focused_missing_count ?? 0),
    p0_now_focused_total_count: Number(p0Now.p0_focused_total_count ?? 0),
    sample_count_recovery_status: sampleCountRecovery.status ?? "unknown",
    sample_count_recovery_full_p0_intake_ready: sampleCountRecovery.full_p0_intake_ready === true,
    sample_count_recovery_full_p0_staged_ready: sampleCountRecovery.full_p0_staged_ready === true,
    sample_count_recovery_red_line_violation_count: redLineViolationCount,
    source_trust_status: sourceTrust.status ?? "unknown",
    source_trust_trusted_scoring_source_count: Number(sourceTrust.trusted_scoring_source_count ?? 0),
    source_trust_sample_gate_source_count: Number(sourceTrust.sample_gate_source_count ?? 0),
    source_trust_scoring_allowed_now: sourceTrust.scoring_allowed_now === true,
    source_trust_real_event_rows: Number(sourceTrust.real_event_rows ?? 0),
    source_trust_p0_pending_count: Number(sourceTrust.p0_pending_count ?? 0),
    source_trust_sample_threshold_met: sourceTrust.sample_threshold_met === true,
    source_trust_data_lp_events_write_performed: sourceTrust.data_lp_events_write_performed === true,
    source_trust_external_effect: sourceTrust.external_effect === true,
    goal_completion_status: goalCompletion.status ?? "unknown",
    goal_complete: goalCompletion.complete === true,
    current_real_event_rows: Number(goalCompletion.current_real_event_rows ?? 0),
    approval_queue_status: approvalStatus.status ?? "unknown",
    approval_queue_pending_human_count: Number(approvalStatus.pending_human_count ?? 0),
    safe_command_count: safeCommands.length,
    safe_commands: safeCommands,
    safe_command_scripts: safeCommands.map((command) => command.script),
    command_path: COMMAND_PATH,
    report_path: REPORT_PATH,
    json_path: JSON_PATH,
    status_path: STATUS_PATH,
    source_status: sourceStatus,
    missing_source_count: sourceMissing.length,
    missing_sources: sourceMissing.map((source) => source.file),
    blocked_actions: BLOCKED_ACTIONS,
    blocked_action_count: BLOCKED_ACTIONS.length,
    command_runs_local_scripts_only: true,
    command_has_external_url: false,
    command_has_forbidden_remote_cli: false,
    command_has_forbidden_git_cli: false,
    command_has_apply_or_stage_flags: false,
    command_has_delete_or_launchd_action: false,
    command_whitelist_enforced_by_verifier: true,
    next_safe_action: focusedReady || fullP0Ready
      ? "Run RUN-P0-POST-FILL-CHECK.command locally, then review source_trust_matrix.md, weekly_report.md, owner_sample_count_recovery.md, approval_queue.json, and redline_priority.md."
      : "Fill Batch 1 and Batch 2 aggregate counts first, then run RUN-P0-POST-FILL-CHECK.command.",
    ...RED_LINE_FALSE,
    note: "Local post-fill check launcher only. The generated command runs whitelisted local npm scripts and does not stage, apply, append events, deploy, post, push GitHub/LINE, mutate customer data, process payments, or delete data.",
  };
}

function chooseStage({
  redLineViolationCount,
  ownerDataPreflight,
  ownerSampleGate,
  sampleGateIntake,
  focusedIntake,
  quick,
  p0CountsPreflight,
  sampleCountRecovery,
  previewRows,
  ownerPreviewRows,
}) {
  if (redLineViolationCount > 0) return "blocked_red_line_violation_detected";
  if (ownerDataPreflight.challenger_win_rule_met === true && ownerDataPreflight.sample_threshold_met === true) {
    return "owner_review_required_before_promotion";
  }
  if (ownerDataPreflight.sample_threshold_met === true || ownerSampleGate.sample_threshold_met === true) {
    return "sample_threshold_met_owner_review_required";
  }
  if (ownerPreviewRows > 0) return "owner_preview_scored_keep_collecting";
  if (sampleGateIntake.stage_performed === true) return "full_p0_staged_run_sample_gate";
  if (sampleGateIntake.candidate_valid === true) return "full_p0_intake_ready_needs_owner_reviewed_stage";
  if (previewRows > 0 || focusedIntake.candidate_valid === true) return "focused_intake_preview_ready_run_preflight";
  if (quick.filled_preview_created === true) return "quick_preview_ready_run_intake";
  if (p0CountsPreflight.ready_for_quick_preview === true) return "focused_paste_ready_run_quick_capture";
  if (sampleCountRecovery.status) return sampleCountRecovery.status;
  return "waiting_for_owner_sample_counts";
}

function renderCommand(postfill) {
  const commandLines = postfill.safe_commands
    .map((item) => `run_step npm run ${item.script}`)
    .join("\n");

  return `#!/bin/zsh
set -eu

ROOT="${ROOT}"
cd "$ROOT"

echo "3Q Growth Loop P0 post-fill local check"
echo "Generated: ${postfill.generated_at}"
echo "Stage: ${postfill.current_stage}"
echo "Local scripts only. No deploy, public link switch, formal post, LINE push, GitHub push, payment, customer-data mutation, or data removal."
echo "Review after run: source_trust_matrix.md, weekly_report.md, owner_sample_count_recovery.md, approval_queue.json, redline_priority.md"

run_step() {
  print ""
  print ">>> $*"
  "$@"
}

${commandLines}

echo ""
echo "Post-fill local check complete. Review weekly_report.md and approval_queue.json before any external action."
`;
}

function renderMarkdown(postfill) {
  return `# 3Q Growth Loop P0 Post-Fill Local Check

BLUF: \`RUN-P0-POST-FILL-CHECK.command\` is ready as the local-only post-fill check after owner aggregate counts are filled. Current stage is \`${postfill.current_stage}\`; expected to advance now: ${postfill.expected_to_advance_now ? "yes" : "no"}.

Generated: ${postfill.generated_at}
Mode: ${postfill.mode}
Status: ${postfill.status}
Command: ${postfill.command_path}
JSON: ${postfill.json_path}
External effect: no

## Current State

- Focused path ready: ${postfill.focused_path_ready ? "yes" : "no"}
- Full P0 path ready: ${postfill.full_p0_path_ready ? "yes" : "no"}
- P0 counts preflight: ${postfill.p0_counts_preflight_status} / filled=${postfill.p0_counts_preflight_filled_count_key_count}/${postfill.p0_counts_preflight_expected_count_key_count} / placeholders=${postfill.p0_counts_preflight_placeholder_count_key_count}
- Quick capture: ${postfill.next_p0_quick_status} / filled=${postfill.next_p0_quick_filled_rank_count} / missing=${postfill.next_p0_quick_missing_rank_count}
- Focused intake: ${postfill.next_p0_intake_status} / preview_rows=${postfill.next_p0_intake_preview_rows}
- Full P0 intake: ${postfill.sample_gate_intake_status} / valid=${postfill.sample_gate_intake_candidate_valid ? "yes" : "no"} / staged=${postfill.sample_gate_intake_stage_performed ? "yes" : "no"}
- Owner preflight: ${postfill.owner_data_preflight_status} / rows=${postfill.owner_data_preflight_selected_source_row_count} / sample_met=${postfill.owner_data_preflight_sample_threshold_met ? "yes" : "no"} / win=${postfill.owner_data_preflight_challenger_win_rule_met ? "yes" : "no"}
- Sample gate: ${postfill.owner_sample_gate_status} / filled=${postfill.owner_sample_gate_filled_rows} / pending=${postfill.owner_sample_gate_pending_rows}
- Source trust: ${postfill.source_trust_status} / trusted=${postfill.source_trust_trusted_scoring_source_count} / sample_gate=${postfill.source_trust_sample_gate_source_count} / scoring_now=${postfill.source_trust_scoring_allowed_now ? "yes" : "no"} / p0_pending=${postfill.source_trust_p0_pending_count} / data_write=${postfill.source_trust_data_lp_events_write_performed ? "yes" : "no"} / external=${postfill.source_trust_external_effect ? "yes" : "no"}
- Real event rows: ${postfill.current_real_event_rows}
- Pending human approvals: ${postfill.approval_queue_pending_human_count}

## Safe Command Sequence

${postfill.safe_commands.map((item) => `${item.order}. \`${item.command}\` - ${item.purpose}`).join("\n")}

## Blocked Actions

${postfill.blocked_actions.map((action) => `- ${action}`).join("\n")}

## Safety

- Command runs local scripts only: yes
- External URLs in command: no
- Remote CLI in command: no
- GitHub push / PR: no
- Apply or stage flags: no
- data/lp_events.jsonl write performed: no
- Public link change performed: no
- Production deploy performed: no
- Formal post performed: no
- LINE push performed: no
- Customer-data mutation performed: no
- Payment action performed: no
- Delete action performed: no

## Next Safe Action

${postfill.next_safe_action}
`;
}

function buildStatus(postfill) {
  return {
    ok: postfill.ok,
    generated_at: postfill.generated_at,
    mode: postfill.mode,
    status: postfill.status,
    current_stage: postfill.current_stage,
    postfill_ready: postfill.postfill_ready,
    expected_to_advance_now: postfill.expected_to_advance_now,
    focused_path_ready: postfill.focused_path_ready,
    full_p0_path_ready: postfill.full_p0_path_ready,
    command_path: postfill.command_path,
    report_path: postfill.report_path,
    json_path: postfill.json_path,
    safe_command_count: postfill.safe_command_count,
    safe_command_scripts: postfill.safe_command_scripts,
    p0_counts_preflight_status: postfill.p0_counts_preflight_status,
    p0_counts_preflight_ready_for_quick_preview: postfill.p0_counts_preflight_ready_for_quick_preview,
    p0_counts_preflight_filled_count_key_count: postfill.p0_counts_preflight_filled_count_key_count,
    p0_counts_preflight_expected_count_key_count: postfill.p0_counts_preflight_expected_count_key_count,
    p0_counts_preflight_placeholder_count_key_count: postfill.p0_counts_preflight_placeholder_count_key_count,
    next_p0_quick_status: postfill.next_p0_quick_status,
    next_p0_quick_filled_rank_count: postfill.next_p0_quick_filled_rank_count,
    next_p0_quick_missing_rank_count: postfill.next_p0_quick_missing_rank_count,
    next_p0_intake_status: postfill.next_p0_intake_status,
    next_p0_intake_candidate_valid: postfill.next_p0_intake_candidate_valid,
    next_p0_intake_preview_rows: postfill.next_p0_intake_preview_rows,
    owner_data_preflight_status: postfill.owner_data_preflight_status,
    owner_data_preflight_selected_source_row_count: postfill.owner_data_preflight_selected_source_row_count,
    owner_data_preflight_sample_threshold_met: postfill.owner_data_preflight_sample_threshold_met,
    owner_data_preflight_challenger_win_rule_met: postfill.owner_data_preflight_challenger_win_rule_met,
    owner_sample_gate_status: postfill.owner_sample_gate_status,
    owner_sample_gate_filled_rows: postfill.owner_sample_gate_filled_rows,
    owner_sample_gate_pending_rows: postfill.owner_sample_gate_pending_rows,
    sample_gate_intake_status: postfill.sample_gate_intake_status,
    sample_gate_intake_candidate_valid: postfill.sample_gate_intake_candidate_valid,
    sample_gate_intake_stage_performed: postfill.sample_gate_intake_stage_performed,
    sample_count_recovery_status: postfill.sample_count_recovery_status,
    sample_count_recovery_red_line_violation_count: postfill.sample_count_recovery_red_line_violation_count,
    source_trust_status: postfill.source_trust_status,
    source_trust_trusted_scoring_source_count: postfill.source_trust_trusted_scoring_source_count,
    source_trust_sample_gate_source_count: postfill.source_trust_sample_gate_source_count,
    source_trust_scoring_allowed_now: postfill.source_trust_scoring_allowed_now,
    source_trust_real_event_rows: postfill.source_trust_real_event_rows,
    source_trust_p0_pending_count: postfill.source_trust_p0_pending_count,
    source_trust_sample_threshold_met: postfill.source_trust_sample_threshold_met,
    source_trust_data_lp_events_write_performed: postfill.source_trust_data_lp_events_write_performed,
    source_trust_external_effect: postfill.source_trust_external_effect,
    approval_queue_status: postfill.approval_queue_status,
    approval_queue_pending_human_count: postfill.approval_queue_pending_human_count,
    blocked_action_count: postfill.blocked_action_count,
    missing_source_count: postfill.missing_source_count,
    command_runs_local_scripts_only: postfill.command_runs_local_scripts_only,
    command_has_external_url: postfill.command_has_external_url,
    command_has_forbidden_remote_cli: postfill.command_has_forbidden_remote_cli,
    command_has_forbidden_git_cli: postfill.command_has_forbidden_git_cli,
    command_has_apply_or_stage_flags: postfill.command_has_apply_or_stage_flags,
    command_has_delete_or_launchd_action: postfill.command_has_delete_or_launchd_action,
    command_whitelist_enforced_by_verifier: postfill.command_whitelist_enforced_by_verifier,
    next_safe_action: postfill.next_safe_action,
    ...RED_LINE_FALSE,
  };
}

async function readJson(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  return JSON.parse(await readFile(absolutePath, "utf8"));
}

async function writeJson(absolutePath, value) {
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function fileExists(absolutePath) {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

main();
