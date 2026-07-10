import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "config", "growth-loop.config.json");
const DEFAULT_INPUT_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const STATUS_PATH = path.join(ROOT, "data", "event_input_quality_status.json");

const ALLOWED_EVENT_TYPES = new Set([
  "link_click",
  "page_view",
  "cta_click",
  "line_add",
  "lead_submit",
  "deal",
  "quality_flag",
]);

const ALLOWED_KEYS = new Set([
  "event_id",
  "occurred_at",
  "asset_id",
  "variant_id",
  "content_id",
  "session_id",
  "source",
  "medium",
  "campaign",
  "event_type",
  "url",
  "referrer",
  "user_agent_hash",
  "ip_country",
  "value_amount",
  "quality_score",
  "metadata_json",
]);

const SENSITIVE_KEY_PATTERNS = [
  "phone",
  "tel",
  "mobile",
  "email",
  "mail",
  "line_user_id",
  "lineid",
  "line_id",
  "customer",
  "customer_name",
  "name",
  "address",
  "payment",
  "card",
  "note",
  "memo",
  "message",
  "conversation",
  "profile",
  "birth",
  "birthday",
];

function parseArgs(args) {
  const options = { input: DEFAULT_INPUT_PATH };
  for (const arg of args) {
    if (arg.startsWith("--input=")) options.input = path.resolve(ROOT, arg.slice("--input=".length));
  }
  return options;
}

async function main() {
  const generatedAt = new Date();
  const options = parseArgs(process.argv.slice(2));
  const inputPath = options.input;
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const knownAssetIds = new Set((config.assets ?? []).map((asset) => asset.asset_id));
  const raw = await readOptional(inputPath);
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const issues = [];
  const warnings = [];
  const eventTypeCounts = {};
  const assetCounts = {};
  const seenEventIds = new Set();
  const duplicateEventIds = [];

  for (const [lineIndex, line] of lines.entries()) {
    const lineNumber = lineIndex + 1;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      issues.push(issue(lineNumber, "invalid_json", "Line is not valid JSON."));
      continue;
    }

    if (!event || typeof event !== "object" || Array.isArray(event)) {
      issues.push(issue(lineNumber, "invalid_event_object", "Line must be one JSON object."));
      continue;
    }

    const keys = Object.keys(event);
    for (const key of keys) {
      if (!ALLOWED_KEYS.has(key)) {
        issues.push(issue(lineNumber, "unknown_key", `Unknown event key: ${key}.`, key));
      }
      if (isSensitiveKey(key)) {
        issues.push(issue(lineNumber, "sensitive_key", `Sensitive key is not allowed: ${key}.`, key));
      }
    }

    const eventId = requiredString(event.event_id);
    if (!eventId) {
      issues.push(issue(lineNumber, "event_id_required", "event_id is required."));
    } else if (seenEventIds.has(eventId)) {
      duplicateEventIds.push(eventId);
      issues.push(issue(lineNumber, "duplicate_event_id", `Duplicate event_id: ${eventId}.`, "event_id"));
    } else {
      seenEventIds.add(eventId);
    }

    const occurredAt = requiredString(event.occurred_at);
    if (!occurredAt || Number.isNaN(new Date(occurredAt).valueOf())) {
      issues.push(issue(lineNumber, "occurred_at_invalid", "occurred_at must be parseable."));
    }

    const assetId = requiredString(event.asset_id);
    if (!assetId) {
      issues.push(issue(lineNumber, "asset_id_required", "asset_id is required."));
    } else if (!knownAssetIds.has(assetId)) {
      issues.push(issue(lineNumber, "unknown_asset_id", `Unknown asset_id: ${assetId}.`, "asset_id"));
    } else {
      assetCounts[assetId] = (assetCounts[assetId] ?? 0) + 1;
    }

    const eventType = requiredString(event.event_type);
    if (!eventType || !ALLOWED_EVENT_TYPES.has(eventType)) {
      issues.push(issue(lineNumber, "invalid_event_type", `Invalid event_type: ${eventType ?? "missing"}.`, "event_type"));
    } else {
      eventTypeCounts[eventType] = (eventTypeCounts[eventType] ?? 0) + 1;
    }

    validateOptionalString(event, "variant_id", lineNumber, issues);
    validateOptionalString(event, "content_id", lineNumber, issues);
    validateOptionalString(event, "session_id", lineNumber, issues);
    validateOptionalString(event, "source", lineNumber, issues);
    validateOptionalString(event, "medium", lineNumber, issues);
    validateOptionalString(event, "campaign", lineNumber, issues);
    validateOptionalString(event, "url", lineNumber, issues);
    validateOptionalString(event, "referrer", lineNumber, issues);
    validateOptionalString(event, "user_agent_hash", lineNumber, issues);
    validateOptionalString(event, "ip_country", lineNumber, issues);
    validateOptionalNumber(event, "value_amount", lineNumber, issues);
    validateOptionalNumber(event, "quality_score", lineNumber, issues, { min: 0, max: 1 });

    const metadata = normalizeMetadata(event.metadata_json, lineNumber, issues);
    if (metadata) {
      scanObjectForSensitiveData(metadata, lineNumber, "metadata_json", issues);
    }

    scanObjectForSensitiveValues(event, lineNumber, "", issues);
  }

  if (lines.length === 0) {
    warnings.push("No real events found. Scoring can run, but the champion must stay unchanged until sample thresholds are met.");
  }

  const status = {
    ok: issues.length === 0,
    generated_at: generatedAt.toISOString(),
    mode: "real_event_input_quality_gate",
    input_path: inputPath,
    rows_scanned: lines.length,
    event_type_counts: eventTypeCounts,
    asset_counts: assetCounts,
    duplicate_event_ids: [...new Set(duplicateEventIds)],
    issues,
    warnings,
    scoring_allowed: issues.length === 0,
    pii_or_sensitive_data_detected: issues.some((item) => item.code === "sensitive_key" || item.code === "sensitive_value"),
    unknown_asset_ids: uniqueIssueValues(issues, "unknown_asset_id"),
    unknown_event_types: uniqueIssueValues(issues, "invalid_event_type"),
    unknown_keys: uniqueIssueValues(issues, "unknown_key"),
    privacy_rules: {
      allowed_keys: [...ALLOWED_KEYS],
      allowed_event_types: [...ALLOWED_EVENT_TYPES],
      sensitive_key_patterns: SENSITIVE_KEY_PATTERNS,
      aggregate_or_pseudonymous_only: true,
    },
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    data_lp_events_write_performed: false,
    note: "Read-only local quality gate for data/lp_events.jsonl. Blocks scoring on malformed events, unknown assets, duplicates, or sensitive customer data.",
  };

  await writeStatus(status);
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function issue(line, code, message, key = null) {
  return { line, code, key, message };
}

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function validateOptionalString(event, key, lineNumber, issues) {
  if (event[key] == null) return;
  if (typeof event[key] !== "string") {
    issues.push(issue(lineNumber, "invalid_string", `${key} must be a string when present.`, key));
  }
}

