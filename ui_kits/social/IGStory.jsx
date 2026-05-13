// IGStory.jsx — 1080x1920. Full-bleed photo + bottom 200px paper strip.
function IGStory({ width = 260, photo = 'assets/photography/cupped-palm-light.svg', line = '被照亮，被托住' }) {
  const ratio = width / 1080;
  const height = 1920 * ratio;
  const s = (n) => `${n * ratio}px`;
  const strip = 200 * ratio;

  return (
    <div style={{ width, height, background: '#0A0A0A', position: 'relative' }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(../../${photo})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'saturate(0.85) contrast(1.08)',
      }}/>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: strip,
        background: 'var(--color-paper)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `0 ${s(56)}`,
      }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: s(40), letterSpacing: '0.15em', color: 'var(--color-black)' }}>{line}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: s(16) }}>
          <div style={{ width: s(40), height: 1, background: 'var(--color-gold)' }}/>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: s(16), letterSpacing: '0.3em', color: 'var(--color-stone)' }}>3Q</div>
        </div>
      </div>
    </div>
  );
}

window.IGStory = IGStory;
