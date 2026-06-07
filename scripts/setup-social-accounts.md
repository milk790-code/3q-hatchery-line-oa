# 社群平台帳號設定說明

設定完成後，`3q-social-publisher` worker 就能自動發文到各平台。

---

## Phase A：Threads（最優先）

### 步驟 1 — 建立 Threads 帳號
1. 用 **個人 Facebook 帳號** 或新 IG 帳號在手機 App 開通 Threads
2. 個人頁定位：「3Q Hatchery 主理人｜品牌孵化實戰」
3. Bio 放 5 個連結：IG、LINE、Linktree、免費品牌健檢、官方信箱

### 步驟 2 — 建立 Facebook Developer App
1. 前往 [developers.facebook.com](https://developers.facebook.com)
2. 建立新 App → 選擇 **Business** 類型
3. 在 App 後台加入產品 **Threads API**
4. 在 App 審核中申請 `threads_basic` 和 `threads_content_publish` 權限
5. 取得**短期 User Token**，再用 Graph API 交換 **長期 token**（有效期 60 天）：
   ```
   GET https://graph.facebook.com/v19.0/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={APP_ID}
     &client_secret={APP_SECRET}
     &fb_exchange_token={SHORT_TOKEN}
   ```
6. 取得 Threads User ID：
   ```
   GET https://graph.threads.net/v1.0/me?access_token={TOKEN}
   ```

### 步驟 3 — 設定 Cloudflare Secrets
```bash
wrangler secret put THREADS_ACCESS_TOKEN --name 3q-social-publisher
wrangler secret put THREADS_USER_ID      --name 3q-social-publisher
wrangler secret put TRIGGER_TOKEN        --name 3q-social-publisher
```

### 驗證
```bash
curl https://3q-social-publisher.<subdomain>.workers.dev/health
# 確認 "threads": true
```

---

## Phase B：Instagram

### 步驟 1 — 帳號設定
1. 在 IG App 將帳號升級為 **Professional Account（Business）**
2. 連結到 Facebook 粉絲專頁（必要）

### 步驟 2 — 取得 API 憑證
1. 在同一個 Facebook Developer App 加入 **Instagram Graph API** 產品
2. 申請 `instagram_basic`、`instagram_content_publish` 權限
3. 取得 IG User ID：
   ```
   GET https://graph.facebook.com/v19.0/me/accounts?access_token={TOKEN}
   ```
4. 再取得 IG Business User ID：
   ```
   GET https://graph.facebook.com/v19.0/{PAGE_ID}?fields=instagram_business_account&access_token={TOKEN}
   ```

### 步驟 3 — 設定 Secrets
```bash
wrangler secret put IG_ACCESS_TOKEN --name 3q-social-publisher
wrangler secret put IG_USER_ID      --name 3q-social-publisher
```

> ⚠️ 圖片必須是**公開 URL**（GitHub Pages CDN 已符合）

---

## Phase C：TikTok（需等待 API 審核）

### 步驟 1 — 申請 TikTok Developer App
1. 前往 [developers.tiktok.com](https://developers.tiktok.com)
2. 建立 App → 申請 **Content Posting API** 產品（需人工審核，約 1–4 週）
3. 審核通過後取得 Client Key / Client Secret

### 步驟 2 — OAuth 授權取得 Token
```
GET https://www.tiktok.com/v2/auth/authorize/
  ?client_key={CLIENT_KEY}
  &scope=user.info.basic,video.publish,video.upload
  &response_type=code
  &redirect_uri={YOUR_REDIRECT_URI}
```

### 步驟 3 — 設定 Secret
```bash
wrangler secret put TIKTOK_ACCESS_TOKEN --name 3q-social-publisher
```

---

## Phase D：Google 商家（Google Business Profile）

### 步驟 1 — 建立商家資料
1. 前往 [business.google.com](https://business.google.com)
2. 新增 3Q Hatchery 商家，完成驗證

### 步驟 2 — 取得 Service Account
1. 前往 [console.cloud.google.com](https://console.cloud.google.com)
2. 建立專案 → 啟用 **Google My Business API** 和 **Business Profile API**
3. IAM → Service Accounts → 建立並下載 JSON 金鑰
4. 在 Google Business Profile Manager 授予此 Service Account 管理員權限

### 步驟 3 — 取得 Location Name
```bash
curl -H "Authorization: Bearer {ACCESS_TOKEN}" \
  "https://mybusiness.googleapis.com/v4/accounts"
# 記下 accountId，再查詢 locations
curl -H "Authorization: Bearer {ACCESS_TOKEN}" \
  "https://mybusiness.googleapis.com/v4/accounts/{ACCOUNT_ID}/locations"
# 格式：accounts/123456/locations/789012
```

### 步驟 4 — 設定 Secrets
```bash
wrangler secret put GOOGLE_SERVICE_ACCOUNT --name 3q-social-publisher
# (貼上完整的 JSON 字串)
wrangler secret put GOOGLE_LOCATION_NAME   --name 3q-social-publisher
# (格式: accounts/xxx/locations/yyy)
```

---

## Dcard（手動操作）

Dcard 目前**無公開發文 API**，無法自動化。建議：
- 每週手動發 1 篇 — 聚焦「品牌孵化」、「創業」版
- 內容從 `content_queue` 撈已發佈的 Threads 貼文再改寫
- Dcard 文章較長（建議 500–800 字），加上完整案例數據

---

## 新增排程貼文

設定好 secrets 後，用 API 加入排程：

```bash
curl -X POST https://3q-hatchery-webhook.<subdomain>.workers.dev/api/content \
  -H "Authorization: Bearer YOUR_TRIGGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "threads",
    "caption_seed": "汽車美容品牌孵化三個月，客單價從 500 到 3000 的三個關鍵轉變",
    "image_url": "https://milk790-code.github.io/3q-hatchery-line-oa/assets/exports/3q-ig-feed-01.png",
    "topic_tag": "品牌孵化",
    "scheduled_at": "2026-06-01T01:00:00Z"
  }'
```

AI 會在發文前根據 `caption_seed` 自動生成完整文案。

---

## 策略提醒（Threads 紅利窗口）

依研究報告建議：
- **發文時段**：週二–四 09:00 / 12:00（已內建在 cron）
- **每日上限**：Threads 3 篇、IG 1 篇（已內建限制）
- **Topic Tag**：每篇 1 個，新號用大主題（品牌行銷）、成長後改細分（品牌孵化）
- **純文字也支援**：不設 `image_url` 即發純文字觀點貼文
- **窗口剩餘**：約 6–9 個月，趕快開始！
