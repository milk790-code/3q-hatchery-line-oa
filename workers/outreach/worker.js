// 3q-outreach — 陌開獲客引擎 v1(實戰包 v3 自部署)
// 職責:① 名單情報化(規則式補助比對,數字可稽核)② 每日卡片(15家/天推老闆 LINE,含個人化開場+明日預熱清單)
//      ③ 無回覆序列(D+3 價值投放/D+7 社證收尾/D+10 自動歸檔)④ 回覆 SLA(黃金一小時催辦)
//      ⑤ 成交追蹤表(/admin/board 手機板,發送→回覆→健檢→報價→成交)⑥ 週報(該砍該放大)
// 健檢四題流在正式 3Q bot(webhook/worker.js,觸發詞「補助健檢 #編號」),本 worker 不接 LINE webhook。
// 補助目錄正本:data/subsidies.json(改正本→同步本檔 CATALOG 與 webhook 內嵌版)
// 名單正本:PROSPECTS.md(A池汽美/B池新開店/C池市集攤主)→ scripts/prospects-to-outreach.mjs 轉格式匯入(src=池#編號,可重跑 upsert)
// 綁定:SESSION(KV)、CRM(D1);Secrets:LINE_CHANNEL_ACCESS_TOKEN、OWNER_USER_ID(3Q OA 同一組)
// 部署:.github/workflows/deploy-outreach.yml(API PUT + cron schedules)

const VER = 'v1.1';
const getAdminKey = (env) => (env && env.ADMIN_KEY) || 'outr-9k3v7p-2026';
const LINE_ADD_URL = 'https://lin.ee/UKKodJj';   // 3Q OA 加好友
const DAILY_QUOTA = 15;

// ═══ 補助目錄(同步自 data/subsidies.json,store_cap_wan=小型店常見可達上限)═══
const CATALOG = [
  { id: 'digital10', name: '30 人以下數位轉型培力補助', type: '補助', max_wan: 10, store_cap_wan: 10, ease: 1, hook: '最高 10 萬直接補、不用還,最快核准', deadline_note: '2026-06-30 本期收件', elig: { stages: ['new', 'mid'], biz: 'any', employees_max: 30 } },
  { id: 'cloudmkt', name: '雲市集數位點數', type: '補助', max_wan: 3, store_cap_wan: 3, ease: 1, hook: '每年 3 萬點數,直接折抵 AI 軟體與系統費', elig: { stages: ['new', 'mid'], biz: 'any' } },
  { id: 'siir', name: 'SIIR 服務業創新研發計畫', type: '補助', max_wan: 150, store_cap_wan: 70, ease: 2, hook: '服務業門市適用,服務創新與系統導入都能報', elig: { stages: ['new', 'mid'], biz: ['food', 'retail', 'car'] } },
  { id: 'local_sbir', name: '台中地方型 SBIR', type: '補助', max_wan: 100, store_cap_wan: 100, ease: 2, hook: '台中企業限定加碼', elig: { stages: ['new', 'mid'], biz: 'any', area: '台中' } },
  { id: 'sbir', name: 'SBIR 小型企業創新研發計畫', type: '補助', max_wan: 1200, store_cap_wan: 100, ease: 3, hook: '研發型補助,隨到隨審', elig: { stages: ['new', 'mid'], biz: ['tech', 'car', 'other'] } },
  { id: 'youth', name: '青年創業及啟動金貸款', type: '貸款', max_wan: 1200, store_cap_wan: 1200, ease: 2, hook: '18-45 歲、設立未滿 5 年,前幾年利息幾乎政府付', elig: { stages: ['pre', 'new', 'mid'], biz: 'any', within_years: 5 } },
  { id: 'phoenix', name: '微型創業鳳凰貸款', type: '貸款', max_wan: 200, store_cap_wan: 200, ease: 2, hook: '前 2 年免息(限女性或 45 歲以上)', elig: { stages: ['pre', 'new', 'mid'], biz: 'any' } },
  { id: 'gpu', name: '政府免費 GPU 算力', type: '資源', max_wan: 65, store_cap_wan: 65, ease: 2, hook: '等值 65 萬算力,AI 開發完全免費', elig: { stages: ['idea', 'pre', 'new', 'mid'], biz: ['tech'] } },
];

