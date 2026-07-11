# 3Q Growth Loop Objective Sequence Audit

BLUF: objective_contract_ok。This local audit checks the user's original weekly sequence, one-variable rule, sample gate, win rule, outputs, approval queue, and hard red lines. It performs no external action.

Generated: 2026-07-10T21:48:27.037Z
Status: local_objective_contract_verified_external_gated
External effect: no

## Requested Weekly Sequence

1. collect_data
2. score_assets
3. winners_losers
4. content_mix
5. generate_lp_challenger
6. deploy_candidate_worker
7. create_ab_plan
8. weekly_report
9. approval_queue

## North Star Per 100 Clicks

| asset | role | clicks | LINE adds / 100 | leads / 100 | deals / 100 | decision |
|---|---:|---:|---:|---:|---:|---|
| champion-3q-line-v0 | champion | 0 | n/a | n/a | n/a | keep_champion_until_challenger_beats_rule |
| challenger-week0-cta-text-v1 | challenger | 0 | n/a | n/a | n/a | keep_testing_sample_insufficient |

## North Star Funnel Contract

- Status: ok
- Mode: north_star_funnel_local_only
- Path: link_click -> line_add -> lead_submit -> deal
- Primary metric: line_adds_per_100_clicks
- Link clicks: 0
- LINE adds: 0
- Leads: 0
- Deals: 0
- LINE adds / 100 clicks: n/a
- Leads / 100 clicks: n/a
- Deals / 100 clicks: n/a
- Sample threshold met: no
- Challenger final win rule met: no
- Promotion performed: no
- Real events unchanged: yes
- data/lp_events.jsonl write performed: no
- External effect: no

## Funnel Attribution Contract

- Status: ok
- Mode: content_variant_attribution
- Rows: 6
- Content variant links: 3
- Real events: 0
- External effect: no
- Public link change performed: no
- Formal post performed: no

## Variable Rotation Fixtures

- Status: ok
- Mode: variable_rotation_fixture_dry_run
- Scenarios: 4
- Candidate templates: 12
- Live config write performed: no
- External effect: no

| variable | status | drafts | changed values | locked variables ok | changed only ok |
|---|---|---:|---:|---|---|
| hook | ok | 3 | 3 | yes | yes |
| offer | ok | 3 | 3 | yes | yes |
| visual_claim | ok | 3 | 3 | yes | yes |
| cta_text | ok | 3 | 3 | yes | yes |

## Contract Checks

