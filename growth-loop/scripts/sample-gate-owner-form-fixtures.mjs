import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const TEMPLATE_PATH = path.join(ROOT, "data", "source_capture", "sample_gate_ledger.fill-template.csv");
const FORM_STATUS_PATH = path.join(ROOT, "data", "sample_gate_owner_form_status.json");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const STATUS_PATH = path.join(ROOT, "data", "sample_gate_owner_form_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "sample_gate_owner_form_fixture_report.md");
const SAMPLE_EVENTS = ["page_view", "cta_click", "line_add"];

async function main() {
  const generatedAt = new Date();
  const template = parseCsv(await readFile(TEMPLATE_PATH, "utf8"));
  const formStatus = JSON.parse(await readFile(FORM_STATUS_PATH, "utf8"));
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "3q-sample-gate-owner-form-fixtures-"));
  const realEventsBefore = await readOptional(REAL_EVENTS_PATH);
  const scenarios = [];

  for (const scenario of buildScenarios()) {
    scenarios.push(await runScenario(tempDir, template, scenario));
  }

  const realEventsAfter = await readOptional(REAL_EVENTS_PATH);
  const status = {
    ok: scenarios.every((scenario) => scenario.ok) && realEventsBefore === realEventsAfter,
    generated_at: generatedAt.toISOString(),
    mode: "sample_gate_owner_form_fixture_dry_run",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    template_path: TEMPLATE_PATH,
    form_status_path: FORM_STATUS_PATH,
    temp_dir: tempDir,
    template_rows: template.rows.length,
    form_status: formStatus.status,
    form_download_filename: formStatus.download_filename,
    scenario_count: scenarios.length,
    scenario_ids: scenarios.map((scenario) => scenario.id),
    scenarios,
    local_fixture_commands_executed: true,
    form_export_replay_executed: true,
    source_capture_compile_commands_executed: true,
    owner_sample_gate_commands_executed: true,
    real_events_unchanged: realEventsBefore === realEventsAfter,
    execution_performed: false,
    live_input_files_created: false,
    real_event_write_performed: false,
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
    note: "Fixture-only replay of the browser form download. It writes temporary sample_gate_ledger.filled.csv files, then verifies source compile and owner sample-gate status without creating live input CSVs, appending data/lp_events.jsonl, promoting a challenger, changing public links, deploying, posting, pushing LINE, mutating customer data, touching payments, or deleting data.",
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
      id: "form_export_sample_insufficient_keeps_collecting",
      description: "A browser-downloaded CSV fills every row, but challenger visits stay under min_visits, so the champion and current variable remain unchanged.",
      totals: {
        champion: { page_view: 100, cta_click: 20, line_add: 5 },
        challenger: { page_view: 99, cta_click: 20, line_add: 6 },
      },
      expected: {
        compileExit: 0,
        compileStatus: "owner_preview_ready",
        ownerExit: 0,
        ownerStatus: "sample_insufficient_keep_champion",
        ownerDecision: "continue_collecting_sample_gate_counts",
        sample_threshold_met: false,
        sample_rate_win_candidate: false,
        owner_review_required: false,
      },
    },
    {
      id: "form_export_ready_queues_owner_review",
      description: "A browser-downloaded CSV clears sample thresholds and beats champion rate, but it only queues owner quality review and never promotes.",
      totals: {
        champion: { page_view: 100, cta_click: 20, line_add: 5 },
        challenger: { page_view: 120, cta_click: 25, line_add: 8 },
      },
      expected: {
        compileExit: 0,
        compileStatus: "owner_preview_ready",
        ownerExit: 0,
        ownerStatus: "sample_rate_win_needs_quality_review",
        ownerDecision: "queue_owner_quality_review_no_auto_promotion",
        sample_threshold_met: true,
        sample_rate_win_candidate: true,
        owner_review_required: true,
      },
    },
    {
      id: "form_export_sensitive_evidence_blocked",
      description: "Sensitive-looking evidence in the browser-downloaded CSV blocks both compile and owner sample-gate status.",
      totals: {
        champion: { page_view: 100, cta_click: 20, line_add: 5 },
        challenger: { page_view: 120, cta_click: 25, line_add: 8 },
      },
      mutateRow(row) {
        row.evidence_ref = "owner@example.com";
      },
      expected: {
        compileExit: 1,
        compileStatus: "blocked_invalid_filled_ledger",
        ownerExit: 1,
        ownerStatus: "blocked_invalid_owner_sample_gate",
        ownerDecision: "fix_owner_sample_gate_ledger",
        sample_threshold_met: false,
        sample_rate_win_candidate: false,
        owner_review_required: false,
        issue_count_positive: true,
      },
    },
  ];
}

