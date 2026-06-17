#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { stringifyPortableJson } from './lib/portable-json.mjs';

const automationId = process.env.LOOPS_AUTOMATION_ID || 'loops-24';
const repoRoot = path.resolve(process.env.LOOPS_REPO_ROOT || process.cwd());
const codexHome = process.env.CODEX_HOME
  || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.codex') : path.join(os.homedir(), '.codex'));
const stateDir = path.resolve(process.env.LOOPS_STATE_DIR || path.join(codexHome, 'automations', automationId));
const verificationDir = path.join(stateDir, 'thread-connector-verifications');
const args = parseArgs(process.argv.slice(2));
const now = new Date();
const stamp = toStamp(now);

const connectorId = required(args.connector, '--connector');
const status = args.status || 'ready';
const ttlMinutes = Number(args.ttlMinutes || 1440);
const allowedConnectors = new Set([
  'github_app',
  'gmail_app',
  'google_drive_app',
  'slack_app',
  'chrome_plugin',
  'computer_use_plugin',
]);
const allowedStatuses = new Set(['ready', 'attention', 'failed']);

if (!allowedConnectors.has(connectorId)) {
  throw new Error(`Unsupported connector for thread verification: ${connectorId}`);
}
if (!allowedStatuses.has(status)) {
  throw new Error(`Unsupported verification status: ${status}`);
}
if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0 || ttlMinutes > 10080) {
  throw new Error('--ttl-minutes must be between 1 and 10080');
}

const evidence = sanitize(args.evidence || 'Thread-side read-only connector probe completed.');
const probe = sanitize(args.probe || 'read-only connector probe');
const source = sanitize(args.source || 'codex-thread');
const repoFullName = args.repoFullName ? sanitize(args.repoFullName) : null;
const repoId = args.repoId ? sanitize(args.repoId) : null;
const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);
const latestPath = path.join(verificationDir, 'latest.json');
const previous = await readJson(latestPath, null);
const connectors = {
  ...(previous?.connectors || {}),
};

connectors[connectorId] = {
  id: connectorId,
  status,
  checkedAt: now.toISOString(),
  expiresAt: expiresAt.toISOString(),
  ttlMinutes,
  source,
  probe,
  evidence,
  repoFullName,
  repoId,
  writeActionsPerformed: false,
  hardStops: [
    'This record proves a thread-side read-only connector check only.',
    'It does not approve GitHub writes, PR creation, deploys, sends, account permission changes, or secret entry.',
    'Rerun the thread-side connector probe when this record expires.',
  ],
};

const summary = summarize(connectors, now);
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  stateDir,
  reportPath: path.join(verificationDir, `${stamp}-thread-connector-verification.md`),
  jsonPath: path.join(verificationDir, `${stamp}-thread-connector-verification.json`),
  latestPath,
  connectors,
  summary,
  statusFingerprint: hash(JSON.stringify({
    connectors,
    summary,
  })),
};

await fs.mkdir(verificationDir, { recursive: true });
const payloadJson = stringifyPortableJson(payload);
await fs.writeFile(payload.jsonPath, payloadJson, 'utf8');
await fs.writeFile(payload.latestPath, payloadJson, 'utf8');
await fs.writeFile(payload.reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  reportPath: payload.reportPath,
  jsonPath: payload.jsonPath,
  statusFingerprint: payload.statusFingerprint,
  summary: payload.summary,
}, null, 2));

function summarize(connectorsById, currentTime) {
  const records = Object.values(connectorsById);
  const fresh = records.filter(item => new Date(item.expiresAt) > currentTime);
  const ready = fresh.filter(item => item.status === 'ready');
  const attention = fresh.filter(item => item.status === 'attention' || item.status === 'failed');
  const expired = records.filter(item => new Date(item.expiresAt) <= currentTime);
  return {
    total: records.length,
    freshCount: fresh.length,
    readyCount: ready.length,
    attentionCount: attention.length,
    expiredCount: expired.length,
    readyIds: ready.map(item => item.id),
    attentionIds: attention.map(item => item.id),
    expiredIds: expired.map(item => item.id),
  };
}

function renderMarkdown(payload) {
  const lines = [
    '# LOOPS Thread Connector Verification',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- repo: ${payload.repoRoot}`,
    `- status_fingerprint: ${payload.statusFingerprint}`,
    '',
    '## Summary',
    '',
    `- fresh: ${payload.summary.freshCount}/${payload.summary.total}`,
    `- ready: ${payload.summary.readyIds.length ? payload.summary.readyIds.join(', ') : '(none)'}`,
    `- attention: ${payload.summary.attentionIds.length ? payload.summary.attentionIds.join(', ') : '(none)'}`,
    `- expired: ${payload.summary.expiredIds.length ? payload.summary.expiredIds.join(', ') : '(none)'}`,
    '',
    '## Records',
    '',
    '| Connector | Status | Checked at | Expires at | Probe | Evidence |',
    '|---|---|---|---|---|---|',
  ];
  for (const item of Object.values(payload.connectors).sort((a, b) => a.id.localeCompare(b.id))) {
    lines.push(`| ${item.id} | ${item.status} | ${item.checkedAt} | ${item.expiresAt} | ${escapeCell(item.probe)} | ${escapeCell(item.evidence)} |`);
  }
  lines.push('', '## Safety Contract', '');
  lines.push('- This file is a redacted local artifact created after thread-side read-only checks.');
  lines.push('- It never contains secret values, OAuth tokens, private message bodies, or outbound-send content.');
  lines.push('- It does not approve GitHub writes, deploys, sends, account permission changes, or production mutations.');
  return lines.join('\n');
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) continue;
    parsed[toCamel(key.slice(2))] = argv[index + 1];
    index += 1;
  }
  return parsed;
}

function required(value, label) {
  if (!value) throw new Error(`${label} is required`);
  return value;
}

function sanitize(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (looksSensitive(text)) {
    throw new Error('Refusing to write connector evidence that looks like a secret or token.');
  }
  return text.slice(0, 240);
}

function looksSensitive(value) {
  return /(ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-|AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|password\s*=|token\s*=|secret\s*=)/i.test(value);
}

function escapeCell(value) {
  return String(value || '').replaceAll('|', '\\|');
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (arguments.length > 1 && error.code === 'ENOENT') return fallback;
    if (arguments.length > 1) return fallback;
    throw error;
  }
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
}
