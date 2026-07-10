# Champion Release Preflight

  BLUF: The source-locked patch applies cleanly in a fresh archive and passes syntax plus Wrangler dry-run. Live collector state is observed separately; any missing provenance/schema evidence and all redeploys remain owner-gated. Production remains blocked.

- Generated: 2026-07-10T21:47:41.794Z
- Source commit: f86faa7356ac7962d9b429951b67c742370271c0
- Observed source ref: f86faa7356ac7962d9b429951b67c742370271c0
- Ref advanced without target-file drift: no
- Source blob: c9ffd646fd88750b6170fa1aa8ac2acd91c6f5a1
- Candidate SHA-256: d63f07cc8f6fe0944cf9c7279eb4ed2abe4b3b6e1e7d05c4cd87425beb26542a
- Patched source byte-identical: yes
- Wrangler dry-run: pass
- Local feature commit: local_feature_commit_ready_for_owner_review
- D1 readiness: existing_collector_observed_owner_provenance_and_schema_evidence_required
- Existing Candidate deployment observed: yes
- Candidate deploy required now: no
- Live ingest readiness proven: no
- Source worktree changed: no
- Production deploy performed: no

## Validation

| check | result |
|---|---|
| exact_source_commit | pass |
| expected_lock_tuple_verified | pass |
| source_ref_pinned_once | pass |
| source_ref_descends_from_lock | pass |
| source_ref_target_matches_lock | pass |
| exact_source_blob | pass |
| exact_source_sha256 | pass |
| candidate_build_status_ok | pass |
| candidate_source_lock_matches | pass |
| isolated_two_worker_smoke_ok | pass |
| patch_check_ok | pass |
| patch_apply_ok | pass |
| patched_source_matches_generated_candidate | pass |
| node_syntax_ok | pass |
| wrangler_dry_run_ok | pass |
| wrangler_bundle_created | pass |
| production_command_template_dry_run_ok | pass |
| source_repository_unchanged | pass |
| local_feature_commit_ready | pass |
| d1_readiness_monitor_ok | pass |
| live_telemetry_readiness_monitor_ok | pass |

## Live Snapshot

- Present: yes
- Checked: 2026-07-10T14:39:57.325Z
- Active version: de2997a0-6a6a-4780-9e24-e65774dc3f1a
- Compatibility date: 2024-12-01
- Contact repair live: yes

## Human Gates

- review_champion_patch: local_feature_commit_ready_for_owner_review - Review local head 9b6fd00c082f2b67d6cde159e61dc6c407d02ea0; the full stack is scoped to .github/workflows/deploy-3q-line-oa.yml, .github/workflows/deploy-fleet-sentinel.yml, .github/workflows/deploy-pop-line-oa.yml, .github/workflows/deploy-tudigong.yml, brands/popmonster.json, workers/3q-line-oa/worker.js, workers/fleet-sentinel/worker.js, workers/outreach/worker.js, workers/pop-line-oa/worker.js, workers/pop-sales-ai/worker.js, workers/sales-ai/worker.js, workers/tudigong-sales-ai/worker.js, workers/tudigong/worker.js. Remote state is up_to_date_with_local; this preflight performed no GitHub write.
- provision_production_collector: existing_collector_observed_owner_provenance_and_schema_evidence_required - Candidate deployment 5073984b-bcc0-40f1-a331-daaadd741071 / version 133d27b0-36e5-41e8-96ec-b55925b7b30a is observed healthy, security-current, and wired to the Champion. No redeploy is currently required, but owner provenance and remote schema evidence are still missing.
- approve_champion_production_deploy: blocked_owner_approval_required - A live integration may already be observable, but its provenance is not owner evidence. Any deploy or redeploy still requires patch review, current rollback confirmation, and explicit approval.
- approve_github_branch_push_or_pr: blocked_owner_approval_required - The remote branch is a reviewed ancestor (up_to_date_with_local) and local is ahead by 0; updating it or opening a PR remains an external GitHub write.

## Review Artifacts

- Owner packet: champion_release_owner_packet.md
- Machine packet: champion_release_owner_packet.json
- Patch: integrations/3q-site/generated/worker.candidate.patch
- Candidate: integrations/3q-site/generated/worker.candidate.js
- Integration smoke: champion_integration_smoke.md
- Live telemetry readiness: live_telemetry_readiness.md