// ═══ 比對引擎(純規則,無 AI:每個數字都能回溯到目錄)═══
// lead: { stage: idea|pre|new|mid, biz: food|retail|car|tech|other, area, founded_year }
function eligible(s, lead) {
  const e = s.elig;
  if (!e.stages.includes(lead.stage)) return false;
  if (e.biz !== 'any' && !e.biz.includes(lead.biz)) return false;
  if (e.area && (lead.area || '').indexOf(e.area) === -1) return false;
  if (e.within_years && lead.founded_year && (new Date().getFullYear() - lead.founded_year) >= e.within_years) return false;
  return true;
}
function matchSubsidies(lead) {
  const ok = CATALOG.filter((s) => eligible(s, lead));
  const grants = ok.filter((s) => s.type === '補助').sort((a, b) => a.ease - b.ease || b.store_cap_wan - a.store_cap_wan);
  const top3 = grants.slice(0, 3);
  return {
    top3: top3.map((s) => ({ id: s.id, name: s.name, cap: s.store_cap_wan, hook: s.hook })),
    total: top3.reduce((n, s) => n + s.store_cap_wan, 0),
    loans: ok.filter((s) => s.type === '貸款').map((s) => ({ id: s.id, name: s.name, cap: s.store_cap_wan, hook: s.hook })),
    resources: ok.filter((s) => s.type === '資源').map((s) => ({ id: s.id, name: s.name, cap: s.store_cap_wan, hook: s.hook })),
  };
}

// ═══ 話術模板(實戰包 v3 第二/三段;個人化=店家自己的可稽核數字,不編故事)═══
function buildOpener(lead, m) {
  const totalLine = m.total > 0 ? `你們這種店全部加起來最高可達 ${m.total} 萬\n` : '';
  if (lead.pool === 'A') {
    return '老闆你好,我自己做汽美耗材的(米速)\n最近我們合作的店家在申請一個補助\n30 人以下的店最高 10 萬,直接補不用還\n我幫汽美店整理了一份能用的清單\n' + totalLine + '要的話傳給你';
  }
  if (lead.pool === 'C') {
    // 市集攤主/微型品牌:商業登記狀態未知 → 開場不得引用補助金額,切角=免費官網/接單頁
    const seen = lead.ig ? '從 IG 看到你們的品牌' : '看到你們在市集出攤的介紹';
    return seen + '\n我們在幫台中的市集品牌/小工作室做免費官網+線上接單頁(3Q 孵化場)\nIG 私訊接單容易漏單,這個能接住\n要的話我傳一個範例給你看?';
  }
  return '恭喜開店\n跟你說一個多數新店不知道的事:\n公司設立前兩年有幾個專屬補助,過期就不能申請\n像青創貸款,前幾年的利息幾乎政府付\n' + (m.total > 0 ? `初步看你們條件,補助加起來最高可達 ${m.total} 萬\n` : '') + '我做這塊的,免費幫你看符合哪些?';
}
function d3Copy(lead) {
  if (lead.pool === 'C') {
    // C 池不確定有無商業登記 → 補助只能講「條件式」,且金額只引目錄單筆 hook,不引加總
    return '補個資訊給你\n如果你們有做商業登記,其實有政府補助能用(30 人以下數位轉型最高 10 萬,直接補不用還)\n免費官網的範例我也可以直接傳給你\n不用回沒關係,純粹資訊';
  }
  const top3 = JSON.parse(lead.top3 || '[]');
  const top1 = top3[0];
  const cat = top1 ? CATALOG.find((s) => s.id === top1.id) : null;
  const dl = cat && cat.deadline_note ? `這期 ${cat.deadline_note}` : '這期收件窗口有限';
  return `補個資訊給你\n${top1 ? '「' + top1.name + '」' : '你們符合的計畫'}${dl}\n你們的條件應該符合,錯過等明年\n不用回沒關係,純粹資訊`;
}
function d7Copy(lead) {
  if (lead.pool === 'C') {
    return '這是最後一則,不再打擾\n免費官網+接單頁的事,之後想弄再找我就好\n祝出攤順利';
  }
  const n = lead.total_wan || 0;
  return '幫你們這型的店算過\n' + (n > 0 ? `符合的補助加起來最高可達 ${n} 萬\n` : '') + '這是最後一則,不再打擾\n之後想弄再找我';
}
function referralCopy(lead) {
  return `細節用 LINE 講比較完整\n加這個,我把你符合的清單直接傳給你\n${LINE_ADD_URL}\n(加好友後傳:補助健檢 #${lead.id})`;
}

