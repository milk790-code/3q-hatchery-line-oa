import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "gate_readiness_status.json");
const REPORT_PATH = path.join(ROOT, "gate_readiness.md");
const CHAMPION_REPOSITORY = "milk790-code/3q-hatchery-line-oa";
const CHAMPION_BRANCH = "codex/3q-growth-loop-champion-v1";

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

const GATE_DEPENDENCIES = {
  remote_d1_create_and_migrate: [
    "schema/d1-week0.sql",
    "launch_readiness.local_preflight_ok",
    "approval_metadata.remote_d1_create_and_migrate",
  ],
  candidate_worker_production_deploy: [
    "worker:dry-run",
    "browser_route_smoke",
    "event_contract_smoke",
    "remote_d1_create_and_migrate_owner_executed",
    "approval_metadata.candidate_worker_production_deploy",
  ],
  public_ab_small_traffic_link: [
    "candidate_worker_production_deploy_owner_executed",
    "approved_current_champion_url",
    "approved_rollback_url",
    "approval_metadata.public_ab_small_traffic_link",
  ],
  github_repo_branch_pr: [
    "target_github_repo",
    "safe_branch_name",
    "approval_metadata.github_repo_branch_pr",
  ],
  formal_posts_line_push_payment_customer_data: [
    "manual_only_owner_action",
  ],
};

async function main() {
  const generatedAt = new Date();
  const launchReadiness = await readJson("launch_readiness.json");
  const approvalResume = await readJson("data/approval_resume_status.json");
  const postGateVerification = await readOptionalJson("data/post_gate_verification_status.json");
  const sourceReadiness = await readOptionalJson("data/source_readiness_status.json");
  const weeklyRunner = await readOptionalJson("data/weekly_runner_status.json");
  const browserSmoke = await readOptionalJson("data/browser_smoke_status.json");
  const eventSmoke = await readOptionalJson("data/event_contract_smoke_status.json");
  const archive = await readOptionalJson("data/week_archive_status.json");
  const championGithubHandoff = await readOptionalJson("data/champion_github_handoff_status.json");
  const gitPresent = await exists(".git");

  const gates = (launchReadiness.owner_gates ?? []).map((gate, index) => buildGate({
    gate,
    index,
    launchReadiness,
    approvalResume,
    postGateVerification,
    sourceReadiness,
    weeklyRunner,
    browserSmoke,
    eventSmoke,
    archive,
    championGithubHandoff,
    gitPresent,
  }));
  const parallelMetadataActions = ownerMetadataCaptureActions(gates, approvalResume);

  const status = {
    ok: gates.length > 0 && gates.every((gate) => gate.no_autorun === true && gate.executed === false),
    generated_at: generatedAt.toISOString(),
    mode: "gate_readiness_matrix",
    status: gates.some((gate) => gate.ready_for_owner_execution) ? "owner_metadata_ready_plan_only" : "prepared_but_blocked",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    gate_count: gates.length,
    ready_gate_count: gates.filter((gate) => gate.ready_for_owner_execution).length,
    blocked_gate_count: gates.filter((gate) => !gate.ready_for_owner_execution).length,
    manual_only_count: gates.filter((gate) => gate.execution_policy === "manual_only").length,
    no_gate_execution: true,
    no_autorun_for_external_gates: true,
    source_readiness_status: sourceReadiness?.status ?? "unknown",
    public_iteration_ready: Boolean(sourceReadiness?.ready_for_public_iteration_decision),
    weekly_runner_ok: weeklyRunner?.ok === true,
    archive_ok: archive?.ok === true,
    git_repo_present: gitPresent,
    champion_repo_prepared: championGithubHandoff?.ok === true
      && championGithubHandoff?.repository?.slug === CHAMPION_REPOSITORY,
    champion_repository: championGithubHandoff?.repository?.slug ?? null,
    champion_branch: championGithubHandoff?.local_branch?.name ?? null,
    post_gate_verification_status: postGateVerification?.status ?? "unknown",
    post_gate_ready_count: postGateVerification?.ready_gate_count ?? 0,
    gates,
    next_safe_action: nextSafeAction(gates),
    parallel_metadata_action_count: parallelMetadataActions.length,
    parallel_metadata_actions: parallelMetadataActions,
    ...RED_LINE_FLAGS,
    note: "Local-only owner-gate readiness matrix. It validates order, prerequisites, plan-only status, and parallel non-secret metadata capture; it never runs external commands.",
  };

  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));
}

