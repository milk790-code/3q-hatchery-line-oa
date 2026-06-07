# Upload Rich Menu — 使用說明

## 一鍵跑

```bash
cd assets/exports/
export CHANNEL_TOKEN="你的_long_lived_channel_access_token"
chmod +x upload-richmenu.sh
./upload-richmenu.sh
```

跑完會印出三個 ID：

```
const RICHMENU_NEW       = 'richmenu-xxxxxxxxxxxxxxxxxxxxxxxxxx';
const RICHMENU_INQUIRED  = 'richmenu-yyyyyyyyyyyyyyyyyyyyyyyyyy';
const RICHMENU_CONVERTED = 'richmenu-zzzzzzzzzzzzzzzzzzzzzzzzzz';
```

把這三行貼到 `worker.js` 取代舊的 ID 常整。

## 它做了什麼

1. POST `/v2/bot/richmenu` × 3 → 建 3 個 schema（tap zones 已經寫好）
2. POST `/v2/bot/richmenu/{id}/content` × 3 → 上傳對應 PNG
3. POST `/v2/bot/user/all/richmenu/{ID_A}` → A 版設為新好友預設

## 取得 Channel Access Token

LINE Developers Console → Provider → Messaging API → Basic settings → **Channel access token (long-lived)** → Issue。

複製整段（很長），貼到 `export CHANNEL_TOKEN="..."`。

## 切換不同版本（在 worker.js 裡）

```js
// 用戶從 NEW → INQUIRED
await fetch(`https://api.line.me/v2/bot/user/${userId}/richmenu/${RICHMENU_INQUIRED}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${CHANNEL_TOKEN}` }
});

// 用戶從 INQUIRED → CONVERTED (成交)
await fetch(`https://api.line.me/v2/bot/user/${userId}/richmenu/${RICHMENU_CONVERTED}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${CHANNEL_TOKEN}` }
});
```

## 重跑

每次跑會建新的 schema（舊的不會自動刪）。免費帳號上限 1000 個 richmenu，但建議定期清理：

```bash
# 列出所有現有 richmenu
curl -s -H "Authorization: Bearer $CHANNEL_TOKEN" \
  https://api.line.me/v2/bot/richmenu/list | jq

# 刪除某個（用上面拿到的 richMenuId）
curl -X DELETE -H "Authorization: Bearer $CHANNEL_TOKEN" \
  https://api.line.me/v2/bot/richmenu/{RICHMENU_ID}
```

## Tap Zone 對應的關鍵字

| Rich Menu | 按鈕 | 觸發訊息 |
|---|---|---|
| A · NEW | 主 hero | 說說我的店 |
| A | 02 | 品牌孵化是什麼 |
| A | 03 | 服務一覽 |
| A | 04 | 合作案例 |
| A | 05 | 聯絡我們 |
| B · INQUIRED | hero | 預約諮詢 |
| B | 02 | 追蹤進度 |
| B | 03 | 看看報價 |
| B | 04 | 優化建議 |
| B | 05 | 聯絡顧問 |
| C · CONVERTED | hero | 你好，今天想做什麼 |
| C | 02 | 我的專案狀態 |
| C | 03 | 追加服務 |
| C | 04 | VIP 資源庫 |
| C | 05 | 介紹新客戶 |

這 15 個關鍵字必須跟 worker.js 裡的 `handleMessage` switch 對到。
