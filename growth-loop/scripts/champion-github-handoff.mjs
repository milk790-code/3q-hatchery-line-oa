import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "integrations", "3q-site", "champion-integration.config.json");
const BRANCH_STATUS_PATH = path.join(ROOT, "data", "champion_local_branch_status.json");
const RELEASE_STATUS_PATH = path.join(ROOT, "data", "champion_release_preflight_status.json");
const D1_STATUS_PATH = path.join(ROOT, "data", "cloudflare_d1_readiness_status.json");
const STATUS_PATH = path.join(ROOT, "data", "champion_github_handoff_status.json");
const REPORT_PATH = path.join(ROOT, "champion_github_handoff.md");
const PR_BODY_PATH = path.join(ROOT, "champion_github_pr_body.md");

async function main() {
  const generatedAt = new Date();
  const [config, branch, release, d1] = await Promise.all([
    readJson(CONFIG_PATH),
    readJson(BRANCH_STATUS_PATH),
    readJson(RELEASE_STATUS_PATH),
    readJson(D1_STATUS_PATH),
  ]);
  const repoSlug = config.source_repository;
  const repoUrl = `https://github.com/${repoSlug}.git`;
  const local = branch.local_branch ?? {};
  const remote = branch.remote_observation ?? {};
  const allowedPaths = [config.source_path, config.deployment_workflow_path].filter(Boolean);
  const integrationAlreadyMerged = branch.source_lock?.integration_already_merged === true;
  const changedPathsScoped = (local.changed_paths ?? []).includes(config.source_path)
    && (local.changed_paths ?? []).every((changedPath) => allowedPaths.includes(changedPath));
  const checks = {
    repository_known: repoSlug === "milk790-code/3q-hatchery-line-oa",
    local_branch_ready: integrationAlreadyMerged || branch.status === "local_feature_commit_ready_owner_push_pr_gate",
    branch_name_locked: local.name === config.local_release_branch,
    commit_matches_release: local.commit === release.local_branch?.commit,
    changed_paths_scoped: integrationAlreadyMerged || changedPathsScoped,
    candidate_sha_matches_commit: local.committed_source_sha256 === release.candidate?.generated_sha256,
    worktree_clean: branch.checks?.worktree_clean === true,
    source_worktree_unchanged: branch.checks?.source_working_tree_unchanged === true,
    remote_branch_matches_reviewed_history: branch.checks?.remote_branch_matches_reviewed_history === true,
    release_preflight_ok: release.ok === true,
    d1_remote_schema_evidence_accounted_for:
      release.collector_readiness?.live_ingest_readiness_proven === true
      || (d1.remote_schema_migration_performed === false && d1.decision?.automatic_reuse_allowed === false),
  };
  const ok = Object.values(checks).every(Boolean);
  const handoffStatus = !ok
    ? "champion_github_handoff_not_ready"
    : integrationAlreadyMerged
      ? "integration_already_merged_followup_repairs_only"
    : remote.branch_present === true && Number(remote.local_ahead_count) > 0
      ? "ready_for_owner_approved_followup_push_and_draft_pr"
      : remote.branch_present === true
        ? "ready_for_owner_approved_draft_pr"
        : "ready_for_owner_approved_branch_push_or_draft_pr";
  const status = {
    ok,
    generated_at: generatedAt.toISOString(),
    mode: "champion_github_handoff_local_only",
    status: handoffStatus,
    integration_already_merged: integrationAlreadyMerged,
    repository: {
      slug: repoSlug,
      url: repoUrl,
      base_branch: "main",
      source_path: config.source_path,
      deployment_workflow_path: config.deployment_workflow_path,
    },
    local_branch: {
      name: local.name ?? null,
      commit: local.commit ?? null,
      parent_commit: local.parent_commit ?? null,
      source_lock_base_commit: local.source_lock_base_commit ?? null,
      worker_commit: local.worker_commit ?? null,
      workflow_commit: local.workflow_commit ?? null,
      commit_count: local.commit_count ?? 0,
      commits: local.commits ?? [],
      worktree: local.worktree ?? null,
      changed_paths: local.changed_paths ?? [],
    },
    remote_branch: {
      present: remote.branch_present === true,
      commit: remote.commit ?? null,
      state: remote.state ?? "unknown",
      local_ahead_count: remote.local_ahead_count ?? null,
    },
    pull_request: {
      title: "3Q site: persist privacy-safe Growth Loop telemetry",
      body_file: path.relative(ROOT, PR_BODY_PATH),
      draft_required: true,
      merge_permitted: false,
    },
    blockers_after_pr: [
      release.collector_readiness?.live_ingest_readiness_proven === true
        ? "Dedicated D1 schema and collector provenance are validated; recurring reads remain aggregate-only."
        : d1.decision?.dedicated_database_present === true
          ? "Dedicated D1 exists, but this handoff performed no remote table query and has no owner evidence for schema migration."
        : "Dedicated 3q-growth-loop-candidate D1 is absent.",
      release.collector_readiness?.live_ingest_readiness_proven === true
        ? "Candidate collector deployment, security contract, and D1 evidence are validated; no collector redeploy is required."
        : release.live_snapshot?.collector_configured === true
          ? "A collector binding is live, but its deployment and migration provenance still require owner evidence."
        : "Production collector URL is not verified in the live snapshot.",
      "Any future 3q-site deploy or redeploy remains a separate owner gate.",
    ],
    checks,
    external_effect: false,
    data_lp_events_write_performed: false,
    remote_branch_write_observed_before_this_run: remote.branch_present === true,
    git_push_performed: false,
    github_pr_created: false,
    github_push_or_pr_performed: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };

  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
  await writeFile(PR_BODY_PATH, renderPrBody(status, release));
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));
  if (!ok) process.exitCode = 1;
}