| check | status | evidence |
|---|---|---|
| config_weekly_sequence_exact | ok | config/growth-loop.config.json matches the requested Sunday sequence. |
| weekly_runner_lock_policy_fixtures | ok | Lock fixtures prove a live PID always owns the run regardless of age and only dead/invalid owners are recovered. |
| pipeline_weekly_sequence_exact | ok | pipeline_status.json preserves the requested sequence. |
| pipeline_steps_exact_order | ok | pipeline_status.json has one evidence row per requested step. |
| weekly_runner_concurrency_guard | ok | Weekly runner uses an atomic process lock and atomic status replacement so overlapping manual, LaunchAgent, or agent invocations cannot corrupt the authoritative run state. |
| all_requested_outputs_present | ok | All objective output artifacts exist. |
| north_star_event_types_scored | ok | Scores include link clicks, LINE adds, leads, and deals. |
| north_star_funnel_contract | ok | North Star funnel reports LINE adds, leads, and deals per 100 link clicks without event writes or external effects. |
| one_variable_allowed | ok | The changed variable is one of hook / offer / visual_claim / cta_text. |
| one_variable_consistent | ok | Content drafts only change the active variable. |
| one_variable_rotation_fixtures_cover_all_variables | ok | Fixture-only rotation coverage proves hook, offer, visual_claim, and cta_text can each vary alone. |
| content_variant_tracking_unique | ok | Each draft has a unique post-level tracking link and content attribution row. |
| sample_gate_exact | ok | Sample thresholds match the objective. |
| next_round_keeps_variable_when_sample_insufficient | ok | Sample-insufficient rounds keep the current champion and variable. |
| win_rule_exact | ok | Win rule requires 1.15 lift, sample threshold, and no quality regression. |
| winning_challenger_never_auto_promotes | ok | Winning challenger can only be queued for human review. |
| ab_small_traffic_local_only | ok | A/B plan is 90/10 and does not change public links. |
| manual_conversion_preview_only | ok | Manual conversion import remains preview-only. |
| line_inbound_playbook_aggregate_only | ok | LINE inbound playbook stays manual, inbound-only, aggregate-only, and blocks sensitive customer fields. |
| event_input_quality_gate | ok | Real lp_events input is scanned for PII, unknown assets, duplicates, and malformed rows before scoring. |
| funnel_aggregate_preview_only | ok | Full-funnel aggregate import previews top-to-bottom event counts without scoring or writing real lp_events. |
| funnel_aggregate_fixtures_cover_import_gates | ok | Full-funnel aggregate fixtures block unknown assets, missing attribution, sensitive columns, sensitive values, and unsafe apply attempts. |
| real_data_apply_fixtures_block_examples | ok | Real-data apply fixtures block unconfirmed apply commands and copied example/template CSVs before they can write data/lp_events.jsonl. |
| real_data_input_pack_template_only | ok | Real-data input pack creates fill templates only and never creates live input CSVs or writes data/lp_events.jsonl. |
| source_readiness_covers_funnel_stages | ok | Source readiness covers every north-star funnel event stage and remains read-only. |
| champion_contract_audit_blocks_false_leads | ok | Live champion URL and LINE destination are observed read-only; local-only success UI is never counted as a lead. |
| champion_integration_candidate_source_locked | ok | Source-locked 3q-site candidate removes false-success lead UI and prepares no-PII page_view/cta_click telemetry without deployment. |
| champion_source_lock_fixture_matrix | ok | Isolated fixtures prove pinned-ref, ancestry, target-drift, tuple-integrity, and missing-repo fail-closed behavior. |
| cloudflare_d1_metadata_readiness | ok | Read-only D1 metadata inventory detects whether the dedicated Growth Loop database exists without querying tables, reading customer data, or reusing CRM databases. |
| live_telemetry_chain_observed_and_owner_gated | ok | Live observation mirrors the validated Candidate/Champion/D1 evidence state while keeping all reads aggregate-only and any redeploy separately gated. |
| live_telemetry_readiness_fixture_states | ok | Fixture states prove deployment observation, schema evidence, and recurring aggregate-read authorization are independent without a live network refresh, table query, event POST, or external effect. |
| d1_schema_idempotency_contract | ok | Week 0 D1 schema applies twice in disposable local state and passes integrity, seed, and constraint checks without remote D1 access. |
| approved_d1_config_guard_preview | ok | D1 id config guard remains preview-only until explicit owner approval and exact live metadata match. |
| d1_collection_selector_defaults_local | ok | Weekly collect_data stays local until matching evidence exists, then permits only the approved aggregate-only remote path. |
| d1_collection_selector_fixture_gates | ok | Plan-only fixtures prove only matching owner evidence, recurring-read approval, and post-gate readiness select remote aggregate collection. |
| d1_remote_export_aggregate_only_fixture | ok | Fixture Wrangler proves the approved remote path reads grouped counts only and excludes raw session, URL, referrer, metadata, and customer fields. |
| champion_local_feature_commit | ok | Champion release stack descends from the exact source lock, changes only the Worker and optional binding-preservation workflow, and this audit performs no GitHub write. |
| champion_release_preflight_clean_source | ok | Champion patch applies to a clean git archive or locked snapshot, matches the generated candidate byte-for-byte, and passes both Wrangler dry-run command shapes with an owner-gated rollback packet. |
| champion_github_handoff_exact_and_gated | ok | Champion GitHub handoff targets the exact known repo, branch, and commit, stops at a draft PR, and performs no GitHub write. |
| source_capture_pack_template_only | ok | Source capture pack maps tracking links and funnel stages to aggregate-only owner capture rows without creating live inputs or writing data/lp_events.jsonl. |
| sample_gate_replay_fixtures_cover_fast_path | ok | Sample-gate replay fixtures prove the 18-row owner-filled fast path can compile and preview sample decisions without writing data/lp_events.jsonl. |
| source_capture_compile_preview_only | ok | Source capture compile validates filled owner ledgers and emits owner-preview CSVs without creating live inputs or writing data/lp_events.jsonl. |
| source_capture_compile_fixtures_cover_gates | ok | Source capture compile fixtures cover valid filled rows, empty templates, partial blanks, PII, bad dates, and invalid target files. |
| real_data_intake_plan_owner_gated | ok | Real-data intake plan checks reviewed aggregate CSVs and produces owner-gated local apply commands without writing data/lp_events.jsonl. |
| data_collection_brief_owner_queue | ok | Data collection brief converts missing funnel-stage source data into owner-reviewed aggregate-count tasks without creating live inputs or writing data/lp_events.jsonl. |
| source_trust_matrix_blocks_untrusted_inputs | ok | Source trust matrix separates scoring-ready inputs from local D1 smoke rows and owner-preview artifacts before sample-gate decisions. |
| next_p0_owner_form_safe | ok | Focused Next P0 browser form exposes only the current owner aggregate rows, exports review files locally, and performs no network calls, staging, or event writes. |
| next_p0_owner_form_fixtures_safe | ok | Focused Next P0 browser form fixture verifies local-only HTML, aggregate-only export contract, and false red-line flags. |
| next_p0_owner_intake_preview_only | ok | Focused Next P0 owner-download intake validates aggregate CSVs and emits owner-preview CSVs without event writes or external effects. |
| next_p0_owner_intake_fixtures_safe | ok | Focused Next P0 intake fixtures cover valid preview, quick-preview auto-intake, sensitive blocking, and confirmed temp staging without writing project live inputs. |
| owner_data_preflight_local_only | ok | Owner data preflight previews sample-gate and win-rule decisions from aggregate preview CSVs without applying data or executing external gates. |
| sample_gate_capture_calendar_local_only | ok | Sample-gate capture calendar turns Day 3 / Day 7 checkpoints into local-only review artifacts without importing calendars or creating reminders. |
| sample_gate_due_status_local_only | ok | Sample-gate due status turns Day 3 / Day 7 timing into a local operator signal without importing calendars, opening browsers, writing events, or changing winners. |
| week0_owner_capture_queue_shortens_sample_gate_collection | ok | Week 0 owner capture queue reduces collection to P0 sample-gate counts and remains local-only. |
| owner_sample_gate_status_keeps_promotion_blocked | ok | Owner sample-gate status reads filled aggregate counts, reports threshold gaps, and never promotes or applies data automatically. |
| sample_gate_owner_worksheet_safe | ok | Owner sample-gate worksheet covers 18 P0 rows and remains local-only. |
| sample_gate_owner_form_safe | ok | Owner sample-gate browser form covers 18 P0 rows, exports local files only, and performs no network calls or event writes. |
| sample_gate_owner_form_fixtures_safe | ok | Owner sample-gate browser form fixtures replay downloaded CSVs through source compile and owner sample-gate status without live writes or promotion. |
| sample_gate_batch_handoff_full_p0_coverage | ok | P0 sample-gate batch handoff maps the full 18-row coverage into focused and remaining owner-count batches without event writes or external effects. |
| sample_gate_collection_sprint_local_only | ok | Sample-gate collection sprint turns due state and P0 gaps into a local owner queue without event writes or external effects. |
| owner_sample_gate_fixtures_cover_decision_paths | ok | Owner sample-gate fixtures cover missing, partial, insufficient, winning-review, underperform, and sensitive-evidence paths without real writes or promotion. |
| owner_quality_review_gate_local_only | ok | Owner quality review validates aggregate no-quality-regression evidence after a sample-rate winner and still never promotes. |
| owner_quality_review_form_safe | ok | Owner quality-review browser form exports local aggregate JSON only and performs no network calls, event writes, approval queue writes, or promotion. |
| owner_quality_review_form_fixtures_safe | ok | Owner quality-review browser form fixtures replay downloaded JSON through quality review without live writes, approval queue writes, or promotion. |
| owner_quality_review_fixtures_cover_quality_paths | ok | Owner quality-review fixtures cover waiting, missing evidence, passing evidence, regression, sensitive evidence, and missing fields without external effects. |
| candidate_retirement_fixtures_cover_rotation_paths | ok | Candidate retirement fixtures cover sample-insufficient keep-testing, owner promotion review, underperforming retirement, quality-regression retirement, unknown candidates, and mixed summaries without deletion or external effects. |
| iteration_history_local_only | ok | Iteration history records the 7-day loop status, sample gate, archive history, and next safe actions without external effects. |
| worker_dry_run_no_deploy | ok | Candidate Worker dry-run validates the bundle and bindings while preserving no-deploy and no-external-effect flags. |
| browser_smoke_no_event_write | ok | Browser route smoke is local and does not write events. |
| tracking_link_smoke_covers_generated_links | ok | Generated tracking links redirect correctly in isolated local smoke without following external URLs or writing real events. |
| event_contract_smoke_isolated | ok | Worker /e writes expected synthetic funnel events into isolated local D1, rejects sensitive metadata, and preserves redirect attribution. |
| champion_integration_smoke_isolated | ok | 3q-site candidate and collector pass a two-Worker localhost smoke with exact-origin CORS, no sensitive rows, and no inferred line_add. |
| win_rule_fixtures_cover_gates | ok | Win-rule fixtures cover sample insufficient, winner review only, underperform, and quality regression. |
| real_data_decision_replay_covers_import_to_decision | ok | Real-data-shaped filled source-capture ledgers compile to owner-preview aggregate CSVs, then replay through scoring, A/B decision, and next-round planning without writing data/lp_events.jsonl. |
| sunday_local_schedule | ok | Local weekly schedule targets Sunday and weekly:local. |
| launchagent_runtime_proof | ok | The installed macOS LaunchAgent has completed at least one real weekly runner invocation with exit code 0. |
| schedule_catchup_monitor_local_only | ok | Local catch-up monitor detects missed weekly windows without invoking weekly:local or external actions. |
| approval_queue_has_required_gates | ok | Approval queue includes every unresolved review or external gate and may retire the first-event item after trusted events arrive. |
| approval_resume_fixtures_plan_only | ok | Owner approval resume fixtures stay dry-run only and cover placeholders, valid metadata, secret rejection, URL validation, and manual-only gates. |
| owner_approval_form_safe | ok | Owner approval browser form exports non-secret approval metadata only and performs no network call, live input write, gate execution, deploy, GitHub, public link, LINE, payment, customer-data, or delete action. |
| owner_approval_form_fixtures_plan_only | ok | Owner approval form fixtures replay exports through the dry-run resume planner, block placeholders and sensitive metadata, and never create live input files or execute external actions. |
| owner_gate_evidence_intake_evidence_only | ok | Owner gate evidence intake validates non-secret post-gate metadata only and performs no external action. |
| owner_gate_evidence_fixtures_cover_intake_gates | ok | Owner gate evidence fixtures cover missing, placeholder, valid, sensitive, invalid A/B, duplicate, manual-only, and invalid GitHub evidence without external action. |
| post_gate_verification_plan_local_only | ok | Post-gate verification remains local-only and performs no network, remote CLI, deploy, push, public link, LINE, payment, customer-data, or delete action. |
| post_gate_verification_fixtures_cover_plan_gates | ok | Post-gate verification fixtures separate schema evidence readiness from recurring-read authorization while covering dependencies, manual-only gates, and invalid evidence without external action. |
| github_export_bundle_local_only | ok | GitHub export bundle is repo-ready locally, excludes live owner inputs, and performs no git init, commit, push, PR, deploy, send, payment, customer-data, or delete actions. |
| artifact_retention_monitor_local_only | ok | Artifact retention monitor reports local bundle/archive/log growth for owner review without generating or executing cleanup commands. |
| artifact_retention_review_pack_local_only | ok | Artifact retention review pack converts monitor output into owner-only cleanup review without commands, mutation, deletion, or external effects. |
| github_actions_weekly_verify_only | ok | GitHub Actions workflow is prepared for weekly verify/artifact upload only, with no deploy, push, LINE, payment, customer-data, or delete step. |
| prepared_but_blocked_has_required_redlines | ok | PreparedButBlocked includes current-state red-line actions without asking for duplicate resource creation. |
| redline_priority_covers_blocked_queue | ok | Red-line priority queue covers every PreparedButBlocked action and keeps external gates non-autorun. |
| launch_readiness_owner_gated | ok | Launch readiness remains owner-gated. |
| red_line_flags_false | ok | No local artifact claims prohibited external actions. |

