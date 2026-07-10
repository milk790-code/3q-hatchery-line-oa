import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DEFAULT_STATUS_PATH = path.join(ROOT, "data", "d1_collection_mode_status.json");
const DEFAULT_REPORT_PATH = path.join(ROOT, "d1_collection_mode.md");
const DEFAULT_OWNER_STATUS_PATH = path.join(ROOT, "data", "owner_gate_evidence_status.json");
const DEFAULT_POST_GATE_PATH = path.join(ROOT, "data", "post_gate_verification_status.json");
const DEFAULT_READINESS_PATH = path.join(ROOT, "data", "cloudflare_d1_readiness_status.json");
const DEFAULT_OWNER_INPUT_PATH = path.join(ROOT, "owner_gate_evidence.json");
const D1_GATE_ID = "remote_d1_create_and_migrate";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let readinessRefreshPerformed = false;
  if (!options.planOnly && options.refreshGates) {
    await runNode("scripts/owner-gate-evidence.mjs");
    await runNode("scripts/post-gate-verification.mjs");
    const ownerInputBeforeSelection = await readOptionalJson(options.ownerInput);
    const d1Evidence = (ownerInputBeforeSelection?.evidence ?? []).find((row) => row.gate_id === D1_GATE_ID);
    if (d1Evidence?.recurring_aggregate_read_approved === true) {
      await runNode("scripts/cloudflare-d1-readiness.mjs", ["--refresh-live"]);
      readinessRefreshPerformed = true;
    }
  }

  const inputs = {
    ownerStatus: await readOptionalJson(options.ownerStatus),
    postGate: await readOptionalJson(options.postGate),
    readiness: await readOptionalJson(options.readiness),
    ownerInput: await readOptionalJson(options.ownerInput),
  };
  const decision = selectCollectionMode(inputs);
  const baseStatus = {
    ok: true,
    generated_at: new Date().toISOString(),
    mode: "owner_evidence_driven_d1_collection_selector",
    status: decision.remoteAuthorized ? "remote_aggregate_collection_approved" : "local_review_collection_only",
    selected_scope: decision.remoteAuthorized ? "remote_aggregate_only" : "local_review_only",
    selected_command: decision.remoteAuthorized ? "npm run collect:d1:remote:approved" : "npm run collect:d1:local",
    remote_read_authorized: decision.remoteAuthorized,
    recurring_aggregate_read_approved: decision.recurringAggregateReadApproved,
    aggregate_only_policy: true,
    raw_event_rows_allowed: false,
    checks: decision.checks,
    blocked_reasons: decision.checks.filter((check) => !check.ok).map((check) => check.reason),
    plan_only: options.planOnly,
    gate_refresh_performed: !options.planOnly && options.refreshGates,
    readiness_live_refresh_performed: readinessRefreshPerformed,
    collection_execution_performed: false,
    local_read_performed: false,
    remote_read_performed: false,
    aggregate_only_read_performed: false,
    raw_event_rows_read_performed: false,
    customer_data_read_performed: false,
    customer_data_mutation_performed: false,
    data_lp_events_write_performed: false,
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };

  if (options.planOnly) {
    await writeOutputs(options, baseStatus);
    console.log(JSON.stringify(baseStatus, null, 2));
    return;
  }

  try {
    const command = decision.remoteAuthorized
      ? ["scripts/export-d1-aggregate-events.mjs", "--allow-remote"]
      : ["scripts/export-d1-events.mjs", "--local", "--output=data/lp_events.d1-local.jsonl"];
    await runNode(command[0], command.slice(1));
    const syncStatus = await readOptionalJson(path.join(ROOT, "data", "d1_sync_status.json"));
    const status = {
      ...baseStatus,
      ok: syncStatus?.ok === true,
      status: syncStatus?.ok === true
        ? decision.remoteAuthorized ? "remote_aggregate_collection_completed" : "local_review_collection_completed"
        : "collection_failed",
      collection_execution_performed: true,
      local_read_performed: syncStatus?.scope === "local",
      remote_read_performed: syncStatus?.remote_read_performed === true,
      aggregate_only_read_performed: syncStatus?.aggregate_only_read_performed === true,
      raw_event_rows_read_performed: syncStatus?.raw_event_rows_read_performed === true,
      customer_data_read_performed: syncStatus?.customer_data_read_performed === true,
      data_lp_events_write_performed: syncStatus?.data_lp_events_write_performed === true,
      rows_exported: syncStatus?.rows_exported ?? 0,
      aggregate_rows_read: syncStatus?.aggregate_rows_read ?? 0,
      d1_sync_status: syncStatus?.status ?? null,
    };
    await writeOutputs(options, status);
    console.log(JSON.stringify(status, null, 2));
    if (!status.ok) process.exitCode = 1;
  } catch (error) {
    const status = {
      ...baseStatus,
      ok: false,
      status: "collection_failed",
      collection_execution_performed: true,
      error: error instanceof Error ? error.message : "unknown_error",
    };
    await writeOutputs(options, status);
    console.error(error);
    process.exitCode = 1;
  }
}

