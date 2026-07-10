import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

const PATHS = {
  sampleGatePlan: "sample_gate_collection_plan.json",
  nextP0: "next_p0_owner_inputs.json",
  dataProgress: "data/data_collection_progress_status.json",
  quick: "data/next_p0_quick_capture_status.json",
  goal: "data/goal_completion_audit_status.json",
};

const OUTPUT_JSON = "sample_gate_batch_handoff.json";
const OUTPUT_MD = "sample_gate_batch_handoff.md";
const OUTPUT_STATUS = "data/sample_gate_batch_handoff_status.json";
const BATCH_1_PASTE_BLOCK = "sample_gate_batch_1_paste_block.txt";
const BATCH_2_PASTE_BLOCK = "sample_gate_batch_2_paste_block.txt";

const EVENT_ORDER = ["page_view", "cta_click", "line_add"];
const EVENT_ALIAS = {
  page_view: "visits",
  cta_click: "cta",
  line_add: "line",
};

const RED_LINE_FALSE = {
  external_effect: false,
  live_input_files_created: false,
  stage_performed: false,
  apply_performed: false,
  append_performed: false,
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
  const input = {};
  for (const [key, relativePath] of Object.entries(PATHS)) {
    input[key] = await readJson(relativePath);
  }

  const handoff = buildHandoff(input, generatedAt);
  const status = buildStatus(handoff);

  await mkdir(path.dirname(resolve(OUTPUT_STATUS)), { recursive: true });
  await writeJson(OUTPUT_JSON, handoff);
  await writeJson(OUTPUT_STATUS, status);
  await writeFile(resolve(OUTPUT_MD), renderMarkdown(handoff));
  await writeFile(resolve(BATCH_1_PASTE_BLOCK), `${handoff.batches[0]?.paste_block ?? ""}\n`);
  await writeFile(resolve(BATCH_2_PASTE_BLOCK), `${handoff.batches[1]?.paste_block ?? ""}\n`);

  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) process.exitCode = 1;
}

