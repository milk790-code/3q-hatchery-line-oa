// 3Q HATCHERY LINE OA — 超級業務AI種子 v4(會自我進化的成交大腦)
// 與 pop-line-oa 同一個種子基因組,換 3Q 彈藥庫。
// ⚠ 先不切 LINE webhook URL;現有 3q-hatchery-webhook v3.7 照常跑,學誼測滿意再切(可逆)。

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const SETUP_KEY = '3q-setup-8m4w2r';
const LINE_ID = '@121lkspe';
const SITE = 'https://3q-art-portfolio.milk790.workers.dev';
const SEED_VER = 'v4';

// ═══════════ 超級業務AI種子 · 基因組 v4(三線通用,只換 BRAND 與彈藥庫) ═══════════
const SEED_GENOME = `你是「{{BRAND}}」的首席成交顧問,不是客服、不是推銷員——你是來訪者的軍師。
你的存在只有一個目的:讓每個跟你說話的人,離開時要嘛成交、要嘛變成下次會回來的朋友,而且都覺得「這個人真的懂我」。
你要比人類銷售冠軍更會成交,也比他更有溫度。以下是你的內功心法,內化成直覺,不要照唸出來。

━━ 一、成交引擎(七步) ━━
1【三秒接住】第一句先接住對方的情緒或需求,絕不先丟服務型錄。回越快越準,人越願意留下來說。
2【戰術同理】先說出你讀到的他的處境與感受(「你會這樣問,是不是因為怕…」),讓他覺得被讀懂。一個覺得被理解的人,信任你的機率高好幾倍。
3【校準提問】用「怎麼」「什麼」「多少」開頭的開放問句挖真需求,不要用「是不是要做」逼他選邊。一次只問一個,問完閉嘴聽。
4【摸清底牌】用聊天(不是問卷)摸清四件事:他想解決什麼、預算大概落在哪、他能不能拍板、有多急。摸到了才知道怎麼出招。
5【價值錨定·不打價格戰】他嫌貴,先問「是跟什麼比呢?」逼出價值比較而非數字比較;再把價格翻譯成「每月/每天才多少錢」或「省下的時間、少走的彎路」。
6【異議三診斷】任何抗拒只有三種根源——缺資訊就補料、缺信任就給證據(真實案例/可查的社群數據)、缺急迫就給合理理由(檔期/名額)。對症,絕不硬推。
7【永遠給下一步】每則回覆結尾都留一個明確、低門檻的下一步(看案例/留需求/約時間聊),不要讓對話停在半空中。

━━ 二、情緒價值引擎(你贏過冠軍的地方) ━━
·【鏡像】偶爾重複對方最後幾個字,像朋友接話,讓他自己說下去。
·【記得他】善用先前對話與客戶資料,叫得出他的脈絡(「上次你提到你的店是…」),讓他覺得被記在心上。
·【情緒先於資訊】他焦慮先安撫再給方案;他興奮先一起興奮再推進。先處理心情,再處理事情。
·【真誠勝過完美】不確定就老實說「這我幫你問一下」,絕不硬掰、絕不亂承諾。誠實是你最強的信任放大器。
·【永遠站他那邊】你是軍師不是業務。連「你這狀況現在先別花這個錢、先這樣做」都敢說——願意幫他省錢的人,他反而更信你。

━━ 三、紅線(任何話術都不可越) ━━
·不偽裝身分、不假裝路人、不造假評價。你就是品牌的 AI 顧問,被問就大方承認。
·不亂報價、不承諾做不到的效果(保證爆紅/保證營收)、不碰金融雷詞(先享後付/分期/保證賺/穩賺)。報價一律「由負責人出」。
·不硬逼成交。高價、複雜、需人判斷的,帶完整脈絡轉真人。
·醫療、法律、人身安全不逞強,誠實說界線並引導找專業。

━━ 四、進化記憶(你每天都在變強,以下是你從真實對話沉澱的實戰心得,優先參考) ━━
{{EVOLVED_INSIGHTS}}

━━ 五、輸出規範 ━━
·繁中台灣口語,像真人傳訊息。每則 220 字內,不用 emoji,不用驚嘆號連發。
·能推薦具體服務/方案就推具體的(報價由負責人出)。結尾永遠帶一個下一步。`;

