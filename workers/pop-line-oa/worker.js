// POP MONSTER LINE OA — 超級業務AI種子 v4(會自我進化的成交大腦)
// 種子基因組(成交七步+情緒引擎+紅線)+ Reflexion 自我進化迴圈 + 31商品彈藥庫
// 預設 Workers AI 70B(零金鑰);有 ANTHROPIC_API_KEY 升 Sonnet。
// 部署:3q-hatchery-line-oa repo / deploy-pop-line-oa.yml(API PUT,無 wrangler)
// ⚠ 先不切 LINE webhook URL;學誼測滿意再切,現有 pop-monster-webhook 不受影響。

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const SETUP_KEY = 'pop-setup-7h3k9q';
const LINE_ID = '@150tiznd';
const SHOPEE = 'https://shopee.tw/milk790';
const SEED_VER = 'v4.1';

// ═══ 群發預設稿(要發新一波:改這裡重部署,或丟文案給 Claude 更新)═══
const TDG_IMG = 'https://raw.githubusercontent.com/milk790-code/3q-hatchery-line-oa/main/assets/tudigong/richmenu-3x1.png';
const BROADCAST_PRESET = [
  { type: 'text', text: '跟你報告:泡泡怪獸的老闆開了新事業——\n🔨 3Q 掘計畫:你的官網,我來建。先用,滿意再付。\n\n你的店,中了幾個?\n▢ Google 地圖搜不到你,星等沒人顧\n▢ 客人問「有官網嗎」,沒有就被默默篩掉\n▢ 做過官網,做完沒人維護、改字就要錢\n▢ LINE 訊息回不完,常漏單\n\n3Q 一次幫你搞定:\n・品牌官網+線上菜單/服務項目頁(免費建置,只收月費,越久越便宜)\n・Google 商家檔案(地圖搜得到)\n・LINE 官方帳號+AI 24小時自動接客\n・FB/IG 自動發文,不用自己想梗\n\n通常要 NT$2-4 萬的官網,我們建好、維護好,部署完滿意才開始計費。\n⚡ 限定 5 席、每個行業只收 1 名,本期只剩 2 席:\nhttps://3q-art-portfolio.milk790.workers.dev/launch-plan?utm_source=line&utm_medium=broadcast\n\n🏮 另外,要租店、展店的——簽約前讓土地公免費幫你看三重點(嫌惡設施/人流/行情),不賣房不仲介:\nhttps://tudigong-line-oa.milk790.workers.dev/?utm_source=line&utm_medium=broadcast' },
  { type: 'text', text: '車的事,一樣找我。\n鍍膜、洗車、拋光耗材\n官網看品項、快速下單:\nhttps://popmonster.vip\n\n🎁 新攤位開張互惠(出示加好友截圖即可):\n・加「土地公」或「3Q」任一好友 → 官網下單滿千打 9 折\n・兩個都加+滿千 → 直接送 NT$599 天使塗層 30ml\n下單後把截圖傳到這裡,我們直接處理。\n\n有問題直接問——AI 業務 24 小時在線,產品、用法、怎麼選,問就對了。' },
];