// ═══ 每日卡片組裝 ═══
function leadCardBlock(l) {
  const t3 = JSON.parse(l.top3 || '[]').map((s) => `${s.name} ${s.cap}萬`).join(' / ') || '(無符合補助,只談貸款)';
  return `#${l.id}|${l.name}${l.ig ? '|IG @' + l.ig.replace(/^@/, '') : ''}\n[${t3}]→ 加總 ${l.total_wan} 萬\n──開場(複製即發)──\n${l.opener}`;
}
function composeDailyCard(todays, warmups, boardUrl) {
  const msgs = [];
  msgs.push(`📇 今日陌開 ${todays.length} 家(${new Date(Date.now() + 8 * 3600e3).toISOString().slice(5, 10)})\n發完照常過日子,回覆會催你。\n追蹤表:${boardUrl}`);
  for (let i = 0; i < todays.length; i += 5) {
    msgs.push(todays.slice(i, i + 5).map(leadCardBlock).join('\n\n════════\n\n'));
  }
  if (warmups.length) {
    msgs.push('🔥 明日 ' + warmups.length + ' 家預熱清單(今天花 2 分鐘:追蹤+按讚最近 1-2 篇)\n' + warmups.map((l) => `#${l.id} ${l.name}${l.ig ? ' IG @' + l.ig.replace(/^@/, '') : ''}`).join('\n'));
  }
  return msgs;
}

// ═══ D1 ═══
async function ensureTables(env) {
  if (!env.CRM) return;
  await env.CRM.prepare(`CREATE TABLE IF NOT EXISTS outreach_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, pool TEXT NOT NULL DEFAULT 'A', batch INTEGER DEFAULT 1,
    ig TEXT, store_type TEXT, founded_year INTEGER, area TEXT, note TEXT,
    stage TEXT, biz TEXT, top3 TEXT, total_wan INTEGER DEFAULT 0, opener TEXT,
    status TEXT NOT NULL DEFAULT 'new', variant TEXT, src TEXT,
    sent_at TEXT, replied_at TEXT, f3 INTEGER DEFAULT 0, f7 INTEGER DEFAULT 0, nudged INTEGER DEFAULT 0,
    partner_score INTEGER DEFAULT 0, line_uid TEXT,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  )`).run().catch(() => {});
  // 既部署的表補 src 欄(PROSPECTS.md 來源編號,如 A#27):重匯 upsert 鍵,失敗=已存在
  await env.CRM.prepare('ALTER TABLE outreach_leads ADD COLUMN src TEXT').run().catch(() => {});
  await env.CRM.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_src ON outreach_leads(src)').run().catch(() => {});
  await env.CRM.prepare(`CREATE TABLE IF NOT EXISTS outreach_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER, type TEXT, detail TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`).run().catch(() => {});
}
async function logEvent(env, leadId, type, detail) {
  if (!env.CRM) return;
  await env.CRM.prepare('INSERT INTO outreach_events (lead_id, type, detail) VALUES (?,?,?)')
    .bind(leadId, type, (detail || '').slice(0, 300)).run().catch(() => {});
}

// ═══ LINE 推播(推老闆;失敗記 KV 診斷,絕不丟例外)═══
async function pushOwner(env, texts) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN || !env.OWNER_USER_ID) return false;
  const arr = Array.isArray(texts) ? texts : [texts];
  let ok = true;
  for (let i = 0; i < arr.length; i += 5) {   // LINE push 一次最多 5 則
    try {
      const r = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.LINE_CHANNEL_ACCESS_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: env.OWNER_USER_ID, messages: arr.slice(i, i + 5).map((t) => ({ type: 'text', text: t.slice(0, 4900) })) }),
      });
      if (!r.ok) { ok = false; await env.SESSION?.put('diag:outreach_push', r.status + ' ' + (await r.text()).slice(0, 150) + ' @' + new Date().toISOString(), { expirationTtl: 86400 }).catch(() => {}); }
    } catch (e) { ok = false; await env.SESSION?.put('diag:outreach_push', 'EX ' + e.message, { expirationTtl: 86400 }).catch(() => {}); }
  }
  return ok;
}

