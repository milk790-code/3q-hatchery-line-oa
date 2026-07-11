# 3Q Growth Loop Weekly Report

BLUF: Week 0 local engine is prepared, but no real funnel events are present yet. Champion stays unchanged because sample_threshold_met=false.

Generated: 2026-07-10T21:48:20.571Z
Timezone: Asia/Taipei
Week: 2026-06-29 to 2026-07-05
Mode: week0_data_collection

## North Star

Per 100 link clicks: link_click -> line_add -> lead_submit -> deal.

## Current Decision

- Decision: do_not_promote_challenger
- Changed variable this round: cta_text
- One-variable rule: pass
- Sample threshold: not met
- Quality regression: none observed
- External effects performed: none

## Next Round Plan

- Artifact: next_round_plan.md / next_round_plan.json
- Decision: continue_current_round_until_sample_threshold
- Status: continue_current_round
- Current changed variable: cta_text
- Next changed variable: cta_text
- Start new variable round: no
- One-variable rule: pass
- Sample gaps: visits=100, cta_clicks=20, line_adds=5, test_days=3
- Public link change performed: no

## Funnel Scores

| asset_id | role | link_clicks | visits | cta_clicks | line_adds | leads | deals | line_add_rate | test_days | sample_met | decision |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| champion-3q-line-v0 | champion | 0 | 0 | 0 | 0 | 0 | 0 | 0.0% | 0 | no | keep_champion_until_challenger_beats_rule |
| challenger-week0-cta-text-v1 | challenger | 0 | 0 | 0 | 0 | 0 | 0 | 0.0% | 0 | no | keep_testing_sample_insufficient |

## Winners / Losers

- Winner: no winner declared. Sample is insufficient.
- Loser: no loser declared. Insufficient data means the challenger is not retired yet.
- Champion rule: sample不足不換冠軍.

## Candidate Retirement Queue

| asset_id | status | recommended_action | retirement_ready | external_effect |
|---|---|---|---|---|
| challenger-week0-cta-text-v1 | keep_testing_sample_insufficient | keep_in_candidate_rotation | no | no |

## Content Mix Draft

Conservative: keep current champion link and use the candidate only as a reviewed local page.

Aggressive: after owner approval, route 10% small traffic to the challenger for at least 7 days.

Counter-intuitive: do not create more variants yet. Use one sharper CTA and collect real event quality before producing more pages.

## Tracking Links

| link_id | role | target | status | tracking_url |
|---|---|---|---|---|
| track-champion-3q-line-v0 | champion | champion | champion_live_verified_read_only | http://127.0.0.1:8787/r/champion-3q-line-v0?to=champion&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=champion-3q-line-v0&content_id=2026-06-29-champion |
| track-challenger-week0-cta-text-v1 | challenger | challenger | candidate_local_only | http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=challenger-week0-cta-text-v1&content_id=2026-06-29-challenger |
| track-challenger-week0-cta-text-v1-line | line_cta | line | candidate_local_only | http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=line&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=challenger-week0-cta-text-v1-line&content_id=2026-06-29-line-cta |
| post-week0-post-001-cta-v1-diagnostic | content_variant | challenger | draft_only_human_publish_required | http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v1-diagnostic&content_id=week0-post-001 |
| post-week0-post-002-cta-v2-audit | content_variant | challenger | draft_only_human_publish_required | http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v2-audit&content_id=week0-post-002 |
| post-week0-post-003-cta-v3-sample | content_variant | challenger | draft_only_human_publish_required | http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v3-sample&content_id=week0-post-003 |
| ab-ab-week0-cta-text-001 | ab_small_traffic | ab_router | draft_needs_human_link_gate | http://127.0.0.1:8787/ab/ab-week0-cta-text-001?utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&content_id=2026-06-29-ab-router |

## A/B Router

