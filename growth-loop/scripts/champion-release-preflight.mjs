import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { inspectChampionSourceLock } from "./lib/champion-source-lock.mjs";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "integrations", "3q-site", "champion-integration.config.json");
const CANDIDATE_STATUS_PATH = path.join(ROOT, "data", "champion_integration_candidate_status.json");
const SMOKE_STATUS_PATH = path.join(ROOT, "data", "champion_integration_smoke_status.json");
const LOCAL_BRANCH_STATUS_PATH = path.join(ROOT, "data", "champion_local_branch_status.json");
const D1_READINESS_STATUS_PATH = path.join(ROOT, "data", "cloudflare_d1_readiness_status.json");
const LIVE_TELEMETRY_READINESS_STATUS_PATH = path.join(ROOT, "data", "live_telemetry_readiness_status.json");
const LIVE_SNAPSHOT_PATH = path.join(ROOT, "data", "champion_live_deployment_snapshot.json");
const STATUS_PATH = path.join(ROOT, "data", "champion_release_preflight_status.json");
const REPORT_PATH = path.join(ROOT, "champion_release_preflight.md");
const OWNER_PACKET_JSON_PATH = path.join(ROOT, "champion_release_owner_packet.json");
const OWNER_PACKET_MD_PATH = path.join(ROOT, "champion_release_owner_packet.md");
const WRANGLER_BIN = path.join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");

