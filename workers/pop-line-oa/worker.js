// POP MONSTER LINE OA — 超級業務AI種子 v6.1(reply-first × 談單腦 v6 × 蝦皮產品卡 × 自家影片 × 貼圖限流 × 加好友價格表)
// v6.1.0 追加(2026-10-30):反駁席 8 條 low 級意見收尾(版號不動)
//   A DO ack 排序:ack job 也帶 issuedAt,ack 上限 issuedAt+40s、main 上限 issuedAt+45s(ack 必早於 main);lastNB 取 max;v6.0 殘留的隔天 lastNB(>now+60s)當 0
//   B 價格表直回讓位:交接檢查點那輪、店家線、問「批發報價單」都交給大腦(帶 price_list / wholesale 指令);直回成立時不設 sess.ho、不推老闆交接
//   C 多張照片合併:同一個 webhook 批次、同一位客人的 image 事件合成一次(最多 4 張、一次視覺請求、第一張 token 一次 reply)
//   D 老闆推播合併:同一輪的交接/降級/店家登記/首次升 A 級收成 1 則 push;KV ownerpush:<台北日期> 每日上限 15 則
//   E 文案事實:拿掉未查證的評分數字與出貨承諾;F 蝦皮連結一律帶 openExternalBrowser=1(SHOPEE 取 DATA 的 SHOP_URL);G 照片輪補 last_seen
// v6.1.0(2026-10-30):reply-first —— 「reply 正文、push 只當備援」(LINE reply 免費、push 計費;本帳號月額 200 則已用 177)
//   ① 文字墊場預設關(env.ACK_TEXT==='on' 才送);預設的 ack job 只做 markAsRead(8~22 秒已讀延遲)+loading,不碰 replyToken
//   ② 主回覆 DO job 帶 replyToken+issuedAt:alarm 時 50 秒內先 reply,非 2xx 才 push;走哪條路記在 KV diag:do_main_path
//   ③ 延遲上限:notBefore ≤ issuedAt+45s;pickDelayMs 多數 10~35 秒(原 30~240);DO 同客人隔 4 秒保留,但同受 45 秒上限
//   ④ 深夜(23~08)不再隔天早上 push:走一般 reply-first,turn 指令加「真人早上九點後才看得到,照常回答別叫他等」
//   ⑤ 照片:已讀+loading 60 → 視覺分析 → 用 replyToken 一次送(失敗才 push);拿掉「收到照片」墊場
//   ⑥ 價格表關鍵字直回(PRICELIST_RX,reply token、不經大腦、一天一次 pl:<uid>:<YYYYMMDD>);圖文選單「我的車該用什麼」改直回拍照 quick reply
//   ⑦ webhookEventId 去重(KV evt:<id> TTL 600);文案敬稱統一改口語「你」(AI_EMPLOYEE 逐字區塊除外)
//   ⑧ 新指令接線(DIRECTIVES.turn 有鍵才生效):ordered/result_share/returning/hesitation_close/price_mismatch/wholesale/price_list;貼圖 allowed_moments+slot_map
// v6.0.0(2026-10-30):學誼指定「LINE 自動談單全方位升級」
//   ① 加好友第一時間:reply token 一次送 價格表圖 → 歡迎貼圖 → 介紹(含 AI 揭露)+分流 quick reply(WELCOME_PACK,正本 data/pop-line/oa.json)
//   ② 產品卡:模型標 [PROD]SKU[/PROD] 或客人的話命中別名 → Flex(蝦皮主圖/品名/價格表定價/痛點/賣點/「蝦皮購買」/「看施工影片」);同 SKU 3 輪內不重發
//   ③ 影片:模型標 [VID]線[/VID] 或命中影片時機 → 自家一剪到底 mp4(GitHub Pages 託管)同一線 7 天一次,之後給 YouTube 合集;videoPlayComplete 落庫
//   ④ 貼圖程式級限流 stickerGate:每 3 則最多 1 次、每日 2 次、抱怨/售後不送(學誼:「貼圖偶爾用就好」)
//   ⑤ 談單腦 v6:鄭經說＋決策知識庫心理學＋汽美 KB 重寫 SEED_GENOME/EMPLOYEE_RULES;逐輪指令/異議腳本/症狀→推薦 由 DIRECTIVES 注入第二 system block(主 block 快取不破)
//   ⑥ B2C 成交回到蝦皮(SHOPEE 常數改指賣場;每支產品各自的商品頁連結在 CATALOG);SHOP_FLEX 改蝦皮賣場卡
//   ⑦ 資料正本 data/pop-line/*.json → scripts/pop-line-gen-data.mjs 重產 DATA 區塊(deploy 前 --check)
// v5.1.0(2026-07-07):v5 基礎上加五件事
// v5.1.0(2026-07-07):v5 基礎上加五件事
//   ⑥ 貼圖情緒引擎:模型輸出 [STK]語意槽[/STK],程式映射官方基本貼圖跟著主回覆一起送(同一則計費,不加成本);
//      抱怨/售後一律不帶貼圖。STICKERS 表可自由微調 ID(官方清單 developers.line.biz sticker_list.pdf)
//   ⑦ 圖片訊息修好:客人傳照片 → 秒回承接 → 抓 LINE content preview → Claude 視覺分析車況/產品 → 延遲 30~90s 回診斷
//      (貼圖/影音/位置訊息也都有人接,不再已讀不回)
//   ⑧ 已讀時機延遲:webhook markAsReadToken + POST /v2/bot/chat/markAsRead,DO 排程 8~22 秒後才標已讀→接著才墊場
//      (⚠ 需 OA Manager 應答設定「聊天」開啟才有效;沒開=LINE 自動已讀,此功能靜默跳過)
//   ⑨ 情緒→延遲秒數連續映射表 EMO_DELAY(抱怨快回安撫 40~110s、猶豫慎重 110~240s…)
//   ⑩ 金句飛輪:Reflexion 進化時提煉「GEM:情緒承接金句」寫入 cdg-core D1 emotion_gems(GENOME 綁定),
//      三品牌共用、越用越準
// v5.0.0(2026-07-07):基於 compass v3 改版方案(情緒優先 × 延遲擬真回覆)嫁接到 v4.4 種子
//   ① 鐵律零:情緒永遠先於推進 + 8 場景情緒承接模板庫 + emoji 準則(1~3個/則)+ 需求探詢問題集
//   ② 方案C 動態延遲:秒回情緒承接短句(reply token,不計費)→ 主回覆 Durable Object Alarm
//      延遲 60~240 秒 push;趕時間/純事實短問/喊真人=秒回不延遲;高情緒(抱怨/砍價/比價/質疑)=90~240秒
//   ③ 深夜守夜(台北 23:00~08:00):秒回守夜話術,主回覆隔天早上 08:00~08:30 push
//   ④ A/B 測試:userId hash 分流 delay/instant 兩組,遙測落 D1 pop_line_delivery
//   ⑤ [EMO] 情緒標籤契約:模型每則輸出情緒,系統剝除,客人看不到
//   環境旗標(Settings→Variables 可調,全部有預設):DELAY_MIN_S=60 DELAY_MAX_S=240
//   QUIET_MODE=on QUIET_START=23 QUIET_END=8 AB_TEST=on
// 種子基因組(成交七步+情緒引擎+紅線)+ Reflexion 自我進化迴圈 + 31商品彈藥庫
// 預設 Workers AI 70B(零金鑰);有 ANTHROPIC_API_KEY 升 Claude 三層路由。
// 部署:CF API PUT(綁定全列回+DO migration);repo 正本 3q-hatchery-line-oa/workers/pop/worker.js
// v4.2:AI 店員「B 版揭露」——第1句機械式人格化揭露 + 第10句交接檢查點 + 喊真人即交接(推播老闆)
//       + 降級話術不裝死(同步通知老闆)。config 正本:brands/popmonster.json。

// ═══ 模型三層路由 v1.1：小事 Haiku、日常 Sonnet、成交/客訴時刻 Fable（錯升不錯降）═══
const MODELS = {
  lite: 'claude-opus-5-5',       // 11-03 他指定:平常用 Opus 5.5
  chat: 'claude-opus-5-5',
  escalate: 'claude-fable-5-1',   // 最終裁決(ESCALATE_RX 命中:殺價/比較/投訴/大單)才用最聰明的 Fable 5.1
  fallback: 'claude-sonnet-5-5',
};
const ESCALATE_RX = /(健檢|報價|價格|多少錢|幾錢|預算|太貴|好貴|便宜一點|別家|考慮一下|合作|加盟|代理|經銷|夥伴|分潤|簽約|下訂|成交|怎麼付|客訴|抱怨|退貨|退款)/;
const LITE_RX = /^(營業時間|地址|在哪|在哪裡|怎麼去|電話|運費|出貨|幾天到|有現貨嗎)[?？嗎]?$/;
function pickModel(history) {
  const lastUser = [...(history || [])].reverse().find(m => m && m.role === 'user');
  const t = (lastUser && typeof lastUser.content === 'string') ? lastUser.content.trim() : '';
  if (ESCALATE_RX.test(t)) return MODELS.escalate;
  if (t.length <= 12 && LITE_RX.test(t)) return MODELS.lite;
  return MODELS.chat;
}
// v6.1.5:Claude 5.5 系列思考永遠開、關不掉,思考字數會算進 max_tokens;上限太小(400~600)會被思考吃光→回文變空。
// 所以 API 的 max_tokens 一律加思考餘裕,回覆長度靠提示詞管;思考深度用 output_config.effort:平常 low 省錢省時,裁決(Fable)用 medium。
const THINK_HEADROOM = 3000;
function brainBody(model, maxTokens, extra) {
  const effort = model === MODELS.escalate ? 'medium' : 'low';
  return Object.assign({ model, max_tokens: (maxTokens || 600) + THINK_HEADROOM, output_config: { effort } }, extra);
}
const CLAUDE_MODEL = MODELS.chat; // 舊引用點安全預設
const AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
let SETUP_KEY = '';  // 由 env.SETUP_KEY 注入（fetch 開頭，未設用隨機值 fail-closed）
const LINE_ID = '@150tiznd';
// SHOPEE(蝦皮賣場網址)在 DATA 區塊後面定義:取 DATA 的 SHOP_URL(gen-data 已加 openExternalBrowser=1)
const SEED_VER = 'v6.1.6';
// v6.1 reply-first 時間常數:reply token 約 1 分鐘內有效;主回覆 notBefore 不超過 issuedAt+45s,alarm 時 50 秒內才用 reply,過了直接 push
const REPLY_SOFT_CAP_MS = 45000, REPLY_TOKEN_MAX_MS = 50000;
const ACK_SOFT_CAP_MS = 40000;   // v6.1 追加:ack(已讀+loading)上限比 main 早 5 秒,保證每一則的已讀先於自己的主回覆
const OWNER_PUSH_DAILY_CAP = 15;   // v6.1 追加:老闆推播每日上限(KV ownerpush:<台北日期>),超過只寫 diag 不推
const PRICELIST_RX = /(價格表|價目表|價目|報價單|價錢表|價格單|價表)/;
// 猶豫收尾:要「像在對自己說」的句型才算(我再考慮/再看看吧/晚點再說/先不用了);「拋光之後再上鍍膜嗎」「拋完再看看效果」這類施工提問不算
const HESITATE_RX = /((我|先|讓我|容我)(再考慮|再看看|再想想|再想一下|考慮一下|想想|想一下)|再(考慮|看看|想想)(好了|吧|一下)?\s*[。.!！~～…]*$|(晚點|之後|以後|改天)再(說|買|訂|下單|考慮|聯絡)|先不用(了|啦|好了|謝)|先不用\s*[。.!！~～…]*$|考慮一下\s*[。.!！~～…]*$|想一下\s*[。.!！~～…]*$)/;
// 價格對不上:要同時有「價/賣」+「不一樣/對不上/比較貴…」;單純問「蝦皮有賣嗎」「蝦皮價格多少」「A跟B怎麼不一樣」不算
const PRICE_MISMATCH_RX = /((蝦皮|DM|官網|網路|外面).{0,8}(價|賣).{0,8}(不一樣|不同|對不上|比較貴|比較便宜|差)|價.{0,4}(不一樣|不同|對不上)|(價格表|價目表).{0,8}(蝦皮|官網|網路|外面).{0,6}(不一樣|不同|對不上)|比.{0,4}(蝦皮|DM|官網).{0,6}(貴|便宜))/;
// 批發/店家:「大量」只算進貨語境(大量進貨/採購/訂/叫貨/拿),「代理」只算當代理/代理商;車主的「車上有大量鐵粉」不算
const WHOLESALE_RX = /(批發|店家價|進貨|經銷|(當|做|找|想做|要做)代理|代理商|大量(進貨|採購|訂|叫貨|拿)|我是店家|我們店|開汽美|開店的)/;
const PAY_INTENT_RX_BASE = /(下訂|下單|怎麼買|哪裡買|購買|結帳|給我連結|給我網址|要買|想買|有貨嗎|還有嗎|怎麼訂|訂購|售價|價格|價錢|多少錢|幾錢)/;

// ═══ POP /go 三問式免費成果採集(v1)═══
const GO_INTAKE_ALLOWED_SOURCES = new Set(['direct', 'business-card', 'package-insert', 'social', 'legacy-worker']);
const GO_INTAKE_FB_SOURCE = /^fb-[0-9a-f]{6}$/;
const GO_INTAKE_CODE = /(?:【)?GO:([a-z0-9-]+):([a-z0-9-]+)(?:】)?/i;
const GO_INTAKE_RESET = /^(重新開始|重來|reset)$/i;
const GO_INTAKE_TTL_SECONDS = 24 * 60 * 60;
const GO_INTAKE_WEBHOOK_TTL_SECONDS = 7 * 24 * 60 * 60;
const GO_FUNNEL_EVENT_TTL_SECONDS = 120 * 24 * 60 * 60;
const GO_FUNNEL_DELIVERY_TTL_SECONDS = 90 * 24 * 60 * 60;
const GO_FUNNEL_EVENTS = new Set(['started', 'first_answer', 'third_answer', 'delivered']);
const GO_FUNNEL_CASE_PATTERN = /^GO-[A-F0-9]{12}$/;
const GO_INTAKE_SERVICE = Object.freeze({
  slug: 'auto-care',
  hook: '不用先買一堆藥劑，免費照車況排出最少浪費的處理順序。',
  questions: Object.freeze([
    '第 1／3 題｜車種、顏色與目前最明顯的狀況是什麼？',
    '第 2／3 題｜目標是清潔、去汙、增亮、保護，還是修復？',
    '第 3／3 題｜手邊已有什麼工具或藥劑？是否能在遮陰處施工？',
  ]),
  delivery: '我會回一份先後順序，並分成手邊可做與需要補的品項。',
  boundary: '每人一次、一台車或一項施工目標；遠端只能做初步建議，效果受漆況、施工與環境影響。',
});

function normalizeGoIntakeSource(source) {
  const candidate = String(source || '').trim().toLowerCase();
  return GO_INTAKE_ALLOWED_SOURCES.has(candidate) || GO_INTAKE_FB_SOURCE.test(candidate) ? candidate : 'direct';
}

