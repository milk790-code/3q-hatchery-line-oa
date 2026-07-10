# Angelia 3Q Growth Loop Operator

BLUF: this folder is a local, reversible Week 0 engine for the 3Q acquisition loop. It prepares measurement, scoring, weekly reports, challenger pages, a candidate Worker, A/B plans, and approval queues without posting, changing public links, deploying production, pushing LINE, touching ECPay, or mutating customer data.

## Skill layer

The curated agent-skill layer lives under `skills/`. Read `skills/README.md` before adding external skills; `skills/skill-registry.json` records source commits, licenses, installation paths, and workflow placement, while `skills/skill-adoption/SKILL.md` defines the security and provenance gate. The adopted lifecycle is `brainstorming → writing-plans → using-git-worktrees → test-driven-development → systematic-debugging (on failure) → verification-before-completion → requesting-code-review → receiving-code-review (when feedback exists) → fresh verification → finishing-a-development-branch`; domain skills and owner/red-line gates remain separate.

The weekly runner is single-owner. It uses an atomic process lock and atomically replaces `data/weekly_runner_status.json`; overlapping manual, LaunchAgent, or agent invocations return `already_running` without executing commands or overwriting the authoritative run.

## What Runs Automatically

- collect_data
- score_assets
- winners_losers
- content_mix
- generate_lp_challenger
- deploy_candidate_worker (dry-run / prepared_but_blocked only)
- worker_dry_run_status (local Wrangler dry-run proof only; no production deploy)
- create_ab_plan
- next_round_plan
- candidate_retirement_queue
- event_input_quality_gate (read-only local `lp_events` privacy/schema check)
- funnel_aggregate_preview (preview-only link click / visit / CTA / LINE / lead / deal aggregate import)
- funnel_aggregate_fixtures (fixture-only guard for importer privacy, attribution, and apply safety)
- real_data_apply_fixtures (fixture-only guard that blocks copied example CSVs and unconfirmed real-data apply)
- real_data_input_pack (template-only fill pack for current tracking links; no live CSV creation)
- source_readiness_monitor (read-only data-source readiness by funnel stage)
- champion_contract_audit (read-only verification of the live champion URL, LINE destination, and lead-capture transport; Worker invocation totals stay diagnostic-only)
- champion_integration_candidate_build (source-locked local 3q-site repair candidate; removes false-success personal-input UI and adds page_view/cta_click telemetry only)
- champion_integration_smoke (two localhost Workers plus isolated temporary D1; verifies exact-origin CORS, privacy rejection, and zero inferred line_add rows)
- live_telemetry_readiness (read-only Candidate deployment, Champion wiring, and dedicated D1 target observation; never queries D1 tables or posts events)
- live_telemetry_readiness_fixtures (fixture-only guard separating deployment provenance, schema evidence, and recurring aggregate-read authorization)
- source_capture_pack (template-only owner capture ledger for aggregate source counts)
- sample_gate_replay_fixtures (fixture-only 18-row sample-gate ledger -> owner-preview CSV -> sample decision replay)
- source_capture_compile (owner-preview compiler for filled source capture ledger; no live CSV creation)
- source_capture_compile_fixtures (fixture-only guard for valid filled rows, empty templates, PII, bad dates, and invalid target files)
- real_data_intake_plan (owner-preview plan for reviewed real aggregate CSVs; no append)
- data_collection_brief (owner-reviewed aggregate-count task queue; no live CSV or `lp_events` write)
- data_collection_progress (read-only progress dashboard and focused Next P0 input selector)
- north_star_outcome_preflight (local P1 link-click / lead / deal / quality aggregate preflight; no live input creation or event write)
- north_star_outcome_form (browser-only local form for the 24 P1 outcome rows; downloads `source_capture_ledger.filled.csv` only)
- north_star_outcome_form_fixtures (static local-only guard for the P1 outcome browser form)
- owner_p1_outcome_intake (local P1 outcome download guard for `source_capture_ledger.filled.csv`; weekly runs validate but never stage)
- owner_p1_outcome_intake_fixtures (fixture-only guard for P1 outcome waiting, valid review, unconfirmed stage, confirmed temp stage, and sensitive blocking)
- owner_p1_outcome_postfill_check (local-only one-click checker after P1 outcome rows are filled; runs whitelisted local npm scripts and performs no stage, apply, event append, deploy, post, push, LINE, customer-data, payment, or delete action)
- week0_owner_capture_queue (one-screen owner queue for 18 P0 sample-gate counts)
- next_p0_owner_form (browser-only focused form for the current 9 Next P0 aggregate rows)
- next_p0_quick_capture (local rank-count adapter for focused Next P0 aggregate rows)
- p0_counts_preflight (local-only paste-template readiness guard before quick capture preview)
- next_p0_owner_intake (preview-only focused owner-download intake for `next_p0_owner_inputs.filled.csv`)
- next_p0_owner_form_fixtures (fixture-only browser-form export contract guard)
- next_p0_quick_capture_fixtures (fixture-only guard for valid quick counts, soft-blocked missing/sensitive counts, and strict fail-fast mode)
- p0_counts_preflight_fixtures (fixture-only guard for waiting, partial, ready, and sensitive blocked paste-template states)
- next_p0_owner_intake_fixtures (fixture-only preview/stage safety guard for focused Next P0 downloads)
- owner_data_preflight (local owner-preview sample-gate and win-rule preflight; no apply)
- sample_gate_capture_calendar (local Day 3 / Day 7 sample-gate review calendar; writes JSON/Markdown/ICS only)
- sample_gate_due_status (local Day 3 / Day 7 due monitor; writes JSON/Markdown only)
- sample_gate_due_fixtures (fixture-only guard for Day 3 waiting/due/overdue recovery and Day 7 due states)
- owner_sample_gate_status (owner-filled sample-gate threshold status; no apply or promotion)
- owner_next_action (single local owner action card; no staging, event write, deploy, post, push, PR, payment, customer-data, or delete action)
- sample_gate_recovery_pack (local Day 3 / Day 7 recovery pack for missing aggregate counts; no fake backfill, event write, promotion, deploy, post, or external action)
- sample_gate_batch_handoff (local full-coverage P0 handoff that splits 18 sample-gate rows into a 9-row focused batch and a 9-row content-variant batch; no live input, event write, or external action)
- owner_sample_count_handoff (one-screen owner handoff for the exact missing aggregate sample counts, including quick filled/missing/partial progress; no live input, event write, deploy, post, or external action)
- owner_p0_now (shortest current P0 action card for sample-count collection; no live input, event write, deploy, post, or external action)
- sample_gate_collection_sprint (timeboxed local P0 sample-gate collection sprint for Day 3 / Day 7 due state and aggregate count gaps; no live input, event write, deploy, post, or external action)
- owner_p0_launcher (P0-only local opener for sample-count collection; opens only local P0 files and performs no network, deploy, post, push, LINE, customer-data, payment, or delete action)
- owner_sample_count_recovery (local recovery coordinator after sample counts are filled; no staging, event write, deploy, post, push, or external action)
- owner_p0_postfill_check (local-only one-click checker after P0 aggregate counts are filled; runs only whitelisted local npm scripts and performs no stage, apply, event append, deploy, post, push, LINE, customer-data, payment, or delete action)
- owner_action_launcher (local one-click opener for console, next action, North Star outcome preflight/form/guard/P1 intake/P1 post-fill status, P0-now card, PreparedButBlocked handoff, approval queue, approval queue status, Worker dry-run report/status, sample-gate recovery, full P0 batch handoff, sample-count handoff, sample-count recovery, P0 post-fill check report/status, focused paste template, P0 counts preflight, sample form, approval form, publish packet, evidence form, and quality form; it prints but does not auto-stage P1 downloads or auto-run the post-fill commands)
- owner_approval_form (browser-only download form for non-secret external-gate approval metadata; no gate execution)
- owner_approval_form_fixtures (fixture-only guard for approval-form exports and plan-only replay)
- sample_gate_owner_form_fixtures (fixture-only guard for browser form CSV download replay through compile and sample gate)
- owner_sample_gate_fixtures (fixture-only guard for owner sample-gate decision paths)
- candidate_retirement_fixtures (fixture-only guard for local candidate retirement decisions)
- north_star_funnel (local per-100-click North Star contract)
- sample_gate_collection_plan (P0 page_view / cta_click / line_add collection fast path; no live CSV or `lp_events` write)
- line_inbound_playbook (inbound-only LINE handoff and aggregate-only conversion guard)
- variable_rotation_fixtures (fixture-only guard for hook / offer / visual_claim / cta_text)
- manual_publish_brief (Day 0 one-packet owner review card; blocks public posting when tracking URL is local-only)
- public_tracking_url_pack (public URL preview and owner gate checklist; no deploy or activation)
- browser_route_smoke (local verification only)
- tracking_link_smoke (isolated local smoke for generated tracking URLs)
- event_contract_smoke (isolated local D1 event-write contract only)
- real_data_decision_replay (fixture-only source-capture ledger -> owner-preview CSV compile -> aggregate CSV import -> score -> A/B -> next-round replay)
- gate_readiness_matrix (local owner-gate dependency and no-autorun guard)
- owner_gate_evidence_intake (evidence-only post-owner-gate metadata validation)
- post_gate_verification_plan (local-only plan after owner evidence; no network read)
- post_gate_verification_fixtures (fixture-only post-gate verification guard; no network read or remote CLI)
- approval_resume_fixtures (fixture-only owner approval resume guard)
- owner_gate_evidence_fixtures (fixture-only post-owner-gate evidence guard)
- github_workflow_guard (local-only GitHub Actions safety guard; no deploy, GitHub write, secrets, or macOS LaunchAgent readback)
- github_export_bundle (copy-only local repo-ready bundle; no git init / commit / push / PR)
- github_actions_weekly_verify (repo-ready workflow; only runs `npm run verify` and uploads review artifacts after owner-approved GitHub push)
- artifact_retention_review_pack (owner-only retention cleanup review queue; no cleanup commands, file mutation, or deletion)
- objective_sequence_audit (local objective-contract verification only)
- archive_weekly_run (local immutable evidence snapshot only)
- owner_console (local review surface only)
- weekly_report
- approval_queue

## Human Gates

- Formal post, schedule, broadcast, or send.
- Changing the main social / bio / LINE link.
- Promoting a challenger to champion.
- LINE push or proactive customer message.
- ECPay payment, refund, or payment-link action.
- Customer data mutation.
- Production deploy, DNS, secrets, IAM, or deletion.

## Files

