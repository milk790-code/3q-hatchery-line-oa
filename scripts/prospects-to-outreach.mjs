#!/usr/bin/env node
// 橋接:PROSPECTS.md(陌開名單正本,#34 建)→ 3q-outreach /admin/import 格式(#35 引擎)
// 用法:
//   node scripts/prospects-to-outreach.mjs                      # 輸出 {leads:[...]}(stdout)
//   node scripts/prospects-to-outreach.mjs --post <workerURL>   # 直接匯入線上(--key 可覆寫,預設 worker 內建常數)
// 映射鐵則(誠實層):
//   - src = `${池}#${編號}`(同 prospects 表的 (pool,list_no) 鍵,兩套 CRM 互查)→ worker 端 upsert,重跑安全
//   - area:縣市由「縣市/區」欄判定,判不出留原文,不編造
//   - biz:A 池=car;B/C 池僅在名稱/門面/切角含餐飲關鍵字時標 food,其餘 other(不猜)
//   - founded_year:只在門面/切角明寫「20XX 新開/開幕/試營運/遷址/創立/設立」時抓年份,否則留空
//   - ig:只抓門面欄明寫的 @handle
//   - note 帶 [池#編號|★信心] 門面|切角 → 每日卡片的預熱情報就是它
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CITIES = ['台北', '新北', '桃園', '台中', '台南', '高雄', '基隆', '新竹', '苗栗', '彰化', '南投', '雲林', '嘉義', '屏東', '宜蘭', '花蓮', '台東', '澎湖', '金門', '連江'];
// C 池「出沒市集」欄常只寫市集名;以下場域依 PROSPECTS.md 批次說明皆為台中(審計新村/草悟道/勤美/台中刑務所/捷運松竹站/北屯遼陽)
const TAICHUNG_VENUE_RE = /審計新村|草悟道|勤美|小蝸牛|刑務所|居市森駅|暮暮市集|Chill Hi|遼陽/;
const FOOD_RE = /咖啡|珈琲|茶|麵|便當|甜點|地瓜|奶茶|飯糰|onigiri|鍋|餐|食|冰|蛋糕|蛋捲|雞蛋仔|麵包|烘豆|自烘|可頌|火鍋|臭臭鍋|奶|飲|甜品|外燴|私廚/;

export function parseProspects(md) {
  const lines = md.split('\n');
  let batch = 1, pool = null;
  const leads = [];
  for (const line of lines) {
    const bm = line.match(/^## 批次(\d+)/);
    if (bm) { batch = parseInt(bm[1], 10); pool = null; continue; }
    const pm = line.match(/^#{2,3} ([ABC]) 池/);
    if (pm) { pool = pm[1]; continue; }
    if (/^#{2,3} /.test(line)) { pool = null; continue; }
    const rm = line.match(/^\|\s*(\d+)\s*\|/);
    if (!rm || !pool) continue;
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 8) { console.error(`⚠ 欄位數不對,跳過: ${line.slice(0, 60)}`); continue; }
    const [, no, name, district, online, why, conf] = cells;
    const stars = Math.min(Math.max((conf.match(/★/g) || []).length, 1), 3);
    const hay = `${name} ${online} ${why}`;

    const city = CITIES.find((c) => district.includes(c)) || (TAICHUNG_VENUE_RE.test(district) ? '台中' : null);
    const ig = (online.match(/@([A-Za-z0-9._]+)/) || [])[1] || '';
    const ym = hay.match(/(20\d{2})[\/\s年.]*\d*\s*月?\s*[^,。)]{0,6}?(新開|開幕|試營運|遷址|創立|設立)/);
    const founded_year = ym ? parseInt(ym[1], 10) : undefined;
    const biz = pool === 'A' ? 'car' : (FOOD_RE.test(hay) ? 'food' : 'other');

    leads.push({
      src: `${pool}#${no}`,
      name, pool, batch,
      ...(ig ? { ig } : {}),
      ...(pool === 'A' ? { store_type: '汽車美容' } : {}),
      ...(founded_year ? { founded_year } : {}),
      area: city || district,
      biz,
      note: `[${pool}#${no}|★${stars}] ${online}|${why}`.slice(0, 200),
    });
  }
  return leads;
}

// ── CLI ──
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] || true) : null; };
  const mdPath = args.find((a) => a.endsWith('.md')) || join(dirname(fileURLToPath(import.meta.url)), '..', 'PROSPECTS.md');
  const leads = parseProspects(readFileSync(mdPath, 'utf8'));

  const summary = {}; const seen = new Set(); let dup = 0;
  for (const l of leads) {
    if (seen.has(l.src)) { console.error(`⚠ 重複編號 ${l.src}: ${l.name}`); dup++; }
    seen.add(l.src);
    summary[`${l.pool}池`] = (summary[`${l.pool}池`] || 0) + 1;
  }
  console.error(`共 ${leads.length} 筆${dup ? `(⚠ 重複 ${dup})` : ''}:`, JSON.stringify(summary));
  if (dup) process.exit(1);

  const post = flag('--post');
  if (post && post !== true) {
    const key = (flag('--key') && flag('--key') !== true) ? flag('--key') : (process.env.OUTREACH_ADMIN_KEY || ''); // 從環境變數讀，不硬編
    const resp = await fetch(`${String(post).replace(/\/$/, '')}/admin/import?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leads }),
    });
    console.log(await resp.text());
    if (!resp.ok) process.exit(1);
  } else {
    console.log(JSON.stringify({ leads }, null, 1));
  }
}