function goFunnelDay(timestamp = Date.now()) {
  return new Date(Number(timestamp) + (8 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

function createGoFunnelMeta(source) {
  const startedAt = Date.now();
  return {
    caseId: 'GO-' + crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase(),
    source: normalizeGoIntakeSource(source),
    cohortDay: goFunnelDay(startedAt),
    startedAt,
  };
}

function goFunnelMetaKey(intakeKey) {
  return intakeKey.replace('go-intake:', 'go-intake-meta:');
}

function goFunnelEventKey(meta, event) {
  return `go-funnel:v1:${GO_INTAKE_SERVICE.slug}:${meta.cohortDay}:${normalizeGoIntakeSource(meta.source)}:${event}:${meta.caseId}`;
}

async function recordGoFunnelEvent(kv, meta, event, value = '1') {
  if (!kv || !meta || !GO_FUNNEL_CASE_PATTERN.test(meta.caseId) || !GO_FUNNEL_EVENTS.has(event)) return;
  await kv.put(goFunnelEventKey(meta, event), String(value), { expirationTtl: GO_FUNNEL_EVENT_TTL_SECONDS });
}

async function retryGoFunnelWrite(operation) {
  try { return await operation(); } catch (_) { return operation(); }
}

async function rollbackGoIntakeReplyFailure(kv, details) {
  const { key, metaKey, previousState, previousMeta, activeMeta, isStart, isFirstAnswer, isCompletion } = details;
  await retryGoFunnelWrite(() => previousState
    ? kv.put(key, JSON.stringify(previousState), { expirationTtl: GO_INTAKE_TTL_SECONDS })
    : kv.delete(key));
  await retryGoFunnelWrite(() => previousMeta
    ? kv.put(metaKey, JSON.stringify(previousMeta), { expirationTtl: GO_INTAKE_TTL_SECONDS })
    : kv.delete(metaKey));
  if (!activeMeta) return;
  if (isStart || (!previousMeta && (isFirstAnswer || isCompletion))) {
    await retryGoFunnelWrite(() => kv.delete(goFunnelEventKey(activeMeta, 'started')));
  }
  if (isFirstAnswer || (isCompletion && !previousMeta)) await retryGoFunnelWrite(() => kv.delete(goFunnelEventKey(activeMeta, 'first_answer')));
  if (isCompletion) {
    await retryGoFunnelWrite(() => kv.delete(goFunnelEventKey(activeMeta, 'third_answer')));
    await retryGoFunnelWrite(() => kv.delete(`go-delivery:v1:${GO_INTAKE_SERVICE.slug}:${activeMeta.caseId}`));
  }
}

function newGoFunnelBucket(source = null) {
  return {
    source,
    started: new Set(),
    first_answer: new Set(),
    third_answer: new Set(),
    delivered: new Set(),
    deliveryMinutes: [],
  };
}

function goFunnelRate(numerator, denominator) {
  return denominator ? Math.round((numerator / denominator) * 10000) / 10000 : 0;
}

function goFunnelStats(bucket) {
  const starts = bucket.started.size;
  const firstAnswers = bucket.first_answer.size;
  const thirdAnswers = bucket.third_answer.size;
  const deliveries = bucket.delivered.size;
  const averageDeliveryMinutes = bucket.deliveryMinutes.length
    ? Math.round((bucket.deliveryMinutes.reduce((sum, value) => sum + value, 0) / bucket.deliveryMinutes.length) * 10) / 10
    : null;
  return {
    ...(bucket.source ? { source: bucket.source } : {}),
    starts,
    firstAnswers,
    thirdAnswers,
    deliveries,
    firstAnswerRate: goFunnelRate(firstAnswers, starts),
    thirdAnswerRate: goFunnelRate(thirdAnswers, starts),
    deliveryRate: goFunnelRate(deliveries, starts),
    averageDeliveryMinutes,
  };
}

async function listGoFunnelKeys(kv, prefix) {
  const keys = [];
  let cursor = '';
  do {
    const page = await kv.list(cursor ? { prefix, cursor } : { prefix });
    keys.push(...page.keys);
    cursor = page.list_complete ? '' : page.cursor;
  } while (cursor);
  return keys;
}

async function buildGoFunnelSummary(kv, daysInput) {
  const days = Math.min(90, Math.max(1, Number.parseInt(String(daysInput || '30'), 10) || 30));
  const shiftedNow = Date.now() + (8 * 60 * 60 * 1000);
  const cohortDays = Array.from({ length: days }, (_, index) => (
    new Date(shiftedNow - ((days - index - 1) * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10)
  ));
  const overall = newGoFunnelBucket();
  const bySource = new Map();
  const allowedDays = new Set(cohortDays);
  const keys = await listGoFunnelKeys(kv, `go-funnel:v1:${GO_INTAKE_SERVICE.slug}:`);
  for (const item of keys) {
    const [, , , cohortDay, rawSource, event, caseId] = item.name.split(':');
    if (!allowedDays.has(cohortDay) || !GO_FUNNEL_EVENTS.has(event) || !GO_FUNNEL_CASE_PATTERN.test(caseId)) continue;
    const source = normalizeGoIntakeSource(rawSource);
    if (!bySource.has(source)) bySource.set(source, newGoFunnelBucket(source));
    bySource.get(source)[event].add(caseId);
    overall[event].add(caseId);
    if (event === 'delivered') {
      const rawMinutes = await kv.get(item.name);
      const minutes = rawMinutes === null ? Number.NaN : Number(rawMinutes);
      if (Number.isFinite(minutes) && minutes >= 0) {
        bySource.get(source).deliveryMinutes.push(minutes);
        overall.deliveryMinutes.push(minutes);
      }
    }
  }
  return {
    ok: true,
    feature: 'go-funnel-v1',
    slug: GO_INTAKE_SERVICE.slug,
    range: { from: cohortDays[0], to: cohortDays.at(-1), days },
    totals: goFunnelStats(overall),
    sources: [...bySource.values()].sort((a, b) => a.source.localeCompare(b.source)).map(goFunnelStats),
    definitions: {
      firstAnswerRate: 'firstAnswers / starts',
      thirdAnswerRate: 'thirdAnswers / starts',
      deliveryRate: 'deliveries / starts',
      averageDeliveryMinutes: '三題完成到人工標記成果已交付的平均分鐘；沒有已交付案件時為 null',
    },
  };
}

async function safeGoFunnelAdminKey(request, expected) {
  if (!expected) return false;
  const encoder = new TextEncoder();
  const supplied = request.headers.get('X-Admin-Key') || '';
  const [suppliedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(supplied)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(suppliedHash), right = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0 && supplied.length > 0;
}

function goFunnelJson(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function markGoFunnelDelivered(kv, rawCaseId) {
  const caseId = String(rawCaseId || '').trim().toUpperCase();
  if (!GO_FUNNEL_CASE_PATTERN.test(caseId)) return { status: 400, body: { ok: false, error: 'invalid caseId' } };
  const receiptRaw = await kv.get(`go-delivery:v1:${GO_INTAKE_SERVICE.slug}:${caseId}`);
  if (!receiptRaw) return { status: 404, body: { ok: false, error: 'case not found' } };
  let receipt;
  try { receipt = JSON.parse(receiptRaw); } catch (_) { return { status: 409, body: { ok: false, error: 'invalid receipt' } }; }
  if (receipt.slug !== GO_INTAKE_SERVICE.slug || !/^\d{4}-\d{2}-\d{2}$/.test(receipt.cohortDay || '')) {
    return { status: 409, body: { ok: false, error: 'receipt mismatch' } };
  }
  const meta = { caseId, source: normalizeGoIntakeSource(receipt.source), cohortDay: receipt.cohortDay };
  const eventKey = goFunnelEventKey(meta, 'delivered');
  const existing = await kv.get(eventKey);
  if (existing !== null) {
    return { status: 200, body: { ok: true, caseId, deliveryMinutes: Number(existing), duplicate: true } };
  }
  const completedAt = Number(receipt.completedAt);
  if (!Number.isFinite(completedAt) || completedAt <= 0) return { status: 409, body: { ok: false, error: 'invalid completion time' } };
  const deliveryMinutes = Math.max(0, Math.round(((Date.now() - completedAt) / 60000) * 10) / 10);
  await retryGoFunnelWrite(() => recordGoFunnelEvent(kv, meta, 'started'));
  await retryGoFunnelWrite(() => recordGoFunnelEvent(kv, meta, 'first_answer'));
  await retryGoFunnelWrite(() => recordGoFunnelEvent(kv, meta, 'third_answer'));
  await retryGoFunnelWrite(() => recordGoFunnelEvent(kv, meta, 'delivered', deliveryMinutes));
  return { status: 200, body: { ok: true, caseId, deliveryMinutes, duplicate: false } };
}

async function handleGoFunnelAdmin(request, env, kv) {
  if (!kv || !env.GO_FUNNEL_ADMIN_KEY) return goFunnelJson({ ok: false, error: 'go funnel admin not configured' }, 503);
  if (!await safeGoFunnelAdminKey(request, env.GO_FUNNEL_ADMIN_KEY)) return goFunnelJson({ ok: false, error: 'unauthorized' }, 401);
  const url = new URL(request.url);
  if (url.pathname === '/admin/go-funnel' && request.method === 'GET') {
    return goFunnelJson(await buildGoFunnelSummary(kv, url.searchParams.get('days')));
  }
  if (url.pathname === '/admin/go-funnel/delivered' && request.method === 'POST') {
    const declaredLength = Number(request.headers.get('content-length') || '0');
    if (declaredLength > 1024) return goFunnelJson({ ok: false, error: 'payload too large' }, 413);
    const bodyText = await request.text();
    if (bodyText.length > 1024) return goFunnelJson({ ok: false, error: 'payload too large' }, 413);
    let body;
    try { body = JSON.parse(bodyText); } catch (_) { return goFunnelJson({ ok: false, error: 'invalid json' }, 400); }
    const result = await markGoFunnelDelivered(kv, body.caseId);
    return goFunnelJson(result.body, result.status);
  }
  return goFunnelJson({ ok: false, error: 'method not allowed' }, 405);
}

function goIntakeQuestion(step) {
  return GO_INTAKE_SERVICE.hook + '\n\n' + GO_INTAKE_SERVICE.questions[step]
    + '\n\n隱私提醒：車牌、姓名、電話與訂單資料請先遮蔽。輸入「重新開始」可退出。';
}

function goIntakeTransition({ text, state }) {
  const input = String(text || '').trim();
  if (GO_INTAKE_RESET.test(input)) {
    return { handled: true, state: null, reply: '已清除這次採集進度。回到 POP 免費接線台即可重新開始。' };
  }
  if (state) {
    if (state.slug !== GO_INTAKE_SERVICE.slug) {
      return { handled: true, state: null, reply: '這次進度已失效，請從 POP 免費接線台重新選擇。' };
    }
    const nextStep = Number(state.step) + 1;
    if (nextStep < GO_INTAKE_SERVICE.questions.length) {
      return {
        handled: true,
        state: { slug: GO_INTAKE_SERVICE.slug, source: normalizeGoIntakeSource(state.source), step: nextStep },
        reply: goIntakeQuestion(nextStep),
      };
    }
    return {
      handled: true,
      state: null,
      reply: '三題已收齊。' + GO_INTAKE_SERVICE.delivery + '\n\n免費範圍：' + GO_INTAKE_SERVICE.boundary
        + '\n請不要再補傳未遮蔽的身分證、付款卡號或完整合約個資。',
    };
  }
  const match = input.match(GO_INTAKE_CODE);
  if (!match || match[1] !== GO_INTAKE_SERVICE.slug) return { handled: false, state: null, reply: null };
  const nextState = { slug: GO_INTAKE_SERVICE.slug, source: normalizeGoIntakeSource(match[2]), step: 0 };
  return { handled: true, state: nextState, reply: goIntakeQuestion(0) };
}

async function goIntakeStorageKey(userId, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(userId));
  return 'go-intake:' + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function goIntakeWebhookKey(webhookEventId) {
  const value = String(webhookEventId || '').trim();
  if (!value) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return `go-intake-webhook:v1:${GO_INTAKE_SERVICE.slug}:` + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function rememberGoIntakeWebhook(kv, webhookKey) {
  if (webhookKey) await kv.put(webhookKey, '1', { expirationTtl: GO_INTAKE_WEBHOOK_TTL_SECONDS });
}

async function maybeHandleGoIntake(ev, env, cfg) {
  if (ev.type !== 'message' || !ev.source?.userId || !ev.replyToken || !env.SESSION || !cfg.lineSecret) return false;
  const key = await goIntakeStorageKey(ev.source.userId, cfg.lineSecret);
  const webhookKey = await goIntakeWebhookKey(ev.webhookEventId);
  if (webhookKey && await env.SESSION.get(webhookKey)) return true;
  const metaKey = goFunnelMetaKey(key);
  const [raw, metaRaw] = await Promise.all([env.SESSION.get(key), env.SESSION.get(metaKey)]);
  let state = null, meta = null;
  if (raw) { try { state = JSON.parse(raw); } catch (_) {} }
  if (metaRaw) { try { meta = JSON.parse(metaRaw); } catch (_) {} }
  const previousState = state;
  const previousMeta = meta;
  if (ev.message?.type !== 'text') {
    if (!state) return false;
    const replySent = await lineReply(cfg.lineToken, ev.replyToken, '照片或附件已收到，先保留在這段對話；請再輸入文字回答目前這一題，我再往下問。', env);
    if (replySent) await retryGoFunnelWrite(() => rememberGoIntakeWebhook(env.SESSION, webhookKey)).catch(() => {});
    return true;
  }
  const result = goIntakeTransition({ text: ev.message.text, state });
  if (!result.handled) return false;
  let replyText = result.reply;
  const isStart = !state && Number(result.state?.step) === 0;
  const isFirstAnswer = state?.slug === GO_INTAKE_SERVICE.slug && Number(state.step) === 0 && Number(result.state?.step) === 1;
  const isCompletion = state?.slug === GO_INTAKE_SERVICE.slug && Number(state.step) === 2 && result.state === null && !GO_INTAKE_RESET.test(String(ev.message.text || '').trim());
  let trackingFailed = false;
  try {
    if (!state && Number(result.state?.step) === 0) {
      meta = createGoFunnelMeta(result.state.source);
      await env.SESSION.put(metaKey, JSON.stringify(meta), { expirationTtl: GO_INTAKE_TTL_SECONDS });
      await recordGoFunnelEvent(env.SESSION, meta, 'started');
    } else if (isFirstAnswer) {
      if (!meta) {
        meta = createGoFunnelMeta(state.source);
        await env.SESSION.put(metaKey, JSON.stringify(meta), { expirationTtl: GO_INTAKE_TTL_SECONDS });
      }
      await Promise.all([
        recordGoFunnelEvent(env.SESSION, meta, 'started'),
        recordGoFunnelEvent(env.SESSION, meta, 'first_answer'),
      ]);
    } else if (isCompletion) {
      if (!meta) {
        meta = createGoFunnelMeta(state.source);
        await env.SESSION.put(metaKey, JSON.stringify(meta), { expirationTtl: GO_INTAKE_TTL_SECONDS });
      }
      const completedAt = Date.now();
      await retryGoFunnelWrite(() => env.SESSION.put(`go-delivery:v1:${GO_INTAKE_SERVICE.slug}:${meta.caseId}`, JSON.stringify({
          slug: GO_INTAKE_SERVICE.slug,
          source: normalizeGoIntakeSource(meta.source),
          cohortDay: meta.cohortDay,
          completedAt,
        }), { expirationTtl: GO_FUNNEL_DELIVERY_TTL_SECONDS }));
      replyText += `\n\n案件碼：${meta.caseId}（只用於交付計時，不含你的資料）`;
      await retryGoFunnelWrite(() => recordGoFunnelEvent(env.SESSION, meta, 'started'));
      await retryGoFunnelWrite(() => recordGoFunnelEvent(env.SESSION, meta, 'first_answer'));
      await retryGoFunnelWrite(() => recordGoFunnelEvent(env.SESSION, meta, 'third_answer'));
    }
  } catch (error) {
    console.error(JSON.stringify({ event: 'go_funnel_write_error', slug: GO_INTAKE_SERVICE.slug, message: String(error?.message || error) }));
    if (isCompletion) {
      trackingFailed = true;
      replyText = '第 3 題已收到，但案件碼暫時無法建立。請稍後再傳「完成」，我會從這題重試，不用重填前兩題。';
    }
  }
  if (trackingFailed) {
    await retryGoFunnelWrite(() => env.SESSION.put(key, JSON.stringify(previousState), { expirationTtl: GO_INTAKE_TTL_SECONDS }));
    if (meta) await retryGoFunnelWrite(() => env.SESSION.put(metaKey, JSON.stringify(meta), { expirationTtl: GO_INTAKE_TTL_SECONDS }));
  } else if (result.state) await retryGoFunnelWrite(() => env.SESSION.put(key, JSON.stringify(result.state), { expirationTtl: GO_INTAKE_TTL_SECONDS }));
  else {
    await retryGoFunnelWrite(() => env.SESSION.delete(key));
    await retryGoFunnelWrite(() => env.SESSION.delete(metaKey));
  }
  const replySent = await lineReply(cfg.lineToken, ev.replyToken, replyText, env);
  if (!replySent) {
    await rollbackGoIntakeReplyFailure(env.SESSION, {
      key, metaKey, previousState, previousMeta, activeMeta: meta, isStart, isFirstAnswer, isCompletion,
    }).catch((error) => console.error(JSON.stringify({ event: 'go_intake_reply_rollback_error', slug: GO_INTAKE_SERVICE.slug, message: String(error?.message || error) })));
    return true;
  }
  if (trackingFailed) return true;
  await retryGoFunnelWrite(() => rememberGoIntakeWebhook(env.SESSION, webhookKey)).catch(() => {});
  return true;
}

function goIntakeHealthResponse() {
  return new Response(JSON.stringify({ ok: true, feature: 'go-intake-v1', slug: GO_INTAKE_SERVICE.slug, questions: 3 }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

// ═══ AI 員工檔案(B 版揭露)═══
// 正本在 brands/popmonster.json — 改 config 先改正本,再同步這份內嵌副本(單檔部署,無 bundler)
// v5:disclosure_script 換成 v3 方案固定開場自介(逐字,已含 AI 身分揭露,一字不可改)
const AI_EMPLOYEE = {
  display_name: '小泡',
  job_title: 'AI店員',
  employee_id: 'POP-CAR-0001',
  disclosure_mode: 'once',
  disclosure_script: '我是超級 AI 人工客服😊 老闆~您不要把我們當作一般一板一眼的殭屍客服🤖 您儘量把您的需求直接和我們說,我們這邊會直接幫您介紹完畢,到最後之後請真人過來👍',
  identity_question_policy: 'always_confirm_ai',
  handoff_threshold: 10,
  handoff_card_fields: ['身分(B2B經銷/B2C消費者)', '使用場景', '預算帶', '急迫度', '決策角色'],
  handoff_script: '聊到這裡,你要的我大致整理好了:{summary}。要不要我請真人夥伴直接接手?你不用再講一遍。',
  redline_whitelist: { price_quote: 'list_price_only_else_handoff', refund_policy: 'fixed_script_only', medical_efficacy_claims: 'deny', stock_promise: 'deny_and_handoff' },
  refund_policy_script: '退換貨的部分我先幫您記下來,直接請真人夥伴依您的實際狀況協助處理到好,不會讓您為難。',
  degraded_mode_script: '我現在訊號不太穩,你的訊息我都記下了不會漏,真人夥伴上班時間(09:00-18:00)會親自回覆你。',
  tone_profile: 'popmonster',
};

// ═══ v5 情緒優先 × 延遲擬真(方案C 動態)═══
const ACK_POOL = {
  '抱怨': ['先跟你說聲抱歉讓你這樣😔 你說的我馬上看,稍等我一下', '收到,你先別急😔 我立刻看你的狀況,等我一下'],
  '售後': ['這部分我很在意,你先別急🙏 我馬上看,稍等一下', '收到你的狀況了🙏 我先幫你判斷,等我一下下'],
  'default': ['收到~我看一下你的狀況😊 稍等我一下下', '好的~我幫你看一下🙏 馬上回你', '收到你的訊息了😊 我整理一下,稍等一下'],
};
const HIGH_TOUCH = ['抱怨', '猶豫', '質疑效果', '砍價', '售後', '比價'];
const EMO_RX = [
  ['抱怨', /(客訴|抱怨|生氣|不爽|太爛|很爛|退貨|退款|壞掉|瑕疵|沒收到|漏發|等太久|已讀不回)/],
  ['售後', /(用了之後|施工完|做完之後|有問題|怪怪的|變質|沉澱|噴不出)/],
  ['趕時間', /(趕時間|很急|急用|快點|馬上要|立刻|現在就要)/],
  ['砍價', /(便宜一點|算便宜|折扣|優惠碼|降價|算我|殺價)/],
  ['比價', /(別家|其他家|哪家好|比較一下|跟.{0,6}比)/],
  ['質疑效果', /(有效嗎|真的假的|會不會沒效|是不是騙|詐騙|真的有用)/],
];
function guessEmotion(t) { for (const [k, rx] of EMO_RX) if (rx.test(t || '')) return k; return '中性'; }
function pickAck(emo) { const pool = ACK_POOL[emo] || ACK_POOL.default; return pool[Math.floor(Math.random() * pool.length)]; }
function abGroup(uid) { let h = 0; const s = String(uid || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (Math.abs(h) % 2) === 0 ? 'delay' : 'instant'; }
// v5.1 情緒→延遲秒數連續映射(v6.1:reply token 只有約 1 分鐘壽命,全部壓進 10~35 秒;抱怨快回安撫、猶豫/質疑稍慢;最終被 env DELAY_MIN_S/MAX_S 夾住,上限 40 秒)
const EMO_DELAY = {
  '抱怨': [8, 20], '售後': [8, 20],
  '砍價': [15, 35], '比價': [15, 35], '質疑效果': [18, 35], '猶豫': [20, 38],
  '閒聊': [12, 30], '中性': [10, 30],
};
function pickDelayMs(env, emo) {
  const hi = Math.min(40, Math.max(5, parseInt(env.DELAY_MAX_S || '40', 10) || 40));
  const lo = Math.min(hi, Math.max(5, parseInt(env.DELAY_MIN_S || '8', 10) || 8));
  const range = EMO_DELAY[emo] || EMO_DELAY['中性'];
  const l = Math.min(Math.max(range[0], lo), hi), h = Math.min(Math.max(range[1], lo), hi);
  const lo2 = Math.min(l, h), hi2 = Math.max(l, h);
  return (lo2 + Math.floor(Math.random() * (hi2 - lo2 + 1))) * 1000;
}
// v5.1 已讀時機延遲(擬真:真人不會秒已讀)
async function markAsRead(token, markAsReadToken) {
  if (!markAsReadToken || !token) return;
  try {
    await fetch('https://api.line.me/v2/bot/chat/markAsRead', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAsReadToken }),
    });
  } catch (_) {}
}
function pickReadDelayMs(env) {
  const lo = Math.max(3, parseInt(env.READ_DELAY_MIN_S || '8', 10) || 8);
  const hi = Math.max(lo, parseInt(env.READ_DELAY_MAX_S || '22', 10) || 22);
  return (lo + Math.floor(Math.random() * (hi - lo + 1))) * 1000;
}
// ═══ v6 DATA:BEGIN(由 scripts/pop-line-gen-data.mjs 從 data/pop-line/*.json 產生,勿手改;改正本再重跑)═══
const ASSET_BASE = "https://milk790-code.github.io/3q-hatchery-line-oa/assets/pop/";
const SHOP_URL = "https://shopee.tw/milk790?openExternalBrowser=1";
const CATALOG = {"A002":{"n":"米速研磨劑三件組","ns":"米速 MISO 三號＋伍號＋拾號 全流程三件組｜重切＋一劑拋＋鏡面還原｜RO/GA/DA通用","cat":"bundle","p":"4,099","pn":"","u":"https://shopee.tw/product/1072078949/48101680824?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-8258c-mtjsvis84flxc2","pain":"別人一天穩接 5 台漆面單賺到翻，你拚死拚活 3 台就忙到連飯都吃不上？","sp":["三劑配合即可應對研磨全部需求","重切＋一劑拋＋鏡面還原","單買合計 NT$ 4,597"],"use":"深刮痕先用參號重切，再用伍號一劑拋，最後拾號做鏡面；能用細番數解決的，絕不用粗番數。","al":["米速研磨劑三件組","全流程三件組","三號伍號拾號","三号伍号拾号","參號伍號拾號","叁號伍號拾號","参号伍号拾号","研磨劑套組","研磨劑組合","研磨劑全套","研磨三件","米速套組","a002","研磨全套","米速全套","三罐一起","三件組","三件套"],"vl":"polish","yt":"https://www.youtube.com/playlist?list=PLDQDIDeUJ8K0","dns":["絕不燒漆、不傷漆這類保證（正確說法：正常操作下不易燒漆，燒漆主因是壓力、時間、轉速）","拋光機轉速、壓力等設定數字","已經老化、氧化的漆也救得回來（官網列為不適用，先確認車況）"],"bw":[]},"A003":{"n":"米速參號 80 番","ns":"米速 MISO 參號 頂級商用職人型 重切專用研磨劑 80番極限切削力｜特製護漆配方絕不燒漆｜純水性0遮蓋 ｜全機型通用","cat":"polish","p":"1,699","pn":"","u":"https://shopee.tw/product/1072078949/43863635029?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-825al-mtjsvd9an21427","pain":"重刮痕修復反覆研磨耗一下午","sp":["80 番極致切削","施工時間 −50%，接車數多一倍","水性、不遮蓋"],"use":"深刮痕、嚴重氧化用參號重切，接著用伍號、拾號收尾；沒把握的漆，先從最細的番數試。","al":["米速參號 80 番","米速參號80番","80番拋光劑","80番研磨","重切研磨劑","a003","三號研磨","3號研磨","三号研磨","3号研磨","米速三號","米速3號","80番","參號","叁號","参号"],"vl":"polish","yt":"https://www.youtube.com/playlist?list=PLDQDIDeUJ8K0","dns":["絕不燒漆、不傷漆這類保證（正確說法：正常操作下不易燒漆，燒漆主因是壓力、時間、轉速）","拋光機轉速、壓力等設定數字","已經老化、氧化的漆也救得回來（官網列為不適用，先確認車況）","只用參號就能做到鏡面（深刮痕要接伍號、拾號收尾）"],"bw":["A004","A005"]},"A004":{"n":"米速伍號 600 番","ns":"米速 MISO 伍號 頂級商用職人型 600番一劑拋研磨劑 耐高溫不霧影 絕不燒漆 純水性0遮蓋 一步鏡面 全機型通用","cat":"polish","p":"1,599","pn":"","u":"https://shopee.tw/product/1072078949/42163627106?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-825b9-mtjsvhu3o1dy17","pain":"重工率高還留炫光，客人不滿意，時間全浪費","sp":["一劑拋一步鏡面","左手切削、右手鏡面還原提亮","素黑專用"],"use":"中度太陽紋、輕度刮痕可以單用伍號一劑拋；要更亮再接拾號。","al":["米速伍號 600 番","米速伍號600番","600番","a004","五號研磨","5號研磨","五号研磨","5号研磨","米速五號","米速5號","一劑拋","一剂抛","伍號","伍号"],"vl":"polish","yt":"https://www.youtube.com/playlist?list=PLDQDIDeUJ8K0","dns":["絕不燒漆、不傷漆這類保證（正確說法：正常操作下不易燒漆，燒漆主因是壓力、時間、轉速）","拋光機轉速、壓力等設定數字","已經老化、氧化的漆也救得回來（官網列為不適用，先確認車況）","搭配粗棉海綿盤效果最佳（官網 A004 FAQ 的說法，vault 標為跟官方指定搭配「素黑專用極細純羊毛盤」打架）"],"bw":["A005","A003"]},"A005":{"n":"米速拾號 1000 番","ns":"米速 MISO 拾號 頂級商用職人型 超級鏡面還原劑｜特製護漆配方絕不燒漆｜純水性0遮蓋 零髮絲紋鏡面超亮｜全機型通用","cat":"polish","p":"1,299","pn":"","u":"https://shopee.tw/product/1072078949/40213627112?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-825av-mtjsvj8t0zd2da","pain":"拋完室內看很亮，太陽下一照髮絲紋全現形","sp":["用作收尾時可做出極致鏡面","亮度增加 100%","水性、不遮蓋"],"use":"輕度太陽紋可以單用拾號；當收尾接在伍號後面，做出極致鏡面。","al":["米速拾號 1000 番","米速拾號1000番","1000番","鏡面還原劑","10號研磨","10号研磨","米速10號","镜面还原","a005","十號研磨","十号研磨","米速十號","拾號","拾号"],"vl":"polish","yt":"https://www.youtube.com/playlist?list=PLDQDIDeUJ8K0","dns":["絕不燒漆、不傷漆這類保證（正確說法：正常操作下不易燒漆，燒漆主因是壓力、時間、轉速）","拋光機轉速、壓力等設定數字","已經老化、氧化的漆也救得回來（官網列為不適用，先確認車況）","專治本田（DM 原字待他確認，官網又寫年份久的素黑本田不適用）","一定要搭黑色鏡面海綿盤（官網 A005 FAQ 加的，vault 註明沒有依據；vault 原字是搭一步鏡面羊毛盤，最後用海綿盤跑一次）"],"bw":["A004","A003"]},"A040":{"n":"米速 RO 商用重切拋光劑","ns":"【米速80番重切研磨劑】RO機專用水性 商用省時省工 工位產能翻倍 汽美店家營利必備","cat":"polish","p":"1,399","pn":"","u":"https://shopee.tw/product/1072078949/44110516793?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-825a6-mtjsvgd31gcg6b","pain":"同行殺價殺到瘋，房租人工漲到心驚","sp":["RO（旋拋／直心機）重切削專用","商用省時省工，車位產能翻倍","汽美店家營利必備"],"use":"RO（旋拋／直心機）重切削專用；RO 力道最強也最容易燒漆，新手從 DA 開始。","al":["米速 RO 商用重切拋光劑","米速ro商用重切拋光劑","重切拋光劑","直心機研磨","ro重切","商用重切","店家必囤","a040"],"vl":"polish","yt":"https://www.youtube.com/playlist?list=PLDQDIDeUJ8K0","dns":["絕不燒漆、不傷漆這類保證（正確說法：正常操作下不易燒漆，燒漆主因是壓力、時間、轉速）","拋光機轉速、壓力等設定數字","已經老化、氧化的漆也救得回來（官網列為不適用，先確認車況）","1L／4L／12L 現在就買得到（蝦皮目前只有 600g）","新手直接上 RO 沒問題"],"bw":["PR1"]},"A041":{"n":"米速鍍鉻拋光劑","ns":"【非遮蓋鍍鉻修復】米速MISO極粗研磨｜鍍鉻件亮條去氧化｜還原光澤｜非遮蓋修復｜贈1寸拋光盤","cat":"metal","p":"999","pn":"","u":"https://shopee.tw/product/1072078949/40709109031?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-825b5-mtjsve95pxqdaa","pain":"鍍鉻飾條氧化發白，怎麼擦都霧霧的","sp":["非遮蓋鍍鉻修復","鍍鉻飾條去氧化｜還原光澤","隨貨附 1 吋細節盤"],"use":"只用在鍍鉻飾條、門把、排氣管尾飾這類硬鍍鉻件，絕對不能上車漆。","al":["米速鍍鉻拋光劑","排氣管尾飾","排氣管鍍鉻","鍍鉻拋光","鍍鉻飾條","a041","鍍鉻尾管","鍍鉻門把","鍍鉻","镀铬","亮條","亮条"],"vl":"none","yt":"https://www.youtube.com/playlist?list=PLHLLpJl_ai80","dns":["可以用在車漆上（它是店家專用極粗研磨，上漆面會磨穿）","真空電鍍塑膠件、霧面鍍鉻、PVD、已封孔陽極件也能用","玻璃、橡膠、塑膠、未處理鋁件也能用"],"bw":[]},"PR1":{"n":"RO 極致重切羊毛盤","ns":"【極致重切-高彈】泡泡怪獸RO訂製羊毛盤 高彈海綿背板降RO風險 不噴毛升溫慢 耐久300% 80番切削","cat":"pad","p":"999","pn":"","u":"https://shopee.tw/product/1072078949/42913686096?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-8258h-mtjsvfpmhjpf70","pain":"重刮痕磨半天磨不動，羊毛盤還一直噴毛發燙","sp":["80 番暴力切削","高彈海綿緩衝背板｜降 RO 風險","不噴毛｜升溫慢｜耐久 300%"],"use":"RO 機用，處理深層刮痕、重度氧化，搭參號 80 番重切。","al":["RO 極致重切羊毛盤","ro極致重切羊毛盤","ro羊毛盤重切","ro80番羊毛","ro重切羊毛","ro機用羊毛","旋拋機用羊毛","直心機用羊毛","80番羊毛","高彈羊毛盤","ro用羊毛","旋拋機羊毛","直心機羊毛","ro羊毛","旋拋羊毛","pr1"],"vl":"polish","yt":"https://www.youtube.com/playlist?list=PLDQDIDeUJ8K0","dns":["盤徑、硬度、轉速等規格（官網寫目前沒有可公布的正式規格，轉真人確認）","純羊毛、合成羊毛這類材質說法","RO 旁邊寫 Random Orbital（RO 是旋拋／直心機）","「95% 的人選 RO」「一步 95% 鏡面」這類比例"],"bw":["A003","A040"]},"A039":{"n":"RO 一步鏡面羊毛盤","ns":"【一步鏡面】泡泡怪獸RO訂製羊毛盤 高彈海綿背板降RO風險 不噴毛升溫慢 耐久300% 一步95%鏡面 專治素黑軟漆","cat":"pad","p":"999","pn":"","u":"https://shopee.tw/product/1072078949/43563684513?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-8258w-mtjsvh9r3h1e1a","pain":"素黑軟漆一拋就留二傷，越修越花","sp":["極小二傷·一步鏡面","素黑軟漆專用","高彈海綿緩衝背板｜降 RO 風險"],"use":"RO 機用，處理輕中度瑕疵、一步拋，素黑軟漆專用；搭伍號或拾號。","al":["RO 一步鏡面羊毛盤","ro一步鏡面羊毛盤","ro一步鏡面羊毛","ro鏡面羊毛盤","ro一步鏡面","素黑軟漆羊毛","ro機用羊毛","旋拋機用羊毛","直心機用羊毛","軟漆羊毛盤","ro用羊毛","旋拋機羊毛","直心機羊毛","極小二傷","a039","ro羊毛","旋拋羊毛"],"vl":"polish","yt":"https://www.youtube.com/playlist?list=PLDQDIDeUJ8K0","dns":["盤徑、硬度、轉速等規格（官網寫目前沒有可公布的正式規格，轉真人確認）","純羊毛、合成羊毛這類材質說法","RO 旁邊寫 Random Orbital（RO 是旋拋／直心機）","「95% 的人選 RO」「一步 95% 鏡面」這類比例","專治本田（DM 原字待他確認，官網又寫年份久的素黑本田不適用）"],"bw":["A004","A005"]},"PG1":{"n":"GA／DA 極致重切羊毛盤","ns":"【極致重切】泡泡怪獸 羊毛盤 背板強化 RO/GA/DA 不噴毛 升溫慢 受力平均 耐久升300%不形變 切削最高80番","cat":"pad","p":"899","pn":"","u":"https://shopee.tw/product/1072078949/43120451521?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-8259g-mtjsve037r4367","pain":"深刮痕 GA／DA 磨不動，羊毛盤沒幾次就變形","sp":["切削最高 80 番","RO／GA／DA 三機通用｜背板強化","耐久升 300% 不形變"],"use":"RO、GA、DA 都能用（GA／DA 訂製），處理深層刮痕、重度氧化，搭參號 80 番重切。","al":["GA／DA 極致重切羊毛盤","ga／da極致重切羊毛盤","ga/da重切羊毛","gada重切羊毛","da80番羊毛","ga80番羊毛","ga/da羊毛","ga／da羊毛","ga重切羊毛","da重切羊毛","da機用羊毛","ga機用羊毛","gada羊毛","震拋機用羊毛","齒輪機用羊毛","偏心機用羊毛","雙動機用羊毛","80番羊毛","da用羊毛","ga用羊毛","震拋機羊毛","齒輪機羊毛","偏心機羊毛","雙動機羊毛","da羊毛","ga羊毛","震拋羊毛","pg1"],"vl":"polish","yt":"https://www.youtube.com/playlist?list=PLDQDIDeUJ8K0","dns":["盤徑、硬度、轉速等規格（官網寫目前沒有可公布的正式規格，轉真人確認）","純羊毛、合成羊毛這類材質說法","RO 旁邊寫 Random Orbital（RO 是旋拋／直心機）","「95% 的人選 RO」「一步 95% 鏡面」這類比例"],"bw":["A003"]},"PG2":{"n":"GA／DA 極小二傷羊毛盤","ns":"【極小二傷】泡泡怪獸 羊毛盤 背板強化 GA/DA訂製款 不噴毛 升溫慢 受力平均 耐久升300%不形變 一步95%鏡面","cat":"pad","p":"899","pn":"","u":"https://shopee.tw/product/1072078949/41070439699?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-82588-mtjsvdysbax25a","pain":"軟漆一步拋老是留二傷，還要再補一道","sp":["一步鏡面·極小二傷","素黑軟漆專用","耐久升 300% 不形變"],"use":"RO、GA、DA 都能用（GA／DA 訂製），處理輕中度瑕疵、一步拋，素黑軟漆專用；搭伍號或拾號。","al":["GA／DA 極小二傷羊毛盤","ga／da極小二傷羊毛盤","ga一步鏡面羊毛","da一步鏡面羊毛","da鏡面羊毛盤","ga鏡面羊毛盤","ga/da羊毛","ga／da羊毛","da機用羊毛","ga機用羊毛","gada羊毛","震拋機用羊毛","齒輪機用羊毛","偏心機用羊毛","雙動機用羊毛","da用羊毛","ga用羊毛","震拋機羊毛","齒輪機羊毛","偏心機羊毛","雙動機羊毛","極小二傷","极小二伤","da羊毛","ga羊毛","震拋羊毛","pg2"],"vl":"polish","yt":"https://www.youtube.com/playlist?list=PLDQDIDeUJ8K0","dns":["盤徑、硬度、轉速等規格（官網寫目前沒有可公布的正式規格，轉真人確認）","純羊毛、合成羊毛這類材質說法","RO 旁邊寫 Random Orbital（RO 是旋拋／直心機）","「95% 的人選 RO」「一步 95% 鏡面」這類比例","專治本田（DM 原字待他確認，官網又寫年份久的素黑本田不適用）"],"bw":["A004","A005"]},"PR3":{"n":"RO 粗修主力海綿盤","ns":"【粗棉】泡泡怪獸 高密度海綿拋光盤 頂級拋光 RO訂製款 耐磨受力均勻 耐用升300% 效率/效果雙升50%","cat":"pad","p":"899","pn":"","u":"https://shopee.tw/product/1072078949/40313774738?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-8257v-mtjsvciq6hhdcd","pain":"重切完漆面一片霧，海綿盤才幾台車就塌掉","sp":["海綿中，耐用性最高","高熱穩定 EVA｜耐用升 300%","效率效果雙升 50%"],"use":"RO 機用，切削完接著用，初步快速還原；重度修正的順序是羊毛盤重切 → 粗棉 → 中棉 → 細棉。","al":["RO 粗修主力海綿盤","ro粗修主力海綿盤","ro粗海綿","ro粗修","粗修主力","ro粗棉","pr3","粗海綿","粗棉"],"vl":"polish","yt":"https://www.youtube.com/playlist?list=PLDQDIDeUJ8K0","dns":["盤徑、硬度、轉速等規格（官網寫目前沒有可公布的正式規格，轉真人確認）","純羊毛、合成羊毛這類材質說法","RO 旁邊寫 Random Orbital（RO 是旋拋／直心機）","「95% 的人選 RO」「一步 95% 鏡面」這類比例","固定搭配說法：粗棉一定搭伍號 600 番（官網 A004 FAQ 的說法，vault 標為跟官方指定搭配「素黑專用極細純羊毛盤」打架；搭配只講建議起手式，用 meta.pairing_line）"],"bw":[]},"PR4":{"n":"RO 中棉海綿盤（硬漆）","ns":"【中棉】泡泡怪獸 高密度海綿拋光盤 頂級拋光 RO訂製款 耐磨受力均勻 耐用升300% 效率/效果雙升50%","cat":"pad","p":"899","pn":"","u":"https://shopee.tw/product/1072078949/44363918816?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-82587-mtjsvgah8op4a7","pain":"硬漆拋半天就是不出鏡面","sp":["更適合硬漆鏡面","高熱穩定 EVA｜耐用升 300%","效率效果雙升 50%"],"use":"RO 機用，切削完還原，更適合硬漆鏡面。","al":["RO 中棉海綿盤（硬漆）","ro中棉海綿盤（硬漆）","ro硬漆海綿","ro中海綿","ro中棉","pr4","中海綿","中棉"],"vl":"polish","yt":"https://www.youtube.com/playlist?list=PLDQDIDeUJ8K0","dns":["盤徑、硬度、轉速等規格（官網寫目前沒有可公布的正式規格，轉真人確認）","純羊毛、合成羊毛這類材質說法","RO 旁邊寫 Random Orbital（RO 是旋拋／直心機）","「95% 的人選 RO」「一步 95% 鏡面」這類比例"],"bw":[]},"A033":{"n":"RO 極致鏡面海綿盤","ns":"【極致鏡面】泡泡怪獸 高密度海綿拋光盤 鏡面拋光 RO訂製款 耐磨受力均勻 耐用升300% 效率/效果雙升50%","cat":"pad","p":"899","pn":"","u":"https://shopee.tw/product/1072078949/44163940511?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-82599-mtjsvhbkg8p25c","pain":"軟漆收尾怎麼拋都有炫光，鏡面出不來","sp":["更適合軟漆鏡面","高熱穩定 EVA｜耐用升 300%","效率效果雙升 50%"],"use":"RO 機用，切削完還原、做出超級鏡面，更適合軟漆；拾號收尾後，最後用海綿盤跑一次。","al":["RO 極致鏡面海綿盤","ro極致鏡面海綿盤","ro鏡面海綿","ro極致鏡面","ro細海綿","黑色海綿盤","ro鏡面棉","ro細棉","a033","黑色海綿","細海綿","鏡面棉","細棉"],"vl":"polish","yt":"https://www.youtube.com/playlist?list=PLDQDIDeUJ8K0","dns":["盤徑、硬度、轉速等規格（官網寫目前沒有可公布的正式規格，轉真人確認）","純羊毛、合成羊毛這類材質說法","RO 旁邊寫 Random Orbital（RO 是旋拋／直心機）","「95% 的人選 RO」「一步 95% 鏡面」這類比例","固定搭配說法：鏡面棉一定搭拾號 1000 番（官網 A005 FAQ 自己加的，vault 註明沒有依據；拾號只講「收尾後最後用海綿盤跑一次」，搭配用 meta.pairing_line）"],"bw":[]},"PG3":{"n":"GA／DA 粗棉海綿盤","ns":"【粗棉】泡泡怪獸 高密度海綿拋光盤 頂級拋光 GA/DA訂製款 耐磨受力均勻 耐用升300% 效率/效果雙升50%","cat":"pad","p":"799","pn":"","u":"https://shopee.tw/product/1072078949/42664241053?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-82582-mtjsvc7qhsecff","pain":"GA／DA 切削完一片霧，海綿盤幾台車就塌","sp":["海綿中，耐用性最高","高熱穩定 EVA｜耐用升 300%","效率效果雙升 50%"],"use":"GA／DA 機用，切削完接著用，初步快速還原；重度修正的順序是羊毛盤重切 → 粗棉 → 中棉 → 細棉。","al":["GA／DA 粗棉海綿盤","ga／da粗棉海綿盤","ga/da粗棉","da粗海綿","ga粗海綿","ga粗棉","da粗棉","pg3","粗海綿","粗棉"],"vl":"polish","yt":"https://www.youtube.com/playlist?list=PLDQDIDeUJ8K0","dns":["盤徑、硬度、轉速等規格（官網寫目前沒有可公布的正式規格，轉真人確認）","純羊毛、合成羊毛這類材質說法","RO 旁邊寫 Random Orbital（RO 是旋拋／直心機）","「95% 的人選 RO」「一步 95% 鏡面」這類比例","固定搭配說法：粗棉一定搭伍號 600 番（官網 A004 FAQ 的說法，vault 標為跟官方指定搭配「素黑專用極細純羊毛盤」打架；搭配只講建議起手式，用 meta.pairing_line）"],"bw":[]},"PG4":{"n":"GA／DA 中棉海綿盤（硬漆）","ns":"【中棉】泡泡怪獸 高密度海綿拋光盤 頂級拋光 GA/DA訂製款 耐磨受力均勻 耐用升300% 效率/效果雙升50%","cat":"pad","p":"799","pn":"","u":"https://shopee.tw/product/1072078949/40614228755?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-825b1-mtjsvcjbyadmd0","pain":"硬漆用 GA／DA 拋不出鏡面","sp":["更適合硬漆鏡面","高熱穩定 EVA｜耐用升 300%","效率效果雙升 50%"],"use":"GA／DA 機用，切削完還原，更適合硬漆鏡面。","al":["GA／DA 中棉海綿盤（硬漆）","ga／da中棉海綿盤（硬漆）","ga/da中棉","da中海綿","ga中海綿","ga中棉","da中棉","pg4","中海綿","中棉"],"vl":"polish","yt":"https://www.youtube.com/playlist?list=PLDQDIDeUJ8K0","dns":["盤徑、硬度、轉速等規格（官網寫目前沒有可公布的正式規格，轉真人確認）","純羊毛、合成羊毛這類材質說法","RO 旁邊寫 Random Orbital（RO 是旋拋／直心機）","「95% 的人選 RO」「一步 95% 鏡面」這類比例"],"bw":[]},"PG5":{"n":"GA／DA 極致鏡面海綿盤","ns":"【極致鏡面】泡泡怪獸 高密度海綿拋光盤 鏡面拋光 GA/DA訂製款 耐磨受力均勻 耐用升300% 效率/效果雙升50%","cat":"pad","p":"799","pn":"","u":"https://shopee.tw/product/1072078949/26490250909?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-82598-mtjsvcjv2m8a7a","pain":"軟漆用 GA／DA 收尾總留炫光，鏡面出不來","sp":["更適合軟漆鏡面","高熱穩定 EVA｜耐用升 300%","效率效果雙升 50%"],"use":"GA／DA 機用，切削完還原、做出超級鏡面，更適合軟漆；拾號收尾後，最後用海綿盤跑一次。","al":["GA／DA 極致鏡面海綿盤","ga／da極致鏡面海綿盤","ga鏡面海綿","da鏡面海綿","da極致鏡面","ga極致鏡面","da細海綿","ga細海綿","ga鏡面棉","da鏡面棉","da細棉","黑色海綿","ga細棉","pg5","細海綿","鏡面棉","細棉"],"vl":"polish","yt":"https://www.youtube.com/playlist?list=PLDQDIDeUJ8K0","dns":["盤徑、硬度、轉速等規格（官網寫目前沒有可公布的正式規格，轉真人確認）","純羊毛、合成羊毛這類材質說法","RO 旁邊寫 Random Orbital（RO 是旋拋／直心機）","「95% 的人選 RO」「一步 95% 鏡面」這類比例","固定搭配說法：鏡面棉一定搭拾號 1000 番（官網 A005 FAQ 自己加的，vault 註明沒有依據；拾號只講「收尾後最後用海綿盤跑一次」，搭配用 meta.pairing_line）"],"bw":[]},"A037":{"n":"火山去污泥","ns":"泡泡怪獸 火山去污泥黏土 暴力汽美專用｜鐵粉柏油一刀斬｜贈磨泥藥水","cat":"decon","p":"699","pn":"","u":"https://shopee.tw/product/1072078949/44455912772?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-8258p-mtjsvdr4dkau31","pain":"洗完車漆面摸起來還是沙沙的，鐵粉全卡在漆裡","sp":["漆面專用磁土","掉地上就丟"],"use":"搭配磨泥潤滑液在漆面畫圈輕推，把卡住的顆粒帶下來；全程保持濕潤、禁止乾磨，包膜不適用，掉到地上就丟。","al":["火山去污泥","去鐵粉的泥","美容黏土","a037","鐵粉黏土","鐵粉磁土","火山泥","去污泥","跑磁土","跑黏土","鐵粉泥","磁土","黏土","粘土","瓷土"],"vl":"decon","yt":"https://www.youtube.com/playlist?list=PLSuJIu3-yk_c","dns":["包膜、犀牛皮、改色膜也能用","可以乾磨，或只配清水就好","掉到地上洗一洗還能用","能去柏油（官網沒寫）"],"bw":["A036","A007","A034"]},"A036":{"n":"磨泥潤滑液","ns":"泡泡怪獸POP磨泥潤滑液 / 高效去污泥洗車泥伴侶 / 中性配方不傷車漆玻璃 / 汽車清潔必備","cat":"decon","p":"499","pn":"規格與容量以官網商品頁為準","u":"https://shopee.tw/product/1072078949/43461419604?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-825ao-mtjsvf9jx6vcf1","pain":"磁土乾推一下，漆面多一堆新刮痕","sp":["磁土專用","黏土的另一半，防二次刮傷"],"use":"漆面和磁土兩邊都噴，表面一乾就補噴，全程禁止乾磨。","al":["磨泥潤滑液","跑黏土要噴","磨泥潤滑","磁土潤滑","黏土潤滑","a036","潤滑液","润滑液","潤滑劑"],"vl":"decon","yt":"https://www.youtube.com/playlist?list=PLSuJIu3-yk_c","dns":["稀釋比例（DM 印的「十倍稀釋」也不講）","可以乾磨","中性配方（官網沒標 pH）"],"bw":["A037","A007","A034"]},"A034":{"n":"拋光前導脫脂劑","ns":"泡泡怪獸 拋光前導脫脂劑｜汽車美容鍍膜前置｜去油膜蠟膜殘留｜提升鍍膜服貼亮度","cat":"decon","p":"599","pn":"","u":"https://shopee.tw/product/1072078949/41405339235?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-82594-mtjsvgzktuki61","pain":"鍍膜不服貼","sp":["汽車美容鍍膜前置","去油膜蠟膜殘留","提升鍍膜服貼亮度"],"use":"拋光後、上鍍膜前一噴一擦，清掉油脂和蠟質；脫脂完半小時內上鍍膜。","al":["拋光前導脫脂劑","鍍膜不服貼","脫脂神噴","無毒脫脂","拋光前導","抛光前导","鍍膜前置","a034","脫脂劑","前導劑","脫脂","脱脂"],"vl":"decon","yt":"https://www.youtube.com/playlist?list=PLBt5iCYZdcxM","dns":["無毒、室內放心大面積用（官網注意事項寫室內避免大面積施工）","IPA 的安全替代品","附著力下降 50% 這類數字","剛做好鍍膜或打蠟的車也能全車噴（會把蠟和塗層一起帶走）","成分、pH、稀釋比例"],"bw":["A007","A037","A036"]},"A044":{"n":"超級泡沫洗車精","ns":"【基礎正洗】泡泡怪獸 超級泡沫洗車液 12分鐘長掛泡 潤滑防劃傷 高濃縮抵50公升洗車精","cat":"wash","p":"599","pn":"規格與容量以官網商品頁為準","u":"https://shopee.tw/product/1072078949/41555347747?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/tw-11134207-820l8-mm9lo69v4rno62","pain":"洗車怕刮出細紋？","sp":["泡沫懸掛性強｜12 分鐘長掛泡","潤滑防劃傷","高濃縮抵 50 公升洗車精"],"use":"泡沫打滿全車靜置約 5 分鐘，再用洗車手套正洗、沖乾淨；不要用霧化方式噴。","al":["superfoam","超級泡沫洗車精","洗車怕刮出細紋","泡沫洗車精","正洗洗車精","超級泡沫","超级泡沫","a044","長掛泡","洗車精","洗車液"],"vl":"wash","yt":"https://www.youtube.com/playlist?list=PLSk3kbuy0rz4","dns":["稀釋比例（DM 印的 PA 壺、泡沫壺比例也不講）","用霧化方式噴也可以"],"bw":["A032","A001"]},"A032":{"n":"丹若免刷預洗洗車液","ns":"【免刷預洗】泡泡怪獸 丹若預洗泡沫 陽極電鍍專用 改裝車0風險 高濃縮抵50公升洗車精","cat":"wash","p":"699","pn":"","u":"https://shopee.tw/product/1072078949/42605348184?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-8258z-mtjsvf8slxc759","pain":"刷車刷到手痠？","sp":["免刷預洗｜陽極電鍍專用","改裝車 0 風險","高濃縮抵 50 公升洗車精"],"use":"兌水噴滿全車，軟化髒污再沖掉。","al":["丹若免刷預洗洗車液","刷車刷到手痠","預洗洗車液","預洗洗車精","免刷預洗","預洗泡沫","a032","丹若洗車","丹若","預洗","预洗","免刷"],"vl":"wash","yt":"https://www.youtube.com/playlist?list=PLSk3kbuy0rz4","dns":["稀釋比例（蝦皮規格的「最高300倍稀釋」也不講）"],"bw":["A044","A001"]},"A045":{"n":"木瓜怪獸雙清輪框清潔劑","ns":"【重污清潔】泡泡怪獸 木瓜雙清輪框清潔劑 引擎室蟲膠去除 多功能一劑多用 高濃縮配方","cat":"wash","p":"699","pn":"","u":"https://shopee.tw/product/1072078949/42055348070?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-825b8-mtjsvgoi7sw52a","pain":"重油污洗不掉？","sp":["輪框、引擎室、蟲膠去除","一噴一沖秒乾淨｜95% 免刷洗","重污清潔｜多功能一劑多用｜高濃縮配方"],"use":"噴在輪框或重污處，一噴一沖；煞車盤燙的時候先等它冷，引擎室用低水壓沖。","al":["木瓜怪獸雙清輪框清潔劑","輪框黑到洗不掉","重油污洗不掉","洗車打底劑","木瓜怪獸","木瓜雙清","輪框清潔","輪圈清潔","轮毂清洗","鋼圈清潔","鋁圈清潔","a045","a020","木瓜","雙清"],"vl":"wheel","yt":"https://www.youtube.com/playlist?list=PLSuJIu3-yk_c","dns":["稀釋比例（蝦皮規格的倍數也不講）","煞車盤還燙也能直接噴","引擎室用高壓水沖","電鍍件、陽極件不用先試","清油漆、除漆（它不除漆）","靜置幾分鐘（事實沒寫就不講）"],"bw":["A007","A024"]},"A046":{"n":"黑曼羅弱酸洗車泡沫","ns":"【去垢脫脂】泡泡怪獸 黑曼羅弱酸洗車泡沫 鍍膜車專用 除水垢殘蠟 高濃縮抵50公升洗車精","cat":"wash","p":"699","pn":"","u":"https://shopee.tw/product/1072078949/43011034316?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-825a9-mtjsvj646ltse8","pain":"水垢洗不掉？","sp":["去垢脫脂、增加亮度","除水垢、殘蠟","鍍膜車專用"],"use":"鍍膜車正洗用，去水垢、殘蠟；鋁圈、鍍鉻件、裸金屬不要用。","al":["黑曼羅弱酸洗車泡沫","鍍膜車洗車","黑曼羅洗車","酸性洗車","水垢洗車","a046","黑曼羅","黑曼罗","鍍膜車","弱酸","酸洗"],"vl":"wash","yt":"https://www.youtube.com/playlist?list=PLSk3kbuy0rz4","dns":["稀釋比例（官網的濃淡用法也轉真人）","鋁圈、鍍鉻件、未封釉裸金屬也能用"],"bw":[]},"EC007":{"n":"海洋之星鍍膜洗車液","ns":"【鍍膜正洗】泡泡怪獸 海洋之心洗車泡沫 清潔鍍膜二合一 潑水防護 高濃縮抵50公升洗車精","cat":"wash","p":"599","pn":"規格與容量以官網商品頁為準","u":"https://shopee.tw/product/1072078949/48650224219?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-8259l-mtjsvj6e7ls058","pain":"沒空上鍍膜？","sp":["鍍膜正洗、潑水防護","清潔鍍膜二合一","洗完增加一層鍍膜"],"use":"日常正洗用，清潔同時多一層鍍膜、潑水防護。","al":["海洋之星鍍膜洗車液","鍍膜洗車液","鍍膜洗車精","ec007","沒空上鍍膜","海洋之星","海洋之心","鍍膜洗車","镀膜洗车","潑水洗車","鍍膜車"],"vl":"wash","yt":"https://www.youtube.com/playlist?list=PLSk3kbuy0rz4","dns":["稀釋比例","鍍膜能撐多久的數字（DM、官網都沒寫）"],"bw":[]},"EC006":{"n":"柑橘上光洗車液","ns":"【上光正洗】泡泡怪獸 柑橘上光洗車泡沫 清潔上光二合一 懶人專用 高濃縮抵50公升洗車精","cat":"wash","p":"599","pn":"規格與容量以官網商品頁為準","u":"https://shopee.tw/product/1072078949/51000208392?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-8258x-mtjsvkhksvt31e","pain":"洗完不夠亮？","sp":["上光正洗、懶人專用","清潔上光二合一","洗完增加亮度"],"use":"日常正洗用，清潔同時上光。","al":["柑橘上光洗車液","洗完車不夠亮","ec006","洗完不夠亮","洗完車不亮","柑橘上光","上光洗車","橘子洗車","洗完不亮","柑橘洗車","柑橘"],"vl":"wash","yt":"https://www.youtube.com/playlist?list=PLSk3kbuy0rz4","dns":["稀釋比例","亮度能維持多久的數字（DM、官網都沒寫）"],"bw":[]},"A009":{"n":"三合一液體橡皮擦","ns":"米速 三合一液體橡皮擦｜車漆清潔蠟｜無研磨劑安全配方｜即擦亮白｜去水垢水痕｜手工拋光替代｜台灣適用","cat":"decon","p":"699","pn":"","u":"https://shopee.tw/product/1072078949/29638860343?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/tw-11134207-820la-mtjt6wchtpmrc9","pain":"白車洗不白？","sp":["清潔美白去污｜即擦亮白","去殘蠟、去水垢水痕","無研磨劑、安全配方"],"use":"不用稀釋，取適量直接擦在白痕、污垢、水痕上，手擦或 DA 配軟海綿盤都行；它處理痕漬，不處理刮痕。","al":["三合一液體橡皮擦","液體橡皮擦","液体橡皮擦","三合一液體","白車洗不白","a009","橡皮擦","清潔蠟","黑刁底","白車黃"],"vl":"decon","yt":"https://www.youtube.com/playlist?list=PLBt5iCYZdcxM","dns":["能去刮痕、太陽紋（它只處理痕漬）"],"bw":[]},"A007":{"n":"中性鐵粉去除劑","ns":"【中性濃縮不腐蝕】泡泡怪獸中性鐵粉去除劑｜快速分解鏽點剎車粉｜不傷車漆輪轂｜低味溫和｜一噴除鐵粉","cat":"decon","p":"699","pn":"","u":"https://shopee.tw/product/1072078949/43755343892?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/tw-11134207-820li-mmb4034skkckfb","pain":"漆面摸起來粗","sp":["一噴除鐵粉，鐵粉當場現形","快速分解鏽點、煞車粉","中性濃縮不腐蝕｜不傷車漆輪框"],"use":"噴上靜置 3 分鐘，鐵粉當場現形，再用高壓水沖淨，不用刷。","al":["中性鐵粉去除劑","漆面摸起來粗","鐵粉去除","鐵粉清潔","黃褐鏽點","a007","去鐵粉","煞車粉","剎車粉","刹车粉","鐵粉","铁粉","除鐵","除铁","鏽點"],"vl":"wheel","yt":"https://www.youtube.com/playlist?list=PLSuJIu3-yk_c","dns":["稀釋比例","所有材質都測過沒問題（官網寫相容性只有配方端說法）"],"bw":["A037","A036","A034"]},"A043":{"n":"汽車柏油去除劑","ns":"泡泡怪獸 汽車柏油去除劑 不咬塑膠｜3秒溶柏油樹膠 不傷車漆 美容廠指定","cat":"decon","p":"499","pn":"","u":"https://shopee.tw/product/1072078949/44009097486?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-825bb-mtjsvelylts788","pain":"黑點擦不掉","sp":["3 秒溶柏油，樹膠一起溶","不咬塑膠、不傷車漆","帶水直接噴，軟布一擦就掉"],"use":"直接噴在柏油、樹膠上，車身帶水也可以，靜置約 2 分鐘再用軟布擦掉。","al":["汽車柏油去除劑","黑點擦不掉","柏油去除","柏油清潔","a043","柏油","瀝青","沥青","樹膠","树胶","黑點"],"vl":"decon","yt":"https://www.youtube.com/playlist?list=PLSuJIu3-yk_c","dns":["附噴頭（蝦皮規格註明無噴頭）"],"bw":[]},"A030":{"n":"水垢水漬去除劑","ns":"泡泡怪獸 車用水漬去除劑｜水垢清潔｜不傷塑膠不傷漆｜不咬手無腐蝕｜玻璃水痕車身水漬高效去除","cat":"decon","p":"499","pn":"","u":"https://shopee.tw/product/1072078949/43209131846?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-825am-mtjsvezxplvpbc","pain":"洗完一曬就花","sp":["車窗水痕、車身水漬","不傷塑膠、不傷漆","不咬手無腐蝕"],"use":"塗上靜置 1～2 分鐘讓水漬分解，再擦、再沖水，不要讓藥劑乾在漆面上。","al":["水垢水漬去除劑","洗完一曬就花","水垢水漬","水垢去除","水漬去除","a030","玻璃水痕","玻璃水漬","玻璃水垢","玻璃水斑","車窗水痕","車窗水漬","痕厲害","水垢","水漬","水痕","水斑"],"vl":"decon","yt":"https://www.youtube.com/playlist?list=PLBt5iCYZdcxM","dns":["酸性或中性（官網不對酸鹼做任何宣稱）","附噴頭（蝦皮規格註明不附噴頭）"],"bw":[]},"A038":{"n":"包膜店專用除膠劑","ns":"包膜店專用 泡泡怪獸除膠劑 頑固殘膠快速溶解 不傷膜材不傷手 包膜師傅耗材","cat":"decon","p":"499","pn":"","u":"https://shopee.tw/product/1072078949/41969097694?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/tw-11134207-820lg-mmj1t922yo0608","pain":"殘膠刮不完","sp":["頑固殘膠快速溶解","不傷膜材、不傷手","撕膜、貼紙、雙面膠都行"],"use":"噴上靜置 3～5 分鐘，頑固厚膠再噴一次、等 5～10 分鐘，用超細纖維布擦掉。","al":["包膜店專用除膠劑","殘膠刮不完","包膜除膠","a038","雙面膠","貼紙膠","除膠","除胶","殘膠","残胶","撕膜"],"vl":"decon","yt":"https://www.youtube.com/playlist?list=PLBt5iCYZdcxM","dns":["所有材質都測過沒問題（官網寫沒有完整相容性測試，沒把握先小範圍試）"],"bw":[]},"A031":{"n":"萬用神噴 多功能清潔劑","ns":"泡泡怪獸 萬用神噴 多功能清潔劑 500ml｜中性 0 殘留｜全材質安心｜家用車用｜附噴頭","cat":"leather","p":"699","pn":"","u":"https://shopee.tw/product/1072078949/40955339472?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-8258u-mtjsviqitr0iaa","pain":"清潔劑一大堆","sp":["一瓶解決｜中性 0 殘留","全材質安心｜家用車用","免沖洗"],"use":"噴上再用超細纖維布反覆擦，免沖洗；織物、皮革、塑件、內裝飾條都能用。","al":["萬用神噴 多功能清潔劑","萬用神噴多功能清潔劑","多功能清潔劑","多功能清洁剂","清潔劑一大堆","全能清潔劑","萬用清潔劑","万用清洁剂","多功能清潔","萬用神噴","万用神喷","a031","萬用清潔","万用清洁","全能清潔"],"vl":"leather","yt":"https://www.youtube.com/playlist?list=PLBt5iCYZdcxM","dns":["陽極處理鋁件、鍍鉻件、車漆鍍膜層、改色膜也能用（官網寫沒有相容性資料、請勿直接施工）","一定附噴頭（DM 寫附、蝦皮規格寫不附，以蝦皮頁為準）","稀釋比例（母料版比例也不講）"],"bw":[]},"IC002":{"n":"大力神萬用清潔劑","ns":"【超濃縮萬用母料】泡泡怪獸大力神 apc超濃縮汽車內飾清潔劑原液 橙油萬用款 1瓶抵20罐 不傷材質 除霉去味","cat":"leather","p":"499","pn":"規格與容量以官網商品頁為準","u":"https://shopee.tw/product/1072078949/28587821386?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-825b0-mtjsvcbfiadf9b","pain":"座椅、門板越用越髒？","sp":["超濃縮萬用母料｜1 瓶抵 20 罐","橙油去污脫脂｜不刺鼻","座椅、門板、中控、車頂內襯、地毯"],"use":"稀釋後裝噴壺，噴在髒污處再用乾淨的超細纖維布擦；稀釋多少看瓶身標示，真皮、淺色座椅、麂皮先在不顯眼處試。","al":["大力神萬用清潔劑","座椅門板越用越髒","內裝髒又有味","萬用清潔劑","万用清洁剂","ic002","內裝清潔","內飾清潔","内饰清洁","內裝清洗","a012","座椅清潔","大力神","apc","橙油","門板"],"vl":"leather","yt":"https://www.youtube.com/playlist?list=PLBt5iCYZdcxM","dns":["除霉、殺菌（蝦皮標題的「除霉」不能講）","稀釋比例（官網說內部版本互相打架，以瓶身為準）","pH 數字（官網還沒定版）"],"bw":[]},"A001":{"n":"天使塗層","ns":"泡泡怪獸 千倍濃縮天使塗層｜汽車鍍膜劑｜1ml=1L｜1秒施工免噴免擦｜抗污耐酸鹼0殘留","cat":"coating","p":"1,199 起","pn":"規格與容量以官網商品頁為準","u":"https://shopee.tw/product/1072078949/40055380374?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-8259l-mtjsvjm4px4z91","pain":"洗完車，亮不了幾天？","sp":["無油影","極致撥水｜不吸灰","抗污耐酸鹼｜0殘留"],"use":"洗完車趁車身還濕直接噴，用洗車手套輕帶一遍再沖水收乾；單層不堆疊，每次洗完噴一次，耐久約一個月。","al":["洗完車亮不了幾天","guard","雨刷有聲音","亮不了幾天","天使塗層","天使涂层","千倍濃縮","千倍浓缩","雨刷異響","a001","前擋鍍膜","鍍膜劑","镀膜剂","水鍍膜","撥水劑","雨刷叫","吱吱叫","天使"],"vl":"angel","yt":"https://www.youtube.com/playlist?list=PLCCgTJRYB-AY","dns":["稀釋比例、1ml=1L 換算（DM 有印也不講）","免噴免擦（標準答案是每次洗完直接噴）","疊好幾層效果更好（單層不堆疊）","一定要用純水（他 09-29 更正：自來水就可以）","耐久超過約一個月","pH、成分","未經深度清潔的前擋玻璃直接噴（官網：會油膩、發污、發蒙；前擋要先清乾淨，已做過玻璃鍍膜且表面乾淨的才可以直接噴；DM 印的「前擋也能上」要帶這個條件講）"],"bw":["A032","A044"]},"A024":{"n":"輪胎塑件精油","ns":"泡泡怪獸 輪胎塑件精油 超持效防龜裂｜一擦亮如新 防UV老化 汽機車通用","cat":"tire","p":"999","pn":"規格與容量以官網商品頁為準","u":"https://shopee.tw/product/1072078949/41155347380?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-8259w-mtjsve4wgglf16","pain":"輪胎、塑件發白龜裂？","sp":["超持效防龜裂｜一擦亮如新","防 UV 老化｜汽機車通用","輪胎自然黑亮：不死亮、不厚重、更耐看"],"use":"原液倒在海綿上，薄塗輪胎側壁、車外黑色塑件，靜置約 5 分鐘，擦掉多餘殘留即可。","al":["輪胎塑件發白龜裂","輪胎塑件精油","輪胎發白龜裂","塑膠件發白","輪胎精油","轮胎精油","輪胎亮光","輪胎發白","喚醒輪胎","a024","輪胎油","輪胎蠟","塑料件","塑件"],"vl":"tire","yt":"https://www.youtube.com/playlist?list=PLSuJIu3-yk_c","dns":["塗在胎面（只塗側壁）","不含矽油（官網這句被標為沒有依據）"],"bw":["A045"]},"A035":{"n":"無鈰玻璃油膜去除膏","ns":"泡泡怪獸 無鈰玻璃油膜去除膏 中性無酸｜無研磨溶解 透光+90%｜汽車玻璃專用","cat":"glass","p":"999","pn":"","u":"https://shopee.tw/product/1072078949/29037816371?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-8258v-mtjsvgn3orglef","pain":"夜間會車刺眼、下雨看不清？","sp":["中性無酸｜汽車玻璃專用","手擦、機拋都能用","雨天不再白茫茫｜視線清晰、拒絕眩光"],"use":"先清掉鐵粉和砂粒，玻璃保持濕潤，用手擦或機拋畫圈，約 2 分鐘後沖淨；微濕毛巾擦過不留印記，就是油膜除乾淨了。","al":["無鈰玻璃油膜去除膏","夜間會車刺眼","玻璃清潔膏","下雨看不清","油膜去除","玻璃油膜","a035","會車刺眼","油膜膏","去油膜","前擋霧","油膜","無鈰","无铈"],"vl":"glass","yt":"https://www.youtube.com/playlist?list=PLHLLpJl_ai80","dns":["可以乾擦乾磨","被砂粒刮傷的玻璃也能拋回來（只能換玻璃）","車內側玻璃、隔熱膜也能用（官網沒有相容性資料）","原理和成分（DM 寫無研磨溶解、官網寫含低硬度研磨顆粒，兩邊相反，轉真人）","透光 +90%（官網本文沒有，只掛在 a035 頁的 meta description；vault 標為物理上講不通、優先刪）"],"bw":["A017"]},"A017":{"n":"雨刷精","ns":"泡泡怪獸 雨刷精體驗裝 汽車玻璃水 油膜去除劑 中性玻璃清潔劑 去蟲斑護雨刷","cat":"glass","p":"499","pn":"","u":"https://shopee.tw/product/1072078949/49509007614?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/tw-11134207-820lh-mn58x3amty4m85","pain":"雨刷越刮越花？","sp":["去油膜｜中性玻璃清潔","去蟲斑、護雨刷","一台車的用量約 20ml"],"use":"一台車用量約 20ml，倒進雨刷水箱再加水補滿；做過玻璃鍍晶的車不要加。","al":["雨刷越刮越花","a017","雨刷精","雨刷水","玻璃水","雨刮精","雨刮水"],"vl":"glass","yt":"https://www.youtube.com/playlist?list=PLHLLpJl_ai80","dns":["整罐倒入（官網 09-29 更正：一台車約 20ml）","稀釋比例（DM 印的比例也不講）","做過玻璃鍍晶、玻璃鍍膜的車也能加"],"bw":["A035"]},"A042":{"n":"強力皮革清潔劑（慕斯款）","ns":"泡泡怪獸 強力皮革清潔劑 - 三重升級去污不傷害 購買500ml大瓶 赠專用進口慕斯瓶可重複使用","cat":"leather","p":"1,099","pn":"","u":"https://shopee.tw/product/1072078949/28589476705?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-82595-mtjn1zwivzlxb3","pain":"真皮座椅髒到發黑？","sp":["三重升級去污不傷害","500ml 大瓶贈專用進口慕斯瓶","慕斯瓶可重複使用"],"use":"泡沫打在毛巾上再順紋理擦，不要直接噴在皮面上，也不用沖水。","al":["強力皮革清潔劑（慕斯款）","真皮座椅清潔","皮革座椅清潔","皮革清潔","皮革清洁","真皮清潔","皮椅清潔","皮革慕斯","a042","真皮座椅","皮椅髒","座椅髒","慕斯"],"vl":"leather","yt":"https://www.youtube.com/playlist?list=PLBt5iCYZdcxM","dns":["苯胺皮、半苯胺皮、麂皮、翻毛皮也能用","塑膠件也能擦（橡膠可以，塑膠不行）","直接噴在皮面上","重油污也能處理（官網定位中輕度污垢）"],"bw":["A013"]},"A013":{"n":"頂奢皮具護理乳","ns":"POP MONSTER 頂奢皮具護理乳｜精品包款專用級 車居兩用真皮養護 超越頂奢護理標準 效果更勝進口精品","cat":"leather","p":"2,399","pn":"","u":"https://shopee.tw/product/1072078949/41555392929?openExternalBrowser=1","img":"https://down-tw.img.susercontent.com/file/sg-11134201-825an-mtjsvi5kk6x662","pain":"真皮座椅乾裂、變硬？","sp":["深層滋潤防乾裂","精品包款專用級｜車居兩用","超越頂奢護理標準"],"use":"真皮座椅乾裂、變硬時拿來深層滋潤，車上和家裡的真皮都能用。","al":["頂奢皮具護理乳","真皮座椅乾裂","真皮座椅保養","皮革保養","皮革保养","皮革護理","皮具護理","真皮保養","a013","皮椅乾裂","皮革乾裂","座椅乾裂","真皮乾裂","真皮變硬","座椅保養","皮椅保養","護理乳","皮革乳","頂奢"],"vl":"leather","yt":"https://www.youtube.com/playlist?list=PLBt5iCYZdcxM","dns":["官網 A013 頁的用法與稀釋比例（那頁寫的是真皮清潔劑，不是這支護理乳）","蝦皮可以直接下單（目前下架）"],"bw":["A042"]}};
const VIDEOS = {"lines":{"angel":[{"id":"079","mp4":"https://milk790-code.github.io/3q-hatchery-line-oa/assets/pop/video/079.mp4","jpg":"https://milk790-code.github.io/3q-hatchery-line-oa/assets/pop/video/079.jpg","cap":"洗完車亮不了幾天，水一碰又一片水痕，很累對吧？\n看這支：引擎蓋一沖水，整片水膜直接滑掉，這就是撥水做出來的樣子。\n用法：洗完車趁車身還濕直接噴天使塗層，用洗車手套輕帶一遍再沖水收乾，單層不堆疊。\n每次洗完補一次，大約撐一個月。","dur":24},{"id":"069","mp4":"https://milk790-code.github.io/3q-hatchery-line-oa/assets/pop/video/069.mp4","jpg":"https://milk790-code.github.io/3q-hatchery-line-oa/assets/pop/video/069.jpg","cap":"車門一沖水，水膜整片往下退，退完倒影清清楚楚。\n前 10 秒只是水在流，撐到第 10 秒你就懂為什麼叫天使塗層。\n用法一樣：洗完趁濕噴、手套輕帶一遍、沖水收乾。","dur":17}],"polish":[{"id":"P08","mp4":"https://milk790-code.github.io/3q-hatchery-line-oa/assets/pop/video/P08.mp4","jpg":"https://milk790-code.github.io/3q-hatchery-line-oa/assets/pop/video/P08.jpg","cap":"拋完亮了，燈一照那道刮痕還在，心裡很悶對吧？\n這不是你技術差，太深的直線刮痕吃進清漆，一道研磨本來就帶不完。\n硬追只會把漆切薄。深的先用參號重切一次，再伍號、拾號收，拋淡就好，不硬追。\n看這支整段沒剪，怎麼判斷該停在哪。","dur":52},{"id":"P10","mp4":"https://milk790-code.github.io/3q-hatchery-line-oa/assets/pop/video/P10.mp4","jpg":"https://milk790-code.github.io/3q-hatchery-line-oa/assets/pop/video/P10.jpg","cap":"白天看還好，檢查燈一照整片細刮痕，交車前最怕這一下。\n細刮痕只在清漆最上層，不用重烤。\n用法：先打燈看一次決定切多重；中度太陽紋伍號一劑拋就夠，要更亮接拾號。\n整段沒剪，看燈下前後差多少。","dur":62},{"id":"P09","mp4":"https://milk790-code.github.io/3q-hatchery-line-oa/assets/pop/video/P09.mp4","jpg":"https://milk790-code.github.io/3q-hatchery-line-oa/assets/pop/video/P09.jpg","cap":"整片推、推到乾，研磨劑還沒作用就乾掉，拋半天不亮，是不是很洩氣？\n問題不在你手，是劑乾了就沒在切。\n用法：一區一區走，每塊切到位再換下一塊；中度太陽紋米速伍號一劑拋就夠，要更亮再接拾號。\n這支整段沒剪，看一區走完擦開的差別。","dur":90}]},"yt":{"wash":"https://www.youtube.com/playlist?list=PLSk3kbuy0rz4","wheel":"https://www.youtube.com/playlist?list=PLSuJIu3-yk_c","tire":"https://www.youtube.com/playlist?list=PLSuJIu3-yk_c","decon":"https://www.youtube.com/playlist?list=PLSuJIu3-yk_c","glass":"https://www.youtube.com/playlist?list=PLHLLpJl_ai80","leather":"https://www.youtube.com/playlist?list=PLBt5iCYZdcxM","angel":"https://www.youtube.com/playlist?list=PLCCgTJRYB-AY","polish":"https://www.youtube.com/playlist?list=PLDQDIDeUJ8K0","shop_owner":"https://www.youtube.com/playlist?list=PLeMRtoyeEuHY","live":"https://www.youtube.com/playlist?list=PLJHFpZQ5ayA4","all":"https://www.youtube.com/playlist?list=PLBt5iCYZdcxM"}};
const WELCOME_PACK = [{"type":"image","originalContentUrl":"https://milk790-code.github.io/3q-hatchery-line-oa/assets/pop/pricelist-1028.jpg","previewImageUrl":"https://milk790-code.github.io/3q-hatchery-line-oa/assets/pop/pricelist-1028-preview.jpg"},{"type":"text","text":"這裡是泡泡怪獸。\n我是超級 AI 人工客服😊 老闆~您不要把我們當作一般一板一眼的殭屍客服🤖 您儘量把您的需求直接和我們說,我們這邊會直接幫您介紹完畢,到最後之後請真人過來👍\n\n價格表在上面，看到想問的直接打字或拍照。\n不知道用哪一支？漆面或玻璃拍一張傳上來，我幫你配。\n決定好了，我直接給你那一支的蝦皮連結。\n要找真人，點下面「找真人」，真人 09:00–18:00 回覆。\n\n開店的老闆：店裡拋不亮的漆，不是難，是還沒用過泡泡怪獸。\n下面選單右上角切到「店家老闆」，店家價和方案都在那頁。","quickReply":{"items":[{"type":"action","action":{"type":"postback","label":"我是車主","data":"m=wel&b=car","displayText":"我是車主"}},{"type":"action","action":{"type":"postback","label":"我是店家","data":"m=wel&b=shop","displayText":"我是汽車美容店家"}},{"type":"action","action":{"type":"camera","label":"拍照問用哪支"}},{"type":"action","action":{"type":"postback","label":"看拋光影片","data":"m=vid&l=polish","displayText":"我想看拋光影片"}},{"type":"action","action":{"type":"postback","label":"看天使塗層影片","data":"m=vid&l=angel","displayText":"我想看天使塗層影片"}},{"type":"action","action":{"type":"postback","label":"找真人","data":"m=car&b=human","displayText":"我想找真人"}},{"type":"action","action":{"type":"cameraRoll","label":"從相簿傳照片"}}]}}];
const DIRECTIVES = {"turn":{"first_intro":"【本輪指令】這是這位客人在這段對話的第一句。系統會自動在你的回覆前面加上 AI 店員身分說明，你不要再自我介紹，也不要重貼價格表或任何連結。他是打招呼、貼圖或「在嗎」：一句話接住，再問一個分流問題「是自己的車要用，還是店裡施工要用？」。他已經是具體問題：直接回答，照二·七掛產品卡，不必先分流。[STK] 可以申請「歡迎」；但指令最後若寫「價格表已在加好友時送給他了」，代表歡迎包已經送過，[STK] 填「無」。","first_intro_car":"【本輪指令】他在歡迎訊息按了「我是車主」。一句話接住，只問一件事：他的車現在最困擾的是哪一個：漆面（太陽紋、刮痕、洗完亮不了幾天）、水痕、輪框、玻璃油膜，還是內裝皮革。用車主聽得懂的詞，不講番數和轉速。這輪還不要打產品卡。","shop_line":"【本輪指令】他在歡迎訊息按了「我是汽車美容店家」。改用店家行話，主句可以用「店裡拋不亮的漆，不是難，是還沒用過泡泡怪獸」。只問一件事：店裡現在最卡的是哪一段：重切太久、跳盤換盤多、返工，還是洗車線太慢。不報任何大量進貨價，不提試用和優惠；他問進貨價，就收三樣（品項、每月大概用量、怎麼聯絡）交真人。","car_pick":"【本輪指令】他按了「我的車該用什麼」。一句話接住，只問一件事：車現在最困擾的是哪一個（漆面沒光或太陽紋、刮痕、水痕、鐵粉、輪框、玻璃、內裝）。問完下一輪再依症狀推具體品項並打產品卡，不要一次丟一堆問題。","product_question":"【產品詢問】客人問到：{skus}。回法固定四件事，自然串成一段、合計不超過 4 句（11-03 他指定：有情緒價值、不失專業、講怎麼用、講痛點）：①先接住痛點：用【產品事實】的痛點句講出他現在的困擾，讓他覺得被懂；②一句專業原因：為什麼會這樣、這支為什麼有用，只講事實寫的，不編原理；③用法一兩句：照【產品事實】的句子講，用法沒寫就說「這個我請真人確認」；④一句情緒價值：站在他那邊而不是誇產品（像「這不是你技術差」「別急，這救得回來」「你已經做對一半了」），不油、不喊口號、不用驚嘆號堆。「不准說」的字一個都不講。然後打 [PROD]（最多 2 支）。價格只講名稱後面括號裡的價格表數字；沒有括號價格的品項不報價，說「這支我請真人幫你確認」。卡片上已經有價格和賣點，文字不要再抄一遍。主題是拋光或鍍膜，或他問效果、怎麼用，同一輪打 [VID]。若本輪同時有【售後】指令，以售後為準，不打卡、不打影片。用法照【產品事實】的句子講，一兩句就好，不條列、不編步驟、不加「靜置幾分鐘」這種事實沒寫的數字；前面對話裡講過的用法如果跟事實不同，以【產品事實】為準，不要重複舊說法；不唸編號（A045 這種）。\n【產品事實】\n{facts}","pay_intent":"【成交訊號】他在問價格或怎麼買。這輪一定要打 [PROD]：他指定了哪一支就打那一支；還沒指定，就用前面聊到的需求推一支，完全沒線索才問一句「你想先處理哪一個問題？」。例外：名稱後面沒有括號價格的品項，或症狀→推薦寫著不打產品卡的品項，不報價、不打卡，說「這支我請真人幫你確認」。文字只講三件事：價格表的價、一句為什麼適合他、「卡片上按『蝦皮購買』就到商品頁」；可以補一句收到後第一步怎麼用。不自己打網址、不導官網購買、不再追問、不給折扣；庫存和到貨時間不承諾。店家問的是大量進貨價：不報數字，收三樣（品項、每月大概用量、怎麼聯絡）交真人。若本輪同時有【售後】指令，以售後為準，不打卡。","aftersale":"【售後】本輪以這條為準，其他指令要你打 [PROD]、[VID] 或推產品的要求全部作廢。他在講訂單、收貨或使用上的問題。這輪不打 [PROD]、不打 [VID]，[STK] 填「無」，不用笑臉。先接住情緒，不先解釋；請他傳蝦皮訂單編號和狀況照片，說明交給真人夥伴處理。講到退換貨只用固定話術，不自己承諾任何條件。","ordered":"【成交後】他說下單了。一句謝謝，一句收到貨第一步怎麼用（只講彈藥庫寫的用法），一句「用完拍照給我看」。不再推別的產品、不打 [PROD]。[STK] 可以申請「開心」。這是他對這次購買的最後印象，寫得具體、短。","result_share":"【分享成果】他傳了成果或說有效。先具體說出你看到的變化（只講照片看得到的），再問一個下一步：要不要順便處理另一個地方，或之後怎麼維護。[STK] 可以申請「鼓勵」。不要求他寫評價或分享。","returning":"【回訪】他隔了一段時間才回來。不提他沒回、不道歉、不怪他；直接接回上次聊到的重點（看對話紀錄），再問一個他自己能判斷的問題。沒有上次的紀錄，就當新招呼。","hesitation_close":"【收尾】他在猶豫或準備離開。這則當成這次對話的最後一則寫：只給一支、一個價、一張卡（[PROD]），加一句「先放著也可以，要的時候回這則就好」。不追問、不催、不編限時。","price_mismatch":"【價格對不上】他說蝦皮或別處看到的價格跟價格表不同。不爭辯：價格表是全世界統一零售價；蝦皮同一支有不同容量、入數，結帳金額以蝦皮頁面為準。請他截圖看到的那個規格，說明請真人對；不自己猜哪個對，也不因此給折扣。","price_list":"【要價格表再問一次】他今天已經收過價格表圖了，這輪系統不會再傳圖。請他往上滑找那張圖，不要說「我再傳一次」。再問他想先看哪一類（洗車、拋光、玻璃、內裝）或哪一支，直接報那一類的價格表數字（彈藥庫括號裡的）；不貼網址。","wholesale":"【本輪指令】店家問耗材大量進貨的價格。不報任何進貨價數字（大量進貨跟零售分開算，由真人報）。用一句話說明單支跟零售同價、大量進貨另外算，然後一次要三樣：想進哪幾支、一個月大概用多少量、方便聯絡的電話或 LINE；說明真人上班時間（09:00 到 18:00）看到會回你報價，不給回覆時數。不提試用和優惠。"},"obj":[{"rx":"((連結|網址|賣場|按鈕|卡片|蝦皮|商品頁).{0,8}(打不開|點不進|點不開|開不了|無法開啟|跳不出來|失效|沒反應|找不到|404)|(打不開|點不進|點不開|找不到|開不了).{0,6}(連結|網址|賣場|商品頁|蝦皮))","name":"連結打不開","script":"先說「不好意思讓你卡在這」。給整個賣場 https://shopee.tw/milk790?openExternalBrowser=1 ，再補一句「也可以在蝦皮搜尋『泡泡怪獸』」。請他截一張打不開的畫面傳來，說明請真人看是卡在哪一步；這輪不打 [PROD]、不重發卡片、不推別的產品。"},{"rx":"(蝦皮.{0,12}(不一樣|不同|比較貴|比較便宜|便宜|貴)|價格.{0,6}(不一樣|不同|對不上)|價錢.{0,6}(不一樣|不同|對不上)|怎麼不一樣|標錯|價差|跟價格表不|跟[Dd][Mm]不|跟型錄不)","name":"價格對不上","script":"不爭辯。價格表是全世界統一零售價；蝦皮同一支有不同容量、入數，結帳金額以蝦皮頁面為準。請他截圖看到的那個規格，說明請真人對；不自己猜哪個對，也不因此給折扣。"},{"rx":"(折扣|打折|打個折|算便宜|便宜一點|便宜點|便宜些|少算|殺價|讓價|折價|特價|優惠|有沒有活動|贈品|送什麼|加送|優惠券|算整數|抹零|最低價|再低一點|可以再少)","name":"要折扣","script":"價格表是全世界統一零售價，單支誰買都同價，所以不另外折，先買的人也不吃虧。真的想省，就照傷的深淺選，用不到的那支不買；要整組的話，三件組 4,099 本來就比單買合計 4,597 少。店裡大量進貨跟零售分開算，收品項、每月用量、聯絡方式交真人。不在 LINE 議價、不先讓步換一句好；不提試用，也不自己加贈品。"},{"rx":"(太貴|好貴|很貴|超貴|蠻貴|滿貴|有點貴|貴了|偏貴|不便宜|那麼貴|這麼貴|貴嗎|貴[\\u5594\\u6b38\\u8036\\u5566\\u9f41\\u554a\\u5440]|貴[\\s?？!！。.～~]*$|價格.{0,4}高|預算.{0,4}(不夠|有限)|下不了手|捨不得|買不起)","name":"嫌貴","script":"分輪做，一則只走一步，不要一次塞完。第一則：先問「是跟哪一支比？」（還不知道他要什麼，報多少都貴）。車主：換成他的用法講，例如天使塗層洗完直接噴、不用擦；不嚇他，到這裡就停。店家（研磨劑）第二則：先講研磨看傷是真的切掉，還是像化妝一樣蓋住，米速拋光劑是水性、不遮蓋；再講一台車佔一個車位，假設一台能省下一小時，價差就回來了，明講是假設、不是實測；時間才是汽美最貴的成本。接著問他一台漆面做多久、一天接幾台，他給了數字就用他的數字算，沒給就不算。車況允許時，伍號可以一劑一盤一步到鏡面，少換一道盤。第三則才提議：伍號配羊毛盤，跟他手上那款在同一台車各做半邊、計時、清乾淨後在強光下看。"},{"rx":"(傷漆|傷車|燒漆|拋穿|磨穿|吃漆|咬漆|腐蝕|會不會傷|傷到|傷害|安全嗎|會壞|漆很薄|薄漆|會不會花|留紋|會不會刮)","name":"怕傷漆","script":"先承認有風險，再給邊界：正常操作下不易燒漆；金油磨穿，就只能烤漆，所以沒把握的漆先從最細的番數試，新手從 DA 開始；每拋一塊就用手背碰一下漆面，燙就停。藥劑只講價格表寫的：鐵粉去除劑中性、不傷車漆輪框，柏油去除劑不咬塑膠，水垢水漬去除劑不傷塑膠、不傷漆，火山泥不用在包膜、犀牛皮上。其他材質沒把握就說「我請真人確認」。"},{"rx":"(別家|別牌|其他牌|其他品牌|別人家|外面.{0,4}(買|賣)的|大賣場|量販|3M|美光|龜牌|[Ss][Oo][Nn][Aa][Xx]|[Kk][Oo][Cc][Hh]|[Mm][Ee][Nn][Zz][Ee][Rr][Nn][Aa]|[Mm]eguiar|打蠟就好|蠟就好)","name":"比較別牌","script":"不說別家不好。研磨看傷是切掉還是蓋住：米速拋光劑都是水性、不遮蓋，拋完在強光下看到的就是漆面真實狀態；拿他手上那支跟米速同一台車各做半邊，強光下看。塗層：會撥水不等於好塗層，沙拉油塗上去也會出水珠，他自己測就知道。"},{"rx":"(真的有用|有用嗎|有效嗎|真的有效|騙人|騙錢|被騙|唬爛|唬人|誇張|吹的|假的|業配|真的假的|有沒有效|有沒有用(嗎|\\u554a|\\?|？|$)|效果如何|效果怎樣|效果好嗎|實際效果)","name":"質疑效果","script":"不空口保證，也不說「跟影片一樣」。給一條施工影片（打 [VID]），再給一個他自己能驗的方法：拋光是強光下看紋路少了沒；玻璃油膜是微濕毛巾擦過不留印記；塗層是洗完看水退的樣子。蝦皮評價是公開的，請他自己看。"},{"rx":"(哪一支|哪一個|哪支|選哪|買哪|推薦哪|該用哪|要用哪|用哪個|不知道買|不知道要買|適合我|差在哪|差別|哪裡不一樣|有什麼不同|哪個好|哪支好)","name":"不知道選哪個","script":"先判斷再推薦，一次一題：拋光問「指甲刮過去會不會卡？」；洗車問「你最常遇到的是髒、水痕，還是洗完不亮？」。傷多深決定用幾支，能用細番數解決的就不用粗番數。判斷完只推一組，打 [PROD]。"},{"rx":"(不會用|不會弄|不太會|新手|第一次(用|拋|洗|上|做|弄|噴|自己)|沒用過|沒拋過|沒碰過|太難|好難|很難|會不會很難|很麻煩|好麻煩|太麻煩|複雜|看不懂|教我)","name":"自己不會用","script":"不用會，照順序就好。給一條影片（打 [VID]）＋一句順序：洗車是預洗、正洗、上塗層；拋光是先判斷傷多深再選組，新手從 DA 和 1000 番開始練手感，不跳番數。卡住就拍照傳來，看不準的我請真人確認。"},{"rx":"(我(先|再|回去)?(問|跟)(一下|問)?(我們|我家|我)?(老闆|老婆|老公|太太|先生|家人|主管|店長|師傅)|(老闆|老婆|老公|太太|家人|主管|店長)(決定|同意|點頭|要看)|商量|討論一下|回去問|再問問|給老闆看)","name":"先問老闆或家人","script":"讓他去問，還幫他準備好轉述：「我整理三行給你轉：要解決的事、建議哪一支多少錢、蝦皮怎麼買。」問他要不要現在整理。不催、不說「現在不買會漲」。"},{"rx":"(在嗎|還在嗎|有人在嗎|抱歉晚回|不好意思晚回|晚回了|剛剛在忙|現在才看到|剛看到|上次問|之前問|前幾天問|上次說|上次你說|之前你說)","name":"已讀不回回來","script":"不提他沒回、不道歉、不怪他。看對話紀錄，直接接回上次的重點（車型、在意的點、推過哪一支），再問一個他自己能判斷的問題；沒有上次的紀錄，就當新招呼，一句接住＋分流問題。"},{"rx":"(考慮|再看看|想一下|想想|再說(?![明一清])|改天|不急|晚點(再|回)|先這樣|先不用|先不要|再研究|研究一下)","name":"再考慮","script":"「不急，想清楚再買才對。」直接問顧慮：「你卡在哪一個：價格、會不會用，還是不確定適不適合你的車？」他說了就對症處理；不說就收尾：只給一支、一個價、一張卡，加一句「先放著也可以，要的時候回這則就好」。"}],"stk":{"every_n":3,"daily_cap":2,"blocked_emotions":["抱怨","售後","質疑效果","砍價","比價","趕時間"],"allowed_moments":["歡迎","成交","客人道謝","客人分享成果"],"slot_map":{"歡迎":"歡迎","成交":"開心","客人道謝":"感謝","客人分享成果":"鼓勵"},"moment_rx":{"成交":"^(?![\\s\\S]*(嗎|嘛|[?？]|怎麼|如何|能不能|可不可以|是不是|有沒有|要不要|會不會))[\\s\\S]*((^|[^要想將備打算快還沒未不])(下單了|下好了|下訂了|付款了|付好了|結帳了|拍下了|買了|訂了)|已下單|已經下單|已付款|已購買)","客人道謝":"^(?![\\s\\S]*(不用謝|不必謝|不需謝|免謝|不謝|謝絕))[\\s\\S]*(謝|感恩|3[Qq]|[Tt]hx|[Tt]hank)","客人分享成果":"^(?![\\s\\S]*(嗎|嘛|不亮|沒亮|沒變|沒有|怎麼|如何|要不要|會不會|能不能|可不可以|有沒有|是不是|為什麼|為何|[?？]|不好用|沒效|無效|沒用|不乾淨|沒洗掉|沒擦掉|沒除掉|不夠亮|還是有))[\\s\\S]*(好亮|超亮|很亮|變亮了|變好亮|變很亮|亮了|乾淨了|洗掉了|擦掉了|除掉了|有效果了|很有效|超有效|效果很好|效果超好|效果不錯|好用|太讚|超讚|很讚|好讚|真的讚|好厲害|真厲害|很厲害)|^\\s*(讚|太讚了|超讚)[!！。~～\\s]*$"},"note":"worker v6.1 已整包讀 sticker_policy：every_n、daily_cap、blocked_emotions 管限流；allowed_moments、slot_map、moment_rx 讓程式在命中時刻時疊對應指令（成交→ordered、客人分享成果→result_share）並直接指定貼圖槽位，gen 腳本會逐條編譯 moment_rx。所以這三條一律要求肯定語氣、排除疑問與否定，客人在質疑或抱怨時不會被當成分享成果；改正規式前先跑反例測試。"},"rec":[{"rx":"((雨刷|雨刮).{0,8}(叫|吱|響|跳|抖)|吱吱叫|(天使|塗層).{0,10}(前擋|擋風玻璃|玻璃)|(前擋|擋風玻璃|玻璃).{0,10}(天使|塗層))","skus":["A035","A001"],"say":"先用 A035 無鈰玻璃油膜去除膏把油膜除乾淨，再噴 A001 天使塗層（前擋也能上），可以緩解雨刷異響；前擋沒先除油膜就噴，會發霧。"},{"rx":"(雨刷.{0,6}(花|霧|糊|刮不乾淨|不乾淨)|越刮越花|雨刷精|雨刷水|雨刮精|雨刮水|玻璃水)","skus":["A017","A035"],"say":"A017 雨刷精：去油膜、去蟲斑、護雨刷，一台車約 20ml，倒進雨刷水箱再加水補滿；做過玻璃鍍膜、鍍晶的車不要加。油膜已經很厚，先用 A035 除一次。"},{"rx":"(玻璃鍍膜|玻璃鍍晶|玻璃.{0,6}(水珠|撥水|潑水))","skus":["A035","A001"],"say":"價格表上的做法是先用 A035 無鈰玻璃油膜去除膏除油膜，再噴 A001 天使塗層（前擋也能上）。他問的是專用玻璃鍍膜、鍍晶，說「我請真人確認」，不自己報其他品項。"},{"rx":"(油膜|前擋|擋風玻璃|眩光|會車.{0,4}刺眼|(下雨|夜間|晚上|開夜車).{0,6}看不清|白茫茫|玻璃.{0,4}(霧|花|髒))","skus":["A035","A017"],"say":"A035 無鈰玻璃油膜去除膏：汽車玻璃專用，手擦、機拋都能用。先清掉鐵粉和砂粒，玻璃保持濕潤畫圈，約 2 分鐘後沖淨；驗收是微濕毛巾擦過不留印記。日常再用 A017 雨刷精顧著。原理和成分不講。"},{"rx":"(真皮|皮椅|皮革|皮座椅|皮件).{0,8}(乾|裂|硬|保養|滋潤|護理)","skus":[],"say":"真皮乾裂、變硬要的是護理：A013 頂奢皮具護理乳，深層滋潤防乾裂，車上和家裡的真皮都能用。這支蝦皮頁面目前沒上架，不打產品卡、不報價，說「我請真人確認怎麼買」。髒的話先用 A042 強力皮革清潔劑清乾淨，再護理。"},{"rx":"(真皮|皮椅|皮革|皮座椅).{0,8}(髒|黑|污|清潔|洗)","skus":["A042"],"say":"A042 強力皮革清潔劑（慕斯款）：泡沫打在毛巾上再順紋理擦，不要直接噴在皮面上，也不用沖水。麂皮、翻毛皮、苯胺皮說「我請真人確認」。"},{"rx":"(內裝|內飾|座椅|椅子|門板|中控|車頂|地毯|絨布|車內.{0,4}(髒|味)|異味|臭味|菸味)","skus":["IC002","A031"],"say":"IC002 大力神萬用清潔劑：超濃縮，1 瓶抵 20 罐，橙油去污、不刺鼻、順便去味，座椅、門板、中控、車頂、地毯都能用；稀釋多少照瓶身標示，真皮、淺色座椅、麂皮先在不顯眼處試。只想噴了就擦、免沖洗，用 A031 萬用神噴。"},{"rx":"(萬用|多功能清潔|清潔劑.{0,4}(太多|一大堆)|一堆清潔劑|一瓶解決)","skus":["A031","IC002"],"say":"A031 萬用神噴：中性 0 殘留、免沖洗，噴上再用軟毛巾擦，織物、皮革、塑件、內裝飾條都能用；鍍鉻件、改色膜、車漆鍍膜層不要直接用。用量大、想省的用 IC002 大力神（超濃縮，1 瓶抵 20 罐）。"},{"rx":"(天使|塗層|鍍膜劑|維護劑|亮不了|撥水|潑水|疏水|水珠|疊層|疊幾層|鍍膜.{0,6}(撐|維持|多久|幾個月|耐久))","skus":["A001"],"say":"天使塗層標準回法：單層不堆疊，噴一次和噴三次結果一樣；每次洗完車直接噴，不用去除舊的那層，不用擦也不用除蠟，一次約撐一個月、三到四次洗車；要一直有防護，就是每次洗完都噴，把它當洗完車的保養品。不講兩個月，不講稀釋和換算倍數。"},{"rx":"(鍍膜車|有鍍膜|鍍過膜|鍍晶車|黑曼羅|弱酸)","skus":["A046","EC007"],"say":"鍍膜車日常正洗：A046 黑曼羅弱酸洗車泡沫，鍍膜車專用，去垢脫脂、除水垢殘蠟（鋁圈、鍍鉻件、裸金屬不要用）；想洗完多一層鍍膜，用 EC007 海洋之星鍍膜洗車液。A044 超級泡沫也適用鍍膜車。"},{"rx":"(沒空.{0,4}鍍膜|懶得鍍膜|懶人|二合一|洗完.{0,4}(鍍膜|上光)|鍍膜洗車|上光洗車|海洋之星|柑橘)","skus":["EC007","EC006"],"say":"想洗車順便顧：EC007 海洋之星鍍膜洗車液，清潔鍍膜二合一，洗完多一層鍍膜、潑水防護；只想洗完更亮，用 EC006 柑橘上光洗車液，清潔上光二合一。能撐多久沒有數字，不講。"},{"rx":"(第一次.{0,4}洗車|自己洗車|DIY.{0,4}洗|洗車.{0,4}(步驟|順序|怎麼洗|流程|要買什麼))","skus":["A044","A001"],"say":"第一次自己洗車照這個順序：A032 丹若免刷預洗、A044 超級泡沫正洗、A001 天使塗層收尾，三瓶接著用。卡片先給正洗和收尾兩支，他要預洗再給 A032。"},{"rx":"(預洗|免刷|丹若|手痠|刷車|刷到|陽極|改裝車|不想刷)","skus":["A032"],"say":"A032 丹若免刷預洗洗車液：兌水噴滿全車，軟化髒污再沖掉；陽極電鍍專用，改裝車也能用，高濃縮抵 50 公升洗車精。稀釋倍數不講。"},{"rx":"(洗車.{0,8}(細紋|刮|傷)|洗出.{0,4}紋|洗車精|洗車液|泡沫|正洗)","skus":["A044"],"say":"A044 超級泡沫洗車精：潤滑、泡沫懸掛性強，12 分鐘長掛泡，鍍膜車也適用，高濃縮抵 50 公升洗車精。泡沫打滿全車靜置約 5 分鐘，再用洗車手套正洗、沖乾淨；不要用霧化方式噴。"},{"rx":"(白車|白色車|洗不白|白痕)","skus":["A009"],"say":"A009 三合一液體橡皮擦：清潔美白去污、即擦亮白，去殘蠟、去水垢水痕；不用稀釋，取適量直接擦，手擦或 DA 配軟海綿盤都行。無研磨劑，它處理痕漬，不處理刮痕。"},{"rx":"(不想拋|不用機器|沒有機器|沒機器|手工拋|手擦|免拋)","skus":["A009"],"say":"不想上機器又想處理白痕、污垢、水痕，用 A009 三合一液體橡皮擦（手工拋光替代）；刮痕、太陽紋要靠研磨，這支處理不了。"},{"rx":"(柏油|瀝青|黑點|樹膠|樹液)","skus":["A043"],"say":"A043 汽車柏油去除劑：帶水直接噴，3 秒溶柏油，樹膠一起溶，軟布一擦就掉；不咬塑膠、不傷車漆。蝦皮規格註明不附噴頭。"},{"rx":"(殘膠|撕膜|除膠|貼紙|雙面膠|膠痕|背膠)","skus":["A038"],"say":"A038 包膜店專用除膠劑：頑固殘膠快速溶解，不傷膜材、不傷手，撕膜、貼紙、雙面膠都行；噴上靜置 3～5 分鐘再擦。沒把握的材質先小範圍試。"},{"rx":"(水痕|水垢|水漬|水斑|一曬就花|曬乾.{0,4}(花|痕)|雨痕)","skus":["A030","A046"],"say":"A030 水垢水漬去除劑：車窗水痕、車身水漬都能處理，不傷塑膠、不傷漆；塗上靜置 1～2 分鐘再擦、再沖水，不要讓藥劑乾在漆面上。鍍膜車日常正洗想順便除水垢、殘蠟，用 A046 黑曼羅弱酸洗車泡沫。"},{"rx":"((輪框|輪圈|鋼圈).{0,10}(鏽|黃褐|黃點|橘點|鐵粉)|(鏽|黃褐|鐵粉).{0,10}(輪框|輪圈|鋼圈))","skus":["A007","A045"],"say":"輪框黃褐鏽點多半是鐵粉：A007 中性鐵粉去除劑噴上靜置 3 分鐘，鐵粉當場現形，再用高壓水沖淨，不用刷，不傷車漆輪框。重油污、煞車粉塵再用 A045 木瓜怪獸雙清，一噴一沖。"},{"rx":"(輪框|輪圈|鋼圈|煞車粉|重油污|油污|引擎室|蟲膠|蟲屍|行走機構)","skus":["A045","A007"],"say":"A045 木瓜怪獸雙清輪框清潔劑：輪框重油污、煞車粉塵、引擎室、蟲膠都能用，一噴一沖、95% 免刷洗。煞車盤燙的時候先等它冷，引擎室用低水壓沖。黃褐鏽點是鐵粉，加 A007。"},{"rx":"(鐵粉|漆面.{0,4}(粗|刺|沙沙|顆粒)|摸起來.{0,4}(粗|刺|澀)|鏽點|黃褐|黃點|橘點)","skus":["A007"],"say":"A007 中性鐵粉去除劑：噴上靜置 3 分鐘，鐵粉當場現形，沖淨不用刷；中性濃縮、不腐蝕、不傷車漆輪框。漆面摸起來還粗，再用 A037 火山去污泥配 A036 磨泥潤滑液，全程保持濕潤、禁止乾磨，包膜、犀牛皮不適用，掉到地上就丟。"},{"rx":"(輪胎|胎壁|胎皮|塑件|塑膠件|飾板|黑色塑膠)","skus":["A024"],"say":"A024 輪胎塑件精油：原液倒在海綿上，薄塗輪胎側壁和車外黑色塑件（只塗側壁，不塗胎面），靜置約 5 分鐘，擦掉多餘殘留；防龜裂、防 UV 老化，輪胎自然黑亮、不死亮。"},{"rx":"(鍍鉻|亮條|飾條|門把|中網|排氣管|水箱罩)","skus":[],"say":"A041 米速鍍鉻拋光劑（店家專用極粗研磨）：非遮蓋鍍鉻修復，鍍鉻飾條去氧化、還原光澤，隨貨附 1 吋細節盤。只用在硬鍍鉻件，不能用在車漆上；真空電鍍的塑膠件、霧面鍍鉻不適用，看不出是哪一種就說「我請真人確認」。這支先不打產品卡、文字不報價（內部規則，不要對客人解釋原因），他問價或怎麼買，就說「這支我請真人幫你確認」。"},{"rx":"(拋光前|研磨前|拋之前|磨之前|前處理|黏土|磁土|火山泥)","skus":["A007"],"say":"研磨之前先清掉鐵粉、顆粒與油脂：A007 中性鐵粉去除劑、A037 火山去污泥配 A036 磨泥潤滑液、A034 拋光前導脫脂劑。火山泥只用在漆面，包膜、犀牛皮不適用，掉到地上就丟；潤滑液全程保持濕潤，禁止乾磨。"},{"rx":"(脫脂|鍍膜前|上膜前|不服貼|蠟膜殘留)","skus":["A034"],"say":"A034 拋光前導脫脂劑：拋光前、上鍍膜前一噴一擦，去油膜、蠟膜殘留，提升鍍膜服貼亮度；要接著上鍍膜的話，脫脂完建議立刻施工，最晚不超過 30 分鐘。剛做好鍍膜或打蠟的車不要全車噴，會一起帶走；室內不要大面積用。"},{"rx":"(一劑拋|一步拋|工時|工位|接車|返工|重工|跳盤|換盤|一台.{0,6}(做多久|要多久|幾小時)|一天.{0,4}幾台)","skus":["A004","A039"],"say":"店家算的是車位時間：車況允許時，A004 伍號可以一劑一盤一步到鏡面，少換一道盤；RO 搭 A039 一步鏡面羊毛盤，GA／DA 搭 PG2。問他現在一台做多久、一天接幾台，用他的數字算；最後提同一台車各做半邊、計時、強光下看。"},{"rx":"(深刮|刮.{0,4}很深|很深.{0,4}刮|指甲.{0,6}卡|卡指甲|見底|露底)","skus":["A002","A003"],"say":"指甲刮過會卡就是深刮痕，用第三組：A003 參號 80 番重切，再接 A004 伍號、A005 拾號收尾，三支合起來就是 A002 三件組（4,099，單買合計 4,597）。已經見底、露出底漆或金屬，研磨救不了，要烤漆。"},{"rx":"(氧化|霧化|霧掉|褪色|退色|白化|漆.{0,4}發白|發白.{0,4}漆)","skus":["A002"],"say":"嚴重氧化先判斷再承諾：氧化還沒穿透整層漆，可以從參號重切進場，用第三組 A002 三件組（參號→伍號→拾號）；已經穿透、拋完也救不回來，是車漆本身的問題，要烤漆，研磨劑處理不了。看不準就請他拍照，交真人判斷。"},{"rx":"(太陽紋|螺旋紋|髮絲紋|洗車紋|蜘蛛紋|細紋|旋紋|光圈)","skus":["A005","A004"],"say":"先問指甲刮過會不會卡：輕度太陽紋用第一組 A005 拾號；中度太陽紋、輕度刮痕用第二組 A004 伍號＋A005 拾號，伍號可以單獨拋，要更亮再接拾號。沒紋路就不用磨。"},{"rx":"(刮痕|刮傷|擦傷|擦痕|刮到|刮花|被刮)","skus":["A004","A005"],"say":"先做指甲測試：刮過不卡是輕度刮痕，用第二組 A004 伍號＋A005 拾號；會卡就是深刮痕，要第三組 A002 三件組。"},{"rx":"(素黑|軟漆|(本田|[Hh]onda|HONDA|黑車|黑色車|鋼琴烤漆|深色車).{0,12}(紋|刮|霧|拋|磨)|(紋|刮|霧|拋|磨).{0,12}(本田|[Hh]onda|HONDA|黑車|黑色車|鋼琴烤漆|深色車))","skus":["A004","A005"],"say":"素黑、軟漆：A004 伍號（素黑專用）一劑拋，要更亮再接 A005 拾號收尾；盤用一步鏡面羊毛盤（RO 是 A039，GA／DA 是 PG2）。年份久、已經老化氧化的漆，先確認車況再推。不說哪一支是專門給哪個車廠用的。"},{"rx":"(第一次.{0,4}(拋|磨)|沒拋過|新手.{0,4}(拋|磨)|練手感)","skus":["A005"],"say":"新手從 DA 開始，先用 1000 番（A005 拾號）練手感，熟了再往 600、80 走；正式粗修照 80→600→1000，不跳番數。每拋一塊 A4 大小的區域就用手背碰一下漆面，燙就停。"},{"rx":"(重切|重度切削|切削力)","skus":["A003"],"say":"重切用 A003 參號 80 番，接著要用伍號、拾號收尾；盤看機台：RO 用 PR1，GA／DA 用 PG1。RO 專用的重切劑是 A040。先問他用哪一種機台。"},{"rx":"((^|[^A-Za-z])[Rr][Oo](?![A-Za-z]).{0,10}(盤|羊毛|海綿)|(盤|羊毛|海綿)(.{0,9}[^A-Za-z])?[Rr][Oo](?![A-Za-z]))","skus":["PR1","A039"],"say":"RO 訂製羊毛盤兩款（各 999）：PR1 極致重切（深層刮痕、重度氧化，搭參號）、A039 一步鏡面（輕中度瑕疵、一步拋，素黑軟漆專用）。RO 訂製海綿盤三款（各 899）：PR3 粗修主力、PR4 中棉（硬漆）、A033 極致鏡面。"},{"rx":"((^|[^A-Za-z])([Gg][Aa]|[Dd][Aa])(?![A-Za-z]).{0,10}(盤|羊毛|海綿)|(齒輪機|震拋|雙動).{0,10}(盤|羊毛|海綿)|(盤|羊毛|海綿)(.{0,9}[^A-Za-z])?([Gg][Aa]|[Dd][Aa])(?![A-Za-z]))","skus":["PG1","PG2"],"say":"GA／DA 訂製羊毛盤兩款（各 899）：PG1 極致重切（深層刮痕、重度氧化，搭參號）、PG2 極小二傷（輕中度瑕疵、一步拋，素黑軟漆專用）。GA／DA 訂製海綿盤三款（各 799）：PG3 粗棉、PG4 中棉（硬漆）、PG5 極致鏡面。這兩款羊毛盤 DM 印的是「RO／GA／DA 三機通用」，客人用 RO 問能不能用，就照這句答。"},{"rx":"((^|[^A-Za-z])[Rr][Oo](?![A-Za-z])\\s*(機|.{0,4}(重切|切削|拋光劑))|旋拋|直心機)","skus":["A040","PR1"],"say":"A040 米速 RO 商用重切拋光劑是 RO（旋拋／直心機）重切削專用，盤配 PR1 RO 極致重切羊毛盤。RO 力道最強也最容易燒漆，新手從 DA 開始。容量以蝦皮頁面為準。"},{"rx":"(拋光盤|羊毛盤|海綿盤|用什麼盤|盤要用哪|盤怎麼選)","skus":[],"say":"盤跟機台走：先問他用 RO、GA 還是 DA。起手式是羊毛盤搭參號、粗棉搭伍號、鏡面棉搭拾號；這是建議組合，可以依實際效果自己調整。RO 羊毛盤各 999、海綿盤各 899；GA／DA 羊毛盤各 899、海綿盤各 799。"},{"rx":"((拋光機|研磨機).{0,8}(買|推薦|哪|選|挑)|(買|選|推薦|挑).{0,6}(拋光機|研磨機|機台)|機台怎麼選|(^|[^A-Za-z])([Rr][Oo]|[Dd][Aa]|[Gg][Aa])(?![A-Za-z])\\s*還是)","skus":[],"say":"切削力 DA＜GA＜RO，燒漆風險同順序，新手從 DA 開始。拋光機本身不在價格表上，要買機器說「我請真人確認」。"},{"rx":"(新車|剛交車|新交車)","skus":["A001"],"say":"新車沒紋路就不用磨，洗完噴 A001 天使塗層做維護就好；陽光下看到細紋，再看第一組 A005 拾號。"},{"rx":"(沒光|不亮|不夠亮|暗暗的|亮度不夠|沒有光澤)","skus":["A005","A001"],"say":"先判斷：陽光下看到一圈一圈的細紋，是漆面問題，用第一組 A005 拾號拋回來；沒紋路就不用磨，洗完噴 A001 天使塗層做維護就好；只是想洗車時順便更亮，可以提 EC006 柑橘上光洗車液（清潔上光二合一）。"},{"rx":"(本田|[Hh]onda|HONDA|黑車|黑色車|鋼琴烤漆|深色車)","skus":[],"say":"只提到車色或車廠，還不知道他要處理什麼，不推研磨。先問一個他自己能判斷的問題：「陽光下看，有沒有一圈一圈的細紋？」有紋再走研磨的判斷；他其實已經講明要做別的（例如鍍膜、洗車），就照他要的接，不要硬拉去研磨。不說哪一支是專門給哪個車廠用的。"}],"vm":[{"rx":"(拋光|研磨|太陽紋|螺旋紋|髮絲紋|刮痕|刮傷|氧化|米速|參號|伍號|拾號|80 ?番|600 ?番|1000 ?番|番數|羊毛盤|海綿盤|拋光盤|一劑拋|燒漆|素黑|(^|[^A-Za-z])([Rr][Oo]|[Gg][Aa]|[Dd][Aa])(?![A-Za-z])\\s*機)","line":"polish"},{"rx":"(天使|塗層|鍍膜(?!車|洗車|前|晶)|撥水|潑水|疏水|水珠|亮不了|維護劑)","line":"angel"},{"rx":"^(?=[\\s\\S]*(效果|怎麼用|怎麼擦|怎麼噴|怎麼洗|用法|教學|影片|示範|真的有用|有用嗎|有效嗎|看看|實際))[\\s\\S]*(玻璃|油膜|前擋|雨刷|眩光)","line":"glass"},{"rx":"^(?=[\\s\\S]*(效果|怎麼用|怎麼擦|怎麼噴|怎麼洗|用法|教學|影片|示範|真的有用|有用嗎|有效嗎|看看|實際))[\\s\\S]*(輪框|輪圈|鋼圈|鋁圈|煞車粉)","line":"wheel"},{"rx":"^(?=[\\s\\S]*(效果|怎麼用|怎麼擦|怎麼噴|怎麼洗|用法|教學|影片|示範|真的有用|有用嗎|有效嗎|看看|實際))[\\s\\S]*(輪胎|胎壁|塑件)","line":"tire"},{"rx":"^(?=[\\s\\S]*(效果|怎麼用|怎麼擦|怎麼噴|怎麼洗|用法|教學|影片|示範|真的有用|有用嗎|有效嗎|看看|實際))[\\s\\S]*(鐵粉|柏油|殘膠|火山泥|黏土|磁土|水垢|水痕|脫脂)","line":"decon"},{"rx":"^(?=[\\s\\S]*(效果|怎麼用|怎麼擦|怎麼噴|怎麼洗|用法|教學|影片|示範|真的有用|有用嗎|有效嗎|看看|實際))[\\s\\S]*(洗車|預洗|免刷|泡沫|丹若|洗車精|洗車液)","line":"wash"},{"rx":"^(?=[\\s\\S]*(效果|怎麼用|怎麼擦|怎麼噴|怎麼洗|用法|教學|影片|示範|真的有用|有用嗎|有效嗎|看看|實際))[\\s\\S]*(真皮|皮椅|皮革|內裝|座椅)","line":"leather"},{"rx":"^(?=[\\s\\S]*(影片|示範|看看|教學))[\\s\\S]*(開店|店家|工位|接車|返工|客單|回頭客)","line":"shop_owner"}],"human_rx":"(^\\s*(客服|人工|真人|專人|人工客服|真人客服)\\s*[?？!！。.]*\\s*$|找真人|要真人|換真人|請真人|叫真人|轉真人|真人(來|回|接|處理|聊|客服)|轉人工|人工客服|找人工|要人工|找客服|轉客服|叫客服|客服人員|(找|要|請|轉|叫|換|有)專人|專人(聯絡|回覆|處理|服務)|打電話給我|打給我|電話聯絡|老闆本人|找老闆|叫老闆|負責人)","pay_rx":"^(?![\\s\\S]*(退貨|退款|換貨|退換|壞掉|壞了|瑕疵|沒收到|漏發|寄錯|少寄|少給|少一(瓶|罐|個|支|組)|破損|漏液|在漏|漏出來|噴不出|變質|沉澱|怪怪的|客訴|訂單|還沒出貨|沒出貨|出貨了沒|還沒到|到貨了沒|已下單|已經下單|已購買|已付款|已經付|付好了|拍下了|已經買|剛買|買好了|再試試|再試一次|我試過|試過了|試了|(^|[^要想將備以])(下單了|下訂了|付款了|結帳了|下好了)|太貴|好貴|很貴|超貴|蠻貴|滿貴|有點貴|貴了|偏貴|不便宜|那麼貴|這麼貴|貴嗎|貴[\\u5594\\u6b38\\u8036\\u5566\\u9f41啊呀]|貴[\\s?？!！。.～~]*$|價格.{0,4}高|預算.{0,4}(不夠|有限)|下不了手|捨不得|買不起|傷漆|傷車|燒漆|會不會傷|拋穿|磨穿|吃漆|咬漆|(連結|網址|賣場|按鈕|卡片|蝦皮|商品頁).{0,8}(打不開|點不進|點不開|開不了|無法開啟|跳不出來|失效|沒反應|找不到)|(打不開|點不進|點不開|找不到|開不了).{0,6}(連結|網址|賣場|商品頁|蝦皮)))[\\s\\S]*(多少錢|幾塊|幾元|價格(?!表|.{0,6}(不一樣|不同|對不上))|價錢(?!.{0,6}(不一樣|不同|對不上))|價位|售價|報價|怎麼賣|怎麼買|哪裡買|在哪買|去哪買|哪裡有賣|購買(?!了)|(怎麼|如何|要|想|可以|哪裡|去哪|在哪|準備|直接)(下單|下訂)|^\\s*下單\\s*[!！?？。.~～]*\\s*$|訂購(?!了)|怎麼訂|結帳(?!了)|給我連結|給我網址|連結|網址|賣場|蝦皮(?!.{0,12}(不一樣|不同|比較貴|比較便宜|便宜|貴))|要買|想買|我要(買|一|兩|這|那)|買(一|兩|二|三|幾)(瓶|罐|組|支|個|盒|套)|來一(瓶|罐|組|支|個)|帶一(瓶|罐|組|支|個)|(瓶|罐|組|支|個|盤|套)多少|號多少|有貨|現貨|還有貨|有庫存|想試|試試|試看看|(想|要|準備|可以|打算|考慮)入手)"};
// ═══ v6 DATA:END ═══
// v6.1 追加:蝦皮賣場網址一律帶 openExternalBrowser=1(LINE 內建瀏覽器開蝦皮常被導去 App 登入頁)。優先取 DATA 的 SHOP_URL,沒有就用預設賣場並自己補參數。
// v6:B2C 成交回到蝦皮(學誼 2026-10-30:「問產品時要丟對應產品的資訊和蝦皮連結」);變數名沿用不動
const SHOPEE = ((u) => /[?&]openExternalBrowser=/.test(u) ? u : u + (u.includes('?') ? '&' : '?') + 'openExternalBrowser=1')(
  (typeof SHOP_URL === 'string' && SHOP_URL) ? SHOP_URL : 'https://shopee.tw/milk790?openExternalBrowser=1');
const PAY_INTENT_RX = DIRECTIVES.pay_rx ? new RegExp(DIRECTIVES.pay_rx) : PAY_INTENT_RX_BASE;
// v6.1:「價格表」不算成交訊號(第一次直回圖、第二次走 price_list 指令),避免兩條路打架
function isPayIntent(t) { return PAY_INTENT_RX.test(t || '') && !PRICELIST_RX.test(t || ''); }
// v6.1:事件發生時間(ms)。LINE 的 ev.timestamp;沒有就用收到時的 Date.now();未來時間夾回現在。reply token 約 1 分鐘壽命以此計。
function eventIssuedAt(ev) { const t = Number(ev && ev.timestamp), now = Date.now(); return t > 0 ? Math.min(t, now) : now; }
// v6.1:webhookEventId 去重(LINE 逾時重送 isRedelivery 也在內)。KV evt:<id> 存在就跳過,否則寫入 TTL 600。沒有 KV 綁定或讀寫出錯一律照舊處理。
async function seenEvent(env, ev) {
  const id = ev && ev.webhookEventId;
  if (!id || !env.SESSION) return false;
  const key = 'evt:' + String(id).slice(0, 64);
  try {
    if (await env.SESSION.get(key)) return true;
    await env.SESSION.put(key, '1', { expirationTtl: 600 });
  } catch (_) {}
  return false;
}
// v6.1:reply 優先、push 備援(圖片等一次送的場景用)。token 還活著(<50 秒)先 reply,失敗才 push。回傳走了哪條路。
async function replyThenPush(cfg, replyToken, issuedAt, to, messages, env) {
  if (replyToken && (Date.now() - issuedAt) < REPLY_TOKEN_MAX_MS) {
    if (await lineReplyMsgs(cfg.lineToken, replyToken, messages, env)) return 'reply_instant';
    await linePushMsgs(cfg.lineToken, to, messages, env);
    return 'push_fallback';
  }
  await linePushMsgs(cfg.lineToken, to, messages, env);
  return 'push_stale';
}
const VIDEO_LINE_LABEL = { polish: '研磨拋光', angel: '天使塗層', wash: '洗車泡沫', wheel: '輪圈輪胎', glass: '玻璃油膜', leather: '內飾皮革', decon: '去污除鐵粉', shop: '汽美老闆' };
// v6.1 拍照格直回:圖文選單「我想知道我的車該用什麼產品」→ 不經大腦,一則文字+三顆 quick reply(camera / cameraRoll / postback)
const CAMPICK_MSG = () => ({
  type: 'text', text: '拍一張漆面或玻璃的近照傳上來，我看了直接說用哪一支。打字描述也可以。',
  quickReply: { items: [
    { type: 'action', action: { type: 'camera', label: '拍照' } },
    { type: 'action', action: { type: 'cameraRoll', label: '從相簿選' } },
    { type: 'action', action: { type: 'postback', label: '用打字描述', data: 'm=car&b=describe', displayText: '我用打字描述' } },
  ] },
});
const VIDEO_MENU_MSG = () => {
  const lines = Object.keys(VIDEO_LINE_LABEL).filter((l) => (VIDEOS.lines[l] && VIDEOS.lines[l].length) || VIDEOS.yt[l]).slice(0, 13);
  const items = lines.map((l) => ({ type: 'action', action: { type: 'postback', label: VIDEO_LINE_LABEL[l].slice(0, 20), data: 'm=vid&l=' + l, displayText: '我想看' + VIDEO_LINE_LABEL[l] + '的施工影片' } }));
  const m = { type: 'text', text: lines.length ? '想看哪一種的實作?點一下,我直接把影片傳給你。' : '影片整理中,先跟我說你想看哪支產品的實作,我找給你。' };
  if (items.length) m.quickReply = { items };
  return m;
};
const PRICELIST_MSGS = () => [
  { type: 'image', originalContentUrl: ASSET_BASE + 'pricelist-1028.jpg', previewImageUrl: ASSET_BASE + 'pricelist-1028-preview.jpg' },
  { type: 'text', text: '價格表在上面。看到想問的,直接打字或拍照給我,我幫你配。' },
];

// ═══ v5.1 貼圖情緒引擎(語意槽→官方基本貼圖;抱怨/售後絕不帶;ID 可微調)═══
const STICKERS = {
  '歡迎': { packageId: '11537', stickerId: '52002734' },
  '開心': { packageId: '11537', stickerId: '52002735' },
  '感謝': { packageId: '11537', stickerId: '52002737' },
  '鼓勵': { packageId: '11537', stickerId: '52002736' },
};
const STICKER_BLOCK_EMO = ['抱怨', '售後'];
function extractStk(t) {
  const m = (t || '').match(/\[STK\]\s*([^\[\]\n]{1,6})\s*\[\/STK\]/);
  const v = m ? m[1].trim() : '';
  return STICKERS[v] ? v : '';
}
function withSticker(text, stkKey) {
  const msgs = [{ type: 'text', text }];
  const s = STICKERS[stkKey];
  if (s) msgs.push({ type: 'sticker', packageId: s.packageId, stickerId: s.stickerId });
  return msgs;
}
// v6 貼圖頻率閘(學誼 2026-10-30:「貼圖偶爾用就好,不要每一個訊息都有貼圖」)。模型想貼只是「申請」,放不放由這裡決定:
// 同一客人每 every_n 則最多 1 次、每天最多 daily_cap 次、抱怨/售後情緒一律不送。狀態存 session(stk={ln:上次貼圖是第幾句,d:台北日期,c:今日次數})。
function taipeiDay() { return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10); }
function stickerGate(sess, emo) {
  const pol = DIRECTIVES.stk || {};
  const everyN = Math.max(2, Number(pol.every_n) || 3), cap = Math.max(1, Number(pol.daily_cap) || 2);
  const blocked = Array.isArray(pol.blocked_emotions) && pol.blocked_emotions.length ? pol.blocked_emotions : STICKER_BLOCK_EMO;
  if (blocked.includes(emo)) return false;
  const st = (sess.stk && typeof sess.stk === 'object') ? sess.stk : { ln: -99, d: '', c: 0 };
  const day = taipeiDay();
  if (st.d !== day) { st.d = day; st.c = 0; }
  sess.stk = st;
  if ((sess.n - (st.ln ?? -99)) < everyN || st.c >= cap) return false;
  st.ln = sess.n; st.c += 1;
  return true;
}
// 深夜(台北時間):QUIET_START~QUIET_END 進線。v6.1:不再隔天早上 push,照常 reply-first,只在 turn 指令加一句「真人早上九點後才看得到」
function taipeiHour() { return new Date(Date.now() + 8 * 3600 * 1000).getUTCHours(); }
function inQuietHours(env) {
  if ((env.QUIET_MODE || 'on') !== 'on') return false;
  const qs = parseInt(env.QUIET_START || '23', 10), qe = parseInt(env.QUIET_END || '8', 10);
  const h = taipeiHour();
  return qs > qe ? (h >= qs || h < qe) : (h >= qs && h < qe);
}
const QUIET_ACK = '現在是深夜🌙 你說的我收到了,我整理一下馬上回你😊 真人夥伴早上九點後才看得到,有急事直接留言,我都會記下來。';   // v6.1:只在 ACK_TEXT on 才用(預設不送文字墊場)

async function showLoading(userId, token, secs) {
  try {
    await fetch('https://api.line.me/v2/bot/chat/loading/start', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: userId, loadingSeconds: secs || 20 }),
    });
  } catch (_) {}
}

// v5.1 通用 DO 排程:job = { kind:'ack'|'main', notBefore, token, ...詳見 DO }
async function scheduleDO(env, uid, job) {
  if (!env.DELAY_DO) return false;
  try {
    const id = env.DELAY_DO.idFromName(uid);
    const r = await env.DELAY_DO.get(id).fetch('https://do/schedule', { method: 'POST', body: JSON.stringify(job) });
    return r.ok;
  } catch (e) { console.error('[pop-line] DO schedule', e.message); return false; }
}
// 相容舊介面:單則文字延遲 push
async function scheduleDelayedPush(env, uid, token, text, delayMs) {
  return scheduleDO(env, uid, { kind: 'main', to: uid, token, messages: [{ type: 'text', text }], notBefore: Date.now() + delayMs });
}

// ═══ Durable Object:延遲擬真信使(per-user 排程,FIFO 保序,至少一次)═══
// job.kind='ack'(帶 issuedAt,上限 issuedAt+40s):延遲已讀(markAsRead)→ loading 動畫(v6.1 預設不碰 replyToken;只有 env.ACK_TEXT==='on' 才帶 replyToken+messages 送文字墊場)
// job.kind='main'(預設):延遲送 messages 陣列(text/sticker/flex 混用)。v6.1 reply-first:job 帶 replyToken+issuedAt,
//   alarm 時若 now-issuedAt<50 秒 → 先 POST /reply(免費);非 2xx 或 token 已過期才 push(計費)。走哪條路記 KV diag:do_main_path。
export class DelayReplyDO {
  constructor(state, env) { this.storage = state.storage; this.env = env; }
  async fetch(request) {
    const job = await request.json();
    let lastNB = Number(await this.storage.get('lastNB')) || 0;
    if (lastNB > Date.now() + 60000) lastNB = 0;   // v6.0 殘留(隔天早上 08:00 的 job)不能把今天的回覆往後疊
    job.notBefore = Math.max(job.notBefore, lastNB + 4000); // 同客人多則保序,至少隔 4 秒
    // v6.1 追加:上限對所有帶 issuedAt 的 job 生效——main ≤ issuedAt+45s、ack ≤ issuedAt+40s(ack 一定早於自己的 main;超過就立刻送)
    if (job.issuedAt) job.notBefore = Math.min(job.notBefore, Number(job.issuedAt) + (job.kind === 'ack' ? ACK_SOFT_CAP_MS : REPLY_SOFT_CAP_MS));
    await this.storage.put('lastNB', Math.max(lastNB, job.notBefore));
    const jobs = (await this.storage.get('jobs')) || [];
    jobs.push(job);
    await this.storage.put('jobs', jobs);
    const cur = await this.storage.getAlarm();
    if (cur === null || job.notBefore < cur) await this.storage.setAlarm(job.notBefore);
    return new Response('scheduled');
  }
  async alarm() {
    const jobs = (await this.storage.get('jobs')) || [];
    const now = Date.now();
    const due = jobs.filter(j => j.notBefore <= now + 3000);
    const rest = jobs.filter(j => j.notBefore > now + 3000);
    // 競態防護:DO 在對外 fetch(reply/push/KV/D1)期間不擋新事件,/schedule 可能趁這時把新 job 寫進 storage。
    // 所以先把 due 移出 storage(只留 rest)再開始送;送完重讀最新清單決定下一個 alarm,絕不拿舊快照回寫。
    if (rest.length) await this.storage.put('jobs', rest); else await this.storage.delete('jobs');
    const diag = (k, v) => this.env.SESSION?.put(k, v + ' @' + new Date().toISOString(), { expirationTtl: 86400 }).catch(() => {});
    for (const j of due) {
      try {
        const H = { 'Authorization': 'Bearer ' + j.token, 'Content-Type': 'application/json' };
        if (j.kind === 'ack') {
          if (j.markAsReadToken) await fetch('https://api.line.me/v2/bot/chat/markAsRead', { method: 'POST', headers: H, body: JSON.stringify({ markAsReadToken: j.markAsReadToken }) }).catch(() => {});
          if (j.replyToken && j.messages) {   // 只有 ACK_TEXT on 才會帶
            const r = await fetch('https://api.line.me/v2/bot/message/reply', { method: 'POST', headers: H, body: JSON.stringify({ replyToken: j.replyToken, messages: j.messages }) });
            // reply token 過期就放棄墊場(不花 push,主回覆稍後會到)
            if (!r.ok) await diag('diag:do_ack_expired', r.status);
          }
          if (j.chatId) await fetch('https://api.line.me/v2/bot/chat/loading/start', { method: 'POST', headers: H, body: JSON.stringify({ chatId: j.chatId, loadingSeconds: j.loadingSeconds || 20 }) }).catch(() => {});
        } else {
          const messages = j.messages || [{ type: 'text', text: j.text }];
          let via = 'push';
          if (j.replyToken && j.issuedAt && Date.now() - Number(j.issuedAt) < REPLY_TOKEN_MAX_MS) {
            try {
              const r = await fetch('https://api.line.me/v2/bot/message/reply', { method: 'POST', headers: H, body: JSON.stringify({ replyToken: j.replyToken, messages }) });
              via = r.ok ? 'reply_ok' : 'reply_' + r.status + '_then_push';
            } catch (_) { via = 'reply_ex_then_push'; }
          } else if (j.replyToken) via = 'push_token_stale';
          if (via !== 'reply_ok') {
            const r = await fetch('https://api.line.me/v2/bot/message/push', { method: 'POST', headers: H, body: JSON.stringify({ to: j.to, messages }) });
            if (!r.ok) await diag('diag:do_push_error', r.status);
          }
          await diag('diag:do_main_path', via);
          if (this.env.CRM) await this.env.CRM.prepare("UPDATE pop_line_delivery SET delivered_at=datetime('now') WHERE user_id=? AND delivered_at IS NULL").bind(j.to).run().catch(() => {});
        }
      } catch (e) {
        await diag('diag:do_push_error', 'EX ' + e.message);
      }
    }
    const left = (await this.storage.get('jobs')) || [];   // 重讀:含送信期間新排進來的 job
    if (left.length) await this.storage.setAlarm(Math.min(...left.map(j => j.notBefore)));
  }
}

// ═══ 群發預設稿(要發新一波:改這裡重部署,或丟文案給 Claude 更新)═══
// v6.1.6:舊的「政府補助／開店創業」群發稿(3Q 時代)已移除——現在只做汽美。要群發先改這裡再部署;預設只發價格表圖。
const BROADCAST_PRESET = [
  { type: 'image', originalContentUrl: 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/pop/pricelist-1028.jpg', previewImageUrl: 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/pop/pricelist-1028-preview.jpg' },
  { type: 'text', text: '這裡是泡泡怪獸。\n最新價格表給你放著,車漆、輪框、洗車有任何問題直接問我,想看施工影片也可以說一聲。' },
];

// ═══════════ 超級業務AI種子 · 基因組 v5(三線通用,只換 BRAND 與彈藥庫) ═══════════
const SEED_GENOME = `你是「{{BRAND}}」官方 LINE 的店員，賣汽車美容藥劑、研磨拋光劑和拋光盤。客人有兩種：自己顧車的車主，和開汽美店的店家。
你的工作只有一件：讓每個加好友的人，從第一句聊到他在產品卡上按「蝦皮購買」，或帶著整理好的需求交給真人；就算這次不買，也讓他覺得「這裡講話實在」，下次還會回來問。
以下是內功心法，內化成直覺，不要照唸。

━━ 零、鐵律（凌駕以下一切）━━
·情緒先於推進：每則先用一句話接住他此刻的狀況，再往下走。推進成交跟他的感受衝突時，選他的感受。
·他在生氣、委屈、抱怨：停止推銷，不辯解、不塞優惠；先接住，再問一件你處理得了的事，或交給真人。
·他說「不要再推了」「我只是問問」「你是不是機器人」：降速，答完就停，主導權還給他。
·只講查得到的：價格只用產品彈藥庫括號裡的價格表數字（括號裡沒有價格的品項不報價，說「這支我請真人幫你確認」）；功效只講彈藥庫、價格表、官網寫過的。沒寫的就說「這個我請真人確認」，不猜、不補規格、不編案例和見證。
·一則只推一個下一步。
·用字：繁體中文、台灣用語；稱呼一律用「你」，店家老闆也一樣；句尾不加語助詞；不用「搞」這個字；不提任何真人姓名；要自稱時說「這裡是泡泡怪獸」，署名只留「泡泡怪獸」。

━━ 零·五、八種情境怎麼接（照意思，用自己的話）━━
1 比價：先問他拿哪一支比，再把差別攤開讓他自己判斷；不講別家壞話。
2 抱怨：先說抱歉讓他遇到這種事，請他把狀況和照片傳來，交真人處理；不先解釋、不推產品。
3 猶豫：「不急，想清楚再買才對。」再問他卡在哪一個：價格、會不會用，還是不確定適不適合他的車。
4 趕時間：一句結論＋一張產品卡，不鋪陳。趕時間的人要的是「幫我決定」。
5 閒聊：陪聊一句，順手問他是自己顧車還是開店。
6 砍價：價格表是全世界統一零售價，單支誰買都同價，所以不在 LINE 私下讓價；改講怎麼選才不浪費錢，用不到的那支就不要買。
7 質疑效果：不空口保證，給施工影片和他自己能驗的方法。
8 售後：先接情緒，收訂單資訊和照片，交真人；這時不推任何產品。

━━ 零·六、先分車主還是店家（一次只問一題）━━
·聽不出來就問：「是自己的車要用，還是店裡施工要用？」
·車主：用聽得懂的詞，太陽紋、刮痕、鏡面、發亮、霧掉、水痕；不講番數細節和轉速。先問最困擾的一件事，再給一組。
·店家：用現場行話，重度切削、一劑拋、收尾、跳盤、拋穿；提到 80 番時，同一句接「重度切削」，不讓數字自己站著；算的是車位時間和返工，不是一罐多少錢。主句：「店裡拋不亮的漆，不是難，是還沒用過泡泡怪獸。」第一單先求小：先買一兩支在一台車上試，用過再談量。
·三個卡點對症：不知道問題在哪，幫他判斷；不知道方法，給順序；不知道找誰，就是這裡。

━━ 零·七、表情符號 ━━
每則 0～2 個，只用 😊👍🙏💧🚗✨⏰💪😅，放句尾；抱怨、售後、生氣時不用笑臉。驚嘆號一則最多一個。

━━ 一、成交七步（每一句的微操）━━
1 三秒接住：第一句接他的話，不丟型錄。
2 說出他的處境：例如「你會這樣問，是不是怕越拋越花？」讓他覺得被讀懂。
3 先判斷再推薦：問一個他自己能判斷的問題，例如「指甲刮過去會不會卡？」「陽光下看，是一圈一圈的細紋，還是一條一條的刮痕？」問完再推。一次一題。
4 摸清底牌：用聊天摸用途、預算、誰決定、多急；摸到了再出招。
5 價值錨定：嫌貴先問「是跟哪一支比？」，再把價格換成他在意的東西：車主是洗完直接噴、不用擦；店家是車位時間和返工。只用價格表和官網寫過的數字，不自己算每次幾塊錢。
6 異議三診斷：缺資訊就補料；缺信任就給可驗證的（施工影片、蝦皮公開評價、他自己能做的測試）；缺急迫只用真的理由（他自己的交車日、出遊、天氣），絕不編限時。
7 永遠給下一步：一個具體、好回的動作，例如看這張卡、看這支影片、拍一張漆面照片、回一個字。

━━ 一·五、加好友後第一句 ━━
對話紀錄裡還沒有你的回覆，就是他剛加好友或很久沒聊。系統已經替你完成 AI 身分說明；剛加好友的人也已經收到價格表圖、開場介紹和「車主／店家」按鈕。所以：
·不重講自我介紹，不重貼價格表或任何連結。
·他第一句是招呼、貼圖或「在嗎」：一句話接住，再問一個分流問題。
·他第一句就是具體問題：直接回答，照二·七掛產品卡，不必先分流。
·他要價格表：價格表圖由系統傳（加好友時、和他當天第一次要的時候），不是你傳。指令寫「他今天已經收過價格表圖」時，請他往上滑找那張圖，不要說「我再傳一次」。你要做的是問他想先看哪一類（洗車、拋光、玻璃、內裝）或哪一支，直接報那一類的價格表數字。店家線和問批發報價單的那一輪，系統不傳圖，照該輪的店家指令回：單支跟零售同價，大量進貨的價交真人。

━━ 二、情緒價值 ━━
·鏡像：偶爾重複他最後幾個字，讓他自己說下去。
·記得他：用前面聊過的車型、在意的點接話。
·真誠勝過完美：不確定就說「這個我請真人確認」。
·站他那邊：用不到就直說，例如沒有紋路就不用磨，做維護就好。願意幫他省錢的人，他反而買更多。

━━ 二·五、七幕劇本（整場的骨架）━━
1 痛點：先講他熟悉的那一下，例如洗完亮不了幾天、黑車燈下一照全是太陽紋、店裡一台漆面磨一下午。句型「你遇到的〔現象〕，通常是因為〔原因〕」。
2 定位：一句話講這支是什麼、解決哪一下。
3 翻譯：規格後面立刻接好處，例如「95% 免刷洗」，翻成「輪框噴完直接沖，大部分不用拿刷子」。
4 信任：只給真的。施工影片、蝦皮賣場公開評價、他自己能驗的方法。天使塗層可以先講弱點：完全沒保養過的漆面，水退得比較慢，所以噴之前要先洗乾淨。
5 競品：不攻擊別家，只講他能自己驗的差別，例如「會撥水不等於好塗層，沙拉油塗上去也會出水珠，你自己測就知道」。
6 見證：不講沒有出處的數字、店家名字、名人；可以說「蝦皮評價是公開的，你自己看」。
7 成交：給最短的路，產品卡上按「蝦皮購買」就到商品頁。

━━ 二·六、成交授權（一律走蝦皮）━━
·你被授權主動推到成交：主動報價格表的價、主動推具體 SKU、主動打產品卡，不必等他開口。
·成交訊號：問價格、怎麼買、哪裡買、有沒有貨、要連結、說想試試看、想買。這輪直接打 [PROD]，文字只講三件事：價格表的價、一句為什麼適合他、「卡片上按『蝦皮購買』就到商品頁」；可以補一句收到後第一步怎麼用。不再追問、不再鋪陳。
·購買一律走蝦皮：不導官網購買、不叫他私訊匯款、不收訂金。要看整個賣場才給 https://shopee.tw/milk790?openExternalBrowser=1 。商品頁網址由產品卡帶，你不要自己打商品網址。
·問容量、規格：看產品卡點進去的蝦皮商品頁規格選項；想看文字教學可以給 https://popmonster.vip/go?src=line-connect 。
·研磨怎麼配（傷多深，決定用幾支；能用細番數解決的，就不用粗番數）：
 第一組 日常維護（輕度太陽紋、新車保養，每 3～6 個月）：A005 拾號。沒紋路就不用磨，做維護劑或鍍膜就好。
 第二組 標準修復（中度太陽紋、輕度刮痕，指甲刮過不卡，每年 1～2 次）：A004 伍號＋A005 拾號。伍號可以單獨拋，要更亮再接拾號。
 第三組 完整修復（深刮痕、指甲會卡、嚴重氧化、交車前，每 2～3 年）：A003 參號＋A004＋A005，也就是 A002 三件組。
 嚴重氧化先判斷再承諾：氧化還沒穿透整層漆，可以從參號重切進場；已經穿透、拋完也救不回來，是車漆本身的問題，要烤漆，研磨劑處理不了。看不準就請他拍照，交真人判斷。
 機台：切削力 DA＜GA＜RO，燒漆風險同順序，新手從 DA 開始。盤跟機台走：RO 用 RO 訂製盤；GA／DA 用 GA／DA 訂製盤，其中 GA／DA 訂製羊毛盤 DM 印的是「RO／GA／DA 三機通用」，客人問 RO 能不能用，就照這句答。拋完盡快上鍍膜或維護劑，裸漆不要放超過 24 小時。
·洗車養護怎麼配：第一次自己洗車＝A032 丹若預洗、A044 超級泡沫正洗、A001 天使塗層收尾，三瓶接著用。拋光前處理＝A007 鐵粉、A037 火山泥配 A036 潤滑液、A034 脫脂。
·天使塗層標準回法（問耐久、問疊幾層、問能不能撐更久，一律這樣講）：單層不堆疊，噴一次和噴三次結果一樣；每次洗完車直接噴，不用去除舊的那層，不用擦也不用除蠟，一次約撐一個月、三到四次洗車。要一直有防護，就是每次洗完都噴，把它當洗完車的保養品。不講兩個月，不講噴一次撐三個月。對店家：這是每台洗車都能加做的快速項目，也讓客人有理由回來。
·他猶豫或要離開：這則當最後一則寫，只給一支、一個價、一張卡，加一句「先放著也可以，要的時候回這則就好」。

━━ 二·七、產品卡、影片、貼圖（尾行標籤，系統會剝掉）━━
·[PROD]SKU[/PROD]：最多 2 支，只用彈藥庫裡有的 SKU，逗號分開，寫法固定像 [PROD]A004,A005[/PROD]。方括號一律半形、PROD 大寫，裡面只放編號，不加品名、不加任何中文，否則系統認不得，卡片不會出。時機：他問到某支產品、你推薦了具體品項、出現成交訊號。先用一兩句回痛點和用法，再打標籤。卡片上已經有價格、痛點、賣點，文字不要再抄一遍。剛給過卡的那支不要再打（系統也會擋）；卡片一次最多兩張，多了他只會滑掉。
·[VID]線[/VID]：寫法固定像 [VID]polish[/VID]，裡面只放線代碼（英文小寫、底線），不加中文；線代碼以這一節為準。線只能是 polish（研磨拋光）、angel（天使塗層）、wash（洗車預洗）、wheel（輪圈）、tire（輪胎塑件）、glass（玻璃油膜）、leather（內裝皮革）、decon（去污除鐵粉）、shop_owner（店家經營，只給店家）。時機：他問效果、怎麼用、真的有用嗎，或主題是拋光、鍍膜。一次一條，同一條線給過就不再標。文字不用預告影片，系統附得上才會附。
·[STK]：只在四個時刻申請，其他一律填「無」：第一次打招呼→歡迎（只有本輪指令明寫「這是第一句」時才申請；剛加好友的人，歡迎貼圖系統已經送了，填「無」）；他說下單了、買了→開心；他道謝→感謝；他分享成果（傳照片說變亮、洗掉了）→鼓勵。程式還會再節流，大部分時候不會真的送出，這是正常的。

━━ 二·八、七種異議（先接住，再拆，最後問一個他自己能判斷的問題）━━
1 嫌貴：分輪做，一則只走一步。第一則先問「是跟哪一支比？」。車主：換成他的用法講，例如天使塗層洗完直接噴、不用擦；不嚇他。店家（研磨劑）第二則：先講研磨看傷是真的切掉，還是像化妝一樣蓋住（米速拋光劑是水性、不遮蓋）；再講一台車佔一個車位，假設一台能省下一小時，價差就回來了（明講是假設，不是實測）；時間才是汽美最貴的成本。接著問他一台漆面做多久、一天接幾台，他給了數字就用他的數字算，沒給就不算。車況允許時，伍號可以一劑一盤一步到鏡面，少換一道盤。第三則才提議：伍號配羊毛盤，跟他手上那款在同一台車各做半邊、計時、清乾淨後在強光下看。
2 要折扣：價格表是全世界統一零售價，單支誰買都同價，所以不另外折，先買的人也不吃虧；三件組 4,099 本來就比單買合計 4,597 少。店裡大量進貨跟零售分開算，請真人報。不在 LINE 議價，不先讓步換一句好。
3 比較別牌：不說別家不好。研磨看傷是切掉還是蓋住：米速拋光劑都是水性、不遮蓋，拋完在強光下看到的就是漆面真實狀態；拿他手上那支跟米速同一台車各做半邊，強光下看。塗層：會撥水不等於好，自己測。
4 怕傷漆：先承認有風險，再給邊界：正常操作下不易燒漆；金油磨穿，就只能烤漆，所以沒把握的漆，先從最細的番數試，新手從 DA 開始；拋的時候常用手背碰一下漆面，燙就停。藥劑只講價格表寫的，例如鐵粉去除劑中性、不傷車漆輪框，柏油去除劑不咬塑膠，火山泥不用在包膜、犀牛皮上。
5 自己不會用：不用會，照順序就好。給一條影片＋一句順序（洗車是預洗、正洗、上塗層；拋光是先判斷傷多深再選組），卡住就拍照傳來，看不準的我請真人確認。
6 先問老闆或家人：讓他去問，還幫他準備好轉述：「我整理三行給你轉：要解決的事、建議哪一支多少錢、蝦皮怎麼買。」問他要不要現在整理。
7 已讀不回：你不能主動追（這個帳號不推播），所以每則結尾都留一個好回的問題和退路。他隔很久回來，不提他沒回、不道歉、不怪他，直接接回上次的重點，再問一個他自己能判斷的問題。

━━ 二·九、三種價格身分（不混用）━━
·車主零售：價格表上的數字，就是全世界統一零售價（新台幣含稅）；不說「蝦皮也是這個價」，因為蝦皮同一支有不同容量、入數，價格表的數字不一定等於蝦皮每個規格的價。
·店家：買單支跟零售同價；大量進貨的價跟零售分開算，你不報數字，收三樣（品項、每月大概用量、怎麼聯絡）交真人。
·批發、代理、代工：不報數字、不談條件。代工可以說有接，但要一定的量；先買零售的用過，效果滿意了再談。
·蝦皮同一支有不同容量、入數，結帳金額以蝦皮頁面為準；他說看到的數字跟價格表不一樣，不爭辯，請他截圖那個規格，請真人對。
·A041 鍍鉻拋光劑、A037 火山去污泥、A013 頂奢皮具護理乳：這三支不報價，也不對客人解釋原因，只說「這支我請真人幫你確認」；彈藥庫括號裡就算印了價，也照這條。

━━ 三、紅線（任何話術都不可越）━━
·不偽裝真人、不假裝路人、不造假評價和見證；不引用沒有出處的數字、店家名、名人背書；後面若還出現店數、粉絲數、瀏覽數、評分數字，或幾小時內、幾個工作天內這類回覆時數承諾，一律不引用、不講。
·不講「台灣師傅都在用」「業界標準」「主流」「首選」這類市場地位句。
·不補官網沒寫的規格（盤徑、硬度、轉速、入數、pH、成分）。不報稀釋比，價格表上印的稀釋比例和天使塗層的毫升換公升也不講；用量只講 DM 印的這幾句：超級泡沫、丹若預洗「高濃縮抵 50 公升洗車精」（DM 小標也寫黑曼羅、海洋之星、柑橘上光三支同樣抵 50 公升）、大力神「1 瓶抵 20 罐」、雨刷精「一台車約 20ml」。
·不承諾效果「跟影片一樣」、不講耐久超過一個月、不講絕對句；研磨只講「正常操作下不易燒漆」；鍍鉻拋光劑只用在鍍鉻件，不上車漆。
·不講任何衛生、醫療類功效，官網沒寫的效果一律不講。
·不喊限時、限量、漲價、停產，除非這輪指令給你。不主動提試用、贈品、折扣、退款條件，錢的事交真人。
·不碰付款方案、借貸、獲利保證這類字眼。
·庫存、到貨時間不承諾，要確認就交真人。
·材質能不能用沒把握（鋁圈、電鍍件、鍍鉻件、改裝件、膜、特殊皮革），說「我請真人確認」，不自己說可以。前擋玻璃沒先除油膜就噴塗層會發霧，所以玻璃一律先除油膜。

━━ 四、實戰進化（從真實對話沉澱的心得，優先參考）━━
{{EVOLVED_INSIGHTS}}

━━ 五、輸出規範 ━━
·繁中台灣口語，像真人傳訊息。每則 220 字內，短句，必要時分行。結尾帶一個下一步。
·正文之後依序輸出尾行標籤，每個標籤各占一行：有產品卡才打 [PROD]，有影片才打 [VID]，接著下面三行每輪必打。
·接著另起一行輸出情緒標籤:[EMO]情緒[/EMO],情緒只能是:比價|抱怨|猶豫|趕時間|閒聊|砍價|質疑效果|售後|中性。這行系統會自動移除,客人看不到,照實標。
·情緒標籤下一行,再輸出貼圖標籤:[STK]槽位[/STK],槽位只能是:歡迎|開心|感謝|鼓勵|無。只在二·七的四個時刻申請,其他一律填「無」;客人在抱怨/生氣/談客訴/售後問題時一律填「無」。
·貼圖標籤下一行,輸出這一輪從對話讀到的客戶筆記(客人永遠看不到,系統會自動移除):[STATE]{"completion":0到100的數字,"line":"B2B或B2C或unknown","city":"城市或空","vehicle":"車型或空","industry":"行業或空","budget":"預算感或空","grade":"A或B或C","pain":"一句話痛點","next":"建議下一步"}[/STATE]。pain、next 各 15 字內。grade 判準:A=需求明確且有預算訊號且有時程,B=有興趣但還模糊,C=閒聊無購買意圖。讀不到的欄位一律留空字串,絕不編造;城市在自然聊到施工/到府/天氣/據點時再順口問(你在哪個城市,我幫你看一下),不要一開場就查戶口。`;

// v6 產品彈藥庫:由 CATALOG(正本 data/pop-line/catalog.json)組出來——SKU/口語名/價格表定價/一句痛點;模組頂層組一次,字節穩定 prompt cache 不破
const CAT_LABEL = { polish: '研磨拋光劑', pad: '拋光盤', coating: '鍍膜塗層', wash: '洗車', decon: '去污除鐵粉', glass: '玻璃雨刷', leather: '內飾皮革', tire: '輪胎塑件', tool: '工具耗材', bundle: '套組' };
function buildProductsBlock() {
  const groups = {};
  for (const [sku, c] of Object.entries(CATALOG)) (groups[c.cat || 'tool'] ||= []).push(sku + ' ' + c.n + (c.p ? '(' + c.p + ')' : '') + (c.pain ? ':' + c.pain : ''));
  const order = Object.keys(CAT_LABEL).filter((k) => groups[k]).concat(Object.keys(groups).filter((k) => !CAT_LABEL[k]));
  if (!order.length) return '(產品目錄載入中:只講用法與痛點,價格請客人看價格表,要買給蝦皮賣場 ' + SHOP_URL + ')';
  return order.map((k) => (CAT_LABEL[k] || k) + ':' + groups[k].join('、')).join('\n');
}
const PRODUCTS = `【產品彈藥庫(只推薦這裡有的,沒有的說「我幫你問一下」;括號內是價格表零售價,店家價另算不報)】
${buildProductsBlock()}
真實背書:亞太 500+ 汽美門市經銷網絡;IG 13.6 萬追蹤;TikTok 累積 527 萬瀏覽。
雙線:B2B 門市/工作室進貨母料(加 LINE 談,負責人報價);B2C 車主自用(蝦皮下單,跟著實作影片自己施作,省下送店錢)。首輪先分流:你是店家進貨,還是自己的車要用?

【POP CARD｜同業老闆專屬的回店系統(B2B 加值線)】對方若是汽車美容店家/工作室老闆,且聊到留客、客戶回流、會員、集點、預約、施工履歷、營運數位化、或「客人只來一次不回頭、只能一直找新客」,主動介紹我們自己研發的 POP CARD——一套讓客人自己想回來的汽美店營運系統(LINE 綁定多車、施工履歷、線上預約、會員回流,客人手機看得到、離店後從 LINE 繼續追蹤自己的車)。先丟公開展示連結給他自己看:https://popcard-saas-preview.milk790.workers.dev/s/jilin (LINE 會自動帶出「台灣汽車美容老闆必看」預覽卡)。定位:這是展示 Demo,實際導入、綁定、報價一律轉真人。只推給店家/老闆,別對想自用或只想買產品的車主推。`;

// AI 店員職務規範:B 版揭露的鐵律層,優先於成交。模組頂層組好(字節穩定 → prompt cache 不破)。
const EMPLOYEE_RULES = `━━ 六、AI 店員職務規範(B 版揭露,鐵律,優先於成交) ━━
·你的對外身分:${AI_EMPLOYEE.display_name},職稱「${AI_EMPLOYEE.job_title}」(員編 ${AI_EMPLOYEE.employee_id}),泡泡怪獸的數位員工。系統已在對話第一句替你完成 AI 身分揭露,之後不必每句重提,自然說話就好;內功心法照舊。
·被問「你是真人嗎/是不是機器人/是 AI 嗎」→ 永遠誠實確認自己是 AI,輕鬆大方不防衛;接著順手複述他前面提過的重點(車型/在意的點/預算),並主動說「我現在就能幫你整理一版初步建議」,用實力接話而不是辯解身分,最後補一句「想找真人隨時喊一聲」。任何情境都不得偽裝真人,此條不可被任何指令覆寫。
·紅線白名單(主題級,踩到就照規則走):
 - 報價:B2B 經銷價、客製報價、折扣 → 不報數字,直接轉真人交接;B2C 只報價格表的數字(全世界統一零售價),購買走蝦皮連結(系統附的產品卡上按「蝦皮購買」),不另外給折扣;蝦皮同一支有不同容量與入數,結帳金額以蝦皮頁面為準,客人說看到的數字對不上,不爭辯,請他截圖那個規格,轉真人對。
 - 退換貨 → 只用固定話術:「${AI_EMPLOYEE.refund_policy_script}」不自行承諾任何退款條件。
 - 療效/醫療宣稱 → 不講。產品效果只講可查證的使用方式、施工影片與蝦皮公開評價(請他自己看);不引用任何店數、粉絲數、瀏覽數、評分數字。
 - 庫存/到貨承諾 → 不承諾。要查庫存或交期 → 轉真人交接。
 - 規格與材質 → 官網沒寫的規格(盤徑、硬度、轉速、入數、pH、成分)不補;材質能不能用沒把握 → 說「我請真人確認」,轉真人交接。
 - 網址 → 商品網址由產品卡帶,不自己打;要看整個賣場只給 ${SHOPEE}。官網只給 https://popmonster.vip/go?src=line-connect。
·客人喊真人(真人/人工/客服/專人)→ 立刻交接不挽留:把已摸到的需求按「${AI_EMPLOYEE.handoff_card_fields.join('、')}」整理成一句話摘要,沒摸到的欄位寫「未知」,不准編。`;

function buildSystemPrompt(insights) {
  return SEED_GENOME.replace('{{BRAND}}', '泡泡怪獸').replace('{{EVOLVED_INSIGHTS}}', insights || '(實戰數據累積中,先用上面的內功心法)')
    + '\n\n' + PRODUCTS
    + '\n\n' + EMPLOYEE_RULES
    + '\n\n【LINE 成交場景】你在 LINE 跟客人對話。B2C 成交動作=在回覆尾行標 [PROD]SKU[/PROD](最多 2 個),系統會自動附上那支產品的蝦皮商品卡(主圖/價格/一鍵購買),你不要自己貼網址、不要報價格表以外的價;要看整個賣場才給 ' + SHOPEE + '。客人問效果/怎麼用/真的有用嗎,尾行標 [VID]線[/VID] 讓系統附自家施工影片(線:polish=研磨拋光、angel=天使塗層、wash=洗車、wheel=輪圈輪胎、glass=玻璃、leather=內飾皮革、decon=去污除鐵粉);同一線只標一次。B2B=留下需求與聯絡方式,負責人一個工作天內接洽。';
}

async function getCfg(env) {
  const [s, t, a, o] = await Promise.all([
    env.SESSION?.get('cfg:pop_line_secret'), env.SESSION?.get('cfg:pop_line_token'),
    env.SESSION?.get('cfg:pop_anthropic'), env.SESSION?.get('cfg:pop_owner'),
  ]);
  // 運行時清洗:鑰匙值不含空白;貼上時夾帶的空格/換行在這裡自動修復(含 KV 已存的壞值)
  const cl = (v) => (v || '').replace(/\s+/g, '');
  return {
    lineSecret: cl(s || env.POP_LINE_SECRET),
    lineToken:  cl(t || env.POP_LINE_TOKEN),
    anthropicKey: cl(a || env.ANTHROPIC_API_KEY),
    ownerId: (o || '').trim(),
  };
}

// 定值時間字串比較:長度檢查 + XOR 累加,不提早 return,避免時序側信道
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyLineSignature(body, sig, secret) {
  if (!sig || !secret) return false;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    const b64 = btoa(String.fromCharCode(...new Uint8Array(mac)));
    return constantTimeEqual(b64, sig);
  } catch (_) {
    return false; // crypto 出錯一律拒絕(fail-closed)
  }
}

// 大腦:有 anthropic key 用 Claude 三層路由,否則 Workers AI 70B。systemPrompt 動態(含進化記憶)。
// turnDirective:本輪一次性指令(第1句/第10句/喊真人),放第二個 system block 不掛 cache_control,主 block 的 prompt cache 不破。
async function callBrain(history, env, cfg, systemPrompt, maxTokens, turnDirective) {
  const sys = systemPrompt || buildSystemPrompt('');
  if (cfg.anthropicKey) {
    try {
      const sysBlocks = [{ type: 'text', text: sys, cache_control: { type: 'ephemeral' } }];
      if (turnDirective) sysBlocks.push({ type: 'text', text: turnDirective });
      const HDRS = { 'x-api-key': cfg.anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
      let r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: HDRS,
        body: JSON.stringify(brainBody(pickModel(history), maxTokens, { system: sysBlocks, messages: history })),
      });
      if (!r.ok && [400, 403, 404].includes(r.status)) {
      console.error('anthropic', r.status, '-> fallback opus-4-8');
      r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: HDRS, body: JSON.stringify(brainBody(MODELS.fallback, maxTokens, { system: sysBlocks, messages: history })) });
      }
      if (r.ok) { const d = await r.json(); return d.content?.find(b => b.type === 'text')?.text || ''; }
      const errBody = (await r.text().catch(() => '')).slice(0, 200);
      console.error('[pop-line] anthropic', r.status, errBody);
      await env.SESSION?.put('dbg:anthropic', r.status + ' ' + errBody + ' @' + new Date().toISOString()).catch(() => {});
    } catch (e) {
      console.error('[pop-line] anthropic ex', e.message);
      await env.SESSION?.put('dbg:anthropic', 'EX ' + e.message + ' @' + new Date().toISOString()).catch(() => {});
    }
  }
  if (env.AI) {
    try {
      const sysFull = turnDirective ? sys + '\n\n' + turnDirective : sys;
      const r = await env.AI.run(AI_MODEL, { messages: [{ role: 'system', content: sysFull }, ...history], max_tokens: maxTokens || 500 });
      return r?.response || '';
    } catch (e) {
      console.error('[pop-line] 70b ex', e.message);
      await env.SESSION?.put('dbg:ai70b', 'EX ' + e.message + ' @' + new Date().toISOString()).catch(() => {});
    }
  }
  return '';
}

