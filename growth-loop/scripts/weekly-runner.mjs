import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, rename, rmdir, unlink, writeFile } from "node:fs/promises";
import { appendFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  existingRunLockDecision,
  recoveryClaimDecision,
  sameLockSnapshot,
} from "./lib/run-lock-policy.mjs";
import process from "node:process";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "weekly_runner_status.json");
const LOG_DIR = path.join(ROOT, "logs");
const RUN_LOCK_PATH = path.join(tmpdir(), "angelia-3q-growth-loop-weekly-runner.lock");
const RUN_LOCK_OWNER_NAME = "owner.json";
const RUN_LOCK_CLAIM_NAME = ".recovery-claim.json";
const LEGACY_RECOVERY_CLAIM_PATH = `${RUN_LOCK_PATH}.legacy-recovery-claim`;

const COMMANDS = [
  {
    step: "bootstrap_local_d1_schema",
    command: "npm",
    args: ["run", "d1:local:migrate"],
    external_effect: false,
    note: "Idempotently applies schema/d1-week0.sql to the default local Wrangler D1 state before export. It never accesses or migrates remote D1 and never writes data/lp_events.jsonl.",
  },
  {
    step: "weekly_runner_lock_fixtures",
    command: "npm",
    args: ["run", "weekly:lock:fixtures"],
    external_effect: false,
    note: "Fixture-only lock policy proof: a live PID retains the lock regardless of age, while dead or invalid owners recover without executing external actions.",
  },
  {
    step: "collect_data",
    command: "npm",
    args: ["run", "collect:d1:auto"],
    external_effect: false,
    note: "Owner-evidence-driven collection selector. It stays local by default and can switch only to aggregate-only remote reads after recurring-read approval, post-gate readiness, and exact D1 target matching. Raw remote event rows and customer fields are never queried.",
  },
  {
    step: "cloudflare_d1_readiness",
    command: "npm",
    args: ["run", "cloudflare:d1:readiness:live"],
    external_effect: false,
    note: "Read-only Cloudflare D1 metadata inventory. It detects only the dedicated database name and never creates, binds, migrates, queries tables, reads customer data, or deletes resources.",
  },
  {
    step: "live_telemetry_readiness",
    command: "npm",
    args: ["run", "telemetry:readiness:live"],
    external_effect: false,
    note: "Read-only live telemetry chain observation. It lists Candidate deployments and GETs public health/pages, but never queries D1 tables, POSTs events, deploys, or reads customer data.",
  },
  {
    step: "live_telemetry_readiness_fixtures",
    command: "npm",
    args: ["run", "telemetry:readiness:fixtures"],
    external_effect: false,
    note: "Fixture-only live telemetry readiness states. It proves existing deployments switch to provenance verification and D1 metadata never proves schema absence; no network refresh or external effect.",
  },
  {
    step: "d1_schema_contract",
    command: "npm",
    args: ["run", "d1:schema:contract"],
    external_effect: false,
    note: "Applies the Week 0 schema twice to a disposable local D1 database and verifies idempotency, integrity, seeds, foreign keys, and CHECK constraints. It never creates, queries, or migrates remote D1.",
  },
  {
    step: "approved_d1_config_preview",
    command: "npm",
    args: ["run", "d1:config:preview"],
    external_effect: false,
    note: "Preview-only guard for the future owner-approved D1 id. Weekly runs never pass --apply and never change wrangler.jsonc or remote D1 state.",
  },
  {
    step: "d1_collection_mode_fixtures",
    command: "npm",
    args: ["run", "d1:collection:fixtures"],
    external_effect: false,
    note: "Plan-only selector fixtures prove missing approval, missing post-gate evidence, or D1 mismatch always stays local; no D1 query is executed.",
  },
  {
    step: "d1_aggregate_export_fixtures",
    command: "npm",
    args: ["run", "d1:aggregate:fixtures"],
    external_effect: false,
    note: "Fixture Wrangler proves the approved path queries grouped counts only and excludes raw session, URL, referrer, metadata, and customer fields.",
  },
  {
    step: "event_input_quality_gate",
    command: "npm",
    args: ["run", "event:quality"],
    external_effect: false,
    note: "Read-only local lp_events quality gate. Blocks PII, unknown assets, duplicates, and malformed events before scoring.",
  },
  {
    step: "funnel_aggregate_preview",
    command: "npm",
    args: ["run", "import:funnel:preview"],
    external_effect: false,
    note: "Preview-only full-funnel aggregate import. No write to data/lp_events.jsonl unless owner later applies it locally.",
  },
  {
    step: "funnel_aggregate_fixtures",
    command: "npm",
    args: ["run", "funnel:fixtures"],
    external_effect: false,
    note: "Fixture-only full-funnel importer guard. Uses temporary files and never writes data/lp_events.jsonl.",
  },
  {
    step: "real_data_apply_fixtures",
    command: "npm",
    args: ["run", "apply:fixtures"],
    external_effect: false,
    note: "Fixture-only real-data apply guard for funnel and manual imports. Never writes data/lp_events.jsonl.",
  },
  {
    step: "real_data_input_pack",
    command: "npm",
    args: ["run", "real-data:pack"],
    external_effect: false,
    note: "Template-only real-data input pack. It creates fill templates under data/real_data_input_pack/ but never creates live input CSVs or writes data/lp_events.jsonl.",
  },
  {
    step: "source_readiness_monitor",
    command: "npm",
    args: ["run", "source:readiness"],
    external_effect: false,
    note: "Read-only source readiness monitor for each funnel stage. No live input creation, data append, or external effect.",
  },
  {
    step: "champion_contract_audit",
    command: "npm",
    args: ["run", "champion:audit"],
    external_effect: false,
    note: "Read-only live champion contract audit. It verifies public URL and LINE destination, rejects Worker invocations as visit counts, and never submits the contact form or reads customer data.",
  },
  {
    step: "champion_source_lock_fixtures",
    command: "npm",
    args: ["run", "champion:source-lock:fixtures"],
    external_effect: false,
    note: "Fixture-only source-lock matrix for pinned refs, ancestry, target drift, lock-tuple integrity, and missing-repo fail-closed behavior.",
  },
  {
    step: "champion_integration_candidate_build",
    command: "npm",
    args: ["run", "champion:integration:build"],
    external_effect: false,
    note: "Source-locked local 3q-site repair candidate. It removes false-success lead UI and prepares no-PII page_view/cta_click telemetry without editing the source repo, deploying, pushing, or changing public links.",
  },
  {
    step: "source_capture_pack",
    command: "npm",
    args: ["run", "source:capture"],
    external_effect: false,
    note: "Template-only owner source-capture pack. No live CSV creation, event append, or external effect.",
  },
  {
    step: "sample_gate_compile_probe",
    command: "npm",
    args: ["run", "sample-gate:compile-probe"],
    external_effect: false,
    note: "Compile probe for the 18-row sample-gate ledger template. No live CSV creation, event append, or external effect.",
  },
  {
    step: "sample_gate_replay_fixtures",
    command: "npm",
    args: ["run", "sample-gate:replay"],
    external_effect: false,
    note: "Fixture-only replay for owner-filled sample-gate ledgers. Uses temporary files and never writes data/lp_events.jsonl.",
  },
  {
    step: "source_capture_compile",
    command: "npm",
    args: ["run", "source:compile"],
    external_effect: false,
    note: "Owner-preview compiler for filled source-capture ledger. No live CSV creation, event append, or external effect.",
  },
  {
    step: "source_capture_compile_fixtures",
    command: "npm",
    args: ["run", "source:compile:fixtures"],
    external_effect: false,
    note: "Fixture-only source capture compiler guard. Uses temporary ledgers and never writes live CSVs or data/lp_events.jsonl.",
  },
  {
    step: "real_data_intake_plan",
    command: "npm",
    args: ["run", "real-data:intake"],
    external_effect: false,
    note: "Owner-preview intake plan for real aggregate CSVs. It never appends data/lp_events.jsonl.",
  },
  {
    step: "data_collection_brief",
    command: "npm",
    args: ["run", "data:brief"],
    external_effect: false,
    note: "Local data collection queue for owner-reviewed aggregate counts. No live CSV creation, event append, or external effect.",
  },
  {
    step: "week0_owner_capture_queue",
    command: "npm",
    args: ["run", "owner:capture-queue"],
    external_effect: false,
    note: "Local owner-facing Week 0 sample-gate capture queue. Reads existing plans and creates no live CSV, event append, external write, or customer-data mutation.",
  },
  {
    step: "owner_sample_gate_status",
    command: "npm",
    args: ["run", "owner:sample-gate"],
    external_effect: false,
    note: "Local owner-filled sample-gate decision status. Reads aggregate ledger state only and never applies CSVs, appends events, promotes candidates, deploys, posts, pushes LINE, or changes links.",
  },
  {
    step: "data_collection_progress",
    command: "npm",
    args: ["run", "data:progress"],
    external_effect: false,
    note: "Local data-collection progress dashboard. Reads queue and filled-ledger status only; creates no live CSVs, event writes, external effects, GitHub actions, deploys, posts, or LINE actions.",
  },
  {
    step: "north_star_outcome_preflight",
    command: "npm",
    args: ["run", "north-star:outcome-preflight"],
    external_effect: false,
    note: "Local P1 North Star outcome preflight. Validates link-click, lead, deal, and quality aggregate rows before source compile without creating live inputs, appending events, or causing external effects.",
  },
  {
    step: "north_star_outcome_form",
    command: "npm",
    args: ["run", "north-star:outcome-form"],
    external_effect: false,
    note: "Local browser-only P1 North Star outcome fill form. It downloads a reviewed source_capture_ledger.filled.csv / review JSON only and performs no network calls, live input writes, event writes, deploys, posts, LINE pushes, public link changes, GitHub actions, or customer-data mutation.",
  },
  {
    step: "north_star_outcome_form_fixtures",
    command: "npm",
    args: ["run", "north-star:outcome-form:fixtures"],
    external_effect: false,
    note: "Static fixture guard for the P1 North Star outcome form. Verifies local-only HTML and export contract without live input writes, real event writes, staging, promotion, deploy, post, LINE push, public link change, GitHub action, or customer-data mutation.",
  },
  {
    step: "owner_p1_outcome_intake",
    command: "npm",
    args: ["run", "owner:p1-outcome-intake"],
    external_effect: false,
    note: "Local P1 outcome owner-download intake guard. It checks known source_capture_ledger.filled.csv download locations and never stages files unless explicitly confirmed outside the weekly runner.",
  },
  {
    step: "owner_p1_outcome_intake_fixtures",
    command: "npm",
    args: ["run", "owner:p1-outcome-intake:fixtures"],
    external_effect: false,
    note: "Fixture-only P1 outcome download intake guard. Uses temporary CSV candidates and never writes project live inputs or data/lp_events.jsonl.",
  },
  {
    step: "owner_p1_outcome_postfill_check",
    command: "npm",
    args: ["run", "owner:p1-outcome-postfill-check"],
    external_effect: false,
    note: "Local P1 outcome post-fill checker. It writes a whitelisted local command sequence for after reviewed outcome rows are filled, but does not stage, apply, append events, deploy, post, push GitHub/LINE, mutate customer data, process payments, or delete data.",
  },
  {
    step: "next_p0_owner_form",
    command: "npm",
    args: ["run", "next-p0:form"],
    external_effect: false,
    note: "Focused local browser-only owner fill form for the current 9 Next P0 aggregate rows. It downloads review CSV/JSON only and performs no network calls, event writes, staging, deploys, posts, LINE pushes, public link changes, GitHub actions, or customer-data mutation.",
  },
  {
    step: "next_p0_quick_capture",
    command: "npm",
    args: ["run", "next-p0:quick"],
    external_effect: false,
    note: "Focused quick rank-count adapter for the current Next P0 rows. Weekly runs create local template/status/report and can auto-read a complete owner-filled paste template into preview CSV only; they never write inbox/live CSVs, stage data, append events, or perform external actions.",
  },
  {
    step: "p0_counts_preflight",
    command: "npm",
    args: ["run", "p0:counts-preflight"],
    external_effect: false,
    note: "Local paste-template preflight for focused P0 counts. Reads owner placeholders and reports ready/partial/invalid state without creating live inputs, staging data, appending events, or causing external effects.",
  },
  {
    step: "next_p0_owner_intake",
    command: "npm",
    args: ["run", "next-p0:intake"],
    external_effect: false,
    note: "Focused Next P0 owner-download intake. It validates downloaded aggregate CSVs or the complete quick-filled preview and creates owner-preview CSVs only; weekly runs do not stage live inputs or append data/lp_events.jsonl.",
  },
  {
    step: "owner_data_preflight",
    command: "npm",
    args: ["run", "owner:data-preflight"],
    external_effect: false,
    note: "Local owner-preview scoring preflight. It reads aggregate preview CSVs and reports sample-gate / win-rule readiness without staging, applying, appending data/lp_events.jsonl, or executing external gates.",
  },
  {
    step: "source_trust_matrix",
    command: "npm",
    args: ["run", "source:trust"],
    external_effect: false,
    note: "Local source trust matrix. Classifies real events, D1 exports, and owner previews as scoring-ready or review-only without creating live inputs, appending events, or causing external effects.",
  },
  {
    step: "next_p0_owner_form_fixtures",
    command: "npm",
    args: ["run", "next-p0:form:fixtures"],
    external_effect: false,
    note: "Static fixture guard for the focused Next P0 form. Verifies local-only HTML and export contract without live input writes, real event writes, staging, promotion, deploy, post, LINE push, public link change, GitHub action, or customer-data mutation.",
  },
  {
    step: "next_p0_quick_capture_fixtures",
    command: "npm",
    args: ["run", "next-p0:quick:fixtures"],
    external_effect: false,
    note: "Fixture-only guard for the quick rank-count adapter. Uses temporary paths and never writes project inbox/live CSVs, data/lp_events.jsonl, deploys, posts, LINE pushes, public link changes, GitHub actions, or customer-data mutation.",
  },
  {
    step: "p0_counts_preflight_fixtures",
    command: "npm",
    args: ["run", "p0:counts-preflight:fixtures"],
    external_effect: false,
    note: "Fixture-only P0 counts preflight guard. Uses temporary paste templates to verify waiting, partial, ready, and sensitive metadata states without project live inputs, event writes, or external effects.",
  },
  {
    step: "next_p0_owner_intake_fixtures",
    command: "npm",
    args: ["run", "next-p0:intake:fixtures"],
    external_effect: false,
    note: "Fixture-only guard for focused Next P0 intake. Uses temporary downloads and temporary live paths; creates no project live inputs, event writes, deploys, posts, LINE pushes, public link changes, GitHub actions, or customer-data mutation.",
  },
  {
    step: "sample_gate_capture_calendar",
    command: "npm",
    args: ["run", "sample-gate:calendar"],
    external_effect: false,
    note: "Local sample-gate capture calendar. Writes JSON/Markdown/ICS review artifacts only; does not import calendars, create reminders, write events, deploy, post, push LINE/GitHub, or mutate customer data.",
  },
  {
    step: "sample_gate_due_status",
    command: "npm",
    args: ["run", "sample-gate:due"],
    external_effect: false,
    note: "Local Day 3 / Day 7 due-status monitor. Reads sample-gate artifacts and writes JSON/Markdown status only; does not import calendars, create reminders, open browsers, write events, deploy, post, push LINE/GitHub, or mutate customer data.",
  },
  {
    step: "sample_gate_due_status_fixtures",
    command: "npm",
    args: ["run", "sample-gate:due:fixtures"],
    external_effect: false,
    note: "Fixture-only Day 3 / Day 7 due-state guard. Uses temporary outputs to prove waiting, due, overdue recovery, and Day 7 paths without touching project due artifacts or external systems.",
  },
  {
    step: "sample_gate_owner_worksheet",
    command: "npm",
    args: ["run", "owner:worksheet"],
    external_effect: false,
    note: "Local owner worksheet for the 18 P0 sample-gate rows. It creates no live CSV, event append, deploy, post, LINE push, public link change, or customer-data mutation.",
  },
  {
    step: "sample_gate_owner_form",
    command: "npm",
    args: ["run", "owner:form"],
    external_effect: false,
    note: "Local browser-only owner fill form for the 18 P0 sample-gate rows. It downloads CSV/JSON only and performs no network calls, event writes, deploys, posts, LINE pushes, public link changes, or customer-data mutation.",
  },
  {
    step: "sample_gate_owner_form_fixtures",
    command: "npm",
    args: ["run", "owner:form:fixtures"],
    external_effect: false,
    note: "Fixture-only browser form export replay. Uses temporary CSV downloads to verify source compile and owner sample-gate status without live input writes, real event writes, promotion, deploy, post, LINE push, public link change, or customer-data mutation.",
  },
  {
    step: "owner_sample_gate_intake",
    command: "npm",
    args: ["run", "owner:intake"],
    external_effect: false,
    note: "Local owner-download intake guard. It checks known sample_gate_ledger.filled.csv download locations and never stages files unless explicitly confirmed outside the weekly runner.",
  },
  {
    step: "owner_sample_gate_intake_fixtures",
    command: "npm",
    args: ["run", "owner:intake:fixtures"],
    external_effect: false,
    note: "Fixture-only owner-download intake guard. Uses temporary CSV candidates and never writes live sample-gate inputs or data/lp_events.jsonl.",
  },
  {
    step: "owner_sample_gate_fixtures",
    command: "npm",
    args: ["run", "owner:sample-gate:fixtures"],
    external_effect: false,
    note: "Fixture-only owner sample-gate contract. Uses temporary ledgers to cover missing, partial, insufficient, winning-review, underperform, and sensitive-evidence paths without writing real events or promoting candidates.",
  },
  {
    step: "owner_quality_review",
    command: "npm",
    args: ["run", "owner:quality-review"],
    external_effect: false,
    note: "Local aggregate quality-review gate. It waits for a sample-rate winner, validates non-PII quality evidence, never writes events, and never promotes a challenger.",
  },
  {
    step: "owner_quality_review_form",
    command: "npm",
    args: ["run", "owner:quality-review:form"],
    external_effect: false,
    note: "Local browser-only quality-review fill form. It downloads JSON only and performs no network calls, event writes, approval queue writes, deploys, posts, LINE pushes, public link changes, customer-data mutation, or promotion.",
  },
  {
    step: "owner_quality_review_form_fixtures",
    command: "npm",
    args: ["run", "owner:quality-review:form:fixtures"],
    external_effect: false,
    note: "Fixture-only quality-review browser form export replay. Uses temporary JSON downloads to verify waiting, pass, regression, and sensitive-input paths without live input writes, approval queue writes, event writes, or promotion.",
  },
  {
    step: "owner_quality_review_fixtures",
    command: "npm",
    args: ["run", "owner:quality-review:fixtures"],
    external_effect: false,
    note: "Fixture-only owner quality-review contract. Uses temporary aggregate JSON inputs to cover waiting, pass, regression, sensitive, and missing-field paths without writing events or promoting candidates.",
  },
  {
    step: "owner_next_action",
    command: "npm",
    args: ["run", "owner:next-action"],
    external_effect: false,
    note: "Local owner next-action card. Reads current gates and writes a review-only action card with no staging, event write, deploy, post, LINE, payment, customer-data, GitHub, or delete action.",
  },
  {
    step: "sample_gate_recovery_pack",
    command: "npm",
    args: ["run", "sample-gate:recovery"],
    external_effect: false,
    note: "Local Day 3 / Day 7 sample-gate recovery pack. Packages the missing aggregate rows, owner fast path, and blocked actions without creating live inputs, staging data, writing events, or causing external effects.",
  },
  {
    step: "sample_gate_batch_handoff",
    command: "npm",
    args: ["run", "sample-gate:batches"],
    external_effect: false,
    note: "Local P0 full-coverage batch handoff. Splits the 18 sample-gate rows into focused and remaining owner-count batches without creating live inputs, writing events, or causing external effects.",
  },
  {
    step: "sample_gate_batch_preflight",
    command: "npm",
    args: ["run", "sample-gate:batch-preflight"],
    external_effect: false,
    note: "Local full-P0 batch preflight. Validates the owner-filled 18-row aggregate ledger before source compile without creating live inputs, staging data, appending events, or causing external effects.",
  },
  {
    step: "owner_sample_count_handoff",
    command: "npm",
    args: ["run", "owner:sample-count-handoff"],
    external_effect: false,
    note: "Local one-screen owner handoff for the current missing sample counts. It reads existing recovery status and writes no live inputs, events, or external effects.",
  },
  {
    step: "owner_p0_now",
    command: "npm",
    args: ["run", "owner:p0-now"],
    external_effect: false,
    note: "Local P0-now owner card. It condenses current sample-count handoffs into the shortest next action without creating live inputs, writing events, or causing external effects.",
  },
  {
    step: "sample_gate_collection_sprint",
    command: "npm",
    args: ["run", "sample-gate:sprint"],
    external_effect: false,
    note: "Local P0 sample-gate collection sprint. It turns Day 3 / Day 7 due state and P0 count gaps into a timeboxed owner queue without creating live inputs, writing events, or executing external gates.",
  },
  {
    step: "owner_p0_launcher",
    command: "npm",
    args: ["run", "owner:p0-launcher"],
    external_effect: false,
    note: "Narrow local P0 sample-gate launcher. It opens only local P0 count files when the owner runs it and performs no network, write, deploy, post, LINE, GitHub, payment, customer-data, or delete action.",
  },
  {
    step: "owner_sample_count_recovery",
    command: "npm",
    args: ["run", "owner:sample-count-recovery"],
    external_effect: false,
    note: "Local sample-count recovery coordinator. It reads quick capture, focused intake, and owner data preflight status after aggregate counts are filled; it never stages, appends events, or performs external actions.",
  },
  {
    step: "owner_p0_postfill_check",
    command: "npm",
    args: ["run", "owner:p0-postfill-check"],
    external_effect: false,
    note: "Local post-fill check launcher. It generates one executable command that runs only whitelisted local npm scripts after owner P0 aggregate counts are filled; it never stages, applies, appends events, deploys, posts, pushes, or performs external actions.",
  },
  {
    step: "owner_sample_count_recovery_fixtures",
    command: "npm",
    args: ["run", "owner:sample-count-recovery:fixtures"],
    external_effect: false,
    note: "Fixture-only sample-count recovery guard. Uses temporary roots to verify waiting, quick-ready, intake-ready, preflight, sample-ready, win-review, and red-line violation states without project writes or external actions.",
  },
  {
    step: "owner_next_action_fixtures",
    command: "npm",
    args: ["run", "owner:next-action:fixtures"],
    external_effect: false,
    note: "Fixture-only owner next-action routing guard. Verifies staged local aggregate inputs advance to real-data preview and preview-ready inputs advance to owner apply review, using temporary roots only.",
  },
  {
    step: "owner_action_launcher",
    command: "npm",
    args: ["run", "owner:launcher"],
    external_effect: false,
    note: "Local owner action launcher only. Generated before bundle/archive so the same weekly run captures it; opening local files happens only when the owner runs the launcher.",
  },
  {
    step: "manual_conversion_preview",
    command: "npm",
    args: ["run", "import:manual:preview"],
    external_effect: false,
  },
  {
    step: "line_inbound_playbook",
    command: "npm",
    args: ["run", "line:playbook"],
    external_effect: false,
    note: "Local inbound-only LINE customer-service handoff. No LINE send, push, customer-data mutation, payment, or event write.",
  },
  {
    step: "manual_publish_packet",
    command: "npm",
    args: ["run", "manual:publish-packet"],
    external_effect: false,
    note: "Local draft-only publish packet. Prepares owner-reviewed copy, tracking URLs, and LINE inbound handoff without posting, scheduling, changing links, pushing LINE, deploying, or writing real events.",
  },
  {
    step: "manual_publish_capture_plan",
    command: "npm",
    args: ["run", "manual:capture-plan"],
    external_effect: false,
    note: "Local post-manual-publish capture plan. Maps each draft packet to Day 3 / Day 7 aggregate counts without posting, pushing LINE, changing links, deploying, or writing real events.",
  },
  {
    step: "manual_publish_brief",
    command: "npm",
    args: ["run", "manual:publish-brief"],
    external_effect: false,
    note: "Local Day 0 manual publish brief. Selects one reviewed packet and blocks formal posting until the owner approves a public tracking URL / Worker gate.",
  },
  {
    step: "public_tracking_url_pack",
    command: "npm",
    args: ["run", "public:tracking-pack"],
    external_effect: false,
    note: "Local public tracking URL handoff. Previews owner-approved URL shapes while blocking Worker deploy, public link activation, formal post, LINE push, and real event writes.",
  },
  {
    step: "owner_public_url_approval_preview",
    command: "npm",
    args: ["run", "owner:public-url-approval-preview"],
    external_effect: false,
    note: "Local owner approval checklist for public URL gates. It previews non-secret owner_approval_input fields without creating live input, deploying, changing links, posting, pushing LINE, or writing real events.",
  },
  {
    step: "manual_publish_evidence",
    command: "npm",
    args: ["run", "manual:publish-evidence"],
    external_effect: false,
    note: "Local owner-supplied manual-publish evidence intake. It calculates Day 3 / Day 7 checkpoints without posting, fetching URLs, pushing LINE, changing links, deploying, or writing real events.",
  },
  {
    step: "manual_publish_evidence_form",
    command: "npm",
    args: ["run", "manual:publish-evidence:form"],
    external_effect: false,
    note: "Local browser-only manual-publish evidence form. It only downloads JSON for owner review and performs no network call, post fetch, event write, LINE push, link change, deploy, or external action.",
  },
  {
    step: "manual_publish_evidence_form_fixtures",
    command: "npm",
    args: ["run", "manual:publish-evidence:form:fixtures"],
    external_effect: false,
    note: "Fixture-only manual-publish evidence form guard. Replays temporary browser-export JSON through local intake without creating live input, writing events, fetching URLs, or performing external actions.",
  },
  {
    step: "manual_publish_evidence_fixtures",
    command: "npm",
    args: ["run", "manual:publish-evidence:fixtures"],
    external_effect: false,
    note: "Fixture-only manual-publish evidence guard. Uses temporary inputs and performs no post, URL fetch, LINE push, deploy, public link change, event write, or external action.",
  },
  {
    step: "variable_rotation_fixtures",
    command: "npm",
    args: ["run", "variable:fixtures"],
    external_effect: false,
    note: "Fixture-only one-variable rotation guard for hook, offer, visual_claim, and cta_text. No live config write or external effect.",
  },
  {
    step: "deploy_candidate_worker",
    command: "npm",
    args: ["run", "worker:dry-run:status"],
    external_effect: false,
    note: "Dry run status only. Writes worker_dry_run.md and data/worker_dry_run_status.json; no production deploy.",
  },
  {
    step: "browser_route_smoke",
    command: "npm",
    args: ["run", "browser:smoke"],
    external_effect: false,
    note: "Local route smoke only. No event write, LINE click, public link change, or production deploy.",
  },
  {
    step: "tracking_link_smoke",
    command: "npm",
    args: ["run", "tracking:smoke"],
    external_effect: false,
    note: "Isolated local generated-link smoke only. It does not follow external URLs or write real events.",
  },
  {
    step: "event_contract_smoke",
    command: "npm",
    args: ["run", "event:smoke"],
    external_effect: false,
    note: "Isolated local event-write contract smoke only. No real event input or external effect.",
  },
  {
    step: "champion_integration_smoke",
    command: "npm",
    args: ["run", "champion:integration:smoke"],
    external_effect: false,
    note: "Runs the source-locked 3q-site candidate and collector together on random localhost ports with an isolated temporary D1. It never clicks LINE, deploys, pushes, changes public links, or writes real events.",
  },
  {
    step: "champion_local_branch_status",
    command: "npm",
    args: ["run", "champion:branch:status"],
    external_effect: false,
    note: "Read-only audit of the isolated local Champion feature commit. It never creates a branch, commits, pushes, opens a PR, deploys, or changes public links during weekly runs.",
  },
  {
    step: "champion_release_preflight",
    command: "npm",
    args: ["run", "champion:release:preflight"],
    external_effect: false,
    note: "Applies the locked patch in a clean archive or verified snapshot, proves byte identity, and dry-runs both config and production CLI shapes. It never edits the source repo, uploads, deploys, pushes, or changes public links.",
  },
  {
    step: "champion_github_handoff",
    command: "npm",
    args: ["run", "champion:github:handoff"],
    external_effect: false,
    note: "Generates the exact known-repository branch review and draft PR packet from the local Champion commit. It never pushes, opens a PR, merges, deploys, or changes public links.",
  },
  {
    step: "win_rule_fixtures",
    command: "npm",
    args: ["run", "win-rule:fixtures"],
    external_effect: false,
    note: "Fixture-only win-rule regression checks. No real event write or external effect.",
  },
  {
    step: "real_data_decision_replay",
    command: "npm",
    args: ["run", "decision:replay"],
    external_effect: false,
    note: "Fixture-only real-data decision replay. Imports aggregate CSV shapes into temporary JSONL, scores locally, and never writes data/lp_events.jsonl.",
  },
  {
    step: "launchagent_status_readback",
    command: "npm",
    args: ["run", "schedule:status"],
    external_effect: false,
    note: "Read-only macOS LaunchAgent readback before weekly artifacts are generated. It refreshes data/launchagent_status.json and never installs, uninstalls, deploys, posts, changes public links, pushes GitHub/LINE, mutates customer data, processes payments, or deletes data.",
  },
  {
    step: "generate_weekly_artifacts",
    command: "node",
    args: ["scripts/growth-loop.mjs", "--verify"],
    external_effect: false,
  },
  {
    step: "north_star_funnel",
    command: "npm",
    args: ["run", "north-star"],
    external_effect: false,
    note: "Local North Star funnel contract. Computes per-100-click LINE, lead, and deal metrics without writing real events or touching external services.",
  },
  {
    step: "candidate_retirement_fixtures",
    command: "npm",
    args: ["run", "retirement:fixtures"],
    external_effect: false,
    note: "Fixture-only candidate retirement contract. Tests keep-testing, owner-promotion-review, underperforming retirement, quality-regression retirement, and unknown candidate paths without deleting data.",
  },
  {
    step: "iteration_history",
    command: "npm",
    args: ["run", "history:iteration"],
    external_effect: false,
    note: "Local-only 7-day iteration history. Reads local artifacts and archive manifests; no external effect.",
  },
  {
    step: "schedule_catchup_status",
    command: "npm",
    args: ["run", "schedule:catchup"],
    external_effect: false,
    note: "Local read-only missed-run monitor for the weekly Sunday cadence. It never invokes weekly:local automatically.",
  },
  {
    step: "approval_resume_plan",
    command: "npm",
    args: ["run", "approval:plan"],
    external_effect: false,
    note: "Dry-run resume plan only. No remote D1, production deploy, GitHub push/PR, public link change, LINE, payment, customer-data, or delete action.",
  },
  {
    step: "owner_approval_form",
    command: "npm",
    args: ["run", "owner:approval-form"],
    external_effect: false,
    note: "Local browser-only owner approval metadata form. It downloads JSON only and never executes external gates.",
  },
  {
    step: "owner_approval_form_fixtures",
    command: "npm",
    args: ["run", "owner:approval-form:fixtures"],
    external_effect: false,
    note: "Fixture-only owner approval form guard. Uses temporary inputs and executes no external commands.",
  },
  {
    step: "owner_gate_evidence",
    command: "npm",
    args: ["run", "owner:evidence"],
    external_effect: false,
    note: "Evidence-only owner gate intake. Validates non-secret post-gate metadata and performs no remote D1, deploy, push/PR, public link change, LINE, payment, customer-data, or delete action.",
  },
  {
    step: "owner_gate_evidence_fixtures",
    command: "npm",
    args: ["run", "owner:evidence:fixtures"],
    external_effect: false,
    note: "Fixture-only owner gate evidence contract checks. Uses temporary inputs and executes no external commands.",
  },
  {
    step: "post_gate_verification",
    command: "npm",
    args: ["run", "post:verify"],
    external_effect: false,
    note: "Local-only post-gate verification plan. Performs no network read, remote CLI, deploy, push/PR, public link change, LINE, payment, customer-data, or delete action.",
  },
  {
    step: "post_gate_verification_fixtures",
    command: "npm",
    args: ["run", "post:verify:fixtures"],
    external_effect: false,
    note: "Fixture-only post-gate verification contract checks. Uses temporary owner evidence statuses and performs no network read, remote CLI, deploy, push/PR, public link change, LINE, payment, customer-data, or delete action.",
  },
  {
    step: "live_telemetry_readiness_after_evidence",
    command: "npm",
    args: ["run", "telemetry:readiness"],
    external_effect: false,
    note: "Re-evaluates the cached live telemetry observation after owner evidence and post-gate plans are refreshed. No network request, D1 table query, event POST, or external write.",
  },
  {
    step: "champion_release_preflight_after_evidence",
    command: "npm",
    args: ["run", "champion:release:preflight"],
    external_effect: false,
    note: "Rebuilds the Champion release packet after refreshed owner evidence is reflected in live telemetry. It performs dry runs only and never uploads, deploys, pushes, or changes public links.",
  },
  {
    step: "champion_github_handoff_after_evidence",
    command: "npm",
    args: ["run", "champion:github:handoff"],
    external_effect: false,
    note: "Rebuilds the local Draft PR handoff from the post-evidence release state. It never pushes, opens, edits, merges, or deploys a PR.",
  },
  {
    step: "generate_weekly_artifacts_after_evidence",
    command: "node",
    args: ["scripts/growth-loop.mjs", "--verify"],
    external_effect: false,
    note: "Regenerates owner-facing reports after evidence reconciliation so approval and release summaries do not retain stale gate state.",
  },
  {
    step: "gate_readiness_matrix",
    command: "npm",
    args: ["run", "gate:readiness"],
    external_effect: false,
    note: "Local owner-gate readiness matrix. It checks dependency order and keeps every external gate plan-only.",
  },
  {
    step: "redline_priority",
    command: "npm",
    args: ["run", "redline:priority"],
    external_effect: false,
    note: "Local-only prioritized operator queue for approval and PreparedButBlocked items. It never executes external gates.",
  },
  {
    step: "prepared_but_blocked_report",
    command: "npm",
    args: ["run", "blocked:report"],
    external_effect: false,
    note: "Local-only human-readable PreparedButBlocked handoff. It summarizes owner gates and executes no external action.",
  },
  {
    step: "approval_resume_fixtures",
    command: "npm",
    args: ["run", "approval:fixtures"],
    external_effect: false,
    note: "Fixture-only owner approval contract checks. Uses temporary inputs and executes no external commands.",
  },
  {
    step: "github_workflow_guard",
    command: "npm",
    args: ["run", "github:workflow-guard"],
    external_effect: false,
    note: "Local GitHub Actions workflow guard. It proves the scheduled GitHub verifier is review-only and avoids deploys, GitHub writes, secrets, LINE/payment actions, and macOS LaunchAgent readback.",
  },
  {
    step: "artifact_retention_monitor_pre_export",
    command: "npm",
    args: ["run", "artifacts:retention"],
    external_effect: false,
    note: "Pre-export local retention monitor so the repo-ready bundle includes the latest retention artifacts available before export. No cleanup is executed.",
  },
  {
    step: "artifact_retention_review_pre_export",
    command: "npm",
    args: ["run", "artifacts:retention-review"],
    external_effect: false,
    note: "Pre-export local retention review pack. It prioritizes owner-only cleanup review and generates no cleanup commands.",
  },
  {
    step: "github_export_bundle",
    command: "npm",
    args: ["run", "github:bundle"],
    external_effect: false,
    note: "Local copy-only GitHub repo-ready bundle. No git init, commit, push, PR, or external effect.",
  },
  {
    step: "artifact_retention_monitor",
    command: "npm",
    args: ["run", "artifacts:retention"],
    external_effect: false,
    note: "Local artifact retention monitor. It reports archive/log/export growth and owner-only cleanup candidates, but never deletes, moves, compresses, uploads, deploys, or changes external state.",
  },
  {
    step: "artifact_retention_review",
    command: "npm",
    args: ["run", "artifacts:retention-review"],
    external_effect: false,
    note: "Local artifact retention review pack. It converts cleanup candidates into an owner-only review queue without generating cleanup commands.",
  },
  {
    step: "objective_sequence_audit",
    command: "npm",
    args: ["run", "objective:audit"],
    external_effect: false,
    note: "Local objective-contract audit only. No external effect.",
  },
  {
    step: "archive_weekly_run",
    command: "npm",
    args: ["run", "archive:week"],
    external_effect: false,
    note: "Local immutable weekly evidence snapshot only. No external effect or deletion.",
  },
  {
    step: "owner_console",
    command: "npm",
    args: ["run", "owner:console"],
    external_effect: false,
    note: "Local owner review console only. No external effect.",
  },
  {
    step: "owner_action_launcher_refresh_after_console",
    command: "npm",
    args: ["run", "owner:launcher"],
    external_effect: false,
    note: "Refreshes the local owner action launcher after owner_console.html is regenerated. Opens local review files only when the owner runs the launcher.",
  },
  {
    step: "owner_console_refresh_after_launcher",
    command: "npm",
    args: ["run", "owner:console"],
    external_effect: false,
    note: "Local owner console refresh after launcher status is generated.",
  },
  {
    step: "owner_console_smoke",
    command: "npm",
    args: ["run", "owner:console:smoke"],
    external_effect: false,
    note: "Local HTML safety smoke only. No external effect.",
  },
];
const CORE_COMMANDS = COMMANDS.slice(0, 18);
const POST_STATUS_COMMANDS = COMMANDS.slice(18);
const FINAL_CONSOLE_REFRESH_COMMANDS = [
  {
    step: "final_schedule_catchup_status",
    command: "npm",
    args: ["run", "schedule:catchup"],
    external_effect: false,
    note: "Final read-only catch-up monitor after weekly_runner_status.json records the main command list as success.",
  },
  {
    step: "final_generate_weekly_artifacts",
    command: "node",
    args: ["scripts/growth-loop.mjs", "--verify"],
    external_effect: false,
    note: "Final local artifact refresh after weekly_runner_status.json and schedule catch-up status are current.",
  },
  {
    step: "final_approval_resume_plan",
    command: "npm",
    args: ["run", "approval:plan"],
    external_effect: false,
    note: "Final owner-gate plan refresh after the completed weekly status and current launch readiness are available.",
  },
  {
    step: "final_owner_approval_form",
    command: "npm",
    args: ["run", "owner:approval-form"],
    external_effect: false,
    note: "Final local approval metadata form refresh. It downloads local JSON only and performs no external action.",
  },
  {
    step: "final_gate_readiness",
    command: "npm",
    args: ["run", "gate:readiness"],
    external_effect: false,
    note: "Final gate matrix refresh after weekly_runner_status.json is success, preventing stale dry-run dependencies.",
  },
  {
    step: "final_redline_priority",
    command: "npm",
    args: ["run", "redline:priority"],
    external_effect: false,
    note: "Final red-line priority refresh after the completed gate matrix. No external action is executed.",
  },
  {
    step: "final_prepared_but_blocked_report",
    command: "npm",
    args: ["run", "blocked:report"],
    external_effect: false,
    note: "Final PreparedButBlocked handoff refresh after current gate and red-line evidence are available.",
  },
  {
    step: "final_artifact_retention_monitor",
    command: "npm",
    args: ["run", "artifacts:retention"],
    external_effect: false,
    note: "Final local retention monitor after the weekly command list and GitHub export bundle are current. No cleanup is executed.",
  },
  {
    step: "final_artifact_retention_review",
    command: "npm",
    args: ["run", "artifacts:retention-review"],
    external_effect: false,
    note: "Final local retention review pack after retention status is current. No cleanup command is generated or executed.",
  },
  {
    step: "final_objective_sequence_audit",
    command: "npm",
    args: ["run", "objective:audit"],
    external_effect: false,
    note: "Final objective audit refresh after schedule catch-up status is current.",
  },
  {
    step: "final_archive_weekly_run",
    command: "npm",
    args: ["run", "archive:week"],
    external_effect: false,
    note: "Final immutable local evidence archive after completed weekly and schedule catch-up statuses are current.",
  },
  {
    step: "final_owner_console_refresh",
    command: "npm",
    args: ["run", "owner:console"],
    external_effect: false,
    note: "Final local console refresh after weekly_runner_status.json records every command as success.",
  },
  {
    step: "final_owner_action_launcher",
    command: "npm",
    args: ["run", "owner:launcher"],
    external_effect: false,
    note: "Final local owner launcher refresh after the completed weekly status is available.",
  },
  {
    step: "final_owner_console_after_launcher",
    command: "npm",
    args: ["run", "owner:console"],
    external_effect: false,
    note: "Final local console refresh after launcher status is refreshed.",
  },
  {
    step: "final_owner_console_smoke",
    command: "npm",
    args: ["run", "owner:console:smoke"],
    external_effect: false,
    note: "Final local console smoke after the refreshed console reads the completed weekly status.",
  },
  {
    step: "final_verify_artifacts",
    command: "node",
    args: ["scripts/verify-artifacts.mjs"],
    external_effect: false,
    note: "Final artifact verification after console refresh. No external effect.",
  },
];

