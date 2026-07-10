import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const NEXT_P0_INPUTS_PATH = path.join(ROOT, "next_p0_owner_inputs.json");
const STATUS_PATH = path.join(ROOT, "data", "next_p0_quick_capture_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "next_p0_quick_capture_fixture_report.md");

async function main() {
  const generatedAt = new Date();
  const nextP0 = JSON.parse(await readFile(NEXT_P0_INPUTS_PATH, "utf8"));
  const validCounts = buildCounts(nextP0.inputs ?? []);
  const labelledCounts = buildLabelledCounts(nextP0.inputs ?? []);
  const scenarios = [
    await runScenario("waiting_without_counts", []),
    await runScenario("valid_quick_counts_preview_ready", [
      `--counts=${validCounts}`,
      "--capture-date=2026-07-08",
      "--evidence-ref=fixture_aggregate_review",
      "--reviewer=fixture-owner",
      "--pii-checked=yes",
    ]),
    await runScenario("labelled_quick_counts_preview_ready", [
      `--counts=${labelledCounts}`,
      "--capture-date=2026-07-08",
      "--evidence-ref=fixture_aggregate_review",
      "--reviewer=fixture-owner",
      "--pii-checked=yes",
    ]),
    await runScenario("labelled_counts_file_preview_ready", [
      "--capture-date=2026-07-08",
      "--evidence-ref=fixture_aggregate_review",
      "--reviewer=fixture-owner",
      "--pii-checked=yes",
    ], labelledCounts),
    await runScenario("auto_paste_template_preview_ready", [], null, buildAutoPasteTemplate(labelledCounts)),
    await runScenario("partial_auto_paste_template_waiting", [], null, buildPartialAutoPasteTemplate(labelledCounts)),
    await runScenario("incomplete_quick_counts_blocked", [
      "--counts=1=100,2=20",
      "--capture-date=2026-07-08",
      "--evidence-ref=fixture_aggregate_review",
      "--reviewer=fixture-owner",
      "--pii-checked=yes",
    ]),
    await runScenario("sensitive_evidence_blocked", [
      `--counts=${validCounts}`,
      "--capture-date=2026-07-08",
      "--evidence-ref=owner@example.com",
      "--reviewer=fixture-owner",
      "--pii-checked=yes",
    ]),
    await runScenario("strict_sensitive_evidence_fails", [
      `--counts=${validCounts}`,
      "--capture-date=2026-07-08",
      "--evidence-ref=owner@example.com",
      "--reviewer=fixture-owner",
      "--pii-checked=yes",
      "--strict",
    ]),
  ];

  const status = {
    ok: scenarios.every((scenario) => scenario.ok),
    generated_at: generatedAt.toISOString(),
    mode: "next_p0_quick_capture_fixture_dry_run",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    scenario_count: scenarios.length,
    scenario_ids: scenarios.map((scenario) => scenario.id),
    row_count: nextP0.current_input_count ?? 0,
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
    note: "Fixture-only quick capture guard. It uses temporary paths and never writes project live inputs, inbox files, data/lp_events.jsonl, or external systems.",
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) process.exitCode = 1;
}

async function runScenario(id, flags, countsFileContent = null, preExistingPasteTemplateContent = null) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), `3q-next-p0-quick-${id}-`));
  const outputDir = path.join(tempDir, "quick");
  const statusPath = path.join(tempDir, "status.json");
  const reportPath = path.join(tempDir, "report.md");
  const realEventsPath = path.join(tempDir, "lp_events.jsonl");
  await mkdir(outputDir, { recursive: true });
  await writeFile(realEventsPath, "");
  if (preExistingPasteTemplateContent) {
    await writeFile(path.join(outputDir, "next_p0_owner_inputs.counts-paste-template.txt"), preExistingPasteTemplateContent);
  }
  const finalFlags = [...flags];
  if (countsFileContent) {
    const countsFilePath = path.join(tempDir, "counts.txt");
    await writeFile(countsFilePath, countsFileContent.replaceAll(";", "\n"));
    finalFlags.unshift(`--counts-file=${countsFilePath}`);
  }

  const args = [
    "scripts/next-p0-quick-capture.mjs",
    `--output-dir=${outputDir}`,
    `--status=${statusPath}`,
    `--report=${reportPath}`,
    `--real-events=${realEventsPath}`,
    ...finalFlags,
  ];
  const execution = await runNode(args);
  const status = await readOptionalJson(statusPath);
  const checks = checksForScenario(id, { status, execution });
  return {
    id,
    ok: checks.every((check) => check.ok),
    temp_dir: tempDir,
    command: `node ${args.join(" ")}`,
    exit_code: execution.exitCode,
    status: status?.status ?? "missing",
    checks,
    live_project_inputs_created: false,
    owner_inbox_write_performed: false,
    stage_performed: false,
    data_lp_events_write_performed: false,
    external_effect: false,
  };
}

