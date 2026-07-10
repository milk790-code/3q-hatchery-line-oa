import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonicalRates } from "./lib/scoring-policy.mjs";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "config", "growth-loop.config.json");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const JSON_PATH = path.join(ROOT, "owner_data_preflight.json");
const REPORT_PATH = path.join(ROOT, "owner_data_preflight.md");
const STATUS_PATH = path.join(ROOT, "data", "owner_data_preflight_status.json");

const SOURCES = [
  {
    id: "live_aggregate_inputs",
    label: "Reviewed local aggregate CSV inputs",
    priority: 1,
    funnel_path: "data/funnel_aggregates.csv",
    manual_path: "data/manual_conversions.csv",
  },
  {
    id: "next_p0_owner_intake",
    label: "Focused Next P0 owner-preview CSVs",
    priority: 2,
    funnel_path: "data/next_p0_owner_intake/funnel_aggregates.owner-preview.csv",
    manual_path: "data/next_p0_owner_intake/manual_conversions.owner-preview.csv",
  },
  {
    id: "source_capture_compiled",
    label: "Source capture owner-preview CSVs",
    priority: 3,
    funnel_path: "data/source_capture/compiled/funnel_aggregates.owner-preview.csv",
    manual_path: "data/source_capture/compiled/manual_conversions.owner-preview.csv",
  },
];