| File | Purpose |
|---|---|
| `schema/d1-week0.sql` | D1 tables for assets, events, A/B tests, scores, approval queue, and blocked actions. |
| `config/growth-loop.config.json` | One-variable rule, sample thresholds, win rule, assets, and A/B allocation. |
| `scripts/growth-loop.mjs` | Local weekly runner that generates all requested artifacts. |
| `scripts/lib/run-lock-policy.mjs` / `scripts/weekly-runner-lock-fixtures.mjs` | Fail-closed single-owner policy plus isolated proof that a live PID keeps the lock beyond four hours while dead/invalid owners can recover. |
| `scripts/browser-smoke.mjs` | Local Worker route smoke for `/health`, `/candidate`, `/ab/status`, and champion-placeholder gate. |
| `scripts/tracking-link-smoke.mjs` | Isolated local smoke for every URL in `tracking_links.json`; it does not follow external redirects or write real events. |
| `scripts/worker-dry-run-status.mjs` | Runs local `wrangler deploy --dry-run`, captures the dry-run exit proof, and writes review artifacts without deploying. |
| `scripts/build-champion-integration-candidate.mjs` | Pins the configured ref to one commit, verifies that it descends from the locked commit, verifies the locked commit/path/blob/SHA-256 tuple itself, and allows unrelated ref advances only when the target bytes remain exact. |
| `scripts/lib/champion-source-lock.mjs` / `scripts/champion-source-lock-fixtures.mjs` | Shared fail-closed source guard plus isolated cases for exact lock, safe ref advance, annotated ref, target drift, non-ancestor ref, SHA mismatch, and missing-repo fallback. |
| `integrations/3q-site/source/worker.origin-main.js` | Review snapshot only. It may prove bytes, but it cannot prove current-ref ancestry; missing repository state therefore blocks release readiness instead of becoming a CI fallback green light. |
| `integrations/3q-site/generated/worker.candidate.js` / `worker.candidate.patch` | Local-only source-locked live champion integration candidate and review patch; neither is deployed or pushed. |
| `champion_integration_candidate.md` / `data/champion_integration_candidate_status.json` | Candidate build, privacy contract, dry-run, source lock, current-ref ancestry, target-file drift guard, and owner-gate evidence. Unrelated commits may advance the source ref only when the locked 3Q-site blob and SHA-256 remain exact. |
| `scripts/champion-integration-smoke.mjs` | Starts candidate and collector Workers on random localhost and inspector ports with an isolated D1. |
| `champion_integration_smoke.md` / `data/champion_integration_smoke_status.json` | Two-Worker proof for LINE-only contact HTML, accurate anonymous-telemetry disclosure, cross-page sanitized attribution, exact-origin CORS, missing-Origin rejection, rejected top-level/metadata PII, and zero line_add inference. |
| `scripts/live-telemetry-readiness.mjs` | Refreshes sanitized read-only Candidate deployment and public Champion/Candidate GET observations, verifies the `origin-pii-v2` security marker, then combines them with local owner-evidence status. It never runs a D1 table query or event POST. |
| `live_telemetry_readiness.md` / `data/live_telemetry_readiness_status.json` | Current chain decision. A healthy observed Candidate switches to provenance verification only when its security marker is current; an older live version becomes an explicit owner-gated security redeploy. Neither state proves remote schema or recurring-read authorization. |
| `data/live_telemetry_observation_snapshot.json` | Sanitized live observation metadata only; no raw page body, event row, or customer data is retained. |
| `scripts/live-telemetry-readiness-fixtures.mjs` / `live_telemetry_readiness_fixture_report.md` | Six temporary chain-state scenarios proving deployment, security-version, schema, and recurring-read gates stay independent. |
| `src/index.ts` | Candidate Cloudflare Worker for tracking and candidate page serving. |
| `worker_dry_run.md` | Human-readable candidate Worker dry-run proof, including required bindings and red-line flags. |
| `data/worker_dry_run_status.json` | Machine-readable dry-run status proving no production deploy, public link change, GitHub push/PR, LINE push, payment, customer-data mutation, or delete action happened. |
| `landing_page_candidate.html` | Generated candidate landing page. |
| `weekly_report.md` | Generated weekly report. |
| `growth_scores.json` | Generated funnel scoring output. |
| `approval_queue.json` | Generated human approval queue. |
| `data/approval_queue_status.json` | Compact local-only approval queue status with item counts, status/risk/type counts, pending human gates, next local review, and red-line flags. |
| `ab_test_status.json` | Generated A/B state. |
| `tracking_links.json` | Local tracking URLs for champion, challenger, LINE CTA, and draft-only post-level content variants. |
| `content_variants.md` / `content_variants.json` | Draft-only content variants with one changed variable. |
| `funnel_breakdown.md` / `funnel_breakdown.json` | Per-content attribution table grouped by `content_id`, `variant_id`, source, medium, and campaign for LINE adds, leads, and deals per 100 clicks. |
| `north_star_funnel.md` / `north_star_funnel.json` | Local North Star contract for every 100 link clicks -> LINE adds -> leads -> deals, with safety flags and sample-gate status. |
| `next_round_plan.md` / `next_round_plan.json` | Local next-iteration decision: continue current variable, queue owner promotion review, or prepare the next one-variable round. |
| `pipeline_status.json` | Local step-by-step status for the Sunday growth-loop sequence. |
| `data/schedule_status.json` | Local weekly runner and LaunchAgent schedule status. |
| `data/launchagent_status.json` | Current macOS LaunchAgent install/load status and rollback command. |
| `data/schedule_catchup_status.json` / `schedule_catchup_status.md` | Read-only missed-run monitor for the Sunday 00:10 Asia/Taipei cadence. |
| `launchd/com.angelia.3q-growth-loop.weekly.plist` | macOS LaunchAgent template for Sunday local runs. |
| `data/d1_sync_status.json` | Latest D1 export status for the collect_data step. |
| `data/lp_events.d1-local.jsonl` | Local D1 export for review; it does not replace real event input. |
| `d1_collection_guard.md` | Human-readable D1 export guard that classifies local smoke rows and blocks them from sample-gate scoring. |
| `d1_collection_mode.md` / `data/d1_collection_mode_status.json` | Current owner-evidence-driven collection decision and actual local/remote aggregate execution status. |
| `d1_collection_mode_plan.md` / `data/d1_collection_mode_plan_status.json` | Plan-only collection decision used by verification; it never queries D1. |
| `d1_collection_mode_fixture_report.md` / `data/d1_collection_mode_fixture_status.json` | Five plan-only authorization scenarios proving unapproved, mismatched, or incomplete evidence stays local. |
| `d1_aggregate_export_fixture_report.md` / `data/d1_aggregate_export_fixture_status.json` | Fixture-Wrangler proof that the approved path reads grouped counts and excludes raw/customer fields without a real remote call. |
| `data/event_input_quality_status.json` | Read-only quality gate for `data/lp_events.jsonl`; blocks PII, unknown assets, duplicate IDs, malformed rows, and unknown fields before scoring. |
| `data/funnel_aggregates.example.csv` | Aggregate-only full-funnel template for link clicks, page views, CTA clicks, LINE adds, leads, deals, and quality flags. |
| `data/funnel_aggregates.preview.jsonl` | Preview output from full-funnel aggregate import; it is not scored until explicitly applied. |
| `data/funnel_aggregate_status.json` | Latest full-funnel aggregate import status and privacy guard result. |
| `data/funnel_aggregate_fixture_status.json` | Fixture-only aggregate importer guard for unknown assets, missing attribution, sensitive fields, sensitive values, and unsafe apply attempts. |
| `funnel_aggregate_fixture_report.md` | Human-readable full-funnel aggregate fixture report. |
| `data/real_data_apply_fixture_status.json` | Fixture-only real-data apply guard; verifies example/template CSVs and unconfirmed apply commands cannot append to `data/lp_events.jsonl`. |
| `real_data_apply_fixture_report.md` | Human-readable real-data apply fixture report. |
| `data/real_data_input_pack_status.json` | Template-only real-data input pack status; confirms no live CSV or `lp_events` write happened. |
| `real_data_input_pack.md` | Human-readable fill-pack instructions for reviewed aggregate counts. |
| `data/real_data_input_pack/funnel_aggregates.fill-template.csv` | Fill-only full-funnel aggregate template for current tracking links; not scored. |
| `data/real_data_input_pack/manual_conversions.fill-template.csv` | Fill-only manual conversion template for current tracking links; not scored. |
| `data/source_readiness_status.json` | Read-only source readiness status for link clicks, visits, CTA clicks, LINE adds, leads, deals, and quality flags. |
| `source_readiness.md` | Human-readable source readiness report and sample-threshold gaps. |
| `scripts/source-capture-pack.mjs` | Generates the aggregate-only source capture pack from current tracking links and funnel stages. |
| `data/source_capture_status.json` | Source capture pack status; confirms template-only mode and no `lp_events` write. |
| `source_capture_pack.md` | Owner-facing checklist for collecting aggregate counts without customer data. |
| `data/source_capture/source_capture_checklist.json` | Machine-readable source checklist, A/B router gate, and safety rules. |
| `data/source_capture/source_capture_ledger.fill-template.csv` | Fill-only capture ledger for evidence refs and aggregate counts; not scored. |
| `data/source_capture/sample_gate_ledger.fill-template.csv` | 18-row fill-only sample-gate ledger for `page_view`, `cta_click`, and `line_add`; not scored. |
| `sample_gate_ledger.md` | Owner-facing sample-gate ledger instructions and preview compile command. |
| `data/sample_gate_ledger_status.json` | Machine-readable sample-gate ledger status proving no live CSV or `lp_events` write happened. |
| `data/sample_gate_replay_fixture_status.json` | Fixture-only replay status for temporary owner-filled sample-gate ledgers; proves sample decisions without writing `data/lp_events.jsonl`. |
| `sample_gate_replay_fixture_report.md` | Human-readable sample-gate replay report covering sample-insufficient, winning-review, and underperform scenarios. |
| `data/source_capture/source_capture_ledger.filled.csv` | Owner-created working copy of the fill template; not generated by the weekly runner. |
| `data/source_capture/sample_gate_ledger.filled.csv` | Owner-created working copy of the sample-gate fill template; not generated by the weekly runner. |
| `scripts/source-capture-compile.mjs` | Compiles an owner-filled source capture ledger into preview-only aggregate CSV candidates. |
| `data/source_capture_compile_status.json` | Source compile status; confirms no live CSV or `lp_events` write happened. |
| `source_capture_compile_report.md` | Owner-facing compile report, issues, warnings, and next actions. |
| `scripts/source-capture-compile-fixtures.mjs` | Fixture-only source compile guard for valid, empty, partial, sensitive, malformed, and invalid-target ledgers. |
| `data/source_capture_compile_fixture_status.json` | Source compile fixture status; confirms temporary-only runs and no `lp_events` write happened. |
| `source_capture_compile_fixture_report.md` | Human-readable source compile fixture report. |
| `data/source_capture/compiled/funnel_aggregates.owner-preview.csv` | Owner-preview funnel aggregate CSV candidate; not scored and not live. |
| `data/source_capture/compiled/manual_conversions.owner-preview.csv` | Owner-preview downstream conversion CSV candidate; not scored and not live. |
| `data/real_data_intake_status.json` | Owner-preview intake status for real aggregate CSVs; reports missing inputs, preview readiness, blocked inputs, and local apply commands without writing `data/lp_events.jsonl`. |
| `real_data_intake_plan.md` | Human-readable intake plan for reviewed aggregate CSVs and owner-gated local apply commands. |
| `scripts/data-collection-brief.mjs` | Generates the owner-reviewed data collection queue from source readiness, source capture, compile, and intake status. |
| `data_collection_queue.json` | Machine-readable task queue for aggregate count collection across current importable tracking links and funnel stages. |
| `data_collection_brief.md` | Owner-facing collection brief with sample gaps, immediate actions, stage priorities, and safety rules. |
| `data/data_collection_brief_status.json` | Machine-readable status proving the data brief created no live CSVs and did not write `data/lp_events.jsonl`. |
| `scripts/data-collection-progress.mjs` | Generates a read-only progress dashboard for the 42 aggregate data-collection tasks. |
| `data_collection_progress.md` / `data_collection_progress.json` | Local progress dashboard split by P0 sample-gate rows, P1 funnel rows, source surface, and event type. |
| `data/data_collection_progress_status.json` | Compact progress status proving no live CSV creation, no real event write, and no external action happened. |
| `source_trust_matrix.md` / `source_trust_matrix.json` | Local source trust matrix classifying real events, D1 exports, aggregate previews, and owner-preview CSVs as scoring-ready or review-only. |
| `data/source_trust_matrix_status.json` | Compact source trust status with trusted scoring source count, sample-gate source count, and red-line flags. |
| `next_p0_owner_inputs.md` / `next_p0_owner_inputs.json` | Focused short list of the current P0 aggregate-count rows to fill first. |
| `data/next_p0_owner_inputs_status.json` | Compact status for the focused next-input list; proves no live CSV creation, no `lp_events` write, and no external action happened. |
| `next_p0_owner_form.html` | Focused browser-only form for the current 9 Next P0 aggregate rows; downloads review CSV/JSON only and does not stage or apply data. |
| `data/next_p0_owner_form_status.json` | Compact focused-form status proving no network call, browser persistence, live input creation, event write, or external action happened. |
| `next_p0_owner_form_fixture_report.md` | Static fixture report verifying the focused form contains all current inputs, has no network/persistence behavior, and preserves the aggregate-only export contract. |
| `data/next_p0_owner_form_fixture_status.json` | Machine-readable focused-form guard covering HTML/input presence, network/storage absence, export contract, and red-line flags. |
| `next_p0_quick_capture.md` | Local quick adapter report for pasted rank or labelled aggregate totals; can report partially filled paste-template progress, auto-read a complete owner-filled paste template, and create a standard focused CSV preview only. |
| `data/next_p0_quick_capture_status.json` | Compact quick-adapter status exposing filled/missing ranks and proving no inbox write, live CSV creation, stage, event write, or external action happened. |
| `next_p0_quick_capture_fixture_report.md` | Fixture-only quick-adapter guard covering waiting mode, valid rank counts, labelled pasted counts, auto-read complete paste templates, partial paste-template progress, missing ranks, sensitive evidence soft-blocking, and strict fail-fast mode. |
| `data/next_p0_quick_capture_fixture_status.json` | Machine-readable quick-adapter fixture status proving temporary paths only and false red-line flags. |
| `data/next_p0_quick_capture/next_p0_owner_inputs.quick-template.csv` | Regenerated focused quick-fill template using the same owner-download headers as `next-p0:intake`. |
| `data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt` | Owner paste template; replace metadata placeholders and every `<count>`, then let weekly auto-read the complete file or pass it to `--counts-file`. Partial owner edits are preserved. |
| `data/next_p0_quick_capture/next_p0_owner_inputs.quick-filled.preview.csv` | Preview-only quick-filled owner CSV candidate when all ranks are supplied; auto-intaken by `next-p0:intake` into owner-preview CSVs only, never staged or scored by itself. |
| `p0_counts_preflight.md` / `p0_counts_preflight.json` | Local paste-template readiness report for the focused P0 count keys; reports waiting, partial, ready-for-quick, or invalid/sensitive blocked states before quick capture. |
| `data/p0_counts_preflight_status.json` | Compact preflight status exposing ready flag, filled/placeholders/issues, and false red-line flags. |
| `p0_counts_preflight_fixture_report.md` / `data/p0_counts_preflight_fixture_status.json` | Fixture-only guard proving waiting placeholders, partial counts, ready counts, and sensitive metadata blocking without live inputs or event writes. |
| `next_p0_owner_intake.md` | Focused intake report for `next_p0_owner_inputs.filled.csv` or the complete quick-filled preview; validates aggregate-only owner downloads and writes preview CSVs only by default. |
| `data/next_p0_owner_intake_status.json` | Compact focused-intake status proving weekly runs do not auto-stage, write events, create external effects, or mutate customer data. |
| `next_p0_owner_intake_fixture_report.md` | Fixture-only focused-intake guard covering valid preview, sensitive evidence blocking, unconfirmed stage blocking, and confirmed temporary staging. |
| `data/next_p0_owner_intake_fixture_status.json` | Machine-readable focused-intake fixture status proving project live inputs and `data/lp_events.jsonl` are untouched. |
| `data/next_p0_owner_intake/funnel_aggregates.owner-preview.csv` | Preview-only aggregate CSV candidate from the focused owner download; not scored and not live. |
| `data/next_p0_owner_intake/manual_conversions.owner-preview.csv` | Preview-only downstream conversion CSV candidate from the focused owner download; not scored and not live. |
| `scripts/owner-data-preflight.mjs` | Scores reviewed owner-preview aggregate CSVs locally against sample thresholds and challenger win rules without staging, applying, or writing real events. |
| `owner_data_preflight.md` / `owner_data_preflight.json` | Local owner-preview preflight report for sample-gate readiness, win-rule preview, next-round decision, and red-line flags. |
| `data/owner_data_preflight_status.json` | Compact owner-data preflight status proving no live inputs, no `lp_events` write, no deploy, no post, no LINE, no customer-data, no payment, and no delete action happened. |
| `sample_gate_capture_calendar.md` / `sample_gate_capture_calendar.json` | Local sample-gate review calendar for Week 0 Day 3 / Day 7 checks; it does not import Calendar, create reminders, open browsers, write events, or trigger external actions. |
| `sample_gate_capture_calendar.ics` | Importable local calendar file for owner review only; weekly runs generate it but never import it into macOS Calendar. |
| `data/sample_gate_capture_calendar_status.json` | Compact machine-readable capture-calendar status proving no Calendar import, no reminders, no browser open, no `lp_events` write, and no external effect happened. |
| `sample_gate_due_status.md` / `sample_gate_due_status.json` | Local Day 3 / Day 7 due-state monitor that says whether the sample gate is waiting, due now, still insufficient, or ready for owner quality review. |
| `data/sample_gate_due_status_status.json` | Compact due-state status proving no Calendar import, no reminder, no browser open, no `lp_events` write, no promotion, no variable rotation, and no external effect happened. |
| `sample_gate_due_fixture_report.md` | Fixture-only due-state guard proving Day 3 waiting, Day 3 due, Day 3 overdue recovery, and Day 7 due paths. |
| `data/sample_gate_due_fixture_status.json` | Machine-readable due fixture status proving temporary outputs only and no project due-status overwrite. |
| `week0_owner_capture_queue.md` / `week0_owner_capture_queue.json` | One-screen owner queue that narrows Week 0 collection to 18 P0 sample-gate counts grouped by source surface. |
| `data/week0_owner_capture_queue_status.json` | Machine-readable owner capture queue status proving no live CSV or `lp_events` write happened. |
| `owner_sample_gate_status.md` / `owner_sample_gate_status.json` | Owner-filled sample-gate threshold status; reports gaps, possible sample-rate win candidates, and keeps final promotion blocked until quality review. |
| `data/owner_sample_gate_status.json` | Compact machine-readable owner sample-gate status proving no live CSV, no `lp_events` write, and no promotion happened. |
| `sample_gate_owner_worksheet.md` / `sample_gate_owner_worksheet.json` | Local 18-row owner worksheet for collecting only P0 `page_view`, `cta_click`, and `line_add` aggregate counts before any winner decision. |
| `data/sample_gate_owner_worksheet_status.json` | Compact worksheet status proving no live CSV, no `lp_events` write, and no external effect happened. |
| `sample_gate_owner_form.html` | Local browser-only form that validates the same 18 P0 rows and downloads `sample_gate_ledger.filled.csv`; no network, no browser persistence, no event write. |
| `data/sample_gate_owner_form_status.json` | Compact form status proving the HTML is browser-only and did not create live inputs or external effects. |
| `sample_gate_owner_form_fixture_report.md` | Fixture-only browser form export replay report; temporary downloaded CSVs are compiled and checked by owner sample-gate status without live writes or promotion. |
| `data/sample_gate_owner_form_fixture_status.json` | Machine-readable form replay guard covering sample-insufficient, owner-review-ready, and sensitive-evidence-blocked paths. |
| `owner_sample_gate_intake.md` | Local intake guard for owner-downloaded `sample_gate_ledger.filled.csv`; validates aggregate-only data before any optional owner-confirmed staging. |
| `data/owner_sample_gate_intake_status.json` | Machine-readable intake status proving weekly runs do not auto-stage, write events, or create external effects. |
| `owner_sample_gate_intake_fixture_report.md` | Fixture-only owner download intake report covering no-download, valid, sensitive-blocked, unconfirmed-stage, and confirmed-temp-stage paths. |
| `data/owner_sample_gate_intake_fixture_status.json` | Machine-readable intake fixture guard proving staging requires explicit owner confirmation and only uses temporary targets in fixtures. |
| `owner_next_action.md` / `owner_next_action.json` | Single owner action card that ranks the next safest local action from sample gate, focused intake, real-data intake, source trust, quality review, next-round, launch readiness, and approval queue status; staged local aggregate inputs advance to `real-data:intake` preview before any local apply, and partial quick-count progress stays routed to template completion. |
| `data/owner_next_action_status.json` | Compact next-action status exposing focused quick-count filled/missing progress plus source trust/scoring gate state while proving no live input creation, no event write, no external effect, and no red-line action happened. |
| `north_star_outcome_preflight.md` / `north_star_outcome_preflight.json` | Local P1 outcome preflight that validates the 24 link-click, lead, deal, and quality aggregate rows before source compile. |
| `data/north_star_outcome_preflight_status.json` | Compact P1 outcome preflight status exposing filled, pending, invalid, and ready-for-source-compile state while proving no live input creation, no `lp_events` write, and no external effect happened. |
| `north_star_outcome_form.html` | Local browser-only form that validates the same 24 P1 outcome rows and downloads `source_capture_ledger.filled.csv`; no network, no browser persistence, no event write. |
| `data/north_star_outcome_form_status.json` | Compact form status proving the P1 outcome HTML is browser-only and did not create live inputs or external effects. |
| `north_star_outcome_form_fixture_report.md` | Static local-only guard report for the P1 outcome browser form HTML/export contract. |
| `data/north_star_outcome_form_fixture_status.json` | Machine-readable guard proving the form has no network calls, no storage APIs, no external links, no form action, and no red-line effects. |
| `owner_p1_outcome_intake.md` / `owner_p1_outcome_intake.json` | Local P1 outcome owner-download intake guard. It detects `source_capture_ledger.filled.csv` from `data/source_capture/inbox/`, `~/Downloads/`, or `--input`, validates it through outcome preflight and source compile preview, and does not stage unless explicitly run with `--stage --confirm-owner-reviewed`. |
| `data/owner_p1_outcome_intake_status.json` | Compact P1 outcome intake status exposing candidate found/valid, filled/pending outcome rows, compile preview rows, staging state, and red-line flags while proving weekly runs do not write live inputs or `data/lp_events.jsonl`. |
| `owner_p1_outcome_intake_fixture_report.md` / `data/owner_p1_outcome_intake_fixture_status.json` | Fixture-only guard for P1 outcome intake covering no-download waiting, valid review-only, unconfirmed stage block, confirmed temporary stage, and sensitive-value block. |
| `owner_p1_outcome_postfill_check.md` / `owner_p1_outcome_postfill_check.json` / `RUN-P1-OUTCOME-POST-FILL-CHECK.command` | Local-only post-fill checker for the P1 North Star outcome form. After reviewed P1 aggregate rows are placed under `data/source_capture/source_capture_ledger.filled.csv`, it runs only whitelisted local npm scripts to refresh outcome preflight, source compile preview, source trust, weekly report, console, and verifier. |
| `data/owner_p1_outcome_postfill_check_status.json` | Compact P1 post-fill checker status exposing current stage, readiness, source-trust status, command whitelist, blocked actions, and red-line flags while proving no stage/apply/event append/deploy/post/push/LINE/customer-data/payment/delete action happened. |
| `sample_gate_recovery_pack.md` / `sample_gate_recovery_pack.json` | Local Day 3 / Day 7 recovery pack listing the exact missing focused aggregate rows, owner fast path, and post-count command sequence without fabricating counts or writing events. |
| `data/sample_gate_recovery_pack_status.json` | Compact recovery-pack status proving no live input creation, no `lp_events` write, no promotion, no rotation, no external effect, and no red-line action happened. |
| `sample_gate_batch_handoff.md` / `sample_gate_batch_handoff.json` | Local full-coverage P0 handoff that maps all 18 sample-gate aggregate rows into a 9-row focused batch plus a 9-row content-variant batch. |
| `sample_gate_batch_preflight.md` / `sample_gate_batch_preflight.json` | Local full-P0 preflight that validates the owner-filled 18-row sample-gate ledger before source compile. |
| `data/sample_gate_batch_preflight_status.json` | Compact full-P0 preflight status exposing filled, pending, invalid, and ready-for-source-compile state while proving no live input creation, no `lp_events` write, and no external effect happened. |
| `sample_gate_batch_1_paste_block.txt` | Copy-only aggregate-count block for the 9 focused champion / challenger / LINE CTA rows. |
| `sample_gate_batch_2_paste_block.txt` | Copy-only aggregate-count block for the 9 remaining content-variant rows needed before Week 0 P0 is fully covered. |
| `data/sample_gate_batch_handoff_status.json` | Compact batch-handoff status proving no live input creation, no `lp_events` write, no external effect, and no red-line action happened. |
| `owner_sample_count_handoff.md` / `owner_sample_count_handoff.json` | One-screen owner handoff for the current missing sample counts: quick filled/missing/partial progress, direct copy/paste count block, rows, paste keys, source groups, acceptance checks, and after-fill local commands. |
| `owner_sample_count_paste_block.txt` | Copy-only aggregate-count block for `next_p0_owner_inputs.counts-paste-template.txt`; contains placeholders only and is never auto-applied as real data. |
| `data/owner_sample_count_handoff_status.json` | Compact sample-count handoff status exposing quick progress and proving no live input creation, no `lp_events` write, no external effect, and no red-line action happened. |
| `owner_p0_now.html` / `owner_p0_now.md` / `owner_p0_now.json` | Shortest current P0 owner action cockpit/card: what to open first, focused missing counts, full P0 coverage, embedded Batch 1 / Batch 2 copy blocks, P0 counts preflight readiness/issues, full 18-row sample-gate form/intake status, approval gate, after-fill commands, and stop lines. |
| `data/owner_p0_now_status.json` | Compact P0-now status exposing focused/full P0 counts, quick-count progress, copy block counts, P0 counts preflight status/readiness/issues, full P0 form/intake status, approval gate, primary open targets, and red-line flags. |
| `sample_gate_collection_sprint.md` / `sample_gate_collection_sprint.json` | Local timeboxed collection sprint that turns Day 3 / Day 7 due state plus P0 count gaps into Batch 1, preview, Batch 2, recompute, and decision steps without touching live inputs or external systems. |
| `data/sample_gate_collection_sprint_status.json` | Compact sprint status exposing due state, P0 pending count, focused missing count, sprint step count, owner open targets, and false red-line flags. |
| `owner_p0_launcher.md` / `OPEN-P0-SAMPLE-GATE.command` | Narrow P0-only local launcher for the current sample-count blocker: opens P0-now, full P0 batch handoff, Batch 1 / Batch 2 paste blocks, focused paste template, P0 preflight, full sample-gate form/intake, count handoff/recovery, and due status. |
| `data/owner_p0_launcher_status.json` | Compact P0 launcher status exposing current due state, focused/full P0 counts, quick-count progress, preflight readiness, full P0 form/intake, approval queue gate, target list, and red-line flags. |
| `owner_sample_count_recovery.md` / `owner_sample_count_recovery.json` | Local coordinator that shows whether focused quick capture, focused intake, full 18-row P0 owner form/intake, owner preflight, and weekly verification recovered after aggregate counts were filled. |
| `data/owner_sample_count_recovery_status.json` | Compact sample-count recovery status exposing focused/full P0 recovery stage, full form/intake readiness, and red-line flags while proving no `lp_events` write or external effect happened. |
| `owner_p0_postfill_check.md` / `owner_p0_postfill_check.json` / `RUN-P0-POST-FILL-CHECK.command` | Local-only post-fill checker. After owner aggregate counts are filled, it runs only whitelisted local npm scripts to refresh quick capture, intake, owner preflight, sample gate, source trust, recovery, weekly report, console, and verifier. |
| `data/owner_p0_postfill_check_status.json` | Compact post-fill checker status exposing current stage, readiness, source-trust status, command whitelist, blocked actions, and red-line flags while proving no stage/apply/event append/deploy/post/push/LINE/customer-data/payment/delete action happened. |
| `owner_sample_count_recovery_fixture_report.md` | Fixture-only recovery report for waiting, quick-ready, focused-intake-ready, full-P0-intake-ready, confirmed local stage, preflight, sample-ready, win-review, and red-line violation states. |
| `data/owner_sample_count_recovery_fixture_status.json` | Machine-readable sample-count recovery fixture status proving temporary-root execution only and no project write or external action. |
| `owner_next_action_fixture_report.md` | Fixture-only routing guard proving invalid P0 paste values route to the P0 preflight fix card, staged Next P0 inputs move to real-data preview, preview-ready real data moves to owner apply review, and blocked real-data inputs stay blocked. |
| `data/owner_next_action_fixture_status.json` | Machine-readable owner next-action fixture status proving temporary-root routes create no project writes, event writes, or external effects. |
| `OPEN-3Q-GROWTH-LOOP.command` | Local launcher that opens the owner console, next-action card, P0-now card, PreparedButBlocked handoff, approval queue, approval queue compact status, sample-gate recovery pack, full P0 batch handoff, sample-count handoff, sample-count recovery status, P0 post-fill check report/status, focused Next P0 form/intake, focused paste template, capture calendar, sample gate form, manual publish packet, manual publish evidence form, and quality review form; its Terminal first screen also prints the current primary action, P0-now status, full P0 form/intake status, focused quick-count filled/missing progress, sample-count recovery readiness, P0 post-fill check readiness, full P0 batch coverage, and approval queue counts. It does not auto-run `RUN-P0-POST-FILL-CHECK.command`. |
| `owner_action_launcher.md` | Human-readable launcher report, quick-count progress, P0 counts preflight readiness, full P0 form/intake status, sample-count recovery status, P0 post-fill checker status, source trust/scoring gate state, full P0 batch handoff status, approval queue status, after-fill handoff pointer, and safety contract. |
| `data/owner_action_launcher_status.json` | Machine-readable launcher status exposing current primary action, quick-count progress, P0 counts preflight readiness, sample-count recovery readiness, P0 post-fill checker readiness, source trust/scoring gate state, full P0 batch handoff counts, approval queue counts, next local review, and next pending human gate while proving it opens local files only and performs no network, deploy, publish, LINE, customer-data, payment, delete, or GitHub action. |
| `data/owner_sample_gate_fixture_status.json` | Fixture-only owner sample-gate guard covering missing, partial, insufficient, winning-review, underperform, and sensitive-evidence paths. |
| `owner_sample_gate_fixture_report.md` | Human-readable owner sample-gate fixture report. |
| `owner_quality_review.md` / `owner_quality_review.example.json` | Local aggregate quality-review gate for no-quality-regression evidence after a sample-rate winner; example only, no live owner input created. |
| `data/owner_quality_review_status.json` | Machine-readable quality review status proving no event write, no approval queue write, and no challenger promotion happened. |
| `owner_quality_review_form.html` | Local browser-only form that validates aggregate quality evidence and downloads `owner_quality_review.filled.json`; no network, no browser persistence, no event write, no approval queue write. |
| `data/owner_quality_review_form_status.json` | Compact form status proving the quality-review HTML is browser-only and did not create live inputs or external effects. |
| `owner_quality_review_form_fixture_report.md` | Fixture-only quality-review browser form export replay report; temporary downloaded JSON is checked by owner quality-review status without live writes or promotion. |
| `data/owner_quality_review_form_fixture_status.json` | Machine-readable quality-review form replay guard covering waiting, pass, regression, and sensitive-input paths. |
| `owner_quality_review_fixture_report.md` | Human-readable quality-review fixture report. |
| `data/owner_quality_review_fixture_status.json` | Fixture-only quality-review guard covering waiting, missing evidence, pass, regression, sensitive evidence, and missing-field paths. |
| `data/candidate_retirement_fixture_status.json` | Fixture-only candidate retirement guard covering sample-insufficient, owner-review, underperformance, quality-regression, unknown-candidate, and mixed-candidate paths. |
| `candidate_retirement_fixture_report.md` | Human-readable candidate retirement fixture report. |
| `sample_gate_collection_plan.md` / `sample_gate_collection_plan.json` | P0 sample-gate collection plan that narrows Week 0 collection to page views, CTA clicks, and LINE adds before any winner decision. |
| `data/sample_gate_collection_plan_status.json` | Machine-readable sample-gate status proving the plan created no live CSVs and did not write `data/lp_events.jsonl`. |
| `iteration_history.md` / `iteration_history.json` | Local-only 7-day iteration history across current artifacts and archive manifests; records sample gaps, north-star metrics, owner gates, and next safe actions. |
| `data/manual_conversions.example.csv` | Aggregate-only manual conversion template for LINE adds, leads, deals, and quality flags. |
| `data/manual_conversions.preview.jsonl` | Preview output from manual conversion import; it is not scored until explicitly applied. |
| `data/manual_conversion_status.json` | Latest manual conversion import status and privacy guard result. |
| `line_inbound_playbook.md` / `line_inbound_playbook.json` | Inbound-only LINE customer-service handoff, reply templates, qualification buckets, and aggregate event mapping. |
| `manual_publish_packet.md` / `manual_publish_packet.json` | Draft-only publish packet pairing content variants, tracking links, candidate landing target, LINE inbound handoff, and owner manual steps. |
| `data/manual_publish_packet_status.json` | Compact manual publish packet status proving no formal post, schedule, LINE push, public-link change, deploy, GitHub push/PR, customer-data mutation, payment action, delete action, or real event write happened. |
| `manual_publish_capture_plan.md` / `manual_publish_capture_plan.json` | Local Day 3 / Day 7 aggregate-count capture plan after the owner manually publishes one reviewed packet. |
| `data/manual_publish_capture_plan_status.json` | Compact capture-plan status proving no automatic publish, no LINE push, no public-link change, no deploy, no GitHub push/PR, no customer-data mutation, no payment action, no deletion, and no real event write happened. |
| `manual_publish_brief.md` / `manual_publish_brief.json` | Local Day 0 owner review card for one selected packet; it blocks formal posting when the selected tracking URL is still local-only. |
| `data/manual_publish_brief_status.json` | Compact publish-brief status proving no formal post, schedule, LINE push, public-link change, deploy, GitHub push/PR, customer-data mutation, payment action, deletion, or real event write happened. |
| `public_tracking_url_pack.md` / `public_tracking_url_pack.json` | Local public tracking URL handoff that preserves the selected `/r/...` route shape under an owner-approved Worker URL placeholder. |
| `data/public_tracking_url_pack_status.json` | Compact public URL pack status proving no Worker deploy, public URL activation, formal post, public-link change, LINE push, GitHub push/PR, customer-data mutation, payment action, deletion, or real event write happened. |
| `owner_public_url_approval_preview.md` / `owner_public_url_approval_preview.json` | Local owner approval checklist for the public URL path; previews the non-secret `owner_approval_input.json` fields needed for D1, Worker, and public A/B gates without creating the live input file. |
| `data/owner_public_url_approval_preview_status.json` | Compact approval-preview status proving no live approval input creation, no Worker deploy, no public URL activation, no formal post, no LINE push, no GitHub push/PR, no customer-data mutation, no payment action, no deletion, and no real event write happened. |
| `manual_publish_evidence.md` / `manual_publish_evidence.example.json` | Local owner-supplied manual-publish evidence intake; validates one non-sensitive published packet reference and calculates Day 3 / Day 7 capture dates. |
| `data/manual_publish_evidence_status.json` | Compact manual-publish evidence status proving no URL fetch, no automatic publish, no LINE push, no public-link change, no deploy, no GitHub push/PR, no customer-data mutation, no payment action, no deletion, and no real event write happened. |
| `manual_publish_evidence_form.html` | Local browser-only form for owner manual-publish evidence; validates one packet reference and downloads `manual_publish_evidence.json` without network calls, persistence, URL fetch, posting, LINE, deploy, or real event writes. |
| `data/manual_publish_evidence_form_status.json` | Compact form status proving the manual-publish evidence HTML is browser-only and did not create live inputs or external effects. |
| `manual_publish_evidence_form_fixture_report.md` | Fixture-only browser-form contract and exported JSON replay report for valid Day 3 / Day 7 paths plus sensitive and missing-confirmation blocks. |
| `data/manual_publish_evidence_form_fixture_status.json` | Machine-readable manual-publish evidence form guard proving temporary-only replay, no live owner input creation, and no external effect. |
| `manual_publish_evidence_fixture_report.md` | Fixture-only manual-publish evidence intake report covering missing input, valid Day 3 / Day 7 states, unknown packet, sensitive value, multi-packet, and missing-confirmation blocks. |
| `data/manual_publish_evidence_fixture_status.json` | Machine-readable manual-publish evidence fixture guard proving temporary-only runs and no external effect. |
| `data/line_inbound_fixture_status.json` | Fixture-only guard for LINE inbound aggregate rows; blocks sensitive columns, sensitive values, raw chat messages, LINE push, and customer-data mutation. |
| `line_inbound_fixture_report.md` | Human-readable LINE inbound fixture report. |
| `data/variable_rotation_fixture_status.json` | Fixture-only one-variable rotation status for `hook`, `offer`, `visual_claim`, and `cta_text`; confirms locked variables stay fixed. |
| `variable_rotation_fixture_report.md` | Human-readable one-variable rotation fixture report. |
| `data/browser_smoke_status.json` | Latest local route smoke status; it does not click LINE or write funnel events. |
| `tracking_link_smoke.md` | Human-readable generated-link smoke report. |
| `data/tracking_link_smoke_status.json` | Isolated local smoke status for generated tracking links; it writes only temporary local D1 link clicks. |
| `data/event_contract_smoke_status.json` | Isolated local D1 smoke for `/e` event writes, sensitive metadata rejection, and invalid event rejection. |
| `data/win_rule_fixture_status.json` | Fixture-only win-rule regression status; it does not write real events. |
| `win_rule_fixture_report.md` | Human-readable fixture report for sample thresholds, winner logic, and quality regression. |
| `data/real_data_decision_replay_status.json` | Fixture-only real-data-shaped decision replay status; temporary filled source-capture ledgers are compiled into owner-preview aggregate CSVs, imported, scored, and evaluated without writing `data/lp_events.jsonl`. |
| `real_data_decision_replay_report.md` | Human-readable replay report for sample-insufficient, winner-review, underperform, spam, lead-regression, and close-regression decisions. |
| `data/approval_resume_fixture_status.json` | Fixture-only owner approval resume status; it blocks placeholders, sensitive fields, invalid public URLs, and manual-only automation. |
| `approval_resume_fixture_report.md` | Human-readable approval resume fixture report; it performs no external action. |
| `data/week_archive_status.json` | Latest local archive snapshot status, manifest path, file count, and safety flags. |
| `archive/<week>/<timestamp>/manifest.json` | Immutable local evidence snapshot manifest with sha256 hashes for weekly artifacts. |
| `candidate_retirement_queue.json` | Local rotation queue for keeping, retiring, or reviewing challengers without deleting data. |
| `goal_completion_audit.md` | Requirement-by-requirement audit; intentionally stays not complete while external gates remain. |
| `data/goal_completion_audit_status.json` | Compact machine-readable completion audit status; keeps `complete:false` until external owner gates are approved and verified. |
| `objective_sequence_audit.md` / `objective_sequence_audit.json` | Local contract audit for the original weekly sequence, one-variable rule, sample gate, win rule, outputs, iteration history, owner approval metadata gate, approval queue, and red lines. |
| `data/objective_sequence_audit_status.json` | Compact machine-readable status for the objective contract audit, including owner approval form coverage. |
| `.github/workflows/3q-growth-loop-weekly.yml` | Repo-ready GitHub Actions workflow for Sunday 00:10 Asia/Taipei verification; it runs `npm run verify` and uploads review artifacts only. |
| `github_workflow_guard.md` / `github_workflow_guard.json` | Local GitHub Actions safety guard report; verifies the weekly workflow stays review-only, read-only, artifact-uploading, and free of deploys, GitHub writes, secrets, LINE/payment actions, and macOS LaunchAgent readback. |
| `data/github_workflow_guard_status.json` | Compact machine-readable GitHub workflow guard status with failed-check count and red-line flags. |
| `launch_readiness.json` | Machine-readable owner-gate map, local preflight evidence, safety invariants, and resume commands. |
| `owner_approval_pack.md` | Human-readable approval pack for remote D1, Worker deploy, public A/B routing, GitHub, and manual-only actions. |
| `owner_console.html` | Local single-screen review console for report, next-round decision, focused Next P0 form / quick capture / intake status, P0-now action card, weekly schedule / LaunchAgent status, Day 3 / Day 7 due status and fixture guard, iteration history, approval queue, archive, retention review, PreparedButBlocked handoff, and red lines. |
| `data/owner_console_status.json` | Latest owner console generation status and safety flags. |
| `data/owner_console_smoke_status.json` | Local HTML safety smoke status for the owner console. |
| `approval_resume_plan.md` | Dry-run resume plan for owner-approved gates; command preview only, no external execution. |
| `data/approval_resume_status.json` | Machine-readable status for the dry-run resume planner. |
| `owner_approval_form.html` | Browser-only local form that downloads non-secret `owner_approval_input.json` metadata; it does not execute gates. |
| `data/owner_approval_form_status.json` | Machine-readable status for the owner approval form. |
| `owner_approval_form_fixture_report.md` | Fixture-only report proving approval-form exports stay plan-only and block placeholder or sensitive metadata. |
| `data/owner_approval_form_fixture_status.json` | Machine-readable owner approval form fixture status; no live input is created. |
| `owner_gate_evidence.md` | Evidence-only intake report for owner-executed external gates; no external action. |
| `data/owner_gate_evidence_status.json` | Machine-readable post-gate evidence validation status. |
| `owner_gate_evidence.example.json` | Non-secret post-gate evidence template; copy to ignored `owner_gate_evidence.json` only after the owner manually completes a gate. |
| `owner_gate_evidence_fixture_report.md` | Fixture-only report proving owner-gate evidence validation handles missing, placeholder, valid, sensitive, duplicate, manual-only, A/B, and GitHub evidence safely. |
| `data/owner_gate_evidence_fixture_status.json` | Machine-readable owner-gate evidence fixture status; no external command is executed. |
| `post_gate_verification.md` | Local-only post-gate verification plan; no network read or remote CLI. |
| `data/post_gate_verification_status.json` | Machine-readable post-gate verification readiness status. |
| `post_gate_verification_fixture_report.md` | Fixture-only report proving post-gate verification handles waiting, dependency, ready, manual-only, and invalid-evidence states safely. |
| `data/post_gate_verification_fixture_status.json` | Machine-readable post-gate verification fixture status; no network read, remote CLI, or external command is executed. |
| `gate_readiness.md` | Local owner-gate dependency matrix, execution order, and no-autorun status. |
| `data/gate_readiness_status.json` | Machine-readable gate readiness matrix for remote D1, Worker deploy, public A/B routing, GitHub, and manual-only gates. |
| `owner_approval_input.example.json` | Non-secret approval metadata template; copy to `owner_approval_input.json` only after owner approval. |
| `github_export_manifest.md` | Human-readable manifest for the copy-only GitHub repo-ready export bundle. |
| `data/github_export_status.json` | Machine-readable status for the local GitHub export bundle. |
| `github_export/bundles/<timestamp>/` | Ignored local repo-ready snapshot for owner-approved GitHub import; no git action is performed. |
| `artifact_retention.md` | Human-readable local artifact retention monitor for GitHub export bundles, weekly archives, and logs; cleanup remains owner-only. |
| `data/artifact_retention_status.json` | Machine-readable retention status, warning count, owner-only cleanup candidates, and red-line flags. |
| `artifact_retention_review_pack.md` / `artifact_retention_review_pack.json` | Owner-only cleanup review pack generated from the retention monitor; it ranks local artifact sections for manual review but never creates cleanup commands or mutates files. |
| `data/artifact_retention_review_status.json` | Compact retention review status with candidate counts, review requirement, no-command flags, and red-line flags. |
| `scripts/artifact-retention-review-pack.mjs` | Generates the retention review pack from `data/artifact_retention_status.json` without deletion primitives, filesystem mutation, or external effects. |
| `prepared_but_blocked.json` | Generated machine-readable red-line queue. |
| `prepared_but_blocked.md` / `data/prepared_but_blocked_report_status.json` | Human-readable PreparedButBlocked handoff and compact status; covers every blocked external / human-only action without executing it. |
| `worker.ts` | Generated copy of the candidate Worker artifact. |
| `logs/` | Local runner logs. |

