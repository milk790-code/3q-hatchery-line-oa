import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const NEXT_P0_INPUTS_PATH = path.join(ROOT, "next_p0_owner_inputs.json");
const QUICK_STATUS_PATH = path.join(ROOT, "data", "next_p0_quick_capture_status.json");
const DUE_STATUS_PATH = path.join(ROOT, "sample_gate_due_status.json");
const OWNER_NEXT_ACTION_PATH = path.join(ROOT, "owner_next_action.json");
const DATA_PROGRESS_PATH = path.join(ROOT, "data", "data_collection_progress_status.json");
const OWNER_SAMPLE_GATE_PATH = path.join(ROOT, "data", "owner_sample_gate_status.json");
const SOURCE_READINESS_PATH = path.join(ROOT, "data", "source_readiness_status.json");
const OUTPUT_JSON_PATH = path.join(ROOT, "sample_gate_recovery_pack.json");
const OUTPUT_MD_PATH = path.join(ROOT, "sample_gate_recovery_pack.md");
const STATUS_PATH = path.join(ROOT, "data", "sample_gate_recovery_pack_status.json");

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
  const [nextP0, quick, due, ownerNextAction, progress, ownerSampleGate, sourceReadiness] = await Promise.all([
    readJson(NEXT_P0_INPUTS_PATH),
    readJson(QUICK_STATUS_PATH),
    readJson(DUE_STATUS_PATH),
    readJson(OWNER_NEXT_ACTION_PATH),
    readJson(DATA_PROGRESS_PATH),
    readJson(OWNER_SAMPLE_GATE_PATH),
    readJson(SOURCE_READINESS_PATH),
  ]);

  const pack = buildPack({
    generatedAt,
    nextP0,
    quick,
    due,
    ownerNextAction,
    progress,
    ownerSampleGate,
    sourceReadiness,
  });
  const status = buildStatus(pack, generatedAt);

  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeJson(OUTPUT_JSON_PATH, pack);
  await writeFile(OUTPUT_MD_PATH, renderMarkdown(pack));
  await writeJson(STATUS_PATH, status);

  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildPack({ generatedAt, nextP0, quick, due, ownerNextAction, progress, ownerSampleGate, sourceReadiness }) {
  const inputs = nextP0.inputs ?? [];
  const missingRanks = quick.missing_ranks ?? inputs.map((input) => String(input.rank));
  const recoveryRows = inputs.map((input) => ({
    rank: input.rank,
    role: input.role,
    tracking_link_id: input.tracking_link_id,
    event_type: input.event_type,
    stage_label: input.stage_label,
    source_surface: input.source_surface,
    target_live_file: input.target_live_file,
    evidence_rule: input.evidence_rule,
    missing: missingRanks.includes(String(input.rank)),
    external_effect: false,
  }));
  const sourceGroups = groupRecoveryRows(recoveryRows);
  const sampleGaps = sourceReadiness.sample_progress?.gaps ?? ownerNextAction.sample_gaps ?? {};
  const isDue = due.due_now === true;
  const isOverdue = String(due.status ?? "").includes("overdue");
  const status = ownerSampleGate.sample_threshold_met
    ? "sample_gate_met_recovery_not_needed"
    : isOverdue
      ? "day3_overdue_recovery_ready"
      : isDue
        ? "sample_gate_due_recovery_ready"
        : "sample_gate_waiting_recovery_prepared";

  return {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "sample_gate_recovery_pack_local_only",
    status,
    week: nextP0.week ?? due.week ?? null,
    current_round: nextP0.current_round ?? ownerNextAction.current_round ?? null,
    due_status: due.status,
    due_phase: due.due_phase,
    due_date: due.due_date,
    due_now: Boolean(due.due_now),
    days_since_min_check: due.days_since_min_check ?? null,
    preferred_check_date: due.preferred_check_date ?? null,
    current_real_event_rows: sourceReadiness.real_event_rows ?? 0,
    p0_input_count: nextP0.current_input_count ?? inputs.length,
    p0_pending_count: progress.p0_pending_count ?? ownerSampleGate.pending_rows ?? missingRanks.length,
    quick_count_count: quick.quick_count_count ?? 0,
    missing_rank_count: missingRanks.length,
    missing_ranks: missingRanks,
    sample_threshold_met: Boolean(ownerSampleGate.sample_threshold_met),
    sample_rate_win_candidate: Boolean(ownerSampleGate.sample_rate_win_candidate),
    champion_action: due.champion_action ?? "keep_champion_sample_insufficient",
    challenger_promotion_allowed: false,
    next_variable_rotation_allowed: false,
    sample_gaps: {
      visits: Number(sampleGaps.visits ?? 0),
      cta_clicks: Number(sampleGaps.cta_clicks ?? 0),
      line_adds: Number(sampleGaps.line_adds ?? 0),
      test_days: Number(sampleGaps.test_days ?? 0),
    },
    source_groups: sourceGroups,
    recovery_rows: recoveryRows,
    paste_template_path: quick.paste_template_path ?? "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
    browser_form_path: "next_p0_owner_form.html",
    sample_gate_form_path: "sample_gate_owner_form.html",
    focused_intake_path: "next_p0_owner_intake.md",
    sample_gate_intake_path: "owner_sample_gate_intake.md",
    command_sequence_after_owner_counts: [
      "npm run next-p0:quick",
      "npm run next-p0:intake",
      "npm run owner:data-preflight",
      "npm run data:progress",
      "npm run owner:sample-gate",
      "npm run owner:next-action",
      "npm run sample-gate:recovery",
      "npm run weekly:local",
    ],
    owner_fast_path: [
      {
        step: 1,
        action: "Open the paste template or focused browser form.",
        artifact: quick.paste_template_path ?? "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
        external_effect: false,
      },
      {
        step: 2,
        action: "Fill only aggregate counts for the missing ranks, plus capture_date, evidence_ref, reviewer, and pii_checked=yes.",
        artifact: "next_p0_owner_inputs.json",
        external_effect: false,
      },
      {
        step: 3,
        action: "Run the local preview commands; do not stage, publish, deploy, change links, push LINE, or mutate customer data.",
        artifact: "next_p0_owner_intake.md",
        external_effect: false,
      },
    ],
    blocked_actions: [
      "fake_or_backfill_counts_without_owner_source",
      "stage_owner_download_without_review",
      "append_to_data_lp_events_jsonl",
      "promote_challenger_to_champion",
      "rotate_next_variable",
      "formal_social_post_or_schedule",
      "line_push_or_broadcast",
      "public_ab_or_bio_link_change",
      "production_worker_deploy",
      "github_push_or_pr_creation",
      "customer_data_mutation",
      "ecpay_payment_refund_or_capture",
      "delete_data_or_retire_live_assets",
    ],
    review_artifacts: [
      "sample_gate_recovery_pack.md",
      "sample_gate_due_status.md",
      "owner_next_action.md",
      "next_p0_quick_capture.md",
      "data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt",
      "next_p0_owner_form.html",
      "next_p0_owner_inputs.md",
      "data_collection_progress.md",
      "owner_sample_gate_status.md",
      "sample_gate_capture_calendar.md",
    ],
    outputs: {
      recovery_json: "sample_gate_recovery_pack.json",
      recovery_md: "sample_gate_recovery_pack.md",
      status_json: "data/sample_gate_recovery_pack_status.json",
    },
    ...RED_LINE_FALSE,
    note: "Local Day 3 / Day 7 recovery pack only. It packages existing sample-gate counts needed from the owner and writes no live input, event, external, deploy, GitHub, post, LINE, payment, customer-data, or delete action.",
  };
}

function groupRecoveryRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.source_surface;
    if (!groups.has(key)) {
      groups.set(key, {
        source_surface: key,
        row_count: 0,
        missing_count: 0,
        event_types: new Set(),
        target_live_files: new Set(),
        external_effect: false,
      });
    }
    const group = groups.get(key);
    group.row_count += 1;
    if (row.missing) group.missing_count += 1;
    group.event_types.add(row.event_type);
    group.target_live_files.add(row.target_live_file);
  }

  return Array.from(groups.values()).map((group) => ({
    source_surface: group.source_surface,
    row_count: group.row_count,
    missing_count: group.missing_count,
    event_types: Array.from(group.event_types).sort(),
    target_live_files: Array.from(group.target_live_files).sort(),
    external_effect: false,
  }));
}

function buildStatus(pack, generatedAt) {
  return {
    ok: pack.ok,
    generated_at: generatedAt.toISOString(),
    mode: pack.mode,
    status: pack.status,
    due_status: pack.due_status,
    due_phase: pack.due_phase,
    due_now: pack.due_now,
    days_since_min_check: pack.days_since_min_check,
    current_real_event_rows: pack.current_real_event_rows,
    p0_input_count: pack.p0_input_count,
    p0_pending_count: pack.p0_pending_count,
    quick_count_count: pack.quick_count_count,
    missing_rank_count: pack.missing_rank_count,
    sample_threshold_met: pack.sample_threshold_met,
    sample_rate_win_candidate: pack.sample_rate_win_candidate,
    champion_action: pack.champion_action,
    challenger_promotion_allowed: pack.challenger_promotion_allowed,
    next_variable_rotation_allowed: pack.next_variable_rotation_allowed,
    source_group_count: pack.source_groups.length,
    command_count: pack.command_sequence_after_owner_counts.length,
    blocked_action_count: pack.blocked_actions.length,
    outputs: pack.outputs,
    ...RED_LINE_FALSE,
  };
}

