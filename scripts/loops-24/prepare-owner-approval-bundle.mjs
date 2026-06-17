#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import fssync from 'node:fs';
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
const bundleDir = path.join(stateDir, 'owner-approval-bundles');

const expectedDirtyDeployFiles = [
  'webhook/worker.js',
  'webhook/wrangler.toml',
  'workers/social-publisher/worker.js',
  'workers/social-publisher/wrangler.toml',
];

const now = new Date();
const stamp = toStamp(now);

const github = await readJson(path.join(stateDir, 'github-handoffs', 'latest.json'), null);
const pr = await readJson(path.join(stateDir, 'pr-readiness', 'latest.json'), null);
const worker = await readJson(path.join(stateDir, 'worker-deploy-checklists', 'latest.json'), null);
const secrets = await readJson(path.join(stateDir, 'secret-gates', 'latest.json'), null);
const wakeup = await readJson(path.join(stateDir, 'wakeup-health', 'latest.json'), null);
const boundary = await readJson(path.join(stateDir, 'commit-boundaries', 'latest.json'), null);
const frontend = await readJson(path.join(stateDir, 'frontend-slice-handoffs', 'latest.json'), null);
const contentQueue = await readJson(path.join(stateDir, 'content-queue-reconciliations', 'latest.json'), null);
const dashboard = await readJson(path.join(stateDir, 'dashboard', 'latest.json'), null);
let dashboardGates = await readJson(path.join(stateDir, 'dashboard-verifications', 'latest.json'), null);
if (dashboard?.jsonPath && (!dashboardGates || dashboardGates.dashboardJsonPath !== dashboard.jsonPath || dashboardGates.ok !== true)) {
  runNodeMaybe(['scripts/loops-24/verify-dashboard-gates.mjs', '--dashboard-json', dashboard.jsonPath]);
  dashboardGates = await readJson(path.join(stateDir, 'dashboard-verifications', 'latest.json'), null);
}
let wakeupHealth = wakeup;
const wakeupFreshMinutes = Number.parseFloat(process.env.LOOPS_WAKEUP_REPORT_FRESH_MINUTES || '65');
const wakeupNextRunGraceMinutes = Number.parseFloat(process.env.LOOPS_WAKEUP_NEXT_RUN_GRACE_MINUTES || '5');
let wakeupAgeMinutes = ageMinutes(wakeupHealth?.generatedAt, now);
let wakeupNextRunAgeMinutes = scheduledTaskNextRunAgeMinutes(wakeupHealth, now);
let wakeupScheduleFresh = !isWakeupScheduleEvidenceStale(wakeupHealth, now, wakeupNextRunGraceMinutes);
if (!wakeupHealth || wakeupHealth?.health?.ok !== true || wakeupAgeMinutes === null || wakeupAgeMinutes > wakeupFreshMinutes || !wakeupScheduleFresh) {
  runNodeMaybe(['scripts/loops-24/check-wakeup-health.mjs']);
  wakeupHealth = await readJson(path.join(stateDir, 'wakeup-health', 'latest.json'), wakeupHealth);
  wakeupAgeMinutes = ageMinutes(wakeupHealth?.generatedAt, now);
  wakeupNextRunAgeMinutes = scheduledTaskNextRunAgeMinutes(wakeupHealth, now);
  wakeupScheduleFresh = !isWakeupScheduleEvidenceStale(wakeupHealth, now, wakeupNextRunGraceMinutes);
}

