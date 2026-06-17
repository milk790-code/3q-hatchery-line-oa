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
const workbenchJsonPath = path.resolve(args.workbenchJson || path.join(stateDir, 'account-binding-workbench', 'latest.json'));
const verificationDir = path.join(stateDir, 'account-binding-workbench-verifications');
const now = new Date();
const stamp = toStamp(now);

const workbench = await readJson(workbenchJsonPath);
const findings = verifyWorkbench(workbench);
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  stateDir,
  workbenchJsonPath,
  reportPath: path.join(verificationDir, `${stamp}-account-binding-workbench-verification.md`),
  jsonPath: path.join(verificationDir, `${stamp}-account-binding-workbench-verification.json`),
  latestPath: path.join(verificationDir, 'latest.json'),
  ok: findings.failures.length === 0,
  summary: {
    itemCount: workbench.items?.length ?? 0,
    readyCount: workbench.summary?.readyCount ?? null,
    attentionCount: workbench.summary?.attentionCount ?? null,
    failureCount: findings.failures.length,
    warningCount: findings.warnings.length,
  },
  findings,
  statusFingerprint: hash(JSON.stringify({
    workbenchFingerprint: workbench.statusFingerprint || null,
    items: workbench.items || [],
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

function verifyWorkbench(workbench) {
  const failures = [];
  const warnings = [];
  const items = Array.isArray(workbench.items) ? workbench.items : [];
  const summary = workbench.summary || {};

  requireEqual(failures, 'repoRoot', workbench.repoRoot, repoRoot);
  requireEqual(failures, 'stateDir', workbench.stateDir, stateDir);
  if (!items.length) failures.push('items must not be empty');
  if (!Array.isArray(workbench.hardStops) || workbench.hardStops.length < 3) failures.push('hardStops must list the account-binding red lines');
  if (!Array.isArray(workbench.rerunCommands) || workbench.rerunCommands.length < 3) failures.push('rerunCommands must include health, workbench, verification, and safe-local run commands');

  const expectedReady = items.filter(item => !item.attention).length;
  const expectedAttention = items.filter(item => item.attention).length;
  requireEqual(failures, 'summary.total', Number(summary.total), items.length);
  requireEqual(failures, 'summary.readyCount', Number(summary.readyCount), expectedReady);
  requireEqual(failures, 'summary.attentionCount', Number(summary.attentionCount), expectedAttention);

  const attentionSorted = items
    .filter(item => item.attention)
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  requireEqual(failures, 'summary.nextBindingId', summary.nextBindingId || null, attentionSorted[0]?.id || null);

  for (const item of items) {
    if (item.autoBindable !== false) failures.push(`${item.id} must keep autoBindable=false`);
    if (!item.whyNotAutoBind) failures.push(`${item.id} is missing whyNotAutoBind`);
    if (!item.ownerAction) failures.push(`${item.id} is missing ownerAction`);
    if (!item.bindingSurface) failures.push(`${item.id} is missing bindingSurface`);
    const commands = [
      ...(item.setupCommands || []),
      ...(item.verificationCommands || []),
    ].join('\n');
    if (/(wrangler\s+deploy|git\s+push|gh\s+pr\s+create|railway\s+up|send-mailmessage|line\s+push|broadcast|remove-item\s+-recurse)/i.test(commands)) {
      failures.push(`${item.id} includes a command that crosses a LoopOS hard stop`);
    }
    if (/[A-Za-z0-9_-]{28,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/.test(commands)) {
      failures.push(`${item.id} appears to contain a token-like literal`);
    }
    if (item.category === 'local_secret' && !item.localSecretPath) failures.push(`${item.id} local_secret item is missing localSecretPath`);
    if (item.category === 'codex_app_auth' && !/oauth|codex app/i.test(`${item.whyNotAutoBind} ${item.bindingSurface}`)) {
      warnings.push(`${item.id} should clearly mention Codex app OAuth/manual auth`);
    }
  }

  for (const phrase of ['OAuth', 'secret values', 'explicit owner action']) {
    if (!workbench.hardStops.some(stop => String(stop).includes(phrase))) {
      failures.push(`hardStops missing phrase: ${phrase}`);
    }
  }

  const expectedFingerprint = hash(JSON.stringify({
    connectorHealth: workbench.sourceConnectorHealthFingerprint || null,
    secretChecklist: workbench.sourceSecretChecklistFingerprint || null,
    items: items.map(item => ({
      id: item.id,
      status: item.status,
      connectorStatus: item.connectorStatus,
      secretStatus: item.secretStatus,
      priority: item.priority,
    })),
  }));
  requireEqual(failures, 'statusFingerprint', workbench.statusFingerprint, expectedFingerprint);

  return { failures, warnings };
}

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

function requireEqual(failures, label, actual, expected) {
  if (actual !== expected) failures.push(`${label} expected ${expected} got ${actual}`);
}

function renderMarkdown(payload) {
  const lines = [
    '# LOOPS Account Binding Workbench Verification',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- workbench_json: ${payload.workbenchJsonPath}`,
    `- ok: ${payload.ok}`,
    `- item_count: ${payload.summary.itemCount}`,
    `- ready: ${payload.summary.readyCount}`,
    `- attention: ${payload.summary.attentionCount}`,
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
  lines.push('- It does not log in, grant OAuth, install software, write secrets, deploy, push, send, or delete data.');
  return lines.join('\n');
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
}
