import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { replaceAggregateWindow } from "./lib/idempotent-event-store.mjs";
import { completedTaipeiWeek } from "./lib/scoring-policy.mjs";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DATABASE_NAME = "3q-growth-loop-candidate";
const D1_GATE_ID = "remote_d1_create_and_migrate";
const MAX_EXPANDED_EVENTS = 50000;
const ALLOWED_EVENT_TYPES = new Set(["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"]);
const RAW_FIELDS_EXCLUDED = ["session_id", "url", "referrer", "user_agent_hash", "ip_country", "metadata_json"];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = JSON.parse(await readFile(path.join(ROOT, "config", "growth-loop.config.json"), "utf8"));
  options.experimentCampaign = requiredCampaign(config.current_round?.round_id);
  const authorization = await authorize(options);
  if (!options.allowRemote || !authorization.ok) {
    const status = blockedStatus(options, authorization, options.allowRemote
      ? "Owner evidence does not authorize recurring aggregate-only remote reads."
      : "Remote aggregate export requires --allow-remote after owner evidence is valid.");
    await writeOutputs(options, status, []);
    console.error(status.blocked_by);
    process.exitCode = 2;
    return;
  }

  if (options.planOnly) {
    const status = {
      ...baseStatus(options, authorization),
      ok: true,
      status: "remote_aggregate_export_plan_ready",
      plan_only: true,
      query_performed: false,
      remote_read_performed: false,
      aggregate_only_read_performed: false,
      data_lp_events_write_performed: false,
      scoring_input_allowed: false,
    };
    await writeOutputs(options, status, []);
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  const knownAssets = new Set((config.assets ?? []).map((asset) => asset.asset_id));
  const scoringWeek = completedTaipeiWeek(new Date());
  const aggregateRows = await queryAggregateD1(options, scoringWeek);
  const normalized = aggregateRows.map((row, index) => normalizeAggregateRow(row, index + 1, knownAssets));
  const totalEvents = normalized.reduce((sum, row) => sum + row.event_count, 0);
  if (totalEvents > MAX_EXPANDED_EVENTS) {
    throw new Error(`Aggregate export would expand to ${totalEvents} events; maximum is ${MAX_EXPANDED_EVENTS}. Review weighted-count support before continuing.`);
  }
  const events = normalized.flatMap(expandAggregateRow);
  const fixtureMode = process.env.D1_AGGREGATE_FIXTURE_MODE === "1";
  const writesRealEvents = pathsEqual(options.output, options.realEvents) && !fixtureMode;
  const existingEvents = await readJsonl(options.output);
  const replacement = replaceAggregateWindow(existingEvents, events, {
    campaign: options.experimentCampaign,
    startUtc: scoringWeek.startUtc,
    endUtc: scoringWeek.endUtc,
  });
  await atomicWriteJsonl(options.output, replacement.events);
  const status = {
    ...baseStatus(options, authorization),
    ok: true,
    status: fixtureMode ? "fixture_remote_aggregate_export_completed" : "remote_aggregate_export_completed",
    plan_only: false,
    query_performed: true,
    fixture_remote_simulation: fixtureMode,
    isolated_fixture_query_performed: fixtureMode,
    remote_read_performed: !fixtureMode,
    aggregate_only_read_performed: !fixtureMode,
    raw_event_rows_read_performed: false,
    customer_data_read_performed: false,
    aggregate_rows_read: normalized.length,
    rows_exported: events.length,
    output_rows_total: replacement.events.length,
    prior_aggregate_rows_replaced: replacement.replaced_count,
    existing_rows_preserved: replacement.preserved_count,
    scoring_week: scoringWeek,
    counts_by_event_type: countBy(events, "event_type"),
    data_lp_events_write_performed: writesRealEvents,
    scoring_input_allowed: writesRealEvents,
    output_path: options.output,
  };
  await writeOutputs(options, status, normalized);
  console.log(JSON.stringify(status, null, 2));
}

