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

By default, `run.ps1` calls `run.mjs --auto-complete`. Auto-complete is limited
to local, review-ready artifacts:

- worktree snapshots
- commit boundary plans
- slice handoffs and stage scripts
- frontend/artifact review reports
- frontend slice handoffs and stage scripts
- content queue reconciliation reports
- Wrangler cache audit reports
- cold outreach drafts only when prospects are eligible

It stops at review gates for secrets, tokens, deploy approval, outbound sending,
and broad frontend/artifact payloads.

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

Default state path:

```text
%USERPROFILE%\.codex\automations\loops-24\
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