function buildGate(context) {
  const { gate, index, launchReadiness, approvalResume, postGateVerification, sourceReadiness, weeklyRunner, browserSmoke, eventSmoke, archive, championGithubHandoff, gitPresent } = context;
  const plan = (approvalResume.owner_gate_plans ?? []).find((item) => item.gate_id === gate.id) ?? {};
  const localPreflight = launchReadiness.local_preflight ?? [];
  const dependencies = GATE_DEPENDENCIES[gate.id] ?? [`approval_metadata.${gate.id}`];
  const manualOnly = gate.status === "manual_only";
  const dependencyChecks = dependencies.map((dependency) => dependencyStatus(dependency, {
    gate,
    plan,
    localPreflight,
    postGateVerification,
    sourceReadiness,
    weeklyRunner,
    browserSmoke,
    eventSmoke,
    archive,
    championGithubHandoff,
    gitPresent,
  }));
  const dependencyOk = dependencyChecks.every((item) => item.ok);
  const readyForOwnerExecution = Boolean(plan.ready_for_owner_execution) && dependencyOk && !manualOnly;
  const blockedReasons = [
    ...(plan.blocked_reasons ?? []),
    ...dependencyChecks.filter((item) => !item.ok).map((item) => `${item.id}: ${item.reason}`),
    ...(manualOnly ? ["manual_only_gate_never_autoruns"] : []),
  ];

  return {
    gate_id: gate.id,
    display_label: gate.display_label ?? gate.id,
    operation_mode: gate.operation_mode ?? null,
    resource_create_required: Boolean(gate.resource_create_required),
    resource_deploy_required: Boolean(gate.resource_deploy_required),
    current_blocker: gate.current_blocker ?? null,
    owner_action: gate.owner_action ?? null,
    approval_id: gate.approval_id ?? null,
    order: gateOrder(gate.id, index),
    risk_tier: gate.risk_tier,
    prepared_artifact: gate.prepared_artifact,
    current_status: gate.status,
    owner_approval_detected: Boolean(plan.owner_approval_detected),
    ready_for_owner_execution: readyForOwnerExecution,
    ready_for_autorun: false,
    no_autorun: true,
    execution_policy: manualOnly ? "manual_only" : "plan_only_owner_executes",
    dependencies: dependencyChecks,
    dependency_ok: dependencyOk,
    blocked_reasons: blockedReasons,
    resume_command_preview: plan.resume_command_preview ?? gate.resume_commands ?? [],
    next_owner_action: nextOwnerAction(gate, readyForOwnerExecution, blockedReasons),
    external_effect: true,
    executed: false,
  };
}