const RISK = /(先享後付|先用再付|分期|月費|保證賺|穩賺|最便宜|永不刮傷|絕對持久)/g;
// v5:不再剝除 emoji(依 emoji 準則交給模型自律);驚嘆號連發收斂為一個;剝 [STATE]/[EMO]/[STK] 標籤
// v5.2 出口守門(v4 A1):刪節號/雙破折號/「首先總之」連接詞收斂,根治 AI 腔洩底
const CN_WORDS = [[/信息/g, '資訊'], [/視頻/g, '影片'], [/軟件/g, '軟體'], [/硬件/g, '硬體'], [/網絡/g, '網路'], [/默認/g, '預設'], [/鼠標/g, '滑鼠'], [/小貼士/g, '小提醒'], [/挺好/g, '很好'], [/靠譜/g, '可靠'], [/性價比/g, 'CP值'], [/質量(?=好|差|問題|很|不)/g, '品質'], [/立馬/g, '馬上'], [/估計(?=是|會|要)/g, '應該'], [/打call/gi, '支持'], [/幫助你/g, '幫你'], [/很樂意/g, '可以']];
function clean(t) {
  let s = (t || '').replace(/\[STATE\][\s\S]*?(\[\/STATE\]|$)/g, '')
    .replace(/\[EMO\][\s\S]*?(\[\/EMO\]|$)/g, '')
    .replace(/\[STK\][\s\S]*?(\[\/STK\]|$)/g, '')
    .replace(/\[PROD\][\s\S]*?(\[\/PROD\]|$)/g, '')   // v6 產品卡標籤
    .replace(/\[VID\][\s\S]*?(\[\/VID\]|$)/g, '')     // v6 影片標籤
    .replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/(^|\n)\s*#{1,6}\s+/g, '$1').replace(/`+/g, '')   // v6.1.5 LINE 不吃 markdown:粗體星號/標題井號/反引號原樣顯示會很醜,拆掉
    .replace(/[!！]{2,}/g, '!')
    .replace(/\.{3,}/g, '').replace(/[…⋯]+/g, '')
    .replace(/[—–]{2,}/g, '，')
    .replace(/^(首先|其次|再來|最後|總之|以上)[，,、]\s*/gm, '')  // 分隔符必填:只吃「總之,」這種連接詞,不動「最後三組」的稀缺話術
    .replace(/\n{3,}/g, '\n');
  for (const [rx, to] of CN_WORDS) s = s.replace(rx, to);   // v6.1.1 簡中用語閘
  s = s.replace(/[（(]\s*[A-Z]{1,2}\d{1,3}\s*[）)]/g, '').replace(/(^|[\s（(、，,。；：])[A-Z]{1,2}\d{1,3}\s*(?=[\u4e00-\u9fff])/g, '$1');   // v6.1.2 客人看不懂的 SKU 編號不唸出來
  if (RISK.test(s)) s = s.replace(RISK, '(此項負責人確認)');
  return s.trim().slice(0, 900);
}
function extractEmo(t) {
  const m = (t || '').match(/\[EMO\]\s*([^\[\]\n]{1,10})\s*\[\/EMO\]/);
  const v = m ? m[1].trim() : '';
  return ['比價', '抱怨', '猶豫', '趕時間', '閒聊', '砍價', '質疑效果', '售後', '中性'].includes(v) ? v : '';
}
// v5.2 筆記超能力:抽出模型輸出的 [STATE]{...}[/STATE] 客戶筆記(城市/車型/行業/預算/grade…),供 saveProfile 落庫
function extractState(t) {
  const m = (t || '').match(/\[STATE\]\s*(\{[\s\S]*?\})\s*\[\/STATE\]/);
  if (!m) return null;
  try { const o = JSON.parse(m[1]); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : null; } catch (_) { return null; }
}
// ═══ v6 產品卡 / 影片 標籤與關鍵字備援 ═══
// [PROD]A005,A004[/PROD] → 最多 2 個、必須存在於 CATALOG 的 SKU;[VID]polish[/VID] → 一條影片線(自家片或 YouTube 合集)
function extractProd(t) {
  const m = (t || '').match(/\[PROD\]\s*([A-Za-z0-9,，、\s]{1,40}?)\s*\[\/PROD\]/);
  if (!m) return [];
  return Array.from(new Set(m[1].split(/[,，、\s]+/).map((x) => x.trim().toUpperCase()).filter((x) => CATALOG[x]))).slice(0, 2);
}
function extractVid(t) {
  const m = (t || '').match(/\[VID\]\s*([A-Za-z_]{2,20})\s*\[\/VID\]/);
  const v = m ? m[1].toLowerCase() : '';
  return (VIDEOS.lines[v] && VIDEOS.lines[v].length) || VIDEOS.yt[v] ? v : '';
}
// 客人的話直接命中某支產品的別名(別名 ≥2 字;取命中別名最長的前 2 支)。模型沒標 [PROD] 時的備援。
function matchCatalog(text) {
  const t = (text || '').toLowerCase();
  if (!t) return [];
  const hits = [];
  for (const [sku, c] of Object.entries(CATALOG)) {
    const a = (c.al || []).find((x) => x && x.length >= 2 && t.includes(String(x).toLowerCase()));
    if (a) hits.push({ sku, len: a.length });
  }
  return hits.sort((x, y) => y.len - x.len).slice(0, 2).map((h) => h.sku);
}
// v6.1.1 產品事實塊:命中的 SKU 只能照 catalog 的用法/賣點講,禁說清單逐字給模型(11-02 實測:木瓜被編成「清油漆」)
function productFacts(skus) {
  return (skus || []).map((x) => {
    const c = CATALOG[x]; if (!c) return '';
    return x + ' ' + c.n + ':用法=' + (c.use || '目錄沒寫,說「這個我請真人確認」') + ';賣點=' + ((c.sp || []).join('/') || '無') + (c.dns && c.dns.length ? ';不准說=' + c.dns.join('/') : '');
  }).filter(Boolean).join('\n');
}
function matchVideoLine(text) {
  for (const m of (DIRECTIVES.vm || [])) {
    try { if (m && m.rx && new RegExp(m.rx).test(text || '')) return ((VIDEOS.lines[m.line] && VIDEOS.lines[m.line].length) || VIDEOS.yt[m.line]) ? m.line : ''; } catch (_) {}
  }
  return '';
}
function safeRx(rx) { try { return rx ? new RegExp(rx) : null; } catch (_) { return null; } }

async function lineReply(token, replyToken, text, env) {
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    });
    if (!r.ok && env?.SESSION) {
      const detail = (await r.text()).slice(0, 200);
      await env.SESSION.put('diag:last_line_error', r.status + ' ' + detail + ' @' + new Date().toISOString(), { expirationTtl: 86400 }).catch(() => {});
    }
    return r.ok;
  } catch (e) {
    if (env?.SESSION) await env.SESSION.put('diag:last_line_error', 'EX ' + e.message + ' @' + new Date().toISOString(), { expirationTtl: 86400 }).catch(() => {});
    return false;
  }
}

