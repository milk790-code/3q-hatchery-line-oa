#!/usr/bin/env node
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { previewColdOutreachCandidate } from '../lib/cold-outreach.mjs';
import { previewGoogleBusinessProspectingCandidate } from '../lib/google-business-prospector.mjs';
import { gitWorktreeFingerprint } from './lib/git-worktree-fingerprint.mjs';

const automationId = process.env.LOOPS_AUTOMATION_ID || 'loops-24';
const repoRoot = path.resolve(process.env.LOOPS_REPO_ROOT || process.cwd());
const runId = randomUUID();
const startedAt = new Date();
const lockTtlMs = minutes(process.env.LOOPS_LOCK_TTL_MINUTES || 55);
const maxCandidates = Number.parseInt(process.env.LOOPS_MAX_CANDIDATES || '8', 10);
const defaultSocialPublisherUrl = 'https://3q-social-publisher.milk790.workers.dev';
const argv = new Set(process.argv.slice(2));
const autoCompleteEnabled = !argv.has('--report-only')
  && (argv.has('--auto-complete') || truthy(process.env.LOOPS_AUTO_COMPLETE));
const onlySafeLocal = argv.has('--only-safe-local') || truthy(process.env.LOOPS_ONLY_SAFE_LOCAL);
const blockerEscalateHours = Number.parseFloat(process.env.LOOPS_BLOCKER_ESCALATE_HOURS || '24');

const codexHome = process.env.CODEX_HOME
  || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.codex') : path.join(os.homedir(), '.codex'));

const stateDir = path.resolve(
  process.env.LOOPS_STATE_DIR || path.join(codexHome, 'automations', automationId)
);

const runsDir = path.join(stateDir, 'runs');
const statePath = path.join(stateDir, 'state.json');
const lockPath = path.join(stateDir, 'lock.json');
const taskRegistryFiles = [
  { id: 'fleet', path: path.join(repoRoot, 'scripts', 'loops.tasks.json') },
  { id: 'cold-outreach', path: path.join(repoRoot, 'scripts', 'loops.cold-outreach.tasks.json') },
];

const lanePriority = {
  revenue: 5,
  deployment: 4,
  'outreach-draft': 3,
  'demo-sales': 2,
  'repo-hygiene': 1,
};

const manualRedLines = [
  'No git push, PR creation, merge, deploy, production setting change, or permission change.',
  'No LINE, IG, email, public post, or bulk outbound send.',
  'No secret, token, password, customer PII, or financial-account value written to reports.',
  'No deletion or irreversible external mutation.',
];

async function main() {
  await fs.mkdir(runsDir, { recursive: true });

  const lock = await acquireLock();
  if (!lock.acquired) {
    const standby = {
      runId,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      status: 'standby',
      reason: 'lock-held',
      lockOwner: lock.owner || null,
    };
    await appendRunToState(standby, []);
    console.log(JSON.stringify(standby, null, 2));
    return;
  }

  let result;
  let candidates = [];
  let autoCompletions = [];

  try {
    const previousState = await readJson(statePath, defaultState());
    const taskRegistry = await loadTaskRegistry();
    const ctx = { previousState };

    candidates = [
      ...(await discoverProjectState(ctx)),
      ...(await discoverWakeupHealth(ctx)),
      ...(await discoverConnectorHealth(ctx)),
      ...(await discoverInvestorPacket(ctx)),
      ...(await discoverGitState(ctx)),
      ...(await discoverGithubPublication(ctx)),
      ...(await discoverPrReadiness(ctx)),
      ...(await discoverFrontendArtifacts(ctx)),
      ...(await discoverWranglerCacheRisk(ctx)),
      ...(await discoverGoogleBusinessProspecting(ctx)),
      ...(await discoverColdOutreach(ctx)),
      ...(await discoverSocialPublisher(ctx)),
      ...(await discoverContentQueue(ctx)),
      ...(await discoverWebhookCron(ctx)),
    ];

    const scored = scoreCandidates(candidates, previousState)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCandidates);

    if (autoCompleteEnabled) {
      autoCompletions = await runAutoCompletions(scored);
    }
    const dirtyRefresh = await ensureDirtyClassificationCurrent();
    if (dirtyRefresh) autoCompletions = [...autoCompletions, dirtyRefresh];

    result = {
      runId,
      automationId,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      status: 'success',
      repoRoot,
      stateDir,
      onlySafeLocal,
      candidateCount: candidates.length,
      selectedCount: scored.length,
      topCandidate: scored[0] ? summarizeCandidate(scored[0]) : null,
      autoComplete: summarizeAutoCompletions(autoCompletions),
      loopos: buildLooposSummary(scored, autoCompletions, taskRegistry),
    };

    await writeReport(result, scored, autoCompletions);
    await writeDashboard(result, scored, autoCompletions);
    const postDashboardAutoCompletions = await runPostDashboardAutoCompletions(scored, autoCompletions, result, taskRegistry);
    if (postDashboardAutoCompletions !== autoCompletions) {
      autoCompletions = postDashboardAutoCompletions;
      refreshResultSummaries(result, scored, autoCompletions, taskRegistry);
      await writeReport(result, scored, autoCompletions);
      await writeDashboard(result, scored, autoCompletions);
    }
    await appendRunToState(result, scored, autoCompletions);
    console.log(JSON.stringify({
      ...result,
      selected: scored.map(summarizeCandidate),
      autoCompletions: autoCompletions.map(summarizeCompletion),
    }, null, 2));
  } catch (error) {
    result = {
      runId,
      automationId,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      status: 'failed',
      repoRoot,
      stateDir,
      onlySafeLocal,
      error: error && error.stack ? error.stack : String(error),
    };
    await appendRunToState(result, candidates);
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  } finally {
    await releaseLock(lock.token);
  }
}

async function discoverProjectState() {
  const file = path.join(repoRoot, 'PROJECT-STATE.md');
  const content = await readText(file);
  if (!content) return [];

  const trimmed = content.trim();
  const decoded = maybeDecodeBase64(trimmed);
  if (decoded && decoded.trimStart().startsWith('#')) {
    return [{
      type: 'repo_documentation',
      id: 'project-state-base64',
      title: 'Normalize PROJECT-STATE.md encoding',
      value: 0.86,
      urgency: 0.55,
      loopability: 0.9,
      freshness: 0.4,
      risk: 0.15,
      action: 'Decode PROJECT-STATE.md into readable Markdown after confirming no user-owned staged edit depends on the encoded form.',
      evidence: {
        file: relative(file),
        currentPrefix: trimmed.slice(0, 24),
        decodedPrefix: decoded.trim().slice(0, 60),
      },
    }];
  }

  return [];
}

async function discoverWakeupHealth() {
  const latest = await readJson(path.join(stateDir, 'wakeup-health', 'latest.json'), null);
  const generatedAtMs = Date.parse(latest?.generatedAt || '');
  const nextRunAtMs = Date.parse(latest?.scheduledTask?.nextRunTime || '');
  const reportFreshMinutes = firstPositiveNumber(
    process.env.LOOPS_WAKEUP_REPORT_FRESH_MINUTES,
    latest?.reportFreshMinutes,
    65
  );
  const freshUntil = Number.isFinite(generatedAtMs)
    ? new Date(generatedAtMs + reportFreshMinutes * 60_000).toISOString()
    : null;
  const nextRunGraceMinutes = Number.parseFloat(process.env.LOOPS_WAKEUP_NEXT_RUN_GRACE_MINUTES || '5');
  const ageMinutes = Number.isFinite(generatedAtMs)
    ? Math.max(0, (Date.now() - generatedAtMs) / 60_000)
    : null;
  const nextRunAgeMinutes = Number.isFinite(nextRunAtMs)
    ? (Date.now() - nextRunAtMs) / 60_000
    : null;
  const scheduleEvidenceStale = latest?.scheduledTask?.platform === 'win32'
    && latest?.scheduledTask?.found === true
    && nextRunAgeMinutes !== null
    && nextRunAgeMinutes > nextRunGraceMinutes;
  const fresh = ageMinutes !== null && ageMinutes <= reportFreshMinutes && !scheduleEvidenceStale;
  const unhealthy = latest?.health?.ok === false;
  const id = unhealthy ? 'wakeup-health-attention' : (fresh ? 'wakeup-health-ready' : 'wakeup-health-needed');

  return [{
    type: 'wakeup_health',
    id,
    title: unhealthy
      ? 'Inspect LOOPS wakeup health warning'
      : (fresh ? 'Review LOOPS wakeup health' : (scheduleEvidenceStale ? 'Refresh LOOPS wakeup health after scheduled run' : 'Check LOOPS wakeup health')),
    value: unhealthy ? 0.82 : (fresh ? 0.28 : (scheduleEvidenceStale ? 0.62 : 0.52)),
    urgency: unhealthy ? 0.78 : (fresh ? 0.22 : (scheduleEvidenceStale ? 0.58 : 0.48)),
    loopability: 0.86,
    freshness: fresh ? 0.72 : 0.42,
    risk: 0.08,
    action: unhealthy
      ? 'Review the latest wakeup health report before relying on hourly automation.'
      : (fresh
          ? 'Use the latest wakeup health report as the current local heartbeat evidence.'
          : (scheduleEvidenceStale
              ? 'Refresh the wakeup health report because its recorded Task Scheduler nextRunTime has already passed.'
              : 'Generate a local wakeup health report covering Task Scheduler, locks, and recent LOOPS runs.')),
    fingerprintSeed: latest
      ? `${latest.statusFingerprint || ''}:${latest.generatedAt || ''}:${latest.health?.ok}:${scheduleEvidenceStale}`
      : 'missing-wakeup-health',
    evidence: {
      reportPath: latest?.reportPath || null,
      generatedAt: latest?.generatedAt || null,
      reportFreshMinutes,
      freshUntil,
      ageMinutes: ageMinutes === null ? null : Math.round(ageMinutes * 10) / 10,
      scheduleEvidenceStale,
      nextRunAgeMinutes: nextRunAgeMinutes === null ? null : Math.round(nextRunAgeMinutes * 10) / 10,
      nextRunGraceMinutes,
      health: latest?.health || null,
      scheduledTask: latest?.scheduledTask
          ? {
            found: latest.scheduledTask.found,
            state: latest.scheduledTask.state,
            lastTaskResult: latest.scheduledTask.lastTaskResult,
            nextRunTime: latest.scheduledTask.nextRunTime,
            wakeToRun: latest.scheduledTask.wakeToRun,
            executionTimeLimit: latest.scheduledTask.executionTimeLimit,
          }
        : null,
    },
  }];
}

async function discoverConnectorHealth() {
  const latest = await readJson(path.join(stateDir, 'connector-health', 'latest.json'), null);
  const generatedAtMs = Date.parse(latest?.generatedAt || '');
  const ageMinutes = Number.isFinite(generatedAtMs)
    ? Math.max(0, (Date.now() - generatedAtMs) / 60_000)
    : null;
  const maxAgeMinutes = Number.parseFloat(process.env.LOOPS_CONNECTOR_HEALTH_FRESH_MINUTES || '65');
  const fresh = ageMinutes !== null && ageMinutes <= maxAgeMinutes;
  const attentionCount = Number(latest?.summary?.attentionCount || 0);
  const failedCount = Number(latest?.summary?.failedCount || 0);
  const missingCount = Number(latest?.summary?.missingCount || 0);
  const authUnverifiedCount = Number(latest?.summary?.authUnverifiedCount || 0);
  const needsAttention = attentionCount > 0 || failedCount > 0 || missingCount > 0;
  const id = !latest
    ? 'connector-health-needed'
    : (!fresh ? 'connector-health-stale' : (needsAttention ? 'connector-health-attention' : 'connector-health-ready'));

  return [{
    type: 'connector_health',
    id,
    title: !latest
      ? 'Create connector health report'
      : (!fresh ? 'Refresh connector health report' : (needsAttention ? 'Review connector auth attention' : 'Review connector health')),
    value: needsAttention ? 0.78 : (!fresh ? 0.58 : 0.26),
    urgency: needsAttention ? 0.7 : (!fresh ? 0.46 : 0.2),
    loopability: 0.9,
    freshness: fresh ? 0.8 : 0.35,
    risk: 0.08,
    manualGate: needsAttention ? 'manual_secret_input' : 'none_read_only',
    action: needsAttention
      ? 'Review the connector health artifact and re-auth or add local secrets only where the report marks missing, failed, expired, or timed out.'
      : 'Use the connector health artifact to confirm which integrations are ready, skipped, or app-auth-unverified.',
    fingerprintSeed: latest?.statusFingerprint || 'missing-connector-health',
    evidence: {
      reportPath: latest?.reportPath || null,
      generatedAt: latest?.generatedAt || null,
      ageMinutes: ageMinutes === null ? null : Math.round(ageMinutes * 10) / 10,
      maxAgeMinutes,
      onlySafeLocal: latest?.onlySafeLocal ?? null,
      summary: latest?.summary || null,
      authUnverifiedCount,
    },
  }];
}