function checksForScenario(id, { status, execution }) {
  const base = [
    check("status_json_written", Boolean(status), true, Boolean(status)),
    check("template_created", status?.template_created === true, true, status?.template_created),
    check("paste_template_created", status?.paste_template_created === true, true, status?.paste_template_created),
    check("paste_template_path", /counts-paste-template\.txt$/.test(status?.paste_template_path ?? ""), "counts-paste-template.txt", status?.paste_template_path ?? null),
    check("no_live_input", status?.live_input_files_created === false, false, status?.live_input_files_created),
    check("no_inbox_write", status?.owner_inbox_write_performed === false, false, status?.owner_inbox_write_performed),
    check("no_real_event_write", status?.data_lp_events_write_performed === false, false, status?.data_lp_events_write_performed),
    check("no_external_effect", status?.external_effect === false, false, status?.external_effect),
  ];

  if (id === "waiting_without_counts") {
    return [
      ...base,
      check("exit_success", execution.exitCode === 0, 0, execution.exitCode),
      check("waiting_status", status?.status === "waiting_for_quick_counts", "waiting_for_quick_counts", status?.status),
      check("filled_preview_not_created", status?.filled_preview_created === false, false, status?.filled_preview_created),
    ];
  }

  if (id === "valid_quick_counts_preview_ready" || id === "labelled_quick_counts_preview_ready" || id === "labelled_counts_file_preview_ready" || id === "auto_paste_template_preview_ready") {
    const previewChecks = [
      ...base,
      check("exit_success", execution.exitCode === 0, 0, execution.exitCode),
      check("preview_status", status?.status === "quick_counts_preview_ready", "quick_counts_preview_ready", status?.status),
      check("filled_preview_created", status?.filled_preview_created === true, true, status?.filled_preview_created),
      check("rows_created", status?.filled_preview_rows === status?.expected_row_count, status?.expected_row_count, status?.filled_preview_rows),
    ];
    if (id === "auto_paste_template_preview_ready") {
      previewChecks.push(
        check("auto_counts_file_used", status?.auto_counts_file_used === true, true, status?.auto_counts_file_used),
        check("counts_source", status?.counts_source === "auto_paste_template", "auto_paste_template", status?.counts_source),
        check("paste_template_preserved", status?.paste_template_preserved === true, true, status?.paste_template_preserved),
        check("metadata_from_counts_file", status?.metadata_from_counts_file === true, true, status?.metadata_from_counts_file),
      );
    }
    return previewChecks;
  }

  if (id === "partial_auto_paste_template_waiting") {
    return [
      ...base,
      check("exit_success", execution.exitCode === 0, 0, execution.exitCode),
      check("partial_status", status?.status === "partial_quick_counts_waiting", "partial_quick_counts_waiting", status?.status),
      check("partial_auto_counts", status?.partial_auto_counts === true, true, status?.partial_auto_counts),
      check("partial_waiting", status?.partial_waiting === true, true, status?.partial_waiting),
      check("auto_counts_file_used", status?.auto_counts_file_used === true, true, status?.auto_counts_file_used),
      check("counts_source", status?.counts_source === "auto_paste_template", "auto_paste_template", status?.counts_source),
      check("filled_rank_progress", (status?.filled_rank_count ?? 0) > 0 && (status?.missing_rank_count ?? 0) > 0, "partial progress", {
        filled: status?.filled_rank_count,
        missing: status?.missing_rank_count,
      }),
      check("filled_preview_not_created", status?.filled_preview_created === false, false, status?.filled_preview_created),
      check("paste_template_preserved", status?.paste_template_preserved === true, true, status?.paste_template_preserved),
    ];
  }

  if (id === "incomplete_quick_counts_blocked") {
    return [
      ...base,
      check("exit_success_soft_block", execution.exitCode === 0, 0, execution.exitCode),
      check("blocked_status", status?.status === "blocked_invalid_quick_counts", "blocked_invalid_quick_counts", status?.status),
      check("missing_ranks", (status?.missing_rank_count ?? 0) > 0, "missing ranks", status?.missing_ranks ?? []),
    ];
  }

  if (id === "strict_sensitive_evidence_fails") {
    return [
      ...base,
      check("exit_failed_strict", execution.exitCode !== 0, "nonzero", execution.exitCode),
      check("blocked_status", status?.status === "blocked_invalid_quick_counts", "blocked_invalid_quick_counts", status?.status),
      check("sensitive_issue", (status?.issues ?? []).some((item) => /Sensitive-looking/.test(item.message)), "sensitive issue", status?.issues ?? []),
    ];
  }

  return [
    ...base,
    check("exit_success_soft_block", execution.exitCode === 0, 0, execution.exitCode),
    check("blocked_status", status?.status === "blocked_invalid_quick_counts", "blocked_invalid_quick_counts", status?.status),
    check("sensitive_issue", (status?.issues ?? []).some((item) => /Sensitive-looking/.test(item.message)), "sensitive issue", status?.issues ?? []),
  ];
}

