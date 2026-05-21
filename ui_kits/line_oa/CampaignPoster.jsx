// CampaignPoster.jsx — 1080×1040. Campaign recruitment poster.
// Left 50%: product photo. Right 50%: pricing tiers + brand promise.
function CampaignPoster({ width = 1080, height = 1040, photo = 'bowl' }) {
  const sc = (n) => `${(n / 1080) * width}px`;
  const photos = {
    bowl:  window.__resources.ph_bowl,
    ink:   window.__resources.ph_ink,
    linen: window.__resources.ph_linen,
    stalk: window.__resources.ph_stalk,
  };
  const photoUrl = photos[photo] || photos.bowl;
  const half = width / 2;

  return (
    <div style={{
      width, height, position: 'relative', overflow: 'hidden',
      display: 'flex', background: 'var(--color-paper)',
    }}>
      {/* LEFT — full-bleed photo */}
      <div style={{
        width: half, height,
        backgroundImage: `url(${photoUrl})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'saturate(0.8) contrast(1.08)',
        position: 'relative', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, rgba(10,10,10,0) 60%, rgba(10,10,10,0.45) 100%)',
        }}/>
        {/* Hook text overlay bottom-left */}
        <div style={{
          position: 'absolute', bottom: sc(72), left: sc(48),
          display: 'flex', flexDirection: 'column', gap: sc(12),
        }}>
          <div style={{ width: sc(40), height: 1, background: 'var(--color-gold)' }}/>
          <div style={{
            fontFamily: 'var(--font-serif)', fontWeight: 300,
            fontSize: sc(28), lineHeight: 1.35, letterSpacing: '0.08em',
            color: 'var(--color-paper)',
          }}>業界 2,000 起跳<br/>我們這次<br/>500</div>
        </div>
      </div>

      {/* RIGHT — pricing panel */}
      <div style={{
        width: half, height,
        background: 'var(--color-paper)',
        display: 'flex', flexDirection: 'column',
        padding: `${sc(64)} ${sc(52)}`,
        position: 'relative', flexShrink: 0,
      }}>
        {/* Texture overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url(../../assets/textures/rice-paper-fine.svg)',
          backgroundSize: 'cover', opacity: 0.5, pointerEvents: 'none',
        }}/>

        {/* Eyebrow */}
        <div style={{
          fontFamily: 'var(--font-sans)', fontWeight: 300,
          fontSize: sc(10), letterSpacing: '0.4em',
          color: 'var(--color-gold)', textTransform: 'uppercase', zIndex: 1,
        }}>PHOTO · 好物好照 · 限時招募</div>

        {/* Gold line */}
        <div style={{ width: sc(40), height: 1, background: 'var(--color-gold)', margin: `${sc(20)} 0`, zIndex: 1 }}/>

        {/* Headline */}
        <div style={{
          fontFamily: 'var(--font-serif)', fontWeight: 300,
          fontSize: sc(38), lineHeight: 1.25, letterSpacing: '0.1em',
          color: 'var(--color-black)', marginBottom: sc(8), zIndex: 1,
        }}>好物<br/>值得好照</div>
        <div style={{
          fontFamily: 'var(--font-sans)', fontWeight: 300,
          fontSize: sc(11), letterSpacing: '0.15em',
          color: 'var(--color-stone)', marginBottom: sc(40), zIndex: 1,
        }}>1 張像樣的產品照 + 1 段讀得進去的介紹文</div>

        {/* Tiers */}
        {[
          { label: '前 10 位', price: '100', desc: '截圖點讚回傳', tag: 'TIER 01' },
          { label: '11–20 位', price: '200', desc: '回傳 👍', tag: 'TIER 02' },
          { label: '21–30 位', price: '300', desc: '回傳「我要」', tag: 'TIER 03' },
        ].map((tier, i) => (
          <div key={i} style={{
            borderTop: `1px solid rgba(184,146,74,${i === 0 ? '0.6' : '0.25'})`,
            padding: `${sc(16)} 0`,
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            zIndex: 1,
          }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-sans)', fontWeight: 300,
                fontSize: sc(9), letterSpacing: '0.35em',
                color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: sc(4),
              }}>{tier.tag}</div>
              <div style={{
                fontFamily: 'var(--font-serif)', fontWeight: 300,
                fontSize: sc(20), letterSpacing: '0.08em',
                color: 'var(--color-black)',
              }}>{tier.label}</div>
              <div style={{
                fontFamily: 'var(--font-sans)', fontWeight: 300,
                fontSize: sc(10), letterSpacing: '0.1em',
                color: 'var(--color-stone)', marginTop: sc(2),
              }}>{tier.desc}</div>
            </div>
            <div style={{
              fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 300,
              fontSize: sc(40), color: i === 0 ? 'var(--color-gold)' : 'var(--color-stone)',
              letterSpacing: '-0.01em', lineHeight: 1,
            }}>{tier.price}<span style={{ fontSize: sc(14), marginLeft: sc(2) }}>元</span></div>
          </div>
        ))}

        {/* Border bottom tier */}
        <div style={{ borderTop: '1px solid rgba(184,146,74,0.25)', zIndex: 1 }}/>

        {/* Spacer */}
        <div style={{ flex: 1 }}/>

        {/* CTA */}
        <div style={{
          background: 'var(--color-black)',
          padding: `${sc(18)} ${sc(24)}`,
          display: 'flex', flexDirection: 'column', gap: sc(6),
          zIndex: 1,
        }}>
          <div style={{
            fontFamily: 'var(--font-serif)', fontWeight: 300,
            fontSize: sc(20), letterSpacing: '0.12em',
            color: 'var(--color-paper)',
          }}>傳 +1 立即報名</div>
          <div style={{
            fontFamily: 'var(--font-sans)', fontWeight: 300,
            fontSize: sc(9), letterSpacing: '0.3em', textTransform: 'uppercase',
            color: 'rgba(245,242,236,0.55)',
          }}>額滿就停 · 不延期 · 不加場</div>
        </div>

        {/* Footer brand */}
        <div style={{
          fontFamily: 'var(--font-sans)', fontWeight: 300,
          fontSize: sc(9), letterSpacing: '0.3em', textTransform: 'uppercase',
          color: 'rgba(10,10,10,0.3)', marginTop: sc(16), zIndex: 1,
        }}>3Q 貢丸 · @121LKSPE</div>
      </div>
    </div>
  );
}
window.CampaignPoster = CampaignPoster;
