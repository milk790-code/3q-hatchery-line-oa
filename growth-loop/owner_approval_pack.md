# 3Q Growth Loop Owner Approval Pack

BLUF: Local Week 0 is ready for owner review, but the live acquisition flywheel is still blocked by owner-only external gates. Do not run the remote, deploy, public link, GitHub push, posting, LINE, payment, customer-data, or delete actions until the matching gate is explicitly approved.

Generated: 2026-07-10T21:48:20.571Z
Operator: Angelia 3Q Growth Loop Operator
Mode: week0_data_collection
Status: owner_approval_required
Local preflight: pass
Pending human approvals: 5

## Current Evidence

- Weekly runner: success
- Weekly runner log: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/logs/weekly-runner-20260710T214317Z.log
- Local schedule: Sunday 00:10 Asia/Taipei
- LaunchAgent installed: yes
- Browser smoke: ok / checks=5
- Worker dry run: ok / dry_run_exit=yes / production_deploy=no / report=/Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/worker_dry_run.md
- Tracking link smoke: ok / links=7/7 / real_event_write=no
- Event contract smoke: ok / real_event_write=no
- Week archive: ok / files=326 / dir=/Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/archive/2026-06-29/20260710T214814771Z
- Next round plan: continue_current_round / decision=continue_current_round_until_sample_threshold / next_variable=cta_text
- Real events: 0
- Full funnel preview events: 48 / mode=full_funnel_preview / data_write=no
- Full funnel fixture guard: ok / scenarios=6 / data_write=no
- Real-data apply guard: ok / scenarios=4 / data_write=no
- Real-data decision replay: ok / scenarios=6 / ledger=yes / compile=yes / local_previews=yes / data_write=no / external_effect=no
- Source readiness: waiting_for_real_data / missing_stages=7 / public_ready=no / data_write=no
- Source capture pack: waiting_for_owner_aggregate_capture / rows=42 / importable_links=6 / ab_router_gates=1 / live_inputs=no / data_write=no
- Source compile preview: waiting_for_filled_counts / input_kind=template / filled_rows=0 / preview_rows=0 / live_inputs=no / data_write=no
- Source compile fixtures: ok / scenarios=7 / data_write=no
- Real-data intake plan: no_real_input_files / ready_apply=0 / missing_inputs=2 / blocked_inputs=0 / data_write=no
- Data collection brief: ok / status=waiting_for_owner_aggregate_counts / tasks=42 / sample_gate=waiting_for_sample_gate_counts / p0_tasks=18 / filled_ledger=no / data_write=no
- Data collection progress: ok / status=waiting_for_p0_sample_gate_counts / tasks=0/42 / pending=42 / p0_pending=18 / p1_pending=24 / next_owner_inputs=9 / data_write=no / external_effect=no
- Next P0 owner form: ok / status=ready_local_next_p0_owner_form / rows=9 / browser_only=yes / network=no / fixture=ok / fixture_scenarios=4 / data_write=no / external_effect=no
- Next P0 owner intake: ok / status=waiting_for_next_p0_owner_download / found=no / preview_rows=0 / staged=no / fixture=ok / fixture_scenarios=5 / data_write=no / external_effect=no
- Manual preview events: 10
- LINE inbound playbook: ok / scenarios=6 / external_effect=no
- Manual publish evidence form: ok / status=ready_local_manual_publish_evidence_form / packets=3 / browser_only=yes / network=no / url_fetch=no / live_inputs=no
- Manual publish evidence form guard: ok / scenarios=4 / data_write=no / external_effect=no
- Funnel breakdown: rows=6 / content_variant_links=3 / real_events=0
- D1 sync: scope=local / rows=0
- A/B allocation: champion 90% / challenger 10%
- Sample threshold met: no
- Champion retained: yes

## Approval Queue

