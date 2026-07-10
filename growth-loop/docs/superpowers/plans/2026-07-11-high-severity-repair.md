# 3Q Growth Loop High-Severity Repair Implementation Plan

> **For agentic workers:** Execute inline with test-driven development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all ten confirmed HIGH findings, synchronize deployment evidence with merge commit `f86faa7356ac7962d9b429951b67c742370271c0`, and publish a draft repair PR without merging or deploying it.

**Architecture:** Shared pure libraries define the completed Taipei scoring window, canonical rates, and idempotent event-store merge. Existing scripts consume those invariants. A read-only MCP/CI gate reads an append-only resolution ledger plus live/local deployment evidence and fails closed on unresolved HIGH findings.

**Tech Stack:** Node.js ESM, `node:test`, Wrangler 4, MCP SDK v1, GitHub Actions, Cloudflare Workers.

## Global Constraints

- Real P0/P1 aggregate files are never fabricated or inferred from absence.
- Remote D1 queries remain aggregate-only and completed-week scoped.
- No production deploy, workflow rerun that uploads Worker content, rollback, merge, secret/IAM change, or public A/B activation is performed in this branch workflow.
- The draft PR targets `milk790-code/3q-hatchery-line-oa:main` from `agent/3q-growth-loop-high-fixes`.

---

### Task 1: Canonical scoring and completed-week window

**Files:**
- Create: `scripts/lib/scoring-policy.mjs`
- Create: `scripts/high-severity-scoring.test.mjs`
- Modify: `scripts/growth-loop.mjs`
- Modify: `scripts/real-data-decision-replay.mjs`
- Modify: `scripts/owner-data-preflight.mjs`
- Modify: `scripts/win-rule-fixtures.mjs`

- [ ] Write failing tests for visits-only line-add rate and completed Taipei week filtering.
- [ ] Implement shared scoring/window functions.
- [ ] Route all four local decision paths through the shared functions.
- [ ] Prove a challenger with 20 link clicks, 150 visits and 6 LINE adds scores 0.04, not 0.30.

### Task 2: Preserve event history during D1 refresh

**Files:**
- Create: `scripts/lib/idempotent-event-store.mjs`
- Create: `scripts/high-severity-event-store.test.mjs`
- Modify: `scripts/export-d1-aggregate-events.mjs`
- Modify: `scripts/d1-aggregate-export-fixtures.mjs`

- [ ] Write failing tests proving manual conversion events survive a D1 refresh.
- [ ] Add completed-week SQL bounds and query `limit + 1`.
- [ ] Fail when grouped rows exceed the configured limit.
- [ ] Replace only prior D1 aggregate events for the same campaign/window; preserve manual events.

### Task 3: Idempotent aggregate/manual imports

**Files:**
- Modify: `scripts/import-funnel-aggregates.mjs`
- Modify: `scripts/import-manual-conversions.mjs`
- Modify: `scripts/real-data-apply-fixtures.mjs`

- [ ] Write failing rerun and duplicate-row fixtures.
- [ ] Reject duplicate IDs inside one input batch.
- [ ] Skip already-existing deterministic IDs during a repeated apply.
- [ ] Report appended and skipped counts explicitly.

### Task 4: Correct P0 gates

**Files:**
- Create: `scripts/high-severity-gates.test.mjs`
- Modify: `scripts/next-p0-quick-capture.mjs`
- Modify: `scripts/sample-gate-batch-preflight.mjs`

- [ ] Prove generated comment headers do not become count fragments.
- [ ] Prove missing/empty `all_rows` fails closed.
- [ ] Retain aggregate-only and sensitive-data checks.

### Task 5: Deployment evidence and MCP/CI gate

**Files:**
- Modify: `../.github/workflows/deploy-3q-site.yml`
- Modify: `../.github/workflows/3q-growth-loop-weekly.yml`
- Create: `review-resolution-ledger.json`
- Create: `review-waiver-ledger.json`
- Create: `deployment-evidence.json`
- Create: `scripts/live-local-invariant-diff.mjs`
- Add: MCP review server, audit, tests, and package scripts.

- [ ] Add ERR trap and named diagnostics so a failed curl/jq/test identifies the exact command.
- [ ] Record current version `d156aab2-aaf6-42cb-bd72-b4e2bb2e2a32` and rollback version `de2997a0-6a6a-4780-9e24-e65774dc3f1a`.
- [ ] Verify both versions retain `GROWTH_LOOP_COLLECTOR_URL` exactly.
- [ ] Make CI fail on unresolved HIGH or stale live/local invariants.

### Task 6: Full verification and draft PR

- [ ] Refresh the Champion source lock to merged main and rerun the full weekly chain.
- [ ] Require all fixtures, MCP smoke, dependency audit, Wrangler dry-run, artifacts verifier, archive, and Owner Console smoke to pass.
- [ ] Commit only task-scoped files, push the repair branch, and create a draft PR.
- [ ] Queue production workflow rerun/rollback/merge as explicit human gates.
