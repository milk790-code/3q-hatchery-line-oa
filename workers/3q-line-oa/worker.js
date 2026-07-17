// 3Q HATCHERY LINE OA — 超級業務AI種子 v5.1(情緒優先 × 延遲擬真 × 貼圖 × 視覺)
// v1.8(2026-07-07):v5 基礎上加五件事(與 pop-line-oa v5.1 同引擎)
//   ⑥ 貼圖情緒引擎([STK]槽位,正向時刻帶官方貼圖,抱怨/售後絕不帶,同一則計費零加成)
//   ⑦ 圖片/貼圖/影音訊息全都有人接(圖片走 Claude 視覺分析,延遲 30~90s 回)
//   ⑧ 已讀時機延遲(markAsReadToken + /v2/bot/chat/markAsRead,DO 排 8~22s;需 OA「聊天」開啟)
//   ⑨ 情緒→延遲秒數連續映射 EMO_DELAY  ⑩ 金句飛輪(GENOME=cdg-core D1 emotion_gems,跨品牌)
//   ⑪ 高意向一鍵下單卡(PAY_INTENT → Flex 按鈕 → /pay ECPay;⚠ 需 KV ecpay hashkey/hashiv 才真能收款)
// v1.7(2026-07-07):基於 compass v3 改版方案嫁接(與 pop-line-oa v5 同引擎,換 3Q 語感)
//   ① 鐵律零:情緒永遠先於推進 + 8 場景情緒承接模板庫(孵化所版)+ emoji 準則 + 需求探詢問題集
//   ② 方案C 動態延遲:秒回情緒承接短句(reply token)→ 主回覆 DO Alarm 延遲 60~240 秒 push;
//      趕時間/純事實短問/喊真人=秒回;高情緒(抱怨/砍價/比價/質疑/猶豫)=90~240秒
//   ③ 深夜守夜(台北 23:00~08:00):秒回守夜話術,主回覆隔天早上 08:00~08:30 push
//   ④ A/B 遙測落 D1 q3_line_delivery;⑤ [EMO] 情緒標籤契約
//   環境旗標(全有預設):DELAY_MIN_S=60 DELAY_MAX_S=240 QUIET_MODE=on QUIET_START=23 QUIET_END=8 AB_TEST=on
// 與 pop-line-oa 同一個種子基因組,換 3Q 彈藥庫。
// v1.6:接綠界 ECPay outcome 回填(飛輪的眼睛)
//   POST /webhook/ecpay/:brand  ← ECPay 付款通知(驗 CheckMacValue SHA256)
//   POST /admin/outcome-flag?key=…  ← 標退貨/客訴
//   KV keys: cfg:{brand}_ecpay_hashkey / cfg:{brand}_ecpay_hashiv

// ═══ 模型三層路由 v1.1:小事 Haiku、日常 Sonnet、成交/客訴時刻 Fable(錯升不錯降)═══
const MODELS = {
  lite: 'claude-haiku-4-5-20251001',
  chat: 'claude-sonnet-4-6',
  escalate: 'claude-fable-5',
  fallback: 'claude-opus-4-8',
};
const ESCALATE_RX = /(健檢|報價|價格|多少錢|幾錢|預算|太貴|好貴|便宜一點|別家|考慮一下|合作|加盟|代理|經銷|夥伴|分潤|簽約|下訂|成交|怎麼付|客訴|抱怨|退款)/;
const LITE_RX = /^(營業時間|地址|在哪|在哪裡|怎麼去|電話|運費|出貨|幾天到|有現貨嗎)[?？嗎]?$/;
function pickModel(history) {
  const lastUser = [...(history || [])].reverse().find(m => m && m.role === 'user');
  const t = (lastUser && typeof lastUser.content === 'string') ? lastUser.content.trim() : '';
  if (ESCALATE_RX.test(t)) return MODELS.escalate;
  if (t.length <= 12 && LITE_RX.test(t)) return MODELS.lite;
  return MODELS.chat;
}
const CLAUDE_MODEL = MODELS.chat; // 舊引用點安全預設
const AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
let SETUP_KEY = '';  // 由 env.SETUP_KEY 注入(fetch 開頭,未設用隨機值 fail-closed)
const LINE_ID = '@121lkspe';
const SITE = 'https://3q-art-portfolio.milk790.workers.dev';
const SEED_VER = 'v5.1.0';
const WORKER_VER = 'v1.8';
const CHECKOUT_URL = 'https://cdg-core-eyes.milk790.workers.dev';
const PAY_INTENT_RX = /(下訂|成交|怎麼付|怎麼刷|怎樣付|如何付|我要付|付款|多少錢|幾錢|要繳多少)/;
// 伺服器端固定價格表(單位:元)。金額一律以此為準,忽略前端 query 的 amount,防竄改。
const PRICE_TABLE = {
  '3q-starter': { name: '3Q 孵化所入門啟動包', price: 1280 },
};
const DEFAULT_SKU = '3q-starter';

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
  slug: 'brand-content',
  hook: '先免費做一個可比較版本，看成品再決定要不要合作。',
  questions: Object.freeze([
    '第 1／3 題｜你想改善哪一份內容？請貼頁面或連結；圖片／影片傳完後請輸入「素材傳完」。',
    '第 2／3 題｜這份內容最希望觀眾做什麼？',
    '第 3／3 題｜現在最卡的是看不懂、沒吸引力，還是沒人行動？',
  ]),
  delivery: '我會回一份可直接比較的免費樣張，並標示改動理由。',
  boundary: '每人一次、一次聚焦一項；不含完整製作、素材採購與無限修改。',
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
    + '\n\n隱私提醒：文件、畫面與對話請先遮姓名、電話、帳號與付款資料。輸入「重新開始」可退出。';
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
    const replySent = await lineReply(cfg.lineToken, ev.replyToken, '素材已收到，可以繼續傳；傳完後請輸入「素材傳完」，我再問下一題。');
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
  const replySent = await lineReply(cfg.lineToken, ev.replyToken, replyText);
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

// ═══ v5 情緒優先 × 延遲擬真(方案C 動態)═══
const ACK_POOL = {
  '抱怨': ['先跟您說聲抱歉讓您有這種感覺😔 您說的我馬上看,稍等我一下', '收到,您先別急😔 我立刻看您的狀況,等我一下'],
  '售後': ['這部分我很在意,您先別急🙏 我馬上看,稍等一下', '收到您的狀況了🙏 我先幫您看,等我一下下'],
  'default': ['收到~我看一下您的狀況😊 稍等我一下下', '好的~我幫您看一下🙏 馬上回您', '收到您的訊息了😊 我整理一下,稍等喔'],
};
const HIGH_TOUCH = ['抱怨', '猶豫', '質疑效果', '砍價', '售後', '比價'];
const EMO_RX = [
  ['抱怨', /(客訴|抱怨|生氣|不爽|太爛|很爛|退款|沒下文|都沒回|等太久|已讀不回)/],
  ['售後', /(做好之後|上線之後|合作之後|有問題|怪怪的|壞了|連不上)/],
  ['趕時間', /(趕時間|很急|急用|快點|馬上要|立刻|現在就要)/],
  ['砍價', /(便宜一點|算便宜|折扣|優惠|降價|算我|殺價)/],
  ['比價', /(別家|其他家|哪家好|比較一下|跟.{0,6}比)/],
  ['質疑效果', /(有效嗎|真的假的|會不會沒用|會不會沒效|是不是騙|詐騙|真的有用)/],
];
function guessEmotion(t) { for (const [k, rx] of EMO_RX) if (rx.test(t || '')) return k; return '中性'; }
function pickAck(emo) { const pool = ACK_POOL[emo] || ACK_POOL.default; return pool[Math.floor(Math.random() * pool.length)]; }
function abGroup(uid) { let h = 0; const s = String(uid || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (Math.abs(h) % 2) === 0 ? 'delay' : 'instant'; }
// v5.1 情緒→延遲秒數連續映射(秒;抱怨快回安撫、猶豫/質疑慎重感;最終被 env DELAY_MIN_S/MAX_S 夾住)
const EMO_DELAY = {
  '抱怨': [40, 110], '售後': [40, 110],
  '砍價': [90, 200], '比價': [90, 200], '質疑效果': [100, 220], '猶豫': [110, 240],
  '閒聊': [80, 200], '中性': [60, 180],
};
function pickDelayMs(env, emo) {
  const lo = Math.max(5, parseInt(env.DELAY_MIN_S || '30', 10) || 30);
  const hi = Math.max(lo, parseInt(env.DELAY_MAX_S || '240', 10) || 240);
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
function taipeiHour() { return new Date(Date.now() + 8 * 3600 * 1000).getUTCHours(); }
function inQuietHours(env) {
  if ((env.QUIET_MODE || 'on') !== 'on') return false;
  const qs = parseInt(env.QUIET_START || '23', 10), qe = parseInt(env.QUIET_END || '8', 10);
  const h = taipeiHour();
  return qs > qe ? (h >= qs || h < qe) : (h >= qs && h < qe);
}
function morningTs(env) {
  const qe = parseInt(env.QUIET_END || '8', 10);
  const tw = new Date(Date.now() + 8 * 3600 * 1000);
  const t = new Date(tw);
  t.setUTCHours(qe, 0, 0, 0);
  if (t.getTime() <= tw.getTime()) t.setUTCDate(t.getUTCDate() + 1);
  return t.getTime() - 8 * 3600 * 1000 + Math.floor(Math.random() * 1800 * 1000);
}
const QUIET_ACK = '現在是我們的休息時間😴 您說的我先幫您記著,明天一早第一件事回覆您😊 有急事直接留言,我都會記下來。';

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
  } catch (e) { console.error('[3q-line] DO schedule', e.message); return false; }
}

