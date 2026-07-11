import { access, copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const TEMPLATE_PATH = path.join(ROOT, "data", "source_capture", "source_capture_ledger.fill-template.csv");
const STATUS_PATH = path.join(ROOT, "data", "owner_p1_outcome_intake_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "owner_p1_outcome_intake_fixture_report.md");
const OUTCOME_EVENTS = new Set(["link_click", "lead_submit", "deal", "quality_flag"]);

async function main() {
  const generatedAt = new Date();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "3q-p1-outcome-intake-fixtures-"));
  const templateRows = parseCsv(await readFile(TEMPLATE_PATH, "utf8"));
  const scenarios = [];

  scenarios.push(await runScenario({
    tempRoot,
    name: "waiting_no_candidate",
    args: [
      `--project-inbox=${path.join(tempRoot, "missing-inbox.csv")}`,
      "--no-downloads",
    ],
    expect: (status, execution) => execution.exitCode === 0
      && status.status === "waiting_for_p1_outcome_download"
      && status.candidate_found === false
      && status.stage_performed === false
      && noRedLines(status),
  }));

  const validCandidate = path.join(tempRoot, "source_capture_ledger.valid.csv");
  await writeFile(validCandidate, renderCsv(templateRows.headers, filledOutcomeRows(templateRows.rows)));
  scenarios.push(await runScenario({
    tempRoot,
    name: "valid_review_only",
    args: [`--input=${validCandidate}`],
    expect: (status, execution) => execution.exitCode === 0
      && status.status === "p1_outcome_download_ready_for_review"
      && status.candidate_valid === true
      && status.filled_outcome_row_count === 24
      && status.pending_outcome_row_count === 0
      && status.stage_performed === false
      && noRedLines(status),
  }));

  scenarios.push(await runScenario({
    tempRoot,
    name: "stage_requires_confirmation",
    args: [`--input=${validCandidate}`, "--stage"],
    expect: (status, execution) => execution.exitCode === 1
      && status.status === "p1_outcome_download_ready_needs_confirmed_stage"
      && status.candidate_valid === true
      && status.stage_performed === false
      && status.stage_blocked_reason === "stage_requires_confirm_owner_reviewed"
      && noRedLines(status),
  }));

  const tempTarget = path.join(tempRoot, "staged", "source_capture_ledger.filled.csv");
  scenarios.push(await runScenario({
    tempRoot,
    name: "confirmed_stage_temp_target",
    args: [`--input=${validCandidate}`, `--target=${tempTarget}`, "--stage", "--confirm-owner-reviewed"],
    expect: async (status, execution) => execution.exitCode === 0
      && status.status === "p1_outcome_download_staged_for_source_compile"
      && status.candidate_valid === true
      && status.stage_performed === true
      && await exists(tempTarget)
      && noRedLines({ ...status, live_input_files_created: false }),
  }));

  const sensitiveCandidate = path.join(tempRoot, "source_capture_ledger.sensitive.csv");
  const sensitiveRows = filledOutcomeRows(templateRows.rows).map((row, index) => index === 0
    ? { ...row, evidence_ref: "customer phone 0912-345-678" }
    : row);
  await writeFile(sensitiveCandidate, renderCsv(templateRows.headers, sensitiveRows));
  scenarios.push(await runScenario({
    tempRoot,
    name: "sensitive_value_blocked",
    args: [`--input=${sensitiveCandidate}`],
    expect: (status, execution) => execution.exitCode === 0
      && status.status === "blocked_invalid_p1_outcome_download"
      && status.candidate_valid === false
      && status.preflight_issue_count > 0
      && status.stage_performed === false
      && noRedLines(status),
  }));

  const ok = scenarios.every((scenario) => scenario.ok);
  const status = {
    ok,
    generated_at: generatedAt.toISOString(),
    mode: "owner_p1_outcome_intake_fixtures",
    temp_root: tempRoot,
    scenario_count: scenarios.length,
    scenarios,
    external_effect: false,
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

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));
  if (!ok) process.exitCode = 1;
}

