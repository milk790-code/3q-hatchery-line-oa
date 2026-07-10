import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const TEMPLATE_PATH = path.join(ROOT, "data", "source_capture", "source_capture_ledger.fill-template.csv");
const HTML_PATH = path.join(ROOT, "north_star_outcome_form.html");
const FORM_STATUS_PATH = path.join(ROOT, "data", "north_star_outcome_form_status.json");
const STATUS_PATH = path.join(ROOT, "data", "north_star_outcome_form_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "north_star_outcome_form_fixture_report.md");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const OUTCOME_EVENTS = ["link_click", "lead_submit", "deal", "quality_flag"];

async function main() {
  const generatedAt = new Date();
  const template = parseCsv(await readFile(TEMPLATE_PATH, "utf8"));
  const html = await readFile(HTML_PATH, "utf8");
  const formStatus = JSON.parse(await readFile(FORM_STATUS_PATH, "utf8"));
  const realEventsBefore = await readOptional(REAL_EVENTS_PATH);
  const outcomeRows = template.rows.filter((row) => OUTCOME_EVENTS.includes(row.stage));
  const checks = buildChecks({ html, formStatus, outcomeRows, template });
  const realEventsAfter = await readOptional(REAL_EVENTS_PATH);
  checks.push(check("real_events_unchanged", realEventsBefore === realEventsAfter, "fixture guard must not change data/lp_events.jsonl"));

  const status = {
    ok: checks.every((item) => item.ok),
    generated_at: generatedAt.toISOString(),
    mode: "north_star_outcome_form_fixture_static_guard",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    template_path: TEMPLATE_PATH,
    html_path: HTML_PATH,
    form_status_path: FORM_STATUS_PATH,
    form_status: formStatus.status,
    form_download_filename: formStatus.download_filename,
    row_count: outcomeRows.length,
    event_types: OUTCOME_EVENTS,
    check_count: checks.length,
    checks,
    browser_form_static_checks_executed: true,
    form_export_replay_executed: false,
    source_capture_compile_commands_executed: false,
    owner_sample_gate_commands_executed: false,
    real_events_unchanged: realEventsBefore === realEventsAfter,
    execution_performed: false,
    live_input_files_created: false,
    real_event_write_performed: false,
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
    note: "Static local guard for the North Star outcome browser form. It inspects the generated HTML/status contract only and never creates live CSVs, appends data/lp_events.jsonl, stages/applies data, deploys, posts, pushes LINE/GitHub, mutates customer data, touches payments, or deletes data.",
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) process.exitCode = 1;
}

function buildChecks({ html, formStatus, outcomeRows, template }) {
  const eventTypes = new Set(outcomeRows.map((row) => row.stage));
  return [
    check("status_ok", formStatus.ok === true, "form status must be ok"),
    check("mode", formStatus.mode === "north_star_outcome_form_local_browser_only", "form mode must be local browser-only"),
    check("template_source", formStatus.template_path.endsWith("data/source_capture/source_capture_ledger.fill-template.csv"), "form must read source_capture_ledger.fill-template.csv"),
    check("row_count", formStatus.row_count === 24 && outcomeRows.length === 24, "form must cover exactly 24 P1 outcome rows"),
    check("event_type_count", OUTCOME_EVENTS.every((eventType) => eventTypes.has(eventType)), "form must cover link_click, lead_submit, deal, and quality_flag"),
    check("download_filename", formStatus.download_filename === "source_capture_ledger.filled.csv", "form must export source_capture_ledger.filled.csv"),
    check("browser_only", formStatus.browser_only === true, "form must be browser-only"),
    check("browser_persistence_false", formStatus.browser_persistence === false, "form must not persist browser data"),
    check("network_false", formStatus.network_calls_performed === false, "form status must declare no network calls"),
    check("live_input_false", formStatus.live_input_files_created === false, "form must not create live input files"),
    check("event_write_false", formStatus.data_lp_events_write_performed === false, "form must not write data/lp_events.jsonl"),
    check("external_false", formStatus.external_effect === false, "form must not claim external effects"),
    check("html_title", html.includes("3Q Growth Loop North Star Outcome Form"), "HTML must include the form title"),
    check("html_no_external_effect", html.includes('data-external-effect="false"'), "HTML must mark no external effect"),
    check("html_no_network_marker", html.includes('data-network="none"'), "HTML must mark no network"),
    check("html_mentions_download", html.includes("source_capture_ledger.filled.csv"), "HTML must mention the download filename"),
    check("html_has_form", html.includes('<form id="ownerForm" novalidate>'), "HTML must include a local owner form with no action"),
    check("html_no_form_action", !/<form[^>]*\saction=/i.test(html), "HTML form must not define an action URL"),
    check("html_download_control", html.includes("Download CSV"), "HTML must include CSV download control"),
    check("html_no_fetch", !/\bfetch\s*\(/.test(html), "HTML must not call fetch"),
    check("html_no_xhr", !/sendBeacon|XMLHttpRequest/i.test(html), "HTML must not send beacons or XHR"),
    check("html_no_persistence", !/localStorage|sessionStorage|indexedDB/i.test(html), "HTML must not use browser persistence APIs"),
    check("html_no_external_links", !/href=["']https?:\/\//i.test(html), "HTML must not link to external URLs"),
    check("quality_score_guard", html.includes('row.stage !== "quality_flag"') && html.includes("quality_score"), "HTML must restrict quality_score to quality_flag rows"),
    check("required_headers", ["capture_date", "aggregate_count", "evidence_ref", "reviewer", "pii_checked"].every((header) => template.headers.includes(header)), "template must include all owner-required fields"),
  ];
}

function renderReport(status) {
  return `# 3Q Growth Loop North Star Outcome Form Fixture Report

BLUF: ${status.ok ? "pass" : "review required"}. Static local guard checked the browser-only P1 outcome form contract.

Generated: ${status.generated_at}
Mode: ${status.mode}
Rows: ${status.row_count}
Events: ${status.event_types.join(", ")}
Download filename: ${status.form_download_filename}
Browser static checks executed: ${status.browser_form_static_checks_executed ? "yes" : "no"}
Form export replay executed: ${status.form_export_replay_executed ? "yes" : "no"}
Source compile commands executed: ${status.source_capture_compile_commands_executed ? "yes" : "no"}
data/lp_events.jsonl write performed: ${status.data_lp_events_write_performed ? "yes" : "no"}
External effect: ${status.external_effect ? "yes" : "no"}
Production deploy performed: ${status.production_deploy_performed ? "yes" : "no"}
Public link change performed: ${status.public_link_change_performed ? "yes" : "no"}
GitHub push / PR performed: ${status.github_push_or_pr_performed ? "yes" : "no"}
Formal post performed: ${status.formal_post_performed ? "yes" : "no"}
LINE push performed: ${status.line_push_performed ? "yes" : "no"}
Customer-data mutation performed: ${status.customer_data_mutation_performed ? "yes" : "no"}
Payment action performed: ${status.payment_action_performed ? "yes" : "no"}
Delete action performed: ${status.delete_action_performed ? "yes" : "no"}

## Checks

| check | result | message |
|---|---|---|
${status.checks.map((item) => `| ${item.name} | ${item.ok ? "pass" : "fail"} | ${item.message} |`).join("\n")}
`;
}

function parseCsv(raw) {
  const rows = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
  if (rows.length === 0) throw new Error("CSV is empty.");
  const headers = rows[0].map((header) => header.trim());
  return {
    headers,
    rows: rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]))),
  };
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function check(name, ok, message) {
  return { name, ok, message };
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
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