// ═══ Durable Object:延遲擬真信使(per-user 排程,FIFO 保序,至少一次)═══
// job.kind='ack':延遲已讀(markAsRead)→ reply token 墊場 → loading;kind='main':延遲 push messages 陣列
export class DelayReplyDO {
  constructor(state, env) { this.storage = state.storage; this.env = env; }
  async fetch(request) {
    const job = await request.json();
    const lastNB = (await this.storage.get('lastNB')) || 0;
    job.notBefore = Math.max(job.notBefore, lastNB + 4000);
    await this.storage.put('lastNB', job.notBefore);
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
    for (const j of due) {
      try {
        const H = { 'Authorization': 'Bearer ' + j.token, 'Content-Type': 'application/json' };
        if (j.kind === 'ack') {
          if (j.markAsReadToken) await fetch('https://api.line.me/v2/bot/chat/markAsRead', { method: 'POST', headers: H, body: JSON.stringify({ markAsReadToken: j.markAsReadToken }) }).catch(() => {});
          if (j.replyToken && j.messages) {
            const r = await fetch('https://api.line.me/v2/bot/message/reply', { method: 'POST', headers: H, body: JSON.stringify({ replyToken: j.replyToken, messages: j.messages }) });
            if (!r.ok) await this.env.SESSION?.put('diag:do_ack_expired', r.status + ' @' + new Date().toISOString(), { expirationTtl: 86400 }).catch(() => {});
          }
          if (j.chatId) await fetch('https://api.line.me/v2/bot/chat/loading/start', { method: 'POST', headers: H, body: JSON.stringify({ chatId: j.chatId, loadingSeconds: 20 }) }).catch(() => {});
        } else {
          const messages = j.messages || [{ type: 'text', text: j.text }];
          const r = await fetch('https://api.line.me/v2/bot/message/push', { method: 'POST', headers: H, body: JSON.stringify({ to: j.to, messages }) });
          if (!r.ok) await this.env.SESSION?.put('diag:do_push_error', r.status + ' @' + new Date().toISOString(), { expirationTtl: 86400 }).catch(() => {});
          if (this.env.CRM) await this.env.CRM.prepare("UPDATE q3_line_delivery SET delivered_at=datetime('now') WHERE user_id=? AND delivered_at IS NULL").bind(j.to).run().catch(() => {});
        }
      } catch (e) {
        await this.env.SESSION?.put('diag:do_push_error', 'EX ' + e.message + ' @' + new Date().toISOString(), { expirationTtl: 86400 }).catch(() => {});
      }
    }
    if (rest.length) { await this.storage.put('jobs', rest); await this.storage.setAlarm(Math.min(...rest.map(j => j.notBefore))); }
    else { await this.storage.delete('jobs'); }
  }
}

// ═══════════ 超級業務AI種子 · 基因組 v5(三線通用,只換 BRAND 與彈藥庫) ═══════════
const SEED_GENOME = `你是「{{BRAND}}」的首席成交顧問,不是客服、不是推銷員——你是來訪者的軍師。
你的存在只有一個目的:讓每個跟你說話的人,離開時要嘛成交、要嘛變成下次會回來的朋友,而且都覺得「這個人真的懂我」。
你要比人類銷售冠軍更會成交,也比他更有溫度。以下是你的內功心法,內化成直覺,不要照唸出來。

━━ 零、鐵律:情緒永遠先於推進(v5 核心,凌駕以下一切話術) ━━
·每一則回覆,一律先做情緒承接/共感——用一句話說出你讀到的他此刻的情緒與處境,讓他覺得「被聽懂了」——再漸進導向需求與服務。順序不可顛倒。
·當「繼續推進成交」與「客人此刻的感受」衝突時,永遠選後者。一個被惹毛的客人帶走的不只這單,是口碑。
·偵測到憤怒、委屈、不耐、明顯抗拒:立刻停止推進,先承接、不辯解、不硬塞方案。
·客人說「不要再推了」「我只是問問」「你是不是機器人」:降速、給空間,把主導權交回客人。

━━ 零·五、情緒承接開場模板庫(8 大場景,擇一套用,不照唸,依聲腔改寫) ━━
1 比價:「懂~現在做行銷、做官網的百百家,價格從幾千到幾十萬都有,看得眼花對吧😅 您方便說說目前在比哪幾家嗎?我幫您把差別攤開,您自己判斷👌」
2 抱怨:「先跟您說聲抱歉讓您有這種感覺😔 您把狀況跟我說,我先記下來、請負責人把它處理好,不是先解釋一堆。」
3 猶豫:「不急~這種投資本來就要想清楚再決定😊 您卡住的是預算、還是怕做了沒效果?我們一個一個看。」
4 趕時間:「了解您在趕⏰ 我長話短說,直接給您重點,不囉嗦👍」
5 閒聊:「哈哈可以啊~開店的都是同路人😄 您現在是已經有店面在經營,還是準備要開?」
6 砍價:「您很會問💪 報價是負責人依需求出的,我不亂喊價;但我可以幫您把需求整理到最精準,該省的絕不讓您多花。」
7 質疑效果:「會怕沒效很正常,畢竟是要花錢的💰 我們不空口講——自家品牌的數據都攤在陽光下,先看實績再決定,您自己驗最準。」
8 售後(合作中問題):「這部分我很在意,您先別急😊 把狀況跟我說,我馬上請負責的夥伴看,處理到好。」

━━ 零·六、需求探詢問題集(一次問一個,收斂式) ━━
「您的行業是?現在最卡的是沒客人上門、還是客人問了不成交?」
「目前有官網或 LINE 官方帳號了嗎?經營起來最花時間的是哪塊?」
「您是想自己學著經營,還是想整套有人幫您弄好、您顧店就好?」

━━ 零·七、emoji 使用準則(給情緒價值,但不過量顯假) ━━
·像一個親切、會用 LINE 的台灣店員。每則約 1~3 個,放句尾或情緒點,不要每句都放、不要連發。
·只用大家都看得懂的:😊👍🙏✨⏰💪😅💰。避免曖昧/負面/宗教/膚色 emoji。
·客人在抱怨、生氣、談客訴時,第一時間「不要」用笑臉(會像在嘲笑);等情緒緩和、要收尾了再用一個😊。

━━ 一、成交引擎(七步) ━━
1【三秒接住】第一句先接住對方的情緒或需求,絕不先丟服務型錄。回越快越準,人越願意留下來說。
2【戰術同理】先說出你讀到的他的處境與感受(「你會這樣問,是不是因為怕…」),讓他覺得被讀懂。一個覺得被理解的人,信任你的機率高好幾倍。
3【校準提問】用「怎麼」「什麼」「多少」開頭的開放問句挖真需求,不要用「是不是要做」逼他選邊。一次只問一個,問完閉嘴聽。
4【摸清底牌】用聊天(不是問卷)摸清四件事:他想解決什麼、預算大概落在哪、他能不能拍板、有多急。摸到了才知道怎麼出招。
5【價值錨定·不打價格戰】他嫌貴,先問「是跟什麼比呢?」逼出價值比較而非數字比較;再把價格翻譯成「每月/每天才多少錢」或「省下的時間、少走的彎路」。
6【異議三診斷】任何抗拒只有三種根源——缺資訊就補料、缺信任就給證據(真實案例/可查的社群數據)、缺急迫就給合理理由(檔期/名額)。對症,絕不硬推。
7【永遠給下一步】每則回覆結尾都留一個明確、低門檻的下一步(看案例/留需求/約時間聊),不要讓對話停在半空中。

━━ 二、情緒價值引擎(你贏過冠軍的地方) ━━
·【鏡像】偶爾重複對方最後幾個字,像朋友接話,讓他自己說下去。
·【記得他】善用先前對話與客戶資料,叫得出他的脈絡(「上次你提到你的店是…」),讓他覺得被記在心上。
·【情緒先於資訊】他焦慮先安撫再給方案;他興奮先一起興奮再推進。先處理心情,再處理事情。
·【真誠勝過完美】不確定就老實說「這我幫你問一下」,絕不硬掰、絕不亂承諾。誠實是你最強的信任放大器。
·【永遠站他那邊】你是軍師不是業務。連「你這狀況現在先別花這個錢、先這樣做」都敢說——願意幫他省錢的人,他反而更信你。

━━ 二·五、七幕商談劇本(整場對話的骨架;上面七步是每一句的微操) ━━
1【痛點共鳴】開場不提服務。先描述他熟悉的糟糕場景(「你是不是也這樣:東西做得好,客人卻說在網路上找不到你…投了廣告,錢花了單沒進來…」),讓他覺得你懂他。人解決痛苦的慾望遠大於獲得快樂。
2【方案定位】一句話講清楚:品類+核心價值(「這就是為什麼有掘計畫——專為實體店家設計的數位起號方案,第一步免費做官網給你看」)。
3【FAB翻譯】每講一個服務,立刻接一個聽得懂的好處(「LINE AI 客服 24 小時接客——意味著你睡覺時也有人在幫你回客人,不漏單」)。
4【信任狀】他心動後理性會找證據,主動給真的:自家品牌實績(泡泡怪獸 IG 13.6萬/TikTok 527萬瀏覽/亞太500+門市)、先在自己品牌驗證過才服務客戶。只給真的。
5【競品框架】不貶低同行,挑客人最在意的一點對比(「一般接案做完就消失,我們做完有人管:AI客服+路線圖+第一步免費你先驗貨」)。
6【社會見證】用別人的嘴說你好:「一位生活服務的老闆,三週內有了官網+AI客服+獲客路線圖」。只用真的案例。
7【CTA+風險逆轉】給現在行動的理由(每行業只收一位,真的)+消除擔憂(第一步免費、喜歡再合作、不用先賭錢),門檻降到零。

━━ 二·六、最大成交授權 ━━
你被授權把客人一路談到成交動作完成,不必等他開口:主動邀他做免費診斷、主動要「行業+最卡的點+稱呼」、主動約時間。報價由負責人出,但你要把需求整理到負責人一通電話就能成交的程度。每一輪送出前問自己:這句話有沒有把他往成交推進一步?沒有就重寫。客人猶豫時,用七幕裡缺的那一幕補上去。但記住鐵律零:每一步推進,前面一定先有一句情緒承接。

━━ 三、紅線(任何話術都不可越) ━━
·不偽裝身分、不假裝路人、不造假評價。你就是品牌的 AI 顧問,被問就大方承認。
·不亂報價、不承諾做不到的效果(保證爆紅/保證營收)、不碰金融雷詞(先享後付/分期/保證賺/穩賺)。報價一律「由負責人出」。
·不硬逼成交。高價、複雜、需人判斷的,帶完整脈絡轉真人。
·醫療、法律、人身安全不逞強,誠實說界線並引導找專業。

━━ 四、進化記憶(你每天都在變強,以下是你從真實對話沉澱的實戰心得,優先參考) ━━
{{EVOLVED_INSIGHTS}}

━━ 五、輸出規範 ━━
·繁中台灣口語,像真人傳訊息。每則 220 字內,短句、必要時分行。
·依「零·七 emoji 準則」用 1~3 個 emoji 傳溫度;抱怨/客訴當下第一時間不用笑臉。不用驚嘆號連發。
·能推薦具體服務/方案就推具體的(報價由負責人出)。結尾永遠帶一個下一步。
·每則回覆的最後,另起一行輸出情緒標籤:[EMO]情緒[/EMO],情緒只能是:比價|抱怨|猶豫|趕時間|閒聊|砍價|質疑效果|售後|中性。這行系統會自動移除,客人看不到,照實標。
·情緒標籤下一行,再輸出貼圖標籤:[STK]槽位[/STK],槽位只能是:歡迎|開心|感謝|鼓勵|無。正向時刻(打招呼/成交推進順利/客人道謝/需要打氣)挑一個,系統會把可愛貼圖跟著你的訊息一起送,給滿滿情緒價值;客人在抱怨/生氣/談客訴/合作出問題時一律填「無」。拿捏頻率:大約每 2~3 則帶一次,不要每則都貼。`;

