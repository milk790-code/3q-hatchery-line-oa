import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OPTIONS = parseArgs(process.argv.slice(2));
const SOURCE_DIR = resolveProjectPath(OPTIONS.sourceDir, path.join(ROOT, "data", "source_capture"));
const TEMPLATE_LEDGER_PATH = resolveProjectPath(OPTIONS.template, path.join(SOURCE_DIR, "source_capture_ledger.fill-template.csv"));
const FILLED_LEDGER_PATH = resolveProjectPath(OPTIONS.filled, path.join(SOURCE_DIR, "source_capture_ledger.filled.csv"));
const OUTPUT_DIR = resolveProjectPath(OPTIONS.outputDir, path.join(SOURCE_DIR, "compiled"));
const FUNNEL_PREVIEW_PATH = resolveProjectPath(OPTIONS.funnelPreview, path.join(OUTPUT_DIR, "funnel_aggregates.owner-preview.csv"));
const MANUAL_PREVIEW_PATH = resolveProjectPath(OPTIONS.manualPreview, path.join(OUTPUT_DIR, "manual_conversions.owner-preview.csv"));
const STATUS_PATH = resolveProjectPath(OPTIONS.status, path.join(ROOT, "data", "source_capture_compile_status.json"));
const REPORT_PATH = resolveProjectPath(OPTIONS.report, path.join(ROOT, "source_capture_compile_report.md"));
const REAL_EVENTS_PATH = resolveProjectPath(OPTIONS.realEvents, path.join(ROOT, "data", "lp_events.jsonl"));

const FUNNEL_LIVE = "data/funnel_aggregates.csv";
const MANUAL_LIVE = "data/manual_conversions.csv";

const LEDGER_HEADERS = [
  "week_start",
  "week_end",
  "capture_date",
  "stage",
  "stage_label",
  "asset_id",
  "content_id",
  "variant_id",
  "tracking_link_id",
  "tracking_url",
  "source_surface",
  "source_metric",
  "target_template",
  "target_live_file",
  "aggregate_count",
  "evidence_ref",
  "reviewer",
  "pii_checked",
  "notes",
];

const OUTPUT_HEADERS = [
  "date",
  "asset_id",
  "event_type",
  "count",
  "source",
  "medium",
  "campaign",
  "content_id",
  "variant_id",
  "quality_score",
];

const ALLOWED_EVENT_TYPES = ["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"];
const ALLOWED_TARGET_FILES = [FUNNEL_LIVE, MANUAL_LIVE];
const PII_CHECKED_VALUES = new Set(["yes", "true", "checked", "ok", "1"]);