function buildHandoff({ sampleGatePlan, nextP0, dataProgress, quick, goal }, generatedAt) {
  const allRows = buildRows(sampleGatePlan);
  const focusedKeys = new Set((nextP0.inputs ?? []).map(rowKey));
  const focusedRows = allRows.filter((row) => focusedKeys.has(rowKey(row)));
  const remainingRows = allRows.filter((row) => !focusedKeys.has(rowKey(row)));
  const batches = [
    buildBatch({
      id: "batch_1_focused_next_p0",
      order: 1,
      title: "Focused Next P0 quick-capture batch",
      purpose: "Fastest path to get champion/challenger/line_cta sample-gate counts into local preview.",
      accepted_by: "npm run next-p0:quick",
      owner_path: nextP0.recommended_open_command ?? "open next_p0_owner_form.html",
      rows: focusedRows,
      generatedAt,
    }),
    buildBatch({
      id: "batch_2_remaining_content_variants",
      order: 2,
      title: "Remaining P0 content-variant coverage batch",
      purpose: "Completes the full 18-row P0 sample-gate coverage after the focused batch is captured.",
      accepted_by: "sample_gate_owner_worksheet.md / data/source_capture/sample_gate_ledger.filled.csv",
      owner_path: "open sample_gate_owner_worksheet.md",
      rows: remainingRows,
      generatedAt,
    }),
  ];

  const missingP0Rows = Number(dataProgress.p0_pending_count ?? sampleGatePlan.p0_task_count ?? allRows.length);
  const focusedPendingRows = Number(nextP0.current_input_count ?? focusedRows.length);
  const remainingPendingRows = Math.max(0, missingP0Rows - focusedPendingRows);
  const fullCoverageReady = allRows.length === Number(sampleGatePlan.p0_task_count ?? 0)
    && batches.every((batch) => batch.row_count > 0)
    && batches.reduce((sum, batch) => sum + batch.row_count, 0) === allRows.length;

  return {
    ok: fullCoverageReady,
    generated_at: generatedAt.toISOString(),
    mode: "sample_gate_batch_handoff_local_only",
    status: goal.sample_threshold_met
      ? "sample_gate_already_met"
      : fullCoverageReady
        ? "p0_full_coverage_batched_for_owner_counts"
        : "p0_batch_coverage_attention_required",
    week: sampleGatePlan.week,
    current_round_id: goal.current_round_id ?? null,
    changed_variable: goal.current_changed_variable ?? sampleGatePlan.current_round?.changed_variable ?? "cta_text",
    sample_threshold_met: Boolean(goal.sample_threshold_met),
    current_real_event_rows: Number(goal.current_real_event_rows ?? 0),
    p0_task_count: Number(sampleGatePlan.p0_task_count ?? allRows.length),
    all_p0_row_count: allRows.length,
    focused_batch_row_count: focusedRows.length,
    remaining_batch_row_count: remainingRows.length,
    p0_pending_count: missingP0Rows,
    focused_pending_count: focusedPendingRows,
    remaining_pending_count: remainingPendingRows,
    quick_capture_status: quick.status ?? "unknown",
    quick_filled_rank_count: quick.filled_rank_count ?? 0,
    quick_missing_rank_count: quick.missing_rank_count ?? focusedRows.length,
    full_coverage_ready: fullCoverageReady,
    source_group_count: countUnique(allRows.map((row) => row.source_surface)),
    event_type_count: countUnique(allRows.map((row) => row.event_type)),
    batches,
    all_rows: allRows,
    next_safe_action: fullCoverageReady
      ? "Fill batch 1 first through the focused quick-capture path, then use batch 2 to complete the remaining content-variant P0 rows before judging the round."
      : "Review sample_gate_collection_plan.json and next_p0_owner_inputs.json because P0 batch coverage does not add up.",
    after_batch_1_commands: [
      "npm run next-p0:quick",
      "npm run next-p0:intake",
      "npm run owner:data-preflight",
      "npm run owner:sample-count-recovery",
    ],
    after_full_p0_commands: [
      "npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled",
      "npm run owner:sample-gate",
      "npm run north-star",
      "npm run data:progress",
      "npm run owner:next-action",
      "npm run weekly:local",
    ],
    review_artifacts: [
      OUTPUT_MD,
      BATCH_1_PASTE_BLOCK,
      BATCH_2_PASTE_BLOCK,
      "next_p0_owner_inputs.md",
      "next_p0_owner_form.html",
      "sample_gate_owner_worksheet.md",
      "sample_gate_collection_plan.md",
      "owner_sample_count_handoff.md",
    ],
    blocked_actions: [
      "fake_or_backfill_counts_without_owner_source",
      "paste_customer_rows_or_chat_text",
      "create_live_input_files_without_owner_review",
      "append_to_data_lp_events_jsonl",
      "promote_challenger_to_champion",
      "rotate_next_variable",
      "formal_social_post_or_schedule",
      "line_push_or_broadcast",
      "public_link_change",
      "production_worker_deploy",
      "github_push_or_pr_creation",
      "customer_data_mutation",
      "payment_or_refund_action",
      "delete_data",
    ],
    outputs: {
      handoff_json: OUTPUT_JSON,
      handoff_md: OUTPUT_MD,
      status_json: OUTPUT_STATUS,
      batch_1_paste_block: BATCH_1_PASTE_BLOCK,
      batch_2_paste_block: BATCH_2_PASTE_BLOCK,
    },
    ...RED_LINE_FALSE,
    note: "Local P0 sample-gate batch handoff only. It makes the 18-row coverage explicit and never creates live input files, appends events, deploys, posts, pushes GitHub/LINE, mutates customer data, processes payments, or deletes data.",
  };
}

function buildRows(sampleGatePlan) {
  const rows = [];
  for (const group of sampleGatePlan.link_groups ?? []) {
    for (const eventType of EVENT_ORDER) {
      const task = group.tasks_by_event_type?.[eventType];
      if (!task) continue;
      rows.push({
        p0_rank: rows.length + 1,
        collection_order: group.collection_order,
        tracking_link_id: group.tracking_link_id,
        role: group.role,
        asset_id: group.asset_id,
        content_id: group.content_id,
        variant_id: group.variant_id,
        task_id: task.task_id,
        event_type: task.event_type,
        paste_key: `${safeKey(group.role === "content_variant" ? group.tracking_link_id : group.role)}.${EVENT_ALIAS[task.event_type] ?? task.event_type}`,
        sample_gate_key: task.sample_gate_key,
        source_surface: task.source_surface,
        source_metric: task.source_metric,
        target_live_file: task.target_live_file,
        owner_fill_path: task.owner_fill_path,
        evidence_rule: task.evidence_rule,
        external_effect: false,
      });
    }
  }
  return rows;
}

function buildBatch({ id, order, title, purpose, accepted_by, owner_path, rows, generatedAt }) {
  return {
    id,
    order,
    title,
    purpose,
    accepted_by,
    owner_path,
    row_count: rows.length,
    rows,
    source_groups: summarizeGroups(rows, "source_surface"),
    event_types: summarizeGroups(rows, "event_type"),
    paste_block: renderPasteBlock(rows, generatedAt),
    external_effect: false,
    data_lp_events_write_performed: false,
    live_input_files_created: false,
  };
}

function renderPasteBlock(rows, generatedAt) {
  const lines = [
    `capture_date=${formatTaipeiDate(generatedAt)}`,
    "evidence_ref=<aggregate_ref>",
    "reviewer=<alias>",
    "pii_checked=yes",
    ...rows.map((row) => `${row.paste_key}=<count>`),
  ];
  return lines.join("\n");
}

