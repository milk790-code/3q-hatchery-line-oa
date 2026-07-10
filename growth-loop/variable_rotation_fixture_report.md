# Variable Rotation Fixture Report

BLUF: All one-variable rotation fixtures pass. This is a local dry run only.

Generated: 2026-07-10T21:46:06.552Z
Mode: variable_rotation_fixture_dry_run
External effect: no
Live config write performed: no

## Scenarios

| variable | status | drafts | changed values | locked variables ok | changed only ok |
|---|---|---:|---:|---|---|
| hook | ok | 3 | 3 | yes | yes |
| offer | ok | 3 | 3 | yes | yes |
| visual_claim | ok | 3 | 3 | yes | yes |
| cta_text | ok | 3 | 3 | yes | yes |

## Checks

| check | status | evidence |
|---|---|---|
| allowed_variables_exact | ok | Config exposes hook / offer / visual_claim / cta_text in the requested order. |
| all_variables_have_fixture | ok | Every allowed variable has a passing one-variable fixture. |
| live_config_not_mutated | ok | Fixture builds in-memory candidates only; it never rewrites config/growth-loop.config.json. |
| red_line_flags_false | ok | Fixture performs no post, deploy, public link change, LINE push, payment, customer-data mutation, or delete. |

## Red Lines

- Formal post performed: no
- Public link change performed: no
- Production deploy performed: no
- LINE push performed: no
- Customer-data mutation performed: no
- Payment action performed: no
- Delete action performed: no
