// Cloudflare Worker — LINE OA webhook for 3Q Hatchery.
// v3.6 — A: lead scoring, owner quick-reply Flex, booking flow
//         B: rich menu switching, member card, subscriber list + seasonal push
//         + 15 Rich Menu keyword routes + project status query
//
// Env vars required:
//   LINE_CHANNEL_ACCESS_TOKEN   LINE_CHANNEL_SECRET   PNG_BASE_URL
// Optional:
//   OWNER_USER_ID       — your LINE userId; receives push when inquiry submitted
//   TRIGGER_TOKEN       — bearer token for /api/csv export
//   RICHMENU_NEW        — rich menu ID for first-time visitors
//   RICHMENU_INQUIRED   — rich menu ID for users who submitted an inquiry
//   RICHMENU_CONVERTED  — rich menu ID for paying customers
// KV binding required:
//   SESSION  — KV namespace for conversation state (2-hour TTL)
// D1 binding required:
//   CRM      — D1 database `3q-hatchery-crm` for inquiries persistence
// AI binding (optional):
//   AI       — Workers AI for unmatched keyword fallback

// ─────────────────────────────────────────────────────────────────────────
// Keyword auto-reply content
// ─────────────────────────────────────────────────────────────────────────

const AWAY_TEXT = '收到你的訊息了 — 我們會在 24 小時內回覆你。';

function isBusinessHours() {
  const tw = new Date(Date.now() + 8 * 3600 * 1000);
  const day = tw.getUTCDay();
  const hour = tw.getUTCHours();
  return day >= 1 && day <= 5 && hour >= 10 && hour < 19;
}

const AWAY_HOURS_TEXT = [
  '收到你的訊息了。',
  '我們的服務時間是週一至週五 10:00–19:00。',
  '會在下個工作日回覆你，謝謝你願意說。',
].join('\n');

const CONTACT_TEXT = '想直接聊？\n• LINE: 直接在這裡留訊息\n• Email: hello@3q-hatchery.tw\n• 電話: 02-xxxx-xxxx\n\n我們營業時間內回覆。';

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
  // Rich Menu tap-zone routes (v3.6)
  { keywords: ['聯絡我們', '聯絡顧問', '追加服務'],
    response: CONTACT_TEXT },
  { keywords: ['優化建議'],
    response: '看了你的店，三個方向：\n\n1️⃣ 流量入口 — 主視覺+SEO+社群連動\n2️⃣ 文案精準 — 痛點具象+量化承諾\n3️⃣ 商品結構 — 主打/引流/利潤三層分明\n\n想深聊哪一點？' },
  { keywords: ['看看報價'],
    response: '想看報價？告訴我：\n1. 你的店類型\n2. 預算範圍\n3. 期待時程\n\n我會給你客製試算。' },
  { keywords: ['VIP 資源庫', 'VIP資源庫'],
    response: 'VIP 資源庫整理中…\n預計 v3.7 推出：\n• 行銷模板庫\n• 拍攝指南\n• 顧問月報\n\n敬請期待。' },
  { keywords: ['介紹新客戶'],
    response: '介紹朋友來孵化？\n• 你的專屬推薦碼：（v3.7 推出）\n• 朋友成交，你獲得免費品牌健診\n\n先聯絡顧問，我們手動登記。' },
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

// ─────────────────────────────────────────────────────────────────────────
// Campaign — 好物・好照 限時招募 (30 slots, 3 price tiers)
// ─────────────────────────────────────────────────────────────────────────

const CAMPAIGN_KEY = 'campaign:2026:photoshot';
const CAMPAIGN_TIERS = {
  tier1: { max: 10, price: 100, label: '前 10 位',  action: '截圖點讚回傳' },
  tier2: { max: 10, price: 200, label: '11–20 位',  action: '回傳 👍' },
  tier3: { max: 10, price: 300, label: '21–30 位',  action: '回傳「我要」' },
};

async function getCampaignSlots(env) {
  if (!env.SESSION) return { tier1: [], tier2: [], tier3: [] };
  try {
    const v = await env.SESSION.get(CAMPAIGN_KEY);
    return v ? JSON.parse(v) : { tier1: [], tier2: [], tier3: [] };
  } catch { return { tier1: [], tier2: [], tier3: [] }; }
}

async function registerCampaignSlot(uid, tier, env) {
  if (!uid || !CAMPAIGN_TIERS[tier]) return 'error';
  const slots = await getCampaignSlots(env);
  if (slots[tier].includes(uid)) return 'already';
  if (slots[tier].length >= CAMPAIGN_TIERS[tier].max) return 'full';
  slots[tier].push(uid);
  await env.SESSION.put(CAMPAIGN_KEY, JSON.stringify(slots));
  return 'ok';
}

function campaignCard(slots) {
  const remaining = (tier) => Math.max(0, CAMPAIGN_TIERS[tier].max - slots[tier].length);
  const full = (tier) => remaining(tier) === 0;
  const remLabel = (tier) => full(tier) ? '· 額滿' : `· 剩 ${remaining(tier)} 位`;
  return FLEX('好物・好照 限時招募', BUBBLE(
    DARK_HEADER('好物・好照 · 限時招募', '業界 2,000 起跳的攝影棚美食圖，這次 500 元起'),
    LIGHT_BODY([
      { type: 'text', text: '目前名額狀況', color: '#8A8A8A', size: 'sm', margin: 'none' },
      { type: 'separator', margin: 'sm', color: '#E8DFD0' },
      ...(['tier1', 'tier2', 'tier3']).map(t => ({
        type: 'box', layout: 'horizontal', margin: 'sm',
        contents: [
          { type: 'text', text: `${CAMPAIGN_TIERS[t].label} · ${CAMPAIGN_TIERS[t].price} 元`, flex: 3, size: 'sm', color: '#1A1A1A' },
          { type: 'text', text: remLabel(t), flex: 1, size: 'sm', align: 'end',
            color: full(t) ? '#D04040' : '#B8924A' },
        ],
      })),
      { type: 'separator', margin: 'lg', color: '#E8DFD0' },
      BTN(full('tier1') ? '前 10 位 · 額滿' : `前 10 位 · 100 元 (剩 ${remaining('tier1')})`,
          'flow:campaign=tier1', !full('tier1'), '我要前10位 100元'),
      BTN(full('tier2') ? '11–20 位 · 額滿' : `11–20 位 · 200 元 (剩 ${remaining('tier2')})`,
          'flow:campaign=tier2', !full('tier2'), '我要11-20位 200元'),
      BTN(full('tier3') ? '21–30 位 · 額滿' : `21–30 位 · 300 元 (剩 ${remaining('tier3')})`,
          'flow:campaign=tier3', !full('tier3'), '我要21-30位 300元'),
    ]),
  ));
}

// ─────────────────────────────────────────────────────────────────────────
// Quote Calculator
// ─────────────────────────────────────────────────────────────────────────

const QTY_LABELS  = { '1-3': '1-3 個產品', '4-10': '4-10 個產品', '10+': '10 個以上' };
const USE_LABELS  = { ig: 'IG 社群', shop: '蝦皮/官網', channel: '通路上架/包裝', all: '全部都要' };
const RUSH_LABELS = { week: '一週內', biweek: '兩週內', month: '一個月內' };

function quotePriceRange(qty, use, rush) {
  let base = qty === '1-3' ? 500 : qty === '4-10' ? 400 : 300;
  let count = qty === '1-3' ? 2 : qty === '4-10' ? 6 : 12;
  const useMul = use === 'all' ? 1.5 : use === 'channel' ? 1.3 : use === 'shop' ? 1.1 : 1.0;
  const rushMul = rush === 'week' ? 1.4 : rush === 'biweek' ? 1.15 : 1.0;
  const low  = Math.round(base * count * useMul * rushMul / 100) * 100;
  const high = Math.round(low * 1.6 / 100) * 100;
  return { low, high };
}

function quoteQtyCard() {
  return FLEX('你有幾個產品？', BUBBLE(
    DARK_HEADER('產品數量', '我們幫你估個區間，馬上知道'),
    LIGHT_BODY([
      { type: 'text', text: '幾個產品要拍？', color: '#1A1A1A', size: 'md', weight: 'bold' },
      { type: 'separator', margin: 'sm', color: '#E8DFD0' },
      BTN('🌱 1-3 個 · 試水溫',  'flow:qty=1-3',  true, '1-3 個'),
      BTN('⚡ 4-10 個 · 認真做', 'flow:qty=4-10', true, '4-10 個'),
      BTN('✨ 10 個以上 · 整套', 'flow:qty=10+',  true, '10 個以上'),
    ]),
  ));
}

function quoteUseCard(qty) {
  return FLEX('用在哪裡？', BUBBLE(
    DARK_HEADER('使用場景', `${QTY_LABELS[qty]}　|　下一步`),
    LIGHT_BODY([
      { type: 'text', text: '主要用在哪？', color: '#1A1A1A', size: 'md', weight: 'bold' },
      { type: 'separator', margin: 'sm', color: '#E8DFD0' },
      BTN('📱 IG / 社群',     `flow:use=ig&q=${qty}`,      true, 'IG'),
      BTN('🛒 蝦皮 / 官網',   `flow:use=shop&q=${qty}`,    true, '蝦皮/官網'),
      BTN('📦 通路 / 包裝',   `flow:use=channel&q=${qty}`, true, '通路/包裝'),
      BTN('🎯 全部都要',       `flow:use=all&q=${qty}`,     true, '全部'),
    ]),
  ));
}

function quoteRushCard(qty, use) {
  return FLEX('多急？', BUBBLE(
    DARK_HEADER('交期', `${QTY_LABELS[qty]}　|　${USE_LABELS[use]}`),
    LIGHT_BODY([
      { type: 'text', text: '什麼時候要？', color: '#1A1A1A', size: 'md', weight: 'bold' },
      { type: 'separator', margin: 'sm', color: '#E8DFD0' },
      BTN('🔥 一週內 · 急', `flow:rush=week&q=${qty}&u=${use}`,    true, '一週內'),
      BTN('🎵 兩週內',      `flow:rush=biweek&q=${qty}&u=${use}`,  true, '兩週內'),
      BTN('☕ 一個月內',    `flow:rush=month&q=${qty}&u=${use}`,   true, '一個月'),
    ]),
  ));
}

function postInquiryNextStepsCard() {
  return FLEX('下一步可以做什麼', BUBBLE(
    DARK_HEADER('下一步', '在等我們回覆的時候，可以先做這些'),
    LIGHT_BODY([
      { type: 'text', text: '不一定要等。先做這個更有效：', color: '#1A1A1A', size: 'sm', wrap: true },
      { type: 'separator', margin: 'md', color: '#E8DFD0' },
      BTN('📅 預約 30 分鐘諮詢',  'flow:nxt=book',     true,  '預約諮詢'),
      BTN('📂 看本月入駐案例',    'flow:nxt=cases',    true,  '實例'),
      BTN('🎯 試算我的方案價格',  'flow:nxt=quote',    true,  '試算'),
      BTN('🔥 +1 招募名額',       'flow:nxt=campaign', false, '+1'),
    ]),
  ));
}

function postCampaignNextStepsCard(tier, price, action) {
  return FLEX('報名後下一步', BUBBLE(
    DARK_HEADER('報名成功 ✓', `${tier} · NT$ ${price}`),
    LIGHT_BODY([
      { type: 'text', text: `動作：${action}`, color: '#1A1A1A', size: 'md', weight: 'bold' },
      { type: 'separator', margin: 'sm', color: '#E8DFD0' },
      { type: 'text', text: '收到動作後，我們會：', color: '#8A8A8A', size: 'sm', margin: 'sm' },
      { type: 'text', text: '1. 24h 內回覆收費連結', color: '#1A1A1A', size: 'sm' },
      { type: 'text', text: '2. 收款後 48h 內安排第一次對接', color: '#1A1A1A', size: 'sm' },
      { type: 'text', text: '3. 7-14 天內成片交付', color: '#1A1A1A', size: 'sm' },
      { type: 'separator', margin: 'md', color: '#E8DFD0' },
      BTN('💬 想先聊聊',  'flow:nxt=consult', false, '說說我的店'),
      BTN('📂 看其他案例', 'flow:nxt=cases',  false, '實例'),
    ]),
  ));
}