## Commands

```zsh
cd /Users/mac/Documents/Codex/control-center/3q-growth-loop
npm run collect:d1:auto
npm run d1:collection:fixtures
npm run d1:aggregate:fixtures
npm run event:quality
npm run import:funnel:preview
npm run funnel:fixtures
npm run apply:fixtures
npm run real-data:pack
npm run source:readiness
npm run source:capture
npm run sample-gate:compile-probe
npm run sample-gate:replay
npm run source:compile
npm run source:compile:fixtures
npm run real-data:intake
npm run data:brief
npm run data:progress
npm run next-p0:form
npm run next-p0:quick
npm run p0:counts-preflight
npm run next-p0:intake
npm run owner:data-preflight
npm run next-p0:form:fixtures
npm run next-p0:quick:fixtures
npm run p0:counts-preflight:fixtures
npm run next-p0:intake:fixtures
npm run sample-gate:calendar
npm run owner:capture-queue
npm run owner:sample-gate
npm run owner:worksheet
npm run owner:form
npm run owner:form:fixtures
npm run owner:intake
npm run owner:intake:fixtures
npm run owner:sample-gate:fixtures
npm run owner:quality-review
npm run owner:quality-review:form
npm run owner:quality-review:form:fixtures
npm run owner:quality-review:fixtures
npm run owner:next-action
npm run north-star:outcome-preflight
npm run north-star:outcome-form
npm run north-star:outcome-form:fixtures
npm run owner:p1-outcome-intake
npm run owner:p1-outcome-intake:fixtures
npm run owner:p1-outcome-postfill-check
npm run sample-gate:recovery
npm run sample-gate:batches
npm run sample-gate:batch-preflight
npm run owner:sample-count-handoff
npm run owner:p0-now
npm run owner:sample-count-recovery
npm run owner:p0-postfill-check
npm run owner:sample-count-recovery:fixtures
npm run owner:launcher
npm run owner:approval-form
npm run owner:approval-form:fixtures
npm run north-star
npm run retirement:fixtures
npm run history:iteration
npm run import:manual:preview
npm run line:playbook
npm run manual:publish-packet
npm run manual:capture-plan
npm run manual:publish-brief
npm run public:tracking-pack
npm run owner:public-url-approval-preview
npm run manual:publish-evidence
npm run manual:publish-evidence:form
npm run manual:publish-evidence:form:fixtures
npm run manual:publish-evidence:fixtures
npm run variable:fixtures
npm run champion:integration:build
npm run browser:smoke
npm run event:smoke
npm run champion:integration:smoke
npm run win-rule:fixtures
npm run decision:replay
npm run approval:plan
npm run owner:evidence
npm run owner:evidence:fixtures
npm run post:verify
npm run post:verify:fixtures
npm run gate:readiness
npm run redline:priority
npm run approval:fixtures
npm run github:workflow-guard
npm run artifacts:retention
npm run artifacts:retention-review
npm run github:bundle
npm run artifacts:retention
npm run artifacts:retention-review
npm run objective:audit
npm run archive:week
npm run owner:console
npm run owner:console:smoke
npm run weekly:local
npm run schedule:install
npm run schedule:status
npm run schedule:catchup
npm run schedule:uninstall
npm run week0
npm run verify
npm run goal:audit
npm run d1:local:migrate
npm run types
npm run worker:dry-run:status
npm run worker:dry-run
npm run d1:local:approval
npm run telemetry:readiness:live
npm run telemetry:readiness:fixtures
```

