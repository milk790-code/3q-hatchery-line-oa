import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expectedRowsIssues } from "./lib/gate-policy.mjs";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OPTIONS = parseArgs(process.argv.slice(2));
const HANDOFF_PATH = resolveProjectPath(OPTIONS.handoff, path.join(ROOT, "sample_gate_batch_handoff.json"));
const TEMPLATE_LEDGER_PATH = resolveProjectPath(
  OPTIONS.template,
  path.join(ROOT, "data", "source_capture", "sample_gate_ledger.fill-template.csv"),
);
const FILLED_LEDGER_PATH = resolveProjectPath(
  OPTIONS.filled,
  path.join(ROOT, "data", "source_capture", "sample_gate_ledger.filled.csv"),
);
const OUTPUT_JSON = resolveProjectPath(OPTIONS.json, path.join(ROOT, "sample_gate_batch_preflight.json"));
const OUTPUT_MD = resolveProjectPath(OPTIONS.report, path.join(ROOT, "sample_gate_batch_preflight.md"));
const STATUS_PATH = resolveProjectPath(OPTIONS.status, path.join(ROOT, "data", "sample_gate_batch_preflight_status.json"));

const REQUIRED_HEADERS = [
  "week_start",
  "week_end",
  "capture_date",
  "stage",
  "asset_id",
  "content_id",
  "variant_id",
  "tracking_link_id",
  "target_live_file",
  "aggregate_count",
  "evidence_ref",
  "reviewer",
  "pii_checked",
];

const PII_CHECKED_VALUES = new Set(["yes", "true", "checked", "ok", "1"]);
const RED_LINE_FALSE = {
  external_effect: false,
  live_input_files_created: false,
  stage_performed: false,
  apply_performed: false,
  append_performed: false,
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
  const handoff = JSON.parse(await readFile(HANDOFF_PATH, "utf8"));
  const input = await selectInput();
  const raw = await readFile(input.path, "utf8");
  const parsed = parseCsv(raw);
  const result = buildPreflight({ generatedAt, handoff, input, parsed });

  await writeJson(OUTPUT_JSON, result);
  await writeJson(STATUS_PATH, compactStatus(result));
  await writeFile(OUTPUT_MD, renderReport(result));
  console.log(JSON.stringify(compactStatus(result), null, 2));

  if (result.issue_count > 0 && OPTIONS.strict === "true") process.exitCode = 1;
}

async function selectInput() {
  if (OPTIONS.input) {
    return {
      path: resolveProjectPath(OPTIONS.input, OPTIONS.input),
      kind: OPTIONS.inputKind ?? "custom",
      owner_filled_exists: await exists(resolveProjectPath(OPTIONS.input, OPTIONS.input)),
    };
  }
  if (await exists(FILLED_LEDGER_PATH)) {
    return { path: FILLED_LEDGER_PATH, kind: "owner_filled", owner_filled_exists: true };
  }
  return { path: TEMPLATE_LEDGER_PATH, kind: "template", owner_filled_exists: false };
}