| id | tier | status | artifact | human gate |
|---|---:|---|---|---|
| collect-first-real-events | T1 | ready_local_review | data/lp_events.jsonl | Start with local/manual lp_events ingestion or approve D1 connection. |
| approve-d1-create-and-migrate | T2 | pending_human | schema/d1-week0.sql | Confirm the newly observed dedicated D1, separately approve its remote schema migration, and explicitly scope recurring aggregate-only reads. |
| approve-candidate-worker-deploy | T3 | pending_human | live_telemetry_readiness.md | Confirm the observed Candidate Worker deployment provenance and rollback reference; do not redeploy unless the live version is rejected. |
| approve-small-ab-link | T3 | pending_human | ab_test_status.json | Approve any small-traffic link routing before changing public links. |
| review-weekly-report | T1 | ready_local_review | weekly_report.md | Review weekly_report.md before external action. |
| review-champion-contract-audit | T1 | ready_local_review | champion_contract_audit.md | Review champion_contract_audit.md and confirm the observed LINE-only contract provenance before approving public A/B traffic. |
| review-champion-integration-candidate | T1 | ready_local_review | champion_integration_candidate.md | Review the source-locked 3q-site patch and isolated integration smoke before approving any production deploy. |
| approve-champion-integration-production-deploy | T3 | pending_human | champion_integration_candidate.md | Confirm the current live integration provenance before approving any redeploy of the exact source-locked patch, collector URL, verification steps, and rollback plan. |
| review-next-round-plan | T1 | ready_local_review | next_round_plan.md | Review next_round_plan.md before starting a new public A/B variable or extending the current test. |
| review-owner-approval-pack | T1 | ready_local_review | owner_approval_pack.md | Review owner_approval_pack.md before approving remote D1, Worker deploy, public A/B routing, or GitHub publishing. |
| review-owner-console | T1 | ready_local_review | owner_console.html | Review owner_console.html as the local single-screen approval surface. |
| review-real-data-input-pack | T1 | ready_local_review | real_data_input_pack.md | Review real_data_input_pack.md before filling aggregate counts or copying templates into live input CSV filenames. |
| review-source-readiness | T1 | ready_local_review | source_readiness.md | Review source_readiness.md before interpreting sample gaps or approving any public A/B route. |
| review-source-capture-pack | T1 | ready_local_review | source_capture_pack.md | Review source_capture_pack.md before filling aggregate source counts or creating live input CSVs. |
| review-source-capture-compile | T1 | ready_local_review | source_capture_compile_report.md | Review source_capture_compile_report.md and owner-preview CSVs before copying them to live aggregate input filenames. |
| review-real-data-intake-plan | T1 | ready_local_review | real_data_intake_plan.md | Review real_data_intake_plan.md to see which aggregate CSV inputs are still missing. |
| review-data-collection-brief | T1 | ready_local_review | data_collection_brief.md | Review data_collection_brief.md and sample_gate_collection_plan.md before filling aggregate counts or compiling owner-preview CSVs. |
| review-line-inbound-playbook | T1 | ready_local_review | line_inbound_playbook.md | Review line_inbound_playbook.md before using it in manual LINE replies. |
| review-local-launchagent-install | T1 | completed_local_reversible | data/launchagent_status.json | Local LaunchAgent is installed. Use npm run schedule:uninstall to stop the Sunday local runner. |
| approve-github-repo-and-pr | T2 | pending_human | champion_github_handoff.md | Review the prepared local Champion commit, then explicitly approve its branch push or draft PR. Do not merge from this gate. |

## Owner Gates

| gate | tier | status | artifact | current blocker |
|---|---:|---|---|---|
| remote_d1_create_and_migrate | T2 | owner_approval_required | schema/d1-week0.sql | The exact dedicated D1 exists and matches wrangler.jsonc, but its creation provenance is not recorded in owner approval metadata and no remote schema migration or table query has been approved. |
| candidate_worker_production_deploy | T3 | owner_approval_required | live_telemetry_readiness.md | Candidate deployment 5073984b-bcc0-40f1-a331-daaadd741071 / version 133d27b0-36e5-41e8-96ec-b55925b7b30a is observed healthy; owner provenance and rollback evidence are not yet recorded. Redeploy is not currently required. |
| public_ab_small_traffic_link | T3 | owner_approval_required | ab_test_status.json | The live champion URL is verified, but public link routing still affects the live acquisition funnel. |
| github_repo_branch_pr | T2 | owner_approval_required | champion_github_handoff.md | The remote branch is up_to_date_with_local at 9b6fd00c082f2b67d6cde159e61dc6c407d02ea0; local head 9b6fd00c082f2b67d6cde159e61dc6c407d02ea0 is ahead by 0. Updating it or opening a draft PR is an external GitHub write. |
| formal_posts_line_push_payment_customer_data | T3 | manual_only | weekly_report.md | Formal posting, LINE push, ECPay, payment/refund, and customer-data changes are outside the autonomous boundary. |