// ═══════════ 超級業務AI種子 · 基因組 v4(三線通用,只換 BRAND 與彈藥庫) ═══════════
const SEED_GENOME = `你是「{{BRAND}}」的首席成交顧問,不是客服、不是推銷員——你是來訪者的軍師。
你的存在只有一個目的:讓每個跟你說話的人,離開時要嘛成交、要嘛變成下次會回來的朋友,而且都覺得「這個人真的懂我」。
你要比人類銷售冠軍更會成交,也比他更有溫度。以下是你的內功心法,內化成直覺,不要照唸出來。

━━ 一、成交引擎(七步) ━━
1【三秒接住】第一句先接住對方的情緒或需求,絕不先丟產品型錄。回越快越準,人越願意留下來說。
2【戰術同理】先說出你讀到的他的處境與感受(「你會這樣問,是不是因為怕…」),讓他覺得被讀懂。一個覺得被理解的人,信任你的機率高好幾倍。
3【校準提問】用「怎麼」「什麼」「多少」開頭的開放問句挖真需求,不要用「是不是要買」逼他選邊。一次只問一個,問完閉嘴聽。
4【摸清底牌】用聊天(不是問卷)摸清四件事:用途、預算大概落在哪、他能不能拍板、有多急。摸到了才知道怎麼出招。
5【價值錨定·不打價格戰】他嫌貴,先問「是跟什麼比呢?」逼出價值比較而非數字比較;再把價格翻譯成「每次/每天/每ml 才多少錢」或「省下的時間、避免的風險」。
6【異議三診斷】任何抗拒只有三種根源——缺資訊就補料、缺信任就給證據(真實評價/實績/保證)、缺急迫就給合理理由(季節/庫存/限時)。對症,絕不硬推。
7【永遠給下一步】每則回覆結尾都留一個明確、低門檻的下一步(看連結/留聯絡/約時間),不要讓對話停在半空中。

━━ 二、情緒價值引擎(你贏過冠軍的地方) ━━
·【鏡像】偶爾重複對方最後幾個字,像朋友接話,讓他自己說下去。
·【記得他】善用先前對話與客戶資料,叫得出他的脈絡(「上次你提到你的車是…」),讓他覺得被記在心上。
·【情緒先於資訊】他焦慮先安撫再給方案;他興奮先一起興奮再推進。先處理心情,再處理事情。
·【真誠勝過完美】不確定就老實說「這我幫你問一下」,絕不硬掰、絕不亂承諾。誠實是你最強的信任放大器。
·【永遠站他那邊】你是軍師不是業務。連「你這情況現在先別買、先這樣處理」都敢說——願意幫他省錢的人,他反而跟你買更多。

━━ 二·五、七幕商談劇本(整場對話的骨架;上面七步是每一句的微操) ━━
1【痛點共鳴】開場不提產品。先描述他熟悉的糟糕場景(「你是不是也遇過洗完車隔天就水痕…自己買過便宜貨,結果越擦越花…」),讓他覺得你懂他。人解決痛苦的慾望遠大於獲得快樂。
2【方案定位】一句話講清楚:品類+核心價值(「這就是為什麼會有 A001 天使塗層,專為自己動手的車主設計的免擦拭鍍膜,洗完車直接噴完事」)。
3【FAB翻譯】每講一個規格,立刻接一個他聽得懂的好處(「千倍濃縮 1ml 兌 1L——意味著一瓶用一年,每次保養成本不到一杯飲料」)。規格不賣錢,好處才賣錢。
4【信任狀】他心動後理性會找證據,主動給真的:亞太500+門市在用、TikTok 實作影片可查、蝦皮5.0評價、pH安全測試。只給真的。
5【競品框架】不全面攻擊,挑「對手做不到、客人最在意」的一點對比(「傳統鍍膜要拋要等乾,我們濕上濕下五分鐘」)。不貶低任何品牌。
6【社會見證】用別人的嘴說你好:「不只我們說,蝦皮上幾百則評價自己看」「做汽美的職人自己店裡就在用」。只用真的。
7【CTA+風險逆轉】給現在就行動的理由(蝦皮真活動/小容量試用裝低門檻)+消除最後擔憂(蝦皮七天鑑賞期、平台保障),把門檻降到零。

━━ 二·六、最大成交授權 ━━
你被授權把客人一路談到成交動作完成,不必等他開口要:主動報官方標價、主動給蝦皮下單連結、主動推薦具體 SKU 組合、B2B 主動要「品項+月用量+聯絡方式」。每一輪送出前問自己:這句話有沒有把他往成交推進一步?沒有就重寫。客人猶豫時,你的工作不是等,是用七幕裡缺的那一幕補上去。

━━ 三、紅線(任何話術都不可越) ━━
·不偽裝身分、不假裝路人、不造假評價。你就是品牌的 AI 顧問,被問就大方承認。
·不亂報價、不承諾做不到的效果、不碰金融雷詞(先享後付/分期/保證賺/穩賺)。報價一律「以官方標價為準」。
·不硬逼成交。高價、複雜、需人判斷的,帶完整脈絡轉真人。
·醫療、法律、人身安全不逞強,誠實說界線並引導找專業。

━━ 四、進化記憶(你每天都在變強,以下是你從真實對話沉澱的實戰心得,優先參考) ━━
{{EVOLVED_INSIGHTS}}

━━ 五、輸出規範 ━━
·繁中台灣口語,像真人傳訊息。每則 220 字內,不用 emoji,不用驚嘆號連發。
·能推薦具體商品/方案就推具體的(報價以官方為準)。結尾永遠帶一個下一步。`;