Use the npm scripts so this project uses its local Wrangler version. Prefer `npm run worker:dry-run:status` because it records `worker_dry_run.md` and `data/worker_dry_run_status.json`. `wrangler deploy --dry-run` is allowed for validation. Do not run a real `wrangler deploy` until the owner approves the deploy target, route, rollback path, and external risk.

Run local D1 commands sequentially. Do not run `d1:local:migrate` and `d1:local:counts` in parallel because the local SQLite-backed D1 state can lock.

`collect:d1:local` exports local D1 `lp_events` into `data/lp_events.d1-local.jsonl`, updates `data/d1_sync_status.json`, and writes `d1_collection_guard.md`. It does not overwrite `data/lp_events.jsonl`, because local smoke events should not be treated as real funnel data. The guard must show `Scoring input allowed: no` for local exports.

`collect:d1:auto` is the weekly `collect_data` entrypoint. It refreshes local owner-evidence and post-gate status, then stays on `collect:d1:local` unless all of these are true: valid D1 owner evidence exists, `recurring_aggregate_read_approved` is explicitly `true`, post-gate verification is ready, live D1 metadata matches the configured dedicated database, and evidence name/id match that target. The approved path uses grouped-count SQL only; raw remote event export is disabled.

`telemetry:readiness:live` performs a read-only refresh of Candidate deployment metadata plus public GET checks for Candidate health/page, the `origin-pii-v2` security marker, and Champion wiring. It records sanitized metadata only. Cloudflare D1 inventory `num_tables` is explicitly non-authoritative: `0` never proves the remote schema is absent, so schema readiness still requires owner-recorded migration/verification evidence. A healthy, security-current Candidate enters `verify_existing_candidate_deployment`; a healthy older version enters `deploy_candidate_worker_security_update` and remains behind the production-deploy owner gate.

`import:funnel:preview` converts aggregate full-funnel CSV counts into `data/funnel_aggregates.preview.jsonl` and updates `data/funnel_aggregate_status.json`. It requires `content_id` and `variant_id` so post drafts can be attributed, and it does not score the rows or write to `data/lp_events.jsonl`.

`funnel:fixtures` runs fixture-only importer regression scenarios for valid preview, unknown asset, missing `content_id`, sensitive column, sensitive value, and apply-without-append blocking. It writes `data/funnel_aggregate_fixture_status.json` and `funnel_aggregate_fixture_report.md`; it uses temporary files and never writes `data/lp_events.jsonl`.

`apply:fixtures` runs fixture-only real-data apply guard scenarios. It verifies `import:funnel:apply` and `import:manual:apply` require `--confirm-real-data`, reject copied example/template CSVs, and leave `data/lp_events.jsonl` unchanged. It writes `data/real_data_apply_fixture_status.json` and `real_data_apply_fixture_report.md`.

`real-data:pack` generates fill-only templates under `data/real_data_input_pack/` from the current Week 0 tracking links and content variants. It does not create `data/funnel_aggregates.csv` or `data/manual_conversions.csv`, and it never writes `data/lp_events.jsonl`. After manually filling aggregate counts, copy the templates to the live input filenames, then run `npm run real-data:intake`.

`source:readiness` checks each north-star funnel event stage against the current real events, live input CSVs, source templates, intake status, sample thresholds, and champion URL readiness. It writes `data/source_readiness_status.json` and `source_readiness.md`. It is read-only and never creates live input CSVs, appends `data/lp_events.jsonl`, deploys, posts, pushes LINE, changes public links, mutates customer data, processes payments, or deletes data.

`source:capture` generates `source_capture_pack.md`, `data/source_capture_status.json`, `data/source_capture/source_capture_checklist.json`, `data/source_capture/source_capture_ledger.fill-template.csv`, `data/source_capture/sample_gate_ledger.fill-template.csv`, `sample_gate_ledger.md`, and `data/sample_gate_ledger_status.json`. It maps current tracking links across `link_click`, `page_view`, `cta_click`, `line_add`, `lead_submit`, `deal`, and `quality_flag`; it also creates an 18-row sample-gate fill pack for `page_view`, `cta_click`, and `line_add`. It keeps the A/B router behind an owner gate, creates no live input CSVs, and never writes `data/lp_events.jsonl`. Do not fill templates directly, because the weekly runner regenerates them. Copy the full template to `data/source_capture/source_capture_ledger.filled.csv`, or the sample-gate template to `data/source_capture/sample_gate_ledger.filled.csv`, before filling counts.

`sample-gate:replay` runs temporary filled copies of `data/source_capture/sample_gate_ledger.fill-template.csv` through the existing source compiler and importers, then checks sample-insufficient, winning-review-only, and underperform decisions. It writes `data/sample_gate_replay_fixture_status.json` and `sample_gate_replay_fixture_report.md`; it does not create `data/source_capture/sample_gate_ledger.filled.csv`, live aggregate CSVs, or append `data/lp_events.jsonl`.

`source:compile` reads `data/source_capture/source_capture_ledger.filled.csv` when present, otherwise the fill template, validates aggregate counts, optional `quality_score` on `quality_flag` rows, evidence refs, `pii_checked`, target live files, and sensitive-looking owner fields, then writes `source_capture_compile_report.md`, `data/source_capture_compile_status.json`, `data/source_capture/compiled/funnel_aggregates.owner-preview.csv`, and `data/source_capture/compiled/manual_conversions.owner-preview.csv`. It is preview-only: it does not create `data/funnel_aggregates.csv`, does not create `data/manual_conversions.csv`, and never writes `data/lp_events.jsonl`.

`source:compile:fixtures` runs temporary compiler fixtures for valid filled rows with preserved `quality_score`, empty templates, partial rows with blank counts, missing `pii_checked`, sensitive evidence refs, invalid dates, and invalid target files. It writes `data/source_capture_compile_fixture_status.json` and `source_capture_compile_fixture_report.md`; it uses temporary files and never creates live aggregate CSVs or writes `data/lp_events.jsonl`.

`real-data:intake` checks for reviewed real aggregate inputs at `data/funnel_aggregates.csv` and `data/manual_conversions.csv`. If they are missing, it writes a healthy `no_real_input_files` plan with exact next actions. If they exist, it runs the existing importers in preview-only mode into `data/real_data_intake/`, writes `data/real_data_intake_status.json` plus `real_data_intake_plan.md`, and lists owner-gated local apply commands. It never appends `data/lp_events.jsonl`.

`data:brief` turns the current source readiness gaps, source capture checklist, compile status, and real-data intake status into `data_collection_brief.md`, `data_collection_queue.json`, `data/data_collection_brief_status.json`, `sample_gate_collection_plan.md`, `sample_gate_collection_plan.json`, and `data/sample_gate_collection_plan_status.json`. It prioritizes sample-gate stages (`page_view`, `cta_click`, `line_add`) first, points the owner to `data/source_capture/source_capture_ledger.filled.csv`, creates no live input CSVs, and never writes `data/lp_events.jsonl`.

`data:progress` reads the data collection queue, owner capture queue, sample-gate status, and any reviewed filled ledgers, then writes `data_collection_progress.md`, `data_collection_progress.json`, `data/data_collection_progress_status.json`, `next_p0_owner_inputs.md`, `next_p0_owner_inputs.json`, and `data/next_p0_owner_inputs_status.json`. It summarizes 42 aggregate collection tasks by P0/P1, source surface, event type, and next owner inputs without creating live CSVs, appending `data/lp_events.jsonl`, deploying, posting, pushing LINE, touching customer data, processing payment, pushing GitHub, creating PRs, or deleting data.

`source:trust` writes `source_trust_matrix.md`, `source_trust_matrix.json`, and `data/source_trust_matrix_status.json`. It classifies `data/lp_events.jsonl`, local D1 exports, aggregate previews, focused owner intake previews, and owner preflight as scoring-ready or review-only. Owner-preview rows can count as sample-gate input when they pass preflight, even if `sample_threshold_met=false`; threshold completion and source trust are separate gates. It never creates live input files, appends events, deploys, posts, pushes LINE/GitHub, mutates customer data, processes payments, or deletes data.

`next-p0:form` writes `next_p0_owner_form.html` and `data/next_p0_owner_form_status.json`. It creates a focused local browser-only form for the current 9 Next P0 aggregate-count rows from `next_p0_owner_inputs.json`, validates date/count/evidence/reviewer/PII-check fields, and downloads `next_p0_owner_inputs.filled.csv` plus a review JSON. It performs no network calls, uses no browser persistence, creates no live CSV by itself, writes no events, stages no owner data, and has no external effect.

`next-p0:form:fixtures` writes `next_p0_owner_form_fixture_report.md` and `data/next_p0_owner_form_fixture_status.json`. It statically verifies that the focused form includes all current Next P0 inputs, has no fetch/XHR/sendBeacon/storage/external URL behavior, preserves the aggregate-only export contract, and keeps all red-line flags false.

`next-p0:quick` writes `next_p0_quick_capture.md`, `data/next_p0_quick_capture_status.json`, and quick files under `data/next_p0_quick_capture/`. Weekly runs with no counts regenerate the focused CSV template, the paste template, and waiting status. If `data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt` already has at least one count but is still incomplete, weekly runs preserve the owner-filled file, report filled and missing ranks as `partial_quick_counts_waiting`, and create no preview CSV. When all counts plus `capture_date`, `evidence_ref`, `reviewer`, and `pii_checked=yes` are complete, the next weekly run auto-reads the paste template into preview without requiring a long command. Invalid or sensitive-looking owner paste values are soft-blocked into `blocked_invalid_quick_counts` by default so weekly artifacts, console, and approval queues can still be generated; add `--strict` when a fail-fast command is wanted. The following `next-p0:intake` step then auto-intakes `data/next_p0_quick_capture/next_p0_owner_inputs.quick-filled.preview.csv` into owner-preview aggregate CSVs only. Manual inputs still work: use rank counts such as `npm run next-p0:quick -- --counts=1=100,2=20,3=5 --capture-date=YYYY-MM-DD --evidence-ref=<aggregate_ref> --reviewer=<alias> --pii-checked=yes`, pasted labelled counts such as `--counts='champion.visits=100;champion.cta=20;champion.line=5;challenger.visits=100;challenger.cta=20;challenger.line=5;line_cta.visits=100;line_cta.cta=20;line_cta.line=5'`, or edit `data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt` and pass it as `--counts-file`. It never writes inbox/live CSVs, never stages, never appends `data/lp_events.jsonl`, and performs no external action.

