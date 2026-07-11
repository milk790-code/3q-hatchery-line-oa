import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "config", "growth-loop.config.json");
const TRACKING_LINKS_PATH = path.join(ROOT, "tracking_links.json");
const SOURCE_READINESS_PATH = path.join(ROOT, "data", "source_readiness_status.json");
const INPUT_PACK_STATUS_PATH = path.join(ROOT, "data", "real_data_input_pack_status.json");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const OUTPUT_DIR = path.join(ROOT, "data", "source_capture");
const STATUS_PATH = path.join(ROOT, "data", "source_capture_status.json");
const CHECKLIST_PATH = path.join(OUTPUT_DIR, "source_capture_checklist.json");
const LEDGER_PATH = path.join(OUTPUT_DIR, "source_capture_ledger.fill-template.csv");
const LEDGER_FILLED_PATH = path.join(OUTPUT_DIR, "source_capture_ledger.filled.csv");
const SAMPLE_GATE_LEDGER_PATH = path.join(OUTPUT_DIR, "sample_gate_ledger.fill-template.csv");
const SAMPLE_GATE_LEDGER_FILLED_PATH = path.join(OUTPUT_DIR, "sample_gate_ledger.filled.csv");
const SAMPLE_GATE_LEDGER_STATUS_PATH = path.join(ROOT, "data", "sample_gate_ledger_status.json");
const SAMPLE_GATE_LEDGER_REPORT_PATH = path.join(ROOT, "sample_gate_ledger.md");
const REPORT_PATH = path.join(ROOT, "source_capture_pack.md");

const FUNNEL_TEMPLATE = "data/real_data_input_pack/funnel_aggregates.fill-template.csv";
const MANUAL_TEMPLATE = "data/real_data_input_pack/manual_conversions.fill-template.csv";
const FUNNEL_LIVE = "data/funnel_aggregates.csv";
const MANUAL_LIVE = "data/manual_conversions.csv";

const STAGE_GUIDES = {
  link_click: {
    label: "連結點擊",
    source_surface: "社群平台連結點擊報表 / remote D1 link_click",
    source_metric: "link clicks by content_id / variant_id",
    target_template: FUNNEL_TEMPLATE,
    target_live_file: FUNNEL_LIVE,
    evidence_rule: "只記 aggregate count 與報表截圖/匯出檔路徑；不要貼使用者名單。",
  },
  page_view: {
    label: "落地頁瀏覽",
    source_surface: "candidate Worker D1 / landing page analytics",
    source_metric: "page_view count by asset_id / content_id / variant_id",
    target_template: FUNNEL_TEMPLATE,
    target_live_file: FUNNEL_LIVE,
    evidence_rule: "只記 aggregate page views；不要存 IP、User-Agent、個人識別。",
  },
  cta_click: {
    label: "CTA 點擊",
    source_surface: "candidate Worker D1 / landing page analytics",
    source_metric: "cta_click count by asset_id / content_id / variant_id",
    target_template: FUNNEL_TEMPLATE,
    target_live_file: FUNNEL_LIVE,
    evidence_rule: "只記 aggregate CTA clicks；不要存個別 session 明細。",
  },
  line_add: {
    label: "LINE 進線 / 加好友",
    source_surface: "LINE OA 管理後台 / inbound customer-service aggregate",
    source_metric: "line_add aggregate count by tracking context",
    target_template: MANUAL_TEMPLATE,
    target_live_file: MANUAL_LIVE,
    evidence_rule: "只記新增數或進線數；不要貼 LINE user id、暱稱、聊天內容。",
  },
  lead_submit: {
    label: "留資",
    source_surface: "LINE 客服手動分桶 / lead qualification aggregate",
    source_metric: "lead_submit aggregate count",
    target_template: MANUAL_TEMPLATE,
    target_live_file: MANUAL_LIVE,
    evidence_rule: "只記合格留資數；不要貼姓名、電話、email、公司私密資料。",
  },
  deal: {
    label: "成交",
    source_surface: "owner-confirmed aggregate deal log",
    source_metric: "deal aggregate count",
    target_template: MANUAL_TEMPLATE,
    target_live_file: MANUAL_LIVE,
    evidence_rule: "只記成交筆數與金額桶；不要貼付款資訊、ECPay 訂單或退款資料。",
  },
  quality_flag: {
    label: "品質 / 垃圾訊號",
    source_surface: "LINE 客服手動分桶 / quality aggregate",
    source_metric: "quality_flag count and optional aggregate quality_score",
    target_template: MANUAL_TEMPLATE,
    target_live_file: MANUAL_LIVE,
    evidence_rule: "只記品質旗標數；不要貼對話原文或客戶資料。",
  },
};