## Commands After Owner Approval

Run only the block that matches the approved gate. Remote D1, production deploy, GitHub push, and public link placement are external effects.

## remote_d1_create_and_migrate

Status: owner_approval_required
Approval id: approve-d1-create-and-migrate
Owner action: Confirm the observed D1 belongs to this Growth Loop, record only non-secret approval metadata, review the local schema contract, explicitly approve the remote migration, and opt in to recurring aggregate-only reads if desired. Do not create another database.
Rollback: Do not delete or drop the dedicated D1 automatically. Stop before binding/deploy, preserve the database for review, and let the owner decide any cleanup separately.

```zsh
npm run d1:schema:contract
npm run cloudflare:d1:readiness:live
npm run d1:config:preview
wrangler d1 execute 3q-growth-loop-candidate --remote --file=schema/d1-week0.sql
wrangler d1 execute 3q-growth-loop-candidate --remote --command='PRAGMA integrity_check; PRAGMA foreign_key_check;' --json
npm run collect:d1:remote:approved
```

## candidate_worker_production_deploy

Status: owner_approval_required
Approval id: approve-candidate-worker-deploy
Owner action: Confirm the observed Worker name, URL, deployment/version reference, health result, and rollback reference. Do not redeploy unless the observed version is rejected.
Rollback: wrangler rollback 133d27b0-36e5-41e8-96ec-b55925b7b30a --name 3q-growth-loop-candidate -m "Rollback origin/PII security update"

```zsh
npm run telemetry:readiness:live
Review live_telemetry_readiness.md and record non-secret owner evidence.
npm run owner:evidence && npm run post:verify && npm run telemetry:readiness
```

## public_ab_small_traffic_link

Status: owner_approval_required
Approval id: approve-small-ab-link
Owner action: Approve the verified champion URL metadata, 90/10 split, test duration, public placement, and rollback URL.
Rollback: Restore the previous public link manually and keep the challenger as candidate-only.

```zsh
Confirm CHAMPION_URL remains https://3q-site.milk790.workers.dev/.
Confirm existing Candidate Worker provenance before public traffic; no redeploy is required unless the observed version is rejected.
Manually place the approved /ab/ab-week0-cta-text-001 URL in the selected small-traffic surface.
```

## github_repo_branch_pr

Status: owner_approval_required
Approval id: approve-github-repo-and-pr
Owner action: Review local head 9b6fd00c082f2b67d6cde159e61dc6c407d02ea0 and champion_github_pr_body.md, then explicitly approve any remaining fast-forward push or draft PR in milk790-code/3q-hatchery-line-oa. Do not merge from this gate.
Rollback: Close the draft PR if needed and retain the branch for audit. No automatic merge, branch deletion, or repository mutation beyond the explicitly approved push/PR.

```zsh
git -C /Users/mac/Documents/Codex/control-center/worktrees/3q-site-growth-loop-champion-v1 status --short --branch
git -C /Users/mac/Documents/Codex/control-center/worktrees/3q-site-growth-loop-champion-v1 show --stat --oneline HEAD
git -C /Users/mac/Documents/Codex/control-center/worktrees/3q-site-growth-loop-champion-v1 push -u origin codex/3q-growth-loop-champion-v1
gh pr create --repo milk790-code/3q-hatchery-line-oa --base main --head codex/3q-growth-loop-champion-v1 --draft --title "3Q site: persist privacy-safe Growth Loop telemetry" --body-file champion_github_pr_body.md
```


