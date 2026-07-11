import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "real_data_apply_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "real_data_apply_fixture_report.md");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const FUNNEL_EXAMPLE_PATH = path.join(ROOT, "data", "funnel_aggregates.example.csv");
const MANUAL_EXAMPLE_PATH = path.join(ROOT, "data", "manual_conversions.example.csv");

const FUNNEL_HEADER = "date,asset_id,event_type,count,source,medium,campaign,content_id,variant_id,quality_score";
const MANUAL_HEADER = "date,asset_id,event_type,count,source,medium,campaign,content_id,variant_id,quality_score";

async function main() {
  const generatedAt = new Date();
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "3q-growth-loop-apply-fixtures-"));
  const funnelExampleRaw = await readFile(FUNNEL_EXAMPLE_PATH, "utf8");
  const manualExampleRaw = await readFile(MANUAL_EXAMPLE_PATH, "utf8");
  const scenarios = [
    {
      id: "funnel_apply_requires_confirm_real_data",
      importer: "funnel",
      inputRaw: `${FUNNEL_HEADER}\n2026-07-09,challenger-week0-cta-text-v1,link_click,1,reviewed_real_export,growth_loop,week0-cta-text,week0-post-apply,cta-v1-diagnostic,\n`,
      flags: ["--append", "--apply"],
      expect: ({ status, exitCode, realEventsUnchanged }) =>
        exitCode === 2 &&
        status?.mode === "blocked" &&
        status?.data_lp_events_write_performed === false &&
        statusText(status).includes("--confirm-real-data") &&
        realEventsUnchanged,
    },
    {
      id: "funnel_copied_example_never_applies",
      importer: "funnel",
      inputRaw: funnelExampleRaw,
      flags: ["--append", "--apply", "--confirm-real-data"],
      expect: ({ status, exitCode, realEventsUnchanged }) =>
        exitCode === 2 &&
        status?.mode === "blocked" &&
        status?.example_input_detected === true &&
        status?.data_lp_events_write_performed === false &&
        realEventsUnchanged,
    },
    {
      id: "manual_apply_requires_confirm_real_data",
      importer: "manual",
      inputRaw: `${MANUAL_HEADER}\n2026-07-09,challenger-week0-cta-text-v1,line_add,1,reviewed_real_export,line_oa,week0,week0-post-apply,cta-v1-diagnostic,\n`,
      flags: ["--append", "--apply"],
      expect: ({ status, exitCode, realEventsUnchanged }) =>
        exitCode === 2 &&
        status?.mode === "blocked" &&
        status?.data_lp_events_write_performed === false &&
        statusText(status).includes("--confirm-real-data") &&
        realEventsUnchanged,
    },
    {
      id: "manual_copied_example_never_applies",
      importer: "manual",
      inputRaw: manualExampleRaw,
      flags: ["--append", "--apply", "--confirm-real-data"],
      expect: ({ status, exitCode, realEventsUnchanged }) =>
        exitCode === 2 &&
        status?.mode === "blocked" &&
        status?.example_input_detected === true &&
        status?.data_lp_events_write_performed === false &&
        realEventsUnchanged,
    },
  ];

  const results = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(tmpDir, scenario));
  }

  const status = {
    ok: results.every((result) => result.ok),
    generated_at: generatedAt.toISOString(),
    mode: "real_data_apply_fixture_dry_run",
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
    note: "Fixture-only real-data apply guard. It verifies that example or unconfirmed aggregate rows cannot be appended to data/lp_events.jsonl.",
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
  const inputFile = scenario.importer === "manual" ? "manual_conversions.csv" : "funnel_aggregates.csv";
  const inputPath = path.join(scenarioDir, inputFile);
  const statusPath = path.join(scenarioDir, `${scenario.importer}_status.json`);
  await writeFile(inputPath, scenario.inputRaw);

  const beforeRealEvents = await readOptional(REAL_EVENTS_PATH);
  const importerScript = scenario.importer === "manual"
    ? "scripts/import-manual-conversions.mjs"
    : "scripts/import-funnel-aggregates.mjs";
  const args = [
    importerScript,
    `--input=${inputPath}`,
    `--output=${REAL_EVENTS_PATH}`,
    ...scenario.flags,
  ];
  const env = {
    ...process.env,
    FUNNEL_AGGREGATE_STATUS_PATH: statusPath,
    MANUAL_CONVERSION_STATUS_PATH: statusPath,
  };
  const execution = await runImporter(args, env);
  const status = await readOptionalJson(statusPath);
  const afterRealEvents = await readOptional(REAL_EVENTS_PATH);
  const realEventsUnchanged = beforeRealEvents === afterRealEvents;
  const ok = scenario.expect({ status, exitCode: execution.exitCode, realEventsUnchanged });

  return {
    id: scenario.id,
    importer: scenario.importer,
    ok,
    command: ["node", ...args].join(" "),
    exit_code: execution.exitCode,
    status_mode: status?.mode ?? "missing",
    status_ok: status?.ok ?? false,
    blocked_by: status?.blocked_by ?? status?.error ?? null,
    confirm_real_data: Boolean(status?.confirm_real_data),
    example_input_detected: Boolean(status?.example_input_detected),
    apply_performed: Boolean(status?.apply_performed),
    append_performed: Boolean(status?.append_performed),
    data_lp_events_write_performed: Boolean(status?.data_lp_events_write_performed),
    external_effect: Boolean(status?.external_effect),
    real_events_unchanged: realEventsUnchanged,
    status_path: statusPath,
    stdout_bytes: execution.stdout.length,
    stderr_bytes: execution.stderr.length,
  };
}

async function runImporter(args, env) {
  try {
    const { stdout, stderr } = await execFileAsync("node", args, {
      cwd: ROOT,
      env,
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

function statusText(status) {
  return String(status?.blocked_by ?? status?.error ?? "");
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
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "fail"} | ${scenario.importer} | ${scenario.exit_code} | ${scenario.status_mode} | ${scenario.example_input_detected ? "yes" : "no"} | ${scenario.confirm_real_data ? "yes" : "no"} | ${scenario.data_lp_events_write_performed ? "yes" : "no"} |`)
    .join("\n");

  return `# Real Data Apply Fixture Report

BLUF: ${status.ok ? "real_data_apply_fixtures_ok" : "real_data_apply_fixtures_failed"}. Fixture-only guard against accidentally scoring example or unconfirmed aggregate rows.

Generated: ${status.generated_at}
Mode: ${status.mode}
Scenarios: ${status.scenario_count}
Execution performed: no
Real event write performed: no
data/lp_events.jsonl write performed: no
External effect: no

| scenario | status | importer | exit | importer_mode | example_detected | confirm_real_data | data_write |
|---|---|---|---:|---|---|---|---|
${rows}

## Covered Gates

- funnel_apply_requires_confirm_real_data
- funnel_copied_example_never_applies
- manual_apply_requires_confirm_real_data
- manual_copied_example_never_applies

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