const FUNNEL_EVENTS = ["link_click", "page_view", "cta_click"];
const DOWNSTREAM_EVENTS = ["line_add", "lead_submit", "deal", "quality_flag"];
const SAMPLE_GATE_EVENTS = new Set(["page_view", "cta_click", "line_add"]);

async function main() {
  const generatedAt = new Date();
  const config = await readJson(CONFIG_PATH);
  const tracking = await readJson(TRACKING_LINKS_PATH);
  const sourceReadiness = await readOptionalJson(SOURCE_READINESS_PATH, { ok: false, missing_stage_count: 7, real_event_rows: 0 });
  const inputPack = await readOptionalJson(INPUT_PACK_STATUS_PATH, { ok: false, templates: [] });
  const realEventsBefore = await countLines(REAL_EVENTS_PATH);
  const week = tracking.week ?? currentTaipeiWeek(generatedAt);
  const links = Array.isArray(tracking.links) ? tracking.links : [];
  const importableLinks = links.filter((link) => link.role !== "ab_small_traffic" && !String(link.asset_id ?? "").includes(":"));
  const abRouterLinks = links.filter((link) => link.role === "ab_small_traffic");
  const ledgerRows = buildLedgerRows(week, importableLinks);
  const sampleGateRows = ledgerRows.filter((row) => SAMPLE_GATE_EVENTS.has(row.stage));
  const checklist = buildChecklist({ generatedAt, config, week, links, importableLinks, abRouterLinks, sourceReadiness, inputPack, ledgerRows, sampleGateRows });

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(LEDGER_PATH, renderLedgerCsv(ledgerRows));
  await writeFile(SAMPLE_GATE_LEDGER_PATH, renderLedgerCsv(sampleGateRows));
  await writeJson(CHECKLIST_PATH, checklist);

  const realEventsAfter = await countLines(REAL_EVENTS_PATH);
  const sampleGateStatus = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "sample_gate_ledger_pack",
    status: "sample_gate_template_ready",
    week,
    template_path: SAMPLE_GATE_LEDGER_PATH,
    owner_fill_path: SAMPLE_GATE_LEDGER_FILLED_PATH,
    source_full_ledger_template_path: LEDGER_PATH,
    row_count: sampleGateRows.length,
    link_count: new Set(sampleGateRows.map((row) => row.tracking_link_id)).size,
    sample_stage_count: SAMPLE_GATE_EVENTS.size,
    required_event_types: Array.from(SAMPLE_GATE_EVENTS),
    compile_preview_command: "npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled",
    template_only: true,
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
  const status = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "source_capture_pack",
    status: sourceReadiness.real_event_rows > 0 ? "capture_pack_ready_real_events_present" : "waiting_for_owner_aggregate_capture",
    week,
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    checklist_path: CHECKLIST_PATH,
    ledger_template_path: LEDGER_PATH,
    sample_gate_ledger_template_path: SAMPLE_GATE_LEDGER_PATH,
    sample_gate_ledger_filled_path: SAMPLE_GATE_LEDGER_FILLED_PATH,
    sample_gate_ledger_status_path: SAMPLE_GATE_LEDGER_STATUS_PATH,
    sample_gate_ledger_report_path: SAMPLE_GATE_LEDGER_REPORT_PATH,
    source_readiness_status: sourceReadiness.status ?? "unknown",
    source_readiness_missing_stage_count: sourceReadiness.missing_stage_count ?? 0,
    real_event_rows: sourceReadiness.real_event_rows ?? 0,
    input_pack_status: inputPack.status ?? "unknown",
    tracking_links_total: links.length,
    importable_tracking_links: importableLinks.length,
    ab_router_gate_count: abRouterLinks.length,
    ledger_rows: ledgerRows.length,
    sample_gate_ledger_rows: sampleGateRows.length,
    stage_count: Object.keys(STAGE_GUIDES).length,
    template_only: true,
    owner_review_required: true,
    live_input_files_created: false,
    real_events_before: realEventsBefore,
    real_events_after: realEventsAfter,
    real_events_unchanged: realEventsBefore === realEventsAfter,
    next_owner_actions: [
      "Open source_capture_pack.md and collect aggregate counts only.",
      "Use data/source_capture/sample_gate_ledger.fill-template.csv first when the immediate goal is only the sample gate.",
      "Copy data/source_capture/sample_gate_ledger.fill-template.csv to data/source_capture/sample_gate_ledger.filled.csv before filling sample-gate counts.",
      "Copy data/source_capture/source_capture_ledger.fill-template.csv to data/source_capture/source_capture_ledger.filled.csv before filling counts, so the weekly runner can regenerate the template safely.",
      "Fill only aggregate_count, capture_date, evidence_ref, reviewer, and pii_checked in the filled ledger, then run npm run source:compile.",
      "For the sample-gate ledger, preview it with: npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled.",
      "After owner review, copy compiled owner-preview CSVs to live CSV names, then run npm run real-data:intake.",
    ],
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

  await writeJson(STATUS_PATH, status);
  await writeJson(SAMPLE_GATE_LEDGER_STATUS_PATH, sampleGateStatus);
  await writeFile(SAMPLE_GATE_LEDGER_REPORT_PATH, renderSampleGateLedgerReport(sampleGateStatus, sampleGateRows));
  await writeFile(REPORT_PATH, renderReport(status, checklist));
  console.log(JSON.stringify(status, null, 2));
}

