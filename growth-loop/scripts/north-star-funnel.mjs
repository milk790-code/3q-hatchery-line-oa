import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const SCORES_PATH = path.join(ROOT, "growth_scores.json");
const FUNNEL_BREAKDOWN_PATH = path.join(ROOT, "funnel_breakdown.json");
const OWNER_SAMPLE_GATE_PATH = path.join(ROOT, "data", "owner_sample_gate_status.json");
const EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const JSON_PATH = path.join(ROOT, "north_star_funnel.json");
const MD_PATH = path.join(ROOT, "north_star_funnel.md");

async function main() {
  const generatedAt = new Date();
  const eventHashBefore = await fileHash(EVENTS_PATH);
  const scores = await readJson(SCORES_PATH);
  const funnelBreakdown = await readJson(FUNNEL_BREAKDOWN_PATH);
  const ownerSampleGate = await readJson(OWNER_SAMPLE_GATE_PATH);

  const assetRows = (scores.assets ?? []).map((asset) => buildRow({
    scope: "asset",
    role: asset.role,
    asset_id: asset.asset_id,
    content_id: null,
    variant_id: asset.asset_id,
    source: null,
    medium: null,
    campaign: null,
    link_clicks: asset.link_clicks,
    visits: asset.visits,
    cta_clicks: asset.cta_clicks,
    line_adds: asset.line_adds,
    leads: asset.leads,
    deals: asset.deals,
    sample_threshold_met: asset.sample_threshold_met,
    no_quality_regression: asset.no_quality_regression,
    decision: asset.decision,
  }));

  const attributionRows = (funnelBreakdown.rows ?? []).map((row) => buildRow({
    scope: "attribution",
    role: row.role,
    asset_id: row.asset_id,
    content_id: row.content_id,
    variant_id: row.variant_id,
    source: row.source,
    medium: row.medium,
    campaign: row.campaign,
    link_clicks: row.link_clicks,
    visits: row.visits,
    cta_clicks: row.cta_clicks,
    line_adds: row.line_adds,
    leads: row.leads,
    deals: row.deals,
    sample_threshold_met: row.sample_threshold_met,
    no_quality_regression: row.no_quality_regression,
    decision: row.sample_threshold_met ? "eligible_for_review_after_quality_check" : "collect_more_clicks",
  }));

  const totals = buildRow({
    scope: "total",
    role: "all_assets",
    asset_id: "all_assets",
    content_id: null,
    variant_id: null,
    source: null,
    medium: null,
    campaign: null,
    link_clicks: sum(assetRows, "link_clicks"),
    visits: sum(assetRows, "visits"),
    cta_clicks: sum(assetRows, "cta_clicks"),
    line_adds: sum(assetRows, "line_adds"),
    leads: sum(assetRows, "leads"),
    deals: sum(assetRows, "deals"),
    sample_threshold_met: assetRows.some((row) => row.sample_threshold_met),
    no_quality_regression: assetRows.every((row) => row.no_quality_regression !== false),
    decision: ownerSampleGate.decision ?? "continue_collecting_sample_gate_counts",
  });

  const sampleGaps = {
    min_visits: scores.thresholds?.min_visits ?? 100,
    min_cta_clicks: scores.thresholds?.min_cta_clicks ?? 20,
    min_line_adds: scores.thresholds?.min_line_adds ?? 5,
    min_test_days: scores.thresholds?.min_test_days ?? 3,
    preferred_test_days: scores.thresholds?.preferred_test_days ?? 7,
    current_visits: totals.visits,
    current_cta_clicks: totals.cta_clicks,
    current_line_adds: totals.line_adds,
    current_test_days: Math.max(...assetRows.map((row) => row.test_days ?? 0), 0),
  };
  sampleGaps.remaining_visits = Math.max(sampleGaps.min_visits - sampleGaps.current_visits, 0);
  sampleGaps.remaining_cta_clicks = Math.max(sampleGaps.min_cta_clicks - sampleGaps.current_cta_clicks, 0);
  sampleGaps.remaining_line_adds = Math.max(sampleGaps.min_line_adds - sampleGaps.current_line_adds, 0);
  sampleGaps.remaining_test_days = Math.max(sampleGaps.min_test_days - sampleGaps.current_test_days, 0);

  const eventHashAfter = await fileHash(EVENTS_PATH);
  const status = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "north_star_funnel_local_only",
    north_star: {
      unit: "per_100_link_clicks",
      path: ["link_click", "line_add", "lead_submit", "deal"],
      primary_metric: "line_adds_per_100_clicks",
      downstream_metrics: ["leads_per_100_clicks", "deals_per_100_clicks"],
    },
    week: scores.week,
    thresholds: scores.thresholds,
    win_rule: scores.win_rule,
    status: ownerSampleGate.status ?? "waiting_for_owner_sample_gate_counts",
    decision: ownerSampleGate.decision ?? "continue_collecting_sample_gate_counts",
    sample_threshold_met: ownerSampleGate.sample_threshold_met === true,
    challenger_win_rule_met: ownerSampleGate.challenger_win_rule_met === true,
    quality_guard_status: ownerSampleGate.quality_guard_status ?? "not_evaluated_from_sample_gate",
    owner_review_required: ownerSampleGate.owner_review_required === true,
    promotion_performed: false,
    totals,
    sample_gaps: sampleGaps,
    asset_rows: assetRows,
    attribution_rows: attributionRows,
    summary: {
      asset_count: assetRows.length,
      attribution_row_count: attributionRows.length,
      real_events: funnelBreakdown.summary?.real_events ?? 0,
      content_variant_links: funnelBreakdown.summary?.content_variant_links ?? 0,
      per_100_ready: totals.link_clicks >= 100,
      sample_gate_input_exists: ownerSampleGate.input_exists === true,
      owner_sample_gate_filled_rows: ownerSampleGate.filled_rows ?? 0,
      owner_sample_gate_pending_rows: ownerSampleGate.pending_rows ?? 0,
    },
    real_events_unchanged: eventHashBefore === eventHashAfter,
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
    note: "Local North Star funnel contract. It reads current local scoring artifacts and writes only north_star_funnel.json/md.",
  };

  await writeJson(JSON_PATH, status);
  await writeFile(MD_PATH, renderMarkdown(status));
  console.log(JSON.stringify({
    ok: status.ok,
    mode: status.mode,
    status: status.status,
    link_clicks: status.totals.link_clicks,
    line_adds_per_100_clicks: status.totals.line_adds_per_100_clicks,
    sample_threshold_met: status.sample_threshold_met,
    real_events_unchanged: status.real_events_unchanged,
    external_effect: false,
  }, null, 2));
}