function validateOptionalNumber(event, key, lineNumber, issues, bounds = {}) {
  if (event[key] == null) return;
  if (typeof event[key] !== "number" || !Number.isFinite(event[key])) {
    issues.push(issue(lineNumber, "invalid_number", `${key} must be a finite number when present.`, key));
    return;
  }
  if (bounds.min != null && event[key] < bounds.min) {
    issues.push(issue(lineNumber, "invalid_number", `${key} must be >= ${bounds.min}.`, key));
  }
  if (bounds.max != null && event[key] > bounds.max) {
    issues.push(issue(lineNumber, "invalid_number", `${key} must be <= ${bounds.max}.`, key));
  }
}

function normalizeMetadata(value, lineNumber, issues) {
  if (value == null) return null;
  if (typeof value === "string") {
    if (value.trim().length === 0) return null;
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      issues.push(issue(lineNumber, "invalid_metadata", "metadata_json string must parse to an object.", "metadata_json"));
      return null;
    } catch {
      issues.push(issue(lineNumber, "invalid_metadata", "metadata_json string is not valid JSON.", "metadata_json"));
      return null;
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) return value;
  issues.push(issue(lineNumber, "invalid_metadata", "metadata_json must be an object or JSON object string.", "metadata_json"));
  return null;
}

function scanObjectForSensitiveData(object, lineNumber, prefix, issues) {
  for (const [key, value] of Object.entries(object)) {
    const pathKey = `${prefix}.${key}`;
    if (isSensitiveKey(key)) {
      issues.push(issue(lineNumber, "sensitive_key", `Sensitive metadata key is not allowed: ${pathKey}.`, pathKey));
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      scanObjectForSensitiveData(value, lineNumber, pathKey, issues);
      continue;
    }
    if (typeof value === "string" && looksSensitiveValue(value)) {
      issues.push(issue(lineNumber, "sensitive_value", `Sensitive-looking metadata value is not allowed at ${pathKey}.`, pathKey));
    }
  }
}

function scanObjectForSensitiveValues(object, lineNumber, prefix, issues) {
  for (const [key, value] of Object.entries(object)) {
    if (key === "metadata_json") continue;
    const pathKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string" && looksSensitiveValue(value)) {
      issues.push(issue(lineNumber, "sensitive_value", `Sensitive-looking value is not allowed at ${pathKey}.`, pathKey));
    }
  }
}

function isSensitiveKey(key) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern.replace(/[^a-z0-9_]/g, "")));
}

function looksSensitiveValue(value) {
  const normalized = value.trim();
  if (!normalized) return false;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(normalized)) return true;
  if (/(?:\+?886[-\s]?)?0?9\d{2}[-\s]?\d{3}[-\s]?\d{3}/.test(normalized)) return true;
  if (/line[_\s-]?user[_\s-]?id/i.test(normalized)) return true;
  if (/\b(?:\d[ -]*?){13,19}\b/.test(normalized)) return true;
  return false;
}

function uniqueIssueValues(issues, code) {
  return [...new Set(issues.filter((item) => item.code === code).map((item) => item.message))];
}

async function writeStatus(status) {
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
}

main().catch(async (error) => {
  const status = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "failed",
    error: error instanceof Error ? error.message : "unknown_error",
    scoring_allowed: false,
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    data_lp_events_write_performed: false,
  };
  await writeStatus(status);
  console.error(error);
  process.exitCode = 1;
});
