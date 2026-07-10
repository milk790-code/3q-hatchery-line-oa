import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

const PATHS = {
  recovery: "sample_gate_recovery_pack.json",
  nextP0: "next_p0_owner_inputs.json",
  quick: "data/next_p0_quick_capture_status.json",
  due: "sample_gate_due_status.json",
  ownerNext: "owner_next_action.json",
  redline: "data/redline_priority_status.json",
  sourceReadiness: "data/source_readiness_status.json",
  batch: "data/sample_gate_batch_handoff_status.json",
};

const OUTPUT_JSON = "owner_sample_count_handoff.json";
const OUTPUT_MD = "owner_sample_count_handoff.md";
const OUTPUT_PASTE_BLOCK = "owner_sample_count_paste_block.txt";
const OUTPUT_STATUS = "data/owner_sample_count_handoff_status.json";

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
  const input = {};
  for (const [key, relativePath] of Object.entries(PATHS)) {
    input[key] = await readJson(relativePath);
  }

  const handoff = buildHandoff(input, generatedAt);
  const status = buildStatus(handoff, generatedAt);

  await mkdir(path.dirname(resolve(OUTPUT_STATUS)), { recursive: true });
  await writeJson(OUTPUT_JSON, handoff);
  await writeFile(resolve(OUTPUT_MD), renderMarkdown(handoff));
  await writeFile(resolve(OUTPUT_PASTE_BLOCK), `${handoff.paste_block}\n`);
  await writeJson(OUTPUT_STATUS, status);

  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildHandoff({ recovery, nextP0, quick, due, ownerNext, redline, sourceReadiness, batch }, generatedAt) {
  const rows = (recovery.recovery_rows ?? nextP0.inputs ?? []).map((row) => ({
    rank: row.rank,
    role: row.role,
    tracking_link_id: row.tracking_link_id,
    event_type: row.event_type,
    stage_label: row.stage_label,
    source_surface: row.source_surface,
    evidence_rule: row.evidence_rule,
    missing: row.missing !== false,
    target_live_file: row.target_live_file,
    paste_key: `${row.role}.${eventAlias(row.event_type)}`,
    external_effect: false,
  }));
  const missingRows = rows.filter((row) => row.missing);
  const sourceGroups = groupRows(rows);
  const quickProgress = buildQuickProgress(quick, recovery, nextP0, rows);
  const fullP0 = buildFullP0Status(batch);
  const pasteBlock = buildPasteBlock(missingRows, generatedAt);
  const sampleThresholdMet = Boolean(recovery.sample_threshold_met);
  const status = sampleThresholdMet
    ? "sample_counts_not_needed_sample_met"
    : missingRows.length > 0
      ? "waiting_for_owner_sample_counts"
      : "sample_counts_collected_preview_ready";

  return {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "owner_sample_count_handoff_local_only",
    status,
    due_status: recovery.due_status ?? due.status,
    due_phase: recovery.due_phase ?? due.due_phase,
    due_now: Boolean(recovery.due_now ?? due.due_now),
    current_round: recovery.current_round ?? nextP0.current_round ?? null,
    current_real_event_rows: recovery.current_real_event_rows ?? sourceReadiness.real_event_rows ?? 0,
    sample_threshold_met: sampleThresholdMet,
    sample_rate_win_candidate: Boolean(recovery.sample_rate_win_candidate),
    p0_input_count: recovery.p0_input_count ?? rows.length,
    missing_count: missingRows.length,
    focused_quick_path_scope: "batch_1_focused_next_p0",
    full_p0_status: fullP0.status,
    full_p0_task_count: fullP0.task_count,
    full_p0_row_count: fullP0.row_count,
    full_p0_pending_count: fullP0.pending_count,
    full_p0_focused_batch_row_count: fullP0.focused_batch_row_count,
    full_p0_remaining_batch_row_count: fullP0.remaining_batch_row_count,
    full_p0_batch_count: fullP0.batch_count,
    full_p0_coverage_ready: fullP0.coverage_ready,
    full_p0_batch_status_path: fullP0.status_path,
    full_p0_batch_handoff_path: fullP0.handoff_path,
    full_p0_batch_1_paste_block_path: fullP0.batch_1_paste_block_path,
    full_p0_batch_2_paste_block_path: fullP0.batch_2_paste_block_path,
    quick_count_count: quick.quick_count_count ?? recovery.quick_count_count ?? 0,
    quick_capture_status: quickProgress.status,
    quick_expected_row_count: quickProgress.expected_row_count,
    quick_filled_rank_count: quickProgress.filled_rank_count,
    quick_filled_ranks: quickProgress.filled_ranks,
    quick_missing_rank_count: quickProgress.missing_rank_count,
    quick_missing_ranks: quickProgress.missing_ranks,
    quick_partial_waiting: quickProgress.partial_waiting,
    quick_partial_auto_counts: quickProgress.partial_auto_counts,
    quick_template_created: quickProgress.template_created,
    quick_paste_template_created: quickProgress.paste_template_created,
    quick_paste_template_preserved: quickProgress.paste_template_preserved,
    quick_filled_preview_created: quickProgress.filled_preview_created,
    quick_filled_preview_path: quickProgress.filled_preview_path,
    quick_next_safe_action: quickProgress.next_safe_action,
    source_group_count: sourceGroups.length,
    paste_template_path: recovery.paste_template_path ?? quick.paste_template_path ?? "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
    paste_block_path: OUTPUT_PASTE_BLOCK,
    paste_block: pasteBlock.text,
    paste_block_lines: pasteBlock.lines,
    paste_block_line_count: pasteBlock.lines.length,
    paste_key_count: missingRows.length,
    browser_form_path: recovery.browser_form_path ?? "next_p0_owner_form.html",
    quick_report_path: "next_p0_quick_capture.md",
    intake_report_path: recovery.focused_intake_path ?? "next_p0_owner_intake.md",
    recovery_pack_path: "sample_gate_recovery_pack.md",
    owner_next_action_path: "owner_next_action.md",
    primary_owner_action_id: ownerNext.primary_action?.id ?? ownerNext.primary_action_id ?? "collect_owner_sample_gate_counts",
    primary_owner_action_command: ownerNext.primary_action?.command ?? ownerNext.primary_action_command ?? `open ${quick.paste_template_path ?? "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt"}`,
    next_operator_action: redline.next_operator_action ?? null,
    required_fields: [
      "capture_date",
      "evidence_ref",
      "reviewer",
      "pii_checked=yes",
      "aggregate counts for every missing rank",
    ],
    one_screen_rows: rows,
    missing_rows: missingRows,
    source_groups: sourceGroups,
    acceptance_checks: [
      "Every missing rank has a non-negative integer count.",
      "capture_date is present and ISO-like.",
      "evidence_ref points to aggregate analytics or LINE OA aggregate source only.",
      "reviewer is non-sensitive and pii_checked=yes.",
      "No customer name, phone, email, chat message, payment, or row-level lead data is pasted.",
    ],
    after_fill_commands: recovery.command_sequence_after_owner_counts ?? [
      "npm run next-p0:quick",
      "npm run next-p0:intake",
      "npm run owner:data-preflight",
      "npm run weekly:local",
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
    review_artifacts: [
      "owner_sample_count_handoff.md",
      OUTPUT_PASTE_BLOCK,
      "sample_gate_recovery_pack.md",
      "sample_gate_batch_handoff.md",
      "sample_gate_batch_1_paste_block.txt",
      "sample_gate_batch_2_paste_block.txt",
      "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
      "next_p0_owner_form.html",
      "next_p0_quick_capture.md",
      "next_p0_owner_intake.md",
      "owner_next_action.md",
      "redline_priority.md",
    ],
    outputs: {
      handoff_json: OUTPUT_JSON,
      handoff_md: OUTPUT_MD,
      paste_block_txt: OUTPUT_PASTE_BLOCK,
      status_json: OUTPUT_STATUS,
    },
    ...RED_LINE_FALSE,
    note: "Local owner sample-count handoff only. It condenses existing aggregate-count requirements and performs no live input creation, event write, deploy, GitHub, post, LINE, payment, customer-data, or delete action.",
  };
}

function buildStatus(handoff, generatedAt) {
  return {
    ok: handoff.ok,
    generated_at: generatedAt.toISOString(),
    mode: handoff.mode,
    status: handoff.status,
    due_status: handoff.due_status,
    due_now: handoff.due_now,
    current_real_event_rows: handoff.current_real_event_rows,
    sample_threshold_met: handoff.sample_threshold_met,
    p0_input_count: handoff.p0_input_count,
    missing_count: handoff.missing_count,
    focused_quick_path_scope: handoff.focused_quick_path_scope,
    full_p0_status: handoff.full_p0_status,
    full_p0_task_count: handoff.full_p0_task_count,
    full_p0_row_count: handoff.full_p0_row_count,
    full_p0_pending_count: handoff.full_p0_pending_count,
    full_p0_focused_batch_row_count: handoff.full_p0_focused_batch_row_count,
    full_p0_remaining_batch_row_count: handoff.full_p0_remaining_batch_row_count,
    full_p0_batch_count: handoff.full_p0_batch_count,
    full_p0_coverage_ready: handoff.full_p0_coverage_ready,
    full_p0_batch_status_path: handoff.full_p0_batch_status_path,
    full_p0_batch_handoff_path: handoff.full_p0_batch_handoff_path,
    full_p0_batch_1_paste_block_path: handoff.full_p0_batch_1_paste_block_path,
    full_p0_batch_2_paste_block_path: handoff.full_p0_batch_2_paste_block_path,
    quick_count_count: handoff.quick_count_count,
    quick_capture_status: handoff.quick_capture_status,
    quick_expected_row_count: handoff.quick_expected_row_count,
    quick_filled_rank_count: handoff.quick_filled_rank_count,
    quick_filled_ranks: handoff.quick_filled_ranks,
    quick_missing_rank_count: handoff.quick_missing_rank_count,
    quick_missing_ranks: handoff.quick_missing_ranks,
    quick_partial_waiting: handoff.quick_partial_waiting,
    quick_partial_auto_counts: handoff.quick_partial_auto_counts,
    quick_template_created: handoff.quick_template_created,
    quick_paste_template_created: handoff.quick_paste_template_created,
    quick_paste_template_preserved: handoff.quick_paste_template_preserved,
    quick_filled_preview_created: handoff.quick_filled_preview_created,
    source_group_count: handoff.source_group_count,
    after_fill_command_count: handoff.after_fill_commands.length,
    blocked_action_count: handoff.blocked_actions.length,
    paste_template_path: handoff.paste_template_path,
    paste_block_path: handoff.paste_block_path,
    paste_block_line_count: handoff.paste_block_line_count,
    paste_key_count: handoff.paste_key_count,
    browser_form_path: handoff.browser_form_path,
    outputs: handoff.outputs,
    ...RED_LINE_FALSE,
  };
}

function renderMarkdown(handoff) {
  const bluf = handoff.sample_threshold_met
    ? "Sample threshold is already met; this handoff is retained for audit only."
    : `Owner sample-count handoff is ready for Batch 1: ${handoff.missing_count}/${handoff.p0_input_count} focused P0 rows still need aggregate counts. Full P0 coverage is ${handoff.full_p0_row_count ?? 0}/${handoff.full_p0_task_count ?? 0} rows mapped, with ${handoff.full_p0_remaining_batch_row_count ?? 0} remaining content-variant rows; fill Batch 1 first, then Batch 2 before treating Week 0 P0 as covered.`;

  return `# Owner Sample Count Handoff

BLUF: ${bluf}

Generated: ${handoff.generated_at}
Mode: ${handoff.mode}
Status: ${handoff.status}
Due status: ${handoff.due_status}
Real event rows: ${handoff.current_real_event_rows}
Sample threshold met: ${handoff.sample_threshold_met ? "yes" : "no"}

## Quick Count Progress

- Quick capture status: ${handoff.quick_capture_status}
- Filled ranks: ${handoff.quick_filled_rank_count}/${handoff.quick_expected_row_count} (${formatRanks(handoff.quick_filled_ranks)})
- Missing ranks: ${handoff.quick_missing_rank_count}/${handoff.quick_expected_row_count} (${formatRanks(handoff.quick_missing_ranks)})
- Partial waiting: ${handoff.quick_partial_waiting ? "yes" : "no"}
- Partial auto counts: ${handoff.quick_partial_auto_counts ? "yes" : "no"}
- Paste template: \`${handoff.paste_template_path}\`
- Filled preview created: ${handoff.quick_filled_preview_created ? "yes" : "no"}

## Full P0 Coverage

- Scope of this handoff: ${handoff.focused_quick_path_scope}
- Full P0 status: ${handoff.full_p0_status}
- Full P0 rows mapped: ${handoff.full_p0_row_count ?? 0}/${handoff.full_p0_task_count ?? 0}
- Full P0 pending rows: ${handoff.full_p0_pending_count ?? 0}
- Batch count: ${handoff.full_p0_batch_count ?? 0}
- Batch 1 focused rows: ${handoff.full_p0_focused_batch_row_count ?? 0}
- Batch 2 remaining content-variant rows: ${handoff.full_p0_remaining_batch_row_count ?? 0}
- Full coverage ready: ${handoff.full_p0_coverage_ready ? "yes" : "no"}
- Full handoff: \`${handoff.full_p0_batch_handoff_path}\`
- Batch 1 paste block: \`${handoff.full_p0_batch_1_paste_block_path}\`
- Batch 2 paste block: \`${handoff.full_p0_batch_2_paste_block_path}\`

## One Screen Action

1. Open \`${handoff.full_p0_batch_handoff_path}\` for the full 18-row P0 map.
2. Fill Batch 1 focused rows through \`${handoff.paste_template_path}\` or \`${handoff.browser_form_path}\`.
3. Use \`${handoff.paste_block_path}\` for the focused quick path, then fill \`${handoff.full_p0_batch_2_paste_block_path}\` before treating Week 0 P0 as covered.
4. Run the local commands in order after owner review.

Primary owner action: \`${handoff.primary_owner_action_command}\`
Next operator action: ${handoff.next_operator_action ?? "n/a"}

## Batch 1 Focused Copy/Paste Block

Paste this block into \`${handoff.paste_template_path}\`, then replace only the metadata placeholders and \`<count>\` values.

Copy-only file: \`${handoff.paste_block_path}\`

\`\`\`txt
${handoff.paste_block}
\`\`\`

## Batch 1 Focused Missing Rows

| rank | paste key | role | event | source | evidence rule |
|---:|---|---|---|---|---|
${handoff.missing_rows.map((row) => `| ${row.rank} | \`${row.paste_key}\` | ${row.role} | ${row.event_type} | ${row.source_surface} | ${row.evidence_rule} |`).join("\n")}

