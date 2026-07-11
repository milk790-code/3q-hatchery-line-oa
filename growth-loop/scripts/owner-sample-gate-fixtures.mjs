import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const TEMPLATE_PATH = path.join(ROOT, "data", "source_capture", "sample_gate_ledger.fill-template.csv");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const STATUS_PATH = path.join(ROOT, "data", "owner_sample_gate_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "owner_sample_gate_fixture_report.md");
const SAMPLE_EVENTS = ["page_view", "cta_click", "line_add"];

async function main() {
  const generatedAt = new Date();
  const template = parseCsv(await readFile(TEMPLATE_PATH, "utf8"));
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "3q-owner-sample-gate-fixtures-"));
  const beforeRealEvents = await readOptional(REAL_EVENTS_PATH);
  const scenarios = [];

  for (const scenario of buildScenarios()) {
    scenarios.push(await runScenario(tempDir, template, scenario));
  }

  const afterRealEvents = await readOptional(REAL_EVENTS_PATH);
  const status = {
    ok: scenarios.every((scenario) => scenario.ok) && beforeRealEvents === afterRealEvents,
    generated_at: generatedAt.toISOString(),
    mode: "owner_sample_gate_fixture_dry_run",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    temp_dir: tempDir,
    scenario_count: scenarios.length,
    scenarios,
    owner_sample_gate_commands_executed: true,
    real_events_unchanged: beforeRealEvents === afterRealEvents,
    execution_performed: false,
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
    note: "Fixture-only owner sample-gate contract. It uses temporary filled ledgers and never creates data/source_capture/sample_gate_ledger.filled.csv, applies CSVs, appends data/lp_events.jsonl, promotes a challenger, changes public links, deploys, posts, pushes LINE, mutates customer data, touches payments, or deletes data.",
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
      id: "missing_input_waits_for_owner_counts",
      description: "No owner-filled sample-gate ledger exists, so the status stays waiting and does not fail the weekly loop.",
      missingInput: true,
      expected: {
        exitCode: 0,
        status: "waiting_for_owner_sample_gate_counts",
        decision: "continue_collecting_sample_gate_counts",
        sample_threshold_met: false,
        sample_rate_win_candidate: false,
        owner_review_required: false,
      },
    },
    {
      id: "partial_counts_keep_collecting",
      description: "Only some rows are filled, so the owner must finish remaining aggregate counts or enter 0 intentionally.",
      fillLimit: 6,
      totals: {
        champion: { page_view: 100, cta_click: 20, line_add: 5 },
        challenger: { page_view: 120, cta_click: 25, line_add: 8 },
      },
      expected: {
        exitCode: 0,
        status: "owner_counts_incomplete",
        decision: "continue_collecting_sample_gate_counts",
        sample_threshold_met: false,
        sample_rate_win_candidate: false,
        owner_review_required: false,
      },
    },
    {
      id: "sample_insufficient_due_visits",
      description: "The challenger has enough CTA and LINE adds but not enough visits, so the champion stays unchanged.",
      totals: {
        champion: { page_view: 100, cta_click: 20, line_add: 5 },
        challenger: { page_view: 99, cta_click: 20, line_add: 6 },
      },
      expected: {
        exitCode: 0,
        status: "sample_insufficient_keep_champion",
        decision: "continue_collecting_sample_gate_counts",
        sample_threshold_met: false,
        sample_rate_win_candidate: false,
        owner_review_required: false,
      },
    },
    {
      id: "sample_insufficient_due_test_days",
      description: "Counts clear numeric thresholds but all evidence is on one date, so min_test_days blocks the sample gate.",
      daySpan: 1,
      totals: {
        champion: { page_view: 100, cta_click: 20, line_add: 5 },
        challenger: { page_view: 120, cta_click: 25, line_add: 8 },
      },
      expected: {
        exitCode: 0,
        status: "sample_insufficient_keep_champion",
        decision: "continue_collecting_sample_gate_counts",
        sample_threshold_met: false,
        sample_rate_win_candidate: false,
        owner_review_required: false,
        challenger_test_day_gap_positive: true,
      },
    },
    {
      id: "sample_rate_win_needs_quality_review",
      description: "The challenger clears sample thresholds and beats the champion rate, but final promotion stays blocked because quality is not evaluated here.",
      totals: {
        champion: { page_view: 100, cta_click: 20, line_add: 5 },
        challenger: { page_view: 120, cta_click: 25, line_add: 8 },
      },
      expected: {
        exitCode: 0,
        status: "sample_rate_win_needs_quality_review",
        decision: "queue_owner_quality_review_no_auto_promotion",
        sample_threshold_met: true,
        sample_rate_win_candidate: true,
        owner_review_required: true,
      },
    },
    {
      id: "sample_ready_challenger_underperforms",
      description: "The challenger clears sample thresholds but fails to beat champion rate, so the next move is local rework/next variable review.",
      totals: {
        champion: { page_view: 100, cta_click: 20, line_add: 8 },
        challenger: { page_view: 100, cta_click: 20, line_add: 5 },
      },
      expected: {
        exitCode: 0,
        status: "sample_ready_challenger_underperforms",
        decision: "plan_rework_or_next_variable_after_owner_review",
        sample_threshold_met: true,
        sample_rate_win_candidate: false,
        owner_review_required: true,
      },
    },
    {
      id: "sensitive_evidence_blocks_status",
      description: "Sensitive-looking evidence refs block the ledger and keep all external actions false.",
      mutateRow: (row) => {
        row.evidence_ref = "owner@example.com";
      },
      totals: {
        champion: { page_view: 100, cta_click: 20, line_add: 5 },
        challenger: { page_view: 120, cta_click: 25, line_add: 8 },
      },
      expected: {
        exitCode: 1,
        status: "blocked_invalid_owner_sample_gate",
        decision: "fix_owner_sample_gate_ledger",
        ok: false,
        issue_count_positive: true,
        sample_threshold_met: false,
        sample_rate_win_candidate: false,
        owner_review_required: false,
      },
    },
  ];
}

