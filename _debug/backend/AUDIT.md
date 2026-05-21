## LINE OA Backend Audit (run 26229265826)

**Manager URL:** https://manager.line.biz/account/@121lkspe

### 1. Bot info
- Display name: 3Q貢丸 · 台灣在地品牌孵化所
- Basic ID: @121lkspe
- Picture URL: https://profile.line-scdn.net/0hZkuJCWYGBURIMxkm1pV6E3R2Cyk_HQMMMAcYJ25kD3FkVBVHdVwfKzoxC3ZiARJBIFwadm07WnVm
- Chat mode: bot
- Mark-as-read: auto

### 2. Webhook
- Endpoint: https://3q-hatchery-webhook.milk790.workers.dev
- Active: true

### 3. Rich menus
- 3Q Hatchery · MENU (postback v4) (id: richmenu-18a529c4eb32891d4e5447f9faaf9e7b, 5 areas)
- 3Q Hatchery · MENU (postback v3) (id: richmenu-d6882f0e160fccb9e14aa216f659cb8d, 5 areas)
- Default: richmenu-18a529c4eb32891d4e5447f9faaf9e7b

### 4. Followers
- Followers (yesterday): 2
- Targeted reaches: 2
- Blocks: 0

### 5. Message quota
- Plan type: limited
- Monthly limit: 3000
- Used this month: 9


---

## 手動上傳清單（LINE Manager 上做）

開啟 [LINE Manager](https://manager.line.biz/account/@121lkspe) →

### 1. 大頭貼 (Avatar)
- 設定 → 帳號設定 → 大頭貼
- 上傳：[https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-avatar-640.png](https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-avatar-640.png)

### 2. 封面圖 (Cover)
- 設定 → 帳號設定 → 封面照片
- 上傳：[https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-cover-bowl-1080x878.png](https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-cover-bowl-1080x878.png)

### 3. 帳號狀態消息（可選）
- 設定 → 帳號設定 → 狀態消息
- 文字：「只要你願意說，我們就幫你被看見。」

### 4. 自動回應功能（要關掉）
- 設定 → 回應功能 → **關閉「自動回應訊息」**（讓 Webhook 接管）
- 確認「Webhook」勾選 ON

### 5. 加入好友的歡迎訊息（可選 — Webhook 已處理）
- 已由 Worker 接管，無需設定

---

## API 已完成項目 ✓

- Webhook URL：set
- Rich Menu：設定 + 預設
- Auto-reply keywords：30+ 個透過 Worker
- Campaign flow：Flex Message + KV
- Lucky bag：每日 4 次 cron 推播
- D1 CRM：諮詢資料永久保存
- OWNER_USER_ID：報名推播到你
