import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const BRIEF_PATH = path.join(ROOT, "manual_publish_brief.json");
const PACKET_PATH = path.join(ROOT, "manual_publish_packet.json");
const TRACKING_LINKS_PATH = path.join(ROOT, "tracking_links.json");
const GATE_READINESS_PATH = path.join(ROOT, "data", "gate_readiness_status.json");
const POST_GATE_PATH = path.join(ROOT, "data", "post_gate_verification_status.json");
const OWNER_APPROVAL_EXAMPLE_PATH = path.join(ROOT, "owner_approval_input.example.json");
const WRANGLER_PATH = path.join(ROOT, "wrangler.jsonc");
const PACK_JSON_PATH = path.join(ROOT, "public_tracking_url_pack.json");
const PACK_MD_PATH = path.join(ROOT, "public_tracking_url_pack.md");
const STATUS_PATH = path.join(ROOT, "data", "public_tracking_url_pack_status.json");

const OWNER_WORKER_URL_PLACEHOLDER = "https://<OWNER_APPROVED_WORKER_URL>";

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
  const [brief, packet, trackingLinks, gateReadiness, postGate, ownerApprovalExample, wrangler] = await Promise.all([
    readJson(BRIEF_PATH),
    readJson(PACKET_PATH),
    readJson(TRACKING_LINKS_PATH),
    readJson(GATE_READINESS_PATH),
    readJson(POST_GATE_PATH),
    readJson(OWNER_APPROVAL_EXAMPLE_PATH),
    readJson(WRANGLER_PATH),
  ]);

  const pack = buildPack({
    generatedAt,
    brief,
    packet,
    trackingLinks,
    gateReadiness,
    postGate,
    ownerApprovalExample,
    wrangler,
  });
  const status = buildStatus(pack, generatedAt);

  await writeJson(PACK_JSON_PATH, pack);
  await writeFile(PACK_MD_PATH, renderMarkdown(pack));
  await writeJson(STATUS_PATH, status);

  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildPack({ generatedAt, brief, packet, trackingLinks, gateReadiness, postGate, ownerApprovalExample, wrangler }) {
  const issues = [];
  if (!brief.ok) issues.push("manual_publish_brief is not ok");
  if (!packet.ok) issues.push("manual_publish_packet is not ok");
  if (!Array.isArray(trackingLinks.links)) issues.push("tracking_links.json has no links array");

  const selectedLink = findSelectedTrackingLink(trackingLinks.links ?? [], brief);
  if (!selectedLink) {
    issues.push(`tracking_links.json is missing selected content/variant ${brief.selected_content_id}/${brief.selected_variant_id}`);
  }

  const workerGate = findGate(gateReadiness, "candidate_worker_production_deploy");
  const publicAbGate = findGate(gateReadiness, "public_ab_small_traffic_link");
  const remoteD1Gate = findGate(gateReadiness, "remote_d1_create_and_migrate");
  const workerPostGate = findGate(postGate, "candidate_worker_production_deploy");
  const publicAbPostGate = findGate(postGate, "public_ab_small_traffic_link");
  const workerUrlApproval = findApproval(ownerApprovalExample, "candidate_worker_production_deploy");
  const publicAbApproval = findApproval(ownerApprovalExample, "public_ab_small_traffic_link");

  const selectedPublicTrackingUrlPreview = replaceOrigin(brief.tracking_url, OWNER_WORKER_URL_PLACEHOLDER);
  const selectedPublicCandidateUrlPreview = buildCandidatePreviewUrl(brief, selectedLink, OWNER_WORKER_URL_PLACEHOLDER);
  const lineCtaLocalUrl = packet.packets?.[0]?.landing_target?.line_cta_tracking_link
    ?? (trackingLinks.links ?? []).find((link) => link.role === "line_cta")?.tracking_url
    ?? null;
  const lineCtaPublicTrackingUrlPreview = replaceOrigin(lineCtaLocalUrl, OWNER_WORKER_URL_PLACEHOLDER);
  const abRouterLocalUrl = (trackingLinks.links ?? []).find((link) => link.role === "ab_small_traffic")?.tracking_url ?? null;
  const abRouterPublicUrlPreview = replaceOrigin(abRouterLocalUrl, OWNER_WORKER_URL_PLACEHOLDER);
  const currentWorkerPublicBase = wrangler.vars?.PUBLIC_BASE_URL ?? null;
  const currentWorkerBasePublicReady = isPublicHttpUrl(currentWorkerPublicBase);
  const selectedCurrentUrlPublicReady = isPublicHttpUrl(brief.tracking_url);
  const publicTrackingReady = selectedCurrentUrlPublicReady
    && workerGate?.owner_approval_detected === true
    && workerPostGate?.post_gate_verification_ready === true;

  const status = publicTrackingReady
    ? "ready_owner_public_tracking_review"
    : "prepared_but_blocked_owner_public_url";

  return {
    ok: issues.length === 0,
    generated_at: generatedAt.toISOString(),
    mode: "public_tracking_url_pack_local_only",
    status,
    round_id: brief.round_id,
    changed_variable: brief.changed_variable,
    selected_packet_id: brief.selected_packet_id,
    selected_content_id: brief.selected_content_id,
    selected_variant_id: brief.selected_variant_id,
    selected_link_id: selectedLink?.link_id ?? null,
    selected_surface: brief.selected_surface,
    current_local_tracking_url: brief.tracking_url,
    current_tracking_url_public_ready: selectedCurrentUrlPublicReady,
    current_worker_public_base: currentWorkerPublicBase,
    current_worker_base_public_ready: currentWorkerBasePublicReady,
    owner_worker_url_placeholder: OWNER_WORKER_URL_PLACEHOLDER,
    selected_public_tracking_url_preview: selectedPublicTrackingUrlPreview,
    selected_public_candidate_url_preview: selectedPublicCandidateUrlPreview,
    line_cta_public_tracking_url_preview: lineCtaPublicTrackingUrlPreview,
    ab_router_public_url_preview: abRouterPublicUrlPreview,
    public_tracking_url_ready: publicTrackingReady,
    formal_publish_ready: publicTrackingReady && brief.formal_publish_ready === true,
    owner_decision_required: true,
    manual_publish_brief_status: brief.status,
    gate_order: [
      "remote_d1_create_and_migrate",
      "candidate_worker_production_deploy",
      "public_ab_small_traffic_link",
      "owner_day0_manual_publish_one_packet",
      "manual_publish_evidence_intake",
    ],
    required_owner_approval_fields: {
      candidate_worker_production_deploy: Object.keys(workerUrlApproval ?? {}).filter((key) => key !== "gate_id"),
      public_ab_small_traffic_link: Object.keys(publicAbApproval ?? {}).filter((key) => key !== "gate_id"),
    },
    gates: [
      summarizeGate(remoteD1Gate, "Remote D1 must exist before production Worker deploy can persist events."),
      summarizeGate(workerGate, "Production Worker URL must be owner-approved before any public tracking URL is usable."),
      summarizeGate(publicAbGate, "Public A/B or social surface link requires owner-approved champion URL, surface, and rollback URL."),
    ],
    post_gate_verification: [
      summarizePostGate(workerPostGate, "After owner deploys Worker, run read-only verification before public traffic."),
      summarizePostGate(publicAbPostGate, "After owner approves public route, verify link metadata before placing it in traffic."),
    ],
    owner_copy_fields: {
      approved_worker_url: OWNER_WORKER_URL_PLACEHOLDER,
      selected_public_tracking_url_preview: selectedPublicTrackingUrlPreview,
      selected_public_candidate_url_preview: selectedPublicCandidateUrlPreview,
      line_cta_public_tracking_url_preview: lineCtaPublicTrackingUrlPreview,
      ab_router_public_url_preview: abRouterPublicUrlPreview,
      selected_caption: brief.draft_caption,
    },
    next_safe_actions: [
      "Review this pack locally and confirm the selected public URL shape before any platform post.",
      "Owner executes remote D1 and Worker gates outside this runner, then records non-secret evidence in owner_gate_evidence.json.",
      "Run npm run owner:evidence && npm run post:verify && npm run gate:readiness after owner evidence exists.",
      "Only after post-gate verification passes, manually publish exactly one reviewed packet and record aggregate evidence.",
    ],
    blocked_actions: [
      "remote_d1_create_or_migration",
      "production_worker_deploy",
      "public_tracking_url_activation",
      "public_ab_or_bio_link_change",
      "formal_social_post_or_schedule",
      "line_push_or_broadcast",
      "github_push_or_pr_creation",
      "customer_data_mutation",
      "ecpay_payment_refund_or_capture",
      "delete_data_or_retire_live_assets",
    ],
    issues,
    outputs: {
      pack_json: "public_tracking_url_pack.json",
      pack_md: "public_tracking_url_pack.md",
      status_json: "data/public_tracking_url_pack_status.json",
    },
    ...RED_LINE_FLAGS,
  };
}