async function runScenario({ tempRoot, name, args, expect }) {
  const scenarioDir = path.join(tempRoot, name);
  await mkdir(scenarioDir, { recursive: true });
  const statusPath = path.join(scenarioDir, "status.json");
  const jsonPath = path.join(scenarioDir, "full.json");
  const reportPath = path.join(scenarioDir, "report.md");
  const realEventsPath = path.join(scenarioDir, "lp_events.jsonl");
  await writeFile(realEventsPath, "");
  const execution = await runNode([
    "scripts/owner-p1-outcome-intake.mjs",
    `--status=${statusPath}`,
    `--json=${jsonPath}`,
    `--report=${reportPath}`,
    `--real-events=${realEventsPath}`,
    ...args,
  ]);
  const status = JSON.parse(await readFile(statusPath, "utf8"));
  const ok = await expect(status, execution);
  return {
    name,
    ok,
    exit_code: execution.exitCode,
    status: status.status,
    candidate_found: status.candidate_found,
    candidate_valid: status.candidate_valid,
    filled_outcome_row_count: status.filled_outcome_row_count,
    pending_outcome_row_count: status.pending_outcome_row_count,
    stage_requested: status.stage_requested,
    stage_performed: status.stage_performed,
    stage_blocked_reason: status.stage_blocked_reason,
    external_effect: false,
  };
}

function filledOutcomeRows(rows) {
  return rows
    .filter((row) => OUTCOME_EVENTS.has(row.stage))
    .map((row, index) => ({
      ...row,
      capture_date: "2026-07-09",
      aggregate_count: String((index % 4) + 1),
      evidence_ref: `fixture-p1-${index + 1}`,
      reviewer: "fixture_reviewer",
      pii_checked: "yes",
      quality_score: row.stage === "quality_flag" ? "0.9" : "",
    }));
}

function noRedLines(status) {
  return [
    "external_effect",
    "data_lp_events_write_performed",
    "public_link_change_performed",
    "production_deploy_performed",
    "github_push_or_pr_performed",
    "formal_post_performed",
    "line_push_performed",
    "customer_data_mutation_performed",
    "payment_action_performed",
    "delete_action_performed",
  ].every((field) => status[field] === false);
}

async function runNode(args) {
  try {
    const result = await execFileAsync(process.execPath, args, { cwd: ROOT, maxBuffer: 1024 * 1024 * 12 });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      exitCode: Number.isInteger(error.code) ? error.code : 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? String(error.message ?? error),
    };
  }
}

function renderReport(status) {
  return `# Owner P1 Outcome Intake Fixture Report

BLUF: ${status.ok ? "ok" : "failed"}. Fixture guard covers waiting, valid-review-only, unconfirmed staging, confirmed temp staging, and sensitive-value blocking for P1 outcome downloads.

Generated: ${status.generated_at}
Mode: ${status.mode}
Scenarios: ${status.scenario_count}
External effect: no
data/lp_events.jsonl write performed: no

| scenario | ok | status | candidate valid | stage performed |
|---|---|---|---|---|
${status.scenarios.map((scenario) => `| ${scenario.name} | ${scenario.ok ? "yes" : "no"} | ${scenario.status} | ${scenario.candidate_valid ? "yes" : "no"} | ${scenario.stage_performed ? "yes" : "no"} |`).join("\n")}

## Safety

Fixtures use temporary files only. They do not write project live inputs, append events, deploy, post, push GitHub/LINE, mutate customer data, process payments, or delete data.
`;
}

function parseCsv(raw) {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
  const headers = lines[0].map((header) => header.trim());
  return {
    headers,
    rows: lines.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]))),
  };
}

function parseCsvLine(line) {
  const cells = [];
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
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function renderCsv(headers, rows) {
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
