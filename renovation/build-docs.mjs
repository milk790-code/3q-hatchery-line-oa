// build-docs.mjs — 把 renovation/ 內的 .md 轉成手機好讀的品牌 HTML
// 用法： npm i marked && node renovation/build-docs.mjs
//        （或本專案：NODE_PATH=/tmp/mdconv/node_modules node renovation/build-docs.mjs）
import { marked } from 'marked';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));      // renovation/
marked.setOptions({ gfm: true, breaks: false });

// 要轉換的來源：內部機密/、工班端/ 的所有 .md，加上根目錄的需求發散
const targets = [];
for (const sub of ['內部機密', '工班端']) {
  for (const f of readdirSync(join(ROOT, sub))) if (f.endsWith('.md')) targets.push(join(sub, f));
}
targets.push('00-需求發散-brainstorm.md');

const tpl = (title, body, { secret, depth }) => {
  const back = depth ? '../index.html' : 'index.html';
  return `<!DOCTYPE html>
<html lang="zh-Hant"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@300;400;500;600;700&family=Noto+Sans+TC:wght@300;400;500;700&display=swap');
:root{--black:#0A0A0A;--paper:#F5F2EC;--gold:#B8924A;--ink:#1A1A1A;--stone:#8A8A8A;--sand:#E8DFD0;--rule:rgba(10,10,10,.12)}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--paper);color:var(--ink);font-family:"Noto Sans TC",-apple-system,system-ui,sans-serif;line-height:1.85;-webkit-text-size-adjust:100%}
.bar{position:sticky;top:0;z-index:10;background:rgba(10,10,10,.96);backdrop-filter:blur(6px);color:var(--paper);display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 18px;border-bottom:1px solid var(--gold)}
.bar a{color:var(--gold);text-decoration:none;font-size:14px;letter-spacing:.06em;white-space:nowrap}
.bar .t{font-family:"Noto Serif TC",serif;font-size:15px;letter-spacing:.04em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar button{background:transparent;border:1px solid var(--gold);color:var(--gold);font-size:12px;padding:6px 12px;border-radius:4px;cursor:pointer;font-family:inherit;white-space:nowrap}
.secret{background:#a8442a;color:#fff;text-align:center;font-size:12.5px;letter-spacing:.12em;padding:8px}
.doc{max-width:760px;margin:0 auto;padding:28px 20px 80px}
.doc h1{font-family:"Noto Serif TC",serif;font-weight:600;font-size:clamp(26px,7vw,38px);line-height:1.35;letter-spacing:.03em;margin:8px 0 22px;padding-bottom:14px;border-bottom:2px solid var(--gold);color:var(--black)}
.doc h2{font-family:"Noto Serif TC",serif;font-weight:600;font-size:clamp(21px,5.5vw,28px);margin:38px 0 14px;padding-left:13px;border-left:4px solid var(--gold);color:var(--black);letter-spacing:.03em}
.doc h3{font-family:"Noto Serif TC",serif;font-weight:500;font-size:clamp(18px,4.8vw,22px);margin:28px 0 10px;color:var(--black);letter-spacing:.03em}
.doc h4{font-size:16px;font-weight:700;margin:20px 0 8px;color:var(--ink)}
.doc p{margin:13px 0;font-size:16.5px}
.doc ul,.doc ol{margin:13px 0;padding-left:24px}
.doc li{margin:7px 0;font-size:16.5px}
.doc li::marker{color:var(--gold)}
.doc input[type=checkbox]{width:17px;height:17px;margin-right:7px;accent-color:var(--gold);vertical-align:-2px}
.doc strong{color:var(--black);font-weight:700}
.doc a{color:var(--gold)}
.doc blockquote{margin:18px 0;padding:12px 18px;background:var(--sand);border-left:4px solid var(--gold);border-radius:0 6px 6px 0}
.doc blockquote p{margin:4px 0;font-size:16px}
.doc code{background:var(--sand);padding:2px 7px;border-radius:4px;font-size:.92em;font-family:"SFMono-Regular",Menlo,Consolas,monospace}
.doc pre{background:var(--black);color:var(--paper);padding:16px;border-radius:8px;overflow-x:auto;margin:18px 0;-webkit-overflow-scrolling:touch}
.doc pre code{background:none;color:inherit;padding:0;font-size:13px;line-height:1.6;white-space:pre}
.doc hr{border:none;border-top:1px solid var(--rule);margin:30px 0}
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:18px 0;border:1px solid var(--rule);border-radius:8px}
.doc table{border-collapse:collapse;width:100%;font-size:14.5px;min-width:420px}
.doc th{background:var(--black);color:var(--paper);text-align:left;padding:11px 13px;font-weight:500;letter-spacing:.04em;white-space:nowrap}
.doc td{border-bottom:1px solid var(--rule);padding:11px 13px;vertical-align:top}
.doc tbody tr:nth-child(even){background:#faf8f4}
.doc table strong{color:var(--gold)}
</style></head>
<body>
<div class="bar"><a href="${back}">← 導覽中心</a><span class="t">${title}</span><button onclick="window.print()">列印</button></div>
${secret ? '<div class="secret">🔴 內部機密 · 切勿公開或外流</div>' : ''}
<main class="doc">${body}</main>
<script>
// 讓所有表格可在手機橫向滑動
document.querySelectorAll('.doc table').forEach(t=>{const w=document.createElement('div');w.className='tw';t.replaceWith(w);w.appendChild(t);});
</script>
</body></html>`;
};

let n = 0;
for (const rel of targets) {
  const src = join(ROOT, rel);
  const md = readFileSync(src, 'utf8');
  const m = md.match(/^#\s+(.+)$/m);
  const title = (m ? m[1] : basename(rel, '.md')).replace(/[*`]/g, '').trim();
  const body = marked.parse(md);
  const out = src.replace(/\.md$/, '.html');
  const depth = rel.includes('/');
  writeFileSync(out, tpl(title, body, { secret: rel.startsWith('內部機密'), depth }));
  n++;
  console.log('✓', rel.replace(/\.md$/, '.html'));
}
console.log(`\n完成：轉出 ${n} 個手機網頁。`);
