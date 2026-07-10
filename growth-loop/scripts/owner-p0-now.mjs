import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OUTPUT_JSON = "owner_p0_now.json";
const OUTPUT_MD = "owner_p0_now.md";
const OUTPUT_HTML = "owner_p0_now.html";
const OUTPUT_STATUS = "data/owner_p0_now_status.json";

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
  const ownerNextAction = await readJson("data/owner_next_action_status.json", {});
  const handoff = await readJson("owner_sample_count_handoff.json", {});
  const handoffStatus = await readJson("data/owner_sample_count_handoff_status.json", {});
  const batchStatus = await readJson("data/sample_gate_batch_handoff_status.json", {});
  const quick = await readJson("data/next_p0_quick_capture_status.json", {});
  const p0CountsPreflight = await readJson("data/p0_counts_preflight_status.json", {});
  const sampleGateForm = await readJson("data/sample_gate_owner_form_status.json", {});
  const sampleGateIntake = await readJson("data/owner_sample_gate_intake_status.json", {});
  const approval = await readJson("data/approval_queue_status.json", {});
  const goalAudit = await readJson("data/goal_completion_audit_status.json", {});
  const batch1PasteBlock = await readText("sample_gate_batch_1_paste_block.txt");
  const batch2PasteBlock = await readText("sample_gate_batch_2_paste_block.txt");

  const card = buildCard({
    generatedAt,
    ownerNextAction,
    handoff,
    handoffStatus,
    batchStatus,
    quick,
    p0CountsPreflight,
    sampleGateForm,
    sampleGateIntake,
    approval,
    goalAudit,
    batch1PasteBlock,
    batch2PasteBlock,
  });

  await writeJson(OUTPUT_JSON, card);
  await writeFile(resolve(OUTPUT_MD), renderMarkdown(card));
  await writeFile(resolve(OUTPUT_HTML), renderHtml(card));
  await mkdir(path.dirname(resolve(OUTPUT_STATUS)), { recursive: true });
  await writeJson(OUTPUT_STATUS, buildStatus(card));
  console.log(JSON.stringify(buildStatus(card), null, 2));
}

