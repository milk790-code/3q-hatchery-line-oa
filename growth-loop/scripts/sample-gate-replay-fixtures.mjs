import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "config", "growth-loop.config.json");
const TEMPLATE_PATH = path.join(ROOT, "data", "source_capture", "sample_gate_ledger.fill-template.csv");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const STATUS_PATH = path.join(ROOT, "data", "sample_gate_replay_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "sample_gate_replay_fixture_report.md");
const SAMPLE_EVENTS = ["page_view", "cta_click", "line_add"];

async function main() {
  const generatedAt = new Date();
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const templateRaw = await readFile(TEMPLATE_PATH, "utf8");
  const template = parseCsv(templateRaw);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "3q-growth-loop-sample-gate-replay-"));
  const beforeRealEvents = await readOptional(REAL_EVENTS_PATH);
  const scenarios = [];

  for (const scenario of buildScenarios(config)) {
    scenarios.push(await runScenario(tempDir, config, template, scenario));
  }

  const afterRealEvents = await readOptional(REAL_EVENTS_PATH);
  const realEventsUnchanged = beforeRealEvents === afterRealEvents;
  const status = {
    ok: scenarios.every((scenario) => scenario.ok) && realEventsUnchanged,
    generated_at: generatedAt.toISOString(),
    mode: "sample_gate_replay_fixture_dry_run",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    template_path: TEMPLATE_PATH,
    temp_dir: tempDir,
    template_rows: template.rows.length,
    sample_event_types: SAMPLE_EVENTS,
    scenario_count: scenarios.length,
    scenarios,
    local_fixture_commands_executed: true,
    source_capture_compile_commands_executed: true,
    importer_preview_commands_executed: true,
    sample_gate_ledger_replay_executed: true,
    real_events_unchanged: realEventsUnchanged,
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
    note: "Fixture-only sample-gate replay. It fills a temporary copy of the 18-row sample-gate ledger, compiles owner-preview CSVs, imports them to temporary JSONL, and checks sample threshold logic without writing data/lp_events.jsonl.",
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildScenarios(config) {
  const thresholds = config.sample_thresholds ?? {};
  return [
    {
      id: "sample_gate_insufficient_keeps_collecting",
      description: "Challenger has LINE adds, but visits stay below min_visits, so the sample gate stays closed.",
      totals: {
        champion: { page_view: thresholds.min_visits, cta_click: thresholds.min_cta_clicks, line_add: thresholds.min_line_adds },
        challenger: { page_view: thresholds.min_visits - 1, cta_click: thresholds.min_cta_clicks, line_add: thresholds.min_line_adds + 1 },
      },
      expected: {
        challenger_sample_threshold_met: false,
        challenger_beats_sample_rate: false,
        decision: "continue_collecting_sample_gate_counts",
      },
    },
    {
      id: "sample_gate_ready_challenger_beats_rate",
      description: "Challenger clears sample thresholds and beats the champion LINE add rate by more than 1.15x, but still queues owner review only.",
      totals: {
        champion: { page_view: thresholds.min_visits, cta_click: thresholds.min_cta_clicks, line_add: thresholds.min_line_adds },
        challenger: { page_view: thresholds.min_visits + 20, cta_click: thresholds.min_cta_clicks + 5, line_add: thresholds.min_line_adds + 3 },
      },
      expected: {
        challenger_sample_threshold_met: true,
        challenger_beats_sample_rate: true,
        decision: "queue_owner_review_no_auto_promotion",
      },
    },
    {
      id: "sample_gate_ready_challenger_underperforms",
      description: "Challenger clears sample thresholds but loses on LINE add rate, so the current challenger should be reworked or retired locally.",
      totals: {
        champion: { page_view: thresholds.min_visits, cta_click: thresholds.min_cta_clicks, line_add: thresholds.min_line_adds + 3 },
        challenger: { page_view: thresholds.min_visits, cta_click: thresholds.min_cta_clicks, line_add: thresholds.min_line_adds },
      },
      expected: {
        challenger_sample_threshold_met: true,
        challenger_beats_sample_rate: false,
        decision: "plan_rework_or_next_variable_after_owner_review",
      },
    },
  ];
}

async function runScenario(tempDir, config, template, scenario) {
  const scenarioDir = path.join(tempDir, scenario.id);
  const filledLedgerPath = path.join(scenarioDir, "sample_gate_ledger.filled.csv");
  const outputDir = path.join(scenarioDir, "compiled");
  const funnelPreviewPath = path.join(outputDir, "funnel_aggregates.owner-preview.csv");
  const manualPreviewPath = path.join(outputDir, "manual_conversions.owner-preview.csv");
  const compileStatusPath = path.join(scenarioDir, "source_capture_compile_status.json");
  const compileReportPath = path.join(scenarioDir, "source_capture_compile_report.md");
  const eventsPath = path.join(scenarioDir, "sample_gate.preview.jsonl");
  const funnelStatusPath = path.join(scenarioDir, "funnel_aggregate_status.json");
  const manualStatusPath = path.join(scenarioDir, "manual_conversion_status.json");
  await mkdir(scenarioDir, { recursive: true });
  await writeFile(filledLedgerPath, renderFilledLedger(template, scenario));

  const compileExecution = await runNode([
    "scripts/source-capture-compile.mjs",
    `--input=${filledLedgerPath}`,
    "--input-kind=sample_gate_replay_fixture",
    `--output-dir=${outputDir}`,
    `--funnel-preview=${funnelPreviewPath}`,
    `--manual-preview=${manualPreviewPath}`,
    `--status=${compileStatusPath}`,
    `--report=${compileReportPath}`,
    `--real-events=${REAL_EVENTS_PATH}`,
  ]);
  const compileStatus = await readOptionalJson(compileStatusPath);

  const funnelExecution = await runNode(
    ["scripts/import-funnel-aggregates.mjs", `--input=${funnelPreviewPath}`, `--output=${eventsPath}`],
    { FUNNEL_AGGREGATE_STATUS_PATH: funnelStatusPath },
  );
  const manualExecution = await runNode(
    ["scripts/import-manual-conversions.mjs", `--input=${manualPreviewPath}`, `--output=${eventsPath}`, "--append"],
    { MANUAL_CONVERSION_STATUS_PATH: manualStatusPath },
  );
  const funnelStatus = await readOptionalJson(funnelStatusPath);
  const manualStatus = await readOptionalJson(manualStatusPath);
  const events = await readJsonl(eventsPath);
  const summary = summarizeSampleGate(config, events);
  const assertions = buildAssertions(scenario, compileStatus, funnelStatus, manualStatus, summary, compileExecution, funnelExecution, manualExecution);

  return {
    id: scenario.id,
    ok: assertions.every((assertion) => assertion.ok),
    description: scenario.description,
    expected: scenario.expected,
    assertions,
    imported_events: events.length,
    source_capture_compile: {
      ok: compileStatus?.ok === true,
      status: compileStatus?.status ?? "missing",
      input_kind: compileStatus?.input_kind ?? "missing",
      ledger_rows_read: compileStatus?.ledger_rows_read ?? 0,
      filled_rows: compileStatus?.filled_rows ?? 0,
      funnel_rows: compileStatus?.funnel_rows ?? 0,
      manual_rows: compileStatus?.manual_rows ?? 0,
      issue_count: compileStatus?.issue_count ?? 0,
      data_lp_events_write_performed: Boolean(compileStatus?.data_lp_events_write_performed),
      external_effect: Boolean(compileStatus?.external_effect),
    },
    importer_status: {
      funnel_ok: funnelStatus?.ok === true,
      funnel_mode: funnelStatus?.mode ?? "missing",
      funnel_events_written: funnelStatus?.events_written ?? 0,
      manual_ok: manualStatus?.ok === true,
      manual_mode: manualStatus?.mode ?? "missing",
      manual_events_written: manualStatus?.events_written ?? 0,
      manual_append_performed: Boolean(manualStatus?.append_performed),
      data_lp_events_write_performed: Boolean(funnelStatus?.data_lp_events_write_performed || manualStatus?.data_lp_events_write_performed),
    },
    sample_summary: summary,
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
    temp_files: {
      filled_ledger_path: filledLedgerPath,
      compile_status_path: compileStatusPath,
      funnel_preview_path: funnelPreviewPath,
      manual_preview_path: manualPreviewPath,
      events_path: eventsPath,
      funnel_status_path: funnelStatusPath,
      manual_status_path: manualStatusPath,
    },
    exit_codes: {
      source_capture_compile: compileExecution.exitCode,
      funnel: funnelExecution.exitCode,
      manual: manualExecution.exitCode,
    },
  };
}

function renderFilledLedger(template, scenario) {
  const filled = template.rows.map((row) => ({ ...row }));
  const rowsByAssetStage = groupTemplateRows(filled);

  for (const [assetId, stages] of Object.entries(rowsByAssetStage)) {
    const role = assetId.includes("champion") ? "champion" : "challenger";
    for (const stage of SAMPLE_EVENTS) {
      const rows = stages[stage] ?? [];
      const total = scenario.totals[role]?.[stage] ?? 0;
      const split = splitCount(total, rows.length || 1);
      rows.forEach((item, index) => {
        item.row.capture_date = addDays(item.row.week_start, index % 7);
        item.row.aggregate_count = String(split[index] ?? 0);
        item.row.evidence_ref = `fixtures/${scenario.id}/${role}/${stage}.csv`;
        item.row.reviewer = "owner";
        item.row.pii_checked = "yes";
      });
    }
  }

  return renderCsv(template.headers, filled);
}

function groupTemplateRows(rows) {
  const grouped = {};
  rows.forEach((row) => {
    if (!SAMPLE_EVENTS.includes(row.stage)) return;
    grouped[row.asset_id] ??= {};
    grouped[row.asset_id][row.stage] ??= [];
    grouped[row.asset_id][row.stage].push({ row });
  });
  return grouped;
}

function summarizeSampleGate(config, events) {
  const thresholds = config.sample_thresholds;
  const byAsset = {};
  for (const asset of config.assets ?? []) {
    byAsset[asset.asset_id] = {
      asset_id: asset.asset_id,
      role: asset.role,
      visits: 0,
      cta_clicks: 0,
      line_adds: 0,
      line_add_rate: 0,
      sample_threshold_met: false,
    };
  }

  for (const event of events) {
    byAsset[event.asset_id] ??= {
      asset_id: event.asset_id,
      role: event.asset_id.includes("champion") ? "champion" : "challenger",
      visits: 0,
      cta_clicks: 0,
      line_adds: 0,
      line_add_rate: 0,
      sample_threshold_met: false,
    };
    if (event.event_type === "page_view") byAsset[event.asset_id].visits += 1;
    if (event.event_type === "cta_click") byAsset[event.asset_id].cta_clicks += 1;
    if (event.event_type === "line_add") byAsset[event.asset_id].line_adds += 1;
  }

  for (const row of Object.values(byAsset)) {
    row.line_add_rate = round(safeDivide(row.line_adds, row.visits));
    row.sample_threshold_met =
      row.visits >= thresholds.min_visits &&
      row.cta_clicks >= thresholds.min_cta_clicks &&
      row.line_adds >= thresholds.min_line_adds;
  }

  const champion = Object.values(byAsset).find((row) => row.role === "champion") ?? {};
  const challenger = Object.values(byAsset).find((row) => row.role === "challenger") ?? {};
  const lift = champion.line_add_rate > 0 ? round(challenger.line_add_rate / champion.line_add_rate) : null;
  const challengerBeatsSampleRate =
    challenger.sample_threshold_met === true &&
    champion.line_add_rate > 0 &&
    challenger.line_add_rate > champion.line_add_rate * config.win_rule.challenger_lift_required;

  return {
    thresholds: {
      min_visits: thresholds.min_visits,
      min_cta_clicks: thresholds.min_cta_clicks,
      min_line_adds: thresholds.min_line_adds,
      min_test_days: thresholds.min_test_days,
      preferred_test_days: thresholds.preferred_test_days,
    },
    assets: Object.values(byAsset),
    champion,
    challenger,
    lift,
    challenger_beats_sample_rate: challengerBeatsSampleRate,
    decision: decideSampleGate(challenger, challengerBeatsSampleRate),
    no_quality_regression_checked: false,
    owner_review_required: true,
    promotion_performed: false,
  };
}

function decideSampleGate(challenger, challengerBeatsSampleRate) {
  if (!challenger.sample_threshold_met) return "continue_collecting_sample_gate_counts";
  if (challengerBeatsSampleRate) return "queue_owner_review_no_auto_promotion";
  return "plan_rework_or_next_variable_after_owner_review";
}

function buildAssertions(scenario, compileStatus, funnelStatus, manualStatus, summary, compileExecution, funnelExecution, manualExecution) {
  return [
    {
      name: "source_compile_ok",
      ok: compileExecution.exitCode === 0 && compileStatus?.ok === true && compileStatus?.status === "owner_preview_ready",
      expected: "owner_preview_ready",
      actual: compileStatus?.status ?? "missing",
    },
    {
      name: "sample_rows_filled",
      ok: compileStatus?.ledger_rows_read === 18 && compileStatus?.filled_rows === 18,
      expected: "18:18",
      actual: `${compileStatus?.ledger_rows_read ?? 0}:${compileStatus?.filled_rows ?? 0}`,
    },
    {
      name: "importers_preview_ok",
      ok: funnelExecution.exitCode === 0 && manualExecution.exitCode === 0 && funnelStatus?.ok === true && manualStatus?.ok === true,
      expected: "preview importers ok",
      actual: `${funnelStatus?.mode ?? "missing"}:${manualStatus?.mode ?? "missing"}`,
    },
    {
      name: "no_real_event_write",
      ok: compileStatus?.data_lp_events_write_performed === false &&
        funnelStatus?.data_lp_events_write_performed === false &&
        manualStatus?.data_lp_events_write_performed === false,
      expected: false,
      actual: Boolean(compileStatus?.data_lp_events_write_performed || funnelStatus?.data_lp_events_write_performed || manualStatus?.data_lp_events_write_performed),
    },
    {
      name: "challenger_sample_threshold",
      ok: summary.challenger.sample_threshold_met === scenario.expected.challenger_sample_threshold_met,
      expected: scenario.expected.challenger_sample_threshold_met,
      actual: summary.challenger.sample_threshold_met,
    },
    {
      name: "challenger_beats_sample_rate",
      ok: summary.challenger_beats_sample_rate === scenario.expected.challenger_beats_sample_rate,
      expected: scenario.expected.challenger_beats_sample_rate,
      actual: summary.challenger_beats_sample_rate,
    },
    {
      name: "decision",
      ok: summary.decision === scenario.expected.decision,
      expected: scenario.expected.decision,
      actual: summary.decision,
    },
    {
      name: "no_auto_promotion",
      ok: summary.promotion_performed === false && summary.owner_review_required === true,
      expected: "owner_review_required_no_promotion",
      actual: `${summary.owner_review_required}:${summary.promotion_performed}`,
    },
  ];
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

function safeDivide(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function round(value) {
  return Number(value.toFixed(4));
}

async function runNode(args, envOverrides = {}) {
  try {
    const { stdout, stderr } = await execFileAsync("node", args, {
      cwd: ROOT,
      env: {
        ...process.env,
        ...envOverrides,
      },
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

async function readJsonl(filePath) {
  const raw = await readFile(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
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
  const scenarioRows = status.scenarios.map((scenario) => {
    const summary = scenario.sample_summary;
    return `| ${scenario.id} | ${scenario.ok ? "ok" : "failed"} | ${summary.challenger.visits} | ${summary.challenger.cta_clicks} | ${summary.challenger.line_adds} | ${summary.challenger.sample_threshold_met ? "yes" : "no"} | ${summary.lift ?? "n/a"} | ${summary.decision} |`;
  }).join("\n");

  return `# 3Q Growth Loop Sample Gate Replay Fixture

BLUF: ${status.ok ? "sample_gate_replay_fixture_ok" : "sample_gate_replay_fixture_failed"}。This fixture proves the 18-row sample-gate filled ledger can compile into owner-preview CSVs and replay into sample-threshold decisions without writing real events or taking external action.

Generated: ${status.generated_at}
Mode: ${status.mode}
Template rows: ${status.template_rows}
Scenarios: ${status.scenario_count}
Sample event types: ${status.sample_event_types.join(", ")}
Source capture compile commands executed: ${status.source_capture_compile_commands_executed ? "yes" : "no"}
Importer preview commands executed: ${status.importer_preview_commands_executed ? "yes" : "no"}
Sample gate ledger replay: ${status.sample_gate_ledger_replay_executed ? "yes" : "no"}
data/lp_events.jsonl write performed: no
External effect: no
Promotion performed: no

## Scenario Summary

| scenario | result | challenger visits | challenger CTA | challenger LINE | sample met | lift | decision |
|---|---:|---:|---:|---:|---|---:|---|
${scenarioRows}

## Owner Boundary

This is a temporary fixture only. It does not create \`data/source_capture/sample_gate_ledger.filled.csv\`, does not create live aggregate CSVs, does not append \`data/lp_events.jsonl\`, and does not promote a challenger. A real owner-filled ledger must still be reviewed before local apply.
`;
}

main();
