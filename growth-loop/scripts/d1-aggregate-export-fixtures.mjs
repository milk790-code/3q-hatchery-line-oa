import { execFile } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "d1_aggregate_export_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "d1_aggregate_export_fixture_report.md");
const D1_ID = "deb85e19-95fd-4611-8710-9cb6ea6dc7ff";
const D1_NAME = "3q-growth-loop-candidate";
const FORBIDDEN_RAW_FIELDS = ["session_id", "url", "referrer", "user_agent_hash", "ip_country", "metadata_json"];

async function main() {
  const generatedAt = new Date();
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "3q-d1-aggregate-export-"));
  const paths = await prepareFixture(tmpDir, generatedAt);
  const blocked = await runBlockedScenario(paths);
  const aggregate = await runAggregateScenario(paths);
  const scenarios = [blocked, aggregate];
  const status = {
    ok: scenarios.every((scenario) => scenario.ok),
    generated_at: generatedAt.toISOString(),
    mode: "d1_aggregate_export_fixture_dry_run",
    scenario_count: scenarios.length,
    scenarios,
    fixture_wrangler_used: true,
    real_remote_cli_performed: false,
    remote_read_performed: false,
    raw_event_rows_read_performed: false,
    customer_data_read_performed: false,
    customer_data_mutation_performed: false,
    project_real_events_write_performed: false,
    external_effect: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };
  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) process.exitCode = 1;
}

async function prepareFixture(tmpDir, generatedAt) {
  const ownerStatus = path.join(tmpDir, "owner_status.json");
  const postGate = path.join(tmpDir, "post_gate.json");
  const readiness = path.join(tmpDir, "readiness.json");
  const ownerInput = path.join(tmpDir, "owner_input.json");
  const fakeWrangler = path.join(tmpDir, "fake-wrangler.mjs");
  const argsCapture = path.join(tmpDir, "wrangler-args.json");
  await writeJson(ownerStatus, {
    ok: true,
    input_exists: true,
    gates: [{ gate_id: "remote_d1_create_and_migrate", evidence_valid: true, ready_for_post_gate_verification: true, recurring_aggregate_read_approved: true }],
  });
  await writeJson(postGate, {
    ok: true,
    gates: [{ gate_id: "remote_d1_create_and_migrate", post_gate_verification_ready: true }],
  });
  await writeJson(readiness, {
    ok: true,
    expected: { database_name: D1_NAME, configured_database_id: D1_ID },
    decision: { dedicated_database_present: true, configured_id_matches: true },
  });
  await writeJson(ownerInput, {
    evidence: [{ gate_id: "remote_d1_create_and_migrate", d1_database_name: D1_NAME, d1_database_id: D1_ID, recurring_aggregate_read_approved: true }],
  });
  const fakeSource = `#!/usr/bin/env node\nimport { writeFileSync } from "node:fs";\nwriteFileSync(process.env.D1_AGGREGATE_ARGS_CAPTURE, JSON.stringify(process.argv.slice(2)));\nprocess.stdout.write(JSON.stringify([{success:true,results:[\n{event_date:"2026-07-06",asset_id:"champion-3q-line-v0",variant_id:"champion-v0",content_id:"post-a",source:"facebook",medium:"social",campaign:"week0-cta-text",event_type:"link_click",event_count:3,quality_score:null},\n{event_date:"2026-07-06",asset_id:"champion-3q-line-v0",variant_id:"champion-v0",content_id:"post-a",source:"facebook",medium:"social",campaign:"week0-cta-text",event_type:"line_add",event_count:2,quality_score:null},\n{event_date:"2026-07-07",asset_id:"champion-3q-line-v0",variant_id:"champion-v0",content_id:"post-a",source:"facebook",medium:"social",campaign:"week0-cta-text",event_type:"lead_submit",event_count:1,quality_score:null}\n]}]));\n`;
  await writeFile(fakeWrangler, fakeSource);
  await chmod(fakeWrangler, 0o755);
  return { tmpDir, ownerStatus, postGate, readiness, ownerInput, fakeWrangler, argsCapture };
}

async function runBlockedScenario(paths) {
  const statusPath = path.join(paths.tmpDir, "blocked-status.json");
  const reportPath = path.join(paths.tmpDir, "blocked-report.md");
  const outputPath = path.join(paths.tmpDir, "blocked-events.jsonl");
  const result = await runExporter(paths, { statusPath, reportPath, outputPath, allowRemote: false });
  const status = JSON.parse(await readFile(statusPath, "utf8"));
  return {
    id: "missing_allow_remote_blocks_before_query",
    ok: result.exitCode === 2
      && status.ok === false
      && status.query_performed === false
      && status.remote_read_performed === false
      && status.data_lp_events_write_performed === false,
    exit_code: result.exitCode,
    query_performed: status.query_performed,
    remote_read_performed: status.remote_read_performed,
    data_lp_events_write_performed: status.data_lp_events_write_performed,
    external_effect: status.external_effect,
  };
}

