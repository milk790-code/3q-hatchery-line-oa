// Result.jsx — personalised page combining persona + stage + emotional callbacks.
function Result({ persona, stage, storeName, echoes, onRestart }) {
  const body = persona.bodyByTier[stage.id] || persona.bodyByTier.t2;

  return (
    <div className="scr result">
      <div className="r-photo" style={{ backgroundImage: `url(../${persona.photo})` }}/>
      <div className="r-photo-veil"/>

      <div className="r-photo-meta">
        <div className="eyebrow paper">YOUR ARCHETYPE</div>
        <div className="r-persona-en serif">{persona.en}</div>
        <div className="r-persona-zh serif">{persona.zh}</div>
        <div className="r-spectrum">{persona.spectrum}</div>
      </div>

      <div className="r-body">
        {storeName && (
          <div className="r-namecard">
            <span className="r-namecard-l">FOR</span>
            <span className="r-namecard-line"/>
            <span className="r-namecard-name serif">{storeName}</span>
          </div>
        )}

        {/* Stage badge */}
        <div className="r-stage">
          <span className="r-stage-l">CURRENTLY</span>
          <span className="r-stage-line"/>
          <span className="r-stage-tier">{stage.label}</span>
          <span className="r-stage-sub">{stage.sub}</span>
        </div>

        <h1 className="serif r-title">
          {persona.title.split('\n').map((l, i) => <span key={i} className="line">{l}</span>)}
        </h1>
        <div className="hairline-gold wide"/>
        <p className="r-desc">{body}</p>

        {/* Emotional callback — we heard you */}
        {echoes && echoes.length > 0 && (
          <div className="r-echo">
            <div className="eyebrow gold">我們聽到了 · WE HEARD YOU</div>
            <div className="hairline-gold"/>
            <ul className="r-echo-list">
              {echoes.map((e, i) => (
                <li key={i} className="r-echo-item">
                  <span className="r-echo-mark">「</span>
                  <span className="r-echo-text serif">{e.line}</span>
                </li>
              ))}
            </ul>
            <p className="r-echo-foot">
              這三件事，我們不只聽過，做過。<br/>
              下面是我們建議你從哪裡開始。
            </p>
          </div>
        )}

        <div className="r-services">
          {persona.services.map((s, i) => (
            <div className="r-service" key={i}>
              <div className="r-service-tag">{s.tag}</div>
              <div className="r-service-name serif">{s.name}</div>
              <div className="r-service-desc">{s.desc}</div>
            </div>
          ))}
        </div>

        <div className="r-quote-block">
          <div className="hairline-gold"/>
          <blockquote className="r-quote serif">
            {persona.quote.split('\n').map((l, i) => <span key={i} className="line">{l}</span>)}
          </blockquote>
          <div className="r-quote-sig">— 3Q貢丸 · 孵化所手記</div>
        </div>

        <a className="btn-primary block" href="#" onClick={(e) => e.preventDefault()}>
          <span>加入 LINE · 從這件事開始</span>
          <span className="btn-line"/>
        </a>
        <div className="r-line-id">LINE · @121LKSPE</div>

        <button className="btn-ghost center" onClick={onRestart}>
          <span className="arrow back"/>
          <span>重新回答</span>
        </button>
      </div>
    </div>
  );
}

window.Result = Result;