async function main() {
  const startedAt = new Date();
  const runLock = await acquireRunLock(startedAt);
  if (!runLock.acquired) {
    console.log(JSON.stringify({
      ok: true,
      status: "already_running",
      requested_at: startedAt.toISOString(),
      lock_path: RUN_LOCK_PATH,
      active_run: runLock.owner,
      authoritative_status_path: STATUS_PATH,
      external_effect: false,
      note: "Another weekly runner owns the atomic run lock. This invocation performed no commands and did not overwrite weekly_runner_status.json.",
    }, null, 2));
    return;
  }

  try {
    await mkdir(LOG_DIR, { recursive: true });
    await mkdir(path.dirname(STATUS_PATH), { recursive: true });
    const logPath = path.join(LOG_DIR, `weekly-runner-${stamp(startedAt)}.log`);
    const commandResults = [];

    await writeStatus({
      ok: false,
      status: "running",
      started_at: startedAt.toISOString(),
      log_path: logPath,
      external_effect: false,
      public_link_change_performed: false,
      production_deploy_performed: false,
      formal_post_performed: false,
      line_push_performed: false,
      customer_data_mutation_performed: false,
      payment_action_performed: false,
      delete_action_performed: false,
      commands: COMMANDS.map((command) => ({
        step: command.step,
        command: [command.command, ...command.args].join(" "),
        status: "pending",
        external_effect: false,
      })),
    });

    try {
      for (const command of CORE_COMMANDS) {
        const result = await runCommand(command, logPath);
        commandResults.push(result);
        await writeStatus(buildStatus("running", startedAt, logPath, commandResults));
      }

      await writeStatus(buildStatus("running", startedAt, logPath, commandResults));

      for (const command of POST_STATUS_COMMANDS) {
        const result = await runCommand(command, logPath);
        commandResults.push(result);
        await writeStatus(buildStatus("running", startedAt, logPath, commandResults));
      }

      const status = buildStatus("success", startedAt, logPath, commandResults);
      await writeStatus(status);
      for (const command of FINAL_CONSOLE_REFRESH_COMMANDS) {
        await runCommand(command, logPath);
      }
      await writeStatus(status);
      console.log(JSON.stringify(status, null, 2));
    } catch (error) {
      const failed = {
        ok: false,
        status: "failed",
        started_at: startedAt.toISOString(),
        finished_at: new Date().toISOString(),
        log_path: logPath,
        external_effect: false,
        public_link_change_performed: false,
        production_deploy_performed: false,
        formal_post_performed: false,
        line_push_performed: false,
        customer_data_mutation_performed: false,
        payment_action_performed: false,
        delete_action_performed: false,
        error: error instanceof Error ? error.message : "unknown_error",
        commands: commandResults,
        blocked_actions: hardRedLines(),
      };
      await writeStatus(failed);
      console.error(error);
      process.exitCode = 1;
    }
  } finally {
    await releaseRunLock(runLock);
  }
}

