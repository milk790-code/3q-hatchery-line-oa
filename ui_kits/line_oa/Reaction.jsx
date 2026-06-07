// Reaction.jsx — 480×480. Sticker-style image reply.
// Phosphor thin icon + brand-aligned typography + paper texture.
function Reaction({ width = 480, height = 480, icon, label, sub }) {
  const sc = (n) => `${(n / 480) * width}px`;
  return (
    <div style={{
      width, height, position: 'relative', overflow: 'hidden',
      background: 'var(--color-paper)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: sc(16), padding: sc(36),
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'url(../../assets/textures/rice-paper-fine.svg)',
        backgroundSize: 'cover', opacity: 0.6, pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute', top: sc(28), zIndex: 2,
        fontFamily: 'var(--font-sans)', fontWeight: 300,
        fontSize: sc(9), letterSpacing: '0.4em',
        color: 'var(--color-gold)', textTransform: 'uppercase',
      }}>3Q · REACTION</div>
      <img src={icon} style={{
        width: sc(180), height: sc(180), zIndex: 2,
        filter: 'invert(0.08) brightness(0.95)',
      }} alt=""/>
      <div style={{
        width: sc(48), height: 1, background: 'var(--color-gold)', zIndex: 2,
      }}/>
      <div style={{
        fontFamily: 'var(--font-serif)', fontWeight: 300,
        fontSize: sc(42), letterSpacing: '0.18em', lineHeight: 1.2,
        color: 'var(--color-black)', zIndex: 2,
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-sans)', fontWeight: 300,
        fontSize: sc(9), letterSpacing: '0.35em',
        color: 'var(--color-stone)', textTransform: 'uppercase', zIndex: 2,
      }}>{sub}</div>
      <div style={{
        position: 'absolute', bottom: sc(24), zIndex: 2,
        fontFamily: 'var(--font-sans)', fontWeight: 300,
        fontSize: sc(8), letterSpacing: '0.3em',
        color: 'rgba(10,10,10,0.35)', textTransform: 'uppercase',
      }}>@121LKSPE</div>
    </div>
  );
}
window.Reaction = Reaction;