async function main() {
  const generatedAt = new Date();
  const input = await selectInput();
  const realEventsBefore = await countLines(REAL_EVENTS_PATH);
  let status;

  try {
    const raw = await readFile(input.path, "utf8");
    const parsed = parseCsv(raw);
    const headerIssues = validateHeaders(parsed.headers);
    const compileResult = headerIssues.length > 0
      ? emptyCompileResult(headerIssues)
      : compileRows(parsed.rows);

    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(FUNNEL_PREVIEW_PATH, renderCsv(compileResult.funnelRows));
    await writeFile(MANUAL_PREVIEW_PATH, renderCsv(compileResult.manualRows));

    const realEventsAfter = await countLines(REAL_EVENTS_PATH);
    const ok = compileResult.issues.length === 0;
    status = {
      ok,
      generated_at: generatedAt.toISOString(),
      mode: "source_capture_compile_preview",
      status: ok
        ? compileResult.filledRows.length > 0
          ? "owner_preview_ready"
          : "waiting_for_filled_counts"
        : "blocked_invalid_filled_ledger",
      input_path: input.path,
      input_kind: input.kind,
      template_ledger_path: TEMPLATE_LEDGER_PATH,
      filled_ledger_path: FILLED_LEDGER_PATH,
      report_path: REPORT_PATH,
      output_dir: OUTPUT_DIR,
      funnel_preview_path: FUNNEL_PREVIEW_PATH,
      manual_preview_path: MANUAL_PREVIEW_PATH,
      ledger_rows_read: parsed.rows.length,
      filled_rows: compileResult.filledRows.length,
      empty_rows: compileResult.emptyRows,
      funnel_rows: compileResult.funnelRows.length,
      manual_rows: compileResult.manualRows.length,
      issue_count: compileResult.issues.length,
      issues: compileResult.issues,
      warning_count: compileResult.warnings.length,
      warnings: compileResult.warnings,
      counts_by_event_type: compileResult.countsByEventType,
      counts_by_target_file: compileResult.countsByTargetFile,
      real_events_before: realEventsBefore,
      real_events_after: realEventsAfter,
      real_events_unchanged: realEventsBefore === realEventsAfter,
      owner_review_required: true,
      live_input_files_created: false,
      apply_performed: false,
      append_performed: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
    };
  } catch (error) {
    const realEventsAfter = await countLines(REAL_EVENTS_PATH);
    status = {
      ok: false,
      generated_at: generatedAt.toISOString(),
      mode: "source_capture_compile_preview",
      status: "blocked_invalid_filled_ledger",
      input_path: input.path,
      input_kind: input.kind,
      template_ledger_path: TEMPLATE_LEDGER_PATH,
      filled_ledger_path: FILLED_LEDGER_PATH,
      report_path: REPORT_PATH,
      output_dir: OUTPUT_DIR,
      funnel_preview_path: FUNNEL_PREVIEW_PATH,
      manual_preview_path: MANUAL_PREVIEW_PATH,
      ledger_rows_read: 0,
      filled_rows: 0,
      empty_rows: 0,
      funnel_rows: 0,
      manual_rows: 0,
      issue_count: 1,
      issues: [{ row_number: null, field: "input", message: error instanceof Error ? error.message : "unknown_error" }],
      warning_count: 0,
      warnings: [],
      counts_by_event_type: {},
      counts_by_target_file: {},
      real_events_before: realEventsBefore,
      real_events_after: realEventsAfter,
      real_events_unchanged: realEventsBefore === realEventsAfter,
      owner_review_required: true,
      live_input_files_created: false,
      apply_performed: false,
      append_performed: false,
      data_lp_events_write_performed: false,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
    };
  }

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

async function selectInput() {
  if (OPTIONS.input) {
    return { path: resolveProjectPath(OPTIONS.input, OPTIONS.input), kind: OPTIONS.inputKind ?? "custom" };
  }
  if (await exists(FILLED_LEDGER_PATH)) {
    return { path: FILLED_LEDGER_PATH, kind: "filled" };
  }
  return { path: TEMPLATE_LEDGER_PATH, kind: "template" };
}

function parseArgs(args) {
  const options = {};

  for (const arg of args) {
    if (arg.startsWith("--input=")) options.input = arg.slice("--input=".length);
    if (arg.startsWith("--input-kind=")) options.inputKind = arg.slice("--input-kind=".length);
    if (arg.startsWith("--source-dir=")) options.sourceDir = arg.slice("--source-dir=".length);
    if (arg.startsWith("--template=")) options.template = arg.slice("--template=".length);
    if (arg.startsWith("--filled=")) options.filled = arg.slice("--filled=".length);
    if (arg.startsWith("--output-dir=")) options.outputDir = arg.slice("--output-dir=".length);
    if (arg.startsWith("--funnel-preview=")) options.funnelPreview = arg.slice("--funnel-preview=".length);
    if (arg.startsWith("--manual-preview=")) options.manualPreview = arg.slice("--manual-preview=".length);
    if (arg.startsWith("--status=")) options.status = arg.slice("--status=".length);
    if (arg.startsWith("--report=")) options.report = arg.slice("--report=".length);
    if (arg.startsWith("--real-events=")) options.realEvents = arg.slice("--real-events=".length);
  }

  return options;
}

function resolveProjectPath(value, fallback) {
  if (!value) return fallback;
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function emptyCompileResult(issues) {
  return {
    filledRows: [],
    emptyRows: 0,
    funnelRows: [],
    manualRows: [],
    issues,
    warnings: [],
    countsByEventType: {},
    countsByTargetFile: {},
  };
}

function validateHeaders(headers) {
  const issues = [];
  for (const header of LEDGER_HEADERS) {
    if (!headers.includes(header)) {
      issues.push({ row_number: 1, field: header, message: `Missing required ledger header: ${header}` });
    }
  }
  return issues;
}

function compileRows(rows) {
  const result = {
    filledRows: [],
    emptyRows: 0,
    funnelRows: [],
    manualRows: [],
    issues: [],
    warnings: [],
    countsByEventType: {},
    countsByTargetFile: {},
  };

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const countRaw = String(row.aggregate_count ?? "").trim();
    const partialFields = ["capture_date", "evidence_ref", "reviewer", "pii_checked"].filter((key) => String(row[key] ?? "").trim() !== "");

    if (!countRaw) {
      result.emptyRows += 1;
      if (partialFields.length > 0) {
        result.warnings.push({
          row_number: rowNumber,
          field: "aggregate_count",
          message: `Row has ${partialFields.join(", ")} but no aggregate_count, so it was skipped.`,
        });
      }
      return;
    }

    const rowIssues = validateFilledRow(row, rowNumber, countRaw);
    result.issues.push(...rowIssues);
    if (rowIssues.length > 0) {
      return;
    }

    const count = Number(countRaw);
    const outputRow = {
      date: row.capture_date.trim(),
      asset_id: row.asset_id.trim(),
      event_type: row.stage.trim(),
      count: String(count),
      ...utmFromTrackingUrl(row.tracking_url, row.week_start),
      content_id: row.content_id.trim(),
      variant_id: row.variant_id.trim(),
      quality_score: row.stage.trim() === "quality_flag" ? String(row.quality_score ?? "").trim() : "",
    };

    result.filledRows.push(row);
    result.countsByEventType[outputRow.event_type] = (result.countsByEventType[outputRow.event_type] ?? 0) + count;
    result.countsByTargetFile[row.target_live_file] = (result.countsByTargetFile[row.target_live_file] ?? 0) + count;

    if (row.target_live_file === FUNNEL_LIVE) {
      result.funnelRows.push(outputRow);
    } else {
      result.manualRows.push(outputRow);
    }
  });

  return result;
}

