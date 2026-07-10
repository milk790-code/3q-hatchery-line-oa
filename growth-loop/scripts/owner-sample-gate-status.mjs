import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OPTIONS = parseArgs(process.argv.slice(2));
const CONFIG_PATH = resolvePath(OPTIONS.config, path.join(ROOT, "config", "growth-loop.config.json"));
const FILLED_LEDGER_PATH = resolvePath(OPTIONS.input, path.join(ROOT, "data", "source_capture", "sample_gate_ledger.filled.csv"));
const TEMPLATE_LEDGER_PATH = resolvePath(OPTIONS.template, path.join(ROOT, "data", "source_capture", "sample_gate_ledger.fill-template.csv"));
const REAL_EVENTS_PATH = resolvePath(OPTIONS.realEvents, path.join(ROOT, "data", "lp_events.jsonl"));
const JSON_PATH = resolvePath(OPTIONS.json, path.join(ROOT, "owner_sample_gate_status.json"));
const STATUS_PATH = resolvePath(OPTIONS.status, path.join(ROOT, "data", "owner_sample_gate_status.json"));
const REPORT_PATH = resolvePath(OPTIONS.report, path.join(ROOT, "owner_sample_gate_status.md"));

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
const SAMPLE_EVENTS = ["page_view", "cta_click", "line_add"];
const PII_CHECKED_VALUES = new Set(["yes", "true", "checked", "ok", "1"]);

