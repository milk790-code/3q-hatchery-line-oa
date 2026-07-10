import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DEFAULTS = {
  candidateConfig: path.join(ROOT, "wrangler.jsonc"),
  championConfig: path.join(ROOT, "integrations", "3q-site", "champion-integration.config.json"),
  snapshot: path.join(ROOT, "data", "live_telemetry_observation_snapshot.json"),
  d1Readiness: path.join(ROOT, "data", "cloudflare_d1_readiness_status.json"),
  ownerEvidence: path.join(ROOT, "data", "owner_gate_evidence_status.json"),
  postGate: path.join(ROOT, "data", "post_gate_verification_status.json"),
  status: path.join(ROOT, "data", "live_telemetry_readiness_status.json"),
  report: path.join(ROOT, "live_telemetry_readiness.md"),
};
const WRANGLER = path.join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");
const D1_GATE = "remote_d1_create_and_migrate";
const CANDIDATE_GATE = "candidate_worker_production_deploy";
const EXPECTED_CANDIDATE_SECURITY_CONTRACT = "origin-pii-v2";

async function main() {
  const generatedAt = new Date();
  const options = parseArgs(process.argv.slice(2));
  const candidateConfig = await readJson(options.candidateConfig);
  const championConfig = await readJson(options.championConfig);
  let snapshot = await readOptionalJson(options.snapshot);
  let liveRefresh = { requested: options.refreshLive, ok: false, error: null };

  if (options.refreshLive) {
    try {
      snapshot = await refreshLiveObservation(candidateConfig, championConfig, generatedAt);
      await writeJson(options.snapshot, snapshot);
      liveRefresh = { requested: true, ok: true, error: null };
    } catch (error) {
      liveRefresh = {
        requested: true,
        ok: false,
        error: error instanceof Error ? error.message : "unknown_live_observation_error",
      };
      if (!snapshot) throw error;
    }
  }

  if (!snapshot) {
    throw new Error("No live telemetry observation snapshot exists. Run telemetry:readiness:live once.");
  }

  const status = buildStatus({
    generatedAt,
    snapshot,
    d1Readiness: await readJson(options.d1Readiness),
    ownerEvidence: await readJson(options.ownerEvidence),
    postGate: await readJson(options.postGate),
    candidateConfig,
    championConfig,
    liveRefresh,
    options,
  });
  await writeJson(options.status, status);
  await mkdir(path.dirname(options.report), { recursive: true });
  await writeFile(options.report, renderReport(status));
  console.log(JSON.stringify(status, null, 2));
}

