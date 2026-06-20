# LOOP / 3Q Context Distill - 2026-06-21

## BLUF

目前 LOOP 已經不是卡在「不知道下一步」，而是卡在明確的人類 gate：

1. **最高收益下一步：補 Google Places API key。**
2. **第二順位：補 Social Publisher token，讓 `/queue/list` 和公開發文工具可驗證。**
3. **部署順位：`3q-social-publisher` Worker 已有 deploy command，但正式 `wrangler deploy` 仍需 owner 明確批准。**
4. **repo 目前不適合 push PR：dirty scope 不乾淨，包含 `_debug/deploy/...` 大量刪除與 `workers/social-publisher/worker.js` 修改。**

最新可靠狀態來源：

- Dashboard: `C:\Users\USER\.codex\automations\loops-24\dashboard\latest.md`
- Dashboard updated: `2026-06-21 03:16:23 +08:00`
- Owner bundle: `C:\Users\USER\.codex\automations\loops-24\owner-approval-bundles\latest.json`
- Repo: `C:\Users\USER\Documents\GitHub\3q-hatchery-line-oa`
- Branch: `claude/charming-cannon-F2C4a`
- Ahead: `108`

## Current State

### Highest Profit Gate

LOOP dashboard 的 `Today First` 仍是：

- `highest_profit_next_action`: Set Google Places API key for prospecting
- `lane`: revenue
- `manual_gate`: manual_secret_input
- `next_approval`: secret-input
- `score`: 0.745

原因：Google Places key 會解鎖 prospect scoring，也就是優先找最可能付費的店家。這比先部署發文工具更接近現金流。

### Active Blockers

`secret-input` 有 6 個 waiting，其中 5 個 escalated：

- `google-prospecting-api-key-missing`
- `social-publisher-token-missing`
- `webhook-cron-map`
- `reconcile-content-queue`
- `content-queue-seed-inventory`
- connector health 相關 secret/input gate

`deploy-approval` 有 3 個 waiting：

- `review:worker_deploy_slices`
- `webhook-cron-map`
- `dirty-worktree`

`manual-send-approval` 仍有 2 個 waiting：

- `cold-outreach-cooldown-active`
- `investor-packet-review`

## Completed Progress

### 1. LOOP Control Plane

已建立並持續更新：

- connector health check
- dirty worktree 分群
- dirty review workbench
- worker deploy checklist
- worker deploy verification
- slice handoff
- secret gates
- secret checklist
- account binding workbench
- material factory
- manual send review
- manual gate adapter
- dashboard gate verification
- dashboard display verification
- owner approval bundle
- wakeup health verification
- power wake policy
- approval workbench
- JSON portability audit

重要結論：

- LOOP 會自動整理 local artifacts。
- LOOP 不會自動 push、deploy、send、寫 secrets。
- 最新 owner bundle 狀態仍是 `attention`，不是全綠。

### 2. Account Binding Workbench

已建立本機 checklist / workbench，用來標示哪些授權、CLI、secret 未完成。

目前 connector health：

- ready: `0/12`
- attention: `5`
- missing:
  - `github_cli`
  - `railway_cli`
  - `google_places_secret`
  - `social_publisher_token`
  - `line_admin_secrets`
- app auth unverified:
  - `github_app`
  - `gmail_app`
  - `google_drive_app`
  - `slack_app`
  - `chrome_plugin`
  - `computer_use_plugin`

最高收益缺口仍是 `Google Places API key`。

### 3. Secret Gate

Secret checklist 最新狀態：

- ready_for_runner_wrapper: `0/2`
- missing:
  - `google_places`
  - `social_publisher_queue`

本機 secret 檔案：

```powershell
notepad "$env:USERPROFILE\.codex\automations\loops-24\secrets.local.ps1"
```

Google Places gate 接受：

```powershell
$env:GOOGLE_MAPS_API_KEY = "..."
# or
$env:GOOGLE_PLACES_API_KEY = "..."
```

Social Publisher queue gate 接受：

```powershell
$env:SOCIAL_PUBLISHER_TOKEN = "..."
# or
$env:TRIGGER_TOKEN = "..."
```

規則：

- 不要 commit secrets。
- 不要把 real values 貼到 chat、report、PR、screenshot。
- secret ready 只代表可以驗證，不代表可以 deploy 或 send。

### 4. Google Places Prospect Scoring

目標已明確：

- 建 Google Places prospect scoring。
- 優先找最可能付費的店家。
- 用於 3Q revenue loop。

