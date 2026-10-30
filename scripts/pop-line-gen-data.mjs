#!/usr/bin/env node
// v6 資料投餵:正本 data/pop-line/*.json → workers/pop-line-oa/worker.js 的 DATA 區塊(單檔部署、無 bundler)
//   catalog.json(產品目錄:蝦皮連結/DM 價/痛點/賣點/別名/影片線)
//   videos.json(自家一剪到底影片 line_map + YouTube 備援)
//   oa.json(歡迎包 welcome_package.messages、quickReply)
//   brain-directives.json(逐輪指令/異議腳本/貼圖政策/推薦規則/影片時機)
// 用法:node scripts/pop-line-gen-data.mjs        # 重寫 DATA 區塊
//       node scripts/pop-line-gen-data.mjs --check # 只比對,漂移 exit 1(deploy 閘門)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// 預設讀 repo 的 data/pop-line/、寫 workers/pop-line-oa/worker.js;驗證用可改指別處(POP_LINE_DATA_DIR / POP_LINE_WORKER),不動 repo 檔
const DATA_DIR = process.env.POP_LINE_DATA_DIR || join(ROOT, 'data/pop-line');
const WORKER_FILE = process.env.POP_LINE_WORKER || join(ROOT, 'workers/pop-line-oa/worker.js');
const rd = (p) => JSON.parse(readFileSync(join(DATA_DIR, p), 'utf8'));
const catalog = rd('catalog.json'), videos = rd('videos.json'), oa = rd('oa.json'), dir = rd('brain-directives.json');

const ASSET_BASE = 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/pop/';
// 蝦皮網址一律加 openExternalBrowser=1(LINE 內建瀏覽器開蝦皮常被導去 App 登入頁;帶這個參數改用外部瀏覽器)。已有 query 就用 &,已帶就不重複加
const extBrowser = (u) => (!u || /[?&]openExternalBrowser=/.test(u)) ? u : u + (u.includes('?') ? '&' : '?') + 'openExternalBrowser=1';
const SHOP_URL = extBrowser(catalog.shop_url || 'https://shopee.tw/milk790');

// ── 產品目錄壓縮成 worker 用的形狀(欄位短名省 prompt/記憶體;別名先長後短,命中時取最長)──
const CAT = {};
for (const it of catalog.items) {
  if (!it.sku) continue;
  const al = Array.from(new Set([...(it.aliases || []), it.name_short].filter(Boolean))).sort((a, b) => b.length - a.length);
  CAT[it.sku] = {
    n: it.name_short || it.sku, ns: it.name_shopee || it.name_short || '', cat: it.category || '',
    p: it.price_label || (it.dm_price != null ? String(it.dm_price) : ''), pn: it.price_note || '',
    u: extBrowser(it.shopee_url || (it.shopee_item_id ? `https://shopee.tw/product/1072078949/${it.shopee_item_id}` : SHOP_URL)),
    img: it.image_url || (it.image_id ? `https://down-tw.img.susercontent.com/file/${it.image_id}` : ''),
    pain: it.pain || '', sp: (it.sellpoints || []).slice(0, 3), use: it.usage || '',
    al, vl: it.video_line || 'none', yt: it.yt_playlist || '', dns: it.do_not_say || [], bw: it.bundle_with || [],
  };
}
// ── 影片:line → [{id, mp4, jpg, cap, dur}];沒自家片的線走 yt_fallback ──
const VID = { lines: {}, yt: videos.yt_fallback || {} };
const byId = Object.fromEntries((videos.videos || []).map((v) => [v.id, v]));
for (const [line, ids] of Object.entries(videos.line_map || {})) {
  VID.lines[line] = ids.filter((id) => byId[id]).map((id) => ({ id, mp4: ASSET_BASE + 'video/' + id + '.mp4', jpg: ASSET_BASE + 'video/' + id + '.jpg', cap: byId[id].caption || '', dur: Math.round(byId[id].duration_s || 0) }));
}
const WELCOME = (oa.welcome_package && oa.welcome_package.messages) || [];
const DIR = {
  turn: dir.turn_directives || {}, obj: (dir.objections || []).map((o) => ({ rx: o.trigger_rx, name: o.name, script: o.script })),
  stk: dir.sticker_policy || { every_n: 3, daily_cap: 2, blocked_emotions: ['抱怨', '售後'] },
  rec: (dir.recommend_rules || []).map((r) => ({ rx: r.symptom_rx, skus: r.skus, say: r.say || '' })),
  vm: (dir.video_moments || []).map((m) => ({ rx: m.rx, line: m.line })),
  human_rx: dir.human_handoff_rx || '', pay_rx: dir.pay_intent_rx || '',
};
if (dir.turn_rx && typeof dir.turn_rx === 'object') DIR.turn_rx = dir.turn_rx;   // worker 的 hesitation_close/price_mismatch/wholesale 等正規式以此為優先(正本沒有就不輸出)
// 正規式先在這裡編譯一次,壞的擋在部署前
const stkRx = Object.values((DIR.stk && DIR.stk.moment_rx) || {}), turnRx = Object.values(DIR.turn_rx || {});
for (const r of [...DIR.obj.map((o) => o.rx), ...DIR.rec.map((r) => r.rx), ...DIR.vm.map((m) => m.rx), DIR.human_rx, DIR.pay_rx, ...stkRx, ...turnRx].filter(Boolean)) new RegExp(r);

