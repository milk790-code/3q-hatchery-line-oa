# D1 Collection Guard

BLUF: D1 export is review-only and must not be used as sample-gate input yet.

- Scope: local
- Rows exported: 0
- Synthetic / smoke rows: 0
- Real event candidate rows: 0
- Scoring input allowed: no
- Local review only: yes
- data/lp_events.jsonl write performed: no
- Remote read performed: no
- External effect: no
- Output: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/data/lp_events.d1-local.jsonl

## Row Classification Preview

| event_id | asset_id | event_type | smoke/local | reason |
|---|---|---|---|---|
| n/a | n/a | n/a | n/a | n/a |

## Policy

- Local D1 exports are evidence for local Worker smoke and route checks only.
- Sample-gate scoring must use owner-reviewed real aggregate input or an owner-approved remote D1 export.
- This command does not deploy, post, push LINE, change public links, mutate customer data, process payments, or delete data.
