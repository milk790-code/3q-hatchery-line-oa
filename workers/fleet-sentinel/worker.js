// fleet-sentinel — 每日巡檢哨兵 v1.2
// v1.2(2026-07-29):+補上 16 支盲區(原本只巡 34/53,帳號裡有 19 支完全沒在看,連中控台
//   milk790-control 自己都沒被巡)。+「待設定」分類:503 且已知是缺 secret 的,不算掛掉、
//   單獨列一區,避免每天對同一個已知狀態狂叫(alert fatigue)。
//   ⚠️ 這版之前 repo 停在 v1.0 而線上是 v1.1,誰改 repo 一 push 就會把線上降級——已補平。
// v1.1(2026-07-17):+聾啞偵測(line-oa 讀 /health JSON 的 secret/token 與 dbg 簽章時間戳,HTTP 200 但聾了也告警)
//   +推播 token 後備鏈(env 沒設就讀 SESSION KV cfg:pop→cfg:3q,雙 channel 互備)+pop-r-redirect 監控
// 每天定時(cron)打一輪所有對外 Worker 的 /health，掛掉就 LINE 推播通知老闆；
// 另可選擇性拉 Anthropic 用量(需 Admin key)。純唯讀巡檢，不改任何資料。
//
// 綁定(部署時設):
//   LINE_TOKEN          (secret) 用來推播的 LINE channel access token
//   OWNER_USER_ID       (var)    收通知的老闆 LINE userId
//   RUN_KEY             (secret) 手動 /run?key= 的通行碼(fail-closed，沒設就擋)
//   ANTHROPIC_ADMIN_KEY (secret, 選填) 有設才拉用量；沒設就跳過那段
//
// 對外端點:
//   GET /health           → {ok:true}
//   GET /run?key=RUN_KEY  → 立刻跑一輪並回 JSON 報告(也會在有異常時推播)

// 監控清單:name=顯示名, url=健康檢查網址。
// 判定原則:連得到 = 活著(含 401/404 密碼保護也算活)；連不到或 5xx = 掛了。
const TARGETS = [
  { n: '3q-hatchery-webhook', u: 'https://3q-hatchery-webhook.milk790.workers.dev/health' },
  { n: '3q-line-oa',          u: 'https://3q-line-oa.milk790.workers.dev/health', d: 1 },
  { n: 'pop-line-oa',         u: 'https://pop-line-oa.milk790.workers.dev/health', d: 1 },
  { n: 'pop-monster-webhook', u: 'https://pop-monster-webhook.milk790.workers.dev/' },
  { n: 'tudigong-line-oa',    u: 'https://tudigong-line-oa.milk790.workers.dev/health', d: 1 },
  { n: 'gongwan-line-oa',     u: 'https://gongwan-line-oa.milk790.workers.dev/health', d: 1 },
  { n: 'luxury-line-oa',      u: 'https://luxury-line-oa.milk790.workers.dev/', d: 1 },
  { n: 'contract-line-oa',    u: 'https://contract-line-oa.milk790.workers.dev/health', d: 1 },
  { n: 'pop-r-redirect',      u: 'https://pop-r-redirect.milk790.workers.dev/health' },
  { n: 'duzhai-car-intake',   u: 'https://duzhai-car-intake.milk790.workers.dev/health' },
  { n: '3q-sales-ai',         u: 'https://3q-sales-ai.milk790.workers.dev/health' },
  { n: 'pop-sales-ai',        u: 'https://pop-sales-ai.milk790.workers.dev/health' },
  { n: 'tudigong-sales-ai',   u: 'https://tudigong-sales-ai.milk790.workers.dev/health' },
  { n: 'cdg-core',            u: 'https://cdg-core.milk790.workers.dev/health' },
  { n: 'cdg-core-eyes',       u: 'https://cdg-core-eyes.milk790.workers.dev/health' },
  { n: 'pop-ecpay',           u: 'https://pop-ecpay.milk790.workers.dev/' },
  { n: 'creatorkit',          u: 'https://creatorkit.milk790.workers.dev/health' },
  { n: 'pop-site',            u: 'https://pop-site.milk790.workers.dev/' },
  { n: 'pop-car-doctor',      u: 'https://pop-car-doctor.milk790.workers.dev/' },
  { n: 'sanfinger-home',      u: 'https://sanfinger-home.milk790.workers.dev/' },
  { n: 'sanfinger-deliver',   u: 'https://sanfinger-deliver.milk790.workers.dev/' },
  { n: '3q-site',             u: 'https://3q-site.milk790.workers.dev/' },
  { n: '3q-art-portfolio',    u: 'https://3q-art-portfolio.milk790.workers.dev/' },
  { n: '3q-outreach',         u: 'https://3q-outreach.milk790.workers.dev/health' },
  { n: 'ford-agent',          u: 'https://ford-agent.milk790.workers.dev/data' },
  { n: '3q-ai-subsidy',       u: 'https://3q-ai-subsidy.milk790.workers.dev/' },
  { n: 'subsidy-lead-api',    u: 'https://subsidy-lead-api.milk790.workers.dev/' },
  { n: 'inquiry-intake',      u: 'https://inquiry-intake.milk790.workers.dev/' },
  { n: '3q-fukubukuro-push',  u: 'https://3q-fukubukuro-push.milk790.workers.dev/' },
  { n: 'hatchery-token-editor', u: 'https://hatchery-token-editor.milk790.workers.dev/' },
  { n: '3q-track',            u: 'https://3q-track.milk790.workers.dev/health' },
  { n: '3q-social-publisher', u: 'https://3q-social-publisher.milk790.workers.dev/health' },
  { n: 'loop-orchestrator',   u: 'https://loop-orchestrator.milk790.workers.dev/' },
  { n: 'loop-remote',         u: 'https://loop-remote.milk790.workers.dev/health' },
  // ── v1.2 補上的盲區(2026-07-29 全帳號 53 支逐一實測後補齊;路徑是實測會回 200 的那個) ──
  { n: 'milk790-control',     u: 'https://milk790-control.milk790.workers.dev/' },   // 中控台自己以前沒被巡
  { n: 'archive-gallery',     u: 'https://archive-gallery.milk790.workers.dev/' },   // 401 密碼保護=活著
  { n: 'three-fingers-push',  u: 'https://three-fingers-push.milk790.workers.dev/' },
  { n: 'growth-pulse',        u: 'https://growth-pulse.milk790.workers.dev/' },
  { n: 'weather-touch',       u: 'https://weather-touch.milk790.workers.dev/' },
  { n: 'xueyi-brain-relay',   u: 'https://xueyi-brain-relay.milk790.workers.dev/' },
  { n: 'xueyi-linkhub',       u: 'https://xueyi-linkhub.milk790.workers.dev/' },
  { n: 'sales-diagnosis',     u: 'https://sales-diagnosis.milk790.workers.dev/' },
  { n: 'jilin-demo',          u: 'https://jilin-demo.milk790.workers.dev/' },
  { n: 'popcard-demo',        u: 'https://popcard-demo.milk790.workers.dev/' },
  { n: 'popcard-saas-preview',u: 'https://popcard-saas-preview.milk790.workers.dev/' },
  { n: 'popcard-video',       u: 'https://popcard-video.milk790.workers.dev/' },
  { n: '3q-art-portfolio-stg',u: 'https://3q-art-portfolio-stg.milk790.workers.dev/' },
  { n: '3q-growth-loop-candidate', u: 'https://3q-growth-loop-candidate.milk790.workers.dev/health' },
  // pending:1 = 已知「程式好了但還沒貼 secret」,回 503 是預期狀態,不算掛掉、單獨列一區。
  // 等你把 secret 設好、它變 200 之後,把 pending 拿掉就會納入正常告警。
  { n: 'leads-board',         u: 'https://leads-board.milk790.workers.dev/', pending: 1 },
  { n: 'popcard-public-safe-tracker', u: 'https://popcard-public-safe-tracker.milk790.workers.dev/', pending: 1 },
];

