import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "config", "growth-loop.config.json");
const PACK_DIR = path.join(ROOT, "data", "real_data_input_pack");
const STATUS_PATH = path.join(ROOT, "data", "real_data_input_pack_status.json");
const REPORT_PATH = path.join(ROOT, "real_data_input_pack.md");
const FUNNEL_TEMPLATE_PATH = path.join(PACK_DIR, "funnel_aggregates.fill-template.csv");
const MANUAL_TEMPLATE_PATH = path.join(PACK_DIR, "manual_conversions.fill-template.csv");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");

const FUNNEL_LIVE_TARGET = path.join(ROOT, "data", "funnel_aggregates.csv");
const MANUAL_LIVE_TARGET = path.join(ROOT, "data", "manual_conversions.csv");

const CSV_HEADERS = [
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

const FUNNEL_EVENT_TYPES = ["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"];
const MANUAL_EVENT_TYPES = ["line_add", "lead_submit", "deal", "quality_flag"];

async function main() {
  const generatedAt = new Date();
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const week = currentTaipeiWeek(generatedAt);
  const realEventsBefore = await countLines(REAL_EVENTS_PATH);
  const links = buildTemplateLinks(config, week);
  const funnelRows = buildRows(links.filter((link) => link.include_in_funnel_template), FUNNEL_EVENT_TYPES, week.start);
  const manualRows = buildRows(links.filter((link) => link.include_in_manual_template), MANUAL_EVENT_TYPES, week.start);

  await mkdir(PACK_DIR, { recursive: true });
  await writeFile(FUNNEL_TEMPLATE_PATH, renderCsv(funnelRows));
  await writeFile(MANUAL_TEMPLATE_PATH, renderCsv(manualRows));

  const realEventsAfter = await countLines(REAL_EVENTS_PATH);
  const liveInputs = [
    {
      source_id: "funnel_aggregates",
      live_target: FUNNEL_LIVE_TARGET,
      exists_now: await exists(FUNNEL_LIVE_TARGET),
    },
    {
      source_id: "manual_conversions",
      live_target: MANUAL_LIVE_TARGET,
      exists_now: await exists(MANUAL_LIVE_TARGET),
    },
  ];

  const status = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "real_data_input_pack",
    status: "template_ready",
    week,
    output_dir: PACK_DIR,
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    template_only: true,
    owner_review_required: true,
    live_input_files_created: false,
    real_events_before: realEventsBefore,
    real_events_after: realEventsAfter,
    real_events_unchanged: realEventsBefore === realEventsAfter,
    templates: [
      {
        source_id: "funnel_aggregates",
        label: "Full-funnel aggregate fill template",
        template_path: FUNNEL_TEMPLATE_PATH,
        live_target: FUNNEL_LIVE_TARGET,
        rows: funnelRows.length,
        expected_event_types: FUNNEL_EVENT_TYPES,
        required_owner_action: "Fill the count column with reviewed aggregate numbers, then copy to data/funnel_aggregates.csv before preview/apply.",
      },
      {
        source_id: "manual_conversions",
        label: "Manual LINE / lead / deal conversion fill template",
        template_path: MANUAL_TEMPLATE_PATH,
        live_target: MANUAL_LIVE_TARGET,
        rows: manualRows.length,
        expected_event_types: MANUAL_EVENT_TYPES,
        required_owner_action: "Fill the count column with reviewed aggregate LINE/customer-service outcomes, then copy to data/manual_conversions.csv before preview/apply.",
      },
    ],
    live_inputs: liveInputs,
    copy_commands_after_fill: [
      "cp data/real_data_input_pack/funnel_aggregates.fill-template.csv data/funnel_aggregates.csv",
      "cp data/real_data_input_pack/manual_conversions.fill-template.csv data/manual_conversions.csv",
    ],
    follow_up_commands_after_copy: ["npm run real-data:intake", "npm run event:quality", "npm run week0"],
    safety_rules: [
      "Templates live under data/real_data_input_pack/ and are not scored.",
      "The script never creates data/funnel_aggregates.csv or data/manual_conversions.csv.",
      "The count column is intentionally blank; importers reject blank counts until reviewed aggregate numbers are filled.",
      "Do not include phone, email, LINE user ID, customer name, address, payment fields, private notes, messages, or conversation text.",
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
  await writeFile(REPORT_PATH, renderMarkdown(status));
  console.log(JSON.stringify(status, null, 2));
}

function buildTemplateLinks(config, week) {
  const baseUrl = config.local_public_base_url ?? "http://127.0.0.1:8787";
  const roundId = config.current_round?.round_id ?? "week0";
  const challenger = (config.assets ?? []).find((asset) => asset.role === "challenger");
  const assetLinks = (config.assets ?? []).map((asset) => {
    const role = asset.role ?? "asset";
    const trackingUrl = new URL(`/r/${asset.asset_id}`, baseUrl);
    trackingUrl.searchParams.set("to", role === "champion" ? "champion" : "challenger");
    trackingUrl.searchParams.set("utm_source", "manual_review");
    trackingUrl.searchParams.set("utm_medium", "growth_loop");
    trackingUrl.searchParams.set("utm_campaign", roundId);
    trackingUrl.searchParams.set("variant_id", asset.asset_id);
    trackingUrl.searchParams.set("content_id", `${week.start}-${role}`);
    return templateLinkFromUrl({
      role,
      asset_id: asset.asset_id,
      tracking_url: trackingUrl.toString(),
      include_in_funnel_template: true,
      include_in_manual_template: role !== "champion",
    });
  });

  const lineCtaLink = challenger
    ? templateLinkFromUrl({
      role: "line_cta",
      asset_id: challenger.asset_id,
      tracking_url: lineCtaUrl(baseUrl, challenger.asset_id, roundId, week.start),
      include_in_funnel_template: true,
      include_in_manual_template: true,
    })
    : null;

  const draftLinks = (config.content_variant_drafts ?? []).map((draft) => {
    const trackingUrl = new URL(`/r/${challenger?.asset_id ?? "challenger-week0-cta-text-v1"}`, baseUrl);
    trackingUrl.searchParams.set("to", "challenger");
    trackingUrl.searchParams.set("utm_source", "manual_review");
    trackingUrl.searchParams.set("utm_medium", "growth_loop");
    trackingUrl.searchParams.set("utm_campaign", roundId);
    trackingUrl.searchParams.set("variant_id", draft.variant_id);
    trackingUrl.searchParams.set("content_id", draft.content_id);
    return templateLinkFromUrl({
      role: "content_variant",
      asset_id: challenger?.asset_id ?? "challenger-week0-cta-text-v1",
      tracking_url: trackingUrl.toString(),
      include_in_funnel_template: true,
      include_in_manual_template: true,
    });
  });

  return [...assetLinks, ...(lineCtaLink ? [lineCtaLink] : []), ...draftLinks]
    .filter((link) => typeof link.asset_id === "string" && !link.asset_id.includes(":"));
}

function lineCtaUrl(baseUrl, assetId, roundId, weekStart) {
  const trackingUrl = new URL(`/r/${assetId}`, baseUrl);
  trackingUrl.searchParams.set("to", "line");
  trackingUrl.searchParams.set("utm_source", "manual_review");
  trackingUrl.searchParams.set("utm_medium", "growth_loop");
  trackingUrl.searchParams.set("utm_campaign", roundId);
  trackingUrl.searchParams.set("variant_id", `${assetId}-line`);
  trackingUrl.searchParams.set("content_id", `${weekStart}-line-cta`);
  return trackingUrl.toString();
}

function templateLinkFromUrl(link) {
  const url = new URL(link.tracking_url);
  return {
    ...link,
    source: url.searchParams.get("utm_source") ?? "manual_review",
    medium: url.searchParams.get("utm_medium") ?? "growth_loop",
    campaign: url.searchParams.get("utm_campaign") ?? "",
    content_id: url.searchParams.get("content_id") ?? `${link.role}-content`,
    variant_id: url.searchParams.get("variant_id") ?? link.asset_id,
  };
}

function buildRows(links, eventTypes, date) {
  const rows = [];
  const seen = new Set();
  for (const link of links) {
    for (const eventType of eventTypes) {
      const key = `${date}|${link.asset_id}|${eventType}|${link.content_id}|${link.variant_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        date,
        asset_id: link.asset_id,
        event_type: eventType,
        count: "",
        source: link.source,
        medium: link.medium,
        campaign: link.campaign,
        content_id: link.content_id,
        variant_id: link.variant_id,
        quality_score: "",
      });
    }
  }
  return rows;
}

function renderCsv(rows) {
  return `${CSV_HEADERS.join(",")}\n${rows.map((row) => CSV_HEADERS.map((header) => csvEscape(row[header] ?? "")).join(",")).join("\n")}\n`;
}

function renderMarkdown(status) {
  const templateRows = status.templates
    .map((template) => `| ${template.source_id} | ${relative(template.template_path)} | ${relative(template.live_target)} | ${template.rows} | ${template.expected_event_types.join(", ")} |`)
    .join("\n");
  const liveRows = status.live_inputs
    .map((input) => `| ${input.source_id} | ${relative(input.live_target)} | ${input.exists_now ? "yes" : "no"} |`)
    .join("\n");

  return `# 3Q Growth Loop Real Data Input Pack

BLUF: Template-only input pack is ready. It reduces the Week 0 real-data handoff to filling aggregate counts, but it does not create live input files, score rows, append data/lp_events.jsonl, publish, deploy, push LINE, mutate customer data, touch payment, or delete anything.

Generated: ${status.generated_at}
Mode: ${status.mode}
Status: ${status.status}
Week: ${status.week.start} to ${status.week.end}
External effect: no
data/lp_events.jsonl write performed: no
Live input files created: no
Real events unchanged: ${status.real_events_unchanged ? "yes" : "no"}

## Templates

| source | fill template | live target after owner fill | rows | event types |
|---|---|---|---:|---|
${templateRows}

## Live Input Status

| source | live target | exists now |
|---|---|---|
${liveRows}

## After Filling Counts

\`\`\`zsh
${status.copy_commands_after_fill.join("\n")}
${status.follow_up_commands_after_copy.join("\n")}
\`\`\`

## Rules

- Fill only aggregate counts. Never paste customer-level rows.
- Leave phone, email, LINE user ID, customer name, address, payment fields, private notes, messages, and conversation text out of every CSV.
- Blank count cells are intentional; importers reject them until reviewed numbers are filled.
- After copying into the live target, run the intake preview first. Apply remains owner-gated.
`;
}

function csvEscape(value) {
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function currentTaipeiWeek(date) {
  const taipei = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const day = taipei.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(taipei);
  start.setDate(taipei.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

function relative(filePath) {
  return path.relative(ROOT, filePath);
}

main();
