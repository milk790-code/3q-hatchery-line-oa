import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { splitCountItems } from "./lib/gate-policy.mjs";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OPTIONS = parseArgs(process.argv.slice(2));
const NEXT_P0_INPUTS_PATH = resolveProjectPath(OPTIONS.nextP0, path.join(ROOT, "next_p0_owner_inputs.json"));
const REAL_EVENTS_PATH = resolveProjectPath(OPTIONS.realEvents, path.join(ROOT, "data", "lp_events.jsonl"));
const STATUS_PATH = resolveProjectPath(OPTIONS.status, path.join(ROOT, "data", "next_p0_quick_capture_status.json"));
const REPORT_PATH = resolveProjectPath(OPTIONS.report, path.join(ROOT, "next_p0_quick_capture.md"));
const OUTPUT_DIR = resolveProjectPath(OPTIONS.outputDir, path.join(ROOT, "data", "next_p0_quick_capture"));
const TEMPLATE_PATH = resolveProjectPath(OPTIONS.template, path.join(OUTPUT_DIR, "next_p0_owner_inputs.quick-template.csv"));
const PASTE_TEMPLATE_PATH = resolveProjectPath(OPTIONS.pasteTemplate, path.join(OUTPUT_DIR, "next_p0_owner_inputs.counts-paste-template.txt"));
const FILLED_PREVIEW_PATH = resolveProjectPath(
  OPTIONS.filledPreview,
  path.join(OUTPUT_DIR, "next_p0_owner_inputs.quick-filled.preview.csv"),
);

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