## Candidate Worker Dry Run

- Status: ok
- Mode: worker_deploy_dry_run_status
- Command: wrangler deploy --dry-run
- Exit code: 0
- Dry-run exit observed: yes
- Required markers present: yes
- Production deploy performed: no
- External effect: no
- Report: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/worker_dry_run.md
- Log: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/logs/worker-dry-run-20260710T214607Z.log

## Cloudflare D1 Readiness

- Status: dedicated_d1_bound_owner_migration_review_required
- Inventory checked: 2026-07-10T21:43:33.424Z
- Total databases observed: 14
- Exact dedicated matches: 1
- Dedicated database present: yes
- Config placeholder ID: no
- Remote table query performed: no
- Customer data read performed: no
- Resource create performed: no

## Live Telemetry Readiness

- Status: live_chain_observed_owner_provenance_and_schema_evidence_required
- Snapshot checked: 2026-07-10T21:43:37.059Z
- Candidate deployment observed: yes
- Candidate deployment / version: 5073984b-bcc0-40f1-a331-daaadd741071 / 133d27b0-36e5-41e8-96ec-b55925b7b30a
- Candidate operation: verify_existing_candidate_deployment
- Candidate deploy required: no
- Champion collector origin matches: yes
- Privacy event contract: ok
- D1 inventory-reported num_tables: 0 (not authoritative)
- Schema absence inferred from inventory: no
- Schema evidence valid: no
- Recurring aggregate read approved: no
- Live ingest readiness proven: no
- Weekly aggregate read authorized: no
- Fixture scenarios: 6
- Fixture live network refresh: no
- Remote table query performed: no
- Event POST performed: no
- External effect: no

## D1 Automatic Collection Gate

- Status: local_review_collection_completed
- Selected scope: local_review_only
- Remote read authorized: no
- Recurring aggregate read approved: no
- Collection executed: yes
- Remote read performed: no
- Raw event rows read: no
- Customer data read: no
- Selector fixture scenarios: 5
- Approved aggregate plan covered: yes
- Aggregate exporter fixture scenarios: 2
- Grouped SQL covered: yes
- Real remote CLI performed by fixtures: no

## Champion Local Feature Commit

- Status: integration_already_merged_at_source_lock
- Branch: codex/3q-growth-loop-champion-v1
- Commit: 9b6fd00c082f2b67d6cde159e61dc6c407d02ea0
- Parent: 355981c978bdb1c93a29bb89ae700fda7b41cac0
- Changed paths: .github/workflows/deploy-3q-line-oa.yml, .github/workflows/deploy-fleet-sentinel.yml, .github/workflows/deploy-pop-line-oa.yml, .github/workflows/deploy-tudigong.yml, brands/popmonster.json, workers/3q-line-oa/worker.js, workers/fleet-sentinel/worker.js, workers/outreach/worker.js, workers/pop-line-oa/worker.js, workers/pop-sales-ai/worker.js, workers/sales-ai/worker.js, workers/tudigong-sales-ai/worker.js, workers/tudigong/worker.js
- Remote branch present: yes
- Git push performed: no
- GitHub push / PR performed: no

