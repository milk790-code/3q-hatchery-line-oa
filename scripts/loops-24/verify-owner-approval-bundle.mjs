#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gitWorktreeFingerprint } from './lib/git-worktree-fingerprint.mjs';

const automationId = process.env.LOOPS_AUTOMATION_ID || 'loops-24';
const repoRoot = path.resolve(process.env.LOOPS_REPO_ROOT || process.cwd());
const codexHome = process.env.CODEX_HOME
  || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.codex') : path.join(os.homedir(), '.codex'));
const stateDir = path.resolve(process.env.LOOPS_STATE_DIR || path.join(codexHome, 'automations', automationId));
const args = parseArgs(process.argv.slice(2));
const bundleJsonPath = path.resolve(args.bundleJson || path.join(stateDir, 'owner-approval-bundles', 'latest.json'));
const verificationDir = path.join(stateDir, 'owner-approval-verifications');
const gitTimeoutMs = Number.parseInt(process.env.LOOPS_GIT_TIMEOUT_MS || '30000', 10);
const now = new Date();
const stamp = toStamp(now);

const bundle = await readJson(bundleJsonPath);
const context = readCurrentGitContext();
const related = {
  pr: await readJson(path.join(stateDir, 'pr-readiness', 'latest.json'), null),
  wakeup: await readJson(path.join(stateDir, 'wakeup-health', 'latest.json'), null),
  dashboard: await readJson(path.join(stateDir, 'dashboard', 'latest.json'), null),
  dashboardGates: await readJson(path.join(stateDir, 'dashboard-verifications', 'latest.json'), null),
};

const findings = verifyBundle(bundle, context, related);
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  automationId,
  stateDir,
  bundleJsonPath,
  bundleReportPath: bundle.reportPath || null,
  bundleFingerprint: bundle.bundleFingerprint || null,
  reportPath: path.join(verificationDir, `${stamp}-owner-approval-verification.md`),
  jsonPath: path.join(verificationDir, `${stamp}-owner-approval-verification.json`),
  latestPath: path.join(verificationDir, 'latest.json'),
  ok: findings.failures.length === 0,
  summary: {
    gateCount: Array.isArray(bundle.gates) ? bundle.gates.length : 0,
    readyGateCount: bundle.summary?.readyGateCount ?? null,
    failureCount: findings.failures.length,
    warningCount: findings.warnings.length,
  },
  findings,
  statusFingerprint: hash(JSON.stringify({
    bundleFingerprint: bundle.bundleFingerprint || null,
    head: bundle.head || null,
    ahead: bundle.ahead ?? null,
    behind: bundle.behind ?? null,
    summary: bundle.summary || null,
    gates: (bundle.gates || []).map(gate => ({
      id: gate.id,
      status: gate.status,
      evidence: gate.evidence,
    })),
    failures: findings.failures,
  })),
};

await fs.mkdir(verificationDir, { recursive: true });
await fs.writeFile(payload.jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: payload.ok,
  reportPath: payload.reportPath,
  jsonPath: payload.jsonPath,
  summary: payload.summary,
}, null, 2));

if (!payload.ok) process.exitCode = 1;

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--bundle-json') {
      parsed.bundleJson = argv[index + 1];
      index += 1;
    }
  }
  return parsed;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (arguments.length > 1) return fallback;
    throw new Error(`Unable to read JSON at ${file}: ${error.message}`);
  }
}

