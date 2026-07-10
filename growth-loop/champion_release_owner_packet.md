# Champion Release Owner Packet

BLUF: The code path is locally verified. An existing collector may already be live; confirm its provenance and D1 schema evidence before considering any redeploy, then review the Champion patch and rollback target.

- Release: champion-contact-v1-d63f07cc8f6f
- Source: milk790-code/3q-hatchery-line-oa@f86faa7356ac7962d9b429951b67c742370271c0
- Patch: integrations/3q-site/generated/worker.candidate.patch
- Candidate SHA-256: d63f07cc8f6fe0944cf9c7279eb4ed2abe4b3b6e1e7d05c4cd87425beb26542a
- Local feature branch: codex/3q-growth-loop-champion-v1
- Local release head: 9b6fd00c082f2b67d6cde159e61dc6c407d02ea0
- Worker commit: not prepared
- Workflow commit: none
- Remote feature branch present: yes
- Remote state: up_to_date_with_local
- Local commits ahead of remote: 0
- Dedicated collector D1 present: yes
- Existing Candidate deployment observed: yes
- Candidate deploy required now: no
- Live ingest readiness proven: no
- D1 inventory checked: 2026-07-10T21:43:33.424Z
- Current live version: de2997a0-6a6a-4780-9e24-e65774dc3f1a
- Current live compatibility date: 2024-12-01
- Production deploy performed: no

## Review Artifacts

- D1 schema contract: d1_schema_contract.md
- D1 config guard: approved_d1_config.md
- GitHub handoff: champion_github_handoff.md
- Draft PR body: champion_github_pr_body.md

## Gates

- [ ] review_champion_patch (T1): local_feature_commit_ready_for_owner_review
  Review local head 9b6fd00c082f2b67d6cde159e61dc6c407d02ea0; the full stack is scoped to .github/workflows/deploy-3q-line-oa.yml, .github/workflows/deploy-fleet-sentinel.yml, .github/workflows/deploy-pop-line-oa.yml, .github/workflows/deploy-tudigong.yml, brands/popmonster.json, workers/3q-line-oa/worker.js, workers/fleet-sentinel/worker.js, workers/outreach/worker.js, workers/pop-line-oa/worker.js, workers/pop-sales-ai/worker.js, workers/sales-ai/worker.js, workers/tudigong-sales-ai/worker.js, workers/tudigong/worker.js. Remote state is up_to_date_with_local; this preflight performed no GitHub write.
- [ ] provision_production_collector (T3): existing_collector_observed_owner_provenance_and_schema_evidence_required
  Candidate deployment 5073984b-bcc0-40f1-a331-daaadd741071 / version 133d27b0-36e5-41e8-96ec-b55925b7b30a is observed healthy, security-current, and wired to the Champion. No redeploy is currently required, but owner provenance and remote schema evidence are still missing.
- [ ] approve_champion_production_deploy (T3): blocked_owner_approval_required
  A live integration may already be observable, but its provenance is not owner evidence. Any deploy or redeploy still requires patch review, current rollback confirmation, and explicit approval.
- [ ] approve_github_branch_push_or_pr (T2): blocked_owner_approval_required
  The remote branch is a reviewed ancestor (up_to_date_with_local) and local is ahead by 0; updating it or opening a PR remains an external GitHub write.

## Safe Local Review

```bash
REVIEW_WORKTREE='/Users/mac/Documents/Codex/control-center/worktrees/3q-site-growth-loop-champion-v1'
git -C "$REVIEW_WORKTREE" status --short --branch
git -C "$REVIEW_WORKTREE" log --oneline --decorate f86faa7356ac7962d9b429951b67c742370271c0..HEAD
git -C "$REVIEW_WORKTREE" diff --stat f86faa7356ac7962d9b429951b67c742370271c0..HEAD
git -C "$REVIEW_WORKTREE" diff f86faa7356ac7962d9b429951b67c742370271c0..HEAD -- .github/workflows/deploy-3q-line-oa.yml .github/workflows/deploy-fleet-sentinel.yml .github/workflows/deploy-pop-line-oa.yml .github/workflows/deploy-tudigong.yml brands/popmonster.json workers/3q-line-oa/worker.js workers/fleet-sentinel/worker.js workers/outreach/worker.js workers/pop-line-oa/worker.js workers/pop-sales-ai/worker.js workers/sales-ai/worker.js workers/tudigong-sales-ai/worker.js workers/tudigong/worker.js
node --check "$REVIEW_WORKTREE/workers/3q-site/worker.js"
cmp "$REVIEW_WORKTREE/workers/3q-site/worker.js" /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/integrations/3q-site/generated/worker.candidate.js
```

## Production Command Template

Do not run this block until every T3 gate is explicitly approved and the collector HTTPS origin is verified.

```bash
REVIEW_WORKTREE='/Users/mac/Documents/Codex/control-center/worktrees/3q-site-growth-loop-champion-v1'
rg '\$\{api\}/settings|\$\{api\}/content|binding_fingerprint' "$REVIEW_WORKTREE/.github/workflows/deploy-3q-site.yml"
gh workflow run deploy-3q-site.yml --repo milk790-code/3q-hatchery-line-oa --ref main
```

## Post-Deploy Read-Only Checks

```bash
curl -fsS https://3q-site.milk790.workers.dev/health | jq -e '.ok == true and .build == "growth-loop-telemetry-v2"'
curl -fsS https://3q-site.milk790.workers.dev/growth-loop/status | jq -e '.ok == true and .collector_configured == true and .collector_origin == "https://3q-growth-loop-candidate.milk790.workers.dev" and .collector_url_matches_expected == true and .build == "growth-loop-telemetry-v2"'
curl -fsS https://3q-site.milk790.workers.dev/contact | rg 'data-growth-contact-mode|data-growth-loop-telemetry|匿名瀏覽與 CTA 成效事件'
```

## Rollback

Rollback target: de2997a0-6a6a-4780-9e24-e65774dc3f1a

```bash
/Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/node_modules/.bin/wrangler rollback de2997a0-6a6a-4780-9e24-e65774dc3f1a --name 3q-site -m "Rollback champion Growth Loop integration"
```

Re-read live deployments immediately before deploy. If the active version changed, regenerate this packet before using rollback.