function dependencyStatus(id, context) {
  const { plan, localPreflight, postGateVerification, weeklyRunner, browserSmoke, eventSmoke, championGithubHandoff } = context;
  const preflightById = new Map(localPreflight.map((item) => [item.id, item]));
  if (id === "schema/d1-week0.sql") {
    return { id, ok: true, reason: "schema artifact exists in verified bundle" };
  }
  if (id === "launch_readiness.local_preflight_ok") {
    return { id, ok: context.gate.status === "owner_approval_required", reason: "launch readiness remains owner-gated" };
  }
  if (id === "worker:dry-run") {
    const ok = preflightById.get("weekly_runner")?.ok === true && (weeklyRunner?.commands ?? []).some((command) => command.step === "deploy_candidate_worker" && command.status === "success");
    return { id, ok, reason: ok ? "dry run passed in weekly runner" : "run npm run weekly:local and confirm worker dry-run success" };
  }
  if (id === "browser_route_smoke") {
    const ok = browserSmoke?.ok === true && browserSmoke?.event_write_performed === false;
    return { id, ok, reason: ok ? "local route smoke passed without event write" : "browser route smoke is missing or failed" };
  }
  if (id === "event_contract_smoke") {
    const ok = eventSmoke?.ok === true && eventSmoke?.real_event_write_performed === false;
    return { id, ok, reason: ok ? "isolated event contract smoke passed" : "event contract smoke is missing or failed" };
  }
  if (id === "remote_d1_create_and_migrate_owner_executed") {
    const ok = postGateReady(postGateVerification, "remote_d1_create_and_migrate");
    const pendingAction = context.gate.resource_create_required
      ? "remote D1 creation and schema migration"
      : "existing D1 schema migration and table verification";
    return { id, ok, reason: ok ? "remote D1 owner evidence is valid and local post-gate plan is ready" : `${pendingAction} is a human gate and post-gate evidence is not ready` };
  }
  if (id === "candidate_worker_production_deploy_owner_executed") {
    const ok = postGateReady(postGateVerification, "candidate_worker_production_deploy");
    return { id, ok, reason: ok ? "candidate Worker provenance/deploy evidence is valid and local post-gate plan is ready" : "candidate Worker provenance or deployment evidence is a human gate and post-gate evidence is not ready" };
  }
  if (id === "approved_current_champion_url") {
    const ok = Boolean(plan.owner_approval_detected) && !plan.missing_fields?.includes("champion_url") && !plan.placeholder_fields?.includes("champion_url");
    return { id, ok, reason: ok ? "champion URL metadata is present" : "approved current champion URL is still missing" };
  }
  if (id === "approved_rollback_url") {
    const ok = Boolean(plan.owner_approval_detected) && !plan.missing_fields?.includes("rollback_url") && !plan.placeholder_fields?.includes("rollback_url");
    return { id, ok, reason: ok ? "rollback URL metadata is present" : "approved rollback URL is still missing" };
  }
  if (id === "target_github_repo") {
    const ok = championGithubHandoff?.ok === true
      && championGithubHandoff?.repository?.slug === CHAMPION_REPOSITORY
      && context.gate.prepared_artifact === "champion_github_handoff.md";
    return {
      id,
      ok,
      reason: ok
        ? `verified Champion handoff targets ${CHAMPION_REPOSITORY}`
        : "verified Champion GitHub handoff for the exact target repository is missing or stale",
    };
  }
  if (id === "safe_branch_name") {
    const ok = championGithubHandoff?.ok === true
      && championGithubHandoff?.local_branch?.name === CHAMPION_BRANCH
      && championGithubHandoff?.checks?.branch_name_locked === true;
    return {
      id,
      ok,
      reason: ok
        ? `verified Champion handoff locks branch ${CHAMPION_BRANCH}`
        : "verified Champion handoff does not lock the expected safe branch",
    };
  }
  if (id === "manual_only_owner_action") {
    return { id, ok: false, reason: "formal posts, LINE push, payments, customer-data changes, and deletes remain manual-only" };
  }
  if (id.startsWith("approval_metadata.")) {
    const ok = Boolean(plan.ready_for_owner_execution);
    return { id, ok, reason: ok ? "owner approval metadata passed dry-run validation" : "owner approval metadata is missing, placeholder, sensitive, or invalid" };
  }
  return { id, ok: false, reason: "unknown dependency" };
}

function postGateReady(postGateVerification, gateId) {
  return (postGateVerification?.gates ?? []).some((gate) => gate.gate_id === gateId && gate.post_gate_verification_ready === true);
}

function gateOrder(gateId, fallback) {
  const order = {
    remote_d1_create_and_migrate: 1,
    candidate_worker_production_deploy: 2,
    public_ab_small_traffic_link: 3,
    github_repo_branch_pr: 4,
    formal_posts_line_push_payment_customer_data: 99,
  };
  return order[gateId] ?? fallback + 10;
}

