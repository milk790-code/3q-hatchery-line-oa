// ThreadsPost.jsx — 1080x1350. Text-dominant card, no photo. Single gold hairline.
function ThreadsPost({ width = 360, eyebrow = 'NO. 04', body = '一張像樣的照片，\n是一間店被陌生人\n看見的第一個機會。', meta = '— 孵化所手記' }) {
  const ratio = width / 1080;
  const height = 1350 * ratio;
  const s = (n) => `${n * ratio}px`;

  return (
    <div style={{
      width, height,
      background: 'var(--color-paper)',
      padding: `${s(96)} ${s(80)}`,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: s(20), letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--color-gold)' }}>{eyebrow}</div>
      <div>
        <div style={{ width: s(80), height: 1, background: 'var(--color-gold)', marginBottom: s(40) }}/>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: s(56), lineHeight: 1.5, letterSpacing: '0.12em', color: 'var(--color-black)' }}>
          {body.split('\n').map((l,i) => <span key={i} style={{display:'block'}}>{l}</span>)}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: s(18), letterSpacing: '0.25em', color: 'var(--color-stone)' }}>{meta}</div>
    </div>
  );
}

window.ThreadsPost = ThreadsPost;
