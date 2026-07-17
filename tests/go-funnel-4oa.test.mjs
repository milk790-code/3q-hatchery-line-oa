import assert from "node:assert/strict";
import test from "node:test";

const ADMIN_KEY = "test-only-go-funnel-admin-key";
const LINE_SECRET = "test-only-line-secret";
const LINE_TOKEN = "test-only-line-token";

const WORKERS = [
  { label: "品牌內容", path: "../workers/3q-line-oa/worker.js", worker: "3q-line-oa", slug: "brand-content", webhookPath: "/webhook", kvBinding: "SESSION" },
  { label: "租屋風險", path: "../workers/tudigong/worker.js", worker: "tudigong-line-oa", slug: "rental-check", webhookPath: "/", kvBinding: "STATE" },
  { label: "精品初篩", path: "../luxury-line-oa/src/index.js", worker: "luxury-line-oa", slug: "luxury-check", webhookPath: "/", kvBinding: "KV" },
  { label: "POP 汽美", path: "../workers/pop-line-oa/worker.js", worker: "pop-line-oa", slug: "auto-care", webhookPath: "/webhook", kvBinding: "SESSION" },
];

function createKv() {
  const map = new Map();
  return {
    map,
    async get(key) { return map.has(key) ? map.get(key) : null; },
    async put(key, value) { map.set(key, String(value)); },
    async delete(key) { map.delete(key); },
    async list({ prefix = "", cursor, limit = 1000 } = {}) {
      const names = [...map.keys()].filter((key) => key.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const keys = names.slice(start, start + limit).map((name) => ({ name }));
      const next = start + keys.length;
      return {
        keys,
        list_complete: next >= names.length,
        cursor: next >= names.length ? "" : String(next),
      };
    },
  };
}

async function signLineBody(body) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(LINE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

function createEnv(worker, kv) {
  const shared = { GO_FUNNEL_ADMIN_KEY: ADMIN_KEY, ADMIN_KEY: "legacy-admin-key", SETUP_KEY: "legacy-setup-key" };
  if (worker.slug === "brand-content") {
    return { ...shared, SESSION: kv, Q3_LINE_SECRET: LINE_SECRET, Q3_LINE_TOKEN: LINE_TOKEN };
  }
  if (worker.slug === "auto-care") {
    return { ...shared, SESSION: kv, POP_LINE_SECRET: LINE_SECRET, POP_LINE_TOKEN: LINE_TOKEN };
  }
  if (worker.slug === "rental-check") {
    return { ...shared, STATE: kv, LINE_CHANNEL_SECRET: LINE_SECRET, LINE_CHANNEL_ACCESS_TOKEN: LINE_TOKEN };
  }
  return { ...shared, KV: kv, LINE_CHANNEL_SECRET: LINE_SECRET, LINE_CHANNEL_ACCESS_TOKEN: LINE_TOKEN };
}

async function sendLineEvent(module, worker, env, userId, text, replyToken, eventOverrides = {}) {
  const body = JSON.stringify({
    events: [{
      type: "message",
      replyToken,
      source: { type: "user", userId },
      message: { type: "text", text },
      ...eventOverrides,
    }],
  });
  const pending = [];
  const response = await module.default.fetch(
    new Request(`https://worker.test${worker.webhookPath}`, {
      method: "POST",
      headers: { "x-line-signature": await signLineBody(body) },
      body,
    }),
    env,
    { waitUntil(promise) { pending.push(promise); } },
  );
  await Promise.all(pending);
  assert.equal(response.status, 200, `${worker.label} webhook status`);
}

for (const worker of WORKERS) {
  test(`${worker.label} ignores LINE webhook redelivery instead of advancing the intake`, { concurrency: false }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    try {
      const module = await import(worker.path);
      const kv = createKv();
      const env = createEnv(worker, kv);
      const userId = `U-redelivery-${worker.slug}`;

      await sendLineEvent(module, worker, env, userId, `【GO:${worker.slug}:social】`, "start-original", {
        webhookEventId: `evt-start-${worker.slug}`,
        deliveryContext: { isRedelivery: false },
      });
      await sendLineEvent(module, worker, env, userId, `【GO:${worker.slug}:social】`, "start-redelivery", {
        webhookEventId: `evt-start-${worker.slug}`,
        deliveryContext: { isRedelivery: true },
      });

      const eventKeys = [...kv.map.keys()].filter((key) => key.startsWith(`go-funnel:v1:${worker.slug}:`));
      assert.equal(eventKeys.filter((key) => key.includes(":started:")).length, 1);
      assert.equal(eventKeys.filter((key) => key.includes(":first_answer:")).length, 0);
      assert.equal([...kv.map.keys()].filter((key) => key.startsWith(`go-intake-webhook:v1:${worker.slug}:`)).length, 1);
      const summary = await (await fetchSummary(module, env)).json();
      assert.equal(summary.totals.starts, 1);
      assert.equal(summary.totals.firstAnswers, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test(`${worker.label} heals a partial start-event write when the first answer arrives`, { concurrency: false }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    try {
      const module = await import(worker.path);
      const kv = createKv();
      const basePut = kv.put.bind(kv);
      let failedStartOnce = false;
      kv.put = async (key, value, options) => {
        if (!failedStartOnce && key.includes(`go-funnel:v1:${worker.slug}:`) && key.includes(":started:")) {
          failedStartOnce = true;
          throw new Error("simulated one-time funnel event failure");
        }
        return basePut(key, value, options);
      };
      const env = createEnv(worker, kv);
      const userId = `U-partial-${worker.slug}`;

      await sendLineEvent(module, worker, env, userId, `【GO:${worker.slug}:direct】`, "partial-start");
      await sendLineEvent(module, worker, env, userId, "first answer", "partial-first-answer");

      const eventKeys = [...kv.map.keys()].filter((key) => key.startsWith(`go-funnel:v1:${worker.slug}:`));
      assert.equal(eventKeys.filter((key) => key.includes(":started:")).length, 1);
      assert.equal(eventKeys.filter((key) => key.includes(":first_answer:")).length, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test(`${worker.label} retries a transient third-answer event failure and still issues a deliverable case`, { concurrency: false }, async () => {
    const originalFetch = globalThis.fetch;
    const lineCalls = [];
    globalThis.fetch = async (url, options = {}) => {
      if (String(url).includes("api.line.me/v2/bot/message/reply")) lineCalls.push(JSON.parse(options.body));
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    };
    try {
      const module = await import(worker.path);
      const kv = createKv();
      const basePut = kv.put.bind(kv);
      let failedThirdOnce = false;
      kv.put = async (key, value, options) => {
        if (!failedThirdOnce && key.includes(`go-funnel:v1:${worker.slug}:`) && key.includes(":third_answer:")) {
          failedThirdOnce = true;
          throw new Error("simulated one-time terminal event failure");
        }
        return basePut(key, value, options);
      };
      const env = createEnv(worker, kv);
      const userId = `U-terminal-${worker.slug}`;

      await sendLineEvent(module, worker, env, userId, `【GO:${worker.slug}:social】`, "terminal-start");
      for (let index = 1; index <= 3; index += 1) {
        await sendLineEvent(module, worker, env, userId, `answer-${index}`, `terminal-answer-${index}`);
      }

      const eventKeys = [...kv.map.keys()].filter((key) => key.startsWith(`go-funnel:v1:${worker.slug}:`));
      assert.equal(eventKeys.filter((key) => key.includes(":third_answer:")).length, 1);
      const completionText = lineCalls.at(-1).messages[0].text;
      const caseId = completionText.match(/案件碼：(GO-[A-F0-9]{12})/)?.[1];
      assert.match(caseId || "", /^GO-[A-F0-9]{12}$/);
      assert.equal(kv.map.has(`go-delivery:v1:${worker.slug}:${caseId}`), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test(`${worker.label} rolls back an intake start when LINE reply fails so the user's retry stays on question one`, { concurrency: false }, async () => {
    const originalFetch = globalThis.fetch;
    let lineReplySucceeds = false;
    globalThis.fetch = async () => new Response("{}", {
      status: lineReplySucceeds ? 200 : 500,
      headers: { "content-type": "application/json" },
    });
    try {
      const module = await import(worker.path);
      const kv = createKv();
      const env = createEnv(worker, kv);
      const userId = `U-reply-failure-${worker.slug}`;
      const webhookEventId = `evt-reply-failure-${worker.slug}`;

      await sendLineEvent(module, worker, env, userId, `【GO:${worker.slug}:social】`, "failed-reply", {
        webhookEventId,
        deliveryContext: { isRedelivery: false },
      });
      assert.equal([...kv.map.keys()].filter((key) => key.startsWith("go-intake:")).length, 0);
      assert.equal([...kv.map.keys()].filter((key) => key.startsWith(`go-funnel:v1:${worker.slug}:`) && key.includes(":started:")).length, 0);
      assert.equal([...kv.map.keys()].filter((key) => key.startsWith(`go-intake-webhook:v1:${worker.slug}:`)).length, 0);

      lineReplySucceeds = true;
      await sendLineEvent(module, worker, env, userId, `【GO:${worker.slug}:social】`, "successful-redelivery", {
        webhookEventId: `${webhookEventId}-user-retry`,
        deliveryContext: { isRedelivery: false },
      });
      const summary = await (await fetchSummary(module, env)).json();
      assert.equal(summary.totals.starts, 1);
      assert.equal(summary.totals.firstAnswers, 0);
      assert.equal([...kv.map.keys()].filter((key) => key.startsWith(`go-intake-webhook:v1:${worker.slug}:`)).length, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test(`${worker.label} keeps question three pending when terminal tracking fails twice`, { concurrency: false }, async () => {
    const originalFetch = globalThis.fetch;
    const lineCalls = [];
    globalThis.fetch = async (url, options = {}) => {
      if (String(url).includes("api.line.me/v2/bot/message/reply")) lineCalls.push(JSON.parse(options.body));
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    };
    try {
      const module = await import(worker.path);
      const kv = createKv();
      const basePut = kv.put.bind(kv);
      let receiptFailuresRemaining = 2;
      let receiptAttempts = 0;
      kv.put = async (key, value, options) => {
        if (key.startsWith(`go-delivery:v1:${worker.slug}:`)) {
          receiptAttempts += 1;
          if (receiptFailuresRemaining > 0) {
            receiptFailuresRemaining -= 1;
            throw new Error("simulated persistent terminal receipt failure");
          }
        }
        return basePut(key, value, options);
      };
      const env = createEnv(worker, kv);
      const userId = `U-terminal-pending-${worker.slug}`;

      await sendLineEvent(module, worker, env, userId, `【GO:${worker.slug}:social】`, "pending-start");
      await sendLineEvent(module, worker, env, userId, "answer-one", "pending-one");
      await sendLineEvent(module, worker, env, userId, "answer-two", "pending-two");
      await sendLineEvent(module, worker, env, userId, "answer-three", "pending-three", {
        webhookEventId: `evt-terminal-pending-${worker.slug}`,
      });

      assert.equal(receiptAttempts, 2);
      const intakeStateEntry = [...kv.map.entries()].find(([key]) => key.startsWith("go-intake:"));
      assert.equal(JSON.parse(intakeStateEntry?.[1] || "null")?.step, 2);
      assert.equal([...kv.map.keys()].some((key) => key.startsWith(`go-intake-meta:`)), true);
      assert.equal([...kv.map.keys()].filter((key) => key.startsWith(`go-funnel:v1:${worker.slug}:`) && key.includes(":third_answer:")).length, 0);
      assert.equal([...kv.map.keys()].filter((key) => key.startsWith(`go-intake-webhook:v1:${worker.slug}:`)).length, 0);
      assert.match(lineCalls.at(-1).messages[0].text, /案件碼.*暫時.*再傳「完成」/s);

      await sendLineEvent(module, worker, env, userId, "完成", "pending-retry", {
        webhookEventId: `evt-terminal-retry-${worker.slug}`,
      });
      assert.equal([...kv.map.keys()].filter((key) => key.startsWith(`go-funnel:v1:${worker.slug}:`) && key.includes(":third_answer:")).length, 1);
      assert.match(lineCalls.at(-1).messages[0].text, /案件碼：(GO-[A-F0-9]{12})/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test(`${worker.label} preserves earlier funnel events when the completion LINE reply fails`, { concurrency: false }, async () => {
    const originalFetch = globalThis.fetch;
    let lineReplySucceeds = true;
    globalThis.fetch = async () => new Response("{}", {
      status: lineReplySucceeds ? 200 : 500,
      headers: { "content-type": "application/json" },
    });
    try {
      const module = await import(worker.path);
      const kv = createKv();
      const env = createEnv(worker, kv);
      const userId = `U-completion-reply-failure-${worker.slug}`;

      await sendLineEvent(module, worker, env, userId, `【GO:${worker.slug}:direct】`, "completion-failure-start");
      await sendLineEvent(module, worker, env, userId, "answer-one", "completion-failure-one");
      await sendLineEvent(module, worker, env, userId, "answer-two", "completion-failure-two");
      lineReplySucceeds = false;
      await sendLineEvent(module, worker, env, userId, "answer-three", "completion-failure-three", {
        webhookEventId: `evt-completion-reply-failure-${worker.slug}`,
      });

      const eventKeys = [...kv.map.keys()].filter((key) => key.startsWith(`go-funnel:v1:${worker.slug}:`));
      assert.equal(eventKeys.filter((key) => key.includes(":started:")).length, 1);
      assert.equal(eventKeys.filter((key) => key.includes(":first_answer:")).length, 1);
      assert.equal(eventKeys.filter((key) => key.includes(":third_answer:")).length, 0);
      assert.equal([...kv.map.keys()].filter((key) => key.startsWith(`go-delivery:v1:${worker.slug}:`)).length, 0);
      assert.equal(JSON.parse([...kv.map.entries()].find(([key]) => key.startsWith("go-intake:"))?.[1] || "null")?.step, 2);
      assert.equal([...kv.map.keys()].filter((key) => key.startsWith(`go-intake-webhook:v1:${worker.slug}:`)).length, 0);

      lineReplySucceeds = true;
      await sendLineEvent(module, worker, env, userId, "完成", "completion-user-retry", {
        webhookEventId: `evt-completion-user-retry-${worker.slug}`,
      });
      const summary = await (await fetchSummary(module, env)).json();
      assert.equal(summary.totals.starts, 1);
      assert.equal(summary.totals.firstAnswers, 1);
      assert.equal(summary.totals.thirdAnswers, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

async function fetchSummary(module, env, authorized = true) {
  return module.default.fetch(
    new Request("https://worker.test/admin/go-funnel?days=30", {
      headers: authorized ? { "X-Admin-Key": ADMIN_KEY } : {},
    }),
    env,
    { waitUntil() {} },
  );
}

async function markDelivered(module, env, caseId) {
  return module.default.fetch(
    new Request("https://worker.test/admin/go-funnel/delivered", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Admin-Key": ADMIN_KEY },
      body: JSON.stringify({ caseId }),
    }),
    env,
    { waitUntil() {} },
  );
}

for (const worker of WORKERS) {
  test(`${worker.label} tracks first answer, third answer, delivery minutes, and source conversion without PII`, { concurrency: false }, async () => {
    const originalFetch = globalThis.fetch;
    const lineCalls = [];
    globalThis.fetch = async (url, options = {}) => {
      if (String(url).includes("api.line.me/v2/bot/message/reply")) {
        lineCalls.push(JSON.parse(options.body));
      }
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    };

    try {
      const module = await import(worker.path);
      const kv = createKv();
      const env = createEnv(worker, kv);
      const completeUser = `U-complete-${worker.slug}`;
      const dropoffUser = `U-dropoff-${worker.slug}`;

      await sendLineEvent(module, worker, env, completeUser, `【GO:${worker.slug}:social】`, "start-complete");
      for (let index = 1; index <= 3; index += 1) {
        await sendLineEvent(module, worker, env, completeUser, `private-answer-${index}-${worker.slug}`, `answer-${index}`);
      }
      await sendLineEvent(module, worker, env, dropoffUser, `【GO:${worker.slug}:direct】`, "start-dropoff");

      const eventKeys = [...kv.map.keys()].filter((key) => key.startsWith("go-funnel:v1:"));
      assert.equal(eventKeys.filter((key) => key.includes(":started:")).length, 2);
      assert.equal(eventKeys.filter((key) => key.includes(":first_answer:")).length, 1);
      assert.equal(eventKeys.filter((key) => key.includes(":third_answer:")).length, 1);
      assert.equal(eventKeys.some((key) => key.includes(completeUser) || key.includes(dropoffUser)), false);
      assert.equal([...kv.map.values()].some((value) => value.includes("private-answer")), false);

      const completionText = lineCalls.at(-2).messages[0].text;
      const caseId = completionText.match(/案件碼：(GO-[A-F0-9]{12})/)?.[1];
      assert.match(caseId || "", /^GO-[A-F0-9]{12}$/);

      const unauthorized = await fetchSummary(module, env, false);
      assert.equal(unauthorized.status, 401);

      const beforeDelivery = await fetchSummary(module, env);
      assert.equal(beforeDelivery.status, 200);
      const before = await beforeDelivery.json();
      assert.equal(before.feature, "go-funnel-v1");
      assert.equal(before.slug, worker.slug);
      assert.deepEqual(before.totals, {
        starts: 2,
        firstAnswers: 1,
        thirdAnswers: 1,
        deliveries: 0,
        firstAnswerRate: 0.5,
        thirdAnswerRate: 0.5,
        deliveryRate: 0,
        averageDeliveryMinutes: null,
      });
      assert.deepEqual(before.sources.map((source) => [source.source, source.thirdAnswerRate]), [
        ["direct", 0],
        ["social", 1],
      ]);

      const receiptKey = `go-delivery:v1:${worker.slug}:${caseId}`;
      const receipt = JSON.parse(kv.map.get(receiptKey));
      receipt.completedAt = Date.now() - (10 * 60 * 1000);
      kv.map.set(receiptKey, JSON.stringify(receipt));

      const deliveredResponse = await markDelivered(module, env, caseId);
      assert.equal(deliveredResponse.status, 200);
      const delivered = await deliveredResponse.json();
      assert.equal(delivered.ok, true);
      assert.equal(delivered.caseId, caseId);
      assert.ok(delivered.deliveryMinutes >= 9.9 && delivered.deliveryMinutes <= 10.1);

      const duplicateResponse = await markDelivered(module, env, caseId);
      assert.equal(duplicateResponse.status, 200);
      assert.equal((await duplicateResponse.json()).duplicate, true);

      const afterDelivery = await fetchSummary(module, env);
      const after = await afterDelivery.json();
      assert.equal(after.totals.deliveries, 1);
      assert.ok(after.totals.averageDeliveryMinutes >= 9.9 && after.totals.averageDeliveryMinutes <= 10.1);
      assert.equal(after.sources.find((source) => source.source === "social").deliveryRate, 1);
      assert.equal(after.sources.find((source) => source.source === "direct").deliveryRate, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

test("3Q and POP reports stay isolated when both Workers share the same SESSION KV", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  try {
    const brandWorker = WORKERS.find((worker) => worker.slug === "brand-content");
    const popWorker = WORKERS.find((worker) => worker.slug === "auto-care");
    const [brandModule, popModule] = await Promise.all([import(brandWorker.path), import(popWorker.path)]);
    const sharedKv = createKv();
    const brandEnv = createEnv(brandWorker, sharedKv);
    const popEnv = createEnv(popWorker, sharedKv);

    await sendLineEvent(brandModule, brandWorker, brandEnv, "U-brand-shared-kv", "【GO:brand-content:direct】", "brand-start");
    await sendLineEvent(popModule, popWorker, popEnv, "U-pop-shared-kv", "【GO:auto-care:social】", "pop-start");
    for (let index = 1; index <= 3; index += 1) {
      await sendLineEvent(popModule, popWorker, popEnv, "U-pop-shared-kv", `pop-answer-${index}`, `pop-answer-${index}`);
    }

    const brandSummary = await (await fetchSummary(brandModule, brandEnv)).json();
    const popSummary = await (await fetchSummary(popModule, popEnv)).json();
    assert.deepEqual(brandSummary.totals, {
      starts: 1,
      firstAnswers: 0,
      thirdAnswers: 0,
      deliveries: 0,
      firstAnswerRate: 0,
      thirdAnswerRate: 0,
      deliveryRate: 0,
      averageDeliveryMinutes: null,
    });
    assert.equal(brandSummary.sources.length, 1);
    assert.equal(brandSummary.sources[0].source, "direct");
    assert.equal(popSummary.totals.starts, 1);
    assert.equal(popSummary.totals.firstAnswers, 1);
    assert.equal(popSummary.totals.thirdAnswers, 1);
    assert.equal(popSummary.sources.length, 1);
    assert.equal(popSummary.sources[0].source, "social");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
