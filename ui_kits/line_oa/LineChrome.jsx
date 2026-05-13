// LineChrome.jsx — a minimal LINE chat-frame approximation
// to situate the OA assets in their native surface.
function LineChrome({ avatar, accountName = '3Q貢丸', children, onMenu, menuOpen }) {
  return (
    <div className="line-frame">
      <header className="line-top">
        <div className="line-top-l">
          <img src={window.__resources.ic_arrow_right} style={{ transform: 'rotate(180deg)', width: 20 }} alt="back"/>
        </div>
        <div className="line-top-c">
          {avatar}
          <div className="line-top-name">{accountName}</div>
        </div>
        <div className="line-top-r">
          <img src={window.__resources.ic_menu} style={{ width: 20 }} alt="menu"/>
        </div>
      </header>

      <main className="line-msgs">{children}</main>

      <div className={`line-menu-tab ${menuOpen ? 'open' : ''}`} onClick={onMenu}>
        <span>{menuOpen ? '收合圖文選單' : '展開圖文選單'}</span>
        <img src={window.__resources.ic_arrow_down} style={{ width: 14, transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .3s' }}/>
      </div>
    </div>
  );
}

function LineMessageBubble({ side = 'in', children }) {
  return (
    <div className={`line-bubble ${side}`}>{children}</div>
  );
}

function LineDayDivider({ label = '今天' }) {
  return <div className="line-day"><span>{label}</span></div>;
}

window.LineChrome = LineChrome;
window.LineMessageBubble = LineMessageBubble;
window.LineDayDivider = LineDayDivider;
