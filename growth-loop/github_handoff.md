# 3Q Growth Loop GitHub Handoff

BLUF: This file covers only the standalone control-center engine bundle, which still has no approved target repository. The live 3q-site code path already has a separate known-repository handoff in champion_github_handoff.md; do not use the git-init commands below for that Champion patch.

Generated: 2026-07-10T21:48:20.571Z
Operator: Angelia 3Q Growth Loop Operator
Mode: week0_data_collection
Suggested branch: ang/3q-growth-loop-week0
Suggested PR title: 3Q Growth Loop Week 0 local engine

## Current State

- Local runner: npm run weekly:local
- LaunchAgent installed: yes
- LaunchAgent rollback: npm run schedule:uninstall
- Funnel breakdown: 3 post-level links / 6 attribution rows
- Production deploy performed: no
- Public link change performed: no
- Formal post / LINE push performed: no
- Customer data / payment / delete action performed: no

## Suggested Commit Message

```text
Build 3Q growth loop Week 0 local engine
```

## Suggested PR Summary

```markdown
## Summary

- Add Week 0 acquisition-loop artifacts for 3Q: D1 schema, event model, scoring, weekly report, approval queue, A/B status, candidate page, and Worker candidate.
- Add preview-only full-funnel aggregate import for link clicks, visits, CTA clicks, LINE adds, leads, deals, and quality flags.
- Add privacy-safe manual conversion preview for LINE adds, lead submits, deals, and quality flags.
- Add inbound-only LINE customer-service playbook and fixture guard for aggregate-only lead/deal handoff.
- Add post-level content attribution via unique content_id / variant_id tracking links plus funnel_breakdown artifacts.
- Add local weekly runner plus macOS LaunchAgent status so the safe local loop can run every Sunday.
- Add GitHub Actions weekly verification workflow that runs npm run verify and uploads review artifacts without deploy or send actions.
- Preserve hard gates for production deploy, public links, formal posts, LINE push, ECPay, customer data, and deletion.

## Verification

- npm run goal:audit
- npm run verify
- npm run worker:dry-run
- plutil -lint launchd/com.angelia.3q-growth-loop.weekly.plist

## Human Gates

- Confirm target GitHub repo before push / PR.
- Review .github/workflows/3q-growth-loop-weekly.yml before enabling scheduled GitHub runs on a default branch.
- Approve Cloudflare remote D1 and production Worker deploy.
- Approve current champion URL and any public A/B route.
- Manually publish posts / broadcasts and review customer-data or payment actions separately.
```

## Owner-Gated Commands

These commands apply only to the standalone engine bundle. Do not run them until the owner confirms a separate target repository and whether this folder should become its own repo or be copied into an existing repo. For the existing 3q-site repository, use champion_github_handoff.md instead.

```zsh
cd /Users/mac/Documents/Codex/control-center/3q-growth-loop
git init
git checkout -b ang/3q-growth-loop-week0
git add .
git commit -m "Build 3Q growth loop Week 0 local engine"
git remote add origin <OWNER_APPROVED_GITHUB_REPO_URL>
git push -u origin ang/3q-growth-loop-week0
gh pr create --draft --title "3Q Growth Loop Week 0 local engine" --body-file github_handoff.md
```

## Rollback

```zsh
cd /Users/mac/Documents/Codex/control-center/3q-growth-loop
npm run schedule:uninstall
```