// 沒納入巡檢、需要人決定的(2026-07-29 實測 / 與 /health 與 POST /webhook 全 404,
// 從 workers.dev 證明不了死活,可能走自訂網域也可能該退役)：
//   control-center     ← 功能與 milk790-control 重疊,ACTIVE-CONTEXT 還寫著「已上線」但打不到
//   popcard-saas-prod  ← preview 版活著,prod 可能綁自訂網域
// fleet-sentinel 自己不自巡(掛了也發不出通知,自巡沒有意義)。

async function probe(t) {
  const started = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(t.u, { signal: ctrl.signal, headers: { 'user-agent': 'fleet-sentinel/1.0' } });
    clearTimeout(timer);
    const ms = Date.now() - started;
    // 連得到就算活(含 401/404 密碼保護)；只有 5xx 或連不到才算掛
    // pending 標記的目標(已知缺 secret)回 5xx 是預期狀態,不算掛,另外歸類
    const bad5xx = r.status >= 500;
    const down = bad5xx && !t.pending;
    const out = { name: t.n, status: r.status, ms, down };
    if (t.pending && bad5xx) out.waiting = true;
    if (t.pending && !bad5xx) out.ready = true;   // secret 設好了 → 提醒可以把 pending 拿掉
    if (t.d && !down && r.status === 200) {
      try {
        const j = await r.json();
        if (j && (j.secret === false || j.token === false)) {
          out.deaf = true; out.reason = '憑證遺失(secret/token=false)';
        } else if (j && j.dbg && j.dbg.last_badsig && j.dbg.last_oksig) {
          const bad = Date.parse(j.dbg.last_badsig), ok = Date.parse(j.dbg.last_oksig);
          if (Number.isFinite(bad) && Number.isFinite(ok) && bad > ok && (Date.now() - ok) > 24 * 3600 * 1000) {
            out.deaf = true; out.reason = '簽章持續失敗,最後成功 ' + j.dbg.last_oksig.slice(0, 10);
          }
        }
      } catch (e) {}
    }
    return out;
  } catch (e) {
    return { name: t.n, status: 0, ms: Date.now() - started, down: true, err: String(e).slice(0, 80) };
  }
}

