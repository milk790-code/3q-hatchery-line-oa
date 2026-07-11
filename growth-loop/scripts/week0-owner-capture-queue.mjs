import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const SAMPLE_PLAN_PATH = path.join(ROOT, "sample_gate_collection_plan.json");
const DATA_QUEUE_PATH = path.join(ROOT, "data_collection_queue.json");
const SOURCE_READINESS_PATH = path.join(ROOT, "data", "source_readiness_status.json");
const SAMPLE_FILLED_PATH = path.join(ROOT, "data", "source_capture", "sample_gate_ledger.filled.csv");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const STATUS_PATH = path.join(ROOT, "data", "week0_owner_capture_queue_status.json");
const JSON_PATH = path.join(ROOT, "week0_owner_capture_queue.json");
const REPORT_PATH = path.join(ROOT, "week0_owner_capture_queue.md");

const EVENT_LABELS = {
  page_view: "落地頁瀏覽",
  cta_click: "CTA 點擊",
  line_add: "LINE 進線 / 加好友",
};

async function main() {
  const generatedAt = new Date();
  const samplePlan = await readJson(SAMPLE_PLAN_PATH);
  const dataQueue = await readJson(DATA_QUEUE_PATH);
  const sourceReadiness = await readJson(SOURCE_READINESS_PATH);
  const realEventsBefore = await countLines(REAL_EVENTS_PATH);
  const sampleFilledExists = await exists(SAMPLE_FILLED_PATH);
  const captureRows = buildCaptureRows(samplePlan);
  const sourceGroups = buildSourceGroups(captureRows);
  const fastestPath = buildFastestPath(samplePlan, sampleFilledExists);
  const realEventsAfter = await countLines(REAL_EVENTS_PATH);

  const queue = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "week0_owner_capture_queue",
    status: sampleFilledExists ? "owner_sample_gate_filled_compile_next" : "waiting_for_owner_sample_gate_counts",
    week: samplePlan.week,
    current_round: samplePlan.current_round,
    sample_progress: samplePlan.sample_progress,
    sample_thresholds: {
      min_visits: samplePlan.sample_progress?.min_visits,
      min_cta_clicks: samplePlan.sample_progress?.min_cta_clicks,
      min_line_adds: samplePlan.sample_progress?.min_line_adds,
      min_test_days: samplePlan.sample_progress?.min_test_days,
      preferred_test_days: samplePlan.sample_progress?.preferred_test_days,
    },
    global_sample_gaps: samplePlan.global_sample_gaps,
    data_collection_status: dataQueue.status,
    source_readiness_status: sourceReadiness.status,
    p0_task_count: captureRows.length,
    p0_link_count: samplePlan.p0_link_count,
    source_group_count: sourceGroups.length,
    capture_rows: captureRows,
    source_groups: sourceGroups,
    fastest_path: fastestPath,
    owner_fill: {
      template_path: samplePlan.sample_gate_ledger_template_path,
      owner_fill_path: samplePlan.owner_sample_gate_fill_path,
      filled_exists: sampleFilledExists,
      required_fields: ["capture_date", "aggregate_count", "evidence_ref", "reviewer", "pii_checked"],
      compile_preview_command: samplePlan.sample_gate_compile_preview_command,
    },
    screen_level_instructions: [
      {
        surface: "Candidate Worker / landing page analytics",
        collect: ["page_view", "cta_click"],
        result: "Fill aggregate page_view and cta_click counts per tracking_link_id/content_id/variant_id.",
        stop_before: "Do not run production deploy, remote D1 mutation, public link change, or customer-level export.",
      },
      {
        surface: "LINE OA 管理後台",
        collect: ["line_add"],
        result: "Fill only aggregate LINE add / inbound counts per tracking context.",
        stop_before: "Do not send LINE push, export LINE user IDs, paste names, paste chat text, or mutate customer records.",
      },
    ],
    safety_rules: [
      "Only aggregate counts are allowed.",
      "Evidence refs must be local screenshot/export references, not raw customer rows.",
      "Do not paste phone, email, LINE user ID, customer name, chat text, payment data, order IDs, refund details, or private notes.",
      "Sample-insufficient rounds must keep the current champion and current variable.",
      "This queue never creates live CSVs, appends data/lp_events.jsonl, deploys, posts, pushes LINE, changes public links, mutates customer data, touches payments, or deletes data.",
    ],
    next_safe_command_after_owner_fill: samplePlan.sample_gate_compile_preview_command,
    real_events_before: realEventsBefore,
    real_events_after: realEventsAfter,
    real_events_unchanged: realEventsBefore === realEventsAfter,
    live_input_files_created: false,
    apply_performed: false,
    append_performed: false,
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

  const status = {
    ok: queue.ok,
    generated_at: queue.generated_at,
    mode: queue.mode,
    status: queue.status,
    queue_path: JSON_PATH,
    report_path: REPORT_PATH,
    p0_task_count: queue.p0_task_count,
    p0_link_count: queue.p0_link_count,
    source_group_count: queue.source_group_count,
    sample_filled_exists: sampleFilledExists,
    owner_fill_path: queue.owner_fill.owner_fill_path,
    next_safe_command_after_owner_fill: queue.next_safe_command_after_owner_fill,
    real_events_unchanged: queue.real_events_unchanged,
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

  await writeJson(JSON_PATH, queue);
  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(queue));
  console.log(JSON.stringify(status, null, 2));
}