async function authorize(options) {
  const [ownerStatus, postGate, readiness, ownerInput] = await Promise.all([
    readOptionalJson(options.ownerStatus),
    readOptionalJson(options.postGate),
    readOptionalJson(options.readiness),
    readOptionalJson(options.ownerInput),
  ]);
  const ownerGate = (ownerStatus?.gates ?? []).find((gate) => gate.gate_id === D1_GATE_ID);
  const postGateRow = (postGate?.gates ?? []).find((gate) => gate.gate_id === D1_GATE_ID);
  const evidence = (ownerInput?.evidence ?? []).find((row) => row.gate_id === D1_GATE_ID);
  const expectedName = readiness?.expected?.database_name;
  const expectedId = readiness?.expected?.configured_database_id;
  const checks = [
    check("owner_evidence_input_present", ownerStatus?.input_exists === true && Boolean(evidence)),
    check("owner_evidence_valid", ownerGate?.evidence_valid === true && ownerGate?.ready_for_post_gate_verification === true),
    check("recurring_aggregate_read_approved", ownerGate?.recurring_aggregate_read_approved === true && evidence?.recurring_aggregate_read_approved === true),
    check("post_gate_verification_ready", postGateRow?.post_gate_verification_ready === true),
    check("dedicated_database_present", readiness?.decision?.dedicated_database_present === true),
    check("configured_id_matches", readiness?.decision?.configured_id_matches === true),
    check("evidence_database_name_matches", Boolean(expectedName) && evidence?.d1_database_name === expectedName),
    check("evidence_database_id_matches", Boolean(expectedId) && evidence?.d1_database_id === expectedId),
  ];
  return { ok: checks.every((item) => item.ok), checks };
}

export function aggregateSql(limit, experimentCampaign, scoringWeek) {
  const campaignLiteral = experimentCampaign.replaceAll("'", "''");
  const startLiteral = scoringWeek.startUtc.replaceAll("'", "''");
  const endLiteral = scoringWeek.endUtc.replaceAll("'", "''");
  return `
    SELECT
      date(datetime(occurred_at, '+8 hours')) AS event_date,
      asset_id,
      variant_id,
      content_id,
      source,
      medium,
      campaign,
      event_type,
      COUNT(*) AS event_count,
      AVG(quality_score) AS quality_score
    FROM lp_events
    WHERE campaign = '${campaignLiteral}'
      AND occurred_at >= '${startLiteral}'
      AND occurred_at <= '${endLiteral}'
    GROUP BY
      date(datetime(occurred_at, '+8 hours')),
      asset_id,
      variant_id,
      content_id,
      source,
      medium,
      campaign,
      event_type
    ORDER BY event_date ASC, asset_id ASC, event_type ASC
    LIMIT ${limit}
  `;
}

async function queryAggregateD1(options, scoringWeek) {
  const sql = aggregateSql(options.limit + 1, options.experimentCampaign, scoringWeek);
  const args = ["d1", "execute", DATABASE_NAME, "--remote", "--json", "--command", sql];
  const { stdout } = await runWrangler(options, args);
  const parsed = JSON.parse(stdout);
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!first?.success) throw new Error("D1 aggregate query failed");
  const rows = first.results ?? [];
  if (rows.length > options.limit) {
    throw new Error(`D1 aggregate query exceeded ${options.limit} grouped rows for the completed scoring week.`);
  }
  return rows;
}

function normalizeAggregateRow(row, rowNumber, knownAssets) {
  const eventDate = requiredDate(row.event_date, rowNumber);
  const assetId = safeDimension(row.asset_id, "asset_id", rowNumber, { required: true });
  if (!knownAssets.has(assetId)) throw new Error(`Aggregate row ${rowNumber}: unknown asset_id ${assetId}.`);
  const eventType = safeDimension(row.event_type, "event_type", rowNumber, { required: true });
  if (!ALLOWED_EVENT_TYPES.has(eventType)) throw new Error(`Aggregate row ${rowNumber}: invalid event_type ${eventType}.`);
  const eventCount = Number(row.event_count);
  if (!Number.isInteger(eventCount) || eventCount < 1 || eventCount > MAX_EXPANDED_EVENTS) {
    throw new Error(`Aggregate row ${rowNumber}: event_count must be an integer from 1 to ${MAX_EXPANDED_EVENTS}.`);
  }
  const qualityScore = row.quality_score == null ? undefined : Number(row.quality_score);
  if (qualityScore !== undefined && (!Number.isFinite(qualityScore) || qualityScore < 0 || qualityScore > 1)) {
    throw new Error(`Aggregate row ${rowNumber}: quality_score must be from 0 to 1.`);
  }
  return {
    event_date: eventDate,
    asset_id: assetId,
    variant_id: safeDimension(row.variant_id, "variant_id", rowNumber),
    content_id: safeDimension(row.content_id, "content_id", rowNumber),
    source: safeDimension(row.source, "source", rowNumber),
    medium: safeDimension(row.medium, "medium", rowNumber),
    campaign: safeDimension(row.campaign, "campaign", rowNumber),
    event_type: eventType,
    event_count: eventCount,
    quality_score: qualityScore,
  };
}