// 選填:拉昨天的 Anthropic 花費(需 Admin key)。任何失敗都吞掉，不影響巡檢主線。
async function anthropicCost(env) {
  if (!env.ANTHROPIC_ADMIN_KEY) return null;
  try {
    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); // 今天 00:00 UTC
    const start = new Date(end.getTime() - 24 * 3600 * 1000); // 昨天 00:00 UTC
    const qs = new URLSearchParams({
      starting_at: start.toISOString(),
      ending_at: end.toISOString(),
      bucket_width: '1d',
    });
    const r = await fetch('https://api.anthropic.com/v1/organizations/cost_report?' + qs, {
      headers: { 'x-api-key': env.ANTHROPIC_ADMIN_KEY, 'anthropic-version': '2023-06-01' },
    });
    if (!r.ok) return { error: 'cost_report ' + r.status };
    const d = await r.json();
    // 防呆加總:結構可能隨 API 版本變動，抓不到就回原始長度提示
    let usd = 0;
    for (const bucket of (d.data || [])) {
      for (const item of (bucket.results || [])) {
        const amt = Number(item?.amount ?? item?.cost ?? 0);
        if (Number.isFinite(amt)) usd += amt;
      }
    }
    return { yesterday_usd: Math.round(usd * 100) / 100 };
  } catch (e) {
    return { error: String(e).slice(0, 80) };
  }
}

async function resolvePush(env) {
  let token = (env.LINE_TOKEN || '').trim();
  let to = (env.OWNER_USER_ID || '').trim();
  if ((!token || !to) && env.SESSION) {
    const [pt, po, qt, qo] = await Promise.all([
      env.SESSION.get('cfg:pop_line_token'), env.SESSION.get('cfg:pop_owner'),
      env.SESSION.get('cfg:3q_line_token'), env.SESSION.get('cfg:3q_owner'),
    ]);
    const cl = (v) => (v || '').replace(/\s+/g, '');
    if (!token) token = cl(pt) || cl(qt);
    if (!to) to = (po || qo || '').trim();
  }
  return { token, to };
}

async function pushLine(env, text) {
  const { token, to } = await resolvePush(env);
  if (!token || !to) return false;
  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
  }).catch(() => null);
  return !!(r && r.ok);
}

async function sweep(env) {
  const results = await Promise.all(TARGETS.map(probe));
  const down = results.filter(x => x.down);
  const deaf = results.filter(x => x.deaf);
  const waiting = results.filter(x => x.waiting);   // 已知待設定,不吵
  const ready = results.filter(x => x.ready);       // 待設定的變活了 → 值得講一次
  const cost = await anthropicCost(env);
  return { checked: results.length, down, deaf, waiting, ready, cost, ts: new Date().toISOString() };
}

function report(rep) {
  const tw = new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16);
  const waiting = rep.waiting || [], ready = rep.ready || [];
  const bad = rep.down.length + rep.deaf.length;
  const tail = () => {
    let s = '';
    // 待設定的只在有異常時附帶一行,平常不單獨吵
    if (ready.length) s += `\n\n🎉 待設定的已經活了:${ready.map(x => x.name).join('、')}\n（貼好 secret 了，可以開始用；把程式裡的 pending 拿掉就會納入正常告警）`;
    if (rep.cost?.yesterday_usd != null) s += `\n昨日 Anthropic 花費約 US$${rep.cost.yesterday_usd}`;
    return s;
  };
  if (!bad) {
    let m = `✅ 艦隊巡檢 ${tw}\n${rep.checked - waiting.length}/${rep.checked} 支 Worker 正常(含聾啞檢查)。`;
    if (waiting.length) m += `\n（另有 ${waiting.length} 支待你設 secret：${waiting.map(x => x.name).join('、')}——這是預期狀態，不是壞了）`;
    return m + tail();
  }
  let m = `⚠️ 艦隊巡檢 ${tw}\n${bad}/${rep.checked} 支異常:\n`;
  if (rep.down.length) m += rep.down.map(x => `• ${x.name} (${x.err ? '連不到' : 'HTTP ' + x.status})`).join('\n') + '\n';
  if (rep.deaf.length) m += rep.deaf.map(x => `🔇 ${x.name} 聾了:${x.reason}(HTTP 正常但收不到客人訊息,速查 LINE Channel Secret)`).join('\n');
  if (waiting.length) m += `\n（待設定，非故障：${waiting.map(x => x.name).join('、')}）`;
  return m + tail();
}

export default {
  async scheduled(event, env, ctx) {
    const rep = await sweep(env);
    // 只在有異常時推播，正常日不吵你(想每天都收就把下面 if 拿掉)
    if (rep.down.length || rep.deaf.length) await pushLine(env, report(rep));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, worker: 'fleet-sentinel', ver: 'v1.2', targets: TARGETS.length }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/run') {
      if (!env.RUN_KEY || url.searchParams.get('key') !== env.RUN_KEY) return new Response('forbidden', { status: 403 });
      const rep = await sweep(env);
      if (rep.down.length || rep.deaf.length) await pushLine(env, report(rep));
      return new Response(JSON.stringify(rep, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    return new Response('fleet-sentinel v1.2', { status: 200 });
  },
};