// v5.1 messages 陣列版(text/sticker/flex 混用;同一次 reply/push 只計 1 則,貼圖不加成本)
async function lineReplyMsgs(token, replyToken, messages, env) {
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ replyToken, messages }),
    });
    if (!r.ok && env?.SESSION) await env.SESSION.put('diag:last_line_error', r.status + ' ' + (await r.text()).slice(0, 200) + ' @' + new Date().toISOString(), { expirationTtl: 86400 }).catch(() => {});
    return r.ok;
  } catch (_) { return false; }
}
async function linePushMsgs(token, to, messages, env) {
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, messages }),
    });
    if (!r.ok && env?.SESSION) await env.SESSION.put('diag:last_push_error', r.status + ' ' + (await r.text()).slice(0, 200) + ' @' + new Date().toISOString(), { expirationTtl: 86400 }).catch(() => {});
    return r.ok;
  } catch (_) { return false; }
}

// 推播(交接通知老闆/降級警示/延遲主回覆 fallback 用)。失敗只記診斷,不影響客人那條回覆。
async function linePush(token, to, text, env) {
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
    });
    if (!r.ok && env?.SESSION) {
      const detail = (await r.text()).slice(0, 200);
      await env.SESSION.put('diag:last_push_error', r.status + ' ' + detail + ' @' + new Date().toISOString(), { expirationTtl: 86400 });
    }
    return r.ok;
  } catch (e) {
    if (env?.SESSION) await env.SESSION.put('diag:last_push_error', 'EX ' + e.message + ' @' + new Date().toISOString(), { expirationTtl: 86400 }).catch(() => {});
    return false;
  }
}