function renderMarkdown(pack) {
  return `# Sample Gate Recovery Pack

BLUF: ${pack.sample_threshold_met ? "Sample gate is met; this recovery pack is no longer the primary action." : `Day 3 sample-gate recovery is ready locally: ${pack.missing_rank_count}/${pack.p0_input_count} focused rows still need aggregate counts, and the champion stays active until thresholds are proven.`}

Generated: ${pack.generated_at}
Mode: ${pack.mode}
Status: ${pack.status}
Due status: ${pack.due_status}
Due phase: ${pack.due_phase ?? "n/a"}
Due date: ${pack.due_date ?? "n/a"}
Days since minimum check: ${pack.days_since_min_check ?? "n/a"}
Preferred check date: ${pack.preferred_check_date ?? "n/a"}

External effect: no
Live input files created: no
data/lp_events.jsonl write performed: no
Formal post performed: no
LINE push performed: no
Public link change performed: no
Production deploy performed: no
GitHub push or PR performed: no
Customer data mutation performed: no
Payment action performed: no
Delete action performed: no

## Current Gate

- Current real event rows: ${pack.current_real_event_rows}
- P0 focused rows: ${pack.p0_input_count}
- P0 pending rows: ${pack.p0_pending_count}
- Quick counts supplied: ${pack.quick_count_count}
- Missing ranks: ${pack.missing_ranks.join(", ") || "none"}
- Sample threshold met: ${pack.sample_threshold_met ? "yes" : "no"}
- Sample gaps: visits=${pack.sample_gaps.visits}, cta_clicks=${pack.sample_gaps.cta_clicks}, line_adds=${pack.sample_gaps.line_adds}, test_days=${pack.sample_gaps.test_days}
- Champion action: ${pack.champion_action}
- Challenger promotion allowed: ${pack.challenger_promotion_allowed ? "yes" : "no"}
- Next variable rotation allowed: ${pack.next_variable_rotation_allowed ? "yes" : "no"}

## Owner Fast Path

${pack.owner_fast_path.map((item) => `${item.step}. ${item.action} Artifact: \`${item.artifact}\`.`).join("\n")}

## Missing Rows

| rank | role | event | source | target file | missing |
|---:|---|---|---|---|---|
${pack.recovery_rows.map((row) => `| ${row.rank} | ${row.role} | ${row.event_type} | ${row.source_surface} | ${row.target_live_file} | ${row.missing ? "yes" : "no"} |`).join("\n")}

## Source Groups

| source | rows | missing | events | target files |
|---|---:|---:|---|---|
${pack.source_groups.map((group) => `| ${group.source_surface} | ${group.row_count} | ${group.missing_count} | ${group.event_types.join(", ")} | ${group.target_live_files.join(", ")} |`).join("\n")}

## Local Command Sequence After Owner Counts

${pack.command_sequence_after_owner_counts.map((command) => `- \`${command}\``).join("\n")}

## Blocked Actions

${pack.blocked_actions.map((action) => `- ${action}`).join("\n")}
`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
