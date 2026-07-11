import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DATA_QUEUE_PATH = path.join(ROOT, "data_collection_queue.json");
const OWNER_CAPTURE_QUEUE_PATH = path.join(ROOT, "week0_owner_capture_queue.json");
const SAMPLE_GATE_PLAN_PATH = path.join(ROOT, "sample_gate_collection_plan.json");
const OWNER_SAMPLE_GATE_STATUS_PATH = path.join(ROOT, "data", "owner_sample_gate_status.json");
const SOURCE_COMPILE_STATUS_PATH = path.join(ROOT, "data", "source_capture_compile_status.json");
const REAL_DATA_INTAKE_STATUS_PATH = path.join(ROOT, "data", "real_data_intake_status.json");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const SOURCE_LEDGER_FILLED_PATH = path.join(ROOT, "data", "source_capture", "source_capture_ledger.filled.csv");
const SAMPLE_LEDGER_FILLED_PATH = path.join(ROOT, "data", "source_capture", "sample_gate_ledger.filled.csv");
const JSON_PATH = path.join(ROOT, "data_collection_progress.json");
const REPORT_PATH = path.join(ROOT, "data_collection_progress.md");
const STATUS_PATH = path.join(ROOT, "data", "data_collection_progress_status.json");
const NEXT_P0_JSON_PATH = path.join(ROOT, "next_p0_owner_inputs.json");
const NEXT_P0_REPORT_PATH = path.join(ROOT, "next_p0_owner_inputs.md");
const NEXT_P0_STATUS_PATH = path.join(ROOT, "data", "next_p0_owner_inputs_status.json");

const PII_CHECKED_VALUES = new Set(["yes", "true", "checked", "ok", "1"]);

