import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "d1_collection_mode_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "d1_collection_mode_fixture_report.md");
const D1_ID = "deb85e19-95fd-4611-8710-9cb6ea6dc7ff";
const D1_NAME = "3q-growth-loop-candidate";

async function main() {
  const generatedAt = new Date();
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "3q-d1-collection-mode-"));
  const scenarios = [
    scenario("missing_owner_evidence_stays_local", { owner: false, recurring: false, postReady: false, matchingTarget: false }, false),
    scenario("recurring_read_not_approved_stays_local", { owner: true, recurring: false, postReady: true, matchingTarget: true }, false),
    scenario("post_gate_not_ready_stays_local", { owner: true, recurring: true, postReady: false, matchingTarget: true }, false),
    scenario("mismatched_d1_target_stays_local", { owner: true, recurring: true, postReady: true, matchingTarget: false }, false),
    scenario("valid_owner_evidence_selects_remote_aggregate_plan", { owner: true, recurring: true, postReady: true, matchingTarget: true }, true),
  ];
  const results = [];
  for (const item of scenarios) results.push(await runScenario(tmpDir, item));
  const status = {
    ok: results.every((result) => result.ok),
    generated_at: generatedAt.toISOString(),
    mode: "d1_collection_mode_fixture_dry_run",
    scenario_count: results.length,
    scenarios: results,
    plan_only: true,
    selector_commands_executed: true,
    collection_execution_performed: false,
    remote_read_performed: false,
    raw_event_rows_read_performed: false,
    customer_data_read_performed: false,
    customer_data_mutation_performed: false,
    data_lp_events_write_performed: false,
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

function scenario(id, input, expectedRemote) {
  return { id, input, expectedRemote };
}

async function runScenario(tmpDir, item) {
  const dir = path.join(tmpDir, item.id);
  await mkdir(dir, { recursive: true });
  const ownerStatusPath = path.join(dir, "owner_status.json");
  const postGatePath = path.join(dir, "post_gate.json");
  const readinessPath = path.join(dir, "readiness.json");
  const ownerInputPath = path.join(dir, "owner_input.json");
  const statusPath = path.join(dir, "mode_status.json");
  const reportPath = path.join(dir, "mode.md");

  await writeJson(ownerStatusPath, ownerStatus(item.input));
  await writeJson(postGatePath, postGate(item.input));
  await writeJson(readinessPath, readiness());
  if (item.input.owner) await writeJson(ownerInputPath, ownerInput(item.input));

  const args = [
    "scripts/collect-d1-auto.mjs",
    "--plan-only",
    "--no-refresh-gates",
    `--owner-status=${ownerStatusPath}`,
    `--post-gate=${postGatePath}`,
    `--readiness=${readinessPath}`,
    `--owner-input=${ownerInputPath}`,
    `--status=${statusPath}`,
    `--report=${reportPath}`,
  ];
  const result = await execFileAsync(process.execPath, args, { cwd: ROOT });
  const status = JSON.parse(await readFile(statusPath, "utf8"));
  const ok = result.stderr.length === 0
    && status.ok === true
    && status.plan_only === true
    && status.remote_read_authorized === item.expectedRemote
    && status.selected_scope === (item.expectedRemote ? "remote_aggregate_only" : "local_review_only")
    && status.collection_execution_performed === false
    && status.remote_read_performed === false
    && status.raw_event_rows_read_performed === false
    && status.customer_data_read_performed === false
    && status.external_effect === false;
  return {
    id: item.id,
    ok,
    selected_scope: status.selected_scope,
    remote_read_authorized: status.remote_read_authorized,
    blocked_check_ids: status.checks.filter((check) => !check.ok).map((check) => check.id),
    collection_execution_performed: status.collection_execution_performed,
    remote_read_performed: status.remote_read_performed,
    raw_event_rows_read_performed: status.raw_event_rows_read_performed,
    customer_data_read_performed: status.customer_data_read_performed,
    external_effect: status.external_effect,
  };
}

function ownerStatus(input) {
  return {
    ok: true,
    input_exists: input.owner,
    gates: [{
      gate_id: "remote_d1_create_and_migrate",
      evidence_valid: input.owner,
      ready_for_post_gate_verification: input.owner,
      recurring_aggregate_read_approved: input.recurring,
    }],
  };
}

function postGate(input) {
  return {
    ok: true,
    gates: [{ gate_id: "remote_d1_create_and_migrate", post_gate_verification_ready: input.postReady }],
  };
}

function readiness() {
  return {
    ok: true,
    expected: { database_name: D1_NAME, configured_database_id: D1_ID },
    decision: { dedicated_database_present: true, configured_id_matches: true },
  };
}

function ownerInput(input) {
  return {
    evidence: [{
      gate_id: "remote_d1_create_and_migrate",
      d1_database_name: input.matchingTarget ? D1_NAME : "wrong-database",
      d1_database_id: input.matchingTarget ? D1_ID : "11111111-1111-4111-8111-111111111111",
      recurring_aggregate_read_approved: input.recurring,
    }],
  };
}

function renderReport(status) {
  const rows = status.scenarios.map((item) => `| ${item.id} | ${item.ok ? "ok" : "failed"} | ${item.selected_scope} | ${item.remote_read_authorized ? "yes" : "no"} | ${item.blocked_check_ids.join(", ") || "none"} |`).join("\n");
  return `# D1 Collection Mode Fixture Report\n\nBLUF: ${status.ok ? "d1_collection_mode_fixtures_ok" : "d1_collection_mode_fixtures_failed"}. All scenarios are plan-only and perform no D1 query.\n\n| scenario | status | selected_scope | remote_authorized | blocked_checks |\n|---|---|---|---|---|\n${rows}\n\n- Collection execution performed: no\n- Remote read performed: no\n- Raw event rows read: no\n- Customer data read: no\n- External effect: no\n`;
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
