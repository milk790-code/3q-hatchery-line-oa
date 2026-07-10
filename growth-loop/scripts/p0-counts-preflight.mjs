import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OPTIONS = parseArgs(process.argv.slice(2));
const NEXT_P0_INPUTS_PATH = resolveProjectPath(OPTIONS.nextP0, path.join(ROOT, "next_p0_owner_inputs.json"));
const PASTE_TEMPLATE_PATH = resolveProjectPath(
  OPTIONS.pasteTemplate,
  path.join(ROOT, "data", "next_p0_quick_capture", "next_p0_owner_inputs.counts-paste-template.txt"),
);
const STATUS_PATH = resolveProjectPath(OPTIONS.status, path.join(ROOT, "data", "p0_counts_preflight_status.json"));
const OUTPUT_JSON = resolveProjectPath(OPTIONS.json, path.join(ROOT, "p0_counts_preflight.json"));
const OUTPUT_MD = resolveProjectPath(OPTIONS.report, path.join(ROOT, "p0_counts_preflight.md"));

const PII_CHECKED_VALUES = new Set(["yes", "true", "checked", "ok", "1"]);
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
  const nextP0 = await readJson(NEXT_P0_INPUTS_PATH);
  const inputs = Array.isArray(nextP0.inputs) ? nextP0.inputs : [];
  const raw = await readFile(PASTE_TEMPLATE_PATH, "utf8");
  const parsed = parsePasteTemplate(raw);
  const expectedRows = inputs.map((input) => ({
    rank: String(input.rank),
    role: input.role,
    event_type: input.event_type,
    tracking_link_id: input.tracking_link_id,
    paste_key: pasteKeyFor(input),
    source_surface: input.source_surface,
    evidence_rule: input.evidence_rule,
  }));
  const expectedKeys = new Set(expectedRows.map((row) => row.paste_key));
  const countRows = expectedRows.map((row) => {
    const value = parsed.values.get(row.paste_key) ?? "";
    const state = countState(value);
    return { ...row, value, state };
  });
  const metadata = buildMetadata(parsed.values);
  const metadataRows = Object.entries(metadata).map(([key, item]) => ({ key, ...item }));
  const unknownKeys = Array.from(parsed.values.keys()).filter((key) => !expectedKeys.has(key) && !Object.hasOwn(metadata, key));
  const issues = [];
  const warnings = [];

  for (const row of metadataRows) {
    if (row.state === "invalid") issues.push(issue(row.key, row.reason, "invalid_metadata"));
    if (row.state === "placeholder") warnings.push(issue(row.key, "Metadata still has a placeholder.", "placeholder_metadata"));
  }
  for (const row of countRows) {
    if (row.state === "invalid") issues.push(issue(row.paste_key, "Count must be a non-negative integer.", "invalid_count"));
    if (row.state === "placeholder") warnings.push(issue(row.paste_key, "Count still has a placeholder.", "placeholder_count"));
  }
  for (const key of unknownKeys) {
    warnings.push(issue(key, "Unknown key ignored by the focused P0 quick adapter.", "unknown_key"));
  }

  const metadataReady = metadataRows.every((row) => row.state === "ready");
  const countsReady = countRows.every((row) => row.state === "ready");
  const blockingIssueCount = issues.length;
  const filledCount = countRows.filter((row) => row.state === "ready").length;
  const placeholderCount = countRows.filter((row) => row.state === "placeholder").length;
  const invalidCount = countRows.filter((row) => row.state === "invalid").length;
  const status = statusName({ metadataReady, countsReady, blockingIssueCount, filledCount });

  const result = {
    ok: blockingIssueCount === 0,
    generated_at: generatedAt.toISOString(),
    mode: "p0_counts_preflight_local_only",
    status,
    next_p0_inputs_path: NEXT_P0_INPUTS_PATH,
    paste_template_path: PASTE_TEMPLATE_PATH,
    expected_count_key_count: countRows.length,
    filled_count_key_count: filledCount,
    placeholder_count_key_count: placeholderCount,
    invalid_count_key_count: invalidCount,
    metadata_ready: metadataReady,
    counts_ready: countsReady,
    ready_for_quick_preview: metadataReady && countsReady && blockingIssueCount === 0,
    missing_or_placeholder_keys: countRows.filter((row) => row.state === "placeholder").map((row) => row.paste_key),
    invalid_keys: countRows.filter((row) => row.state === "invalid").map((row) => row.paste_key),
    unknown_keys: unknownKeys,
    metadata: Object.fromEntries(metadataRows.map((row) => [row.key, { state: row.state, value: safeValue(row.value) }])),
    count_rows: countRows.map((row) => ({ ...row, value: safeValue(row.value) })),
    issue_count: issues.length,
    warning_count: warnings.length,
    issues,
    warnings,
    next_safe_action: nextSafeAction({ status }),
    recommended_command: "npm run next-p0:quick",
    ...RED_LINE_FALSE,
    note: "Local paste-template preflight only. It validates aggregate P0 metadata/count placeholders before quick capture; it does not create live inputs, write events, stage data, deploy, push GitHub, post, push LINE, mutate customer data, process payments, or delete data.",
  };

  await writeJson(OUTPUT_JSON, result);
  await writeJson(STATUS_PATH, compactStatus(result));
  await writeFile(OUTPUT_MD, renderReport(result));
  console.log(JSON.stringify(compactStatus(result), null, 2));

  if (!result.ok && OPTIONS.strict === "true") process.exitCode = 1;
}

