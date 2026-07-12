# v4 修改包 — 對帳報告 + 部署指南（2026-07-12）

> 一句話：你丟的 v4 修改包，**大半功能線上早就有了**（而且做得更好），我只把「真正還缺的」幾樣接上去，全部放在分支 `feat/v4-pop-migration-weather-touch`，**沒有動到線上**，等你點頭再上。

---

## 一、關鍵發現：v4 包打錯目標（不是你的錯）

v4 修改包想改的是 `cdg-core` 和 `pop-sales-ai` 這兩支舊架構，而且包裡第 C 段自己說「LINE 前端 worker 還沒定位到，下個 session 再找」。

**但我找到了。** 現在真正在跟客人對話的是 `pop-line-oa`（泡泡怪獸）、`3q-line-oa`（3Q）、`tudigong`（土地公）這三支 **v5.1** worker，早就把 v4 包想做的事做完，而且更成熟：

| v4 包想做的 | 線上 v5.1 現況 |
|---|---|
| 擬真延遲、不秒回 | ✅ 已有 `DelayReplyDO`：情緒→秒數映射、已讀延遲、深夜守夜、載入動畫，**比 v4 版強** |
| 一次只回一則、不三連發 | ✅ 已是「單則 reply、貼圖同一則不加成本」 |
| 貼圖政策（抱怨/售後不發） | ✅ 已有 `STICKER_BLOCK_EMO=['抱怨','售後']` + 每 2~3 則帶一次 |
| 超級 AI 身分腳本 | ✅ 已有揭露腳本（我再補強了一句「複述重點+能力壓過質疑」） |
| 早中晚 cron 群發要滅口 | ✅ **根本沒有這種 cron**：群發是手動端點且要 `&go=1` 二次確認，不用滅 |

所以我沒有照 v4 包「整段替換 DNA」——那會把更好的 v5.1 人設**降級**。我改成：把 v4 包裡「線上真的還缺」的幾樣，接到 v5.1 這個更好的底座上。

---

## 二、我實際做了什麼（都在分支上，未上線）

**改 `workers/pop-line-oa/worker.js`（泡泡怪獸大腦，v5.1 → v5.2）**
1. **出口守門**（v4 A1）：`clean()` 加了刪節號 `...`／`…`、雙破折號、「首先/總之」開頭詞的清除——根治 AI 腔洩底。
2. **蝦皮全撤 → popmonster.vip**：下單卡、產品彈藥庫、七幕劇本、退換貨話術、報價基準、成交授權……所有面向客人的蝦皮字樣全換成官網 + LINE。（3Q、土地公本來就沒有蝦皮字樣，不用動。）
3. **筆記超能力**（v4 A3，這是線上原本缺的）：模型每輪輸出 `[STATE]{城市/車型/行業/預算/grade…}` → 落進 D1 `customer_profiles` 表 → A 級意向客戶即時推播老闆。這個 hook 其實 v5.1 已經預留（`clean()` 早就會把 `[STATE]` 藏起來），我只是把後端補完。**純新增、全 try 包住，壞了也不影響回覆**。

**改 `workers/pop-sales-ai/worker.js`（/shop 轉跳 + 著陸頁）**
- `/shop` 轉跳目標：蝦皮 → `popmonster.vip`（路徑不斷鏈）。
- 系統提示詞、著陸頁、合規紅線段全部蝦皮 → 官網。洩底刪節號 `'…'` 改句號。

**改 `brands/popmonster.json`**：退換貨話術同步（不改的話 CI 同步閘門會擋部署）。

**新增 `workers/weather-touch/`（v4 D，全新條件觸發關懷）**
- 只在客人城市出現雷雨／豪雨／極端高溫時,才發一則帶「我有記下來」證明感的關懷，一人 5 天冷卻。
- 讀上面筆記超能力落庫的 `customer_profiles.city`。
- **cron 預設關閉**，只能手動 `/run?key=` 驗證；部署 workflow 是 `workflow_dispatch` 手動觸發，不會自己跑。

**新增 `assets/pop/richmenu-v4.png`**：Rich Menu v4 已渲染好（2500×843）。

**驗證**：三支 worker `node --check` 全過；CI 同步閘門 `check-sync.mjs` 三組全同步；面向客人的蝦皮字樣歸零。

---

## 三、為什麼我沒直接上線（兩個硬理由）

1. **蝦皮全撤是「經營決策」不是「技術改動」**。線上 v5.1 是**刻意**把 B2C 導蝦皮的（程式註解寫明「合規:平台內完成交易，不誘導場外交易」）。蝦皮平台規則本身**禁止誘導場外交易**——如果泡泡怪獸的蝦皮店還在營業，從 LINE 把客人導去官網有可能踩蝦皮的線、影響蝦皮店。你這份 v4 包說要撤蝦皮（提到「平台調整期間」），我照做了，但**上線前你要確認蝦皮店現在的真實狀態**（已收/停用/還在跑），這關係到這樣改對不對。
2. **這是活的客戶對話 bot**，本地測不到真人對話。你的記憶庫也白紙黑字要求「未先確認正式來源與部署目標時不可覆蓋部署」「獨立 staging 驗證後再提交部署審核」。所以我做到「可審核、可一鍵上」就停。

---

## 四、上線步驟（你決定後，任一種）

改的檔案 `push` 到 main 會自動觸發 GitHub Actions 部署（`deploy-pop-line-oa.yml` 只要 `workers/pop-line-oa/worker.js` 或 `brands/popmonster.json` 有變就跑）。

**做法 A（你自己上）**：
```
cd /Users/mac/Documents/GitHub/3q-hatchery-line-oa
git checkout main && git pull            # 先同步（目前 main 落後 origin 4 個 commit，都是 growth-loop 無關的）
git merge feat/v4-pop-migration-weather-touch
git push                                 # ← 這一 push 會自動部署 pop-line-oa v5.2 + pop-sales-ai
```
**做法 B**：直接跟我說「上」，我幫你 merge + push（我的記憶授權自動部署自有 repo；我只是因為上述兩個理由先停下等你一句話）。

**上線後驗活證據**：
```
curl https://pop-line-oa.<subdomain>.workers.dev/health   # 應看到 seed:"v5.2.0"
curl "https://pop-line-oa.<subdomain>.workers.dev/admin/selftest?key=<SETUP_KEY>&q=鍍膜劑哪罐好用"  # 看回覆與情緒/筆記
```

---

## 五、🚩 只有你能做的（紅線 / 非本人不可）

1. **確認蝦皮店狀態** → 決定蝦皮全撤要不要真的上（見上面第三點第 1 條）。
2. **正式部署** pop-line-oa v5.2 + pop-sales-ai（做法 A 的 `git push`，或叫我上）。
3. **三品牌歡迎訊息**貼上 manager.line.biz（見 `v4-welcome-messages-and-richmenu.md`）。
4. **Rich Menu 上傳**（需 LINE token，見同上文件）。
5. **weather-touch 啟用**（要等 pop-line-oa v5.2 累積幾天城市筆記後）：
   - 申請 CWA 授權碼（opendata.cwa.gov.tw），設 secret `CWA_API_KEY`。
   - GitHub Actions → Deploy weather-touch → Run。
   - 手動 `/run?key=` 驗證幾天話術 → 滿意再開 cron。

> 已確認：`pop-sales-ai` 由 `deploy-sales-ai.yml` 在 `workers/pop-sales-ai/worker.js` 一有變動就自動部署。所以做法 A 的那個 `git push` 會同時觸發 pop-line-oa 與 pop-sales-ai 兩支的部署，一次到位。
