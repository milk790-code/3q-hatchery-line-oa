# 小泡上線 runbook — 把泡泡怪獸 OA 的 webhook 切到 AI 店員

> 現狀:`pop-line-oa` worker(小泡 v4.2.0,B 版揭露)已部署在 staging,**webhook 未切**。
> 切過去那一刻,泡泡怪獸 OA 的真實客人就由小泡接待 → canary 順序第一棒(brands/README.md)。
> ⚠ 歷史教訓:deploy.yml 曾有「webhook 劫持」步驟把 webhook 撈回舊 worker(6/11-12 事故,7389742 已移除)。切完後**任何一次部署都不會再動 webhook**,但驗收時仍要回頭確認一次。

## 切換前(🟢 全部可先做)

1. 🟢 開 `https://pop-line-oa.milk790.workers.dev/health`,確認:
   - `seed: "v4.2.0"`、`ai_employee: "小泡(AI店員 POP-CAR-0001)"`
   - `secret: true`、`token: true`、`owner: true`(任一 false → 先補 Secrets,別切)
2. 🟢 跑本機驗證:`cd workers/pop-line-oa && node test-b-disclosure.mjs`(19 項全綠才繼續)

## 切換(🔴 LINE console,人工)

3. 🔴 開 LINE Developers Console:`https://developers.line.biz/console/`
   - 選 **泡泡怪獸** 的 provider → 該 OA 的 **Messaging API** channel
   - (深層連結需 channel ID,不確定就走選單:Console → Providers → 點品牌 → 點 channel → `Messaging API` 分頁)
4. 🔴 `Webhook URL` 貼上(Verify 應回 Success):

   ```
   https://pop-line-oa.milk790.workers.dev/webhook
   ```

5. 🔴 確認 `Use webhook` = ON;LINE Official Account Manager(`https://manager.line.biz/`)→ 回應設定:自動回應訊息 OFF(避免跟小泡打架)

## 切換後驗收(🟢)

6. 🟢 用自己的 LINE 傳一句話給泡泡怪獸 OA:
   - 第一句回覆**必含揭露**:「嗨,我是泡泡怪獸的 AI 店員小泡…」(只出現一次)
   - 傳「找真人」→ 立即交接話術,且老闆 LINE 收到推播
   - 問「你是真人嗎」→ 誠實確認是 AI(鐵律)
7. 🟢 再開一次 `/health`,看 `dbg.last_oksig` 有新時間戳(代表正式流量簽章驗證通過)
8. 🟢 觀察 24h:降級話術出現頻率(`diag` KV)、第 10 句交接卡片品質 → 都穩了才輪到米速/丹若(canary 順序)

## 回退(出事就切回)

- 🔴 同第 3-4 步,把 Webhook URL 改回原本的舊 bot URL 即可(切換前先把舊 URL 抄下來存這裡:`_____________`)

---

## v6.1 談單腦(2026-10-30)上線補充 — 跑 `scripts/deploy-pop-line-v6.sh` 之後

> v6.1 改了什麼:加好友第一則=價格表圖、問產品附蝦皮產品卡(蝦皮連結改外部瀏覽器開)、問效果附自家一剪到底影片、貼圖限流、鄭經說/心理學談單腦;主回覆走 reply 不花 push 額度(本月 push 只剩約 23 則)、打「價格表」直接回圖、選單「拍照選品」三顆快速鍵、同一則事件不重複回、多張照片一次看完。
> 一鍵腳本已經做掉:gh 登入 → 閘門(資料同步/AI_EMPLOYEE/三套測試)→ push main → 等 Actions → /health 驗 seed → GitHub Pages 驗圖 → 圖文選單 v7 → webhook URL。

