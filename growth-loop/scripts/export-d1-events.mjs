import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DEFAULT_OUTPUT = path.join(ROOT, "data", "lp_events.d1-local.jsonl");
const STATUS_PATH = path.join(ROOT, "data", "d1_sync_status.json");
const REPORT_PATH = path.join(ROOT, "d1_collection_guard.md");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const DATABASE_NAME = "3q-growth-loop-candidate";

const SENSITIVE_METADATA_KEYS = [
  "phone",
  "email",
  "line_user_id",
  "customer_name",
  "address",
  "payment",
  "card",
];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputPath = path.resolve(ROOT, options.output ?? DEFAULT_OUTPUT);
  const scope = options.remote ? "remote" : "local";

  if (options.remote) {
    const status = {
      ok: false,
      scope,
      output_path: outputPath,
      rows_exported: 0,
      blocked_by: "Raw remote event export is disabled. Use the owner-evidence-gated aggregate-only exporter.",
      remote_read_performed: false,
      aggregate_only_read_performed: false,
      raw_event_rows_read_performed: false,
      customer_data_read_performed: false,
      scoring_input_allowed: false,
      local_review_only: true,
      data_lp_events_write_performed: false,
      external_effect: false,
    };
    await writeStatus(status);
    await writeReport(status, []);
    console.error(status.blocked_by);
    process.exitCode = 2;
    return;
  }

  if (options.remote && !options.allowRemote) {
    const status = {
      ok: false,
      scope,
      output_path: outputPath,
      rows_exported: 0,
      blocked_by: "Remote D1 read requires explicit owner approval. Re-run with --remote --allow-remote after approval.",
      remote_read_performed: false,
      scoring_input_allowed: false,
      local_review_only: true,
      synthetic_or_smoke_detected: false,
      synthetic_or_smoke_row_count: 0,
      real_event_candidate_rows: 0,
      data_lp_events_write_performed: false,
      external_effect: false,
    };
    await writeStatus(status);
    await writeReport(status, []);
    console.error("Remote D1 export is owner-gated. Re-run with --remote --allow-remote after approval.");
    process.exitCode = 2;
    return;
  }

  const rows = await queryD1(scope, options.limit);
  const sanitized = rows.map(sanitizeRow);
  const classifiedRows = sanitized.map(classifyRow);
  const generatedAt = new Date().toISOString();
  const syntheticOrSmokeRowCount = classifiedRows.filter((row) => row.synthetic_or_smoke).length;
  const realEventCandidateRows = classifiedRows.filter((row) => row.real_event_candidate).length;
  const dataLpEventsWritePerformed = pathsEqual(outputPath, REAL_EVENTS_PATH);
  const scoringInputAllowed = scope === "remote"
    && dataLpEventsWritePerformed
    && syntheticOrSmokeRowCount === 0
    && realEventCandidateRows === sanitized.length;
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, sanitized.map((row) => JSON.stringify(row)).join("\n") + (sanitized.length > 0 ? "\n" : ""));
  const status = {
    ok: true,
    scope,
    output_path: outputPath,
    rows_exported: sanitized.length,
    generated_at: generatedAt,
    remote_read_performed: scope === "remote",
    scoring_input_allowed: scoringInputAllowed,
    local_review_only: scope !== "remote",
    synthetic_or_smoke_detected: syntheticOrSmokeRowCount > 0,
    synthetic_or_smoke_row_count: syntheticOrSmokeRowCount,
    real_event_candidate_rows: realEventCandidateRows,
    data_lp_events_write_performed: dataLpEventsWritePerformed,
    scoring_policy: scoringInputAllowed
      ? "remote_owner_approved_export_written_to_real_events"
      : "review_export_only_not_sample_gate_input",
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    note: scope === "local"
      ? "Local D1 export for review; local smoke rows are not sample-gate input and do not overwrite data/lp_events.jsonl."
      : "Remote read-only export after owner approval; scoring input is allowed only when written to data/lp_events.jsonl and no smoke rows are detected.",
  };
  await writeStatus(status);
  await writeReport(status, classifiedRows);

  console.log(JSON.stringify({ ok: true, scope, output_path: outputPath, rows_exported: sanitized.length }, null, 2));
}

function parseArgs(args) {
  const options = {
    remote: false,
    allowRemote: false,
    output: null,
    limit: 10000,
  };

  for (const arg of args) {
    if (arg === "--remote") options.remote = true;
    if (arg === "--local") options.remote = false;
    if (arg === "--allow-remote") options.allowRemote = true;
    if (arg.startsWith("--output=")) options.output = arg.slice("--output=".length);
    if (arg.startsWith("--limit=")) {
      const parsed = Number(arg.slice("--limit=".length));
      if (Number.isFinite(parsed) && parsed > 0) {
        options.limit = Math.trunc(parsed);
      }
    }
  }

  return options;
}