async function runScenario(tempDir, template, scenario) {
  const scenarioDir = path.join(tempDir, scenario.id);
  await mkdir(scenarioDir, { recursive: true });
  const inputPath = path.join(scenarioDir, "sample_gate_ledger.filled.csv");
  const compileOutputDir = path.join(scenarioDir, "compiled");
  const compileStatusPath = path.join(scenarioDir, "compile_status.json");
  const compileReportPath = path.join(scenarioDir, "compile_report.md");
  const ownerStatusPath = path.join(scenarioDir, "owner_status.compact.json");
  const ownerJsonPath = path.join(scenarioDir, "owner_status.json");
  const ownerReportPath = path.join(scenarioDir, "owner_report.md");
  const realEventsPath = path.join(scenarioDir, "lp_events.jsonl");

  await writeFile(inputPath, renderFilledLedger(template, scenario));

  const compileExecution = await runNode([
    "scripts/source-capture-compile.mjs",
    `--input=${inputPath}`,
    "--input-kind=sample_gate_owner_form_fixture",
    `--output-dir=${compileOutputDir}`,
    `--status=${compileStatusPath}`,
    `--report=${compileReportPath}`,
    `--real-events=${realEventsPath}`,
  ]);
  const ownerExecution = await runNode([
    "scripts/owner-sample-gate-status.mjs",
    `--input=${inputPath}`,
    `--status=${ownerStatusPath}`,
    `--json=${ownerJsonPath}`,
    `--report=${ownerReportPath}`,
    `--real-events=${realEventsPath}`,
  ]);

  const compileStatus = await readOptionalJson(compileStatusPath);
  const ownerStatus = await readOptionalJson(ownerStatusPath);
  const ownerFull = await readOptionalJson(ownerJsonPath);
  const assertions = buildAssertions(scenario, compileExecution, ownerExecution, compileStatus, ownerStatus, ownerFull);

  return {
    id: scenario.id,
    ok: assertions.every((assertion) => assertion.ok),
    description: scenario.description,
    expected: scenario.expected,
    assertions,
    compile_exit_code: compileExecution.exitCode,
    compile_status: compileStatus?.status ?? "missing",
    compile_ok: Boolean(compileStatus?.ok),
    compile_issue_count: compileStatus?.issue_count ?? 0,
    compile_filled_rows: compileStatus?.filled_rows ?? 0,
    compile_funnel_rows: compileStatus?.funnel_rows ?? 0,
    compile_manual_rows: compileStatus?.manual_rows ?? 0,
    owner_exit_code: ownerExecution.exitCode,
    owner_status: ownerStatus?.status ?? "missing",
    owner_ok: Boolean(ownerStatus?.ok),
    owner_decision: ownerStatus?.decision ?? "missing",
    owner_issue_count: ownerStatus?.issue_count ?? 0,
    filled_rows: ownerStatus?.filled_rows ?? 0,
    pending_rows: ownerStatus?.pending_rows ?? 0,
    sample_threshold_met: Boolean(ownerStatus?.sample_threshold_met),
    sample_rate_win_candidate: Boolean(ownerStatus?.sample_rate_win_candidate),
    challenger_win_rule_met: Boolean(ownerStatus?.challenger_win_rule_met),
    quality_guard_status: ownerStatus?.quality_guard_status ?? "missing",
    owner_review_required: Boolean(ownerStatus?.owner_review_required),
    promotion_performed: Boolean(ownerStatus?.promotion_performed),
    challenger_gaps: ownerFull?.challenger?.gaps ?? null,
    compile_data_lp_events_write_performed: Boolean(compileStatus?.data_lp_events_write_performed),
    owner_data_lp_events_write_performed: Boolean(ownerStatus?.data_lp_events_write_performed),
    data_lp_events_write_performed: Boolean(compileStatus?.data_lp_events_write_performed) || Boolean(ownerStatus?.data_lp_events_write_performed),
    live_input_files_created: false,
    real_event_write_performed: false,
    external_effect: Boolean(compileStatus?.external_effect) || Boolean(ownerStatus?.external_effect),
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    temp_files: {
      input_path: inputPath,
      compile_status_path: compileStatusPath,
      compile_report_path: compileReportPath,
      owner_status_path: ownerStatusPath,
      owner_json_path: ownerJsonPath,
      owner_report_path: ownerReportPath,
    },
  };
}