- Routing endpoint: http://127.0.0.1:8787/ab/ab-week0-cta-text-001
- Status endpoint: http://127.0.0.1:8787/ab/status
- Allocation: champion 90% / challenger 10%
- Gate: do not use in public traffic until owner confirms champion URL, traffic share, duration, and rollback.

## Content Variants

| content_id | variant_id | changed_variable | cta_text | tracking_url | gate |
|---|---|---|---|---|---|
| week0-post-001 | cta-v1-diagnostic | cta_text | 加 LINE 領 48h 成交診斷 | http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v1-diagnostic&content_id=week0-post-001 | draft_only_human_publish_required |
| week0-post-002 | cta-v2-audit | cta_text | 丟頁面，先抓成交斷點 | http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v2-audit&content_id=week0-post-002 | draft_only_human_publish_required |
| week0-post-003 | cta-v3-sample | cta_text | 先拿一版可測 CTA | http://127.0.0.1:8787/r/challenger-week0-cta-text-v1?to=challenger&utm_source=manual_review&utm_medium=growth_loop&utm_campaign=week0-cta-text&variant_id=cta-v3-sample&content_id=week0-post-003 | draft_only_human_publish_required |

## Funnel Attribution Breakdown

- Artifact: funnel_breakdown.md / funnel_breakdown.json
- Mode: content_variant_attribution
- Content variant links: 3
- Real events in current scoring file: 0
- External effect: none

| content_id | variant_id | clicks | LINE adds | leads | deals | LINE adds / 100 clicks | leads / 100 clicks | deals / 100 clicks | sample_met |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| week0-post-001 | cta-v1-diagnostic | 0 | 0 | 0 | 0 | n/a | n/a | n/a | no |
| week0-post-002 | cta-v2-audit | 0 | 0 | 0 | 0 | n/a | n/a | n/a | no |
| week0-post-003 | cta-v3-sample | 0 | 0 | 0 | 0 | n/a | n/a | n/a | no |

## Pipeline Status

| step | status | evidence | external_effect |
|---|---|---|---|
| collect_data | local_ready_no_real_events | data/lp_events.jsonl has no real events yet; source_trust=waiting_for_trusted_scoring_input; trusted_sources=0; sample_gate_sources=0; scoring_now=no; source_trust_data_write=no; d1_sync_scope=local; source_readiness=waiting_for_real_data; missing_stages=7; source_capture=ok; source_capture_rows=42; source_compile=waiting_for_filled_counts; source_compile_filled=0; source_compile_fixture=ok; funnel_preview_events=48; funnel_fixture=ok; real_apply_guard=ok; decision_replay=ok; real_intake=no_real_input_files; data_collection=waiting_for_owner_aggregate_counts; data_collection_tasks=42; sample_gate=waiting_for_sample_gate_counts; sample_gate_tasks=18; manual_preview_events=10; line_inbound_playbook=ok; tracking_link_smoke=ok; event_contract=ok | no |
| score_assets | local_complete | growth_scores.json | no |
| winners_losers | local_complete_no_winner_until_threshold | weekly_report.md + candidate_retirement_queue.json | no |
| content_mix | draft_complete_human_publish_gate | content_variants.md + funnel_breakdown.md | no |
| generate_lp_challenger | local_complete | landing_page_candidate.html | no |
| deploy_candidate_worker | prepared_but_blocked | worker_dry_run.md + data/worker_dry_run_status.json | no |
| create_ab_plan | local_complete_pending_link_gate | ab_test_status.json | no |
| weekly_report | local_complete | weekly_report.md | no |
| approval_queue | local_complete | approval_queue.json | no |

## Weekly Automation

- Local runner: npm run weekly:local
- Local schedule: Sunday 00:10 Asia/Taipei
- LaunchAgent template: launchd/com.angelia.3q-growth-loop.weekly.plist
- LaunchAgent installed: yes
- Install performed: yes
- LaunchAgent file installed: yes
- LaunchAgent service loaded: yes
- LaunchAgent status: data/launchagent_status.json
- Rollback command: npm run schedule:uninstall
- Worker cron candidate: 0 16 * * SAT UTC = Sunday 00:00 Taipei
- Last local runner status: success
- Last local runner log: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/logs/weekly-runner-20260710T214317Z.log
- External effects from scheduler: none

