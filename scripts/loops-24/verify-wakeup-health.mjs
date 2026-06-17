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
const wakeupJsonPath = path.resolve(args.wakeupJson || path.join(stateDir, 'wakeup-health', 'latest.json'));
const verificationDir = path.join(stateDir, 'wakeup-health-verifications');
const now = new Date();
const stamp = toStamp(now);

const wakeup = await readJson(wakeupJsonPath);
const findings = await verifyWakeupHealth(wakeup);
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  automationId,
  stateDir,
  wakeupJsonPath,
  wakeupReportPath: wakeup.reportPath || null,
  reportPath: path.join(verificationDir, `${stamp}-wakeup-health-verification.md`),
  jsonPath: path.join(verificationDir, `${stamp}-wakeup-health-verification.json`),
  latestPath: path.join(verificationDir, 'latest.json'),
  ok: findings.failures.length === 0,
  summary: {
    wakeupStatus: wakeup.status || null,
    wakeupOk: wakeup.health?.ok === true,
    sourceWarningCount: Array.isArray(wakeup.health?.warnings) ? wakeup.health.warnings.length : null,
    latestSuccessFresh: wakeup.health?.checks?.latestSuccessFresh ?? null,
    scheduledTaskSafeLocalRunner: wakeup.health?.checks?.scheduledTaskSafeLocalRunner ?? null,
    scheduledTaskHourlyTrigger: wakeup.health?.checks?.scheduledTaskHourlyTrigger ?? null,
    wakeToRunEnabled: wakeup.summary?.wakeToRunEnabled ?? null,
    powerWakeNeedsApproval: wakeup.summary?.powerWakeNeedsApproval === true,
    failureCount: findings.failures.length,
    warningCount: findings.warnings.length,
  },
  findings,
  statusFingerprint: hash(JSON.stringify({
    wakeupFingerprint: wakeup.statusFingerprint || null,
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
    if (argv[index] === '--wakeup-json') {
      parsed.wakeupJson = argv[index + 1];
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

async function verifyWakeupHealth(wakeup) {
  const failures = [];
  const warnings = [];
  const checks = wakeup.health?.checks || {};
  const diagnostics = wakeup.health?.diagnostics || {};
  const summary = wakeup.summary || {};
  const task = wakeup.scheduledTask || {};
  const latestSuccess = wakeup.state?.latestSuccess || null;
  const latestRun = wakeup.state?.latestRun || null;
  const wakeToRunEnabled = task?.platform === 'win32'
    ? task?.wakeToRun === true
    : null;
  const expectedStatus = wakeup.health?.ok === true ? 'ready' : 'attention';
  const expectedFreshUntil = addMinutes(wakeup.generatedAt, Number(wakeup.reportFreshMinutes));

  requireEqual(failures, 'repoRoot', wakeup.repoRoot, repoRoot);
  requireEqual(failures, 'automationId', wakeup.automationId, automationId);
  requireEqual(failures, 'stateDir', wakeup.stateDir, stateDir);
  requireEqual(failures, 'status', wakeup.status, expectedStatus);
  requireEqual(failures, 'summary.status', summary.status, expectedStatus);
  requireEqual(failures, 'summary.ok', summary.ok, wakeup.health?.ok === true);
  requireEqual(failures, 'summary.warningCount', summary.warningCount, Array.isArray(wakeup.health?.warnings) ? wakeup.health.warnings.length : 0);
  requireEqual(failures, 'summary.latestSuccessFresh', summary.latestSuccessFresh, checks.latestSuccessFresh);
  requireEqual(failures, 'summary.latestSuccessAt', summary.latestSuccessAt, latestSuccess?.finishedAt || latestSuccess?.startedAt || null);
  requireEqual(failures, 'summary.latestSuccessAgeMinutes', summary.latestSuccessAgeMinutes, diagnostics.latestSuccessAgeMinutes ?? null);
  requireEqual(failures, 'summary.latestRunAt', summary.latestRunAt, latestRun?.finishedAt || latestRun?.startedAt || null);
  requireEqual(failures, 'summary.latestRunAgeMinutes', summary.latestRunAgeMinutes, diagnostics.latestRunAgeMinutes ?? null);
  requireEqual(failures, 'summary.lockPresent', summary.lockPresent, wakeup.lock?.exists === true);
  requireEqual(failures, 'summary.lockAgeMinutes', summary.lockAgeMinutes, diagnostics.lockAgeMinutes ?? null);
  requireEqual(failures, 'summary.scheduledTaskFound', summary.scheduledTaskFound, task?.found ?? null);
  requireEqual(failures, 'summary.scheduledTaskState', summary.scheduledTaskState, task?.state || null);
  requireEqual(failures, 'summary.scheduledTaskNextRunTime', summary.scheduledTaskNextRunTime, task?.nextRunTime || null);
  requireEqual(failures, 'summary.scheduledTaskNextRunInMinutes', summary.scheduledTaskNextRunInMinutes, diagnostics.scheduledTaskNextRunInMinutes ?? null);
  requireEqual(failures, 'summary.scheduledTaskHourlyTrigger', summary.scheduledTaskHourlyTrigger, checks.scheduledTaskHourlyTrigger);
  requireEqual(failures, 'summary.scheduledTaskSafeLocalRunner', summary.scheduledTaskSafeLocalRunner, checks.scheduledTaskSafeLocalRunner);
  requireEqual(failures, 'summary.scheduledTaskOverlapGuard', summary.scheduledTaskOverlapGuard, checks.scheduledTaskOverlapGuard);
  requireEqual(failures, 'summary.scheduledTaskExecutionLimitMinutes', summary.scheduledTaskExecutionLimitMinutes, diagnostics.scheduledTaskExecutionLimitMinutes ?? null);
  requireEqual(failures, 'summary.scheduledTaskCatchUpEnabled', summary.scheduledTaskCatchUpEnabled, checks.scheduledTaskCatchUpEnabled);
  requireEqual(failures, 'summary.wakeToRunEnabled', summary.wakeToRunEnabled, wakeToRunEnabled);
  requireEqual(failures, 'summary.powerWakeNeedsApproval', summary.powerWakeNeedsApproval, wakeToRunEnabled === false);
  requireEqual(failures, 'summary.reportFreshMinutes', summary.reportFreshMinutes, wakeup.reportFreshMinutes);
  requireEqual(failures, 'summary.freshUntil', summary.freshUntil, wakeup.freshUntil);
  requireEqual(failures, 'freshUntil', wakeup.freshUntil, expectedFreshUntil);

  if (!wakeup.reportPath || !fssync.existsSync(wakeup.reportPath)) {
    failures.push('reportPath must point to an existing local wakeup-health report');
  }
  if (!wakeup.jsonPath || !fssync.existsSync(wakeup.jsonPath)) {
    failures.push('jsonPath must point to an existing local wakeup-health JSON file');
  }
  if (!wakeup.latestPath || !fssync.existsSync(wakeup.latestPath)) {
    failures.push('latestPath must point to an existing local wakeup-health latest.json file');
  }
  if (collectCommandArrays(wakeup).length) {
    failures.push('wakeup health must not expose executable command arrays');
  }

  const reportText = await readText(wakeup.reportPath, '');
  const forbidden = scanText(`${JSON.stringify(wakeup)}\n${reportText}`);
  if (forbidden.length) {
    failures.push(`forbidden mutation text found: ${forbidden.join(', ')}`);
  }

  const expectedFingerprint = hash32(JSON.stringify({
    task,
    latestRunId: latestRun?.runId || null,
    latestSuccessRunId: latestSuccess?.runId || null,
    lock: wakeup.lock,
    health: wakeup.health,
    summary,
  }));
  requireEqual(failures, 'statusFingerprint', wakeup.statusFingerprint, expectedFingerprint);

  if (wakeup.health?.ok !== true) {
    warnings.push('source wakeup-health is not ok; inspect failing checks before relying on hourly automation');
  }

  return { failures, warnings };
}

async function readText(file, fallback) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (arguments.length > 1) return fallback;
    throw error;
  }
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

function requireEqual(failures, field, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${field} expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

function addMinutes(value, minutes) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp) || !Number.isFinite(minutes)) return null;
  return new Date(timestamp + minutes * 60_000).toISOString();
}

function renderMarkdown(data) {
  const lines = [
    '# LOOPS Wakeup Health Verification',
    '',
    `- generated_at: ${data.generatedAt}`,
    `- ok: ${data.ok}`,
    `- wakeup_json: ${data.wakeupJsonPath}`,
    `- wakeup_report: ${data.wakeupReportPath || '(missing)'}`,
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
    '- This verifier reads local wakeup-health artifacts only.',
    '- It does not modify Task Scheduler, power settings, secrets, GitHub, deployments, or outbound messages.',
  ];
  return lines.join('\n');
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function hash32(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
}