`p0:counts-preflight` writes `p0_counts_preflight.md`, `p0_counts_preflight.json`, and `data/p0_counts_preflight_status.json`. It reads the focused paste template, checks metadata and count placeholders, and reports `waiting_for_owner_p0_counts`, `partial_p0_counts_waiting`, `ready_for_next_p0_quick`, or `blocked_invalid_p0_counts`. It never creates live inputs, stages data, writes `data/lp_events.jsonl`, posts, deploys, pushes LINE/GitHub, mutates customer data, processes payments, or deletes data.

`next-p0:quick:fixtures` writes `next_p0_quick_capture_fixture_report.md` and `data/next_p0_quick_capture_fixture_status.json`. It uses temporary paths to cover waiting mode, valid rank counts, labelled pasted counts, labelled `--counts-file` input, paste-template creation, auto-reading a complete paste template, partially filled paste-template progress without preview creation, incomplete ranks soft-blocking, sensitive evidence soft-blocking, and `--strict` sensitive evidence fail-fast behavior. It never creates project live inputs, inbox files, event writes, or external actions.

`p0:counts-preflight:fixtures` writes `p0_counts_preflight_fixture_report.md` and `data/p0_counts_preflight_fixture_status.json`. It runs temporary paste templates through waiting, partial, ready, and sensitive-metadata-blocked scenarios. It never creates live owner inputs, writes real events, deploys, posts, pushes LINE/GitHub, mutates customer data, processes payments, or deletes data.

`next-p0:intake` writes `next_p0_owner_intake.md`, `data/next_p0_owner_intake_status.json`, and preview CSVs under `data/next_p0_owner_intake/`. It checks `--input=<path>`, then `data/source_capture/inbox/next_p0_owner_inputs.filled.csv`, then the complete quick-filled preview at `data/next_p0_quick_capture/next_p0_owner_inputs.quick-filled.preview.csv`, then `~/Downloads/next_p0_owner_inputs.filled.csv`. Header-only quick previews are skipped so no-count weekly runs stay in waiting mode. It validates the focused aggregate-only download against `next_p0_owner_inputs.json`, and never stages by default. To create local live aggregate CSVs after owner review, run `npm run next-p0:intake -- --stage --confirm-owner-reviewed` for the auto-detected candidate, or `npm run next-p0:intake -- --input=<path> --stage --confirm-owner-reviewed` for a specific file; this still writes no `data/lp_events.jsonl` and performs no external action.

`owner:data-preflight` reads reviewed owner-preview aggregate CSVs in priority order from live aggregate previews, focused Next P0 intake previews, then source-capture compiled previews. It locally previews sample-threshold readiness, challenger lift, no-quality-regression status, and next-round decision without staging inputs, applying data, appending `data/lp_events.jsonl`, posting, changing links, deploying, pushing GitHub, touching LINE, mutating customer data, processing payments, or deleting data.

`next-p0:intake:fixtures` writes `next_p0_owner_intake_fixture_report.md` and `data/next_p0_owner_intake_fixture_status.json`. It uses temporary focused owner-download candidates to verify valid preview, quick-preview auto-intake, sensitive evidence blocking, unconfirmed stage blocking, and confirmed temporary staging. It never creates project live input CSVs, writes no events, and performs no external actions.

`sample-gate:calendar` writes `sample_gate_capture_calendar.md`, `sample_gate_capture_calendar.json`, `sample_gate_capture_calendar.ics`, and `data/sample_gate_capture_calendar_status.json`. It turns the current Week 0 sample thresholds into Day 3 and Day 7 owner review checkpoints, but it does not import the ICS into Calendar, create system reminders, open browsers, stage data, write `data/lp_events.jsonl`, deploy, post, push LINE/GitHub, mutate customer data, process payments, or delete data.

`sample-gate:due` writes `sample_gate_due_status.md`, `sample_gate_due_status.json`, and `data/sample_gate_due_status_status.json`. It reads the local capture calendar, sample-gate status, progress status, and focused Next P0 inputs, then reports whether Day 3 / Day 7 is waiting, due now, Day 3 overdue and waiting for recovery counts, still sample-insufficient, or ready for owner quality review. It never imports Calendar, creates reminders, opens browsers, stages data, writes `data/lp_events.jsonl`, promotes a challenger, rotates variables, deploys, posts, pushes LINE/GitHub, mutates customer data, processes payments, or deletes data.

`sample-gate:due:fixtures` writes `sample_gate_due_fixture_report.md` and `data/sample_gate_due_fixture_status.json`. It runs `sample-gate:due` against temporary outputs for 2026-07-07, 2026-07-08, 2026-07-09, and 2026-07-12 to prove waiting, Day 3 due, Day 3 overdue recovery, and Day 7 due states. It never overwrites project due-status artifacts, writes events, opens browsers, imports Calendar, deploys, posts, pushes LINE/GitHub, mutates customer data, processes payments, or deletes data.

`owner:capture-queue` reads the sample-gate plan and writes `week0_owner_capture_queue.md`, `week0_owner_capture_queue.json`, and `data/week0_owner_capture_queue_status.json`. It compresses Week 0 collection into 18 P0 rows across six links, grouped by Candidate Worker analytics and LINE OA aggregate counts. It creates no live CSVs, appends no events, sends no LINE messages, changes no public links, and stores no customer-level data.

`owner:sample-gate` reads `data/source_capture/sample_gate_ledger.filled.csv` when present and writes `owner_sample_gate_status.md`, `owner_sample_gate_status.json`, and `data/owner_sample_gate_status.json`. It reports filled rows, pending rows, sample threshold gaps, observed test days, and whether the sample-rate portion is ready for owner review. It never applies CSVs, writes `data/lp_events.jsonl`, promotes a challenger, changes links, deploys, posts, pushes LINE, touches customer data, processes payments, or deletes data. `no_quality_regression` is intentionally not inferred from this 18-row sample gate; final promotion remains blocked until quality evidence is reviewed.

`owner:worksheet` writes `sample_gate_owner_worksheet.md`, `sample_gate_owner_worksheet.json`, and `data/sample_gate_owner_worksheet_status.json`. It turns the regenerated 18-row sample-gate template into an owner fill checklist grouped by landing analytics and LINE OA aggregate sources. It never creates `data/source_capture/sample_gate_ledger.filled.csv`, never creates live input CSVs, never writes `data/lp_events.jsonl`, and never touches public links, production deploy, posts, LINE, customer data, payments, or deletion.

`owner:form` writes `sample_gate_owner_form.html` and `data/sample_gate_owner_form_status.json`. It creates a local browser-only fill form for the same 18 P0 rows, validates date/count/evidence/reviewer/PII-check fields, and downloads `sample_gate_ledger.filled.csv` plus a review JSON. It performs no network calls, uses no browser persistence, creates no live CSV by itself, writes no events, and has no external effect.

`owner:form:fixtures` writes `sample_gate_owner_form_fixture_report.md` and `data/sample_gate_owner_form_fixture_status.json`. It creates temporary browser-form-style `sample_gate_ledger.filled.csv` downloads, runs them through `source-capture-compile` and `owner-sample-gate-status`, and covers sample-insufficient, owner-review-ready, and sensitive-evidence-blocked paths. It never creates the live filled ledger, never writes `data/lp_events.jsonl`, never promotes a challenger, and never performs external actions.

`owner:intake` writes `owner_sample_gate_intake.md` and `data/owner_sample_gate_intake_status.json`. It checks a known owner-download filename from `data/source_capture/inbox/sample_gate_ledger.filled.csv` or `~/Downloads/sample_gate_ledger.filled.csv`, validates it through the existing source compiler and owner sample-gate status, and reports waiting/ready/blocked. Weekly runs never stage the file automatically. To create the local owner working copy after review, run `npm run owner:intake -- --input=<path> --stage --confirm-owner-reviewed`; this is still local-only and writes no `data/lp_events.jsonl`.

`owner:intake:fixtures` writes `owner_sample_gate_intake_fixture_report.md` and `data/owner_sample_gate_intake_fixture_status.json`. It uses temporary owner-download candidates to verify no-download waiting, valid ready state, sensitive evidence blocking, unconfirmed stage blocking, and confirmed temporary staging. It never stages to the real owner path, writes no events, and performs no external actions.

`owner:p1-outcome-intake` writes `owner_p1_outcome_intake.md`, `owner_p1_outcome_intake.json`, and `data/owner_p1_outcome_intake_status.json`. It checks a known P1 outcome download filename from `data/source_capture/inbox/source_capture_ledger.filled.csv` or `~/Downloads/source_capture_ledger.filled.csv`, validates it through `north-star:outcome-preflight` and `source:compile` using temporary outputs, and reports waiting/ready/blocked. Weekly runs never stage the file automatically. To create the local owner working copy after review, run `npm run owner:p1-outcome-intake -- --input=<path> --stage --confirm-owner-reviewed`; this is still local-only and writes no `data/lp_events.jsonl`.

`owner:p1-outcome-intake:fixtures` writes `owner_p1_outcome_intake_fixture_report.md` and `data/owner_p1_outcome_intake_fixture_status.json`. It uses temporary P1 outcome CSV candidates to verify no-download waiting, valid review-only, sensitive evidence blocking, unconfirmed stage blocking, and confirmed temporary staging. It never stages to the real owner path, writes no events, and performs no external actions.

`owner:sample-gate:fixtures` runs temporary owner-filled sample-gate ledgers through `owner:sample-gate` and writes `data/owner_sample_gate_fixture_status.json` plus `owner_sample_gate_fixture_report.md`. It covers missing input, partial counts, insufficient visits, insufficient test days, sample-rate winner requiring quality review, underperforming challenger, and sensitive evidence blocking. It never creates `data/source_capture/sample_gate_ledger.filled.csv`, never applies CSVs, never writes `data/lp_events.jsonl`, and never promotes a challenger.

`owner:quality-review` reads `data/owner_sample_gate_status.json` and optional `data/owner_quality_review.filled.json`, then writes `owner_quality_review.md`, `owner_quality_review.example.json`, and `data/owner_quality_review_status.json`. It only becomes actionable after the sample gate reports a sample-rate win candidate. Valid evidence must be aggregate-only and confirm lead-rate retention, close-rate retention, spam flag rate, and `pii_checked`; it never writes events, edits `approval_queue.json`, promotes a challenger, changes links, deploys, posts, pushes LINE, touches customer data, processes payments, or deletes data.

`owner:quality-review:form` writes `owner_quality_review_form.html` and `data/owner_quality_review_form_status.json`. It creates a local browser-only fill form for aggregate no-quality-regression evidence, validates reviewer/evidence/PII/lead-retention/close-retention/spam-rate fields, and downloads `owner_quality_review.filled.json` plus a review JSON. It performs no network calls, uses no browser persistence, creates no live JSON by itself, writes no events, edits no approval queue, promotes no challenger, and has no external effect.

`owner:quality-review:form:fixtures` writes `owner_quality_review_form_fixture_report.md` and `data/owner_quality_review_form_fixture_status.json`. It creates temporary browser-form-style `owner_quality_review.filled.json` downloads, runs them through `owner:quality-review`, and covers waiting for sample-rate candidate, passing quality review, quality regression, and sensitive-input-blocked paths. It never creates the live filled JSON, never writes `data/lp_events.jsonl`, never edits `approval_queue.json`, never promotes a challenger, and never performs external actions.

`owner:quality-review:fixtures` writes `owner_quality_review_fixture_report.md` and `data/owner_quality_review_fixture_status.json`. It runs temporary aggregate quality-review inputs through the gate and covers waiting for sample-rate candidate, waiting for owner evidence, passing quality review, quality regression, sensitive evidence, and missing required fields. It never creates the live filled JSON, never writes `data/lp_events.jsonl`, never edits `approval_queue.json`, and never promotes a challenger.

`owner:next-action` writes `owner_next_action.md`, `owner_next_action.json`, and `data/owner_next_action_status.json`. It reads the current owner sample gate, owner download intake, focused Next P0 quick capture, P0 counts preflight, focused Next P0 intake, full P0 batch handoff, real-data intake, source trust matrix, quality review, next-round plan, launch readiness, data collection progress, approval queue, `data/approval_queue_status.json`, and gate readiness, then chooses one primary local next action plus exactly three review actions. The card exposes trusted scoring source count, sample-gate source count, scoring permission, real-event rows, and P0 pending rows so owner-facing next steps cannot ignore source trust. When focused P0 paste values are invalid or sensitive-looking, the primary action becomes `fix_invalid_p0_counts` and opens `p0_counts_preflight.md` before any quick preview or staging. When reviewed focused counts are staged into local aggregate CSVs, the primary action advances to `npm run real-data:intake`; when real-data preview is ready, it opens `real_data_intake_plan.md` for owner apply review. When the sample is still short and no staged/preview-ready input exists yet, the primary action opens `sample_gate_batch_handoff.md` so the owner sees the full 18-row P0 coverage requirement, fills batch 1 first, then batch 2 before treating Week 0 sample collection as covered. If the focused quick template is already partially filled, the primary action stays on `data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt` so partial owner work is completed instead of discarded; once the file is complete, `next-p0:quick` auto-reads it into preview, while the browser form remains available as a fallback review artifact. In parallel, the three review actions surface `prepare_public_ab_metadata`, which opens `owner_approval_form.html` so non-secret `champion_url`, `public_surface`, and `rollback_url` can be prepared without changing links or deploy state. It is read-only against owner inputs: it does not stage downloads, create live input files, write `data/lp_events.jsonl`, push GitHub, create PRs, deploy, change public links, post, push LINE, touch customer data, process payment, or delete data.

`north-star:outcome-preflight` writes `north_star_outcome_preflight.md`, `north_star_outcome_preflight.json`, and `data/north_star_outcome_preflight_status.json`. It validates the 24 P1 North Star outcome rows in `data/source_capture/source_capture_ledger.filled.csv`: `link_click`, `lead_submit`, `deal`, and `quality_flag`. This keeps the 7-day loop from optimizing only for LINE adds while leaving the留資 / 成交 side unverified. It accepts aggregate counts only, requires reviewed evidence metadata and `pii_checked`, warns when quality flags lack `quality_score`, and never creates live input files, stages/appends `data/lp_events.jsonl`, deploys, posts, pushes LINE/GitHub, mutates customer data, processes payments, or deletes data.

`north-star:outcome-form` writes `north_star_outcome_form.html` and `data/north_star_outcome_form_status.json`. It creates a local browser-only form for the same 24 P1 outcome rows, validates date/count/evidence/reviewer/PII-check fields, restricts `quality_score` to `quality_flag` rows, and downloads `source_capture_ledger.filled.csv` plus a review JSON. It performs no network calls, uses no browser persistence, creates no live CSV by itself, writes no events, and has no external effect.

`north-star:outcome-form:fixtures` writes `north_star_outcome_form_fixture_report.md` and `data/north_star_outcome_form_fixture_status.json`. It is a static local guard for the generated browser form: no network calls, no XHR/beacons, no browser storage APIs, no external links, no form action, and no red-line effects. It does not replay the export into live inputs and does not run source compile; the owner still has to review/download/place the aggregate-only CSV before any later local preflight or compile.

`owner:p1-outcome-postfill-check` writes `owner_p1_outcome_postfill_check.md`, `owner_p1_outcome_postfill_check.json`, `RUN-P1-OUTCOME-POST-FILL-CHECK.command`, and `data/owner_p1_outcome_postfill_check_status.json`. It is the one-click local checker to run after the P1 outcome rows are filled and reviewed. The generated command runs only whitelisted local npm scripts, including `north-star:outcome-preflight`, `source:compile`, `real-data:intake`, `source:trust`, `north-star`, `owner:next-action`, and `weekly:local`; it never uses `--stage`, `--apply`, remote D1, wrangler, git/gh, production deploy, public link changes, formal posting, LINE push, customer-data mutation, payments, or deletes.

`sample-gate:recovery` writes `sample_gate_recovery_pack.md`, `sample_gate_recovery_pack.json`, and `data/sample_gate_recovery_pack_status.json`. It packages the current Day 3 / Day 7 due status, focused Next P0 missing ranks, source groups, owner fast path, and post-count local command sequence. It blocks fake or backfilled counts, does not create live input files, does not append `data/lp_events.jsonl`, and cannot promote a challenger, rotate variables, deploy, post, push LINE/GitHub, mutate customer data, process payments, or delete data.

`sample-gate:batches` writes `sample_gate_batch_handoff.md`, `sample_gate_batch_handoff.json`, `data/sample_gate_batch_handoff_status.json`, `sample_gate_batch_1_paste_block.txt`, and `sample_gate_batch_2_paste_block.txt`. It splits the 18-row P0 sample-gate requirement into the focused 9-row quick-capture batch and the remaining 9-row content-variant coverage batch. It creates copy-only placeholder blocks and never creates live input files, appends `data/lp_events.jsonl`, deploys, posts, pushes LINE/GitHub, mutates customer data, processes payments, or deletes data.