function buildAssertions(scenario, compileExecution, ownerExecution, compileStatus, ownerStatus, ownerFull) {
  const expected = scenario.expected;
  const assertions = [
    check("compile_exit_code", compileExecution.exitCode === expected.compileExit, expected.compileExit, compileExecution.exitCode),
    check("compile_status_written", Boolean(compileStatus), "compile status json", compileStatus ? "present" : "missing"),
    check("compile_status", compileStatus?.status === expected.compileStatus, expected.compileStatus, compileStatus?.status ?? "missing"),
    check("owner_exit_code", ownerExecution.exitCode === expected.ownerExit, expected.ownerExit, ownerExecution.exitCode),
    check("owner_status_written", Boolean(ownerStatus), "owner compact status json", ownerStatus ? "present" : "missing"),
    check("owner_full_written", Boolean(ownerFull), "owner full status json", ownerFull ? "present" : "missing"),
    check("owner_status", ownerStatus?.status === expected.ownerStatus, expected.ownerStatus, ownerStatus?.status ?? "missing"),
    check("owner_decision", ownerStatus?.decision === expected.ownerDecision, expected.ownerDecision, ownerStatus?.decision ?? "missing"),
    check("sample_threshold_met", ownerStatus?.sample_threshold_met === expected.sample_threshold_met, expected.sample_threshold_met, ownerStatus?.sample_threshold_met),
    check("sample_rate_win_candidate", ownerStatus?.sample_rate_win_candidate === expected.sample_rate_win_candidate, expected.sample_rate_win_candidate, ownerStatus?.sample_rate_win_candidate),
    check("owner_review_required", ownerStatus?.owner_review_required === expected.owner_review_required, expected.owner_review_required, ownerStatus?.owner_review_required),
    check("quality_not_evaluated", ownerStatus?.quality_guard_status === "not_evaluated_from_sample_gate", "not_evaluated_from_sample_gate", ownerStatus?.quality_guard_status),
    check("no_final_win_rule", ownerStatus?.challenger_win_rule_met === false, false, ownerStatus?.challenger_win_rule_met),
    check("no_promotion", ownerStatus?.promotion_performed === false, false, ownerStatus?.promotion_performed),
    check("compile_no_live_input", compileStatus?.live_input_files_created === false, false, compileStatus?.live_input_files_created),
    check("owner_no_live_input", ownerStatus?.live_input_files_created === false, false, ownerStatus?.live_input_files_created),
    check("compile_no_real_event_write", compileStatus?.data_lp_events_write_performed === false, false, compileStatus?.data_lp_events_write_performed),
    check("owner_no_real_event_write", ownerStatus?.data_lp_events_write_performed === false, false, ownerStatus?.data_lp_events_write_performed),
    check("compile_no_external_effect", compileStatus?.external_effect === false, false, compileStatus?.external_effect),
    check("owner_no_external_effect", ownerStatus?.external_effect === false, false, ownerStatus?.external_effect),
  ];

  if (expected.compileExit === 0) {
    assertions.push(check("compile_ok", compileStatus?.ok === true, true, compileStatus?.ok));
    assertions.push(check("owner_ok", ownerStatus?.ok === true && ownerFull?.ok === true, true, `${ownerStatus?.ok}:${ownerFull?.ok}`));
    assertions.push(check("all_rows_filled", ownerStatus?.filled_rows === 18 && ownerStatus?.pending_rows === 0, "18:0", `${ownerStatus?.filled_rows}:${ownerStatus?.pending_rows}`));
  } else {
    assertions.push(check("compile_blocked", compileStatus?.ok === false, false, compileStatus?.ok));
    assertions.push(check("owner_blocked", ownerStatus?.ok === false && ownerFull?.ok === false, false, `${ownerStatus?.ok}:${ownerFull?.ok}`));
  }

  if (expected.issue_count_positive) {
    assertions.push(check("compile_issue_count_positive", Number(compileStatus?.issue_count ?? 0) > 0, ">0", compileStatus?.issue_count ?? 0));
    assertions.push(check("owner_issue_count_positive", Number(ownerStatus?.issue_count ?? 0) > 0, ">0", ownerStatus?.issue_count ?? 0));
  }

  return assertions;
}

