# weather-touch — 條件觸發關懷

不是每日群發。只在**客人所在城市**出現雷雨 / 降雨機率 ≥70% / 極端高溫 ≥35°C 時,才主動關懷一則,並內建「你之前說你在○○,我有記下來」的筆記證明感,把 AI 的「記得你」變成看得見的行動。

## 資料從哪來
`customer_profiles`(pop-line-oa v5.2 的「筆記超能力」落庫,含 `city`、`care_last_sent_at`)。
→ **必須先部署 pop-line-oa v5.2 並累積幾天對話,城市欄位有資料後,本 worker 才有對象可關懷。**

## 綁定與 Secrets
- D1 `DB` → `pop-line-crm`(id `e54671b1-…`,與 pop-line-oa 同一顆)
- `CWA_API_KEY` — 中央氣象署開放資料授權碼(opendata.cwa.gov.tw 註冊 → 會員中心取得)
- `LINE_CHANNEL_TOKEN_POPMONSTER` — 泡泡怪獸 LINE OA 的 Channel Access Token
- `RUN_KEY` — 保護 `/run` 手動觸發端點的隨機字串

## 上線順序(自動化永遠放在驗證之後)
1. 部署 pop-line-oa v5.2 → 累積幾天,`/health` 看 `with_city` > 0。
2. 申請 CWA 授權碼,設好三個 secret。
3. 手動部署本 worker:GitHub → Actions → **Deploy weather-touch** → Run(workflow_dispatch)。
4. 手動打 `https://weather-touch.<subdomain>.workers.dev/run?key=<RUN_KEY>` 連跑幾天,人工看話術命中率與觸發率。
5. 確認有效 → 在 `wrangler.jsonc` 取消 `triggers.crons` 註解(每日 06:30 台灣一次),或在部署 metadata 加 cron,重新部署。

## 安全
- 一人 **5 天冷卻**(`care_last_sent_at`)。
- push 吃 LINE 月配額(reply 不吃);冷卻 + 條件觸發已把量壓到最低。
- cron 預設**關閉**,不驗證不自動發。

## 之後擴充跨品牌
目前只有 popmonster 有城市筆記。等 3q-line-oa / tudigong 也接上同款筆記超能力後,
在本 worker 加對應的 `LINE_CHANNEL_TOKEN_3Q` / `LINE_CHANNEL_TOKEN_TUDIGONG` secret 即可(`tokenFor()` 已按 brand 自動選 token)。
