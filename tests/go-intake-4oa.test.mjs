import assert from "node:assert/strict";
import test from "node:test";

const WORKERS = [
  {
    label: "品牌內容",
    path: "../workers/3q-line-oa/worker.js",
    slug: "brand-content",
    firstQuestion: /第 1／3 題/,
  },
  {
    label: "租屋風險",
    path: "../workers/tudigong/worker.js",
    slug: "rental-check",
    firstQuestion: /第 1／3 題/,
  },
  {
    label: "精品初篩",
    path: "../luxury-line-oa/src/index.js",
    slug: "luxury-check",
    firstQuestion: /第 1／3 題/,
  },
  {
    label: "POP 汽美",
    path: "../workers/pop-line-oa/worker.js",
    slug: "auto-care",
    firstQuestion: /第 1／3 題/,
  },
];

for (const worker of WORKERS) {
  test(`${worker.label} only accepts its own /go slug and starts question one`, async () => {
    const module = await import(worker.path);
    assert.equal(module.GO_INTAKE_SERVICE.slug, worker.slug);

    const ignored = module.goIntakeTransition({
      text: "【GO:not-this-worker:social】",
      state: null,
    });
    assert.equal(ignored.handled, false);

    const started = module.goIntakeTransition({
      text: `你好【GO:${worker.slug}:social】`,
      state: null,
    });
    assert.equal(started.handled, true);
    assert.deepEqual(started.state, {
      slug: worker.slug,
      source: "social",
      step: 0,
    });
    assert.match(started.reply, worker.firstQuestion);
  });

  test(`${worker.label} completes three answers without persisting raw answers`, async () => {
    const module = await import(worker.path);
    let current = module.goIntakeTransition({
      text: `【GO:${worker.slug}:fb-a12f09】`,
      state: null,
    });

    for (const answer of ["第一個敏感答案", "第二個敏感答案", "第三個敏感答案"]) {
      current = module.goIntakeTransition({ text: answer, state: current.state });
      assert.equal(JSON.stringify(current.state).includes(answer), false);
    }

    assert.equal(current.handled, true);
    assert.equal(current.state, null);
    assert.match(current.reply, /三題已收齊/);
    assert.match(current.reply, /免費範圍/);
  });

  test(`${worker.label} reset clears progress and source falls back to direct`, async () => {
    const module = await import(worker.path);
    const started = module.goIntakeTransition({
      text: `GO:${worker.slug}:evil-query`,
      state: null,
    });
    assert.equal(started.state.source, "direct");

    const reset = module.goIntakeTransition({
      text: "重新開始",
      state: started.state,
    });
    assert.equal(reset.handled, true);
    assert.equal(reset.state, null);
    assert.match(reset.reply, /已清除/);
  });

  test(`${worker.label} exposes a safe deployment health marker`, async () => {
    const module = await import(worker.path);
    const response = await module.default.fetch(
      new Request("https://worker.test/go-intake-health"),
      {},
      { waitUntil() {} },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      feature: "go-intake-v1",
      slug: worker.slug,
      questions: 3,
    });
  });
}

function createKv() {
  const map = new Map();
  return {
    map,
    async get(key) { return map.has(key) ? map.get(key) : null; },
    async put(key, value) { map.set(key, value); },
    async delete(key) { map.delete(key); },
  };
}