function buildCard({ generatedAt, ownerNextAction, handoff, handoffStatus, batchStatus, quick, p0CountsPreflight, sampleGateForm, sampleGateIntake, approval, goalAudit, batch1PasteBlock, batch2PasteBlock }) {
  const missingRows = Array.isArray(handoff.missing_rows) ? handoff.missing_rows : [];
  const afterFillCommands = Array.isArray(handoff.after_fill_commands)
    ? handoff.after_fill_commands
    : ["npm run next-p0:quick", "npm run next-p0:intake", "npm run owner:data-preflight", "npm run weekly:local"];
  const status = goalAudit.complete === true
    ? "goal_complete_no_p0_action"
    : handoffStatus.status ?? ownerNextAction.status ?? "waiting_for_owner_sample_gate_counts";

  const primaryOpenTargets = [
    "owner_p0_now.html",
    "owner_p0_now.md",
    "sample_gate_batch_1_paste_block.txt",
    localPath(handoffStatus.paste_template_path ?? handoff.paste_template_path ?? "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt"),
    "p0_counts_preflight.md",
    "sample_gate_batch_2_paste_block.txt",
    "sample_gate_owner_form.html",
    "owner_sample_gate_intake.md",
    "owner_sample_count_handoff.md",
  ];

  return {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "owner_p0_now_local_only",
    status,
    bluf: buildBluf({ handoffStatus, batchStatus, quick, p0CountsPreflight, sampleGateForm, sampleGateIntake, approval, goalAudit }),
    next_owner_action: ownerNextAction.primary_action_command ?? "open sample_gate_batch_handoff.md",
    current_real_event_rows: goalAudit.current_real_event_rows ?? handoffStatus.current_real_event_rows ?? 0,
    sample_threshold_met: Boolean(goalAudit.sample_threshold_met ?? handoffStatus.sample_threshold_met),
    sample_gate_status: goalAudit.sample_gate_status ?? "waiting_for_sample_gate_counts",
    p0_focused_missing_count: handoffStatus.missing_count ?? missingRows.length,
    p0_focused_total_count: handoffStatus.p0_input_count ?? handoff.p0_input_count ?? 0,
    p0_full_row_count: batchStatus.all_p0_row_count ?? handoffStatus.full_p0_row_count ?? 0,
    p0_full_task_count: batchStatus.p0_task_count ?? handoffStatus.full_p0_task_count ?? 0,
    p0_full_pending_count: batchStatus.p0_pending_count ?? handoffStatus.full_p0_pending_count ?? 0,
    p0_batch_count: batchStatus.batch_count ?? handoffStatus.full_p0_batch_count ?? 0,
    p0_batch_1_row_count: batchStatus.focused_batch_row_count ?? handoffStatus.full_p0_focused_batch_row_count ?? 0,
    p0_batch_2_row_count: batchStatus.remaining_batch_row_count ?? handoffStatus.full_p0_remaining_batch_row_count ?? 0,
    quick_status: quick.status ?? handoffStatus.quick_capture_status ?? "unknown",
    quick_expected_row_count: quick.expected_row_count ?? handoffStatus.quick_expected_row_count ?? 0,
    quick_filled_rank_count: quick.filled_rank_count ?? handoffStatus.quick_filled_rank_count ?? 0,
    quick_missing_rank_count: quick.missing_rank_count ?? handoffStatus.quick_missing_rank_count ?? 0,
    quick_missing_ranks: quick.missing_ranks ?? handoffStatus.quick_missing_ranks ?? [],
    p0_counts_preflight_status: p0CountsPreflight.status ?? "unknown",
    p0_counts_preflight_ready_for_quick_preview: p0CountsPreflight.ready_for_quick_preview ?? false,
    p0_counts_preflight_expected_count_key_count: p0CountsPreflight.expected_count_key_count ?? 0,
    p0_counts_preflight_filled_count_key_count: p0CountsPreflight.filled_count_key_count ?? 0,
    p0_counts_preflight_placeholder_count_key_count: p0CountsPreflight.placeholder_count_key_count ?? 0,
    p0_counts_preflight_issue_count: p0CountsPreflight.issue_count ?? 0,
    sample_gate_form_status: sampleGateForm.status ?? "unknown",
    sample_gate_form_row_count: sampleGateForm.row_count ?? 0,
    sample_gate_form_download_filename: sampleGateForm.download_filename ?? "sample_gate_ledger.filled.csv",
    sample_gate_form_owner_filled_path: localPath(sampleGateForm.owner_filled_path ?? "data/source_capture/sample_gate_ledger.filled.csv"),
    sample_gate_form_network_calls_performed: sampleGateForm.network_calls_performed ?? false,
    sample_gate_intake_status: sampleGateIntake.status ?? "unknown",
    sample_gate_intake_candidate_found: sampleGateIntake.candidate_found ?? false,
    sample_gate_intake_candidate_valid: sampleGateIntake.candidate_valid ?? false,
    sample_gate_intake_stage_performed: sampleGateIntake.stage_performed ?? false,
    sample_gate_intake_live_input_files_created: sampleGateIntake.live_input_files_created ?? false,
    approval_queue_status: approval.status ?? "unknown",
    approval_queue_item_count: approval.item_count ?? 0,
    approval_queue_pending_human_count: approval.pending_human_count ?? 0,
    approval_queue_next_pending_human_id: approval.next_pending_human_id ?? "none",
    primary_open_targets: primaryOpenTargets,
    copy_first_path: "sample_gate_batch_1_paste_block.txt",
    copy_second_path: "sample_gate_batch_2_paste_block.txt",
    paste_template_path: localPath(handoffStatus.paste_template_path ?? handoff.paste_template_path ?? "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt"),
    copy_blocks: [
      {
        id: "batch_1_focused_counts",
        label: "Batch 1 focused counts",
        path: "sample_gate_batch_1_paste_block.txt",
        row_count: batchStatus.focused_batch_row_count ?? handoffStatus.full_p0_focused_batch_row_count ?? 0,
        text: batch1PasteBlock.trim(),
      },
      {
        id: "batch_2_remaining_counts",
        label: "Batch 2 remaining counts",
        path: "sample_gate_batch_2_paste_block.txt",
        row_count: batchStatus.remaining_batch_row_count ?? handoffStatus.full_p0_remaining_batch_row_count ?? 0,
        text: batch2PasteBlock.trim(),
      },
    ],
    complete_handoff_path: "owner_sample_count_handoff.md",
    owner_form_fallback_path: handoff.browser_form_path ?? "next_p0_owner_form.html",
    full_p0_owner_form_path: "sample_gate_owner_form.html",
    full_p0_intake_report_path: "owner_sample_gate_intake.md",
    after_fill_commands: afterFillCommands,
    after_full_p0_commands: Array.isArray(batchStatus.after_full_p0_commands)
      ? batchStatus.after_full_p0_commands
      : [
          "npm run owner:intake",
          "npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled",
          "npm run owner:sample-gate",
          "npm run weekly:local",
        ],
    stop_lines: [
      "Do not invent, backfill, or estimate sample counts without an owner-reviewed aggregate source.",
      "Do not paste customer names, phone, email, LINE user IDs, chat text, payment data, order IDs, or lead rows.",
      "Do not append data/lp_events.jsonl from this card.",
      "Do not promote a challenger, change public links, deploy production, post, push LINE, create a PR, touch payments, mutate customer data, or delete data.",
    ],
    missing_rows: missingRows.map((row) => ({
      rank: row.rank,
      role: row.role,
      event_type: row.event_type,
      paste_key: row.paste_key,
      source_surface: row.source_surface,
      evidence_rule: row.evidence_rule,
    })),
    review_artifacts: [
      "owner_p0_now.html",
      "owner_p0_now.md",
      "owner_p0_now.json",
      "data/owner_p0_now_status.json",
      "owner_sample_count_handoff.md",
      "owner_sample_count_paste_block.txt",
      "sample_gate_batch_1_paste_block.txt",
      "sample_gate_batch_2_paste_block.txt",
      "sample_gate_batch_handoff.md",
      "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
      "next_p0_quick_capture.md",
      "p0_counts_preflight.md",
      "p0_counts_preflight.json",
      "data/p0_counts_preflight_status.json",
      "sample_gate_owner_form.html",
      "data/sample_gate_owner_form_status.json",
      "owner_sample_gate_intake.md",
      "data/owner_sample_gate_intake_status.json",
      "owner_next_action.md",
    ],
    ...RED_LINE_FALSE,
    note: "Local P0 owner-now card only. It condenses existing local sample-count handoffs and performs no live input creation, event write, deploy, GitHub, post, LINE, payment, customer-data, or delete action.",
  };
}