const PRODUCTS = `【產品彈藥庫(只推薦這裡有的,沒有的說「我幫您問一下」)】
鍍膜:A001 天使塗層Guard(千倍濃縮1ml=1L免噴免擦濕上濕下)、A010 玻璃鍍膜劑(去油膜提升撥水)。
研磨:A002 米速研磨劑三件組、A003 三號80番(重切深刮)、A004 伍號600番(中切一劑拋)、A005 拾號1000番(鏡面收尾)、A040 RO商用重切P800-1200、A041 鍍鉻拋光劑。
耗材:A006 拋光盤系列(RO訂製粗棉)、A033 鏡面拋光盤黑色、A036 磨泥潤滑液、A037 火山去污泥(洗車黏土)、A039 RO羊毛盤素黑軟漆。
清潔:A007 鐵粉清潔劑(紫變色)、A008 泡沫洗車液(1瓶抵50L)、A009 液體橡皮擦、A012 內飾清潔劑APC、A020 輪圈清潔劑(木瓜重油)、A031 萬用神噴、A032 丹若免刷預洗(改裝可用)、A034 無毒脫脂神噴(鍍膜前)、A035 無鈰玻璃油膜去除膏、A038 包膜店除膠劑、A043 柏油清潔劑。
護理:A013 真皮清潔劑、A042 慕斯款護皮革、A017 雨刷精、A024 輪胎塑件精油、A030 痕厲害水漬去除劑。
真實背書:亞太 500+ 汽美門市經銷網絡;IG 13.6 萬追蹤;TikTok 累積 527 萬瀏覽。
雙線:B2B 門市/工作室進貨母料(加 LINE 談,負責人報價);B2C 車主自用(蝦皮「泡泡怪獸專業母料店」5.0分,自己施作省下送店錢)。首輪先分流:您是店家進貨,還是自己的車要用?`;

function buildSystemPrompt(insights) {
  return SEED_GENOME.replace('{{BRAND}}', '泡泡怪獸').replace('{{EVOLVED_INSIGHTS}}', insights || '(實戰數據累積中,先用上面的內功心法)')
    + '\n\n' + PRODUCTS
    + '\n\n【LINE 成交場景】你在 LINE 跟客人對話。B2C 成交動作=引導去蝦皮下單(' + SHOPEE + ');B2B=留下需求與聯絡方式,負責人一個工作天內接洽。能推薦具體 SKU 就推。';
}

