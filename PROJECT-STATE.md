# 全雲端資產總覽 · PROJECT-STATE.md

> 最後同步：2026-05-21 · 由 Claude Code 全自動掃描 GitHub × Cloudflare × Gmail × Drive × Canva 整合

---

## 一、系統架構總覽

```
陳學誼品牌矩陣
├── 3Q Hatchery 孵化所（品牌孵化 B2B）
│   ├── LINE OA → Cloudflare Worker (3q-hatchery-webhook v3.5)
│   ├── KV Session (3q-hatchery-session)
│   ├── D1 CRM (3q-hatchery-crm)
│   └── GitHub Pages (assets/exports/ → 26+ PNGs)
├── 3Q 貢丸（客服機器人）
│   └── LINE OA → Python FastAPI on Render (3qgongwan-bot-1)
├── Pop Monster 泡泡怪獸（車美容 B2C）
│   ├── LINE OA → Cloudflare Worker (pop-monster-webhook)
│   ├── 官網 → Cloudflare Pages (popmonster.vip)
│   └── 蝦皮 5.0 評分
└── Oh My Night Crew（自動化夜班代理）
    ├── Cloudflare Worker (oh-my-night-crew v0.3)
    ├── KV State (oh-my-night-state)
    └── D1 Database (shifts log + heartbeats)
```

---

## 二、GitHub Repos

### `milk790-code/3q-hatchery-line-oa`（本 Repo）

| 項目 | 狀態 |
|---|---|
| 主分支 HEAD | `4f6459ea` (2026-05-21 v3.5 deploy) |
| Worker 版本 | v3.5 (Flex + KV + D1 CRM + Lead Score + Member Card + Booking + Subscriber) |
| GitHub Pages | `https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/` |
| Actions | `deploy.yml` (Worker + Rich Menu + D1 migrations) · `render-assets.yml` (PNG 渲染) |

**v3.5 新增功能（2026-05-21）：**
- A1：Lead scoring（hot🔥/warm⚡/cold🌱）+ Owner Flex 通知含快速回覆按鈕
- A2：Owner postback handler（已聯繫 / 不感興趣 / 成交）→ D1 status 更新
- A3：booking 預約諮詢流程（flow:nxt=book → 等待自由文字 → 寫入 D1）
- B1：Rich Menu 自動切換（follow → RICHMENU_NEW，submit → RICHMENU_INQUIRED，won → RICHMENU_CONVERTED）
- B2：會員卡自動發行（follow 時建立 KV member 記錄，tier: visitor/inquired/partner）
- B3：訂閱名單（訂閱/取消訂閱 文字觸發）+ 季節推播 cron（每季 1 號 09:00 TW）

**已渲染 PNGs（26+ 個）：**
- Avatar / Cover / Rich Menu / Welcome Card / Chat BG
- Carousel ×4（01/02/03/04）
- Seasonal Hero ×4（spring/summer/autumn/winter, 1080×878）
- Reaction ×20（10 原版 + 10 新食物/工藝系列, 480×480）
- Fukubukuro ×5（00_main + 01_0730 + 02_1230 + 03_1830 + 04_2200）

---

### `milk790-code/3qgongwan-bot`

| 項目 | 狀態 |
|---|---|
| Python bot | `main.py` (FastAPI, Render 部署) |
| 部署設定 | `render.yaml` |
| 同步目錄 | `hatchery-webhook/` (已同步至 v3.5，2026-05-21) |

---

## 三、Cloudflare Workers

| Worker 名稱 | 對應服務 | 版本 | 最後更新 | 狀態 |
|---|---|---|---|---|
| `3q-hatchery-webhook` | 3Q Hatchery LINE OA | v3.5 | 2026-05-21 | ✅ LIVE |
| `pop-monster-webhook` | 泡泡怪獸 LINE OA | — | 2026-05-18 05:42 | ✅ LIVE |
| `oh-my-night-crew` | 自動化夜班代理 | v0.3 | 2026-05-18 01:35 | ✅ LIVE |

