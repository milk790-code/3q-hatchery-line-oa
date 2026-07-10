import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { canonicalRates } from "./lib/scoring-policy.mjs";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "config", "growth-loop.config.json");
const STATUS_PATH = path.join(ROOT, "data", "real_data_decision_replay_status.json");
const REPORT_PATH = path.join(ROOT, "real_data_decision_replay_report.md");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const FUNNEL_HEADER = "date,asset_id,event_type,count,source,medium,campaign,content_id,variant_id,quality_score";
const MANUAL_HEADER = FUNNEL_HEADER;
const LEDGER_HEADER = "week_start,week_end,capture_date,stage,stage_label,asset_id,content_id,variant_id,tracking_link_id,tracking_url,source_surface,source_metric,target_template,target_live_file,aggregate_count,quality_score,evidence_ref,reviewer,pii_checked,notes";
const FUNNEL_TEMPLATE = "data/real_data_input_pack/funnel_aggregates.fill-template.csv";
const MANUAL_TEMPLATE = "data/real_data_input_pack/manual_conversions.fill-template.csv";
const FUNNEL_LIVE = "data/funnel_aggregates.csv";
const MANUAL_LIVE = "data/manual_conversions.csv";
const EVENT_TYPES = ["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"];

async function main() {
  const generatedAt = new Date();
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "3q-growth-loop-decision-replay-"));
  const week = {
    start: "2026-07-06",
    end: "2026-07-12",
  };
  const scenarios = buildScenarios(config, week);
  const beforeRealEvents = await readOptional(REAL_EVENTS_PATH);
  const results = [];

  for (const scenario of scenarios) {
    results.push(await runScenario(tmpDir, config, scenario, week));
  }

  const afterRealEvents = await readOptional(REAL_EVENTS_PATH);
  const realEventsUnchanged = beforeRealEvents === afterRealEvents;
  const status = {
    ok: results.every((result) => result.ok) && realEventsUnchanged,
    generated_at: generatedAt.toISOString(),
    mode: "real_data_decision_replay_fixture_dry_run",
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    temp_dir: tmpDir,
    scenario_count: results.length,
    scenario_ids: results.map((result) => result.id),
    scenarios: results,
    local_fixture_commands_executed: true,
    local_importer_preview_commands_executed: true,
    source_capture_ledger_replay_executed: true,
    source_capture_compile_commands_executed: true,
    ledger_to_decision_replay_performed: true,
    execution_performed: false,
    real_events_unchanged: realEventsUnchanged,
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
    note: "Fixture-only decision replay. It writes synthetic filled source-capture ledgers, compiles owner-preview CSVs, imports them into temporary JSONL, scores them locally, and proves no data/lp_events.jsonl write or external action occurs.",
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildScenarios(config, week) {
  const champion = config.assets.find((asset) => asset.role === "champion");
  const challenger = config.assets.find((asset) => asset.role === "challenger");
  if (!champion || !challenger) {
    throw new Error("Config must include one champion and one challenger asset.");
  }

  const baseChampion = { link_click: 120, page_view: 120, cta_click: 30, line_add: 12, lead_submit: 3, deal: 1, test_days: 4 };
  return [
    {
      id: "sample_insufficient_replay",
      description: "Challenger lift is visible, but visits stay below min_visits so the champion remains in place.",
      champion: baseChampion,
      challenger: { link_click: 99, page_view: 99, cta_click: 30, line_add: 15, lead_submit: 3, deal: 1, test_days: 4 },
      expected: {
        challenger_decision: "keep_testing_sample_insufficient",
        ab_decision: "do_not_promote_challenger",
        challenger_win_rule_met: false,
        next_round_decision: "continue_current_round_until_sample_threshold",
        next_changed_variable: config.current_round.changed_variable,
        start_new_variable_round: false,
        quality_reasons_include: [],
      },
    },
    {
      id: "winning_replay_owner_review_only",
      description: "Challenger beats line_add_rate by more than 1.15x with enough sample and no quality regression.",
      champion: baseChampion,
      challenger: { link_click: 120, page_view: 120, cta_click: 30, line_add: 17, lead_submit: 4, deal: 2, test_days: 4 },
      expected: {
        challenger_decision: "eligible_for_human_promotion_review",
        ab_decision: "queue_human_promotion_review",
        challenger_win_rule_met: true,
        next_round_decision: "queue_owner_promotion_review_before_next_variable",
        next_changed_variable: config.current_round.changed_variable,
        start_new_variable_round: false,
        quality_reasons_include: [],
      },
    },
    {
      id: "underperform_replay_next_variable",
      description: "Sample is ready, but challenger does not beat champion, so the next local draft can rotate variables.",
      champion: baseChampion,
      challenger: { link_click: 120, page_view: 120, cta_click: 30, line_add: 12, lead_submit: 3, deal: 1, test_days: 4 },
      expected: {
        challenger_decision: "retire_or_rework_candidate",
        ab_decision: "do_not_promote_challenger",
        challenger_win_rule_met: false,
        next_round_decision: "retire_underperforming_challenger_plan_next_variable",
        next_changed_variable: nextVariable(config),
        start_new_variable_round: true,
        quality_reasons_include: [],
      },
    },
    {
      id: "spam_regression_replay",
      description: "Challenger beats line_add_rate, but low-quality flags exceed the spam limit.",
      champion: baseChampion,
      challenger: { link_click: 120, page_view: 120, cta_click: 30, line_add: 17, lead_submit: 4, deal: 1, quality_flag: 10, low_quality_flag: 2, test_days: 4 },
      expected: {
        challenger_decision: "reject_quality_regression",
        ab_decision: "do_not_promote_challenger",
        challenger_win_rule_met: false,
        next_round_decision: "reject_challenger_quality_regression_plan_next_variable",
        next_changed_variable: nextVariable(config),
        start_new_variable_round: true,
        quality_reasons_include: ["spam_flag_rate_above_limit"],
      },
    },
    {
      id: "lead_regression_replay",
      description: "Challenger beats line_add_rate, but lead-rate retention falls below the champion guardrail.",
      champion: { link_click: 120, page_view: 120, cta_click: 30, line_add: 12, lead_submit: 6, deal: 2, test_days: 4 },
      challenger: { link_click: 120, page_view: 120, cta_click: 30, line_add: 17, lead_submit: 2, deal: 1, test_days: 4 },
      expected: {
        challenger_decision: "reject_quality_regression",
        ab_decision: "do_not_promote_challenger",
        challenger_win_rule_met: false,
        next_round_decision: "reject_challenger_quality_regression_plan_next_variable",
        next_changed_variable: nextVariable(config),
        start_new_variable_round: true,
        quality_reasons_include: ["lead_rate_retention_below_champion"],
      },
    },
    {
      id: "close_regression_replay",
      description: "Challenger beats line_add_rate and lead retention holds, but close-rate retention collapses.",
      champion: { link_click: 120, page_view: 120, cta_click: 30, line_add: 12, lead_submit: 4, deal: 2, test_days: 4 },
      challenger: { link_click: 120, page_view: 120, cta_click: 30, line_add: 17, lead_submit: 5, deal: 0, test_days: 4 },
      expected: {
        challenger_decision: "reject_quality_regression",
        ab_decision: "do_not_promote_challenger",
        challenger_win_rule_met: false,
        next_round_decision: "reject_challenger_quality_regression_plan_next_variable",
        next_changed_variable: nextVariable(config),
        start_new_variable_round: true,
        quality_reasons_include: ["close_rate_retention_below_champion"],
      },
    },
  ].map((scenario) => ({
    ...scenario,
    asset_ids: {
      champion: champion.asset_id,
      challenger: challenger.asset_id,
    },
    week,
  }));
}

async function runScenario(tmpDir, config, scenario, week) {
  const scenarioDir = path.join(tmpDir, scenario.id);
  await mkdir(scenarioDir, { recursive: true });
  const ledgerPath = path.join(scenarioDir, "source_capture_ledger.filled.csv");
  const compileDir = path.join(scenarioDir, "compiled");
  const compiledFunnelCsvPath = path.join(compileDir, "funnel_aggregates.owner-preview.csv");
  const compiledManualCsvPath = path.join(compileDir, "manual_conversions.owner-preview.csv");
  const compileStatusPath = path.join(scenarioDir, "source_capture_compile_status.json");
  const compileReportPath = path.join(scenarioDir, "source_capture_compile_report.md");
  const eventsPath = path.join(scenarioDir, "combined.preview.jsonl");
  const funnelStatusPath = path.join(scenarioDir, "funnel_aggregate_status.json");
  const manualStatusPath = path.join(scenarioDir, "manual_conversion_status.json");

  await writeFile(ledgerPath, renderLedgerCsv(scenario));

  const compileExecution = await runImporter(
    [
      "scripts/source-capture-compile.mjs",
      `--input=${ledgerPath}`,
      "--input-kind=decision_replay_fixture",
      `--output-dir=${compileDir}`,
      `--funnel-preview=${compiledFunnelCsvPath}`,
      `--manual-preview=${compiledManualCsvPath}`,
      `--status=${compileStatusPath}`,
      `--report=${compileReportPath}`,
      `--real-events=${REAL_EVENTS_PATH}`,
    ],
    {},
  );
  const compileStatus = await readOptionalJson(compileStatusPath);

  const funnelExecution = await runImporter(
    ["scripts/import-funnel-aggregates.mjs", `--input=${compiledFunnelCsvPath}`, `--output=${eventsPath}`],
    { FUNNEL_AGGREGATE_STATUS_PATH: funnelStatusPath },
  );
  const manualExecution = await runImporter(
    ["scripts/import-manual-conversions.mjs", `--input=${compiledManualCsvPath}`, `--output=${eventsPath}`, "--append"],
    { MANUAL_CONVERSION_STATUS_PATH: manualStatusPath },
  );
  const funnelStatus = await readOptionalJson(funnelStatusPath);
  const manualStatus = await readOptionalJson(manualStatusPath);
  const events = await readJsonl(eventsPath);
  const scores = scoreAssets(config, events, week);
  const abStatus = buildAbStatus(config, scores, events, week);
  const retirementQueue = { status: "decision_replay_fixture_local_only" };
  const nextRoundPlan = buildNextRoundPlan(config, scores, abStatus, retirementQueue, week, new Date());
  const challenger = scores.assets.find((asset) => asset.role === "challenger");
  const assertions = buildAssertions(scenario, challenger, abStatus, nextRoundPlan, compileStatus, funnelStatus, manualStatus, compileExecution, funnelExecution, manualExecution);

  return {
    id: scenario.id,
    ok: assertions.every((assertion) => assertion.ok),
    description: scenario.description,
    imported_events: events.length,
    expected: scenario.expected,
    assertions,
    source_capture_compile: {
      ok: compileStatus?.ok === true,
      mode: compileStatus?.mode ?? "missing",
      status: compileStatus?.status ?? "missing",
      input_kind: compileStatus?.input_kind ?? "missing",
      filled_rows: compileStatus?.filled_rows ?? 0,
      funnel_rows: compileStatus?.funnel_rows ?? 0,
      manual_rows: compileStatus?.manual_rows ?? 0,
      issue_count: compileStatus?.issue_count ?? 0,
      data_lp_events_write_performed: Boolean(compileStatus?.data_lp_events_write_performed),
      live_input_files_created: Boolean(compileStatus?.live_input_files_created),
      external_effect: Boolean(compileStatus?.external_effect),
    },
    importer_status: {
      funnel_ok: funnelStatus?.ok === true,
      funnel_mode: funnelStatus?.mode ?? "missing",
      funnel_events_written: funnelStatus?.events_written ?? 0,
      funnel_data_lp_events_write_performed: Boolean(funnelStatus?.data_lp_events_write_performed),
      manual_ok: manualStatus?.ok === true,
      manual_mode: manualStatus?.mode ?? "missing",
      manual_events_written: manualStatus?.events_written ?? 0,
      manual_append_performed: Boolean(manualStatus?.append_performed),
      manual_data_lp_events_write_performed: Boolean(manualStatus?.data_lp_events_write_performed),
    },
    challenger_summary: summarizeChallenger(challenger),
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
    next_round_summary: {
      status: nextRoundPlan.status,
      decision: nextRoundPlan.decision,
      changed_variable: nextRoundPlan.next_round.changed_variable,
      start_new_variable_round: nextRoundPlan.next_round.start_new_variable_round,
      public_link_change_performed: nextRoundPlan.next_round.public_link_change_performed,
      production_deploy_performed: nextRoundPlan.next_round.production_deploy_performed,
    },
    promotion_performed: false,
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
    temp_files: {
      source_capture_ledger_path: ledgerPath,
      source_capture_compile_status_path: compileStatusPath,
      source_capture_compile_report_path: compileReportPath,
      compiled_funnel_csv_path: compiledFunnelCsvPath,
      compiled_manual_csv_path: compiledManualCsvPath,
      events_path: eventsPath,
      funnel_status_path: funnelStatusPath,
      manual_status_path: manualStatusPath,
    },
    importer_exit_codes: {
      source_capture_compile: compileExecution.exitCode,
      funnel: funnelExecution.exitCode,
      manual: manualExecution.exitCode,
    },
  };
}

function buildAssertions(scenario, challenger, abStatus, nextRoundPlan, compileStatus, funnelStatus, manualStatus, compileExecution, funnelExecution, manualExecution) {
  const expected = scenario.expected;
  return [
    {
      name: "source_capture_compile_preview_ok",
      ok: compileExecution.exitCode === 0 && compileStatus?.ok === true && compileStatus.mode === "source_capture_compile_preview",
      expected: "source_capture_compile_preview",
      actual: compileStatus?.mode ?? "missing",
    },
    {
      name: "source_capture_compile_owner_preview_ready",
      ok: compileStatus?.status === "owner_preview_ready" && compileStatus.filled_rows > 0 && compileStatus.funnel_rows > 0 && compileStatus.manual_rows > 0,
      expected: "owner_preview_ready_with_rows",
      actual: `${compileStatus?.status ?? "missing"}:${compileStatus?.filled_rows ?? 0}:${compileStatus?.funnel_rows ?? 0}:${compileStatus?.manual_rows ?? 0}`,
    },
    {
      name: "source_capture_compile_does_not_write_real_events",
      ok: compileStatus?.data_lp_events_write_performed === false && compileStatus?.live_input_files_created === false && compileStatus?.external_effect === false,
      expected: false,
      actual: Boolean(compileStatus?.data_lp_events_write_performed || compileStatus?.live_input_files_created || compileStatus?.external_effect),
    },
    {
      name: "funnel_import_preview_ok",
      ok: funnelExecution.exitCode === 0 && funnelStatus?.ok === true && funnelStatus.mode === "full_funnel_preview",
      expected: "full_funnel_preview",
      actual: funnelStatus?.mode ?? "missing",
    },
    {
      name: "manual_import_preview_ok",
      ok: manualExecution.exitCode === 0 && manualStatus?.ok === true && manualStatus.mode === "preview" && manualStatus.append_performed === true,
      expected: "preview_append",
      actual: `${manualStatus?.mode ?? "missing"}:${Boolean(manualStatus?.append_performed)}`,
    },
    {
      name: "importers_do_not_write_real_events",
      ok: funnelStatus?.data_lp_events_write_performed === false && manualStatus?.data_lp_events_write_performed === false,
      expected: false,
      actual: Boolean(funnelStatus?.data_lp_events_write_performed || manualStatus?.data_lp_events_write_performed),
    },
    {
      name: "challenger_decision",
      ok: challenger?.decision === expected.challenger_decision,
      expected: expected.challenger_decision,
      actual: challenger?.decision ?? null,
    },
    {
      name: "ab_decision",
      ok: abStatus.decision === expected.ab_decision,
      expected: expected.ab_decision,
      actual: abStatus.decision,
    },
    {
      name: "challenger_win_rule_met",
      ok: abStatus.challenger_win_rule_met === expected.challenger_win_rule_met,
      expected: expected.challenger_win_rule_met,
      actual: abStatus.challenger_win_rule_met,
    },
    {
      name: "next_round_decision",
      ok: nextRoundPlan.decision === expected.next_round_decision,
      expected: expected.next_round_decision,
      actual: nextRoundPlan.decision,
    },
    {
      name: "next_changed_variable",
      ok: nextRoundPlan.next_round.changed_variable === expected.next_changed_variable,
      expected: expected.next_changed_variable,
      actual: nextRoundPlan.next_round.changed_variable,
    },
    {
      name: "start_new_variable_round",
      ok: nextRoundPlan.next_round.start_new_variable_round === expected.start_new_variable_round,
      expected: expected.start_new_variable_round,
      actual: nextRoundPlan.next_round.start_new_variable_round,
    },
    {
      name: "quality_reasons_include",
      ok: (expected.quality_reasons_include ?? []).every((reason) => (challenger?.quality_regression_reasons ?? []).includes(reason)),
      expected: expected.quality_reasons_include ?? [],
      actual: challenger?.quality_regression_reasons ?? [],
    },
    {
      name: "no_external_effect",
      ok: abStatus.public_link_change_performed === false &&
        abStatus.production_deploy_performed === false &&
        nextRoundPlan.next_round.public_link_change_performed === false &&
        nextRoundPlan.next_round.production_deploy_performed === false,
      expected: false,
      actual: false,
    },
  ];
}

function renderFunnelCsv(scenario) {
  const rows = [
    ...countRows(scenario.asset_ids.champion, scenario.champion, scenario.week.start, scenario.id, "champion", ["link_click", "page_view", "cta_click"]),
    ...countRows(scenario.asset_ids.challenger, scenario.challenger, scenario.week.start, scenario.id, "challenger", ["link_click", "page_view", "cta_click"]),
  ];
  return [FUNNEL_HEADER, ...rows].join("\n") + "\n";
}

function renderManualCsv(scenario) {
  const rows = [
    ...countRows(scenario.asset_ids.champion, scenario.champion, scenario.week.start, scenario.id, "champion", ["line_add", "lead_submit", "deal", "quality_flag"]),
    ...countRows(scenario.asset_ids.challenger, scenario.challenger, scenario.week.start, scenario.id, "challenger", ["line_add", "lead_submit", "deal", "quality_flag"]),
  ];
  return [MANUAL_HEADER, ...rows].join("\n") + "\n";
}

function renderLedgerCsv(scenario) {
  const rows = [
    ...ledgerCountRows(scenario.asset_ids.champion, scenario.champion, scenario, "champion", ["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"]),
    ...ledgerCountRows(scenario.asset_ids.challenger, scenario.challenger, scenario, "challenger", ["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"]),
  ];
  return [LEDGER_HEADER, ...rows].join("\n") + "\n";
}

function ledgerCountRows(assetId, counts, scenario, role, eventTypes) {
  const rows = [];
  for (const eventType of eventTypes) {
    if (eventType === "quality_flag") {
      rows.push(...qualityLedgerRows(assetId, counts, scenario, role));
      continue;
    }
    const count = Number(counts[eventType] ?? 0);
    if (count <= 0) continue;
    const split = splitCount(count, counts.test_days ?? 1);
    split.forEach((value, dayIndex) => {
      if (value <= 0) return;
      rows.push(ledgerCsvRow({
        ...baseLedgerRow(assetId, scenario, role, eventType, dayIndex),
        aggregate_count: value,
        quality_score: "",
      }));
    });
  }
  return rows;
}

function qualityLedgerRows(assetId, counts, scenario, role) {
  const total = Number(counts.quality_flag ?? 0);
  if (total <= 0) return [];
  const low = Math.min(total, Number(counts.low_quality_flag ?? 0));
  const high = total - low;
  return [
    ...qualityScoreLedgerRows(assetId, low, 0, counts.test_days ?? 1, scenario, role),
    ...qualityScoreLedgerRows(assetId, high, 1, counts.test_days ?? 1, scenario, role),
  ];
}

function qualityScoreLedgerRows(assetId, count, score, testDays, scenario, role) {
  if (count <= 0) return [];
  return splitCount(count, testDays).flatMap((value, dayIndex) => {
    if (value <= 0) return [];
    return ledgerCsvRow({
      ...baseLedgerRow(assetId, scenario, role, "quality_flag", dayIndex),
      variant_id: `${role}-quality-${score}`,
      aggregate_count: value,
      quality_score: String(score),
    });
  });
}

function baseLedgerRow(assetId, scenario, role, eventType, dayIndex) {
  const targetLiveFile = ["link_click", "page_view", "cta_click"].includes(eventType) ? FUNNEL_LIVE : MANUAL_LIVE;
  const targetTemplate = targetLiveFile === FUNNEL_LIVE ? FUNNEL_TEMPLATE : MANUAL_TEMPLATE;
  const contentId = `${scenario.id}-${role}`;
  const variantId = `${role}-${eventType}`;
  const trackingUrl = `http://127.0.0.1:8787/r/${assetId}?to=${role}&utm_source=decision_replay&utm_medium=source_capture_ledger&utm_campaign=${scenario.id}&variant_id=${encodeURIComponent(variantId)}&content_id=${encodeURIComponent(contentId)}`;
  return {
    week_start: scenario.week.start,
    week_end: scenario.week.end,
    capture_date: addDays(scenario.week.start, dayIndex),
    stage: eventType,
    stage_label: stageLabel(eventType),
    asset_id: assetId,
    content_id: contentId,
    variant_id: variantId,
    tracking_link_id: `decision-replay-${scenario.id}-${role}-${eventType}`,
    tracking_url: trackingUrl,
    source_surface: "decision replay fixture aggregate ledger",
    source_metric: eventType === "quality_flag" ? "quality_flag count and aggregate quality_score" : `${eventType} aggregate count`,
    target_template: targetTemplate,
    target_live_file: targetLiveFile,
    aggregate_count: "",
    quality_score: "",
    evidence_ref: `fixtures/${scenario.id}/${role}/${eventType}.csv`,
    reviewer: "owner",
    pii_checked: "yes",
    notes: "synthetic aggregate fixture only; no customer data",
  };
}

function stageLabel(eventType) {
  const labels = {
    link_click: "連結點擊",
    page_view: "落地頁瀏覽",
    cta_click: "CTA 點擊",
    line_add: "LINE 進線 / 加好友",
    lead_submit: "留資",
    deal: "成交",
    quality_flag: "品質 / 垃圾訊號",
  };
  return labels[eventType] ?? eventType;
}

function ledgerCsvRow(fields) {
  return [
    fields.week_start,
    fields.week_end,
    fields.capture_date,
    fields.stage,
    fields.stage_label,
    fields.asset_id,
    fields.content_id,
    fields.variant_id,
    fields.tracking_link_id,
    fields.tracking_url,
    fields.source_surface,
    fields.source_metric,
    fields.target_template,
    fields.target_live_file,
    fields.aggregate_count,
    fields.quality_score,
    fields.evidence_ref,
    fields.reviewer,
    fields.pii_checked,
    fields.notes,
  ].map(csvCell).join(",");
}

function countRows(assetId, counts, startDate, scenarioId, role, eventTypes) {
  const rows = [];
  for (const eventType of eventTypes) {
    const count = Number(counts[eventType] ?? 0);
    if (eventType === "quality_flag") {
      rows.push(...qualityRows(assetId, counts, startDate, scenarioId, role));
      continue;
    }
    if (count <= 0) continue;
    const split = splitCount(count, counts.test_days ?? 1);
    split.forEach((value, dayIndex) => {
      if (value <= 0) return;
      rows.push(csvRow({
        date: addDays(startDate, dayIndex),
        asset_id: assetId,
        event_type: eventType,
        count: value,
        source: "decision_replay",
        medium: eventTypes.includes("link_click") ? "full_funnel_aggregate" : "manual_aggregate",
        campaign: scenarioId,
        content_id: `${scenarioId}-${role}`,
        variant_id: `${role}-${eventType}`,
        quality_score: "",
      }));
    });
  }
  return rows;
}

function qualityRows(assetId, counts, startDate, scenarioId, role) {
  const total = Number(counts.quality_flag ?? 0);
  if (total <= 0) return [];
  const low = Math.min(total, Number(counts.low_quality_flag ?? 0));
  const high = total - low;
  return [
    ...qualityScoreRows(assetId, low, 0, counts.test_days ?? 1, startDate, scenarioId, role),
    ...qualityScoreRows(assetId, high, 1, counts.test_days ?? 1, startDate, scenarioId, role),
  ];
}

function qualityScoreRows(assetId, count, score, testDays, startDate, scenarioId, role) {
  if (count <= 0) return [];
  return splitCount(count, testDays).flatMap((value, dayIndex) => {
    if (value <= 0) return [];
    return csvRow({
      date: addDays(startDate, dayIndex),
      asset_id: assetId,
      event_type: "quality_flag",
      count: value,
      source: "decision_replay",
      medium: "manual_aggregate",
      campaign: scenarioId,
      content_id: `${scenarioId}-${role}`,
      variant_id: `${role}-quality-${score}`,
      quality_score: String(score),
    });
  });
}

function csvRow(fields) {
  return [
    fields.date,
    fields.asset_id,
    fields.event_type,
    fields.count,
    fields.source,
    fields.medium,
    fields.campaign,
    fields.content_id,
    fields.variant_id,
    fields.quality_score,
  ].map(csvCell).join(",");
}

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function splitCount(count, days) {
  const safeDays = Math.max(1, Number(days) || 1);
  const base = Math.floor(count / safeDays);
  const remainder = count % safeDays;
  return Array.from({ length: safeDays }, (_, index) => base + (index < remainder ? 1 : 0));
}

function addDays(startDate, dayIndex) {
  const parsed = new Date(`${startDate}T12:00:00+08:00`);
  parsed.setDate(parsed.getDate() + dayIndex);
  return parsed.toISOString().slice(0, 10);
}

async function runImporter(args, envOverrides) {
  try {
    const { stdout, stderr } = await execFileAsync("node", args, {
      cwd: ROOT,
      env: {
        ...process.env,
        ...envOverrides,
      },
      maxBuffer: 1024 * 1024 * 8,
    });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    return {
      exitCode: Number.isInteger(error.code) ? error.code : 1,
      stdout: String(error.stdout ?? ""),
      stderr: String(error.stderr ?? error.message ?? ""),
    };
  }
}

async function readJsonl(filePath) {
  const raw = await readFile(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const event = JSON.parse(line);
      if (!EVENT_TYPES.includes(event.event_type)) {
        throw new Error(`Invalid event_type at ${filePath}:${index + 1}: ${event.event_type}`);
      }
      return event;
    });
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function readOptional(filePath) {
  try {
    await access(filePath);
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
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
    const ctaRate = rates.cta_rate;
    const lineAddRate = rates.line_add_rate;
    const leadRate = rates.lead_rate;
    const closeRate = rates.close_rate;
    const testDays = calculateTestDays(row.first_event_at, row.last_event_at);
    const spamFlagRate = safeDivide(row.low_quality_flags, row.quality_flags);
    const sampleThresholdMet =
      row.visits >= thresholds.min_visits &&
      row.cta_clicks >= thresholds.min_cta_clicks &&
      row.line_adds >= thresholds.min_line_adds &&
      testDays >= thresholds.min_test_days;
    const score = Number((lineAddRate * 50 + leadRate * 30 + closeRate * 20).toFixed(4));

    return {
      ...row,
      week_start: week.start,
      week_end: week.end,
      cta_rate: round(ctaRate),
      line_add_rate: round(lineAddRate),
      lead_rate: round(leadRate),
      close_rate: round(closeRate),
      score,
      test_days: testDays,
      sample_threshold_met: sampleThresholdMet,
      spam_flag_rate: round(spamFlagRate),
      lead_rate_retention_vs_champion: null,
      close_rate_retention_vs_champion: null,
      quality_regression_reasons: [],
      no_quality_regression: true,
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
      if (!row.sample_threshold_met) {
        row.decision = "keep_testing_sample_insufficient";
      } else if (beatsChampion && row.no_quality_regression) {
        row.decision = "eligible_for_human_promotion_review";
      } else if (!row.no_quality_regression) {
        row.decision = "reject_quality_regression";
      } else {
        row.decision = "retire_or_rework_candidate";
      }
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
  const sampleThresholdMet = Boolean(challenger?.sample_threshold_met);
  const championRate = champion?.line_add_rate ?? 0;
  const challengerRate = challenger?.line_add_rate ?? 0;
  const lift = championRate === 0 ? null : round(challengerRate / championRate);
  const challengerWins =
    lift !== null &&
    lift > config.win_rule.challenger_lift_required &&
    sampleThresholdMet &&
    Boolean(challenger?.no_quality_regression);

  return {
    generated_at: new Date().toISOString(),
    test_id: config.ab_plan.test_id,
    status: sampleThresholdMet ? "sample_ready_for_review" : "sample_insufficient_keep_champion",
    week,
    changed_variable: config.current_round.changed_variable,
    one_variable_rule_ok: config.one_variable_per_round.includes(config.current_round.changed_variable),
    traffic_allocation: config.ab_plan.traffic_allocation,
    public_link_change_performed: false,
    production_deploy_performed: false,
    small_traffic_only: true,
    events_observed: events.length,
    champion_asset_id: champion?.asset_id ?? null,
    challenger_asset_id: challenger?.asset_id ?? null,
    champion_line_add_rate: championRate,
    challenger_line_add_rate: challengerRate,
    lift,
    sample_threshold_met: sampleThresholdMet,
    no_quality_regression: Boolean(challenger?.no_quality_regression),
    quality_regression_reasons: challenger?.quality_regression_reasons ?? [],
    lead_rate_retention_vs_champion: challenger?.lead_rate_retention_vs_champion ?? null,
    close_rate_retention_vs_champion: challenger?.close_rate_retention_vs_champion ?? null,
    challenger_win_rule_met: challengerWins,
    decision: challengerWins ? "queue_human_promotion_review" : "do_not_promote_challenger",
  };
}

function buildNextRoundPlan(config, scores, abStatus, retirementQueue, week, now) {
  const variables = config.one_variable_per_round;
  const currentVariable = config.current_round.changed_variable;
  const rotatedVariable = nextVariable(config);
  const challenger = scores.assets.find((asset) => asset.role === "challenger");
  const thresholds = config.sample_thresholds;
  const sampleGaps = {
    visits: Math.max(0, thresholds.min_visits - (challenger?.visits ?? 0)),
    cta_clicks: Math.max(0, thresholds.min_cta_clicks - (challenger?.cta_clicks ?? 0)),
    line_adds: Math.max(0, thresholds.min_line_adds - (challenger?.line_adds ?? 0)),
    test_days: Math.max(0, thresholds.min_test_days - (challenger?.test_days ?? 0)),
  };
  const hasSampleGap = Object.values(sampleGaps).some((value) => value > 0);
  const nextChangedVariable = hasSampleGap || abStatus.challenger_win_rule_met ? currentVariable : rotatedVariable;
  let decision = "continue_current_round_until_sample_threshold";
  let rationale = "Sample is insufficient, so the loop keeps the current one-variable test.";
  let candidateAction = "keep_testing_current_challenger";
  let startNewVariableRound = false;

  if (abStatus.challenger_win_rule_met) {
    decision = "queue_owner_promotion_review_before_next_variable";
    rationale = "The challenger met the win rule, but promotion remains owner-gated.";
    candidateAction = "hold_for_owner_promotion_review";
  } else if (abStatus.sample_threshold_met && !abStatus.no_quality_regression) {
    decision = "reject_challenger_quality_regression_plan_next_variable";
    rationale = "The sample threshold is met but quality regressed, so the next local draft can rotate variables.";
    candidateAction = "retire_from_local_rotation_without_deleting_data";
    startNewVariableRound = true;
  } else if (abStatus.sample_threshold_met) {
    decision = "retire_underperforming_challenger_plan_next_variable";
    rationale = "The sample threshold is met and the challenger did not beat the champion by the configured lift.";
    candidateAction = "retire_or_rework_from_local_rotation_without_deleting_data";
    startNewVariableRound = true;
  }

  const nextRoundId = startNewVariableRound
    ? `next-${week.start}-${nextChangedVariable}`
    : `${config.current_round.round_id}-continue`;

  return {
    generated_at: now.toISOString(),
    week,
    status: startNewVariableRound ? "next_variable_round_prepared_local_only" : "continue_current_round",
    decision,
    rationale,
    current_round: {
      round_id: config.current_round.round_id,
      changed_variable: currentVariable,
      hypothesis: config.current_round.hypothesis,
      asset_id: challenger?.asset_id ?? null,
    },
    next_round: {
      round_id: nextRoundId,
      changed_variable: nextChangedVariable,
      rotation_candidate_after_current: rotatedVariable,
      start_new_variable_round: startNewVariableRound,
      one_variable_rule_ok: variables.includes(nextChangedVariable),
      generated_candidate_performed: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
    },
    sample_gate: {
      sample_threshold_met: Boolean(abStatus.sample_threshold_met),
      preferred_test_days: thresholds.preferred_test_days,
      min_visits: thresholds.min_visits,
      min_cta_clicks: thresholds.min_cta_clicks,
      min_line_adds: thresholds.min_line_adds,
      min_test_days: thresholds.min_test_days,
      observed_visits: challenger?.visits ?? 0,
      observed_cta_clicks: challenger?.cta_clicks ?? 0,
      observed_line_adds: challenger?.line_adds ?? 0,
      observed_test_days: challenger?.test_days ?? 0,
      gaps: sampleGaps,
    },
    win_gate: {
      metric: config.win_rule.metric,
      challenger_lift_required: config.win_rule.challenger_lift_required,
      challenger_win_rule_met: Boolean(abStatus.challenger_win_rule_met),
      no_quality_regression: Boolean(abStatus.no_quality_regression),
      lift: abStatus.lift,
      champion_line_add_rate: abStatus.champion_line_add_rate,
      challenger_line_add_rate: abStatus.challenger_line_add_rate,
    },
    candidate_action: candidateAction,
    retirement_queue_status: retirementQueue.status,
  };
}

function nextVariable(config) {
  const variables = config.one_variable_per_round;
  const currentVariable = config.current_round.changed_variable;
  const currentIndex = variables.indexOf(currentVariable);
  return variables[(currentIndex + 1 + variables.length) % variables.length] ?? variables[0];
}

function summarizeChallenger(challenger) {
  return {
    visits: challenger?.visits ?? 0,
    cta_clicks: challenger?.cta_clicks ?? 0,
    line_adds: challenger?.line_adds ?? 0,
    leads: challenger?.leads ?? 0,
    deals: challenger?.deals ?? 0,
    test_days: challenger?.test_days ?? 0,
    line_add_rate: challenger?.line_add_rate ?? 0,
    lead_rate: challenger?.lead_rate ?? 0,
    close_rate: challenger?.close_rate ?? 0,
    sample_threshold_met: Boolean(challenger?.sample_threshold_met),
    no_quality_regression: Boolean(challenger?.no_quality_regression),
    spam_flag_rate: challenger?.spam_flag_rate ?? 0,
    quality_regression_reasons: challenger?.quality_regression_reasons ?? [],
    lead_rate_retention_vs_champion: challenger?.lead_rate_retention_vs_champion ?? null,
    close_rate_retention_vs_champion: challenger?.close_rate_retention_vs_champion ?? null,
    decision: challenger?.decision ?? null,
    champion_lift: challenger?.champion_lift ?? null,
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

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function renderReport(status) {
  const rows = status.scenarios
    .map((scenario) => `| ${scenario.id} | ${scenario.ok ? "ok" : "fail"} | ${scenario.source_capture_compile.status} | ${scenario.imported_events} | ${scenario.challenger_summary.decision} | ${scenario.ab_status.decision} | ${scenario.next_round_summary.decision} | ${(scenario.challenger_summary.quality_regression_reasons ?? []).join(", ") || "none"} |`)
    .join("\n");

  return `# Real Data Decision Replay Report

BLUF: ${status.ok ? "real_data_decision_replay_ok" : "real_data_decision_replay_failed"}. The replay connects filled source-capture ledgers, owner-preview CSV compilation, aggregate import previews, scoring, A/B decision, and next-round planning without touching real event input or external systems.

Generated: ${status.generated_at}
Mode: ${status.mode}
Scenarios: ${status.scenario_count}
Source capture ledger replay: ${status.source_capture_ledger_replay_executed ? "yes" : "no"}
Source capture compile commands executed: ${status.source_capture_compile_commands_executed ? "yes" : "no"}
Ledger-to-decision replay performed: ${status.ledger_to_decision_replay_performed ? "yes" : "no"}
Local importer preview commands executed: yes
Execution performed: no
Real event write performed: no
data/lp_events.jsonl write performed: no
External effect: no

| scenario | status | source compile | imported events | challenger decision | A/B decision | next-round decision | quality reasons |
|---|---|---|---:|---|---|---|---|
${rows}

## Covered Decisions

- sample_insufficient_replay
- winning_replay_owner_review_only
- underperform_replay_next_variable
- spam_regression_replay
- lead_regression_replay
- close_regression_replay

## Safety Invariants

- Production deploy performed: no
- Public link change performed: no
- GitHub push or PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
`;
}

main().catch(async (error) => {
  await writeJson(STATUS_PATH, {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "failed",
    error: error instanceof Error ? error.message : "unknown_error",
    local_fixture_commands_executed: true,
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
  });
  console.error(error);
  process.exitCode = 1;
});