const PII_CHECKED_VALUES = new Set(["yes", "true", "checked", "ok", "1"]);
const EVENT_ALIASES = {
  page_view: ["page_view", "page view", "page views", "view", "views", "visit", "visits", "pv", "落地頁瀏覽", "瀏覽"],
  cta_click: ["cta_click", "cta click", "cta clicks", "cta", "click", "clicks", "點擊", "CTA 點擊"],
  line_add: ["line_add", "line add", "line adds", "line", "line in", "inbound", "add", "adds", "進線", "加好友"],
};
const METADATA_KEYS = new Map([
  ["capturedate", "captureDate"],
  ["date", "captureDate"],
  ["evidenceref", "evidenceRef"],
  ["evidence", "evidenceRef"],
  ["reviewer", "reviewer"],
  ["piichecked", "piiChecked"],
]);
const RED_LINE_FALSE = {
  live_input_files_created: false,
  owner_inbox_write_performed: false,
  stage_performed: false,
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
  const inputs = Array.isArray(nextP0.inputs) ? nextP0.inputs : [];
  const countsResult = await readCounts(inputs);
  const counts = countsResult.counts;
  const effectiveMetadata = {
    captureDate: OPTIONS.captureDate ?? countsResult.metadata.captureDate ?? null,
    evidenceRef: OPTIONS.evidenceRef ?? countsResult.metadata.evidenceRef ?? null,
    reviewer: OPTIONS.reviewer ?? countsResult.metadata.reviewer ?? null,
    piiChecked: OPTIONS.piiChecked ?? countsResult.metadata.piiChecked ?? null,
  };
  const hasCounts = counts.size > 0;
  const validation = hasCounts ? validateCounts({ counts, inputs, metadata: effectiveMetadata }) : waitingValidation(inputs);
  const partialAutoWaiting = countsResult.partial_auto_counts && hasCounts && !validation.hasBlockingIssues;
  const previewReady = validation.ok && hasCounts && !countsResult.partial_auto_counts;
  const templateRows = inputs.map((row) => toExportRow(row, {
    aggregateCount: "",
    captureDate: OPTIONS.captureDate ?? formatTaipeiDate(generatedAt),
    evidenceRef: "",
    reviewer: "",
    piiChecked: "",
  }));
  const filledRows = previewReady
    ? inputs.map((row) => toExportRow(row, {
        aggregateCount: String(counts.get(String(row.rank))),
        captureDate: effectiveMetadata.captureDate,
        evidenceRef: effectiveMetadata.evidenceRef,
        reviewer: effectiveMetadata.reviewer,
        piiChecked: effectiveMetadata.piiChecked,
      }))
    : [];

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(TEMPLATE_PATH, renderCsv(EXPORT_HEADERS, templateRows));
  if (!countsResult.preservePasteTemplate) {
    await writeFile(PASTE_TEMPLATE_PATH, renderPasteTemplate(inputs, generatedAt));
  }
  await writeFile(FILLED_PREVIEW_PATH, renderCsv(EXPORT_HEADERS, filledRows));

  const realEventsAfter = await countLines(REAL_EVENTS_PATH);
  const status = {
    ok: validation.ok || partialAutoWaiting,
    generated_at: generatedAt.toISOString(),
    mode: "next_p0_quick_capture",
    status: statusName({ hasCounts, validation, partialAutoWaiting }),
    next_p0_inputs_path: NEXT_P0_INPUTS_PATH,
    expected_row_count: inputs.length,
    quick_count_count: counts.size,
    filled_rank_count: validation.filledRanks.length,
    filled_ranks: validation.filledRanks,
    missing_rank_count: validation.missingRanks.length,
    missing_ranks: validation.missingRanks,
    unknown_rank_count: validation.unknownRanks.length,
    unknown_ranks: validation.unknownRanks,
    issue_count: validation.issues.length,
    issues: validation.issues,
    warning_count: validation.warnings.length,
    warnings: validation.warnings,
    capture_date: effectiveMetadata.captureDate,
    evidence_ref: effectiveMetadata.evidenceRef,
    reviewer: effectiveMetadata.reviewer,
    pii_checked: effectiveMetadata.piiChecked,
    counts_source: countsResult.source,
    auto_counts_file_used: countsResult.autoCountsFileUsed,
    partial_auto_counts: countsResult.partial_auto_counts,
    partial_waiting: partialAutoWaiting,
    metadata_from_counts_file: countsResult.metadata_from_counts_file,
    template_path: TEMPLATE_PATH,
    paste_template_path: PASTE_TEMPLATE_PATH,
    paste_template_preserved: countsResult.preservePasteTemplate,
    filled_preview_path: FILLED_PREVIEW_PATH,
    template_created: true,
    paste_template_created: true,
    filled_preview_created: filledRows.length > 0,
    filled_preview_rows: filledRows.length,
    accepted_formats: [
      "--counts=1=100,2=20,3=5",
      "--counts='1:100;2:20;3:5'",
      "--counts='champion.visits=100;champion.cta=20;champion.line=5'",
      "--counts='track-champion-3q-line-v0.page_view=100;track-champion-3q-line-v0.cta_click=20'",
      "--counts-file=data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt after replacing metadata placeholders and every <count>",
      "auto-read data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt when metadata and all counts are complete",
    ],
    preview_command: `npm run next-p0:intake -- --input=${relative(FILLED_PREVIEW_PATH)}`,
    next_safe_action: nextSafeAction({ hasCounts, validation, partialAutoWaiting }),
    real_events_before: realEventsBefore,
    real_events_after: realEventsAfter,
    real_events_unchanged: realEventsBefore === realEventsAfter,
    ...RED_LINE_FALSE,
    note: "Local quick adapter for focused Next P0 aggregate counts. It creates a template and, when all counts are supplied, a preview-only owner-download CSV. It never writes inbox/live CSVs, stages data, appends data/lp_events.jsonl, or performs external actions.",
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status, inputs));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok && OPTIONS.strict === true) process.exitCode = 1;
}

function waitingValidation(inputs) {
  return {
    ok: true,
    hasBlockingIssues: false,
    filledRanks: [],
    missingRanks: inputs.map((row) => String(row.rank)),
    unknownRanks: [],
    issues: [],
    warnings: [],
  };
}