function buildStatus(card) {
  return {
    ok: card.ok,
    generated_at: card.generated_at,
    mode: card.mode,
    status: card.status,
    current_real_event_rows: card.current_real_event_rows,
    sample_threshold_met: card.sample_threshold_met,
    sample_gate_status: card.sample_gate_status,
    p0_focused_missing_count: card.p0_focused_missing_count,
    p0_focused_total_count: card.p0_focused_total_count,
    p0_full_row_count: card.p0_full_row_count,
    p0_full_task_count: card.p0_full_task_count,
    p0_full_pending_count: card.p0_full_pending_count,
    p0_batch_count: card.p0_batch_count,
    p0_batch_1_row_count: card.p0_batch_1_row_count,
    p0_batch_2_row_count: card.p0_batch_2_row_count,
    quick_status: card.quick_status,
    quick_expected_row_count: card.quick_expected_row_count,
    quick_filled_rank_count: card.quick_filled_rank_count,
    quick_missing_rank_count: card.quick_missing_rank_count,
    p0_counts_preflight_status: card.p0_counts_preflight_status,
    p0_counts_preflight_ready_for_quick_preview: card.p0_counts_preflight_ready_for_quick_preview,
    p0_counts_preflight_expected_count_key_count: card.p0_counts_preflight_expected_count_key_count,
    p0_counts_preflight_filled_count_key_count: card.p0_counts_preflight_filled_count_key_count,
    p0_counts_preflight_placeholder_count_key_count: card.p0_counts_preflight_placeholder_count_key_count,
    p0_counts_preflight_issue_count: card.p0_counts_preflight_issue_count,
    sample_gate_form_status: card.sample_gate_form_status,
    sample_gate_form_row_count: card.sample_gate_form_row_count,
    sample_gate_form_network_calls_performed: card.sample_gate_form_network_calls_performed,
    sample_gate_intake_status: card.sample_gate_intake_status,
    sample_gate_intake_candidate_found: card.sample_gate_intake_candidate_found,
    sample_gate_intake_candidate_valid: card.sample_gate_intake_candidate_valid,
    sample_gate_intake_stage_performed: card.sample_gate_intake_stage_performed,
    sample_gate_intake_live_input_files_created: card.sample_gate_intake_live_input_files_created,
    approval_queue_status: card.approval_queue_status,
    approval_queue_pending_human_count: card.approval_queue_pending_human_count,
    approval_queue_next_pending_human_id: card.approval_queue_next_pending_human_id,
    primary_open_target_count: card.primary_open_targets.length,
    primary_open_targets: card.primary_open_targets,
    copy_block_count: card.copy_blocks.length,
    copy_block_line_count: card.copy_blocks.reduce((sum, block) => sum + block.text.split(/\r?\n/).filter(Boolean).length, 0),
    after_fill_command_count: card.after_fill_commands.length,
    after_full_p0_command_count: card.after_full_p0_commands.length,
    review_artifact_count: card.review_artifacts.length,
    ...RED_LINE_FALSE,
  };
}

