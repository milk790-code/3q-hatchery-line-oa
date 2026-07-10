import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const TEMPLATE_PATH = path.join(ROOT, "data", "source_capture", "sample_gate_ledger.fill-template.csv");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const STATUS_PATH = path.join(ROOT, "data", "owner_sample_gate_intake_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "owner_sample_gate_intake_fixture_report.md");

async function main() {
  const generatedAt = new Date();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "3q-owner-sample-intake-fixtures-"));
  const template = parseCsv(await readFile(TEMPLATE_PATH, "utf8"));
  const realEventsBefore = await readOptional(REAL_EVENTS_PATH);
  const scenarios = [];

  for (const scenario of buildScenarios()) {
    scenarios.push(await runScenario(tempDir, template, scenario));
  }

  const realEventsAfter = await readOptional(REAL_EVENTS_PATH);
  const status = {
    ok: scenarios.every((scenario) => scenario.ok) && realEventsBefore === realEventsAfter,
    generated_at: generatedAt.toISOString(),
    mode: "owner_sample_gate_intake_fixture_dry_run",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    temp_dir: tempDir,
    scenario_count: scenarios.length,
    scenario_ids: scenarios.map((scenario) => scenario.id),
    scenarios,
    local_fixture_commands_executed: true,
    owner_sample_gate_intake_commands_executed: true,
    source_capture_compile_commands_executed: true,
    owner_sample_gate_commands_executed: true,
    real_events_unchanged: realEventsBefore === realEventsAfter,
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
    note: "Fixture-only owner sample-gate intake guard. It validates temporary downloaded CSV candidates and stages only to a temporary target when explicitly confirmed.",
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
      id: "no_download_waits_safely",
      description: "No owner download exists; the intake guard reports a safe waiting state.",
      expectedStatus: "waiting_for_owner_download",
      expectValid: false,
      expectStage: false,
      input: "missing",
    },
    {
      id: "valid_download_ready_for_review",
      description: "A valid aggregate-only downloaded CSV is ready for owner review but not staged.",
      expectedStatus: "owner_download_ready_for_review",
      expectValid: true,
      expectStage: false,
      fill: "valid",
    },
    {
      id: "sensitive_download_blocks_stage",
      description: "Sensitive-looking evidence blocks intake before any stage action.",
      expectedStatus: "blocked_invalid_owner_download",
      expectValid: false,
      expectStage: false,
      fill: "sensitive",
    },
    {
      id: "stage_requires_owner_confirm",
      description: "A valid candidate with --stage but no confirmation does not create the staged target.",
      expectedStatus: "owner_download_ready_needs_confirmed_stage",
      expectValid: true,
      expectStage: false,
      fill: "valid",
      stage: true,
      expectExitNonzero: true,
    },
    {
      id: "confirmed_stage_uses_temp_target_only",
      description: "A valid candidate stages only to a temporary target when --confirm-owner-reviewed is present.",
      expectedStatus: "owner_download_staged_for_sample_gate",
      expectValid: true,
      expectStage: true,
      fill: "valid",
      stage: true,
      confirm: true,
    },
  ];
}