function buildStatus(pack, generatedAt) {
  return {
    ok: pack.ok,
    generated_at: generatedAt.toISOString(),
    mode: pack.mode,
    status: pack.status,
    round_id: pack.round_id,
    changed_variable: pack.changed_variable,
    selected_packet_id: pack.selected_packet_id,
    selected_content_id: pack.selected_content_id,
    selected_variant_id: pack.selected_variant_id,
    selected_link_id: pack.selected_link_id,
    current_tracking_url_public_ready: pack.current_tracking_url_public_ready,
    current_worker_base_public_ready: pack.current_worker_base_public_ready,
    public_tracking_url_ready: pack.public_tracking_url_ready,
    formal_publish_ready: pack.formal_publish_ready,
    owner_decision_required: pack.owner_decision_required,
    preview_count: [
      pack.selected_public_tracking_url_preview,
      pack.selected_public_candidate_url_preview,
      pack.line_cta_public_tracking_url_preview,
      pack.ab_router_public_url_preview,
    ].filter(Boolean).length,
    gate_count: pack.gates.length,
    post_gate_count: pack.post_gate_verification.length,
    blocked_action_count: pack.blocked_actions.length,
    issue_count: pack.issues.length,
    issues: pack.issues,
    outputs: pack.outputs,
    ...RED_LINE_FLAGS,
  };
}

