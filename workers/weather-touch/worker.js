// weather-touch v2 — 條件觸發關懷（不是每日群發）
// 只在客人所在城市出現以下情形時,才主動關懷一則,內建「我有記下來」的筆記證明感,一人 5 天冷卻:
//   ① 雷雨 / 降雨機率高  → 帶傘 + 鍍膜雨天好整理
//   ② 極端高溫 ≥35°C     → 停室內、曝曬傷漆
//   ③ 連續 ≥3 天沒下雨    → 「該洗車了」洗車/上鍍膜時機(對到成交場景)
// 資料來源:customer_profiles(pop-line-oa v5.2 筆記超能力落庫,含 city + care_last_sent_at)。
// 連晴天數靠 weather_state 表(每城一列,每天算一次)。
// 綁定:DB → CRM D1(pop-line-oa 同一顆,e54671b1-…);Secrets:CWA_API_KEY + LINE_CHANNEL_TOKEN_POPMONSTER。
// ⚠ cron 預設關閉(wrangler.jsonc 無 triggers)。先手動 /run?key=RUN_KEY 驗證話術與觸發率,確認有效再開 cron。

const CWA = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001'; // 36 小時天氣預報
const CITY = { '台北': '臺北市', '臺北': '臺北市', '新北': '新北市', '桃園': '桃園市', '台中': '臺中市', '臺中': '臺中市', '台南': '臺南市', '臺南': '臺南市', '高雄': '高雄市', '新竹': '新竹市', '基隆': '基隆市', '嘉義': '嘉義市', '彰化': '彰化縣', '屏東': '屏東縣', '宜蘭': '宜蘭縣', '花蓮': '花蓮縣', '台東': '臺東縣', '臺東': '臺東縣', '南投': '南投縣', '雲林': '雲林縣', '苗栗': '苗栗縣' };
function norm(c) { c = String(c || '').trim(); for (const k in CITY) { if (c.includes(k)) return CITY[k]; } return null; }
function twToday() { return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10); } // 台灣日期 YYYY-MM-DD

// 讀 36 小時預報第一時段,分類天氣
function classify(el) {
  const g = (n) => (el.find(e => e.elementName === n)?.time?.[0]?.parameter) || {};
  const pop = parseInt(g('PoP').parameterName || '0', 10);
  const maxT = parseInt(g('MaxT').parameterName || '0', 10);
  const wx = g('Wx').parameterName || '';
  const wet = /雨|雷/.test(wx) || pop >= 50; // 有雨天氣現象或降雨機率≥50% 視為「濕」
  return { pop, maxT, wx, wet };
}

// 依天氣 + 連續無雨天數,挑一則關懷(優先序:雷雨/高溫 > 連晴洗車時機 > 不發)
function pickMsg(cls, dryDays) {
  if (/雷/.test(cls.wx) || cls.pop >= 70) {
    return (c) => `早,${c}今天降雨機率 ${cls.pop}%${/雷/.test(cls.wx) ? ',可能有雷陣雨' : ''},出門記得帶把傘。你之前說你在${c},我有記下來,想說跟你講一聲。順帶一提,有鍍膜的車雨天特別好整理,還沒做的話改天聊聊`;
  }
  if (cls.maxT >= 35) {
    return (c) => `早,${c}今天會熱到 ${cls.maxT} 度,車能停室內就停室內,曝曬最傷漆面。你之前提過你在${c},我記著,所以提醒你一下`;
  }
  if (dryDays >= 3 && !cls.wet) {
    return (c) => `早,${c}最近連好幾天沒下雨、天氣穩定,是洗車跟上鍍膜的好時機,弄完亮度撐得比較久。你之前說你在${c},我有記著,順口提醒你一下😊`;
  }
  return null;
}

// 依 brand 取對應 LINE token(目前只有 popmonster 有 city 筆記;3q/tudigong 補筆記後加對應 token secret 即可)
function tokenFor(env, brand) {
  const key = 'LINE_CHANNEL_TOKEN_' + String(brand || '').replace(/[^a-z0-9]/gi, '_').toUpperCase();
  return env[key] || env.LINE_CHANNEL_TOKEN_POPMONSTER || env.LINE_CHANNEL_TOKEN || '';
}

