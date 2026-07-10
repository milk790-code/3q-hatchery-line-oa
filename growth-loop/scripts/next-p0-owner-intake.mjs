import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OPTIONS = parseArgs(process.argv.slice(2));
const NEXT_P0_INPUTS_PATH = resolveProjectPath(OPTIONS.nextP0, path.join(ROOT, "next_p0_owner_inputs.json"));
const SOURCE_LEDGER_TEMPLATE_PATH = resolveProjectPath(
  OPTIONS.sourceLedger,
  path.join(ROOT, "data", "source_capture", "source_capture_ledger.fill-template.csv"),
);
const STATUS_PATH = resolveProjectPath(OPTIONS.status, path.join(ROOT, "data", "next_p0_owner_intake_status.json"));
const REPORT_PATH = resolveProjectPath(OPTIONS.report, path.join(ROOT, "next_p0_owner_intake.md"));
const OUTPUT_DIR = resolveProjectPath(OPTIONS.outputDir, path.join(ROOT, "data", "next_p0_owner_intake"));
const FUNNEL_PREVIEW_PATH = resolveProjectPath(OPTIONS.funnelPreview, path.join(OUTPUT_DIR, "funnel_aggregates.owner-preview.csv"));
const MANUAL_PREVIEW_PATH = resolveProjectPath(OPTIONS.manualPreview, path.join(OUTPUT_DIR, "manual_conversions.owner-preview.csv"));
const FUNNEL_LIVE_PATH = resolveProjectPath(OPTIONS.funnelLive, path.join(ROOT, "data", "funnel_aggregates.csv"));
const MANUAL_LIVE_PATH = resolveProjectPath(OPTIONS.manualLive, path.join(ROOT, "data", "manual_conversions.csv"));
const REAL_EVENTS_PATH = resolveProjectPath(OPTIONS.realEvents, path.join(ROOT, "data", "lp_events.jsonl"));
const PROJECT_INBOX_PATH = resolveProjectPath(
  OPTIONS.projectInbox,
  path.join(ROOT, "data", "source_capture", "inbox", "next_p0_owner_inputs.filled.csv"),
);
const QUICK_PREVIEW_PATH = resolveProjectPath(
  OPTIONS.quickPreview,
  path.join(ROOT, "data", "next_p0_quick_capture", "next_p0_owner_inputs.quick-filled.preview.csv"),
);
const DOWNLOADS_PATH = path.join(os.homedir(), "Downloads", "next_p0_owner_inputs.filled.csv");

const EXPORT_HEADERS = [
  "rank",
  "capture_date",
  "role",
  "tracking_link_id",
  "event_type",
  "stage_label",
  "source_surface",
  "target_live_file",
  "aggregate_count",
  "evidence_ref",
  "reviewer",
  "pii_checked",
];

const PREVIEW_HEADERS = [
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
  "quality_score",
  "evidence_ref",
  "reviewer",
  "pii_checked",
  "notes",
];

const PII_CHECKED_VALUES = new Set(["yes", "true", "checked", "ok", "1"]);
const RED_LINE_FALSE = {
  data_lp_events_write_performed: false,
  public_link_change_performed: false,
  production_deploy_performed: false,
  github_push_or_pr_performed: false,
  formal_post_performed: false,
  line_push_performed: false,
  customer_data_mutation_performed: false,
  payment_action_performed: false,
  delete_action_performed: false,
  external_effect: false,
};

async function main() {
  const generatedAt = new Date();
  const realEventsBefore = await countLines(REAL_EVENTS_PATH);
  const nextP0 = await readJson(NEXT_P0_INPUTS_PATH);
  const candidate = await selectCandidate();

  let status;
  if (!candidate) {
    status = await waitingStatus({ generatedAt, nextP0, realEventsBefore });
  } else {
    status = await inspectCandidate({ generatedAt, nextP0, candidate, realEventsBefore });
  }

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (OPTIONS.stage && !status.stage_performed) {
    process.exitCode = 1;
  }
  if (!status.ok) {
    process.exitCode = 1;
  }
}

