// v6 談單升級 — 本地驗證 harness(零依賴,部署前跑一次)
// 用法:cd workers/pop-line-oa && node test-v6.mjs
// 覆蓋:①加好友第一則是價格表圖 ②[PROD] 標籤→蝦皮產品卡 ③別名備援 ④同 SKU 3 輪內不重發 ⑤成交意圖無產品→蝦皮賣場卡
//      ⑥[VID] 標籤→影片/合集、同線不重發 ⑦貼圖限流(每 3 則 1 次、每日 2 次) ⑧價格表鈕/影片鈕直回不經大腦
//      ⑨videoPlayComplete 落庫 ⑩/admin/card、/img/pricelist 代理、/health 計數 ⑪標籤在客人看到的字裡剝乾淨 ⑫逐輪指令注入
// v6.1 reply-first 覆蓋:⑬文字訊息不送文字墊場、main job 帶 replyToken、alarm 內 50 秒用 reply、reply 400 才 push、token 過期直接 push
//      ⑬c DO alarm 送信期間新排進的 job 不被覆蓋 ⑭延遲範圍/45 秒上限/4 秒間隔 ⑮深夜也 reply ⑯ACK_TEXT on 舊行為 ⑰照片一次 reply ⑱價格表直回+一天一次 ⑲事件去重
//      ⑳新指令接線(ordered/result_share/returning/hesitation/price_mismatch/wholesale/turn_rx)+貼圖時刻 ㉑全檔「您」只在 AI_EMPLOYEE 區塊
// v6.1 追加(反駁席 8 條):㉒DO ack 排序(ack<main、各自上限、lastNB 取 max、隔天殘留當 0) ㉓價格表直回讓位(交接檢查點/店家線/批發報價單) ㉔老闆推播合併+每日上限
//      ㉕多張照片合併(1 次視覺/1 次 reply/0 push、上限 4 張、不同客人各自處理) ㉖蝦皮連結帶 openExternalBrowser=1 ㉗照片輪補 last_seen ㉘文案事實全檔 grep
import { readFileSync } from 'node:fs';
import worker, { DelayReplyDO, DIRECTIVES } from './worker.js';

// 可撥快的時鐘:DO alarm 用 Date.now() 判斷 50 秒 reply 窗口,測試靠 clock 位移模擬時間經過
let clock = 0;
const _now = Date.now.bind(Date);
Date.now = () => _now() + clock;

const kv = new Map();
const taps = [];
const CRM = {
  prepare(sql) {
    const st = { _b: [], bind(...a) { st._b = a; return st; },
      async run() { if (sql.includes('INSERT INTO pop_line_menu_taps')) taps.push({ user_id: st._b[0], data: st._b[1] }); return {}; },
      async first() {
        if (sql.includes('SELECT grade FROM customer_profiles')) return null;
        if (sql.includes('FROM pop_line_menu_taps')) { const [uid, data] = st._b.length > 1 ? st._b : [st._b[0], 'm=tab&b=shop']; return { n: taps.filter((t) => t.user_id === uid && t.data === data).length }; }
        return { n: 0 };
      },
      async all() { return { results: [] }; } };
    return st;
  },
};
const env = {
  SESSION: { get: async (k) => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, v); } },
  CRM, AI: null, AB_TEST: 'off', READ_DELAY: 'off', QUIET_MODE: 'off', SETUP_KEY: 'testkey',
  POP_LINE_SECRET: 'testsecret', POP_LINE_TOKEN: 'testtoken', ANTHROPIC_API_KEY: 'sk-test',
};
const pending = []; const ctx = { waitUntil: (p) => pending.push(p) };
const calls = { out: [], brain: [], upstream: [], misc: [] };
let brainText = () => '好的,我幫你看。';
let replyOk = true;
let onReply = null;   // 測試用:reply 送出途中插入一段動作(模擬 DO 對外 fetch 期間有新事件進來)
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('api.anthropic.com')) { const body = JSON.parse(opts.body); calls.brain.push(body); return new Response(JSON.stringify({ content: [{ type: 'text', text: brainText(body) }] }), { status: 200, headers: { 'content-type': 'application/json' } }); }
  if (u.includes('/v2/bot/message/reply')) { const b = JSON.parse(opts.body); calls.out.push({ kind: 'reply', to: null, replyToken: b.replyToken, messages: b.messages }); if (onReply) { const f = onReply; onReply = null; await f(); } return new Response(replyOk ? '{}' : '{"message":"bad"}', { status: replyOk ? 200 : 400 }); }
  if (u.includes('/v2/bot/message/push')) { const b = JSON.parse(opts.body); calls.out.push({ kind: 'push', to: b.to, messages: b.messages }); return new Response('{}'); }
  if (u.includes('/chat/markAsRead') || u.includes('/chat/loading/start')) { calls.misc.push({ url: u, body: JSON.parse(opts.body) }); return new Response('{}'); }
  if (u.includes('milk790-code.github.io')) { calls.upstream.push(u); return new Response(new Uint8Array([0xff, 0xd8, 0xff]), { status: 200, headers: { 'content-type': 'application/octet-stream' } }); }
  return new Response('{}');
};
async function sig(body) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.POP_LINE_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Buffer.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))).toString('base64');
}
async function send(events, e = env) {
  const body = JSON.stringify({ events }); const mark = calls.out.length;
  const res = await worker.fetch(new Request('https://x.test/webhook', { method: 'POST', body, headers: { 'x-line-signature': await sig(body) } }), e, ctx);
  if (res.status !== 200) throw new Error('webhook ' + res.status);
  await Promise.all(pending.splice(0));
  return calls.out.slice(mark);
}
const msg = (uid, text) => ({ type: 'message', replyToken: 'rt', source: { userId: uid, type: 'user' }, message: { type: 'text', text } });
const tap = (uid, data) => ({ type: 'postback', replyToken: 'rt', source: { userId: uid, type: 'user' }, postback: { data } });
// 主回覆=這次 webhook 產生的最後一批給客人的訊息(墊場是第一批、主回覆是最後一批)
const main = (batch, uid) => { const mine = batch.filter((c) => c.kind === 'reply' || c.to === uid); return mine.length ? mine[mine.length - 1].messages : []; };
const types = (ms) => ms.map((m) => m.type).join(',');
const flexes = (ms) => ms.filter((m) => m.type === 'flex');
const flexStr = (ms) => JSON.stringify(flexes(ms));
const sess = (uid) => JSON.parse(kv.get('popline:' + uid) || 'null');
const lastDirective = () => (calls.brain[calls.brain.length - 1]?.system?.[1]?.text || '');
const admin = async (path) => { const r = await worker.fetch(new Request('https://x.test' + path), env, ctx); return { status: r.status, ct: r.headers.get('content-type') || '', body: await r.text() }; };

const taipeiYmd = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
let passed = 0, failed = 0;
function ok(cond, name) { if (cond) { passed++; console.log('  ✅', name); } else { failed++; console.error('  ❌', name); } }
kv.set('cfg:pop_owner', 'OWNER_UID');

console.log('\n── ① 加好友第一時間:價格表圖第一則、介紹跟著來 ──');
let b = await send([{ type: 'follow', replyToken: 'rt', source: { userId: 'U_new', type: 'user' } }]);
let ms = main(b, 'U_new');
ok(b.length >= 1 && b[0].kind === 'reply', '① 用 reply token 回(免費),不是 push');
ok(ms[0]?.type === 'image' && /pricelist/.test(ms[0].originalContentUrl) && /pricelist/.test(ms[0].previewImageUrl), '① 第一則是價格表圖(原圖+預覽圖都指向價格表)');
ok(ms.length <= 5, '① 一次 reply 不超過 5 則(LINE 硬限制)');
ok(ms.slice(0, 2).every((m) => m.type === 'image' && /pricelist-1105c-[12]\.jpg$/.test(m.originalContentUrl)) && ms.some((m) => m.type === 'text'), '① A3 菜單對半兩張 A4 在前、介紹文字一定在(貼圖讓位給 5 則上限)');
ok(ms.some((m) => m.type === 'text' && /AI|人工客服|泡泡怪獸/.test(m.text)), '① 介紹文含 AI 揭露或品牌自稱');
ok(sess('U_new')?.dc === true && sess('U_new')?.pl === true, '① session 標記已揭露 + 已送價格表');
ok(kv.has('pl:U_new:' + taipeiYmd()), '① 加好友送過價格表 → 記當天 pl 鍵(之後打「價格表」不重發圖)');
replyOk = false; b = await send([{ type: 'follow', replyToken: 'rt', source: { userId: 'U_new2', type: 'user' } }]); replyOk = true;
ok(b.filter((c) => c.kind === 'reply').length === 2 && b[1].messages[0].type === 'text', '① 歡迎包被 LINE 拒 → 退回純文字再試一次,新好友不空手');
ok(sess('U_new2')?.pl === false, '① 退回純文字時不標「已送價格表」,之後大腦會補');

