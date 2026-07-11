import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "config", "growth-loop.config.json");
const EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");
const STATUS_PATH = path.join(ROOT, "data", "source_readiness_status.json");
const REPORT_PATH = path.join(ROOT, "source_readiness.md");
const D1_SYNC_STATUS_PATH = path.join(ROOT, "data", "d1_sync_status.json");
const EVENT_INPUT_QUALITY_STATUS_PATH = path.join(ROOT, "data", "event_input_quality_status.json");
const INPUT_PACK_STATUS_PATH = path.join(ROOT, "data", "real_data_input_pack_status.json");
const INTAKE_STATUS_PATH = path.join(ROOT, "data", "real_data_intake_status.json");
const FUNNEL_LIVE_INPUT_PATH = path.join(ROOT, "data", "funnel_aggregates.csv");
const MANUAL_LIVE_INPUT_PATH = path.join(ROOT, "data", "manual_conversions.csv");

const STAGES = [
  {
    id: "link_click",
    label: "Post link clicks",
    preferred_sources: ["remote_d1_lp_events", "full_funnel_aggregate_csv"],
    live_input_path: FUNNEL_LIVE_INPUT_PATH,
  },
  {
    id: "page_view",
    label: "Landing page views",
    preferred_sources: ["remote_d1_lp_events", "full_funnel_aggregate_csv"],
    live_input_path: FUNNEL_LIVE_INPUT_PATH,
  },
  {
    id: "cta_click",
    label: "Landing page CTA clicks",
    preferred_sources: ["remote_d1_lp_events", "full_funnel_aggregate_csv"],
    live_input_path: FUNNEL_LIVE_INPUT_PATH,
  },
  {
    id: "line_add",
    label: "LINE inbound adds",
    preferred_sources: ["remote_d1_lp_events", "manual_conversion_csv", "full_funnel_aggregate_csv"],
    live_input_path: MANUAL_LIVE_INPUT_PATH,
  },
  {
    id: "lead_submit",
    label: "Lead submissions",
    preferred_sources: ["manual_conversion_csv", "remote_d1_lp_events", "full_funnel_aggregate_csv"],
    live_input_path: MANUAL_LIVE_INPUT_PATH,
  },
  {
    id: "deal",
    label: "Closed deals",
    preferred_sources: ["manual_conversion_csv", "remote_d1_lp_events", "full_funnel_aggregate_csv"],
    live_input_path: MANUAL_LIVE_INPUT_PATH,
  },
  {
    id: "quality_flag",
    label: "Quality / spam flags",
    preferred_sources: ["manual_conversion_csv", "remote_d1_lp_events", "full_funnel_aggregate_csv"],
    live_input_path: MANUAL_LIVE_INPUT_PATH,
  },
];

