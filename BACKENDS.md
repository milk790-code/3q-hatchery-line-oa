# LINE 後台總覽 (Line Backend Overview)

3Q 品牌矩陣共有兩個 LINE Official Account，各自有獨立後台。

| 帳號 | 後台類型 | 部署平台 | 程式碼位置 |
|---|---|---|---|
| **3Q貢丸** 客服機器人 | Python / FastAPI | Render | [3qgongwan-bot](https://github.com/milk790-code/3qgongwan-bot) → `main.py` |
| **3Q Hatchery** 孵化所 | Cloudflare Worker | Cloudflare Workers | 本倉庫 → `webhook/worker.js` |

## 設定各帳號的 LINE OA 後台

- **3Q貢丸**：見 [3qgongwan-bot/agent-instructions-A.txt](https://github.com/milk790-code/3qgongwan-bot/blob/main/agent-instructions-A.txt)
- **3Q Hatchery**：見本倉庫 `agent-instructions.txt`

## 兩個後台共同原則

```
Response mode        = Bot
Greeting message     = OFF
Auto-response        = OFF
Webhook              = ON
```

## 快速連結

- LINE Official Account Manager: https://manager.line.biz/
- LINE Developers Console: https://developers.line.biz/console/
- Cloudflare Workers Dashboard: https://dash.cloudflare.com/
- Render Dashboard: https://dashboard.render.com/
