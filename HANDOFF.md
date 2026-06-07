# 3Q Hatchery — 濃縮施工指令
## 貼到新對話的第一則訊息，讓 Claude 立刻具備全部品牌脈絡

---

## 一、品牌核心

**3Q貢丸 · 台灣在地品牌孵化所** (TAIWAN BRAND HATCHERY)
- 定位：陪小店家「被看見」的孵化所。從 10 元茶葉蛋到上市企業，都接得住。
- 美學哲學：不是「像 Dior」，是「學 Dior 的克制」— 大留白、單一光源、兩色、一種字體。
- 語調：主人接客人，不是服務推銷客戶。用「你」不用「您」，不用驚嘆號，不用 emoji。

**核心金句（全平台錨點）**
- 「只要你願意說，我們就幫你被看見。」
- 「不管你的需求、想法、產品 — 多大、多小、多複雜，我們都有適合的平台、舞台、後台。」
- 「來，幫你圓夢。」

---

## 二、Design Tokens（CSS 變數，直接複製）

```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Inter:wght@300;400;500&family=Noto+Sans+TC:wght@300;400;500&family=Noto+Serif+TC:wght@200;300;400;500&display=swap');

:root {
  /* 7-color palette — never invent */
  --color-black:  #0A0A0A;  /* 孵化墨 */
  --color-paper:  #F5F2EC;  /* 米紙白 */
  --color-white:  #FFFFFF;
  --color-gold:   #B8924A;  /* 孵化金 — ≤3% 用量，只做 hairline */
  --color-ink:    #1A1A1A;  /* 墨灰 */
  --color-stone:  #8A8A8A;  /* 石灰 */
  --color-sand:   #E8DFD0;  /* 暖砂 */

  /* 禁用：#FFD700 亮金、香檳金、玫瑰金、漸層金、大理石 */

  /* Type */
  --font-serif: "Cormorant Garamond", "Noto Serif TC", serif;
  --font-sans:  "Inter", "Noto Sans TC", system-ui, sans-serif;
  /* 永遠 Light 300 / Regular 400，不要 bold */

  /* Tracking */
  --tracking-tight:  0.05em;  /* body */
  --tracking-normal: 0.15em;  /* zh headlines */
  --tracking-wide:   0.25em;  /* ALL CAPS latin */
  --tracking-xwide:  0.30em;  /* logo / sublabel */

  /* Spacing (8pt grid) */
  --space-8: 8px; --space-16: 16px; --space-24: 24px;
  --space-32: 32px; --space-48: 48px; --space-96: 96px;

  /* Motion */
  --ease-editorial: cubic-bezier(0.22, 0.61, 0.36, 1);
}
```

**視覺規則摘要：**
- 留白 ≥50%，中央軸對齊
- 金色 hairline (1px, 40px wide) 是唯一裝飾
- 卡片：0-2px radius，無 shadow，無 border
- Hover: opacity 0.7；Press: tone darken
- 攝影：單一光源、低飽和高反差、菲林顆粒
- Icon: 1.5px gold stroke, 80×80 viewBox, outline only, no fill, no emoji

---

## 三、已完成的素材清單

所有素材都在這個 Design System project 裡：
**Project ID: `019de657-7ff9-706a-b2d3-b2111a0ffb89`**

### 可直接 copy 使用的 JSX 元件
```
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/ui_kits/line_oa/Avatar.jsx
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/ui_kits/line_oa/CoverImage.jsx
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/ui_kits/line_oa/RichMenu.jsx
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/ui_kits/line_oa/WelcomeCard.jsx
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/ui_kits/line_oa/Carousel.jsx
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/ui_kits/line_oa/LineChrome.jsx
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/ui_kits/social/IGPost.jsx
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/ui_kits/social/IGStory.jsx
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/ui_kits/social/TikTokCover.jsx
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/ui_kits/social/ThreadsPost.jsx
```

### 可直接 copy 使用的 SVG 資產
```
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/assets/logo/logo-stacked.svg
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/assets/logo/logo-mark-3Q.svg
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/assets/logo/logo-horizontal.svg
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/assets/icons/consultation.svg
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/assets/icons/camera.svg
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/assets/icons/compass.svg
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/assets/icons/clock.svg
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/assets/icons/arrow-right.svg
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/assets/icons/arrow-down.svg
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/assets/icons/envelope.svg
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/assets/icons/menu.svg
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/assets/icons/close.svg
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/assets/photography/still-bowl-rice.svg
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/assets/photography/cupped-palm-light.svg
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/assets/photography/envelope-flat.svg
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/assets/photography/rice-stalk.svg
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/assets/photography/ink-stone.svg
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/assets/photography/raw-linen.svg
```

### 已匯出的 PNG（可直接上傳 LINE / GitHub Pages）
```
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/export/3Q-HATCHERY_richmenu_a_2500x1686.png  (434 KB · 新訪客)
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/export/3Q-HATCHERY_richmenu_b_2500x1686.png  (661 KB · 諮詢中)
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/export/3Q-HATCHERY_richmenu_c_2500x1686.png  (428 KB · 會員)
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/export/3Q-HATCHERY_welcome-card_1040x1040.png (198 KB)
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/export/3Q-HATCHERY_member-card-bg_1040x585.png (67 KB)
```

