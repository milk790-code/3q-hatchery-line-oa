import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const NEXT_P0_INPUTS_PATH = path.join(ROOT, "next_p0_owner_inputs.json");
const STATUS_PATH = path.join(ROOT, "data", "sample_gate_due_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "sample_gate_due_fixture_report.md");

const SCENARIOS = [
  {
    id: "waiting_before_day3",
    today: "2026-07-07",
    expectedStatus: "waiting_until_day3",
    expectedPhase: "pre_minimum_check",
    expectedEvent: "minimum_sample_check_day3",
    expectedDueNow: false,
  },
  {
    id: "day3_due",
    today: "2026-07-08",
    expectedStatus: "day3_due_waiting_for_owner_counts",
    expectedPhase: "minimum_check_due",
    expectedEvent: "minimum_sample_check_day3",
    expectedDueNow: true,
  },
  {
    id: "day3_overdue_recovery",
    today: "2026-07-09",
    expectedStatus: "day3_overdue_waiting_for_owner_counts",
    expectedPhase: "minimum_check_overdue",
    expectedEvent: "minimum_sample_check_day3_overdue",
    expectedDueNow: true,
  },
  {
    id: "day7_due",
    today: "2026-07-12",
    expectedStatus: "day7_due_waiting_for_owner_counts",
    expectedPhase: "preferred_check_due",
    expectedEvent: "preferred_sample_check_day7",
    expectedDueNow: true,
  },
];

async function main() {
  const generatedAt = new Date();
  const nextP0 = JSON.parse(await readFile(NEXT_P0_INPUTS_PATH, "utf8"));
  const scenarios = [];
  for (const scenario of SCENARIOS) {
    scenarios.push(await runScenario(scenario, nextP0));
  }

  const status = {
    ok: scenarios.every((scenario) => scenario.ok),
    generated_at: generatedAt.toISOString(),
    mode: "sample_gate_due_fixture_dry_run",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    scenario_count: scenarios.length,
    scenario_ids: scenarios.map((scenario) => scenario.id),
    scenarios,
    local_fixture_commands_executed: true,
    project_due_status_write_performed: false,
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
    note: "Fixture-only sample-gate due-state guard. It writes temporary due-status outputs only and never touches project due-status artifacts, data/lp_events.jsonl, or external systems.",
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) process.exitCode = 1;
}

async function runScenario(scenario, nextP0) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), `3q-sample-gate-due-${scenario.id}-`));
  const fixtureDir = path.join(tempDir, "fixtures");
  await mkdir(fixtureDir, { recursive: true });

  const progressPath = path.join(fixtureDir, "progress.json");
  const ownerSampleGatePath = path.join(fixtureDir, "owner-sample-gate.json");
  const captureCalendarPath = path.join(fixtureDir, "capture-calendar.json");
  const ownerActionPath = path.join(fixtureDir, "owner-action.json");
  const jsonPath = path.join(tempDir, "sample_gate_due_status.json");
  const statusPath = path.join(tempDir, "sample_gate_due_status_status.json");
  const reportPath = path.join(tempDir, "sample_gate_due_status.md");

  await writeJson(progressPath, {
    ok: true,
    status: "fixture_waiting_for_owner_counts",
    sample_threshold_met: false,
    sample_rate_win_candidate: false,
    p0_pending_count: 18,
    p0_task_count: 18,
    next_owner_input_count: nextP0.current_input_count ?? 0,
  });
  await writeJson(ownerSampleGatePath, {
    ok: true,
    status: "fixture_waiting_for_owner_counts",
    decision: "collect_owner_sample_gate_counts",
    pending_rows: 18,
    sample_threshold_met: false,
    sample_rate_win_candidate: false,
  });
  await writeJson(captureCalendarPath, {
    ok: true,
    status: "waiting_for_owner_sample_gate_counts",
    next_due_date: "2026-07-08",
    next_due_event_id: "minimum_sample_check_day3",
  });
  await writeJson(ownerActionPath, {
    ok: true,
    status: "waiting_for_owner_sample_gate_counts",
    primary_action_id: "collect_owner_sample_gate_counts",
    primary_action_command: "open next_p0_owner_form.html",
  });
  const nextP0Path = path.join(fixtureDir, "next-p0.json");
  await writeJson(nextP0Path, {
    ...nextP0,
    week: { start: "2026-07-06", end: "2026-07-12" },
  });

  const args = [
    "scripts/sample-gate-due-status.mjs",
    `--today=${scenario.today}`,
    `--progress=${progressPath}`,
    `--owner-sample-gate=${ownerSampleGatePath}`,
    `--capture-calendar=${captureCalendarPath}`,
    `--owner-action=${ownerActionPath}`,
    `--next-p0=${nextP0Path}`,
    `--json=${jsonPath}`,
    `--status=${statusPath}`,
    `--report=${reportPath}`,
  ];
  const execution = await runNode(args);
  const fullStatus = await readOptionalJson(jsonPath);
  const compactStatus = await readOptionalJson(statusPath);
  const checks = checksForScenario(scenario, { fullStatus, compactStatus, execution, nextP0 });

  return {
    id: scenario.id,
    today: scenario.today,
    ok: checks.every((check) => check.ok),
    temp_dir: tempDir,
    command: `node ${args.join(" ")}`,
    exit_code: execution.exitCode,
    status: fullStatus?.status ?? "missing",
    due_phase: fullStatus?.due_phase ?? null,
    due_event_id: fullStatus?.due_event_id ?? null,
    due_now: fullStatus?.due_now ?? null,
    checks,
    project_due_status_write_performed: false,
    data_lp_events_write_performed: false,
    external_effect: false,
  };
}

