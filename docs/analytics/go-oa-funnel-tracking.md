# 四個 LINE OA 三問漏斗追蹤

版本：2026-07-17｜狀態：`LOCAL_READY`（尚未 push／PR／merge／部署）

## 追蹤定義

| 指標 | 計算 | 判讀 |
|---|---|---|
| 首句完成率 | `firstAnswers / starts` | 使用者啟動三問後，有回答第 1 題的比例 |
| 第三題完成率 | `thirdAnswers / starts` | 使用者啟動三問後，完成第 3 題的比例 |
| 交付率 | `deliveries / starts` | 啟動三問後，最後有被操作者明確標記為已交付成果的比例 |
| 平均交付分鐘 | `AVG(交付標記時間 − 第三題完成時間)` | 只計已標記交付的案件；沒有交付時回 `null` |
| 來源轉換 | 以上四項按 allowlisted `source` 分組 | 比較 `direct`、`social`、名片、插卡與 FB 素材矩陣 |

`第三題完成` 不等於 `成果已交付`。操作者真正把成果傳給客戶後，必須執行交付標記；否則該案不進交付分鐘與交付率。

## 四個 Worker

| Worker | slug | Existing KV binding |
|---|---|---|
| `3q-line-oa` | `brand-content` | `SESSION` |
| `tudigong-line-oa` | `rental-check` | `STATE` |
| `luxury-line-oa` | `luxury-check` | `KV` |
| `pop-line-oa` | `auto-care` | `SESSION` |

## 資料最小化

- Active intake state 仍只有 `slug/source/step`。
- 另外產生隨機案件碼 `GO-XXXXXXXXXXXX`；它不由 LINE user id 推導。
- 事件 key：`go-funnel:v1:<slug>:<Taipei cohort day>:<source>:<event>:<caseId>`；共用 KV 的 Worker 仍依 slug 隔離。
- 交付 receipt：只含 `slug/source/cohortDay/completedAt`。
- LINE `webhookEventId` 先做 SHA-256 後才作 7 天去重 key；不保存原始 webhook event id。
- 不保存 LINE user id、姓名、地址、原始回答、文件內容、完整 URL 或任意 query。
- 事件保留 120 天；交付 receipt 保留 90 天；管理報表最多查 90 天。
- KV 採案件級單調事件，不使用 read-modify-write counter；首答會補寫 `started`，第三題會補寫 `started/first_answer`，讓單次事件漏寫可在後續階段自癒。

## 一致性邊界

- 這是營運漏斗分析，不是金流、計費、法律或會計帳本。Workers KV 是 eventual consistency；跨節點讀取與同鍵併發沒有 transaction 保證，報表短時間內可能尚未收斂。
- LINE 重送用雜湊後的 `webhookEventId` 做 best-effort 去重；在同一事件的第一次處理成功後寫入 dedupe key，避免一般 redelivery 誤推進題目。
- Terminal receipt／事件遇到單次 KV 錯誤會自動重試；兩次仍失敗就保留第 3 題 pending 與 metadata、不寫 dedupe，請使用者另傳「完成」重試。人工交付標記也會補齊 `started/first_answer/third_answer` 事件鏈。
- LINE reply 非 2xx 或網路失敗時，不寫 dedupe，並把 intake state、metadata 與本次新增事件回復到處理前狀態。Webhook 本身已回 200，因此不能假設 LINE 會因 Reply API 失敗自動 redeliver；這個 rollback 是確保使用者重新傳送時仍停在原題，不會把啟動碼誤當第一題答案。
- 交付標記在正常循序操作下為 idempotent；同一案件不可由多人同時標記。若要精準處理併發交付、不可覆寫稽核軌跡或計費，下一版必須改用 D1 transaction／Durable Object。
- 目前四支 Worker 共用一把具報表讀取與交付標記權限的管理金鑰，適合小規模 pilot；任一端疑似洩漏要立即輪替。進入多人營運前應拆成每 Worker 獨立 key，並再分 read／write scope。
- 每週報表建議在最後一筆事件後至少 60 秒再讀，並以 LINE 對話抽查第一批 10 件。若 90 天內接近 800 件交付，應在查詢外部操作上限前遷移到 D1 或 KV list metadata。

## 管理 API

兩個 endpoint 都要求 Worker secret `GO_FUNNEL_ADMIN_KEY`，且只接受 request header `X-Admin-Key`。金鑰不接受 query string；未配置時回 HTTP 503，錯誤金鑰回 HTTP 401。

- `GET /admin/go-funnel?days=30`：回 totals、逐 source rates 與定義，不回案件碼。
- `POST /admin/go-funnel/delivered`：body 只能是 `{ "caseId": "GO-..." }`；循序重複標記回傳既有結果。

## 每案操作 SOP

1. 客戶完成第三題後，LINE 回覆會顯示匿名案件碼。
2. 製作並傳送約定的免費成果。
3. 傳送成功後立即標記交付：

```bash
node scripts/go-funnel-ops.mjs delivered --worker pop-line-oa --case GO-ABCDEF123456
```

4. 每週查看四個 OA 合併報表：

```bash
node scripts/go-funnel-ops.mjs summary --worker all --days 30
```

CLI 只從環境變數 `GO_FUNNEL_ADMIN_KEY` 讀取金鑰；請從 Keychain／安全 secret store 載入，不要把值放進 command arguments、shell history、文件或截圖。CLI 不會輸出金鑰。

互動式載入可用：

```bash
read -s 'GO_FUNNEL_ADMIN_KEY?管理金鑰：' && export GO_FUNNEL_ADMIN_KEY
# 執行上方 summary／delivered 指令
unset GO_FUNNEL_ADMIN_KEY
```

CLI 會拒絕 `--admin-key` 與所有未知 flags，避免把秘密誤放進 argv。

## 上線前人工閘門

1. 在 GitHub repository Actions secrets 建立 `GO_FUNNEL_ADMIN_KEY`，值使用密碼產生器生成；不得貼進 issue、PR 或聊天。
2. 核准只合併並部署四個指定 Worker 與四條對應 workflow。
   - 注意：目前四條 workflow 都監聽 `push: main`；merge 就會直接觸發 production deploy，沒有獨立的第二次部署按鈕。
3. 部署後確認四個 `/go-intake-health`、既有 `/health` 與未授權 `/admin/go-funnel` 的 401。
4. 使用相同安全金鑰呼叫四個管理報表，空資料應為 200 且所有數字為 0／`null`。
5. 用本人測試 LINE 帳號各完成一次三問，傳送測試成果後標記交付，再確認來源與分鐘數。

本功能不回填上線前歷史資料，避免用推測製造假 baseline。第一批 10 件應逐案實際標記；之後才能用平均與 P75 分鐘調整免費名額。

## 回滾

- Revert 單一功能 commit 即可停止新增事件與移除管理 API。
- 舊事件 key 沒有執行效果，會依 TTL 自動到期；緊急回滾不需要刪資料。
- 若新 secret 未配置，追蹤事件仍可收集，但管理 API fail-closed；不得因此把報表宣稱為可用。
- Workflow 讀取既有 Worker settings 時使用 fail-closed；API 失敗或回傳 `success:false` 會停止部署，並繼承所有既有 `secret_text` bindings。Cloudflare PUT 使用 `bindings_inherit=strict`，任一 unresolved inherit binding 都會擋住部署。
