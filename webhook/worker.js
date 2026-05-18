// Cloudflare Worker — LINE OA webhook for 3Q Hatchery.
// v3.1 — Guided Flex Message flow + Cloudflare KV session state + escape keyword
//
// Env vars required:
//   LINE_CHANNEL_ACCESS_TOKEN   LINE_CHANNEL_SECRET   PNG_BASE_URL
// Optional:
//   OWNER_USER_ID  — your LINE userId; receives push when inquiry submitted
// KV binding required:
//   SESSION  — KV namespace for conversation state (2-hour TTL)

// ─────────────────────────────────────────────────────────────────────────────
// Keyword auto-reply content (v2, unchanged)
// ─────────────────────────────────────────────────────────────────────────────

const GREETING_TEXT = [
  '你好，這裡是 3Q貢丸 · 台灣在地品牌孵化所。',
  '',
  '只要你願意說，我們就幫你被看見。',
  '不管你的店多大多小、新舊、簡單複雜，',
  '我們都有適合的平台、舞台、後台。',
  '',
  '點下方圖文選單 「說說你的店」',
  '我們會幫你找出下一步該被拍下、被講出、被看見的，是哪一件事。',
].join('\n');

const AWAY_TEXT = [
  '收到你的訊息了 — 我們會在 24 小時內回你。',
  '謝謝你願意說。',
].join('\n');

const AUTO_REPLIES = [
  { keywords: ['好物', '好照', '生圖', '拍照'],
    response: '「好物・好照」從一個產品開始，500 元起。\n包含：1 張像樣的產品照 + 1 段別人讀得進去的介紹文。\n\n點選下方選單「好物・好照」了解完整流程。' },
  { keywords: ['客製', '行銷', '陪你', '陪跑'],
    response: '客製行銷是季度規劃，從你的店現在的階段往前 3 個月。\n我們先約 30 分鐘的諮詢，免費。\n\n點選下方選單「陪你被看見」開始。' },
  { keywords: ['進度', '走到哪'],
    response: '請告訴我們你的店名 / 報名編號，\n我們會回你目前進行到哪一步、下次要做什麼。' },
  { keywords: ['實例', '案例', '看作品'],
    response: '本月入駐：\n01 阿婆ㄟ切仔麵店 (雲林)\n02 三代米舖 (台南)\n03 鹿港織坊\n\n回「01 / 02 / 03」看單一案例。',
    carousel: true },
  { keywords: ['諮詢', '預約'],
    response: '好。先簡單告訴我們：\n你的店名 / 你的角色 / 想聊什麼\n\n我們會在 24 小時內寄時段給你。' },
  { keywords: ['01', '阿婆', '切仔麵'],
    response: '案例 01 — 阿婆ㄟ切仔麵店（雲林）\n\n我們幫她做的：\n・店招重做（保留手寫，補質感）\n・產品照 6 張（鏡頭以下視角，自然光）\n・FB / IG 一頁式介紹\n\n預算：5,000 元，2 週交付。',
    image: '3q-carousel-01-1040.png' },
  { keywords: ['02', '三代米舖', '米舖'],
    response: '案例 02 — 三代米舖（台南）\n\n我們幫他做的：\n・品牌故事 1 篇（從爺爺到孫）\n・包裝改版（保留紅章，紙改厚磅）\n・通路上架（誠品 / 茶水間）\n\n預算：15,000 元，6 週交付。',
    image: '3q-carousel-03-1040.png' },
  { keywords: ['03', '鹿港', '織坊'],
    response: '案例 03 — 鹿港織坊\n\n我們幫她做的：\n・產品分類（從 30 種收斂到 5 種）\n・MOQ 重新定價（從 500 起 → 從 1 條起）\n・通路接洽（手工市集 + 線上）\n\n預算：3,000 元 + 抽成，1 個月交付。',
    image: '3q-carousel-04-1040.png' },
];

const SEASONS = [
  { season: 'spring', kw: ['春', '春茶', '春天', '清明', '春季入駐'] },
  { season: 'summer', kw: ['夏', '夏天', '夏日', '夏味', '夏季'] },
  { season: 'autumn', kw: ['秋', '秋天', '中秋', '桂花', '秋季'] },
  { season: 'winter', kw: ['冬', '冬天', '冬至', '紅豆湯', '冬季'] },
];
const SEASONAL_REPLIES = SEASONS.map(s => ({ keywords: s.kw, image: `3q-seasonal-${s.season}-1080x878.png` }));

