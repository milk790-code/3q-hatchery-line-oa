#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

function usage() {
  console.error('usage: node scripts/prepare-feed-dispatch.mjs <in.json> <out.json> [--overdue-policy preserve|skip_past|spread_overdue] [--start-date YYYY-MM-DD] [--self-test]');
}

function taipeiYmd(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addDays(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function tw0800Utc(ymd) {
  return new Date(`${ymd}T08:00:00+08:00`).toISOString().replace('.000', '');
}

function parseArgs(argv) {
  const opts = { policy: 'preserve', startDate: '' };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--self-test') opts.selfTest = true;
    else if (a === '--overdue-policy') opts.policy = argv[++i] || '';
    else if (a === '--start-date') opts.startDate = argv[++i] || '';
    else positional.push(a);
  }
  opts.input = positional[0];
  opts.output = positional[1];
  return opts;
}

export function prepareFeed(items, { policy = 'preserve', startDate = '', now = new Date() } = {}) {
  if (!['preserve', 'skip_past', 'spread_overdue'].includes(policy)) {
    throw new Error(`unknown overdue policy: ${policy}`);
  }
  if (!Array.isArray(items)) throw new Error('feed root must be an array');

  const nowMs = now.getTime();
  let skippedPast = 0;
  let shiftedPast = 0;
  let out = items.map((item) => ({ ...item }));

  if (policy === 'skip_past') {
    const before = out.length;
    out = out.filter((item) => !item.scheduled_at || Date.parse(item.scheduled_at) > nowMs);
    skippedPast = before - out.length;
  } else if (policy === 'spread_overdue') {
    const occupied = new Set(
      out
        .filter((item) => item.scheduled_at && Date.parse(item.scheduled_at) > nowMs)
        .map((item) => taipeiYmd(new Date(item.scheduled_at)))
    );
    let cursor = startDate || addDays(taipeiYmd(now), 1);
    out = out.map((item) => {
      if (!item.scheduled_at || Date.parse(item.scheduled_at) > nowMs) return item;
      while (occupied.has(cursor)) cursor = addDays(cursor, 1);
      const scheduled_at = tw0800Utc(cursor);
      occupied.add(cursor);
      cursor = addDays(cursor, 1);
      shiftedPast += 1;
      return { ...item, scheduled_at };
    });
  }

  return {
    items: out,
    summary: {
      policy,
      input: items.length,
      output: out.length,
      skipped_past: skippedPast,
      shifted_past: shiftedPast,
      generated_at: now.toISOString(),
    },
  };
}

function selfTest() {
  const now = new Date('2026-06-17T04:00:00Z');
  const feed = [
    { platform: 'facebook', caption: 'A', link_url: 'https://e.test/?d=1', scheduled_at: '2026-06-14T00:00:00Z' },
    { platform: 'facebook', caption: 'A', link_url: 'https://e.test/?d=2', scheduled_at: '2026-06-18T00:00:00Z' },
    { platform: 'facebook', caption: 'A', link_url: 'https://e.test/?d=3', scheduled_at: '2026-06-15T00:00:00Z' },
  ];
  const skipped = prepareFeed(feed, { policy: 'skip_past', now });
  if (skipped.items.length !== 1 || skipped.summary.skipped_past !== 2) throw new Error('skip_past failed');
  const spread = prepareFeed(feed, { policy: 'spread_overdue', now });
  if (spread.summary.shifted_past !== 2) throw new Error('spread_overdue shift count failed');
  if (spread.items[0].scheduled_at !== '2026-06-19T00:00:00Z') throw new Error(`unexpected first spread slot: ${spread.items[0].scheduled_at}`);
  if (spread.items[2].scheduled_at !== '2026-06-20T00:00:00Z') throw new Error(`unexpected second spread slot: ${spread.items[2].scheduled_at}`);
  console.log('prepare-feed-dispatch self-test OK');
}

const opts = parseArgs(process.argv.slice(2));
if (opts.selfTest) {
  selfTest();
  process.exit(0);
}
if (!opts.input || !opts.output) {
  usage();
  process.exit(1);
}
const items = JSON.parse(readFileSync(opts.input, 'utf8'));
const result = prepareFeed(items, { policy: opts.policy, startDate: opts.startDate });
writeFileSync(opts.output, `${JSON.stringify(result.items, null, 2)}\n`);
console.log(`### prepared ${opts.input}`);
console.log('');
console.log(`- overdue_policy: ${result.summary.policy}`);
console.log(`- input: ${result.summary.input}`);
console.log(`- output: ${result.summary.output}`);
console.log(`- skipped_past: ${result.summary.skipped_past}`);
console.log(`- shifted_past: ${result.summary.shifted_past}`);
