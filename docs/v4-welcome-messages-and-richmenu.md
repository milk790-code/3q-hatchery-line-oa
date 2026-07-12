# v4 — 三品牌歡迎訊息 + Rich Menu 上傳（你親手做的部分）

> 這兩件事要在 LINE 官方後台手動做，程式改不了，所以留給你。照著點就好。

---

## 一、加入好友歡迎訊息（manager.line.biz）

每個品牌各貼一則，**不加貼圖**。

**畫面**：manager.line.biz → 選該品牌帳號 → 左側「主頁」→「加入好友的歡迎訊息」→ 貼上 → 儲存。

### 泡泡怪獸
```
嗨,我是泡泡怪獸的 AI 顧問,跟你遇過的機器人不太一樣,聊幾句你就知道。先問個簡單的:你是店家要進貨,還是自己的車要用?
```

### 3Q
```
嗨,我是 3Q 的 AI 顧問。你說的我會邊聊邊記,聊完直接給你一份專屬建議。先問一句:你現在最想解決的是接案、品牌,還是流量?
```

### 呆丸土地公
```
嗨,我是呆丸土地公的 AI 顧問。先問一句:你是手上有個地點想評估,還是想找適合的地點?
```

> 註：泡泡怪獸的 LINE bot 本身在「第一次對話」時也會自動亮 AI 身分開場（程式內建），這則官方歡迎訊息是加好友當下的第一印象，兩者不衝突。

---

## 二、Rich Menu v4 上傳（泡泡怪獸示範版）

圖已幫你渲染好：`assets/pop/richmenu-v4.png`（2500×843，黑金三格：①我的車該用什麼 ②施工實錄 ③找真人）。
3Q / 呆丸土地公要用的話，換色與文案後同樣流程即可。

**需要**：泡泡怪獸的 LINE Channel Access Token（記為 `TOKEN`）。

三步（在終端機貼，把 `TOKEN` 換成真的 token；第 1 步會回一個 `richMenuId`，填進第 2、3 步）：

```bash
# 1) 建立 Rich Menu（三格：訊息型「我的車該用什麼」/ 官網連結 / 訊息型「我想找真人」）
curl -X POST https://api.line.me/v2/bot/richmenu \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"size":{"width":2500,"height":843},"selected":true,"name":"pop-v4","chatBarText":"點我開聊","areas":[{"bounds":{"x":0,"y":0,"width":1000,"height":843},"action":{"type":"message","text":"我的車該用什麼"}},{"bounds":{"x":1000,"y":0,"width":750,"height":843},"action":{"type":"uri","uri":"https://popmonster.vip"}},{"bounds":{"x":1750,"y":0,"width":750,"height":843},"action":{"type":"message","text":"我想找真人"}}]}'

# 2) 上傳圖片（richMenuId 換成上一步回傳的）
curl -X POST https://api-data.line.me/v2/bot/richmenu/{richMenuId}/content \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: image/png" \
  --data-binary @assets/pop/richmenu-v4.png

# 3) 設為所有人的預設選單
curl -X POST https://api.line.me/v2/bot/user/all/richmenu/{richMenuId} \
  -H "Authorization: Bearer TOKEN"
```

**搭配效果**：客人點「我的車該用什麼」→ bot 自然走探需求流程；點「我想找真人」→ bot 已寫好三步引導，連這條路都會先把需求收完再交接。中間那格直接進官網 popmonster.vip。

> 我沒有你的 LINE token，也不該把 token 貼進網頁或代你按這種對外送出的鍵，所以這步留你做。要我改成 GitHub Actions 一鍵上傳（token 放 repo secret）也可以，跟我說即可。