## Champion Release Preflight

- Status: ok
- Mode: clean_archive_champion_release_preflight_local_only
- Source mode: git_ref_pinned
- Source repository unchanged: yes
- Patch byte-identical: yes
- Wrangler dry-run: pass
- Production CLI template dry-run: pass
- Live snapshot checked: 2026-07-10T14:39:57.325Z
- Live version: de2997a0-6a6a-4780-9e24-e65774dc3f1a
- Live false-success state present: no
- Rollback target: de2997a0-6a6a-4780-9e24-e65774dc3f1a
- Owner gates: 4
- Local branch commit: 9b6fd00c082f2b67d6cde159e61dc6c407d02ea0
- Collector readiness: dedicated_d1_bound_owner_migration_review_required
- Source repo write performed: no
- Production deploy performed: no
- External effect: no

## Tracking Link Smoke

- Status: ok
- Mode: isolated_local_tracking_link_smoke
- Links checked: 7/7
- Isolated link_click events written: 7
- Checks passed: 7
- Real event write performed: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Event Contract Smoke

- Status: ok
- Mode: isolated_local_event_contract_smoke
- Synthetic event counts: {"cta_click":1,"page_view":1}
- Sensitive metadata rejected: yes
- Invalid event rejected: yes
- Redirect attribution preserved: yes
- A/B redirect attribution preserved: yes
- Scheduled quality regression rejected: yes
- Scheduled quality regression decision: reject_quality_regression
- Real event write performed: no
- data/lp_events.jsonl write performed: no

## Event Input Quality Gate

- Status: ok
- Mode: real_event_input_quality_gate
- Rows scanned: 0
- Issues: 0
- Scoring allowed: yes
- Sensitive data detected: no
- data/lp_events.jsonl write performed: no

## Full Funnel Aggregate Preview

- Status: ok
- Mode: full_funnel_preview
- Events written: 48
- Event counts: {"link_click":20,"page_view":17,"cta_click":6,"line_add":2,"lead_submit":1,"deal":1,"quality_flag":1}
- Sensitive columns: no
- Sensitive values: no
- Apply performed: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Full Funnel Aggregate Fixtures

- Status: ok
- Mode: funnel_aggregate_fixture_dry_run
- Scenarios: 6
- Execution performed: no
- Real event write performed: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Real Data Apply Fixtures

- Status: ok
- Mode: real_data_apply_fixture_dry_run
- Scenarios: 4
- Execution performed: no
- Real event write performed: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Real Data Decision Replay

- Status: ok
- Mode: real_data_decision_replay_fixture_dry_run
- Scenarios: 6
- Source capture ledger replay executed: yes
- Source capture compile commands executed: yes
- Ledger-to-decision replay performed: yes
- Local importer preview commands executed: yes
- Execution performed: no
- Real event write performed: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Sample Gate Replay Fixtures

- Status: ok
- Mode: sample_gate_replay_fixture_dry_run
- Template rows: 18
- Scenarios: 3
- Sample-gate ledger replay executed: yes
- Source capture compile commands executed: yes
- Importer preview commands executed: yes
- Execution performed: no
- Real event write performed: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Real Data Input Pack

- Status: ok
- Mode: real_data_input_pack
- Pack status: template_ready
- Template only: yes
- Templates: 2
- Live input files created: no
- Real events unchanged: yes
- data/lp_events.jsonl write performed: no
- External effect: no

## Source Readiness

- Status: ok
- Mode: source_readiness_monitor
- Readiness status: waiting_for_real_data
- Real event rows: 0
- Missing stages: 7
- Sample threshold met: no
- Ready for public iteration decision: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Source Capture Pack

- Status: ok
- Mode: source_capture_pack
- Capture status: waiting_for_owner_aggregate_capture
- Tracking links: 6/7
- A/B router gates held out: 1
- Funnel stages: 7
- Ledger rows: 42
- Sample-gate ledger rows: 18
- Template only: yes
- Live input files created: no
- Real events unchanged: yes
- data/lp_events.jsonl write performed: no
- External effect: no

## Source Capture Compile Preview

- Status: ok
- Mode: source_capture_compile_preview
- Compile status: waiting_for_filled_counts
- Input kind: template
- Ledger rows read: 42
- Filled rows: 0
- Funnel preview rows: 0
- Manual preview rows: 0
- Issues: 0
- Owner review required: yes
- Live input files created: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Source Capture Compile Fixtures

- Status: ok
- Mode: source_capture_compile_fixture_dry_run
- Scenarios: 7
- Local fixture commands executed: yes
- Execution performed: no
- Real event write performed: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Real Data Intake Plan

- Status: ok
- Mode: real_data_intake_plan
- Intake status: no_real_input_files
- Ready apply commands: 0
- Missing inputs: 2
- Blocked inputs: 0
- Real events unchanged: yes
- data/lp_events.jsonl write performed: no
- External effect: no

## Data Collection Brief

- Status: ok
- Mode: data_collection_brief
- Brief status: waiting_for_owner_aggregate_counts
- Tasks: 42
- Stage count: 7
- Importable links: 6
- Gated links: 1
- Sample gate: waiting_for_sample_gate_counts / p0_tasks=18 / p0_links=6
- Filled ledger exists: no
- Sample threshold met: no
- Missing stages: 7
- Real events unchanged: yes
- Live input files created: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Data Collection Progress

- Status: ok
- Mode: data_collection_progress
- Progress status: waiting_for_p0_sample_gate_counts
- Tasks filled: 0/42
- Pending tasks: 42
- P0 pending: 18
- P1 pending: 24
- Next owner inputs: 9
- Live input files created: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Next P0 Owner Inputs

- Status: ok
- Mode: next_p0_owner_inputs
- Input status: waiting_for_p0_owner_inputs
- Current inputs: 9
- P0 pending: 18
- P1 pending: 24
- Source groups: 2
- Recommended open command: open next_p0_owner_form.html
- Live input files created: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Next P0 Owner Form

- Status: ok
- Mode: next_p0_owner_form
- Form status: ready_local_next_p0_owner_form
- Rows: 9
- Source groups: 2
- Download filename: next_p0_owner_inputs.filled.csv
- JSON download filename: next_p0_owner_inputs.review.json
- Browser only: yes
- Browser persistence: no
- Network calls performed: no
- Live input files created: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Next P0 Owner Form Fixtures

