# Four OA Funnel Tracking Implementation Plan

> **For agentic workers:** Execute inline in this session. Subagents are intentionally not used because workspace policy forbids delegation unless the user explicitly requests it. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為四個已部署的 `/go` LINE OA 補上首句完成率、第三題完成率、平均交付分鐘數與 allowlisted source 轉換追蹤。

**Architecture:** 每個 Worker 使用現有 KV namespace 寫入案件級、單調且無 PII 的漏斗事件；狀態仍只保存 `slug/source/step`，匿名案件碼與時間放在獨立 metadata。LINE `webhookEventId` 經 SHA-256 後做 7 天重送去重，首答／第三題會補寫先前事件，terminal 寫入會 retry；LINE reply 失敗則 rollback 本次狀態／事件且不寫 dedupe。交付不是三題完成：操作者送出成果後，使用只從環境變數讀取管理金鑰的本機 CLI 標記，管理 API 才計算完成到交付的分鐘數。

**Tech Stack:** Cloudflare Workers ES modules、Workers KV、Web Crypto、Node.js built-in test runner、GitHub Actions inherit-safe secret bindings。

## Global Constraints

- 只修改 `3q-line-oa`、`tudigong-line-oa`、`luxury-line-oa`、`pop-line-oa` 四個 Worker。
- 不保存 LINE user id、原始回答、完整 LINE URL、任意 query 或客戶個資。
- source 僅接受既有 allowlist 與 `fb-[0-9a-f]{6}`。
- 漏斗事件 retention 120 天；交付 receipt retention 90 天；報表查詢最多 90 天。
- 管理 API 僅接受 `X-Admin-Key`，對應 Worker secret `GO_FUNNEL_ADMIN_KEY`；未配置時回 503。
- 本輪只做到 local commit 與 deploy-ready；secret、push、PR、merge、production deploy 需新的限定 T3 核准。

---

### Task 1: 四 OA 追蹤 contract tests

**Files:**
- Create: `tests/go-funnel-4oa.test.mjs`

**Interfaces:**
- Consumes: 四支 Worker 的既有 webhook 與 KV bindings。
- Produces: `GET /admin/go-funnel?days=30`、`POST /admin/go-funnel/delivered` 的共同 contract。

- [x] **Step 1: Write the failing test**

測試以真實 Worker `fetch()` 執行三題流程，要求 KV 只出現匿名案件事件；首答與第三題 rate 都為 1；交付前平均分鐘為 `null`，標記交付後為約 10 分鐘；未授權管理請求被拒絕。

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/go-funnel-4oa.test.mjs`

Expected: FAIL，因 `go-funnel` endpoints 與事件尚不存在。

### Task 2: 匿名漏斗事件與交付 receipt

**Files:**
- Modify: `workers/3q-line-oa/worker.js`
- Modify: `workers/tudigong/worker.js`
- Modify: `luxury-line-oa/src/index.js`
- Modify: `workers/pop-line-oa/worker.js`

**Interfaces:**
- Consumes: existing KV binding、allowlisted source、`crypto.randomUUID()`。
- Produces: `go-funnel:v1:<slug>:<day>:<source>:<event>:<caseId>` 與 `go-delivery:v1:<slug>:<caseId>`。

- [x] **Step 1: Implement minimal event helpers**

每個 Worker 新增同形 helpers：`createGoFunnelMeta()`、`recordGoFunnelEvent()`、`buildGoFunnelSummary()`、`markGoFunnelDelivered()`；事件僅包含 cohort day、source、event、隨機案件碼與分鐘數。

- [x] **Step 2: Wire lifecycle events**

啟動寫 `started`，回答第一題寫 `first_answer`，回答第三題寫 `third_answer` 與交付 receipt；回覆追加匿名案件碼，reset 清除 active metadata。

- [x] **Step 3: Run tests to verify GREEN**

Run: `node --test tests/go-funnel-4oa.test.mjs`

Expected: four OA lifecycle assertions pass。

### Task 3: 安全管理 API、CLI 與 workflow binding

**Files:**
- Modify: `.github/workflows/deploy-3q-line-oa.yml`
- Modify: `.github/workflows/deploy-tudigong.yml`
- Modify: `.github/workflows/deploy-luxury-line-oa.yml`
- Modify: `.github/workflows/deploy-pop-line-oa.yml`
- Create: `scripts/go-funnel-ops.mjs`
- Create: `docs/analytics/go-oa-funnel-tracking.md`

**Interfaces:**
- Consumes: `GO_FUNNEL_ADMIN_KEY` environment variable and Worker secret binding。
- Produces: aggregated JSON summary and idempotent delivery marker。

- [x] **Step 1: Add fail-closed admin endpoints**

`GET /admin/go-funnel?days=30` returns totals and per-source rates without case IDs；`POST /admin/go-funnel/delivered` accepts `{caseId}` and returns calculated minutes。Both require exact `X-Admin-Key` and never accept a key in the URL。

- [x] **Step 2: Add local operator CLI**

Commands:

```bash
read -s 'GO_FUNNEL_ADMIN_KEY?管理金鑰：' && export GO_FUNNEL_ADMIN_KEY
node scripts/go-funnel-ops.mjs summary --worker all --days 30
node scripts/go-funnel-ops.mjs delivered --worker pop-line-oa --case GO-ABCDEF123456
unset GO_FUNNEL_ADMIN_KEY
```

`read -s` 的輸入不會顯示或寫進 shell history；the key is read only from the environment and never printed or written。CLI 也拒絕 `--admin-key` 與所有未知 flags。

- [x] **Step 3: Add inherit-safe workflow binding**

Each deployment workflow adds `GO_FUNNEL_ADMIN_KEY` from the same GitHub Actions secret or inherits the existing Worker secret；settings lookup 或 `success:false` fail-closed，所有既有 `secret_text` bindings 都保留，且 PUT 使用 `bindings_inherit=strict`；no literal secret appears in Git。

### Task 4: Verification and handoff

**Files:**
- Modify: `docs/analytics/go-oa-funnel-tracking.md`
- Modify: local audit pack under `control-center/pop-go-growth-ops-20260717/`

- [x] **Step 1: Run full verification**

```bash
node --test tests/go-funnel-4oa.test.mjs
node --test tests/go-intake-4oa.test.mjs
node workers/pop-line-oa/test-b-disclosure.mjs
node --check workers/3q-line-oa/worker.js
node --check workers/tudigong/worker.js
node --check luxury-line-oa/src/index.js
node --check workers/pop-line-oa/worker.js
node --check scripts/go-funnel-ops.mjs
node scripts/check-sync.mjs
git diff --check
```

- [x] **Step 2: Create local commit and red-line item**

Commit message: `feat(line): add privacy-safe OA funnel tracking`

Queue exact approval for creating `GO_FUNNEL_ADMIN_KEY`, pushing the branch, merging, and deploying only these four Workers。