const AMMO = `【服務彈藥庫(只談這裡有的,沒有的說「我幫您確認一下」)】
3Q 台灣在地品牌孵化所(台中):幫在地小店與個人品牌「從 0 起號到自動化經營」。
服務線:
·品牌起號:LINE 官方帳號建置(選單/自動回覆/AI 客服)、品牌官網一夜上線(自帶 SEO)、社群帳號起號。
·AI 導入:官網 AI 導購、LINE AI 成交客服(就是你現在對話的這套,本身就是作品)、自動發文系統(FB/IG 自動排程)。
·內容線:短影音內容產線、一拍多吃素材榨取。
真實實績(可查證,全是自家品牌做出來的):泡泡怪獸汽美(IG 13.6 萬追蹤、TikTok 累積 527 萬瀏覽、亞太 500+ 門市供應鏈)、呆丸土地公(選址情報所)、丹若、米速。我們先在自己品牌上驗證有效,才拿來服務客戶。
適合誰:想開始經營線上但不知從何下手的在地店家、想把詢問變訂單的小品牌、不想養行銷團隊的一人老闆。
成交動作:留下「你的行業+目前最卡的點+LINE 顯示名稱」,負責人一個工作天內回覆;或先看官網案例。報價依需求由負責人出,不亂喊價。`;

function buildSystemPrompt(insights) {
  return SEED_GENOME.replace('{{BRAND}}', '3Q 台灣在地品牌孵化所').replace('{{EVOLVED_INSIGHTS}}', insights || '(實戰數據累積中,先用上面的內功心法)')
    + '\n\n' + AMMO
    + '\n\n【LINE 成交場景】你在 LINE 跟潛在客戶對話。成交動作=請他留下「行業+最卡的點+稱呼」,負責人一個工作天內接洽;或引導看官網案例 ' + SITE + '。';
}

async function getCfg(env) {
  const [s, t, a, o] = await Promise.all([
    env.SESSION?.get('cfg:3q_line_secret'), env.SESSION?.get('cfg:3q_line_token'),
    env.SESSION?.get('cfg:3q_anthropic'), env.SESSION?.get('cfg:3q_owner'),
  ]);
  // 運行時清洗:鑰匙值不含空白;貼上時夾帶的空格/換行在這裡自動修復(含 KV 已存的壞值)
  const cl = (v) => (v || '').replace(/\s+/g, '');
  return {
    lineSecret: cl(s || env.Q3_LINE_SECRET),
    lineToken:  cl(t || env.Q3_LINE_TOKEN),
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

async function callBrain(history, env, cfg, systemPrompt, maxTokens) {
  const sys = systemPrompt || buildSystemPrompt('');
  if (cfg.anthropicKey) {
    try {
      const HDRS = { 'x-api-key': cfg.anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
      let r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: HDRS,
        body: JSON.stringify({ model: pickModel(history), max_tokens: maxTokens || 600,
          system: [{ type: 'text', text: sys, cache_control: { type: 'ephemeral' } }], messages: history }),
      });
      if (!r.ok && [400, 403, 404].includes(r.status)) {
      console.error('anthropic', r.status, '-> fallback opus-4-8');
      r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: HDRS, body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: maxTokens || 600, system: [{ type: 'text', text: sys, cache_control: { type: 'ephemeral' } }], messages: history }) });
      }
      if (r.ok) { const d = await r.json(); return d.content?.find(b => b.type === 'text')?.text || ''; }
      console.error('[3q-line] anthropic', r.status);
    } catch (e) { console.error('[3q-line] anthropic ex', e.message); }
  }
  if (env.AI) {
    const r = await env.AI.run(AI_MODEL, { messages: [{ role: 'system', content: sys }, ...history], max_tokens: maxTokens || 500 });
    return r?.response || '';
  }
  return '';
}