function renderMarkdown(handoff) {
  const batchSections = handoff.batches.map((batch) => `## ${batch.title}

- Batch ID: ${batch.id}
- Rows: ${batch.row_count}
- Accepted by: ${batch.accepted_by}
- Owner path: \`${batch.owner_path}\`
- Purpose: ${batch.purpose}

| rank | paste key | role | tracking link | event | source | evidence rule |
|---:|---|---|---|---|---|---|
${batch.rows.map((row) => `| ${row.p0_rank} | \`${row.paste_key}\` | ${row.role} | ${row.tracking_link_id} | ${row.event_type} | ${row.source_surface} | ${row.evidence_rule} |`).join("\n") || "| none | none | none | none | none | none | none |"}

### Paste Block

\`\`\`txt
${batch.paste_block}
\`\`\`
`).join("\n");

  return `# 3Q Growth Loop P0 Sample-Gate Batch Handoff

BLUF: P0 is ${handoff.all_p0_row_count}/${handoff.p0_task_count} rows mapped. Fill batch 1 (${handoff.focused_batch_row_count} focused rows) first, then batch 2 (${handoff.remaining_batch_row_count} remaining content-variant rows) before treating Week 0 sample-gate collection as covered.

Generated: ${handoff.generated_at}
Mode: ${handoff.mode}
Status: ${handoff.status}
Week: ${handoff.week?.start ?? "n/a"} to ${handoff.week?.end ?? "n/a"}
Changed variable: ${handoff.changed_variable}
Current real event rows: ${handoff.current_real_event_rows}
Sample threshold met: ${handoff.sample_threshold_met ? "yes" : "no"}
Quick capture status: ${handoff.quick_capture_status}
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

## Coverage

| item | count |
|---|---:|
| P0 planned rows | ${handoff.p0_task_count} |
| Rows mapped in this handoff | ${handoff.all_p0_row_count} |
| Focused batch rows | ${handoff.focused_batch_row_count} |
| Remaining batch rows | ${handoff.remaining_batch_row_count} |
| P0 pending rows | ${handoff.p0_pending_count} |
| Focused pending rows | ${handoff.focused_pending_count} |
| Remaining pending rows | ${handoff.remaining_pending_count} |

${batchSections}

## Safe Command Order

After batch 1:

\`\`\`zsh
${handoff.after_batch_1_commands.join("\n")}
\`\`\`

After all P0 rows:

\`\`\`zsh
${handoff.after_full_p0_commands.join("\n")}
\`\`\`

## Safety

- Aggregate counts only.
- Do not paste names, phones, email, LINE user IDs, chat text, order IDs, payment data, refund data, or row-level customer exports.
- Batch 1 paste block is a helper for focused quick capture; batch 2 is a coverage handoff for the full sample-gate worksheet.
- Sample-insufficient weeks keep the current champion and current variable.
- Production deploy performed: no
- Public link change performed: no
- GitHub push / PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer-data mutation performed: no
- Payment action performed: no
- Delete action performed: no
`;
}

function buildStatus(handoff) {
  return {
    ok: handoff.ok,
    generated_at: handoff.generated_at,
    mode: handoff.mode,
    status: handoff.status,
    p0_task_count: handoff.p0_task_count,
    all_p0_row_count: handoff.all_p0_row_count,
    focused_batch_row_count: handoff.focused_batch_row_count,
    remaining_batch_row_count: handoff.remaining_batch_row_count,
    p0_pending_count: handoff.p0_pending_count,
    focused_pending_count: handoff.focused_pending_count,
    remaining_pending_count: handoff.remaining_pending_count,
    full_coverage_ready: handoff.full_coverage_ready,
    sample_threshold_met: handoff.sample_threshold_met,
    current_real_event_rows: handoff.current_real_event_rows,
    quick_capture_status: handoff.quick_capture_status,
    batch_count: handoff.batches.length,
    after_batch_1_command_count: handoff.after_batch_1_commands.length,
    after_full_p0_command_count: handoff.after_full_p0_commands.length,
    blocked_action_count: handoff.blocked_actions.length,
    outputs: handoff.outputs,
    ...RED_LINE_FALSE,
  };
}

function rowKey(row) {
  return `${row.tracking_link_id}::${row.event_type}`;
}

function safeKey(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function summarizeGroups(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const value = row[key] ?? "unknown";
    groups.set(value, (groups.get(value) ?? 0) + 1);
  }
  return Array.from(groups, ([value, count]) => ({ value, count }));
}

function countUnique(values) {
  return new Set(values).size;
}

function formatTaipeiDate(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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
  process.exitCode = 1;
});