function buildStatus(status, startedAt, logPath, commandResults) {
  const finishedAt = new Date();
  const complete = commandResults.length === COMMANDS.length && commandResults.every((result) => result.status === "success");
  const ok = status === "success" && complete;
  return {
    ok,
    status: ok ? "success" : status === "success" ? "incomplete" : status,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.valueOf() - startedAt.valueOf(),
    timezone: "Asia/Taipei",
    cadence: "weekly_sunday",
    local_schedule: {
      weekday: "Sunday",
      hour: 0,
      minute: 10,
      timezone: "Asia/Taipei",
    },
    log_path: logPath,
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    commands: COMMANDS.map((command) => {
      const result = commandResults.find((item) => item.step === command.step);
      return result ?? {
        step: command.step,
        command: [command.command, ...command.args].join(" "),
        status: "pending",
        external_effect: false,
      };
    }),
    blocked_actions: hardRedLines(),
  };
}

function runCommand(command, logPath) {
  const startedAt = new Date();
  const commandText = [command.command, ...command.args].join(" ");
  return new Promise((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    appendLog(logPath, `\n## ${startedAt.toISOString()} ${command.step}\n$ ${commandText}\n`);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      appendLog(logPath, chunk);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      appendLog(logPath, chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const finishedAt = new Date();
      const result = {
        step: command.step,
        command: commandText,
        status: code === 0 ? "success" : "failed",
        exit_code: code,
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.valueOf() - startedAt.valueOf(),
        external_effect: false,
        note: command.note,
      };
      if (code === 0) {
        resolve(result);
        return;
      }
      reject(new Error(`${command.step} failed with exit code ${code}`));
    });
  });
}