console.log('\n── ② 模型標 [PROD] → 蝦皮產品卡 ──');
brainText = () => '拾號是鏡面收尾用的,配黑色鏡面盤。[PROD]A005[/PROD]';
b = await send([msg('U_p', '拾號是幹嘛的')]); ms = main(b, 'U_p');
ok(flexes(ms).length === 1, '② 主回覆附一張 Flex 產品卡');
ok(/40213627112/.test(flexStr(ms)) && /shopee\.tw/.test(flexStr(ms)), '② 卡上「蝦皮購買」連到該商品的蝦皮頁(不是官網)');
ok(/拾號/.test(flexStr(ms)), '② 卡上品名正確');
ok(!/\[PROD\]|\[\/PROD\]/.test(ms[0].text), '② 客人看到的文字裡沒有 [PROD] 標籤殘留');
ok(sess('U_p')?.pc?.A005 === sess('U_p')?.n, '② session 記下這張卡發在第幾句(3 輪內不重發)');

console.log('\n── ③ 模型沒標、客人直接點名 → 別名備援 ──');
brainText = () => '天使塗層洗完車直接噴,濕上濕下。';
b = await send([msg('U_a', '天使塗層多少錢')]); ms = main(b, 'U_a');
ok(flexes(ms).length === 1 && /40055380374/.test(flexStr(ms)), '③ 別名「天使塗層」命中 A001,附蝦皮卡');
ok(/【產品詢問】/.test(lastDirective()) && /A001/.test(lastDirective()), '⑫ 逐輪指令注入:產品詢問 + 命中 SKU 代入');

console.log('\n── ④ 同一支 3 輪內不重發、第 4 輪可以再發 ──');
b = await send([msg('U_a', '天使塗層真的有用嗎')]); ms = main(b, 'U_a');
ok(flexes(ms).length === 0, '④ 第 2 句同一支不重發(避免洗版)');
await send([msg('U_a', '好')]);
b = await send([msg('U_a', '那天使塗層怎麼買')]); ms = main(b, 'U_a');
ok(flexes(ms).length === 1 && /40055380374/.test(flexStr(ms)), '④ 第 4 句再問 → 再附卡(含成交意圖時不會錯過)');

console.log('\n── ⑤ 成交意圖但沒對到產品 → 蝦皮賣場卡 ──');
brainText = () => '好,我幫你整理。';
b = await send([msg('U_s', '我要買 怎麼下單')]); ms = main(b, 'U_s');
ok(flexes(ms).length === 1 && /shopee\.tw\/milk790/.test(flexStr(ms)) && /蝦皮/.test(flexes(ms)[0].altText), '⑤ 賣場卡連到 shopee.tw/milk790');
ok(/【成交訊號】/.test(lastDirective()), '⑫ 逐輪指令注入:成交訊號');
b = await send([msg('U_s', '太貴了吧')]); ms = main(b, 'U_s');
{ const o = (DIRECTIVES.obj || []).find((x) => { try { return new RegExp(x.rx).test('太貴了吧'); } catch (_) { return false; } });   // 跟 worker 一樣取第一個命中的異議,名字跟著資料走(不寫死)
  ok(!!o && lastDirective().includes('【異議:' + o.name + '】'), '⑫ 逐輪指令注入:異議腳本(' + (o ? o.name : '資料裡沒有任何異議命中「太貴了吧」') + ')'); }

console.log('\n── ⑥ 模型標 [VID] → 影片(自家片或 YouTube 合集),同線不重發 ──');
brainText = () => '看一下實作比較快。[VID]polish[/VID]';
b = await send([msg('U_v', '拋光怎麼做')]); ms = main(b, 'U_v');
const vidOrYt = ms.some((m) => m.type === 'video') || ms.some((m) => m.type === 'text' && /youtube\.com/.test(m.text));
ok(vidOrYt, '⑥ 附自家影片訊息或 YouTube 合集連結');
ok(!/\[VID\]/.test(ms[0].text), '⑥ [VID] 標籤剝乾淨');
ok(sess('U_v')?.vids && Object.keys(sess('U_v').vids).length > 0, '⑥ session 記下已送的影片線');
const before = JSON.stringify(sess('U_v').vids);
b = await send([msg('U_v', '再看一次')]); ms = main(b, 'U_v');
ok(ms.filter((m) => m.type === 'video').length === 0 || JSON.stringify(sess('U_v').vids) !== before, '⑥ 同一線已送過 → 不重發同一支');
brainText = () => '[VID]nosuchline[/VID] 好。';
b = await send([msg('U_v2', '嗨')]); ms = main(b, 'U_v2');
ok(ms.every((m) => m.type !== 'video') && !/\[VID\]/.test(ms[0].text), '⑥ 不存在的影片線 → 忽略且標籤剝乾淨');
brainText = () => '[PROD]Z999[/PROD] 好。';
b = await send([msg('U_v3', '嗨')]); ms = main(b, 'U_v3');
ok(flexes(ms).length === 0 && !/\[PROD\]/.test(ms[0].text), '② 不存在的 SKU → 不發卡且標籤剝乾淨');

console.log('\n── ⑦ 貼圖限流:每 3 則最多 1 次、每天最多 2 次 ──');
brainText = () => '好的。[STK]開心[/STK]';
const stkCount = [];
for (let i = 0; i < 7; i++) { b = await send([msg('U_k', '訊息 ' + i)]); stkCount.push(main(b, 'U_k').filter((m) => m.type === 'sticker').length); }
ok(stkCount.join('') === '1001000', '⑦ 7 句連發:第 1、4 句有貼圖,其餘沒有(實際 ' + stkCount.join('') + ')');
ok(sess('U_k')?.stk?.c === 2, '⑦ session 記今日已貼 2 次');
brainText = () => '抱歉讓你等。[STK]鼓勵[/STK]';
b = await send([msg('U_k2', '用了之後漆面反而更花 你們要怎麼處理')]); ms = main(b, 'U_k2');
ok(ms.every((m) => m.type !== 'sticker'), '⑦ 抱怨/售後情緒一律不貼');

console.log('\n── ⑧ 價格表鈕 / 影片鈕 直回不經大腦 ──');
const brainBefore = calls.brain.length;
b = await send([tap('U_t', 'm=car&b=price')]); ms = main(b, 'U_t');
ok(b[0]?.kind === 'reply' && ms[0]?.type === 'image' && /pricelist/.test(ms[0].originalContentUrl), '⑧ 價格表鈕 → reply 價格表圖');
b = await send([tap('U_t', 'm=car&b=shopee')]); ms = main(b, 'U_t');
ok(flexes(ms).length === 1 && /shopee\.tw\/milk790/.test(flexStr(ms)), '⑧ 蝦皮鈕 → 賣場卡');
b = await send([tap('U_t', 'm=vid&l=angel')]); ms = main(b, 'U_t');
ok(ms.some((m) => m.type === 'video' || (m.type === 'text' && /youtube\.com/.test(m.text))), '⑧ 影片鈕 → 影片或合集');
b = await send([tap('U_t', 'm=car&b=howto')]); ms = main(b, 'U_t');
ok(ms[0]?.type === 'text' && ms[0].quickReply?.items?.length >= 1 && ms[0].quickReply.items.every((i) => /^m=vid&l=/.test(i.action.data)), '⑧ 施工影片鈕 → quick reply 選線,每顆都是影片 postback');
ok(ms[0]?.quickReply?.items?.length <= 13 && ms[0].quickReply.items.every((i) => i.action.label.length <= 20), '⑧ quick reply ≤13 顆、label ≤20 字(LINE 硬限制)');
ok(calls.brain.length === brainBefore, '⑧ 四個直回鈕都沒叫大腦(省成本)');
b = await send([tap('U_t', 'm=vid&l=angel')]); ms = main(b, 'U_t');
ok(ms.length === 0 || ms.every((m) => m.type !== 'video'), '⑧ 連點影片鈕 → 12 秒去重或不重發');

console.log('\n── ⑨ videoPlayComplete 落庫 ──');
b = await send([{ type: 'videoPlayComplete', source: { userId: 'U_t', type: 'user' }, videoPlayComplete: { trackingId: 'v6-polish-068' } }]);
ok(taps.some((t) => t.user_id === 'U_t' && t.data === 'vid:done:v6-polish-068'), '⑨ 看完影片記進 menu_taps(最強興趣訊號)');
ok(b.length === 0, '⑨ 看完影片不回話(不洗版)');

console.log('\n── ⑩ 管理路由 ──');
let r = await admin('/admin/card?sku=A005&key=testkey');
ok(r.status === 200 && /40213627112/.test(r.body), '⑩ /admin/card?sku= 回該產品卡 JSON');
r = await admin('/admin/card?q=天使&key=testkey');
ok(r.status === 200 && /"A001"/.test(r.body), '⑩ /admin/card?q= 用別名找');
r = await admin('/admin/card?sku=A005&key=wrong');
ok(r.status === 403, '⑩ 錯 key 擋 403');
r = await admin('/img/pricelist/700');
ok(r.status === 200 && /image\/jpeg/.test(r.ct) && calls.upstream.some((u) => /pricelist-1028-map\/700$/.test(u)), '⑩ /img/pricelist/700 代理 GitHub Pages 並改回 image/jpeg');
r = await admin('/img/pricelist/999');
ok(r.status === 404, '⑩ 非 imagemap 尺寸 404');
r = await admin('/health');
ok(/"seed":"v6\.1\.18"/.test(r.body) && /"catalog":\d+/.test(r.body) && /"welcome_pack":\d+/.test(r.body) && /"reply_first":true/.test(r.body), '⑩ /health 報 seed v6.1.18 + reply_first + 目錄/歡迎包計數');
r = await admin('/admin/catalog?key=testkey');
ok(r.status === 200 && /"A001"/.test(r.body), '⑩ /admin/catalog 列目錄');

