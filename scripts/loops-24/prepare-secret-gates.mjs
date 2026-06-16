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
const handoffDir = path.join(stateDir, 'secret-gates');
const secretsLocalPath = path.join(stateDir, 'secrets.local.ps1');
const secretsExamplePath = path.join(stateDir, 'secrets.example.ps1');
const runnerWrapperPath = path.join(repoRoot, 'scripts', 'loops-24', 'run.ps1');

const gates = [
  {
    id: 'google_places',
    title: 'Google Places prospecting',
    alternatives: ['GOOGLE_MAPS_API_KEY', 'GOOGLE_PLACES_API_KEY'],
    usedBy: ['scripts/google-business-prospector.mjs', 'scripts/loops-24/run.mjs'],
    nextAfterReady: 'Run the LOOPS wrapper so prospecting can discover live candidates without committing the key.',
  },
  {
    id: 'social_publisher_queue',
    title: 'Social publisher /queue/list probe',
    alternatives: ['SOCIAL_PUBLISHER_TOKEN', 'TRIGGER_TOKEN'],
    optional: ['SOCIAL_PUBLISHER_URL'],
    usedBy: ['workers/social-publisher/worker.js', 'scripts/loops-24/run.mjs'],
    nextAfterReady: 'Run the LOOPS wrapper so /health and /queue/list can be verified without logging the token.',
  },
];

const now = new Date();
const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const localSecretText = await readText(secretsLocalPath);
const exampleExists = fssync.existsSync(secretsExamplePath);
const localExists = localSecretText !== null;
const runnerWrapperExists = fssync.existsSync(runnerWrapperPath);

const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  stateDir,
  reportPath: null,
  jsonPath: null,
  latestPath: path.join(handoffDir, 'latest.json'),
  secretsLocalPath,
  secretsExamplePath,
  runnerWrapperPath,
  exampleExists,
  localExists,
  runnerWrapperExists,
  note: 'This report never executes or stores secret values; it records only redacted readiness booleans.',
  gates: gates.map(gate => inspectGate(gate, localSecretText)),
};

payload.summary = summarize(payload);
payload.statusFingerprint = hash(JSON.stringify({
  exampleExists,
  localExists,
  runnerWrapperExists,
  gates: payload.gates.map(gate => ({
    id: gate.id,
    currentProcessReady: gate.currentProcessReady,
    runnerWrapperReady: gate.runnerWrapperReady,
    variables: gate.variables,
  })),
}));

const latest = await readJson(payload.latestPath, null);
if (latest?.statusFingerprint === payload.statusFingerprint && latest?.reportPath && fssync.existsSync(latest.reportPath)) {
  console.log(JSON.stringify({
    ok: true,
    reused: true,
    reportPath: latest.reportPath,
    jsonPath: latest.jsonPath,
    statusFingerprint: latest.statusFingerprint,
    summary: latest.summary,
  }, null, 2));
  process.exit(0);
}

payload.reportPath = path.join(handoffDir, `${stamp}-secret-gates.md`);
payload.jsonPath = path.join(handoffDir, `${stamp}-secret-gates.json`);

await fs.mkdir(handoffDir, { recursive: true });
await fs.writeFile(payload.jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  reused: false,
  reportPath: payload.reportPath,
  jsonPath: payload.jsonPath,
  statusFingerprint: payload.statusFingerprint,
  summary: payload.summary,
}, null, 2));

function inspectGate(gate, text) {
  const variables = gate.alternatives.map(name => inspectVariable(name, text));
  const optional = (gate.optional || []).map(name => inspectVariable(name, text));
  const currentProcessReady = variables.some(item => item.currentProcessPresent);
  const runnerWrapperReady = variables.some(item => item.currentProcessPresent || item.localFileNonEmptyAssignment);

  return {
    ...gate,
    currentProcessReady,
    runnerWrapperReady,
    status: currentProcessReady
      ? 'ready-current-process'
      : (runnerWrapperReady ? 'ready-runner-wrapper' : 'missing'),
    variables,
    optional,
  };
}

function inspectVariable(name, text) {
  const currentProcessPresent = hasValue(process.env[name]);
  const assignment = text ? findPowerShellEnvAssignment(text, name) : null;

  return {
    name,
    currentProcessPresent,
    localFileAssignmentPresent: Boolean(assignment),
    localFileNonEmptyAssignment: Boolean(assignment?.nonEmpty),
    localFileLooksPlaceholder: Boolean(assignment?.placeholder),
  };
}

function findPowerShellEnvAssignment(text, name) {
  const re = new RegExp(`^\\s*\\$env:${escapeRegExp(name)}\\s*=\\s*(.+?)\\s*$`, 'i');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = line.match(re);
    if (!match) continue;
    const raw = match[1].replace(/\s+#.*$/, '').trim();
    const value = unquote(raw);
    return {
      nonEmpty: hasValue(value),
      placeholder: isPlaceholder(value),
    };
  }
  return null;
}