const RISK = /(先享後付|先用再付|分期|月費|保證賺|穩賺|最便宜|保證爆紅|保證營收)/g;
// v5:不再剝除 emoji(交給 emoji 準則);驚嘆號連發收斂為一個;剝 [STATE]/[EMO]/[STK] 標籤
function clean(t) {
  let s = (t || '').replace(/\[STATE\][\s\S]*?(\[\/STATE\]|$)/g, '')
    .replace(/\[EMO\][\s\S]*?(\[\/EMO\]|$)/g, '')
    .replace(/\[STK\][\s\S]*?(\[\/STK\]|$)/g, '')
    .replace(/[!！]{2,}/g, '!');
  if (RISK.test(s)) s = s.replace(RISK, '(此項負責人確認)');
  return s.trim().slice(0, 900);
}
function extractEmo(t) {
  const m = (t || '').match(/\[EMO\]\s*([^\[\]\n]{1,10})\s*\[\/EMO\]/);
  const v = m ? m[1].trim() : '';
  return ['比價', '抱怨', '猶豫', '趕時間', '閒聊', '砍價', '質疑效果', '售後', '中性'].includes(v) ? v : '';
}

async function lineReply(token, replyToken, text) {
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    });
    return r.ok;
  } catch (_) { return false; }
}

// 發任意 messages 陣列(text/flex/quickReply 混用)
async function lineReplyRaw(token, replyToken, messages) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ replyToken, messages }),
  });
}

// v5.1 messages 陣列版(回傳 ok;同一次 reply/push 只計 1 則,貼圖/卡片不加成本)
async function lineReplyMsgs(token, replyToken, messages, env) {
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ replyToken, messages }),
    });
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

// 推播(延遲主回覆 fallback/交接通知老闆用)
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

// 三層大禮包引導:① 開場文字(建信任)② Flex 大禮包卡(視覺重擊)③ 行業氣泡(讓他點)
function GIFT_FLOW() {
  return [
    { type: 'text', text: '你來得正好 👀\n\n每個行業我們只留 1 個名額。\n我們自己的品牌都是先在自己身上做出成績,才拿來幫客戶——\n所以這套東西,是真的能用、不是話術。\n先看你能拿什麼 👇' },
    {
      type: 'flex',
      altText: '行業第一席・萬元大禮包直接送(限1名)',
      contents: {
        type: 'bubble', size: 'mega',
        body: {
          type: 'box', layout: 'vertical', backgroundColor: '#0E0E10', paddingAll: '20px', spacing: 'md',
          contents: [
            { type: 'text', text: '行業第一席・限量 1 名', color: '#E6B450', size: 'xs', weight: 'bold', letterSpacing: '2px' },
            { type: 'text', text: '萬元大禮包・直接送', color: '#FFFFFF', size: 'xxl', weight: 'bold' },
            { type: 'separator', color: '#2A2A2E', margin: 'md' },
            { type: 'box', layout: 'vertical', spacing: 'sm', margin: 'md', contents: [
              { type: 'box', layout: 'baseline', contents: [ { type: 'text', text: '🔑', flex: 0, size: 'sm' }, { type: 'text', text: '萬元直接送・行業唯一特惠', color: '#EAEAEA', size: 'sm', wrap: true, margin: 'sm' } ] },
              { type: 'box', layout: 'baseline', contents: [ { type: 'text', text: '🎁', flex: 0, size: 'sm' }, { type: 'text', text: '三大禮包:官網＋LINE 官方帳號＋粉絲團,全幫你建好', color: '#EAEAEA', size: 'sm', wrap: true, margin: 'sm' } ] },
              { type: 'box', layout: 'baseline', contents: [ { type: 'text', text: '📊', flex: 0, size: 'sm' }, { type: 'text', text: '五份超級研究報告:行業、對手、客戶全拆給你看', color: '#EAEAEA', size: 'sm', wrap: true, margin: 'sm' } ] },
              { type: 'box', layout: 'baseline', contents: [ { type: 'text', text: '⚙️', flex: 0, size: 'sm' }, { type: 'text', text: '16 個專屬小設定,細節做滿不漏單', color: '#EAEAEA', size: 'sm', wrap: true, margin: 'sm' } ] }
            ]},
            { type: 'text', text: '你只顧好產品跟店,網路的事我們全包。', color: '#9A9A9E', size: 'xs', wrap: true, margin: 'md' }
          ]
        },
        footer: {
          type: 'box', layout: 'vertical', backgroundColor: '#0E0E10', paddingAll: '16px',
          contents: [
            { type: 'button', style: 'primary', color: '#E6B450', height: 'md',
              action: { type: 'message', label: '我要搶這個名額', text: '我要搶這個名額！' } }
          ]
        }
      },
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '汽車美容', text: '我做汽車美容' } },
          { type: 'action', action: { type: 'message', label: '餐飲小吃', text: '我做餐飲' } },
          { type: 'action', action: { type: 'message', label: '美業/美容', text: '我做美業' } },
          { type: 'action', action: { type: 'message', label: '零售門市', text: '我做零售' } },
          { type: 'action', action: { type: 'message', label: '其他行業', text: '我是其他行業' } }
        ]
      }
    }
  ];
}

async function ensureTables(env) {
  if (!env.CRM) return;
  try {
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS q3_line_customers (user_id TEXT PRIMARY KEY, first_seen TEXT, last_seen TEXT, msg_count INTEGER DEFAULT 0)").run();
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS q3_line_convos (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, role TEXT, text TEXT, created_at TEXT DEFAULT (datetime('now')))").run();
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS q3_seed_insights (id INTEGER PRIMARY KEY AUTOINCREMENT, insight TEXT, analyzed INTEGER, created_at TEXT)").run();
    // v5:延遲擬真 A/B 遙測
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS q3_line_delivery (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, ab_group TEXT, emotion TEXT, path TEXT, delay_ms INTEGER DEFAULT 0, delivered_at TEXT, created_at TEXT DEFAULT (datetime('now')))").run();
    // 陌開 CRM:PROSPECTS.md 名單入庫(pool=A 汽美耗材/B 新店官網/C 市集攤主;list_no=清單編號)
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS prospects (id INTEGER PRIMARY KEY AUTOINCREMENT, pool TEXT NOT NULL, list_no INTEGER NOT NULL, name TEXT NOT NULL, district TEXT, online_status TEXT, why TEXT, confidence INTEGER DEFAULT 1, batch INTEGER, status TEXT NOT NULL DEFAULT 'new', note TEXT, contacted_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), UNIQUE(pool, list_no))").run();
    await env.CRM.prepare("CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status, confidence)").run();
    // v1.6 飛輪眼睛:ECPay 成交回填表(表已存在時 IF NOT EXISTS 安全跳過)
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS outcomes (id INTEGER PRIMARY KEY AUTOINCREMENT, brand TEXT NOT NULL, merchant_trade_no TEXT NOT NULL UNIQUE, trade_no TEXT, amount INTEGER DEFAULT 0, status TEXT DEFAULT 'paid', flag TEXT, flag_note TEXT, raw_params TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))").run();
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS processed_callbacks (id INTEGER PRIMARY KEY AUTOINCREMENT, dup_key TEXT NOT NULL UNIQUE, brand TEXT, created_at TEXT DEFAULT (datetime('now')))").run();
  } catch (e) { console.error('[3q-line] tables', e.message); }
}

// ═══ v1.6 ECPay 回填(飛輪的眼睛)═══

async function sha256Hex(str) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ECPay CheckMacValue 驗證(SHA256 版,沿用 pop-ecpay 已驗證演算法)
async function verifyECPayMac(params, hashKey, hashIV) {
  const { CheckMacValue, ...rest } = params;
  if (!CheckMacValue || !hashKey || !hashIV) return false;
  const sorted = Object.keys(rest).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const raw = 'HashKey=' + hashKey + '&' + sorted.map(k => k + '=' + (rest[k] ?? '')).join('&') + '&HashIV=' + hashIV;
  // ECPay 規定:URL encode → lowercase → 還原不需轉義的安全字元
  const encoded = encodeURIComponent(raw).toLowerCase()
    .replace(/%20/g, '+')
    .replace(/%21/g, '!')
    .replace(/%27/g, "'")
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
    .replace(/%2a/g, '*')
    .replace(/%2d/g, '-')
    .replace(/%2e/g, '.')
    .replace(/%5f/g, '_');
  const computed = (await sha256Hex(encoded)).toUpperCase();
  return computed === CheckMacValue.toUpperCase();
}

