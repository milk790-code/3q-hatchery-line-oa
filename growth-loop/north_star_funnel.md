# 3Q North Star Funnel

BLUF: No real events are present yet, so the North Star funnel is ready to measure but not ready to declare a winner. No public link, production deploy, formal post, LINE push, payment, customer-data mutation, or deletion was performed.

Generated: 2026-07-10T21:47:21.383Z
Mode: north_star_funnel_local_only
Week: 2026-06-29 to 2026-07-05
Status: waiting_for_owner_sample_gate_counts

## North Star

Every 100 link clicks -> LINE adds -> leads -> deals.

| scope | role | asset_id | content_id | variant_id | clicks | LINE adds | leads | deals | LINE / 100 clicks | leads / 100 clicks | deals / 100 clicks | sample met |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| total | all_assets | all_assets |  |  | 0 | 0 | 0 | 0 | n/a | n/a | n/a | no |
| asset | champion | champion-3q-line-v0 |  | champion-3q-line-v0 | 0 | 0 | 0 | 0 | n/a | n/a | n/a | no |
| asset | challenger | challenger-week0-cta-text-v1 |  | challenger-week0-cta-text-v1 | 0 | 0 | 0 | 0 | n/a | n/a | n/a | no |
| attribution | content_variant | challenger-week0-cta-text-v1 | week0-post-001 | cta-v1-diagnostic | 0 | 0 | 0 | 0 | n/a | n/a | n/a | no |
| attribution | content_variant | challenger-week0-cta-text-v1 | week0-post-002 | cta-v2-audit | 0 | 0 | 0 | 0 | n/a | n/a | n/a | no |
| attribution | content_variant | challenger-week0-cta-text-v1 | week0-post-003 | cta-v3-sample | 0 | 0 | 0 | 0 | n/a | n/a | n/a | no |
| attribution | challenger | challenger-week0-cta-text-v1 | 2026-06-29-challenger | challenger-week0-cta-text-v1 | 0 | 0 | 0 | 0 | n/a | n/a | n/a | no |
| attribution | line_cta | challenger-week0-cta-text-v1 | 2026-06-29-line-cta | challenger-week0-cta-text-v1-line | 0 | 0 | 0 | 0 | n/a | n/a | n/a | no |
| attribution | ab_small_traffic | champion-3q-line-v0:challenger-week0-cta-text-v1 | 2026-06-29-ab-router | champion-3q-line-v0:challenger-week0-cta-text-v1 | 0 | 0 | 0 | 0 | n/a | n/a | n/a | no |

## Sample Gate

- Sample threshold met: no
- Challenger final win rule met: no
- Quality guard: not_evaluated_from_sample_gate
- Owner review required: no
- Promotion performed: no
- Remaining visits: 100
- Remaining CTA clicks: 20
- Remaining LINE adds: 5
- Remaining test days: 3

## Safety

- data/lp_events.jsonl write performed: no
- Real events unchanged: yes
- Public link change performed: no
- Production deploy performed: no
- Formal post performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
