// IGHighlight.jsx — 1080x1920. Highlight cover that survives IG's 1:1 circular crop.
// Safe area: center 1080×1080 (y=420 → y=1500). Icon in the safe area, label below
// (visible only when user taps into the highlight, not in the profile bubble).
function IGHighlight({ width = 270, icon = 'consultation', label = '是誰', en = 'WHO' }) {
  const ratio = width / 1080;
  const height = 1920 * ratio;
  const s = (n) => `${n * ratio}px`;
  const iconSize = 360 * ratio;

  return (
    <div style={{ width, height, background: '#0F0D0A', position: 'relative', overflow: 'hidden' }}>
      {/* Faint top eyebrow — only visible when expanded */}
      <div style={{
        position: 'absolute', top: s(180), left: 0, right: 0,
        textAlign: 'center',
        fontFamily: 'var(--font-sans)', fontWeight: 300,
        fontSize: s(20), letterSpacing: '0.4em', textTransform: 'uppercase',
        color: 'rgba(184,146,74,0.55)',
      }}>3Q HATCHERY</div>

      {/* Icon centered in the 1:1 safe area (y=420..1500, so center y=960) */}
      <div style={{
        position: 'absolute',
        left: '50%', top: s(960),
        transform: 'translate(-50%, -50%)',
        width: iconSize, height: iconSize,
        background: 'var(--color-gold)',
        WebkitMaskImage: `url(../../assets/icons/${icon}.svg)`,
        maskImage: `url(../../assets/icons/${icon}.svg)`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}/>

      {/* Gold hairline */}
      <div style={{
        position: 'absolute', left: '50%', top: s(1290),
        transform: 'translateX(-50%)',
        width: s(40), height: 1, background: 'var(--color-gold)',
      }}/>

      {/* Label — also in safe area, below icon */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: s(1330),
        textAlign: 'center',
        fontFamily: 'var(--font-serif)', fontWeight: 300,
        fontSize: s(64), letterSpacing: '0.2em',
        color: 'var(--color-paper)',
      }}>{label}</div>

      {/* EN sublabel — below safe area, only visible when expanded */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: s(220),
        textAlign: 'center',
        fontFamily: 'var(--font-sans)', fontWeight: 300,
        fontSize: s(22), letterSpacing: '0.4em', textTransform: 'uppercase',
        color: 'rgba(184,146,74,0.7)',
      }}>{en}</div>
    </div>
  );
}

window.IGHighlight = IGHighlight;