function appendLog(logPath, text) {
  appendFileSync(logPath, text);
}

async function writeStatus(status) {
  const temporaryPath = `${STATUS_PATH}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(status, null, 2)}\n`);
  await rename(temporaryPath, STATUS_PATH);
}

async function acquireRunLock(startedAt) {
  const processIdentity = observeProcessIdentity(process.pid);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const token = randomUUID();
    try {
      await mkdir(RUN_LOCK_PATH, { mode: 0o700 });
      const owner = {
        format: "directory-v2",
        pid: process.pid,
        token,
        started_at: startedAt.toISOString(),
        root: ROOT,
        process_identity: processIdentity,
      };
      await writeFile(path.join(RUN_LOCK_PATH, RUN_LOCK_OWNER_NAME), `${JSON.stringify(owner)}\n`, { flag: "wx", mode: 0o600 });
      const snapshot = await readRunLockSnapshot();
      if (snapshot?.kind !== "directory" || snapshot.owner?.token !== token) {
        throw new Error("Weekly runner lock owner write could not be verified.");
      }
      return { acquired: true, token, owner, snapshot };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const snapshot = await readRunLockSnapshot();
      if (!snapshot) continue;
      const assessment = assessRunLockSnapshot(snapshot);
      if (!isRecoveryDecision(assessment.decision)) {
        return {
          acquired: false,
          token: null,
          owner: snapshot.owner ?? { status: assessment.decision },
          lock_status: assessment.decision,
        };
      }
      const recovery = snapshot.kind === "directory"
        ? await recoverDirectoryRunLock(snapshot, assessment.decision)
        : snapshot.kind === "legacy_file"
          ? await recoverLegacyRunLock(snapshot)
          : { status: "unsupported_lock_shape_fail_closed" };
      if (["recovered", "retry_lock_changed"].includes(recovery.status)) continue;
      return {
        acquired: false,
        token: null,
        owner: snapshot.owner ?? { status: recovery.status },
        lock_status: recovery.status,
      };
    }
  }
  throw new Error("Unable to acquire weekly runner lock after guarded recovery attempts.");
}