async function getCfg(env) {
  const [s, t, a, o] = await Promise.all([
    env.SESSION?.get('cfg:pop_line_secret'), env.SESSION?.get('cfg:pop_line_token'),
    env.SESSION?.get('cfg:pop_anthropic'), env.SESSION?.get('cfg:pop_owner'),
  ]);
  // 運行時清洗:鑰匙值不含空白;貼上時夾帶的空格/換行在這裡自動修復(含 KV 已存的壞值)
  const cl = (v) => (v || '').replace(/\s+/g, '');
  return {
    lineSecret: cl(s || env.POP_LINE_SECRET),
    lineToken:  cl(t || env.POP_LINE_TOKEN),
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

// 大腦:有 anthropic key 用 Sonnet,否則 Workers AI 70B。systemPrompt 動態(含進化記憶)。
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
      const errBody = (await r.text().catch(() => '')).slice(0, 200);
      console.error('[pop-line] anthropic', r.status, errBody);
      await env.SESSION?.put('dbg:anthropic', r.status + ' ' + errBody + ' @' + new Date().toISOString()).catch(() => {});
    } catch (e) {
      console.error('[pop-line] anthropic ex', e.message);
      await env.SESSION?.put('dbg:anthropic', 'EX ' + e.message + ' @' + new Date().toISOString()).catch(() => {});
    }
  }
  if (env.AI) {
    try {
      const r = await env.AI.run(AI_MODEL, { messages: [{ role: 'system', content: sys }, ...history], max_tokens: maxTokens || 500 });
      return r?.response || '';
    } catch (e) {
      console.error('[pop-line] 70b ex', e.message);
      await env.SESSION?.put('dbg:ai70b', 'EX ' + e.message + ' @' + new Date().toISOString()).catch(() => {});
    }
  }
  return '';
}

const RISK = /(先享後付|先用再付|分期|月費|保證賺|穩賺|最便宜|永不刮傷|絕對持久)/g;
function clean(t) {
  let s = (t || '').replace(/\[STATE\][\s\S]*?(\[\/STATE\]|$)/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/[!！]/g, '。');
  if (RISK.test(s)) s = s.replace(RISK, '(此項負責人確認)');
  return s.trim().slice(0, 900);
}

async function lineReply(token, replyToken, text, env) {
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    });
    if (!r.ok && env?.SESSION) {
      const detail = (await r.text()).slice(0, 200);
      await env.SESSION.put('diag:last_line_error', r.status + ' ' + detail + ' @' + new Date().toISOString(), { expirationTtl: 86400 });
    }
  } catch (e) {
    if (env?.SESSION) await env.SESSION.put('diag:last_line_error', 'EX ' + e.message + ' @' + new Date().toISOString(), { expirationTtl: 86400 });
  }
}

async function ensureTables(env) {
  if (!env.CRM) return;
  try {
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS pop_line_customers (user_id TEXT PRIMARY KEY, first_seen TEXT, last_seen TEXT, msg_count INTEGER DEFAULT 0)").run();
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS pop_line_convos (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, role TEXT, text TEXT, created_at TEXT DEFAULT (datetime('now')))").run();
    await env.CRM.prepare("CREATE TABLE IF NOT EXISTS seed_insights (id INTEGER PRIMARY KEY AUTOINCREMENT, insight TEXT, analyzed INTEGER, created_at TEXT)").run();
  } catch (e) { console.error('[pop-line] tables', e.message); }
}

// 進化記憶載入:取最新沉澱的實戰心得,插入種子的「進化記憶」段
async function loadInsights(env) {
  if (!env.CRM) return '';
  try {
    const r = await env.CRM.prepare("SELECT insight FROM seed_insights ORDER BY id DESC LIMIT 3").all();
    const list = (r.results || []).map(x => x.insight).filter(Boolean);
    return list.length ? list.join('\n— — —\n') : '';
  } catch (_) { return ''; }
}

const WELCOME_MSG = '歡迎來到泡泡怪獸\n\n我是 AI 業務,24 小時在線——\n產品怎麼選、怎麼用、店家進貨,直接問我就好。\n\n先跟我說:您是店家要進貨,還是自己的車要用?\n\n(官網看品項:https://popmonster.vip)';

