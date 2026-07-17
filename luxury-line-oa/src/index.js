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

async function maybeHandleGoIntake(ev, env) {
  if (ev.type !== "message" || !ev.source?.userId || !ev.replyToken || !env.KV || !env.LINE_CHANNEL_SECRET) return false;
  const key = await goIntakeStorageKey(ev.source.userId, env.LINE_CHANNEL_SECRET);
  const raw = await env.KV.get(key);
  let state = null;
  if (raw) { try { state = JSON.parse(raw); } catch (_error) {} }
  if (ev.message?.type !== "text") {
    if (!state) return false;
    await replyLine(ev.replyToken, ["照片已收到，可以繼續傳；傳完後請輸入「照片傳完」，我再問下一題。"], env.LINE_CHANNEL_ACCESS_TOKEN);
    return true;
  }
  const result = goIntakeTransition({ text: ev.message.text, state });
  if (!result.handled) return false;
  if (result.state) await env.KV.put(key, JSON.stringify(result.state), { expirationTtl: GO_INTAKE_TTL_SECONDS });
  else await env.KV.delete(key);
  await replyLine(ev.replyToken, [result.reply], env.LINE_CHANNEL_ACCESS_TOKEN);
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
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: msgs })
  });
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
