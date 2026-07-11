import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "source_capture_compile_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "source_capture_compile_fixture_report.md");

const HEADERS = [
  "week_start",
  "week_end",
  "capture_date",
  "stage",
  "stage_label",
  "asset_id",
  "content_id",
  "variant_id",
  "tracking_link_id",
  "tracking_url",
  "source_surface",
  "source_metric",
  "target_template",
  "target_live_file",
  "aggregate_count",
  "quality_score",
  "evidence_ref",
  "reviewer",
  "pii_checked",
  "notes",
];

async function main() {
  const generatedAt = new Date();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "3q-growth-loop-source-compile-fixtures-"));
  const scenarios = [];

  for (const scenario of buildScenarios()) {
    scenarios.push(await runScenario(scenario, tempDir));
  }

  const status = {
    ok: scenarios.every((scenario) => scenario.ok),
    generated_at: generatedAt.toISOString(),
    mode: "source_capture_compile_fixture_dry_run",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    temp_dir: tempDir,
    scenario_count: scenarios.length,
    scenarios,
    local_fixture_commands_executed: true,
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
    note: "Fixture-only source capture compile guard. It uses temporary ledgers and never writes live CSVs or data/lp_events.jsonl.",
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
      id: "valid_filled_compile_preview",
      expectedExit: 0,
      expectedStatus: "owner_preview_ready",
      rows: [
        row({ stage: "link_click", aggregate_count: "3", target_live_file: "data/funnel_aggregates.csv" }),
        row({ stage: "line_add", aggregate_count: "2", target_live_file: "data/manual_conversions.csv" }),
        row({ stage: "quality_flag", aggregate_count: "1", quality_score: "0", target_live_file: "data/manual_conversions.csv" }),
      ],
      assert(status, outputs) {
        return status.ok === true
          && status.status === "owner_preview_ready"
          && status.filled_rows === 3
          && status.funnel_rows === 1
          && status.manual_rows === 2
          && status.counts_by_event_type?.link_click === 3
          && status.counts_by_event_type?.line_add === 2
          && status.counts_by_event_type?.quality_flag === 1
          && outputs.funnelRows === 1
          && outputs.manualRows === 2
          && outputs.manualQualityScoreZero === true
          && noWrites(status);
      },
    },
    {
      id: "empty_template_waits_for_counts",
      expectedExit: 0,
      expectedStatus: "waiting_for_filled_counts",
      rows: [row({ capture_date: "", aggregate_count: "", evidence_ref: "", reviewer: "", pii_checked: "" })],
      assert(status, outputs) {
        return status.ok === true
          && status.status === "waiting_for_filled_counts"
          && status.filled_rows === 0
          && status.warning_count === 0
          && status.funnel_rows === 0
          && status.manual_rows === 0
          && outputs.funnelRows === 0
          && outputs.manualRows === 0
          && noWrites(status);
      },
    },
    {
      id: "partial_blank_count_warns_not_blocks",
      expectedExit: 0,
      expectedStatus: "waiting_for_filled_counts",
      rows: [row({ aggregate_count: "", evidence_ref: "screenshots/link-click-summary.png", reviewer: "owner", pii_checked: "yes" })],
      assert(status) {
        return status.ok === true
          && status.status === "waiting_for_filled_counts"
          && status.warning_count === 1
          && status.filled_rows === 0
          && noWrites(status);
      },
    },
    {
      id: "blocked_missing_pii_checked",
      expectedExit: 1,
      expectedStatus: "blocked_invalid_filled_ledger",
      rows: [row({ pii_checked: "" })],
      assert(status) {
        return blockedWith(status, "pii_checked");
      },
    },
    {
      id: "blocked_sensitive_evidence",
      expectedExit: 1,
      expectedStatus: "blocked_invalid_filled_ledger",
      rows: [row({ evidence_ref: "owner@example.com" })],
      assert(status) {
        return blockedWith(status, "evidence_ref");
      },
    },
    {
      id: "blocked_invalid_date",
      expectedExit: 1,
      expectedStatus: "blocked_invalid_filled_ledger",
      rows: [row({ capture_date: "2026/07/08" })],
      assert(status) {
        return blockedWith(status, "capture_date");
      },
    },
    {
      id: "blocked_invalid_target_file",
      expectedExit: 1,
      expectedStatus: "blocked_invalid_filled_ledger",
      rows: [row({ target_live_file: "data/lp_events.jsonl" })],
      assert(status) {
        return blockedWith(status, "target_live_file");
      },
    },
  ];
}