function expandAggregateRow(row) {
  const canonical = JSON.stringify(row);
  return Array.from({ length: row.event_count }, (_, index) => ({
    event_id: `d1agg-${createHash("sha256").update(`${canonical}:${index}`).digest("hex").slice(0, 24)}`,
    occurred_at: `${row.event_date}T12:00:00+08:00`,
    asset_id: row.asset_id,
    ...(row.variant_id ? { variant_id: row.variant_id } : {}),
    ...(row.content_id ? { content_id: row.content_id } : {}),
    ...(row.source ? { source: row.source } : {}),
    ...(row.medium ? { medium: row.medium } : {}),
    ...(row.campaign ? { campaign: row.campaign } : {}),
    event_type: row.event_type,
    ...(row.quality_score !== undefined ? { quality_score: row.quality_score } : {}),
    metadata_json: { aggregate_only: true, collection: "remote_d1_grouped_count" },
  }));
}

function safeDimension(value, field, rowNumber, { required = false } = {}) {
  if (value == null || value === "") {
    if (required) throw new Error(`Aggregate row ${rowNumber}: ${field} is required.`);
    return undefined;
  }
  if (typeof value !== "string" || value.length > 160 || !/^[A-Za-z0-9._:/-]+$/.test(value)) {
    throw new Error(`Aggregate row ${rowNumber}: ${field} contains unsafe or non-aggregate text.`);
  }
  return value;
}

function requiredDate(value, rowNumber) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).valueOf())) {
    throw new Error(`Aggregate row ${rowNumber}: event_date must be YYYY-MM-DD.`);
  }
  return value;
}

function requiredCampaign(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 160 || !/^[A-Za-z0-9._:/-]+$/.test(value)) {
    throw new Error("config.current_round.round_id must be a safe non-empty experiment campaign token.");
  }
  return value;
}

function baseStatus(options, authorization) {
  return {
    generated_at: new Date().toISOString(),
    mode: "remote_d1_aggregate_only_export",
    scope: "remote_aggregate_only",
    database_name: DATABASE_NAME,
    authorization_checks: authorization.checks,
    owner_evidence_required: true,
    recurring_aggregate_read_approval_required: true,
    aggregate_query_only: true,
    experiment_campaign: options.experimentCampaign,
    experiment_scope_enforced: true,
    selected_columns: ["event_date", "asset_id", "variant_id", "content_id", "source", "medium", "campaign", "event_type", "event_count", "quality_score"],
    raw_fields_excluded: RAW_FIELDS_EXCLUDED,
    raw_event_rows_read_performed: false,
    customer_data_read_performed: false,
    customer_data_mutation_performed: false,
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    output_path: options.output,
  };
}

function blockedStatus(options, authorization, blockedBy) {
  return {
    ...baseStatus(options, authorization),
    ok: false,
    status: "remote_aggregate_export_blocked",
    blocked_by: blockedBy,
    plan_only: options.planOnly,
    query_performed: false,
    remote_read_performed: false,
    aggregate_only_read_performed: false,
    rows_exported: 0,
    aggregate_rows_read: 0,
    data_lp_events_write_performed: false,
    scoring_input_allowed: false,
  };
}

function check(id, ok) {
  return { id, ok: Boolean(ok), external_effect: false };
}

