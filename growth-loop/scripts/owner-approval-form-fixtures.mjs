import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const HTML_PATH = path.join(ROOT, "owner_approval_form.html");
const FORM_STATUS_PATH = path.join(ROOT, "data", "owner_approval_form_status.json");
const STATUS_PATH = path.join(ROOT, "data", "owner_approval_form_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "owner_approval_form_fixture_report.md");
const EXAMPLE_INPUT_PATH = path.join(ROOT, "owner_approval_input.example.json");

const RED_LINE_FLAGS = {
  external_effect: false,
  data_lp_events_write_performed: false,
  public_link_change_performed: false,
  production_deploy_performed: false,
  github_push_or_pr_performed: false,
  formal_post_performed: false,
  line_push_performed: false,
  customer_data_mutation_performed: false,
  payment_action_performed: false,
  delete_action_performed: false,
};

async function main() {
  const generatedAt = new Date();
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });

  const html = await readFile(HTML_PATH, "utf8");
  const formStatus = JSON.parse(await readFile(FORM_STATUS_PATH, "utf8"));
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "3q-growth-loop-owner-approval-form-"));
  const scenarios = [
    staticContractScenario(html, formStatus),
    await approvalPlanScenario({
      id: "form_export_valid_github_plan_only",
      tempDir,
      input: {
        generated_at: generatedAt.toISOString(),
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
      expect: (status) => status.ready_gate_count === 1
        && status.status === "owner_approval_detected_plan_only"
        && status.external_effect === false
        && status.github_push_or_pr_performed === false,
    }),
    await approvalPlanScenario({
      id: "form_export_placeholder_blocked",
      tempDir,
      input: JSON.parse(await readFile(EXAMPLE_INPUT_PATH, "utf8")),
      expect: (status) => status.ready_gate_count === 0
        && status.status === "prepared_but_blocked"
        && status.external_effect === false,
    }),
    await approvalPlanScenario({
      id: "form_export_sensitive_value_blocked",
      tempDir,
      input: {
        generated_at: generatedAt.toISOString(),
        approvals: [
          {
            gate_id: "github_repo_branch_pr",
            approved_by: "Angelia",
            approved_at: generatedAt.toISOString(),
            repo_url: "https://github.com/milk790-code/3q-hatchery-line-oa.git",
            branch_name: "codex/3q-growth-loop-champion-v1",
            api_token: "ghp_sensitivefixturevalue12345",
          },
        ],
      },
      expect: (status) => status.ready_gate_count === 0
        && status.sensitive_approval_detected === true
        && status.external_effect === false,
    }),
  ];

  const contractChecks = [
    check("form_status_ok", formStatus.ok === true, "form status must be ok"),
    check("browser_only", formStatus.browser_only === true, "form must be browser-only"),
    check("no_network", formStatus.network_calls_performed === false, "form must not perform network calls"),
    check("no_live_input", formStatus.live_input_files_created === false, "form must not create live input files"),
    check("no_approval_write", formStatus.approval_input_write_performed === false, "form must not write owner_approval_input.json"),
    check("download_filename", formStatus.download_filename === "owner_approval_input.json", "download filename must match owner approval input"),
    check("manual_gate_excluded", formStatus.excluded_manual_gate_count >= 1, "manual-only gate must stay excluded from the form"),
    check("html_no_fetch", !/\bfetch\s*\(/.test(html), "form HTML must not call fetch"),
    check("html_no_xhr", !/XMLHttpRequest|sendBeacon/i.test(html), "form HTML must not call XHR or sendBeacon"),
    check("html_action_none", html.includes('action="none"'), "form action must be none"),
    check("html_external_false", html.includes('data-external-effect="false"'), "form must mark no external effect"),
  ];

  const ok = contractChecks.every((item) => item.ok) && scenarios.every((scenario) => scenario.ok);
  const status = {
    ok,
    generated_at: generatedAt.toISOString(),
    mode: "owner_approval_form_fixture_dry_run",
    scenario_count: scenarios.length,
    scenarios,
    contract_checks: contractChecks,
    form_export_replay_executed: true,
    approval_resume_commands_executed: true,
    live_input_files_created: false,
    approval_input_write_performed: false,
    execution_performed: false,
    temp_dir: tempDir,
    ...RED_LINE_FLAGS,
    note: "Fixture-only owner approval form guard. Uses temporary owner_approval_input shaped files and never writes live owner approval input or performs external actions.",
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));
  if (!ok) process.exitCode = 1;
}