const branch = runGit(['branch', '--show-current']).trim();
const upstream = runGitMaybe(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']).stdout.trim();
const head = runGit(['rev-parse', '--short', 'HEAD']).trim();
const counts = upstream
  ? runGit(['rev-list', '--left-right', '--count', `${upstream}...HEAD`]).trim().split(/\s+/)
  : ['0', '0'];
const behind = Number.parseInt(counts[0] || '0', 10);
const ahead = Number.parseInt(counts[1] || '0', 10);
const statusLines = runGit(['status', '--short']).split(/\r?\n/).filter(Boolean);
const trackedDirtyLines = runGit(['status', '--short', '--untracked-files=no']).split(/\r?\n/).filter(Boolean);
const stagedLines = runGit(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean);
const dirtyPaths = trackedDirtyLines.map(parseStatusLine).map(item => item.path);
const untrackedPaths = statusLines
  .map(parseStatusLine)
  .filter(item => item.status === '??')
  .map(item => item.path);
const unexpectedDirty = dirtyPaths.filter(file => !expectedDirtyDeployFiles.includes(file));
const unexpectedUntracked = untrackedPaths.filter(file => !expectedDirtyDeployFiles.includes(file));
const statusFingerprint = gitWorktreeFingerprint({ cwd: repoRoot, statusLines });
const investorPacketUntracked = unexpectedUntracked.filter(file => file.startsWith('investor-packet/'));
const localScopeClean = stagedLines.length === 0 && unexpectedDirty.length === 0 && unexpectedUntracked.length === 0;

const missingSecrets = Array.isArray(secrets?.summary?.missing) ? secrets.summary.missing : [];
const workerCommands = Array.isArray(worker?.commands) ? worker.commands : [];
const prRefCurrent = Boolean(pr?.branch === branch
  && pr?.upstream === upstream
  && pr?.head === head
  && pr?.ahead === ahead
  && pr?.behind === behind);
const prFingerprintCurrent = Boolean(pr && pr.statusFingerprint === statusFingerprint);
const prHandoffCurrent = Boolean(pr && pr.githubHandoffPath === github?.reportPath);
const prPacketReady = Boolean(pr?.summary?.readyForApproval === true && prRefCurrent && prHandoffCurrent);
const prReady = prPacketReady && prFingerprintCurrent && localScopeClean;
const prPublishReady = prReady && ahead > 0 && behind === 0;
const prBlockers = [];
if (!pr) {
  prBlockers.push('missing-pr-readiness');
} else {
  if (pr.summary?.readyForApproval !== true) prBlockers.push('pr-readiness-attention');
  if (!prRefCurrent) prBlockers.push('branch-or-counts-stale');
  if (!prHandoffCurrent) prBlockers.push('github-handoff-stale');
  if (!prFingerprintCurrent) prBlockers.push('worktree-fingerprint-drift');
}
if (!localScopeClean) prBlockers.push('local-scope-not-clean');
if (ahead <= 0) prBlockers.push('no-ahead-commits');
if (behind !== 0) prBlockers.push('branch-behind-upstream');
const workerReady = worker?.summary?.status === 'ready-for-approval';
const wakeupFresh = wakeupAgeMinutes !== null && wakeupAgeMinutes <= wakeupFreshMinutes && wakeupScheduleFresh;
const wakeupOk = wakeupHealth?.health?.ok === true && wakeupFresh;
const wakeToRunEnabled = wakeupHealth?.scheduledTask?.platform === 'win32'
  ? wakeupHealth?.scheduledTask?.wakeToRun === true
  : null;
const powerWakeNeedsApproval = wakeToRunEnabled === false;
const dashboardGatesReady = Boolean(dashboard?.jsonPath
  && dashboardGates?.ok === true
  && dashboardGates?.dashboardJsonPath === dashboard.jsonPath);

const gates = [
  {
    id: 'local_review',
    label: 'Review local dirty scope',
    status: localScopeClean ? 'ready' : 'attention',
    ownerAction: 'Confirm the only remaining dirty paths are deploy-gated Worker slices and no unrelated untracked paths are present.',
    evidence: localScopeClean
      ? `Tracked dirty files are limited to: ${dirtyPaths.join(', ') || '(none)'}; untracked=(none).`
      : `Unexpected dirty, untracked, or staged changes exist. staged=${stagedLines.join(', ') || '(none)'} unexpected=${unexpectedDirty.join(', ') || '(none)'} untracked=${unexpectedUntracked.join(', ') || '(none)'}`,
  },
  ...(investorPacketUntracked.length ? [{
    id: 'investor_review',
    label: 'Review investor packet materials',
    status: 'manual_approval',
    ownerAction: 'Review the investor packet separately before staging, sending, sharing, or publishing it.',
    evidence: `untrackedInvestorPacketPaths=${investorPacketUntracked.length} root=investor-packet/`,
  }] : []),
  {
    id: 'wakeup_health',
    label: 'Verify hourly wakeup health',
    status: wakeupOk ? 'ready' : 'attention',
    ownerAction: 'Trust hourly automation only after the local wakeup-health report is fresh and green.',
    evidence: wakeupHealth
      ? `ok=${wakeupHealth.health?.ok} fresh=${wakeupFresh} ageMinutes=${wakeupAgeMinutes === null ? '(unknown)' : round(wakeupAgeMinutes)} limitMinutes=${wakeupFreshMinutes} scheduleFresh=${wakeupScheduleFresh} nextRunAgeMinutes=${wakeupNextRunAgeMinutes === null ? '(n/a)' : round(wakeupNextRunAgeMinutes)} nextRunGraceMinutes=${wakeupNextRunGraceMinutes} report=${wakeupHealth.reportPath || '(missing)'}`
      : 'Missing wakeup-health report.',
  },
  {
    id: 'power_wake_policy',
    label: 'Decide Windows sleep wake policy',
    status: powerWakeNeedsApproval ? 'manual_approval' : 'ready',
    ownerAction: powerWakeNeedsApproval
      ? 'Decide whether hourly LOOPS should wake a sleeping Windows machine; changing WakeToRun is a system setting and requires explicit approval.'
      : 'Windows WakeToRun is enabled or not applicable.',
    evidence: powerWakeNeedsApproval
      ? `wakeToRun=false warning=${(wakeupHealth?.health?.warnings || []).join(' | ') || '(none)'} report=${wakeupHealth?.reportPath || '(missing)'}`
      : `wakeToRun=${wakeupHealth?.scheduledTask?.wakeToRun ?? '(n/a)'} platform=${wakeupHealth?.scheduledTask?.platform || '(unknown)'}`,
  },
  {
    id: 'dashboard_gate_verification',
    label: 'Verify dashboard approval gates',
    status: dashboardGatesReady ? 'ready' : 'attention',
    ownerAction: 'Trust the dashboard approval groups only after the local verifier has checked the latest dashboard JSON.',
    evidence: dashboardGatesReady
      ? `ok=true waiting=${dashboardGates.summary?.waitingCount} groups=${dashboardGates.summary?.approvalGroupCount} report=${dashboardGates.reportPath}`
      : `Dashboard verifier missing, failed, or stale. dashboard=${dashboard?.jsonPath || '(missing)'} verifier=${dashboardGates?.dashboardJsonPath || '(missing)'}`,
  },
  {
    id: 'push_draft_pr',
    label: 'Push branch and open draft PR',
    status: prPublishReady ? 'ready_for_approval' : 'attention',
    ownerAction: 'Approve GitHub write actions if you want the committed control-plane work published as a draft PR.',
    evidence: pr
      ? `readyForApproval=${pr.summary?.readyForApproval} refCurrent=${prRefCurrent} fingerprintCurrent=${prFingerprintCurrent} handoffCurrent=${prHandoffCurrent} localScopeClean=${localScopeClean} publishReady=${prPublishReady} blockers=${prBlockers.join('|') || '(none)'} packetHead=${pr.head || '(missing)'} currentHead=${head} packetAhead=${pr.ahead} currentAhead=${ahead} packetBehind=${pr.behind} currentBehind=${behind}`
      : 'Missing PR readiness packet.',
    commands: prPublishReady && github ? [
      `git push origin ${branch}`,
      `gh pr create --draft --title "${escapeDoubleQuoted(github.title || 'Add LOOPS 24 control plane and local automation guardrails')}" --body-file "${pr?.reportPath || github.reportPath}"`,
    ] : [],
  },
  {
    id: 'worker_deploy',
    label: 'Review and deploy Worker slices',
    status: workerReady ? 'ready_for_approval' : 'attention',
    ownerAction: 'Approve deploy-gated Worker changes only after reviewing the four dirty Worker files.',
    evidence: worker
      ? `status=${worker.summary?.status} attention=${worker.summary?.attentionCount} manualApproval=${worker.summary?.manualApprovalCount} manualInput=${worker.summary?.manualInputCount}`
      : 'Missing Worker deploy checklist.',
    commands: workerCommands.map(item => item.command),
  },
  {
    id: 'secret_input',
    label: 'Provide machine-local secrets',
    status: missingSecrets.length ? 'manual_input' : 'ready',
    ownerAction: missingSecrets.length
      ? 'Add these values only to the local runner environment or secrets.local.ps1; do not commit them.'
      : 'No missing secret gate detected in the latest handoff.',
    evidence: missingSecrets.length ? `missing=${missingSecrets.join(', ')}` : 'missing=(none)',
  },
  {
    id: 'post_deploy_verification',
    label: 'Run protected verification after deploy',
    status: 'manual_approval',
    ownerAction: 'After deploy approval and local token input, verify cron status and queue endpoints.',
    evidence: 'Protected endpoint verification is intentionally not run by LOOPS.',
  },
  {
    id: 'manual_send',
    label: 'Keep outbound sending manual',
    status: 'manual_approval',
    ownerAction: 'Send LINE, IG, email, or public posts only by explicit manual review.',
    evidence: 'Cold outreach and public publishing remain no-send by default.',
  },
];

const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  stateDir,
  reportPath: path.join(bundleDir, `${stamp}-owner-approval-bundle.md`),
  jsonPath: path.join(bundleDir, `${stamp}-owner-approval-bundle.json`),
  latestPath: path.join(bundleDir, 'latest.json'),
  branch,
  upstream,
  head,
  ahead,
  behind,
  statusFingerprint,
  dirtyTracked: trackedDirtyLines,
  untracked: untrackedPaths,
  expectedDirtyDeployFiles,
  unexpectedDirty,
  unexpectedUntracked,
  staged: stagedLines,
  artifacts: {
    githubHandoff: github?.reportPath || null,
    prReadiness: pr?.reportPath || null,
    workerDeployChecklist: worker?.reportPath || null,
    secretGates: secrets?.reportPath || null,
    wakeupHealth: wakeupHealth?.reportPath || null,
    commitBoundaries: boundary?.reportPath || null,
    frontendHandoffs: frontend?.reportPath || null,
    contentQueue: contentQueue?.reportPath || null,
    dashboardGateVerification: dashboardGates?.reportPath || null,
  },
  gates,
  summary: {
    status: gates.some(gate => gate.status === 'attention') ? 'attention' : 'ready-for-owner-approval',
    readyGateCount: gates.filter(gate => gate.status === 'ready' || gate.status === 'ready_for_approval').length,
    attentionCount: gates.filter(gate => gate.status === 'attention').length,
    manualApprovalCount: gates.filter(gate => gate.status === 'manual_approval' || gate.status === 'ready_for_approval').length,
    manualInputCount: gates.filter(gate => gate.status === 'manual_input').length,
    prReady,
    prPacketReady,
    prRefCurrent,
    prFingerprintCurrent,
    prHandoffCurrent,
    prPublishReady,
    workerReady,
    wakeupOk,
    wakeupFresh,
    wakeupAgeMinutes: wakeupAgeMinutes === null ? null : round(wakeupAgeMinutes),
    wakeupScheduleFresh,
    wakeupNextRunAgeMinutes: wakeupNextRunAgeMinutes === null ? null : round(wakeupNextRunAgeMinutes),
    wakeupNextRunGraceMinutes,
    wakeToRunEnabled,
    powerWakeNeedsApproval,
    dashboardGatesReady,
    localScopeClean,
  },
};