- Status: ok
- Mode: next_p0_owner_form_fixture_dry_run
- Rows: 9/9
- Scenarios: 4
- Static checks executed: yes
- Export contract verified: yes
- Live input files created: no
- data/lp_events.jsonl write performed: no
- External effect: no
- Scenario IDs: html_contains_all_focused_inputs, no_network_or_browser_persistence, exports_aggregate_only_review_contract, red_line_flags_false

## Next P0 Owner Intake

- Status: ok
- Mode: next_p0_owner_intake
- Intake status: waiting_for_next_p0_owner_download
- Candidate found: no
- Candidate valid: no
- Expected rows: 9
- Downloaded rows: 0
- Filled rows: 0
- Funnel preview rows: 0
- Manual preview rows: 0
- Stage performed: no
- Live input files created: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Next P0 Owner Intake Fixtures

- Status: ok
- Mode: next_p0_owner_intake_fixture_dry_run
- Rows: 9
- Scenarios: 5
- Local fixture commands executed: yes
- Live project inputs created: no
- data/lp_events.jsonl write performed: no
- External effect: no
- Scenario IDs: valid_download_preview_ready, quick_preview_auto_intake_ready, sensitive_evidence_blocked, stage_without_confirmation_blocked, confirmed_stage_writes_temp_live_inputs_only

## Owner Data Preflight

- Status: ok
- Mode: owner_data_preflight_local_only
- Preflight status: waiting_for_owner_preview_rows
- Selected source: next_p0_owner_intake
- Preview rows: 0
- Preview event total: 0
- Sample threshold met: no
- No quality regression: yes
- Challenger win rule met: no
- Next round decision: continue_current_round_until_sample_threshold
- Owner review required: yes
- Real events unchanged: yes
- data/lp_events.jsonl write performed: no
- External effect: no

## Sample Gate Capture Calendar

- Status: ok
- Mode: sample_gate_capture_calendar
- Calendar status: waiting_for_owner_sample_gate_counts
- Events: 3
- Next due: 2026-07-05 / preferred_sample_check_day7
- P0 inputs: 9
- P0 pending: 18
- Progress status: waiting_for_p0_sample_gate_counts
- Calendar import performed: no
- System reminder created: no
- Browser open performed: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Sample Gate Due Status

- Status: ok
- Mode: sample_gate_due_status
- Due status: day7_due_waiting_for_owner_counts
- Today: 2026-07-11
- Minimum check: 2026-07-01
- Preferred check: 2026-07-05
- Due: 2026-07-05 / preferred_sample_check_day7 / now=yes
- Due phase: preferred_check_due
- P0 inputs: 9
- P0 pending: 18
- Progress status: waiting_for_p0_sample_gate_counts
- Capture calendar: waiting_for_owner_sample_gate_counts / next=2026-07-05 / event=preferred_sample_check_day7
- Champion action: keep_champion_sample_insufficient
- Challenger promotion allowed: no
- Next variable rotation allowed: no
- Calendar import performed: no
- System reminder created: no
- Browser open performed: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Week 0 Owner Capture Queue

- Status: ok
- Mode: week0_owner_capture_queue
- Queue status: waiting_for_owner_sample_gate_counts
- P0 tasks: 18
- P0 links: 6
- Source groups: 2
- Owner fill path: data/source_capture/sample_gate_ledger.filled.csv
- Next safe command: npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled
- Live input files created: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Owner Sample Gate Status

- Status: ok
- Mode: owner_sample_gate_status
- Gate status: waiting_for_owner_sample_gate_counts
- Input exists: no
- Filled rows: 0
- Pending rows: 18
- Sample threshold met: no
- Sample-rate win candidate: no
- Challenger final win rule met: no
- Quality guard: not_evaluated_from_sample_gate
- Decision: continue_collecting_sample_gate_counts
- Promotion performed: no
- Live input files created: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Owner Quality Review

- Status: ok
- Mode: owner_quality_review
- Gate status: waiting_for_sample_rate_candidate
- Owner sample gate status: waiting_for_owner_sample_gate_counts
- Input exists: no
- Sample threshold met: no
- Sample-rate win candidate: no
- Quality guard: not_evaluated_waiting_for_sample_rate_candidate
- No quality regression: not evaluated
- Challenger final win rule met: no
- Promotion review queued: no
- Promotion performed: no
- Approval queue write performed: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Owner Quality Review Form

- Status: ok
- Mode: owner_quality_review_form
- Form status: waiting_for_sample_rate_candidate_local_form_ready
- Owner quality review status: waiting_for_sample_rate_candidate
- Owner-filled file exists: no
- Sample-rate win candidate: no
- Download filename: owner_quality_review.filled.json
- Review filename: owner_quality_review_form.review.json
- Browser only: yes
- Browser persistence: no
- Network calls performed: no
- Approval queue write performed: no
- data/lp_events.jsonl write performed: no
- Promotion performed: no
- External effect: no

## Sample Gate Owner Worksheet

- Status: ok
- Mode: sample_gate_owner_worksheet
- Worksheet status: waiting_for_owner_sample_gate_counts
- Owner sample gate status: waiting_for_owner_sample_gate_counts
- Owner-filled file exists: no
- Rows: 18
- Links: 6
- Source groups: 2
- Required fields: capture_date, aggregate_count, evidence_ref, reviewer, pii_checked
- Live input files created: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Sample Gate Owner Form

- Status: ok
- Mode: sample_gate_owner_form
- Form status: ready_local_browser_fill
- Owner-filled file exists: no
- Rows: 18
- Links: 6
- Source groups: 2
- Download filename: sample_gate_ledger.filled.csv
- Browser only: yes
- Browser persistence: no
- Network calls performed: no
- Live input files created: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Sample Gate Owner Form Fixtures

- Status: ok
- Mode: sample_gate_owner_form_fixture_dry_run
- Scenarios: 3
- Form export replay executed: yes
- Source compile commands executed: yes
- Owner sample gate commands executed: yes
- Live input files created: no
- data/lp_events.jsonl write performed: no
- External effect: no
- Scenario IDs: form_export_sample_insufficient_keeps_collecting, form_export_ready_queues_owner_review, form_export_sensitive_evidence_blocked

## Sample Gate Batch Handoff

- Status: ok
- Mode: sample_gate_batch_handoff_local_only
- Handoff status: p0_full_coverage_batched_for_owner_counts
- P0 rows: 18/18
- Focused batch rows: 9
- Remaining batch rows: 9
- Full coverage ready: yes
- Live input files created: no
- data/lp_events.jsonl write performed: no
- External effect: no
- Delete action performed: no

## Sample Gate Collection Sprint

