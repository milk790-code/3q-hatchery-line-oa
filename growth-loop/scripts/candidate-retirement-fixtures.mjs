import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "config", "growth-loop.config.json");
const CURRENT_QUEUE_PATH = path.join(ROOT, "candidate_retirement_queue.json");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const STATUS_PATH = path.join(ROOT, "data", "candidate_retirement_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "candidate_retirement_fixture_report.md");

async function main() {
  const generatedAt = new Date();
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const beforeRealEvents = await readOptional(REAL_EVENTS_PATH);
  const scenarios = buildScenarios(config).map((scenario) => runScenario(config, scenario, generatedAt));
  const afterRealEvents = await readOptional(REAL_EVENTS_PATH);
  const currentQueue = await readOptionalJson(CURRENT_QUEUE_PATH);
  const currentQueueSafety = checkCurrentQueue(currentQueue);

  const status = {
    ok: scenarios.every((scenario) => scenario.ok) && currentQueueSafety.ok && beforeRealEvents === afterRealEvents,
    generated_at: generatedAt.toISOString(),
    mode: "candidate_retirement_fixture_dry_run",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    scenario_count: scenarios.length,
    scenarios,
    current_queue_safety: currentQueueSafety,
    real_events_unchanged: beforeRealEvents === afterRealEvents,
    execution_performed: false,
    real_event_write_performed: false,
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
    champion_promotion_performed: false,
    note: "Fixture-only candidate retirement contract. It evaluates temporary score scenarios and never edits candidate_retirement_queue.json, writes data/lp_events.jsonl, changes public links, promotes challengers, deploys, posts, pushes LINE, mutates customer data, touches payments, or deletes data.",
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildScenarios(config) {
  const week = { start: "2026-07-06", end: "2026-07-12" };
  const champion = makeAsset({
    asset_id: "champion-fixture",
    role: "champion",
    visits: 120,
    cta_clicks: 30,
    line_adds: 10,
    test_days: 7,
    sample_threshold_met: true,
    decision: "keep_champion_until_challenger_beats_rule",
  });

  return [
    {
      id: "sample_insufficient_keeps_testing",
      description: "A challenger below sample threshold must stay in testing and cannot be retired.",
      week,
      assets: [
        champion,
        makeAsset({
          asset_id: "challenger-sample-gap",
          role: "challenger",
          visits: 40,
          cta_clicks: 8,
          line_adds: 1,
          test_days: 2,
          sample_threshold_met: false,
          decision: "keep_testing_sample_insufficient",
        }),
      ],
      expected: {
        queue_status: "no_retirement_sample_insufficient_or_not_needed",
        item_status: "keep_testing_sample_insufficient",
        recommended_action: "keep_in_candidate_rotation",
        retirement_ready: false,
        promotion_reviews: 0,
        keep_testing: 1,
      },
    },
    {
      id: "winning_challenger_requires_owner_review",
      description: "A challenger that wins the rate rule must be held for owner review, not retired or promoted.",
      week,
      assets: [
        champion,
        makeAsset({
          asset_id: "challenger-rate-winner",
          role: "challenger",
          visits: 120,
          cta_clicks: 28,
          line_adds: 14,
          test_days: 7,
          sample_threshold_met: true,
          decision: "eligible_for_human_promotion_review",
        }),
      ],
      expected: {
        queue_status: "no_retirement_sample_insufficient_or_not_needed",
        item_status: "promotion_review_required",
        recommended_action: "do_not_retire_or_promote_without_owner_review",
        retirement_ready: false,
        promotion_reviews: 1,
        keep_testing: 0,
      },
    },
    {
      id: "underperforming_challenger_ready_for_local_retirement",
      description: "A sampled challenger that fails the lift rule can be removed from future local rotation without deleting data.",
      week,
      assets: [
        champion,
        makeAsset({
          asset_id: "challenger-underperforming",
          role: "challenger",
          visits: 120,
          cta_clicks: 25,
          line_adds: 5,
          test_days: 7,
          sample_threshold_met: true,
          decision: "retire_or_rework_candidate",
        }),
      ],
      expected: {
        queue_status: "local_retirement_actions_prepared",
        item_status: "retire_local_candidate_due_underperformance",
        recommended_action: "remove_from_next_candidate_rotation_without_deleting_data",
        retirement_ready: true,
        promotion_reviews: 0,
        keep_testing: 0,
      },
    },
    {
      id: "quality_regression_ready_for_local_retirement",
      description: "A sampled challenger with quality regression can be locally retired without deleting data.",
      week,
      assets: [
        champion,
        makeAsset({
          asset_id: "challenger-quality-regression",
          role: "challenger",
          visits: 140,
          cta_clicks: 34,
          line_adds: 13,
          test_days: 7,
          sample_threshold_met: true,
          no_quality_regression: false,
          quality_regression_reasons: ["lead_rate_regression"],
          decision: "reject_quality_regression",
        }),
      ],
      expected: {
        queue_status: "local_retirement_actions_prepared",
        item_status: "retire_local_candidate_due_quality_regression",
        recommended_action: "remove_from_next_candidate_rotation_without_deleting_data",
        retirement_ready: true,
        promotion_reviews: 0,
        keep_testing: 0,
      },
    },
    {
      id: "unknown_candidate_observed_only",
      description: "A non-champion asset with an unknown role is observed only and cannot be promoted, retired, or deleted automatically.",
      week,
      assets: [
        champion,
        makeAsset({
          asset_id: "candidate-unknown-role",
          role: "candidate",
          visits: 110,
          cta_clicks: 24,
          line_adds: 4,
          test_days: 7,
          sample_threshold_met: true,
          decision: "needs_manual_classification",
        }),
      ],
      expected: {
        queue_status: "no_retirement_sample_insufficient_or_not_needed",
        item_status: "observed_only_no_rotation_action",
        recommended_action: "review_manually",
        retirement_ready: false,
        promotion_reviews: 0,
        keep_testing: 0,
      },
    },
    {
      id: "mixed_candidates_summary_counts",
      description: "Mixed candidate states must produce correct summary counts and still remain local-only.",
      week,
      assets: [
        champion,
        makeAsset({
          asset_id: "challenger-underperforming-mixed",
          role: "challenger",
          visits: 130,
          cta_clicks: 23,
          line_adds: 5,
          test_days: 7,
          sample_threshold_met: true,
          decision: "retire_or_rework_candidate",
        }),
        makeAsset({
          asset_id: "challenger-sample-gap-mixed",
          role: "challenger",
          visits: 70,
          cta_clicks: 12,
          line_adds: 2,
          test_days: 2,
          sample_threshold_met: false,
          decision: "keep_testing_sample_insufficient",
        }),
        makeAsset({
          asset_id: "challenger-winner-mixed",
          role: "challenger",
          visits: 140,
          cta_clicks: 35,
          line_adds: 18,
          test_days: 7,
          sample_threshold_met: true,
          decision: "eligible_for_human_promotion_review",
        }),
      ],
      expected: {
        queue_status: "local_retirement_actions_prepared",
        item_status: "retire_local_candidate_due_underperformance",
        recommended_action: "remove_from_next_candidate_rotation_without_deleting_data",
        retirement_ready: true,
        retirement_ready_count: 1,
        promotion_reviews: 1,
        keep_testing: 1,
      },
    },
  ];
}

function runScenario(config, scenario, now) {
  const abStatus = {
    test_id: `fixture-${scenario.id}`,
    changed_variable: config.current_round.changed_variable,
  };
  const scores = { assets: scenario.assets };
  const queue = buildCandidateRetirementQueue(config, scores, abStatus, scenario.week, now);
  const firstTargetItem = queue.items.find((item) => item.status === scenario.expected.item_status) ?? queue.items[0];
  const assertions = [
    assertEqual("queue_status", scenario.expected.queue_status, queue.status),
    assertEqual("item_status", scenario.expected.item_status, firstTargetItem?.status),
    assertEqual("recommended_action", scenario.expected.recommended_action, firstTargetItem?.recommended_action),
    assertEqual("retirement_ready", scenario.expected.retirement_ready, Boolean(firstTargetItem?.retirement_ready)),
    assertEqual("promotion_reviews", scenario.expected.promotion_reviews, queue.summary.promotion_reviews),
    assertEqual("keep_testing", scenario.expected.keep_testing, queue.summary.keep_testing),
    assertEqual("policy_no_data_delete", true, queue.policy.no_data_delete),
    assertEqual("policy_no_primary_link_change", true, queue.policy.no_primary_link_change),
    assertEqual("policy_no_champion_promotion", true, queue.policy.no_champion_promotion),
    assertEqual("policy_local_rotation_only", true, queue.policy.local_rotation_only),
    assertEqual("no_item_external_effect", true, queue.items.every((item) => item.external_effect === false)),
  ];

  if (scenario.expected.retirement_ready_count !== undefined) {
    assertions.push(assertEqual("retirement_ready_count", scenario.expected.retirement_ready_count, queue.summary.retirement_ready));
  }

  if (scenario.id === "winning_challenger_requires_owner_review") {
    assertions.push(assertEqual("winner_has_human_gate", true, Boolean(firstTargetItem?.human_gate)));
  }

  if (scenario.id === "unknown_candidate_observed_only") {
    assertions.push(assertEqual("unknown_has_manual_gate", true, Boolean(firstTargetItem?.human_gate)));
  }

  return {
    id: scenario.id,
    ok: assertions.every((assertion) => assertion.ok),
    description: scenario.description,
    assertions,
    queue_status: queue.status,
    summary: queue.summary,
    target_item: firstTargetItem,
    policy: queue.policy,
    external_effect: false,
    public_link_change_performed: false,
    champion_promotion_performed: false,
    delete_action_performed: false,
  };
}

function buildCandidateRetirementQueue(config, scores, abStatus, week, now) {
  const champion = scores.assets.find((asset) => asset.role === "champion");
  const candidates = scores.assets.filter((asset) => asset.role !== "champion");
  const items = candidates.map((asset) => {
    if (asset.role === "challenger" && !asset.sample_threshold_met) {
      return {
        asset_id: asset.asset_id,
        role: asset.role,
        status: "keep_testing_sample_insufficient",
        recommended_action: "keep_in_candidate_rotation",
        retirement_ready: false,
        external_effect: false,
        reason: `sample_threshold_met=false; visits=${asset.visits}, cta_clicks=${asset.cta_clicks}, line_adds=${asset.line_adds}, test_days=${asset.test_days}`,
        human_gate: null,
      };
    }

    if (asset.role === "challenger" && asset.decision === "eligible_for_human_promotion_review") {
      return {
        asset_id: asset.asset_id,
        role: asset.role,
        status: "promotion_review_required",
        recommended_action: "do_not_retire_or_promote_without_owner_review",
        retirement_ready: false,
        external_effect: false,
        reason: "challenger meets win rule, but promotion changes the primary funnel and remains gated",
        human_gate: "Owner must approve champion replacement manually.",
      };
    }

    if (asset.role === "challenger" && asset.decision === "reject_quality_regression") {
      return {
        asset_id: asset.asset_id,
        role: asset.role,
        status: "retire_local_candidate_due_quality_regression",
        recommended_action: "remove_from_next_candidate_rotation_without_deleting_data",
        retirement_ready: true,
        external_effect: false,
        reason: "sample is sufficient but quality regression was observed",
        human_gate: "Do not delete historical event data; only stop using this candidate in future drafts.",
      };
    }

    if (asset.role === "challenger" && asset.decision === "retire_or_rework_candidate") {
      return {
        asset_id: asset.asset_id,
        role: asset.role,
        status: "retire_local_candidate_due_underperformance",
        recommended_action: "remove_from_next_candidate_rotation_without_deleting_data",
        retirement_ready: true,
        external_effect: false,
        reason: `sample is sufficient but line_add_rate=${percent(asset.line_add_rate)} did not beat champion by ${config.win_rule.challenger_lift_required}x`,
        human_gate: "Do not change public links or delete data; retirement is local rotation control only.",
      };
    }

    return {
      asset_id: asset.asset_id,
      role: asset.role,
      status: "observed_only_no_rotation_action",
      recommended_action: "review_manually",
      retirement_ready: false,
      external_effect: false,
      reason: `role=${asset.role}; decision=${asset.decision}`,
      human_gate: "Unknown assets are not promoted, deleted, or published automatically.",
    };
  });

  const retirementReady = items.filter((item) => item.retirement_ready);

  return {
    generated_at: now.toISOString(),
    week,
    status: retirementReady.length > 0 ? "local_retirement_actions_prepared" : "no_retirement_sample_insufficient_or_not_needed",
    champion_asset_id: champion?.asset_id ?? null,
    ab_test_id: abStatus.test_id,
    changed_variable: config.current_round.changed_variable,
    policy: {
      no_data_delete: true,
      no_primary_link_change: true,
      no_champion_promotion: true,
      local_rotation_only: true,
    },
    summary: {
      candidates_observed: candidates.length,
      retirement_ready: retirementReady.length,
      keep_testing: items.filter((item) => item.status === "keep_testing_sample_insufficient").length,
      promotion_reviews: items.filter((item) => item.status === "promotion_review_required").length,
    },
    items,
  };
}

function makeAsset(input) {
  const visits = Number(input.visits ?? 0);
  const lineAdds = Number(input.line_adds ?? 0);
  const leads = Number(input.leads ?? 0);
  const deals = Number(input.deals ?? 0);
  return {
    asset_id: input.asset_id,
    role: input.role,
    visits,
    cta_clicks: Number(input.cta_clicks ?? 0),
    line_adds: lineAdds,
    leads,
    deals,
    test_days: Number(input.test_days ?? 0),
    line_add_rate: visits > 0 ? lineAdds / visits : 0,
    lead_rate: visits > 0 ? leads / visits : 0,
    close_rate: visits > 0 ? deals / visits : 0,
    sample_threshold_met: Boolean(input.sample_threshold_met),
    no_quality_regression: input.no_quality_regression !== false,
    quality_regression_reasons: input.quality_regression_reasons ?? [],
    decision: input.decision,
  };
}

function checkCurrentQueue(queue) {
  if (!queue) {
    return {
      ok: false,
      status: "missing_current_queue",
      message: "candidate_retirement_queue.json is missing.",
    };
  }

  const issues = [];
  if (queue.policy?.no_data_delete !== true) issues.push("policy.no_data_delete must be true");
  if (queue.policy?.no_primary_link_change !== true) issues.push("policy.no_primary_link_change must be true");
  if (queue.policy?.no_champion_promotion !== true) issues.push("policy.no_champion_promotion must be true");
  if (!Array.isArray(queue.items)) issues.push("items must be an array");
  if (Array.isArray(queue.items) && !queue.items.every((item) => item.external_effect === false)) issues.push("all items must have external_effect=false");

  return {
    ok: issues.length === 0,
    status: issues.length === 0 ? "current_queue_safe" : "current_queue_attention",
    issues,
    current_status: queue.status ?? null,
    items: Array.isArray(queue.items) ? queue.items.length : 0,
    retirement_ready: queue.summary?.retirement_ready ?? null,
  };
}

function assertEqual(name, expected, actual) {
  return {
    name,
    ok: Object.is(expected, actual),
    expected,
    actual,
    external_effect: false,
  };
}

async function readOptional(relativeOrAbsolutePath) {
  try {
    return await readFile(relativeOrAbsolutePath, "utf8");
  } catch {
    return "";
  }
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function renderReport(status) {
  const rows = status.scenarios
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "fail"} | ${scenario.queue_status} | ${scenario.summary.retirement_ready} | ${scenario.summary.keep_testing} | ${scenario.summary.promotion_reviews} | ${scenario.target_item?.status ?? "n/a"} |`)
    .join("\n");

  return `# Candidate Retirement Fixture Report

BLUF: ${status.ok ? "candidate_retirement_fixture_ok" : "candidate_retirement_fixture_failed"}. This fixture proves non-main candidate retirement stays local-only, sample-insufficient candidates keep testing, winning challengers require owner review, and underperforming or quality-regressed candidates can only be removed from future local rotation without deleting data.

Generated: ${status.generated_at}
Mode: ${status.mode}

## Safety

- Current queue safety: ${status.current_queue_safety.ok ? "ok" : "attention"} (${status.current_queue_safety.status})
- Real events unchanged: ${status.real_events_unchanged ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${status.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${status.external_effect ? "yes" : "no"}
- Public link change performed: ${status.public_link_change_performed ? "yes" : "no"}
- Champion promotion performed: ${status.champion_promotion_performed ? "yes" : "no"}
- Delete action performed: ${status.delete_action_performed ? "yes" : "no"}

## Scenarios

| scenario | status | queue | retire ready | keep testing | promotion reviews | target item |
|---|---|---|---:|---:|---:|---|
${rows}

## Note

This script does not edit candidate_retirement_queue.json. It only writes ${path.relative(ROOT, STATUS_PATH)} and ${path.relative(ROOT, REPORT_PATH)}.
`;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