function staticContractScenario(html, formStatus) {
  const checks = [
    check("mode", formStatus.mode === "owner_approval_form", "form mode must match"),
    check("gate_count", formStatus.form_gate_count === 4, "form must expose four automatable owner-gated metadata blocks"),
    check("no_form_submit", html.includes('action="none"'), "form must not submit"),
    check("no_network_api", !/\bfetch\s*\(|XMLHttpRequest|sendBeacon/i.test(html), "form must not call network APIs"),
    check("json_download", html.includes("owner_approval_input.json"), "form must download owner approval input JSON"),
  ];
  return {
    id: "form_static_contract",
    ok: checks.every((item) => item.ok),
    checks,
    external_effect: false,
  };
}

async function approvalPlanScenario({ id, tempDir, input, expect }) {
  const scenarioDir = path.join(tempDir, id);
  await mkdir(scenarioDir, { recursive: true });
  const inputPath = path.join(scenarioDir, "owner_approval_input.json");
  const statusPath = path.join(scenarioDir, "approval_resume_status.json");
  const planPath = path.join(scenarioDir, "approval_resume_plan.md");
  const examplePath = path.join(scenarioDir, "owner_approval_input.example.json");
  await writeJson(inputPath, input);

  const result = spawnSync(process.execPath, [
    "scripts/approval-resume-plan.mjs",
    `--input=${inputPath}`,
    `--status=${statusPath}`,
    `--plan=${planPath}`,
    `--example=${examplePath}`,
  ], {
    cwd: ROOT,
    encoding: "utf8",
  });

  let plannerStatus = null;
  let expectationOk = false;
  try {
    plannerStatus = JSON.parse(await readFile(statusPath, "utf8"));
    expectationOk = expect(plannerStatus);
  } catch {
    expectationOk = false;
  }

  return {
    id,
    ok: result.status === 0 && expectationOk,
    exit_code: result.status,
    ready_gate_count: plannerStatus?.ready_gate_count ?? null,
    status: plannerStatus?.status ?? "missing",
    sensitive_approval_detected: plannerStatus?.sensitive_approval_detected ?? null,
    external_effect: plannerStatus?.external_effect ?? false,
    github_push_or_pr_performed: plannerStatus?.github_push_or_pr_performed ?? false,
    production_deploy_performed: plannerStatus?.production_deploy_performed ?? false,
    public_link_change_performed: plannerStatus?.public_link_change_performed ?? false,
    live_input_files_created: false,
    stdout_bytes: result.stdout.length,
    stderr_bytes: result.stderr.length,
  };
}

function renderReport(status) {
  const rows = status.scenarios
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "failed"} | ${scenario.status ?? "n/a"} | ${scenario.ready_gate_count ?? "n/a"} | ${scenario.external_effect ? "yes" : "no"} |`)
    .join("\n");

  return `# Owner Approval Form Fixture Report

BLUF: ${status.ok ? "owner_approval_form_fixtures_ok" : "owner_approval_form_fixtures_failed"}.

Mode: ${status.mode}
Scenario count: ${status.scenario_count}
Form replay executed: ${status.form_export_replay_executed ? "yes" : "no"}
Approval resume commands executed: ${status.approval_resume_commands_executed ? "yes" : "no"}
Live owner approval input created: ${status.live_input_files_created ? "yes" : "no"}
Owner approval input write performed: ${status.approval_input_write_performed ? "yes" : "no"}
External effect: ${status.external_effect ? "yes" : "no"}
GitHub push / PR performed: ${status.github_push_or_pr_performed ? "yes" : "no"}
Production deploy performed: ${status.production_deploy_performed ? "yes" : "no"}
Public link change performed: ${status.public_link_change_performed ? "yes" : "no"}
LINE push performed: ${status.line_push_performed ? "yes" : "no"}
Payment action performed: ${status.payment_action_performed ? "yes" : "no"}
Customer data mutation performed: ${status.customer_data_mutation_performed ? "yes" : "no"}
Delete action performed: ${status.delete_action_performed ? "yes" : "no"}

| scenario | result | planner_status | ready_gate_count | external_effect |
|---|---|---|---:|---|
${rows}
`;
}

function check(name, ok, message) {
  return { name, ok, message, external_effect: false };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