function readCurrentGitContext() {
  const branch = runGit(['branch', '--show-current']).trim();
  const upstream = runGitMaybe(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']).stdout.trim();
  const head = runGit(['rev-parse', '--short', 'HEAD']).trim();
  const counts = upstream
    ? runGit(['rev-list', '--left-right', '--count', `${upstream}...HEAD`]).trim().split(/\s+/)
    : ['0', '0'];
  const statusLines = runGit(['status', '--short']).split(/\r?\n/).filter(Boolean);
  const trackedDirtyLines = runGit(['status', '--short', '--untracked-files=no']).split(/\r?\n/).filter(Boolean);
  const stagedLines = runGit(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean);
  const untrackedPaths = statusLines
    .map(parseStatusLine)
    .filter(item => item.status === '??')
    .map(item => item.path);
  return {
    branch,
    upstream,
    head,
    behind: Number.parseInt(counts[0] || '0', 10),
    ahead: Number.parseInt(counts[1] || '0', 10),
    statusFingerprint: gitWorktreeFingerprint({ cwd: repoRoot, statusLines }),
    trackedStatusFingerprint: gitWorktreeFingerprint({ cwd: repoRoot, statusLines: trackedDirtyLines }),
    dirtyPaths: trackedDirtyLines.map(parseStatusLine).map(item => item.path),
    untrackedPaths,
    localInvestorPacketPaths: listLocalInvestorPacketPaths(),
    stagedLines,
  };
}

function verifyBundle(bundle, context, related) {
  const failures = [];
  const warnings = [];
  const gateById = new Map((bundle.gates || []).map(gate => [gate.id, gate]));
  const expectedReadyGateCount = (bundle.gates || [])
    .filter(gate => gate.status === 'ready' || gate.status === 'ready_for_approval')
    .length;
  const expectedAttentionCount = (bundle.gates || []).filter(gate => gate.status === 'attention').length;
  const expectedManualApprovalCount = (bundle.gates || [])
    .filter(gate => gate.status === 'manual_approval' || gate.status === 'ready_for_approval')
    .length;
  const expectedManualInputCount = (bundle.gates || []).filter(gate => gate.status === 'manual_input').length;
  const expectedSummaryStatus = expectedAttentionCount ? 'attention' : 'ready-for-owner-approval';

  requireEqual(failures, 'branch', bundle.branch, context.branch);
  requireEqual(failures, 'upstream', bundle.upstream || '', context.upstream || '');
  requireEqual(failures, 'head', bundle.head, context.head);
  requireEqual(failures, 'ahead', Number(bundle.ahead), context.ahead);
  requireEqual(failures, 'behind', Number(bundle.behind), context.behind);
  requireEqual(failures, 'statusFingerprint', bundle.statusFingerprint, context.statusFingerprint);
  requireEqual(failures, 'trackedStatusFingerprint', bundle.trackedStatusFingerprint, context.trackedStatusFingerprint);
  requireEqual(failures, 'status', bundle.status, expectedSummaryStatus);
  requireEqual(failures, 'summary.status', bundle.summary?.status, expectedSummaryStatus);
  requireEqual(failures, 'status summary mirror', bundle.status, bundle.summary?.status);
  requireEqual(failures, 'summary.readyGateCount', Number(bundle.summary?.readyGateCount), expectedReadyGateCount);
  requireEqual(failures, 'summary.attentionCount', Number(bundle.summary?.attentionCount), expectedAttentionCount);
  requireEqual(failures, 'summary.manualApprovalCount', Number(bundle.summary?.manualApprovalCount), expectedManualApprovalCount);
  requireEqual(failures, 'summary.manualInputCount', Number(bundle.summary?.manualInputCount), expectedManualInputCount);

  const expectedDirtyDeployFiles = Array.isArray(bundle.expectedDirtyDeployFiles) ? bundle.expectedDirtyDeployFiles : [];
  const expectedUnexpectedDirty = context.dirtyPaths.filter(file => !expectedDirtyDeployFiles.includes(file));
  const expectedUnexpectedUntracked = context.untrackedPaths.filter(file => !expectedDirtyDeployFiles.includes(file));
  const expectedGateIds = ['local_review', 'wakeup_health', 'power_wake_policy', 'dashboard_gate_verification', 'push_draft_pr', 'worker_deploy', 'secret_input', 'post_deploy_verification', 'manual_send'];
  if (context.localInvestorPacketPaths.length) {
    expectedGateIds.push('investor_review');
  }

  for (const id of expectedGateIds) {
    if (!gateById.has(id)) failures.push(`missing gate ${id}`);
  }

  const localScopeClean = Boolean(!context.stagedLines.length
    && arrayEqual(bundle.dirtyTracked || [], context.dirtyPaths.map(file => ` M ${file}`))
    && arrayEqual(bundle.untracked || [], context.untrackedPaths)
    && arrayEqual(bundle.unexpectedDirty || [], expectedUnexpectedDirty)
    && arrayEqual(bundle.unexpectedUntracked || [], expectedUnexpectedUntracked)
    && expectedUnexpectedDirty.length === 0
    && expectedUnexpectedUntracked.length === 0);
  if (bundle.summary?.localScopeClean !== localScopeClean) {
    failures.push(`summary.localScopeClean expected ${localScopeClean} got ${bundle.summary?.localScopeClean}`);
  }
  if (!arrayEqual(bundle.untracked || [], context.untrackedPaths)) {
    failures.push(`untracked paths expected ${context.untrackedPaths.join(', ') || '(none)'} got ${(bundle.untracked || []).join(', ') || '(none)'}`);
  }
  if (!arrayEqual(bundle.unexpectedDirty || [], expectedUnexpectedDirty)) {
    failures.push(`unexpectedDirty expected ${expectedUnexpectedDirty.join(', ') || '(none)'} got ${(bundle.unexpectedDirty || []).join(', ') || '(none)'}`);
  }
  if (!arrayEqual(bundle.unexpectedUntracked || [], expectedUnexpectedUntracked)) {
    failures.push(`unexpectedUntracked expected ${expectedUnexpectedUntracked.join(', ') || '(none)'} got ${(bundle.unexpectedUntracked || []).join(', ') || '(none)'}`);
  }
  if (!arrayEqual(bundle.localInvestorPacketPaths || [], context.localInvestorPacketPaths)) {
    failures.push(`localInvestorPacketPaths expected ${context.localInvestorPacketPaths.length} path(s) got ${(bundle.localInvestorPacketPaths || []).length}`);
  }
  if (Number(bundle.summary?.localInvestorPacketCount || 0) !== context.localInvestorPacketPaths.length) {
    failures.push(`summary.localInvestorPacketCount expected ${context.localInvestorPacketPaths.length} got ${bundle.summary?.localInvestorPacketCount}`);
  }
  if (context.localInvestorPacketPaths.length && gateById.get('investor_review')?.status !== 'manual_approval') {
    failures.push(`investor_review gate has unexpected status ${gateById.get('investor_review')?.status}`);
  }
  if (context.stagedLines.length) failures.push(`staged files present: ${context.stagedLines.join(', ')}`);

  verifyPrGate(bundle, related.pr, gateById.get('push_draft_pr'), localScopeClean, failures, warnings);
  verifyWakeupGate(bundle, related.wakeup, gateById.get('wakeup_health'), failures);
  verifyPowerWakeGate(bundle, related.wakeup, gateById.get('power_wake_policy'), failures);
  verifyDashboardGate(bundle, related.dashboard, related.dashboardGates, gateById.get('dashboard_gate_verification'), failures);
  verifyManualCommands(bundle, gateById, failures);

  return { failures, warnings };
}

function verifyPrGate(bundle, pr, gate, localScopeClean, failures, warnings) {
  const prRefCurrent = Boolean(pr
    && pr.branch === bundle.branch
    && pr.upstream === bundle.upstream
    && pr.head === bundle.head
    && pr.ahead === bundle.ahead
    && pr.behind === bundle.behind);
  const prFingerprintCurrent = Boolean(pr && pr.statusFingerprint === bundle.trackedStatusFingerprint);
  const prHandoffCurrent = Boolean(pr && pr.githubHandoffPath === bundle.artifacts?.githubHandoff);
  const prPacketReady = Boolean(pr?.summary?.readyForApproval === true && prRefCurrent && prHandoffCurrent);
  const prReady = Boolean(prPacketReady && prFingerprintCurrent && localScopeClean);
  const prPublishReady = Boolean(prReady && bundle.ahead > 0 && bundle.behind === 0);
  requireEqual(failures, 'summary.prPacketReady', bundle.summary?.prPacketReady, prPacketReady);
  requireEqual(failures, 'summary.prRefCurrent', bundle.summary?.prRefCurrent, prRefCurrent);
  requireEqual(failures, 'summary.prFingerprintCurrent', bundle.summary?.prFingerprintCurrent, prFingerprintCurrent);
  requireEqual(failures, 'summary.prHandoffCurrent', bundle.summary?.prHandoffCurrent, prHandoffCurrent);
  requireEqual(failures, 'summary.prPublishReady', bundle.summary?.prPublishReady, prPublishReady);
  if (bundle.summary?.prReady !== prReady) {
    failures.push(`summary.prReady expected ${prReady} got ${bundle.summary?.prReady}`);
  }
  if (gate?.status !== (prPublishReady ? 'ready_for_approval' : 'attention')) {
    failures.push(`push_draft_pr gate has unexpected status ${gate?.status}`);
  }
  if (prPublishReady) {
    const bodyFile = pr.reportPath || '';
    const commands = gate?.commands || [];
    if (!commands.some(command => command === `git push origin ${bundle.branch}`)) {
      failures.push('push_draft_pr gate is missing git push command');
    }
    if (!commands.some(command => command.includes(`--body-file "${bodyFile}"`))) {
      failures.push('push_draft_pr gate does not use the current PR readiness body file');
    }
  } else if ((gate?.commands || []).length) {
    failures.push('push_draft_pr gate exposes commands while PR readiness is not current');
  } else if (!pr) {
    warnings.push('PR readiness packet is missing.');
  }
}

function verifyWakeupGate(bundle, wakeup, gate, failures) {
  const limit = Number.parseFloat(process.env.LOOPS_WAKEUP_REPORT_FRESH_MINUTES || '65');
  const relativeTo = new Date(bundle.generatedAt || Date.now());
  const nextRunGraceMinutes = Number.parseFloat(process.env.LOOPS_WAKEUP_NEXT_RUN_GRACE_MINUTES || '5');
  const age = ageMinutes(wakeup?.generatedAt, relativeTo);
  const nextRunAge = scheduledTaskNextRunAgeMinutes(wakeup, relativeTo);
  const scheduleFresh = !isWakeupScheduleEvidenceStale(wakeup, relativeTo, nextRunGraceMinutes);
  const fresh = age !== null && age <= limit && scheduleFresh;
  const expectedFreshUntil = freshUntil(wakeup?.generatedAt, limit);
  const expectedFreshRemaining = freshRemainingMinutes(age, limit);
  const expectedMinReviewWindow = Number.parseFloat(process.env.LOOPS_WAKEUP_MIN_REVIEW_WINDOW_MINUTES || '30');
  const ok = Boolean(wakeup?.health?.ok === true && fresh);
  if (bundle.summary?.wakeupOk !== ok) failures.push(`summary.wakeupOk expected ${ok} got ${bundle.summary?.wakeupOk}`);
  if (bundle.summary?.wakeupFresh !== fresh) failures.push(`summary.wakeupFresh expected ${fresh} got ${bundle.summary?.wakeupFresh}`);
  if (bundle.summary?.wakeupFreshUntil !== expectedFreshUntil) {
    failures.push(`summary.wakeupFreshUntil expected ${expectedFreshUntil} got ${bundle.summary?.wakeupFreshUntil}`);
  }
  if (bundle.summary?.wakeupFreshRemainingMinutes !== (expectedFreshRemaining === null ? null : round(expectedFreshRemaining))) {
    failures.push(`summary.wakeupFreshRemainingMinutes expected ${expectedFreshRemaining === null ? null : round(expectedFreshRemaining)} got ${bundle.summary?.wakeupFreshRemainingMinutes}`);
  }
  if (Number(bundle.summary?.wakeupMinReviewWindowMinutes) !== expectedMinReviewWindow) {
    failures.push(`summary.wakeupMinReviewWindowMinutes expected ${expectedMinReviewWindow} got ${bundle.summary?.wakeupMinReviewWindowMinutes}`);
  }
  if (bundle.summary?.wakeupScheduleFresh !== scheduleFresh) failures.push(`summary.wakeupScheduleFresh expected ${scheduleFresh} got ${bundle.summary?.wakeupScheduleFresh}`);
  if (Number(bundle.summary?.wakeupNextRunGraceMinutes) !== nextRunGraceMinutes) {
    failures.push(`summary.wakeupNextRunGraceMinutes expected ${nextRunGraceMinutes} got ${bundle.summary?.wakeupNextRunGraceMinutes}`);
  }
  const roundedNextRunAge = nextRunAge === null ? null : round(nextRunAge);
  if (bundle.summary?.wakeupNextRunAgeMinutes !== roundedNextRunAge) {
    failures.push(`summary.wakeupNextRunAgeMinutes expected ${roundedNextRunAge} got ${bundle.summary?.wakeupNextRunAgeMinutes}`);
  }
  if (gate?.status !== (ok ? 'ready' : 'attention')) failures.push(`wakeup_health gate has unexpected status ${gate?.status}`);
  if (ok && bundle.artifacts?.wakeupHealth !== wakeup?.reportPath) {
    failures.push('wakeupHealth artifact does not match latest wakeup report path');
  }
}

function verifyPowerWakeGate(bundle, wakeup, gate, failures) {
  const wakeToRun = wakeup?.scheduledTask?.platform === 'win32'
    ? wakeup?.scheduledTask?.wakeToRun === true
    : null;
  const needsApproval = wakeToRun === false;
  if (bundle.summary?.wakeToRunEnabled !== wakeToRun) {
    failures.push(`summary.wakeToRunEnabled expected ${wakeToRun} got ${bundle.summary?.wakeToRunEnabled}`);
  }
  if (bundle.summary?.powerWakeNeedsApproval !== needsApproval) {
    failures.push(`summary.powerWakeNeedsApproval expected ${needsApproval} got ${bundle.summary?.powerWakeNeedsApproval}`);
  }
  if (gate?.status !== (needsApproval ? 'manual_approval' : 'ready')) {
    failures.push(`power_wake_policy gate has unexpected status ${gate?.status}`);
  }
  if ((gate?.commands || []).length) {
    failures.push('power_wake_policy gate must not expose executable commands');
  }
}

function verifyDashboardGate(bundle, dashboard, dashboardGates, gate, failures) {
  const ready = Boolean(dashboard?.jsonPath
    && dashboardGates?.ok === true
    && dashboardGates?.dashboardJsonPath === dashboard.jsonPath);
  if (bundle.summary?.dashboardGatesReady !== ready) {
    failures.push(`summary.dashboardGatesReady expected ${ready} got ${bundle.summary?.dashboardGatesReady}`);
  }
  if (gate?.status !== (ready ? 'ready' : 'attention')) {
    failures.push(`dashboard_gate_verification gate has unexpected status ${gate?.status}`);
  }
  if (ready && bundle.artifacts?.dashboardGateVerification !== dashboardGates?.reportPath) {
    failures.push('dashboardGateVerification artifact does not match latest dashboard verifier report');
  }
}

function verifyManualCommands(bundle, gateById, failures) {
  const deployGate = gateById.get('worker_deploy');
  if (deployGate?.status === 'ready_for_approval' && !(deployGate.commands || []).length) {
    failures.push('worker_deploy gate is ready_for_approval but has no commands');
  }
  for (const id of ['power_wake_policy', 'investor_review', 'secret_input', 'post_deploy_verification', 'manual_send']) {
    if ((gateById.get(id)?.commands || []).length) {
      failures.push(`${id} gate must not expose executable commands`);
    }
  }
  if (bundle.summary?.status === 'ready-for-owner-approval' && (bundle.gates || []).some(gate => gate.status === 'attention')) {
    failures.push('bundle summary is ready but at least one gate is attention');
  }
}

function requireEqual(failures, label, actual, expected) {
  if (actual !== expected) failures.push(`${label} expected ${expected} got ${actual}`);
}

function arrayEqual(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8,
    timeout: gitTimeoutMs,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.error?.message || result.stdout || result.signal || 'unknown error'}`);
  }
  return result.stdout || '';
}

function runGitMaybe(args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8,
    timeout: gitTimeoutMs,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || (result.error ? result.error.message : ''),
  };
}

function listLocalInvestorPacketPaths() {
  const untracked = runGitMaybe(['ls-files', '--others', '--exclude-standard', 'investor-packet']);
  const ignored = runGitMaybe(['ls-files', '--others', '--ignored', '--exclude-standard', 'investor-packet']);
  return [...new Set([
    ...(untracked.ok ? untracked.stdout.split(/\r?\n/).filter(Boolean) : []),
    ...(ignored.ok ? ignored.stdout.split(/\r?\n/).filter(Boolean) : []),
  ])].sort();
}

function parseStatusLine(line) {
  const raw = String(line || '');
  const pathPart = raw.slice(3).trim();
  const renamed = pathPart.includes(' -> ') ? pathPart.split(' -> ').pop() : pathPart;
  return { status: raw.slice(0, 2), path: renamed.replace(/^"|"$/g, '') };
}

function ageMinutes(value, relativeTo) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (relativeTo.getTime() - timestamp) / 60_000);
}

function freshUntil(value, freshMinutes) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + freshMinutes * 60_000).toISOString();
}

function freshRemainingMinutes(age, freshMinutes) {
  if (age === null || age === undefined || !Number.isFinite(Number(age))) return null;
  return Math.max(0, Number(freshMinutes) - Number(age));
}

function scheduledTaskNextRunAgeMinutes(wakeup, relativeTo) {
  const timestamp = Date.parse(wakeup?.scheduledTask?.nextRunTime || '');
  if (!Number.isFinite(timestamp)) return null;
  return (relativeTo.getTime() - timestamp) / 60_000;
}

function isWakeupScheduleEvidenceStale(wakeup, relativeTo, graceMinutes) {
  if (wakeup?.scheduledTask?.platform !== 'win32' || wakeup?.scheduledTask?.found !== true) return false;
  const age = scheduledTaskNextRunAgeMinutes(wakeup, relativeTo);
  return age !== null && age > graceMinutes;
}

function round(value) {
  return value === null || value === undefined ? null : Math.round(Number(value) * 10) / 10;
}

function renderMarkdown(payload) {
  const lines = [
    '# LOOPS Owner Approval Bundle Verification',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- bundle_json: ${payload.bundleJsonPath}`,
    `- bundle_fingerprint: ${payload.bundleFingerprint || '(missing)'}`,
    `- ok: ${payload.ok}`,
    `- gate_count: ${payload.summary.gateCount}`,
    `- failure_count: ${payload.summary.failureCount}`,
    `- warning_count: ${payload.summary.warningCount}`,
    '',
    '## Failures',
    '',
  ];

  if (payload.findings.failures.length) {
    for (const failure of payload.findings.failures) lines.push(`- ${failure}`);
  } else {
    lines.push('- None.');
  }

  lines.push('', '## Warnings', '');
  if (payload.findings.warnings.length) {
    for (const warning of payload.findings.warnings) lines.push(`- ${warning}`);
  } else {
    lines.push('- None.');
  }

  lines.push('', '## Safety Contract', '');
  lines.push('- This verifier reads local LOOPS JSON artifacts and git status only.');
  lines.push('- It does not push, create PRs, deploy, call protected endpoints, write secrets, or send messages.');
  return lines.join('\n');
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}
