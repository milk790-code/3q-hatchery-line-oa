// 3q-site v1.1 — 超強鉤子版
const FILES = {
  "/3q-typography.css": { ct: "text/css; charset=utf-8", body: `/* ─── 三根手指頭 · Typography Tokens ──────────────────────────────
   三字體系統：中文標題 Noto Serif TC + 英文裝飾 Cormorant Garamond + 內文 Noto Sans TC
   ────────────────────────────────────────────────────────────────── */

/* fonts injected at runtime by 3q-fonts.js (same Google Fonts URL) */

:root {
  /* ── Font families ── */
  --font-serif:  "Noto Serif TC", serif;
  --font-sans:   "Noto Sans TC", system-ui, sans-serif;
  --font-accent: "Cormorant Garamond", serif;  /* italic eyebrow + decoration */

  /* ── Type scale ── */
  --text-h1:        clamp(44px, 7vw, 84px);
  --text-h2:        clamp(30px, 4.5vw, 48px);
  --text-h3:        22px;
  --text-eyebrow:   13px;
  --text-accent-en: clamp(20px, 3vw, 30px);
  --text-body:      16px;
  --text-body-lg:   17px;
  --text-caption:   13px;
  --text-nav:       14.5px;
  --text-btn:       16px;
  --text-btn-sm:    14px;
  --text-stat:      clamp(36px, 6vw, 68px);

  /* ── Line heights ── */
  --leading-h1:     1.12;
  --leading-h2:     1.20;
  --leading-h3:     1.40;
  --leading-body:   1.85;
  --leading-caption: 1.60;
  --leading-tight:  1.15;

  /* ── Letter spacing ── */
  --tracking-h1:      2px;
  --tracking-h2:      1px;
  --tracking-eyebrow: 3px;
  --tracking-accent:  1px;
  --tracking-wide:    2px;

  /* ── Font weights ── */
  --weight-regular:  400;
  --weight-medium:   500;
  --weight-bold:     700;
  --weight-black:    900;
}
` },
  "/tweaks-panel.jsx": { ct: "text/javascript; charset=utf-8", body: `// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)

/* BEGIN USAGE */
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
// Exports (to window): useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider,
//   TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// TweakRadio is the segmented control for 2–3 short options (auto-falls-back to
// TweakSelect past ~16/~10 chars per label); reach for TweakSelect directly when
// options are many or long. For color tweaks always curate 3-4 options rather than
// a free picker; an option can also be a whole 2–5 color palette (the stored value
// is the array). The Tweak* controls are a floor, not a ceiling — build custom
// controls inside the panel if a tweak calls for UI they don't cover.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = \`
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
\`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setValues((prev) => ({ ...prev, ...edits }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({ title = 'Tweaks', children }) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({ x: 16, y: 16 });
  const PAD = 16;

  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y)),
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);

  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);

  React.useEffect(() => {
    const onMsg = (e) => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);
      else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  };

  const onDragStart = (e) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev) => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy),
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  if (!open) return null;
  return (
    <>
      <style>{__TWEAKS_STYLE}</style>
      <div ref={dragRef} className="twk-panel" data-omelette-chrome=""
           style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}>
        <div className="twk-hd" onMouseDown={onDragStart}>
          <b>{title}</b>
          <button className="twk-x" aria-label="Close tweaks"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={dismiss}>✕</button>
        </div>
        <div className="twk-body">
          {children}
        </div>
      </div>
    </>
  );
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({ label, children }) {
  return (
    <>
      <div className="twk-sect">{label}</div>
      {children}
    </>
  );
}

function TweakRow({ label, value, children, inline = false }) {
  return (
    <div className={inline ? 'twk-row twk-row-h' : 'twk-row'}>
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
  return (
    <TweakRow label={label} value={\`\${value}\${unit}\`}>
      <input type="range" className="twk-slider" min={min} max={max} step={step}
             value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </TweakRow>
  );
}

function TweakToggle({ label, value, onChange }) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl"><span>{label}</span></div>
      <button type="button" className="twk-toggle" data-on={value ? '1' : '0'}
              role="switch" aria-checked={!!value}
              onClick={() => onChange(!value)}><i /></button>
    </div>
  );
}

function TweakRadio({ label, value, options, onChange }) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = (o) => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({ 2: 16, 3: 10 }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = (s) => {
      const m = options.find((o) => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return <TweakSelect label={label} value={value} options={options}
                        onChange={(s) => onChange(resolve(s))} />;
  }
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const idx = Math.max(0, opts.findIndex((o) => o.value === value));
  const n = opts.length;

  const segAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor(((clientX - r.left - 2) / inner) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };

  const onPointerDown = (e) => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev) => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <TweakRow label={label}>
      <div ref={trackRef} role="radiogroup" onPointerDown={onPointerDown}
           className={dragging ? 'twk-seg dragging' : 'twk-seg'}>
        <div className="twk-seg-thumb"
             style={{ left: \`calc(2px + \${idx} * (100% - 4px) / \${n})\`,
                      width: \`calc((100% - 4px) / \${n})\` }} />
        {opts.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value}>
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

function TweakSelect({ label, value, options, onChange }) {
  return (
    <TweakRow label={label}>
      <select className="twk-field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </TweakRow>
  );
}

function TweakText({ label, value, placeholder, onChange }) {
  return (
    <TweakRow label={label}>
      <input className="twk-field" type="text" value={value} placeholder={placeholder}
             onChange={(e) => onChange(e.target.value)} />
    </TweakRow>
  );
}

function TweakNumber({ label, value, min, max, step = 1, unit = '', onChange }) {
  const clamp = (n) => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({ x: 0, val: 0 });
  const onScrubStart = (e) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, val: value };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = (ev) => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div className="twk-num">
      <span className="twk-num-lbl" onPointerDown={onScrubStart}>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step}
             onChange={(e) => onChange(clamp(Number(e.target.value)))} />
      {unit && <span className="twk-num-unit">{unit}</span>}
    </div>
  );
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}

const __TwkCheck = ({ light }) => (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3 7.2 5.8 10 11 4.2" fill="none" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          stroke={light ? 'rgba(0,0,0,.78)' : '#fff'} />
  </svg>
);

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({ label, value, options, onChange }) {
  if (!options || !options.length) {
    return (
      <div className="twk-row twk-row-h">
        <div className="twk-lbl"><span>{label}</span></div>
        <input type="color" className="twk-swatch" value={value}
               onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = (o) => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return (
    <TweakRow label={label}>
      <div className="twk-chips" role="radiogroup">
        {options.map((o, i) => {
          const colors = Array.isArray(o) ? o : [o];
          const [hero, ...rest] = colors;
          const sup = rest.slice(0, 4);
          const on = key(o) === cur;
          return (
            <button key={i} type="button" className="twk-chip" role="radio"
                    aria-checked={on} data-on={on ? '1' : '0'}
                    aria-label={colors.join(', ')} title={colors.join(' · ')}
                    style={{ background: hero }}
                    onClick={() => onChange(o)}>
              {sup.length > 0 && (
                <span>
                  {sup.map((c, j) => <i key={j} style={{ background: c }} />)}
                </span>
              )}
              {on && <__TwkCheck light={__twkIsLight(hero)} />}
            </button>
          );
        })}
      </div>
    </TweakRow>
  );
}

function TweakButton({ label, onClick, secondary = false }) {
  return (
    <button type="button" className={secondary ? 'twk-btn secondary' : 'twk-btn'}
            onClick={onClick}>{label}</button>
  );
}

Object.assign(window, {
  useTweaks, TweaksPanel, TweakSection, TweakRow,
  TweakSlider, TweakToggle, TweakRadio, TweakSelect,
  TweakText, TweakNumber, TweakColor, TweakButton,
});
` },
  "/index.html": { ct: "text/html; charset=utf-8", body: `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>3Q孵化所 · 幫你拿到該拿的資源</title>
  <!-- 分享卡 OG（2026-06-13 修正：本站網域 + 強鉤子圖） -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="整整三年，不用花你一塊錢｜3Q孵化所">
  <meta property="og:description" content="政府每年釋出數百億補助。3 個問題、1 分鐘，免費評估你能申請什麼。補助媒合 × 計畫書代撰 × 募資架構設計。">
  <meta property="og:image" content="https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/og-3q-site.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="https://3q-site.milk790.workers.dev/">
  <link rel="canonical" href="https://3q-site.milk790.workers.dev/">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"ProfessionalService","name":"3Q孵化所","url":"https://3q-site.milk790.workers.dev/","description":"補助媒合 × 計畫書代撰 × 募資架構設計。免費補助健檢，1 分鐘找出你能申請的政府補助。","areaServed":"TW","founder":{"@type":"Person","name":"陳學誼"}}</script>
  <meta name="description" content="補助媒合 × 計畫書代撰 × 募資架構設計。三個問題，找出你的補助路徑。">
  <link rel="stylesheet" href="3q-typography.css">
  <script src="3q-fonts.js"></script>
  <link rel="stylesheet" href="_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/tokens/colors.css">
  <link rel="stylesheet" href="_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/tokens/spacing.css">
  <link rel="stylesheet" href="_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/tokens/effects.css">
  <link rel="stylesheet" href="_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/styles.css">
  <link rel="stylesheet" href="3q-shared.css">
  <script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y" crossorigin="anonymous"></script>
  <script src="_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/_ds_bundle.js"></script>
  <script src="image-slot.js"></script>
  <script type="text/babel" src="tweaks-panel.jsx"></script>
  <script type="text/babel" src="3q-shared.jsx"></script>
</head>
<body>
<template id="__bundler_thumbnail"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#FAF6EF"/><rect x="30" y="30" width="40" height="40" rx="10" fill="#6E5B8C"/><text x="50" y="57" font-family="Georgia,serif" font-style="italic" font-size="18" fill="#FFFCF7" text-anchor="middle">3Q</text></svg></template>
<div class="ambient"></div>
<div class="grain"></div>
<div id="root"><h1>整整三年，不用花你一塊錢。</h1><p>政府每年釋出數百億的補助與政策性貸款。3Q孵化所：補助媒合 × 計畫書代撰 × 募資架構設計。追蹤中：中央型 SBIR、SIIR、台中地方型 SBIR、CITD、青創貸款、數位轉型補助、雲市集 TCloud、產創 23-2。</p><p><a href="/assess">免費補助評估（3 個問題、1 分鐘）</a> · <a href="/contact">聯絡 3Q</a></p></div>

<script type="text/babel">
const { Button, Badge, ServiceCard, StatBadge } = window.DesignSystem_8e9232;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "headline": "品牌主張",
  "ctaLabel": "開始補助評估",
  "showTrustWall": true
}/*EDITMODE-END*/;

/* ── 數字 count-up（reduced-motion 直接顯示） ── */
function CountUp({ end, suffix = '', prefix = '' }) {
  const [val, setVal] = React.useState(0);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setVal(end); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(el);
        const t0 = performance.now();
        const dur = 900;
        const tick = (t) => {
          const p = Math.min(1, (t - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          setVal(Math.round(end * eased));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [end]);
  return <span ref={ref}>{prefix}{val.toLocaleString()}{suffix}</span>;
}

const HEADLINES = {
  '品牌主張': { line1: '整整三年，', line2: '不用花你一塊錢。' },
  '數據開場': { line1: '該拿的資源，', line2: '一項都不漏。' },
};

function Hero({ t }) {
  const h = HEADLINES[t.headline] || HEADLINES['品牌主張'];
  return (
    <section data-screen-label="首頁 Hero" style={{
      paddingTop: 'clamp(120px, 16vw, 180px)',
      paddingBottom: 'var(--section-y-sm)',
      background: 'linear-gradient(165deg, #FBF8F2, #F1E8DA)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div className="watermark" style={{ fontSize: 'clamp(260px, 28vw, 400px)', right: -50, top: -36 }}>3Q</div>
      <div className="container hero-grid">
        <Reveal>
          <div className="doc-no" style={{ marginBottom: 20 }}>3Q INCUBATION OFFICE — 評估基準日 2026.06</div>
          <h1 className="h1" style={{ fontSize: 'clamp(38px, 5.6vw, 80px)' }}>{h.line1}<br /><span style={{ display: 'inline-block', marginLeft: '1.1em' }}>{h.line2}</span></h1>
          <div className="accent-en" style={{ marginTop: 14, whiteSpace: 'nowrap', fontSize: 'clamp(17px, 2.2vw, 28px)' }}>find the money that&rsquo;s already yours</div>
          <p className="body2" style={{ marginTop: 18, maxWidth: '44ch', fontSize: 'var(--text-body-lg)' }}>
            政府每年釋出數百億的補助與政策性貸款，多數中小企業主不知道從哪裡開始。
            我們把現行計畫逐條讀完、逐條比對，幫你找到對的資源，走對的申請路徑。
          </p>
          <div style={{ display: 'flex', gap: 14, marginTop: 32, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button variant="primary" href="assess.html">{t.ctaLabel} →</Button>
            <Button variant="ghost" href="#services">我們怎麼做</Button>
          </div>
        </Reveal>
        <Reveal delay={120} className="hero-media" style={{ position: 'relative', paddingRight: 34 }}>
          <image-slot id="home-hero" shape="rounded" radius="22"
            placeholder="放一張工作情境照（4:5）"
            style={{ width: '100%', aspectRatio: '4 / 5', maxHeight: 520, display: 'block', boxShadow: 'var(--shadow)' }}>
          </image-slot>
          <div className="vtext doc-no hero-vtext" style={{ position: 'absolute', top: 8, right: 0, height: '60%' }}>補助媒合 · 計畫書 · 募資架構</div>
          <StatBadge
            stat="12+"
            label="現行可申請的補助與資源"
            sublabel="2026 年 6 月盤點"
            style={{ position: 'absolute', bottom: -18, left: -14 }}
          />
        </Reveal>
      </div>
    </section>
  );
}

function TrustBar() {
  const programs = ['中央型 SBIR', 'SIIR', '台中地方型 SBIR', 'CITD', '青創貸款', '數位轉型補助', '雲市集 TCloud', '產創 23-2', '國貿署拓銷'];
  const loop = [...programs, ...programs];
  return (
    <section className="section-sm" data-screen-label="合作計畫帶">
      <div className="container">
        <Reveal>
          <div className="perf" style={{ marginBottom: 18 }}>
            <span className="doc-no">我們追蹤、申請、陪跑的計畫</span>
          </div>
        </Reveal>
      </div>
      <Reveal>
        <div className="marquee">
          <div className="marquee-track">
            {loop.map((p, i) => <span key={i} className="chip">{p}</span>)}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className="section" data-screen-label="三項服務" style={{ paddingTop: 'var(--section-y-sm)' }}>
      <div className="container">
        <SectionHead
          eyebrow="WHAT WE DO"
          en="three things, done properly"
          title="我們做三件事"
          sub="不是什麼都做。只做我們親身走過、確定能幫你省時間和拿到結果的三件事。"
        />
        <Reveal className="svc-row">
          <ServiceCard
            number="01"
            title="補助健檢與媒合"
            description="依你的業態、登記地、員工數，逐條比對現行的補助計畫，列出能申請什麼、何時截止、值不值得投。先看清楚全貌，再決定衝哪一個。"
            imagePosition="left"
            href="assess.html"
            linkLabel="先做免費評估 →"
          />
        </Reveal>
        <Reveal className="svc-row">
          <ServiceCard
            number="02"
            title="計畫書代撰與核銷陪跑"
            description="SBIR、SIIR、地方型計畫書怎麼寫才過？我們處理計畫書、評審簡報到結案核銷的每一步。報價單列到一個工作項，簽了什麼範圍就是什麼範圍。"
            imagePosition="right"
            href="contact.html"
            linkLabel="問我們怎麼進行 →"
          />
        </Reveal>
        <Reveal className="svc-row">
          <ServiceCard
            number="03"
            title="募資架構與租稅設計"
            description="要募天使輪？產創條例 23-2 讓投資人每年最高省稅 500 萬，但公司型態和核定資格要先弄對。我們幫你把架構鋪好，再去見投資人。"
            imagePosition="left"
            href="contact.html"
            linkLabel="了解募資鋪路 →"
          />
        </Reveal>
      </div>
    </section>
  );
}

function TrustWall() {
  const stats = [
    { end: 12, suffix: '+', label: '現行追蹤中的補助與資源' },
    { end: 1200, prefix: '', suffix: ' 萬', label: '中央型 SBIR 全程補助上限' },
    { end: 50, suffix: '%', label: '研發補助比例上限' },
    { end: 500, suffix: ' 萬', label: '天使投資人年節稅上限（產創 23-2）' },
  ];
  return (
    <section className="section" data-screen-label="信任牆" style={{ background: 'var(--dark)', position: 'relative', overflow: 'hidden' }}>
      <div className="watermark" style={{ fontSize: 'clamp(140px, 16vw, 230px)', left: -20, bottom: -40, opacity: .08 }}>subsidy</div>
      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <SectionHead
          dark
          eyebrow="WHY IT MATTERS"
          en="the numbers are real"
          title="這些額度，每年都在那裡"
          sub="不是行銷話術。每一個數字都來自現行法規與計畫公告，差別只在有沒有人幫你把路徑走通。"
        />
        <div className="stat-grid">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 90}>
              <div style={{
                fontFamily: 'var(--font-accent)', fontStyle: 'italic',
                fontSize: 'clamp(30px, 4.2vw, 56px)', color: 'var(--lavs)', lineHeight: 1.15,
                whiteSpace: 'nowrap',
              }}>
                <CountUp end={s.end} prefix={s.prefix || ''} suffix={s.suffix} />
              </div>
              <div style={{ fontSize: 14, color: 'rgba(255,252,247,.5)', marginTop: 10, lineHeight: 1.7 }}>{s.label}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function AssessTeaser({ t }) {
  return (
    <section className="section" data-screen-label="評估導流">
      <div className="container" style={{ display: 'flex', justifyContent: 'center' }}>
        <Reveal style={{ width: '100%', maxWidth: 760 }}>
          <div style={{
            position: 'relative', textAlign: 'center',
            background: 'var(--paper)', borderRadius: 'var(--card-radius)',
            border: '1.5px dashed var(--border-strong)',
            padding: 'clamp(36px, 6vw, 64px) clamp(24px, 5vw, 56px)',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <span className="stamp stamp--yes" style={{ position: 'absolute', top: -16, right: 32, background: 'var(--paper)', fontSize: 15 }}>免費</span>
            <div className="doc-no" style={{ marginBottom: 16 }}>SELF ASSESSMENT — 約 1 分鐘</div>
            <h2 className="h2" style={{ fontSize: 'clamp(26px, 3.6vw, 38px)' }}>三個問題，找出你的補助路徑</h2>
            <p className="body2" style={{ marginTop: 14, marginBottom: 28 }}>
              不用登入、不用留個資。回答三個問題，立刻看到你能申請哪些計畫。
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 30 }}>
              <Badge variant="brand" dot>主要業態</Badge>
              <Badge variant="clay" dot>登記地</Badge>
              <Badge variant="neutral" dot>員工人數</Badge>
            </div>
            <Button variant="primary" size="lg" href="assess.html">{t.ctaLabel} →</Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  return (
    <div>
      <SiteNav active="home" />
      <Hero t={t} />
      <TrustBar />
      <Services />
      {t.showTrustWall && <TrustWall />}
      <AssessTeaser t={t} />
      <SiteFooter />
      <TweaksPanel>
        <TweakSection label="Hero" />
        <TweakRadio label="主標文案" value={t.headline}
          options={['品牌主張', '數據開場']}
          onChange={(v) => setTweak('headline', v)} />
        <TweakText label="CTA 文字" value={t.ctaLabel}
          onChange={(v) => setTweak('ctaLabel', v)} />
        <TweakSection label="區塊" />
        <TweakToggle label="深色信任牆" value={t.showTrustWall}
          onChange={(v) => setTweak('showTrustWall', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
</script>
</body>
</html>
` },
  "/3q-fonts.js": { ct: "text/javascript; charset=utf-8", body: `/* 執行期注入 Google Fonts —— 網址拆段組裝，避免打包器將 10MB+ 中文字型內嵌進單檔 */
(function () {
  var GG = ['https:/', '/fonts.googleapis.com'].join('');
  var GS = ['https:/', '/fonts.gstatic.com'].join('');
  var Q = 'css2?family=Noto+Sans+TC:wght@400;500;700'
        + '&family=Noto+Serif+TC:wght@600;700;900'
        + '&family=Cormorant+Garamond:ital,wght@1,500;1,600'
        + '&display=swap';
  var pre1 = document.createElement('link');
  pre1.rel = 'preconnect'; pre1.href = GG;
  var pre2 = document.createElement('link');
  pre2.rel = 'preconnect'; pre2.href = GS; pre2.crossOrigin = 'anonymous';
  var l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = GG + '/' + Q;
  document.head.appendChild(pre1);
  document.head.appendChild(pre2);
  document.head.appendChild(l);
})();
` },
  "/contact.html": { ct: "text/html; charset=utf-8", body: `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>聯絡合作 · 3Q孵化所</title>
  <meta property="og:type" content="website">
  <meta property="og:title" content="聯絡合作｜3Q孵化所">
  <meta property="og:description" content="預約免費補助健檢，或洽投資合作。半小時內告訴你下一步。">
  <meta property="og:image" content="https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/og-3q-site.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="https://3q-site.milk790.workers.dev/contact">
  <link rel="canonical" href="https://3q-site.milk790.workers.dev/contact">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="description" content="預約免費補助健檢，或洽投資合作。半小時內告訴你下一步。">
  <link rel="stylesheet" href="3q-typography.css">
  <script src="3q-fonts.js"></script>
  <link rel="stylesheet" href="_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/tokens/colors.css">
  <link rel="stylesheet" href="_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/tokens/spacing.css">
  <link rel="stylesheet" href="_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/tokens/effects.css">
  <link rel="stylesheet" href="_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/styles.css">
  <link rel="stylesheet" href="3q-shared.css">
  <script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y" crossorigin="anonymous"></script>
  <script src="_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/_ds_bundle.js"></script>
  <script src="image-slot.js"></script>
  <script type="text/babel" src="3q-shared.jsx"></script>
</head>
<body>
<template id="__bundler_thumbnail"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#FAF6EF"/><rect x="30" y="30" width="40" height="40" rx="10" fill="#2E2838"/><text x="50" y="57" font-family="Georgia,serif" font-style="italic" font-size="18" fill="#C7B8DE" text-anchor="middle">3Q</text></svg></template>
<div class="ambient"></div>
<div class="grain"></div>
<div id="root"></div>

<script type="text/babel">
const { Button, Badge } = window.DesignSystem_8e9232;

function App() {
  return (
    <div>
      <SiteNav active="contact" />

      {/* Header */}
      <section data-screen-label="聯絡頁標題" style={{
        paddingTop: 'clamp(110px, 14vw, 160px)', paddingBottom: 'var(--section-y-sm)',
        background: 'linear-gradient(165deg, #FBF8F2, #F1E8DA)',
      }}>
        <div className="container">
          <Reveal>
            <div className="doc-no" style={{ marginBottom: 16 }}>CONTACT — 一個工作天內回覆</div>
            <h1 className="h2">聊聊你的事業體</h1>
            <div className="accent-en" style={{ marginTop: 8, fontSize: 21 }}>no pitch, just answers</div>
            <p className="body2" style={{ marginTop: 12, maxWidth: '56ch' }}>
              不推銷、不硬聊。半小時內告訴你：能申請什麼、值不值得投、下一步是什麼。
            </p>
          </Reveal>
        </div>
      </section>

      {/* Two paths */}
      <section className="section-sm" data-screen-label="聯絡卡片">
        <div className="container contact-grid">
          {/* For SMEs */}
          <Reveal>
            <div className="card" style={{ padding: 'var(--card-pad)' }}>
              <Badge variant="brand" dot>中小企業主</Badge>
              <h2 className="h3" style={{ marginTop: 16, marginBottom: 10 }}>預約免費補助健檢</h2>
              <p className="body2" style={{ fontSize: 14.5, marginBottom: 24 }}>
                為避免網頁保存個資，預約改由你主動開啟 LINE，再由客服接手。
              </p>
              <div data-growth-contact-mode="line-only" style={{
                display: 'flex', flexDirection: 'column', gap: 16,
                padding: '28px 22px', background: 'var(--cream)',
                borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)',
              }}>
                <div className="h3" style={{ fontSize: 18, color: 'var(--lavd)' }}>改用 LINE 完成預約</div>
                <p className="caption">本站不在網頁收集姓名、電話、Email 或 LINE ID，也不顯示未送出的成功訊息。</p>
                <Button variant="primary" href="https://lin.ee/VZvs7sj" target="_blank">加 LINE 預約免費補助健檢 →</Button>
                <div className="caption">本頁僅自動送出不含姓名、電話、Email、LINE ID 的匿名瀏覽與 CTA 成效事件；LINE 訊息仍由你主動送出。</div>
              </div>
            </div>
          </Reveal>

          {/* For investors / partners */}
          <Reveal delay={120}>
            <div className="card" style={{ padding: 'var(--card-pad)', background: 'var(--dark)', border: 'none', position: 'relative', overflow: 'hidden' }}>
              <div className="watermark" style={{ fontSize: 'clamp(110px, 12vw, 170px)', right: -24, bottom: -34, opacity: .08 }}>invest</div>
              <Badge variant="dark" dot style={{ background: 'var(--lav)' }}>投資人・合作夥伴</Badge>
              <h2 className="h3" style={{ marginTop: 16, marginBottom: 10, color: '#FFFCF7' }}>投資與合作洽談</h2>
              <p style={{ fontSize: 14.5, lineHeight: 1.85, color: 'rgba(255,252,247,.55)', marginBottom: 24 }}>
                我們正在把補助媒合做成可規模化的服務。
                想了解商業模式、財務規劃或合作空間，直接約一次線上會議。
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
                {[
                  ['投資人稅務誘因', '產創 23-2：投資 50 萬起，每年最高減除 500 萬'],
                  ['搭配資源', '國發基金天使方案：單案搭配投資最高 2,000 萬'],
                  ['公司架構', '股份有限公司＋高風險新創核定，鋪路完成後啟動募資'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 12, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--lavs)', fontWeight: 700, letterSpacing: 1 }}>{k}</span>
                    <span style={{ fontSize: 13.5, color: 'rgba(255,252,247,.6)', lineHeight: 1.7 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button variant="primary">約一次線上會議</Button>
                <Button variant="ghost" style={{ borderColor: 'rgba(255,252,247,.3)', color: 'rgba(255,252,247,.8)' }}>索取投資簡報</Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* LINE 情報推播 */}
      <section className="section-sm" data-screen-label="LINE 情報推播">
        <div className="container">
          <Reveal>
            <div style={{
              position: 'relative',
              background: 'var(--paper)', borderRadius: 'var(--card-radius)',
              border: '1.5px dashed var(--border-strong)',
              padding: 'clamp(28px, 4vw, 44px)',
              display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center',
            }}>
              <div>
                <div className="doc-no" style={{ marginBottom: 10 }}>LINE — 補助情報推播</div>
                <h2 className="h3" style={{ marginBottom: 10 }}>梯次一開，你第一個知道</h2>
                <p className="body2" style={{ fontSize: 14.5, maxWidth: '56ch', marginBottom: 16 }}>
                  加 LINE 之後我們只推三種訊息：新梯次公告、你關注計畫的截止倒數、每月一次的資源盤點。不推銷、不洗版。
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Badge variant="brand" dot>新梯次公告</Badge>
                  <Badge variant="clay" dot>截止倒數提醒</Badge>
                  <Badge variant="neutral" dot>每月資源盤點</Badge>
                </div>
              </div>
              <Button variant="primary" href="https://lin.ee/VZvs7sj" target="_blank">加 LINE 收情報</Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Founder */}
      <section className="section-sm" data-screen-label="創辦人">
        <div className="container">
          <Reveal>
            <div className="card founder-grid" style={{ padding: 'var(--card-pad)' }}>
              <image-slot id="founder-avatar" shape="circle"
                placeholder="創辦人照片"
                style={{ width: 120, height: 120, display: 'block' }}>
              </image-slot>
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>FOUNDER</div>
                <div className="h3" style={{ marginBottom: 8 }}>陳學誼</div>
                <p className="body2" style={{ fontSize: 14.5, maxWidth: '56ch' }}>
                  米速 Miso、泡泡怪獸、丹若多品牌事業體創辦人。
                  每一條申請路徑都自己先走過一遍，再帶你走。
                </p>
              </div>
              <Button variant="text" href="assess.html">先做免費評估 →</Button>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
</script>
</body>
</html>
` },
  "/assess.html": { ct: "text/html; charset=utf-8", body: `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>補助評估 · 3Q孵化所</title>
  <meta property="og:type" content="website">
  <meta property="og:title" content="1 分鐘查你能領哪些補助｜3Q孵化所">
  <meta property="og:description" content="不用登入、不留個資。回答三個問題，立刻比對現行政府補助計畫。">
  <meta property="og:image" content="https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/og-3q-site.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="https://3q-site.milk790.workers.dev/assess">
  <link rel="canonical" href="https://3q-site.milk790.workers.dev/assess">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="description" content="不用登入、不留個資。回答三個問題，立刻比對現行政府補助計畫。">
  <link rel="stylesheet" href="3q-typography.css">
  <script src="3q-fonts.js"></script>
  <link rel="stylesheet" href="_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/tokens/colors.css">
  <link rel="stylesheet" href="_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/tokens/spacing.css">
  <link rel="stylesheet" href="_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/tokens/effects.css">
  <link rel="stylesheet" href="_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/styles.css">
  <link rel="stylesheet" href="3q-shared.css">
  <style>
    @media print {
      .site-nav, .tool-form, .site-footer, .ambient, .grain,
      section[data-screen-label="評估後導流"], .no-print { display: none !important; }
      .reveal { opacity: 1 !important; transform: none !important; }
      .tool-grid { grid-template-columns: 1fr !important; }
      body { background: #fff; }
      .card { box-shadow: none !important; break-inside: avoid; }
      section { padding-top: 16px !important; padding-bottom: 16px !important; }
    }
  </style>
  <script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y" crossorigin="anonymous"></script>
  <script src="_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/_ds_bundle.js"></script>
  <script type="text/babel" src="3q-shared.jsx"></script>
</head>
<body>
<template id="__bundler_thumbnail"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#FAF6EF"/><rect x="30" y="30" width="40" height="40" rx="10" fill="#C2956A"/><text x="50" y="57" font-family="Georgia,serif" font-style="italic" font-size="18" fill="#FFFCF7" text-anchor="middle">3Q</text></svg></template>
<div class="ambient"></div>
<div class="grain"></div>
<div id="root"></div>

<script type="text/babel">
const { Button, Badge } = window.DesignSystem_8e9232;

/* ── 評估邏輯（資料時點 2026/6，以官方公告為準） ──
   match(a) 回傳 { level: 'yes' | 'maybe' | 'no', reason } */
const PROGRAMS = [
  {
    id: 'tc-sbir', name: '台中市地方型 SBIR', org: '臺中市政府經濟發展局',
    amt: '100 萬', amtNote: '個別申請上限', stars: 3, lvl: 2,
    timing: '115 年度受理中 · 至 6/26 中午 12 時止（紙本送件）',
    note: '與登記地最契合、門檻最低的研發補助。補助不超過總經費 50%，需自籌等額。計畫辦公室專線 04-2358-4951。',
    match(a) {
      if (!a.rnd) return { level: 'no', reason: '需要有研發或創新題目' };
      if (a.city !== '台中市') return { level: 'no', reason: '需設立並執行於台中市' };
      return { level: 'yes', reason: '正在受理——距 6/26 截止只剩約兩週，立刻備件送出' };
    },
  },
  {
    id: 'sbir-p1', name: '中央型 SBIR Phase 1', org: '經濟部中小及新創企業署',
    amt: '150 萬', amtNote: 'Phase 1 上限（2026 起調高）', stars: 3, lvl: 3,
    timing: '全年隨到隨受理 · 核定約 4–6 個月',
    note: '不限產業。Phase 2 每年上限 600 萬、全程 1,200 萬。2026 起新增專利申請費補助。',
    match(a) {
      if (!a.rnd) return { level: 'no', reason: '需要有研發或創新題目' };
      return { level: 'yes', reason: '全年可投，適合從容打磨計畫書後送件' };
    },
  },
  {
    id: 'digital', name: '30 人以下數位轉型補助', org: '經濟部中小及新創企業署',
    amt: '10 萬', amtNote: '單一企業上限', stars: 2, lvl: 1,
    timing: '114 梯次已結束 · 115 年度以公告為準',
    note: '完成 12 小時數位課程＋軟體應用，實報實銷。墊高 AI／雲端工具預算的最佳小額資源。',
    match(a) {
      if (a.heads === '超過 30 人') return { level: 'no', reason: '限員工 30 人以下（以勞保投保人數為準）' };
      return { level: 'maybe', reason: '上一梯已於 2025 年底截止——等 115 年度公告，先把課程與軟體清單備好' };
    },
  },
  {
    id: 'loan', name: '青年創業及啟動金貸款', org: '經濟部中小及新創企業署',
    amt: '600 萬', amtNote: '週轉金上限（資本支出 1,200 萬）', stars: 2, lvl: 2,
    timing: '全年受理 · 申請到撥款約 7–30 天',
    note: '政策性低利貸款（約 2.295%），100 萬以下補貼 5 年利息。需修滿 20 小時創業課程。',
    match(a) {
      if (!a.age1845) return { level: 'no', reason: '負責人需年滿 18–45 歲' };
      if (a.years === '8 年以上') return { level: 'no', reason: '限設立登記未滿 8 年' };
      return { level: 'yes', reason: '是貸款不是補助——可與研發補助並行' };
    },
  },
  {
    id: 'tcloud', name: '雲市集 TCloud 數位點數', org: '數位發展部數位產業署',
    amt: '3 萬', amtNote: '點數上限（1 點＝1 元）', stars: 1, lvl: 1,
    timing: '歷史額度已停發 · 2026 是否重啟待公告',
    note: '可折抵雲端 SaaS（CRM、官方帳號、POS 等）。平台目前以訂閱黃頁形式運作，點數補助未重啟。',
    match() {
      return { level: 'maybe', reason: '2026 是否有新一波點數，以 tcloud.gov.tw 公告為準' };
    },
  },
  {
    id: 'siir', name: 'SIIR 服務業創新研發', org: '經濟部商業發展署',
    amt: '150 萬', amtNote: '個別創新上限', stars: 2, lvl: 3,
    timing: '2026 梯次已截止 · 2027 梯次約 12 月公告',
    note: '聚焦服務模式創新（智慧化、低碳化）。每企業 3 年內累計補助不超過 2 案。',
    match(a) {
      if (a.industry === '製造業') return { level: 'no', reason: '以服務業創新為主，製造業改走 SBIR / CITD' };
      return { level: 'maybe', reason: '2026 已截止——現在開始準備 2027 梯次正好' };
    },
  },
  {
    id: 'citd', name: 'CITD 傳統產業技術開發', org: '經濟部產業發展署',
    amt: '200 萬', amtNote: '產品開發上限', stars: 2, lvl: 2,
    timing: '115 年度已截止（2/9）· 每年約 12–2 月受理',
    note: '製造業需有工廠登記；資訊服務等技術服務業亦可。另有「研發轉型個案補助」常態受理至經費用罄。',
    match(a) {
      if (a.industry === '製造業') return { level: 'maybe', reason: '主梯次等 116 年度（約 12 月公告）；工廠登記是關鍵門檻，可先評估研發轉型個案補助' };
      if (a.industry === '科技・資訊') return { level: 'maybe', reason: '以技術服務業身分申請，需符合資格認定；主梯次等 116 年度' };
      return { level: 'no', reason: '限製造業或技術服務業' };
    },
  },
  {
    id: 'trade', name: '補助業界開發國際市場', org: '經濟部國際貿易署',
    amt: '500 萬', amtNote: '單家最高', stars: 2, lvl: 3,
    timing: '每年約 5–8 月受理次年度 · 盯 imdp.org.tw',
    note: '以布建海外行銷通路為主（不含參展、拓銷團）。需出進口廠商登記且近 1 年有出進口實績。',
    match(a) {
      if (!a.exporter) return { level: 'no', reason: '需有出進口廠商登記與近 1 年出進口實績' };
      return { level: 'yes', reason: '116 年度受理窗口預估快開——現在開始備通路布建計畫正好' };
    },
  },
  {
    id: 'angel', name: '國發基金 創業天使投資方案', org: '國家發展基金',
    amt: '2,000 萬', amtNote: '單案最高（後續累計最高 1 億）', stars: 2, lvl: 3,
    timing: '常態受理',
    note: '需天使投資人或加速器搭配投資。搭配產創 23-2，投資人每年最高省稅 500 萬。',
    match(a) {
      if (a.years === '8 年以上') return { level: 'no', reason: '限設立未逾 8 年' };
      return { level: 'maybe', reason: '需先找到搭配投資的天使或加速器——募資架構先鋪好' };
    },
  },
  {
    id: 'phoenix', name: '微型創業鳳凰貸款', org: '勞動部勞動力發展署',
    amt: '200 萬', amtNote: '貸款上限 · 前 2 年免息', stars: 1, lvl: 2,
    timing: '全年受理',
    note: '利率約 2.295%，免保人免擔保。',
    match(a) {
      if (!a.female45) return { level: 'no', reason: '限女性、45 歲以上或離島居民' };
      return { level: 'yes', reason: '符合身分——前 2 年利息全額補貼，划算' };
    },
  },
];

const Q = [
  { key: 'industry', label: '主要業態', opts: ['製造業', '服務業', '電商・零售', '科技・資訊'] },
  { key: 'city', label: '登記地', opts: ['台中市', '其他縣市'] },
  { key: 'heads', label: '員工人數（勞保）', opts: ['未滿 5 人', '5–30 人', '超過 30 人'] },
  { key: 'years', label: '公司設立年資', opts: ['未滿 1 年', '1–5 年', '5–8 年', '8 年以上'] },
];

const TOGGLES = [
  { key: 'rnd', label: '有研發或創新題目', hint: 'AI、自動化、新服務模式都算' },
  { key: 'age1845', label: '負責人年齡 18–45 歲', hint: '青創貸款資格' },
  { key: 'exporter', label: '有出口實績', hint: '出進口廠商登記' },
  { key: 'female45', label: '負責人為女性或 45 歲以上', hint: '鳳凰貸款資格' },
];

const LEVEL_META = {
  yes: { label: '符合', cls: 'stamp--yes', order: 0 },
  maybe: { label: '待確認', cls: 'stamp--maybe', order: 1 },
  no: { label: '不符', cls: 'stamp--no', order: 2 },
};

function Dots({ n }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, verticalAlign: 'middle' }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 8, height: 8, borderRadius: 2,
          background: i < n ? 'var(--lavd)' : 'var(--line)',
        }}></span>
      ))}
    </span>
  );
}

function ProgramCard({ p, result, delay }) {
  const meta = LEVEL_META[result.level];
  const dim = result.level === 'no';
  return (
    <Reveal delay={delay}>
      <div className="card prog-grid" data-screen-label={p.name} style={{
        padding: 'clamp(20px, 3vw, 30px)',
        opacity: dim ? 0.55 : 1,
        transition: 'opacity var(--t-base) var(--ease)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span className={\`stamp \${meta.cls}\`} style={{ fontSize: 12.5, flexShrink: 0 }}>{meta.label}</span>
            <span className="h3" style={{ fontSize: 19 }}>{p.name}</span>
          </div>
          <div className="caption" style={{ marginTop: 6 }}>{p.org} · {p.timing}</div>
          <p className="body2" style={{ fontSize: 14.5, marginTop: 10, maxWidth: '58ch', lineHeight: 1.8 }}>{p.note}</p>
          <div style={{
            marginTop: 12, fontSize: 14, color: dim ? 'var(--ink2)' : 'var(--lavd)',
            fontWeight: 500, display: 'flex', alignItems: 'baseline', gap: 8,
          }}>
            <span style={{ flexShrink: 0 }}>{result.level === 'no' ? '原因：' : '建議：'}</span>
            <span>{result.reason}</span>
          </div>
        </div>
        <div className="prog-side">
          <div style={{
            fontFamily: 'var(--font-accent)', fontStyle: 'italic',
            fontSize: 34, color: dim ? 'var(--fg-tertiary)' : 'var(--lavd)', lineHeight: 1,
          }}>{p.amt}</div>
          <div className="caption" style={{ marginTop: 4 }}>{p.amtNote}</div>
          <div className="caption" style={{ marginTop: 10 }}>申請難度 <Dots n={p.lvl} /></div>
          {!dim && (
            <div style={{ marginTop: 14 }}>
              <Button variant="text" size="sm" href="contact.html">問 3Q 怎麼申請 →</Button>
            </div>
          )}
        </div>
      </div>
    </Reveal>
  );
}

function App() {
  const [a, setA] = React.useState({
    industry: '服務業', city: '台中市', heads: '5–30 人', years: '1–5 年',
    rnd: true, age1845: true, exporter: false, female45: false,
  });
  const set = (k, v) => setA((prev) => ({ ...prev, [k]: v }));

  const results = PROGRAMS
    .map((p) => ({ p, r: p.match(a) }))
    .sort((x, y) => (LEVEL_META[x.r.level].order - LEVEL_META[y.r.level].order) || (y.p.stars - x.p.stars));
  const nYes = results.filter((x) => x.r.level === 'yes').length;
  const nMaybe = results.filter((x) => x.r.level === 'maybe').length;

  return (
    <div>
      <SiteNav active="assess" />
      {/* Header */}
      <section data-screen-label="評估頁標題" style={{
        paddingTop: 'clamp(110px, 14vw, 160px)', paddingBottom: 'var(--section-y-sm)',
        background: 'linear-gradient(165deg, #FBF8F2, #F1E8DA)',
      }}>
        <div className="container" style={{ position: 'relative' }}>
          <Reveal>
            <div className="doc-no" style={{ marginBottom: 16 }}>SUBSIDY MATCH — 評估基準日 2026.06.10</div>
            <h1 className="h2">三個問題，找出你的補助路徑</h1>
            <div className="accent-en" style={{ marginTop: 8, fontSize: 21 }}>change a condition, watch the list re-rank</div>
            <p className="body2" style={{ marginTop: 12, maxWidth: '56ch' }}>
              不用登入、不留個資。改一個條件，右邊的結果立刻跟著變。
              金額與梯次以官方最新公告為準。
            </p>
          </Reveal>
        </div>
      </section>

      {/* Tool */}
      <section className="section-sm" data-screen-label="評估工具">
        <div className="container tool-grid">
          {/* Form */}
          <div className="card tool-form" style={{ padding: 26 }}>
            <div className="h3" style={{ fontSize: 17, marginBottom: 18 }}>你的條件</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {Q.map((q) => (
                <div key={q.key}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink2)', marginBottom: 8, letterSpacing: .5 }}>{q.label}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {q.opts.map((o) => (
                      <button key={o} type="button"
                        className={\`opt-btn \${a[q.key] === o ? 'on' : ''}\`}
                        style={{ padding: '8px 12px', fontSize: 13.5, justifyContent: 'center' }}
                        onClick={() => set(q.key, o)}>{o}</button>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {TOGGLES.map((tg) => (
                  <button key={tg.key} type="button"
                    className={\`opt-btn \${a[tg.key] ? 'on' : ''}\`}
                    onClick={() => set(tg.key, !a[tg.key])}>
                    <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{a[tg.key] ? '◉' : '○'}</span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 13.5 }}>{tg.label}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: a[tg.key] ? 'var(--lavd)' : 'var(--fg-tertiary)', opacity: a[tg.key] ? .75 : 1, fontWeight: 400 }}>{tg.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          <div>
            <Reveal>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
                <span className="h3">
                  符合 <span style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', fontSize: 30, color: 'var(--lavd)' }}>{nYes}</span> 項
                  · 待確認 <span style={{ fontFamily: 'var(--font-accent)', fontStyle: 'italic', fontSize: 30, color: 'var(--clay)' }}>{nMaybe}</span> 項
                </span>
                <span className="caption">依優先度排序 · 不符合的灰色顯示在最後</span>
                <button type="button" className="opt-btn no-print" style={{ width: 'auto', minHeight: 0, padding: '6px 14px', fontSize: 12.5, marginLeft: 'auto' }}
                  onClick={() => window.print()}>把結果存成 PDF</button>
              </div>
            </Reveal>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {results.map(({ p, r }, i) => (
                <ProgramCard key={p.id} p={p} result={r} delay={Math.min(i * 60, 240)} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-sm" data-screen-label="評估後導流" style={{ background: 'var(--dark)', position: 'relative', overflow: 'hidden' }}>
        <div className="watermark" style={{ fontSize: 'clamp(120px, 14vw, 200px)', right: -20, top: -30, opacity: .08 }}>apply</div>
        <div className="container" style={{ textAlign: 'center', paddingTop: 28, paddingBottom: 28, position: 'relative', zIndex: 1 }}>
          <Reveal>
            <h2 className="h3" style={{ color: '#FFFCF7', fontSize: 24 }}>結果只是起點。要拿到，得把計畫書寫對。</h2>
            <p style={{ color: 'rgba(255,252,247,.5)', fontSize: 15, marginTop: 10, marginBottom: 26 }}>
              把你的評估結果帶來，我們半小時內告訴你：值不值得投、怎麼投、何時投。
            </p>
            <Button variant="primary" href="contact.html">預約免費補助健檢 →</Button>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
</script>
</body>
</html>
` },
  "/README-\u90e8\u7f72\u8aaa\u660e.md": { ct: "text/markdown; charset=utf-8", body: `# 3Q 網站部署說明（給網頁版 Claude / Cloudflare）

## 內容
- \`index.html\` 首頁（原 3Q 首頁.html）
- \`assess.html\` 補助評估（原 3Q 補助評估.html）
- \`contact.html\` 聯絡合作（原 3Q 聯絡.html）
- 其餘為相依資源（共用樣式、設計系統 tokens、元件 bundle、字型注入器）

## 部署方式（擇一）
1. **Cloudflare Pages**：整個資料夾直接拖上去即可，零設定。
2. **既有 Worker（3q-sales-ai）**：把所有檔案放入靜態資產（Assets）或 KV，
   保持資料夾相對路徑不變（\`_ds/.../tokens/*.css\` 的巢狀路徑必須保留）。

## 已設定好的事
- 三頁互連已用 ASCII 檔名（index / assess / contact）。
- LINE 連結＝ https://lin.ee/VZvs7sj（聯絡頁兩處）。
- OG 預覽圖指向 https://3q-sales-ai.milk790.workers.dev/og.png（Worker 既有路由）。
- 字型由 \`3q-fonts.js\` 執行期載入 Google CDN，HTML 檔案保持輕量。

## 部署後檢查
1. 三頁互點導覽列，路徑都通。
2. LINE 按鈕開啟 lin.ee/VZvs7sj。
3. FB 分享偵錯器刷新快取後，貼網址有預覽圖。
` },
  "/3q-shared.jsx": { ct: "text/javascript; charset=utf-8", body: `/* 3q-shared.jsx — 3Q孵化所 共用元件（SiteNav / SiteFooter / Reveal / SectionHead） */

const { Button: DSButton, Badge: DSBadge } = window.DesignSystem_8e9232;

/* ── Scroll reveal ── */
function Reveal({ children, as = 'div', delay = 0, style = {}, className = '' }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let io = null;
    let shown = false;
    let timer = null;
    const show = (instant) => {
      if (shown) return;
      shown = true;
      if (instant) {
        /* paint 暫停環境（截圖/匯出）transition 不前進——直接跳到結束狀態 */
        el.style.transition = 'none';
        el.classList.add('in');
        requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = ''; }));
      } else {
        el.classList.add('in');
      }
      cleanup();
    };
    const inView = () => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.95 && r.bottom > 0;
    };
    const fallback = () => { if (inView()) show(true); };
    const onScroll = () => { timer = setTimeout(fallback, 180); };
    function cleanup() {
      if (io) io.disconnect();
      if (timer) clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    }
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (e.isIntersecting) show(false); }),
        { threshold: 0.12 }
      );
      io.observe(el);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    timer = setTimeout(fallback, 350); /* IO 沒在 350ms 內處理首屏 → 後備直接顯示 */
    return cleanup;
  }, []);
  const Tag = as;
  return (
    <Tag
      ref={ref}
      className={\`reveal \${className}\`}
      style={{ transitionDelay: \`\${delay}ms\`, ...style }}
    >
      {children}
    </Tag>
  );
}

/* ── Nav ── */
function SiteNav({ active }) {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const links = [
    ['首頁', 'index.html', 'home'],
    ['補助評估', 'assess.html', 'assess'],
    ['聯絡合作', 'contact.html', 'contact'],
  ];
  return (
    <nav className={\`site-nav \${scrolled ? 'scrolled' : ''}\`}>
      <div className="nav-inner">
        <a className="logo-lockup" href="index.html">
          <span className="logo-mark">3Q</span>
          <span className="logo-word">孵化所</span>
        </a>
        <div className="nav-links">
          {links.map(([label, href, key]) => (
            <a key={key} className={\`nav-link \${active === key ? 'active' : ''}\`} href={href}>
              {label}
            </a>
          ))}
          <DSButton size="sm" href="assess.html">開始評估</DSButton>
        </div>
      </div>
    </nav>
  );
}

/* ── Footer ── */
function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
            <span className="logo-mark" style={{ background: 'var(--lav)' }}>3Q</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 16, color: 'var(--fg-inverse)' }}>孵化所</span>
          </div>
          <div className="footer-note">
            補助媒合 × 計畫書代撰 × 募資架構設計<br />
            把申請補助的麻煩，交給 3Q。
          </div>
        </div>
        <div style={{ display: 'flex', gap: 48 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
            <a href="index.html">首頁</a>
            <a href="assess.html">補助評估</a>
            <a href="contact.html">聯絡合作</a>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
            <a href="contact.html">LINE 諮詢</a>
            <a href="contact.html">投資人聯繫</a>
          </div>
        </div>
        <div className="footer-note" style={{ width: '100%', borderTop: '1px solid rgba(255,252,247,.1)', paddingTop: 18 }}>
          © 2026 3Q孵化所 · 資料時點 2026 年 6 月，所有補助金額與梯次以官方最新公告為準。本網站不構成法律或稅務意見。
        </div>
      </div>
    </footer>
  );
}

/* ── Section head（eyebrow + H2） ── */
function SectionHead({ eyebrow, en, title, sub, center = false, dark = false }) {
  return (
    <Reveal style={{ textAlign: center ? 'center' : 'left', marginBottom: 'clamp(36px, 5vw, 60px)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', justifyContent: center ? 'center' : 'flex-start' }}>
        <span className="eyebrow">{eyebrow}</span>
        {en && <span className="accent-en" style={{ fontSize: 19, whiteSpace: 'nowrap', color: dark ? 'var(--lavs)' : 'var(--lavd)' }}>{en}</span>}
      </div>
      <h2 className="h2" style={{ marginTop: 14, color: dark ? 'var(--fg-inverse)' : 'var(--ink)' }}>{title}</h2>
      {sub && (
        <p className="body2" style={{ marginTop: 14, maxWidth: '62ch', marginLeft: center ? 'auto' : 0, marginRight: center ? 'auto' : 0, color: dark ? 'rgba(255,252,247,.55)' : 'var(--ink2)' }}>
          {sub}
        </p>
      )}
    </Reveal>
  );
}

Object.assign(window, { Reveal, SiteNav, SiteFooter, SectionHead });
` },
  "/image-slot.js": { ct: "text/javascript; charset=utf-8", body: `// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)
/* BEGIN USAGE */
/**
 * <image-slot> — user-fillable image placeholder.
 *
 * Drop this into a deck, mockup, or page wherever you want the user to
 * supply an image. You control the slot's shape and size; the user fills it
 * by dragging an image file onto it (or clicking to browse). The dropped
 * image persists across reloads via a .image-slots.state.json sidecar —
 * same read-via-fetch / write-via-window.omelette pattern as
 * design_canvas.jsx, so the filled slot shows on share links, downloaded
 * zips, and PPTX export. Outside the omelette runtime the slot is read-only.
 *
 * The host bridge only allows sidecar writes at the project root, so the
 * HTML that uses this component is assumed to live at the project root too
 * (same constraint as design_canvas.jsx).
 *
 * Attributes:
 *   id           Persistence key. REQUIRED for the drop to survive reload —
 *                every slot on the page needs a distinct id.
 *   shape        'rect' | 'rounded' | 'circle' | 'pill'   (default 'rounded')
 *                'circle' applies 50% border-radius; on a non-square slot
 *                that's an ellipse — set equal width and height for a true
 *                circle.
 *   radius       Corner radius in px for 'rounded'.       (default 12)
 *   mask         Any CSS clip-path value. Overrides \`shape\` — use this for
 *                hexagons, blobs, arbitrary polygons.
 *   fit          object-fit: cover | contain | fill.       (default 'cover')
 *                With cover (the default) double-clicking the filled slot
 *                enters a reframe mode: the whole image spills past the mask
 *                (translucent outside, opaque inside), drag to reposition,
 *                corner-drag to scale. The crop persists alongside the image
 *                in the sidecar. contain/fill stay static.
 *   position     object-position for fit=contain|fill.     (default '50% 50%')
 *   placeholder  Empty-state caption.                      (default 'Drop an image')
 *   src          Optional initial/fallback image URL. A user drop overrides
 *                it; clearing the drop reveals src again.
 *
 * Size and layout come from ordinary CSS on the element — width/height
 * inline or from a parent grid — so it composes with any layout.
 *
 * Usage:
 *   <image-slot id="hero"   style="width:800px;height:450px" shape="rounded" radius="20"
 *               placeholder="Drop a hero image"></image-slot>
 *   <image-slot id="avatar" style="width:120px;height:120px" shape="circle"></image-slot>
 *   <image-slot id="kite"   style="width:300px;height:300px"
 *               mask="polygon(50% 0, 100% 50%, 50% 100%, 0 50%)"></image-slot>
 */
/* END USAGE */

(() => {
  const STATE_FILE = '.image-slots.state.json';
  // 2× a ~600px slot in a 1920-wide deck — retina-sharp without making the
  // sidecar enormous. A 1200px WebP at q=0.85 is ~150-300KB.
  const MAX_DIM = 1200;
  // Raster formats only. SVG is excluded (can carry script; createImageBitmap
  // on SVG blobs is inconsistent). GIF is excluded because the canvas
  // re-encode keeps only the first frame, so an animated GIF would silently
  // go still — better to reject than surprise.
  const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];

  // ── Shared sidecar store ────────────────────────────────────────────────
  // One fetch + immediate write-on-change for every <image-slot> on the
  // page. Reads via fetch() so viewing works anywhere the HTML and sidecar
  // are served together; writes go through window.omelette.writeFile, which
  // the host allowlists to *.state.json basenames only.
  const subs = new Set();
  let slots = {};
  // ids explicitly cleared before the sidecar fetch resolved — otherwise
  // the merge below can't tell "never set" from "just deleted" and would
  // resurrect the sidecar's stale value.
  const tombstones = new Set();
  let loaded = false;
  let loadP = null;

  function load() {
    if (loadP) return loadP;
    loadP = fetch(STATE_FILE)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        // Merge: sidecar loses to any in-memory change that raced ahead of
        // the fetch (drop or clear) so neither is clobbered by hydration.
        if (j && typeof j === 'object') {
          const merged = Object.assign({}, j, slots);
          // A framing-only write that raced ahead of hydration must not
          // drop a user image that's only on disk — inherit u from the
          // sidecar for any in-memory entry that lacks one.
          for (const k in slots) {
            if (merged[k] && !merged[k].u && j[k]) {
              merged[k].u = typeof j[k] === 'string' ? j[k] : j[k].u;
            }
          }
          for (const id of tombstones) delete merged[id];
          slots = merged;
        }
        tombstones.clear();
      })
      .catch(() => {})
      .then(() => { loaded = true; subs.forEach((fn) => fn()); });
    return loadP;
  }

  // Serialize writes so two near-simultaneous drops on different slots
  // can't reorder at the backend and leave the sidecar with only the
  // first. A save requested mid-flight just marks dirty and re-fires on
  // completion with the then-current slots.
  let saving = false;
  let saveDirty = false;
  function save() {
    if (saving) { saveDirty = true; return; }
    const w = window.omelette && window.omelette.writeFile;
    if (!w) return;
    saving = true;
    Promise.resolve(w(STATE_FILE, JSON.stringify(slots)))
      .catch(() => {})
      .then(() => { saving = false; if (saveDirty) { saveDirty = false; save(); } });
  }

  const S_MAX = 5;
  const clampS = (s) => Math.max(1, Math.min(S_MAX, s));

  // Normalize a stored slot value. Pre-reframe sidecars stored a bare
  // data-URL string; newer ones store {u, s, x, y}. Either shape is valid.
  function getSlot(id) {
    const v = slots[id];
    if (!v) return null;
    return typeof v === 'string' ? { u: v, s: 1, x: 0, y: 0 } : v;
  }

  function setSlot(id, val) {
    if (!id) return;
    if (val) { slots[id] = val; tombstones.delete(id); }
    else { delete slots[id]; if (!loaded) tombstones.add(id); }
    subs.forEach((fn) => fn());
    // A drop is rare + high-value — write immediately so nav-away can't lose
    // it. Gate on the initial read so we don't overwrite a sidecar we haven't
    // merged yet; the merge in load() keeps this change once the read lands.
    if (loaded) save(); else load().then(save);
  }

  // ── Image downscale ─────────────────────────────────────────────────────
  // Encode through a canvas so the sidecar carries resized bytes, not the
  // raw upload. Longest side is capped at 2× the slot's rendered width
  // (retina) and at MAX_DIM. WebP keeps alpha and is ~10× smaller than PNG
  // for photos, so there's no need for per-image format picking.
  async function toDataUrl(file, targetW) {
    const bitmap = await createImageBitmap(file);
    try {
      const cap = Math.min(MAX_DIM, Math.max(1, Math.round(targetW * 2)) || MAX_DIM);
      const scale = Math.min(1, cap / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
      return canvas.toDataURL('image/webp', 0.85);
    } finally {
      bitmap.close && bitmap.close();
    }
  }

  // ── Custom element ──────────────────────────────────────────────────────
  const stylesheet =
    ':host{display:inline-block;position:relative;vertical-align:top;' +
    '  font:13px/1.3 system-ui,-apple-system,sans-serif;color:rgba(0,0,0,.55);width:240px;height:160px}' +
    '.frame{position:absolute;inset:0;overflow:hidden;background:rgba(0,0,0,.04)}' +
    // .frame img (clipped) and .spill (unclipped ghost + handles) share the
    // same left/top/width/height in frame-%, computed by _applyView(), so the
    // inside-mask crop and the outside-mask spill stay pixel-aligned.
    '.frame img{position:absolute;max-width:none;transform:translate(-50%,-50%);' +
    '  -webkit-user-drag:none;user-select:none;touch-action:none}' +
    // Reframe mode (double-click): the full image spills past the mask. The
    // spill layer is sized to the IMAGE bounds so its corners are where the
    // resize handles belong. The ghost <img> inside is translucent; the real
    // clipped <img> underneath shows the opaque in-mask crop.
    '.spill{position:absolute;transform:translate(-50%,-50%);display:none;z-index:1;' +
    '  cursor:grab;touch-action:none}' +
    ':host([data-panning]) .spill{cursor:grabbing}' +
    '.spill .ghost{position:absolute;inset:0;width:100%;height:100%;opacity:.35;' +
    '  pointer-events:none;-webkit-user-drag:none;user-select:none;' +
    '  box-shadow:0 0 0 1px rgba(0,0,0,.2),0 12px 32px rgba(0,0,0,.2)}' +
    '.spill .handle{position:absolute;width:12px;height:12px;border-radius:50%;' +
    '  background:#fff;box-shadow:0 0 0 1.5px #c96442,0 1px 3px rgba(0,0,0,.3);' +
    '  transform:translate(-50%,-50%)}' +
    '.spill .handle[data-c=nw]{left:0;top:0;cursor:nwse-resize}' +
    '.spill .handle[data-c=ne]{left:100%;top:0;cursor:nesw-resize}' +
    '.spill .handle[data-c=sw]{left:0;top:100%;cursor:nesw-resize}' +
    '.spill .handle[data-c=se]{left:100%;top:100%;cursor:nwse-resize}' +
    ':host([data-reframe]){z-index:10}' +
    ':host([data-reframe]) .spill{display:block}' +
    ':host([data-reframe]) .frame{box-shadow:0 0 0 2px #c96442}' +
    '.empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;' +
    '  justify-content:center;gap:6px;text-align:center;padding:12px;box-sizing:border-box;' +
    '  cursor:pointer;user-select:none}' +
    '.empty svg{opacity:.45}' +
    '.empty .cap{max-width:90%;font-weight:500;letter-spacing:.01em}' +
    '.empty .sub{font-size:11px}' +
    '.empty .sub u{text-underline-offset:2px;text-decoration-color:rgba(0,0,0,.25)}' +
    '.empty:hover .sub u{color:rgba(0,0,0,.75);text-decoration-color:currentColor}' +
    ':host([data-over]) .frame{outline:2px solid #c96442;outline-offset:-2px;' +
    '  background:rgba(201,100,66,.10)}' +
    '.ring{position:absolute;inset:0;pointer-events:none;border:1.5px dashed rgba(0,0,0,.25);' +
    '  transition:border-color .12s}' +
    ':host([data-over]) .ring{border-color:#c96442}' +
    ':host([data-filled]) .ring{display:none}' +
    // Controls sit BELOW the mask (top:100%), absolutely positioned so the
    // author-declared slot height is unaffected. The gap is padding, not a
    // top offset, so the hover target stays contiguous with the frame.
    '.ctl{position:absolute;top:100%;left:50%;transform:translateX(-50%);padding-top:8px;' +
    '  display:flex;gap:6px;opacity:0;pointer-events:none;transition:opacity .12s;z-index:2;' +
    '  white-space:nowrap}' +
    ':host([data-filled][data-editable]:hover) .ctl,:host([data-reframe]) .ctl' +
    '  {opacity:1;pointer-events:auto}' +
    '.ctl button{appearance:none;border:0;border-radius:6px;padding:5px 10px;cursor:pointer;' +
    '  background:rgba(0,0,0,.65);color:#fff;font:11px/1 system-ui,-apple-system,sans-serif;' +
    '  backdrop-filter:blur(6px)}' +
    '.ctl button:hover{background:rgba(0,0,0,.8)}' +
    '.err{position:absolute;left:8px;bottom:8px;right:8px;color:#b3261e;font-size:11px;' +
    '  background:rgba(255,255,255,.85);padding:4px 6px;border-radius:5px;pointer-events:none}';

  const icon =
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>' +
    '<path d="m21 15-5-5L5 21"/></svg>';

  class ImageSlot extends HTMLElement {
    static get observedAttributes() {
      return ['shape', 'radius', 'mask', 'fit', 'position', 'placeholder', 'src', 'id'];
    }

    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      // .spill and .ctl sit OUTSIDE .frame so overflow:hidden + border-radius
      // on the frame (circle, pill, rounded) can't clip them.
      root.innerHTML =
        '<style>' + stylesheet + '</style>' +
        '<div class="frame" part="frame">' +
        '  <img part="image" alt="" draggable="false" style="display:none">' +
        '  <div class="empty" part="empty">' + icon +
        '    <div class="cap"></div>' +
        '    <div class="sub">or <u>browse files</u></div></div>' +
        '  <div class="ring" part="ring"></div>' +
        '</div>' +
        '<div class="spill">' +
        '  <img class="ghost" alt="" draggable="false">' +
        '  <div class="handle" data-c="nw"></div><div class="handle" data-c="ne"></div>' +
        '  <div class="handle" data-c="sw"></div><div class="handle" data-c="se"></div>' +
        '</div>' +
        '<div class="ctl"><button data-act="replace" title="Replace image">Replace</button>' +
        '  <button data-act="clear" title="Remove image">Remove</button></div>' +
        '<input type="file" accept="' + ACCEPT.join(',') + '" hidden>';
      this._frame = root.querySelector('.frame');
      this._ring = root.querySelector('.ring');
      this._img = root.querySelector('.frame img');
      this._empty = root.querySelector('.empty');
      this._cap = root.querySelector('.cap');
      this._sub = root.querySelector('.sub');
      this._spill = root.querySelector('.spill');
      this._ghost = root.querySelector('.ghost');
      this._err = null;
      this._input = root.querySelector('input');
      this._depth = 0;
      this._gen = 0;
      this._view = { s: 1, x: 0, y: 0 };
      this._subFn = () => this._render();
      // Shadow-DOM listeners live with the shadow DOM — bound once here so
      // disconnect/reconnect (e.g. React remount) doesn't stack handlers.
      this._empty.addEventListener('click', () => this._input.click());
      root.addEventListener('click', (e) => {
        const act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'replace') { this._exitReframe(true); this._input.click(); }
        if (act === 'clear') {
          this._exitReframe(false);
          this._gen++;
          this._local = null;
          if (this.id) setSlot(this.id, null); else this._render();
        }
      });
      this._input.addEventListener('change', () => {
        const f = this._input.files && this._input.files[0];
        if (f) this._ingest(f);
        this._input.value = '';
      });
      // naturalWidth/Height aren't known until load — re-apply so the cover
      // baseline is computed from real dimensions, not the 100%×100% fallback.
      this._img.addEventListener('load', () => this._applyView());
      // Gated on editable + fit=cover so share links and contain/fill slots
      // stay static.
      this.addEventListener('dblclick', (e) => {
        if (!this.hasAttribute('data-editable') || !this._reframes()) return;
        e.preventDefault();
        if (this.hasAttribute('data-reframe')) this._exitReframe(true);
        else this._enterReframe();
      });
      // Pan + resize both originate on the spill layer. A handle pointerdown
      // drives an aspect-locked resize anchored at the opposite corner; any
      // other pointerdown on the spill pans. Offsets are frame-% so a
      // reframed slot survives responsive resize / PPTX export.
      this._spill.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !this.hasAttribute('data-reframe')) return;
        e.preventDefault();
        e.stopPropagation();
        this._spill.setPointerCapture(e.pointerId);
        const rect = this.getBoundingClientRect();
        const fw = rect.width || 1, fh = rect.height || 1;
        const corner = e.target.getAttribute && e.target.getAttribute('data-c');
        let move;
        if (corner) {
          // Resize about the OPPOSITE corner. Viewport-px throughout (rect
          // fw/fh, not clientWidth) so the math survives a transform:scale()
          // ancestor — deck_stage renders slides scaled-to-fit.
          const iw = this._img.naturalWidth || 1, ih = this._img.naturalHeight || 1;
          const base = Math.max(fw / iw, fh / ih);
          const sx = corner.includes('e') ? 1 : -1;
          const sy = corner.includes('s') ? 1 : -1;
          const s0 = this._view.s;
          const w0 = iw * base * s0, h0 = ih * base * s0;
          const cx0 = (50 + this._view.x) / 100 * fw;
          const cy0 = (50 + this._view.y) / 100 * fh;
          const ox = cx0 - sx * w0 / 2, oy = cy0 - sy * h0 / 2;
          const diag0 = Math.hypot(w0, h0);
          const ux = sx * w0 / diag0, uy = sy * h0 / diag0;
          move = (ev) => {
            const proj = (ev.clientX - rect.left - ox) * ux +
                         (ev.clientY - rect.top - oy) * uy;
            const s = clampS(s0 * proj / diag0);
            const d = diag0 * s / s0;
            this._view.s = s;
            this._view.x = (ox + ux * d / 2) / fw * 100 - 50;
            this._view.y = (oy + uy * d / 2) / fh * 100 - 50;
            this._clampView();
            this._applyView();
          };
        } else {
          this.setAttribute('data-panning', '');
          const start = { px: e.clientX, py: e.clientY, x: this._view.x, y: this._view.y };
          move = (ev) => {
            this._view.x = start.x + (ev.clientX - start.px) / fw * 100;
            this._view.y = start.y + (ev.clientY - start.py) / fh * 100;
            this._clampView();
            this._applyView();
          };
        }
        const up = () => {
          try { this._spill.releasePointerCapture(e.pointerId); } catch {}
          this._spill.removeEventListener('pointermove', move);
          this._spill.removeEventListener('pointerup', up);
          this._spill.removeEventListener('pointercancel', up);
          this.removeAttribute('data-panning');
          this._dragUp = null;
        };
        // Stashed so _exitReframe (Escape / outside-click mid-drag) can
        // tear the capture + listeners down synchronously.
        this._dragUp = up;
        this._spill.addEventListener('pointermove', move);
        this._spill.addEventListener('pointerup', up);
        this._spill.addEventListener('pointercancel', up);
      });
      // Wheel zoom stays available inside reframe mode as a trackpad nicety —
      // zooms toward the cursor (offset' = cursor·(1-k) + offset·k).
      this.addEventListener('wheel', (e) => {
        if (!this.hasAttribute('data-reframe')) return;
        e.preventDefault();
        const r = this.getBoundingClientRect();
        const cx = (e.clientX - r.left) / r.width * 100 - 50;
        const cy = (e.clientY - r.top) / r.height * 100 - 50;
        const prev = this._view.s;
        const next = clampS(prev * Math.pow(1.0015, -e.deltaY));
        if (next === prev) return;
        const k = next / prev;
        this._view.s = next;
        this._view.x = cx * (1 - k) + this._view.x * k;
        this._view.y = cy * (1 - k) + this._view.y * k;
        this._clampView();
        this._applyView();
      }, { passive: false });
    }

    connectedCallback() {
      // Warn once per page — an id-less slot works for the session but
      // cannot persist, and two id-less slots would share nothing.
      if (!this.id && !ImageSlot._warned) {
        ImageSlot._warned = true;
        console.warn('<image-slot> without an id will not persist its dropped image.');
      }
      this.addEventListener('dragenter', this);
      this.addEventListener('dragover', this);
      this.addEventListener('dragleave', this);
      this.addEventListener('drop', this);
      subs.add(this._subFn);
      // width%/height% in _applyView encode the frame aspect at call time —
      // a host resize (responsive grid, pane divider) would stretch the
      // image until the next _render. Re-render on size change: _render()
      // re-seeds _view from stored before clamp/apply, so a shrink→grow
      // cycle round-trips instead of ratcheting x/y toward the narrower
      // frame's clamp range.
      this._ro = new ResizeObserver(() => this._render());
      this._ro.observe(this);
      load();
      this._render();
    }

    disconnectedCallback() {
      subs.delete(this._subFn);
      this.removeEventListener('dragenter', this);
      this.removeEventListener('dragover', this);
      this.removeEventListener('dragleave', this);
      this.removeEventListener('drop', this);
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      this._exitReframe(false);
    }

    _enterReframe() {
      if (this.hasAttribute('data-reframe')) return;
      this.setAttribute('data-reframe', '');
      this._applyView();
      // Close on click outside (the spill handler stopPropagation()s so
      // in-image drags don't reach this) and on Escape. Listeners are held
      // on the instance so _exitReframe / disconnectedCallback can detach
      // exactly what was attached.
      this._outside = (e) => {
        if (e.composedPath && e.composedPath().includes(this)) return;
        this._exitReframe(true);
      };
      this._esc = (e) => { if (e.key === 'Escape') this._exitReframe(true); };
      document.addEventListener('pointerdown', this._outside, true);
      document.addEventListener('keydown', this._esc, true);
    }

    _exitReframe(commit) {
      if (!this.hasAttribute('data-reframe')) return;
      if (this._dragUp) this._dragUp();
      this.removeAttribute('data-reframe');
      this.removeAttribute('data-panning');
      if (this._outside) document.removeEventListener('pointerdown', this._outside, true);
      if (this._esc) document.removeEventListener('keydown', this._esc, true);
      this._outside = this._esc = null;
      if (commit) this._commitView();
    }

    attributeChangedCallback() { if (this.shadowRoot) this._render(); }

    // handleEvent — one listener object for all four drag events keeps the
    // add/remove symmetric and the depth counter correct.
    handleEvent(e) {
      if (e.type === 'dragenter' || e.type === 'dragover') {
        // Without preventDefault the browser never fires 'drop'.
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        if (e.type === 'dragenter') this._depth++;
        this.setAttribute('data-over', '');
      } else if (e.type === 'dragleave') {
        // dragenter/leave fire for every descendant crossing — count depth
        // so hovering the icon inside the empty state doesn't flicker.
        if (--this._depth <= 0) { this._depth = 0; this.removeAttribute('data-over'); }
      } else if (e.type === 'drop') {
        e.preventDefault();
        e.stopPropagation();
        this._depth = 0;
        this.removeAttribute('data-over');
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) this._ingest(f);
      }
    }

    async _ingest(file) {
      this._setError(null);
      if (!file || ACCEPT.indexOf(file.type) < 0) {
        this._setError('Drop a PNG, JPEG, WebP, or AVIF image.');
        return;
      }
      // toDataUrl can take hundreds of ms on a large photo. A Clear or a
      // newer drop during that window would be clobbered when this await
      // resumes — bump + capture a generation so stale encodes bail.
      const gen = ++this._gen;
      try {
        const w = this.clientWidth || this.offsetWidth || MAX_DIM;
        const url = await toDataUrl(file, w);
        if (gen !== this._gen) return;
        // Only exit reframe once the new image is in hand — a rejected type
        // or decode failure leaves the in-progress crop untouched.
        this._exitReframe(false);
        const val = { u: url, s: 1, x: 0, y: 0 };
        setSlot(this.id || '', val);
        // Keep a session-local copy for id-less slots so the drop still
        // shows, even though it cannot persist.
        if (!this.id) { this._local = val; this._render(); }
      } catch (err) {
        if (gen !== this._gen) return;
        this._setError('Could not read that image.');
        console.warn('<image-slot> ingest failed:', err);
      }
    }

    _setError(msg) {
      if (this._err) { this._err.remove(); this._err = null; }
      if (!msg) return;
      const d = document.createElement('div');
      d.className = 'err'; d.textContent = msg;
      this.shadowRoot.appendChild(d);
      this._err = d;
      setTimeout(() => { if (this._err === d) { d.remove(); this._err = null; } }, 3000);
    }

    // Reframing (pan/resize) is only meaningful for fit=cover — contain/fill
    // keep the old object-fit path and double-click is a no-op.
    _reframes() {
      return this.hasAttribute('data-filled') &&
        (this.getAttribute('fit') || 'cover') === 'cover';
    }

    // Cover-baseline geometry, shared by clamp/apply/resize. Null until the
    // img has loaded (naturalWidth is 0 before that) or when the slot has no
    // layout box — ResizeObserver fires with a 0×0 rect under display:none,
    // and clamping against a degenerate 1×1 frame would silently pull the
    // stored pan toward zero.
    _geom() {
      const iw = this._img.naturalWidth, ih = this._img.naturalHeight;
      const fw = this.clientWidth, fh = this.clientHeight;
      if (!iw || !ih || !fw || !fh) return null;
      return { iw, ih, fw, fh, base: Math.max(fw / iw, fh / ih) };
    }

    _clampView() {
      // Pan range on each axis is half the overflow past the frame edge.
      const g = this._geom();
      if (!g) return;
      const mx = Math.max(0, (g.iw * g.base * this._view.s / g.fw - 1) * 50);
      const my = Math.max(0, (g.ih * g.base * this._view.s / g.fh - 1) * 50);
      this._view.x = Math.max(-mx, Math.min(mx, this._view.x));
      this._view.y = Math.max(-my, Math.min(my, this._view.y));
    }

    _applyView() {
      const g = this._geom();
      const fit = this.getAttribute('fit') || 'cover';
      if (fit !== 'cover' || !g) {
        // Non-cover, or dimensions not known yet (before img load).
        this._img.style.width = '100%';
        this._img.style.height = '100%';
        this._img.style.left = '50%';
        this._img.style.top = '50%';
        this._img.style.objectFit = fit;
        this._img.style.objectPosition = this.getAttribute('position') || '50% 50%';
        return;
      }
      // Cover baseline: img fills the frame on its tighter axis at s=1, so
      // pan works immediately on the overflowing axis without zooming first.
      // Width/height and left/top are all frame-% — depends only on the
      // frame aspect ratio, so a responsive resize keeps the same crop. The
      // spill layer mirrors the same box so its corners = image corners.
      const k = g.base * this._view.s;
      const w = (g.iw * k / g.fw * 100) + '%';
      const h = (g.ih * k / g.fh * 100) + '%';
      const l = (50 + this._view.x) + '%';
      const t = (50 + this._view.y) + '%';
      this._img.style.width = w; this._img.style.height = h;
      this._img.style.left = l; this._img.style.top = t;
      this._img.style.objectFit = '';
      this._spill.style.width = w; this._spill.style.height = h;
      this._spill.style.left = l; this._spill.style.top = t;
    }

    _commitView() {
      const v = { s: this._view.s, x: this._view.x, y: this._view.y };
      if (this._userUrl) v.u = this._userUrl;
      // Framing-only (no u) persists too so an author-src slot remembers its
      // crop; clearing the sidecar still falls through to src=.
      if (this.id) setSlot(this.id, v);
      else { this._local = v; }
    }

    _render() {
      // Shape / mask. Presets use border-radius so the dashed ring can
      // follow the rounded outline; clip-path is only applied for an
      // explicit \`mask\` (the ring is hidden there since a rectangle
      // dashed border chopped by an arbitrary polygon looks broken).
      const mask = this.getAttribute('mask');
      const shape = (this.getAttribute('shape') || 'rounded').toLowerCase();
      let radius = '';
      if (shape === 'circle') radius = '50%';
      else if (shape === 'pill') radius = '9999px';
      else if (shape === 'rounded') {
        const n = parseFloat(this.getAttribute('radius'));
        radius = (Number.isFinite(n) ? n : 12) + 'px';
      }
      this._frame.style.borderRadius = mask ? '' : radius;
      this._frame.style.clipPath = mask || '';
      this._ring.style.borderRadius = mask ? '' : radius;
      this._ring.style.display = mask ? 'none' : '';

      // Controls and reframe entry gate on this so share links stay read-only.
      const editable = !!(window.omelette && window.omelette.writeFile);
      this.toggleAttribute('data-editable', editable);
      this._sub.style.display = editable ? '' : 'none';

      // Content. The sidecar is also writable by the agent's write_file
      // tool, so its value isn't guaranteed canvas-originated — only accept
      // data:image/ URLs from it. The \`src\` attribute is author-controlled
      // (Claude wrote it into the HTML) so it passes through unchanged.
      let stored = this.id ? getSlot(this.id) : this._local;
      if (stored && stored.u && !/^data:image\\//i.test(stored.u)) stored = null;
      const srcAttr = this.getAttribute('src') || '';
      this._userUrl = (stored && stored.u) || null;
      const url = this._userUrl || srcAttr;
      // Don't clobber an in-flight reframe with a store-triggered re-render.
      if (!this.hasAttribute('data-reframe')) {
        this._view = {
          s: stored && Number.isFinite(stored.s) ? clampS(stored.s) : 1,
          x: stored && Number.isFinite(stored.x) ? stored.x : 0,
          y: stored && Number.isFinite(stored.y) ? stored.y : 0,
        };
      }
      this._cap.textContent = this.getAttribute('placeholder') || 'Drop an image';
      // Toggle via style.display — the [hidden] attribute alone loses to
      // the display:flex / display:block rules in the stylesheet above.
      if (url) {
        if (this._img.getAttribute('src') !== url) {
          this._img.src = url;
          this._ghost.src = url;
        }
        this._img.style.display = 'block';
        this._empty.style.display = 'none';
        this.setAttribute('data-filled', '');
        this._clampView();
        this._applyView();
      } else {
        this._img.style.display = 'none';
        this._img.removeAttribute('src');
        this._ghost.removeAttribute('src');
        this._empty.style.display = 'flex';
        this.removeAttribute('data-filled');
      }
    }
  }

  if (!customElements.get('image-slot')) {
    customElements.define('image-slot', ImageSlot);
  }
})();
` },
  "/3q-shared.css": { ct: "text/css; charset=utf-8", body: `/* ─── 3Q孵化所 · 站台共用樣式（基於 三根手指頭 Design System tokens）── */

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; }

body {
  background: var(--cream);
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  line-height: var(--leading-body);
  -webkit-font-smoothing: antialiased;
}

/* Global ambient — 四點 radial（薰衣草・柔粉・陶土） */
.ambient {
  position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: .16;
  background:
    radial-gradient(420px 420px at 12% 8%,  var(--lavs), transparent 70%),
    radial-gradient(380px 380px at 88% 18%, var(--blush), transparent 70%),
    radial-gradient(460px 460px at 18% 85%, var(--clays), transparent 70%),
    radial-gradient(400px 400px at 90% 90%, var(--lavs), transparent 70%);
}

#root { position: relative; z-index: 1; }

.container {
  max-width: var(--container-max);
  margin: 0 auto;
  padding-left: var(--pad-x);
  padding-right: var(--pad-x);
}

/* ── Nav ── */
.site-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 50;
  transition: background var(--t-base) var(--ease), box-shadow var(--t-base) var(--ease);
  background: transparent;
}
.site-nav.scrolled {
  background: var(--nav-bg-scrolled);
  backdrop-filter: var(--blur-nav);
  -webkit-backdrop-filter: var(--blur-nav);
  box-shadow: var(--shadow-xs);
}
.site-nav .nav-inner {
  max-width: var(--container-max);
  margin: 0 auto;
  padding: 14px var(--pad-x);
  display: flex; align-items: center; gap: 28px;
}
.site-nav .nav-links { display: flex; align-items: center; gap: 28px; margin-left: auto; }
.site-nav a.nav-link {
  font-size: var(--text-nav); color: var(--ink2); text-decoration: none;
  transition: color var(--t-base) var(--ease);
}
.site-nav a.nav-link:hover { color: var(--lavd); }
.site-nav a.nav-link.active { color: var(--lavd); font-weight: 700; }

.logo-lockup { display: flex; align-items: center; gap: 9px; text-decoration: none; }
.logo-mark {
  width: 38px; height: 38px; border-radius: 10px;
  background: var(--lavd); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-accent); font-style: italic;
  font-size: 17px; font-weight: 600; letter-spacing: .5px;
}
.logo-word { font-family: var(--font-serif); font-weight: 700; font-size: 17px; color: var(--ink); letter-spacing: 1px; }

/* ── Typography helpers ── */
.eyebrow {
  font-size: var(--text-eyebrow); font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-eyebrow); text-transform: uppercase;
  color: var(--clay);
}
.h1 {
  font-family: var(--font-serif); font-weight: var(--weight-black);
  font-size: var(--text-h1); line-height: var(--leading-h1);
  letter-spacing: var(--tracking-h1); color: var(--ink);
  text-wrap: pretty;
}
.h2 {
  font-family: var(--font-serif); font-weight: var(--weight-bold);
  font-size: var(--text-h2); line-height: var(--leading-h2);
  letter-spacing: var(--tracking-h2); color: var(--ink);
  text-wrap: pretty;
}
.h3 {
  font-family: var(--font-serif); font-weight: var(--weight-bold);
  font-size: var(--text-h3); line-height: var(--leading-h3); color: var(--ink);
}
.accent-en {
  font-family: var(--font-accent); font-style: italic;
  font-size: var(--text-accent-en); letter-spacing: var(--tracking-accent);
  color: var(--lavd);
}
.body2 { color: var(--ink2); }
.caption { font-size: var(--text-caption); line-height: var(--leading-caption); color: var(--ink2); }

/* ── Sections ── */
.section { padding-top: var(--section-y); padding-bottom: var(--section-y); }
.section-sm { padding-top: var(--section-y-sm); padding-bottom: var(--section-y-sm); }

/* ── Cards ── */
.card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--card-radius);
  box-shadow: var(--shadow-sm);
}

/* ── Scroll reveal ── */
@media (prefers-reduced-motion: no-preference) {
  .reveal { opacity: 0; transform: translateY(28px); transition: opacity var(--t-reveal) var(--ease), transform var(--t-reveal) var(--ease); }
  .reveal.in { opacity: 1; transform: translateY(0); }
}

/* ── Footer ── */
.site-footer { background: var(--dark); color: rgba(255, 252, 247, .55); }
.site-footer .footer-inner {
  max-width: var(--container-max); margin: 0 auto;
  padding: 44px var(--pad-x) 36px;
  display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; justify-content: space-between;
}
.site-footer a { color: rgba(255, 252, 247, .65); text-decoration: none; transition: color var(--t-base) var(--ease); }
.site-footer a:hover { color: var(--lavs); }
.site-footer .footer-note { font-size: 12px; color: rgba(255, 252, 247, .35); line-height: 1.7; }

/* ── Pills / chips ── */
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 16px; border-radius: var(--radius-full);
  border: 1px solid var(--line); background: var(--paper);
  font-size: 13px; color: var(--ink2); white-space: nowrap;
  transition: transform var(--t-base) var(--ease), box-shadow var(--t-base) var(--ease);
}
.chip:hover { transform: translateY(-3px); box-shadow: var(--shadow-sm); }

/* ── Forms（評估工具） ── */
.opt-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 16px; border-radius: var(--radius-md);
  border: 1.5px solid var(--line); background: var(--paper);
  font-family: var(--font-sans); font-size: 14.5px; color: var(--ink);
  cursor: pointer; text-align: left; width: 100%;
  transition: border-color var(--t-base) var(--ease), background var(--t-base) var(--ease);
}
.opt-btn:hover { border-color: var(--lav); }
.opt-btn.on { background: var(--lavs); border-color: var(--lav); color: var(--lavd); font-weight: 700; }

@media (max-width: 880px) {
  .site-nav .nav-links { gap: 16px; }
  .hide-mobile { display: none !important; }
}

/* ─── 響應式版面格線 ───────────────────────────────────── */
.hero-grid { display: grid; grid-template-columns: 52fr 48fr; gap: clamp(28px, 5vw, 64px); align-items: center; position: relative; z-index: 1; }
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: clamp(20px, 3vw, 40px); }
.tool-grid { display: grid; grid-template-columns: 320px 1fr; gap: clamp(24px, 3vw, 44px); align-items: start; }
.tool-form { position: sticky; top: 90px; }
.prog-grid { display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: start; }
.prog-side { text-align: right; min-width: 130px; }
.contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(20px, 3vw, 36px); align-items: start; }
.founder-grid { display: grid; grid-template-columns: auto 1fr auto; gap: clamp(20px, 3vw, 36px); align-items: center; }
.opt-btn { min-height: 44px; }

@media (max-width: 880px) {
  .hero-grid { grid-template-columns: 1fr; }
  .hero-media { order: -1; padding-right: 0 !important; }
  .hero-vtext { display: none; }
  .stat-grid { grid-template-columns: 1fr 1fr; gap: 28px 20px; }
  .tool-grid { grid-template-columns: 1fr; }
  .tool-form { position: static; }
  .contact-grid { grid-template-columns: 1fr; }
  .svc-row > div { grid-template-columns: 1fr !important; }
  .svc-row > div > div:first-child { order: -1 !important; }
  .logo-word { display: none; }
  .site-nav .nav-inner { padding: 12px 16px; gap: 12px; }
  .site-nav .nav-links { gap: 14px; margin-left: auto; }
  .site-nav a.nav-link { font-size: 13.5px; }
  .watermark { opacity: .12; }
}

@media (max-width: 620px) {
  .prog-grid { grid-template-columns: 1fr; }
  .prog-side { text-align: left; display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px 18px; min-width: 0; }
  .founder-grid { grid-template-columns: 1fr; text-align: left; }
  .site-footer .footer-inner { flex-direction: column; gap: 28px; }
}

/* 紙紋顆粒（全站，低於 nav） */
.grain {
  position: fixed; inset: 0; z-index: 40; pointer-events: none; opacity: .05;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url%28%23n%29'/%3E%3C/svg%3E");
}

/* 審查印章 */
.stamp {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--font-serif); font-weight: 700;
  border: 2px solid currentColor; border-radius: 4px;
  padding: 3px 10px 3px 14px; letter-spacing: 4px; line-height: 1.4;
  transform: rotate(-4deg); white-space: nowrap;
  box-shadow: inset 0 0 0 1px rgba(255, 252, 247, .35);
}
.stamp--yes   { color: var(--lavd); }
.stamp--maybe { color: var(--clay); }
.stamp--no    { color: var(--fg-disabled); }

/* 文號標示 */
.doc-no {
  font-family: var(--font-sans); font-size: 11px;
  letter-spacing: 2.5px; color: var(--fg-tertiary); text-transform: uppercase;
}

/* 巨型斜體水印 */
.watermark {
  position: absolute; font-family: var(--font-accent); font-style: italic;
  color: var(--lavs); opacity: .22; line-height: .75;
  pointer-events: none; user-select: none; z-index: 0;
}

/* 直排文字 */
.vtext { writing-mode: vertical-rl; letter-spacing: 6px; }

/* 騎縫虛線分隔 */
.perf { display: flex; align-items: center; gap: 16px; }
.perf::before, .perf::after { content: ''; flex: 1; border-top: 1.5px dashed var(--border-strong); }

/* 計畫跑馬燈 */
.marquee { overflow: hidden; position: relative; }
.marquee-track { display: flex; gap: 10px; width: max-content; padding: 2px 0; }
@media (prefers-reduced-motion: no-preference) {
  .marquee-track { animation: mq-scroll 30s linear infinite; }
  .marquee:hover .marquee-track { animation-play-state: paused; }
}
@keyframes mq-scroll { to { transform: translateX(-50%); } }
` },
  "/_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/styles.css": { ct: "text/css; charset=utf-8", body: `/* ─── 三根手指頭 Design System — root stylesheet ─────────────────
   Import-only entry point. All consumers link THIS file.
   ────────────────────────────────────────────────────────────────── */

@import "./tokens/typography.css";
@import "./tokens/colors.css";
@import "./tokens/spacing.css";
@import "./tokens/effects.css";
` },
  "/_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/_ds_bundle.js": { ct: "text/javascript; charset=utf-8", body: `/* @ds-bundle: {"format":3,"namespace":"DesignSystem_8e9232","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"ServiceCard","sourcePath":"components/core/ServiceCard.jsx"},{"name":"StatBadge","sourcePath":"components/core/StatBadge.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"4f6acfca338e","components/core/Button.jsx":"1b9ecdffb690","components/core/ServiceCard.jsx":"d0c1a1a76b0b","components/core/StatBadge.jsx":"e3f0d29669a2"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.DesignSystem_8e9232 = window.DesignSystem_8e9232 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function Badge({
  variant = 'brand',
  size = 'md',
  dot = false,
  children,
  style: styleProp = {}
}) {
  const variantMap = {
    brand: {
      background: 'var(--lavs)',
      color: 'var(--lavd)'
    },
    clay: {
      background: 'var(--clays)',
      color: '#5A3A18'
    },
    blush: {
      background: 'var(--blush)',
      color: '#8C3E38'
    },
    dark: {
      background: 'var(--lavd)',
      color: '#fff'
    },
    neutral: {
      background: 'var(--line)',
      color: 'var(--ink2)'
    },
    cream: {
      background: 'var(--cream)',
      color: 'var(--ink2)',
      border: '1px solid var(--line)'
    }
  };
  const sizeMap = {
    sm: {
      fontSize: '11px',
      padding: '3px 10px',
      gap: '4px'
    },
    md: {
      fontSize: '13px',
      padding: '5px 14px',
      gap: '6px'
    },
    lg: {
      fontSize: '14px',
      padding: '7px 18px',
      gap: '7px'
    }
  };
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    letterSpacing: '1.5px',
    borderRadius: 'var(--radius-full)',
    whiteSpace: 'nowrap',
    ...sizeMap[size],
    ...variantMap[variant],
    ...styleProp
  };
  return /*#__PURE__*/React.createElement("span", {
    style: style
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: size === 'sm' ? '5px' : '7px',
      height: size === 'sm' ? '5px' : '7px',
      borderRadius: '50%',
      background: 'currentColor',
      opacity: 0.7,
      flexShrink: 0
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Button({
  variant = 'primary',
  size = 'md',
  href,
  target,
  disabled = false,
  children,
  onClick,
  style: styleProp = {}
}) {
  const [hovered, setHovered] = React.useState(false);
  const sizeMap = {
    sm: {
      fontSize: '14px',
      padding: '10px 20px',
      gap: '7px'
    },
    md: {
      fontSize: '16px',
      padding: '15px 30px',
      gap: '9px'
    },
    lg: {
      fontSize: '18px',
      padding: '18px 40px',
      gap: '11px'
    }
  };
  const variantMap = {
    primary: {
      background: hovered ? '#5A4970' : 'var(--lavd)',
      color: '#fff',
      border: 'none',
      boxShadow: 'var(--shadow-glow)',
      transform: hovered ? 'translateY(-3px)' : 'translateY(0)'
    },
    ghost: {
      background: hovered ? 'var(--lav)' : 'transparent',
      color: hovered ? '#fff' : 'var(--lavd)',
      border: '1.5px solid var(--lav)'
    },
    clay: {
      background: hovered ? '#A87A52' : 'var(--clay)',
      color: '#fff',
      border: 'none',
      boxShadow: '0 16px 34px -14px rgba(194,149,106,.7)',
      transform: hovered ? 'translateY(-3px)' : 'translateY(0)'
    },
    text: {
      background: 'transparent',
      color: 'var(--lavd)',
      border: 'none',
      padding: '0',
      gap: hovered ? '12px' : '7px',
      boxShadow: 'none'
    }
  };
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    borderRadius: 'var(--radius-pill)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all var(--t-slow) var(--ease)',
    textDecoration: 'none',
    opacity: disabled ? 0.5 : 1,
    position: 'relative',
    overflow: 'hidden',
    ...sizeMap[size],
    ...variantMap[variant],
    ...styleProp
  };
  const props = {
    style: baseStyle,
    onMouseEnter: () => !disabled && setHovered(true),
    onMouseLeave: () => setHovered(false)
  };
  if (href) {
    return /*#__PURE__*/React.createElement("a", _extends({
      href: href,
      target: target
    }, props), children);
  }
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onClick: onClick
  }, props), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/ServiceCard.jsx
try { (() => {
function ServiceCard({
  number = '01',
  title,
  description,
  imageSrc,
  imageAlt = '',
  href = 'https://lin.ee/QMkVbxX',
  imagePosition = 'left',
  linkLabel = 'LINE 預約・諮詢 →'
}) {
  const [hovered, setHovered] = React.useState(false);
  const isRight = imagePosition === 'right';
  const imgStyle = {
    width: '100%',
    aspectRatio: '3 / 2',
    objectFit: 'cover',
    borderRadius: 'var(--img-radius)',
    display: 'block',
    transition: 'transform var(--t-slow) var(--ease)',
    transform: hovered ? 'scale(1.04)' : 'scale(1)'
  };
  const placeholderStyle = {
    width: '100%',
    aspectRatio: '3 / 2',
    borderRadius: 'var(--img-radius)',
    background: 'linear-gradient(135deg, var(--cream), var(--clays))',
    border: '1.5px dashed var(--lavs)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--ink2)',
    fontSize: '13px',
    letterSpacing: '1px'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'clamp(28px, 5vw, 72px)',
      alignItems: 'center',
      marginBottom: 'clamp(56px, 8vw, 108px)'
    },
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      order: isRight ? 2 : 0,
      overflow: 'hidden',
      borderRadius: 'var(--img-radius)'
    }
  }, imageSrc ? /*#__PURE__*/React.createElement("img", {
    src: imageSrc,
    alt: imageAlt,
    style: imgStyle
  }) : /*#__PURE__*/React.createElement("div", {
    style: placeholderStyle
  }, "\\u5716\\u7247\\u4F54\\u4F4D")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-accent)',
      fontStyle: 'italic',
      fontSize: 'clamp(48px, 6vw, 72px)',
      color: 'var(--clays)',
      lineHeight: 1,
      marginBottom: '6px'
    }
  }, number), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'var(--font-serif)',
      fontWeight: 700,
      fontSize: 'clamp(24px, 3vw, 34px)',
      marginBottom: '12px',
      letterSpacing: '0.5px',
      color: 'var(--ink)'
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--ink2)',
      fontSize: '16px',
      lineHeight: 'var(--leading-body)',
      maxWidth: '30em'
    }
  }, description), /*#__PURE__*/React.createElement("a", {
    href: href,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      marginTop: '18px',
      display: 'inline-flex',
      gap: hovered ? '12px' : '7px',
      color: 'var(--lavd)',
      fontWeight: 500,
      fontSize: '15px',
      transition: 'gap var(--t-base) var(--ease)',
      textDecoration: 'none'
    }
  }, linkLabel)));
}
Object.assign(__ds_scope, { ServiceCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ServiceCard.jsx", error: String((e && e.message) || e) }); }

// components/core/StatBadge.jsx
try { (() => {
function StatBadge({
  stat,
  label,
  sublabel,
  style: styleProp = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--paper)',
      borderRadius: 'var(--badge-radius)',
      padding: '14px 20px',
      boxShadow: 'var(--shadow-sm)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '12px',
      ...styleProp
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-accent)',
      fontStyle: 'italic',
      fontSize: '34px',
      color: 'var(--lavd)',
      lineHeight: 1,
      flexShrink: 0
    }
  }, stat), /*#__PURE__*/React.createElement("div", null, label && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '12px',
      color: 'var(--ink2)',
      lineHeight: 1.5
    }
  }, label), sublabel && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '11px',
      color: 'var(--fg-tertiary)',
      marginTop: '2px'
    }
  }, sublabel)));
}
Object.assign(__ds_scope, { StatBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatBadge.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.ServiceCard = __ds_scope.ServiceCard;

__ds_ns.StatBadge = __ds_scope.StatBadge;

})();
` },
  "/_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/tokens/colors.css": { ct: "text/css; charset=utf-8", body: `/* ─── 三根手指頭 · Color Tokens ────────────────────────────────────
   Brand palette extracted from site-v4 and brief v1
   Aesthetic: 晨光居家・雜誌風 — lavender + terracotta + cream
   ────────────────────────────────────────────────────────────────── */

:root {
  /* ── Raw brand palette ── */
  --lav:   #9B86BD;   /* 薰衣草紫   brand primary */
  --lavd:  #6E5B8C;   /* 薰衣草深   primary dark  */
  --lavs:  #C7B8DE;   /* 薰衣草淺   primary light */
  --clay:  #C2956A;   /* 陶土橘     secondary warm */
  --clays: #E4CBA9;   /* 暖杏       secondary light */
  --cream: #FAF6EF;   /* 奶油底     warm background */
  --paper: #FFFCF7;   /* 紙白       clean surface */
  --blush: #F5CEC9;   /* 柔粉       tender accent */
  --ink:   #3A3230;   /* 暖墨       primary text */
  --ink2:  #6B6058;   /* 次文字     secondary text */
  --line:  #E5DBCB;   /* 分隔線     border */
  --dark:  #2E2838;   /* 深墨       dark surfaces / trust wall */

  /* ── Extended semantic aliases ── */
  --bg-base:           var(--cream);
  --bg-surface:        var(--paper);
  --bg-muted:          #F3EDE0;
  --bg-overlay:        rgba(46, 40, 56, 0.50);
  --fg-primary:        var(--ink);
  --fg-secondary:      var(--ink2);
  --fg-tertiary:       #A89990;
  --fg-disabled:       #C9BFB4;
  --fg-inverse:        #FFFCF7;
  --border-subtle:     #EDE4D6;
  --border-default:    var(--line);
  --border-strong:     #C9B8A6;
  --color-brand:       var(--lav);
  --color-brand-dark:  var(--lavd);
  --color-brand-light: var(--lavs);
  --color-accent:      var(--clay);
  --color-accent-light: var(--clays);
}
` },
  "/_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/tokens/typography.css": { ct: "text/css; charset=utf-8", body: `/* ─── 三根手指頭 · Typography Tokens ──────────────────────────────
   三字體系統：中文標題 Noto Serif TC + 英文裝飾 Cormorant Garamond + 內文 Noto Sans TC
   ────────────────────────────────────────────────────────────────── */

@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@600;700;900&family=Cormorant+Garamond:ital,wght@1,500;1,600&display=swap');

:root {
  /* ── Font families ── */
  --font-serif:  "Noto Serif TC", serif;
  --font-sans:   "Noto Sans TC", system-ui, sans-serif;
  --font-accent: "Cormorant Garamond", serif;  /* italic eyebrow + decoration */

  /* ── Type scale ── */
  --text-h1:        clamp(44px, 7vw, 84px);
  --text-h2:        clamp(30px, 4.5vw, 48px);
  --text-h3:        22px;
  --text-eyebrow:   13px;
  --text-accent-en: clamp(20px, 3vw, 30px);
  --text-body:      16px;
  --text-body-lg:   17px;
  --text-caption:   13px;
  --text-nav:       14.5px;
  --text-btn:       16px;
  --text-btn-sm:    14px;
  --text-stat:      clamp(36px, 6vw, 68px);

  /* ── Line heights ── */
  --leading-h1:     1.12;
  --leading-h2:     1.20;
  --leading-h3:     1.40;
  --leading-body:   1.85;
  --leading-caption: 1.60;
  --leading-tight:  1.15;

  /* ── Letter spacing ── */
  --tracking-h1:      2px;
  --tracking-h2:      1px;
  --tracking-eyebrow: 3px;
  --tracking-accent:  1px;
  --tracking-wide:    2px;

  /* ── Font weights ── */
  --weight-regular:  400;
  --weight-medium:   500;
  --weight-bold:     700;
  --weight-black:    900;
}
` },
  "/_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/tokens/spacing.css": { ct: "text/css; charset=utf-8", body: `/* ─── 三根手指頭 · Spacing Tokens ────────────────────────────────
   8px base grid — 雜誌風大留白
   ────────────────────────────────────────────────────────────────── */

:root {
  /* ── Base spacing scale (8px grid) ── */
  --space-1:   4px;
  --space-2:   8px;
  --space-3:   12px;
  --space-4:   16px;
  --space-5:   20px;
  --space-6:   24px;
  --space-7:   28px;
  --space-8:   32px;
  --space-9:   36px;
  --space-10:  40px;
  --space-12:  48px;
  --space-14:  56px;
  --space-16:  64px;
  --space-20:  80px;
  --space-24:  96px;
  --space-28: 112px;
  --space-32: 128px;
  --space-40: 160px;
  --space-48: 192px;

  /* ── Layout ── */
  --container-max:   1200px;     /* content max-width */
  --text-max:        62ch;       /* editorial prose max-width */
  --pad-x:           clamp(20px, 6vw, 80px);   /* horizontal gutter */
  --section-y:       clamp(80px, 11vw, 150px); /* @kind spacing */
  --section-y-sm:    clamp(48px, 7vw, 80px);  /* @kind spacing */

  /* ── Component tokens ── */
  --btn-pad-x:     30px;
  --btn-pad-y:     15px;
  --btn-pad-x-sm:  20px;
  --btn-pad-y-sm:  10px;
  --btn-pad-x-lg:  40px;
  --btn-pad-y-lg:  18px;
  --card-pad:      clamp(28px, 4vw, 44px);
  --card-radius:   24px;
  --img-radius:    22px;
  --badge-radius:  18px;
}
` },
  "/_ds/design-system-8e9232d6-1991-4cf3-a0d0-f4d789915320/tokens/effects.css": { ct: "text/css; charset=utf-8", body: `/* ─── 三根手指頭 · Effects Tokens ────────────────────────────────
   Shadows warm-tinted (purple-brown), transitions, easing, radii
   ────────────────────────────────────────────────────────────────── */

:root {
  /* ── Easing ── */
  --ease:         cubic-bezier(.2, .7, .2, 1);  /* @kind other */
  --ease-spring:  cubic-bezier(.34, 1.56, .64, 1); /* @kind other */
  --ease-out:     cubic-bezier(.0, .0, .2, 1);    /* @kind other */

  /* ── Transition durations ── */
  --t-fast:   150ms;   /* @kind other */
  --t-base:   250ms;   /* @kind other */
  --t-slow:   350ms;   /* @kind other */
  --t-reveal: 850ms;  /* @kind other */
  --t-ken:    8000ms; /* @kind other */
  --t-shimmer: 650ms; /* @kind other */

  /* ── Shadows (warm purple-brown tint) ── */
  --shadow-xs: 0 2px 6px -2px rgba(80, 60, 70, .15);
  --shadow-sm: 0 10px 30px -16px rgba(80, 60, 70, .32);
  --shadow:    0 22px 60px -26px rgba(80, 60, 70, .40);
  --shadow-lg: 0 32px 80px -32px rgba(80, 60, 70, .48);
  --shadow-glow: 0 16px 34px -14px rgba(110, 91, 140, .80);

  /* ── Border radii ── */
  --radius-xs:   4px;
  --radius-sm:   8px;
  --radius-md:   12px;
  --radius-lg:   16px;
  --radius-xl:   22px;
  --radius-2xl:  24px;
  --radius-3xl:  32px;
  --radius-pill: 40px;
  --radius-full: 9999px;

  /* ── Backdrop / glass ── */
  --blur-nav:    blur(16px);                    /* @kind other */
  --blur-card:   blur(8px);                     /* @kind other */
  --nav-bg-scrolled: rgba(250, 246, 239, .85);  /* @kind other */
}
` }
};
function resolveGrowthLoopCollector(env) {
  const expectedCollector = "https://3q-growth-loop-candidate.milk790.workers.dev";
  const configuredCollector = String(env.GROWTH_LOOP_COLLECTOR_URL || '');
  return configuredCollector === expectedCollector ? expectedCollector : '';
}