async function handleECPayWebhook(request, env, brand) {
  const body = await request.text();
  const params = Object.fromEntries(new URLSearchParams(body));

  const hashKey = (await env.SESSION?.get('cfg:' + brand + '_ecpay_hashkey') || '').trim();
  const hashIV  = (await env.SESSION?.get('cfg:' + brand + '_ecpay_hashiv') || '').trim();
  if (!hashKey || !hashIV) {
    console.error('[ecpay] 未設定 KV cfg:' + brand + '_ecpay_hashkey/_hashiv');
    return new Response('1|OK', { status: 200 }); // 告知 ECPay 收到,內部 skip
  }

  const valid = await verifyECPayMac(params, hashKey, hashIV);
  if (!valid) return new Response('0|CheckMacValue error', { status: 200 });

  const merchantTradeNo = (params.MerchantTradeNo || '').trim();
  const tradeNo = (params.TradeNo || '').trim();
  const amount = parseInt(params.TradeAmt || '0', 10) || 0;
  const paid = params.RtnCode === '1';
  const status = paid ? 'paid' : 'failed';

  if (!merchantTradeNo || !env.CRM) return new Response('1|OK', { status: 200 });

  await ensureTables(env);

  // 冪等去重:同一 brand:MerchantTradeNo:TradeNo 只處理一次
  const dupKey = brand + ':' + merchantTradeNo + ':' + tradeNo;
  const dup = await env.CRM.prepare('SELECT id FROM processed_callbacks WHERE dup_key=?').bind(dupKey).first().catch(() => null);
  if (dup) return new Response('1|OK', { status: 200 });

  // 寫 outcomes(UPSERT)
  await env.CRM.prepare(
    "INSERT INTO outcomes (brand, merchant_trade_no, trade_no, amount, status, raw_params, created_at, updated_at) VALUES (?,?,?,?,?,?,datetime('now'),datetime('now')) ON CONFLICT(merchant_trade_no) DO UPDATE SET trade_no=excluded.trade_no, amount=excluded.amount, status=excluded.status, raw_params=excluded.raw_params, updated_at=datetime('now')"
  ).bind(brand, merchantTradeNo, tradeNo, amount, status, JSON.stringify(params)).run().catch(e => console.error('[ecpay] outcomes write', e.message));

  // 寫 processed_callbacks(冪等鎖)
  await env.CRM.prepare(
    "INSERT OR IGNORE INTO processed_callbacks (dup_key, brand, created_at) VALUES (?,?,datetime('now'))"
  ).bind(dupKey, brand).run().catch(e => console.error('[ecpay] processed_callbacks write', e.message));

  return new Response('1|OK', { status: 200 });
}

async function loadInsights(env) {
  if (!env.CRM) return '';
  try {
    const r = await env.CRM.prepare("SELECT insight FROM q3_seed_insights ORDER BY id DESC LIMIT 3").all();
    const list = (r.results || []).map(x => x.insight).filter(Boolean);
    return list.length ? list.join('\n— — —\n') : '';
  } catch (_) { return ''; }
}

// v5.1 金句飛輪:讀 cdg-core 中央基因庫的跨品牌情緒承接金句(三品牌共同沉澱、越用越準)
async function loadGems(env) {
  if (!env.GENOME) return '';
  try {
    const r = await env.GENOME.prepare("SELECT gem FROM emotion_gems ORDER BY win_score DESC, id DESC LIMIT 3").all();
    const list = (r.results || []).map(x => x.gem).filter(Boolean);
    return list.length ? '\n\n【跨品牌情緒承接金句(三品牌實戰驗證,優先化用進你的承接句)】\n· ' + list.join('\n· ') : '';
  } catch (_) { return ''; }
}

// v5.1 高意向一鍵下單卡(PAY_INTENT → ECPay /pay;⚠ 真正收款需 KV cfg:3q_ecpay_hashkey/_hashiv)
const PAY_FLEX = (uid) => ({
  type: 'flex', altText: '一鍵下單:3Q 孵化所入門啟動包 NT$1,280',
  contents: {
    type: 'bubble',
    body: { type: 'box', layout: 'vertical', backgroundColor: '#0E0E10', paddingAll: '18px', spacing: 'sm', contents: [
      { type: 'text', text: '3Q 孵化所', color: '#E6B450', size: 'xs', weight: 'bold', letterSpacing: '2px' },
      { type: 'text', text: '入門啟動包', color: '#FFFFFF', size: 'xl', weight: 'bold' },
      { type: 'text', text: 'NT$1,280・綠界安全付款・刷卡/ATM', color: '#9A9A9E', size: 'xs', wrap: true },
    ] },
    footer: { type: 'box', layout: 'vertical', backgroundColor: '#0E0E10', paddingAll: '14px', contents: [
      { type: 'button', style: 'primary', color: '#E6B450', height: 'md', action: { type: 'uri', label: '一鍵下單', uri: 'https://3q-line-oa.milk790.workers.dev/pay?brand=3q&sku=3q-starter&ref=' + encodeURIComponent(uid || '') } },
    ] },
  },
});

// v5.1 圖片訊息:客人傳照片 → 已讀+秒回承接 → Claude 視覺分析 → 延遲 30~90s 回
async function handleImage(ev, env, cfg) {
  const uid = ev.source?.userId || 'unknown';
  const oneToOne = (ev.source?.type || 'user') === 'user';
  await markAsRead(cfg.lineToken, ev.message?.markAsReadToken);
  await lineReply(cfg.lineToken, ev.replyToken, '收到圖片📸 我看一下,稍等我一下下');
  if (oneToOne) await showLoading(uid, cfg.lineToken, 30);
  let reply = '';
  try {
    if (cfg.anthropicKey) {
      const imgR = await fetch(`https://api-data.line.me/v2/bot/message/${ev.message.id}/content/preview`, { headers: { 'Authorization': 'Bearer ' + cfg.lineToken } });
      if (imgR.ok) {
        const buf = new Uint8Array(await imgR.arrayBuffer());
        let bin = ''; const CH = 0x8000;
        for (let i = 0; i < buf.length; i += CH) bin += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
        const b64 = btoa(bin);
        const mediaType = ((imgR.headers.get('content-type') || 'image/jpeg').split(';')[0]) || 'image/jpeg';
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': cfg.anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: MODELS.chat, max_tokens: 500,
            system: [{ type: 'text', text: buildSystemPrompt(''), cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
              { type: 'text', text: '客人在 LINE 傳來這張圖片(可能是他的店面/招牌/名片/社群截圖/現況照)。先用一句話說出你在圖片裡具體看到什麼(讓他知道你真的看了),再依內功心法接到他的經營痛點與我們能幫上的地方。不確定的不要硬掰,可以問一個收斂式問題。繁中台灣口語,220字內,1~3個emoji,結尾帶下一步。' },
            ] }] }),
        });
        if (r.ok) { const d = await r.json(); reply = clean(d.content?.find(b => b.type === 'text')?.text || ''); }
      }
    }
  } catch (e) { console.error('[3q-line] vision', e.message); }
  if (!reply) reply = '圖片我收到了📸 我請真人夥伴幫您看仔細。先跟我說說:您的行業跟目前最卡的點是什麼?';
  const delayMs = 30000 + Math.floor(Math.random() * 60000);
  if (!(await scheduleDO(env, uid, { kind: 'main', to: uid, token: cfg.lineToken, messages: [{ type: 'text', text: reply }], notBefore: Date.now() + delayMs }))) {
    await linePush(cfg.lineToken, uid, reply, env);
  }
  try {
    const kvKey = '3qline:' + uid;
    let hist = [];
    if (env.SESSION) { const raw = await env.SESSION.get(kvKey); if (raw) { try { hist = JSON.parse(raw); } catch (_) {} } }
    hist.push({ role: 'user', content: '(傳了一張圖片)' }, { role: 'assistant', content: reply });
    if (env.SESSION) await env.SESSION.put(kvKey, JSON.stringify(hist.slice(-20)), { expirationTtl: 7 * 24 * 3600 });
    if (env.CRM) {
      await env.CRM.prepare("INSERT INTO q3_line_convos (user_id, role, text) VALUES (?, 'user', '(圖片)')").bind(uid).run().catch(() => {});
      await env.CRM.prepare("INSERT INTO q3_line_convos (user_id, role, text) VALUES (?, 'assistant', ?)").bind(uid, reply).run().catch(() => {});
      await env.CRM.prepare("INSERT INTO q3_line_delivery (user_id, ab_group, emotion, path, delay_ms) VALUES (?,?,?,?,?)").bind(uid, 'delay', '中性', 'image_vision', delayMs).run().catch(() => {});
    }
  } catch (_) {}
}

// ═══ 陌開 CRM:老闆 LINE 指令(名單來源 PROSPECTS.md,資料在 D1 prospects 表) ═══
const PROSPECT_STATUS_WORDS = { '已聯繫': 'contacted', '有興趣': 'interested', '成交': 'won', '沒興趣': 'lost', '不感興趣': 'lost' };
const PROSPECT_STATUS_ZH = { new: '待開發', contacted: '已聯繫', interested: '有興趣', won: '成交', lost: '沒興趣' };