async function main() {
  const generatedAt = new Date();
  const dataQueue = await readJson(DATA_QUEUE_PATH);
  const ownerCaptureQueue = await readJson(OWNER_CAPTURE_QUEUE_PATH);
  const sampleGatePlan = await readJson(SAMPLE_GATE_PLAN_PATH);
  const ownerSampleGate = await readJson(OWNER_SAMPLE_GATE_STATUS_PATH);
  const sourceCompile = await readJson(SOURCE_COMPILE_STATUS_PATH);
  const realDataIntake = await readJson(REAL_DATA_INTAKE_STATUS_PATH);
  const realEventsBefore = await countLines(REAL_EVENTS_PATH);
  const sourceFilled = await readFilledLedger(SOURCE_LEDGER_FILLED_PATH);
  const sampleFilled = await readFilledLedger(SAMPLE_LEDGER_FILLED_PATH);
  const filledKeys = new Set([...sourceFilled.filled_keys, ...sampleFilled.filled_keys]);

  const tasks = Array.isArray(dataQueue.tasks) ? dataQueue.tasks : [];
  const taskRows = tasks.map((task) => {
    const key = taskKey(task.tracking_link_id, task.event_type);
    const filled = filledKeys.has(key);
    return {
      task_id: task.task_id,
      priority: task.priority,
      role: task.role,
      tracking_link_id: task.tracking_link_id,
      asset_id: task.asset_id,
      content_id: task.content_id,
      variant_id: task.variant_id,
      event_type: task.event_type,
      stage_label: task.stage_label,
      sample_gate_key: task.sample_gate_key ?? null,
      sample_gap: task.sample_gap ?? 0,
      source_surface: task.source_surface,
      target_live_file: task.target_live_file,
      filled,
      pending: !filled,
      owner_fill_path: task.owner_fill_path,
      evidence_rule: task.evidence_rule,
      external_effect: false,
    };
  });

  const p0Tasks = taskRows.filter((row) => row.priority === "P0_sample_gate");
  const p1Tasks = taskRows.filter((row) => row.priority !== "P0_sample_gate");
  const pendingP0 = p0Tasks.filter((row) => row.pending);
  const pendingP1 = p1Tasks.filter((row) => row.pending);
  const pendingTasks = taskRows.filter((row) => row.pending);
  const status = pendingP0.length > 0
    ? "waiting_for_p0_sample_gate_counts"
    : pendingTasks.length > 0
      ? "waiting_for_p1_funnel_counts"
      : "all_collection_rows_filled_review_next";
  const realEventsAfter = await countLines(REAL_EVENTS_PATH);

  const progress = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "data_collection_progress",
    status,
    week: dataQueue.week,
    current_round: dataQueue.current_round,
    sample_progress: dataQueue.sample_progress,
    sample_threshold_met: Boolean(ownerSampleGate.sample_threshold_met),
    sample_rate_win_candidate: Boolean(ownerSampleGate.sample_rate_win_candidate),
    owner_sample_gate_status: ownerSampleGate.status ?? "unknown",
    source_compile_status: sourceCompile.status ?? "unknown",
    real_data_intake_status: realDataIntake.status ?? "unknown",
    total_task_count: taskRows.length,
    filled_task_count: taskRows.filter((row) => row.filled).length,
    pending_task_count: pendingTasks.length,
    p0_task_count: p0Tasks.length,
    p0_filled_count: p0Tasks.filter((row) => row.filled).length,
    p0_pending_count: pendingP0.length,
    p1_task_count: p1Tasks.length,
    p1_filled_count: p1Tasks.filter((row) => row.filled).length,
    p1_pending_count: pendingP1.length,
    p0_link_count: ownerCaptureQueue.p0_link_count ?? sampleGatePlan.p0_link_count ?? 0,
    source_group_count: ownerCaptureQueue.source_group_count ?? 0,
    filled_ledgers: {
      source_capture_ledger: sourceFilled.summary,
      sample_gate_ledger: sampleFilled.summary,
    },
    event_type_progress: buildEventTypeProgress(taskRows),
    source_surface_progress: buildSourceProgress(taskRows),
    next_owner_inputs: pendingP0.slice(0, 9).map((row) => ownerInput(row)),
    fallback_owner_inputs: pendingP0.length > 0 ? [] : pendingP1.slice(0, 9).map((row) => ownerInput(row)),
    owner_paths: {
      progress_report: "data_collection_progress.md",
      progress_json: "data_collection_progress.json",
      progress_status: "data/data_collection_progress_status.json",
      sample_gate_form: "sample_gate_owner_form.html",
      sample_gate_worksheet: "sample_gate_owner_worksheet.md",
      source_capture_ledger_template: "data/source_capture/source_capture_ledger.fill-template.csv",
      source_capture_ledger_filled: "data/source_capture/source_capture_ledger.filled.csv",
      sample_gate_ledger_template: "data/source_capture/sample_gate_ledger.fill-template.csv",
      sample_gate_ledger_filled: "data/source_capture/sample_gate_ledger.filled.csv",
    },
    safety_rules: [
      "Aggregate counts only.",
      "Do not paste phone, email, LINE user ID, customer name, chat text, payment data, private notes, order IDs, refund details, or customer-level exports.",
      "Evidence refs should be local screenshot/export references or source labels, not raw customer rows.",
      "This progress check reads local artifacts only; it does not create live CSVs, append data/lp_events.jsonl, deploy, post, push LINE, change public links, mutate customer data, process payments, push GitHub, create PRs, or delete data.",
    ],
    real_events_before: realEventsBefore,
    real_events_after: realEventsAfter,
    real_events_unchanged: realEventsBefore === realEventsAfter,
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
  };

  const compact = compactStatus(progress);
  const nextP0OwnerInputs = buildNextP0OwnerInputs(progress);
  await writeJson(JSON_PATH, progress);
  await writeFile(REPORT_PATH, renderReport(progress));
  await writeJson(STATUS_PATH, compact);
  await writeJson(NEXT_P0_JSON_PATH, nextP0OwnerInputs);
  await writeFile(NEXT_P0_REPORT_PATH, renderNextP0Report(nextP0OwnerInputs));
  await writeJson(NEXT_P0_STATUS_PATH, compactNextP0Status(nextP0OwnerInputs));
  console.log(JSON.stringify(compact, null, 2));
}

