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
const outDir = path.join(stateDir, 'content-queue-reconciliations');
const migrationsDir = path.join(repoRoot, 'db', 'migrations');
const manifestPath = path.join(repoRoot, 'assets', 'exports', '_render-manifest.json');

const migrationFiles = (await readDirSafe(migrationsDir))
  .filter(file => file.endsWith('.sql'))
  .sort();
const manifest = await readJson(manifestPath, { files: {} });
const manifestFiles = new Set(Object.keys(manifest.files || {}));
const rows = [];
const parseErrors = [];

for (const file of migrationFiles) {
  const fullPath = path.join(migrationsDir, file);
  const sql = await readText(fullPath);
  for (const insert of findContentQueueInserts(sql)) {
    try {
      const parsed = parseInsert(insert);
      for (const tuple of parsed.tuples) {
        rows.push({
          file,
          columns: parsed.columns,
          values: tuple,
          row: Object.fromEntries(parsed.columns.map((column, index) => [column, tuple[index] ?? null])),
        });
      }
    } catch (error) {
      parseErrors.push({ file, error: error.message, insertPrefix: insert.slice(0, 160) });
    }
  }
}

const normalizedRows = rows.map((entry, index) => normalizeRow(entry, index + 1));
const imageChecks = normalizedRows
  .filter(row => row.image_url)
  .map(row => checkImage(row, manifestFiles));
const missingImages = imageChecks.filter(check => !check.existsOnDisk);
const missingFromManifest = imageChecks.filter(check => check.existsOnDisk && !check.existsInManifest);
const duplicateKeys = findDuplicates(normalizedRows.map(row => `${row.platform}|${row.image_file || ''}|${row.caption_text.slice(0, 80)}`));
const platformCounts = countBy(normalizedRows, row => row.platform || '<missing>');
const statusCounts = countBy(normalizedRows, row => row.status || 'pending');
const sourceCounts = countBy(normalizedRows, row => row.source_oa || '<missing>');
const scheduleSummary = summarizeSchedules(normalizedRows);
const suspiciousTextRows = normalizedRows.filter(row => suspiciousRatio(row.caption_text) > 0.08);
const fingerprint = hash(JSON.stringify({
  rows: normalizedRows.map(row => ({
    file: row.file,
    platform: row.platform,
    image_url: row.image_url,
    caption_text: row.caption_text,
    scheduled_at: row.scheduled_at,
    status: row.status,
  })),
  manifestFiles: [...manifestFiles].sort(),
}));

await fs.mkdir(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const reportPath = path.join(outDir, `${stamp}-content-queue.md`);
const jsonPath = path.join(outDir, `${stamp}-content-queue.json`);
const latestPath = path.join(outDir, 'latest.json');

const result = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  fingerprint,
  reportPath,
  jsonPath,
  summary: {
    migrations: migrationFiles.length,
    parsedRows: normalizedRows.length,
    parseErrors: parseErrors.length,
    platformCounts,
    statusCounts,
    sourceCounts,
    imageRows: imageChecks.length,
    missingImages: missingImages.length,
    missingFromManifest: missingFromManifest.length,
    duplicateKeys: duplicateKeys.length,
    suspiciousTextRows: suspiciousTextRows.length,
    scheduleSummary,
  },
  parseErrors,
  missingImages,
  missingFromManifest,
  duplicateKeys,
  suspiciousTextRows: suspiciousTextRows.map(row => ({
    rowNumber: row.rowNumber,
    file: row.file,
    platform: row.platform,
    suspiciousRatio: suspiciousRatio(row.caption_text),
    preview: row.caption_text.slice(0, 120),
  })),
  rows: normalizedRows,
};