function buildBluf({ handoffStatus, batchStatus, quick, p0CountsPreflight, sampleGateForm, sampleGateIntake, approval, goalAudit }) {
  const missing = handoffStatus.missing_count ?? quick.missing_rank_count ?? 0;
  const total = handoffStatus.p0_input_count ?? quick.expected_row_count ?? 0;
  const fullRows = batchStatus.all_p0_row_count ?? handoffStatus.full_p0_row_count ?? 0;
  const fullTasks = batchStatus.p0_task_count ?? handoffStatus.full_p0_task_count ?? 0;
  const nextGate = approval.next_pending_human_id ?? "none";
  if (goalAudit.complete === true) {
    return "Goal audit reports complete; keep this card for audit only.";
  }
  const preflightStatus = p0CountsPreflight.status ?? "unknown";
  const preflightFilled = p0CountsPreflight.filled_count_key_count ?? 0;
  const preflightExpected = p0CountsPreflight.expected_count_key_count ?? 0;
  const formStatus = sampleGateForm.status ?? "unknown";
  const intakeStatus = sampleGateIntake.status ?? "unknown";
  return `P0 now: fill ${missing}/${total} focused aggregate rows first, then Batch 2 through the full P0 form before treating Week 0 P0 as covered. Preflight is ${preflightStatus} (${preflightFilled}/${preflightExpected} count keys); full P0 coverage is ${fullRows}/${fullTasks}; full form is ${formStatus}; intake is ${intakeStatus}; next human gate is ${nextGate}.`;
}