### 後台 10-30 已經改好的(不用再動)
- 基本檔案:背景圖黑金 1600×800、帳號名稱「泡泡怪獸 PopMonster 汽車美容」(11-06 前不能再改)、狀態消息「加好友先拿價格表・店家價另外算」
- 加入好友的歡迎訊息:價格表圖 + 介紹文(246 字)——這是 Webhook 開之前的過渡版,第 2 步會關掉
- 營業時間 7 天 24 小時 + 「AI 客服 24 小時回覆;真人 09:00–18:00」、付款 Visa/Mastercard/JCB + 蝦皮結帳說明、線上服務「蝦皮出貨:全台超商取貨/宅配」、網站 popmonster.vip、YouTube 頻道、通話鍵已關(電話沒設,按了是壞鍵)

### 只有 OA 後台能做(🔴 manager.line.biz/account/@150tiznd/setting/response)
1. 🔴 **自動回應訊息 → 關**(不關就是 07-18 那次洗版:罐頭＋AI 各回一則)
2. 🔴 **加入好友的歡迎訊息 → 關**(`manager.line.biz/account/@150tiznd/autoresponse/welcome` 右上角開關;v6.1 的歡迎包由 worker 送:價格表圖→貼圖→介紹;後台再開一份就變兩份)
3. 🔴 **Webhook → 開**(v6 之前關了 49 天;開了 AI 才會接客)
4. 🟡 狀態消息換成「加好友先拿價格表・拍照問用哪支」(page.line.biz 基本檔案 → 帳號;1 小時只能改一次)
5. 🟡 舊圖文選單「Pop Monster · MENU (postback v1)」要不要刪:v7 設成預設後它不會顯示,留著不影響;要刪就 `python3 scripts/pop-richmenu-deploy.py` 看清單再決定

### 驗收(🟢 用自己的手機)
6. 🟢 封鎖再解除封鎖泡泡怪獸(或用另一支手機加好友)→ 第一則必須是**價格表圖**,接著貼圖、介紹(含「AI 人工客服」揭露)、下面有快速按鈕
7. 🟢 傳「價格表」→ 直接回價格表圖 + 一句話(同一天第二次改由 AI 回);傳「拾號怎麼用」→ 只回一則文字 + 一張黑金產品卡(蝦皮主圖、價格、「蝦皮購買」「看施工影片」),蝦皮連結在外部瀏覽器開
8. 🟢 點選單「拍照選品」→ 回拍照說明 + 三顆快速鍵(拍照/從相簿選/用打字描述);一次連傳 3 張照片 → 數一下回幾則:LINE 常把多張拆成多個 webhook,只有同一個 webhook 裡的才會合併成一則(反駁席實測提醒);若回了 3 則、每則都講得通也算過,回 3 則一樣的才是問題
9. 🟢 點「看施工影片」→ 直接收到自家影片(第一次);再點 → 給 YouTube 合集,不重發同一支
10. 🟢 連傳 4 句普通話 → 貼圖最多出現 1 次,抱怨句一定沒貼圖;每句先「已讀 + 輸入中」再回,不會先丟一句墊場文字
11. 🟢 開 `https://pop-line-oa.milk790.workers.dev/health` → `seed: "v6.1.4"`、`reply_first: true`、`ack_text: "off"`、`catalog` ≥ 30、`welcome_pack` = 2、`videos` ≥ 5
12. 🟢 隔天看 push 額度:`curl -sS https://api.line.me/v2/bot/message/quota/consumption -H "Authorization: Bearer <token>"`,totalUsage 從 177 往上只該多老闆通知那幾則

### 回退
- 🔴 LINE Developers Console 把 Webhook URL 改回舊值,或 OA 後台把 Webhook 關掉(AI 立刻停,罐頭自動回應與後台歡迎訊息記得再開)
- 🟡 只退談單腦不退設定:`git revert` v6.1 那個 commit 再 push(worker 會自動重部署成 v5.2)

## v6.1.3（2026-11-02 真機測後修）
- 產品詢問指令多一段【產品事實】：命中 SKU 的用法／賣點／不准說逐字給模型（之前只給名稱＋價格，木瓜被編成「清油漆」）。
- 回覆回讀閘多一層簡中用語替換（信息→資訊 等 17 組）。
- YouTube 合集只在客人明講要影片（影片／教學／示範／怎麼用…）或按「看影片」鍵時才給；自家一剪到底片照舊。
- v6.1.3：產品詢問指令再加「不條列、不編數字、以事實為準蓋過自己前面講過的、不唸編號」；clean() 把 A045／（A039）這類編號拿掉；木瓜禁說補「清油漆」。
- v6.1.3：影片線以命中的產品為準（問酸洗不會再送拋光片），產品線沒自家片只給該線合集。

