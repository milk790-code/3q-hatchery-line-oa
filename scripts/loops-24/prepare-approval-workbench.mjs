#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import fssync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const automationId = process.env.LOOPS_AUTOMATION_ID || 'loops-24';
const repoRoot = path.resolve(process.env.LOOPS_REPO_ROOT || process.cwd());
const codexHome = process.env.CODEX_HOME
  || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.codex') : path.join(os.homedir(), '.codex'));
const stateDir = path.resolve(process.env.LOOPS_STATE_DIR || path.join(codexHome, 'automations', automationId));
const workbenchDir = path.join(stateDir, 'approval-workbench');
const args = parseArgs(process.argv.slice(2));
const bundleJsonPath = path.resolve(args.bundleJson || path.join(stateDir, 'owner-approval-bundles', 'latest.json'));
const approvalTtlMinutes = parsePositiveNumber(process.env.LOOPS_APPROVAL_WORKBENCH_TTL_MINUTES, 65);

const now = new Date();
const expiresAt = new Date(now.getTime() + approvalTtlMinutes * 60_000);
const stamp = toStamp(now);
const bundle = await readJson(bundleJsonPath);
const verification = await refreshVerification(bundleJsonPath);
const commandGates = (bundle.gates || []).filter(gate => Array.isArray(gate.commands) && gate.commands.length);
const readyCommands = commandGates.filter(gate => gate.status === 'ready_for_approval');
const blockedCommands = commandGates.filter(gate => gate.status !== 'ready_for_approval');
const manualGates = (bundle.gates || []).filter(gate => ['manual_approval', 'manual_input', 'ready_for_approval'].includes(gate.status));
const attentionGates = (bundle.gates || []).filter(gate => gate.status === 'attention');

const payload = {
  generatedAt: now.toISOString(),
  approvalTtlMinutes,
  expiresAt: expiresAt.toISOString(),
  repoRoot,
  stateDir,
  bundleJsonPath,
  bundleReportPath: bundle.reportPath || null,
  verificationPath: verification?.reportPath || null,
  reportPath: path.join(workbenchDir, `${stamp}-approval-workbench.md`),
  jsonPath: path.join(workbenchDir, `${stamp}-approval-workbench.json`),
  latestPath: path.join(workbenchDir, 'latest.json'),
  status: verification?.ok === true && attentionGates.length === 0 ? 'ready-for-owner-decision' : 'attention',
  branch: bundle.branch || null,
  head: bundle.head || null,
  ahead: bundle.ahead ?? null,
  behind: bundle.behind ?? null,
  bundleStatus: bundle.summary?.status || null,
  bundleFingerprint: bundle.bundleFingerprint || null,
  verificationOk: verification?.ok === true,
  readyCommands: readyCommands.map(toCommandGate),
  blockedCommands: blockedCommands.map(toCommandGate),
  manualGates: manualGates.map(toGateSummary),
  attentionGates: attentionGates.map(toGateSummary),
  summary: {
    approvalTtlMinutes,
    expiresAt: expiresAt.toISOString(),
    readyCommandCount: readyCommands.reduce((count, gate) => count + gate.commands.length, 0),
    blockedCommandCount: blockedCommands.reduce((count, gate) => count + gate.commands.length, 0),
    manualGateCount: manualGates.length,
    attentionGateCount: attentionGates.length,
    prPublishReady: bundle.summary?.prPublishReady === true,
    workerReady: bundle.summary?.workerReady === true,
    localScopeClean: bundle.summary?.localScopeClean === true,
    localInvestorPacketCount: Number(bundle.summary?.localInvestorPacketCount || 0),
    verificationFailureCount: Number(verification?.summary?.failureCount || 0),
    expired: false,
  },
  hardStops: [
    'Do not run these commands without explicit owner approval.',
    'Do not use this workbench after expires_at; rerun prepare-approval-workbench before approval commands.',
    'Do not combine GitHub publication, Worker deploy, secret input, protected verification, or outbound sending into one automatic batch.',
    'Do not commit, send, share, or publish local investor packet materials from this workbench.',
    'Do not print or store secret values in LOOPS reports.',
  ],
};

payload.projectionFingerprint = hash(JSON.stringify({
  bundleFingerprint: payload.bundleFingerprint,
  verificationOk: payload.verificationOk,
  readyCommands: payload.readyCommands,
  blockedCommands: payload.blockedCommands,
  manualGates: payload.manualGates,
  attentionGates: payload.attentionGates,
}));

payload.statusFingerprint = hash(JSON.stringify({
  projectionFingerprint: payload.projectionFingerprint,
  approvalTtlMinutes: payload.approvalTtlMinutes,
  expiresAt: payload.expiresAt,
}));