async function inspectCandidate({ generatedAt, nextP0, candidate, realEventsBefore }) {
  const raw = await readFile(candidate.path, "utf8");
  const parsed = parseCsv(raw);
  const expectedRows = Array.isArray(nextP0.inputs) ? nextP0.inputs : [];
  const sourceTemplate = parseCsv(await readFile(SOURCE_LEDGER_TEMPLATE_PATH, "utf8"));
  const validation = validateDownload(parsed, expectedRows);
  const ledgerRows = validation.ok ? buildLedgerRows(parsed.rows, expectedRows, sourceTemplate.rows) : [];
  const previewRows = ledgerRows.map(toPreviewRow);
  const funnelRows = previewRows.filter((row) => row.target_live_file === "data/funnel_aggregates.csv");
  const manualRows = previewRows.filter((row) => row.target_live_file === "data/manual_conversions.csv");

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(FUNNEL_PREVIEW_PATH, renderCsv(PREVIEW_HEADERS, funnelRows));
  await writeFile(MANUAL_PREVIEW_PATH, renderCsv(PREVIEW_HEADERS, manualRows));

  const stage = await maybeStage({ validation, funnelRows, manualRows });
  const realEventsAfter = await countLines(REAL_EVENTS_PATH);
  const ok = validation.ok && (!OPTIONS.stage || stage.performed);
  return {
    ok,
    generated_at: generatedAt.toISOString(),
    mode: "next_p0_owner_intake",
    status: statusName(validation, stage),
    candidate_found: true,
    candidate_valid: validation.ok,
    candidate_path: candidate.path,
    candidate_source: candidate.source,
    candidate_paths_checked: candidatePaths().map((item) => item.path),
    candidate_sha256: createHash("sha256").update(raw).digest("hex"),
    candidate_bytes: raw.length,
    expected_row_count: expectedRows.length,
    downloaded_row_count: parsed.rows.length,
    filled_rows: validation.filledRows,
    issue_count: validation.issues.length,
    issues: validation.issues,
    warning_count: validation.warnings.length,
    warnings: validation.warnings,
    output_dir: OUTPUT_DIR,
    funnel_preview_path: FUNNEL_PREVIEW_PATH,
    manual_preview_path: MANUAL_PREVIEW_PATH,
    funnel_preview_rows: funnelRows.length,
    manual_preview_rows: manualRows.length,
    counts_by_event_type: countBy(previewRows, "event_type", "count"),
    counts_by_target_live_file: countBy(previewRows, "target_live_file", "count"),
    stage_requested: OPTIONS.stage === true,
    confirm_owner_reviewed: OPTIONS.confirmOwnerReviewed === true,
    stage_performed: stage.performed,
    stage_blocked_reason: stage.blockedReason,
    stage_outputs: stage.outputs,
    live_input_files_created: stage.performed,
    real_events_before: realEventsBefore,
    real_events_after: realEventsAfter,
    real_events_unchanged: realEventsBefore === realEventsAfter,
    next_safe_action: nextSafeAction(validation, stage, candidate),
    ...RED_LINE_FALSE,
    note: "Local focused Next P0 owner-download intake. It validates aggregate-only CSV downloads and creates owner-preview CSVs. Weekly runs never stage live inputs or append data/lp_events.jsonl.",
  };
}

async function waitingStatus({ generatedAt, nextP0, realEventsBefore }) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(FUNNEL_PREVIEW_PATH, renderCsv(PREVIEW_HEADERS, []));
  await writeFile(MANUAL_PREVIEW_PATH, renderCsv(PREVIEW_HEADERS, []));
  const realEventsAfter = await countLines(REAL_EVENTS_PATH);
  return {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "next_p0_owner_intake",
    status: "waiting_for_next_p0_owner_download",
    candidate_found: false,
    candidate_valid: false,
    candidate_paths_checked: candidatePaths().map((item) => item.path),
    expected_row_count: Array.isArray(nextP0.inputs) ? nextP0.inputs.length : 0,
    downloaded_row_count: 0,
    filled_rows: 0,
    issue_count: 0,
    issues: [],
    warning_count: 0,
    warnings: [],
    output_dir: OUTPUT_DIR,
    funnel_preview_path: FUNNEL_PREVIEW_PATH,
    manual_preview_path: MANUAL_PREVIEW_PATH,
    funnel_preview_rows: 0,
    manual_preview_rows: 0,
    counts_by_event_type: {},
    counts_by_target_live_file: {},
    stage_requested: OPTIONS.stage === true,
    confirm_owner_reviewed: OPTIONS.confirmOwnerReviewed === true,
    stage_performed: false,
    stage_blocked_reason: null,
    stage_outputs: [],
    live_input_files_created: false,
    real_events_before: realEventsBefore,
    real_events_after: realEventsAfter,
    real_events_unchanged: realEventsBefore === realEventsAfter,
    next_safe_action: "Fill the quick paste template completely, download next_p0_owner_inputs.filled.csv from next_p0_owner_form.html, place a reviewed file in data/source_capture/inbox/, or rerun with --input=<path>.",
    ...RED_LINE_FALSE,
    note: "No focused Next P0 owner download was found. This is a safe waiting state.",
  };
}

