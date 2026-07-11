import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const PACKET_PATH = path.join(ROOT, "manual_publish_packet.json");
const WORKSHEET_PATH = path.join(ROOT, "sample_gate_owner_worksheet.json");
const NORTH_STAR_PATH = path.join(ROOT, "north_star_funnel.json");
const LINE_PLAYBOOK_PATH = path.join(ROOT, "line_inbound_playbook.json");
const OWNER_SAMPLE_GATE_PATH = path.join(ROOT, "data", "owner_sample_gate_status.json");
const OUTPUT_JSON_PATH = path.join(ROOT, "manual_publish_capture_plan.json");
const OUTPUT_MD_PATH = path.join(ROOT, "manual_publish_capture_plan.md");
const STATUS_PATH = path.join(ROOT, "data", "manual_publish_capture_plan_status.json");

const SAMPLE_GATE_EVENTS = ["page_view", "cta_click", "line_add"];
const NORTH_STAR_EVENTS = ["link_click", "line_add", "lead_submit", "deal"];
const QUALITY_EVENTS = ["quality_flag"];
const RED_LINE_FLAGS = {
  external_effect: false,
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
  const [packet, worksheet, northStar, linePlaybook, ownerSampleGate] = await Promise.all([
    readJson(PACKET_PATH),
    readJson(WORKSHEET_PATH),
    readJson(NORTH_STAR_PATH),
    readJson(LINE_PLAYBOOK_PATH),
    readJson(OWNER_SAMPLE_GATE_PATH),
  ]);
  const plan = buildPlan({ generatedAt, packet, worksheet, northStar, linePlaybook, ownerSampleGate });
  const status = compactStatus(plan);

  await writeJson(OUTPUT_JSON_PATH, plan);
  await writeFile(OUTPUT_MD_PATH, renderMarkdown(plan));
  await writeJson(STATUS_PATH, status);
  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildPlan({ generatedAt, packet, worksheet, northStar, linePlaybook, ownerSampleGate }) {
  const issues = [];
  const worksheetRows = worksheet.rows ?? [];
  const thresholds = northStar.thresholds ?? {
    min_visits: 100,
    min_cta_clicks: 20,
    min_line_adds: 5,
    min_test_days: 3,
    preferred_test_days: 7,
  };
  const lineStageMap = new Map((linePlaybook.stages ?? []).map((stage) => [stage.event_type, stage]));
  const plans = (packet.packets ?? []).map((item) => {
    const sampleRows = SAMPLE_GATE_EVENTS.map((eventType) => {
      const row = worksheetRows.find((candidate) =>
        candidate.content_id === item.content_id
        && candidate.variant_id === item.variant_id
        && candidate.stage === eventType
      );
      if (!row) {
        issues.push(`missing sample-gate row for ${item.content_id}/${item.variant_id}/${eventType}`);
      }
      return row ? captureRowFromWorksheet(row, item) : missingCaptureRow(item, eventType);
    });
    const northStarRows = [
      trackingRedirectRow(item, "link_click"),
      ...sampleRows,
      lineManualRow(item, "lead_submit", lineStageMap.get("lead_submit")),
      lineManualRow(item, "deal", lineStageMap.get("deal")),
      lineManualRow(item, "quality_flag", lineStageMap.get("quality_flag")),
    ];

    return {
      packet_id: item.packet_id,
      content_id: item.content_id,
      variant_id: item.variant_id,
      cta_text: item.cta_text,
      publish_status: "waiting_for_owner_manual_publish",
      tracking_url: item.tracking?.tracking_url ?? null,
      sample_gate_required_events: SAMPLE_GATE_EVENTS,
      north_star_events: NORTH_STAR_EVENTS,
      quality_guard_events: QUALITY_EVENTS,
      sample_gate_rows: sampleRows,
      north_star_capture_rows: northStarRows,
      observation_checkpoints: [
        {
          checkpoint: "day_0",
          status: "owner_manual_publish_gate",
          owner_action: "If approved, manually publish exactly one packet and record the surface plus timestamp outside this runner.",
          automation_action: "No automatic post, schedule, public-link change, LINE push, or deploy.",
        },
        {
          checkpoint: "day_3",
          status: "minimum_test_day_check",
          owner_action: "Collect aggregate page_view, cta_click, and line_add counts for this packet only.",
          sample_gate_rule: `Minimum days before any decision: ${thresholds.min_test_days}`,
        },
        {
          checkpoint: "day_7",
          status: "preferred_test_window_check",
          owner_action: "Refresh aggregate counts, then run the local owner sample-gate and North Star checks.",
          sample_gate_rule: `Preferred test days: ${thresholds.preferred_test_days}`,
        },
      ],
      owner_safe_commands_after_counts: [
        "npm run owner:intake",
        "npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled",
        "npm run owner:sample-gate",
        "npm run north-star",
        "npm run weekly:local",
      ],
      blocked_actions: [
        "automatic_publish_or_schedule",
        "main_link_change",
        "champion_promotion",
        "line_push_or_broadcast",
        "customer_data_export_or_mutation",
        "payment_refund_or_capture",
        "production_deploy",
        "github_push_or_pr",
        "delete_data",
      ],
      ...RED_LINE_FLAGS,
    };
  });

  return {
    ok: issues.length === 0,
    generated_at: generatedAt.toISOString(),
    mode: "manual_publish_capture_plan_local_only",
    status: issues.length === 0 ? "waiting_for_owner_manual_publish_and_counts" : "attention_required",
    round_id: packet.round_id,
    changed_variable: packet.changed_variable,
    packet_count: plans.length,
    sample_gate_row_count: plans.reduce((total, item) => total + item.sample_gate_rows.length, 0),
    north_star_capture_row_count: plans.reduce((total, item) => total + item.north_star_capture_rows.length, 0),
    thresholds,
    owner_sample_gate_status: ownerSampleGate.status ?? "unknown",
    sample_threshold_met: Boolean(ownerSampleGate.sample_threshold_met),
    plan_policy: {
      local_plan_only: true,
      owner_manual_publish_required: true,
      aggregate_only: true,
      one_packet_at_a_time_recommended: true,
      sample_insufficient_keeps_champion: true,
      no_quality_regression_required_before_promotion: true,
    },
    plans,
    issues,
    outputs: {
      plan_json: "manual_publish_capture_plan.json",
      plan_md: "manual_publish_capture_plan.md",
      status_json: "data/manual_publish_capture_plan_status.json",
    },
    ...RED_LINE_FLAGS,
  };
}

function captureRowFromWorksheet(row, packet) {
  return {
    event_type: row.stage,
    source_group: row.source_group,
    source_surface: row.source_surface,
    source_metric: row.source_metric,
    target_live_file: row.target_live_file,
    worksheet_row_number: row.row_number,
    tracking_link_id: row.tracking_link_id,
    tracking_url: packet.tracking?.tracking_url ?? null,
    asset_id: row.asset_id,
    content_id: row.content_id,
    variant_id: row.variant_id,
    required_owner_fields: row.fill_fields,
    evidence_rule: row.evidence_rule,
    pii_rule: row.pii_rule,
    aggregate_only: true,
    customer_data_allowed: false,
    ...RED_LINE_FLAGS,
  };
}

function missingCaptureRow(packet, eventType) {
  return {
    event_type: eventType,
    source_group: "missing",
    tracking_url: packet.tracking?.tracking_url ?? null,
    content_id: packet.content_id,
    variant_id: packet.variant_id,
    aggregate_only: true,
    customer_data_allowed: false,
    issue: "missing_sample_gate_row",
    ...RED_LINE_FLAGS,
  };
}

function trackingRedirectRow(packet, eventType) {
  return {
    event_type: eventType,
    source_group: "Tracking redirect aggregate",
    source_surface: "candidate Worker D1 / tracking redirect aggregate",
    source_metric: "link_click aggregate count by content_id / variant_id",
    target_live_file: "data/funnel_aggregates.csv",
    worksheet_row_number: null,
    tracking_link_id: packet.tracking?.link_id ?? null,
    tracking_url: packet.tracking?.tracking_url ?? null,
    asset_id: "challenger-week0-cta-text-v1",
    content_id: packet.content_id,
    variant_id: packet.variant_id,
    required_owner_fields: ["date", "count", "evidence_ref", "reviewer", "pii_checked"],
    evidence_rule: "Only aggregate link_click counts; do not store session rows, IP, User-Agent, or visitor identifiers.",
    pii_rule: "Aggregate counts only. No visitor identifiers.",
    aggregate_only: true,
    customer_data_allowed: false,
    ...RED_LINE_FLAGS,
  };
}

function lineManualRow(packet, eventType, stage) {
  return {
    event_type: eventType,
    source_group: "LINE OA aggregate",
    source_surface: "LINE OA 管理後台 / inbound customer-service aggregate",
    source_metric: `${eventType} aggregate count by content_id / variant_id`,
    target_live_file: "data/manual_conversions.csv",
    worksheet_row_number: null,
    tracking_link_id: packet.tracking?.link_id ?? null,
    tracking_url: packet.tracking?.tracking_url ?? null,
    asset_id: "challenger-week0-cta-text-v1",
    content_id: packet.content_id,
    variant_id: packet.variant_id,
    required_owner_fields: eventType === "quality_flag"
      ? ["date", "count", "quality_score", "evidence_ref", "reviewer", "pii_checked"]
      : ["date", "count", "evidence_ref", "reviewer", "pii_checked"],
    evidence_rule: stage?.local_recording ?? `Only aggregate ${eventType} counts; never copy LINE chat text or customer fields.`,
    pii_rule: "Do not paste LINE user IDs, names, chat text, notes, phone, email, payment data, order IDs, or customer rows.",
    aggregate_only: true,
    customer_data_allowed: false,
    ...RED_LINE_FLAGS,
  };
}

function compactStatus(plan) {
  return {
    ok: plan.ok,
    generated_at: plan.generated_at,
    mode: plan.mode,
    status: plan.status,
    round_id: plan.round_id,
    changed_variable: plan.changed_variable,
    packet_count: plan.packet_count,
    sample_gate_row_count: plan.sample_gate_row_count,
    north_star_capture_row_count: plan.north_star_capture_row_count,
    owner_sample_gate_status: plan.owner_sample_gate_status,
    sample_threshold_met: plan.sample_threshold_met,
    issue_count: plan.issues.length,
    issues: plan.issues,
    outputs: plan.outputs,
    ...RED_LINE_FLAGS,
  };
}

function renderMarkdown(plan) {
  const packetSections = plan.plans.map((item) => {
    const sampleRows = item.sample_gate_rows.map((row) =>
      `| ${row.event_type} | ${row.source_group} | ${row.target_live_file ?? "n/a"} | ${row.worksheet_row_number ?? "n/a"} | ${row.pii_rule ?? "n/a"} |`
    ).join("\n");
    const northStarRows = item.north_star_capture_rows.map((row) =>
      `| ${row.event_type} | ${row.source_group} | ${row.target_live_file ?? "n/a"} | ${row.aggregate_only ? "yes" : "no"} | ${row.customer_data_allowed ? "yes" : "no"} |`
    ).join("\n");
    const checkpoints = item.observation_checkpoints.map((checkpoint) =>
      `| ${checkpoint.checkpoint} | ${checkpoint.status} | ${checkpoint.owner_action} |`
    ).join("\n");

    return `## ${item.packet_id}

Content: ${item.content_id}
Variant: ${item.variant_id}
CTA: ${item.cta_text}
Publish status: ${item.publish_status}
Tracking URL: \`${item.tracking_url ?? "missing"}\`

### Observation Checkpoints

| checkpoint | status | owner action |
|---|---|---|
${checkpoints}

### Sample Gate Required Rows

| event | source | target file | worksheet row | PII rule |
|---|---|---|---:|---|
${sampleRows}

### North Star / Quality Rows

| event | source | target file | aggregate only | customer data allowed |
|---|---|---|---|---|
${northStarRows}
`;
  }).join("\n");

  return `# Manual Publish Capture Plan

BLUF: This plan starts after the owner manually publishes one approved packet. It tells the owner what aggregate counts to collect at Day 3 and Day 7 so the local weekly loop can score the funnel. It does not publish, schedule, change links, push LINE, deploy, create GitHub activity, mutate customer data, process payments, delete data, or write data/lp_events.jsonl.

Generated: ${plan.generated_at}
Mode: ${plan.mode}
Status: ${plan.status}
Round: ${plan.round_id}
Changed variable: ${plan.changed_variable}
Packets: ${plan.packet_count}
Sample-gate rows: ${plan.sample_gate_row_count}
North Star capture rows: ${plan.north_star_capture_row_count}
Owner sample gate status: ${plan.owner_sample_gate_status}
Sample threshold met: ${plan.sample_threshold_met ? "yes" : "no"}

External effect: no
Formal post performed: no
LINE push performed: no
Public link change performed: no
Production deploy performed: no
GitHub push or PR performed: no
Customer data mutation performed: no
Payment action performed: no
Delete action performed: no
data/lp_events.jsonl write performed: no

## Thresholds

| threshold | value |
|---|---:|
| min_visits | ${plan.thresholds.min_visits} |
| min_cta_clicks | ${plan.thresholds.min_cta_clicks} |
| min_line_adds | ${plan.thresholds.min_line_adds} |
| min_test_days | ${plan.thresholds.min_test_days} |
| preferred_test_days | ${plan.thresholds.preferred_test_days} |

${packetSections}
`;
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main();