function taskKey(trackingLinkId, eventType) {
  return `${trackingLinkId ?? ""}|${eventType ?? ""}`;
}

function ownerInput(row) {
  return {
    tracking_link_id: row.tracking_link_id,
    role: row.role,
    event_type: row.event_type,
    stage_label: row.stage_label,
    source_surface: row.source_surface,
    target_live_file: row.target_live_file,
    owner_fill_path: row.owner_fill_path,
    required_fields: ["capture_date", "aggregate_count", "evidence_ref", "reviewer", "pii_checked"],
    evidence_rule: row.evidence_rule,
    external_effect: false,
  };
}

function buildEventTypeProgress(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.event_type)) {
      groups.set(row.event_type, {
        event_type: row.event_type,
        stage_label: row.stage_label,
        sample_gate_key: row.sample_gate_key,
        priority: row.priority,
        total: 0,
        filled: 0,
        pending: 0,
        source_surfaces: new Set(),
        target_live_files: new Set(),
      });
    }
    const group = groups.get(row.event_type);
    group.total += 1;
    group.filled += row.filled ? 1 : 0;
    group.pending += row.pending ? 1 : 0;
    group.source_surfaces.add(row.source_surface);
    group.target_live_files.add(row.target_live_file);
  }
  return Array.from(groups.values()).map((group) => ({
    event_type: group.event_type,
    stage_label: group.stage_label,
    sample_gate_key: group.sample_gate_key,
    priority: group.priority,
    total: group.total,
    filled: group.filled,
    pending: group.pending,
    completion_rate: group.total === 0 ? 0 : round(group.filled / group.total),
    source_surfaces: Array.from(group.source_surfaces),
    target_live_files: Array.from(group.target_live_files),
    external_effect: false,
  }));
}

function buildSourceProgress(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.source_surface)) {
      groups.set(row.source_surface, {
        source_surface: row.source_surface,
        total: 0,
        filled: 0,
        pending: 0,
        p0_pending: 0,
        event_types: new Set(),
        target_live_files: new Set(),
      });
    }
    const group = groups.get(row.source_surface);
    group.total += 1;
    group.filled += row.filled ? 1 : 0;
    group.pending += row.pending ? 1 : 0;
    group.p0_pending += row.pending && row.priority === "P0_sample_gate" ? 1 : 0;
    group.event_types.add(row.event_type);
    group.target_live_files.add(row.target_live_file);
  }
  return Array.from(groups.values()).map((group) => ({
    source_surface: group.source_surface,
    total: group.total,
    filled: group.filled,
    pending: group.pending,
    p0_pending: group.p0_pending,
    completion_rate: group.total === 0 ? 0 : round(group.filled / group.total),
    event_types: Array.from(group.event_types),
    target_live_files: Array.from(group.target_live_files),
    external_effect: false,
  }));
}

async function readFilledLedger(filePath) {
  if (!(await exists(filePath))) {
    return {
      summary: {
        path: relative(filePath),
        exists: false,
        total_rows: 0,
        filled_rows: 0,
        valid_reviewed_rows: 0,
      },
      filled_keys: [],
    };
  }

  const raw = await readFile(filePath, "utf8");
  const parsed = parseCsv(raw);
  const filledRows = parsed.rows.filter((row) => String(row.aggregate_count ?? "").trim() !== "");
  const validReviewed = filledRows.filter((row) => PII_CHECKED_VALUES.has(String(row.pii_checked ?? "").trim().toLowerCase()));
  return {
    summary: {
      path: relative(filePath),
      exists: true,
      total_rows: parsed.rows.length,
      filled_rows: filledRows.length,
      valid_reviewed_rows: validReviewed.length,
    },
    filled_keys: validReviewed.map((row) => taskKey(row.tracking_link_id, row.stage)),
  };
}