## Candidate Worker Dry Run

- Status: ok
- Mode: worker_deploy_dry_run_status
- Command: wrangler deploy --dry-run
- Exit code: 0
- Dry-run exit observed: yes
- Required bindings present: yes
- Production deploy performed: no
- External effect: none
- Report: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/worker_dry_run.md
- Log: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/logs/worker-dry-run-20260710T214607Z.log

## Browser Smoke

- Status: ok
- Mode: local_browser_smoke
- Base URL: http://127.0.0.1:8787
- Checks: 5/5
- Event write performed: no
- External effect: none
- Log: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/logs/browser-smoke-20260710T214611Z.log

## Tracking Link Smoke

- Status: ok
- Mode: isolated_local_tracking_link_smoke
- Links checked: 7/7
- Checks: 7/7
- Isolated link_click events written: 7
- Real event write performed: no
- data/lp_events.jsonl write performed: no
- External effect: none
- Report: tracking_link_smoke.md
- Log: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/logs/tracking-link-smoke-20260710T214615Z.log

## Event Contract Smoke

- Status: ok
- Mode: isolated_local_event_contract_smoke
- Synthetic event counts: {"cta_click":1,"page_view":1}
- Sensitive metadata rejected: yes
- Invalid event rejected: yes
- Isolated fixture event write performed: yes
- Real event write performed: no
- data/lp_events.jsonl write performed: no
- External effect: none
- Log: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/logs/event-contract-smoke-20260710T214626Z.log

## Event Input Quality Gate

- Status: ok
- Mode: real_event_input_quality_gate
- Input: data/lp_events.jsonl
- Rows scanned: 0
- Issues: 0
- Scoring allowed: yes
- Sensitive data detected: no
- Duplicate event IDs: 0
- Unknown asset IDs: 0
- Unknown event types: 0
- data/lp_events.jsonl write performed: no
- External effect: none

## Source Trust Matrix

- Status: ok / waiting_for_trusted_scoring_input
- Mode: source_trust_matrix_local_only
- Trusted scoring sources: 0
- Sample-gate sources: 0
- Scoring allowed now: no
- Real event rows: 0
- P0 pending count: 18
- Sample threshold met: no
- Ready for public iteration decision: no
- data/lp_events.jsonl write performed: no
- External effect: none
- Artifacts: source_trust_matrix.md / source_trust_matrix.json / data/source_trust_matrix_status.json

## Source Readiness

- Status: ok / waiting_for_real_data
- Missing stages: 7
- Ready for public iteration decision: no
- Champion URL ready: yes
- data/lp_events.jsonl write performed: no
- External effect: none

| stage | status | real events | live input exists | ready for decision |
|---|---|---:|---|---|
| link_click | waiting_for_aggregate_input | 0 | no | no |
| page_view | waiting_for_aggregate_input | 0 | no | no |
| cta_click | waiting_for_aggregate_input | 0 | no | no |
| line_add | waiting_for_aggregate_input | 0 | no | no |
| lead_submit | waiting_for_aggregate_input | 0 | no | no |
| deal | waiting_for_aggregate_input | 0 | no | no |
| quality_flag | waiting_for_aggregate_input | 0 | no | no |

## Source Capture Pack

- Status: ok / waiting_for_owner_aggregate_capture
- Mode: source_capture_pack
- Ledger rows: 42
- Sample-gate ledger rows: 18
- Importable tracking links: 6/7
- A/B router gates held out: 1
- Template only: yes
- Owner review required: yes
- Live input files created: no
- data/lp_events.jsonl write performed: no
- External effect: none
- Artifacts: source_capture_pack.md / data/source_capture_status.json / data/source_capture/source_capture_checklist.json / data/source_capture/source_capture_ledger.fill-template.csv / data/source_capture/sample_gate_ledger.fill-template.csv / sample_gate_ledger.md / data/sample_gate_ledger_status.json / sample_gate_ledger_compile_probe.md / data/sample_gate_ledger_compile_probe_status.json

