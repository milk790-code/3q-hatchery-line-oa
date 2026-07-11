import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OPTIONS = parseArgs(process.argv.slice(2));
const TEMPLATE_LEDGER_PATH = resolveProjectPath(
  OPTIONS.template,
  path.join(ROOT, "data", "source_capture", "source_capture_ledger.fill-template.csv"),
);
const FILLED_LEDGER_PATH = resolveProjectPath(
  OPTIONS.filled,
  path.join(ROOT, "data", "source_capture", "source_capture_ledger.filled.csv"),
);
const OUTPUT_JSON = resolveProjectPath(OPTIONS.json, path.join(ROOT, "north_star_outcome_preflight.json"));
const OUTPUT_MD = resolveProjectPath(OPTIONS.report, path.join(ROOT, "north_star_outcome_preflight.md"));
const STATUS_PATH = resolveProjectPath(OPTIONS.status, path.join(ROOT, "data", "north_star_outcome_preflight_status.json"));

const OUTCOME_EVENTS = ["link_click", "lead_submit", "deal", "quality_flag"];
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
const OWNER_REQUIRED_FIELDS = ["capture_date", "aggregate_count", "evidence_ref", "reviewer", "pii_checked"];
const PII_CHECKED_VALUES = new Set(["yes", "true", "checked", "ok", "1"]);
const ALLOWED_TARGET_FILES = new Set(["data/funnel_aggregates.csv", "data/manual_conversions.csv"]);
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
  const templateRaw = await readFile(TEMPLATE_LEDGER_PATH, "utf8");
  const template = parseCsv(templateRaw);
  const input = await selectInput();
  const inputRaw = await readFile(input.path, "utf8");
  const parsed = parseCsv(inputRaw);
  const result = buildPreflight({ generatedAt, template, input, parsed });

  await writeJson(OUTPUT_JSON, result);
  await writeJson(STATUS_PATH, compactStatus(result));
  await writeFile(OUTPUT_MD, renderReport(result));
  console.log(JSON.stringify(compactStatus(result), null, 2));

  if (result.issue_count > 0 && OPTIONS.strict === "true") process.exitCode = 1;
}

async function selectInput() {
  if (OPTIONS.input) {
    const customPath = resolveProjectPath(OPTIONS.input, OPTIONS.input);
    return { path: customPath, kind: OPTIONS.inputKind ?? "custom", owner_filled_exists: await exists(customPath) };
  }
  if (await exists(FILLED_LEDGER_PATH)) {
    return { path: FILLED_LEDGER_PATH, kind: "owner_filled", owner_filled_exists: true };
  }
  return { path: TEMPLATE_LEDGER_PATH, kind: "template", owner_filled_exists: false };
}

function buildPreflight({ generatedAt, template, input, parsed }) {
  const expectedRows = template.rows.filter((row) => OUTCOME_EVENTS.includes(row.stage));
  const expectedByKey = new Map(expectedRows.map((row) => [rowKey(row), row]));
  const rowsByKey = new Map(parsed.rows.map((row, index) => [rowKey(row), { row, row_number: index + 2 }]));
  const issues = [...validateHeaders(parsed.headers)];
  const warnings = [];
  const rowResults = [];

  for (const expected of expectedRows) {
    const key = rowKey(expected);
    const found = rowsByKey.get(key);
    if (!found) {
      issues.push(issue(null, key, "missing_expected_outcome_row", "Expected North Star outcome row is missing from the ledger."));
      rowResults.push({ ...projectExpected(expected), key, row_number: null, state: "missing", aggregate_count: "" });
      continue;
    }

    const rowIssues = validateRow(found.row, found.row_number, expected);
    issues.push(...rowIssues);
    const state = rowState(found.row, rowIssues);
    if (state === "partial") {
      warnings.push(issue(found.row_number, key, "partial_outcome_row", "Row has some owner fields but is not complete enough for source compile."));
    }
    if (state === "ready" && found.row.stage === "quality_flag" && Number(found.row.aggregate_count) > 0 && !String(found.row.quality_score ?? "").trim()) {
      warnings.push(issue(found.row_number, "quality_score", "quality_score_missing_for_quality_flag", "quality_flag rows can compile without quality_score, but the no-quality-regression review is weaker without it."));
    }

    rowResults.push({
      ...projectExpected(expected),
      key,
      row_number: found.row_number,
      state,
      aggregate_count: safeValue(found.row.aggregate_count),
      capture_date: safeValue(found.row.capture_date),
      evidence_ref: safeValue(found.row.evidence_ref),
      reviewer: safeValue(found.row.reviewer),
      pii_checked: safeValue(found.row.pii_checked),
      quality_score: safeValue(found.row.quality_score),
    });
  }

  for (const [key, found] of rowsByKey.entries()) {
    if (OUTCOME_EVENTS.includes(found.row.stage) && !expectedByKey.has(key)) {
      warnings.push(issue(found.row_number, key, "unexpected_outcome_row", "Outcome row is outside the current North Star capture contract and is ignored by this preflight."));
    }
  }

  const filledRows = rowResults.filter((row) => row.state === "ready").length;
  const pendingRows = rowResults.filter((row) => row.state === "pending" || row.state === "missing").length;
  const partialRows = rowResults.filter((row) => row.state === "partial").length;
  const invalidRows = new Set(issues.map((item) => item.row_number).filter(Boolean)).size;
  const status = statusName({ issueCount: issues.length, filledRows, pendingRows, partialRows });
  const readyForSourceCompile = status === "ready_for_outcome_source_compile";

  return {
    ok: issues.length === 0,
    generated_at: generatedAt.toISOString(),
    mode: "north_star_outcome_preflight_local_only",
    status,
    input_path: input.path,
    input_kind: input.kind,
    owner_filled_exists: input.owner_filled_exists,
    template_ledger_path: TEMPLATE_LEDGER_PATH,
    filled_ledger_path: FILLED_LEDGER_PATH,
    expected_outcome_row_count: expectedRows.length,
    ledger_row_count: parsed.rows.length,
    filled_outcome_row_count: filledRows,
    pending_outcome_row_count: pendingRows,
    partial_outcome_row_count: partialRows,
    invalid_outcome_row_count: invalidRows,
    ready_for_source_compile: readyForSourceCompile,
    p1_event_types: OUTCOME_EVENTS,
    counts_by_event_type: summarizeReadyRows(rowResults, "event_type"),
    ready_rows_by_event_type: countReadyRows(rowResults, "event_type"),
    counts_by_target_file: summarizeReadyRows(rowResults, "target_live_file"),
    row_results: rowResults,
    issue_count: issues.length,
    warning_count: warnings.length,
    issues,
    warnings,
    next_safe_action: nextSafeAction(status),
    recommended_commands: readyForSourceCompile
      ? [
          "npm run source:compile",
          "npm run real-data:intake",
          "npm run source:trust",
          "npm run north-star",
          "npm run weekly:local",
        ]
      : [
          "open data_collection_progress.md",
          "open line_inbound_playbook.md",
          "npm run north-star:outcome-preflight",
        ],
    ...RED_LINE_FALSE,
    note: "Local North Star outcome preflight only. It validates the 24 P1 aggregate rows for link clicks, leads, deals, and quality flags before source compile; it never creates live input files, appends events, deploys, posts, pushes GitHub/LINE, mutates customer data, processes payments, or deletes data.",
  };
}