function validateCounts({ counts, inputs, metadata }) {
  const expectedRanks = new Set(inputs.map((row) => String(row.rank)));
  const filledRanks = inputs.map((row) => String(row.rank)).filter((rank) => counts.has(rank));
  const missingRanks = inputs.map((row) => String(row.rank)).filter((rank) => !counts.has(rank));
  const unknownRanks = Array.from(counts.keys()).filter((rank) => !expectedRanks.has(rank));
  const issues = [];
  const warnings = [];

  if (!metadata.captureDate || !/^\d{4}-\d{2}-\d{2}$/.test(metadata.captureDate)) {
    issues.push(issue(null, "capture_date", "Provide --capture-date=YYYY-MM-DD when quick counts are supplied.", "missing_metadata"));
  }
  if (!metadata.evidenceRef) {
    issues.push(issue(null, "evidence_ref", "Provide --evidence-ref=<aggregate source reference> when quick counts are supplied.", "missing_metadata"));
  }
  if (!metadata.reviewer) {
    issues.push(issue(null, "reviewer", "Provide --reviewer=<aggregate reviewer alias> when quick counts are supplied.", "missing_metadata"));
  }
  if (!PII_CHECKED_VALUES.has(String(metadata.piiChecked ?? "").toLowerCase())) {
    issues.push(issue(null, "pii_checked", "Provide --pii-checked=yes after confirming aggregate-only counts.", "missing_metadata"));
  }
  if (missingRanks.length > 0) {
    issues.push(issue(null, "counts", `Missing ranks: ${missingRanks.join(", ")}.`, "missing_counts"));
  }
  if (unknownRanks.length > 0) {
    issues.push(issue(null, "counts", `Unknown ranks: ${unknownRanks.join(", ")}.`, "unknown_counts"));
  }

  for (const [rank, value] of counts.entries()) {
    if (!/^(0|[1-9]\d*)$/.test(String(value))) {
      issues.push(issue(null, `rank:${rank}`, "Count must be a non-negative integer."));
    } else if (Number(value) === 0) {
      warnings.push(issue(null, `rank:${rank}`, "Zero count is allowed; verify the source truly had no activity."));
    }
  }

  for (const [field, value] of [
    ["evidence_ref", metadata.evidenceRef],
    ["reviewer", metadata.reviewer],
  ]) {
    const sensitive = sensitiveMatch(value);
    if (sensitive) {
      issues.push(issue(null, field, `Sensitive-looking ${sensitive} detected. Use aggregate evidence refs only.`));
    }
  }

  return {
    ok: issues.length === 0,
    hasBlockingIssues: issues.some((item) => !["missing_metadata", "missing_counts"].includes(item.code)),
    filledRanks,
    missingRanks,
    unknownRanks,
    issues,
    warnings,
  };
}

async function readCounts(inputs) {
  const counts = new Map();
  const metadata = {};
  const rawParts = [];
  const selectorIndex = buildSelectorIndex(inputs);
  let source = "none";
  let autoCountsFileUsed = false;
  let metadataFromCountsFile = false;
  let preservePasteTemplate = false;
  let partialAutoCounts = false;
  const explicitCountsFile = OPTIONS.countsFile ? resolveProjectPath(OPTIONS.countsFile) : null;
  if (OPTIONS.counts) rawParts.push({ source: "cli_counts", raw: OPTIONS.counts, preservePasteTemplate: false });
  if (explicitCountsFile) {
    rawParts.push({
      source: "counts_file",
      raw: await readFile(explicitCountsFile, "utf8"),
      preservePasteTemplate: path.resolve(explicitCountsFile) === path.resolve(PASTE_TEMPLATE_PATH),
    });
  }
  if (rawParts.length === 0) {
    const autoRaw = await readAutoCountsFile(PASTE_TEMPLATE_PATH, selectorIndex, inputs);
    preservePasteTemplate = autoRaw?.preserve === true;
    if (autoRaw?.raw) {
      rawParts.push({ source: "auto_paste_template", raw: autoRaw.raw, preservePasteTemplate: true });
      autoCountsFileUsed = true;
      partialAutoCounts = autoRaw.partial === true;
    }
  }
  for (const part of rawParts) {
    source = part.source;
    preservePasteTemplate = preservePasteTemplate || part.preservePasteTemplate;
    const parsed = parseCountsText(part.raw, selectorIndex);
    for (const [rank, value] of parsed.counts.entries()) counts.set(rank, value);
    for (const [key, value] of Object.entries(parsed.metadata)) {
      metadata[key] = value;
      metadataFromCountsFile = true;
    }
  }
  return {
    counts,
    metadata,
    source,
    autoCountsFileUsed,
    metadata_from_counts_file: metadataFromCountsFile,
    partial_auto_counts: partialAutoCounts,
    preservePasteTemplate,
  };
}