function buildCaptureRows(samplePlan) {
  return (samplePlan.link_groups ?? []).flatMap((group) =>
    (samplePlan.required_event_types ?? []).map((eventType) => {
      const task = group.tasks_by_event_type?.[eventType] ?? {};
      return {
        order: group.collection_order,
        tracking_link_id: group.tracking_link_id,
        role: group.role,
        asset_id: group.asset_id,
        content_id: group.content_id,
        variant_id: group.variant_id,
        event_type: eventType,
        event_label: EVENT_LABELS[eventType] ?? eventType,
        source_surface: task.source_surface ?? "unknown",
        source_metric: task.source_metric ?? "unknown",
        target_live_file: task.target_live_file ?? "unknown",
        evidence_rule: task.evidence_rule ?? "Aggregate counts only.",
        owner_fill_path: samplePlan.owner_sample_gate_fill_path,
        fill_fields: ["capture_date", "aggregate_count", "evidence_ref", "reviewer", "pii_checked"],
        external_effect: false,
      };
    }),
  );
}

function buildSourceGroups(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.source_surface)) {
      groups.set(row.source_surface, {
        source_surface: row.source_surface,
        event_types: new Set(),
        row_count: 0,
        tracking_link_count: new Set(),
        rows: [],
        external_effect: false,
      });
    }
    const group = groups.get(row.source_surface);
    group.event_types.add(row.event_type);
    group.tracking_link_count.add(row.tracking_link_id);
    group.row_count += 1;
    group.rows.push({
      tracking_link_id: row.tracking_link_id,
      role: row.role,
      content_id: row.content_id,
      variant_id: row.variant_id,
      event_type: row.event_type,
      target_live_file: row.target_live_file,
      evidence_rule: row.evidence_rule,
      external_effect: false,
    });
  }

  return Array.from(groups.values()).map((group) => ({
    source_surface: group.source_surface,
    event_types: Array.from(group.event_types),
    row_count: group.row_count,
    tracking_link_count: group.tracking_link_count.size,
    rows: group.rows,
    owner_instruction: instructionForSurface(group.source_surface, Array.from(group.event_types)),
    external_effect: false,
  }));
}