const REACTIONS = [
  { name: 'hot',       kw: ['好燙', '燙'] },
  { name: 'recommend', kw: ['推薦', '讚', '好棒'] },
  { name: 'thanks',    kw: ['謝謝', '感謝', '謝啦', 'thanks'] },
  { name: 'wait',      kw: ['稍等', '等等', '等一下'] },
  { name: 'got-it',    kw: ['收到', '了解', '知道'] },
  { name: 'i-see',     kw: ['我懂', '懂', '明白'] },
  { name: 'cheer',     kw: ['加油'] },
  { name: 'excellent', kw: ['太棒', '太好', '太強'] },
  { name: 'later',     kw: ['等等回', '晚點回', '晚點'] },
  { name: 'goodnight', kw: ['晚安', '掰掰', 'bye'] },
  { name: 'order',     kw: ['老闆我要', '老闆', '我要', '要這個'] },
  { name: 'seeyou',    kw: ['下次見', '掰', '下回', '再見'] },
  { name: 'musthave',  kw: ['檔不住', '擋不住', '實在', '真的'] },
  { name: 'queue',     kw: ['排隊', '排隊中', '排隊ing'] },
  { name: 'hungry',    kw: ['想吃', '肚子餓', '餓了'] },
  { name: 'empty',     kw: ['賣完了', '沒有了', '斷貨'] },
  { name: 'bold',      kw: ['敢賭', '敢說', '敢肯定'] },
  { name: 'stellar',   kw: ['絕了', '絕', '真絕', '超絕'] },
  { name: 'hyper',     kw: ['狂推', '超推', '大推', '爆推'] },
  { name: 'done',      kw: ['搞定', '搞好', '準備好', '弄好'] },
];
const REACTION_REPLIES = REACTIONS.map(r => ({ keywords: r.kw, image: `3q-reaction-${r.name}-480.png` }));

const ALL_REPLIES = [...AUTO_REPLIES, ...SEASONAL_REPLIES, ...REACTION_REPLIES];

// Rich menu postback data → synthetic user-intent text.
const POSTBACK_MAP = {
  'menu:my-store':  '我想說說我的店',
  'menu:imagery':   '我想了解好物・好照',
  'menu:marketing': '我想要客製行銷',
  'menu:progress':  '查我的進度',
};

const SERVICE_LABELS  = { imagery: '好物・好照', marketing: '客製行銷', seasonal: '季節活動', consult: '說說我的店' };
const SERVICE_DESC    = { imagery: '一張像樣的產品照，500 元起', marketing: '季度規劃，目標承諾書，深度陪跑', seasonal: '節慶視覺，限時活動圖文', consult: '先聊聊，再決定怎麼做' };
const BUDGET_LABELS   = { low: '5,000 元以下', mid: '5,000–20,000 元', high: '20,000 元以上' };
const TIMELINE_LABELS = { urgent: '一個月內', normal: '一到三個月', relaxed: '三個月以上' };

// Escape keywords — clear session and exit flow
const ESCAPE_RE = /^(取消|退出|結束|重來|重新開始|cancel|exit)$/i;

// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare KV session (2h TTL)
// ─────────────────────────────────────────────────────────────────────────────