async function discoverInvestorPacket() {
  const untracked = runCommand('git', ['ls-files', '--others', '--exclude-standard', 'investor-packet'], 45_000);
  const ignored = runCommand('git', ['ls-files', '--others', '--ignored', '--exclude-standard', 'investor-packet'], 45_000);
  const paths = [...new Set([
    ...(untracked.ok ? untracked.stdout.split(/\r?\n/).filter(Boolean) : []),
    ...(ignored.ok ? ignored.stdout.split(/\r?\n/).filter(Boolean) : []),
  ])].sort();

  if (!paths.length) return [];

  const sendReadyCount = paths.filter(item => item.includes('/SEND_READY/')).length;
  const pdfCount = paths.filter(item => /\.pdf$/i.test(item)).length;
  const emlCount = paths.filter(item => /\.eml$/i.test(item)).length;
  const scriptCount = paths.filter(item => /\.ps1$/i.test(item)).length;

  return [{
    type: 'investor_packet',
    lane: 'demo-sales',
    id: 'investor-packet-review',
    title: 'Review local investor packet',
    value: 0.52,
    urgency: sendReadyCount ? 0.62 : 0.42,
    loopability: 0.48,
    freshness: 0.78,
    risk: 0.42,
    manualGate: 'manual_investor_review',
    expectedArtifact: 'investor-review packet handoff',
    dedupPolicy: 'filesystem packet fingerprint; never send or publish automatically',
    fingerprintSeed: paths.join('\n'),
    action: 'Review the local investor packet before any staging, sharing, sending, publishing, or GitHub publication decision. Keep send-ready files manual-only.',
    evidence: {
      root: 'investor-packet/',
      pathCount: paths.length,
      sendReadyCount,
      pdfCount,
      emlCount,
      scriptCount,
      firstFiles: paths.slice(0, 12),
      ignoredByGit: ignored.ok && ignored.stdout.trim().length > 0,
    },
  }];
}

async function discoverGitState() {
  const status = runCommand('git', ['status', '--short'], 45_000);
  if (!status.ok) {
    return [{
      type: 'repo_health',
      id: 'git-status-failed',
      title: 'Git status check failed',
      value: 0.65,
      urgency: 0.45,
      loopability: 0.7,
      freshness: 0.7,
      risk: 0.1,
      action: 'Inspect git availability or repository health before deploy-oriented work.',
      evidence: { stderr: trim(status.stderr, 500), status: status.status },
    }];
  }

  const lines = status.stdout.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const statusFingerprint = gitWorktreeFingerprint({ cwd: repoRoot, statusLines: lines });
  const latestSnapshot = await readJson(path.join(stateDir, 'worktree-snapshots', 'latest.json'), null);
  const snapshotCurrent = latestSnapshot?.statusFingerprint === statusFingerprint;
  const latestBoundaryPlan = await readJson(path.join(stateDir, 'commit-boundaries', 'latest.json'), null);
  const boundaryPlanCurrent = latestBoundaryPlan?.statusFingerprint === statusFingerprint;
  const latestSliceHandoff = await readJson(path.join(stateDir, 'slice-handoffs', 'loops_control_plane-latest.json'), null);
  const sliceHandoffCurrent = latestSliceHandoff?.statusFingerprint === statusFingerprint;
  const latestFrontendReview = await readJson(path.join(stateDir, 'frontend-artifact-reviews', 'latest.json'), null);
  const frontendReviewCurrent = latestFrontendReview?.statusFingerprint === statusFingerprint;
  const latestWorkerDeployReview = await readJson(path.join(stateDir, 'worker-deploy-reviews', 'latest.json'), null);
  const workerDeployReviewCurrent = latestWorkerDeployReview?.statusFingerprint === statusFingerprint;
  const latestDirtyClassification = await readJson(path.join(stateDir, 'dirty-worktree', 'latest.json'), null);
  const dirtyClassificationCurrent = latestDirtyClassification?.statusFingerprint === statusFingerprint;

  const counts = {
    staged: lines.filter(line => line[0] && line[0] !== ' ' && line[0] !== '?').length,
    modified: lines.filter(line => line[1] && line[1] !== ' ').length,
    untracked: lines.filter(line => line.startsWith('??')).length,
    total: lines.length,
  };

  let title = 'Snapshot dirty worktree before deploy';
  let value = 0.78;
  let urgency = 0.7;
  let loopability = 0.85;
  let action = 'Create a compact handoff of changed files and avoid mixing LOOPS edits into existing staged work.';
  if (sliceHandoffCurrent) {
    title = 'Review LOOPS slice handoff';
    value = 0.34;
    urgency = 0.24;
    loopability = 0.56;
    action = 'Review the LOOPS control-plane stage script, commit message, and PR draft before touching git staging.';
  } else if (boundaryPlanCurrent) {
    title = 'Review commit boundary plan';
    value = 0.38;
    urgency = 0.28;
    loopability = 0.6;
    action = 'Use the latest commit boundary plan before staging, committing, or deploy approval.';
  } else if (snapshotCurrent) {
    title = 'Plan commit boundaries before deploy';
    value = 0.5;
    urgency = 0.36;
    loopability = 0.72;
    action = 'Create a commit boundary plan so LOOPS, Worker deploy changes, content assets, and broad frontend payloads stay separate.';
  }

  return [{
    type: 'repo_health',
    id: 'dirty-worktree',
    title,
    value,
    urgency,
    loopability,
    freshness: 0.7,
    risk: 0.25,
    fingerprintSeed: lines.join('\n'),
    action,
    evidence: {
      counts,
      firstFiles: lines.slice(0, 12),
      statusFingerprint,
      snapshotPath: snapshotCurrent ? latestSnapshot.reportPath : null,
      boundaryPlanPath: boundaryPlanCurrent ? latestBoundaryPlan.reportPath : null,
      sliceHandoffPath: sliceHandoffCurrent ? latestSliceHandoff.reportPath : null,
      sliceStageScriptPath: sliceHandoffCurrent ? latestSliceHandoff.stageScriptPath : null,
      boundaryGroups: boundaryPlanCurrent ? latestBoundaryPlan.groups?.map(group => ({
        id: group.id,
        gate: group.gate,
        total: group.counts?.total || 0,
      })) : null,
      frontendReviewPath: frontendReviewCurrent ? latestFrontendReview.reportPath : null,
      workerDeployReviewPath: workerDeployReviewCurrent ? latestWorkerDeployReview.reportPath : null,
      dirtyClassificationPath: dirtyClassificationCurrent ? latestDirtyClassification.reportPath : null,
      dirtyClassificationSummary: dirtyClassificationCurrent ? latestDirtyClassification.summary : null,
    },
  }];
}