console.log('\n── ⑪ 舊 session 升級不炸 ──');
kv.set('popline:U_old', JSON.stringify({ hist: [{ role: 'user', content: '嗨' }, { role: 'assistant', content: '你好' }], n: 2, ho: false, dc: true }));
brainText = () => '好。[STK]開心[/STK][PROD]A005[/PROD]';
b = await send([msg('U_old', '拾號')]); ms = main(b, 'U_old');
ok(flexes(ms).length === 1 && sess('U_old')?.stk && sess('U_old')?.pc, '⑪ 舊 session(無 stk/pc/vids)照常升級');


// ═══════════ v6.1 reply-first 新語意 ═══════════
// 假 Durable Object:真的 DelayReplyDO 類別 + 假 storage(含 alarm),webhook 排進去的 job 由測試手動撥時鐘後呼叫 alarm()
class FakeStorage {
  constructor() { this.m = new Map(); this.alarm = null; }
  async get(k) { return this.m.get(k); }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
  async delete(k) { this.m.delete(k); }
  async getAlarm() { return this.alarm; }
  async setAlarm(t) { this.alarm = t; }
}
const dos = new Map();
const envDO = { ...env, READ_DELAY: 'on' };
const doFor = (name) => { if (!dos.has(name)) dos.set(name, new DelayReplyDO({ storage: new FakeStorage() }, envDO)); return dos.get(name); };
envDO.DELAY_DO = { idFromName: (n) => n, get: (id) => ({ fetch: (url, init) => doFor(id).fetch(new Request(url, init)) }) };
const jobsOf = (uid) => dos.get(uid)?.storage.m.get('jobs') || [];
const mainJob = (uid) => jobsOf(uid).find((j) => j.kind === 'main');
const ackJob = (uid) => jobsOf(uid).find((j) => j.kind === 'ack');
const tmsg = (uid, text, extra = {}) => ({ type: 'message', replyToken: 'rt-' + uid, timestamp: Date.now(), webhookEventId: 'evt-' + uid + '-' + Math.random().toString(36).slice(2, 8), source: { userId: uid, type: 'user' }, message: { id: 'm-' + uid, type: 'text', text, markAsReadToken: 'mrt-' + uid }, ...extra });
const custOut = (batch, uid) => batch.filter((c) => c.kind === 'reply' || c.to === uid);
const DIR0 = structuredClone(DIRECTIVES);
const resetDirectives = () => { for (const k of Object.keys(DIRECTIVES)) delete DIRECTIVES[k]; Object.assign(DIRECTIVES, structuredClone(DIR0)); };
async function fireAlarm(uid, atClock) {   // 撥時鐘到 atClock(相對現在的 ms)再叫醒 DO
  clock = atClock; const mark = calls.out.length;
  await doFor(uid).alarm();
  clock = 0;
  return calls.out.slice(mark);
}

console.log('\n── ⑬ 文字訊息(非 rush):不送文字墊場、main job 帶 replyToken、alarm 50 秒內走 reply ──');
brainText = () => '鍍膜大概一個月補一次比較穩。';
calls.misc.length = 0;
b = await send([tmsg('U_do1', '請問鍍膜多久補一次')], envDO);
ok(custOut(b, 'U_do1').length === 0, '⑬ webhook 當下沒有任何文字墊場、也沒有 push(reply token 留著)');
ok(jobsOf('U_do1').length === 2, '⑬ DO 排了兩個 job:ack + main');
ok(ackJob('U_do1') && !ackJob('U_do1').replyToken && !ackJob('U_do1').messages && ackJob('U_do1').markAsReadToken === 'mrt-U_do1' && ackJob('U_do1').chatId === 'U_do1', '⑬ ack job 只做已讀+loading(chatId),不帶 replyToken、不帶文字');
{ const mj = mainJob('U_do1');
  ok(mj && mj.replyToken === 'rt-U_do1' && typeof mj.issuedAt === 'number' && mj.messages[0].text.includes('一個月補一次'), '⑬ main job 帶 replyToken + issuedAt + 正文');
  ok(mj.notBefore <= mj.issuedAt + 45000 && mj.notBefore >= mj.issuedAt + 8000, '⑬ main notBefore 在 issuedAt+8s ~ +45s 之間(實際 +' + Math.round((mj.notBefore - mj.issuedAt) / 1000) + 's)');
  kv.delete('diag:do_main_path');
  b = await fireAlarm('U_do1', mj.notBefore - _now() + 1);
  ok(b.length === 1 && b[0].kind === 'reply' && b[0].messages[0].text.includes('一個月補一次'), '⑬ alarm 內(<50 秒)只用 reply 送正文,一則 push 都沒有(實際 ' + b.map((x) => x.kind).join(',') + ')');
  ok(/^reply_ok/.test(kv.get('diag:do_main_path') || ''), '⑬ KV diag:do_main_path 記 reply_ok');
  ok(calls.misc.some((m) => m.url.includes('markAsRead') && m.body.markAsReadToken === 'mrt-U_do1') && calls.misc.some((m) => m.url.includes('loading') && m.body.chatId === 'U_do1'), '⑬ ack job alarm 做了 markAsRead + loading');
}
brainText = () => '好的,我幫你看。';

console.log('\n── ⑬b reply 回 400 才 push;token 過期直接 push ──');
b = await send([tmsg('U_do2', '請問洗車精怎麼用')], envDO);
replyOk = false;
{ const mj = mainJob('U_do2'); kv.delete('diag:do_main_path');
  b = await fireAlarm('U_do2', mj.notBefore - _now() + 1); replyOk = true;
  ok(b.map((x) => x.kind).join(',') === 'reply,push' && b[1].to === 'U_do2' && JSON.stringify(b[1].messages) === JSON.stringify(b[0].messages), '⑬b reply 400 → 同一份內容再 push 給客人(實際 ' + b.map((x) => x.kind).join(',') + ')');
  ok(/^reply_400_then_push/.test(kv.get('diag:do_main_path') || ''), '⑬b diag 記 reply_400_then_push');
}
b = await send([tmsg('U_do3', '請問輪胎油怎麼上')], envDO);
{ kv.delete('diag:do_main_path');
  b = await fireAlarm('U_do3', 70000);
  ok(b.map((x) => x.kind).join(',') === 'push', '⑬b 過了 50 秒才醒 → 不再浪費一次 reply,直接 push(實際 ' + b.map((x) => x.kind).join(',') + ')');
  ok(/^push_token_stale/.test(kv.get('diag:do_main_path') || ''), '⑬b diag 記 push_token_stale');
}

console.log('\n── ⑬c DO alarm 競態:送信(對外 fetch)期間新排進來的 job 不能被舊快照蓋掉 ──');
b = await send([tmsg('U_race', '請問拋光盤怎麼選')], envDO);
{ const mj = mainJob('U_race');
  const nextJob = () => ({ kind: 'main', to: 'U_race', token: 'testtoken', messages: [{ type: 'text', text: '第二則主回覆' }], notBefore: Date.now() + 20000 });
  onReply = async () => { const r = await doFor('U_race').fetch(new Request('https://do/schedule', { method: 'POST', body: JSON.stringify(nextJob()) })); if (!r.ok) throw new Error('schedule'); };
  b = await fireAlarm('U_race', mj.notBefore - _now() + 1);
  const left = jobsOf('U_race');
  ok(b.length === 1 && b[0].kind === 'reply', '⑬c 第一則照常 reply(實際 ' + b.map((x) => x.kind).join(',') + ')');
  ok(left.length === 1 && left[0].messages[0].text === '第二則主回覆', '⑬c 送第一則途中排進的第二個 main job 還在 storage(沒被舊快照蓋掉,實際 ' + left.length + ' 筆)');
  ok(dos.get('U_race').storage.alarm === left[0].notBefore, '⑬c alarm 重新設成剩下 job 的 notBefore');
  b = await fireAlarm('U_race', left[0].notBefore - _now() + 1);
  ok(b.length === 1 && b[0].kind === 'push' && b[0].messages[0].text === '第二則主回覆', '⑬c 第二個 job 後來照常送出(沒有 replyToken → push),沒有憑空消失');
  ok(jobsOf('U_race').length === 0, '⑬c 全部送完後 storage 乾淨');
}

