import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "owner_next_action_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "owner_next_action_fixture_report.md");

async function main() {
  const generatedAt = new Date();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "3q-owner-next-action-fixtures-"));
  const scenarios = [
    {
      id: "waiting_counts_prioritizes_full_p0_batch_handoff",
      overrides: {},
      expect: {
        primary_action_id: "collect_owner_sample_gate_counts",
        primary_action_status: "waiting_for_owner_sample_gate_counts",
        primary_action_command: "open sample_gate_batch_handoff.md",
        owner_review_required: false,
        next_action_ids: ["prepare_public_ab_metadata"],
        sample_gate_batch_all_p0_row_count: 18,
        sample_gate_batch_focused_batch_row_count: 9,
        sample_gate_batch_remaining_batch_row_count: 9,
      },
    },
    {
      id: "staged_next_p0_prompts_real_data_preview",
      overrides: {
        "data/next_p0_owner_intake_status.json": {
          status: "next_p0_owner_download_staged_local_inputs",
          candidate_found: true,
          stage_performed: true,
        },
        "data/real_data_intake_status.json": {
          status: "no_real_input_files",
          ready_apply_count: 0,
          missing_input_count: 2,
          blocked_input_count: 0,
        },
      },
      expect: {
        primary_action_id: "preview_staged_real_data_inputs",
        primary_action_command: "npm run real-data:intake",
        owner_review_required: false,
        next_action_ids: ["prepare_public_ab_metadata"],
      },
    },
    {
      id: "real_data_preview_ready_prompts_owner_apply_review",
      overrides: {
        "data/real_data_intake_status.json": {
          status: "preview_ready_owner_apply_required",
          ready_apply_count: 2,
          missing_input_count: 0,
          blocked_input_count: 0,
        },
      },
      expect: {
        primary_action_id: "review_real_data_apply",
        primary_action_command: "open real_data_intake_plan.md",
        owner_review_required: true,
        next_action_ids: ["prepare_public_ab_metadata"],
      },
    },
    {
      id: "real_data_input_attention_blocks_apply",
      overrides: {
        "data/real_data_intake_status.json": {
          status: "input_attention_required",
          ready_apply_count: 0,
          missing_input_count: 0,
          blocked_input_count: 1,
        },
      },
      expect: {
        primary_action_id: "fix_real_data_input_preview",
        primary_action_command: "npm run real-data:intake",
        owner_review_required: false,
        next_action_ids: ["prepare_public_ab_metadata"],
      },
    },
    {
      id: "partial_quick_counts_keep_collect_action",
      overrides: {
        "data/next_p0_quick_capture_status.json": {
          status: "partial_quick_counts_waiting",
          expected_row_count: 9,
          quick_count_count: 3,
          filled_rank_count: 3,
          filled_ranks: ["1", "2", "3"],
          missing_rank_count: 6,
          missing_ranks: ["4", "5", "6", "7", "8", "9"],
          partial_waiting: true,
          partial_auto_counts: true,
          template_created: true,
          paste_template_created: true,
          paste_template_path: "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
          filled_preview_created: false,
        },
      },
      expect: {
        primary_action_id: "collect_owner_sample_gate_counts",
        primary_action_status: "partial_quick_counts_waiting",
        primary_action_command: "open data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
        owner_review_required: false,
        next_action_ids: ["prepare_public_ab_metadata"],
        quick_partial_waiting: true,
        quick_filled_rank_count: 3,
        quick_missing_rank_count: 6,
        sample_gate_batch_all_p0_row_count: 18,
        sample_gate_batch_focused_batch_row_count: 9,
        sample_gate_batch_remaining_batch_row_count: 9,
      },
    },
    {
      id: "invalid_p0_counts_prioritize_fix_card",
      overrides: {
        "data/next_p0_quick_capture_status.json": {
          status: "blocked_invalid_quick_counts",
          expected_row_count: 9,
          quick_count_count: 9,
          filled_rank_count: 9,
          filled_ranks: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
          missing_rank_count: 0,
          missing_ranks: [],
          partial_waiting: false,
          partial_auto_counts: false,
          template_created: true,
          paste_template_created: true,
          paste_template_path: "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
          filled_preview_created: false,
        },
        "data/p0_counts_preflight_status.json": {
          status: "blocked_invalid_p0_counts",
          ready_for_quick_preview: false,
          expected_count_key_count: 9,
          filled_count_key_count: 8,
          placeholder_count_key_count: 0,
          invalid_count_key_count: 1,
          issue_count: 1,
        },
      },
      expect: {
        primary_action_id: "fix_invalid_p0_counts",
        primary_action_status: "blocked_invalid_p0_counts",
        primary_action_command: "open p0_counts_preflight.md",
        owner_review_required: false,
        next_action_ids: ["prepare_public_ab_metadata"],
        p0_counts_preflight_status: "blocked_invalid_p0_counts",
        p0_counts_preflight_issue_count: 1,
      },
    },
  ];

  const results = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(tempDir, scenario));
  }

  const status = {
    ok: results.every((result) => result.ok),
    generated_at: generatedAt.toISOString(),
    mode: "owner_next_action_fixture",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    temp_dir: tempDir,
    scenario_count: results.length,
    scenario_ids: results.map((result) => result.id),
    scenarios: results,
    live_project_write_performed: false,
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
    note: "Fixture-only owner next-action routing guard. It runs the action card against temporary roots and never stages project files, appends events, deploys, posts, pushes LINE/GitHub, mutates customer data, touches payments, or deletes data.",
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

async function runScenario(tempDir, scenario) {
  const scenarioRoot = path.join(tempDir, scenario.id);
  await seedRoot(scenarioRoot, scenario.overrides);
  const execution = await runOwnerNextAction(scenarioRoot);
  const card = await readOptionalJson(path.join(scenarioRoot, "owner_next_action.json"));
  const compact = await readOptionalJson(path.join(scenarioRoot, "data", "owner_next_action_status.json"));
  const checks = [
    check("exit_code", execution.exitCode === 0, 0, execution.exitCode),
    check("card_ok", card?.ok === true, true, card?.ok),
    check("compact_ok", compact?.ok === true, true, compact?.ok),
    check("primary_action_id", card?.primary_action?.id === scenario.expect.primary_action_id, scenario.expect.primary_action_id, card?.primary_action?.id),
    ...(scenario.expect.primary_action_status
      ? [check("primary_action_status", card?.primary_action?.status === scenario.expect.primary_action_status, scenario.expect.primary_action_status, card?.primary_action?.status)]
      : []),
    check("primary_action_command", card?.primary_action?.command === scenario.expect.primary_action_command, scenario.expect.primary_action_command, card?.primary_action?.command),
    check("compact_primary_command", compact?.primary_action_command === scenario.expect.primary_action_command, scenario.expect.primary_action_command, compact?.primary_action_command),
    check("owner_review_required", compact?.owner_review_required === scenario.expect.owner_review_required, scenario.expect.owner_review_required, compact?.owner_review_required),
    ...(scenario.expect.quick_partial_waiting !== undefined
      ? [
          check("quick_partial_waiting", compact?.next_p0_quick_capture_partial_waiting === scenario.expect.quick_partial_waiting, scenario.expect.quick_partial_waiting, compact?.next_p0_quick_capture_partial_waiting),
          check("quick_filled_rank_count", compact?.next_p0_quick_capture_filled_rank_count === scenario.expect.quick_filled_rank_count, scenario.expect.quick_filled_rank_count, compact?.next_p0_quick_capture_filled_rank_count),
          check("quick_missing_rank_count", compact?.next_p0_quick_capture_missing_rank_count === scenario.expect.quick_missing_rank_count, scenario.expect.quick_missing_rank_count, compact?.next_p0_quick_capture_missing_rank_count),
        ]
      : []),
    ...(scenario.expect.sample_gate_batch_all_p0_row_count !== undefined
      ? [
          check("sample_gate_batch_all_p0_row_count", compact?.sample_gate_batch_handoff_all_p0_row_count === scenario.expect.sample_gate_batch_all_p0_row_count, scenario.expect.sample_gate_batch_all_p0_row_count, compact?.sample_gate_batch_handoff_all_p0_row_count),
          check("sample_gate_batch_focused_batch_row_count", compact?.sample_gate_batch_handoff_focused_batch_row_count === scenario.expect.sample_gate_batch_focused_batch_row_count, scenario.expect.sample_gate_batch_focused_batch_row_count, compact?.sample_gate_batch_handoff_focused_batch_row_count),
          check("sample_gate_batch_remaining_batch_row_count", compact?.sample_gate_batch_handoff_remaining_batch_row_count === scenario.expect.sample_gate_batch_remaining_batch_row_count, scenario.expect.sample_gate_batch_remaining_batch_row_count, compact?.sample_gate_batch_handoff_remaining_batch_row_count),
          check("sample_gate_batch_full_coverage_ready", compact?.sample_gate_batch_handoff_full_coverage_ready === true, true, compact?.sample_gate_batch_handoff_full_coverage_ready),
        ]
      : []),
    ...(scenario.expect.p0_counts_preflight_status !== undefined
      ? [
          check("p0_counts_preflight_status", compact?.p0_counts_preflight_status === scenario.expect.p0_counts_preflight_status, scenario.expect.p0_counts_preflight_status, compact?.p0_counts_preflight_status),
          check("p0_counts_preflight_issue_count", compact?.p0_counts_preflight_issue_count === scenario.expect.p0_counts_preflight_issue_count, scenario.expect.p0_counts_preflight_issue_count, compact?.p0_counts_preflight_issue_count),
        ]
      : []),
    check("next_actions_len", Array.isArray(card?.next_actions) && card.next_actions.length === 3, 3, card?.next_actions?.length),
    ...((scenario.expect.next_action_ids ?? []).map((expectedId) =>
      check(`next_action_${expectedId}`, (card?.next_actions ?? []).some((item) => item.id === expectedId), true, card?.next_actions?.map((item) => item.id).join(",") ?? "none")
    )),
    check("no_data_write", compact?.data_lp_events_write_performed === false, false, compact?.data_lp_events_write_performed),
    check("no_external_effect", compact?.external_effect === false, false, compact?.external_effect),
  ];
  const ok = checks.every((item) => item.ok);
  return {
    id: scenario.id,
    ok,
    checks,
    exit_code: execution.exitCode,
    primary_action_id: card?.primary_action?.id ?? null,
    primary_action_command: card?.primary_action?.command ?? null,
    next_action_ids: card?.next_actions?.map((item) => item.id) ?? [],
    owner_review_required: compact?.owner_review_required ?? null,
    public_ab_metadata_status: compact?.public_ab_metadata_status ?? null,
    real_data_intake_status: compact?.real_data_intake_status ?? null,
    data_lp_events_write_performed: Boolean(compact?.data_lp_events_write_performed),
    external_effect: Boolean(compact?.external_effect),
    scenario_root: scenarioRoot,
    stdout_bytes: execution.stdout.length,
    stderr_bytes: execution.stderr.length,
  };
}

async function seedRoot(root, overrides) {
  const defaults = defaultFiles();
  for (const [relativePath, value] of Object.entries({ ...defaults, ...overrides })) {
    await writeJson(path.join(root, relativePath), value);
  }
}

function defaultFiles() {
  return {
    "data/owner_sample_gate_status.json": {
      status: "waiting_for_owner_sample_gate_counts",
      decision: "collect_owner_sample_gate_counts",
      sample_threshold_met: false,
      sample_rate_win_candidate: false,
      owner_review_required: false,
    },
    "owner_sample_gate_status.json": {
      current_round: "week0-cta-text",
      challenger: {
        gaps: { visits: 100, cta_clicks: 20, line_adds: 5, test_days: 3, preferred_test_days: 7 },
      },
    },
    "data/owner_sample_gate_intake_status.json": { status: "waiting_for_owner_download" },
    "data/owner_quality_review_status.json": { status: "waiting_for_sample_rate_winner", owner_review_required: false },
    "data/data_collection_progress_status.json": { status: "waiting_for_p0_sample_gate_counts", p0_pending_count: 18 },
    "data/next_p0_owner_inputs_status.json": { status: "ready_next_p0_owner_inputs", current_input_count: 9 },
    "data/next_p0_owner_form_status.json": { status: "ready_local_next_p0_owner_form", row_count: 9 },
    "data/next_p0_quick_capture_status.json": {
      status: "waiting_for_quick_counts",
      expected_row_count: 9,
      quick_count_count: 0,
      filled_rank_count: 0,
      filled_ranks: [],
      missing_rank_count: 9,
      missing_ranks: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
      partial_waiting: false,
      partial_auto_counts: false,
      template_created: true,
      paste_template_created: true,
      paste_template_path: "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
      filled_preview_created: false,
    },
    "data/p0_counts_preflight_status.json": {
      status: "waiting_for_owner_p0_counts",
      ready_for_quick_preview: false,
      expected_count_key_count: 9,
      filled_count_key_count: 0,
      placeholder_count_key_count: 9,
      invalid_count_key_count: 0,
      issue_count: 0,
    },
    "data/next_p0_owner_intake_status.json": {
      status: "waiting_for_next_p0_owner_download",
      candidate_found: false,
      stage_performed: false,
    },
    "data/sample_gate_batch_handoff_status.json": {
      status: "p0_full_coverage_batched_for_owner_counts",
      p0_task_count: 18,
      all_p0_row_count: 18,
      focused_batch_row_count: 9,
      remaining_batch_row_count: 9,
      p0_pending_count: 18,
      batch_count: 2,
      full_coverage_ready: true,
    },
    "data/real_data_intake_status.json": {
      status: "no_real_input_files",
      ready_apply_count: 0,
      missing_input_count: 2,
      blocked_input_count: 0,
    },
    "data/sample_gate_capture_calendar_status.json": {
      status: "waiting_for_owner_sample_gate_counts",
      event_count: 2,
      next_due_date: "2026-07-12",
      next_due_event_id: "preferred_sample_check_day7",
    },
    "data/sample_gate_due_status_status.json": {
      status: "minimum_sample_check_due",
      due_phase: "minimum_check",
      due_now: true,
      due_date: "2026-07-08",
      due_event_id: "minimum_sample_check_day3",
    },
    "sample_gate_collection_plan.json": {
      global_sample_gaps: { visits: 100, cta_clicks: 20, line_adds: 5, test_days: 3, preferred_test_days: 7 },
    },
    "next_round_plan.json": {
      status: "continue_current_round",
      decision: "continue_current_round_until_sample_threshold",
      current_round: "week0-cta-text",
    },
    "approval_queue.json": { items: [] },
    "launch_readiness.json": { status: "owner_approval_required", owner_decision_required: true },
    "data/gate_readiness_status.json": {
      status: "prepared_but_blocked",
      parallel_metadata_action_count: 4,
      parallel_metadata_actions: [
        {
          gate_id: "public_ab_small_traffic_link",
          status: "capture_or_fix_non_secret_metadata",
          fields_needing_input: ["approved_by", "approved_at", "champion_url", "public_surface", "rollback_url"],
          blocking_dependencies: [
            "candidate_worker_production_deploy_owner_executed",
            "approved_current_champion_url",
            "approved_rollback_url",
            "approval_metadata.public_ab_small_traffic_link",
          ],
          plan_only: true,
          no_execution: true,
          execution_order_still_enforced: true,
          external_effect: false,
          execution_performed: false,
        },
      ],
      external_effect: false,
      execution_performed: false,
    },
  };
}

async function runOwnerNextAction(root) {
  try {
    const { stdout, stderr } = await execFileAsync("node", ["scripts/owner-next-action.mjs"], {
      cwd: ROOT,
      env: { ...process.env, OWNER_NEXT_ACTION_ROOT: root },
      maxBuffer: 1024 * 1024 * 4,
    });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    return {
      exitCode: Number.isInteger(error.code) ? error.code : 1,
      stdout: String(error.stdout ?? ""),
      stderr: String(error.stderr ?? error.message ?? ""),
    };
  }
}

function check(name, ok, expected, actual) {
  return { name, ok, expected, actual };
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function renderReport(status) {
  const rows = status.scenarios
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "fail"} | ${scenario.primary_action_id} | ${scenario.next_action_ids.join(", ")} | \`${scenario.primary_action_command}\` | ${scenario.owner_review_required ? "yes" : "no"} | ${scenario.data_lp_events_write_performed ? "yes" : "no"} | ${scenario.external_effect ? "yes" : "no"} |`)
    .join("\n");

  return `# Owner Next Action Fixture Report

BLUF: ${status.ok ? "owner_next_action_fixtures_ok" : "owner_next_action_fixtures_failed"}. Fixture-only routing guard for staged aggregate inputs and real-data intake preview states.

Generated: ${status.generated_at}
Mode: ${status.mode}
Scenarios: ${status.scenario_count}
Live project write performed: no
data/lp_events.jsonl write performed: no
External effect: no

| scenario | status | primary action | next actions | command | owner review | data write | external |
|---|---|---|---|---|---|---|---|
${rows}

## Covered Routes

- staged_next_p0_prompts_real_data_preview
- real_data_preview_ready_prompts_owner_apply_review
- real_data_input_attention_blocks_apply
- partial_quick_counts_keep_collect_action
- invalid_p0_counts_prioritize_fix_card
- prepare_public_ab_metadata_secondary_action

## Safety Invariants

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

main().catch(async (error) => {
  const status = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "owner_next_action_fixture",
    status: "failed",
    error: error instanceof Error ? error.message : "unknown_error",
    live_project_write_performed: false,
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
  };
  await writeJson(STATUS_PATH, status);
  console.error(error);
  process.exitCode = 1;
});