async function releaseRunLock(runLock) {
  if (!runLock?.acquired) return;
  const current = await readRunLockSnapshot();
  if (!sameLockSnapshot(runLock.snapshot, current) || current.owner?.pid !== process.pid) return;
  const claimToken = randomUUID();
  const claimed = await createDirectoryClaim(claimToken, "release");
  if (!claimed) return;
  const verified = await readRunLockSnapshot();
  if (!sameLockSnapshot(runLock.snapshot, verified)) {
    await releaseDirectoryClaim(RUN_LOCK_PATH, claimToken);
    return;
  }
  const quarantinePath = `${RUN_LOCK_PATH}.released.${claimToken}`;
  await rename(RUN_LOCK_PATH, quarantinePath);
  const moved = await readRunLockSnapshotAt(quarantinePath);
  if (!sameLockSnapshot(runLock.snapshot, moved)) {
    throw new Error(`Weekly runner release quarantined an unexpected lock at ${quarantinePath}; left intact.`);
  }
  await cleanupLockDirectory(quarantinePath, claimToken);
}

async function recoverDirectoryRunLock(expectedSnapshot, ownerDecision) {
  const claimToken = randomUUID();
  const claimed = await createDirectoryClaim(claimToken, "recover");
  if (!claimed) return { status: "recovery_claim_busy" };
  const claimedSnapshot = await readRunLockSnapshot();
  const decision = recoveryClaimDecision({ expectedSnapshot, claimedSnapshot, ownerDecision });
  if (decision !== "recover_claimed_owner") {
    await releaseDirectoryClaim(RUN_LOCK_PATH, claimToken);
    return { status: decision === "abort_lock_replaced" ? "retry_lock_changed" : decision };
  }
  const quarantinePath = `${RUN_LOCK_PATH}.recovered.${claimToken}`;
  await rename(RUN_LOCK_PATH, quarantinePath);
  const moved = await readRunLockSnapshotAt(quarantinePath);
  if (!sameLockSnapshot(expectedSnapshot, moved)) {
    throw new Error(`Weekly runner recovery quarantined an unexpected lock at ${quarantinePath}; left intact.`);
  }
  await cleanupLockDirectory(quarantinePath, claimToken);
  return { status: "recovered" };
}