`sample-gate:batch-preflight` writes `sample_gate_batch_preflight.md`, `sample_gate_batch_preflight.json`, and `data/sample_gate_batch_preflight_status.json`. It validates the full 18-row owner-filled sample-gate ledger before local source compile, including required metadata, non-negative aggregate counts, expected asset/content/variant matching, PII-checked values, and sensitive-looking evidence/reviewer fields. It is read-only against owner inputs and never creates live input files, stages data, appends `data/lp_events.jsonl`, deploys, posts, pushes LINE/GitHub, mutates customer data, processes payments, or deletes data.

`owner:sample-count-handoff` writes `owner_sample_count_handoff.md`, `owner_sample_count_handoff.json`, `owner_sample_count_paste_block.txt`, and `data/owner_sample_count_handoff_status.json`. It condenses the current missing sample-count rows into one owner handoff with quick filled/missing/partial progress, a direct copy/paste block for `next_p0_owner_inputs.counts-paste-template.txt`, paste keys, source groups, acceptance checks, and after-fill commands. The standalone paste block is copy-only placeholder text; it is not a live input and is never auto-applied as real data. It reads existing recovery/Next P0 status only; it does not create live input files, append `data/lp_events.jsonl`, stage owner downloads, deploy, post, push LINE/GitHub, mutate customer data, process payments, or delete data.

`owner:p0-now` writes `owner_p0_now.html`, `owner_p0_now.md`, `owner_p0_now.json`, and `data/owner_p0_now_status.json`. It condenses the current sample-count handoff into the shortest P0 action cockpit: open Batch 1, copy the embedded Batch 1 / Batch 2 paste blocks from the same page, paste aggregate counts into the focused template, check `p0_counts_preflight.md` for ready/partial/blocked state, then use `sample_gate_owner_form.html` plus `owner_sample_gate_intake.md` when all 18 P0 rows need one reviewed full-coverage CSV before treating P0 as covered. It reads existing local status only; it does not create live input files, append `data/lp_events.jsonl`, stage downloads, deploy, post, push LINE/GitHub, mutate customer data, process payments, or delete data.

`owner:p0-launcher` writes `owner_p0_launcher.md`, `OPEN-P0-SAMPLE-GATE.command`, and `data/owner_p0_launcher_status.json`. It is the narrow P0-only local opener for the current sample-count blocker: it opens P0-now, full P0 batch handoff, Batch 1 / Batch 2 paste blocks, focused paste template, P0 preflight, full sample-gate form/intake, count handoff/recovery, and due status. It opens local files only and never creates live inputs, appends `data/lp_events.jsonl`, deploys, posts, pushes LINE/GitHub, changes public links, mutates customer data, processes payments, or deletes data.

`owner:sample-count-recovery` writes `owner_sample_count_recovery.md`, `owner_sample_count_recovery.json`, and `data/owner_sample_count_recovery_status.json`. It reads the quick-count preview, focused Next P0 intake, full 18-row P0 owner form/intake, owner data preflight, sample-gate, handoff, and red-line statuses, then reports the exact recovery stage after owner aggregate counts are filled. Full P0 downloads can advance only through owner-reviewed local staging; the script never appends `data/lp_events.jsonl`, deploys, posts, pushes LINE/GitHub, mutates customer data, processes payments, or deletes data.

`owner:p0-postfill-check` writes `owner_p0_postfill_check.md`, `owner_p0_postfill_check.json`, `RUN-P0-POST-FILL-CHECK.command`, and `data/owner_p0_postfill_check_status.json`. It is the one-click local checker to run after owner aggregate counts are filled. The generated command runs only whitelisted local npm scripts, including `source:trust`, and never uses `--stage`, `--apply`, remote D1, wrangler, git/gh, production deploy, public link changes, formal posting, LINE push, customer-data mutation, payments, or deletes.

`owner:sample-count-recovery:fixtures` writes `owner_sample_count_recovery_fixture_report.md` and `data/owner_sample_count_recovery_fixture_status.json`. It runs `owner:sample-count-recovery` against temporary roots for waiting, quick-ready, focused-intake-ready, full-P0-intake-ready, confirmed local full-P0 staging, preflight sample-insufficient, sample-ready, win-review, and red-line violation scenarios. It never writes project live inputs, never appends `data/lp_events.jsonl`, and performs no external action.

`owner:next-action:fixtures` writes `owner_next_action_fixture_report.md` and `data/owner_next_action_fixture_status.json`. It runs `owner:next-action` against temporary roots to verify empty sample-count waiting routes to the full P0 batch handoff, partial quick counts route back to the focused paste template, invalid P0 paste values route to the P0 preflight fix card, staged Next P0 inputs route to real-data preview, preview-ready real data routes to owner apply review, blocked real-data inputs route to CSV fix/re-preview, and public A/B metadata stays a secondary plan-only action. It never writes project live inputs, never appends `data/lp_events.jsonl`, and performs no external action.

`north-star` writes `north_star_funnel.json` and `north_star_funnel.md`. It reads current local scores, attribution rows, and owner sample-gate status, then reports link clicks -> LINE adds -> leads -> deals per 100 clicks. It never writes `data/lp_events.jsonl`, changes public links, deploys, posts, pushes LINE, mutates customer data, processes payments, or deletes data.

`retirement:fixtures` runs temporary candidate-score scenarios through the local candidate retirement policy and writes `data/candidate_retirement_fixture_status.json` plus `candidate_retirement_fixture_report.md`. It covers sample-insufficient keep-testing, winning challenger owner review, underperforming local retirement, quality-regression local retirement, unknown candidates, and mixed candidate summaries. It never edits `candidate_retirement_queue.json`, never writes `data/lp_events.jsonl`, never changes public links, never promotes challengers, and never deletes data.

`history:iteration` writes `iteration_history.md` and `iteration_history.json`. It reads current scores, next-round plan, approval queue, PreparedButBlocked, data collection status, source status, and existing archive manifests to keep a 7-day local iteration trail. It never posts, deploys, changes links, pushes LINE, mutates customer data, processes payments, deletes data, or writes `data/lp_events.jsonl`.

`import:manual:preview` converts downstream aggregate CSV counts into `data/manual_conversions.preview.jsonl` and updates `data/manual_conversion_status.json`. It does not score the rows and does not write to `data/lp_events.jsonl`.

`line:playbook` generates the inbound-only LINE handoff and fixture status. It maps manual LINE replies to aggregate `line_add`, `lead_submit`, `deal`, and `quality_flag` counts, blocks sensitive local fields, and never sends LINE messages, pushes broadcasts, mutates customer data, processes payments, or writes `data/lp_events.jsonl`.

`manual:publish-packet` writes `manual_publish_packet.md`, `manual_publish_packet.json`, and `data/manual_publish_packet_status.json`. It pairs each draft content variant with its draft-gated tracking URL, candidate landing target, LINE inbound handoff summary, owner manual steps, and blocked actions. It never publishes, schedules, changes the main link, promotes a challenger, pushes LINE, deploys production, creates GitHub activity, mutates customer data, processes payments, deletes data, or writes `data/lp_events.jsonl`.

`manual:capture-plan` writes `manual_publish_capture_plan.md`, `manual_publish_capture_plan.json`, and `data/manual_publish_capture_plan_status.json`. It maps each reviewed manual publish packet to Day 3 and Day 7 aggregate counts: sample-gate-required `page_view`, `cta_click`, and `line_add`, plus North Star / quality rows for `link_click`, `lead_submit`, `deal`, and `quality_flag`. It never publishes, schedules, changes the main link, pushes LINE, deploys production, creates GitHub activity, mutates customer data, processes payments, deletes data, or writes `data/lp_events.jsonl`.

`manual:publish-brief` writes `manual_publish_brief.md`, `manual_publish_brief.json`, and `data/manual_publish_brief_status.json`. It selects one current packet for Day 0 owner review, copies the exact caption/tracking URL/LINE handoff into a single card, and blocks formal posting when the tracking URL is still local-only. It never publishes, schedules, changes the main link, pushes LINE, deploys production, creates GitHub activity, mutates customer data, processes payments, deletes data, or writes `data/lp_events.jsonl`.

`public:tracking-pack` writes `public_tracking_url_pack.md`, `public_tracking_url_pack.json`, and `data/public_tracking_url_pack_status.json`. It converts the selected local tracking route into owner-approved public URL previews using `https://<OWNER_APPROVED_WORKER_URL>` as a placeholder and lists the required D1, Worker, public route, and post-gate verification order. It never deploys, activates a public URL, publishes, schedules, changes the main link, pushes LINE, creates GitHub activity, mutates customer data, processes payments, deletes data, or writes `data/lp_events.jsonl`.

`owner:public-url-approval-preview` writes `owner_public_url_approval_preview.md`, `owner_public_url_approval_preview.json`, and `data/owner_public_url_approval_preview_status.json`. It turns the public tracking URL pack into an owner checklist for the three public URL gates, shows the required non-secret `owner_approval_input.json` fields, and keeps the live approval input file owner-created only. It never creates or overwrites `owner_approval_input.json`, deploys, activates public URLs, publishes, schedules, changes the main link, pushes LINE, creates GitHub activity, mutates customer data, processes payments, deletes data, or writes `data/lp_events.jsonl`.

`manual:publish-evidence` writes `manual_publish_evidence.md`, `manual_publish_evidence.example.json`, and `data/manual_publish_evidence_status.json`. It waits for owner-supplied `manual_publish_evidence.json` after exactly one reviewed packet is manually published, validates non-sensitive evidence fields, and calculates Day 3 / Day 7 capture dates. It never publishes, schedules, fetches post URLs, changes the main link, pushes LINE, deploys production, creates GitHub activity, mutates customer data, processes payments, deletes data, or writes `data/lp_events.jsonl`.

`manual:publish-evidence:form` writes `manual_publish_evidence_form.html` and `data/manual_publish_evidence_form_status.json`. The HTML is browser-only: it validates one non-sensitive manual publish reference, downloads `manual_publish_evidence.json` or a review JSON, and performs no `fetch`, XHR, sendBeacon, post URL fetch, browser persistence, live input creation, external write, publish, LINE action, deploy, public-link change, customer-data mutation, payment action, deletion, or real event write.

`manual:publish-evidence:form:fixtures` writes `manual_publish_evidence_form_fixture_report.md` and `data/manual_publish_evidence_form_fixture_status.json`. It checks the browser-only contract and replays four temporary form-shaped exports through `manual:publish-evidence`: valid recent evidence, valid Day 7 evidence, sensitive post reference block, and missing PII confirmation block. It never creates live owner input files or writes `data/lp_events.jsonl`.

`manual:publish-evidence:fixtures` writes `manual_publish_evidence_fixture_report.md` and `data/manual_publish_evidence_fixture_status.json`. It uses temporary inputs to verify missing-input waiting, valid recent evidence, valid Day 7 evidence, unknown-packet blocking, sensitive-value blocking, multi-packet blocking, and missing-confirmation blocking. It never creates live owner input files, fetches post URLs, publishes, pushes LINE, deploys, changes links, or writes `data/lp_events.jsonl`.

`weekly:local` runs the safe local weekly loop:

```text
collect_data -> event input quality gate -> funnel_aggregate_preview -> funnel_aggregate_fixtures -> real_data_apply_fixtures -> real_data_input_pack -> source_readiness_monitor -> source_capture_pack -> sample_gate_compile_probe -> sample_gate_replay_fixtures -> source_capture_compile -> source_capture_compile_fixtures -> real_data_intake_plan -> data_collection_brief -> week0_owner_capture_queue -> owner_sample_gate_status -> data_collection_progress -> north_star_outcome_preflight -> north_star_outcome_form -> north_star_outcome_form_fixtures -> owner P1 outcome post-fill check -> next_p0_owner_form -> next_p0_quick_capture -> p0_counts_preflight -> next_p0_owner_intake -> next_p0_owner_form_fixtures -> next_p0_quick_capture_fixtures -> p0_counts_preflight_fixtures -> next_p0_owner_intake_fixtures -> sample_gate_capture_calendar -> sample_gate_due_status -> sample_gate_due_status_fixtures -> sample_gate_owner_worksheet -> sample_gate_owner_form -> sample_gate_owner_form_fixtures -> owner_sample_gate_intake -> owner_sample_gate_intake_fixtures -> owner_sample_gate_fixtures -> owner_quality_review -> owner_quality_review_form -> owner_quality_review_form_fixtures -> owner_quality_review_fixtures -> owner_next_action -> sample gate recovery pack -> sample gate batch handoff -> sample gate batch preflight -> owner sample-count handoff -> owner sample-count recovery -> owner P0 post-fill check -> owner_next_action_fixtures -> owner action launcher -> manual_conversion_preview -> line inbound playbook -> manual publish packet -> manual publish capture plan -> manual publish brief -> public tracking URL pack -> owner public URL approval preview -> manual publish evidence intake -> manual publish evidence form -> manual publish evidence form fixtures -> manual publish evidence fixtures -> variable rotation fixtures -> worker dry-run -> browser route smoke -> tracking link smoke -> event contract smoke -> win-rule fixtures -> real-data decision replay -> LaunchAgent status readback -> generate weekly artifacts -> north star funnel -> candidate retirement fixtures -> iteration history -> schedule catch-up monitor -> approval resume plan -> owner approval form -> owner approval form fixtures -> owner gate evidence intake -> owner gate evidence fixtures -> post-gate verification plan -> post-gate verification fixtures -> gate_readiness_matrix -> red-line priority queue -> PreparedButBlocked handoff -> approval resume fixtures -> github workflow guard -> artifact retention monitor (pre-export) -> artifact retention review (pre-export) -> github export bundle -> artifact retention monitor -> artifact retention review -> objective contract audit -> archive weekly snapshot -> owner console -> owner action launcher refresh -> owner console refresh -> owner console smoke -> verify artifacts
```

