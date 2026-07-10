import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.env.OWNER_SAMPLE_COUNT_RECOVERY_ROOT
  ? path.resolve(process.env.OWNER_SAMPLE_COUNT_RECOVERY_ROOT)
  : path.resolve(new URL("..", import.meta.url).pathname);

const PATHS = {
  quick: "data/next_p0_quick_capture_status.json",
  intake: "data/next_p0_owner_intake_status.json",
  preflight: "data/owner_data_preflight_status.json",
  preflightFull: "owner_data_preflight.json",
  ownerSampleGate: "data/owner_sample_gate_status.json",
  sampleGateForm: "data/sample_gate_owner_form_status.json",
  sampleGateIntake: "data/owner_sample_gate_intake_status.json",
  sampleGateBatch: "sample_gate_batch_handoff.json",
  sampleGateBatchStatus: "data/sample_gate_batch_handoff_status.json",
  recovery: "sample_gate_recovery_pack.json",
  handoff: "owner_sample_count_handoff.json",
  goal: "data/goal_completion_audit_status.json",
  redline: "data/redline_priority_status.json",
};

const OUTPUT_JSON = "owner_sample_count_recovery.json";
const OUTPUT_MD = "owner_sample_count_recovery.md";
const OUTPUT_STATUS = "data/owner_sample_count_recovery_status.json";