function renderFilledLedger(template, scenario) {
  const rows = template.rows.map((row) => ({ ...row }));
  const grouped = groupRows(rows);

  for (const [assetId, stages] of Object.entries(grouped)) {
    const role = assetId.includes("champion") ? "champion" : "challenger";
    for (const eventType of SAMPLE_EVENTS) {
      const stageRows = stages[eventType] ?? [];
      const total = scenario.totals?.[role]?.[eventType] ?? 0;
      const split = splitCount(total, stageRows.length || 1);
      stageRows.forEach((item, index) => {
        item.row.capture_date = addDays(item.row.week_start, index % 3);
        item.row.aggregate_count = String(split[index] ?? 0);
        item.row.evidence_ref = `fixtures/${scenario.id}/${role}/${eventType}.csv`;
        item.row.reviewer = "owner";
        item.row.pii_checked = "yes";
        scenario.mutateRow?.(item.row, { role, eventType, index });
      });
    }
  }

  return renderCsv(template.headers, rows);
}

function groupRows(rows) {
  const grouped = {};
  rows.forEach((row) => {
    if (!SAMPLE_EVENTS.includes(row.stage)) return;
    grouped[row.asset_id] ??= {};
    grouped[row.asset_id][row.stage] ??= [];
    grouped[row.asset_id][row.stage].push({ row });
  });
  return grouped;
}

function splitCount(count, slots) {
  const safeSlots = Math.max(1, Number(slots) || 1);
  const safeCount = Math.max(0, Number(count) || 0);
  const base = Math.floor(safeCount / safeSlots);
  const remainder = safeCount % safeSlots;
  return Array.from({ length: safeSlots }, (_, index) => base + (index < remainder ? 1 : 0));
}

function addDays(startDate, dayIndex) {
  const parsed = new Date(`${startDate}T12:00:00+08:00`);
  parsed.setDate(parsed.getDate() + dayIndex);
  return parsed.toISOString().slice(0, 10);
}

function parseCsv(raw) {
  const rows = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
  const headers = rows[0].map((header) => header.trim());
  return {
    headers,
    rows: rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]))),
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
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function check(name, ok, expected, actual) {
  return { name, ok, expected, actual, external_effect: false };
}

async function runNode(args) {
  try {
    const { stdout, stderr } = await execFileAsync("node", args, {
      cwd: ROOT,
      maxBuffer: 1024 * 1024 * 8,
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

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function readOptional(filePath) {
  try {
    await access(filePath);
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function renderReport(status) {
  const rows = status.scenarios
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "failed"} | ${scenario.compile_status} | ${scenario.owner_status} | ${scenario.owner_decision} | ${scenario.filled_rows} | ${scenario.pending_rows} | ${scenario.sample_threshold_met ? "yes" : "no"} | ${scenario.sample_rate_win_candidate ? "yes" : "no"} | ${scenario.owner_review_required ? "yes" : "no"} | ${scenario.promotion_performed ? "yes" : "no"} |`)
    .join("\n");

  return `# 3Q Growth Loop Sample Gate Owner Form Fixture Report

BLUF: ${status.ok ? "sample_gate_owner_form_fixture_ok" : "sample_gate_owner_form_fixture_failed"}。This fixture proves the local browser form's downloaded CSV shape can replay through source compile and owner sample-gate status without live input writes, real event writes, external effects, or challenger promotion.

Generated: ${status.generated_at}
Mode: ${status.mode}
Template rows: ${status.template_rows}
Form download filename: ${status.form_download_filename}
Scenarios: ${status.scenario_count}
Local fixture commands executed: ${status.local_fixture_commands_executed ? "yes" : "no"}
Form export replay executed: ${status.form_export_replay_executed ? "yes" : "no"}
Source capture compile commands executed: ${status.source_capture_compile_commands_executed ? "yes" : "no"}
Owner sample gate commands executed: ${status.owner_sample_gate_commands_executed ? "yes" : "no"}
Live input files created: no
data/lp_events.jsonl write performed: no
External effect: no
Promotion performed: no

## Scenario Summary

| scenario | result | compile status | owner status | owner decision | filled | pending | sample met | rate win candidate | owner review | promoted |
|---|---|---|---|---|---:|---:|---|---|---|---|
${rows}

## Owner Boundary

All replay CSVs are temporary under \`${status.temp_dir}\`. The fixture does not create \`data/source_capture/sample_gate_ledger.filled.csv\`, does not create live aggregate CSVs, does not append \`data/lp_events.jsonl\`, does not promote a challenger, and does not change public links.
`;
}

main();