It writes `data/weekly_runner_status.json`, `data/event_input_quality_status.json`, `data/funnel_aggregate_status.json`, `data/funnel_aggregates.preview.jsonl`, `data/funnel_aggregate_fixture_status.json`, `funnel_aggregate_fixture_report.md`, `data/real_data_apply_fixture_status.json`, `real_data_apply_fixture_report.md`, `data/real_data_decision_replay_status.json`, `real_data_decision_replay_report.md`, `data/real_data_input_pack_status.json`, `real_data_input_pack.md`, fill templates under `data/real_data_input_pack/`, `data/source_readiness_status.json`, `source_readiness.md`, `data/source_capture_status.json`, `source_capture_pack.md`, files under `data/source_capture/`, `sample_gate_ledger.md`, `data/sample_gate_ledger_status.json`, `data/sample_gate_replay_fixture_status.json`, `sample_gate_replay_fixture_report.md`, `data/source_capture_compile_status.json`, `source_capture_compile_report.md`, `data/source_capture_compile_fixture_status.json`, `source_capture_compile_fixture_report.md`, owner-preview CSVs under `data/source_capture/compiled/`, `data/real_data_intake_status.json`, `real_data_intake_plan.md`, `data_collection_brief.md`, `data_collection_queue.json`, `data/data_collection_brief_status.json`, `data_collection_progress.md`, `data_collection_progress.json`, `data/data_collection_progress_status.json`, `north_star_outcome_preflight.md`, `north_star_outcome_preflight.json`, `data/north_star_outcome_preflight_status.json`, `north_star_outcome_form.html`, `data/north_star_outcome_form_status.json`, `north_star_outcome_form_fixture_report.md`, `data/north_star_outcome_form_fixture_status.json`, `next_p0_owner_inputs.md`, `next_p0_owner_inputs.json`, `data/next_p0_owner_inputs_status.json`, `next_p0_owner_form.html`, `data/next_p0_owner_form_status.json`, `next_p0_owner_form_fixture_report.md`, `data/next_p0_owner_form_fixture_status.json`, `next_p0_quick_capture.md`, `data/next_p0_quick_capture_status.json`, `next_p0_quick_capture_fixture_report.md`, `data/next_p0_quick_capture_fixture_status.json`, quick CSVs under `data/next_p0_quick_capture/`, `p0_counts_preflight.md`, `p0_counts_preflight.json`, `data/p0_counts_preflight_status.json`, `p0_counts_preflight_fixture_report.md`, `data/p0_counts_preflight_fixture_status.json`, `next_p0_owner_intake.md`, `data/next_p0_owner_intake_status.json`, `next_p0_owner_intake_fixture_report.md`, `data/next_p0_owner_intake_fixture_status.json`, `week0_owner_capture_queue.md`, `week0_owner_capture_queue.json`, `data/week0_owner_capture_queue_status.json`, `owner_sample_gate_status.md`, `owner_sample_gate_status.json`, `data/owner_sample_gate_status.json`, `sample_gate_owner_form_fixture_report.md`, `data/sample_gate_owner_form_fixture_status.json`, `owner_sample_gate_intake.md`, `data/owner_sample_gate_intake_status.json`, `owner_sample_gate_intake_fixture_report.md`, `data/owner_sample_gate_intake_fixture_status.json`, `owner_sample_gate_fixture_report.md`, `data/owner_sample_gate_fixture_status.json`, `owner_quality_review_form.html`, `data/owner_quality_review_form_status.json`, `owner_quality_review_form_fixture_report.md`, `data/owner_quality_review_form_fixture_status.json`, `sample_gate_recovery_pack.md`, `sample_gate_recovery_pack.json`, `data/sample_gate_recovery_pack_status.json`, `candidate_retirement_fixture_report.md`, `data/candidate_retirement_fixture_status.json`, `sample_gate_collection_plan.md`, `sample_gate_collection_plan.json`, `data/sample_gate_collection_plan_status.json`, `iteration_history.md`, `iteration_history.json`, `line_inbound_playbook.md`, `line_inbound_playbook.json`, `data/line_inbound_fixture_status.json`, `line_inbound_fixture_report.md`, `manual_publish_packet.md`, `manual_publish_packet.json`, `data/manual_publish_packet_status.json`, `manual_publish_capture_plan.md`, `manual_publish_capture_plan.json`, `data/manual_publish_capture_plan_status.json`, `manual_publish_brief.md`, `manual_publish_brief.json`, `data/manual_publish_brief_status.json`, `manual_publish_evidence.md`, `manual_publish_evidence.example.json`, `data/manual_publish_evidence_status.json`, `manual_publish_evidence_form.html`, `data/manual_publish_evidence_form_status.json`, `manual_publish_evidence_form_fixture_report.md`, `data/manual_publish_evidence_form_fixture_status.json`, `manual_publish_evidence_fixture_report.md`, `data/manual_publish_evidence_fixture_status.json`, `data/variable_rotation_fixture_status.json`, `variable_rotation_fixture_report.md`, `worker_dry_run.md`, `data/worker_dry_run_status.json`, `funnel_breakdown.md`, `funnel_breakdown.json`, `north_star_funnel.md`, `north_star_funnel.json`, `data/browser_smoke_status.json`, `tracking_link_smoke.md`, `data/tracking_link_smoke_status.json`, `data/event_contract_smoke_status.json`, `data/approval_queue_status.json`, `data/approval_resume_status.json`, `owner_approval_form.html`, `data/owner_approval_form_status.json`, `owner_approval_form_fixture_report.md`, `data/owner_approval_form_fixture_status.json`, `data/owner_gate_evidence_status.json`, `owner_gate_evidence.md`, `owner_gate_evidence.example.json`, `data/owner_gate_evidence_fixture_status.json`, `owner_gate_evidence_fixture_report.md`, `data/post_gate_verification_status.json`, `post_gate_verification.md`, `data/post_gate_verification_fixture_status.json`, `post_gate_verification_fixture_report.md`, `data/gate_readiness_status.json`, `gate_readiness.md`, `redline_priority.md`, `redline_priority.json`, `data/approval_resume_fixture_status.json`, `approval_resume_fixture_report.md`, `data/github_export_status.json`, `github_export_manifest.md`, `objective_sequence_audit.json`, `objective_sequence_audit.md`, `data/objective_sequence_audit_status.json`, `goal_completion_audit.md`, `data/goal_completion_audit_status.json`, `data/week_archive_status.json`, `owner_action_launcher.md`, `OPEN-3Q-GROWTH-LOOP.command`, `data/owner_action_launcher_status.json`, `data/owner_console_status.json`, `data/owner_console_smoke_status.json`, timestamped files in `logs/`, ignored local GitHub export bundles under `github_export/bundles/`, and immutable local snapshots under `archive/<week>/<timestamp>/`. The Worker dry-run captures local `wrangler deploy --dry-run` output only and records that no production deploy happened. The browser route smoke fetches local endpoints only; the tracking link smoke uses isolated local D1 and `redirect: manual`; neither executes the page beacon script, follows external LINE/champion URLs, writes real funnel events, deploys production, posts, pushes LINE, changes public links, mutates customer data, processes payments, or deletes data.

It also writes `github_workflow_guard.md`, `github_workflow_guard.json`, and `data/github_workflow_guard_status.json` before the GitHub export bundle so the copied handoff package includes a current proof that GitHub Actions remains review-only. The retention monitor runs once before `github:bundle` so the bundle contains the latest available retention artifacts, then runs again after `github:bundle` so the live local status includes the newest bundle. Each retention monitor pass is followed by `artifacts:retention-review`, which writes `artifact_retention_review_pack.md`, `artifact_retention_review_pack.json`, and `data/artifact_retention_review_status.json` as an owner-only cleanup review queue with no cleanup command, mutation, deletion, or external effect.

After the recorded weekly commands finish, `weekly:local` first writes `data/weekly_runner_status.json` as `success`, then runs a final local refresh of `schedule:catchup`, `growth-loop --verify`, approval plan/form, gate readiness, red-line priority, PreparedButBlocked, `artifacts:retention`, `artifacts:retention-review`, `objective:audit`, `archive:week`, `owner_console.html`, `OPEN-3Q-GROWTH-LOOP.command`, console smoke, and artifact verification. This prevents owner gates, Worker dry-run dependencies, the local owner console, schedule catch-up monitor, retention monitor, retention review pack, objective audit, launcher, and archive snapshot from showing stale `running` or `pending` rows.

`schedule:catchup` writes `data/schedule_catchup_status.json` and `schedule_catchup_status.md`. It compares the latest successful `weekly:local` run against the most recent Sunday 00:10 Asia/Taipei schedule window and tells the owner whether a manual local catch-up run is needed. It is a read-only monitor: it never invokes `weekly:local`, never installs LaunchAgents, never deploys, never changes public links, never posts, never pushes LINE, never touches customer data, never processes payments, and never deletes data.

The weekly runner also writes `sample_gate_capture_calendar.md`, `sample_gate_capture_calendar.json`, `sample_gate_capture_calendar.ics`, and `data/sample_gate_capture_calendar_status.json` as the local-only Day 3 / Day 7 review calendar. It generates the ICS file for owner review but does not import it into Calendar or create reminders.

The weekly runner also writes `sample_gate_due_status.md`, `sample_gate_due_status.json`, `data/sample_gate_due_status_status.json`, `sample_gate_due_fixture_report.md`, and `data/sample_gate_due_fixture_status.json` as the local-only Day 3 / Day 7 due-state monitor and timing guard. It reports whether sample-gate review is waiting, due now, Day 3 overdue, still sample-insufficient, or ready for owner quality review without opening browsers, importing Calendar, promoting candidates, rotating variables, or writing events.

The weekly runner also writes `sample_gate_owner_worksheet.md`, `sample_gate_owner_worksheet.json`, `data/sample_gate_owner_worksheet_status.json`, `sample_gate_owner_form.html`, `data/sample_gate_owner_form_status.json`, `sample_gate_owner_form_fixture_report.md`, and `data/sample_gate_owner_form_fixture_status.json` as local-only owner collection aids and form-export replay guards for the 18 P0 sample-gate rows.

It also writes `owner_quality_review.md`, `owner_quality_review.example.json`, `data/owner_quality_review_status.json`, `owner_quality_review_form.html`, `data/owner_quality_review_form_status.json`, `owner_quality_review_form_fixture_report.md`, `data/owner_quality_review_form_fixture_status.json`, `owner_quality_review_fixture_report.md`, and `data/owner_quality_review_fixture_status.json` as the aggregate-only no-quality-regression gate that sits between sample-rate win and any owner-approved challenger promotion.

It also writes `owner_next_action.md`, `owner_next_action.json`, and `data/owner_next_action_status.json` as the single owner-facing next-action card.

It also writes `sample_gate_recovery_pack.md`, `sample_gate_recovery_pack.json`, and `data/sample_gate_recovery_pack_status.json` as the local-only recovery package when Day 3 / Day 7 sample-gate counts are missing or overdue.

It also writes `sample_gate_batch_handoff.md`, `sample_gate_batch_handoff.json`, `sample_gate_batch_1_paste_block.txt`, `sample_gate_batch_2_paste_block.txt`, and `data/sample_gate_batch_handoff_status.json` as the local-only 18-row P0 batch handoff. It keeps the 9-row focused quick path visible but makes the remaining 9 content-variant rows explicit before Week 0 sample collection can be treated as fully covered.

It also writes `sample_gate_batch_preflight.md`, `sample_gate_batch_preflight.json`, and `data/sample_gate_batch_preflight_status.json` as the full-P0 owner-filled ledger preflight before source compile. It validates aggregate counts and non-sensitive owner metadata only, creates no live input files, and never writes `data/lp_events.jsonl`.

It also writes `north_star_outcome_preflight.md`, `north_star_outcome_preflight.json`, and `data/north_star_outcome_preflight_status.json` as the P1 owner-filled outcome preflight before source compile. It covers link-click denominator rows plus lead, deal, and quality rows so the North Star funnel remains tied to留資 / 成交, not just LINE adds.

It also writes `north_star_outcome_form.html`, `data/north_star_outcome_form_status.json`, `north_star_outcome_form_fixture_report.md`, and `data/north_star_outcome_form_fixture_status.json` as the browser-only P1 outcome collection aid and static guard for the 24 link-click, lead, deal, and quality rows. The form downloads an aggregate-only working CSV but does not create `data/source_capture/source_capture_ledger.filled.csv` by itself.

It also writes `owner_p1_outcome_postfill_check.md`, `owner_p1_outcome_postfill_check.json`, `RUN-P1-OUTCOME-POST-FILL-CHECK.command`, and `data/owner_p1_outcome_postfill_check_status.json` as the local-only checker to run after the P1 outcome aggregate CSV is reviewed and placed. The command is intentionally not opened by the main launcher and never stages, applies, appends events, deploys, posts, pushes GitHub/LINE, mutates customer data, processes payments, or deletes data.

It also writes `owner_sample_count_handoff.md`, `owner_sample_count_handoff.json`, `owner_sample_count_paste_block.txt`, and `data/owner_sample_count_handoff_status.json` as the one-screen owner handoff for the Batch 1 focused missing aggregate sample counts, copy-only paste block, and after-fill local commands. It reads the full P0 batch handoff status so the report and console keep the 18-row coverage requirement visible and point to Batch 2 before Week 0 sample collection is treated as fully covered.

It also writes `owner_p0_now.html`, `owner_p0_now.md`, `owner_p0_now.json`, and `data/owner_p0_now_status.json` as the shortest current P0 owner action cockpit/card for sample-count collection. It opens no external URLs, creates no live input files, writes no events, and keeps Batch 1, Batch 2, embedded copy blocks, after-fill commands, and approval gate status visible on one screen.

It also writes `sample_gate_collection_sprint.md`, `sample_gate_collection_sprint.json`, and `data/sample_gate_collection_sprint_status.json` as a local-only Day 3 / Day 7 sample-count sprint. It turns the current P0 gaps into a timeboxed owner queue and still performs no live input creation, event append, deploy, post, GitHub push/PR, public link change, LINE action, customer-data mutation, payment action, or delete.

It also writes `owner_p0_launcher.md`, `OPEN-P0-SAMPLE-GATE.command`, and `data/owner_p0_launcher_status.json` as the P0-only local launcher for the current sample-count blocker. The command opens only local P0 sample-gate files and prints due status, focused/full P0 counts, quick-count progress, preflight readiness, full P0 form/intake, recovery, and approval queue status.

It also writes `owner_sample_count_recovery.md`, `owner_sample_count_recovery.json`, and `data/owner_sample_count_recovery_status.json` as the local-only recovery coordinator after owner sample counts are filled.

It also writes `owner_p0_postfill_check.md`, `owner_p0_postfill_check.json`, `RUN-P0-POST-FILL-CHECK.command`, and `data/owner_p0_postfill_check_status.json` as the local-only post-fill checker after owner sample counts are filled. The command runs only whitelisted local npm scripts, recomputes source trust, and keeps staging, apply, event append, deploy, post, push, LINE, customer-data, payment, and delete actions blocked.

It also writes `owner_sample_count_recovery_fixture_report.md` and `data/owner_sample_count_recovery_fixture_status.json` as the fixture-only state-transition guard for the sample-count recovery coordinator.

It also writes `owner_action_launcher.md`, `OPEN-3Q-GROWTH-LOOP.command`, and `data/owner_action_launcher_status.json` as a local-only review launcher. The launcher opens `owner_p0_now.html`, `owner_p0_now.md`, the copy-only sample-count paste block, focused paste template, `p0_counts_preflight.md`, `owner_p0_postfill_check.md`, `owner_p0_postfill_check.json`, `data/owner_p0_postfill_check_status.json`, `worker_dry_run.md`, `data/worker_dry_run_status.json`, `prepared_but_blocked.md`, `approval_queue.json`, and `data/approval_queue_status.json` directly, prints the current P0-now status plus quick-count filled/missing progress, P0 counts preflight readiness, sample-count recovery readiness, P0 post-fill check readiness, source trust/scoring gate state, Worker dry-run status, and approval queue status in Terminal, and points after-fill handling back to `owner_sample_count_handoff.md`. It prints `./RUN-P0-POST-FILL-CHECK.command` for manual use after counts are filled but intentionally does not auto-open or auto-run it. The weekly runner only generates the launcher; it opens local files only when the owner runs the `.command` file.

It also writes `owner_approval_form.html`, `data/owner_approval_form_status.json`, `owner_approval_form_fixture_report.md`, and `data/owner_approval_form_fixture_status.json` as a browser-only owner metadata aid for external gates. It downloads `owner_approval_input.json` only and never executes remote D1, deploy, GitHub, public-link, post, LINE, payment, customer-data, or deletion actions.

It also writes `manual_publish_packet.md`, `manual_publish_packet.json`, and `data/manual_publish_packet_status.json` as the draft-only handoff package for owner-reviewed manual posting.

It also writes `manual_publish_capture_plan.md`, `manual_publish_capture_plan.json`, and `data/manual_publish_capture_plan_status.json` as the aggregate-only Day 3 / Day 7 post-manual-publish data collection plan.

It also writes `manual_publish_brief.md`, `manual_publish_brief.json`, and `data/manual_publish_brief_status.json` as the Day 0 single-packet owner review card. It blocks formal posting when the selected tracking URL is still local-only and never publishes, schedules, changes public links, pushes LINE, deploys, creates GitHub activity, mutates customer data, processes payments, deletes data, or writes real events.

It also writes `public_tracking_url_pack.md`, `public_tracking_url_pack.json`, and `data/public_tracking_url_pack_status.json` as the local-only public tracking URL preview pack. It preserves the selected route shape under an owner-approved Worker URL placeholder and never deploys, activates public URLs, publishes, schedules, changes public links, pushes LINE, creates GitHub activity, mutates customer data, processes payments, deletes data, or writes real events.

It also writes `owner_public_url_approval_preview.md`, `owner_public_url_approval_preview.json`, and `data/owner_public_url_approval_preview_status.json` as the local-only public URL approval checklist. It previews the three required public URL gates and their non-secret fields, but never creates `owner_approval_input.json`, deploys, activates public URLs, publishes, schedules, changes links, pushes LINE, creates GitHub activity, mutates customer data, processes payments, deletes data, or writes real events.

It also writes `manual_publish_evidence.md`, `manual_publish_evidence.example.json`, `data/manual_publish_evidence_status.json`, `manual_publish_evidence_form.html`, `data/manual_publish_evidence_form_status.json`, `manual_publish_evidence_form_fixture_report.md`, `data/manual_publish_evidence_form_fixture_status.json`, `manual_publish_evidence_fixture_report.md`, and `data/manual_publish_evidence_fixture_status.json` as the local-only owner evidence intake after a manual publish. The live owner input `manual_publish_evidence.json` is intentionally not created by weekly runs and is excluded from GitHub export bundles.

`github:workflow-guard` writes `github_workflow_guard.md`, `github_workflow_guard.json`, and `data/github_workflow_guard_status.json`. It reads only the repo-ready GitHub workflow and `package.json`, then blocks accidental drift toward deploys, GitHub writes, secret contexts, LINE/payment actions, or macOS LaunchAgent readback in CI.

`archive:week` copies the current weekly report, scores, approval queue, A/B status, content attribution breakdown, North Star funnel contract, North Star outcome preflight, full-funnel aggregate preview, real-data input pack, source readiness, source capture pack, source compile preview, source compile fixtures, data collection brief, focused Next P0 form/intake/quick-capture artifacts, sample-gate capture calendar, sample-gate due status and due fixtures, sample-gate recovery pack, sample-count handoff, schedule catch-up status, Week 0 owner capture queue, owner sample-gate status, owner next-action card, manual publish packet, manual publish capture plan, manual publish brief, public tracking URL pack, owner public URL approval preview, manual publish evidence status, manual publish evidence form, manual publish evidence form fixtures, sample-gate owner worksheet, sample-gate owner form, sample-gate owner form fixtures, owner sample-gate fixtures, quality-review form, quality-review form fixtures, candidate retirement fixtures, sample gate plan, iteration history, GitHub workflow guard, GitHub export status, artifact retention monitor, artifact retention review pack, gate readiness, red-line priority, PreparedButBlocked handoff, owner-gate evidence fixtures, post-gate verification fixtures, next-round plan, objective audit, objective audit status, candidate files, dry-run states, launch readiness, and red-line evidence into a timestamped local folder with a sha256 manifest. It never deletes prior archives and has no external effect.