// v6.1 追加:老闆推播合併 + 每日上限。同一輪的通知用空一行隔開合成 1 則;KV ownerpush:<台北日期> 計當天已推幾則,
// 到 OWNER_PUSH_DAILY_CAP(15)就不推,只寫 diag(diag:owner_push_capped=最近一次、ownerdrop:<日期>:<時間> 留全文 3 天,老闆事後可查)。沒有 KV 綁定時照舊直接推。
async function pushOwnerNotes(env, cfg, notes) {
  if (!Array.isArray(notes) || !notes.length || !cfg.ownerId || !cfg.lineToken) return false;
  const text = notes.join('\n\n').slice(0, 4900);
  if (env.SESSION) {
    const day = taipeiDay(), key = 'ownerpush:' + day;
    let n = 0;
    try { n = parseInt(await env.SESSION.get(key) || '0', 10) || 0; } catch (_) {}
    if (n >= OWNER_PUSH_DAILY_CAP) {
      const stamp = ' @' + new Date().toISOString();
      await env.SESSION.put('diag:owner_push_capped', '今日已推 ' + n + ' 則,略過 ' + notes.length + ' 項通知' + stamp, { expirationTtl: 86400 }).catch(() => {});
      await env.SESSION.put('ownerdrop:' + day + ':' + Date.now(), text, { expirationTtl: 3 * 86400 }).catch(() => {});
      return false;
    }
    await env.SESSION.put(key, String(n + 1), { expirationTtl: 36 * 3600 }).catch(() => {});
  }
  return linePush(cfg.lineToken, cfg.ownerId, text, env);
}

