# Owner Next Action Fixture Report

BLUF: owner_next_action_fixtures_ok. Fixture-only routing guard for staged aggregate inputs and real-data intake preview states.

Generated: 2026-07-10T21:45:52.238Z
Mode: owner_next_action_fixture
Scenarios: 6
Live project write performed: no
data/lp_events.jsonl write performed: no
External effect: no

| scenario | status | primary action | next actions | command | owner review | data write | external |
|---|---|---|---|---|---|---|---|
| waiting_counts_prioritizes_full_p0_batch_handoff | ok | collect_owner_sample_gate_counts | collect_owner_sample_gate_counts, prepare_public_ab_metadata, check_owner_download_intake | `open sample_gate_batch_handoff.md` | no | no | no |
| staged_next_p0_prompts_real_data_preview | ok | preview_staged_real_data_inputs | preview_staged_real_data_inputs, prepare_public_ab_metadata, review_sample_gate_status | `npm run real-data:intake` | no | no | no |
| real_data_preview_ready_prompts_owner_apply_review | ok | review_real_data_apply | review_real_data_apply, prepare_public_ab_metadata, review_sample_gate_status | `open real_data_intake_plan.md` | yes | no | no |
| real_data_input_attention_blocks_apply | ok | fix_real_data_input_preview | fix_real_data_input_preview, prepare_public_ab_metadata, review_sample_gate_status | `npm run real-data:intake` | no | no | no |
| partial_quick_counts_keep_collect_action | ok | collect_owner_sample_gate_counts | collect_owner_sample_gate_counts, prepare_public_ab_metadata, check_owner_download_intake | `open data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt` | no | no | no |
| invalid_p0_counts_prioritize_fix_card | ok | fix_invalid_p0_counts | fix_invalid_p0_counts, prepare_public_ab_metadata, review_sample_gate_status | `open p0_counts_preflight.md` | no | no | no |

## Covered Routes

- staged_next_p0_prompts_real_data_preview
- real_data_preview_ready_prompts_owner_apply_review
- real_data_input_attention_blocks_apply
- partial_quick_counts_keep_collect_action
- invalid_p0_counts_prioritize_fix_card
- prepare_public_ab_metadata_secondary_action

## Safety Invariants

- Production deploy performed: no
- Public link change performed: no
- GitHub push or PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer-data mutation performed: no
- Payment action performed: no
- Delete action performed: no