async function runScenario(tempDir, template, scenario) {
  const scenarioDir = path.join(tempDir, scenario.id);
  await mkdir(scenarioDir, { recursive: true });
  const inputPath = path.join(scenarioDir, "sample_gate_ledger.filled.csv");
  const statusPath = path.join(scenarioDir, "owner_sample_gate_status.compact.json");
  const jsonPath = path.join(scenarioDir, "owner_sample_gate_status.json");
  const reportPath = path.join(scenarioDir, "owner_sample_gate_status.md");

  if (!scenario.missingInput) {
    await writeFile(inputPath, renderFilledLedger(template, scenario));
  }

  const execution = await runNode([
    "scripts/owner-sample-gate-status.mjs",
    `--input=${inputPath}`,
    `--status=${statusPath}`,
    `--json=${jsonPath}`,
    `--report=${reportPath}`,
    `--real-events=${REAL_EVENTS_PATH}`,
  ]);
  const compact = await readOptionalJson(statusPath);
  const full = await readOptionalJson(jsonPath);
  const assertions = buildAssertions(scenario, compact, full, execution);

  return {
    id: scenario.id,
    ok: assertions.every((assertion) => assertion.ok),
    description: scenario.description,
    expected: scenario.expected,
    assertions,
    command_exit_code: execution.exitCode,
    status: compact?.status ?? "missing",
    decision: compact?.decision ?? "missing",
    input_exists: Boolean(compact?.input_exists),
    filled_rows: compact?.filled_rows ?? 0,
    pending_rows: compact?.pending_rows ?? 0,
    issue_count: compact?.issue_count ?? 0,
    sample_threshold_met: Boolean(compact?.sample_threshold_met),
    sample_rate_win_candidate: Boolean(compact?.sample_rate_win_candidate),
    challenger_win_rule_met: Boolean(compact?.challenger_win_rule_met),
    quality_guard_status: compact?.quality_guard_status ?? "missing",
    promotion_performed: Boolean(compact?.promotion_performed),
    owner_review_required: Boolean(compact?.owner_review_required),
    challenger_gaps: full?.challenger?.gaps ?? null,
    data_lp_events_write_performed: Boolean(compact?.data_lp_events_write_performed),
    external_effect: Boolean(compact?.external_effect),
    temp_files: {
      input_path: inputPath,
      status_path: statusPath,
      json_path: jsonPath,
      report_path: reportPath,
    },
  };
}

