// WelcomeCard.jsx — 1040x1040. Top photo / bottom type block.
function WelcomeCard({ width = 1040 }) {
  const ratio = width / 1040;
  const height = 1040 * ratio;
  const s = (n) => `${n * ratio}px`;

  return (
    <div style={{
      width, height,
      background: 'var(--color-paper)',
      display: 'grid',
      gridTemplateRows: '1fr 1fr',
      overflow: 'hidden',
    }}>
      <div style={{
        backgroundImage: `url(${window.__resources.ph_envelope})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}/>
      <div style={{
        padding: `${s(72)} ${s(64)}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textAlign: 'center',
        alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-sans)', fontWeight: 300,
            fontSize: s(14), letterSpacing: '0.3em',
            textTransform: 'uppercase', color: 'var(--color-gold)',
          }}>WELCOME</div>
          <div style={{
            margin: `${s(24)} auto`, width: s(40), height: 1, background: 'var(--color-gold)',
          }}/>
          <div style={{
            fontFamily: 'var(--font-serif)', fontWeight: 300,
            fontSize: s(56), lineHeight: 1.3,
            letterSpacing: '0.15em', color: 'var(--color-black)',
          }}>只要你願意說，<br/>我們就幫你被看見。</div>
          <div style={{
            marginTop: s(28),
            fontFamily: 'var(--font-sans)', fontWeight: 300,
            fontSize: s(18), lineHeight: 1.8,
            letterSpacing: '0.05em', color: 'var(--color-ink)',
            maxWidth: s(720),
          }}>
            不管你的需求、想法、產品 — 多大、多小、多複雜，<br/>
            我們都有適合的平台、舞台、後台。來，幫你圓夢。
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: s(8) }}>
          <div style={{
            fontFamily: 'var(--font-serif)', fontWeight: 300,
            fontSize: s(22), letterSpacing: '0.2em', color: 'var(--color-black)',
          }}>3Q貢丸</div>
          <div style={{
            fontFamily: 'var(--font-sans)', fontWeight: 300,
            fontSize: s(11), letterSpacing: '0.3em', color: 'var(--color-stone)',
          }}>LINE · @121LKSPE</div>
        </div>
      </div>
    </div>
  );
}

window.WelcomeCard = WelcomeCard;