async function main() {
  const generatedAt = new Date();
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const realEventsBefore = await countLines(REAL_EVENTS_PATH);
  const filledExists = await exists(FILLED_LEDGER_PATH);
  const templateExists = await exists(TEMPLATE_LEDGER_PATH);
  let result;

  if (!filledExists) {
    result = buildWaitingResult(config, generatedAt, realEventsBefore, templateExists);
  } else {
    result = await buildFilledResult(config, generatedAt, realEventsBefore);
  }

  const realEventsAfter = await countLines(REAL_EVENTS_PATH);
  result.real_events_after = realEventsAfter;
  result.real_events_unchanged = realEventsBefore === realEventsAfter;

  const status = compactStatus(result);
  await writeJson(JSON_PATH, result);
  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(result));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildWaitingResult(config, generatedAt, realEventsBefore, templateExists) {
  const assets = summarizeEmptyAssets(config);
  return {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "owner_sample_gate_status",
    status: "waiting_for_owner_sample_gate_counts",
    input_path: FILLED_LEDGER_PATH,
    input_exists: false,
    template_path: TEMPLATE_LEDGER_PATH,
    template_exists: templateExists,
    report_path: REPORT_PATH,
    json_path: JSON_PATH,
    thresholds: config.sample_thresholds,
    win_rule: config.win_rule,
    current_round: config.current_round,
    rows_read: 0,
    filled_rows: 0,
    pending_rows: 18,
    issue_count: 0,
    warning_count: 0,
    issues: [],
    warnings: [],
    assets,
    champion: assets.find((asset) => asset.role === "champion") ?? null,
    challenger: assets.find((asset) => asset.role === "challenger") ?? null,
    sample_threshold_met: false,
    sample_rate_win_candidate: false,
    challenger_lift: null,
    no_quality_regression: null,
    quality_guard_status: "not_evaluated_from_sample_gate",
    challenger_win_rule_met: false,
    promotion_performed: false,
    owner_review_required: false,
    decision: "continue_collecting_sample_gate_counts",
    next_safe_action: "Fill data/source_capture/sample_gate_ledger.filled.csv with aggregate counts only, then rerun npm run owner:sample-gate.",
    real_events_before: realEventsBefore,
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

async function buildFilledResult(config, generatedAt, realEventsBefore) {
  const raw = await readFile(FILLED_LEDGER_PATH, "utf8");
  const parsed = parseCsv(raw);
  const headerIssues = validateHeaders(parsed.headers);
  const rowResult = headerIssues.length > 0
    ? emptyRowResult(headerIssues)
    : summarizeRows(config, parsed.rows);
  const assets = rowResult.assets;
  const champion = assets.find((asset) => asset.role === "champion") ?? null;
  const challenger = assets.find((asset) => asset.role === "challenger") ?? null;
  const championRate = champion?.line_add_rate ?? 0;
  const challengerRate = challenger?.line_add_rate ?? 0;
  const challengerLift = championRate > 0 ? round(challengerRate / championRate) : null;
  const sampleRateWinCandidate =
    Boolean(challenger?.sample_threshold_met) &&
    challengerLift !== null &&
    challengerLift > Number(config.win_rule?.challenger_lift_required ?? 1.15);
  const issueCount = rowResult.issues.length;
  const warningCount = rowResult.warnings.length;
  const decision = decide({
    issueCount,
    pendingRows: rowResult.pendingRows,
    challenger,
    sampleRateWinCandidate,
  });

  return {
    ok: issueCount === 0,
    generated_at: generatedAt.toISOString(),
    mode: "owner_sample_gate_status",
    status: issueCount > 0 ? "blocked_invalid_owner_sample_gate" : decision.status,
    input_path: FILLED_LEDGER_PATH,
    input_exists: true,
    template_path: TEMPLATE_LEDGER_PATH,
    template_exists: true,
    report_path: REPORT_PATH,
    json_path: JSON_PATH,
    thresholds: config.sample_thresholds,
    win_rule: config.win_rule,
    current_round: config.current_round,
    rows_read: parsed.rows.length,
    filled_rows: rowResult.filledRows,
    pending_rows: rowResult.pendingRows,
    issue_count: issueCount,
    warning_count: warningCount,
    issues: rowResult.issues,
    warnings: rowResult.warnings,
    assets,
    champion,
    challenger,
    sample_threshold_met: Boolean(challenger?.sample_threshold_met),
    sample_rate_win_candidate: sampleRateWinCandidate,
    challenger_lift: challengerLift,
    no_quality_regression: null,
    quality_guard_status: "not_evaluated_from_sample_gate",
    challenger_win_rule_met: false,
    promotion_performed: false,
    owner_review_required: decision.owner_review_required,
    decision: decision.decision,
    next_safe_action: decision.next_safe_action,
    real_events_before: realEventsBefore,
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

function summarizeEmptyAssets(config) {
  return (config.assets ?? []).map((asset) => ({
    asset_id: asset.asset_id,
    role: asset.role,
    visits: 0,
    cta_clicks: 0,
    line_adds: 0,
    line_add_rate: 0,
    observed_test_days: 0,
    sample_threshold_met: false,
    gaps: {
      visits: Number(config.sample_thresholds?.min_visits ?? 0),
      cta_clicks: Number(config.sample_thresholds?.min_cta_clicks ?? 0),
      line_adds: Number(config.sample_thresholds?.min_line_adds ?? 0),
      test_days: Number(config.sample_thresholds?.min_test_days ?? 0),
    },
  }));
}

function summarizeRows(config, rows) {
  const thresholds = config.sample_thresholds ?? {};
  const byAsset = new Map();
  const issues = [];
  const warnings = [];
  let filledRows = 0;
  let pendingRows = 0;

  for (const asset of config.assets ?? []) {
    byAsset.set(asset.asset_id, {
      asset_id: asset.asset_id,
      role: asset.role,
      visits: 0,
      cta_clicks: 0,
      line_adds: 0,
      dates: new Set(),
    });
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const countRaw = String(row.aggregate_count ?? "").trim();
    const partialFields = ["capture_date", "evidence_ref", "reviewer", "pii_checked"].filter((field) => String(row[field] ?? "").trim());

    if (!countRaw) {
      pendingRows += 1;
      if (partialFields.length > 0) {
        warnings.push({
          row_number: rowNumber,
          field: "aggregate_count",
          message: `Row has ${partialFields.join(", ")} but no aggregate_count, so it is not counted yet.`,
        });
      }
      return;
    }

    const rowIssues = validateRow(row, rowNumber, countRaw);
    issues.push(...rowIssues);
    if (rowIssues.length > 0) return;

    filledRows += 1;
    const count = Number(countRaw);
    const assetId = row.asset_id.trim();
    if (!byAsset.has(assetId)) {
      byAsset.set(assetId, {
        asset_id: assetId,
        role: assetId.includes("champion") ? "champion" : "challenger",
        visits: 0,
        cta_clicks: 0,
        line_adds: 0,
        dates: new Set(),
      });
    }

    const asset = byAsset.get(assetId);
    if (row.stage.trim() === "page_view") asset.visits += count;
    if (row.stage.trim() === "cta_click") asset.cta_clicks += count;
    if (row.stage.trim() === "line_add") asset.line_adds += count;
    if (count > 0) asset.dates.add(row.capture_date.trim());
  });

  const assets = Array.from(byAsset.values()).map((asset) => {
    const observedTestDays = calculateObservedTestDays(Array.from(asset.dates));
    const sampleThresholdMet =
      asset.visits >= Number(thresholds.min_visits ?? 0) &&
      asset.cta_clicks >= Number(thresholds.min_cta_clicks ?? 0) &&
      asset.line_adds >= Number(thresholds.min_line_adds ?? 0) &&
      observedTestDays >= Number(thresholds.min_test_days ?? 0);
    return {
      asset_id: asset.asset_id,
      role: asset.role,
      visits: asset.visits,
      cta_clicks: asset.cta_clicks,
      line_adds: asset.line_adds,
      line_add_rate: round(safeDivide(asset.line_adds, asset.visits)),
      observed_test_days: observedTestDays,
      sample_threshold_met: sampleThresholdMet,
      gaps: {
        visits: Math.max(0, Number(thresholds.min_visits ?? 0) - asset.visits),
        cta_clicks: Math.max(0, Number(thresholds.min_cta_clicks ?? 0) - asset.cta_clicks),
        line_adds: Math.max(0, Number(thresholds.min_line_adds ?? 0) - asset.line_adds),
        test_days: Math.max(0, Number(thresholds.min_test_days ?? 0) - observedTestDays),
      },
    };
  });

  return { assets, filledRows, pendingRows, issues, warnings };
}

function validateHeaders(headers) {
  return REQUIRED_HEADERS
    .filter((header) => !headers.includes(header))
    .map((header) => ({ row_number: 1, field: header, message: `Missing required sample-gate header: ${header}` }));
}

function validateRow(row, rowNumber, countRaw) {
  const issues = [];
  for (const field of ["week_start", "week_end", "capture_date", "stage", "asset_id", "content_id", "variant_id", "tracking_link_id", "target_live_file", "evidence_ref", "pii_checked"]) {
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

  if (row.stage && !SAMPLE_EVENTS.includes(row.stage.trim())) {
    issues.push({ row_number: rowNumber, field: "stage", message: `stage must be one of ${SAMPLE_EVENTS.join(", ")} for sample-gate status.` });
  }

  if (row.pii_checked && !PII_CHECKED_VALUES.has(row.pii_checked.trim().toLowerCase())) {
    issues.push({ row_number: rowNumber, field: "pii_checked", message: "pii_checked must be yes/true/checked/ok/1." });
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

function decide({ issueCount, pendingRows, challenger, sampleRateWinCandidate }) {
  if (issueCount > 0) {
    return {
      status: "blocked_invalid_owner_sample_gate",
      decision: "fix_owner_sample_gate_ledger",
      owner_review_required: false,
      next_safe_action: "Fix invalid rows in data/source_capture/sample_gate_ledger.filled.csv, keeping only aggregate non-PII evidence.",
    };
  }
  if (pendingRows > 0) {
    return {
      status: "owner_counts_incomplete",
      decision: "continue_collecting_sample_gate_counts",
      owner_review_required: false,
      next_safe_action: "Fill the remaining aggregate_count rows or intentionally enter 0, then rerun npm run owner:sample-gate.",
    };
  }
  if (!challenger?.sample_threshold_met) {
    return {
      status: "sample_insufficient_keep_champion",
      decision: "continue_collecting_sample_gate_counts",
      owner_review_required: false,
      next_safe_action: "Keep current champion and current variable; collect until visits, CTA, LINE adds, and test-days thresholds are met.",
    };
  }
  if (sampleRateWinCandidate) {
    return {
      status: "sample_rate_win_needs_quality_review",
      decision: "queue_owner_quality_review_no_auto_promotion",
      owner_review_required: true,
      next_safe_action: "Review quality evidence and owner gates before any challenger promotion or public link change.",
    };
  }
  return {
    status: "sample_ready_challenger_underperforms",
    decision: "plan_rework_or_next_variable_after_owner_review",
    owner_review_required: true,
    next_safe_action: "Review underperformance, then locally prepare the next one-variable candidate without deleting data or changing public links.",
  };
}

function compactStatus(result) {
  return {
    ok: result.ok,
    generated_at: result.generated_at,
    mode: result.mode,
    status: result.status,
    input_exists: result.input_exists,
    input_path: result.input_path,
    report_path: REPORT_PATH,
    json_path: JSON_PATH,
    filled_rows: result.filled_rows,
    pending_rows: result.pending_rows,
    issue_count: result.issue_count,
    warning_count: result.warning_count,
    sample_threshold_met: result.sample_threshold_met,
    sample_rate_win_candidate: result.sample_rate_win_candidate,
    challenger_win_rule_met: result.challenger_win_rule_met,
    quality_guard_status: result.quality_guard_status,
    decision: result.decision,
    owner_review_required: result.owner_review_required,
    promotion_performed: false,
    real_events_unchanged: result.real_events_unchanged,
    live_input_files_created: false,
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

function renderReport(result) {
  const assetRows = (result.assets ?? [])
    .map((asset) => `| ${asset.role} | ${asset.asset_id} | ${asset.visits} | ${asset.cta_clicks} | ${asset.line_adds} | ${percent(asset.line_add_rate)} | ${asset.observed_test_days} | ${asset.sample_threshold_met ? "yes" : "no"} | ${formatGaps(asset.gaps)} |`)
    .join("\n");
  const issueRows = result.issues.length > 0
    ? result.issues.map((issue) => `| ${issue.row_number ?? "n/a"} | ${issue.field ?? "n/a"} | ${issue.message} |`).join("\n")
    : "| none | none | none |";
  const warningRows = result.warnings.length > 0
    ? result.warnings.map((warning) => `| ${warning.row_number ?? "n/a"} | ${warning.field ?? "n/a"} | ${warning.message} |`).join("\n")
    : "| none | none | none |";

  return `# 3Q Growth Loop Owner Sample Gate Status

BLUF: ${result.decision}. This is a local owner-filled sample-gate status check only. It does not apply CSVs, append data/lp_events.jsonl, promote a challenger, change public links, deploy, post, push LINE, touch customer data, process payments, or delete data.

Generated: ${result.generated_at}
Mode: ${result.mode}
Status: ${result.status}
Input exists: ${result.input_exists ? "yes" : "no"}
Filled rows: ${result.filled_rows}
Pending rows: ${result.pending_rows}
Issues: ${result.issue_count}
Warnings: ${result.warning_count}
Sample threshold met: ${result.sample_threshold_met ? "yes" : "no"}
Sample-rate win candidate: ${result.sample_rate_win_candidate ? "yes" : "no"}
Challenger final win rule met: no
Quality guard: ${result.quality_guard_status}
Promotion performed: no
External effect: no

## Asset Gate

| role | asset_id | visits | CTA | LINE | LINE add rate | observed test days | sample met | gaps |
|---|---|---:|---:|---:|---:|---:|---|---|
${assetRows || "| none | none | 0 | 0 | 0 | 0.0% | 0 | no | n/a |"}

## Decision

- Decision: ${result.decision}
- Next safe action: ${result.next_safe_action}
- Owner review required: ${result.owner_review_required ? "yes" : "no"}
- No quality regression: not evaluated from this sample-gate ledger; final promotion remains blocked until reviewed evidence confirms no quality regression.

## Issues

| row | field | message |
|---|---|---|
${issueRows}

## Warnings

| row | field | message |
|---|---|---|
${warningRows}

## Safety

- Live input files created: no
- data/lp_events.jsonl write performed: no
- Public link change performed: no
- Production deploy performed: no
- Formal post or LINE push performed: no
- Customer data, payment, delete actions performed: no
`;
}

function parseArgs(args) {
  const options = {};
  for (const arg of args) {
    if (arg.startsWith("--input=")) options.input = arg.slice("--input=".length);
    if (arg.startsWith("--template=")) options.template = arg.slice("--template=".length);
    if (arg.startsWith("--config=")) options.config = arg.slice("--config=".length);
    if (arg.startsWith("--real-events=")) options.realEvents = arg.slice("--real-events=".length);
    if (arg.startsWith("--json=")) options.json = arg.slice("--json=".length);
    if (arg.startsWith("--status=")) options.status = arg.slice("--status=".length);
    if (arg.startsWith("--report=")) options.report = arg.slice("--report=".length);
  }
  return options;
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

function calculateObservedTestDays(dates) {
  const valid = dates
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .map((date) => new Date(`${date}T12:00:00+08:00`).getTime())
    .filter((value) => Number.isFinite(value));
  if (valid.length === 0) return 0;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  return Math.max(1, Math.round((max - min) / 86400000) + 1);
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

function formatGaps(gaps = {}) {
  return `visits ${gaps.visits ?? 0}, cta ${gaps.cta_clicks ?? 0}, line ${gaps.line_adds ?? 0}, days ${gaps.test_days ?? 0}`;
}

function percent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0.0%";
  return `${(value * 100).toFixed(1)}%`;
}

function safeDivide(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function round(value) {
  return Number(value.toFixed(4));
}

function resolvePath(value, fallback) {
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

async function countLines(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw.split(/\r?\n/).filter((line) => line.trim()).length;
  } catch {
    return 0;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function emptyRowResult(issues) {
  return {
    assets: [],
    filledRows: 0,
    pendingRows: 0,
    issues,
    warnings: [],
  };
}

main();
