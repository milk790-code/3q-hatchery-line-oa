import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const PACK_PATH = path.join(ROOT, "public_tracking_url_pack.json");
const OWNER_APPROVAL_EXAMPLE_PATH = path.join(ROOT, "owner_approval_input.example.json");
const OWNER_APPROVAL_INPUT_PATH = path.join(ROOT, "owner_approval_input.json");
const GATE_READINESS_PATH = path.join(ROOT, "data", "gate_readiness_status.json");
const POST_GATE_PATH = path.join(ROOT, "data", "post_gate_verification_status.json");
const MANUAL_BRIEF_PATH = path.join(ROOT, "manual_publish_brief.json");
const OUTPUT_JSON_PATH = path.join(ROOT, "owner_public_url_approval_preview.json");
const OUTPUT_MD_PATH = path.join(ROOT, "owner_public_url_approval_preview.md");
const STATUS_PATH = path.join(ROOT, "data", "owner_public_url_approval_preview_status.json");

const REQUIRED_GATE_IDS = [
  "remote_d1_create_and_migrate",
  "candidate_worker_production_deploy",
  "public_ab_small_traffic_link",
];

const REQUIRED_FIELDS = {
  remote_d1_create_and_migrate: [
    "approved_by",
    "approved_at",
    "cloudflare_account_alias",
    "d1_database_name",
    "d1_database_id",
  ],
  candidate_worker_production_deploy: [
    "approved_by",
    "approved_at",
    "worker_name",
    "worker_url",
    "rollback_plan",
  ],
  public_ab_small_traffic_link: [
    "approved_by",
    "approved_at",
    "champion_url",
    "public_surface",
    "rollback_url",
  ],
};

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
  const [pack, ownerApprovalExample, gateReadiness, postGate, manualBrief] = await Promise.all([
    readJson(PACK_PATH),
    readJson(OWNER_APPROVAL_EXAMPLE_PATH),
    readJson(GATE_READINESS_PATH),
    readJson(POST_GATE_PATH),
    readJson(MANUAL_BRIEF_PATH),
  ]);
  const liveInputExists = await exists(OWNER_APPROVAL_INPUT_PATH);

  const preview = buildPreview({
    generatedAt,
    pack,
    ownerApprovalExample,
    gateReadiness,
    postGate,
    manualBrief,
    liveInputExists,
  });
  const status = buildStatus(preview, generatedAt);

  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeJson(OUTPUT_JSON_PATH, preview);
  await writeFile(OUTPUT_MD_PATH, renderMarkdown(preview));
  await writeJson(STATUS_PATH, status);

  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildPreview({ generatedAt, pack, ownerApprovalExample, gateReadiness, postGate, manualBrief, liveInputExists }) {
  const issues = [];
  if (!pack.ok) issues.push("public_tracking_url_pack is not ok");
  if (!Array.isArray(ownerApprovalExample.approvals)) issues.push("owner_approval_input.example.json has no approvals array");
  if (!Array.isArray(gateReadiness.gates)) issues.push("gate_readiness_status has no gates array");
  if (!Array.isArray(postGate.gates)) issues.push("post_gate_verification_status has no gates array");

  const focusedOwnerFields = Object.fromEntries(
    REQUIRED_GATE_IDS.map((gateId) => [gateId, REQUIRED_FIELDS[gateId]]),
  );
  const requiredFieldCount = Object.values(focusedOwnerFields).reduce((sum, fields) => sum + fields.length, 0);
  const gateSummaries = REQUIRED_GATE_IDS.map((gateId) => summarizeGate(gateId, gateReadiness, postGate));
  const exampleApprovals = REQUIRED_GATE_IDS.map((gateId) => {
    const exampleApproval = findApproval(ownerApprovalExample, gateId) ?? { gate_id: gateId };
    return pickApprovalFields(exampleApproval, gateId);
  });

  const ownerApprovalInputPatchPreview = {
    preview_only: true,
    write_target: "owner_approval_input.json",
    source_template: "owner_approval_input.example.json",
    warning: "Do not paste placeholders as approval. Owner must fill real non-secret metadata only after approving each external gate.",
    purpose: ownerApprovalExample.purpose ?? "Owner approval metadata for external gates. Keep secrets out.",
    approvals: exampleApprovals,
    context_only_not_part_of_owner_approval_input: {
      selected_packet_id: pack.selected_packet_id ?? manualBrief.selected_packet_id ?? null,
      selected_content_id: pack.selected_content_id ?? manualBrief.selected_content_id ?? null,
      selected_variant_id: pack.selected_variant_id ?? manualBrief.selected_variant_id ?? null,
      selected_public_tracking_url_preview: pack.selected_public_tracking_url_preview ?? null,
      selected_public_candidate_url_preview: pack.selected_public_candidate_url_preview ?? null,
      line_cta_public_tracking_url_preview: pack.line_cta_public_tracking_url_preview ?? null,
      ab_router_public_url_preview: pack.ab_router_public_url_preview ?? null,
    },
  };

  return {
    ok: issues.length === 0,
    generated_at: generatedAt.toISOString(),
    mode: "owner_public_url_approval_preview_local_only",
    status: "prepared_but_blocked_owner_approval_input",
    selected_packet_id: pack.selected_packet_id ?? manualBrief.selected_packet_id ?? null,
    selected_content_id: pack.selected_content_id ?? manualBrief.selected_content_id ?? null,
    selected_variant_id: pack.selected_variant_id ?? manualBrief.selected_variant_id ?? null,
    round_id: pack.round_id ?? manualBrief.round_id ?? null,
    changed_variable: pack.changed_variable ?? manualBrief.changed_variable ?? null,
    owner_decision_required: true,
    public_tracking_url_ready: Boolean(pack.public_tracking_url_ready),
    formal_publish_ready: false,
    live_input_file_path: "owner_approval_input.json",
    live_input_file_exists: liveInputExists,
    live_input_files_created: false,
    owner_approval_input_write_performed: false,
    required_gate_ids: REQUIRED_GATE_IDS,
    required_gate_count: REQUIRED_GATE_IDS.length,
    focused_owner_fields: focusedOwnerFields,
    required_field_count: requiredFieldCount,
    gate_summaries: gateSummaries,
    post_gate_status: postGate.status ?? "unknown",
    gate_readiness_status: gateReadiness.status ?? "unknown",
    selected_public_tracking_url_preview: pack.selected_public_tracking_url_preview ?? null,
    selected_public_candidate_url_preview: pack.selected_public_candidate_url_preview ?? null,
    line_cta_public_tracking_url_preview: pack.line_cta_public_tracking_url_preview ?? null,
    ab_router_public_url_preview: pack.ab_router_public_url_preview ?? null,
    owner_approval_input_patch_preview: ownerApprovalInputPatchPreview,
    commands_after_owner_fills_preview: [
      "npm run approval:plan",
      "npm run gate:readiness",
      "npm run owner:evidence",
      "npm run post:verify",
      "npm run public:tracking-pack",
      "npm run owner:public-url-approval-preview",
    ],
    owner_execution_order: [
      "Fill owner_approval_input.json with non-secret metadata for the approved gate only.",
      "Owner runs the external D1 and Worker actions outside this local runner when ready.",
      "Owner records non-secret evidence in owner_gate_evidence.json.",
      "Run the local read-only verification commands listed above.",
      "Only after post-gate verification passes, owner may manually publish exactly one reviewed packet.",
    ],
    blocked_actions: [
      "create_live_owner_approval_input",
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
      preview_json: "owner_public_url_approval_preview.json",
      preview_md: "owner_public_url_approval_preview.md",
      status_json: "data/owner_public_url_approval_preview_status.json",
    },
    ...RED_LINE_FLAGS,
  };
}