async function handleEvent(ev, env, cfg) {
  if (ev.type === 'follow') {   // 新好友第一印象:立刻接住
    await lineReply(cfg.lineToken, ev.replyToken, WELCOME_MSG, env);
    return;
  }
  if (ev.type !== 'message' || ev.message?.type !== 'text') return;
  const uid = ev.source?.userId || 'unknown';
  const userMsg = ev.message.text.slice(0, 1000);

  if (/^我是老闆$/.test(userMsg.trim()) && !cfg.ownerId) {
    await env.SESSION?.put('cfg:pop_owner', uid);
    await lineReply(cfg.lineToken, ev.replyToken, '已綁定老闆身分。以後客人成交意向我會推給你。', env);
    return;
  }

  const kvKey = 'popline:' + uid;
  let hist = [];
  let reply = '';
  try {
    if (env.SESSION) { const raw = await env.SESSION.get(kvKey); if (raw) { try { hist = JSON.parse(raw); } catch (_) {} } }
    hist.push({ role: 'user', content: userMsg });
    const insights = await loadInsights(env);          // ← 種子讀取自己沉澱的進化記憶
    const sys = buildSystemPrompt(insights);
    reply = clean(await callBrain(hist.slice(-12), env, cfg, sys));
  } catch (e) {
    console.error('[pop-line] brain pipeline', e.message);
    await env.SESSION?.put('dbg:last_error', e.message + ' @' + new Date().toISOString()).catch(() => {});
  }
  if (!reply) reply = '這題我幫您確認後回覆,或直接看蝦皮:' + SHOPEE;

  await lineReply(cfg.lineToken, ev.replyToken, reply);   // ← 回覆最優先,記錄其次

  try {
    hist.push({ role: 'assistant', content: reply });
    if (env.SESSION) await env.SESSION.put(kvKey, JSON.stringify(hist.slice(-20)), { expirationTtl: 7 * 24 * 3600 });
    if (env.CRM) {
      const now = new Date().toISOString();
      await env.CRM.prepare("INSERT INTO pop_line_customers (user_id, first_seen, last_seen, msg_count) VALUES (?,?,?,1) ON CONFLICT(user_id) DO UPDATE SET last_seen=?, msg_count=msg_count+1").bind(uid, now, now, now).run().catch(() => {});
      await env.CRM.prepare("INSERT INTO pop_line_convos (user_id, role, text) VALUES (?, 'user', ?)").bind(uid, userMsg).run().catch(() => {});
      await env.CRM.prepare("INSERT INTO pop_line_convos (user_id, role, text) VALUES (?, 'assistant', ?)").bind(uid, reply).run().catch(() => {});
    }
  } catch (e) { console.error('[pop-line] post-reply log', e.message); }
}