function buildStatus({ generatedAt, snapshot, d1Readiness, ownerEvidence, postGate, candidateConfig, championConfig, liveRefresh, options }) {
  const d1Gate = gateById(ownerEvidence, D1_GATE);
  const candidateGate = gateById(ownerEvidence, CANDIDATE_GATE);
  const d1PostGate = gateById(postGate, D1_GATE);
  const candidatePostGate = gateById(postGate, CANDIDATE_GATE);
  const expectedCandidateOrigin = normalizeOrigin(championConfig.collector_public_url ?? candidateConfig.vars?.PUBLIC_BASE_URL);
  const observedCollectorOrigin = normalizeOrigin(snapshot.champion?.collector_origin);
  const exactD1 = d1Readiness.inventory?.exact_matches?.[0] ?? null;
  const candidateDeploymentObserved = snapshot.candidate?.deployment_present === true;
  const candidateHealthOk = snapshot.candidate?.health?.ok === true && snapshot.candidate?.health?.status === 200;
  const candidateSecurityContractOk = snapshot.candidate?.health?.security_contract === EXPECTED_CANDIDATE_SECURITY_CONTRACT;
  const candidatePageOk = snapshot.candidate?.page?.ok === true && snapshot.candidate?.page?.status === 200;
  const championPageOk = snapshot.champion?.page?.ok === true && snapshot.champion?.page?.status === 200;
  const championCollectorConfigured = snapshot.champion?.growth_loop_status?.collector_configured === true;
  const collectorOriginMatches = Boolean(expectedCandidateOrigin) && observedCollectorOrigin === expectedCandidateOrigin;
  const telemetryMarkersOk = snapshot.champion?.page?.page_view_marker === true
    && snapshot.champion?.page?.cta_click_marker === true
    && snapshot.champion?.page?.line_add_marker === false;
  const d1TargetReady = d1Readiness.decision?.dedicated_database_present === true
    && d1Readiness.decision?.configured_id_matches === true;
  const observedChainReady = candidateDeploymentObserved
    && candidateHealthOk
    && candidateSecurityContractOk
    && candidatePageOk
    && championPageOk
    && championCollectorConfigured
    && collectorOriginMatches
    && telemetryMarkersOk
    && d1TargetReady;
  const d1SchemaEvidenceValid = d1Gate?.evidence_valid === true
    && d1Gate?.ready_for_post_gate_verification === true
    && d1PostGate?.post_gate_verification_ready === true;
  const candidateDeploymentEvidenceValid = candidateGate?.evidence_valid === true
    && candidateGate?.ready_for_post_gate_verification === true
    && candidatePostGate?.post_gate_verification_ready === true;
  const recurringAggregateReadApproved = d1Gate?.recurring_aggregate_read_approved === true;
  const liveIngestReadinessProven = observedChainReady && d1SchemaEvidenceValid && candidateDeploymentEvidenceValid;
  const weeklyAggregateReadAuthorized = liveIngestReadinessProven && recurringAggregateReadApproved;
  const state = readinessState({
    candidateDeploymentObserved,
    candidateHealthOk,
    candidateSecurityContractOk,
    championPageOk,
    collectorOriginMatches,
    telemetryMarkersOk,
    d1TargetReady,
    d1SchemaEvidenceValid,
    candidateDeploymentEvidenceValid,
    recurringAggregateReadApproved,
  });

  return {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "live_telemetry_chain_readiness",
    status: state,
    snapshot_checked_at: snapshot.checked_at ?? null,
    live_refresh: liveRefresh,
    candidate_worker: {
      name: candidateConfig.name,
      expected_origin: expectedCandidateOrigin,
      deployment_observed: candidateDeploymentObserved,
      deployment_id: snapshot.candidate?.deployment?.id ?? null,
      version_id: snapshot.candidate?.deployment?.version_id ?? null,
      deployed_at: snapshot.candidate?.deployment?.created_on ?? null,
      health_ok: candidateHealthOk,
      security_contract: snapshot.candidate?.health?.security_contract ?? null,
      expected_security_contract: EXPECTED_CANDIDATE_SECURITY_CONTRACT,
      security_contract_ok: candidateSecurityContractOk,
      page_ok: candidatePageOk,
      operation_mode: !candidateDeploymentObserved
        ? "deploy_candidate_worker"
        : candidateSecurityContractOk
          ? "verify_existing_candidate_deployment"
          : "deploy_candidate_worker_security_update",
      deploy_required: !candidateDeploymentObserved || !candidateSecurityContractOk,
      redeploy_required: candidateDeploymentObserved ? !candidateSecurityContractOk : null,
      owner_provenance_evidence_valid: candidateDeploymentEvidenceValid,
    },
    champion: {
      worker_name: championConfig.production_worker_name,
      live_origin: normalizeOrigin(championConfig.live_base_url),
      page_ok: championPageOk,
      collector_configured: championCollectorConfigured,
      observed_collector_origin: observedCollectorOrigin,
      collector_origin_matches: collectorOriginMatches,
      page_view_marker: snapshot.champion?.page?.page_view_marker === true,
      cta_click_marker: snapshot.champion?.page?.cta_click_marker === true,
      line_add_marker: snapshot.champion?.page?.line_add_marker === true,
      privacy_event_contract_ok: telemetryMarkersOk,
    },
    d1: {
      database_name: d1Readiness.expected?.database_name ?? null,
      database_id: d1Readiness.expected?.configured_database_id ?? null,
      exact_target_ready: d1TargetReady,
      inventory_reported_num_tables: Number.isInteger(exactD1?.num_tables) ? exactD1.num_tables : null,
      inventory_reported_file_size: Number.isFinite(exactD1?.file_size) ? exactD1.file_size : null,
      inventory_table_count_authoritative: false,
      schema_absence_inferred_from_inventory: false,
      schema_evidence_valid: d1SchemaEvidenceValid,
      recurring_aggregate_read_approved: recurringAggregateReadApproved,
    },
    decisions: {
      observed_live_chain_ready_for_owner_evidence: observedChainReady,
      live_ingest_readiness_proven: liveIngestReadinessProven,
      weekly_aggregate_read_authorized: weeklyAggregateReadAuthorized,
      candidate_worker_deploy_required: !candidateDeploymentObserved || !candidateSecurityContractOk,
      candidate_worker_redeploy_required: candidateDeploymentObserved ? !candidateSecurityContractOk : null,
      next_safe_action: nextSafeAction(state),
    },
    outputs: {
      status: path.relative(ROOT, options.status),
      report: path.relative(ROOT, options.report),
      snapshot: path.relative(ROOT, options.snapshot),
    },
    external_read_performed: liveRefresh.requested && liveRefresh.ok,
    remote_table_query_performed: false,
    raw_event_rows_read_performed: false,
    customer_data_read_performed: false,
    data_lp_events_write_performed: false,
    event_post_performed: false,
    external_effect: false,
    remote_d1_migration_performed: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    note: "Read-only metadata and public GET observation. A shallow health 200 or D1 inventory num_tables value never proves remote schema readiness; owner evidence remains required.",
  };
}

