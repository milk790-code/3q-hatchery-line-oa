#!/usr/bin/env node
// 陌開名單匯入:PROSPECTS.md → JSON / SQL / 直接 POST 到 3q-line-oa worker
// 用法:
//   node scripts/prospects-import.mjs                 # 輸出 JSON 陣列(stdout)
//   node scripts/prospects-import.mjs --sql           # 輸出 D1 可執行的 INSERT(upsert,不蓋 status/note)
//   node scripts/prospects-import.mjs --post <workerURL> --key <SETUP_KEY>   # 直接匯入線上
// 解析規則:## 批次N 切批次;## / ### 的「X 池」標題切池;表格列 = | 編號 | 店名 | 區 | 門面 | 切角 | 信心 |
// 重跑安全:worker 端與 --sql 皆為 ON CONFLICT(pool,list_no) upsert,只更新名單欄位,不動 status/note/contacted_at。

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] || true) : null; };
const mdPath = args.find(a => a.endsWith('.md')) || join(dirname(fileURLToPath(import.meta.url)), '..', 'PROSPECTS.md');

const lines = readFileSync(mdPath, 'utf8').split('\n');
let batch = 1, pool = null;
const rows = [];
for (const line of lines) {
  const bm = line.match(/^## 批次(\d+)/);
  if (bm) { batch = parseInt(bm[1], 10); pool = null; continue; }
  const pm = line.match(/^#{2,3} ([ABC]) 池/);
  if (pm) { pool = pm[1]; continue; }
  if (/^#{2,3} /.test(line)) { pool = null; continue; }
  const rm = line.match(/^\|\s*(\d+)\s*\|/);
  if (!rm || !pool) continue;
  const cells = line.split('|').map(c => c.trim());
  if (cells.length < 8) { console.error(`⚠ 欄位數不對,跳過: ${line.slice(0, 60)}`); continue; }
  const stars = (cells[6].match(/★/g) || []).length;
  rows.push({
    pool, list_no: parseInt(cells[1], 10), name: cells[2], district: cells[3],
    online_status: cells[4], why: cells[5], confidence: Math.min(Math.max(stars, 1), 3), batch,
  });
}

// 摘要 + 重複編號檢查(stderr,不污染 stdout)
const summary = {};
const seen = new Set();
let dup = 0;
for (const r of rows) {
  const k = `${r.pool}${r.list_no}`;
  if (seen.has(k)) { console.error(`⚠ 重複編號 ${k}: ${r.name}`); dup++; }
  seen.add(k);
  summary[`${r.pool}池/批次${r.batch}`] = (summary[`${r.pool}池/批次${r.batch}`] || 0) + 1;
}
console.error(`共 ${rows.length} 筆${dup ? `(⚠ 重複 ${dup})` : ''}:`, JSON.stringify(summary));

const esc = (s) => s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;
if (flag('--sql')) {
  for (let i = 0; i < rows.length; i += 25) {
    const vals = rows.slice(i, i + 25).map(r =>
      `(${esc(r.pool)},${r.list_no},${esc(r.name)},${esc(r.district)},${esc(r.online_status)},${esc(r.why)},${r.confidence},${r.batch})`).join(',\n');
    console.log(`INSERT INTO prospects (pool, list_no, name, district, online_status, why, confidence, batch) VALUES\n${vals}\nON CONFLICT(pool, list_no) DO UPDATE SET name=excluded.name, district=excluded.district, online_status=excluded.online_status, why=excluded.why, confidence=excluded.confidence, batch=excluded.batch, updated_at=datetime('now');\n`);
  }
} else if (flag('--post')) {
  const base = String(flag('--post')).replace(/\/$/, '');
  const key = flag('--key');
  if (!key || key === true) { console.error('--post 需要 --key <SETUP_KEY>'); process.exit(1); }
  const resp = await fetch(`${base}/admin/prospects/import?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows),
  });
  console.log(await resp.text());
  if (!resp.ok) process.exit(1);
} else {
  console.log(JSON.stringify(rows, null, 1));
}