// ── 2026-10-30:DATA 區所有字串裡的蝦皮網址一律補 openExternalBrowser=1(指令/異議腳本/影片提示/歡迎包都算;正規式欄位 rx 不碰)──
const SHOPEE_URL_RX = /https?:\/\/(?:[a-z0-9-]+\.)?shopee\.tw\/[^\s"'<>()\[\]，。、（）【】「」]*/g;
const fixUrls = (v, k = '') => {
  if (typeof v === 'string') return (k === 'rx' || /_rx$/.test(k)) ? v : v.replace(SHOPEE_URL_RX, (u) => extBrowser(u));
  if (Array.isArray(v)) return v.map((x) => fixUrls(x, k));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([kk, vv]) => [kk, fixUrls(vv, kk)]));
  return v;
};
for (const [name, obj] of [['CAT', CAT], ['VID', VID], ['DIR', DIR]]) Object.assign(obj, fixUrls(obj));
WELCOME.splice(0, WELCOME.length, ...fixUrls(WELCOME));

const block = `// ═══ v6 DATA:BEGIN(由 scripts/pop-line-gen-data.mjs 從 data/pop-line/*.json 產生,勿手改;改正本再重跑)═══
const ASSET_BASE = ${JSON.stringify(ASSET_BASE)};
const SHOP_URL = ${JSON.stringify(SHOP_URL)};
const CATALOG = ${JSON.stringify(CAT)};
const VIDEOS = ${JSON.stringify(VID)};
const WELCOME_PACK = ${JSON.stringify(WELCOME)};
const DIRECTIVES = ${JSON.stringify(DIR)};
// ═══ v6 DATA:END ═══`;

const file = WORKER_FILE;
const src = readFileSync(file, 'utf8');
const re = /\/\/ ═══ v6 DATA:BEGIN[\s\S]*?\/\/ ═══ v6 DATA:END ═══/;
if (!re.test(src)) { console.error('worker.js 找不到 v6 DATA 區塊標記'); process.exit(2); }
const next = src.replace(re, () => block);
if (process.argv.includes('--check')) {
  if (next === src) { console.log('  ✅ pop-line DATA 區塊與 data/pop-line/*.json 同步'); process.exit(0); }
  console.error('  ❌ pop-line DATA 區塊漂移:跑 node scripts/pop-line-gen-data.mjs 重產'); process.exit(1);
}
writeFileSync(file, next);
console.log(`  🔧 DATA 區塊已重寫:${Object.keys(CAT).length} 支產品、${Object.values(VID.lines).flat().length} 支影片、歡迎包 ${WELCOME.length} 則、指令 ${Object.keys(DIR.turn).length} 組`);
