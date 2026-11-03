#!/usr/bin/env node
// pop-line-note-sync:把 worker 生的客戶筆記寫進 LINE 官方帳號後台聊天室的「備註」(chat.line.biz 內部 API,LINE 沒開公開 API)
// 流程:D1 pop_line_notes 撈待同步 → (可選 --backfill:沒列的客人用 D1 對話＋筆記現場生一份) → ego 瀏覽器(他登入的 LINE 商用 ID)
//      依顯示名稱對到聊天室 chatId → 有舊筆記就改寫、沒有就新增 → 回填 synced_at/chat_id/note_id。
// 用法:node scripts/pop-line-note-sync.mjs [--backfill] [--dry]   (launchd 每 30 分鐘跑一次,見 ~/Library/LaunchAgents/com.popmonster.line-note-sync.plist)
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const LEADS = join(REPO, 'workers/leads-board');
const CHAT_BOT = 'U09946b50120a3f9617ff6253af4b7c8b';   // 泡泡怪獸在 chat.line.biz 的帳號 ID(跟 Messaging API 的 bot userId 不同)
const NOTE_HEAD = '【泡泡怪獸 AI 筆記】';
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry'), BACKFILL = args.has('--backfill');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function d1(sql) {
  const NPX = join(dirname(process.execPath), 'npx');
  const out = execFileSync(NPX, ['wrangler', 'd1', 'execute', 'pop-line-crm', '--remote', '--json', '--command', sql], { cwd: LEADS, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 50e6 });
  const j = JSON.parse(out.slice(out.indexOf('[')));
  return j;
}
const q = (s) => "'" + String(s ?? '').replace(/'/g, "''") + "'";
function lineToken() {
  const env = readFileSync(join(homedir(), '.config/line-oa/.env'), 'utf-8');
  return (env.match(/^CHANNEL_ACCESS_TOKEN=\s*"?([^"\n]+)"?/m) || [])[1] || '';
}
async function displayName(uid, tok) {
  try { const r = await fetch('https://api.line.me/v2/bot/profile/' + uid, { headers: { Authorization: 'Bearer ' + tok } }); if (!r.ok) return ''; return (await r.json()).displayName || ''; } catch (_) { return ''; }
}

// ① 待同步
let rows = d1("SELECT user_id, note, chat_id, note_id FROM pop_line_notes WHERE synced_note IS NULL OR synced_note != note")[0]?.results || [];
log('待同步', rows.length);

// ② backfill:近 14 天聊過但沒筆記列的客人,用 worker 同一支 buildCustomerNote 現場生
if (BACKFILL) {
  const { buildCustomerNote } = await import(join(REPO, 'workers/pop-line-oa/worker.js'));
  const miss = d1("SELECT c.user_id, c.last_seen FROM pop_line_customers c LEFT JOIN pop_line_notes n ON n.user_id=c.user_id WHERE n.user_id IS NULL AND c.last_seen >= datetime('now','-14 days') AND c.msg_count >= 2")[0]?.results || [];
  log('backfill 候選', miss.length);
  for (const m of miss) {
    const conv = d1("SELECT role, text FROM pop_line_convos WHERE user_id=" + q(m.user_id) + " ORDER BY id DESC LIMIT 20")[0]?.results || [];
    const prof = d1("SELECT city, vehicle, industry, budget, grade, pain FROM customer_profiles WHERE brand='popmonster' AND sid=" + q(m.user_id))[0]?.results?.[0] || null;
    const hist = conv.reverse().map((r) => ({ role: r.role === 'user' ? 'user' : 'assistant', content: r.text }));
    if (!hist.some((h) => h.role === 'user' && String(h.content).length >= 2)) continue;
    const note = buildCustomerNote(m.user_id, { hist, last_seen: Date.parse(m.last_seen) || Date.now() }, prof, null);
    if (!DRY) d1("INSERT INTO pop_line_notes (user_id, note, updated_at) VALUES (" + q(m.user_id) + "," + q(note) + ",datetime('now')) ON CONFLICT(user_id) DO UPDATE SET note=excluded.note, updated_at=excluded.updated_at");
    rows.push({ user_id: m.user_id, note, chat_id: null, note_id: null });
  }
}
if (!rows.length) { log('沒有要寫的,結束'); process.exit(0); }

// ③ 顯示名稱(對聊天室用)＋最近兩句原話(同名時用訊息比對)
const tok = lineToken();
for (const r of rows) {
  r.name = await displayName(r.user_id, tok);
  r.samples = (d1("SELECT text FROM pop_line_convos WHERE user_id=" + q(r.user_id) + " AND role='user' ORDER BY id DESC LIMIT 3")[0]?.results || []).map((x) => x.text).filter((t) => t && t.length >= 4 && !/^【/.test(t));
}
log('名稱對照', rows.map((r) => r.user_id.slice(0, 8) + '=' + (r.name || '?')).join(' '));
if (DRY) { for (const r of rows) console.log('----', r.user_id, r.name, '\n' + r.note); process.exit(0); }

// ④ ego 瀏覽器寫備註
const payload = JSON.stringify(rows.map((r) => ({ user_id: r.user_id, name: r.name, note: r.note, chat_id: r.chat_id, note_id: r.note_id, samples: r.samples })));
const script = `
const task = await taskSpace("line-note-sync");
const BOT = ${JSON.stringify(CHAT_BOT)}, HEAD = ${JSON.stringify(NOTE_HEAD)};
const rows = ${payload};
const page = await task.newPage();
await page.goto("https://chat.line.biz/" + BOT).catch(() => {});
await page.waitForTimeout(5000);
let url = await page.url();
if (/account\\.line\\.biz\\/login/.test(url)) {   // 商用 ID 登入頁:用上次的 LINE 帳號(已登入的 LINE 身分,不輸入密碼)
  await page.click("text=LINE帳號").catch(() => {});
  await page.waitForTimeout(5000);
  if (/access\\.line\\.me/.test(await page.url())) { await page.click("loc=role:button[name='登入']").catch(() => {}); await page.waitForTimeout(7000); }
  await page.goto("https://chat.line.biz/" + BOT).catch(() => {});
  await page.waitForTimeout(5000);
  url = await page.url();
}
if (!url.includes(BOT)) { console.log("NEEDLOGIN " + url); await task.finish({ keep: [] }); }
else {
  const res = await page.evaluate(async ({ BOT, HEAD, rows }) => {
    const out = [];
    const cs = await (await fetch("/api/v1/csrfToken", { credentials: "include" })).json();
    const H = { "Content-Type": "application/json", [cs.headerName]: cs.token };
    const chats = []; let next = "";
    for (let i = 0; i < 10; i++) {
      const r = await fetch("/api/v2/bots/" + BOT + "/chats?folderType=ALL&limit=25" + (next ? "&next=" + encodeURIComponent(next) : ""), { credentials: "include" });
      const j = await r.json(); chats.push(...(j.list || [])); next = j.next || ""; if (!next) break;
    }
    const byName = new Map();
    for (const c of chats) { const n = c.profile && c.profile.name; if (!n) continue; if (!byName.has(n)) byName.set(n, []); byName.get(n).push(c.chatId); }
    const hasText = async (chatId, samples) => {
      try { const j = await (await fetch("/api/v3/bots/" + BOT + "/chats/" + chatId + "/messages", { credentials: "include" })).json();
        const texts = JSON.stringify(j); return samples.some((s) => texts.includes(s.slice(0, 30))); } catch (_) { return false; }
    };
    for (const row of rows) {
      const a = { user_id: row.user_id, ok: false };
      try {
        let chatId = row.chat_id || "";
        if (!chatId) {
          const cands = byName.get(row.name) || [];
          if (cands.length === 1) chatId = cands[0];
          else if (cands.length > 1 && row.samples.length) { for (const c of cands) if (await hasText(c, row.samples)) { chatId = c; break; } }
          else if (!cands.length && row.samples.length) { for (const c of chats.slice(0, 40)) if (await hasText(c.chatId, row.samples)) { chatId = c.chatId; break; } }
        }
        if (!chatId) { a.reason = "找不到聊天室(" + (row.name || "無名") + ")"; out.push(a); continue; }
        const base = "/api/v1/bots/" + BOT + "/chats/" + chatId + "/notes";
        const list = (await (await fetch(base + "?limit=20", { credentials: "include" })).json()).list || [];
        let noteId = row.note_id || (list.find((n) => String(n.body || "").startsWith(HEAD)) || {}).noteId || "";
        let r;
        if (noteId) r = await fetch(base + "/" + noteId, { method: "PUT", credentials: "include", headers: H, body: JSON.stringify({ body: row.note }) });
        if (!noteId || !r.ok) r = await fetch(base, { method: "POST", credentials: "include", headers: H, body: JSON.stringify({ body: row.note }) });
        const j = await r.json().catch(() => ({}));
        a.ok = r.ok; a.chat_id = chatId; a.note_id = j.noteId || noteId; a.reason = r.ok ? "" : "HTTP " + r.status;
      } catch (e) { a.reason = e.message; }
      out.push(a);
    }
    return out;
  }, { BOT, HEAD, rows });
  for (const a of res) console.log("ACK " + JSON.stringify(a));
  await task.finish({ keep: [] });
}
`;
const r = spawnSync('ego-browser', ['nodejs'], { input: script, encoding: 'utf-8', maxBuffer: 20e6 });
const out = (r.stdout || '') + (r.stderr || '');
if (/NEEDLOGIN/.test(out)) { log('❌ ego 沒登入 LINE 商用 ID,請他本人在 ego 開 https://chat.line.biz 登入一次'); console.log(out.slice(0, 500)); process.exit(2); }
const acks = out.split('\n').filter((l) => l.startsWith('ACK ')).map((l) => JSON.parse(l.slice(4)));
if (!acks.length) { log('❌ 沒收到回執'); console.log(out.slice(-1500)); process.exit(1); }

// ⑤ 回填
const sqls = [];
for (const a of acks) {
  const row = rows.find((x) => x.user_id === a.user_id);
  if (a.ok) sqls.push("UPDATE pop_line_notes SET synced_at=datetime('now'), synced_note=" + q(row.note) + ", chat_id=" + q(a.chat_id) + ", note_id=" + q(a.note_id) + " WHERE user_id=" + q(a.user_id) + ";");
  log(a.ok ? '✅' : '⚠️', a.user_id.slice(0, 8), row?.name || '', a.ok ? '已寫備註 ' + a.note_id : a.reason);
}
if (sqls.length) d1(sqls.join('\n'));
log('完成', acks.filter((a) => a.ok).length + '/' + acks.length);