console.log('\n── ⑭ 延遲範圍多數 10~35 秒、45 秒上限、同客人至少隔 4 秒 ──');
{ const ds = [];
  for (let i = 0; i < 30; i++) { await send([tmsg('U_r' + i, '想問一下漆面保養')], envDO); const j = mainJob('U_r' + i); ds.push(j.notBefore - j.issuedAt); }
  ok(ds.every((d) => d >= 8000 && d <= 45000), '⑭ 30 筆 main 延遲全部落在 8~45 秒(最小 ' + Math.min(...ds) + ' 最大 ' + Math.max(...ds) + ')');
  ok(ds.filter((d) => d >= 10000 && d <= 35000).length >= 27, '⑭ 多數落在 10~35 秒(' + ds.filter((d) => d >= 10000 && d <= 35000).length + '/30)');
  const t0 = Date.now();
  await send([tmsg('U_cap', '一', { timestamp: t0 })], envDO);
  await send([tmsg('U_cap', '二', { timestamp: t0 })], envDO);
  const mains = jobsOf('U_cap').filter((j) => j.kind === 'main');
  ok(mains.length === 2 && mains.every((j) => j.notBefore <= t0 + 45000), '⑭ 連發兩則:兩個 main 都不超過 issuedAt+45s');
  ok(mains[1].notBefore >= Math.min(mains[0].notBefore + 4000, t0 + 45000), '⑭ 同客人第二則至少隔 4 秒(除非被 45 秒上限擋住)');
  const old = Date.now() - 40000;
  await send([tmsg('U_old2', '漆面有點霧', { timestamp: old })], envDO);
  ok(mainJob('U_old2').notBefore <= old + 45000, '⑭ 事件已經等了 40 秒 → notBefore 被壓回 issuedAt+45s(幾乎立刻送),不再多等 10~30 秒');
}

console.log('\n── ⑮ 深夜(23~08)也走 reply-first,不再隔天早上 push ──');
const envQuietDO = { ...envDO, QUIET_MODE: 'on', QUIET_START: '0', QUIET_END: '24' };   // 全天都算深夜
const envQuiet = { ...env, QUIET_MODE: 'on', QUIET_START: '0', QUIET_END: '24' };
b = await send([tmsg('U_q1', '請問天使塗層要多久補一次')], envQuietDO);
{ const mj = mainJob('U_q1');
  ok(mj && mj.notBefore <= mj.issuedAt + 45000 && mj.replyToken === 'rt-U_q1', '⑮ 深夜 main job 一樣 45 秒內、帶 replyToken(不是隔天 08:00)');
  ok(custOut(b, 'U_q1').length === 0, '⑮ 深夜 webhook 當下也沒有墊場文字(沒有「休息時間」)');
  ok(lastDirective().includes('深夜') && lastDirective().includes('別叫他等'), '⑮ turn 指令加上「真人早上九點後才看得到;照常回答別叫他等」');
  b = await fireAlarm('U_q1', mj.notBefore - _now() + 1);
  ok(b.length === 1 && b[0].kind === 'reply', '⑮ 深夜 alarm 也是 reply');
}
b = await send([tmsg('U_q2', '請問天使塗層要多久補一次')], envQuiet);
ok(b.length === 1 && b[0].kind === 'reply' && !/休息時間/.test(JSON.stringify(b)), '⑮ 沒有 DO 的環境:深夜直接 reply 一則正文(不拿 push 墊檔)');
{ const wsrc = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
  ok(!/push_morning|function morningTs/.test(wsrc), '⑮ 沒有 morningTs / push_morning 的 dead path'); }

console.log('\n── ⑯ ACK_TEXT=on 才送文字墊場(舊行為,replyToken 被墊場用掉 → 主回覆 push)──');
const envAck = { ...envDO, ACK_TEXT: 'on' };
b = await send([tmsg('U_ack1', '請問鍍膜怎麼選')], envAck);
{ const aj = ackJob('U_ack1'), mj = mainJob('U_ack1');
  ok(aj && aj.replyToken === 'rt-U_ack1' && aj.messages[0].text.startsWith('我是超級 AI 人工客服'), '⑯ ACK_TEXT on:ack job 帶 replyToken + 文字墊場(首句含揭露)');
  ok(mj && !mj.replyToken, '⑯ main job 不帶 replyToken(已被墊場用掉)');
  ok(sess('U_ack1')?.dc === true, '⑯ 墊場帶了揭露 → sess.dc = true');
  b = await fireAlarm('U_ack1', mj.notBefore - _now() + 1);
  ok(b.map((x) => x.kind).join(',') === 'reply,push', '⑯ alarm:墊場 reply、主回覆 push(實際 ' + b.map((x) => x.kind).join(',') + ')');
  ok(!b[1].messages[0].text.startsWith('我是超級 AI 人工客服'), '⑯ 揭露已在墊場,主回覆不重複');
}
b = await send([tmsg('U_fc1', '請問鍍膜怎麼選')], envDO);
{ const mj = mainJob('U_fc1');
  ok(!ackJob('U_fc1').messages && mj.messages[0].text.startsWith('我是超級 AI 人工客服'), '⑯ 預設(ACK_TEXT 關):沒有墊場文字 → 揭露接在主回覆前');
  ok(sess('U_fc1')?.dc === true, '⑯ 揭露接主回覆時 sess.dc 也是 true');
}

console.log('\n── ⑰ 照片:已讀+loading 60 → 視覺分析 → replyToken 一次送,失敗才 push ──');
brainText = () => '看得出漆面有一圈一圈的水痕。天使塗層洗完直接噴就能處理。';
calls.misc.length = 0;
const imgEv = (uid) => ({ type: 'message', replyToken: 'rt-' + uid, timestamp: Date.now(), webhookEventId: 'evt-img-' + uid, source: { userId: uid, type: 'user' }, message: { id: 'img-' + uid, type: 'image', markAsReadToken: 'mrt-' + uid } });
b = await send([imgEv('U_img1')]);
ok(b.length === 1 && b[0].kind === 'reply', '⑰ 照片只有一次 reply、沒有 push(實際 ' + b.map((x) => x.kind).join(',') + ')');
ok(b[0].messages[0].text.includes('水痕') && !b.some((c) => JSON.stringify(c.messages).includes('收到照片')), '⑰ 回的是分析本身,沒有「收到照片」墊場');
ok(b[0].messages.some((m) => m.type === 'flex'), '⑰ 診斷點到名的產品 → 同一次 reply 附蝦皮卡');
ok(calls.misc.some((m) => m.url.includes('loading') && m.body.chatId === 'U_img1' && m.body.loadingSeconds === 60) && calls.misc.some((m) => m.url.includes('markAsRead')), '⑰ 先 markAsRead + loading 60 秒');
replyOk = false; b = await send([imgEv('U_img2')]); replyOk = true;
ok(b.map((x) => x.kind).join(',') === 'reply,push' && b[1].to === 'U_img2', '⑰ reply 失敗才 push 備援');
brainText = () => '好的,我幫你看。';

console.log('\n── ⑱ 價格表關鍵字直回(reply、不經大腦)、一天一次 ──');
const brain18 = calls.brain.length;
b = await send([msg('U_pl', '價格表給我看一下')]); ms = main(b, 'U_pl');
ok(b.length === 1 && b[0].kind === 'reply' && ms[0].type === 'image' && /pricelist/.test(ms[0].originalContentUrl), '⑱ 第一次:reply 價格表圖');
ok(calls.brain.length === brain18, '⑱ 不經大腦、不計 push');
ok(sess('U_pl')?.pl === true && kv.has('pl:U_pl:' + taipeiYmd()), '⑱ sess.pl=true + KV pl:<uid>:<YYYYMMDD>');
ok(ms.some((m) => m.type === 'text' && m.text.startsWith('我是超級 AI 人工客服')) && sess('U_pl').dc === true, '⑱ 第一次對話就問價格表:揭露句接在文字前,dc=true');
DIRECTIVES.turn.price_list = '【要價格表】測試用:問他想看哪一類。';
b = await send([msg('U_pl', '價目表有更新嗎')]); ms = main(b, 'U_pl');
ok(calls.brain.length === brain18 + 1 && ms.every((m) => m.type !== 'image'), '⑱ 同一天第二次:不再回圖,改走大腦');
ok(lastDirective().includes('【要價格表】測試用'), '⑱ 第二次把 DIRECTIVES.turn.price_list 當本輪指令');
ok(flexes(ms).length === 0, '⑱ 「價格表」不會被當成交訊號(不附蝦皮賣場卡)');
resetDirectives();
b = await send([msg('U_pl3', '價格表')]);
const dayBefore = clock; clock = 26 * 3600 * 1000;   // 隔天
b = await send([msg('U_pl3', '報價單')]); clock = dayBefore;
ok(main(b, 'U_pl3')[0]?.type === 'image', '⑱ 隔天再問(報價單)→ 又可以回圖');
{ const n = calls.brain.length; b = await send([msg('U_new', '價格表')]); ok(calls.brain.length === n + 1 && main(b, 'U_new').every((m) => m.type !== 'image'), '⑱ 加好友已送過價格表 → 當天再打「價格表」不重發圖'); }
{ const n = calls.brain.length; b = await send([msg('U_hm', '我要找真人 價格表')]); ok(calls.brain.length === n + 1, '⑱ 喊真人時不走價格表直回(交接優先)'); }

