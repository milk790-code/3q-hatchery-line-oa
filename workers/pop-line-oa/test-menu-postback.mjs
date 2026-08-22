// v5.3 圖文選單 postback + 店家健檢流 — 本地驗證 harness(零依賴,部署前跑一次)
// 用法:cd workers/pop-line-oa && node test-menu-postback.mjs
// 覆蓋:①postback 不再被丟棄、會走完整管線 ②選單鈕帶本輪指令進大腦 ③分頁切換靜默(只第一次打招呼)
//      ④健檢流三題一次一題、第四輪算帳、跑完自動結束 ⑤店家登記表回傳當場推老闆
//      ⑥批發鈕明確禁止報價 ⑦點選單=秒回不延遲 ⑧選單點擊逐鈕落庫 ⑨已升級客戶不被選單降級
import worker from './worker.js';

const kv = new Map();
const d1rows = { taps: [], profiles: new Map() };
// 極簡 D1 mock:只認本測試會用到的幾條 SQL 形狀
const CRM = {
  prepare(sql) {
    const st = {
      _b: [],
      bind(...a) { st._b = a; return st; },
      async run() {
        if (sql.includes('INSERT INTO pop_line_menu_taps')) d1rows.taps.push({ user_id: st._b[0], data: st._b[1] });
        if (sql.includes('INSERT INTO customer_profiles')) {
          const [sid, industry, grade] = st._b;
          const prev = d1rows.profiles.get(sid) || {};
          d1rows.profiles.set(sid, { ...prev, industry: industry || prev.industry, grade });
        }
        return {};
      },
      async first() {
        if (sql.includes('SELECT grade FROM customer_profiles')) return d1rows.profiles.get(st._b[0]) || null;
        return { n: 0 };
      },
      async all() { return { results: [] }; },
    };
    return st;
  },
};
const env = {
  SESSION: { get: async (k) => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, v); } },
  CRM, AI: null, AB_TEST: 'off', READ_DELAY: 'off', QUIET_MODE: 'off',
  POP_LINE_SECRET: 'testsecret', POP_LINE_TOKEN: 'testtoken', ANTHROPIC_API_KEY: 'sk-test',
};
const pending = [];
const ctx = { waitUntil: (p) => pending.push(p) };