`objective:audit` is the regression guard for the user's original objective. It checks the exact nine-step Sunday sequence, one-variable-per-round rule, the North Star per-100-click funnel contract, post-level content attribution links, sample thresholds, win rule, required outputs, sample-gate capture calendar, sample-gate due status, weekly catch-up monitor, artifact retention monitor, red-line priority queue, Week 0 owner capture queue, owner sample-gate status, sample-gate owner worksheet, sample-gate owner form, sample-gate owner form fixtures, owner sample-gate fixtures, owner quality-review form, owner quality-review form fixtures, owner approval form, owner approval form fixtures, candidate retirement fixtures, iteration history, approval queue, owner evidence fixtures, post-gate verification fixtures, and prohibited external effects. It writes `objective_sequence_audit.json`, `objective_sequence_audit.md`, and `data/objective_sequence_audit_status.json`.

`event:smoke` starts the candidate Worker with an isolated temporary local D1 state, posts synthetic `/e` events for `link_click`, `page_view`, `cta_click`, `line_add`, `lead_submit`, `deal`, and `quality_flag`, then verifies sensitive metadata and invalid event types are rejected. It also verifies `/r` preserves `asset_id`, `content_id`, `variant_id`, session, and UTM attribution into the candidate URL, and verifies `/ab` challenger redirects preserve the Worker-generated `variant_id` default. It seeds an isolated sample-met quality-regression fixture, triggers the scheduled scorer, and checks that the challenger is rejected when `no_quality_regression=false`. Quality regression covers spam flags plus downstream lead-rate and close-rate retention against the champion baseline. It does not write `data/lp_events.jsonl`, remote D1, public links, LINE, payments, customer data, or production resources.

`tracking:smoke` starts the candidate Worker with an isolated temporary local D1 state, reads every URL in `tracking_links.json`, and fetches each one with `redirect: manual`. It verifies challenger and content links preserve `asset_id`, `content_id`, `variant_id`, and UTM attribution into `/candidate`; verifies the A/B route can land on the challenger with generated `variant_id`; and verifies LINE/champion redirects are captured but not followed. It writes only temporary local D1 `link_click` rows and never writes `data/lp_events.jsonl`.

`event:quality` is a read-only gate for `data/lp_events.jsonl`. It scans every real event row before scoring and blocks malformed JSON, unknown keys, unknown `asset_id`, invalid `event_type`, duplicate `event_id`, sensitive metadata keys, and email/phone/card-like values. It writes only `data/event_input_quality_status.json`; it does not append events, mutate customer data, deploy, publish, push LINE, process payments, or delete data.

`next_round_plan.md` is generated with the weekly artifacts. It decides whether to continue the current one-variable test, queue a winning challenger for owner promotion review, or prepare the next local one-variable round. Sample-insufficient weeks must keep the current variable and must not rotate to `hook`, `offer`, or `visual_claim` early.

`owner_console.html` is generated after the archive snapshot so it can point at the latest manifest, iteration history, focused Next P0 form / quick capture / intake status, P0-now action card, weekly schedule / LaunchAgent status, retention review pack, and Day 3 / Day 7 due-state guard. It is a local review surface only: no forms, no external links, no fetch, no send beacon, no deploy, no public link change, and no LINE/customer/payment action.

`win-rule:fixtures` runs fixture-only regression scenarios for sample-insufficient, human-promotion-only, underperform, spam quality-regression, lead-rate regression, and close-rate regression paths. It writes `data/win_rule_fixture_status.json` and `win_rule_fixture_report.md`; it does not read or write `data/lp_events.jsonl`.

`decision:replay` runs fixture-only real-data-shaped decision replay scenarios. It writes temporary filled source-capture ledgers, compiles them through `source-capture-compile.mjs` into owner-preview aggregate CSVs, imports those previews into temporary JSONL with the existing importers, scores them locally, and verifies A/B plus next-round decisions for sample-insufficient, winning-owner-review, underperform-next-variable, spam regression, lead-rate regression, and close-rate regression paths. It writes `data/real_data_decision_replay_status.json` and `real_data_decision_replay_report.md`; it never writes `data/lp_events.jsonl` or performs external actions.

`variable:fixtures` runs fixture-only one-variable rotation scenarios for `hook`, `offer`, `visual_claim`, and `cta_text`. It writes `data/variable_rotation_fixture_status.json` and `variable_rotation_fixture_report.md`; it does not rewrite live config, publish, deploy, change links, push LINE, mutate customer data, process payments, or delete data.

`launch_readiness.json` and `owner_approval_pack.md` are regenerated with the weekly artifacts. They are review packs only: the remote D1 create/migrate commands, production Worker deploy, public A/B link placement, GitHub push/PR, formal posts, LINE push, ECPay, customer-data changes, and deletion remain owner-gated.

`approval:plan` reads `launch_readiness.json` and optional `owner_approval_input.json`, then writes `approval_resume_plan.md` and `data/approval_resume_status.json`. It is a dry-run planner: it validates non-secret approval metadata, ISO `approved_at`, Cloudflare D1 UUID/resource names, Worker URL, rollback URL, GitHub repo URL, and safe branch names. It never runs remote D1, production deploy, GitHub push/PR, public link changes, posting, LINE, payment, customer-data, or delete actions.

`owner:evidence` reads optional ignored `owner_gate_evidence.json`, then writes `owner_gate_evidence.md`, `owner_gate_evidence.example.json`, and `data/owner_gate_evidence_status.json`. Missing input is healthy and stays `waiting_for_owner_evidence`; supplied input is validated for non-secret gate evidence, https URLs, D1 UUID, safe Worker/GitHub metadata, small-traffic share, and manual-only acknowledgement. For D1 evidence, `recurring_aggregate_read_approved` must be an explicit boolean: `false` is valid schema evidence and keeps weekly remote reads disabled, while only `true` authorizes the aggregate-read plan after post-gate readiness. It never runs external commands, deploys, posts, pushes, changes public links, touches LINE, mutates customer data, processes payment, or deletes data.

`owner:evidence:fixtures` runs temporary owner-gate evidence scenarios against the evidence-only intake. It verifies missing input waits, copied example placeholders stay blocked, valid D1 evidence opens only post-gate planning, valid non-manual evidence can become post-gate-ready, sensitive/customer fields are rejected, invalid public A/B metadata is rejected, duplicate/unknown gates are rejected, manual-only acknowledgement never becomes automation, and invalid GitHub evidence is rejected. It writes `data/owner_gate_evidence_fixture_status.json` and `owner_gate_evidence_fixture_report.md`; it executes no external command.

`post:verify` reads `data/owner_gate_evidence_status.json` and local weekly evidence, then writes `post_gate_verification.md` and `data/post_gate_verification_status.json`. It decides which owner-executed gates are ready for separately approved read-only follow-up verification, but it performs no network read, remote CLI, deploy, GitHub write, public link change, LINE action, payment, customer-data mutation, or delete.

`post:verify:fixtures` runs temporary owner-evidence statuses through the post-gate verifier. It checks waiting state, remote D1 readiness, Worker dependency on D1, public A/B dependency on Worker, GitHub review-only planning, all non-manual gates ready as plan-only, manual-only acknowledgement staying non-automated, and invalid evidence blocking. It writes `data/post_gate_verification_fixture_status.json` and `post_gate_verification_fixture_report.md`; it performs no network read, remote CLI, deploy, GitHub write, public link change, LINE action, payment, customer-data mutation, or delete.

`gate:readiness` reads `launch_readiness.json`, `data/approval_resume_status.json`, and `data/post_gate_verification_status.json`, then writes `gate_readiness.md` and `data/gate_readiness_status.json`. It is a local dependency matrix for owner gates: remote D1 comes before Worker deploy, Worker deploy comes before public A/B routing, GitHub remains target-repo gated, and formal posting / LINE / ECPay / customer-data actions remain manual-only. It also exposes parallel non-secret metadata capture actions, including the public A/B `champion_url`, `public_surface`, and `rollback_url`, so the owner can prepare review inputs while execution order stays enforced. It never runs external commands and every gate stays `ready_for_autorun=false`.

`redline:priority` reads `prepared_but_blocked.json`, `approval_queue.json`, `data/approval_queue_status.json`, `data/gate_readiness_status.json`, `data/data_collection_progress_status.json`, and `data/source_readiness_status.json`, then writes `redline_priority.md`, `redline_priority.json`, and `data/redline_priority_status.json`. It turns local reviews, external owner gates, composite launch sequence, and manual-only red lines into one ordered operator queue while carrying the compact approval queue counts into the local P0 action context. It currently prioritizes P0 sample-gate aggregate counts while real events are empty, covers every PreparedButBlocked action, preserves gate order, and never executes Cloudflare, GitHub, public-link, LINE, payment, customer-data, or delete actions.

`blocked:report` reads `prepared_but_blocked.json`, `approval_queue.json`, and `data/redline_priority_status.json`, then writes `prepared_but_blocked.md` and `data/prepared_but_blocked_report_status.json`. It turns the machine queue into a human-readable owner handoff with blocked action, blocker, prepared artifact, and resume condition columns. It performs no Cloudflare, GitHub, public-link, LINE, payment, customer-data, event-write, deploy, publish, or delete action.

`approval:fixtures` runs temporary owner approval input scenarios against the dry-run planner. It verifies that missing input stays blocked, copied example placeholders do not unlock gates, one valid GitHub metadata block becomes plan-only ready, sensitive fields are rejected, public A/B URLs must be absolute, invalid D1/Worker/GitHub metadata stays blocked, invalid `approved_at` stays blocked, and manual-only actions never become automated.

`github:bundle` creates a copy-only repo-ready snapshot under `github_export/bundles/<timestamp>/repo`, writes `data/github_export_status.json` and `github_export_manifest.md`, and excludes live or owner-filled inputs such as `data/lp_events.jsonl`, `data/funnel_aggregates.csv`, `data/manual_conversions.csv`, `owner_approval_input.json`, `owner_gate_evidence.json`, and filled source ledgers. It includes the focused Next P0 quick-capture scripts, sample-gate recovery pack, sample-count handoff, Worker dry-run report/status, retention monitor, retention review pack, and preview-only artifacts, but does not run `git init`, `git add`, commit, remote add, push, PR creation, deploy, post, LINE, payment, customer-data, or delete actions.

`artifacts:retention` writes `artifact_retention.md` and `data/artifact_retention_status.json`. It scans local `github_export/bundles/`, `archive/`, and `logs/`, reports size/count warnings and owner-only cleanup candidates, and never deletes, moves, compresses, uploads, deploys, posts, pushes LINE/GitHub, mutates customer data, processes payments, or changes public links.

`artifacts:retention-review` writes `artifact_retention_review_pack.md`, `artifact_retention_review_pack.json`, and `data/artifact_retention_review_status.json`. It converts the retention monitor output into an owner review queue and acceptance checks after manual cleanup, but never creates cleanup commands, mutates files, deletes data, moves/compresses artifacts, deploys, posts, pushes GitHub/LINE, touches customer data, processes payments, or changes public links.

`.github/workflows/3q-growth-loop-weekly.yml` is included in the repo-ready bundle. If the owner later pushes this project to an approved GitHub repo, the workflow runs every Sunday 00:10 Asia/Taipei and on manual dispatch. It only runs `npm run verify` and uploads review artifacts; it contains no deploy step, Git write step, LINE credentials, payment credentials, customer-data mutation, or public-link action.

## Local Weekly Schedule

Prepared LaunchAgent template:

```text
launchd/com.angelia.3q-growth-loop.weekly.plist
```

Schedule:

```text
Sunday 00:10 Asia/Taipei
```

Install or refresh the local schedule:

```zsh
npm run schedule:install
npm run schedule:status
npm run schedule:catchup
```

`schedule:status` records structured `launchctl_runtime` evidence, including service state, run count, and last exit code. The objective audit only treats the local Sunday schedule as runtime-verified after at least one real LaunchAgent invocation exits with code `0`; a loaded plist alone is not considered execution proof.

LaunchAgent stdout/stderr are stored under `~/Library/Logs/Angelia/3q-growth-loop/`, not inside `~/Documents`. This avoids macOS privacy ACLs on Documents preventing launchd from opening its log files before the runner starts.

Rollback:

```zsh
npm run schedule:uninstall
```

The Worker cron candidate remains in `wrangler.jsonc` as `0 16 * * SAT`, which equals Sunday 00:00 Taipei after production deploy. Do not run a real deploy until the owner approves target, route, rollback, and external risk.

Remote D1 collection is owner-gated. After the schema is applied and verified, the owner evidence must explicitly include `recurring_aggregate_read_approved: true`. The weekly runner then switches automatically from local review to aggregate-only remote collection. A manual approved run uses:

```zsh
npm run collect:d1:remote:approved
```

This command independently revalidates owner evidence, post-gate readiness, and exact D1 name/id before querying. Its SQL reads date, asset/content attribution, event type, grouped count, and aggregate quality score only. It excludes `session_id`, URL, referrer, user-agent hash, IP country, and `metadata_json`, then atomically writes deterministic scoring events to `data/lp_events.jsonl`. The legacy raw remote exporter is blocked.

To test the local scheduled handler after starting `npm run dev`:

```zsh
curl "http://127.0.0.1:8787/cdn-cgi/handler/scheduled"
npm run d1:local:scores
```

The scheduled handler only writes local/candidate scores and an approval queue row. It does not publish, push LINE, deploy production, change a public link, mutate customer records, process payments, or delete data.

To inspect the prepared A/B router locally:

```zsh
curl "http://127.0.0.1:8787/ab/status"
curl -I "http://127.0.0.1:8787/ab/ab-week0-cta-text-001?sid=local-challenger-003&utm_source=local&utm_medium=smoke"
```

The router uses a stable 90/10 bucket. It is still draft-only: do not place `/ab/ab-week0-cta-text-001` in public traffic until the current champion URL, 10% allocation, test duration, and rollback path are approved.

## Event Input

Real event input is local JSONL:

```text
data/lp_events.jsonl
```

Example:

```json
{"event_id":"manual-001","occurred_at":"2026-07-08T10:00:00+08:00","asset_id":"challenger-week0-cta-text-v1","event_type":"link_click","source":"facebook","campaign":"week0"}
```

Do not store phone, email, LINE user ID, names, addresses, payment fields, or customer private notes in event metadata.

Before scoring real or manually applied rows, run:

```zsh
npm run event:quality
```

If `data/event_input_quality_status.json` reports `scoring_allowed=false`, stop and remove the bad local rows manually after review; do not continue to weekly scoring.

## Real Data Intake Plan

Use this before applying real aggregate rows:

```zsh
npm run real-data:intake
```

It checks for:

- `data/funnel_aggregates.csv`
- `data/manual_conversions.csv`

If the files are missing, the plan stays healthy and tells you which example template to copy. If a file exists, it runs preview-only validation through the existing importer and writes owner-preview JSONL under `data/real_data_intake/`.

Only after reviewing `real_data_intake_plan.md`, run the listed local apply command. The intake plan itself never writes `data/lp_events.jsonl`.

## Full Funnel Aggregate Input

Use aggregate counts only when remote Worker tracking is not live yet but you can read safe totals from platform analytics or manual review. Do not export user rows, chat logs, customer records, or payment rows.

Allowed CSV columns:

```text
date,asset_id,event_type,count,source,medium,campaign,content_id,variant_id,quality_score
```

Allowed full-funnel event types:

```text
link_click,page_view,cta_click,line_add,lead_submit,deal,quality_flag
```

Preview first:

```zsh
npm run import:funnel:preview
```

Only after reviewing `data/funnel_aggregate_status.json` and confirming the CSV is aggregate-only, append to the local scoring input:

```zsh
npm run import:funnel:apply
npm run event:quality
npm run week0
```

`import:funnel:apply` is still local-only, but it intentionally requires `--confirm-real-data` inside the npm script because it changes `data/lp_events.jsonl`. It refuses copied `data/funnel_aggregates.example.csv` content even when confirmation is present. It must not include phone, email, LINE user ID, customer name, address, payment fields, private notes, messages, or conversation text.

## Manual Conversion Input

Use aggregate counts only when LINE 進線、留資、成交還沒有自動回寫。 Do not export chat logs or customer rows.

Allowed CSV columns:

```text
date,asset_id,event_type,count,source,medium,campaign,content_id,variant_id,quality_score
```

Allowed manual event types:

```text
line_add,lead_submit,deal,quality_flag
```

Preview first:

```zsh
npm run import:manual:preview
```

Only after reviewing `data/manual_conversion_status.json` and confirming the CSV is aggregate-only, append to the local scoring input:

```zsh
npm run import:manual:apply
npm run event:quality
npm run week0
```

`import:manual:apply` is still local-only, but it intentionally requires `--confirm-real-data` inside the npm script because it changes `data/lp_events.jsonl`. It refuses copied `data/manual_conversions.example.csv` content even when confirmation is present. It must not include phone, email, LINE user ID, customer name, address, payment fields, private notes, messages, or conversation text.

## Winner Rule

The challenger is only eligible for human promotion review when:

- `line_add_rate > champion * 1.15`
- sample thresholds are met:
  - `min_visits=100`
  - `min_cta_clicks=20`
  - `min_line_adds=5`
  - `min_test_days=3`
  - preferred test days: `7`
- no quality regression is observed

Sample不足不換冠軍.
