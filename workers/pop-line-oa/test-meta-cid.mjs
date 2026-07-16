import assert from 'node:assert/strict';
import {
  loadMetaAttribution,
  parseGoMarker,
  saveMetaAttribution,
} from './worker.js';

const legacy = parseGoMarker('你好，我想先做品牌內容免費第一步。\n【GO:brand-content:mv1-ec】');
assert.deepEqual(legacy, {
  text: '你好，我想先做品牌內容免費第一步。',
  marker: { to: 'brand-content', src: 'mv1-ec', cid: null },
});

const current = parseGoMarker('你好，我想先做品牌內容免費第一步。\n【GO:brand-content:mv1-ec:12AB34CD】');
assert.deepEqual(current, {
  text: '你好，我想先做品牌內容免費第一步。',
  marker: { to: 'brand-content', src: 'mv1-ec', cid: '12ab34cd' },
});

const malformed = parseGoMarker('【GO:brand-content:mv1-ec:not-a-cid】');
assert.equal(malformed.marker.cid, null);

const keys = [];
const attribution = await loadMetaAttribution({
  CLICK_KV: {
    get: async (key) => {
      keys.push(key);
      return JSON.stringify({ fbc: 'fb.1.123.TEST1' });
    },
  },
}, current.marker);
assert.deepEqual(keys, ['fbc:12ab34cd']);
assert.deepEqual(attribution, {
  cid: '12ab34cd',
  to: 'brand-content',
  src: 'mv1-ec',
  source: 'meta',
  fbcFound: true,
});

const writes = [];
const fakeD1 = {
  prepare(sql) {
    return {
      bind(...values) {
        return {
          async run() {
            writes.push({ sql, values });
            return { success: true };
          },
        };
      },
    };
  },
};
await saveMetaAttribution({ CRM: fakeD1 }, 'U_TEST', attribution);
assert.equal(writes.length, 1);
assert.match(writes[0].sql, /meta_cid/);
assert.match(writes[0].sql, /source/);
assert.deepEqual(writes[0].values, ['U_TEST', '12ab34cd', 'meta']);

console.log('Meta CID contract: 8 passed, 0 failed');
