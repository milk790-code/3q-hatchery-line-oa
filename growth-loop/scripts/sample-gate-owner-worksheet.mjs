import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const TEMPLATE_PATH = path.join(ROOT, "data", "source_capture", "sample_gate_ledger.fill-template.csv");
const OWNER_FILLED_PATH = path.join(ROOT, "data", "source_capture", "sample_gate_ledger.filled.csv");
const OWNER_SAMPLE_GATE_STATUS_PATH = path.join(ROOT, "data", "owner_sample_gate_status.json");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const JSON_PATH = path.join(ROOT, "sample_gate_owner_worksheet.json");
const STATUS_PATH = path.join(ROOT, "data", "sample_gate_owner_worksheet_status.json");
const REPORT_PATH = path.join(ROOT, "sample_gate_owner_worksheet.md");

const REQUIRED_OWNER_FIELDS = ["capture_date", "aggregate_count", "evidence_ref", "reviewer", "pii_checked"];
const P0_EVENTS = ["page_view", "cta_click", "line_add"];

async function main() {
  const generatedAt = new Date();
  const realEventsBefore = await countLines(REAL_EVENTS_PATH);
  const templateRaw = await readFile(TEMPLATE_PATH, "utf8");
  const parsed = parseCsv(templateRaw);
  const rows = parsed.rows.map((row, index) => decorateRow(row, index + 2));
  const ownerStatus = await readOptionalJson(OWNER_SAMPLE_GATE_STATUS_PATH, {});
  const ownerFilledExists = await exists(OWNER_FILLED_PATH);
  const realEventsAfter = await countLines(REAL_EVENTS_PATH);
  const sourceGroups = buildSourceGroups(rows);
  const linkCount = new Set(rows.map((row) => row.tracking_link_id)).size;
  const status = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "sample_gate_owner_worksheet",
    status: ownerFilledExists ? "owner_filled_ledger_detected_review_compile_next" : "waiting_for_owner_sample_gate_counts",
    worksheet_path: REPORT_PATH,
    json_path: JSON_PATH,
    status_path: STATUS_PATH,
    template_path: TEMPLATE_PATH,
    owner_filled_path: OWNER_FILLED_PATH,
    owner_filled_exists: ownerFilledExists,
    owner_sample_gate_status: ownerStatus.status ?? "unknown",
    row_count: rows.length,
    p0_event_types: P0_EVENTS,
    link_count: linkCount,
    source_group_count: sourceGroups.length,
    required_owner_fields: REQUIRED_OWNER_FIELDS,
    p0_rows_by_event_type: countBy(rows, "stage"),
    p0_rows_by_source_surface: countBy(rows, "source_surface"),
    source_groups: sourceGroups,
    rows,
    commands: {
      create_owner_working_copy: "cp data/source_capture/sample_gate_ledger.fill-template.csv data/source_capture/sample_gate_ledger.filled.csv",
      preview_sample_gate_ledger: "npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled",
      check_owner_sample_gate: "npm run owner:sample-gate",
      rerun_north_star: "npm run north-star",
    },
    owner_review_required: true,
    live_input_files_created: false,
    real_events_before: realEventsBefore,
    real_events_after: realEventsAfter,
    real_events_unchanged: realEventsBefore === realEventsAfter,
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

  await writeJson(JSON_PATH, status);
  await writeJson(STATUS_PATH, compactStatus(status));
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(compactStatus(status), null, 2));
}

function decorateRow(row, rowNumber) {
  const stage = row.stage?.trim() ?? "";
  return {
    row_number: rowNumber,
    stage,
    stage_label: row.stage_label?.trim() ?? stage,
    asset_id: row.asset_id?.trim() ?? "",
    content_id: row.content_id?.trim() ?? "",
    variant_id: row.variant_id?.trim() ?? "",
    tracking_link_id: row.tracking_link_id?.trim() ?? "",
    source_surface: row.source_surface?.trim() ?? "",
    source_metric: row.source_metric?.trim() ?? "",
    target_live_file: row.target_live_file?.trim() ?? "",
    evidence_rule: row.notes?.trim() ?? "",
    fill_fields: REQUIRED_OWNER_FIELDS,
    source_group: stage === "line_add" ? "LINE OA aggregate" : "Landing analytics aggregate",
    what_to_collect: stage === "line_add"
      ? "line_add aggregate count by tracking context"
      : `${stage} aggregate count by asset_id / content_id / variant_id`,
    pii_rule: stage === "line_add"
      ? "Do not paste LINE user IDs, names, chat text, notes, or customer rows."
      : "Do not paste IP, User-Agent, session rows, or visitor identifiers.",
  };
}