目前狀態：

- local runner / dashboard 已經把這件事排成最高收益下一步。
- 實際 live prospecting 卡在 `GOOGLE_MAPS_API_KEY` 或 `GOOGLE_PLACES_API_KEY`。
- 沒有 key 時，不應假裝已產生新 Google prospect drafts。

### 5. Manual Send Review / Cold Outreach

已產生 manual-review-only cockpit：

- local cockpit: `.loops/customer-acquisition/send-review-cockpit-v2.html`
- status: `manual-review-ready`
- ready_for_owner_review: `5/5`
- sent_count: `0`

目前 prospect list：

| Prospect | Channel | Estimated Value |
|---|---|---|
| ㄛ店 o.shop | line_oa | NT$8,000-15,000 |
| Shānmù 山木島 | line_oa | NT$12,000-18,000 |
| 1%bakery | line_oa | NT$10,000-16,000 |
| DOUGH 動手玩 | website | NT$12,000-20,000 |
| 鐵木 Ironwood Coffee | line_oa | NT$8,000-15,000 |

紅線：

- 不自動送 LINE。
- 不自動寄 email。
- 不自動 IG / public post。
- drafts 只到 owner review。

### 6. Social Publisher / Public Posting Tool

已在 `workers/social-publisher/worker.js` 加入公開工具頁邏輯：

- `/tool`
- `/`
- queue list
- add draft
- approve
- soft delete
- caption preview
- autofill
- publish loop gate
- stats

安全設計：

- 操作需 `Authorization: Bearer <token>`。
- token 只存在 browser `sessionStorage`。
- publish 需要 UI 手動輸入 `PUBLISH`。
- HTML response 加了 basic security headers / CSP。

驗證紀錄：

- `node --check workers/social-publisher/worker.js` 通過。
- `wrangler deploy --dry-run` 曾通過。
- 本機 `/tool` 曾回 `200 text/html`，Chrome headless screenshot 看過畫面正常。
- 正式 deploy 沒有執行。

目前 deploy gate：

- worker deploy: `ready_for_approval`
- command:

```powershell
Push-Location workers/social-publisher; wrangler deploy; Pop-Location
```

但還缺：

- deploy owner approval
- `SOCIAL_PUBLISHER_TOKEN` 或 `TRIGGER_TOKEN`
- post-deploy `/queue/list` protected verification

### 7. Material Factory / GPT-SoVITS Track

已建立素材工廠 handoff，目標是未來「只要有想法文字就能生出不錯素材」。

目前狀態：

- material factory status: `material-pack-ready`
- pack reused: true
- pack dir: `C:\Users\USER\.codex\automations\loops-24\material-factory\20260617T150152Z-make-a-45-second-vertical-video-for-taichung-loc`
- selected local assets: `12`
- storyboard scenes: `6`

缺工具：

- `ffmpeg`
- `gpt-sovits-root`

已知檔案：

- `C:\Users\USER\Documents\yt-dlp-master.zip`
- `C:\Users\USER\Google 雲端硬碟\jianying-editor-skill-main.zip`

下一步不是生成正式影片，而是補 runtime：

1. 安裝 / 指定 `ffmpeg`
2. 指定 `GPT_SOVITS_ROOT`
3. 決定 Jianying editor skill 要不要解壓整合
4. 先跑 demo pack，不直接對外發布

### 8. Investor Packet

Investor packet 已存在且被 owner bundle 偵測：

- localInvestorPacketCount: `72`
- root: `investor-packet/`
- gate: `investor_review`

狀態：

- 可 review。
- 不可自動 staging / sharing / sending / publishing / GitHub publication。
- Gmail / outbound send 必須 owner 手動批准。

### 9. Power Wake Policy

狀態：

- `WakeToRun=false`
- `StartWhenAvailable=true`
- `powerWakeNeedsApproval=true`
- verification ok

意思：

- hourly LOOP 在 Windows 醒著時可跑。
- 休眠時不保證會喚醒。
- 若要讓排程喚醒睡眠中的 Windows，需要 owner 明確批准，因為這是系統設定變更。

建議：

- 先維持 disabled。
- 等 revenue loop 真的開始跑穩，再決定是否開 wake。

## Dirty Worktree

最新 git status 顯示：

- branch ahead: `108`
- dirty:
  - `_debug/deploy/...` 大量 deleted files
  - `workers/social-publisher/worker.js` modified

Owner bundle 判斷：