## Source Capture Compile Preview

- Status: ok / waiting_for_filled_counts
- Mode: source_capture_compile_preview
- Input kind: template
- Filled rows: 0
- Funnel preview rows: 0
- Manual preview rows: 0
- Issues: 0
- Owner review required: yes
- Live input files created: no
- data/lp_events.jsonl write performed: no
- External effect: none
- Artifacts: source_capture_compile_report.md / data/source_capture_compile_status.json / data/source_capture/compiled/funnel_aggregates.owner-preview.csv / data/source_capture/compiled/manual_conversions.owner-preview.csv

## Source Capture Compile Fixture Guard

- Status: ok
- Mode: source_capture_compile_fixture_dry_run
- Scenarios: 7
- Local fixture commands executed: yes
- Execution performed: no
- data/lp_events.jsonl write performed: no
- External effect: none
- Artifacts: source_capture_compile_fixture_report.md / data/source_capture_compile_fixture_status.json

## Win Rule Fixtures

- Status: ok
- Mode: win_rule_fixture_dry_run
- Scenarios: 6
- Real event write performed: no
- Challenger promotion performed: no
- Report: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/win_rule_fixture_report.md

## Real Data Decision Replay

- Status: ok
- Mode: real_data_decision_replay_fixture_dry_run
- Scenarios: 6
- Local fixture commands executed: yes
- Local importer preview commands executed: yes
- Execution performed: no
- Real event write performed: no
- data/lp_events.jsonl write performed: no
- External effect: no
- Report: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/real_data_decision_replay_report.md

## Week Archive

- Status: ok
- Archive dir: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/archive/2026-06-29/20260710T214814771Z
- Manifest: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/archive/2026-06-29/20260710T214814771Z/manifest.json
- Files archived: 326/326
- Missing files: 0
- Immutable snapshot: yes
- External effect: none

## Champion Contact Integration Candidate

- Source lock: origin/main commit, git blob, and SHA-256 must all match before generation.
- Contact path: LINE-only; the local false-success form state and personal input controls are removed.
- Telemetry: page_view and cta_click only; credentials omitted; line_add is never inferred from a click.
- Candidate report: champion_integration_candidate.md
- Two-Worker smoke: champion_integration_smoke.md
- Cloudflare D1 metadata readiness: cloudflare_d1_readiness.md
- Prepared local feature commit: champion_local_branch.md
- Clean-archive release preflight: champion_release_preflight.md
- Owner deploy/rollback packet: champion_release_owner_packet.md
- Human gate: review the generated patch and smoke evidence before any production deploy or public-link change.

## Challenger Candidate

- File: landing_page_candidate.html
- Worker: worker.ts
- Worker dry-run: ok / report=/Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/worker_dry_run.md
- Changed variable: cta_text
- CTA text: 加 LINE 領 48h 成交診斷
- Do not promote until line_add_rate > champion * 1.15, sample_threshold_met=true, and no_quality_regression=true.

## A/B Status

