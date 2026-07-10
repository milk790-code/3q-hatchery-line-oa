import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const STATUS_PATH = path.join(ROOT, "data", "owner_quality_review_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "owner_quality_review_fixture_report.md");

async function main() {
  const generatedAt = new Date();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "3q-owner-quality-review-fixtures-"));
  const beforeRealEvents = await readOptional(REAL_EVENTS_PATH);
  const scenarios = [];

  for (const scenario of buildScenarios()) {
    scenarios.push(await runScenario(tempDir, scenario));
  }

  const afterRealEvents = await readOptional(REAL_EVENTS_PATH);
  const status = {
    ok: scenarios.every((scenario) => scenario.ok) && beforeRealEvents === afterRealEvents,
    generated_at: generatedAt.toISOString(),
    mode: "owner_quality_review_fixture_dry_run",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    temp_dir: tempDir,
    scenario_count: scenarios.length,
    scenarios,
    local_fixture_commands_executed: true,
    owner_quality_review_commands_executed: true,
    real_events_unchanged: beforeRealEvents === afterRealEvents,
    execution_performed: false,
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
    note: "Fixture-only owner quality-review contract. It uses temporary aggregate JSON inputs and never creates data/owner_quality_review.filled.json, writes data/lp_events.jsonl, changes approval_queue.json, promotes a challenger, deploys, posts, pushes LINE, mutates customer data, touches payments, or deletes data.",
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
      id: "waiting_for_sample_rate_candidate_no_input",
      description: "No sample-rate winner exists, so quality review stays idle.",
      sample: sampleGateStatus({ sampleRateWinCandidate: false }),
      missingInput: true,
      expected: {
        exitCode: 0,
        status: "waiting_for_sample_rate_candidate",
        decision: "wait_for_sample_rate_candidate",
        no_quality_regression: null,
        challenger_win_rule_met: false,
        promotion_review_queued: false,
        owner_review_required: false,
      },
    },
    {
      id: "sample_rate_win_waits_for_quality_evidence",
      description: "A sample-rate winner exists, but no quality evidence has been filled yet.",
      sample: sampleGateStatus({ sampleRateWinCandidate: true }),
      missingInput: true,
      expected: {
        exitCode: 0,
        status: "waiting_for_owner_quality_evidence",
        decision: "collect_owner_quality_review_evidence",
        no_quality_regression: null,
        challenger_win_rule_met: false,
        promotion_review_queued: false,
        owner_review_required: true,
      },
    },
    {
      id: "sample_rate_win_quality_pass_queues_review",
      description: "Aggregate quality evidence passes, so final promotion evidence is queued for owner review only.",
      sample: sampleGateStatus({ sampleRateWinCandidate: true }),
      input: qualityInput({ lead: 0.9, close: 0.85, spam: 0.02 }),
      expected: {
        exitCode: 0,
        status: "owner_quality_review_passed_no_auto_promotion",
        decision: "queue_owner_promotion_review_no_auto_promotion",
        no_quality_regression: true,
        challenger_win_rule_met: true,
        promotion_review_queued: true,
        owner_review_required: true,
      },
    },
    {
      id: "sample_rate_win_quality_regression_keeps_champion",
      description: "Valid aggregate evidence shows quality regression, so the champion remains in place.",
      sample: sampleGateStatus({ sampleRateWinCandidate: true }),
      input: qualityInput({ lead: 0.6, close: 0.9, spam: 0.02 }),
      expected: {
        exitCode: 0,
        status: "owner_quality_review_failed_keep_champion",
        decision: "keep_champion_due_quality_regression",
        no_quality_regression: false,
        challenger_win_rule_met: false,
        promotion_review_queued: false,
        owner_review_required: true,
      },
    },
    {
      id: "sensitive_evidence_blocks_review",
      description: "Sensitive-looking evidence references are rejected before any promotion review can be queued.",
      sample: sampleGateStatus({ sampleRateWinCandidate: true }),
      input: qualityInput({ evidence_ref: "owner@example.com", lead: 0.9, close: 0.9, spam: 0.01 }),
      expected: {
        exitCode: 1,
        status: "blocked_invalid_owner_quality_review",
        decision: "fix_owner_quality_review_input",
        no_quality_regression: false,
        challenger_win_rule_met: false,
        promotion_review_queued: false,
        owner_review_required: true,
        issue_count_positive: true,
      },
    },
    {
      id: "missing_required_fields_blocks_review",
      description: "Missing aggregate quality fields block the review input.",
      sample: sampleGateStatus({ sampleRateWinCandidate: true }),
      input: {
        reviewer: "owner",
        pii_checked: "yes",
        evidence_ref: "aggregate-quality-review/missing-fields",
        lead_rate_retention_vs_champion: 0.9,
        spam_flag_rate: 0.02,
      },
      expected: {
        exitCode: 1,
        status: "blocked_invalid_owner_quality_review",
        decision: "fix_owner_quality_review_input",
        no_quality_regression: false,
        challenger_win_rule_met: false,
        promotion_review_queued: false,
        owner_review_required: true,
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
  if (!scenario.missingInput) {
    await writeJson(inputPath, scenario.input);
  }

  const execution = await runNode([
    "scripts/owner-quality-review.mjs",
    `--owner-sample-gate=${sampleGatePath}`,
    `--input=${inputPath}`,
    `--status=${statusPath}`,
    `--report=${reportPath}`,
    `--example=${examplePath}`,
    `--real-events=${REAL_EVENTS_PATH}`,
  ]);
  const compact = await readOptionalJson(statusPath);
  const assertions = buildAssertions(scenario, compact, execution);

  return {
    id: scenario.id,
    ok: assertions.every((assertion) => assertion.ok),
    description: scenario.description,
    expected: scenario.expected,
    assertions,
    command_exit_code: execution.exitCode,
    status: compact?.status ?? "missing",
    decision: compact?.decision ?? "missing",
    input_exists: Boolean(compact?.input_exists),
    sample_rate_win_candidate: Boolean(compact?.sample_rate_win_candidate),
    owner_review_required: Boolean(compact?.owner_review_required),
    quality_guard_status: compact?.quality_guard_status ?? "missing",
    no_quality_regression: compact?.no_quality_regression ?? null,
    challenger_win_rule_met: Boolean(compact?.challenger_win_rule_met),
    promotion_review_queued: Boolean(compact?.promotion_review_queued),
    promotion_performed: Boolean(compact?.promotion_performed),
    issue_count: compact?.issue_count ?? 0,
    quality_regression_count: compact?.quality_regression_count ?? 0,
    real_events_unchanged: Boolean(compact?.real_events_unchanged),
    data_lp_events_write_performed: Boolean(compact?.data_lp_events_write_performed),
    approval_queue_write_performed: Boolean(compact?.approval_queue_write_performed),
    external_effect: Boolean(compact?.external_effect),
    temp_files: {
      sample_gate_path: sampleGatePath,
      input_path: inputPath,
      status_path: statusPath,
      report_path: reportPath,
      example_path: examplePath,
    },
  };
}

function buildAssertions(scenario, compact, execution) {
  const expected = scenario.expected;
  const assertions = [
    check("exit_code", execution.exitCode === expected.exitCode, expected.exitCode, execution.exitCode),
    check("status_written", Boolean(compact), "status json", compact ? "present" : "missing"),
    check("status", compact?.status === expected.status, expected.status, compact?.status ?? "missing"),
    check("decision", compact?.decision === expected.decision, expected.decision, compact?.decision ?? "missing"),
    check("no_quality_regression", compact?.no_quality_regression === expected.no_quality_regression, expected.no_quality_regression, compact?.no_quality_regression),
    check("challenger_win_rule_met", compact?.challenger_win_rule_met === expected.challenger_win_rule_met, expected.challenger_win_rule_met, compact?.challenger_win_rule_met),
    check("promotion_review_queued", compact?.promotion_review_queued === expected.promotion_review_queued, expected.promotion_review_queued, compact?.promotion_review_queued),
    check("owner_review_required", compact?.owner_review_required === expected.owner_review_required, expected.owner_review_required, compact?.owner_review_required),
    check("no_promotion", compact?.promotion_performed === false, false, compact?.promotion_performed),
    check("no_real_event_write", compact?.data_lp_events_write_performed === false, false, compact?.data_lp_events_write_performed),
    check("no_approval_queue_write", compact?.approval_queue_write_performed === false, false, compact?.approval_queue_write_performed),
    check("no_external_effect", compact?.external_effect === false, false, compact?.external_effect),
  ];

  if (expected.issue_count_positive) {
    assertions.push(check("issue_count_positive", Number(compact?.issue_count ?? 0) > 0, ">0", compact?.issue_count ?? 0));
  } else {
    assertions.push(check("issue_count_zero", Number(compact?.issue_count ?? 0) === 0, 0, compact?.issue_count ?? 0));
  }

  return assertions;
}

function sampleGateStatus({ sampleRateWinCandidate }) {
  return {
    ok: true,
    generated_at: "2026-07-08T00:00:00.000Z",
    mode: "owner_sample_gate_status",
    status: sampleRateWinCandidate ? "sample_rate_win_needs_quality_review" : "waiting_for_owner_sample_gate_counts",
    input_exists: sampleRateWinCandidate,
    filled_rows: sampleRateWinCandidate ? 18 : 0,
    pending_rows: sampleRateWinCandidate ? 0 : 18,
    issue_count: 0,
    warning_count: 0,
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

function qualityInput({ evidence_ref = "aggregate-quality-review/week0-cta-text", lead = 0.9, close = 0.9, spam = 0.02 } = {}) {
  return {
    reviewer: "owner",
    pii_checked: "yes",
    evidence_ref,
    lead_rate_retention_vs_champion: lead,
    close_rate_retention_vs_champion: close,
    spam_flag_rate: spam,
    low_quality_flag_count: 0,
    notes: "Aggregate-only fixture input.",
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
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "failed"} | ${scenario.status} | ${scenario.decision} | ${scenario.no_quality_regression === null ? "n/a" : scenario.no_quality_regression ? "yes" : "no"} | ${scenario.challenger_win_rule_met ? "yes" : "no"} | ${scenario.promotion_review_queued ? "yes" : "no"} | ${scenario.promotion_performed ? "yes" : "no"} | ${scenario.issue_count} |`)
    .join("\n");

  return `# 3Q Growth Loop Owner Quality Review Fixture Report

BLUF: ${status.ok ? "owner_quality_review_fixture_ok" : "owner_quality_review_fixture_failed"}. This fixture proves the aggregate quality-review gate handles waiting, missing evidence, passing evidence, quality regression, sensitive evidence, and missing fields without writing events or promoting challengers.

Generated: ${status.generated_at}
Mode: ${status.mode}
Scenarios: ${status.scenario_count}
Owner quality review commands executed: ${status.owner_quality_review_commands_executed ? "yes" : "no"}
data/lp_events.jsonl write performed: no
Approval queue write performed: no
External effect: no
Promotion performed: no

## Scenario Summary

| scenario | result | status | decision | no quality regression | final win rule | promotion review queued | promoted | issues |
|---|---|---|---|---|---|---|---|---:|
${rows}

## Owner Boundary

All files are temporary except this report and \`data/owner_quality_review_fixture_status.json\`. The fixture does not create \`data/owner_quality_review.filled.json\`, does not append \`data/lp_events.jsonl\`, does not edit \`approval_queue.json\`, and does not promote a challenger.
`;
}

main();