async function runScenario(tempDir, template, scenario) {
  const scenarioDir = path.join(tempDir, scenario.id);
  await mkdir(scenarioDir, { recursive: true });
  const inputPath = path.join(scenarioDir, "sample_gate_ledger.filled.csv");
  const targetPath = path.join(scenarioDir, "staged", "sample_gate_ledger.filled.csv");
  const statusPath = path.join(scenarioDir, "intake_status.json");
  const reportPath = path.join(scenarioDir, "intake_report.md");

  if (scenario.fill) {
    await writeFile(inputPath, renderFilledLedger(template, scenario.fill));
  }

  const args = [
    "scripts/owner-sample-gate-intake.mjs",
    `--input=${scenario.input === "missing" ? path.join(scenarioDir, "missing.csv") : inputPath}`,
    `--target=${targetPath}`,
    `--status=${statusPath}`,
    `--report=${reportPath}`,
    "--no-downloads",
  ];
  if (scenario.stage) args.push("--stage");
  if (scenario.confirm) args.push("--confirm-owner-reviewed");

  const execution = await runNode(args);
  const status = await readOptionalJson(statusPath);
  const targetExists = await exists(targetPath);
  const assertions = [
    { name: "exit_code", ok: scenario.expectExitNonzero ? execution.exitCode !== 0 : execution.exitCode === 0 },
    { name: "status", ok: status?.status === scenario.expectedStatus },
    { name: "candidate_valid", ok: Boolean(status?.candidate_valid) === scenario.expectValid },
    { name: "stage_performed", ok: Boolean(status?.stage_performed) === scenario.expectStage },
    { name: "target_exists", ok: targetExists === scenario.expectStage },
    { name: "data_write_false", ok: status?.data_lp_events_write_performed === false },
    { name: "external_false", ok: status?.external_effect === false },
    { name: "no_forbidden_actions", ok: [
      "public_link_change_performed",
      "production_deploy_performed",
      "github_push_or_pr_performed",
      "formal_post_performed",
      "line_push_performed",
      "customer_data_mutation_performed",
      "payment_action_performed",
      "delete_action_performed",
    ].every((key) => status?.[key] === false) },
  ];

  return {
    id: scenario.id,
    ok: assertions.every((assertion) => assertion.ok),
    description: scenario.description,
    expected_status: scenario.expectedStatus,
    assertions,
    exit_code: execution.exitCode,
    status: status?.status ?? "missing",
    candidate_found: Boolean(status?.candidate_found),
    candidate_valid: Boolean(status?.candidate_valid),
    compile_status: status?.compile_status ?? "missing",
    owner_status: status?.owner_status ?? "missing",
    filled_rows: status?.filled_rows ?? 0,
    pending_rows: status?.pending_rows ?? null,
    stage_requested: Boolean(status?.stage_requested),
    stage_performed: Boolean(status?.stage_performed),
    target_exists: targetExists,
    live_input_files_created: Boolean(status?.live_input_files_created),
    data_lp_events_write_performed: Boolean(status?.data_lp_events_write_performed),
    external_effect: Boolean(status?.external_effect),
    temp_files: {
      input_path: inputPath,
      target_path: targetPath,
      status_path: statusPath,
      report_path: reportPath,
    },
  };
}

function renderFilledLedger(template, kind) {
  const rows = template.rows.map((row, index) => {
    const copy = { ...row };
    copy.capture_date = copy.week_start;
    copy.aggregate_count = String(countFor(copy));
    copy.evidence_ref = kind === "sensitive" && index === 0
      ? "owner@example.com"
      : `aggregate:${copy.stage}:${copy.tracking_link_id}`;
    copy.reviewer = "owner-review";
    copy.pii_checked = "yes";
    return copy;
  });
  return renderCsv(template.headers, rows);
}

function countFor(row) {
  const champion = row.asset_id === "champion-3q-line-v0";
  if (row.stage === "page_view") return champion ? 100 : 120;
  if (row.stage === "cta_click") return champion ? 20 : 25;
  if (row.stage === "line_add") return champion ? 5 : 8;
  return 0;
}

async function runNode(args) {
  try {
    const result = await execFileAsync(process.execPath, args, { cwd: ROOT, maxBuffer: 1024 * 1024 * 8 });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      exitCode: Number.isInteger(error.code) ? error.code : 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? String(error.message ?? error),
    };
  }
}

function parseCsv(raw) {
  const lines = raw.trimEnd().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() ?? "");
  const rows = lines.filter((line) => line.trim()).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
  return { headers, rows };
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function renderCsv(headers, rows) {
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function renderReport(status) {
  const rows = status.scenarios
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "fail"} | ${scenario.status} | ${scenario.candidate_valid ? "yes" : "no"} | ${scenario.stage_performed ? "yes" : "no"} |`)
    .join("\n");
  return `# Owner Sample Gate Intake Fixture Report

BLUF: ${status.ok ? "all_intake_fixtures_passed" : "intake_fixture_failure"}.

| scenario | result | status | valid | staged |
|---|---|---|---|---|
${rows}

All files are temporary except this report and \`data/owner_sample_gate_intake_fixture_status.json\`. The fixture does not write \`data/lp_events.jsonl\`, does not deploy, does not post, does not push LINE, and does not touch customer data or payments.
`;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
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

main();