async function discoverGithubPublication() {
  const branch = runCommand('git', ['branch', '--show-current'], 45_000);
  const upstream = runCommand('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], 45_000);
  if (!branch.ok || !branch.stdout.trim() || !upstream.ok || !upstream.stdout.trim()) {
    return [];
  }

  const branchName = branch.stdout.trim();
  const upstreamName = upstream.stdout.trim();
  const counts = runCommand('git', ['rev-list', '--left-right', '--count', `${upstreamName}...HEAD`], 45_000);
  if (!counts.ok) return [];

  const [behindRaw, aheadRaw] = counts.stdout.trim().split(/\s+/);
  const behind = Number.parseInt(behindRaw || '0', 10);
  const ahead = Number.parseInt(aheadRaw || '0', 10);
  if (!Number.isFinite(ahead) || ahead <= 0) return [];

  const status = runCommand('git', ['status', '--short', '--untracked-files=no'], 45_000);
  const head = runCommand('git', ['rev-parse', '--short', 'HEAD'], 45_000);
  const statusLines = status.ok ? status.stdout.split(/\r?\n/).filter(Boolean) : [];
  const statusFingerprint = gitWorktreeFingerprint({ cwd: repoRoot, statusLines });
  const latest = await readJson(path.join(stateDir, 'github-handoffs', 'latest.json'), null);
  const current = latest?.branch === branchName
    && latest?.upstream === upstreamName
    && latest?.ahead === ahead
    && latest?.head === (head.ok ? head.stdout.trim() : '')
    && latest?.statusFingerprint === statusFingerprint;

  return [{
    type: 'github_publication',
    id: current ? 'github-local-pr-handoff-ready' : 'github-local-pr-handoff-needed',
    title: current ? 'Review GitHub local PR handoff' : 'Prepare GitHub local PR handoff',
    value: current ? 0.28 : 0.46,
    urgency: current ? 0.22 : 0.36,
    loopability: current ? 0.45 : 0.72,
    freshness: 0.7,
    risk: 0.42,
    action: current
      ? 'Review the generated GitHub handoff before push or draft PR creation.'
      : 'Generate a local GitHub handoff for the ahead branch; do not push or create a PR automatically.',
    fingerprintSeed: `${branchName}:${upstreamName}:${ahead}:${head.ok ? head.stdout.trim() : ''}:${statusFingerprint}`,
    evidence: {
      branch: branchName,
      upstream: upstreamName,
      ahead,
      behind,
      head: head.ok ? head.stdout.trim() : null,
      statusFingerprint,
      dirtyTracked: statusLines,
      handoffPath: current ? latest.reportPath : null,
      gate: 'push-and-pr-approval',
    },
  }];
}

async function discoverPrReadiness() {
  const github = await readJson(path.join(stateDir, 'github-handoffs', 'latest.json'), null);
  if (!github) return [];

  const branch = runCommand('git', ['branch', '--show-current'], 45_000);
  const upstream = runCommand('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], 45_000);
  const head = runCommand('git', ['rev-parse', '--short', 'HEAD'], 45_000);
  if (!branch.ok || !upstream.ok || !head.ok) return [];

  const branchName = branch.stdout.trim();
  const upstreamName = upstream.stdout.trim();
  const counts = runCommand('git', ['rev-list', '--left-right', '--count', `${upstreamName}...HEAD`], 45_000);
  if (!counts.ok) return [];
  const [behindRaw, aheadRaw] = counts.stdout.trim().split(/\s+/);
  const behind = Number.parseInt(behindRaw || '0', 10);
  const ahead = Number.parseInt(aheadRaw || '0', 10);
  if (!Number.isFinite(ahead) || ahead <= 0) return [];

  const status = runCommand('git', ['status', '--short', '--untracked-files=no'], 45_000);
  const statusLines = status.ok ? status.stdout.split(/\r?\n/).filter(Boolean) : [];
  const statusFingerprint = gitWorktreeFingerprint({ cwd: repoRoot, statusLines });
  const githubCurrent = github.branch === branchName
    && github.upstream === upstreamName
    && github.head === head.stdout.trim()
    && github.ahead === ahead
    && github.behind === behind
    && github.statusFingerprint === statusFingerprint;
  if (!githubCurrent) return [];

  const latest = await readJson(path.join(stateDir, 'pr-readiness', 'latest.json'), null);
  const current = latest?.branch === branchName
    && latest?.upstream === upstreamName
    && latest?.head === head.stdout.trim()
    && latest?.ahead === ahead
    && latest?.behind === behind
    && latest?.statusFingerprint === statusFingerprint;

  return [{
    type: 'github_publication',
    id: current ? 'pr-readiness-ready' : 'pr-readiness-needed',
    title: current ? 'Review PR readiness packet' : 'Prepare PR readiness packet',
    value: current ? 0.3 : 0.44,
    urgency: current ? 0.24 : 0.36,
    loopability: current ? 0.52 : 0.74,
    freshness: 0.7,
    risk: 0.18,
    action: current
      ? 'Review the PR readiness packet before explicit push or draft PR approval.'
      : 'Generate a local PR readiness packet that aggregates handoff evidence and manual gates; do not push or create a PR.',
    fingerprintSeed: `${branchName}:${upstreamName}:${ahead}:${head.stdout.trim()}:${statusFingerprint}:${latest?.readinessFingerprint || ''}`,
    evidence: {
      branch: branchName,
      upstream: upstreamName,
      ahead,
      behind,
      head: head.stdout.trim(),
      statusFingerprint,
      githubHandoffPath: github.reportPath,
      readinessPath: current ? latest.reportPath : null,
      readyForApproval: current ? latest.summary?.readyForApproval : null,
      gate: 'push-and-pr-approval',
    },
  }];
}

async function discoverFrontendArtifacts() {
  const status = runCommand('git', ['status', '--short'], 45_000);
  if (!status.ok) return [];

  const statusLines = status.stdout.split(/\r?\n/).filter(Boolean);
  const statusFingerprint = gitWorktreeFingerprint({ cwd: repoRoot, statusLines });
  const boundary = await readJson(path.join(stateDir, 'commit-boundaries', 'latest.json'), null);
  if (boundary?.statusFingerprint !== statusFingerprint) return [];

  const group = (boundary.groups || []).find(item => item.id === 'frontend_artifacts');
  if (!group) return [];

  const groupFingerprint = hash((group.paths || []).slice().sort().join('\n'));
  const latestReview = await readJson(path.join(stateDir, 'frontend-artifact-reviews', 'latest.json'), null);
  const reviewCurrent = latestReview?.statusFingerprint === statusFingerprint
    && latestReview?.groupFingerprint === groupFingerprint;
  const latestHandoff = await readJson(path.join(stateDir, 'frontend-slice-handoffs', 'latest.json'), null);
  const handoffCurrent = latestHandoff?.statusFingerprint === statusFingerprint
    && latestHandoff?.groupFingerprint === groupFingerprint;

  return [{
    type: 'repo_health',
    id: handoffCurrent
      ? 'frontend-artifacts-slice-handoffs-ready'
      : (reviewCurrent ? 'frontend-artifacts-review-ready' : 'frontend-artifacts-audit-needed'),
    title: handoffCurrent
      ? 'Review frontend slice handoffs'
      : (reviewCurrent ? 'Review frontend/artifacts audit' : 'Audit frontend/artifacts payload'),
    value: handoffCurrent ? 0.26 : (reviewCurrent ? 0.32 : 0.64),
    urgency: handoffCurrent ? 0.2 : (reviewCurrent ? 0.24 : 0.5),
    loopability: handoffCurrent ? 0.5 : (reviewCurrent ? 0.55 : 0.78),
    freshness: 0.65,
    risk: 0.2,
    action: handoffCurrent
      ? 'Review the generated frontend slice handoffs before staging any artifact payload.'
      : (reviewCurrent
          ? 'Generate frontend slice handoffs for art-portfolio, design-showcase, token-editor, and shared-helper before staging.'
          : 'Create a read-only frontend/artifact review with package, size, deploy-config, and secret-risk summaries.'),
    evidence: {
      statusFingerprint,
      groupFingerprint,
      total: group.counts?.total || 0,
      untracked: group.counts?.untracked || 0,
      gate: group.gate,
      boundaryReportPath: boundary.reportPath,
      reviewPath: reviewCurrent ? latestReview.reportPath : null,
      reviewSummary: reviewCurrent ? latestReview.summary : null,
      handoffDir: handoffCurrent ? path.join(stateDir, 'frontend-slice-handoffs') : null,
      handoffSlices: handoffCurrent ? latestHandoff.slices : null,
    },
  }];
}

async function discoverColdOutreach() {
  const candidate = await previewColdOutreachCandidate({
    projectRoot: repoRoot,
    stateDir,
    now: new Date(),
    payload: {
      config_path: 'scripts/outreach.prospects.json',
      batch_size: process.env.LOOPS_OUTREACH_BATCH_SIZE || 5,
      cooldown_days: process.env.LOOPS_OUTREACH_COOLDOWN_DAYS || 14,
    },
  });
  return candidate ? [candidate] : [];
}

async function discoverGoogleBusinessProspecting() {
  const candidate = await previewGoogleBusinessProspectingCandidate({
    projectRoot: repoRoot,
    stateDir,
    now: new Date(),
    payload: {
      config_path: 'scripts/outreach.prospects.json',
      limit_per_query: process.env.LOOPS_GOOGLE_LIMIT_PER_QUERY || 8,
      max_new: process.env.LOOPS_GOOGLE_MAX_NEW || 20,
    },
  });
  return candidate ? [candidate] : [];
}

async function discoverWranglerCacheRisk() {
  const status = runCommand('git', ['status', '--short'], 45_000);
  if (!status.ok) return [];

  const records = status.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => ({
      status: line.slice(0, 2),
      index: line[0],
      worktree: line[1],
      path: line.slice(3),
    }))
    .filter(record => /(^|[\\/])\.wrangler[\\/]/.test(record.path));

  if (records.length === 0) return [];

  const fingerprint = hash(records.map(record => `${record.status} ${record.path}`).join('\n'));
  const latest = await readJson(path.join(stateDir, 'wrangler-audits', 'latest.json'), null);
  const auditCurrent = latest?.fingerprint === fingerprint;
  const summary = {
    total: records.length,
    staged: records.filter(record => record.index !== ' ' && record.index !== '?').length,
    untracked: records.filter(record => record.status === '??').length,
    modified: records.filter(record => record.worktree !== ' ').length,
    cache: records.filter(record => /[\\/]\.wrangler[\\/]cache[\\/]/.test(record.path)).length,
    tmp: records.filter(record => /[\\/]\.wrangler[\\/]tmp[\\/]/.test(record.path)).length,
    accountJson: records.filter(record => /wrangler-account\.json$/i.test(record.path)).length,
  };

  return [{
    type: 'repo_hygiene',
    id: 'wrangler-cache-visible',
    title: auditCurrent ? 'Review Wrangler cache audit' : 'Audit Wrangler cache before commit',
    value: auditCurrent ? 0.44 : 0.82,
    urgency: auditCurrent ? 0.36 : 0.74,
    loopability: 0.82,
    freshness: 0.8,
    risk: 0.35,
    fingerprintSeed: records.map(record => `${record.status} ${record.path}`).join('\n'),
    action: auditCurrent
      ? 'Use the latest Wrangler cache audit before deciding whether to unstage generated Cloudflare runtime files.'
      : 'Run scripts/loops-24/audit-wrangler-cache.ps1 to create a read-only report before any public commit.',
    evidence: {
      summary,
      auditPath: auditCurrent ? latest.reportPath : null,
      firstPaths: records.slice(0, 16).map(record => `${record.status} ${record.path}`),
    },
  }];
}

async function discoverSocialPublisher() {
  const worker = path.join(repoRoot, 'workers', 'social-publisher', 'worker.js');
  const wrangler = path.join(repoRoot, 'workers', 'social-publisher', 'wrangler.toml');
  const [workerText, wranglerText] = await Promise.all([readText(worker), readText(wrangler)]);
  if (!workerText || !wranglerText) return [];

  const endpoints = {
    health: workerText.includes("url.pathname === '/health'"),
    queueAdd: workerText.includes("url.pathname === '/queue/add'"),
    queueList: workerText.includes("url.pathname === '/queue/list'"),
    publish: workerText.includes("url.pathname === '/publish'"),
  };

  const crons = extractWranglerCrons(wranglerText);
  const baseUrl = normalizeBaseUrl(
    process.env.SOCIAL_PUBLISHER_URL
    || process.env.LOOPS_SOCIAL_PUBLISHER_URL
    || defaultSocialPublisherUrl
  );
  const token = process.env.SOCIAL_PUBLISHER_TOKEN || process.env.TRIGGER_TOKEN || '';

  if (onlySafeLocal) {
    return [{
      type: 'social_publisher',
      id: token ? 'social-publisher-safe-local-live-probe-skipped' : 'social-publisher-token-missing',
      title: token ? 'Social-publisher local review ready' : 'Add queue-list token for live probe',
      value: token ? 0.5 : 0.72,
      urgency: token ? 0.38 : 0.68,
      loopability: 0.9,
      freshness: 0.7,
      risk: 0.1,
      action: token
        ? 'Safe-local mode skipped /health and /queue/list. Run without --only-safe-local only after live probe approval.'
        : 'Set SOCIAL_PUBLISHER_TOKEN or TRIGGER_TOKEN locally; safe-local mode will still skip live /queue/list until approval.',
      evidence: {
        safeLocal: true,
        worker: relative(worker),
        wrangler: relative(wrangler),
        endpoints,
        crons,
        baseUrl: baseUrl ? redactUrl(baseUrl) : '',
        tokenPresent: Boolean(token),
      },
    }];
  }

  if (!baseUrl) {
    return [{
      type: 'social_publisher',
      id: 'social-publisher-live-env-missing',
      title: 'Add live social-publisher probe env',
      value: 0.74,
      urgency: 0.62,
      loopability: 0.9,
      freshness: 0.55,
      risk: 0.1,
      action: 'Set SOCIAL_PUBLISHER_URL and SOCIAL_PUBLISHER_TOKEN/TRIGGER_TOKEN in the automation environment so each loop verifies /health plus /queue/list, not just repo files.',
      evidence: {
        worker: relative(worker),
        wrangler: relative(wrangler),
        endpoints,
        crons,
      },
    }];
  }

  const health = await fetchJson(`${baseUrl}/health`);
  if (!health.ok) {
    return [{
      type: 'social_publisher',
      id: 'social-publisher-health-failed',
      title: 'Social-publisher health probe failed',
      value: 0.82,
      urgency: 0.78,
      loopability: 0.85,
      freshness: 0.9,
      risk: 0.15,
      action: 'Check the worker URL, workers.dev route, and Cloudflare deployment before queue automation depends on it.',
      evidence: { baseUrl: redactUrl(baseUrl), status: health.status, error: health.error },
    }];
  }

  if (!token) {
    return [{
      type: 'social_publisher',
      id: 'social-publisher-token-missing',
      title: 'Add queue-list token for live probe',
      value: 0.72,
      urgency: 0.68,
      loopability: 0.9,
      freshness: 0.7,
      risk: 0.1,
      action: 'Set SOCIAL_PUBLISHER_TOKEN or TRIGGER_TOKEN so LOOPS can verify /queue/list without exposing the token in logs.',
      evidence: { baseUrl: redactUrl(baseUrl), health: health.data },
    }];
  }

  const queueUrl = new URL(`${baseUrl}/queue/list`);
  queueUrl.searchParams.set('token', token);
  const queue = await fetchJson(queueUrl.toString());

  if (!queue.ok) {
    return [{
      type: 'social_publisher',
      id: 'social-publisher-queue-list-failed',
      title: 'Queue-list probe failed',
      value: 0.84,
      urgency: 0.78,
      loopability: 0.86,
      freshness: 0.9,
      risk: 0.15,
      action: 'Fix /queue/list token, D1 binding, or worker deployment before adding new posts.',
      evidence: { baseUrl: redactUrl(baseUrl), status: queue.status, error: queue.error },
    }];
  }

  const rows = Array.isArray(queue.data?.rows) ? queue.data.rows : [];
  const failed = rows.filter(row => row.status === 'failed').length;
  const pending = rows.filter(row => row.status === 'pending').length;

  return [{
    type: 'social_publisher',
    id: 'social-publisher-live-queue',
    title: failed ? 'Inspect failed social queue rows' : 'Social queue live probe ready',
    value: failed ? 0.88 : 0.64,
    urgency: failed ? 0.82 : 0.45,
    loopability: 0.9,
    freshness: 0.9,
    risk: 0.15,
    action: failed
      ? 'Inspect failed content_queue rows and decide whether to retry, edit, or delete each row.'
      : 'Use this live queue signal as the first recurring LOOPS heartbeat for 3Q social publishing.',
    evidence: {
      baseUrl: redactUrl(baseUrl),
      configured: queue.data?.configured,
      queue: { totalSampled: rows.length, pending, failed },
      crons,
    },
  }];
}

async function discoverContentQueue() {
  const migrationsDir = path.join(repoRoot, 'db', 'migrations');
  const files = await readDirSafe(migrationsDir);
  const sqlFiles = files.filter(file => file.endsWith('.sql')).sort();
  let insertCount = 0;
  const seedFiles = [];

  for (const file of sqlFiles) {
    const full = path.join(migrationsDir, file);
    const text = await readText(full);
    const matches = text.match(/INSERT\s+INTO\s+content_queue/gi) || [];
    if (matches.length) {
      insertCount += matches.length;
      seedFiles.push({ file: relative(full), inserts: matches.length });
    }
  }

  if (insertCount === 0) return [];

  const renderManifest = path.join(repoRoot, 'assets', 'exports', '_render-manifest.json');
  const manifestExists = fssync.existsSync(renderManifest);
  const latestReconciliation = await readJson(path.join(stateDir, 'content-queue-reconciliations', 'latest.json'), null);
  const hasReconciliation = Boolean(latestReconciliation?.reportPath);

  return [{
    type: 'content_queue',
    id: 'content-queue-seed-inventory',
    title: hasReconciliation ? 'Review content queue reconciliation' : 'Reconcile seeded content queue',
    value: hasReconciliation ? 0.46 : 0.68,
    urgency: hasReconciliation ? 0.32 : 0.52,
    loopability: hasReconciliation ? 0.68 : 0.82,
    freshness: 0.5,
    risk: 0.2,
    action: hasReconciliation
      ? 'Use the offline content queue reconciliation as the baseline while live /queue/list is waiting on token input.'
      : 'Run scripts/loops-24/reconcile-content-queue.ps1 before inserting more evergreen content.',
    evidence: {
      insertCount,
      seedFiles,
      renderManifest: manifestExists ? relative(renderManifest) : null,
      reconciliation: latestReconciliation
        ? {
            reportPath: latestReconciliation.reportPath,
            summary: latestReconciliation.summary,
          }
        : null,
    },
  }];
}

async function discoverWebhookCron() {
  const wrangler = path.join(repoRoot, 'webhook', 'wrangler.toml');
  const worker = path.join(repoRoot, 'webhook', 'worker.js');
  const [wranglerText, workerText] = await Promise.all([readText(wrangler), readText(worker)]);
  if (!wranglerText || !workerText) return [];

  const hasScheduled = workerText.includes('async scheduled');
  const hasOutcomeRecorder = workerText.includes('recordCronOutcome') && workerText.includes('cron:last');
  const hasStatusEndpoint = workerText.includes("url.pathname === '/api/cron-status'");
  const crons = extractWranglerCrons(wranglerText);
  const branchCrons = Array.from(workerText.matchAll(/'([^']+)':\s*\{\s*name:\s*'([^']+)'/g))
    .map(match => ({ cron: match[1], branch: match[2] }));
  const expectedCrons = branchCrons.map(item => item.cron);
  const missingCrons = expectedCrons.filter(cron => !crons.includes(cron));
  if (!hasScheduled && crons.length === 0) return [];
  const outcomeMapped = hasScheduled && hasOutcomeRecorder && hasStatusEndpoint && missingCrons.length === 0;

  return [{
    type: 'line_webhook',
    id: 'webhook-cron-map',
    title: outcomeMapped ? 'Review webhook cron outcome map' : 'Map webhook cron outcomes',
    value: outcomeMapped ? 0.42 : 0.58,
    urgency: outcomeMapped ? 0.3 : 0.42,
    loopability: outcomeMapped ? 0.64 : 0.72,
    freshness: 0.45,
    risk: 0.2,
    action: outcomeMapped
      ? 'After deploy approval, verify /api/cron-status with TRIGGER_TOKEN after the next scheduled branch runs.'
      : 'Add a low-impact status check that records which webhook scheduled branch ran and whether D1/KV writes succeeded.',
    evidence: {
      wrangler: relative(wrangler),
      worker: relative(worker),
      hasScheduled,
      hasOutcomeRecorder,
      hasStatusEndpoint,
      branchCrons,
      crons,
      missingCrons,
    },
  }];
}

async function runAutoCompletions(candidates) {
  const completions = [];
  const ids = new Set(candidates.map(candidate => candidate.id));
  const byId = new Map(candidates.map(candidate => [candidate.id, candidate]));

  completions.push(runLocalStep(
    'check-connector-health',
    'node',
    [
      'scripts/loops-24/check-connector-health.mjs',
      ...(onlySafeLocal ? ['--only-safe-local'] : []),
    ],
    180_000
  ));

  if (ids.has('wakeup-health-needed') || ids.has('wakeup-health-attention')) {
    completions.push(runLocalStep(
      'check-wakeup-health',
      'node',
      ['scripts/loops-24/check-wakeup-health.mjs'],
      240_000
    ));
  } else if (ids.has('wakeup-health-ready')) {
    const candidate = byId.get('wakeup-health-ready');
    const wakeToRunDisabled = candidate?.evidence?.scheduledTask?.wakeToRun === false;
    const freshness = candidate?.evidence?.freshUntil
      ? ` freshUntil=${candidate.evidence.freshUntil} ageMinutes=${candidate?.evidence?.ageMinutes ?? '(unknown)'} limitMinutes=${candidate?.evidence?.reportFreshMinutes ?? '(unknown)'}`
      : '';
    completions.push(blockedCompletion(
      'wakeup-health-ready',
      wakeToRunDisabled
        ? `Current wakeup health report already exists: ${candidate?.evidence?.reportPath || path.join(stateDir, 'wakeup-health')};${freshness}; WakeToRun is disabled, so sleeping-machine wakeups require owner approval.`
        : `Current wakeup health report already exists: ${candidate?.evidence?.reportPath || path.join(stateDir, 'wakeup-health')};${freshness}`,
      candidate
    ));
  }

  if (ids.has('github-local-pr-handoff-needed')) {
    const githubHandoffCompletion = runLocalStep(
      'prepare-github-handoff',
      'node',
      ['scripts/loops-24/prepare-github-handoff.mjs'],
      120_000
    );
    completions.push(githubHandoffCompletion);
    if (githubHandoffCompletion.status === 'completed'
      && !ids.has('pr-readiness-needed')
      && !ids.has('pr-readiness-ready')) {
      completions.push(runLocalStep(
        'prepare-pr-readiness',
        'node',
        ['scripts/loops-24/prepare-pr-readiness.mjs'],
        120_000
      ));
    }
  } else if (ids.has('github-local-pr-handoff-ready')) {
    const candidate = byId.get('github-local-pr-handoff-ready');
    completions.push(blockedCompletion(
      'github-local-pr-handoff-ready',
      `GitHub handoff already exists: ${candidate?.evidence?.handoffPath || path.join(stateDir, 'github-handoffs')}; push and PR creation require approval.`,
      candidate
    ));
  }

  if (ids.has('pr-readiness-needed')) {
    completions.push(runLocalStep(
      'prepare-pr-readiness',
      'node',
      ['scripts/loops-24/prepare-pr-readiness.mjs'],
      120_000
    ));
  } else if (ids.has('pr-readiness-ready')) {
    const candidate = byId.get('pr-readiness-ready');
    completions.push(blockedCompletion(
      'pr-readiness-ready',
      `Current PR readiness packet already exists: ${candidate?.evidence?.readinessPath || path.join(stateDir, 'pr-readiness')}; push and PR creation require approval.`,
      candidate
    ));
  }

  if (ids.has('dirty-worktree')) {
    const dirty = byId.get('dirty-worktree');
    completions.push(runLocalStep(
      'classify-dirty-worktree',
      'node',
      ['scripts/loops-24/classify-dirty-worktree.mjs'],
      120_000
    ));
    if (dirty?.evidence?.sliceHandoffPath) {
      completions.push(blockedCompletion(
        'dirty-worktree',
        `Current slice handoff already exists: ${dirty.evidence.sliceHandoffPath}`,
        dirty
      ));
    } else {
      if (!dirty?.evidence?.snapshotPath) {
        completions.push(runLocalStep('snapshot-worktree', 'node', ['scripts/loops-24/snapshot-worktree.mjs'], 120_000));
      }
      if (!dirty?.evidence?.boundaryPlanPath) {
        completions.push(runLocalStep('plan-commit-boundaries', 'node', ['scripts/loops-24/plan-commit-boundaries.mjs'], 120_000));
      }

      let boundary = await readJson(path.join(stateDir, 'commit-boundaries', 'latest.json'), null);
      const currentWorktree = currentWorktreeFingerprint();
      if (currentWorktree.ok && boundary?.statusFingerprint !== currentWorktree.statusFingerprint) {
        completions.push(runLocalStep('plan-commit-boundaries', 'node', ['scripts/loops-24/plan-commit-boundaries.mjs'], 120_000));
        boundary = await readJson(path.join(stateDir, 'commit-boundaries', 'latest.json'), null);
      }
      const groups = Array.isArray(boundary?.groups) ? boundary.groups : [];
      if (groups.some(group => group.gate === 'deploy-approval')) {
        const latestWorkerReview = await readJson(path.join(stateDir, 'worker-deploy-reviews', 'latest.json'), null);
        if (latestWorkerReview?.statusFingerprint === boundary.statusFingerprint) {
          completions.push(blockedCompletion(
            'review:worker_deploy_slices',
            `Current Worker deploy review already exists: ${latestWorkerReview.reportPath}`,
            dirty
          ));
        } else {
          completions.push(runLocalStep(
            'review:worker_deploy_slices',
            'node',
            ['scripts/loops-24/review-worker-deploy-slices.mjs'],
            120_000
          ));
        }
        completions.push(runLocalStep(
          'prepare-worker-deploy-checklist',
          'node',
          ['scripts/loops-24/prepare-worker-deploy-checklist.mjs'],
          120_000
        ));
      }
      for (const group of groups) {
        if (group.gate === 'large-payload-review') {
          const latestReview = await readJson(path.join(stateDir, 'frontend-artifact-reviews', 'latest.json'), null);
          const groupFingerprint = hash((group.paths || []).slice().sort().join('\n'));
          if (latestReview?.statusFingerprint === boundary.statusFingerprint
            && latestReview?.groupFingerprint === groupFingerprint) {
            completions.push(blockedCompletion(
              `review:${group.id}`,
              `Current frontend/artifact review already exists: ${latestReview.reportPath}`,
              dirty
            ));
          } else {
            completions.push(runLocalStep(
              `review:${group.id}`,
              'node',
              ['scripts/loops-24/review-frontend-artifacts.mjs'],
              120_000
            ));
          }
          continue;
        }
        completions.push(runLocalStep(
          `handoff:${group.id}`,
          'node',
          ['scripts/loops-24/prepare-slice-handoff.mjs', '--group', group.id],
          120_000
        ));
      }
    }
  }

  if (ids.has('wrangler-cache-visible')) {
    const candidate = byId.get('wrangler-cache-visible');
    if (candidate?.evidence?.auditPath) {
      completions.push(blockedCompletion('audit-wrangler-cache', `Current Wrangler audit already exists: ${candidate.evidence.auditPath}`, candidate));
    } else {
      completions.push(runLocalStep('audit-wrangler-cache', 'node', ['scripts/loops-24/audit-wrangler-cache.mjs'], 120_000));
    }
  }

  if (ids.has('content-queue-seed-inventory')) {
    const candidate = byId.get('content-queue-seed-inventory');
    if (candidate?.evidence?.reconciliation?.reportPath) {
      completions.push(blockedCompletion('reconcile-content-queue', `Current reconciliation already exists: ${candidate.evidence.reconciliation.reportPath}`, candidate));
    } else {
      completions.push(runLocalStep('reconcile-content-queue', 'node', ['scripts/loops-24/reconcile-content-queue.mjs'], 120_000));
    }
  }

  const secretGateIds = [
    'google-prospecting-api-key-missing',
    'social-publisher-live-env-missing',
    'social-publisher-token-missing',
  ];
  if (secretGateIds.some(id => ids.has(id))) {
    completions.push(runLocalStep(
      'prepare-secret-gates',
      'node',
      ['scripts/loops-24/prepare-secret-gates.mjs'],
      120_000
    ));
    completions.push(runLocalStep(
      'prepare-secret-checklist',
      'node',
      ['scripts/loops-24/prepare-secret-checklist.mjs'],
      120_000
    ));
  }

  const outreachCandidate = candidates.find(candidate => candidate.id?.startsWith('cold-outreach-batch-'));
  if (outreachCandidate) {
    completions.push(runLocalStep('generate-cold-outreach-drafts', 'node', ['scripts/loops-24/generate-cold-outreach.mjs'], 120_000));
  }

  for (const candidate of candidates) {
    if (candidate.id === 'google-prospecting-api-key-missing') {
      completions.push(blockedCompletion(candidate.id, 'Needs GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY; review the secret-gates handoff, then add the value only to the local runner environment.', candidate));
    } else if (candidate.id === 'social-publisher-token-missing') {
      completions.push(blockedCompletion(candidate.id, 'Needs SOCIAL_PUBLISHER_TOKEN or TRIGGER_TOKEN; review the secret-gates handoff, then add the value only to the local runner environment.', candidate));
    } else if (candidate.id === 'social-publisher-health-failed') {
      completions.push(blockedCompletion(candidate.id, 'Live worker repair requires deployment review.', candidate));
    } else if (candidate.id === 'webhook-cron-map') {
      completions.push(blockedCompletion(candidate.id, 'Cron status verification waits for deploy approval and TRIGGER_TOKEN.', candidate));
    } else if (candidate.id === 'project-state-base64') {
      completions.push(blockedCompletion(candidate.id, 'Project-state normalization edits a tracked file and needs local review first.', candidate));
    } else if (candidate.id === 'cold-outreach-cooldown-active') {
      completions.push(blockedCompletion(candidate.id, 'Outreach drafts already exist or prospects are cooling down; sending remains manual.', candidate));
    } else if (candidate.id === 'cold-outreach-needs-prospects') {
      completions.push(blockedCompletion(candidate.id, 'Needs fresh reviewed prospects before drafts can be generated.', candidate));
    } else if (candidate.id === 'frontend-artifacts-review-ready') {
      const latestHandoff = await readJson(path.join(stateDir, 'frontend-slice-handoffs', 'latest.json'), null);
      if (latestHandoff?.statusFingerprint === candidate.evidence?.statusFingerprint
        && latestHandoff?.groupFingerprint === candidate.evidence?.groupFingerprint) {
        completions.push(blockedCompletion(candidate.id, `Frontend slice handoffs already exist: ${path.join(stateDir, 'frontend-slice-handoffs')}`, candidate));
      } else {
        const latestReview = await readJson(path.join(stateDir, 'frontend-artifact-reviews', 'latest.json'), null);
        const currentStatus = runCommand('git', ['status', '--short'], 45_000);
        const currentFingerprint = currentStatus.ok
          ? gitWorktreeFingerprint({
              cwd: repoRoot,
              statusLines: currentStatus.stdout.split(/\r?\n/).filter(Boolean),
            })
          : '';
        if (latestReview?.statusFingerprint !== currentFingerprint) {
          completions.push(runLocalStep(
            'review:frontend_artifacts',
            'node',
            ['scripts/loops-24/review-frontend-artifacts.mjs'],
            120_000
          ));
        }
        completions.push(runLocalStep(
          'prepare-frontend-slice-handoffs',
          'node',
          ['scripts/loops-24/prepare-frontend-slice-handoffs.mjs'],
          120_000
        ));
      }
    } else if (candidate.id === 'frontend-artifacts-slice-handoffs-ready') {
      completions.push(blockedCompletion(candidate.id, 'Frontend slice handoffs exist; staging each slice still needs review and the generated stage script must be run manually.', candidate));
    }
  }

  const hasManualGateCandidates = candidatesHaveManualGates(candidates);

  if (hasManualGateCandidates) {
    completions.push(runLocalStep(
      'prepare-manual-gate-adapter',
      'node',
      ['scripts/loops-24/prepare-manual-gate-adapter.mjs'],
      120_000
    ));
  }

  return completions;
}

async function runPostDashboardAutoCompletions(candidates, autoCompletions, result, taskRegistry) {
  if (!autoCompleteEnabled || !result.dashboardJsonPath) return autoCompletions;

  let next = autoCompletions;
  if (candidatesHaveManualGates(candidates) || autoCompletionsNeedOwnerBundle(next)) {
    next = [
      ...next,
      runLocalStep(
        'verify-dashboard-gates',
        'node',
        ['scripts/loops-24/verify-dashboard-gates.mjs', '--dashboard-json', result.dashboardJsonPath],
        120_000
      ),
    ];
    refreshResultSummaries(result, candidates, next, taskRegistry);
    await writeReport(result, candidates, next);
    await writeDashboard(result, candidates, next);

    next = [
      ...next,
      runLocalStep(
        'prepare-owner-approval-bundle',
        'node',
        ['scripts/loops-24/prepare-owner-approval-bundle.mjs'],
        120_000
      ),
      runLocalStep(
        'verify-owner-approval-bundle',
        'node',
        ['scripts/loops-24/verify-owner-approval-bundle.mjs'],
        120_000
      ),
      runLocalStep(
        'prepare-approval-workbench',
        'node',
        ['scripts/loops-24/prepare-approval-workbench.mjs'],
        120_000
      ),
      runLocalStep(
        'verify-approval-workbench',
        'node',
        ['scripts/loops-24/verify-approval-workbench.mjs'],
        120_000
      ),
    ];
  }

  return next;
}

function candidatesHaveManualGates(candidates = []) {
  return candidates.some(candidate => (candidate.manualGate || inferManualGate(candidate)) !== 'none_read_only');
}

function refreshResultSummaries(result, candidates, autoCompletions, taskRegistry) {
  result.finishedAt = new Date().toISOString();
  result.autoComplete = summarizeAutoCompletions(autoCompletions);
  result.loopos = buildLooposSummary(candidates, autoCompletions, taskRegistry);
  return result;
}

function autoCompletionsNeedOwnerBundle(completions) {
  return (completions || []).some(item => item.status === 'blocked'
    || item.label === 'prepare-pr-readiness'
    || item.label === 'prepare-worker-deploy-checklist'
    || item.label === 'prepare-github-handoff'
    || item.label === 'prepare-secret-gates'
    || item.label === 'prepare-secret-checklist');
}

function runLocalStep(label, command, args, timeout) {
  const started = Date.now();
  const result = runCommand(command, args, timeout);
  const data = parseJsonOutput(result.stdout);
  const completion = {
    label,
    status: result.ok ? 'completed' : 'failed',
    command: [command, ...args].join(' '),
    durationMs: Date.now() - started,
    summary: completionSummary(label, data, result),
  };

  if (data) {
    completion.data = redactEvidence(data);
  } else {
    completion.stdout = trim(result.stdout, 1000);
    completion.stderr = trim(result.stderr, 1000);
  }

  return completion;
}

function blockedCompletion(label, reason, candidate = null) {
  const ageHours = Number(candidate?.ageHours || 0);
  const escalated = Boolean(candidate?.escalated || ageHours >= blockerEscalateHours);
  const escalationSummary = escalated
    ? `ESCALATED: blocked for ${ageHours.toFixed(1)}h. ${reason}`
    : reason;
  return {
    label,
    status: 'blocked',
    reason,
    summary: escalationSummary,
    ageHours,
    firstSeenAt: candidate?.firstSeenAt || null,
    escalated,
    escalation: escalated ? (candidate?.escalation || `blocked_over_${blockerEscalateHours}h`) : null,
    manualGate: candidate?.manualGate || inferManualGate(candidate || {}),
    nextApproval: classifyApproval(label, candidate),
    nextApprovals: classifyApprovalGates(label, candidate),
  };
}

function classifyApproval(label, candidate = null) {
  return classifyApprovalGates(label, candidate)[0] || 'review';
}

function classifyApprovalGates(label, candidate = null) {
  const id = `${label} ${candidate?.id || ''}`.toLowerCase();
  const text = `${id} ${candidate?.manualGate || ''} ${candidate?.type || ''} ${candidate?.action || ''}`.toLowerCase();
  const evidenceText = `${candidate?.evidence?.scheduledTask?.wakeToRun === false ? 'waketorun=false ' : ''}${candidate?.evidence?.health?.warnings?.join(' ') || ''}`.toLowerCase();
  const gates = [];
  const addGate = gate => {
    if (gate && !gates.includes(gate)) gates.push(gate);
  };

  if (/investor|fundraising|taiwania|pitch[-_ ]?deck|data[-_ ]?room|investor[-_ ]?packet/.test(text)) {
    addGate('investor-review');
  }

  switch (candidate?.manualGate || inferManualGate(candidate || {})) {
    case 'manual_secret_input':
      addGate('secret-input');
      break;
    case 'manual_send_only':
      addGate('manual-send-approval');
      break;
    case 'manual_deploy_approval':
      addGate('deploy-approval');
      break;
    case 'manual_investor_review':
      addGate('investor-review');
      break;
    case 'manual_create_only':
      addGate(/github|local-pr|\bpr\b|pull request|push|merge|issue/.test(text) ? 'push-and-pr-approval' : 'local-review');
      break;
    case 'manual_review_only':
      addGate('local-review');
      break;
    default:
      break;
  }

  if (/cold-outreach|outreach|manual-send|sending/.test(text)) addGate('manual-send-approval');
  if (/google-prospecting-api-key|social-publisher-token|secret-gates|api[_-]?key|secret|token/.test(text)) addGate('secret-input');
  if (/webhook-cron|worker-deploy|deploy|cron-status|social-publisher-health|queue-list/.test(text)) addGate('deploy-approval');
  if (/github|local-pr|pr-readiness|pull request|push/.test(text)) addGate('push-and-pr-approval');
  if (/content-queue|wakeup|frontend|slice|handoff|worktree|wrangler-cache/.test(text)) addGate('local-review');
  if (/waketorun=false|waketorun is disabled|sleeping-machine|sleeping machine|power-wake/.test(`${text} ${evidenceText}`)) {
    addGate('power-wake-policy');
  }
  return gates.length ? gates : ['review'];
}

function completionSummary(label, data, result) {
  if (!result.ok) return `${label} failed with status ${result.status}`;
  if (data?.reportPath) return `${label} wrote ${data.reportPath}`;
  if (data?.stageScriptPath) return `${label} wrote ${data.stageScriptPath}`;
  if (data?.summary) {
    const summary = typeof data.summary === 'string' ? data.summary : JSON.stringify(data.summary);
    return trim(summary, 500);
  }
  if (typeof data?.generated_count === 'number') return `${label} generated ${data.generated_count} item(s)`;
  return `${label} completed`;
}

function parseJsonOutput(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function scoreCandidates(candidates, previousState) {
  const seen = previousState.candidateLedger || {};
  const now = Date.now();

  return candidates.map(candidate => {
    const lane = candidate.lane || inferLane(candidate);
    const manualGate = candidate.manualGate || inferManualGate(candidate);
    const expectedArtifact = candidate.expectedArtifact || inferExpectedArtifact(candidate);
    const dedupPolicy = candidate.dedupPolicy || inferDedupPolicy(candidate);
    const fingerprint = hash(`${candidate.type}:${candidate.id}:${candidate.fingerprintSeed || JSON.stringify(candidate.evidence || {})}`);
    const ledger = seen[fingerprint];
    const firstSeenAt = ledger?.firstSeenAt ? Date.parse(ledger.firstSeenAt) : now;
    const ageHours = Math.max(0, (now - firstSeenAt) / 3_600_000);
    const starvation = Math.min(1, ageHours / 24);
    const duplicatePenalty = ledger?.lastSeenAt ? Math.min(0.35, (ledger.count || 1) * 0.04) : 0;
    const retryPenalty = candidate.retryPenalty || 0;
    const roundedAgeHours = round(ageHours);
    const escalated = ageHours >= blockerEscalateHours;

    const score = round(
      0.35 * norm(candidate.value)
      + 0.20 * norm(candidate.urgency)
      + 0.15 * starvation
      + 0.10 * norm(candidate.loopability)
      + 0.10 * norm(candidate.freshness)
      - 0.05 * retryPenalty
      - 0.05 * norm(candidate.risk)
      - 0.10 * duplicatePenalty
    );

    return {
      ...candidate,
      lane,
      manualGate,
      expectedArtifact,
      dedupPolicy,
      score,
      fingerprint,
      firstSeenAt: new Date(firstSeenAt).toISOString(),
      seenCount: ledger?.count || 0,
      ageHours: roundedAgeHours,
      escalated,
      escalation: escalated ? `blocked_over_${blockerEscalateHours}h` : null,
    };
  });
}

async function writeReport(result, candidates, autoCompletions = []) {
  const reportPath = path.join(runsDir, `${toStamp(startedAt)}-${runId.slice(0, 8)}.md`);
  const lines = [
    `# LOOPS 24 run ${result.runId}`,
    '',
    `- automation_id: ${automationId}`,
    `- status: ${result.status}`,
    `- started_at: ${result.startedAt}`,
    `- finished_at: ${result.finishedAt}`,
    `- repo_root: ${repoRoot}`,
    `- auto_complete: ${autoCompleteEnabled ? 'enabled' : 'disabled'}`,
    `- only_safe_local: ${onlySafeLocal ? 'enabled' : 'disabled'}`,
    '',
    '## LoopOS morning decision',
    '',
    ...renderMorningDecision(result.loopos?.morningDecision),
    '',
    '## Lane summary',
    '',
    ...renderLaneSummary(result.loopos?.lanes),
    '',
    '## Manual red lines',
    '',
    ...manualRedLines.map(line => `- ${line}`),
    '',
    '## Selected candidates',
    '',
  ];

  if (candidates.length === 0) {
    lines.push('- No candidates discovered. Heartbeat only.');
  } else {
    for (const candidate of candidates) {
      lines.push(`- score ${candidate.score.toFixed(3)} | ${candidate.title}`);
      lines.push(`  - type: ${candidate.type}`);
      lines.push(`  - lane: ${candidate.lane}`);
      lines.push(`  - id: ${candidate.id}`);
      lines.push(`  - manual_gate: ${candidate.manualGate}`);
      lines.push(`  - expected_artifact: ${candidate.expectedArtifact}`);
      lines.push(`  - dedup_policy: ${candidate.dedupPolicy}`);
      lines.push(`  - action: ${candidate.action}`);
      lines.push(`  - fingerprint: ${candidate.fingerprint}`);
      lines.push(`  - age_hours: ${candidate.ageHours}`);
      if (candidate.escalated) lines.push(`  - escalation: ${candidate.escalation}`);
      if (candidate.evidence) {
        lines.push('  - evidence:');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(redactEvidence(candidate.evidence), null, 2));
        lines.push('```');
        lines.push('');
      }
    }
  }

  lines.push('');
  lines.push('## Auto-complete');
  lines.push('');

  if (!autoCompleteEnabled) {
    lines.push('- Disabled for this run.');
  } else if (autoCompletions.length === 0) {
    lines.push('- Nothing eligible for local auto-completion.');
  } else {
    for (const item of autoCompletions) {
      lines.push(`- ${item.status}: ${item.label}`);
      lines.push(`  - summary: ${item.summary || item.reason || ''}`);
      if (item.command) lines.push(`  - command: \`${item.command}\``);
      if (item.data) {
        lines.push('  - data:');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(item.data, null, 2));
        lines.push('```');
        lines.push('');
      }
      if (item.stderr) lines.push(`  - stderr: ${item.stderr}`);
    }
  }

  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- This runner does not deploy, publish, delete, or mutate external systems.');
  if (onlySafeLocal) lines.push('- Only-safe-local mode is enabled; external HTTP probes are disabled.');
  lines.push('- Secrets are never written to the report.');
  lines.push('');

  await fs.writeFile(reportPath, `${lines.join('\n')}\n`, 'utf8');
  result.reportPath = reportPath;
}