function buildAssertions(scenario, compact, full, execution) {
  const expected = scenario.expected;
  const assertions = [
    check("exit_code", execution.exitCode === expected.exitCode, expected.exitCode, execution.exitCode),
    check("compact_status_written", Boolean(compact), "compact status json", compact ? "present" : "missing"),
    check("full_status_written", Boolean(full), "full status json", full ? "present" : "missing"),
    check("status", compact?.status === expected.status, expected.status, compact?.status ?? "missing"),
    check("decision", compact?.decision === expected.decision, expected.decision, compact?.decision ?? "missing"),
    check("sample_threshold_met", compact?.sample_threshold_met === expected.sample_threshold_met, expected.sample_threshold_met, compact?.sample_threshold_met),
    check("sample_rate_win_candidate", compact?.sample_rate_win_candidate === expected.sample_rate_win_candidate, expected.sample_rate_win_candidate, compact?.sample_rate_win_candidate),
    check("owner_review_required", compact?.owner_review_required === expected.owner_review_required, expected.owner_review_required, compact?.owner_review_required),
    check("quality_not_evaluated", compact?.quality_guard_status === "not_evaluated_from_sample_gate", "not_evaluated_from_sample_gate", compact?.quality_guard_status),
    check("no_final_win_rule", compact?.challenger_win_rule_met === false, false, compact?.challenger_win_rule_met),
    check("no_promotion", compact?.promotion_performed === false, false, compact?.promotion_performed),
    check("no_real_event_write", compact?.data_lp_events_write_performed === false, false, compact?.data_lp_events_write_performed),
    check("no_external_effect", compact?.external_effect === false, false, compact?.external_effect),
  ];

  if ("ok" in expected) {
    assertions.push(check("ok_flag", compact?.ok === expected.ok && full?.ok === expected.ok, expected.ok, `${compact?.ok}:${full?.ok}`));
  } else {
    assertions.push(check("ok_flag", compact?.ok === true && full?.ok === true, true, `${compact?.ok}:${full?.ok}`));
  }

  if (expected.issue_count_positive) {
    assertions.push(check("issue_count_positive", Number(compact?.issue_count ?? 0) > 0, ">0", compact?.issue_count ?? 0));
  }

  if (expected.challenger_test_day_gap_positive) {
    assertions.push(check("challenger_test_day_gap_positive", Number(full?.challenger?.gaps?.test_days ?? 0) > 0, ">0", full?.challenger?.gaps?.test_days ?? 0));
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
        const fillIndex = rows.indexOf(item.row);
        if (Number.isInteger(scenario.fillLimit) && fillIndex >= scenario.fillLimit) {
          return;
        }
        item.row.capture_date = addDays(item.row.week_start, index % (scenario.daySpan ?? 3));
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
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
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
  return `"${text.replaceAll('"', '""')}"`;
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
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "failed"} | ${scenario.status} | ${scenario.decision} | ${scenario.filled_rows} | ${scenario.pending_rows} | ${scenario.sample_threshold_met ? "yes" : "no"} | ${scenario.sample_rate_win_candidate ? "yes" : "no"} | ${scenario.quality_guard_status} | ${scenario.promotion_performed ? "yes" : "no"} |`)
    .join("\n");

  return `# 3Q Growth Loop Owner Sample Gate Fixture Report

BLUF: ${status.ok ? "owner_sample_gate_fixture_ok" : "owner_sample_gate_fixture_failed"}。This fixture proves owner-filled sample-gate status handling for missing input, partial rows, insufficient visits, insufficient test days, sample-rate winners, underperformers, and sensitive evidence without applying data or promoting challengers.

Generated: ${status.generated_at}
Mode: ${status.mode}
Scenarios: ${status.scenario_count}
Owner sample gate commands executed: ${status.owner_sample_gate_commands_executed ? "yes" : "no"}
data/lp_events.jsonl write performed: no
External effect: no
Promotion performed: no

## Scenario Summary

| scenario | result | status | decision | filled | pending | sample met | rate win candidate | quality guard | promoted |
|---|---|---|---|---:|---:|---|---|---|---|
${rows}

## Owner Boundary

All files are temporary except this report and \`data/owner_sample_gate_fixture_status.json\`. The fixture does not create \`data/source_capture/sample_gate_ledger.filled.csv\`, does not create live aggregate CSVs, does not append \`data/lp_events.jsonl\`, and does not promote a challenger.
`;
}

main();