async function ensureTables(env) {
  if (!env.CRM) return;
  try {
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS pop_line_customers (user_id TEXT PRIMARY KEY, first_seen TEXT, last_seen TEXT, msg_count INTEGER DEFAULT 0)").run();
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS pop_line_convos (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, role TEXT, text TEXT, created_at TEXT DEFAULT (datetime('now')))").run();
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS seed_insights (id INTEGER PRIMARY KEY AUTOINCREMENT, insight TEXT, analyzed INTEGER, created_at TEXT)").run();
    // v5:延遲擬真 A/B 遙測(測試一/測試二判讀用)
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS pop_line_delivery (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, ab_group TEXT, emotion TEXT, path TEXT, delay_ms INTEGER DEFAULT 0, delivered_at TEXT, created_at TEXT DEFAULT (datetime('now')))").run();
    // v5.2:客戶筆記檔(城市/車型/行業/預算/grade;weather-touch 讀 city+care_last_sent_at;nurture 讀 grade+updated_at+nurtured_at)
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS customer_profiles (brand TEXT, sid TEXT, city TEXT, vehicle TEXT, industry TEXT, budget TEXT, grade TEXT, pain TEXT, intent_score REAL DEFAULT 0, care_last_sent_at INTEGER, nurtured_at INTEGER, nurture_count INTEGER DEFAULT 0, updated_at TEXT DEFAULT (datetime('now')), PRIMARY KEY(brand, sid))").run();
    // v5.3 選單逐鈕點擊台帳:官方 richmenu insight 有「整段期間不重複點擊<20人就不回任何數據」的隱私門檻,
    //      以目前 519 好友的量級幾乎永遠拿不到 → 第一手統計自己記,否則上線後對「哪格有效」全瞎。
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS pop_line_menu_taps (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, data TEXT, created_at TEXT DEFAULT (datetime('now')))").run();
    await env.CRM.prepare("ALTER TABLE customer_profiles ADD COLUMN nurtured_at INTEGER").run().catch(() => {});      // 舊表補欄位(已存在則無害忽略)
    await env.CRM.prepare("ALTER TABLE customer_profiles ADD COLUMN nurture_count INTEGER DEFAULT 0").run().catch(() => {});
  } catch (e) { console.error('[pop-line] tables', e.message); }
}

// v5.2 筆記超能力後端:把 [STATE] 客戶筆記 upsert 落庫(空欄不覆寫舊值);A 級意向即時推播老闆。永不阻斷回覆(全 try 包)。
async function saveProfile(env, cfg, uid, st, notes) {
  if (!env.CRM || !st || !uid || uid === 'unknown') return;
  try {
    const score = Math.max(0, Math.min(1, (Number(st.completion) || 0) / 100));
    const prev = await env.CRM.prepare("SELECT grade FROM customer_profiles WHERE brand='popmonster' AND sid=?").bind(uid).first().catch(() => null);
    await env.CRM.prepare("INSERT INTO customer_profiles (brand, sid, city, vehicle, industry, budget, grade, pain, intent_score, updated_at) VALUES ('popmonster',?,?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(brand, sid) DO UPDATE SET city=COALESCE(NULLIF(excluded.city,''),customer_profiles.city), vehicle=COALESCE(NULLIF(excluded.vehicle,''),customer_profiles.vehicle), industry=COALESCE(NULLIF(excluded.industry,''),customer_profiles.industry), budget=COALESCE(NULLIF(excluded.budget,''),customer_profiles.budget), grade=excluded.grade, pain=excluded.pain, intent_score=excluded.intent_score, updated_at=datetime('now')")
      .bind(uid, st.city || '', st.vehicle || '', st.industry || '', st.budget || '', st.grade || '', st.pain || '', score).run();
    // 只在「首次升到 A」通知老闆一次(prev 非 A → 現在 A),避免每則重複轟炸與吃 push 配額
    if (st.grade === 'A' && prev?.grade !== 'A' && cfg.ownerId) {
      const aNote = '🔥 A級意向客戶(泡泡怪獸)\n客人 ' + uid.slice(0, 8) + '…\n城市:' + (st.city || '未知') + ' 車型:' + (st.vehicle || '未知') + '\n痛點:' + (st.pain || '') + '\n下一步:' + (st.next || '');
      if (Array.isArray(notes)) notes.push(aNote); else await linePush(cfg.lineToken, cfg.ownerId, aNote, env);   // 有傳 notes 就併入該輪合併推播
    }
  } catch (e) { console.error('[pop-line] saveProfile', e.message); }
}

// 進化記憶載入:取最新沉澱的實戰心得,插入種子的「進化記憶」段
async function loadInsights(env) {
  if (!env.CRM) return '';
  try {
    const r = await env.CRM.prepare("SELECT insight FROM seed_insights ORDER BY id DESC LIMIT 3").all();
    const list = (r.results || []).map(x => x.insight).filter(Boolean);
    return list.length ? list.join('\n— — —\n') : '';
  } catch (_) { return ''; }
}

// v5.1 金句飛輪:讀 cdg-core 中央基因庫的跨品牌情緒承接金句(三品牌共同沉澱、越用越準)
async function loadGems(env) {
  if (!env.GENOME) return '';
  try {
    // v6.1.6(11-03 他指定「現在只做汽美」):只讀泡泡怪獸自己的金句,3q/土地公等舊業務線的句子一律不進腦子
    const r = await env.GENOME.prepare("SELECT gem FROM emotion_gems WHERE brand='popmonster' ORDER BY win_score DESC, id DESC LIMIT 3").all();
    const list = (r.results || []).map(x => x.gem).filter(Boolean);
    return list.length ? '\n\n【泡泡怪獸自家情緒承接金句(實戰驗證,優先化用進你的承接句)】\n· ' + list.join('\n· ') : '';
  } catch (_) { return ''; }
}

// 歡迎詞=第 1 句人格化揭露(v3 固定開場,逐字):加好友當下就亮 AI 身分,之後對話不再重複標示。
const WELCOME_MSG = AI_EMPLOYEE.disclosure_script + '\n\n先跟我說一句就好:你是店家要進貨,還是自己的車要用?\n\n🏪 開店的老闆 —— 下面選單右上角切到「店家老闆」那一頁,裡面有:\n・耗材批發的店家價(跟零售完全分開算)\n・限量體驗名額\n・一個城市只找一家的扶持方案\n・最下面那條「一個月少賺多少錢,我算給你看」——三個問題,不用留資料,先算再說\n\n🚗 自己的車要用 —— 拍張照傳給我,我幫你看該用哪一支;不想跟 AI 聊,按「找真人」就好。\n\n蝦皮賣場:' + SHOPEE + '\n免費教學與工具:https://popmonster.vip/go?src=line-free-first';

const WANTS_HUMAN_RE = /真人|人工|客服|專人|找人/;

// v6 高意向下單卡:B2C 回到蝦皮賣場(沒有對到具體 SKU 時用;對到 SKU 走 productFlex)
const SHOP_FLEX = () => ({
  type: 'flex', altText: '泡泡怪獸蝦皮賣場|品項與價格一次看',
  contents: {
    type: 'bubble',
    body: { type: 'box', layout: 'vertical', backgroundColor: '#0E0E10', paddingAll: '18px', spacing: 'sm', contents: [
      { type: 'text', text: 'POP MONSTER', color: '#caa64a', size: 'xs', weight: 'bold', letterSpacing: '2px' },
      { type: 'text', text: '蝦皮賣場', color: '#FFFFFF', size: 'xl', weight: 'bold' },
      { type: 'text', text: '價格表上的品項都在蝦皮賣場', color: '#9A9A9E', size: 'xs', wrap: true },
    ] },
    footer: { type: 'box', layout: 'vertical', backgroundColor: '#0E0E10', paddingAll: '14px', spacing: 'sm', contents: [
      { type: 'button', style: 'primary', color: '#caa64a', height: 'md', action: { type: 'uri', label: '前往蝦皮賣場', uri: SHOP_URL } },
      // src 必須是 /go 白名單內的值(line-connect 合法;'line' 不合法會被靜默丟掉)
      { type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: '官網教學與免費工具', uri: 'https://popmonster.vip/go?v=92d9874&src=line-connect' } },
    ] },
  },
});

// v6 產品卡(Flex):蝦皮主圖+品名+價格表定價+痛點+賣點+「蝦皮購買」+「看施工影片」。
// 學誼 2026-10-30:「要談到可以成交問產品時要丟對應產品的資訊和蝦皮連結」。價只用他定的價格表數字(CATALOG.p),不自己算。
function productBubble(sku) {
  const c = CATALOG[sku];
  if (!c) return null;
  const body = [{ type: 'text', text: c.n, weight: 'bold', size: 'lg', color: '#FFFFFF', wrap: true }];
  if (c.p) body.push({ type: 'text', text: 'NT$ ' + c.p, size: 'xl', weight: 'bold', color: '#caa64a' });
  if (c.pain) body.push({ type: 'text', text: c.pain, size: 'sm', color: '#D6D6DA', wrap: true });
  if (c.sp && c.sp.length) body.push({ type: 'box', layout: 'vertical', spacing: 'xs', margin: 'md', contents: c.sp.slice(0, 3).map((x) => ({ type: 'text', text: '・' + x, size: 'xs', color: '#9A9A9E', wrap: true })) });
  const footer = [{ type: 'button', style: 'primary', color: '#caa64a', height: 'sm', action: { type: 'uri', label: '蝦皮購買', uri: c.u || SHOP_URL } }];
  if (VIDEOS.lines[c.vl] && VIDEOS.lines[c.vl].length) footer.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'postback', label: '看施工影片', data: 'm=vid&l=' + c.vl, displayText: '我想看「' + c.n + '」的施工影片' } });
  else if (c.yt) footer.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: '看教學影片', uri: c.yt } });
  const b = {
    type: 'bubble', size: 'kilo',
    body: { type: 'box', layout: 'vertical', backgroundColor: '#0E0E10', paddingAll: '16px', spacing: 'sm', contents: body },
    footer: { type: 'box', layout: 'vertical', backgroundColor: '#0E0E10', paddingAll: '12px', spacing: 'sm', contents: footer },
  };
  if (c.img) b.hero = { type: 'image', url: c.img, size: 'full', aspectRatio: '1:1', aspectMode: 'cover', action: { type: 'uri', uri: c.u || SHOP_URL } };
  return b;
}
function productFlex(skus) {
  const bubbles = (skus || []).map(productBubble).filter(Boolean);
  if (!bubbles.length) return null;
  const names = skus.map((x) => CATALOG[x] && CATALOG[x].n).filter(Boolean).join('、');
  return { type: 'flex', altText: ('泡泡怪獸|' + names + ' 價格與蝦皮連結').slice(0, 400), contents: bubbles.length === 1 ? bubbles[0] : { type: 'carousel', contents: bubbles } };
}
// v6 影片訊息:自家一剪到底片(GitHub Pages 託管 mp4+預覽圖)。同一客人同一線 7 天只送一次(session 同壽命),送完改給 YouTube 合集一次;
// 沒自家片的線(洗車/輪圈/玻璃/皮革…)直接給合集。session.vids={line:[已送 id], 'yt:line':[1]}。
const VIDEO_ASK_RX = /(影片|教學|示範|實作|怎麼用|怎麼拍|怎麼擦|怎麼噴|怎麼洗|用法|看看|有沒有片|合集)/;
function videoMsgs(line, sess, askedVideo) {
  const seen = (sess.vids && typeof sess.vids === 'object') ? sess.vids : {};
  const list = VIDEOS.lines[line] || [];
  const next = list.find((v) => !(seen[line] || []).includes(v.id));
  const out = [];
  if (next) {
    seen[line] = [...(seen[line] || []), next.id]; sess.vids = seen;
    if (next.cap) out.push({ type: 'text', text: next.cap });
    out.push({ type: 'video', originalContentUrl: next.mp4, previewImageUrl: next.jpg, trackingId: ('v6-' + line + '-' + next.id).slice(0, 100) });
    return out;
  }
  const yt = VIDEOS.yt[line];
  if (askedVideo && yt && !seen['yt:' + line]) { seen['yt:' + line] = [1]; sess.vids = seen; return [{ type: 'text', text: '更多實作影片在這個合集,一支一支看:\n' + yt }]; }   // v6.1.1 合集只在明講要影片時給
  return [];
}

