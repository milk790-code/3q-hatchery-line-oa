// 陌開引擎 — 數字誠實層驗證(零依賴,部署前跑一次)
// 用法:cd workers/outreach && node test-outreach.mjs
// 重點:每個寫進話術的金額都要能回溯到目錄;A池非台中店加總必須=83(實戰包 v3 期望值「80幾萬」的出處)
import { CATALOG, matchSubsidies, buildOpener, composeDailyCard, enrichLead, d3Copy, d7Copy, referralCopy } from './worker.js';

let passed = 0, failed = 0;
function ok(cond, name, extra) { if (cond) { passed++; console.log('  ✅', name); } else { failed++; console.error('  ❌', name, extra ?? ''); } }

// ① A池/台中/汽美/經營中:digital10+cloudmkt+local_sbir = 113 萬
const a1 = matchSubsidies({ stage: 'mid', biz: 'car', area: '台中' });
ok(a1.total === 113, '① A池台中汽美加總 113 萬', a1.total);
ok(a1.top3.map((s) => s.id).join() === 'digital10,cloudmkt,local_sbir', '① top3 依易度排序', a1.top3.map((s) => s.id));

// ② A池/非台中/汽美:digital10+cloudmkt+siir = 83 萬(=「80幾萬」)
const a2 = matchSubsidies({ stage: 'mid', biz: 'car', area: '彰化' });
ok(a2.total === 83, '② A池非台中加總 83 萬(對上期望值 80幾萬)', a2.total);

// ③ B池/新店/餐飲:有 siir,貸款含青創
const b1 = matchSubsidies({ stage: 'new', biz: 'food', area: '台北', founded_year: 2025 });
ok(b1.top3.some((s) => s.id === 'siir'), '③ B池餐飲含 SIIR');
ok(b1.loans.some((s) => s.id === 'youth'), '③ B池貸款含青創');

// ④ 設立滿 5 年 → 青創貸款排除(within_years)
const old5 = matchSubsidies({ stage: 'mid', biz: 'food', area: '台中', founded_year: 2019 });
ok(!old5.loans.some((s) => s.id === 'youth'), '④ 滿 5 年青創排除');

// ⑤ idea 階段:無補助加總,開場不得出現「最高可達 0 萬」
const idea = matchSubsidies({ stage: 'idea', biz: 'other', area: '台中' });
ok(idea.total === 0, '⑤ idea 階段補助加總 0');
const openerIdea = buildOpener({ pool: 'B' }, idea);
ok(!openerIdea.includes('0 萬'), '⑤ 總額 0 時開場不吹數字', openerIdea);

// ⑥ 開場模板:A池帶米速身分+數字;B池帶設立年限切角
const lead = enrichLead({ name: '測試汽美', pool: 'A', store_type: '汽車美容', area: '台中' });
ok(lead.opener.includes('米速') && lead.opener.includes('113 萬'), '⑥ A池開場含米速+可稽核數字', lead.opener);
ok(lead.total_wan === 113 && lead.variant === 'A1', '⑥ enrich 計算入庫欄位');
const leadB = enrichLead({ name: '測試新店', pool: 'B', biz: 'food', founded_year: 2025, area: '高雄' });
ok(leadB.stage === 'new' && leadB.opener.includes('青創'), '⑥ B池 stage 推斷+青創切角');

// ⑦ 序列文案:D3 引用 top1 計畫名;D7 引用該店自己的總額(不編第三方故事)
const row = { ...lead, id: 7, top3: lead.top3, total_wan: lead.total_wan };
ok(d3Copy(row).includes('30 人以下數位轉型培力補助'), '⑦ D3 引用 top1 計畫名');
ok(d7Copy(row).includes('113 萬') && d7Copy(row).includes('不再打擾'), '⑦ D7 用自家數字+走人式收尾');
ok(referralCopy(row).includes('#7') && referralCopy(row).includes('lin.ee'), '⑦ 轉介話術帶 #編號歸因');

// ⑧ 每日卡片:15 家 → 訊息數 ≤ 推播上限可分批(首則含追蹤表連結;預熱清單成段)
const many = Array.from({ length: 15 }, (_, i) => ({ ...row, id: i + 1, name: '店' + (i + 1) }));
const warm = Array.from({ length: 15 }, (_, i) => ({ id: 100 + i, name: '預熱' + i, ig: 'ig' + i }));
const msgs = composeDailyCard(many, warm, 'https://x/board');
ok(msgs.length === 5 && msgs[0].includes('https://x/board') && msgs[4].includes('預熱清單'), '⑧ 卡片分段 5 則(1頭+3批+1預熱)', msgs.length);
ok(msgs.every((m) => m.length < 4900), '⑧ 每則 < LINE 5000 字上限');

// ⑨ 目錄健全:每筆補助都有 store_cap_wan 與 hook(話術數字源頭)
ok(CATALOG.every((s) => s.store_cap_wan > 0 && s.hook && s.type), '⑨ 目錄欄位完整(' + CATALOG.length + ' 筆)');

console.log(`\n${failed === 0 ? '🟢' : '🔴'} ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
