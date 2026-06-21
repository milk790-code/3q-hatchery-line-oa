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
      if (ev.type === "message" && ev.message?.type === "text") {
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
