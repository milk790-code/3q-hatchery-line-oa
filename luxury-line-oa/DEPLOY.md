# luxury-line-oa 部署手冊

## 0. 前置確認清單
- [ ] LINE OA 帳號已建立（@xxx 格式）
- [ ] LINE Developers Console → Messaging API 已啟用
- [ ] `richmenu_luxury.png`（墨黑＋香檳金）已放入 GitHub assets/luxury/ 路徑
- [ ] `wrangler.toml` 中 KV namespace ID 已填入

---

## 1. KV Namespace（已自動填入）

`cdg-kv`（`d986024268764cfb9c68f0e886731367`）已寫入 `wrangler.toml`，直接共用，不需另建。

---

## 2. 設定 Secrets（三個必填）

```bash
cd luxury-line-oa

# LINE Channel Secret（LINE Developers → Messaging API → Channel secret）
wrangler secret put LINE_CHANNEL_SECRET

# LINE Channel Access Token（LINE Developers → Messaging API → Channel access token (long-lived)）
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN

# Admin Key（自訂一個隨機字串，用於 /admin/* 端點）
wrangler secret put ADMIN_KEY
```

---

## 3. 部署 Worker

```bash
wrangler deploy
```

部署成功後取得 Worker URL：
`https://luxury-line-oa.milk790.workers.dev`

---

## 4. 設定 LINE Webhook

1. 開啟 LINE Developers Console
2. 選擇你的 LINE OA Channel
3. Messaging API → Webhook settings
4. Webhook URL 填入：`https://luxury-line-oa.milk790.workers.dev/`
5. 點「Verify」→ 應該看到 OK
6. 確認「Use webhook」已開啟

---

## 5. 把 luxury brand_id 在 D1 設為 active

**確認 LINE 已正確 Webhook 後，再執行這步：**

```sql
-- ✅ line_id 已預填（@186vktox），只需確認 Webhook 正常後執行這條：
UPDATE brands
SET
  status     = 'active',
  updated_at = datetime('now')
WHERE brand_id = 'luxury';
```

---

## 6. 部署 Rich Menu（設完 active 後觸發一次）

```bash
curl -X POST https://luxury-line-oa.milk790.workers.dev/admin/deploy-richmenu \
  -H "X-Admin-Key: 你的ADMIN_KEY"
```

成功回應：`{"ok":true,"richMenuId":"richmenu-xxxxxx"}`

---

## 7. 驗收測試

| 測試步驟 | 預期結果 |
|---|---|
| 加入好友 | 收到歡迎訊息（無 emoji、無驚嘆號） |
| 點「品項代尋」| 即時快回（不走 AI） |
| 點「真偽鑑賞」| 即時快回 |
| 傳自由文字「Chanel CF 的真偽重點」| AI 回應（cdg-core 路由） |
| 點「轉真人」| 即時快回轉接訊息 |
| GET `/health` | `{"ok":true,"brand":"luxury"}` |

---

## 8. Rich Menu 圖片路徑確認

圖片需放在：
```
https://raw.githubusercontent.com/milk790-code/3q-hatchery-line-oa/main/assets/luxury/richmenu_luxury.png
```

若存放位置不同，修改 `src/index.js` 第 17 行 `RICHMENU_IMG` 常數。

---

## 環境變數總覽

| 變數名 | 來源 | 必填 |
|---|---|---|
| `LINE_CHANNEL_SECRET` | LINE Developers Console | ✅ |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers Console | ✅ |
| `ADMIN_KEY` | 自訂隨機字串 | ✅ |
| KV binding `KV` | Cloudflare KV namespace | ✅ |