async function signLineBody(body, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

test("all four production webhook handlers persist only intake progress and send question one", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const lineCalls = [];
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes("api.line.me/v2/bot/message/reply")) {
      lineCalls.push(JSON.parse(options.body));
    }
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const secret = "test-only-line-secret";
    const token = "test-only-line-token";
    for (const worker of WORKERS) {
      lineCalls.length = 0;
      const module = await import(worker.path);
      const kv = createKv();
      const pending = [];
      const ctx = { waitUntil(promise) { pending.push(promise); } };
      const env = worker.slug === "brand-content"
        ? { SESSION: kv, Q3_LINE_SECRET: secret, Q3_LINE_TOKEN: token, SETUP_KEY: "test" }
        : worker.slug === "auto-care"
          ? { SESSION: kv, POP_LINE_SECRET: secret, POP_LINE_TOKEN: token, SETUP_KEY: "test" }
          : worker.slug === "rental-check"
            ? { STATE: kv, LINE_CHANNEL_SECRET: secret, LINE_CHANNEL_ACCESS_TOKEN: token, SETUP_KEY: "test" }
            : { KV: kv, LINE_CHANNEL_SECRET: secret, LINE_CHANNEL_ACCESS_TOKEN: token };
      const webhookPath = ["brand-content", "auto-care"].includes(worker.slug) ? "/webhook" : "/";
      const body = JSON.stringify({
        events: [{
          type: "message",
          replyToken: "reply-token",
          source: { type: "user", userId: `U-${worker.slug}` },
          message: { type: "text", text: `你好【GO:${worker.slug}:social】` },
        }],
      });
      const response = await module.default.fetch(
        new Request(`https://worker.test${webhookPath}`, {
          method: "POST",
          headers: { "x-line-signature": await signLineBody(body, secret) },
          body,
        }),
        env,
        ctx,
      );
      await Promise.all(pending);

      assert.equal(response.status, 200, worker.label);
      const intakeEntries = [...kv.map.entries()].filter(([key]) => key.startsWith("go-intake:"));
      assert.equal(intakeEntries.length, 1, `${worker.label} stored one pseudonymous intake state`);
      assert.equal(intakeEntries[0][0].includes(`U-${worker.slug}`), false);
      assert.deepEqual(JSON.parse(intakeEntries[0][1]), {
        slug: worker.slug,
        source: "social",
        step: 0,
      });
      assert.equal(lineCalls.length, 1, `${worker.label} sent one LINE reply`);
      assert.match(lineCalls[0].messages[0].text, /第 1／3 題/);

      lineCalls.length = 0;
      pending.length = 0;
      const mediaBody = JSON.stringify({
        events: [{
          type: "message",
          replyToken: "media-reply-token",
          source: { type: "user", userId: `U-${worker.slug}` },
          message: { type: "image", id: "image-id" },
        }],
      });
      const mediaResponse = await module.default.fetch(
        new Request(`https://worker.test${webhookPath}`, {
          method: "POST",
          headers: { "x-line-signature": await signLineBody(mediaBody, secret) },
          body: mediaBody,
        }),
        env,
        ctx,
      );
      await Promise.all(pending);
      assert.equal(mediaResponse.status, 200);
      assert.equal(JSON.parse(kv.map.get(intakeEntries[0][0])).step, 0, `${worker.label} media does not consume an answer`);
      assert.equal(lineCalls.length, 1, `${worker.label} acknowledges intake media once`);
      assert.match(lineCalls[0].messages[0].text, /已收到.*輸入/s);

      for (let answerIndex = 0; answerIndex < 3; answerIndex += 1) {
        lineCalls.length = 0;
        pending.length = 0;
        const rawAnswer = `private-answer-${answerIndex + 1}-${worker.slug}`;
        const answerBody = JSON.stringify({
          events: [{
            type: "message",
            replyToken: `answer-reply-token-${answerIndex + 1}`,
            source: { type: "user", userId: `U-${worker.slug}` },
            message: { type: "text", text: rawAnswer },
          }],
        });
        await module.default.fetch(
          new Request(`https://worker.test${webhookPath}`, {
            method: "POST",
            headers: { "x-line-signature": await signLineBody(answerBody, secret) },
            body: answerBody,
          }),
          env,
          ctx,
        );
        await Promise.all(pending);

        assert.equal(lineCalls.length, 1, `${worker.label} replied to answer ${answerIndex + 1}`);
        if (answerIndex < 2) {
          const storedProgress = kv.map.get(intakeEntries[0][0]);
          assert.equal(storedProgress.includes(rawAnswer), false);
          assert.equal(JSON.parse(storedProgress).step, answerIndex + 1);
        } else {
          assert.equal(kv.map.has(intakeEntries[0][0]), false, `${worker.label} clears state after question three`);
          assert.match(lineCalls[0].messages[0].text, /三題已收齊/);
        }
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
