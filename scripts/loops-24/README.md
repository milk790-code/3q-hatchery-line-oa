# LOOPS 24 runner

This is the first executable shell for the LOOPS 24-hour cross-session pusher.
It turns each wakeup into a bounded coordination round:

1. Acquire a local lock under the automation state directory.
2. Load previous run state.
3. Discover candidate work in this repository.
4. Score candidates with value, urgency, starvation, loopability, freshness, risk, and duplicate penalties.
5. Auto-complete safe local follow-up work.
6. Write a heartbeat, state file, and per-run report.

The runner is intentionally safe against external services. It does not deploy,
publish, delete, change permissions, or send bulk messages. Live probes only run
when environment variables are provided.

## LoopOS operating model

LoopOS is the owner-facing layer on top of this runner:

1. Read local automation memory and current repo evidence.
2. Rank work into one of five lanes: `revenue`, `deployment`,
   `outreach-draft`, `repo-hygiene`, or `demo-sales`.
3. Produce local, review-ready artifacts.
4. Stop at the next human approval gate.

The lane map lives in `scripts/loops-24/LOOPOS-LANE-MAP.md`. The recordable
sales/demo script lives in `scripts/loops-24/LOOPOS-DEMO-SCRIPT.md`.

The task registry is `scripts/loops.tasks.json`. Each task should declare
`lane`, `manual_gate`, `expected_artifact`, and `dedup_policy`.

Tasks that can lead to outbound messages, GitHub writes, deploys, secrets,
permission changes, public posting, or production changes must keep a manual
gate. The runner may prepare handoffs, but it must not cross those gates.

By default, `run.ps1` calls `run.mjs --auto-complete`. Auto-complete is limited
to local, review-ready artifacts:

- worktree snapshots
- commit boundary plans
- slice handoffs and stage scripts
- frontend/artifact review reports
- frontend slice handoffs and stage scripts
- GitHub local PR handoffs for branches that are ahead of upstream
- Worker deploy-ready checklists
- owner approval bundles
- a compact completed / blocked / next approval dashboard
- content queue reconciliation reports
- Wrangler cache audit reports
- cold outreach drafts only when prospects are eligible

It stops at review gates for secrets, tokens, deploy approval, outbound sending,
and broad frontend/artifact payloads.

Before generating slice handoffs, auto-complete rechecks the current worktree
fingerprint and refreshes the commit-boundary plan when the latest plan is stale.
This keeps generated stage scripts tied to the exact files currently visible to
Git.

When auto-complete is enabled and manual gates are present, the runner writes the
current dashboard first, verifies that dashboard's approval groups, then refreshes
the owner approval bundle from the verified dashboard.

When the GitHub handoff is generated in the same run, auto-complete also prepares
the matching PR readiness packet before building the owner bundle. The owner
bundle treats stale PR readiness packets as attention items instead of approval
ready evidence.

Before escalating a manual gate, LOOPS also prepares a manual-gate adapter report.
That report groups similar blockers into one shared taxonomy, lists safe automatic
substitutes, and keeps only the true hard stops for owner approval. The same
contract can be synced into Codex, Claude, or additional operator accounts so
their outputs do not drift.

Frontend/artifact review also runs syntax checks for plain `.js` files and
marks affected slices as hard stops when syntax errors are detected.

It can also surface a `github_publication` candidate when the current branch is
ahead of its upstream. Auto-complete may generate a local PR handoff under the
automation state directory, but it never runs `git push`, creates a pull request,
merges, deploys, or publishes.

When the GitHub handoff is current, LOOPS can also generate a PR readiness packet
that aggregates the latest manual gates and evidence. This remains local-only and
does not push or create a pull request.

LOOPS also writes an owner approval bundle that consolidates the GitHub handoff,
PR readiness, Worker deploy checklist, secret gates, wakeup health, dashboard
gate verification, and manual-send gates into one local decision page. It does
not run `git push`, create a pull request, deploy, call protected endpoints,
write secrets, or send messages.

The owner bundle treats wakeup health as an approval gate. If the latest
wakeup-health report is missing, unhealthy, or older than
`LOOPS_WAKEUP_REPORT_FRESH_MINUTES` (default 65 minutes), the bundle refreshes
the local wakeup-health report and stays in attention until it is fresh and
green.

It can also surface a `cold_outreach` candidate from
`scripts/outreach.prospects.json`. That path creates review-ready draft work for
the hourly runner, but outbound LINE/IG/email sending remains manual.