console.log('\n── ⑲ webhookEventId 事件去重 ──');
{ const before = calls.out.length, nb = calls.brain.length;
  const e1 = { ...msg('U_dd', '請問洗車精'), webhookEventId: 'DUP-1' };
  await send([e1]);
  const afterFirst = calls.out.length;
  await send([{ ...e1, deliveryContext: { isRedelivery: true } }]);
  ok(afterFirst > before && calls.out.length === afterFirst && calls.brain.length === nb + 1, '⑲ 同一個 webhookEventId(含 isRedelivery 重送)只處理一次');
  ok(kv.has('evt:DUP-1'), '⑲ KV 記了 evt:<id>');
  await send([{ ...msg('U_dd', '再問一個'), webhookEventId: 'DUP-2' }]);
  ok(calls.brain.length === nb + 2, '⑲ 不同 id 照常處理');
  await send([msg('U_dd', '沒有 id 的事件 A')]); await send([msg('U_dd', '沒有 id 的事件 B')]);
  ok(calls.brain.length === nb + 4, '⑲ 沒有 webhookEventId 的事件照舊處理');
  await send([{ ...msg('U_dd2', '同批兩次'), webhookEventId: 'DUP-3' }, { ...msg('U_dd2', '同批兩次'), webhookEventId: 'DUP-3' }]);
  ok(calls.brain.length === nb + 5, '⑲ 同一批裡重複的 id 也只處理一次');
  const envNoKv = { ...env, SESSION: undefined }; const nb2 = calls.brain.length;
  await send([{ ...msg('U_nokv', '沒有 KV'), webhookEventId: 'DUP-4' }, { ...msg('U_nokv', '沒有 KV'), webhookEventId: 'DUP-4' }], envNoKv).catch(() => {});
  ok(calls.brain.length === nb2 + 2, '⑲ 沒有 KV 綁定:照舊處理(不擋、不炸)');
}

console.log('\n── ⑳ 新指令接線(DIRECTIVES.turn 有鍵才生效)+ 貼圖時刻 ──');
Object.assign(DIRECTIVES.turn, { ordered: '【成交後】T-ordered', result_share: '【分享成果】T-share', returning: '【回訪】T-returning', hesitation_close: '【收尾】T-hesitate', price_mismatch: '【價格對不上】T-mismatch', wholesale: '【批發】T-wholesale', price_list: '【要價格表】T-pl' });
DIRECTIVES.stk = { every_n: 3, daily_cap: 2, blocked_emotions: ['抱怨', '售後'], allowed_moments: ['歡迎', '成交', '客人道謝', '客人分享成果'], slot_map: { 歡迎: '歡迎', 成交: '開心', 客人道謝: '感謝', 客人分享成果: '鼓勵' }, moment_rx: { 成交: '(下單了|已下單|付款了)', 客人道謝: '(謝謝|感恩)', 客人分享成果: '(好亮|超亮|效果很好)' } };
brainText = () => '好的。';   // 模型沒標貼圖
const stkIds = (batch, uid) => main(batch, uid).filter((m) => m.type === 'sticker').map((m) => m.stickerId);
b = await send([msg('U_m1', '我下單了')]);
ok(lastDirective().includes('T-ordered'), '⑳ 成交 moment → 疊 ordered 指令');
ok(stkIds(b, 'U_m1').join() === '52002735', '⑳ 貼圖槽位依 slot_map 設為「開心」(52002735),模型沒標也送');
ok(flexes(main(b, 'U_m1')).length === 0, '⑳ 成交後那輪不再附蝦皮卡');
b = await send([msg('U_m2', '用完好亮喔')]);
ok(lastDirective().includes('T-share') && stkIds(b, 'U_m2').join() === '52002736', '⑳ 分享成果 → result_share 指令 + 「鼓勵」貼圖(52002736)');
b = await send([msg('U_m3', '謝謝你')]);
ok(stkIds(b, 'U_m3').join() === '52002737' && !lastDirective().includes('T-ordered'), '⑳ 道謝 → 「感謝」貼圖,不誤疊成交指令');
DIRECTIVES.stk.allowed_moments = ['歡迎'];
b = await send([msg('U_m4', '我下單了')]);
ok(!lastDirective().includes('T-ordered') && stkIds(b, 'U_m4').length === 0, '⑳ 時刻不在 allowed_moments → 不疊指令、不硬塞貼圖');
DIRECTIVES.stk.allowed_moments = ['歡迎', '成交', '客人道謝', '客人分享成果'];
brainText = () => '好的。[STK]開心[/STK]';
b = await send([msg('U_m5', '訊息一')]); b = await send([msg('U_m5', '訊息二')]); b = await send([msg('U_m5', '訊息三')]);
ok(stkIds(b, 'U_m5').length === 0 && sess('U_m5').stk.c === 1, '⑳ 沒命中時刻、模型標的 [STK] 仍受頻率閘限制(每 3 則一次)');
b = await send([msg('U_m6', '我下單了')]); b = await send([msg('U_m6', '我下單了')]);
ok(sess('U_m6').stk.c === 1, '⑳ 命中時刻的貼圖也過頻率閘(連續兩則只貼 1 次)');
brainText = () => '好的,我幫你看。';
// returning
kv.set('popline:U_ret', JSON.stringify({ hist: [{ role: 'user', content: '嗨' }, { role: 'assistant', content: '你好' }], n: 2, ho: false, dc: true, last_seen: Date.now() - 4 * 86400000 }));
await send([msg('U_ret', '我回來了')]);
ok(lastDirective().includes('T-returning'), '⑳ 隔 4 天回來(n>0)→ 疊 returning');
await send([msg('U_ret', '再問一個')]);
ok(!lastDirective().includes('T-returning') && sess('U_ret').last_seen > Date.now() - 60000, '⑳ returning 只疊一次,last_seen 每輪更新');
kv.set('popline:U_ret2', JSON.stringify({ hist: [], n: 0, ho: false, dc: true, last_seen: Date.now() - 9 * 86400000 }));
await send([msg('U_ret2', '嗨')]);
ok(!lastDirective().includes('T-returning'), '⑳ n=0 不算回訪');
await send([msg('U_h', '我再考慮一下')]);
ok(lastDirective().includes('T-hesitate'), '⑳ 猶豫語 → hesitation_close');
for (const t of ['拋光之後再上鍍膜嗎', '拋完再看看效果嗎']) { await send([msg('U_hx', t)]); ok(!lastDirective().includes('T-hesitate'), '⑳ 施工提問「' + t + '」不是猶豫(不叫大腦收尾)'); }
for (const t of ['蝦皮有賣嗎', '蝦皮價格多少', '600番跟1000番怎麼不一樣']) { await send([msg('U_pmx', t)]); ok(!lastDirective().includes('T-mismatch'), '⑳ 單純問價/比較產品「' + t + '」不是價格糾紛'); }
await send([msg('U_wx', '車上有大量鐵粉怎麼辦')]);
ok(!lastDirective().includes('T-wholesale'), '⑳ 車主說「車上有大量鐵粉」不是批發詢問');
await send([msg('U_wx2', '我想當代理')]);
ok(lastDirective().includes('T-wholesale'), '⑳ 「我想當代理」仍命中 wholesale');
await send([msg('U_pm', '蝦皮上的價格跟你們不一樣')]);
ok(lastDirective().includes('T-mismatch'), '⑳ 價格對不上 → price_mismatch');
await send([msg('U_pm2', 'DM的價怎麼比較貴')]);
ok(lastDirective().includes('T-mismatch'), '⑳ 「DM…價」也命中 price_mismatch');
await send([msg('U_w', '我是店家,想問進貨')]);
ok(lastDirective().includes('T-wholesale'), '⑳ 批發詞 → wholesale');
await send([tap('U_w2', 'm=shop&b=wholesale')]);
await send([msg('U_w2', '洗車泡沫怎麼稀釋')]);
ok(sess('U_w2').line === 'shop' && !lastDirective().includes('T-wholesale'), '⑳ 店家線但只是問施工 → 不硬疊 wholesale');
await send([msg('U_w2', '那一瓶多少錢')]);
ok(lastDirective().includes('T-wholesale'), '⑳ 店家線 + 問價 → 疊 wholesale');
DIRECTIVES.turn_rx = { hesitation_close: '^ZZZ$' };
await send([msg('U_h2', '我再考慮一下')]);
const noHes = !lastDirective().includes('T-hesitate');
await send([msg('U_h2', 'ZZZ')]);
ok(noHes && lastDirective().includes('T-hesitate'), '⑳ DIRECTIVES.turn_rx 同名鍵優先於內建正規式');
// 缺鍵不炸
resetDirectives(); delete DIRECTIVES.turn; DIRECTIVES.turn = {}; delete DIRECTIVES.stk;
let crashed = false;
try { for (const t of ['我下單了', '我再考慮一下', '蝦皮價格不一樣', '我是店家想進貨', '價格表', '價格表', '好亮']) await send([msg('U_nk', t)]); } catch (e) { crashed = true; console.error(e); }
ok(!crashed, '⑳ DIRECTIVES 缺 ordered/returning/stk/turn_rx 等鍵 → 全部跳過不炸');
resetDirectives();