async function queryD1(scope, limit) {
  const sql = `
    SELECT
      event_id,
      occurred_at,
      asset_id,
      variant_id,
      content_id,
      session_id,
      source,
      medium,
      campaign,
      event_type,
      url,
      referrer,
      value_amount,
      quality_score,
      metadata_json
    FROM lp_events
    ORDER BY occurred_at ASC
    LIMIT ${limit}
  `;
  const args = [
    "d1",
    "execute",
    DATABASE_NAME,
    scope === "remote" ? "--remote" : "--local",
    "--json",
    "--command",
    sql,
  ];
  const { stdout } = await runWrangler(args);
  const parsed = JSON.parse(stdout);
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!first?.success) {
    throw new Error("D1 query failed");
  }
  return first.results ?? [];
}

function sanitizeRow(row) {
  const metadata = parseMetadata(row.metadata_json);
  return {
    event_id: row.event_id,
    occurred_at: row.occurred_at,
    asset_id: row.asset_id,
    variant_id: row.variant_id ?? undefined,
    content_id: row.content_id ?? undefined,
    session_id: row.session_id ?? undefined,
    source: row.source ?? undefined,
    medium: row.medium ?? undefined,
    campaign: row.campaign ?? undefined,
    event_type: row.event_type,
    url: row.url ?? undefined,
    referrer: row.referrer ?? undefined,
    value_amount: row.value_amount ?? undefined,
    quality_score: row.quality_score ?? undefined,
    metadata_json: metadata,
  };
}

function parseMetadata(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(([key]) => {
        const normalized = key.toLowerCase();
        return !SENSITIVE_METADATA_KEYS.some((blocked) => normalized.includes(blocked));
      }),
    );
  } catch {
    return {};
  }
}

function classifyRow(row) {
  const metadata = row.metadata_json ?? {};
  const values = [
    row.source,
    row.medium,
    row.url,
    row.referrer,
    metadata.surface,
    metadata.route,
    metadata.test_id,
    metadata.selected_target,
  ]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).toLowerCase());
  const joined = values.join(" ");
  const syntheticOrSmoke = [
    "local",
    "smoke",
    "localhost",
    "127.0.0.1",
    "miniflare",
  ].some((marker) => joined.includes(marker));
  return {
    event_id: row.event_id,
    event_type: row.event_type,
    asset_id: row.asset_id,
    source: row.source ?? null,
    medium: row.medium ?? null,
    synthetic_or_smoke: syntheticOrSmoke,
    real_event_candidate: !syntheticOrSmoke,
    reason: syntheticOrSmoke ? "local_or_smoke_marker_detected" : "no_local_or_smoke_marker_detected",
  };
}

function pathsEqual(a, b) {
  return path.resolve(a) === path.resolve(b);
}

async function writeReport(status, rows) {
  const previewRows = rows.slice(0, 12).map((row) => (
    `| ${row.event_id ?? "n/a"} | ${row.asset_id ?? "n/a"} | ${row.event_type ?? "n/a"} | ${row.synthetic_or_smoke ? "yes" : "no"} | ${row.reason ?? "n/a"} |`
  )).join("\n") || "| n/a | n/a | n/a | n/a | n/a |";
  const report = `# D1 Collection Guard

BLUF: ${status.scoring_input_allowed ? "D1 export can be used as scoring input." : "D1 export is review-only and must not be used as sample-gate input yet."}

- Scope: ${status.scope ?? "unknown"}
- Rows exported: ${status.rows_exported ?? 0}
- Synthetic / smoke rows: ${status.synthetic_or_smoke_row_count ?? 0}
- Real event candidate rows: ${status.real_event_candidate_rows ?? 0}
- Scoring input allowed: ${status.scoring_input_allowed ? "yes" : "no"}
- Local review only: ${status.local_review_only ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${status.data_lp_events_write_performed ? "yes" : "no"}
- Remote read performed: ${status.remote_read_performed ? "yes" : "no"}
- External effect: ${status.external_effect ? "yes" : "no"}
- Output: ${status.output_path ?? "n/a"}

## Row Classification Preview

| event_id | asset_id | event_type | smoke/local | reason |
|---|---|---|---|---|
${previewRows}

## Policy

- Local D1 exports are evidence for local Worker smoke and route checks only.
- Sample-gate scoring must use owner-reviewed real aggregate input or an owner-approved remote D1 export.
- This command does not deploy, post, push LINE, change public links, mutate customer data, process payments, or delete data.
`;
  await writeFile(REPORT_PATH, report);
}

function runWrangler(args) {
  const bin = process.platform === "win32"
    ? path.join(ROOT, "node_modules", ".bin", "wrangler.cmd")
    : path.join(ROOT, "node_modules", ".bin", "wrangler");

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`wrangler exited with code ${code}: ${stderr}`));
    });
  });
}

async function writeStatus(status) {
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
}

main().catch(async (error) => {
  const status = {
    ok: false,
    generated_at: new Date().toISOString(),
    error: error instanceof Error ? error.message : "unknown_error",
    scoring_input_allowed: false,
    data_lp_events_write_performed: false,
    external_effect: false,
  };
  await writeStatus(status);
  await writeReport(status, []);
  console.error(error);
  process.exitCode = 1;
});
