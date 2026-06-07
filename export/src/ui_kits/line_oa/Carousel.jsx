// Carousel.jsx — 1040x1040 cards in a 3+ series.
// Locked structure: 70% photo / 30% type. Color-grade LUT applied uniformly.
function CarouselCard({ width = 400, photo, eyebrow, title, meta }) {
  const ratio = width / 1040;
  const height = 1040 * ratio;
  const s = (n) => `${n * ratio}px`;
  const photoH = height * 0.7;

  return (
    <div style={{
      width, height,
      background: 'var(--color-paper)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flex: '0 0 auto',
    }}>
      <div style={{
        height: photoH,
        backgroundImage: `url(${photo})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        // simulated LUT — applied via blend layer in production
        filter: 'saturate(0.85) contrast(1.05)',
      }}/>
      <div style={{
        flex: 1,
        padding: `${s(40)} ${s(48)}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-sans)', fontWeight: 300,
            fontSize: s(20), letterSpacing: '0.3em',
            textTransform: 'uppercase', color: 'var(--color-gold)',
          }}>{eyebrow}</div>
          <div style={{
            marginTop: s(20), width: s(40), height: 1, background: 'var(--color-gold)',
          }}/>
          <div style={{
            marginTop: s(28),
            fontFamily: 'var(--font-serif)', fontWeight: 300,
            fontSize: s(48), lineHeight: 1.3,
            letterSpacing: '0.15em', color: 'var(--color-black)',
          }}>{title}</div>
        </div>
        <div style={{
          fontFamily: 'var(--font-sans)', fontWeight: 300,
          fontSize: s(18), letterSpacing: '0.25em',
          textTransform: 'uppercase', color: 'var(--color-stone)',
        }}>{meta}</div>
      </div>
    </div>
  );
}

function Carousel({ cardWidth = 400 }) {
  const items = [
    { photo: window.__resources.ph_bowl,  eyebrow: 'NO. 01', title: '本月入駐\n阿婆ㄟ切仔麵店', meta: 'YUNLIN · 2026' },
    { photo: window.__resources.ph_ink,   eyebrow: 'NO. 02', title: '好物\n值得好照',          meta: '好物・好照 · FROM 500' },
    { photo: window.__resources.ph_stalk, eyebrow: 'NO. 03', title: '一束稻\n一個故事',        meta: 'TAINAN · 工坊' },
    { photo: window.__resources.ph_linen, eyebrow: 'NO. 04', title: '原麻布\n沒被命名的好',    meta: 'WEAVERS · 鹿港' },
  ];
  return (
    <div style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '8px 0' }}>
      {items.map((it, i) => (
        <CarouselCard key={i} width={cardWidth} {...it}
          title={<span>{it.title.split('\n').map((l,j) => <span key={j} style={{display:'block'}}>{l}</span>)}</span>}
        />
      ))}
    </div>
  );
}

window.CarouselCard = CarouselCard;
window.Carousel = Carousel;
