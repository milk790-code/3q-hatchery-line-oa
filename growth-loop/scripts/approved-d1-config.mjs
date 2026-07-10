import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "wrangler.jsonc");
const INPUT_PATH = path.join(ROOT, "owner_approval_input.json");
const READINESS_PATH = path.join(ROOT, "data", "cloudflare_d1_readiness_status.json");
const STATUS_PATH = path.join(ROOT, "data", "approved_d1_config_status.json");
const REPORT_PATH = path.join(ROOT, "approved_d1_config.md");
const DATABASE_NAME = "3q-growth-loop-candidate";
const PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";
const APPLY = process.argv.includes("--apply");

async function main() {
  const generatedAt = new Date();
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const readiness = JSON.parse(await readFile(READINESS_PATH, "utf8"));
  const input = await readOptionalJson(INPUT_PATH);
  const approval = input?.approvals?.find((item) => item.gate_id === "remote_d1_create_and_migrate") ?? null;
  const binding = config.d1_databases?.find((item) => item.binding === "DB") ?? null;
  const approvedId = approval?.d1_database_id ?? null;
  const exactMatches = readiness.inventory?.exact_matches ?? [];
  const inventoryMatch = exactMatches.find((item) => item.uuid === approvedId && item.name === DATABASE_NAME) ?? null;
  const issues = validate({ approval, binding, approvedId, inventoryMatch });
  const alreadyConfigured = binding?.database_id === approvedId && Boolean(approvedId);
  const readyToApply = issues.length === 0;
  let writePerformed = false;

  if (APPLY && readyToApply && !alreadyConfigured) {
    binding.database_id = approvedId;
    await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
    writePerformed = true;
  }

  const status = {
    ok: !APPLY || readyToApply,
    generated_at: generatedAt.toISOString(),
    mode: APPLY ? "approved_d1_config_apply_local_only" : "approved_d1_config_preview_local_only",
    status: determineStatus({ apply: APPLY, readyToApply, alreadyConfigured, writePerformed }),
    config_path: "wrangler.jsonc",
    input_path: "owner_approval_input.json",
    input_exists: Boolean(input),
    approval_detected: Boolean(approval),
    expected_database_name: DATABASE_NAME,
    approved_database_id: approvedId,
    inventory_exact_match: Boolean(inventoryMatch),
    current_database_id: binding?.database_id ?? null,
    current_id_is_placeholder: binding?.database_id === PLACEHOLDER_ID,
    ready_to_apply: readyToApply,
    issues,
    local_config_write_performed: writePerformed,
    external_effect: false,
    remote_d1_create_performed: false,
    remote_d1_migration_performed: false,
    remote_d1_query_performed: false,
    data_lp_events_write_performed: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };
  await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) process.exitCode = 1;
}

function validate({ approval, binding, approvedId, inventoryMatch }) {
  const issues = [];
  if (!approval) issues.push("owner approval metadata is absent");
  if (approval && !approval.approved_by) issues.push("approved_by is required");
  if (approval && !/^\d{4}-\d{2}-\d{2}T/.test(approval.approved_at ?? "")) issues.push("approved_at must be an ISO datetime");
  if (approval && approval.d1_database_name !== DATABASE_NAME) issues.push(`d1_database_name must equal ${DATABASE_NAME}`);
  if (approvedId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(approvedId)) issues.push("d1_database_id must be a real UUID");
  if (approvedId === PLACEHOLDER_ID) issues.push("d1_database_id is still the placeholder");
  if (!binding || binding.database_name !== DATABASE_NAME) issues.push("wrangler DB binding is missing or points at another database name");
  if (binding && approvedId && binding.database_id !== PLACEHOLDER_ID && binding.database_id !== approvedId) issues.push("wrangler DB binding already contains a different non-placeholder id");
  if (approval && !inventoryMatch) issues.push("live read-only D1 inventory does not confirm the approved exact name and id");
  return issues;
}

function determineStatus({ apply, readyToApply, alreadyConfigured, writePerformed }) {
  if (alreadyConfigured && readyToApply) return "approved_d1_id_already_configured";
  if (writePerformed) return "approved_d1_id_applied_to_local_config";
  if (apply && !readyToApply) return "blocked_invalid_or_unverified_owner_d1_approval";
  if (readyToApply) return "ready_for_explicit_local_config_apply";
  return "prepared_but_blocked_owner_d1_approval_or_inventory";
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function renderReport(status) {
  return `# Approved D1 Config\n\nBLUF: ${status.status}. This guard may update only the local \`wrangler.jsonc\` D1 id after owner approval and an exact live metadata match. It never creates, queries, migrates, or deletes a remote D1 database.\n\n- Approval detected: ${status.approval_detected ? "yes" : "no"}\n- Exact live inventory match: ${status.inventory_exact_match ? "yes" : "no"}\n- Current id is placeholder: ${status.current_id_is_placeholder ? "yes" : "no"}\n- Ready to apply: ${status.ready_to_apply ? "yes" : "no"}\n- Local config write performed: ${status.local_config_write_performed ? "yes" : "no"}\n- Issues: ${status.issues.join("; ") || "none"}\n\nPreview:\n\n\`\`\`zsh\nnpm run d1:config:preview\n\`\`\`\n\nAfter owner approval, exact D1 creation, and a refreshed live inventory:\n\n\`\`\`zsh\nnpm run cloudflare:d1:readiness:live\nnpm run d1:config:apply\n\`\`\`\n`;
}

await main();