function renderMarkdown(pack) {
  return `# Public Tracking URL Pack

BLUF: ${pack.public_tracking_url_ready ? "A public tracking URL is ready for owner review." : "The selected post is still local-only; this pack shows the exact public URL shape but blocks activation until owner-run D1, Worker, and route gates are verified."}

Generated: ${pack.generated_at}
Mode: ${pack.mode}
Status: ${pack.status}
Round: ${pack.round_id}
Changed variable: ${pack.changed_variable}
Selected packet: ${pack.selected_packet_id ?? "n/a"}
Selected link: ${pack.selected_link_id ?? "n/a"}

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

## Current Gate

- Current local tracking URL: ${pack.current_local_tracking_url ?? "n/a"}
- Current tracking URL public-ready: ${pack.current_tracking_url_public_ready ? "yes" : "no"}
- Current Worker base: ${pack.current_worker_public_base ?? "n/a"}
- Current Worker base public-ready: ${pack.current_worker_base_public_ready ? "yes" : "no"}
- Public tracking URL ready: ${pack.public_tracking_url_ready ? "yes" : "no"}
- Formal publish ready: ${pack.formal_publish_ready ? "yes" : "no"}

## Public URL Preview

Use these only after the owner has executed and verified the required gates.

- Owner Worker URL placeholder: ${pack.owner_worker_url_placeholder}
- Selected public tracking URL preview: ${pack.selected_public_tracking_url_preview ?? "n/a"}
- Selected candidate page preview: ${pack.selected_public_candidate_url_preview ?? "n/a"}
- LINE CTA tracking URL preview: ${pack.line_cta_public_tracking_url_preview ?? "n/a"}
- A/B router preview: ${pack.ab_router_public_url_preview ?? "n/a"}

## Gate Order

${pack.gate_order.map((gate, index) => `${index + 1}. ${gate}`).join("\n")}

## Gate Status

${pack.gates.map((gate) => `- ${gate.gate_id}: owner_approval=${gate.owner_approval_detected ? "yes" : "no"} / ready_for_owner_execution=${gate.ready_for_owner_execution ? "yes" : "no"} / blocker=${gate.primary_blocker ?? "none"}`).join("\n")}

## Post-Gate Verification

${pack.post_gate_verification.map((gate) => `- ${gate.gate_id}: ready=${gate.post_gate_verification_ready ? "yes" : "no"} / blocker=${gate.primary_blocker ?? "none"}`).join("\n")}

## Owner Copy Fields

- approved_worker_url: ${pack.owner_copy_fields.approved_worker_url}
- selected_public_tracking_url_preview: ${pack.owner_copy_fields.selected_public_tracking_url_preview ?? "n/a"}
- selected_public_candidate_url_preview: ${pack.owner_copy_fields.selected_public_candidate_url_preview ?? "n/a"}
- line_cta_public_tracking_url_preview: ${pack.owner_copy_fields.line_cta_public_tracking_url_preview ?? "n/a"}
- ab_router_public_url_preview: ${pack.owner_copy_fields.ab_router_public_url_preview ?? "n/a"}

## Selected Caption

${pack.owner_copy_fields.selected_caption ?? "n/a"}

## Next Safe Actions

${pack.next_safe_actions.map((action) => `1. ${action}`).join("\n")}

## Blocked Actions

${pack.blocked_actions.map((action) => `- ${action}`).join("\n")}
`;
}