function validateDownload(parsed, expectedRows) {
  const issues = [];
  const warnings = [];
  const missingHeaders = EXPORT_HEADERS.filter((header) => !parsed.headers.includes(header));
  const unknownHeaders = parsed.headers.filter((header) => !EXPORT_HEADERS.includes(header));
  if (missingHeaders.length > 0) {
    issues.push(issue(null, "headers", `Missing required headers: ${missingHeaders.join(", ")}`));
  }
  if (unknownHeaders.length > 0) {
    issues.push(issue(null, "headers", `Unknown headers are not allowed: ${unknownHeaders.join(", ")}`));
  }
  if (parsed.rows.length !== expectedRows.length) {
    issues.push(issue(null, "row_count", `Expected ${expectedRows.length} rows, got ${parsed.rows.length}.`));
  }

  const expectedByRank = new Map(expectedRows.map((row) => [String(row.rank), row]));
  const seen = new Set();
  let filledRows = 0;

  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const expected = expectedByRank.get(String(row.rank ?? "").trim());
    if (!expected) {
      issues.push(issue(rowNumber, "rank", `Unknown rank ${row.rank}.`));
      return;
    }

    const key = `${row.rank}|${row.tracking_link_id}|${row.event_type}`;
    if (seen.has(key)) {
      issues.push(issue(rowNumber, "rank", `Duplicate row key ${key}.`));
    }
    seen.add(key);

    for (const [field, expectedValue] of [
      ["role", expected.role],
      ["tracking_link_id", expected.tracking_link_id],
      ["event_type", expected.event_type],
      ["stage_label", expected.stage_label],
      ["source_surface", expected.source_surface],
      ["target_live_file", expected.target_live_file],
    ]) {
      if (String(row[field] ?? "").trim() !== String(expectedValue ?? "").trim()) {
        issues.push(issue(rowNumber, field, `${field} must match next_p0_owner_inputs.json.`));
      }
    }

    for (const field of ["capture_date", "aggregate_count", "evidence_ref", "reviewer", "pii_checked"]) {
      if (!String(row[field] ?? "").trim()) {
        issues.push(issue(rowNumber, field, `${field} is required.`));
      }
    }

    if (row.capture_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.capture_date.trim())) {
      issues.push(issue(rowNumber, "capture_date", "capture_date must be YYYY-MM-DD."));
    }

    const countRaw = String(row.aggregate_count ?? "").trim();
    if (!/^(0|[1-9]\d*)$/.test(countRaw)) {
      issues.push(issue(rowNumber, "aggregate_count", "aggregate_count must be a non-negative integer."));
    } else {
      filledRows += 1;
    }

    if (!PII_CHECKED_VALUES.has(String(row.pii_checked ?? "").trim().toLowerCase())) {
      issues.push(issue(rowNumber, "pii_checked", "pii_checked must be yes/true/checked/ok/1."));
    }

    for (const field of ["evidence_ref", "reviewer"]) {
      const sensitive = sensitiveMatch(row[field] ?? "");
      if (sensitive) {
        issues.push(issue(rowNumber, field, `Sensitive-looking ${sensitive} detected. Use aggregate evidence refs only.`));
      }
    }

    if (Number(countRaw) === 0) {
      warnings.push(issue(rowNumber, "aggregate_count", "Zero count is allowed, but review whether the source truly had no activity."));
    }
  });

  return {
    ok: issues.length === 0,
    filledRows,
    issues,
    warnings,
  };
}