## Approval Resume Dry Run

Before any external command block is used, run the dry-run planner:

```zsh
npm run approval:plan
npm run owner:evidence
npm run post:verify
npm run verify:artifacts
```

Artifacts:

- approval_resume_plan.md
- data/approval_resume_status.json
- owner_approval_input.example.json
- owner_gate_evidence.example.json
- post_gate_verification.md
- data/post_gate_verification_status.json

The dry-run planner and post-gate verification plan validate non-secret owner approval/evidence metadata and never run remote D1, production deploy, GitHub push/PR, public link changes, posting, LINE, payment, customer-data, or delete actions.

## Source Capture Review

Artifact: source_capture_pack.md
Status: waiting_for_owner_aggregate_capture
Ledger rows: 42
Sample-gate ledger rows: 18
Importable links: 6
A/B router gates held out: 1
Live input files created: no
data/lp_events.jsonl write performed: no

Use this pack to collect aggregate counts only. It does not create live scoring inputs or append real events.

## Source Capture Compile Review

Artifact: source_capture_compile_report.md
Status: waiting_for_filled_counts
Input kind: template
Filled rows: 0
Funnel preview rows: 0
Manual preview rows: 0
Issues: 0
Live input files created: no
data/lp_events.jsonl write performed: no

Use this compiler after filling data/source_capture/source_capture_ledger.filled.csv. It creates owner-preview CSVs only; copy them to live CSV names only after owner review.

Fixture guard: ok / scenarios=7 / report=source_capture_compile_fixture_report.md

## Real Data Intake Review

Artifact: real_data_intake_plan.md
Status: no_real_input_files
Ready apply commands: 0
Missing inputs: 2
Blocked inputs: 0
data/lp_events.jsonl write performed: no

Apply commands in the intake plan are local-only, but they append to data/lp_events.jsonl. Use them only after owner review confirms the CSV is reviewed real aggregate data.

## Data Collection Brief Review

Artifacts: data_collection_brief.md / data_collection_queue.json / data/data_collection_brief_status.json / sample_gate_collection_plan.md / sample_gate_collection_plan.json / data/sample_gate_collection_plan_status.json
Status: waiting_for_owner_aggregate_counts
Tasks: 42
Stage count: 7
Importable links: 6
Sample gate: waiting_for_sample_gate_counts / p0_tasks=18 / p0_links=6
Filled ledger exists: no
Live input files created: no
data/lp_events.jsonl write performed: no
External effect: no

Use this brief before filling data/source_capture/source_capture_ledger.filled.csv. It is a local owner-review queue only; it does not create live input CSVs or append real events.

## Data Collection Progress Review

Artifacts: data_collection_progress.md / data_collection_progress.json / data/data_collection_progress_status.json / next_p0_owner_inputs.md / next_p0_owner_inputs.json / data/next_p0_owner_inputs_status.json
Status: waiting_for_p0_sample_gate_counts
Tasks filled: 0/42
Pending tasks: 42
P0 pending: 18
P1 pending: 24
Next owner inputs exposed: 9
data/lp_events.jsonl write performed: no
External effect: no

Use this progress dashboard to fill the next owner aggregate-count rows. It is a local status view only; it does not create live input CSVs or append real events.

## Focused Next P0 Form Review

Artifacts: next_p0_owner_form.html / data/next_p0_owner_form_status.json / next_p0_owner_form_fixture_report.md / data/next_p0_owner_form_fixture_status.json
Status: ready_local_next_p0_owner_form
Rows: 9
Browser only: yes
Browser persistence: no
Network calls performed: no
Fixture status: ok / scenarios=4
Live input files created: no
data/lp_events.jsonl write performed: no
External effect: no

Open this focused form before the full sample-gate form when only the next 9 P0 aggregate rows need owner review. It downloads review files only and does not stage or apply data.

## Focused Next P0 Intake Review