async function readAutoCountsFile(filePath, selectorIndex, inputs) {
  try {
    const raw = await readFile(filePath, "utf8");
    if (!hasFilledCount(raw)) return null;
    const parsed = parseCountsText(raw, selectorIndex);
    const expectedRanks = inputs.map((row) => String(row.rank));
    const hasAllCounts = expectedRanks.every((rank) => /^(0|[1-9]\d*)$/.test(String(parsed.counts.get(rank) ?? "")));
    const hasRequiredMetadata = parsed.metadata.captureDate
      && parsed.metadata.evidenceRef
      && parsed.metadata.reviewer
      && PII_CHECKED_VALUES.has(String(parsed.metadata.piiChecked ?? "").toLowerCase());
    const hasPlaceholderMetadata = Object.values(parsed.metadata).some((value) => /^<.+>$/.test(String(value ?? "")));
    if (hasAllCounts && hasRequiredMetadata && !hasPlaceholderMetadata) {
      return { raw, preserve: true, partial: false };
    }
    return { raw, preserve: true, partial: true };
  } catch {
    return null;
  }
}

function hasFilledCount(raw) {
  return splitCountItems(raw)
    .some((item) => {
      const text = item.trim();
      if (!text || text.startsWith("#")) return false;
      const match = text.match(/^(.+?)\s*[:=]\s*(.+)$/);
      if (!match) return false;
      if (metadataKey(match[1])) return false;
      return /^(0|[1-9]\d*)$/.test(match[2].trim());
    });
}

function parseCountsText(raw, selectorIndex) {
  const counts = new Map();
  const metadata = {};
  for (const item of splitCountItems(raw)) {
    const text = item.trim();
    if (!text || text.startsWith("#")) continue;
    const match = text.match(/^(.+?)\s*[:=]\s*(.+)$/);
    if (!match) {
      counts.set(`invalid:${text}`, "invalid");
      continue;
    }
    const rawKey = match[1].trim();
    const rawValue = match[2].trim();
    const metaKey = metadataKey(rawKey);
    if (metaKey) {
      metadata[metaKey] = rawValue;
      continue;
    }
    if (/^<.+>$/.test(rawValue)) continue;
    if (!/^(0|[1-9]\d*)$/.test(rawValue)) {
      counts.set(`invalid:${rawKey}`, "invalid");
      continue;
    }
    const rank = resolveCountRank(rawKey, selectorIndex);
    counts.set(rank ?? `invalid:${rawKey}`, rawValue);
  }
  return { counts, metadata };
}

function metadataKey(rawKey) {
  return METADATA_KEYS.get(normalizeSelector(rawKey));
}

function buildSelectorIndex(inputs) {
  const selectorIndex = new Map();
  for (const row of inputs) {
    const rank = String(row.rank);
    for (const selector of selectorsForRow(row)) {
      const normalized = normalizeSelector(selector);
      if (!normalized) continue;
      const existing = selectorIndex.get(normalized);
      selectorIndex.set(normalized, existing && existing !== rank ? null : rank);
    }
  }
  return selectorIndex;
}

function selectorsForRow(row) {
  const selectors = new Set([
    row.rank,
    `rank ${row.rank}`,
    `rank_${row.rank}`,
    `rank-${row.rank}`,
  ]);
  const eventAliases = EVENT_ALIASES[row.event_type] ?? [row.event_type];
  for (const subject of [row.role, row.tracking_link_id]) {
    if (!subject) continue;
    for (const eventAlias of eventAliases) {
      selectors.add(`${subject}.${eventAlias}`);
      selectors.add(`${subject}:${eventAlias}`);
      selectors.add(`${subject} ${eventAlias}`);
      selectors.add(`${subject}_${eventAlias}`);
      selectors.add(`${subject}-${eventAlias}`);
    }
  }
  return selectors;
}

function resolveCountRank(rawKey, selectorIndex) {
  const key = String(rawKey ?? "").trim();
  const directRank = key.match(/^(?:rank[-_\s]*)?(\d+)$/i);
  if (directRank) return directRank[1];
  const normalized = normalizeSelector(key);
  if (!selectorIndex.has(normalized)) return null;
  return selectorIndex.get(normalized);
}

