import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "config", "growth-loop.config.json");
const TRACKING_LINKS_PATH = path.join(ROOT, "tracking_links.json");
const SOURCE_READINESS_PATH = path.join(ROOT, "data", "source_readiness_status.json");
const SOURCE_CAPTURE_CHECKLIST_PATH = path.join(ROOT, "data", "source_capture", "source_capture_checklist.json");
const SOURCE_COMPILE_STATUS_PATH = path.join(ROOT, "data", "source_capture_compile_status.json");
const REAL_DATA_INTAKE_STATUS_PATH = path.join(ROOT, "data", "real_data_intake_status.json");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const FILLED_LEDGER_PATH = path.join(ROOT, "data", "source_capture", "source_capture_ledger.filled.csv");
const SAMPLE_GATE_LEDGER_TEMPLATE_PATH = path.join(ROOT, "data", "source_capture", "sample_gate_ledger.fill-template.csv");
const SAMPLE_GATE_LEDGER_FILLED_PATH = path.join(ROOT, "data", "source_capture", "sample_gate_ledger.filled.csv");
const SAMPLE_GATE_LEDGER_STATUS_PATH = path.join(ROOT, "data", "sample_gate_ledger_status.json");
const STATUS_PATH = path.join(ROOT, "data", "data_collection_brief_status.json");
const QUEUE_PATH = path.join(ROOT, "data_collection_queue.json");
const BRIEF_PATH = path.join(ROOT, "data_collection_brief.md");
const SAMPLE_GATE_PLAN_PATH = path.join(ROOT, "sample_gate_collection_plan.json");
const SAMPLE_GATE_PLAN_REPORT_PATH = path.join(ROOT, "sample_gate_collection_plan.md");
const SAMPLE_GATE_STATUS_PATH = path.join(ROOT, "data", "sample_gate_collection_plan_status.json");

const SAMPLE_STAGE_MAP = {
  page_view: "visits",
  cta_click: "cta_clicks",
  line_add: "line_adds",
};

const SAMPLE_EVENT_TYPES = Object.keys(SAMPLE_STAGE_MAP);
const STAGE_ORDER = ["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"];

