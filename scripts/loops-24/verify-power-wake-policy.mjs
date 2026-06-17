#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import fssync from 'node:fs';
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
const policyJsonPath = path.resolve(args.policyJson || path.join(stateDir, 'power-wake-policy', 'latest.json'));
const verificationDir = path.join(stateDir, 'power-wake-policy-verifications');
const now = new Date();
const stamp = toStamp(now);

const policy = await readJson(policyJsonPath);
const wakeup = await readJson(policy.wakeupJsonPath || path.join(stateDir, 'wakeup-health', 'latest.json'), null);
const findings = await verifyPolicy(policy, wakeup);
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  automationId,
  stateDir,
  policyJsonPath,
  wakeupJsonPath: policy.wakeupJsonPath || null,
  reportPath: path.join(verificationDir, `${stamp}-power-wake-policy-verification.md`),
  jsonPath: path.join(verificationDir, `${stamp}-power-wake-policy-verification.json`),
  latestPath: path.join(verificationDir, 'latest.json'),
  ok: findings.failures.length === 0,
  summary: {
    policyStatus: policy.status || null,
    manualGate: policy.manualGate || null,
    needsOwnerDecision: policy.needsOwnerDecision === true,
    wakeToRun: policy.statusEvidence?.wakeToRun ?? null,
    failureCount: findings.failures.length,
    warningCount: findings.warnings.length,
  },
  findings,
  statusFingerprint: hash(JSON.stringify({
    policyFingerprint: policy.statusFingerprint || null,
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
    if (argv[index] === '--policy-json') {
      parsed.policyJson = argv[index + 1];
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

async function verifyPolicy(policy, wakeup) {
  const failures = [];
  const warnings = [];
  const task = wakeup?.scheduledTask || null;
  const expectedNeedsOwnerDecision = Boolean(task?.platform === 'win32' && task?.found === true && task?.wakeToRun === false);
  const expectedReady = Boolean(task?.platform !== 'win32' || task?.wakeToRun === true);
  const expectedStatus = expectedNeedsOwnerDecision
    ? 'needs-owner-decision'
    : (expectedReady ? 'ready' : 'attention');
  const expectedManualGate = expectedNeedsOwnerDecision ? 'power-wake-policy' : 'none_read_only';

  requireEqual(failures, 'repoRoot', policy.repoRoot, repoRoot);
  requireEqual(failures, 'automationId', policy.automationId, automationId);
  requireEqual(failures, 'stateDir', policy.stateDir, stateDir);
  requireEqual(failures, 'status', policy.status, expectedStatus);
  requireEqual(failures, 'manualGate', policy.manualGate, expectedManualGate);
  requireEqual(failures, 'needsOwnerDecision', policy.needsOwnerDecision === true, expectedNeedsOwnerDecision);
  requireEqual(failures, 'statusEvidence.wakeToRun', policy.statusEvidence?.wakeToRun ?? null, task?.wakeToRun ?? null);
  requireEqual(failures, 'statusEvidence.startWhenAvailable', policy.statusEvidence?.startWhenAvailable ?? null, task?.startWhenAvailable ?? null);
  requireEqual(failures, 'statusEvidence.taskFound', policy.statusEvidence?.taskFound ?? null, task?.found ?? null);
  requireEqual(failures, 'statusEvidence.lastTaskResult', policy.statusEvidence?.lastTaskResult ?? null, task?.lastTaskResult ?? null);
  requireEqual(failures, 'statusEvidence.numberOfMissedRuns', policy.statusEvidence?.numberOfMissedRuns ?? null, task?.numberOfMissedRuns ?? null);

  if (!policy.wakeupJsonPath || !fssync.existsSync(policy.wakeupJsonPath)) {
    failures.push('wakeupJsonPath must point to an existing local wakeup-health JSON file');
  }
  if (policy.sourceWakeupHealthReportPath && !fssync.existsSync(policy.sourceWakeupHealthReportPath)) {
    failures.push('sourceWakeupHealthReportPath must point to an existing local wakeup-health report');
  }
  if (!Array.isArray(policy.decisionOptions) || policy.decisionOptions.length < 3) {
    failures.push('decisionOptions must include at least three owner choices');
  }
  for (const id of ['keep_disabled', 'approve_sleep_wake', 'defer_24h']) {
    if (!policy.decisionOptions?.some(option => option.id === id)) {
      failures.push(`decisionOptions missing ${id}`);
    }
  }

  const hardStops = policy.hardStops || [];
  for (const phrase of ['local-only', 'must not include executable system-setting mutation commands', 'Do not store secret values']) {
    if (!hardStops.some(stop => String(stop).includes(phrase))) {
      failures.push(`hardStops missing phrase: ${phrase}`);
    }
  }

  const commandArrays = collectCommandArrays(policy);
  if (commandArrays.length) {
    failures.push(`power wake policy must not expose executable command arrays: ${commandArrays.join(', ')}`);
  }

  const mutationScan = scanForForbiddenMutationText(policy);
  if (mutationScan.length) {
    failures.push(`forbidden mutation text found: ${mutationScan.join(', ')}`);
  }

  const reportText = await readText(policy.reportPath, '');
  const markdownMutationScan = scanText(reportText);
  if (markdownMutationScan.length) {
    failures.push(`forbidden mutation text found in markdown report: ${markdownMutationScan.join(', ')}`);
  }

  const expectedFingerprint = hash(JSON.stringify({
    status: policy.status,
    manualGate: policy.manualGate,
    needsOwnerDecision: policy.needsOwnerDecision,
    statusEvidence: policy.statusEvidence,
    decisionOptions: policy.decisionOptions,
    hardStops: policy.hardStops,
  }));
  requireEqual(failures, 'statusFingerprint', policy.statusFingerprint, expectedFingerprint);

  if (expectedNeedsOwnerDecision && policy.summary?.recommendedOwnerOption !== 'keep_disabled_or_explicitly_approve_sleep_wake') {
    failures.push('summary.recommendedOwnerOption must preserve manual choice for disabled WakeToRun');
  }
  if (wakeup?.health?.ok !== true) {
    warnings.push('source wakeup-health is not ok; power wake policy can still be reviewed but should not be treated as complete health evidence');
  }

  return { failures, warnings };
}

function collectCommandArrays(value, prefix = '$') {
  const found = [];
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectCommandArrays(item, `${prefix}[${index}]`));
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${prefix}.${key}`;
    if (/commands?|shell|powershell|cmd/i.test(key) && (Array.isArray(child) || typeof child === 'string')) {
      found.push(childPath);
    }
    found.push(...collectCommandArrays(child, childPath));
  }
  return found;
}

function scanForForbiddenMutationText(value) {
  return scanText(JSON.stringify(value));
}

function scanText(text) {
  const value = String(text || '');
  const forbidden = [
    /\bSet-ScheduledTask\b/i,
    /\bRegister-ScheduledTask\b/i,
    /\bschtasks(?:\.exe)?\s+\/change\b/i,
    /\bpowercfg(?:\.exe)?\b/i,
    /\bStart-Process\b/i,
    /\bRemove-Item\b/i,
    /\bgit\s+push\b/i,
    /\bgh\s+pr\s+create\b/i,
    /\bwrangler\s+deploy\b/i,
  ];
  return forbidden
    .filter(pattern => pattern.test(value))
    .map(pattern => pattern.source);
}

async function readText(file, fallback) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (arguments.length > 1) return fallback;
    throw error;
  }
}

function requireEqual(failures, field, actual, expected) {
  if (!jsonEqual(actual, expected)) {
    failures.push(`${field} expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

function jsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function renderMarkdown(data) {
  const lines = [
    '# LOOPS Power Wake Policy Verification',
    '',
    `- generated_at: ${data.generatedAt}`,
    `- ok: ${data.ok}`,
    `- policy_json: ${data.policyJsonPath}`,
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
  ];
  return lines.join('\n');
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}
