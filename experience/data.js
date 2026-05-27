// data.js — Expanded v2
// Six persona archetypes spanning 10元茶葉蛋 → 企業, eight diagnostic questions,
// scale tier scoring on a separate axis, and per-answer emotional "callbacks"
// that the Result page quotes back to the user.

const PERSONAS = {
  maker: {
    id: 'maker',
    en: 'The Maker',
    zh: '生產者',
    spectrum: '從手作攤位 → 自有工廠',
    photo: 'assets/photography/still-bowl-rice.svg',
    title: '你的手藝已經夠好。\n只要你願意說 — 我們就替它拍下來。',
    bodyByTier: {
      t1: '一個攤位、一支招牌，最缺的就是一張像樣的照片，跟一句講得出口的介紹。我們從這兩件做起，價格按你的規模算。',
      t2: '你已經有店有客人，少的是「被路過的人看見」的入口。我們處理那道入口 — 招牌、貨架照、第一篇貼文。',
      t3: '產品線越多越需要視覺一致性。我們幫你建一套可重複的拍攝規範，下次新品上架不再從零開始。',
      t4: '產品好但系統散，這是企業常見的事。我們不接案，我們進來幫你建內部視覺資產庫和拍攝 SOP。',
    },
    quote: '東西好，會說話。\n我們只是負責替它把音量調對。',
    services: [
      { tag: 'SERVICE · 01', name: '500 元生圖方案', desc: '第一張像樣的產品照，從一個 SKU 開始。'  },
      { tag: 'SERVICE · 02', name: '單品故事整理', desc: '把你三句話講得完的事寫成一段別人讀得進去的字。' },
      { tag: 'SERVICE · 03', name: '視覺系統建檔', desc: '可重複的拍攝規範，下次新品不再從零開始。' },
    ],
  },
  creator: {
    id: 'creator',
    en: 'The Creator',
    zh: '創作者',
    spectrum: '從個人工作室 → 設計品牌',
    photo: 'assets/photography/ink-stone.svg',
    title: '你做的東西有它自己的話。\n只要你願意說 — 我們就替它寫出來。',
    bodyByTier: {
      t1: '作品最孤單的時候，是它有故事卻沒人問。我們陪你把那段話寫出來，把工序拍成可以收藏的樣子。',
      t2: '一個系列推出去，少的常常是「為什麼是這個」的那句話。我們幫你寫，並且重拍工序。',
      t3: '你已經被看見了，下一步是「被讀進去」。我們做的是長文 + 編輯式視覺包。',
      t4: '品牌已成型，差的是內部敘事一致性。我們做品牌書、設計提案模板、媒體稿底稿。',
    },
    quote: '不是每個作品都需要被解釋。\n但每個都值得被理解。',
    services: [
      { tag: 'SERVICE · 01', name: '作品故事整理', desc: '把工序、想法、選材寫成一段可以印的字。'  },
      { tag: 'SERVICE · 02', name: '工序視覺紀錄', desc: '不擺拍的編輯式工作室攝影。' },
      { tag: 'SERVICE · 03', name: '系列定調諮詢', desc: '為你的下一個系列定一個能溝通的調。' },
    ],
  },
  operator: {
    id: 'operator',
    en: 'The Operator',
    zh: '服務者',
    spectrum: '從一個攤位 → 連鎖',
    photo: 'assets/photography/cupped-palm-light.svg',
    title: '你的店裡有别處沒有的光。\n只要你願意說 — 我們就替它打亮給陌生人看。',
    bodyByTier: {
      t1: '招牌、菜單、第一張照片 — 這三件做對了，路過的人會停。我們從這三件開始。',
      t2: '你的老客很穩，新客不來。我們處理「招牌外觀 + 第一篇可分享內容」這兩件。',
      t3: '多店的痛點不是行銷，是「每家分店看起來都像一家店」。我們做視覺一致性手冊。',
      t4: '連鎖最怕的是規模化過程中流失原本的味道。我們協助保留 DNA 同時讓視覺成長。',
    },
    quote: '招牌不是裝飾。\n是邀請函。',
    services: [
      { tag: 'SERVICE · 01', name: '招牌與門面規劃', desc: '路過的人會不會停，看這 3 秒。' },
      { tag: 'SERVICE · 02', name: '首篇可分享內容', desc: '第一張會被截圖傳出去的照片。' },
      { tag: 'SERVICE · 03', name: '視覺一致性手冊', desc: '從一家到十家，看起來都是同一個你。' },
    ],
  },
  inheritor: {
    id: 'inheritor',
    en: 'The Inheritor',
    zh: '傳承者',
    spectrum: '從家族小店 → 老字號',
    photo: 'assets/photography/rice-stalk.svg',
    title: '招牌沒老，只是還沒被重新看見。\n只要你願意說 — 我們就替它擦亮。',
    bodyByTier: {
      t1: '一塊牌子掛了好幾十年，最怕的是「為了新而新」。我們的更新不是換掉，是擦亮。',
      t2: '二代接手最常聽到的話是「不要變太多」。我們幫你做「老客人不會生氣」的更新。',
      t3: '老字號要規模化，第一件事是把 DNA 寫下來。我們做品牌資產盤點。',
      t4: '走到企業規模還想保留原味，這事不容易。我們做世代對話 + 品牌書 + 視覺系統。',
    },
    quote: '不是把它變新。\n是把它的好擦亮。',
    services: [
      { tag: 'SERVICE · 01', name: '世代對話諮詢', desc: '三代人，先坐下來把該講的講清楚。' },
      { tag: 'SERVICE · 02', name: '招牌的當代影像', desc: '同一個招牌，2026 年該長什麼樣。' },
      { tag: 'SERVICE · 03', name: '品牌 DNA 盤點', desc: '把「不能丟」的事寫下來。' },
    ],
  },
  innovator: {
    id: 'innovator',
    en: 'The Innovator',
    zh: '創新者',
    spectrum: '從新模式 / 新品類 → 上市企業',
    photo: 'assets/photography/raw-linen.svg',
    title: '你的概念是新的，市場還沒準備好。\n只要你願意說 — 我們就替你翻譯。',
    bodyByTier: {
      t1: '新東西最大的敵人，是「市場還沒有這個詞」。我們陪你把它命名。',
      t2: 'PMF 之前最缺的不是行銷，是「對的人能不能聽懂」的那句話。我們做敘事測試。',
      t3: '產品已經 work，下一步是把市場教育成本壓下來。我們做白皮書 + 案例頁。',
      t4: 'B2B 與上市企業最缺的是「對投資人 / 對員工 / 對市場」三種版本的同一個故事。我們做三版敘事。',
    },
    quote: '新東西不是被介紹的，\n是被翻譯的。',
    services: [
      { tag: 'SERVICE · 01', name: '概念命名工作坊', desc: '為你的「還沒有名字」的事找一個能說的詞。' },
      { tag: 'SERVICE · 02', name: '案例頁 / 白皮書', desc: '把第一個 case 寫到第二個人能複製。' },
      { tag: 'SERVICE · 03', name: '三版敘事', desc: '投資人版 / 員工版 / 市場版，同一個故事。' },
    ],
  },
  hybrid: {
    id: 'hybrid',
    en: 'The Hybrid',
    zh: '混合者',
    spectrum: '新舊結合 / 跨界 / IP 合作',
    photo: 'assets/photography/envelope-flat.svg',
    title: '你站在兩邊，哪邊都該被照顧。\n只要你願意說 — 我們就替兩邊都打點好。',
    bodyByTier: {
      t1: '跨界合作最常見的問題是「兩邊都做一點，兩邊都不夠」。我們先幫你把比例定下來。',
      t2: '新與舊的結合不是視覺問題，是節奏問題。我們處理「先說哪一個」的順序。',
      t3: 'IP 合作或品牌聯名，最怕雙方都被稀釋。我們做合作前的識別校對。',
      t4: '企業跨界專案，常常輸在「對內怎麼解釋」這一關。我們做內部敘事與對外發布的雙軌。',
    },
    quote: '兩邊都顧到，\n不是各做一半。',
    services: [
      { tag: 'SERVICE · 01', name: '合作識別校對', desc: '兩個品牌見面之前，先把彼此擦亮。' },
      { tag: 'SERVICE · 02', name: '節奏排序', desc: '先講新、還是先講舊？我們幫你定。' },
      { tag: 'SERVICE · 03', name: '雙軌發布', desc: '對內版 + 對外版，同一個故事兩種說法。' },
    ],
  },
};