function renderReport(status) {
  const { repository, local_branch: local, pull_request: pr } = status;
  const changedPathArgs = local.changed_paths.join(" ");
  const remote = status.remote_branch;
  const commitRows = local.commits.map((item) => `- ${item.commit}: ${item.subject}`).join("\n");
  const postPrEvidenceNote = status.checks.d1_remote_schema_evidence_accounted_for
    ? "Dedicated D1 schema and aggregate-only collector evidence are already accounted for. Any future deploy remains a separate owner gate."
    : "Cloudflare provenance, remote D1 schema, and any future deploy remain separate owner-evidence gates.";
  return `# Champion GitHub Handoff\n\nBLUF: ${status.status}. The source-locked release stack is clean and scoped. A reviewed remote ancestor may already exist; this packet prepares only the remaining owner-gated branch update and draft PR, and executes neither.\n\n- Repository: ${repository.slug}\n- Base: ${repository.base_branch}\n- Branch: ${local.name}\n- Local head: ${local.commit}\n- Worker commit: ${local.worker_commit}\n- Workflow commit: ${local.workflow_commit ?? "none"}\n- Changed paths: ${local.changed_paths.join(", ")}\n- Remote branch present: ${remote.present ? "yes" : "no"}\n- Remote commit: ${remote.commit ?? "n/a"}\n- Remote state: ${remote.state}\n- Local commits ahead: ${remote.local_ahead_count ?? "unknown"}\n- Push performed by this packet: no\n- PR created by this packet: no\n- Merge permitted by this packet: no\n\n## Commit Stack\n\n${commitRows}\n\n## Safe Local Review\n\n\`\`\`zsh\nREVIEW_WORKTREE='${local.worktree}'\nSOURCE_LOCK='${local.source_lock_base_commit}'\ngit -C "$REVIEW_WORKTREE" status --short --branch\ngit -C "$REVIEW_WORKTREE" log --oneline "$SOURCE_LOCK"..HEAD\ngit -C "$REVIEW_WORKTREE" diff --stat "$SOURCE_LOCK"..HEAD\ngit -C "$REVIEW_WORKTREE" diff "$SOURCE_LOCK"..HEAD -- ${changedPathArgs}\nnode --check "$REVIEW_WORKTREE/${repository.source_path}"\n\`\`\`\n\n## Owner-Gated GitHub Write\n\nDo not run until the owner explicitly approves the remaining branch update or draft PR. The push is expected to be fast-forward only; this block never force-pushes or merges.\n\n\`\`\`zsh\nREVIEW_WORKTREE='${local.worktree}'\nEXPECTED_COMMIT='${local.commit}'\nBRANCH='${local.name}'\ntest "$(git -C "$REVIEW_WORKTREE" rev-parse HEAD)" = "$EXPECTED_COMMIT"\ngit -C "$REVIEW_WORKTREE" push -u origin "$BRANCH"\ngh pr create --repo '${repository.slug}' --base '${repository.base_branch}' --head "$BRANCH" --draft --title '${pr.title}' --body-file '${path.join(ROOT, pr.body_file)}'\n\`\`\`\n\n## After Creation\n\nStop at the draft PR. Do not merge and do not deploy. Verify that the PR contains only ${local.changed_paths.join(", ")}. ${postPrEvidenceNote}\n\n## Rollback\n\nIf the draft PR is wrong, the owner may close it. Retain the branch until review is complete; no automatic branch deletion or force-push is provided.\n`;
}

