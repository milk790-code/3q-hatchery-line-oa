// launch-views.jsx — section renderers for ui_kits/line_oa/launch.html.
// All copy comes from window.LINE_SPECS. Each renderer mounts to its `*-body` div.

const SP = window.LINE_SPECS;
const root = (id, el) => {
  const node = document.getElementById(id);
  if (node) ReactDOM.createRoot(node).render(el);
};

// =============================================================
// Atoms
// =============================================================

function CopyButton({ getText }) {
  const [copied, setCopied] = React.useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };
  return (
    <button className={`paste-copy ${copied ? 'copied' : ''}`} onClick={onClick}>
      {copied ? '已複製' : '複製'}
    </button>
  );
}

function Paste({ label, text, max }) {
  const count = (text || '').length;
  return (
    <div className="paste">
      <div className="paste-head">
        <span className="label">{label}</span>
        <span className="count">{count}{max ? ` / ${max}` : ''} 字</span>
      </div>
      <CopyButton getText={() => text}/>
      {text}
    </div>
  );
}

function SpecCard({ preview, meta }) {
  return (
    <div className="speccard">
      <div className="preview">{preview}</div>
      <div className="spec-meta">
        <dl>
          {meta.map((row, i) => (
            <React.Fragment key={i}>
              <dt>{row.k}</dt>
              <dd className={row.note ? 'note' : ''}>{row.v}</dd>
            </React.Fragment>
          ))}
        </dl>
      </div>
    </div>
  );
}

// =============================================================
// Section 00 — Checklist
// =============================================================
function Checklist() {
  const [items, setItems] = React.useState(SP.checklist);
  const total = items.length;
  const done = items.filter(x => x.done).length;
  const toggle = (id) => setItems((prev) => prev.map(x => x.id === id ? { ...x, done: !x.done } : x));
  return (
    <>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8, marginTop: 12}}>
        <div style={{fontSize:10, letterSpacing:'0.3em', color:'rgba(245,242,236,0.5)', textTransform:'uppercase'}}>進度</div>
        <div style={{fontFamily:'var(--font-serif)', fontWeight:300, fontStyle:'italic', fontSize:24, color:'var(--color-gold)'}}>{done} / {total}</div>
      </div>
      <div className="checklist">
        {items.map((it) => (
          <div key={it.id} className={`ck-row ${it.done ? 'done' : ''}`} onClick={() => toggle(it.id)} style={{cursor:'pointer'}}>
            <div className="ck-mark"/>
            <div className="ck-label">{it.label}</div>
            <div className="ck-detail">{it.detail}</div>
            <div className="ck-status">{it.done ? '已完成' : '待辦'}</div>
          </div>
        ))}
      </div>
    </>
  );
}
root('checklist-mount', <Checklist/>);

// =============================================================
// Section 01 — Profile
// =============================================================
function ProfileSection() {
  const a = SP.account;
  return (
    <>
      <SpecCard
        preview={<Avatar size={200}/>}
        meta={[
          { k: 'ASSET',    v: 'Avatar' },
          { k: 'SPEC',     v: SP.avatar.spec },
          { k: 'FILE',     v: SP.avatar.filename },
          { k: 'UPLOAD',   v: '設定 → 帳號管理 → 基本資料 → 大頭照' },
          { k: 'NOTE',     v: SP.avatar.note, note: true },
        ]}
      />
      <SpecCard
        preview={<div style={{transform: 'scale(0.42)', transformOrigin: 'center', lineHeight:0}}><CoverImage width={1080} height={878} photo="bowl"/></div>}
        meta={[
          { k: 'ASSET',    v: 'Cover' },
          { k: 'SPEC',     v: SP.cover.spec },
          { k: 'FILE',     v: SP.cover.filename },
          { k: 'UPLOAD',   v: '設定 → 帳號管理 → 基本資料 → 封面照片' },
          { k: 'NOTE',     v: SP.cover.note, note: true },
        ]}
      />

      <div className="twocol">
        <Paste label="帳號名稱 DISPLAY NAME" text={a.displayName} max={40}/>
        <Paste label="狀態消息 STATUS · 上限 20 字" text={a.statusMessage} max={20}/>
      </div>

      <Paste label="關於 ABOUT" text={a.about}/>
    </>
  );
}
root('profile-body', <ProfileSection/>);