async function runAggregateScenario(paths) {
  const statusPath = path.join(paths.tmpDir, "aggregate-status.json");
  const reportPath = path.join(paths.tmpDir, "aggregate-report.md");
  const outputPath = path.join(paths.tmpDir, "aggregate-events.jsonl");
  const result = await runExporter(paths, { statusPath, reportPath, outputPath, allowRemote: true });
  const status = JSON.parse(await readFile(statusPath, "utf8"));
  const events = (await readFile(outputPath, "utf8")).trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const args = JSON.parse(await readFile(paths.argsCapture, "utf8"));
  const sql = args[args.indexOf("--command") + 1] ?? "";
  const outputHasForbiddenFields = events.some((event) => FORBIDDEN_RAW_FIELDS.some((field) => Object.hasOwn(event, field) && field !== "metadata_json"));
  const sqlHasForbiddenFields = FORBIDDEN_RAW_FIELDS.some((field) => sql.includes(field));
  const deterministicIds = new Set(events.map((event) => event.event_id)).size === events.length;
  const experimentCampaignScoped = sql.includes("WHERE campaign = 'week0-cta-text'");
  const completedWeekScoped = sql.includes("occurred_at >=") && sql.includes("occurred_at <=");
  const truncationSentinelRequested = sql.includes("LIMIT 10001");
  return {
    id: "fixture_wrangler_proves_aggregate_only_export",
    ok: result.exitCode === 0
      && status.ok === true
      && status.fixture_remote_simulation === true
      && status.remote_read_performed === false
      && status.raw_event_rows_read_performed === false
      && status.customer_data_read_performed === false
      && status.aggregate_rows_read === 3
      && status.rows_exported === 6
      && events.length === 6
      && !outputHasForbiddenFields
      && !sqlHasForbiddenFields
      && sql.includes("COUNT(*) AS event_count")
      && experimentCampaignScoped
      && completedWeekScoped
      && truncationSentinelRequested
      && deterministicIds
      && status.data_lp_events_write_performed === false,
    exit_code: result.exitCode,
    aggregate_rows_read: status.aggregate_rows_read,
    rows_exported: status.rows_exported,
    output_has_forbidden_fields: outputHasForbiddenFields,
    sql_has_forbidden_fields: sqlHasForbiddenFields,
    aggregate_sql_present: sql.includes("COUNT(*) AS event_count"),
    experiment_campaign_scoped: experimentCampaignScoped,
    completed_week_scoped: completedWeekScoped,
    truncation_sentinel_requested: truncationSentinelRequested,
    deterministic_ids: deterministicIds,
    real_remote_cli_performed: false,
    remote_read_performed: status.remote_read_performed,
    customer_data_read_performed: status.customer_data_read_performed,
    project_real_events_write_performed: false,
    external_effect: status.external_effect,
  };
}

async function runExporter(paths, options) {
  const args = ["scripts/export-d1-aggregate-events.mjs"];
  if (options.allowRemote) args.push("--allow-remote");
  const env = {
    ...process.env,
    D1_AGGREGATE_FIXTURE_MODE: "1",
    D1_AGGREGATE_WRANGLER_BIN: paths.fakeWrangler,
    D1_AGGREGATE_ARGS_CAPTURE: paths.argsCapture,
    D1_AGGREGATE_OUTPUT_PATH: options.outputPath,
    D1_AGGREGATE_REAL_EVENTS_PATH: path.join(paths.tmpDir, "project-real-events-never-write.jsonl"),
    D1_AGGREGATE_STATUS_PATH: options.statusPath,
    D1_AGGREGATE_REPORT_PATH: options.reportPath,
    D1_AGGREGATE_OWNER_STATUS_PATH: paths.ownerStatus,
    D1_AGGREGATE_POST_GATE_PATH: paths.postGate,
    D1_AGGREGATE_READINESS_PATH: paths.readiness,
    D1_AGGREGATE_OWNER_INPUT_PATH: paths.ownerInput,
  };
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, args, { cwd: ROOT, env });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    return { exitCode: typeof error.code === "number" ? error.code : 1, stdout: error.stdout ?? "", stderr: error.stderr ?? String(error.message ?? error) };
  }
}

function renderReport(status) {
  const rows = status.scenarios.map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "failed"} | ${scenario.exit_code} | ${scenario.remote_read_performed ? "yes" : "no"} | ${scenario.customer_data_read_performed ? "yes" : "no"} |`).join("\n");
  return `# D1 Aggregate Export Fixture Report\n\nBLUF: ${status.ok ? "d1_aggregate_export_fixtures_ok" : "d1_aggregate_export_fixtures_failed"}. A fixture Wrangler proves grouped-count parsing without a real remote call.\n\n| scenario | status | exit | remote_read | customer_data_read |\n|---|---|---:|---|---|\n${rows}\n\n- Real remote CLI performed: no\n- Raw event rows read: no\n- Customer data read: no\n- Project real-events write performed: no\n- External effect: no\n`;
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
