// leads-board — 三品牌客戶筆記統一看板(唯讀 + 密碼保護)
// 讀 customer_profiles(pop-line-oa v5.2 筆記超能力落庫),依 brand 分組,A 級意向名單置頂高亮。
// 目前只有 popmonster 有資料;3q/tudigong 接上同款筆記後(寫進同一顆 CRM 的 customer_profiles,帶各自 brand),本看板自動顯示。
// 綁定:DB → CRM D1(e54671b1-…,與 pop-line-oa 同一顆)。Secret:BOARD_PASS(看板密碼)。
// 純 SELECT,不寫任何資料。

function ctEq(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
// session cookie 存的是 HMAC 衍生 token,不是密碼本身(cookie 被截也不洩密碼)
async function sessionToken(pass) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('leads-board-session-v1'));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function getCookie(req, name) {
  const c = req.headers.get('Cookie') || '';
  const m = c.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : '';
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const LOGIN = (err) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>客戶看板</title>
<body style="font-family:system-ui;background:#0b0d12;color:#e8edf5;display:grid;place-items:center;height:100vh;margin:0">
<form method=POST style="background:#141821;padding:28px;border-radius:14px;width:280px">
<h2 style="margin:0 0 14px;font-size:17px">三品牌客戶看板</h2>
${err ? '<p style="color:#ff6b6b;font-size:13px;margin:0 0 10px">密碼錯誤</p>' : ''}
<input name=pass type=password placeholder=密碼 autfocus style="width:100%;padding:10px;border-radius:8px;border:1px solid #2a3140;background:#0b0d12;color:#e8edf5;box-sizing:border-box">
<button style="width:100%;margin-top:12px;padding:10px;border:0;border-radius:8px;background:#caa64a;color:#141005;font-weight:700">進入</button>
</form></body>`;

function tile(label, val, accent) {
  return `<div style="background:#141821;border:1px solid #222a37;border-radius:12px;padding:14px 16px;min-width:110px">
    <div style="color:#7d8aa0;font-size:12px">${label}</div>
    <div style="font-size:26px;font-weight:800;color:${accent || '#e8edf5'};margin-top:2px">${val}</div></div>`;
}
function ago(dt) {
  if (!dt) return '—';
  const t = Date.parse(dt.replace(' ', 'T') + 'Z');
  if (isNaN(t)) return esc(dt);
  const h = Math.floor((Date.now() - t) / 3600000);
  if (h < 1) return '剛剛'; if (h < 24) return h + ' 小時前';
  return Math.floor(h / 24) + ' 天前';
}

async function board(env) {
  const brands = (await env.DB.prepare("SELECT brand, COUNT(*) n, SUM(grade='A') a, SUM(grade='B') b, SUM(grade='C') c, SUM(city IS NOT NULL AND city<>'') wc FROM customer_profiles GROUP BY brand").all()).results || [];
  const totals = brands.reduce((o, r) => { o.n += r.n; o.a += r.a || 0; o.b += r.b || 0; o.c += r.c || 0; o.wc += r.wc || 0; return o; }, { n: 0, a: 0, b: 0, c: 0, wc: 0 });
  const aLeads = (await env.DB.prepare("SELECT brand, sid, city, vehicle, industry, budget, pain, intent_score, updated_at, nurtured_at, care_last_sent_at FROM customer_profiles WHERE grade='A' ORDER BY updated_at DESC LIMIT 100").all()).results || [];
  const rowsHtml = aLeads.map((r) => `<tr>
    <td>${esc(r.brand)}</td>
    <td style="font-family:monospace;color:#7d8aa0">${esc((r.sid || '').slice(0, 10))}…</td>
    <td>${esc(r.city || '—')}</td>
    <td>${esc(r.vehicle || r.industry || '—')}</td>
    <td>${esc(r.budget || '—')}</td>
    <td style="max-width:260px">${esc(r.pain || '—')}</td>
    <td style="text-align:center">${r.intent_score != null ? Math.round(r.intent_score * 100) + '%' : '—'}</td>
    <td>${ago(r.updated_at)}</td>
    <td style="text-align:center">${r.nurtured_at ? '✅' : '—'}</td>
  </tr>`).join('');
  const brandRows = brands.map((r) => `<tr><td>${esc(r.brand)}</td><td style="text-align:center">${r.n}</td><td style="text-align:center;color:#caa64a;font-weight:700">${r.a || 0}</td><td style="text-align:center">${r.b || 0}</td><td style="text-align:center">${r.c || 0}</td><td style="text-align:center">${r.wc || 0}</td></tr>`).join('');
  return `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>三品牌客戶看板</title>
<body style="font-family:system-ui,'Noto Sans TC';background:#0b0d12;color:#e8edf5;margin:0;padding:22px 18px 60px;max-width:1100px;margin:0 auto">
<h1 style="font-size:20px;margin:0 0 4px">三品牌客戶筆記看板</h1>
<p style="color:#7d8aa0;font-size:13px;margin:0 0 18px">A 級意向置頂 · 唯讀 · 資料來自 LINE bot 邊聊邊記</p>
<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:22px">
  ${tile('總客戶', totals.n)}${tile('🔥 A 級意向', totals.a, '#caa64a')}${tile('B 有興趣', totals.b)}${tile('C 閒聊', totals.c)}${tile('有城市筆記', totals.wc)}</div>
<h2 style="font-size:15px;margin:0 0 8px">各品牌</h2>
<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:26px">
<thead><tr style="color:#7d8aa0;text-align:left"><th style="padding:6px">品牌</th><th style="text-align:center">總數</th><th style="text-align:center">A</th><th style="text-align:center">B</th><th style="text-align:center">C</th><th style="text-align:center">有城市</th></tr></thead>
<tbody>${brandRows || '<tr><td colspan=6 style="color:#7d8aa0;padding:10px">(還沒有資料 — 部署 pop-line-oa v5.2 並累積對話後出現)</td></tr>'}</tbody></table></div>
<h2 style="font-size:15px;margin:0 0 8px">🔥 A 級意向名單（最新 100）</h2>
<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
<thead><tr style="color:#7d8aa0;text-align:left">
<th style="padding:6px">品牌</th><th>客人</th><th>城市</th><th>車型/行業</th><th>預算</th><th>痛點</th><th style="text-align:center">意向</th><th>最後互動</th><th style="text-align:center">追過</th></tr></thead>
<tbody>${rowsHtml || '<tr><td colspan=9 style="color:#7d8aa0;padding:10px">目前沒有 A 級意向客戶</td></tr>'}</tbody></table></div>
<style>td{padding:7px 6px;border-top:1px solid #1c2430;vertical-align:top}tr:hover td{background:#11151d}</style>
</body>`;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/health') return new Response(JSON.stringify({ ok: true, worker: 'leads-board', db: !!env.DB, pass_set: !!env.BOARD_PASS }), { headers: { 'content-type': 'application/json' } });
    if (!env.BOARD_PASS) return new Response('BOARD_PASS 未設定', { status: 503 });
    const token = await sessionToken(env.BOARD_PASS);

    // 登入:POST 密碼 → 設 cookie(HMAC token);或帶正確 cookie
    if (req.method === 'POST') {
      const f = await req.formData();
      if (ctEq(f.get('pass'), env.BOARD_PASS)) {
        return new Response(null, { status: 303, headers: { 'Location': '/', 'Set-Cookie': `bp=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800` } });
      }
      return new Response(LOGIN(true), { status: 401, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    if (!ctEq(getCookie(req, 'bp'), token)) {
      return new Response(LOGIN(false), { status: 401, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    if (!env.DB) return new Response('無 DB 綁定', { status: 503 });
    try {
      return new Response(await board(env), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    } catch (e) {
      return new Response('board error: ' + e.message, { status: 500 });
    }
  },
};
