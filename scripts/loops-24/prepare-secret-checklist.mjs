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
const checklistDir = path.join(stateDir, 'secret-checklists');
const secretGates = await readJson(path.join(stateDir, 'secret-gates', 'latest.json'), null);
const now = new Date();
const stamp = toStamp(now);

const gates = Array.isArray(secretGates?.gates) ? secretGates.gates : [];
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  stateDir,
  reportPath: path.join(checklistDir, `${stamp}-secret-checklist.md`),
  jsonPath: path.join(checklistDir, `${stamp}-secret-checklist.json`),
  latestPath: path.join(checklistDir, 'latest.json'),
  sourceSecretGatesPath: secretGates?.reportPath || null,
  sourceStatusFingerprint: secretGates?.statusFingerprint || null,
  sourceExists: Boolean(secretGates),
  statusFingerprint: hash(JSON.stringify({
    sourceStatusFingerprint: secretGates?.statusFingerprint || null,
    gates: gates.map(gate => ({
      id: gate.id,
      status: gate.status,
      variables: gate.variables,
      optional: gate.optional,
    })),
  })),
  summary: summarize(gates),
  gates: gates.map(summarizeGate),
};

await fs.mkdir(checklistDir, { recursive: true });
await fs.writeFile(payload.jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: payload.sourceExists,
  reportPath: payload.reportPath,
  jsonPath: payload.jsonPath,
  statusFingerprint: payload.statusFingerprint,
  summary: payload.summary,
}, null, 2));

function summarize(gates) {
  const missing = gates.filter(gate => gate.status === 'missing').map(gate => gate.id);
  const readyForWrapper = gates.filter(gate => gate.runnerWrapperReady).map(gate => gate.id);
  return {
    total: gates.length,
    readyForWrapperCount: readyForWrapper.length,
    missingCount: missing.length,
    readyForWrapper,
    missing,
  };
}

function summarizeGate(gate) {
  return {
    id: gate.id,
    title: gate.title,
    status: gate.status,
    runnerWrapperReady: Boolean(gate.runnerWrapperReady),
    currentProcessReady: Boolean(gate.currentProcessReady),
    acceptedEnvNames: gate.alternatives || [],
    optionalEnvNames: (gate.optional || []).map(item => item.name || item),
    usedBy: gate.usedBy || [],
    nextAfterReady: gate.nextAfterReady,
    variables: (gate.variables || []).map(variable => ({
      name: variable.name,
      currentProcessPresent: Boolean(variable.currentProcessPresent),
      localFileAssignmentPresent: Boolean(variable.localFileAssignmentPresent),
      localFileNonEmptyAssignment: Boolean(variable.localFileNonEmptyAssignment),
      localFileLooksPlaceholder: Boolean(variable.localFileLooksPlaceholder),
    })),
  };
}

function renderMarkdown(data) {
  const lines = [
    '# LOOPS Local Secret Checklist',
    '',
    `- generated_at: ${data.generatedAt}`,
    `- repo: ${data.repoRoot}`,
    `- source_secret_gates: ${data.sourceSecretGatesPath || '(missing)'}`,
    `- source_status_fingerprint: ${data.sourceStatusFingerprint || '(missing)'}`,
    '',
    '## One-Page Status',
    '',
    `- ready_for_runner_wrapper: ${data.summary.readyForWrapperCount}/${data.summary.total}`,
    `- missing: ${data.summary.missing.length ? data.summary.missing.join(', ') : '(none)'}`,
    '',
    '| Gate | Status | Accepted env names | Current process | Local file |',
    '|---|---|---|---|---|',
  ];

  if (!data.sourceExists) {
    lines.push('| secret-gates source | missing | run prepare-secret-gates first | no | no |');
  }

  for (const gate of data.gates) {
    const currentReady = gate.variables.some(item => item.currentProcessPresent);
    const localReady = gate.variables.some(item => item.localFileNonEmptyAssignment);
    lines.push(`| ${gate.title} | ${gate.status} | ${gate.acceptedEnvNames.join(' or ')} | ${currentReady ? 'ready' : 'missing'} | ${localReady ? 'ready' : 'missing'} |`);
  }

  lines.push('');
  lines.push('## Safe Local Setup');
  lines.push('');
  lines.push('```powershell');
  lines.push('notepad "$env:USERPROFILE\\.codex\\automations\\loops-24\\secrets.local.ps1"');
  lines.push('```');
  lines.push('');
  lines.push('Fill only one accepted variable per gate unless the checklist says multiple values are required. Leave real values on this machine only.');
  lines.push('');
  lines.push('```powershell');
  lines.push("powershell -ExecutionPolicy Bypass -File .\\scripts\\loops-24\\prepare-secret-gates.ps1");
  lines.push("powershell -ExecutionPolicy Bypass -File .\\scripts\\loops-24\\prepare-secret-checklist.ps1");
  lines.push("powershell -ExecutionPolicy Bypass -File .\\scripts\\loops-24\\run.ps1 -ReportOnly -OnlySafeLocal");
  lines.push('```');
  lines.push('');
  lines.push('## Red Lines');
  lines.push('');
  lines.push('- Do not commit `secrets.local.ps1`.');
  lines.push('- Do not paste real values into reports, chats, screenshots, PRs, or docs.');
  lines.push('- A ready secret gate only permits verification; deploys and outbound sends still need owner approval.');
  return lines.join('\n');
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}
