import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "post_gate_verification_status.json");
const REPORT_PATH = path.join(ROOT, "post_gate_verification.md");
const DEFAULT_PATHS = {
  launchReadiness: path.join(ROOT, "launch_readiness.json"),
  ownerEvidence: path.join(ROOT, "data", "owner_gate_evidence_status.json"),
  approvalResume: path.join(ROOT, "data", "approval_resume_status.json"),
  weeklyRunner: path.join(ROOT, "data", "weekly_runner_status.json"),
  browserSmoke: path.join(ROOT, "data", "browser_smoke_status.json"),
  eventSmoke: path.join(ROOT, "data", "event_contract_smoke_status.json"),
  githubExport: path.join(ROOT, "data", "github_export_status.json"),
  abStatus: path.join(ROOT, "ab_test_status.json"),
  trackingLinks: path.join(ROOT, "tracking_links.json"),
  d1Sync: path.join(ROOT, "data", "d1_sync_status.json"),
  schema: path.join(ROOT, "schema", "d1-week0.sql"),
  packageJson: path.join(ROOT, "package.json"),
  status: STATUS_PATH,
  report: REPORT_PATH,
};

const RED_LINE_FLAGS = {
  external_effect: false,
  execution_performed: false,
  remote_d1_create_performed: false,
  remote_d1_migration_performed: false,
  production_deploy_performed: false,
  public_link_change_performed: false,
  github_push_or_pr_performed: false,
  formal_post_performed: false,
  line_push_performed: false,
  customer_data_mutation_performed: false,
  payment_action_performed: false,
  delete_action_performed: false,
};

