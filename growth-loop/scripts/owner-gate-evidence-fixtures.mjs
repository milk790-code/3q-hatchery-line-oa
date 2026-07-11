import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "owner_gate_evidence_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "owner_gate_evidence_fixture_report.md");

async function main() {
  const generatedAt = new Date();
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "3q-growth-loop-owner-evidence-fixtures-"));
  const exampleInput = JSON.parse(await readFile(path.join(ROOT, "owner_gate_evidence.example.json"), "utf8"));
  const githubHandoff = JSON.parse(await readFile(path.join(ROOT, "data", "champion_github_handoff_status.json"), "utf8"));
  const preparedCommitRef = githubHandoff.local_branch?.commit;
  if (!/^[0-9a-f]{40}$/.test(preparedCommitRef ?? "")) throw new Error("Prepared Champion commit is unavailable for fixtures.");
  const scenarios = buildScenarios(generatedAt, exampleInput, preparedCommitRef);
  const results = [];

  for (const scenario of scenarios) {
    results.push(await runScenario(tmpDir, scenario));
  }

  const status = {
    ok: results.every((result) => result.ok),
    generated_at: generatedAt.toISOString(),
    mode: "owner_gate_evidence_fixture_dry_run",
    temp_dir: tmpDir,
    scenario_count: results.length,
    local_fixture_commands_executed: true,
    owner_gate_evidence_fixture_executed: true,
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
    note: "Fixture-only owner gate evidence contract. It uses temporary evidence inputs and never executes external commands.",
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildScenarios(generatedAt, exampleInput, preparedCommitRef) {
  return [
    {
      id: "no_input_waits_for_owner_evidence",
      input: null,
      expect: (status) =>
        status.ok === true &&
        status.status === "waiting_for_owner_evidence" &&
        status.input_exists === false &&
        status.ready_gate_count === 0 &&
        flagsSafe(status),
    },
    {
      id: "copied_example_placeholders_block_evidence",
      input: exampleInput,
      expect: (status) =>
        status.ok === false &&
        status.status === "blocked_invalid_owner_evidence" &&
        status.ready_gate_count < nonManualGateIds().length &&
        status.gates.some((gate) => gate.placeholder_fields.length > 0) &&
        flagsSafe(status),
    },
    {
      id: "valid_remote_d1_evidence_enables_post_gate_plan",
      input: {
        evidence: [remoteD1Evidence(generatedAt)],
      },
      expect: (status) => {
        const gate = gateById(status, "remote_d1_create_and_migrate");
        return status.ok === true &&
          status.status === "partial_owner_evidence_validated" &&
          status.ready_gate_count === 1 &&
          gate?.ready_for_post_gate_verification === true &&
          flagsSafe(status);
      },
    },
    {
      id: "remote_d1_without_recurring_read_approval_keeps_schema_evidence_valid",
      input: {
        evidence: [{ ...remoteD1Evidence(generatedAt), recurring_aggregate_read_approved: false }],
      },
      expect: (status) => {
        const gate = gateById(status, "remote_d1_create_and_migrate");
        return status.ok === true
          && status.ready_gate_count === 1
          && gate?.evidence_valid === true
          && gate?.ready_for_post_gate_verification === true
          && gate?.recurring_aggregate_read_approved === false
          && gate?.blocked_reasons.length === 0
          && flagsSafe(status);
      },
    },
    {
      id: "valid_all_non_manual_evidence_ready_for_post_gate_verification",
      input: {
        evidence: [
          remoteD1Evidence(generatedAt),
          workerEvidence(generatedAt),
          publicAbEvidence(generatedAt),
          githubEvidence(generatedAt, preparedCommitRef),
        ],
      },
      expect: (status) =>
        status.ok === true &&
        status.status === "owner_evidence_validated_ready_for_post_gate_verification" &&
        status.ready_for_post_gate_verification === true &&
        status.ready_gate_count === 4 &&
        nonManualGateIds().every((gateId) => gateById(status, gateId)?.ready_for_post_gate_verification === true) &&
        flagsSafe(status),
    },
    {
      id: "sensitive_or_customer_evidence_blocks_gate",
      input: {
        evidence: [
          {
            ...workerEvidence(generatedAt),
            customer_email: "buyer@example.test",
          },
        ],
      },
      expect: (status) => {
        const gate = gateById(status, "candidate_worker_production_deploy");
        return status.ok === false &&
          status.sensitive_evidence_detected === true &&
          status.ready_gate_count === 0 &&
          gate?.blocked_reasons.some((reason) => reason.includes("sensitive_or_customer_fields")) &&
          flagsSafe(status);
      },
    },
    {
      id: "invalid_public_ab_evidence_blocks_route",
      input: {
        evidence: [
          {
            ...publicAbEvidence(generatedAt),
            champion_url: "http://insecure.test/current",
            traffic_share_challenger: 25,
          },
        ],
      },
      expect: (status) => {
        const gate = gateById(status, "public_ab_small_traffic_link");
        return status.ok === false &&
          status.ready_gate_count === 0 &&
          gate?.blocked_reasons.includes("champion_url must be an absolute https URL.") &&
          gate?.blocked_reasons.includes("traffic_share_challenger must be a number from 1 to 10.") &&
          flagsSafe(status);
      },
    },
    {
      id: "duplicate_and_unknown_gate_evidence_blocks_input",
      input: {
        evidence: [
          remoteD1Evidence(generatedAt),
          remoteD1Evidence(generatedAt),
          {
            gate_id: "unknown_gate",
            operator_alias: "owner",
            executed_at: generatedAt.toISOString(),
          },
        ],
      },
      expect: (status) =>
        status.ok === false &&
        status.ready_gate_count === 1 &&
        status.invalid_evidence_issues.some((issue) => issue.code === "duplicate_gate_id") &&
        status.invalid_evidence_issues.some((issue) => issue.code === "unknown_gate_id") &&
        flagsSafe(status),
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
      expect: (status) => {
        const gate = gateById(status, "formal_posts_line_push_payment_customer_data");
        return status.ok === true &&
          status.ready_gate_count === 0 &&
          gate?.evidence_valid === true &&
          gate?.ready_for_post_gate_verification === false &&
          gate?.execution_policy === "manual_only_no_autorun" &&
          flagsSafe(status);
      },
    },
    {
      id: "invalid_github_evidence_blocks_review",
      input: {
        evidence: [
          {
            ...githubEvidence(generatedAt, preparedCommitRef),
            repo_url: "https://example.test/not-github/repo.git",
            pr_url: "https://github.com/milk790-code/3q-growth-loop/issues/1",
            branch_name: "bad branch name",
            commit_ref: "not-a-sha",
          },
        ],
      },
      expect: (status) => {
        const gate = gateById(status, "github_repo_branch_pr");
        return status.ok === false &&
          status.ready_gate_count === 0 &&
          gate?.blocked_reasons.includes("repo_url must be a GitHub repository URL.") &&
          gate?.blocked_reasons.includes("pr_url must be a GitHub pull request URL.") &&
          gate?.blocked_reasons.includes("branch_name must be a safe git branch name.") &&
          gate?.blocked_reasons.includes("commit_ref must be a 7 to 64 character git SHA.") &&
          flagsSafe(status);
      },
    },
  ];
}

async function runScenario(tmpDir, scenario) {
  const scenarioDir = path.join(tmpDir, scenario.id);
  await mkdir(scenarioDir, { recursive: true });
  const inputPath = path.join(scenarioDir, "owner_gate_evidence.json");
  const statusPath = path.join(scenarioDir, "owner_gate_evidence_status.json");
  const reportPath = path.join(scenarioDir, "owner_gate_evidence.md");
  const examplePath = path.join(scenarioDir, "owner_gate_evidence.example.json");

  if (scenario.input) {
    await writeJson(inputPath, scenario.input);
  }

  const args = [
    "scripts/owner-gate-evidence.mjs",
    `--input=${inputPath}`,
    `--status=${statusPath}`,
    `--report=${reportPath}`,
    `--example=${examplePath}`,
  ];
  const command = ["node", ...args].join(" ");
  const result = await execOwnerEvidence(args);
  const status = JSON.parse(await readFile(statusPath, "utf8"));
  const ok = scenario.expect(status);

  return {
    id: scenario.id,
    ok,
    command,
    exit_code: result.exitCode,
    status_path: statusPath,
    report_path: reportPath,
    stdout_bytes: result.stdout.length,
    stderr_bytes: result.stderr.length,
    intake_status: status.status,
    ready_gate_count: status.ready_gate_count,
    evidence_gate_count: status.evidence_gate_count,
    issue_count: status.issue_count,
    sensitive_evidence_detected: status.sensitive_evidence_detected,
    execution_performed: status.execution_performed,
    external_effect: status.external_effect,
    gate_summary: status.gates.map((gate) => ({
      gate_id: gate.gate_id,
      evidence_detected: gate.evidence_detected,
      evidence_valid: gate.evidence_valid,
      ready_for_post_gate_verification: gate.ready_for_post_gate_verification,
      recurring_aggregate_read_approved: gate.recurring_aggregate_read_approved,
      manual_only: gate.manual_only,
      missing_fields: gate.missing_fields,
      placeholder_fields: gate.placeholder_fields,
      unknown_fields: gate.unknown_fields,
      sensitive_or_customer_fields: gate.sensitive_or_customer_fields,
      field_validation_errors: gate.field_validation_errors,
      blocked_reasons: gate.blocked_reasons,
      execution_policy: gate.execution_policy,
      executed_by_this_script: gate.executed_by_this_script,
    })),
  };
}

async function execOwnerEvidence(args) {
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
  return status.execution_performed === false &&
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
    status.gates.every((gate) => gate.evidence_intake_external_effect === false && gate.executed_by_this_script === false);
}

function renderReport(status) {
  const rows = status.scenarios
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "fail"} | ${scenario.intake_status} | ${scenario.ready_gate_count} | ${scenario.issue_count} | ${scenario.sensitive_evidence_detected ? "yes" : "no"} | ${scenario.external_effect ? "yes" : "no"} |`)
    .join("\n");

  return `# Owner Gate Evidence Fixture Report

BLUF: ${status.ok ? "owner_gate_evidence_fixtures_ok" : "owner_gate_evidence_fixtures_failed"}。Fixture-only dry run for post-owner-gate evidence handling. No external command is executed.

Generated: ${status.generated_at}
Mode: ${status.mode}
Scenarios: ${status.scenario_count}
Local fixture commands executed: yes
Execution performed: no
External effect: no

| scenario | status | intake_status | ready_gates | issues | sensitive_detected | external_effect |
|---|---|---|---:|---:|---|---|
${rows}

## Coverage

- Missing evidence keeps the system waiting.
- Copied placeholder examples do not unlock the full non-manual gate set.
- Valid remote D1 schema evidence opens only post-gate verification planning; recurring aggregate reads remain separately scoped.
- Valid non-manual evidence opens post-gate verification planning but does not execute external checks.
- Sensitive or customer fields are rejected.
- Invalid public A/B URLs or traffic shares are rejected.
- Duplicate or unknown gate evidence is rejected.
- Manual-only acknowledgement never becomes automation.
- Invalid GitHub repo, PR, branch, and commit evidence is rejected.

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

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
