// CoverImage.jsx — 1080x878. 60% editorial photo, 40% paper-white type.
function CoverImage({ width = 1080, height = 878, photo = 'bowl' }) {
  const photos = {
    bowl: window.__resources.ph_bowl,
    ink:  window.__resources.ph_ink,
    linen:window.__resources.ph_linen,
    stalk:window.__resources.ph_stalk,
  };
  const s = (n) => `${(n / 1080) * width}px`;
  const photoW = width * 0.6;
  return (
    <div
      style={{
        width, height,
        display: 'grid',
        gridTemplateColumns: '60% 40%',
        background: 'var(--color-paper)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left — photography */}
      <div style={{
        backgroundImage: `url(${photos[photo]})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}/>

      {/* Right — paper + type block */}
      <div style={{
        padding: `${s(80)} ${s(56)}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: 'var(--color-paper)',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-sans)', fontWeight: 300,
            fontSize: s(14), letterSpacing: '0.3em',
            textTransform: 'uppercase', color: 'var(--color-gold)',
          }}>No. 01 · 入駐</div>
          <div style={{
            width: s(40), height: 1, background: 'var(--color-gold)',
            margin: `${s(24)} 0 ${s(40)}`,
          }}/>
          <div style={{
            fontFamily: 'var(--font-serif)', fontWeight: 300,
            fontSize: s(38), lineHeight: 1.35,
            letterSpacing: '0.15em', color: 'var(--color-black)',
          }}>
            不管你的<br/>需求、想法、<br/>產品 — 多大、<br/>多小、多複雜，<br/>我們都接得住。
          </div>
        </div>
        <div>
          <div style={{
            fontFamily: 'var(--font-serif)', fontWeight: 300,
            fontSize: s(28), letterSpacing: '0.2em', color: 'var(--color-black)',
          }}>3Q貢丸</div>
          <div style={{
            marginTop: s(8),
            fontFamily: 'var(--font-sans)', fontWeight: 300,
            fontSize: s(11), letterSpacing: '0.3em', color: 'var(--color-stone)',
          }}>LINE · @121LKSPE</div>
        </div>
      </div>
    </div>
  );
}

window.CoverImage = CoverImage;
