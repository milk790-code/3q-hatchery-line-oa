/**
 * luxury-line-oa — 精品私圈 LINE OA Webhook Handler
 * 模式：LINE Webhook → 關鍵字攔截 → cdg-core /chat（brand='luxury'）→ LINE Reply
 * brand_id: luxury | Webhook: POST /
 * 作者：AI 自動生成 | 2026-06-22
 */

// ── 常數 ──────────────────────────────────────────────
const BRAND          = "luxury";
const BRAND_NAME     = "精品私圈";
const CDG_CORE_URL   = "https://cdg-core.milk790.workers.dev";
const LINE_ID        = "@186vktox";
const LINE_URL       = "https://line.me/R/ti/p/@186vktox";

// ── POP /go 三問式免費成果採集(v1) ──────────────────────
const GO_INTAKE_ALLOWED_SOURCES = new Set(["direct", "business-card", "package-insert", "social", "legacy-worker"]);
const GO_INTAKE_FB_SOURCE = /^fb-[0-9a-f]{6}$/;
const GO_INTAKE_CODE = /(?:【)?GO:([a-z0-9-]+):([a-z0-9-]+)(?:】)?/i;
const GO_INTAKE_RESET = /^(重新開始|重來|reset)$/i;
const GO_INTAKE_TTL_SECONDS = 24 * 60 * 60;
const GO_INTAKE_WEBHOOK_TTL_SECONDS = 7 * 24 * 60 * 60;
const GO_FUNNEL_EVENT_TTL_SECONDS = 120 * 24 * 60 * 60;
const GO_FUNNEL_DELIVERY_TTL_SECONDS = 90 * 24 * 60 * 60;
const GO_FUNNEL_EVENTS = new Set(["started", "first_answer", "third_answer", "delivered"]);
const GO_FUNNEL_CASE_PATTERN = /^GO-[A-F0-9]{12}$/;
const GO_INTAKE_SERVICE = Object.freeze({
  slug: "luxury-check",
  hook: "先別急著買，免費做來源、價格與照片疑點初篩。",
  questions: Object.freeze([
    "第 1／3 題｜品牌、款式、賣家來源與開價是多少？",
    "第 2／3 題｜請傳正面、背面、序號／標籤與細節照片；照片傳完後輸入「照片傳完」。",
    "第 3／3 題｜最擔心真偽、價格、品況，還是來源？",
  ]),
  delivery: "我會回一份初篩結果與還需要補證的照片、資料清單。",
  boundary: "每人一次、一件商品；僅為初步資訊整理，不是真偽鑑定、估價保證或購買背書。",
});

function normalizeGoIntakeSource(source) {
  const candidate = String(source || "").trim().toLowerCase();
  return GO_INTAKE_ALLOWED_SOURCES.has(candidate) || GO_INTAKE_FB_SOURCE.test(candidate) ? candidate : "direct";
}

