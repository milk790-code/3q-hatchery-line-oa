# 3Q貢丸 Bot · Render → Cloudflare Workers 遷移設計

> 狀態:**設計提案,尚未動程式碼。** 本文只規劃,等你拍板才實作。
> 目標讀者:之後實作的人(可能是 Claude 或你)。

---

## 1. 為什麼要遷

| 痛點(現在 Render free) | Workers 解法 |
|---|---|
| 閒置 15 分鐘睡眠,首次喚醒 ~30 秒(客人傳訊息卡住沒回 → 掉單) | **零冷啟動**,邊緣常駐,首訊息毫秒級 |
| 需另外掛 cron-job.org 每 10 分鐘 ping 保活(治標) | 不需要 |
| 免費 750 hr/月,單服務勉強 24/7 | 免費 **10 萬次請求/天**,LINE bot 等級綽綽有餘 |
| gongwan 是整個專案裡**唯一**還在 Render 的 LINE 服務 | 其餘(`3q-line-oa`、`pop-line-oa`、`tudigong`…)早就在 Workers,**統一技術棧、統一部署** |

> 這個 repo 的 `workers/` 下已有 11 支 Worker,`workers/3q-line-oa/worker.js` 就是現成範本。遷移風險低、有前例。

---

## 2. 現況 vs 目標

```
現在:  LINE ──webhook──▶ Render(FastAPI / Python / uvicorn)
                            └ bots/gongwan/main.py  關鍵字路由
                            └ hatchery_api.py        → 呼叫 Hatchery worker(引薦/CRM)

目標:  LINE ──webhook──▶ Cloudflare Worker(JS / 邊緣)
                            └ workers/gongwan/worker.js  同一套關鍵字路由
                            └ 直接 fetch Hatchery worker(同網內,更快)
```

`main.py` 的邏輯**幾乎是純函式**(關鍵字比對 + 回字串),沒有重狀態,非常適合搬到 Worker。唯一外部依賴是 `hatchery_api.py` 的幾個 HTTP 呼叫,Worker 用 `fetch` 即可。

---

## 3. 對照表:FastAPI → Worker

| FastAPI / Python | Cloudflare Worker(對照 `3q-line-oa/worker.js`) |
|---|---|
| `@app.post("/line/webhook")` | `if (url.pathname === '/webhook' && request.method === 'POST')` |
| `WebhookHandler.handle(body, sig)` 驗簽 | `verifyLineSignature(body, sig, secret)`(crypto.subtle HMAC-SHA256,worker 已有) |
| `@app.get("/")` 健康檢查 | `if (url.pathname === '/health')` 回 JSON(可順帶回 `secret/token` 是否就緒) |
| `MessagingApi.reply_message(...)` | `fetch('https://api.line.me/v2/bot/message/reply', { method:'POST', ... })`(worker 已有 `lineReply`) |
| `os.environ["LINE_CHANNEL_SECRET"]` | `env.GW_LINE_SECRET`(wrangler secret) |
| `os.environ["LINE_CHANNEL_ACCESS_TOKEN"]` | `env.GW_LINE_TOKEN` |
| `_dedup()` 記憶體 TTL 去重 | LINE 已有 `webhookEventId`;Worker 無常駐記憶體 → 用 KV(`env.SESSION`)存 eventId+TTL,或直接信任 LINE 不重送 |
| `route(text)` 純函式 | **一字不改照搬邏輯**,只是改寫成 JS |
| `hatchery_api.record_inquiry / get_referral_code …` | `fetch(env.HATCHERY_BASE + '/...')` |
| Rich Menu (`setup_richmenu.py`) | 不變,仍是一次性腳本,跟 runtime 無關,可留 Python |

---

## 4. 綁定與機密(wrangler)

```toml
# workers/gongwan/wrangler.toml(草案)
name = "gongwan-line-oa"
main = "worker.js"
compatibility_date = "2024-11-01"

# 引薦/CRM 共用引擎位址(非機密)
[vars]
HATCHERY_BASE = "https://<hatchery-worker>.workers.dev"

# 去重用(可選)
# [[kv_namespaces]]
# binding = "SESSION"
# id = "..."
```

機密用指令設,**不寫進檔案、不進 git**:
```
wrangler secret put GW_LINE_SECRET   # 貼 LINE Channel Secret
wrangler secret put GW_LINE_TOKEN    # 貼 LINE Channel Access Token
```

---

## 5. 分階段上線(全程可逆,zero-downtime)

關鍵原則:**Render 不關、webhook 最後才切**——跟 repo 裡 `3q-line-oa` 註解寫的「先不切 LINE webhook URL,測滿意再切(可逆)」同一套安全做法。

```
階段 0  建 workers/gongwan/worker.js,把 route() 邏輯翻成 JS
        本地 wrangler dev 跑單元測:餵 12 句測試訊息,比對回覆與 Python 版逐字一致

階段 1  wrangler deploy → 拿到 https://gongwan-line-oa.<acct>.workers.dev
        設機密、打 /health 確認 secret/token = true

階段 2  影子驗證:用 LINE 的 webhook test、或自簽一個合法 signature 打 /webhook
        確認 200 + 正確 reply,Render 這時照常服務真實流量(沒有人受影響)

階段 3  切換:LINE Console webhook URL 改成 …workers.dev/webhook → Verify 綠勾
        真人傳一句測,確認 Worker 接手

階段 4  觀察 24–48h。Worker 穩了 → 從 render.yaml 移除 gongwan 服務、停 Render
        ⚠ 回滾:任何時候把 webhook URL 改回 onrender.com 即可,30 秒復原
```

---

## 6. 風險與緩解

| 風險 | 緩解 |
|---|---|
| 翻寫邏輯與 Python 版行為不一致 | 階段 0 用同一組 12 句測試逐字 diff;`route()` 是純函式好驗 |
| 全形/半形 `_normalize` JS 重現差異 | JS 版用同樣 `0xFF01–0xFF5E` 偏移邏輯,寫測試覆蓋全形數字/英文 |
| 去重(_dedup)在無狀態環境失效 → 重複回覆 | 信任 LINE `webhookEventId` 不重送即可;要保險就用 KV 存 eventId TTL 600s |
| 機密外洩 | 一律 `wrangler secret`,絕不進 git;`.dev.vars` 加進 `.gitignore` |
| 切換當下訊息掉 | 階段 3 切換是原子操作(改一個 URL),且可即時回滾 |

---

## 7. 成本對照

| | Render free | Cloudflare Workers free |
|---|---|---|
| 冷啟動 | 15 分鐘睡,~30s 喚醒 | 無 |
| 額度 | 750 hr/月 | 10 萬請求/天 |
| 保活成本 | 需外部 cron ping | 不需要 |
| 永不睡眠 | 升 Starter US$7/月 | 免費就不睡 |

---

## 8. 工作量估計

- 翻寫 `worker.js`(route + normalize + 引薦 fetch):**~半天**(有 `3q-line-oa` 範本可抄骨架)
- 測試 + 機密 + wrangler 設定:**~1–2 小時**
- 切換 + 觀察:**~1 天(多為等待觀察)**

## 9. 待你決定

1. 要不要保留 `_dedup`(用 KV)還是信任 LINE 不重送?(影響要不要綁 KV)
2. 引薦/CRM(`hatchery_api`)目標 worker 的正式網址是哪個?
3. 切換時機:現在 bot 剛上線穩定,要立刻遷,還是先讓 Render 版跑一陣子再遷?

> 給我綠燈 + 上面三題答案,我就開 `workers/gongwan/worker.js` 動手(一樣在分支上做、開 draft PR,不碰生產 webhook)。
