// Interstitial.jsx — emotional break screen. Class names match styles.css conventions.
function Interstitial({ data, onNext }) {
  React.useEffect(() => {
    if (!data || !data.autoAdvance) return;
    const t = setTimeout(onNext, data.autoAdvance);
    return () => clearTimeout(t);
  }, [data && data.autoAdvance]);

  if (!data) return null;

  return (
    <div className="scr inter">
      <div className="inter-photo" style={{ backgroundImage: `url(../${data.photo})` }}/>
      <div className="inter-veil"/>

      <div className="inter-body">
        <div className="eyebrow gold">{data.eyebrow}</div>
        <div className="hairline-gold wide"/>

        {data.preface && (
          <p className="inter-preface">{data.preface}</p>
        )}

        {data.lines && (
          <div className="inter-lines">
            {data.lines.map((l, i) => (
              <div key={i} className={`inter-line inter-line-${i}`}>{l}</div>
            ))}
          </div>
        )}

        {data.echoes && data.echoes.length > 0 && (
          <ul className="inter-echoes">
            {data.echoes.map((e, i) => (
              <li key={i} className={`inter-echo inter-echo-${i}`}>{e.line}</li>
            ))}
          </ul>
        )}

        <div className="inter-rule"/>

        {data.sub && (
          <p className="inter-sub">
            {data.sub.split('\n').map((l, i) => (
              <span key={i} style={{ display: 'block' }}>{l}</span>
            ))}
          </p>
        )}

        {!data.autoAdvance && (
          <button className="btn-primary inter-cta" onClick={onNext}>
            <span>{data.kicker || '繼續'}</span>
            <span className="btn-line"/>
          </button>
        )}

        {data.autoAdvance && (
          <div className="inter-pulse" aria-hidden="true">
            <div className="pulse-dot"/>
            <div className="pulse-bar"/>
          </div>
        )}
      </div>
    </div>
  );
}

window.Interstitial = Interstitial;