// ═══ 名單情報化(import 時就算好,卡片直接用)═══
function enrichLead(l) {
  const p = String(l.pool || 'A').toUpperCase();
  const pool = p === 'B' ? 'B' : p === 'C' ? 'C' : 'A';
  const biz = l.biz || (pool === 'A' ? 'car' : 'other');
  const yr = parseInt(l.founded_year, 10) || null;
  const stage = l.stage || (yr ? ((new Date().getFullYear() - yr) < 2 ? 'new' : 'mid') : (pool === 'A' ? 'mid' : 'new'));
  const lead = { ...l, pool, biz, stage, founded_year: yr };
  const m = matchSubsidies(lead);
  return { ...lead, top3: JSON.stringify(m.top3), total_wan: m.total, opener: buildOpener(lead, m), variant: pool + '1' };
}

// ═══ 排程任務 ═══
async function runDaily(env, dryRun) {
  await ensureTables(env);
  const out = { picked: 0, d3: 0, d7: 0, autoDead: 0, remaining: 0 };
  const msgs = [];
  const boardUrl = (env.SELF_URL || 'https://3q-outreach.milk790.workers.dev') + '/admin/board?key=' + getAdminKey(env);

  const pick = await env.CRM.prepare("SELECT * FROM outreach_leads WHERE status='new' ORDER BY batch, id LIMIT ?").bind(DAILY_QUOTA).all();
  const todays = pick.results || [];
  out.picked = todays.length;
  if (todays.length && !dryRun) {
    for (const l of todays) {
      await env.CRM.prepare("UPDATE outreach_leads SET status='sent', sent_at=datetime('now'), updated_at=datetime('now') WHERE id=?").bind(l.id).run().catch(() => {});
      await logEvent(env, l.id, 'send', l.variant);
    }
  }
  const warm = await env.CRM.prepare("SELECT id, name, ig FROM outreach_leads WHERE status='new' ORDER BY batch, id LIMIT ?").bind(DAILY_QUOTA).all();
  const warmups = (warm.results || []).filter((w) => !todays.some((t) => t.id === w.id));
  out.remaining = warmups.length;
  if (todays.length) msgs.push(...composeDailyCard(todays, warmups, boardUrl));
  else msgs.push('📇 今日陌開:名單池已空(status=new 為 0)。丟批次 3 名單進 /admin/import,母數才會破百。');

  // D+3 價值投放
  const d3 = await env.CRM.prepare("SELECT * FROM outreach_leads WHERE status='sent' AND f3=0 AND replied_at IS NULL AND sent_at <= datetime('now','-3 days')").all();
  for (const l of (d3.results || [])) {
    out.d3++;
    if (!dryRun) { await env.CRM.prepare("UPDATE outreach_leads SET f3=1, updated_at=datetime('now') WHERE id=?").bind(l.id).run().catch(() => {}); await logEvent(env, l.id, 'followup3', ''); }
  }
  if (out.d3) msgs.push('⏳ D+3 價值投放 ' + out.d3 + ' 家(複製即發):\n\n' + (d3.results || []).map((l) => `#${l.id} ${l.name}\n${d3Copy(l)}`).join('\n\n────\n\n'));

  // D+7 社證收尾
  const d7 = await env.CRM.prepare("SELECT * FROM outreach_leads WHERE status='sent' AND f7=0 AND replied_at IS NULL AND sent_at <= datetime('now','-7 days')").all();
  for (const l of (d7.results || [])) {
    out.d7++;
    if (!dryRun) { await env.CRM.prepare("UPDATE outreach_leads SET f7=1, updated_at=datetime('now') WHERE id=?").bind(l.id).run().catch(() => {}); await logEvent(env, l.id, 'followup7', ''); }
  }
  if (out.d7) msgs.push('🚪 D+7 走人式收尾 ' + out.d7 + ' 家(發完就放生):\n\n' + (d7.results || []).map((l) => `#${l.id} ${l.name}\n${d7Copy(l)}`).join('\n\n────\n\n'));

  // D+10 自動歸檔
  if (!dryRun) {
    const dead = await env.CRM.prepare("UPDATE outreach_leads SET status='dead', updated_at=datetime('now') WHERE status='sent' AND f7=1 AND replied_at IS NULL AND sent_at <= datetime('now','-10 days')").run().catch(() => null);
    out.autoDead = dead?.meta?.changes || 0;
    if (out.autoDead) msgs.push('🗂 ' + out.autoDead + ' 家 D+10 無回覆,自動歸檔(板上 requeue 可撈回)。');
  }

  if (!dryRun) await pushOwner(env, msgs);
  return { ...out, messages: msgs };
}

