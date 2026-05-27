// NamePrompt.jsx — soft optional store-name question. Tone: like a barista asking
// what to write on the cup. The name is woven into interstitials and the result page.
function NamePrompt({ storeName, onChange, onContinue, onSkip }) {
  const inputRef = React.useRef(null);
  React.useEffect(() => {
    // soft focus after the fade-in
    const t = setTimeout(() => { inputRef.current && inputRef.current.focus(); }, 800);
    return () => clearTimeout(t);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    onContinue();
  };

  return (
    <div className="scr name">
      <div className="name-bg" style={{ backgroundImage: 'url(../assets/photography/raw-linen.svg)' }}/>
      <div className="name-veil"/>
      <div className="name-body">
        <div className="eyebrow gold">FIRST · 一件事</div>
        <div className="hairline-gold"/>
        <h2 className="serif name-prompt">
          <span className="line">你的店</span>
          <span className="line">叫什麼名字？</span>
        </h2>
        <p className="name-sub">想被怎麼稱呼，這裡寫。<br/>不想說也沒關係。</p>

        <form onSubmit={submit} className="name-form">
          <input
            ref={inputRef}
            className="name-input serif"
            type="text"
            placeholder="例如：阿婆雜貨店"
            value={storeName}
            maxLength={20}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="name-input-line"/>
        </form>

        <div className="name-actions">
          <button
            className="btn-primary"
            onClick={onContinue}
            disabled={!storeName.trim()}
          >
            <span>就叫它這個</span>
            <span className="btn-line"/>
          </button>
          <button className="btn-ghost" onClick={onSkip}>
            <span>先跳過</span>
            <span className="arrow"/>
          </button>
        </div>
      </div>
    </div>
  );
}

window.NamePrompt = NamePrompt;
