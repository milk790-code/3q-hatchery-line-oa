// SocialSpecs.js — production specs + paste-ready copy for IG / Threads / TikTok.

window.SOCIAL_SPECS = {
  // ===== Instagram =====
  instagram: {
    handle: '@3q.hatchery',
    displayName: '3Q貢丸 · 台灣在地品牌孵化所',
    bio: [
      'TAIWAN BRAND HATCHERY',
      '只要你願意說，我們就幫你被看見。',
      '從 10 元茶葉蛋 → 上市企業',
      '↓ 加入 LINE 預約諮詢',
    ].join('\n'),
    bioCount: 80,        // IG bio limit is 150 chars
    linkInBio: 'https://lin.ee/121LKSPE',
    category: 'Brand · Marketing Agency',

    profilePic: {
      spec: '320 × 320 px (uploaded 1080×1080) · JPG · ≤ 1 MB',
      filename: '3Q-HATCHERY_ig-avatar_1080x1080.jpg',
      note: 'IG 顯示為圓形，安全區域留 12%',
    },

    feedPost: {
      spec: '1080 × 1350 px (4:5) · JPG quality 90 · ≤ 8 MB',
      filename: '3Q-HATCHERY_ig-feed_{date}_{slug}.jpg',
      template: 'Top 73% photo / Bottom 27% paper-white type bar',
      cadence: '週三、週五 1700 (UTC+8)',
    },

    story: {
      spec: '1080 × 1920 px · JPG · ≤ 8 MB',
      filename: '3Q-HATCHERY_ig-story_{date}_{slug}.jpg',
      template: 'Full-bleed photo + 200px bottom paper strip',
      cadence: '每日 ≥ 1 則，週末可休',
      note: '上 250px + 下 250px 是 IG UI 安全區，重要文字避開',
    },

    highlightCovers: {
      spec: '1080 × 1920 px · 圓形裁切（IG 上會剪裁成 1:1）· JPG · ≤ 5 MB',
      filename: '3Q-HATCHERY_ig-highlight_{id}.jpg',
      covers: [
        { id: '00', label: '是誰',    en: 'WHO',       icon: 'consultation' },
        { id: '01', label: '入駐',    en: 'PORTFOLIO', icon: 'envelope' },
        { id: '02', label: '好物・好照', en: 'IMAGERY',  icon: 'camera' },
        { id: '03', label: '陪你',    en: 'TOGETHER',  icon: 'compass' },
        { id: '04', label: '進度',    en: 'TRACK',     icon: 'clock' },
        { id: '05', label: '手記',    en: 'NOTES',     icon: 'arrow-right' },
      ],
    },

    captionTemplate: [
      '{title}',
      '',
      '{body}',
      '',
      '——',
      '{tags}',
    ].join('\n'),

    tags: [
      '#3Q貢丸 #台灣在地品牌孵化所',
      '#好物好照 #品牌孵化 #小品牌',
      '#台灣設計 #BrandHatchery',
    ].join('\n'),
  },

  // ===== Threads =====
  threads: {
    handle: '@3q.hatchery',
    displayName: '3Q貢丸 · 孵化所手記',
    bio: '不管你的店多大多小，我們都把你當客人接。\n— 孵化所手記',
    cadence: '週六，1 則手記',

    postFormat: {
      type: '純文字 · 4–8 行',
      maxChars: 500,
      template: '短句 · 換行頻繁 · 不要 hashtag · 結尾「— 孵化所手記」',
      examples: [
        {
          title: '手記 · 01',
          text: '一張像樣的照片，\n是一間店被陌生人\n看見的第一個機會。\n\n— 孵化所手記',
        },
        {
          title: '手記 · 02',
          text: '不是把它變新。\n是把它的好擦亮。\n\n— 孵化所手記',
        },
        {
          title: '手記 · 03',
          text: '東西好，會說話。\n我們只是負責\n替它把音量調對。\n\n— 孵化所手記',
        },
        {
          title: '手記 · 04',
          text: '招牌不是裝飾。\n是邀請函。\n\n— 孵化所手記',
        },
      ],
    },
  },

  // ===== TikTok =====
  tiktok: {
    handle: '@3q.hatchery',
    displayName: '3Q貢丸 · 台灣在地品牌孵化所',
    bio: [
      '從茶葉蛋 → 企業，我們都接得住',
      '每集 60 秒，一個入駐品牌',
      'LINE @121LKSPE',
    ].join('\n'),
    cadence: '每兩週 1 支，固定週六晚上 8 點',

    cover: {
      spec: '1080 × 1920 px · JPG · ≤ 10 MB',
      filename: '3Q-HATCHERY_tiktok_ep{nn}_cover.jpg',
      template: '上 1/3 留標題（避 TikTok UI），下 2/3 純圖',
      note: '左下會被 caption + handle 蓋住，重要視覺放右下或上半',
    },

    captionTemplate: '{title} ｜ #台灣品牌 #小店紀事 #孵化所',

    episodes: [
      { ep: '01', title: '阿婆ㄟ切仔麵店 · 雲林', cover: 'still-bowl-rice.svg', releaseDay: 14 },
      { ep: '02', title: '三代米舖 · 台南',    cover: 'rice-stalk.svg',      releaseDay: 28 },
      { ep: '03', title: '鹿港織坊',          cover: 'raw-linen.svg',       releaseDay: 42 },
      { ep: '04', title: '下一個是你',        cover: 'cupped-palm-light.svg', releaseDay: 56 },
    ],
  },

  checklist: [
    { id: 'ig-profile',  label: 'IG · 設定 Avatar + Bio + Link in bio', detail: '@3q.hatchery', done: false },
    { id: 'ig-pinned',   label: 'IG · 釘選 3 篇貼文 (Welcome · 入駐 · 服務)', detail: 'profile 上的第一排', done: false },
    { id: 'ig-highlight',label: 'IG · 建立 6 個 Highlight 封面',          detail: '是誰 / 入駐 / 好物好照 / 陪你 / 進度 / 手記', done: false },
    { id: 'ig-templates',label: 'IG · 設定 Reels 與 Story 模板',           detail: '套用 SocialSpecs 規範', done: false },
    { id: 'th-profile',  label: 'Threads · 設定 Bio',                     detail: '@3q.hatchery', done: false },
    { id: 'th-first',    label: 'Threads · 發布第一則手記',                detail: '手記 · 01', done: false },
    { id: 'tt-profile',  label: 'TikTok · 設定 Bio + Avatar',              detail: '@3q.hatchery', done: false },
    { id: 'tt-trailer',  label: 'TikTok · 上預告片 (15 sec)',              detail: '正式集數前的暖身', done: false },
    { id: 'link-tree',   label: 'lin.ee 短網址 · 統一所有平台導流',         detail: 'lin.ee/121LKSPE', done: false },
    { id: 'cross-qa',    label: '跨平台 QA · 每個 bio 點過、每個 link 開過', detail: '3 平台 × 5 個 surface', done: false },
  ],
};