function buildPreflight({ generatedAt, handoff, input, parsed }) {
  const headerIssues = validateHeaders(parsed.headers);
  const expectedRows = Array.isArray(handoff.all_rows) ? handoff.all_rows : [];
  const expectedByKey = new Map(expectedRows.map((row) => [rowKey(row), row]));
  const rowsByKey = new Map(parsed.rows.map((row, index) => [rowKey({ tracking_link_id: row.tracking_link_id, event_type: row.stage }), { row, row_number: index + 2 }]));
  const issues = [...headerIssues, ...expectedRowsIssues(handoff)];
  const warnings = [];
  const rowResults = [];

  for (const expected of expectedRows) {
    const key = rowKey(expected);
    const found = rowsByKey.get(key);
    if (!found) {
      issues.push({
        row_number: null,
        field: key,
        code: "missing_expected_p0_row",
        message: "Expected P0 sample-gate row is missing from the ledger.",
      });
      rowResults.push({ ...expected, key, row_number: null, state: "missing", aggregate_count: "" });
      continue;
    }

    const rowIssues = validateRow(found.row, found.row_number, expected);
    issues.push(...rowIssues);
    const state = rowState(found.row, rowIssues);
    if (state === "partial") {
      warnings.push({
        row_number: found.row_number,
        field: key,
        code: "partial_expected_p0_row",
        message: "Row has some owner fields but is not complete enough for source compile.",
      });
    }
    rowResults.push({
      ...expected,
      key,
      row_number: found.row_number,
      state,
      aggregate_count: safeValue(found.row.aggregate_count),
      capture_date: safeValue(found.row.capture_date),
      evidence_ref: safeValue(found.row.evidence_ref),
      reviewer: safeValue(found.row.reviewer),
      pii_checked: safeValue(found.row.pii_checked),
    });
  }

  for (const [key, found] of rowsByKey.entries()) {
    if (!expectedByKey.has(key)) {
      warnings.push({
        row_number: found.row_number,
        field: key,
        code: "unexpected_ledger_row",
        message: "Ledger row is outside current P0 batch coverage and is ignored by this preflight.",
      });
    }
  }

  const filledRows = rowResults.filter((row) => row.state === "ready").length;
  const pendingRows = rowResults.filter((row) => row.state === "pending" || row.state === "missing").length;
  const partialRows = rowResults.filter((row) => row.state === "partial").length;
  const invalidRows = new Set(issues.map((issue) => issue.row_number).filter(Boolean)).size;
  const status = statusName({ issueCount: issues.length, filledRows, pendingRows, partialRows });
  const readyForSourceCompile = status === "ready_for_source_compile";

  return {
    ok: issues.length === 0,
    generated_at: generatedAt.toISOString(),
    mode: "sample_gate_batch_preflight_local_only",
    status,
    input_path: input.path,
    input_kind: input.kind,
    owner_filled_exists: input.owner_filled_exists,
    handoff_path: HANDOFF_PATH,
    template_ledger_path: TEMPLATE_LEDGER_PATH,
    filled_ledger_path: FILLED_LEDGER_PATH,
    expected_p0_row_count: expectedRows.length,
    ledger_row_count: parsed.rows.length,
    filled_p0_row_count: filledRows,
    pending_p0_row_count: pendingRows,
    partial_p0_row_count: partialRows,
    invalid_p0_row_count: invalidRows,
    ready_for_source_compile: readyForSourceCompile,
    sample_threshold_met: handoff.sample_threshold_met === true,
    current_real_event_rows: Number(handoff.current_real_event_rows ?? 0),
    counts_by_event_type: summarizeReadyRows(rowResults, "event_type"),
    counts_by_source_surface: summarizeReadyRows(rowResults, "source_surface"),
    row_results: rowResults,
    issue_count: issues.length,
    warning_count: warnings.length,
    issues,
    warnings,
    next_safe_action: nextSafeAction(status),
    recommended_commands: readyForSourceCompile
      ? [
          "npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled",
          "npm run owner:sample-gate",
          "npm run north-star",
          "npm run weekly:local",
        ]
      : [
          "open sample_gate_owner_worksheet.md",
          "open sample_gate_owner_form.html",
          "npm run sample-gate:batch-preflight",
        ],
    ...RED_LINE_FALSE,
    note: "Local full-P0 sample-gate preflight only. It validates the owner-filled 18-row aggregate ledger before source compile; it never creates live input files, stages data, appends events, deploys, posts, pushes GitHub/LINE, mutates customer data, processes payments, or deletes data.",
  };
}

function validateHeaders(headers) {
  return REQUIRED_HEADERS
    .filter((header) => !headers.includes(header))
    .map((header) => ({
      row_number: 1,
      field: header,
      code: "missing_header",
      message: `Missing required sample-gate ledger header: ${header}`,
    }));
}