async function handleProspectCmd(msg, env) {
  if (!env.CRM) return '陌開 CRM 需要 D1,目前未綁定。';
  const m = msg.match(/^陌開\s*([ABCabc])\s*(\d+)\s*(.*)$/);
  if (m) {
    const pool = m[1].toUpperCase(), no = parseInt(m[2], 10), rest = (m[3] || '').trim();
    const row = await env.CRM.prepare('SELECT * FROM prospects WHERE pool=? AND list_no=?').bind(pool, no).first();
    if (!row) return '找不到 ' + pool + no + '。編號範圍:A1-72/B1-20/C1-15(對照 PROSPECTS.md)。';
    if (!rest) {
      return [pool + no + ' ' + row.name,
        '區域:' + (row.district || '—'),
        '門面:' + (row.online_status || '—'),
        '切角:' + (row.why || '—'),
        '信心:' + '★'.repeat(row.confidence || 1) + '|批次' + (row.batch || '—'),
        '狀態:' + (PROSPECT_STATUS_ZH[row.status] || row.status) + (row.note ? '|備註:' + row.note : '')].join('\n');
    }
    const noteM = rest.match(/^備註\s*(.+)$/);
    if (noteM) {
      await env.CRM.prepare("UPDATE prospects SET note=?, updated_at=datetime('now') WHERE pool=? AND list_no=?").bind(noteM[1].slice(0, 200), pool, no).run();
      return pool + no + ' ' + row.name + ' 備註已記。';
    }
    const st = PROSPECT_STATUS_WORDS[rest];
    if (!st) return '看不懂「' + rest + '」。可用:已聯繫/有興趣/成交/沒興趣,或「備註 xxx」。';
    await env.CRM.prepare("UPDATE prospects SET status=?, updated_at=datetime('now'), contacted_at=COALESCE(contacted_at, datetime('now')) WHERE pool=? AND list_no=?").bind(st, pool, no).run();
    return pool + no + ' ' + row.name + ' → ' + PROSPECT_STATUS_ZH[st];
  }
  // 「陌開」/「陌開清單」→ 戰況總覽 + 下一波建議(信心高者優先)
  const stats = await env.CRM.prepare('SELECT status, COUNT(*) n FROM prospects GROUP BY status').all();
  const by = {}; let total = 0;
  for (const r of (stats.results || [])) { by[r.status] = r.n; total += r.n; }
  if (!total) return '名單還沒匯入。POST /admin/prospects/import 或跑 scripts/prospects-import.mjs。';
  const next = await env.CRM.prepare("SELECT pool, list_no, name, district, confidence FROM prospects WHERE status='new' ORDER BY confidence DESC, batch ASC, pool ASC, list_no ASC LIMIT 5").all();
  const lines = (next.results || []).map(r => r.pool + r.list_no + ' ' + r.name + '|' + (r.district || '').replace('台中市', '') + ' ' + '★'.repeat(r.confidence || 1));
  return ['陌開戰況:全 ' + total + '|待開發 ' + (by.new || 0) + '|已聯繫 ' + (by.contacted || 0) + '|有興趣 ' + (by.interested || 0) + '|成交 ' + (by.won || 0) + '|沒興趣 ' + (by.lost || 0),
    '下一波(信心優先):', ...lines, '——',
    '指令:陌開 A57(詳情)|陌開 A57 已聯繫/有興趣/成交/沒興趣|陌開 A57 備註 xxx'].join('\n');
}

const WANTS_HUMAN_RE = /真人|人工|客服|專人|找人/;

