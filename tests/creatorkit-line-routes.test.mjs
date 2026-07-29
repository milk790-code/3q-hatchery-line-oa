import assert from "node:assert/strict";
import test from "node:test";

import worker, { creatorKitRouteTransition } from "../workers/3q-line-oa/worker.js";

const LINE_SECRET = "test-only-line-secret";
const LINE_TOKEN = "test-only-line-token";

function createKv(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    async get(key) { return map.has(key) ? map.get(key) : null; },
    async put(key, value) { map.set(key, String(value)); },
    async delete(key) { map.delete(key); },
  };
}

async function signLineBody(body) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(LINE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function sendWebhook(env, event) {
  const body = JSON.stringify({ events: [event] });
  const pending = [];
  const response = await worker.fetch(
    new Request("https://worker.test/webhook", {
      method: "POST",
      headers: { "x-line-signature": await signLineBody(body) },
      body,
    }),
    env,
    { waitUntil(promise) { pending.push(promise); } },
  );
  await Promise.all(pending);
  return response;
}

test("all six CreatorKit route codes map to the intended tool and opening style", () => {
  const expected = [
    ["CK-爆款拆解-S", "viral", "short"],
    ["CK-爆款拆解-C", "viral", "consult"],
    ["CK-短影音腳本-S", "script", "short"],
    ["CK-短影音腳本-C", "script", "consult"],
    ["CK-多平台改寫-S", "rewrite", "short"],
    ["CK-多平台改寫-C", "rewrite", "consult"],
  ];

  for (const [code, tool, style] of expected) {
    const result = creatorKitRouteTransition(` ${code} `);
    assert.equal(result.handled, true);
    assert.equal(result.routeCode, code);
    assert.equal(result.tool, tool);
    assert.equal(result.style, style);
    assert.match(result.reply, /報價由負責人依需求確認/);
  }
  assert.equal(creatorKitRouteTransition("普通訊息").handled, false);
});

test("the canonical LINE webhook stores a pseudonymous inquiry and replies without a fabricated case URL", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const lineCalls = [];
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes("/v2/bot/message/reply")) lineCalls.push(JSON.parse(options.body));
    return new Response("{}", { status: 200 });
  };

  try {
    const kv = createKv({
      "cfg:3q_line_secret": LINE_SECRET,
      "cfg:3q_line_token": LINE_TOKEN,
      "cfg:3q_owner": "U-owner",
    });
    const event = {
      type: "message",
      webhookEventId: "evt-creator-kit-1",
      replyToken: "reply-1",
      source: { type: "user", userId: "U-private-customer" },
      message: { type: "text", text: "CK-短影音腳本-C" },
    };

    const response = await sendWebhook({ SESSION: kv }, event);
    assert.equal(response.status, 200);
    assert.equal(lineCalls.length, 1);
    assert.match(lineCalls[0].messages[0].text, /短影音腳本/);
    assert.doesNotMatch(lineCalls[0].messages[0].text, /https?:\/\//);

    const inquiryEntries = [...kv.map.entries()].filter(([key]) => key.startsWith("ck-line:v1:inquiry:"));
    assert.equal(inquiryEntries.length, 1);
    assert.equal(inquiryEntries[0][0].includes("U-private-customer"), false);
    assert.equal(inquiryEntries[0][1].includes("U-private-customer"), false);
    assert.deepEqual(JSON.parse(inquiryEntries[0][1]), {
      routeCode: "CK-短影音腳本-C",
      tool: "script",
      style: "consult",
      status: "new",
      createdAt: JSON.parse(inquiryEntries[0][1]).createdAt,
      updatedAt: JSON.parse(inquiryEntries[0][1]).updatedAt,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("only the configured owner can mark a CreatorKit inquiry replied or won", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 200 });
  try {
    const inquiryId = "CKI-A1B2C3D4E5F6";
    const inquiryKey = `ck-line:v1:inquiry:${inquiryId}`;
    const initial = JSON.stringify({
      routeCode: "CK-爆款拆解-S",
      tool: "viral",
      style: "short",
      status: "new",
      createdAt: "2026-07-29T00:00:00.000Z",
      updatedAt: "2026-07-29T00:00:00.000Z",
    });
    const kv = createKv({
      "cfg:3q_line_secret": LINE_SECRET,
      "cfg:3q_line_token": LINE_TOKEN,
      "cfg:3q_owner": "U-owner",
      [inquiryKey]: initial,
    });

    await sendWebhook({ SESSION: kv }, {
      type: "message",
      replyToken: "reply-not-owner",
      source: { type: "user", userId: "U-not-owner" },
      message: { type: "text", text: `${inquiryId} 成交` },
    });
    assert.equal(JSON.parse(kv.map.get(inquiryKey)).status, "new");

    await sendWebhook({ SESSION: kv }, {
      type: "message",
      replyToken: "reply-owner",
      source: { type: "user", userId: "U-owner" },
      message: { type: "text", text: `${inquiryId} 已回覆` },
    });
    assert.equal(JSON.parse(kv.map.get(inquiryKey)).status, "replied");

    await sendWebhook({ SESSION: kv }, {
      type: "message",
      replyToken: "reply-owner-won",
      source: { type: "user", userId: "U-owner" },
      message: { type: "text", text: `${inquiryId} 成交` },
    });
    assert.equal(JSON.parse(kv.map.get(inquiryKey)).status, "won");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