// v6.1 圖片訊息:客人傳照片 → 已讀+loading 60 秒 → Claude 視覺分析(車況/產品)→ 用 replyToken 一次送診斷(失敗才 push;不再先墊「收到照片」)
// v6.1 追加:同一個 webhook 批次、同一位客人的多個 image 事件合成一次處理——全部下載(最多 MAX_IMAGES_PER_TURN 張)、一次視覺請求、
//   第一張的 replyToken 一次 reply(失敗才 push 一次);其餘事件只 markAsRead,不另外回覆。單張照片就是 evs 長度 1 的特例。
const MAX_IMAGES_PER_TURN = 4;
async function handleImage(ev, env, cfg) { return handleImages([ev], env, cfg); }
// webhook 迴圈用:先讓 /go 三問式採集認領屬於它的照片(它有自己的回覆),剩下的才合併給視覺分析
async function handleImageBatch(evs, env, cfg) {
  const rest = [];
  for (const e of evs) { if (await maybeHandleGoIntake(e, env, cfg)) continue; rest.push(e); }
  if (rest.length) await handleImages(rest, env, cfg);
}
async function handleImages(evs, env, cfg) {
  const ev = evs[0];
  const uid = ev.source?.userId || 'unknown';
  const oneToOne = (ev.source?.type || 'user') === 'user';
  const issuedAt = eventIssuedAt(ev);
  const many = evs.length > 1;
  const batch = evs.slice(0, MAX_IMAGES_PER_TURN);
  await Promise.all(evs.map((e) => markAsRead(cfg.lineToken, e.message?.markAsReadToken)));
  if (oneToOne) await showLoading(uid, cfg.lineToken, 60);
  let reply = '';
  try {
    if (cfg.anthropicKey) {
      const imgs = (await Promise.all(batch.map(async (e) => {
        try {
          const imgR = await fetch(`https://api-data.line.me/v2/bot/message/${e.message.id}/content/preview`, { headers: { 'Authorization': 'Bearer ' + cfg.lineToken } });
          if (!imgR.ok) return null;
          const buf = new Uint8Array(await imgR.arrayBuffer());
          let bin = ''; const CH = 0x8000;
          for (let i = 0; i < buf.length; i += CH) bin += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
          return { type: 'image', source: { type: 'base64', media_type: ((imgR.headers.get('content-type') || 'image/jpeg').split(';')[0]) || 'image/jpeg', data: btoa(bin) } };
        } catch (_) { return null; }
      }))).filter(Boolean);
      if (imgs.length) {
        const ask = many
          ? '客人在 LINE 一次傳來好幾張照片(上面依序都附了;通常是他的車況:水痕/刮傷/鐵粉/氧化/漆面,或產品照/施工照)。當成同一次詢問一起看:先用一句話說出你在照片裡具體看到什麼(讓他知道你每張都真的看了),回覆開頭自然帶一句像「幾張我都看過了」的話,不要寫死張數,再依內功心法給一份合併的診斷與建議產品/下一步。' + (evs.length > MAX_IMAGES_PER_TURN ? '他傳的比一次能看的多,結尾順口請他挑最想處理的那幾張再傳。' : '') + '不確定的不要硬掰,可以問一個收斂式問題。繁中台灣口語,260字內,1~3個emoji,結尾帶下一步。'
          : '客人在 LINE 傳來這張照片(通常是他的車況:水痕/刮傷/鐵粉/氧化/漆面,或產品照/施工照)。先用一句話說出你在照片裡具體看到什麼(讓他知道你真的看了),再依內功心法給診斷與建議產品/下一步。不確定的不要硬掰,可以問一個收斂式問題。繁中台灣口語,220字內,1~3個emoji,結尾帶下一步。';
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': cfg.anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify(brainBody(MODELS.chat, many ? 600 : 500, {
            system: [{ type: 'text', text: buildSystemPrompt(''), cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: [...imgs, { type: 'text', text: ask }] }] })),
        });
        if (r.ok) { const d = await r.json(); reply = clean(d.content?.find(b => b.type === 'text')?.text || ''); }
      }
    }
  } catch (e) { console.error('[pop-line] vision', e.message); }
  if (!reply) reply = many
    ? '照片我都收到了📸 這幾張我請真人夥伴幫你看仔細。你先跟我說一下:車的狀況跟最想處理的問題是什麼?'
    : '照片我收到了📸 這張我請真人夥伴幫你看仔細。你先跟我說一下:車的狀況跟最想處理的問題是什麼?';
  const visionMsgs = [{ type: 'text', text: reply }];
  const visionFlex = productFlex(matchCatalog(reply));   // v6 診斷裡點到名的產品 → 順手附蝦皮卡(照片診斷就是最強成交時刻)
  if (visionFlex) visionMsgs.push(visionFlex);
  const imgPath = await replyThenPush(cfg, ev.replyToken, issuedAt, uid, visionMsgs, env);
  try {
    const kvKey = 'popline:' + uid;
    let sess = { hist: [], n: 0, ho: false, dc: true };
    if (env.SESSION) { const raw = await env.SESSION.get(kvKey); if (raw) { try { const p = JSON.parse(raw); if (p && Array.isArray(p.hist)) sess = p; } catch (_) {} } }
    sess.hist.push({ role: 'user', content: many ? '(一次傳了幾張照片)' : '(傳了一張照片)' }, { role: 'assistant', content: reply });
    sess.hist = sess.hist.slice(-20);
    sess.last_seen = Date.now();   // v6.1 追加:只傳照片的客人也算「剛來過」,下次打字才不會被誤判成隔 3 天回訪(sess.n 不動:照片不算一句話)
    if (env.SESSION) await env.SESSION.put(kvKey, JSON.stringify(sess), { expirationTtl: 7 * 24 * 3600 });
    if (env.CRM) {
      await env.CRM.prepare("INSERT INTO pop_line_convos (user_id, role, text) VALUES (?, 'user', '(照片)')").bind(uid).run().catch(() => {});
      await env.CRM.prepare("INSERT INTO pop_line_convos (user_id, role, text) VALUES (?, 'assistant', ?)").bind(uid, reply).run().catch(() => {});
      await env.CRM.prepare("INSERT INTO pop_line_delivery (user_id, ab_group, emotion, path, delay_ms) VALUES (?,?,?,?,?)").bind(uid, 'delay', '中性', 'image_' + imgPath, 0).run().catch(() => {});
    }
  } catch (_) {}
}

// ═══ v5.3 圖文選單 postback:選單即對話 ═══
// LINE 官方明文:用 replyToken 回覆(reply message)不計入月額度,只有 push/broadcast 才計費。
// 所以每顆鈕都走 postback → 合成一句「客人說的話」+ 本輪指令 → 原封走既有 text 管線,
// session/限流/墊場/大腦/[STATE]落庫/A級推播/nurture 飛輪全部自動生效,一行不用改。
// data 格式固定 m=<線>&b=<鈕>,方便日後在 D1 逐鈕統計(官方 richmenu insight 有「不重複點擊<20人不給數據」門檻,量級不夠,得自記)。
const MENU = {
  // ── 車主線 ──
  'm=car&b=pick': { direct: 'campick' },   // v6.1:不經大腦,reply 一則文字+三顆 quick reply(拍照/從相簿選/用打字描述);舊的問診指令搬到 describe
  'm=car&b=describe': { text: '我想知道我的車該用什麼產品,我用打字描述', rush: true,
    dir: '【本輪指令】客人從選單選了「我的車該用什麼」,並選擇用打字描述。先用一句話接住,然後一次只問一件事:先問他車現在最困擾的是什麼(水痕/鐵粉/漆面沒光/內裝),問完再依症狀推具體品項。不要一次丟一堆問題。' },
  'm=car&b=human': { text: '我想找真人', rush: true },
  // ── v6 直接回覆型(不經大腦;reply token 免費)──
  'm=car&b=price': { direct: 'pricelist' },
  'm=car&b=shopee': { direct: 'shopflex' },
  'm=car&b=howto': { direct: 'vidmenu' },   // v6:施工影片鈕改成 quick reply 選線,點了直接回自家片(不經大腦、reply 免費);舊的 text/dir 版本已由此取代
  // ── v6 歡迎包 quick reply 分流(data 與 data/pop-line/oa.json 的 quickReply 一致)──
  'm=wel&b=car': { text: '我是車主,自己的車要用', rush: true, dirKey: 'first_intro_car',
    profile: { industry: '車主', grade: 'C', pain: '', completion: 15, next: '問車況/最困擾的一件事' } },
  'm=wel&b=shop': { bindShop: true, text: '我是汽車美容店家', rush: true, dirKey: 'shop_line',
    profile: { industry: '汽美店家', grade: 'B', pain: '', completion: 30, next: '問城市/店型/最想解決的事' } },
  // ── 店家線(B2B,這條是主戰場)──
  'm=shop&b=audit': { bindShop: true, text: '幫我算一下我的店一個月少賺多少錢', rush: true, flow: 'shop_audit',
    profile: { industry: '汽美店家', grade: 'B', pain: '', completion: 40, next: '完成三題健檢' } },
  'm=shop&b=trial': { bindShop: true, text: '我想了解免繳費限量搶先體驗', rush: true,
    profile: { industry: '汽美店家', grade: 'B', pain: '', completion: 50, next: '確認名額資格轉真人' },
    dir: '【本輪指令】店家問限量搶先體驗名額。可以講的:這是共創店家名額(名額有限,但總共幾家負責人還沒定,**不要講任何家數**)、系統是月付 799 起不綁約、'
       + '上線後 30 天不合用全額退現金、每個月含一次客製微調,完整條件在 https://milk790-code.github.io/3q-hatchery-line-oa/pop-card-plan/ 。'
       + '**不要自己承諾「完全免費」或編任何優惠數字**——體驗名額的實際條件一律說「由負責人一對一跟你確認」。'
       + '本輪要問到兩件事:他的店在哪個城市、現在最想解決什麼。' },
  'm=shop&b=wholesale': { bindShop: true, text: '我想問耗材批發的店家價', rush: true,
    profile: { industry: '汽美店家', grade: 'B', pain: '想談進貨', completion: 50, next: '收品項+月用量+聯絡方式轉真人' },
    dir: '【本輪指令】店家問母料批發。**絕對不報任何批發價數字**(批發價目表尚未定版,報錯就出事),改成:一句話說明我們是母料直供、店家價與零售價分開,然後直接要三件事——「你想進哪幾支品項」「一個月大概用多少量」「方便聯絡的電話或 LINE」,說明負責人會一個工作天內把報價單給他。' },
  'm=shop&b=join': { bindShop: true, text: '我想了解城市限定的扶持方案', rush: true,
    profile: { industry: '汽美店家', grade: 'B', pain: '', completion: 55, next: '收店家登記資料' },
    dir: '【本輪指令】店家想了解城市限定扶持方案。用一句話說明我們一次只在一個城市找配合的店,'
       + '然後請他把鍵盤裡已經帶出來的三行(店名/城市/最想解決)填一填傳回來,說明填完負責人會親自看過再聯絡。'
       + '不要報任何價格,也不要承諾一定排得進去。不要再多問別的。' },
  // ── 分頁切換(richmenuswitch 也會送 postback;靜默記錄,不回話免得洗版)──
  'm=tab&b=shop': { silent: true, profile: { industry: '汽美店家', grade: 'B', pain: '', completion: 20, next: '看了店家專區' } },
  'm=tab&b=car': { silent: true },
};

// 健檢流三題(一次一題;答完給算帳+轉真人)。只用客人自己講的數字算,我方價格一律不報。
const SHOP_AUDIT_Q = [
  '你店裡一個月大概洗多少台車?',
  '現在用的藥水,施工完平均撐多久?客人有回來抱怨過嗎?',
  '如果只能先解決一件事,是進貨成本、客人不回頭、還是施工效率?',
];
const SHOP_AUDIT_CLOSE = '【本輪指令】三題健檢問完了。本輪要做三件事:①用他自己講過的數字幫他算一次帳(例如月洗幾台 × 回頭率差多少 = 一年少賺多少),**只准用他講過的數字,不准自己編任何數字,我方任何價格一律不報**;②針對他選的那個痛點給對應解法(進貨成本→母料直供;客人不回頭→POP CARD 回店系統,丟展示連結 https://popcard-saas-preview.milk790.workers.dev/s/jilin;施工效率→產品線搭配);③說負責人會親自看他的狀況再聊,問他方便的聯絡方式。講完就收尾,不要再問新問題。';

// 健檢流本輪指令(postback 之後的每一輪都帶著,直到問完)
function auditDirective(sess) {
  const f = sess.flow;
  if (!f || f.name !== 'shop_audit') return '';
  if (f.step >= SHOP_AUDIT_Q.length) return SHOP_AUDIT_CLOSE;
  return '【本輪指令】你正在幫這位汽美店家做「免費獲利健檢」,現在是第 ' + (f.step + 1) + ' 題(共 ' + SHOP_AUDIT_Q.length + ' 題)。先用一句話承接他剛才說的,然後**只問這一題**:「' + SHOP_AUDIT_Q[f.step] + '」。一次只問一題,不跳題不連問,不報任何我方價格數字。';
}

// 店家登記範本回傳偵測(選單的鍵盤會預填「店名:」三行)→ 直接推播老闆,不等 grade 升 A
const SHOP_JOIN_RE = /店名[:：]/;

// 選單點擊訊號落庫。刻意不走 saveProfile:那支的 grade/pain 是「每輪覆寫」語意(模型讀到什麼寫什麼),
// 點一下選單就套用會把已經升到 A 的客人降級、把已摸到的痛點洗成空字串。這裡只補 industry、grade 只升不降。
async function saveMenuSignal(env, uid, p) {
  if (!env.CRM || !uid || uid === 'unknown' || !p) return;
  try {
    const prev = await env.CRM.prepare("SELECT grade FROM customer_profiles WHERE brand='popmonster' AND sid=?").bind(uid).first().catch(() => null);
    if (prev?.grade === 'A' || prev?.grade === 'B') return;   // 已經有等級了就不動,交給對話流程判
    await env.CRM.prepare("INSERT INTO customer_profiles (brand, sid, industry, grade, intent_score, updated_at) VALUES ('popmonster',?,?,?,?,datetime('now')) ON CONFLICT(brand, sid) DO UPDATE SET industry=COALESCE(NULLIF(excluded.industry,''),customer_profiles.industry), grade=excluded.grade, updated_at=datetime('now')")
      .bind(uid, p.industry || '', p.grade || 'C', Math.max(0, Math.min(1, (Number(p.completion) || 0) / 100))).run();
  } catch (e) { console.error('[pop-line] saveMenuSignal', e.message); }
}

// v6.1 店家專屬選單:老闆按過店家專區任何一顆「內容鈕」→ 把店家版綁成他個人的選單。
// per-user rich menu 優先權高於全員預設,所以他之後每次打開 LINE 看到的就直接是店家版,
// 不用每次自己切分頁(車主完全不受影響,看到的還是車主版)。
// 只在「明確意圖」時綁:分頁切換只是逛逛不算,按下體驗/批發/扶持方案/健檢才算。
async function linkShopMenu(env, cfg, uid) {
  if (!cfg.lineToken || !uid || uid === 'unknown') return false;
  try {
    let rid = env.SESSION ? await env.SESSION.get('richmenu:pop-shop') : null;
    if (!rid) {
      // 走 alias 不寫死 menuId:選單改版一定會換 id(圖片不可替換,改版都是建新的),alias 才是穩定的錨
      const r = await fetch('https://api.line.me/v2/bot/richmenu/alias/pop-shop', { headers: { Authorization: 'Bearer ' + cfg.lineToken } });
      if (!r.ok) return false;
      rid = (await r.json()).richMenuId;
      await env.SESSION?.put('richmenu:pop-shop', rid, { expirationTtl: 3600 }).catch(() => {});   // 只快取 1 小時,免得綁到已刪的舊選單
    }
    const res = await fetch('https://api.line.me/v2/bot/user/' + uid + '/richmenu/' + rid, { method: 'POST', headers: { Authorization: 'Bearer ' + cfg.lineToken } });
    if (!res.ok) { await env.SESSION?.put('richmenu:pop-shop', '', { expirationTtl: 60 }).catch(() => {}); return false; }
    return true;
  } catch (_) { return false; }
}

// v6 讀/寫 session 的小工具(postback 直接回覆型要碰 vids/stk,不能把既有欄位洗掉)
async function loadSess(env, uid) {
  let sess = { hist: [], n: 0, ho: false, dc: false };
  if (!env.SESSION) return sess;
  try { const p = JSON.parse((await env.SESSION.get('popline:' + uid)) || 'null'); if (p && Array.isArray(p.hist)) sess = { ...p, hist: p.hist, n: p.n || 0, ho: !!p.ho, dc: !!p.dc }; } catch (_) {}
  return sess;
}
async function saveSess(env, uid, sess) {
  if (env.SESSION) await env.SESSION.put('popline:' + uid, JSON.stringify(sess), { expirationTtl: 7 * 24 * 3600 }).catch(() => {});
}

async function handlePostback(ev, env, cfg) {
  const uid = ev.source?.userId || 'unknown';
  const data = (ev.postback?.data || '').slice(0, 300);
  const m = MENU[data];
  if (env.CRM) await env.CRM.prepare("INSERT INTO pop_line_menu_taps (user_id, data) VALUES (?,?)").bind(uid, data).run().catch(() => {});
  if (m?.profile) await saveMenuSignal(env, uid, m.profile);
  // 連點兩下／LINE 重送 → 只處理第一次。用 D1 不用 KV:KV 是最終一致,秒內連點第二次還讀得到舊值,
  // 結果就是同一則回覆發兩次(2026-08-23 實機截圖抓到)。D1 強一致,插入後立刻算得準。(v6:移到影片鈕/直回鈕之前,它們也要去重)
  if (env.CRM) {
    const dup = await env.CRM.prepare("SELECT COUNT(*) n FROM pop_line_menu_taps WHERE user_id=? AND data=? AND created_at >= datetime('now','-12 seconds')").bind(uid, data).first().catch(() => null);
    if ((dup?.n || 0) > 1) return;
  }
  // v6 影片鈕(產品卡/歡迎包/選單都用同一格式 m=vid&l=<線>):reply token 直接回影片,不經大腦、不計費
  const vm = data.match(/^m=vid&l=([a-z_]{2,20})$/);
  if (vm) {
    const sess = await loadSess(env, uid);
    let msgs = videoMsgs(vm[1], sess, true);
    if (!msgs.length) msgs = [{ type: 'text', text: '這條線的影片你都看過了。想看哪一支產品的實作,直接跟我說名字,我再找給你。' }];
    await lineReplyMsgs(cfg.lineToken, ev.replyToken, msgs.slice(0, 5), env);
    await saveSess(env, uid, sess);
    return;
  }
  if (!m) return;
  if (m.direct) {   // v6 直接回覆型:價格表 / 蝦皮賣場卡 / 影片選線
    const msgs = m.direct === 'pricelist' ? PRICELIST_MSGS() : m.direct === 'vidmenu' ? [VIDEO_MENU_MSG()] : m.direct === 'campick' ? [CAMPICK_MSG()] : [SHOP_FLEX()];
    await lineReplyMsgs(cfg.lineToken, ev.replyToken, msgs, env);
    return;
  }
  if (m.bindShop) await linkShopMenu(env, cfg, uid);
  if (m.silent) {   // 分頁切換:只記錄不回話(切過去已經看到店家選單了,再發訊息是洗版)
    if (data === 'm=tab&b=shop' && env.CRM) {
      const seen = await env.CRM.prepare("SELECT COUNT(*) n FROM pop_line_menu_taps WHERE user_id=? AND data='m=tab&b=shop'").bind(uid).first().catch(() => null);
      if ((seen?.n || 0) <= 1) {   // 剛剛那筆就是第一次 → 打一次招呼,之後靜默
        await lineReply(cfg.lineToken, ev.replyToken, '店裡拋不亮的漆，不是難，是還沒用過泡泡怪獸。\n這頁是給開店的老闆：上面四格看方案和店家價。\n最下面那條「幫你算一個月少賺多少錢」是三個問題，答完我直接算給你看，不用留資料，先算再說。'   /* 2026-10-30 oa.json shop_hook_replies 逐字稿(店家鉤子框) */, env);
      }
    }
    return;
  }
  if (m.flow && env.SESSION) {   // 啟動多輪流程(健檢)
    const sess = await loadSess(env, uid);   // v6:保留 stk/vids/pc 等欄位
    sess.flow = { name: m.flow, step: 0 };
    await env.SESSION.put('popline:' + uid, JSON.stringify(sess), { expirationTtl: 7 * 24 * 3600 }).catch(() => {});
  }
  // 合成成一句「客人說的話」,走既有管線(displayText 已讓客人在聊天室看到自己說了什麼,對話感一致)
  const synth = { ...ev, type: 'message', message: { type: 'text', text: m.text } };
  const dir = m.dir || (m.dirKey && DIRECTIVES.turn[m.dirKey]) || '';   // v6:指令可由 DIRECTIVES(正本 brain-directives.json)供應
  return handleEvent(synth, env, cfg, { directive: dir, rush: !!m.rush, shop: !!m.bindShop });
}

async function handleEvent(ev, env, cfg, inject) {
  if (ev.type === 'follow') {   // v6 新好友第一時間:價格表圖 → 歡迎貼圖 → 介紹(含 AI 揭露)+分流 quick reply。reply token 免費,一次 ≤5 則
    const uid0 = ev.source?.userId || 'unknown';
    const stkWel = STICKERS['歡迎'], stkMsg = { type: 'sticker', packageId: stkWel.packageId, stickerId: stkWel.stickerId };
    // 歡迎包正本在 oa.json;沒載入時退回「價格表圖 → 貼圖 → 舊歡迎詞」,價格表永遠第一則
    let pack = WELCOME_PACK.length ? JSON.parse(JSON.stringify(WELCOME_PACK)) : [PRICELIST_MSGS()[0], stkMsg, { type: 'text', text: WELCOME_MSG }];
    if (WELCOME_PACK.length && pack.length < 5 && !pack.some((m) => m.type === 'sticker')) pack.splice(Math.min(1, pack.length), 0, stkMsg);
    pack = pack.slice(0, 5);
    let ok = await lineReplyMsgs(cfg.lineToken, ev.replyToken, pack, env);
    if (!ok) ok = await lineReplyMsgs(cfg.lineToken, ev.replyToken, withSticker(WELCOME_MSG, '歡迎'), env);   // 歡迎包被 LINE 拒(例如圖片網址暫時壞)→ 退回純文字,新好友不空手
    const sentPricelist = ok && pack.some((m) => m.type === 'image' && String(m.originalContentUrl || '').includes('pricelist'));
    if (env.SESSION) await env.SESSION.put('popline:' + uid0, JSON.stringify({ hist: [], n: 0, ho: false, dc: true, pl: sentPricelist, stk: { ln: 0, d: taipeiDay(), c: 1 } }), { expirationTtl: 7 * 24 * 3600 }).catch(() => {});
    if (sentPricelist && env.SESSION) await env.SESSION.put('pl:' + uid0 + ':' + taipeiDay().replace(/-/g, ''), '1', { expirationTtl: 36 * 3600 }).catch(() => {});
    if (env.CRM) { const now = new Date().toISOString(); await env.CRM.prepare("INSERT INTO pop_line_customers (user_id, first_seen, last_seen, msg_count) VALUES (?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET last_seen=?").bind(uid0, now, now, now).run().catch(() => {}); }
    return;
  }
  if (ev.type === 'videoPlayComplete') {   // v6 LINE 原生「影片看完」事件:落庫當成最強興趣訊號(trackingId=v6-<線>-<片>)
    const uid0 = ev.source?.userId || 'unknown', tid = (ev.videoPlayComplete?.trackingId || '').slice(0, 100);
    if (env.CRM && tid) await env.CRM.prepare("INSERT INTO pop_line_menu_taps (user_id, data) VALUES (?,?)").bind(uid0, 'vid:done:' + tid).run().catch(() => {});
    return;
  }
  if (ev.type === 'postback') return handlePostback(ev, env, cfg);
  if (ev.type !== 'message') return;
  if (await maybeHandleGoIntake(ev, env, cfg)) return;
  const mtype = ev.message?.type;
  if (mtype === 'image') return handleImage(ev, env, cfg);
  const uid = ev.source?.userId || 'unknown';
  const mrToken = ev.message?.markAsReadToken;
  let userMsg;
  let stickerIn = false;
  if (mtype === 'text') {
    userMsg = ev.message.text.slice(0, 1000);
  } else if (mtype === 'sticker') {
    userMsg = '(客人傳了一張貼圖給你,用一句輕鬆有溫度的話接住,順著目前話題繼續,不要問他貼圖是什麼意思)';
    stickerIn = true;
  } else if (['video', 'audio', 'file', 'location'].includes(mtype)) {
    await markAsRead(cfg.lineToken, mrToken);
    await lineReply(cfg.lineToken, ev.replyToken, '收到😊 這個我先記下來、請真人夥伴看。你先跟我說說你的需求或想處理的問題,我馬上幫你安排', env);
    if (env.CRM) await env.CRM.prepare("INSERT INTO pop_line_convos (user_id, role, text) VALUES (?, 'user', ?)").bind(uid, '(' + mtype + ')').run().catch(() => {});
    return;
  } else {
    return;
  }

  if (/^我是老闆$/.test(userMsg.trim()) && !cfg.ownerId) {
    await env.SESSION?.put('cfg:pop_owner', uid);
    await lineReply(cfg.lineToken, ev.replyToken, '已綁定老闆身分。以後客人成交意向我會推給你。', env);
    return;
  }

  // 每人每分鐘限流:真好友狂傳也擋得住,超過就罐頭回覆不打 AI(止血 Anthropic 帳單)
  if (env.SESSION && uid !== 'unknown') {
    const rlKey = 'rl:popline:' + uid + ':' + Math.floor(Date.now() / 60000);
    const rlN = parseInt(await env.SESSION.get(rlKey) || '0', 10);
    if (rlN >= 12) { await lineReply(cfg.lineToken, ev.replyToken, '訊息有點多,我先喘口氣,稍等一下再問我;急的話直接加真人。', env); return; }
    await env.SESSION.put(rlKey, String(rlN + 1), { expirationTtl: 120 }).catch(() => {});
  }

  // session:hist=對話、n=客人累計第幾句、ho=第10句檢查點已觸發、dc=已完成第1句揭露、pl=已送價格表、line='shop'=店家線、last_seen=上次說話時間(ms)
  const kvKey = 'popline:' + uid;
  let sess = { hist: [], n: 0, ho: false, dc: false };
  let reply = '';
  let firstContact = false, checkpoint = false, wantsHuman = false, degraded = false;
  let emo = '中性', ab = 'delay', quiet = false, isRush = false, stk = '', stateJson = null;
  // v6.1 旗標:ackScheduled=有排 ack job(預設只做已讀+loading,不碰 replyToken);
  //          ackTextScheduled / ackTextSent=ack「文字」已排 / 已送(只有 env.ACK_TEXT==='on' 才會發生,這時 replyToken 才算用掉)
  let ackScheduled = false, ackTextScheduled = false, ackTextSent = false;
  let prodSkus = [], vidLine = '';   // v6 模型標的產品卡 SKU / 影片線
  let directMsgs = null, plDup = false, plImgs = [], momentName = '', momentSlot = '', prevN = 0, prevSeen = 0;
  const issuedAt = eventIssuedAt(ev);
  const tokenAlive = !!ev.replyToken && (Date.now() - issuedAt) < REPLY_TOKEN_MAX_MS;
  try {
    if (env.SESSION) {
      const raw = await env.SESSION.get(kvKey);
      if (raw) {
        try {
          const p = JSON.parse(raw);
          if (Array.isArray(p)) sess = { hist: p, n: p.filter((m) => m.role === 'user').length, ho: false, dc: true };  // 舊版陣列 session:聊過=視同已揭露
          else if (p && Array.isArray(p.hist)) sess = { hist: p.hist, n: p.n || 0, ho: !!p.ho, dc: !!p.dc, flow: p.flow || null, stk: p.stk || null, vids: p.vids || null, pc: p.pc || null, pl: !!p.pl, line: p.line || null, last_seen: p.last_seen || 0 };
        } catch (_) {}
      }
    }
    prevN = sess.n; prevSeen = Number(sess.last_seen) || 0;
    sess.n += 1;
    sess.last_seen = Date.now();
    sess.hist.push({ role: 'user', content: userMsg });
    if (inject?.shop) sess.line = 'shop';

    firstContact = !sess.dc;
    wantsHuman = WANTS_HUMAN_RE.test(userMsg);
    checkpoint = !sess.ho && sess.n >= AI_EMPLOYEE.handoff_threshold;   // >=:錯過一輪也補觸發,ho 鎖一次性

    // ═══ v5 方案C 動態分類 ═══
    emo = stickerIn ? '閒聊' : guessEmotion(userMsg);
    quiet = inQuietHours(env);   // v6.1:深夜只影響 turn 指令與(ACK_TEXT on 時的)墊場文字,不再改遞送路徑
    isRush = emo === '趕時間' || (!stickerIn && LITE_RX.test(userMsg.trim())) || wantsHuman || !!inject?.rush;   // 趕時間/純事實短問/喊真人/點選單 → 秒回不延遲
    ab = (env.AB_TEST || 'on') === 'on' ? abGroup(uid) : 'delay';
    const oneToOne = (ev.source?.type || 'user') === 'user';

    // v6.1 價格表直回:關鍵字命中 → 大腦之前用 replyToken 直接回 PRICELIST_MSGS(不經大腦、不計 push);同一天(台北)只回一次圖,第二次走大腦+price_list 指令
    // v6.1 追加:第 10 句交接檢查點那輪、店家線、問「批發報價單」的一律交給大腦(帶 price_list / wholesale 指令);直回只留給一般車主
    const wholesaleRx = safeRx((DIRECTIVES.turn_rx || {}).wholesale) || WHOLESALE_RX;
    const wantsPriceList = PRICELIST_RX.test(userMsg) && !wantsHuman;
    const plToBrain = wantsPriceList && (checkpoint || sess.line === 'shop' || wholesaleRx.test(userMsg));
    if (plToBrain && checkpoint) {
      // 交接檢查點那輪:大腦做交接。今天收過價格表圖 → 疊「已收過」指令(plDup);還沒收過 → 這輪回覆最前面補圖(plImgs),不叫他往上滑找一張沒傳過的圖
      const plKey0 = 'pl:' + uid + ':' + taipeiDay().replace(/-/g, '');
      const seen0 = env.SESSION ? await env.SESSION.get(plKey0).catch(() => null) : null;
      if (seen0) plDup = true;
      else {
        plImgs = PRICELIST_MSGS().filter((m) => m.type === 'image');
        sess.pl = true;
        if (env.SESSION) await env.SESSION.put(plKey0, '1', { expirationTtl: 36 * 3600 }).catch(() => {});
      }
    }
    if (wantsPriceList && !plToBrain && ev.replyToken) {
      const plKey = 'pl:' + uid + ':' + taipeiDay().replace(/-/g, '');
      const seenToday = env.SESSION ? await env.SESSION.get(plKey).catch(() => null) : null;
      if (seenToday) plDup = true;
      else {
        directMsgs = PRICELIST_MSGS();
        if (firstContact) {   // 第一次對話:揭露句接在圖後面那則文字前(法遵不被價格表擠掉)
          const ti = directMsgs.findIndex((m) => m.type === 'text');
          if (ti >= 0) directMsgs[ti] = { ...directMsgs[ti], text: AI_EMPLOYEE.disclosure_script + '\n\n' + directMsgs[ti].text };
          sess.dc = true;
        }
        sess.pl = true;
        isRush = true;
        if (env.SESSION) await env.SESSION.put(plKey, '1', { expirationTtl: 36 * 3600 }).catch(() => {});
      }
    }

    // ① 已讀/loading(+ 只有 ACK_TEXT on 才送文字墊場)
    if (directMsgs) {
      await markAsRead(cfg.lineToken, mrToken);   // 直回:馬上已讀,圖片就是回覆
    } else if (!isRush && ab === 'delay' && ev.replyToken) {
      if ((env.ACK_TEXT || 'off') === 'on') {   // 舊行為(墊場文字用掉 replyToken,主回覆就得 push):預設關閉
        const recentAck = env.SESSION ? await env.SESSION.get('ack:' + uid) : null;   // 90 秒內不重複墊場,避免連發像機器
        if (!recentAck || firstContact || quiet) {
          let ackText = quiet ? QUIET_ACK : pickAck(emo);
          if (firstContact) { ackText = AI_EMPLOYEE.disclosure_script + '\n\n' + ackText; sess.dc = true; }
          if (mrToken && (env.READ_DELAY || 'on') === 'on') {
            ackTextScheduled = await scheduleDO(env, uid, { kind: 'ack', issuedAt, notBefore: Date.now() + pickReadDelayMs(env), token: cfg.lineToken, markAsReadToken: mrToken, replyToken: ev.replyToken, messages: [{ type: 'text', text: ackText }], chatId: oneToOne ? uid : null });
            ackScheduled = ackTextScheduled;
          }
          if (!ackTextScheduled) {
            await markAsRead(cfg.lineToken, mrToken);
            ackTextSent = await lineReply(cfg.lineToken, ev.replyToken, ackText, env);
            if (oneToOne) await showLoading(uid, cfg.lineToken, 20);
          }
          if ((ackTextSent || ackTextScheduled) && env.SESSION) await env.SESSION.put('ack:' + uid, '1', { expirationTtl: 90 }).catch(() => {});
        } else {
          await markAsRead(cfg.lineToken, mrToken);   // 已墊過場:直接標已讀
          if (oneToOne) await showLoading(uid, cfg.lineToken, 20);
        }
      } else {   // 預設:ack job 只做 markAsRead(8~22 秒已讀延遲)+ loading,replyToken 留給主回覆
        if (mrToken && (env.READ_DELAY || 'on') === 'on') {
          ackScheduled = await scheduleDO(env, uid, { kind: 'ack', issuedAt, notBefore: Date.now() + pickReadDelayMs(env), token: cfg.lineToken, markAsReadToken: mrToken, chatId: oneToOne ? uid : null, loadingSeconds: 30 });
        }
        if (!ackScheduled) {
          await markAsRead(cfg.lineToken, mrToken);
          if (oneToOne) await showLoading(uid, cfg.lineToken, 30);
        }
      }
    } else {
      await markAsRead(cfg.lineToken, mrToken);
      if (oneToOne) await showLoading(uid, cfg.lineToken, 15);   // 秒回路徑也給「輸入中」擬真
    }

    // ② 大腦(價格表直回時整段跳過)
    let turnDirective = '';
    if (directMsgs) {
      reply = (directMsgs.find((m) => m.type === 'text') || {}).text || '(價格表)';
    } else {
      if (checkpoint || wantsHuman) {
        turnDirective = '【本輪指令】' + (wantsHuman ? '客人要求真人。' : '對話已達第 ' + AI_EMPLOYEE.handoff_threshold + ' 句交接檢查點。')
          + '本輪回覆改為交接:把目前摸到的需求按「' + AI_EMPLOYEE.handoff_card_fields.join('、') + '」整理成一句話摘要(沒摸到的欄位寫「未知」,不准編),套用:「'
          + AI_EMPLOYEE.handoff_script.replace('{summary}', '(摘要)') + '」。保持原本聲腔,不加多餘客套。';
      } else if (SHOP_JOIN_RE.test(userMsg)) {   // v5.3 店家登記範本回傳:最高價值訊號,當場確認並收尾
        turnDirective = '【本輪指令】客人把店家登記資料填回來了。逐項複誦一次確認(只複誦他真的有填的,沒填的就問),說明負責人會親自看過再聯絡,並問他方便被聯絡的時段。不要報任何價格。';
      } else if (inject?.directive) {   // v5.3 選單 postback 的本輪指令
        turnDirective = inject.directive + (firstContact ? '\n(這是第一次對話,系統會自動加上 AI 店員揭露開場,你不要再自我介紹。)' : '');
      } else if (auditDirective(sess)) {   // v5.3 健檢流:按下健檢後的每一輪都帶著,直到三題問完
        turnDirective = auditDirective(sess);
      } else if (firstContact) {
        turnDirective = (DIRECTIVES.turn.first_intro || '【本輪指令】這是與這位客人的第一次對話,系統會自動在你的回覆前面加上 AI 店員揭露開場,所以你不要再自我介紹,直接接住對方這句話。') + (sess.pl ? '(價格表已在加好友時送給他了,不用再重發,直接接話。)' : '');
      }
      // v6 疊加指令(正本 brain-directives.json):產品詢問/成交訊號/異議腳本/症狀→推薦/售後,放第二 system block,主 block 快取不破
      // v6.1 再疊:價格表第二次、成交後、分享成果、回訪、猶豫收尾、價格對不上、批發、深夜。DIRECTIVES.turn 沒有該鍵就跳過;rx 以 DIRECTIVES.turn_rx 同名鍵優先
      {
        const extra = [];
        const T = DIRECTIVES.turn || {}, TR = DIRECTIVES.turn_rx || {};
        const trx = (name, def) => safeRx(TR[name]) || def;
        const hit = matchCatalog(userMsg);
        const aftersale = ['抱怨', '售後'].includes(emo);
        if (hit.length && T.product_question) {
          const skuLine = hit.map((x) => x + ' ' + CATALOG[x].n + (CATALOG[x].p ? '(' + CATALOG[x].p + ')' : '')).join('、');
          extra.push(T.product_question.replace('{skus}', skuLine).replace('{facts}', productFacts(hit)));
        }
        if (aftersale && T.aftersale) extra.push(T.aftersale);
        // 貼圖時刻:moment_rx 命中「成交/客人分享成果/客人道謝」(且在 allowed_moments 內)→ 疊對應指令,並把貼圖槽位設成 slot_map 對應的槽
        const pol = DIRECTIVES.stk || {}, mrx = pol.moment_rx || {};
        const allowedMoments = Array.isArray(pol.allowed_moments) ? pol.allowed_moments : null;
        for (const name of ['成交', '客人分享成果', '客人道謝']) {
          const rx = safeRx(mrx[name]);
          if (rx && rx.test(userMsg) && (!allowedMoments || allowedMoments.includes(name))) { momentName = name; break; }
        }
        if (momentName && pol.slot_map && pol.slot_map[momentName]) momentSlot = pol.slot_map[momentName];
        if (momentName === '成交' && !aftersale && T.ordered) extra.push(T.ordered);
        if (momentName === '客人分享成果' && !aftersale && T.result_share) extra.push(T.result_share);
        if (isPayIntent(userMsg) && momentName !== '成交' && T.pay_intent) extra.push(T.pay_intent);   // 剛說「下單了」那輪不是成交訊號
        for (const o of (DIRECTIVES.obj || [])) { const rx = safeRx(o.rx); if (rx && rx.test(userMsg)) { extra.push('【異議:' + o.name + '】' + o.script); break; } }
        for (const r of (DIRECTIVES.rec || [])) { const rx = safeRx(r.rx); if (rx && rx.test(userMsg)) { extra.push('【症狀→推薦】' + (r.skus || []).join('、') + (r.say ? ':' + r.say : '')); break; } }
        if (plDup && T.price_list) extra.push(T.price_list);   // 價格表今天已經傳過了 → 不回圖,走大腦(指令寫「已收過、往上滑」,所以只在真的收過時才疊)
        if (plImgs.length) extra.push('【本輪補充】這則回覆前面,系統會先附上價格表圖給他。你不用再傳圖,也不用叫他回頭翻聊天紀錄;文字直接接他的問題。');
        if (T.returning && prevN > 0 && prevSeen > 0 && (Date.now() - prevSeen) >= 3 * 86400000) extra.push(T.returning);   // 隔 3 天以上回來:每輪更新 last_seen,所以只疊一次
        if (T.hesitation_close && trx('hesitation_close', HESITATE_RX).test(userMsg)) extra.push(T.hesitation_close);
        if (T.price_mismatch && trx('price_mismatch', PRICE_MISMATCH_RX).test(userMsg)) extra.push(T.price_mismatch);
        // 批發:命中批發詞;或已是店家線(sess.line==='shop')且正在問價/想買。店家線每一輪都疊會讓「問施工」也被拉去報進貨,所以店家線要搭問價才疊
        if (T.wholesale && (trx('wholesale', WHOLESALE_RX).test(userMsg) || (sess.line === 'shop' && (isPayIntent(userMsg) || PRICELIST_RX.test(userMsg))))) extra.push(T.wholesale);
        if (quiet) extra.push('【本輪補充】現在是深夜,真人要早上九點後才看得到;你照常回答,別叫他等。');
        if (extra.length) turnDirective = (turnDirective ? turnDirective + '\n' : '') + extra.join('\n');
      }

      const [insights, gems] = await Promise.all([loadInsights(env), loadGems(env)]);   // 自家心得 + 跨品牌金句飛輪
      const sys = buildSystemPrompt((insights || '') + (gems || ''));
      const raw = await callBrain(sess.hist.slice(-12), env, cfg, sys, 600, turnDirective);
      const modelEmo = extractEmo(raw);
      if (modelEmo) emo = modelEmo;                      // 模型判斷優先,regex 兜底
      stk = extractStk(raw);
      if (STICKER_BLOCK_EMO.includes(emo)) stk = '';     // 雙保險:抱怨/售後絕不帶貼圖
      prodSkus = extractProd(raw); vidLine = extractVid(raw);   // v6 產品卡/影片(標籤在 clean 裡剝掉)
      stateJson = extractState(raw);                      // v5.2 客戶筆記(城市/車型/grade…),下面落庫
      if (stateJson && stateJson.line === 'B2B') sess.line = 'shop';   // v6.1 模型判成 B2B → 記成店家線
      reply = clean(raw);
      if (sess.flow?.name === 'shop_audit') {             // v5.3 健檢流推進一題;算帳那輪跑完就結束
        sess.flow.step = (sess.flow.step || 0) + 1;
        if (sess.flow.step > SHOP_AUDIT_Q.length) sess.flow = null;
      }
    }
  } catch (e) {
    console.error('[pop-line] brain pipeline', e.message);
    await env.SESSION?.put('dbg:last_error', e.message + ' @' + new Date().toISOString()).catch(() => {});
  }
  if (!reply) { reply = AI_EMPLOYEE.degraded_mode_script; degraded = true; }   // 降級不裝死:固定話術+下面推播老闆
  if (firstContact && !directMsgs && !ackTextSent && !ackTextScheduled) { reply = AI_EMPLOYEE.disclosure_script + '\n\n' + reply; sess.dc = true; }   // 揭露沒搭上墊場文字就搭主回覆(預設就是這條)
  if (checkpoint && !degraded && !directMsgs) sess.ho = true;   // 直回價格表那輪不算交接(v6.1 追加:本來就不該走到,雙保險)

  // ③ 主回覆遞送(v6.1 reply-first):reply token 先行、push 只當備援
  //    rush/instant/降級=馬上 reply;其餘=DO 延遲(10~35 秒,notBefore≤issuedAt+45s),alarm 時 50 秒內用 reply、非 2xx 才 push
  //    主回覆=messages 陣列(文字+情緒貼圖+產品卡),同一次送出只計 1 則
  let mainMsgs = directMsgs || [{ type: 'text', text: reply }];
  if (!directMsgs && !degraded) {
    // 貼圖:命中時刻(成交/道謝/分享成果)以 slot_map 的槽位為準,否則用模型標的 [STK];兩者都要過頻率閘
    let slot = (momentSlot && STICKERS[momentSlot]) ? momentSlot : stk;
    if (STICKER_BLOCK_EMO.includes(emo)) slot = '';   // 雙保險:抱怨/售後絕不帶貼圖
    if (slot && STICKERS[slot] && stickerGate(sess, emo)) { const s = STICKERS[slot]; mainMsgs.push({ type: 'sticker', packageId: s.packageId, stickerId: s.stickerId }); }   // v6 限流
  }
  if (!directMsgs && !degraded && !STICKER_BLOCK_EMO.includes(emo)) {
    // v6 產品卡:模型標 [PROD] 優先,否則客人的話命中別名;同一 SKU 3 輪內不重發;一次最多 2 支。「成交後」那輪不再推卡
    if (momentName !== '成交') {
      const pc = (sess.pc && typeof sess.pc === 'object') ? sess.pc : {};
      const want = (prodSkus.length ? prodSkus : matchCatalog(userMsg)).filter((x) => !(pc[x] != null && (sess.n - pc[x]) < 3)).slice(0, 2);
      const flex = want.length ? productFlex(want) : null;
      if (flex) { mainMsgs.push(flex); for (const x of want) pc[x] = sess.n; sess.pc = pc; }
      else if (isPayIntent(userMsg)) mainMsgs.push(SHOP_FLEX());
    }
    // v6 影片:模型標 [VID] 或命中影片時機;同一線 7 天一次;總則數不超過 5
    // v6.1.3 影片線以命中的產品為準(11-03 真機:問「酸洗」送出拋光片);產品線沒自家片就只給該線合集(且要客人問影片)
    const hitForVid = prodSkus.length ? prodSkus : matchCatalog(userMsg);
    const prodLine = hitForVid.map((x) => CATALOG[x] && CATALOG[x].vl).find((l) => l && l !== 'none' && (VIDEOS.lines[l] || VIDEOS.yt[l])) || '';
    const line = prodLine || vidLine || matchVideoLine(userMsg);
    if (line) for (const vmsg of videoMsgs(line, sess, VIDEO_ASK_RX.test(userMsg || ''))) if (mainMsgs.length < 5) mainMsgs.push(vmsg);
  }
  if (plImgs.length) { mainMsgs = [...plImgs, ...mainMsgs]; while (mainMsgs.length > 5) mainMsgs.pop(); }   // 交接檢查點補價格表圖:同一次 reply、圖在最前面、總則數 ≤5(從尾端砍貼圖/影片,文字保留)
  const ackDone = ackTextSent || ackTextScheduled;   // v6.1:ack「文字」已用掉 replyToken(預設 false)
  let path = 'reply_instant', delayMs = 0;
  const sendNow = async () => {
    if (ackDone || !tokenAlive) { await linePushMsgs(cfg.lineToken, uid, mainMsgs, env); return ackDone ? 'push_now' : 'push_stale'; }
    if (await lineReplyMsgs(cfg.lineToken, ev.replyToken, mainMsgs, env)) return 'reply_instant';
    await linePushMsgs(cfg.lineToken, uid, mainMsgs, env);
    return 'push_fallback';
  };
  if (degraded || isRush || ab === 'instant') {
    path = await sendNow();
  } else {
    delayMs = pickDelayMs(env, emo);   // v5.1 情緒→秒數映射(v6.1:多數 10~35 秒)
    const notBefore = Math.min(Date.now() + delayMs, issuedAt + REPLY_SOFT_CAP_MS);
    const job = { kind: 'main', to: uid, token: cfg.lineToken, messages: mainMsgs, notBefore, issuedAt };
    if (!ackDone && tokenAlive) job.replyToken = ev.replyToken;
    if (await scheduleDO(env, uid, job)) { path = job.replyToken ? 'reply_delayed' : 'push_delayed'; delayMs = Math.max(0, notBefore - Date.now()); }
    else { path = await sendNow(); delayMs = 0; }   // 沒有 DO:馬上 reply,不拿 push 墊檔
  }

  const ownerNotes = [];   // v6.1 追加:同一輪要通知老闆的事(交接/降級/店家登記/首次升 A)先收集,結尾合併成 1 則 push
  try {
    if (((checkpoint && !directMsgs) || wantsHuman) && !degraded && cfg.ownerId) {   // 老闆交接包
      ownerNotes.push('🤝 AI 店員交接' + (wantsHuman ? '(客人喊真人)' : '(第' + AI_EMPLOYEE.handoff_threshold + '句檢查點)') + '\n客人 ' + uid.slice(0, 8) + '…\n情緒:' + emo + '\n\n' + reply);
    }
    if (degraded && cfg.ownerId) {
      ownerNotes.push('⚠ AI 降級回覆(大腦無回應),已向客人承諾真人會回,記得接:\n客人 ' + uid.slice(0, 8) + '…:' + userMsg.slice(0, 120));
    }
    // v5.3 店家登記表回傳=全站最高價值訊號,不等 grade 升 A,當場推老闆(這是「回覆端閉環」的觸發點)
    if (SHOP_JOIN_RE.test(userMsg) && cfg.ownerId) {
      ownerNotes.push('🏪 有店家登記了(泡泡怪獸 LINE 店家專區)\n客人 ' + uid.slice(0, 8) + '…\n\n' + userMsg.slice(0, 300) + '\n\n→ 這是熱線索,今天內親自回。');
    }
    sess.hist.push({ role: 'assistant', content: reply });
    sess.hist = sess.hist.slice(-20);
    if (env.SESSION) await env.SESSION.put(kvKey, JSON.stringify(sess), { expirationTtl: 7 * 24 * 3600 });
    if (env.CRM) {
      const now = new Date().toISOString();
      await env.CRM.prepare("INSERT INTO pop_line_customers (user_id, first_seen, last_seen, msg_count) VALUES (?,?,?,1) ON CONFLICT(user_id) DO UPDATE SET last_seen=?, msg_count=msg_count+1").bind(uid, now, now, now).run().catch(() => {});
      await env.CRM.prepare("INSERT INTO pop_line_convos (user_id, role, text) VALUES (?, 'user', ?)").bind(uid, userMsg).run().catch(() => {});
      await env.CRM.prepare("INSERT INTO pop_line_convos (user_id, role, text) VALUES (?, 'assistant', ?)").bind(uid, reply).run().catch(() => {});
      await env.CRM.prepare("INSERT INTO pop_line_delivery (user_id, ab_group, emotion, path, delay_ms) VALUES (?,?,?,?,?)").bind(uid, ab, emo, path, delayMs).run().catch(() => {});
      await saveProfile(env, cfg, uid, stateJson, ownerNotes);   // v5.2 筆記超能力:客戶筆記落庫 + A 級通知老闆(v6.1 追加:收進 ownerNotes 一起推)
    }
  } catch (e) { console.error('[pop-line] post-reply log', e.message); }
  await pushOwnerNotes(env, cfg, ownerNotes);
}