// ============================================================================
// Scale tiers — separate axis. 1 = micro, 4 = enterprise.
// ============================================================================
const STAGES = {
  t1: { id: 't1', label: '茶葉蛋級', sub: 'Solo / 攤位', range: '一個品項，多半自己來' },
  t2: { id: 't2', label: '小店階段', sub: 'Small Shop', range: '一間店面，一兩位夥伴' },
  t3: { id: 't3', label: '多店階段', sub: 'Multi-location', range: '幾家分店或穩定團隊' },
  t4: { id: 't4', label: '企業階段', sub: 'Enterprise', range: '組織化、有部門、有預算' },
};

// ============================================================================
// QUESTIONS
//   Each option carries:
//     personaScores: { [persona]: weight }
//     stage?: 't1' | 't2' | 't3' | 't4'   (if this question reads scale)
//     echo?: string                       (the callback line for Result page;
//                                          appears verbatim in "我們聽到了")
// ============================================================================
const QUESTIONS = [
  {
    id: 'what',
    eyebrow: 'NO. 01 / 08',
    prompt: '你做的，\n是什麼東西？',
    sub: '挑最接近的那個。',
    options: [
      { label: '一份能吃的、能用的東西',         sub: '食物 / 農產 / 手作',     personaScores: { maker: 3 } },
      { label: '一個有想法的作品或內容',         sub: '設計 / 工藝 / 內容',     personaScores: { creator: 3 } },
      { label: '一個能讓人坐下來的空間',         sub: '餐廳 / 咖啡 / 工作室',   personaScores: { operator: 3 } },
      { label: '一個傳了好幾代的招牌',           sub: '老字號 / 家族店',         personaScores: { inheritor: 3 } },
      { label: '一個還沒有名字的新東西',         sub: 'B2B / 新品類 / 科技',     personaScores: { innovator: 3 } },
      { label: '一個把兩件事接起來的合作',       sub: '跨界 / IP / 新舊結合',   personaScores: { hybrid: 3 } },
    ],
  },
  {
    id: 'scale',
    eyebrow: 'NO. 02 / 08',
    prompt: '你現在，\n是什麼規模？',
    sub: '從茶葉蛋到企業，都可以。',
    options: [
      { label: '一個人、一個攤、一個品項', sub: 'T1 · SOLO', stage: 't1' },
      { label: '一間店、一兩位夥伴',       sub: 'T2 · SHOP', stage: 't2' },
      { label: '幾家分店、有穩定團隊',     sub: 'T3 · MULTI', stage: 't3' },
      { label: '組織化、有部門、有預算',   sub: 'T4 · ENTERPRISE', stage: 't4' },
    ],
  },
  {
    id: 'years',
    eyebrow: 'NO. 03 / 08',
    prompt: '你做這件事，\n多久了？',
    sub: '時間是線索。',
    options: [
      { label: '還在準備', sub: 'PRE-LAUNCH', personaScores: { innovator: 1 } },
      { label: '不到一年', sub: '< 1 YEAR',   personaScores: { maker: 1, creator: 1, innovator: 1 } },
      { label: '一到五年', sub: '1 – 5 YEARS', personaScores: { operator: 2, creator: 1, innovator: 1 } },
      { label: '五年以上', sub: '5+ YEARS',   personaScores: { inheritor: 3, operator: 1 } },
    ],
  },
  {
    id: 'pain',
    eyebrow: 'NO. 04 / 08',
    prompt: '最頭痛的，\n是哪件事？',
    sub: '誠實一點。',
    echoTemplate: '你說，最頭痛的是 ——「{label}」。',
    options: [
      { label: '東西明明很好，但照片拍不漂亮',     sub: '視覺斷層', personaScores: { maker: 2, operator: 1 } },
      { label: '我講不出來這東西為什麼特別',       sub: '敘述斷層', personaScores: { creator: 2, innovator: 1 } },
      { label: '老客戶熟，新的人不會進來',         sub: '客流斷層', personaScores: { operator: 2 } },
      { label: '想更新，但怕老客人覺得「變了」',   sub: '世代斷層', personaScores: { inheritor: 3 } },
      { label: '市場還聽不懂我在做什麼',           sub: '認知斷層', personaScores: { innovator: 3 } },
      { label: '兩邊都要顧，但兩邊都不夠到位',     sub: '協調斷層', personaScores: { hybrid: 3 } },
    ],
  },
  {
    id: 'misunderstood',
    eyebrow: 'NO. 05 / 08',
    prompt: '陌生人最常\n誤會你的是？',
    sub: '直覺選。',
    echoTemplate: '你說，最常被誤會成「{label}」。',
    options: [
      { label: '太貴',     sub: 'TOO PREMIUM',    personaScores: { creator: 1, inheritor: 1 } },
      { label: '太小',     sub: 'TOO SMALL',      personaScores: { maker: 1, operator: 1 } },
      { label: '太老',     sub: 'TOO TRADITIONAL', personaScores: { inheritor: 2 } },
      { label: '太新',     sub: 'TOO NEW',         personaScores: { innovator: 2, hybrid: 1 } },
      { label: '太一般',   sub: 'TOO ORDINARY',    personaScores: { maker: 2, operator: 1 } },
      { label: '太特殊',   sub: 'TOO NICHE',       personaScores: { creator: 2, hybrid: 1 } },
    ],
  },
  {
    id: 'nightthought',
    eyebrow: 'NO. 06 / 08',
    prompt: '半夜睡不著，\n你還在想什麼？',
    sub: '不會傳出去。',
    echoTemplate: '你說，半夜還在想 ——「{label}」。',
    options: [
      { label: '下一個產品該長什麼樣',     sub: 'NEXT SKU',     personaScores: { maker: 2, creator: 1 } },
      { label: '招牌是不是該換了',         sub: 'SIGNAGE',      personaScores: { operator: 2, inheritor: 2 } },
      { label: '新的客人為什麼不來',       sub: 'NEW TRAFFIC',  personaScores: { operator: 3 } },
      { label: '怎麼把上一代的好留下來',   sub: 'LEGACY',       personaScores: { inheritor: 3 } },
      { label: '怎麼讓市場聽得懂我',       sub: 'CATEGORY',     personaScores: { innovator: 3 } },
      { label: '怎麼讓兩邊都覺得被照顧',   sub: 'BALANCE',      personaScores: { hybrid: 3 } },
    ],
  },
  {
    id: 'noticed',
    eyebrow: 'NO. 07 / 08',
    prompt: '如果一個陌生人\n走過你的店，\n你最想他注意到什麼？',
    sub: '只能挑一個。',
    echoTemplate: '你希望陌生人先注意到 ——「{label}」。',
    options: [
      { label: '我手裡那個產品的細節',     sub: 'CRAFT',     personaScores: { maker: 2, creator: 1 } },
      { label: '那個只有我懂的工序',       sub: 'PROCESS',   personaScores: { creator: 3 } },
      { label: '客人坐下來那一刻的光',     sub: 'AMBIENCE',  personaScores: { operator: 3 } },
      { label: '招牌底下，三代人的手',     sub: 'GENERATIONS', personaScores: { inheritor: 3 } },
      { label: '那個跟別人都不一樣的點子', sub: 'IDEA',      personaScores: { innovator: 3 } },
      { label: '兩件事接在一起的那條縫',   sub: 'SEAM',      personaScores: { hybrid: 3 } },
    ],
  },
  {
    id: 'ask',
    eyebrow: 'NO. 08 / 08',
    prompt: '如果可以選\n一件孵化所為你做的事？',
    sub: '最想要的那一件。',
    options: [
      { label: '拍出第一張像樣的照片',           sub: 'VISUAL',     personaScores: { maker: 3 } },
      { label: '把作品的故事整理成一段話',       sub: 'NARRATIVE',  personaScores: { creator: 3 } },
      { label: '規劃出讓陌生人想推開門的招牌',   sub: 'SIGNAGE',    personaScores: { operator: 3 } },
      { label: '更新識別但留住老味道',           sub: 'LEGACY',     personaScores: { inheritor: 3 } },
      { label: '幫我把概念講成市場聽得懂的話',   sub: 'TRANSLATE',  personaScores: { innovator: 3 } },
      { label: '把兩邊的合作節奏整理乾淨',       sub: 'BALANCE',    personaScores: { hybrid: 3 } },
    ],
  },
];