## Source Groups

| source | rows | missing | events |
|---|---:|---:|---|
${handoff.source_groups.map((group) => `| ${group.source_surface} | ${group.row_count} | ${group.missing_count} | ${group.event_types.join(", ")} |`).join("\n")}

## Acceptance Checks

${handoff.acceptance_checks.map((item) => `- ${item}`).join("\n")}

## After Fill Commands

${handoff.after_fill_commands.map((command, index) => `${index + 1}. \`${command}\``).join("\n")}

## Blocked Actions

${handoff.blocked_actions.map((action) => `- ${action}`).join("\n")}

## Safety

- External effect: ${handoff.external_effect ? "yes" : "no"}
- Live input files created: ${handoff.live_input_files_created ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${handoff.data_lp_events_write_performed ? "yes" : "no"}
- Public link change performed: ${handoff.public_link_change_performed ? "yes" : "no"}
- Production deploy performed: ${handoff.production_deploy_performed ? "yes" : "no"}
- GitHub push / PR performed: ${handoff.github_push_or_pr_performed ? "yes" : "no"}
- Formal post performed: ${handoff.formal_post_performed ? "yes" : "no"}
- LINE push performed: ${handoff.line_push_performed ? "yes" : "no"}
- Customer-data mutation performed: ${handoff.customer_data_mutation_performed ? "yes" : "no"}
- Payment action performed: ${handoff.payment_action_performed ? "yes" : "no"}
- Delete action performed: ${handoff.delete_action_performed ? "yes" : "no"}
`;
}

function buildQuickProgress(quick, recovery, nextP0, rows) {
  const expectedRowCount = quick.expected_row_count ?? nextP0.current_input_count ?? recovery.p0_input_count ?? rows.length;
  const missingRanks = quick.missing_ranks ?? recovery.missing_ranks ?? rows.filter((row) => row.missing).map((row) => row.rank);

  return {
    status: quick.status ?? "unknown",
    expected_row_count: expectedRowCount,
    filled_rank_count: quick.filled_rank_count ?? quick.quick_count_count ?? recovery.quick_count_count ?? 0,
    filled_ranks: quick.filled_ranks ?? [],
    missing_rank_count: quick.missing_rank_count ?? missingRanks.length,
    missing_ranks: missingRanks,
    partial_waiting: Boolean(quick.partial_waiting),
    partial_auto_counts: Boolean(quick.partial_auto_counts),
    template_created: Boolean(quick.template_created),
    paste_template_created: Boolean(quick.paste_template_created),
    paste_template_preserved: Boolean(quick.paste_template_preserved),
    filled_preview_created: Boolean(quick.filled_preview_created),
    filled_preview_path: quick.filled_preview_path ?? "data/next_p0_quick_capture/next_p0_owner_inputs.quick-filled.preview.csv",
    next_safe_action: quick.next_safe_action ?? null,
  };
}

function buildFullP0Status(batch) {
  return {
    status: batch.status ?? "unknown",
    task_count: batch.p0_task_count ?? null,
    row_count: batch.all_p0_row_count ?? null,
    pending_count: batch.p0_pending_count ?? null,
    focused_batch_row_count: batch.focused_batch_row_count ?? null,
    remaining_batch_row_count: batch.remaining_batch_row_count ?? null,
    batch_count: batch.batch_count ?? null,
    coverage_ready: Boolean(batch.full_coverage_ready),
    status_path: PATHS.batch,
    handoff_path: "sample_gate_batch_handoff.md",
    batch_1_paste_block_path: "sample_gate_batch_1_paste_block.txt",
    batch_2_paste_block_path: "sample_gate_batch_2_paste_block.txt",
  };
}

function buildPasteBlock(missingRows, generatedAt) {
  const captureDate = taipeiDate(generatedAt);
  const lines = [
    `capture_date=${captureDate}`,
    "evidence_ref=<aggregate_ref>",
    "reviewer=<alias>",
    "pii_checked=yes",
    ...missingRows.map((row) => `${row.paste_key}=<count>`),
  ];
  return {
    lines,
    text: lines.join("\n"),
  };
}

function taipeiDate(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatRanks(ranks) {
  if (!Array.isArray(ranks) || ranks.length === 0) return "none";
  return ranks.join(", ");
}

function groupRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.source_surface ?? "unknown";
    if (!groups.has(key)) {
      groups.set(key, {
        source_surface: key,
        row_count: 0,
        missing_count: 0,
        event_types: new Set(),
        external_effect: false,
      });
    }
    const group = groups.get(key);
    group.row_count += 1;
    if (row.missing) group.missing_count += 1;
    group.event_types.add(row.event_type);
  }
  return Array.from(groups.values()).map((group) => ({
    source_surface: group.source_surface,
    row_count: group.row_count,
    missing_count: group.missing_count,
    event_types: Array.from(group.event_types).sort(),
    external_effect: false,
  }));
}

function eventAlias(eventType) {
  if (eventType === "page_view") return "visits";
  if (eventType === "cta_click") return "cta";
  if (eventType === "line_add") return "line";
  return String(eventType ?? "count").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
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