function readinessState(input) {
  if (!input.candidateDeploymentObserved) return "candidate_worker_deployment_not_observed";
  if (!input.candidateHealthOk) return "candidate_worker_health_not_ready";
  if (!input.candidateSecurityContractOk) return "candidate_worker_security_update_required";
  if (!input.championPageOk || !input.collectorOriginMatches || !input.telemetryMarkersOk) return "champion_telemetry_wiring_not_ready";
  if (!input.d1TargetReady) return "dedicated_d1_target_not_ready";
  if (!input.d1SchemaEvidenceValid || !input.candidateDeploymentEvidenceValid) return "live_chain_observed_owner_provenance_and_schema_evidence_required";
  if (!input.recurringAggregateReadApproved) return "live_ingest_ready_recurring_read_not_approved";
  return "live_ingest_and_weekly_aggregate_read_ready";
}

function nextSafeAction(state) {
  const actions = {
    candidate_worker_deployment_not_observed: "Keep the deploy owner gate; review worker.ts, dry-run evidence, target, and rollback before any production deploy.",
    candidate_worker_health_not_ready: "Review the existing Candidate Worker deployment and rollback metadata; do not redeploy automatically.",
    candidate_worker_security_update_required: "The live Candidate predates the origin/PII security contract. Review the local diff, current rollback version, and owner gate before one security redeploy; do not treat current ingest as production-ready.",
    champion_telemetry_wiring_not_ready: "Review the Champion collector origin and privacy event markers before any redeploy or public-link change.",
    dedicated_d1_target_not_ready: "Review the exact dedicated D1 binding; never reuse CRM or hatchery databases automatically.",
    live_chain_observed_owner_provenance_and_schema_evidence_required: "The live collector chain is observed. Verify existing Candidate Worker provenance and remote schema through the owner gate; do not redeploy or infer schema state from metadata.",
    live_ingest_ready_recurring_read_not_approved: "Ingest evidence is ready, but weekly remote reads stay disabled until recurring_aggregate_read_approved=true.",
    live_ingest_and_weekly_aggregate_read_ready: "Run the guarded aggregate-only collector; raw rows and customer fields remain prohibited.",
  };
  return actions[state];
}

async function refreshLiveObservation(candidateConfig, championConfig, checkedAt) {
  await access(WRANGLER);
  const { stdout } = await execFileAsync(
    WRANGLER,
    ["deployments", "list", "--name", candidateConfig.name, "--json"],
    { cwd: ROOT, maxBuffer: 4 * 1024 * 1024 },
  );
  const deployments = JSON.parse(stdout);
  if (!Array.isArray(deployments)) throw new Error("Candidate deployment list did not return an array.");
  const deployment = deployments.length > 0
    ? [...deployments].sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0]
    : null;
  const activeVersion = deployment?.versions?.find((item) => Number(item.percentage) === 100) ?? deployment?.versions?.[0] ?? null;
  const candidateOrigin = normalizeOrigin(candidateConfig.vars?.PUBLIC_BASE_URL ?? championConfig.collector_public_url);
  const championOrigin = normalizeOrigin(championConfig.live_base_url);
  const [health, candidatePage, championPage, championStatus] = await Promise.all([
    get(`${candidateOrigin}/health`, "application/json"),
    get(`${candidateOrigin}/candidate`, "text/html"),
    get(`${championOrigin}/`, "text/html"),
    get(`${championOrigin}/growth-loop/status`, "application/json"),
  ]);
  const healthBody = parseJson(health.body);
  const championStatusBody = parseJson(championStatus.body);
  const workerOrigins = [...new Set(championPage.body.match(/https:\/\/[A-Za-z0-9.-]+\.workers\.dev/g) ?? [])].map(normalizeOrigin);
  const collectorOrigin = workerOrigins.find((origin) => origin === candidateOrigin) ?? null;
  return {
    ok: Boolean(deployment) && health.ok && candidatePage.ok && championPage.ok,
    checked_at: checkedAt.toISOString(),
    mode: "read_only_live_telemetry_observation",
    candidate: {
      deployment_present: Boolean(deployment && activeVersion?.version_id),
      deployment: deployment ? {
        id: deployment.id,
        created_on: deployment.created_on,
        source: deployment.source,
        strategy: deployment.strategy,
        version_id: activeVersion?.version_id ?? null,
        percentage: activeVersion?.percentage ?? null,
      } : null,
      health: {
        ok: health.ok && healthBody?.ok === true,
        status: health.status,
        service: healthBody?.service ?? null,
        build: healthBody?.build ?? null,
        security_contract: healthBody?.security_contract ?? null,
        environment: healthBody?.environment ?? null,
      },
      page: {
        ok: candidatePage.ok,
        status: candidatePage.status,
        bytes: candidatePage.body.length,
        offer_marker: candidatePage.body.includes("3Q 48h"),
      },
    },
    champion: {
      page: {
        ok: championPage.ok,
        status: championPage.status,
        bytes: championPage.body.length,
        page_view_marker: championPage.body.includes("page_view"),
        cta_click_marker: championPage.body.includes("cta_click"),
        line_add_marker: championPage.body.includes("line_add"),
      },
      growth_loop_status: {
        ok: championStatus.ok && championStatusBody?.ok === true,
        status: championStatus.status,
        collector_configured: championStatusBody?.collector_configured === true,
      },
      collector_origin: collectorOrigin,
      observed_worker_origins: workerOrigins,
    },
    external_read_performed: true,
    remote_table_query_performed: false,
    customer_data_read_performed: false,
    event_post_performed: false,
    data_lp_events_write_performed: false,
    external_effect: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };
}