function buildRow(input) {
  const clicks = Number(input.link_clicks ?? 0);
  const lineAdds = Number(input.line_adds ?? 0);
  const leads = Number(input.leads ?? 0);
  const deals = Number(input.deals ?? 0);
  return {
    scope: input.scope,
    role: input.role,
    asset_id: input.asset_id,
    content_id: input.content_id,
    variant_id: input.variant_id,
    source: input.source,
    medium: input.medium,
    campaign: input.campaign,
    link_clicks: clicks,
    visits: Number(input.visits ?? 0),
    cta_clicks: Number(input.cta_clicks ?? 0),
    line_adds: lineAdds,
    leads,
    deals,
    line_adds_per_100_clicks: per100(lineAdds, clicks),
    leads_per_100_clicks: per100(leads, clicks),
    deals_per_100_clicks: per100(deals, clicks),
    line_to_lead_rate: ratio(leads, lineAdds),
    lead_to_deal_rate: ratio(deals, leads),
    click_to_deal_rate: ratio(deals, clicks),
    sample_threshold_met: input.sample_threshold_met === true,
    no_quality_regression: input.no_quality_regression !== false,
    decision: input.decision,
  };
}

function renderMarkdown(status) {
  const per100 = (value) => value === null ? "n/a" : String(value);
  return `# 3Q North Star Funnel

BLUF: ${status.summary.real_events === 0 ? "No real events are present yet, so the North Star funnel is ready to measure but not ready to declare a winner." : "North Star funnel is measured from current local event artifacts."} No public link, production deploy, formal post, LINE push, payment, customer-data mutation, or deletion was performed.

Generated: ${status.generated_at}
Mode: ${status.mode}
Week: ${status.week?.start ?? "n/a"} to ${status.week?.end ?? "n/a"}
Status: ${status.status}

## North Star

Every 100 link clicks -> LINE adds -> leads -> deals.

| scope | role | asset_id | content_id | variant_id | clicks | LINE adds | leads | deals | LINE / 100 clicks | leads / 100 clicks | deals / 100 clicks | sample met |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| total | all_assets | all_assets |  |  | ${status.totals.link_clicks} | ${status.totals.line_adds} | ${status.totals.leads} | ${status.totals.deals} | ${per100(status.totals.line_adds_per_100_clicks)} | ${per100(status.totals.leads_per_100_clicks)} | ${per100(status.totals.deals_per_100_clicks)} | ${status.totals.sample_threshold_met ? "yes" : "no"} |
${status.asset_rows.map((row) => markdownRow(row, per100)).join("\n")}
${status.attribution_rows.map((row) => markdownRow(row, per100)).join("\n")}

## Sample Gate

- Sample threshold met: ${status.sample_threshold_met ? "yes" : "no"}
- Challenger final win rule met: ${status.challenger_win_rule_met ? "yes" : "no"}
- Quality guard: ${status.quality_guard_status}
- Owner review required: ${status.owner_review_required ? "yes" : "no"}
- Promotion performed: ${status.promotion_performed ? "yes" : "no"}
- Remaining visits: ${status.sample_gaps.remaining_visits}
- Remaining CTA clicks: ${status.sample_gaps.remaining_cta_clicks}
- Remaining LINE adds: ${status.sample_gaps.remaining_line_adds}
- Remaining test days: ${status.sample_gaps.remaining_test_days}

## Safety

- data/lp_events.jsonl write performed: ${status.data_lp_events_write_performed ? "yes" : "no"}
- Real events unchanged: ${status.real_events_unchanged ? "yes" : "no"}
- Public link change performed: ${status.public_link_change_performed ? "yes" : "no"}
- Production deploy performed: ${status.production_deploy_performed ? "yes" : "no"}
- Formal post performed: ${status.formal_post_performed ? "yes" : "no"}
- LINE push performed: ${status.line_push_performed ? "yes" : "no"}
- Customer data mutation performed: ${status.customer_data_mutation_performed ? "yes" : "no"}
- Payment action performed: ${status.payment_action_performed ? "yes" : "no"}
- Delete action performed: ${status.delete_action_performed ? "yes" : "no"}
`;
}

function markdownRow(row, formatPer100) {
  return `| ${row.scope} | ${row.role ?? ""} | ${row.asset_id ?? ""} | ${row.content_id ?? ""} | ${row.variant_id ?? ""} | ${row.link_clicks} | ${row.line_adds} | ${row.leads} | ${row.deals} | ${formatPer100(row.line_adds_per_100_clicks)} | ${formatPer100(row.leads_per_100_clicks)} | ${formatPer100(row.deals_per_100_clicks)} | ${row.sample_threshold_met ? "yes" : "no"} |`;
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function per100(value, denominator) {
  if (!denominator) {
    return null;
  }
  return round((value / denominator) * 100);
}

function ratio(value, denominator) {
  if (!denominator) {
    return null;
  }
  return round(value / denominator);
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function fileHash(filePath) {
  const raw = await readFile(filePath, "utf8").catch((error) => {
    if (error.code === "ENOENT") {
      return "";
    }
    throw error;
  });
  return createHash("sha256").update(raw).digest("hex");
}

main();