function buildLedgerRows(downloadRows, expectedRows, templateRows) {
  return downloadRows.map((downloadRow) => {
    const expected = expectedRows.find((row) => String(row.rank) === String(downloadRow.rank).trim());
    const template = templateRows.find((row) =>
      row.tracking_link_id === expected.tracking_link_id && row.stage === expected.event_type
    );
    if (!template) {
      throw new Error(`Missing source ledger template for ${expected.tracking_link_id}/${expected.event_type}`);
    }
    return {
      ...template,
      capture_date: downloadRow.capture_date.trim(),
      stage: expected.event_type,
      stage_label: expected.stage_label,
      source_surface: expected.source_surface,
      target_live_file: expected.target_live_file,
      aggregate_count: downloadRow.aggregate_count.trim(),
      quality_score: "",
      evidence_ref: downloadRow.evidence_ref.trim(),
      reviewer: downloadRow.reviewer.trim(),
      pii_checked: downloadRow.pii_checked.trim(),
      notes: template.notes || expected.evidence_rule || "",
    };
  });
}

function toPreviewRow(row) {
  const url = new URL(row.tracking_url);
  return {
    date: row.capture_date,
    asset_id: row.asset_id,
    event_type: row.stage,
    count: row.aggregate_count,
    source: url.searchParams.get("utm_source") ?? "manual_review",
    medium: url.searchParams.get("utm_medium") ?? "growth_loop",
    campaign: url.searchParams.get("utm_campaign") ?? "",
    content_id: row.content_id,
    variant_id: row.variant_id,
    quality_score: row.quality_score ?? "",
    target_live_file: row.target_live_file,
  };
}

async function maybeStage({ validation, funnelRows, manualRows }) {
  if (!OPTIONS.stage) {
    return { performed: false, blockedReason: null, outputs: [] };
  }
  if (!validation.ok) {
    return { performed: false, blockedReason: "candidate_validation_failed", outputs: [] };
  }
  if (!OPTIONS.confirmOwnerReviewed) {
    return { performed: false, blockedReason: "stage_requires_confirm_owner_reviewed", outputs: [] };
  }

  const liveExists = [];
  for (const filePath of [FUNNEL_LIVE_PATH, MANUAL_LIVE_PATH]) {
    if (await exists(filePath)) liveExists.push(filePath);
  }
  if (liveExists.length > 0 && !OPTIONS.replaceLive) {
    return { performed: false, blockedReason: `live_input_exists:${liveExists.map(relative).join(",")}`, outputs: [] };
  }

  await mkdir(path.dirname(FUNNEL_LIVE_PATH), { recursive: true });
  await mkdir(path.dirname(MANUAL_LIVE_PATH), { recursive: true });
  await writeFile(FUNNEL_LIVE_PATH, renderCsv(PREVIEW_HEADERS, funnelRows));
  await writeFile(MANUAL_LIVE_PATH, renderCsv(PREVIEW_HEADERS, manualRows));
  return {
    performed: true,
    blockedReason: null,
    outputs: [FUNNEL_LIVE_PATH, MANUAL_LIVE_PATH].map(relative),
  };
}

function statusName(validation, stage) {
  if (!validation.ok) return "blocked_invalid_next_p0_owner_download";
  if (!OPTIONS.stage) return "next_p0_owner_download_preview_ready";
  if (stage.performed) return "next_p0_owner_download_staged_local_inputs";
  if (stage.blockedReason === "stage_requires_confirm_owner_reviewed") return "next_p0_owner_download_ready_needs_confirmed_stage";
  if (String(stage.blockedReason ?? "").startsWith("live_input_exists:")) return "next_p0_owner_download_stage_blocked_live_inputs_exist";
  return "blocked_invalid_next_p0_owner_download";
}

