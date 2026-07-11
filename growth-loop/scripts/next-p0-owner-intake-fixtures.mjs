import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const NEXT_P0_INPUTS_PATH = path.join(ROOT, "next_p0_owner_inputs.json");
const STATUS_PATH = path.join(ROOT, "data", "next_p0_owner_intake_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "next_p0_owner_intake_fixture_report.md");

const EXPORT_HEADERS = [
  "rank",
  "capture_date",
  "role",
  "tracking_link_id",
  "event_type",
  "stage_label",
  "source_surface",
  "target_live_file",
  "aggregate_count",
  "evidence_ref",
  "reviewer",
  "pii_checked",
];

async function main() {
  const generatedAt = new Date();
  const nextP0 = JSON.parse(await readFile(NEXT_P0_INPUTS_PATH, "utf8"));
  const scenarios = [
    await runScenario("valid_download_preview_ready", nextP0, buildCsv(nextP0, {}), []),
    await runScenario("quick_preview_auto_intake_ready", nextP0, buildCsv(nextP0, {}), [], { useQuickPreview: true }),
    await runScenario("sensitive_evidence_blocked", nextP0, buildCsv(nextP0, { evidenceRef: "owner@example.com" }), []),
    await runScenario("stage_without_confirmation_blocked", nextP0, buildCsv(nextP0, {}), ["--stage"]),
    await runScenario("confirmed_stage_writes_temp_live_inputs_only", nextP0, buildCsv(nextP0, {}), ["--stage", "--confirm-owner-reviewed"]),
  ];

  const status = {
    ok: scenarios.every((scenario) => scenario.ok),
    generated_at: generatedAt.toISOString(),
    mode: "next_p0_owner_intake_fixture_dry_run",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    scenario_count: scenarios.length,
    scenario_ids: scenarios.map((scenario) => scenario.id),
    row_count: nextP0.current_input_count ?? 0,
    scenarios,
    local_fixture_commands_executed: true,
    live_project_inputs_created: false,
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
    note: "Fixture-only focused Next P0 intake guard. It uses temporary owner downloads and temporary live paths; it never writes project live CSVs or data/lp_events.jsonl.",
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

async function runScenario(id, nextP0, csv, flags, scenarioOptions = {}) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), `3q-next-p0-intake-${id}-`));
  const inputPath = path.join(tempDir, "next_p0_owner_inputs.filled.csv");
  const quickPreviewPath = path.join(tempDir, "next_p0_owner_inputs.quick-filled.preview.csv");
  const projectInboxPath = path.join(tempDir, "missing-project-inbox.csv");
  const outputDir = path.join(tempDir, "preview");
  const statusPath = path.join(tempDir, "status.json");
  const reportPath = path.join(tempDir, "report.md");
  const funnelLivePath = path.join(tempDir, "live", "funnel_aggregates.csv");
  const manualLivePath = path.join(tempDir, "live", "manual_conversions.csv");
  const realEventsPath = path.join(tempDir, "lp_events.jsonl");
  await mkdir(path.dirname(inputPath), { recursive: true });
  await writeFile(scenarioOptions.useQuickPreview ? quickPreviewPath : inputPath, csv);
  await writeFile(realEventsPath, "");

  const args = [
    "scripts/next-p0-owner-intake.mjs",
    `--output-dir=${outputDir}`,
    `--status=${statusPath}`,
    `--report=${reportPath}`,
    `--funnel-live=${funnelLivePath}`,
    `--manual-live=${manualLivePath}`,
    `--real-events=${realEventsPath}`,
    ...flags,
  ];
  if (scenarioOptions.useQuickPreview) {
    args.push(
      `--project-inbox=${projectInboxPath}`,
      `--quick-preview=${quickPreviewPath}`,
      "--no-downloads",
    );
  } else {
    args.splice(1, 0, `--input=${inputPath}`);
  }
  const execution = await runNode(args);
  const status = await readOptionalJson(statusPath);
  const checks = checksForScenario(id, {
    status,
    execution,
    nextP0,
    funnelLivePath,
    manualLivePath,
  });
  return {
    id,
    ok: checks.every((check) => check.ok),
    temp_dir: tempDir,
    command: `node ${args.join(" ")}`,
    exit_code: execution.exitCode,
    status: status?.status ?? "missing",
    checks,
    external_effect: false,
    live_project_inputs_created: false,
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
}

