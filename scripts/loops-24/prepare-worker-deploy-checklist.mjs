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
const checklistDir = path.join(stateDir, 'worker-deploy-checklists');

const workerReview = await readJson(path.join(stateDir, 'worker-deploy-reviews', 'latest.json'), null);
if (!workerReview) {
  throw new Error('No Worker deploy review found. Run scripts/loops-24/review-worker-deploy-slices.mjs first.');
}

const secretGates = await readJson(path.join(stateDir, 'secret-gates', 'latest.json'), null);
const statusLines = runGit(['status', '--short']).split(/\r?\n/).filter(Boolean);
const statusFingerprint = gitWorktreeFingerprint({ cwd: repoRoot, statusLines });
const reviewIsCurrent = workerReview.statusFingerprint === statusFingerprint;
const allLocalChecksPass = workerReview.summary?.allLocalChecksPass === true;
const manualGateFindings = Number(workerReview.summary?.manualGateFindings || 0);
const manualGateTypes = Array.isArray(workerReview.summary?.manualGateTypes)
  ? workerReview.summary.manualGateTypes
  : [];
const missingSecrets = Array.isArray(secretGates?.summary?.missing) ? secretGates.summary.missing : [];
const secretGatesReady = secretGates
  ? missingSecrets.length === 0
  : false;
const groups = Array.isArray(workerReview.groups) ? workerReview.groups : [];
const now = new Date();
const stamp = toStamp(now);

const checks = [
  {
    id: 'worker_review_current',
    status: reviewIsCurrent ? 'pass' : 'attention',
    detail: reviewIsCurrent
      ? 'Worker deploy review matches current git status.'
      : 'Worker deploy review is stale. Re-run review-worker-deploy-slices first.',
  },
  {
    id: 'local_checks',
    status: allLocalChecksPass ? 'pass' : 'attention',
    detail: `allLocalChecksPass=${allLocalChecksPass}`,
  },
  {
    id: 'red_line_capabilities',
    status: manualGateFindings > 0 ? 'manual_approval' : 'pass',
    detail: manualGateFindings > 0
      ? `manualGateFindings=${manualGateFindings}; gates=${manualGateTypes.join(', ')}`
      : 'No red-line Worker capabilities detected.',
  },
  {
    id: 'secret_gates',
    status: secretGatesReady ? 'pass' : 'manual_input',
    detail: secretGates
      ? `missing=${missingSecrets.join(', ') || '(none)'}`
      : 'No secret gate handoff found.',
  },
  {
    id: 'deploy_approval',
    status: 'manual_approval',
    detail: 'Wrangler deploy is intentionally not run by this checklist.',
  },
  {
    id: 'post_deploy_verification',
    status: 'manual_approval',
    detail: 'Verify /api/cron-status and /queue/list only after deploy approval and local token input.',
  },
];

const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  statusFingerprint,
  reviewFingerprint: workerReview.reviewFingerprint || null,
  reportPath: path.join(checklistDir, `${stamp}-worker-deploy-checklist.md`),
  jsonPath: path.join(checklistDir, `${stamp}-worker-deploy-checklist.json`),
  latestPath: path.join(checklistDir, 'latest.json'),
  workerReviewPath: workerReview.reportPath || null,
  secretGatesPath: secretGates?.reportPath || null,
  status: reviewIsCurrent && allLocalChecksPass ? 'ready-for-approval' : 'attention',
  deployApprovalRequired: true,
  manualGateFindings,
  manualGateTypes,
  groups: groups.map(summarizeGroup),
  checks,
  commands: groups.flatMap(deployCommandsForGroup),
};

payload.summary = {
  status: payload.status,
  groupCount: payload.groups.length,
  checkPassCount: checks.filter(check => check.status === 'pass').length,
  attentionCount: checks.filter(check => check.status === 'attention').length,
  manualApprovalCount: checks.filter(check => check.status === 'manual_approval').length,
  manualInputCount: checks.filter(check => check.status === 'manual_input').length,
};

payload.checklistFingerprint = hash(JSON.stringify({
  statusFingerprint,
  reviewFingerprint: payload.reviewFingerprint,
  secretGatesFingerprint: secretGates?.statusFingerprint || null,
  checks,
  commands: payload.commands,
}));