async function runNudge(env) {
  await ensureTables(env);
  const due = await env.CRM.prepare("SELECT * FROM outreach_leads WHERE status='replied' AND nudged=0 AND replied_at <= datetime('now','-1 hours')").all();
  const rows = due.results || [];
  for (const l of rows) {
    await env.CRM.prepare("UPDATE outreach_leads SET nudged=1, updated_at=datetime('now') WHERE id=?").bind(l.id).run().catch(() => {});
    await logEvent(env, l.id, 'sla_nudge', '');
    await pushOwner(env, `⏰ 黃金一小時已過:#${l.id} ${l.name} 回了還沒轉介。\n現在發這個:\n\n${referralCopy(l)}`);
  }
  return rows.length;
}

async function runWeekly(env) {
  await ensureTables(env);
  const agg = await env.CRM.prepare(`SELECT pool, variant,
      COUNT(*) n,
      SUM(CASE WHEN replied_at IS NOT NULL THEN 1 ELSE 0 END) replied,
      SUM(CASE WHEN status IN ('checkup','quoted','won') THEN 1 ELSE 0 END) checkup,
      SUM(CASE WHEN status='won' THEN 1 ELSE 0 END) won
    FROM outreach_leads WHERE status!='new' GROUP BY pool, variant`).all();
  const rows = agg.results || [];
  if (!rows.length) { await pushOwner(env, '📊 陌開週報:還沒有已發送的名單,本週無數據。'); return 'empty'; }
  const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '-';
  let lines = rows.map((r) => `${r.pool}池/${r.variant || '-'}:發 ${r.n}|回 ${r.replied}(${pct(r.replied, r.n)})|健檢 ${r.checkup}|成交 ${r.won}`);
  const judged = rows.filter((r) => r.n >= 5);
  if (judged.length >= 2) {
    const byRate = [...judged].sort((a, b) => (b.replied / b.n) - (a.replied / a.n));
    lines.push('▲ 放大:' + byRate[0].pool + '池/' + (byRate[0].variant || '-') + '(回覆率最高)');
    lines.push('▼ 該砍:' + byRate[byRate.length - 1].pool + '池/' + (byRate[byRate.length - 1].variant || '-') + '(樣本≥5 中最低)');
  } else {
    lines.push('(樣本未達 5/組,先不判生死)');
  }
  const partners = await env.CRM.prepare("SELECT id, name, partner_score FROM outreach_leads WHERE partner_score>0 ORDER BY partner_score DESC LIMIT 3").all();
  if ((partners.results || []).length) lines.push('🤝 夥伴潛力:' + partners.results.map((p) => `#${p.id} ${p.name}(${p.partner_score}分)`).join('、'));
  const report = '📊 陌開週報\n' + lines.join('\n');
  await logEvent(env, null, 'report', report.slice(0, 280));
  await pushOwner(env, report);
  return report;
}

// ═══ 追蹤表(手機板)═══
const STATUS_FLOW = { sent: ['replied', 'dead'], replied: ['checkup', 'dead'], checkup: ['quoted', 'dead'], quoted: ['won', 'dead'], dead: ['requeue'], new: ['dead'] };
const STATUS_LABEL = { new: '待發', sent: '已發送', replied: '🔥 回了(黃金一小時)', checkup: '約到健檢', quoted: '已報價', won: '✅ 成交', dead: '歸檔' };
const ACTION_LABEL = { replied: '回了', checkup: '約到健檢', quoted: '報過價', won: '成交', dead: '死線', requeue: '撈回重發' };