const ALLOWED_HEADERS = [
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
const REQUIRED_HEADERS = ["date", "asset_id", "event_type", "count"];
const ALLOWED_EVENTS = new Set(["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"]);

const RED_LINE_FALSE = {
  execution_performed: false,
  apply_performed: false,
  append_performed: false,
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

async function main() {
  const generatedAt = new Date();
  const config = await readJson(CONFIG_PATH);
  const realEventsBefore = await countLines(REAL_EVENTS_PATH);
  const sourceStatuses = [];

  for (const source of SOURCES) {
    sourceStatuses.push(await inspectSource(source, config));
  }

  const selected = selectSource(sourceStatuses);
  const realEventsAfter = await countLines(REAL_EVENTS_PATH);
  const status = buildStatus({
    generatedAt,
    config,
    sourceStatuses,
    selected,
    realEventsBefore,
    realEventsAfter,
  });

  await writeJson(JSON_PATH, status);
  await writeJson(STATUS_PATH, compactStatus(status));
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(compactStatus(status), null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

async function inspectSource(source, config) {
  const funnel = await readPreviewCsv(source.funnel_path, config);
  const manual = await readPreviewCsv(source.manual_path, config);
  const rows = [...funnel.rows, ...manual.rows];
  const issues = [...funnel.issues, ...manual.issues];
  const warnings = [...funnel.warnings, ...manual.warnings];
  return {
    ...source,
    funnel_exists: funnel.exists,
    manual_exists: manual.exists,
    funnel_rows: funnel.rows.length,
    manual_rows: manual.rows.length,
    row_count: rows.length,
    event_total: rows.reduce((sum, row) => sum + row.count, 0),
    counts_by_event_type: countBy(rows, "event_type"),
    issues,
    warnings,
    rows,
    ok: issues.length === 0,
  };
}

async function readPreviewCsv(relativePath, config) {
  const filePath = path.join(ROOT, relativePath);
  if (!(await exists(filePath))) {
    return { exists: false, rows: [], issues: [], warnings: [] };
  }

  const raw = await readFile(filePath, "utf8");
  const parsed = parseCsv(raw);
  const issues = [];
  const warnings = [];
  const knownAssets = new Set((config.assets ?? []).map((asset) => asset.asset_id));

  for (const header of REQUIRED_HEADERS) {
    if (!parsed.headers.includes(header)) {
      issues.push(issue(relativePath, 1, header, `Missing required header: ${header}`));
    }
  }
  for (const header of parsed.headers) {
    if (!ALLOWED_HEADERS.includes(header)) {
      issues.push(issue(relativePath, 1, header, `Unknown header is not allowed: ${header}`));
    }
  }
  if (issues.length > 0) {
    return { exists: true, rows: [], issues, warnings };
  }

  const rows = [];
  for (const [index, row] of parsed.rows.entries()) {
    const rowNumber = index + 2;
    const countRaw = String(row.count ?? "").trim();
    const eventType = String(row.event_type ?? "").trim();
    const assetId = String(row.asset_id ?? "").trim();
    const date = String(row.date ?? "").trim();
    const qualityScoreRaw = String(row.quality_score ?? "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      issues.push(issue(relativePath, rowNumber, "date", "date must be YYYY-MM-DD."));
    }
    if (!knownAssets.has(assetId)) {
      issues.push(issue(relativePath, rowNumber, "asset_id", `Unknown asset_id: ${assetId}`));
    }
    if (!ALLOWED_EVENTS.has(eventType)) {
      issues.push(issue(relativePath, rowNumber, "event_type", `event_type must be one of ${Array.from(ALLOWED_EVENTS).join(", ")}.`));
    }
    if (!/^(0|[1-9]\d*)$/.test(countRaw)) {
      issues.push(issue(relativePath, rowNumber, "count", "count must be a non-negative integer."));
    }
    if (qualityScoreRaw && eventType !== "quality_flag") {
      issues.push(issue(relativePath, rowNumber, "quality_score", "quality_score is only allowed on quality_flag rows."));
    }
    if (qualityScoreRaw) {
      const qualityScore = Number(qualityScoreRaw);
      if (!Number.isFinite(qualityScore) || qualityScore < 0 || qualityScore > 1) {
        issues.push(issue(relativePath, rowNumber, "quality_score", "quality_score must be a number from 0 to 1."));
      }
    }

    for (const field of ["source", "medium", "campaign", "content_id", "variant_id"]) {
      const sensitive = sensitiveMatch(row[field] ?? "");
      if (sensitive) {
        issues.push(issue(relativePath, rowNumber, field, `Sensitive-looking ${sensitive} detected. Use aggregate IDs only.`));
      }
    }

    const count = Number(countRaw);
    if (count === 0) {
      warnings.push(issue(relativePath, rowNumber, "count", "Zero count is allowed; verify this was intentional."));
    }

    if (issues.some((item) => item.file === relativePath && item.row_number === rowNumber)) {
      continue;
    }
    rows.push({
      file: relativePath,
      row_number: rowNumber,
      date,
      asset_id: assetId,
      event_type: eventType,
      count,
      source: String(row.source ?? "").trim(),
      medium: String(row.medium ?? "").trim(),
      campaign: String(row.campaign ?? "").trim(),
      content_id: String(row.content_id ?? "").trim(),
      variant_id: String(row.variant_id ?? "").trim(),
      quality_score: qualityScoreRaw ? Number(qualityScoreRaw) : null,
    });
  }

  return { exists: true, rows, issues, warnings };
}

function selectSource(sources) {
  const invalidWithRows = sources.find((source) => !source.ok && source.row_count > 0);
  if (invalidWithRows) return { ...invalidWithRows, selected: true };
  const withRows = sources
    .filter((source) => source.ok && source.row_count > 0)
    .sort((a, b) => a.priority - b.priority)[0];
  if (withRows) return { ...withRows, selected: true };
  const invalidExisting = sources.find((source) => !source.ok && (source.funnel_exists || source.manual_exists));
  if (invalidExisting) return { ...invalidExisting, selected: true };
  return {
    ...sources.find((source) => source.id === "next_p0_owner_intake"),
    selected: true,
  };
}

function buildStatus({ generatedAt, config, sourceStatuses, selected, realEventsBefore, realEventsAfter }) {
  const scores = scoreAssets(config, selected.ok ? selected.rows : []);
  const champion = scores.assets.find((asset) => asset.role === "champion") ?? null;
  const challenger = scores.assets.find((asset) => asset.role === "challenger") ?? null;
  const ab = buildAbStatus(config, champion, challenger, selected.rows.length);
  const nextRound = buildNextRound(config, challenger, ab);
  const ok = selected.ok === true;
  const status = !ok
    ? "blocked_invalid_owner_preview"
    : selected.row_count === 0
      ? "waiting_for_owner_preview_rows"
      : ab.challenger_win_rule_met
        ? "owner_preview_win_needs_quality_and_promotion_review"
        : ab.sample_threshold_met
          ? "owner_preview_sample_ready_no_auto_promotion"
          : "owner_preview_keep_collecting";

  return {
    ok,
    generated_at: generatedAt.toISOString(),
    mode: "owner_data_preflight_local_only",
    status,
    report_path: REPORT_PATH,
    json_path: JSON_PATH,
    compact_status_path: STATUS_PATH,
    selected_source_id: selected.id,
    selected_source_label: selected.label,
    selected_source_priority: selected.priority,
    selected_source_row_count: selected.row_count,
    selected_source_event_total: selected.event_total,
    source_statuses: sourceStatuses.map(stripSourceRows),
    issue_count: selected.issues.length,
    issues: selected.issues,
    warning_count: selected.warnings.length,
    warnings: selected.warnings,
    week: scores.week,
    thresholds: config.sample_thresholds,
    win_rule: config.win_rule,
    champion: summarize(champion),
    challenger: summarize(challenger),
    ab_status: ab,
    next_round_preview: nextRound,
    sample_threshold_met: Boolean(ab.sample_threshold_met),
    no_quality_regression: Boolean(ab.no_quality_regression),
    challenger_win_rule_met: Boolean(ab.challenger_win_rule_met),
    owner_review_required: true,
    next_safe_action: nextSafeAction(status, nextRound),
    real_events_before: realEventsBefore,
    real_events_after: realEventsAfter,
    real_events_unchanged: realEventsBefore === realEventsAfter,
    ...RED_LINE_FALSE,
    note: "Reads owner-preview aggregate CSVs and previews sample gate / win-rule decisions locally. It never appends data/lp_events.jsonl and never executes external gates.",
  };
}

function scoreAssets(config, rows) {
  const week = weekFromRows(rows);
  const byAsset = new Map();
  for (const asset of config.assets ?? []) {
    byAsset.set(asset.asset_id, {
      ...asset,
      link_clicks: 0,
      visits: 0,
      cta_clicks: 0,
      line_adds: 0,
      leads: 0,
      deals: 0,
      quality_flags: 0,
      low_quality_flags: 0,
      first_date: null,
      last_date: null,
      test_days: 0,
    });
  }

  for (const row of rows) {
    const asset = byAsset.get(row.asset_id);
    if (!asset) continue;
    asset.first_date = asset.first_date && asset.first_date < row.date ? asset.first_date : row.date;
    asset.last_date = asset.last_date && asset.last_date > row.date ? asset.last_date : row.date;
    if (row.event_type === "link_click") asset.link_clicks += row.count;
    if (row.event_type === "page_view") asset.visits += row.count;
    if (row.event_type === "cta_click") asset.cta_clicks += row.count;
    if (row.event_type === "line_add") asset.line_adds += row.count;
    if (row.event_type === "lead_submit") asset.leads += row.count;
    if (row.event_type === "deal") asset.deals += row.count;
    if (row.event_type === "quality_flag") {
      asset.quality_flags += row.count;
      if (Number(row.quality_score ?? 1) < 0.5) asset.low_quality_flags += row.count;
    }
  }

  const assets = Array.from(byAsset.values()).map((asset) => {
    const rates = canonicalRates(asset);
    const ctaRate = rates.cta_rate;
    const lineAddRate = rates.line_add_rate;
    const leadRate = rates.lead_rate;
    const closeRate = rates.close_rate;
    const testDays = calculateTestDays(asset.first_date, asset.last_date);
    const sampleThresholdMet =
      asset.visits >= config.sample_thresholds.min_visits &&
      asset.cta_clicks >= config.sample_thresholds.min_cta_clicks &&
      asset.line_adds >= config.sample_thresholds.min_line_adds &&
      testDays >= config.sample_thresholds.min_test_days;
    return {
      ...asset,
      week,
      cta_rate: round(ctaRate),
      line_add_rate: round(lineAddRate),
      lead_rate: round(leadRate),
      close_rate: round(closeRate),
      test_days: testDays,
      sample_threshold_met: sampleThresholdMet,
      no_quality_regression: true,
      quality_regression_reasons: [],
      spam_flag_rate: round(safeDivide(asset.low_quality_flags, asset.quality_flags)),
      lead_rate_retention_vs_champion: null,
      close_rate_retention_vs_champion: null,
      decision: "pending_comparison",
    };
  });

  const champion = assets.find((asset) => asset.role === "champion") ?? null;
  for (const asset of assets) {
    const qualityGate = buildQualityGate(asset, champion, config);
    asset.no_quality_regression = qualityGate.ok;
    asset.quality_regression_reasons = qualityGate.reasons;
    asset.spam_flag_rate = qualityGate.spam_flag_rate;
    asset.lead_rate_retention_vs_champion = qualityGate.lead_rate_retention_vs_champion;
    asset.close_rate_retention_vs_champion = qualityGate.close_rate_retention_vs_champion;

    if (asset.role === "champion") {
      asset.decision = "keep_champion_until_challenger_beats_rule";
    }
    if (asset.role === "challenger") {
      const championRate = champion?.line_add_rate ?? 0;
      const lift = championRate === 0 ? null : round(asset.line_add_rate / championRate);
      const beatsChampion = lift !== null && lift > config.win_rule.challenger_lift_required;
      asset.champion_lift = lift;
      if (!asset.sample_threshold_met) {
        asset.decision = "keep_testing_sample_insufficient";
      } else if (beatsChampion && asset.no_quality_regression) {
        asset.decision = "eligible_for_human_promotion_review";
      } else if (!asset.no_quality_regression) {
        asset.decision = "reject_quality_regression";
      } else {
        asset.decision = "retire_or_rework_candidate";
      }
    }
  }

  return { week, assets };
}

function buildQualityGate(asset, champion, config) {
  const rules = config.quality_rules ?? {};
  const maxSpam = Number(rules.max_spam_flag_rate ?? 0.05);
  const minLeadRetention = Number(rules.min_lead_rate_retention_vs_champion ?? 0.8);
  const minCloseRetention = Number(rules.min_close_rate_retention_vs_champion ?? 0.8);
  const reasons = [];
  const spamFlagRate = round(safeDivide(asset.low_quality_flags, asset.quality_flags));
  let leadRetention = null;
  let closeRetention = null;

  if (asset.quality_flags > 0 && spamFlagRate > maxSpam) {
    reasons.push("spam_flag_rate_above_limit");
  }
  if (asset.role === "challenger" && champion) {
    if (champion.lead_rate > 0 && asset.line_adds >= Number(config.sample_thresholds.min_line_adds ?? 5)) {
      leadRetention = round(safeDivide(asset.lead_rate, champion.lead_rate));
      if (leadRetention < minLeadRetention) reasons.push("lead_rate_retention_below_champion");
    }
    if (champion.close_rate > 0 && champion.leads > 0 && asset.leads > 0) {
      closeRetention = round(safeDivide(asset.close_rate, champion.close_rate));
      if (closeRetention < minCloseRetention) reasons.push("close_rate_retention_below_champion");
    }
  }

  return {
    ok: reasons.length === 0,
    spam_flag_rate: spamFlagRate,
    lead_rate_retention_vs_champion: leadRetention,
    close_rate_retention_vs_champion: closeRetention,
    reasons,
  };
}

function buildAbStatus(config, champion, challenger, rowCount) {
  const championRate = champion?.line_add_rate ?? 0;
  const challengerRate = challenger?.line_add_rate ?? 0;
  const lift = championRate === 0 ? null : round(challengerRate / championRate);
  const sampleThresholdMet = Boolean(challenger?.sample_threshold_met);
  const noQualityRegression = Boolean(challenger?.no_quality_regression);
  const challengerWins =
    lift !== null &&
    lift > config.win_rule.challenger_lift_required &&
    sampleThresholdMet &&
    noQualityRegression;
  return {
    status: sampleThresholdMet ? "sample_ready_for_review" : "sample_insufficient_keep_champion",
    changed_variable: config.current_round.changed_variable,
    one_variable_rule_ok: (config.one_variable_per_round ?? []).includes(config.current_round.changed_variable),
    preview_rows_observed: rowCount,
    champion_line_add_rate: championRate,
    challenger_line_add_rate: challengerRate,
    lift,
    sample_threshold_met: sampleThresholdMet,
    no_quality_regression: noQualityRegression,
    quality_regression_reasons: challenger?.quality_regression_reasons ?? [],
    challenger_win_rule_met: challengerWins,
    decision: challengerWins ? "queue_human_promotion_review" : "do_not_promote_challenger",
  };
}

function buildNextRound(config, challenger, ab) {
  const gaps = sampleGaps(config, challenger);
  let decision = "continue_current_round_until_sample_threshold";
  let startNewVariableRound = false;
  if (ab.challenger_win_rule_met) {
    decision = "queue_owner_promotion_review_before_next_variable";
  } else if (ab.sample_threshold_met && !ab.no_quality_regression) {
    decision = "reject_challenger_quality_regression_plan_next_variable";
    startNewVariableRound = true;
  } else if (ab.sample_threshold_met) {
    decision = "retire_underperforming_challenger_plan_next_variable";
    startNewVariableRound = true;
  }
  return {
    decision,
    sample_gaps: gaps,
    current_changed_variable: config.current_round.changed_variable,
    next_changed_variable: startNewVariableRound ? nextVariable(config) : config.current_round.changed_variable,
    start_new_variable_round: startNewVariableRound,
    public_link_change_performed: false,
    production_deploy_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
  };
}

function sampleGaps(config, challenger) {
  const thresholds = config.sample_thresholds;
  return {
    visits: Math.max(0, thresholds.min_visits - (challenger?.visits ?? 0)),
    cta_clicks: Math.max(0, thresholds.min_cta_clicks - (challenger?.cta_clicks ?? 0)),
    line_adds: Math.max(0, thresholds.min_line_adds - (challenger?.line_adds ?? 0)),
    test_days: Math.max(0, thresholds.min_test_days - (challenger?.test_days ?? 0)),
    preferred_test_days: Math.max(0, thresholds.preferred_test_days - (challenger?.test_days ?? 0)),
  };
}

function nextSafeAction(status, nextRound) {
  if (status === "blocked_invalid_owner_preview") {
    return "Fix the selected owner-preview CSV. Keep only aggregate counts and allowed columns, then rerun npm run owner:data-preflight.";
  }
  if (status === "waiting_for_owner_preview_rows") {
    return "Fill next_p0_owner_form.html or data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt, then rerun npm run next-p0:intake and npm run owner:data-preflight.";
  }
  if (status === "owner_preview_win_needs_quality_and_promotion_review") {
    return "Run the owner quality review locally; do not promote the challenger or change public links from this preflight.";
  }
  if (nextRound.start_new_variable_round) {
    return "Review next-round local drafts only; do not rotate public traffic until owner approves.";
  }
  return "Keep collecting P0 sample-gate counts; sample-insufficient preview keeps the champion and current variable.";
}

function compactStatus(status) {
  return {
    ok: status.ok,
    generated_at: status.generated_at,
    mode: status.mode,
    status: status.status,
    selected_source_id: status.selected_source_id,
    selected_source_row_count: status.selected_source_row_count,
    selected_source_event_total: status.selected_source_event_total,
    issue_count: status.issue_count,
    warning_count: status.warning_count,
    sample_threshold_met: status.sample_threshold_met,
    no_quality_regression: status.no_quality_regression,
    challenger_win_rule_met: status.challenger_win_rule_met,
    owner_review_required: status.owner_review_required,
    challenger_line_add_rate: status.challenger?.line_add_rate ?? 0,
    champion_line_add_rate: status.champion?.line_add_rate ?? 0,
    next_round_decision: status.next_round_preview?.decision ?? null,
    next_safe_action: status.next_safe_action,
    real_events_unchanged: status.real_events_unchanged,
    ...RED_LINE_FALSE,
  };
}

function renderReport(status) {
  const sourceRows = status.source_statuses
    .map((source) => `| ${source.id} | ${source.row_count} | ${source.event_total} | ${source.ok ? "ok" : "blocked"} | ${source.issues.length} |`)
    .join("\n");
  const issueRows = status.issues.length > 0
    ? status.issues.map((item) => `| ${item.file} | ${item.row_number ?? "n/a"} | ${item.field} | ${item.message} |`).join("\n")
    : "| none | none | none | none |";
  const warningRows = status.warnings.length > 0
    ? status.warnings.map((item) => `| ${item.file} | ${item.row_number ?? "n/a"} | ${item.field} | ${item.message} |`).join("\n")
    : "| none | none | none | none |";

  return `# 3Q Growth Loop Owner Data Preflight

BLUF: ${status.status}. This local preflight reads owner-preview aggregate CSVs, previews sample-gate and win-rule decisions, and never applies data or executes external gates.

Generated: ${status.generated_at}
Mode: ${status.mode}
Status: ${status.status}
Selected source: ${status.selected_source_id}
Preview rows: ${status.selected_source_row_count}
Preview event total: ${status.selected_source_event_total}
Sample threshold met: ${status.sample_threshold_met ? "yes" : "no"}
Challenger win rule met: ${status.challenger_win_rule_met ? "yes" : "no"}
No quality regression: ${status.no_quality_regression ? "yes" : "no"}
Next round decision: ${status.next_round_preview.decision}
External effect: no
data/lp_events.jsonl write performed: no
Execution performed: no

## Next Safe Action

${status.next_safe_action}

## Source Candidates

| source | preview rows | event total | status | issues |
|---|---:|---:|---|---:|
${sourceRows}

## Champion vs Challenger

| role | asset_id | visits | CTA clicks | LINE adds | leads | deals | test days | LINE add rate | decision |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| champion | ${status.champion?.asset_id ?? "n/a"} | ${status.champion?.visits ?? 0} | ${status.champion?.cta_clicks ?? 0} | ${status.champion?.line_adds ?? 0} | ${status.champion?.leads ?? 0} | ${status.champion?.deals ?? 0} | ${status.champion?.test_days ?? 0} | ${status.champion?.line_add_rate ?? 0} | ${status.champion?.decision ?? "n/a"} |
| challenger | ${status.challenger?.asset_id ?? "n/a"} | ${status.challenger?.visits ?? 0} | ${status.challenger?.cta_clicks ?? 0} | ${status.challenger?.line_adds ?? 0} | ${status.challenger?.leads ?? 0} | ${status.challenger?.deals ?? 0} | ${status.challenger?.test_days ?? 0} | ${status.challenger?.line_add_rate ?? 0} | ${status.challenger?.decision ?? "n/a"} |

## Sample Gaps

| gate | gap |
|---|---:|
| visits | ${status.next_round_preview.sample_gaps.visits} |
| cta_clicks | ${status.next_round_preview.sample_gaps.cta_clicks} |
| line_adds | ${status.next_round_preview.sample_gaps.line_adds} |
| test_days | ${status.next_round_preview.sample_gaps.test_days} |
| preferred_test_days | ${status.next_round_preview.sample_gaps.preferred_test_days} |

## Issues

| file | row | field | message |
|---|---:|---|---|
${issueRows}

## Warnings

| file | row | field | message |
|---|---:|---|---|
${warningRows}

## Safety

- No data/lp_events.jsonl append.
- No production deploy.
- No public link change.
- No GitHub push or PR.
- No formal post or LINE push.
- No customer data, payment, refund, ECPay, or delete action.
`;
}

function summarize(asset) {
  if (!asset) return null;
  return {
    asset_id: asset.asset_id,
    role: asset.role,
    visits: asset.visits,
    cta_clicks: asset.cta_clicks,
    line_adds: asset.line_adds,
    leads: asset.leads,
    deals: asset.deals,
    quality_flags: asset.quality_flags,
    low_quality_flags: asset.low_quality_flags,
    test_days: asset.test_days,
    cta_rate: asset.cta_rate,
    line_add_rate: asset.line_add_rate,
    lead_rate: asset.lead_rate,
    close_rate: asset.close_rate,
    sample_threshold_met: asset.sample_threshold_met,
    no_quality_regression: asset.no_quality_regression,
    quality_regression_reasons: asset.quality_regression_reasons,
    champion_lift: asset.champion_lift ?? null,
    decision: asset.decision,
  };
}

function stripSourceRows(source) {
  return {
    id: source.id,
    label: source.label,
    priority: source.priority,
    funnel_path: source.funnel_path,
    manual_path: source.manual_path,
    funnel_exists: source.funnel_exists,
    manual_exists: source.manual_exists,
    funnel_rows: source.funnel_rows,
    manual_rows: source.manual_rows,
    row_count: source.row_count,
    event_total: source.event_total,
    counts_by_event_type: source.counts_by_event_type,
    ok: source.ok,
    issues: source.issues,
    warnings: source.warnings,
    external_effect: false,
  };
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    acc[row[key]] = (acc[row[key]] ?? 0) + row.count;
    return acc;
  }, {});
}

function weekFromRows(rows) {
  const dates = rows.map((row) => row.date).filter(Boolean).sort();
  const start = dates[0] ?? "unknown";
  const end = dates[dates.length - 1] ?? "unknown";
  return { start, end };
}

function calculateTestDays(first, last) {
  if (!first || !last) return 0;
  const start = new Date(`${first}T00:00:00Z`);
  const end = new Date(`${last}T00:00:00Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return 0;
  return Math.max(Math.floor((end - start) / 86400000) + 1, 1);
}

function nextVariable(config) {
  const variables = config.one_variable_per_round ?? [];
  const current = config.current_round?.changed_variable;
  const index = variables.indexOf(current);
  return variables[(index + 1 + variables.length) % variables.length] ?? variables[0] ?? current;
}

function safeDivide(numerator, denominator) {
  if (!denominator) return 0;
  return numerator / denominator;
}

function round(value) {
  return Number(value.toFixed(4));
}

function issue(file, rowNumber, field, message) {
  return { file, row_number: rowNumber, field, message, external_effect: false };
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

function parseCsv(raw) {
  const rows = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = rows[0].map((header) => header.trim());
  const dataRows = rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(`CSV row ${index + 2} has ${values.length} columns; expected ${headers.length}.`);
    }
    return Object.fromEntries(headers.map((header, cellIndex) => [header, values[cellIndex].trim()]));
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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch(async (error) => {
  const failed = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "owner_data_preflight_local_only",
    status: "failed_owner_data_preflight",
    error: error instanceof Error ? error.message : "unknown_error",
    real_events_unchanged: true,
    ...RED_LINE_FALSE,
  };
  await writeJson(JSON_PATH, failed);
  await writeJson(STATUS_PATH, compactStatus(failed));
  await writeFile(REPORT_PATH, `# 3Q Growth Loop Owner Data Preflight\n\nBLUF: failed_owner_data_preflight.\n\nError: ${failed.error}\n\nExternal effect: no\n`);
  console.error(error);
  process.exitCode = 1;
});