```json
{
  "generated_at": "2026-07-10T21:48:20.707Z",
  "test_id": "ab-week0-cta-text-001",
  "status": "sample_insufficient_keep_champion",
  "week": {
    "start": "2026-06-29",
    "end": "2026-07-05",
    "startUtc": "2026-06-28T16:00:00.000Z",
    "endUtc": "2026-07-05T15:59:59.999Z"
  },
  "changed_variable": "cta_text",
  "one_variable_rule_ok": true,
  "traffic_allocation": {
    "champion": 90,
    "challenger": 10
  },
  "routing_endpoint": "http://127.0.0.1:8787/ab/ab-week0-cta-text-001",
  "status_endpoint": "http://127.0.0.1:8787/ab/status",
  "public_link_change_performed": false,
  "production_deploy_performed": false,
  "small_traffic_only": true,
  "events_observed": 0,
  "champion_asset_id": "champion-3q-line-v0",
  "challenger_asset_id": "challenger-week0-cta-text-v1",
  "champion_line_add_rate": 0,
  "challenger_line_add_rate": 0,
  "lift": null,
  "sample_threshold_met": false,
  "no_quality_regression": true,
  "quality_regression_reasons": [],
  "lead_rate_retention_vs_champion": null,
  "close_rate_retention_vs_champion": null,
  "challenger_win_rule_met": false,
  "decision": "do_not_promote_challenger"
}
```

## Approval Queue

| id | tier | status | human gate |
|---|---:|---|---|
| collect-first-real-events | T1 | ready_local_review | Start with local/manual lp_events ingestion or approve D1 connection. |
| approve-d1-create-and-migrate | T2 | pending_human | Confirm the newly observed dedicated D1, separately approve its remote schema migration, and explicitly scope recurring aggregate-only reads. |
| approve-candidate-worker-deploy | T3 | pending_human | Confirm the observed Candidate Worker deployment provenance and rollback reference; do not redeploy unless the live version is rejected. |
| approve-small-ab-link | T3 | pending_human | Approve any small-traffic link routing before changing public links. |
| review-weekly-report | T1 | ready_local_review | Review weekly_report.md before external action. |
| review-champion-contract-audit | T1 | ready_local_review | Review champion_contract_audit.md and confirm the observed LINE-only contract provenance before approving public A/B traffic. |
| review-champion-integration-candidate | T1 | ready_local_review | Review the source-locked 3q-site patch and isolated integration smoke before approving any production deploy. |
| approve-champion-integration-production-deploy | T3 | pending_human | Confirm the current live integration provenance before approving any redeploy of the exact source-locked patch, collector URL, verification steps, and rollback plan. |
| review-next-round-plan | T1 | ready_local_review | Review next_round_plan.md before starting a new public A/B variable or extending the current test. |
| review-owner-approval-pack | T1 | ready_local_review | Review owner_approval_pack.md before approving remote D1, Worker deploy, public A/B routing, or GitHub publishing. |
| review-owner-console | T1 | ready_local_review | Review owner_console.html as the local single-screen approval surface. |
| review-real-data-input-pack | T1 | ready_local_review | Review real_data_input_pack.md before filling aggregate counts or copying templates into live input CSV filenames. |
| review-source-readiness | T1 | ready_local_review | Review source_readiness.md before interpreting sample gaps or approving any public A/B route. |
| review-source-capture-pack | T1 | ready_local_review | Review source_capture_pack.md before filling aggregate source counts or creating live input CSVs. |
| review-source-capture-compile | T1 | ready_local_review | Review source_capture_compile_report.md and owner-preview CSVs before copying them to live aggregate input filenames. |
| review-real-data-intake-plan | T1 | ready_local_review | Review real_data_intake_plan.md to see which aggregate CSV inputs are still missing. |
| review-data-collection-brief | T1 | ready_local_review | Review data_collection_brief.md and sample_gate_collection_plan.md before filling aggregate counts or compiling owner-preview CSVs. |
| review-line-inbound-playbook | T1 | ready_local_review | Review line_inbound_playbook.md before using it in manual LINE replies. |
| review-local-launchagent-install | T1 | completed_local_reversible | Local LaunchAgent is installed. Use npm run schedule:uninstall to stop the Sunday local runner. |
| approve-github-repo-and-pr | T2 | pending_human | Review the prepared local Champion commit, then explicitly approve its branch push or draft PR. Do not merge from this gate. |

## GitHub Handoff

