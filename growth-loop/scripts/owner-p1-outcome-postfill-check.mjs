import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const COMMAND_PATH = path.join(ROOT, "RUN-P1-OUTCOME-POST-FILL-CHECK.command");
const REPORT_PATH = path.join(ROOT, "owner_p1_outcome_postfill_check.md");
const JSON_PATH = path.join(ROOT, "owner_p1_outcome_postfill_check.json");
const STATUS_PATH = path.join(ROOT, "data", "owner_p1_outcome_postfill_check_status.json");

const SAFE_COMMANDS = [
  {
    id: "north_star_outcome_preflight",
    command: "npm run north-star:outcome-preflight",
    purpose: "Validate the owner-reviewed P1 link-click, lead, deal, and quality aggregate rows.",
  },
  {
    id: "source_capture_compile",
    command: "npm run source:compile",
    purpose: "Compile owner-preview aggregate CSVs from reviewed source-capture rows without creating live inputs.",
  },
  {
    id: "real_data_intake_plan",
    command: "npm run real-data:intake",
    purpose: "Refresh the owner-gated intake plan for any reviewed real aggregate CSVs.",
  },
  {
    id: "data_collection_progress",
    command: "npm run data:progress",
    purpose: "Refresh P0/P1 collection progress after outcome rows are reviewed.",
  },
  {
    id: "source_trust_matrix",
    command: "npm run source:trust",
    purpose: "Recompute whether the current local sources are trusted for sample-gate or scoring decisions.",
  },
  {
    id: "north_star_funnel",
    command: "npm run north-star",
    purpose: "Refresh per-100-click North Star funnel reporting from current trusted local events only.",
  },
  {
    id: "owner_next_action",
    command: "npm run owner:next-action",
    purpose: "Refresh the single safest owner next action after P1 outcome rows are checked.",
  },
  {
    id: "weekly_local",
    command: "npm run weekly:local",
    purpose: "Run the full local weekly chain and final artifact verifier after P1 outcome rows are ready.",
  },
];

const BLOCKED_ACTIONS = [
  "copy_download_to_live_input_without_owner_review",
  "append_to_data_lp_events_jsonl",
  "import_funnel_or_manual_apply",
  "remote_d1_create_or_migrate",
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
  outcomePreflight: "data/north_star_outcome_preflight_status.json",
  outcomeForm: "data/north_star_outcome_form_status.json",
  outcomeFormGuard: "data/north_star_outcome_form_fixture_status.json",
  sourceCompile: "data/source_capture_compile_status.json",
  realDataIntake: "data/real_data_intake_status.json",
  dataProgress: "data/data_collection_progress_status.json",
  sourceTrust: "data/source_trust_matrix_status.json",
  northStar: "north_star_funnel.json",
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

  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeFile(COMMAND_PATH, renderCommand(postfill));
  await chmod(COMMAND_PATH, 0o755);
  await writeJson(JSON_PATH, postfill);
  await writeFile(REPORT_PATH, renderMarkdown(postfill));
  await writeJson(STATUS_PATH, buildStatus(postfill));

  console.log(JSON.stringify(buildStatus(postfill), null, 2));
  if (!postfill.ok) process.exitCode = 1;
}

