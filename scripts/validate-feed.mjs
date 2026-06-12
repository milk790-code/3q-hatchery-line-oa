#!/usr/bin/env node
// 投餵包驗證器 — content/feed/*.json 在打 /queue/add 之前的本機/CI 檢查
// 用法: node scripts/validate-feed.mjs content/feed/batch.json [more.json ...]
//       node scripts/validate-feed.mjs --self-test
import { readFileSync } from 'node:fs';

const PLATFORMS = new Set(['threads', 'instagram', 'facebook', 'tiktok', 'google_biz']);
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/;
const KNOWN = new Set(['platform', 'caption', 'caption_seed', 'image_url', 'link_url', 'topic_tag', 'scheduled_at', 'source_oa']);

export function validateBatch(items) {
  const errors = [], warnings = [];
  if (!Array.isArray(items)) return { errors: ['root 必須是 JSON array'], warnings };
  if (items.length === 0) errors.push('空陣列 — 沒東西可投餵');
  if (items.length > 50) errors.push(`一次最多 50 筆(收到 ${items.length})`);
  items.forEach((p, i) => {
    const at = `item[${i}]`;
    if (!p || typeof p !== 'object' || Array.isArray(p)) { errors.push(`${at}: 必須是物件`); return; }
    if (!PLATFORMS.has(p.platform)) errors.push(`${at}: platform 必須是 ${[...PLATFORMS].join('/')}(收到 ${JSON.stringify(p.platform)})`);
    if (!p.caption && !p.caption_seed) errors.push(`${at}: caption 或 caption_seed 至少要有一個`);
    if (p.caption && p.caption.length > 4900) errors.push(`${at}: caption 超過 4900 字`);
    if (p.scheduled_at != null && !ISO_RE.test(p.scheduled_at)) errors.push(`${at}: scheduled_at 要 ISO 格式如 2026-06-20T12:00:00Z(收到 ${JSON.stringify(p.scheduled_at)})`);
    for (const u of ['image_url', 'link_url']) {
      if (p[u] != null && !/^https?:\/\//.test(p[u])) errors.push(`${at}: ${u} 要 http(s) URL`);
    }
    if (p.platform === 'instagram' && !p.image_url) errors.push(`${at}: instagram 必須有 image_url(IG API 不收純文字,漏了會在發布時 fail)`);
    for (const k of Object.keys(p)) if (!KNOWN.has(k)) warnings.push(`${at}: 未知欄位 ${k}(worker 會忽略)`);
    if (p.caption && /[!！]/.test(p.caption)) warnings.push(`${at}: caption 含驚嘆號(品牌聲腔慣例不用,確認是刻意再放行)`);
  });
  return { errors, warnings };
}

function selfTest() {
  const good = [
    { platform: 'facebook', caption: '測試貼文', link_url: 'https://example.com/?utm_content=t1', scheduled_at: '2026-06-20T12:00:00Z' },
    { platform: 'instagram', caption: 'IG 測試', image_url: 'https://example.com/a.png' },
  ];
  const g = validateBatch(good);
  if (g.errors.length !== 0) throw new Error(`good fixture 不該有錯: ${g.errors.join('; ')}`);

  const bad = [
    { platform: 'facebok', caption: 'x' },                          // platform 拼錯
    { platform: 'facebook' },                                       // 沒 caption
    { platform: 'facebook', caption: 'x', scheduled_at: '明天' },   // 日期格式
    { platform: 'instagram', caption: 'x' },                        // IG 沒圖
  ];
  const b = validateBatch(bad);
  if (b.errors.length !== 4) throw new Error(`bad fixture 應該剛好 4 個錯,得到 ${b.errors.length}: ${b.errors.join('; ')}`);

  if (validateBatch([]).errors.length !== 1) throw new Error('空陣列應該報錯');
  if (validateBatch({}).errors.length !== 1) throw new Error('非 array 應該報錯');
  console.log('self-test OK(good=0 errors, bad=4 errors, 邊界 2 項)');
}

const args = process.argv.slice(2);
if (args[0] === '--self-test') {
  selfTest();
  process.exit(0);
}
if (args.length === 0) {
  console.error('用法: node scripts/validate-feed.mjs <content/feed/*.json> | --self-test');
  process.exit(1);
}
let failed = false;
for (const f of args) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(f, 'utf8'));
  } catch (e) {
    console.error(`✗ ${f} JSON 解析失敗: ${e.message}`);
    failed = true;
    continue;
  }
  const { errors, warnings } = validateBatch(parsed);
  warnings.forEach((w) => console.warn(`⚠ ${f} ${w}`));
  if (errors.length) {
    failed = true;
    errors.forEach((e) => console.error(`✗ ${f} ${e}`));
  } else {
    console.log(`✓ ${f} OK(${parsed.length} 筆)`);
  }
}
process.exit(failed ? 1 : 0);
