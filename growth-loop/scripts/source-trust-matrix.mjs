import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const JSON_PATH = path.join(ROOT, "source_trust_matrix.json");
const REPORT_PATH = path.join(ROOT, "source_trust_matrix.md");
const STATUS_PATH = path.join(ROOT, "data", "source_trust_matrix_status.json");
const REAL_EVENTS_PATH = path.join(ROOT, "data", "lp_events.jsonl");

async function main() {
  const generatedAt = new Date();
  const [
    d1Sync,
    eventQuality,
    funnelAggregate,
    manualConversion,
    sourceReadiness,
    sourceCapture,
    sourceCompile,
    realDataIntake,
    dataProgress,
    nextP0Intake,
    ownerDataPreflight,
    ownerSampleGate,
    lineOaAccountMetricsObservation,
  ] = await Promise.all([
    readJson("data/d1_sync_status.json", { ok: false, scope: "not_run", rows_exported: 0 }),
    readJson("data/event_input_quality_status.json", { ok: false, rows_scanned: 0, scoring_allowed: false, issues: [] }),
    readJson("data/funnel_aggregate_status.json", { ok: false, mode: "not_run", events_written: 0 }),
    readJson("data/manual_conversion_status.json", { ok: false, mode: "not_run", events_written: 0 }),
    readJson("data/source_readiness_status.json", { ok: false, status: "not_run", ready_for_public_iteration_decision: false }),
    readJson("data/source_capture_status.json", { ok: false, status: "not_run", ledger_rows: 0 }),
    readJson("data/source_capture_compile_status.json", { ok: false, status: "not_run", filled_rows: 0 }),
    readJson("data/real_data_intake_status.json", { ok: false, status: "not_run", real_event_rows: 0 }),
    readJson("data/data_collection_progress_status.json", { ok: false, status: "not_run", p0_pending_count: 0, sample_threshold_met: false }),
    readJson("data/next_p0_owner_intake_status.json", { ok: false, status: "not_run", intake_ready: false }),
    readJson("data/owner_data_preflight_status.json", { ok: false, status: "not_run", sample_threshold_met: false }),
    readJson("data/owner_sample_gate_status.json", { ok: false, status: "not_run", sample_threshold_met: false }),
    readJson("data/line_oa_account_metrics_observation.json", {
      ok: false,
      scope: "not_observed",
      scoring_eligible: false,
      sample_gate_eligible: false,
    }),
  ]);
  const realEventRows = await countLines(REAL_EVENTS_PATH);
  const eventIssues = Array.isArray(eventQuality.issues) ? eventQuality.issues : [];
  const ownerPreflightRows = Number(ownerDataPreflight.selected_source_row_count ?? ownerDataPreflight.preview_row_count ?? 0);
  const ownerPreflightIssueCount = Number(ownerDataPreflight.issue_count ?? 0);
  const ownerPreflightSampleGateInputAllowed = ownerDataPreflight.ok === true
    && ownerPreflightRows > 0
    && ownerPreflightIssueCount === 0
    && ownerDataPreflight.data_lp_events_write_performed !== true
    && ownerDataPreflight.external_effect !== true;

  const sources = [
    sourceRow({
      id: "real_lp_events_jsonl",
      label: "data/lp_events.jsonl",
      status: realEventRows > 0 ? "real_events_present" : "empty_clean_input",
      rows: realEventRows,
      canScore: realEventRows > 0 && eventQuality.ok === true && eventQuality.scoring_allowed === true && eventIssues.length === 0,
      canSampleGate: realEventRows > 0 && eventQuality.scoring_allowed === true,
      trustLevel: eventQuality.ok === true && eventIssues.length === 0 ? "trusted_schema_empty_or_ready" : "blocked_quality_gate",
      evidence: `event_quality=${eventQuality.ok ? "ok" : "blocked"}; rows=${realEventRows}; issues=${eventIssues.length}`,
      nextAction: realEventRows > 0 ? "Use weekly scoring after event quality passes." : "Collect owner-reviewed aggregate counts or approved remote D1 export first.",
    }),
    sourceRow({
      id: "local_d1_export",
      label: "data/lp_events.d1-local.jsonl",
      status: d1Sync.scope === "local" ? "review_only_local_smoke_export" : d1Sync.scope ?? "not_run",
      rows: d1Sync.rows_exported ?? 0,
      canScore: Boolean(d1Sync.scoring_input_allowed),
      canSampleGate: Boolean(d1Sync.scoring_input_allowed),
      trustLevel: d1Sync.scoring_input_allowed ? "owner_approved_remote_export" : "local_review_only",
      evidence: `scope=${d1Sync.scope ?? "unknown"}; smoke_rows=${d1Sync.synthetic_or_smoke_row_count ?? 0}; real_candidates=${d1Sync.real_event_candidate_rows ?? 0}`,
      nextAction: d1Sync.scoring_input_allowed ? "Run event quality before scoring." : "Do not score local D1 smoke rows; keep as Worker smoke evidence only.",
    }),
    sourceRow({
      id: "funnel_aggregate_preview",
      label: "data/funnel_aggregates.preview.jsonl",
      status: funnelAggregate.mode ?? "not_run",
      rows: funnelAggregate.events_written ?? 0,
      canScore: false,
      canSampleGate: false,
      trustLevel: funnelAggregate.ok ? "preview_only" : "not_ready",
      evidence: `apply_performed=${Boolean(funnelAggregate.apply_performed)}; data_write=${Boolean(funnelAggregate.data_lp_events_write_performed)}`,
      nextAction: "Owner review is required before any local apply command can append real events.",
    }),
    sourceRow({
      id: "manual_conversion_preview",
      label: "data/manual_conversions.preview.jsonl",
      status: manualConversion.mode ?? "not_run",
      rows: manualConversion.events_written ?? 0,
      canScore: false,
      canSampleGate: false,
      trustLevel: manualConversion.ok ? "preview_only" : "not_ready",
      evidence: `apply_performed=${Boolean(manualConversion.apply_performed)}; data_write=${Boolean(manualConversion.data_lp_events_write_performed)}`,
      nextAction: "Keep LINE add / lead / deal aggregates preview-only until owner review.",
    }),
    sourceRow({
      id: "line_oa_account_metrics_observation",
      label: "data/line_oa_account_metrics_observation.json",
      status: lineOaAccountMetricsObservation.scope ?? "not_observed",
      rows: 0,
      canScore: false,
      canSampleGate: false,
      trustLevel: lineOaAccountMetricsObservation.ok === true
        ? "diagnostic_account_total_only"
        : "diagnostic_not_observed",
      evidence: lineOaAccountMetricsObservation.ok === true
        ? `period=${lineOaAccountMetricsObservation.period?.start ?? "unknown"}..${lineOaAccountMetricsObservation.period?.end ?? "unknown"}; added_friend_change=${lineOaAccountMetricsObservation.metrics?.added_friends?.change ?? "unknown"}; attributable_rows=0`
        : "No sanitized LINE OA account-level observation is available.",
      nextAction: "Do not allocate account-wide totals to Growth Loop variants; require tracking-context aggregates for scoring.",
    }),
    sourceRow({
      id: "source_capture_owner_preview",
      label: "data/source_capture/compiled/*.owner-preview.csv",
      status: sourceCompile.status ?? "not_run",
      rows: sourceCompile.filled_rows ?? 0,
      canScore: false,
      canSampleGate: false,
      trustLevel: sourceCompile.status === "owner_preview_ready" ? "owner_preview_ready" : "waiting_for_filled_counts",
      evidence: `source_capture=${sourceCapture.status ?? "not_run"}; ledger_rows=${sourceCapture.ledger_rows ?? 0}; filled_rows=${sourceCompile.filled_rows ?? 0}`,
      nextAction: "Use real-data intake preview next; do not create live CSVs from this matrix.",
    }),
    sourceRow({
      id: "next_p0_owner_intake",
      label: "data/next_p0_owner_intake/*.owner-preview.csv",
      status: nextP0Intake.status ?? "not_run",
      rows: nextP0Intake.preview_row_count ?? 0,
      canScore: false,
      canSampleGate: false,
      trustLevel: nextP0Intake.intake_ready ? "focused_owner_preview_ready" : "waiting_for_owner_download",
      evidence: `p0_pending=${dataProgress.p0_pending_count ?? 0}; sample_threshold=${Boolean(dataProgress.sample_threshold_met)}`,
      nextAction: "Finish focused P0 counts, then run the post-fill local check.",
    }),
    sourceRow({
      id: "owner_data_preflight",
      label: "owner preview scoring preflight",
      status: ownerDataPreflight.status ?? "not_run",
      rows: ownerPreflightRows,
      canScore: false,
      canSampleGate: ownerPreflightSampleGateInputAllowed,
      trustLevel: ownerPreflightSampleGateInputAllowed
        ? ownerDataPreflight.sample_threshold_met ? "preview_sample_threshold_met" : "trusted_preview_below_threshold"
        : "preview_sample_gate_not_ready",
      evidence: `owner_sample_gate=${ownerSampleGate.status ?? "not_run"}; preflight=${ownerDataPreflight.status ?? "not_run"}; rows=${ownerPreflightRows}; issues=${ownerPreflightIssueCount}; sample_threshold=${Boolean(ownerDataPreflight.sample_threshold_met)}`,
      nextAction: ownerPreflightSampleGateInputAllowed
        ? ownerDataPreflight.sample_threshold_met
          ? "Review quality gate before any promotion decision."
          : "Trusted owner-preview rows exist, but sample threshold is not met; keep collecting without rotating champion."
        : "Do not rotate champion; collect owner-reviewed aggregate counts first.",
    }),
  ];

  const trustedScoringSources = sources.filter((source) => source.scoring_input_allowed);
  const sampleGateSources = sources.filter((source) => source.sample_gate_input_allowed);
  const sampleThresholdMet = Boolean(dataProgress.sample_threshold_met || ownerSampleGate.sample_threshold_met);
  const status = trustedScoringSources.length > 0
    ? "trusted_scoring_input_available"
    : "waiting_for_trusted_scoring_input";
  const nextSafeAction = sampleThresholdMet
    ? "Run owner quality review before any challenger promotion review."
    : "Collect owner-reviewed P0 aggregate counts; do not score local D1 smoke rows.";

  const matrix = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "source_trust_matrix_local_only",
    status,
    trusted_scoring_source_count: trustedScoringSources.length,
    sample_gate_source_count: sampleGateSources.length,
    real_event_rows: realEventRows,
    p0_pending_count: dataProgress.p0_pending_count ?? 0,
    sample_threshold_met: sampleThresholdMet,
    owner_sample_gate_status: ownerSampleGate.status ?? "not_run",
    source_readiness_status: sourceReadiness.status ?? "not_run",
    ready_for_public_iteration_decision: false,
    next_safe_action: nextSafeAction,
    sources,
    blocked_from_scoring: sources.filter((source) => !source.scoring_input_allowed).map((source) => source.id),
    scoring_allowed_now: trustedScoringSources.length > 0,
    data_lp_events_write_performed: false,
    live_input_files_created: false,
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

  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeFile(JSON_PATH, `${JSON.stringify(matrix, null, 2)}\n`);
  await writeFile(STATUS_PATH, `${JSON.stringify(compactStatus(matrix), null, 2)}\n`);
  await writeFile(REPORT_PATH, renderReport(matrix));
  console.log(JSON.stringify(compactStatus(matrix), null, 2));
}