function buildFastestPath(samplePlan, sampleFilledExists) {
  return [
    {
      order: 1,
      action: "create_sample_gate_working_copy",
      status: sampleFilledExists ? "already_exists" : "owner_local_review_required",
      command: "cp data/source_capture/sample_gate_ledger.fill-template.csv data/source_capture/sample_gate_ledger.filled.csv",
      evidence: sampleFilledExists ? "sample_gate_ledger.filled.csv exists" : "working copy not detected",
      external_effect: false,
    },
    {
      order: 2,
      action: "fill_18_aggregate_rows",
      status: "owner_manual_input_required",
      command: "Open data/source_capture/sample_gate_ledger.filled.csv and fill capture_date, aggregate_count, evidence_ref, reviewer, pii_checked.",
      evidence: `${samplePlan.p0_task_count ?? 18} P0 rows across ${samplePlan.p0_link_count ?? 6} links`,
      external_effect: false,
    },
    {
      order: 3,
      action: "compile_owner_preview",
      status: "ready_after_owner_counts",
      command: samplePlan.sample_gate_compile_preview_command,
      evidence: "preview-only compile; no live CSV or lp_events append",
      external_effect: false,
    },
    {
      order: 4,
      action: "review_decision_artifacts",
      status: "ready_after_compile",
      command: "Open source_capture_compile_report.md, sample_gate_collection_plan.md, and next_round_plan.md.",
      evidence: "sample-insufficient still keeps champion",
      external_effect: false,
    },
  ];
}

function instructionForSurface(surface, eventTypes) {
  if (surface.includes("LINE")) {
    return `Collect only aggregate ${eventTypes.join(" / ")} counts from LINE OA or inbound customer-service summaries. Do not export user IDs, names, chat text, notes, or customer rows.`;
  }
  if (surface.includes("Worker") || surface.includes("analytics")) {
    return `Collect aggregate ${eventTypes.join(" / ")} counts by asset_id, content_id, variant_id, and tracking_link_id. Do not mutate D1 or export row-level visitor data.`;
  }
  return `Collect aggregate ${eventTypes.join(" / ")} counts only. Keep customer-level details out.`;
}

function renderReport(queue) {
  const gapRows = Object.entries(queue.global_sample_gaps ?? {})
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join("\n");
  const sourceRows = queue.source_groups
    .map((group) => `| ${group.source_surface} | ${group.event_types.join(", ")} | ${group.row_count} | ${group.tracking_link_count} | ${group.owner_instruction} |`)
    .join("\n");
  const captureRows = queue.capture_rows
    .map((row) => `| ${row.order} | ${row.tracking_link_id} | ${row.role} | ${row.event_type} | ${row.content_id} | ${row.variant_id} | ${row.source_surface} |`)
    .join("\n");
  const pathRows = queue.fastest_path
    .map((step) => `| ${step.order} | ${step.action} | ${step.status} | \`${step.command}\` |`)
    .join("\n");

  return `# Week 0 Owner Capture Queue

BLUF: ${queue.status}. This is the shortest owner-facing queue for collecting the Week 0 sample-gate counts: page_view, cta_click, and line_add only. It is local and read-only.

Generated: ${queue.generated_at}
Week: ${queue.week?.start ?? "n/a"} to ${queue.week?.end ?? "n/a"}
Changed variable: ${queue.current_round?.changed_variable ?? "n/a"}
P0 rows: ${queue.p0_task_count}
P0 links: ${queue.p0_link_count}
Owner fill path: ${queue.owner_fill.owner_fill_path}
Template: ${queue.owner_fill.template_path}
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

## Sample Gaps

| gate | gap |
|---|---:|
${gapRows}

## Source Groups

| source | events | rows | links | instruction |
|---|---|---:|---:|---|
${sourceRows}

## Capture Rows

| order | tracking link | role | event | content | variant | source |
|---:|---|---|---|---|---|---|
${captureRows}

## Fastest Path

| order | action | status | command |
|---:|---|---|---|
${pathRows}

## Fields To Fill

- capture_date
- aggregate_count
- evidence_ref
- reviewer
- pii_checked

## Safety Rules

${queue.safety_rules.map((rule) => `- ${rule}`).join("\n")}
`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function countLines(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw.split(/\r?\n/).filter((line) => line.trim()).length;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
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