function boardHTML(groups, key) {
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const row = (l) => {
    const btns = (STATUS_FLOW[l.status] || []).map((to) => `<button onclick="mark(${l.id},'${to}')">${ACTION_LABEL[to]}</button>`).join('');
    const copyBlock = l.status === 'replied' ? `<textarea readonly onclick="this.select()">${esc(referralCopy(l))}</textarea>`
      : (l.status === 'sent' || l.status === 'new') ? `<textarea readonly onclick="this.select()">${esc(l.opener)}</textarea>` : '';
    return `<div class="lead"><b>#${l.id} ${esc(l.name)}</b> <span>${esc(l.pool)}池|${esc(l.store_type || '')}${l.ig ? '|IG @' + esc(l.ig.replace(/^@/, '')) : ''}|加總 ${l.total_wan} 萬${l.partner_score ? '|夥伴 ' + l.partner_score + '分' : ''}</span>${copyBlock}<div class="btns">${btns}</div></div>`;
  };
  const sec = (st) => (groups[st] || []).length ? `<h2>${STATUS_LABEL[st]}(${groups[st].length})</h2>` + groups[st].map(row).join('') : '';
  return `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>陌開追蹤表</title>
<style>body{background:#0c0f14;color:#e8edf5;font-family:"Noto Sans TC",system-ui;max-width:560px;margin:0 auto;padding:16px;line-height:1.6}
h1{font-size:18px;color:#d9a441}h2{font-size:14px;color:#d9a441;margin:18px 0 8px;border-bottom:1px solid #2a3242;padding-bottom:4px}
.lead{background:#11151c;border:1px solid #2a3242;border-radius:10px;padding:10px 12px;margin-bottom:8px;font-size:13px}
.lead b{font-size:14px}.lead span{color:#9aa7ba;font-size:12px;display:block}
textarea{width:100%;height:88px;background:#0c0f14;color:#e8edf5;border:1px dashed #2a3242;border-radius:8px;margin-top:6px;font-size:12px;padding:8px}
.btns{margin-top:6px;display:flex;gap:6px;flex-wrap:wrap}
button{background:#d9a441;color:#14110a;border:0;border-radius:8px;padding:7px 14px;font-weight:700;font-size:13px}
button.done{background:#06c755;color:#fff}</style>
<h1>陌開追蹤表 <small style="color:#67748a">點文字框=全選複製</small></h1>
${['replied', 'sent', 'checkup', 'quoted', 'new', 'won', 'dead'].map(sec).join('')}
<script>async function mark(id,to){const r=await fetch('/admin/mark?key=${key}&id='+id+'&to='+to,{method:'POST'});if(r.ok)location.reload();else alert('失敗 '+r.status);}</script>`;
}

async function handleMark(env, url) {
  const id = parseInt(url.searchParams.get('id'), 10);
  const to = url.searchParams.get('to') || '';
  if (!id || !['replied', 'checkup', 'quoted', 'won', 'dead', 'requeue'].includes(to)) return json({ ok: false, err: 'bad params' }, 400);
  await ensureTables(env);
  const lead = await env.CRM.prepare('SELECT * FROM outreach_leads WHERE id=?').bind(id).first();
  if (!lead) return json({ ok: false, err: 'not found' }, 404);
  if (to === 'requeue') {
    await env.CRM.prepare("UPDATE outreach_leads SET status='new', sent_at=NULL, replied_at=NULL, f3=0, f7=0, nudged=0, updated_at=datetime('now') WHERE id=?").bind(id).run();
  } else if (to === 'replied') {
    await env.CRM.prepare("UPDATE outreach_leads SET status='replied', replied_at=datetime('now'), updated_at=datetime('now') WHERE id=?").bind(id).run();
    await pushOwner(env, `🔥 #${id} ${lead.name} 回了——黃金一小時,現在發轉介:\n\n${referralCopy(lead)}`);
  } else {
    await env.CRM.prepare("UPDATE outreach_leads SET status=?, updated_at=datetime('now') WHERE id=?").bind(to, id).run();
  }
  await logEvent(env, id, 'mark_' + to, '');
  return json({ ok: true, id, to, referral: to === 'replied' ? referralCopy(lead) : undefined });
}