function checksForScenario(scenario, { fullStatus, compactStatus, execution, nextP0 }) {
  return [
    check("exit_success", execution.exitCode === 0, 0, execution.exitCode),
    check("full_status_written", Boolean(fullStatus), true, Boolean(fullStatus)),
    check("compact_status_written", Boolean(compactStatus), true, Boolean(compactStatus)),
    check("status_matches", fullStatus?.status === scenario.expectedStatus, scenario.expectedStatus, fullStatus?.status),
    check("compact_status_matches", compactStatus?.status === scenario.expectedStatus, scenario.expectedStatus, compactStatus?.status),
    check("phase_matches", fullStatus?.due_phase === scenario.expectedPhase, scenario.expectedPhase, fullStatus?.due_phase),
    check("event_matches", fullStatus?.due_event_id === scenario.expectedEvent, scenario.expectedEvent, fullStatus?.due_event_id),
    check("due_now_matches", fullStatus?.due_now === scenario.expectedDueNow, scenario.expectedDueNow, fullStatus?.due_now),
    check("today_matches", fullStatus?.today === scenario.today, scenario.today, fullStatus?.today),
    check("focused_input_count_matches", fullStatus?.p0_input_count === (nextP0.current_input_count ?? 0), nextP0.current_input_count ?? 0, fullStatus?.p0_input_count),
    check("no_calendar_import", fullStatus?.calendar_import_performed === false, false, fullStatus?.calendar_import_performed),
    check("no_browser_open", fullStatus?.browser_open_performed === false, false, fullStatus?.browser_open_performed),
    check("no_event_write", fullStatus?.data_lp_events_write_performed === false, false, fullStatus?.data_lp_events_write_performed),
    check("no_external_effect", fullStatus?.external_effect === false, false, fullStatus?.external_effect),
  ];
}

function check(name, ok, expected, actual) {
  return { name, ok, expected, actual, external_effect: false };
}

async function runNode(args) {
  try {
    const result = await execFileAsync(process.execPath, args, { cwd: ROOT, maxBuffer: 1024 * 1024 * 4 });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      exitCode: Number.isInteger(error.code) ? error.code : 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? String(error.message ?? error),
    };
  }
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
    .map((scenario) => `| ${scenario.id} | ${scenario.today} | ${scenario.ok ? "ok" : "failed"} | ${scenario.exit_code} | ${scenario.status} | ${scenario.due_phase ?? "n/a"} | ${scenario.due_event_id ?? "n/a"} | ${scenario.checks.filter((item) => item.ok).length}/${scenario.checks.length} |`)
    .join("\n");
  return `# 3Q Growth Loop Sample Gate Due Fixture Report

BLUF: ${status.ok ? "sample_gate_due_fixtures_ok" : "sample_gate_due_fixtures_failed"}. This fixture verifies Day 3 waiting, due, overdue recovery, and Day 7 due states with temporary outputs only.

Generated: ${status.generated_at}
Mode: ${status.mode}
Scenarios: ${status.scenario_count}
Project due-status write performed: no
data/lp_events.jsonl write performed: no
External effect: no

| scenario | today | result | exit | status | phase | event | checks |
|---|---|---|---:|---|---|---|---:|
${rows}

## Safety Contract

- Temporary fixture paths only.
- No project sample-gate due-status overwrite.
- No Calendar import, browser open, event write, deploy, post, LINE push, GitHub action, customer-data mutation, payment action, or delete action.
- Overdue recovery still keeps the champion unchanged and asks only for aggregate owner counts.
`;
}

await main();