It also surfaces a `google_business_prospecting` candidate. That path uses the
official Google Places API when `GOOGLE_MAPS_API_KEY` or `GOOGLE_PLACES_API_KEY`
is present, appends deduped public business prospects locally, and never sends
outbound messages by itself.

## Run locally

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\run.ps1
```

or:

```bash
node scripts/loops-24/run.mjs --auto-complete
```

Report-only mode:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\run.ps1 -ReportOnly
```

Node equivalent:

```bash
node scripts/loops-24/run.mjs --report-only
```

Only-safe-local mode disables external HTTP probes even when live URLs or tokens
are present:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\run.ps1 -OnlySafeLocal
```

Node equivalent:

```bash
node scripts/loops-24/run.mjs --auto-complete --only-safe-local
```

## Loop dashboard

Each successful run writes a compact LoopOS dashboard with the morning decision,
safe local actions, manual red lines, blocked actions, lane summary, and the next
approval gate:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\show-dashboard.ps1
```

Latest dashboard path:

```text
%USERPROFILE%\.codex\automations\loops-24\dashboard\latest.md
```

Blocked items older than `LOOPS_BLOCKER_ESCALATE_HOURS` are marked as
`ESCALATED` in the dashboard and run report.

The dashboard is intentionally not a generic analytics page. Its job is to let
Hsuehyi decide the next approval or intervention within one minute.

The dashboard JSON is a machine-readable monitoring contract, not just a copy of
the markdown. It includes `summary`, `manualRedLines`, `waiting`,
`approvalGroups`, and the compatibility alias `nextApproval` so later verifier,
owner-bundle, or external monitor steps do not need to parse markdown text.
Within `summary`, `nextApproval` means the `Today First` approval gate, while
`largestApprovalGroup` identifies the largest grouped backlog gate.
When the latest wakeup-health evidence has Windows `WakeToRun=false`, the
dashboard also routes the wakeup waiting item to `power-wake-policy` so the
daily dashboard and owner approval bundle show the same sleep-wakeup decision.

Verify that manual-gated waiting items are mapped to the expected approval
groups:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\verify-dashboard-gates.ps1
```

The verifier reads only the local dashboard JSON and writes a local report under
the automation state directory. It does not push, create a PR, deploy, call
protected endpoints, write secrets, or send messages.

The morning decision is derived from the selected candidates, lane priority, risk
signals, and manual gates. Task registry metadata is read from:

```text
scripts/loops.tasks.json
scripts/loops.cold-outreach.tasks.json
```

The registry is advisory governance metadata only. It documents expected
artifacts, dedup policies, and review gates; it does not grant permission to
push, deploy, send, delete, or write secrets.

## Check wakeup health

Create a local-only health report for the hourly wakeup path. The report checks
Task Scheduler when running on Windows, recent LOOPS run state, and stale lock
signals. It does not start a run, modify the scheduled task, push, deploy, or
write secrets.

On Windows, the health report also verifies the scheduled task points at this
repo's `scripts\loops-24\run.ps1`, keeps `-OnlySafeLocal` enabled by default,
uses this repo as the working directory, repeats every hour, ignores overlapping
instances, has a bounded execution time limit, and has catch-up enabled with
`StartWhenAvailable`.

If `WakeToRun` is disabled, the report emits a non-blocking warning: LOOPS can
catch up when Windows becomes available, but the task is not guaranteed to wake
a sleeping machine.

The warning is intentionally report-only. LOOPS does not change Task Scheduler
or power-management settings without explicit owner approval.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\check-wakeup-health.ps1
```

Default state path:

```text
%USERPROFILE%\.codex\automations\loops-24\
```

## Local secrets file

`run.ps1` loads this machine-local file before each run:

```powershell
%USERPROFILE%\.codex\automations\loops-24\secrets.local.ps1
```

`run.ps1` creates a blank example if it is missing. Use it as the template:

```powershell
Copy-Item "$env:USERPROFILE\.codex\automations\loops-24\secrets.example.ps1" `
  "$env:USERPROFILE\.codex\automations\loops-24\secrets.local.ps1"
```

Supported env vars:

- `GOOGLE_MAPS_API_KEY` or `GOOGLE_PLACES_API_KEY`
- `SOCIAL_PUBLISHER_TOKEN` or `TRIGGER_TOKEN`
- optional `SOCIAL_PUBLISHER_URL`

Keep `secrets.local.ps1` out of git. The runner reads it locally, redacts token
fields in reports, and still stops before deploys, pushes, PR creation, or
outbound sending.

Prepare a redacted local handoff for the current secret gates:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\prepare-secret-gates.ps1
```