const RED_LINE_FALSE = {
  external_effect: false,
  live_input_files_created: false,
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

async function main() {
  const generatedAt = new Date();
  const input = {};
  for (const [key, relativePath] of Object.entries(PATHS)) {
    input[key] = await readJson(relativePath);
  }

  const recovery = buildRecovery(input, generatedAt);
  const status = buildStatus(recovery, generatedAt);

  await mkdir(path.dirname(resolve(OUTPUT_STATUS)), { recursive: true });
  await writeJson(OUTPUT_JSON, recovery);
  await writeFile(resolve(OUTPUT_MD), renderMarkdown(recovery));
  await writeJson(OUTPUT_STATUS, status);

  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildRecovery({
  quick,
  intake,
  preflight,
  preflightFull,
  ownerSampleGate,
  sampleGateForm,
  sampleGateIntake,
  sampleGateBatch,
  sampleGateBatchStatus,
  recovery,
  handoff,
  goal,
  redline,
}, generatedAt) {
  const previewRows = Number(intake.funnel_preview_rows ?? 0) + Number(intake.manual_preview_rows ?? 0);
  const selectedRows = Number(preflight.selected_source_row_count ?? 0);
  const quickReady = quick.filled_preview_created === true && Number(quick.filled_preview_rows ?? 0) > 0;
  const intakeReady = intake.candidate_valid === true && previewRows > 0;
  const fullIntakeReady = sampleGateIntake.candidate_valid === true;
  const fullIntakeStaged = sampleGateIntake.stage_performed === true;
  const preflightReady = preflight.ok === true && selectedRows > 0;
  const sampleThresholdMet = preflight.sample_threshold_met === true || ownerSampleGate.sample_threshold_met === true;
  const winRuleMet = preflight.challenger_win_rule_met === true || ownerSampleGate.challenger_win_rule_met === true;
  const noQualityRegression = preflight.no_quality_regression === true;
  const fullP0RowCount = Number(sampleGateBatch.all_p0_row_count ?? sampleGateBatchStatus.all_p0_row_count ?? sampleGateForm.row_count ?? 0);
  const fullP0PendingCount = Number(sampleGateBatch.p0_pending_count ?? sampleGateBatchStatus.p0_pending_count ?? fullP0RowCount);
  const fullP0CoverageReady = sampleGateBatch.full_coverage_ready === true || fullP0RowCount > 0;
  const sourceIssues = collectIssues({ quick, intake, preflight, ownerSampleGate, sampleGateIntake });
  const redLineViolations = collectRedLineViolations({
    quick,
    intake,
    preflight,
    ownerSampleGate,
    sampleGateForm,
    sampleGateIntake,
    sampleGateBatch,
    sampleGateBatchStatus,
    recovery,
    handoff,
  });

  const status = chooseStatus({
    quickReady,
    intakeReady,
    fullIntakeReady,
    fullIntakeStaged,
    preflightReady,
    sampleThresholdMet,
    winRuleMet,
    noQualityRegression,
    sourceIssues,
    redLineViolations,
  });

  const chain = [
    {
      id: "quick_capture",
      command: "npm run next-p0:quick",
      status: quick.status ?? "unknown",
      ready: quickReady,
      expected_rows: quick.expected_row_count ?? recovery.p0_input_count ?? handoff.p0_input_count ?? 0,
      observed_rows: quick.filled_preview_rows ?? 0,
      next_safe_action: quick.next_safe_action ?? null,
      external_effect: false,
    },
    {
      id: "focused_intake",
      command: "npm run next-p0:intake",
      status: intake.status ?? "unknown",
      ready: intakeReady,
      expected_rows: intake.expected_row_count ?? recovery.p0_input_count ?? handoff.p0_input_count ?? 0,
      observed_rows: previewRows,
      next_safe_action: intake.next_safe_action ?? null,
      external_effect: false,
    },
    {
      id: "owner_data_preflight",
      command: "npm run owner:data-preflight",
      status: preflight.status ?? "unknown",
      ready: preflightReady,
      expected_rows: recovery.p0_input_count ?? handoff.p0_input_count ?? 0,
      observed_rows: selectedRows,
      sample_threshold_met: sampleThresholdMet,
      challenger_win_rule_met: winRuleMet,
      no_quality_regression: noQualityRegression,
      next_safe_action: preflight.next_safe_action ?? null,
      external_effect: false,
    },
    {
      id: "weekly_verify",
      command: "npm run weekly:local && node scripts/verify-artifacts.mjs",
      status: goal.complete ? "goal_complete" : goal.status ?? "not_complete",
      ready: preflightReady && sourceIssues.length === 0 && redLineViolations.length === 0,
      expected_rows: recovery.p0_input_count ?? handoff.p0_input_count ?? 0,
      observed_rows: goal.current_real_event_rows ?? 0,
      next_safe_action: redline.next_operator_action ?? null,
      external_effect: false,
    },
  ];

  const fullP0Chain = [
    {
      id: "full_p0_owner_form",
      command: "open sample_gate_owner_form.html",
      status: sampleGateForm.status ?? "unknown",
      ready: sampleGateForm.ok === true && Number(sampleGateForm.row_count ?? 0) > 0,
      expected_rows: fullP0RowCount,
      observed_rows: Number(sampleGateForm.row_count ?? 0),
      next_safe_action: "Download sample_gate_ledger.filled.csv after filling all aggregate-only rows.",
      external_effect: false,
    },
    {
      id: "full_p0_owner_intake",
      command: "npm run owner:intake",
      status: sampleGateIntake.status ?? "unknown",
      ready: fullIntakeReady,
      expected_rows: fullP0RowCount,
      observed_rows: Number(sampleGateIntake.filled_rows ?? 0),
      next_safe_action: sampleGateIntake.next_safe_action ?? "Place the owner-reviewed download in data/source_capture/inbox/ or rerun owner:intake with --input.",
      external_effect: false,
    },
    {
      id: "full_p0_owner_reviewed_stage",
      command: "npm run owner:intake -- --input=<path> --stage --confirm-owner-reviewed",
      status: fullIntakeStaged ? "owner_download_staged_for_sample_gate" : "waiting_for_owner_reviewed_stage",
      ready: fullIntakeStaged,
      expected_rows: fullP0RowCount,
      observed_rows: Number(sampleGateIntake.filled_rows ?? 0),
      next_safe_action: "Only run after reviewing aggregate-only CSV contents; this creates a local working file but still does not write data/lp_events.jsonl.",
      external_effect: false,
    },
    {
      id: "full_p0_sample_gate_status",
      command: "npm run owner:sample-gate",
      status: ownerSampleGate.status ?? "unknown",
      ready: ownerSampleGate.sample_threshold_met === true || Number(ownerSampleGate.filled_rows ?? 0) > 0,
      expected_rows: fullP0RowCount,
      observed_rows: Number(ownerSampleGate.filled_rows ?? 0),
      next_safe_action: "If sample threshold is met, continue to owner quality review; otherwise keep collecting.",
      external_effect: false,
    },
  ];

  const nextSafeCommands = nextCommands({
    quickReady,
    intakeReady,
    fullIntakeReady,
    fullIntakeStaged,
    preflightReady,
    sampleThresholdMet,
    winRuleMet,
  });
  const countsByEventType = mergeCounts(
    intake.counts_by_event_type ?? {},
    preflightFull.selected_source_id === "next_p0_owner_intake" ? selectedCounts(preflightFull) : {},
  );

  return {
    ok: sourceIssues.length === 0 && redLineViolations.length === 0,
    generated_at: generatedAt.toISOString(),
    mode: "owner_sample_count_recovery_local_only",
    status,
    recovery_stage: status,
    current_round_id: goal.current_round_id ?? preflightFull.current_round_id ?? null,
    changed_variable: goal.current_changed_variable ?? preflightFull.current_changed_variable ?? "cta_text",
    p0_input_count: recovery.p0_input_count ?? handoff.p0_input_count ?? quick.expected_row_count ?? 0,
    missing_count: handoff.missing_count ?? recovery.missing_rank_count ?? quick.missing_rank_count ?? 0,
    full_p0_row_count: fullP0RowCount,
    full_p0_pending_count: fullP0PendingCount,
    full_p0_coverage_ready: fullP0CoverageReady,
    full_p0_form_status: sampleGateForm.status ?? "unknown",
    full_p0_form_row_count: Number(sampleGateForm.row_count ?? 0),
    full_p0_form_download_filename: sampleGateForm.download_filename ?? "sample_gate_ledger.filled.csv",
    full_p0_form_owner_filled_path: sampleGateForm.owner_filled_path ?? null,
    full_p0_intake_status: sampleGateIntake.status ?? "unknown",
    full_p0_intake_candidate_found: sampleGateIntake.candidate_found === true,
    full_p0_intake_candidate_valid: sampleGateIntake.candidate_valid === true,
    full_p0_intake_stage_requested: sampleGateIntake.stage_requested === true,
    full_p0_intake_stage_performed: sampleGateIntake.stage_performed === true,
    full_p0_intake_live_input_files_created: sampleGateIntake.live_input_files_created === true,
    quick_count_count: quick.quick_count_count ?? recovery.quick_count_count ?? 0,
    quick_preview_ready: quickReady,
    intake_preview_ready: intakeReady,
    full_p0_intake_ready: fullIntakeReady,
    full_p0_staged_ready: fullIntakeStaged,
    owner_preflight_ready: preflightReady,
    owner_preview_rows: selectedRows,
    owner_preview_event_total: preflight.selected_source_event_total ?? 0,
    counts_by_event_type: countsByEventType,
    sample_threshold_met: sampleThresholdMet,
    challenger_win_rule_met: winRuleMet,
    no_quality_regression: noQualityRegression,
    champion_retained: !winRuleMet,
    next_round_decision: preflight.next_round_decision ?? goal.next_round_decision ?? "continue_current_round_until_sample_threshold",
    source_issue_count: sourceIssues.length,
    source_issues: sourceIssues,
    red_line_violation_count: redLineViolations.length,
    red_line_violations: redLineViolations,
    chain,
    full_p0_chain: fullP0Chain,
    next_safe_commands: nextSafeCommands,
    full_p0_after_commands: [
      "npm run owner:intake",
      "npm run owner:sample-gate",
      "npm run owner:data-preflight",
      "npm run weekly:local",
    ],
    owner_gate_if_sample_ready: sampleThresholdMet
      ? "Review owner_data_preflight.md, owner_quality_review.md, approval_queue.json, and redline_priority.md before any public route or promotion."
      : "Keep champion and current variable; collect aggregate counts until min_visits/min_cta_clicks/min_line_adds/min_test_days are met.",
    blocked_actions: [
      "append_to_data_lp_events_jsonl",
      "stage_live_input_without_owner_review",
      "fake_or_backfill_counts_without_owner_source",
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
    ],
    review_artifacts: [
      "owner_sample_count_recovery.md",
      "owner_sample_count_handoff.md",
      "sample_gate_owner_form.html",
      "owner_sample_gate_intake.md",
      "sample_gate_batch_handoff.md",
      "next_p0_quick_capture.md",
      "next_p0_owner_intake.md",
      "owner_data_preflight.md",
      "owner_next_action.md",
      "weekly_report.md",
      "redline_priority.md",
    ],
    outputs: {
      recovery_json: OUTPUT_JSON,
      recovery_md: OUTPUT_MD,
      status_json: OUTPUT_STATUS,
    },
    ...RED_LINE_FALSE,
    note: "Local sample-count recovery coordinator only. It reads quick-capture, focused-intake, full P0 form/intake, and owner-preflight status after aggregate counts are filled; it never stages inputs, appends data/lp_events.jsonl, deploys, posts, pushes GitHub/LINE, mutates customer data, processes payments, or deletes data.",
  };
}

function chooseStatus({ quickReady, intakeReady, fullIntakeReady, fullIntakeStaged, preflightReady, sampleThresholdMet, winRuleMet, noQualityRegression, sourceIssues, redLineViolations }) {
  if (redLineViolations.length > 0) return "blocked_red_line_violation_detected";
  if (sourceIssues.length > 0) return "blocked_invalid_owner_sample_count_recovery_source";
  if (winRuleMet && sampleThresholdMet && noQualityRegression) return "owner_review_required_before_promotion";
  if (sampleThresholdMet && preflightReady) return "owner_preview_sample_ready_no_auto_promotion";
  if (preflightReady) return "owner_preview_scored_keep_collecting";
  if (fullIntakeStaged) return "full_p0_staged_run_sample_gate";
  if (fullIntakeReady) return "full_p0_intake_ready_needs_owner_reviewed_stage";
  if (intakeReady) return "focused_intake_preview_ready_run_preflight";
  if (quickReady) return "quick_preview_ready_run_intake";
  return "waiting_for_owner_sample_counts";
}

function nextCommands({ quickReady, intakeReady, fullIntakeReady, fullIntakeStaged, preflightReady, sampleThresholdMet, winRuleMet }) {
  if (fullIntakeStaged && !preflightReady) {
    return [
      "npm run owner:sample-gate",
      "npm run owner:data-preflight",
      "npm run owner:sample-count-recovery",
    ];
  }
  if (fullIntakeReady && !fullIntakeStaged) {
    return [
      "npm run owner:intake -- --input=<path> --stage --confirm-owner-reviewed",
      "npm run owner:sample-gate",
      "npm run owner:sample-count-recovery",
    ];
  }
  if (!quickReady) {
    return [
      "npm run next-p0:quick",
      "npm run owner:sample-count-recovery",
      "npm run weekly:local",
    ];
  }
  if (!intakeReady) {
    return [
      "npm run next-p0:intake",
      "npm run owner:data-preflight",
      "npm run owner:sample-count-recovery",
    ];
  }
  if (!preflightReady) {
    return [
      "npm run owner:data-preflight",
      "npm run owner:sample-count-recovery",
      "npm run weekly:local",
    ];
  }
  if (sampleThresholdMet && winRuleMet) {
    return [
      "npm run owner:quality-review",
      "npm run approval:plan",
      "npm run weekly:local",
    ];
  }
  return [
    "npm run weekly:local",
    "node scripts/verify-artifacts.mjs",
  ];
}

function collectIssues(sources) {
  const issues = [];
  for (const [name, source] of Object.entries(sources)) {
    for (const issue of source.issues ?? []) {
      issues.push({ source: name, ...issue });
    }
    if (source.ok === false) {
      issues.push({ source: name, field: "ok", message: `${name} status is not ok.` });
    }
  }
  return issues;
}

function collectRedLineViolations(sources) {
  const keys = [
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
  ];
  const violations = [];
  for (const [sourceName, source] of Object.entries(sources)) {
    for (const key of keys) {
      const confirmedLocalSampleGateStage = sourceName === "sampleGateIntake"
        && source?.confirm_owner_reviewed === true
        && source?.stage_performed === true
        && source?.data_lp_events_write_performed !== true
        && source?.external_effect !== true;
      if (confirmedLocalSampleGateStage && ["stage_performed", "live_input_files_created"].includes(key)) {
        continue;
      }
      if (source?.[key] === true) {
        violations.push({ source: sourceName, key });
      }
    }
  }
  return violations;
}

function selectedCounts(preflightFull) {
  const statuses = preflightFull.source_statuses ?? [];
  const selected = statuses.find((source) => source.id === preflightFull.selected_source_id) ?? null;
  return selected?.counts_by_event_type ?? {};
}

function mergeCounts(...items) {
  const result = {};
  for (const item of items) {
    for (const [key, value] of Object.entries(item ?? {})) {
      result[key] = Number(result[key] ?? 0) + Number(value ?? 0);
    }
  }
  return result;
}

function buildStatus(recovery, generatedAt) {
  return {
    ok: recovery.ok,
    generated_at: generatedAt.toISOString(),
    mode: recovery.mode,
    status: recovery.status,
    p0_input_count: recovery.p0_input_count,
    missing_count: recovery.missing_count,
    full_p0_row_count: recovery.full_p0_row_count,
    full_p0_pending_count: recovery.full_p0_pending_count,
    full_p0_coverage_ready: recovery.full_p0_coverage_ready,
    full_p0_form_status: recovery.full_p0_form_status,
    full_p0_form_row_count: recovery.full_p0_form_row_count,
    full_p0_intake_status: recovery.full_p0_intake_status,
    full_p0_intake_candidate_found: recovery.full_p0_intake_candidate_found,
    full_p0_intake_candidate_valid: recovery.full_p0_intake_candidate_valid,
    full_p0_intake_stage_performed: recovery.full_p0_intake_stage_performed,
    full_p0_intake_ready: recovery.full_p0_intake_ready,
    full_p0_staged_ready: recovery.full_p0_staged_ready,
    quick_count_count: recovery.quick_count_count,
    quick_preview_ready: recovery.quick_preview_ready,
    intake_preview_ready: recovery.intake_preview_ready,
    owner_preflight_ready: recovery.owner_preflight_ready,
    owner_preview_rows: recovery.owner_preview_rows,
    sample_threshold_met: recovery.sample_threshold_met,
    challenger_win_rule_met: recovery.challenger_win_rule_met,
    no_quality_regression: recovery.no_quality_regression,
    next_round_decision: recovery.next_round_decision,
    source_issue_count: recovery.source_issue_count,
    red_line_violation_count: recovery.red_line_violation_count,
    next_safe_command_count: recovery.next_safe_commands.length,
    full_p0_after_command_count: recovery.full_p0_after_commands.length,
    blocked_action_count: recovery.blocked_actions.length,
    outputs: recovery.outputs,
    ...RED_LINE_FALSE,
  };
}

function renderMarkdown(recovery) {
  return `# Owner Sample Count Recovery

BLUF: ${recoveryBluf(recovery)}

Generated: ${recovery.generated_at}
Mode: ${recovery.mode}
Status: ${recovery.status}
Changed variable: ${recovery.changed_variable}
Sample threshold met: ${recovery.sample_threshold_met ? "yes" : "no"}
Challenger win rule met: ${recovery.challenger_win_rule_met ? "yes" : "no"}
No quality regression: ${recovery.no_quality_regression ? "yes" : "no"}

## Recovery Chain

| step | command | status | ready | observed |
|---|---|---|---:|---:|
${recovery.chain.map((step) => `| ${step.id} | \`${step.command}\` | ${step.status} | ${step.ready ? "yes" : "no"} | ${step.observed_rows ?? 0}/${step.expected_rows ?? 0} |`).join("\n")}

## Current Counts

- P0 inputs: ${recovery.p0_input_count}
- Missing rows: ${recovery.missing_count}
- Full P0 rows: ${recovery.full_p0_row_count}
- Full P0 pending rows: ${recovery.full_p0_pending_count}
- Full P0 form: ${recovery.full_p0_form_status} / ${recovery.full_p0_form_row_count}
- Full P0 intake: ${recovery.full_p0_intake_status} / valid=${recovery.full_p0_intake_candidate_valid ? "yes" : "no"} / staged=${recovery.full_p0_intake_stage_performed ? "yes" : "no"}
- Quick counts read: ${recovery.quick_count_count}
- Owner preview rows: ${recovery.owner_preview_rows}
- Owner preview event total: ${recovery.owner_preview_event_total}
- Counts by event: ${JSON.stringify(recovery.counts_by_event_type)}

## Full P0 Recovery Chain

| step | command | status | ready | observed |
|---|---|---|---:|---:|
${recovery.full_p0_chain.map((step) => `| ${step.id} | \`${step.command}\` | ${step.status} | ${step.ready ? "yes" : "no"} | ${step.observed_rows ?? 0}/${step.expected_rows ?? 0} |`).join("\n")}

## Next Safe Commands

${recovery.next_safe_commands.map((command, index) => `${index + 1}. \`${command}\``).join("\n")}

## Full P0 After Commands

${recovery.full_p0_after_commands.map((command, index) => `${index + 1}. \`${command}\``).join("\n")}

## Owner Gate

${recovery.owner_gate_if_sample_ready}

## Blocked Actions

${recovery.blocked_actions.map((action) => `- ${action}`).join("\n")}

## Safety

- External effect: ${recovery.external_effect ? "yes" : "no"}
- Live input files created: ${recovery.live_input_files_created ? "yes" : "no"}
- Stage performed: ${recovery.stage_performed ? "yes" : "no"}
- Apply performed: ${recovery.apply_performed ? "yes" : "no"}
- Append performed: ${recovery.append_performed ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${recovery.data_lp_events_write_performed ? "yes" : "no"}
- Public link change performed: ${recovery.public_link_change_performed ? "yes" : "no"}
- Production deploy performed: ${recovery.production_deploy_performed ? "yes" : "no"}
- GitHub push / PR performed: ${recovery.github_push_or_pr_performed ? "yes" : "no"}
- Formal post performed: ${recovery.formal_post_performed ? "yes" : "no"}
- LINE push performed: ${recovery.line_push_performed ? "yes" : "no"}
- Customer-data mutation performed: ${recovery.customer_data_mutation_performed ? "yes" : "no"}
- Payment action performed: ${recovery.payment_action_performed ? "yes" : "no"}
- Delete action performed: ${recovery.delete_action_performed ? "yes" : "no"}
`;
}

function recoveryBluf(recovery) {
  if (recovery.status === "waiting_for_owner_sample_counts") {
    return `Still waiting for owner aggregate counts; ${recovery.missing_count}/${recovery.p0_input_count} focused rows and ${recovery.full_p0_pending_count}/${recovery.full_p0_row_count} full P0 rows are pending, so champion stays and no variable rotates.`;
  }
  if (recovery.status === "quick_preview_ready_run_intake") {
    return "Owner counts were converted into a quick preview; run focused intake before judging the round.";
  }
  if (recovery.status === "focused_intake_preview_ready_run_preflight") {
    return "Focused owner-preview CSVs are ready; run owner data preflight before judging sample thresholds.";
  }
  if (recovery.status === "full_p0_intake_ready_needs_owner_reviewed_stage") {
    return "Full P0 owner download validates locally; stage only after owner review, then rerun sample-gate status.";
  }
  if (recovery.status === "full_p0_staged_run_sample_gate") {
    return "Full P0 aggregate file is staged locally; run sample-gate status and preflight before judging the round.";
  }
  if (recovery.status === "owner_preview_sample_ready_no_auto_promotion") {
    return "Owner preview meets sample threshold, but promotion is still blocked until quality review and owner approval.";
  }
  if (recovery.status === "owner_review_required_before_promotion") {
    return "Challenger appears to meet the win rule in preview; do not promote before owner quality review and approval.";
  }
  return "Owner sample-count recovery is locally scored; keep all external gates blocked.";
}

async function readJson(relativePath) {
  try {
    return JSON.parse(await readFile(resolve(relativePath), "utf8"));
  } catch {
    return {};
  }
}

async function writeJson(relativePath, value) {
  await writeFile(resolve(relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function resolve(relativePath) {
  return path.join(ROOT, relativePath);
}

main();