function summarize(data) {
  const readyForWrapper = data.gates.filter(gate => gate.runnerWrapperReady).length;
  const readyForCurrent = data.gates.filter(gate => gate.currentProcessReady).length;
  const missing = data.gates.filter(gate => !gate.runnerWrapperReady).map(gate => gate.id);
  return {
    totalGates: data.gates.length,
    readyForWrapper,
    readyForCurrent,
    missing,
    localFileExists: data.localExists,
    exampleExists: data.exampleExists,
  };
}

function renderMarkdown(data) {
  const lines = [
    '# LOOPS Secret Gates Handoff',
    '',
    `- generated_at: ${data.generatedAt}`,
    `- repo: ${data.repoRoot}`,
    `- state_dir: ${data.stateDir}`,
    `- secrets_local_exists: ${data.localExists}`,
    `- secrets_example_exists: ${data.exampleExists}`,
    `- runner_wrapper_exists: ${data.runnerWrapperExists}`,
    `- status_fingerprint: ${data.statusFingerprint}`,
    '',
    '## Summary',
    '',
    `- gates_ready_for_runner_wrapper: ${data.summary.readyForWrapper}/${data.summary.totalGates}`,
    `- gates_ready_for_current_process: ${data.summary.readyForCurrent}/${data.summary.totalGates}`,
    `- missing: ${data.summary.missing.length ? data.summary.missing.join(', ') : '(none)'}`,
    '',
    'This handoff does not execute `secrets.local.ps1` and does not print, copy, or store secret values.',
    '',
    '## Gate Status',
    '',
  ];

  for (const gate of data.gates) {
    lines.push(`### ${gate.title}`);
    lines.push('');
    lines.push(`- id: ${gate.id}`);
    lines.push(`- status: ${gate.status}`);
    lines.push(`- accepted_env_names: ${gate.alternatives.join(' or ')}`);
    lines.push(`- used_by: ${gate.usedBy.join(', ')}`);
    lines.push(`- next_after_ready: ${gate.nextAfterReady}`);
    lines.push('- variables:');
    for (const variable of gate.variables) {
      lines.push(`  - ${variable.name}: current_process=${variable.currentProcessPresent}, local_assignment=${variable.localFileAssignmentPresent}, local_non_empty=${variable.localFileNonEmptyAssignment}, placeholder=${variable.localFileLooksPlaceholder}`);
    }
    if (gate.optional?.length) {
      lines.push('- optional variables:');
      for (const variable of gate.optional) {
        lines.push(`  - ${variable.name}: current_process=${variable.currentProcessPresent}, local_assignment=${variable.localFileAssignmentPresent}, local_non_empty=${variable.localFileNonEmptyAssignment}, placeholder=${variable.localFileLooksPlaceholder}`);
      }
    }
    lines.push('');
  }

  lines.push('## Safe Setup Path');
  lines.push('');
  lines.push('1. Copy the example if `secrets.local.ps1` does not exist:');
  lines.push('');
  lines.push('```powershell');
  lines.push('Copy-Item "$env:USERPROFILE\\.codex\\automations\\loops-24\\secrets.example.ps1" `');
  lines.push('  "$env:USERPROFILE\\.codex\\automations\\loops-24\\secrets.local.ps1"');
  lines.push('```');
  lines.push('');
  lines.push('2. Edit the local file on this machine only. Use one variable from each gate:');
  lines.push('');
  lines.push('```powershell');
  lines.push("$env:GOOGLE_MAPS_API_KEY = '<paste locally; do not commit>'");
  lines.push("$env:SOCIAL_PUBLISHER_TOKEN = '<same value as live TRIGGER_TOKEN, paste locally>'");
  lines.push("# $env:SOCIAL_PUBLISHER_URL = 'https://3q-social-publisher.milk790.workers.dev'");
  lines.push('```');
  lines.push('');
  lines.push('3. Verify through the wrapper so local secrets are loaded without printing values:');
  lines.push('');
  lines.push('```powershell');
  lines.push('powershell -ExecutionPolicy Bypass -File .\\scripts\\loops-24\\prepare-secret-gates.ps1');
  lines.push('powershell -ExecutionPolicy Bypass -File .\\scripts\\loops-24\\run.ps1 -ReportOnly');
  lines.push('```');
  lines.push('');
  lines.push('## Red Lines');
  lines.push('');
  lines.push('- Do not commit `secrets.local.ps1` or paste real values into reports.');
  lines.push('- Do not deploy Workers just because the local secret gate is ready.');
  lines.push('- Do not send outreach or publish queued posts without manual approval.');

  return lines.join('\n');
}

async function readText(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function unquote(value) {
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1);
  }
  return value;
}

function isPlaceholder(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return !normalized
    || normalized.includes('<paste')
    || normalized.includes('your_')
    || normalized.includes('changeme')
    || normalized.includes('todo');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}
