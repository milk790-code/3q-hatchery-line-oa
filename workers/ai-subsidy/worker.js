// 3q-ai-subsidy — AI 補助落地頁 worker(獨立,不碰 3q-art-portfolio / LINE 三層)
// GET / → 落地頁(含 OG);POST /api/lead → D1 ai_subsidy_leads;GET /health。
const VER = 'v2.0';

// ── 補助媒合規則表(資料查證 2026-06-12)──────────────────────
// stage: idea/pre/new/mid ; biz: food/retail/tech/other
// needs: ai-tools/startup/rd/training/expand
// status_2026: open(開放中)/seasonal(等梯次)/closed(今年已截止,備明年)
const RULES = [
  { id:"sbir-central", name:"中央型SBIR 小型企業創新研發計畫", max_amount:12000000, type:"grant",
    eligibility:{ stage:["new","mid"], biz_bonus:["tech","food","other"], needs:["rd","ai-tools"] },
    difficulty:4, timing:"rolling", status_2026:"open",
    tip:"全台最強研發補助，隨到隨審無梯次壓力。先以Phase1（150萬、簡報格式、6個月）試水，過了再攻Phase2。需公司登記、補助款不得超過總經費50%。" },
  { id:"sbir-taichung", name:"台中市地方型SBIR（地方產業創新研發）", max_amount:1000000, type:"grant",
    eligibility:{ stage:["new","mid"], biz_bonus:["tech","other","food"], needs:["rd","ai-tools"] },
    difficulty:3, timing:"annual", status_2026:"open",
    tip:"台中在地企業專屬，門檻比中央SBIR低。115年度紙本收件至6/26中午12時。執行場所須在台中、同公司同年度限1案。" },
  { id:"siir", name:"SIIR 服務業創新研發計畫", max_amount:1500000, type:"grant",
    eligibility:{ stage:["new","mid"], biz_bonus:["retail","food","tech"], needs:["rd","ai-tools","expand"] },
    difficulty:4, timing:"annual", status_2026:"seasonal",
    tip:"服務業數位/低碳轉型補助。115年第一梯已截止，第二梯約5-6月，否則備2027年第一梯（12月開）。需工商憑證、淨值為正。" },
  { id:"youth-loan", name:"青年創業及啟動金貸款", max_amount:12000000, type:"loan",
    eligibility:{ stage:["pre","new","mid"], biz_bonus:["food","retail","tech","other"], needs:["startup","expand"] },
    difficulty:3, timing:"rolling", status_2026:"open",
    tip:"18-45歲、公司設立未滿8年、負責人持股20%以上、3年內修滿20小時創業課程。週轉600萬/資本支出1200萬，100萬以下免計畫書、免保人。" },
  { id:"digital-30", name:"30人以下中小微企業數位轉型培力補助", max_amount:100000, type:"grant",
    eligibility:{ stage:["new","mid"], biz_bonus:["food","retail","tech","other"], needs:["ai-tools","training"] },
    difficulty:1, timing:"rolling", status_2026:"open",
    tip:"最好上手的補助：員工30人以下、培訓數位技能可搭配軟體。每家最高10萬，受理至115/12/31，可分次報核。" },
  { id:"tcloud", name:"臺灣雲市集 TCloud 數位點數", max_amount:30000, type:"grant",
    eligibility:{ stage:["new","mid"], biz_bonus:["food","retail","other","tech"], needs:["ai-tools"] },
    difficulty:1, timing:"rolling", status_2026:"open",
    tip:"需工商憑證、一公司限一次，最高3萬點買雲端工具（POS/CRM/電商）。自付額與補助1:4，須簽約當月啟用、3個月內用完否則收回。" },
  { id:"phoenix", name:"微型創業鳳凰貸款", max_amount:2000000, type:"loan",
    eligibility:{ stage:["pre","new"], biz_bonus:["food","retail","other"], needs:["startup"] },
    difficulty:2, timing:"rolling", status_2026:"open",
    tip:"限女性(18-45)、中高齡(45-65)或離島居民。前2年免息（特定身分前3年）、免擔保免保人。需修18小時課程、事業設立未滿5年、員工未滿5人。" },
  { id:"citd", name:"CITD 協助傳統產業技術開發計畫", max_amount:2000000, type:"grant",
    eligibility:{ stage:["mid"], biz_bonus:["other","food"], needs:["rd"] },
    difficulty:4, timing:"annual", status_2026:"closed",
    tip:"製造業須工廠登記、技術服務業限特定類別。產品開發上限200萬、補助≤總經費50%。115年主要梯次已截止，多在Q1/Q3開案，備明年。" },
  { id:"imdp", name:"國貿署 補助企業布建海外通路（開發國際市場）", max_amount:5000000, type:"grant",
    eligibility:{ stage:["mid"], biz_bonus:["food","retail","other","tech"], needs:["expand"] },
    difficulty:4, timing:"rolling", status_2026:"open",
    tip:"須為登記出進口廠商、有出進口實績（新創可放寬）。補助海外據點/代理商，排除參展。單家上限500萬、聯合2000萬、補助50%。受理至2027/11/30。" },
  { id:"hire-subsidy", name:"僱用獎助（雇主僱用失業勞工獎助）", max_amount:156000, type:"grant",
    eligibility:{ stage:["new","mid"], biz_bonus:["food","retail","tech","other"], needs:["expand"] },
    difficulty:2, timing:"rolling", status_2026:"open",
    tip:"須僱用就服站開立『僱用獎助推介卡』的失業勞工。每人每月0.9萬-1.3萬，最長12個月。先向公立就服機構求才登記。" },
  { id:"ndf-angel", name:"國發基金 創業天使投資方案", max_amount:30000000, type:"invest",
    eligibility:{ stage:["new","mid"], biz_bonus:["tech"], needs:["rd","expand"] },
    difficulty:5, timing:"rolling", status_2026:"open",
    tip:"股權投資非補助。設立未滿8年、實收資本額1億以下、未公開發行。原則需搭配天使投資人共同投資。原則投資2000萬、初次最高3000萬。" },
  { id:"angel-tax-23-2", name:"產創條例§23-2 天使投資人租稅優惠", max_amount:5000000, type:"tax",
    eligibility:{ stage:["new"], biz_bonus:["tech"], needs:["rd"] },
    difficulty:3, timing:"rolling", status_2026:"open",
    tip:"給投資你的天使的租稅優惠：個人投資滿50萬、持股3年，可抵減投資額50%、每年最高500萬（一般產業300萬）。可當募資籌碼。" },
  { id:"startup-award", name:"新創事業獎", max_amount:500000, type:"award",
    eligibility:{ stage:["new","mid"], biz_bonus:["tech","food","retail","other"], needs:["rd"] },
    difficulty:3, timing:"annual", status_2026:"seasonal",
    tip:"得獎是SBIR等計畫的審查加分項。重點在背書與曝光，適合已有產品實績者。" },
  { id:"small-giant-award", name:"小巨人獎", max_amount:300000, type:"award",
    eligibility:{ stage:["mid"], biz_bonus:["tech","other","food"], needs:["rd","expand"] },
    difficulty:4, timing:"annual", status_2026:"seasonal",
    tip:"頒給有外銷/創新實績的成熟中小企業，屬榮譽型、SBIR加分項。經營1年以上、有出口或創新成績者再考慮。" },
  { id:"tc-star", name:"台中摘星青年、築夢臺中（創業基地進駐）", max_amount:50000, type:"grant",
    eligibility:{ stage:["idea","pre","new"], biz_bonus:["food","retail","other"], needs:["startup","training"] },
    difficulty:2, timing:"annual", status_2026:"seasonal",
    tip:"適合早期/還沒成立的台中青年：進駐審計新村/光復新村創業基地，享空間+輔導+補助。需設籍台中、進駐期間不得受僱他處。" },
];

