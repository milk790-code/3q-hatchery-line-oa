import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "live_telemetry_readiness_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "live_telemetry_readiness_fixture_report.md");
const CANDIDATE_ORIGIN = "https://3q-growth-loop-candidate.milk790.workers.dev";

async function main() {
  const generatedAt = new Date();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "3q-live-telemetry-fixtures-"));
  const scenarios = [
    scenario("candidate_missing_requires_deploy_gate", { candidate: false }, (status) =>
      status.status === "candidate_worker_deployment_not_observed"
      && status.candidate_worker.deploy_required === true),
    scenario("deployed_candidate_missing_security_contract_requires_update", { securityCurrent: false }, (status) =>
      status.status === "candidate_worker_security_update_required"
      && status.candidate_worker.operation_mode === "deploy_candidate_worker_security_update"
      && status.candidate_worker.deploy_required === true
      && status.candidate_worker.redeploy_required === true
      && status.decisions.observed_live_chain_ready_for_owner_evidence === false),
    scenario("live_chain_observed_requires_owner_provenance_and_schema_evidence", {}, (status) =>
      status.status === "live_chain_observed_owner_provenance_and_schema_evidence_required"
      && status.candidate_worker.operation_mode === "verify_existing_candidate_deployment"
      && status.candidate_worker.deploy_required === false
      && status.decisions.observed_live_chain_ready_for_owner_evidence === true
      && status.d1.inventory_reported_num_tables === 0
      && status.d1.inventory_table_count_authoritative === false
      && status.d1.schema_absence_inferred_from_inventory === false),
    scenario("collector_origin_mismatch_blocks_chain", { collectorMatches: false }, (status) =>
      status.status === "champion_telemetry_wiring_not_ready"
      && status.champion.collector_origin_matches === false),
    scenario("schema_and_deployment_evidence_valid_recurring_read_false", { evidence: true, recurring: false }, (status) =>
      status.status === "live_ingest_ready_recurring_read_not_approved"
      && status.decisions.live_ingest_readiness_proven === true
      && status.decisions.weekly_aggregate_read_authorized === false),
    scenario("full_evidence_enables_weekly_aggregate_read_plan", { evidence: true, recurring: true }, (status) =>
      status.status === "live_ingest_and_weekly_aggregate_read_ready"
      && status.decisions.live_ingest_readiness_proven === true
      && status.decisions.weekly_aggregate_read_authorized === true),
  ];
  const results = [];
  for (const item of scenarios) results.push(await runScenario(tempDir, generatedAt, item));
  const status = {
    ok: results.every((item) => item.ok),
    generated_at: generatedAt.toISOString(),
    mode: "live_telemetry_readiness_fixture_dry_run",
    temp_dir: tempDir,
    scenario_count: results.length,
    local_fixture_commands_executed: true,
    live_monitor_commands_executed: true,
    live_network_refresh_performed: false,
    remote_table_query_performed: false,
    raw_event_rows_read_performed: false,
    customer_data_read_performed: false,
    event_post_performed: false,
    data_lp_events_write_performed: false,
    external_effect: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    scenarios: results,
  };
  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) process.exitCode = 1;
}

function scenario(id, overrides, expect) {
  return { id, overrides, expect };
}

async function runScenario(tempDir, generatedAt, item) {
  const dir = path.join(tempDir, item.id);
  await mkdir(dir, { recursive: true });
  const snapshot = buildSnapshot(generatedAt, item.overrides);
  const d1 = buildD1Readiness(item.overrides);
  const owner = buildOwnerEvidence(item.overrides);
  const postGate = buildPostGate(item.overrides);
  const paths = {
    snapshot: path.join(dir, "snapshot.json"),
    d1: path.join(dir, "d1.json"),
    owner: path.join(dir, "owner.json"),
    postGate: path.join(dir, "post-gate.json"),
    status: path.join(dir, "status.json"),
    report: path.join(dir, "report.md"),
  };
  await Promise.all([
    writeJson(paths.snapshot, snapshot),
    writeJson(paths.d1, d1),
    writeJson(paths.owner, owner),
    writeJson(paths.postGate, postGate),
  ]);
  const args = [
    "scripts/live-telemetry-readiness.mjs",
    `--snapshot=${paths.snapshot}`,
    `--d1-readiness=${paths.d1}`,
    `--owner-evidence=${paths.owner}`,
    `--post-gate=${paths.postGate}`,
    `--status=${paths.status}`,
    `--report=${paths.report}`,
  ];
  const execution = await execNode(args);
  const status = JSON.parse(await readFile(paths.status, "utf8"));
  const ok = execution.exitCode === 0
    && status.ok === true
    && item.expect(status)
    && safe(status);
  return {
    id: item.id,
    ok,
    exit_code: execution.exitCode,
    status: status.status,
    candidate_deploy_required: status.candidate_worker?.deploy_required,
    candidate_operation_mode: status.candidate_worker?.operation_mode,
    observed_live_chain_ready_for_owner_evidence: status.decisions?.observed_live_chain_ready_for_owner_evidence,
    live_ingest_readiness_proven: status.decisions?.live_ingest_readiness_proven,
    weekly_aggregate_read_authorized: status.decisions?.weekly_aggregate_read_authorized,
    inventory_table_count_authoritative: status.d1?.inventory_table_count_authoritative,
    schema_absence_inferred_from_inventory: status.d1?.schema_absence_inferred_from_inventory,
    remote_table_query_performed: status.remote_table_query_performed,
    event_post_performed: status.event_post_performed,
    external_effect: status.external_effect,
  };
}