async function runScenario(scenario, tempDir) {
  const scenarioDir = path.join(tempDir, scenario.id);
  const inputPath = path.join(scenarioDir, "source_capture_ledger.csv");
  const outputDir = path.join(scenarioDir, "compiled");
  const statusPath = path.join(scenarioDir, "status.json");
  const reportPath = path.join(scenarioDir, "report.md");
  const realEventsPath = path.join(scenarioDir, "lp_events.jsonl");
  await mkdir(scenarioDir, { recursive: true });
  await writeFile(inputPath, renderCsv(scenario.rows));

  const args = [
    "scripts/source-capture-compile.mjs",
    `--input=${inputPath}`,
    "--input-kind=fixture",
    `--output-dir=${outputDir}`,
    `--status=${statusPath}`,
    `--report=${reportPath}`,
    `--real-events=${realEventsPath}`,
  ];
  const result = await runNode(args);
  const status = await readOptionalJson(statusPath);
  const outputs = await outputStats(outputDir);
  const ok = result.exitCode === scenario.expectedExit
    && status?.status === scenario.expectedStatus
    && scenario.assert(status ?? {}, outputs);

  return {
    id: scenario.id,
    ok,
    command: `node ${args.join(" ")}`,
    exit_code: result.exitCode,
    expected_exit_code: scenario.expectedExit,
    status_ok: Boolean(status?.ok),
    status_status: status?.status ?? "missing",
    expected_status: scenario.expectedStatus,
    issue_count: status?.issue_count ?? null,
    warning_count: status?.warning_count ?? null,
    filled_rows: status?.filled_rows ?? null,
    funnel_rows: status?.funnel_rows ?? null,
    manual_rows: status?.manual_rows ?? null,
    manual_quality_score_zero: Boolean(outputs.manualQualityScoreZero),
    data_lp_events_write_performed: Boolean(status?.data_lp_events_write_performed),
    external_effect: Boolean(status?.external_effect),
    real_events_unchanged: Boolean(status?.real_events_unchanged),
    output_dir: outputDir,
    status_path: statusPath,
    stdout_bytes: result.stdout.length,
    stderr_bytes: result.stderr.length,
    error: ok ? null : result.stderr || result.stdout || "scenario assertion failed",
  };
}

function row(overrides = {}) {
  return {
    week_start: "2026-07-06",
    week_end: "2026-07-12",
    capture_date: "2026-07-08",
    stage: "link_click",
    stage_label: "fixture",
    asset_id: "challenger-week0-cta-text-v1",
    content_id: "week0-post-001",
    variant_id: "cta-v1-diagnostic",
    tracking_link_id: "fixture-link",
    tracking_url: "http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v1-diagnostic&content_id=week0-post-001",
    source_surface: "fixture aggregate report",
    source_metric: "fixture aggregate count",
    target_template: "fixture",
    target_live_file: "data/funnel_aggregates.csv",
    aggregate_count: "1",
    quality_score: "",
    evidence_ref: "screenshots/fixture-aggregate-summary.png",
    reviewer: "owner",
    pii_checked: "yes",
    notes: "fixture aggregate only",
    ...overrides,
  };
}

function blockedWith(status, field) {
  return status.ok === false
    && status.status === "blocked_invalid_filled_ledger"
    && status.issue_count > 0
    && status.issues?.some((issue) => issue.field === field)
    && noWrites(status);
}

function noWrites(status) {
  return status.live_input_files_created === false
    && status.apply_performed === false
    && status.append_performed === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.public_link_change_performed === false
    && status.production_deploy_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

async function outputStats(outputDir) {
  const funnelPath = path.join(outputDir, "funnel_aggregates.owner-preview.csv");
  const manualPath = path.join(outputDir, "manual_conversions.owner-preview.csv");
  const [funnel, manual] = await Promise.all([readOptionalText(funnelPath), readOptionalText(manualPath)]);
  return {
    funnelRows: csvDataRowCount(funnel),
    manualRows: csvDataRowCount(manual),
    manualQualityScoreZero: csvHasValue(manual, "quality_score", "0"),
  };
}

function csvDataRowCount(raw) {
  if (!raw) return 0;
  return raw.split(/\r?\n/).filter((line) => line.trim()).length - 1;
}

function csvHasValue(raw, header, expectedValue) {
  if (!raw) return false;
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return false;
  const headers = parseCsvLine(lines[0]);
  const index = headers.indexOf(header);
  if (index === -1) return false;
  return lines.slice(1).some((line) => parseCsvLine(line)[index] === expectedValue);
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

function renderCsv(rows) {
  return `${HEADERS.join(",")}\n${rows.map((item) => HEADERS.map((header) => csvEscape(item[header] ?? "")).join(",")).join("\n")}\n`;
}

function renderReport(status) {
  const rows = status.scenarios
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "pass" : "fail"} | ${scenario.exit_code} | ${scenario.status_status} | ${scenario.issue_count ?? "n/a"} | ${scenario.data_lp_events_write_performed ? "yes" : "no"} |`)
    .join("\n");

  return `# 3Q Growth Loop Source Capture Compile Fixture Report

BLUF: Source capture compile fixtures verify valid filled ledgers, empty templates, partial blank-count warnings, PII rejection, bad date rejection, and invalid target-file rejection. They use temporary files only and never write live CSVs or data/lp_events.jsonl.

Generated: ${status.generated_at}
Mode: ${status.mode}
Status: ${status.ok ? "pass" : "fail"}
Scenarios: ${status.scenario_count}
Temp dir: ${status.temp_dir}
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

| scenario | result | exit | compiler status | issues | data write |
|---|---|---:|---|---:|---|
${rows}
`;
}

function runNode(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function readOptionalText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function csvEscape(value) {
  const stringValue = String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

main();
