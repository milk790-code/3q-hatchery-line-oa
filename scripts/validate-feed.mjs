#!/usr/bin/env node
// Validate content/feed/*.json before sending it to /queue/add.
// Usage:
//   node scripts/validate-feed.mjs content/feed/batch.json [more.json ...]
//   node scripts/validate-feed.mjs --self-test
import { readFileSync } from 'node:fs';

const PLATFORMS = new Set(['threads', 'instagram', 'facebook', 'tiktok', 'google_biz']);
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/;
const KNOWN = new Set([
  'platform',
  'caption',
  'caption_seed',
  'image_url',
  'link_url',
  'topic_tag',
  'scheduled_at',
  'source_oa',
]);

function identityKey(p) {
  return JSON.stringify([
    p.platform || '',
    p.caption || '',
    p.caption_seed || '',
    p.image_url || '',
    p.link_url || '',
    p.scheduled_at || '',
  ]);
}

export function validateBatch(items) {
  const errors = [];
  const warnings = [];
  const seen = new Map();

  if (!Array.isArray(items)) return { errors: ['root must be a JSON array'], warnings };
  if (items.length === 0) errors.push('batch must contain at least one item');
  if (items.length > 50) errors.push(`one batch can contain at most 50 items, got ${items.length}`);

  items.forEach((p, i) => {
    const at = `item[${i}]`;
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      errors.push(`${at}: must be an object`);
      return;
    }
    if (!PLATFORMS.has(p.platform)) {
      errors.push(`${at}: platform must be ${[...PLATFORMS].join('/')}, got ${JSON.stringify(p.platform)}`);
    }
    if (!p.caption && !p.caption_seed) errors.push(`${at}: caption or caption_seed required`);
    if (p.caption && p.caption.length > 4900) errors.push(`${at}: caption exceeds 4900 chars`);
    if (p.scheduled_at != null && !ISO_RE.test(p.scheduled_at)) {
      errors.push(`${at}: scheduled_at must be ISO, for example 2026-06-20T12:00:00Z`);
    }
    for (const u of ['image_url', 'link_url']) {
      if (p[u] != null && !/^https?:\/\//.test(p[u])) errors.push(`${at}: ${u} must be an http(s) URL`);
    }
    if (p.platform === 'instagram' && !p.image_url) errors.push(`${at}: instagram requires image_url`);
    for (const k of Object.keys(p)) {
      if (!KNOWN.has(k)) warnings.push(`${at}: unknown field ${k}`);
    }

    const key = identityKey(p);
    if (seen.has(key)) errors.push(`${at}: exact duplicate of item[${seen.get(key)}]`);
    else seen.set(key, i);
  });

  return { errors, warnings };
}

function selfTest() {
  const good = [
    {
      platform: 'facebook',
      caption: 'hello',
      link_url: 'https://example.com/?utm_content=t1',
      scheduled_at: '2026-06-20T12:00:00Z',
    },
    { platform: 'instagram', caption: 'IG hello', image_url: 'https://example.com/a.png' },
  ];
  const g = validateBatch(good);
  if (g.errors.length !== 0) throw new Error(`good fixture failed: ${g.errors.join('; ')}`);

  const repeatedCaptionDistinctSchedule = [
    {
      platform: 'facebook',
      caption: 'same caption',
      link_url: 'https://example.com/?utm_content=d1',
      scheduled_at: '2026-06-20T00:00:00Z',
    },
    {
      platform: 'facebook',
      caption: 'same caption',
      link_url: 'https://example.com/?utm_content=d2',
      scheduled_at: '2026-06-21T00:00:00Z',
    },
  ];
  const rc = validateBatch(repeatedCaptionDistinctSchedule);
  if (rc.errors.length !== 0) {
    throw new Error(`repeated caption with distinct schedule/link should pass: ${rc.errors.join('; ')}`);
  }

  const exactDup = validateBatch([repeatedCaptionDistinctSchedule[0], repeatedCaptionDistinctSchedule[0]]);
  if (!exactDup.errors.some((e) => e.includes('exact duplicate'))) {
    throw new Error('exact duplicate should fail');
  }

  const bad = [
    { platform: 'facebok', caption: 'x' },
    { platform: 'facebook' },
    { platform: 'facebook', caption: 'x', scheduled_at: 'tomorrow' },
    { platform: 'instagram', caption: 'x' },
  ];
  const b = validateBatch(bad);
  if (b.errors.length !== 4) {
    throw new Error(`bad fixture should have 4 errors, got ${b.errors.length}: ${b.errors.join('; ')}`);
  }

  if (validateBatch([]).errors.length !== 1) throw new Error('empty array should fail');
  if (validateBatch({}).errors.length !== 1) throw new Error('non-array root should fail');
  console.log('self-test OK');
}

const args = process.argv.slice(2);
if (args[0] === '--self-test') {
  selfTest();
  process.exit(0);
}
if (args.length === 0) {
  console.error('usage: node scripts/validate-feed.mjs <content/feed/*.json> | --self-test');
  process.exit(1);
}

let failed = false;
for (const f of args) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(f, 'utf8'));
  } catch (e) {
    console.error(`${f} JSON parse failed: ${e.message}`);
    failed = true;
    continue;
  }
  const { errors, warnings } = validateBatch(parsed);
  warnings.forEach((w) => console.warn(`${f} ${w}`));
  if (errors.length) {
    failed = true;
    errors.forEach((e) => console.error(`${f} ${e}`));
  } else {
    console.log(`${f} OK(${parsed.length} items)`);
  }
}
process.exit(failed ? 1 : 0);
