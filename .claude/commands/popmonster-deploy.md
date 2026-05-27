# PopMonster Deploy

PopMonster 產品線（3Q 旗下）部署 checklist 與發布流程。

## 用法

```
/popmonster-deploy [目標環境]
```

範例：
- `/popmonster-deploy` — 完整部署 checklist
- `/popmonster-deploy staging` — 僅部署到 staging
- `/popmonster-deploy production` — 完整生產部署流程

## PopMonster 是什麼

PopMonster 是 3Q Hatchery 旗下的快閃活動 / 爆款商品孵化產品線。
技術棧：Cloudflare Workers + D1 + KV + GitHub Pages 靜態前端。

## 部署 Checklist

### 前置確認
- [ ] `main` branch 所有 CI 綠燈
- [ ] D1 migration 已在 staging 測試通過
- [ ] Workers secrets 已設定（`wrangler secret list` 確認）
- [ ] LINE Webhook URL 已更新（如有變動）

### 部署步驟

1. **執行 migration（如有）**
   ```bash
   wrangler d1 migrations apply CRM --remote
   ```

2. **部署 Workers**
   ```bash
   wrangler deploy --config workers/social-publisher/wrangler.toml
   wrangler deploy --config webhook/wrangler.toml
   ```

3. **驗證**
   ```bash
   curl https://[worker-url]/health
   ```

4. **推送靜態資產**
   ```bash
   git push origin main  # 觸發 GitHub Pages 自動部署
   ```

### 回滾方案
```bash
wrangler rollback --config workers/social-publisher/wrangler.toml
```

## 環境對照

| 環境 | Worker URL | 說明 |
|------|-----------|------|
| staging | `3q-hatchery-webhook-staging.workers.dev` | 每晚重置 |
| production | `3q-hatchery-webhook.workers.dev` | 正式線上 |

## 對應頁面

`popmonster-deploy.html` — 視覺化部署控制台（靜態 Demo 版）
