import fs from 'node:fs';
// v5.3 圖文選單 postback + 店家健檢流 — 本地驗證 harness(零依賴,部署前跑一次)
// 用法:cd workers/pop-line-oa && node test-menu-postback.mjs
// 覆蓋:①postback 不再被丟棄、會走完整管線 ②選單鈕帶本輪指令進大腦 ③分頁切換靜默(只第一次打招呼)
//      ④健檢流三題一次一題、第四輪算帳、跑完自動結束 ⑤店家登記表回傳當場推老闆
//      ⑥批發鈕明確禁止報價 ⑦點選單=秒回不延遲 ⑧選單點擊逐鈕落庫 ⑨已升級客戶不被選單降級
// v6.1:「我想知道我的車該用什麼產品」(pick)改成不經大腦直回拍照 quick reply(拍照/從相簿選/用打字描述);
//      舊的問診指令搬到 describe(走大腦)
import worker, { clean, stripLeak, capEmoji, handoffDraft } from './worker.js';

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
        if (sql.includes('FROM pop_line_menu_taps')) {
          // 兩種查詢:去重(uid+data,12 秒內)與分頁首訪(uid+固定 data)。測試裡所有 tap 都算「剛剛」。
          const [uid, data] = st._b.length > 1 ? st._b : [st._b[0], 'm=tab&b=shop'];
          return { n: d1rows.taps.filter((t) => t.user_id === uid && t.data === data).length };
        }
        return { n: 0 };
      },
      async all() { return { results: [] }; },
    };
    return st;
  },
};
const env = {
  SESSION: { get: async (k) => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, v); }, list: async ({ prefix }) => ({ keys: [...kv.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }) },
  SETUP_KEY: 'testkey',
  CRM, AI: null, AB_TEST: 'off', READ_DELAY: 'off', QUIET_MODE: 'off',
  POP_LINE_SECRET: 'testsecret', POP_LINE_TOKEN: 'testtoken', ANTHROPIC_API_KEY: 'sk-test',
};
const pending = [];
const ctx = { waitUntil: (p) => pending.push(p) };

