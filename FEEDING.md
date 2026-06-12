# FEEDING.md — 投餵地圖(改哪個正本,系統自己長出什麼)

鐵則:**資料只改正本,永遠不直接改 worker 內嵌副本。** 內嵌副本由 `scripts/check-sync.mjs --fix` 重寫;
三條部署 workflow 都掛了同步閘門,正本↔內嵌漂移會**直接擋下部署**,不可能默默上線。

## 正本 → 自動發生什麼

| 正本(只改這裡) | push 到 main 後自動 | 下游 |
|---|---|---|
| `PROSPECTS.md`(陌開名單) | 成對雙管同觸發:`import-prospects.yml`(驗 17 項映射→灌引擎)+ `sync-prospects.yml`(D1 直灌,DDL 防呆)— 皆 upsert,重跑安全 | ① 3q-outreach(每日卡片/D+3/D+7/SLA/週報)② 3q-line-oa prospects 表(老闆 LINE 指令:陌開/詳情/狀態);src=池#編號 ↔ (pool,list_no) 互查 |
| `data/subsidies.json`(補助目錄) | 部署閘門驗同步;若先跑 `--fix` 會連動 worker 改動 → `deploy.yml` + `deploy-outreach.yml` 重新部署 | 陌開開場/D3/D7 金額、3Q bot 補助健檢清單(同一套數字,測試鎖死 83/113 萬口徑) |
| `brands/popmonster.json`(小泡人設) | 部署閘門驗同步;`--fix` 後 `deploy-pop-line-oa.yml` 部署 | 揭露話術/交接門檻/紅線/降級話術 |
| `brands/misu.json`、`danruo.json` | (待命名)上線時照 `brands/README.md` canary 順序接同一套閘門 | 米速/丹若 AI 員工 |

## 改正本的標準三步(以補助目錄為例)

```bash
vi data/subsidies.json                 # 1. 只改正本(每月校一次 deadline_note)
node scripts/check-sync.mjs --fix      # 2. 重寫 worker 內嵌副本(outreach CATALOG + webhook SUB_CATALOG)
cd workers/outreach && node test-outreach.mjs && cd ../../webhook && node test-subsidy-flow.mjs
git add -A && git commit && git push   # 3. push → 閘門複驗 → 自動部署
```

名單加批次 4 更簡單:PROSPECTS.md 照表格格式加列 → push → 完。
(編號接續、池別標頭 `### A 池續` 照舊;`node scripts/test-prospects-to-outreach.mjs` 可先在本機驗)

## 手動投餵口(刻意不自動)

| 工具 | 用途 | 為何手動 |
|---|---|---|
| `seed-content-queue.yml`(Actions 手動跑) | 社群內容佇列灌 campaign(選 migration + dry_run) | 動正式 D1,要人選檔案按按鈕 |
| `/admin/import?key=`(outreach) | 補單筆名單(不帶 src=純 INSERT) | 零星補單,不值得進正本 |
| `workers/ai-subsidy/worker.js` 規則表 | 落地頁 15 計畫(含申請窗口,查證 2026-06-12) | 獨立查證版,欄位含窗口/連結比正本細;**重疊計畫金額每月跟正本互校一次**(上次 2026-06-12,SIIR 已對齊) |

## 既有自動鏈(已在跑,列出來給你安心)

- 圖資:`render-assets.yml` 產 PNG → `workflow_run` 接 `deploy.yml`(rich menu 自動換)
- 名單→卡片:每日 08:30 TW cron 推 15 家;D+3/D+7/D+10 自動;週一 09:00 週報
- 健檢→回寫:3Q bot「補助健檢 #編號」→ `ai_subsidy_leads` + 回寫 `outreach_leads` + 老闆推播