async function main() {
  const generatedAt = new Date();
  const config = await readJson(CONFIG_PATH);
  const trackingLinks = await readJson(TRACKING_LINKS_PATH);
  const sourceReadiness = await readJson(SOURCE_READINESS_PATH);
  const sourceCaptureChecklist = await readJson(SOURCE_CAPTURE_CHECKLIST_PATH);
  const sourceCompile = await readJson(SOURCE_COMPILE_STATUS_PATH);
  const realDataIntake = await readJson(REAL_DATA_INTAKE_STATUS_PATH);
  const sampleGateLedger = await readOptionalJson(SAMPLE_GATE_LEDGER_STATUS_PATH, { ok: false, row_count: 0, link_count: 0 });
  const realEventsBefore = await countLines(REAL_EVENTS_PATH);
  const filledLedgerExists = await exists(FILLED_LEDGER_PATH);
  const week = trackingLinks.week ?? sourceReadiness.week ?? currentTaipeiWeek(generatedAt);
  const stages = Array.isArray(sourceCaptureChecklist.stages) ? sourceCaptureChecklist.stages : [];
  const links = Array.isArray(sourceCaptureChecklist.links) ? sourceCaptureChecklist.links : [];
  const importableLinks = links.filter((link) => link.importable_in_current_templates);
  const gatedLinks = links.filter((link) => !link.importable_in_current_templates);
  const sampleProgress = sourceReadiness.sample_progress ?? {};
  const stagePriorities = buildStagePriorities(stages, sourceReadiness, sampleProgress);
  const tasks = buildTasks({ week, importableLinks, stages, stagePriorities });
  const immediateActions = buildImmediateActions({ filledLedgerExists, sourceCompile, realDataIntake });
  const realEventsAfter = await countLines(REAL_EVENTS_PATH);

  const queue = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "data_collection_brief",
    status: filledLedgerExists ? "owner_filled_ledger_detected_compile_next" : "waiting_for_owner_aggregate_counts",
    operator: config.operator,
    week,
    current_round: {
      changed_variable: config.current_round?.changed_variable ?? "unknown",
      one_variable_rule: config.one_variable_per_round ?? [],
    },
    sample_progress: {
      min_visits: sampleProgress.min_visits ?? config.sample_thresholds?.min_visits,
      min_cta_clicks: sampleProgress.min_cta_clicks ?? config.sample_thresholds?.min_cta_clicks,
      min_line_adds: sampleProgress.min_line_adds ?? config.sample_thresholds?.min_line_adds,
      min_test_days: sampleProgress.min_test_days ?? config.sample_thresholds?.min_test_days,
      preferred_test_days: sampleProgress.preferred_test_days ?? config.sample_thresholds?.preferred_test_days,
      current_visits: sampleProgress.current_visits ?? 0,
      current_cta_clicks: sampleProgress.current_cta_clicks ?? 0,
      current_line_adds: sampleProgress.current_line_adds ?? 0,
      current_test_days: sampleProgress.current_test_days ?? 0,
      gaps: sampleProgress.gaps ?? {},
      sample_threshold_met: Boolean(sampleProgress.sample_threshold_met),
    },
    source_readiness: {
      status: sourceReadiness.status ?? "unknown",
      missing_stage_count: sourceReadiness.missing_stage_count ?? 0,
      missing_stages: sourceReadiness.missing_stages ?? [],
      ready_for_public_iteration_decision: Boolean(sourceReadiness.ready_for_public_iteration_decision),
      champion_url_ready: Boolean(sourceReadiness.champion_url_ready),
    },
    source_compile: {
      status: sourceCompile.status ?? "unknown",
      input_kind: sourceCompile.input_kind ?? "unknown",
      filled_rows: sourceCompile.filled_rows ?? 0,
      issue_count: sourceCompile.issue_count ?? 0,
      data_lp_events_write_performed: Boolean(sourceCompile.data_lp_events_write_performed),
    },
    sample_gate_ledger: {
      ok: Boolean(sampleGateLedger.ok),
      status: sampleGateLedger.status ?? "unknown",
      row_count: sampleGateLedger.row_count ?? 0,
      link_count: sampleGateLedger.link_count ?? 0,
      template_path: "data/source_capture/sample_gate_ledger.fill-template.csv",
      owner_fill_path: "data/source_capture/sample_gate_ledger.filled.csv",
      compile_preview_command: sampleGateLedger.compile_preview_command ?? "npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled",
      data_lp_events_write_performed: Boolean(sampleGateLedger.data_lp_events_write_performed),
      external_effect: Boolean(sampleGateLedger.external_effect),
    },
    real_data_intake: {
      status: realDataIntake.status ?? "unknown",
      ready_apply_count: realDataIntake.ready_apply_count ?? 0,
      missing_input_count: realDataIntake.missing_input_count ?? 0,
      data_lp_events_write_performed: Boolean(realDataIntake.data_lp_events_write_performed),
    },
    filled_ledger_exists: filledLedgerExists,
    importable_link_count: importableLinks.length,
    gated_link_count: gatedLinks.length,
    stage_count: stages.length,
    task_count: tasks.length,
    stage_priorities: stagePriorities,
    tasks,
    gated_links: gatedLinks.map((link) => ({
      link_id: link.link_id,
      role: link.role,
      asset_id: link.asset_id,
      human_gate: link.human_gate,
    })),
    immediate_actions: immediateActions,
    owner_only_actions: [
      "Fill aggregate_count, capture_date, evidence_ref, reviewer, and pii_checked in data/source_capture/source_capture_ledger.filled.csv.",
      "Review source_capture_compile_report.md before copying owner-preview CSVs to live input filenames.",
      "Review real_data_intake_plan.md before running any local apply command that appends data/lp_events.jsonl.",
    ],
    safety_rules: [
      "Aggregate counts only.",
      "No phone, email, LINE user ID, customer name, chat text, payment data, private notes, order IDs, or refund details.",
      "Evidence refs should be local screenshot/export paths or source labels, not raw customer rows.",
      "This brief never creates live input CSVs, appends data/lp_events.jsonl, deploys, posts, pushes LINE, changes public links, mutates customer data, touches payments, or deletes data.",
    ],
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

  const sampleGatePlan = buildSampleGatePlan(queue);
  queue.sample_gate_collection_plan = {
    status: sampleGatePlan.status,
    p0_task_count: sampleGatePlan.p0_task_count,
    p0_link_count: sampleGatePlan.p0_link_count,
    required_event_types: sampleGatePlan.required_event_types,
    global_sample_gaps: sampleGatePlan.global_sample_gaps,
    report_path: "sample_gate_collection_plan.md",
    json_path: "sample_gate_collection_plan.json",
    status_path: "data/sample_gate_collection_plan_status.json",
    external_effect: false,
  };

  const sampleGateStatus = {
    ok: sampleGatePlan.ok,
    generated_at: sampleGatePlan.generated_at,
    mode: sampleGatePlan.mode,
    status: sampleGatePlan.status,
    plan_path: SAMPLE_GATE_PLAN_PATH,
    report_path: SAMPLE_GATE_PLAN_REPORT_PATH,
    p0_task_count: sampleGatePlan.p0_task_count,
    p0_link_count: sampleGatePlan.p0_link_count,
    sample_stage_count: sampleGatePlan.sample_stage_count,
    required_event_types: sampleGatePlan.required_event_types,
    global_sample_gaps: sampleGatePlan.global_sample_gaps,
    filled_ledger_exists: sampleGatePlan.filled_ledger_exists,
    owner_fill_path: sampleGatePlan.owner_fill_path,
    real_events_unchanged: sampleGatePlan.real_events_unchanged,
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

  const status = {
    ok: queue.ok,
    generated_at: queue.generated_at,
    mode: queue.mode,
    status: queue.status,
    queue_path: QUEUE_PATH,
    brief_path: BRIEF_PATH,
    sample_gate_plan_path: SAMPLE_GATE_PLAN_PATH,
    sample_gate_plan_report_path: SAMPLE_GATE_PLAN_REPORT_PATH,
    sample_gate_plan_status_path: SAMPLE_GATE_STATUS_PATH,
    sample_gate_status: sampleGateStatus.status,
    sample_gate_p0_task_count: sampleGateStatus.p0_task_count,
    sample_gate_p0_link_count: sampleGateStatus.p0_link_count,
    sample_gate_stage_count: sampleGateStatus.sample_stage_count,
    sample_gate_ledger_template_path: SAMPLE_GATE_LEDGER_TEMPLATE_PATH,
    sample_gate_ledger_filled_path: SAMPLE_GATE_LEDGER_FILLED_PATH,
    sample_gate_ledger_status_path: SAMPLE_GATE_LEDGER_STATUS_PATH,
    sample_gate_ledger_rows: sampleGateLedger.row_count ?? 0,
    task_count: queue.task_count,
    stage_count: queue.stage_count,
    importable_link_count: queue.importable_link_count,
    gated_link_count: queue.gated_link_count,
    filled_ledger_exists: queue.filled_ledger_exists,
    sample_gate_ledger_ready: Boolean(sampleGateLedger.ok),
    sample_threshold_met: queue.sample_progress.sample_threshold_met,
    missing_stage_count: queue.source_readiness.missing_stage_count,
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

  await writeJson(QUEUE_PATH, queue);
  await writeJson(SAMPLE_GATE_PLAN_PATH, sampleGatePlan);
  await writeJson(SAMPLE_GATE_STATUS_PATH, sampleGateStatus);
  await writeJson(STATUS_PATH, status);
  await writeFile(SAMPLE_GATE_PLAN_REPORT_PATH, renderSampleGatePlan(sampleGatePlan));
  await writeFile(BRIEF_PATH, renderBrief(queue));
  console.log(JSON.stringify(status, null, 2));
}

function buildStagePriorities(stages, sourceReadiness, sampleProgress) {
  const missing = new Set(sourceReadiness.missing_stages ?? []);
  const gaps = sampleProgress.gaps ?? {};
  return stages
    .slice()
    .sort((a, b) => STAGE_ORDER.indexOf(a.event_type) - STAGE_ORDER.indexOf(b.event_type))
    .map((stage) => {
      const sampleKey = SAMPLE_STAGE_MAP[stage.event_type] ?? null;
      const sampleGap = sampleKey ? gaps[sampleKey] ?? 0 : 0;
      const priority = sampleGap > 0 ? "P0_sample_gate" : missing.has(stage.event_type) ? "P1_funnel_completeness" : "P2_quality_context";
      return {
        event_type: stage.event_type,
        label: stage.label,
        priority,
        sample_gate_key: sampleKey,
        sample_gap: sampleGap,
        source_surface: stage.source_surface,
        source_metric: stage.source_metric,
        target_template: stage.target_template,
        target_live_file: stage.target_live_file,
        evidence_rule: stage.evidence_rule,
      };
    });
}

function buildTasks({ week, importableLinks, stages, stagePriorities }) {
  const stageById = new Map(stages.map((stage) => [stage.event_type, stage]));
  const priorityByStage = new Map(stagePriorities.map((stage) => [stage.event_type, stage]));
  const tasks = [];
  for (const link of importableLinks) {
    for (const eventType of STAGE_ORDER) {
      const stage = stageById.get(eventType);
      if (!stage) continue;
      const priority = priorityByStage.get(eventType);
      tasks.push({
        task_id: safeId(`${week.start}-${link.link_id}-${eventType}`),
        priority: priority?.priority ?? "P2_quality_context",
        week_start: week.start,
        week_end: week.end,
        event_type: eventType,
        stage_label: stage.label,
        sample_gate_key: priority?.sample_gate_key ?? null,
        sample_gap: priority?.sample_gap ?? 0,
        tracking_link_id: link.link_id,
        role: link.role,
        asset_id: link.asset_id,
        content_id: link.content_id,
        variant_id: link.variant_id,
        source_surface: stage.source_surface,
        source_metric: stage.source_metric,
        target_live_file: stage.target_live_file,
        owner_fill_path: "data/source_capture/source_capture_ledger.filled.csv",
        required_owner_fields: ["capture_date", "aggregate_count", "evidence_ref", "reviewer", "pii_checked"],
        evidence_rule: stage.evidence_rule,
        external_effect: false,
      });
    }
  }
  return tasks;
}

function buildImmediateActions({ filledLedgerExists, sourceCompile, realDataIntake }) {
  if (!filledLedgerExists) {
    return [
      {
        id: "create_owner_filled_ledger_copy",
        status: "owner_local_review_required",
        command: "cp data/source_capture/source_capture_ledger.fill-template.csv data/source_capture/source_capture_ledger.filled.csv",
        note: "Run locally only after reviewing the template. This creates an owner working copy, not a live scoring input.",
        external_effect: false,
      },
      {
        id: "fill_aggregate_counts",
        status: "owner_manual_input_required",
        command: "Open data/source_capture/source_capture_ledger.filled.csv and fill aggregate_count plus evidence fields.",
        note: "Use aggregate counts only. Do not paste customer rows or chat text.",
        external_effect: false,
      },
    ];
  }

  if ((sourceCompile.filled_rows ?? 0) === 0 || sourceCompile.status === "waiting_for_filled_counts") {
    return [
      {
        id: "compile_filled_source_ledger",
        status: "ready_local_preview",
        command: "npm run source:compile",
        note: "Preview-only compile. It writes owner-preview CSV candidates and does not create live input CSVs.",
        external_effect: false,
      },
    ];
  }

  if ((realDataIntake.ready_apply_count ?? 0) === 0) {
    return [
      {
        id: "review_and_copy_owner_preview_csvs",
        status: "owner_review_required",
        command: "cp data/source_capture/compiled/funnel_aggregates.owner-preview.csv data/funnel_aggregates.csv && cp data/source_capture/compiled/manual_conversions.owner-preview.csv data/manual_conversions.csv",
        note: "Do this only after owner review. These live CSVs are still previewed before any apply.",
        external_effect: false,
      },
      {
        id: "preview_real_data_intake",
        status: "ready_after_live_csv_copy",
        command: "npm run real-data:intake",
        note: "Preview-only intake; apply commands remain owner-gated.",
        external_effect: false,
      },
    ];
  }

  return [
    {
      id: "review_owner_apply_commands",
      status: "owner_review_required",
      command: "Open real_data_intake_plan.md and review the listed local apply commands.",
      note: "Any apply appends data/lp_events.jsonl and stays owner-reviewed local action.",
      external_effect: false,
    },
  ];
}

function buildSampleGatePlan(queue) {
  const p0Tasks = queue.tasks.filter((task) => task.priority === "P0_sample_gate" && SAMPLE_EVENT_TYPES.includes(task.event_type));
  const roleOrder = new Map([
    ["champion", 0],
    ["challenger", 1],
    ["line_cta", 2],
    ["content_variant", 3],
  ]);
  const linkMap = new Map();

  for (const task of p0Tasks) {
    if (!linkMap.has(task.tracking_link_id)) {
      linkMap.set(task.tracking_link_id, {
        tracking_link_id: task.tracking_link_id,
        role: task.role,
        asset_id: task.asset_id,
        content_id: task.content_id,
        variant_id: task.variant_id,
        tasks_by_event_type: {},
      });
    }
    linkMap.get(task.tracking_link_id).tasks_by_event_type[task.event_type] = {
      task_id: task.task_id,
      event_type: task.event_type,
      sample_gate_key: task.sample_gate_key,
      global_sample_gap: task.sample_gap,
      source_surface: task.source_surface,
      source_metric: task.source_metric,
      target_live_file: task.target_live_file,
      owner_fill_path: task.owner_fill_path,
      evidence_rule: task.evidence_rule,
      external_effect: false,
    };
  }

  const linkGroups = Array.from(linkMap.values())
    .sort((a, b) => {
      const roleDiff = (roleOrder.get(a.role) ?? 99) - (roleOrder.get(b.role) ?? 99);
      if (roleDiff !== 0) return roleDiff;
      return String(a.tracking_link_id).localeCompare(String(b.tracking_link_id));
    })
    .map((group, index) => ({
      collection_order: index + 1,
      ...group,
    }));

  const event_summaries = SAMPLE_EVENT_TYPES.map((eventType) => {
    const metric = sampleMetric(queue, eventType);
    const tasksForEvent = p0Tasks.filter((task) => task.event_type === eventType);
    return {
      event_type: eventType,
      sample_gate_key: SAMPLE_STAGE_MAP[eventType],
      current: metric.current,
      target_minimum: metric.minimum,
      preferred_target: metric.preferred,
      global_sample_gap: metric.gap,
      p0_task_count: tasksForEvent.length,
      source_surfaces: unique(tasksForEvent.map((task) => task.source_surface)),
      source_metrics: unique(tasksForEvent.map((task) => task.source_metric)),
      target_live_files: unique(tasksForEvent.map((task) => task.target_live_file)),
    };
  });

  const globalSampleGaps = {
    visits: queue.sample_progress.gaps.visits ?? 0,
    cta_clicks: queue.sample_progress.gaps.cta_clicks ?? 0,
    line_adds: queue.sample_progress.gaps.line_adds ?? 0,
    test_days: queue.sample_progress.gaps.test_days ?? 0,
  };

  return {
    ok: true,
    generated_at: queue.generated_at,
    mode: "sample_gate_collection_plan",
    status: queue.sample_progress.sample_threshold_met ? "sample_threshold_met" : "waiting_for_sample_gate_counts",
    operator: queue.operator,
    week: queue.week,
    current_round: queue.current_round,
    required_event_types: SAMPLE_EVENT_TYPES,
    sample_stage_count: SAMPLE_EVENT_TYPES.length,
    p0_task_count: p0Tasks.length,
    p0_link_count: linkGroups.length,
    global_sample_gaps: globalSampleGaps,
    sample_progress: queue.sample_progress,
    event_summaries,
    link_groups: linkGroups,
    owner_fill_path: "data/source_capture/source_capture_ledger.filled.csv",
    owner_sample_gate_fill_path: "data/source_capture/sample_gate_ledger.filled.csv",
    sample_gate_ledger_template_path: "data/source_capture/sample_gate_ledger.fill-template.csv",
    sample_gate_ledger_status_path: "data/sample_gate_ledger_status.json",
    sample_gate_ledger_rows: queue.sample_gate_ledger.row_count,
    sample_gate_ledger_ready: queue.sample_gate_ledger.ok,
    sample_gate_compile_preview_command: queue.sample_gate_ledger.compile_preview_command,
    immediate_actions: [
      {
        id: "open_sample_gate_plan",
        status: "ready_local_review",
        command: "Open sample_gate_collection_plan.md and collect page_view / cta_click / line_add aggregate counts first.",
        external_effect: false,
      },
      {
        id: "create_sample_gate_filled_ledger_copy",
        status: "owner_local_review_required",
        command: "cp data/source_capture/sample_gate_ledger.fill-template.csv data/source_capture/sample_gate_ledger.filled.csv",
        external_effect: false,
      },
      {
        id: "preview_sample_gate_ledger",
        status: "ready_after_owner_counts",
        command: queue.sample_gate_ledger.compile_preview_command,
        external_effect: false,
      },
      ...queue.immediate_actions,
    ],
    safety_rules: [
      "Use aggregate counts only.",
      "Do not rotate a new winner until sample thresholds are met and reviewed.",
      "Do not promote a challenger unless line_add_rate beats champion by 1.15x, sample_threshold_met=true, and no_quality_regression=true.",
      ...queue.safety_rules,
    ],
    real_events_before: queue.real_events_before,
    real_events_after: queue.real_events_after,
    real_events_unchanged: queue.real_events_unchanged,
    filled_ledger_exists: queue.filled_ledger_exists,
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
}

function renderBrief(queue) {
  const stageRows = queue.stage_priorities
    .map((stage) => `| ${stage.event_type} | ${stage.priority} | ${stage.sample_gap} | ${stage.source_surface} | ${stage.target_live_file} |`)
    .join("\n");
  const taskRows = queue.tasks
    .map((task) => `| ${task.priority} | ${task.event_type} | ${task.tracking_link_id} | ${task.role} | ${task.source_metric} | ${task.target_live_file} |`)
    .join("\n");
  const actionRows = queue.immediate_actions
    .map((action) => `| ${action.id} | ${action.status} | \`${action.command}\` | ${action.note} |`)
    .join("\n");
  const gatedRows = queue.gated_links
    .map((link) => `| ${link.link_id} | ${link.role} | ${link.human_gate} |`)
    .join("\n");

  return `# 3Q Growth Loop Data Collection Brief

BLUF: The weekly engine is ready, but this week still needs owner-reviewed aggregate counts before it can score real funnel performance. This brief converts the missing source data into a concrete collection queue.

Generated: ${queue.generated_at}
Mode: ${queue.mode}
Status: ${queue.status}
Week: ${queue.week.start} to ${queue.week.end}
Changed variable: ${queue.current_round.changed_variable}
Importable links: ${queue.importable_link_count}
Gated links: ${queue.gated_link_count}
Collection tasks: ${queue.task_count}
Filled ledger exists: ${queue.filled_ledger_exists ? "yes" : "no"}
Sample threshold met: ${queue.sample_progress.sample_threshold_met ? "yes" : "no"}
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

## Sample Gate Gaps

- Visits: ${queue.sample_progress.current_visits}/${queue.sample_progress.min_visits} gap=${queue.sample_progress.gaps.visits ?? 0}
- CTA clicks: ${queue.sample_progress.current_cta_clicks}/${queue.sample_progress.min_cta_clicks} gap=${queue.sample_progress.gaps.cta_clicks ?? 0}
- LINE adds: ${queue.sample_progress.current_line_adds}/${queue.sample_progress.min_line_adds} gap=${queue.sample_progress.gaps.line_adds ?? 0}
- Test days: ${queue.sample_progress.current_test_days}/${queue.sample_progress.min_test_days} preferred=${queue.sample_progress.preferred_test_days} gap=${queue.sample_progress.gaps.test_days ?? 0}

## Sample Gate Fast Path

- Artifact: sample_gate_collection_plan.md / sample_gate_collection_plan.json / data/sample_gate_collection_plan_status.json
- Status: ${queue.sample_gate_collection_plan.status}
- P0 sample-gate tasks: ${queue.sample_gate_collection_plan.p0_task_count}
- P0 links to inspect: ${queue.sample_gate_collection_plan.p0_link_count}
- Sample-gate fill template: data/source_capture/sample_gate_ledger.fill-template.csv
- Sample-gate owner-filled path: data/source_capture/sample_gate_ledger.filled.csv
- Required event types: ${queue.sample_gate_collection_plan.required_event_types.join(", ")}
- Rule: collect sample-gate counts first; do not replace the champion until thresholds and win rule are both satisfied.

## Immediate Actions

| action | status | command | note |
|---|---|---|---|
${actionRows}

## Stage Priorities

| event_type | priority | sample_gap | source_surface | target_live_file |
|---|---|---:|---|---|
${stageRows}

## Collection Queue

| priority | event_type | tracking_link_id | role | source_metric | target_live_file |
|---|---|---|---|---|---|
${taskRows}

## Gated Links

| link_id | role | human_gate |
|---|---|---|
${gatedRows || "| n/a | n/a | n/a |"}

## Rules

- Fill aggregate counts only.
- Do not include phone, email, LINE user ID, customer name, chat text, payment data, private notes, order IDs, or refund details.
- Evidence refs should be local screenshot/export paths or short source labels.
- Do not copy owner-preview CSVs into live input filenames until the compiled report is reviewed.
- Do not run any apply command until real_data_intake_plan.md is reviewed.
`;
}

function renderSampleGatePlan(plan) {
  const eventRows = plan.event_summaries
    .map(
      (event) =>
        `| ${mdCell(event.event_type)} | ${event.p0_task_count} | ${event.current}/${event.target_minimum} | ${event.global_sample_gap} | ${mdCell(event.source_surfaces.join(", "))} | ${mdCell(event.target_live_files.join(", "))} |`,
    )
    .join("\n");
  const linkRows = plan.link_groups
    .map(
      (group) =>
        `| ${group.collection_order} | ${mdCell(group.tracking_link_id)} | ${mdCell(group.role)} | ${mdCell(group.asset_id)} | ${mdCell(group.content_id)} | ${mdCell(group.variant_id)} | ${sampleTaskFlag(group, "page_view")} | ${sampleTaskFlag(group, "cta_click")} | ${sampleTaskFlag(group, "line_add")} |`,
    )
    .join("\n");
  const actionRows = plan.immediate_actions
    .map((action) => `| ${mdCell(action.id)} | ${mdCell(action.status)} | \`${mdCell(action.command)}\` |`)
    .join("\n");

  return `# 3Q Growth Loop Sample Gate Collection Plan

BLUF: Collect only the P0 sample-gate counts first: page views, CTA clicks, and LINE adds. This is the shortest safe path from Week 0 setup to a valid champion/challenger decision.

Generated: ${plan.generated_at}
Mode: ${plan.mode}
Status: ${plan.status}
Week: ${plan.week.start} to ${plan.week.end}
Changed variable: ${plan.current_round.changed_variable}
P0 sample-gate tasks: ${plan.p0_task_count}
P0 links to inspect: ${plan.p0_link_count}
Owner fill path: ${plan.owner_fill_path}
Sample-gate fill template: ${plan.sample_gate_ledger_template_path}
Sample-gate owner-filled path: ${plan.owner_sample_gate_fill_path}
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

## Global Sample Gaps

- Visits: ${plan.sample_progress.current_visits}/${plan.sample_progress.min_visits} gap=${plan.global_sample_gaps.visits}
- CTA clicks: ${plan.sample_progress.current_cta_clicks}/${plan.sample_progress.min_cta_clicks} gap=${plan.global_sample_gaps.cta_clicks}
- LINE adds: ${plan.sample_progress.current_line_adds}/${plan.sample_progress.min_line_adds} gap=${plan.global_sample_gaps.line_adds}
- Test days: ${plan.sample_progress.current_test_days}/${plan.sample_progress.min_test_days} preferred=${plan.sample_progress.preferred_test_days} gap=${plan.global_sample_gaps.test_days}

## P0 Event Summary

| event_type | tasks | current/target | global_gap | source_surface | target_live_file |
|---|---:|---:|---:|---|---|
${eventRows || "| n/a | 0 | 0/0 | 0 | n/a | n/a |"}

## Link Capture Order

| order | tracking_link_id | role | asset | content | variant | page_view | cta_click | line_add |
|---:|---|---|---|---|---|---|---|---|
${linkRows || "| 0 | n/a | n/a | n/a | n/a | n/a | - | - | - |"}

## Immediate Actions

| action | status | command |
|---|---|---|
${actionRows}

## Sample-Gate Fill Pack

- Template: ${plan.sample_gate_ledger_template_path}
- Owner-filled path: ${plan.owner_sample_gate_fill_path}
- Rows: ${plan.sample_gate_ledger_rows}
- Compile preview command: \`${plan.sample_gate_compile_preview_command}\`

## Rules

- Use aggregate counts only.
- Do not paste phone, email, LINE user ID, customer name, chat text, payment data, private notes, order IDs, or refund details.
- Do not rotate a new winner until visits, CTA clicks, LINE adds, and minimum test days pass their gates.
- Do not promote a challenger unless line_add_rate beats champion by 1.15x, sample_threshold_met=true, and no_quality_regression=true.
- This plan never creates live CSVs, appends data/lp_events.jsonl, deploys, posts, pushes LINE, changes public links, mutates customer data, touches payments, or deletes data.
`;
}

function sampleMetric(queue, eventType) {
  if (eventType === "page_view") {
    return {
      current: queue.sample_progress.current_visits,
      minimum: queue.sample_progress.min_visits,
      preferred: queue.sample_progress.min_visits,
      gap: queue.sample_progress.gaps.visits ?? 0,
    };
  }
  if (eventType === "cta_click") {
    return {
      current: queue.sample_progress.current_cta_clicks,
      minimum: queue.sample_progress.min_cta_clicks,
      preferred: queue.sample_progress.min_cta_clicks,
      gap: queue.sample_progress.gaps.cta_clicks ?? 0,
    };
  }
  if (eventType === "line_add") {
    return {
      current: queue.sample_progress.current_line_adds,
      minimum: queue.sample_progress.min_line_adds,
      preferred: queue.sample_progress.min_line_adds,
      gap: queue.sample_progress.gaps.line_adds ?? 0,
    };
  }
  return { current: 0, minimum: 0, preferred: 0, gap: 0 };
}

function sampleTaskFlag(group, eventType) {
  return group.tasks_by_event_type[eventType] ? "collect" : "-";
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value !== undefined && value !== null && value !== "")));
}

function mdCell(value) {
  return String(value ?? "n/a").replaceAll("|", "/");
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function readOptionalJson(filePath, fallback) {
  try {
    return await readJson(filePath);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
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
  } catch {
    return 0;
  }
}

function currentTaipeiWeek(date) {
  const taipeiDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const day = taipeiDate.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(taipeiDate);
  monday.setDate(taipeiDate.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: formatDate(monday),
    end: formatDate(sunday),
  };
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function safeId(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

main();
