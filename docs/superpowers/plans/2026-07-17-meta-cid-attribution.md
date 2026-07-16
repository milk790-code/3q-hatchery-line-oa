# Meta CID Attribution Implementation Plan

Implementation checklist and verification record. Completed items are checked below.

**Goal:** Extend the POP LINE OA entrypoint to accept both `【GO:to:src】` and `【GO:to:src:cid】`, record Meta attribution in `customer_profiles`, and make the shared click KV available for later Phase 2 CAPI replay without deploying production.

**Architecture:** Keep parsing and attribution in the actual LINE OA entrypoint (`workers/pop-line-oa/worker.js`), not the checkout repository. Parse the marker with `split(":")`, look up `fbc:{cid}` through the existing click KV, store only the correlation ID and `source='meta'` in D1, and leave CAPI network sending for a separately reviewed Phase 2.

**Tech Stack:** Cloudflare Workers ES modules, Workers KV, D1 SQLite, Node.js contract tests, GitHub Actions Worker metadata.

## Global Constraints

- Preserve three-part markers: `【GO:to:src】` must continue to work without a `cid`.
- Accept the fourth segment only as an eight-character lowercase or uppercase hex correlation ID.
- Never store raw `fbclid`, `fbc`, LINE message text, secrets, or tokens in the migration or documentation.
- Do not deploy, merge, mutate production D1, or send CAPI events in this branch.
- Bind `CLICK_KV` to namespace `b7c18769105143aeb3b1557b49b12455` only in the reviewable deployment metadata.
- Keep the existing disclosure-suite baseline (`13 passed, 6 failed`) separate from the new Meta contract.

---

### Task 1: Parser and KV lookup contract

**Files:**
- Create: `workers/pop-line-oa/test-meta-cid.mjs`
- Modify: `workers/pop-line-oa/worker.js`

**Interfaces:**
- Consumes: LINE text containing `【GO:<to>:<src>[:<cid>]】`.
- Produces: `parseGoMarker(text)` returning `{ text, marker }` and `loadMetaAttribution(env, marker)` returning `{ cid, to, src, source, fbcFound }`.

- [x] **Step 1: Write the failing test**

```js
import { loadMetaAttribution, parseGoMarker } from './worker.js';

const legacy = parseGoMarker('你好\n【GO:brand-content:mv1-ec】');
assert.equal(legacy.marker.cid, null);

const current = parseGoMarker('你好\n【GO:brand-content:mv1-ec:12ab34cd】');
assert.equal(current.marker.cid, '12ab34cd');

const keys = [];
const result = await loadMetaAttribution({
  CLICK_KV: { get: async (key) => { keys.push(key); return '_fbc-value'; } },
}, current.marker);
assert.deepEqual(keys, ['fbc:12ab34cd']);
assert.equal(result.source, 'meta');
assert.equal(result.fbcFound, true);
```

- [x] **Step 2: Run the test and verify RED**

Run: `node workers/pop-line-oa/test-meta-cid.mjs`

Expected: import failure because `parseGoMarker` and `loadMetaAttribution` are not exported yet.

- [x] **Step 3: Implement the minimal parser and lookup**

```js
export function parseGoMarker(text) {
  const value = String(text || '');
  const match = value.match(/【(GO:[^】]+)】/);
  if (!match) return { text: value, marker: null };
  const parts = match[1].split(':');
  if (parts[0] !== 'GO' || parts.length < 3) return { text: value, marker: null };
  const cid = parts[3] && /^[0-9a-f]{8}$/i.test(parts[3]) ? parts[3].toLowerCase() : null;
  return {
    text: value.replace(match[0], '').trim(),
    marker: { to: parts[1], src: parts[2], cid },
  };
}
```

- [x] **Step 4: Run the test and verify GREEN**

Run: `node workers/pop-line-oa/test-meta-cid.mjs`

Expected: all parser and KV assertions pass.

### Task 2: D1 attribution persistence

**Files:**
- Modify: `workers/pop-line-oa/worker.js`
- Create: `db/migrations/010_customer_profiles_meta_attribution.sql`
- Modify: `workers/pop-line-oa/test-meta-cid.mjs`

**Interfaces:**
- Consumes: valid marker attribution plus LINE `userId`.
- Produces: `customer_profiles.meta_cid=<cid>` and `customer_profiles.source='meta'` without persisting `fbc`.

- [x] **Step 1: Add a failing persistence assertion**

```js
const writes = [];
await saveMetaAttribution({ CRM: fakeD1(writes) }, 'U_TEST', result);
assert.match(writes[0].sql, /meta_cid/);
assert.deepEqual(writes[0].values, ['U_TEST', '12ab34cd', 'meta']);
```

- [x] **Step 2: Verify RED**

Run: `node workers/pop-line-oa/test-meta-cid.mjs`

Expected: failure because `saveMetaAttribution` does not exist.

- [x] **Step 3: Add idempotent runtime columns and upsert**

```sql
ALTER TABLE customer_profiles ADD COLUMN meta_cid TEXT;
ALTER TABLE customer_profiles ADD COLUMN source TEXT;
```

The Worker repeats each `ALTER TABLE` behind `.catch(() => {})`, then upserts only `brand`, `sid`, `meta_cid`, `source`, and `updated_at`.

- [x] **Step 4: Verify GREEN**

Run: `node workers/pop-line-oa/test-meta-cid.mjs`

Expected: parser, KV lookup, and D1 persistence assertions pass.

### Task 3: Deployment binding and Phase 2 handoff

**Files:**
- Modify: `.github/workflows/deploy-pop-line-oa.yml`
- Create: `docs/meta-cid-phase2-capi.md`

**Interfaces:**
- Consumes: existing Cloudflare namespace ID and current inherit-safe deployment metadata.
- Produces: reviewable `CLICK_KV` binding plus a no-send Phase 2 runbook.

- [x] **Step 1: Add `CLICK_KV_ID` and deployment metadata binding**

```yaml
CLICK_KV_ID: b7c18769105143aeb3b1557b49b12455
```

```jq
{name:"CLICK_KV",type:"kv_namespace",namespace_id:$click_kv}
```

- [x] **Step 2: Record the Phase 2 gate**

Document that CAPI replay is intentionally absent, requires `META_PIXEL_ID` and `META_CAPI_TOKEN`, must deduplicate by the eight-character `event_id`, and must be tested in Meta Test Events before production.

- [x] **Step 3: Run final verification**

Run:

```bash
node --check workers/pop-line-oa/worker.js
node workers/pop-line-oa/test-meta-cid.mjs
node scripts/check-sync.mjs
git diff --check
git status -sb
```

Expected: new Meta contract passes, syntax and sync checks pass, and the branch remains unmerged and undeployed. The pre-existing disclosure test is reported separately with its actual pass/fail count.