function nextSafeAction(validation, stage, candidate = null) {
  if (!validation.ok) {
    return "Fix the focused CSV or regenerate it from next_p0_owner_form.html. Keep aggregate counts only and remove sensitive values.";
  }
  if (!OPTIONS.stage) {
    const inputHint = candidate?.source === "quick_preview"
      ? ""
      : " --input=<path>";
    return `Review next_p0_owner_intake.md, then either keep the owner-preview CSVs for review or stage local inputs with next-p0:intake --${inputHint} --stage --confirm-owner-reviewed.`;
  }
  if (stage.performed) {
    return "Run npm run real-data:intake, then owner-reviewed apply commands, then npm run weekly:local to rescore.";
  }
  if (stage.blockedReason === "stage_requires_confirm_owner_reviewed") {
    return "Re-run with --confirm-owner-reviewed after reviewing the aggregate CSV.";
  }
  if (String(stage.blockedReason ?? "").startsWith("live_input_exists:")) {
    return "Existing live input CSVs are present. Review them before replacing; rerun with --replace-live only when intentional.";
  }
  return "Review the status and rerun after fixing the owner download.";
}

async function selectCandidate() {
  for (const candidate of candidatePaths()) {
    if (!(await exists(candidate.path))) continue;
    if (candidate.skipIfHeaderOnly && await csvHasOnlyHeader(candidate.path)) continue;
    return candidate;
  }
  return null;
}

function candidatePaths() {
  if (OPTIONS.input) {
    return [{ path: resolveProjectPath(OPTIONS.input), source: "explicit_input" }];
  }
  const candidates = [
    { path: PROJECT_INBOX_PATH, source: "project_inbox" },
    { path: QUICK_PREVIEW_PATH, source: "quick_preview", skipIfHeaderOnly: true },
  ];
  if (!OPTIONS.noDownloads) {
    candidates.push({ path: DOWNLOADS_PATH, source: "downloads" });
  }
  return candidates;
}

function parseArgs(args) {
  const options = {
    input: null,
    noDownloads: false,
    nextP0: null,
    sourceLedger: null,
    status: null,
    report: null,
    outputDir: null,
    funnelPreview: null,
    manualPreview: null,
    funnelLive: null,
    manualLive: null,
    realEvents: null,
    projectInbox: null,
    quickPreview: null,
    stage: false,
    confirmOwnerReviewed: false,
    replaceLive: false,
  };
  for (const arg of args) {
    if (arg.startsWith("--input=")) options.input = arg.slice("--input=".length);
    if (arg === "--no-downloads") options.noDownloads = true;
    if (arg.startsWith("--next-p0=")) options.nextP0 = arg.slice("--next-p0=".length);
    if (arg.startsWith("--source-ledger=")) options.sourceLedger = arg.slice("--source-ledger=".length);
    if (arg.startsWith("--status=")) options.status = arg.slice("--status=".length);
    if (arg.startsWith("--report=")) options.report = arg.slice("--report=".length);
    if (arg.startsWith("--output-dir=")) options.outputDir = arg.slice("--output-dir=".length);
    if (arg.startsWith("--funnel-preview=")) options.funnelPreview = arg.slice("--funnel-preview=".length);
    if (arg.startsWith("--manual-preview=")) options.manualPreview = arg.slice("--manual-preview=".length);
    if (arg.startsWith("--funnel-live=")) options.funnelLive = arg.slice("--funnel-live=".length);
    if (arg.startsWith("--manual-live=")) options.manualLive = arg.slice("--manual-live=".length);
    if (arg.startsWith("--real-events=")) options.realEvents = arg.slice("--real-events=".length);
    if (arg.startsWith("--project-inbox=")) options.projectInbox = arg.slice("--project-inbox=".length);
    if (arg.startsWith("--quick-preview=")) options.quickPreview = arg.slice("--quick-preview=".length);
    if (arg === "--stage") options.stage = true;
    if (arg === "--confirm-owner-reviewed") options.confirmOwnerReviewed = true;
    if (arg === "--replace-live") options.replaceLive = true;
  }
  return options;
}