function goFunnelDay(timestamp = Date.now()) {
  return new Date(Number(timestamp) + (8 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

function createGoFunnelMeta(source) {
  const startedAt = Date.now();
  return {
    caseId: "GO-" + crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase(),
    source: normalizeGoIntakeSource(source),
    cohortDay: goFunnelDay(startedAt),
    startedAt,
  };
}

function goFunnelMetaKey(intakeKey) {
  return intakeKey.replace("go-intake:", "go-intake-meta:");
}

function goFunnelEventKey(meta, event) {
  return `go-funnel:v1:${GO_INTAKE_SERVICE.slug}:${meta.cohortDay}:${normalizeGoIntakeSource(meta.source)}:${event}:${meta.caseId}`;
}

async function recordGoFunnelEvent(kv, meta, event, value = "1") {
  if (!kv || !meta || !GO_FUNNEL_CASE_PATTERN.test(meta.caseId) || !GO_FUNNEL_EVENTS.has(event)) return;
  await kv.put(goFunnelEventKey(meta, event), String(value), { expirationTtl: GO_FUNNEL_EVENT_TTL_SECONDS });
}

async function retryGoFunnelWrite(operation) {
  try { return await operation(); } catch (_error) { return operation(); }
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
    await retryGoFunnelWrite(() => kv.delete(goFunnelEventKey(activeMeta, "started")));
  }
  if (isFirstAnswer || (isCompletion && !previousMeta)) await retryGoFunnelWrite(() => kv.delete(goFunnelEventKey(activeMeta, "first_answer")));
  if (isCompletion) {
    await retryGoFunnelWrite(() => kv.delete(goFunnelEventKey(activeMeta, "third_answer")));
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
  let cursor = "";
  do {
    const page = await kv.list(cursor ? { prefix, cursor } : { prefix });
    keys.push(...page.keys);
    cursor = page.list_complete ? "" : page.cursor;
  } while (cursor);
  return keys;
}

async function buildGoFunnelSummary(kv, daysInput) {
  const days = Math.min(90, Math.max(1, Number.parseInt(String(daysInput || "30"), 10) || 30));
  const shiftedNow = Date.now() + (8 * 60 * 60 * 1000);
  const cohortDays = Array.from({ length: days }, (_, index) => (
    new Date(shiftedNow - ((days - index - 1) * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10)
  ));
  const overall = newGoFunnelBucket();
  const bySource = new Map();
  const allowedDays = new Set(cohortDays);
  const keys = await listGoFunnelKeys(kv, `go-funnel:v1:${GO_INTAKE_SERVICE.slug}:`);
  for (const item of keys) {
    const [, , , cohortDay, rawSource, event, caseId] = item.name.split(":");
    if (!allowedDays.has(cohortDay) || !GO_FUNNEL_EVENTS.has(event) || !GO_FUNNEL_CASE_PATTERN.test(caseId)) continue;
    const source = normalizeGoIntakeSource(rawSource);
    if (!bySource.has(source)) bySource.set(source, newGoFunnelBucket(source));
    bySource.get(source)[event].add(caseId);
    overall[event].add(caseId);
    if (event === "delivered") {
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
    feature: "go-funnel-v1",
    slug: GO_INTAKE_SERVICE.slug,
    range: { from: cohortDays[0], to: cohortDays.at(-1), days },
    totals: goFunnelStats(overall),
    sources: [...bySource.values()].sort((a, b) => a.source.localeCompare(b.source)).map(goFunnelStats),
    definitions: {
      firstAnswerRate: "firstAnswers / starts",
      thirdAnswerRate: "thirdAnswers / starts",
      deliveryRate: "deliveries / starts",
      averageDeliveryMinutes: "三題完成到人工標記成果已交付的平均分鐘；沒有已交付案件時為 null",
    },
  };
}

async function safeGoFunnelAdminKey(request, expected) {
  if (!expected) return false;
  const encoder = new TextEncoder();
  const supplied = request.headers.get("X-Admin-Key") || "";
  const [suppliedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(suppliedHash), right = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0 && supplied.length > 0;
}

function goFunnelJson(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function markGoFunnelDelivered(kv, rawCaseId) {
  const caseId = String(rawCaseId || "").trim().toUpperCase();
  if (!GO_FUNNEL_CASE_PATTERN.test(caseId)) return { status: 400, body: { ok: false, error: "invalid caseId" } };
  const receiptRaw = await kv.get(`go-delivery:v1:${GO_INTAKE_SERVICE.slug}:${caseId}`);
  if (!receiptRaw) return { status: 404, body: { ok: false, error: "case not found" } };
  let receipt;
  try { receipt = JSON.parse(receiptRaw); } catch (_error) { return { status: 409, body: { ok: false, error: "invalid receipt" } }; }
  if (receipt.slug !== GO_INTAKE_SERVICE.slug || !/^\d{4}-\d{2}-\d{2}$/.test(receipt.cohortDay || "")) {
    return { status: 409, body: { ok: false, error: "receipt mismatch" } };
  }
  const meta = { caseId, source: normalizeGoIntakeSource(receipt.source), cohortDay: receipt.cohortDay };
  const eventKey = goFunnelEventKey(meta, "delivered");
  const existing = await kv.get(eventKey);
  if (existing !== null) {
    return { status: 200, body: { ok: true, caseId, deliveryMinutes: Number(existing), duplicate: true } };
  }
  const completedAt = Number(receipt.completedAt);
  if (!Number.isFinite(completedAt) || completedAt <= 0) return { status: 409, body: { ok: false, error: "invalid completion time" } };
  const deliveryMinutes = Math.max(0, Math.round(((Date.now() - completedAt) / 60000) * 10) / 10);
  await retryGoFunnelWrite(() => recordGoFunnelEvent(kv, meta, "started"));
  await retryGoFunnelWrite(() => recordGoFunnelEvent(kv, meta, "first_answer"));
  await retryGoFunnelWrite(() => recordGoFunnelEvent(kv, meta, "third_answer"));
  await retryGoFunnelWrite(() => recordGoFunnelEvent(kv, meta, "delivered", deliveryMinutes));
  return { status: 200, body: { ok: true, caseId, deliveryMinutes, duplicate: false } };
}

async function handleGoFunnelAdmin(request, env, kv) {
  if (!kv || !env.GO_FUNNEL_ADMIN_KEY) return goFunnelJson({ ok: false, error: "go funnel admin not configured" }, 503);
  if (!await safeGoFunnelAdminKey(request, env.GO_FUNNEL_ADMIN_KEY)) return goFunnelJson({ ok: false, error: "unauthorized" }, 401);
  const url = new URL(request.url);
  if (url.pathname === "/admin/go-funnel" && request.method === "GET") {
    return goFunnelJson(await buildGoFunnelSummary(kv, url.searchParams.get("days")));
  }
  if (url.pathname === "/admin/go-funnel/delivered" && request.method === "POST") {
    const declaredLength = Number(request.headers.get("content-length") || "0");
    if (declaredLength > 1024) return goFunnelJson({ ok: false, error: "payload too large" }, 413);
    const bodyText = await request.text();
    if (bodyText.length > 1024) return goFunnelJson({ ok: false, error: "payload too large" }, 413);
    let body;
    try { body = JSON.parse(bodyText); } catch (_error) { return goFunnelJson({ ok: false, error: "invalid json" }, 400); }
    const result = await markGoFunnelDelivered(kv, body.caseId);
    return goFunnelJson(result.body, result.status);
  }
  return goFunnelJson({ ok: false, error: "method not allowed" }, 405);
}

function goIntakeQuestion(step) {
  return `${GO_INTAKE_SERVICE.hook}\n\n${GO_INTAKE_SERVICE.questions[step]}`
    + "\n\n隱私提醒：購買紀錄、對話與照片請先遮姓名、電話、帳號與付款資料。輸入「重新開始」可退出。";
}

function goIntakeTransition({ text, state }) {
  const input = String(text || "").trim();
  if (GO_INTAKE_RESET.test(input)) {
    return { handled: true, state: null, reply: "已清除這次採集進度。回到 POP 免費接線台即可重新開始。" };
  }
  if (state) {
    if (state.slug !== GO_INTAKE_SERVICE.slug) {
      return { handled: true, state: null, reply: "這次進度已失效，請從 POP 免費接線台重新選擇。" };
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
      reply: `三題已收齊。${GO_INTAKE_SERVICE.delivery}\n\n免費範圍：${GO_INTAKE_SERVICE.boundary}`
        + "\n請不要再補傳未遮蔽的身分證、付款卡號或完整合約個資。",
    };
  }
  const match = input.match(GO_INTAKE_CODE);
  if (!match || match[1] !== GO_INTAKE_SERVICE.slug) return { handled: false, state: null, reply: null };
  const nextState = { slug: GO_INTAKE_SERVICE.slug, source: normalizeGoIntakeSource(match[2]), step: 0 };
  return { handled: true, state: nextState, reply: goIntakeQuestion(0) };
}

async function goIntakeStorageKey(userId, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(userId));
  return `go-intake:${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function goIntakeWebhookKey(webhookEventId) {
  const value = String(webhookEventId || "").trim();
  if (!value) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `go-intake-webhook:v1:${GO_INTAKE_SERVICE.slug}:` + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function rememberGoIntakeWebhook(kv, webhookKey) {
  if (webhookKey) await kv.put(webhookKey, "1", { expirationTtl: GO_INTAKE_WEBHOOK_TTL_SECONDS });
}

async function maybeHandleGoIntake(ev, env) {
  if (ev.type !== "message" || !ev.source?.userId || !ev.replyToken || !env.KV || !env.LINE_CHANNEL_SECRET) return false;
  const key = await goIntakeStorageKey(ev.source.userId, env.LINE_CHANNEL_SECRET);
  const webhookKey = await goIntakeWebhookKey(ev.webhookEventId);
  if (webhookKey && await env.KV.get(webhookKey)) return true;
  const metaKey = goFunnelMetaKey(key);
  const [raw, metaRaw] = await Promise.all([env.KV.get(key), env.KV.get(metaKey)]);
  let state = null, meta = null;
  if (raw) { try { state = JSON.parse(raw); } catch (_error) {} }
  if (metaRaw) { try { meta = JSON.parse(metaRaw); } catch (_error) {} }
  const previousState = state;
  const previousMeta = meta;
  if (ev.message?.type !== "text") {
    if (!state) return false;
    const replySent = await replyLine(ev.replyToken, ["照片已收到，可以繼續傳；傳完後請輸入「照片傳完」，我再問下一題。"], env.LINE_CHANNEL_ACCESS_TOKEN);
    if (replySent) await retryGoFunnelWrite(() => rememberGoIntakeWebhook(env.KV, webhookKey)).catch(() => {});
    return true;
  }
  const result = goIntakeTransition({ text: ev.message.text, state });
  if (!result.handled) return false;
  let replyText = result.reply;
  const isStart = !state && Number(result.state?.step) === 0;
  const isFirstAnswer = state?.slug === GO_INTAKE_SERVICE.slug && Number(state.step) === 0 && Number(result.state?.step) === 1;
  const isCompletion = state?.slug === GO_INTAKE_SERVICE.slug && Number(state.step) === 2 && result.state === null && !GO_INTAKE_RESET.test(String(ev.message.text || "").trim());
  let trackingFailed = false;
  try {
    if (!state && Number(result.state?.step) === 0) {
      meta = createGoFunnelMeta(result.state.source);
      await env.KV.put(metaKey, JSON.stringify(meta), { expirationTtl: GO_INTAKE_TTL_SECONDS });
      await recordGoFunnelEvent(env.KV, meta, "started");
    } else if (isFirstAnswer) {
      if (!meta) {
        meta = createGoFunnelMeta(state.source);
        await env.KV.put(metaKey, JSON.stringify(meta), { expirationTtl: GO_INTAKE_TTL_SECONDS });
      }
      await Promise.all([
        recordGoFunnelEvent(env.KV, meta, "started"),
        recordGoFunnelEvent(env.KV, meta, "first_answer"),
      ]);
    } else if (isCompletion) {
      if (!meta) {
        meta = createGoFunnelMeta(state.source);
        await env.KV.put(metaKey, JSON.stringify(meta), { expirationTtl: GO_INTAKE_TTL_SECONDS });
      }
      const completedAt = Date.now();
      await retryGoFunnelWrite(() => env.KV.put(`go-delivery:v1:${GO_INTAKE_SERVICE.slug}:${meta.caseId}`, JSON.stringify({
          slug: GO_INTAKE_SERVICE.slug,
          source: normalizeGoIntakeSource(meta.source),
          cohortDay: meta.cohortDay,
          completedAt,
        }), { expirationTtl: GO_FUNNEL_DELIVERY_TTL_SECONDS }));
      replyText += `\n\n案件碼：${meta.caseId}（只用於交付計時，不含你的資料）`;
      await retryGoFunnelWrite(() => recordGoFunnelEvent(env.KV, meta, "started"));
      await retryGoFunnelWrite(() => recordGoFunnelEvent(env.KV, meta, "first_answer"));
      await retryGoFunnelWrite(() => recordGoFunnelEvent(env.KV, meta, "third_answer"));
    }
  } catch (error) {
    console.error(JSON.stringify({ event: "go_funnel_write_error", slug: GO_INTAKE_SERVICE.slug, message: String(error?.message || error) }));
    if (isCompletion) {
      trackingFailed = true;
      replyText = "第 3 題已收到，但案件碼暫時無法建立。請稍後再傳「完成」，我會從這題重試，不用重填前兩題。";
    }
  }
  if (trackingFailed) {
    await retryGoFunnelWrite(() => env.KV.put(key, JSON.stringify(previousState), { expirationTtl: GO_INTAKE_TTL_SECONDS }));
    if (meta) await retryGoFunnelWrite(() => env.KV.put(metaKey, JSON.stringify(meta), { expirationTtl: GO_INTAKE_TTL_SECONDS }));
  } else if (result.state) await retryGoFunnelWrite(() => env.KV.put(key, JSON.stringify(result.state), { expirationTtl: GO_INTAKE_TTL_SECONDS }));
  else {
    await retryGoFunnelWrite(() => env.KV.delete(key));
    await retryGoFunnelWrite(() => env.KV.delete(metaKey));
  }
  const replySent = await replyLine(ev.replyToken, [replyText], env.LINE_CHANNEL_ACCESS_TOKEN);
  if (!replySent) {
    await rollbackGoIntakeReplyFailure(env.KV, {
      key, metaKey, previousState, previousMeta, activeMeta: meta, isStart, isFirstAnswer, isCompletion,
    }).catch((error) => console.error(JSON.stringify({ event: "go_intake_reply_rollback_error", slug: GO_INTAKE_SERVICE.slug, message: String(error?.message || error) })));
    return true;
  }
  if (trackingFailed) return true;
  await retryGoFunnelWrite(() => rememberGoIntakeWebhook(env.KV, webhookKey)).catch(() => {});
  return true;
}

function goIntakeHealthResponse() {
  return new Response(JSON.stringify({ ok: true, feature: "go-intake-v1", slug: GO_INTAKE_SERVICE.slug, questions: 3 }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

const RICHMENU_NAME  = "luxury-main-v1";
const RICHMENU_IMG   = "https://raw.githubusercontent.com/milk790-code/3q-hatchery-line-oa/main/assets/luxury/richmenu_luxury.png";

// 六格關鍵字快回（不走 AI，即時回）
const KEYWORD_REPLIES = {
  "品項代尋": `你好，請告訴我你在找哪類精品？

包款、珠寶、腕錶、保養品都可以，說個型號或品牌方向，我給你目前市場能找到的情況。`,

  "真偽鑑賞": `請傳幾張清晰照片給我，我協助拆解幾個鑑賞重點——

刻字、縫線、五金、皮料紋理這幾個面向，我會一一說明該注意什麼。

最終鑑定建議還是交給專業機構，我的角色是幫你把眼睛練起來。`,

  "行情參考": `請告訴我品項的型號和大致成色，我給你近期市場行情區間參考。

聲明：行情會浮動，我給的是現階段觀察到的合理範圍，不是報價也不是保證。`,

  "私圈邀請": `私圈採邀請制，不對外公開。

請留下你目前關注的品類方向，由真人顧問審核後發送邀請碼，通常一個工作天內回覆。`,

  "預約看貨": `請告訴我你方便的時段和感興趣的品項，真人顧問會與你確認看貨細節。

看貨前不需要任何承諾，純粹讓你先看清楚再決定。`,

  "轉真人": `好，幫你轉接真人顧問，請稍待片刻。

如果等候超過三分鐘，也可以直接加我們的顧問 LINE：${LINE_ID}

或點這裡：${LINE_URL}`
};

// ── LINE 簽名驗證 ──────────────────────────────────────
async function verifySignature(body, signature, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return expected === signature;
}

// ── LINE API helpers ───────────────────────────────────
async function replyLine(replyToken, messages, token) {
  const msgs = messages.map(m =>
    typeof m === "string" ? { type: "text", text: m } : m
  );
  try {
    const response = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ replyToken, messages: msgs })
    });
    return response.ok;
  } catch (_error) {
    return false;
  }
}

async function pushLine(userId, messages, token) {
  const msgs = messages.map(m =>
    typeof m === "string" ? { type: "text", text: m } : m
  );
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ to: userId, messages: msgs })
  });
}

// ── cdg-core 呼叫 ──────────────────────────────────────
async function askCdgCore(env, userId, text) {
  const res = await fetch(`${CDG_CORE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brand: BRAND, sid: userId, message: text })
  });
  if (!res.ok) throw new Error(`cdg-core error: ${res.status}`);
  const j = await res.json();
  return j.reply || "（暫時無法回應，請稍後再試）";
}

// ── 事件處理 ───────────────────────────────────────────
async function onText(ev, env) {
  const userId = ev.source?.userId || "anon";
  const text   = (ev.message?.text || "").trim();
  const token  = env.LINE_CHANNEL_ACCESS_TOKEN;

  // 關鍵字快回
  if (KEYWORD_REPLIES[text]) {
    return replyLine(ev.replyToken, [KEYWORD_REPLIES[text]], token);
  }

  // AI 回應
  try {
    const reply = await askCdgCore(env, userId, text);
    return replyLine(ev.replyToken, [reply], token);
  } catch (e) {
    console.error("cdg-core error:", e.message);
    return replyLine(ev.replyToken, ["稍等一下，我整理一下再回你。"], token);
  }
}

async function onFollow(ev, env) {
  const token = env.LINE_CHANNEL_ACCESS_TOKEN;
  await replyLine(ev.replyToken, [
    `你好，我是${BRAND_NAME}的 AI 顧問，懂貨的朋友，隨時在。

我們中立、不擔保真偽也不喊保值，只幫你把行情和真假的判斷重點看清楚。

想找什麼品項，跟我說，我給你行情區間和該注意的真偽重點。要看貨，幫你預約真人。

LINE：${LINE_ID}`
  ], token);
  // 設定 Rich Menu
  await setupRichMenu(env);
}

async function handleEvents(events, env) {
  for (const ev of events) {
    try {
      if (await maybeHandleGoIntake(ev, env)) {
        continue;
      } else if (ev.type === "message" && ev.message?.type === "text") {
        await onText(ev, env);
      } else if (ev.type === "follow") {
        await onFollow(ev, env);
      }
    } catch (e) {
      console.error("event error:", e.message);
    }
  }
}

// ── Rich Menu 6-grid 建立 ──────────────────────────────
async function setupRichMenu(env) {
  const token = env.LINE_CHANNEL_ACCESS_TOKEN;
  // 檢查是否已存在
  const existing = await env.KV?.get("luxury_rich_menu_id");
  if (existing) return existing;

  // 建立 Rich Menu
  const menu = {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: RICHMENU_NAME,
    chatBarText: "精品服務選單",
    areas: [
      // Row 1
      { bounds: { x:    0, y:   0, width: 833, height: 843 }, action: { type: "message", label: "品項代尋", text: "品項代尋" } },
      { bounds: { x:  833, y:   0, width: 833, height: 843 }, action: { type: "message", label: "真偽鑑賞", text: "真偽鑑賞" } },
      { bounds: { x: 1666, y:   0, width: 834, height: 843 }, action: { type: "message", label: "行情參考", text: "行情參考" } },
      // Row 2
      { bounds: { x:    0, y: 843, width: 833, height: 843 }, action: { type: "message", label: "私圈邀請", text: "私圈邀請" } },
      { bounds: { x:  833, y: 843, width: 833, height: 843 }, action: { type: "message", label: "預約看貨", text: "預約看貨" } },
      { bounds: { x: 1666, y: 843, width: 834, height: 843 }, action: { type: "message", label: "轉真人",   text: "轉真人"   } }
    ]
  };

  const res = await fetch("https://api.line.me/v2/bot/richmenu", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(menu)
  });
  if (!res.ok) throw new Error(`richmenu create failed: ${res.status}`);
  const { richMenuId } = await res.json();
  if (!richMenuId) return null;

  // 上傳圖片
  const imgRes = await fetch(RICHMENU_IMG);
  if (!imgRes.ok) throw new Error(`richmenu image fetch failed: ${imgRes.status}`);
  const imgBuf = await imgRes.arrayBuffer();
  await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(imgBuf.byteLength),
      "Authorization": `Bearer ${token}`
    },
    body: imgBuf
  });

  // 設為預設 Rich Menu
  await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` }
  });

  // 存入 KV
  await env.KV?.put("luxury_rich_menu_id", richMenuId);
  console.log("Rich Menu deployed:", richMenuId);
  return richMenuId;
}

// ── Admin: 手動觸發 Rich Menu 部署 ─────────────────────
async function handleAdmin(request, env, pathname) {
  if (!env.ADMIN_KEY) {
    return new Response(JSON.stringify({ error: "admin not configured" }), { status: 503 });
  }
  const adminKey = request.headers.get("X-Admin-Key") || "";
  if (adminKey !== env.ADMIN_KEY) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  if (pathname === "/admin/deploy-richmenu" && request.method === "POST") {
    const id = await setupRichMenu(env);
    return new Response(JSON.stringify({ ok: true, richMenuId: id }), {
      headers: { "content-type": "application/json" }
    });
  }
  if (pathname === "/admin/set-paid-client" && request.method === "POST") {
    const body = await request.json();
    const { line_uid, paid = true } = body;
    if (!line_uid) return new Response(JSON.stringify({ error: "line_uid required" }), { status: 400 });
    const key = `paid_client:${BRAND}:${line_uid}`;
    paid
      ? await env.KV.put(key, "1", { expirationTtl: 60 * 60 * 24 * 365 })
      : await env.KV.delete(key);
    return new Response(JSON.stringify({ ok: true, line_uid, paid }), {
      headers: { "content-type": "application/json" }
    });
  }
  return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
}

// ── 主入口 ─────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/go-intake-health") return goIntakeHealthResponse();
    if (path === "/admin/go-funnel" || path === "/admin/go-funnel/delivered") return handleGoFunnelAdmin(request, env, env.KV);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type,X-Admin-Key,X-Line-Signature"
        }
      });
    }

    if (path.startsWith("/admin/")) return handleAdmin(request, env, path);

    if (path === "/health") {
      return new Response(JSON.stringify({
        ok: true, brand: BRAND, ts: Date.now(), version: "v1.0"
      }), { headers: { "content-type": "application/json" } });
    }

    // LINE Webhook
    if (request.method !== "POST") {
      return new Response(`${BRAND_NAME} LINE OA — OK`, { headers: { "content-type": "text/plain" } });
    }

    if (!env.LINE_CHANNEL_SECRET) {
      return new Response("LINE channel secret missing", { status: 503 });
    }
    if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
      return new Response("LINE channel access token missing", { status: 503 });
    }

    const rawBody = await request.text();
    const sig = request.headers.get("x-line-signature") || "";

    // 簽名驗證
    const valid = await verifySignature(rawBody, sig, env.LINE_CHANNEL_SECRET);
    if (!valid) return new Response("Unauthorized", { status: 401 });

    let body;
    try { body = JSON.parse(rawBody); } catch { return new Response("Bad JSON", { status: 400 }); }

    ctx.waitUntil(handleEvents(body.events || [], env));
    return new Response("OK");
  }
};

export { GO_INTAKE_SERVICE, goIntakeTransition };