async function get(url, accept) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: { accept },
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: response.ok, status: response.status, body: await response.text() };
}

function renderReport(status) {
  return `# Live Telemetry Readiness

BLUF: ${status.status}. Candidate deployment, Candidate security contract, Champion wiring, D1 target metadata, owner provenance, schema evidence, and recurring-read scope are evaluated independently.

- Generated: ${status.generated_at}
- Snapshot checked: ${status.snapshot_checked_at ?? "n/a"}
- Live refresh: ${status.live_refresh.requested ? status.live_refresh.ok ? "success" : "cached fallback" : "cached snapshot"}
- Candidate deployment observed: ${status.candidate_worker.deployment_observed ? "yes" : "no"}
- Candidate health: ${status.candidate_worker.health_ok ? "ok" : "not ready"}
- Candidate security contract: ${status.candidate_worker.security_contract_ok ? "current" : "update required"} (${status.candidate_worker.security_contract ?? "missing"})
- Candidate deploy required: ${status.candidate_worker.deploy_required ? "yes" : "no"}
- Champion collector configured: ${status.champion.collector_configured ? "yes" : "no"}
- Collector origin matches: ${status.champion.collector_origin_matches ? "yes" : "no"}
- Privacy event contract: ${status.champion.privacy_event_contract_ok ? "ok" : "not ready"}
- Exact D1 target ready: ${status.d1.exact_target_ready ? "yes" : "no"}
- Inventory-reported num_tables: ${status.d1.inventory_reported_num_tables ?? "n/a"} (not authoritative)
- Schema evidence valid: ${status.d1.schema_evidence_valid ? "yes" : "no"}
- Recurring aggregate read approved: ${status.d1.recurring_aggregate_read_approved ? "yes" : "no"}
- Live ingest readiness proven: ${status.decisions.live_ingest_readiness_proven ? "yes" : "no"}
- Weekly aggregate read authorized: ${status.decisions.weekly_aggregate_read_authorized ? "yes" : "no"}

## Next Safe Action

${status.decisions.next_safe_action}

## Safety

- Remote table query performed: no
- Raw event rows read: no
- Customer data read: no
- Event POST performed: no
- Production deploy performed: no
- Public link change performed: no
- External effect: no
`;
}

function gateById(status, gateId) {
  return (status?.gates ?? []).find((item) => item.gate_id === gateId) ?? null;
}

function normalizeOrigin(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseArgs(args) {
  const options = { ...DEFAULTS, refreshLive: false };
  const keys = {
    "--candidate-config": "candidateConfig",
    "--champion-config": "championConfig",
    "--snapshot": "snapshot",
    "--d1-readiness": "d1Readiness",
    "--owner-evidence": "ownerEvidence",
    "--post-gate": "postGate",
    "--status": "status",
    "--report": "report",
  };
  for (const arg of args) {
    if (arg === "--refresh-live") options.refreshLive = true;
    const [flag, value] = arg.split("=", 2);
    if (keys[flag] && value) options[keys[flag]] = path.resolve(ROOT, value);
  }
  return options;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readOptionalJson(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch(async (error) => {
  const options = parseArgs(process.argv.slice(2));
  const failed = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "live_telemetry_chain_readiness",
    status: "live_telemetry_readiness_monitor_failed",
    error: error instanceof Error ? error.message : "unknown_error",
    remote_table_query_performed: false,
    customer_data_read_performed: false,
    event_post_performed: false,
    data_lp_events_write_performed: false,
    external_effect: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };
  await writeJson(options.status, failed);
  console.error(error);
  process.exitCode = 1;
});