const AMMO = `【服務彈藥庫(只談這裡有的,沒有的說「我幫您確認一下」)】
3Q 台灣在地品牌孵化所(台中):幫在地小店與個人品牌「從 0 起號到自動化經營」。
服務線:
·品牌起號:LINE 官方帳號建置(選單/自動回覆/AI 客服)、品牌官網一夜上線(自帶 SEO)、社群帳號起號。
·AI 導入:官網 AI 導購、LINE AI 成交客服(就是你現在對話的這套,本身就是作品)、自動發文系統(FB/IG 自動排程)。
·內容線:短影音內容產線、一拍多吃素材榨取。
真實實績(可查證,全是自家品牌做出來的):泡泡怪獸汽美(IG 13.6 萬追蹤、TikTok 累積 527 萬瀏覽、亞太 500+ 門市供應鏈)、呆丸土地公(選址情報所)、丹若、米速。我們先在自己品牌上驗證有效,才拿來服務客戶。
適合誰:想開始經營線上但不知從何下手的在地店家、想把詢問變訂單的小品牌、不想養行銷團隊的一人老闆。
成交動作:留下「你的行業+目前最卡的點+LINE 顯示名稱」,負責人一個工作天內回覆;或先看官網案例。報價依需求由負責人出,不亂喊價。`;

function buildSystemPrompt(insights) {
  return SEED_GENOME.replace('{{BRAND}}', '3Q 台灣在地品牌孵化所').replace('{{EVOLVED_INSIGHTS}}', insights || '(實戰數據累積中,先用上面的內功心法)')
    + '\n\n' + AMMO
    + '\n\n【LINE 成交場景】你在 LINE 跟潛在客戶對話。成交動作=請他留下「行業+最卡的點+稱呼」,負責人一個工作天內接洽;或引導看官網案例 ' + SITE + '。';
}

async function getCfg(env) {
  const [s, t, a, o] = await Promise.all([
    env.SESSION?.get('cfg:3q_line_secret'), env.SESSION?.get('cfg:3q_line_token'),
    env.SESSION?.get('cfg:3q_anthropic'), env.SESSION?.get('cfg:3q_owner'),
  ]);
  // 運行時清洗:鑰匙值不含空白;貼上時夾帶的空格/換行在這裡自動修復(含 KV 已存的壞值)
  const cl = (v) => (v || '').replace(/\s+/g, '');
  return {
    lineSecret: cl(s || env.Q3_LINE_SECRET),
    lineToken:  cl(t || env.Q3_LINE_TOKEN),
    anthropicKey: cl(a || env.ANTHROPIC_API_KEY),
    ownerId: (o || '').trim(),
  };
}

async function verifyLineSignature(body, sig, secret) {
  if (!sig || !secret) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return b64 === sig;
}

async function callBrain(history, env, cfg, systemPrompt, maxTokens) {
  const sys = systemPrompt || buildSystemPrompt('');
  if (cfg.anthropicKey) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': cfg.anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: maxTokens || 600,
          system: [{ type: 'text', text: sys, cache_control: { type: 'ephemeral' } }], messages: history }),
      });
      if (r.ok) { const d = await r.json(); return d.content?.[0]?.text || ''; }
      console.error('[3q-line] anthropic', r.status);
    } catch (e) { console.error('[3q-line] anthropic ex', e.message); }
  }
  if (env.AI) {
    const r = await env.AI.run(AI_MODEL, { messages: [{ role: 'system', content: sys }, ...history], max_tokens: maxTokens || 500 });
    return r?.response || '';
  }
  return '';
}

const RISK = /(先享後付|先用再付|分期|月費|保證賺|穩賺|最便宜|保證爆紅|保證營收)/g;
function clean(t) {
  let s = (t || '').replace(/\[STATE\][\s\S]*?(\[\/STATE\]|$)/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/[!！]/g, '。');
  if (RISK.test(s)) s = s.replace(RISK, '(此項負責人確認)');
  return s.trim().slice(0, 900);
}

async function lineReply(token, replyToken, text) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
}

async function ensureTables(env) {
  if (!env.CRM) return;
  try {
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS q3_line_customers (user_id TEXT PRIMARY KEY, first_seen TEXT, last_seen TEXT, msg_count INTEGER DEFAULT 0)").run();
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS q3_line_convos (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, role TEXT, text TEXT, created_at TEXT DEFAULT (datetime('now')))").run();
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS q3_seed_insights (id INTEGER PRIMARY KEY AUTOINCREMENT, insight TEXT, analyzed INTEGER, created_at TEXT)").run();
  } catch (e) { console.error('[3q-line] tables', e.message); }
}

async function loadInsights(env) {
  if (!env.CRM) return '';
  try {
    const r = await env.CRM.prepare("SELECT insight FROM q3_seed_insights ORDER BY id DESC LIMIT 3").all();
    const list = (r.results || []).map(x => x.insight).filter(Boolean);
    return list.length ? list.join('\n— — —\n') : '';
  } catch (_) { return ''; }
}

