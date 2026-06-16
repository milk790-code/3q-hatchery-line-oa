# LoopOS Lane Map

LoopOS turns each wakeup into a local operating round:

1. Read automation memory and current repo state.
2. Rank the next candidates.
3. Produce local, review-ready artifacts.
4. Stop at a human approval gate.

It must not push, deploy, send outbound messages, create PRs/issues, merge, delete, change permissions, or write secrets.

## Output Contracts

- `state`: `%USERPROFILE%\.codex\automations\loops-24\state.json`
- `run report`: `%USERPROFILE%\.codex\automations\loops-24\runs\*.md`
- `dashboard`: `%USERPROFILE%\.codex\automations\loops-24\dashboard\latest.md`

## Lanes

### revenue

Purpose: find the next action most likely to create demand, leads, or cash.

Current task sources:

- `google_business_prospecting`

Allowed artifacts:

- Deduped public prospect lists.
- Local evidence summaries.
- Manual review handoffs.

Hard stops:

- No LINE, IG, email, form, or bulk outbound sending.
- No customer PII enrichment beyond public business listing evidence.

### deployment

Purpose: make Cloudflare Workers, cron, webhook, queue, and secret readiness deploy-ready without deploying.

Current task sources:

- `cloudflare_worker_health`
- LOOPS discovered Worker deploy reviews.
- Secret gate handoffs.
- Content queue reconciliation.
- Wakeup health checks.

Allowed artifacts:

- Health reports.
- Worker deploy-ready checklists.
- Redacted secret gate readiness.
- Content queue reconciliation reports.

Hard stops:

- No `wrangler deploy`.
- No production setting changes.
- No secret printing or writing secret values into reports.

### outreach-draft

Purpose: turn eligible prospects into review-ready drafts, never sent messages.

Current task sources:

- `cold_outreach_batch`

Allowed artifacts:

- Draft files.
- Send checklist.
- Dedup/cooldown evidence.

Hard stops:

- Drafts remain `manual_send_only`.
- Dedup no-op is a valid result and must not be bypassed by rerunning blindly.

### repo-hygiene

Purpose: keep the local repo safe to operate before automation expands scope.

Current task sources:

- `repo_status`
- `github_label_control`
- Dirty worktree snapshots.
- Commit boundary plans.
- Frontend/artifact review reports.

Allowed artifacts:

- Worktree snapshots.
- Commit boundary plans.
- Slice handoffs.
- Syntax and artifact reports.
- Local GitHub label-control run plans.

Hard stops:

- No staging unrelated changes without review.
- No broad refactor just to make the dashboard look clean.
- No GitHub issue comments or label removal unless explicitly approved.

### demo-sales

Purpose: turn LoopOS behavior into a recordable and sellable story.

Current task sources:

- `github_issue_from_latest_run`
- PR readiness packets.
- GitHub local handoffs.
- Demo scripts.

Allowed artifacts:

- Local issue/PR drafts.
- Demo narration.
- Sales handoff docs.

Hard stops:

- No GitHub issue creation, PR creation, push, merge, or protected-branch action without approval.

## Morning Decision Rule

The dashboard should answer only four questions:

1. What is the highest-profit next action?
2. What safe local actions were completed?
3. What is blocked by a human gate?
4. What must not be touched automatically?

If a lane has no new work, report it as quiet instead of inventing activity.

## Memory Governance

- Read `%USERPROFILE%\.codex\automations\loops-24\state.json` before ranking candidates.
- Write only redacted local artifacts after each run.
- Keep secrets, customer PII, send-ready private content, and financial account data out of memory and reports.
- Treat stale automation memory as evidence to refresh, not as confirmed current truth.
