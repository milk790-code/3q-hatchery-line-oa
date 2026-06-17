#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { findFirstRawNonAscii } from './lib/portable-json.mjs';

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

const dashboardJsonSource = await fs.readFile(dashboardJsonPath, 'utf8');
const dashboard = parseJson(dashboardJsonPath, dashboardJsonSource);
const waiting = Array.isArray(dashboard.waiting) ? dashboard.waiting : [];
const nextApproval = Array.isArray(dashboard.nextApproval) ? dashboard.nextApproval : [];
const approvalGroups = Array.isArray(dashboard.approvalGroups) ? dashboard.approvalGroups : [];
const approvalIndex = buildApprovalIndex(nextApproval);
const portableJsonFindings = verifyPortableJsonSource(dashboardJsonSource);
const findings = mergeFindings(
  portableJsonFindings,
  verifyDashboardSchema(dashboard, waiting, nextApproval, approvalGroups),
  verifyAccountBindingWorkbenchSummary(dashboard),
  verifyOwnerApprovalBundleSummary(dashboard),
  verifyApprovalWorkbenchSummary(dashboard),
  verifyWaitingItems(waiting, approvalIndex),
);
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
    dashboardJsonAsciiPortable: portableJsonFindings.failures.length === 0,
    accountBindingAttentionCount: dashboard.accountBindingWorkbench?.summary?.attentionCount ?? null,
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
    accountBindingWorkbench: dashboard.accountBindingWorkbench
      ? {
          total: dashboard.accountBindingWorkbench.summary?.total ?? null,
          readyCount: dashboard.accountBindingWorkbench.summary?.readyCount ?? null,
          attentionCount: dashboard.accountBindingWorkbench.summary?.attentionCount ?? null,
          nextBindingId: dashboard.accountBindingWorkbench.summary?.nextBindingId ?? null,
          nextBindingLabel: dashboard.accountBindingWorkbench.summary?.nextBindingLabel ?? null,
        }
      : null,
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

