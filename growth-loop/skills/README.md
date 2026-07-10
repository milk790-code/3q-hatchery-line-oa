# Growth Loop Skill Layer

這個目錄是 3Q Growth Loop 的「技能路由與採納紀錄」，不是把所有開源技能整包塞進上下文。原則是：先用既有業務技能理解問題，再用小而可驗證的開源流程技能推進，最後由既有 fixture、owner gate 與 red-line verifier 收口。

## 最適合的流程位置

```text
brainstorming
   ↓ 需求已收斂、需要動手做
writing-plans
   ↓ 需要隔離分支/工作區
using-git-worktrees
   ↓ 實作新行為或修 bug
test-driven-development
   ↓ 測試失敗或行為異常
systematic-debugging
   ↓ 完成本地變更，準備宣告狀態
verification-before-completion
   ↓ 有新鮮、完整的驗證證據
requesting-code-review
   ↓ 收到 reviewer 意見時
receiving-code-review
   ↓ 每項意見已核對、逐項修正並重新驗證
finishing-a-development-branch
   ↓
owner gate → Draft PR → merge/deploy（仍需人工批准）
```

`skill-scanner` 不在一般任務鏈中，它是「外部技能進口閘門」：每次從 GitHub、技能 registry 或別人的 plugin 引入新技能，先做來源/授權/腳本/提示注入檢查，再決定是否安裝。它不能取代人工審查，也不能把掃描乾淨解讀成安全保證。

`verification-before-completion` 是跨階段的完成證據閘門，不只用在程式碼：任何「已完成／已修好／可交付」宣告前，都要重跑能直接證明該宣告的完整檢查。`receiving-code-review` 只在真的收到 Review 意見時啟動，先核對意見與現場，再逐項測試修改；它不把外部評論當命令。

## 與現有技能的分工

現有的 `brainstorming` 保留，因為它承載你的繁體中文商業脈絡、十切面發散與三方向收斂；新加入的 `writing-plans` 只在方向拍板後，把結果轉成檔案級實作計畫。`gogogogo` / `autopilot-mission` 放在計畫之後使用，負責把可逆的本地工作推到下一個人審 gate，不應跳過規劃、測試或紅線。

`browser`、`site-audit-agentic`、`web-perf`、`cloudflare`、`workers-best-practices`、`wrangler`、`xueyi-writing-voice`、`shopee-auto-optimizer`、`footage-multiplier` 等既有領域技能仍是專業執行層；本層只補它們缺少的通用工程節奏與供應鏈治理，不取代領域技能。

## 採納紀錄

完整來源、commit、SHA-256、授權、安裝位置與未採納理由見 [skill-registry.json](./skill-registry.json)。目前採用的開源來源是 MIT 的 `obra/superpowers` 流程技能，以及 Apache-2.0 的 `getsentry/skills` `skill-scanner`。OpenAI 的舊 skills catalog 僅作參考索引；Anthropic Office skills 因檔案標示 proprietary，不納入本次開源安裝。

本次靜態掃描結果保存在 [skill-scan-results.json](./skill-scan-results.json)。八個 Superpowers 流程技能均為零 finding；`skill-scanner` 自身的高/危險 finding 位於它用來教人辨識惡意程式的 reference examples，依其說明判定為預期 false positive，不把掃描器誤標成「無風險」。

## 使用方式

你可以直接說「先想清楚」「寫成計畫」「先隔離工作區」「先測試再改」「這個失敗請找根因」「核對 Review 意見」「確認真的完成」「準備開 Draft PR」，路由會自然落到對應技能。若是要新增外部技能，先說「掃描這個 skill」，或把來源放入待審清單；不要直接整包 clone 到全域 skills。

每次技能更新都應記錄上游 commit、檔案 hash、授權與驗證結果；若技能帶 scripts、hooks、MCP 或網路動作，應再提高審查層級。