function parseCsv(raw) {
  const rows = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
  if (rows.length === 0) throw new Error("CSV is empty.");
  const headers = rows[0].map((header) => header.trim());
  return {
    headers,
    rows: rows.slice(1).map((values, rowIndex) => {
      if (values.length !== headers.length) {
        throw new Error(`CSV row ${rowIndex + 2} has ${values.length} columns; expected ${headers.length}.`);
      }
      return Object.fromEntries(headers.map((header, index) => [header, values[index].trim()]));
    }),
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
  if (quoted) throw new Error("CSV has an unterminated quoted cell.");
  cells.push(current);
  return cells;
}

function renderCsv(headers, rows) {
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")).join("\n")}${rows.length > 0 ? "\n" : ""}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function countBy(rows, key, valueKey) {
  return rows.reduce((acc, row) => {
    const label = row[key] ?? "unknown";
    const amount = Number(row[valueKey] ?? 1);
    acc[label] = (acc[label] ?? 0) + (Number.isFinite(amount) ? amount : 0);
    return acc;
  }, {});
}

function sensitiveMatch(value) {
  const text = String(value);
  if (!text) return null;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) return "email";
  if (/\b(?:\+?886[- ]?)?0?9\d{2}[- ]?\d{3}[- ]?\d{3}\b/.test(text)) return "phone";
  if (/\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}\b/.test(text)) return "card-like number";
  if (/\bline[_ -]?user[_ -]?id\b/i.test(text)) return "LINE user id";
  if (/\b(order|payment|refund)[-_ ]?id\b/i.test(text)) return "order/payment/refund id";
  if (/[姓名暱稱聊天對話訂單付款退款]/.test(text)) return "customer/private text";
  return null;
}

function issue(rowNumber, field, message) {
  return { row_number: rowNumber, field, message, external_effect: false };
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

async function csvHasOnlyHeader(filePath) {
  const raw = await readFile(filePath, "utf8");
  return raw.split(/\r?\n/).filter((line) => line.trim()).length <= 1;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function resolveProjectPath(value, fallback = value) {
  if (!value) return fallback;
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function relative(filePath) {
  return path.relative(ROOT, filePath);
}

function renderReport(status) {
  const issueRows = status.issues.length > 0
    ? status.issues.map((item) => `| ${item.row_number ?? "n/a"} | ${item.field} | ${item.message} |`).join("\n")
    : "| - | - | none |";
  const previewRows = Object.entries(status.counts_by_event_type ?? {})
    .map(([eventType, count]) => `| ${eventType} | ${count} |`)
    .join("\n") || "| - | 0 |";

  return `# 3Q Growth Loop Next P0 Owner Intake

BLUF: ${status.status}. This local guard validates the focused Next P0 owner download and converts it into owner-preview aggregate CSVs without staging or scoring by default.

Generated: ${status.generated_at}
Mode: ${status.mode}
Status: ${status.status}
Candidate found: ${status.candidate_found ? "yes" : "no"}
Candidate valid: ${status.candidate_valid ? "yes" : "no"}
Candidate source: ${status.candidate_source ?? "n/a"}
Candidate path: ${status.candidate_path ?? "n/a"}
Expected rows: ${status.expected_row_count}
Downloaded rows: ${status.downloaded_row_count}
Filled rows: ${status.filled_rows}
Stage requested: ${status.stage_requested ? "yes" : "no"}
Stage performed: ${status.stage_performed ? "yes" : "no"}
Stage blocked reason: ${status.stage_blocked_reason ?? "n/a"}
data/lp_events.jsonl write performed: no
External effect: no

## Preview Outputs

- Funnel preview: ${status.funnel_preview_path}
- Manual preview: ${status.manual_preview_path}
- Funnel rows: ${status.funnel_preview_rows}
- Manual rows: ${status.manual_preview_rows}

## Event Counts

| event_type | aggregate count |
|---|---:|
${previewRows}

## Issues

| row | field | message |
|---:|---|---|
${issueRows}

## Next Safe Action

${status.next_safe_action}

## Rules

- The weekly runner only validates and previews focused owner downloads.
- Staging live local CSVs requires \`--stage --confirm-owner-reviewed\`.
- Existing live CSVs are not replaced unless \`--replace-live\` is explicitly supplied.
- This script never appends \`data/lp_events.jsonl\`, deploys, posts, pushes GitHub, pushes LINE, changes public links, mutates customer data, touches payments, or deletes data.
`;
}

main().catch(async (error) => {
  const status = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "next_p0_owner_intake",
    status: "failed",
    error: error instanceof Error ? error.message : "unknown_error",
    candidate_found: false,
    stage_performed: false,
    live_input_files_created: false,
    data_lp_events_write_performed: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    external_effect: false,
  };
  await writeJson(STATUS_PATH, status);
  console.error(error);
  process.exitCode = 1;
});
