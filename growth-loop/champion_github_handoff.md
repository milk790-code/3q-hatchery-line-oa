# Champion GitHub Handoff

BLUF: integration_already_merged_followup_repairs_only. The source-locked release stack is clean and scoped. A reviewed remote ancestor may already exist; this packet prepares only the remaining owner-gated branch update and draft PR, and executes neither.

- Repository: milk790-code/3q-hatchery-line-oa
- Base: main
- Branch: codex/3q-growth-loop-champion-v1
- Local head: 9b6fd00c082f2b67d6cde159e61dc6c407d02ea0
- Worker commit: null
- Workflow commit: none
- Changed paths: .github/workflows/deploy-3q-line-oa.yml, .github/workflows/deploy-fleet-sentinel.yml, .github/workflows/deploy-pop-line-oa.yml, .github/workflows/deploy-tudigong.yml, brands/popmonster.json, workers/3q-line-oa/worker.js, workers/fleet-sentinel/worker.js, workers/outreach/worker.js, workers/pop-line-oa/worker.js, workers/pop-sales-ai/worker.js, workers/sales-ai/worker.js, workers/tudigong-sales-ai/worker.js, workers/tudigong/worker.js
- Remote branch present: yes
- Remote commit: 9b6fd00c082f2b67d6cde159e61dc6c407d02ea0
- Remote state: up_to_date_with_local
- Local commits ahead: 0
- Push performed by this packet: no
- PR created by this packet: no
- Merge permitted by this packet: no

## Commit Stack



## Safe Local Review

```zsh
REVIEW_WORKTREE='/Users/mac/Documents/Codex/control-center/worktrees/3q-site-growth-loop-champion-v1'
SOURCE_LOCK='f86faa7356ac7962d9b429951b67c742370271c0'
git -C "$REVIEW_WORKTREE" status --short --branch
git -C "$REVIEW_WORKTREE" log --oneline "$SOURCE_LOCK"..HEAD
git -C "$REVIEW_WORKTREE" diff --stat "$SOURCE_LOCK"..HEAD
git -C "$REVIEW_WORKTREE" diff "$SOURCE_LOCK"..HEAD -- .github/workflows/deploy-3q-line-oa.yml .github/workflows/deploy-fleet-sentinel.yml .github/workflows/deploy-pop-line-oa.yml .github/workflows/deploy-tudigong.yml brands/popmonster.json workers/3q-line-oa/worker.js workers/fleet-sentinel/worker.js workers/outreach/worker.js workers/pop-line-oa/worker.js workers/pop-sales-ai/worker.js workers/sales-ai/worker.js workers/tudigong-sales-ai/worker.js workers/tudigong/worker.js
node --check "$REVIEW_WORKTREE/workers/3q-site/worker.js"
```

## Owner-Gated GitHub Write

Do not run until the owner explicitly approves the remaining branch update or draft PR. The push is expected to be fast-forward only; this block never force-pushes or merges.

```zsh
REVIEW_WORKTREE='/Users/mac/Documents/Codex/control-center/worktrees/3q-site-growth-loop-champion-v1'
EXPECTED_COMMIT='9b6fd00c082f2b67d6cde159e61dc6c407d02ea0'
BRANCH='codex/3q-growth-loop-champion-v1'
test "$(git -C "$REVIEW_WORKTREE" rev-parse HEAD)" = "$EXPECTED_COMMIT"
git -C "$REVIEW_WORKTREE" push -u origin "$BRANCH"
gh pr create --repo 'milk790-code/3q-hatchery-line-oa' --base 'main' --head "$BRANCH" --draft --title '3Q site: persist privacy-safe Growth Loop telemetry' --body-file '/Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/champion_github_pr_body.md'
```

## After Creation

Stop at the draft PR. Do not merge and do not deploy. Verify that the PR contains only .github/workflows/deploy-3q-line-oa.yml, .github/workflows/deploy-fleet-sentinel.yml, .github/workflows/deploy-pop-line-oa.yml, .github/workflows/deploy-tudigong.yml, brands/popmonster.json, workers/3q-line-oa/worker.js, workers/fleet-sentinel/worker.js, workers/outreach/worker.js, workers/pop-line-oa/worker.js, workers/pop-sales-ai/worker.js, workers/sales-ai/worker.js, workers/tudigong-sales-ai/worker.js, workers/tudigong/worker.js. Dedicated D1 schema and aggregate-only collector evidence are already accounted for. Any future deploy remains a separate owner gate.

## Rollback

If the draft PR is wrong, the owner may close it. Retain the branch until review is complete; no automatic branch deletion or force-push is provided.
