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
const workbenchJsonPath = path.resolve(args.workbenchJson || path.join(stateDir, 'approval-workbench', 'latest.json'));
const verificationDir = path.join(stateDir, 'approval-workbench-verifications');
const now = new Date();
const stamp = toStamp(now);

const workbench = await readJson(workbenchJsonPath);
const bundle = await readJson(workbench.bundleJsonPath || path.join(stateDir, 'owner-approval-bundles', 'latest.json'));
const ownerVerification = await readJson(path.join(stateDir, 'owner-approval-verifications', 'latest.json'), null);
const findings = verifyWorkbench(workbench, bundle, ownerVerification);
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  automationId,
  stateDir,
  workbenchJsonPath,
  bundleJsonPath: workbench.bundleJsonPath || null,
  reportPath: path.join(verificationDir, `${stamp}-approval-workbench-verification.md`),
  jsonPath: path.join(verificationDir, `${stamp}-approval-workbench-verification.json`),
  latestPath: path.join(verificationDir, 'latest.json'),
  ok: findings.failures.length === 0,
  summary: {
    readyCommandCount: workbench.summary?.readyCommandCount ?? null,
    manualGateCount: workbench.summary?.manualGateCount ?? null,
    attentionGateCount: workbench.summary?.attentionGateCount ?? null,
    failureCount: findings.failures.length,
    warningCount: findings.warnings.length,
  },
  findings,
  statusFingerprint: hash(JSON.stringify({
    workbenchFingerprint: workbench.statusFingerprint || null,
    bundleFingerprint: bundle.bundleFingerprint || null,
    readyCommands: workbench.readyCommands || [],
    manualGates: workbench.manualGates || [],
    attentionGates: workbench.attentionGates || [],
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

function verifyWorkbench(workbench, bundle, ownerVerification) {
  const failures = [];
  const warnings = [];
  const commandGates = (bundle.gates || []).filter(gate => Array.isArray(gate.commands) && gate.commands.length);
  const expectedReadyCommands = commandGates.filter(gate => gate.status === 'ready_for_approval').map(toCommandGate);
  const expectedBlockedCommands = commandGates.filter(gate => gate.status !== 'ready_for_approval').map(toCommandGate);
  const expectedManualGates = (bundle.gates || [])
    .filter(gate => ['manual_approval', 'manual_input', 'ready_for_approval'].includes(gate.status))
    .map(toGateSummary);
  const expectedAttentionGates = (bundle.gates || [])
    .filter(gate => gate.status === 'attention')
    .map(toGateSummary);
  const expectedStatus = ownerVerification?.ok === true && expectedAttentionGates.length === 0
    ? 'ready-for-owner-decision'
    : 'attention';

  requireEqual(failures, 'repoRoot', workbench.repoRoot, repoRoot);
  requireEqual(failures, 'stateDir', workbench.stateDir, stateDir);
  requireEqual(failures, 'bundleFingerprint', workbench.bundleFingerprint, bundle.bundleFingerprint || null);
  requireEqual(failures, 'branch', workbench.branch, bundle.branch || null);
  requireEqual(failures, 'head', workbench.head, bundle.head || null);
  requireEqual(failures, 'ahead', Number(workbench.ahead), Number(bundle.ahead));
  requireEqual(failures, 'behind', Number(workbench.behind), Number(bundle.behind));
  requireEqual(failures, 'bundleStatus', workbench.bundleStatus, bundle.summary?.status || null);
  requireEqual(failures, 'verificationOk', workbench.verificationOk, ownerVerification?.ok === true);
  requireEqual(failures, 'status', workbench.status, expectedStatus);

  if (!arrayJsonEqual(workbench.readyCommands || [], expectedReadyCommands)) {
    failures.push('readyCommands do not match ready_for_approval command gates from owner bundle');
  }
  if (!arrayJsonEqual(workbench.blockedCommands || [], expectedBlockedCommands)) {
    failures.push('blockedCommands do not match non-ready command gates from owner bundle');
  }
  if (!arrayJsonEqual(workbench.manualGates || [], expectedManualGates)) {
    failures.push('manualGates do not match manual owner gates from owner bundle');
  }
  if (!arrayJsonEqual(workbench.attentionGates || [], expectedAttentionGates)) {
    failures.push('attentionGates do not match attention gates from owner bundle');
  }

  const expectedSummary = {
    readyCommandCount: expectedReadyCommands.reduce((count, gate) => count + gate.commands.length, 0),
    blockedCommandCount: expectedBlockedCommands.reduce((count, gate) => count + gate.commands.length, 0),
    manualGateCount: expectedManualGates.length,
    attentionGateCount: expectedAttentionGates.length,
    prPublishReady: bundle.summary?.prPublishReady === true,
    workerReady: bundle.summary?.workerReady === true,
    localScopeClean: bundle.summary?.localScopeClean === true,
    localInvestorPacketCount: Number(bundle.summary?.localInvestorPacketCount || 0),
    verificationFailureCount: Number(ownerVerification?.summary?.failureCount || 0),
  };
  for (const [key, expected] of Object.entries(expectedSummary)) {
    requireEqual(failures, `summary.${key}`, workbench.summary?.[key], expected);
  }

  const expectedFingerprint = hash(JSON.stringify({
    bundleFingerprint: workbench.bundleFingerprint,
    verificationOk: workbench.verificationOk,
    readyCommands: workbench.readyCommands,
    blockedCommands: workbench.blockedCommands,
    manualGates: workbench.manualGates,
    attentionGates: workbench.attentionGates,
  }));
  requireEqual(failures, 'statusFingerprint', workbench.statusFingerprint, expectedFingerprint);

  const hardStops = workbench.hardStops || [];
  for (const phrase of ['explicit owner approval', 'Do not commit, send, share, or publish', 'Do not print or store secret values']) {
    if (!hardStops.some(stop => String(stop).includes(phrase))) {
      failures.push(`hardStops missing phrase: ${phrase}`);
    }
  }

  if ((workbench.readyCommands || []).some(gate => gate.status !== 'ready_for_approval')) {
    failures.push('readyCommands contains a gate that is not ready_for_approval');
  }
  if ((workbench.blockedCommands || []).some(gate => gate.status === 'ready_for_approval')) {
    failures.push('blockedCommands contains a ready_for_approval gate');
  }
  if ((workbench.readyCommands || []).some(gate => (gate.commands || []).some(command => /secret|token|password/i.test(command)))) {
    warnings.push('readyCommands mention secret-like terms; verify they are command names or env placeholders only.');
  }

  return { failures, warnings };
}

function toCommandGate(gate) {
  return {
    id: gate.id,
    label: gate.label,
    status: gate.status,
    ownerAction: gate.ownerAction,
    evidence: gate.evidence,
    commands: gate.commands || [],
  };
}

function toGateSummary(gate) {
  return {
    id: gate.id,
    label: gate.label,
    status: gate.status,
    ownerAction: gate.ownerAction,
    evidence: gate.evidence,
  };
}

function requireEqual(failures, label, actual, expected) {
  if (actual !== expected) failures.push(`${label} expected ${expected} got ${actual}`);
}

function arrayJsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function renderMarkdown(payload) {
  const lines = [
    '# LOOPS Approval Workbench Verification',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- workbench_json: ${payload.workbenchJsonPath}`,
    `- bundle_json: ${payload.bundleJsonPath || '(missing)'}`,
    `- ok: ${payload.ok}`,
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
  lines.push('- This verifier reads local LOOPS JSON artifacts and writes a local report only.');
  lines.push('- It does not run approval commands, push, create PRs, deploy, call protected endpoints, write secrets, or send messages.');
  return lines.join('\n');
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}