// ============================================================================
// Tally
// ============================================================================
function tally(answers /* array of selected option objects (or null) */) {
  const persona = { maker: 0, creator: 0, operator: 0, inheritor: 0, innovator: 0, hybrid: 0 };
  const stageVotes = { t1: 0, t2: 0, t3: 0, t4: 0 };
  const echoes = [];

  answers.forEach((opt, qi) => {
    if (!opt) return;
    if (opt.personaScores) {
      for (const [k, v] of Object.entries(opt.personaScores)) {
        persona[k] = (persona[k] || 0) + v;
      }
    }
    if (opt.stage) stageVotes[opt.stage] = (stageVotes[opt.stage] || 0) + 1;
    if (QUESTIONS[qi] && QUESTIONS[qi].echoTemplate) {
      echoes.push({
        qid: QUESTIONS[qi].id,
        prompt: QUESTIONS[qi].prompt.replace(/\n/g, ''),
        line: QUESTIONS[qi].echoTemplate.replace('{label}', opt.label),
        value: opt.label,
      });
    }
  });

  // pick highest persona; ties resolved by canonical order
  const order = ['maker', 'creator', 'operator', 'inheritor', 'innovator', 'hybrid'];
  let pid = 'maker', max = -1;
  for (const k of order) { if (persona[k] > max) { max = persona[k]; pid = k; } }

  // pick highest stage; fallback t2
  let sid = 't2', smax = -1;
  for (const k of ['t1','t2','t3','t4']) { if (stageVotes[k] > smax) { smax = stageVotes[k]; sid = k; } }

  return { persona: pid, stage: sid, personaTotals: persona, stageVotes, echoes };
}

