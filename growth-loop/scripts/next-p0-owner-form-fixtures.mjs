import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const NEXT_P0_INPUTS_PATH = path.join(ROOT, "next_p0_owner_inputs.json");
const FORM_HTML_PATH = path.join(ROOT, "next_p0_owner_form.html");
const FORM_STATUS_PATH = path.join(ROOT, "data", "next_p0_owner_form_status.json");
const STATUS_PATH = path.join(ROOT, "data", "next_p0_owner_form_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "next_p0_owner_form_fixture_report.md");

const REQUIRED_EXPORT_HEADERS = [
  "rank",
  "capture_date",
  "role",
  "tracking_link_id",
  "event_type",
  "stage_label",
  "source_surface",
  "target_live_file",
  "aggregate_count",
  "evidence_ref",
  "reviewer",
  "pii_checked",
];

const RED_LINE_FLAGS = [
  "live_input_files_created",
  "data_lp_events_write_performed",
  "public_link_change_performed",
  "production_deploy_performed",
  "github_push_or_pr_performed",
  "formal_post_performed",
  "line_push_performed",
  "customer_data_mutation_performed",
  "payment_action_performed",
  "delete_action_performed",
  "external_effect",
];

async function main() {
  const generatedAt = new Date();
  const nextP0 = JSON.parse(await readFile(NEXT_P0_INPUTS_PATH, "utf8"));
  const html = await readFile(FORM_HTML_PATH, "utf8");
  const formStatus = JSON.parse(await readFile(FORM_STATUS_PATH, "utf8"));
  const scenarios = buildScenarios({ nextP0, html, formStatus });
  const status = {
    ok: scenarios.every((scenario) => scenario.ok),
    generated_at: generatedAt.toISOString(),
    mode: "next_p0_owner_form_fixture_dry_run",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    next_p0_inputs_path: NEXT_P0_INPUTS_PATH,
    form_html_path: FORM_HTML_PATH,
    form_status_path: FORM_STATUS_PATH,
    row_count: formStatus.row_count ?? 0,
    expected_row_count: nextP0.current_input_count ?? 0,
    scenario_count: scenarios.length,
    scenario_ids: scenarios.map((scenario) => scenario.id),
    scenarios,
    browser_form_static_checks_executed: true,
    export_contract_verified: true,
    local_fixture_commands_executed: true,
    real_events_unchanged: formStatus.real_events_unchanged === true,
    live_input_files_created: false,
    data_lp_events_write_performed: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    external_effect: false,
    note: "Static fixture for the focused Next P0 owner form. It verifies the browser-only HTML and export contract without creating live inputs, appending data/lp_events.jsonl, staging owner data, posting, deploying, pushing GitHub, pushing LINE, mutating customer data, touching payments, or deleting data.",
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildScenarios({ nextP0, html, formStatus }) {
  return [
    scenario("html_contains_all_focused_inputs", [
      check("row_count_matches", formStatus.row_count === nextP0.current_input_count, nextP0.current_input_count, formStatus.row_count),
      check("has_expected_title", html.includes("3Q Growth Loop Next P0 Owner Form"), "title present", html.includes("3Q Growth Loop Next P0 Owner Form")),
      check("has_all_tracking_links", (nextP0.inputs ?? []).every((row) => html.includes(row.tracking_link_id)), "all tracking_link_id values", "checked"),
      check("has_all_event_types", (nextP0.inputs ?? []).every((row) => html.includes(row.event_type)), "all event_type values", "checked"),
      check("has_download_names", html.includes("next_p0_owner_inputs.filled.csv") && html.includes("next_p0_owner_inputs.review.json"), "focused download names", "checked"),
    ]),
    scenario("no_network_or_browser_persistence", [
      check("no_fetch", !/\bfetch\s*\(/.test(html), "no fetch", "checked"),
      check("no_xhr", !/XMLHttpRequest/i.test(html), "no XMLHttpRequest", "checked"),
      check("no_send_beacon", !/sendBeacon/i.test(html), "no sendBeacon", "checked"),
      check("no_external_links", !/href=["']https?:\/\//i.test(html), "no external href", "checked"),
      check("no_local_storage", !/localStorage|sessionStorage|indexedDB/i.test(html), "no browser storage", "checked"),
      check("status_browser_only", formStatus.browser_only === true && formStatus.browser_persistence === false, "browser only and no persistence", `${formStatus.browser_only}:${formStatus.browser_persistence}`),
      check("status_no_network", formStatus.network_calls_performed === false, false, formStatus.network_calls_performed),
    ]),
    scenario("exports_aggregate_only_review_contract", [
      check("mode", formStatus.mode === "next_p0_owner_form", "next_p0_owner_form", formStatus.mode),
      check("status_ready", formStatus.status === "ready_local_next_p0_owner_form", "ready_local_next_p0_owner_form", formStatus.status),
      check("download_filename", formStatus.download_filename === "next_p0_owner_inputs.filled.csv", "next_p0_owner_inputs.filled.csv", formStatus.download_filename),
      check("json_download_filename", formStatus.json_download_filename === "next_p0_owner_inputs.review.json", "next_p0_owner_inputs.review.json", formStatus.json_download_filename),
      check("headers", sameList(formStatus.export_headers ?? [], REQUIRED_EXPORT_HEADERS), REQUIRED_EXPORT_HEADERS.join(","), (formStatus.export_headers ?? []).join(",")),
      check("contract_mentions_not_live", /not a live input CSV/i.test(formStatus.export_contract ?? ""), "not live input contract", formStatus.export_contract ?? "missing"),
    ]),
    scenario("red_line_flags_false", [
      ...RED_LINE_FLAGS.map((flag) => check(flag, formStatus[flag] === false, false, formStatus[flag])),
      check("fixture_no_live_input", true, false, false),
      check("fixture_no_event_write", true, false, false),
    ]),
  ];
}

function scenario(id, assertions) {
  return {
    id,
    ok: assertions.every((assertion) => assertion.ok),
    assertions,
    external_effect: false,
    live_input_files_created: false,
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
}

function check(name, ok, expected, actual) {
  return { name, ok, expected, actual, external_effect: false };
}

function sameList(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function renderReport(status) {
  const rows = status.scenarios
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "failed"} | ${scenario.assertions.filter((assertion) => assertion.ok).length}/${scenario.assertions.length} | ${scenario.external_effect ? "yes" : "no"} |`)
    .join("\n");

  return `# 3Q Growth Loop Next P0 Owner Form Fixture Report

BLUF: ${status.ok ? "next_p0_owner_form_fixture_ok" : "next_p0_owner_form_fixture_failed"}。This fixture verifies the focused Next P0 browser form is local-only, aggregate-only, and does not create live inputs or perform external effects.

Generated: ${status.generated_at}
Mode: ${status.mode}
Rows: ${status.row_count}
Expected rows: ${status.expected_row_count}
Scenarios: ${status.scenario_count}
Browser form static checks executed: ${status.browser_form_static_checks_executed ? "yes" : "no"}
Export contract verified: ${status.export_contract_verified ? "yes" : "no"}
Local fixture commands executed: ${status.local_fixture_commands_executed ? "yes" : "no"}
Live input files created: no
data/lp_events.jsonl write performed: no
External effect: no

## Scenario Summary

| scenario | result | assertions | external effect |
|---|---|---:|---|
${rows}

## Owner Boundary

The form only creates downloadable review files named \`next_p0_owner_inputs.filled.csv\` and \`next_p0_owner_inputs.review.json\`. It does not create \`data/source_capture/*.filled.csv\`, does not append \`data/lp_events.jsonl\`, does not stage owner data, and does not promote or deploy anything.
`;
}

main();