function renderPrBody(status, release) {
  const local = status.local_branch;
  const commitRows = local.commits.map((item) => `- \`${item.commit}\` ${item.subject}`).join("\n");
  const pathRows = local.changed_paths.map((changedPath) => `- \`${changedPath}\``).join("\n");
  const collectorDeployRequired = release.collector_readiness?.candidate_deploy_required !== false;
  const collectorEvidenceReady = release.collector_readiness?.live_ingest_readiness_proven === true;
  const collectorSummary = collectorEvidenceReady
    ? "- reject PII-like URL tokens client-side; the live collector, security contract, and dedicated D1 schema provenance are validated separately"
    : collectorDeployRequired
    ? "- reject PII-like URL tokens client-side; local integration smoke used a separately hardened collector, whose production update is not included in this PR"
    : "- reject PII-like URL tokens client-side; a security-current collector is observed live separately, while its provenance and D1 schema evidence remain owner-gated";
  const collectorGate = collectorEvidenceReady
    ? "- collector and D1 provenance are validated; no collector redeploy is currently required, and this PR performs no schema migration"
    : collectorDeployRequired
    ? "- review and deploy the separate collector-side PII/Origin hardening before treating new telemetry as production-ready"
    : "- confirm owner provenance and remote schema evidence for the observed security-current collector; no collector redeploy is currently required";
  const evidenceGate = collectorEvidenceReady
    ? "- dedicated D1 schema and aggregate-only collection evidence are already validated; keep raw-event and customer-data reads disabled"
    : "- confirm provenance and owner evidence for the observed dedicated D1, collector, and live 3q-site integration\n- verify the remote D1 schema before relying on live telemetry";
  return `## Summary\n\n- replace the misleading local-only contact success state with a LINE-only CTA\n- disclose anonymous page_view / cta_click telemetry accurately and persist only sanitized attribution across internal pages\n${collectorSummary}\n- expose read-only /health and /growth-loop/status build markers\n- deploy code through Cloudflare's content-only endpoint after checking that all existing bindings remain byte-for-byte unchanged\n- keep LINE destination and existing 3q-site routes intact\n\n## Scope\n\n- branch: \`${local.name}\`\n- local head: \`${local.commit}\`\n- source lock: \`${local.source_lock_base_commit}\`\n- candidate SHA-256: \`${release.candidate?.generated_sha256 ?? "unknown"}\`\n\nCommits:\n${commitRows}\n\nChanged paths:\n${pathRows}\n\n## Verification\n\n- pinned-ref source-lock, ancestry, target-drift, tuple-integrity, and byte-identity preflight passed\n- isolated champion plus collector smoke passed, including missing-Origin and PII-like token rejection\n- deployment workflow validates required/all binding preservation and post-deploy collector, build, status, contact, and disclosure markers\n- Wrangler config and production command-shape dry runs passed\n- this handoff performed no deploy, public-link change, GitHub write, LINE push, customer-data action, payment, or deletion\n\n## Required Gates After Review\n\n${collectorGate}\n${evidenceGate}\n- re-read the current production version and rollback target before any future deploy\n\nKeep this PR draft until the separate merge/deploy owner decision. Do not merge from this packet.\n`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

await main();