- Artifact: github_handoff.md
- Current local git state: not a git repository
- Gate: do not initialize, push, or open a draft PR until owner confirms the target repository.
- Suggested branch: ang/3q-growth-loop-week0

## Owner Approval Pack

- Artifact: owner_approval_pack.md
- Owner console: owner_console.html
- Launch readiness JSON: launch_readiness.json
- Approval resume plan: approval_resume_plan.md
- Approval resume status: data/approval_resume_status.json
- Post-gate verification: post_gate_verification.md
- Post-gate verification status: data/post_gate_verification_status.json
- Approval input example: owner_approval_input.example.json
- Status: owner_approval_required
- Local preflight: pass
- Pending human approvals: 5
- Owner decision required: yes
- Safety invariants: no formal post, public link change, challenger promotion, LINE push, payment/refund, customer data mutation, production deploy, or data delete.

## Prepared But Blocked

| id | action | blocked_by | artifact |
|---|---|---|---|
| blocked-d1-remote-schema-review | verify_existing_cloudflare_d1_and_apply_schema | Read-only Cloudflare inventory confirms the exact dedicated Growth Loop D1 now exists and matches wrangler.jsonc, but no table query or remote schema migration has been approved or performed. | schema/d1-week0.sql |
| blocked-worker-live-provenance-review | confirm_existing_candidate_worker_provenance | Read-only observation confirms Candidate deployment 5073984b-bcc0-40f1-a331-daaadd741071 / version 133d27b0-36e5-41e8-96ec-b55925b7b30a is healthy and wired to the Champion, but owner provenance evidence is not recorded. A redeploy is not currently required. | live_telemetry_readiness.md |
| blocked-champion-live-provenance-review | confirm_champion_live_contract_provenance_before_redeploy | The LINE-only Champion contract is observable live, but deployment provenance is not owner evidence and any redeploy remains a production action. | champion_integration_candidate.md |
| blocked-primary-link-change | change_primary_social_or_bio_link | Primary link changes affect public acquisition flow. | ab_test_status.json |
| blocked-formal-posting | formal_social_post_or_line_push | External posting and LINE push remain human-only. | weekly_report.md |
| blocked-github-publish | github_push_or_pr_creation | The Champion feature commit and exact draft PR packet are prepared locally (integration_already_merged_followup_repairs_only), but branch push / PR creation is an external GitHub write; the engine bundle remains a separate local-only handoff. | champion_github_handoff.md |
| blocked-owner-launch-sequence | execute_owner_approved_launch_sequence | The launch sequence combines remote D1, production Worker, public A/B route, and GitHub publishing decisions. | owner_approval_pack.md |
| blocked-customer-and-payment | customer_data_or_ecpay_payment_mutation | Customer data, payments, refunds, and ECPay are hard red lines. | n/a |

## Event Source