### `3q-hatchery-webhook` v3.5 功能摘要
- **LINE Webhook：** Flex Message 5步詢問流程 + postback state machine
- **KV：** 對話 session（2h TTL）+ 會員卡（member:{uid}）+ 訂閱名單（subscribers:list）
- **D1：** inquiries table（含 lead_score/status/booking 欄位）
- **AI：** Workers AI Llama-3 fallback（無關鍵字時）
- **Cron：** follow-up 每 5 分鐘 · 週報每週一 · 季節推播每季 1 號

---

## 四、Cloudflare KV + D1

| 資源 | ID | 綁定 Worker | 用途 |
|---|---|---|---|
| KV `3q-hatchery-session` | `20a68b10afc84764ba770b64f0f33f30` | 3q-hatchery-webhook | 用戶對話狀態（2h TTL）+ 會員卡 + 訂閱名單 |
| D1 `3q-hatchery-crm` | `e54671b1-d15e-4552-babf-cef367267568` | 3q-hatchery-webhook | 詢問持久化 CRM（inquiries table）|
| KV `oh-my-night-state` | `63250f93b0a1418396a647fb89ebb6e1` | oh-my-night-crew | 代理人系統 prompt + 任務隊列 |

---

## 五、Google Drive 相關資產

| 檔案 | 類型 | 說明 |
|---|---|---|
| `3Q Hatchery Design System.zip` (×2) | ZIP 2.1MB | 設計系統打包 |
| `3Q-HATCHERY_welcome_1040x1040.png` (多份) | PNG | Welcome card 備份 |
| `logo-mark-3Q.svg` | SVG | 品牌 Logo 向量 |
| `SocialSpecs.js` (×8) | JS | 社群平台圖片規格 |
| `00_每日四點福袋_主視覺.png` | PNG 88KB | 每日推播主視覺 |
| `01_晨光福袋_07-30.png` | PNG 89KB | 早上 07:30 推播圖 |
| `02_午陽福袋_12-30.png` | PNG 89KB | 下午 12:30 推播圖 |
| `03_暮色福袋_18-30.png` | PNG 93KB | 下午 18:30 推播圖 |
| `04_月光福袋_22-00.png` | PNG 85KB | 晚上 22:00 推播圖 |

---

## 六、Canva 設計

| 設計名稱 | 頁數 | 說明 |
|---|---|---|
| `3Q 孵化所 · LINE OA 上線文件` | 1 | LINE OA 上線前檢查清單 |
| `3Q · Welcome Card · 1040×1040` | 1 | Welcome Card 設計稿 |

---

## 七、Gmail CI 通知狀態

| Repo | 最近狀態 | 說明 |
|---|---|---|
| `3q-hatchery-line-oa` | ✅ 全綠 | deploy.yml v3.5 穩定 |
| `3qgongwan-bot` (Render) | ✅ 正常 | Python FastAPI 運行中 |
| `pop-monster-line-oa` | ❌ 2 失敗 | 2026-05-15 deploy failures（需調查）|
| `popmonster-vip` | ✅ 成功 | Cloudflare Pages 部署成功 |

---

## 八、快速操作參考

### 高優先
1. **RICHMENU_* 環境變數設定**：v3.5 新增 Rich Menu 自動切換，需在 Cloudflare Worker 設定 `RICHMENU_NEW`、`RICHMENU_INQUIRED`、`RICHMENU_CONVERTED` 三個環境變數（Rich Menu ID）。
2. **pop-monster-line-oa deploy 修復**：2 筆 CI 失敗（2026-05-15）。

### 中優先
3. **Stream A 真實照片替換**：`assets/photography/` 仍為 SVG 插畫，待 Unsplash 照片替換。
4. **週報 KV 注入**：`weekly_report_md` 需定期更新至 KV。

---

## 九、快速操作參考

```bash
# 3Q Hatchery Worker 健康檢查
curl https://3q-hatchery-webhook.<subdomain>.workers.dev

# 查詢 D1 CRM 最新詢問
wrangler d1 execute 3q-hatchery-crm --remote --command 'SELECT * FROM inquiries ORDER BY id DESC LIMIT 5'

# oh-my-night-crew 狀態查詢
curl "https://oh-my-night-crew.<subdomain>.workers.dev/status?token=<TOKEN>"
```

---

*此文件由 Claude Code 自動掃描所有雲端資源後整合生成。如需更新，重新執行「全雲端同步」工作流。*