function sourceRow({ id, label, status, rows, canScore, canSampleGate, trustLevel, evidence, nextAction }) {
  return {
    id,
    label,
    status,
    rows: Number.isInteger(rows) ? rows : 0,
    scoring_input_allowed: Boolean(canScore),
    sample_gate_input_allowed: Boolean(canSampleGate),
    trust_level: trustLevel,
    evidence,
    next_action: nextAction,
    data_lp_events_write_performed: false,
    external_effect: false,
  };
}

function compactStatus(matrix) {
  return {
    ok: matrix.ok,
    generated_at: matrix.generated_at,
    mode: matrix.mode,
    status: matrix.status,
    trusted_scoring_source_count: matrix.trusted_scoring_source_count,
    sample_gate_source_count: matrix.sample_gate_source_count,
    real_event_rows: matrix.real_event_rows,
    p0_pending_count: matrix.p0_pending_count,
    sample_threshold_met: matrix.sample_threshold_met,
    ready_for_public_iteration_decision: matrix.ready_for_public_iteration_decision,
    scoring_allowed_now: matrix.scoring_allowed_now,
    next_safe_action: matrix.next_safe_action,
    source_count: matrix.sources.length,
    blocked_from_scoring_count: matrix.blocked_from_scoring.length,
    data_lp_events_write_performed: matrix.data_lp_events_write_performed,
    live_input_files_created: matrix.live_input_files_created,
    public_link_change_performed: matrix.public_link_change_performed,
    production_deploy_performed: matrix.production_deploy_performed,
    github_push_or_pr_performed: matrix.github_push_or_pr_performed,
    formal_post_performed: matrix.formal_post_performed,
    line_push_performed: matrix.line_push_performed,
    customer_data_mutation_performed: matrix.customer_data_mutation_performed,
    payment_action_performed: matrix.payment_action_performed,
    delete_action_performed: matrix.delete_action_performed,
    external_effect: matrix.external_effect,
  };
}