- Real events file: data/lp_events.jsonl
- Example format: data/lp_events.example.jsonl
- Events observed this run: 0
- D1 sync status: available / scope=local / rows=0
- D1 sync output: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/data/lp_events.d1-local.jsonl
- D1 collection guard: scoring_allowed=no / smoke_rows=0 / real_candidate_rows=0 / data_write=no
- Event input quality: ok / rows=0 / issues=0 / scoring_allowed=yes
- Full funnel aggregate CSV: data/funnel_aggregates.example.csv
- Full funnel aggregate status: available / mode=full_funnel_preview / events=48
- Full funnel aggregate output: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/data/funnel_aggregates.preview.jsonl
- Full funnel aggregate privacy: sensitive_columns=no / sensitive_values=no / apply_performed=no / data_write=no
- Full funnel aggregate fixtures: ok / mode=funnel_aggregate_fixture_dry_run / scenarios=6 / data_write=no
- Real-data apply guard: ok / mode=real_data_apply_fixture_dry_run / scenarios=4 / data_write=no
- Real-data decision replay: ok / mode=real_data_decision_replay_fixture_dry_run / scenarios=6 / ledger=yes / compile=yes / data_write=no / external_effect=no
- Source capture pack: ok / rows=42 / importable_links=6 / live_inputs=no / data_write=no
- Real-data intake plan: ok / status=no_real_input_files / ready_apply=0 / missing_inputs=2 / blocked_inputs=0 / data_write=no
- Data collection brief: ok / status=waiting_for_owner_aggregate_counts / tasks=42 / filled_ledger=no / data_write=no
- Data collection progress: ok / status=waiting_for_p0_sample_gate_counts / tasks=0/42 / pending=42 / p0_pending=18 / p1_pending=24 / next_owner_inputs=9 / data_write=no
- Next P0 owner form: ok / status=ready_local_next_p0_owner_form / rows=9 / browser_only=yes / network=no / fixture=ok / fixture_scenarios=4 / data_write=no
- Next P0 owner intake: ok / status=waiting_for_next_p0_owner_download / found=no / valid=no / preview_rows=0 / staged=no / fixture=ok / fixture_scenarios=5 / data_write=no / external_effect=no
- Sample gate plan: waiting_for_sample_gate_counts / p0_tasks=18 / p0_links=6
- Manual aggregate CSV: data/manual_conversions.example.csv
- Manual conversion status: available / mode=preview / events=10
- Manual conversion output: /Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/data/manual_conversions.preview.jsonl
- Manual conversion privacy: sensitive_columns=no / sensitive_values=no / apply_performed=no
- LINE inbound playbook: ok / mode=line_inbound_fixture_dry_run / scenarios=6
- LINE inbound artifacts: line_inbound_playbook.md / line_inbound_playbook.json / data/line_inbound_fixture_status.json
- Tracking links artifact: tracking_links.json
- Content variants artifact: content_variants.md / content_variants.json
- Funnel breakdown artifact: funnel_breakdown.md / funnel_breakdown.json
- Pipeline artifact: pipeline_status.json
- Schedule artifact: data/schedule_status.json
- Candidate retirement artifact: candidate_retirement_queue.json

## Full Funnel Aggregate Import

- Purpose: preview aggregate counts for link_click, page_view, cta_click, line_add, lead_submit, deal, and quality_flag before remote Worker data is live.
- Default mode: preview only. Preview rows are not scored until owner intentionally applies them to data/lp_events.jsonl.
- Required attribution: content_id and variant_id must be present for every row.
- PII rule: no phone, email, LINE user ID, customer name, address, payment, message, memo, or private note fields.
- Apply gate: npm run import:funnel:apply is local-only but requires --confirm-real-data and refuses copied example/template input.

## Full Funnel Aggregate Fixture Guard

- Artifact: data/funnel_aggregate_fixture_status.json / funnel_aggregate_fixture_report.md
- Status: ok
- Mode: funnel_aggregate_fixture_dry_run
- Scenarios: 6
- Real event write performed: no
- data/lp_events.jsonl write performed: no
- External effect: no

## Real Data Apply Fixture Guard

- Artifact: data/real_data_apply_fixture_status.json / real_data_apply_fixture_report.md
- Status: ok
- Mode: real_data_apply_fixture_dry_run
- Scenarios: 4
- Real event write performed: no
- data/lp_events.jsonl write performed: no
- External effect: no
- Rule: funnel/manual apply requires reviewed real data plus --confirm-real-data; copied example CSVs are blocked.

## Real Data Decision Replay

- Artifact: data/real_data_decision_replay_status.json / real_data_decision_replay_report.md
- Status: ok
- Mode: real_data_decision_replay_fixture_dry_run
- Scenarios: 6
- Local fixture commands executed: yes
- Local importer preview commands executed: yes
- Execution performed: no
- Real event write performed: no
- data/lp_events.jsonl write performed: no
- External effect: no
- Rule: realistic aggregate CSV previews may influence local scoring and next-round planning, but never apply data, promote a challenger, or touch public links.