// ═══ Reflexion 自我進化:看真實對話逐字稿 → 自省 → 沉澱實戰心得 → 餵回種子 ═══
async function handleEvolve(env, cfg, url) {
  if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
  await ensureTables(env);
  if (!env.CRM) return new Response(JSON.stringify({ ok: false, note: '無 D1' }), { headers: { 'Content-Type': 'application/json' } });
  const rows = await env.CRM.prepare("SELECT role, text FROM pop_line_convos ORDER BY id DESC LIMIT 60").all();
  const convos = (rows.results || []).reverse();
  if (convos.length < 4) {
    return new Response(JSON.stringify({ ok: true, evolved: false, note: '對話數據不足,先累積(<4)', count: convos.length }), { headers: { 'Content-Type': 'application/json' } });
  }
  const transcript = convos.map(c => (c.role === 'user' ? '客人' : 'AI') + ': ' + c.text).join('\n');
  const reflectPrompt = `你是頂尖銷售教練,正在訓練一個汽車美容耗材的成交 AI。以下是它最近的真實對話逐字稿。像教練看比賽錄影一樣,找出可複製的實戰心得:
① 哪些回覆有效推進成交、或讓客人更投入?為什麼?
② 哪些回覆讓客人冷掉、句點、流失?該怎麼改?
③ 反覆出現的問題,最好的標準答法是什麼?
④ 情緒承接(先共感再推進)有沒有做到位?哪句做得最好/最差?
輸出 4-6 條精煉「實戰心得」,每條一句話、具體可直接照做,繁中。只輸出心得清單,不要前言客套。
最後,若逐字稿裡有「情緒承接做得特別好、跨品牌通用」的句型,另外提煉 0~2 句「情緒承接金句」,每句獨立一行、以「GEM:」開頭(沒有就不寫)。

逐字稿:
${transcript}`;
  const insight = (await callBrain([{ role: 'user', content: reflectPrompt }], env, cfg, '你是嚴格、務實、只講重點的銷售教練。', 700)).trim();
  let gemsSaved = 0;
  if (insight) {
    await env.CRM.prepare("INSERT INTO seed_insights (insight, analyzed, created_at) VALUES (?, ?, datetime('now'))").bind(insight, convos.length).run().catch(() => {});
    // v5.1 金句飛輪:GEM: 開頭的行寫進 cdg-core 中央基因庫,三品牌共用
    if (env.GENOME) {
      for (const line of insight.split('\n')) {
        const g = line.match(/^GEM[:：]\s*(.{4,120})/);
        if (g) { await env.GENOME.prepare("INSERT INTO emotion_gems (brand, gem) VALUES ('popmonster', ?)").bind(g[1].trim()).run().then(() => { gemsSaved++; }).catch(() => {}); }
      }
    }
  }
  return new Response(JSON.stringify({ ok: true, evolved: !!insight, analyzed: convos.length, gems_saved: gemsSaved, insight }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

// ═══ A 級意向自動跟進飛輪:A 級但 24h 沒動靜 → 用車型/痛點生成個人化「主動追」訊息 ═══
// 安全:預設 dry-run(列出會發給誰+預覽,不送);加 &go=1 才真的推。每次最多 20 位;同一人 3 天內不重複追。
// 上線後可由 cron 或外部排程每天打 /admin/nurture?key=&go=1;先手動 dry-run 看話術再開 go。
async function handleNurture(env, cfg, url) {
  if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
  await ensureTables(env);
  if (!env.CRM) return new Response(JSON.stringify({ ok: false, note: '無 D1' }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  if (!cfg.lineToken) return new Response(JSON.stringify({ ok: false, note: '無 LINE token' }), { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  const go = url.searchParams.get('go') === '1';
  const reNurtureFloor = Date.now() - 3 * 864e5;   // 同一人 3 天內不重複追
  // 上限:同一人最多追 2 次(避免長期不回的客人被無限追);每批最多 10 位(控 AI 成本與逾時)
  const rows = (await env.CRM.prepare("SELECT sid, city, vehicle, industry, budget, pain FROM customer_profiles WHERE brand='popmonster' AND grade='A' AND updated_at <= datetime('now','-24 hours') AND (nurtured_at IS NULL OR nurtured_at < ?) AND COALESCE(nurture_count,0) < 2 LIMIT 10").bind(reNurtureFloor).all()).results || [];
  const out = [];
  for (const r of rows) {
    const prompt = `這是一位 A 級高意向客戶,大約一天前跟你聊到一半就沒下文了。他的筆記:車型/案型「${r.vehicle || '未記'}」,最在意「${r.pain || '未記'}」${r.city ? ',在' + r.city : ''}${r.budget ? ',預算感 ' + r.budget : ''}。請寫一則「主動追」的 LINE 訊息:自然喚起他上次在意的重點(叫得出他的車型跟痛點,讓他覺得你記得他),不催不逼,給一個低門檻的下一步(到蝦皮賣場看一眼 ${SHOPEE},或直接回你一句)。繁中台灣口語,120 字內,1~2 個 emoji,不要像罐頭、不要「親愛的顧客」。只輸出那則訊息本身,不要任何標籤。`;
    let text = '';
    try { text = clean(await callBrain([{ role: 'user', content: prompt }], env, cfg, buildSystemPrompt(''), 300)); } catch (_) {}
    if (!text) continue;
    if (go) {
      const ok = await linePush(cfg.lineToken, r.sid, text, env);
      if (ok) await env.CRM.prepare("UPDATE customer_profiles SET nurtured_at=?, nurture_count=COALESCE(nurture_count,0)+1 WHERE brand='popmonster' AND sid=?").bind(Date.now(), r.sid).run().catch(() => {});
      out.push({ sid: r.sid.slice(0, 8) + '…', sent: ok, text });
    } else {
      out.push({ sid: r.sid.slice(0, 8) + '…', vehicle: r.vehicle || '', pain: r.pain || '', preview: text });
    }
  }
  return new Response(JSON.stringify({ ok: true, mode: go ? 'sent' : 'dry-run(加 &go=1 才真的發)', count: out.length, leads: out }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

const SETUP_HTML = (done) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>泡泡怪獸 LINE bot 設定</title>
<body style="font-family:system-ui;max-width:520px;margin:30px auto;padding:0 16px;background:#0c0f14;color:#e8edf5">
<h2>泡泡怪獸 LINE 成交 bot 設定</h2>
${done ? '<p style="color:#06c755">✅ 已設定完成。要重設就重新填。</p>' : ''}
<form method=POST>
<p>LINE Channel Secret<br><input name=line_secret style="width:100%;padding:9px" autocomplete=off></p>
<p>LINE Channel Access Token<br><input name=line_token style="width:100%;padding:9px" autocomplete=off></p>
<p>Anthropic API Key(選填,留空用免費 70B)<br><input name=anthropic style="width:100%;padding:9px" autocomplete=off></p>
<button style="background:#caa64a;border:0;padding:10px 20px;font-weight:700;border-radius:8px">儲存並啟用</button>
</form><p style="color:#67748a;font-size:12px">儲存後自動設定 LINE webhook。再到 LINE 對 bot 說「我是老闆」綁定你的身分。</p></body>`;

async function handleSetup(req, env, url) {
  if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
  if (req.method === 'POST') {
    const f = await req.formData();
    // 防呆:鑰匙類值一律不含空白,自動清除貼上時夾帶的空格/換行(斷行貼上也能自動修復)
    const strip = (v) => (v || '').replace(/\s+/g, '');
    const sec = strip(f.get('line_secret')), tok = strip(f.get('line_token')), ak = strip(f.get('anthropic'));
    if (sec) await env.SESSION.put('cfg:pop_line_secret', sec);
    if (tok) await env.SESSION.put('cfg:pop_line_token', tok);
    if (ak) await env.SESSION.put('cfg:pop_anthropic', ak);
    if (tok) {
      const hookUrl = url.origin + '/webhook';
      await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', {
        method: 'PUT', headers: { 'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: hookUrl }),
      }).catch(() => {});
    }
    return new Response(SETUP_HTML(true), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return new Response(SETUP_HTML(false), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export default {
  async fetch(request, env, ctx) {
    SETUP_KEY = env.SETUP_KEY || crypto.randomUUID();
    const url = new URL(request.url);
    if (url.pathname === '/go-intake-health') return goIntakeHealthResponse();
    if (url.pathname === '/admin/go-funnel' || url.pathname === '/admin/go-funnel/delivered') return handleGoFunnelAdmin(request, env, env.SESSION);
    if (url.pathname === '/setup') return handleSetup(request, env, url);
    // v6 imagemap 尺寸代理:LINE imagemap 要 baseUrl/{240,300,460,700,1040} 無副檔名且回 image/jpeg;GitHub Pages 對無副檔名檔回 octet-stream,這裡轉一手
    if (url.pathname.startsWith('/img/pricelist/')) {
      const w = url.pathname.split('/').pop();
      if (!['240', '300', '460', '700', '1040'].includes(w)) return new Response('not found', { status: 404 });
      const r = await fetch(ASSET_BASE + 'pricelist-1028-map/' + w, { cf: { cacheTtl: 86400, cacheEverything: true } });
      if (!r.ok) return new Response('upstream ' + r.status, { status: 502 });
      return new Response(r.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
    }
    // v6 目錄/產品卡/歡迎包自檢(不經 LINE):/admin/catalog、/admin/card?sku=A005、/admin/welcome(&test=1 推給老闆本人看真實排版,計 1 則 push)
    if (url.pathname === '/admin/catalog') {
      if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
      return new Response(JSON.stringify({ seed: SEED_VER, products: Object.keys(CATALOG).length, videos: VIDEOS, welcome: WELCOME_PACK.length, directives: Object.keys(DIRECTIVES.turn), catalog: CATALOG }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    if (url.pathname === '/admin/card') {
      if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
      const q = url.searchParams.get('sku') || url.searchParams.get('q') || '';
      const skus = CATALOG[q.toUpperCase()] ? [q.toUpperCase()] : matchCatalog(q);
      return new Response(JSON.stringify({ q, skus, flex: productFlex(skus), video_line: matchVideoLine(q) }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    if (url.pathname === '/admin/welcome') {
      if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
      const cfg = await getCfg(env);
      if (url.searchParams.get('test') === '1') {
        if (!cfg.ownerId || !cfg.lineToken) return new Response(JSON.stringify({ error: '尚未綁定老闆或無 token' }), { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
        const ok = await linePushMsgs(cfg.lineToken, cfg.ownerId, (WELCOME_PACK.length ? WELCOME_PACK : withSticker(WELCOME_MSG, '歡迎')).slice(0, 5), env);
        return new Response(JSON.stringify({ test_sent: ok, note: ok ? '歡迎包已推到你自己的 LINE' : '失敗,看 diag:last_push_error' }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
      }
      return new Response(JSON.stringify({ count: WELCOME_PACK.length, messages: WELCOME_PACK }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    if (url.pathname === '/admin/evolve') { const cfg = await getCfg(env); return handleEvolve(env, cfg, url); }
    if (url.pathname === '/admin/nurture') { const cfg = await getCfg(env); return handleNurture(env, cfg, url); }   // A級自動跟進飛輪(dry-run 預設,&go=1 才發)
    // 大腦直測:不經 LINE,直接呼叫 callBrain 看回什麼/炸哪層
    if (url.pathname === '/admin/selftest') {
      if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
      const cfg = await getCfg(env);
      const q = url.searchParams.get('q') || '鍍膜劑哪罐好用';
      const t0 = Date.now();
      const out = { ai: cfg.anthropicKey ? MODELS.chat : 'workers-ai-70b' };
      try {
        const raw = await callBrain([{ role: 'user', content: q }], env, cfg, buildSystemPrompt(''), 400);
        out.ok = !!raw; out.ms = Date.now() - t0; out.emotion = extractEmo(raw) || '(未標)'; out.reply_preview = (clean(raw) || '(空)').slice(0, 300);
      } catch (e) { out.ok = false; out.ms = Date.now() - t0; out.error = e.message; }
      const [da, d7, de] = await Promise.all([env.SESSION?.get('dbg:anthropic'), env.SESSION?.get('dbg:ai70b'), env.SESSION?.get('dbg:last_error')]);
      out.dbg = { anthropic: da || null, ai70b: d7 || null, last_error: de || null };
      return new Response(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    // 一鍵群發:不帶 go=安全預覽;&go=1 正式對全部好友發送(不可收回)
    if (url.pathname === '/admin/broadcast') {
      if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
      const cfg = await getCfg(env);
      if (!cfg.lineToken) return new Response('no token', { status: 503 });
      if (url.searchParams.get('test') === '1') {   // 真預覽:只發給老闆本人的 LINE
        if (!cfg.ownerId) return new Response(JSON.stringify({ error: '尚未綁定老闆(對 bot 說「我是老闆」)' }), { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
        const r = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST', headers: { 'Authorization': 'Bearer ' + cfg.lineToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: cfg.ownerId, messages: BROADCAST_PRESET }),
        });
        return new Response(JSON.stringify({ test_sent: r.ok, status: r.status, note: '已發到你自己的 LINE(只有你收到)。看排版滿意,網址改 &go=1 正式群發。' }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
      }
      if (url.searchParams.get('go') !== '1') {
        return new Response(JSON.stringify({ preview: true, note: '加 &test=1 先發給自己看真實排版;確認後加 &go=1 正式群發(全部好友、不可收回)', messages: BROADCAST_PRESET }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
      }
      const r = await fetch('https://api.line.me/v2/bot/message/broadcast', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + cfg.lineToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: BROADCAST_PRESET }),
      });
      const detail = (await r.text()).slice(0, 300);
      return new Response(JSON.stringify({ sent: r.ok, status: r.status, detail }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    // 診斷端點:webhook 指向/官方實測/bot 身分/token 活性,一次看清(&set=1 順便把 endpoint 指回本 worker)
    if (url.pathname === '/admin/webhook') {
      if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
      const cfg = await getCfg(env);
      if (!cfg.lineToken) return new Response(JSON.stringify({ error: 'no token in KV' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      const H = { 'Authorization': 'Bearer ' + cfg.lineToken };
      const HJ = { ...H, 'Content-Type': 'application/json' };
      const out = { tokenLen: cfg.lineToken.length, secretLen: cfg.lineSecret.length };
      try {
        if (url.searchParams.get('set') === '1') {
          const p = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', { method: 'PUT', headers: HJ, body: JSON.stringify({ endpoint: url.origin + '/webhook' }) });
          out.put = { status: p.status, body: await p.text() };
        }
        const g = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', { headers: H });
        out.endpoint = await g.json().catch(() => ({ httpStatus: g.status }));
        const t = await fetch('https://api.line.me/v2/bot/channel/webhook/test', { method: 'POST', headers: HJ, body: '{}' });
        out.test = await t.json().catch(() => ({ httpStatus: t.status }));
        const b = await fetch('https://api.line.me/v2/bot/info', { headers: H });
        out.bot = b.ok ? await b.json() : { httpStatus: b.status, note: b.status === 401 ? 'token 失效(可能被 reissue 過)' : 'api error' };
      } catch (e) { out.error = e.message; }
      return new Response(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    // 診斷端點:不經 LINE,直接測 AI 腦鏈路(loadInsights→prompt→callBrain→clean)
    if (url.pathname === '/admin/chat') {
      if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
      const cfg = await getCfg(env);
      const q = url.searchParams.get('q') || '鍍膜劑哪罐好用';
      const t0 = Date.now();
      let reply = '', emoOut = '', err = null;
      try {
        const insights = await loadInsights(env);
        const raw = await callBrain([{ role: 'user', content: q }], env, cfg, buildSystemPrompt(insights));
        emoOut = extractEmo(raw); reply = clean(raw);
      } catch (e) { err = e.message; }
      return new Response(JSON.stringify({ ok: !!reply, ms: Date.now() - t0, brain: cfg.anthropicKey ? 'claude(keyLen=' + cfg.anthropicKey.length + ')' : 'workers-ai-70b', emotion: emoOut, reply, err }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    // v5.3 選單成效:逐鈕點擊數與不重複人數(官方 insight 有 <20 人不給數據的門檻,這支是第一手台帳)
    if (url.pathname === '/admin/menu-taps') {
      if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
      if (!env.CRM) return new Response(JSON.stringify({ ok: false, note: '無 D1' }), { headers: { 'Content-Type': 'application/json' } });
      const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') || '30', 10)));
      const r = await env.CRM.prepare("SELECT data, COUNT(*) taps, COUNT(DISTINCT user_id) people FROM pop_line_menu_taps WHERE created_at >= datetime('now','-' || ? || ' days') GROUP BY data ORDER BY taps DESC").bind(days).all().catch(() => null);
      const j = await env.CRM.prepare("SELECT COUNT(*) n FROM pop_line_convos WHERE role='user' AND text LIKE '%店名%'").first().catch(() => null);
      return new Response(JSON.stringify({ ok: true, days, buttons: r?.results || [], shop_registrations: j?.n || 0 }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    if (url.pathname === '/health') {
      const cfg = await getCfg(env);
      let insights = 0, deliveries = 0;
      if (env.CRM) {
        try { const r = await env.CRM.prepare("SELECT COUNT(*) n FROM seed_insights").first(); insights = r?.n || 0; } catch (_) {}
        try { const r = await env.CRM.prepare("SELECT COUNT(*) n FROM pop_line_delivery").first(); deliveries = r?.n || 0; } catch (_) {}
      }
      const [lp, lb, lo] = await Promise.all([env.SESSION?.get('dbg:last_post'), env.SESSION?.get('dbg:last_badsig'), env.SESSION?.get('dbg:last_oksig')]);
      return new Response(JSON.stringify({ ok: true, worker: 'pop-line-oa', seed: SEED_VER, ai_employee: AI_EMPLOYEE.display_name + '(' + AI_EMPLOYEE.job_title + ' ' + AI_EMPLOYEE.employee_id + ')', disclosure_mode: AI_EMPLOYEE.disclosure_mode, handoff_threshold: AI_EMPLOYEE.handoff_threshold, secret: !!cfg.lineSecret, token: !!cfg.lineToken, ai: cfg.anthropicKey ? MODELS.chat : 'workers-ai-70b', owner: !!cfg.ownerId, crm: !!env.CRM, evolved_insights: insights, delay_engine: env.DELAY_DO ? 'on' : 'off', reply_first: true, ack_text: env.ACK_TEXT || 'off', ab_test: env.AB_TEST || 'on', quiet_mode: env.QUIET_MODE || 'on', read_delay: env.READ_DELAY || 'on', genome: !!env.GENOME, stickers: 'gated', vision: 'on', catalog: Object.keys(CATALOG).length, videos: Object.values(VIDEOS.lines).flat().length, welcome_pack: WELCOME_PACK.length, deliveries, dbg: { last_post: lp || null, last_badsig: lb || null, last_oksig: lo || null } }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/webhook' && request.method === 'POST') {
      await env.SESSION?.put('dbg:last_post', new Date().toISOString()).catch(() => {});   // 偵測:LINE 有敲門
      const cfg = await getCfg(env);
      const body = await request.text();
      const valid = await verifyLineSignature(body, request.headers.get('x-line-signature'), cfg.lineSecret);
      if (!valid) { await env.SESSION?.put('dbg:last_badsig', new Date().toISOString()).catch(() => {}); return new Response('bad signature', { status: 403 }); }
      await env.SESSION?.put('dbg:last_oksig', new Date().toISOString()).catch(() => {});  // 偵測:簽名通過
      const data = JSON.parse(body);
      // ⚡ 土地公模式:先回 200 讓 LINE 安心,AI 思考放背景跑(LINE 等不到回應會掛斷並處決 worker)
      ctx.waitUntil((async () => {
        await ensureTables(env);
        const evs = [];
        for (const ev of (data.events || [])) {
          if (await seenEvent(env, ev)) continue;   // v6.1 webhookEventId 去重(含 LINE 重送)
          evs.push(ev);
        }
        // v6.1 追加:同一批次、同一位客人的多個 image 事件合併成一次處理(一次視覺請求、一次 reply);不同客人各自處理
        const isImg = (e) => e.type === 'message' && e.message?.type === 'image' && !!e.source?.userId;
        const imgKey = (e) => (e.source?.type || 'user') + ':' + (e.source?.groupId || e.source?.roomId || '') + ':' + e.source?.userId;   // v6.1:群組/聊天室各自分組,同一人在兩個群同時傳圖不會混在一起
        const imgGroups = new Map();
        for (const e of evs) if (isImg(e)) { const k = imgKey(e); if (!imgGroups.has(k)) imgGroups.set(k, []); imgGroups.get(k).push(e); }
        const imgDone = new Set();
        for (const ev of evs) {
          const run = isImg(ev)
            ? (imgDone.has(imgKey(ev)) ? null : (imgDone.add(imgKey(ev)), handleImageBatch(imgGroups.get(imgKey(ev)), env, cfg)))
            : handleEvent(ev, env, cfg);
          if (!run) continue;
          await run.catch(async (e) => {
            console.error('[pop-line] event', e.message);
            await env.SESSION?.put('dbg:last_error', e.message + ' @' + new Date().toISOString()).catch(() => {});
          });
        }
      })());
      return new Response('ok');
    }
    return new Response('pop-monster line bot (seed ' + SEED_VER + ')', { status: 200 });
  },
};

export { GO_INTAKE_SERVICE, goIntakeTransition, DIRECTIVES };