- `local_scope_clean=false`
- `pr_publish_ready=false`
- `worker_ready=true`
- `status=attention`

解讀：

- Worker deploy 可以單獨審核。
- 但 PR / push 不建議現在做。
- `_debug/deploy/...` 大量刪除不是我應自動 revert 或 commit 的範圍，需 owner 決定。

## Current Priority Stack

### Priority 1 - Revenue Unlock

補 Google Places key：

```powershell
notepad "$env:USERPROFILE\.codex\automations\loops-24\secrets.local.ps1"
```

填：

```powershell
$env:GOOGLE_MAPS_API_KEY = "..."
```

或：

```powershell
$env:GOOGLE_PLACES_API_KEY = "..."
```

然後跑：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\prepare-secret-gates.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\prepare-secret-checklist.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\run.ps1 -ReportOnly -OnlySafeLocal
```

### Priority 2 - Publisher Verification

補：

```powershell
$env:SOCIAL_PUBLISHER_TOKEN = "..."
```

或：

```powershell
$env:TRIGGER_TOKEN = "..."
```

用途：

- 驗證 `/queue/list`
- 驗證公開發文工具 token gate
- post-deploy verification

### Priority 3 - Public Publisher Deploy

只有在 owner 明確批准後才跑：

```powershell
Push-Location workers/social-publisher
wrangler deploy
Pop-Location
```

部署後驗證：

```powershell
curl.exe --max-time 10 https://3q-social-publisher.milk790.workers.dev/tool
curl.exe --max-time 10 -H "Authorization: Bearer $env:SOCIAL_PUBLISHER_TOKEN" https://3q-social-publisher.milk790.workers.dev/queue/list
```

### Priority 4 - Dirty Worktree Decision

需要決定 `_debug/deploy/...` 大量 deleted files：

1. 保留刪除並整理成獨立 commit。
2. 還原 `_debug/deploy/...`。
3. 移到 ignored / archival strategy。

在 decision 前，不建議 push PR。

## Hard Red Lines

不要自動做：

- `git push`
- PR create
- merge
- `wrangler deploy`
- production setting changes
- permission changes
- LINE send
- IG post
- email send
- public post
- bulk outbound
- secret write / secret print
- delete external data

## Recommended Next Owner Action

最短路徑：

1. 開 `secrets.local.ps1`
2. 補 `GOOGLE_MAPS_API_KEY`
3. 補 `SOCIAL_PUBLISHER_TOKEN`
4. 跑 secret checklist refresh
5. 讓 LOOP 產生新的 prospect scoring output
6. 再決定是否批准 `wrangler deploy`

## Autonomous Judgment

目前不要把注意力放在 PR 或發文工具 deploy。最直接換錢的是 Google Places key，因為它讓 LOOP 可以從「已有 drafts」升級成「持續找到高機率付費店家」。Publisher `/tool` 是好用的操作面板，但它不是 revenue source 本身；它應排第二。

同時，不應忽略 dirty worktree。`_debug/deploy/...` 大量 deleted files 讓 `local_scope_clean=false`，這會讓 PR publication 不乾淨。這是 repo hygiene gate，不是 revenue gate；可延後，但不能混進 deploy / investor / outreach commit。

## Suggested Model Use

- 高價值部署決策、長任務蒸餾、跨 repo gate 判斷：最高能力模型。
- 日常 LOOP dashboard 讀取、下一步判斷：平衡型模型。
- 大量 connector health 分類、secret gate 抽取、artifact index：快速低成本模型。

## 可延伸研究方向

1. 把 Google Places scoring 結果接到 manual send cockpit，形成「找店家 -> 草稿 -> owner review」閉環。
2. 把 `/tool` 加上 read-only dashboard mode，無 token 時也能看 health / public status。
3. 把 material factory 接到 social publisher draft queue，只產 draft，不自動 publish。
4. 建一個 local-only revenue board，把 prospect value、channel、draft status、send gate 放在同一頁。
5. 把 dirty worktree 分群結果變成 one-click review bundle，但不自動 stage。

## 可馬上驗證營利的方式

1. 補 Google Places key 後跑一批台中店家 scoring。
2. 選 5 家分數最高店家，人工 review 草稿。
3. 手動聯絡，不自動群發。
4. 測三個價格帶：
   - NT$8,000 line_oa setup
   - NT$12,000 website / content queue setup
   - NT$20,000 integrated 3Q package
5. 用成交 / 回覆率回填 scoring 權重。
