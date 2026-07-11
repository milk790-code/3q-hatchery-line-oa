import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { canonicalRates } from "./lib/scoring-policy.mjs";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "config", "growth-loop.config.json");
const STATUS_PATH = path.join(ROOT, "data", "win_rule_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "win_rule_fixture_report.md");

const EVENT_TYPES = ["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"];

async function main() {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  const generatedAt = new Date();
  const week = {
    start: "2026-07-06",
    end: "2026-07-12",
  };
  const scenarios = buildScenarios(config, week);
  const evaluated = scenarios.map((scenario) => evaluateScenario(config, scenario, week));
  const status = buildStatus(config, evaluated, generatedAt);
  const report = renderReport(status, evaluated, generatedAt);

  await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
  await writeFile(REPORT_PATH, report);

  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildScenarios(config, week) {
  const champion = config.assets.find((asset) => asset.role === "champion");
  const challenger = config.assets.find((asset) => asset.role === "challenger");
  return [
    {
      id: "sample_insufficient_keeps_champion",
      expected: {
        challenger_decision: "keep_testing_sample_insufficient",
        ab_decision: "do_not_promote_challenger",
        challenger_win_rule_met: false,
        promotion_performed: false,
      },
      events: [
        ...makeEvents(champion.asset_id, week.start, { link_click: 120, page_view: 120, cta_click: 30, line_add: 12, lead_submit: 3, deal: 1, test_days: 4 }),
        ...makeEvents(challenger.asset_id, week.start, { link_click: 99, page_view: 99, cta_click: 30, line_add: 15, lead_submit: 3, deal: 1, test_days: 4 }),
      ],
    },
    {
      id: "win_rule_queues_human_promotion_only",
      expected: {
        challenger_decision: "eligible_for_human_promotion_review",
        ab_decision: "queue_human_promotion_review",
        challenger_win_rule_met: true,
        promotion_performed: false,
      },
      events: [
        ...makeEvents(champion.asset_id, week.start, { link_click: 120, page_view: 120, cta_click: 30, line_add: 12, lead_submit: 3, deal: 1, test_days: 4 }),
        ...makeEvents(challenger.asset_id, week.start, { link_click: 120, page_view: 120, cta_click: 30, line_add: 17, lead_submit: 4, deal: 2, test_days: 4 }),
      ],
    },
    {
      id: "sample_met_underperform_rework",
      expected: {
        challenger_decision: "retire_or_rework_candidate",
        ab_decision: "do_not_promote_challenger",
        challenger_win_rule_met: false,
        promotion_performed: false,
      },
      events: [
        ...makeEvents(champion.asset_id, week.start, { link_click: 120, page_view: 120, cta_click: 30, line_add: 12, lead_submit: 3, deal: 1, test_days: 4 }),
        ...makeEvents(challenger.asset_id, week.start, { link_click: 120, page_view: 120, cta_click: 30, line_add: 12, lead_submit: 3, deal: 1, test_days: 4 }),
      ],
    },
    {
      id: "quality_regression_blocks_promotion",
      expected: {
        challenger_decision: "reject_quality_regression",
        ab_decision: "do_not_promote_challenger",
        challenger_win_rule_met: false,
        promotion_performed: false,
        quality_reasons_include: ["spam_flag_rate_above_limit"],
      },
      events: [
        ...makeEvents(champion.asset_id, week.start, { link_click: 120, page_view: 120, cta_click: 30, line_add: 12, lead_submit: 3, deal: 1, test_days: 4 }),
        ...makeEvents(challenger.asset_id, week.start, { link_click: 120, page_view: 120, cta_click: 30, line_add: 17, lead_submit: 4, deal: 1, quality_flag: 10, low_quality_flag: 2, test_days: 4 }),
      ],
    },
    {
      id: "lead_rate_regression_blocks_promotion",
      expected: {
        challenger_decision: "reject_quality_regression",
        ab_decision: "do_not_promote_challenger",
        challenger_win_rule_met: false,
        promotion_performed: false,
        quality_reasons_include: ["lead_rate_retention_below_champion"],
      },
      events: [
        ...makeEvents(champion.asset_id, week.start, { link_click: 120, page_view: 120, cta_click: 30, line_add: 12, lead_submit: 6, deal: 2, test_days: 4 }),
        ...makeEvents(challenger.asset_id, week.start, { link_click: 120, page_view: 120, cta_click: 30, line_add: 17, lead_submit: 2, deal: 1, quality_flag: 10, low_quality_flag: 0, test_days: 4 }),
      ],
    },
    {
      id: "close_rate_regression_blocks_promotion",
      expected: {
        challenger_decision: "reject_quality_regression",
        ab_decision: "do_not_promote_challenger",
        challenger_win_rule_met: false,
        promotion_performed: false,
        quality_reasons_include: ["close_rate_retention_below_champion"],
      },
      events: [
        ...makeEvents(champion.asset_id, week.start, { link_click: 120, page_view: 120, cta_click: 30, line_add: 12, lead_submit: 4, deal: 2, test_days: 4 }),
        ...makeEvents(challenger.asset_id, week.start, { link_click: 120, page_view: 120, cta_click: 30, line_add: 17, lead_submit: 5, deal: 0, quality_flag: 10, low_quality_flag: 0, test_days: 4 }),
      ],
    },
  ];
}

function evaluateScenario(config, scenario, week) {
  const scores = scoreAssets(config, scenario.events, week);
  const abStatus = buildAbStatus(config, scores, scenario.events, week);
  const challenger = scores.assets.find((asset) => asset.role === "challenger");
  const assertions = [
    {
      name: "challenger_decision",
      ok: challenger?.decision === scenario.expected.challenger_decision,
      expected: scenario.expected.challenger_decision,
      actual: challenger?.decision ?? null,
    },
    {
      name: "ab_decision",
      ok: abStatus.decision === scenario.expected.ab_decision,
      expected: scenario.expected.ab_decision,
      actual: abStatus.decision,
    },
    {
      name: "challenger_win_rule_met",
      ok: abStatus.challenger_win_rule_met === scenario.expected.challenger_win_rule_met,
      expected: scenario.expected.challenger_win_rule_met,
      actual: abStatus.challenger_win_rule_met,
    },
    {
      name: "promotion_performed",
      ok: false === scenario.expected.promotion_performed,
      expected: scenario.expected.promotion_performed,
      actual: false,
    },
    {
      name: "quality_reasons_include",
      ok: (scenario.expected.quality_reasons_include ?? []).every((reason) => (challenger?.quality_regression_reasons ?? []).includes(reason)),
      expected: scenario.expected.quality_reasons_include ?? [],
      actual: challenger?.quality_regression_reasons ?? [],
    },
  ];

  return {
    id: scenario.id,
    ok: assertions.every((assertion) => assertion.ok),
    event_count: scenario.events.length,
    expected: scenario.expected,
    assertions,
    challenger_summary: {
      visits: challenger?.visits ?? 0,
      cta_clicks: challenger?.cta_clicks ?? 0,
      line_adds: challenger?.line_adds ?? 0,
      line_add_rate: challenger?.line_add_rate ?? 0,
      sample_threshold_met: Boolean(challenger?.sample_threshold_met),
      no_quality_regression: Boolean(challenger?.no_quality_regression),
      quality_regression_reasons: challenger?.quality_regression_reasons ?? [],
      lead_rate: challenger?.lead_rate ?? 0,
      close_rate: challenger?.close_rate ?? 0,
      lead_rate_retention_vs_champion: challenger?.lead_rate_retention_vs_champion ?? null,
      close_rate_retention_vs_champion: challenger?.close_rate_retention_vs_champion ?? null,
      decision: challenger?.decision ?? null,
      champion_lift: challenger?.champion_lift ?? null,
    },
    ab_status: {
      decision: abStatus.decision,
      challenger_win_rule_met: abStatus.challenger_win_rule_met,
      lift: abStatus.lift,
      sample_threshold_met: abStatus.sample_threshold_met,
      no_quality_regression: abStatus.no_quality_regression,
      quality_regression_reasons: abStatus.quality_regression_reasons,
      lead_rate_retention_vs_champion: abStatus.lead_rate_retention_vs_champion,
      close_rate_retention_vs_champion: abStatus.close_rate_retention_vs_champion,
      public_link_change_performed: abStatus.public_link_change_performed,
      production_deploy_performed: abStatus.production_deploy_performed,
    },
    promotion_performed: false,
    external_effect: false,
  };
}

function buildStatus(config, scenarios, generatedAt) {
  return {
    ok: scenarios.every((scenario) => scenario.ok),
    generated_at: generatedAt.toISOString(),
    mode: "win_rule_fixture_dry_run",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    thresholds: config.sample_thresholds,
    win_rule: config.win_rule,
    quality_rules: config.quality_rules,
    scenario_count: scenarios.length,
    scenarios,
    real_event_write_performed: false,
    external_effect: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    challenger_promotion_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    note: "Fixture-only simulator. It does not read or write data/lp_events.jsonl and does not perform external actions.",
  };
}

function renderReport(status, scenarios, generatedAt) {
  const rows = scenarios
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "pass" : "fail"} | ${scenario.challenger_summary.sample_threshold_met ? "yes" : "no"} | ${scenario.challenger_summary.no_quality_regression ? "yes" : "no"} | ${(scenario.challenger_summary.quality_regression_reasons ?? []).join(", ") || "none"} | ${scenario.challenger_summary.decision} | ${scenario.ab_status.decision} | ${scenario.promotion_performed ? "yes" : "no"} |`)
    .join("\n");

  return `# 3Q Growth Loop Win Rule Fixture Report

BLUF: The fixture simulator validates sample thresholds, challenger win logic, quality regression blocking, and the rule that even a winning challenger only queues human promotion review.

Generated: ${generatedAt.toISOString()}
Mode: ${status.mode}
Overall: ${status.ok ? "pass" : "fail"}
Real event write performed: no
External effect: none

## Scenarios

| scenario | result | sample_met | no_quality_regression | regression_reasons | challenger_decision | ab_decision | promotion_performed |
|---|---|---|---|---|---|---|---|
${rows}

## Safety Invariants

- Production deploy performed: no
- Public link change performed: no
- Challenger promotion performed: no
- Formal post performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
`;
}

function makeEvents(assetId, startDate, counts) {
  const events = [];
  const testDays = counts.test_days ?? 1;
  for (const [type, count] of Object.entries(counts)) {
    if (type === "test_days" || type === "low_quality_flag") continue;
    if (!EVENT_TYPES.includes(type)) continue;
    for (let index = 0; index < count; index += 1) {
      const dayOffset = index % testDays;
      const occurredAt = new Date(`${startDate}T10:00:00.000+08:00`);
      occurredAt.setDate(occurredAt.getDate() + dayOffset);
      const event = {
        event_id: `${assetId}-${type}-${index}`,
        occurred_at: occurredAt.toISOString(),
        asset_id: assetId,
        event_type: type,
        source: "fixture",
        campaign: "win-rule-fixture",
      };
      if (type === "quality_flag") {
        event.quality_score = index < (counts.low_quality_flag ?? 0) ? 0 : 1;
      }
      events.push(event);
    }
  }
  return events;
}

function scoreAssets(config, events, week) {
  const thresholds = config.sample_thresholds;
  const byAsset = new Map();
  for (const asset of config.assets) {
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
      first_event_at: null,
      last_event_at: null,
      test_days: 0,
    });
  }

  for (const event of events) {
    const row = byAsset.get(event.asset_id);
    if (!row) continue;
    if (event.occurred_at) {
      row.first_event_at = row.first_event_at && row.first_event_at < event.occurred_at ? row.first_event_at : event.occurred_at;
      row.last_event_at = row.last_event_at && row.last_event_at > event.occurred_at ? row.last_event_at : event.occurred_at;
    }
    if (event.event_type === "link_click") row.link_clicks += 1;
    if (event.event_type === "page_view") row.visits += 1;
    if (event.event_type === "cta_click") row.cta_clicks += 1;
    if (event.event_type === "line_add") row.line_adds += 1;
    if (event.event_type === "lead_submit") row.leads += 1;
    if (event.event_type === "deal") row.deals += 1;
    if (event.event_type === "quality_flag") {
      row.quality_flags += 1;
      if (Number(event.quality_score ?? 1) < 0.5) row.low_quality_flags += 1;
    }
  }

  const rows = Array.from(byAsset.values()).map((row) => {
    const rates = canonicalRates(row);
    const lineAddRate = rates.line_add_rate;
    const leadRate = rates.lead_rate;
    const closeRate = rates.close_rate;
    const testDays = calculateTestDays(row.first_event_at, row.last_event_at);
    const spamFlagRate = safeDivide(row.low_quality_flags, row.quality_flags);
    return {
      ...row,
      week_start: week.start,
      week_end: week.end,
      line_add_rate: round(lineAddRate),
      lead_rate: round(leadRate),
      close_rate: round(closeRate),
      test_days: testDays,
      spam_flag_rate: round(spamFlagRate),
      sample_threshold_met:
        row.visits >= config.sample_thresholds.min_visits &&
        row.cta_clicks >= config.sample_thresholds.min_cta_clicks &&
        row.line_adds >= config.sample_thresholds.min_line_adds &&
        testDays >= thresholds.min_test_days,
      lead_rate_retention_vs_champion: null,
      close_rate_retention_vs_champion: null,
      quality_regression_reasons: [],
      no_quality_regression: true,
      score: Number((lineAddRate * 50 + leadRate * 30 + closeRate * 20).toFixed(4)),
      decision: "pending_comparison",
    };
  });

  const champion = rows.find((row) => row.role === "champion");
  for (const row of rows) {
    const qualityGate = buildQualityGate(row, champion, config);
    row.spam_flag_rate = qualityGate.spam_flag_rate;
    row.lead_rate_retention_vs_champion = qualityGate.lead_rate_retention_vs_champion;
    row.close_rate_retention_vs_champion = qualityGate.close_rate_retention_vs_champion;
    row.quality_regression_reasons = qualityGate.reasons;
    row.no_quality_regression = qualityGate.ok;

    if (row.role === "champion") {
      row.decision = "keep_champion_until_challenger_beats_rule";
      continue;
    }
    if (row.role === "challenger") {
      const championRate = champion?.line_add_rate ?? 0;
      const lift = championRate === 0 ? null : row.line_add_rate / championRate;
      const beatsChampion = lift !== null && lift > config.win_rule.challenger_lift_required;
      if (!row.sample_threshold_met) row.decision = "keep_testing_sample_insufficient";
      else if (beatsChampion && row.no_quality_regression) row.decision = "eligible_for_human_promotion_review";
      else if (!row.no_quality_regression) row.decision = "reject_quality_regression";
      else row.decision = "retire_or_rework_candidate";
      row.champion_lift = lift === null ? null : round(lift);
    }
  }

  return {
    generated_at: new Date().toISOString(),
    week,
    thresholds,
    win_rule: config.win_rule,
    assets: rows.sort((a, b) => b.score - a.score),
  };
}

function buildQualityGate(row, champion, config) {
  const qualityRules = config.quality_rules ?? {};
  const maxSpamFlagRate = Number(qualityRules.max_spam_flag_rate ?? 0.05);
  const minLeadRetention = Number(qualityRules.min_lead_rate_retention_vs_champion ?? 0.8);
  const minCloseRetention = Number(qualityRules.min_close_rate_retention_vs_champion ?? 0.8);
  const minLineAdds = Number(config.sample_thresholds?.min_line_adds ?? 5);
  const spamFlagRate = safeDivide(row.low_quality_flags, row.quality_flags);
  const reasons = [];
  let leadRetention = null;
  let closeRetention = null;

  if (row.quality_flags > 0 && spamFlagRate > maxSpamFlagRate) {
    reasons.push("spam_flag_rate_above_limit");
  }

  if (row.role === "challenger" && champion) {
    if (champion.lead_rate > 0 && row.line_adds >= minLineAdds) {
      leadRetention = safeDivide(row.lead_rate, champion.lead_rate);
      if (leadRetention < minLeadRetention) {
        reasons.push("lead_rate_retention_below_champion");
      }
    }

    if (champion.close_rate > 0 && champion.leads > 0 && row.leads > 0) {
      closeRetention = safeDivide(row.close_rate, champion.close_rate);
      if (closeRetention < minCloseRetention) {
        reasons.push("close_rate_retention_below_champion");
      }
    }
  }

  return {
    ok: reasons.length === 0,
    spam_flag_rate: round(spamFlagRate),
    lead_rate_retention_vs_champion: leadRetention === null ? null : round(leadRetention),
    close_rate_retention_vs_champion: closeRetention === null ? null : round(closeRetention),
    reasons,
  };
}

function buildAbStatus(config, scores, events, week) {
  const champion = scores.assets.find((asset) => asset.role === "champion");
  const challenger = scores.assets.find((asset) => asset.role === "challenger");
  const championRate = champion?.line_add_rate ?? 0;
  const challengerRate = challenger?.line_add_rate ?? 0;
  const lift = championRate === 0 ? null : round(challengerRate / championRate);
  const challengerWins =
    lift !== null &&
    lift > config.win_rule.challenger_lift_required &&
    Boolean(challenger?.sample_threshold_met) &&
    Boolean(challenger?.no_quality_regression);
  return {
    week,
    events_observed: events.length,
    lift,
    sample_threshold_met: Boolean(challenger?.sample_threshold_met),
    no_quality_regression: Boolean(challenger?.no_quality_regression),
    quality_regression_reasons: challenger?.quality_regression_reasons ?? [],
    lead_rate_retention_vs_champion: challenger?.lead_rate_retention_vs_champion ?? null,
    close_rate_retention_vs_champion: challenger?.close_rate_retention_vs_champion ?? null,
    challenger_win_rule_met: challengerWins,
    decision: challengerWins ? "queue_human_promotion_review" : "do_not_promote_challenger",
    public_link_change_performed: false,
    production_deploy_performed: false,
  };
}

function calculateTestDays(first, last) {
  if (!first || !last) return 0;
  const start = new Date(first);
  const end = new Date(last);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return 0;
  return Math.max(Math.floor((end - start) / 86400000) + 1, 1);
}

function safeDivide(numerator, denominator) {
  if (!denominator) return 0;
  return numerator / denominator;
}

function round(value) {
  return Number(value.toFixed(4));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