function parseArgs(args) {
  const options = {
    allowRemote: false,
    planOnly: false,
    limit: 10000,
    output: path.resolve(process.env.D1_AGGREGATE_OUTPUT_PATH ?? path.join(ROOT, "data", "lp_events.jsonl")),
    realEvents: path.resolve(process.env.D1_AGGREGATE_REAL_EVENTS_PATH ?? path.join(ROOT, "data", "lp_events.jsonl")),
    status: path.resolve(process.env.D1_AGGREGATE_STATUS_PATH ?? path.join(ROOT, "data", "d1_sync_status.json")),
    report: path.resolve(process.env.D1_AGGREGATE_REPORT_PATH ?? path.join(ROOT, "d1_collection_guard.md")),
    ownerStatus: path.resolve(process.env.D1_AGGREGATE_OWNER_STATUS_PATH ?? path.join(ROOT, "data", "owner_gate_evidence_status.json")),
    postGate: path.resolve(process.env.D1_AGGREGATE_POST_GATE_PATH ?? path.join(ROOT, "data", "post_gate_verification_status.json")),
    readiness: path.resolve(process.env.D1_AGGREGATE_READINESS_PATH ?? path.join(ROOT, "data", "cloudflare_d1_readiness_status.json")),
    ownerInput: path.resolve(process.env.D1_AGGREGATE_OWNER_INPUT_PATH ?? path.join(ROOT, "owner_gate_evidence.json")),
    wranglerBin: process.env.D1_AGGREGATE_WRANGLER_BIN ?? path.join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler"),
  };
  for (const arg of args) {
    if (arg === "--allow-remote") options.allowRemote = true;
    if (arg === "--plan-only") options.planOnly = true;
    if (arg.startsWith("--limit=")) options.limit = Math.max(1, Math.min(10000, Number.parseInt(arg.slice(8), 10) || 10000));
  }
  return options;
}

function runWrangler(options, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(options.wranglerBin, args, { cwd: ROOT, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`wrangler exited with code ${code}: ${stderr || stdout}`)));
  });
}

async function atomicWriteJsonl(outputPath, rows) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const tempPath = `${outputPath}.tmp-${process.pid}`;
  try {
    const body = rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length > 0 ? "\n" : "");
    await writeFile(tempPath, body);
    await rename(tempPath, outputPath);
  } finally {
    await rm(tempPath, { force: true });
  }
}

async function readJsonl(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`Existing event store has invalid JSON on line ${index + 1}.`);
      }
    });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeOutputs(options, status, aggregateRows) {
  await mkdir(path.dirname(options.status), { recursive: true });
  await mkdir(path.dirname(options.report), { recursive: true });
  await writeFile(options.status, `${JSON.stringify(status, null, 2)}\n`);
  await writeFile(options.report, renderReport(status, aggregateRows));
}

function renderReport(status, rows) {
  const preview = rows.slice(0, 12).map((row) => `| ${row.event_date} | ${row.asset_id} | ${row.event_type} | ${row.event_count} |`).join("\n") || "| n/a | n/a | n/a | 0 |";
  return `# D1 Collection Guard\n\nBLUF: ${status.ok ? "Owner-authorized aggregate-only D1 collection completed or is ready." : "Remote D1 collection remains blocked."}\n\n- Status: ${status.status}\n- Scope: ${status.scope}\n- Aggregate rows: ${status.aggregate_rows_read ?? 0}\n- Expanded scoring events: ${status.rows_exported ?? 0}\n- Aggregate-only read: ${status.aggregate_only_read_performed ? "yes" : "no"}\n- Raw event rows read: no\n- Customer data read: no\n- data/lp_events.jsonl write performed: ${status.data_lp_events_write_performed ? "yes" : "no"}\n- Remote read performed: ${status.remote_read_performed ? "yes" : "no"}\n- Scoring input allowed: ${status.scoring_input_allowed ? "yes" : "no"}\n- External effect: no\n\n## Aggregate Preview\n\n| date | asset_id | event_type | count |\n|---|---|---|---:|\n${preview}\n\n## Privacy Contract\n\nThe remote query reads grouped acquisition dimensions and counts only. It excludes session_id, URL, referrer, user-agent hash, IP country, and metadata payloads. Recurring reads require explicit owner evidence and post-gate readiness.\n`;
}

function countBy(rows, key) {
  return rows.reduce((counts, row) => {
    const value = row[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function pathsEqual(left, right) {
  return path.resolve(left) === path.resolve(right);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