function normalizeSelector(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

function toExportRow(row, { aggregateCount, captureDate, evidenceRef, reviewer, piiChecked }) {
  return {
    rank: row.rank,
    capture_date: captureDate,
    role: row.role,
    tracking_link_id: row.tracking_link_id,
    event_type: row.event_type,
    stage_label: row.stage_label,
    source_surface: row.source_surface,
    target_live_file: row.target_live_file,
    aggregate_count: aggregateCount,
    evidence_ref: evidenceRef,
    reviewer,
    pii_checked: piiChecked,
  };
}

function statusName({ hasCounts, validation, partialAutoWaiting }) {
  if (!hasCounts) return "waiting_for_quick_counts";
  if (partialAutoWaiting) return "partial_quick_counts_waiting";
  if (!validation.ok) return "blocked_invalid_quick_counts";
  return "quick_counts_preview_ready";
}

function nextSafeAction({ hasCounts, validation, partialAutoWaiting }) {
  if (!hasCounts) {
    return "Provide aggregate counts with --counts plus --capture-date, --evidence-ref, --reviewer, and --pii-checked=yes; fill the paste template completely for weekly auto-read; or use next_p0_owner_form.html.";
  }
  if (partialAutoWaiting) {
    return `Continue filling the preserved paste template: ${validation.filledRanks.length}/${validation.filledRanks.length + validation.missingRanks.length} ranks are present; missing ranks=${validation.missingRanks.join(", ")}. Preview is still blocked until all counts and metadata are complete.`;
  }
  if (!validation.ok) {
    return "Fix quick counts and metadata, keeping only aggregate evidence references and no customer identifiers.";
  }
  return `Review next_p0_quick_capture.md, then preview through next-p0:intake with --input=${relative(FILLED_PREVIEW_PATH)}. Staging still requires the normal owner-confirmed intake command.`;
}

function parseArgs(args) {
  const options = {
    counts: null,
    countsFile: null,
    captureDate: null,
    evidenceRef: null,
    reviewer: null,
    piiChecked: null,
    nextP0: null,
    realEvents: null,
    status: null,
    report: null,
    outputDir: null,
    template: null,
    filledPreview: null,
    pasteTemplate: null,
    strict: false,
  };
  for (const arg of args) {
    if (arg.startsWith("--counts=")) options.counts = arg.slice("--counts=".length);
    if (arg.startsWith("--counts-file=")) options.countsFile = arg.slice("--counts-file=".length);
    if (arg.startsWith("--capture-date=")) options.captureDate = arg.slice("--capture-date=".length);
    if (arg.startsWith("--evidence-ref=")) options.evidenceRef = arg.slice("--evidence-ref=".length);
    if (arg.startsWith("--reviewer=")) options.reviewer = arg.slice("--reviewer=".length);
    if (arg.startsWith("--pii-checked=")) options.piiChecked = arg.slice("--pii-checked=".length);
    if (arg.startsWith("--next-p0=")) options.nextP0 = arg.slice("--next-p0=".length);
    if (arg.startsWith("--real-events=")) options.realEvents = arg.slice("--real-events=".length);
    if (arg.startsWith("--status=")) options.status = arg.slice("--status=".length);
    if (arg.startsWith("--report=")) options.report = arg.slice("--report=".length);
    if (arg.startsWith("--output-dir=")) options.outputDir = arg.slice("--output-dir=".length);
    if (arg.startsWith("--template=")) options.template = arg.slice("--template=".length);
    if (arg.startsWith("--paste-template=")) options.pasteTemplate = arg.slice("--paste-template=".length);
    if (arg.startsWith("--filled-preview=")) options.filledPreview = arg.slice("--filled-preview=".length);
    if (arg === "--strict" || arg === "--strict=true") options.strict = true;
    if (arg === "--strict=false") options.strict = false;
  }
  return options;
}

function renderCsv(headers, rows) {
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")).join("\n")}${rows.length > 0 ? "\n" : ""}`;
}

function renderPasteTemplate(inputs, generatedAt) {
  const lines = [
    "# 3Q Growth Loop Next P0 Paste Counts Template",
    "# Replace metadata placeholders and every <count> with non-sensitive aggregate values.",
    "# Weekly runs preserve partial edits and auto-read this file only when metadata and all counts are complete; otherwise run manually:",
    `# npm run next-p0:quick -- --counts-file=${relative(PASTE_TEMPLATE_PATH)} --capture-date=${formatTaipeiDate(generatedAt)} --evidence-ref=<aggregate_ref> --reviewer=<alias> --pii-checked=yes`,
    "# Keep this aggregate-only: no phone, email, LINE user ID, customer name, chat text, order ID, payment ID, or private note.",
    "",
    `capture_date=${formatTaipeiDate(generatedAt)}`,
    "evidence_ref=<aggregate_ref>",
    "reviewer=<alias>",
    "pii_checked=<yes_after_aggregate_only_review>",
    "",
  ];
  for (const row of inputs) {
    lines.push(`# rank ${row.rank} / ${row.role} / ${row.event_type} / ${row.tracking_link_id}`);
    lines.push(`${preferredSelector(row)}=<count>`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function preferredSelector(row) {
  if (row.event_type === "page_view") return `${row.role}.visits`;
  if (row.event_type === "cta_click") return `${row.role}.cta`;
  if (row.event_type === "line_add") return `${row.role}.line`;
  return `${row.role}.${row.event_type}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function sensitiveMatch(value) {
  const text = String(value ?? "");
  if (!text) return null;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) return "email";
  if (/\b(?:\+?886[- ]?)?0?9\d{2}[- ]?\d{3}[- ]?\d{3}\b/.test(text)) return "phone";
  if (/\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}\b/.test(text)) return "card-like number";
  if (/\bline[_ -]?user[_ -]?id\b/i.test(text)) return "LINE user id";
  if (/\b(order|payment|refund)[-_ ]?id\b/i.test(text)) return "order/payment/refund id";
  if (/[姓名暱稱聊天對話訂單付款退款]/.test(text)) return "customer/private text";
  return null;
}

function renderReport(status, inputs) {
  const inputRows = inputs
    .map((row) => `| ${row.rank} | ${row.role} | ${row.tracking_link_id} | ${row.event_type} | ${row.target_live_file} |`)
    .join("\n");
  const issueRows = status.issues.length > 0
    ? status.issues.map((item) => `| ${item.field} | ${item.message} |`).join("\n")
    : "| - | none |";

  return `# 3Q Growth Loop Next P0 Quick Capture

BLUF: ${status.status}. This local adapter turns pasted aggregate rank counts into the same focused owner-download CSV contract used by next-p0:intake.

Generated: ${status.generated_at}
Mode: ${status.mode}
Status: ${status.status}
Expected rows: ${status.expected_row_count}
Quick counts supplied: ${status.quick_count_count}
Filled ranks: ${status.filled_rank_count}/${status.expected_row_count}
Missing ranks: ${status.missing_ranks.length > 0 ? status.missing_ranks.join(", ") : "none"}
Template: ${status.template_path}
Paste template: ${status.paste_template_path}
Paste template preserved: ${status.paste_template_preserved ? "yes" : "no"}
Filled preview: ${status.filled_preview_path}
Filled preview created: ${status.filled_preview_created ? "yes" : "no"}
Counts source: ${status.counts_source}
Auto counts file used: ${status.auto_counts_file_used ? "yes" : "no"}
Partial auto counts: ${status.partial_auto_counts ? "yes" : "no"}
Partial waiting: ${status.partial_waiting ? "yes" : "no"}
Owner inbox write performed: no
Live input files created: no
data/lp_events.jsonl write performed: no
External effect: no

## Accepted Formats

- \`--counts=1=100,2=20,3=5\`
- \`--counts='1:100;2:20;3:5'\`
- \`--counts='champion.visits=100;champion.cta=20;champion.line=5'\`
- \`--counts='track-champion-3q-line-v0.page_view=100;track-champion-3q-line-v0.cta_click=20'\`
- \`--counts-file=data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt\` after replacing metadata placeholders and every \`<count>\`
- Auto-read \`data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt\` after metadata and all counts are complete; partial owner edits are preserved.

Required with counts: \`--capture-date=YYYY-MM-DD --evidence-ref=<aggregate_ref> --reviewer=<alias> --pii-checked=yes\`, or the same metadata lines inside the paste template.

## Rows

| rank | role | tracking link | event type | target live file |
|---:|---|---|---|---|
${inputRows}

## Issues

| field | message |
|---|---|
${issueRows}

## Next Safe Action

${status.next_safe_action}
`;
}

function issue(rowNumber, field, message, code = "invalid_value") {
  return { row_number: rowNumber, field, message, code, external_effect: false };
}

function formatTaipeiDate(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function countLines(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw.split(/\r?\n/).filter((line) => line.trim()).length;
  } catch {
    return 0;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
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

function resolveProjectPath(value, fallback = value) {
  if (!value) return fallback;
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function relative(filePath) {
  const relativePath = path.relative(ROOT, filePath);
  return relativePath && !relativePath.startsWith("..") ? relativePath : filePath;
}

await main();