// ============================================================================
// ADDITIONAL QUESTIONS — appended via push so we don't risk breaking earlier defs
// ============================================================================
QUESTIONS.push({
  id: 'notbe',
  eyebrow: 'NO. 08 / 10',
  prompt: '你最怕\n被當成哪一種店？',
  sub: '怕的那一個，才是底線。',
  echoTemplate: '你說，最怕被當成「{label}」。',
  options: [
    { label: '太便宜的那種',       sub: 'CHEAP',        personaScores: { creator: 1, inheritor: 1 } },
    { label: '太裝模作樣的那種',   sub: 'PRETENTIOUS',  personaScores: { maker: 2, operator: 1 } },
    { label: '太隨便的那種',       sub: 'CARELESS',     personaScores: { creator: 1, inheritor: 1 } },
    { label: '太花俏的那種',       sub: 'GIMMICKY',     personaScores: { inheritor: 2, maker: 1 } },
    { label: '太冷淡的那種',       sub: 'COLD',         personaScores: { operator: 2 } },
    { label: '太一般的那種',       sub: 'FORGETTABLE',  personaScores: { innovator: 2, hybrid: 1 } },
  ],
});
QUESTIONS.push({
  id: 'wantbe',
  eyebrow: 'NO. 09 / 10',
  prompt: '希望別人想到你，\n第一個詞是？',
  sub: '不用謙虛。',
  echoTemplate: '你說，希望被想到時，是「{label}」。',
  options: [
    { label: '實在',  sub: 'HONEST',   personaScores: { maker: 2, inheritor: 1 } },
    { label: '講究',  sub: 'CRAFTED',  personaScores: { creator: 3 } },
    { label: '溫暖',  sub: 'WARM',     personaScores: { operator: 2, inheritor: 1 } },
    { label: '老派',  sub: 'TIMELESS', personaScores: { inheritor: 3 } },
    { label: '聰明',  sub: 'CLEVER',   personaScores: { innovator: 2 } },
    { label: '剛剛好', sub: 'BALANCED', personaScores: { hybrid: 2, maker: 1 } },
  ],
});