function buildCounts(inputs) {
  return inputs.map((row, index) => `${row.rank}=${sampleCount(row.event_type, index)}`).join(",");
}

function buildLabelledCounts(inputs) {
  return inputs
    .map((row, index) => `${row.role}.${shortEventLabel(row.event_type)}=${sampleCount(row.event_type, index)}`)
    .join(";");
}

function buildAutoPasteTemplate(labelledCounts) {
  return [
    "# 3Q Growth Loop Next P0 Paste Counts Template",
    "capture_date=2026-07-08",
    "evidence_ref=fixture_aggregate_review",
    "reviewer=fixture-owner",
    "pii_checked=yes",
    labelledCounts.replaceAll(";", "\n"),
    "",
  ].join("\n");
}

function buildPartialAutoPasteTemplate(labelledCounts) {
  return [
    "# 3Q Growth Loop Next P0 Paste Counts Template",
    "capture_date=2026-07-08",
    "evidence_ref=fixture_aggregate_review",
    "reviewer=fixture-owner",
    "pii_checked=yes",
    labelledCounts.split(";").slice(0, 3).join("\n"),
    "",
  ].join("\n");
}

function shortEventLabel(eventType) {
  if (eventType === "page_view") return "visits";
  if (eventType === "cta_click") return "cta";
  if (eventType === "line_add") return "line";
  return eventType;
}

function sampleCount(eventType, index) {
  if (eventType === "page_view") return 100 + index;
  if (eventType === "cta_click") return 20 + index;
  if (eventType === "line_add") return 5 + index;
  return 1 + index;
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
  return `# 3Q Growth Loop Next P0 Quick Capture Fixture Report

BLUF: ${status.ok ? "next_p0_quick_capture_fixture_ok" : "next_p0_quick_capture_fixture_failed"}. This fixture verifies the quick rank-count adapter using temporary paths only.

Generated: ${status.generated_at}
Mode: ${status.mode}
Rows: ${status.row_count}
Scenarios: ${status.scenario_count}
Live project inputs created: no
Owner inbox write performed: no
data/lp_events.jsonl write performed: no
External effect: no

| scenario | result | exit | status | checks |
|---|---|---:|---|---:|
${rows}

## Safety Contract

- Temporary fixture paths only.
- No project inbox, live CSV, or real event writes.
- Labelled pasted counts such as champion.visits, champion.cta, and champion.line resolve to the correct focused rows.
- The paste-template output is generated for owner editing but does not create live inputs.
- A fully filled paste template can be auto-read into a preview CSV while preserving the owner-filled file.
- A partially filled paste template reports filled and missing ranks while preserving the owner-filled file and creating no preview.
- The labelled counts-file path resolves through the same aggregate-only preview contract.
- Sensitive-looking quick evidence is soft-blocked by default so weekly artifacts can continue, and \`--strict\` still fails fast for CI-style checks.
- The quick adapter only creates a preview CSV that must still pass next-p0:intake before any owner-confirmed staging.
`;
}

await main();