// 分層：high=階段命中且開放中；mid=階段命中但等梯次/缺需求對應；future=階段未到或已截止
function matchSubsidies({ stage, biz, needs }) {
  const high = [], mid = [], future = [];
  for (const r of RULES) {
    const stageHit = r.eligibility.stage.includes(stage);
    const needsHit = needs.some(n => r.eligibility.needs.includes(n));
    const item = { id:r.id, name:r.name, max_amount:r.max_amount, type:r.type,
      difficulty:r.difficulty, timing:r.timing, tip:r.tip,
      biz_bonus:r.eligibility.biz_bonus.includes(biz), needs_hit:needsHit };
    if (stageHit && r.status_2026 === 'open') high.push(item);
    else if (stageHit && (r.status_2026 === 'seasonal' || !needsHit)) mid.push(item);
    else future.push(item);
  }
  const sortKey = (a,b) => (b.max_amount*(6-b.difficulty)) - (a.max_amount*(6-a.difficulty));
  high.sort(sortKey); mid.sort(sortKey); future.sort(sortKey);
  return { matches:{high,mid,future}, total_amount: high.reduce((s,x)=>s+x.max_amount,0) };
}

function fmtNT(n){ return 'NT$' + Number(n||0).toLocaleString('en-US'); }

// LINE push 通知陳學誼本人(失敗不影響主流程;每月免費 200 則,僅高適配>0 時發送以省額度)
async function notifyAdmin(env, d) {
  const token = env.LINE_CHANNEL_ACCESS_TOKEN, to = env.ADMIN_LINE_USER_ID;
  if (!token || !to) return;
  const map = { idea:'有想法還沒開始', pre:'還沒成立公司', new:'設立1年內', mid:'經營1年以上',
    food:'餐飲食品', retail:'零售服務', tech:'科技軟體', other:'其他' };
  const needMap = { 'ai-tools':'AI工具', startup:'創業資金', rd:'產品研發', training:'AI培訓', expand:'擴店擴張' };
  const top3 = d.matches.high.slice(0,3).map((m,i)=>`${i+1}. ${m.name}（最高 ${fmtNT(m.max_amount)}）`).join('\n')
    || '（暫無高適配，見中適配清單）';
  const text = `🔔 新補助諮詢來了！\n階段：${map[d.stage]||d.stage}\n產業：${map[d.biz]||d.biz}\n` +
    `需求：${(d.needs||[]).map(n=>needMap[n]||n).join('、')}\n聯絡：${d.contact}\n─────\n` +
    `預估可爭取總額：${fmtNT(d.total_amount)}\n高適配 TOP3：\n${top3}`;
  await fetch('https://api.line.me/v2/bot/message/push', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${token}` },
    body: JSON.stringify({ to, messages:[{ type:'text', text }] })
  }).catch(()=>{});
}
const PAGE = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>整整三年，不用花你一塊錢｜AI 創業陪跑｜3Q孵化所</title>
<meta property="og:type" content="website">
<meta property="og:title" content="整整三年，不用花你一塊錢｜AI 創業陪跑">
<meta property="og:description" content="4 個問題，找出你符合資格的全部政府補助——金額、難度、申請順序，整理好用 LINE 傳給你。完全免費。">
<meta property="og:url" content="https://3q-ai-subsidy.milk790.workers.dev/">
<meta property="og:image" content="https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/og-ai-subsidy.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg:#0C0C0C;
      --card:#161616;
      --alt:#111111;
      --gold:#C9A040;
      --gold-lt:#E8BC58;
      --gold-dim:rgba(201,160,64,0.12);
      --cream:#F0E8D8;
      --dim:#8A7E70;
      --green:#52C97C;
      --red:#FF6B6B;
      --border:rgba(201,160,64,0.18);
      --r:12px;
      --rs:8px;
    }
    html{scroll-behavior:smooth}
    body{
      background:var(--bg);color:var(--cream);
      font-family:-apple-system,"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif;
      line-height:1.6;overflow-x:hidden;-webkit-font-smoothing:antialiased;
    }

    /* NAV */
    nav{
      position:sticky;top:0;z-index:100;
      display:flex;justify-content:space-between;align-items:center;
      padding:13px 20px;
      background:rgba(12,12,12,.95);backdrop-filter:blur(12px);
      border-bottom:1px solid var(--border);
    }
    .nav-logo{font-size:14px;font-weight:800;color:var(--gold);letter-spacing:.03em}
    .nav-btn{
      background:var(--gold);color:#0C0C0C;border:none;
      padding:8px 18px;border-radius:6px;font-size:13px;font-weight:800;
      text-decoration:none;font-family:inherit;cursor:pointer;
    }

    /* HERO */
    .hero{
      min-height:100svh;display:flex;flex-direction:column;
      justify-content:center;padding:64px 20px 48px;
      position:relative;overflow:hidden;
    }
    .hero::before{
      content:'';position:absolute;top:-120px;right:-100px;
      width:360px;height:360px;
      background:radial-gradient(circle,rgba(201,160,64,.13) 0%,transparent 68%);
      pointer-events:none;
    }
    .hero::after{
      content:'';position:absolute;bottom:-80px;left:-80px;
      width:280px;height:280px;
      background:radial-gradient(circle,rgba(201,160,64,.07) 0%,transparent 70%);
      pointer-events:none;
    }
    .badge{
      display:inline-flex;align-items:center;gap:7px;
      background:var(--gold-dim);border:1px solid var(--border);
      border-radius:100px;padding:5px 13px;
      font-size:11px;color:var(--gold-lt);font-weight:700;
      letter-spacing:.06em;margin-bottom:24px;width:fit-content;
    }
    .dot{width:7px;height:7px;border-radius:50%;background:var(--gold);animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}

    /* THE BIG HEADLINE */
    .hero-h1{
      font-size:clamp(42px,11vw,72px);font-weight:900;
      line-height:1.1;letter-spacing:-.035em;margin-bottom:6px;
    }
    .hero-h1 .gold{color:var(--gold)}
    .hero-h1 .sub-line{
      font-size:clamp(18px,5vw,28px);font-weight:500;
      color:var(--cream);letter-spacing:-.01em;
      display:block;margin-top:8px;
    }

    .hero-desc{
      font-size:clamp(14px,3.8vw,17px);color:var(--cream);
      line-height:1.75;margin:20px 0 28px;max-width:420px;
    }
    .hero-desc strong{color:var(--gold-lt)}

    /* ticker */
    .ticker{
      display:flex;align-items:center;gap:10px;
      background:var(--gold-dim);border:1px solid var(--border);
      border-radius:var(--rs);padding:9px 13px;margin-bottom:28px;overflow:hidden;
    }
    .t-tag{font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--gold);font-weight:800;white-space:nowrap}
    .t-wrap{flex:1;overflow:hidden;position:relative;height:20px}
    .t-item{
      position:absolute;inset:0;display:flex;align-items:center;
      font-size:12px;color:var(--cream);opacity:0;
      transition:opacity .4s,transform .4s;transform:translateY(8px);
    }
    .t-item.on{opacity:1;transform:translateY(0)}

    .cta-wrap{display:flex;flex-direction:column;gap:10px}
    .btn-main{
      display:block;background:var(--gold);color:#0C0C0C;
      padding:17px 24px;border-radius:var(--rs);
      font-size:16px;font-weight:800;text-align:center;
      text-decoration:none;cursor:pointer;border:none;font-family:inherit;
      letter-spacing:.01em;transition:background .15s;
    }
    .btn-main:hover{background:var(--gold-lt)}
    .trust{font-size:11px;color:var(--dim);text-align:center}

    /* STATS */
    .stats{
      display:grid;grid-template-columns:repeat(3,1fr);
      gap:1px;background:var(--border);
      border-top:1px solid var(--border);border-bottom:1px solid var(--border);
    }
    .stat{background:var(--card);padding:18px 12px;text-align:center}
    .sn{display:block;font-size:22px;font-weight:900;color:var(--gold);letter-spacing:-.02em}
    .sl{font-size:10px;color:var(--dim);margin-top:3px;line-height:1.4}

    /* SECTIONS */
    .sec{padding:56px 20px}
    .sec-alt{background:var(--alt)}
    .eye{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);font-weight:800;margin-bottom:10px}
    .sec-h{font-size:clamp(24px,6.5vw,38px);font-weight:900;line-height:1.2;letter-spacing:-.02em;margin-bottom:8px}
    .sec-p{font-size:14px;color:var(--dim);margin-bottom:28px;line-height:1.75}

    /* WHO IS THIS FOR — persona cards */
    .persona-grid{display:flex;flex-direction:column;gap:10px}
    .p-card{
      background:var(--card);border:1px solid var(--border);
      border-radius:var(--r);padding:18px 16px;
      display:flex;gap:14px;align-items:flex-start;
    }
    .p-icon{font-size:28px;flex-shrink:0;margin-top:2px}
    .p-who{font-size:12px;color:var(--gold);font-weight:700;letter-spacing:.04em;margin-bottom:4px}
    .p-title{font-size:15px;font-weight:800;margin-bottom:4px;color:var(--cream)}
    .p-desc{font-size:12px;color:var(--dim);line-height:1.65}

    /* TIMELINE JOURNEY */
    .timeline{display:flex;flex-direction:column;gap:0;margin-top:28px}
    .tl-item{display:flex;gap:16px;padding-bottom:28px;position:relative}
    .tl-item:not(:last-child)::after{
      content:'';position:absolute;left:17px;top:36px;bottom:0;
      width:1px;background:var(--border);
    }
    .tl-dot{
      width:34px;height:34px;border-radius:50%;
      background:var(--gold);color:#0C0C0C;
      font-size:11px;font-weight:900;
      display:flex;align-items:center;justify-content:center;
      flex-shrink:0;position:relative;z-index:1;letter-spacing:0;
      text-align:center;line-height:1.2;
    }
    .tl-body{flex:1;padding-top:5px}
    .tl-time{font-size:11px;color:var(--gold);font-weight:700;letter-spacing:.05em;margin-bottom:3px}
    .tl-title{font-size:15px;font-weight:800;margin-bottom:4px;color:var(--cream)}
    .tl-desc{font-size:13px;color:var(--dim);line-height:1.65}
    .tl-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
    .tag{
      background:var(--gold-dim);border:1px solid var(--border);
      border-radius:4px;padding:3px 8px;font-size:11px;color:var(--gold-lt);font-weight:600;
    }

    /* SUBSIDIES SCROLL */
    .scroll{
      display:flex;gap:10px;overflow-x:auto;
      padding:2px 0 12px;-webkit-overflow-scrolling:touch;scrollbar-width:none;
    }
    .scroll::-webkit-scrollbar{display:none}
    .sc{
      background:var(--card);border:1px solid var(--border);
      border-radius:var(--r);padding:16px;min-width:186px;flex-shrink:0;
    }
    .sc-type{font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:6px}
    .sc-name{font-size:13px;font-weight:700;margin-bottom:8px;line-height:1.4;color:var(--cream)}
    .sc-amt{font-size:24px;font-weight:900;color:var(--gold-lt);letter-spacing:-.02em;line-height:1}
    .sc-unit{font-size:10px;color:var(--dim);margin-top:2px}
    .sc-tag{
      display:inline-flex;align-items:center;gap:3px;
      margin-top:10px;background:rgba(82,201,124,.1);
      border-radius:4px;padding:3px 7px;font-size:10px;color:var(--green);font-weight:700;
    }

    /* THE BIG PROMISE BLOCK */
    .promise-block{
      background:linear-gradient(135deg,rgba(201,160,64,.1) 0%,rgba(201,160,64,.04) 100%);
      border:1px solid var(--border);border-radius:16px;padding:28px 20px;
      text-align:center;
    }
    .promise-label{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);font-weight:800;margin-bottom:12px}
    .promise-big{font-size:clamp(28px,8vw,48px);font-weight:900;line-height:1.15;letter-spacing:-.03em;margin-bottom:12px}
    .promise-big span{color:var(--gold)}
    .promise-list{display:flex;flex-direction:column;gap:8px;text-align:left;margin-top:16px}
    .pl-item{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--cream)}
    .pl-check{color:var(--green);font-size:15px;flex-shrink:0;margin-top:1px}

    /* FORM */
    .form-sec{padding:56px 20px 80px}
    .form-box{
      background:var(--card);border:1px solid var(--border);
      border-radius:16px;padding:28px 20px;max-width:460px;margin:0 auto;
    }
    .fh{font-size:22px;font-weight:900;margin-bottom:6px;letter-spacing:-.02em}
    .fs{font-size:13px;color:var(--dim);margin-bottom:24px;line-height:1.75}

    .fg{margin-bottom:20px}
    .fl{font-size:13px;font-weight:700;display:block;margin-bottom:10px}

    .rg{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    .ro{position:relative}
    .ro input{position:absolute;opacity:0;width:0;height:0}
    .ro label{
      display:block;padding:10px 11px;
      background:var(--bg);border:1px solid rgba(255,255,255,.08);
      border-radius:var(--rs);font-size:13px;color:var(--dim);
      cursor:pointer;transition:all .15s;line-height:1.4;
    }
    .ro input:checked+label{background:var(--gold-dim);border-color:var(--gold);color:var(--cream)}

    .cl{display:flex;flex-direction:column;gap:7px}
    .co{position:relative}
    .co input{position:absolute;opacity:0;width:0;height:0}
    .co label{
      display:flex;align-items:center;gap:10px;padding:11px 13px;
      background:var(--bg);border:1px solid rgba(255,255,255,.08);
      border-radius:var(--rs);font-size:13px;color:var(--dim);
      cursor:pointer;transition:all .15s;
    }
    .co label::before{
      content:'';width:17px;height:17px;
      border:1.5px solid rgba(255,255,255,.18);border-radius:4px;
      flex-shrink:0;transition:all .15s;
    }
    .co input:checked+label{background:var(--gold-dim);border-color:var(--gold);color:var(--cream)}
    .co input:checked+label::before{background:var(--gold);border-color:var(--gold)}

    .ti{
      width:100%;background:var(--bg);
      border:1px solid rgba(255,255,255,.08);border-radius:var(--rs);
      padding:13px 14px;font-size:15px;color:var(--cream);
      font-family:inherit;outline:none;transition:border-color .15s;
    }
    .ti:focus{border-color:var(--gold)}
    .ti::placeholder{color:var(--dim)}
    .ti.err{border-color:var(--red)}
    .hint{font-size:11px;color:var(--dim);margin-top:6px}

    .sbtn{
      width:100%;padding:16px;margin-top:8px;
      background:var(--gold);color:#0C0C0C;border:none;
      border-radius:var(--rs);font-size:16px;font-weight:800;
      font-family:inherit;cursor:pointer;transition:background .15s;letter-spacing:.01em;
    }
    .sbtn:hover{background:var(--gold-lt)}
    .fn{font-size:11px;color:var(--dim);text-align:center;margin-top:12px;line-height:1.6}

    /* FOOTER */
    footer{border-top:1px solid var(--border);padding:24px 20px;text-align:center}
    .ft-logo{font-size:14px;font-weight:800;color:var(--gold);margin-bottom:6px}
    .ft-note{font-size:11px;color:var(--dim);line-height:1.7}
    .ft-disclaimer{font-size:10px;color:rgba(138,126,112,.5);margin-top:12px;line-height:1.6}

    /* MODAL */
    .mb{
      position:fixed;inset:0;background:rgba(0,0,0,.88);
      z-index:500;display:none;align-items:center;justify-content:center;padding:20px;
    }
    .mb.open{display:flex}
    .mbox{
      background:var(--card);border:1px solid var(--border);
      border-radius:16px;padding:36px 24px;text-align:center;max-width:340px;width:100%;
    }
    .mi{font-size:48px;margin-bottom:14px}
    .mt{font-size:22px;font-weight:900;color:var(--gold);margin-bottom:10px}
    .md{font-size:13px;color:var(--dim);line-height:1.75;margin-bottom:24px}
    .mc{
      background:var(--gold);color:#0C0C0C;border:none;
      padding:12px 28px;border-radius:var(--rs);
      font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;
    }
  </style>
</head>
<body>

<!-- NAV -->
<nav>
  <div class="nav-logo">3Q孵化所</div>
  <a href="#form" class="nav-btn">免費了解</a>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="badge"><span class="dot"></span>台灣 AI 創業陪跑計畫</div>

  <h1 class="hero-h1">
    整整三年<br>
    <span class="gold">不用花你</span><br>
    <span class="gold">一塊錢</span>
    <span class="sub-line">從你的第一個想法，到開始盈利</span>
  </h1>

  <p class="hero-desc">
    不管你是<strong>路邊小吃攤</strong>、<strong>餐飲店老闆</strong>、<strong>有想法還沒開始</strong>、還是<strong>一直在觀察 AI 但還沒接觸</strong>的你——<br>
    我們陪你從零規劃，幫你申請政府補助，讓所有開銷都有政府買單，甚至多間分店，三年不用花你一塊錢。
  </p>

  <div class="ticker">
    <span class="t-tag">補助中</span>
    <div class="t-wrap">
      <div class="t-item on">SBIR 研發補助｜最高 1,200 萬，隨到隨審</div>
      <div class="t-item">服務業創新補助 SIIR｜小吃攤、餐廳通通能申請</div>
      <div class="t-item">30 人以下數位轉型培力｜最高 10 萬，最快核准</div>
      <div class="t-item">政府免費 GPU 算力｜等值 65 萬，AI 開發完全免費</div>
      <div class="t-item">青年創業貸款｜最高 1,200 萬，5 年近乎零利率</div>
      <div class="t-item">台中地方型 SBIR｜台中企業加碼 100 萬</div>
      <div class="t-item">AI 投資稅務優惠｜買 AI 工具可以抵稅</div>
      <div class="t-item">創業課程補助｜政府幫你付學費</div>
    </div>
  </div>

  <div class="cta-wrap">
    <a href="#form" class="btn-main">我想了解我能拿什麼 →</a>
    <div class="trust">✓ 完全免費　✓ 3 分鐘填完　✓ 不管你有沒有公司都可以</div>
  </div>
</section>

<!-- STATS -->
<div class="stats">
  <div class="stat">
    <span class="sn">30+</span>
    <span class="sl">政府補助<br>計畫</span>
  </div>
  <div class="stat">
    <span class="sn">3 年</span>
    <span class="sl">陪你從零到<br>開始盈利</span>
  </div>
  <div class="stat">
    <span class="sn">$0</span>
    <span class="sl">你自己需要<br>花的錢</span>
  </div>
</div>

<!-- WHO IS THIS FOR -->
<section class="sec">
  <div class="eye">這是給你的</div>
  <h2 class="sec-h">不管你現在<br>在哪個階段</h2>
  <p class="sec-p">只要你有一點想法、想用 AI 讓生活更好，我們都能幫你找到資源。</p>

  <div class="persona-grid">
    <div class="p-card">
      <div class="p-icon">🍜</div>
      <div>
        <div class="p-who">餐飲 / 小吃 / 攤販</div>
        <div class="p-title">開了店，想用 AI 省人力、接外送、管庫存</div>
        <div class="p-desc">有店面的服務業通通符合資格，可以申請服務業創新補助，幫你導入訂位系統、AI 點餐、智慧排班，費用全部政府出。</div>
      </div>
    </div>
    <div class="p-card">
      <div class="p-icon">💡</div>
      <div>
        <div class="p-who">有想法 / 還沒開始的你</div>
        <div class="p-title">腦子裡有計畫，就差資金跟有人帶</div>
        <div class="p-desc">連公司還沒設也沒關係。我們先幫你規劃，找到最適合的補助路線，設公司、申請補助一起陪你走。</div>
      </div>
    </div>
    <div class="p-card">
      <div class="p-icon">👀</div>
      <div>
        <div class="p-who">一直在觀察 AI 的你</div>
        <div class="p-title">看了很多 AI 新聞，還沒真正接觸</div>
        <div class="p-desc">等的就是一個時機。政府現在有補助可以幫你出 AI 工具的費用，現在進場比等另一年便宜太多了。</div>
      </div>
    </div>
    <div class="p-card">
      <div class="p-icon">🏪</div>
      <div>
        <div class="p-who">已在經營的中小企業</div>
        <div class="p-title">想把 AI 導入但怕投資沒回報</div>
        <div class="p-desc">政府出 50% 研發費用，你出 50%，最高補助 1,200 萬。投資風險直接砍半，回報卻是你全拿。</div>
      </div>
    </div>
    <div class="p-card">
      <div class="p-icon">🙋</div>
      <div>
        <div class="p-who">個人創業者 / 副業想轉正</div>
        <div class="p-title">一個人做，但想要政府當你的靠山</div>
        <div class="p-desc">微型創業鳳凰貸款、青年創業貸款、30 人以下培力補助——一個人也能全部申請，前兩年近乎不用付利息。</div>
      </div>
    </div>
  </div>
</section>

<!-- TIMELINE -->
<section class="sec sec-alt">
  <div class="eye">陪跑路線</div>
  <h2 class="sec-h">從想法到多間分店<br>每一步我們都在</h2>

  <div class="timeline">
    <div class="tl-item">
      <div class="tl-dot">第1<br>月</div>
      <div class="tl-body">
        <div class="tl-time">第 1–3 個月</div>
        <div class="tl-title">想法梳理 + 公司設立 + 第一筆補助申請</div>
        <div class="tl-desc">確定你的方向，設立公司（最低 NT$1 元），立刻申請第一批補助——通常 3 個月內就能核准第一筆資金進帳。</div>
        <div class="tl-tags">
          <span class="tag">公司設立</span>
          <span class="tag">SBIR Phase 1</span>
          <span class="tag">免費算力申請</span>
        </div>
      </div>
    </div>
    <div class="tl-item">
      <div class="tl-dot">第1<br>年</div>
      <div class="tl-body">
        <div class="tl-time">第 4–12 個月</div>
        <div class="tl-title">AI 工具導入 + 第二批補助疊加</div>
        <div class="tl-desc">補助覆蓋軟體、設備、員工培訓費用。你專心做生意，我們幫你把錢一批一批申請回來。</div>
        <div class="tl-tags">
          <span class="tag">SBIR Phase 2</span>
          <span class="tag">數位轉型 10 萬</span>
          <span class="tag">雲市集點數</span>
          <span class="tag">員工訓練補助</span>
        </div>
      </div>
    </div>
    <div class="tl-item">
      <div class="tl-dot">第2<br>年</div>
      <div class="tl-body">
        <div class="tl-time">第二年</div>
        <div class="tl-title">開始盈利 + 繼續申請年度補助</div>
        <div class="tl-desc">多數補助都是年度制，每年都能繼續申請。你已經有收入，同時政府還在幫你出費用。</div>
        <div class="tl-tags">
          <span class="tag">服務業 SIIR</span>
          <span class="tag">地方型 SBIR</span>
          <span class="tag">稅務抵減開始</span>
        </div>
      </div>
    </div>
    <div class="tl-item">
      <div class="tl-dot">第3<br>年</div>
      <div class="tl-body">
        <div class="tl-time">第三年</div>
        <div class="tl-title">多間分店規劃 + 更多補助疊加</div>
        <div class="tl-desc">準備擴張的時候，還有更大規模的補助計畫可以申請。整整三年，你自己的錢幾乎可以不動。</div>
        <div class="tl-tags">
          <span class="tag">聯合申請 700 萬</span>
          <span class="tag">AI 投資抵稅</span>
          <span class="tag">天使輪融資</span>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- SUBSIDIES -->
<section class="sec">
  <div class="eye">部分可申請補助</div>
  <h2 class="sec-h">這些錢<br>正在等你領</h2>
  <p class="sec-p">以下只是部分，完整清單填完表單後揭曉。← 左右滑</p>

  <div class="scroll">
    <div class="sc">
      <div class="sc-type">研發補助</div>
      <div class="sc-name">SBIR 小型企業<br>創新研發計畫</div>
      <div class="sc-amt">1,200萬</div>
      <div class="sc-unit">最高補助 / 兩年</div>
      <div class="sc-tag">✓ 隨到隨審</div>
    </div>
    <div class="sc">
      <div class="sc-type">服務業 / 餐飲</div>
      <div class="sc-name">SIIR 服務業<br>創新研發計畫</div>
      <div class="sc-amt">1,000萬</div>
      <div class="sc-unit">最高補助 / 年</div>
      <div class="sc-tag">✓ 餐飲店適用</div>
    </div>
    <div class="sc">
      <div class="sc-type">微型 / 個人</div>
      <div class="sc-name">微型創業鳳凰<br>貸款</div>
      <div class="sc-amt">200萬</div>
      <div class="sc-unit">前 2 年免息</div>
      <div class="sc-tag">✓ 一個人也行</div>
    </div>
    <div class="sc">
      <div class="sc-type">創業資金</div>
      <div class="sc-name">青年創業<br>及啟動金貸款</div>
      <div class="sc-amt">1,200萬</div>
      <div class="sc-unit">5 年近乎零利率</div>
      <div class="sc-tag">✓ 18–45 歲</div>
    </div>
    <div class="sc">
      <div class="sc-type">最快申請</div>
      <div class="sc-name">30 人以下<br>數位轉型培力</div>
      <div class="sc-amt">10萬</div>
      <div class="sc-unit">直接補助不用還</div>
      <div class="sc-tag">✓ 最易申請</div>
    </div>
    <div class="sc">
      <div class="sc-type">AI 算力</div>
      <div class="sc-name">政府免費<br>GPU 算力</div>
      <div class="sc-amt">65萬</div>
      <div class="sc-unit">等值算力 · 完全免費</div>
      <div class="sc-tag">✓ 完全不花錢</div>
    </div>
    <div class="sc">
      <div class="sc-type">軟體費用</div>
      <div class="sc-name">雲市集<br>數位點數補助</div>
      <div class="sc-amt">3萬</div>
      <div class="sc-unit">每年 / 折抵 AI 軟體</div>
      <div class="sc-tag">✓ 立即可用</div>
    </div>
    <div class="sc">
      <div class="sc-type">台中加碼</div>
      <div class="sc-name">台中地方型<br>SBIR</div>
      <div class="sc-amt">100萬</div>
      <div class="sc-unit">台中企業限定</div>
      <div class="sc-tag">✓ 台中人專屬</div>
    </div>
  </div>
</section>

<!-- PROMISE BLOCK -->
<section class="sec sec-alt">
  <div class="promise-block">
    <div class="promise-label">我們的承諾</div>
    <div class="promise-big">
      從你的<span>第一個想法</span><br>
      到開始盈利<br>
      甚至<span>多間分店</span>
    </div>
    <p style="font-size:15px;color:var(--cream);line-height:1.75">
      整整三年，讓補助和政策性資金覆蓋所有的開銷，你自己的錢幾乎可以不動。
    </p>
    <div class="promise-list">
      <div class="pl-item"><span class="pl-check">✓</span>從零開始也沒問題，沒有公司我們幫你設</div>
      <div class="pl-item"><span class="pl-check">✓</span>幫你找出所有能申請的補助，疊加最大化</div>
      <div class="pl-item"><span class="pl-check">✓</span>全程陪跑，從申請到核銷到下一批</div>
      <div class="pl-item"><span class="pl-check">✓</span>AI 工具導入 + 商業規劃 + 行銷一起做</div>
      <div class="pl-item"><span class="pl-check">✓</span>不只是補助顧問，是你的共同創辦人</div>
    </div>
  </div>
</section>

<!-- FORM -->
<section class="form-sec" id="form">
  <div class="form-box">
    <div class="fh">填完就知道<br>你能拿多少</div>
    <div class="fs">
      不管你有沒有公司、在哪個階段——4 個問題，我們幫你找出所有符合資格的補助，讓台灣的市場，搶先世界一步。
    </div>

    <form id="mainForm" novalidate>

      <div class="fg">
        <label class="fl">你現在的狀況？</label>
        <div class="rg">
          <div class="ro"><input type="radio" name="stage" id="s1" value="idea"><label for="s1">有想法還沒開始</label></div>
          <div class="ro"><input type="radio" name="stage" id="s2" value="pre"><label for="s2">還沒成立公司</label></div>
          <div class="ro"><input type="radio" name="stage" id="s3" value="new"><label for="s3">公司設立 1 年內</label></div>
          <div class="ro"><input type="radio" name="stage" id="s4" value="mid"><label for="s4">經營中 1 年以上</label></div>
        </div>
      </div>

      <div class="fg">
        <label class="fl">你的業務屬於？</label>
        <div class="rg">
          <div class="ro"><input type="radio" name="biz" id="b1" value="food"><label for="b1">餐飲 / 食品</label></div>
          <div class="ro"><input type="radio" name="biz" id="b2" value="retail"><label for="b2">零售 / 服務</label></div>
          <div class="ro"><input type="radio" name="biz" id="b3" value="tech"><label for="b3">科技 / 軟體</label></div>
          <div class="ro"><input type="radio" name="biz" id="b4" value="other"><label for="b4">其他 / 還沒決定</label></div>
        </div>
      </div>

      <div class="fg">
        <label class="fl">你最想用補助解決什麼？（可多選）</label>
        <div class="cl">
          <div class="co"><input type="checkbox" id="n1" value="ai-tools"><label for="n1">AI 工具 / 軟體費用</label></div>
          <div class="co"><input type="checkbox" id="n2" value="startup"><label for="n2">創業 / 開店資金</label></div>
          <div class="co"><input type="checkbox" id="n3" value="rd"><label for="n3">產品研發費用</label></div>
          <div class="co"><input type="checkbox" id="n4" value="training"><label for="n4">自己或員工的 AI 培訓</label></div>
          <div class="co"><input type="checkbox" id="n5" value="expand"><label for="n5">擴店 / 擴張計畫</label></div>
        </div>
      </div>

      <div class="fg">
        <label class="fl">你的 LINE ID 或手機號碼</label>
        <input type="text" class="ti" id="contact" placeholder="LINE ID 或 09XXXXXXXX" autocomplete="off">
        <div class="hint">只用來傳你的補助清單，完全保密，不會騷擾你。</div>
      </div>

      <input type="text" id="hp" name="hp" style="position:absolute;left:-9999px" tabindex="-1" autocomplete="off" aria-hidden="true">

      <button type="submit" class="sbtn">送出 → 立即生成我的補助清單</button>
      <div class="fn">🔒 完全免費　✓ 不管你有沒有公司都可以填　✓ 沒有銷售電話</div>
    </form>
  </div>
</section>

<!-- FOOTER -->
<footer>
  <div class="ft-logo">3Q孵化所 × AI 補助媒合</div>
  <div class="ft-note">
    台灣 AI 品牌孵化與創業陪跑<br>
    讓台灣的市場，搶先世界一步
  </div>
  <div class="ft-disclaimer">
    ＊補助申請結果以各主管機關審核為準，補助金額視申請計畫、公司條件及當年度預算而定。本服務協助媒合與規劃，不保證所有補助均可申請成功。
  </div>
</footer>

<!-- MODAL -->
<div class="mb" id="modal">
  <div class="mbox">
    <div class="mi">🎯</div>
    <div class="mt">收到了！</div>
    <div class="md">
      我們正在根據你的條件比對補助清單。<br><br>
      <strong style="color:var(--cream)">最快今天內</strong>，你的個人化補助清單會透過 LINE 傳給你——包含每個符合資格的計畫、金額、申請難度，全部整理好。
    </div>
    <a class="mc" href="https://line.me/R/ti/p/%40121lkspe" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none;text-align:center">加 LINE 領取補助清單 → @121lkspe</a>
<div style="margin-top:10px;font-size:12px;opacity:.7">清單透過 LINE 傳送，加好友才收得到（10 秒完成）</div>
  </div>
</div>

<script>
  // Ticker
  const ti = document.querySelectorAll('.t-item');
  let tc = 0;
  setInterval(() => {
    ti[tc].classList.remove('on');
    tc = (tc + 1) % ti.length;
    ti[tc].classList.add('on');
  }, 2800);

  // Form submit → 即時媒合結果(後端失敗時退回原本「收到了」modal,不漏單)
  const fallbackHTML = document.querySelector('#modal .mbox').innerHTML;
  function fmtNT(n){ return 'NT$' + Number(n||0).toLocaleString('en-US'); }
  function showFallback(){
    document.querySelector('#modal .mbox').innerHTML = fallbackHTML;
    document.getElementById('modal').classList.add('open');
  }
  function showResult(data){
    const high = (data.matches && data.matches.high) || [];
    let list = high.slice(0,5).map(function(m){
      return '<div style="border-left:3px solid var(--gold);padding:8px 12px;margin:8px 0;background:var(--alt);text-align:left">' +
        '<div style="color:var(--gold);font-weight:800;font-size:14px">' + m.name + '</div>' +
        '<div style="font-size:13px">最高可爭取 ' + fmtNT(m.max_amount) + '</div>' +
        '<div style="color:var(--dim);font-size:12px;margin-top:4px">' + m.tip + '</div></div>';
    }).join('');
    if (!list) list = '<div style="font-size:14px">目前以「未來可期」項目為主，我們會親自為你規劃路徑。</div>';
    document.querySelector('#modal .mbox').innerHTML =
      '<div class="mi">🎯</div><div class="mt">你的專屬補助清單</div>' +
      '<div style="margin:10px 0 4px;font-size:14px">預估可爭取總額</div>' +
      '<div style="color:var(--gold);font-size:30px;font-weight:800;margin-bottom:8px">' + fmtNT(data.total_amount) + '</div>' +
      '<div style="color:var(--gold);font-size:14px;text-align:left;margin-top:8px">立即可申請：</div>' + list +
      '<div style="color:var(--dim);font-size:13px;margin:12px 0">完整清單與申請順序，顧問會用 LINE 與你聯繫，帶你一步步申請。</div>' +
      '<a class="mc" href="https://line.me/R/ti/p/%40121lkspe" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none;text-align:center">加 LINE 領取完整清單 → @121lkspe</a>';
    document.getElementById('modal').classList.add('open');
  }
  document.getElementById('mainForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const c = document.getElementById('contact');
    if (!c.value.trim()) {
      c.classList.add('err');
      c.focus();
      setTimeout(() => c.classList.remove('err'), 2000);
      return;
    }
    const payload = {
      contact: c.value.trim().slice(0,120),
      stage: (document.querySelector('input[name="stage"]:checked')||{}).value || '',
      biz: (document.querySelector('input[name="biz"]:checked')||{}).value || '',
      needs: Array.from(document.querySelectorAll('.cl input[type="checkbox"]:checked')).map(x=>x.value),
      hp: (document.getElementById('hp')||{}).value || ''
    };
    fetch('/api/lead', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)})
      .then(function(r){ return r.json(); })
      .then(function(data){ if (data.ok && data.matches) showResult(data); else showFallback(); })
      .catch(showFallback);
  });
</script>
</body>
</html>
`;

async function ensureTable(env) {
  if (!env.CRM) return;
  await env.CRM.prepare("CREATE TABLE IF NOT EXISTS ai_subsidy_leads (id INTEGER PRIMARY KEY AUTOINCREMENT, contact TEXT NOT NULL, stage TEXT, biz TEXT, needs TEXT, ip_hash TEXT, ua TEXT, created_at TEXT DEFAULT (datetime('now')))").run().catch(()=>{});
  // v2.0 新欄位(已存在時 ALTER 會報錯,忽略即可)
  await env.CRM.prepare("ALTER TABLE ai_subsidy_leads ADD COLUMN matched_json TEXT").run().catch(()=>{});
  await env.CRM.prepare("ALTER TABLE ai_subsidy_leads ADD COLUMN total_amount INTEGER DEFAULT 0").run().catch(()=>{});
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      let leads = -1;
      if (env.CRM) { try { const r = await env.CRM.prepare("SELECT COUNT(*) n FROM ai_subsidy_leads").first(); leads = r?.n ?? 0; } catch(_){} }
      return new Response(JSON.stringify({ ok:true, worker:'3q-ai-subsidy', ver:VER, crm:!!env.CRM, leads }), {headers:{'Content-Type':'application/json'}});
    }
    if (url.pathname === '/api/lead' && request.method === 'POST') {
      try {
        const b = await request.json();
        // honeypot:隱藏欄位有值=機器人,回空結果不入庫不通知
        if (b.hp) return new Response(JSON.stringify({ok:true,matches:{high:[],mid:[],future:[]},total_amount:0}),{headers:{'Content-Type':'application/json'}});
        const contact = String(b.contact||'').trim().slice(0,120);
        if (!contact) return new Response(JSON.stringify({ok:false,err:'no contact'}),{status:400,headers:{'Content-Type':'application/json'}});
        if (!/^09\d{8}$/.test(contact) && !/^@?[A-Za-z0-9._-]{2,30}$/.test(contact))
          return new Response(JSON.stringify({ok:false,err:'contact_format'}),{status:400,headers:{'Content-Type':'application/json'}});
        const stage = String(b.stage||'').slice(0,20), biz = String(b.biz||'').slice(0,20);
        const needsArr = Array.isArray(b.needs)? b.needs.map(String).slice(0,10) : [];
        const ipRaw = request.headers.get('cf-connecting-ip')||'';
        const ipBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ipRaw));
        const ipHash = [...new Uint8Array(ipBuf)].slice(0,8).map(x=>x.toString(16).padStart(2,'0')).join('');
        await ensureTable(env);
        // rate limit:同 IP 每日 20 筆(無 KV binding,直接以 D1 計數)
        if (env.CRM) {
          const rl = await env.CRM.prepare("SELECT COUNT(*) n FROM ai_subsidy_leads WHERE ip_hash=? AND created_at >= datetime('now','-1 day')").bind(ipHash).first().catch(()=>null);
          if (rl && rl.n >= 20) return new Response(JSON.stringify({ok:false,err:'rate_limited'}),{status:429,headers:{'Content-Type':'application/json'}});
        }
        const { matches, total_amount } = matchSubsidies({ stage, biz, needs: needsArr });
        if (env.CRM) {
          ctx.waitUntil(env.CRM.prepare("INSERT INTO ai_subsidy_leads (contact,stage,biz,needs,ip_hash,ua,matched_json,total_amount) VALUES (?,?,?,?,?,?,?,?)")
            .bind(contact,stage,biz,needsArr.join(',').slice(0,200),ipHash,(request.headers.get('user-agent')||'').slice(0,150),JSON.stringify(matches),total_amount).run().catch(e=>console.error('[ai-subsidy] insert',e.message)));
        }
        // 省 LINE 免費額度(200 則/月):只在有高適配時 push
        if (matches.high.length > 0) {
          ctx.waitUntil(notifyAdmin(env, { stage, biz, needs: needsArr, contact, matches, total_amount }));
        }
        return new Response(JSON.stringify({ok:true,matches,total_amount}),{headers:{'Content-Type':'application/json'}});
      } catch(e) { return new Response(JSON.stringify({ok:false}),{status:400,headers:{'Content-Type':'application/json'}}); }
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      // v1.1 訪問追蹤:寫 social_events(與 launch-plan 同表,utm 可比),失敗不影響頁面
      if (env.CRM) {
        ctx.waitUntil((async()=>{
          try {
            const ipRaw = request.headers.get('cf-connecting-ip')||'';
            const ipBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ipRaw));
            const ipHash = [...new Uint8Array(ipBuf)].slice(0,8).map(x=>x.toString(16).padStart(2,'0')).join('');
            await env.CRM.prepare("INSERT INTO social_events (utm_source,utm_medium,utm_campaign,utm_content,event_type,ip_hash,referrer) VALUES (?,?,?,?,'visit',?,?)")
              .bind(url.searchParams.get('utm_source')||'direct', url.searchParams.get('utm_medium')||'', url.searchParams.get('utm_campaign')||'ai-subsidy', url.searchParams.get('utm_content')||'', ipHash, (request.headers.get('referer')||'').slice(0,200)).run();
          } catch(e) { console.error('[ai-subsidy] visit log', e.message); }
        })());
      }
      return new Response(PAGE, {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=300'}});
    }
    return Response.redirect(url.origin + '/', 302);
  },
};