console.log('\n── ㉑ 全檔「您」只在 AI_EMPLOYEE 區塊 ──');
{ replyOk = true; let first = true; const realFetch = globalThis.fetch;   // 歡迎包被拒 → 退回純文字(WELCOME_MSG):驗它沒有未查證數字、沒有「您」(揭露句除外)
  globalThis.fetch = async (u, o) => { if (String(u).includes('/message/reply') && first) { first = false; calls.out.push({ kind: 'reply', to: null, messages: JSON.parse(o.body).messages }); return new Response('{"message":"bad"}', { status: 400 }); } return realFetch(u, o); };
  b = await send([{ type: 'follow', replyToken: 'rt', source: { userId: 'U_nf', type: 'user' } }]); globalThis.fetch = realFetch;
  const wt = (b[b.length - 1].messages.find((m) => m.type === 'text') || {}).text || '';
  const afterDisclosure = wt.split('\n\n').slice(1).join('\n\n');
  ok(wt.startsWith('我是超級 AI 人工客服') && afterDisclosure.length > 50, '㉑ 純文字歡迎詞備援送得出去(揭露句仍在第一句)');
  ok(!/您/.test(afterDisclosure) && !/30 秒|只收 10 家|864|5\.0 分/.test(wt), '㉑ 歡迎詞備援:揭露句以外沒有「您」、沒有未查證數字');
  ok(/shopee\.tw\/milk790\?openExternalBrowser=1/.test(wt) && !/shopee\.tw\/milk790(?!\?openExternalBrowser=1)/.test(wt), '㉖ WELCOME_MSG 備援的蝦皮連結帶 openExternalBrowser=1'); }
{ const wsrc = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
  const bs = wsrc.indexOf('const AI_EMPLOYEE = {'), be = wsrc.indexOf('\n};', bs) + 3;
  const disc = (wsrc.slice(bs, be).match(/disclosure_script:\s*'([^']*)'/) || [])[1] || '';   // 揭露句(逐字、含「您」)可能被內嵌在 DATA 區塊的歡迎包裡,先剔掉再算
  const outside = (wsrc.slice(0, bs) + wsrc.slice(be)).split(disc).join('');
  ok(disc.includes('您'), '㉑ 抓得到 AI_EMPLOYEE.disclosure_script 原文(' + disc.length + ' 字)');
  ok(bs > 0 && be > bs && wsrc.slice(bs, be).includes('disclosure_script'), '㉑ 找得到 AI_EMPLOYEE 區塊');
  ok(!outside.includes('您'), '㉑ AI_EMPLOYEE 區塊與內嵌的揭露句以外沒有「您」(' + (outside.match(/您/g) || []).length + ' 個)');
  ok(wsrc.slice(bs, be).includes('老闆~您不要把我們當作一般一板一眼的殭屍客服'), '㉑ AI_EMPLOYEE 揭露句逐字未動');
  ok(!/限量體驗名額,只收|蝦皮 5\.0 分|SHOP_FLEX[\s\S]{0,400}5\.0 分/.test(outside), '㉑ 原始碼裡歡迎詞/賣場卡沒有「只收 10 家」「蝦皮 5.0 分」字樣'); }

// ═══════════ v6.1 追加:反駁席 8 條 low 級意見 ═══════════
const taipeiDash = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const ownerPushes = (batch) => batch.filter((c) => c.kind === 'push' && c.to === 'OWNER_UID');
const mkImg = (uid, i) => ({ type: 'message', replyToken: 'rt-' + uid + '-' + i, timestamp: Date.now(), webhookEventId: 'evt-mi-' + uid + '-' + i, source: { userId: uid, type: 'user' }, message: { id: 'img-' + uid + '-' + i, type: 'image', markAsReadToken: 'mrt-' + uid + '-' + i } });

console.log('\n── ㉒ A:DO ack 排序(ack 必早於自己的 main、各自上限、lastNB 取 max、隔天殘留當 0)──');
{ const t0 = Date.now();
  const burst = ['一', '二', '三', '四'].map((t) => tmsg('U_ord', t, { timestamp: t0 }));   // 客人連發四則(同一個 issuedAt,最擠的情況);事件 id 先產好,免得被下面固定的亂數弄成重複
  const _rnd = Math.random; Math.random = () => 0.999;   // 延遲亂數固定取最大值(舊版最容易出現 ack 晚於 main 的情況),測試才不靠運氣
  for (const e of burst) await send([e], envDO);
  Math.random = _rnd;
  const js = jobsOf('U_ord');
  ok(js.length === 8 && js.every((j, i) => j.kind === (i % 2 === 0 ? 'ack' : 'main')), '㉒ 連發四則 → 排了 4 組 ack/main(實際 ' + js.map((j) => j.kind).join(',') + ')');
  ok(js.filter((j) => j.kind === 'ack').every((j) => j.issuedAt === t0), '㉒ ack job 也帶 issuedAt');
  for (let i = 0; i < 4; i++) {
    const a = js[2 * i], m = js[2 * i + 1];
    ok(a.notBefore < m.notBefore && a.notBefore <= t0 + 40000 && m.notBefore <= t0 + 45000, '㉒ 第 ' + (i + 1) + ' 組:ack(+' + (a.notBefore - t0) + 'ms) < main(+' + (m.notBefore - t0) + 'ms),ack ≤ +40s、main ≤ +45s');
  }
  const d = doFor('U_ord'); const lastBefore = await d.storage.get('lastNB');
  await send([tmsg('U_ord', '五(事件已等 44 秒,上限會把它壓得很早)', { timestamp: Date.now() - 44000 })], envDO);
  ok((await d.storage.get('lastNB')) >= lastBefore, '㉒ lastNB 只增不減(後到但上限較早的 job 不把它往回拉)');
  const stale = doFor('U_stale'); await stale.storage.put('lastNB', Date.now() + 20 * 3600 * 1000);   // v6.0 留下的「隔天早上 08:00」
  await send([tmsg('U_stale', '想問漆面保養')], envDO);
  const sm = mainJob('U_stale'), sa = ackJob('U_stale');
  ok(sm && sa && sm.notBefore <= sm.issuedAt + 45000 && sa.notBefore < sm.notBefore, '㉒ lastNB 比 now+60s 還晚(v6.0 殘留)→ 當 0,今天的回覆不被往後疊(main +' + Math.round((sm.notBefore - sm.issuedAt) / 1000) + 's)');
  ok((await stale.storage.get('lastNB')) < Date.now() + 60000, '㉒ 殘留值被正常值蓋掉');
  // 實際撥鐘:ack 在 main 之前被叫醒做完(markAsRead 先、reply 後)
  calls.misc.length = 0;
  const firstMain = js[1];
  await fireAlarm('U_ord', firstMain.notBefore - _now() + 1);
  ok(calls.misc.some((m) => m.url.includes('markAsRead') && m.body.markAsReadToken === 'mrt-U_ord'), '㉒ 第一則的已讀在第一則主回覆送出時已完成');
}

