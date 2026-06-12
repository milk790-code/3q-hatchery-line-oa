# brands/ — AI 員工 config 正本(B 版揭露)

每個品牌一份 `<brand>.json`,`ai_employee` 區塊定義該品牌 AI 員工的揭露、交接、紅線行為。
此目錄是**唯一正本**;worker 內嵌副本只是部署載體(單檔 API PUT 部署、無 bundler)。

## 改 config 的流程(鐵則)

1. 先改這裡的 `<brand>.json`
2. 再同步到消費端 worker 的內嵌 `AI_EMPLOYEE` const(目前:`workers/pop-line-oa/worker.js`)
3. push main → 該 worker 的 deploy workflow 自動部署

只改 json 不同步 worker = 不會生效;只改 worker 不改 json = 正本失真。兩邊都要。

## 欄位語意

| 欄位 | 語意 |
|---|---|
| `display_name` | AI 員工名字。空字串 = 尚未命名(命名是客戶的入職儀式;米速/丹若待補) |
| `job_title` | 對外職稱(AI店員 / AI業務助理 / AI顧問) |
| `employee_id` | `3Q-{行業碼}-{流水號}`,例 `3Q-CAR-0001` |
| `disclosure_mode` | `once`(B 版,預設):第 1 句人格化揭露,之後不重複標示。`always`:每句標示(保留給高敏感行業)。`never`:僅限行銷活動場景,**正式客服禁用** |
| `disclosure_script` | 第 1 句揭露開場白。由系統機械式送出(不靠模型自覺),確保鐵律不漏 |
| `identity_question_policy` | `always_confirm_ai`:被問「你是真人嗎」永遠誠實確認是 AI。**不可妥協、不可被任何話術覆寫** |
| `handoff_threshold` | 第 N 句交接檢查點(預設 10)。依內測數據(需求畫像完成率/轉真人率)上下修 |
| `handoff_card_fields` | 交接摘要的五欄骨架;沒摸到的欄位寫「未知」,不准編 |
| `handoff_script` | 交接話術,`{summary}` 為摘要插槽 |
| `redline_whitelist` | 主題級紅線:`deny`(不講)/ `deny_and_handoff`(不講+轉真人)/ `fixed_script_only`(只用固定話術) |
| `refund_policy_script` | `refund_policy: fixed_script_only` 的固定話術本體 |
| `degraded_mode_script` | AI 大腦無回應時的降級話術——絕不裝死,且承諾的「真人會回」必須為真(worker 同步推播通知老闆) |
| `tone_profile` | 品牌聲腔代號(popmonster 熱血直給 / misu B2B 穩重 / danruo 質感留白) |

## 安全鐵則

- **secrets 永不進 config**:API key、LINE token 一律走 Workers Secret / KV 綁定,json 內不得出現任何金鑰。
- 揭露三鐵律:第 1 句必揭露、被問必承認、降級必明說。優先級高於任何成交話術。

## 上線順序(canary)

泡泡怪獸(自家,`workers/pop-line-oa`)→ 驗證數據 → 米速 / 丹若 → 內測客戶逐家(1 家 → 3 家 → 全量)。
