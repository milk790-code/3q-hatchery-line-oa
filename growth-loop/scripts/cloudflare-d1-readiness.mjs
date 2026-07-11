import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "wrangler.jsonc");
const SNAPSHOT_PATH = path.join(ROOT, "data", "cloudflare_d1_inventory_snapshot.json");
const STATUS_PATH = path.join(ROOT, "data", "cloudflare_d1_readiness_status.json");
const REPORT_PATH = path.join(ROOT, "cloudflare_d1_readiness.md");
const WRANGLER = path.join(
  ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "wrangler.cmd" : "wrangler",
);
const PLACEHOLDER_DATABASE_ID = "00000000-0000-0000-0000-000000000000";

async function main() {
  const generatedAt = new Date();
  const refreshLive = process.argv.includes("--refresh-live");
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const binding = (config.d1_databases ?? []).find((item) => item.binding === "DB");
  if (!binding?.database_name || !binding?.database_id) {
    throw new Error("wrangler.jsonc must define the DB D1 binding.");
  }

  let snapshot = await readOptionalJson(SNAPSHOT_PATH);
  let refresh = {
    requested: refreshLive,
    ok: false,
    error: null,
  };

  if (refreshLive) {
    try {
      const databases = await listDatabases();
      snapshot = buildSnapshot(databases, generatedAt);
      await writeJson(SNAPSHOT_PATH, snapshot);
      refresh = { requested: true, ok: true, error: null };
    } catch (error) {
      refresh = {
        requested: true,
        ok: false,
        error: error instanceof Error ? error.message : "unknown_live_read_error",
      };
      if (!snapshot) throw error;
    }
  }

  if (!snapshot) {
    throw new Error("No cached D1 inventory exists. Run with --refresh-live once.");
  }

  const exactMatches = (snapshot.related_databases ?? []).filter(
    (database) => database.name === binding.database_name,
  );
  const configuredIdIsPlaceholder = binding.database_id === PLACEHOLDER_DATABASE_ID;
  const configuredIdMatches = exactMatches.length === 1
    && binding.database_id === exactMatches[0].uuid;
  const dedicatedDatabasePresent = exactMatches.length === 1;
  const readyForMigrationReview = dedicatedDatabasePresent && configuredIdMatches;
  const state = dedicatedDatabasePresent
    ? configuredIdMatches
      ? "dedicated_d1_bound_owner_migration_review_required"
      : "dedicated_d1_found_owner_binding_review_required"
    : "dedicated_d1_missing_owner_creation_required";

  const status = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "cloudflare_d1_metadata_readiness",
    status: state,
    expected: {
      binding: binding.binding,
      database_name: binding.database_name,
      configured_database_id: binding.database_id,
      configured_id_is_placeholder: configuredIdIsPlaceholder,
    },
    inventory: {
      snapshot_checked_at: snapshot.checked_at,
      total_database_count: snapshot.total_database_count,
      related_database_count: snapshot.related_databases?.length ?? 0,
      exact_match_count: exactMatches.length,
      exact_matches: exactMatches,
      related_databases: snapshot.related_databases ?? [],
    },
    decision: {
      dedicated_database_present: dedicatedDatabasePresent,
      configured_id_matches: configuredIdMatches,
      ready_for_remote_schema_migration_review: readyForMigrationReview,
      inventory_table_count_authoritative: false,
      schema_absence_inferred_from_inventory: false,
      automatic_reuse_allowed: false,
      automatic_reuse_reason: "Only an exact dedicated database name may be considered, and binding or migration still requires owner approval.",
      crm_database_reuse_allowed: false,
    },
    live_refresh: refresh,
    outputs: {
      report: "cloudflare_d1_readiness.md",
      status: "data/cloudflare_d1_readiness_status.json",
      inventory_snapshot: "data/cloudflare_d1_inventory_snapshot.json",
    },
    external_read_performed: refreshLive && refresh.ok,
    remote_table_query_performed: false,
    customer_data_read_performed: false,
    resource_create_performed: false,
    remote_schema_migration_performed: false,
    data_lp_events_write_performed: false,
    external_effect: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));
}

async function listDatabases() {
  await access(WRANGLER);
  const { stdout } = await execFileAsync(WRANGLER, ["d1", "list", "--json"], {
    cwd: ROOT,
    maxBuffer: 4 * 1024 * 1024,
  });
  const parsed = JSON.parse(stdout);
  if (!Array.isArray(parsed)) throw new Error("Wrangler D1 list did not return an array.");
  return parsed;
}

function buildSnapshot(databases, checkedAt) {
  const related = databases
    .filter((database) => String(database.name ?? "").startsWith("3q-"))
    .map((database) => ({
      uuid: database.uuid,
      name: database.name,
      created_at: database.created_at,
      version: database.version,
      num_tables: Number.isInteger(database.num_tables) ? database.num_tables : null,
      file_size: Number.isFinite(database.file_size) ? database.file_size : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    ok: true,
    checked_at: checkedAt.toISOString(),
    mode: "read_only_cloudflare_d1_inventory",
    total_database_count: databases.length,
    related_databases: related,
    remote_table_query_performed: false,
    customer_data_read_performed: false,
    resource_create_performed: false,
    data_lp_events_write_performed: false,
    external_effect: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };
}

function renderReport(status) {
  const rows = status.inventory.related_databases.length > 0
    ? status.inventory.related_databases.map((database) => (
      `| ${database.name} | ${database.uuid} | ${database.num_tables ?? "n/a"} | ${database.file_size ?? "n/a"} | ${database.name === status.expected.database_name ? "exact dedicated match" : "existing 3Q database; no automatic reuse"} |`
    )).join("\n")
    : "| n/a | n/a | n/a | n/a | no related database found |";
  return `# Cloudflare D1 Readiness

BLUF: ${status.decision.dedicated_database_present ? "A dedicated D1 name exists, but binding and migration remain owner-gated." : "The dedicated 3q-growth-loop-candidate D1 does not exist; creation remains owner-gated."}

- Generated: ${status.generated_at}
- Inventory checked: ${status.inventory.snapshot_checked_at}
- Expected database: ${status.expected.database_name}
- Exact matches: ${status.inventory.exact_match_count}
- Config uses placeholder ID: ${status.expected.configured_id_is_placeholder ? "yes" : "no"}
- Ready for remote schema migration review: ${status.decision.ready_for_remote_schema_migration_review ? "yes" : "no"}
- Live metadata refresh: ${status.live_refresh.requested ? (status.live_refresh.ok ? "success" : "failed; cached snapshot used") : "not requested; cached snapshot used"}

## Related D1 Inventory

| database | uuid | reported_num_tables | reported_file_size | policy |
|---|---|---:|---:|---|
${rows}

## Guardrails

- No D1 database was created, bound, migrated, queried, or deleted.
- No table names, table rows, customer data, credentials, or secrets were read.
- Inventory-reported num_tables is metadata only and is never used to infer schema presence or absence.
- Existing CRM and hatchery databases are never selected automatically.
- Only the exact dedicated database name may advance to owner binding review.
`;
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch(async (error) => {
  const failed = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "cloudflare_d1_metadata_readiness",
    status: "readiness_monitor_failed",
    error: error instanceof Error ? error.message : "unknown_error",
    external_effect: false,
    remote_table_query_performed: false,
    customer_data_read_performed: false,
    resource_create_performed: false,
    remote_schema_migration_performed: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };
  await writeJson(STATUS_PATH, failed);
  console.error(error);
  process.exitCode = 1;
});