The handoff is written under the automation state directory and records only
readiness booleans. It does not execute `secrets.local.ps1`, print values, write
secrets, or call protected live endpoints.

One-click local checker:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\check-secret-gates.ps1
```

The checker exits `0` when every required gate is ready for the local runner
wrapper, and exits non-zero when one or more gates are missing. It never prints secret
values.

## Prepare manual gate adapter

Create a local report that finds manual-like gates across LOOPS scripts, docs,
task registries, and workflows. It maps each gate to safe automatic substitutes
before owner escalation.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\prepare-manual-gate-adapter.ps1
```

Latest adapter report path:

```text
%USERPROFILE%\.codex\automations\loops-24\manual-gate-adapter\latest.md
```

## Sync cross-agent memory

Use `docs/loopos-cross-agent-memory.md` as the canonical rule for Codex, Claude,
and extra operator accounts. When explicitly approved, this sync can write the
same contract to the LoopOS state directory, a Codex ad hoc memory note, and a
Claude memory file.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\sync-agent-memory.ps1 --dry-run
```

The sync defaults to dry-run. Use `--write` or `LOOPS_ALLOW_MEMORY_SYNC=1` only
after explicit owner approval. It stores rules, not secrets or run evidence.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\sync-agent-memory.ps1 --write
```

## Optional live social-publisher probe

The runner defaults to the current public 3Q social-publisher URL:

```text
https://3q-social-publisher.milk790.workers.dev
```

Override it in the automation environment when needed:

```text
SOCIAL_PUBLISHER_URL=https://3q-social-publisher.<subdomain>.workers.dev
SOCIAL_PUBLISHER_TOKEN=<same value as TRIGGER_TOKEN>
```

The token is optional. Without it, LOOPS still probes `/health` and reports that
queue-list verification is waiting on `SOCIAL_PUBLISHER_TOKEN` or
`TRIGGER_TOKEN`. The token is used only for `/queue/list` and is never written
into reports.

## Useful environment variables

```text
LOOPS_AUTOMATION_ID=loops-24
LOOPS_STATE_DIR=C:\Users\USER\.codex\automations\loops-24
LOOPS_REPO_ROOT=C:\Users\USER\Documents\GitHub\3q-hatchery-line-oa
LOOPS_MAX_CANDIDATES=8
LOOPS_LOCK_TTL_MINUTES=55
LOOPS_OUTREACH_BATCH_SIZE=5
LOOPS_OUTREACH_COOLDOWN_DAYS=14
LOOPS_GOOGLE_LIMIT_PER_QUERY=8
LOOPS_GOOGLE_MAX_NEW=20
LOOPS_ONLY_SAFE_LOCAL=1
LOOPS_BLOCKER_ESCALATE_HOURS=24
GOOGLE_MAPS_API_KEY=<set in environment only, never commit>
```

## Google business prospecting

Configured searches live in `scripts/outreach.prospects.json` under
`google_prospecting.queries`.

Manual run:

```powershell
$env:GOOGLE_MAPS_API_KEY = '<paste key for this terminal only>'
node scripts/google-business-prospector.mjs --max-new 20 --json
node scripts/loops-hourly-runner.mjs --json
```

Outputs:

```text
.loops/google-prospects/
.loops/outreach/
```

Every generated contact is still `manual_send_only`: verify the listing, use
only public business contact channels, and log the result before sending another
touch.

## Install Windows hourly wakeup

Register a current-user Task Scheduler job. It starts once after a short delay,
then repeats every hour. It runs only as the logged-in Windows user and uses the
same read-only runner above.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\install-windows-task.ps1
```

The installed task defaults to safe-local mode and a 30-minute execution limit
so a stuck wakeup does not crowd out the next hourly round. Override the limit
when needed:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\install-windows-task.ps1 -ExecutionTimeLimitMinutes 30
```

Use `-AllowLiveProbes` only when you explicitly want the hourly task to run
read-only public/live probes from the scheduler.

Inspect:

```powershell
Get-ScheduledTask -TaskName LOOPS-24-3Q-Hatchery
Get-ScheduledTaskInfo -TaskName LOOPS-24-3Q-Hatchery
```

Remove:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\uninstall-windows-task.ps1
```

## Generate cold outreach drafts

This turns the top `cold_outreach` candidate into local review artifacts under
the automation state directory. It writes drafts and a cooldown ledger only; it
does not send LINE, Instagram, email, or any bulk outbound message.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\generate-cold-outreach.ps1
```

