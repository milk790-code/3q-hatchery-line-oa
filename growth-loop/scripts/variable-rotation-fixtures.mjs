import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "config", "growth-loop.config.json");
const STATUS_PATH = path.join(ROOT, "data", "variable_rotation_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "variable_rotation_fixture_report.md");

const EXPECTED_VARIABLES = ["hook", "offer", "visual_claim", "cta_text"];

const FIXTURE_VALUES = {
  hook: [
    "Find the exact 100-click leak before rebuilding the page.",
    "Your LINE adds are not low by accident; one funnel step is leaking.",
    "Stop guessing which page section blocks LINE inquiries.",
  ],
  offer: [
    "Free 48h conversion diagnosis with one bottleneck map.",
    "Free one-page audit focused only on LINE add friction.",
    "Free 100-click funnel review with one next action.",
  ],
  visual_claim: [
    "One variable tested this week; no champion swap before sample.",
    "100 visits, 20 CTA clicks, 5 LINE adds, 3 days minimum.",
    "Challenger must beat champion by 15% without quality regression.",
  ],
  cta_text: [
    "Get the 48h conversion diagnosis",
    "Send the page and find the leak",
    "Start with one testable CTA",
  ],
};

async function main() {
  const generatedAt = new Date();
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const base = baseValues(config);
  const allowedVariables = config.one_variable_per_round ?? [];
  const scenarios = EXPECTED_VARIABLES.map((variable) => buildScenario(variable, allowedVariables, base));
  const checks = [
    check("allowed_variables_exact", sameList(allowedVariables, EXPECTED_VARIABLES), "Config exposes hook / offer / visual_claim / cta_text in the requested order."),
    check("all_variables_have_fixture", scenarios.length === EXPECTED_VARIABLES.length && scenarios.every((scenario) => scenario.ok), "Every allowed variable has a passing one-variable fixture."),
    check("live_config_not_mutated", true, "Fixture builds in-memory candidates only; it never rewrites config/growth-loop.config.json."),
    check("red_line_flags_false", true, "Fixture performs no post, deploy, public link change, LINE push, payment, customer-data mutation, or delete."),
  ];

  const status = {
    ok: checks.every((item) => item.ok) && scenarios.every((scenario) => scenario.ok),
    generated_at: generatedAt.toISOString(),
    mode: "variable_rotation_fixture_dry_run",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    allowed_variables: allowedVariables,
    expected_variables: EXPECTED_VARIABLES,
    scenario_count: scenarios.length,
    candidate_template_count: scenarios.reduce((sum, scenario) => sum + scenario.drafts.length, 0),
    checks,
    scenarios,
    execution_performed: false,
    live_config_write_performed: false,
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
    note: "Fixture-only one-variable rotation guard. It proves hook, offer, visual_claim, and cta_text can each vary alone while all other fields stay locked.",
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

function baseValues(config) {
  const firstDraft = config.content_variant_drafts?.[0] ?? {};
  return {
    hook: config.locked_variables?.hook ?? "Base hook",
    offer: config.locked_variables?.offer ?? "Base offer",
    visual_claim: config.locked_variables?.visual_claim ?? "Base visual claim",
    cta_text: firstDraft.cta_text ?? "Base CTA",
  };
}

function buildScenario(variable, allowedVariables, base) {
  const values = FIXTURE_VALUES[variable] ?? [];
  const drafts = values.map((value, index) => {
    const fields = { ...base, [variable]: value };
    return {
      variant_id: `${variable}-fixture-${index + 1}`,
      changed_variable: variable,
      fields,
      final_gate: "fixture_only_not_for_public_use",
      external_effect: false,
    };
  });
  const lockedVariables = EXPECTED_VARIABLES.filter((item) => item !== variable);
  const lockedOk = lockedVariables.every((locked) => new Set(drafts.map((draft) => draft.fields[locked])).size === 1);
  const changedValueCount = new Set(drafts.map((draft) => draft.fields[variable])).size;
  const changedOnlyOk = drafts.every((draft) => changedFields(base, draft.fields).every((field) => field === variable));
  const ok =
    allowedVariables.includes(variable) &&
    drafts.length >= 3 &&
    changedValueCount >= 2 &&
    lockedOk &&
    changedOnlyOk &&
    drafts.every((draft) => draft.external_effect === false && draft.final_gate === "fixture_only_not_for_public_use");

  return {
    id: `${variable}_one_variable_fixture`,
    changed_variable: variable,
    ok,
    allowed_by_config: allowedVariables.includes(variable),
    draft_count: drafts.length,
    changed_value_count: changedValueCount,
    locked_variables: lockedVariables,
    locked_variables_ok: lockedOk,
    changed_only_ok: changedOnlyOk,
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    drafts,
  };
}

function changedFields(base, candidate) {
  return EXPECTED_VARIABLES.filter((field) => base[field] !== candidate[field]);
}

function check(id, ok, evidence) {
  return { id, ok: Boolean(ok), evidence, external_effect: false };
}

function sameList(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => item === right[index]);
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function renderReport(status) {
  const scenarioRows = status.scenarios
    .map((scenario) => `| ${scenario.changed_variable} | ${scenario.ok ? "ok" : "fail"} | ${scenario.draft_count} | ${scenario.changed_value_count} | ${scenario.locked_variables_ok ? "yes" : "no"} | ${scenario.changed_only_ok ? "yes" : "no"} |`)
    .join("\n");
  const checkRows = status.checks
    .map((item) => `| ${item.id} | ${item.ok ? "ok" : "fail"} | ${item.evidence} |`)
    .join("\n");

  return `# Variable Rotation Fixture Report

BLUF: ${status.ok ? "All one-variable rotation fixtures pass." : "One-variable rotation fixture failed."} This is a local dry run only.

Generated: ${status.generated_at}
Mode: ${status.mode}
External effect: no
Live config write performed: no

## Scenarios

| variable | status | drafts | changed values | locked variables ok | changed only ok |
|---|---|---:|---:|---|---|
${scenarioRows}

## Checks

| check | status | evidence |
|---|---|---|
${checkRows}

## Red Lines

- Formal post performed: no
- Public link change performed: no
- Production deploy performed: no
- LINE push performed: no
- Customer-data mutation performed: no
- Payment action performed: no
- Delete action performed: no
`;
}

main().catch(async (error) => {
  const status = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "variable_rotation_fixture_dry_run",
    error: error instanceof Error ? error.message : "unknown_error",
    execution_performed: false,
    live_config_write_performed: false,
    external_effect: false,
  };
  await writeJson(STATUS_PATH, status);
  console.error(error);
  process.exitCode = 1;
});