function selectCollectionMode({ ownerStatus, postGate, readiness, ownerInput }) {
  const ownerGate = (ownerStatus?.gates ?? []).find((gate) => gate.gate_id === D1_GATE_ID);
  const postGateRow = (postGate?.gates ?? []).find((gate) => gate.gate_id === D1_GATE_ID);
  const evidence = (ownerInput?.evidence ?? []).find((row) => row.gate_id === D1_GATE_ID);
  const expectedName = readiness?.expected?.database_name;
  const expectedId = readiness?.expected?.configured_database_id;
  const checks = [
    check("owner_evidence_input_present", ownerStatus?.input_exists === true && Boolean(evidence), "Owner D1 evidence input is required."),
    check("owner_evidence_valid", ownerGate?.evidence_valid === true && ownerGate?.ready_for_post_gate_verification === true, "Owner D1 evidence must pass the local evidence contract."),
    check("recurring_aggregate_read_approved", ownerGate?.recurring_aggregate_read_approved === true && evidence?.recurring_aggregate_read_approved === true, "Owner must explicitly approve recurring aggregate-only D1 reads."),
    check("post_gate_verification_ready", postGateRow?.post_gate_verification_ready === true, "D1 post-gate verification plan must be ready."),
    check("dedicated_database_present", readiness?.decision?.dedicated_database_present === true, "The dedicated Growth Loop D1 must be present."),
    check("configured_id_matches", readiness?.decision?.configured_id_matches === true, "The configured D1 id must match read-only inventory."),
    check("evidence_database_name_matches", Boolean(expectedName) && evidence?.d1_database_name === expectedName, "Owner evidence D1 name must match the configured dedicated database."),
    check("evidence_database_id_matches", Boolean(expectedId) && evidence?.d1_database_id === expectedId, "Owner evidence D1 id must match the configured dedicated database."),
  ];
  return {
    remoteAuthorized: checks.every((item) => item.ok),
    recurringAggregateReadApproved: ownerGate?.recurring_aggregate_read_approved === true && evidence?.recurring_aggregate_read_approved === true,
    checks,
  };
}

function check(id, ok, reason) {
  return { id, ok: Boolean(ok), reason, external_effect: false };
}

function parseArgs(args) {
  const options = {
    planOnly: false,
    refreshGates: true,
    status: DEFAULT_STATUS_PATH,
    report: DEFAULT_REPORT_PATH,
    ownerStatus: DEFAULT_OWNER_STATUS_PATH,
    postGate: DEFAULT_POST_GATE_PATH,
    readiness: DEFAULT_READINESS_PATH,
    ownerInput: DEFAULT_OWNER_INPUT_PATH,
  };
  for (const arg of args) {
    if (arg === "--plan-only") options.planOnly = true;
    if (arg === "--no-refresh-gates") options.refreshGates = false;
    if (arg.startsWith("--status=")) options.status = path.resolve(ROOT, arg.slice("--status=".length));
    if (arg.startsWith("--report=")) options.report = path.resolve(ROOT, arg.slice("--report=".length));
    if (arg.startsWith("--owner-status=")) options.ownerStatus = path.resolve(ROOT, arg.slice("--owner-status=".length));
    if (arg.startsWith("--post-gate=")) options.postGate = path.resolve(ROOT, arg.slice("--post-gate=".length));
    if (arg.startsWith("--readiness=")) options.readiness = path.resolve(ROOT, arg.slice("--readiness=".length));
    if (arg.startsWith("--owner-input=")) options.ownerInput = path.resolve(ROOT, arg.slice("--owner-input=".length));
  }
  return options;
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function runNode(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${script} failed with code ${code}: ${stderr || stdout}`));
    });
  });
}

async function writeOutputs(options, status) {
  await mkdir(path.dirname(options.status), { recursive: true });
  await mkdir(path.dirname(options.report), { recursive: true });
  await writeFile(options.status, `${JSON.stringify(status, null, 2)}\n`);
  await writeFile(options.report, renderReport(status));
}

function renderReport(status) {
  const rows = status.checks.map((item) => `| ${item.id} | ${item.ok ? "ok" : "blocked"} | ${item.reason} |`).join("\n");
  return `# D1 Collection Mode\n\nBLUF: ${status.remote_read_authorized ? "Owner evidence authorizes recurring aggregate-only remote collection." : "Remote collection is not authorized; weekly collection remains local-review-only."}\n\n- Status: ${status.status}\n- Selected scope: ${status.selected_scope}\n- Selected command: ${status.selected_command}\n- Plan only: ${status.plan_only ? "yes" : "no"}\n- Remote read authorized: ${status.remote_read_authorized ? "yes" : "no"}\n- Aggregate-only policy: yes\n- Raw event rows allowed: no\n- Customer data read: ${status.customer_data_read_performed ? "yes" : "no"}\n- Customer data mutation: no\n- External effect: no\n\n## Authorization Checks\n\n| check | status | reason |\n|---|---|---|\n${rows}\n\n## Safety\n\nWithout valid owner evidence, recurring aggregate-read approval, post-gate readiness, exact D1 metadata, and matching evidence target, the selector always runs local review collection. It never falls back to a raw remote row query.\n`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
