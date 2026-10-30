// AI 店員 B 版揭露 — 本地驗證 harness(零依賴,部署前跑一次)
// 用法:cd workers/pop-line-oa && node test-b-disclosure.mjs
// 覆蓋:①follow歡迎=第1句揭露 ②冷啟動第1句機械揭露 ③第10句交接檢查點(一次性,推播老闆)
//      ④喊真人即交接 ⑤大腦掛掉→降級話術+老闆警示 ⑥舊版陣列session相容(不重複揭露) ⑦prompt cache主塊字節穩定
import { readFileSync } from 'node:fs';
import worker from './worker.js';

const kv = new Map();
const env = {
  SESSION: { get: async (k) => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, v); } },
  CRM: null, AI: null, QUIET_MODE: 'off',   // 固定關深夜模式:否則測試結果會跟著跑測試的時刻變(深夜會多一句 turn 指令)
  POP_LINE_SECRET: 'testsecret', POP_LINE_TOKEN: 'testtoken', ANTHROPIC_API_KEY: 'sk-test',
};
const pending = [];
const ctx = { waitUntil: (p) => pending.push(p) };

const calls = { reply: [], push: [], brain: [] };
let replyFail = 0;   // >0:接下來這麼多次 reply 回 400(測歡迎包被拒 → 退回純文字備援)
let brainText = () => '收到,我幫你看。';
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('api.anthropic.com')) {
    const body = JSON.parse(opts.body);
    calls.brain.push(body);
    return new Response(JSON.stringify({ content: [{ type: 'text', text: brainText(body) }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (u.includes('/v2/bot/message/reply')) { calls.reply.push(JSON.parse(opts.body)); if (replyFail > 0) { replyFail--; return new Response('{"message":"bad"}', { status: 400 }); } return new Response('{}'); }
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
const msg = (uid, text) => ({ type: 'message', replyToken: 'rt', source: { userId: uid }, message: { type: 'text', text } });
const lastReply = () => (calls.reply[calls.reply.length - 1].messages.find((m) => m.type === 'text') || {}).text || '';   // v6:加好友第一則是價格表圖,取第一則文字
const lastBrain = () => calls.brain[calls.brain.length - 1];
const sess = (uid) => JSON.parse(kv.get('popline:' + uid));

let passed = 0, failed = 0;
function ok(cond, name) { if (cond) { passed++; console.log('  ✅', name); } else { failed++; console.error('  ❌', name); } }

const DISCLOSE = '我是超級 AI 人工客服';
// 揭露句逐字原文(含「您」)直接從 worker 原始碼 AI_EMPLOYEE 抓:斷言跟著它走,不跟著 data/pop-line/oa.json 的行銷文案走(資料換版這幾條不能變紅)
const DISCLOSURE_FULL = (readFileSync(new URL('./worker.js', import.meta.url), 'utf8').match(/disclosure_script:\s*'([^']*)'/) || [])[1] || '';
const stripDisclosure = (t) => t.split(DISCLOSURE_FULL).join('');
const lastUserPushText = (uid) => [...calls.push].reverse().find((call) => call.to === uid)?.messages?.[0]?.text || '';
kv.set('cfg:pop_owner', 'OWNER_UID');

// ① follow:歡迎包(WELCOME_PACK;資料是什麼就是什麼)——第一則文字必須含揭露句原文,session 標記已揭露
await send([{ type: 'follow', replyToken: 'rt', source: { userId: 'U_follow' } }]);
ok(DISCLOSURE_FULL.startsWith(DISCLOSE) && DISCLOSURE_FULL.includes('您'), '① 抓得到 AI_EMPLOYEE.disclosure_script 逐字原文');
ok(lastReply().includes(DISCLOSURE_FULL), '① follow 歡迎詞(第一則文字)含 AI 揭露句原文');
ok(sess('U_follow').dc === true, '① follow 後 session dc=true');
{ const w = lastReply();
  ok(w.includes('店家'), '①b 歡迎詞指路店家(店家專區/店家老闆)');
  ok(!/30 秒|只收 10 家|864|5\.0 分/.test(w), '①b 沒有未查證數字(30 秒/只收 10 家/864 則評價/5.0 分)');
  ok(!stripDisclosure(w).includes('您'), '①b 揭露句以外的歡迎詞不用「您」(用「你」)');
  ok(!/popmonster\.vip\/go(?!\?src=[a-z0-9-]+)/.test(w), '①b 歡迎詞若帶 /go 連結,一定帶 src(否則追蹤被靜默丟掉;沒帶連結也算過,連結由資料決定)');
  ok(!/免繳費|免費體驗/.test(w), '①b 不寫「免繳費」——條件未定義,寫了就是空頭支票'); }

// ①c 歡迎包被 LINE 拒(reply 400)→ 退回純文字 WELCOME_MSG:這條備援文案寫在 worker 裡(不隨資料變),用原本的嚴格斷言守住
replyFail = 1;
await send([{ type: 'follow', replyToken: 'rt', source: { userId: 'U_follow_fb' } }]);
replyFail = 0;
{ const w = lastReply();
  ok(calls.reply.length >= 2 && w.startsWith(DISCLOSE), '①c 歡迎包被拒 → 退回純文字,第一句仍是 AI 揭露(法遵不能被行銷文案擠掉)');
  ok(w.includes('店家老闆'), '①c 備援歡迎詞指路店家專區');
  ok(w.includes('限量體驗名額') && w.includes('一個月少賺多少錢'), '①c 備援歡迎詞帶上店家亮點');
  ok(!/30 秒|只收 10 家|864|5\.0 分/.test(w), '①c 備援歡迎詞沒有未查證數字');
  ok(!stripDisclosure(w).includes('您'), '①c 備援歡迎詞揭露句以外不用「您」');
  ok(w.includes('src=line-free-first'), '①c 備援歡迎詞 /go 連結帶白名單內的 src');
  ok(!/免繳費|免費體驗/.test(w), '①c 備援歡迎詞不寫「免繳費」'); }

// ① 後續:已揭露者不重複(once)
await send([msg('U_follow', '鍍膜怎麼選')]);
ok(!lastReply().startsWith(DISCLOSE), '① 已揭露者第2句不重複揭露');

// ② 冷啟動(沒走 follow):第1句機械式揭露前綴
await send([msg('U_cold', '請問拋光劑')]);
ok(lastReply().startsWith(DISCLOSE), '② 冷啟動第1句機械揭露');
ok(lastBrain().system.length === 2 && /第一次對話|對話的第一句/.test(lastBrain().system[1].text), '② 首句 turn directive 送達大腦(預設或資料版 first_intro 皆可)');
ok(sess('U_cold').dc === true && sess('U_cold').n === 1, '② session n/dc 正確');

// ③ 推到第10句:交接檢查點(directive+推播老闆+一次性)
const sys0 = lastBrain().system[0].text;
for (let i = 2; i <= 9; i++) await send([msg('U_cold', '問題' + i)]);
ok(lastBrain().system.length === 1, '③ 第2~9句無多餘 directive');
ok(lastBrain().system[0].text === sys0, '⑦ 主 system 塊字節穩定(prompt cache 不破)');
const ownerPushBefore = calls.push.filter((call) => call.to === 'OWNER_UID').length;
await send([msg('U_cold', '問題10')]);
ok(lastBrain().system.length === 2 && lastBrain().system[1].text.includes('交接檢查點'), '③ 第10句觸發交接 directive');
ok(calls.push.filter((call) => call.to === 'OWNER_UID').length === ownerPushBefore + 1, '③ 交接推播老闆');
ok(sess('U_cold').ho === true, '③ 檢查點標記一次性 ho=true');
await send([msg('U_cold', '問題11')]);
ok(lastBrain().system.length === 1, '③ 第11句不重複觸發檢查點');

// ④ 喊真人:任何時點即交接
const pushBefore2 = calls.push.length;
await send([msg('U_follow', '我要找真人')]);
ok(lastBrain().system.length === 2 && lastBrain().system[1].text.includes('客人要求真人'), '④ 喊真人觸發交接 directive');
ok(calls.push.length === pushBefore2 + 1, '④ 喊真人推播老闆');

// ⑤ 大腦掛掉:降級話術+老闆警示(冷啟動同時驗證揭露前綴仍在)
brainText = () => '';
const pushBefore3 = calls.push.length;
await send([msg('U_degraded', '在嗎')]);
const degradedUserText = lastUserPushText('U_degraded') || lastReply();
ok(degradedUserText.includes('我現在訊號不太穩'), '⑤ 降級話術不裝死');
ok(lastReply().startsWith(DISCLOSE) || degradedUserText.startsWith(DISCLOSE), '⑤ 降級時首句或墊場先完成揭露');
ok(calls.push.length >= pushBefore3 + 1 && calls.push.some((call) => call.to === 'OWNER_UID' && call.messages[0].text.includes('降級')), '⑤ 降級警示推播老闆');
brainText = () => '收到,我幫你看。';

// ⑥ 舊版陣列 session:視同已揭露,不重複
kv.set('popline:U_legacy', JSON.stringify([{ role: 'user', content: '舊' }, { role: 'assistant', content: '舊回' }]));
await send([msg('U_legacy', '繼續聊')]);
ok(!lastReply().startsWith(DISCLOSE), '⑥ 舊版 session 不重複揭露');
ok(sess('U_legacy').n === 2 && Array.isArray(sess('U_legacy').hist), '⑥ 舊版 session 升級為新結構');

console.log(`\n${failed === 0 ? '🟢' : '🔴'} ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
