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
const checklistJsonPath = path.resolve(args.checklistJson || path.join(stateDir, 'secret-checklists', 'latest.json'));
const verificationDir = path.join(stateDir, 'secret-checklist-verifications');
const now = new Date();
const stamp = toStamp(now);

const checklist = await readJson(checklistJsonPath);
const secretGates = await readJson(path.join(stateDir, 'secret-gates', 'latest.json'), null);
const findings = await verifyChecklist(checklist, secretGates);
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  automationId,
  stateDir,
  checklistJsonPath,
  sourceSecretGatesPath: checklist.sourceSecretGatesPath || null,
  reportPath: path.join(verificationDir, `${stamp}-secret-checklist-verification.md`),
  jsonPath: path.join(verificationDir, `${stamp}-secret-checklist-verification.json`),
  latestPath: path.join(verificationDir, 'latest.json'),
  ok: findings.failures.length === 0,
  summary: {
    readyForWrapperCount: Number(checklist.summary?.readyForWrapperCount || 0),
    missingCount: Number(checklist.summary?.missingCount || 0),
    failureCount: findings.failures.length,
    warningCount: findings.warnings.length,
  },
  findings,
  statusFingerprint: hash(JSON.stringify({
    checklistStatusFingerprint: checklist.statusFingerprint || null,
    sourceStatusFingerprint: checklist.sourceStatusFingerprint || null,
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

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (arguments.length > 1) return fallback;
    throw new Error(`Unable to read JSON at ${file}: ${error.message}`);
  }
}

async function verifyChecklist(checklist, secretGates) {
  const failures = [];
  const warnings = [];
  const gates = Array.isArray(checklist.gates) ? checklist.gates : [];
  const sourceGates = Array.isArray(secretGates?.gates) ? secretGates.gates : [];
  const readyForWrapper = gates.filter(gate => gate.runnerWrapperReady).map(gate => gate.id);
  const missing = gates.filter(gate => gate.status === 'missing').map(gate => gate.id);

  requireEqual(failures, 'repoRoot', checklist.repoRoot, repoRoot);
  requireEqual(failures, 'stateDir', checklist.stateDir, stateDir);
  requireEqual(failures, 'sourceExists', checklist.sourceExists, Boolean(secretGates));
  requireEqual(failures, 'sourceStatusFingerprint', checklist.sourceStatusFingerprint || null, secretGates?.statusFingerprint || null);
  requireEqual(failures, 'summary.total', Number(checklist.summary?.total), gates.length);
  requireEqual(failures, 'summary.readyForWrapperCount', Number(checklist.summary?.readyForWrapperCount), readyForWrapper.length);
  requireEqual(failures, 'summary.missingCount', Number(checklist.summary?.missingCount), missing.length);
  requireEqual(failures, 'summary.readyForWrapper', checklist.summary?.readyForWrapper || [], readyForWrapper);
  requireEqual(failures, 'summary.missing', checklist.summary?.missing || [], missing);

  if (!checklist.reportPath || !fssync.existsSync(checklist.reportPath)) {
    failures.push('secret checklist reportPath must exist');
  }
  if (!checklist.sourceSecretGatesPath || !fssync.existsSync(checklist.sourceSecretGatesPath)) {
    failures.push('sourceSecretGatesPath must exist');
  }
  if (sourceGates.length && gates.length !== sourceGates.length) {
    failures.push(`checklist gate count ${gates.length} does not match source gate count ${sourceGates.length}`);
  }
  for (const gate of gates) {
    const source = sourceGates.find(item => item.id === gate.id);
    if (!source) {
      failures.push(`missing source gate for checklist gate ${gate.id}`);
      continue;
    }
    requireEqual(failures, `${gate.id}.status`, gate.status, source.status);
    requireEqual(failures, `${gate.id}.runnerWrapperReady`, gate.runnerWrapperReady, Boolean(source.runnerWrapperReady));
    requireEqual(failures, `${gate.id}.currentProcessReady`, gate.currentProcessReady, Boolean(source.currentProcessReady));
    requireEqual(failures, `${gate.id}.acceptedEnvNames`, gate.acceptedEnvNames || [], source.alternatives || []);
  }

  const gatesReportText = await readText(secretGates?.reportPath, '');
  const checklistReportText = await readText(checklist.reportPath, '');
  const leakedAssignments = [
    ...findNonPlaceholderAssignments(gatesReportText, 'secret-gates report'),
    ...findNonPlaceholderAssignments(checklistReportText, 'secret-checklist report'),
  ];
  if (leakedAssignments.length) {
    failures.push(`report contains non-placeholder env assignment text: ${leakedAssignments.join('; ')}`);
  }

  const secretsLocalPath = path.resolve(secretGates?.secretsLocalPath || path.join(stateDir, 'secrets.local.ps1'));
  const secretsExamplePath = path.resolve(secretGates?.secretsExamplePath || path.join(stateDir, 'secrets.example.ps1'));
  const runnerWrapperPath = path.resolve(secretGates?.runnerWrapperPath || path.join(repoRoot, 'scripts', 'loops-24', 'run.ps1'));
  if (isSubPath(repoRoot, secretsLocalPath) || isSubPath(repoRoot, secretsExamplePath)) {
    failures.push('secret files must stay outside the repository root');
  }
  if (!isSubPath(stateDir, secretsLocalPath) || !isSubPath(stateDir, secretsExamplePath)) {
    failures.push('secret files must live under the local automation state directory');
  }
  if (!fssync.existsSync(runnerWrapperPath)) {
    failures.push('runner wrapper path must exist');
  } else {
    const wrapperText = await readText(runnerWrapperPath, '');
    if (!wrapperText.includes('secrets.local.ps1') || !wrapperText.includes('. $secretsPath')) {
      failures.push('runner wrapper must dot-source secrets.local.ps1 when it exists');
    }
  }
  if (secretGates?.localExists !== true) {
    warnings.push('secrets.local.ps1 does not exist; owner still needs to create it locally before secret gates can pass');
  }
  if (readyForWrapper.length === 0) {
    warnings.push('no secret gate is ready for the runner wrapper yet');
  }

  const expectedFingerprint = hash(JSON.stringify({
    sourceStatusFingerprint: secretGates?.statusFingerprint || null,
    gates: sourceGates.map(gate => ({
      id: gate.id,
      status: gate.status,
      variables: gate.variables,
      optional: gate.optional,
    })),
  }));
  requireEqual(failures, 'statusFingerprint', checklist.statusFingerprint, expectedFingerprint);

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

function findNonPlaceholderAssignments(text, label) {
  const findings = [];
  const re = /^\s*\$env:([A-Z0-9_]+)\s*=\s*(['"])(.*?)\2\s*$/i;
  for (const [index, line] of String(text || '').split(/\r?\n/).entries()) {
    const match = line.match(re);
    if (!match) continue;
    const value = match[3] || '';
    if (isAllowedPlaceholder(value)) continue;
    findings.push(`${label}:${index + 1}:$env:${match[1]}`);
  }
  return findings;
}

function isAllowedPlaceholder(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === ''
    || normalized.includes('<paste')
    || normalized.includes('do not commit')
    || normalized.includes('same value as live')
    || normalized.includes('workers.dev')
    || normalized.includes('your_')
    || normalized.includes('changeme')
    || normalized.includes('todo');
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
    '# LOOPS Secret Checklist Verification',
    '',
    `- generated_at: ${data.generatedAt}`,
    `- ok: ${data.ok}`,
    `- checklist_json: ${data.checklistJsonPath}`,
    `- source_secret_gates: ${data.sourceSecretGatesPath || '(missing)'}`,
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
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
}