async function main() {
  const generatedAt = new Date();
  const paths = parseArgs(process.argv.slice(2));
  const launchReadiness = await readJson(paths.launchReadiness);
  const ownerEvidence = await readJson(paths.ownerEvidence);
  const approvalResume = await readJson(paths.approvalResume);
  const weeklyRunner = await readOptionalJson(paths.weeklyRunner);
  const browserSmoke = await readOptionalJson(paths.browserSmoke);
  const eventSmoke = await readOptionalJson(paths.eventSmoke);
  const githubExport = await readOptionalJson(paths.githubExport);
  const abStatus = await readOptionalJson(paths.abStatus);
  const trackingLinks = await readOptionalJson(paths.trackingLinks);
  const d1Sync = await readOptionalJson(paths.d1Sync);
  const schemaExists = await exists(paths.schema);
  const packageJson = await readJson(paths.packageJson);

  const context = {
    launchReadiness,
    ownerEvidence,
    approvalResume,
    weeklyRunner,
    browserSmoke,
    eventSmoke,
    githubExport,
    abStatus,
    trackingLinks,
    d1Sync,
    schemaExists,
    packageJson,
  };
  const gates = (launchReadiness.owner_gates ?? []).map((gate) => buildGateVerification(gate, context));
  const nonManualGates = gates.filter((gate) => !gate.manual_only);
  const readyGateCount = nonManualGates.filter((gate) => gate.post_gate_verification_ready).length;
  const evidenceReadyCount = nonManualGates.filter((gate) => gate.owner_evidence_valid).length;
  const issueCount = gates.flatMap((gate) => gate.blocked_reasons).length;
  const status = {
    ok: ownerEvidence.ok === true && ownerEvidence.sensitive_evidence_detected !== true,
    generated_at: generatedAt.toISOString(),
    mode: "post_gate_verification_plan",
    status: statusName(ownerEvidence, readyGateCount, nonManualGates.length),
    status_path: paths.status,
    report_path: paths.report,
    owner_gate_evidence_status: ownerEvidence.status,
    owner_gate_evidence_input_exists: ownerEvidence.input_exists,
    owner_evidence_issue_count: ownerEvidence.issue_count ?? 0,
    gate_count: gates.length,
    non_manual_gate_count: nonManualGates.length,
    evidence_ready_count: evidenceReadyCount,
    ready_gate_count: readyGateCount,
    issue_count: issueCount,
    ready_for_post_gate_read_only_verification: nonManualGates.length > 0 && readyGateCount === nonManualGates.length,
    no_network_read_performed: true,
    no_remote_cli_performed: true,
    no_actual_evidence_values_persisted: true,
    gates,
    next_safe_action: nextSafeAction(ownerEvidence, gates),
    ...RED_LINE_FLAGS,
    note: "Local-only post-gate verification plan. It evaluates owner evidence and local prerequisite status, but it never calls Cloudflare, GitHub, public URLs, LINE, payment systems, customer systems, or delete APIs.",
  };

  await mkdir(path.dirname(paths.status), { recursive: true });
  await mkdir(path.dirname(paths.report), { recursive: true });
  await writeJson(paths.status, status);
  await writeFile(paths.report, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

function parseArgs(args) {
  const paths = { ...DEFAULT_PATHS };
  const keyByFlag = {
    "--launch-readiness": "launchReadiness",
    "--owner-evidence": "ownerEvidence",
    "--approval-resume": "approvalResume",
    "--weekly-runner": "weeklyRunner",
    "--browser-smoke": "browserSmoke",
    "--event-smoke": "eventSmoke",
    "--github-export": "githubExport",
    "--ab-status": "abStatus",
    "--tracking-links": "trackingLinks",
    "--d1-sync": "d1Sync",
    "--schema": "schema",
    "--package": "packageJson",
    "--status": "status",
    "--report": "report",
  };

  for (const arg of args) {
    const [flag, value] = arg.split("=", 2);
    const key = keyByFlag[flag];
    if (key && value) {
      paths[key] = resolvePath(value);
    }
  }

  return paths;
}

function buildGateVerification(gate, context) {
  const evidenceGate = (context.ownerEvidence.gates ?? []).find((item) => item.gate_id === gate.id) ?? {};
  const planGate = (context.approvalResume.owner_gate_plans ?? []).find((item) => item.gate_id === gate.id) ?? {};
  const manualOnly = gate.status === "manual_only" || evidenceGate.manual_only === true;
  const checks = gateChecks(gate.id, {
    ...context,
    gate,
    evidenceGate,
    planGate,
  });
  const checksOk = checks.every((check) => check.ok);
  const ownerEvidenceValid = evidenceGate.evidence_valid === true && evidenceGate.ready_for_post_gate_verification === true;
  const postGateReady = !manualOnly && ownerEvidenceValid && checksOk;
  const blockedReasons = [
    ...(ownerEvidenceValid ? [] : [`owner_evidence_not_ready:${evidenceGate.blocked_reasons?.[0] ?? context.ownerEvidence.status ?? "waiting"}`]),
    ...checks.filter((check) => !check.ok).map((check) => `${check.id}:${check.reason}`),
    ...(manualOnly ? ["manual_only_gate_no_automated_post_verification"] : []),
  ];

  return {
    gate_id: gate.id,
    approval_id: gate.approval_id ?? null,
    risk_tier: gate.risk_tier,
    prepared_artifact: gate.prepared_artifact,
    manual_only: manualOnly,
    owner_evidence_detected: evidenceGate.evidence_detected === true,
    owner_evidence_valid: ownerEvidenceValid,
    recurring_aggregate_read_approved: gate.id === "remote_d1_create_and_migrate"
      ? evidenceGate.recurring_aggregate_read_approved === true
      : null,
    post_gate_verification_ready: postGateReady,
    safe_to_run_automatically: false,
    read_only_followup_required: postGateReady,
    execution_policy: manualOnly ? "manual_only_no_automation" : "plan_only_owner_or_separately_approved_read_only",
    checks,
    blocked_reasons: blockedReasons,
    recommended_followup: followupForGate(gate.id, postGateReady, blockedReasons, evidenceGate.recurring_aggregate_read_approved === true),
    ...RED_LINE_FLAGS,
  };
}

function gateChecks(gateId, context) {
  const checks = [];
  const commandSteps = new Set((context.weeklyRunner?.commands ?? []).filter((item) => item.status === "success").map((item) => item.step));
  const trackingLinks = context.trackingLinks?.links ?? [];

  if (gateId === "remote_d1_create_and_migrate") {
    const guardedD1ExportSeen = context.d1Sync?.ok === true && (
      context.d1Sync?.scope === "local"
      || (
        context.d1Sync?.scope === "remote_aggregate_only"
        && context.d1Sync?.aggregate_only_read_performed === true
        && context.d1Sync?.raw_event_rows_read_performed === false
        && context.d1Sync?.customer_data_read_performed === false
      )
    );
    checks.push(check("schema_artifact_present", context.schemaExists, "schema/d1-week0.sql exists"));
    checks.push(check("local_schema_contract_linked", context.gate.supporting_artifacts?.includes("d1_schema_contract.md"), "launch gate links the isolated two-pass D1 schema contract"));
    checks.push(check("post_migration_integrity_command_present", context.gate.resume_commands?.some((command) => command.includes("PRAGMA integrity_check")), "launch gate includes post-migration integrity verification"));
    checks.push(check("remote_collect_script_present", typeof context.packageJson.scripts?.["collect:d1:remote:approved"] === "string", "collect:d1:remote:approved npm script exists"));
    checks.push(check("guarded_d1_export_seen", guardedD1ExportSeen, "a local export or owner-approved aggregate-only remote export is present without raw/customer reads"));
    checks.push(check("approval_resume_plan_only", context.planGate.execution_policy === "dry_run_plan_only" || context.planGate.ready_for_owner_execution === true || context.ownerEvidence.input_exists === false, "approval resume remains plan-only"));
  } else if (gateId === "candidate_worker_production_deploy") {
    checks.push(check("worker_dry_run_success", commandSteps.has("deploy_candidate_worker"), "weekly runner worker dry-run succeeded"));
    checks.push(check("browser_route_smoke_ok", context.browserSmoke?.ok === true && context.browserSmoke?.event_write_performed === false, "local browser route smoke passed without event write"));
    checks.push(check("event_contract_smoke_ok", context.eventSmoke?.ok === true && context.eventSmoke?.real_event_write_performed === false, "isolated event contract smoke passed"));
    checks.push(check("remote_d1_evidence_ready", gateReady(context, "remote_d1_create_and_migrate"), "remote D1 evidence must be ready before Worker post-gate verification"));
  } else if (gateId === "public_ab_small_traffic_link") {
    checks.push(check("candidate_worker_evidence_ready", gateReady(context, "candidate_worker_production_deploy"), "candidate Worker evidence must be ready before public A/B verification"));
    checks.push(check("ab_allocation_90_10", context.abStatus?.traffic_allocation?.champion === 90 && context.abStatus?.traffic_allocation?.challenger === 10, "A/B allocation remains 90/10"));
    checks.push(check("no_challenger_auto_promotion", context.abStatus?.promotion_performed !== true && context.abStatus?.public_link_change_performed === false, "challenger was not promoted and public link was not changed by this engine"));
    checks.push(check("ab_router_link_present", trackingLinks.some((link) => link.role === "ab_small_traffic"), "tracking_links.json includes A/B small traffic router link"));
  } else if (gateId === "github_repo_branch_pr") {
    checks.push(check("champion_handoff_exact", context.gate.prepared_artifact === "champion_github_handoff.md", "launch gate uses the exact Champion GitHub handoff"));
    checks.push(check("champion_repo_exact", context.gate.resume_commands?.some((command) => command.includes("milk790-code/3q-hatchery-line-oa")), "launch gate targets the known Champion repository"));
    checks.push(check("champion_branch_exact", context.gate.resume_commands?.some((command) => command.includes("codex/3q-growth-loop-champion-v1")), "launch gate targets the prepared Champion branch"));
    checks.push(check("no_git_init_for_champion", !context.gate.resume_commands?.some((command) => command.includes("git init")), "Champion handoff never initializes a new repository"));
    checks.push(check("github_export_bundle_ok", context.githubExport?.ok === true && context.githubExport?.mode === "github_export_bundle_local_only", "local GitHub export bundle is ready"));
    checks.push(check("github_export_excludes_owner_evidence", (context.githubExport?.excluded_live_or_owner_inputs ?? []).includes("owner_gate_evidence.json"), "GitHub export excludes owner_gate_evidence.json"));
    checks.push(check("no_git_push_by_engine", context.githubExport?.github_push_or_pr_performed === false && context.githubExport?.git_commit_performed === false, "engine did not commit, push, or create PR"));
  } else if (gateId === "formal_posts_line_push_payment_customer_data") {
    checks.push(check("manual_only_acknowledged_by_policy", false, "formal posts, LINE push, payment, customer data, and deletion remain outside automation"));
  } else {
    checks.push(check("known_gate", false, "unknown owner gate"));
  }

  return checks;
}

function gateReady(context, gateId) {
  const evidenceGate = (context.ownerEvidence.gates ?? []).find((item) => item.gate_id === gateId);
  return evidenceGate?.evidence_valid === true && evidenceGate?.ready_for_post_gate_verification === true;
}

function check(id, ok, reason) {
  return {
    id,
    ok: Boolean(ok),
    reason,
    external_effect: false,
    execution_performed: false,
  };
}

function statusName(ownerEvidence, readyGateCount, nonManualGateCount) {
  if (ownerEvidence.ok !== true) return "blocked_invalid_owner_evidence";
  if (ownerEvidence.input_exists !== true) return "waiting_for_owner_evidence";
  if (readyGateCount === 0) return "owner_evidence_detected_no_post_gate_verification_ready";
  if (readyGateCount === nonManualGateCount) return "post_gate_verification_plan_ready";
  return "partial_post_gate_verification_plan_ready";
}

function nextSafeAction(ownerEvidence, gates) {
  if (ownerEvidence.input_exists !== true) {
    return "Wait for owner-executed external gates, then fill owner_gate_evidence.json and rerun npm run owner:evidence && npm run post:verify.";
  }
  if (ownerEvidence.ok !== true) {
    return "Fix owner_gate_evidence.json before any post-gate follow-up.";
  }
  const firstReady = gates.find((gate) => gate.post_gate_verification_ready);
  if (firstReady) {
    return `${firstReady.gate_id}: ready for separately approved read-only follow-up verification; this script performed none.`;
  }
  const firstBlocked = gates.find((gate) => !gate.manual_only);
  return `${firstBlocked?.gate_id ?? "owner_gates"}: ${firstBlocked?.recommended_followup ?? "continue owner-gated setup"}`;
}

function followupForGate(gateId, ready, blockedReasons, recurringAggregateReadApproved = false) {
  if (ready) {
    if (gateId === "remote_d1_create_and_migrate") {
      return recurringAggregateReadApproved
        ? "Schema evidence is ready and recurring aggregate-only D1 reads are owner-approved; run the guarded aggregate collector and keep raw event fields excluded."
        : "Schema evidence is ready for local post-gate planning, but recurring D1 reads remain disabled until separately approved.";
    }
    if (gateId === "candidate_worker_production_deploy") return "Run separately approved Worker /health and route checks without publishing or changing public links.";
    if (gateId === "public_ab_small_traffic_link") return "Run separately approved small-traffic link check; do not change the main bio/link or promote challenger.";
    if (gateId === "github_repo_branch_pr") return "Review the owner-created PR or branch with GitHub tools; do not merge or deploy.";
  }
  if (gateId === "formal_posts_line_push_payment_customer_data") return "Manual-only. Keep drafts, LINE actions, payments, customer data, and deletes outside automation.";
  return blockedReasons[0] ?? "Wait for valid owner evidence and rerun post:verify.";
}

function renderReport(status) {
  const rows = status.gates
    .map((gate) => `| ${gate.gate_id} | ${gate.owner_evidence_detected ? "yes" : "no"} | ${gate.owner_evidence_valid ? "yes" : "no"} | ${gate.recurring_aggregate_read_approved === null ? "n/a" : gate.recurring_aggregate_read_approved ? "yes" : "no"} | ${gate.post_gate_verification_ready ? "yes" : "no"} | ${gate.safe_to_run_automatically ? "yes" : "no"} | ${gate.blocked_reasons.join("; ") || "n/a"} |`)
    .join("\n");
  const checkRows = status.gates
    .flatMap((gate) => gate.checks.map((item) => `| ${gate.gate_id} | ${item.id} | ${item.ok ? "ok" : "blocked"} | ${item.reason} |`))
    .join("\n");

  return `# 3Q Growth Loop Post-Gate Verification

BLUF: ${status.status}. This is a local verification plan after owner-executed external gates. It performs no network reads, no remote CLI commands, no deploy, no GitHub write, no public link change, no LINE action, no payment, no customer-data mutation, and no delete.

Generated: ${status.generated_at}
Owner evidence status: ${status.owner_gate_evidence_status}
Owner evidence input exists: ${status.owner_gate_evidence_input_exists ? "yes" : "no"}
Ready gates: ${status.ready_gate_count}/${status.non_manual_gate_count}
No network read performed: yes
No remote CLI performed: yes
Actual evidence values persisted: no
External effect: no
Execution performed: no

## Gate Plan

| gate | evidence_detected | evidence_valid | recurring_aggregate_read_approved | post_gate_verification_ready | safe_to_run_automatically | blocked_reasons |
|---|---|---|---|---|---|---|
${rows}

## Local Checks

| gate | check | status | reason |
|---|---|---|---|
${checkRows}

## Next Safe Action

${status.next_safe_action}

## Safety Invariants

- Remote D1 create performed: no
- Remote D1 migration performed: no
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

function resolvePath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(ROOT, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(resolvePath(filePath), "utf8"));
}

async function readOptionalJson(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function exists(filePath) {
  try {
    await access(resolvePath(filePath));
    return true;
  } catch {
    return false;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
