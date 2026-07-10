import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const JSON_PATH = path.join(ROOT, "redline_priority.json");
const MD_PATH = path.join(ROOT, "redline_priority.md");
const STATUS_PATH = path.join(ROOT, "data", "redline_priority_status.json");

const RED_LINE_FLAGS = {
  external_effect: false,
  execution_performed: false,
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
};

const GATE_ORDER = {
  remote_d1_create_and_migrate: 20,
  candidate_worker_production_deploy: 30,
  public_ab_small_traffic_link: 40,
  github_repo_branch_pr: 50,
  formal_posts_line_push_payment_customer_data: 99,
};

const ACTION_TO_GATE = {
  create_cloudflare_d1_and_apply_schema: "remote_d1_create_and_migrate",
  verify_existing_cloudflare_d1_and_apply_schema: "remote_d1_create_and_migrate",
  deploy_candidate_worker: "candidate_worker_production_deploy",
  deploy_candidate_worker_security_update: "candidate_worker_production_deploy",
  confirm_existing_candidate_worker_provenance: "candidate_worker_production_deploy",
  repair_or_remove_champion_contact_form_false_success: "candidate_worker_production_deploy",
  confirm_champion_live_contract_provenance_before_redeploy: "candidate_worker_production_deploy",
  change_primary_social_or_bio_link: "public_ab_small_traffic_link",
  github_push_or_pr_creation: "github_repo_branch_pr",
  formal_social_post_or_line_push: "formal_posts_line_push_payment_customer_data",
  customer_data_or_ecpay_payment_mutation: "formal_posts_line_push_payment_customer_data",
};