function renderMarkdown(card) {
  return `# 3Q Growth Loop P0 Now

BLUF: ${card.bluf}

Generated: ${card.generated_at}
Status: ${card.status}
Real event rows: ${card.current_real_event_rows}
Sample threshold met: ${card.sample_threshold_met ? "yes" : "no"}
Sample gate status: ${card.sample_gate_status}

## Do First

1. Open \`${card.copy_first_path}\` and copy Batch 1 focused counts.
2. Paste into \`${card.paste_template_path}\` and replace placeholders with aggregate counts only.
3. Open \`p0_counts_preflight.md\` and confirm the focused paste template is ready or fix listed issues.
4. Open \`${card.copy_second_path}\`, then use \`${card.full_p0_owner_form_path}\` when all 18 P0 rows need one reviewed CSV.
5. Review \`${card.full_p0_intake_report_path}\` after downloading the full P0 CSV.
6. Run after-fill commands from this card.

## Current Counts

| item | value |
|---|---:|
| Focused missing rows | ${card.p0_focused_missing_count}/${card.p0_focused_total_count} |
| Full P0 rows mapped | ${card.p0_full_row_count}/${card.p0_full_task_count} |
| Full P0 pending rows | ${card.p0_full_pending_count} |
| Batch 1 focused rows | ${card.p0_batch_1_row_count} |
| Batch 2 remaining rows | ${card.p0_batch_2_row_count} |
| Quick filled ranks | ${card.quick_filled_rank_count}/${card.quick_expected_row_count} |
| Quick missing ranks | ${formatList(card.quick_missing_ranks)} |
| P0 preflight status | ${card.p0_counts_preflight_status} |
| P0 preflight count keys | ${card.p0_counts_preflight_filled_count_key_count}/${card.p0_counts_preflight_expected_count_key_count} |
| P0 preflight placeholders | ${card.p0_counts_preflight_placeholder_count_key_count} |
| P0 preflight issues | ${card.p0_counts_preflight_issue_count} |
| Full P0 form status | ${card.sample_gate_form_status} |
| Full P0 form rows | ${card.sample_gate_form_row_count} |
| Full P0 intake status | ${card.sample_gate_intake_status} |
| Full P0 intake candidate found | ${card.sample_gate_intake_candidate_found ? "yes" : "no"} |
| Full P0 intake staged | ${card.sample_gate_intake_stage_performed ? "yes" : "no"} |
| Approval queue pending human | ${card.approval_queue_pending_human_count} |
| Approval queue next human gate | ${card.approval_queue_next_pending_human_id} |

## Open These First

${card.primary_open_targets.map((target) => `- \`${target}\``).join("\n")}

## Missing Focused Rows

| rank | role | event | paste key | source |
|---:|---|---|---|---|
${card.missing_rows.map((row) => `| ${row.rank ?? ""} | ${row.role ?? ""} | ${row.event_type ?? ""} | \`${row.paste_key ?? ""}\` | ${row.source_surface ?? ""} |`).join("\n")}

## Copy Blocks

${card.copy_blocks.map((block) => `### ${block.label}

Path: \`${block.path}\`
Rows: ${block.row_count}

\`\`\`text
${block.text}
\`\`\``).join("\n\n")}

## After Fill Commands

\`\`\`bash
${card.after_fill_commands.join("\n")}
\`\`\`

## After Full P0 Commands

\`\`\`bash
${card.after_full_p0_commands.join("\n")}
\`\`\`

## Stop Lines

${card.stop_lines.map((line) => `- ${line}`).join("\n")}

## Safety

- External effect: no
- Live input files created: no
- data/lp_events.jsonl write performed: no
- Public link change performed: no
- Production deploy performed: no
- GitHub push / PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
`;
}