const latest = await readJson(payload.latestPath, null);
if (latest?.checklistFingerprint === payload.checklistFingerprint
  && latest?.reportPath
  && fssync.existsSync(latest.reportPath)) {
  console.log(JSON.stringify({
    ok: true,
    reused: true,
    reportPath: latest.reportPath,
    jsonPath: latest.jsonPath,
    checklistFingerprint: latest.checklistFingerprint,
    summary: latest.summary,
  }, null, 2));
  process.exit(0);
}

await fs.mkdir(checklistDir, { recursive: true });
await fs.writeFile(payload.jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  reused: false,
  reportPath: payload.reportPath,
  jsonPath: payload.jsonPath,
  checklistFingerprint: payload.checklistFingerprint,
  summary: payload.summary,
}, null, 2));

function summarizeGroup(group) {
  return {
    id: group.id,
    title: group.title,
    ok: Boolean(group.ok),
    paths: (group.paths || []).map(item => item.path),
    wranglerConfigs: (group.wranglerChecks || []).map(item => ({
      path: item.path,
      name: item.name,
      ok: item.ok,
      crons: item.crons || [],
      bindings: item.bindings || [],
    })),
  };
}

function deployCommandsForGroup(group) {
  return (group.wranglerChecks || []).map(item => {
    const dir = path.dirname(item.path).replaceAll('\\', '/');
    return {
      group: group.id,
      gate: 'deploy-approval',
      worker: item.name || group.id,
      command: `Push-Location ${dir}; wrangler deploy; Pop-Location`,
      postDeployChecks: postDeployChecks(group.id),
    };
  });
}

function postDeployChecks(groupId) {
  if (groupId === 'webhook_cron_outcome') {
    return [
      'Verify /api/cron-status with TRIGGER_TOKEN after the next scheduled branch runs.',
      'Confirm D1/KV writes are recorded by the cron outcome map.',
    ];
  }
  if (groupId === 'social_publisher_worker') {
    return [
      'Verify /health.',
      'Verify /queue/list with SOCIAL_PUBLISHER_TOKEN or TRIGGER_TOKEN.',
    ];
  }
  return ['Verify the Worker health endpoint and relevant protected endpoint with a local token.'];
}

function renderMarkdown(data) {
  const lines = [
    '# LOOPS Worker Deploy-Ready Checklist',
    '',
    `- generated_at: ${data.generatedAt}`,
    `- repo: ${data.repoRoot}`,
    `- status: ${data.status}`,
    `- deploy_approval_required: ${data.deployApprovalRequired}`,
    `- manual_gate_findings: ${data.manualGateFindings}`,
    `- manual_gate_types: ${data.manualGateTypes.length ? data.manualGateTypes.join(', ') : '(none)'}`,
    `- worker_review: ${data.workerReviewPath || '(missing)'}`,
    `- secret_gates: ${data.secretGatesPath || '(missing)'}`,
    `- status_fingerprint: ${data.statusFingerprint}`,
    '',
    '## Checklist',
    '',
  ];

  for (const check of data.checks) {
    const box = check.status === 'pass' ? '[x]' : '[ ]';
    lines.push(`- ${box} ${check.id}: ${check.status}`);
    lines.push(`  - ${check.detail}`);
  }

  lines.push('');
  lines.push('## Deploy Commands');
  lines.push('');
  if (data.commands.length === 0) {
    lines.push('- No deploy commands inferred.');
  } else {
    for (const item of data.commands) {
      lines.push(`- ${item.worker} (${item.group})`);
      lines.push(`  - command: \`${item.command}\``);
      for (const check of item.postDeployChecks) {
        lines.push(`  - verify: ${check}`);
      }
    }
  }

  lines.push('');
  lines.push('## Hard Stops');
  lines.push('');
  lines.push('- Do not run deploy commands without explicit approval.');
  lines.push('- Do not paste secrets into repo files or reports.');
  lines.push('- Do not run protected endpoint verification without a local token.');

  return lines.join('\n');
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}