function quoteResultCard(qty, use, rush) {
  const { low, high } = quotePriceRange(qty, use, rush);
  return FLEX('估價結果', BUBBLE(
    DARK_HEADER('你的方案估價', `${QTY_LABELS[qty]}　|　${USE_LABELS[use]}　|　${RUSH_LABELS[rush]}`),
    LIGHT_BODY([
      { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
        { type: 'text', text: '預估價格區間', color: '#8A8A8A', size: 'sm' },
        { type: 'text', text: `NT$ ${low.toLocaleString()} – ${high.toLocaleString()}`,
          color: '#B8924A', size: 'xxl', weight: 'bold' },
        { type: 'separator', margin: 'md', color: '#E8DFD0' },
        { type: 'text', text: '・含產品攝影 + 介紹文', color: '#1A1A1A', size: 'sm' },
        { type: 'text', text: '・本月招募活動可享優惠（前 30 位）', color: '#1A1A1A', size: 'sm' },
        { type: 'separator', margin: 'md', color: '#E8DFD0' },
      ]},
      BTN('🎯 立即下定 · 走招募名額', 'flow:qty_to_campaign', true, '+1'),
      BTN('💬 想再聊聊',              'flow:qty_to_consult',  false, '說說我的店'),
    ]),
  ));
}

// ─────────────────────────────────────────────────────────────────────────
// Guided flow labels
// ─────────────────────────────────────────────────────────────────────────

const SERVICE_LABELS  = { imagery: '好物・好照', marketing: '客製行銷', seasonal: '季節活動', consult: '說說我的店' };
const SERVICE_DESC    = { imagery: '一張像樣的產品照，500 元起', marketing: '季度規劃，目標承諾書，深度陪跑', seasonal: '節慶視覺，限時活動圖文', consult: '先聊聊，再決定怎麼做' };
const BUDGET_LABELS   = { low: '5,000 元以下', mid: '5,000–20,000 元', high: '20,000 元以上' };
const TIMELINE_LABELS = { urgent: '一個月內', normal: '一到三個月', relaxed: '三個月以上' };

const SERVICE_HERO = {
  imagery:   { file: '3q-carousel-02-1040.png', ratio: '1:1'   },
  marketing: { file: '3q-cover-bowl-1080x878.png', ratio: '20:16' },
  seasonal:  { file: '3q-seasonal-spring-1080x878.png', ratio: '20:16' },
  consult:   { file: '3q-cover-bowl-1080x878.png', ratio: '20:16' },
};

const ESCAPE_RE = /^(取消|退出|結束|重來|重新開始|cancel|exit)$/i;

// ─────────────────────────────────────────────────────────────────────────
// KV session (2h TTL)
// ─────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────
// A-B1: Rich Menu switching (requires env.RICHMENU_NEW / _INQUIRED / _CONVERTED)
// ─────────────────────────────────────────────────────────────────────────

