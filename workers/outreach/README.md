# 3q-outreach — 陌開獲客引擎(實戰包 v3)

把陌開壓成「複製貼上」:系統算數字、排節奏、催黃金一小時;人只負責發訊息和聊。

## 系統地圖

```
名單 → /admin/import(自動算:符合補助 top3+加總+個人化開場)
     → 每日 08:30 cron 推 15 家卡片到老闆 LINE(含明日預熱清單)
     → 你複製開場去 DM(IG/FB)
     → 對方回了 → /admin/board 點「回了」→ 系統秒推轉介話術(含 #編號)
     → 對方加 3Q OA 傳「補助健檢 #編號」→ bot 四題 → 補助清單 → 約 15 分健檢(webhook/worker.js)
     → 健檢預約推老闆+打夥伴潛力分 → board 推進 報價→成交
     → 無回覆:D+3 價值投放、D+7 走人式收尾(cron 自動推文案)、D+10 自動歸檔
     → 每週一 09:00 週報:各池/變體 發送→回覆→健檢→成交,標該砍該放大
```

## 名單匯入格式

```bash
curl -X POST 'https://3q-outreach.milk790.workers.dev/admin/import?key=<ADMIN_KEY>' \
  -H 'Content-Type: application/json' -d '{
  "leads": [
    { "name": "XX汽車美容", "pool": "A", "batch": 1, "ig": "xx_carcare",
      "store_type": "汽車美容", "area": "台中", "founded_year": 2021, "note": "IG 常發施工影片" },
    { "name": "YY甜點工作室", "pool": "B", "batch": 3, "store_type": "餐飲",
      "biz": "food", "founded_year": 2026, "area": "台北" }
  ]}'
```

- `pool`:A=汽美同業(米速身分開場)/ B=新設立公司(時機切角開場)
- `biz` 不填時:A 池預設 `car`、B 池預設 `other`;`stage` 由 `founded_year` 推(<2 年=new,否則 mid;B 池無年份預設 new)
- 匯入當下就算好 top3 補助、加總金額、開場話術——卡片即發,不再等任何 AI

## 每日節奏(你只做三件事)

1. **早上**:LINE 收到 15 家卡片 → 逐家複製開場去 DM → 順手把「明日預熱清單」15 家追蹤+按讚(2 分鐘,回覆率 1.5–2 倍的最高 CP 動作)
2. **對方回了**:開 board 點「回了」→ 系統推轉介話術給你 → 貼給對方(黃金一小時,超過 60 分鐘系統會催)
3. **D+3 / D+7**:cron 把到期文案直接推到你 LINE,複製發出即可

## 端點

| 路徑 | 用途 |
|---|---|
| `/health` | 池子各狀態數量 |
| `/admin/board?key=` | 追蹤表(手機開,點文字框=全選複製) |
| `/admin/import?key=` | POST 名單 |
| `/admin/today?key=` | 預覽今日卡片(`&run=1` 真跑:寫狀態+推播) |
| `/admin/weekly?key=` | 手動跑週報 |
| `/admin/nudge?key=` | 手動跑 SLA 巡檢 |

ADMIN_KEY 在 worker.js 頂部常數(repo 慣例)。

## 補助目錄維護

正本 `data/subsidies.json` → 同步 `workers/outreach/worker.js` 與 `webhook/worker.js` 的內嵌 CATALOG(三處)。
`store_cap_wan` = 小型店常見可達上限(加總用,**刻意不用計畫最高額吹牛**;A 池非台中店加總 = 83 萬,即話術裡「80 幾萬」的可稽核出處)。`deadline_note` 每月人工校一次(D+3 文案會引用)。

## 誠實鐵則(寫進引擎的)

- 每個寫進話術的金額都回溯到目錄欄位,測試鎖死(`node test-outreach.mjs`)
- 加總為 0 時開場自動不吹數字
- D+7 社證用「該店自己算出來的數字」,不編第三方故事
- 健檢風險反轉話術(健檢免費/沒過件不收費)由 bot 統一輸出,不在 DM 階段亂承諾

## 已知限制(v1)

- IG 近況自動研究**不做**(合規:不爬 IG)。預熱動作本來就是人做;`note` 欄位可放你看到的近況
- 陌開訊息由你的帳號手發(主帳號風控,先跑兩週人發看數據,才考慮自動化)
- 「回了」靠你在 board 點(IG DM 系統看不到);點下去那刻 SLA 計時開始