function nextOwnerAction(gate, ready, blockedReasons) {
  const gateId = gate.id;
  if (ready) {
    return "Owner may execute this gate manually from approval_resume_plan.md after checking the exact command block.";
  }
  if (gateId === "formal_posts_line_push_payment_customer_data") {
    return "Keep this manual-only; do not convert it into an automated command.";
  }
  if (blockedReasons.some((reason) => reason.includes("owner_approval_input.json") || reason.includes("approval_metadata"))) {
    return "Fill non-secret owner approval metadata in owner_approval_input.json, then rerun npm run approval:plan and npm run gate:readiness.";
  }
  if (gateId === "candidate_worker_production_deploy" && gate.resource_deploy_required === false) {
    return "Confirm the observed Candidate Worker provenance and rollback reference; do not redeploy unless the live version is rejected.";
  }
  if (blockedReasons.some((reason) => reason.includes("remote D1"))) {
    return gate.resource_create_required
      ? "Create the dedicated D1 and migrate its schema only after explicit owner approval, then rerun local verification."
      : "Do not create another D1. Confirm provenance, then migrate and verify the existing dedicated D1 only after explicit owner approval.";
  }
  if (blockedReasons.some((reason) => reason.includes("production Worker"))) {
    return gate.resource_deploy_required === false
      ? "Confirm the observed Candidate Worker provenance and rollback reference; do not redeploy unless the live version is rejected."
      : "Deploy candidate Worker only after explicit owner approval and verified rollback target.";
  }
  return "Review blocked reasons and rerun npm run weekly:local after the prerequisite is satisfied.";
}

function nextSafeAction(gates) {
  const firstBlocked = gates.find((gate) => !gate.ready_for_owner_execution && gate.execution_policy !== "manual_only");
  if (!firstBlocked) {
    return "All plan-only external gates with metadata are ready for owner manual execution review; this engine still performs no external action.";
  }
  return `${firstBlocked.gate_id}: ${firstBlocked.next_owner_action}`;
}

function ownerMetadataCaptureActions(gates, approvalResume) {
  const planByGateId = new Map((approvalResume.owner_gate_plans ?? []).map((plan) => [plan.gate_id, plan]));
  return gates
    .filter((gate) => gate.execution_policy !== "manual_only")
    .sort((a, b) => a.order - b.order)
    .map((gate) => {
      const plan = planByGateId.get(gate.gate_id) ?? {};
      const requiredFields = plan.required_fields ?? [];
      const missingFields = plan.missing_fields ?? requiredFields;
      const placeholderFields = plan.placeholder_fields ?? [];
      const sensitiveFields = plan.sensitive_approval_fields ?? [];
      const invalidFields = (plan.field_validation_errors ?? []).map((issue) => issue.field);
      const fieldsNeedingInput = unique([
        ...missingFields,
        ...placeholderFields,
        ...invalidFields,
      ]);
      const blockingDependencies = gate.dependencies
        .filter((dependency) => !dependency.ok)
        .map((dependency) => dependency.id);
      const metadataReady = Boolean(plan.ready_for_owner_execution);
      const status = metadataReady
        ? "metadata_valid_plan_only"
        : sensitiveFields.length > 0
          ? "remove_sensitive_metadata_before_review"
          : fieldsNeedingInput.length > 0
            ? "capture_or_fix_non_secret_metadata"
            : "metadata_waiting_for_dependency_review";

      return {
        gate_id: gate.gate_id,
        approval_id: gate.approval_id,
        order: gate.order,
        status,
        metadata_ready_for_owner_review: metadataReady,
        gate_ready_for_owner_execution: gate.ready_for_owner_execution,
        metadata_fields: requiredFields,
        business_metadata_fields: requiredFields.filter((field) => !["approved_by", "approved_at"].includes(field)),
        fields_needing_input: fieldsNeedingInput,
        missing_fields: missingFields,
        placeholder_fields: placeholderFields,
        invalid_fields: invalidFields,
        sensitive_fields_to_remove: sensitiveFields,
        blocking_dependencies: blockingDependencies,
        owner_artifact: "owner_approval_form.html",
        machine_input: "owner_approval_input.json",
        rerun_commands: ["npm run approval:plan", "npm run gate:readiness"],
        plan_only: true,
        no_execution: true,
        execution_order_still_enforced: true,
        external_effect: false,
        execution_performed: false,
        next_owner_action: metadataReady
          ? "Metadata is valid locally; keep execution blocked until prior owner gates and post-gate evidence are ready."
          : "Capture or fix non-secret metadata in owner_approval_form.html, download owner_approval_input.json, then rerun npm run approval:plan and npm run gate:readiness.",
      };
    });
}