async function switchRichMenu(uid, menuId, env) {
  if (!uid || !menuId || !env.LINE_CHANNEL_ACCESS_TOKEN) return;
  try {
    await fetch(`https://api.line.me/v2/bot/user/${uid}/richmenu/${menuId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` },
    });
  } catch (err) {
    console.error('switchRichMenu failed:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// A-B2: Member card (member number + tier stored in KV without TTL)
// ─────────────────────────────────────────────────────────────────────────

async function issueMemberCard(uid, env) {
  if (!env.SESSION || !uid) return null;
  try {
    const existing = await env.SESSION.get(`member:${uid}`);
    if (existing) return JSON.parse(existing);
    const cur = parseInt(await env.SESSION.get('member:next_num') || '0', 10);
    const num = cur + 1;
    await env.SESSION.put('member:next_num', String(num));
    const joinDate = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    const code = refCodeForNum(num);
    const card = { num, joinDate, tier: 'visitor', code, refCount: 0 };
    await env.SESSION.put(`member:${uid}`, JSON.stringify(card));
    await env.SESSION.put(`refcode:${code}`, uid);   // reverse index for O(1) attribution
    return card;
  } catch (err) {
    console.error('issueMemberCard failed:', err.message);
    return null;
  }
}

async function updateMemberTier(uid, tier, env) {
  if (!env.SESSION || !uid) return;
  try {
    const key = `member:${uid}`;
    const cur = await env.SESSION.get(key);
    if (!cur) return;
    const card = JSON.parse(cur);
    card.tier = tier;
    await env.SESSION.put(key, JSON.stringify(card));
  } catch {}
}

function memberCardFlex(num, joinDate, tier, code, refCount, env) {
  const TIER_LABELS = { visitor: '訪客', inquired: '詢問者', partner: '夥伴' };
  const TIER_COLORS = { visitor: '#8A8A8A', inquired: '#B8924A', partner: '#B8924A' };
  const padded = String(num).padStart(4, '0');
  const body = {
    type: 'box', layout: 'vertical', backgroundColor: '#0A0A0A',
    paddingAll: '24px', spacing: 'sm',
    contents: [
      { type: 'text', text: 'MEMBER', color: '#B8924A', size: 'xxs', weight: 'bold', letterSpacing: '4px' },
      { type: 'text', text: `# ${padded}`, color: '#F5F2EC', size: 'xxl', weight: 'bold', margin: 'sm' },
      { type: 'separator', margin: 'sm', color: '#B8924A' },
      { type: 'box', layout: 'horizontal', margin: 'md', contents: [
        { type: 'text', text: '加入日期', color: '#8A8A8A', size: 'xs', flex: 1 },
        { type: 'text', text: joinDate, color: '#F5F2EC', size: 'xs', flex: 2, align: 'end' },
      ]},
      { type: 'box', layout: 'horizontal', contents: [
        { type: 'text', text: '身分', color: '#8A8A8A', size: 'xs', flex: 1 },
        { type: 'text', text: TIER_LABELS[tier] || tier,
          color: TIER_COLORS[tier] || '#F5F2EC', size: 'xs', flex: 2, align: 'end', weight: 'bold' },
      ]},
    ],
  };
  if (code) {
    body.contents.push({ type: 'box', layout: 'horizontal', contents: [
      { type: 'text', text: '引薦碼', color: '#8A8A8A', size: 'xs', flex: 1 },
      { type: 'text', text: `${code} · 已薦 ${refCount || 0}`, color: '#B8924A', size: 'xs', flex: 2, align: 'end', weight: 'bold' },
    ]});
  }
  body.contents.push(
    { type: 'separator', margin: 'md', color: '#333333' },
    { type: 'text', text: '3Q HATCHERY · 台灣在地品牌孵化所',
      color: '#444444', size: 'xxs', margin: 'sm', align: 'center' },
  );
  const bubble = { type: 'bubble', size: 'mega', body };
  if (code) {
    bubble.footer = {
      type: 'box', layout: 'vertical', backgroundColor: '#F5F2EC', paddingAll: '16px',
      contents: [{
        type: 'button', style: 'primary', color: '#0A0A0A', height: 'sm',
        action: { type: 'uri', label: '引薦朋友 · 兩邊都有禮遇', uri: referralDeepLink(code, env) },
      }],
    };
  }
  return FLEX(`3Q 會員卡 #${padded}`, bubble);
}

// ─────────────────────────────────────────────────────────────────────────
// A-B3: Subscriber list (stored in KV, no TTL)
// ─────────────────────────────────────────────────────────────────────────

const SUBSCRIBERS_KEY = 'subscribers:list';

async function addSubscriber(uid, env) {
  if (!env.SESSION || !uid) return;
  try {
    const cur = await env.SESSION.get(SUBSCRIBERS_KEY);
    const list = cur ? JSON.parse(cur) : [];
    if (!list.includes(uid)) {
      list.push(uid);
      await env.SESSION.put(SUBSCRIBERS_KEY, JSON.stringify(list));
    }
  } catch {}
}

async function removeSubscriber(uid, env) {
  if (!env.SESSION || !uid) return;
  try {
    const cur = await env.SESSION.get(SUBSCRIBERS_KEY);
    if (!cur) return;
    const list = JSON.parse(cur).filter(u => u !== uid);
    await env.SESSION.put(SUBSCRIBERS_KEY, JSON.stringify(list));
  } catch {}
}

async function getSubscribers(env) {
  if (!env.SESSION) return [];
  try {
    const cur = await env.SESSION.get(SUBSCRIBERS_KEY);
    return cur ? JSON.parse(cur) : [];
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────
// v3.7: Referral engine — code issue, attribution, qualify, reward
//   One engine shared across OAs (code prefix H = hatchery, G = gongwan).
//   Attribution path (no LIFF): prefilled oaMessage deep link "引薦 <CODE>".
//   Reward = status language (label_public) wrapping a real discount code.
//   Qualifies ONLY on inquiry/campaign (never on follow) → anti-farming.
// ─────────────────────────────────────────────────────────────────────────

const REF_PREFIX = 'H';                      // this worker = hatchery
const REF_PENDING_TTL = 60 * 60 * 24 * 30;   // pending attribution lives 30 days
const REF_WEEK_LIMIT = 20;                    // > this/week → owner review, not auto-reward

function refCodeForNum(num) {
  return REF_PREFIX + String(num).padStart(4, '0');
}

// Reward ladder by inviter cumulative qualified count (REFERRAL-SYSTEM.md §5).
function inviterReward(count) {
  if (count >= 10) return { value_type: 'discount_pct', value: 20, label: '引薦核心 · 聯名席位' };
  if (count >= 5)  return { value_type: 'discount_pct', value: 20, label: '引薦夥伴 · 常態禮遇' };
  if (count >= 3)  return { value_type: 'discount_pct', value: 15, label: '常引薦 · 優先排程' };
  return { value_type: 'discount_pct', value: 10, label: '引薦人 · 留名禮遇' };
}
const INVITEE_REWARD = { value_type: 'discount_pct', value: 10, label: '入席禮 · 首單禮遇' };

function referralDeepLink(code, env) {
  const id = env.LINE_BASIC_ID || '@121Ikspe';
  return `https://line.me/R/oaMessage/${encodeURIComponent(id)}/?${encodeURIComponent('引薦 ' + code)}`;
}
function referralSiteLink(code, env) {
  const base = env.SITE_BASE_URL || 'https://milk790-code.github.io/3q-hatchery-line-oa/';
  return base + (base.indexOf('?') > -1 ? '&' : '?') + 'ref=' + encodeURIComponent(code);
}

// Ensure a member card carries a code + reverse key (heals legacy cards).
async function ensureReferralCode(uid, env) {
  const card = await issueMemberCard(uid, env);   // idempotent
  if (!card) return null;
  let dirty = false;
  if (!card.code) { card.code = refCodeForNum(card.num); dirty = true; }
  if (card.refCount == null) { card.refCount = 0; dirty = true; }
  if (dirty) await env.SESSION.put(`member:${uid}`, JSON.stringify(card));
  await env.SESSION.put(`refcode:${card.code}`, uid);
  return card;
}

async function resolveRefCode(code, env) {
  if (!env.SESSION || !code) return null;
  return await env.SESSION.get(`refcode:${code}`);
}

// Invitee sent the prefilled "引薦 CODE" — stash pending attribution (no reward yet).
async function capturePendingRef(inviteeUid, code, env) {
  if (!env.SESSION || !inviteeUid || !code) return false;
  const inviterUid = await resolveRefCode(code, env);
  if (!inviterUid || inviterUid === inviteeUid) return false;   // unknown code or self-referral
  await env.SESSION.put(`pending_ref:${inviteeUid}`,
    JSON.stringify({ code, inviterUid, ts: Date.now() }),
    { expirationTtl: REF_PENDING_TTL });
  return true;
}

async function grantReward(uid, role, refId, reward, env) {
  if (!env.CRM) return null;
  const code = `${role.slice(0, 3).toUpperCase()}-${refId}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  try {
    await env.CRM.prepare(
      'INSERT INTO rewards (uid, role, ref_id, value_type, value, label_public, discount_code) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(uid, role, refId, reward.value_type, reward.value, reward.label, code).run();
  } catch (err) { console.error('grantReward failed:', err.message); return null; }
  return code;
}

async function pushMsg(to, messages, env) {
  if (!to || !env.LINE_CHANNEL_ACCESS_TOKEN) return;
  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, messages }),
    });
  } catch (err) { console.error('pushMsg failed:', err.message); }
}

// Called the moment an invitee qualifies (inquiry/campaign). Idempotent + guarded.
// opts.pushInvitee=false → don't push the invitee (cross-OA: caller delivers it
// with its own channel token). Always returns a result object.
async function finalizeReferral(inviteeUid, inquiryId, sourceOa, env, opts = {}) {
  if (!env.SESSION || !env.CRM || !inviteeUid) return { ok: false, reason: 'not-configured' };
  try {
    const raw = await env.SESSION.get(`pending_ref:${inviteeUid}`);
    if (!raw) return { ok: false, reason: 'no-pending' };
    const p = JSON.parse(raw);
    const inviterUid = p.inviterUid || await resolveRefCode(p.code, env);
    if (!inviterUid || inviterUid === inviteeUid) {
      await env.SESSION.delete(`pending_ref:${inviteeUid}`);
      return { ok: false, reason: 'self-or-unknown' };
    }
    // one attribution per invitee lifetime (UNIQUE index is the hard guard)
    const existing = await env.CRM.prepare('SELECT id FROM referrals WHERE invitee_uid = ?').bind(inviteeUid).first();
    if (existing) { await env.SESSION.delete(`pending_ref:${inviteeUid}`); return { ok: false, reason: 'already-attributed' }; }

    // rate-limit → flag for owner review instead of auto-rewarding
    const wk = await env.CRM.prepare(
      "SELECT COUNT(*) AS n FROM referrals WHERE inviter_uid = ? AND status IN ('qualified','rewarded') AND qualified_at > datetime('now','-7 days')"
    ).bind(inviterUid).first();
    const flagged = (wk?.n || 0) >= REF_WEEK_LIMIT;

    const res = await env.CRM.prepare(
      "INSERT INTO referrals (code, inviter_uid, invitee_uid, source_oa, status, inquiry_id, qualified_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
    ).bind(p.code, inviterUid, inviteeUid, sourceOa || '3q-hatchery', flagged ? 'review' : 'qualified', inquiryId || null).run();
    const refId = res?.meta?.last_row_id || null;
    await env.SESSION.delete(`pending_ref:${inviteeUid}`);

    if (flagged) {
      if (env.OWNER_USER_ID) await pushMsg(env.OWNER_USER_ID, [{ type: 'text', text: `⚠️ 引薦待審：${p.code} 一週內已達上限，請人工確認。` }], env);
      return { ok: true, status: 'review', code: p.code };
    }

    // bump inviter cumulative count (drives the ladder)
    let count = 1;
    const cur = await env.SESSION.get(`member:${inviterUid}`);
    if (cur) {
      const card = JSON.parse(cur);
      card.refCount = (card.refCount || 0) + 1;
      count = card.refCount;
      await env.SESSION.put(`member:${inviterUid}`, JSON.stringify(card));
    }

    const invR = inviterReward(count);
    const inviterCode = await grantReward(inviterUid, 'inviter', refId, invR, env);
    const inviteeCode = await grantReward(inviteeUid, 'invitee', refId, INVITEE_REWARD, env);
    if (refId) await env.CRM.prepare("UPDATE referrals SET status='rewarded' WHERE id=?").bind(refId).run();

    // inviter always lives on this (hatchery) channel — their code was issued here
    await pushMsg(inviterUid, [{ type: 'text',
      text: `你引薦的朋友入席了。\n\n${invR.label}已為你記上 — 你的第 ${count} 位引薦。\n禮遇碼：${inviterCode}\n（諮詢時出示即可）` }], env);
    // invitee may be on another OA → caller can opt out and deliver it itself
    if (opts.pushInvitee !== false) {
      await pushMsg(inviteeUid, [{ type: 'text',
        text: `你的${INVITEE_REWARD.label}已備好。\n禮遇碼：${inviteeCode}\n（諮詢時出示即可）` }], env);
    }
    if (env.OWNER_USER_ID) await pushMsg(env.OWNER_USER_ID, [{ type: 'text', text: `🎉 引薦成立：${p.code} → 第 ${count} 位（${sourceOa || '3q-hatchery'}）` }], env);
    return {
      ok: true, status: 'rewarded', code: p.code, count,
      inviter: { reward: invR.label, code: inviterCode },
      invitee: { reward: INVITEE_REWARD.label, code: inviteeCode },
    };
  } catch (err) {
    console.error('finalizeReferral failed:', err.message);
    return { ok: false, reason: err.message };
  }
}

function referralCardFlex(card, env) {
  const code = card.code;
  const count = card.refCount || 0;
  return FLEX('你的引薦碼', {
    type: 'bubble', size: 'mega',
    body: {
      type: 'box', layout: 'vertical', backgroundColor: '#0A0A0A', paddingAll: '24px', spacing: 'sm',
      contents: [
        { type: 'text', text: 'INTRODUCTION · 引薦', color: '#B8924A', size: 'xxs', weight: 'bold', letterSpacing: '3px' },
        { type: 'text', text: code, color: '#F5F2EC', size: 'xxl', weight: 'bold', margin: 'sm' },
        { type: 'separator', margin: 'md', color: '#B8924A' },
        { type: 'text', text: '把信任的人帶進這個房間。\n他完成諮詢，兩邊都收到禮遇。', color: '#8A8A8A', size: 'sm', wrap: true, margin: 'md' },
        { type: 'box', layout: 'horizontal', margin: 'md', contents: [
          { type: 'text', text: '已引薦', color: '#8A8A8A', size: 'xs', flex: 1 },
          { type: 'text', text: `${count} 位`, color: '#B8924A', size: 'xs', flex: 2, align: 'end', weight: 'bold' },
        ]},
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', backgroundColor: '#F5F2EC', paddingAll: '16px', spacing: 'sm',
      contents: [
        { type: 'button', style: 'primary', color: '#0A0A0A', height: 'sm',
          action: { type: 'uri', label: '用 LINE 引薦朋友', uri: referralDeepLink(code, env) } },
        { type: 'button', style: 'secondary', height: 'sm',
          action: { type: 'uri', label: '分享引薦連結', uri: referralSiteLink(code, env) } },
      ],
    },
  });
}

function seatWelcomeFlex(code) {
  return FLEX('為你留了席', {
    type: 'bubble', size: 'mega',
    body: {
      type: 'box', layout: 'vertical', backgroundColor: '#0A0A0A', paddingAll: '24px', spacing: 'sm',
      contents: [
        { type: 'text', text: '為你留了席', color: '#B8924A', size: 'xxs', weight: 'bold', letterSpacing: '3px' },
        { type: 'text', text: '有人把你引薦進來。', color: '#F5F2EC', size: 'lg', weight: 'bold', wrap: true, margin: 'sm' },
        { type: 'separator', margin: 'md', color: '#B8924A' },
        { type: 'text', text: `引薦碼 ${code} 已記下。\n完成一次諮詢，你的入席禮就會送到。`, color: '#8A8A8A', size: 'sm', wrap: true, margin: 'md' },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', backgroundColor: '#F5F2EC', paddingAll: '16px',
      contents: [{
        type: 'button', style: 'primary', color: '#0A0A0A', height: 'sm',
        action: { type: 'postback', label: '說說我的店', data: 'menu:my-store', displayText: '說說我的店' },
      }],
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// v3.7: Daily lottery — 霸王餐 / 免費做圖. Enter with「抽」, draw 20:00 TW,
//   winner must SHARE to claim (share-to-claim) → every win seeds new traffic.
// ─────────────────────────────────────────────────────────────────────────

function twDateStr() {
  return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
}

async function lotteryEnter(uid, env) {
  if (!env.SESSION || !uid) return 'error';
  try {
    const key = `lottery:${twDateStr()}:entries`;
    const cur = await env.SESSION.get(key);
    const list = cur ? JSON.parse(cur) : [];
    if (list.includes(uid)) return 'already';
    list.push(uid);
    await env.SESSION.put(key, JSON.stringify(list), { expirationTtl: 60 * 60 * 48 });
    return 'ok';
  } catch { return 'error'; }
}

function lotteryWinnerFlex(shareUri) {
  return FLEX('你被抽中了', {
    type: 'bubble', size: 'mega',
    body: {
      type: 'box', layout: 'vertical', backgroundColor: '#0A0A0A', paddingAll: '24px', spacing: 'sm',
      contents: [
        { type: 'text', text: 'TODAY · 霸王餐', color: '#B8924A', size: 'xxs', weight: 'bold', letterSpacing: '3px' },
        { type: 'text', text: '今晚的好東西，留給你了。', color: '#F5F2EC', size: 'lg', weight: 'bold', wrap: true, margin: 'sm' },
        { type: 'separator', margin: 'md', color: '#B8924A' },
        { type: 'text', text: '霸王餐福利 / 免費做圖一張。\n領獎只有一個規矩：把好東西分享出去 —\n分享後按下方「我分享了」，顧問就為你備上。', color: '#8A8A8A', size: 'sm', wrap: true, margin: 'md' },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', backgroundColor: '#F5F2EC', paddingAll: '16px', spacing: 'sm',
      contents: [
        { type: 'button', style: 'primary', color: '#0A0A0A', height: 'sm',
          action: { type: 'uri', label: '分享好東西', uri: shareUri } },
        { type: 'button', style: 'secondary', height: 'sm',
          action: { type: 'postback', label: '我分享了，領獎', data: 'lottery:claim', displayText: '我分享了，領獎' } },
      ],
    },
  });
}

async function runLotteryDraw(env) {
  if (!env.SESSION) return { skipped: 'no kv' };
  const date = twDateStr();
  try {
    const cur = await env.SESSION.get(`lottery:${date}:entries`);
    const list = cur ? JSON.parse(cur) : [];
    if (!list.length) return { skipped: 'no entries', date };
    const winner = list[Math.floor(Math.random() * list.length)];
    await env.SESSION.put(`lottery:${date}:winner`,
      JSON.stringify({ uid: winner, claimed: false }), { expirationTtl: 60 * 60 * 72 });
    // winner: personalised share link (their own referral deep link) + claim flow
    const card = await ensureReferralCode(winner, env);
    const shareUri = card ? referralDeepLink(card.code, env) : (env.SITE_BASE_URL || 'https://milk790-code.github.io/3q-hatchery-line-oa/');
    await pushMsg(winner, [lotteryWinnerFlex(shareUri)], env);
    // group announcement (if bot has been added to a group → groupId captured on join)
    const gid = await env.SESSION.get('group:main');
    if (gid) await pushMsg(gid, [{ type: 'text',
      text: '今日霸王餐 / 免費做圖 — 開獎了。\n得主已私訊通知。\n\n明天想抽？在這裡打「抽」就入場。' }], env);
    if (env.OWNER_USER_ID) await pushMsg(env.OWNER_USER_ID, [{ type: 'text',
      text: `🎁 今日抽獎開出：${winner}\n（${list.length} 人參加，待得主分享領獎）` }], env);
    return { ok: true, date, entries: list.length, winner };
  } catch (err) {
    console.error('runLotteryDraw failed:', err.message);
    return { error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// D1 helpers
// ─────────────────────────────────────────────────────────────────────────

function leadScore(budget) {
  return budget === 'high' ? 'hot' : budget === 'mid' ? 'warm' : 'cold';
}

async function saveInquiry(uid, a, env, sourceOa = '3q-hatchery') {
  if (!env.CRM) return;
  const score = leadScore(a.budget);
  try {
    const result = await env.CRM.prepare(
      'INSERT INTO inquiries (user_id, service, budget, timeline, free_text, lead_score, source_oa) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(uid || 'unknown', a.service || null, a.budget || null, a.timeline || null, a.freeText || null, score, sourceOa).run();
    return result?.meta?.last_row_id || null;
  } catch (err) {
    console.error('D1 inquiries insert failed:', err.message);
    return null;
  }
}

async function saveCampaignRegistration(uid, tier, price, env, sourceOa = '3q-hatchery') {
  if (!env.CRM) return;
  try {
    await env.CRM.prepare(
      'INSERT INTO campaigns (user_id, tier, price, source_oa) VALUES (?, ?, ?, ?)'
    ).bind(uid || 'unknown', tier, price, sourceOa).run();
  } catch (err) {
    console.error('D1 campaigns insert failed:', err.message);
  }
}

async function updateCampaignSamplePick(uid, pick, env) {
  if (!env.CRM) return;
  try {
    await env.CRM.prepare(
      'UPDATE campaigns SET sample_pick = ? WHERE id = (SELECT id FROM campaigns WHERE user_id = ? AND sample_pick IS NULL ORDER BY id DESC LIMIT 1)'
    ).bind(pick, uid).run();
  } catch (err) {
    console.error('D1 campaigns update failed:', err.message);
  }
}

// v3.6: project status query for 我的專案狀態 keyword
async function getMyStatus(uid, env) {
  if (!env.CRM) return { type: 'text', text: '專案狀態系統還沒接通，請聯絡顧問。' };
  const row = await env.CRM.prepare(
    'SELECT service, status, created_at FROM inquiries WHERE user_id=? ORDER BY id DESC LIMIT 1'
  ).bind(uid).first();
  if (!row) return { type: 'text', text: '還沒收到你的詢問記錄。\n打「說說我的店」開始填表。' };
  const STATUS_LABELS = { new: '🆕 新進案', contacted: '📞 已聯繫', quoted: '💰 已報價', converted: '✅ 已成交', closed: '📦 已結案' };
  return { type: 'text', text: `📋 你的最新專案\n\n服務：${row.service || '未填'}\n狀態：${STATUS_LABELS[row.status] || row.status}\n建立：${row.created_at}\n\n有問題隨時打「聯絡顧問」。` };
}

// A1: Update inquiry status (owner quick-reply action)
async function updateInquiryStatus(uid, status, env) {
  if (!env.CRM) return;
  try {
    await env.CRM.prepare(
      'UPDATE inquiries SET status = ? WHERE id = (SELECT id FROM inquiries WHERE user_id = ? ORDER BY id DESC LIMIT 1)'
    ).bind(status, uid).run();
    if (status === 'won')       await updateMemberTier(uid, 'partner',  env);
    if (status === 'contacted') await updateMemberTier(uid, 'inquired', env);
  } catch (err) {
    console.error('updateInquiryStatus failed:', err.message);
  }
}

// A3: Save booking request from user
async function saveBookingRequest(uid, note, env) {
  if (!env.CRM) return;
  try {
    await env.CRM.prepare(
      'UPDATE inquiries SET booking_requested = 1, booking_note = ? WHERE id = (SELECT id FROM inquiries WHERE user_id = ? ORDER BY id DESC LIMIT 1)'
    ).bind(note, uid).run();
  } catch (err) {
    console.error('saveBookingRequest failed:', err.message);
  }
}

// v4: Social event tracking (Phase 4)
async function saveSocialEvent(data, env) {
  if (!env.CRM) return null;
  try {
    const result = await env.CRM.prepare(
      'INSERT INTO social_events (utm_source, utm_medium, utm_campaign, utm_content, event_type, user_id, ip_hash, referrer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      data.utm_source || null,
      data.utm_medium || null,
      data.utm_campaign || null,
      data.utm_content || null,
      data.event_type || 'click',
      data.user_id || null,
      data.ip_hash || null,
      data.referrer || null,
    ).run();
    return result?.meta?.last_row_id || null;
  } catch (err) {
    console.error('saveSocialEvent failed:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Dashboard stats + CSV
// ─────────────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function tokensMatch(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function statsHandler(env) {
  if (!env.CRM) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
  try {
    const today = "datetime('now','localtime','start of day')";
    const [inquiriesTotal, inquiriesToday, campaignsTotal, campaignsToday, slotsKV,
           hotLeads, warmLeads, coldLeads, wonLeads] = await Promise.all([
      env.CRM.prepare('SELECT COUNT(*) AS n FROM inquiries').first(),
      env.CRM.prepare(`SELECT COUNT(*) AS n FROM inquiries WHERE created_at >= ${today}`).first(),
      env.CRM.prepare('SELECT COUNT(*) AS n FROM campaigns').first(),
      env.CRM.prepare(`SELECT COUNT(*) AS n FROM campaigns WHERE created_at >= ${today}`).first(),
      getCampaignSlots(env),
      env.CRM.prepare("SELECT COUNT(*) AS n FROM inquiries WHERE lead_score = 'hot'").first(),
      env.CRM.prepare("SELECT COUNT(*) AS n FROM inquiries WHERE lead_score = 'warm'").first(),
      env.CRM.prepare("SELECT COUNT(*) AS n FROM inquiries WHERE lead_score = 'cold'").first(),
      env.CRM.prepare("SELECT COUNT(*) AS n FROM inquiries WHERE status = 'won'").first(),
    ]);
    const revenue = await env.CRM.prepare('SELECT SUM(price) AS total FROM campaigns').first();
    const tierBreakdown = await env.CRM.prepare(
      'SELECT tier, COUNT(*) AS n, SUM(price) AS revenue FROM campaigns GROUP BY tier'
    ).all();
    return new Response(JSON.stringify({
      ok: true,
      now: new Date().toISOString(),
      inquiries: {
        total: inquiriesTotal?.n || 0,
        today: inquiriesToday?.n || 0,
        by_score: { hot: hotLeads?.n || 0, warm: warmLeads?.n || 0, cold: coldLeads?.n || 0 },
        won: wonLeads?.n || 0,
      },
      campaigns: {
        total: campaignsTotal?.n || 0,
        today: campaignsToday?.n || 0,
        revenue: revenue?.total || 0,
        slots_filled: {
          tier1: slotsKV.tier1.length,
          tier2: slotsKV.tier2.length,
          tier3: slotsKV.tier3.length,
        },
        slots_max: {
          tier1: CAMPAIGN_TIERS.tier1.max,
          tier2: CAMPAIGN_TIERS.tier2.max,
          tier3: CAMPAIGN_TIERS.tier3.max,
        },
        by_tier: tierBreakdown?.results || [],
      },
    }, null, 2), { headers: { 'Content-Type': 'application/json', ...CORS } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}

async function csvExportHandler(table, env) {
  if (!env.CRM) return new Response('D1 not bound', { status: 500 });
  const TABLE_SQL = {
    inquiries:     'SELECT * FROM inquiries ORDER BY id LIMIT 10000',
    campaigns:     'SELECT * FROM campaigns ORDER BY id LIMIT 10000',
    social_events:  'SELECT * FROM social_events ORDER BY id LIMIT 10000',
    content_queue:  'SELECT * FROM content_queue ORDER BY id LIMIT 10000',
  };
  const sql = TABLE_SQL[table];
  if (!sql) return new Response('invalid table', { status: 400 });
  try {
    const rows = await env.CRM.prepare(sql).all();
    const items = rows?.results || [];
    if (items.length === 0) return new Response('id\n', { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
    const headers = Object.keys(items[0]);
    const escape = (v) => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers.join(',')]
      .concat(items.map(r => headers.map(h => escape(r[h])).join(',')))
      .join('\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="3q-${table}-${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    return new Response(`error: ${err.message}`, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Scheduled — follow-up pushes (24h / 72h / 168h)
// ─────────────────────────────────────────────────────────────────────────

const FOLLOW_UPS = [
  { col: 'followed_up_24h',  hours: 24,  message: '收到你的諮詢 24 小時了 — 想到什麼了嗎？\n\n我們本月還有「+1」限時招募，前 30 位有優惠。也可以直接傳「實例」看作品。\n\n或傳「預約諮詢」預約 30 分鐘免費諮詢。' },
  { col: 'followed_up_72h',  hours: 72,  message: '3 天過去了 — 你還記得我們嗎？\n\n本月入駐 3 個店：阿婆ㄟ切仔麵 / 三代米舖 / 鹿港織坊。傳「01 / 02 / 03」單獨看。' },
  { col: 'followed_up_168h', hours: 168, message: '一週了 — 沒消息我們就不再打擾。\n\n如果還有興趣，傳「諮詢」我們重新對接。或傳「+1」進招募名單。' },
];

async function runFollowUps(env) {
  if (!env.CRM || !env.LINE_CHANNEL_ACCESS_TOKEN) return { ran: 0, sent: 0 };
  let sent = 0;
  for (const fu of FOLLOW_UPS) {
    const due = await env.CRM.prepare(
      `SELECT id, user_id FROM inquiries WHERE ${fu.col} = 0 AND created_at <= datetime('now', '-${fu.hours} hours') LIMIT 50`
    ).all();
    for (const row of (due?.results || [])) {
      try {
        await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: row.user_id, messages: [{ type: 'text', text: fu.message }] }),
        });
        await env.CRM.prepare(`UPDATE inquiries SET ${fu.col} = 1 WHERE id = ?`).bind(row.id).run();
        sent++;
      } catch (err) {
        console.error(`Follow-up ${fu.col} push failed for uid ${row.user_id}:`, err.message);
      }
    }
  }
  return { sent };
}

async function runWeeklyDigest(env) {
  if (!env.CRM || !env.OWNER_USER_ID || !env.LINE_CHANNEL_ACCESS_TOKEN) {
    return { skipped: 'missing env' };
  }
  try {
    const since = "datetime('now', '-7 days')";
    const [inq, cmp, rev, hot, warm, cold, won] = await Promise.all([
      env.CRM.prepare(`SELECT COUNT(*) AS n FROM inquiries WHERE created_at >= ${since}`).first(),
      env.CRM.prepare(`SELECT COUNT(*) AS n FROM campaigns WHERE created_at >= ${since}`).first(),
      env.CRM.prepare(`SELECT COALESCE(SUM(price), 0) AS r FROM campaigns WHERE created_at >= ${since}`).first(),
      env.CRM.prepare(`SELECT COUNT(*) AS n FROM inquiries WHERE lead_score = 'hot' AND created_at >= ${since}`).first(),
      env.CRM.prepare(`SELECT COUNT(*) AS n FROM inquiries WHERE lead_score = 'warm' AND created_at >= ${since}`).first(),
      env.CRM.prepare(`SELECT COUNT(*) AS n FROM inquiries WHERE lead_score = 'cold' AND created_at >= ${since}`).first(),
      env.CRM.prepare(`SELECT COUNT(*) AS n FROM inquiries WHERE status = 'won' AND created_at >= ${since}`).first(),
    ]);
    const slots = await getCampaignSlots(env);
    const total_slots = slots.tier1.length + slots.tier2.length + slots.tier3.length;
    const subs = await getSubscribers(env);
    const text = [
      '📊 3Q 週報 (本週)',
      '',
      `新諮詢：${inq?.n || 0} 筆`,
      `  🔥 熱：${hot?.n || 0}  ⚡ 暖：${warm?.n || 0}  🌱 冷：${cold?.n || 0}`,
      `  🎉 本週成交：${won?.n || 0} 筆`,
      '',
      `新報名：${cmp?.n || 0} 位`,
      `本週收入：NT$ ${(rev?.r || 0).toLocaleString()}`,
      '',
      `招募進度：${total_slots}/30 位`,
      `  · 100元梯：${slots.tier1.length}/10`,
      `  · 200元梯：${slots.tier2.length}/10`,
      `  · 300元梯：${slots.tier3.length}/10`,
      '',
      `訂閱人數：${subs.length} 人`,
      '',
      'Dashboard: https://milk790-code.github.io/3q-hatchery-line-oa/ui_kits/dashboard/',
    ].join('\n');

    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: env.OWNER_USER_ID, messages: [{ type: 'text', text }] }),
    });
    return { inq: inq?.n, cmp: cmp?.n, rev: rev?.r };
  } catch (err) {
    console.error('Weekly digest failed:', err.message);
    return { error: err.message };
  }
}

// A-B3: Seasonal push to subscriber list (runs on 1st of Mar/Jun/Sep/Dec)
async function runSeasonalPush(env) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) return { skipped: 'no token' };
  const subscribers = await getSubscribers(env);
  if (subscribers.length === 0) return { skipped: 'no subscribers' };
  const month = new Date(Date.now() + 8 * 3600000).getUTCMonth() + 1;
  const SEASONAL_MSG = {
    3:  '🌸 春季開始了。\n\n3Q 春季限定：春茶品牌 × 農場攝影，3 月限時招募。\n傳「春茶」看今季活動，或傳「+1」搶先報名。',
    6:  '☀️ 夏天來了。\n\n3Q 夏季限定：夏日食品 × 清爽風格攝影，6 月限時招募。\n傳「夏日」看今季活動，或傳「+1」搶先報名。',
    9:  '🍂 秋季到了。\n\n3Q 秋季限定：中秋禮盒 × 溫暖質感攝影，9 月限時招募。\n傳「秋季」看今季活動，或傳「+1」搶先報名。',
    12: '❄️ 冬天了。\n\n3Q 冬季限定：年節禮品 × 溫暖光影攝影，12 月限時招募。\n傳「冬季」看今季活動，或傳「+1」搶先報名。',
  };
  const msg = SEASONAL_MSG[month];
  if (!msg) return { skipped: 'not a seasonal month' };
  let sent = 0;
  for (const uid of subscribers) {
    try {
      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: uid, messages: [{ type: 'text', text: msg }] }),
      });
      sent++;
    } catch (err) {
      console.error(`Seasonal push failed for uid ${uid}:`, err.message);
    }
  }
  return { sent, total: subscribers.length, month };
}

// ─────────────────────────────────────────────────────────────────────────
// Flex Message builders
// ─────────────────────────────────────────────────────────────────────────

const HERO = (url, ratio = '20:13') => ({
  type: 'image', url, size: 'full', aspectRatio: ratio, aspectMode: 'cover',
});

const FLEX = (alt, bubble) => ({ type: 'flex', altText: alt, contents: bubble });

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

function serviceCard(base) {
  const bubble = {
    type: 'bubble', size: 'mega',
    header: DARK_HEADER('你想做什麼', '選一個最接近的，我們從這裡開始'),
    body: LIGHT_BODY([
      BTN('📸 好物・好照　質感生圖',  'flow:service=imagery',   true,  '好物・好照'),
      BTN('🎯 客製行銷　品牌陪跑',    'flow:service=marketing', true,  '客製行銷'),
      BTN('🌸 季節活動　節慶視覺',    'flow:service=seasonal',  true,  '季節活動'),
      BTN('💬 先說說我的店',          'flow:service=consult',   false, '先說說我的店'),
    ]),
  };
  if (base) bubble.hero = HERO(`${base}/3q-cover-bowl-1080x878.png`, '20:16');
  return FLEX('你想做什麼？', bubble);
}

function budgetCard(svc, base) {
  const bubble = {
    type: 'bubble', size: 'mega',
    header: DARK_HEADER(SERVICE_LABELS[svc] || svc, SERVICE_DESC[svc] || ''),
    body: LIGHT_BODY([
      { type: 'text', text: '預算大概在哪裡', color: '#1A1A1A', size: 'md', weight: 'bold' },
      { type: 'separator', margin: 'sm', color: '#E8DFD0' },
      BTN('🌱 5,000 元以下　試水溫',  `flow:budget=low&s=${svc}`,  true, '5,000 元以下'),
      BTN('⚡ 5,000–20,000　認真做',  `flow:budget=mid&s=${svc}`,  true, '5,000–20,000 元'),
      BTN('✨ 20,000 以上　深度合作', `flow:budget=high&s=${svc}`, true, '20,000 元以上'),
    ]),
  };
  if (base) {
    const h = SERVICE_HERO[svc] || { file: '3q-cover-bowl-1080x878.png', ratio: '20:16' };
    bubble.hero = HERO(`${base}/${h.file}`, h.ratio);
  }
  return FLEX('預算大概在哪裡？', bubble);
}

function timelineCard(svc, bgt) {
  return FLEX('時間上大概是？', {
    type: 'bubble', size: 'mega',
    header: DARK_HEADER('時間上大概是', `${SERVICE_LABELS[svc] || svc}　${BUDGET_LABELS[bgt] || bgt}`),
    body: LIGHT_BODY([
      BTN('🔥 一個月內　急',         `flow:timeline=urgent&s=${svc}&b=${bgt}`,  true, '一個月內'),
      BTN('🎵 一到三個月　正常節奏',  `flow:timeline=normal&s=${svc}&b=${bgt}`,  true, '一到三個月'),
      BTN('☕ 三個月以上　慢慢來',    `flow:timeline=relaxed&s=${svc}&b=${bgt}`, true, '三個月以上'),
    ]),
  });
}

const freeTextPrompt = () => ({
  type: 'text',
  text: '最後一題，也是最重要的。\n\n用一句話說說你的店，或這次最想解決的事。\n\n（想跳出隨時打「取消」）',
});

function summaryCard(a) {
  const rows = [
    ['需求', SERVICE_LABELS[a.service]   || a.service   || '—'],
    ['預算', BUDGET_LABELS[a.budget]     || a.budget     || '—'],
    ['時間', TIMELINE_LABELS[a.timeline] || a.timeline   || '—'],
    ['你說', a.freeText                                  || '—'],
  ];
  return FLEX('確認需求', {
    type: 'bubble', size: 'mega',
    header: DARK_HEADER('確認一下', '這是我們收到的資訊'),
    body: {
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
  });
}

function flowParams(data) {
  const body = data.slice('flow:'.length);
  if (!body.includes('=')) return {};
  return Object.fromEntries(body.split('&').map(kv => kv.split('=')));
}

// ─────────────────────────────────────────────────────────────────────────
// Main fetch handler
// ─────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/stats' && request.method === 'GET') {
      return await statsHandler(env);
    }

    if (url.pathname === '/api/csv' && request.method === 'GET') {
      const auth = request.headers.get('Authorization') || '';
      const tok = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return new Response('forbidden', { status: 403 });
      return await csvExportHandler(url.searchParams.get('table') || 'inquiries', env);
    }

    // v4: GET /api/member/:userId — cross-bot member lookup
    if (url.pathname.startsWith('/api/member/') && request.method === 'GET') {
      const auth = request.headers.get('Authorization') || '';
      const tok = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return new Response('forbidden', { status: 403 });
      const userId = url.pathname.slice('/api/member/'.length);
      if (!userId) return new Response(JSON.stringify({ ok: false, error: 'userId required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
      const raw = env.SESSION ? await env.SESSION.get(`member:${userId}`) : null;
      if (!raw) return new Response(JSON.stringify({ ok: false, error: 'member not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
      const card = JSON.parse(raw);
      return new Response(JSON.stringify({ ok: true, userId, ...card }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // v4: POST /api/inquiry — cross-bot inquiry recording
    if (url.pathname === '/api/inquiry' && request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      const tok = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return new Response('forbidden', { status: 403 });
      let body;
      try { body = await request.json(); } catch { return new Response(JSON.stringify({ ok: false, error: 'invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } }); }
      const uid = body.userId || body.uid;
      if (!uid) return new Response(JSON.stringify({ ok: false, error: 'userId required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
      const a = { service: body.service, budget: body.budget, timeline: body.timeline, freeText: body.freeText };
      const rowId = await saveInquiry(uid, a, env, body.sourceOa || 'external');
      return new Response(JSON.stringify({ ok: true, id: rowId, leadScore: leadScore(body.budget) }), { status: 201, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // v3.7: GET /api/referral/code/:uid — issue/return a member's referral code (cross-OA)
    if (url.pathname.startsWith('/api/referral/code/') && request.method === 'GET') {
      const auth = request.headers.get('Authorization') || '';
      const tok = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return new Response('forbidden', { status: 403 });
      const uid = decodeURIComponent(url.pathname.slice('/api/referral/code/'.length));
      const card = await ensureReferralCode(uid, env);
      if (!card) return new Response(JSON.stringify({ ok: false, error: 'cannot issue' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
      return new Response(JSON.stringify({ ok: true, code: card.code, refCount: card.refCount || 0,
        deepLink: referralDeepLink(card.code, env), siteLink: referralSiteLink(card.code, env) }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // v3.7: POST /api/referral/capture — stash pending attribution (cross-OA invitee)
    if (url.pathname === '/api/referral/capture' && request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      const tok = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return new Response('forbidden', { status: 403 });
      let body; try { body = await request.json(); } catch { return new Response(JSON.stringify({ ok: false, error: 'invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } }); }
      const uid = body.userId || body.uid;
      if (!uid || !body.code) return new Response(JSON.stringify({ ok: false, error: 'uid and code required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
      const ok = await capturePendingRef(uid, String(body.code).toUpperCase(), env);
      return new Response(JSON.stringify({ ok }), { status: ok ? 201 : 200, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // v3.7: POST /api/referral/finalize — qualify a cross-OA invitee on their inquiry
    if (url.pathname === '/api/referral/finalize' && request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      const tok = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return new Response('forbidden', { status: 403 });
      let body; try { body = await request.json(); } catch { return new Response(JSON.stringify({ ok: false, error: 'invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } }); }
      const uid = body.userId || body.uid;
      if (!uid) return new Response(JSON.stringify({ ok: false, error: 'uid required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
      // pushInvitee:false → caller (e.g. gongwan) delivers invitee reward on its own channel
      const result = await finalizeReferral(uid, body.inquiryId || null, body.sourceOa || 'external', env, { pushInvitee: false });
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // v4: GET /api/member/list — list all member card keys (batch sync)
    if (url.pathname === '/api/member/list' && request.method === 'GET') {
      const auth = request.headers.get('Authorization') || '';
      const tok = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return new Response('forbidden', { status: 403 });
      if (!env.SESSION) return new Response(JSON.stringify({ ok: false, error: 'KV not bound' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
      const list = await env.SESSION.list({ prefix: 'member:' });
      const members = [];
      for (const key of (list.keys || [])) {
        if (key.name === 'member:next_num') continue;
        const raw = await env.SESSION.get(key.name);
        if (raw) members.push({ userId: key.name.slice('member:'.length), ...JSON.parse(raw) });
      }
      return new Response(JSON.stringify({ ok: true, count: members.length, members }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // v4: POST /api/social-event — public UTM tracking (no auth — called from redirect page)
    if (url.pathname === '/api/social-event' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return new Response(JSON.stringify({ ok: false, error: 'invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } }); }
      if (!body.utm_source || !body.utm_campaign) return new Response(JSON.stringify({ ok: false, error: 'utm_source and utm_campaign required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
      const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '';
      let ip_hash = null;
      if (ip) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
        ip_hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
      }
      await saveSocialEvent({ ...body, ip_hash, referrer: request.headers.get('Referer') }, env);
      return new Response(JSON.stringify({ ok: true }), { status: 201, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // v4: GET /api/social-stats — UTM aggregation (TRIGGER_TOKEN required)
    if (url.pathname === '/api/social-stats' && request.method === 'GET') {
      const auth = request.headers.get('Authorization') || '';
      const tok = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return new Response('forbidden', { status: 403 });
      if (!env.CRM) return new Response(JSON.stringify({ ok: false, error: 'D1 not bound' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
      const [byCampaign, bySource] = await Promise.all([
        env.CRM.prepare("SELECT utm_campaign, event_type, COUNT(*) AS n FROM social_events GROUP BY utm_campaign, event_type ORDER BY n DESC LIMIT 100").all(),
        env.CRM.prepare("SELECT utm_source, COUNT(*) AS n FROM social_events GROUP BY utm_source ORDER BY n DESC").all(),
      ]);
      return new Response(JSON.stringify({ ok: true, by_campaign: byCampaign.results || [], by_source: bySource.results || [] }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // v4: GET /track — UTM redirect micropage for social posts
    if (url.pathname === '/track' && request.method === 'GET') {
      const params = url.searchParams;
      const utm_source = params.get('utm_source');
      const utm_campaign = params.get('utm_campaign');
      if (utm_source && utm_campaign) {
        const ip = request.headers.get('CF-Connecting-IP') || '';
        let ip_hash = null;
        if (ip) {
          const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
          ip_hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
        }
        await saveSocialEvent({
          utm_source,
          utm_campaign,
          utm_medium: params.get('utm_medium'),
          utm_content: params.get('utm_content'),
          user_id: params.get('ref') || null,
          ip_hash,
          referrer: request.headers.get('Referer'),
        }, env);
      }
      const destination = 'https://line.me/R/ti/p/@121LKSPE';
      return new Response(null, { status: 302, headers: { Location: destination } });
    }

    // v4: Content queue CRUD — POST /api/content, GET /api/content, PATCH /api/content/:id
    if (url.pathname === '/api/content' && request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      const tok = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return new Response('forbidden', { status: 403 });
      if (!env.CRM) return new Response(JSON.stringify({ ok: false, error: 'D1 not bound' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
      let body;
      try { body = await request.json(); } catch { return new Response(JSON.stringify({ ok: false, error: 'invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } }); }
      const { platform, image_url, caption_seed, caption, topic_tag, scheduled_at } = body;
      if (!platform) return new Response(JSON.stringify({ ok: false, error: 'platform required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
      const result = await env.CRM.prepare(
        'INSERT INTO content_queue (platform, image_url, caption_seed, caption, topic_tag, scheduled_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(platform, image_url || null, caption_seed || null, caption || null, topic_tag || null, scheduled_at || null).run();
      return new Response(JSON.stringify({ ok: true, id: result?.meta?.last_row_id }), { status: 201, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    if (url.pathname === '/api/content' && request.method === 'GET') {
      const auth = request.headers.get('Authorization') || '';
      const tok = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return new Response('forbidden', { status: 403 });
      if (!env.CRM) return new Response(JSON.stringify({ ok: false, error: 'D1 not bound' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
      const platform = url.searchParams.get('platform') || null;
      const status   = url.searchParams.get('status')   || 'pending';
      const limit    = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
      let sql = 'SELECT * FROM content_queue WHERE status = ?';
      const binds = [status];
      if (platform) { sql += ' AND platform = ?'; binds.push(platform); }
      sql += ' ORDER BY scheduled_at ASC, id ASC LIMIT ?';
      binds.push(limit);
      const rows = await env.CRM.prepare(sql).bind(...binds).all();
      return new Response(JSON.stringify({ ok: true, count: rows.results?.length || 0, posts: rows.results || [] }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    if (url.pathname.startsWith('/api/content/') && request.method === 'PATCH') {
      const auth = request.headers.get('Authorization') || '';
      const tok = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return new Response('forbidden', { status: 403 });
      if (!env.CRM) return new Response(JSON.stringify({ ok: false, error: 'D1 not bound' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
      const id = parseInt(url.pathname.slice('/api/content/'.length), 10);
      if (!id) return new Response(JSON.stringify({ ok: false, error: 'invalid id' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
      let body;
      try { body = await request.json(); } catch { return new Response(JSON.stringify({ ok: false, error: 'invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } }); }
      const fields = ['caption', 'caption_seed', 'image_url', 'topic_tag', 'scheduled_at', 'status'];
      const updates = fields.filter(f => body[f] !== undefined);
      if (updates.length === 0) return new Response(JSON.stringify({ ok: false, error: 'no fields to update' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
      const sql = `UPDATE content_queue SET ${updates.map(f => `${f} = ?`).join(', ')} WHERE id = ?`;
      await env.CRM.prepare(sql).bind(...updates.map(f => body[f]), id).run();
      return new Response(JSON.stringify({ ok: true, id }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        service: '3Q Hatchery LINE OA webhook',
        ok: true, version: 3.7,
        configured: {
          token:       Boolean(env.LINE_CHANNEL_ACCESS_TOKEN),
          secret:      Boolean(env.LINE_CHANNEL_SECRET),
          png_base:    env.PNG_BASE_URL || null,
          session_kv:  Boolean(env.SESSION),
          crm_d1:      Boolean(env.CRM),
          owner_push:  Boolean(env.OWNER_USER_ID),
          ai_llm:      Boolean(env.AI),
          trigger:     Boolean(env.TRIGGER_TOKEN),
          richmenu:    Boolean(env.RICHMENU_NEW),
        },
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

  async scheduled(event, env, ctx) {
    if (event.cron === '5 * * * *') {
      ctx.waitUntil(runFollowUps(env).then(r => console.log('Follow-up ran:', JSON.stringify(r))));
    }
    if (event.cron === '0 13 * * 1') {
      ctx.waitUntil(runWeeklyDigest(env).then(r => console.log('Weekly digest:', JSON.stringify(r))));
    }
    // Seasonal push: 1st of Mar / Jun / Sep / Dec at 09:00 TW (01:00 UTC)
    if (event.cron === '0 1 1 3,6,9,12 *') {
      ctx.waitUntil(runSeasonalPush(env).then(r => console.log('Seasonal push:', JSON.stringify(r))));
    }
    // v3.7: daily lottery draw at 20:00 TW (12:00 UTC)
    if (event.cron === '0 12 * * *') {
      ctx.waitUntil(runLotteryDraw(env).then(r => console.log('Lottery draw:', JSON.stringify(r))));
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Event routing
// ─────────────────────────────────────────────────────────────────────────

async function handleEvent(ev, env) {
  const uid = ev.source?.userId;

  if (ev.type === 'follow') {
    await clearSession(uid, env);
    const mCard = await issueMemberCard(uid, env);
    await addSubscriber(uid, env);
    await switchRichMenu(uid, env.RICHMENU_NEW, env);
    return sendWelcome(ev.replyToken, env, mCard);
  }

  // v3.7: bot added to a group/room → remember it as the lottery broadcast target
  if (ev.type === 'join') {
    const gid = ev.source?.groupId || ev.source?.roomId;
    if (gid && env.SESSION) await env.SESSION.put('group:main', gid);
    return replyMsg(ev.replyToken, [{ type: 'text',
      text: '我進來了。\n這裡每天送霸王餐與免費做圖一張 — 想抽就打「抽」。\n晚上 8 點開獎，得主分享後即可領。' }], env);
  }

  if (ev.type === 'postback') {
    const d = ev.postback?.data || '';
    if (d.startsWith('flow:')) return handleFlow(d, uid, ev.replyToken, env);

    // A2: Owner quick-reply status buttons
    if (d.startsWith('owner:')) {
      const params = Object.fromEntries(d.slice('owner:'.length).split('&').map(kv => kv.split('=')));
      if (params.status && params.uid) {
        await updateInquiryStatus(params.uid, params.status, env);
        const labels = { contacted: '已聯繫 ✓', lost: '不感興趣', won: '成交 🎉' };
        return replyMsg(ev.replyToken, [{ type: 'text', text: `已更新：${labels[params.status] || params.status}` }], env);
      }
    }

    // v3.7: lottery winner claims after sharing (share-to-claim)
    if (d === 'lottery:claim') {
      const date = twDateStr();
      const raw = env.SESSION ? await env.SESSION.get(`lottery:${date}:winner`) : null;
      const w = raw ? JSON.parse(raw) : null;
      if (!w || w.uid !== uid) {
        return replyMsg(ev.replyToken, [{ type: 'text', text: '今天的獎不是這個帳號中的喔。\n想參加明天的，打「抽」就入場。' }], env);
      }
      if (!w.claimed) {
        w.claimed = true;
        await env.SESSION.put(`lottery:${date}:winner`, JSON.stringify(w), { expirationTtl: 60 * 60 * 72 });
        if (env.OWNER_USER_ID) await pushMsg(env.OWNER_USER_ID, [{ type: 'text', text: `✅ 抽獎得主已分享領獎：${uid}\n請安排霸王餐 / 免費做圖交付。` }], env);
      }
      return replyMsg(ev.replyToken, [{ type: 'text', text: '收到，謝謝你把好東西傳出去。\n顧問會私訊你安排霸王餐 / 免費做圖。' }], env);
    }

    const MENU = {
      'menu:my-store':  () => replyMsg(ev.replyToken, [serviceCard(env.PNG_BASE_URL)], env),
      'menu:imagery':   () => replyMsg(ev.replyToken, [budgetCard('imagery', env.PNG_BASE_URL)], env),
      'menu:marketing': () => replyMsg(ev.replyToken, [budgetCard('marketing', env.PNG_BASE_URL)], env),
      'menu:progress':  () => handleIntent('查我的進度', ev.replyToken, env, uid),
    };
    if (MENU[d]) return MENU[d]();
  }

  if (ev.type === 'message' && ev.message?.type === 'text') {
    const text = ev.message.text || '';

    if (ESCAPE_RE.test(text.trim())) {
      await clearSession(uid, env);
      return replyMsg(ev.replyToken, [{
        type: 'text',
        text: '已取消。\n\n要重新開始，傳「說說我的店」。\n或直接傳關鍵字（春茶 / 謝謝 / 實例 / 推薦 ...）。',
      }], env);
    }

    // B3: Subscription management
    if (text.trim() === '訂閱') {
      await addSubscriber(uid, env);
      return replyMsg(ev.replyToken, [{
        type: 'text',
        text: '已加入訂閱 ✓\n\n每季活動、限定優惠，我們會第一時間通知你。\n\n傳「取消訂閱」可隨時退出。',
      }], env);
    }
    if (text.trim() === '取消訂閱') {
      await removeSubscriber(uid, env);
      return replyMsg(ev.replyToken, [{
        type: 'text',
        text: '已取消訂閱。\n\n如果之後想重新加入，傳「訂閱」即可。',
      }], env);
    }

    // v3.7: Referral — capture attribution from the prefilled deep-link message
    const refCap = text.trim().match(/^引薦\s+([A-Za-z]\d{3,6})$/);
    if (refCap) {
      const code = refCap[1].toUpperCase();
      const ok = await capturePendingRef(uid, code, env);
      return replyMsg(ev.replyToken, [ ok
        ? seatWelcomeFlex(code)
        : { type: 'text', text: '這個引薦碼我找不到，確認一下有沒有打對？' } ], env);
    }

    // v3.7: Daily lottery — enter today's draw
    if (['抽', '抽獎', '霸王餐', '免費做圖'].includes(text.trim())) {
      const r = await lotteryEnter(uid, env);
      const msg = r === 'already'
        ? '今天你已經在抽獎名單裡了。\n晚上 8 點開獎，中了我們私訊你。'
        : r === 'ok'
        ? '入場了。\n今晚 8 點開獎 — 霸王餐 / 免費做圖一張。\n想多一份機會？把引薦連結分享出去（打「引薦」拿你的連結）。'
        : '抽獎暫時無法使用，稍後再試。';
      return replyMsg(ev.replyToken, [{ type: 'text', text: msg }], env);
    }

    // v3.7: Referral — show my referral card (realises the v3.7 介紹新客戶 placeholder)
    if (['引薦', '我的引薦碼', '推薦碼', '我的推薦碼', '介紹新客戶', '介紹朋友'].includes(text.trim())) {
      const card = await ensureReferralCode(uid, env);
      return replyMsg(ev.replyToken, [ card
        ? referralCardFlex(card, env)
        : { type: 'text', text: '引薦系統暫時無法使用，請稍後再試。' } ], env);
    }

    const session = await getSession(uid, env);

    // A3: Booking time text step
    if (session?.step === 'booking') {
      await saveBookingRequest(uid, text, env);
      await clearSession(uid, env);
      if (env.OWNER_USER_ID) {
        try {
          await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: env.OWNER_USER_ID,
              messages: [{ type: 'text', text: `📅 新預約請求\nUID：${uid}\n希望時段：${text}` }],
            }),
          });
        } catch {}
      }
      return replyMsg(ev.replyToken, [{
        type: 'text',
        text: '好的！我們會在 24 小時內確認時段並回覆你。\n\n先把你的店名稱和主要想聊的事情準備好，諮詢效率更高 😊',
      }], env);
    }

    if (session?.step === 'freetext') {
      const answers = { service: session.service, budget: session.budget, timeline: session.timeline, freeText: text };
      await saveSession(uid, { step: 'summary', ...answers }, env);
      return replyMsg(ev.replyToken, [summaryCard(answers)], env);
    }

    if (/^(試算|價格|多少錢|報價|預估)$/.test(text.trim())) {
      await saveSession(uid, { step: 'quote_qty' }, env);
      return replyMsg(ev.replyToken, [quoteQtyCard()], env);
    }

    if (/福袋|今日福袋|驚喜|抽福袋/.test(text.trim())) {
      const tw = new Date(Date.now() + 8 * 3600 * 1000);
      const hr = tw.getUTCHours();
      const slot = hr < 10 ? 'morning' : hr < 15 ? 'noon' : hr < 20 ? 'evening' : 'night';
      const msgs = [];
      if (env.PNG_BASE_URL) msgs.push({
        type: 'image',
        originalContentUrl: `${env.PNG_BASE_URL}/3q-lucky-bag-${slot}-1040.png`,
        previewImageUrl:    `${env.PNG_BASE_URL}/3q-lucky-bag-${slot}-1040.png`,
      });
      msgs.push({ type: 'text', text:
        `今日 ${slot === 'morning' ? '晨光' : slot === 'noon' ? '午陽' : slot === 'evening' ? '暮色' : '月光'}福袋\n\n每天四點開袋一次，限量驚喜。\n回「+1」報名活動參加抽福袋。` });
      return replyMsg(ev.replyToken, msgs, env);
    }

    if (/^\+1$|招募|活動|報名/.test(text.trim())) {
      const slots = await getCampaignSlots(env);
      const msgs = [];
      if (env.PNG_BASE_URL) {
        msgs.push({
          type: 'image',
          originalContentUrl: `${env.PNG_BASE_URL}/3q-campaign-poster-1080x1040.png`,
          previewImageUrl:    `${env.PNG_BASE_URL}/3q-campaign-poster-1080x1040.png`,
        });
        msgs.push({
          type: 'template',
          altText: '產品樣品圖 · 點你喜歡的',
          template: {
            type: 'image_carousel',
            columns: ['s01','s02','s03','s04','s05','s06'].map(p => ({
              imageUrl: `${env.PNG_BASE_URL}/3q-campaign-sample-${p}-1080x1040.png`,
              action: { type: 'message', text: `我喜歡 ${p}` },
            })),
          },
        });
      }
      msgs.push(campaignCard(slots));
      return replyMsg(ev.replyToken, msgs, env);
    }

    const sampleLike = text.trim().match(/^我喜歡\s+(s\d{2})$/);
    if (sampleLike) {
      const pick = sampleLike[1];
      await updateCampaignSamplePick(uid, pick, env);
      if (env.OWNER_USER_ID) {
        try {
          await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: env.OWNER_USER_ID, messages: [{ type: 'text',
              text: `招募樣品偏好\n用戶選了：${pick}\nUID：${uid}` }] }),
          });
        } catch {}
      }
      return replyMsg(ev.replyToken, [{ type: 'text', text:
        `收到！你看上「${pick}」這個樣品。\n\n下一步：傳「+1」打開報名表，選擇方案 (100/200/300 元)，搶前 30 位名額。` }], env);
    }

    if (/說說.*店|說說我|開始填/.test(text)) {
      await clearSession(uid, env);
      return replyMsg(ev.replyToken, [serviceCard(env.PNG_BASE_URL)], env);
    }

    return handleIntent(text, ev.replyToken, env, uid);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Flow state machine
// ─────────────────────────────────────────────────────────────────────────

async function handleFlow(data, uid, replyToken, env) {
  const p = flowParams(data);

  if (p.qty !== undefined) {
    return replyMsg(replyToken, [quoteUseCard(p.qty)], env);
  }
  if (p.use !== undefined) {
    return replyMsg(replyToken, [quoteRushCard(p.q, p.use)], env);
  }
  if (p.rush !== undefined) {
    return replyMsg(replyToken, [quoteResultCard(p.q, p.u, p.rush)], env);
  }

  if (p.nxt !== undefined) {
    // A3: Booking flow entry
    if (p.nxt === 'book') {
      await saveSession(uid, { step: 'booking' }, env);
      return replyMsg(replyToken, [{
        type: 'text',
        text: '好。\n\n告訴我你方便的諮詢時段（例如：週三下午、週六上午），我們會在 24 小時內確認時間。\n\n（打「取消」可離開）',
      }], env);
    }
    const target = {
      cases:    '實例',
      quote:    '試算',
      campaign: '+1',
      seasonal: '春茶',
      consult:  '我想說我的店',
    }[p.nxt];
    if (target) return handleIntent(target, replyToken, env, uid);
  }

  if (data === 'flow:qty_to_campaign') {
    const slots = await getCampaignSlots(env);
    const msgs = [];
    if (env.PNG_BASE_URL) msgs.push({
      type: 'image',
      originalContentUrl: `${env.PNG_BASE_URL}/3q-campaign-poster-1080x1040.png`,
      previewImageUrl:    `${env.PNG_BASE_URL}/3q-campaign-poster-1080x1040.png`,
    });
    msgs.push(campaignCard(slots));
    return replyMsg(replyToken, msgs, env);
  }
  if (data === 'flow:qty_to_consult') {
    await clearSession(uid, env);
    return replyMsg(replyToken, [serviceCard(env.PNG_BASE_URL)], env);
  }

  if (p.service !== undefined) {
    await clearSession(uid, env);
    return replyMsg(replyToken, [budgetCard(p.service, env.PNG_BASE_URL)], env);
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
    if (session) {
      const inquiryId = await saveInquiry(uid, session, env);
      if (env.OWNER_USER_ID) await pushToOwner(session, env, uid);
      // B1: Switch rich menu to "inquired" state
      await switchRichMenu(uid, env.RICHMENU_INQUIRED, env);
      // B2: Upgrade member tier
      await updateMemberTier(uid, 'inquired', env);
      // v3.7: qualify referral attribution (success def = inquiry)
      await finalizeReferral(uid, inquiryId, '3q-hatchery', env);
    }
    await clearSession(uid, env);
    return replyMsg(replyToken, [
      { type: 'text', text: '收到了 ✓\n\n24 小時內我們會主動聯繫你。' },
      postInquiryNextStepsCard(),
    ], env);
  }
  if (data === 'flow:reset') {
    await clearSession(uid, env);
    return replyMsg(replyToken, [serviceCard(env.PNG_BASE_URL)], env);
  }

  if (p.campaign && ['tier1', 'tier2', 'tier3'].includes(p.campaign)) {
    const tier = p.campaign;
    const result = await registerCampaignSlot(uid, tier, env);
    const t = CAMPAIGN_TIERS[tier];
    if (result === 'ok') {
      await saveCampaignRegistration(uid, tier, t.price, env);
      // B1: Switch to inquired rich menu on campaign register (payment not confirmed yet)
      await switchRichMenu(uid, env.RICHMENU_INQUIRED, env);
      await updateMemberTier(uid, 'inquired', env);
      // v3.7: qualify referral attribution (success def = campaign signup)
      await finalizeReferral(uid, null, '3q-hatchery', env);
      if (env.OWNER_USER_ID) {
        await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: env.OWNER_USER_ID, messages: [{ type: 'text',
            text: `🎉 新招募報名\n方案：${t.label} · ${t.price} 元\n動作：${t.action}\nUID：${uid}` }] }),
        });
      }
      return replyMsg(replyToken, [
        { type: 'text', text:
          `已登記 ✓ 你是${t.label}的報名者。\n\n下一步：${t.action}，傳給我們。\n收到後我們會開立 ${t.price} 元的付款連結。\n\n感謝你願意讓我們幫你被看見。` },
        postCampaignNextStepsCard(t.label, t.price, t.action),
      ], env);
    }
    if (result === 'already') {
      return replyMsg(replyToken, [{ type: 'text', text: `你已經登記過了。\n\n記得完成動作：${t.action}，傳給我們。` }], env);
    }
    if (result === 'full') {
      const slots = await getCampaignSlots(env);
      return replyMsg(replyToken, [
        { type: 'text', text: `${t.label}已額滿。\n\n還有其他方案可以選：` },
        campaignCard(slots),
      ], env);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// A2: Owner push — Flex with lead score + quick-reply action buttons
// ─────────────────────────────────────────────────────────────────────────

async function pushToOwner(a, env, uid) {
  const score = leadScore(a.budget);
  const SCORE_EMOJI = { hot: '🔥', warm: '⚡', cold: '🌱' };
  const emoji = SCORE_EMOJI[score] || '';
  const infoRows = [
    ['需求', SERVICE_LABELS[a.service]   || a.service   || '—'],
    ['預算', BUDGET_LABELS[a.budget]     || a.budget     || '—'],
    ['時間', TIMELINE_LABELS[a.timeline] || a.timeline   || '—'],
    ['說的', a.freeText || '（未填）'],
  ];
  const ownerFlex = FLEX(`新詢問 ${emoji}`, BUBBLE(
    DARK_HEADER(`新詢問 ${emoji}`, `${score.toUpperCase()} LEAD · ${new Date(Date.now() + 8*3600000).toISOString().slice(0,16).replace('T',' ')}`),
    LIGHT_BODY([
      ...infoRows.map(([label, value]) => ({
        type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: label, color: '#8A8A8A', size: 'sm', flex: 1 },
          { type: 'text', text: value, color: '#1A1A1A', size: 'sm', flex: 3, wrap: true },
        ],
      })),
      { type: 'separator', margin: 'md', color: '#E8DFD0' },
      BTN('📞 已聯繫',   `owner:status=contacted&uid=${uid}`, true,  '已聯繫'),
      BTN('😔 不感興趣', `owner:status=lost&uid=${uid}`,      false, '不感興趣'),
      BTN('🎉 成交',     `owner:status=won&uid=${uid}`,       false, '成交'),
    ]),
  ));
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: env.OWNER_USER_ID, messages: [ownerFlex] }),
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Welcome — Flex with hero + member card
// ─────────────────────────────────────────────────────────────────────────

function twGreeting() {
  const tw = new Date(Date.now() + 8 * 3600 * 1000);
  const h = tw.getUTCHours();
  if (h >= 5 && h < 11) return '早安';
  if (h >= 11 && h < 14) return '午安';
  if (h >= 14 && h < 18) return '下午好';
  if (h >= 18 && h < 22) return '晚安好';
  return '夜深了';
}

async function sendWelcome(replyToken, env, mCard = null) {
  const base = env.PNG_BASE_URL;
  const greeting = twGreeting();
  if (!base) {
    return replyMsg(replyToken, [{ type: 'text', text: `${greeting}，這裡是 3Q Hatchery · 台灣在地品牌孵化所。\n\n只要你願意說，我們就幫你被看見。` }], env);
  }
  const welcomeFlex = {
    type: 'flex',
    altText: '歡迎加入 3Q Hatchery · 台灣在地品牌孵化所',
    contents: {
      type: 'bubble', size: 'mega',
      hero: HERO(`${base}/3q-welcome-card-1040.png`, '1:1'),
      body: {
        type: 'box', layout: 'vertical', backgroundColor: '#0A0A0A',
        paddingAll: '20px', spacing: 'sm',
        contents: [
          { type: 'text', text: 'TAIWAN BRAND HATCHERY', color: '#B8924A', size: 'xxs', weight: 'bold', letterSpacing: '3px' },
          { type: 'text', text: `${greeting}！\n只要你願意說\n我們就幫你被看見。`, color: '#F5F2EC', size: 'lg', weight: 'bold', wrap: true, margin: 'sm' },
          { type: 'separator', margin: 'md', color: '#B8924A' },
          { type: 'text', text: '不管你的店多大多小，都有適合你的平台、舞台、後台。', color: '#8A8A8A', size: 'sm', wrap: true, margin: 'md' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', backgroundColor: '#F5F2EC',
        paddingAll: '16px',
        contents: [{
          type: 'button',
          action: { type: 'postback', label: '說說你的店，從這裡開始', data: 'menu:my-store', displayText: '說說你的店' },
          style: 'primary', color: '#0A0A0A', height: 'sm',
        }],
      },
    },
  };
  const msgs = [welcomeFlex, carouselMsg(base), serviceCard(base)];
  // B2: Append member card if issued
  if (mCard) msgs.push(memberCardFlex(mCard.num, mCard.joinDate, mCard.tier, mCard.code, mCard.refCount, env));
  return replyMsg(replyToken, msgs, env);
}

// ─────────────────────────────────────────────────────────────────────────
// Keyword routing
// ─────────────────────────────────────────────────────────────────────────

async function handleIntent(userText, replyToken, env, uid) {
  // v3.6: Rich Menu tap-zone keyword routes that need function dispatch
  if (userText.includes('服務一覽')) {
    return replyMsg(replyToken, [serviceCard(env.PNG_BASE_URL)], env);
  }
  if (userText.includes('你好，今天想做什麼') || userText.includes('你好,今天想做什麼')) {
    return replyMsg(replyToken, [carouselMsg(env.PNG_BASE_URL)], env);
  }
  if (userText.includes('我的專案狀態')) {
    const msg = await getMyStatus(uid, env);
    return replyMsg(replyToken, [msg], env);
  }
  if (userText.includes('品牌孵化是什麼')) {
    const bubble = BUBBLE(
      DARK_HEADER('品牌孵化是什麼', '從聽你的店，到把它孵出殼'),
      LIGHT_BODY([
        { type: 'text', text: '1. 孵化', weight: 'bold', size: 'md', color: '#1A1A1A' },
        { type: 'text', text: '聽你的店、了解你的客人與你想成為的樣子。', size: 'sm', color: '#4A4A4A', wrap: true },
        { type: 'separator', margin: 'md', color: '#E8DFD0' },
        { type: 'text', text: '2. 成形', weight: 'bold', size: 'md', color: '#1A1A1A', margin: 'md' },
        { type: 'text', text: '品牌定位 + 內容素材 + 平台呈現，三條線同時收斂。', size: 'sm', color: '#4A4A4A', wrap: true },
        { type: 'separator', margin: 'md', color: '#E8DFD0' },
        { type: 'text', text: '3. 出殼', weight: 'bold', size: 'md', color: '#1A1A1A', margin: 'md' },
        { type: 'text', text: '上線、迭代、看數據。我們陪你跑前 3 個月。', size: 'sm', color: '#4A4A4A', wrap: true },
      ])
    );
    return replyMsg(replyToken, [
      { type: 'text', text: '品牌孵化分三階段：孵化 → 成形 → 出殼。' },
      FLEX('品牌孵化是什麼 · 三階段', bubble),
    ], env);
  }
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

// ─────────────────────────────────────────────────────────────────────────
// AI Fallback — Workers AI LLM (Llama-3 fast)
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// Claude API 引擎(Anthropic）+ 去金融輸出防護 + 3Q 八法則客服腦
// 金鑰只在 env.ANTHROPIC_API_KEY（server）；沒 key → 回 null，自動退回 Llama，不壞 bot。
// ─────────────────────────────────────────────────────────────────────────
const AI_BANNED = ['先享後付', '先用滿意再付', '先用再付', '分期', '月費', '保證', '最便宜', '穩賺'];
const AI_SAFE_REPLY = [
  '你好，謝謝你私訊。',
  '掘計畫是我們免費幫你的店做一個官網，做給你看、喜歡再合作。',
  '你是做哪一行的？也可以直接加 LINE：@121lkspe',
].join('\n');

function sanitizeAIReply(text) {
  if (!text) return null;
  let t = String(text).trim();
  t = t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/gu, '');
  t = t.replace(/[!！]/g, '。').replace(/\n{3,}/g, '\n\n').trim();
  if (AI_BANNED.some(w => t.includes(w))) return AI_SAFE_REPLY;
  if (t.length < 5) return AI_SAFE_REPLY;
  return t.slice(0, 300);
}

// 3Q 八法則·頂級顧問腦(餵給 Claude 的 system）
const BRAIN_3Q = [
  '你是「3Q 貢丸品牌孵化所」的首席顧問，也是頂級銷售。你回覆主動私訊進來的店家老闆。',
  '',
  '# 你的身分',
  '不是推銷員，是接待客人的主人，也是替老闆把脈的顧問。客人願意私訊，代表他對自己的店有期待——你的工作是接住這份期待，讓他覺得「這個人真的懂我的生意」，然後給他一個清楚、無痛的下一步。',
  '',
  '# 頂級銷售的四步(每次對話心裡都跑一遍，但不要說出步驟名)',
  '1. 接住：先回應他說的具體內容，讓他感到被聽見。用他的話回鏡一次。',
  '2. 診斷：用一個好問題，讓他多說一點他的生意(行業、現在最卡的地方)。問題要具體、好回答。',
  '3. 給對的下一步：根據他的行業與痛點，點出「被找到 / 被相信 / 被下單」這三件他最缺的哪一件，給一個明確動作。',
  '4. 收束：每次只給一個下一步(私訊行業 / 加 LINE / 免費品牌健診)。對方猶豫就留鉤子，不逼。',
  '',
  '# 判斷溫度，給不同力度',
  '- 冷(只問「這什麼」)：先講清楚掘計畫 + 收他的行業，不催。',
  '- 溫(問價格/怎麼做)：講免費第一步 + 導顧問，不報死數字。',
  '- 熱(說了行業/想做)：給行業專屬價值 + 明確約下一步(私訊「貢丸＋行業」或加 LINE)。',
  '',
  '# 說話方式',
  '- 繁體中文，用「你」不用「您」。短句、分行，最多 5 行，手機好讀。',
  '- 克制、誠懇。不浮誇、不用驚嘆號、不用 emoji、不堆形容詞。',
  '- 講結果，不講空話(不用「量身打造/絕無僅有/業界第一」這類)。',
  '- 像一個對自己做的東西很有把握、所以不需要大聲的人。',
  '',
  '# 絕對不做',
  '- 不報任何最終價格數字。被問價格：只說「第一步是免費的」+「之後按你需求加購」+ 請他說行業或加 LINE 顧問報。',
  '- 不用這些字：先享後付、先用再付、分期、月費、保證、最便宜、第一、絕對、穩賺。',
  '- 不逼單、不催、不製造假急迫。不亂承諾成效數字、不冒充已成交案例。',
  '',
  '# 核心彈藥',
  '- 掘計畫：免費幫你的店做一個官網，做給你看、喜歡再合作，每個行業只收一位。',
  '- 信念：做得對，才敢做給你看。',
  '- 目標導向：讓對方說出行業 → 私訊「貢丸＋你的行業」或加 LINE @121lkspe → 免費品牌健診。',
].join('\n');

async function callClaude(env, systemPrompt, messages, opts = {}) {
  if (!env.ANTHROPIC_API_KEY) return null;
  const model = opts.model || 'claude-sonnet-4-6';
  const maxTokens = opts.maxTokens || 400;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: messages.slice(-12),
      }),
    });
    if (!res.ok) { console.error('anthropic', res.status, await res.text().catch(() => '')); return null; }
    const data = await res.json();
    const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
    return sanitizeAIReply(text);
  } catch (e) { console.error('callClaude', e?.message); return null; }
}

async function aiFallback(userText, env, uid) {
  if (!env.AI && !env.ANTHROPIC_API_KEY) return null;
  if (env.SESSION && uid) {
    const key = `rl:ai:${uid}`;
    const cur = parseInt(await env.SESSION.get(key) || '0', 10);
    if (cur >= 5) return null;
    await env.SESSION.put(key, String(cur + 1), { expirationTtl: 60 });
  }
  try {
    // 先試 Claude(八法則腦);沒 key 或失敗 → 退回 Llama
    const claudeReply = await callClaude(env, BRAIN_3Q, [{ role: 'user', content: userText }], { model: 'claude-sonnet-4-6', maxTokens: 400 });
    if (claudeReply) return claudeReply;
    const SYSTEM = '你是 3Q 貢丸·台灣在地品牌孵化所的客服助理。回應台灣繁體中文，最多 80 字。\n\n3Q 提供 3 個服務：\n1. 好物・好照 — 產品攝影 + 介紹文，500 元起\n2. 客製行銷 — 季度規劃，從現階段往前 3 個月\n3. 諮詢 — 30 分鐘免費，先聊聊再決定\n\n本月活動：好物・好照限時招募，前 10 位 100 元，名額剩 X 位。傳「+1」可看。\n\n用戶問什麼，你判斷最接近哪個服務，回答 2-3 句話，結尾建議他傳的關鍵字（例如：「回覆『+1』」「點選圖文選單『好物・好照』」）。語氣親切但不要過度熱情，跟用戶平等對話。';
    const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userText },
      ],
      max_tokens: 200,
    });
    const text = (result?.response || '').trim();
    return sanitizeAIReply(text);
  } catch (err) {
    console.error('AI fallback failed:', err?.message);
    return null;
  }
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

// ─────────────────────────────────────────────────────────────────────────
// LINE API helpers
// ─────────────────────────────────────────────────────────────────────────

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