function validateRow(row, rowNumber, expected) {
  const issues = [];
  const countRaw = String(row.aggregate_count ?? "").trim();
  const hasAnyOwnerValue = ["capture_date", "aggregate_count", "evidence_ref", "reviewer", "pii_checked"]
    .some((field) => String(row[field] ?? "").trim() !== "");

  if (!hasAnyOwnerValue) return issues;

  if (!/^(0|[1-9]\d*)$/.test(countRaw)) {
    issues.push(issue(rowNumber, "aggregate_count", "invalid_count", "aggregate_count must be a non-negative integer."));
  }

  for (const field of ["capture_date", "evidence_ref", "reviewer", "pii_checked"]) {
    if (!String(row[field] ?? "").trim()) {
      issues.push(issue(rowNumber, field, "missing_required_owner_field", `${field} is required when aggregate_count is filled.`));
    }
  }

  if (row.capture_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(row.capture_date).trim())) {
    issues.push(issue(rowNumber, "capture_date", "invalid_capture_date", "capture_date must be YYYY-MM-DD."));
  }

  if (row.stage !== expected.event_type) {
    issues.push(issue(rowNumber, "stage", "event_type_mismatch", `stage must match expected event_type ${expected.event_type}.`));
  }

  if (row.asset_id !== expected.asset_id) {
    issues.push(issue(rowNumber, "asset_id", "asset_mismatch", `asset_id must match expected asset ${expected.asset_id}.`));
  }

  if (row.content_id !== expected.content_id) {
    issues.push(issue(rowNumber, "content_id", "content_mismatch", `content_id must match expected content ${expected.content_id}.`));
  }

  if (row.variant_id !== expected.variant_id) {
    issues.push(issue(rowNumber, "variant_id", "variant_mismatch", `variant_id must match expected variant ${expected.variant_id}.`));
  }

  if (row.pii_checked && !PII_CHECKED_VALUES.has(String(row.pii_checked).trim().toLowerCase())) {
    issues.push(issue(rowNumber, "pii_checked", "invalid_pii_checked", "pii_checked must be yes/true/checked/ok/1."));
  }

  for (const field of ["evidence_ref", "reviewer", "notes"]) {
    const sensitive = sensitiveMatch(row[field] ?? "");
    if (sensitive) {
      issues.push(issue(rowNumber, field, "sensitive_value", `Sensitive-looking ${sensitive} detected. Use aggregate evidence refs only.`));
    }
  }

  return issues;
}

function rowState(row, rowIssues) {
  if (rowIssues.length > 0) return "invalid";
  const requiredValues = ["capture_date", "aggregate_count", "evidence_ref", "reviewer", "pii_checked"]
    .map((field) => String(row[field] ?? "").trim());
  if (requiredValues.every((value) => value === "")) return "pending";
  if (requiredValues.every((value) => value !== "")) return "ready";
  return "partial";
}

function statusName({ issueCount, filledRows, pendingRows, partialRows }) {
  if (issueCount > 0) return "blocked_invalid_full_p0_batch";
  if (pendingRows === 0 && partialRows === 0) return "ready_for_source_compile";
  if (filledRows > 0 || partialRows > 0) return "partial_full_p0_batch_waiting";
  return "waiting_for_full_p0_counts";
}

function nextSafeAction(status) {
  if (status === "ready_for_source_compile") {
    return "Run the local source compile preview, owner sample-gate status, north-star status, and weekly local verification.";
  }
  if (status === "partial_full_p0_batch_waiting") {
    return "Finish every remaining aggregate-only P0 row in data/source_capture/sample_gate_ledger.filled.csv, then rerun npm run sample-gate:batch-preflight.";
  }
  if (status === "blocked_invalid_full_p0_batch") {
    return "Fix invalid aggregate counts, metadata, or sensitive-looking values before compiling owner-preview CSVs.";
  }
  return "Create a reviewed working copy from data/source_capture/sample_gate_ledger.fill-template.csv, fill all 18 aggregate rows, then rerun npm run sample-gate:batch-preflight.";
}

function summarizeReadyRows(rows, field) {
  const summary = {};
  for (const row of rows) {
    if (row.state !== "ready") continue;
    const key = row[field] ?? "unknown";
    summary[key] = (summary[key] ?? 0) + Number(row.aggregate_count || 0);
  }
  return summary;
}

function compactStatus(result) {
  return {
    ok: result.ok,
    generated_at: result.generated_at,
    mode: result.mode,
    status: result.status,
    input_kind: result.input_kind,
    owner_filled_exists: result.owner_filled_exists,
    expected_p0_row_count: result.expected_p0_row_count,
    ledger_row_count: result.ledger_row_count,
    filled_p0_row_count: result.filled_p0_row_count,
    pending_p0_row_count: result.pending_p0_row_count,
    partial_p0_row_count: result.partial_p0_row_count,
    invalid_p0_row_count: result.invalid_p0_row_count,
    ready_for_source_compile: result.ready_for_source_compile,
    sample_threshold_met: result.sample_threshold_met,
    current_real_event_rows: result.current_real_event_rows,
    issue_count: result.issue_count,
    warning_count: result.warning_count,
    next_safe_action: result.next_safe_action,
    ...RED_LINE_FALSE,
  };
}