function validateHeaders(headers) {
  return REQUIRED_HEADERS
    .filter((header) => !headers.includes(header))
    .map((header) => issue(1, header, "missing_header", `Missing required source-capture ledger header: ${header}`));
}

function validateRow(row, rowNumber, expected) {
  const issues = [];
  const hasAnyOwnerValue = OWNER_REQUIRED_FIELDS.some((field) => String(row[field] ?? "").trim() !== "");
  if (!hasAnyOwnerValue) return issues;

  const countRaw = String(row.aggregate_count ?? "").trim();
  if (!/^(0|[1-9]\d*)$/.test(countRaw)) {
    issues.push(issue(rowNumber, "aggregate_count", "invalid_count", "aggregate_count must be a non-negative integer."));
  }

  for (const field of OWNER_REQUIRED_FIELDS) {
    if (!String(row[field] ?? "").trim()) {
      issues.push(issue(rowNumber, field, "missing_required_owner_field", `${field} is required when aggregate_count is filled.`));
    }
  }

  if (row.capture_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(row.capture_date).trim())) {
    issues.push(issue(rowNumber, "capture_date", "invalid_capture_date", "capture_date must be YYYY-MM-DD."));
  }

  for (const field of ["stage", "asset_id", "content_id", "variant_id", "tracking_link_id", "target_live_file"]) {
    if (String(row[field] ?? "").trim() !== String(expected[field] ?? "").trim()) {
      issues.push(issue(rowNumber, field, `${field}_mismatch`, `${field} must match expected value ${expected[field]}.`));
    }
  }

  if (row.target_live_file && !ALLOWED_TARGET_FILES.has(String(row.target_live_file).trim())) {
    issues.push(issue(rowNumber, "target_live_file", "invalid_target_live_file", "target_live_file must be data/funnel_aggregates.csv or data/manual_conversions.csv."));
  }

  if (row.stage && !OUTCOME_EVENTS.includes(String(row.stage).trim())) {
    issues.push(issue(rowNumber, "stage", "invalid_outcome_stage", `stage must be one of ${OUTCOME_EVENTS.join(", ")}.`));
  }

  if (row.pii_checked && !PII_CHECKED_VALUES.has(String(row.pii_checked).trim().toLowerCase())) {
    issues.push(issue(rowNumber, "pii_checked", "invalid_pii_checked", "pii_checked must be yes/true/checked/ok/1."));
  }

  const qualityScoreRaw = String(row.quality_score ?? "").trim();
  if (qualityScoreRaw && row.stage?.trim() !== "quality_flag") {
    issues.push(issue(rowNumber, "quality_score", "quality_score_not_allowed", "quality_score is only allowed for quality_flag rows."));
  }
  if (qualityScoreRaw) {
    const qualityScore = Number(qualityScoreRaw);
    if (!Number.isFinite(qualityScore) || qualityScore < 0 || qualityScore > 1) {
      issues.push(issue(rowNumber, "quality_score", "invalid_quality_score", "quality_score must be a number from 0 to 1."));
    }
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
  const values = OWNER_REQUIRED_FIELDS.map((field) => String(row[field] ?? "").trim());
  if (values.every((value) => value === "")) return "pending";
  if (values.every((value) => value !== "")) return "ready";
  return "partial";
}