console.log('\n── ㉓ B:價格表直回讓位給交接檢查點 / 店家線 / 批發報價單 ──');
Object.assign(DIRECTIVES.turn, { price_list: '【要價格表】T-pl23 他今天已經收過價格表圖了,這輪系統不會再傳圖。請他往上滑找那張圖', wholesale: '【批發】T-wh23' });
{ kv.set('popline:U_cp', JSON.stringify({ hist: [], n: 9, ho: false, dc: true }));
  const nb = calls.brain.length;
  b = await send([msg('U_cp', '價格表')]); ms = main(b, 'U_cp');
  ok(calls.brain.length === nb + 1 && ms.some((m) => m.type === 'text') && kv.has('pl:U_cp:' + taipeiYmd()), '㉓ 第 10 句那輪打「價格表」→ 不走直回,交給大腦(圖在同一則回覆最前面補上)');
  ok(lastDirective().includes('交接檢查點') && !lastDirective().includes('T-pl23') && !lastDirective().includes('往上滑'), '㉓ 今天沒收過價格表圖 → 不疊「已收過、往上滑」的 price_list 指令');
  ok(ms[0]?.type === 'image' && ms.length <= 5 && b.filter((c) => c.kind === 'reply').length === 1 && sess('U_cp').pl === true, '㉓ 沒收過 → 這輪回覆最前面補價格表圖、總則數 ≤5、sess.pl=true');
  ok(b.filter((c) => c.kind === 'push' && c.to === 'U_cp').length === 0, '㉓ 補圖與文字同一次 reply,沒有額外 push 給客人');
  ok(ms.filter((m) => m.type === 'image' && /pricelist-1105c-/.test(m.originalContentUrl)).length >= 2 && ms[ms.length - 1].type === 'text', '㉓ 4 張價格表圖排前面、大腦文字保留在最後(超過 5 則先砍貼圖再併文字)');
  ok(sess('U_cp').ho === true, '㉓ 交接照舊:sess.ho=true');
  ok(ownerPushes(b).length === 1 && ownerPushes(b)[0].messages[0].text.includes('AI 店員交接') && !ownerPushes(b)[0].messages[0].text.includes('價格表在上面'), '㉓ 老闆收到的是真正的交接摘要(不是價格表罐頭)');
  // 今天已經收過圖(加好友歡迎包或稍早直回)→ 疊 price_list 指令、不再補圖
  kv.set('popline:U_cp2', JSON.stringify({ hist: [], n: 9, ho: false, dc: true, pl: true }));
  kv.set('pl:U_cp2:' + taipeiYmd(), '1');
  b = await send([msg('U_cp2', '價格表')]); ms = main(b, 'U_cp2');
  ok(ms.every((m) => m.type !== 'image') && lastDirective().includes('T-pl23') && lastDirective().includes('交接檢查點') && sess('U_cp2').ho === true, '㉓ 今天已收過圖 + 檢查點那輪 → 不補圖,疊 price_list 指令,交接照舊');
  // 舊客人(pl=false、沒有今天的鍵)用真資料同款指令:不能被叫去往上滑找一張沒傳過的圖
  kv.set('popline:U_cp3', JSON.stringify({ hist: [], n: 9, ho: false, dc: true, pl: false }));
  b = await send([msg('U_cp3', '價格表')]); ms = main(b, 'U_cp3');
  ok(ms.some((m) => m.type === 'image') && !lastDirective().includes('往上滑'), '㉓ 舊客人(pl=false)第 10 句問價格表 → 看得到價格表圖,指令也沒叫他往上滑');
  kv.set('popline:U_sl', JSON.stringify({ hist: [], n: 2, ho: false, dc: true, line: 'shop' }));
  b = await send([msg('U_sl', '價格表')]); ms = main(b, 'U_sl');
  ok(ms.every((m) => m.type !== 'image') && !kv.has('pl:U_sl:' + taipeiYmd()) && lastDirective().includes('T-wh23') && !lastDirective().includes('T-pl23'), '㉓ 店家線打「價格表」→ 不走直回,疊 wholesale 指令');
  b = await send([msg('U_wq', '想看批發報價單')]); ms = main(b, 'U_wq');
  ok(ms.every((m) => m.type !== 'image') && lastDirective().includes('T-wh23'), '㉓ 一般帳號問「批發報價單」→ 交給大腦並疊 wholesale 指令');
  b = await send([msg('U_cpok', '價格表')]); ms = main(b, 'U_cpok');
  ok(ms[0]?.type === 'image', '㉓ 對照組:一般車主、非檢查點打「價格表」仍直回圖');
  DIRECTIVES.turn_rx = { wholesale: '專屬暗號' };
  b = await send([msg('U_wq2', '專屬暗號 價格表')]); ms = main(b, 'U_wq2');
  ok(ms.every((m) => m.type !== 'image') && lastDirective().includes('T-wh23'), '㉓ 直回判斷與指令共用 DIRECTIVES.turn_rx.wholesale');
}
resetDirectives();

console.log('\n── ㉔ D:老闆推播合併成 1 則 + 每日上限 15 ──');
{ const key = 'ownerpush:' + taipeiDash();
  kv.delete(key); kv.delete('diag:owner_push_capped');
  kv.set('popline:U_mg', JSON.stringify({ hist: [], n: 9, ho: false, dc: true }));
  b = await send([msg('U_mg', '店名：泡泡鴨\n城市：高雄\n最想解決：客人不回頭')]);
  { const ps = ownerPushes(b), t = ps[0]?.messages[0]?.text || '';
    ok(ps.length === 1, '㉔ 同一輪觸發交接 + 店家登記 → 老闆只收到 1 則 push(實際 ' + ps.length + ')');
    ok(t.includes('🤝 AI 店員交接') && t.includes('🏪 有店家登記了') && /\n\n🏪 有店家登記了/.test(t), '㉔ 兩段都在,段落間空一行');
    ok(kv.get(key) === '1', '㉔ KV ownerpush:<台北日期> 計 1(一輪合併推播算 1 則)'); }
  brainText = () => '好的,我幫你整理。[STATE]{"completion":80,"line":"B2B","city":"高雄","grade":"A","pain":"客人不回頭","next":"約通話"}[/STATE]';
  kv.set('popline:U_mg2', JSON.stringify({ hist: [], n: 9, ho: false, dc: true }));
  b = await send([msg('U_mg2', '店名：泡泡豬\n城市：台中')]);
  { const ps = ownerPushes(b), t = ps[0]?.messages[0]?.text || '';
    ok(ps.length === 1 && t.includes('AI 店員交接') && t.includes('有店家登記了') && t.includes('A級意向客戶'), '㉔ 交接 + 店家登記 + 首次升 A 級 → 仍只 1 則,三段都在');
    ok(kv.get(key) === '2', '㉔ 當天計數 2'); }
  brainText = () => '好的,我幫你看。';
  b = await send([msg('U_mg3', '我要找真人')]);
  ok(ownerPushes(b).length === 1 && kv.get(key) === '3', '㉔ 單一事件照常 1 則');
  kv.set(key, '15'); kv.delete('diag:owner_push_capped');
  b = await send([msg('U_mg4', '我要找真人')]);
  ok(ownerPushes(b).length === 0, '㉔ 當天已推 15 則 → 老闆不再收到 push');
  ok(/今日已推 15 則/.test(kv.get('diag:owner_push_capped') || '') && kv.get(key) === '15', '㉔ diag:owner_push_capped 有記,計數不再增加');
  ok([...kv.keys()].some((k) => k.startsWith('ownerdrop:' + taipeiDash()) && /AI 店員交接/.test(kv.get(k))), '㉔ 被擋下的通知全文存進 ownerdrop:<日期>:<時間>(事後查得到)');
  ok(main(b, 'U_mg4').length > 0, '㉔ 老闆推播被擋不影響客人那條回覆');
  kv.set(key, '14');
  b = await send([msg('U_mg5', '我要找真人')]);
  ok(ownerPushes(b).length === 1 && kv.get(key) === '15', '㉔ 第 15 則還推得出去');
  kv.delete(key);
}

console.log('\n── ㉕ C:同一批次同一位客人的多張照片合併成一次處理 ──');
brainText = () => '幾張我都看過了,漆面有一圈一圈的水痕。天使塗層洗完直接噴就能處理。';
{ const nb = calls.brain.length; calls.misc.length = 0;
  b = await send([mkImg('U_multi', 1), mkImg('U_multi', 2), mkImg('U_multi', 3)]);
  const vb = calls.brain[calls.brain.length - 1];
  ok(calls.brain.length === nb + 1 && vb.messages[0].content.filter((c) => c.type === 'image').length === 3, '㉕ 3 個 image 事件 → 視覺只叫 1 次、請求裡有 3 張圖');
  ok(b.length === 1 && b[0].kind === 'reply' && b.filter((c) => c.kind === 'push').length === 0, '㉕ 只 1 次 reply、0 次 push(實際 ' + b.map((x) => x.kind).join(',') + ')');
  ok(b[0].replyToken === 'rt-U_multi-1', '㉕ 用第一張的 replyToken 回');
  ok(calls.misc.filter((m) => m.url.includes('markAsRead')).length === 3 && calls.misc.filter((m) => m.url.includes('loading') && m.body.loadingSeconds === 60).length === 1, '㉕ 三張都標已讀,loading 只開一次');
  ok(/看過了/.test(b[0].messages[0].text) && !/[0-9３三]\s*張/.test(vb.messages[0].content.find((c) => c.type === 'text').text), '㉕ 提示詞要求開頭自然帶「都看了」,且沒有寫死張數');
  ok(sess('U_multi').hist.filter((h) => h.role === 'assistant').length === 1 && sess('U_multi').n === 0, '㉕ session 只記一輪(assistant 1 則),sess.n 不動');
  const nb2 = calls.brain.length;
  b = await send([1, 2, 3, 4, 5, 6].map((i) => mkImg('U_six', i)));
  ok(calls.brain.length === nb2 + 1 && calls.brain[calls.brain.length - 1].messages[0].content.filter((c) => c.type === 'image').length === 4 && b.length === 1 && b[0].kind === 'reply', '㉕ 6 張 → 只取前 4 張進視覺,仍是 1 次 reply');
  ok(/挑最想處理/.test(calls.brain[calls.brain.length - 1].messages[0].content.find((c) => c.type === 'text').text), '㉕ 超過上限時提示詞請客人挑最想處理的幾張');
  const nb3 = calls.brain.length;
  b = await send([mkImg('U_ma', 1), mkImg('U_mb', 1), mkImg('U_ma', 2)]);
  ok(calls.brain.length === nb3 + 2 && b.length === 2 && b.every((c) => c.kind === 'reply') && new Set(b.map((c) => c.replyToken)).size === 2 && b.some((c) => c.replyToken === 'rt-U_ma-1') && b.some((c) => c.replyToken === 'rt-U_mb-1'), '㉕ 不同客人各自處理(各 1 次視覺、各 1 次 reply)');
  replyOk = false; calls.misc.length = 0;
  b = await send([mkImg('U_mf', 1), mkImg('U_mf', 2)]); replyOk = true;
  ok(b.map((x) => x.kind).join(',') === 'reply,push' && b[1].to === 'U_mf', '㉕ 第一張 token reply 失敗 → 才 push 一次(合計 1 次 reply 嘗試 + 1 次 push)');
  b = await send([mkImg('U_one', 1)]);
  ok(b.length === 1 && b[0].kind === 'reply' && /看過了|看到/.test(b[0].messages[0].text) && calls.brain[calls.brain.length - 1].messages[0].content.filter((c) => c.type === 'image').length === 1, '㉕ 單張照片行為不變(1 張圖、1 次 reply)');
  const nb4 = calls.brain.length;
  b = await send([mkImg('U_mx', 1), msg('U_mx', '漆面有點花'), mkImg('U_mx', 2)]);
  ok(calls.brain.length === nb4 + 2 && b.filter((c) => c.kind === 'reply').length === 2, '㉕ 圖、字夾雜:圖合併一次(1 次視覺)、文字照常走大腦');
}
brainText = () => '好的,我幫你看。';