function checksForScenario(id, { status, execution, nextP0, funnelLivePath, manualLivePath }) {
  const base = [
    check("status_json_written", Boolean(status), true, Boolean(status)),
    check("no_real_event_write", status?.data_lp_events_write_performed === false, false, status?.data_lp_events_write_performed),
    check("no_external_effect", status?.external_effect === false, false, status?.external_effect),
    check("expected_rows", status?.expected_row_count === nextP0.current_input_count, nextP0.current_input_count, status?.expected_row_count),
  ];
  if (id === "valid_download_preview_ready" || id === "quick_preview_auto_intake_ready") {
    const previewChecks = [
      ...base,
      check("exit_success", execution.exitCode === 0, 0, execution.exitCode),
      check("preview_status", status?.status === "next_p0_owner_download_preview_ready", "next_p0_owner_download_preview_ready", status?.status),
      check("candidate_valid", status?.candidate_valid === true, true, status?.candidate_valid),
      check("stage_not_performed", status?.stage_performed === false, false, status?.stage_performed),
      check("preview_rows", (status?.funnel_preview_rows ?? 0) + (status?.manual_preview_rows ?? 0) === nextP0.current_input_count, nextP0.current_input_count, (status?.funnel_preview_rows ?? 0) + (status?.manual_preview_rows ?? 0)),
    ];
    if (id === "quick_preview_auto_intake_ready") {
      previewChecks.push(
        check("candidate_source", status?.candidate_source === "quick_preview", "quick_preview", status?.candidate_source),
        check("candidate_path", /quick-filled\.preview\.csv$/.test(status?.candidate_path ?? ""), "quick-filled.preview.csv", status?.candidate_path),
      );
    }
    return [
      ...previewChecks,
    ];
  }
  if (id === "sensitive_evidence_blocked") {
    return [
      ...base,
      check("exit_failed", execution.exitCode !== 0, "nonzero", execution.exitCode),
      check("blocked_status", status?.status === "blocked_invalid_next_p0_owner_download", "blocked_invalid_next_p0_owner_download", status?.status),
      check("sensitive_issue", (status?.issues ?? []).some((item) => /Sensitive-looking/.test(item.message)), "sensitive issue", status?.issues ?? []),
    ];
  }
  if (id === "stage_without_confirmation_blocked") {
    return [
      ...base,
      check("exit_failed", execution.exitCode !== 0, "nonzero", execution.exitCode),
      check("needs_confirm_status", status?.status === "next_p0_owner_download_ready_needs_confirmed_stage", "next_p0_owner_download_ready_needs_confirmed_stage", status?.status),
      check("stage_not_performed", status?.stage_performed === false, false, status?.stage_performed),
      check("blocked_reason", status?.stage_blocked_reason === "stage_requires_confirm_owner_reviewed", "stage_requires_confirm_owner_reviewed", status?.stage_blocked_reason),
    ];
  }
  return [
    ...base,
    check("exit_success", execution.exitCode === 0, 0, execution.exitCode),
    check("stage_status", status?.status === "next_p0_owner_download_staged_local_inputs", "next_p0_owner_download_staged_local_inputs", status?.status),
    check("stage_performed", status?.stage_performed === true, true, status?.stage_performed),
    check("temp_funnel_live", status?.stage_outputs?.some((item) => item.endsWith(path.relative(ROOT, funnelLivePath))) === true || status?.stage_outputs?.some((item) => item.includes("funnel_aggregates.csv")) === true, "funnel live output", status?.stage_outputs ?? []),
    check("temp_manual_live", status?.stage_outputs?.some((item) => item.endsWith(path.relative(ROOT, manualLivePath))) === true || status?.stage_outputs?.some((item) => item.includes("manual_conversions.csv")) === true, "manual live output", status?.stage_outputs ?? []),
  ];
}

function buildCsv(nextP0, overrides) {
  const rows = (nextP0.inputs ?? []).map((row, index) => ({
    rank: row.rank,
    capture_date: nextP0.week?.start ?? "2026-07-06",
    role: row.role,
    tracking_link_id: row.tracking_link_id,
    event_type: row.event_type,
    stage_label: row.stage_label,
    source_surface: row.source_surface,
    target_live_file: row.target_live_file,
    aggregate_count: String(sampleCount(row.event_type, index)),
    evidence_ref: overrides.evidenceRef ?? `fixture:${row.tracking_link_id}:${row.event_type}`,
    reviewer: overrides.reviewer ?? "fixture-owner",
    pii_checked: overrides.piiChecked ?? "yes",
  }));
  return `${EXPORT_HEADERS.join(",")}\n${rows.map((row) => EXPORT_HEADERS.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function sampleCount(eventType, index) {
  if (eventType === "page_view") return 100 + index;
  if (eventType === "cta_click") return 20 + index;
  if (eventType === "line_add") return 5 + index;
  return 1 + index;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function check(name, ok, expected, actual) {
  return { name, ok, expected, actual, external_effect: false };
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
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "failed"} | ${scenario.exit_code} | ${scenario.status} | ${scenario.checks.filter((item) => item.ok).length}/${scenario.checks.length} |`)
    .join("\n");
  return `# 3Q Growth Loop Next P0 Owner Intake Fixture Report

BLUF: ${status.ok ? "next_p0_owner_intake_fixture_ok" : "next_p0_owner_intake_fixture_failed"}。This fixture verifies the focused Next P0 owner-download intake without touching project live CSVs, scoring events, or external systems.

Generated: ${status.generated_at}
Mode: ${status.mode}
Rows: ${status.row_count}
Scenarios: ${status.scenario_count}
Live project inputs created: no
data/lp_events.jsonl write performed: no
External effect: no

| scenario | result | exit | status | checks |
|---|---|---:|---|---:|
${rows}

## Safety Contract

- Fixture stage writes only to temporary live paths.
- Project \`data/funnel_aggregates.csv\`, \`data/manual_conversions.csv\`, and \`data/lp_events.jsonl\` are not written by this fixture.
- Sensitive-looking owner evidence is blocked.
- Stage requires explicit \`--confirm-owner-reviewed\`.
- A complete quick-filled preview from \`next-p0:quick\` can be auto-intaken into owner-preview CSVs without \`--input\`.
`;
}

main();