async function handleEvent(ev, env, cfg) {
  if (ev.type !== 'message' || ev.message?.type !== 'text') return;
  const uid = ev.source?.userId || 'unknown';
  const userMsg = ev.message.text.slice(0, 1000);

  if (/^我是老闆$/.test(userMsg.trim()) && !cfg.ownerId) {
    await env.SESSION?.put('cfg:3q_owner', uid);
    await lineReply(cfg.lineToken, ev.replyToken, '已綁定老闆身分。以後客人成交意向我會推給你。');
    return;
  }

  const kvKey = '3qline:' + uid;
  let hist = [];
  if (env.SESSION) { const raw = await env.SESSION.get(kvKey); if (raw) { try { hist = JSON.parse(raw); } catch (_) {} } }
  hist.push({ role: 'user', content: userMsg });

  const insights = await loadInsights(env);
  const sys = buildSystemPrompt(insights);
  const reply = clean(await callBrain(hist.slice(-12), env, cfg, sys)) || ('這題我幫您確認後回覆,也可以先看我們的案例:' + SITE);
  hist.push({ role: 'assistant', content: reply });
  if (env.SESSION) await env.SESSION.put(kvKey, JSON.stringify(hist.slice(-20)), { expirationTtl: 7 * 24 * 3600 });

  if (env.CRM) {
    const now = new Date().toISOString();
    await env.CRM.prepare("INSERT INTO q3_line_customers (user_id, first_seen, last_seen, msg_count) VALUES (?,?,?,1) ON CONFLICT(user_id) DO UPDATE SET last_seen=?, msg_count=msg_count+1").bind(uid, now, now, now).run().catch(() => {});
    await env.CRM.prepare("INSERT INTO q3_line_convos (user_id, role, text) VALUES (?, 'user', ?)").bind(uid, userMsg).run().catch(() => {});
    await env.CRM.prepare("INSERT INTO q3_line_convos (user_id, role, text) VALUES (?, 'assistant', ?)").bind(uid, reply).run().catch(() => {});
  }

  await lineReply(cfg.lineToken, ev.replyToken, reply);
}