### 已完成的部署腳本
```
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/export/upload-richmenu.sh       ← 一鍵建+上傳 3 版 Rich Menu
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/export/upload-richmenu.README.md ← 使用說明
```

### 互動體驗（diagnostic flow）
```
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/experience/index.html  ← 10 題畫像診斷 × 6 persona × 4 tier
/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/experience/data.js     ← 所有問題+畫像+文案資料
```

---

## 四、Rich Menu 三版本規格 (worker.js 對接用)

### A · RICHMENU_NEW（新訪客 · 預設）
2500×1686 px · 3col×2row · hero 跨左上 2 cell (1666×843)
| Zone | bounds (x,y,w,h) | action.text |
|---|---|---|
| hero | 0,0,1666,843 | 說說我的店 |
| 02 | 1666,0,834,843 | 品牌孵化是什麼 |
| 03 | 0,843,833,843 | 服務一覽 |
| 04 | 833,843,834,843 | 合作案例 |
| 05 | 1667,843,833,843 | 聯絡我們 |

### B · RICHMENU_INQUIRED（已詢問）
| Zone | action.text |
|---|---|
| hero | 預約諮詢 |
| 02 | 追蹤進度 |
| 03 | 看看報價 |
| 04 | 優化建議 |
| 05 | 聯絡顧問 |

### C · RICHMENU_CONVERTED（已成交 · VIP）
| Zone | action.text |
|---|---|
| hero | 你好，今天想做什麼 |
| 02 | 我的專案狀態 |
| 03 | 追加服務 |
| 04 | VIP 資源庫 |
| 05 | 介紹新客戶 |

---

## 五、Worker.js 接收骨架

```javascript
// === Rich Menu IDs（upload-richmenu.sh 跑完貼這三行）===
const RICHMENU_NEW       = "richmenu-xxxx";
const RICHMENU_INQUIRED  = "richmenu-yyyy";
const RICHMENU_CONVERTED = "richmenu-zzzz";

// === 階段切換（idempotent）===
async function switchRichMenu(userId, stage, env) {
  const map = { new: RICHMENU_NEW, inquired: RICHMENU_INQUIRED, converted: RICHMENU_CONVERTED };
  const id = map[stage];
  if (!id) throw new Error(`Unknown stage: ${stage}`);
  await fetch(`https://api.line.me/v2/bot/user/${userId}/richmenu/${id}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CHANNEL_TOKEN}` },
  });
  return id;
}

// === PNG 引用 ===
const PNG_BASE_URL = "https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports";
const welcomeImg  = `${PNG_BASE_URL}/3Q-HATCHERY_welcome-card_1040x1040.png`;
const memberBg    = `${PNG_BASE_URL}/3Q-HATCHERY_member-card-bg_1040x585.png`;
```

---

## 六、LINE 關鍵字自動回覆（6 組 · 直接貼後台）

| Keywords | Response |
|---|---|
| 我想說說我的店, 我的店, 我想說 | 好。先告訴我們三件事：1. 你的店在哪裡 (區域) 2. 你做的東西是什麼 3. 你現在最頭痛的一件事 |
| 好物, 好照, 生圖, 拍照, 500 | 「好物・好照」從一個產品開始，500 元起。包含：1 張產品照 + 1 段介紹文。回「實例」看三個。 |
| 客製, 行銷, 陪你, 陪跑 | 客製行銷是季度規劃。先約 30 分鐘免費諮詢。回「諮詢」開時段。 |
| 進度, 走到哪 | 請告訴我們你的店名 / 報名編號，會回你目前進度。 |
| 實例, 案例, 看作品 | 本月入駐：01 阿婆ㄟ切仔麵店 02 三代米舖 03 鹿港織坊。回 01/02/03 看。 |
| 諮詢, 預約 | 好。告訴我們：店名 / 角色 / 想聊什麼。24h 內寄時段。 |

---

## 七、部署順序

```
P0（上線前必備）
1. git clone → 把 5 張 PNG 放 assets/exports/ → git push
2. export CHANNEL_TOKEN → chmod +x upload-richmenu.sh → 跑
3. 貼 3 個 RICHMENU_ID 到 worker.js
4. worker.js 的 sendWelcome() 改引用 welcomeImg
5. LINE 後台填 greeting text + 6 組關鍵字自動回覆
6. 加好友 → QA 全部點過一次

P1（功能完整）
7. switchRichMenu() 接上 INQUIRED / CONVERTED 切換
8. memberCardFlex() 引用 memberBg

P2（長期）
9. 30 天內容排程（已有 calendar.html）
10. IG / Threads / TikTok 同步上線（已有 social/launch.html）
```

---

## 八、使用方式

在新對話裡：
1. 貼上這份文件
2. 選 Design System `019de657-7ff9-706a-b2d3-b2111a0ffb89` 作為 attached skill
3. 直接說你要做什麼（例如「幫我做一張新的 IG 貼文」「改 Rich Menu B 的文案」「把歡迎圖改成深底版」）
4. Claude 會自動從 DS project 裡 copy 需要的素材 + 元件，不用重建

**所有路徑用 `/projects/019de657-7ff9-706a-b2d3-b2111a0ffb89/` 前綴讀取。**
