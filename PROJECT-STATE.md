# 全雲端資產總覽 · PROJECT-STATE.md

> 最後同步：2026-05-18 · 由 Claude Code 全自動掃描 GitHub × Cloudflare × Gmail × Drive × Canva 整合

---

## 一、系統架構總覽

```
陳學誼品牌矩陣
├── 3Q Hatchery 孵化所（品牌孵化 B2B）
│   ├── LINE OA → Cloudflare Worker (3q-hatchery-webhook v3.1)
│   ├── KV Session (3q-hatchery-session)
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
| 主分支 HEAD | `b7b4f96` (2026-05-18 render: refresh PNGs) |
| Worker 版本 | v3.1 (Flex Message 5步流程 + KV + escape + emoji) |
| 合併 PR 數量 | 4 (sync-backend / flex-flow / emoji-buttons / escape-keyword) |
| GitHub Pages | `https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/` |
| Actions | `deploy.yml` (Worker + Rich Menu) · `render-assets.yml` (PNG 渲染) |

**已渲染 PNGs（26+ 個）：**
- Avatar / Cover / Rich Menu / Welcome Card / Chat BG
- Carousel ×4（01/02/03/04）
- Seasonal Hero ×4（spring/summer/autumn/winter, 1080×878）
- Reaction ×20（10 原版 + 10 新食物/工藝系列, 480×480）

**React UI Kits：**
- `SeasonalHero.jsx` · `Reaction.jsx` · `LineSpecs.js`
- `_seasonal-export.html` · `_reaction-export.html`
- `_exports-index.html`（設計師預覽頁）
- `3Q-LINE-OA-Launch-Kit.html`（1.3MB 單檔離線包）

---

### `milk790-code/3qgongwan-bot`

| 項目 | 狀態 |
|---|---|
| 主分支 HEAD | `aaed578` (2026-05-18 sync hatchery-webhook) |
| Python bot | `main.py` (FastAPI, Render 部署) |
| 部署設定 | `render.yaml` |
| 同步目錄 | `hatchery-webhook/` (已同步至 v3.1) |

---

## 三、Cloudflare Workers

| Worker 名稱 | 對應服務 | 版本 | 最後更新 | 狀態 |
|---|---|---|---|---|
| `3q-hatchery-webhook` | 3Q Hatchery LINE OA | v3.1 | 2026-05-18 07:33 | ✅ LIVE |
| `pop-monster-webhook` | 泡泡怪獸 LINE OA | — | 2026-05-18 05:42 | ✅ LIVE |
| `oh-my-night-crew` | 自動化夜班代理 | v0.3 | 2026-05-18 01:35 | ✅ LIVE |

### `pop-monster-webhook` 功能摘要
- 13 個關鍵字群組（產品問答、教學、通路、客服）
- Claude Haiku 4.5 AI fallback（無關鍵字時自動呼叫）
- 內嵌 PRODUCT_KB（5 款產品規格、價格、品牌語氣）
- **注意：** `milk790-code/pop-monster-line-oa` repo 有 2 筆 deploy failures（2026-05-15）

### `oh-my-night-crew` v0.3 功能摘要
- **觸發：** Cron 每 5 小時 + 每月 1 號 UTC 22:00
- **模型：** Claude Opus 4.7
- **KV 讀取：** `system_prompt` / `content_md` / `safeguards_md` / `task_queue` / `stop_token` / `pending_shift`
- **D1 寫入：** `shifts` table（執行紀錄）+ `heartbeats` table
- **HTTP 端點（需 token）：** `/status` · `/run?force=1` · `/recent` · `/health`

---

## 四、Cloudflare KV Namespaces

| Namespace | ID | 用途 |
|---|---|---|
| `3q-hatchery-session` | `20a68b10afc84764ba770b64f0f33f30` | 用戶對話狀態（2h TTL）|
| `oh-my-night-state` | `63250f93b0a1418396a647fb89ebb6e1` | 代理人系統 prompt + 任務隊列 + 通關密碼 |

---

## 五、Google Drive 相關資產

| 檔案 | 類型 | 說明 |
|---|---|---|
| `3Q Hatchery Design System.zip` (×2) | ZIP 2.1MB | 設計系統打包 |
| `3Q-HATCHERY_welcome_1040x1040.png` (多份) | PNG | Welcome card 備份 |
| `logo-mark-3Q.svg` | SVG | 品牌 Logo 向量 |
| `SocialSpecs.js` (×8) | JS | 社群平台圖片規格 |
| `00_每日四點福袋_主視覺.png` | PNG 88KB | 📦 每日推播主視覺 |
| `01_晨光福袋_07-30.png` | PNG 89KB | 早上 07:30 推播圖 |
| `02_午陽福袋_12-30.png` | PNG 89KB | 下午 12:30 推播圖 |
| `03_暮色福袋_18-30.png` | PNG 93KB | 下午 18:30 推播圖 |
| `04_月光福袋_22-00.png` | PNG 85KB | 晚上 22:00 推播圖 |
| `oh-my-claudecode-main.zip` (×2) | ZIP 10MB | Oh My Claudecode 工具包 |
| `autopilot-loop-v0.2.md` | Doc | oh-my-night-crew 設計文件 |
| `system-prompt.md` / `content.md` / `safeguards.md` | Doc | oh-my-night-crew KV 內容 |
| `汽美短影音爆款衝刺包_v1` | Doc | 米速/汽美短影音策略包 |

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
| `3q-hatchery-line-oa` | ✅ 全綠 | deploy.yml 穩定 |
| `3qgongwan-bot` (Render) | ✅ 歷史已修 | 2026-05-13 版本降版後正常 |
| `pop-monster-line-oa` | ❌ 2 失敗 | 2026-05-15 deploy failures（需調查）|
| `popmonster-vip` | ✅ 成功 | Cloudflare Pages 部署成功 |

---

## 八、已知缺口 & 下一步建議

### 高優先
1. **每日四點福袋推播系統**：Drive 已有 5 張圖（今日上傳），尚未有排程推播到 LINE 的機制。可利用 `oh-my-night-crew` Cron 或另建 Cloudflare Cron Worker。
2. **pop-monster-line-oa deploy 修復**：2 筆 CI 失敗（2026-05-15），Worker 目前靠直接部署維持。
3. **oh-my-night-crew KV 注入**：`system_prompt` / `content_md` / `safeguards_md` 需從 Drive 同步至 KV。

### 中優先
4. **3Q 貢丸 Python bot 健康檢查**：確認 Render 服務正常運行。
5. **SocialSpecs.js 整理**：Drive 有 8 個重複副本，建議統一保留一份。

---

## 九、快速操作參考

```bash
# 3Q Hatchery Worker 健康檢查
curl https://3q-hatchery-webhook.<subdomain>.workers.dev

# oh-my-night-crew 狀態查詢
curl "https://oh-my-night-crew.<subdomain>.workers.dev/status?token=<TOKEN>"

# oh-my-night-crew 手動觸發
curl "https://oh-my-night-crew.<subdomain>.workers.dev/run?force=1&token=<TOKEN>"
```

---

*此文件由 Claude Code 自動掃描所有雲端資源後整合生成。如需更新，重新執行「全雲端同步」工作流。*
