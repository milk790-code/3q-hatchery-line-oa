import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OUTPUT_JSON = "sample_gate_collection_sprint.json";
const OUTPUT_MD = "sample_gate_collection_sprint.md";
const OUTPUT_STATUS = "data/sample_gate_collection_sprint_status.json";

const RED_LINE_FALSE = {
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

async function main() {
  const generatedAt = new Date();
  const input = {
    ownerP0Now: await readJson("data/owner_p0_now_status.json", {}),
    handoff: await readJson("owner_sample_count_handoff.json", {}),
    handoffStatus: await readJson("data/owner_sample_count_handoff_status.json", {}),
    batchStatus: await readJson("data/sample_gate_batch_handoff_status.json", {}),
    due: await readJson("sample_gate_due_status.json", {}),
    dueStatus: await readJson("data/sample_gate_due_status_status.json", {}),
    calendar: await readJson("sample_gate_capture_calendar.json", {}),
    calendarStatus: await readJson("data/sample_gate_capture_calendar_status.json", {}),
    progress: await readJson("data/data_collection_progress_status.json", {}),
    sampleGate: await readJson("data/owner_sample_gate_status.json", {}),
    sourceReadiness: await readJson("data/source_readiness_status.json", {}),
    redline: await readJson("data/redline_priority_status.json", {}),
    approval: await readJson("data/approval_queue_status.json", {}),
    preflight: await readJson("data/p0_counts_preflight_status.json", {}),
    quick: await readJson("data/next_p0_quick_capture_status.json", {}),
    intake: await readJson("data/next_p0_owner_intake_status.json", {}),
  };

  const sprint = buildSprint(input, generatedAt);
  const status = buildStatus(sprint);

  await writeJson(OUTPUT_JSON, sprint);
  await writeFile(resolve(OUTPUT_MD), renderMarkdown(sprint));
  await mkdir(path.dirname(resolve(OUTPUT_STATUS)), { recursive: true });
  await writeJson(OUTPUT_STATUS, status);
  console.log(JSON.stringify(status, null, 2));
}

function buildSprint(input, generatedAt) {
  const sampleThresholdMet = Boolean(input.sampleGate.sample_threshold_met || input.ownerP0Now.sample_threshold_met);
  const dueStatus = input.dueStatus.status ?? input.due.status ?? "unknown";
  const dueNow = Boolean(input.dueStatus.due_now ?? input.due.due_now);
  const overdue = String(dueStatus).includes("overdue");
  const p0Pending = Number(input.progress.p0_pending_count ?? input.batchStatus.p0_pending_count ?? input.ownerP0Now.p0_full_pending_count ?? 0);
  const focusedMissing = Number(input.handoffStatus.missing_count ?? input.ownerP0Now.p0_focused_missing_count ?? 0);
  const fullRows = Number(input.batchStatus.all_p0_row_count ?? input.ownerP0Now.p0_full_row_count ?? 0);
  const fullTasks = Number(input.batchStatus.p0_task_count ?? input.ownerP0Now.p0_full_task_count ?? 0);
  const batch1Rows = Number(input.batchStatus.focused_batch_row_count ?? input.ownerP0Now.p0_batch_1_row_count ?? 0);
  const batch2Rows = Number(input.batchStatus.remaining_batch_row_count ?? input.ownerP0Now.p0_batch_2_row_count ?? 0);
  const status = sampleThresholdMet
    ? "sample_gate_met_sprint_not_needed"
    : overdue
      ? "day3_overdue_collection_sprint_active"
      : dueNow
        ? "sample_gate_due_collection_sprint_active"
        : "sample_gate_collection_sprint_prepared";

  const sourceGroups = Array.isArray(input.handoff.source_groups)
    ? input.handoff.source_groups.map((group) => ({
        source_surface: group.source_surface,
        row_count: Number(group.row_count ?? 0),
        missing_count: Number(group.missing_count ?? 0),
        event_types: group.event_types ?? [],
        external_effect: false,
      }))
    : [];

  const missingRows = Array.isArray(input.handoff.missing_rows)
    ? input.handoff.missing_rows.map((row) => ({
        rank: row.rank,
        role: row.role,
        event_type: row.event_type,
        paste_key: row.paste_key,
        source_surface: row.source_surface,
        evidence_rule: row.evidence_rule,
        external_effect: false,
      }))
    : [];

  const sprintSteps = buildSprintSteps({
    sampleThresholdMet,
    dueStatus,
    dueNow,
    overdue,
    batch1Rows,
    batch2Rows,
    focusedMissing,
    p0Pending,
    input,
  });

  return {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "sample_gate_collection_sprint_local_only",
    status,
    sprint_name: "Week 0 P0 Sample Gate Collection Sprint",
    objective: "Collect aggregate-only P0 page_view, cta_click, and line_add counts so the 7-day growth loop can score with real sample gates.",
    week: input.handoff.current_round?.week ?? input.calendar.week ?? null,
    sample_threshold_met: sampleThresholdMet,
    challenger_win_rule_met: Boolean(input.sampleGate.challenger_win_rule_met),
    no_quality_regression: Boolean(input.sampleGate.no_quality_regression),
    sample_rate_win_candidate: Boolean(input.sampleGate.sample_rate_win_candidate),
    champion_action: input.dueStatus.champion_action ?? input.due.champion_action ?? "keep_champion_sample_insufficient",
    due_status: dueStatus,
    due_phase: input.dueStatus.due_phase ?? input.due.due_phase ?? null,
    due_now: dueNow,
    due_date: input.dueStatus.due_date ?? input.due.due_date ?? null,
    next_due_date: input.calendarStatus.next_due_date ?? input.calendar.next_due_date ?? null,
    preferred_check_date: input.dueStatus.preferred_check_date ?? input.due.preferred_check_date ?? null,
    current_real_event_rows: Number(input.sourceReadiness.real_event_rows ?? input.ownerP0Now.current_real_event_rows ?? 0),
    p0_full_row_count: fullRows,
    p0_full_task_count: fullTasks,
    p0_pending_count: p0Pending,
    p0_batch_count: Number(input.batchStatus.batch_count ?? input.ownerP0Now.p0_batch_count ?? 0),
    p0_batch_1_row_count: batch1Rows,
    p0_batch_2_row_count: batch2Rows,
    focused_missing_count: focusedMissing,
    quick_status: input.quick.status ?? "unknown",
    quick_filled_rank_count: Number(input.quick.filled_rank_count ?? 0),
    quick_missing_rank_count: Number(input.quick.missing_rank_count ?? focusedMissing),
    p0_counts_preflight_status: input.preflight.status ?? "unknown",
    p0_counts_preflight_ready_for_quick_preview: Boolean(input.preflight.ready_for_quick_preview),
    focused_intake_status: input.intake.status ?? "unknown",
    owner_review_required: true,
    source_groups: sourceGroups,
    missing_rows: missingRows,
    sprint_steps: sprintSteps,
    command_sequence_after_owner_counts: [
      "npm run p0:counts-preflight",
      "npm run next-p0:quick",
      "npm run next-p0:intake",
      "npm run owner:data-preflight",
      "npm run owner:sample-gate",
      "npm run owner:next-action",
      "npm run weekly:local",
      "node scripts/verify-artifacts.mjs",
    ],
    owner_open_order: [
      "owner_p0_now.html",
      "sample_gate_batch_1_paste_block.txt",
      "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
      "p0_counts_preflight.md",
      "sample_gate_batch_2_paste_block.txt",
      "sample_gate_owner_form.html",
      "RUN-P0-POST-FILL-CHECK.command",
    ],
    acceptance_checks: [
      "Batch 1 focused P0 counts are filled with non-negative integers.",
      "Batch 2 remaining P0 counts are filled before Week 0 is treated as covered.",
      "capture_date, evidence_ref, reviewer, and pii_checked=yes are present.",
      "Only aggregate counts are used; no customer-level rows or LINE chat text are pasted.",
      "sample_threshold_met remains false until visits, CTA clicks, LINE adds, and minimum days are all met.",
      "No challenger promotion, variable rotation, public link change, deploy, post, LINE push, GitHub push/PR, payment, customer mutation, or delete occurs from this sprint.",
    ],
    blocked_actions: [
      "estimate_or_backfill_missing_counts",
      "stage_owner_download_without_review",
      "append_to_data_lp_events_jsonl",
      "promote_challenger_or_rotate_variable",
      "formal_social_post_or_schedule",
      "line_push_or_broadcast",
      "public_link_change_or_ab_route_change",
      "production_worker_deploy",
      "github_push_or_pr_creation",
      "customer_data_mutation",
      "ecpay_payment_refund_or_capture",
      "delete_data_or_live_assets",
    ],
    review_artifacts: [
      "sample_gate_collection_sprint.md",
      "owner_p0_now.html",
      "sample_gate_batch_handoff.md",
      "owner_sample_count_handoff.md",
      "sample_gate_batch_1_paste_block.txt",
      "sample_gate_batch_2_paste_block.txt",
      "next_p0_quick_capture.md",
      "p0_counts_preflight.md",
      "owner_sample_gate_status.md",
      "sample_gate_due_status.md",
      "redline_priority.md",
    ],
    outputs: {
      sprint_json: OUTPUT_JSON,
      sprint_md: OUTPUT_MD,
      status_json: OUTPUT_STATUS,
    },
    redline_next_operator_action: input.redline.next_operator_action ?? null,
    approval_next_human_gate: input.approval.next_pending_human_id ?? null,
    ...RED_LINE_FALSE,
    note: "Local collection sprint only. It plans owner aggregate-count collection and writes no live input, lp_events, deploy, GitHub, post, LINE, payment, customer-data, or delete action.",
  };
}

function buildSprintSteps({ sampleThresholdMet, dueStatus, dueNow, overdue, batch1Rows, batch2Rows, focusedMissing, p0Pending, input }) {
  if (sampleThresholdMet) {
    return [
      {
        order: 1,
        phase: "audit_only",
        title: "Sample gate already met",
        artifact: "owner_sample_gate_status.md",
        status: "not_primary_action",
        owner_action_required: false,
        external_effect: false,
      },
    ];
  }

  const urgency = overdue ? "overdue" : dueNow ? "due_now" : "prepared";
  return [
    {
      order: 1,
      phase: "batch_1_focused_counts",
      title: "Fill focused P0 counts first",
      status: focusedMissing > 0 ? "waiting_for_owner_aggregate_counts" : "filled_or_preview_ready",
      urgency,
      artifact: "sample_gate_batch_1_paste_block.txt",
      row_count: batch1Rows,
      missing_count: focusedMissing,
      owner_action_required: focusedMissing > 0,
      timebox_minutes: 20,
      external_effect: false,
    },
    {
      order: 2,
      phase: "preflight_and_preview",
      title: "Validate paste template and generate preview only",
      status: input.preflight.ready_for_quick_preview ? "ready_for_preview" : input.preflight.status ?? "waiting_for_counts",
      artifact: "p0_counts_preflight.md",
      command: "npm run p0:counts-preflight && npm run next-p0:quick && npm run next-p0:intake",
      owner_action_required: false,
      timebox_minutes: 10,
      external_effect: false,
    },
    {
      order: 3,
      phase: "batch_2_remaining_counts",
      title: "Complete remaining content-variant P0 rows",
      status: p0Pending > focusedMissing ? "waiting_for_full_p0_coverage" : "not_needed_or_already_covered",
      artifact: "sample_gate_batch_2_paste_block.txt",
      row_count: batch2Rows,
      missing_count: Math.max(0, p0Pending - focusedMissing),
      owner_action_required: p0Pending > focusedMissing,
      timebox_minutes: 20,
      external_effect: false,
    },
    {
      order: 4,
      phase: "local_recompute",
      title: "Recompute local weekly artifacts after owner counts",
      status: "queued_after_owner_counts",
      artifact: "RUN-P0-POST-FILL-CHECK.command",
      command: "./RUN-P0-POST-FILL-CHECK.command",
      owner_action_required: false,
      timebox_minutes: 10,
      external_effect: false,
    },
    {
      order: 5,
      phase: "sample_gate_decision",
      title: "Keep champion until threshold and quality gates are proven",
      status: dueStatus,
      artifact: "owner_sample_gate_status.md",
      owner_action_required: false,
      timebox_minutes: 5,
      external_effect: false,
    },
  ];
}

function buildStatus(sprint) {
  return {
    ok: sprint.ok,
    generated_at: sprint.generated_at,
    mode: sprint.mode,
    status: sprint.status,
    sample_threshold_met: sprint.sample_threshold_met,
    challenger_win_rule_met: sprint.challenger_win_rule_met,
    due_status: sprint.due_status,
    due_now: sprint.due_now,
    due_date: sprint.due_date,
    next_due_date: sprint.next_due_date,
    current_real_event_rows: sprint.current_real_event_rows,
    p0_full_row_count: sprint.p0_full_row_count,
    p0_full_task_count: sprint.p0_full_task_count,
    p0_pending_count: sprint.p0_pending_count,
    focused_missing_count: sprint.focused_missing_count,
    sprint_step_count: sprint.sprint_steps.length,
    owner_open_target_count: sprint.owner_open_order.length,
    acceptance_check_count: sprint.acceptance_checks.length,
    blocked_action_count: sprint.blocked_actions.length,
    owner_review_required: sprint.owner_review_required,
    outputs: sprint.outputs,
    ...RED_LINE_FALSE,
  };
}

function renderMarkdown(sprint) {
  return `# 3Q Growth Loop Sample Gate Collection Sprint

BLUF: ${sprint.sample_threshold_met ? "Sample gate is already met; keep this sprint for audit only." : `P0 sample collection is still the blocker: ${sprint.p0_pending_count}/${sprint.p0_full_task_count} P0 rows are pending, due status is ${sprint.due_status}, and the champion must stay active until the sample gate is proven.`}

Generated: ${sprint.generated_at}
Mode: ${sprint.mode}
Status: ${sprint.status}
External effect: no
data/lp_events.jsonl write performed: no

## Current Sprint State

- Real event rows: ${sprint.current_real_event_rows}
- Sample threshold met: ${sprint.sample_threshold_met ? "yes" : "no"}
- Challenger win rule met: ${sprint.challenger_win_rule_met ? "yes" : "no"}
- Champion action: ${sprint.champion_action}
- Due status: ${sprint.due_status}
- Due date: ${sprint.due_date ?? "n/a"}
- Next due date: ${sprint.next_due_date ?? "n/a"}
- Preferred check date: ${sprint.preferred_check_date ?? "n/a"}
- Focused missing counts: ${sprint.focused_missing_count}
- Full P0 pending: ${sprint.p0_pending_count}/${sprint.p0_full_task_count}

## Sprint Steps

| order | phase | status | artifact | owner action | timebox |
|---:|---|---|---|---|---:|
${sprint.sprint_steps.map((step) => `| ${step.order} | ${step.phase} | ${step.status} | \`${step.artifact}\` | ${step.owner_action_required ? "yes" : "no"} | ${step.timebox_minutes ?? 0}m |`).join("\n")}