## Real Data Intake Plan

- Artifact: data/real_data_intake_status.json / real_data_intake_plan.md
- Status: no_real_input_files
- Real input files present: no
- Missing inputs: 2
- Ready for owner apply: 0
- Blocked inputs: 0
- Real events unchanged: yes
- data/lp_events.jsonl write performed: no
- Rule: this plan can preview reviewed aggregate CSVs and produce owner apply commands, but it never appends real events itself.

## Data Collection Brief

- Artifact: data_collection_brief.md / data_collection_queue.json / data/data_collection_brief_status.json
- Status: ok / waiting_for_owner_aggregate_counts
- Tasks: 42
- Stage count: 7
- Importable links: 6
- Sample gate plan: waiting_for_sample_gate_counts / p0_tasks=18 / p0_links=6
- Sample gate artifact: sample_gate_collection_plan.md / sample_gate_collection_plan.json / data/sample_gate_collection_plan_status.json
- Filled ledger exists: no
- Sample threshold met: no
- Real events unchanged: yes
- Live input files created: no
- data/lp_events.jsonl write performed: no
- External effect: no
- Rule: this brief turns missing funnel-stage data into owner-reviewed aggregate-count tasks; it never creates live CSVs or appends real events.

## Data Collection Progress

- Artifact: data_collection_progress.md / data_collection_progress.json / data/data_collection_progress_status.json / next_p0_owner_inputs.md
- Status: ok / waiting_for_p0_sample_gate_counts
- Tasks filled: 0/42
- Pending tasks: 42
- P0 pending: 18/18
- P1 pending: 24/24
- Source groups: 2
- Owner sample gate status: waiting_for_owner_sample_gate_counts
- Next owner inputs exposed: 9
- Sample threshold met: no
- Real events unchanged: yes
- Live input files created: no
- data/lp_events.jsonl write performed: no
- External effect: no
- Rule: this is the Week 0 owner-count progress dashboard. It ranks missing aggregate counts but does not stage live CSVs or score unreviewed data.

## Manual Conversion Import

- Purpose: record LINE adds, lead submits, deals, and quality flags as aggregate counts only.
- Default mode: preview only. Preview rows are not scored until owner intentionally applies them to data/lp_events.jsonl.
- PII rule: no phone, email, LINE user ID, customer name, address, payment, message, memo, or private note fields.
- Apply gate: npm run import:manual:apply is local-only but requires --confirm-real-data and refuses copied example/template input.

## LINE Inbound Playbook

- Artifact: line_inbound_playbook.md / line_inbound_playbook.json
- Fixture status: ok / mode=line_inbound_fixture_dry_run / scenarios=6
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- data/lp_events.jsonl write performed: no
- Rule: inbound-only manual replies; local files store aggregate event counts and bucketed quality only.

## Manual Publish Evidence Form

- Artifact: manual_publish_evidence_form.html
- Status: ok / status=ready_local_manual_publish_evidence_form / packets=3
- Browser only: yes
- Network calls performed: no
- Post URL fetch performed: no
- Live input files created: no
- Fixture guard: ok / mode=manual_publish_evidence_form_fixture_dry_run / scenarios=4
- data/lp_events.jsonl write performed: no
- External effect: no
- Rule: owner can capture post URL/time evidence locally in browser review JSON; the engine does not fetch live posts or create live event inputs.

## Next Step

When the operator says "引擎照這版走", run:

```zsh
cd /Users/mac/Documents/Codex/control-center/3q-growth-loop
npm run week0
npm run d1:local:migrate
```

Stop before remote D1 creation, production deploy, primary link changes, formal posts, LINE pushes, payments, or customer-data mutations.

## Autonomous Judgment

The highest-leverage move is not more creative variants; it is measurement discipline. This engine deliberately starts with one CTA challenger and refuses to change the champion until the funnel has enough visits, CTA clicks, LINE adds, and test days.