function buildLedgerRows(week, links) {
  const rows = [];
  for (const link of links) {
    const url = new URL(link.tracking_url);
    const contentId = link.content_id ?? url.searchParams.get("content_id") ?? "";
    const variantId = link.variant_id ?? url.searchParams.get("variant_id") ?? "";
    const events = [
      ...FUNNEL_EVENTS,
      ...(link.role === "champion" ? DOWNSTREAM_EVENTS.map((eventType) => ({ eventType, forceFunnel: true })) : DOWNSTREAM_EVENTS),
    ];
    for (const item of events) {
      const eventType = typeof item === "string" ? item : item.eventType;
      const guide = STAGE_GUIDES[eventType];
      const targetTemplate = typeof item === "object" && item.forceFunnel ? FUNNEL_TEMPLATE : guide.target_template;
      const targetLiveFile = typeof item === "object" && item.forceFunnel ? FUNNEL_LIVE : guide.target_live_file;
      rows.push({
        week_start: week.start,
        week_end: week.end,
        capture_date: "",
        stage: eventType,
        stage_label: guide.label,
        asset_id: link.asset_id,
        content_id: contentId,
        variant_id: variantId,
        tracking_link_id: link.link_id,
        tracking_url: link.tracking_url,
        source_surface: guide.source_surface,
        source_metric: guide.source_metric,
        target_template: targetTemplate,
        target_live_file: targetLiveFile,
        aggregate_count: "",
        quality_score: "",
        evidence_ref: "",
        reviewer: "",
        pii_checked: "",
        notes: guide.evidence_rule,
      });
    }
  }
  return rows;
}

