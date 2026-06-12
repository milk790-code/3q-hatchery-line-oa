# 小泡上線 runbook — 把泡泡怪獸 OA 的 webhook 切到 AI 店員

> 現狀:`pop-line-oa` worker(小泡 v4.2.0,B 版揭露)已部署在 staging,**webhook 未切**。
> 切過去那一刻,泡泡怪獸 OA 的真實客人就由小泡接待 → canary 順序第一棒(brands/README.md)。
> ⚠ 歷史教訓:deploy.yml 曾有「webhook 劫持」步驟把 webhook 撈回舊 worker(6/11-12 事故,7389742 已移除)。切完後**任何一次部署都不會再動 webhook**,但驗收時仍要回頭確認一次。

## 切換前(🟢 全部可先做)

1. 🟢 開 `https://pop-line-oa.milk790.workers.dev/health`,確認:
   - `seed: "v4.2.0"`、`ai_employee: "小泡(AI店員 3Q-CAR-0001)"`
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
