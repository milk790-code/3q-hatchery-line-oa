import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const VARIANTS_PATH = path.join(ROOT, "content_variants.json");
const LINKS_PATH = path.join(ROOT, "tracking_links.json");
const LINE_PLAYBOOK_PATH = path.join(ROOT, "line_inbound_playbook.json");
const APPROVAL_QUEUE_PATH = path.join(ROOT, "approval_queue.json");
const OWNER_NEXT_ACTION_PATH = path.join(ROOT, "owner_next_action.json");
const AB_STATUS_PATH = path.join(ROOT, "ab_test_status.json");
const BLOCKED_PATH = path.join(ROOT, "prepared_but_blocked.json");
const PACKET_JSON_PATH = path.join(ROOT, "manual_publish_packet.json");
const PACKET_MD_PATH = path.join(ROOT, "manual_publish_packet.md");
const STATUS_PATH = path.join(ROOT, "data", "manual_publish_packet_status.json");

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

const BLOCKED_ACTIONS = [
  "formal_social_post",
  "schedule_social_post",
  "change_primary_social_or_bio_link",
  "promote_challenger_to_champion",
  "line_push_or_broadcast",
  "ecpay_payment_refund_or_capture",
  "customer_data_mutation",
  "production_worker_deploy",
  "github_push_or_pr_creation",
  "delete_data_or_retire_live_assets",
];