function buildSnapshot(generatedAt, overrides) {
  const candidatePresent = overrides.candidate !== false;
  const collectorOrigin = overrides.collectorMatches === false
    ? "https://unexpected-collector.example.workers.dev"
    : CANDIDATE_ORIGIN;
  return {
    ok: true,
    checked_at: generatedAt.toISOString(),
    mode: "fixture_read_only_live_telemetry_observation",
    candidate: {
      deployment_present: candidatePresent,
      deployment: candidatePresent ? {
        id: "fixture-deployment",
        created_on: generatedAt.toISOString(),
        source: "fixture",
        strategy: "percentage",
        version_id: "11111111-1111-4111-8111-111111111111",
        percentage: 100,
      } : null,
      health: {
        ok: candidatePresent,
        status: candidatePresent ? 200 : 404,
        service: "3q-growth-loop-candidate",
        build: overrides.securityCurrent === false ? null : "origin-pii-v2",
        security_contract: overrides.securityCurrent === false ? null : "origin-pii-v2",
        environment: "candidate",
      },
      page: { ok: candidatePresent, status: candidatePresent ? 200 : 404, bytes: candidatePresent ? 4000 : 0, offer_marker: candidatePresent },
    },
    champion: {
      page: { ok: true, status: 200, bytes: 14000, page_view_marker: true, cta_click_marker: true, line_add_marker: false },
      growth_loop_status: { ok: true, status: 200, collector_configured: true },
      collector_origin: collectorOrigin,
      observed_worker_origins: [collectorOrigin],
    },
    external_read_performed: false,
    remote_table_query_performed: false,
    customer_data_read_performed: false,
    event_post_performed: false,
    data_lp_events_write_performed: false,
    external_effect: false,
  };
}

function buildD1Readiness(overrides) {
  const ready = overrides.d1 !== false;
  return {
    ok: true,
    expected: { database_name: "3q-growth-loop-candidate", configured_database_id: "deb85e19-95fd-4611-8710-9cb6ea6dc7ff" },
    inventory: {
      exact_matches: ready ? [{ uuid: "deb85e19-95fd-4611-8710-9cb6ea6dc7ff", name: "3q-growth-loop-candidate", num_tables: 0, file_size: 90112 }] : [],
    },
    decision: { dedicated_database_present: ready, configured_id_matches: ready },
  };
}

function buildOwnerEvidence(overrides) {
  const evidence = overrides.evidence === true;
  return {
    ok: true,
    input_exists: evidence,
    gates: [
      {
        gate_id: "remote_d1_create_and_migrate",
        evidence_valid: evidence,
        ready_for_post_gate_verification: evidence,
        recurring_aggregate_read_approved: evidence && overrides.recurring === true,
      },
      {
        gate_id: "candidate_worker_production_deploy",
        evidence_valid: evidence,
        ready_for_post_gate_verification: evidence,
      },
    ],
  };
}

function buildPostGate(overrides) {
  const evidence = overrides.evidence === true;
  return {
    ok: true,
    gates: [
      { gate_id: "remote_d1_create_and_migrate", post_gate_verification_ready: evidence },
      { gate_id: "candidate_worker_production_deploy", post_gate_verification_ready: evidence },
    ],
  };
}

function safe(status) {
  return status.remote_table_query_performed === false
    && status.raw_event_rows_read_performed === false
    && status.customer_data_read_performed === false
    && status.event_post_performed === false
    && status.data_lp_events_write_performed === false
    && status.external_effect === false
    && status.production_deploy_performed === false
    && status.public_link_change_performed === false
    && status.github_push_or_pr_performed === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false;
}

async function execNode(args) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, args, { cwd: ROOT, maxBuffer: 4 * 1024 * 1024 });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    return { exitCode: typeof error.code === "number" ? error.code : 1, stdout: error.stdout ?? "", stderr: error.stderr ?? String(error.message ?? error) };
  }
}

function renderReport(status) {
  const rows = status.scenarios.map((item) => `| ${item.id} | ${item.ok ? "ok" : "fail"} | ${item.status} | ${item.candidate_operation_mode} | ${item.live_ingest_readiness_proven ? "yes" : "no"} | ${item.weekly_aggregate_read_authorized ? "yes" : "no"} |`).join("\n");
  return `# Live Telemetry Readiness Fixture Report\n\nBLUF: ${status.ok ? "live_telemetry_readiness_fixtures_ok" : "live_telemetry_readiness_fixtures_failed"}. Fixture-only chain states; no live network refresh, D1 table query, event POST, deploy, or external write.\n\n| scenario | result | status | candidate operation | ingest proven | weekly read authorized |\n|---|---|---|---|---|---|\n${rows}\n\n## Invariants\n\n- A healthy deployment switches to provenance verification only when the required origin/PII security contract marker is current; an older deployment requires one owner-gated security update.\n- D1 inventory num_tables is explicitly non-authoritative and never proves schema absence.\n- Schema evidence and recurring aggregate-read authorization are independent.\n- Remote table query performed: no\n- Event POST performed: no\n- External effect: no\n`;
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