async function main() {
  const generatedAt = new Date();
  const refreshLive = process.argv.includes("--refresh-live");
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const candidateStatus = JSON.parse(await readFile(CANDIDATE_STATUS_PATH, "utf8"));
  const smokeStatus = JSON.parse(await readFile(SMOKE_STATUS_PATH, "utf8"));
  const localBranchStatus = await readOptionalJson(LOCAL_BRANCH_STATUS_PATH);
  const d1ReadinessStatus = await readOptionalJson(D1_READINESS_STATUS_PATH);
  const liveTelemetryReadinessStatus = await readOptionalJson(LIVE_TELEMETRY_READINESS_STATUS_PATH);
  const repoPath = argument("--repo") ?? process.env.THREE_Q_SITE_REPO ?? config.source_repo_path;
  const ref = argument("--ref") ?? config.source_ref;
  const tempDir = await mkdtemp(path.join(tmpdir(), "3q-site-champion-release-preflight-"));
  const sourceDir = path.join(tempDir, "source");
  const archivePath = path.join(tempDir, "source.tar");
  const bundleDir = path.join(tempDir, "bundle");
  const productionTemplateBundleDir = path.join(tempDir, "production-template-bundle");
  const generatedWorkerPath = path.join(ROOT, config.generated_worker);
  const generatedPatchPath = path.join(ROOT, config.generated_patch);
  let status;

  try {
    await access(WRANGLER_BIN);
    await mkdir(sourceDir, { recursive: true });
    await mkdir(bundleDir, { recursive: true });
    await mkdir(productionTemplateBundleDir, { recursive: true });

    const sourceInspection = await inspectChampionSourceLock({ config, repoPath, ref, root: ROOT });
    const sourceRepoPresent = sourceInspection.sourceMode === "git_ref_pinned";
    let sourceStatusBefore = "";
    const sourceMode = sourceInspection.sourceMode;
    const commit = config.expected_commit;
    const observedRefCommit = sourceInspection.observedRefCommit;
    const lockCommitIsAncestor = sourceInspection.lockCommitIsAncestor;
    assert(sourceInspection.releaseReady, sourceInspection.failureReason ?? "Source lock is not release-ready.");
    if (sourceRepoPresent) {
      sourceStatusBefore = await git(repoPath, ["status", "--porcelain=v1"]);
      await runRequired("git", ["archive", "--format=tar", `--output=${archivePath}`, observedRefCommit], repoPath, "git archive");
      await runRequired("tar", ["-xf", archivePath, "-C", sourceDir], ROOT, "source archive extraction");
    }

    const extractedSourcePath = path.join(sourceDir, config.source_path);
    const baseSource = await readFile(extractedSourcePath);
    const baseBlobSha = gitBlobSha(baseSource);
    const baseSha256 = sha256(baseSource);
    assert(sourceInspection.expectedTupleVerified, "Configured source-lock tuple is internally inconsistent.");
    assert(sourceInspection.ancestryVerified, "Source-ref ancestry was not verified.");
    assert(baseBlobSha === sourceInspection.blobSha, "Pinned archive blob differs from the inspected source ref.");
    assert(baseSha256 === sourceInspection.sourceSha256, "Pinned archive SHA-256 differs from the inspected source ref.");
    assert(baseBlobSha === config.expected_blob_sha, `Archived source blob changed: ${baseBlobSha}`);
    assert(baseSha256 === config.expected_sha256, `Archived source SHA-256 changed: ${baseSha256}`);

    const generatedWorker = await readFile(generatedWorkerPath);
    const patchText = await readFile(generatedPatchPath, "utf8");
    const alreadyIntegratedNoDiff = patchText.startsWith("# No source diff:");
    const patchCheck = alreadyIntegratedNoDiff
      ? { code: baseSource.equals(generatedWorker) ? 0 : 1, output: "already integrated; byte identity required" }
      : await command("git", ["apply", "--check", "--verbose", generatedPatchPath], sourceDir);
    assert(patchCheck.code === 0, `Patch check failed: ${patchCheck.output}`);
    const patchApply = alreadyIntegratedNoDiff
      ? { code: 0, output: "already integrated; no patch applied" }
      : await command("git", ["apply", "--verbose", generatedPatchPath], sourceDir);
    assert(patchApply.code === 0, `Patch apply failed: ${patchApply.output}`);

    const patchedSource = await readFile(extractedSourcePath);
    const patchedSha256 = sha256(patchedSource);
    const generatedSha256 = sha256(generatedWorker);
    assert(patchedSource.equals(generatedWorker), "Patched source is not byte-identical to generated candidate.");

    const syntax = await command(process.execPath, ["--check", extractedSourcePath], sourceDir);
    assert(syntax.code === 0, `Node syntax check failed: ${syntax.output}`);

    const releaseConfigPath = path.join(sourceDir, "wrangler.champion-release-preflight.jsonc");
    const releaseConfig = {
      name: `${config.production_worker_name}-release-preflight`,
      main: config.source_path,
      compatibility_date: config.production_compatibility_date,
      observability: { enabled: true, head_sampling_rate: 1 },
      vars: { [config.collector_env]: config.collector_public_url }
    };
    await writeFile(releaseConfigPath, `${JSON.stringify(releaseConfig, null, 2)}\n`);

    const dryRun = await command(
      WRANGLER_BIN,
      ["deploy", "--dry-run", "--config", releaseConfigPath, "--outdir", bundleDir],
      sourceDir
    );
    const dryRunOk = dryRun.code === 0 && dryRun.output.includes("--dry-run: exiting now.");
    assert(dryRunOk, `Wrangler dry run failed: ${dryRun.output}`);
    const bundleFiles = await fileInventory(bundleDir);
    assert(bundleFiles.length > 0, "Wrangler dry run produced no bundle files.");
    const productionTemplateDryRun = await command(
      WRANGLER_BIN,
      [
        "deploy",
        extractedSourcePath,
        "--name",
        config.production_worker_name,
        "--compatibility-date",
        config.production_compatibility_date,
        "--var",
        `${config.collector_env}:${config.collector_public_url}`,
        "--keep-vars",
        "--dry-run",
        "--outdir",
        productionTemplateBundleDir
      ],
      sourceDir
    );
    const productionTemplateDryRunOk = productionTemplateDryRun.code === 0
      && productionTemplateDryRun.output.includes("--dry-run: exiting now.");
    assert(productionTemplateDryRunOk, `Production command template dry run failed: ${productionTemplateDryRun.output}`);
    const productionTemplateBundleFiles = await fileInventory(productionTemplateBundleDir);
    assert(productionTemplateBundleFiles.length > 0, "Production command template dry run produced no bundle files.");

    const sourceStatusAfter = sourceRepoPresent
      ? await git(repoPath, ["status", "--porcelain=v1"])
      : "";
    assert(sourceStatusAfter === sourceStatusBefore, "Source repository status changed during preflight.");
    const liveSnapshot = refreshLive
      ? await refreshLiveSnapshot(config, generatedAt)
      : await readOptionalJson(LIVE_SNAPSHOT_PATH);
    const liveSnapshotAgeHours = liveSnapshot?.checked_at
      ? Math.max(0, (generatedAt.getTime() - new Date(liveSnapshot.checked_at).getTime()) / 3_600_000)
      : null;

    const checks = {
      exact_source_commit: commit === config.expected_commit && sourceInspection.expectedTupleVerified,
      expected_lock_tuple_verified: sourceInspection.expectedTupleVerified,
      source_ref_pinned_once: sourceRepoPresent && typeof observedRefCommit === "string" && observedRefCommit.length === 40,
      source_ref_descends_from_lock: lockCommitIsAncestor,
      source_ref_target_matches_lock: baseBlobSha === config.expected_blob_sha && baseSha256 === config.expected_sha256,
      exact_source_blob: baseBlobSha === config.expected_blob_sha,
      exact_source_sha256: baseSha256 === config.expected_sha256,
      candidate_build_status_ok: candidateStatus.ok === true,
      candidate_source_lock_matches: candidateStatus.source?.commit === commit
        && candidateStatus.source?.expected_lock_tuple_verified === true
        && candidateStatus.source?.lock_commit_is_ancestor === true
        && candidateStatus.source?.ref_file_matches_lock === true
        && candidateStatus.source?.blob_sha === baseBlobSha
        && candidateStatus.source?.sha256 === baseSha256,
      isolated_two_worker_smoke_ok: smokeStatus.ok === true,
      patch_check_ok: patchCheck.code === 0,
      patch_apply_ok: patchApply.code === 0,
      patched_source_matches_generated_candidate: patchedSha256 === generatedSha256,
      node_syntax_ok: syntax.code === 0,
      wrangler_dry_run_ok: dryRunOk,
      wrangler_bundle_created: bundleFiles.length > 0,
      production_command_template_dry_run_ok: productionTemplateDryRunOk,
      source_repository_unchanged: sourceStatusAfter === sourceStatusBefore,
      local_feature_commit_ready: localBranchStatus?.ok === true,
      d1_readiness_monitor_ok: d1ReadinessStatus?.ok === true,
      live_telemetry_readiness_monitor_ok: liveTelemetryReadinessStatus?.ok === true,
    };
    const ok = Object.values(checks).every(Boolean);
    const ownerPacket = buildOwnerPacket({
      config,
      ref,
      generatedAt,
      commit,
      observedRefCommit,
      baseBlobSha,
      baseSha256,
      patchedSha256,
      generatedPatchPath,
      repoPath,
      liveSnapshot,
      localBranchStatus,
      d1ReadinessStatus,
      liveTelemetryReadinessStatus,
      checks,
      ok
    });

    status = {
      ok,
      generated_at: generatedAt.toISOString(),
      mode: "clean_archive_champion_release_preflight_local_only",
      status: ok ? "prepared_but_blocked_production_prerequisites" : "release_preflight_failed",
      source: {
        repository: config.source_repository,
        repo_path: repoPath,
        repo_present: sourceRepoPresent,
        ref,
        mode: sourceMode,
        commit,
        observed_ref_commit: observedRefCommit,
        ref_advanced: observedRefCommit !== commit,
        lock_commit_is_ancestor: lockCommitIsAncestor,
        ancestry_verified: sourceInspection.ancestryVerified,
        expected_lock_tuple_verified: sourceInspection.expectedTupleVerified,
        ref_file_matches_lock: baseBlobSha === config.expected_blob_sha && baseSha256 === config.expected_sha256,
        path: config.source_path,
        blob_sha: baseBlobSha,
        sha256: baseSha256,
        source_status_before: lines(sourceStatusBefore),
        source_status_after: lines(sourceStatusAfter),
        source_repository_unchanged: sourceStatusAfter === sourceStatusBefore
      },
      candidate: {
        worker: config.generated_worker,
        patch: config.generated_patch,
        generated_sha256: generatedSha256,
        patched_sha256: patchedSha256,
        byte_identical_after_patch: patchedSource.equals(generatedWorker)
      },
      local_branch: {
        ok: localBranchStatus?.ok === true,
        status: localBranchStatus?.status ?? "missing",
        name: localBranchStatus?.local_branch?.name ?? null,
        commit: localBranchStatus?.local_branch?.commit ?? null,
        parent_commit: localBranchStatus?.local_branch?.parent_commit ?? null,
        source_lock_base_commit: localBranchStatus?.local_branch?.source_lock_base_commit ?? null,
        worker_commit: localBranchStatus?.local_branch?.worker_commit ?? null,
        workflow_commit: localBranchStatus?.local_branch?.workflow_commit ?? null,
        commit_count: localBranchStatus?.local_branch?.commit_count ?? 0,
        commits: localBranchStatus?.local_branch?.commits ?? [],
        changed_paths: localBranchStatus?.local_branch?.changed_paths ?? [],
        remote_branch_observed: localBranchStatus?.remote_observation?.branch_present ?? null,
        remote_commit: localBranchStatus?.remote_observation?.commit ?? null,
        remote_state: localBranchStatus?.remote_observation?.state ?? "unknown",
        local_ahead_count: localBranchStatus?.remote_observation?.local_ahead_count ?? null,
        github_push_or_pr_performed: false
      },
      collector_readiness: {
        ok: d1ReadinessStatus?.ok === true,
        status: d1ReadinessStatus?.status ?? "missing",
        inventory_checked_at: d1ReadinessStatus?.inventory?.snapshot_checked_at ?? null,
        dedicated_database_present: d1ReadinessStatus?.decision?.dedicated_database_present === true,
        configured_id_is_placeholder: d1ReadinessStatus?.expected?.configured_id_is_placeholder === true,
        remote_table_query_performed: false,
        resource_create_performed: false,
        remote_schema_migration_performed: false,
        candidate_deployment_observed: liveTelemetryReadinessStatus?.candidate_worker?.deployment_observed === true,
        candidate_deploy_required: liveTelemetryReadinessStatus?.candidate_worker?.deploy_required === true,
        observed_live_chain_ready_for_owner_evidence: liveTelemetryReadinessStatus?.decisions?.observed_live_chain_ready_for_owner_evidence === true,
        live_ingest_readiness_proven: liveTelemetryReadinessStatus?.decisions?.live_ingest_readiness_proven === true,
      },
      checks,
      patch_validation: {
        check_exit_code: patchCheck.code,
        apply_exit_code: patchApply.code,
        clean_archive_only: true
      },
      syntax_check: { ok: syntax.code === 0, exit_code: syntax.code },
      worker_dry_run: {
        ok: dryRunOk,
        exit_code: dryRun.code,
        wrangler_version: await wranglerVersion(),
        compatibility_date: config.production_compatibility_date,
        total_upload_line: dryRun.output.split(/\r?\n/).find((line) => line.startsWith("Total Upload:")) ?? null,
        bundle_files: bundleFiles
      },
      production_command_template_dry_run: {
        ok: productionTemplateDryRunOk,
        exit_code: productionTemplateDryRun.code,
        upload_performed: false,
        total_upload_line: productionTemplateDryRun.output.split(/\r?\n/).find((line) => line.startsWith("Total Upload:")) ?? null,
        bundle_files: productionTemplateBundleFiles
      },
      live_snapshot: liveSnapshot
        ? {
            present: true,
            ok: liveSnapshot.ok === true,
            checked_at: liveSnapshot.checked_at,
            age_hours: round(liveSnapshotAgeHours, 2),
            refreshed_this_run: refreshLive,
            worker_name: liveSnapshot.worker_name,
            deployed_version_id: liveSnapshot.deployed_version?.id ?? null,
            compatibility_date: liveSnapshot.deployed_version?.compatibility_date ?? null,
            contact_repair_live: liveSnapshot.contact?.line_only_mode_present === true,
            collector_configured: liveSnapshot.growth_loop_status?.collector_configured === true
          }
        : { present: false, ok: false, checked_at: null, age_hours: null, refreshed_this_run: false },
      release_gates: ownerPacket.gates,
      rollback: ownerPacket.rollback,
      outputs: {
        report: "champion_release_preflight.md",
        status: "data/champion_release_preflight_status.json",
        live_snapshot: "data/champion_live_deployment_snapshot.json",
        live_telemetry_report: "live_telemetry_readiness.md",
        live_telemetry_status: "data/live_telemetry_readiness_status.json",
        owner_packet_json: "champion_release_owner_packet.json",
        owner_packet_markdown: "champion_release_owner_packet.md",
        local_branch_report: "champion_local_branch.md",
        local_branch_status: "data/champion_local_branch_status.json",
        d1_readiness_report: "cloudflare_d1_readiness.md",
        d1_readiness_status: "data/cloudflare_d1_readiness_status.json"
      },
      external_read_performed_this_run: refreshLive,
      external_effect: false,
      data_lp_events_write_performed: false,
      source_repo_write_performed: false,
      production_deploy_performed: false,
      public_link_change_performed: false,
      github_push_or_pr_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_read_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      temporary_files_removed: true
    };

    await writeJson(OWNER_PACKET_JSON_PATH, ownerPacket);
    await writeFile(OWNER_PACKET_MD_PATH, renderOwnerPacket(ownerPacket));
    await writeJson(STATUS_PATH, status);
    await writeFile(REPORT_PATH, renderReport(status));
    console.log(JSON.stringify(status, null, 2));
    if (!ok) process.exitCode = 1;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function refreshLiveSnapshot(config, checkedAt) {
  const deploymentsResult = await command(
    WRANGLER_BIN,
    ["deployments", "list", "--name", config.production_worker_name, "--json"],
    ROOT
  );
  assert(deploymentsResult.code === 0, `Live deployment read failed: ${deploymentsResult.output}`);
  const deployments = JSON.parse(deploymentsResult.output);
  assert(Array.isArray(deployments) && deployments.length > 0, "No live deployments returned.");
  const deployed = [...deployments].sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
  const active = deployed.versions?.find((version) => Number(version.percentage) === 100) ?? deployed.versions?.[0];
  assert(active?.version_id, "Live deployment has no active version.");

  const versionResult = await command(
    WRANGLER_BIN,
    ["versions", "view", active.version_id, "--name", config.production_worker_name, "--json"],
    ROOT
  );
  assert(versionResult.code === 0, `Live version read failed: ${versionResult.output}`);
  const version = JSON.parse(versionResult.output);
  const healthResponse = await fetch(`${config.live_base_url}/health`, { headers: { accept: "application/json" } });
  const healthText = await healthResponse.text();
  const healthBody = parseJson(healthText);
  const contactResponse = await fetch(`${config.live_base_url}/contact`, { headers: { accept: "text/html" } });
  const contact = await contactResponse.text();
  const growthStatusResponse = await fetch(`${config.live_base_url}/growth-loop/status`, { headers: { accept: "application/json" } });
  const growthStatusText = await growthStatusResponse.text();
  const growthStatusBody = parseJson(growthStatusText);
  const snapshot = {
    ok: healthResponse.ok && contactResponse.ok && version.id === active.version_id,
    checked_at: checkedAt.toISOString(),
    mode: "read_only_cloudflare_live_snapshot",
    worker_name: config.production_worker_name,
    live_base_url: config.live_base_url,
    deployment: {
      id: deployed.id,
      created_on: deployed.created_on,
      source: deployed.source,
      strategy: deployed.strategy,
      versions: (deployed.versions ?? []).map((item) => ({
        id: item.version_id,
        percentage: item.percentage
      }))
    },
    deployed_version: {
      id: version.id,
      number: version.number,
      created_on: version.metadata?.created_on ?? deployed.created_on,
      compatibility_date: version.resources?.script_runtime?.compatibility_date ?? null,
      handlers: version.resources?.script?.handlers ?? [],
      bindings: (version.resources?.bindings ?? []).map((binding) => ({ type: binding.type ?? null, name: binding.name ?? null }))
    },
    health: {
      ok: healthResponse.ok,
      status: healthResponse.status,
      body: healthBody
    },
    contact: {
      ok: contactResponse.ok,
      status: contactResponse.status,
      false_success_state_present: contact.includes("setSent(true)"),
      line_only_mode_present: contact.includes('data-growth-contact-mode="line-only"'),
      telemetry_present: contact.includes("data-growth-loop-telemetry")
    },
    growth_loop_status: {
      ok: growthStatusResponse.ok,
      status: growthStatusResponse.status,
      body: growthStatusBody,
      collector_configured: growthStatusBody?.collector_configured === true
    },
    external_read_performed: true,
    external_effect: false,
    data_lp_events_write_performed: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_read_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false
  };
  await writeJson(LIVE_SNAPSHOT_PATH, snapshot);
  return snapshot;
}

function buildOwnerPacket({ config, ref, generatedAt, commit, observedRefCommit, baseBlobSha, baseSha256, patchedSha256, generatedPatchPath, repoPath, liveSnapshot, localBranchStatus, d1ReadinessStatus, liveTelemetryReadinessStatus, checks, ok }) {
  const liveVersionId = liveSnapshot?.deployed_version?.id ?? "<refresh-live-snapshot-first>";
  const wrangler = WRANGLER_BIN;
  const reviewWorktree = localBranchStatus?.local_branch?.worktree ?? config.local_release_worktree;
  const patchPath = generatedPatchPath;
  const branchPaths = localBranchStatus?.local_branch?.changed_paths ?? [config.source_path];
  const remoteState = localBranchStatus?.remote_observation?.state ?? "unknown";
  const remotePresent = localBranchStatus?.remote_observation?.branch_present === true;
  const localAheadCount = localBranchStatus?.remote_observation?.local_ahead_count ?? null;
  const d1Missing = d1ReadinessStatus?.decision?.dedicated_database_present !== true;
  const candidateObservedLive = liveTelemetryReadinessStatus?.candidate_worker?.deployment_observed === true
    && liveTelemetryReadinessStatus?.candidate_worker?.health_ok === true;
  const candidateSecurityContractOk = liveTelemetryReadinessStatus?.candidate_worker?.security_contract_ok === true;
  const collectorProvenanceAndSchemaVerified = liveTelemetryReadinessStatus?.decisions?.live_ingest_readiness_proven === true;
  const collectorBlocker = d1Missing
    ? "Live D1 metadata confirms the dedicated 3q-growth-loop-candidate database is absent. Existing 3Q CRM databases are not eligible for automatic reuse; owner-approved creation, binding, and migration are still required."
    : candidateObservedLive && candidateSecurityContractOk && collectorProvenanceAndSchemaVerified
      ? `Candidate deployment ${liveTelemetryReadinessStatus.candidate_worker.deployment_id} / version ${liveTelemetryReadinessStatus.candidate_worker.version_id} is healthy, security-current, wired to the Champion, and backed by validated D1 schema plus owner provenance evidence. No collector redeploy is required.`
    : candidateObservedLive && candidateSecurityContractOk
      ? `Candidate deployment ${liveTelemetryReadinessStatus.candidate_worker.deployment_id} / version ${liveTelemetryReadinessStatus.candidate_worker.version_id} is observed healthy, security-current, and wired to the Champion. No redeploy is currently required, but owner provenance and remote schema evidence are still missing.`
      : candidateObservedLive
        ? `Candidate deployment ${liveTelemetryReadinessStatus.candidate_worker.deployment_id} / version ${liveTelemetryReadinessStatus.candidate_worker.version_id} is healthy but lacks security contract origin-pii-v2. The local collector hardening is ready for review; one owner-gated security redeploy and rollback verification are required before production ingest is trusted.`
      : "The dedicated D1 and configured binding are observed, but no healthy Candidate deployment or validated schema/provenance evidence is available. Owner review is still required.";
  const gates = [
    {
      id: "review_champion_patch",
      risk_tier: "T1",
      status: ok && localBranchStatus?.ok === true ? "local_feature_commit_ready_for_owner_review" : "blocked_by_preflight_failure",
      reason: localBranchStatus?.ok === true
        ? `Review local head ${localBranchStatus.local_branch.commit}; the full stack is scoped to ${branchPaths.join(", ")}. Remote state is ${remoteState}; this preflight performed no GitHub write.`
        : "Review the source-locked patch and local integration evidence before creating a release branch."
    },
    {
      id: "provision_production_collector",
      risk_tier: "T3",
      status: candidateObservedLive && candidateSecurityContractOk && collectorProvenanceAndSchemaVerified
        ? "existing_collector_provenance_and_schema_verified"
        : candidateObservedLive && candidateSecurityContractOk
          ? "existing_collector_observed_owner_provenance_and_schema_evidence_required"
        : candidateObservedLive
          ? "existing_collector_security_update_owner_approval_required"
        : "blocked_owner_approval_and_cloudflare_configuration_required",
      reason: collectorBlocker
    },
    {
      id: "approve_champion_production_deploy",
      risk_tier: "T3",
      status: "blocked_owner_approval_required",
      reason: collectorProvenanceAndSchemaVerified
        ? "Collector provenance and D1 schema evidence are validated. The separate Champion change still requires Draft PR review, current rollback confirmation, and explicit merge/deploy approval."
        : "A live integration may already be observable, but its provenance is not owner evidence. Any deploy or redeploy still requires patch review, current rollback confirmation, and explicit approval."
    },
    {
      id: "approve_github_branch_push_or_pr",
      risk_tier: "T2",
      status: "blocked_owner_approval_required",
      reason: remotePresent
        ? `The remote branch is a reviewed ancestor (${remoteState}) and local is ahead by ${localAheadCount ?? "unknown"}; updating it or opening a PR remains an external GitHub write.`
        : "The release stack exists locally, but pushing the branch or opening a PR is an external GitHub write."
    }
  ];
  return {
    ok,
    generated_at: generatedAt.toISOString(),
    mode: "champion_release_owner_packet_review_only",
    release_id: `champion-contact-v1-${patchedSha256.slice(0, 12)}`,
    source_lock: {
      repository: config.source_repository,
      repo_path: repoPath,
      ref,
      commit,
      observed_ref_commit: observedRefCommit,
      ref_advanced: observedRefCommit !== commit,
      path: config.source_path,
      blob_sha: baseBlobSha,
      sha256: baseSha256
    },
    candidate: {
      patch: path.relative(ROOT, patchPath),
      worker: config.generated_worker,
      sha256: patchedSha256,
      checks
    },
    review_artifacts: {
      d1_schema_contract: "d1_schema_contract.md",
      d1_config_guard: "approved_d1_config.md",
      github_handoff: "champion_github_handoff.md",
      github_pr_body: "champion_github_pr_body.md"
    },
    local_branch: localBranchStatus?.ok === true
      ? {
          name: localBranchStatus.local_branch.name,
          commit: localBranchStatus.local_branch.commit,
          parent_commit: localBranchStatus.local_branch.parent_commit,
          source_lock_base_commit: localBranchStatus.local_branch.source_lock_base_commit,
          worker_commit: localBranchStatus.local_branch.worker_commit,
          workflow_commit: localBranchStatus.local_branch.workflow_commit,
          commit_count: localBranchStatus.local_branch.commit_count,
          commits: localBranchStatus.local_branch.commits,
          worktree: localBranchStatus.local_branch.worktree,
          changed_paths: localBranchStatus.local_branch.changed_paths,
          candidate_sha256: localBranchStatus.local_branch.candidate_sha256,
          remote_branch_observed: localBranchStatus.remote_observation?.branch_present,
          remote_commit: localBranchStatus.remote_observation?.commit,
          remote_state: localBranchStatus.remote_observation?.state,
          local_ahead_count: localBranchStatus.remote_observation?.local_ahead_count,
          github_push_or_pr_performed: false
        }
      : null,
    collector_readiness: d1ReadinessStatus
      ? {
          status: d1ReadinessStatus.status,
          inventory_checked_at: d1ReadinessStatus.inventory?.snapshot_checked_at,
          expected_database_name: d1ReadinessStatus.expected?.database_name,
          dedicated_database_present: d1ReadinessStatus.decision?.dedicated_database_present === true,
          configured_id_is_placeholder: d1ReadinessStatus.expected?.configured_id_is_placeholder === true,
          existing_database_reuse_allowed: false,
          remote_table_query_performed: false,
          candidate_deployment_observed: candidateObservedLive,
          candidate_deployment_id: liveTelemetryReadinessStatus?.candidate_worker?.deployment_id ?? null,
          candidate_version_id: liveTelemetryReadinessStatus?.candidate_worker?.version_id ?? null,
          candidate_security_contract: liveTelemetryReadinessStatus?.candidate_worker?.security_contract ?? null,
          candidate_security_contract_ok: candidateSecurityContractOk,
          candidate_deploy_required: liveTelemetryReadinessStatus?.candidate_worker?.deploy_required ?? null,
          observed_live_chain_ready_for_owner_evidence: liveTelemetryReadinessStatus?.decisions?.observed_live_chain_ready_for_owner_evidence === true,
          live_ingest_readiness_proven: liveTelemetryReadinessStatus?.decisions?.live_ingest_readiness_proven === true,
          weekly_aggregate_read_authorized: liveTelemetryReadinessStatus?.decisions?.weekly_aggregate_read_authorized === true
        }
      : null,
    current_live: liveSnapshot
      ? {
          snapshot_checked_at: liveSnapshot.checked_at,
          worker_name: liveSnapshot.worker_name,
          deployment_id: liveSnapshot.deployment?.id ?? null,
          version_id: liveSnapshot.deployed_version?.id ?? null,
          compatibility_date: liveSnapshot.deployed_version?.compatibility_date ?? null,
          false_success_state_present: liveSnapshot.contact?.false_success_state_present === true,
          line_only_mode_present: liveSnapshot.contact?.line_only_mode_present === true,
          collector_configured: liveSnapshot.growth_loop_status?.collector_configured === true
        }
      : null,
    gates,
    safe_review_commands: [
      `REVIEW_WORKTREE='${reviewWorktree}'`,
      `git -C \"$REVIEW_WORKTREE\" status --short --branch`,
      `git -C \"$REVIEW_WORKTREE\" log --oneline --decorate ${commit}..HEAD`,
      `git -C \"$REVIEW_WORKTREE\" diff --stat ${commit}..HEAD`,
      `git -C \"$REVIEW_WORKTREE\" diff ${commit}..HEAD -- ${branchPaths.join(" ")}`,
      `node --check \"$REVIEW_WORKTREE/${config.source_path}\"`,
      `cmp \"$REVIEW_WORKTREE/${config.source_path}\" ${path.join(ROOT, config.generated_worker)}`
    ],
    production_commands_after_owner_approval: {
      prerequisites: [
        "Confirm owner evidence for the observed collector Worker, D1 binding, and remote schema migration before treating telemetry as reliable; do not redeploy the existing collector unless its version is rejected.",
        `Confirm the existing ${config.collector_env} binding equals ${config.collector_public_url}; the deployment workflow fails closed if the exact plain-text binding or origin-pii-v2 health marker is missing and never rewrites bindings.`,
        "Confirm current live version and rollback target again immediately before deploy.",
        `Review and merge local branch ${localBranchStatus?.local_branch?.name ?? config.local_release_branch} at commit ${localBranchStatus?.local_branch?.commit ?? "<prepare-local-commit-first>"}; merge and production workflow dispatch remain owner-gated.`
      ],
      pre_deploy_read_only: [
        `${wrangler} deployments list --name ${config.production_worker_name} --json`,
        `${wrangler} versions view ${liveVersionId} --name ${config.production_worker_name} --json`,
        `curl -fsS ${config.live_base_url}/health`
      ],
      deploy_template_do_not_run_without_owner_approval: [
        `REVIEW_WORKTREE='${reviewWorktree}'`,
        `rg '\\$\\{api\\}/settings|\\$\\{api\\}/content|binding_fingerprint' \"$REVIEW_WORKTREE/${config.deployment_workflow_path}\"`,
        `gh workflow run deploy-3q-site.yml --repo ${config.source_repository} --ref main`
      ],
      post_deploy_read_only: [
        `curl -fsS ${config.live_base_url}/health | jq -e '.ok == true and .build == \"growth-loop-telemetry-v2\"'`,
        `curl -fsS ${config.live_base_url}/growth-loop/status | jq -e '.ok == true and .collector_configured == true and .collector_origin == \"${config.collector_public_url}\" and .collector_url_matches_expected == true and .build == \"growth-loop-telemetry-v2\"'`,
        `curl -fsS ${config.live_base_url}/contact | rg 'data-growth-contact-mode|data-growth-loop-telemetry|匿名瀏覽與 CTA 成效事件'`
      ]
    },
    rollback: {
      target_version_id: liveVersionId,
      command_requires_owner_approval: `${wrangler} rollback ${liveVersionId} --name ${config.production_worker_name} -m \"Rollback champion Growth Loop integration\"`,
      source_restore_reference: commit,
      note: "Re-read live deployments immediately before deploy. If the active version changed, regenerate this packet before using rollback."
    },
    external_effect: false,
    data_lp_events_write_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    public_link_change_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false
  };
}

function renderReport(status) {
  const rows = Object.entries(status.checks).map(([name, ok]) => `| ${name} | ${ok ? "pass" : "fail"} |`).join("\n");
  return `# Champion Release Preflight

  BLUF: ${status.ok ? "The source-locked patch applies cleanly in a fresh archive and passes syntax plus Wrangler dry-run." : "Release preflight failed."} Live collector state is observed separately; any missing provenance/schema evidence and all redeploys remain owner-gated. Production remains blocked.

- Generated: ${status.generated_at}
- Source commit: ${status.source.commit}
- Observed source ref: ${status.source.observed_ref_commit}
- Ref advanced without target-file drift: ${status.source.ref_advanced && status.source.ref_file_matches_lock ? "yes" : "no"}
- Source blob: ${status.source.blob_sha}
- Candidate SHA-256: ${status.candidate.generated_sha256}
- Patched source byte-identical: ${status.candidate.byte_identical_after_patch ? "yes" : "no"}
- Wrangler dry-run: ${status.worker_dry_run.ok ? "pass" : "fail"}
- Local feature commit: ${status.release_gates.find((gate) => gate.id === "review_champion_patch")?.status ?? "unknown"}
- D1 readiness: ${status.release_gates.find((gate) => gate.id === "provision_production_collector")?.status ?? "unknown"}
- Existing Candidate deployment observed: ${status.collector_readiness.candidate_deployment_observed ? "yes" : "no"}
- Candidate deploy required now: ${status.collector_readiness.candidate_deploy_required ? "yes" : "no"}
- Live ingest readiness proven: ${status.collector_readiness.live_ingest_readiness_proven ? "yes" : "no"}
- Source worktree changed: ${status.source_repo_write_performed ? "yes" : "no"}
- Production deploy performed: ${status.production_deploy_performed ? "yes" : "no"}

## Validation

| check | result |
|---|---|
${rows}

## Live Snapshot

- Present: ${status.live_snapshot.present ? "yes" : "no"}
- Checked: ${status.live_snapshot.checked_at ?? "not refreshed"}
- Active version: ${status.live_snapshot.deployed_version_id ?? "unknown"}
- Compatibility date: ${status.live_snapshot.compatibility_date ?? "unknown"}
- Contact repair live: ${status.live_snapshot.contact_repair_live ? "yes" : "no"}

## Human Gates

${status.release_gates.map((gate) => `- ${gate.id}: ${gate.status} - ${gate.reason}`).join("\n")}

## Review Artifacts

- Owner packet: champion_release_owner_packet.md
- Machine packet: champion_release_owner_packet.json
- Patch: ${status.candidate.patch}
- Candidate: ${status.candidate.worker}
- Integration smoke: champion_integration_smoke.md
- Live telemetry readiness: live_telemetry_readiness.md
`;
}

function renderOwnerPacket(packet) {
  return `# Champion Release Owner Packet

BLUF: The code path is locally verified. An existing collector may already be live; confirm its provenance and D1 schema evidence before considering any redeploy, then review the Champion patch and rollback target.

- Release: ${packet.release_id}
- Source: ${packet.source_lock.repository}@${packet.source_lock.commit}
- Patch: ${packet.candidate.patch}
- Candidate SHA-256: ${packet.candidate.sha256}
- Local feature branch: ${packet.local_branch?.name ?? "not prepared"}
- Local release head: ${packet.local_branch?.commit ?? "not prepared"}
- Worker commit: ${packet.local_branch?.worker_commit ?? "not prepared"}
- Workflow commit: ${packet.local_branch?.workflow_commit ?? "none"}
- Remote feature branch present: ${packet.local_branch?.remote_branch_observed === true ? "yes" : "no"}
- Remote state: ${packet.local_branch?.remote_state ?? "unknown"}
- Local commits ahead of remote: ${packet.local_branch?.local_ahead_count ?? "unknown"}
- Dedicated collector D1 present: ${packet.collector_readiness?.dedicated_database_present ? "yes" : "no"}
- Existing Candidate deployment observed: ${packet.collector_readiness?.candidate_deployment_observed ? "yes" : "no"}
- Candidate deploy required now: ${packet.collector_readiness?.candidate_deploy_required ? "yes" : "no"}
- Live ingest readiness proven: ${packet.collector_readiness?.live_ingest_readiness_proven ? "yes" : "no"}
- D1 inventory checked: ${packet.collector_readiness?.inventory_checked_at ?? "not checked"}
- Current live version: ${packet.current_live?.version_id ?? "refresh required"}
- Current live compatibility date: ${packet.current_live?.compatibility_date ?? "refresh required"}
- Production deploy performed: no

## Review Artifacts

- D1 schema contract: ${packet.review_artifacts.d1_schema_contract}
- D1 config guard: ${packet.review_artifacts.d1_config_guard}
- GitHub handoff: ${packet.review_artifacts.github_handoff}
- Draft PR body: ${packet.review_artifacts.github_pr_body}

## Gates

${packet.gates.map((gate) => `- [ ] ${gate.id} (${gate.risk_tier}): ${gate.status}\n  ${gate.reason}`).join("\n")}

## Safe Local Review

\`\`\`bash
${packet.safe_review_commands.join("\n")}
\`\`\`

## Production Command Template

Do not run this block until every T3 gate is explicitly approved and the collector HTTPS origin is verified.

\`\`\`bash
${packet.production_commands_after_owner_approval.deploy_template_do_not_run_without_owner_approval.join("\n")}
\`\`\`

## Post-Deploy Read-Only Checks

\`\`\`bash
${packet.production_commands_after_owner_approval.post_deploy_read_only.join("\n")}
\`\`\`

## Rollback

Rollback target: ${packet.rollback.target_version_id}

\`\`\`bash
${packet.rollback.command_requires_owner_approval}
\`\`\`

${packet.rollback.note}
`;
}

async function fileInventory(directory) {
  const files = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        const content = await readFile(absolute);
        const info = await stat(absolute);
        files.push({ path: path.relative(directory, absolute), bytes: info.size, sha256: sha256(content) });
      }
    }
  }
  await walk(directory);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function wranglerVersion() {
  const result = await command(WRANGLER_BIN, ["--version"], ROOT);
  return result.output.trim().split(/\s+/).at(-1) ?? null;
}