function buildSourceGroups(rows) {
  const byGroup = new Map();
  for (const row of rows) {
    if (!byGroup.has(row.source_group)) {
      byGroup.set(row.source_group, {
        source_group: row.source_group,
        source_surface: row.source_surface,
        event_types: new Set(),
        row_count: 0,
        link_ids: new Set(),
        pii_rule: row.pii_rule,
      });
    }
    const group = byGroup.get(row.source_group);
    group.event_types.add(row.stage);
    group.row_count += 1;
    group.link_ids.add(row.tracking_link_id);
  }

  return Array.from(byGroup.values()).map((group) => ({
    ...group,
    event_types: Array.from(group.event_types),
    link_count: group.link_ids.size,
    link_ids: Array.from(group.link_ids),
  }));
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function compactStatus(status) {
  return {
    ok: status.ok,
    generated_at: status.generated_at,
    mode: status.mode,
    status: status.status,
    worksheet_path: status.worksheet_path,
    json_path: status.json_path,
    template_path: status.template_path,
    owner_filled_path: status.owner_filled_path,
    owner_filled_exists: status.owner_filled_exists,
    owner_sample_gate_status: status.owner_sample_gate_status,
    row_count: status.row_count,
    link_count: status.link_count,
    source_group_count: status.source_group_count,
    required_owner_fields: status.required_owner_fields,
    live_input_files_created: false,
    real_events_unchanged: status.real_events_unchanged,
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

function renderReport(status) {
  const sourceRows = status.source_groups.map((group) => `| ${group.source_group} | ${group.event_types.join(", ")} | ${group.row_count} | ${group.link_count} | ${group.source_surface} |`).join("\n");
  const checklistRows = status.rows.map((row) => `| ${row.row_number} | ${row.tracking_link_id} | ${row.stage} | ${row.asset_id} | ${row.content_id} | ${row.variant_id} | ${row.source_group} |`).join("\n");
  const fieldRows = REQUIRED_OWNER_FIELDS.map((field) => `| ${field} | ${fieldRule(field)} |`).join("\n");

  return `# 3Q Growth Loop Sample Gate Owner Worksheet

BLUF: Fill these 18 aggregate-only rows first. This is the shortest path from Week 0 setup to a valid sample gate, without changing public links, deploying production, pushing LINE, touching customer data, or writing data/lp_events.jsonl.

Generated: ${status.generated_at}
Mode: ${status.mode}
Status: ${status.status}
Rows: ${status.row_count}
Links: ${status.link_count}
Owner-filled file exists: ${status.owner_filled_exists ? "yes" : "no"}
Owner sample gate status: ${status.owner_sample_gate_status}
Live input files created: no
data/lp_events.jsonl write performed: no
External effect: no

## Fast Fill Order

1. Make a reviewed working copy only after you are ready to fill counts:

\`\`\`zsh
${status.commands.create_owner_working_copy}
\`\`\`

2. Fill only these fields in \`data/source_capture/sample_gate_ledger.filled.csv\`:

| field | rule |
|---|---|
${fieldRows}

3. Preview the filled ledger. This creates owner-preview CSVs only:

\`\`\`zsh
${status.commands.preview_sample_gate_ledger}
${status.commands.check_owner_sample_gate}
${status.commands.rerun_north_star}
\`\`\`

## Source Groups

| group | event types | rows | links | source surface |
|---|---|---:|---:|---|
${sourceRows}

## 18-Row Checklist

| CSV row | tracking link | event | asset | content | variant | source group |
|---:|---|---|---|---|---|---|
${checklistRows}

## Hard Rules

- Use aggregate counts only.
- Evidence refs must be local screenshot/export references, not raw customer rows.
- Do not paste phone, email, LINE user ID, customer name, chat text, payment data, order IDs, refund details, or private notes.
- Do not create \`data/funnel_aggregates.csv\`, \`data/manual_conversions.csv\`, or append \`data/lp_events.jsonl\` from this worksheet.
- Sample-insufficient rounds keep the current champion and current variable.
`;
}

function fieldRule(field) {
  const rules = {
    capture_date: "YYYY-MM-DD, the date the aggregate count was captured.",
    aggregate_count: "Non-negative integer only.",
    evidence_ref: "Local screenshot/export path or short report reference only; no customer identifiers.",
    reviewer: "Owner/operator name or initials; no email/phone/customer identifier.",
    pii_checked: "yes/true/checked/ok/1 only after confirming no PII was pasted.",
  };
  return rules[field] ?? "Fill only if reviewed.";
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
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
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

async function readOptionalJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
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

main();