// Renumber eyebrows now that we have 10 questions
QUESTIONS.forEach((q, i) => {
  q.eyebrow = `NO. ${String(i+1).padStart(2,'0')} / ${String(QUESTIONS.length).padStart(2,'0')}`;
});

// ============================================================================
// FLOW — screen sequence
// ============================================================================
const FLOW = [
  { kind: 'welcome' },
  { kind: 'name'    },
  { kind: 'q', qid: 'what'          },
  { kind: 'q', qid: 'scale'         },
  { kind: 'q', qid: 'years'         },
  { kind: 'inter', interId: 'persona' },
  { kind: 'q', qid: 'pain'          },
  { kind: 'q', qid: 'misunderstood' },
  { kind: 'q', qid: 'nightthought'  },
  { kind: 'inter', interId: 'heard' },
  { kind: 'q', qid: 'noticed'       },
  { kind: 'q', qid: 'notbe'         },
  { kind: 'q', qid: 'wantbe'        },
  { kind: 'q', qid: 'ask'           },
  { kind: 'inter', interId: 'stitch' },
  { kind: 'result' },
];

const QINDEX = {};
QUESTIONS.forEach((q, i) => { QINDEX[q.id] = i; });

// ============================================================================
// INTERSTITIALS — emotional beats. Computed at runtime.
// ============================================================================
const INTERSTITIALS = {
  persona: (ctx) => {
    const { persona, stage, storeName } = ctx;
    const who = storeName ? `「${storeName}」` : '你';
    return {
      eyebrow: 'AT THIS POINT · 第一段',
      photo: 'assets/photography/rice-stalk.svg',
      lines: [
        `原來，${who}是 ——`,
        `${persona.zh}　${persona.en}`,
        `現在站在 ${stage.label}。`,
      ],
      sub: '夠了。\n這已經是一個故事的開頭。',
      kicker: '繼續',
    };
  },
  heard: (ctx) => ({
    eyebrow: 'WHAT WE HEARD · 第二段',
    photo: 'assets/photography/ink-stone.svg',
    preface: '你說的這幾件事 ——',
    echoes: (ctx.echoes || []).slice(0, 3),
    sub: '我們都聽過。\n也都做過。',
    kicker: '繼續',
  }),
  stitch: (ctx) => {
    const subject = ctx.storeName ? `「${ctx.storeName}」` : '你';
    return {
      eyebrow: 'ALMOST THERE · 第三段',
      photo: 'assets/photography/envelope-flat.svg',
      lines: [
        '等一下下。',
        `我們替${subject}`,
        '拼出來了。',
      ],
      sub: '三秒。',
      kicker: '看見我',
      autoAdvance: 2800,
    };
  },
};

window.HATCHERY_DATA = { PERSONAS, STAGES, QUESTIONS, tally };
window.HATCHERY_FLOW = { FLOW, QINDEX, INTERSTITIALS };