const calls = { reply: [], push: [], brain: [] };
let brainText = () => '好的,我幫你看。';
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('api.anthropic.com')) {
    const body = JSON.parse(opts.body);
    calls.brain.push(body);
    return new Response(JSON.stringify({ content: [{ type: 'text', text: brainText(body) }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (u.includes('/v2/bot/message/reply')) { calls.reply.push(JSON.parse(opts.body)); return new Response('{}'); }
  if (u.includes('/v2/bot/message/push')) { calls.push.push(JSON.parse(opts.body)); return new Response('{}'); }
  return new Response('{}');
};

async function sig(body) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.POP_LINE_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Buffer.from(new Uint8Array(mac)).toString('base64');
}
async function send(events) {
  const body = JSON.stringify({ events });
  const res = await worker.fetch(new Request('https://x.test/webhook', { method: 'POST', body, headers: { 'x-line-signature': await sig(body) } }), env, ctx);
  if (res.status !== 200) throw new Error('webhook ' + res.status);
  await Promise.all(pending.splice(0));
}
const msg = (uid, text) => ({ type: 'message', replyToken: 'rt', source: { userId: uid, type: 'user' }, message: { type: 'text', text } });
const tap = (uid, data) => ({ type: 'postback', replyToken: 'rt', source: { userId: uid, type: 'user' }, postback: { data } });
const lastBrain = () => calls.brain[calls.brain.length - 1];
const directive = () => (lastBrain()?.system?.[1]?.text || '');
const sess = (uid) => JSON.parse(kv.get('popline:' + uid) || 'null');
const replies = () => calls.reply.length;
const lastUserPushText = (uid) => [...calls.push].reverse().find((c) => c.to === uid)?.messages?.[0]?.text || '';

let passed = 0, failed = 0;
function ok(cond, name) { if (cond) { passed++; console.log('  ✅', name); } else { failed++; console.error('  ❌', name); } }
kv.set('cfg:pop_owner', 'OWNER_UID');

console.log('\n── ① postback 不再被靜默丟棄 ──');
const before = replies();
await send([tap('U_car', 'm=car&b=pick')]);
ok(replies() > before, '① 車主選單鈕有回覆(舊版 postback 直接 return,等於死鈕)');
ok(sess('U_car')?.hist?.some((h) => h.role === 'user' && h.content.includes('我的車該用什麼')), '① 合成訊息進了對話歷史(CRM/[STATE] 鏈才會生效)');

console.log('\n── ② 選單鈕把本輪指令送進大腦 ──');
ok(directive().includes('一次只問一件事'), '② 選品鈕的 directive 送達');
ok(lastBrain().system.length === 2 && lastBrain().system[0].cache_control, '② 主 system 塊仍掛 cache_control(prompt cache 沒破)');

console.log('\n── ③ 分頁切換:第一次打招呼,之後靜默 ──');
const b3 = replies();
await send([tap('U_tab', 'm=tab&b=shop')]);
ok(replies() === b3 + 1, '③ 第一次切到店家專區:回一則引導');
const brainBefore = calls.brain.length;
await send([tap('U_tab', 'm=tab&b=shop')]);
ok(replies() === b3 + 1, '③ 第二次切換:靜默不回(不洗版)');
ok(calls.brain.length === brainBefore, '③ 分頁切換完全不打 AI(不花錢)');
ok(d1rows.profiles.get('U_tab')?.industry === '汽美店家', '③ 切到店家分頁=B2B 訊號已落庫');

console.log('\n── ④ 健檢流:一次一題,第四輪算帳,跑完結束 ──');
await send([tap('U_shop', 'm=shop&b=audit')]);
ok(directive().includes('第 1 題') && directive().includes('一個月大概洗多少台車'), '④ 第1題');
ok(sess('U_shop').flow?.step === 1, '④ 問完第1題 step=1');
await send([msg('U_shop', '一個月大概 120 台')]);
ok(directive().includes('第 2 題') && directive().includes('撐多久'), '④ 第2題');
await send([msg('U_shop', '大概撐兩個月就沒了')]);
ok(directive().includes('第 3 題') && directive().includes('客人不回頭'), '④ 第3題');
await send([msg('U_shop', '最痛的是客人不回頭')]);
ok(directive().includes('用他自己講過的數字') && directive().includes('不准自己編任何數字'), '④ 第4輪=算帳收尾,且明文禁止編數字');
ok(directive().includes('popcard-saas-preview.milk790.workers.dev/s/jilin'), '④ 收尾帶 POP CARD 定版展示連結');
await send([msg('U_shop', '好啊')]);
ok(sess('U_shop').flow === null || sess('U_shop').flow === undefined, '④ 算帳跑完流程自動結束,不會卡住');
ok(!directive().includes('第 1 題'), '④ 結束後不再重問第1題');

console.log('\n── ⑤ 店家登記表回傳:當場推老闆 ──');
await send([msg('U_join', '店名：泡泡鴨\n城市：高雄\n最想解決：客人不回頭')]);
ok(lastUserPushText('OWNER_UID').includes('有店家登記了'), '⑤ 不等 grade 升 A,登記當下就推老闆');
ok(lastUserPushText('OWNER_UID').includes('泡泡鴨'), '⑤ 推播內容帶著店家填的原文');
ok(directive().includes('逐項複誦'), '⑤ 本輪指令改為確認登記內容');

console.log('\n── ⑥ 母料批發鈕:明文禁止報價(價目表未定版)──');
await send([tap('U_wh', 'm=shop&b=wholesale')]);
ok(directive().includes('絕對不報任何批發價數字'), '⑥ 批發鈕硬性禁止報價');
ok(directive().includes('聯絡') && directive().includes('月'), '⑥ 改成收品項+月用量+聯絡方式');

console.log('\n── ⑦ 點選單=秒回(人在等,不走延遲 push)──');
const pushBefore = calls.push.filter((c) => c.to === 'U_rush').length;
await send([tap('U_rush', 'm=car&b=howto')]);
ok(calls.push.filter((c) => c.to === 'U_rush').length === pushBefore, '⑦ 走 reply 秒回,沒有延遲 push');

console.log('\n── ⑧ 逐鈕點擊落庫(官方 insight <20 人不給數據,只能自記)──');
ok(d1rows.taps.some((t) => t.data === 'm=shop&b=audit'), '⑧ 健檢鈕點擊有進台帳');
ok(d1rows.taps.filter((t) => t.data === 'm=tab&b=shop').length === 2, '⑧ 靜默的分頁切換也照記(含第二次)');

console.log('\n── ⑨ 已升級客戶不會被選單點擊降級 ──');
d1rows.profiles.set('U_vip', { grade: 'A', industry: '汽美店家' });
await send([tap('U_vip', 'm=tab&b=shop')]);
ok(d1rows.profiles.get('U_vip').grade === 'A', '⑨ A 級客人點選單後仍是 A(不被覆寫成 B)');

console.log('\n── ⑩ 未知 postback 不炸 ──');
await send([tap('U_x', 'm=bogus&b=nope')]);
ok(true, '⑩ 未知 data 安全略過,沒有拋例外');

console.log(failed === 0 ? `\n🟢 ${passed} passed, 0 failed\n` : `\n🔴 ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
