import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const NEXT_P0_INPUTS_PATH = path.join(ROOT, "next_p0_owner_inputs.json");
const STATUS_PATH = path.join(ROOT, "data", "p0_counts_preflight_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "p0_counts_preflight_fixture_report.md");

async function main() {
  const generatedAt = new Date();
  const nextP0 = JSON.parse(await readFile(NEXT_P0_INPUTS_PATH, "utf8"));
  const inputs = nextP0.inputs ?? [];
  const scenarios = [
    await runScenario("waiting_placeholders", renderTemplate(inputs, { mode: "waiting" })),
    await runScenario("partial_counts_waiting", renderTemplate(inputs, { mode: "partial" })),
    await runScenario("ready_for_quick", renderTemplate(inputs, { mode: "ready" })),
    await runScenario("sensitive_metadata_blocked", renderTemplate(inputs, { mode: "sensitive" })),
  ];
  const status = {
    ok: scenarios.every((scenario) => scenario.ok),
    generated_at: generatedAt.toISOString(),
    mode: "p0_counts_preflight_fixture_dry_run",
    scenario_count: scenarios.length,
    scenario_ids: scenarios.map((scenario) => scenario.id),
    scenarios,
    local_fixture_commands_executed: true,
    live_project_inputs_created: false,
    owner_inbox_write_performed: false,
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
    note: "Fixture-only P0 counts preflight guard. Uses temporary paste templates and never writes project live inputs, data/lp_events.jsonl, or external systems.",
  };
  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) process.exitCode = 1;
}

async function runScenario(id, pasteTemplate) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), `3q-p0-preflight-${id}-`));
  const pastePath = path.join(tempDir, "counts.txt");
  const statusPath = path.join(tempDir, "status.json");
  const jsonPath = path.join(tempDir, "preflight.json");
  const reportPath = path.join(tempDir, "preflight.md");
  await writeFile(pastePath, pasteTemplate);
  const args = [
    "scripts/p0-counts-preflight.mjs",
    `--paste-template=${pastePath}`,
    `--status=${statusPath}`,
    `--json=${jsonPath}`,
    `--report=${reportPath}`,
  ];
  const execution = await runNode(args);
  const status = JSON.parse(await readFile(statusPath, "utf8"));
  const checks = checksFor(id, status, execution);
  return {
    id,
    ok: checks.every((check) => check.ok),
    temp_dir: tempDir,
    command: `node ${args.join(" ")}`,
    exit_code: execution.exitCode,
    status: status.status,
    checks,
    live_project_inputs_created: false,
    data_lp_events_write_performed: false,
    external_effect: false,
  };
}

function checksFor(id, status, execution) {
  const base = [
    check("exit_success", execution.exitCode === 0, 0, execution.exitCode),
    check("no_live_input", status.live_input_files_created === false, false, status.live_input_files_created),
    check("no_real_event_write", status.data_lp_events_write_performed === false, false, status.data_lp_events_write_performed),
    check("no_external_effect", status.external_effect === false, false, status.external_effect),
  ];
  if (id === "waiting_placeholders") {
    return [
      ...base,
      check("waiting_status", status.status === "waiting_for_owner_p0_counts", "waiting_for_owner_p0_counts", status.status),
      check("placeholder_count", status.placeholder_count_key_count === status.expected_count_key_count, status.expected_count_key_count, status.placeholder_count_key_count),
      check("not_ready", status.ready_for_quick_preview === false, false, status.ready_for_quick_preview),
    ];
  }
  if (id === "partial_counts_waiting") {
    return [
      ...base,
      check("partial_status", status.status === "partial_p0_counts_waiting", "partial_p0_counts_waiting", status.status),
      check("some_filled", status.filled_count_key_count > 0, "filled > 0", status.filled_count_key_count),
      check("some_missing", status.placeholder_count_key_count > 0, "placeholder > 0", status.placeholder_count_key_count),
    ];
  }
  if (id === "ready_for_quick") {
    return [
      ...base,
      check("ready_status", status.status === "ready_for_next_p0_quick", "ready_for_next_p0_quick", status.status),
      check("ready", status.ready_for_quick_preview === true, true, status.ready_for_quick_preview),
      check("all_filled", status.filled_count_key_count === status.expected_count_key_count, status.expected_count_key_count, status.filled_count_key_count),
    ];
  }
  return [
    ...base,
    check("blocked_status", status.status === "blocked_invalid_p0_counts", "blocked_invalid_p0_counts", status.status),
    check("issue_count", status.issue_count > 0, "issue_count > 0", status.issue_count),
    check("not_ok", status.ok === false, false, status.ok),
  ];
}

function renderTemplate(inputs, { mode }) {
  const metadata = mode === "waiting"
    ? ["capture_date=<date>", "evidence_ref=<aggregate_ref>", "reviewer=<alias>", "pii_checked=<yes_after_aggregate_only_review>"]
    : mode === "sensitive"
      ? ["capture_date=2026-07-09", "evidence_ref=owner@example.com", "reviewer=fixture-owner", "pii_checked=yes"]
      : ["capture_date=2026-07-09", "evidence_ref=fixture_aggregate_review", "reviewer=fixture-owner", "pii_checked=yes"];
  const countLines = inputs.map((input, index) => {
    const key = `${input.role}.${shortEventLabel(input.event_type)}`;
    const value = mode === "waiting" ? "<count>" : mode === "partial" && index > 2 ? "<count>" : String(100 + index);
    return `${key}=${value}`;
  });
  return [
    "# fixture paste template",
    ...metadata,
    "",
    ...countLines,
    "",
  ].join("\n");
}

function shortEventLabel(eventType) {
  if (eventType === "page_view") return "visits";
  if (eventType === "cta_click") return "cta";
  if (eventType === "line_add") return "line";
  return eventType;
}

function check(name, ok, expected, actual) {
  return { name, ok, expected, actual };
}

async function runNode(args) {
  try {
    const result = await execFileAsync(process.execPath, args, { cwd: ROOT, maxBuffer: 1024 * 1024 * 8 });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return { exitCode: error.code ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? error.message };
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function renderReport(status) {
  return `# P0 Counts Preflight Fixture Report

BLUF: ${status.ok ? "p0_counts_preflight_fixtures_ok" : "p0_counts_preflight_fixtures_failed"}.

Generated: ${status.generated_at}
Mode: ${status.mode}
Scenarios: ${status.scenario_count}
Live input files created: no
data/lp_events.jsonl write performed: no
External effect: no

| scenario | ok | status |
|---|---|---|
${status.scenarios.map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "fail"} | ${scenario.status} |`).join("\n")}
`;
}

main();
