// SeasonalHero.jsx — 1080×878. Seasonal campaign banner with full-bleed photo.
// Big season character + headline overlay + brand signature.
function SeasonalHero({ width = 1080, height = 878, season = 'spring' }) {
  const seasons = {
    spring: {
      photo: window.__resources.ph_tea_leaves,
      char: '春', en: 'SPRING',
      headline: '春季入駐 · 新品牌登場',
      sub: 'TAIPEI · 2026 · 4 WORKSHOPS',
      tag: 'NO. 01 · 季度規劃',
    },
    summer: {
      photo: window.__resources.ph_bamboo_steamer,
      char: '夏', en: 'SUMMER',
      headline: '夏日專案 · 在地夏味',
      sub: 'NANTOU · 2026 · 6 BRANDS',
      tag: 'NO. 02 · 季度規劃',
    },
    autumn: {
      photo: window.__resources.ph_osmanthus,
      char: '秋', en: 'AUTUMN',
      headline: '秋季特輯 · 桂花滿地',
      sub: 'YUNLIN · 2026 · 5 STORIES',
      tag: 'NO. 03 · 季度規劃',
    },
    winter: {
      photo: window.__resources.ph_red_bean_bowl,
      char: '冬', en: 'WINTER',
      headline: '冬至圍爐 · 年終孵化',
      sub: 'TAIPEI · 2026 · 4 LAUNCHES',
      tag: 'NO. 04 · 季度規劃',
    },
  };
  const s = seasons[season] || seasons.spring;
  const sc = (n) => `${(n / 1080) * width}px`;
  return (
    <div style={{
      width, height, position: 'relative', overflow: 'hidden',
      background: 'var(--color-black)',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${s.photo})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'saturate(0.85) contrast(1.05)',
      }}/>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0) 30%, rgba(10,10,10,0.72) 100%)',
      }}/>
      <div style={{
        position: 'absolute', top: sc(48), left: sc(56),
        display: 'flex', flexDirection: 'column', gap: sc(8),
      }}>
        <div style={{
          fontFamily: 'var(--font-serif)', fontWeight: 300,
          fontSize: sc(180), lineHeight: 0.9, color: 'var(--color-gold)',
          letterSpacing: '0.05em',
        }}>{s.char}</div>
        <div style={{
          fontFamily: 'var(--font-sans)', fontWeight: 300,
          fontSize: sc(13), letterSpacing: '0.4em',
          color: 'var(--color-paper)', textTransform: 'uppercase',
        }}>{s.en}</div>
      </div>
      <div style={{
        position: 'absolute', top: sc(48), right: sc(56),
        fontFamily: 'var(--font-sans)', fontWeight: 300,
        fontSize: sc(11), letterSpacing: '0.35em',
        color: 'var(--color-gold)', textTransform: 'uppercase',
      }}>{s.tag}</div>
      <div style={{
        position: 'absolute', bottom: sc(80), left: sc(56),
        display: 'flex', flexDirection: 'column', gap: sc(20),
      }}>
        <div style={{
          width: sc(60), height: 1, background: 'var(--color-gold)',
        }}/>
        <div style={{
          fontFamily: 'var(--font-serif)', fontWeight: 300,
          fontSize: sc(42), lineHeight: 1.3, letterSpacing: '0.12em',
          color: 'var(--color-paper)',
        }}>{s.headline}</div>
        <div style={{
          fontFamily: 'var(--font-sans)', fontWeight: 300,
          fontSize: sc(11), letterSpacing: '0.3em',
          color: 'rgba(245,242,236,0.7)', textTransform: 'uppercase',
        }}>{s.sub}</div>
      </div>
      <div style={{
        position: 'absolute', bottom: sc(48), right: sc(56),
        fontFamily: 'var(--font-serif)', fontWeight: 300,
        fontSize: sc(20), letterSpacing: '0.25em',
        color: 'rgba(245,242,236,0.85)',
      }}>3Q · @121LKSPE</div>
    </div>
  );
}
window.SeasonalHero = SeasonalHero;
