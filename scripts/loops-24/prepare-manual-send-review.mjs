#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import fssync from 'node:fs';
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
const reviewDir = path.join(stateDir, 'manual-send-reviews');
const customerDir = path.join(repoRoot, '.loops', 'customer-acquisition');
const sendReviewDataPath = path.join(customerDir, 'send-review-data.json');
const sendTrackerPath = path.join(customerDir, 'send-tracker.csv');
const dealPipelinePath = path.join(customerDir, 'deal-pipeline.csv');
const cockpitPath = path.join(customerDir, 'send-review-cockpit-v2.html');
const now = new Date();
const stamp = toStamp(now);

const sendReviewData = await readJson(sendReviewDataPath, null);
const trackerRows = await readCsv(sendTrackerPath);
const dealRows = await readCsv(dealPipelinePath);
const prospects = buildProspects(sendReviewData, trackerRows, dealRows);
const readyForOwnerReview = prospects.filter(item => item.status === 'ready_for_owner_review' && !item.firstTouchSentAt);
const sent = prospects.filter(item => item.status === 'sent' || Boolean(item.firstTouchSentAt));
const staleSource = sendReviewData?.generated_at
  ? ageHours(sendReviewData.generated_at, now)
  : null;

const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  automationId,
  stateDir,
  reportPath: path.join(reviewDir, `${stamp}-manual-send-review.md`),
  jsonPath: path.join(reviewDir, `${stamp}-manual-send-review.json`),
  latestPath: path.join(reviewDir, 'latest.json'),
  sendGate: sendReviewData?.send_gate || 'missing',
  sourcePaths: {
    sendReviewData: relative(sendReviewDataPath),
    sendTracker: relative(sendTrackerPath),
    dealPipeline: relative(dealPipelinePath),
    cockpit: fssync.existsSync(cockpitPath) ? relative(cockpitPath) : null,
  },
  status: prospects.length && readyForOwnerReview.length
    ? 'manual-review-ready'
    : (prospects.length ? 'attention' : 'missing-source'),
  prospects,
  summary: {
    sendGate: sendReviewData?.send_gate || 'missing',
    prospectCount: prospects.length,
    readyForOwnerReviewCount: readyForOwnerReview.length,
    sentCount: sent.length,
    staleSourceAgeHours: staleSource === null ? null : round(staleSource),
    blockedByManualSend: readyForOwnerReview.length > 0,
    nextOwnerAction: readyForOwnerReview.length
      ? 'Review listed prospects in the local cockpit, verify the public contact channel, then send manually if approved.'
      : 'No ready-for-owner-review prospects found in the local send tracker.',
  },
  hardStops: [
    'This packet never sends LINE, IG, email, forms, public posts, or bulk outbound messages.',
    'This packet does not mark any prospect as sent and does not update send-tracker.csv.',
    'This packet intentionally lists metadata and artifact paths only; it does not duplicate full send-ready message text.',
  ],
};

payload.statusFingerprint = hash(JSON.stringify({
  sourcePaths: payload.sourcePaths,
  sendGate: payload.sendGate,
  prospects: payload.prospects.map(item => ({
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
  hardStops: payload.hardStops,
}));

const latest = await readJson(payload.latestPath, null);
const latestJsonIsPortable = await isPortableJsonFile(payload.latestPath);
if (latest?.statusFingerprint === payload.statusFingerprint
  && latestJsonIsPortable
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

await fs.mkdir(reviewDir, { recursive: true });
const payloadJson = stringifyPortableJson(payload);
await fs.writeFile(payload.jsonPath, payloadJson, 'utf8');
await fs.writeFile(payload.latestPath, payloadJson, 'utf8');
await fs.writeFile(payload.reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  reused: false,
  reportPath: payload.reportPath,
  jsonPath: payload.jsonPath,
  summary: payload.summary,
}, null, 2));

function buildProspects(data, trackerRows, dealRows) {
  const trackerById = new Map(trackerRows.map(row => [row.prospect_id, row]));
  const dealById = new Map(dealRows.map(row => [row.prospect_id, row]));
  return (Array.isArray(data?.prospects) ? data.prospects : [])
    .map(item => {
      const tracker = trackerById.get(item.id) || {};
      const deal = dealById.get(item.id) || {};
      return {
        id: item.id,
        name: item.name,
        priority: Number(item.priority || 0),
        channel: normalizeChannel(tracker.channel || item.channel),
        status: tracker.status || 'missing-tracker-row',
        sourceUrl: tracker.source_url || item.source || deal.source_url || null,
        contactHint: tracker.contact_hint || null,
        offer: item.offer || deal.offer || null,
        price: item.price || deal.trial_price || null,
        nextAction: tracker.next_action || deal.next_action || null,
        firstTouchSentAt: tracker.first_touch_sent_at || null,
        followUpDueAt: tracker.follow_up_due_at || null,
        directionFile: tracker.direction_file || item.directionFile || deal.asset_index || null,
        verifiedTouchFile: tracker.verified_touch_file || item.touchFile || null,
        hotFile: item.hotFile || deal.hot_reply_package || null,
      };
    })
    .sort((a, b) => a.priority - b.priority);
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (arguments.length > 1) return fallback;
    throw new Error(`Unable to read JSON at ${file}: ${error.message}`);
  }
}

async function readCsv(file) {
  try {
    const text = await fs.readFile(file, 'utf8');
    const rows = parseCsv(text);
    const [header, ...records] = rows;
    return records
      .filter(row => row.some(cell => String(cell || '').trim()))
      .map(row => Object.fromEntries(header.map((key, index) => [key, row[index] || ''])));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function isPortableJsonFile(file) {
  try {
    const source = await fs.readFile(file, 'utf8');
    return !findFirstRawNonAscii(source);
  } catch {
    return false;
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

function renderMarkdown(data) {
  const lines = [
    '# LOOPS Manual Send Review',
    '',
    `- generated_at: ${data.generatedAt}`,
    `- status: ${data.status}`,
    `- send_gate: ${data.sendGate}`,
    `- prospects: ${data.summary.readyForOwnerReviewCount}/${data.summary.prospectCount} ready_for_owner_review`,
    `- sent_count: ${data.summary.sentCount}`,
    `- local_cockpit: ${data.sourcePaths.cockpit || '(missing)'}`,
    '',
    '## BLUF',
    '',
    data.summary.readyForOwnerReviewCount
      ? '- Existing outreach drafts are ready for owner review, but every send remains manual_send_only.'
      : '- No ready-for-owner-review outreach item is available from the local tracker.',
    '',
    '## Review Queue',
    '',
    '| Priority | Prospect | Status | Channel | Source | Price | Direction | Verified Touch |',
    '|---:|---|---|---|---|---|---|---|',
    ...data.prospects.map(item => `| ${item.priority || ''} | ${escapeCell(item.name)} | ${escapeCell(item.status)} | ${escapeCell(item.channel)} | ${escapeCell(item.sourceUrl)} | ${escapeCell(item.price)} | ${escapeCell(item.directionFile)} | ${escapeCell(item.verifiedTouchFile)} |`),
    '',
    '## Hard Stops',
    '',
    ...data.hardStops.map(item => `- ${item}`),
    '',
    '## Next Owner Action',
    '',
    `- ${data.summary.nextOwnerAction}`,
  ];
  return lines.join('\n');
}

function escapeCell(value) {
  return String(value || '').replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
}

function normalizeChannel(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll('\\', '/');
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function ageHours(value, now) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (now.getTime() - timestamp) / 3_600_000);
}

function round(value) {
  return value === null || value === undefined ? null : Math.round(Number(value) * 1000) / 1000;
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}