function buildPostfillCheck(sources, sourceStatus, generatedAt) {
  const outcomePreflight = sources.outcomePreflight ?? {};
  const outcomeForm = sources.outcomeForm ?? {};
  const outcomeFormGuard = sources.outcomeFormGuard ?? {};
  const sourceCompile = sources.sourceCompile ?? {};
  const realDataIntake = sources.realDataIntake ?? {};
  const dataProgress = sources.dataProgress ?? {};
  const sourceTrust = sources.sourceTrust ?? {};
  const northStar = sources.northStar ?? {};
  const goalCompletion = sources.goalCompletion ?? {};
  const approvalStatus = sources.approvalStatus ?? {};

  const sourceMissing = sourceStatus.filter((source) => !source.ok);
  const redLineViolationCount = [
    outcomePreflight,
    outcomeForm,
    outcomeFormGuard,
    sourceCompile,
    realDataIntake,
    sourceTrust,
    goalCompletion,
    approvalStatus,
  ].filter(hasRedLineFlag).length;

  const readyForSourceCompile = outcomePreflight.ready_for_source_compile === true;
  const ownerFilledExists = outcomePreflight.owner_filled_exists === true;
  const compiledPreviewRows = Number(sourceCompile.funnel_rows ?? 0) + Number(sourceCompile.manual_rows ?? 0);
  const realInputFilesReady = realDataIntake.has_real_input_files === true || Number(realDataIntake.ready_apply_count ?? 0) > 0;
  const p1Pending = Number(outcomePreflight.pending_outcome_row_count ?? dataProgress.p1_pending_count ?? 0);
  const p1Filled = Number(outcomePreflight.filled_outcome_row_count ?? 0);
  const p1Expected = Number(outcomePreflight.expected_outcome_row_count ?? 24);
  const stage = chooseStage({
    redLineViolationCount,
    outcomePreflight,
    sourceCompile,
    realDataIntake,
    sourceTrust,
    compiledPreviewRows,
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
    mode: "owner_p1_outcome_postfill_check_local_only",
    status: redLineViolationCount > 0 ? "blocked_red_line_violation_detected" : stage,
    current_stage: stage,
    postfill_ready: readyForSourceCompile || compiledPreviewRows > 0 || realInputFilesReady,
    expected_to_advance_now: readyForSourceCompile || compiledPreviewRows > 0,
    owner_filled_exists: ownerFilledExists,
    p1_outcome_preflight_status: outcomePreflight.status ?? "unknown",
    p1_outcome_input_kind: outcomePreflight.input_kind ?? "unknown",
    p1_outcome_ready_for_source_compile: readyForSourceCompile,
    p1_outcome_filled_row_count: p1Filled,
    p1_outcome_expected_row_count: p1Expected,
    p1_outcome_pending_row_count: p1Pending,
    p1_outcome_partial_row_count: Number(outcomePreflight.partial_outcome_row_count ?? 0),
    p1_outcome_invalid_row_count: Number(outcomePreflight.invalid_outcome_row_count ?? 0),
    outcome_form_status: outcomeForm.status ?? "unknown",
    outcome_form_row_count: Number(outcomeForm.row_count ?? 0),
    outcome_form_browser_only: outcomeForm.browser_only === true,
    outcome_form_network_calls_performed: outcomeForm.network_calls_performed === true,
    outcome_form_guard_ok: outcomeFormGuard.ok === true,
    outcome_form_guard_check_count: Number(outcomeFormGuard.check_count ?? 0),
    source_compile_status: sourceCompile.status ?? "unknown",
    source_compile_input_kind: sourceCompile.input_kind ?? "unknown",
    source_compile_filled_rows: Number(sourceCompile.filled_rows ?? 0),
    source_compile_funnel_rows: Number(sourceCompile.funnel_rows ?? 0),
    source_compile_manual_rows: Number(sourceCompile.manual_rows ?? 0),
    source_compile_preview_rows: compiledPreviewRows,
    source_compile_owner_review_required: sourceCompile.owner_review_required === true,
    real_data_intake_status: realDataIntake.status ?? "unknown",
    real_data_intake_has_real_input_files: realDataIntake.has_real_input_files === true,
    real_data_intake_ready_apply_count: Number(realDataIntake.ready_apply_count ?? 0),
    real_data_intake_missing_input_count: Number(realDataIntake.missing_input_count ?? 0),
    data_collection_progress_status: dataProgress.status ?? "unknown",
    data_collection_progress_p0_pending_count: Number(dataProgress.p0_pending_count ?? 0),
    data_collection_progress_p1_pending_count: Number(dataProgress.p1_pending_count ?? p1Pending),
    source_trust_status: sourceTrust.status ?? "unknown",
    source_trust_trusted_scoring_source_count: Number(sourceTrust.trusted_scoring_source_count ?? 0),
    source_trust_sample_gate_source_count: Number(sourceTrust.sample_gate_source_count ?? 0),
    source_trust_scoring_allowed_now: sourceTrust.scoring_allowed_now === true,
    source_trust_real_event_rows: Number(sourceTrust.real_event_rows ?? 0),
    source_trust_p0_pending_count: Number(sourceTrust.p0_pending_count ?? 0),
    source_trust_sample_threshold_met: sourceTrust.sample_threshold_met === true,
    source_trust_ready_for_public_iteration_decision: sourceTrust.ready_for_public_iteration_decision === true,
    north_star_link_clicks: Number(northStar.totals?.link_clicks ?? 0),
    north_star_line_adds_per_100_clicks: northStar.totals?.line_adds_per_100_clicks ?? null,
    goal_completion_status: goalCompletion.status ?? "unknown",
    goal_complete: goalCompletion.complete === true,
    goal_completion_proven: goalCompletion.completion_proven === true,
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
    red_line_violation_count: redLineViolationCount,
    command_runs_local_scripts_only: true,
    command_has_external_url: false,
    command_has_forbidden_remote_cli: false,
    command_has_forbidden_git_cli: false,
    command_has_apply_or_stage_flags: false,
    command_has_delete_or_launchd_action: false,
    command_whitelist_enforced_by_verifier: true,
    next_safe_action: nextSafeAction({ readyForSourceCompile, compiledPreviewRows, realInputFilesReady, p1Pending }),
    ...RED_LINE_FALSE,
    note: "Local P1 outcome post-fill check launcher only. The generated command runs whitelisted local npm scripts and does not stage, apply, append events, deploy, post, push GitHub/LINE, mutate customer data, process payments, or delete data.",
  };
}

function chooseStage({ redLineViolationCount, outcomePreflight, sourceCompile, realDataIntake, sourceTrust, compiledPreviewRows }) {
  if (redLineViolationCount > 0) return "blocked_red_line_violation_detected";
  if (sourceTrust.ready_for_public_iteration_decision === true) return "trusted_sources_ready_owner_review_required";
  if (realDataIntake.ready_apply_count > 0) return "real_input_preview_ready_owner_apply_review_required";
  if (compiledPreviewRows > 0 || sourceCompile.filled_rows > 0) return "outcome_owner_preview_ready_keep_gated";
  if (outcomePreflight.ready_for_source_compile === true) return "outcome_rows_ready_run_local_postfill";
  if (outcomePreflight.partial_outcome_row_count > 0) return "outcome_rows_partial_fix_before_compile";
  if (outcomePreflight.owner_filled_exists === true) return "outcome_download_present_but_not_ready";
  return "waiting_for_p1_outcome_counts";
}

function nextSafeAction({ readyForSourceCompile, compiledPreviewRows, realInputFilesReady, p1Pending }) {
  if (realInputFilesReady) {
    return "Review real_data_intake_plan.md and keep any apply command owner-gated; do not append events until owner confirms.";
  }
  if (compiledPreviewRows > 0) {
    return "Review source_capture_compile_report.md and real_data_intake_plan.md; copy owner-preview outputs into live input files only after owner review.";
  }
  if (readyForSourceCompile) {
    return "Run RUN-P1-OUTCOME-POST-FILL-CHECK.command locally, then review source_capture_compile_report.md and source_trust_matrix.md.";
  }
  return `Fill the P1 North Star outcome form (${p1Pending} rows pending), place source_capture_ledger.filled.csv under data/source_capture/, then rerun npm run north-star:outcome-preflight.`;
}

function hasRedLineFlag(source) {
  return [
    "external_effect",
    "live_input_files_created",
    "stage_performed",
    "apply_performed",
    "append_performed",
    "data_lp_events_write_performed",
    "public_link_change_performed",
    "production_deploy_performed",
    "github_push_or_pr_performed",
    "formal_post_performed",
    "line_push_performed",
    "customer_data_mutation_performed",
    "payment_action_performed",
    "delete_action_performed",
  ].some((field) => source?.[field] === true);
}

function renderCommand(postfill) {
  const commandLines = postfill.safe_commands
    .map((item) => `run_step npm run ${item.script}`)
    .join("\n");

  return `#!/bin/zsh
set -eu

ROOT="${ROOT}"
cd "$ROOT"

echo "3Q Growth Loop P1 outcome post-fill local check"
echo "Generated: ${postfill.generated_at}"
echo "Stage: ${postfill.current_stage}"
echo "Local scripts only. No deploy, public link switch, formal post, LINE push, GitHub push, payment, customer-data mutation, or data removal."
echo "Review after run: north_star_outcome_preflight.md, source_capture_compile_report.md, source_trust_matrix.md, weekly_report.md, approval_queue.json, redline_priority.md"

run_step() {
  print ""
  print ">>> $*"
  "$@"
}

${commandLines}

echo ""
echo "P1 outcome post-fill local check complete. Review source_trust_matrix.md and owner_approval_pack.md before any external action."
`;
}

function renderMarkdown(postfill) {
  return `# 3Q Growth Loop P1 Outcome Post-Fill Local Check

BLUF: \`RUN-P1-OUTCOME-POST-FILL-CHECK.command\` is ready as the local-only checker after the P1 North Star outcome form is filled and reviewed. Current stage is \`${postfill.current_stage}\`; expected to advance now: ${postfill.expected_to_advance_now ? "yes" : "no"}.

Generated: ${postfill.generated_at}
Mode: ${postfill.mode}
Status: ${postfill.status}
Command: ${postfill.command_path}
JSON: ${postfill.json_path}
External effect: no

## Current State

- P1 outcome preflight: ${postfill.p1_outcome_preflight_status} / input=${postfill.p1_outcome_input_kind} / filled=${postfill.p1_outcome_filled_row_count}/${postfill.p1_outcome_expected_row_count} / pending=${postfill.p1_outcome_pending_row_count} / partial=${postfill.p1_outcome_partial_row_count} / invalid=${postfill.p1_outcome_invalid_row_count} / ready_compile=${postfill.p1_outcome_ready_for_source_compile ? "yes" : "no"}
- Outcome form: ${postfill.outcome_form_status} / rows=${postfill.outcome_form_row_count} / browser_only=${postfill.outcome_form_browser_only ? "yes" : "no"} / network=${postfill.outcome_form_network_calls_performed ? "yes" : "no"} / guard=${postfill.outcome_form_guard_ok ? "ok" : "not_ready"} / checks=${postfill.outcome_form_guard_check_count}
- Source compile: ${postfill.source_compile_status} / input=${postfill.source_compile_input_kind} / filled=${postfill.source_compile_filled_rows} / funnel=${postfill.source_compile_funnel_rows} / manual=${postfill.source_compile_manual_rows} / preview=${postfill.source_compile_preview_rows} / owner_review=${postfill.source_compile_owner_review_required ? "yes" : "no"}
- Real-data intake: ${postfill.real_data_intake_status} / real_inputs=${postfill.real_data_intake_has_real_input_files ? "yes" : "no"} / ready_apply=${postfill.real_data_intake_ready_apply_count} / missing=${postfill.real_data_intake_missing_input_count}
- Data progress: ${postfill.data_collection_progress_status} / P0 pending=${postfill.data_collection_progress_p0_pending_count} / P1 pending=${postfill.data_collection_progress_p1_pending_count}
- Source trust: ${postfill.source_trust_status} / trusted=${postfill.source_trust_trusted_scoring_source_count} / sample_gate=${postfill.source_trust_sample_gate_source_count} / scoring_now=${postfill.source_trust_scoring_allowed_now ? "yes" : "no"} / p0_pending=${postfill.source_trust_p0_pending_count} / public_ready=${postfill.source_trust_ready_for_public_iteration_decision ? "yes" : "no"}
- North Star: clicks=${postfill.north_star_link_clicks} / LINE adds per 100 clicks=${postfill.north_star_line_adds_per_100_clicks ?? "n/a"}
- Goal completion: ${postfill.goal_completion_status} / complete=${postfill.goal_complete ? "yes" : "no"} / proven=${postfill.goal_completion_proven ? "yes" : "no"}
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
    owner_filled_exists: postfill.owner_filled_exists,
    command_path: postfill.command_path,
    report_path: postfill.report_path,
    json_path: postfill.json_path,
    safe_command_count: postfill.safe_command_count,
    safe_command_scripts: postfill.safe_command_scripts,
    p1_outcome_preflight_status: postfill.p1_outcome_preflight_status,
    p1_outcome_input_kind: postfill.p1_outcome_input_kind,
    p1_outcome_ready_for_source_compile: postfill.p1_outcome_ready_for_source_compile,
    p1_outcome_filled_row_count: postfill.p1_outcome_filled_row_count,
    p1_outcome_expected_row_count: postfill.p1_outcome_expected_row_count,
    p1_outcome_pending_row_count: postfill.p1_outcome_pending_row_count,
    p1_outcome_partial_row_count: postfill.p1_outcome_partial_row_count,
    p1_outcome_invalid_row_count: postfill.p1_outcome_invalid_row_count,
    outcome_form_status: postfill.outcome_form_status,
    outcome_form_row_count: postfill.outcome_form_row_count,
    outcome_form_browser_only: postfill.outcome_form_browser_only,
    outcome_form_network_calls_performed: postfill.outcome_form_network_calls_performed,
    outcome_form_guard_ok: postfill.outcome_form_guard_ok,
    outcome_form_guard_check_count: postfill.outcome_form_guard_check_count,
    source_compile_status: postfill.source_compile_status,
    source_compile_input_kind: postfill.source_compile_input_kind,
    source_compile_filled_rows: postfill.source_compile_filled_rows,
    source_compile_preview_rows: postfill.source_compile_preview_rows,
    real_data_intake_status: postfill.real_data_intake_status,
    real_data_intake_has_real_input_files: postfill.real_data_intake_has_real_input_files,
    real_data_intake_ready_apply_count: postfill.real_data_intake_ready_apply_count,
    data_collection_progress_p0_pending_count: postfill.data_collection_progress_p0_pending_count,
    data_collection_progress_p1_pending_count: postfill.data_collection_progress_p1_pending_count,
    source_trust_status: postfill.source_trust_status,
    source_trust_trusted_scoring_source_count: postfill.source_trust_trusted_scoring_source_count,
    source_trust_sample_gate_source_count: postfill.source_trust_sample_gate_source_count,
    source_trust_scoring_allowed_now: postfill.source_trust_scoring_allowed_now,
    source_trust_real_event_rows: postfill.source_trust_real_event_rows,
    source_trust_p0_pending_count: postfill.source_trust_p0_pending_count,
    source_trust_sample_threshold_met: postfill.source_trust_sample_threshold_met,
    source_trust_ready_for_public_iteration_decision: postfill.source_trust_ready_for_public_iteration_decision,
    north_star_link_clicks: postfill.north_star_link_clicks,
    north_star_line_adds_per_100_clicks: postfill.north_star_line_adds_per_100_clicks,
    goal_completion_status: postfill.goal_completion_status,
    goal_complete: postfill.goal_complete,
    goal_completion_proven: postfill.goal_completion_proven,
    approval_queue_status: postfill.approval_queue_status,
    approval_queue_pending_human_count: postfill.approval_queue_pending_human_count,
    blocked_action_count: postfill.blocked_action_count,
    red_line_violation_count: postfill.red_line_violation_count,
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
  return JSON.parse(await readFile(path.join(ROOT, relativePath), "utf8"));
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
