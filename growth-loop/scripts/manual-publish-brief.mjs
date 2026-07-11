import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const PACKET_PATH = path.join(ROOT, "manual_publish_packet.json");
const CAPTURE_PLAN_PATH = path.join(ROOT, "manual_publish_capture_plan.json");
const EVIDENCE_STATUS_PATH = path.join(ROOT, "data", "manual_publish_evidence_status.json");
const LINE_PLAYBOOK_PATH = path.join(ROOT, "line_inbound_playbook.json");
const BRIEF_JSON_PATH = path.join(ROOT, "manual_publish_brief.json");
const BRIEF_MD_PATH = path.join(ROOT, "manual_publish_brief.md");
const STATUS_PATH = path.join(ROOT, "data", "manual_publish_brief_status.json");

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
  const [packet, capturePlan, evidenceStatus, linePlaybook] = await Promise.all([
    readJson(PACKET_PATH),
    readJson(CAPTURE_PLAN_PATH),
    readJson(EVIDENCE_STATUS_PATH),
    readJson(LINE_PLAYBOOK_PATH),
  ]);

  const brief = buildBrief({ generatedAt, packet, capturePlan, evidenceStatus, linePlaybook });
  const status = buildStatus(brief, generatedAt);

  await writeJson(BRIEF_JSON_PATH, brief);
  await writeFile(BRIEF_MD_PATH, renderMarkdown(brief));
  await writeJson(STATUS_PATH, status);

  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildBrief({ generatedAt, packet, capturePlan, evidenceStatus, linePlaybook }) {
  const issues = [];
  const packets = packet.packets ?? [];
  if (!packet.ok) issues.push("manual_publish_packet is not ok");
  if (!capturePlan.ok) issues.push("manual_publish_capture_plan is not ok");
  if (packets.length === 0) issues.push("manual_publish_packet has no packets");

  const selectedPacket = packets[0] ?? {};
  const selectedCapture = (capturePlan.plans ?? []).find((plan) => plan.packet_id === selectedPacket.packet_id) ?? null;
  if (selectedPacket.packet_id && !selectedCapture) {
    issues.push(`manual_publish_capture_plan missing selected packet ${selectedPacket.packet_id}`);
  }

  const trackingUrl = selectedPacket.tracking?.tracking_url ?? "";
  const publicTrackingUrlReady = isPublicHttpUrl(trackingUrl);
  const lineStage = (linePlaybook.stages ?? []).find((stage) => stage.stage === "line_add") ?? linePlaybook.stages?.[0] ?? {};
  const leadStage = (linePlaybook.stages ?? []).find((stage) => stage.stage === "lead_submit") ?? {};
  const evidenceWaiting = evidenceStatus.status === "waiting_for_owner_manual_publish_evidence";

  const status = publicTrackingUrlReady
    ? "ready_owner_day0_manual_publish_review"
    : "prepared_but_blocked_public_tracking_url";

  return {
    ok: issues.length === 0,
    generated_at: generatedAt.toISOString(),
    mode: "manual_publish_brief_local_only",
    status,
    round_id: packet.round_id,
    changed_variable: packet.changed_variable,
    one_variable_rule_ok: Boolean(packet.one_variable_rule_ok),
    selection_rule: "first_packet_lowest_packet_id_current_round",
    selected_packet_id: selectedPacket.packet_id ?? null,
    selected_content_id: selectedPacket.content_id ?? null,
    selected_variant_id: selectedPacket.variant_id ?? null,
    selected_cta_text: selectedPacket.cta_text ?? null,
    selected_surface: selectedPacket.surface ?? null,
    draft_caption: selectedPacket.draft_caption ?? null,
    tracking_url: trackingUrl || null,
    tracking_url_public_ready: publicTrackingUrlReady,
    public_tracking_url_required_before_formal_publish: !publicTrackingUrlReady,
    public_tracking_url_gate_reason: publicTrackingUrlReady
      ? "tracking URL is public HTTP(S)"
      : "selected tracking URL is local-only or missing; do not place it in public traffic",
    candidate_page: selectedPacket.landing_target?.candidate_page ?? "landing_page_candidate.html",
    candidate_worker: selectedPacket.landing_target?.candidate_worker ?? "worker.ts",
    line_inbound_reply_template: lineStage.reply_template ?? null,
    lead_qualification_reply_template: leadStage.reply_template ?? null,
    line_inbound_only: Boolean(linePlaybook.policy?.inbound_only),
    line_manual_reply_only: Boolean(linePlaybook.policy?.manual_reply_only),
    aggregate_or_pseudonymous_only: Boolean(linePlaybook.policy?.aggregate_or_pseudonymous_only),
    sample_threshold_met: Boolean(packet.sample_threshold_met),
    challenger_win_rule_met: Boolean(packet.challenger_win_rule_met),
    no_quality_regression: Boolean(packet.no_quality_regression),
    packet_count: packet.packet_count ?? packets.length,
    sample_gate_row_count: selectedCapture?.sample_gate_rows?.length ?? 0,
    north_star_capture_row_count: selectedCapture?.north_star_capture_rows?.length ?? 0,
    observation_checkpoints: selectedCapture?.observation_checkpoints ?? [],
    sample_gate_required_events: selectedCapture?.sample_gate_required_events ?? ["page_view", "cta_click", "line_add"],
    north_star_events: selectedCapture?.north_star_events ?? ["link_click", "line_add", "lead_submit", "deal"],
    owner_manual_publish_required: true,
    owner_exact_copy_surface_time_required: true,
    formal_publish_ready: publicTrackingUrlReady,
    evidence_status: evidenceStatus.status ?? "unknown",
    evidence_waiting_for_owner: evidenceWaiting,
    evidence_artifacts: {
      form: "manual_publish_evidence_form.html",
      intake_report: "manual_publish_evidence.md",
      example_json: "manual_publish_evidence.example.json",
      status_json: "data/manual_publish_evidence_status.json",
    },
    next_safe_actions: publicTrackingUrlReady
      ? [
          "Owner reviews the exact selected caption, surface, timing, and public tracking URL.",
          "Owner manually publishes or schedules exactly one reviewed packet outside this automation.",
          "After publishing, fill manual_publish_evidence_form.html with non-sensitive evidence only.",
        ]
      : [
          "Review the selected caption and LINE handoff locally only.",
          "Approve or prepare the public tracking URL / candidate Worker gate before any formal post.",
          "After the owner manually publishes exactly one reviewed packet, fill manual_publish_evidence_form.html with non-sensitive evidence only.",
        ],
    blocked_actions: [
      "formal_social_post",
      "schedule_social_post",
      "change_primary_social_or_bio_link",
      "promote_challenger_to_champion",
      "line_push_or_broadcast",
      "production_worker_deploy",
      "github_push_or_pr_creation",
      "customer_data_mutation",
      "ecpay_payment_refund_or_capture",
      "delete_data_or_retire_live_assets",
    ],
    issues,
    outputs: {
      brief_json: "manual_publish_brief.json",
      brief_md: "manual_publish_brief.md",
      status_json: "data/manual_publish_brief_status.json",
    },
    ...RED_LINE_FLAGS,
  };
}

