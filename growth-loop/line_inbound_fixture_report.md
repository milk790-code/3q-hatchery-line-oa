# LINE Inbound Fixture Report

BLUF: line_inbound_fixture_ok。Fixture-only dry run for LINE inbound customer-service handoff. It performs no LINE send, no customer-data mutation, and no event write.

Generated: 2026-07-10T21:45:56.412Z
Mode: line_inbound_fixture_dry_run
Scenarios: 6
Execution performed: no
External effect: no

## Checks

| check | status | external_effect |
|---|---|---|
| inbound_only_manual_reply | ok | no |
| aggregate_only_no_customer_storage | ok | no |
| required_event_types_mapped | ok | no |
| requested_fields_are_bucket_only | ok | no |
| manual_contract_safe_columns | ok | no |
| manual_contract_allowed_event_types | ok | no |
| one_variable_context_preserved | ok | no |
| red_line_flags_false | ok | no |

## Scenarios

| scenario | status | expected | actual | issues |
|---|---|---|---|---|
| allowed_line_add_count_row | ok | valid | valid | none |
| allowed_lead_submit_count_row | ok | valid | valid | none |
| blocked_phone_column | ok | blocked | blocked | unknown_columns=phone; sensitive_columns=phone; sensitive_values=phone |
| blocked_email_value | ok | blocked | blocked | sensitive_values=source |
| blocked_chat_message_column | ok | blocked | blocked | unknown_columns=message; sensitive_columns=message |
| deal_stays_owner_confirmed_aggregate | ok | valid | valid | none |

## Safety Invariants

- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
- data/lp_events.jsonl write performed: no