async function git(repoPath, args) {
  const result = await command("git", args, repoPath);
  assert(result.code === 0, `git ${args.join(" ")} failed: ${result.output}`);
  return result.output;
}

async function runRequired(bin, args, cwd, label) {
  const result = await command(bin, args, cwd);
  assert(result.code === 0, `${label} failed: ${result.output}`);
  return result;
}

async function command(bin, args, cwd) {
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, { cwd, maxBuffer: 20_000_000 });
    return { code: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    return { code: error.code ?? 1, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function gitBlobSha(value) {
  const content = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex");
}

function lines(value) {
  return value.split(/\r?\n/).filter(Boolean);
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function round(value, digits) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  const failed = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "clean_archive_champion_release_preflight_local_only",
    status: "release_preflight_failed",
    error: message,
    external_effect: false,
    data_lp_events_write_performed: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_read_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false
  };
  const failedOwnerPacket = {
    ok: false,
    generated_at: failed.generated_at,
    mode: "champion_release_owner_packet_review_only",
    status: "release_preflight_failed",
    error: message,
    gates: [
      {
        id: "approve_champion_production_deploy",
        risk_tier: "T3",
        status: "blocked_by_preflight_failure",
        reason: message,
      },
      {
        id: "approve_github_branch_push_or_pr",
        risk_tier: "T2",
        status: "blocked_by_preflight_failure",
        reason: message,
      },
    ],
    external_effect: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    public_link_change_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };
  await writeJson(STATUS_PATH, failed);
  await writeFile(REPORT_PATH, `# Champion Release Preflight\n\nBLUF: FAILED. Production deploy and GitHub release actions remain blocked.\n\n- Generated: ${failed.generated_at}\n- Error: ${message}\n- External effect: no\n`);
  await writeJson(OWNER_PACKET_JSON_PATH, failedOwnerPacket);
  await writeFile(OWNER_PACKET_MD_PATH, `# Champion Release Owner Packet\n\nBLUF: BLOCKED by release-preflight failure. Do not deploy, push, or open a PR from this packet.\n\n- Generated: ${failed.generated_at}\n- Error: ${message}\n- Production deploy performed: no\n- GitHub push or PR performed: no\n`);
  console.error(JSON.stringify(failed, null, 2));
  process.exitCode = 1;
});