function renderReport(matrix) {
  const rows = matrix.sources.map((source) => (
    `| ${source.id} | ${source.status} | ${source.rows} | ${source.scoring_input_allowed ? "yes" : "no"} | ${source.sample_gate_input_allowed ? "yes" : "no"} | ${source.trust_level} | ${source.next_action} |`
  )).join("\n");
  return `# Source Trust Matrix

BLUF: ${matrix.status}. ${matrix.next_safe_action}

- Trusted scoring sources: ${matrix.trusted_scoring_source_count}
- Sample-gate-ready sources: ${matrix.sample_gate_source_count}
- Real event rows: ${matrix.real_event_rows}
- P0 pending rows: ${matrix.p0_pending_count}
- Sample threshold met: ${matrix.sample_threshold_met ? "yes" : "no"}
- Scoring allowed now: ${matrix.scoring_allowed_now ? "yes" : "no"}
- data/lp_events.jsonl write performed: ${matrix.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${matrix.external_effect ? "yes" : "no"}

## Matrix

| source | status | rows | scoring input | sample-gate input | trust level | next action |
|---|---:|---:|---|---|---|---|
${rows}

## Red Lines

- No formal posting.
- No primary link change.
- No challenger promotion.
- No LINE push.
- No ECPay/payment/refund action.
- No customer-data mutation.
- No production deploy.
- No deletion.
`;
}

async function readJson(relativePath, fallback) {
  try {
    return JSON.parse(await readFile(path.join(ROOT, relativePath), "utf8"));
  } catch {
    return fallback;
  }
}

async function countLines(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
  } catch {
    return 0;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
