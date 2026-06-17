#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { findFirstRawNonAscii, stringifyPortableJson } from './lib/portable-json.mjs';

const automationId = process.env.LOOPS_AUTOMATION_ID || 'loops-24';
const repoRoot = path.resolve(process.env.LOOPS_REPO_ROOT || process.cwd());
const codexHome = process.env.CODEX_HOME
  || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.codex') : path.join(os.homedir(), '.codex'));
const stateDir = path.resolve(process.env.LOOPS_STATE_DIR || path.join(codexHome, 'automations', automationId));
const outDir = path.join(stateDir, 'json-portability');
const now = new Date();
const stamp = toStamp(now);

const latestJsonFiles = await listLatestJsonFiles(stateDir);
const records = [];
for (const file of latestJsonFiles) {
  records.push(await inspectJsonFile(file));
}

const parseFailures = records.filter(item => !item.parseOk);
const rawNonAscii = records.filter(item => item.rawNonAscii);
const ok = parseFailures.length === 0 && rawNonAscii.length === 0;
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  automationId,
  stateDir,
  reportPath: path.join(outDir, `${stamp}-json-portability.md`),
  jsonPath: path.join(outDir, `${stamp}-json-portability.json`),
  latestPath: path.join(outDir, 'latest.json'),
  ok,
  summary: {
    totalLatestJson: records.length,
    parseFailureCount: parseFailures.length,
    rawNonAsciiCount: rawNonAscii.length,
    portableCount: records.filter(item => item.parseOk && !item.rawNonAscii).length,
    failureCount: parseFailures.length + rawNonAscii.length,
  },
  failures: [
    ...parseFailures.map(item => ({
      path: item.relativePath,
      type: 'parse-failure',
      message: item.parseError,
    })),
    ...rawNonAscii.map(item => ({
      path: item.relativePath,
      type: 'raw-non-ascii',
      firstRawNonAscii: item.firstRawNonAscii,
    })),
  ],
  records,
};
payload.statusFingerprint = hash(JSON.stringify({
  ok: payload.ok,
  failures: payload.failures,
  totalLatestJson: payload.summary.totalLatestJson,
}));

await fs.mkdir(outDir, { recursive: true });
const payloadJson = stringifyPortableJson(payload);
await fs.writeFile(payload.jsonPath, payloadJson, 'utf8');
await fs.writeFile(payload.latestPath, payloadJson, 'utf8');
await fs.writeFile(payload.reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: payload.ok,
  reportPath: payload.reportPath,
  jsonPath: payload.jsonPath,
  summary: payload.summary,
}, null, 2));

if (!payload.ok) process.exitCode = 1;

async function listLatestJsonFiles(root) {
  const files = [];
  await walk(root, files);
  return files.sort((a, b) => relativeToState(a).localeCompare(relativeToState(b)));
}

async function walk(dir, files) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, files);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase() === 'latest.json') {
      files.push(full);
    }
  }
}

async function inspectJsonFile(file) {
  const relativePath = relativeToState(file);
  let source = '';
  let readError = null;
  try {
    source = await fs.readFile(file, 'utf8');
  } catch (error) {
    readError = error.message;
  }

  let parseOk = false;
  let parseError = readError;
  if (!readError) {
    try {
      JSON.parse(source);
      parseOk = true;
      parseError = null;
    } catch (error) {
      parseError = error.message;
    }
  }

  const firstRawNonAscii = readError ? null : findFirstRawNonAscii(source);
  return {
    path: file,
    relativePath,
    bytes: Buffer.byteLength(source, 'utf8'),
    parseOk,
    parseError,
    rawNonAscii: Boolean(firstRawNonAscii),
    firstRawNonAscii,
  };
}

function renderMarkdown(data) {
  const lines = [
    '# LOOPS JSON Portability Audit',
    '',
    `- generated_at: ${data.generatedAt}`,
    `- ok: ${data.ok}`,
    `- latest_json: ${data.summary.totalLatestJson}`,
    `- parse_failures: ${data.summary.parseFailureCount}`,
    `- raw_non_ascii: ${data.summary.rawNonAsciiCount}`,
    `- portable: ${data.summary.portableCount}`,
    '',
    '## Failures',
    '',
    ...(data.failures.length
      ? data.failures.map(item => {
          if (item.type === 'raw-non-ascii') {
            const raw = item.firstRawNonAscii || {};
            return `- ${item.path}: raw non-ASCII ${raw.codePoint || '(unknown)'} at line ${raw.line || '?'}, column ${raw.column || '?'}`;
          }
          return `- ${item.path}: ${item.message || item.type}`;
        })
      : ['- none']),
    '',
    '## Safety Contract',
    '',
    '- This audit only reads local latest.json artifacts and writes a local report.',
    '- It does not push, create PRs, deploy, write secrets, change scheduled tasks, or send messages.',
  ];
  return lines.join('\n');
}

function relativeToState(file) {
  return path.relative(stateDir, file).replaceAll('\\', '/');
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}
