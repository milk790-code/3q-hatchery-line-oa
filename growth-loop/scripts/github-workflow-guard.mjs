import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const WORKFLOW_PATH = path.join(ROOT, "..", ".github", "workflows", "3q-growth-loop-weekly.yml");
const PACKAGE_PATH = path.join(ROOT, "package.json");
const OUTPUT_JSON = path.join(ROOT, "github_workflow_guard.json");
const OUTPUT_MD = path.join(ROOT, "github_workflow_guard.md");
const STATUS_PATH = path.join(ROOT, "data", "github_workflow_guard_status.json");

const REQUIRED_ARTIFACTS = [
  "weekly_report.md",
  "growth_scores.json",
  "approval_queue.json",
  "ab_test_status.json",
  "worker_dry_run.md",
  "cloudflare_d1_readiness.md",
  "data/cloudflare_d1_readiness_status.json",
  "data/cloudflare_d1_inventory_snapshot.json",
  "live_telemetry_readiness.md",
  "data/live_telemetry_readiness_status.json",
  "data/live_telemetry_observation_snapshot.json",
  "live_telemetry_readiness_fixture_report.md",
  "data/live_telemetry_readiness_fixture_status.json",
  "champion_source_lock_fixtures.md",
  "data/champion_source_lock_fixture_status.json",
  "weekly_runner_lock_fixtures.md",
  "data/weekly_runner_lock_fixture_status.json",
  "d1_schema_contract.md",
  "data/d1_schema_contract_status.json",
  "approved_d1_config.md",
  "data/approved_d1_config_status.json",
  "champion_local_branch.md",
  "data/champion_local_branch_status.json",
  "champion_release_preflight.md",
  "data/champion_release_preflight_status.json",
  "data/champion_live_deployment_snapshot.json",
  "champion_release_owner_packet.md",
  "champion_release_owner_packet.json",
  "champion_github_handoff.md",
  "champion_github_pr_body.md",
  "data/champion_github_handoff_status.json",
  "data/worker_dry_run_status.json",
  "prepared_but_blocked.json",
  "objective_sequence_audit.md",
  "d1_collection_guard.md",
  "github_export_manifest.md",
  "owner_approval_pack.md",
  "sample_gate_collection_sprint.md",
  "sample_gate_collection_sprint.json",
  "data/sample_gate_collection_sprint_status.json",
  "source_trust_matrix.md",
  "source_trust_matrix.json",
  "data/source_trust_matrix_status.json",
  "artifact_retention_review_pack.md",
  "artifact_retention_review_pack.json",
  "data/artifact_retention_review_status.json",
  "data/weekly_runner_status.json",
  "data/gate_readiness_status.json",
];

