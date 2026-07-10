import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "funnel_aggregate_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "funnel_aggregate_fixture_report.md");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const CHAMPION_ASSET = "champion-3q-line-v0";
const CHALLENGER_ASSET = "challenger-week0-cta-text-v1";
const HEADER = "date,asset_id,event_type,count,source,medium,campaign,content_id,variant_id,quality_score";

async function main() {
  const generatedAt = new Date();
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "3q-growth-loop-funnel-fixtures-"));
  const scenarios = [
    {
      id: "valid_full_funnel_preview",
      rows: [
        row(CHAMPION_ASSET, "link_click", 10, "week0-post-001", "cta-v1-diagnostic"),
        row(CHAMPION_ASSET, "page_view", 9, "week0-post-001", "cta-v1-diagnostic"),
        row(CHAMPION_ASSET, "cta_click", 4, "week0-post-001", "cta-v1-diagnostic"),
        row(CHALLENGER_ASSET, "line_add", 2, "week0-post-002", "cta-v2-audit"),
        row(CHALLENGER_ASSET, "lead_submit", 1, "week0-post-002", "cta-v2-audit"),
        row(CHALLENGER_ASSET, "deal", 1, "week0-post-002", "cta-v2-audit"),
        row(CHALLENGER_ASSET, "quality_flag", 1, "week0-post-002", "cta-v2-audit", "1"),
      ],
      expect: ({ status, outputEvents, exitCode }) =>
        exitCode === 0 &&
        status?.ok === true &&
        status.mode === "full_funnel_preview" &&
        status.apply_performed === false &&
        status.data_lp_events_write_performed === false &&
        status.external_effect === false &&
        status.contains_sensitive_columns === false &&
        status.contains_sensitive_values === false &&
        outputEvents.length === status.events_written &&
        ["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"].every((type) => status.counts_by_event_type?.[type] > 0) &&
        outputEvents.every((event) => event.content_id && event.variant_id && event.metadata_json?.aggregate_only === true),
    },
    {
      id: "blocked_unknown_asset",
      rows: [row("unknown-asset-id", "link_click", 1, "week0-post-001", "cta-v1-diagnostic")],
      expect: ({ status, exitCode }) => exitCode !== 0 && status?.ok === false && statusText(status).includes("unknown asset_id"),
    },
    {
      id: "blocked_missing_content_id",
      rows: [row(CHAMPION_ASSET, "link_click", 1, "", "cta-v1-diagnostic")],
      expect: ({ status, exitCode }) => exitCode !== 0 && status?.ok === false && statusText(status).includes("content_id is required"),
    },
    {
      id: "blocked_sensitive_column",
      header: `${HEADER},phone`,
      rows: [`${row(CHAMPION_ASSET, "link_click", 1, "week0-post-001", "cta-v1-diagnostic")},0900000000`],
      expect: ({ status, exitCode }) =>
        exitCode !== 0 &&
        status?.ok === false &&
        status.contains_sensitive_columns === true &&
        status.data_lp_events_write_performed === false,
    },
    {
      id: "blocked_sensitive_value",
      rows: [`2026-07-06,${CHAMPION_ASSET},link_click,1,ops@example.com,fixture,week0,week0-post-001,cta-v1-diagnostic,`],
      expect: ({ status, exitCode }) =>
        exitCode !== 0 &&
        status?.ok === false &&
        status.contains_sensitive_values === true &&
        status.data_lp_events_write_performed === false,
    },
    {
      id: "blocked_apply_without_append",
      rows: [row(CHAMPION_ASSET, "link_click", 1, "week0-post-001", "cta-v1-diagnostic")],
      outputRealEvents: true,
      flags: ["--apply"],
      expect: ({ status, exitCode, realEventsUnchanged }) =>
        exitCode === 2 &&
        status?.ok === false &&
        status.mode === "blocked" &&
        status.apply_performed === false &&
        status.data_lp_events_write_performed === false &&
        realEventsUnchanged === true &&
        statusText(status).includes("Apply mode must append"),
    },
  ];

  const results = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(tmpDir, scenario));
  }

  const status = {
    ok: results.every((result) => result.ok),
    generated_at: generatedAt.toISOString(),
    mode: "funnel_aggregate_fixture_dry_run",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    temp_dir: tmpDir,
    scenario_count: results.length,
    scenarios: results,
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
    note: "Fixture-only aggregate importer guard. It runs the importer against temporary files and never writes data/lp_events.jsonl.",
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

async function runScenario(tmpDir, scenario) {
  const scenarioDir = path.join(tmpDir, scenario.id);
  await mkdir(scenarioDir, { recursive: true });
  const inputPath = path.join(scenarioDir, "funnel_aggregates.csv");
  const outputPath = scenario.outputRealEvents ? REAL_EVENTS_PATH : path.join(scenarioDir, "funnel_aggregates.preview.jsonl");
  const statusPath = path.join(scenarioDir, "funnel_aggregate_status.json");
  const csv = [scenario.header ?? HEADER, ...scenario.rows].join("\n") + "\n";
  await writeFile(inputPath, csv);

  const beforeRealEvents = scenario.outputRealEvents ? await readOptional(REAL_EVENTS_PATH) : null;
  const args = [
    "scripts/import-funnel-aggregates.mjs",
    `--input=${inputPath}`,
    `--output=${outputPath}`,
    ...(scenario.flags ?? []),
  ];
  const command = ["node", ...args].join(" ");
  const execution = await runImporter(args, statusPath);
  const status = await readOptionalJson(statusPath);
  const outputEvents = scenario.outputRealEvents ? [] : await readJsonl(outputPath);
  const afterRealEvents = scenario.outputRealEvents ? await readOptional(REAL_EVENTS_PATH) : null;
  const realEventsUnchanged = scenario.outputRealEvents ? beforeRealEvents === afterRealEvents : true;
  const ok = scenario.expect({ status, outputEvents, exitCode: execution.exitCode, realEventsUnchanged });

  return {
    id: scenario.id,
    ok,
    command,
    exit_code: execution.exitCode,
    status_mode: status?.mode ?? "missing",
    status_ok: status?.ok ?? false,
    events_written: status?.events_written ?? 0,
    output_event_rows: outputEvents.length,
    contains_sensitive_columns: Boolean(status?.contains_sensitive_columns),
    contains_sensitive_values: Boolean(status?.contains_sensitive_values),
    apply_performed: Boolean(status?.apply_performed),
    append_performed: Boolean(status?.append_performed),
    data_lp_events_write_performed: Boolean(status?.data_lp_events_write_performed),
    external_effect: Boolean(status?.external_effect),
    real_events_unchanged: realEventsUnchanged,
    status_path: statusPath,
    output_path: outputPath,
    stdout_bytes: execution.stdout.length,
    stderr_bytes: execution.stderr.length,
    error: status?.error ?? status?.blocked_by ?? null,
  };
}

async function runImporter(args, statusPath) {
  try {
    const { stdout, stderr } = await execFileAsync("node", args, {
      cwd: ROOT,
      env: {
        ...process.env,
        FUNNEL_AGGREGATE_STATUS_PATH: statusPath,
      },
      maxBuffer: 1024 * 1024 * 4,
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

function row(assetId, eventType, count, contentId, variantId, qualityScore = "") {
  return `2026-07-06,${assetId},${eventType},${count},fixture,full_funnel_aggregate,week0,${contentId},${variantId},${qualityScore}`;
}

function statusText(status) {
  return String(status?.error ?? status?.blocked_by ?? "");
}

async function readJsonl(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
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

function renderReport(status) {
  const rows = status.scenarios
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "fail"} | ${scenario.exit_code} | ${scenario.status_mode} | ${scenario.events_written} | ${scenario.contains_sensitive_columns ? "yes" : "no"} | ${scenario.contains_sensitive_values ? "yes" : "no"} | ${scenario.data_lp_events_write_performed ? "yes" : "no"} |`)
    .join("\n");

  return `# Funnel Aggregate Fixture Report

BLUF: ${status.ok ? "funnel_aggregate_fixtures_ok" : "funnel_aggregate_fixtures_failed"}. Fixture-only regression guard for full-funnel aggregate imports. No real event file is written.

Generated: ${status.generated_at}
Mode: ${status.mode}
Scenarios: ${status.scenario_count}
Execution performed: no
Real event write performed: no
data/lp_events.jsonl write performed: no
External effect: no

| scenario | status | exit | importer_mode | events | sensitive_columns | sensitive_values | data_write |
|---|---|---:|---|---:|---|---|---|
${rows}

## Covered Gates

- valid_full_funnel_preview
- blocked_unknown_asset
- blocked_missing_content_id
- blocked_sensitive_column
- blocked_sensitive_value
- blocked_apply_without_append

## Safety Invariants

- Production deploy performed: no
- Public link change performed: no
- GitHub push or PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
`;
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch(async (error) => {
  const status = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "failed",
    error: error instanceof Error ? error.message : "unknown_error",
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
  };
  await writeJson(STATUS_PATH, status);
  console.error(error);
  process.exitCode = 1;
});
