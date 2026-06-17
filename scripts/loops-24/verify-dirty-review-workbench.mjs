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
const args = parseArgs(process.argv.slice(2));
const workbenchJsonPath = path.resolve(args.workbenchJson || path.join(stateDir, 'dirty-review-workbench', 'latest.json'));
const verificationDir = path.join(stateDir, 'dirty-review-workbench-verifications');
const now = new Date();
const stamp = toStamp(now);

const workbench = await readJson(workbenchJsonPath);
const dirty = await readJson(workbench.dirtyJsonPath || path.join(stateDir, 'dirty-worktree', 'latest.json'));
const findings = verifyWorkbench(workbench, dirty);
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  automationId,
  stateDir,
  workbenchJsonPath,
  dirtyJsonPath: workbench.dirtyJsonPath || null,
  reportPath: path.join(verificationDir, `${stamp}-dirty-review-workbench-verification.md`),
  jsonPath: path.join(verificationDir, `${stamp}-dirty-review-workbench-verification.json`),
  latestPath: path.join(verificationDir, 'latest.json'),
  ok: findings.failures.length === 0,
  summary: {
    status: workbench.status || null,
    sourceCurrent: workbench.sourceCurrent === true,
    decisionOptionCount: Number(workbench.summary?.decisionOptionCount || 0),
    ownerApprovalRequiredCount: Number(workbench.summary?.ownerApprovalRequiredCount || 0),
    failureCount: findings.failures.length,
    warningCount: findings.warnings.length,
  },
  findings,
  statusFingerprint: hash(JSON.stringify({
    workbenchFingerprint: workbench.statusFingerprint || null,
    dirtyStatusFingerprint: dirty.statusFingerprint || null,
    failures: findings.failures,
    warnings: findings.warnings,
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
    if (argv[index] === '--workbench-json') {
      parsed.workbenchJson = argv[index + 1];
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

function verifyWorkbench(workbench, dirty) {
  const failures = [];
  const warnings = [];
  const currentStatusLines = runGit(['status', '--short']).split(/\r?\n/).filter(Boolean);
  const currentStatusFingerprint = gitWorktreeFingerprint({ cwd: repoRoot, statusLines: currentStatusLines });
  const groups = new Map((dirty.groups || []).map(group => [group.id, group]));
  const deploy = groupPaths(groups.get('deploy'));
  const debugArtifacts = groupPaths(groups.get('debug-artifacts'));
  const repoHygiene = groupPaths(groups.get('repo-hygiene'));
  const other = groupPaths(groups.get('other'));
  const expectedSourceCurrent = dirty.statusFingerprint === currentStatusFingerprint;
  const expectedStatus = expectedSourceCurrent
    ? (other.length ? 'needs-manual-triage' : (Number(dirty.summary?.total || 0) ? 'ready-for-owner-review' : 'clean'))
    : 'stale-source';

  requireEqual(failures, 'repoRoot', workbench.repoRoot, repoRoot);
  requireEqual(failures, 'stateDir', workbench.stateDir, stateDir);
  requireEqual(failures, 'sourceStatusFingerprint', workbench.sourceStatusFingerprint, dirty.statusFingerprint || null);
  requireEqual(failures, 'currentStatusFingerprint', workbench.currentStatusFingerprint, currentStatusFingerprint);
  requireEqual(failures, 'sourceCurrent', workbench.sourceCurrent, expectedSourceCurrent);
  requireEqual(failures, 'status', workbench.status, expectedStatus);
  requireEqual(failures, 'summary.total', Number(workbench.summary?.total), Number(dirty.summary?.total || 0));
  requireEqual(failures, 'summary.deploy', Number(workbench.summary?.deploy), deploy.length);
  requireEqual(failures, 'summary.debugArtifacts', Number(workbench.summary?.debugArtifacts), debugArtifacts.length);
  requireEqual(failures, 'summary.repoHygiene', Number(workbench.summary?.repoHygiene), repoHygiene.length);
  requireEqual(failures, 'summary.investor', Number(workbench.summary?.investor), Number(dirty.summary?.investor || 0));
  requireEqual(failures, 'summary.other', Number(workbench.summary?.other), other.length);
  if (workbench.dirtyReportPath && !fssync.existsSync(workbench.dirtyReportPath)) {
    failures.push(`dirtyReportPath does not exist: ${workbench.dirtyReportPath}`);
  }

  const optionById = new Map((workbench.decisionOptions || []).map(option => [option.id, option]));
  if (deploy.length && !optionById.has('review_deploy_paths')) failures.push('missing review_deploy_paths option');
  if (debugArtifacts.length && !optionById.has('restore_debug_artifacts')) failures.push('missing restore_debug_artifacts option');
  if (debugArtifacts.length && !optionById.has('commit_debug_artifact_cleanup')) failures.push('missing commit_debug_artifact_cleanup option');
  if (repoHygiene.length && !optionById.has('review_repo_hygiene_paths')) failures.push('missing review_repo_hygiene_paths option');
  if (other.length && !optionById.has('triage_other_paths')) failures.push('missing triage_other_paths option');

  const commands = [
    ...(workbench.reviewCommands || []),
    ...(workbench.decisionOptions || []).flatMap(option => option.commands || []),
  ];
  for (const command of commands) {
    if (forbiddenCommand(command)) failures.push(`forbidden command exposed: ${command}`);
  }
  for (const option of workbench.decisionOptions || []) {
    if (option.status === 'owner_approval_required' && !/approval/i.test(option.status)) {
      warnings.push(`option ${option.id} may need stronger owner approval status`);
    }
  }
  const hardStops = workbench.hardStops || [];
  for (const phrase of ['local review handoff only', 'Do not mix debug artifact cleanup', 'owner_approval_required', 'Do not print or store secret values']) {
    if (!hardStops.some(stop => String(stop).includes(phrase))) {
      failures.push(`hardStops missing phrase: ${phrase}`);
    }
  }

  const expectedFingerprint = hash(JSON.stringify({
    dirtyReportPath: workbench.dirtyReportPath,
    dirtyJsonPath: workbench.dirtyJsonPath,
    sourceStatusFingerprint: workbench.sourceStatusFingerprint,
    currentStatusFingerprint: workbench.currentStatusFingerprint,
    status: workbench.status,
    summary: workbench.summary,
    decisionOptions: (workbench.decisionOptions || []).map(option => ({
      id: option.id,
      status: option.status,
      commands: option.commands,
      affectedPaths: option.affectedPaths,
    })),
  }));
  requireEqual(failures, 'statusFingerprint', workbench.statusFingerprint, expectedFingerprint);
  return { failures, warnings };
}

function renderMarkdown(payload) {
  const lines = [
    '# LOOPS Dirty Review Workbench Verification',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- ok: ${payload.ok}`,
    `- workbench_json: ${payload.workbenchJsonPath}`,
    `- dirty_json: ${payload.dirtyJsonPath || '(missing)'}`,
    `- failure_count: ${payload.summary.failureCount}`,
    `- warning_count: ${payload.summary.warningCount}`,
    '',
    '## Failures',
    '',
    ...(payload.findings.failures.length ? payload.findings.failures.map(item => `- ${item}`) : ['- none']),
    '',
    '## Warnings',
    '',
    ...(payload.findings.warnings.length ? payload.findings.warnings.map(item => `- ${item}`) : ['- none']),
  ];
  return lines.join('\n');
}

function groupPaths(group) {
  return Array.isArray(group?.paths) ? group.paths.slice() : [];
}

function forbiddenCommand(command) {
  return /\b(git\s+push|gh\s+pr\s+create|wrangler\s+deploy|railway\s+up|send-mailmessage|broadcast|Remove-Item|rm\s+-rf)\b/i.test(String(command || ''));
}

function runGit(args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  }
  return result.stdout || '';
}

function requireEqual(failures, label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label} expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
  }
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}
