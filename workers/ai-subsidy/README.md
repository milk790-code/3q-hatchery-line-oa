# 3q-ai-subsidy worker（v2.0 — AI 補助媒合系統）

單一 `worker.js`：`GET /` 落地頁、`POST /api/lead` 媒合 + 入庫 + LINE 通知、`GET /health`。
經 `.github/workflows/deploy-ai-subsidy.yml` 部署到 `3q-ai-subsidy.milk790.workers.dev`（push main 自動觸發）。

## v2.0 新增

- **規則引擎**（`RULES`，15 個補助計畫，資料查證 2026-06-12）：依 stage/biz/needs 分「高適配 / 中適配 / 未來可期」三層，回傳估算總額，前端 modal 即時渲染個人化清單。
- **LINE push 通知**：高適配 > 0 時 push 給 `ADMIN_LINE_USER_ID`（綁定自 GH secrets `Q3_LINE_TOKEN` / `OWNER_USER_ID`）。免費額度每月 200 則，低品質詢問不發。
- **防護**：honeypot 欄位 `hp`、contact 格式驗證（09 手機或 LINE ID）、同 IP 每日 20 筆 rate limit（D1 計數，無 KV binding）。
- **D1 新欄位**：`ai_subsidy_leads.matched_json`、`total_amount`（`ensureTable` 自動 ALTER）。

## 規則表維護

補助時效一變（SIIR 第二梯、CITD 開案、雲市集新一期）只需改 `RULES` 內該計畫的 `status_2026`（`open`/`seasonal`/`closed`）後 push main 重新部署。時效性最強的兩項：SIIR 第二梯、CITD 下一梯次 — 上線後定期到官網確認。

## 查詢 leads

```sql
SELECT created_at, contact, stage, biz, needs, total_amount FROM ai_subsidy_leads ORDER BY id DESC LIMIT 20;
```