- Status: ok
- Mode: sample_gate_collection_sprint_local_only
- Sprint status: sample_gate_due_collection_sprint_active
- Due status: day7_due_waiting_for_owner_counts
- P0 pending: 18/18
- Focused missing count: 9
- Sprint steps: 5
- Owner open targets: 7
- Owner review required: yes
- data/lp_events.jsonl write performed: no
- External effect: no
- Delete action performed: no

## Owner Sample Gate Fixtures

- Status: ok
- Mode: owner_sample_gate_fixture_dry_run
- Scenarios: 7
- Commands executed: yes
- Real events unchanged: yes
- data/lp_events.jsonl write performed: no
- External effect: no
- Scenario IDs: missing_input_waits_for_owner_counts, partial_counts_keep_collecting, sample_insufficient_due_visits, sample_insufficient_due_test_days, sample_rate_win_needs_quality_review, sample_ready_challenger_underperforms, sensitive_evidence_blocks_status

## Owner Quality Review Form Fixtures

- Status: ok
- Mode: owner_quality_review_form_fixture_dry_run
- Scenarios: 4
- Form export replay executed: yes
- Commands executed: yes
- Real events unchanged: yes
- data/lp_events.jsonl write performed: no
- Approval queue write performed: no
- Promotion performed: no
- External effect: no
- Scenario IDs: quality_form_export_waits_for_sample_rate_candidate, quality_form_export_pass_queues_owner_review, quality_form_export_regression_keeps_champion, quality_form_export_sensitive_notes_blocked

## Owner Quality Review Fixtures

- Status: ok
- Mode: owner_quality_review_fixture_dry_run
- Scenarios: 6
- Commands executed: yes
- Real events unchanged: yes
- data/lp_events.jsonl write performed: no
- Approval queue write performed: no
- External effect: no
- Scenario IDs: waiting_for_sample_rate_candidate_no_input, sample_rate_win_waits_for_quality_evidence, sample_rate_win_quality_pass_queues_review, sample_rate_win_quality_regression_keeps_champion, sensitive_evidence_blocks_review, missing_required_fields_blocks_review

## Candidate Retirement Fixtures

- Status: ok
- Mode: candidate_retirement_fixture_dry_run
- Scenarios: 6
- Current queue safety: current_queue_safe
- Real events unchanged: yes
- data/lp_events.jsonl write performed: no
- Public link change performed: no
- Champion promotion performed: no
- Delete action performed: no
- External effect: no
- Scenario IDs: sample_insufficient_keeps_testing, winning_challenger_requires_owner_review, underperforming_challenger_ready_for_local_retirement, quality_regression_ready_for_local_retirement, unknown_candidate_observed_only, mixed_candidates_summary_counts

## Iteration History

- Status: ok
- Mode: iteration_history_local_only
- Cadence: weekly_7_day_iteration
- History status: collect_more_data
- Current changed variable: cta_text
- Sample threshold met: no
- Archives scanned: 3
- Next safe actions: 4
- Pending human approvals: 5
- Ready local reviews: 14
- Production deploy performed: no
- Public link change performed: no
- External effect: no

## LINE Inbound Playbook

- Status: ok
- Mode: line_inbound_fixture_dry_run
- Scenarios: 6
- Execution performed: no
- LINE push performed: no
- Customer data mutation performed: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Approval Resume Fixtures

- Status: ok
- Mode: approval_resume_fixture_dry_run
- Scenarios: 11
- Execution performed: no
- External effect: no

## Owner Approval Form

- Status: ok
- Mode: owner_approval_form
- Form status: ready_local_owner_approval_form
- Approval input exists: no
- Metadata gates exposed: 4
- Manual-only gates excluded: 1
- Download filename: owner_approval_input.json
- Review filename: owner_approval_form.review.json
- Browser only: yes
- Browser persistence: no
- Network calls performed: no
- Approval input write performed: no
- Live input files created: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Owner Approval Form Fixtures

- Status: ok
- Mode: owner_approval_form_fixture_dry_run
- Scenarios: 4
- Form export replay executed: yes
- Approval resume commands executed: yes
- Live input files created: no
- Approval input write performed: no
- Execution performed: no
- External effect: no
- Scenario IDs: form_static_contract, form_export_valid_github_plan_only, form_export_placeholder_blocked, form_export_sensitive_value_blocked

## Owner Gate Evidence Intake

- Status: ok
- Mode: owner_gate_evidence_intake
- Evidence status: waiting_for_owner_evidence
- Input exists: no
- Ready gates: 0/4
- Issue count: 0
- Evidence only: yes
- Execution performed: no
- External effect: no

## Owner Gate Evidence Fixtures

- Status: ok
- Mode: owner_gate_evidence_fixture_dry_run
- Scenarios: 10
- Local fixture commands executed: yes
- Owner gate evidence fixture executed: yes
- Execution performed: no
- External effect: no

## Post-Gate Verification Plan

- Status: ok
- Mode: post_gate_verification_plan
- Verification status: waiting_for_owner_evidence
- Ready gates: 0/4
- No network read performed: yes
- No remote CLI performed: yes
- Actual evidence values persisted: no
- Execution performed: no
- External effect: no

## Post-Gate Verification Fixtures

- Status: ok
- Mode: post_gate_verification_fixture_dry_run
- Scenarios: 9
- Local fixture commands executed: yes
- Owner gate evidence fixture executed: yes
- Post-gate verification fixture executed: yes
- Execution performed: no
- External effect: no

## GitHub Export Bundle

- Status: ok
- Mode: github_export_bundle_local_only
- Files copied: 508
- Repo dir: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/github_export/bundles/repo-ready-20260710T214808273Z/repo
- Manifest: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/github_export/bundles/repo-ready-20260710T214808273Z/manifest.json
- Report: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/github_export_manifest.md
- Excluded live / owner inputs: data/funnel_aggregates.csv, data/github_export_status.json, data/lp_events.d1-local.jsonl, data/lp_events.jsonl, data/manual_conversions.csv, data/source_capture/sample_gate_ledger.filled.csv, data/source_capture/source_capture_ledger.filled.csv, github_export_manifest.md, manual_publish_evidence.json, output/playwright, owner_approval_input.json, owner_gate_evidence.json
- Git init performed: no
- Git commit performed: no
- GitHub push or PR performed: no
- External effect: no

## Artifact Retention Monitor

- Status: within_review_budget
- Mode: artifact_retention_monitor_local_only
- Total local artifact size: 50.2 MB
- Warnings: 0
- Owner-only cleanup candidates: 0
- Owner review required: no
- Cleanup policy: owner_only_manual_cleanup_after_review
- Cleanup command generated: no
- Cleanup command executed: no
- Delete action performed: no
- External effect: no

