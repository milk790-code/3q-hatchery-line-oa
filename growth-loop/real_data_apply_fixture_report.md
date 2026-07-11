# Real Data Apply Fixture Report

BLUF: real_data_apply_fixtures_ok. Fixture-only guard against accidentally scoring example or unconfirmed aggregate rows.

Generated: 2026-07-10T21:44:11.209Z
Mode: real_data_apply_fixture_dry_run
Scenarios: 4
Execution performed: no
Real event write performed: no
data/lp_events.jsonl write performed: no
External effect: no

| scenario | status | importer | exit | importer_mode | example_detected | confirm_real_data | data_write |
|---|---|---|---:|---|---|---|---|
| funnel_apply_requires_confirm_real_data | ok | funnel | 2 | blocked | no | no | no |
| funnel_copied_example_never_applies | ok | funnel | 2 | blocked | yes | yes | no |
| manual_apply_requires_confirm_real_data | ok | manual | 2 | blocked | no | no | no |
| manual_copied_example_never_applies | ok | manual | 2 | blocked | yes | yes | no |

## Covered Gates

- funnel_apply_requires_confirm_real_data
- funnel_copied_example_never_applies
- manual_apply_requires_confirm_real_data
- manual_copied_example_never_applies

## Safety Invariants

- Production deploy performed: no
- Public link change performed: no
- GitHub push or PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
