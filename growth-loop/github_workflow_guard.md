# GitHub Workflow Guard

BLUF: github_workflow_guard_ok. The weekly GitHub workflow is review-only: it runs `npm run verify`, uploads artifacts, and avoids deploys, GitHub writes, secrets, LINE/payment actions, and macOS LaunchAgent readback.

Generated: 2026-07-10T21:48:05.864Z
Mode: github_workflow_guard_local_only
Workflow: ../.github/workflows/3q-growth-loop-weekly.yml
Checks: 80
Failed checks: 0

## Contract

- Runs verify only: yes
- Read-only contents permission: yes
- Uploads review artifacts: yes
- Avoids macOS LaunchAgent readback in CI: yes
- Verify avoids owner apply or external gates: yes

## Checks

| check | status | message |
|---|---|---|
| workflow_title | ok | workflow has expected title |
| manual_dispatch | ok | workflow supports manual dispatch |
| sunday_taipei_cron | ok | workflow cron is Sunday 00:10 Asia/Taipei |
| ubuntu_runner | ok | workflow runs on ubuntu-latest for artifact verification only |
| read_only_contents | ok | workflow uses contents: read only |
| npm_ci | ok | workflow installs with npm ci |
| runs_verify_only | ok | workflow runs verify, not weekly:local |
| uploads_artifacts | ok | workflow uploads review artifacts |
| artifact_missing_policy | ok | artifact upload fails if review files are missing |
| retention_bounded | ok | artifact retention is bounded |
| artifact_weekly_report_md | ok | workflow uploads weekly_report.md |
| artifact_growth_scores_json | ok | workflow uploads growth_scores.json |
| artifact_approval_queue_json | ok | workflow uploads approval_queue.json |
| artifact_ab_test_status_json | ok | workflow uploads ab_test_status.json |
| artifact_worker_dry_run_md | ok | workflow uploads worker_dry_run.md |
| artifact_cloudflare_d1_readiness_md | ok | workflow uploads cloudflare_d1_readiness.md |
| artifact_data_cloudflare_d1_readiness_status_json | ok | workflow uploads data/cloudflare_d1_readiness_status.json |
| artifact_data_cloudflare_d1_inventory_snapshot_json | ok | workflow uploads data/cloudflare_d1_inventory_snapshot.json |
| artifact_live_telemetry_readiness_md | ok | workflow uploads live_telemetry_readiness.md |
| artifact_data_live_telemetry_readiness_status_json | ok | workflow uploads data/live_telemetry_readiness_status.json |
| artifact_data_live_telemetry_observation_snapshot_json | ok | workflow uploads data/live_telemetry_observation_snapshot.json |
| artifact_live_telemetry_readiness_fixture_report_md | ok | workflow uploads live_telemetry_readiness_fixture_report.md |
| artifact_data_live_telemetry_readiness_fixture_status_json | ok | workflow uploads data/live_telemetry_readiness_fixture_status.json |
| artifact_champion_source_lock_fixtures_md | ok | workflow uploads champion_source_lock_fixtures.md |
| artifact_data_champion_source_lock_fixture_status_json | ok | workflow uploads data/champion_source_lock_fixture_status.json |
| artifact_weekly_runner_lock_fixtures_md | ok | workflow uploads weekly_runner_lock_fixtures.md |
| artifact_data_weekly_runner_lock_fixture_status_json | ok | workflow uploads data/weekly_runner_lock_fixture_status.json |
| artifact_d1_schema_contract_md | ok | workflow uploads d1_schema_contract.md |
| artifact_data_d1_schema_contract_status_json | ok | workflow uploads data/d1_schema_contract_status.json |
| artifact_approved_d1_config_md | ok | workflow uploads approved_d1_config.md |
| artifact_data_approved_d1_config_status_json | ok | workflow uploads data/approved_d1_config_status.json |
| artifact_champion_local_branch_md | ok | workflow uploads champion_local_branch.md |
| artifact_data_champion_local_branch_status_json | ok | workflow uploads data/champion_local_branch_status.json |
| artifact_champion_release_preflight_md | ok | workflow uploads champion_release_preflight.md |
| artifact_data_champion_release_preflight_status_json | ok | workflow uploads data/champion_release_preflight_status.json |
| artifact_data_champion_live_deployment_snapshot_json | ok | workflow uploads data/champion_live_deployment_snapshot.json |
| artifact_champion_release_owner_packet_md | ok | workflow uploads champion_release_owner_packet.md |
| artifact_champion_release_owner_packet_json | ok | workflow uploads champion_release_owner_packet.json |
| artifact_champion_github_handoff_md | ok | workflow uploads champion_github_handoff.md |
| artifact_champion_github_pr_body_md | ok | workflow uploads champion_github_pr_body.md |
| artifact_data_champion_github_handoff_status_json | ok | workflow uploads data/champion_github_handoff_status.json |
| artifact_data_worker_dry_run_status_json | ok | workflow uploads data/worker_dry_run_status.json |
| artifact_prepared_but_blocked_json | ok | workflow uploads prepared_but_blocked.json |
| artifact_objective_sequence_audit_md | ok | workflow uploads objective_sequence_audit.md |
| artifact_d1_collection_guard_md | ok | workflow uploads d1_collection_guard.md |
| artifact_github_export_manifest_md | ok | workflow uploads github_export_manifest.md |
| artifact_owner_approval_pack_md | ok | workflow uploads owner_approval_pack.md |
| artifact_sample_gate_collection_sprint_md | ok | workflow uploads sample_gate_collection_sprint.md |
| artifact_sample_gate_collection_sprint_json | ok | workflow uploads sample_gate_collection_sprint.json |
| artifact_data_sample_gate_collection_sprint_status_json | ok | workflow uploads data/sample_gate_collection_sprint_status.json |
| artifact_source_trust_matrix_md | ok | workflow uploads source_trust_matrix.md |
| artifact_source_trust_matrix_json | ok | workflow uploads source_trust_matrix.json |
| artifact_data_source_trust_matrix_status_json | ok | workflow uploads data/source_trust_matrix_status.json |
| artifact_artifact_retention_review_pack_md | ok | workflow uploads artifact_retention_review_pack.md |
| artifact_artifact_retention_review_pack_json | ok | workflow uploads artifact_retention_review_pack.json |
| artifact_data_artifact_retention_review_status_json | ok | workflow uploads data/artifact_retention_review_status.json |
| artifact_data_weekly_runner_status_json | ok | workflow uploads data/weekly_runner_status.json |
| artifact_data_gate_readiness_status_json | ok | workflow uploads data/gate_readiness_status.json |
| no_wrangler_deploy | ok | workflow must not match forbidden pattern wrangler_deploy |
| no_worker_deploy_script | ok | workflow must not match forbidden pattern worker_deploy_script |
| no_git_write | ok | workflow must not match forbidden pattern git_write |
| no_gh_pr_create | ok | workflow must not match forbidden pattern gh_pr_create |
| no_secret_context | ok | workflow must not match forbidden pattern secret_context |
| no_line_or_payment_secret | ok | workflow must not match forbidden pattern line_or_payment_secret |
| no_mutating_network_tool | ok | workflow must not match forbidden pattern mutating_network_tool |
| no_macos_runner | ok | workflow must not match forbidden pattern macos_runner |
| no_macos_launchctl | ok | workflow must not match forbidden pattern macos_launchctl |
| no_launchagent_status_in_ci | ok | workflow must not match forbidden pattern launchagent_status_in_ci |
| no_weekly_local_in_ci | ok | workflow must not match forbidden pattern weekly_local_in_ci |
| verify_script_exists | ok | package.json exposes verify script |
| verify_includes_artifact_verifier | ok | verify ends with artifact verifier |
| verify_no_remote_d1_export | ok | verify script must not run remote_d1_export |
| verify_no_funnel_apply | ok | verify script must not run funnel_apply |
| verify_no_manual_apply | ok | verify script must not run manual_apply |
| verify_no_schedule_install | ok | verify script must not run schedule_install |
| verify_no_schedule_uninstall | ok | verify script must not run schedule_uninstall |
| verify_no_schedule_status_macos_readback | ok | verify script must not run schedule_status_macos_readback |
| verify_no_worker_deploy | ok | verify script must not run worker_deploy |
| verify_no_approved_d1_config_apply | ok | verify script must not run approved_d1_config_apply |
| verify_no_champion_branch_prepare | ok | verify script must not run champion_branch_prepare |

## Safety

- External effect: no
- Git push / PR performed: no
- Production deploy performed: no
- Public link change performed: no
- Formal post performed: no
- LINE push performed: no
- Customer-data mutation performed: no
- Payment action performed: no
- Delete action performed: no