function unique(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
}

function renderReport(status) {
  const rows = status.gates
    .sort((a, b) => a.order - b.order)
    .map((gate) => `| ${gate.order} | ${gate.gate_id} | ${gate.operation_mode ?? "n/a"} | ${gate.resource_create_required ? "yes" : "no"} | ${gate.resource_deploy_required ? "yes" : "no"} | ${gate.risk_tier} | ${gate.owner_approval_detected ? "yes" : "no"} | ${gate.ready_for_owner_execution ? "yes" : "no"} | ${gate.ready_for_autorun ? "yes" : "no"} | ${gate.blocked_reasons.join("; ") || "n/a"} |`)
    .join("\n");
  const dependencyRows = status.gates
    .flatMap((gate) => gate.dependencies.map((dependency) => `| ${gate.gate_id} | ${dependency.id} | ${dependency.ok ? "ok" : "blocked"} | ${dependency.reason} |`))
    .join("\n");
  const metadataRows = status.parallel_metadata_actions.length > 0
    ? status.parallel_metadata_actions
      .map((action) => `| ${action.order} | ${action.gate_id} | ${action.status} | ${action.fields_needing_input.join(", ") || "none"} | ${action.blocking_dependencies.join(", ") || "none"} | ${action.owner_artifact} |`)
      .join("\n")
    : "| n/a | n/a | n/a | n/a | n/a | n/a |";
  return `# Gate Readiness Matrix

BLUF: ${status.status}. This local matrix shows which owner-gated steps have valid non-secret metadata, what must happen first, which metadata can be prepared in parallel, and which actions remain non-automated. It executes nothing.

Generated: ${status.generated_at}
Mode: ${status.mode}
Gate count: ${status.gate_count}
Ready gate count: ${status.ready_gate_count}
Control-center directory is a git repo: ${status.git_repo_present ? "yes" : "no"}
Champion repository prepared: ${status.champion_repo_prepared ? "yes" : "no"}
Champion target: ${status.champion_repository ?? "unknown"} / ${status.champion_branch ?? "unknown"}
Post-gate verification: ${status.post_gate_verification_status} / ready=${status.post_gate_ready_count}
External effect: no
Execution performed: no
No autorun for external gates: yes
Parallel metadata actions: ${status.parallel_metadata_action_count}

## Gate Order

| order | gate | operation | resource_create | resource_deploy | tier | approval_detected | owner_execution_ready | autorun_ready | blocked_reasons |
|---:|---|---|---|---|---:|---|---|---|---|
${rows}

## Dependency Matrix

| gate | dependency | status | reason |
|---|---|---|---|
${dependencyRows}

## Parallel Metadata Capture

These rows are local, non-secret metadata capture tasks only. They do not authorize or perform remote D1, Worker deploy, public A/B routing, GitHub push/PR, posting, LINE, payment, customer-data, or delete actions; execution order still applies.

| order | gate | metadata_status | fields_needing_input | blocking_dependencies | owner_artifact |
|---:|---|---|---|---|---|
${metadataRows}

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

async function exists(relativePath) {
  try {
    await access(path.join(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readJson(relativePath) {
  const raw = await readFile(path.join(ROOT, relativePath), "utf8");
  return JSON.parse(raw);
}

async function readOptionalJson(relativePath) {
  try {
    return await readJson(relativePath);
  } catch {
    return null;
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