const FORBIDDEN_WORKFLOW_PATTERNS = [
  ["wrangler_deploy", /\bwrangler\s+deploy\b/i],
  ["worker_deploy_script", /npm\s+run\s+worker:deploy/i],
  ["git_write", /\bgit\s+(push|commit|tag|remote\s+add)\b/i],
  ["gh_pr_create", /\bgh\s+pr\s+create\b/i],
  ["secret_context", /\$\{\{\s*secrets\.|\bsecrets\./i],
  ["line_or_payment_secret", /\b(LINE_CHANNEL|ECPAY|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|API_KEY)\b/i],
  ["mutating_network_tool", /\b(curl|ssh|scp|rsync)\b/i],
  ["macos_runner", /runs-on:\s*macos-latest/i],
  ["macos_launchctl", /\blaunchctl\b/i],
  ["launchagent_status_in_ci", /schedule:status|schedule:install|schedule:uninstall/i],
  ["weekly_local_in_ci", /npm\s+run\s+weekly:local/i],
];

const FORBIDDEN_VERIFY_PATTERNS = [
  ["remote_d1_export", /collect:d1:remote:approved/],
  ["funnel_apply", /import:funnel:apply/],
  ["manual_apply", /import:manual:apply/],
  ["schedule_install", /schedule:install/],
  ["schedule_uninstall", /schedule:uninstall/],
  ["schedule_status_macos_readback", /schedule:status/],
  ["worker_deploy", /worker:deploy/],
  ["approved_d1_config_apply", /d1:config:apply/],
  ["champion_branch_prepare", /champion:branch:prepare/],
];

async function main() {
  const generatedAt = new Date();
  const workflow = await readFile(WORKFLOW_PATH, "utf8");
  const packageJson = JSON.parse(await readFile(PACKAGE_PATH, "utf8"));
  const verifyScript = packageJson.scripts?.verify ?? "";

  const checks = [
    check("workflow_title", workflow.includes("name: 3Q Growth Loop Weekly Verification"), "workflow has expected title"),
    check("manual_dispatch", workflow.includes("workflow_dispatch:"), "workflow supports manual dispatch"),
    check("sunday_taipei_cron", workflow.includes('cron: "10 16 * * 6"'), "workflow cron is Sunday 00:10 Asia/Taipei"),
    check("ubuntu_runner", /runs-on:\s*ubuntu-latest/.test(workflow), "workflow runs on ubuntu-latest for artifact verification only"),
    check("read_only_contents", /permissions:\s*\n\s*contents:\s*read/.test(workflow), "workflow uses contents: read only"),
    check("npm_ci", /\bnpm ci\b/.test(workflow), "workflow installs with npm ci"),
    check("runs_verify_only", /\bnpm run verify\b/.test(workflow) && !/\bnpm run weekly:local\b/.test(workflow), "workflow runs verify, not weekly:local"),
    check("uploads_artifacts", workflow.includes("actions/upload-artifact@v4"), "workflow uploads review artifacts"),
    check("artifact_missing_policy", workflow.includes("if-no-files-found: error"), "artifact upload fails if review files are missing"),
    check("retention_bounded", /retention-days:\s*14/.test(workflow), "artifact retention is bounded"),
    ...REQUIRED_ARTIFACTS.map((artifact) =>
      check(`artifact_${slug(artifact)}`, workflow.includes(artifact), `workflow uploads ${artifact}`),
    ),
    ...FORBIDDEN_WORKFLOW_PATTERNS.map(([id, pattern]) =>
      check(`no_${id}`, !pattern.test(workflow), `workflow must not match forbidden pattern ${id}`),
    ),
    check("verify_script_exists", typeof verifyScript === "string" && verifyScript.length > 0, "package.json exposes verify script"),
    check("verify_includes_artifact_verifier", verifyScript.includes("node scripts/verify-artifacts.mjs"), "verify ends with artifact verifier"),
    ...FORBIDDEN_VERIFY_PATTERNS.map(([id, pattern]) =>
      check(`verify_no_${id}`, !pattern.test(verifyScript), `verify script must not run ${id}`),
    ),
  ];

  const forbiddenMatches = checks.filter((item) => !item.ok);
  const payload = {
    ok: forbiddenMatches.length === 0,
    generated_at: generatedAt.toISOString(),
    mode: "github_workflow_guard_local_only",
    workflow_path: relative(WORKFLOW_PATH),
    package_path: relative(PACKAGE_PATH),
    status_path: relative(STATUS_PATH),
    report_path: relative(OUTPUT_MD),
    workflow_runs_verify_only: /\bnpm run verify\b/.test(workflow) && !/\bnpm run weekly:local\b/.test(workflow),
    workflow_uses_read_only_permissions: /permissions:\s*\n\s*contents:\s*read/.test(workflow),
    workflow_uploads_review_artifacts: REQUIRED_ARTIFACTS.every((artifact) => workflow.includes(artifact)),
    workflow_avoids_macos_launchagent_readback: !/launchctl|schedule:status|schedule:install|schedule:uninstall|npm\s+run\s+weekly:local/i.test(workflow),
    verify_avoids_owner_apply_or_external_gates: FORBIDDEN_VERIFY_PATTERNS.every(([, pattern]) => !pattern.test(verifyScript)),
    required_artifact_count: REQUIRED_ARTIFACTS.length,
    check_count: checks.length,
    failed_check_count: forbiddenMatches.length,
    failed_checks: forbiddenMatches.map((item) => item.name),
    checks,
    external_effect: false,
    git_init_performed: false,
    git_add_performed: false,
    git_commit_performed: false,
    git_remote_add_performed: false,
    git_push_or_pr_performed: false,
    github_push_or_pr_performed: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    note: "Local GitHub workflow safety guard only. It reads workflow/package files and never runs git, GitHub writes, deploys, posts, LINE, payments, customer-data mutation, or deletion.",
  };

  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeFile(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(STATUS_PATH, `${JSON.stringify(compactStatus(payload), null, 2)}\n`);
  await writeFile(OUTPUT_MD, renderReport(payload));
  console.log(JSON.stringify(compactStatus(payload), null, 2));

  if (!payload.ok) {
    process.exitCode = 1;
  }
}

function compactStatus(payload) {
  return {
    ok: payload.ok,
    generated_at: payload.generated_at,
    mode: payload.mode,
    workflow_path: payload.workflow_path,
    package_path: payload.package_path,
    report_path: payload.report_path,
    check_count: payload.check_count,
    failed_check_count: payload.failed_check_count,
    failed_checks: payload.failed_checks,
    workflow_runs_verify_only: payload.workflow_runs_verify_only,
    workflow_uses_read_only_permissions: payload.workflow_uses_read_only_permissions,
    workflow_uploads_review_artifacts: payload.workflow_uploads_review_artifacts,
    workflow_avoids_macos_launchagent_readback: payload.workflow_avoids_macos_launchagent_readback,
    verify_avoids_owner_apply_or_external_gates: payload.verify_avoids_owner_apply_or_external_gates,
    external_effect: false,
    git_init_performed: false,
    git_add_performed: false,
    git_commit_performed: false,
    git_remote_add_performed: false,
    git_push_or_pr_performed: false,
    github_push_or_pr_performed: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };
}

function renderReport(payload) {
  const rows = payload.checks
    .map((item) => `| ${item.name} | ${item.ok ? "ok" : "fail"} | ${item.message} |`)
    .join("\n");

  return `# GitHub Workflow Guard

BLUF: ${payload.ok ? "github_workflow_guard_ok" : "github_workflow_guard_failed"}. The weekly GitHub workflow is review-only: it runs \`npm run verify\`, uploads artifacts, and avoids deploys, GitHub writes, secrets, LINE/payment actions, and macOS LaunchAgent readback.

Generated: ${payload.generated_at}
Mode: ${payload.mode}
Workflow: ${payload.workflow_path}
Checks: ${payload.check_count}
Failed checks: ${payload.failed_check_count}

## Contract

- Runs verify only: ${payload.workflow_runs_verify_only ? "yes" : "no"}
- Read-only contents permission: ${payload.workflow_uses_read_only_permissions ? "yes" : "no"}
- Uploads review artifacts: ${payload.workflow_uploads_review_artifacts ? "yes" : "no"}
- Avoids macOS LaunchAgent readback in CI: ${payload.workflow_avoids_macos_launchagent_readback ? "yes" : "no"}
- Verify avoids owner apply or external gates: ${payload.verify_avoids_owner_apply_or_external_gates ? "yes" : "no"}

## Checks

| check | status | message |
|---|---|---|
${rows}

## Safety

- External effect: no
- Git push / PR performed: no
- Production deploy performed: no
- Public link change performed: no
- Formal post performed: no
- LINE push performed: no
- Customer-data mutation performed: no
- Payment action performed: no
- Delete action performed: no
`;
}

function check(name, ok, message) {
  return { name, ok: Boolean(ok), message, external_effect: false };
}

function slug(value) {
  return value.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

function relative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join(path.posix.sep);
}

main().catch(async (error) => {
  const status = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "github_workflow_guard_local_only",
    error: error instanceof Error ? error.message : "unknown_error",
    external_effect: false,
    github_push_or_pr_performed: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