async function recoverLegacyRunLock(expectedSnapshot) {
  const claimToken = randomUUID();
  let handle;
  try {
    handle = await open(LEGACY_RECOVERY_CLAIM_PATH, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify({ token: claimToken, pid: process.pid })}\n`);
    await handle.close();
    handle = null;
  } catch (error) {
    await handle?.close().catch(() => {});
    if (error?.code === "EEXIST") return { status: "legacy_recovery_claim_busy" };
    throw error;
  }
  try {
    const current = await readRunLockSnapshot();
    if (!sameLegacySnapshot(expectedSnapshot, current)) return { status: "retry_lock_changed" };
    const quarantinePath = `${RUN_LOCK_PATH}.legacy-recovered.${claimToken}`;
    await rename(RUN_LOCK_PATH, quarantinePath);
    const moved = await readRunLockSnapshotAt(quarantinePath);
    if (!sameLegacySnapshot(expectedSnapshot, moved)) {
      throw new Error(`Legacy lock recovery quarantined an unexpected lock at ${quarantinePath}; left intact.`);
    }
    await unlink(quarantinePath);
    return { status: "recovered" };
  } finally {
    await releaseLegacyRecoveryClaim(claimToken);
  }
}

async function createDirectoryClaim(token, purpose) {
  let handle;
  try {
    handle = await open(path.join(RUN_LOCK_PATH, RUN_LOCK_CLAIM_NAME), "wx", 0o600);
    await handle.writeFile(`${JSON.stringify({ token, pid: process.pid, purpose })}\n`);
    await handle.close();
    return true;
  } catch (error) {
    await handle?.close().catch(() => {});
    if (["EEXIST", "ENOENT", "ENOTDIR"].includes(error?.code)) return false;
    throw error;
  }
}

async function releaseDirectoryClaim(lockPath, token) {
  const claimPath = path.join(lockPath, RUN_LOCK_CLAIM_NAME);
  const claim = await readJsonOrNull(claimPath);
  if (claim?.token !== token) return;
  await unlink(claimPath).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
}

async function cleanupLockDirectory(lockPath, claimToken) {
  const entries = await readdir(lockPath);
  const unknown = entries.filter((entry) => ![RUN_LOCK_OWNER_NAME, RUN_LOCK_CLAIM_NAME].includes(entry));
  if (unknown.length > 0) {
    throw new Error(`Refusing to clean lock quarantine with unknown entries: ${unknown.join(", ")}`);
  }
  await releaseDirectoryClaim(lockPath, claimToken);
  await unlink(path.join(lockPath, RUN_LOCK_OWNER_NAME)).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
  await rmdir(lockPath);
}

async function readRunLockSnapshot() {
  return readRunLockSnapshotAt(RUN_LOCK_PATH);
}

async function readRunLockSnapshotAt(lockPath) {
  let info;
  try {
    info = await lstat(lockPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  const kind = info.isDirectory() ? "directory" : info.isFile() ? "legacy_file" : "unsupported";
  const ownerPath = kind === "directory" ? path.join(lockPath, RUN_LOCK_OWNER_NAME) : lockPath;
  return {
    kind,
    device: info.dev,
    inode: info.ino,
    lock_age_ms: Math.max(0, Date.now() - info.mtimeMs),
    owner: await readJsonOrNull(ownerPath),
  };
}

async function readJsonOrNull(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (["ENOENT", "EISDIR", "ENOTDIR", "EACCES"].includes(error?.code) || error instanceof SyntaxError) return null;
    throw error;
  }
}

function assessRunLockSnapshot(snapshot) {
  const ownerActive = Boolean(snapshot.owner && isProcessActive(snapshot.owner.pid));
  const observedIdentity = ownerActive ? observeProcessIdentity(snapshot.owner.pid) : null;
  const ownerIdentityStatus = compareProcessIdentity(snapshot.owner?.process_identity, observedIdentity, ownerActive);
  return {
    ownerActive,
    ownerIdentityStatus,
    decision: existingRunLockDecision({
      owner: snapshot.owner,
      ownerActive,
      ownerIdentityStatus,
      lockAgeMs: snapshot.lock_age_ms,
    }),
  };
}

function compareProcessIdentity(expected, observed, ownerActive) {
  if (!ownerActive) return "not_applicable";
  if (expected?.status !== "observed" || observed?.status !== "observed") return "unverified";
  return expected.process_start === observed.process_start
    && expected.command_sha256 === observed.command_sha256
    ? "match"
    : "mismatch";
}

function observeProcessIdentity(pid) {
  const processStartBefore = readPsField(pid, "lstart");
  const command = readPsField(pid, "command");
  const processStartAfter = readPsField(pid, "lstart");
  if (!processStartBefore || !command || processStartBefore !== processStartAfter) {
    return { status: "unavailable", source: "ps" };
  }
  return {
    status: "observed",
    source: "ps",
    process_start: processStartBefore,
    command_sha256: createHash("sha256").update(command).digest("hex"),
  };
}

function readPsField(pid, field) {
  const result = spawnSync("ps", ["-p", String(pid), "-o", `${field}=`], {
    encoding: "utf8",
    timeout: 2_000,
    maxBuffer: 64 * 1024,
  });
  if (result.error || result.status !== 0) return null;
  const value = result.stdout.trim().replace(/\s+/g, " ");
  return value || null;
}

function sameLegacySnapshot(expected, observed) {
  return expected?.kind === "legacy_file"
    && observed?.kind === "legacy_file"
    && expected.device === observed.device
    && expected.inode === observed.inode
    && (expected.owner?.token ?? null) === (observed.owner?.token ?? null);
}

function isRecoveryDecision(decision) {
  return ["recover_stale_or_dead_owner", "recover_pid_reused_owner"].includes(decision);
}

async function releaseLegacyRecoveryClaim(token) {
  const claim = await readJsonOrNull(LEGACY_RECOVERY_CLAIM_PATH);
  if (claim?.token !== token) return;
  await unlink(LEGACY_RECOVERY_CLAIM_PATH).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
}

function isProcessActive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function hardRedLines() {
  return [
    "formal_social_post",
    "change_primary_bio_link",
    "promote_challenger_to_champion",
    "line_broadcast_or_push",
    "ecpay_payment_or_refund",
    "customer_data_mutation",
    "production_deploy",
    "data_delete",
  ];
}

function stamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

main();