function parseJson(file, source) {
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Unable to read dashboard JSON at ${file}: ${error.message}`);
  }
}

function verifyPortableJsonSource(source) {
  const failures = [];
  const warnings = [];
  const raw = findFirstRawNonAscii(source);
  if (raw) {
    failures.push(`Dashboard JSON contains raw non-ASCII character ${raw.codePoint} at line ${raw.line}, column ${raw.column}; write escaped JSON so Windows PowerShell default Get-Content can pipe it to ConvertFrom-Json safely.`);
  }
  return { failures, warnings };
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

function verifyDashboardSchema(dashboard, waiting, nextApproval, approvalGroups) {
  const failures = [];
  const warnings = [];
  const summary = dashboard.summary || {};

  if (!dashboard.summary) {
    failures.push('Dashboard JSON is missing summary.');
  }
  if (!Array.isArray(dashboard.manualRedLines) || dashboard.manualRedLines.length === 0) {
    failures.push('Dashboard JSON is missing manualRedLines.');
  }
  if (!Array.isArray(dashboard.approvalGroups)) {
    failures.push('Dashboard JSON is missing approvalGroups.');
  }
  if (approvalGroups.length !== nextApproval.length) {
    failures.push(`approvalGroups length ${approvalGroups.length} does not match nextApproval length ${nextApproval.length}`);
  }
  for (const group of approvalGroups) {
    const approval = group?.approval || '(unknown)';
    const items = Array.isArray(group?.items) ? group.items : [];
    const count = Number(group?.count);
    const displayLimit = Number(group?.displayLimit);
    const displayedCount = Number(group?.displayedCount);
    const hiddenCount = Number(group?.hiddenCount);
    if (count !== items.length) {
      failures.push(`approval group ${approval} count expected ${items.length} got ${group?.count}`);
    }
    if (!Number.isInteger(displayLimit) || displayLimit < 0) {
      failures.push(`approval group ${approval} displayLimit is missing or invalid.`);
    }
    if (!Number.isInteger(displayedCount) || displayedCount !== Math.min(items.length, Math.max(0, displayLimit || 0))) {
      failures.push(`approval group ${approval} displayedCount expected ${Math.min(items.length, Math.max(0, displayLimit || 0))} got ${group?.displayedCount}`);
    }
    if (!Number.isInteger(hiddenCount) || hiddenCount !== Math.max(0, items.length - Math.min(items.length, Math.max(0, displayLimit || 0)))) {
      failures.push(`approval group ${approval} hiddenCount expected ${Math.max(0, items.length - Math.min(items.length, Math.max(0, displayLimit || 0)))} got ${group?.hiddenCount}`);
    }
  }

  const expected = {
    completedCount: Array.isArray(dashboard.completed) ? dashboard.completed.length : 0,
    blockedCount: Array.isArray(dashboard.blocked) ? dashboard.blocked.length : 0,
    manualWaitCount: Array.isArray(dashboard.manualWaits) ? dashboard.manualWaits.length : 0,
    waitingCount: waiting.length,
    approvalGroupCount: nextApproval.length,
    escalatedCount: Array.isArray(dashboard.escalatedBlockers) ? dashboard.escalatedBlockers.length : 0,
    manualRedLineCount: Array.isArray(dashboard.manualRedLines) ? dashboard.manualRedLines.length : 0,
  };

  for (const [key, value] of Object.entries(expected)) {
    if (summary[key] !== value) {
      failures.push(`summary.${key} expected ${value} got ${summary[key]}`);
    }
  }
  const expectedTopApproval = dashboard.loopos?.morningDecision?.nextApproval || nextApproval[0]?.approval || null;
  if (summary.nextApproval !== expectedTopApproval) {
    failures.push(`summary.nextApproval expected ${expectedTopApproval} got ${summary.nextApproval}`);
  }
  if (nextApproval.length && summary.largestApprovalGroup !== nextApproval[0]?.approval) {
    failures.push(`summary.largestApprovalGroup expected ${nextApproval[0]?.approval} got ${summary.largestApprovalGroup}`);
  }
  if (!summary.topAction && dashboard.loopos?.morningDecision?.label) {
    warnings.push('summary.topAction is missing while loopos.morningDecision exists.');
  }

  return { failures, warnings };
}

function verifyAccountBindingWorkbenchSummary(dashboard) {
  const failures = [];
  const warnings = [];
  const workbench = dashboard.accountBindingWorkbench;
  const dashboardSummary = dashboard.summary || {};

  if (!workbench || workbench.available === false) {
    warnings.push('Dashboard has no accountBindingWorkbench artifact summary to verify.');
    return { failures, warnings };
  }

  const summary = workbench.summary || {};
  const items = Array.isArray(workbench.items) ? workbench.items : [];
  const total = Number(summary.total);
  const readyCount = Number(summary.readyCount);
  const attentionCount = Number(summary.attentionCount);

  if (!Number.isFinite(total)) failures.push('accountBindingWorkbench.summary.total is missing or invalid.');
  if (!Number.isFinite(readyCount)) failures.push('accountBindingWorkbench.summary.readyCount is missing or invalid.');
  if (!Number.isFinite(attentionCount)) failures.push('accountBindingWorkbench.summary.attentionCount is missing or invalid.');

  if (items.length && Number.isFinite(total) && total !== items.length) {
    failures.push(`accountBindingWorkbench.summary.total expected ${items.length} got ${summary.total}`);
  }
  if (items.length && Number.isFinite(readyCount)) {
    const expectedReady = items.filter(item => !item.attention).length;
    if (readyCount !== expectedReady) {
      failures.push(`accountBindingWorkbench.summary.readyCount expected ${expectedReady} got ${summary.readyCount}`);
    }
  }
  if (items.length && Number.isFinite(attentionCount)) {
    const expectedAttention = items.filter(item => item.attention).length;
    if (attentionCount !== expectedAttention) {
      failures.push(`accountBindingWorkbench.summary.attentionCount expected ${expectedAttention} got ${summary.attentionCount}`);
    }
  }

  const byStatusTotal = sumObjectNumbers(summary.byStatus);
  if (summary.byStatus && Number.isFinite(total) && byStatusTotal !== total) {
    failures.push(`accountBindingWorkbench.summary.byStatus total expected ${total} got ${byStatusTotal}`);
  }
  const byCategoryTotal = sumObjectNumbers(summary.byCategory);
  if (summary.byCategory && Number.isFinite(total) && byCategoryTotal !== total) {
    failures.push(`accountBindingWorkbench.summary.byCategory total expected ${total} got ${byCategoryTotal}`);
  }

  if (items.length) {
    const nextBinding = items
      .filter(item => item.attention)
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))[0] || null;
    if ((summary.nextBindingId ?? null) !== (nextBinding?.id ?? null)) {
      failures.push(`accountBindingWorkbench.summary.nextBindingId expected ${nextBinding?.id ?? null} got ${summary.nextBindingId ?? null}`);
    }
    if ((summary.nextBindingLabel ?? null) !== (nextBinding?.label ?? null)) {
      failures.push(`accountBindingWorkbench.summary.nextBindingLabel expected ${nextBinding?.label ?? null} got ${summary.nextBindingLabel ?? null}`);
    }
  } else if (Number.isFinite(attentionCount) && attentionCount > 0 && !summary.nextBindingId) {
    failures.push('accountBindingWorkbench.summary.nextBindingId is missing while attentionCount is greater than zero.');
  }
  if (Number(dashboardSummary.accountBindingAttentionCount || 0) !== Number(summary.attentionCount || 0)) {
    failures.push(`summary.accountBindingAttentionCount expected ${summary.attentionCount || 0} got ${dashboardSummary.accountBindingAttentionCount}`);
  }
  if ((dashboardSummary.accountBindingNextBindingId ?? null) !== (summary.nextBindingId ?? null)) {
    failures.push(`summary.accountBindingNextBindingId expected ${summary.nextBindingId ?? null} got ${dashboardSummary.accountBindingNextBindingId}`);
  }
  if ((dashboardSummary.accountBindingNextBindingLabel ?? null) !== (summary.nextBindingLabel ?? null)) {
    failures.push(`summary.accountBindingNextBindingLabel expected ${summary.nextBindingLabel ?? null} got ${dashboardSummary.accountBindingNextBindingLabel}`);
  }

  return { failures, warnings };
}

function verifyApprovalWorkbenchSummary(dashboard) {
  const failures = [];
  const warnings = [];
  const workbench = dashboard.approvalWorkbench;
  const dashboardSummary = dashboard.summary || {};

  if (!workbench || workbench.available === false) {
    warnings.push('Dashboard has no approvalWorkbench artifact summary to verify.');
    return { failures, warnings };
  }

  const summary = workbench.summary || {};
  const relativeTo = dashboard.generatedAt || dashboard.generatedAtTaipei;
  const expectedMinutes = minutesUntil(summary.expiresAt, relativeTo);
  const actualMinutes = toFiniteNumber(summary.expiresInMinutes);
  const mirroredMinutes = toFiniteNumber(dashboardSummary.approvalWorkbenchExpiresInMinutes);

  if (!summary.expiresAt || expectedMinutes === null) {
    failures.push('approvalWorkbench.summary.expiresAt is missing or invalid.');
  }
  if (!summary.expiresAtTaipei) {
    failures.push('approvalWorkbench.summary.expiresAtTaipei is missing.');
  }
  if (actualMinutes === null) {
    failures.push('approvalWorkbench.summary.expiresInMinutes is missing or invalid.');
  } else if (expectedMinutes !== null && Math.abs(actualMinutes - expectedMinutes) > 0.01) {
    failures.push(`approvalWorkbench.summary.expiresInMinutes expected ${expectedMinutes} got ${actualMinutes}`);
  }
  if (mirroredMinutes === null) {
    failures.push('summary.approvalWorkbenchExpiresInMinutes is missing or invalid.');
  } else if (actualMinutes !== null && Math.abs(mirroredMinutes - actualMinutes) > 0.01) {
    failures.push(`summary.approvalWorkbenchExpiresInMinutes expected ${actualMinutes} got ${mirroredMinutes}`);
  }
  if (dashboardSummary.approvalWorkbenchRequestedExpiresAt !== summary.requestedExpiresAt) {
    failures.push(`summary.approvalWorkbenchRequestedExpiresAt expected ${summary.requestedExpiresAt} got ${dashboardSummary.approvalWorkbenchRequestedExpiresAt}`);
  }
  if ((dashboardSummary.approvalWorkbenchExpiryBoundReason ?? null) !== (summary.expiryBoundReason ?? null)) {
    failures.push(`summary.approvalWorkbenchExpiryBoundReason expected ${summary.expiryBoundReason ?? null} got ${dashboardSummary.approvalWorkbenchExpiryBoundReason}`);
  }
  if ((dashboardSummary.approvalWorkbenchWakeupFreshUntil ?? null) !== (summary.wakeupFreshUntil ?? null)) {
    failures.push(`summary.approvalWorkbenchWakeupFreshUntil expected ${summary.wakeupFreshUntil ?? null} got ${dashboardSummary.approvalWorkbenchWakeupFreshUntil}`);
  }
  if (dashboardSummary.approvalWorkbenchExpiresAtTaipei !== summary.expiresAtTaipei) {
    failures.push(`summary.approvalWorkbenchExpiresAtTaipei expected ${summary.expiresAtTaipei} got ${dashboardSummary.approvalWorkbenchExpiresAtTaipei}`);
  }

  const expectedExpired = isTimestampExpired(summary.expiresAt, relativeTo);
  if (expectedExpired !== null && summary.expired !== expectedExpired) {
    failures.push(`approvalWorkbench.summary.expired expected ${expectedExpired} got ${summary.expired}`);
  }
  if (dashboardSummary.approvalWorkbenchExpired !== summary.expired) {
    failures.push(`summary.approvalWorkbenchExpired expected ${summary.expired} got ${dashboardSummary.approvalWorkbenchExpired}`);
  }
  if (summary.expired === true && workbench.status === 'ready-for-owner-decision') {
    failures.push('approvalWorkbench is expired but still marked ready-for-owner-decision.');
  }

  return { failures, warnings };
}

function verifyOwnerApprovalBundleSummary(dashboard) {
  const failures = [];
  const warnings = [];
  const bundle = dashboard.ownerApprovalBundle;
  const dashboardSummary = dashboard.summary || {};

  if (!bundle || bundle.available === false) {
    warnings.push('Dashboard has no ownerApprovalBundle artifact summary to verify.');
    return { failures, warnings };
  }

  const summary = bundle.summary || {};
  const attentionCount = Number(summary.attentionCount || 0);
  const relativeTo = dashboard.generatedAt || dashboard.generatedAtTaipei;
  const expectedWakeupMinutes = minutesUntil(summary.wakeupFreshUntil, relativeTo);
  const actualWakeupMinutes = toFiniteNumber(summary.wakeupFreshInMinutes);
  const mirroredWakeupMinutes = toFiniteNumber(dashboardSummary.ownerApprovalBundleWakeupFreshInMinutes);

  if (dashboardSummary.ownerApprovalBundleStatus !== bundle.status) {
    failures.push(`summary.ownerApprovalBundleStatus expected ${bundle.status} got ${dashboardSummary.ownerApprovalBundleStatus}`);
  }
  if (dashboardSummary.ownerApprovalBundleHead !== bundle.head) {
    failures.push(`summary.ownerApprovalBundleHead expected ${bundle.head} got ${dashboardSummary.ownerApprovalBundleHead}`);
  }
  if (dashboardSummary.ownerApprovalBundleHeadCurrent !== bundle.headCurrent) {
    failures.push(`summary.ownerApprovalBundleHeadCurrent expected ${bundle.headCurrent} got ${dashboardSummary.ownerApprovalBundleHeadCurrent}`);
  }
  if (Number(dashboardSummary.ownerApprovalBundleAttentionCount || 0) !== attentionCount) {
    failures.push(`summary.ownerApprovalBundleAttentionCount expected ${attentionCount} got ${dashboardSummary.ownerApprovalBundleAttentionCount}`);
  }
  if (dashboardSummary.ownerApprovalBundlePrPublishReady !== summary.prPublishReady) {
    failures.push(`summary.ownerApprovalBundlePrPublishReady expected ${summary.prPublishReady} got ${dashboardSummary.ownerApprovalBundlePrPublishReady}`);
  }
  if (dashboardSummary.ownerApprovalBundleLocalScopeClean !== summary.localScopeClean) {
    failures.push(`summary.ownerApprovalBundleLocalScopeClean expected ${summary.localScopeClean} got ${dashboardSummary.ownerApprovalBundleLocalScopeClean}`);
  }
  if (dashboardSummary.ownerApprovalBundleWakeupFresh !== summary.wakeupFresh) {
    failures.push(`summary.ownerApprovalBundleWakeupFresh expected ${summary.wakeupFresh} got ${dashboardSummary.ownerApprovalBundleWakeupFresh}`);
  }
  if (dashboardSummary.ownerApprovalBundleWakeupFreshUntil !== summary.wakeupFreshUntil) {
    failures.push(`summary.ownerApprovalBundleWakeupFreshUntil expected ${summary.wakeupFreshUntil} got ${dashboardSummary.ownerApprovalBundleWakeupFreshUntil}`);
  }
  if (actualWakeupMinutes === null) {
    failures.push('ownerApprovalBundle.summary.wakeupFreshInMinutes is missing or invalid.');
  } else if (expectedWakeupMinutes !== null && Math.abs(actualWakeupMinutes - expectedWakeupMinutes) > 0.01) {
    failures.push(`ownerApprovalBundle.summary.wakeupFreshInMinutes expected ${expectedWakeupMinutes} got ${actualWakeupMinutes}`);
  }
  if (mirroredWakeupMinutes === null) {
    failures.push('summary.ownerApprovalBundleWakeupFreshInMinutes is missing or invalid.');
  } else if (actualWakeupMinutes !== null && Math.abs(mirroredWakeupMinutes - actualWakeupMinutes) > 0.01) {
    failures.push(`summary.ownerApprovalBundleWakeupFreshInMinutes expected ${actualWakeupMinutes} got ${mirroredWakeupMinutes}`);
  }
  if (dashboardSummary.ownerApprovalBundlePowerWakeNeedsApproval !== summary.powerWakeNeedsApproval) {
    failures.push(`summary.ownerApprovalBundlePowerWakeNeedsApproval expected ${summary.powerWakeNeedsApproval} got ${dashboardSummary.ownerApprovalBundlePowerWakeNeedsApproval}`);
  }
  if (bundle.status === 'ready-for-owner-approval' && attentionCount > 0) {
    failures.push('ownerApprovalBundle is ready-for-owner-approval but has attention gates.');
  }
  if (bundle.status === 'ready-for-owner-approval' && bundle.headCurrent !== true) {
    warnings.push('ownerApprovalBundle is ready-for-owner-approval but its head is not current; owner bundle refresh should run before final approval.');
  }

  return { failures, warnings };
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

function mergeFindings(...all) {
  return {
    failures: all.flatMap(item => item.failures || []),
    warnings: all.flatMap(item => item.warnings || []),
  };
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
  if (item.manualGate === 'manual_investor_review') {
    add('investor-review');
    return gates;
  }
  if (/investor|fundraising|taiwania|pitch[-_ ]?deck|data[-_ ]?room|investor[-_ ]?packet/.test(fullText)) add('investor-review');
  if (item.manualGate === 'manual_create_only' || /manual_create_only|github|local-pr|pr-readiness|pull request|push/.test(fullText)) {
    add(/github|local-pr|pr-readiness|pull request|push/.test(fullText) ? 'push-and-pr-approval' : 'local-review');
  }
  if (item.manualGate === 'manual_review_only'
    || /content-queue|wakeup|frontend|slice|handoff|worktree|wrangler-cache|local-review/.test(routingText)) {
    add('local-review');
  }
  if (/waketorun=false|waketorun is disabled|sleeping-machine|sleeping machine|power-wake/.test(fullText)) {
    add('power-wake-policy');
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

function minutesUntil(value, relativeTo) {
  const timestamp = Date.parse(value || '');
  const reference = Date.parse(relativeTo || '');
  if (!Number.isFinite(timestamp) || !Number.isFinite(reference)) return null;
  return round((timestamp - reference) / 60_000);
}

function isTimestampExpired(value, relativeTo) {
  const timestamp = Date.parse(value || '');
  const reference = Date.parse(relativeTo || '');
  if (!Number.isFinite(timestamp) || !Number.isFinite(reference)) return null;
  return timestamp <= reference;
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sumObjectNumbers(value) {
  if (!value || typeof value !== 'object') return 0;
  return Object.values(value).reduce((total, item) => {
    const number = Number(item);
    return total + (Number.isFinite(number) ? number : 0);
  }, 0);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