function compactStatus(progress) {
  return {
    ok: progress.ok,
    generated_at: progress.generated_at,
    mode: progress.mode,
    status: progress.status,
    total_task_count: progress.total_task_count,
    filled_task_count: progress.filled_task_count,
    pending_task_count: progress.pending_task_count,
    p0_task_count: progress.p0_task_count,
    p0_pending_count: progress.p0_pending_count,
    p1_task_count: progress.p1_task_count,
    p1_pending_count: progress.p1_pending_count,
    source_group_count: progress.source_group_count,
    sample_threshold_met: progress.sample_threshold_met,
    sample_rate_win_candidate: progress.sample_rate_win_candidate,
    owner_sample_gate_status: progress.owner_sample_gate_status,
    next_owner_input_count: progress.next_owner_inputs.length,
    real_events_unchanged: progress.real_events_unchanged,
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
  };
}

function buildNextP0OwnerInputs(progress) {
  const rows = progress.next_owner_inputs.length > 0
    ? progress.next_owner_inputs
    : progress.fallback_owner_inputs;
  const sourceGroups = rows.reduce((groups, row) => {
    const key = row.source_surface;
    if (!groups.has(key)) {
      groups.set(key, {
        source_surface: key,
        input_count: 0,
        event_types: new Set(),
        target_live_files: new Set(),
        owner_fill_paths: new Set(),
      });
    }
    const group = groups.get(key);
    group.input_count += 1;
    group.event_types.add(row.event_type);
    group.target_live_files.add(row.target_live_file);
    group.owner_fill_paths.add(row.owner_fill_path);
    return groups;
  }, new Map());
  const status = progress.p0_pending_count > 0
    ? "waiting_for_p0_owner_inputs"
    : progress.p1_pending_count > 0
      ? "p0_complete_waiting_for_p1_owner_inputs"
      : "all_owner_inputs_filled_review_next";

  return {
    ok: true,
    generated_at: progress.generated_at,
    mode: "next_p0_owner_inputs",
    status,
    source_progress_status: progress.status,
    week: progress.week,
    current_round: progress.current_round,
    current_input_count: rows.length,
    p0_pending_count: progress.p0_pending_count,
    p1_pending_count: progress.p1_pending_count,
    total_pending_count: progress.pending_task_count,
    sample_threshold_met: progress.sample_threshold_met,
    owner_sample_gate_status: progress.owner_sample_gate_status,
    owner_fill_paths: Array.from(new Set(rows.map((row) => row.owner_fill_path))),
    recommended_open_command: progress.p0_pending_count > 0 ? "open next_p0_owner_form.html" : "open data_collection_progress.md",
    recommended_review_artifacts: [
      "next_p0_owner_inputs.md",
      "next_p0_owner_form.html",
      "sample_gate_owner_form.html",
      "sample_gate_owner_worksheet.md",
      "data_collection_progress.md",
      "sample_gate_collection_plan.md",
    ],
    source_groups: Array.from(sourceGroups.values()).map((group) => ({
      source_surface: group.source_surface,
      input_count: group.input_count,
      event_types: Array.from(group.event_types),
      target_live_files: Array.from(group.target_live_files),
      owner_fill_paths: Array.from(group.owner_fill_paths),
      external_effect: false,
    })),
    inputs: rows.map((row, index) => ({
      rank: index + 1,
      ...row,
      owner_action: "Fill aggregate_count plus evidence_ref only after reviewing source totals. Keep pii_checked=yes only when no customer-level data is included.",
      external_effect: false,
    })),
    safety_rules: progress.safety_rules,
    real_events_unchanged: progress.real_events_unchanged,
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
  };
}

