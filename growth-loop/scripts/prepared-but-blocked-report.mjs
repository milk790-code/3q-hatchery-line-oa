import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

const PATHS = {
  blocked: "prepared_but_blocked.json",
  approval: "approval_queue.json",
  redline: "data/redline_priority_status.json",
};

const OUTPUT_MD = "prepared_but_blocked.md";
const OUTPUT_STATUS = "data/prepared_but_blocked_report_status.json";

const RED_LINE_FALSE = {
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
  const blocked = await readJson(PATHS.blocked);
  const approval = await readJson(PATHS.approval);
  const redline = await readJson(PATHS.redline);
  const report = buildReport(blocked, approval, redline, generatedAt);

  await mkdir(path.dirname(resolve(OUTPUT_STATUS)), { recursive: true });
  await writeFile(resolve(OUTPUT_MD), renderMarkdown(report));
  await writeJson(OUTPUT_STATUS, buildStatus(report, generatedAt));

  console.log(JSON.stringify(buildStatus(report, generatedAt), null, 2));
}

function buildReport(blocked, approval, redline, generatedAt) {
  const items = blocked.items ?? [];
  const dataEvidenceGates = blocked.data_evidence_gates ?? [];
  const pendingHumanItems = (approval.items ?? []).filter((item) => item.status === "pending_human");

  return {
    ok: blocked.status === "prepared_but_blocked" && dataEvidenceGates.length > 0,
    generated_at: generatedAt.toISOString(),
    mode: "prepared_but_blocked_report_local_only",
    status: blocked.status,
    blocked_actions_from_config: blocked.blocked_actions_from_config ?? [],
    data_evidence_gates: dataEvidenceGates,
    data_evidence_gate_count: dataEvidenceGates.length,
    unmet_data_evidence_gate_count: dataEvidenceGates.filter((gate) => gate.status !== "met").length,
    data_evidence_ready: dataEvidenceGates.every((gate) => gate.status === "met"),
    blocked_item_count: items.length,
    pending_human_approval_count: pendingHumanItems.length,
    redline_queue_covered: Boolean(redline.redline_queue_covered),
    no_autorun_for_external_gates: Boolean(redline.no_autorun_for_external_gates),
    next_operator_action: redline.next_operator_action ?? null,
    items,
    outputs: {
      report_md: OUTPUT_MD,
      status_json: OUTPUT_STATUS,
      source_json: PATHS.blocked,
    },
    ...RED_LINE_FALSE,
  };
}

function buildStatus(report, generatedAt) {
  return {
    ok: report.ok,
    generated_at: generatedAt.toISOString(),
    mode: report.mode,
    status: report.status,
    data_evidence_gate_count: report.data_evidence_gate_count,
    unmet_data_evidence_gate_count: report.unmet_data_evidence_gate_count,
    data_evidence_ready: report.data_evidence_ready,
    blocked_item_count: report.blocked_item_count,
    pending_human_approval_count: report.pending_human_approval_count,
    redline_queue_covered: report.redline_queue_covered,
    no_autorun_for_external_gates: report.no_autorun_for_external_gates,
    next_operator_action: report.next_operator_action,
    outputs: report.outputs,
    ...RED_LINE_FALSE,
  };
}

function renderMarkdown(report) {
  const bluf = report.ok
    ? `PreparedButBlocked is ready: ${report.blocked_item_count} human-only or external actions are queued, with no autorun.`
    : "PreparedButBlocked source is not in a valid blocked state; do not resume external actions.";

  return `# PreparedButBlocked Report

BLUF: ${bluf}

Generated: ${report.generated_at}
Mode: ${report.mode}
Status: ${report.status}
Blocked item count: ${report.blocked_item_count}
Pending human approvals: ${report.pending_human_approval_count}
Red-line queue covered: ${report.redline_queue_covered ? "yes" : "no"}
No autorun for external gates: ${report.no_autorun_for_external_gates ? "yes" : "no"}

## Data Evidence Gates

| id | status | blocks completion | observed | required | next action |
|---|---|---|---|---|---|
${report.data_evidence_gates.map((gate) => `| ${gate.id} | ${gate.status} | ${gate.blocking_completion ? "yes" : "no"} | ${JSON.stringify(gate.observed ?? {})} | ${gate.required} | ${gate.next_action} |`).join("\n")}

## Next Safe Operator Action

${report.next_operator_action ?? "n/a"}

## Blocked Actions

| id | action | blocked by | prepared artifact | supporting / release evidence | resume when |
|---|---|---|---|---|---|
${report.items.map((item) => `| ${item.id} | ${item.action} | ${item.blocked_by} | ${item.prepared_artifact ?? "n/a"} | ${[item.supporting_artifact, item.readiness_artifact, item.config_guard_artifact, item.release_artifact, item.local_commit_artifact, item.engine_bundle_artifact].filter(Boolean).join("; ") || "n/a"} | ${item.resume_when} |`).join("\n")}

## Config Blocked Actions

${report.blocked_actions_from_config.map((action) => `- ${action}`).join("\n")}

## Safety

- External effect: ${report.external_effect ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${report.data_lp_events_write_performed ? "yes" : "no"}
- Public link change performed: ${report.public_link_change_performed ? "yes" : "no"}
- Production deploy performed: ${report.production_deploy_performed ? "yes" : "no"}
- GitHub push / PR performed: ${report.github_push_or_pr_performed ? "yes" : "no"}
- Formal post performed: ${report.formal_post_performed ? "yes" : "no"}
- LINE push performed: ${report.line_push_performed ? "yes" : "no"}
- Customer-data mutation performed: ${report.customer_data_mutation_performed ? "yes" : "no"}
- Payment action performed: ${report.payment_action_performed ? "yes" : "no"}
- Delete action performed: ${report.delete_action_performed ? "yes" : "no"}
`;
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(relativePath), "utf8"));
}

async function writeJson(relativePath, value) {
  await writeFile(resolve(relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function resolve(relativePath) {
  return path.join(ROOT, relativePath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