function renderReport(result) {
  return `# 3Q Growth Loop Full P0 Batch Preflight

BLUF: ${result.status}. ${result.next_safe_action}

Generated: ${result.generated_at}
Mode: ${result.mode}
Input: ${result.input_path}
Input kind: ${result.input_kind}
Owner-filled file exists: ${result.owner_filled_exists ? "yes" : "no"}
Ready for source compile: ${result.ready_for_source_compile ? "yes" : "no"}
Expected P0 rows: ${result.expected_p0_row_count}
Filled P0 rows: ${result.filled_p0_row_count}
Pending P0 rows: ${result.pending_p0_row_count}
Partial P0 rows: ${result.partial_p0_row_count}
Invalid P0 rows: ${result.invalid_p0_row_count}
Issue count: ${result.issue_count}
Warning count: ${result.warning_count}
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

## Row Status

| row | state | tracking link | event | asset | content | variant | count |
|---:|---|---|---|---|---|---|---:|
${result.row_results.map((row) => `| ${row.row_number ?? "-"} | ${row.state} | ${row.tracking_link_id} | ${row.event_type} | ${row.asset_id} | ${row.content_id} | ${row.variant_id} | ${row.aggregate_count || ""} |`).join("\n")}

## Issues

| row | field | code | message |
|---:|---|---|---|
${result.issues.length ? result.issues.map((item) => `| ${item.row_number ?? "-"} | ${item.field} | ${item.code} | ${item.message} |`).join("\n") : "| - | - | - | none |"}

## Warnings

| row | field | code | message |
|---:|---|---|---|
${result.warnings.length ? result.warnings.map((item) => `| ${item.row_number ?? "-"} | ${item.field} | ${item.code} | ${item.message} |`).join("\n") : "| - | - | - | none |"}

## Recommended Commands

\`\`\`zsh
${result.recommended_commands.join("\n")}
\`\`\`

## Safety

- Aggregate counts only.
- Do not paste phone, email, LINE user ID, customer name, chat text, order ID, payment ID, refund data, or private notes.
- Production deploy performed: no
- Public link change performed: no
- GitHub push / PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer-data mutation performed: no
- Payment action performed: no
- Delete action performed: no
`;
}

function parseCsv(raw) {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
  if (lines.length === 0) throw new Error("CSV is empty.");
  const headers = lines[0].map((header) => header.trim());
  return {
    headers,
    rows: lines.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]))),
  };
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function rowKey(row) {
  return `${row.tracking_link_id}::${row.event_type}`;
}

function issue(rowNumber, field, code, message) {
  return { row_number: rowNumber, field, code, message };
}

function safeValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (sensitiveMatch(text)) return "[blocked-sensitive-looking-value]";
  return text;
}

function sensitiveMatch(value) {
  const text = String(value ?? "");
  if (!text) return null;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) return "email";
  if (/\b(?:\+?886[- ]?)?0?9\d{2}[- ]?\d{3}[- ]?\d{3}\b/.test(text)) return "phone";
  if (/\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}\b/.test(text)) return "card-like number";
  if (/\bline[_ -]?user[_ -]?id\b/i.test(text)) return "LINE user id";
  return null;
}

function parseArgs(args) {
  const options = {};
  for (const arg of args) {
    if (arg.startsWith("--input=")) options.input = arg.slice("--input=".length);
    if (arg.startsWith("--input-kind=")) options.inputKind = arg.slice("--input-kind=".length);
    if (arg.startsWith("--handoff=")) options.handoff = arg.slice("--handoff=".length);
    if (arg.startsWith("--template=")) options.template = arg.slice("--template=".length);
    if (arg.startsWith("--filled=")) options.filled = arg.slice("--filled=".length);
    if (arg.startsWith("--json=")) options.json = arg.slice("--json=".length);
    if (arg.startsWith("--report=")) options.report = arg.slice("--report=".length);
    if (arg.startsWith("--status=")) options.status = arg.slice("--status=".length);
    if (arg === "--strict" || arg === "--strict=true") options.strict = "true";
  }
  return options;
}

function resolveProjectPath(value, fallback) {
  if (!value) return fallback;
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