function compactNextP0Status(nextP0OwnerInputs) {
  return {
    ok: nextP0OwnerInputs.ok,
    generated_at: nextP0OwnerInputs.generated_at,
    mode: nextP0OwnerInputs.mode,
    status: nextP0OwnerInputs.status,
    source_progress_status: nextP0OwnerInputs.source_progress_status,
    current_input_count: nextP0OwnerInputs.current_input_count,
    p0_pending_count: nextP0OwnerInputs.p0_pending_count,
    p1_pending_count: nextP0OwnerInputs.p1_pending_count,
    total_pending_count: nextP0OwnerInputs.total_pending_count,
    source_group_count: nextP0OwnerInputs.source_groups.length,
    sample_threshold_met: nextP0OwnerInputs.sample_threshold_met,
    owner_sample_gate_status: nextP0OwnerInputs.owner_sample_gate_status,
    recommended_open_command: nextP0OwnerInputs.recommended_open_command,
    real_events_unchanged: nextP0OwnerInputs.real_events_unchanged,
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
  };
}

function renderReport(progress) {
  const eventRows = progress.event_type_progress
    .map((row) => `| ${row.event_type} | ${row.stage_label} | ${row.priority} | ${row.filled}/${row.total} | ${row.pending} | ${percent(row.completion_rate)} | ${row.source_surfaces.join("<br>")} |`)
    .join("\n");
  const sourceRows = progress.source_surface_progress
    .map((row) => `| ${row.source_surface} | ${row.filled}/${row.total} | ${row.pending} | ${row.p0_pending} | ${row.event_types.join(", ")} |`)
    .join("\n");
  const ownerRows = (progress.next_owner_inputs.length > 0 ? progress.next_owner_inputs : progress.fallback_owner_inputs)
    .map((row) => `| ${row.role} | ${row.tracking_link_id} | ${row.event_type} | ${row.source_surface} | ${row.owner_fill_path} |`)
    .join("\n");

  return `# 3Q Growth Loop Data Collection Progress

BLUF: ${progress.p0_pending_count > 0 ? `P0 sample-gate data is still missing: ${progress.p0_pending_count}/${progress.p0_task_count} P0 rows pending.` : progress.pending_task_count > 0 ? `P0 is filled; ${progress.p1_pending_count} P1 funnel-completeness rows still need aggregate counts.` : "All collection rows are filled; review compile/intake before any apply."}

Generated: ${progress.generated_at}
Mode: ${progress.mode}
Status: ${progress.status}
Week: ${progress.week?.start ?? "n/a"} to ${progress.week?.end ?? "n/a"}
Sample threshold met: ${progress.sample_threshold_met ? "yes" : "no"}
Owner sample gate status: ${progress.owner_sample_gate_status}
Real events unchanged: ${progress.real_events_unchanged ? "yes" : "no"}
External effect: no
data/lp_events.jsonl write performed: no

## Task Completion

- Total tasks: ${progress.filled_task_count}/${progress.total_task_count} filled
- P0 sample-gate rows: ${progress.p0_filled_count}/${progress.p0_task_count} filled
- P1 funnel rows: ${progress.p1_filled_count}/${progress.p1_task_count} filled
- Source groups: ${progress.source_group_count}
- Source ledger filled rows: ${progress.filled_ledgers.source_capture_ledger.valid_reviewed_rows}
- Sample gate ledger filled rows: ${progress.filled_ledgers.sample_gate_ledger.valid_reviewed_rows}
- Focused next-input artifact: next_p0_owner_inputs.md / next_p0_owner_inputs.json / data/next_p0_owner_inputs_status.json

## Event Type Progress

| event_type | label | priority | filled | pending | completion | source |
|---|---|---|---:|---:|---:|---|
${eventRows}

## Source Progress

| source | filled | pending | P0 pending | event types |
|---|---:|---:|---:|---|
${sourceRows}

## Next Owner Inputs

| role | tracking_link_id | event_type | source | owner_fill_path |
|---|---|---|---|---|
${ownerRows || "| none | none | none | none | none |"}

## Safe Commands After Owner Fill

\`\`\`zsh
npm run source:compile
npm run real-data:intake
npm run owner:sample-gate
npm run owner:next-action
\`\`\`

## Safety

- Aggregate counts only.
- No customer names, phone, email, LINE user IDs, chat text, payment data, order IDs, refund details, private notes, or customer-level exports.
- This script creates no live CSVs, appends no events, executes no deploy, sends no LINE, changes no public links, pushes no GitHub branch, creates no PR, touches no payment/customer data, and deletes nothing.
`;
}