async function main() {
  const generatedAt = new Date();
  const [variants, links, linePlaybook, approvalQueue, ownerNextAction, abStatus, blocked] = await Promise.all([
    readJson(VARIANTS_PATH),
    readJson(LINKS_PATH),
    readJson(LINE_PLAYBOOK_PATH),
    readJson(APPROVAL_QUEUE_PATH),
    readJson(OWNER_NEXT_ACTION_PATH),
    readJson(AB_STATUS_PATH),
    readJson(BLOCKED_PATH),
  ]);

  const packet = buildPacket({
    generatedAt,
    variants,
    links,
    linePlaybook,
    approvalQueue,
    ownerNextAction,
    abStatus,
    blocked,
  });
  const status = buildStatus(packet, generatedAt);

  await writeJson(PACKET_JSON_PATH, packet);
  await writeFile(PACKET_MD_PATH, renderMarkdown(packet));
  await writeJson(STATUS_PATH, status);

  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildPacket({ generatedAt, variants, links, linePlaybook, approvalQueue, ownerNextAction, abStatus, blocked }) {
  const contentLinks = (links.links ?? []).filter((link) => link.role === "content_variant");
  const lineCtaLink = (links.links ?? []).find((link) => link.role === "line_cta");
  const challengerLink = (links.links ?? []).find((link) => link.role === "challenger");
  const issues = [];
  const lineStages = (linePlaybook.stages ?? []).map((stage) => ({
    stage: stage.stage,
    event_type: stage.event_type,
    operator_goal: stage.operator_goal,
    reply_template: stage.reply_template,
    local_recording: stage.local_recording,
  }));

  const packets = (variants.drafts ?? []).map((draft, index) => {
    const matchedLink = contentLinks.find((link) => link.content_id === draft.content_id && link.variant_id === draft.variant_id);
    if (!matchedLink) {
      issues.push(`missing content tracking link for ${draft.content_id}/${draft.variant_id}`);
    }
    if (matchedLink && matchedLink.tracking_url !== draft.tracking_url) {
      issues.push(`tracking URL mismatch for ${draft.content_id}/${draft.variant_id}`);
    }
    if (draft.final_gate !== "draft_only_human_publish_required") {
      issues.push(`draft final gate is not publish-gated for ${draft.content_id}/${draft.variant_id}`);
    }
    if (matchedLink && matchedLink.status !== "draft_only_human_publish_required") {
      issues.push(`tracking link is not draft-gated for ${draft.content_id}/${draft.variant_id}`);
    }

    return {
      packet_id: `manual-publish-${String(index + 1).padStart(2, "0")}-${draft.content_id}-${draft.variant_id}`,
      status: "draft_only_human_publish_required",
      content_id: draft.content_id,
      variant_id: draft.variant_id,
      surface: draft.surface,
      changed_variable: draft.changed_variable,
      locked_variables: draft.locked_variables ?? {},
      cta_text: draft.cta_text,
      draft_caption: draft.draft_caption,
      tracking: {
        link_id: matchedLink?.link_id ?? null,
        tracking_url: matchedLink?.tracking_url ?? draft.tracking_url ?? null,
        target: matchedLink?.target ?? "challenger",
        status: matchedLink?.status ?? "missing",
        external_effect: matchedLink?.external_effect ?? false,
      },
      landing_target: {
        candidate_page: "landing_page_candidate.html",
        candidate_worker: "worker.ts",
        challenger_tracking_link: challengerLink?.tracking_url ?? null,
        line_cta_tracking_link: lineCtaLink?.tracking_url ?? null,
        line_destination_source: "tracking_links.json",
        publish_gate: "owner_manual_review_required_before_any_public_use",
      },
      line_handoff_summary: {
        playbook_status: linePlaybook.status ?? "unknown",
        inbound_only: Boolean(linePlaybook.policy?.inbound_only),
        manual_reply_only: Boolean(linePlaybook.policy?.manual_reply_only),
        aggregate_or_pseudonymous_only: Boolean(linePlaybook.policy?.aggregate_or_pseudonymous_only),
        stages: lineStages,
      },
      sample_gate: {
        sample_threshold_met: Boolean(abStatus.sample_threshold_met),
        min_visits: 100,
        min_cta_clicks: 20,
        min_line_adds: 5,
        min_test_days: 3,
        preferred_test_days: 7,
        current_decision: abStatus.decision ?? "unknown",
      },
      owner_manual_steps: [
        "Review the caption and tracking URL in this packet.",
        "If approved, paste the caption and the local tracking URL manually into the chosen surface.",
        "Verify the platform preview manually before publishing or scheduling.",
        "After traffic arrives, record aggregate-only page_view, cta_click, and line_add counts in the sample-gate worksheet.",
        "Use line_inbound_playbook.md for inbound replies only; do not push or broadcast LINE messages.",
      ],
      blocked_actions: BLOCKED_ACTIONS,
      human_gate: "Owner must explicitly approve the exact copy, surface, timing, and link before any public post or schedule action.",
      ...RED_LINE_FLAGS,
    };
  });

  return {
    ok: issues.length === 0,
    generated_at: generatedAt.toISOString(),
    mode: "manual_publish_packet_local_review",
    status: issues.length === 0 ? "ready_local_review" : "attention_required",
    round_id: variants.round_id,
    changed_variable: variants.changed_variable,
    one_variable_rule_ok: Boolean(variants.one_variable_rule_ok),
    packet_count: packets.length,
    draft_count: (variants.drafts ?? []).length,
    tracking_link_count: contentLinks.length,
    sample_threshold_met: Boolean(abStatus.sample_threshold_met),
    challenger_win_rule_met: Boolean(abStatus.challenger_win_rule_met),
    no_quality_regression: Boolean(abStatus.no_quality_regression),
    owner_next_action: ownerNextAction.primary_action ?? null,
    pending_human_approval_count: (approvalQueue.items ?? []).filter((item) => item.status === "pending_human").length,
    prepared_but_blocked_count: (blocked.items ?? []).length,
    publish_policy: {
      draft_only: true,
      owner_manual_publish_required: true,
      no_formal_post: true,
      no_schedule_action: true,
      no_line_push: true,
      no_primary_link_change: true,
      no_champion_promotion: true,
      no_customer_data_storage: true,
      no_payment_action: true,
      no_production_deploy: true,
      no_github_push_or_pr: true,
      no_delete_action: true,
    },
    blocked_actions: BLOCKED_ACTIONS,
    issues,
    packets,
    outputs: {
      packet_json: "manual_publish_packet.json",
      packet_md: "manual_publish_packet.md",
      status_json: "data/manual_publish_packet_status.json",
    },
    ...RED_LINE_FLAGS,
  };
}

function buildStatus(packet, generatedAt) {
  return {
    ok: packet.ok,
    generated_at: generatedAt.toISOString(),
    mode: packet.mode,
    status: packet.status,
    round_id: packet.round_id,
    changed_variable: packet.changed_variable,
    packet_count: packet.packet_count,
    draft_count: packet.draft_count,
    tracking_link_count: packet.tracking_link_count,
    sample_threshold_met: packet.sample_threshold_met,
    challenger_win_rule_met: packet.challenger_win_rule_met,
    owner_manual_publish_required: true,
    blocked_action_count: packet.blocked_actions.length,
    issue_count: packet.issues.length,
    issues: packet.issues,
    outputs: packet.outputs,
    ...RED_LINE_FLAGS,
  };
}

function renderMarkdown(packet) {
  const rows = packet.packets.map((item) => {
    return `| ${item.content_id} | ${item.variant_id} | ${item.cta_text} | ${item.status} | ${item.tracking.tracking_url ?? "missing"} |`;
  }).join("\n");
  const copyBlocks = packet.packets.map((item) => {
    return `## ${item.packet_id}

Status: ${item.status}
Surface: ${item.surface}
Changed variable: ${item.changed_variable}
Human gate: ${item.human_gate}

### Draft Caption

${item.draft_caption}

### Tracking URL

\`${item.tracking.tracking_url ?? "missing"}\`

### LINE Handoff

- Inbound only: ${item.line_handoff_summary.inbound_only ? "yes" : "no"}
- Manual reply only: ${item.line_handoff_summary.manual_reply_only ? "yes" : "no"}
- Aggregate-only local recording: ${item.line_handoff_summary.aggregate_or_pseudonymous_only ? "yes" : "no"}
- Primary reply prompt: ${item.line_handoff_summary.stages[0]?.reply_template ?? "n/a"}

### Owner Manual Steps

${item.owner_manual_steps.map((step) => `1. ${step}`).join("\n")}

### Blocked Actions

${item.blocked_actions.map((action) => `- ${action}`).join("\n")}
`;
  }).join("\n");

  return `# Manual Publish Packet

BLUF: These are draft-only publish packets for owner review. They prepare copy, tracking URLs, candidate landing targets, and LINE inbound handoff notes, but they do not publish, schedule, deploy, push LINE, change links, mutate customer data, process payments, create GitHub activity, or delete data.

Generated: ${packet.generated_at}
Mode: ${packet.mode}
Status: ${packet.status}
Round: ${packet.round_id}
Changed variable: ${packet.changed_variable}
One-variable rule ok: ${packet.one_variable_rule_ok ? "yes" : "no"}
Sample threshold met: ${packet.sample_threshold_met ? "yes" : "no"}

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

## Packet Index

| Content | Variant | CTA | Status | Tracking URL |
| --- | --- | --- | --- | --- |
${rows}

${copyBlocks}
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
