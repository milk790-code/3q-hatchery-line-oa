// LuckyBag.jsx — 1040×1040. Daily lucky bag image with time-of-day variant.
// Full-bleed AI photo + brand overlay (time stamp, eyebrow, gold accent).
function LuckyBag({ width = 1040, height = 1040, time = 'main' }) {
  const sc = (n) => `${(n / 1040) * width}px`;
  const tags = {
    main:    { photo: window.__resources.ph_bag_main,    big: '福', label: '今日福袋', time: 'DAILY · 04 SLOTS' },
    morning: { photo: window.__resources.ph_bag_morning, big: '晨', label: '晨光福袋', time: '07:30 · MORNING' },
    noon:    { photo: window.__resources.ph_bag_noon,    big: '午', label: '午陽福袋', time: '12:30 · NOON' },
    evening: { photo: window.__resources.ph_bag_evening, big: '暮', label: '暮色福袋', time: '18:30 · DUSK' },
    night:   { photo: window.__resources.ph_bag_night,   big: '夜', label: '月光福袋', time: '22:00 · NIGHT' },
  };
  const t = tags[time] || tags.main;
  return (
    <div style={{
      width, height, position: 'relative', overflow: 'hidden',
      background: 'var(--color-black)',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${t.photo})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'saturate(0.85) contrast(1.05)',
      }}/>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0) 30%, rgba(10,10,10,0) 60%, rgba(10,10,10,0.8) 100%)',
      }}/>

      {/* Top-left eyebrow */}
      <div style={{
        position: 'absolute', top: sc(48), left: sc(48),
        fontFamily: 'var(--font-sans)', fontWeight: 300,
        fontSize: sc(11), letterSpacing: '0.4em',
        color: 'var(--color-gold)', textTransform: 'uppercase',
      }}>3Q · LUCKY BAG</div>

      {/* Top-right time stamp */}
      <div style={{
        position: 'absolute', top: sc(48), right: sc(48),
        fontFamily: 'var(--font-sans)', fontWeight: 300,
        fontSize: sc(10), letterSpacing: '0.35em',
        color: 'var(--color-paper)', textTransform: 'uppercase', opacity: 0.85,
      }}>{t.time}</div>

      {/* Bottom-left brand + headline */}
      <div style={{
        position: 'absolute', bottom: sc(72), left: sc(48),
        display: 'flex', flexDirection: 'column', gap: sc(16),
      }}>
        <div style={{
          fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 300,
          fontSize: sc(140), lineHeight: 0.9, color: 'var(--color-gold)',
          letterSpacing: '0.02em',
        }}>{t.big}</div>
        <div style={{ width: sc(48), height: 1, background: 'var(--color-gold)' }}/>
        <div style={{
          fontFamily: 'var(--font-serif)', fontWeight: 300,
          fontSize: sc(36), letterSpacing: '0.12em',
          color: 'var(--color-paper)',
        }}>{t.label}</div>
        <div style={{
          fontFamily: 'var(--font-sans)', fontWeight: 300,
          fontSize: sc(11), letterSpacing: '0.3em',
          color: 'rgba(245,242,236,0.7)', textTransform: 'uppercase',
        }}>每天四點 · 限量驚喜</div>
      </div>

      {/* Bottom-right signature */}
      <div style={{
        position: 'absolute', bottom: sc(48), right: sc(48),
        fontFamily: 'var(--font-serif)', fontWeight: 300,
        fontSize: sc(18), letterSpacing: '0.25em',
        color: 'rgba(245,242,236,0.85)',
      }}>3Q · @121LKSPE</div>
    </div>
  );
}
window.LuckyBag = LuckyBag;
