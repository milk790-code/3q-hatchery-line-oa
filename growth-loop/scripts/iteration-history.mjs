import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const ARCHIVE_ROOT = path.join(ROOT, "archive");
const JSON_PATH = path.join(ROOT, "iteration_history.json");
const MD_PATH = path.join(ROOT, "iteration_history.md");

const RED_LINE_FLAGS = [
  "public_link_change_performed",
  "production_deploy_performed",
  "github_push_or_pr_performed",
  "formal_post_performed",
  "line_push_performed",
  "customer_data_mutation_performed",
  "payment_action_performed",
  "delete_action_performed",
];

async function main() {
  const generatedAt = new Date();
  const scores = await readJson("growth_scores.json");
  const ab = await readJson("ab_test_status.json");
  const nextRound = await readJson("next_round_plan.json");
  const approval = await readJson("approval_queue.json");
  const blocked = await readJson("prepared_but_blocked.json");
  const dataCollection = await readJson("data_collection_queue.json");
  const dataCollectionStatus = await readJson("data/data_collection_brief_status.json");
  const sourceReadiness = await readJson("data/source_readiness_status.json");
  const sourceCompile = await readJson("data/source_capture_compile_status.json");
  const realDataIntake = await readJson("data/real_data_intake_status.json");
  const launchReadiness = await readJson("launch_readiness.json");
  const archiveStatus = await readOptionalJson("data/week_archive_status.json");
  const archiveHistory = await collectArchiveHistory();

  const assets = scores.assets ?? [];
  const champion = assets.find((asset) => asset.role === "champion") ?? {};
  const challenger = assets.find((asset) => asset.role === "challenger") ?? {};
  const redLineSources = [
    ab,
    nextRound.next_round ?? {},
    launchReadiness,
    launchReadiness.safety_invariants ?? {},
    dataCollectionStatus,
    sourceReadiness,
    sourceCompile,
    realDataIntake,
    archiveStatus ?? {},
  ];
  const redLineSummary = collectRedLineSummary(redLineSources);
  const pendingHuman = (approval.items ?? []).filter((item) => item.status === "pending_human");
  const readyLocal = (approval.items ?? []).filter((item) => item.status === "ready_local_review");

  const sampleGate = {
    ...(nextRound.sample_gate ?? {}),
    sample_threshold_met: Boolean(nextRound.sample_gate?.sample_threshold_met),
  };
  const status = sampleGate.sample_threshold_met
    ? "sample_ready_owner_review_required"
    : "collect_more_data";

  const history = {
    ok: redLineSummary.violations.length === 0,
    generated_at: generatedAt.toISOString(),
    mode: "iteration_history_local_only",
    status,
    operator: "Angelia 3Q Growth Loop Operator",
    week: scores.week,
    cadence: "weekly_7_day_iteration",
    north_star_metric: "per_100_link_clicks_to_line_add_to_lead_to_deal",
    iteration_policy: {
      one_variable_only: true,
      allowed_variables: ["hook", "offer", "visual_claim", "cta_text"],
      current_changed_variable: nextRound.current_round?.changed_variable ?? ab.changed_variable ?? null,
      sample_thresholds: scores.thresholds ?? {},
      preferred_test_days: scores.thresholds?.preferred_test_days ?? 7,
      sample_insufficient_policy: "do_not_replace_champion",
      challenger_win_rule: scores.win_rule ?? {},
    },
    current_round: {
      round_id: nextRound.current_round?.round_id ?? null,
      asset_id: nextRound.current_round?.asset_id ?? ab.challenger_asset_id ?? null,
      changed_variable: nextRound.current_round?.changed_variable ?? ab.changed_variable ?? null,
      hypothesis: nextRound.current_round?.hypothesis ?? null,
      decision: nextRound.decision ?? null,
      candidate_action: nextRound.candidate_action ?? null,
      start_new_variable_round: Boolean(nextRound.next_round?.start_new_variable_round),
      next_changed_variable: nextRound.next_round?.changed_variable ?? null,
      rotation_candidate_after_current: nextRound.next_round?.rotation_candidate_after_current ?? null,
    },
    sample_gate: sampleGate,
    win_gate: nextRound.win_gate ?? {},
    north_star_per_100_clicks: assets.map(per100Clicks),
    asset_summary: {
      champion: assetSummary(champion),
      challenger: assetSummary(challenger),
    },
    data_collection: {
      ok: dataCollectionStatus.ok === true,
      status: dataCollectionStatus.status ?? dataCollection.status ?? null,
      task_count: dataCollectionStatus.task_count ?? dataCollection.task_count ?? 0,
      stage_count: dataCollectionStatus.stage_count ?? dataCollection.stage_count ?? 0,
      importable_link_count: dataCollectionStatus.importable_link_count ?? dataCollection.importable_link_count ?? 0,
      gated_link_count: dataCollectionStatus.gated_link_count ?? dataCollection.gated_link_count ?? 0,
      filled_ledger_exists: Boolean(dataCollectionStatus.filled_ledger_exists),
      sample_threshold_met: Boolean(dataCollectionStatus.sample_threshold_met),
      missing_stage_count: dataCollectionStatus.missing_stage_count ?? 0,
      stage_priorities: (dataCollection.stage_priorities ?? []).map((stage) => ({
        event_type: stage.event_type,
        priority: stage.priority,
        sample_gate_key: stage.sample_gate_key,
        sample_gap: stage.sample_gap,
        target_live_file: stage.target_live_file,
      })),
      real_events_unchanged: dataCollectionStatus.real_events_unchanged === true,
      live_input_files_created: dataCollectionStatus.live_input_files_created === true,
      data_lp_events_write_performed: dataCollectionStatus.data_lp_events_write_performed === true,
    },
    owner_gate_summary: {
      pending_human_count: pendingHuman.length,
      ready_local_review_count: readyLocal.length,
      pending_human_ids: pendingHuman.map((item) => item.id),
      ready_local_review_ids: readyLocal.map((item) => item.id),
      prepared_but_blocked_count: (blocked.items ?? []).length,
      prepared_but_blocked_actions: (blocked.items ?? []).map((item) => item.action),
    },
    source_status: {
      readiness: {
        ok: sourceReadiness.ok === true,
        status: sourceReadiness.status ?? null,
        missing_stage_count: sourceReadiness.missing_stage_count ?? 0,
        ready_for_public_iteration_decision: sourceReadiness.ready_for_public_iteration_decision === true,
        sample_threshold_met: sourceReadiness.sample_progress?.sample_threshold_met === true,
      },
      compile: {
        ok: sourceCompile.ok === true,
        status: sourceCompile.status ?? null,
        filled_rows: sourceCompile.filled_rows ?? 0,
        issue_count: sourceCompile.issue_count ?? 0,
        live_input_files_created: sourceCompile.live_input_files_created === true,
        data_lp_events_write_performed: sourceCompile.data_lp_events_write_performed === true,
      },
      real_data_intake: {
        ok: realDataIntake.ok === true,
        status: realDataIntake.status ?? null,
        ready_apply_count: realDataIntake.ready_apply_count ?? 0,
        missing_input_count: realDataIntake.missing_input_count ?? 0,
        data_lp_events_write_performed: realDataIntake.data_lp_events_write_performed === true,
      },
    },
    archive_summary: {
      current_archive_status_ok: archiveStatus?.ok === true,
      current_archive_dir: archiveStatus?.archive_dir ?? null,
      current_manifest_path: archiveStatus?.manifest_path ?? null,
      archives_scanned: archiveHistory.length,
      latest_archives: archiveHistory.slice(0, 10),
    },
    next_safe_actions: buildNextSafeActions({
      status,
      sampleGate,
      dataCollectionStatus,
      sourceCompile,
      realDataIntake,
      pendingHuman,
      readyLocal,
    }),
    red_line_summary: redLineSummary,
    paths: {
      json: JSON_PATH,
      markdown: MD_PATH,
      weekly_report: path.join(ROOT, "weekly_report.md"),
      data_collection_brief: path.join(ROOT, "data_collection_brief.md"),
      data_collection_queue: path.join(ROOT, "data_collection_queue.json"),
      approval_queue: path.join(ROOT, "approval_queue.json"),
      prepared_but_blocked: path.join(ROOT, "prepared_but_blocked.json"),
    },
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

  await writeJson(JSON_PATH, history);
  await writeFile(MD_PATH, renderMarkdown(history));

  if (!history.ok) {
    throw new Error(`Iteration history red-line flags detected: ${history.red_line_summary.violations.join(", ")}`);
  }

  console.log(JSON.stringify({ ok: true, output_json: JSON_PATH, output_md: MD_PATH, archives_scanned: archiveHistory.length }, null, 2));
}

async function collectArchiveHistory() {
  const rows = [];
  const weekDirs = await readDirOptional(ARCHIVE_ROOT);

  for (const weekDirent of weekDirs) {
    if (!weekDirent.isDirectory()) {
      continue;
    }
    const weekDir = path.join(ARCHIVE_ROOT, weekDirent.name);
    const runDirs = await readDirOptional(weekDir);
    for (const runDirent of runDirs) {
      if (!runDirent.isDirectory()) {
        continue;
      }
      const runDir = path.join(weekDir, runDirent.name);
      const manifest = await readOptionalJsonPath(path.join(runDir, "manifest.json"));
      if (!manifest) {
        continue;
      }
      const fileSources = new Set((manifest.files ?? []).map((file) => file.source));
      const archivedScores = await readArchivedJson(manifest, "growth_scores.json");
      const archivedNextRound = await readArchivedJson(manifest, "next_round_plan.json");
      const archivedDataCollection = await readArchivedJson(manifest, "data/data_collection_brief_status.json");
      rows.push({
        generated_at: manifest.generated_at ?? null,
        week_start: manifest.week_start ?? weekDirent.name,
        week_end: manifest.week_end ?? null,
        archive_dir: manifest.archive_dir ?? runDir,
        files_archived: manifest.files_archived ?? (manifest.files ?? []).length,
        expected_files: manifest.expected_files ?? null,
        missing_files_count: (manifest.missing_files ?? []).length,
        immutable_snapshot: manifest.immutable_snapshot === true,
        has_growth_scores: fileSources.has("growth_scores.json"),
        has_weekly_report: fileSources.has("weekly_report.md"),
        has_data_collection_brief: fileSources.has("data_collection_brief.md"),
        has_iteration_history: fileSources.has("iteration_history.json"),
        changed_variable: archivedNextRound?.current_round?.changed_variable ?? archivedScores?.assets?.find((asset) => asset.role === "challenger")?.changed_variable ?? null,
        decision: archivedNextRound?.decision ?? null,
        sample_threshold_met: archivedNextRound?.sample_gate?.sample_threshold_met ?? null,
        observed_visits: archivedNextRound?.sample_gate?.observed_visits ?? null,
        observed_cta_clicks: archivedNextRound?.sample_gate?.observed_cta_clicks ?? null,
        observed_line_adds: archivedNextRound?.sample_gate?.observed_line_adds ?? null,
        data_collection_status: archivedDataCollection?.status ?? null,
        external_effect: manifest.external_effect === true,
      });
    }
  }

  return rows.sort((a, b) => String(b.generated_at ?? "").localeCompare(String(a.generated_at ?? "")));
}

async function readArchivedJson(manifest, source) {
  const file = (manifest.files ?? []).find((item) => item.source === source);
  if (!file?.archive_path) {
    return null;
  }
  return readOptionalJsonPath(file.archive_path);
}

function buildNextSafeActions(context) {
  const actions = [];

  if (!context.sampleGate.sample_threshold_met) {
    actions.push({
      id: "continue_current_round_until_sample_gate",
      type: "data_collection",
      owner_gate: false,
      action: "Keep the current cta_text challenger and collect aggregate counts until visits, CTA clicks, LINE adds, and test days meet thresholds.",
      external_effect: false,
    });
  }

  if (context.dataCollectionStatus.filled_ledger_exists !== true) {
    actions.push({
      id: "fill_source_capture_ledger_copy",
      type: "owner_review",
      owner_gate: true,
      action: "Copy the fill template to data/source_capture/source_capture_ledger.filled.csv and fill aggregate counts only; do not include customer identifiers or chat text.",
      external_effect: false,
    });
  }

  if (context.sourceCompile.status === "owner_preview_ready" && (context.realDataIntake.ready_apply_count ?? 0) > 0) {
    actions.push({
      id: "review_preview_before_local_apply",
      type: "local_apply_review",
      owner_gate: true,
      action: "Review owner-preview CSVs and only then run the existing owner-gated local apply commands with --confirm-real-data.",
      external_effect: false,
    });
  }

  if (context.pendingHuman.length > 0) {
    actions.push({
      id: "review_external_redline_queue",
      type: "approval_queue",
      owner_gate: true,
      action: "Review pending_human approval items, but do not auto-run remote D1, production Worker deploy, public link changes, GitHub push/PR, LINE, payment, customer-data, or delete actions.",
      external_effect: false,
    });
  }

  actions.push({
    id: "rerun_weekly_local_after_counts",
    type: "verification",
    owner_gate: false,
    action: "After aggregate counts are locally prepared and reviewed, rerun npm run weekly:local or npm run verify to refresh scores, report, queue, archive, and console.",
    external_effect: false,
  });

  return actions;
}

function collectRedLineSummary(sources) {
  const flags = Object.fromEntries(RED_LINE_FLAGS.map((flag) => [flag, false]));

  for (const source of sources) {
    for (const flag of RED_LINE_FLAGS) {
      if (source?.[flag] === true) {
        flags[flag] = true;
      }
    }
  }

  return {
    flags,
    violations: Object.entries(flags).filter(([, value]) => value).map(([flag]) => flag),
    external_effect: false,
  };
}

function per100Clicks(asset = {}) {
  const clicks = Number(asset.link_clicks ?? 0);
  return {
    asset_id: asset.asset_id ?? null,
    role: asset.role ?? null,
    changed_variable: asset.changed_variable ?? null,
    link_clicks: clicks,
    visits: Number(asset.visits ?? 0),
    cta_clicks: Number(asset.cta_clicks ?? 0),
    line_adds: Number(asset.line_adds ?? 0),
    leads: Number(asset.leads ?? 0),
    deals: Number(asset.deals ?? 0),
    line_adds_per_100_clicks: ratePer100(asset.line_adds, clicks),
    leads_per_100_clicks: ratePer100(asset.leads, clicks),
    deals_per_100_clicks: ratePer100(asset.deals, clicks),
    line_add_rate: asset.line_add_rate ?? 0,
    sample_threshold_met: asset.sample_threshold_met === true,
    no_quality_regression: asset.no_quality_regression === true,
    decision: asset.decision ?? null,
  };
}

function assetSummary(asset = {}) {
  return {
    asset_id: asset.asset_id ?? null,
    role: asset.role ?? null,
    status: asset.status ?? null,
    changed_variable: asset.changed_variable ?? null,
    link_clicks: Number(asset.link_clicks ?? 0),
    visits: Number(asset.visits ?? 0),
    cta_clicks: Number(asset.cta_clicks ?? 0),
    line_adds: Number(asset.line_adds ?? 0),
    leads: Number(asset.leads ?? 0),
    deals: Number(asset.deals ?? 0),
    test_days: Number(asset.test_days ?? 0),
    line_add_rate: asset.line_add_rate ?? 0,
    sample_threshold_met: asset.sample_threshold_met === true,
    no_quality_regression: asset.no_quality_regression === true,
    quality_regression_reasons: asset.quality_regression_reasons ?? [],
    decision: asset.decision ?? null,
  };
}

function ratePer100(numerator, denominator) {
  const count = Number(numerator ?? 0);
  const base = Number(denominator ?? 0);
  if (!Number.isFinite(count) || !Number.isFinite(base) || base <= 0) {
    return null;
  }
  return Number(((count / base) * 100).toFixed(2));
}

function renderMarkdown(history) {
  const metrics = history.north_star_per_100_clicks
    .map((item) => `| ${item.asset_id ?? "n/a"} | ${item.role ?? "n/a"} | ${item.link_clicks} | ${displayNumber(item.line_adds_per_100_clicks)} | ${displayNumber(item.leads_per_100_clicks)} | ${displayNumber(item.deals_per_100_clicks)} | ${item.decision ?? "n/a"} |`)
    .join("\n");
  const archiveRows = history.archive_summary.latest_archives
    .map((item) => `| ${item.generated_at ?? "n/a"} | ${item.week_start ?? "n/a"} | ${item.changed_variable ?? "n/a"} | ${item.decision ?? "n/a"} | ${item.sample_threshold_met === true ? "yes" : "no"} | ${item.has_iteration_history ? "yes" : "no"} |`)
    .join("\n");
  const actionRows = history.next_safe_actions
    .map((item) => `| ${item.id} | ${item.owner_gate ? "yes" : "no"} | ${item.action} |`)
    .join("\n");

  return `# 3Q Growth Loop Iteration History

BLUF: ${history.ok ? "iteration_history_ok" : "iteration_history_attention"}. This is a local-only 7-day iteration history for the acquisition loop. It reads local artifacts and archive manifests, then records the current decision, sample gaps, north-star metrics, approval gates, and next safe actions.

Generated: ${history.generated_at}
Mode: ${history.mode}
Status: ${history.status}
External effect: no

## Current Iteration

- Week: ${history.week?.start ?? "n/a"} to ${history.week?.end ?? "n/a"}
- Round: ${history.current_round.round_id ?? "n/a"}
- Changed variable: ${history.current_round.changed_variable ?? "n/a"}
- Decision: ${history.current_round.decision ?? "n/a"}
- Candidate action: ${history.current_round.candidate_action ?? "n/a"}
- Start new variable round: ${history.current_round.start_new_variable_round ? "yes" : "no"}
- Sample threshold met: ${history.sample_gate.sample_threshold_met ? "yes" : "no"}
- Sample gaps: visits ${history.sample_gate.gaps?.visits ?? 0}, CTA clicks ${history.sample_gate.gaps?.cta_clicks ?? 0}, LINE adds ${history.sample_gate.gaps?.line_adds ?? 0}, days ${history.sample_gate.gaps?.test_days ?? 0}

## North Star Per 100 Link Clicks

| asset | role | clicks | LINE adds / 100 | leads / 100 | deals / 100 | decision |
|---|---|---:|---:|---:|---:|---|
${metrics}

## Data Collection

- Status: ${history.data_collection.status ?? "n/a"}
- Tasks: ${history.data_collection.task_count}
- Stages: ${history.data_collection.stage_count}
- Filled ledger exists: ${history.data_collection.filled_ledger_exists ? "yes" : "no"}
- Missing stages: ${history.data_collection.missing_stage_count}
- data/lp_events.jsonl write performed: ${history.data_collection.data_lp_events_write_performed ? "yes" : "no"}

## Archive History

- Archives scanned: ${history.archive_summary.archives_scanned}
- Current archive status ok: ${history.archive_summary.current_archive_status_ok ? "yes" : "no"}
- Current archive dir: ${history.archive_summary.current_archive_dir ?? "n/a"}

| generated | week | variable | decision | sample met | archived history |
|---|---|---|---|---|---|
${archiveRows || "| n/a | n/a | n/a | n/a | no | no |"}

## Next Safe Actions

| action | owner gate | summary |
|---|---|---|
${actionRows}

## Human Gates

- Pending human approvals: ${history.owner_gate_summary.pending_human_count}
- Ready local reviews: ${history.owner_gate_summary.ready_local_review_count}
- PreparedButBlocked items: ${history.owner_gate_summary.prepared_but_blocked_count}

## Red Lines

- Production deploy performed: no
- Public link change performed: no
- Formal post performed: no
- GitHub push or PR performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
`;
}

function displayNumber(value) {
  return value === null || value === undefined ? "n/a" : String(value);
}

async function readJson(relativePath) {
  const raw = await readFile(path.join(ROOT, relativePath), "utf8");
  return JSON.parse(raw);
}

async function readOptionalJson(relativePath) {
  return readOptionalJsonPath(path.join(ROOT, relativePath));
}

async function readOptionalJsonPath(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function readDirOptional(dirPath) {
  try {
    return await readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main();
