// RichMenu.jsx — 2500x1686. Hero band (800) + 4-grid (886).
// 4 cells enriched with: dim background photo + icon + zh/en label + gold-accent feature badge.
function RichMenu({ width = 1000 }) {
  const ratio = width / 2500;
  const height = 1686 * ratio;
  const heroH = 800 * ratio;
  const gridH = 886 * ratio;
  const s = (n) => `${n * ratio}px`;

  const cells = [
    {
      icon:  window.__resources.ic_consultation,
      bg:    window.__resources.ph_cell_1,
      zh:    '說說你的店', en: 'TELL US YOUR SHOP',
      badge: '30 分鐘 · 免費諮詢',
    },
    {
      icon:  window.__resources.ic_camera,
      bg:    window.__resources.ph_cell_2,
      zh:    '好物・好照', en: 'WORTHY IMAGES',
      badge: 'FROM 500 元',
    },
    {
      icon:  window.__resources.ic_compass,
      bg:    window.__resources.ph_cell_3,
      zh:    '陪你被看見', en: 'SEEN, TOGETHER',
      badge: '季度規劃 · 深度陪跑',
    },
    {
      icon:  window.__resources.ic_clock,
      bg:    window.__resources.ph_cell_4,
      zh:    '走到哪了',   en: 'WHERE WE ARE',
      badge: '即時追蹤 · 線上',
    },
  ];

  return (
    <div style={{ width, height, display: 'flex', flexDirection: 'column', background: '#0A0A0A' }}>
      {/* Hero band — paper, photo left + type right */}
      <div style={{
        height: heroH,
        background: 'var(--color-paper)',
        display: 'grid',
        gridTemplateColumns: '40% 60%',
      }}>
        <div style={{
          backgroundImage: `url(${window.__resources.ph_palm})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}/>
        <div style={{
          padding: `${s(80)} ${s(80)}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: s(40),
        }}>
          <div style={{
            fontFamily: 'var(--font-sans)', fontWeight: 300,
            fontSize: s(28), letterSpacing: '0.3em',
            textTransform: 'uppercase', color: 'var(--color-gold)',
          }}>TAIWAN BRAND HATCHERY</div>
          <div style={{
            fontFamily: 'var(--font-serif)', fontWeight: 300,
            fontSize: s(96), lineHeight: 1.15,
            letterSpacing: '0.15em', color: 'var(--color-black)',
          }}>你的產品，<br/>值得被看見。</div>
          <div style={{ width: s(80), height: 1, background: 'var(--color-gold)' }}/>
        </div>
      </div>

      {/* 4-grid CTA — each cell has dim photo bg + icon + label + badge */}
      <div style={{
        height: gridH,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        background: 'var(--color-gold)',
        gap: '1px',
      }}>
        {cells.map((c, i) => (
          <div key={i} style={{
            position: 'relative',
            background: '#0A0A0A',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: s(48),
          }}>
            {/* Dim background photo */}
            {c.bg && (
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url(${c.bg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'grayscale(0.6) brightness(0.4)',
                opacity: 0.35,
              }}/>
            )}
            {/* Dark overlay for legibility */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.85) 100%)',
            }}/>

            {/* Top: index marker */}
            <div style={{
              position: 'absolute', top: s(36), left: s(36),
              fontFamily: 'var(--font-sans)', fontWeight: 300,
              fontSize: s(18), letterSpacing: '0.35em',
              color: 'var(--color-gold)',
              zIndex: 2,
            }}>NO. 0{i + 1}</div>

            {/* Content stack */}
            <div style={{
              position: 'relative', zIndex: 2,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: s(36),
            }}>
              <img src={c.icon} style={{
                width: s(130), height: s(130),
                filter: 'invert(0.9) brightness(1.1)',
              }}/>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: s(14) }}>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontWeight: 300,
                  fontSize: s(56), letterSpacing: '0.18em',
                  color: 'var(--color-paper)',
                  textAlign: 'center', lineHeight: 1.1,
                }}>{c.zh}</div>
                <div style={{ width: s(32), height: 1, background: 'var(--color-gold)' }}/>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontWeight: 300,
                  fontSize: s(18), letterSpacing: '0.35em',
                  color: 'rgba(245,242,236,0.55)',
                }}>{c.en}</div>
              </div>
            </div>

            {/* Bottom feature badge */}
            <div style={{
              position: 'absolute', bottom: s(40), left: s(36), right: s(36),
              zIndex: 2,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: s(12),
            }}>
              <div style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: s(12),
              }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(184,146,74,0.4)' }}/>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontWeight: 300,
                  fontSize: s(20), letterSpacing: '0.18em',
                  color: 'var(--color-gold)',
                  whiteSpace: 'nowrap',
                }}>{c.badge}</div>
                <div style={{ flex: 1, height: 1, background: 'rgba(184,146,74,0.4)' }}/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.RichMenu = RichMenu;