async function run(env) {
  if (!env.DB) return { ok: false, note: '無 DB 綁定' };
  if (!env.CWA_API_KEY) return { ok: false, note: '無 CWA_API_KEY' };
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS weather_state (city TEXT PRIMARY KEY, dry_days INTEGER DEFAULT 0, updated_date TEXT)').run().catch(() => {});
  const rows = (await env.DB.prepare("SELECT brand, sid, city, care_last_sent_at FROM customer_profiles WHERE city IS NOT NULL AND city<>''").all()).results || [];
  if (!rows.length) return { ok: true, note: '無有城市筆記的客人', sent: 0 };

  const today = twToday();
  const cities = [...new Set(rows.map(r => norm(r.city)).filter(Boolean))];
  const msg = {}; // city -> 訊息產生器 或 null
  for (const c of cities) {
    let cls = null;
    try {
      const j = await fetch(`${CWA}?Authorization=${env.CWA_API_KEY}&locationName=${encodeURIComponent(c)}`).then(r => r.json());
      const loc = j?.records?.location?.[0];
      cls = loc ? classify(loc.weatherElement) : null;
    } catch (_) { cls = null; }
    if (!cls) { msg[c] = null; continue; }
    // 更新連續無雨天數(每天只算一次,用 updated_date 去重;濕→歸零,乾→+1)
    const st = await env.DB.prepare('SELECT dry_days, updated_date FROM weather_state WHERE city=?').bind(c).first().catch(() => null);
    let dry = st?.dry_days || 0;
    if (!st || st.updated_date !== today) {
      dry = cls.wet ? 0 : dry + 1;
      await env.DB.prepare('INSERT INTO weather_state (city, dry_days, updated_date) VALUES (?,?,?) ON CONFLICT(city) DO UPDATE SET dry_days=excluded.dry_days, updated_date=excluded.updated_date').bind(c, dry, today).run().catch(() => {});
    }
    msg[c] = pickMsg(cls, dry);
  }

  const now = Date.now(), CD = 5 * 864e5; // 5 天冷卻(不分關懷類型,避免過度打擾)
  let sent = 0, skippedCooldown = 0, noTrigger = 0;
  for (const r of rows) {
    const c = norm(r.city), f = c && msg[c];
    if (!f) { noTrigger++; continue; }
    if (r.care_last_sent_at && now - Number(r.care_last_sent_at) < CD) { skippedCooldown++; continue; }
    const token = tokenFor(env, r.brand);
    if (!token) continue;
    const ok = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + token },
      body: JSON.stringify({ to: r.sid, messages: [{ type: 'text', text: f(c.replace('臺', '台')) }] }),
    }).then(x => x.ok).catch(() => false);
    if (ok) { sent++; await env.DB.prepare('UPDATE customer_profiles SET care_last_sent_at=? WHERE brand=? AND sid=?').bind(now, r.brand, r.sid).run().catch(() => {}); }
  }
  return { ok: true, candidates: rows.length, cities: cities.length, sent, skippedCooldown, noTrigger };
}

export default {
  async scheduled(e, env, ctx) { ctx.waitUntil(run(env)); },
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.pathname === '/run' && u.searchParams.get('key') === env.RUN_KEY) {
      const out = await run(env);
      return new Response(JSON.stringify(out, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
    if (u.pathname === '/health') {
      let profiles = 0, withCity = 0;
      if (env.DB) {
        try { profiles = (await env.DB.prepare('SELECT COUNT(*) n FROM customer_profiles').first())?.n || 0; } catch (_) {}
        try { withCity = (await env.DB.prepare("SELECT COUNT(*) n FROM customer_profiles WHERE city IS NOT NULL AND city<>''").first())?.n || 0; } catch (_) {}
      }
      return new Response(JSON.stringify({ ok: true, worker: 'weather-touch', ver: 'v2', triggers: ['雷雨/降雨', '高溫≥35', '連晴≥3天洗車'], cwa_key: !!env.CWA_API_KEY, db: !!env.DB, profiles, with_city: withCity, cron: 'off(手動 /run 驗證中)' }, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
    return new Response('weather-touch v2 (條件觸發關懷:雷雨/高溫/連晴洗車;cron off;/run?key= 手動驗證)');
  },
};
