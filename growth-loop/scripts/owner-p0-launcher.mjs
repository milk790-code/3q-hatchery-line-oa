import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const COMMAND_PATH = path.join(ROOT, "OPEN-P0-SAMPLE-GATE.command");
const REPORT_PATH = path.join(ROOT, "owner_p0_launcher.md");
const STATUS_PATH = path.join(ROOT, "data", "owner_p0_launcher_status.json");

const OPEN_TARGETS = [
  {
    id: "owner_p0_now_html",
    label: "P0 now cockpit",
    path: "owner_p0_now.html",
    purpose: "Start here for the current P0 sample-count action.",
  },
  {
    id: "owner_p0_now_md",
    label: "P0 now markdown",
    path: "owner_p0_now.md",
    purpose: "Review the same P0 action in Markdown.",
  },
  {
    id: "sample_gate_batch_handoff",
    label: "Full P0 batch handoff",
    path: "sample_gate_batch_handoff.md",
    purpose: "Keep the full 18-row P0 coverage requirement visible.",
  },
  {
    id: "sample_gate_collection_sprint",
    label: "Collection sprint",
    path: "sample_gate_collection_sprint.md",
    purpose: "Use the timeboxed Day 3 / Day 7 sprint before opening the paste blocks.",
  },
  {
    id: "sample_gate_batch_1_paste_block",
    label: "P0 batch 1 paste block",
    path: "sample_gate_batch_1_paste_block.txt",
    purpose: "Copy the 9 focused champion, challenger, and LINE CTA aggregate keys first.",
  },
  {
    id: "sample_gate_batch_2_paste_block",
    label: "P0 batch 2 paste block",
    path: "sample_gate_batch_2_paste_block.txt",
    purpose: "Copy the remaining 9 content-variant aggregate keys before treating P0 as covered.",
  },
  {
    id: "focused_paste_template",
    label: "Focused paste template",
    path: "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
    purpose: "Paste aggregate counts into the focused 9-row quick template.",
  },
  {
    id: "p0_counts_preflight",
    label: "P0 counts preflight",
    path: "p0_counts_preflight.md",
    purpose: "Check waiting, partial, ready, or invalid state before quick preview.",
  },
  {
    id: "sample_gate_form",
    label: "Full P0 browser form",
    path: "sample_gate_owner_form.html",
    purpose: "Fill all 18 P0 aggregate sample-gate rows through a browser-only local form.",
  },
  {
    id: "sample_gate_intake",
    label: "Full P0 intake",
    path: "owner_sample_gate_intake.md",
    purpose: "Review the full P0 owner-download intake before any local staging.",
  },
  {
    id: "sample_count_handoff",
    label: "Sample count handoff",
    path: "owner_sample_count_handoff.md",
    purpose: "Use after counts are filled to see the next local verification commands.",
  },
  {
    id: "sample_count_recovery",
    label: "Sample count recovery",
    path: "owner_sample_count_recovery.md",
    purpose: "Confirm whether quick capture, intake, preflight, and sample checks recovered.",
  },
  {
    id: "sample_gate_due_status",
    label: "Sample gate due status",
    path: "sample_gate_due_status.md",
    purpose: "Check the current Day 3 or Day 7 timing state.",
  },
];

