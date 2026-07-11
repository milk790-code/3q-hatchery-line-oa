# 全代碼審核交接（Claude → Codex / Owner）2026-07-10 18:1x

由 Claude Code 對本工作區全部代碼做的多代理審核（26 組審核員 + 對抗性複核，95 個原始發現）。
**Collector worker 的修復已由 Claude 直接部署上線**（見下）；本檔其餘項目留給 growth-loop 管線的維護者（Codex 線）依現行 gate 流程處理。

## 已修復並部署（3q-growth-loop-candidate，版本 49ca25f5-bfd7-449b-92e9-e875d9e69d34）

1. `src/index.ts` resolveRedirectTarget：champion 分支原本回傳裸 `env.CHAMPION_URL`，
   丟失 sid/variant_id/content_id/utm_*（AB 流量 90% 那一臂無法做 session join）。
   已改為 `appendAttributionParams(new URL(env.CHAMPION_URL), sourceUrl, assetId)`。
   線上證據：`/ab/ab-week0-cta-text-001?sid=...` 302 Location 已帶完整歸因參數到 3q-site。
2. `src/index.ts` calculateD1Scores：`line_add_rate` 分母原本 `visits || link_clicks`，
   在 champion page_view 遙測壞掉的週會用 link_clicks 當分母，可能把 challenger 誤判成
   `eligible_for_human_promotion_review`。已改為嚴格 `visits`（與 owner-sample-gate-status
   等旁路計分器一致）。
   注意：worker.ts 已同步（cp src/index.ts worker.ts）。
   部署驗證：/health ok（build origin-pii-v2）、白名單 metadata 通過、PII key 400、
   巢狀物件 400、9 條 WEEK0 追蹤連結參數全數通過新 token 規則。
   （驗證期間寫入了少量 sid=claude-verify-* / content_id=claude-deploy-verify 的測試事件到 D1。）

## 同一不變量在本地腳本仍是反的（HIGH，建議優先修）

Worker 的正典分母是 visits；以下腳本用 `link_clicks || visits`（順序相反），
會在 link_click 與 page_view 並存時算出與 worker 不同的 line_add_rate，可能替換冠軍判斷背書：

- `scripts/growth-loop.mjs` ~line 1843（scoreAssets）；另 ~1672 buildFunnelBreakdown 同病
- `scripts/real-data-decision-replay.mjs` ~line 739
- `scripts/owner-data-preflight.mjs` ~line 319（`asset.link_clicks || asset.visits`）
- `scripts/win-rule-fixtures.mjs` ~line 324（fixture 驗證的是錯的實作 → 測試背書錯誤行為）

## 其他 HIGH（未修，維護者處理）

- `scripts/growth-loop.mjs` ~173：本地計分用「進行中的當週」且對 data/lp_events.jsonl 全量
  無 occurred_at 過濾——與 worker 的「已完成上一台北週」不變量不一致。
- `scripts/export-d1-aggregate-events.mjs`：~55 核准的 remote 匯出會整檔覆蓋 data/lp_events.jsonl
  （毀掉 owner 手動匯入的 conversion 事件）；~128 aggregate SQL 無日期過濾 + LIMIT 10000 無截斷偵測；
  ~192 safeDimension 對超出 [A-Za-z0-9._:/-] 的既存維度值直接 throw（整批匯出炸掉）。
- `scripts/import-funnel-aggregates.mjs` ~135 / `scripts/import-manual-conversions.mjs` ~129：
  --apply 無冪等/重複 event_id 防護，重跑文件寫的指令=事件加倍。
- `scripts/sample-gate-batch-preflight.mjs` ~85：handoff 檔 all_rows 缺失/空陣列時回 ready ok=true（vacuous pass）。
- `scripts/next-p0-quick-capture.mjs` ~318：先切逗號再判 '#' 註解，模板自帶的表頭註解會被當資料解析。
- `scripts/weekly-runner.mjs` ~1191：stale lock 無條件 unlink，兩個 runner 同判 stale 可同時取得鎖
  （今天 13:15 的 status 交叉污染事件即同族問題）。

## 新版 origin-pii-v2 的兩個殘留注意點（低嚴重度、設計取捨）

- `/r` `/ab` 轉址對「不合 token 規則的參數」現在會 400 而不是照樣轉址：
  現有 9 條連結安全，但未來若放中文 utm_campaign 或平台自動附加奇怪參數，訪客會卡 400。
  建議：轉址路徑改「丟棄壞參數、照樣轉址」，POST /e 維持嚴格。
- `/r/%e0` 這類壞 percent-encoding 會 URIError → 500（error mapping 沒接住 URIError）。

## 對抗性複核最終結果（2026-07-10 19:0x 補）

95 條原始發現 → **38 條確認**（10 HIGH + 28 MEDIUM，複核 agent 多數有實跑重現）、
15 條駁回、38 條 low 未逐條複核。機器可讀完整清單（含逐條 failure_scenario 與複核證據）：
**`CLAUDE-REVIEW-FINDINGS-20260710.json`**（本目錄）。

上面手寫的 HIGH 清單全部獲得確認，另補充幾條已確認的代表性 MEDIUM：
- `scripts/weekly-runner.mjs` ~1191 stale-lock 競態（雙 runner 可同時取鎖）
- `scripts/growth-loop.mjs` ~3642 sample_threshold_gate 與 ~3260 資料證據 gate 邏輯互為反向
- `scripts/growth-loop.mjs` ~4378 weekly report BLUF 寫死「無真實事件」，資料來了也不會變
- `scripts/champion-contract-audit.mjs` ~39 稽核寫死 ok:true
- `scripts/owner-gate-evidence.mjs` ~406 秘密偵測 regex 用 `-` 但真實 token 前綴是 `_`（ghp_/sk_live_ 全漏抓）
- `scripts/owner-sample-count-recovery.mjs` ~219 同源 counts 相加＝翻倍
- 多支 owner 表單/ledger 腳本：重複列 last-wins 靜默吞掉、無重複偵測

註：`src/index.ts` 的兩條確認項已由 Claude 修復並部署（見最上方），複核重跑時讀到的是修好後的碼。
