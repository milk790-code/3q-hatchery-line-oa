// Question.jsx — diagnostic question with up to 6 option cards.
function Question({ idx, total, q, selected, onSelect, onNext, onBack, ctaLabel }) {
  return (
    <div className="scr question">
      <ProgressHairline idx={idx} total={total}/>
      <div className="q-head">
        <div className="eyebrow gold">{q.eyebrow}</div>
        <div className="hairline-gold"/>
        <h2 className="serif q-prompt">
          {q.prompt.split('\n').map((l, i) => <span key={i} className="line">{l}</span>)}
        </h2>
        <p className="q-sub">{q.sub}</p>
      </div>

      <div className="q-options">
        {q.options.map((opt, i) => {
          const isSel = selected === i;
          return (
            <button
              key={i}
              className={`opt ${isSel ? 'sel' : ''}`}
              onClick={() => onSelect(i)}
            >
              <div className="opt-marker">
                <span className="opt-tick"/>
              </div>
              <div className="opt-body">
                <div className="opt-label">{opt.label}</div>
                <div className="opt-sub">{opt.sub}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="q-foot">
        <button className="btn-ghost" onClick={onBack} disabled={idx === 0}>
          <span className="arrow back"/>
          <span>上一題</span>
        </button>
        <button className="btn-primary small" onClick={onNext} disabled={selected == null}>
          <span>{ctaLabel || (idx === total - 1 ? '看見我' : '下一題')}</span>
          <span className="btn-line"/>
        </button>
      </div>
    </div>
  );
}

function ProgressHairline({ idx, total }) {
  return (
    <div className="prog">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`prog-step ${i <= idx ? 'on' : ''}`}/>
      ))}
    </div>
  );
}

window.Question = Question;
window.ProgressHairline = ProgressHairline;