async function main() {
  const generatedAt = new Date();
  const ownerP0Now = await readJson("data/owner_p0_now_status.json", {});
  const ownerNextAction = await readJson("data/owner_next_action_status.json", {});
  const quickCapture = await readJson("data/next_p0_quick_capture_status.json", {});
  const p0CountsPreflight = await readJson("data/p0_counts_preflight_status.json", {});
  const sampleGateBatchHandoff = await readJson("data/sample_gate_batch_handoff_status.json", {});
  const sampleGateCollectionSprint = await readJson("data/sample_gate_collection_sprint_status.json", {});
  const ownerSampleCountHandoff = await readJson("data/owner_sample_count_handoff_status.json", {});
  const ownerSampleCountRecovery = await readJson("data/owner_sample_count_recovery_status.json", {});
  const sampleGateDueStatus = await readJson("data/sample_gate_due_status_status.json", {});
  const approvalStatus = await readJson("data/approval_queue_status.json", {});

  const targets = [];
  for (const target of OPEN_TARGETS) {
    const absolutePath = path.join(ROOT, target.path);
    targets.push({
      ...target,
      absolute_path: absolutePath,
      exists: await fileExists(absolutePath),
    });
  }
  const missingTargets = targets.filter((target) => !target.exists).map((target) => target.path);

  const context = {
    generatedAt,
    targets,
    ownerP0Now,
    ownerNextAction,
    quickCapture,
    p0CountsPreflight,
    sampleGateBatchHandoff,
    sampleGateCollectionSprint,
    ownerSampleCountHandoff,
    ownerSampleCountRecovery,
    sampleGateDueStatus,
    approvalStatus,
  };

  const command = renderCommand(context);
  const report = renderReport(context);
  const status = {
    ok: missingTargets.length === 0,
    generated_at: generatedAt.toISOString(),
    mode: "owner_p0_launcher",
    command_path: COMMAND_PATH,
    report_path: REPORT_PATH,
    target_count: targets.length,
    targets,
    missing_targets: missingTargets,
    owner_next_action_status: ownerNextAction.status ?? "unknown",
    owner_next_action_primary_action_id: ownerNextAction.primary_action_id ?? "unknown",
    owner_p0_now_status: ownerP0Now.status ?? "unknown",
    owner_p0_now_focused_missing_count: ownerP0Now.p0_focused_missing_count ?? 0,
    owner_p0_now_focused_total_count: ownerP0Now.p0_focused_total_count ?? 0,
    owner_p0_now_full_row_count: ownerP0Now.p0_full_row_count ?? 0,
    owner_p0_now_full_task_count: ownerP0Now.p0_full_task_count ?? 0,
    owner_p0_now_full_pending_count: ownerP0Now.p0_full_pending_count ?? 0,
    owner_p0_now_batch_count: ownerP0Now.p0_batch_count ?? 0,
    owner_p0_now_batch_1_row_count: ownerP0Now.p0_batch_1_row_count ?? 0,
    owner_p0_now_batch_2_row_count: ownerP0Now.p0_batch_2_row_count ?? 0,
    owner_p0_now_copy_block_count: ownerP0Now.copy_block_count ?? 0,
    owner_p0_now_copy_block_line_count: ownerP0Now.copy_block_line_count ?? 0,
    owner_p0_now_after_fill_command_count: ownerP0Now.after_fill_command_count ?? 0,
    owner_p0_now_after_full_p0_command_count: ownerP0Now.after_full_p0_command_count ?? 0,
    quick_capture_status: quickCapture.status ?? "unknown",
    quick_capture_expected_row_count: quickCapture.expected_row_count ?? 0,
    quick_capture_quick_count_count: quickCapture.quick_count_count ?? 0,
    quick_capture_filled_rank_count: quickCapture.filled_rank_count ?? 0,
    quick_capture_missing_rank_count: quickCapture.missing_rank_count ?? 0,
    quick_capture_missing_ranks: quickCapture.missing_ranks ?? [],
    quick_capture_partial_waiting: quickCapture.partial_waiting ?? false,
    quick_capture_template_path: quickCapture.paste_template_path ?? "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
    p0_counts_preflight_status: p0CountsPreflight.status ?? "unknown",
    p0_counts_preflight_ready_for_quick_preview: p0CountsPreflight.ready_for_quick_preview ?? false,
    p0_counts_preflight_expected_count_key_count: p0CountsPreflight.expected_count_key_count ?? 0,
    p0_counts_preflight_filled_count_key_count: p0CountsPreflight.filled_count_key_count ?? 0,
    p0_counts_preflight_placeholder_count_key_count: p0CountsPreflight.placeholder_count_key_count ?? 0,
    p0_counts_preflight_issue_count: p0CountsPreflight.issue_count ?? 0,
    sample_gate_batch_handoff_status: sampleGateBatchHandoff.status ?? "unknown",
    sample_gate_batch_handoff_p0_task_count: sampleGateBatchHandoff.p0_task_count ?? 0,
    sample_gate_batch_handoff_all_p0_row_count: sampleGateBatchHandoff.all_p0_row_count ?? 0,
    sample_gate_batch_handoff_focused_batch_row_count: sampleGateBatchHandoff.focused_batch_row_count ?? 0,
    sample_gate_batch_handoff_remaining_batch_row_count: sampleGateBatchHandoff.remaining_batch_row_count ?? 0,
    sample_gate_batch_handoff_full_coverage_ready: sampleGateBatchHandoff.full_coverage_ready ?? false,
    sample_gate_collection_sprint_status: sampleGateCollectionSprint.status ?? "unknown",
    sample_gate_collection_sprint_p0_pending_count: sampleGateCollectionSprint.p0_pending_count ?? 0,
    sample_gate_collection_sprint_step_count: sampleGateCollectionSprint.sprint_step_count ?? 0,
    owner_sample_count_handoff_status: ownerSampleCountHandoff.status ?? "unknown",
    owner_sample_count_handoff_after_fill_command_count: ownerSampleCountHandoff.after_fill_command_count ?? 0,
    owner_sample_count_recovery_status: ownerSampleCountRecovery.status ?? "unknown",
    owner_sample_count_recovery_full_p0_row_count: ownerSampleCountRecovery.full_p0_row_count ?? 0,
    owner_sample_count_recovery_full_p0_pending_count: ownerSampleCountRecovery.full_p0_pending_count ?? 0,
    owner_sample_count_recovery_full_p0_form_status: ownerSampleCountRecovery.full_p0_form_status ?? "unknown",
    owner_sample_count_recovery_full_p0_form_row_count: ownerSampleCountRecovery.full_p0_form_row_count ?? 0,
    owner_sample_count_recovery_full_p0_intake_status: ownerSampleCountRecovery.full_p0_intake_status ?? "unknown",
    owner_sample_count_recovery_full_p0_intake_ready: ownerSampleCountRecovery.full_p0_intake_ready ?? false,
    owner_sample_count_recovery_full_p0_staged_ready: ownerSampleCountRecovery.full_p0_staged_ready ?? false,
    sample_gate_due_status: sampleGateDueStatus.status ?? "unknown",
    sample_gate_due_phase: sampleGateDueStatus.due_phase ?? "unknown",
    sample_gate_due_now: sampleGateDueStatus.due_now ?? false,
    sample_gate_due_date: sampleGateDueStatus.due_date ?? "unknown",
    sample_gate_preferred_check_date: sampleGateDueStatus.preferred_check_date ?? "unknown",
    approval_queue_status: approvalStatus.status ?? "unknown",
    approval_queue_pending_human_count: approvalStatus.pending_human_count ?? 0,
    approval_queue_next_pending_human_id: approvalStatus.next_pending_human_id ?? "none",
    next_safe_step: "fill_batch_1_then_batch_2_then_review_preflight",
    command_opens_local_files_only: true,
    opens_external_urls: false,
    network_calls_performed: false,
    browser_persistence: false,
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
    note: "P0-only local launcher. The generated command opens local sample-gate files and prints current counts; it does not submit, publish, deploy, push, send LINE, mutate customer data, process payments, or delete data.",
  };

  await writeFile(COMMAND_PATH, command);
  await chmod(COMMAND_PATH, 0o755);
  await writeFile(REPORT_PATH, report);
  await writeJson(STATUS_PATH, status);
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

function renderCommand(context) {
  const quick = context.quickCapture ?? {};
  const p0Now = context.ownerP0Now ?? {};
  const preflight = context.p0CountsPreflight ?? {};
  const recovery = context.ownerSampleCountRecovery ?? {};
  const due = context.sampleGateDueStatus ?? {};
  const batch = context.sampleGateBatchHandoff ?? {};
  const sprint = context.sampleGateCollectionSprint ?? {};
  const approval = context.approvalStatus ?? {};
  const missingRanks = Array.isArray(quick.missing_ranks) && quick.missing_ranks.length > 0
    ? quick.missing_ranks.join(",")
    : "none";
  const openLines = context.targets.map((target) => `open "$ROOT/${target.path}"`).join("\n");
  const openedLines = context.targets.map((target) => `echo "- ${target.path}"`).join("\n");

  return `#!/bin/zsh
set -eu

ROOT="${ROOT}"
cd "$ROOT"

echo "Opening 3Q Growth Loop P0 sample-gate files..."
echo "This launcher opens local files only. It performs no external URLs, deploys, posts, LINE sends, payment actions, customer-data changes, or removal actions."
echo "Current P0 action: ${escapeForDoubleQuotedShell(context.ownerNextAction?.primary_action_id ?? "unknown")}"
echo "Due status: ${escapeForDoubleQuotedShell(due.status ?? "unknown")} / phase ${escapeForDoubleQuotedShell(due.due_phase ?? "unknown")} / due_now ${due.due_now ? "yes" : "no"} / due_date ${escapeForDoubleQuotedShell(due.due_date ?? "unknown")} / preferred ${escapeForDoubleQuotedShell(due.preferred_check_date ?? "unknown")}"
echo "P0 now: ${escapeForDoubleQuotedShell(p0Now.status ?? "unknown")} / focused missing ${Number(p0Now.p0_focused_missing_count ?? 0)}/${Number(p0Now.p0_focused_total_count ?? 0)}, full P0 ${Number(p0Now.p0_full_row_count ?? 0)}/${Number(p0Now.p0_full_task_count ?? 0)}, pending ${Number(p0Now.p0_full_pending_count ?? 0)}"
echo "Copy blocks: ${Number(p0Now.copy_block_count ?? 0)} blocks / ${Number(p0Now.copy_block_line_count ?? 0)} lines / batch rows ${Number(p0Now.p0_batch_1_row_count ?? 0)} + ${Number(p0Now.p0_batch_2_row_count ?? 0)}"
echo "Quick count progress: ${escapeForDoubleQuotedShell(quick.status ?? "unknown")} / filled ${Number(quick.filled_rank_count ?? 0)}/${Number(quick.expected_row_count ?? 0)}, missing ${Number(quick.missing_rank_count ?? 0)}, partial ${quick.partial_waiting ? "yes" : "no"} / missing ranks ${escapeForDoubleQuotedShell(missingRanks)}"
echo "P0 counts preflight: ${escapeForDoubleQuotedShell(preflight.status ?? "unknown")} / ready ${preflight.ready_for_quick_preview ? "yes" : "no"} / filled ${Number(preflight.filled_count_key_count ?? 0)}/${Number(preflight.expected_count_key_count ?? 0)} / placeholders ${Number(preflight.placeholder_count_key_count ?? 0)} / issues ${Number(preflight.issue_count ?? 0)}"
echo "Full P0 batch handoff: ${escapeForDoubleQuotedShell(batch.status ?? "unknown")} / focused ${Number(batch.focused_batch_row_count ?? 0)} / remaining ${Number(batch.remaining_batch_row_count ?? 0)} / full ${batch.full_coverage_ready ? "yes" : "no"}"
echo "Collection sprint: ${escapeForDoubleQuotedShell(sprint.status ?? "unknown")} / pending ${Number(sprint.p0_pending_count ?? 0)}/${Number(sprint.p0_full_task_count ?? 0)} / steps ${Number(sprint.sprint_step_count ?? 0)}"
echo "Full P0 form/intake: form ${escapeForDoubleQuotedShell(recovery.full_p0_form_status ?? "unknown")} rows ${Number(recovery.full_p0_form_row_count ?? 0)}, intake ${escapeForDoubleQuotedShell(recovery.full_p0_intake_status ?? "unknown")}, intake_ready ${recovery.full_p0_intake_ready ? "yes" : "no"}, staged ${recovery.full_p0_staged_ready ? "yes" : "no"}"
echo "Sample count recovery: ${escapeForDoubleQuotedShell(recovery.status ?? "unknown")} / full rows ${Number(recovery.full_p0_row_count ?? 0)} / pending ${Number(recovery.full_p0_pending_count ?? 0)}"
echo "Approval queue: ${escapeForDoubleQuotedShell(approval.status ?? "unknown")} / pending human ${Number(approval.pending_human_count ?? 0)} / next ${escapeForDoubleQuotedShell(approval.next_pending_human_id ?? "none")}"

${openLines}

echo ""
echo "Opened P0 local files:"
${openedLines}
echo ""
echo "Next: fill Batch 1 first, then Batch 2, then review p0_counts_preflight.md and owner_sample_count_handoff.md."
echo "Close this Terminal window when finished."
`;
}

function renderReport(context) {
  const rows = context.targets
    .map((target) => `| ${target.label} | ${target.path} | ${target.exists ? "yes" : "missing"} | ${target.purpose} |`)
    .join("\n");
  const p0Now = context.ownerP0Now ?? {};
  const quick = context.quickCapture ?? {};
  const preflight = context.p0CountsPreflight ?? {};
  const recovery = context.ownerSampleCountRecovery ?? {};
  const due = context.sampleGateDueStatus ?? {};
  const batch = context.sampleGateBatchHandoff ?? {};
  const sprint = context.sampleGateCollectionSprint ?? {};

  return `# 3Q Growth Loop P0 Sample-Gate Launcher

BLUF: This is the narrow local launcher for the current blocker: owner aggregate sample counts. It opens only the P0 sample-gate files needed to fill Batch 1, fill Batch 2, check preflight, and review recovery state. It performs no external action.

Generated: ${context.generatedAt.toISOString()}
Command: OPEN-P0-SAMPLE-GATE.command
Current action: ${context.ownerNextAction?.primary_action_id ?? "unknown"}
Due status: ${due.status ?? "unknown"} / phase=${due.due_phase ?? "unknown"} / due_now=${due.due_now ? "yes" : "no"} / due_date=${due.due_date ?? "unknown"} / preferred=${due.preferred_check_date ?? "unknown"}
P0 now: ${p0Now.status ?? "unknown"} / focused=${p0Now.p0_focused_missing_count ?? 0}/${p0Now.p0_focused_total_count ?? 0} / full=${p0Now.p0_full_row_count ?? 0}/${p0Now.p0_full_task_count ?? 0} / pending=${p0Now.p0_full_pending_count ?? 0}
Copy blocks: blocks=${p0Now.copy_block_count ?? 0} / lines=${p0Now.copy_block_line_count ?? 0} / batch1=${p0Now.p0_batch_1_row_count ?? 0} / batch2=${p0Now.p0_batch_2_row_count ?? 0}
Quick count progress: ${quick.status ?? "unknown"} / filled=${quick.filled_rank_count ?? 0}/${quick.expected_row_count ?? 0} / missing=${quick.missing_rank_count ?? 0} / partial=${quick.partial_waiting ? "yes" : "no"}
P0 counts preflight: ${preflight.status ?? "unknown"} / ready=${preflight.ready_for_quick_preview ? "yes" : "no"} / filled=${preflight.filled_count_key_count ?? 0}/${preflight.expected_count_key_count ?? 0} / placeholders=${preflight.placeholder_count_key_count ?? 0} / issues=${preflight.issue_count ?? 0}
Full P0 batch handoff: ${batch.status ?? "unknown"} / focused=${batch.focused_batch_row_count ?? 0} / remaining=${batch.remaining_batch_row_count ?? 0} / full=${batch.full_coverage_ready ? "yes" : "no"}
Collection sprint: ${sprint.status ?? "unknown"} / pending=${sprint.p0_pending_count ?? 0}/${sprint.p0_full_task_count ?? 0} / steps=${sprint.sprint_step_count ?? 0}
Full P0 form/intake: form=${recovery.full_p0_form_status ?? "unknown"} / rows=${recovery.full_p0_form_row_count ?? 0} / intake=${recovery.full_p0_intake_status ?? "unknown"} / intake_ready=${recovery.full_p0_intake_ready ? "yes" : "no"} / staged=${recovery.full_p0_staged_ready ? "yes" : "no"}
Sample count recovery: ${recovery.status ?? "unknown"} / full=${recovery.full_p0_row_count ?? 0} / pending=${recovery.full_p0_pending_count ?? 0}
Approval queue: ${context.approvalStatus?.status ?? "unknown"} / pending_human=${context.approvalStatus?.pending_human_count ?? 0} / next=${context.approvalStatus?.next_pending_human_id ?? "none"}

## Open Targets

| target | local path | exists | purpose |
|---|---|---|---|
${rows}

## Safety Contract

- Opens local files only: yes
- External URLs: no
- Network calls: no
- Browser persistence: no
- Live input files created by generator: no
- data/lp_events.jsonl write: no
- Formal post / schedule / send: no
- LINE push: no
- Production deploy: no
- GitHub push / PR: no
- Public link change: no
- Customer data mutation: no
- Payment action: no
- Delete action: no

## Intended Use

1. Run or double-click OPEN-P0-SAMPLE-GATE.command.
2. Open owner_p0_now.html and fill Batch 1 first.
3. Fill Batch 2 before treating Week 0 P0 sample collection as covered.
4. Review p0_counts_preflight.md; it must be ready before quick preview can be trusted.
5. Use owner_sample_count_handoff.md and owner_sample_count_recovery.md to continue local verification after counts are filled.
`;
}

function escapeForDoubleQuotedShell(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"")
    .replaceAll("$", "\\$")
    .replaceAll("`", "\\`");
}

async function readJson(relativePath, fallback) {
  try {
    return JSON.parse(await readFile(path.join(ROOT, relativePath), "utf8"));
  } catch {
    return fallback;
  }
}

async function fileExists(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main();
