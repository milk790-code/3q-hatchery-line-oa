import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { planIdempotentAppend } from "./lib/idempotent-event-store.mjs";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DEFAULT_INPUT = path.join(ROOT, "data", "manual_conversions.example.csv");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "manual_conversions.preview.jsonl");
const STATUS_PATH = process.env.MANUAL_CONVERSION_STATUS_PATH
  ? path.resolve(process.env.MANUAL_CONVERSION_STATUS_PATH)
  : path.join(ROOT, "data", "manual_conversion_status.json");
const REAL_EVENTS_PATH = process.env.MANUAL_REAL_EVENTS_PATH
  ? path.resolve(process.env.MANUAL_REAL_EVENTS_PATH)
  : path.join(ROOT, "data", "lp_events.jsonl");

const ALLOWED_COLUMNS = [
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

const REQUIRED_COLUMNS = ["date", "asset_id", "event_type", "count"];
const ALLOWED_EVENT_TYPES = ["line_add", "lead_submit", "deal", "quality_flag"];

const SENSITIVE_COLUMN_PATTERNS = [
  "phone",
  "tel",
  "mobile",
  "email",
  "line_user_id",
  "line_id",
  "customer",
  "customer_name",
  "address",
  "payment",
  "card",
  "note",
  "memo",
  "message",
  "conversation",
  "name",
];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(ROOT, options.input ?? DEFAULT_INPUT);
  const outputPath = path.resolve(ROOT, options.output ?? DEFAULT_OUTPUT);
  const applyToRealEvents = options.apply && pathsEqual(outputPath, REAL_EVENTS_PATH);

  if (pathsEqual(outputPath, REAL_EVENTS_PATH) && !options.apply) {
    await writeStatus(blockedStatus(inputPath, outputPath, "Writing data/lp_events.jsonl requires --apply. Default mode is preview only."));
    console.error("Blocked: writing data/lp_events.jsonl requires --apply.");
    process.exitCode = 2;
    return;
  }

  if (options.apply && !options.append) {
    await writeStatus(blockedStatus(inputPath, outputPath, "Apply mode must append to preserve existing local events. Re-run with --append --apply."));
    console.error("Blocked: apply mode requires --append.");
    process.exitCode = 2;
    return;
  }

  if (options.apply && !pathsEqual(outputPath, REAL_EVENTS_PATH)) {
    await writeStatus(blockedStatus(inputPath, outputPath, "Apply mode is only valid when output is data/lp_events.jsonl."));
    console.error("Blocked: apply mode output must be data/lp_events.jsonl.");
    process.exitCode = 2;
    return;
  }

  if (applyToRealEvents && !options.confirmRealData) {
    await writeStatus(blockedStatus(inputPath, outputPath, "Apply mode requires --confirm-real-data so example or fixture rows are not accidentally scored."));
    console.error("Blocked: apply mode requires --confirm-real-data.");
    process.exitCode = 2;
    return;
  }

  const raw = await readFile(inputPath, "utf8");

  if (applyToRealEvents) {
    const exampleCheck = await detectExampleInput(inputPath, raw);
    if (exampleCheck.detected) {
      await writeStatus({
        ...blockedStatus(inputPath, outputPath, `Example/template manual conversion CSV cannot be applied to data/lp_events.jsonl: ${exampleCheck.reason}.`),
        confirm_real_data: Boolean(options.confirmRealData),
        example_input_detected: true,
      });
      console.error("Blocked: example/template manual conversion CSV cannot be applied to real events.");
      process.exitCode = 2;
      return;
    }
  }

  const parsed = parseCsv(raw);
  const validation = validateHeaders(parsed.headers);
  if (!validation.ok) {
    await writeStatus({
      ...blockedStatus(inputPath, outputPath, validation.error),
      contains_sensitive_columns: validation.containsSensitiveColumns,
      contains_sensitive_values: false,
    });
    console.error(validation.error);
    process.exitCode = 1;
    return;
  }

  const aggregateRows = parsed.rows.map((row, index) => normalizeAggregateRow(row, index + 2));
  const containsSensitiveValues = aggregateRows.some((row) => row.containsSensitiveValue);
  if (containsSensitiveValues) {
    await writeStatus({
      ...blockedStatus(inputPath, outputPath, "Sensitive-looking values were detected. Import only aggregate counts, never customer fields or private notes."),
      contains_sensitive_columns: false,
      contains_sensitive_values: true,
    });
    console.error("Sensitive-looking values were detected in the CSV.");
    process.exitCode = 1;
    return;
  }

  const events = aggregateRows.flatMap(expandAggregateRow);
  const existingEvents = applyToRealEvents ? await readJsonl(outputPath) : [];
  const appendPlan = planIdempotentAppend(existingEvents, events);
  const eventsToWrite = appendPlan.append;
  await mkdir(path.dirname(outputPath), { recursive: true });
  const body = eventsToWrite.map((event) => JSON.stringify(event)).join("\n") + (eventsToWrite.length > 0 ? "\n" : "");
  if (options.append) {
    if (body) await appendFile(outputPath, body);
  } else {
    await writeFile(outputPath, body);
  }

  const countsByEventType = events.reduce((acc, event) => {
    acc[event.event_type] = (acc[event.event_type] ?? 0) + 1;
    return acc;
  }, {});

  const status = {
    ok: true,
    generated_at: new Date().toISOString(),
    mode: applyToRealEvents ? "applied_local_events" : "preview",
    input_path: inputPath,
    output_path: outputPath,
    aggregate_rows_read: aggregateRows.length,
    events_prepared: events.length,
    events_written: eventsToWrite.length,
    existing_event_ids_skipped: appendPlan.skipped_event_ids.length,
    counts_by_event_type: countsByEventType,
    allowed_columns: ALLOWED_COLUMNS,
    allowed_event_types: ALLOWED_EVENT_TYPES,
    contains_sensitive_columns: false,
    contains_sensitive_values: false,
    confirm_real_data: Boolean(options.confirmRealData),
    example_input_detected: false,
    apply_performed: applyToRealEvents,
    append_performed: Boolean(options.append),
    data_lp_events_write_performed: applyToRealEvents,
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    note: applyToRealEvents
      ? "Local append only. Still no external send, deploy, public link change, customer mutation, payment, or deletion."
      : "Preview only. These aggregate conversion rows are not scored until explicitly applied to data/lp_events.jsonl.",
  };
  await writeStatus(status);
  console.log(JSON.stringify(status, null, 2));
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

function parseArgs(args) {
  const options = {
    input: null,
    output: null,
    append: false,
    apply: false,
    confirmRealData: false,
  };

  for (const arg of args) {
    if (arg.startsWith("--input=")) options.input = arg.slice("--input=".length);
    if (arg.startsWith("--output=")) options.output = arg.slice("--output=".length);
    if (arg === "--append") options.append = true;
    if (arg === "--apply") options.apply = true;
    if (arg === "--confirm-real-data") options.confirmRealData = true;
  }

  return options;
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

  if (quoted) {
    throw new Error("CSV has an unterminated quoted cell.");
  }
  cells.push(current);
  return cells;
}

function validateHeaders(headers) {
  const unknown = headers.filter((header) => !ALLOWED_COLUMNS.includes(header));
  const missing = REQUIRED_COLUMNS.filter((header) => !headers.includes(header));
  const sensitive = headers.filter((header) => isSensitiveKey(header));

  if (unknown.length > 0) {
    return {
      ok: false,
      containsSensitiveColumns: unknown.some((header) => isSensitiveKey(header)),
      error: `Unknown CSV columns are not allowed: ${unknown.join(", ")}.`,
    };
  }
  if (missing.length > 0) {
    return {
      ok: false,
      containsSensitiveColumns: false,
      error: `Missing required CSV columns: ${missing.join(", ")}.`,
    };
  }
  if (sensitive.length > 0) {
    return {
      ok: false,
      containsSensitiveColumns: true,
      error: `Sensitive CSV columns are not allowed: ${sensitive.join(", ")}.`,
    };
  }

  return { ok: true, containsSensitiveColumns: false };
}

function normalizeAggregateRow(row, lineNumber) {
  const eventType = row.event_type;
  if (!ALLOWED_EVENT_TYPES.includes(eventType)) {
    throw new Error(`CSV line ${lineNumber}: event_type must be one of ${ALLOWED_EVENT_TYPES.join(", ")}.`);
  }

  const count = Number(row.count);
  if (!Number.isInteger(count) || count < 1 || count > 10000) {
    throw new Error(`CSV line ${lineNumber}: count must be an integer from 1 to 10000.`);
  }

  const occurredAt = normalizeDate(row.date, lineNumber);
  const qualityScore = row.quality_score ? Number(row.quality_score) : undefined;
  if (qualityScore !== undefined && (!Number.isFinite(qualityScore) || qualityScore < 0 || qualityScore > 1)) {
    throw new Error(`CSV line ${lineNumber}: quality_score must be between 0 and 1.`);
  }

  const cleaned = {
    occurred_at: occurredAt,
    asset_id: requiredValue(row.asset_id, "asset_id", lineNumber),
    event_type: eventType,
    count,
    source: optionalValue(row.source),
    medium: optionalValue(row.medium),
    campaign: optionalValue(row.campaign),
    content_id: optionalValue(row.content_id),
    variant_id: optionalValue(row.variant_id),
    quality_score: qualityScore,
  };

  return {
    ...cleaned,
    containsSensitiveValue: Object.entries(cleaned).some(([key, value]) => value !== undefined && looksSensitive(String(value), key)),
  };
}

function expandAggregateRow(row) {
  const events = [];
  for (let index = 0; index < row.count; index += 1) {
    const event = {
      event_id: `manual:${hashEvent(row, index)}`,
      occurred_at: addSeconds(row.occurred_at, index),
      asset_id: row.asset_id,
      variant_id: row.variant_id,
      content_id: row.content_id,
      source: row.source ?? "manual",
      medium: row.medium ?? "aggregate",
      campaign: row.campaign,
      event_type: row.event_type,
      quality_score: row.event_type === "quality_flag" ? row.quality_score ?? 1 : undefined,
      metadata_json: {
        import_source: "manual_aggregate",
        aggregate_only: true,
        no_pii: true,
      },
    };
    events.push(event);
  }
  return events;
}

function normalizeDate(value, lineNumber) {
  const raw = requiredValue(value, "date", lineNumber);
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00+08:00` : raw;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`CSV line ${lineNumber}: date is not parseable.`);
  }
  return normalized;
}

function addSeconds(isoLike, seconds) {
  const parsed = new Date(isoLike);
  parsed.setSeconds(parsed.getSeconds() + seconds);
  return parsed.toISOString();
}

function requiredValue(value, field, lineNumber) {
  const cleaned = optionalValue(value);
  if (!cleaned) {
    throw new Error(`CSV line ${lineNumber}: ${field} is required.`);
  }
  return cleaned;
}

function optionalValue(value) {
  const cleaned = String(value ?? "").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function hashEvent(row, index) {
  return createHash("sha256")
    .update(`${row.occurred_at}|${row.asset_id}|${row.event_type}|${row.source ?? ""}|${row.medium ?? ""}|${row.campaign ?? ""}|${row.content_id ?? ""}|${row.variant_id ?? ""}|${index}`)
    .digest("hex")
    .slice(0, 24);
}

function isSensitiveKey(key) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
  return SENSITIVE_COLUMN_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function looksSensitive(value, key) {
  if (key === "date" || key === "occurred_at" || key === "count" || key === "quality_score") {
    return false;
  }
  const normalized = value.trim();
  if (!normalized) return false;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(normalized)) return true;
  if (/(?:\+?886[-\s]?)?0?9\d{2}[-\s]?\d{3}[-\s]?\d{3}/.test(normalized)) return true;
  if (/line[_\s-]?user[_\s-]?id/i.test(normalized)) return true;
  return false;
}

function pathsEqual(left, right) {
  return path.resolve(left) === path.resolve(right);
}

async function detectExampleInput(inputPath, raw) {
  if (pathsEqual(inputPath, DEFAULT_INPUT) || path.basename(inputPath).includes(".example.")) {
    return { detected: true, reason: "input path is an example/template file" };
  }
  try {
    const exampleRaw = await readFile(DEFAULT_INPUT, "utf8");
    if (normalizeCsvForCompare(raw) === normalizeCsvForCompare(exampleRaw)) {
      return { detected: true, reason: "input content matches data/manual_conversions.example.csv" };
    }
  } catch {
    return { detected: false, reason: null };
  }
  return { detected: false, reason: null };
}

function normalizeCsvForCompare(raw) {
  return raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
}

function blockedStatus(inputPath, outputPath, blockedBy) {
  return {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "blocked",
    input_path: inputPath,
    output_path: outputPath,
    blocked_by: blockedBy,
    contains_sensitive_columns: false,
    contains_sensitive_values: false,
    confirm_real_data: false,
    example_input_detected: false,
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

async function writeStatus(status) {
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
}

main().catch(async (error) => {
  await writeStatus({
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "failed",
    error: error instanceof Error ? error.message : "unknown_error",
    apply_performed: false,
    append_performed: false,
    external_effect: false,
  });
  console.error(error);
  process.exitCode = 1;
});
