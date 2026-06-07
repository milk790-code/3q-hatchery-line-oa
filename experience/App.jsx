// App.jsx — v3 orchestrator. Reads HATCHERY_FLOW, walks welcome → name →
// questions interleaved with interstitials → result.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "noGold": false,
  "forcePersona": "auto",
  "forceStage": "auto",
  "welcomeLine": "我們就幫你被看見。"
}/*EDITMODE-END*/;

function App() {
  const { QUESTIONS, PERSONAS, STAGES, tally } = window.HATCHERY_DATA;
  const { FLOW, QINDEX, INTERSTITIALS }        = window.HATCHERY_FLOW;

  const [t, setTweak] = window.useTweaks
    ? window.useTweaks(TWEAK_DEFAULTS)
    : [TWEAK_DEFAULTS, () => {}];

  const [step, setStep]           = React.useState(0);          // index into FLOW
  const [answers, setAnswers]     = React.useState({});         // qid -> optIdx
  const [storeName, setStoreName] = React.useState('');

  const restart = () => { setAnswers({}); setStoreName(''); setStep(0); };
  const next    = () => setStep((s) => Math.min(FLOW.length - 1, s + 1));
  const back    = () => setStep((s) => Math.max(0, s - 1));
  const choose  = (qid, optIdx) => setAnswers((a) => ({ ...a, [qid]: optIdx }));

  // Compute tally on every answer change (needed by interstitials + result)
  const computed = React.useMemo(() => {
    const opts = QUESTIONS.map((q) => {
      const idx = answers[q.id];
      return idx == null ? null : q.options[idx];
    });
    return tally(opts);
  }, [answers]);

  const personaId = (t.forcePersona !== 'auto' && PERSONAS[t.forcePersona])
    ? t.forcePersona : computed.persona;
  const stageId = (t.forceStage !== 'auto' && STAGES[t.forceStage])
    ? t.forceStage : computed.stage;

  const persona = PERSONAS[personaId];
  const stage   = STAGES[stageId];

  const ctx = { persona, stage, echoes: computed.echoes, storeName };

  const rootCls = ['phone-inner', t.noGold ? 'no-gold' : ''].filter(Boolean).join(' ');

  // Status bar
  const Status = () => (
    <div className="phone-status">
      <div className="time">9:41</div>
      <div className="right">
        <span className="bar" style={{ height: 6 }}/>
        <span className="bar" style={{ height: 8 }}/>
        <span className="bar" style={{ height: 10 }}/>
        <span className="bar" style={{ height: 12 }}/>
        <span style={{ width: 6 }}/>
        <span style={{ fontSize: 10, letterSpacing: '0.1em', color: '#0A0A0A' }}>LINE</span>
      </div>
    </div>
  );

  // Derive the current screen from FLOW[step]
  const node = FLOW[step] || { kind: 'welcome' };

  // Build a global "question number" (out of all Q-kind steps) for the progress bar
  const totalQ = FLOW.filter((s) => s.kind === 'q').length;
  let qIdxInFlow = 0;
  {
    let n = 0;
    for (let i = 0; i < step; i++) if (FLOW[i].kind === 'q') n++;
    qIdxInFlow = n; // 0-indexed
  }

  let screen = null;
  if (node.kind === 'welcome') {
    screen = <Welcome onStart={next} closingLine={t.welcomeLine}/>;
  } else if (node.kind === 'name') {
    screen = (
      <NamePrompt
        storeName={storeName}
        onChange={setStoreName}
        onContinue={next}
        onSkip={next}
      />
    );
  } else if (node.kind === 'q') {
    const q = QUESTIONS[QINDEX[node.qid]];
    if (!q) {
      screen = <div className="scr" style={{ padding: 32 }}>Missing question: {node.qid}</div>;
    } else {
      const isLastQ = qIdxInFlow === totalQ - 1;
      // Re-stamp the eyebrow to match the flow position, since QUESTIONS array
      // order isn't the same as FLOW order.
      const flowQ = {
        ...q,
        eyebrow: `NO. ${String(qIdxInFlow + 1).padStart(2,'0')} / ${String(totalQ).padStart(2,'0')}`,
      };
      screen = (
        <Question
          idx={qIdxInFlow}
          total={totalQ}
          q={flowQ}
          selected={answers[q.id]}
          onSelect={(i) => choose(q.id, i)}
          onBack={back}
          onNext={next}
          ctaLabel={isLastQ ? '完成' : '下一題'}
        />
      );
    }
  } else if (node.kind === 'inter') {
    const data = INTERSTITIALS[node.interId] ? INTERSTITIALS[node.interId](ctx) : null;
    screen = <Interstitial data={data} onNext={next}/>;
  } else if (node.kind === 'result') {
    screen = (
      <Result
        persona={persona}
        stage={stage}
        echoes={(computed.echoes || []).slice(0, 3)}
        storeName={storeName}
        onRestart={restart}
      />
    );
  }

  // Tweaks panel
  const TP   = window.TweaksPanel;
  const TSec = window.TweakSection;
  const TT   = window.TweakToggle;
  const TS   = window.TweakSelect;
  const TX   = window.TweakText;
  const TBtn = window.TweakButton;

  return (
    <>
      <div className="stage-bg"/>
      <div className="stage-meta">
        <span>EXPERIENCE</span><span className="meta-line"/><span>HATCHERY DIAGNOSTIC · V3</span>
      </div>
      <div className="stage-meta-r">3Q · 只要你願意說，我們就幫你被看見</div>

      <div className="stage">
        <div className="phone">
          <div className="phone-notch"/>
          <Status/>
          <div className={rootCls} style={{ position:'absolute', inset:0 }} key={step}>
            {screen}
          </div>
        </div>
      </div>

      {TP && (
        <TP title="Tweaks">
          <TSec label="Brand">
            <TT label="Monochrome (no gold)" value={!!t.noGold} onChange={(v) => setTweak('noGold', v)}/>
          </TSec>
          <TSec label="Result override">
            <TS
              label="Persona"
              value={t.forcePersona || 'auto'}
              options={['auto', 'maker', 'creator', 'operator', 'inheritor', 'innovator', 'hybrid']}
              onChange={(v) => setTweak('forcePersona', v)}
            />
            <TS
              label="Scale tier"
              value={t.forceStage || 'auto'}
              options={['auto', 't1', 't2', 't3', 't4']}
              onChange={(v) => setTweak('forceStage', v)}
            />
            <TBtn label="Reset" onClick={restart}/>
            <TBtn label="Jump to result" onClick={() => setStep(FLOW.length - 1)}/>
          </TSec>
          <TSec label="Copy">
            <TX
              label="Welcome closing line"
              value={t.welcomeLine || ''}
              onChange={(v) => setTweak('welcomeLine', v)}
            />
          </TSec>
        </TP>
      )}
    </>
  );
}

window.App = App;