function buildChecklist({ generatedAt, config, week, links, importableLinks, abRouterLinks, sourceReadiness, inputPack, ledgerRows, sampleGateRows }) {
  return {
    generated_at: generatedAt.toISOString(),
    mode: "source_capture_checklist",
    operator: config.operator,
    week,
    one_variable: config.current_round?.changed_variable ?? "unknown",
    source_readiness: {
      status: sourceReadiness.status ?? "unknown",
      real_event_rows: sourceReadiness.real_event_rows ?? 0,
      missing_stage_count: sourceReadiness.missing_stage_count ?? 0,
      missing_stages: sourceReadiness.missing_stages ?? [],
    },
    input_pack: {
      ok: Boolean(inputPack.ok),
      status: inputPack.status ?? "unknown",
      template_count: (inputPack.templates ?? []).length,
      live_input_files_created: Boolean(inputPack.live_input_files_created),
    },
    links: links.map((link) => ({
      link_id: link.link_id,
      role: link.role,
      target: link.target,
      asset_id: link.asset_id,
      content_id: link.content_id ?? safeUrl(link.tracking_url)?.searchParams.get("content_id") ?? null,
      variant_id: link.variant_id ?? safeUrl(link.tracking_url)?.searchParams.get("variant_id") ?? null,
      importable_in_current_templates: importableLinks.some((item) => item.link_id === link.link_id),
      human_gate: link.human_gate ?? null,
    })),
    stages: Object.entries(STAGE_GUIDES).map(([eventType, guide]) => ({
      event_type: eventType,
      label: guide.label,
      source_surface: guide.source_surface,
      source_metric: guide.source_metric,
      target_template: guide.target_template,
      target_live_file: guide.target_live_file,
      evidence_rule: guide.evidence_rule,
    })),
    ab_router_gates: abRouterLinks.map((link) => ({
      link_id: link.link_id,
      tracking_url: link.tracking_url,
      status: "owner_gate_before_public_traffic",
      note: "Do not place this A/B router in public traffic until owner approves champion URL, candidate Worker production deploy, test duration, and rollback.",
    })),
    ledger: {
      template_path: LEDGER_PATH,
      filled_path: LEDGER_FILLED_PATH,
      sample_gate_template_path: SAMPLE_GATE_LEDGER_PATH,
      sample_gate_filled_path: SAMPLE_GATE_LEDGER_FILLED_PATH,
      rows: ledgerRows.length,
      sample_gate_rows: sampleGateRows.length,
      required_columns: LEDGER_HEADERS,
    },
    safety_rules: [
      "Collect aggregate counts only.",
      "Do not paste customer names, phone, email, LINE user ID, profile URLs, chat text, private notes, payment IDs, order IDs, or refund details.",
      "Evidence references should be local screenshot/export paths or short source labels, not raw customer rows.",
      "This pack does not publish, deploy, change public links, push LINE, mutate customer data, touch payments, or delete data.",
    ],
    external_effect: false,
  };
}

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

function renderLedgerCsv(rows) {
  return `${LEDGER_HEADERS.join(",")}\n${rows.map((row) => LEDGER_HEADERS.map((key) => csvEscape(row[key] ?? "")).join(",")).join("\n")}\n`;
}

function renderReport(status, checklist) {
  const stageRows = checklist.stages
    .map((stage) => `| ${stage.event_type} | ${stage.source_surface} | ${stage.source_metric} | ${stage.target_template} |`)
    .join("\n");
  const linkRows = checklist.links
    .map((link) => `| ${link.link_id} | ${link.role} | ${link.content_id ?? "n/a"} | ${link.variant_id ?? "n/a"} | ${link.importable_in_current_templates ? "yes" : "gate"} |`)
    .join("\n");
  const gateRows = checklist.ab_router_gates.length > 0
    ? checklist.ab_router_gates.map((gate) => `| ${gate.link_id} | ${gate.status} | ${gate.note} |`).join("\n")
    : "| none | n/a | n/a |";

  return `# 3Q Growth Loop Source Capture Pack

BLUF: The local engine can score safely, but it still needs reviewed aggregate source counts. This pack tells the owner exactly which aggregate metric to collect, where it goes, and what evidence is acceptable without customer data.

Generated: ${status.generated_at}
Mode: ${status.mode}
Status: ${status.status}
Week: ${status.week.start} to ${status.week.end}
Real event rows: ${status.real_event_rows}
Missing stages: ${status.source_readiness_missing_stage_count}
Tracking links: ${status.tracking_links_total}
Importable links: ${status.importable_tracking_links}
Ledger rows: ${status.ledger_rows}
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

## Source-To-Template Matrix

| event_type | source surface | aggregate metric | target fill template |
|---|---|---|---|
${stageRows}

## Tracking Link Coverage

| link_id | role | content_id | variant_id | importable now |
|---|---|---|---|---|
${linkRows}

## A/B Router Gates

| link_id | status | note |
|---|---|---|
${gateRows}

## Files To Use

- Ledger fill template: data/source_capture/source_capture_ledger.fill-template.csv
- Sample-gate fill template: data/source_capture/sample_gate_ledger.fill-template.csv
- Sample-gate owner-filled path: data/source_capture/sample_gate_ledger.filled.csv
- Sample-gate report: sample_gate_ledger.md
- Owner-filled ledger path: data/source_capture/source_capture_ledger.filled.csv
- Machine checklist: data/source_capture/source_capture_checklist.json
- Compile preview report: source_capture_compile_report.md
- Compile preview CSVs: data/source_capture/compiled/*.owner-preview.csv
- Funnel fill template: data/real_data_input_pack/funnel_aggregates.fill-template.csv
- Manual conversion fill template: data/real_data_input_pack/manual_conversions.fill-template.csv

## Owner Capture Rules

- Do not fill the template directly; the weekly runner regenerates it. Copy it to data/source_capture/source_capture_ledger.filled.csv first.
- For the first sample gate, copy data/source_capture/sample_gate_ledger.fill-template.csv to data/source_capture/sample_gate_ledger.filled.csv and fill only page_view, cta_click, and line_add counts.
- Fill aggregate counts only.
- Use local screenshot/export paths as evidence references; do not paste raw customer rows.
- Keep phone, email, LINE user ID, customer name, chat text, payment data, private notes, and order/refund details out of every file.
- After counts are filled, run \`npm run source:compile\` and review the owner-preview CSVs before copying anything to live CSV names.
- To preview only the sample-gate ledger, run \`npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled\`.
- After owner review, copy compiled owner-preview CSVs to live CSVs, run \`npm run real-data:intake\`, then review before any apply.
`;
}

