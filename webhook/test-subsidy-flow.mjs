// 補助健檢四題流 — 狀態機驗證(零依賴;動到正式 bot 的部分,部署前必跑)
// 用法:cd webhook && node test-subsidy-flow.mjs
import { handleSubsidyStep, subQCard, subMatch, subListText } from './worker.js';

const kv = new Map();
const calls = { reply: [], push: [] };
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('/v2/bot/message/reply')) calls.reply.push(JSON.parse(opts.body));
  if (u.includes('/v2/bot/message/push')) calls.push.push(JSON.parse(opts.body));
  return new Response('{}', { status: 200 });
};
const env = {
  SESSION: { get: async (k) => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, v); }, delete: async (k) => { kv.delete(k); } },
  CRM: null,   // CRM 缺席時所有寫入皆須安全跳過(流程照走)
  LINE_CHANNEL_ACCESS_TOKEN: 'tok', OWNER_USER_ID: 'OWNER',
};
const ev = { replyToken: 'rt' };
const lastReply = () => calls.reply[calls.reply.length - 1].messages[0];

let passed = 0, failed = 0;
function ok(cond, name, extra) { if (cond) { passed++; console.log('  ✅', name); } else { failed++; console.error('  ❌', name, extra ?? ''); } }

// 讀回 session(handleSubsidyStep 內部用 saveSession 寫 KV;鍵名 session:<uid> 由 worker 決定 → 從 KV 掃)
const sessOf = () => { for (const [k, v] of kv) if (k.includes('U1')) return JSON.parse(v).step ? JSON.parse(v) : JSON.parse(v); return null; };

// ① 四題卡片形狀
const q1 = subQCard('sub_q1');
ok(q1.quickReply.items.length === 4 && q1.text.includes('第 1 題'), '① q1 卡片 4 選項');

// ② 走完四題:台中汽美經營中 → 清單含 113 萬
let session = { step: 'sub_q1', subLead: '7', subAns: {} };
await handleSubsidyStep(session, '經營 2 年以上', ev, 'U1', env);
session = sessOf();
ok(session?.step === 'sub_q2' && session.subAns.stage === 'mid', '② q1→q2 stage 入庫', JSON.stringify(session));
await handleSubsidyStep(session, '汽車美容', ev, 'U1', env);
session = sessOf();
await handleSubsidyStep(session, 'AI 工具 / 軟體費用', ev, 'U1', env);
session = sessOf();
await handleSubsidyStep(session, '台中', ev, 'U1', env);
session = sessOf();
ok(session?.step === 'sub_offer', '② 四題答完進 offer');
ok(lastReply().text.includes('113 萬') && lastReply().text.includes('沒過件不收費'), '② 清單含可稽核加總+風險反轉', lastReply().text.slice(0, 80));
ok(lastReply().quickReply.items.length === 2, '② 清單帶約健檢 quickReply');

// ③ 答非選項 → 重問本題不前進
const before = session.step;
await handleSubsidyStep(session, '隨便打的', ev, 'U1', env);
ok(sessOf().step === before && lastReply().text.includes('健檢'), '③ 非選項重問不前進');

// ④ 約健檢 → sub_book → 留時段 → 老闆推播含夥伴分+陌開編號
await handleSubsidyStep(sessOf(), '約 15 分鐘健檢', ev, 'U1', env);
ok(sessOf().step === 'sub_book', '④ 進 sub_book 問時段');
const pushBefore = calls.push.length;
await handleSubsidyStep(sessOf(), '平日晚上', ev, 'U1', env);
ok(calls.push.length === pushBefore + 1, '④ 健檢預約推播老闆');
const pushed = calls.push[calls.push.length - 1].messages[0].text;
ok(pushed.includes('陌開 #7') && pushed.includes('夥伴潛力:7 分') && pushed.includes('平日晚上'), '④ 推播含 #編號+夥伴分(car3+ai2+mid1+台中1=7)+時段', pushed);
ok(lastReply().text.includes('24 小時內'), '④ 客人收到確認');

// ⑤ 先看清單就好 → 體面收尾
kv.clear(); calls.reply.length = 0;
let s2 = { step: 'sub_q1', subLead: '', subAns: {} };
await handleSubsidyStep(s2, '公司設立 2 年內', ev, 'U2', env);
s2 = (() => { for (const [k, v] of kv) if (k.includes('U2')) return JSON.parse(v); })();
await handleSubsidyStep(s2, '餐飲 / 食品', ev, 'U2', env);
s2 = (() => { for (const [k, v] of kv) if (k.includes('U2')) return JSON.parse(v); })();
await handleSubsidyStep(s2, '開店 / 創業資金', ev, 'U2', env);
s2 = (() => { for (const [k, v] of kv) if (k.includes('U2')) return JSON.parse(v); })();
await handleSubsidyStep(s2, '南部', ev, 'U2', env);
s2 = (() => { for (const [k, v] of kv) if (k.includes('U2')) return JSON.parse(v); })();
await handleSubsidyStep(s2, '先看清單就好', ev, 'U2', env);
ok(lastReply().text.includes('收著'), '⑤ 先看清單體面收尾(留再觸發入口)');

// ⑥ subMatch 與 outreach 引擎同數字(83 萬 case)
ok(subMatch({ stage: 'mid', biz: 'car', area: '彰化' }).total === 83, '⑥ webhook 版比對=83 萬,與 outreach 引擎一致');

console.log(`\n${failed === 0 ? '🟢' : '🔴'} ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
