// Welcome.jsx — establishing scene with the universal claim:
// 從 10 元茶葉蛋 → 企業，孵化所都接得住。
function Welcome({ onStart, closingLine }) {
  return (
    <div className="scr welcome">
      <div className="welcome-photo" style={{
        backgroundImage: 'url(../assets/photography/cupped-palm-light.svg)'
      }}/>
      <div className="welcome-veil"/>
      <div className="welcome-body">
        <div className="eyebrow gold">TAIWAN BRAND HATCHERY · 自 2020</div>
        <div className="hairline-gold"/>
        <h1 className="serif">
          <span className="line">只要你願意說，</span>
          <span className="line">{closingLine || '我們就幫你被看見。'}</span>
        </h1>
        <p className="welcome-sub">
          不管你的需求、想法、產品 — 多大、多小、多複雜，<br/>
          我們都有適合的平台、舞台、後台。<br/>
          回答十個問題，我們替你找出第一步該被拍下、被講出、被看見的，是哪件事。
        </p>
        <button className="btn-primary" onClick={onStart}>
          <span>來，幫你圓夢</span>
          <span className="btn-line"/>
        </button>
        <div className="welcome-foot">
          <span>約 3 分鐘</span>
          <span className="dot"/>
          <span>不會收個資</span>
          <span className="dot"/>
          <span>可中途離開</span>
        </div>
      </div>
    </div>
  );
}

window.Welcome = Welcome;