function buildStatus(preview, generatedAt) {
  return {
    ok: preview.ok,
    generated_at: generatedAt.toISOString(),
    mode: preview.mode,
    status: preview.status,
    round_id: preview.round_id,
    changed_variable: preview.changed_variable,
    selected_packet_id: preview.selected_packet_id,
    selected_content_id: preview.selected_content_id,
    selected_variant_id: preview.selected_variant_id,
    owner_decision_required: preview.owner_decision_required,
    public_tracking_url_ready: preview.public_tracking_url_ready,
    formal_publish_ready: preview.formal_publish_ready,
    live_input_file_exists: preview.live_input_file_exists,
    live_input_files_created: preview.live_input_files_created,
    owner_approval_input_write_performed: preview.owner_approval_input_write_performed,
    required_gate_count: preview.required_gate_count,
    required_field_count: preview.required_field_count,
    gate_count: preview.gate_summaries.length,
    command_count: preview.commands_after_owner_fills_preview.length,
    blocked_action_count: preview.blocked_actions.length,
    issue_count: preview.issues.length,
    issues: preview.issues,
    outputs: preview.outputs,
    ...RED_LINE_FLAGS,
  };
}

function summarizeGate(gateId, gateReadiness, postGate) {
  const readiness = findGate(gateReadiness, gateId);
  const verification = findGate(postGate, gateId);
  return {
    gate_id: gateId,
    required_fields: REQUIRED_FIELDS[gateId],
    readiness_status: readiness?.current_status ?? readiness?.status ?? "missing",
    owner_approval_detected: Boolean(readiness?.owner_approval_detected),
    ready_for_owner_execution: Boolean(readiness?.ready_for_owner_execution),
    post_gate_verification_ready: Boolean(verification?.post_gate_verification_ready),
    blocked_reasons: [
      ...(readiness?.blocked_reasons ?? []),
      ...(verification?.blocked_reasons ?? []),
    ],
    execution_policy: readiness?.execution_policy ?? verification?.execution_policy ?? "plan_only_owner_executes",
    external_effect: false,
    execution_performed: false,
  };
}

