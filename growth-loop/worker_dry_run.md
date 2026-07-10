# Candidate Worker Dry Run

BLUF: worker_dry_run_ok. The candidate Worker bundle and expected bindings were checked with `wrangler deploy --dry-run`; no production deploy, upload, public link change, LINE action, payment, customer-data mutation, or deletion was performed.

Generated: 2026-07-10T21:46:10.124Z
Command: `wrangler deploy --dry-run`
Exit code: 0
Log: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/logs/worker-dry-run-20260710T214607Z.log
Total upload: Total Upload: 36.40 KiB / gzip: 10.03 KiB

## Safety

- External effect: no
- Production deploy performed: no
- Public link change performed: no
- Formal post performed: no
- LINE push performed: no
- Customer-data mutation performed: no
- Payment action performed: no
- Delete action performed: no

## Required Markers

| marker | present |
|---|---|
| `--dry-run: exiting now.` | yes |
| `Total Upload:` | yes |
| `env.DB` | yes |
| `3q-growth-loop-candidate` | yes |
| `env.ENVIRONMENT` | yes |
| `env.PUBLIC_BASE_URL` | yes |
| `env.CHAMPION_URL` | yes |
| `env.CHAMPION_ORIGIN` | yes |
| `env.CHALLENGER_URL` | yes |
| `env.LINE_URL` | yes |
| `env.AB_TEST_ID` | yes |
| `env.CHAMPION_ASSET_ID` | yes |
| `env.CHALLENGER_ASSET_ID` | yes |
| `env.AB_CHALLENGER_PERCENT` | yes |