## Artifact Retention Review Pack

- Status: within_review_budget
- Mode: artifact_retention_review_pack_local_only
- Source status: data/artifact_retention_status.json
- Total local artifact size: 50.2 MB
- Owner cleanup candidates: 0
- Review required: no
- Highest priority section: n/a
- Cleanup policy: owner_only_manual_after_review
- Cleanup command generated: no
- Cleanup command executed: no
- Filesystem mutation performed: no
- Delete action performed: no
- External effect: no

## GitHub Actions Weekly Verify

- Status: ok
- Path: .github/workflows/3q-growth-loop-weekly.yml
- Cron: 10 16 * * 6 (Sunday 00:10)
- Manual dispatch: yes
- Verify command: yes
- Upload artifact: yes
- Deploy step present: no
- Git write step present: no
- External effect now: no

## LaunchAgent Runtime Proof

- Service loaded: yes
- State: not running
- Active count: 0
- Run count: 1
- Last exit code: 0
- Successful run observed: yes
- Current LaunchAgent invocation observed: no
- Current process descends from service: no
- Proof kind: completed_exit_zero
- External effect: no

## Schedule Catch-Up Monitor

- Status: current_weekly_run_confirmed
- Mode: weekly_schedule_catchup_monitor
- Latest expected run: 2026-07-05, 00:10:00 Asia/Taipei
- Next expected run: 2026-07-12, 00:10:00 Asia/Taipei
- Catch-up required: no
- Weekly runner status observed: success
- Weekly runner pending commands observed: 0
- Weekly runner invoked by monitor: no
- Catch-up run performed by monitor: no
- Next safe action: No catch-up needed. Review owner_console.html and wait for the next Sunday local run.
- External effect: no

## Red-Line Priority Queue

- Status: prioritize_p0_sample_gate_counts
- Mode: redline_priority_local_only
- Actions: 25
- Local actions: 18
- External gate actions: 5
- Manual-only actions: 2
- Red-line queue covered: yes
- Next operator action: p0_collect_sample_gate_counts: Open next_p0_owner_form.html or next_p0_quick_capture.md, fill aggregate-only P0 counts, then rerun owner intake/weekly verification.
- No autorun for external gates: yes
- Gates execute in order: yes
- Execution performed: no
- External effect: no

## Required Outputs