const calls = { reply: [], push: [], brain: [], link: [], aliasLookup: 0 };
let brainText = () => '好的,我幫你看。';
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('api.anthropic.com')) {
    const body = JSON.parse(opts.body);
    calls.brain.push(body);
    return new Response(JSON.stringify({ content: [{ type: 'text', text: brainText(body) }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (u.includes('/v2/bot/richmenu/alias/pop-shop')) { calls.aliasLookup++; return new Response(JSON.stringify({ richMenuId: 'richmenu-SHOP' }), { headers: { 'content-type': 'application/json' } }); }
  if (/\/v2\/bot\/user\/[^/]+\/richmenu\//.test(u)) { calls.link.push(u.split('/v2/bot/user/')[1]); return new Response('{}'); }
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

console.log('\n── ①-pick 拍照格直回:不經大腦,reply 一則文字 + 三顆 quick reply ──');
const brainBeforePick = calls.brain.length, pushBeforePick = calls.push.length;
const before = replies();
await send([tap('U_car', 'm=car&b=pick')]);
{ const r = calls.reply[calls.reply.length - 1]; const m0 = r.messages[0]; const items = m0.quickReply?.items || [];
  ok(replies() === before + 1 && r.messages.length === 1, '① pick:一次 reply 一則訊息');
  ok(m0.text === '拍一張漆面或玻璃的近照傳上來，我看了直接說用哪一支。打字描述也可以。', '① pick:文字逐字符合');
  ok(items.length === 3 && items[0].action.type === 'camera' && items[0].action.label === '拍照' && items[1].action.type === 'cameraRoll' && items[1].action.label === '從相簿選', '① pick:前兩顆是 camera「拍照」、cameraRoll「從相簿選」');
  ok(items[2].action.type === 'postback' && items[2].action.label === '用打字描述' && items[2].action.data === 'm=car&b=describe' && items[2].action.displayText === '我用打字描述', '① pick:第三顆是 postback m=car&b=describe(displayText「我用打字描述」)');
  ok(calls.brain.length === brainBeforePick && calls.push.length === pushBeforePick, '① pick:不經大腦、不 push'); }

console.log('\n── ① postback 不再被靜默丟棄(describe 走大腦)──');
const b1 = replies();
await send([tap('U_car', 'm=car&b=describe')]);
ok(replies() > b1 && calls.brain.length === brainBeforePick + 1, '① 「用打字描述」鈕有回覆且走大腦(舊版 postback 直接 return,等於死鈕)');
ok(sess('U_car')?.hist?.some((h) => h.role === 'user' && h.content.includes('我的車該用什麼')), '① 合成訊息進了對話歷史(CRM/[STATE] 鏈才會生效)');

console.log('\n── ② 選單鈕把本輪指令送進大腦 ──');
ok(directive().includes('一次只問一件事'), '② 選品(打字描述)鈕的 directive 送達');
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
ok(!directive().includes('popcard') && directive().includes('不推任何系統或軟體'), '④ 收尾不再推 POP CARD(11-03 只做汽美)');
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

console.log('\n── ⑨b 連點兩下只處理一次(D1 強一致去重;KV 最終一致會漏)──');
const dupBefore = replies();
await send([tap('U_dup', 'm=car&b=howto')]);
const afterFirst = replies();
await send([tap('U_dup', 'm=car&b=howto')]);
ok(afterFirst === dupBefore + 1, '⑨b 第一次有回');
ok(replies() === afterFirst, '⑨b 12 秒內第二次完全不處理(不再重複回覆)');
ok(d1rows.taps.filter((t) => t.user_id === 'U_dup').length === 2, '⑨b 但兩次點擊都照記進台帳(成效不失真)');

const tabDupBefore = replies();
await send([tap('U_tab2', 'm=tab&b=shop')]);
await send([tap('U_tab2', 'm=tab&b=shop')]);
ok(replies() === tabDupBefore + 1, '⑨b 分頁切換連點兩下也只打一次招呼');

console.log('\n── ⑨c 盤劑配方鈕(免繳費體驗 11-03 已下架)──');
await send([tap('U_tr', 'm=shop&b=recipe')]);
ok(directive().includes('RO') && directive().includes('番'), '⑨c 本輪要問機型並給盤＋劑番數組合');
ok(directive().includes('不報任何批發價'), '⑨c 明文禁止報價');
ok(!directive().includes('免費') && !directive().includes('799'), '⑨c 沒有免費/月付字樣');
{ const src = fs.readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
  ok(!src.includes("'m=shop&b=trial'") && !/免繳費|免費體驗/.test(src), '⑨c 原始碼沒有體驗鈕與「免繳費」字樣'); }

console.log('\n── ⑨d 店家專屬選單自動綁定(per-user rich menu)──');
calls.link.length = 0; calls.aliasLookup = 0; kv.delete('richmenu:pop-shop');   // 清快取才量得到查詢次數
await send([tap('U_bind', 'm=shop&b=audit')]);
ok(calls.link.some((x) => x.startsWith('U_bind/richmenu/richmenu-SHOP')), '⑨d 按下健檢 → 店家版綁成他的專屬選單');
await send([tap('U_bind2', 'm=shop&b=wholesale')]);
ok(calls.link.some((x) => x.startsWith('U_bind2/')), '⑨d 批發鈕也綁');
ok(calls.aliasLookup === 1, '⑨d menuId 走 alias 查一次就快取(改版換 id 時 alias 不變,不會綁到舊選單)');
const linksBefore = calls.link.length;
await send([tap('U_browse', 'm=tab&b=shop')]);
ok(calls.link.length === linksBefore, '⑨d 只是切分頁逛逛 → 不綁(避免車主誤判成店家)');
await send([tap('U_browse2', 'm=car&b=pick')]);
ok(calls.link.length === linksBefore, '⑨d 車主鈕更不會綁');

console.log('\n── ⑨e 新好友歡迎詞要指路到店家專區 ──');
await send([{ type: 'follow', replyToken: 'rt', source: { userId: 'U_new', type: 'user' } }]);
{ const wtxt = calls.reply[calls.reply.length - 1].messages.filter((m) => m.type === 'text').map((m) => m.text).join('\n');   // v6:第一則是價格表圖,看全部文字則
  ok(wtxt.includes('店家老闆') || (wtxt.includes('切到') && wtxt.includes('店家')), '⑨e 歡迎詞(文字則)明講「切到店家老闆」那一頁怎麼切(不能只出現「店家」兩個字)'); }

console.log('\n── ⑩ 未知 postback 不炸 ──');
await send([tap('U_x', 'm=bogus&b=nope')]);
ok(true, '⑩ 未知 data 安全略過,沒有拋例外');

console.log('\n── ⑪ 真人接手靜音(v6.1.9):喊真人後只停這一個人,其他人照答 ──');
for (const k of [...kv.keys()]) if (k.startsWith('ownerpush:')) kv.delete(k);   // 老闆推播每日上限歸零,免得前面段落吃掉額度
const ownerPush = () => [...calls.push].reverse().find((c) => c.to === 'OWNER_UID')?.messages?.[0]?.text || '';
const img = (uid) => ({ type: 'message', replyToken: 'rt', source: { userId: uid, type: 'user' }, message: { type: 'image', id: '1', contentProvider: { type: 'line' } } });
{ const b0 = calls.brain.length, r0 = replies();
  await send([msg('U_h', '我要找真人')]);
  ok(calls.brain.length === b0 + 1 && replies() === r0 + 1 && directive().includes('客人要求真人'), '⑪a 喊真人那輪照舊走大腦回交接摘要');
  ok(sess('U_h')?.human > 0, '⑪a session 記了真人接手旗子');
  ok(ownerPush().includes('客人喊真人') && ownerPush().includes('已暫停') && ownerPush().includes('放 U_h'), '⑪a 老闆交接包寫明已暫停 24 小時與怎麼放回'); }
{ const b0 = calls.brain.length, r0 = replies(), p0 = calls.push.length;
  await send([msg('U_h', '還在嗎 我要問鍍膜')]);
  ok(calls.brain.length === b0 && replies() === r0, '⑪b 靜音中第二句:不經大腦、不回');
  ok(calls.push.length === p0 + 1 && ownerPush().includes('真人接手中') && ownerPush().includes('還在嗎 我要問鍍膜'), '⑪b 原文轉推老闆');
  ok(sess('U_h')?.hist?.some((h) => h.role === 'user' && h.content.includes('還在嗎')), '⑪b 訊息仍進對話歷史(放回後 AI 接得上)'); }
{ const b0 = calls.brain.length, r0 = replies();
  await send([msg('U_other', '你好 想問洗車精')]);
  ok(calls.brain.length === b0 + 1 && replies() === r0 + 1, '⑪c 其他客人照常自動回覆'); }
{ const b0 = calls.brain.length, r0 = replies(), p0 = calls.push.length;
  await send([img('U_h')]);
  ok(calls.brain.length === b0 && replies() === r0 && calls.push.length === p0 + 1 && ownerPush().includes('照片'), '⑪d 靜音中傳照片:不判圖,通知老闆去後台看'); }
{ const r0 = replies();
  await send([msg('OWNER_UID', '放 U_h')]);
  const rp = calls.reply[calls.reply.length - 1].messages[0].text;
  ok(replies() === r0 + 1 && rp.includes('已放回') && !sess('U_h')?.human, '⑪e 老闆傳「放 前8碼」→ 解除');
  const b0 = calls.brain.length;
  await send([msg('U_h', '那我問一下鍍膜')]);
  ok(calls.brain.length === b0 + 1, '⑪e 放回後這個人恢復自動回覆'); }
{ await send([msg('OWNER_UID', '接 U_h')]);
  ok(calls.reply[calls.reply.length - 1].messages[0].text.includes('已接手') && sess('U_h')?.human > 0, '⑪f 老闆傳「接 前8碼」→ 手動掛上');
  const b0 = calls.brain.length;
  await send([msg('U_h', '在嗎')]);
  ok(calls.brain.length === b0, '⑪f 掛上後靜音');
  await send([msg('OWNER_UID', '放 ZZZZ')]);
  ok(calls.reply[calls.reply.length - 1].messages[0].text.includes('找不到'), '⑪f 前8碼對不到人 → 回找不到,不炸'); }
{ const r0 = replies();
  await send([tap('U_h', 'm=car&b=pick')]);
  ok(replies() === r0 + 1 && !sess('U_h')?.human, '⑪g 靜音中按任何選單鈕=回到自動(旗子清掉、鈕正常回)'); }
{ await send([tap('U_h2', 'm=car&b=human')]);
  ok(sess('U_h2')?.human > 0 && directive().includes('客人要求真人'), '⑪h 選單「找真人」鈕也會掛上旗子'); }
{ const s = sess('U_h2'); s.human = Date.now() - 25 * 3600 * 1000; kv.set('popline:U_h2', JSON.stringify(s));
  const b0 = calls.brain.length;
  await send([msg('U_h2', '請問還有在嗎')]);
  ok(calls.brain.length === b0 + 1 && !sess('U_h2')?.human, '⑪i 超過 24 小時自動放回'); }
{ const g = async (qs) => { const r = await worker.fetch(new Request('https://x.test/admin/human?key=testkey' + qs), env, ctx); return { st: r.status, j: await r.json() }; };
  let r = await g('&uid=U_h&on=1'); ok(r.st === 200 && r.j.human === true && sess('U_h')?.human > 0, '⑪j /admin/human on=1 掛上');
  r = await g(''); ok(r.st === 200 && r.j.muted.some((m) => m.uid.startsWith('U_h')), '⑪j /admin/human 不帶 uid 列出掛著的人');
  r = await g('&uid=U_h&on=0'); ok(r.j.human === false && !sess('U_h')?.human, '⑪j /admin/human on=0 解除');
  const f = await worker.fetch(new Request('https://x.test/admin/human?key=wrong'), env, ctx); ok(f.status === 403, '⑪j 沒 key 擋 403'); }


console.log('\n── ⑫ v6.1.10 輸出閘/emoji 上限/揭露去重/交接草稿 ──');
{ const leak = '明白😊\n\n看來你已經了解了泡泡怪獸官方 LINE 的店員工作內容和相關規範。你的任務是讓每個加好友的人從第一句聊到按「蝦皮購買」。\n\n如果你有任何問題或需要幫助,請隨時問我!';
  const c = clean(leak); ok(!/你的任務|相關規範/.test(c) && /明白/.test(c), '⑫a 複誦系統提示的段落被剝掉,正常段保留');
  ok(stripLeak(leak).leaked === true && stripLeak('天使塗層洗完直接噴。').leaked === false, '⑫b stripLeak 旗正確');
  const allLeak = clean('【本輪指令】你的任務是賣東西。'); ok(allLeak.length > 5 && !/本輪指令/.test(allLeak), '⑫c 全剝光換安全句');
  const e = capEmoji('😊 丹若預洗 🚗 很好用 🌟 真的 😊 讚 👍'); ok((e.match(/\p{Extended_Pictographic}/gu) || []).length === 2 && /丹若預洗/.test(e), '⑫d emoji 只留前兩個');
  ok((clean('😊 好 🚗 用 🌟 讚 ✨').match(/\p{Extended_Pictographic}/gu) || []).length === 2, '⑫e clean 也套 emoji 上限');
  const d = handoffDraft({ hist: [{ role: 'user', content: '研磨劑三件組怎麼買 0983617084' }, { role: 'assistant', content: 'x' }, { role: 'user', content: '我用 RO 機,一個月洗 60 台' }] }, { line: 'B2B', city: '台中' });
  ok(/給你貼的草稿/.test(d) && /0983617084/.test(d) && /line:B2B/.test(d) && /洗 60 台/.test(d) && /泡泡怪獸負責人/.test(d), '⑫f 交接草稿有商品/電話/筆記/原話/開場');
  ok(handoffDraft(null, null) === '' || typeof handoffDraft({hist:[]}, null) === 'string', '⑫g 草稿永不拋錯');
  // 揭露去重:同一新客連傳兩句,第二句讀到的 session 還沒寫回(dc=false),但 KV 旗已在 → 不再帶自介
  const uidD = 'U_dc1';
  await send([msg(uidD, '天使怎麼用')]);
  ok(kv.get('dc:' + uidD) === '1', '⑫h 第一句立刻插 dc 旗');
  const r1 = JSON.stringify(calls.reply[calls.reply.length - 1]); ok(/超級 AI 人工客服/.test(r1), '⑫h2 第一句有自介');
  const s0 = sess(uidD); s0.dc = false; kv.set('popline:' + uidD, JSON.stringify(s0));   // 模擬 race:第二句進來時 session 還沒寫回
  const n0 = calls.reply.length;
  await send([msg(uidD, '木瓜怎麼用')]);
  const r2 = calls.reply.slice(n0).map((x) => JSON.stringify(x)).join('');
  ok(calls.reply.length > n0 && !/超級 AI 人工客服/.test(r2), '⑫i 旗在,第二句不再重複自介');
  ok(sess(uidD).dc === true, '⑫j 第二句把 dc 補回 true'); }

console.log(failed === 0 ? `\n🟢 ${passed} passed, 0 failed\n` : `\n🔴 ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
