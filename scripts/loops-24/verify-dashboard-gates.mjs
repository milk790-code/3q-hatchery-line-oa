#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { createHash } from 'node:crypto';

const automationId = process.env.LOOPS_AUTOMATION_ID || 'loops-24';
const repoRoot = path.resolve(process.env.LOOPS_REPO_ROOT || process.cwd());
const codexHome = process.env.CODEX_HOME
  || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.codex') : path.join(os.homedir(), '.codex'));
const stateDir = path.resolve(process.env.LOOPS_STATE_DIR || path.join(codexHome, 'automations', automationId));
const args = parseArgs(process.argv.slice(2));
const dashboardJsonPath = path.resolve(args.dashboardJson || path.join(stateDir, 'dashboard', 'latest.json'));
const verificationDir = path.join(stateDir, 'dashboard-verifications');
const now = new Date();
const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

const dashboard = await readJson(dashboardJsonPath);
const waiting = Array.isArray(dashboard.waiting) ? dashboard.waiting : [];
const nextApproval = Array.isArray(dashboard.nextApproval) ? dashboard.nextApproval : [];
const approvalIndex = buildApprovalIndex(nextApproval);
const findings = verifyWaitingItems(waiting, approvalIndex);
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  automationId,
  stateDir,
  dashboardJsonPath,
  reportPath: path.join(verificationDir, `${stamp}-dashboard-gates.md`),
  jsonPath: path.join(verificationDir, `${stamp}-dashboard-gates.json`),
  latestPath: path.join(verificationDir, 'latest.json'),
  ok: findings.failures.length === 0,
  summary: {
    waitingCount: waiting.length,
    approvalGroupCount: nextApproval.length,
    failureCount: findings.failures.length,
    warningCount: findings.warnings.length,
  },
  findings,
  statusFingerprint: hash(JSON.stringify({
    waiting: waiting.map(item => ({
      label: item.label,
      manualGate: item.manualGate,
      nextApproval: item.nextApproval,
      nextApprovals: item.nextApprovals,
    })),
    nextApproval: nextApproval.map(group => ({
      approval: group.approval,
      items: (group.items || []).map(item => item.label),
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
    if (arg === '--dashboard-json') {
      parsed.dashboardJson = argv[index + 1];
      index += 1;
    }
  }
  return parsed;
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read dashboard JSON at ${file}: ${error.message}`);
  }
}

function buildApprovalIndex(groups) {
  const index = new Map();
  for (const group of groups || []) {
    const approval = group?.approval;
    if (!approval) continue;
    const labels = new Set((group.items || []).map(item => item.label).filter(Boolean));
    index.set(approval, labels);
  }
  return index;
}

function verifyWaitingItems(items, approvalIndex) {
  const failures = [];
  const warnings = [];
  if (!items.length) {
    warnings.push('Dashboard has no waiting items to verify.');
  }

  for (const item of items) {
    const label = item.label || 'unknown-waiting-item';
    const actualGates = item.nextApprovals?.length
      ? item.nextApprovals
      : (item.nextApproval ? [item.nextApproval] : []);
    const expectedGates = expectedApprovalGates(item);

    if (!item.manualGate) {
      warnings.push(`${label} has no manualGate field; fallback inference was used.`);
    }

    for (const gate of expectedGates) {
      if (!actualGates.includes(gate)) {
        failures.push(`${label} missing nextApprovals entry ${gate}`);
      }
      if (!approvalIndex.get(gate)?.has(label)) {
        failures.push(`${label} missing from approval group ${gate}`);
      }
    }
  }

  return { failures, warnings };
}

function expectedApprovalGates(item) {
  const routingText = `${item.label || ''} ${item.manualGate || ''}`.toLowerCase();
  const fullText = `${routingText} ${item.summary || ''}`.toLowerCase();
  const gates = [];
  const add = gate => {
    if (gate && !gates.includes(gate)) gates.push(gate);
  };

  if (item.manualGate === 'manual_secret_input' || /secret|token|api[_-]?key|manual_secret_input/.test(fullText)) add('secret-input');
  if (item.manualGate === 'manual_send_only' || /manual_send_only|cold-outreach|outreach|sending/.test(fullText)) add('manual-send-approval');
  if (item.manualGate === 'manual_deploy_approval' || /manual_deploy_approval|deploy|cron-status|worker/.test(fullText)) add('deploy-approval');
  if (item.manualGate === 'manual_create_only' || /manual_create_only|github|local-pr|pr-readiness|pull request|push/.test(fullText)) {
    add(/github|local-pr|pr-readiness|pull request|push/.test(fullText) ? 'push-and-pr-approval' : 'local-review');
  }
  if (item.manualGate === 'manual_review_only'
    || /content-queue|wakeup|frontend|slice|handoff|worktree|wrangler-cache|local-review/.test(routingText)) {
    add('local-review');
  }

  return gates.length ? gates : ['review'];
}

function renderMarkdown(payload) {
  const lines = [
    '# LOOPS Dashboard Gate Verification',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- dashboard_json: ${payload.dashboardJsonPath}`,
    `- ok: ${payload.ok}`,
    `- waiting_count: ${payload.summary.waitingCount}`,
    `- approval_group_count: ${payload.summary.approvalGroupCount}`,
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
  lines.push('- This verifier reads local dashboard JSON and writes a local report only.');
  lines.push('- It does not push, create PRs, deploy, call protected endpoints, write secrets, or send messages.');
  return lines.join('\n');
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}
