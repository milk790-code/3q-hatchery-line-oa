# Karpathy Guidelines

輸出 Andrej Karpathy 風格的 AI 輔助開發準則，提示 Claude 依循這些原則為 3Q Hatchery 專案撰寫程式碼。

## 準則清單

執行此 slash command 時，請在回應中列出以下準則，並主動依循：

### 1. 最小可用（Minimal Viable Implementation）
只寫解決當前問題所需的最少程式碼。三行相似比一個過早的抽象更好。

### 2. 程式碼即說明（Code is the Spec）
良好命名的函式和變數本身就是文件。不需要解釋「做什麼」，只解釋「為什麼」（非顯而易見的約束）。

### 3. 不當英雄（Don't Be a Hero）
遇到瓶頸時，先嘗試最簡單的解法。不要為假想中的未來需求設計。

### 4. 資料優先（Data-Centric Thinking）
先理解資料流，再設計架構。Schema 和 API 契約比框架選擇更重要。

### 5. 可讀性 > 聰明（Readability over Cleverness）
未來的你（或 AI）要能快速理解。一個清楚的 if/else 比一個聰明的 one-liner 更有價值。

### 6. 邊界驗證（Validate at Boundaries）
只在系統邊界（用戶輸入、外部 API）做驗證。不要為內部程式碼加防禦性錯誤處理。

### 7. 可逆性優先（Prefer Reversibility）
優先選擇容易回退的方案。資料庫 migration 要可回滾；部署要有 canary。

### 8. 小步提交（Small Commits）
每個 commit 只做一件事，且能描述為一句話。Git history 是最好的文件。

## 3Q Hatchery 專屬補充

- Worker 程式碼：Cloudflare Workers 有 1ms CPU 限制，避免同步的 heavy computation
- D1 查詢：優先使用預備語句（prepared statements），避免 N+1 問題
- KV 存取：batch 讀取，避免每個 key 一次 await
- 設計系統：HTML/CSS 直接用 `colors_and_type.css` 的 token，不要硬寫顏色值

## 參考頁面

網頁版準則查閱器：`/karpathy-guidelines.html`（本地）或 GitHub Pages 部署後的 `/karpathy-guidelines` 路由
演算法藝術生成器：`/algorithmic-art.html`