function validateFilledRow(row, rowNumber, countRaw) {
  const issues = [];
  const required = ["capture_date", "stage", "asset_id", "content_id", "variant_id", "target_live_file", "evidence_ref", "pii_checked"];

  for (const field of required) {
    if (!String(row[field] ?? "").trim()) {
      issues.push({ row_number: rowNumber, field, message: `${field} is required when aggregate_count is filled.` });
    }
  }

  if (!/^(0|[1-9]\d*)$/.test(countRaw)) {
    issues.push({ row_number: rowNumber, field: "aggregate_count", message: "aggregate_count must be a non-negative integer." });
  }

  if (row.capture_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.capture_date.trim())) {
    issues.push({ row_number: rowNumber, field: "capture_date", message: "capture_date must be YYYY-MM-DD." });
  }

  if (row.stage && !ALLOWED_EVENT_TYPES.includes(row.stage.trim())) {
    issues.push({ row_number: rowNumber, field: "stage", message: `stage must be one of ${ALLOWED_EVENT_TYPES.join(", ")}.` });
  }

  if (row.target_live_file && !ALLOWED_TARGET_FILES.includes(row.target_live_file.trim())) {
    issues.push({ row_number: rowNumber, field: "target_live_file", message: `target_live_file must be ${ALLOWED_TARGET_FILES.join(" or ")}.` });
  }

  if (row.pii_checked && !PII_CHECKED_VALUES.has(row.pii_checked.trim().toLowerCase())) {
    issues.push({ row_number: rowNumber, field: "pii_checked", message: "pii_checked must be yes/true/checked/ok/1." });
  }

  const qualityScoreRaw = String(row.quality_score ?? "").trim();
  if (qualityScoreRaw && row.stage?.trim() !== "quality_flag") {
    issues.push({ row_number: rowNumber, field: "quality_score", message: "quality_score is only allowed for quality_flag rows." });
  }

  if (qualityScoreRaw) {
    const qualityScore = Number(qualityScoreRaw);
    if (!Number.isFinite(qualityScore) || qualityScore < 0 || qualityScore > 1) {
      issues.push({ row_number: rowNumber, field: "quality_score", message: "quality_score must be a number from 0 to 1." });
    }
  }

  for (const field of ["evidence_ref", "reviewer"]) {
    const sensitive = sensitiveMatch(row[field] ?? "");
    if (sensitive) {
      issues.push({
        row_number: rowNumber,
        field,
        message: `Sensitive-looking ${sensitive} detected. Use aggregate evidence refs only, never customer identifiers.`,
      });
    }
  }

  return issues;
}

function sensitiveMatch(value) {
  const text = String(value);
  if (!text) return null;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) return "email";
  if (/\b(?:\+?886[- ]?)?0?9\d{2}[- ]?\d{3}[- ]?\d{3}\b/.test(text)) return "phone";
  if (/\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}\b/.test(text)) return "card-like number";
  if (/\bline[_ -]?user[_ -]?id\b/i.test(text)) return "LINE user id";
  return null;
}