// =============================================================
// Section 02 — Greeting
// =============================================================
function GreetingSection() {
  return (
    <>
      <div style={{display:'flex', gap: 28, alignItems:'flex-start'}}>
        <div style={{flexShrink:0}}>
          <div style={{background:'#1F1A12', padding:20}}>
            <WelcomeCard width={280}/>
          </div>
          <div style={{marginTop:10, fontSize:9, letterSpacing:'0.25em', textTransform:'uppercase', color:'rgba(245,242,236,0.5)'}}>圖卡 · 1040 × 1040</div>
        </div>
        <div style={{flex:1, display:'flex', flexDirection:'column', gap: 18}}>
          <Paste label="開始訊息 · GREETING TEXT" text={SP.greeting.text} max={500}/>
          <div style={{fontSize:11, lineHeight:1.85, letterSpacing:'0.05em', color:'rgba(245,242,236,0.55)'}}>
            <strong style={{color:'var(--color-gold)', fontWeight:400, letterSpacing:'0.2em', fontSize:9, textTransform:'uppercase', display:'block', marginBottom:6}}>後台路徑</strong>
            主頁 → 自動回應訊息 → 加入好友的歡迎訊息 (Greeting message)<br/>
            建議組合：<em style={{fontStyle:'italic', color:'rgba(245,242,236,0.85)'}}>1 張圖卡 + 1 段文字</em>。
          </div>
        </div>
      </div>
    </>
  );
}
root('greeting-body', <GreetingSection/>);

// =============================================================
// Section 03 — Rich Menu with tap zones
// =============================================================
function RichMenuDiagram() {
  const W = 700;
  const ratio = W / 2500;
  const H = 1686 * ratio;

  return (
    <div className="tapdiagram">
      <div className="img-wrap" style={{width: W, height: H, position:'relative'}}>
        <RichMenu width={W}/>
        <svg className="zones" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          {SP.richMenu.tapZones.map((z) => (
            <rect
              key={z.id}
              className="zone"
              x={z.x * ratio + 1}
              y={z.y * ratio + 1}
              width={z.w * ratio - 2}
              height={z.h * ratio - 2}
            >
              <title>{z.id} · {z.zh}</title>
            </rect>
          ))}
        </svg>
        {SP.richMenu.tapZones.map((z) => (
          <div
            key={z.id}
            className="zlabel"
            style={{
              left: (z.x + 16) * ratio,
              top:  (z.y + 16) * ratio,
            }}
          >{z.id} · {z.label}</div>
        ))}
      </div>
    </div>
  );
}

