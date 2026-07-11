import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const FORM_HTML_PATH = path.join(ROOT, "manual_publish_evidence_form.html");
const FORM_STATUS_PATH = path.join(ROOT, "data", "manual_publish_evidence_form_status.json");
const EVIDENCE_SCRIPT = path.join(ROOT, "scripts", "manual-publish-evidence.mjs");
const PACKET_PATH = path.join(ROOT, "manual_publish_packet.json");
const CAPTURE_PLAN_PATH = path.join(ROOT, "manual_publish_capture_plan.json");
const STATUS_PATH = path.join(ROOT, "data", "manual_publish_evidence_form_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "manual_publish_evidence_form_fixture_report.md");

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
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "3q-manual-publish-evidence-form-fixtures-"));
  const [html, formStatus, packet] = await Promise.all([
    readFile(FORM_HTML_PATH, "utf8"),
    readJson(FORM_STATUS_PATH),
    readJson(PACKET_PATH),
  ]);
  const firstPacket = packet.packets[0];

  const contractChecks = [
    check("form_status_ok", formStatus.ok === true, "form status must be ok"),
    check("browser_only", formStatus.browser_only === true, "form must be browser-only"),
    check("no_network_calls", formStatus.network_calls_performed === false, "form must perform no network calls"),
    check("no_url_fetch", formStatus.post_url_fetch_performed === false, "form must not fetch post URLs"),
    check("no_fetch_in_html", !/\bfetch\s*\(/.test(html), "HTML must not call fetch"),
    check("no_xhr_or_beacon", !/XMLHttpRequest|sendBeacon/i.test(html), "HTML must not call XHR or sendBeacon"),
    check("form_action_none", html.includes('action="none"'), "form action must be none"),
    check("download_filename", html.includes("manual_publish_evidence.json"), "form must download manual_publish_evidence.json"),
    check("no_live_input_created", formStatus.live_input_files_created === false, "form must not create live owner input"),
  ];

  const today = taipeiDateString(generatedAt);
  const recentPublishedDate = addDaysTaipeiDate(today, -1);
  const scenarios = [
    {
      id: "form_export_valid_recent_waits_until_day3",
      input: evidenceObject(firstPacket, recentPublishedDate),
      expectOk: true,
      expectStatus: "waiting_until_day_3",
    },
    {
      id: "form_export_valid_old_ready_for_day7",
      input: evidenceObject(firstPacket, addDaysTaipeiDate(today, -8)),
      expectOk: true,
      expectStatus: "ready_for_day_7_counts",
    },
    {
      id: "form_export_sensitive_post_ref_blocked",
      input: {
        evidence: [
          {
            ...evidenceObject(firstPacket, recentPublishedDate).evidence[0],
            post_ref: "customer_name Wang phone=0912",
          },
        ],
      },
      expectOk: false,
      expectStatus: "blocked_invalid_manual_publish_evidence",
    },
    {
      id: "form_export_missing_pii_check_blocked",
      input: {
        evidence: [
          {
            ...evidenceObject(firstPacket, recentPublishedDate).evidence[0],
            pii_checked: false,
          },
        ],
      },
      expectOk: false,
      expectStatus: "blocked_invalid_manual_publish_evidence",
    },
  ];

  const results = [];
  for (const scenario of scenarios) {
    results.push(await runScenario({ tempDir, scenario }));
  }

  const ok = contractChecks.every((item) => item.ok) && results.every((item) => item.ok);
  const status = {
    ok,
    generated_at: generatedAt.toISOString(),
    mode: "manual_publish_evidence_form_fixture_dry_run",
    form_status_path: FORM_STATUS_PATH,
    form_html_path: FORM_HTML_PATH,
    temp_dir: tempDir,
    scenario_count: results.length,
    contract_checks: contractChecks,
    scenarios: results,
    local_fixture_commands_executed: true,
    form_export_replay_executed: true,
    evidence_intake_commands_executed: true,
    live_input_files_created: false,
    execution_performed: false,
    ...RED_LINE_FLAGS,
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) {
    process.exitCode = 1;
  }
}

