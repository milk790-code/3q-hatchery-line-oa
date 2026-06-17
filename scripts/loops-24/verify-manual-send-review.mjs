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
const reviewJsonPath = path.resolve(args.reviewJson || path.join(stateDir, 'manual-send-reviews', 'latest.json'));
const verificationDir = path.join(stateDir, 'manual-send-review-verifications');
const now = new Date();
const stamp = toStamp(now);

const review = await readJson(reviewJsonPath);
const findings = await verifyReview(review);
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  automationId,
  stateDir,
  reviewJsonPath,
  reportPath: path.join(verificationDir, `${stamp}-manual-send-review-verification.md`),
  jsonPath: path.join(verificationDir, `${stamp}-manual-send-review-verification.json`),
  latestPath: path.join(verificationDir, 'latest.json'),
  ok: findings.failures.length === 0,
  summary: {
    status: review.status || null,
    prospectCount: Number(review.summary?.prospectCount || 0),
    readyForOwnerReviewCount: Number(review.summary?.readyForOwnerReviewCount || 0),
    sentCount: Number(review.summary?.sentCount || 0),
    failureCount: findings.failures.length,
    warningCount: findings.warnings.length,
  },
  findings,
  statusFingerprint: hash(JSON.stringify({
    reviewFingerprint: review.statusFingerprint || null,
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
    if (argv[index] === '--review-json') {
      parsed.reviewJson = argv[index + 1];
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

async function verifyReview(review) {
  const failures = [];
  const warnings = [];
  const prospects = Array.isArray(review.prospects) ? review.prospects : [];
  const ready = prospects.filter(item => item.status === 'ready_for_owner_review' && !item.firstTouchSentAt);
  const sent = prospects.filter(item => item.status === 'sent' || Boolean(item.firstTouchSentAt));

  requireEqual(failures, 'repoRoot', review.repoRoot, repoRoot);
  requireEqual(failures, 'automationId', review.automationId, automationId);
  requireEqual(failures, 'stateDir', review.stateDir, stateDir);
  requireEqual(failures, 'sendGate', review.sendGate, 'manual_send_only');
  requireEqual(failures, 'summary.prospectCount', Number(review.summary?.prospectCount), prospects.length);
  requireEqual(failures, 'summary.readyForOwnerReviewCount', Number(review.summary?.readyForOwnerReviewCount), ready.length);
  requireEqual(failures, 'summary.sentCount', Number(review.summary?.sentCount), sent.length);
  requireEqual(failures, 'summary.blockedByManualSend', review.summary?.blockedByManualSend, ready.length > 0);

  if (!review.reportPath || !fssync.existsSync(review.reportPath)) {
    failures.push('manual-send review reportPath must exist');
  }
  for (const [label, sourcePath] of Object.entries(review.sourcePaths || {})) {
    if (!sourcePath || label === 'cockpit') continue;
    if (!fssync.existsSync(path.join(repoRoot, sourcePath))) {
      failures.push(`source path missing: ${label}=${sourcePath}`);
    }
  }
  if (!prospects.length) {
    failures.push('manual-send review must include at least one prospect');
  }
  for (const prospect of prospects) {
    if (!prospect.id || !prospect.name) failures.push(`prospect missing id or name: ${JSON.stringify(prospect)}`);
    if (prospect.firstTouch || prospect.followUp || prospect.hotReply || prospect.closeText) {
      failures.push(`prospect ${prospect.id} includes full send-ready message text`);
    }
    if (prospect.nextAction && !String(prospect.nextAction).includes('manual')) {
      warnings.push(`prospect ${prospect.id} nextAction does not explicitly mention manual review`);
    }
    for (const field of ['directionFile', 'verifiedTouchFile', 'hotFile']) {
      if (prospect[field] && !fssync.existsSync(path.join(repoRoot, prospect[field]))) {
        failures.push(`prospect ${prospect.id} missing ${field}: ${prospect[field]}`);
      }
    }
  }
  const reportText = await readText(review.reportPath, '');
  for (const forbidden of ['send automatically', 'auto-send', 'firstTouch', 'hotReply', 'closeText']) {
    if (reportText.toLowerCase().includes(forbidden.toLowerCase())) {
      failures.push(`manual-send report contains forbidden phrase: ${forbidden}`);
    }
  }
  const hardStops = review.hardStops || [];
  for (const phrase of ['never sends', 'does not mark any prospect as sent', 'does not duplicate full send-ready message text']) {
    if (!hardStops.some(item => String(item).includes(phrase))) {
      failures.push(`hardStops missing phrase: ${phrase}`);
    }
  }

  const expectedFingerprint = hash(JSON.stringify({
    sourcePaths: review.sourcePaths,
    sendGate: review.sendGate,
    prospects: prospects.map(item => ({
      id: item.id,
      name: item.name,
      priority: item.priority,
      status: item.status,
      firstTouchSentAt: item.firstTouchSentAt,
      followUpDueAt: item.followUpDueAt,
      sourceUrl: item.sourceUrl,
      directionFile: item.directionFile,
      verifiedTouchFile: item.verifiedTouchFile,
      hotFile: item.hotFile,
    })),
    hardStops: review.hardStops,
  }));
  requireEqual(failures, 'statusFingerprint', review.statusFingerprint, expectedFingerprint);

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

function requireEqual(failures, field, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${field} expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

function renderMarkdown(data) {
  const lines = [
    '# LOOPS Manual Send Review Verification',
    '',
    `- generated_at: ${data.generatedAt}`,
    `- ok: ${data.ok}`,
    `- review_json: ${data.reviewJsonPath}`,
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