function RichMenuSection() {
  const rm = SP.richMenu;
  return (
    <>
      <SpecCard
        preview={<RichMenuDiagram/>}
        meta={[
          { k: 'ASSET',    v: 'Rich Menu' },
          { k: 'SPEC',     v: rm.spec },
          { k: 'FILE',     v: rm.filename },
          { k: 'LAYOUT',   v: rm.layout },
          { k: 'UPLOAD',   v: '主頁 → 圖文選單 → 建立 → 大型 6 格範本 → 自訂' },
        ]}
      />

      <div style={{fontSize: 11, letterSpacing:'0.3em', textTransform:'uppercase', color:'var(--color-gold)', marginTop:8}}>TAP ZONES · 5 個按鈕對應</div>
      <div className="ar-list" style={{marginTop:-12}}>
        {rm.tapZones.map((z) => (
          <div key={z.id} className="ar-row" style={{gridTemplateColumns: '80px 200px 1fr'}}>
            <div style={{fontFamily:'var(--font-serif)', fontStyle:'italic', fontSize:20, color:'var(--color-gold)', letterSpacing:'0.1em'}}>{z.id}</div>
            <div>
              <div style={{fontFamily:'var(--font-serif)', fontWeight:300, fontSize:17, letterSpacing:'0.12em', color:'var(--color-paper)'}}>{z.zh}</div>
              <div style={{fontSize:9, letterSpacing:'0.25em', textTransform:'uppercase', color:'rgba(245,242,236,0.4)', marginTop:4, fontFamily:'ui-monospace, monospace'}}>
                ({z.x}, {z.y}) · {z.w}×{z.h}
              </div>
            </div>
            <div style={{fontSize:12, lineHeight:1.7, color:'rgba(245,242,236,0.85)', letterSpacing:'0.04em'}}>
              <div style={{fontSize:9, letterSpacing:'0.3em', color:'rgba(245,242,236,0.45)', textTransform:'uppercase', marginBottom:4}}>ACTION · {z.action.type}</div>
              {z.action.type === 'uri'
                ? <code style={{fontFamily:'ui-monospace, monospace', color:'var(--color-gold)'}}>{z.action.uri}</code>
                : <span>送出訊息：<em style={{fontStyle:'italic'}}>「{z.action.text}」</em></span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
root('richmenu-body', <RichMenuSection/>);

// =============================================================
// Section 04 — Auto replies
// =============================================================
function AutoReplySection() {
  return (
    <>
      <p style={{fontSize:12, lineHeight:1.85, color:'rgba(245,242,236,0.7)', letterSpacing:'0.05em', margin:0}}>
        後台路徑：主頁 → 自動回應訊息 → 關鍵字回應。<br/>
        以下 6 組已經寫好，照順序貼上即可。
      </p>
      <div className="ar-list">
        {SP.autoReplies.map((ar, i) => (
          <div key={i} className="ar-row">
            <div className="ar-keys">
              {ar.keywords.map((k, j) => <span key={j} className="ar-key">{k}</span>)}
            </div>
            <div className="ar-reply">{ar.response}</div>
          </div>
        ))}
      </div>
    </>
  );
}
root('autoreply-body', <AutoReplySection/>);

// =============================================================
// Section 05 — Carousel push
// =============================================================
function CarouselSection() {
  const cp = SP.carouselPush;
  return (
    <>
      <SpecCard
        preview={
          <div className="carousel-row" style={{width:'100%'}}>
            {cp.cards.map((c, i) => (
              <CarouselCard
                key={i}
                width={140}
                photo={[window.__resources.ph_bowl,window.__resources.ph_ink,window.__resources.ph_stalk,window.__resources.ph_linen][i]}
                eyebrow={c.eyebrow}
                title={<span>{c.title.split('\n').map((l,j) => <span key={j} style={{display:'block'}}>{l}</span>)}</span>}
                meta={c.meta}
              />
            ))}
          </div>
        }
        meta={[
          { k: 'TYPE',    v: 'LINE Card Carousel' },
          { k: 'CARDS',   v: `${cp.cards.length} cards · 1040 × 1040 ea.` },
          { k: 'TITLE',   v: cp.title },
          { k: 'UPLOAD',  v: '主頁 → 群發訊息 → 建立 → 圖片輪播' },
        ]}
      />

      <div style={{fontSize: 11, letterSpacing:'0.3em', textTransform:'uppercase', color:'var(--color-gold)'}}>CARD ACTIONS · 點擊 → 送出文字</div>
      <div className="ar-list">
        {cp.cards.map((c, i) => (
          <div key={i} className="ar-row" style={{gridTemplateColumns: '60px 1fr 1fr'}}>
            <div style={{fontFamily:'var(--font-serif)', fontStyle:'italic', fontSize:18, color:'var(--color-gold)'}}>{c.eyebrow.replace('NO. ','')}</div>
            <div style={{fontFamily:'var(--font-serif)', fontWeight:300, fontSize:15, letterSpacing:'0.1em', color:'var(--color-paper)', whiteSpace:'pre-line'}}>{c.title}</div>
            <div style={{fontSize:12, color:'rgba(245,242,236,0.85)', fontStyle:'italic'}}>「{c.action.text}」</div>
          </div>
        ))}
      </div>
    </>
  );
}
root('carousel-body', <CarouselSection/>);

// =============================================================
// Section 06 — Away message
// =============================================================
function AwaySection() {
  return (
    <>
      <Paste label="非營業時間訊息 · AWAY MESSAGE" text={SP.awayMessage.text}/>
      <div style={{fontSize:11, lineHeight:1.85, letterSpacing:'0.05em', color:'rgba(245,242,236,0.55)'}}>
        <strong style={{color:'var(--color-gold)', fontWeight:400, letterSpacing:'0.2em', fontSize:9, textTransform:'uppercase', display:'block', marginBottom:6}}>後台路徑</strong>
        主頁 → 自動回應訊息 → 一般回應訊息 → 啟用「使用回應時間設定」<br/>
        建議：每週一至五 10:00-19:00 為營業時間，其餘自動回 away message。
      </div>
    </>
  );
}
root('away-body', <AwaySection/>);

// =============================================================
// Section 07 — Live preview
// =============================================================
function PreviewSection() {
  return (
    <>
      <p style={{fontSize:12, lineHeight:1.85, color:'rgba(245,242,236,0.7)', letterSpacing:'0.05em', margin:'0 0 8px'}}>
        這是新用戶第一次加入帳號看到的第一屏：Welcome 圖卡 + Greeting 文字。
        三秒內要讓他知道「這裡的人會聽我說話」。
      </p>

      <div style={{display:'flex', gap:32, alignItems:'flex-start'}}>
        <div className="phone-mini">
          <div className="notch"/>
          <div className="line-frame">
            <div className="line-top">
              <span style={{fontSize:10}}>‹</span>
              <div className="line-top-c">
                <div style={{width:24, height:24, borderRadius:'50%', overflow:'hidden', flexShrink:0}}>
                  <Avatar size={24}/>
                </div>
                <div className="line-top-name">3Q貢丸</div>
              </div>
              <span style={{fontSize:10}}>≡</span>
            </div>
            <div className="line-msgs">
              <div className="line-day"><span>今天</span></div>
              <div className="line-card"><WelcomeCard width={232}/></div>
              <div className="line-bubble in">{SP.greeting.text}</div>
              <div className="line-bubble out">我想說說我的店</div>
              <div className="line-bubble in">{SP.autoReplies[0].response}</div>
            </div>
          </div>
        </div>

        <div style={{flex:1, display:'flex', flexDirection:'column', gap:16, paddingTop:16}}>
          <div style={{fontSize:11, letterSpacing:'0.3em', textTransform:'uppercase', color:'var(--color-gold)'}}>VOICE QA · 上線前最後一道</div>
          <ul style={{margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:14}}>
            {[
              '每一句都用「你」， 不要「您」',
              '不出現驚嘆號',
              '不用 emoji（除了 Greeting 的 👉 指引箭頭，這是唯一例外）',
              '所有數字 (500 / 24h / 6 cells) 不放在標題',
              '所有 CTA 是「邀請」，不是「服務分類」',
              'Rich Menu 5 個按鈕 + Carousel 4 張卡，全部點過一次',
            ].map((t, i) => (
              <li key={i} style={{display:'grid', gridTemplateColumns:'18px 1fr', gap:12, alignItems:'flex-start'}}>
                <span style={{width:6, height:1, background:'var(--color-gold)', marginTop:9}}/>
                <span style={{fontSize:13, lineHeight:1.7, letterSpacing:'0.05em', color:'rgba(245,242,236,0.85)'}}>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
root('preview-body', <PreviewSection/>);
