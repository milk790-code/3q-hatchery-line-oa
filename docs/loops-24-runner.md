# LOOPS 24 Runner

This is the first local MVP for the hourly cross-session progress loop.

It implements:

- one-run-at-a-time lock: `.loops/runner.lock`
- persistent state: `.loops/state.json`
- run log: `.loops/runs.jsonl`
- config-driven task discovery: `scripts/loops.tasks.json`
- optional inbox discovery: `.loops/inbox.jsonl`
- dedup fingerprints
- retry state with exponential backoff and jitter
- empty-run heartbeat

## Run Locally

```powershell
node scripts/loops-hourly-runner.mjs --json
```

Dry run without writing state:

```powershell
node scripts/loops-hourly-runner.mjs --dry-run --json
```

Use a temporary state folder for smoke tests:

```powershell
$env:LOOPS_STATE_DIR = "$env:TEMP\loops-24-smoke"
node scripts/loops-hourly-runner.mjs --json
Remove-Item Env:\LOOPS_STATE_DIR
```

## Task Config

Edit `scripts/loops.tasks.json`. Current built-in safe tasks:

- `cloudflare_worker_health`: GET a public Worker `/health` endpoint.
- `http_get`: GET a public HTTP URL.
- `repo_status`: run `git status --short` inside this repo.
- `google_business_prospecting`: import deduped Google Places business prospects into `scripts/outreach.prospects.json`.
- `cold_outreach_batch`: generate a manual-review cold outreach draft batch from `scripts/outreach.prospects.json`.
- `note`: record a progress note.

The runner intentionally does not execute arbitrary shell commands in v1.
The Google prospecting task writes local prospect records only. The cold outreach
task writes drafts only; it never sends LINE, IG, email, phone, or bulk messages.

## Google Business Prospecting

Use the official Google Places API instead of scraping Google Maps pages.

Temporary PowerShell setup:

```powershell
$env:GOOGLE_MAPS_API_KEY = '<paste key for this terminal only>'
```

Preview the configured searches without writing files:

```powershell
node scripts/google-business-prospector.mjs --dry-run --json
```

Import prospects, then generate manual-review outreach drafts:

```powershell
node scripts/google-business-prospector.mjs --max-new 20 --json
node scripts/loops-hourly-runner.mjs --json
```

One-off query:

```powershell
node scripts/google-business-prospector.mjs --query "台中 甜點禮盒" --max-new 10 --json
```

Review outputs:

```text
.loops/google-prospects/
.loops/outreach/
```

Safety gate:

- Use only public business contact channels.
- Manually verify every listing before contact.
- Stop if a business asks not to be contacted.
- Do not store the Google API key in repo files.

## Inbox

Append one JSON object per line to `.loops/inbox.jsonl`.

Example:

```json
{"task_type":"note","source_id":"manual-next-step","priority_base":70,"payload":{"summary":"Review social publisher queue health"}}
```

## Linux systemd Timer Sketch

`/etc/systemd/system/loops-hourly.service`

```ini
[Unit]
Description=LOOPS hourly runner
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/3q-hatchery-line-oa
ExecStart=/usr/bin/node /opt/3q-hatchery-line-oa/scripts/loops-hourly-runner.mjs
Environment=LOOPS_STATE_DIR=/var/lib/loops-24
CPUQuota=50%
MemoryMax=1G
```

`/etc/systemd/system/loops-hourly.timer`

```ini
[Unit]
Description=Wake LOOPS every hour

[Timer]
OnCalendar=hourly
Persistent=true
RandomizedDelaySec=30s
AccuracySec=1s
Unit=loops-hourly.service

[Install]
WantedBy=timers.target
```

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now loops-hourly.timer
sudo systemctl list-timers --all | grep loops-hourly
```