// ═══ Reflexion 自我進化:看真實對話逐字稿 → 自省 → 沉澱實戰心得 → 餵回種子 ═══
async function handleEvolve(env, cfg, url) {
  if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
  await ensureTables(env);
  if (!env.CRM) return new Response(JSON.stringify({ ok: false, note: '無 D1' }), { headers: { 'Content-Type': 'application/json' } });
  const rows = await env.CRM.prepare("SELECT role, text FROM pop_line_convos ORDER BY id DESC LIMIT 60").all();
  const convos = (rows.results || []).reverse();
  if (convos.length < 4) {
    return new Response(JSON.stringify({ ok: true, evolved: false, note: '對話數據不足,先累積(<4)', count: convos.length }), { headers: { 'Content-Type': 'application/json' } });
  }
  const transcript = convos.map(c => (c.role === 'user' ? '客人' : 'AI') + ': ' + c.text).join('\n');
  const reflectPrompt = `你是頂尖銷售教練,正在訓練一個汽車美容耗材的成交 AI。以下是它最近的真實對話逐字稿。像教練看比賽錄影一樣,找出可複製的實戰心得:
① 哪些回覆有效推進成交、或讓客人更投入?為什麼?
② 哪些回覆讓客人冷掉、句點、流失?該怎麼改?
③ 反覆出現的問題,最好的標準答法是什麼?
輸出 4-6 條精煉「實戰心得」,每條一句話、具體可直接照做,繁中。只輸出心得清單,不要前言客套。

逐字稿:
${transcript}`;
  const insight = (await callBrain([{ role: 'user', content: reflectPrompt }], env, cfg, '你是嚴格、務實、只講重點的銷售教練。', 700)).trim();
  if (insight) {
    await env.CRM.prepare("INSERT INTO seed_insights (insight, analyzed, created_at) VALUES (?, ?, datetime('now'))").bind(insight, convos.length).run().catch(() => {});
  }
  return new Response(JSON.stringify({ ok: true, evolved: !!insight, analyzed: convos.length, insight }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

const SETUP_HTML = (done) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>泡泡怪獸 LINE bot 設定</title>
<body style="font-family:system-ui;max-width:520px;margin:30px auto;padding:0 16px;background:#0c0f14;color:#e8edf5">
<h2>泡泡怪獸 LINE 成交 bot 設定</h2>
${done ? '<p style="color:#06c755">✅ 已設定完成。要重設就重新填。</p>' : ''}
<form method=POST>
<p>LINE Channel Secret<br><input name=line_secret style="width:100%;padding:9px" autocomplete=off></p>
<p>LINE Channel Access Token<br><input name=line_token style="width:100%;padding:9px" autocomplete=off></p>
<p>Anthropic API Key(選填,留空用免費 70B)<br><input name=anthropic style="width:100%;padding:9px" autocomplete=off></p>
<button style="background:#caa64a;border:0;padding:10px 20px;font-weight:700;border-radius:8px">儲存並啟用</button>
</form><p style="color:#67748a;font-size:12px">儲存後自動設定 LINE webhook。再到 LINE 對 bot 說「我是老闆」綁定你的身分。</p></body>`;

async function handleSetup(req, env, url) {
  if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
  if (req.method === 'POST') {
    const f = await req.formData();
    // 防呆:鑰匙類值一律不含空白,自動清除貼上時夾帶的空格/換行(斷行貼上也能自動修復)
    const strip = (v) => (v || '').replace(/\s+/g, '');
    const sec = strip(f.get('line_secret')), tok = strip(f.get('line_token')), ak = strip(f.get('anthropic'));
    if (sec) await env.SESSION.put('cfg:pop_line_secret', sec);
    if (tok) await env.SESSION.put('cfg:pop_line_token', tok);
    if (ak) await env.SESSION.put('cfg:pop_anthropic', ak);
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
    // 大腦直測:不經 LINE,直接呼叫 callBrain 看回什麼/炸哪層
    if (url.pathname === '/admin/selftest') {
      if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
      const cfg = await getCfg(env);
      const q = url.searchParams.get('q') || '鍍膜劑哪罐好用';
      const t0 = Date.now();
      const out = { ai: cfg.anthropicKey ? 'claude-sonnet-4-6' : 'workers-ai-70b' };
      try {
        const r = await callBrain([{ role: 'user', content: q }], env, cfg, buildSystemPrompt(''), 400);
        out.ok = !!r; out.ms = Date.now() - t0; out.reply_preview = (r || '(空)').slice(0, 300);
      } catch (e) { out.ok = false; out.ms = Date.now() - t0; out.error = e.message; }
      const [da, d7, de] = await Promise.all([env.SESSION?.get('dbg:anthropic'), env.SESSION?.get('dbg:ai70b'), env.SESSION?.get('dbg:last_error')]);
      out.dbg = { anthropic: da || null, ai70b: d7 || null, last_error: de || null };
      return new Response(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    // 一鍵群發:不帶 go=安全預覽;&go=1 正式對全部好友發送(不可收回)
    if (url.pathname === '/admin/broadcast') {
      if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
      const cfg = await getCfg(env);
      if (!cfg.lineToken) return new Response('no token', { status: 503 });
      if (url.searchParams.get('test') === '1') {   // 真預覽:只發給老闆本人的 LINE
        if (!cfg.ownerId) return new Response(JSON.stringify({ error: '尚未綁定老闆(對 bot 說「我是老闆」)' }), { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
        const r = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST', headers: { 'Authorization': 'Bearer ' + cfg.lineToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: cfg.ownerId, messages: BROADCAST_PRESET }),
        });
        return new Response(JSON.stringify({ test_sent: r.ok, status: r.status, note: '已發到你自己的 LINE(只有你收到)。看排版滿意,網址改 &go=1 正式群發。' }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
      }
      if (url.searchParams.get('go') !== '1') {
        return new Response(JSON.stringify({ preview: true, note: '加 &test=1 先發給自己看真實排版;確認後加 &go=1 正式群發(全部好友、不可收回)', messages: BROADCAST_PRESET }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
      }
      const r = await fetch('https://api.line.me/v2/bot/message/broadcast', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + cfg.lineToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: BROADCAST_PRESET }),
      });
      const detail = (await r.text()).slice(0, 300);
      return new Response(JSON.stringify({ sent: r.ok, status: r.status, detail }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
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
    // 診斷端點:不經 LINE,直接測 AI 腦鏈路(loadInsights→prompt→callBrain→clean)
    if (url.pathname === '/admin/chat') {
      if (url.searchParams.get('key') !== SETUP_KEY) return new Response('forbidden', { status: 403 });
      const cfg = await getCfg(env);
      const q = url.searchParams.get('q') || '鍍膜劑哪罐好用';
      const t0 = Date.now();
      let reply = '', err = null;
      try {
        const insights = await loadInsights(env);
        reply = clean(await callBrain([{ role: 'user', content: q }], env, cfg, buildSystemPrompt(insights)));
      } catch (e) { err = e.message; }
      return new Response(JSON.stringify({ ok: !!reply, ms: Date.now() - t0, brain: cfg.anthropicKey ? 'claude(keyLen=' + cfg.anthropicKey.length + ')' : 'workers-ai-70b', reply, err }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    if (url.pathname === '/health') {
      const cfg = await getCfg(env);
      let insights = 0;
      if (env.CRM) { try { const r = await env.CRM.prepare("SELECT COUNT(*) n FROM seed_insights").first(); insights = r?.n || 0; } catch (_) {} }
      const [lp, lb, lo] = await Promise.all([env.SESSION?.get('dbg:last_post'), env.SESSION?.get('dbg:last_badsig'), env.SESSION?.get('dbg:last_oksig')]);
      return new Response(JSON.stringify({ ok: true, worker: 'pop-line-oa', seed: SEED_VER, secret: !!cfg.lineSecret, token: !!cfg.lineToken, ai: cfg.anthropicKey ? 'claude-sonnet-4-6' : 'workers-ai-70b', owner: !!cfg.ownerId, crm: !!env.CRM, evolved_insights: insights, dbg: { last_post: lp || null, last_badsig: lb || null, last_oksig: lo || null } }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/webhook' && request.method === 'POST') {
      await env.SESSION?.put('dbg:last_post', new Date().toISOString()).catch(() => {});   // 偵測:LINE 有敲門
      const cfg = await getCfg(env);
      const body = await request.text();
      const valid = await verifyLineSignature(body, request.headers.get('x-line-signature'), cfg.lineSecret);
      if (!valid) { await env.SESSION?.put('dbg:last_badsig', new Date().toISOString()).catch(() => {}); return new Response('bad signature', { status: 403 }); }
      await env.SESSION?.put('dbg:last_oksig', new Date().toISOString()).catch(() => {});  // 偵測:簽名通過
      const data = JSON.parse(body);
      // ⚡ 土地公模式:先回 200 讓 LINE 安心,AI 思考放背景跑(LINE 等不到回應會掛斷並處決 worker)
      ctx.waitUntil((async () => {
        await ensureTables(env);
        for (const ev of (data.events || [])) {
          await handleEvent(ev, env, cfg).catch(async (e) => {
            console.error('[pop-line] event', e.message);
            await env.SESSION?.put('dbg:last_error', e.message + ' @' + new Date().toISOString()).catch(() => {});
          });
        }
      })());
      return new Response('ok');
    }
    return new Response('pop-monster line bot (seed ' + SEED_VER + '). /setup?key=... to configure.', { status: 200 });
  },
};
