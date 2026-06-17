#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import fssync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { gitWorktreeFingerprint } from './lib/git-worktree-fingerprint.mjs';

const automationId = process.env.LOOPS_AUTOMATION_ID || 'loops-24';
const repoRoot = path.resolve(process.env.LOOPS_REPO_ROOT || process.cwd());
const codexHome = process.env.CODEX_HOME
  || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.codex') : path.join(os.homedir(), '.codex'));
const stateDir = path.resolve(process.env.LOOPS_STATE_DIR || path.join(codexHome, 'automations', automationId));
const args = parseArgs(process.argv.slice(2));
const checklistJsonPath = path.resolve(args.checklistJson || path.join(stateDir, 'worker-deploy-checklists', 'latest.json'));
const verificationDir = path.join(stateDir, 'worker-deploy-checklist-verifications');
const gitTimeoutMs = Number.parseInt(process.env.LOOPS_GIT_TIMEOUT_MS || '30000', 10);
const now = new Date();
const stamp = toStamp(now);

const checklist = await readJson(checklistJsonPath);
const workerReview = await readJson(path.join(stateDir, 'worker-deploy-reviews', 'latest.json'), null);
const secretGates = await readJson(path.join(stateDir, 'secret-gates', 'latest.json'), null);
const findings = await verifyChecklist(checklist, workerReview, secretGates);
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  automationId,
  stateDir,
  checklistJsonPath,
  checklistReportPath: checklist.reportPath || null,
  workerReviewPath: checklist.workerReviewPath || null,
  secretGatesPath: checklist.secretGatesPath || null,
  reportPath: path.join(verificationDir, `${stamp}-worker-deploy-checklist-verification.md`),
  jsonPath: path.join(verificationDir, `${stamp}-worker-deploy-checklist-verification.json`),
  latestPath: path.join(verificationDir, 'latest.json'),
  ok: findings.failures.length === 0,
  summary: {
    checklistStatus: checklist.status || null,
    commandCount: Array.isArray(checklist.commands) ? checklist.commands.length : 0,
    attentionCount: Number(checklist.summary?.attentionCount || 0),
    manualApprovalCount: Number(checklist.summary?.manualApprovalCount || 0),
    manualInputCount: Number(checklist.summary?.manualInputCount || 0),
    failureCount: findings.failures.length,
    warningCount: findings.warnings.length,
  },
  findings,
  statusFingerprint: hash(JSON.stringify({
    checklistFingerprint: checklist.checklistFingerprint || null,
    findings,
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
    if (argv[index] === '--checklist-json') {
      parsed.checklistJson = argv[index + 1];
      index += 1;
    }
  }
  return parsed;
}

async function verifyChecklist(checklist, workerReview, secretGates) {
  const failures = [];
  const warnings = [];
  const checks = Array.isArray(checklist.checks) ? checklist.checks : [];
  const commands = Array.isArray(checklist.commands) ? checklist.commands : [];
  const groups = Array.isArray(checklist.groups) ? checklist.groups : [];
  const statusLines = runGit(['status', '--short']).split(/\r?\n/).filter(Boolean);
  const currentFingerprint = gitWorktreeFingerprint({ cwd: repoRoot, statusLines });
  const expectedStatus = checks.some(check => check.status === 'attention') ? 'attention' : 'ready-for-approval';

  requireEqual(failures, 'repoRoot', checklist.repoRoot, repoRoot);
  requireEqual(failures, 'statusFingerprint', checklist.statusFingerprint, currentFingerprint);
  requireEqual(failures, 'workerReview.statusFingerprint', workerReview?.statusFingerprint || null, currentFingerprint);
  requireEqual(failures, 'status', checklist.status, expectedStatus);
  requireEqual(failures, 'summary.status', checklist.summary?.status, checklist.status);
  requireEqual(failures, 'summary.groupCount', Number(checklist.summary?.groupCount), groups.length);
  requireEqual(failures, 'summary.checkPassCount', Number(checklist.summary?.checkPassCount), checks.filter(check => check.status === 'pass').length);
  requireEqual(failures, 'summary.attentionCount', Number(checklist.summary?.attentionCount), checks.filter(check => check.status === 'attention').length);
  requireEqual(failures, 'summary.manualApprovalCount', Number(checklist.summary?.manualApprovalCount), checks.filter(check => check.status === 'manual_approval').length);
  requireEqual(failures, 'summary.manualInputCount', Number(checklist.summary?.manualInputCount), checks.filter(check => check.status === 'manual_input').length);

  if (!checklist.reportPath || !fssync.existsSync(checklist.reportPath)) failures.push('checklist reportPath must exist');
  if (!checklist.workerReviewPath || !fssync.existsSync(checklist.workerReviewPath)) failures.push('workerReviewPath must exist');
  if (checklist.secretGatesPath && !fssync.existsSync(checklist.secretGatesPath)) failures.push('secretGatesPath must exist when present');
  if (!workerReview) failures.push('latest Worker deploy review must exist');
  if (!secretGates) warnings.push('latest secret-gates handoff is missing; secret gate readiness cannot be cross-checked');

  const checkById = new Map(checks.map(check => [check.id, check]));
  requireEqual(failures, 'worker_review_current.status', checkById.get('worker_review_current')?.status, 'pass');
  requireEqual(failures, 'local_checks.status', checkById.get('local_checks')?.status, 'pass');
  requireEqual(failures, 'deploy_approval.status', checkById.get('deploy_approval')?.status, commands.length ? 'manual_approval' : 'attention');
  requireEqual(failures, 'post_deploy_verification.status', checkById.get('post_deploy_verification')?.status, 'manual_approval');
  if (Number(checklist.manualGateFindings || 0) > 0) {
    requireEqual(failures, 'red_line_capabilities.status', checkById.get('red_line_capabilities')?.status, 'manual_approval');
  }

  const missingSecrets = Array.isArray(secretGates?.summary?.missing) ? secretGates.summary.missing : [];
  requireEqual(failures, 'secret_gates.status', checkById.get('secret_gates')?.status, missingSecrets.length ? 'manual_input' : 'pass');
  if (checklist.status === 'ready-for-approval' && commands.length === 0) {
    failures.push('ready-for-approval checklist must expose at least one owner-review deploy command');
  }
  if (checklist.status === 'ready-for-approval' && Number(checklist.summary?.attentionCount || 0) !== 0) {
    failures.push('ready-for-approval checklist must have zero attention checks');
  }

  for (const command of commands) {
    verifyDeployCommand(command, failures);
  }
  for (const group of groups) {
    for (const config of group.wranglerConfigs || []) {
      const configPath = path.join(repoRoot, config.path || '');
      if (!fssync.existsSync(configPath)) failures.push(`wrangler config missing for group ${group.id}: ${config.path}`);
      if (!isSubPath(repoRoot, configPath)) failures.push(`wrangler config must stay inside repo: ${config.path}`);
    }
  }

  const expectedFingerprint = hash(JSON.stringify({
    statusFingerprint: checklist.statusFingerprint,
    reviewFingerprint: checklist.reviewFingerprint || null,
    secretGatesFingerprint: secretGates?.statusFingerprint || null,
    checks,
    commands,
  }));
  requireEqual(failures, 'checklistFingerprint', checklist.checklistFingerprint, expectedFingerprint);

  return { failures, warnings };
}

function verifyDeployCommand(item, failures) {
  const allowed = {
    webhook_cron_outcome: 'Push-Location webhook; wrangler deploy; Pop-Location',
    social_publisher_worker: 'Push-Location workers/social-publisher; wrangler deploy; Pop-Location',
  };
  if (item.gate !== 'deploy-approval') failures.push(`${item.group || item.worker} command gate must be deploy-approval`);
  if (!allowed[item.group]) {
    failures.push(`deploy command group is not allowlisted: ${item.group || '(missing)'}`);
    return;
  }
  if (item.command !== allowed[item.group]) {
    failures.push(`${item.group} command expected ${allowed[item.group]} got ${item.command}`);
  }
  if (!Array.isArray(item.postDeployChecks) || item.postDeployChecks.length === 0) {
    failures.push(`${item.group} command must include postDeployChecks`);
  }
  const directory = item.command.match(/^Push-Location\s+([^;]+);/)?.[1];
  if (!directory) {
    failures.push(`${item.group} command must use Push-Location`);
    return;
  }
  const absoluteDir = path.join(repoRoot, directory);
  if (!isSubPath(repoRoot, absoluteDir) || !fssync.existsSync(path.join(absoluteDir, 'wrangler.toml'))) {
    failures.push(`${item.group} command directory must contain wrangler.toml inside repo`);
  }
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (arguments.length > 1) return fallback;
    throw new Error(`Unable to read JSON at ${file}: ${error.message}`);
  }
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

function isSubPath(parent, child) {
  const relativePath = path.relative(path.resolve(parent), path.resolve(child));
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function requireEqual(failures, field, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${field} expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

function renderMarkdown(data) {
  const lines = [
    '# LOOPS Worker Deploy Checklist Verification',
    '',
    `- generated_at: ${data.generatedAt}`,
    `- ok: ${data.ok}`,
    `- checklist_json: ${data.checklistJsonPath}`,
    `- checklist_report: ${data.checklistReportPath || '(missing)'}`,
    `- worker_review: ${data.workerReviewPath || '(missing)'}`,
    `- secret_gates: ${data.secretGatesPath || '(missing)'}`,
    `- status: ${data.summary.checklistStatus || '(unknown)'}`,
    `- command_count: ${data.summary.commandCount}`,
    `- attention_count: ${data.summary.attentionCount}`,
    `- failures: ${data.summary.failureCount}`,
    `- warnings: ${data.summary.warningCount}`,
    '',
    '## Failures',
    '',
    ...(data.findings.failures.length ? data.findings.failures.map(item => `- ${item}`) : ['- none']),
    '',
    '## Warnings',
    '',
    ...(data.findings.warnings.length ? data.findings.warnings.map(item => `- ${item}`) : ['- none']),
    '',
    '## Safety Contract',
    '',
    '- This verifier reads local Worker checklist, review, secret-gate, and git status artifacts only.',
    '- It does not push, create a PR, deploy, call protected endpoints, write secrets, or send messages.',
  ];
  return lines.join('\n');
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
}
