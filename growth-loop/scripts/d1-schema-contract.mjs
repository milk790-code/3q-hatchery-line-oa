import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DATABASE_NAME = "3q-growth-loop-candidate";
const SCHEMA_PATH = path.join(ROOT, "schema", "d1-week0.sql");
const STATUS_PATH = path.join(ROOT, "data", "d1_schema_contract_status.json");
const REPORT_PATH = path.join(ROOT, "d1_schema_contract.md");
const WRANGLER = path.join(ROOT, "node_modules", ".bin", "wrangler");
const EXPECTED_TABLES = [
  "ab_tests",
  "approval_queue",
  "iteration_decisions",
  "lp_assets",
  "lp_events",
  "prepared_but_blocked",
  "weekly_growth_scores",
];
const EXPECTED_INDEXES = [
  "idx_lp_events_asset_time",
  "idx_lp_events_campaign",
  "idx_lp_events_type_time",
];

async function main() {
  const startedAt = new Date();
  const stateDir = await mkdtemp(path.join(tmpdir(), "3q-growth-loop-d1-schema-"));
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });

  let status;
  try {
    const schema = await readFile(SCHEMA_PATH, "utf8");
    const schemaSha256 = createHash("sha256").update(schema).digest("hex");
    const firstApply = runWrangler(stateDir);
    const dbPath = await findDatabase(stateDir);
    const before = inspectDatabase(dbPath);
    const secondApply = runWrangler(stateDir);
    const after = inspectDatabase(dbPath);
    const constraints = checkConstraints(dbPath);
    const checks = {
      first_migration_apply_ok: firstApply.ok,
      second_migration_apply_ok: secondApply.ok,
      migration_idempotent: before.seed_assets === after.seed_assets && before.seed_ab_tests === after.seed_ab_tests,
      expected_tables_exact: sameSet(after.tables, EXPECTED_TABLES),
      expected_indexes_present: EXPECTED_INDEXES.every((name) => after.indexes.includes(name)),
      sqlite_integrity_ok: after.integrity_check === "ok",
      foreign_key_check_clean: after.foreign_key_violations === 0,
      seed_assets_exact: after.seed_assets === 2,
      seed_ab_test_exact: after.seed_ab_tests === 1,
      event_type_constraint_enforced: constraints.event_type,
      asset_role_constraint_enforced: constraints.asset_role,
      foreign_key_constraint_enforced: constraints.foreign_key,
    };
    const ok = Object.values(checks).every(Boolean);
    status = buildStatus({ ok, startedAt, schemaSha256, before, after, constraints, checks });
  } catch (error) {
    status = buildStatus({
      ok: false,
      startedAt,
      error: error instanceof Error ? error.message : "unknown_error",
      checks: {},
    });
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }

  await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) process.exitCode = 1;
}

function runWrangler(stateDir) {
  const result = run(WRANGLER, [
    "d1", "execute", DATABASE_NAME, "--local", "--persist-to", stateDir,
    "--file", "schema/d1-week0.sql", "--yes",
  ]);
  if (!result.ok) throw new Error(`Local D1 migration failed: ${result.stderr || result.stdout}`);
  return result;
}

function inspectDatabase(dbPath) {
  return {
    tables: query(dbPath, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' ORDER BY name").map((row) => row.name),
    indexes: query(dbPath, "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name").map((row) => row.name),
    integrity_check: query(dbPath, "PRAGMA integrity_check")[0]?.integrity_check ?? null,
    foreign_key_violations: query(dbPath, "PRAGMA foreign_key_check").length,
    seed_assets: query(dbPath, "SELECT COUNT(*) AS n FROM lp_assets")[0]?.n ?? -1,
    seed_ab_tests: query(dbPath, "SELECT COUNT(*) AS n FROM ab_tests")[0]?.n ?? -1,
  };
}

function checkConstraints(dbPath) {
  const base = "PRAGMA foreign_keys=ON;";
  return {
    event_type: !execute(dbPath, `${base} INSERT INTO lp_events(event_id,occurred_at,asset_id,event_type) VALUES('bad-event','2026-07-10T00:00:00Z','champion-3q-line-v0','invalid');`).ok,
    asset_role: !execute(dbPath, `${base} INSERT INTO lp_assets(asset_id,role,name,landing_url) VALUES('bad-role','invalid','bad','https://example.invalid');`).ok,
    foreign_key: !execute(dbPath, `${base} INSERT INTO lp_events(event_id,occurred_at,asset_id,event_type) VALUES('bad-fk','2026-07-10T00:00:00Z','missing-asset','page_view');`).ok,
  };
}

async function findDatabase(dir) {
  const found = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(next);
      if (entry.isFile() && entry.name.endsWith(".sqlite") && entry.name !== "metadata.sqlite") found.push(next);
    }
  }
  await walk(dir);
  if (found.length !== 1) throw new Error(`Expected one isolated D1 sqlite file, found ${found.length}`);
  return found[0];
}

function query(dbPath, sql) {
  const result = run("sqlite3", ["-json", dbPath, sql]);
  if (!result.ok) throw new Error(`SQLite query failed: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout || "[]");
}

function execute(dbPath, sql) {
  return run("sqlite3", [dbPath, sql]);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
  return { ok: result.status === 0, exit_code: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function sameSet(actual, expected) {
  return actual.length === expected.length && expected.every((item) => actual.includes(item));
}

function buildStatus({ ok, startedAt, schemaSha256 = null, before = null, after = null, constraints = null, checks, error = null }) {
  return {
    ok,
    generated_at: new Date().toISOString(),
    started_at: startedAt.toISOString(),
    mode: "isolated_local_d1_schema_contract",
    status: ok ? "local_schema_idempotency_and_constraints_verified" : "local_schema_contract_failed",
    database_name: DATABASE_NAME,
    schema_path: "schema/d1-week0.sql",
    schema_sha256: schemaSha256,
    checks,
    before_second_apply: before,
    after_second_apply: after,
    constraints,
    error,
    isolated_local_d1_write_performed: true,
    temporary_files_removed: true,
    remote_d1_create_performed: false,
    remote_d1_migration_performed: false,
    remote_d1_query_performed: false,
    customer_data_read_performed: false,
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
  const rows = Object.entries(status.checks ?? {}).map(([name, ok]) => `| ${name} | ${ok ? "pass" : "fail"} |`).join("\n");
  return `# D1 Schema Contract\n\nBLUF: ${status.status}. The Week 0 migration was applied twice to a disposable local D1 database, then checked for idempotency, integrity, seed stability, and constraints. No remote D1 or customer data was touched.\n\n- Schema SHA-256: ${status.schema_sha256 ?? "n/a"}\n- Remote D1 create: no\n- Remote D1 migration: no\n- Remote D1 query: no\n- Temporary state removed: ${status.temporary_files_removed ? "yes" : "no"}\n\n| check | result |\n|---|---|\n${rows}\n`;
}

await main();