await fs.writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
await fs.writeFile(reportPath, renderReport(result), 'utf8');
await fs.writeFile(latestPath, `${JSON.stringify({
  generatedAt: result.generatedAt,
  repoRoot,
  fingerprint,
  reportPath,
  jsonPath,
  summary: result.summary,
}, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  reportPath,
  jsonPath,
  fingerprint,
  summary: result.summary,
}, null, 2));

function findContentQueueInserts(sql) {
  const inserts = [];
  const re = /INSERT\s+INTO\s+content_queue\s*\(/ig;
  let match;
  while ((match = re.exec(sql)) !== null) {
    const start = match.index;
    let i = start;
    let inString = false;
    while (i < sql.length) {
      const ch = sql[i];
      const next = sql[i + 1];
      if (ch === "'") {
        if (inString && next === "'") {
          i += 2;
          continue;
        }
        inString = !inString;
      }
      if (!inString && ch === ';') {
        inserts.push(sql.slice(start, i + 1));
        re.lastIndex = i + 1;
        break;
      }
      i += 1;
    }
  }
  return inserts;
}

function parseInsert(insert) {
  insert = stripLineCommentsOutsideStrings(insert);
  const columnsStart = insert.indexOf('(');
  const columnsEnd = findMatchingParen(insert, columnsStart);
  const columns = insert
    .slice(columnsStart + 1, columnsEnd)
    .split(',')
    .map(column => column.trim())
    .filter(Boolean);
  const valuesIndex = insert.toUpperCase().indexOf('VALUES', columnsEnd);
  if (valuesIndex === -1) throw new Error('VALUES not found');
  const valuesText = insert.slice(valuesIndex + 'VALUES'.length).replace(/;\s*$/, '');
  const tupleTexts = splitTuples(valuesText);
  return { columns, tuples: tupleTexts.map(parseTuple) };
}

function stripLineCommentsOutsideStrings(sql) {
  const out = [];
  let inString = false;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "'") {
      out.push(ch);
      if (inString && next === "'") {
        out.push(next);
        i += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (!inString && ch === '-' && next === '-') {
      while (i < sql.length && sql[i] !== '\n') i += 1;
      out.push('\n');
      continue;
    }
    out.push(ch);
  }
  return out.join('');
}

function splitTuples(valuesText) {
  const tuples = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  for (let i = 0; i < valuesText.length; i += 1) {
    const ch = valuesText[i];
    const next = valuesText[i + 1];
    if (ch === "'") {
      if (inString && next === "'") {
        i += 1;
        continue;
      }
      inString = !inString;
    }
    if (inString) continue;
    if (ch === '(') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        tuples.push(valuesText.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return tuples;
}

function parseTuple(tupleText) {
  const inner = tupleText.trim().replace(/^\(/, '').replace(/\)$/, '');
  const values = [];
  let token = '';
  let depth = 0;
  let inString = false;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    const next = inner[i + 1];
    if (ch === "'") {
      token += ch;
      if (inString && next === "'") {
        token += next;
        i += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      if (ch === ',' && depth === 0) {
        values.push(parseSqlValue(token));
        token = '';
        continue;
      }
    }
    token += ch;
  }
  if (token.trim()) values.push(parseSqlValue(token));
  return values;
}

function parseSqlValue(value) {
  const trimmed = value.trim();
  if (/^NULL$/i.test(trimmed)) return null;
  if (/^'.*'$/s.test(trimmed)) return trimmed.slice(1, -1).replace(/''/g, "'");
  return trimmed;
}

function normalizeRow(entry, rowNumber) {
  const row = entry.row;
  const imageUrl = row.image_url || '';
  const captionText = row.caption || row.caption_seed || '';
  return {
    rowNumber,
    file: entry.file,
    platform: row.platform || '',
    image_url: imageUrl,
    image_file: imageUrl ? path.basename(new URL(imageUrl).pathname) : '',
    caption_seed: row.caption_seed || null,
    caption: row.caption || null,
    caption_text: captionText,
    topic_tag: row.topic_tag || null,
    scheduled_at: row.scheduled_at || '',
    published_at: row.published_at || null,
    status: row.status || 'pending',
    source_oa: row.source_oa || '3q-hatchery',
  };
}

function checkImage(row, manifestFiles) {
  let host = '';
  let imageFile = '';
  try {
    const url = new URL(row.image_url);
    host = url.host;
    imageFile = path.basename(url.pathname);
  } catch {
    return { ok: false, rowNumber: row.rowNumber, file: row.file, image_url: row.image_url, reason: 'invalid_url' };
  }
  const isKnownHost = host === 'milk790-code.github.io';
  const diskPath = path.join(repoRoot, 'assets', 'exports', imageFile);
  const existsOnDisk = fssync.existsSync(diskPath);
  const existsInManifest = manifestFiles.has(imageFile);
  return {
    ok: !isKnownHost || existsOnDisk,
    rowNumber: row.rowNumber,
    file: row.file,
    platform: row.platform,
    image_url: row.image_url,
    image_file: imageFile,
    existsOnDisk,
    existsInManifest,
    reason: existsOnDisk ? (existsInManifest ? null : 'missing_from_render_manifest') : 'missing_from_disk',
  };
}

function summarizeSchedules(rows) {
  const now = Date.now();
  let relative = 0;
  let isoPast = 0;
  let isoFuture = 0;
  let empty = 0;
  for (const row of rows) {
    if (!row.scheduled_at) {
      empty += 1;
    } else if (/^datetime\s*\(/i.test(row.scheduled_at)) {
      relative += 1;
    } else {
      const ts = Date.parse(row.scheduled_at);
      if (Number.isFinite(ts) && ts < now) isoPast += 1;
      else if (Number.isFinite(ts)) isoFuture += 1;
    }
  }
  return { relative, isoPast, isoFuture, empty };
}

function findDuplicates(values) {
  const seen = new Map();
  for (const value of values) seen.set(value, (seen.get(value) || 0) + 1);
  return [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));
}

function countBy(items, fn) {
  return items.reduce((acc, item) => {
    const key = fn(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function suspiciousRatio(text) {
  const chars = [...String(text || '')];
  if (chars.length === 0) return 0;
  const suspicious = chars.filter(ch => ch === '?' || ch.charCodeAt(0) === 0xfffd || (ch.charCodeAt(0) >= 0xe000 && ch.charCodeAt(0) <= 0xf8ff)).length;
  return Math.round((suspicious / chars.length) * 1000) / 1000;
}

function renderReport(result) {
  const lines = [
    '# Content Queue Reconciliation',
    '',
    `- generated_at: ${result.generatedAt}`,
    `- repo: ${result.repoRoot}`,
    `- fingerprint: ${result.fingerprint}`,
    `- parsed_rows: ${result.summary.parsedRows}`,
    `- parse_errors: ${result.summary.parseErrors}`,
    `- image_rows: ${result.summary.imageRows}`,
    `- missing_images_on_disk: ${result.summary.missingImages}`,
    `- missing_from_render_manifest: ${result.summary.missingFromManifest}`,
    `- duplicate_keys: ${result.summary.duplicateKeys}`,
    `- suspicious_text_rows: ${result.summary.suspiciousTextRows}`,
    '',
    '## Platform Counts',
    '',
    ...Object.entries(result.summary.platformCounts).map(([platform, count]) => `- ${platform}: ${count}`),
    '',
    '## Schedule Summary',
    '',
    ...Object.entries(result.summary.scheduleSummary).map(([key, count]) => `- ${key}: ${count}`),
    '',
    '## Missing Images',
    '',
  ];
  if (result.missingImages.length === 0) {
    lines.push('- None');
  } else {
    for (const item of result.missingImages) {
      lines.push(`- row ${item.rowNumber} ${item.platform}: ${item.image_file} (${item.reason})`);
    }
  }
  lines.push('', '## Missing From Render Manifest', '');
  if (result.missingFromManifest.length === 0) {
    lines.push('- None');
  } else {
    for (const item of result.missingFromManifest) {
      lines.push(`- row ${item.rowNumber} ${item.platform}: ${item.image_file} exists on disk but is absent from _render-manifest.json`);
    }
  }
  lines.push('', '## Duplicate Keys', '');
  if (result.duplicateKeys.length === 0) {
    lines.push('- None');
  } else {
    for (const item of result.duplicateKeys) lines.push(`- ${item.count}x ${item.key}`);
  }
  lines.push('', '## Rows', '');
  for (const row of result.rows) {
    lines.push(`- #${row.rowNumber} ${row.platform} ${row.status} ${row.scheduled_at || '<next-cron>'}`);
    if (row.image_file) lines.push(`  - image: ${row.image_file}`);
    lines.push(`  - caption: ${row.caption_text.slice(0, 90).replace(/\s+/g, ' ')}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function readDirSafe(dir) {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

async function readText(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return '';
  }
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function findMatchingParen(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error('matching parenthesis not found');
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}