## Source Groups

| source | rows | missing | event types |
|---|---:|---:|---|
${sprint.source_groups.map((group) => `| ${group.source_surface} | ${group.row_count} | ${group.missing_count} | ${(group.event_types ?? []).join(", ")} |`).join("\n") || "| n/a | 0 | 0 | n/a |"}

## Owner Open Order

${sprint.owner_open_order.map((item, index) => `${index + 1}. \`${item}\``).join("\n")}

## Commands After Owner Counts

\`\`\`zsh
${sprint.command_sequence_after_owner_counts.join("\n")}
\`\`\`

## Acceptance Checks

${sprint.acceptance_checks.map((item) => `- ${item}`).join("\n")}

## Blocked Actions

${sprint.blocked_actions.map((item) => `- ${item}`).join("\n")}

## Safety

- Aggregate counts only.
- No customer names, phone, email, LINE IDs, chat text, payment data, order IDs, refund data, private notes, or customer-level rows.
- No production deploy, GitHub push/PR, public link change, formal post, LINE push, customer-data mutation, payment action, or delete action.
`;
}

async function readJson(relativePath, fallback) {
  try {
    const raw = await readFile(resolve(relativePath), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (fallback !== undefined && error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(relativePath, value) {
  await mkdir(path.dirname(resolve(relativePath)), { recursive: true });
  await writeFile(resolve(relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function resolve(relativePath) {
  return path.join(ROOT, relativePath);
}

main();