async function writeDashboard(result, candidates, autoCompletions = []) {
  const dashboardDir = path.join(stateDir, 'dashboard');
  const reportPath = path.join(dashboardDir, `${toStamp(startedAt)}-${runId.slice(0, 8)}-dashboard.md`);
  const jsonPath = path.join(dashboardDir, `${toStamp(startedAt)}-${runId.slice(0, 8)}-dashboard.json`);
  const latestPath = path.join(dashboardDir, 'latest.json');
  const latestMarkdownPath = path.join(dashboardDir, 'latest.md');
  const generatedAt = new Date();
  const completed = autoCompletions.filter(item => item.status === 'completed');
  const blocked = autoCompletions.filter(item => item.status === 'blocked');
  const manualWaits = summarizeManualWaits(candidates, autoCompletions);
  const ownerGateWaits = await summarizeOwnerGateWaits();
  const waiting = [...blocked, ...manualWaits, ...ownerGateWaits];
  const approvals = summarizeApprovals(waiting);
  const escalated = blocked.filter(item => item.escalated);
  const loopos = result.loopos || buildLooposSummary(candidates, autoCompletions, { registries: [], warnings: [] });
  const connectorHealth = summarizeConnectorHealthArtifact(await readJson(path.join(stateDir, 'connector-health', 'latest.json'), null));
  const secretChecklist = summarizeSecretChecklistArtifact(await readJson(path.join(stateDir, 'secret-checklists', 'latest.json'), null));
  const dirtyClassification = summarizeDirtyClassificationArtifact(await readJson(path.join(stateDir, 'dirty-worktree', 'latest.json'), null));
  const currentHead = currentGitHead();
  const ownerApprovalBundle = summarizeOwnerApprovalBundleArtifact(
    await readJson(path.join(stateDir, 'owner-approval-bundles', 'latest.json'), null),
    currentHead,
    generatedAt
  );
  const approvalWorkbench = summarizeApprovalWorkbenchArtifact(
    await readJson(path.join(stateDir, 'approval-workbench', 'latest.json'), null),
    generatedAt
  );
  const summary = {
    completedCount: completed.length,
    blockedCount: blocked.length,
    manualWaitCount: manualWaits.length,
    waitingCount: waiting.length,
    approvalGroupCount: approvals.length,
    escalatedCount: escalated.length,
    manualRedLineCount: manualRedLines.length,
    topAction: loopos.morningDecision?.label || null,
    topLane: loopos.morningDecision?.lane || null,
    nextApproval: loopos.morningDecision?.nextApproval || approvals[0]?.approval || null,
    largestApprovalGroup: approvals[0]?.approval || null,
    connectorAttentionCount: connectorHealth.summary?.attentionCount || 0,
    missingSecretGateCount: secretChecklist.summary?.missingCount || 0,
    dirtyDeployCount: dirtyClassification.summary?.deploy || 0,
    ownerApprovalBundleStatus: ownerApprovalBundle.available ? ownerApprovalBundle.status : null,
    ownerApprovalBundleHead: ownerApprovalBundle.available ? ownerApprovalBundle.head : null,
    ownerApprovalBundleHeadCurrent: ownerApprovalBundle.available ? ownerApprovalBundle.headCurrent : null,
    ownerApprovalBundleAttentionCount: ownerApprovalBundle.available ? Number(ownerApprovalBundle.summary?.attentionCount || 0) : null,
    ownerApprovalBundlePrPublishReady: ownerApprovalBundle.available ? ownerApprovalBundle.summary?.prPublishReady : null,
    ownerApprovalBundleLocalScopeClean: ownerApprovalBundle.available ? ownerApprovalBundle.summary?.localScopeClean : null,
    ownerApprovalBundleWakeupFresh: ownerApprovalBundle.available ? ownerApprovalBundle.summary?.wakeupFresh : null,
    ownerApprovalBundleWakeupFreshUntil: ownerApprovalBundle.available ? ownerApprovalBundle.summary?.wakeupFreshUntil : null,
    ownerApprovalBundleWakeupFreshInMinutes: ownerApprovalBundle.available ? ownerApprovalBundle.summary?.wakeupFreshInMinutes : null,
    ownerApprovalBundlePowerWakeNeedsApproval: ownerApprovalBundle.available ? ownerApprovalBundle.summary?.powerWakeNeedsApproval : null,
    approvalWorkbenchExpired: approvalWorkbench.available ? approvalWorkbench.summary?.expired : null,
    approvalWorkbenchExpiresAtTaipei: approvalWorkbench.available ? approvalWorkbench.summary?.expiresAtTaipei : null,
    approvalWorkbenchExpiresInMinutes: approvalWorkbench.available ? approvalWorkbench.summary?.expiresInMinutes : null,
    approvalWorkbenchReadyCommandCount: approvalWorkbench.available ? Number(approvalWorkbench.summary?.readyCommandCount || 0) : null,
    approvalWorkbenchAttentionGateCount: approvalWorkbench.available ? Number(approvalWorkbench.summary?.attentionGateCount || 0) : null,
  };

  const payload = {
    generatedAt: generatedAt.toISOString(),
    generatedAtTaipei: formatTaipeiTime(generatedAt),
    runId: result.runId,
    status: result.status,
    reportPath,
    jsonPath,
    latestPath,
    latestMarkdownPath,
    onlySafeLocal,
    autoComplete: result.autoComplete,
    loopos,
    connectorHealth,
    secretChecklist,
    dirtyClassification,
    ownerApprovalBundle,
    approvalWorkbench,
    summary,
    manualRedLines,
    completed: completed.map(summarizeCompletion),
    blocked: blocked.map(summarizeCompletion),
    manualWaits: manualWaits.map(summarizeCompletion),
    ownerGateWaits: ownerGateWaits.map(summarizeCompletion),
    waiting: waiting.map(summarizeCompletion),
    approvalGroups: approvals,
    nextApproval: approvals,
    escalatedBlockers: escalated.map(summarizeCompletion),
  };

  const lines = [
    '# LoopOS Morning Decision Dashboard',
    '',
    `- updated_at: ${payload.generatedAt}`,
    `- updated_at_taipei: ${payload.generatedAtTaipei || '(unknown)'}`,
    `- run_id: ${payload.runId}`,
    `- only_safe_local: ${onlySafeLocal ? 'enabled' : 'disabled'}`,
    '',
    '## Today First',
    '',
    ...renderMorningDecision(loopos.morningDecision),
    '',
    '## Safe Local Actions Completed',
    '',
    ...renderDashboardList(payload.completed, '- No completed local actions in this run.'),
    '',
    '## Manual Red Lines',
    '',
    ...manualRedLines.map(line => `- ${line}`),
    '',
    '## Blocked / Waiting',
    '',
    ...renderDashboardList(payload.waiting, '- No blocked or manual-gated items.'),
    '',
    '## Next Approval Gate',
    '',
    ...renderApprovalList(payload.nextApproval),
    '',
    '## Owner Approval Bundle',
    '',
    ...renderOwnerApprovalBundle(payload.ownerApprovalBundle),
    '',
    '## Owner Approval Workbench',
    '',
    ...renderApprovalWorkbench(payload.approvalWorkbench),
    '',
    '## Connector Health',
    '',
    ...renderConnectorHealth(payload.connectorHealth),
    '',
    '## Secret Checklist',
    '',
    ...renderSecretChecklist(payload.secretChecklist),
    '',
    '## Dirty Worktree Groups',
    '',
    ...renderDirtyClassification(payload.dirtyClassification),
    '',
    '## Lane Summary',
    '',
    ...renderLaneSummary(loopos.lanes),
    '',
  ];

  await fs.mkdir(dashboardDir, { recursive: true });
  await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(reportPath, `${lines.join('\n')}\n`, 'utf8');
  await fs.writeFile(latestMarkdownPath, `${lines.join('\n')}\n`, 'utf8');

  result.dashboardPath = reportPath;
  result.dashboardJsonPath = jsonPath;
  result.escalatedBlockers = escalated.length;
}