function injectGrowthLoopTelemetry(body, env) {
  const collector = resolveGrowthLoopCollector(env);
  if (!collector || !body.includes('</body>')) return body;
  const collectorLiteral = JSON.stringify(collector).replaceAll('<', '\\u003c');
  const script = `<script data-growth-loop-telemetry>
(() => {
  const collector = ${collectorLiteral};
  const params = new URLSearchParams(location.search);
  const storageKey = '3q_growth_loop_attribution_v1';
  const tokenPattern = /^[A-Za-z0-9][A-Za-z0-9._~:-]{0,79}$/;
  const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const emailLikePattern = /[A-Z0-9._%+-]+(?:@|%40)[A-Z0-9.-]+[.][A-Z]{2,}/i;
  const phoneLikePattern = /[+]?[0-9][0-9 ._~:()-]{5,23}[0-9]/g;
  const containsPiiLike = (value) => {
    const candidates = [value];
    let decoded = value;
    for (let index = 0; index < 2; index += 1) {
      try {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        candidates.push(next);
        decoded = next;
      } catch { break; }
    }
    return candidates.some((candidate) => {
      const phoneCandidates = candidate.match(phoneLikePattern) || [];
      const containsPhoneLike = phoneCandidates.some((phoneCandidate) => {
        const digitCount = phoneCandidate.replace(/[^0-9]/g, '').length;
        const hasPhoneSeparator = /[+ ._~:()-]/.test(phoneCandidate);
        return digitCount >= 7 && digitCount <= 15 && (hasPhoneSeparator || digitCount >= 10);
      });
      return emailLikePattern.test(candidate) || containsPhoneLike;
    });
  };
  const safeToken = (value) => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return tokenPattern.test(normalized) && !containsPiiLike(normalized) ? normalized : null;
  };
  const safeSessionId = (value) => typeof value === 'string' && uuidV4Pattern.test(value.trim()) ? value.trim().toLowerCase() : null;
  let stored = {};
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
    if (parsed && typeof parsed === 'object') stored = parsed;
  } catch {}
  const fromUrl = {
    session_id: safeSessionId(params.get('sid')),
    variant_id: safeToken(params.get('variant_id')),
    content_id: safeToken(params.get('content_id')),
    source: safeToken(params.get('utm_source')),
    medium: safeToken(params.get('utm_medium')),
    campaign: safeToken(params.get('utm_campaign'))
  };
  const attribution = {
    session_id: fromUrl.session_id || safeSessionId(stored.session_id)
  };
  for (const key of ['variant_id', 'content_id', 'source', 'medium', 'campaign']) {
    attribution[key] = fromUrl[key] || safeToken(stored[key]);
  }
  if (!attribution.session_id) {
    if (typeof crypto.randomUUID !== 'function') return;
    attribution.session_id = crypto.randomUUID();
  }
  attribution.source ||= '3q_site';
  attribution.medium ||= 'champion_page';
  try { sessionStorage.setItem(storageKey, JSON.stringify(attribution)); } catch {}
  const send = (eventType) => {
    const payload = {
      asset_id: 'champion-3q-line-v0',
      variant_id: attribution.variant_id,
      content_id: attribution.content_id,
      session_id: attribution.session_id,
      source: attribution.source,
      medium: attribution.medium,
      campaign: attribution.campaign,
      event_type: eventType,
      url: location.origin + location.pathname,
      metadata_json: { integration: '3q_site_champion_v1', page: location.pathname }
    };
    fetch(collector + '/e', {
      method: 'POST', mode: 'cors', credentials: 'omit', keepalive: true,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
    }).catch(() => {});
  };
  send('page_view');
  document.addEventListener('click', (event) => {
    const target = event.target;
    const link = target && typeof target.closest === 'function' ? target.closest('a[href^="https://lin.ee/"]') : null;
    if (link) send('cta_click');
  }, { capture: true });
})();
</script>`;
  return body.replace('</body>', script + '</body>');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/growth-loop/status') { const collector = resolveGrowthLoopCollector(env); return new Response(JSON.stringify({ok:true,mode:'champion_integration_candidate',build:'growth-loop-telemetry-v2',collector_configured:Boolean(collector),collector_origin:collector || null,collector_url_matches_expected:Boolean(collector),external_effects:false}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}); }
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nAllow: /\nSitemap: https://3q-site.milk790.workers.dev/sitemap.xml\n', { headers: { 'Content-Type': 'text/plain' } });
    if (url.pathname === '/sitemap.xml') return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://3q-site.milk790.workers.dev/</loc></url><url><loc>https://3q-site.milk790.workers.dev/assess</loc></url><url><loc>https://3q-site.milk790.workers.dev/contact</loc></url></urlset>', { headers: { 'Content-Type': 'application/xml' } });
    if (url.pathname === '/health') return new Response(JSON.stringify({ok:true,worker:'3q-site',ver:'v1.2',build:'growth-loop-telemetry-v2',pages:Object.keys(FILES).filter(k=>k.endsWith('.html')).length}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
    let p = url.pathname;
    if (p === '/') p = '/index.html';
    if (!FILES[p] && FILES[p + '.html']) p = p + '.html';
    const f = FILES[p];
    if (!f) return Response.redirect(url.origin + '/', 302);
    const body = f.ct.startsWith('text/html') ? injectGrowthLoopTelemetry(f.body, env) : f.body;
    const cacheControl = f.ct.startsWith('text/html') ? 'no-store' : 'public, max-age=300';
    return new Response(body, { headers: { 'Content-Type': f.ct, 'Cache-Control': cacheControl } });
  },
};