async function getSession(uid, env) {
  if (!env.SESSION || !uid) return null;
  try { const v = await env.SESSION.get(uid); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function saveSession(uid, data, env) {
  if (!env.SESSION || !uid) return;
  await env.SESSION.put(uid, JSON.stringify(data), { expirationTtl: 7200 });
}
async function clearSession(uid, env) {
  if (!env.SESSION || !uid) return;
  try { await env.SESSION.delete(uid); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Flex Message builders — 3Q Hatchery brand
// ─────────────────────────────────────────────────────────────────────────────

const FLEX   = (alt, bubble) => ({ type: 'flex', altText: alt, contents: bubble });
const BUBBLE = (header, body) => ({ type: 'bubble', size: 'mega', header, body });

const DARK_HEADER = (title, sub) => ({
  type: 'box', layout: 'vertical', backgroundColor: '#0A0A0A', paddingAll: '24px',
  contents: [
    { type: 'text', text: title, color: '#F5F2EC', size: 'xl', weight: 'bold' },
    { type: 'separator', margin: 'md', color: '#B8924A' },
    ...(sub ? [{ type: 'text', text: sub, color: '#8A8A8A', size: 'sm', margin: 'md', wrap: true }] : []),
  ],
});

const LIGHT_BODY = (contents) => ({
  type: 'box', layout: 'vertical', backgroundColor: '#F5F2EC',
  paddingAll: '20px', spacing: 'md', contents,
});

const BTN = (label, data, primary = true, display) => ({
  type: 'button',
  action: { type: 'postback', label, data, displayText: display || label },
  style: primary ? 'primary' : 'secondary',
  color: primary ? '#0A0A0A' : undefined,
  height: 'sm',
});

// Step 1 — service selection
function serviceCard() {
  return FLEX('你想做什麼？', BUBBLE(
    DARK_HEADER('你想做什麼', '選一個最接近的，我們從這裡開始'),
    LIGHT_BODY([
      BTN('📸 好物・好照　質感生圖',  'flow:service=imagery',   true,  '好物・好照'),
      BTN('🎯 客製行銷　品牌陪跑',    'flow:service=marketing', true,  '客製行銷'),
      BTN('🌸 季節活動　節慶視覺',    'flow:service=seasonal',  true,  '季節活動'),
      BTN('💬 先說說我的店',          'flow:service=consult',   false, '先說說我的店'),
    ]),
  ));
}

// Step 2 — budget selection
function budgetCard(svc) {
  return FLEX('預算大概在哪裡？', BUBBLE(
    DARK_HEADER(SERVICE_LABELS[svc] || svc, SERVICE_DESC[svc] || ''),
    LIGHT_BODY([
      { type: 'text', text: '預算大概在哪裡', color: '#1A1A1A', size: 'md', weight: 'bold' },
      { type: 'separator', margin: 'sm', color: '#E8DFD0' },
      BTN('🌱 5,000 元以下　試水溫',  `flow:budget=low&s=${svc}`,  true, '5,000 元以下'),
      BTN('⚡ 5,000–20,000　認真做',  `flow:budget=mid&s=${svc}`,  true, '5,000–20,000 元'),
      BTN('✨ 20,000 以上　深度合作', `flow:budget=high&s=${svc}`, true, '20,000 元以上'),
    ]),
  ));
}

// Step 3 — timeline selection
function timelineCard(svc, bgt) {
  return FLEX('時間上大概是？', BUBBLE(
    DARK_HEADER('時間上大概是', `${SERVICE_LABELS[svc] || svc}　${BUDGET_LABELS[bgt] || bgt}`),
    LIGHT_BODY([
      BTN('🔥 一個月內　急',         `flow:timeline=urgent&s=${svc}&b=${bgt}`,  true, '一個月內'),
      BTN('🎵 一到三個月　正常節奏',  `flow:timeline=normal&s=${svc}&b=${bgt}`,  true, '一到三個月'),
      BTN('☕ 三個月以上　慢慢來',    `flow:timeline=relaxed&s=${svc}&b=${bgt}`, true, '三個月以上'),
    ]),
  ));
}

// Step 4 — free text prompt
const freeTextPrompt = () => ({
  type: 'text',
  text: '最後一題，也是最重要的。\n\n用一句話說說你的店，或這次最想解決的事。\n\n（想跳出隨時打「取消」）',
});

// Step 5 — summary + confirm
function summaryCard(a) {
  const rows = [
    ['需求', SERVICE_LABELS[a.service]   || a.service   || '—'],
    ['預算', BUDGET_LABELS[a.budget]     || a.budget     || '—'],
    ['時間', TIMELINE_LABELS[a.timeline] || a.timeline   || '—'],
    ['你說', a.freeText                                  || '—'],
  ];
  return FLEX('確認需求', BUBBLE(
    DARK_HEADER('確認一下', '這是我們收到的資訊'),
    {
      type: 'box', layout: 'vertical',
      backgroundColor: '#F5F2EC', paddingAll: '20px', spacing: 'md',
      contents: [
        ...rows.map(([label, value]) => ({
          type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: label, color: '#8A8A8A', size: 'sm', flex: 1 },
            { type: 'text', text: value, color: '#1A1A1A', size: 'sm', flex: 3, wrap: true },
          ],
        })),
        { type: 'separator', margin: 'lg', color: '#E8DFD0' },
        BTN('✅ 確認送出', 'flow:submit', true,  '確認送出'),
        BTN('↩️ 重新填寫', 'flow:reset',  false, '重新填寫'),
      ],
    },
  ));
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse flow postback data
// "flow:budget=mid&s=imagery" → {budget:'mid', s:'imagery'}
// ─────────────────────────────────────────────────────────────────────────────

function flowParams(data) {
  const body = data.slice('flow:'.length);
  if (!body.includes('=')) return {};
  return Object.fromEntries(body.split('&').map(kv => kv.split('=')));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main fetch handler
// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        service: '3Q Hatchery LINE OA webhook',
        ok: true, version: 3.1,
        configured: {
          token:       Boolean(env.LINE_CHANNEL_ACCESS_TOKEN),
          secret:      Boolean(env.LINE_CHANNEL_SECRET),
          png_base:    env.PNG_BASE_URL || null,
          session_kv:  Boolean(env.SESSION),
          owner_push:  Boolean(env.OWNER_USER_ID),
        },
        backends_md: 'https://github.com/milk790-code/3q-hatchery-line-oa/blob/main/BACKENDS.md',
      }, null, 2), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    const body      = await request.text();
    const signature = request.headers.get('x-line-signature');
    if (!signature) return new Response('Missing signature', { status: 401 });
    if (!await verifySignature(body, signature, env.LINE_CHANNEL_SECRET))
      return new Response('Invalid signature', { status: 401 });

    let payload;
    try { payload = JSON.parse(body); } catch { return new Response('Bad JSON', { status: 400 }); }

    for (const ev of (payload.events || []))
      ctx.waitUntil(handleEvent(ev, env).catch(e => console.error('event error', e)));

    return new Response('OK');
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Event routing
// ─────────────────────────────────────────────────────────────────────────────

async function handleEvent(ev, env) {
  const uid = ev.source?.userId;

  if (ev.type === 'follow') {
    await clearSession(uid, env);
    return sendWelcome(ev.replyToken, env);
  }

  if (ev.type === 'postback') {
    const d = ev.postback?.data || '';
    if (d.startsWith('flow:')) return handleFlow(d, uid, ev.replyToken, env);
    const MENU = {
      'menu:my-store':  () => replyMsg(ev.replyToken, [serviceCard()], env),
      'menu:imagery':   () => replyMsg(ev.replyToken, [budgetCard('imagery')], env),
      'menu:marketing': () => replyMsg(ev.replyToken, [budgetCard('marketing')], env),
      'menu:progress':  () => handleIntent('查我的進度', ev.replyToken, env),
    };
    if (MENU[d]) return MENU[d]();
  }

  if (ev.type === 'message' && ev.message?.type === 'text') {
    const text = ev.message.text || '';

    // Escape hatch — clear session and exit flow at any step
    if (ESCAPE_RE.test(text.trim())) {
      await clearSession(uid, env);
      return replyMsg(ev.replyToken, [{
        type: 'text',
        text: '已取消。\n\n要重新開始，傳「說說我的店」。\n或直接傳關鍵字（春茶 / 謝謝 / 實例 / 推薦 ...）。',
      }], env);
    }

    // Free-text capture step
    const session = await getSession(uid, env);
    if (session?.step === 'freetext') {
      const answers = { service: session.service, budget: session.budget, timeline: session.timeline, freeText: text };
      await saveSession(uid, { step: 'summary', ...answers }, env);
      return replyMsg(ev.replyToken, [summaryCard(answers)], env);
    }

    // Flow trigger
    if (/說說.*店|說說我|開始填/.test(text)) {
      await clearSession(uid, env);
      return replyMsg(ev.replyToken, [serviceCard()], env);
    }

    return handleIntent(text, ev.replyToken, env);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow state machine
// ─────────────────────────────────────────────────────────────────────────────

async function handleFlow(data, uid, replyToken, env) {
  const p = flowParams(data);

  if (p.service !== undefined) {
    await clearSession(uid, env);
    return replyMsg(replyToken, [budgetCard(p.service)], env);
  }
  if (p.budget !== undefined) {
    return replyMsg(replyToken, [timelineCard(p.s, p.budget)], env);
  }
  if (p.timeline !== undefined) {
    await saveSession(uid, { step: 'freetext', service: p.s, budget: p.b, timeline: p.timeline }, env);
    return replyMsg(replyToken, [freeTextPrompt()], env);
  }
  if (data === 'flow:submit') {
    const session = await getSession(uid, env);
    if (session && env.OWNER_USER_ID) await pushToOwner(session, env);
    await clearSession(uid, env);
    return replyMsg(replyToken, [{ type: 'text', text: '收到了。\n\n24 小時內我們會主動聯繫你。\n想先看案例，回覆「實例」。' }], env);
  }
  if (data === 'flow:reset') {
    await clearSession(uid, env);
    return replyMsg(replyToken, [serviceCard()], env);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner push notification
// ─────────────────────────────────────────────────────────────────────────────

async function pushToOwner(a, env) {
  const text = [
    '新詢問',
    `需求：${SERVICE_LABELS[a.service]   || a.service   || '—'}`,
    `預算：${BUDGET_LABELS[a.budget]     || a.budget     || '—'}`,
    `時間：${TIMELINE_LABELS[a.timeline] || a.timeline   || '—'}`,
    `說的：${a.freeText || '（未填）'}`,
  ].join('\n');
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: env.OWNER_USER_ID, messages: [{ type: 'text', text }] }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Existing keyword routing (v2, unchanged)
// ─────────────────────────────────────────────────────────────────────────────

async function sendWelcome(replyToken, env) {
  const msgs = [];
  if (env.PNG_BASE_URL) msgs.push({ type: 'image',
    originalContentUrl: `${env.PNG_BASE_URL}/3q-welcome-card-1040.png`,
    previewImageUrl:    `${env.PNG_BASE_URL}/3q-welcome-card-1040.png` });
  msgs.push({ type: 'text', text: GREETING_TEXT });
  return replyMsg(replyToken, msgs, env);
}

async function handleIntent(userText, replyToken, env) {
  const match = ALL_REPLIES.find(r => r.keywords.some(kw => userText.includes(kw)));
  const msgs = [];
  if (match) {
    if (match.image && env.PNG_BASE_URL)
      msgs.push({ type: 'image',
        originalContentUrl: `${env.PNG_BASE_URL}/${match.image}`,
        previewImageUrl:    `${env.PNG_BASE_URL}/${match.image}` });
    if (match.response) msgs.push({ type: 'text', text: match.response });
    if (match.carousel && env.PNG_BASE_URL) msgs.push(carouselMsg(env.PNG_BASE_URL));
  } else {
    msgs.push({ type: 'text', text: AWAY_TEXT });
  }
  return replyMsg(replyToken, msgs, env);
}

function carouselMsg(base) {
  return {
    type: 'template', altText: '本月入駐 · 4 件作品',
    template: { type: 'image_carousel', columns: [
      { imageUrl: `${base}/3q-carousel-01-1040.png`, action: { type: 'message', text: '看 01 阿婆ㄟ切仔麵店' } },
      { imageUrl: `${base}/3q-carousel-02-1040.png`, action: { type: 'message', text: '我想了解好物・好照' } },
      { imageUrl: `${base}/3q-carousel-03-1040.png`, action: { type: 'message', text: '看 03 三代米舖' } },
      { imageUrl: `${base}/3q-carousel-04-1040.png`, action: { type: 'message', text: '看 04 鹿港織坊' } },
    ]},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE API helpers
// ─────────────────────────────────────────────────────────────────────────────

async function replyMsg(replyToken, messages, env) {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) console.error('LINE reply failed', res.status, await res.text());
}

async function verifySignature(body, signature, secret) {
  if (!secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  const computed = btoa(String.fromCharCode(...new Uint8Array(mac)));
  if (computed.length !== signature.length) return false;
  let d = 0;
  for (let i = 0; i < computed.length; i++) d |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  return d === 0;
}