async function main() {
  const generatedAt = new Date();
  const approval = await readJson("approval_queue.json");
  const approvalStatus = await readJson("data/approval_queue_status.json");
  const blocked = await readJson("prepared_but_blocked.json");
  const gateReadiness = await readJson("data/gate_readiness_status.json");
  const dataProgress = await readJson("data/data_collection_progress_status.json");
  const sourceReadiness = await readJson("data/source_readiness_status.json");
  const goalCompletion = await readJson("data/goal_completion_audit_status.json");
  const sampleDue = await readJson("sample_gate_due_status.json");
  const nextP0Inputs = await readJson("data/next_p0_owner_inputs_status.json");
  const scheduleCatchup = await readJson("data/schedule_catchup_status.json");

  const localActions = buildLocalActions({ approval, approvalStatus, dataProgress, sourceReadiness, goalCompletion, sampleDue, nextP0Inputs, scheduleCatchup });
  const gateActions = [
    ...buildGateActions({ gateReadiness, blocked }),
    ...buildCompositeLaunchActions({ blocked, gateReadiness }),
  ];
  const manualOnlyActions = buildManualOnlyActions({ blocked, gateReadiness });
  const ordered_actions = [...localActions, ...gateActions, ...manualOnlyActions]
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  const redlineActionsCovered = new Set([
    ...ordered_actions.flatMap((item) => item.related_blocked_actions ?? []),
    ...ordered_actions.map((item) => item.blocked_action).filter(Boolean),
  ]);
  const uncoveredBlockedActions = (blocked.items ?? [])
    .filter((item) => !redlineActionsCovered.has(item.action))
    .map((item) => item.action);

  const firstAction = ordered_actions.find((item) => item.status !== "complete") ?? null;
  const status = {
    ok: uncoveredBlockedActions.length === 0 && ordered_actions.length > 0,
    generated_at: generatedAt.toISOString(),
    mode: "redline_priority_local_only",
    status: statusName({ goalCompletion, dataProgress, gateReadiness, firstAction }),
    json_path: JSON_PATH,
    report_path: MD_PATH,
    status_path: STATUS_PATH,
    action_count: ordered_actions.length,
    local_action_count: localActions.length,
    gate_action_count: gateActions.length,
    manual_only_action_count: manualOnlyActions.length,
    uncovered_blocked_actions: uncoveredBlockedActions,
    next_operator_action: firstAction ? summarizeAction(firstAction) : "No open action found.",
    owner_decision_required: true,
    sample_threshold_met: goalCompletion.sample_threshold_met === true,
    current_real_event_rows: goalCompletion.current_real_event_rows ?? sourceReadiness.real_event_rows ?? 0,
    public_iteration_ready: sourceReadiness.ready_for_public_iteration_decision === true,
    approval_queue_status: approvalStatus.status ?? "unknown",
    approval_queue_item_count: approvalStatus.item_count ?? (approval.items ?? []).length,
    approval_queue_ready_local_review_count: approvalStatus.ready_local_review_count ?? null,
    approval_queue_pending_human_count: approvalStatus.pending_human_count ?? null,
    approval_queue_high_risk_pending_count: approvalStatus.high_risk_pending_count ?? null,
    approval_queue_next_ready_local_review_id: approvalStatus.next_ready_local_review_id ?? null,
    approval_queue_next_pending_human_id: approvalStatus.next_pending_human_id ?? null,
    approval_queue_policy_ok: approvalStatus.policy_ok === true,
    redline_queue_covered: uncoveredBlockedActions.length === 0,
    no_autorun_for_external_gates: true,
    gates_execute_in_order: true,
    local_review_precedes_external_gate_when_sample_empty: (goalCompletion.current_real_event_rows ?? 0) === 0,
    ...RED_LINE_FLAGS,
  };

  const output = {
    ...status,
    local_sample_status: {
      data_collection_progress_status: dataProgress.status,
      filled_task_count: dataProgress.filled_task_count ?? 0,
      pending_task_count: dataProgress.pending_task_count ?? 0,
      p0_pending_count: dataProgress.p0_pending_count ?? 0,
      next_p0_owner_input_count: nextP0Inputs.current_input_count ?? dataProgress.next_owner_input_count ?? 0,
      source_readiness_status: sourceReadiness.status,
      source_missing_stage_count: sourceReadiness.stages?.filter((stage) => stage.ready_for_decision !== true).length ?? null,
      sample_due_status: sampleDue.status,
      due_phase: sampleDue.due_phase ?? null,
    },
    ordered_actions,
    local_actions: localActions,
    external_gate_actions: gateActions,
    manual_only_actions: manualOnlyActions,
    note: "This file only prioritizes existing approval and red-line queues. It never executes Cloudflare, GitHub, public links, LINE, payments, customer-data operations, or deletes.",
  };

  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeJson(JSON_PATH, output);
  await writeJson(STATUS_PATH, status);
  await writeFile(MD_PATH, renderReport(output));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildLocalActions(context) {
  const { approval, approvalStatus, dataProgress, sourceReadiness, goalCompletion, sampleDue, nextP0Inputs, scheduleCatchup } = context;
  const readyLocal = (approval.items ?? []).filter((item) => item.status === "ready_local_review");
  const actions = [];

  actions.push({
    id: "p0_collect_sample_gate_counts",
    priority: 10,
    lane: "local_review",
    risk_tier: "T1",
    status: (dataProgress.p0_pending_count ?? 0) > 0 ? "needs_owner_counts" : "ready_for_intake_review",
    title: "Collect P0 sample-gate aggregate counts",
    artifact: "next_p0_owner_form.html",
    supporting_artifacts: ["next_p0_owner_inputs.md", "next_p0_quick_capture.md", "data/source_capture/sample_gate_ledger.fill-template.csv"],
    reason: `real_events=${goalCompletion.current_real_event_rows ?? 0}; p0_pending=${dataProgress.p0_pending_count ?? 0}; sample_threshold_met=${goalCompletion.sample_threshold_met ? "yes" : "no"}`,
    next_action: (nextP0Inputs.current_input_count ?? 0) > 0
      ? "Open next_p0_owner_form.html or next_p0_quick_capture.md, fill aggregate-only P0 counts, then rerun owner intake/weekly verification."
      : "Review data_collection_progress.md and source_capture_pack.md to identify the next aggregate-only P0 rows.",
    owner_executes: true,
    engine_autorun_allowed: false,
    related_approval_ids: ["collect-first-real-events", "review-data-collection-brief", "review-real-data-input-pack"],
    approval_queue_context: {
      status: approvalStatus.status ?? "unknown",
      ready_local_review_count: approvalStatus.ready_local_review_count ?? readyLocal.length,
      pending_human_count: approvalStatus.pending_human_count ?? null,
      high_risk_pending_count: approvalStatus.high_risk_pending_count ?? null,
      next_ready_local_review_id: approvalStatus.next_ready_local_review_id ?? null,
      next_pending_human_id: approvalStatus.next_pending_human_id ?? null,
      policy_ok: approvalStatus.policy_ok === true,
    },
    related_blocked_actions: [],
    ...RED_LINE_FLAGS,
  });

  actions.push({
    id: "schedule_catchup_review",
    priority: scheduleCatchup.catchup_required ? 12 : 92,
    lane: "local_review",
    risk_tier: "T1",
    status: scheduleCatchup.catchup_required ? "owner_review_missed_run" : "current",
    title: "Review weekly schedule catch-up status",
    artifact: "schedule_catchup_status.md",
    supporting_artifacts: ["data/schedule_catchup_status.json", "data/weekly_runner_status.json"],
    reason: `catchup_required=${scheduleCatchup.catchup_required ? "yes" : "no"}; monitor_invoked_weekly=${scheduleCatchup.weekly_runner_invoked ? "yes" : "no"}`,
    next_action: scheduleCatchup.next_safe_action ?? "Review schedule_catchup_status.md.",
    owner_executes: false,
    engine_autorun_allowed: false,
    related_approval_ids: ["review-local-launchagent-install"],
    related_blocked_actions: [],
    ...RED_LINE_FLAGS,
  });

  for (const item of readyLocal) {
    actions.push({
      id: `review_${item.id}`,
      priority: localReviewPriority(item),
      lane: "local_review",
      risk_tier: item.risk_tier ?? "T1",
      status: item.status,
      title: item.human_gate ?? item.type ?? item.id,
      artifact: item.artifact ?? null,
      supporting_artifacts: [],
      reason: item.reason ?? "Local review queue item.",
      next_action: `Review ${item.artifact ?? item.id}; do not perform external action from it unless a separate gate is approved.`,
      owner_executes: false,
      engine_autorun_allowed: true,
      related_approval_ids: [item.id],
      related_blocked_actions: [],
      ...RED_LINE_FLAGS,
    });
  }

  actions.push({
    id: "source_readiness_review",
    priority: sourceReadiness.ready_for_public_iteration_decision ? 18 : 19,
    lane: "local_review",
    risk_tier: "T1",
    status: sourceReadiness.status ?? "unknown",
    title: "Confirm source readiness before public iteration decisions",
    artifact: "source_readiness.md",
    supporting_artifacts: ["real_data_intake_plan.md", "data_collection_progress.md"],
    reason: `public_iteration_ready=${sourceReadiness.ready_for_public_iteration_decision ? "yes" : "no"}; missing_stages=${(sourceReadiness.stages ?? []).filter((stage) => stage.ready_for_decision !== true).length}`,
    next_action: "Keep public A/B and champion changes blocked until source_readiness.md reports ready_for_public_iteration_decision=true.",
    owner_executes: false,
    engine_autorun_allowed: false,
    related_approval_ids: ["review-source-readiness", "review-real-data-intake-plan"],
    related_blocked_actions: ["change_primary_social_or_bio_link"],
    ...RED_LINE_FLAGS,
  });

  if (sampleDue.due_now === true) {
    actions.push({
      id: "sample_gate_due_review",
      priority: 11,
      lane: "local_review",
      risk_tier: "T1",
      status: sampleDue.status,
      title: "Review due sample-gate checkpoint",
      artifact: "sample_gate_due_status.md",
      supporting_artifacts: ["sample_gate_capture_calendar.md"],
      reason: `due_phase=${sampleDue.due_phase ?? "n/a"}; sample_threshold_met=${sampleDue.sample_threshold_met ? "yes" : "no"}`,
      next_action: sampleDue.next_safe_command ?? "Review sample_gate_due_status.md before changing any candidate status.",
      owner_executes: false,
      engine_autorun_allowed: false,
      related_approval_ids: ["review-next-round-plan"],
      related_blocked_actions: ["promote_challenger_to_champion"],
      ...RED_LINE_FLAGS,
    });
  }

  return dedupeActions(actions);
}

function buildGateActions({ gateReadiness, blocked }) {
  const blockByGate = new Map();
  for (const item of blocked.items ?? []) {
    const gateId = ACTION_TO_GATE[item.action];
    if (!gateId) continue;
    if (!blockByGate.has(gateId)) blockByGate.set(gateId, []);
    blockByGate.get(gateId).push(item);
  }

  return (gateReadiness.gates ?? [])
    .filter((gate) => gate.execution_policy !== "manual_only")
    .map((gate) => {
      const blocks = blockByGate.get(gate.gate_id) ?? [];
      return {
        id: `gate_${gate.gate_id}`,
        priority: GATE_ORDER[gate.gate_id] ?? 80,
        lane: "external_gate_sequence",
        risk_tier: gate.risk_tier ?? "T2",
        status: gate.ready_for_owner_execution ? "ready_for_owner_manual_execution" : "blocked_waiting_for_owner_or_dependency",
        gate_id: gate.gate_id,
        approval_id: gate.approval_id ?? null,
        title: gate.gate_id,
        artifact: gate.prepared_artifact ?? blocks[0]?.prepared_artifact ?? null,
        supporting_artifacts: gate.resume_command_preview ?? [],
        reason: gate.blocked_reasons?.join("; ") || blocks.map((item) => item.blocked_by).join("; ") || "Owner gate remains blocked.",
        next_action: gate.next_owner_action ?? blocks[0]?.resume_when ?? "Review gate_readiness.md.",
        owner_executes: true,
        engine_autorun_allowed: false,
        dependencies: gate.dependencies ?? [],
        related_approval_ids: [gate.approval_id].filter(Boolean),
        related_blocked_actions: blocks.map((item) => item.action),
        ...RED_LINE_FLAGS,
      };
    });
}

function buildCompositeLaunchActions({ blocked, gateReadiness }) {
  const item = (blocked.items ?? []).find((entry) => entry.action === "execute_owner_approved_launch_sequence");
  if (!item) return [];
  const gates = (gateReadiness.gates ?? []).filter((gate) => gate.execution_policy !== "manual_only");
  const readyCount = gates.filter((gate) => gate.ready_for_owner_execution).length;
  return [{
    id: "gate_owner_approved_launch_sequence",
    priority: 45,
    lane: "external_gate_sequence",
    risk_tier: "T3",
    status: readyCount === gates.length && gates.length > 0 ? "ready_for_owner_sequence_review" : "blocked_until_individual_gates_ready",
    gate_id: "owner_approved_launch_sequence",
    approval_id: "review-owner-approval-pack",
    title: item.action,
    artifact: item.prepared_artifact,
    supporting_artifacts: ["launch_readiness.json", "gate_readiness.md", "owner_approval_pack.md"],
    reason: `${item.blocked_by} Individual gates ready=${readyCount}/${gates.length}.`,
    next_action: item.resume_when,
    owner_executes: true,
    engine_autorun_allowed: false,
    dependencies: gates.map((gate) => ({
      id: gate.gate_id,
      ok: gate.ready_for_owner_execution === true,
      reason: gate.next_owner_action ?? gate.blocked_reasons?.[0] ?? "owner gate review required",
    })),
    related_approval_ids: ["review-owner-approval-pack", ...gates.map((gate) => gate.approval_id).filter(Boolean)],
    related_blocked_actions: [item.action],
    ...RED_LINE_FLAGS,
  }];
}

function buildManualOnlyActions({ blocked, gateReadiness }) {
  const manualGate = (gateReadiness.gates ?? []).find((gate) => gate.execution_policy === "manual_only");
  const manualBlocks = (blocked.items ?? []).filter((item) =>
    ["formal_social_post_or_line_push", "customer_data_or_ecpay_payment_mutation"].includes(item.action)
  );

  return manualBlocks.map((item, index) => ({
    id: `manual_${item.id}`,
    priority: 100 + index,
    lane: "manual_only",
    risk_tier: manualGate?.risk_tier ?? "T3",
    status: "manual_only_never_autorun",
    title: item.action,
    artifact: item.prepared_artifact,
    supporting_artifacts: [],
    reason: item.blocked_by,
    next_action: item.resume_when,
    owner_executes: true,
    engine_autorun_allowed: false,
    related_approval_ids: [manualGate?.approval_id].filter(Boolean),
    blocked_action: item.action,
    related_blocked_actions: [item.action],
    ...RED_LINE_FLAGS,
  }));
}

function localReviewPriority(item) {
  if (item.id === "collect-first-real-events") return 13;
  if (item.id === "review-owner-console") return 14;
  if (item.id === "review-data-collection-brief") return 15;
  if (item.id === "review-real-data-input-pack") return 16;
  if (item.id === "review-source-readiness") return 17;
  if (item.id === "review-next-round-plan") return 18;
  return 60;
}

function statusName({ goalCompletion, dataProgress, gateReadiness, firstAction }) {
  if (goalCompletion.complete === true) return "complete";
  if ((dataProgress.p0_pending_count ?? 0) > 0) return "prioritize_p0_sample_gate_counts";
  if ((gateReadiness.ready_gate_count ?? 0) > 0) return "owner_gate_ready_for_manual_execution_review";
  if (firstAction?.lane === "manual_only") return "manual_only_redlines_remaining";
  return "prioritize_owner_gate_metadata";
}

function summarizeAction(action) {
  return `${action.id}: ${action.next_action}`;
}

function dedupeActions(actions) {
  const seen = new Set();
  const out = [];
  for (const action of actions) {
    if (seen.has(action.id)) continue;
    seen.add(action.id);
    out.push(action);
  }
  return out;
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(ROOT, relativePath), "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function renderReport(status) {
  const actionRows = status.ordered_actions
    .map((item) => `| ${item.priority} | ${item.lane} | ${item.risk_tier} | ${item.status} | ${item.id} | ${item.artifact ?? "n/a"} | ${item.engine_autorun_allowed ? "yes" : "no"} |`)
    .join("\n");
  const nextRows = status.ordered_actions
    .slice(0, 8)
    .map((item, index) => `${index + 1}. ${item.id}: ${item.next_action}`)
    .join("\n");
  const gateRows = status.external_gate_actions
    .map((item) => `| ${item.gate_id} | ${item.status} | ${item.reason || "n/a"} | ${item.next_action} |`)
    .join("\n");
  const manualRows = status.manual_only_actions
    .map((item) => `| ${item.blocked_action} | ${item.reason} | ${item.next_action} |`)
    .join("\n");

  return `# 3Q Growth Loop Red-Line Priority

BLUF: ${status.status}. This local report turns the approval queue and PreparedButBlocked items into an ordered operator queue. It performs no external action and never runs Cloudflare, GitHub, public link, LINE, payment, customer-data, or delete operations.

Generated: ${status.generated_at}
Mode: ${status.mode}
Current real events: ${status.current_real_event_rows}
Sample threshold met: ${status.sample_threshold_met ? "yes" : "no"}
Public iteration ready: ${status.public_iteration_ready ? "yes" : "no"}
Approval queue status: ${status.approval_queue_status}
Approval queue items: ${status.approval_queue_item_count}
Approval queue ready local review: ${status.approval_queue_ready_local_review_count ?? "n/a"}
Approval queue pending human: ${status.approval_queue_pending_human_count ?? "n/a"}
Approval queue high-risk pending: ${status.approval_queue_high_risk_pending_count ?? "n/a"}
Approval queue policy ok: ${status.approval_queue_policy_ok ? "yes" : "no"}
Red-line queue covered: ${status.redline_queue_covered ? "yes" : "no"}
Owner decision required: yes
External effect: no
Execution performed: no

## Next Operator Action

${status.next_operator_action}

## Ordered Queue

| priority | lane | risk | status | action | artifact | autorun |
|---:|---|---|---|---|---|---|
${actionRows}

## Top Next Steps

${nextRows}

## Local Sample Status

- Data collection progress: ${status.local_sample_status.data_collection_progress_status}
- P0 pending: ${status.local_sample_status.p0_pending_count}
- Next P0 owner inputs: ${status.local_sample_status.next_p0_owner_input_count}
- Source readiness: ${status.local_sample_status.source_readiness_status}
- Missing source stages: ${status.local_sample_status.source_missing_stage_count ?? "n/a"}
- Sample due status: ${status.local_sample_status.sample_due_status ?? "n/a"}

## Approval Queue Status

- Next local review: ${status.approval_queue_next_ready_local_review_id ?? "n/a"}
- Next human gate: ${status.approval_queue_next_pending_human_id ?? "n/a"}
- Pending human count: ${status.approval_queue_pending_human_count ?? "n/a"}
- High-risk pending count: ${status.approval_queue_high_risk_pending_count ?? "n/a"}
- Policy ok: ${status.approval_queue_policy_ok ? "yes" : "no"}

## External Gate Sequence

| gate | status | blocker | next owner action |
|---|---|---|---|
${gateRows || "| n/a | n/a | n/a | n/a |"}

## Manual-Only Red Lines

| action | reason | resume rule |
|---|---|---|
${manualRows || "| n/a | n/a | n/a |"}

## Safety

- No external command executed.
- No production deploy performed.
- No public link changed.
- No GitHub push or PR created.
- No formal post or LINE push performed.
- No customer data, payment, refund, ECPay, or delete action performed.
`;
}

main();
