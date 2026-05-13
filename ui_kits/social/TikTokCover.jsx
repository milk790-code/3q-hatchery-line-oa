// TikTokCover.jsx — 1080x1920. Title in upper third (clear of TikTok UI), photo dominates lower 60%, left-aligned.
function TikTokCover({ width = 260, photo = 'assets/photography/rice-stalk.svg', title = '一束稻\n一個故事', meta = 'EP. 03 · 工坊' }) {
  const ratio = width / 1080;
  const height = 1920 * ratio;
  const s = (n) => `${n * ratio}px`;

  return (
    <div style={{ width, height, background: '#0A0A0A', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(../../${photo})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'saturate(0.8) contrast(1.1)',
      }}/>
      {/* protection gradient — top */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.15) 32%, transparent 50%)',
      }}/>
      <div style={{
        position: 'absolute', top: s(120), left: s(56), right: s(56),
        color: 'var(--color-paper)',
      }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: s(20), letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--color-gold)' }}>{meta}</div>
        <div style={{ width: s(40), height: 1, background: 'var(--color-gold)', margin: `${s(20)} 0 ${s(28)}` }}/>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: s(72), lineHeight: 1.2, letterSpacing: '0.12em' }}>
          {title.split('\n').map((l,i) => <span key={i} style={{display:'block'}}>{l}</span>)}
        </div>
      </div>
      {/* Bottom-right logo small */}
      <div style={{
        position: 'absolute', bottom: s(120), right: s(56),
        fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: s(22), letterSpacing: '0.2em', color: 'var(--color-paper)',
      }}>3Q</div>
    </div>
  );
}

window.TikTokCover = TikTokCover;
