import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "post_gate_verification_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "post_gate_verification_fixture_report.md");

async function main() {
  const generatedAt = new Date();
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "3q-growth-loop-post-gate-fixtures-"));
  const githubHandoff = JSON.parse(await readFile(path.join(ROOT, "data", "champion_github_handoff_status.json"), "utf8"));
  const preparedCommitRef = githubHandoff.local_branch?.commit;
  if (!/^[0-9a-f]{40}$/.test(preparedCommitRef ?? "")) throw new Error("Prepared Champion commit is unavailable for fixtures.");
  const scenarios = buildScenarios(generatedAt, preparedCommitRef);
  const results = [];

  for (const scenario of scenarios) {
    results.push(await runScenario(tmpDir, scenario));
  }

  const status = {
    ok: results.every((result) => result.ok),
    generated_at: generatedAt.toISOString(),
    mode: "post_gate_verification_fixture_dry_run",
    temp_dir: tmpDir,
    scenario_count: results.length,
    local_fixture_commands_executed: true,
    owner_gate_evidence_fixture_executed: true,
    post_gate_verification_fixture_executed: true,
    execution_performed: false,
    external_effect: false,
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
    scenarios: results,
    note: "Fixture-only post-gate verification contract. It uses temporary owner evidence statuses and never performs network reads, remote CLI, deploy, GitHub writes, public link changes, LINE actions, payments, customer-data mutation, or deletion.",
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildScenarios(generatedAt, preparedCommitRef) {
  return [
    {
      id: "waiting_for_owner_evidence_stays_plan_only",
      input: null,
      expect: ({ postGate }) =>
        postGate.ok === true &&
        postGate.status === "waiting_for_owner_evidence" &&
        postGate.ready_gate_count === 0 &&
        flagsSafe(postGate),
    },
    {
      id: "remote_d1_evidence_ready_only",
      input: {
        evidence: [remoteD1Evidence(generatedAt)],
      },
      expect: ({ postGate }) => {
        const gate = gateById(postGate, "remote_d1_create_and_migrate");
        return postGate.ok === true &&
          postGate.status === "partial_post_gate_verification_plan_ready" &&
          postGate.ready_gate_count === 1 &&
          gate?.post_gate_verification_ready === true &&
          gate?.safe_to_run_automatically === false &&
          flagsSafe(postGate);
      },
    },
    {
      id: "remote_d1_without_recurring_read_approval_allows_schema_plan_only",
      input: {
        evidence: [{ ...remoteD1Evidence(generatedAt), recurring_aggregate_read_approved: false }],
      },
      expect: ({ ownerEvidence, postGate }) => {
        const gate = gateById(postGate, "remote_d1_create_and_migrate");
        return ownerEvidence.ok === true &&
          postGate.ok === true &&
          postGate.status === "partial_post_gate_verification_plan_ready" &&
          postGate.ready_gate_count === 1 &&
          gate?.recurring_aggregate_read_approved === false &&
          gate?.owner_evidence_valid === true &&
          gate?.post_gate_verification_ready === true &&
          flagsSafe(postGate);
      },
    },
    {
      id: "worker_evidence_requires_remote_d1_ready",
      input: {
        evidence: [workerEvidence(generatedAt)],
      },
      expect: ({ postGate }) => {
        const gate = gateById(postGate, "candidate_worker_production_deploy");
        return postGate.ok === true &&
          postGate.ready_gate_count === 0 &&
          gate?.owner_evidence_valid === true &&
          gate?.post_gate_verification_ready === false &&
          gate?.blocked_reasons.some((reason) => reason.includes("remote_d1_evidence_ready")) &&
          flagsSafe(postGate);
      },
    },
    {
      id: "public_ab_requires_worker_evidence_ready",
      input: {
        evidence: [remoteD1Evidence(generatedAt), publicAbEvidence(generatedAt)],
      },
      expect: ({ postGate }) => {
        const gate = gateById(postGate, "public_ab_small_traffic_link");
        return postGate.ok === true &&
          postGate.ready_gate_count === 1 &&
          gate?.owner_evidence_valid === true &&
          gate?.post_gate_verification_ready === false &&
          gate?.blocked_reasons.some((reason) => reason.includes("candidate_worker_evidence_ready")) &&
          flagsSafe(postGate);
      },
    },
    {
      id: "github_evidence_ready_plan_only",
      input: {
        evidence: [githubEvidence(generatedAt, preparedCommitRef)],
      },
      expect: ({ postGate }) => {
        const gate = gateById(postGate, "github_repo_branch_pr");
        return postGate.ok === true &&
          postGate.ready_gate_count === 1 &&
          gate?.post_gate_verification_ready === true &&
          gate?.safe_to_run_automatically === false &&
          gate?.github_push_or_pr_performed === false &&
          flagsSafe(postGate);
      },
    },
    {
      id: "all_non_manual_evidence_ready_plan_only",
      input: {
        evidence: [
          remoteD1Evidence(generatedAt),
          workerEvidence(generatedAt),
          publicAbEvidence(generatedAt),
          githubEvidence(generatedAt, preparedCommitRef),
        ],
      },
      expect: ({ postGate }) =>
        postGate.ok === true &&
        postGate.status === "post_gate_verification_plan_ready" &&
        postGate.ready_gate_count === 4 &&
        postGate.ready_for_post_gate_read_only_verification === true &&
        nonManualGateIds().every((gateId) => gateById(postGate, gateId)?.post_gate_verification_ready === true) &&
        flagsSafe(postGate),
    },
    {
      id: "manual_only_acknowledgement_never_opens_post_gate",
      input: {
        evidence: [
          {
            gate_id: "formal_posts_line_push_payment_customer_data",
            operator_alias: "owner",
            executed_at: generatedAt.toISOString(),
            manual_only_acknowledged: true,
            notes_ref: "Manual-only action stayed outside automation.",
          },
        ],
      },
      expect: ({ postGate }) => {
        const gate = gateById(postGate, "formal_posts_line_push_payment_customer_data");
        return postGate.ok === true &&
          postGate.ready_gate_count === 0 &&
          gate?.manual_only === true &&
          gate?.post_gate_verification_ready === false &&
          gate?.safe_to_run_automatically === false &&
          flagsSafe(postGate);
      },
    },
    {
      id: "invalid_owner_evidence_blocks_post_verify",
      input: {
        evidence: [
          {
            ...workerEvidence(generatedAt),
            customer_email: "buyer@example.test",
          },
        ],
      },
      expect: ({ ownerEvidence, postGate }) =>
        ownerEvidence.ok === false &&
        postGate.ok === false &&
        postGate.status === "blocked_invalid_owner_evidence" &&
        postGate.ready_gate_count === 0 &&
        flagsSafe(postGate),
    },
  ];
}

async function runScenario(tmpDir, scenario) {
  const scenarioDir = path.join(tmpDir, scenario.id);
  await mkdir(scenarioDir, { recursive: true });
  const evidenceInputPath = path.join(scenarioDir, "owner_gate_evidence.json");
  const ownerEvidenceStatusPath = path.join(scenarioDir, "owner_gate_evidence_status.json");
  const ownerEvidenceReportPath = path.join(scenarioDir, "owner_gate_evidence.md");
  const ownerEvidenceExamplePath = path.join(scenarioDir, "owner_gate_evidence.example.json");
  const postGateStatusPath = path.join(scenarioDir, "post_gate_verification_status.json");
  const postGateReportPath = path.join(scenarioDir, "post_gate_verification.md");

  if (scenario.input) {
    await writeJson(evidenceInputPath, scenario.input);
  }

  const ownerEvidenceArgs = [
    "scripts/owner-gate-evidence.mjs",
    `--input=${evidenceInputPath}`,
    `--status=${ownerEvidenceStatusPath}`,
    `--report=${ownerEvidenceReportPath}`,
    `--example=${ownerEvidenceExamplePath}`,
  ];
  const ownerEvidenceResult = await execNode(ownerEvidenceArgs);
  const ownerEvidence = JSON.parse(await readFile(ownerEvidenceStatusPath, "utf8"));

  const postGateArgs = [
    "scripts/post-gate-verification.mjs",
    `--owner-evidence=${ownerEvidenceStatusPath}`,
    `--status=${postGateStatusPath}`,
    `--report=${postGateReportPath}`,
  ];
  const postGateResult = await execNode(postGateArgs);
  const postGate = JSON.parse(await readFile(postGateStatusPath, "utf8"));
  const ok = scenario.expect({ ownerEvidence, postGate });

  return {
    id: scenario.id,
    ok,
    owner_evidence_command: ["node", ...ownerEvidenceArgs].join(" "),
    post_gate_command: ["node", ...postGateArgs].join(" "),
    owner_evidence_exit_code: ownerEvidenceResult.exitCode,
    post_gate_exit_code: postGateResult.exitCode,
    owner_evidence_status_path: ownerEvidenceStatusPath,
    post_gate_status_path: postGateStatusPath,
    post_gate_report_path: postGateReportPath,
    owner_evidence_status: ownerEvidence.status,
    post_gate_status: postGate.status,
    ready_gate_count: postGate.ready_gate_count,
    non_manual_gate_count: postGate.non_manual_gate_count,
    no_network_read_performed: postGate.no_network_read_performed,
    no_remote_cli_performed: postGate.no_remote_cli_performed,
    no_actual_evidence_values_persisted: postGate.no_actual_evidence_values_persisted,
    execution_performed: postGate.execution_performed,
    external_effect: postGate.external_effect,
    gate_summary: postGate.gates.map((gate) => ({
      gate_id: gate.gate_id,
      manual_only: gate.manual_only,
      owner_evidence_detected: gate.owner_evidence_detected,
      owner_evidence_valid: gate.owner_evidence_valid,
      recurring_aggregate_read_approved: gate.recurring_aggregate_read_approved,
      post_gate_verification_ready: gate.post_gate_verification_ready,
      safe_to_run_automatically: gate.safe_to_run_automatically,
      read_only_followup_required: gate.read_only_followup_required,
      execution_policy: gate.execution_policy,
      blocked_reasons: gate.blocked_reasons,
      external_effect: gate.external_effect,
      execution_performed: gate.execution_performed,
    })),
  };
}

async function execNode(args) {
  try {
    const { stdout, stderr } = await execFileAsync("node", args, { cwd: ROOT });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    return {
      exitCode: typeof error.code === "number" ? error.code : 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? String(error.message ?? error),
    };
  }
}

function remoteD1Evidence(generatedAt) {
  return {
    gate_id: "remote_d1_create_and_migrate",
    operator_alias: "owner",
    executed_at: generatedAt.toISOString(),
    cloudflare_account_alias: "3q-main-account",
    d1_database_name: "3q-growth-loop-candidate",
    d1_database_id: "11111111-1111-4111-8111-111111111111",
    schema_applied_at: generatedAt.toISOString(),
    recurring_aggregate_read_approved: true,
    verification_ref: "wrangler remote count check, aggregate only",
    rollback_ref: "Cloudflare dashboard owner review only",
  };
}

function workerEvidence(generatedAt) {
  return {
    gate_id: "candidate_worker_production_deploy",
    operator_alias: "owner",
    executed_at: generatedAt.toISOString(),
    worker_name: "3q-growth-loop-candidate",
    worker_url: "https://3q-growth-loop-candidate.milk790.workers.dev",
    health_status: "ok",
    verification_ref: "GET /health returned ok",
    rollback_ref: "Cloudflare dashboard rollback to previous owner-approved version",
  };
}

function publicAbEvidence(generatedAt) {
  return {
    gate_id: "public_ab_small_traffic_link",
    operator_alias: "owner",
    executed_at: generatedAt.toISOString(),
    champion_url: "https://3q-growth-loop.invalid/current-main",
    public_surface: "owner-approved-small-traffic-surface",
    ab_url: "https://3q-growth-loop-candidate.milk790.workers.dev/ab/ab-week0-cta-text-001",
    traffic_share_challenger: 10,
    rollback_url: "https://3q-growth-loop.invalid/current-main",
    verification_ref: "Manual surface checked; no primary bio link change",
  };
}

function githubEvidence(generatedAt, preparedCommitRef) {
  return {
    gate_id: "github_repo_branch_pr",
    operator_alias: "owner",
    executed_at: generatedAt.toISOString(),
    repo_url: "https://github.com/milk790-code/3q-hatchery-line-oa.git",
    branch_name: "codex/3q-growth-loop-champion-v1",
    pr_url: "https://github.com/milk790-code/3q-hatchery-line-oa/pull/1",
    commit_ref: preparedCommitRef,
  };
}

function nonManualGateIds() {
  return [
    "remote_d1_create_and_migrate",
    "candidate_worker_production_deploy",
    "public_ab_small_traffic_link",
    "github_repo_branch_pr",
  ];
}

function gateById(status, gateId) {
  return status.gates.find((gate) => gate.gate_id === gateId);
}

function flagsSafe(status) {
  return status.no_network_read_performed === true &&
    status.no_remote_cli_performed === true &&
    status.no_actual_evidence_values_persisted === true &&
    status.execution_performed === false &&
    status.external_effect === false &&
    status.remote_d1_create_performed === false &&
    status.remote_d1_migration_performed === false &&
    status.production_deploy_performed === false &&
    status.public_link_change_performed === false &&
    status.github_push_or_pr_performed === false &&
    status.formal_post_performed === false &&
    status.line_push_performed === false &&
    status.customer_data_mutation_performed === false &&
    status.payment_action_performed === false &&
    status.delete_action_performed === false &&
    status.gates.every((gate) =>
      gate.safe_to_run_automatically === false &&
      gate.external_effect === false &&
      gate.execution_performed === false
    );
}

function renderReport(status) {
  const rows = status.scenarios
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "fail"} | ${scenario.owner_evidence_status} | ${scenario.post_gate_status} | ${scenario.ready_gate_count}/${scenario.non_manual_gate_count} | ${scenario.no_network_read_performed ? "no" : "attention"} | ${scenario.no_remote_cli_performed ? "no" : "attention"} | ${scenario.external_effect ? "yes" : "no"} |`)
    .join("\n");

  return `# Post-Gate Verification Fixture Report

BLUF: ${status.ok ? "post_gate_verification_fixtures_ok" : "post_gate_verification_fixtures_failed"}。Fixture-only dry run for owner-evidence post-gate planning. No network read, remote CLI, deploy, GitHub write, public link change, LINE action, payment, customer-data mutation, or delete is performed.

Generated: ${status.generated_at}
Mode: ${status.mode}
Scenarios: ${status.scenario_count}
Local fixture commands executed: yes
Execution performed: no
External effect: no

| scenario | status | owner_evidence | post_gate_status | ready_gates | network_read | remote_cli | external_effect |
|---|---|---|---|---:|---|---|---|
${rows}

## Coverage

- Missing owner evidence keeps post-gate verification waiting.
- Remote D1 evidence can open only a read-only follow-up plan.
- Remote D1 schema evidence can become plan-ready while recurring aggregate reads remain separately disabled.
- Candidate Worker post-gate verification depends on owner-ready remote D1 evidence.
- Public A/B post-gate verification depends on owner-ready Candidate Worker evidence.
- GitHub evidence can open only a review plan, never a push or PR action.
- All non-manual evidence can make the plan ready but still not automatic.
- Manual-only acknowledgement never becomes automated post-gate verification.
- Invalid or sensitive owner evidence blocks post-gate verification.

## Safety Invariants

- Network read performed: no
- Remote CLI performed: no
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

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