function statusName({ issueCount, filledRows, pendingRows, partialRows }) {
  if (issueCount > 0) return "blocked_invalid_outcome_batch";
  if (pendingRows === 0 && partialRows === 0) return "ready_for_outcome_source_compile";
  if (filledRows > 0 || partialRows > 0) return "partial_outcome_batch_waiting";
  return "waiting_for_north_star_outcome_counts";
}

function nextSafeAction(status) {
  if (status === "ready_for_outcome_source_compile") {
    return "Run local source compile, real-data intake preview, source trust, North Star report, and weekly verification.";
  }
  if (status === "partial_outcome_batch_waiting") {
    return "Finish every remaining aggregate-only P1 outcome row in data/source_capture/source_capture_ledger.filled.csv, then rerun npm run north-star:outcome-preflight.";
  }
  if (status === "blocked_invalid_outcome_batch") {
    return "Fix invalid aggregate counts, mismatched tracking metadata, missing PII checks, or sensitive-looking values before source compile.";
  }
  return "Create a reviewed working copy from data/source_capture/source_capture_ledger.fill-template.csv, fill the 24 P1 outcome rows, then rerun npm run north-star:outcome-preflight.";
}

function projectExpected(row) {
  return {
    event_type: row.stage,
    stage_label: row.stage_label,
    asset_id: row.asset_id,
    content_id: row.content_id,
    variant_id: row.variant_id,
    tracking_link_id: row.tracking_link_id,
    target_live_file: row.target_live_file,
    source_surface: row.source_surface,
  };
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

function countReadyRows(rows, field) {
  const summary = {};
  for (const row of rows) {
    if (row.state !== "ready") continue;
    const key = row[field] ?? "unknown";
    summary[key] = (summary[key] ?? 0) + 1;
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
    expected_outcome_row_count: result.expected_outcome_row_count,
    ledger_row_count: result.ledger_row_count,
    filled_outcome_row_count: result.filled_outcome_row_count,
    pending_outcome_row_count: result.pending_outcome_row_count,
    partial_outcome_row_count: result.partial_outcome_row_count,
    invalid_outcome_row_count: result.invalid_outcome_row_count,
    ready_for_source_compile: result.ready_for_source_compile,
    p1_event_types: result.p1_event_types,
    counts_by_event_type: result.counts_by_event_type,
    ready_rows_by_event_type: result.ready_rows_by_event_type,
    issue_count: result.issue_count,
    warning_count: result.warning_count,
    next_safe_action: result.next_safe_action,
    ...RED_LINE_FALSE,
  };
}

function renderReport(result) {
  return `# 3Q Growth Loop North Star Outcome Preflight

BLUF: ${result.status}. ${result.next_safe_action}

Generated: ${result.generated_at}
Mode: ${result.mode}
Input: ${result.input_path}
Input kind: ${result.input_kind}
Owner-filled file exists: ${result.owner_filled_exists ? "yes" : "no"}
Ready for source compile: ${result.ready_for_source_compile ? "yes" : "no"}
Expected outcome rows: ${result.expected_outcome_row_count}
Filled outcome rows: ${result.filled_outcome_row_count}
Pending outcome rows: ${result.pending_outcome_row_count}
Partial outcome rows: ${result.partial_outcome_row_count}
Invalid outcome rows: ${result.invalid_outcome_row_count}
Issue count: ${result.issue_count}
Warning count: ${result.warning_count}
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

## Scope

This preflight covers the P1 North Star outcome rows that complete the funnel after the P0 sample gate:

- link_click: denominator for every 100 clicks
- lead_submit: qualified lead aggregate
- deal: owner-confirmed conversion aggregate
- quality_flag: no-quality-regression guard

P0 page_view, cta_click, and line_add rows stay governed by the sample-gate preflight.

## Row Status

| row | state | event | tracking link | asset | content | variant | target | count |
|---:|---|---|---|---|---|---|---|---:|
${result.row_results.map((row) => `| ${row.row_number ?? "-"} | ${row.state} | ${row.event_type} | ${row.tracking_link_id} | ${row.asset_id} | ${row.content_id} | ${row.variant_id} | ${row.target_live_file} | ${row.aggregate_count || ""} |`).join("\n")}

## Ready Counts By Event Type

| event_type | aggregate count | ready rows |
|---|---:|---:|
${OUTCOME_EVENTS.map((eventType) => `| ${eventType} | ${result.counts_by_event_type[eventType] ?? 0} | ${result.ready_rows_by_event_type[eventType] ?? 0} |`).join("\n")}

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
  return `${row.tracking_link_id}::${row.stage}`;
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