function findSelectedTrackingLink(links, brief) {
  return links.find((link) =>
    link.content_id === brief.selected_content_id
    && link.variant_id === brief.selected_variant_id
  ) ?? links.find((link) => link.tracking_url === brief.tracking_url) ?? null;
}

function findGate(source, gateId) {
  return (source.gates ?? []).find((gate) => gate.gate_id === gateId) ?? null;
}

function findApproval(source, gateId) {
  return (source.approvals ?? []).find((approval) => approval.gate_id === gateId) ?? null;
}

function summarizeGate(gate, fallback) {
  return {
    gate_id: gate?.gate_id ?? "missing_gate",
    approval_id: gate?.approval_id ?? null,
    risk_tier: gate?.risk_tier ?? null,
    current_status: gate?.current_status ?? "missing",
    owner_approval_detected: Boolean(gate?.owner_approval_detected),
    ready_for_owner_execution: Boolean(gate?.ready_for_owner_execution),
    ready_for_autorun: false,
    no_autorun: true,
    primary_blocker: gate?.blocked_reasons?.[0] ?? fallback,
    resume_command_preview: gate?.resume_command_preview ?? [],
    external_effect_if_owner_executes: Boolean(gate?.external_effect),
  };
}

function summarizePostGate(gate, fallback) {
  return {
    gate_id: gate?.gate_id ?? "missing_gate",
    approval_id: gate?.approval_id ?? null,
    risk_tier: gate?.risk_tier ?? null,
    owner_evidence_detected: Boolean(gate?.owner_evidence_detected),
    owner_evidence_valid: Boolean(gate?.owner_evidence_valid),
    post_gate_verification_ready: Boolean(gate?.post_gate_verification_ready),
    safe_to_run_automatically: false,
    primary_blocker: gate?.blocked_reasons?.[0] ?? fallback,
    external_effect: false,
    execution_performed: false,
  };
}

function buildCandidatePreviewUrl(brief, selectedLink, origin) {
  if (!brief.tracking_url && !selectedLink) return null;
  try {
    const tracking = new URL(brief.tracking_url ?? selectedLink.tracking_url);
    const params = new URLSearchParams();
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "content_id", "variant_id"]) {
      const value = tracking.searchParams.get(key);
      if (value) params.set(key, value);
    }
    if (selectedLink?.asset_id) params.set("asset_id", selectedLink.asset_id);
    return `${origin}/candidate?${params.toString()}`;
  } catch {
    return null;
  }
}

function replaceOrigin(value, origin) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${origin}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
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
      && !/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
      && !host.includes("<")
      && !host.includes(">");
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