function parsePasteTemplate(raw) {
  const values = new Map();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key) values.set(key, value);
  }
  return { values };
}

function buildMetadata(values) {
  const captureDate = values.get("capture_date") ?? "";
  const evidenceRef = values.get("evidence_ref") ?? "";
  const reviewer = values.get("reviewer") ?? "";
  const piiChecked = values.get("pii_checked") ?? "";
  return {
    capture_date: validateMetadataValue(captureDate, /^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
    evidence_ref: validateMetadataValue(evidenceRef, /.+/, "Provide a non-sensitive aggregate evidence reference."),
    reviewer: validateMetadataValue(reviewer, /.+/, "Provide a reviewer alias."),
    pii_checked: validatePiiChecked(piiChecked),
  };
}

function validateMetadataValue(value, pattern, reason) {
  if (!value || isPlaceholder(value)) return { value, state: "placeholder", reason };
  const sensitive = sensitiveMatch(value);
  if (sensitive) return { value, state: "invalid", reason: `Sensitive-looking ${sensitive} detected.` };
  if (!pattern.test(value)) return { value, state: "invalid", reason };
  return { value, state: "ready", reason: "" };
}

function validatePiiChecked(value) {
  if (!value || isPlaceholder(value)) return { value, state: "placeholder", reason: "Set pii_checked=yes after aggregate-only review." };
  if (!PII_CHECKED_VALUES.has(String(value).toLowerCase())) {
    return { value, state: "invalid", reason: "Set pii_checked=yes after aggregate-only review." };
  }
  return { value, state: "ready", reason: "" };
}

function countState(value) {
  if (!value || isPlaceholder(value)) return "placeholder";
  return /^(0|[1-9]\d*)$/.test(String(value)) ? "ready" : "invalid";
}

function isPlaceholder(value) {
  return /^<.*>$/.test(String(value).trim());
}

function pasteKeyFor(input) {
  return `${input.role}.${shortEventLabel(input.event_type)}`;
}

function shortEventLabel(eventType) {
  if (eventType === "page_view") return "visits";
  if (eventType === "cta_click") return "cta";
  if (eventType === "line_add") return "line";
  return eventType;
}

function statusName({ metadataReady, countsReady, blockingIssueCount, filledCount }) {
  if (blockingIssueCount > 0) return "blocked_invalid_p0_counts";
  if (metadataReady && countsReady) return "ready_for_next_p0_quick";
  if (filledCount > 0) return "partial_p0_counts_waiting";
  return "waiting_for_owner_p0_counts";
}

function nextSafeAction({ status }) {
  if (status === "ready_for_next_p0_quick") return "Run npm run next-p0:quick, then npm run next-p0:intake and npm run weekly:local.";
  if (status === "partial_p0_counts_waiting") return "Finish every placeholder key in data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt.";
  if (status === "blocked_invalid_p0_counts") return "Fix invalid metadata or count values before running next-p0:quick.";
  return "Fill metadata and all focused P0 aggregate count placeholders in the paste template.";
}

function compactStatus(result) {
  return {
    ok: result.ok,
    generated_at: result.generated_at,
    mode: result.mode,
    status: result.status,
    expected_count_key_count: result.expected_count_key_count,
    filled_count_key_count: result.filled_count_key_count,
    placeholder_count_key_count: result.placeholder_count_key_count,
    invalid_count_key_count: result.invalid_count_key_count,
    metadata_ready: result.metadata_ready,
    counts_ready: result.counts_ready,
    ready_for_quick_preview: result.ready_for_quick_preview,
    missing_or_placeholder_key_count: result.missing_or_placeholder_keys.length,
    invalid_key_count: result.invalid_keys.length,
    unknown_key_count: result.unknown_keys.length,
    issue_count: result.issue_count,
    warning_count: result.warning_count,
    next_safe_action: result.next_safe_action,
    ...RED_LINE_FALSE,
  };
}

function renderReport(result) {
  return `# 3Q Growth Loop P0 Counts Preflight

BLUF: ${result.status}. ${result.next_safe_action}

Generated: ${result.generated_at}
Mode: ${result.mode}
Paste template: ${result.paste_template_path}
Ready for quick preview: ${result.ready_for_quick_preview ? "yes" : "no"}
Metadata ready: ${result.metadata_ready ? "yes" : "no"}
Counts ready: ${result.counts_ready ? "yes" : "no"}
Count keys filled: ${result.filled_count_key_count}/${result.expected_count_key_count}
Placeholder count keys: ${result.placeholder_count_key_count}
Invalid count keys: ${result.invalid_count_key_count}
Issue count: ${result.issue_count}
Warning count: ${result.warning_count}

## Metadata

| key | state | value |
|---|---|---|
${Object.entries(result.metadata).map(([key, item]) => `| ${key} | ${item.state} | ${item.value || ""} |`).join("\n")}

## Counts

| rank | role | event | paste key | state |
|---:|---|---|---|---|
${result.count_rows.map((row) => `| ${row.rank} | ${row.role} | ${row.event_type} | \`${row.paste_key}\` | ${row.state} |`).join("\n")}

