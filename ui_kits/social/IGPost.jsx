// IGPost.jsx — 1080x1350 (4:5). Top photo, bottom 320px type bar.
function IGPost({ width = 360, photo = 'assets/photography/still-bowl-rice.svg', eyebrow = 'NO. 01', title = '本月入駐', sub = '阿婆雜貨店' }) {
  const ratio = width / 1080;
  const height = 1350 * ratio;
  const s = (n) => `${n * ratio}px`;
  const typeBar = 320 * ratio;

  return (
    <div style={{ width, height, background: 'var(--color-paper)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        flex: 1,
        backgroundImage: `url(../../${photo})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'saturate(0.85) contrast(1.05)',
      }}/>
      <div style={{
        height: typeBar,
        padding: `${s(36)} ${s(48)}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        textAlign: 'center',
      }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: s(18), letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--color-gold)' }}>{eyebrow}</div>
        <div>
          <div style={{ width: s(40), height: 1, background: 'var(--color-gold)', margin: `${s(8)} auto ${s(20)}` }}/>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: s(48), lineHeight: 1.3, letterSpacing: '0.15em', color: 'var(--color-black)' }}>{title}</div>
          <div style={{ marginTop: s(8), fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: s(28), lineHeight: 1.3, letterSpacing: '0.15em', color: 'var(--color-ink)' }}>{sub}</div>
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: s(14), letterSpacing: '0.3em', color: 'var(--color-stone)' }}>3Q · BRAND HATCHERY</div>
      </div>
    </div>
  );
}

window.IGPost = IGPost;