function buildStatus(brief, generatedAt) {
  return {
    ok: brief.ok,
    generated_at: generatedAt.toISOString(),
    mode: brief.mode,
    status: brief.status,
    round_id: brief.round_id,
    changed_variable: brief.changed_variable,
    selected_packet_id: brief.selected_packet_id,
    selected_content_id: brief.selected_content_id,
    selected_variant_id: brief.selected_variant_id,
    packet_count: brief.packet_count,
    sample_gate_row_count: brief.sample_gate_row_count,
    north_star_capture_row_count: brief.north_star_capture_row_count,
    tracking_url_public_ready: brief.tracking_url_public_ready,
    public_tracking_url_required_before_formal_publish: brief.public_tracking_url_required_before_formal_publish,
    formal_publish_ready: brief.formal_publish_ready,
    owner_manual_publish_required: brief.owner_manual_publish_required,
    evidence_status: brief.evidence_status,
    evidence_waiting_for_owner: brief.evidence_waiting_for_owner,
    issue_count: brief.issues.length,
    issues: brief.issues,
    outputs: brief.outputs,
    ...RED_LINE_FLAGS,
  };
}

function renderMarkdown(brief) {
  return `# Manual Publish Brief

BLUF: ${brief.tracking_url_public_ready ? "This selected packet is ready for owner Day 0 manual publish review." : "This selected packet is copy-ready for local review, but public posting is blocked until the tracking URL / Worker gate is owner-approved."}

Generated: ${brief.generated_at}
Mode: ${brief.mode}
Status: ${brief.status}
Round: ${brief.round_id}
Changed variable: ${brief.changed_variable}
Selected packet: ${brief.selected_packet_id ?? "n/a"}
Selected content: ${brief.selected_content_id ?? "n/a"} / ${brief.selected_variant_id ?? "n/a"}

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

## Public Link Gate

- Tracking URL public-ready: ${brief.tracking_url_public_ready ? "yes" : "no"}
- Formal publish ready: ${brief.formal_publish_ready ? "yes" : "no"}
- Gate reason: ${brief.public_tracking_url_gate_reason}

## Selected Caption

${brief.draft_caption ?? "n/a"}

## Tracking URL

\`${brief.tracking_url ?? "missing"}\`

## LINE Inbound Handoff

- Inbound only: ${brief.line_inbound_only ? "yes" : "no"}
- Manual reply only: ${brief.line_manual_reply_only ? "yes" : "no"}
- Aggregate-only local recording: ${brief.aggregate_or_pseudonymous_only ? "yes" : "no"}
- First reply: ${brief.line_inbound_reply_template ?? "n/a"}
- Qualification reply: ${brief.lead_qualification_reply_template ?? "n/a"}

## Capture After Owner Publish

- Sample-gate rows: ${brief.sample_gate_row_count}
- North Star / quality rows: ${brief.north_star_capture_row_count}
- Required sample events: ${brief.sample_gate_required_events.join(", ")}
- North Star events: ${brief.north_star_events.join(", ")}
- Evidence form: ${brief.evidence_artifacts.form}
- Evidence intake: ${brief.evidence_artifacts.intake_report}

## Next Safe Actions

${brief.next_safe_actions.map((action) => `1. ${action}`).join("\n")}

## Blocked Actions

${brief.blocked_actions.map((action) => `- ${action}`).join("\n")}
`;
}

function isPublicHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return ["http:", "https:"].includes(url.protocol)
      && host !== "localhost"
      && host !== "127.0.0.1"
      && host !== "::1"
      && !host.startsWith("192.168.")
      && !host.startsWith("10.")
      && !/^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
  } catch {
    return false;
  }
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