function pickApprovalFields(exampleApproval, gateId) {
  const row = { gate_id: gateId };
  for (const field of REQUIRED_FIELDS[gateId]) {
    row[field] = exampleApproval[field] ?? placeholderFor(field);
  }
  return row;
}

function placeholderFor(field) {
  if (field === "approved_at") return "YYYY-MM-DDTHH:mm:ss.sssZ";
  if (field === "approved_by") return "OWNER_NAME";
  if (field.endsWith("_url")) return "https://OWNER_APPROVED_URL";
  if (field.endsWith("_id")) return "REPLACE_WITH_OWNER_APPROVED_ID";
  if (field.endsWith("_name")) return "OWNER_APPROVED_NAME";
  return "OWNER_APPROVED_VALUE";
}

function findApproval(input, gateId) {
  return (input.approvals ?? []).find((approval) => approval.gate_id === gateId) ?? null;
}

function findGate(input, gateId) {
  return (input.gates ?? []).find((gate) => gate.gate_id === gateId || gate.id === gateId) ?? null;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function renderMarkdown(preview) {
  return `# Owner Public URL Approval Preview

BLUF: The public tracking URL shape is prepared, but owner approval is still blocked until non-secret D1, Worker, and public A/B metadata are filled and verified. This file is a preview only; it did not create owner_approval_input.json.

Generated: ${preview.generated_at}
Mode: ${preview.mode}
Status: ${preview.status}
Round: ${preview.round_id ?? "n/a"}
Changed variable: ${preview.changed_variable ?? "n/a"}
Selected packet: ${preview.selected_packet_id ?? "n/a"}

External effect: no
owner_approval_input.json write performed: no
Live input files created: no
Formal post performed: no
LINE push performed: no
Public link change performed: no
Production deploy performed: no
GitHub push or PR performed: no
Customer data mutation performed: no
Payment action performed: no
Delete action performed: no
data/lp_events.jsonl write performed: no

## Required Owner Fields

${preview.required_gate_ids.map((gateId) => `### ${gateId}

${preview.focused_owner_fields[gateId].map((field) => `- ${field}`).join("\n")}`).join("\n\n")}

## Public URL Context

- Selected public tracking URL preview: ${preview.selected_public_tracking_url_preview ?? "n/a"}
- Selected candidate URL preview: ${preview.selected_public_candidate_url_preview ?? "n/a"}
- LINE CTA public tracking URL preview: ${preview.line_cta_public_tracking_url_preview ?? "n/a"}
- A/B router public URL preview: ${preview.ab_router_public_url_preview ?? "n/a"}

## Gate Status

| Gate | Owner approval | Owner execution ready | Post-gate verification | Blocked reasons |
|---|---:|---:|---:|---|
${preview.gate_summaries.map((gate) => `| ${gate.gate_id} | ${gate.owner_approval_detected ? "yes" : "no"} | ${gate.ready_for_owner_execution ? "yes" : "no"} | ${gate.post_gate_verification_ready ? "yes" : "no"} | ${(gate.blocked_reasons ?? []).join("; ") || "n/a"} |`).join("\n")}

## Patch Preview

Use this as a checklist, not as proof of approval. Fill real non-secret metadata in owner_approval_input.json only after owner approval.

\`\`\`json
${JSON.stringify(preview.owner_approval_input_patch_preview, null, 2)}
\`\`\`

## Local Commands After Owner Fills Evidence

${preview.commands_after_owner_fills_preview.map((command) => `- \`${command}\``).join("\n")}

## Blocked Actions

${preview.blocked_actions.map((action) => `- ${action}`).join("\n")}
`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