function renderHtml(card) {
  const metrics = [
    ["Focused missing rows", `${card.p0_focused_missing_count}/${card.p0_focused_total_count}`],
    ["Full P0 rows mapped", `${card.p0_full_row_count}/${card.p0_full_task_count}`],
    ["Batch 1 focused rows", card.p0_batch_1_row_count],
    ["Batch 2 remaining rows", card.p0_batch_2_row_count],
    ["Quick filled ranks", `${card.quick_filled_rank_count}/${card.quick_expected_row_count}`],
    ["Quick missing ranks", formatList(card.quick_missing_ranks)],
    ["P0 preflight", card.p0_counts_preflight_status],
    ["Preflight keys", `${card.p0_counts_preflight_filled_count_key_count}/${card.p0_counts_preflight_expected_count_key_count}`],
    ["Preflight issues", card.p0_counts_preflight_issue_count],
    ["Full P0 form", `${card.sample_gate_form_status} / ${card.sample_gate_form_row_count}`],
    ["Full P0 intake", card.sample_gate_intake_status],
    ["Next human gate", card.approval_queue_next_pending_human_id],
  ];
  return `<!doctype html>
<html lang="en" data-external-effect="false">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>3Q Growth Loop P0 Now</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #1d2a2e;
      --muted: #5d6b70;
      --line: #d8e0df;
      --paper: #f7f8f5;
      --panel: #ffffff;
      --accent: #1b7f6a;
      --warn: #a35b00;
      --block: #9a2f2f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }
    main {
      max-width: 1120px;
      margin: 0 auto;
      padding: 24px;
    }
    header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 18px;
      align-items: start;
      border-bottom: 1px solid var(--line);
      padding-bottom: 18px;
      margin-bottom: 18px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 30px;
      line-height: 1.1;
      letter-spacing: 0;
    }
    h2 {
      margin: 0 0 12px;
      font-size: 17px;
      letter-spacing: 0;
    }
    p { margin: 0; }
    .stamp {
      display: grid;
      gap: 6px;
      min-width: 260px;
      font-size: 13px;
      color: var(--muted);
    }
    .badge {
      display: inline-block;
      width: fit-content;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 4px 10px;
      color: var(--accent);
      background: #edf7f3;
      font-size: 12px;
      font-weight: 700;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin: 18px 0;
    }
    .metric, .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
    }
    .metric strong {
      display: block;
      font-size: 22px;
      line-height: 1.2;
      margin-top: 6px;
    }
    .metric span, .muted {
      color: var(--muted);
      font-size: 13px;
    }
    .columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }
    ol, ul {
      margin: 0;
      padding-left: 20px;
    }
    li + li { margin-top: 8px; }
    a {
      color: var(--accent);
      overflow-wrap: anywhere;
    }
    code, pre {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 13px;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      background: #f2f5f2;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
    }
    .copy-blocks {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }
    .copy-blocks pre {
      user-select: all;
      min-height: 196px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      text-align: left;
      border-bottom: 1px solid var(--line);
      padding: 8px 6px;
      vertical-align: top;
    }
    th { color: var(--muted); font-weight: 700; }
    .stop li { color: var(--block); }
    .safety {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      font-size: 13px;
    }
    .safety div {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px;
      background: #fbfcfa;
    }
    @media (max-width: 840px) {
      main { padding: 14px; }
      header, .columns { grid-template-columns: 1fr; }
      .copy-blocks { grid-template-columns: 1fr; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .safety { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <section>
        <span class="badge">local only</span>
        <h1>3Q Growth Loop P0 Now</h1>
        <p>${escapeHtml(card.bluf)}</p>
      </section>
      <aside class="stamp" aria-label="status">
        <span>Generated: ${escapeHtml(card.generated_at)}</span>
        <span>Status: ${escapeHtml(card.status)}</span>
        <span>P0 preflight: ${escapeHtml(card.p0_counts_preflight_status)}</span>
        <span>Real event rows: ${escapeHtml(card.current_real_event_rows)}</span>
        <span>External effect: false</span>
      </aside>
    </header>

    <section class="grid" aria-label="P0 metrics">
      ${metrics.map(([label, value]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("\n      ")}
    </section>

    <section class="columns">
      <div class="panel">
        <h2>Do First</h2>
        <ol>
          <li>Open ${artifactLink(card.copy_first_path)} and copy Batch 1 focused counts.</li>
          <li>Paste into ${artifactLink(card.paste_template_path)} and replace placeholders with aggregate counts only.</li>
          <li>Open ${artifactLink("p0_counts_preflight.md")} and confirm the paste template is ready or fix listed issues.</li>
          <li>Open ${artifactLink(card.copy_second_path)}, then use ${artifactLink(card.full_p0_owner_form_path)} when all 18 P0 rows need one reviewed CSV.</li>
          <li>Review ${artifactLink(card.full_p0_intake_report_path)} after downloading the full P0 CSV.</li>
          <li>Run the after-fill commands below.</li>
        </ol>
      </div>
      <div class="panel">
        <h2>Open Targets</h2>
        <ul>
          ${card.primary_open_targets.map((target) => `<li>${artifactLink(target)}</li>`).join("\n          ")}
        </ul>
      </div>
    </section>

    <section class="panel" style="margin-bottom:12px">
      <h2>Missing Focused Rows</h2>
      <table>
        <thead><tr><th>Rank</th><th>Role</th><th>Event</th><th>Paste key</th><th>Source</th></tr></thead>
        <tbody>
          ${card.missing_rows.map((row) => `<tr><td>${escapeHtml(row.rank ?? "")}</td><td>${escapeHtml(row.role ?? "")}</td><td>${escapeHtml(row.event_type ?? "")}</td><td><code>${escapeHtml(row.paste_key ?? "")}</code></td><td>${escapeHtml(row.source_surface ?? "")}</td></tr>`).join("\n          ")}
        </tbody>
      </table>
    </section>

    <section class="copy-blocks" aria-label="copy blocks">
      ${card.copy_blocks.map((block) => `<div class="panel"><h2>${escapeHtml(block.label)}</h2><p class="muted">${artifactLink(block.path)} / rows ${escapeHtml(block.row_count)}</p><pre>${escapeHtml(block.text)}</pre></div>`).join("\n      ")}
    </section>

    <section class="columns">
      <div class="panel">
        <h2>After Fill Commands</h2>
        <pre>${escapeHtml(card.after_fill_commands.join("\n"))}</pre>
      </div>
      <div class="panel">
        <h2>After Full P0 Commands</h2>
        <pre>${escapeHtml(card.after_full_p0_commands.join("\n"))}</pre>
      </div>
    </section>

    <section class="columns">
      <div class="panel">
        <h2>Stop Lines</h2>
        <ul class="stop">
          ${card.stop_lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("\n          ")}
        </ul>
      </div>
    </section>

    <section class="panel">
      <h2>Safety</h2>
      <div class="safety">
        <div>Live input files created: no</div>
        <div>data/lp_events.jsonl write performed: no</div>
        <div>Production deploy performed: no</div>
        <div>Public link change performed: no</div>
        <div>GitHub push / PR performed: no</div>
        <div>Formal post / LINE push performed: no</div>
        <div>Customer data mutation performed: no</div>
        <div>Payment action performed: no</div>
        <div>Delete action performed: no</div>
      </div>
    </section>
  </main>
</body>
</html>
`;
}

function artifactLink(relativePath) {
  const safePath = escapeHtml(relativePath);
  return `<a href="${safePath}"><code>${safePath}</code></a>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatList(value) {
  return Array.isArray(value) && value.length > 0 ? value.join(", ") : "none";
}

function localPath(value) {
  const text = String(value ?? "");
  if (!text) return text;
  const absoluteRoot = `${ROOT}${path.sep}`;
  return text.startsWith(absoluteRoot) ? text.slice(absoluteRoot.length) : text;
}

async function readJson(relativePath, fallback = {}) {
  try {
    return JSON.parse(await readFile(resolve(relativePath), "utf8"));
  } catch {
    return fallback;
  }
}

async function readText(relativePath) {
  try {
    return await readFile(resolve(relativePath), "utf8");
  } catch {
    return "";
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