console.log('\n── ㉖ F:蝦皮連結一律帶 openExternalBrowser=1 ──');
{ b = await send([msg('U_sp', '請問洗車精怎麼用')]);
  const sysText = calls.brain[calls.brain.length - 1].system[0].text;
  ok(/shopee\.tw\/milk790\?openExternalBrowser=1/.test(sysText) && !/shopee\.tw\/milk790(?!\?openExternalBrowser=1)/.test(sysText), '㉖ system prompt 的蝦皮賣場連結帶 openExternalBrowser=1');
  const envNur = { ...env, CRM: { prepare(sql) { const st = { bind() { return st; }, async run() { return {}; }, async first() { return null; }, async all() { return { results: sql.startsWith('SELECT sid') ? [{ sid: 'U_nur1234567', city: '高雄', vehicle: 'RAV4', industry: '', budget: '', pain: '水痕' }] : [] }; } }; return st; } } };
  const nr = await worker.fetch(new Request('https://x.test/admin/nurture?key=testkey'), envNur, ctx);
  const np = calls.brain[calls.brain.length - 1].messages[0].content;
  ok(nr.status === 200 && /shopee\.tw\/milk790\?openExternalBrowser=1/.test(np) && !/shopee\.tw\/milk790(?!\?openExternalBrowser=1)/.test(np), '㉖ nurture 主動追的提示詞裡蝦皮連結也帶 openExternalBrowser=1');
  ok(/shopee\.tw\/milk790\?openExternalBrowser=1/.test(flexStr(main(await send([msg('U_sp2', '我要買 怎麼下單')]), 'U_sp2'))), '㉖ 賣場卡連結帶 openExternalBrowser=1'); }

console.log('\n── ㉗ G:只傳照片的客人,last_seen 要更新(下次打字不被當成隔 3 天回訪)──');
DIRECTIVES.turn.returning = '【回訪】T-ret27';
{ kv.set('popline:U_gi', JSON.stringify({ hist: [{ role: 'user', content: '嗨' }, { role: 'assistant', content: '你好' }], n: 2, ho: false, dc: true, last_seen: Date.now() - 4 * 86400000 }));
  await send([mkImg('U_gi', 1)]);
  ok(sess('U_gi').last_seen > Date.now() - 60000 && sess('U_gi').n === 2, '㉗ 照片輪把 last_seen 更新成現在,sess.n 不動(仍 2)');
  await send([msg('U_gi', '漆面有點花')]);
  ok(!lastDirective().includes('T-ret27'), '㉗ 隔了 4 天傳照片、當天再打字 → 不誤判成回訪');
  kv.set('popline:U_gi2', JSON.stringify({ hist: [{ role: 'user', content: '嗨' }, { role: 'assistant', content: '你好' }], n: 2, ho: false, dc: true, last_seen: Date.now() - 4 * 86400000 }));
  await send([msg('U_gi2', '我回來了')]);
  ok(lastDirective().includes('T-ret27'), '㉗ 對照組:真的隔 4 天只打字 → 仍疊 returning'); }
resetDirectives();

console.log('\n── ㉘ E:文案事實(全檔 grep,AI_EMPLOYEE 區塊除外)──');
{ const wsrc = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
  const bs = wsrc.indexOf('const AI_EMPLOYEE = {'), be = wsrc.indexOf('\n};', bs) + 3;
  const outside = wsrc.slice(0, bs) + wsrc.slice(be);
  ok(!/5\.0\s*分/.test(outside), '㉘ 全檔沒有「5.0 分」');
  ok(!/直接出貨/.test(outside), '㉘ 全檔沒有「直接出貨」');
  ok(!/(?<![0-9])30 秒/.test(outside) && !/只收 10 家/.test(outside), '㉘ 全檔沒有「30 秒」「只收 10 家」');
  ok(!/(?<![0-9a-z])864(?![0-9e])/.test(outside), '㉘ 全檔沒有「864」(評價則數;86400/864e5 是秒數常數不算)');
  const dataS = outside.indexOf('// ═══ v6 DATA:BEGIN'), dataE = outside.indexOf('// ═══ v6 DATA:END ═══');
  ok(!/喔/.test(outside.slice(0, dataS) + outside.slice(dataE)), '㉘ worker 自己寫的對客文字沒有「喔」(DATA 區塊由資料正本管,裡面的異議正規式「貴喔」是客人會說的字,不算)');
  const pb = outside.slice(outside.indexOf('const PRODUCTS = `'), outside.indexOf('const EMPLOYEE_RULES'));
  ok(pb.includes('真實背書') && !/[0-9.]+\s*分/.test(pb), '㉘ PRODUCTS 提示詞沒有評分數字');
  ok(outside.includes('價格表上的品項都在蝦皮賣場') && flexStr(main(await send([msg('U_sf', '我要買 怎麼下單')]), 'U_sf')).includes('價格表上的品項都在蝦皮賣場'), '㉘ 賣場卡副標改成不帶承諾的「價格表上的品項都在蝦皮賣場」'); }


console.log('\n── ㉙ v6.1.17 A3 菜單對半兩張 A4;看更多 b=2 鍍膜玻璃、b=3 內裝輪圈 ──');
{ const w = main(await send([{ type: 'follow', replyToken: 'rt', source: { userId: 'U_pl2w', type: 'user' } }]), 'U_pl2w');
  ok(w.filter((m) => m.type === 'image').map((m) => m.originalContentUrl.split('/').pop()).join() === 'pricelist-1105c-1.jpg,pricelist-1105c-2.jpg,pricelist-1105b-05.jpg', '㉙ 歡迎包是 A3 對半兩張＋拋光前處理(火山去污泥/磨泥潤滑液)');
  ok((w.find((m) => m.type === 'text')?.quickReply?.items || []).some((x) => x.action.data === 'm=pl&b=2'), '㉙ 歡迎包按鈕有「看更多價格表」');
  const k = main(await send([msg('U_pl2k', '價格表')]), 'U_pl2k');
  ok((k.find((m) => m.type === 'text')?.quickReply?.items || []).some((x) => x.action.data === 'm=pl&b=2'), '㉙ 打「價格表」直回的文字帶「看更多價格表」按鈕');
  const imgs = (g) => g.filter((m) => m.type === 'image').map((m) => m.originalContentUrl.match(/pricelist-(1105[bc]-\d+)\.jpg$/)?.[1]).join();
  ok(imgs(k) === '1105c-1,1105c-2,1105b-05' || imgs(k) === '', '㉙ 打「價格表」第一組 3 張(今天收過就不重發)');
  const qr = (g) => (g[g.length - 1].quickReply?.items || []).map((x) => x.action.data || x.action.type).join();
  const n = calls.brain.length; let g = main(await send([tap('U_pl2k', 'm=pl&b=2')]), 'U_pl2k');
  ok(calls.brain.length === n && imgs(g) === '1105b-10,1105b-11,1105b-12,1105b-13' && g[4].type === 'text' && qr(g) === 'm=pl&b=3,camera', '㉙ b=2 → 鍍膜玻璃 4 張＋文字、看更多接 b=3');
  g = main(await send([tap('U_pl2k', 'm=pl&b=3')]), 'U_pl2k');
  ok(calls.brain.length === n && imgs(g) === '1105b-14,1105b-15,1105b-16,1105b-17' && qr(g) === 'camera', '㉙ b=3 → 內裝輪圈 4 張、最後只剩拍照');
  g = main(await send([tap('U_pl2k', 'm=pl&b=4')]), 'U_pl2k');
  ok(calls.brain.length === n && imgs(g) === '1105b-14,1105b-15,1105b-16,1105b-17', '㉙ 舊按鈕 b=4 → 照樣回最後一組,不壞');
}
console.log(failed ? `\n🔴 ${passed} passed, ${failed} failed` : `\n🟢 ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