async function main() {
  const generatedAt = new Date();
  const config = await readJson(CONFIG_PATH);
  const events = await readJsonl(EVENTS_PATH);
  const d1Sync = await readOptionalJson(D1_SYNC_STATUS_PATH, { ok: false, scope: "not_run", rows_exported: 0 });
  const eventQuality = await readOptionalJson(EVENT_INPUT_QUALITY_STATUS_PATH, { ok: false, scoring_allowed: false, issues: [] });
  const inputPack = await readOptionalJson(INPUT_PACK_STATUS_PATH, { ok: false, templates: [] });
  const intake = await readOptionalJson(INTAKE_STATUS_PATH, { ok: false, status: "not_run", ready_apply_count: 0, missing_input_count: 2 });
  const funnelLiveExists = await exists(FUNNEL_LIVE_INPUT_PATH);
  const manualLiveExists = await exists(MANUAL_LIVE_INPUT_PATH);
  const eventCounts = countBy(events, "event_type");
  const assetCounts = countBy(events, "asset_id");
  const thresholds = config.sample_thresholds ?? {};
  const champion = (config.assets ?? []).find((asset) => asset.role === "champion");
  const championUrlReady = Boolean(champion?.landing_url)
    && champion.landing_url !== "PENDING_CURRENT_MAIN_LINK"
    && !String(champion.landing_url).includes("replace-with-current");
  const stageStatuses = STAGES.map((stage) => buildStageStatus(stage, eventCounts, funnelLiveExists, manualLiveExists));
  const missingStages = stageStatuses.filter((stage) => !stage.ready_for_decision);
  const sampleProgress = buildSampleProgress(eventCounts, thresholds, events);

  const status = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "source_readiness_monitor",
    status: missingStages.length > 0 ? "waiting_for_real_data" : "real_data_sources_present",
    week: currentTaipeiWeek(generatedAt),
    status_path: STATUS_PATH,
    report_path: REPORT_PATH,
    real_events_path: EVENTS_PATH,
    real_event_rows: events.length,
    event_counts: eventCounts,
    asset_counts: assetCounts,
    sample_progress: sampleProgress,
    scoring_allowed: Boolean(eventQuality.scoring_allowed) && (eventQuality.issues ?? []).length === 0,
    ready_for_public_iteration_decision: sampleProgress.sample_threshold_met && missingStages.length === 0,
    champion_url_ready: championUrlReady,
    source_inputs: {
      d1_sync: {
        ok: Boolean(d1Sync.ok),
        scope: d1Sync.scope ?? "unknown",
        rows_exported: d1Sync.rows_exported ?? 0,
        output_path: d1Sync.output_path ?? null,
      },
      event_quality: {
        ok: Boolean(eventQuality.ok),
        scoring_allowed: Boolean(eventQuality.scoring_allowed),
        issue_count: (eventQuality.issues ?? []).length,
        data_lp_events_write_performed: Boolean(eventQuality.data_lp_events_write_performed),
      },
      input_pack: {
        ok: Boolean(inputPack.ok),
        status: inputPack.status ?? "not_run",
        template_count: (inputPack.templates ?? []).length,
        live_input_files_created: Boolean(inputPack.live_input_files_created),
        data_lp_events_write_performed: Boolean(inputPack.data_lp_events_write_performed),
      },
      intake: {
        ok: Boolean(intake.ok),
        status: intake.status ?? "not_run",
        ready_apply_count: intake.ready_apply_count ?? 0,
        missing_input_count: intake.missing_input_count ?? 0,
        data_lp_events_write_performed: Boolean(intake.data_lp_events_write_performed),
      },
      live_inputs: [
        { source_id: "funnel_aggregates", path: FUNNEL_LIVE_INPUT_PATH, exists: funnelLiveExists },
        { source_id: "manual_conversions", path: MANUAL_LIVE_INPUT_PATH, exists: manualLiveExists },
      ],
    },
    stages: stageStatuses,
    missing_stage_count: missingStages.length,
    missing_stages: missingStages.map((stage) => stage.id),
    next_local_actions: [
      {
        id: "fill_real_data_input_pack",
        command: "npm run real-data:pack",
        status: inputPack.ok ? "ready" : "not_ready",
        note: "Use the generated fill templates to enter aggregate counts only.",
      },
      {
        id: "copy_reviewed_csvs",
        command: "cp data/real_data_input_pack/funnel_aggregates.fill-template.csv data/funnel_aggregates.csv && cp data/real_data_input_pack/manual_conversions.fill-template.csv data/manual_conversions.csv",
        status: "owner_review_required",
        note: "Run only after reviewed aggregate counts are filled. Do not paste customer-level data.",
      },
      {
        id: "preview_real_data",
        command: "npm run real-data:intake",
        status: "ready_after_live_csvs_exist",
        note: "Preview first; apply commands remain owner-gated.",
      },
    ],
    owner_review_required: true,
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

function buildStageStatus(stage, eventCounts, funnelLiveExists, manualLiveExists) {
  const currentEvents = eventCounts[stage.id] ?? 0;
  const liveInputExists = stage.live_input_path === FUNNEL_LIVE_INPUT_PATH ? funnelLiveExists : manualLiveExists;
  const readyForDecision = currentEvents > 0;
  return {
    id: stage.id,
    label: stage.label,
    current_real_events: currentEvents,
    preferred_sources: stage.preferred_sources,
    live_input_path: stage.live_input_path,
    live_input_exists: liveInputExists,
    ready_for_decision: readyForDecision,
    status: readyForDecision ? "real_events_present" : liveInputExists ? "live_input_ready_for_preview" : "waiting_for_aggregate_input",
    next_action: readyForDecision
      ? "No local action needed for this stage."
      : liveInputExists
        ? "Run npm run real-data:intake and review the preview."
        : "Fill the matching template in data/real_data_input_pack/ with aggregate counts.",
    data_lp_events_write_performed: false,
    external_effect: false,
  };
}

function buildSampleProgress(eventCounts, thresholds, events) {
  const visits = eventCounts.page_view ?? 0;
  const ctaClicks = eventCounts.cta_click ?? 0;
  const lineAdds = eventCounts.line_add ?? 0;
  const testDays = countTestDays(events);
  return {
    min_visits: thresholds.min_visits ?? 100,
    min_cta_clicks: thresholds.min_cta_clicks ?? 20,
    min_line_adds: thresholds.min_line_adds ?? 5,
    min_test_days: thresholds.min_test_days ?? 3,
    preferred_test_days: thresholds.preferred_test_days ?? 7,
    current_visits: visits,
    current_cta_clicks: ctaClicks,
    current_line_adds: lineAdds,
    current_test_days: testDays,
    gaps: {
      visits: Math.max(0, (thresholds.min_visits ?? 100) - visits),
      cta_clicks: Math.max(0, (thresholds.min_cta_clicks ?? 20) - ctaClicks),
      line_adds: Math.max(0, (thresholds.min_line_adds ?? 5) - lineAdds),
      test_days: Math.max(0, (thresholds.min_test_days ?? 3) - testDays),
    },
    sample_threshold_met:
      visits >= (thresholds.min_visits ?? 100)
      && ctaClicks >= (thresholds.min_cta_clicks ?? 20)
      && lineAdds >= (thresholds.min_line_adds ?? 5)
      && testDays >= (thresholds.min_test_days ?? 3),
  };
}

function renderMarkdown(status) {
  const stageRows = status.stages
    .map((stage) => `| ${stage.id} | ${stage.status} | ${stage.current_real_events} | ${relative(stage.live_input_path)} | ${stage.live_input_exists ? "yes" : "no"} | ${stage.next_action} |`)
    .join("\n");
  const actionRows = status.next_local_actions
    .map((action) => `| ${action.id} | ${action.status} | \`${action.command}\` | ${action.note} |`)
    .join("\n");

  return `# 3Q Growth Loop Source Readiness

BLUF: ${status.status === "real_data_sources_present" ? "All funnel stages have real-event source evidence, but public decisions still require sample and quality gates." : "The local engine is ready, but real source data is still missing for at least one funnel stage. Keep the champion unchanged."}

Generated: ${status.generated_at}
Mode: ${status.mode}
Status: ${status.status}
Week: ${status.week.start} to ${status.week.end}
Real event rows: ${status.real_event_rows}
Scoring allowed: ${status.scoring_allowed ? "yes" : "no"}
Ready for public iteration decision: ${status.ready_for_public_iteration_decision ? "yes" : "no"}
Champion URL ready: ${status.champion_url_ready ? "yes" : "no"}
External effect: no
data/lp_events.jsonl write performed: no

## Sample Progress

- Visits: ${status.sample_progress.current_visits}/${status.sample_progress.min_visits}
- CTA clicks: ${status.sample_progress.current_cta_clicks}/${status.sample_progress.min_cta_clicks}
- LINE adds: ${status.sample_progress.current_line_adds}/${status.sample_progress.min_line_adds}
- Test days: ${status.sample_progress.current_test_days}/${status.sample_progress.min_test_days} preferred ${status.sample_progress.preferred_test_days}
- Sample threshold met: ${status.sample_progress.sample_threshold_met ? "yes" : "no"}

## Funnel Stage Sources

| stage | status | real events | live input | live input exists | next action |
|---|---|---:|---|---|---|
${stageRows}

## Next Local Actions

| action | status | command | note |
|---|---|---|---|
${actionRows}

## Rules

- This monitor is read-only.
- It does not create live input CSVs, append data/lp_events.jsonl, publish, deploy, push LINE, mutate customer data, touch payment, or delete anything.
- Public decisions still require the sample threshold, no quality regression, owner-approved champion URL, and owner-approved public A/B route.
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

async function readJsonl(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
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

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] ?? "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function countTestDays(events) {
  const days = new Set();
  for (const event of events) {
    if (!event.occurred_at) continue;
    const date = new Date(event.occurred_at);
    if (Number.isNaN(date.valueOf())) continue;
    days.add(date.toISOString().slice(0, 10));
  }
  return days.size;
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

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function relative(filePath) {
  return path.relative(ROOT, filePath);
}

main();
