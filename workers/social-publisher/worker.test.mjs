// Local harness for worker.js — no network, no real bindings.
// Run: node workers/social-publisher/worker.test.mjs
// Covers the v2.6 fixes: /queue/add dedup, daily-seed pending guard,
// token:fb:page_token fallback, IG refresh via fb_exchange_token + missing-expires.
import assert from 'node:assert/strict';
import worker from './worker.js';

// ---- stubs ----------------------------------------------------------------

function makeKV(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
  };
}

// Micro D1: routes the handful of SQL shapes worker.js uses onto an in-memory table.
function makeD1() {
  const rows = [];
  let nextId = 1;
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  return {
    rows,
    prepare(sql) {
      const q = norm(sql);
      return { bind(...args) { return {
        async first() {
          if (q.startsWith("SELECT id FROM content_queue WHERE status='pending' AND platform=?")) {
            const [platform, caption, seed, image] = args;
            const hit = rows.find((r) => r.status === 'pending' && r.platform === platform
              && (r.caption || '') === (caption || '') && (r.caption_seed || '') === (seed || '')
              && (r.image_url || '') === (image || ''));
            return hit ? { id: hit.id } : null;
          }
          if (q.includes("status='pending' AND caption = ?")) {
            const [caption] = args;
            return { n: rows.filter((r) => r.platform === 'facebook' && r.status === 'pending' && r.caption === caption).length };
          }
          if (q.includes('created_at >= ?')) {
            const [today] = args;
            return { n: rows.filter((r) => r.platform === 'facebook' && r.created_at >= today).length };
          }
          if (q.includes("status = 'published' AND published_at >= ?")) return { n: 0 };
          if (q.startsWith('SELECT * FROM content_queue')) return null; // no due posts in these tests
          throw new Error(`unmocked first(): ${q}`);
        },
        async all() { return { results: [] }; },
        async run() {
          if (q.startsWith('INSERT INTO content_queue')) {
            const id = nextId++;
            if (q.includes('caption_seed')) { // /queue/add shape
              const [platform, image_url, caption_seed, caption, topic_tag, link_url, scheduled_at, source_oa] = args;
              rows.push({ id, platform, image_url, caption_seed, caption, topic_tag, link_url, scheduled_at, source_oa, status: 'pending', created_at: new Date().toISOString() });
            } else { // daily seed shape
              const [image_url, caption, link_url] = args;
              rows.push({ id, platform: 'facebook', image_url, caption, link_url, status: 'pending', created_at: new Date().toISOString() });
            }
            return { meta: { last_row_id: id, changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
      }; } };
    },
  };
}

const addReq = (body, token = 't') => new Request('https://x/queue/add', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

async function runScheduled(env) {
  let tail;
  await worker.scheduled({ cron: 'test' }, env, { waitUntil(p) { tail = p; } });
  await tail;
}

// ---- T1: /queue/add dedup ---------------------------------------------------

{
  const env = { TRIGGER_TOKEN: 't', CRM: makeD1() };
  const post = { platform: 'facebook', caption: '[t1] same caption', scheduled_at: '2030-01-01T00:00:00Z' };

  const r1 = await (await worker.fetch(addReq(post), env)).json();
  assert.equal(r1.added, 1, 't1: first add inserts');
  const id = r1.ids[0];

  const r2 = await (await worker.fetch(addReq(post), env)).json();
  assert.equal(r2.added, 0, 't1: identical pending add must not insert');
  assert.deepEqual(r2.skipped, [{
    index: 0,
    reason: 'duplicate_pending_row',
    duplicate_of: id,
    duplicate_fields: ['platform', 'caption', 'caption_seed', 'image_url', 'link_url', 'scheduled_at'],
  }], 't1: skipped reports the duplicate id and duplicate fields');
  assert.equal(r2.ok, true, 't1: dedup skip is not an error');

  const r3 = await (await worker.fetch(addReq({ ...post, caption: '[t1] different' }), env)).json();
  assert.equal(r3.added, 1, 't1: different caption still inserts');

  const r403 = await worker.fetch(addReq(post, 'wrong'), env);
  assert.equal(r403.status, 403, 't1: bad token rejected');
  console.log('T1 /queue/add dedup ✓');
}

// ---- T2: daily seed pending guard -------------------------------------------

{
  const d1 = makeD1();
  const env = { CRM: d1, SESSION: makeKV() };
  await runScheduled(env);
  const daily = () => d1.rows.filter((r) => (r.caption || '').includes('霸王餐'));
  assert.equal(daily().length, 1, 't2: first run seeds one daily post');

  // Simulate "seeded yesterday, starved in backlog, still pending":
  // the old created_at-only check would re-seed; the v2.3 pending guard must not.
  daily()[0].created_at = '2020-01-01 00:00:00';
  await runScheduled(env);
  assert.equal(daily().length, 1, 't2: pending daily post blocks re-seed');

  // Once published, next day seeds again (created_at is old, none pending).
  daily()[0].status = 'published';
  await runScheduled(env);
  assert.equal(daily().length, 2, 't2: published daily post allows next seed');
  console.log('T2 daily seed guard ✓');
}

// ---- T3: getToken accepts token:fb:page_token --------------------------------

{
  const env = {
    CRM: makeD1(),
    SESSION: makeKV({ 'token:fb:page_token': 'PT-from-kv' }),
    FB_PAGE_ID: '1006044165915714',
  };
  const health = await (await worker.fetch(new Request('https://x/health'), env)).json();
  assert.equal(health.version, '2.6', 't3: version bumped');
  assert.equal(health.configured.facebook, true, 't3: fb configured via page_token KV key');
  assert.equal(health.configured.threads, false, 't3: threads still unconfigured');
  console.log('T3 fb page_token fallback ✓');
}

// ---- T4: IG refresh — fb_exchange_token grant + missing expires key ----------

{
  const kv = makeKV({ 'token:ig:access': 'OLD', 'token:ig:user_id': 'U1' }); // no expires key
  const env = { CRM: makeD1(), SESSION: kv, THREADS_APP_ID: 'app', THREADS_APP_SECRET: 'sec' };
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return { ok: true, json: async () => ({ access_token: 'NEW', expires_in: 1000 }) };
  };
  try { await runScheduled(env); } finally { globalThis.fetch = realFetch; }

  const refreshCall = calls.find((u) => u.includes('graph.facebook.com'));
  assert.ok(refreshCall, 't4: ig refresh attempted despite missing expires key');
  assert.ok(refreshCall.includes('grant_type=fb_exchange_token'), 't4: fb_exchange_token grant used (not th_refresh_token)');
  assert.equal(kv.store.get('token:ig:access'), 'NEW', 't4: refreshed token stored');
  assert.ok(kv.store.get('token:ig:expires'), 't4: expires key backfilled');
  assert.ok(!calls.some((u) => u.includes('graph.threads.net')), 't4: no threads refresh without threads token');
  console.log('T4 IG refresh ✓');
}

console.log('\nAll social-publisher v2.6 harness tests passed.');
