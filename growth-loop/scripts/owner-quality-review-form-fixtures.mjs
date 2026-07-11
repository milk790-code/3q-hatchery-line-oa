import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const FORM_STATUS_PATH = path.join(ROOT, "data", "owner_quality_review_form_status.json");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const STATUS_PATH = path.join(ROOT, "data", "owner_quality_review_form_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "owner_quality_review_form_fixture_report.md");

async function main() {
  const generatedAt = new Date();
  const formStatus = JSON.parse(await readFile(FORM_STATUS_PATH, "utf8"));
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "3q-owner-quality-review-form-fixtures-"));
  const realEventsBefore = await readOptional(REAL_EVENTS_PATH);
  const scenarios = [];

  for (const scenario of buildScenarios()) {
    scenarios.push(await runScenario(tempDir, scenario));
  }

  const realEventsAfter = await readOptional(REAL_EVENTS_PATH);
  const status = {
    ok: scenarios.every((scenario) => scenario.ok) && realEventsBefore === realEventsAfter,
    generated_at: generatedAt.toISOString(),
    mode: "owner_quality_review_form_fixture_dry_run",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    form_status_path: FORM_STATUS_PATH,
    temp_dir: tempDir,
    form_status: formStatus.status,
    form_download_filename: formStatus.download_filename,
    scenario_count: scenarios.length,
    scenario_ids: scenarios.map((scenario) => scenario.id),
    scenarios,
    local_fixture_commands_executed: true,
    form_export_replay_executed: true,
    owner_quality_review_commands_executed: true,
    real_events_unchanged: realEventsBefore === realEventsAfter,
    execution_performed: false,
    live_input_files_created: false,
    real_event_write_performed: false,
    data_lp_events_write_performed: false,
    approval_queue_write_performed: false,
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    promotion_performed: false,
    note: "Fixture-only replay of the quality-review browser form download. It writes temporary owner_quality_review.filled.json files, then verifies owner quality-review status without creating live inputs, appending data/lp_events.jsonl, editing approval_queue.json, promoting a challenger, changing public links, deploying, posting, pushing LINE, mutating customer data, touching payments, or deleting data.",
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildScenarios() {
  return [
    {
      id: "quality_form_export_waits_for_sample_rate_candidate",
      description: "The browser-downloaded JSON is valid, but sample-rate winner does not exist yet, so the quality review remains non-actionable.",
      sample: sampleGateStatus({ sampleRateWinCandidate: false }),
      input: qualityInput({ lead: 0.9, close: 0.9, spam: 0.01 }),
      expected: {
        exitCode: 0,
        status: "waiting_for_sample_rate_candidate",
        decision: "hold_quality_review_until_sample_rate_candidate",
        no_quality_regression: null,
        challenger_win_rule_met: false,
        promotion_review_queued: false,
      },
    },
    {
      id: "quality_form_export_pass_queues_owner_review",
      description: "The browser-downloaded JSON passes aggregate quality rules after a sample-rate win, so owner promotion review is queued only.",
      sample: sampleGateStatus({ sampleRateWinCandidate: true }),
      input: qualityInput({ lead: 0.9, close: 0.85, spam: 0.02 }),
      expected: {
        exitCode: 0,
        status: "owner_quality_review_passed_no_auto_promotion",
        decision: "queue_owner_promotion_review_no_auto_promotion",
        no_quality_regression: true,
        challenger_win_rule_met: true,
        promotion_review_queued: true,
      },
    },
    {
      id: "quality_form_export_regression_keeps_champion",
      description: "The browser-downloaded JSON is valid but shows quality regression, so the champion stays.",
      sample: sampleGateStatus({ sampleRateWinCandidate: true }),
      input: qualityInput({ lead: 0.9, close: 0.7, spam: 0.02 }),
      expected: {
        exitCode: 0,
        status: "owner_quality_review_failed_keep_champion",
        decision: "keep_champion_due_quality_regression",
        no_quality_regression: false,
        challenger_win_rule_met: false,
        promotion_review_queued: false,
        quality_regression_count_positive: true,
      },
    },
    {
      id: "quality_form_export_sensitive_notes_blocked",
      description: "Sensitive-looking values in the browser-downloaded JSON block owner quality review.",
      sample: sampleGateStatus({ sampleRateWinCandidate: true }),
      input: qualityInput({ notes: "line user id 12345", lead: 0.9, close: 0.9, spam: 0.01 }),
      expected: {
        exitCode: 1,
        status: "blocked_invalid_owner_quality_review",
        decision: "fix_owner_quality_review_input",
        no_quality_regression: false,
        challenger_win_rule_met: false,
        promotion_review_queued: false,
        issue_count_positive: true,
      },
    },
  ];
}

async function runScenario(tempDir, scenario) {
  const scenarioDir = path.join(tempDir, scenario.id);
  await mkdir(scenarioDir, { recursive: true });
  const sampleGatePath = path.join(scenarioDir, "owner_sample_gate_status.json");
  const inputPath = path.join(scenarioDir, "owner_quality_review.filled.json");
  const statusPath = path.join(scenarioDir, "owner_quality_review_status.json");
  const reportPath = path.join(scenarioDir, "owner_quality_review.md");
  const examplePath = path.join(scenarioDir, "owner_quality_review.example.json");

  await writeJson(sampleGatePath, scenario.sample);
  await writeJson(inputPath, scenario.input);

  const execution = await runNode([
    "scripts/owner-quality-review.mjs",
    `--owner-sample-gate=${sampleGatePath}`,
    `--input=${inputPath}`,
    `--status=${statusPath}`,
    `--report=${reportPath}`,
    `--example=${examplePath}`,
    `--real-events=${REAL_EVENTS_PATH}`,
  ]);
  const ownerStatus = await readOptionalJson(statusPath);
  const assertions = buildAssertions(scenario, ownerStatus, execution);

  return {
    id: scenario.id,
    ok: assertions.every((assertion) => assertion.ok),
    description: scenario.description,
    expected: scenario.expected,
    assertions,
    owner_exit_code: execution.exitCode,
    owner_status: ownerStatus?.status ?? "missing",
    owner_ok: Boolean(ownerStatus?.ok),
    owner_decision: ownerStatus?.decision ?? "missing",
    sample_rate_win_candidate: Boolean(ownerStatus?.sample_rate_win_candidate),
    quality_guard_status: ownerStatus?.quality_guard_status ?? "missing",
    no_quality_regression: ownerStatus?.no_quality_regression ?? null,
    challenger_win_rule_met: Boolean(ownerStatus?.challenger_win_rule_met),
    promotion_review_queued: Boolean(ownerStatus?.promotion_review_queued),
    promotion_performed: Boolean(ownerStatus?.promotion_performed),
    issue_count: ownerStatus?.issue_count ?? 0,
    quality_regression_count: ownerStatus?.quality_regression_count ?? 0,
    data_lp_events_write_performed: Boolean(ownerStatus?.data_lp_events_write_performed),
    approval_queue_write_performed: Boolean(ownerStatus?.approval_queue_write_performed),
    live_input_files_created: false,
    real_event_write_performed: false,
    external_effect: Boolean(ownerStatus?.external_effect),
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    temp_files: {
      sample_gate_path: sampleGatePath,
      input_path: inputPath,
      status_path: statusPath,
      report_path: reportPath,
      example_path: examplePath,
    },
  };
}

function buildAssertions(scenario, ownerStatus, execution) {
  const expected = scenario.expected;
  const assertions = [
    check("owner_exit_code", execution.exitCode === expected.exitCode, expected.exitCode, execution.exitCode),
    check("owner_status_written", Boolean(ownerStatus), "owner status json", ownerStatus ? "present" : "missing"),
    check("owner_status", ownerStatus?.status === expected.status, expected.status, ownerStatus?.status ?? "missing"),
    check("owner_decision", ownerStatus?.decision === expected.decision, expected.decision, ownerStatus?.decision ?? "missing"),
    check("no_quality_regression", ownerStatus?.no_quality_regression === expected.no_quality_regression, expected.no_quality_regression, ownerStatus?.no_quality_regression),
    check("challenger_win_rule_met", ownerStatus?.challenger_win_rule_met === expected.challenger_win_rule_met, expected.challenger_win_rule_met, ownerStatus?.challenger_win_rule_met),
    check("promotion_review_queued", ownerStatus?.promotion_review_queued === expected.promotion_review_queued, expected.promotion_review_queued, ownerStatus?.promotion_review_queued),
    check("no_promotion", ownerStatus?.promotion_performed === false, false, ownerStatus?.promotion_performed),
    check("no_real_event_write", ownerStatus?.data_lp_events_write_performed === false, false, ownerStatus?.data_lp_events_write_performed),
    check("no_approval_queue_write", ownerStatus?.approval_queue_write_performed === false, false, ownerStatus?.approval_queue_write_performed),
    check("no_external_effect", ownerStatus?.external_effect === false, false, ownerStatus?.external_effect),
  ];

  if (expected.issue_count_positive) {
    assertions.push(check("issue_count_positive", Number(ownerStatus?.issue_count ?? 0) > 0, ">0", ownerStatus?.issue_count ?? 0));
  } else {
    assertions.push(check("issue_count_zero", Number(ownerStatus?.issue_count ?? 0) === 0, 0, ownerStatus?.issue_count ?? 0));
  }

  if (expected.quality_regression_count_positive) {
    assertions.push(check("quality_regression_count_positive", Number(ownerStatus?.quality_regression_count ?? 0) > 0, ">0", ownerStatus?.quality_regression_count ?? 0));
  }

  return assertions;
}

function sampleGateStatus({ sampleRateWinCandidate }) {
  return {
    ok: true,
    generated_at: "2026-07-08T00:00:00.000Z",
    mode: "owner_sample_gate_status",
    status: sampleRateWinCandidate ? "sample_rate_win_needs_quality_review" : "waiting_for_owner_sample_gate_counts",
    sample_threshold_met: sampleRateWinCandidate,
    sample_rate_win_candidate: sampleRateWinCandidate,
    challenger_win_rule_met: false,
    quality_guard_status: "not_evaluated_from_sample_gate",
    decision: sampleRateWinCandidate ? "queue_owner_quality_review_no_auto_promotion" : "continue_collecting_sample_gate_counts",
    owner_review_required: sampleRateWinCandidate,
    promotion_performed: false,
    real_events_unchanged: true,
    live_input_files_created: false,
    data_lp_events_write_performed: false,
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };
}

function qualityInput({ lead = 0.9, close = 0.9, spam = 0.02, notes = "Aggregate-only fixture input." } = {}) {
  return {
    reviewer: "owner",
    pii_checked: "yes",
    evidence_ref: "aggregate-quality-review/form-fixture",
    lead_rate_retention_vs_champion: lead,
    close_rate_retention_vs_champion: close,
    spam_flag_rate: spam,
    low_quality_flag_count: 0,
    notes,
    generated_by: "owner_quality_review_form",
  };
}

async function runNode(args) {
  try {
    const { stdout, stderr } = await execFileAsync("node", args, {
      cwd: ROOT,
      maxBuffer: 1024 * 1024 * 8,
    });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    return {
      exitCode: Number.isInteger(error.code) ? error.code : 1,
      stdout: String(error.stdout ?? ""),
      stderr: String(error.stderr ?? error.message ?? ""),
    };
  }
}

function check(name, ok, expected, actual) {
  return { name, ok, expected, actual, external_effect: false };
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function readOptional(filePath) {
  try {
    await access(filePath);
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function renderReport(status) {
  const rows = status.scenarios
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "failed"} | ${scenario.owner_status} | ${scenario.owner_decision} | ${scenario.no_quality_regression === null ? "n/a" : scenario.no_quality_regression ? "yes" : "no"} | ${scenario.challenger_win_rule_met ? "yes" : "no"} | ${scenario.promotion_review_queued ? "yes" : "no"} | ${scenario.promotion_performed ? "yes" : "no"} | ${scenario.issue_count} | ${scenario.quality_regression_count} |`)
    .join("\n");

  return `# 3Q Growth Loop Owner Quality Review Form Fixture Report

BLUF: ${status.ok ? "owner_quality_review_form_fixture_ok" : "owner_quality_review_form_fixture_failed"}. This fixture proves the local browser form's downloaded JSON shape can replay through owner quality-review status without live input writes, real event writes, approval queue edits, external effects, or challenger promotion.

Generated: ${status.generated_at}
Mode: ${status.mode}
Form download filename: ${status.form_download_filename}
Scenarios: ${status.scenario_count}
Local fixture commands executed: ${status.local_fixture_commands_executed ? "yes" : "no"}
Form export replay executed: ${status.form_export_replay_executed ? "yes" : "no"}
Owner quality review commands executed: ${status.owner_quality_review_commands_executed ? "yes" : "no"}
Live input files created: no
data/lp_events.jsonl write performed: no
Approval queue write performed: no
External effect: no
Promotion performed: no

## Scenario Summary

| scenario | result | owner status | owner decision | no quality regression | final win rule | promotion review queued | promoted | issues | quality regressions |
|---|---|---|---|---|---|---|---|---:|---:|
${rows}

## Owner Boundary

All replay JSON files are temporary under \`${status.temp_dir}\`. The fixture does not create \`data/owner_quality_review.filled.json\`, does not append \`data/lp_events.jsonl\`, does not edit \`approval_queue.json\`, does not promote a challenger, and does not change public links.
`;
}

main();