// ═══ Reflexion 自我進化:看真實對話逐字稿 → 自省 → 沉澱實戰心得 → 餵回種子 ═══
async function handleEvolve(env, cfg, url) {
  if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
  await ensureTables(env);
  if (!env.CRM) return new Response(JSON.stringify({ ok: false, note: '無 D1' }), { headers: { 'Content-Type': 'application/json' } });
  const rows = await env.CRM.prepare("SELECT role, text FROM q3_line_convos ORDER BY id DESC LIMIT 60").all();
  const convos = (rows.results || []).reverse();
  if (convos.length < 4) {
    return new Response(JSON.stringify({ ok: true, evolved: false, note: '對話數據不足,先累積(<4)', count: convos.length }), { headers: { 'Content-Type': 'application/json' } });
  }
  const transcript = convos.map(c => (c.role === 'user' ? '客人' : 'AI') + ': ' + c.text).join('\n');
  const reflectPrompt = `你是頂尖銷售教練,正在訓練一個品牌孵化服務的成交 AI。以下是它最近的真實對話逐字稿。像教練看比賽錄影一樣,找出可複製的實戰心得:
① 哪些回覆有效推進成交、或讓客人更投入?為什麼?
② 哪些回覆讓客人冷掉、句點、流失?該怎麼改?
③ 反覆出現的問題,最好的標準答法是什麼?
輸出 4-6 條精煉「實戰心得」,每條一句話、具體可直接照做,繁中。只輸出心得清單,不要前言客套。

逐字稿:
${transcript}`;
  const insight = (await callBrain([{ role: 'user', content: reflectPrompt }], env, cfg, '你是嚴格、務實、只講重點的銷售教練。', 700)).trim();
  if (insight) {
    await env.CRM.prepare("INSERT INTO q3_seed_insights (insight, analyzed, created_at) VALUES (?, ?, datetime('now'))").bind(insight, convos.length).run().catch(() => {});
  }
  return new Response(JSON.stringify({ ok: true, evolved: !!insight, analyzed: convos.length, insight }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

const SETUP_HTML = (done) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>3Q LINE bot 設定</title>
<body style="font-family:system-ui;max-width:520px;margin:30px auto;padding:0 16px;background:#0c0f14;color:#e8edf5">
<h2>3Q 孵化所 LINE 成交 bot 設定</h2>
${done ? '<p style="color:#06c755">✅ 已設定完成。要重設就重新填。</p>' : ''}
<form method=POST>
<p>LINE Channel Secret<br><input name=line_secret style="width:100%;padding:9px" autocomplete=off></p>
<p>LINE Channel Access Token<br><input name=line_token style="width:100%;padding:9px" autocomplete=off></p>
<p>Anthropic API Key(選填,留空用免費 70B)<br><input name=anthropic style="width:100%;padding:9px" autocomplete=off></p>
<button style="background:#caa64a;border:0;padding:10px 20px;font-weight:700;border-radius:8px">儲存並啟用</button>
</form><p style="color:#67748a;font-size:12px">⚠ 填了 Token 儲存會把 LINE webhook 切到這個新 bot(現有 3q-hatchery-webhook 會被切走)。想先不切:測完隨時可在 LINE Developers 後台把 webhook URL 改回原本的,完全可逆。</p></body>`;

async function handleSetup(req, env, url) {
  if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
  if (req.method === 'POST') {
    const f = await req.formData();
    // 防呆:鑰匙類值一律不含空白,自動清除貼上時夾帶的空格/換行(斷行貼上也能自動修復)
    const strip = (v) => (v || '').replace(/\s+/g, '');
    const sec = strip(f.get('line_secret')), tok = strip(f.get('line_token')), ak = strip(f.get('anthropic'));
    if (sec) await env.SESSION.put('cfg:3q_line_secret', sec);
    if (tok) await env.SESSION.put('cfg:3q_line_token', tok);
    if (ak) await env.SESSION.put('cfg:3q_anthropic', ak);
    if (tok) {
      const hookUrl = url.origin + '/webhook';
      await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', {
        method: 'PUT', headers: { 'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: hookUrl }),
      }).catch(() => {});
    }
    return new Response(SETUP_HTML(true), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return new Response(SETUP_HTML(false), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/setup') return handleSetup(request, env, url);
    if (url.pathname === '/admin/evolve') { const cfg = await getCfg(env); return handleEvolve(env, cfg, url); }
    // 診斷端點:webhook 指向/官方實測/bot 身分/token 活性,一次看清(&set=1 順便把 endpoint 指回本 worker)
    if (url.pathname === '/admin/webhook') {
      if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
      const cfg = await getCfg(env);
      if (!cfg.lineToken) return new Response(JSON.stringify({ error: 'no token in KV' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      const H = { 'Authorization': 'Bearer ' + cfg.lineToken };
      const HJ = { ...H, 'Content-Type': 'application/json' };
      const out = { tokenLen: cfg.lineToken.length, secretLen: cfg.lineSecret.length };
      try {
        if (url.searchParams.get('set') === '1') {
          const p = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', { method: 'PUT', headers: HJ, body: JSON.stringify({ endpoint: url.origin + '/webhook' }) });
          out.put = { status: p.status, body: await p.text() };
        }
        const g = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', { headers: H });
        out.endpoint = await g.json().catch(() => ({ httpStatus: g.status }));
        const t = await fetch('https://api.line.me/v2/bot/channel/webhook/test', { method: 'POST', headers: HJ, body: '{}' });
        out.test = await t.json().catch(() => ({ httpStatus: t.status }));
        const b = await fetch('https://api.line.me/v2/bot/info', { headers: H });
        out.bot = b.ok ? await b.json() : { httpStatus: b.status, note: b.status === 401 ? 'token 失效(可能被 reissue 過)' : 'api error' };
      } catch (e) { out.error = e.message; }
      return new Response(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    if (url.pathname === '/health') {
      const cfg = await getCfg(env);
      let insights = 0;
      if (env.CRM) { try { const r = await env.CRM.prepare("SELECT COUNT(*) n FROM q3_seed_insights").first(); insights = r?.n || 0; } catch (_) {} }
      return new Response(JSON.stringify({ ok: true, worker: '3q-line-oa', seed: SEED_VER, secret: !!cfg.lineSecret, token: !!cfg.lineToken, ai: cfg.anthropicKey ? 'claude-sonnet-4-6' : 'workers-ai-70b', owner: !!cfg.ownerId, crm: !!env.CRM, evolved_insights: insights }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/webhook' && request.method === 'POST') {
      const cfg = await getCfg(env);
      const body = await request.text();
      const valid = await verifyLineSignature(body, request.headers.get('x-line-signature'), cfg.lineSecret);
      if (!valid) return new Response('bad signature', { status: 403 });
      const data = JSON.parse(body);
      // ⚡ 土地公模式:先回 200 讓 LINE 安心,AI 思考放背景跑(LINE 等不到回應會掛斷並處決 worker)
      ctx.waitUntil((async () => {
        await ensureTables(env);
        for (const ev of (data.events || [])) {
          await handleEvent(ev, env, cfg).catch(e => console.error('[3q-line] event', e.message));
        }
      })());
      return new Response('ok');
    }
    return new Response('3q hatchery line bot (seed ' + SEED_VER + '). /setup?key=... to configure.', { status: 200 });
  },
};