async function runScenario({ tempDir, scenario }) {
  const scenarioDir = path.join(tempDir, scenario.id);
  await mkdir(scenarioDir, { recursive: true });
  const inputPath = path.join(scenarioDir, "manual_publish_evidence.json");
  const statusPath = path.join(scenarioDir, "manual_publish_evidence_status.json");
  const reportPath = path.join(scenarioDir, "manual_publish_evidence.md");
  const examplePath = path.join(scenarioDir, "manual_publish_evidence.example.json");
  await writeJson(inputPath, scenario.input);

  const result = spawnSync(process.execPath, [
    EVIDENCE_SCRIPT,
    `--input=${inputPath}`,
    `--status=${statusPath}`,
    `--report=${reportPath}`,
    `--example=${examplePath}`,
    `--packet=${PACKET_PATH}`,
    `--capture-plan=${CAPTURE_PLAN_PATH}`,
  ], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const status = await readJson(statusPath);
  const ok = status.ok === scenario.expectOk
    && status.status === scenario.expectStatus
    && status.external_effect === false
    && status.formal_post_performed === false
    && status.line_push_performed === false
    && status.public_link_change_performed === false
    && status.production_deploy_performed === false
    && status.github_push_or_pr_performed === false
    && status.customer_data_mutation_performed === false
    && status.payment_action_performed === false
    && status.delete_action_performed === false
    && status.data_lp_events_write_performed === false;

  return {
    id: scenario.id,
    ok,
    exit_code: result.status,
    expected_ok: scenario.expectOk,
    status_ok: status.ok,
    expected_status: scenario.expectStatus,
    status: status.status,
    issue_count: status.issue_count,
    input_exists: status.input_exists,
    evidence_count: status.evidence_count,
    active_packet_id: status.active_packet_id,
    day_3_capture_date: status.day_3_capture_date,
    day_7_capture_date: status.day_7_capture_date,
    stdout_bytes: result.stdout.length,
    stderr_bytes: result.stderr.length,
    external_effect: status.external_effect,
    formal_post_performed: status.formal_post_performed,
    line_push_performed: status.line_push_performed,
    public_link_change_performed: status.public_link_change_performed,
    production_deploy_performed: status.production_deploy_performed,
    github_push_or_pr_performed: status.github_push_or_pr_performed,
    customer_data_mutation_performed: status.customer_data_mutation_performed,
    payment_action_performed: status.payment_action_performed,
    delete_action_performed: status.delete_action_performed,
    data_lp_events_write_performed: status.data_lp_events_write_performed,
  };
}

function evidenceObject(packet, dateString) {
  return {
    evidence: [
      {
        packet_id: packet.packet_id,
        published_at: `${dateString}T09:00:00+08:00`,
        surface: "Facebook Page manual post",
        post_ref: "local screenshot ref or public post URL",
        reviewer: "Angelia",
        manual_publish_confirmed: true,
        pii_checked: true,
        published_packet_only: true,
      },
    ],
  };
}

function check(name, ok, message) {
  return { name, ok, message, external_effect: false };
}

function renderReport(status) {
  const contractRows = status.contract_checks.map((item) =>
    `| ${item.name} | ${item.ok ? "ok" : "fail"} | ${item.message} |`
  ).join("\n");
  const scenarioRows = status.scenarios.map((scenario) =>
    `| ${scenario.id} | ${scenario.ok ? "ok" : "fail"} | ${scenario.status} | ${scenario.issue_count} | ${scenario.data_lp_events_write_performed ? "yes" : "no"} |`
  ).join("\n");
  return `# Manual Publish Evidence Form Fixtures

BLUF: ${status.ok ? "manual_publish_evidence_form_fixtures_ok" : "manual_publish_evidence_form_fixtures_failed"}. These fixtures verify the browser-only form contract and replay form-shaped evidence JSON through the local evidence intake.

Generated: ${status.generated_at}
Mode: ${status.mode}
Scenarios: ${status.scenario_count}
Execution performed: no
External effect: no
Formal post performed: no
LINE push performed: no
Public link change performed: no
Production deploy performed: no
GitHub push or PR performed: no
Customer data mutation performed: no
Payment action performed: no
Delete action performed: no
data/lp_events.jsonl write performed: no

## Browser Contract

| check | result | message |
|---|---|---|
${contractRows}

## Replay Scenarios

| scenario | result | status | issues | data write |
|---|---|---|---:|---|
${scenarioRows}
`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function taipeiDateString(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function addDaysTaipeiDate(dateString, days) {
  const date = new Date(`${dateString}T00:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return taipeiDateString(date);
}

main();