## v6.1.4（2026-11-03 他語音指定：影片要精緻、回覆要有情緒價值＋專業＋用法＋痛點）
- 模型：平常 Opus 5.5（lite／chat），ESCALATE（殺價、比較、客訴、大單）才用 Fable 5.1，備援 Sonnet 5.5。金鑰換成 Console 專用的 `pop-line-oa-brain-2`（舊 25 把由本人刪）。
- 產品詢問指令固定四件事：接住痛點 → 一句專業原因 → 用法一兩句 → 一句站在他那邊的情緒價值；不油、不喊口號。
- 拋光線影片換成個人 FB 爆款版（開頭 3 秒「為什麼…？」標題卡＋燒好的聯絡三行）：剪接點偵測 0 點才收；天使線主片改 079（前 3 秒就看到效果）、069 第二支。每支前面的文字都重寫成四要素。
- 木瓜輪框那批片檔頭全是抖音標記（品牌方素材），不進 LINE；輪框、洗車等線維持合集備援。
- 轉檔腳本新增 `transcode.watermark=false`（成片已有聯絡三行就不再疊第二個）。

## v6.1.5（2026-11-03 下午，熱修：Opus 5.5 回文變空）
- 根因兩層：① KV `cfg:pop_anthropic` 存著 6 月舊金鑰，`getCfg` KV 優先於環境變數，新金鑰沒被用到（已刪 KV 鍵，備份在本機 `~/.config/line-oa/`）；② Claude 5.5 系列思考永遠開且算進 max_tokens，400～600 的上限被思考吃光→`content` 只剩 thinking 區塊、沒有 text。
- 修法：`brainBody()` 統一組 API body：`max_tokens` 加 3000 思考餘裕、`output_config.effort` 平常 low／裁決（Fable）medium；thinking 參數不送（5.5 不准 disabled）。
- 驗證入口：GitHub Actions「pop-line-oa selftest」手動跑（用 secret SETUP_KEY 打 `/admin/selftest`，再直打 Anthropic 看回傳形狀）。SETUP_KEY 11-03 換新並同步 worker／GitHub／本機 `~/.config/line-oa/pop-line-setup-key`。

## v6.1.6（2026-11-03，他指定「現在只做汽美」）
- 每輪 prompt 原本會塞「跨品牌情緒承接金句」前 3 名，而前 3 名全是 3q 線的創業／行業句子（「開始創業或是新事業…」「您的行業跟目前最卡的點」）→ loadGems 只讀 brand='popmonster'；GENOME `emotion_gems` 非 popmonster 的 6 列已刪（備份 `~/.local/share/line-oa-backup/emotion_gems_non_popmonster_20261103.json`）。
- `/admin/broadcast` 預設稿原本是 3Q 時代「政府補助／開店創業」文＋土地公圖→改成價格表圖＋一句汽美問候。
- 員編 3Q-CAR-0001 → POP-CAR-0001（brands 正本同步）。

## v6.1.7（2026-11-03，續「只做汽美」）
- SEED_GENOME 的「POP CARD 回店系統」段整段換成鐵律：業務只有汽美藥劑／研磨拋光劑／拋光盤的零售與批發；系統／網站／補助／代操／接案一律「這塊我們現在沒做」一句帶過，不丟連結、不說請真人確認。
- 店家三題健檢收尾（SHOP_AUDIT_CLOSE）「客人不回頭」解法改用天使塗層這類耗材做回店理由，不推系統。
- ⏳ 未動：店家老闆選單左上「贏過同行的黑科技」按鈕仍連 POP CARD Demo（oa.json A_left，他的既有設定、要重做選單圖才能換）。