const latest = await readJson(payload.latestPath, null);
if (latest?.projectionFingerprint === payload.projectionFingerprint
  && !isExpired(latest.expiresAt)
  && latest?.reportPath
  && fssync.existsSync(latest.reportPath)) {
  console.log(JSON.stringify({
    ok: true,
    reused: true,
    reportPath: latest.reportPath,
    jsonPath: latest.jsonPath,
    summary: latest.summary,
  }, null, 2));
  process.exit(0);
}

await fs.mkdir(workbenchDir, { recursive: true });
await fs.writeFile(payload.jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  reused: false,
  reportPath: payload.reportPath,
  jsonPath: payload.jsonPath,
  summary: payload.summary,
}, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--bundle-json') {
      parsed.bundleJson = argv[index + 1];
      index += 1;
    }
  }
  return parsed;
}

async function refreshVerification(bundlePath) {
  runNodeMaybe(['scripts/loops-24/verify-owner-approval-bundle.mjs', '--bundle-json', bundlePath]);
  return readJson(path.join(stateDir, 'owner-approval-verifications', 'latest.json'), null);
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (arguments.length > 1) return fallback;
    throw new Error(`Unable to read JSON at ${file}: ${error.message}`);
  }
}

function runNodeMaybe(nodeArgs) {
  return spawnSync('node', nodeArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8,
  });
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

function renderMarkdown(payload) {
  const lines = [
    '# LOOPS Approval Workbench',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- approval_ttl_minutes: ${payload.approvalTtlMinutes}`,
    `- expires_at: ${payload.expiresAt}`,
    `- projection_fingerprint: ${payload.projectionFingerprint}`,
    `- repo: ${payload.repoRoot}`,
    `- branch: ${payload.branch || '(unknown)'}`,
    `- head: ${payload.head || '(unknown)'}`,
    `- ahead: ${payload.ahead ?? '(unknown)'}`,
    `- behind: ${payload.behind ?? '(unknown)'}`,
    `- status: ${payload.status}`,
    `- owner_bundle: ${payload.bundleReportPath || '(missing)'}`,
    `- owner_verification: ${payload.verificationPath || '(missing)'}`,
    '',
    '## BLUF',
    '',
    payload.status === 'ready-for-owner-decision'
      ? 'LOOPS has a verified owner bundle and is waiting for explicit owner decisions. This workbench did not run any command.'
      : 'LOOPS still has attention items. This workbench did not run any command.',
    '',
    '## Ready Commands',
    '',
  ];

  if (payload.readyCommands.length) {
    for (const gate of payload.readyCommands) {
      lines.push(`### ${gate.label}`, '');
      lines.push(`- gate: ${gate.id}`);
      lines.push(`- status: ${gate.status}`);
      lines.push(`- owner_action: ${gate.ownerAction}`);
      lines.push(`- evidence: ${gate.evidence}`);
      lines.push('', '```powershell');
      for (const command of gate.commands) lines.push(command);
      lines.push('```', '');
    }
  } else {
    lines.push('- None.', '');
  }

  lines.push('## Manual Gates Without Automatic Commands', '');
  const manualWithoutCommands = payload.manualGates.filter(gate => !payload.readyCommands.some(commandGate => commandGate.id === gate.id));
  if (manualWithoutCommands.length) {
    lines.push('| Gate | Status | Owner action | Evidence |');
    lines.push('|---|---|---|---|');
    for (const gate of manualWithoutCommands) {
      lines.push(`| ${escapeCell(gate.label)} | ${gate.status} | ${escapeCell(gate.ownerAction)} | ${escapeCell(gate.evidence)} |`);
    }
    lines.push('');
  } else {
    lines.push('- None.', '');
  }

  lines.push('## Commands Not Ready', '');
  if (payload.blockedCommands.length) {
    for (const gate of payload.blockedCommands) {
      lines.push(`- ${gate.label}: status=${gate.status}; commands hidden behind current attention state.`);
    }
  } else {
    lines.push('- None.', '');
  }

  lines.push('', '## Hard Stops', '');
  for (const stop of payload.hardStops) lines.push(`- ${stop}`);

  lines.push('', '## Suggested Owner Decision Order', '');
  lines.push('1. Decide whether to push this branch and open the draft PR.');
  lines.push('2. Review local investor packet materials separately before any external use.');
  lines.push('3. Decide whether and when to deploy the committed Worker surfaces.');
  lines.push('4. Add missing secrets only in the local machine environment if live verification is needed.');
  lines.push('5. Run protected verification only after deploy approval and token input.');
  return lines.join('\n');
}

function escapeCell(value) {
  return String(value || '').replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function parsePositiveNumber(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isExpired(expiresAt) {
  const expiresMs = Date.parse(expiresAt || '');
  return Number.isFinite(expiresMs) && now.getTime() > expiresMs;
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}
