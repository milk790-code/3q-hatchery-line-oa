// social-launch-views.jsx — sections for ui_kits/social/launch.html.

const SS = window.SOCIAL_SPECS;
const root = (id, el) => { const n = document.getElementById(id); if (n) ReactDOM.createRoot(n).render(el); };
const text = (id, t) => { const n = document.getElementById(id); if (n) n.textContent = t; };

text('ig-handle',  SS.instagram.handle);
text('ig-cadence', SS.instagram.feedPost.cadence);
text('th-handle',  SS.threads.handle);
text('th-cadence', SS.threads.cadence);
text('tt-handle',  SS.tiktok.handle);
text('tt-cadence', SS.tiktok.cadence);

function CopyBtn({ getText }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button className={`paste-copy ${copied ? 'copied' : ''}`} onClick={async () => {
      try { await navigator.clipboard.writeText(getText()); } catch(e) {}
      setCopied(true); setTimeout(() => setCopied(false), 1200);
    }}>{copied ? '已複製' : '複製'}</button>
  );
}

function Paste({ label, text, max }) {
  const count = (text || '').length;
  return (
    <div className="paste">
      <div className="paste-head">
        <span className="paste-label">{label}</span>
        <span className="paste-count">{count}{max ? ` / ${max}` : ''} 字</span>
      </div>
      <CopyBtn getText={() => text}/>
      {text}
    </div>
  );
}

function SpecCard({ preview, meta }) {
  return (
    <div className="speccard">
      <div className="prev">{preview}</div>
      <dl>
        {meta.map((m, i) => (
          <React.Fragment key={i}>
            <dt>{m.k}</dt>
            <dd className={m.note ? 'note' : ''}>{m.v}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}

// ===== IG =====
function IG() {
  const ig = SS.instagram;
  return (
    <>
      <Paste label="BIO · 150 字內" text={ig.bio} max={150}/>

      <SpecCard
        preview={<div style={{transform: 'scale(0.55)', transformOrigin: 'center', lineHeight: 0}}><IGPost width={300}/></div>}
        meta={[
          { k: 'ASSET',    v: 'Feed Post' },
          { k: 'SPEC',     v: ig.feedPost.spec },
          { k: 'FILE',     v: ig.feedPost.filename },
          { k: 'TEMPLATE', v: ig.feedPost.template },
          { k: 'CADENCE',  v: ig.feedPost.cadence, note: true },
        ]}
      />

      <SpecCard
        preview={<div style={{transform: 'scale(0.55)', transformOrigin: 'center', lineHeight: 0}}><IGStory width={220}/></div>}
        meta={[
          { k: 'ASSET',    v: 'Story' },
          { k: 'SPEC',     v: ig.story.spec },
          { k: 'FILE',     v: ig.story.filename },
          { k: 'TEMPLATE', v: ig.story.template },
          { k: 'NOTE',     v: ig.story.note, note: true },
          { k: 'CADENCE',  v: ig.story.cadence, note: true },
        ]}
      />

      <div>
        <div style={{fontSize:9, letterSpacing:'0.35em', textTransform:'uppercase', color:'var(--color-gold)', marginBottom: 16}}>HIGHLIGHT COVERS · 6 個</div>
        <div className="highlights">
          {ig.highlightCovers.covers.map((h) => (
            <div key={h.id} className="hl-cover">
              <img src={`../../assets/icons/${h.icon}.svg`} alt={h.label}/>
              <div className="zh">{h.label}</div>
              <div className="en">{h.en}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop: 12, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(245,242,236,0.5)', fontFamily: 'ui-monospace, monospace'}}>{ig.highlightCovers.spec}</div>
      </div>

      <Paste label="貼文 CAPTION 模板" text={ig.captionTemplate}/>
      <Paste label="HASHTAGS · 每篇貼 3 行" text={ig.tags}/>
    </>
  );
}
root('ig-body', <IG/>);

// ===== Threads =====
function Threads() {
  const th = SS.threads;
  return (
    <>
      <Paste label="BIO" text={th.bio}/>

      <SpecCard
        preview={<div style={{transform: 'scale(0.55)', transformOrigin: 'center', lineHeight: 0}}><ThreadsPost width={300}/></div>}
        meta={[
          { k: 'TYPE',     v: th.postFormat.type },
          { k: 'MAX',      v: `${th.postFormat.maxChars} 字` },
          { k: 'TEMPLATE', v: th.postFormat.template, note: true },
          { k: 'CADENCE',  v: th.cadence, note: true },
        ]}
      />

      <div>
        <div style={{fontSize:9, letterSpacing:'0.35em', textTransform:'uppercase', color:'var(--color-gold)', marginBottom: 16}}>4 篇手記範本 · 直接複製</div>
        <div className="th-examples">
          {th.postFormat.examples.map((ex, i) => (
            <div key={i} className="th-card">
              <div className="h">{ex.title}</div>
              <div className="t">{ex.text}</div>
              <div style={{marginTop: 14, display: 'flex', justifyContent: 'flex-end'}}>
                <CopyBtn getText={() => ex.text}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
root('th-body', <Threads/>);

// ===== TikTok =====
function TikTok() {
  const tt = SS.tiktok;
  return (
    <>
      <Paste label="BIO" text={tt.bio}/>

      <SpecCard
        preview={<div style={{transform: 'scale(0.55)', transformOrigin: 'center', lineHeight: 0}}><TikTokCover width={220}/></div>}
        meta={[
          { k: 'ASSET',    v: 'Cover · per episode' },
          { k: 'SPEC',     v: tt.cover.spec },
          { k: 'FILE',     v: tt.cover.filename },
          { k: 'TEMPLATE', v: tt.cover.template },
          { k: 'NOTE',     v: tt.cover.note, note: true },
        ]}
      />

      <Paste label="CAPTION 模板" text={tt.captionTemplate}/>

      <div>
        <div style={{fontSize:9, letterSpacing:'0.35em', textTransform:'uppercase', color:'var(--color-gold)', marginBottom: 12}}>EPISODE 排程 · 每兩週一支</div>
        <div className="eps">
          {tt.episodes.map((ep) => (
            <div key={ep.ep} className="ep-row">
              <div className="ep-no">EP. {ep.ep}</div>
              <div className="ep-title">{ep.title}</div>
              <div className="ep-meta">{ep.cover}</div>
              <div className="ep-meta">釋出 D+{ep.releaseDay}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
root('tt-body', <TikTok/>);

// ===== Checklist =====
function Checklist() {
  const [items, setItems] = React.useState(SS.checklist);
  const total = items.length;
  const done = items.filter(x => x.done).length;
  const toggle = (id) => setItems(prev => prev.map(x => x.id === id ? { ...x, done: !x.done } : x));
  return (
    <>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 4}}>
        <div style={{fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(245,242,236,0.5)'}}>進度</div>
        <div style={{fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 24, color: 'var(--color-gold)'}}>{done} / {total}</div>
      </div>
      <div className="checklist">
        {items.map((it) => (
          <div key={it.id} className={`ck-row ${it.done ? 'done' : ''}`} onClick={() => toggle(it.id)}>
            <div className="ck-mark"/>
            <div className="ck-label">{it.label}</div>
            <div className="ck-detail">{it.detail}</div>
            <div className="ck-stat">{it.done ? '已完成' : '待辦'}</div>
          </div>
        ))}
      </div>
    </>
  );
}
root('ck-body', <Checklist/>);