function renderNextP0Report(nextP0OwnerInputs) {
  const sourceRows = nextP0OwnerInputs.source_groups
    .map((row) => `| ${row.source_surface} | ${row.input_count} | ${row.event_types.join(", ")} | ${row.owner_fill_paths.join("<br>")} |`)
    .join("\n");
  const inputRows = nextP0OwnerInputs.inputs
    .map((row) => `| ${row.rank} | ${row.role} | ${row.tracking_link_id} | ${row.event_type} | ${row.stage_label} | ${row.source_surface} | ${row.owner_fill_path} |`)
    .join("\n");

  return `# 3Q Growth Loop Next P0 Owner Inputs

BLUF: Fill these ${nextP0OwnerInputs.current_input_count} aggregate-count rows first. They are the shortest path toward the sample gate, and this file performs no event write, deploy, post, LINE push, public link change, GitHub action, payment, customer-data mutation, or deletion.

Generated: ${nextP0OwnerInputs.generated_at}
Mode: ${nextP0OwnerInputs.mode}
Status: ${nextP0OwnerInputs.status}
Source progress status: ${nextP0OwnerInputs.source_progress_status}
P0 pending: ${nextP0OwnerInputs.p0_pending_count}
P1 pending: ${nextP0OwnerInputs.p1_pending_count}
Total pending: ${nextP0OwnerInputs.total_pending_count}
Sample threshold met: ${nextP0OwnerInputs.sample_threshold_met ? "yes" : "no"}
Owner sample gate status: ${nextP0OwnerInputs.owner_sample_gate_status}
Recommended open command: ${nextP0OwnerInputs.recommended_open_command}
Real events unchanged: ${nextP0OwnerInputs.real_events_unchanged ? "yes" : "no"}
External effect: no
data/lp_events.jsonl write performed: no

## Source Groups

| source | inputs | event types | owner fill paths |
|---|---:|---|---|
${sourceRows || "| none | 0 | none | none |"}

## Inputs To Fill First

| rank | role | tracking_link_id | event_type | label | source | owner_fill_path |
|---:|---|---|---|---|---|---|
${inputRows || "| 0 | none | none | none | none | none | none |"}

## Owner Fill Rule

- Fill aggregate_count only after reviewing source totals.
- Add evidence_ref as a local screenshot/export reference or source label.
- Set pii_checked=yes only when no customer-level data is included.
- Do not paste phone, email, LINE user ID, customer name, chat text, payment data, private notes, order IDs, refund details, or customer-level exports.

## Safe Follow-Up Commands

\`\`\`zsh
npm run source:compile
npm run real-data:intake
npm run owner:sample-gate
npm run owner:next-action
\`\`\`

These commands are local review commands. Any apply command that appends to data/lp_events.jsonl remains owner-reviewed and must use explicit confirmation flags.
`;
}

function parseCsv(raw) {
  const rows = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = rows[0].map((header) => header.trim());
  const dataRows = rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, String(values[index] ?? "").trim()])));
  return { headers, rows: dataRows };
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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function countLines(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw.split(/\r?\n/).filter((line) => line.trim()).length;
  } catch {
    return 0;
  }
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function relative(filePath) {
  return path.relative(ROOT, filePath);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
