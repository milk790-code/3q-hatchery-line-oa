# Artifact Retention Monitor

BLUF: within_review_budget. Local artifacts currently use 50.2 MB; 0 review warning(s) and 0 owner-only cleanup candidate(s) were found.

Generated: 2026-07-10T21:48:25.435Z
Mode: artifact_retention_monitor_local_only
External effect: no
Delete action performed: no
Cleanup command generated: no
Cleanup command executed: no

## Summary

| area | count | size | warning | owner-only candidates |
|---|---:|---:|---:|---:|
| github_export/bundles | 4 | 31.8 MB | 0 | 0 |
| archive | 4 | 11.8 MB | 0 | 0 |
| logs | 51 | 6.5 MB | 0 | 0 |

## Warnings

- none

## Owner-Only Cleanup Candidates

This monitor never deletes, moves, compresses, or uploads artifacts. Review these candidates manually if local disk pressure matters.

| section | path | size | modified |
|---|---|---:|---|
| none | n/a | n/a | n/a |



## Safety

- Owner review required: no
- Cleanup execution policy: owner_only_manual_cleanup_after_review
- Blocked actions: delete_github_export_bundles, delete_weekly_archives, delete_logs, compress_or_move_artifacts_without_owner_approval
- Production deploy performed: no
- Public link change performed: no
- GitHub push / PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
