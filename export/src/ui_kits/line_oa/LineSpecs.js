// LineSpecs.jsx — single source of truth for everything needed to upload
// the OA to LINE Official Account Manager. Used by launch.html.

window.LINE_SPECS = {
  account: {
    displayName: '3Q貢丸 · 台灣在地品牌孵化所',
    nameSub: 'TAIWAN BRAND HATCHERY',
    lineId: '@121LKSPE',
    statusMessage: '只要你願意說，我們就幫你被看見。',  // max 20 chars in LINE UI; we use 19
    about: [
      '台灣在地品牌孵化所。',
      '不管你的店多大多小，',
      '我們都有適合的平台、舞台、後台。',
      '——',
      '・好物・好照 · FROM 500',
      '・陪你被看見 · 客製行銷',
      '・走到哪了 · 進度追蹤',
    ].join('\n'),
  },

  avatar: {
    spec: '640 × 640 px · JPG/PNG · ≤ 3 MB',
    filename: '3Q-HATCHERY_avatar_640x640.png',
    note: '圓形裁切，安全區域留 10% 邊緣',
  },

  cover: {
    spec: '1080 × 878 px · JPG/PNG · ≤ 3 MB',
    filename: '3Q-HATCHERY_cover_1080x878.jpg',
    note: '上方 150px 會被頭像 + 帳號名遮住，重要資訊放下半部 / 右側',
  },

  richMenu: {
    spec: '2500 × 1686 px · JPG/PNG · ≤ 1 MB',
    filename: '3Q-HATCHERY_richmenu_2500x1686.jpg',
    template: '大型 6 格 (1 hero band + 4 cells)',
    layout: 'custom: 1×800 hero + 4×886 grid',
    // Tap zones in LINE coordinate system (top-left origin, 2500×1686)
    tapZones: [
      {
        id: 'A',
        label: 'HERO BAND',
        zh: '官網 / 品牌主頁',
        x: 0, y: 0, w: 2500, h: 800,
        action: { type: 'uri', uri: 'https://3q-hatchery.tw' },
      },
      {
        id: 'B',
        label: 'CELL 1',
        zh: '說說你的店',
        x: 0, y: 800, w: 625, h: 886,
        action: { type: 'message', text: '我想說說我的店' },
      },
      {
        id: 'C',
        label: 'CELL 2',
        zh: '好物・好照',
        x: 625, y: 800, w: 625, h: 886,
        action: { type: 'message', text: '我想了解好物・好照' },
      },
      {
        id: 'D',
        label: 'CELL 3',
        zh: '陪你被看見',
        x: 1250, y: 800, w: 625, h: 886,
        action: { type: 'message', text: '我想要客製行銷' },
      },
      {
        id: 'E',
        label: 'CELL 4',
        zh: '走到哪了',
        x: 1875, y: 800, w: 625, h: 886,
        action: { type: 'message', text: '查我的進度' },
      },
    ],
  },

  greeting: {
    spec: 'LINE Official Account → 開始訊息 (Greeting)',
    note: '加入官方帳號後第一則訊息。可包含文字 + 1 張圖片 + 1 個 LINE 卡片。',
    text: [
      '你好，這裡是 3Q貢丸 · 台灣在地品牌孵化所。',
      '',
      '只要你願意說，我們就幫你被看見。',
      '不管你的店多大多小、新舊、簡單複雜，',
      '我們都有適合的平台、舞台、後台。',
      '',
      '👉 點下方圖文選單 「說說你的店」',
      '我們會幫你找出下一步該被拍下、被講出、被看見的，是哪一件事。',
    ].join('\n'),
  },

  awayMessage: {
    spec: '非營業時間自動回覆',
    text: [
      '收到你的訊息了 — 我們會在 24 小時內回你。',
      '如果是急事，可以先看 https://3q-hatchery.tw/faq',
      '謝謝你願意說。',
    ].join('\n'),
  },

  autoReplies: [
    {
      keywords: ['說說我的店', '我的店', '我想說'],
      response: '好。先告訴我們三件事：\n1. 你的店在哪裡 (區域)\n2. 你做的東西是什麼\n3. 你現在最頭痛的一件事\n\n直接打字給我，不用寫得漂亮。我們讀得到。',
    },
    {
      keywords: ['好物', '好照', '生圖', '拍照', '500'],
      response: '「好物・好照」從一個產品開始，500 元 起。\n包含：1 張像樣的產品照 + 1 段別人讀得進去的介紹文。\n\n想看實例？回「實例」我寄給你三個。',
    },
    {
      keywords: ['客製', '行銷', '陪你', '陪跑'],
      response: '客製行銷是季度規劃，從你的店現在的階段往前 3 個月。\n我們先約 30 分鐘的諮詢，免費。\n\n回「諮詢」我們開時段。',
    },
    {
      keywords: ['進度', '走到哪'],
      response: '請告訴我們你的店名 / 報名編號，\n我們會回你目前進行到哪一步、下次要做什麼。',
    },
    {
      keywords: ['實例', '案例', '看作品'],
      response: '本月入駐：\n01 阿婆ㄟ切仔麵店 (雲林)\n02 三代米舖 (台南)\n03 鹿港織坊\n\n回「01 / 02 / 03」看單一案例。',
    },
    {
      keywords: ['諮詢', '預約'],
      response: '好。先簡單告訴我們：\n你的店名 / 你的角色 / 想聊什麼\n\n我們會在 24 小時內寄時段給你。',
    },
  ],

  carouselPush: {
    title: '本月入駐 · 4 件作品',
    cards: [
      { eyebrow: 'NO. 01', title: '本月入駐\n阿婆ㄟ切仔麵店', meta: 'YUNLIN · 2026',
        action: { type: 'message', text: '看 01 阿婆ㄟ切仔麵店' } },
      { eyebrow: 'NO. 02', title: '好物\n值得好照',           meta: '好物・好照 · FROM 500',
        action: { type: 'message', text: '我想了解好物・好照' } },
      { eyebrow: 'NO. 03', title: '一束稻\n一個故事',         meta: 'TAINAN · 工坊',
        action: { type: 'message', text: '看 03 三代米舖' } },
      { eyebrow: 'NO. 04', title: '原麻布\n沒被命名的好',     meta: 'WEAVERS · 鹿港',
        action: { type: 'message', text: '看 04 鹿港織坊' } },
    ],
  },

  checklist: [
    { id: 'cover',   label: '上傳封面圖 Cover',                detail: '1080 × 878 px',      done: true },
    { id: 'avatar',  label: '上傳大頭照 Avatar',                detail: '640 × 640 px',       done: true },
    { id: 'name',    label: '設定帳號名稱 + 狀態消息',         detail: '帳號名 + 19 字內',    done: true },
    { id: 'about',   label: '填寫 About / 介紹',                detail: 'LINE Profile 頁',     done: true },
    { id: 'greet',   label: '設定開始訊息 Greeting',            detail: '加入後第一則訊息',     done: true },
    { id: 'menu',    label: '上傳圖文選單 Rich Menu',           detail: '2500 × 1686 + tap zones', done: true },
    { id: 'reply',   label: '設定關鍵字自動回覆',                detail: '6 組 keyword → reply', done: true },
    { id: 'away',    label: '設定非營業時間訊息',                detail: '24h 回覆承諾',         done: true },
    { id: 'push',    label: '準備首推輪播訊息',                  detail: '4 張卡 + tap actions', done: true },
    { id: 'qa',      label: '上線前 QA — 每個按鈕都點過',         detail: '12 個 tap surface',    done: false },
  ],
};