function utmFromTrackingUrl(value, weekStart) {
  const fallback = {
    source: "source_capture",
    medium: "manual_review",
    campaign: weekStart || "unknown_week",
  };

  try {
    const url = new URL(value);
    return {
      source: url.searchParams.get("utm_source") || fallback.source,
      medium: url.searchParams.get("utm_medium") || fallback.medium,
      campaign: url.searchParams.get("utm_campaign") || fallback.campaign,
    };
  } catch {
    return fallback;
  }
}

function parseCsv(raw) {
  const rows = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);

  if (rows.length === 0) {
    throw new Error("CSV is empty.");
  }

  const headers = rows[0].map((header) => header.trim());
  const dataRows = rows.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(`CSV row ${rowIndex + 2} has ${values.length} columns; expected ${headers.length}.`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index].trim()]));
  });

  return { headers, rows: dataRows };
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

function renderCsv(rows) {
  return `${OUTPUT_HEADERS.join(",")}\n${rows.map((row) => OUTPUT_HEADERS.map((header) => csvEscape(row[header] ?? "")).join(",")).join("\n")}${rows.length > 0 ? "\n" : ""}`;
}

function renderReport(status) {
  const issueRows = status.issues.length > 0
    ? status.issues.map((issue) => `| ${issue.row_number ?? "n/a"} | ${issue.field ?? "n/a"} | ${issue.message} |`).join("\n")
    : "| none | none | none |";
  const warningRows = status.warnings.length > 0
    ? status.warnings.map((warning) => `| ${warning.row_number ?? "n/a"} | ${warning.field ?? "n/a"} | ${warning.message} |`).join("\n")
    : "| none | none | none |";

  return `# 3Q Growth Loop Source Capture Compile Preview

BLUF: This is an owner-preview compiler for filled aggregate source-capture ledgers. It creates reviewed CSV candidates only; it does not create live input files, score rows, append data/lp_events.jsonl, deploy, post, push LINE, touch customer data, process payments, or delete data.

Generated: ${status.generated_at}
Mode: ${status.mode}
Status: ${status.status}
Input kind: ${status.input_kind}
Input: ${relative(status.input_path)}
Filled rows: ${status.filled_rows}
Empty rows: ${status.empty_rows}
Funnel preview rows: ${status.funnel_rows}
Manual preview rows: ${status.manual_rows}
Issues: ${status.issue_count}
Warnings: ${status.warning_count}
Live input files created: no
data/lp_events.jsonl write performed: no
External effect: no

## Preview Artifacts

- Funnel preview: ${relative(status.funnel_preview_path)}
- Manual preview: ${relative(status.manual_preview_path)}
- Status: ${relative(STATUS_PATH)}
- Report: ${relative(REPORT_PATH)}

## If Counts Are Missing

Copy the template to the owner-filled path, fill aggregate counts and evidence, then rerun:

\`\`\`zsh
cp data/source_capture/source_capture_ledger.fill-template.csv data/source_capture/source_capture_ledger.filled.csv
npm run source:compile
\`\`\`

Fill only aggregate_count, capture_date, evidence_ref, reviewer, and pii_checked. Keep customer names, phone, email, LINE user IDs, chat text, payment data, order IDs, refund data, and private notes out of the ledger.

For \`quality_flag\` rows only, \`quality_score\` may be filled as an aggregate score from 0 to 1. Use \`0\` for low-quality/spam flags and \`1\` for normal-quality flags when the quality guard needs to be tested.

## Owner Review Rule

The compiled files are owner-preview only. Copy them to live CSV names only after review:

- ${relative(FUNNEL_PREVIEW_PATH)} -> data/funnel_aggregates.csv
- ${relative(MANUAL_PREVIEW_PATH)} -> data/manual_conversions.csv

Then run \`npm run real-data:intake\` before any local apply.

## Issues

| row | field | message |
|---|---|---|
${issueRows}

## Warnings

| row | field | message |
|---|---|---|
${warningRows}
`;
}

async function countLines(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw.split(/\r?\n/).filter((line) => line.trim()).length;
  } catch {
    return 0;
  }
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

function csvEscape(value) {
  const stringValue = String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function relative(filePath) {
  return path.relative(ROOT, filePath);
}

main();