function renderSampleGateLedgerReport(status, rows) {
  const eventRows = Array.from(SAMPLE_GATE_EVENTS)
    .map((eventType) => {
      const eventRowsForType = rows.filter((row) => row.stage === eventType);
      const targetFiles = Array.from(new Set(eventRowsForType.map((row) => row.target_live_file))).join(", ");
      return `| ${eventType} | ${eventRowsForType.length} | ${targetFiles} |`;
    })
    .join("\n");
  const linkRows = Array.from(new Map(rows.map((row) => [row.tracking_link_id, row])).values())
    .map((row, index) => `| ${index + 1} | ${row.tracking_link_id} | ${row.asset_id} | ${row.content_id} | ${row.variant_id} |`)
    .join("\n");

  return `# 3Q Growth Loop Sample Gate Ledger

BLUF: This is the 18-row owner fill pack for the first sample gate. It keeps only page_view, cta_click, and line_add rows so the owner can collect the minimum viable counts before any champion/challenger decision.

Generated: ${status.generated_at}
Mode: ${status.mode}
Status: ${status.status}
Week: ${status.week.start} to ${status.week.end}
Rows: ${status.row_count}
Links: ${status.link_count}
Template: data/source_capture/sample_gate_ledger.fill-template.csv
Owner-filled path: data/source_capture/sample_gate_ledger.filled.csv
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no

## Event Rows

| event_type | rows | target_live_file |
|---|---:|---|
${eventRows}

## Link Rows

| order | tracking_link_id | asset_id | content_id | variant_id |
|---:|---|---|---|---|
${linkRows}

## Owner Flow

\`\`\`zsh
cp data/source_capture/sample_gate_ledger.fill-template.csv data/source_capture/sample_gate_ledger.filled.csv
# Fill aggregate_count, capture_date, evidence_ref, reviewer, and pii_checked only.
npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled
\`\`\`

Keep customer names, phone, email, LINE user IDs, chat text, payment data, order IDs, refund data, and private notes out of the ledger. The compile command creates owner-preview CSVs only; it does not create live input files or append data/lp_events.jsonl.
`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readOptionalJson(filePath, fallback) {
  try {
    return await readJson(filePath);
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

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function currentTaipeiWeek(date) {
  const taipeiDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const day = taipeiDate.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(taipeiDate);
  start.setDate(taipeiDate.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start: dateOnly(start), end: dateOnly(end) };
}

function dateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function csvEscape(value) {
  const stringValue = String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

main();
