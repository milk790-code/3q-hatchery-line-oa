import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "owner_sample_count_recovery_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "owner_sample_count_recovery_fixture_report.md");

async function main() {
  const generatedAt = new Date();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "3q-owner-sample-count-recovery-fixtures-"));
  const scenarios = [];

  for (const scenario of buildScenarios()) {
    scenarios.push(await runScenario(tempDir, scenario));
  }

  const status = {
    ok: scenarios.every((scenario) => scenario.ok),
    generated_at: generatedAt.toISOString(),
    mode: "owner_sample_count_recovery_fixture_dry_run",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    temp_dir: tempDir,
    scenario_count: scenarios.length,
    scenario_ids: scenarios.map((scenario) => scenario.id),
    scenarios,
    local_fixture_commands_executed: true,
    owner_sample_count_recovery_commands_executed: true,
    live_project_write_performed: false,
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
    external_effect: false,
    note: "Fixture-only sample-count recovery guard. It runs owner:sample-count-recovery against temporary roots and never stages project files, appends events, deploys, posts, pushes GitHub/LINE, mutates customer data, touches payments, or deletes data.",
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildScenarios() {
  return [
    {
      id: "waiting_without_owner_counts",
      overrides: {},
      expected: {
        exitCode: 0,
        ok: true,
        status: "waiting_for_owner_sample_counts",
        quick_preview_ready: false,
        intake_preview_ready: false,
        owner_preflight_ready: false,
        sample_threshold_met: false,
        challenger_win_rule_met: false,
      },
    },
    {
      id: "quick_preview_ready_prompts_intake",
      overrides: {
        "data/next_p0_quick_capture_status.json": quickStatus({
          status: "quick_counts_preview_ready",
          quick_count_count: 9,
          missing_rank_count: 0,
          filled_preview_created: true,
          filled_preview_rows: 9,
        }),
        "owner_sample_count_handoff.json": handoffStatus({ missing_count: 0, quick_count_count: 9 }),
        "sample_gate_recovery_pack.json": recoveryPack({ missing_rank_count: 0, quick_count_count: 9 }),
      },
      expected: {
        exitCode: 0,
        ok: true,
        status: "quick_preview_ready_run_intake",
        quick_preview_ready: true,
        intake_preview_ready: false,
        owner_preflight_ready: false,
        sample_threshold_met: false,
        challenger_win_rule_met: false,
      },
    },
    {
      id: "focused_intake_ready_prompts_preflight",
      overrides: {
        "data/next_p0_quick_capture_status.json": quickStatus({
          status: "quick_counts_preview_ready",
          quick_count_count: 9,
          missing_rank_count: 0,
          filled_preview_created: true,
          filled_preview_rows: 9,
        }),
        "data/next_p0_owner_intake_status.json": intakeStatus({
          status: "next_p0_owner_preview_ready",
          candidate_found: true,
          candidate_valid: true,
          funnel_preview_rows: 6,
          manual_preview_rows: 3,
        }),
        "owner_sample_count_handoff.json": handoffStatus({ missing_count: 0, quick_count_count: 9 }),
        "sample_gate_recovery_pack.json": recoveryPack({ missing_rank_count: 0, quick_count_count: 9 }),
      },
      expected: {
        exitCode: 0,
        ok: true,
        status: "focused_intake_preview_ready_run_preflight",
        quick_preview_ready: true,
        intake_preview_ready: true,
        owner_preflight_ready: false,
        sample_threshold_met: false,
        challenger_win_rule_met: false,
      },
    },
    {
      id: "full_p0_intake_ready_prompts_owner_reviewed_stage",
      overrides: {
        "data/owner_sample_gate_intake_status.json": sampleGateIntakeStatus({
          status: "owner_download_ready_for_review",
          candidate_found: true,
          candidate_valid: true,
          filled_rows: 18,
          pending_rows: 0,
        }),
      },
      expected: {
        exitCode: 0,
        ok: true,
        status: "full_p0_intake_ready_needs_owner_reviewed_stage",
        quick_preview_ready: false,
        intake_preview_ready: false,
        owner_preflight_ready: false,
        sample_threshold_met: false,
        challenger_win_rule_met: false,
        full_p0_intake_ready: true,
        full_p0_staged_ready: false,
      },
    },
    {
      id: "full_p0_owner_reviewed_stage_prompts_sample_gate",
      overrides: {
        "data/owner_sample_gate_intake_status.json": sampleGateIntakeStatus({
          status: "owner_download_staged_for_sample_gate",
          candidate_found: true,
          candidate_valid: true,
          filled_rows: 18,
          pending_rows: 0,
          stage_requested: true,
          confirm_owner_reviewed: true,
          stage_performed: true,
          live_input_files_created: true,
        }),
      },
      expected: {
        exitCode: 0,
        ok: true,
        status: "full_p0_staged_run_sample_gate",
        quick_preview_ready: false,
        intake_preview_ready: false,
        owner_preflight_ready: false,
        sample_threshold_met: false,
        challenger_win_rule_met: false,
        full_p0_intake_ready: true,
        full_p0_staged_ready: true,
      },
    },
    {
      id: "preflight_sample_insufficient_keeps_collecting",
      overrides: {
        "data/next_p0_quick_capture_status.json": quickStatus({
          status: "quick_counts_preview_ready",
          quick_count_count: 9,
          missing_rank_count: 0,
          filled_preview_created: true,
          filled_preview_rows: 9,
        }),
        "data/next_p0_owner_intake_status.json": intakeStatus({
          status: "next_p0_owner_preview_ready",
          candidate_found: true,
          candidate_valid: true,
          funnel_preview_rows: 6,
          manual_preview_rows: 3,
        }),
        "data/owner_data_preflight_status.json": preflightStatus({
          status: "owner_preview_keep_collecting",
          selected_source_row_count: 9,
          selected_source_event_total: 150,
          sample_threshold_met: false,
          challenger_win_rule_met: false,
        }),
        "owner_data_preflight.json": preflightFull({ selected_source_row_count: 9, sample_threshold_met: false, challenger_win_rule_met: false }),
        "owner_sample_count_handoff.json": handoffStatus({ missing_count: 0, quick_count_count: 9 }),
        "sample_gate_recovery_pack.json": recoveryPack({ missing_rank_count: 0, quick_count_count: 9 }),
      },
      expected: {
        exitCode: 0,
        ok: true,
        status: "owner_preview_scored_keep_collecting",
        quick_preview_ready: true,
        intake_preview_ready: true,
        owner_preflight_ready: true,
        sample_threshold_met: false,
        challenger_win_rule_met: false,
      },
    },
    {
      id: "sample_ready_no_auto_promotion",
      overrides: {
        "data/next_p0_quick_capture_status.json": quickStatus({
          status: "quick_counts_preview_ready",
          quick_count_count: 9,
          missing_rank_count: 0,
          filled_preview_created: true,
          filled_preview_rows: 9,
        }),
        "data/next_p0_owner_intake_status.json": intakeStatus({
          status: "next_p0_owner_preview_ready",
          candidate_found: true,
          candidate_valid: true,
          funnel_preview_rows: 6,
          manual_preview_rows: 3,
        }),
        "data/owner_data_preflight_status.json": preflightStatus({
          status: "owner_preview_sample_ready_no_auto_promotion",
          selected_source_row_count: 9,
          selected_source_event_total: 420,
          sample_threshold_met: true,
          challenger_win_rule_met: false,
        }),
        "owner_data_preflight.json": preflightFull({ selected_source_row_count: 9, sample_threshold_met: true, challenger_win_rule_met: false }),
        "data/owner_sample_gate_status.json": ownerSampleGateStatus({ sample_threshold_met: true, challenger_win_rule_met: false }),
        "owner_sample_count_handoff.json": handoffStatus({ missing_count: 0, quick_count_count: 9 }),
        "sample_gate_recovery_pack.json": recoveryPack({ missing_rank_count: 0, quick_count_count: 9, sample_threshold_met: true }),
      },
      expected: {
        exitCode: 0,
        ok: true,
        status: "owner_preview_sample_ready_no_auto_promotion",
        quick_preview_ready: true,
        intake_preview_ready: true,
        owner_preflight_ready: true,
        sample_threshold_met: true,
        challenger_win_rule_met: false,
      },
    },
    {
      id: "win_rule_requires_owner_review",
      overrides: {
        "data/next_p0_quick_capture_status.json": quickStatus({
          status: "quick_counts_preview_ready",
          quick_count_count: 9,
          missing_rank_count: 0,
          filled_preview_created: true,
          filled_preview_rows: 9,
        }),
        "data/next_p0_owner_intake_status.json": intakeStatus({
          status: "next_p0_owner_preview_ready",
          candidate_found: true,
          candidate_valid: true,
          funnel_preview_rows: 6,
          manual_preview_rows: 3,
        }),
        "data/owner_data_preflight_status.json": preflightStatus({
          status: "owner_preview_win_needs_quality_and_promotion_review",
          selected_source_row_count: 9,
          selected_source_event_total: 460,
          sample_threshold_met: true,
          challenger_win_rule_met: true,
        }),
        "owner_data_preflight.json": preflightFull({ selected_source_row_count: 9, sample_threshold_met: true, challenger_win_rule_met: true }),
        "data/owner_sample_gate_status.json": ownerSampleGateStatus({ sample_threshold_met: true, challenger_win_rule_met: true }),
        "owner_sample_count_handoff.json": handoffStatus({ missing_count: 0, quick_count_count: 9 }),
        "sample_gate_recovery_pack.json": recoveryPack({ missing_rank_count: 0, quick_count_count: 9, sample_threshold_met: true, sample_rate_win_candidate: true }),
      },
      expected: {
        exitCode: 0,
        ok: true,
        status: "owner_review_required_before_promotion",
        quick_preview_ready: true,
        intake_preview_ready: true,
        owner_preflight_ready: true,
        sample_threshold_met: true,
        challenger_win_rule_met: true,
      },
    },
    {
      id: "red_line_violation_blocks_recovery",
      overrides: {
        "data/next_p0_quick_capture_status.json": quickStatus({
          status: "quick_counts_preview_ready",
          quick_count_count: 9,
          missing_rank_count: 0,
          filled_preview_created: true,
          filled_preview_rows: 9,
          data_lp_events_write_performed: true,
        }),
        "owner_sample_count_handoff.json": handoffStatus({ missing_count: 0, quick_count_count: 9 }),
        "sample_gate_recovery_pack.json": recoveryPack({ missing_rank_count: 0, quick_count_count: 9 }),
      },
      expected: {
        exitCode: 1,
        ok: false,
        status: "blocked_red_line_violation_detected",
        quick_preview_ready: true,
        red_line_violation_count_positive: true,
      },
    },
  ];
}

async function runScenario(tempDir, scenario) {
  const scenarioRoot = path.join(tempDir, scenario.id);
  await seedRoot(scenarioRoot, scenario.overrides);
  const execution = await runRecovery(scenarioRoot);
  const full = await readOptionalJson(path.join(scenarioRoot, "owner_sample_count_recovery.json"));
  const compact = await readOptionalJson(path.join(scenarioRoot, "data", "owner_sample_count_recovery_status.json"));
  const checks = checksForScenario({ scenario, full, compact, execution });
  return {
    id: scenario.id,
    ok: checks.every((item) => item.ok),
    expected_status: scenario.expected.status,
    actual_status: compact?.status ?? "missing",
    checks,
    exit_code: execution.exitCode,
    quick_preview_ready: compact?.quick_preview_ready ?? null,
    intake_preview_ready: compact?.intake_preview_ready ?? null,
    full_p0_intake_ready: compact?.full_p0_intake_ready ?? null,
    full_p0_staged_ready: compact?.full_p0_staged_ready ?? null,
    owner_preflight_ready: compact?.owner_preflight_ready ?? null,
    sample_threshold_met: compact?.sample_threshold_met ?? null,
    challenger_win_rule_met: compact?.challenger_win_rule_met ?? null,
    source_issue_count: compact?.source_issue_count ?? null,
    red_line_violation_count: compact?.red_line_violation_count ?? null,
    data_lp_events_write_performed: Boolean(compact?.data_lp_events_write_performed),
    github_push_or_pr_performed: Boolean(compact?.github_push_or_pr_performed),
    production_deploy_performed: Boolean(compact?.production_deploy_performed),
    formal_post_performed: Boolean(compact?.formal_post_performed),
    line_push_performed: Boolean(compact?.line_push_performed),
    external_effect: Boolean(compact?.external_effect),
    scenario_root: scenarioRoot,
    stdout_bytes: execution.stdout.length,
    stderr_bytes: execution.stderr.length,
  };
}

function checksForScenario({ scenario, full, compact, execution }) {
  const expected = scenario.expected;
  const checks = [
    check("exit_code", execution.exitCode === expected.exitCode, expected.exitCode, execution.exitCode),
    check("full_json_written", Boolean(full), true, Boolean(full)),
    check("compact_json_written", Boolean(compact), true, Boolean(compact)),
    check("full_ok", full?.ok === expected.ok, expected.ok, full?.ok),
    check("compact_ok", compact?.ok === expected.ok, expected.ok, compact?.ok),
    check("status", compact?.status === expected.status, expected.status, compact?.status),
    check("mode", compact?.mode === "owner_sample_count_recovery_local_only", "owner_sample_count_recovery_local_only", compact?.mode),
    check("quick_preview_ready", compact?.quick_preview_ready === expected.quick_preview_ready, expected.quick_preview_ready, compact?.quick_preview_ready),
    check("data_write_false", compact?.data_lp_events_write_performed === false, false, compact?.data_lp_events_write_performed),
    check("github_false", compact?.github_push_or_pr_performed === false, false, compact?.github_push_or_pr_performed),
    check("deploy_false", compact?.production_deploy_performed === false, false, compact?.production_deploy_performed),
    check("formal_post_false", compact?.formal_post_performed === false, false, compact?.formal_post_performed),
    check("line_push_false", compact?.line_push_performed === false, false, compact?.line_push_performed),
    check("external_effect_false", compact?.external_effect === false, false, compact?.external_effect),
  ];
  for (const key of ["intake_preview_ready", "owner_preflight_ready", "sample_threshold_met", "challenger_win_rule_met", "full_p0_intake_ready", "full_p0_staged_ready"]) {
    if (Object.hasOwn(expected, key)) {
      checks.push(check(key, compact?.[key] === expected[key], expected[key], compact?.[key]));
    }
  }
  if (expected.red_line_violation_count_positive) {
    checks.push(check("red_line_violation_count_positive", (compact?.red_line_violation_count ?? 0) > 0, ">0", compact?.red_line_violation_count ?? 0));
  } else {
    checks.push(check("red_line_violation_count_zero", compact?.red_line_violation_count === 0, 0, compact?.red_line_violation_count));
  }
  if (expected.ok) {
    checks.push(
      check("chain_len", full?.chain?.length === 4, 4, full?.chain?.length),
      check("full_p0_chain_len", full?.full_p0_chain?.length === 4, 4, full?.full_p0_chain?.length),
      check("full_p0_after_commands_present", (full?.full_p0_after_commands ?? []).includes("npm run weekly:local"), true, full?.full_p0_after_commands ?? []),
      check("next_commands_present", (full?.next_safe_commands ?? []).length > 0, ">0", full?.next_safe_commands?.length ?? 0),
      check("blocks_event_write", (full?.blocked_actions ?? []).includes("append_to_data_lp_events_jsonl"), true, full?.blocked_actions ?? []),
      check("blocks_github", (full?.blocked_actions ?? []).includes("github_push_or_pr_creation"), true, full?.blocked_actions ?? []),
    );
  }
  return checks;
}

async function seedRoot(root, overrides) {
  for (const [relativePath, value] of Object.entries({ ...defaultFiles(), ...overrides })) {
    await writeJson(path.join(root, relativePath), value);
  }
}

function defaultFiles() {
  return {
    "data/next_p0_quick_capture_status.json": quickStatus({}),
    "data/next_p0_owner_intake_status.json": intakeStatus({}),
    "data/owner_data_preflight_status.json": preflightStatus({}),
    "owner_data_preflight.json": preflightFull({}),
    "data/owner_sample_gate_status.json": ownerSampleGateStatus({}),
    "data/sample_gate_owner_form_status.json": sampleGateFormStatus({}),
    "data/owner_sample_gate_intake_status.json": sampleGateIntakeStatus({}),
    "sample_gate_batch_handoff.json": sampleGateBatchStatus({}),
    "data/sample_gate_batch_handoff_status.json": sampleGateBatchStatus({ compact: true }),
    "sample_gate_recovery_pack.json": recoveryPack({}),
    "owner_sample_count_handoff.json": handoffStatus({}),
    "data/goal_completion_audit_status.json": {
      complete: false,
      status: "not_complete_external_gates",
      current_round_id: "week0-cta-text",
      current_changed_variable: "cta_text",
      current_real_event_rows: 0,
      sample_threshold_met: false,
      external_effect: false,
      github_push_or_pr_performed: false,
      production_deploy_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
    },
    "data/redline_priority_status.json": {
      status: "prioritize_p0_sample_gate_counts",
      next_operator_action: "p0_collect_sample_gate_counts: fill aggregate-only P0 counts, then rerun owner intake/weekly verification.",
      external_effect: false,
      github_push_or_pr_performed: false,
      production_deploy_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
    },
  };
}

function quickStatus(overrides) {
  return {
    ok: true,
    status: "waiting_for_quick_counts",
    expected_row_count: 9,
    quick_count_count: 0,
    missing_rank_count: 9,
    filled_preview_created: false,
    filled_preview_rows: 0,
    issues: [],
    live_input_files_created: false,
    stage_performed: false,
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
    external_effect: false,
    ...overrides,
  };
}

function intakeStatus(overrides) {
  return {
    ok: true,
    status: "waiting_for_next_p0_owner_download",
    candidate_found: false,
    candidate_valid: false,
    expected_row_count: 9,
    funnel_preview_rows: 0,
    manual_preview_rows: 0,
    counts_by_event_type: {},
    issues: [],
    live_input_files_created: false,
    stage_performed: false,
    data_lp_events_write_performed: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    external_effect: false,
    ...overrides,
  };
}

function preflightStatus(overrides) {
  return {
    ok: true,
    status: "waiting_for_owner_preview_rows",
    selected_source_id: "next_p0_owner_intake",
    selected_source_row_count: 0,
    selected_source_event_total: 0,
    sample_threshold_met: false,
    no_quality_regression: true,
    challenger_win_rule_met: false,
    next_round_decision: "continue_current_round_until_sample_threshold",
    issues: [],
    execution_performed: false,
    apply_performed: false,
    append_performed: false,
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
    external_effect: false,
    ...overrides,
  };
}

function preflightFull({ selected_source_row_count = 0, sample_threshold_met = false, challenger_win_rule_met = false }) {
  return {
    selected_source_id: "next_p0_owner_intake",
    current_changed_variable: "cta_text",
    source_statuses: [
      {
        id: "next_p0_owner_intake",
        row_count: selected_source_row_count,
        counts_by_event_type: selected_source_row_count > 0 ? { page_view: 220, cta_click: 48, line_add: 12 } : {},
        ok: true,
        issues: [],
        external_effect: false,
      },
    ],
    sample_threshold_met,
    challenger_win_rule_met,
    no_quality_regression: true,
    data_lp_events_write_performed: false,
    external_effect: false,
  };
}

function ownerSampleGateStatus(overrides) {
  return {
    ok: true,
    status: "waiting_for_owner_sample_gate_counts",
    sample_threshold_met: false,
    challenger_win_rule_met: false,
    issues: [],
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
    external_effect: false,
    ...overrides,
  };
}

function sampleGateFormStatus(overrides) {
  return {
    ok: true,
    status: "ready_local_browser_fill",
    mode: "sample_gate_owner_form",
    row_count: 18,
    download_filename: "sample_gate_ledger.filled.csv",
    owner_filled_path: "data/source_capture/sample_gate_ledger.filled.csv",
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
    external_effect: false,
    ...overrides,
  };
}

function sampleGateIntakeStatus(overrides) {
  return {
    ok: true,
    status: "waiting_for_owner_download",
    mode: "owner_sample_gate_intake",
    candidate_found: false,
    candidate_valid: false,
    filled_rows: 0,
    pending_rows: 18,
    stage_requested: false,
    stage_performed: false,
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
    external_effect: false,
    ...overrides,
  };
}

function sampleGateBatchStatus(overrides) {
  return {
    ok: true,
    status: "p0_full_coverage_batched_for_owner_counts",
    mode: "sample_gate_batch_handoff_local_only",
    all_p0_row_count: 18,
    focused_batch_row_count: 9,
    remaining_batch_row_count: 9,
    p0_pending_count: 18,
    full_coverage_ready: true,
    batch_count: 2,
    live_input_files_created: false,
    stage_performed: false,
    data_lp_events_write_performed: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    external_effect: false,
    ...overrides,
  };
}

function recoveryPack(overrides) {
  return {
    ok: true,
    status: "day3_overdue_recovery_ready",
    p0_input_count: 9,
    missing_rank_count: 9,
    quick_count_count: 0,
    sample_threshold_met: false,
    sample_rate_win_candidate: false,
    data_lp_events_write_performed: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    external_effect: false,
    ...overrides,
  };
}

function handoffStatus(overrides) {
  return {
    ok: true,
    status: "waiting_for_owner_sample_counts",
    p0_input_count: 9,
    missing_count: 9,
    quick_count_count: 0,
    data_lp_events_write_performed: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    external_effect: false,
    ...overrides,
  };
}

async function runRecovery(root) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, ["scripts/owner-sample-count-recovery.mjs"], {
      cwd: ROOT,
      env: { ...process.env, OWNER_SAMPLE_COUNT_RECOVERY_ROOT: root },
      maxBuffer: 1024 * 1024 * 4,
    });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    return {
      exitCode: Number.isInteger(error.code) ? error.code : 1,
      stdout: String(error.stdout ?? ""),
      stderr: String(error.stderr ?? error.message ?? error),
    };
  }
}

function check(name, ok, expected, actual) {
  return { name, ok, expected, actual, external_effect: false };
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function renderReport(status) {
  const rows = status.scenarios
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "failed"} | ${scenario.exit_code} | ${scenario.actual_status} | ${scenario.checks.filter((item) => item.ok).length}/${scenario.checks.length} |`)
    .join("\n");
  return `# Owner Sample Count Recovery Fixture Report

BLUF: ${status.ok ? "owner_sample_count_recovery_fixtures_ok" : "owner_sample_count_recovery_fixtures_failed"}. Fixture-only recovery scenarios validate post-count state transitions without project writes.

Generated: ${status.generated_at}
Mode: ${status.mode}
Scenarios: ${status.scenario_count}
Live project write performed: no
data/lp_events.jsonl write performed: no
External effect: no

| scenario | result | exit | status | checks |
|---|---|---:|---|---:|
${rows}

## Safety Contract

- Temporary fixture roots only.
- No project inbox, live CSV, or real event writes.
- No GitHub push / PR, production deploy, formal post, LINE push, payment, customer-data mutation, or delete action.
- Win-rule scenarios stop at owner review; they do not promote a challenger or rotate variables.
- Red-line violations are detected as blocked fixture failures, not hidden as success.
`;
}

await main();