## Issues

| field | message |
|---|---|
${result.issues.length ? result.issues.map((item) => `| ${item.field} | ${item.message} |`).join("\n") : "| - | none |"}

## Warnings

| field | message |
|---|---|
${result.warnings.length ? result.warnings.map((item) => `| ${item.field} | ${item.message} |`).join("\n") : "| - | none |"}

## Safety

- Live input files created: no
- data/lp_events.jsonl write performed: no
- Production deploy performed: no
- GitHub push / PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
`;
}

function issue(field, message, code) {
  return { field, message, code };
}

function safeValue(value) {
  const text = String(value ?? "");
  if (sensitiveMatch(text)) return "[blocked-sensitive-looking-value]";
  return text;
}

function sensitiveMatch(value) {
  const text = String(value ?? "");
  if (!text) return null;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) return "email";
  if (/(?:\+?886|0)?9\d{8}/.test(text.replace(/[\s-]/g, ""))) return "phone";
  if (/\b(?:line[_-]?id|user[_-]?id|order[_-]?id|payment[_-]?id)\b/i.test(text)) return "identifier";
  return null;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(args) {
  const options = {};
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    options[toCamel(key)] = rest.length > 0 ? rest.join("=") : "true";
  }
  return options;
}

function resolveProjectPath(value, fallback) {
  if (!value) return fallback;
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

main();
