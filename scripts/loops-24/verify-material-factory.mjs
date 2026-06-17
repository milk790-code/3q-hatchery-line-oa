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
const factoryJsonPath = path.resolve(args.factoryJson || path.join(stateDir, 'material-factory', 'latest.json'));
const verificationDir = path.join(stateDir, 'material-factory-verifications');
const now = new Date();
const stamp = toStamp(now);

const factory = await readJson(factoryJsonPath);
const findings = await verifyFactory(factory);
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  stateDir,
  factoryJsonPath,
  reportPath: path.join(verificationDir, `${stamp}-material-factory-verification.md`),
  jsonPath: path.join(verificationDir, `${stamp}-material-factory-verification.json`),
  latestPath: path.join(verificationDir, 'latest.json'),
  ok: findings.failures.length === 0,
  summary: {
    status: factory.status || null,
    packReady: factory.summary?.packReady === true,
    missingToolCount: Number(factory.summary?.missingToolCount || 0),
    failureCount: findings.failures.length,
    warningCount: findings.warnings.length,
  },
  findings,
  statusFingerprint: hash(JSON.stringify({
    factoryFingerprint: factory.statusFingerprint || null,
    packFingerprint: factory.materialPack?.packFingerprint || null,
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

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--factory-json') {
      parsed.factoryJson = argv[index + 1];
      index += 1;
    }
  }
  return parsed;
}

async function verifyFactory(factory) {
  const failures = [];
  const warnings = [];
  requireEqual(failures, 'repoRoot', factory.repoRoot, repoRoot);
  requireEqual(failures, 'stateDir', factory.stateDir, stateDir);
  if (!Array.isArray(factory.hardStops) || factory.hardStops.length < 3) failures.push('hardStops must be present');
  for (const phrase of ['copyrighted or private media', 'automatically', 'owner review', 'secrets']) {
    if (!factory.hardStops.some(stop => String(stop).includes(phrase))) failures.push(`hardStops missing phrase: ${phrase}`);
  }
  if (factory.status === 'waiting-for-idea') {
    if (factory.summary?.packReady !== false) failures.push('waiting-for-idea must not mark packReady=true');
    return { failures, warnings };
  }
  if (factory.status !== 'material-pack-ready') failures.push(`unexpected status: ${factory.status}`);
  const pack = factory.materialPack;
  if (!pack?.packDir || !fssync.existsSync(pack.packDir)) failures.push('materialPack.packDir missing or not found');
  const files = pack?.files || {};
  for (const [key, filePath] of Object.entries(files)) {
    if (!fssync.existsSync(filePath)) failures.push(`missing material file ${key}: ${filePath}`);
  }
  if (files.storyboard) {
    const storyboard = await readJson(files.storyboard, null);
    if (!Array.isArray(storyboard?.scenes) || storyboard.scenes.length < 3) failures.push('storyboard must contain at least 3 scenes');
  }
  if (files.jianyingPlan) {
    const plan = await readJson(files.jianyingPlan, null);
    if (!Array.isArray(plan?.timeline) || plan.timeline.length < 3) failures.push('jianying plan timeline must contain at least 3 items');
  }
  const ownerCommands = files.ownerCommands ? await readText(files.ownerCommands, '') : '';
  if (/(git\s+push|gh\s+pr\s+create|wrangler\s+deploy|railway\s+up|send-mailmessage|broadcast|Remove-Item\s+-Recurse)/i.test(ownerCommands)) {
    failures.push('owner commands include a hard-stop command');
  }
  if (/yt-dlp\s+-a/i.test(ownerCommands) && !/^#.*yt-dlp\s+-a/im.test(ownerCommands)) {
    warnings.push('yt-dlp command is not commented; verify owner-run intent.');
  }
  return { failures, warnings };
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (arguments.length > 1) return fallback;
    throw new Error(`Unable to read JSON at ${file}: ${error.message}`);
  }
}

async function readText(file, fallback) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return fallback;
  }
}

function requireEqual(failures, label, actual, expected) {
  if (actual !== expected) failures.push(`${label} expected ${expected} got ${actual}`);
}

function renderMarkdown(payload) {
  const lines = [
    '# LOOPS Material Factory Verification',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- factory_json: ${payload.factoryJsonPath}`,
    `- ok: ${payload.ok}`,
    `- status: ${payload.summary.status || '(unknown)'}`,
    `- pack_ready: ${payload.summary.packReady}`,
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
  lines.push('- This verifier reads local material artifacts only.');
  lines.push('- It does not download media, run GPT-SoVITS, open Jianying, export video, post, send, push, deploy, or write secrets.');
  return lines.join('\n');
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
}