const json = (d, s = 200) => new Response(JSON.stringify(d, null, 2), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export default {
  async scheduled(controller, env, ctx) {
    const cron = controller.cron || '';
    if (cron === '30 0 * * *') { ctx.waitUntil(runDaily(env, false)); return; }
    if (cron === '0 1 * * MON') { ctx.waitUntil(runWeekly(env)); return; }
    ctx.waitUntil(runNudge(env));   // */30 SLA 巡檢
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      let n = -1, byStatus = {};
      if (env.CRM) {
        try {
          await ensureTables(env);
          const r = await env.CRM.prepare('SELECT status, COUNT(*) n FROM outreach_leads GROUP BY status').all();
          (r.results || []).forEach((x) => { byStatus[x.status] = x.n; });
          n = Object.values(byStatus).reduce((a, b) => a + b, 0);
        } catch (_) {}
      }
      return json({ ok: true, worker: '3q-outreach', ver: VER, crm: !!env.CRM, push_ready: !!(env.LINE_CHANNEL_ACCESS_TOKEN && env.OWNER_USER_ID), leads: n, by_status: byStatus });
    }

    if (!url.pathname.startsWith('/admin/')) return new Response('3q-outreach ' + VER, { status: 200 });
    const __ak = getAdminKey(env);
    if (!__ak || url.searchParams.get('key') !== __ak) return new Response('forbidden', { status: 403 });
    if (!env.CRM) return json({ ok: false, err: 'no CRM binding' }, 503);

    // 名單匯入:POST JSON {leads:[{name,pool,batch,ig,store_type,founded_year,area,biz,stage,note}]} 或直接陣列
    if (url.pathname === '/admin/import' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      const list = Array.isArray(body) ? body : (body?.leads || []);
      if (!list.length) return json({ ok: false, err: 'no leads. POST {"leads":[{"name":"XX汽車美容","pool":"A","ig":"xxx","store_type":"汽車美容","area":"台中","founded_year":2021}]}' }, 400);
      await ensureTables(env);
      let imported = 0;
      const preview = [];
      for (const raw of list.slice(0, 300)) {
        if (!raw.name) continue;
        const l = enrichLead(raw);
        const vals = [l.name.slice(0, 80), l.pool, parseInt(l.batch, 10) || 1, l.ig || null, l.store_type || null, l.founded_year, l.area || null, (l.note || '').slice(0, 200), l.stage, l.biz, l.top3, l.total_wan, l.opener, l.variant];
        if (raw.src) {
          // 帶 src(如 PROSPECTS.md 的 A#27)= upsert:重匯只更新名單欄位,不動 status/sent_at/replied_at(對齊 prospects 表哲學)
          await env.CRM.prepare(`INSERT INTO outreach_leads (src,name,pool,batch,ig,store_type,founded_year,area,note,stage,biz,top3,total_wan,opener,variant)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(src) DO UPDATE SET name=excluded.name, pool=excluded.pool, batch=excluded.batch, ig=excluded.ig,
              store_type=excluded.store_type, founded_year=excluded.founded_year, area=excluded.area, note=excluded.note,
              stage=excluded.stage, biz=excluded.biz, top3=excluded.top3, total_wan=excluded.total_wan, opener=excluded.opener,
              variant=excluded.variant, updated_at=datetime('now')`)
            .bind(String(raw.src).slice(0, 20), ...vals).run();
        } else {
          await env.CRM.prepare(`INSERT INTO outreach_leads (name,pool,batch,ig,store_type,founded_year,area,note,stage,biz,top3,total_wan,opener,variant)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .bind(...vals).run();
        }
        imported++;
        if (preview.length < 3) preview.push({ name: l.name, total_wan: l.total_wan, top3: JSON.parse(l.top3).map((s) => s.name) });
      }
      return json({ ok: true, imported, preview });
    }

    if (url.pathname === '/admin/board') {
      await ensureTables(env);
      const r = await env.CRM.prepare("SELECT * FROM outreach_leads ORDER BY updated_at DESC LIMIT 400").all();
      const groups = {};
      (r.results || []).forEach((l) => { (groups[l.status] = groups[l.status] || []).push(l); });
      if (groups.dead) groups.dead = groups.dead.slice(0, 10);
      return new Response(boardHTML(groups, __ak), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (url.pathname === '/admin/mark' && request.method === 'POST') return handleMark(env, url);

    // 手動跑/預覽當日卡片:&run=1 真跑(寫狀態+推播);預設 dry-run 只回 JSON
    if (url.pathname === '/admin/today') {
      const out = await runDaily(env, url.searchParams.get('run') !== '1');
      return json({ ok: true, dry_run: url.searchParams.get('run') !== '1', ...out });
    }
    if (url.pathname === '/admin/weekly') return json({ ok: true, report: await runWeekly(env) });
    if (url.pathname === '/admin/nudge') return json({ ok: true, nudged: await runNudge(env) });

    return json({ ok: false, err: 'unknown admin route' }, 404);
  },
};

export { CATALOG, matchSubsidies, buildOpener, composeDailyCard, enrichLead, d3Copy, d7Copy, referralCopy };
