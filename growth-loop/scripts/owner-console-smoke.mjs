import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const HTML_PATH = path.join(ROOT, "owner_console.html");
const STATUS_PATH = path.join(ROOT, "data", "owner_console_status.json");
const SMOKE_STATUS_PATH = path.join(ROOT, "data", "owner_console_smoke_status.json");

async function main() {
  const generatedAt = new Date();
  const html = await readFile(HTML_PATH, "utf8");
  const status = JSON.parse(await readFile(STATUS_PATH, "utf8"));

  const checks = [
    check("status_ok", status.ok === true, "owner console status must be ok"),
    check("html_non_empty", html.trim().length > 5000, "owner console HTML must be non-empty"),
    check("external_effect_false", html.includes('data-external-effect="false"'), "console must mark no external effect"),
    check("no_form", !/<form[\s>]/i.test(html), "console must not include forms"),
    check("no_fetch", !/\bfetch\s*\(/.test(html), "console must not call fetch"),
    check("no_send_beacon", !/sendBeacon|XMLHttpRequest/i.test(html), "console must not send beacons or XHR"),
    check("no_external_links", !/href=["']https?:\/\//i.test(html), "console must not link to external URLs"),
    check("has_approval_queue", html.includes("Approval Queue"), "console must include approval queue"),
    check("has_objective_contract", html.includes("Objective Contract"), "console must include objective contract audit"),
    check("has_goal_completion_status", html.includes("Goal complete") && html.includes("goal_completion_audit.md") && html.includes("data/goal_completion_audit_status.json"), "console must include goal completion audit status"),
    check("has_event_input_quality", html.includes("Event input quality"), "console must include event input quality status"),
    check("has_tracking_smoke", html.includes("Tracking smoke") && html.includes("tracking_link_smoke.md"), "console must include tracking link smoke status"),
    check("has_event_contract", html.includes("Event contract"), "console must include event contract status"),
    check("has_approval_fixtures", html.includes("Approval fixtures"), "console must include approval resume fixture status"),
    check("has_line_inbound", html.includes("LINE inbound"), "console must include LINE inbound playbook status"),
    check("has_manual_publish_packet", html.includes("Manual publish packet") && html.includes("manual_publish_packet.md"), "console must include draft-only manual publish packet"),
    check("has_manual_capture_plan", html.includes("Manual capture plan") && html.includes("manual_publish_capture_plan.md"), "console must include manual post-publish capture plan"),
    check("has_manual_publish_brief", html.includes("Manual publish brief") && html.includes("manual_publish_brief.md") && html.includes("manual_publish_brief.json"), "console must include Day 0 manual publish brief"),
    check("has_public_tracking_url_pack", html.includes("Public tracking URL pack") && html.includes("public_tracking_url_pack.md") && html.includes("public_tracking_url_pack.json"), "console must include public tracking URL approval pack"),
    check("has_owner_public_url_approval_preview", html.includes("Owner public URL approval preview") && html.includes("owner_public_url_approval_preview.md") && html.includes("owner_public_url_approval_preview.json"), "console must include owner public URL approval preview"),
    check("has_manual_publish_evidence", html.includes("Manual publish evidence") && html.includes("manual_publish_evidence.md"), "console must include manual-publish evidence intake"),
    check("has_manual_publish_evidence_form", html.includes("Manual publish evidence form") && html.includes("manual_publish_evidence_form.html"), "console must include manual-publish evidence browser form"),
    check("has_manual_publish_evidence_form_guard", html.includes("Manual publish evidence form guard") && html.includes("manual_publish_evidence_form_fixture_report.md"), "console must include manual-publish evidence form fixture guard"),
    check("has_manual_publish_evidence_guard", html.includes("Manual publish evidence guard") && html.includes("manual_publish_evidence_fixture_report.md"), "console must include manual-publish evidence fixture guard"),
    check("has_north_star", html.includes("North Star") && html.includes("north_star_funnel.md"), "console must include North Star funnel status"),
    check("has_funnel_breakdown", html.includes("Funnel breakdown") && html.includes("funnel_breakdown.md"), "console must include funnel breakdown status"),
    check("has_funnel_aggregate", html.includes("Funnel aggregate") && html.includes("data/funnel_aggregates.preview.jsonl"), "console must include full-funnel aggregate preview status"),
    check("has_funnel_guard", html.includes("Funnel guard") && html.includes("funnel_aggregate_fixture_report.md"), "console must include full-funnel aggregate fixture guard"),
    check("has_apply_guard", html.includes("Apply guard") && html.includes("real_data_apply_fixture_report.md"), "console must include real-data apply fixture guard"),
    check("has_input_pack", html.includes("Input pack") && html.includes("template-only"), "console must include real-data input pack status"),
    check("has_source_readiness", html.includes("Source readiness") && html.includes("source readiness"), "console must include source readiness status"),
    check("has_source_capture", html.includes("Source capture") && html.includes("source_capture_pack.md"), "console must include source capture pack status"),
    check("has_source_trust", html.includes("Source trust") && html.includes("trusted=") && html.includes("sample_gate="), "console must include source trust matrix status"),
    check("has_sample_gate_ledger", html.includes("Sample ledger") && html.includes("sample_gate_ledger.md"), "console must include sample gate ledger status"),
    check("has_sample_gate_replay", html.includes("Sample replay") && html.includes("sample_gate_replay_fixture_report.md"), "console must include sample gate replay fixture status"),
    check("has_source_compile", html.includes("Source compile") && html.includes("source_capture_compile_report.md"), "console must include source capture compile status"),
    check("has_compile_guard", html.includes("Compile guard") && html.includes("source_capture_compile_fixture_report.md"), "console must include source capture compile fixture guard"),
    check("has_data_queue", html.includes("Data queue") && html.includes("data_collection_brief.md") && html.includes("data_collection_queue.json"), "console must include data collection brief and queue"),
    check("has_data_progress", html.includes("Data progress") && html.includes("data_collection_progress.md"), "console must include data collection progress"),
    check("has_next_p0_inputs", html.includes("Next P0 inputs") && html.includes("next_p0_owner_inputs.md"), "console must include next P0 owner inputs"),
    check("has_next_p0_form", html.includes("Next P0 form") && html.includes("next_p0_owner_form.html"), "console must include focused Next P0 browser form"),
    check("has_next_p0_form_guard", html.includes("Next P0 form guard") && html.includes("next_p0_owner_form_fixture_report.md"), "console must include focused Next P0 form fixture guard"),
    check("has_next_p0_quick", html.includes("Next P0 quick") && html.includes("next_p0_quick_capture.md") && html.includes("data/next_p0_quick_capture/next_p0_owner_inputs.quick-template.csv") && html.includes("data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt"), "console must include focused Next P0 quick capture status"),
    check("has_next_p0_quick_progress", html.includes("filled=") && html.includes("missing=") && html.includes("partial="), "console must expose focused Next P0 quick fill progress"),
    check("has_next_p0_quick_guard", html.includes("Quick guard") && html.includes("next_p0_quick_capture_fixture_report.md"), "console must include focused Next P0 quick capture fixture guard"),
    check("has_p0_counts_preflight", html.includes("P0 counts preflight") && html.includes("p0_counts_preflight.md") && html.includes("p0_counts_preflight.json") && html.includes("data/p0_counts_preflight_status.json") && html.includes("ready="), "console must include P0 counts preflight status"),
    check("has_p0_counts_preflight_guard", html.includes("P0 preflight guard") && html.includes("p0_counts_preflight_fixture_report.md"), "console must include P0 counts preflight fixture guard"),
    check("has_next_p0_intake", html.includes("Next P0 intake") && html.includes("next_p0_owner_intake.md"), "console must include focused Next P0 owner-download intake"),
    check("has_next_p0_intake_guard", html.includes("Next P0 intake guard") && html.includes("next_p0_owner_intake_fixture_report.md"), "console must include focused Next P0 intake fixture guard"),
    check("has_owner_data_preflight", html.includes("Owner data preflight") && html.includes("owner_data_preflight.md") && html.includes("owner_data_preflight.json"), "console must include owner-preview data preflight"),
    check("has_sample_gate_capture_calendar", html.includes("Capture calendar") && html.includes("sample_gate_capture_calendar.md"), "console must include sample-gate capture calendar"),
    check("has_sample_gate_due_status", html.includes("Due status") && html.includes("sample_gate_due_status.md"), "console must include sample-gate due status"),
    check("has_sample_gate_due_guard", html.includes("Due guard") && html.includes("sample_gate_due_fixture_report.md"), "console must include sample-gate due fixture guard"),
    check("has_owner_capture", html.includes("Owner capture") && html.includes("week0_owner_capture_queue.md"), "console must include Week 0 owner capture queue"),
    check("has_owner_sample_gate", html.includes("Owner sample gate") && html.includes("owner_sample_gate_status.md"), "console must include owner sample-gate status"),
    check("has_sample_gate_owner_worksheet", html.includes("Sample worksheet") && html.includes("sample_gate_owner_worksheet.md"), "console must include owner sample-gate worksheet"),
    check("has_sample_gate_owner_form", html.includes("Sample form") && html.includes("sample_gate_owner_form.html"), "console must include owner sample-gate browser form"),
    check("has_sample_gate_owner_form_guard", html.includes("Sample form guard") && html.includes("sample_gate_owner_form_fixture_report.md"), "console must include owner sample-gate browser form fixture guard"),
    check("has_sample_gate_intake", html.includes("Sample intake") && html.includes("owner_sample_gate_intake.md"), "console must include owner sample-gate download intake status"),
    check("has_sample_gate_intake_guard", html.includes("Intake guard") && html.includes("owner_sample_gate_intake_fixture_report.md"), "console must include owner sample-gate download intake fixture guard"),
    check("has_owner_next_action", html.includes("Next action") && html.includes("owner_next_action.md") && html.includes("trust=") && html.includes("trusted=") && html.includes("sample_gate=") && html.includes("scoring="), "console must include owner next-action card with source trust state"),
    check("has_north_star_outcome_preflight", html.includes("Outcome preflight") && html.includes("north_star_outcome_preflight.md") && html.includes("ready_compile="), "console must include North Star outcome preflight status"),
    check("has_north_star_outcome_form", html.includes("Outcome form") && html.includes("north_star_outcome_form.html") && html.includes("browser_only="), "console must include North Star outcome browser form"),
    check("has_north_star_outcome_form_guard", html.includes("Outcome form guard") && html.includes("north_star_outcome_form_fixture_report.md"), "console must include North Star outcome browser form fixture guard"),
    check("has_p1_outcome_intake", html.includes("P1 outcome intake") && html.includes("owner_p1_outcome_intake.md") && html.includes("owner_p1_outcome_intake.json") && html.includes("candidate=") && html.includes("staged="), "console must include owner P1 outcome download intake"),
    check("has_p1_outcome_intake_guard", html.includes("P1 intake guard") && html.includes("owner_p1_outcome_intake_fixture_report.md"), "console must include owner P1 outcome intake fixture guard"),
    check("has_p1_outcome_postfill_check", html.includes("P1 outcome post-fill") && html.includes("owner_p1_outcome_postfill_check.md") && html.includes("owner_p1_outcome_postfill_check.json") && html.includes("RUN-P1-OUTCOME-POST-FILL-CHECK.command"), "console must include owner P1 outcome post-fill local check"),
    check("has_p1_outcome_postfill_source_trust", html.includes("P1 outcome post-fill") && html.includes("trust=") && html.includes("trusted=") && html.includes("scoring="), "console must include source trust state inside owner P1 outcome post-fill local check"),
    check("has_sample_gate_recovery", html.includes("Recovery pack") && html.includes("sample_gate_recovery_pack.md") && html.includes("sample_gate_recovery_pack.json"), "console must include sample-gate recovery pack"),
    check("has_sample_gate_batch_handoff", html.includes("P0 batch handoff") && html.includes("sample_gate_batch_handoff.md") && html.includes("sample_gate_batch_1_paste_block.txt") && html.includes("sample_gate_batch_2_paste_block.txt"), "console must include full P0 sample-gate batch handoff"),
    check("has_sample_gate_batch_preflight", html.includes("P0 batch preflight") && html.includes("sample_gate_batch_preflight.md") && html.includes("ready_compile="), "console must include full P0 batch preflight status"),
    check("has_sample_count_handoff", html.includes("Count handoff") && html.includes("owner_sample_count_handoff.md") && html.includes("owner_sample_count_paste_block.txt") && html.includes("owner_sample_count_handoff.json"), "console must include owner sample-count handoff"),
    check("has_owner_p0_now", html.includes("P0 now") && html.includes("owner_p0_now.html") && html.includes("owner_p0_now.md") && html.includes("owner_p0_now.json") && html.includes("data/owner_p0_now_status.json") && html.includes("focused=") && html.includes("quick_missing="), "console must include owner P0-now action card"),
    check("has_sample_gate_collection_sprint", html.includes("Collection sprint") && html.includes("pending=") && html.includes("open_targets="), "console must include sample-gate collection sprint status"),
    check("has_owner_p0_launcher", html.includes("P0 launcher") && html.includes("owner_p0_launcher.md") && html.includes("OPEN-P0-SAMPLE-GATE.command") && html.includes("local_only="), "console must include P0-only local launcher"),
    check("has_sample_count_recovery", html.includes("Count recovery") && html.includes("owner_sample_count_recovery.md") && html.includes("owner_sample_count_recovery.json"), "console must include owner sample-count recovery status"),
    check("has_p0_postfill_check", html.includes("P0 post-fill check") && html.includes("owner_p0_postfill_check.md") && html.includes("owner_p0_postfill_check.json") && html.includes("RUN-P0-POST-FILL-CHECK.command"), "console must include owner P0 post-fill local check"),
    check("has_p0_postfill_source_trust", html.includes("P0 post-fill check") && html.includes("trust=") && html.includes("trusted=") && html.includes("sample_gate=") && html.includes("scoring="), "console must include source trust state inside owner P0 post-fill local check"),
    check("has_worker_dry_run", html.includes("Worker dry run") && html.includes("worker_dry_run.md") && status.source_status.some((source) => source.file === "data/worker_dry_run_status.json" && source.ok === true), "console must include candidate Worker dry-run proof"),
    check("has_cloudflare_d1_readiness", html.includes("D1 readiness") && html.includes("cloudflare_d1_readiness.md") && status.source_status.some((source) => source.file === "data/cloudflare_d1_readiness_status.json" && source.ok === true), "console must include metadata-only D1 readiness"),
    check("has_live_telemetry_readiness", html.includes("Live telemetry chain") && html.includes("live_telemetry_readiness.md") && status.source_status.some((source) => source.file === "data/live_telemetry_readiness_status.json" && source.ok === true), "console must include read-only live telemetry chain readiness"),
    check("has_live_telemetry_guard", html.includes("Live telemetry guard") && html.includes("live_telemetry_readiness_fixture_report.md") && status.source_status.some((source) => source.file === "data/live_telemetry_readiness_fixture_status.json" && source.ok === true), "console must include live telemetry readiness fixtures"),
    check("has_d1_schema_contract", html.includes("D1 schema contract") && html.includes("d1_schema_contract.md") && status.source_status.some((source) => source.file === "data/d1_schema_contract_status.json" && source.ok === true), "console must include local D1 idempotency contract"),
    check("has_approved_d1_config_guard", html.includes("D1 config guard") && html.includes("approved_d1_config.md") && status.source_status.some((source) => source.file === "data/approved_d1_config_status.json" && source.ok === true), "console must include preview-only approved D1 config guard"),
    check("has_d1_collection_mode", html.includes("D1 auto collection") && html.includes("d1_collection_mode.md") && status.source_status.some((source) => source.file === "data/d1_collection_mode_status.json" && source.ok === true), "console must include owner-evidence-driven D1 collection mode"),
    check("has_d1_collection_guards", html.includes("D1 selector guard") && html.includes("D1 aggregate guard") && html.includes("d1_collection_mode_fixture_report.md") && html.includes("d1_aggregate_export_fixture_report.md"), "console must include D1 selector and aggregate-only fixture guards"),
    check("has_champion_local_commit", html.includes("Champion local commit") && html.includes("champion_local_branch.md") && status.source_status.some((source) => source.file === "data/champion_local_branch_status.json" && source.ok === true), "console must include the isolated local Champion commit"),
    check("has_champion_release", html.includes("Champion release") && html.includes("champion_release_preflight.md") && html.includes("champion_release_owner_packet.md") && status.source_status.some((source) => source.file === "data/champion_release_preflight_status.json" && source.ok === true), "console must include Champion release readiness"),
    check("has_champion_github_handoff", html.includes("Champion GitHub") && html.includes("champion_github_handoff.md") && html.includes("champion_github_pr_body.md") && status.source_status.some((source) => source.file === "data/champion_github_handoff_status.json" && source.ok === true), "console must include exact owner-gated Champion GitHub handoff"),
    check("has_sample_count_recovery_guard", html.includes("Count recovery guard") && html.includes("owner_sample_count_recovery_fixture_report.md"), "console must include owner sample-count recovery fixture guard"),
    check("has_owner_launcher", html.includes("Owner launcher") && html.includes("owner_action_launcher.md") && html.includes("trust=") && html.includes("trusted=") && html.includes("sample_gate=") && html.includes("scoring="), "console must include owner action launcher report with source trust state"),
    check("has_open_command", html.includes("Open command") && html.includes("OPEN-3Q-GROWTH-LOOP.command"), "console must include local open command"),
    check("has_owner_sample_gate_guard", html.includes("Sample gate guard") && html.includes("owner_sample_gate_fixture_report.md"), "console must include owner sample-gate fixture guard"),
    check("has_owner_quality_review", html.includes("Quality review") && html.includes("owner_quality_review.md"), "console must include owner quality-review status"),
    check("has_owner_quality_form", html.includes("Quality form") && html.includes("owner_quality_review_form.html"), "console must include owner quality-review browser form"),
    check("has_owner_quality_form_guard", html.includes("Quality form guard") && html.includes("owner_quality_review_form_fixture_report.md"), "console must include owner quality-review browser form fixture guard"),
    check("has_owner_quality_guard", html.includes("Quality guard") && html.includes("owner_quality_review_fixture_report.md"), "console must include owner quality-review fixture guard"),
    check("has_retirement_guard", html.includes("Retirement guard") && html.includes("candidate_retirement_fixture_report.md"), "console must include candidate retirement fixture guard"),
    check("has_gate_readiness", html.includes("Gate readiness") && html.includes("gate_readiness.md"), "console must include owner gate readiness matrix"),
    check("has_redline_priority", html.includes("Red-line priority") && html.includes("redline_priority.md") && html.includes("redline_priority.json"), "console must include red-line priority queue"),
    check("has_prepared_but_blocked_report", html.includes("PreparedButBlocked handoff") && html.includes("prepared_but_blocked.md") && html.includes("data/prepared_but_blocked_report_status.json"), "console must include PreparedButBlocked handoff"),
    check("has_gate_metadata", html.includes("Gate metadata") && html.includes("Public A/B metadata") && html.includes("public_ab_small_traffic_link") && html.includes("champion_url"), "console must include plan-only gate metadata capture status"),
    check("has_gate_evidence", html.includes("Gate evidence") && html.includes("owner_gate_evidence.md"), "console must include owner gate evidence intake"),
    check("has_evidence_guard", html.includes("Evidence guard") && html.includes("owner_gate_evidence_fixture_report.md"), "console must include owner gate evidence fixture guard"),
    check("has_post_gate_verify", html.includes("Post-gate verify") && html.includes("post_gate_verification.md"), "console must include post-gate verification plan"),
    check("has_post_gate_guard", html.includes("Post-gate guard") && html.includes("post_gate_verification_fixture_report.md"), "console must include post-gate verification fixture guard"),
    check("has_github_workflow_guard", html.includes("GitHub workflow guard") && html.includes("github_workflow_guard.md") && html.includes("github_workflow_guard.json"), "console must include GitHub workflow guard status"),
    check("has_github_bundle", html.includes("GitHub bundle") && html.includes("github_export_manifest.md"), "console must include GitHub export bundle status"),
    check("has_artifact_retention", html.includes("Artifact retention") && html.includes("artifact_retention.md") && html.includes("data/artifact_retention_status.json"), "console must include artifact retention monitor status"),
    check("has_artifact_retention_review", html.includes("Retention review") && html.includes("artifact_retention_review_pack.md") && html.includes("data/artifact_retention_review_status.json"), "console must include artifact retention review pack status"),
    check("has_intake_plan", html.includes("Intake plan") && html.includes("real_data_intake_plan.md"), "console must include real-data intake plan status"),
    check("has_iteration_history", html.includes("Iteration History") && html.includes("iteration_history.md"), "console must include iteration history status"),
    check("has_next_round", html.includes("Next Round"), "console must include next-round plan"),
    check("has_archive", html.includes("Archive"), "console must include archive status"),
    check("has_schedule_status", html.includes("Schedule status") && html.includes("Weekly schedule") && html.includes("data/schedule_status.json"), "console must include local weekly schedule status"),
    check("has_schedule_catchup_status", html.includes("Catch-up status") && html.includes("schedule_catchup_status.md") && html.includes("data/schedule_catchup_status.json"), "console must include missed-run catch-up status"),
    check("has_launchagent_status", html.includes("LaunchAgent status") && html.includes("data/launchagent_status.json") && html.includes("launchd/com.angelia.3q-growth-loop.weekly.plist"), "console must include macOS LaunchAgent status"),
    check("has_launchagent_runtime_proof", (html.includes("successful_run=yes") || html.includes("current_launchd_invocation=yes")) && html.includes("runs=") && html.includes("last_exit=") && html.includes("proof="), "console must include completed or current pending-exit LaunchAgent runtime proof"),
    check("has_red_lines", html.includes("Hard Red Lines"), "console must include red lines"),
    check("has_weekly_report_link", html.includes("weekly_report.md"), "console must link weekly report"),
    check("has_owner_pack_link", html.includes("owner_approval_pack.md"), "console must link owner approval pack"),
    check("has_owner_approval_form", html.includes("Approval form") && html.includes("owner_approval_form.html"), "console must include owner approval browser form"),
    check("has_owner_approval_form_guard", html.includes("Approval form guard") && html.includes("owner_approval_form_fixture_report.md"), "console must include owner approval form fixture guard"),
    check("runner_no_external_effect", status.external_effect === false, "status must not claim external effects"),
    check("no_production_deploy", status.production_deploy_performed === false, "status must not claim production deploy"),
    check("no_public_link_change", status.public_link_change_performed === false, "status must not claim public link changes"),
    check("no_formal_post", status.formal_post_performed === false, "status must not claim formal post"),
    check("no_line_push", status.line_push_performed === false, "status must not claim LINE push"),
    check("no_customer_data_mutation", status.customer_data_mutation_performed === false, "status must not mutate customer data"),
    check("no_payment", status.payment_action_performed === false, "status must not touch payments"),
    check("no_delete", status.delete_action_performed === false, "status must not delete data"),
  ];

  const ok = checks.every((item) => item.ok);
  const smokeStatus = {
    ok,
    generated_at: generatedAt.toISOString(),
    html_path: HTML_PATH,
    status_path: STATUS_PATH,
    checks,
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };

  await writeJson(SMOKE_STATUS_PATH, smokeStatus);
  console.log(JSON.stringify(smokeStatus, null, 2));

  if (!ok) {
    process.exitCode = 1;
  }
}

function check(name, ok, message) {
  return { name, ok, message, external_effect: false };
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main();
