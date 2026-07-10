// fleet-sentinel — 每日巡檢哨兵 v1.0
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
  { n: '3q-line-oa',          u: 'https://3q-line-oa.milk790.workers.dev/health' },
  { n: 'pop-line-oa',         u: 'https://pop-line-oa.milk790.workers.dev/health' },
  { n: 'pop-monster-webhook', u: 'https://pop-monster-webhook.milk790.workers.dev/' },
  { n: 'tudigong-line-oa',    u: 'https://tudigong-line-oa.milk790.workers.dev/health' },
  { n: 'gongwan-line-oa',     u: 'https://gongwan-line-oa.milk790.workers.dev/health' },
  { n: 'luxury-line-oa',      u: 'https://luxury-line-oa.milk790.workers.dev/' },
  { n: 'contract-line-oa',    u: 'https://contract-line-oa.milk790.workers.dev/health' },
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
];

async function probe(t) {
  const started = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(t.u, { signal: ctrl.signal, headers: { 'user-agent': 'fleet-sentinel/1.0' } });
    clearTimeout(timer);
    const ms = Date.now() - started;
    // 連得到就算活(含 401/404 密碼保護)；只有 5xx 或連不到才算掛
    const down = r.status >= 500;
    return { name: t.n, status: r.status, ms, down };
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

async function pushLine(env, text) {
  if (!env.LINE_TOKEN || !env.OWNER_USER_ID) return false;
  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.LINE_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: env.OWNER_USER_ID, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
  }).catch(() => null);
  return !!(r && r.ok);
}

async function sweep(env) {
  const results = await Promise.all(TARGETS.map(probe));
  const down = results.filter(x => x.down);
  const cost = await anthropicCost(env);
  return { checked: results.length, down, cost, ts: new Date().toISOString() };
}

function report(rep) {
  const tw = new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16);
  if (!rep.down.length) {
    let m = `✅ 艦隊巡檢 ${tw}\n${rep.checked} 支 Worker 全部正常。`;
    if (rep.cost?.yesterday_usd != null) m += `\n昨日 Anthropic 花費約 US$${rep.cost.yesterday_usd}`;
    return m;
  }
  let m = `⚠️ 艦隊巡檢 ${tw}\n${rep.down.length}/${rep.checked} 支異常:\n`;
  m += rep.down.map(x => `• ${x.name} (${x.err ? '連不到' : 'HTTP ' + x.status})`).join('\n');
  if (rep.cost?.yesterday_usd != null) m += `\n\n昨日 Anthropic 花費約 US$${rep.cost.yesterday_usd}`;
  return m;
}

export default {
  async scheduled(event, env, ctx) {
    const rep = await sweep(env);
    // 只在有異常時推播，正常日不吵你(想每天都收就把下面 if 拿掉)
    if (rep.down.length) await pushLine(env, report(rep));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, worker: 'fleet-sentinel', targets: TARGETS.length }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/run') {
      if (!env.RUN_KEY || url.searchParams.get('key') !== env.RUN_KEY) return new Response('forbidden', { status: 403 });
      const rep = await sweep(env);
      if (rep.down.length) await pushLine(env, report(rep));
      return new Response(JSON.stringify(rep, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    return new Response('fleet-sentinel v1.0', { status: 200 });
  },
};