payload.bundleFingerprint = hash(JSON.stringify({
  branch,
  upstream,
  head,
  ahead,
  behind,
  statusFingerprint,
  artifacts: payload.artifacts,
  gates,
}));

const latest = await readJson(payload.latestPath, null);
if (latest?.bundleFingerprint === payload.bundleFingerprint
  && latest?.reportPath
  && fssync.existsSync(latest.reportPath)) {
  console.log(JSON.stringify({
    ok: true,
    reused: true,
    reportPath: latest.reportPath,
    jsonPath: latest.jsonPath,
    bundleFingerprint: latest.bundleFingerprint,
    summary: latest.summary,
  }, null, 2));
  process.exit(0);
}

await fs.mkdir(bundleDir, { recursive: true });
await fs.writeFile(payload.jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  reused: false,
  reportPath: payload.reportPath,
  jsonPath: payload.jsonPath,
  bundleFingerprint: payload.bundleFingerprint,
  summary: payload.summary,
}, null, 2));

function renderMarkdown(payload) {
  const lines = [
    '# LOOPS Owner Approval Bundle',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- repo: ${payload.repoRoot}`,
    `- branch: ${payload.branch}`,
    `- upstream: ${payload.upstream || '(none)'}`,
    `- head: ${payload.head}`,
    `- ahead: ${payload.ahead}`,
    `- behind: ${payload.behind}`,
    `- status: ${payload.summary.status}`,
    `- status_fingerprint: ${payload.statusFingerprint}`,
    '',
    '## BLUF',
    '',
    payload.summary.attentionCount === 0
      ? 'LOOPS is ready for owner approval. No GitHub write, Worker deploy, secret input, protected verification, or outbound send was performed.'
      : 'LOOPS still needs owner attention before approval. No external action was performed.',
    '',
    '## What This Bundle Lets The Owner Decide',
    '',
    '- Publish the committed control-plane work as a draft PR.',
    '- Review whether the four dirty Worker deploy files should be staged, committed, or deployed later.',
    '- Decide whether Windows should wake from sleep for hourly LOOPS runs.',
    '- Add missing secrets only in the local machine environment.',
    '- Keep all outreach and public publishing manual-send only.',
    '',
    '## What This Does Not Approve',
    '',
    '- It does not authorize `git push`, PR creation, merge, deploy, secret writes, protected endpoint calls, public posting, or outbound sends.',
    '- It does not include the dirty Worker files in a PR unless the owner separately approves staging/committing those files.',
    '- It does not change Windows Task Scheduler or power-management settings.',
    '- It does not store or print secret values.',
    '',
    '## Approval Gates',
    '',
    '| Gate | Status | Owner action | Evidence |',
    '|---|---|---|---|',
    ...payload.gates.map(gate => `| ${gate.label} | ${gate.status} | ${gate.ownerAction} | ${gate.evidence} |`),
    '',
    '## Current Dirty Tracked Worktree',
    '',
    ...(payload.dirtyTracked.length ? payload.dirtyTracked.map(item => `- \`${item}\``) : ['- none']),
    '',
    '## Current Untracked Worktree',
    '',
    ...(payload.untracked.length ? payload.untracked.map(item => `- \`${item}\``) : ['- none']),
    '',
    '## Artifacts',
    '',
    ...Object.entries(payload.artifacts).map(([key, value]) => `- ${key}: ${value || '(missing)'}`),
    '',
    '## Commands Requiring Explicit Approval',
    '',
    '### Push And Draft PR',
    '',
    '```powershell',
    ...((payload.gates.find(gate => gate.id === 'push_draft_pr')?.commands || ['# Missing GitHub/PR readiness artifact.']).map(String)),
    '```',
    '',
    '### Worker Deploy',
    '',
    '```powershell',
    ...((payload.gates.find(gate => gate.id === 'worker_deploy')?.commands || ['# Missing Worker deploy checklist.']).map(String)),
    '```',
    '',
    '## Recommended Approval Order',
    '',
    '1. Review this bundle and the four dirty Worker deploy files.',
    '2. If you approve GitHub publication, run the Push And Draft PR commands.',
    '3. If you approve Worker deploy, first decide whether to commit the Worker slice or deploy from the dirty worktree, then run the Worker Deploy commands.',
    '4. Add missing secrets only in the local secret file or shell environment.',
    '5. If 24-hour sleep wakeups matter, separately approve a Windows WakeToRun change; this bundle only reports the decision gate.',
    '6. Run protected verification only after deploy approval and token input.',
  ];
  return lines.join('\n');
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.error?.message || result.stdout}`);
  }
  return result.stdout || '';
}

function runGitMaybe(args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || (result.error ? result.error.message : ''),
  };
}

function runNodeMaybe(args) {
  return spawnSync('node', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8,
  });
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

function scheduledTaskNextRunAgeMinutes(wakeupHealth, relativeTo) {
  const timestamp = Date.parse(wakeupHealth?.scheduledTask?.nextRunTime || '');
  if (!Number.isFinite(timestamp)) return null;
  return (relativeTo.getTime() - timestamp) / 60_000;
}

function isWakeupScheduleEvidenceStale(wakeupHealth, relativeTo, graceMinutes) {
  if (wakeupHealth?.scheduledTask?.platform !== 'win32' || wakeupHealth?.scheduledTask?.found !== true) return false;
  const age = scheduledTaskNextRunAgeMinutes(wakeupHealth, relativeTo);
  return age !== null && age > graceMinutes;
}

function round(value) {
  return value === null || value === undefined ? null : Math.round(Number(value) * 10) / 10;
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function escapeDoubleQuoted(value) {
  return String(value).replaceAll('`', '``').replaceAll('"', '\\"');
}
