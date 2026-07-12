// weather-touch v1 — 條件觸發關懷(不是每日群發)
// 只在客人所在城市出現雷雨 / 高降雨機率 / 極端高溫時,才主動關懷一則,內建「我有記下來」的筆記證明感。
// 資料來源:customer_profiles(由 pop-line-oa v5.2 的筆記超能力落庫,含 city + care_last_sent_at)。
// 綁定:DB → CRM D1(pop-line-oa 同一顆,e54671b1-…);Secrets:CWA_API_KEY + LINE_CHANNEL_TOKEN_POPMONSTER。
// 安全:一人 5 天冷卻;push 吃 LINE 月配額(reply 不吃),冷卻已控量。
// ⚠ cron 預設關閉(wrangler.jsonc 無 triggers)。先手動打 /run?key=RUN_KEY 驗證幾天話術與觸發率,確認有效再開 cron。
//    自動化永遠放在驗證之後——這是刻意設計。

const CWA = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001'; // 36 小時天氣預報
const CITY = { '台北': '臺北市', '臺北': '臺北市', '新北': '新北市', '桃園': '桃園市', '台中': '臺中市', '臺中': '臺中市', '台南': '臺南市', '臺南': '臺南市', '高雄': '高雄市', '新竹': '新竹市', '基隆': '基隆市', '嘉義': '嘉義市', '彰化': '彰化縣', '屏東': '屏東縣', '宜蘭': '宜蘭縣', '花蓮': '花蓮縣', '台東': '臺東縣', '臺東': '臺東縣', '南投': '南投縣', '雲林': '雲林縣', '苗栗': '苗栗縣' };
function norm(c) { c = String(c || '').trim(); for (const k in CITY) { if (c.includes(k)) return CITY[k]; } return null; }

// 依 36 小時預報第一時段:雷雨或 PoP>=70 → 帶傘關懷;MaxT>=35 → 曝曬關懷。回傳一個 city→訊息 的產生器,或 null(不觸發)。
function trigger(el) {
  const g = (n) => (el.find(e => e.elementName === n)?.time?.[0]?.parameter) || {};
  const pop = parseInt(g('PoP').parameterName || '0', 10);
  const maxT = parseInt(g('MaxT').parameterName || '0', 10);
  const wx = g('Wx').parameterName || '';
  if (/雷/.test(wx) || pop >= 70) {
    return (c) => `早,${c}今天降雨機率 ${pop}%${/雷/.test(wx) ? ',可能有雷陣雨' : ''},出門記得帶把傘。你之前說你在${c},我有記下來,想說跟你講一聲。順帶一提,有鍍膜的車雨天特別好整理,還沒做的話改天聊聊`;
  }
  if (maxT >= 35) {
    return (c) => `早,${c}今天會熱到 ${maxT} 度,車能停室內就停室內,曝曬最傷漆面。你之前提過你在${c},我記著,所以提醒你一下`;
  }
  return null;
}

// 依 brand 取對應 LINE token(目前只有 popmonster 有 city 筆記;之後 3q/tudigong 補上筆記後,加對應 token secret 即可)
function tokenFor(env, brand) {
  const key = 'LINE_CHANNEL_TOKEN_' + String(brand || '').replace(/[^a-z0-9]/gi, '_').toUpperCase();
  return env[key] || env.LINE_CHANNEL_TOKEN_POPMONSTER || env.LINE_CHANNEL_TOKEN || '';
}

async function run(env) {
  if (!env.DB) return { ok: false, note: '無 DB 綁定' };
  if (!env.CWA_API_KEY) return { ok: false, note: '無 CWA_API_KEY' };
  const rows = (await env.DB.prepare("SELECT brand, sid, city, care_last_sent_at FROM customer_profiles WHERE city IS NOT NULL AND city<>''").all()).results || [];
  if (!rows.length) return { ok: true, note: '無有城市筆記的客人', sent: 0 };

  // 每個城市只查一次天氣,快取觸發器
  const wx = {};
  for (const c of [...new Set(rows.map(r => norm(r.city)).filter(Boolean))]) {
    try {
      const j = await fetch(`${CWA}?Authorization=${env.CWA_API_KEY}&locationName=${encodeURIComponent(c)}`).then(r => r.json());
      const loc = j?.records?.location?.[0];
      wx[c] = loc ? trigger(loc.weatherElement) : null;
    } catch (_) { wx[c] = null; }
  }

  const now = Date.now(), CD = 5 * 864e5; // 5 天冷卻
  let sent = 0, skippedCooldown = 0, noTrigger = 0;
  for (const r of rows) {
    const c = norm(r.city), f = c && wx[c];
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
  return { ok: true, candidates: rows.length, sent, skippedCooldown, noTrigger };
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
      return new Response(JSON.stringify({ ok: true, worker: 'weather-touch', ver: 'v1', cwa_key: !!env.CWA_API_KEY, db: !!env.DB, profiles, with_city: withCity, cron: 'off(手動 /run 驗證中)' }, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
    return new Response('weather-touch v1 (條件觸發關懷;cron off;/run?key= 手動驗證)');
  },
};
