#!/usr/bin/env node
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { previewColdOutreachCandidate } from '../lib/cold-outreach.mjs';
import { previewGoogleBusinessProspectingCandidate } from '../lib/google-business-prospector.mjs';

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

const codexHome = process.env.CODEX_HOME
  || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.codex') : path.join(os.homedir(), '.codex'));

const stateDir = path.resolve(
  process.env.LOOPS_STATE_DIR || path.join(codexHome, 'automations', automationId)
);

const runsDir = path.join(stateDir, 'runs');
const statePath = path.join(stateDir, 'state.json');
const lockPath = path.join(stateDir, 'lock.json');

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
    const ctx = { previousState };

    candidates = [
      ...(await discoverProjectState(ctx)),
      ...(await discoverGitState(ctx)),
      ...(await discoverGithubPublication(ctx)),
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

    result = {
      runId,
      automationId,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      status: 'success',
      repoRoot,
      stateDir,
      candidateCount: candidates.length,
      selectedCount: scored.length,
      topCandidate: scored[0] ? summarizeCandidate(scored[0]) : null,
      autoComplete: summarizeAutoCompletions(autoCompletions),
    };

    await writeReport(result, scored, autoCompletions);
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
  const statusFingerprint = hash(lines.join('\n'));
  const latestSnapshot = await readJson(path.join(stateDir, 'worktree-snapshots', 'latest.json'), null);
  const snapshotCurrent = latestSnapshot?.statusFingerprint === statusFingerprint;
  const latestBoundaryPlan = await readJson(path.join(stateDir, 'commit-boundaries', 'latest.json'), null);
  const boundaryPlanCurrent = latestBoundaryPlan?.statusFingerprint === statusFingerprint;
  const latestSliceHandoff = await readJson(path.join(stateDir, 'slice-handoffs', 'loops_control_plane-latest.json'), null);
  const sliceHandoffCurrent = latestSliceHandoff?.statusFingerprint === statusFingerprint;
  const latestFrontendReview = await readJson(path.join(stateDir, 'frontend-artifact-reviews', 'latest.json'), null);
  const frontendReviewCurrent = latestFrontendReview?.statusFingerprint === statusFingerprint;

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
  const statusFingerprint = hash(statusLines.join('\n'));
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

async function discoverFrontendArtifacts() {
  const status = runCommand('git', ['status', '--short'], 45_000);
  if (!status.ok) return [];

  const statusLines = status.stdout.split(/\r?\n/).filter(Boolean);
  const statusFingerprint = hash(statusLines.join('\n'));
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

  if (ids.has('github-local-pr-handoff-needed')) {
    completions.push(runLocalStep(
      'prepare-github-handoff',
      'node',
      ['scripts/loops-24/prepare-github-handoff.mjs'],
      120_000
    ));
  } else if (ids.has('github-local-pr-handoff-ready')) {
    const candidate = byId.get('github-local-pr-handoff-ready');
    completions.push(blockedCompletion(
      'github-local-pr-handoff-ready',
      `GitHub handoff already exists: ${candidate?.evidence?.handoffPath || path.join(stateDir, 'github-handoffs')}; push and PR creation require approval.`
    ));
  }

  if (ids.has('dirty-worktree')) {
    const dirty = byId.get('dirty-worktree');
    if (dirty?.evidence?.sliceHandoffPath) {
      completions.push(blockedCompletion(
        'dirty-worktree',
        `Current slice handoff already exists: ${dirty.evidence.sliceHandoffPath}`
      ));
    } else {
      if (!dirty?.evidence?.snapshotPath) {
        completions.push(runLocalStep('snapshot-worktree', 'node', ['scripts/loops-24/snapshot-worktree.mjs'], 120_000));
      }
      if (!dirty?.evidence?.boundaryPlanPath) {
        completions.push(runLocalStep('plan-commit-boundaries', 'node', ['scripts/loops-24/plan-commit-boundaries.mjs'], 120_000));
      }

      const boundary = await readJson(path.join(stateDir, 'commit-boundaries', 'latest.json'), null);
      const groups = Array.isArray(boundary?.groups) ? boundary.groups : [];
      for (const group of groups) {
        if (group.gate === 'large-payload-review') {
          const latestReview = await readJson(path.join(stateDir, 'frontend-artifact-reviews', 'latest.json'), null);
          const groupFingerprint = hash((group.paths || []).slice().sort().join('\n'));
          if (latestReview?.statusFingerprint === boundary.statusFingerprint
            && latestReview?.groupFingerprint === groupFingerprint) {
            completions.push(blockedCompletion(
              `review:${group.id}`,
              `Current frontend/artifact review already exists: ${latestReview.reportPath}`
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
      completions.push(blockedCompletion('audit-wrangler-cache', `Current Wrangler audit already exists: ${candidate.evidence.auditPath}`));
    } else {
      completions.push(runLocalStep('audit-wrangler-cache', 'node', ['scripts/loops-24/audit-wrangler-cache.mjs'], 120_000));
    }
  }

  if (ids.has('content-queue-seed-inventory')) {
    const candidate = byId.get('content-queue-seed-inventory');
    if (candidate?.evidence?.reconciliation?.reportPath) {
      completions.push(blockedCompletion('reconcile-content-queue', `Current reconciliation already exists: ${candidate.evidence.reconciliation.reportPath}`));
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
  }

  const outreachCandidate = candidates.find(candidate => candidate.id?.startsWith('cold-outreach-batch-'));
  if (outreachCandidate) {
    completions.push(runLocalStep('generate-cold-outreach-drafts', 'node', ['scripts/loops-24/generate-cold-outreach.mjs'], 120_000));
  }

  for (const candidate of candidates) {
    if (candidate.id === 'google-prospecting-api-key-missing') {
      completions.push(blockedCompletion(candidate.id, 'Needs GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY; review the secret-gates handoff, then add the value only to the local runner environment.'));
    } else if (candidate.id === 'social-publisher-token-missing') {
      completions.push(blockedCompletion(candidate.id, 'Needs SOCIAL_PUBLISHER_TOKEN or TRIGGER_TOKEN; review the secret-gates handoff, then add the value only to the local runner environment.'));
    } else if (candidate.id === 'social-publisher-health-failed') {
      completions.push(blockedCompletion(candidate.id, 'Live worker repair requires deployment review.'));
    } else if (candidate.id === 'webhook-cron-map') {
      completions.push(blockedCompletion(candidate.id, 'Cron status verification waits for deploy approval and TRIGGER_TOKEN.'));
    } else if (candidate.id === 'project-state-base64') {
      completions.push(blockedCompletion(candidate.id, 'Project-state normalization edits a tracked file and needs local review first.'));
    } else if (candidate.id === 'cold-outreach-cooldown-active') {
      completions.push(blockedCompletion(candidate.id, 'Outreach drafts already exist or prospects are cooling down; sending remains manual.'));
    } else if (candidate.id === 'cold-outreach-needs-prospects') {
      completions.push(blockedCompletion(candidate.id, 'Needs fresh reviewed prospects before drafts can be generated.'));
    } else if (candidate.id === 'frontend-artifacts-review-ready') {
      const latestHandoff = await readJson(path.join(stateDir, 'frontend-slice-handoffs', 'latest.json'), null);
      if (latestHandoff?.statusFingerprint === candidate.evidence?.statusFingerprint
        && latestHandoff?.groupFingerprint === candidate.evidence?.groupFingerprint) {
        completions.push(blockedCompletion(candidate.id, `Frontend slice handoffs already exist: ${path.join(stateDir, 'frontend-slice-handoffs')}`));
      } else {
        const latestReview = await readJson(path.join(stateDir, 'frontend-artifact-reviews', 'latest.json'), null);
        const currentStatus = runCommand('git', ['status', '--short'], 45_000);
        const currentFingerprint = currentStatus.ok
          ? hash(currentStatus.stdout.split(/\r?\n/).filter(Boolean).join('\n'))
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
      completions.push(blockedCompletion(candidate.id, 'Frontend slice handoffs exist; staging each slice still needs review and the generated stage script must be run manually.'));
    }
  }

  return completions;
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

function blockedCompletion(label, reason) {
  return {
    label,
    status: 'blocked',
    reason,
    summary: reason,
  };
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
    const fingerprint = hash(`${candidate.type}:${candidate.id}:${candidate.fingerprintSeed || JSON.stringify(candidate.evidence || {})}`);
    const ledger = seen[fingerprint];
    const firstSeenAt = ledger?.firstSeenAt ? Date.parse(ledger.firstSeenAt) : now;
    const ageHours = Math.max(0, (now - firstSeenAt) / 3_600_000);
    const starvation = Math.min(1, ageHours / 24);
    const duplicatePenalty = ledger?.lastSeenAt ? Math.min(0.35, (ledger.count || 1) * 0.04) : 0;
    const retryPenalty = candidate.retryPenalty || 0;

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

    return { ...candidate, score, fingerprint, firstSeenAt: new Date(firstSeenAt).toISOString(), seenCount: ledger?.count || 0 };
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
      lines.push(`  - id: ${candidate.id}`);
      lines.push(`  - action: ${candidate.action}`);
      lines.push(`  - fingerprint: ${candidate.fingerprint}`);
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
  lines.push('- Secrets are never written to the report.');
  lines.push('');

  await fs.writeFile(reportPath, `${lines.join('\n')}\n`, 'utf8');
  result.reportPath = reportPath;
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
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
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
    if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
      await fs.unlink(lockPath).catch(() => {});
      await fs.writeFile(lockPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      return { acquired: true, token, staleReplaced: true };
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

async function fetchJson(url) {
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
    id: candidate.id,
    action: candidate.action,
    fingerprint: candidate.fingerprint,
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
    summary: item.summary || item.reason || '',
  };
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

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function truthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

main();
