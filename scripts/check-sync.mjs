#!/usr/bin/env node
// 投餵同步閘門:正本 JSON ↔ worker 內嵌 const(單檔無 bundler 的代價,由本腳本收掉)
//   正本 data/subsidies.json  → workers/outreach/worker.js 的 CATALOG(全欄)
//                             → webhook/worker.js 的 SUB_CATALOG(投影:store_cap_wan→cap,去 max_wan/deadline_note)
//   正本 brands/popmonster.json → workers/pop-line-oa/worker.js 的 AI_EMPLOYEE(全欄)
// 用法:
//   node scripts/check-sync.mjs        # 驗同步;漂移 → 列差異 + exit 1(deploy workflow 的閘門)
//   node scripts/check-sync.mjs --fix  # 以正本重寫 worker 內嵌區塊(之後自己跑各 worker 測試)
// 註:workers/ai-subsidy/worker.js 的 15 計畫規則表是獨立查證版(含申請窗口等),刻意不在本閘門;
//     重疊計畫的金額對齊靠人工巡(上次校 2026-06-12,SIIR 已對齊)。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// ── 正本 ──
const SUBS = JSON.parse(read('data/subsidies.json')).subsidies;
const BRAND = JSON.parse(read('brands/popmonster.json')).ai_employee;
const webhookProj = SUBS.map(({ id, name, type, store_cap_wan, ease, hook, elig }) => ({ id, name, type, cap: store_cap_wan, ease, hook, elig }));

// ── 內嵌區塊抽取(物件字面量,Function 求值)──
function extract(src, constName, open, close) {
  const re = new RegExp(`const ${constName} = (\\${open}[\\s\\S]*?\\n\\${close});`);
  const m = src.match(re);
  if (!m) throw new Error(`找不到 const ${constName}`);
  return { text: m[1], value: new Function(`return (${m[1]})`)(), replace: (s, gen) => s.replace(re, `const ${constName} = ${gen};`) };
}

// ── 穩定序列化(沿用 repo 單行物件風格)──
const js = (v) => Array.isArray(v) ? '[' + v.map(js).join(', ') + ']'
  : v && typeof v === 'object' ? '{ ' + Object.entries(v).map(([k, x]) => `${k}: ${js(x)}`).join(', ') + ' }'
  : typeof v === 'string' ? `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  : String(v);
const genArray = (arr) => '[\n' + arr.map((e) => '  ' + js(e) + ',').join('\n') + '\n]';
const genObject = (o) => '{\n' + Object.entries(o).map(([k, v]) => `  ${k}: ${js(v)},`).join('\n') + '\n}';

const norm = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x);

const TARGETS = [
  { file: 'workers/outreach/worker.js', constName: 'CATALOG', open: '[', close: ']', want: SUBS, gen: genArray },
  { file: 'webhook/worker.js', constName: 'SUB_CATALOG', open: '[', close: ']', want: webhookProj, gen: genArray },
  { file: 'workers/pop-line-oa/worker.js', constName: 'AI_EMPLOYEE', open: '{', close: '}', want: BRAND, gen: genObject },
];

const fix = process.argv.includes('--fix');
let drift = 0;
for (const t of TARGETS) {
  const src = read(t.file);
  const got = extract(src, t.constName, t.open, t.close);
  const same = norm(got.value) === norm(t.want);
  if (same) { console.log(`  ✅ ${t.file} ${t.constName} 同步`); continue; }
  drift++;
  if (fix) {
    writeFileSync(join(ROOT, t.file), got.replace(src, t.gen(t.want)));
    console.log(`  🔧 ${t.file} ${t.constName} 已以正本重寫`);
  } else {
    console.error(`  ❌ ${t.file} ${t.constName} 漂移:`);
    const wantArr = Array.isArray(t.want) ? t.want : [t.want];
    const gotArr = Array.isArray(got.value) ? got.value : [got.value];
    wantArr.forEach((w, i) => { if (norm(w) !== norm(gotArr[i])) console.error(`     · [${w.id ?? i}] 正本=${norm(w).slice(0, 140)}\n            內嵌=${norm(gotArr[i]).slice(0, 140)}`); });
    if (gotArr.length !== wantArr.length) console.error(`     · 筆數 正本=${wantArr.length} 內嵌=${gotArr.length}`);
  }
}
if (drift && !fix) { console.error('\n🔴 漂移 — 跑 node scripts/check-sync.mjs --fix 後重跑各 worker 測試'); process.exit(1); }
console.log(`\n🟢 ${fix && drift ? `已修 ${drift} 處,記得跑各 worker 測試` : '三組正本↔內嵌全同步'}`);