| artifact | status |
|---|---|
| weekly_report.md | present |
| growth_scores.json | present |
| approval_queue.json | present |
| ab_test_status.json | present |
| landing_page_candidate.html | present |
| worker.ts | present |
| worker_dry_run.md | present |
| data/worker_dry_run_status.json | present |
| prepared_but_blocked.json | present |
| pipeline_status.json | present |
| next_round_plan.json | present |
| content_variants.json | present |
| tracking_links.json | present |
| funnel_breakdown.json | present |
| funnel_breakdown.md | present |
| goal_completion_audit.md | present |
| data/goal_completion_audit_status.json | present |
| north_star_funnel.json | present |
| north_star_funnel.md | present |
| schedule_catchup_status.md | present |
| data/schedule_catchup_status.json | present |
| data/approval_resume_fixture_status.json | present |
| owner_approval_form.html | present |
| data/owner_approval_form_status.json | present |
| owner_approval_form_fixture_report.md | present |
| data/owner_approval_form_fixture_status.json | present |
| line_inbound_playbook.md | present |
| line_inbound_playbook.json | present |
| line_inbound_fixture_report.md | present |
| data/line_inbound_fixture_status.json | present |
| variable_rotation_fixture_report.md | present |
| data/variable_rotation_fixture_status.json | present |
| data/funnel_aggregate_status.json | present |
| data/funnel_aggregates.example.csv | present |
| data/funnel_aggregates.preview.jsonl | present |
| data/funnel_aggregate_fixture_status.json | present |
| funnel_aggregate_fixture_report.md | present |
| data/real_data_apply_fixture_status.json | present |
| real_data_apply_fixture_report.md | present |
| data/real_data_input_pack_status.json | present |
| real_data_input_pack.md | present |
| data/real_data_input_pack/funnel_aggregates.fill-template.csv | present |
| data/real_data_input_pack/manual_conversions.fill-template.csv | present |
| data/source_readiness_status.json | present |
| source_readiness.md | present |
| data/champion_contract_audit_status.json | present |
| data/cloudflare_3q_site_metrics_observation.json | present |
| champion_contract_audit.md | present |
| scripts/champion-contract-audit.mjs | present |
| integrations/3q-site/champion-integration.config.json | present |
| integrations/3q-site/wrangler.jsonc | present |
| integrations/3q-site/source/worker.origin-main.js | present |
| integrations/3q-site/generated/worker.candidate.js | present |
| integrations/3q-site/generated/worker.candidate.patch | present |
| scripts/build-champion-integration-candidate.mjs | present |
| champion_integration_candidate.md | present |
| data/champion_integration_candidate_status.json | present |
| scripts/champion-integration-smoke.mjs | present |
| champion_integration_smoke.md | present |
| data/champion_integration_smoke_status.json | present |
| scripts/cloudflare-d1-readiness.mjs | present |
| cloudflare_d1_readiness.md | present |
| data/cloudflare_d1_readiness_status.json | present |
| data/cloudflare_d1_inventory_snapshot.json | present |
| scripts/live-telemetry-readiness.mjs | present |
| live_telemetry_readiness.md | present |
| data/live_telemetry_readiness_status.json | present |
| data/live_telemetry_observation_snapshot.json | present |
| scripts/live-telemetry-readiness-fixtures.mjs | present |
| live_telemetry_readiness_fixture_report.md | present |
| data/live_telemetry_readiness_fixture_status.json | present |
| scripts/lib/champion-source-lock.mjs | present |
| scripts/champion-source-lock-fixtures.mjs | present |
| champion_source_lock_fixtures.md | present |
| data/champion_source_lock_fixture_status.json | present |
| scripts/lib/run-lock-policy.mjs | present |
| scripts/weekly-runner-lock-fixtures.mjs | present |
| weekly_runner_lock_fixtures.md | present |
| data/weekly_runner_lock_fixture_status.json | present |
| scripts/d1-schema-contract.mjs | present |
| d1_schema_contract.md | present |
| data/d1_schema_contract_status.json | present |
| scripts/approved-d1-config.mjs | present |
| approved_d1_config.md | present |
| data/approved_d1_config_status.json | present |
| d1_collection_mode.md | present |
| data/d1_collection_mode_status.json | present |
| d1_collection_mode_plan.md | present |
| data/d1_collection_mode_plan_status.json | present |
| d1_collection_mode_fixture_report.md | present |
| data/d1_collection_mode_fixture_status.json | present |
| d1_aggregate_export_fixture_report.md | present |
| data/d1_aggregate_export_fixture_status.json | present |
| scripts/champion-local-branch.mjs | present |
| champion_local_branch.md | present |
| data/champion_local_branch_status.json | present |
| scripts/champion-release-preflight.mjs | present |
| champion_release_preflight.md | present |
| data/champion_release_preflight_status.json | present |
| data/champion_live_deployment_snapshot.json | present |
| champion_release_owner_packet.md | present |
| champion_release_owner_packet.json | present |
| scripts/champion-github-handoff.mjs | present |
| champion_github_handoff.md | present |
| champion_github_pr_body.md | present |
| data/champion_github_handoff_status.json | present |
| data/source_capture_status.json | present |
| source_capture_pack.md | present |
| data/source_capture/source_capture_checklist.json | present |
| data/source_capture/source_capture_ledger.fill-template.csv | present |
| data/source_capture/sample_gate_ledger.fill-template.csv | present |
| sample_gate_ledger.md | present |
| data/sample_gate_ledger_status.json | present |
| sample_gate_replay_fixture_report.md | present |
| data/sample_gate_replay_fixture_status.json | present |
| source_capture_compile_report.md | present |
| data/source_capture_compile_status.json | present |
| source_capture_compile_fixture_report.md | present |
| data/source_capture_compile_fixture_status.json | present |
| data/source_capture/compiled/funnel_aggregates.owner-preview.csv | present |
| data/source_capture/compiled/manual_conversions.owner-preview.csv | present |
| data/real_data_intake_status.json | present |
| real_data_intake_plan.md | present |
| data_collection_queue.json | present |
| data_collection_brief.md | present |
| data/data_collection_brief_status.json | present |
| data_collection_progress.md | present |
| data_collection_progress.json | present |
| data/data_collection_progress_status.json | present |
| source_trust_matrix.md | present |
| source_trust_matrix.json | present |
| data/source_trust_matrix_status.json | present |
| scripts/source-trust-matrix.mjs | present |
| next_p0_owner_inputs.md | present |
| next_p0_owner_inputs.json | present |
| data/next_p0_owner_inputs_status.json | present |
| next_p0_owner_form.html | present |
| data/next_p0_owner_form_status.json | present |
| next_p0_owner_form_fixture_report.md | present |
| data/next_p0_owner_form_fixture_status.json | present |
| next_p0_owner_intake.md | present |
| data/next_p0_owner_intake_status.json | present |
| next_p0_owner_intake_fixture_report.md | present |
| data/next_p0_owner_intake_fixture_status.json | present |
| data/next_p0_owner_intake/funnel_aggregates.owner-preview.csv | present |
| data/next_p0_owner_intake/manual_conversions.owner-preview.csv | present |
| owner_data_preflight.md | present |
| owner_data_preflight.json | present |
| data/owner_data_preflight_status.json | present |
| sample_gate_capture_calendar.json | present |
| sample_gate_capture_calendar.md | present |
| sample_gate_capture_calendar.ics | present |
| data/sample_gate_capture_calendar_status.json | present |
| sample_gate_due_status.json | present |
| sample_gate_due_status.md | present |
| data/sample_gate_due_status_status.json | present |
| week0_owner_capture_queue.md | present |
| week0_owner_capture_queue.json | present |
| data/week0_owner_capture_queue_status.json | present |
| owner_sample_gate_status.md | present |
| owner_sample_gate_status.json | present |
| data/owner_sample_gate_status.json | present |
| sample_gate_owner_worksheet.md | present |
| sample_gate_owner_worksheet.json | present |
| data/sample_gate_owner_worksheet_status.json | present |
| sample_gate_owner_form.html | present |
| data/sample_gate_owner_form_status.json | present |
| sample_gate_owner_form_fixture_report.md | present |
| data/sample_gate_owner_form_fixture_status.json | present |
| sample_gate_batch_handoff.md | present |
| sample_gate_batch_handoff.json | present |
| data/sample_gate_batch_handoff_status.json | present |
| sample_gate_batch_1_paste_block.txt | present |
| sample_gate_batch_2_paste_block.txt | present |
| sample_gate_collection_sprint.md | present |
| sample_gate_collection_sprint.json | present |
| data/sample_gate_collection_sprint_status.json | present |
| owner_sample_gate_fixture_report.md | present |
| data/owner_sample_gate_fixture_status.json | present |
| owner_quality_review.md | present |
| owner_quality_review.example.json | present |
| data/owner_quality_review_status.json | present |
| owner_quality_review_form.html | present |
| data/owner_quality_review_form_status.json | present |
| owner_quality_review_form_fixture_report.md | present |
| data/owner_quality_review_form_fixture_status.json | present |
| owner_quality_review_fixture_report.md | present |
| data/owner_quality_review_fixture_status.json | present |
| candidate_retirement_fixture_report.md | present |
| data/candidate_retirement_fixture_status.json | present |
| sample_gate_collection_plan.json | present |
| sample_gate_collection_plan.md | present |
| data/sample_gate_collection_plan_status.json | present |
| iteration_history.json | present |
| iteration_history.md | present |
| data/event_input_quality_status.json | present |
| d1_collection_guard.md | present |
| scripts/export-d1-events.mjs | present |
| tracking_link_smoke.md | present |
| data/tracking_link_smoke_status.json | present |
| data/event_contract_smoke_status.json | present |
| github_export_manifest.md | present |
| data/github_export_status.json | present |
| artifact_retention.md | present |
| data/artifact_retention_status.json | present |
| artifact_retention_review_pack.md | present |
| artifact_retention_review_pack.json | present |
| data/artifact_retention_review_status.json | present |
| data/real_data_decision_replay_status.json | present |
| real_data_decision_replay_report.md | present |
| owner_gate_evidence.md | present |
| owner_gate_evidence.example.json | present |
| data/owner_gate_evidence_status.json | present |
| owner_gate_evidence_fixture_report.md | present |
| data/owner_gate_evidence_fixture_status.json | present |
| post_gate_verification.md | present |
| data/post_gate_verification_status.json | present |
| post_gate_verification_fixture_report.md | present |
| data/post_gate_verification_fixture_status.json | present |
| redline_priority.md | present |
| redline_priority.json | present |
| data/redline_priority_status.json | present |
| .github/workflows/3q-growth-loop-weekly.yml | present |

## Human Gates Preserved

- Production deploy performed: no
- Public link change performed: no
- Formal post performed: no
- GitHub push or PR performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