Preview without writing:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\generate-cold-outreach.ps1 -DryRun
```

## Snapshot dirty worktree

Create a compact, read-only handoff of current git status. This helps keep
LOOPS edits separate from the broad staged payload before any deploy or commit.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\snapshot-worktree.ps1
```

## Plan commit boundaries

Create a read-only grouping report for the current dirty worktree. This is the
review step after a snapshot: it separates LOOPS control-plane changes, Worker
deploy gates, content queue baseline files, frontend/artifact payloads, and
local tooling files. It does not stage, commit, push, deploy, or delete files.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\plan-commit-boundaries.ps1
```

## Prepare a slice handoff

Turn one commit-boundary group into a review artifact with an explicit staging
script, commit message, PR draft, and verification commands. This is still
read-only against git: it writes the stage script under the automation state
directory but does not run it.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\prepare-slice-handoff.ps1 -Group loops_control_plane
```

## Prepare PR readiness

Create a local packet for final review before explicit push or draft PR approval.
It aggregates the current GitHub handoff, secret gates, Worker deploy review,
wakeup health, commit boundary, content queue, and frontend/manual gates. It
does not run `git push`, create a pull request, deploy, merge, publish, or write
secrets.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\prepare-pr-readiness.ps1
```

## Prepare owner approval bundle

Create the single-page approval packet that explains which final actions need
Hsuehyi approval and which commands remain gated.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\prepare-owner-approval-bundle.ps1
```

Latest approval bundle path:

```text
%USERPROFILE%\.codex\automations\loops-24\owner-approval-bundles\latest.json
```

Verify that the latest owner approval bundle still matches the current branch,
PR readiness packet, wakeup health, dashboard-gate report, and dirty-worktree
scope:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\verify-owner-approval-bundle.ps1
```

The verifier reads local LOOPS JSON artifacts and git status only. It does not
push, create PRs, deploy, call protected endpoints, write secrets, or send
messages.

When Windows `WakeToRun` is disabled, the owner bundle includes a
`power_wake_policy` gate. That gate asks whether hourly LOOPS should wake a
sleeping machine, but it never exposes or runs a Task Scheduler command.

## Review Worker deploy slices

Create a local-only review for current `deploy-approval` Worker groups from the
latest commit-boundary plan. The report runs JavaScript syntax checks, inspects
Wrangler config basics, records endpoint signals, and scans for obvious secret
literals. It also surfaces deployment red-line capabilities such as LINE push
side effects, broadcast control paths, D1 delete paths, cron side effects,
AI-generated publishing drafts, and protected admin endpoints. It does not stage,
push, deploy, mutate Cloudflare settings, or call protected live endpoints.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\review-worker-deploy-slices.ps1
```

Turn the latest Worker deploy review into a deploy-ready checklist:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\prepare-worker-deploy-checklist.ps1
```

The checklist includes inferred deploy commands and post-deploy verification
steps, but it does not run `wrangler deploy` or call protected endpoints.

## Review frontend/artifact payload

Create a read-only inventory for the large frontend/artifact group from the
latest commit-boundary plan. The report summarizes sizes, top-level bundles,
package manifests, Wrangler deploy configs, entry candidates, and potential
secret/absolute-path findings. It does not stage, commit, push, deploy, or
delete files.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\review-frontend-artifacts.ps1
```

## Prepare frontend slice handoffs

Turn the latest frontend/artifact review into separate review packets for the
recommended slices, such as `art-portfolio-static-preview`,
`design-showcase-vite-app`, `token-editor-app`, and `shared-helper`. This writes
reports and stage scripts under the automation state directory, but does not run
the stage scripts and does not modify frontend files.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\prepare-frontend-slice-handoffs.ps1
```

## Audit Wrangler cache

Create a read-only report of `.wrangler/cache`, `.wrangler/tmp`, and
`wrangler-account.json` paths currently visible to git. The audit does not
delete files and does not change staging.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\audit-wrangler-cache.ps1
```

## Reconcile content queue seeds

Parse local `content_queue` migration inserts and compare referenced GitHub Pages
asset filenames against `assets/exports/_render-manifest.json`. This is an
offline baseline only; it does not call D1 and does not require
`SOCIAL_PUBLISHER_TOKEN`.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\reconcile-content-queue.ps1
```

## Next production step

When this is moved to Linux, wrap `node scripts/loops-24/run.mjs` with a
systemd timer. Keep this runner as the application-level coordinator so the same
logic can later move to EventBridge Scheduler or Kubernetes CronJob.