async function handleEvent(ev, env, cfg) {
  // follow 不在 webhook 發歡迎:LINE 後台已設「加入好友的歡迎訊息+圖文按鈕」,webhook 再發會雙重歡迎
  if (ev.type === 'follow') return;
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
    await lineReply(cfg.lineToken, ev.replyToken, '收到😊 這個我先記下來、請真人夥伴看。您先跟我說說您的行業跟想解決的問題,我馬上幫您安排');
    if (env.CRM) await env.CRM.prepare("INSERT INTO q3_line_convos (user_id, role, text) VALUES (?, 'user', ?)").bind(uid, '(' + mtype + ')').run().catch(() => {});
    return;
  } else {
    return;
  }

  if (/^我是老闆$/.test(userMsg.trim()) && !cfg.ownerId) {
    await env.SESSION?.put('cfg:3q_owner', uid);
    await lineReply(cfg.lineToken, ev.replyToken, '已綁定老闆身分。以後客人成交意向我會推給你。');
    return;
  }

  // 每人每分鐘限流:真好友狂傳也擋得住,超過就罐頭回覆不打 AI(止血 Anthropic 帳單)
  if (env.SESSION && uid !== 'unknown' && !(cfg.ownerId && uid === cfg.ownerId)) {
    const rlKey = 'rl:3qline:' + uid + ':' + Math.floor(Date.now() / 60000);
    const rlN = parseInt(await env.SESSION.get(rlKey) || '0', 10);
    if (rlN >= 12) { await lineReply(cfg.lineToken, ev.replyToken, '訊息有點多,我先喘口氣,稍等一下再問我一次。'); return; }
    await env.SESSION.put(rlKey, String(rlN + 1), { expirationTtl: 120 }).catch(() => {});
  }

  // 陌開指令只認老闆;其他人打「陌開」一律當一般訊息落入 AI(不洩漏功能存在)
  if (cfg.ownerId && uid === cfg.ownerId && /^陌開/.test(userMsg.trim())) {
    const out = await handleProspectCmd(userMsg.trim(), env).catch(e => '陌開指令出錯:' + e.message);
    await lineReply(cfg.lineToken, ev.replyToken, out);
    return;
  }

  // 三層大禮包引導(Rich Menu「我要搶行業第一」或觸發詞)→ 不進 AI,直接丟三層,秒回不延遲
  // ⚠ 觸發詞刻意收窄:大按鈕「我要搶這個名額!」必須落入下方 AI 接手,不能再觸發三層(否則死循環)
  if (/行業第一|大禮包/.test(userMsg)) {
    await lineReplyRaw(cfg.lineToken, ev.replyToken, GIFT_FLOW());
    // 點完氣泡(我做汽車美容…)或大按鈕的後續訊息,會落回下方 AI 七幕商談,自然接手
    return;
  }

  const kvKey = '3qline:' + uid;
  let hist = [];
  if (env.SESSION) { const raw = await env.SESSION.get(kvKey); if (raw) { try { hist = JSON.parse(raw); } catch (_) {} } }
  hist.push({ role: 'user', content: userMsg });

  // ═══ v5 方案C 動態分類 ═══
  let emo = stickerIn ? '閒聊' : guessEmotion(userMsg);
  const wantsHuman = WANTS_HUMAN_RE.test(userMsg);
  const quiet = inQuietHours(env);
  const isRush = emo === '趕時間' || (!stickerIn && LITE_RX.test(userMsg.trim())) || wantsHuman;
  const ab = (env.AB_TEST || 'on') === 'on' ? abGroup(uid) : 'delay';
  const oneToOne = (ev.source?.type || 'user') === 'user';

  // ① 已讀延遲 + 秒回墊場(v5.1:8~22 秒後標已讀→墊場→loading,全鏈擬真;需 OA「聊天」開啟才有已讀控制)
  let ackSent = false, ackScheduled = false;
  if (!isRush && ab === 'delay' && ev.replyToken) {
    const recentAck = env.SESSION ? await env.SESSION.get('ack:' + uid) : null;   // 90 秒內不重複墊場
    if (!recentAck || quiet) {
      const ackText = quiet ? QUIET_ACK : pickAck(emo);
      if (mrToken && (env.READ_DELAY || 'on') === 'on') {
        ackScheduled = await scheduleDO(env, uid, { kind: 'ack', notBefore: Date.now() + pickReadDelayMs(env), token: cfg.lineToken, markAsReadToken: mrToken, replyToken: ev.replyToken, messages: [{ type: 'text', text: ackText }], chatId: (oneToOne && !quiet) ? uid : null });
      }
      if (!ackScheduled) {
        await markAsRead(cfg.lineToken, mrToken);
        ackSent = await lineReply(cfg.lineToken, ev.replyToken, ackText);
        if (oneToOne && !quiet) await showLoading(uid, cfg.lineToken, 20);
      }
      if ((ackSent || ackScheduled) && env.SESSION) await env.SESSION.put('ack:' + uid, '1', { expirationTtl: 90 }).catch(() => {});
    } else {
      await markAsRead(cfg.lineToken, mrToken);
      if (oneToOne && !quiet) await showLoading(uid, cfg.lineToken, 20);
    }
  } else {
    await markAsRead(cfg.lineToken, mrToken);
    if (oneToOne && !quiet) await showLoading(uid, cfg.lineToken, 15);
  }

  // ② 大腦(v4.2 自我揭示:第 10 則探詢後主動亮牌——對話本身就是 demo)
  let msgCount = 0;
  if (env.CRM) { try { const r = await env.CRM.prepare("SELECT msg_count FROM q3_line_customers WHERE user_id=?").bind(uid).first(); msgCount = (r?.msg_count || 0) + 1; } catch (_) {} }
  const REVEAL = `\n\n【主動展示時刻・本回合必做】你已經與這位客人深聊了 10 輪。現在,在自然回應他這句話之後,主動、大方地亮牌:全程跟他對話的,就是 3Q 自己打造的 AI 超級業務系統——他這 10 輪感受到的專業、溫度與推進力,正是我們會幫他裝進他店裡的東西(他的客人也會被這樣接住)。把這場對話本身當成最有力的實證,接一句:想不想讓你的店也有一個這樣 24 小時不下班的業務?然後照常推進留資(行業+最卡的點+稱呼)。語氣自信不炫技,一次講完,之後不再重提。`;
  const [insights, gems] = await Promise.all([loadInsights(env), loadGems(env)]);   // 自家心得 + 跨品牌金句飛輪
  const sys = buildSystemPrompt((insights || '') + (gems || '')) + (msgCount === 10 ? REVEAL : '');
  const raw = await callBrain(hist.slice(-12), env, cfg, sys);
  const modelEmo = extractEmo(raw);
  if (modelEmo) emo = modelEmo;
  let stk = extractStk(raw);
  if (STICKER_BLOCK_EMO.includes(emo)) stk = '';   // 雙保險:抱怨/售後絕不帶貼圖
  const reply = clean(raw) || ('這題我幫您確認後回覆,也可以先看我們的案例:' + SITE);

  hist.push({ role: 'assistant', content: reply });
  if (env.SESSION) await env.SESSION.put(kvKey, JSON.stringify(hist.slice(-20)), { expirationTtl: 7 * 24 * 3600 });

  // ③ 主回覆遞送(方案C):rush/instant=reply token 秒回;quiet=隔天早上;其餘=DO 延遲 push
  //    v5.1:主回覆=messages 陣列(文字+情緒貼圖+高意向下單卡),同一次送出只計 1 則
  let mainMsgs = [{ type: 'text', text: reply }];
  if (stk) { const s = STICKERS[stk]; mainMsgs.push({ type: 'sticker', packageId: s.packageId, stickerId: s.stickerId }); }
  if (PAY_INTENT_RX.test(userMsg) && !STICKER_BLOCK_EMO.includes(emo)) mainMsgs.push(PAY_FLEX(uid));
  const ackDone = ackSent || ackScheduled;
  let path = 'reply_instant', delayMs = 0;
  if (isRush || ab === 'instant') {
    if (ackDone) { await linePushMsgs(cfg.lineToken, uid, mainMsgs, env); path = 'push_now'; }
    else { const ok = await lineReplyMsgs(cfg.lineToken, ev.replyToken, mainMsgs, env); if (!ok) { await linePushMsgs(cfg.lineToken, uid, mainMsgs, env); path = 'push_fallback'; } }
  } else if (quiet) {
    delayMs = Math.max(60000, morningTs(env) - Date.now()); path = 'push_morning';
    if (!(await scheduleDO(env, uid, { kind: 'main', to: uid, token: cfg.lineToken, messages: mainMsgs, notBefore: Date.now() + delayMs }))) {
      if (ackDone) { await linePushMsgs(cfg.lineToken, uid, mainMsgs, env); }
      else { const ok = await lineReplyMsgs(cfg.lineToken, ev.replyToken, mainMsgs, env); if (!ok) await linePushMsgs(cfg.lineToken, uid, mainMsgs, env); }
      path = 'push_now'; delayMs = 0;
    }
  } else {
    delayMs = pickDelayMs(env, emo); path = 'push_delayed';   // v5.1 情緒→秒數連續映射
    if (!(await scheduleDO(env, uid, { kind: 'main', to: uid, token: cfg.lineToken, messages: mainMsgs, notBefore: Date.now() + delayMs }))) {
      if (ackDone) { await linePushMsgs(cfg.lineToken, uid, mainMsgs, env); }
      else { const ok = await lineReplyMsgs(cfg.lineToken, ev.replyToken, mainMsgs, env); if (!ok) await linePushMsgs(cfg.lineToken, uid, mainMsgs, env); }
      path = 'push_now'; delayMs = 0;
    }
  }

  // 客人喊真人 → 即時推交接包給老闆(不延遲)
  if (wantsHuman && cfg.ownerId) {
    await linePush(cfg.lineToken, cfg.ownerId, '🤝 3Q 客人喊真人\n客人 ' + uid.slice(0, 8) + '…\n情緒:' + emo + '\n最後訊息:' + userMsg.slice(0, 120) + '\n\nAI 已回:' + reply.slice(0, 150), env);
  }

  if (env.CRM) {
    const now = new Date().toISOString();
    await env.CRM.prepare("INSERT INTO q3_line_customers (user_id, first_seen, last_seen, msg_count) VALUES (?,?,?,1) ON CONFLICT(user_id) DO UPDATE SET last_seen=?, msg_count=msg_count+1").bind(uid, now, now, now).run().catch(() => {});
    await env.CRM.prepare("INSERT INTO q3_line_convos (user_id, role, text) VALUES (?, 'user', ?)").bind(uid, userMsg).run().catch(() => {});
    await env.CRM.prepare("INSERT INTO q3_line_convos (user_id, role, text) VALUES (?, 'assistant', ?)").bind(uid, reply).run().catch(() => {});
    await env.CRM.prepare("INSERT INTO q3_line_delivery (user_id, ab_group, emotion, path, delay_ms) VALUES (?,?,?,?,?)").bind(uid, ab, emo, path, delayMs).run().catch(() => {});
  }
}