async function appendRunToState(run, candidates, autoCompletions = []) {
  const state = await readJson(statePath, defaultState());
  state.version = 1;
  state.automationId = automationId;
  state.updatedAt = new Date().toISOString();
  state.lastRun = run;
  if (run.status === 'success') state.lastSuccessAt = run.finishedAt;
  state.runs = [run, ...(state.runs || [])].slice(0, 24);
  state.candidateLedger = state.candidateLedger || {};

  for (const candidate of candidates || []) {
    if (!candidate.fingerprint) continue;
    const current = state.candidateLedger[candidate.fingerprint] || {
      firstSeenAt: candidate.firstSeenAt || new Date().toISOString(),
      count: 0,
    };
    state.candidateLedger[candidate.fingerprint] = {
      ...current,
      lastSeenAt: new Date().toISOString(),
      count: (current.count || 0) + 1,
      lastTitle: candidate.title,
      lastScore: candidate.score,
    };
  }

  state.next = (candidates || []).map(summarizeCandidate);
  state.lastAutoCompletions = autoCompletions.map(summarizeCompletion);
  state.loopos = run.loopos || null;
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

async function loadTaskRegistry() {
  const registries = [];
  const warnings = [];

  for (const registry of taskRegistryFiles) {
    const raw = await readJson(registry.path, null);
    if (!raw) {
      warnings.push({ registry: registry.id, path: relative(registry.path), warning: 'missing-or-invalid-json' });
      continue;
    }

    const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
    const normalized = tasks.map(task => normalizeRegistryTask(task, registry));
    for (const task of normalized) {
      if (requiresManualGate(task) && !/^manual_|^none_read_only$/.test(task.manualGate)) {
        warnings.push({
          registry: registry.id,
          sourceId: task.sourceId,
          warning: 'risky-task-without-manual-gate',
          manualGate: task.manualGate,
        });
      }
    }

    registries.push({
      id: registry.id,
      path: relative(registry.path),
      taskCount: normalized.length,
      lanes: countBy(normalized, task => task.lane),
      tasks: normalized,
    });
  }

  return { registries, warnings };
}

function normalizeRegistryTask(task, registry) {
  const probe = {
    type: task.task_type,
    id: task.source_id,
    action: JSON.stringify(task.payload || {}),
  };
  const dedupMinutes = Number(task.dedup_window_minutes || 0);
  return {
    registry: registry.id,
    taskType: task.task_type || 'unknown',
    sourceId: task.source_id || 'unknown',
    lane: task.lane || inferLane(probe),
    manualGate: task.manual_gate || task.payload?.review_gate || inferManualGate(probe),
    expectedArtifact: task.expected_artifact || inferExpectedArtifact(probe),
    dedupPolicy: task.dedup_policy || (dedupMinutes
      ? `${dedupMinutes}m window for ${task.source_id || task.task_type || 'task'}`
      : 'fingerprint ledger'),
    riskScore: Number(task.risk_score || 0),
    priorityBase: Number(task.priority_base || 0),
  };
}

function buildLooposSummary(candidates, autoCompletions, taskRegistry) {
  const laneItems = {};
  for (const lane of Object.keys(lanePriority)) {
    laneItems[lane] = {
      lane,
      selected: 0,
      blocked: 0,
      completed: 0,
      topScore: 0,
    };
  }

  for (const candidate of candidates || []) {
    const lane = candidate.lane || inferLane(candidate);
    const item = laneItems[lane] || (laneItems[lane] = { lane, selected: 0, blocked: 0, completed: 0, topScore: 0 });
    item.selected++;
    item.topScore = Math.max(item.topScore, Number(candidate.score || 0));
  }

  for (const completion of autoCompletions || []) {
    const lane = completion.lane || inferLane(completion);
    const item = laneItems[lane] || (laneItems[lane] = { lane, selected: 0, blocked: 0, completed: 0, topScore: 0 });
    if (completion.status === 'blocked') item.blocked++;
    if (completion.status === 'completed') item.completed++;
  }

  return {
    version: 1,
    lanes: Object.values(laneItems)
      .filter(item => item.selected || item.blocked || item.completed)
      .sort((a, b) => (lanePriority[b.lane] || 0) - (lanePriority[a.lane] || 0)),
    morningDecision: chooseMorningDecision(candidates, autoCompletions),
    redLines: manualRedLines,
    taskRegistry,
    governance: {
      statePath,
      runsDir,
      dashboardPath: path.join(stateDir, 'dashboard', 'latest.md'),
      memoryRule: 'Read automation state before each loop; write only redacted local run artifacts after each loop.',
    },
  };
}

function chooseMorningDecision(candidates, autoCompletions) {
  const blockedByLabel = new Map((autoCompletions || [])
    .filter(item => item.status === 'blocked')
    .map(item => [item.label, item]));

  const ranked = (candidates || []).map(candidate => {
    const lane = candidate.lane || inferLane(candidate);
    const gateWeight = candidate.manualGate && candidate.manualGate !== 'none_read_only' ? 0.06 : 0;
    const score = Number(candidate.score || 0)
      + (lanePriority[lane] || 0) * 0.08
      + gateWeight
      - Number(candidate.risk || 0) * 0.03;
    return { candidate, lane, score };
  }).sort((a, b) => b.score - a.score);

  const top = ranked[0]?.candidate || null;
  if (!top) {
    return {
      label: 'Heartbeat only',
      lane: 'repo-hygiene',
      action: 'No actionable LoopOS candidate was selected in this run.',
      manualGate: 'none_read_only',
      expectedArtifact: 'state heartbeat',
      why: 'No candidates discovered.',
    };
  }

  const blocked = blockedByLabel.get(top.id) || blockedByLabel.get(top.type) || null;
  return {
    label: top.title,
    lane: top.lane || inferLane(top),
    action: top.action,
    manualGate: top.manualGate || inferManualGate(top),
    expectedArtifact: top.expectedArtifact || inferExpectedArtifact(top),
    dedupPolicy: top.dedupPolicy || inferDedupPolicy(top),
    score: top.score,
    nextApproval: blocked?.nextApproval || classifyApproval(top.id, top),
    why: 'Highest combined LoopOS lane priority and candidate score.',
  };
}

async function acquireLock() {
  const token = randomUUID();
  const payload = {
    token,
    runId,
    pid: process.pid,
    startedAt: startedAt.toISOString(),
    expiresAt: new Date(Date.now() + lockTtlMs).toISOString(),
  };

  try {
    await fs.writeFile(lockPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    return { acquired: true, token };
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const owner = await readJson(lockPath, null);
    const expiresAt = owner?.expiresAt ? Date.parse(owner.expiresAt) : 0;
    const ownerAlive = isProcessAlive(owner?.pid);
    if ((Number.isFinite(expiresAt) && expiresAt < Date.now()) || ownerAlive === false) {
      await fs.unlink(lockPath).catch(() => {});
      await fs.writeFile(lockPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      return {
        acquired: true,
        token,
        staleReplaced: true,
        staleReason: ownerAlive === false ? 'owner-process-exited' : 'lock-expired',
      };
    }
    return { acquired: false, owner };
  }
}

async function releaseLock(token) {
  const owner = await readJson(lockPath, null);
  if (owner?.token === token) {
    await fs.unlink(lockPath).catch(() => {});
  }
}

function runCommand(command, args, timeout) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout,
    windowsHide: true,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || (result.error ? result.error.message : ''),
  };
}

function currentWorktreeFingerprint() {
  const status = runCommand('git', ['status', '--short'], 45_000);
  if (!status.ok) {
    return { ok: false, status: status.status, stderr: status.stderr };
  }
  const statusLines = status.stdout.split(/\r?\n/).filter(Boolean);
  return {
    ok: true,
    statusLines,
    statusFingerprint: gitWorktreeFingerprint({ cwd: repoRoot, statusLines }),
  };
}

async function ensureDirtyClassificationCurrent() {
  const current = currentWorktreeFingerprint();
  if (!current.ok) return null;
  const latest = await readJson(path.join(stateDir, 'dirty-worktree', 'latest.json'), null);
  if (latest?.statusFingerprint === current.statusFingerprint) return null;
  return runLocalStep(
    'classify-dirty-worktree',
    'node',
    ['scripts/loops-24/classify-dirty-worktree.mjs'],
    120_000
  );
}

function isProcessAlive(pid) {
  const numericPid = Number(pid);
  if (!Number.isInteger(numericPid) || numericPid <= 0) return null;
  try {
    process.kill(numericPid, 0);
    return true;
  } catch (error) {
    if (error && error.code === 'ESRCH') return false;
    return null;
  }
}

async function fetchJson(url) {
  if (onlySafeLocal) {
    return { ok: false, status: 0, error: 'external-fetch-disabled-by-only-safe-local' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: trim(text, 500) };
    }
    return { ok: response.ok && data?.ok !== false, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function readText(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return '';
  }
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function readDirSafe(dir) {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

function defaultState() {
  return {
    version: 1,
    automationId,
    runs: [],
    candidateLedger: {},
    next: [],
  };
}

function summarizeCandidate(candidate) {
  return {
    score: candidate.score,
    title: candidate.title,
    type: candidate.type,
    lane: candidate.lane || inferLane(candidate),
    id: candidate.id,
    action: candidate.action,
    manualGate: candidate.manualGate || inferManualGate(candidate),
    expectedArtifact: candidate.expectedArtifact || inferExpectedArtifact(candidate),
    dedupPolicy: candidate.dedupPolicy || inferDedupPolicy(candidate),
    fingerprint: candidate.fingerprint,
    firstSeenAt: candidate.firstSeenAt,
    ageHours: candidate.ageHours,
    escalated: candidate.escalated,
    escalation: candidate.escalation,
  };
}

function summarizeAutoCompletions(items) {
  const counts = countBy(items || [], item => item.status || 'unknown');
  return {
    enabled: autoCompleteEnabled,
    total: (items || []).length,
    completed: counts.completed || 0,
    blocked: counts.blocked || 0,
    failed: counts.failed || 0,
  };
}

function summarizeCompletion(item) {
  return {
    label: item.label,
    status: item.status,
    lane: item.lane || inferLane(item),
    summary: item.summary || item.reason || '',
    ageHours: item.ageHours || 0,
    firstSeenAt: item.firstSeenAt || null,
    escalated: Boolean(item.escalated),
    escalation: item.escalation || null,
    manualGate: item.manualGate || null,
    nextApproval: item.nextApproval || null,
    nextApprovals: item.nextApprovals || (item.nextApproval ? [item.nextApproval] : []),
  };
}

function inferLane(item = {}) {
  const text = `${item.lane || ''} ${item.label || ''} ${item.id || ''} ${item.type || ''} ${item.action || ''} ${item.title || ''}`.toLowerCase();
  if (/repo_health|worktree|commit boundary|snapshot dirty|dirty-worktree/.test(text)) return 'repo-hygiene';
  if (/draft|manual_send|cold_outreach|cold-outreach|send-only/.test(text)) return 'outreach-draft';
  if (/google|prospect|lead|revenue|cash|sales/.test(text)) return 'revenue';
  if (/deploy|worker|wrangler|cloudflare|cron|webhook|secret|social-publisher|health|queue|content/.test(text)) return 'deployment';
  if (/investor|fundraising|pitch|data-room|demo|record|showcase|script/.test(text)) return 'demo-sales';
  return 'repo-hygiene';
}

function inferManualGate(item = {}) {
  const text = `${item.manualGate || ''} ${item.label || ''} ${item.id || ''} ${item.type || ''} ${item.action || ''} ${item.title || ''}`.toLowerCase();
  if (/investor|fundraising|taiwania|pitch[-_ ]?deck|data[-_ ]?room|investor[-_ ]?packet/.test(text)) return 'manual_review_only';
  if (/secret|token|api-key|api_key|password/.test(text)) return 'manual_secret_input';
  if (/send|outreach|line|ig|email|bulk|publish/.test(text)) return 'manual_send_only';
  if (/deploy|wrangler|production|worker|cron/.test(text)) return 'manual_deploy_approval';
  if (/github|\bpr\b|local-pr|pull request|push|merge|issue/.test(text)) return 'manual_create_only';
  if (/frontend|handoff|slice|worktree|commit/.test(text)) return 'manual_review_only';
  return 'none_read_only';
}

function inferExpectedArtifact(item = {}) {
  const text = `${item.expectedArtifact || ''} ${item.label || ''} ${item.id || ''} ${item.type || ''} ${item.action || ''} ${item.title || ''}`.toLowerCase();
  if (/dashboard/.test(text)) return 'dashboard/latest.md';
  if (/secret|token|api-key|api_key|password|places api key|google_maps_api_key|google_places_api_key/.test(text)) return 'redacted secret-gate handoff';
  if (/deploy|worker|wrangler/.test(text)) return 'deploy-ready checklist';
  if (/github|\bpr\b|local-pr|pull request|push|issue/.test(text)) return 'local GitHub handoff draft';
  if (/investor|fundraising|taiwania|pitch[-_ ]?deck|data[-_ ]?room|investor[-_ ]?packet/.test(text)) return 'investor-review packet handoff';
  if (/outreach|prospect|cold|send/.test(text)) return 'manual-review outreach draft';
  if (/worktree|commit|slice/.test(text)) return 'snapshot and commit boundary plan';
  if (/health|cron|queue|content/.test(text)) return 'local health or reconciliation report';
  return 'local run report';
}

function inferDedupPolicy(item = {}) {
  if (item.dedupPolicy) return item.dedupPolicy;
  if (item.dedup_window_minutes) return `${item.dedup_window_minutes}m task dedup window`;
  return 'candidate fingerprint ledger with starvation scoring';
}

function requiresManualGate(task = {}) {
  const text = `${task.taskType || ''} ${task.sourceId || ''} ${task.manualGate || ''} ${task.expectedArtifact || ''}`.toLowerCase();
  return /investor|fundraising|taiwania|pitch[-_ ]?deck|data[-_ ]?room|outreach|send|github|issue|pr|push|deploy|worker|secret|token|publish/.test(text);
}

function summarizeManualWaits(candidates, autoCompletions = []) {
  const completedOrBlocked = new Set();
  for (const item of autoCompletions || []) {
    for (const key of [item.label, item.id, item.type]) {
      if (key) completedOrBlocked.add(String(key));
    }
  }

  return (candidates || [])
    .filter(candidate => {
      const manualGate = candidate.manualGate || inferManualGate(candidate);
      if (!manualGate || manualGate === 'none_read_only') return false;
      return ![candidate.id, candidate.type, candidate.title].some(key => key && completedOrBlocked.has(String(key)));
    })
    .map(candidate => {
      const manualGate = candidate.manualGate || inferManualGate(candidate);
      return {
        label: candidate.id || candidate.title || candidate.type || 'manual-gated-candidate',
        status: 'waiting',
        lane: candidate.lane || inferLane(candidate),
        summary: `Selected candidate waits at ${manualGate}: ${candidate.action}`,
        ageHours: candidate.ageHours || 0,
        firstSeenAt: candidate.firstSeenAt || null,
        escalated: Boolean(candidate.escalated),
        escalation: candidate.escalation || null,
        manualGate,
        nextApproval: classifyApproval(candidate.id || candidate.title || candidate.type, candidate),
        nextApprovals: classifyApprovalGates(candidate.id || candidate.title || candidate.type, candidate),
      };
    });
}

async function summarizeOwnerGateWaits() {
  const bundle = await readJson(path.join(stateDir, 'owner-approval-bundles', 'latest.json'), null);
  if (!bundle) return [];

  const currentHead = currentGitHead();
  if (!currentHead || bundle.head !== currentHead) return [];

  return (bundle.gates || [])
    .filter(gate => gate.id === 'investor_review'
      && ['attention', 'manual_approval', 'manual_input', 'ready_for_approval'].includes(gate.status))
    .map(gate => ({
      label: `owner-gate:${gate.id}`,
      status: 'waiting',
      lane: 'demo-sales',
      summary: `Review the investor packet separately before external use. Evidence: ${gate.evidence || '(none)'}`,
      ageHours: 0,
      firstSeenAt: null,
      escalated: false,
      escalation: null,
      manualGate: 'manual_investor_review',
      nextApproval: 'investor-review',
      nextApprovals: ['investor-review'],
    }));
}

function currentGitHead() {
  const head = runCommand('git', ['rev-parse', '--short', 'HEAD'], 45_000);
  return head.ok ? head.stdout.trim() : '';
}

function summarizeApprovals(blocked) {
  const groups = new Map();
  for (const item of blocked || []) {
    const keys = item.nextApprovals?.length ? item.nextApprovals : [item.nextApproval || 'review'];
    for (const key of keys) {
      const group = groups.get(key) || { approval: key, count: 0, escalated: 0, items: [] };
      group.count++;
      if (item.escalated) group.escalated++;
      group.items.push(summarizeCompletion(item));
      groups.set(key, group);
    }
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (b.escalated !== a.escalated) return b.escalated - a.escalated;
    return b.count - a.count;
  });
}

function summarizeConnectorHealthArtifact(data) {
  if (!data) return { available: false, summary: null, reportPath: null };
  return {
    available: true,
    generatedAt: data.generatedAt || null,
    reportPath: data.reportPath || null,
    onlySafeLocal: Boolean(data.onlySafeLocal),
    summary: data.summary || null,
  };
}

function summarizeSecretChecklistArtifact(data) {
  if (!data) return { available: false, summary: null, reportPath: null };
  return {
    available: true,
    generatedAt: data.generatedAt || null,
    reportPath: data.reportPath || null,
    sourceSecretGatesPath: data.sourceSecretGatesPath || null,
    summary: data.summary || null,
  };
}

function summarizeDirtyClassificationArtifact(data) {
  if (!data) return { available: false, summary: null, reportPath: null };
  return {
    available: true,
    generatedAt: data.generatedAt || null,
    reportPath: data.reportPath || null,
    statusFingerprint: data.statusFingerprint || null,
    summary: data.summary || null,
  };
}

function summarizeOwnerApprovalBundleArtifact(data, currentHead = '', relativeTo = new Date()) {
  if (!data) return { available: false, summary: null, reportPath: null };
  const summary = data.summary || {};
  const head = data.head || null;
  const wakeupFreshUntil = summary.wakeupFreshUntil || null;
  return {
    available: true,
    generatedAt: data.generatedAt || null,
    reportPath: data.reportPath || null,
    jsonPath: data.jsonPath || null,
    status: summary.status || data.status || null,
    head,
    headCurrent: Boolean(currentHead && head === currentHead),
    ahead: data.ahead ?? null,
    behind: data.behind ?? null,
    bundleFingerprint: data.bundleFingerprint || null,
    summary: {
      status: summary.status || data.status || null,
      readyGateCount: Number(summary.readyGateCount || 0),
      attentionCount: Number(summary.attentionCount || 0),
      manualApprovalCount: Number(summary.manualApprovalCount || 0),
      manualInputCount: Number(summary.manualInputCount || 0),
      prPublishReady: summary.prPublishReady ?? null,
      workerReady: summary.workerReady ?? null,
      wakeupFresh: summary.wakeupFresh ?? null,
      wakeupFreshUntil,
      wakeupFreshInMinutes: minutesUntil(wakeupFreshUntil, relativeTo),
      powerWakeNeedsApproval: summary.powerWakeNeedsApproval ?? null,
      localScopeClean: summary.localScopeClean ?? null,
      localInvestorPacketCount: Number(summary.localInvestorPacketCount || 0),
    },
  };
}

function summarizeApprovalWorkbenchArtifact(data, relativeTo = new Date()) {
  if (!data) return { available: false, summary: null, reportPath: null };
  const expiresAt = data.expiresAt || data.summary?.expiresAt || null;
  const expiresAtTaipei = formatTaipeiTime(expiresAt);
  const expiresInMinutes = minutesUntil(expiresAt, relativeTo);
  const expired = isTimestampExpired(expiresAt, relativeTo);
  return {
    available: true,
    generatedAt: data.generatedAt || null,
    reportPath: data.reportPath || null,
    jsonPath: data.jsonPath || null,
    status: data.status || null,
    bundleFingerprint: data.bundleFingerprint || null,
    projectionFingerprint: data.projectionFingerprint || null,
    summary: {
      ...(data.summary || {}),
      expiresAt,
      expiresAtTaipei,
      expiresInMinutes,
      expired,
    },
  };
}

function renderConnectorHealth(data) {
  if (!data?.available) return ['- No connector health artifact yet.'];
  const summary = data.summary || {};
  return [
    `- report: ${data.reportPath || '(missing)'}`,
    `- ready: ${summary.readyCount || 0}/${summary.total || 0}`,
    `- attention: ${summary.attentionCount || 0}`,
    `- missing: ${summary.missingIds?.length ? summary.missingIds.join(', ') : '(none)'}`,
    `- failed_or_expired: ${summary.failedIds?.length ? summary.failedIds.join(', ') : '(none)'}`,
    `- app_auth_unverified: ${summary.authUnverifiedIds?.length ? summary.authUnverifiedIds.join(', ') : '(none)'}`,
  ];
}

function renderSecretChecklist(data) {
  if (!data?.available) return ['- No secret checklist artifact yet.'];
  const summary = data.summary || {};
  return [
    `- report: ${data.reportPath || '(missing)'}`,
    `- source_secret_gates: ${data.sourceSecretGatesPath || '(missing)'}`,
    `- ready_for_runner_wrapper: ${summary.readyForWrapperCount || 0}/${summary.total || 0}`,
    `- missing: ${summary.missing?.length ? summary.missing.join(', ') : '(none)'}`,
  ];
}

function renderDirtyClassification(data) {
  if (!data?.available) return ['- No dirty worktree classification artifact yet.'];
  const summary = data.summary || {};
  return [
    `- report: ${data.reportPath || '(missing)'}`,
    `- deploy: ${summary.deploy || 0}`,
    `- investor: ${summary.investor || 0}`,
    `- repo_hygiene: ${summary.repoHygiene || 0}`,
    `- other: ${summary.other || 0}`,
  ];
}

function renderOwnerApprovalBundle(data) {
  if (!data?.available) return ['- No owner approval bundle artifact yet.'];
  const summary = data.summary || {};
  return [
    `- report: ${data.reportPath || '(missing)'}`,
    `- status: ${data.status || '(unknown)'}`,
    `- head: ${data.head || '(missing)'}`,
    `- head_current: ${data.headCurrent === true}`,
    `- ahead: ${data.ahead ?? '(unknown)'}`,
    `- behind: ${data.behind ?? '(unknown)'}`,
    `- ready_gates: ${summary.readyGateCount ?? 0}`,
    `- attention: ${summary.attentionCount ?? 0}`,
    `- manual_approval: ${summary.manualApprovalCount ?? 0}`,
    `- manual_input: ${summary.manualInputCount ?? 0}`,
    `- pr_publish_ready: ${summary.prPublishReady === true}`,
    `- worker_ready: ${summary.workerReady === true}`,
    `- local_scope_clean: ${summary.localScopeClean === true}`,
    `- wakeup_fresh: ${summary.wakeupFresh === true}`,
    `- wakeup_fresh_until: ${summary.wakeupFreshUntil || '(unknown)'}`,
    `- wakeup_fresh_in_minutes: ${summary.wakeupFreshInMinutes ?? '(unknown)'}`,
    `- power_wake_needs_approval: ${summary.powerWakeNeedsApproval === true}`,
  ];
}

function renderApprovalWorkbench(data) {
  if (!data?.available) return ['- No approval workbench artifact yet.'];
  const summary = data.summary || {};
  return [
    `- report: ${data.reportPath || '(missing)'}`,
    `- status: ${data.status || '(unknown)'}`,
    `- expires_at: ${summary.expiresAt || '(missing)'}`,
    `- expires_at_taipei: ${summary.expiresAtTaipei || '(unknown)'}`,
    `- expires_in_minutes: ${summary.expiresInMinutes ?? '(unknown)'}`,
    `- expired: ${summary.expired === true}`,
    `- ready_commands: ${summary.readyCommandCount ?? 0}`,
    `- manual_gates: ${summary.manualGateCount ?? 0}`,
    `- attention_gates: ${summary.attentionGateCount ?? 0}`,
    `- verification_failures: ${summary.verificationFailureCount ?? 0}`,
  ];
}

function renderDashboardList(items, emptyText) {
  if (!items.length) return [emptyText];
  return items.map(item => {
    const age = item.ageHours ? ` age=${Number(item.ageHours).toFixed(1)}h` : '';
    const escalation = item.escalated ? ' ESCALATED' : '';
    return `- ${item.label}${escalation}${age}: ${item.summary}`;
  });
}

function renderApprovalList(groups) {
  if (!groups.length) return ['- No approval gates in this run.'];
  const lines = [];
  for (const group of groups) {
    const escalation = group.escalated ? ` escalated=${group.escalated}` : '';
    lines.push(`- ${group.approval}: ${group.count} waiting${escalation}`);
    for (const item of group.items.slice(0, 4)) {
      const marker = item.escalated ? ' ESCALATED' : '';
      lines.push(`  - ${item.label}${marker}`);
    }
  }
  return lines;
}

function renderMorningDecision(decision) {
  if (!decision) return ['- No LoopOS decision generated.'];
  const lines = [
    `- highest_profit_next_action: ${decision.label}`,
    `- lane: ${decision.lane}`,
    `- action: ${decision.action}`,
    `- manual_gate: ${decision.manualGate}`,
    `- expected_artifact: ${decision.expectedArtifact}`,
  ];
  if (decision.nextApproval) lines.push(`- next_approval: ${decision.nextApproval}`);
  if (decision.dedupPolicy) lines.push(`- dedup_policy: ${decision.dedupPolicy}`);
  if (typeof decision.score === 'number') lines.push(`- score: ${decision.score.toFixed(3)}`);
  lines.push(`- why: ${decision.why}`);
  return lines;
}

function renderLaneSummary(lanes) {
  if (!lanes || lanes.length === 0) return ['- No lane activity in this run.'];
  return lanes.map(item => (
    `- ${item.lane}: selected=${item.selected || 0}, completed=${item.completed || 0}, blocked=${item.blocked || 0}, top_score=${Number(item.topScore || 0).toFixed(3)}`
  ));
}

function countBy(items, pickKey) {
  const out = {};
  for (const item of items || []) {
    const key = pickKey(item);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function maybeDecodeBase64(value) {
  const compact = value.replace(/\s+/g, '');
  if (compact.length < 80 || compact.length % 4 !== 0 || !/^[A-Za-z0-9+/=]+$/.test(compact)) return '';
  try {
    return Buffer.from(compact, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

function norm(value) {
  const n = Number(value || 0);
  return Math.max(0, Math.min(1, n));
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function isTimestampExpired(value, relativeTo = new Date()) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return null;
  return timestamp <= relativeTo.getTime();
}

function minutesUntil(value, relativeTo = new Date()) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return null;
  return round((timestamp - relativeTo.getTime()) / 60_000);
}

function formatTaipeiTime(value) {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return null;
  const taipei = new Date(timestamp + 8 * 60 * 60 * 1000);
  const pad = number => String(number).padStart(2, '0');
  return [
    `${taipei.getUTCFullYear()}-${pad(taipei.getUTCMonth() + 1)}-${pad(taipei.getUTCDate())}`,
    `${pad(taipei.getUTCHours())}:${pad(taipei.getUTCMinutes())}:${pad(taipei.getUTCSeconds())}`,
    '+08:00',
  ].join(' ');
}

function minutes(value) {
  return Number.parseInt(value, 10) * 60 * 1000;
}

function trim(value, max) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll(path.sep, '/');
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : '';
}

function extractWranglerCrons(text) {
  const out = [];
  let inTriggers = false;
  let inCrons = false;

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;

    if (/^\[[^\]]+\]$/.test(line)) {
      inTriggers = line === '[triggers]';
      inCrons = false;
      continue;
    }

    if (!inTriggers) continue;

    if (/^crons\s*=/.test(line)) {
      inCrons = true;
      collectQuotedValues(line, out);
      if (line.includes(']')) inCrons = false;
      continue;
    }

    if (inCrons) {
      collectQuotedValues(line, out);
      if (line.includes(']')) inCrons = false;
    }
  }

  return out;
}

function collectQuotedValues(line, out) {
  for (const match of line.matchAll(/"([^"]+)"/g)) out.push(match[1]);
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '<invalid-url>';
  }
}

function redactEvidence(value) {
  if (Array.isArray(value)) return value.map(redactEvidence);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (/token|secret|password|authorization|access[_-]?key/i.test(key)) {
        out[key] = '<redacted>';
      } else {
        out[key] = redactEvidence(item);
      }
    }
    return out;
  }
  return value;
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function truthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

main();