Artifacts: next_p0_owner_intake.md / data/next_p0_owner_intake_status.json / next_p0_owner_intake_fixture_report.md / data/next_p0_owner_intake_fixture_status.json / data/next_p0_owner_intake/funnel_aggregates.owner-preview.csv / data/next_p0_owner_intake/manual_conversions.owner-preview.csv
Status: waiting_for_next_p0_owner_download
Candidate found: no
Candidate valid: no
Preview rows: 0
Stage performed: no
Live input files created: no
Fixture status: ok / scenarios=5
data/lp_events.jsonl write performed: no
External effect: no

Use this intake after downloading next_p0_owner_inputs.filled.csv. Weekly runs validate and preview only; staging local CSV inputs requires explicit owner review and flags.

## Manual-Only Actions

- Formal social posts, schedules, broadcasts, or sends.
- LINE proactive push or customer messages.
- ECPay payment, refund, or payment-link operation.
- Customer record mutation.
- Data deletion.
- Promoting a challenger to champion.

## Prepared But Blocked

| action | blocked_by | artifact | resume_when |
|---|---|---|---|
| verify_existing_cloudflare_d1_and_apply_schema | Read-only Cloudflare inventory confirms the exact dedicated Growth Loop D1 now exists and matches wrangler.jsonc, but no table query or remote schema migration has been approved or performed. | schema/d1-week0.sql | Owner confirms the observed database provenance, explicitly approves remote migration, and records recurring_aggregate_read_approved=true only if weekly grouped-count reads are allowed after reviewing local_schema_idempotency_and_constraints_verified; local config guard remains prepared_but_blocked_owner_d1_approval_or_inventory. |
| confirm_existing_candidate_worker_provenance | Read-only observation confirms Candidate deployment 5073984b-bcc0-40f1-a331-daaadd741071 / version 133d27b0-36e5-41e8-96ec-b55925b7b30a is healthy and wired to the Champion, but owner provenance evidence is not recorded. A redeploy is not currently required. | live_telemetry_readiness.md | Owner confirms the observed Worker name, URL, deployment/version reference, health result, and rollback reference in owner_gate_evidence.json. Redeploy only if the observed version is rejected. |
| confirm_champion_live_contract_provenance_before_redeploy | The LINE-only Champion contract is observable live, but deployment provenance is not owner evidence and any redeploy remains a production action. | champion_integration_candidate.md | Owner confirms the current live deployment provenance, reviews the prepared local Champion commit and release packet, and separately approves any redeploy target and rollback plan. |
| change_primary_social_or_bio_link | Primary link changes affect public acquisition flow. | ab_test_status.json | Owner approves exact URL, traffic share, and duration. |
| formal_social_post_or_line_push | External posting and LINE push remain human-only. | weekly_report.md | Owner opens the platform and manually confirms Publish, Send, Broadcast, or Schedule. |
| github_push_or_pr_creation | The Champion feature commit and exact draft PR packet are prepared locally (integration_already_merged_followup_repairs_only), but branch push / PR creation is an external GitHub write; the engine bundle remains a separate local-only handoff. | champion_github_handoff.md | Owner reviews the exact commit and PR body, then explicitly approves branch push or draft PR creation. Merge and deploy remain blocked. |
| execute_owner_approved_launch_sequence | The launch sequence combines remote D1, production Worker, public A/B route, and GitHub publishing decisions. | owner_approval_pack.md | Owner explicitly approves the individual external gates in owner_approval_pack.md. |
| customer_data_or_ecpay_payment_mutation | Customer data, payments, refunds, and ECPay are hard red lines. | n/a | Owner gives a separate, explicit instruction for a reviewed manual operation. |

## Safety Invariants

- Formal post performed: no
- Public link change performed: no
- Challenger promotion performed: no
- LINE push performed: no
- ECPay payment/refund performed: no
- Customer data mutation performed: no
- Production deploy performed: no
- Data delete performed: no

## Rollback

```zsh
cd /Users/mac/Documents/Codex/control-center/3q-growth-loop
npm run schedule:uninstall
```

Remote D1 deletion, Worker rollback, GitHub branch/PR deletion, and public link restoration are owner-reviewed external actions. Do not automate them from this pack.