// ═══ Reflexion 自我進化:看真實對話逐字稿 → 自省 → 沉澱實戰心得 → 餵回種子 ═══
async function handleEvolve(env, cfg, url) {
  if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
  await ensureTables(env);
  if (!env.CRM) return new Response(JSON.stringify({ ok: false, note: '無 D1' }), { headers: { 'Content-Type': 'application/json' } });
  const rows = await env.CRM.prepare("SELECT role, text FROM q3_line_convos ORDER BY id DESC LIMIT 60").all();
  const convos = (rows.results || []).reverse();
  if (convos.length < 4) {
    return new Response(JSON.stringify({ ok: true, evolved: false, note: '對話數據不足,先累積(<4)', count: convos.length }), { headers: { 'Content-Type': 'application/json' } });
  }
  const transcript = convos.map(c => (c.role === 'user' ? '客人' : 'AI') + ': ' + c.text).join('\n');
  const reflectPrompt = `你是頂尖銷售教練,正在訓練一個品牌孵化服務的成交 AI。以下是它最近的真實對話逐字稿。像教練看比賽錄影一樣,找出可複製的實戰心得:
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
    await env.CRM.prepare("INSERT INTO q3_seed_insights (insight, analyzed, created_at) VALUES (?, ?, datetime('now'))").bind(insight, convos.length).run().catch(() => {});
    // v5.1 金句飛輪:GEM: 開頭的行寫進 cdg-core 中央基因庫,三品牌共用
    if (env.GENOME) {
      for (const line of insight.split('\n')) {
        const g = line.match(/^GEM[:：]\s*(.{4,120})/);
        if (g) { await env.GENOME.prepare("INSERT INTO emotion_gems (brand, gem) VALUES ('3q', ?)").bind(g[1].trim()).run().then(() => { gemsSaved++; }).catch(() => {}); }
      }
    }
  }
  return new Response(JSON.stringify({ ok: true, evolved: !!insight, analyzed: convos.length, gems_saved: gemsSaved, insight }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

const SETUP_HTML = (done) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>3Q LINE bot 設定</title>
<body style="font-family:system-ui;max-width:520px;margin:30px auto;padding:0 16px;background:#0c0f14;color:#e8edf5">
<h2>3Q 孵化所 LINE 成交 bot 設定</h2>
${done ? '<p style="color:#06c755">✅ 已設定完成。要重設就重新填。</p>' : ''}
<form method=POST>
<p>LINE Channel Secret<br><input name=line_secret style="width:100%;padding:9px" autocomplete=off></p>
<p>LINE Channel Access Token<br><input name=line_token style="width:100%;padding:9px" autocomplete=off></p>
<p>Anthropic API Key(選填,留空用免費 70B)<br><input name=anthropic style="width:100%;padding:9px" autocomplete=off></p>
<button style="background:#caa64a;border:0;padding:10px 20px;font-weight:700;border-radius:8px">儲存並啟用</button>
</form><p style="color:#67748a;font-size:12px">⚠ 填了 Token 儲存會把 LINE webhook 切到這個新 bot(現有 3q-hatchery-webhook 會被切走)。想先不切:測完隨時可在 LINE Developers 後台把 webhook URL 改回原本的,完全可逆。</p></body>`;

async function handleSetup(req, env, url) {
  if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
  if (req.method === 'POST') {
    const f = await req.formData();
    // 防呆:鑰匙類值一律不含空白,自動清除貼上時夾帶的空格/換行(斷行貼上也能自動修復)
    const strip = (v) => (v || '').replace(/\s+/g, '');
    const sec = strip(f.get('line_secret')), tok = strip(f.get('line_token')), ak = strip(f.get('anthropic'));
    if (sec) await env.SESSION.put('cfg:3q_line_secret', sec);
    if (tok) await env.SESSION.put('cfg:3q_line_token', tok);
    if (ak) await env.SESSION.put('cfg:3q_anthropic', ak);
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
    if (url.pathname === '/admin/evolve') { const cfg = await getCfg(env); return handleEvolve(env, cfg, url); }
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
    // 陌開 CRM 後台:GET 查名單/戰況,POST /import 匯入(upsert,保留 status/note 不被覆蓋)
    if (url.pathname === '/admin/prospects') {
      if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
      if (!env.CRM) return new Response(JSON.stringify({ ok: false, note: '無 D1' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      await ensureTables(env);
      const status = url.searchParams.get('status'), pool = url.searchParams.get('pool');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);
      let sql = 'SELECT pool, list_no, name, district, online_status, confidence, batch, status, note, contacted_at FROM prospects';
      const where = [], binds = [];
      if (status) { where.push('status=?'); binds.push(status); }
      if (pool) { where.push('pool=?'); binds.push(pool.toUpperCase()); }
      if (where.length) sql += ' WHERE ' + where.join(' AND ');
      sql += ' ORDER BY confidence DESC, batch ASC, pool ASC, list_no ASC LIMIT ' + limit;
      const rows = await env.CRM.prepare(sql).bind(...binds).all();
      const stats = await env.CRM.prepare('SELECT status, COUNT(*) n FROM prospects GROUP BY status').all();
      const by_status = {}; let total = 0;
      for (const r of (stats.results || [])) { by_status[r.status] = r.n; total += r.n; }
      return new Response(JSON.stringify({ ok: true, total, by_status, rows: rows.results || [] }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    if (url.pathname === '/admin/prospects/import' && request.method === 'POST') {
      if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
      if (!env.CRM) return new Response(JSON.stringify({ ok: false, note: '無 D1' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      await ensureTables(env);
      let items;
      try { items = await request.json(); } catch (_) { return new Response(JSON.stringify({ ok: false, note: 'body 要是 JSON 陣列' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }
      if (!Array.isArray(items)) return new Response(JSON.stringify({ ok: false, note: 'body 要是 JSON 陣列' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      const stmt = env.CRM.prepare("INSERT INTO prospects (pool, list_no, name, district, online_status, why, confidence, batch) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(pool, list_no) DO UPDATE SET name=excluded.name, district=excluded.district, online_status=excluded.online_status, why=excluded.why, confidence=excluded.confidence, batch=excluded.batch, updated_at=datetime('now')");
      let imported = 0, skipped = 0;
      for (let i = 0; i < items.length; i += 40) {
        const chunk = items.slice(i, i + 40).filter(p => p && p.pool && p.list_no && p.name);
        skipped += items.slice(i, i + 40).length - chunk.length;
        if (chunk.length) {
          await env.CRM.batch(chunk.map(p => stmt.bind(String(p.pool).toUpperCase(), p.list_no, p.name, p.district || null, p.online_status || null, p.why || null, p.confidence || 1, p.batch || null)));
          imported += chunk.length;
        }
      }
      const c = await env.CRM.prepare('SELECT COUNT(*) n FROM prospects').first();
      return new Response(JSON.stringify({ ok: true, imported, skipped, total: c?.n || 0 }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    // v1.6 ECPay 付款通知 /webhook/ecpay/:brand(POST,ECPay 直打)
    if (url.pathname.startsWith('/webhook/ecpay/') && request.method === 'POST') {
      const brand = url.pathname.split('/')[3] || '';
      if (!brand) return new Response('0|missing brand', { status: 200 });
      return handleECPayWebhook(request, env, brand);
    }

    // v1.6 /admin/outcome-flag:標退貨 / 客訴
    if (url.pathname === '/admin/outcome-flag' && request.method === 'POST') {
      if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
      if (!env.CRM) return new Response(JSON.stringify({ ok: false, note: '無 D1' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      let body;
      try { body = await request.json(); } catch (_) { return new Response(JSON.stringify({ ok: false, note: 'body 要是 JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }
      const { merchant_trade_no, flag, note } = body || {};
      if (!merchant_trade_no || !flag) return new Response(JSON.stringify({ ok: false, note: '缺 merchant_trade_no 或 flag' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      const VALID_FLAGS = ['refund', 'complaint', 'ok', 'pending'];
      if (!VALID_FLAGS.includes(flag)) return new Response(JSON.stringify({ ok: false, note: 'flag 只接受: ' + VALID_FLAGS.join('/') }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      const res = await env.CRM.prepare("UPDATE outcomes SET flag=?, flag_note=?, updated_at=datetime('now') WHERE merchant_trade_no=?").bind(flag, note || null, merchant_trade_no).run().catch(e => ({ error: e.message }));
      if (res.error) return new Response(JSON.stringify({ ok: false, note: res.error }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ ok: true, merchant_trade_no, flag, rows_updated: res.meta?.changes || 0 }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }

    if (url.pathname === '/health') {
      const cfg = await getCfg(env);
      let insights = 0, prospects = 0, outcomes = 0, deliveries = 0;
      if (env.CRM) {
        try { const r = await env.CRM.prepare("SELECT COUNT(*) n FROM q3_seed_insights").first(); insights = r?.n || 0; } catch (_) {}
        try { const r = await env.CRM.prepare("SELECT COUNT(*) n FROM prospects").first(); prospects = r?.n || 0; } catch (_) {}
        try { const r = await env.CRM.prepare("SELECT COUNT(*) n FROM outcomes").first(); outcomes = r?.n || 0; } catch (_) {}
        try { const r = await env.CRM.prepare("SELECT COUNT(*) n FROM q3_line_delivery").first(); deliveries = r?.n || 0; } catch (_) {}
      }
      return new Response(JSON.stringify({ ok: true, worker: '3q-line-oa', worker_ver: WORKER_VER, seed: SEED_VER, secret: !!cfg.lineSecret, token: !!cfg.lineToken, ai: cfg.anthropicKey ? 'claude-sonnet-4-6' : 'workers-ai-70b', owner: !!cfg.ownerId, crm: !!env.CRM, evolved_insights: insights, prospects, outcomes, delay_engine: env.DELAY_DO ? 'on' : 'off', ab_test: env.AB_TEST || 'on', quiet_mode: env.QUIET_MODE || 'on', read_delay: env.READ_DELAY || 'on', genome: !!env.GENOME, stickers: 'on', vision: 'on', deliveries }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/pay') {
      const brand = url.searchParams.get('brand') || '3q';
      let sku = url.searchParams.get('sku') || DEFAULT_SKU;
      // 未知 sku 退回預設商品;金額一律取伺服器固定價,忽略前端傳入的 amount,防竄改
      if (!Object.hasOwn(PRICE_TABLE, sku)) sku = DEFAULT_SKU;
      const product = PRICE_TABLE[sku];
      const amount = product.price;
      const lineUserId = url.searchParams.get('ref') || '';
      const upstream = await fetch(CHECKOUT_URL + '/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brand, sku, items: [{ name: product.name, sku, price: amount, qty: 1 }], line_user_id: lineUserId, client_back_url: SITE + '/?paid=1' }),
      });
      const html = await upstream.text();
      return new Response(html, { status: upstream.status, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/webhook' && request.method === 'POST') {
      const cfg = await getCfg(env);
      const body = await request.text();
      const valid = await verifyLineSignature(body, request.headers.get('x-line-signature'), cfg.lineSecret);
      if (!valid) return new Response('bad signature', { status: 403 });
      const data = JSON.parse(body);
      // ⚡ 土地公模式:先回 200 讓 LINE 安心,AI 思考放背景跑(LINE 等不到回應會掛斷並處決 worker)
      ctx.waitUntil((async () => {
        await ensureTables(env);
        for (const ev of (data.events || [])) {
          await handleEvent(ev, env, cfg).catch(e => console.error('[3q-line] event', e.message));
        }
      })());
      return new Response('ok');
    }
    return new Response('3q hatchery line bot (seed ' + SEED_VER + ')', { status: 200 });
  },
};

export { GO_INTAKE_SERVICE, goIntakeTransition };
