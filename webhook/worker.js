// Cloudflare Worker — LINE OA webhook for 3Q Hatchery.
// Handles `follow` events (welcome card + greeting text) and
// `message` events with text (keyword auto-replies).
//
// Required env vars (set in Cloudflare dashboard or via wrangler secret):
//   LINE_CHANNEL_ACCESS_TOKEN   — long-lived from LINE Developers Console
//   LINE_CHANNEL_SECRET         — Basic settings → Channel secret
//   PNG_BASE_URL                — https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports

const GREETING_TEXT = [
  '你好，這裡是 3Q貢丸 · 台灣在地品牌孵化所。',
  '',
  '只要你願意說，我們就幫你被看見。',
  '不管你的店多大多小、新舊、簡單複雜，',
  '我們都有適合的平台、舞台、後台。',
  '',
  '👉 點下方圖文選單 「說說你的店」',
  '我們會幫你找出下一步該被拍下、被講出、被看見的，是哪一件事。',
].join('\n');

const AWAY_TEXT = [
  '收到你的訊息了 — 我們會在 24 小時內回你。',
  '如果是急事，可以先看 https://3q-hatchery.tw/faq',
  '謝謝你願意說。',
].join('\n');

const AUTO_REPLIES = [
  { keywords: ['說說我的店', '我的店', '我想說'],
    response: '好。先告訴我們三件事：\n1. 你的店在哪裡 (區域)\n2. 你做的東西是什麼\n3. 你現在最頭痛的一件事\n\n直接打字給我，不用寫得漂亮。我們讀得到。' },
  { keywords: ['好物', '好照', '生圖', '拍照', '500'],
    response: '「好物・好照」從一個產品開始，500 元 起。\n包含：1 張像樣的產品照 + 1 段別人讀得進去的介紹文。\n\n想看實例？回「實例」我寄給你三個。' },
  { keywords: ['客製', '行銷', '陪你', '陪跑'],
    response: '客製行銷是季度規劃，從你的店現在的階段往前 3 個月。\n我們先約 30 分鐘的諮詢，免費。\n\n回「諮詢」我們開時段。' },
  { keywords: ['進度', '走到哪'],
    response: '請告訴我們你的店名 / 報名編號，\n我們會回你目前進行到哪一步、下次要做什麼。' },
  { keywords: ['實例', '案例', '看作品'],
    response: '本月入駐：\n01 阿婆ㄟ切仔麵店 (雲林)\n02 三代米舖 (台南)\n03 鹿港織坊\n\n回「01 / 02 / 03」看單一案例。',
    // Also send the carousel as a bonus
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

// Rich menu postback data → synthetic user-intent text.
// Used so rich menu taps DON'T pollute the chat with visible "我想說說我的店" bubbles.
const POSTBACK_MAP = {
  'menu:my-store':  '我想說說我的店',
  'menu:imagery':   '我想了解好物・好照',
  'menu:marketing': '我想要客製行銷',
  'menu:progress':  '查我的進度',
};

const CAROUSEL_CARDS = [
  { id: 1, eyebrow: 'NO. 01', title: '本月入駐\n阿婆ㄟ切仔麵店', meta: 'YUNLIN · 2026',
    action: { type: 'message', text: '看 01 阿婆ㄟ切仔麵店' } },
  { id: 2, eyebrow: 'NO. 02', title: '好物\n值得好照',           meta: '好物・好照 · FROM 500',
    action: { type: 'message', text: '我想了解好物・好照' } },
  { id: 3, eyebrow: 'NO. 03', title: '一束稻\n一個故事',         meta: 'TAINAN · 工坊',
    action: { type: 'message', text: '看 03 三代米舖' } },
  { id: 4, eyebrow: 'NO. 04', title: '原麻布\n沒被命名的好',     meta: 'WEAVERS · 鹿港',
    action: { type: 'message', text: '看 04 鹿港織坊' } },
];

// =============================================================================
// Handler
// =============================================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check / status
    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        service: '3Q Hatchery LINE OA webhook',
        ok: true,
        configured: {
          token: Boolean(env.LINE_CHANNEL_ACCESS_TOKEN),
          secret: Boolean(env.LINE_CHANNEL_SECRET),
          png_base: env.PNG_BASE_URL || null,
        },
      }, null, 2), { headers: { 'Content-Type': 'application/json' } });
    }

    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    // Verify LINE signature
    const body = await request.text();
    const signature = request.headers.get('x-line-signature');
    if (!signature) return new Response('Missing signature', { status: 401 });
    const valid = await verifySignature(body, signature, env.LINE_CHANNEL_SECRET);
    if (!valid) return new Response('Invalid signature', { status: 401 });

    let payload;
    try { payload = JSON.parse(body); } catch { return new Response('Bad JSON', { status: 400 }); }

    const events = payload.events || [];
    for (const ev of events) {
      ctx.waitUntil(handleEvent(ev, env).catch(e => console.error('event error', e)));
    }

    return new Response('OK', { status: 200 });
  },
};

// =============================================================================
// Event routing
// =============================================================================

async function handleEvent(ev, env) {
  if (ev.type === 'follow') {
    return sendWelcome(ev.replyToken, env);
  }
  if (ev.type === 'message' && ev.message?.type === 'text') {
    return handleIntent(ev.message.text || '', ev.replyToken, env);
  }
  if (ev.type === 'postback') {
    const synthetic = POSTBACK_MAP[ev.postback?.data];
    if (synthetic) return handleIntent(synthetic, ev.replyToken, env);
  }
  // Ignore unfollow, join, leave, sticker, image, etc.
}

async function sendWelcome(replyToken, env) {
  const pngBase = env.PNG_BASE_URL;
  const messages = [];
  if (pngBase) {
    messages.push({
      type: 'image',
      originalContentUrl: `${pngBase}/3q-welcome-card-1040.png`,
      previewImageUrl: `${pngBase}/3q-welcome-card-1040.png`,
    });
  }
  messages.push({ type: 'text', text: GREETING_TEXT });
  return reply(replyToken, messages, env);
}

async function handleIntent(userText, replyToken, env) {
  const match = AUTO_REPLIES.find(r => r.keywords.some(kw => userText.includes(kw)));

  const messages = [];
  if (match) {
    if (match.image && env.PNG_BASE_URL) {
      messages.push({
        type: 'image',
        originalContentUrl: `${env.PNG_BASE_URL}/${match.image}`,
        previewImageUrl: `${env.PNG_BASE_URL}/${match.image}`,
      });
    }
    messages.push({ type: 'text', text: match.response });
    if (match.carousel && env.PNG_BASE_URL) {
      messages.push(buildCarouselMessage(env.PNG_BASE_URL));
    }
  } else {
    messages.push({ type: 'text', text: AWAY_TEXT });
  }
  return reply(replyToken, messages, env);
}

function buildCarouselMessage(pngBase) {
  return {
    type: 'template',
    altText: '本月入駐 · 4 件作品',
    template: {
      type: 'image_carousel',
      columns: CAROUSEL_CARDS.map(c => ({
        imageUrl: `${pngBase}/3q-carousel-${String(c.id).padStart(2, '0')}-1040.png`,
        action: c.action,
      })),
    },
  };
}

// =============================================================================
// LINE API
// =============================================================================

async function reply(replyToken, messages, env) {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('LINE reply failed', res.status, text);
  }
}

// =============================================================================
// Signature verification — HMAC-SHA256(body) with channel secret, base64
// =============================================================================

async function verifySignature(body, signature, secret) {
  if (!secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  const computed = btoa(String.fromCharCode(...new Uint8Array(mac)));
  // Constant-time compare
  if (computed.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
