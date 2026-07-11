import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "approval_resume_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "approval_resume_fixture_report.md");

async function main() {
  const generatedAt = new Date();
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "3q-growth-loop-approval-fixtures-"));
  const exampleInput = JSON.parse(await readFile(path.join(ROOT, "owner_approval_input.example.json"), "utf8"));
  const scenarios = [
    {
      id: "no_input_keeps_all_gates_blocked",
      input: null,
      expect: (status) =>
        status.status === "prepared_but_blocked" &&
        status.input_exists === false &&
        status.ready_gate_count === 0 &&
        flagsSafe(status),
    },
    {
      id: "copied_example_placeholders_block_ready_state",
      input: exampleInput,
      expect: (status) =>
        status.ready_gate_count === 0 &&
        status.owner_gate_plans.some((gate) => gate.placeholder_fields.length > 0) &&
        flagsSafe(status),
    },
    {
      id: "valid_github_gate_becomes_plan_only_ready",
      input: {
        approvals: [
          {
            gate_id: "github_repo_branch_pr",
            approved_by: "Angelia",
            approved_at: generatedAt.toISOString(),
            repo_url: "https://github.com/milk790-code/3q-hatchery-line-oa.git",
            branch_name: "codex/3q-growth-loop-champion-v1",
          },
        ],
      },
      expect: (status) => {
        const gate = status.owner_gate_plans.find((item) => item.gate_id === "github_repo_branch_pr");
        return status.status === "owner_approval_detected_plan_only" &&
          status.ready_gate_count === 1 &&
          gate?.ready_for_owner_execution === true &&
          flagsSafe(status);
      },
    },
    {
      id: "sensitive_approval_value_blocks_gate",
      input: {
        approvals: [
          {
            gate_id: "github_repo_branch_pr",
            approved_by: "Angelia",
            approved_at: generatedAt.toISOString(),
            repo_url: "https://github.com/milk790-code/3q-hatchery-line-oa.git",
            branch_name: "codex/3q-growth-loop-champion-v1",
            api_key: "sk-1234567890abcdef1234567890abcdef",
          },
        ],
      },
      expect: (status) => {
        const gate = status.owner_gate_plans.find((item) => item.gate_id === "github_repo_branch_pr");
        return status.sensitive_approval_detected === true &&
          status.ready_gate_count === 0 &&
          gate?.sensitive_approval_fields.includes("api_key") &&
          flagsSafe(status);
      },
    },
    {
      id: "public_ab_requires_absolute_champion_url",
      input: {
        approvals: [
          {
            gate_id: "public_ab_small_traffic_link",
            approved_by: "Angelia",
            approved_at: generatedAt.toISOString(),
            champion_url: "/current-main-link",
            public_surface: "small-test-surface",
            rollback_url: "https://rollback.invalid/current",
          },
        ],
      },
      expect: (status) => {
        const gate = status.owner_gate_plans.find((item) => item.gate_id === "public_ab_small_traffic_link");
        return status.ready_gate_count === 0 &&
          gate?.blocked_reasons.includes("champion_url must be an absolute http(s) URL.") &&
          flagsSafe(status);
      },
    },
    {
      id: "manual_only_gate_never_becomes_automated",
      input: {
        approvals: [
          {
            gate_id: "formal_posts_line_push_payment_customer_data",
            approved_by: "Angelia",
            approved_at: generatedAt.toISOString(),
          },
        ],
      },
      expect: (status) => {
        const gate = status.owner_gate_plans.find((item) => item.gate_id === "formal_posts_line_push_payment_customer_data");
        return status.ready_gate_count === 0 &&
          gate?.ready_for_owner_execution === false &&
          gate?.blocked_reasons.some((reason) => reason.includes("gate_status=manual_only")) &&
          flagsSafe(status);
      },
    },
    {
      id: "invalid_d1_metadata_blocks_remote_gate",
      input: {
        approvals: [
          {
            gate_id: "remote_d1_create_and_migrate",
            approved_by: "Angelia",
            approved_at: generatedAt.toISOString(),
            cloudflare_account_alias: "main-account",
            d1_database_name: "bad_name_with_underscore",
            d1_database_id: "not-a-uuid",
          },
        ],
      },
      expect: (status) => {
        const gate = status.owner_gate_plans.find((item) => item.gate_id === "remote_d1_create_and_migrate");
        return status.ready_gate_count === 0 &&
          gate?.blocked_reasons.includes("d1_database_id must be a UUID-like Cloudflare D1 database id.") &&
          gate?.blocked_reasons.includes("d1_database_name must be a safe Cloudflare resource name.") &&
          flagsSafe(status);
      },
    },
    {
      id: "invalid_worker_url_blocks_deploy_gate",
      input: {
        approvals: [
          {
            gate_id: "candidate_worker_production_deploy",
            approved_by: "Angelia",
            approved_at: generatedAt.toISOString(),
            worker_name: "3q-growth-loop-candidate",
            worker_url: "worker.local/health",
            rollback_plan: "Rollback through the Cloudflare dashboard.",
          },
        ],
      },
      expect: (status) => {
        const gate = status.owner_gate_plans.find((item) => item.gate_id === "candidate_worker_production_deploy");
        return status.ready_gate_count === 0 &&
          gate?.blocked_reasons.includes("worker_url must be an absolute http(s) URL.") &&
          flagsSafe(status);
      },
    },
    {
      id: "invalid_github_metadata_blocks_pr_gate",
      input: {
        approvals: [
          {
            gate_id: "github_repo_branch_pr",
            approved_by: "Angelia",
            approved_at: generatedAt.toISOString(),
            repo_url: "https://example.com/not-github/repo.git",
            branch_name: "bad branch name",
          },
        ],
      },
      expect: (status) => {
        const gate = status.owner_gate_plans.find((item) => item.gate_id === "github_repo_branch_pr");
        return status.ready_gate_count === 0 &&
          gate?.blocked_reasons.includes("repo_url must be a GitHub repository URL.") &&
          gate?.blocked_reasons.includes("branch_name must be a safe git branch name.") &&
          flagsSafe(status);
      },
    },
    {
      id: "wrong_valid_github_target_blocks_pr_gate",
      input: {
        approvals: [
          {
            gate_id: "github_repo_branch_pr",
            approved_by: "Angelia",
            approved_at: generatedAt.toISOString(),
            repo_url: "https://github.com/milk790-code/3q-growth-loop.git",
            branch_name: "ang/3q-growth-loop-week0",
          },
        ],
      },
      expect: (status) => {
        const gate = status.owner_gate_plans.find((item) => item.gate_id === "github_repo_branch_pr");
        return status.ready_gate_count === 0 &&
          gate?.blocked_reasons.includes("repo_url must target milk790-code/3q-hatchery-line-oa for the prepared Champion commit.") &&
          gate?.blocked_reasons.includes("branch_name must match codex/3q-growth-loop-champion-v1.") &&
          flagsSafe(status);
      },
    },
    {
      id: "invalid_approval_timestamp_blocks_gate",
      input: {
        approvals: [
          {
            gate_id: "github_repo_branch_pr",
            approved_by: "Angelia",
            approved_at: "07/08/2026 09:00",
            repo_url: "https://github.com/milk790-code/3q-hatchery-line-oa.git",
            branch_name: "codex/3q-growth-loop-champion-v1",
          },
        ],
      },
      expect: (status) => {
        const gate = status.owner_gate_plans.find((item) => item.gate_id === "github_repo_branch_pr");
        return status.ready_gate_count === 0 &&
          gate?.blocked_reasons.includes("approved_at must be an ISO datetime string.") &&
          flagsSafe(status);
      },
    },
  ];

  const results = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(tmpDir, scenario));
  }

  const status = {
    ok: results.every((result) => result.ok),
    generated_at: generatedAt.toISOString(),
    mode: "approval_resume_fixture_dry_run",
    temp_dir: tmpDir,
    scenario_count: results.length,
    scenarios: results,
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
    note: "Fixture-only approval resume contract. It uses temporary owner approval inputs and never executes external commands.",
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
  const inputPath = path.join(scenarioDir, "owner_approval_input.json");
  const statusPath = path.join(scenarioDir, "approval_resume_status.json");
  const planPath = path.join(scenarioDir, "approval_resume_plan.md");
  const examplePath = path.join(scenarioDir, "owner_approval_input.example.json");

  if (scenario.input) {
    await writeJson(inputPath, scenario.input);
  }

  const args = [
    "scripts/approval-resume-plan.mjs",
    `--input=${inputPath}`,
    `--status=${statusPath}`,
    `--plan=${planPath}`,
    `--example=${examplePath}`,
  ];
  const command = ["node", ...args].join(" ");
  const { stdout, stderr } = await execFileAsync("node", args, { cwd: ROOT });
  const status = JSON.parse(await readFile(statusPath, "utf8"));
  const ok = scenario.expect(status);

  return {
    id: scenario.id,
    ok,
    command,
    status_path: statusPath,
    plan_path: planPath,
    stdout_bytes: stdout.length,
    stderr_bytes: stderr.length,
    ready_gate_count: status.ready_gate_count,
    status: status.status,
    sensitive_approval_detected: status.sensitive_approval_detected,
    execution_performed: status.execution_performed,
    external_effect: status.external_effect,
    gate_summary: status.owner_gate_plans.map((gate) => ({
      gate_id: gate.gate_id,
      ready_for_owner_execution: gate.ready_for_owner_execution,
      owner_approval_detected: gate.owner_approval_detected,
      missing_fields: gate.missing_fields,
      placeholder_fields: gate.placeholder_fields,
      sensitive_approval_fields: gate.sensitive_approval_fields,
      field_validation_errors: gate.field_validation_errors,
      blocked_reasons: gate.blocked_reasons,
      executed: gate.executed,
      execution_policy: gate.execution_policy,
    })),
  };
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
    status.owner_gate_plans.every((gate) => gate.executed === false && gate.execution_policy === "dry_run_plan_only");
}

function renderReport(status) {
  const rows = status.scenarios
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "fail"} | ${scenario.status} | ${scenario.ready_gate_count} | ${scenario.sensitive_approval_detected ? "yes" : "no"} | ${scenario.external_effect ? "yes" : "no"} |`)
    .join("\n");
  return `# Approval Resume Fixture Report

BLUF: ${status.ok ? "approval_resume_fixtures_ok" : "approval_resume_fixtures_failed"}。Fixture-only dry run for owner approval input handling. No external command is executed.

Generated: ${status.generated_at}
Mode: ${status.mode}
Scenarios: ${status.scenario_count}
Execution performed: no
External effect: no

| scenario | status | resume_status | ready_gates | sensitive_detected | external_effect |
|---|---|---|---:|---|---|
${rows}

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
