#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://3q-hatchery-webhook.milk790.workers.dev';
const token = process.env.TRIGGER_TOKEN || process.env.SOCIAL_PUBLISHER_TOKEN;
const outDir = process.env.ANGEL_MEMORY_DIR || 'C:\\Users\\USER\\Desktop\\天使.claude\\memory';

if (!token) {
  console.error('Missing TRIGGER_TOKEN or SOCIAL_PUBLISHER_TOKEN in environment.');
  process.exit(1);
}

const url = new URL('/admin/weekly-report', baseUrl);
url.searchParams.set('key', token);

const res = await fetch(url);
if (!res.ok) {
  console.error(`Weekly report fetch failed: HTTP ${res.status}`);
  process.exit(1);
}

const data = await res.json();
if (!data.ok || !data.report_md) {
  console.error('No weekly report is archived yet.');
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 10);
await fs.mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, `${stamp}-3q-weekly-report.md`);
await fs.writeFile(outPath, `${data.report_md.trim()}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, outPath }, null, 2));
