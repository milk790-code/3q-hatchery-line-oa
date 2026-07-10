import { access, copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OPTIONS = parseArgs(process.argv.slice(2));
const STATUS_PATH = resolveProjectPath(OPTIONS.status, path.join(ROOT, "data", "owner_p1_outcome_intake_status.json"));
const JSON_PATH = resolveProjectPath(OPTIONS.json, path.join(ROOT, "owner_p1_outcome_intake.json"));
const REPORT_PATH = resolveProjectPath(OPTIONS.report, path.join(ROOT, "owner_p1_outcome_intake.md"));
const TARGET_PATH = resolveProjectPath(OPTIONS.target, path.join(ROOT, "data", "source_capture", "source_capture_ledger.filled.csv"));
const REAL_EVENTS_PATH = resolveProjectPath(OPTIONS.realEvents, path.join(ROOT, "data", "lp_events.jsonl"));
const PROJECT_INBOX_PATH = resolveProjectPath(
  OPTIONS.projectInbox,
  path.join(ROOT, "data", "source_capture", "inbox", "source_capture_ledger.filled.csv"),
);
const DOWNLOADS_PATH = resolveProjectPath(
  OPTIONS.downloads,
  path.join(os.homedir(), "Downloads", "source_capture_ledger.filled.csv"),
);

const RED_LINE_FALSE = {
  data_lp_events_write_performed: false,
  public_link_change_performed: false,
  production_deploy_performed: false,
  github_push_or_pr_performed: false,
  formal_post_performed: false,
  line_push_performed: false,
  customer_data_mutation_performed: false,
  payment_action_performed: false,
  delete_action_performed: false,
  external_effect: false,
};

async function main() {
  const generatedAt = new Date();
  const realEventsBefore = await countLines(REAL_EVENTS_PATH);
  const candidate = await selectCandidate();
  const status = candidate
    ? await inspectCandidate({ candidate, generatedAt, realEventsBefore })
    : await waitingStatus({ generatedAt, realEventsBefore });

  await writeJson(STATUS_PATH, compactStatus(status));
  await writeJson(JSON_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(compactStatus(status), null, 2));

  if (!status.ok || (OPTIONS.stage && !status.stage_performed)) {
    process.exitCode = 1;
  }
}

async function inspectCandidate({ candidate, generatedAt, realEventsBefore }) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "3q-p1-outcome-intake-"));
  const preflightJsonPath = path.join(tempDir, "north_star_outcome_preflight.json");
  const preflightStatusPath = path.join(tempDir, "north_star_outcome_preflight_status.json");
  const preflightReportPath = path.join(tempDir, "north_star_outcome_preflight.md");
  const compileStatusPath = path.join(tempDir, "source_capture_compile_status.json");
  const compileReportPath = path.join(tempDir, "source_capture_compile_report.md");
  const compileOutputDir = path.join(tempDir, "compiled");
  const tempRealEventsPath = path.join(tempDir, "lp_events.jsonl");
  const raw = await readFile(candidate.path);

  const preflightExecution = await runNode([
    "scripts/north-star-outcome-preflight.mjs",
    `--input=${candidate.path}`,
    "--input-kind=owner_p1_outcome_intake",
    `--json=${preflightJsonPath}`,
    `--status=${preflightStatusPath}`,
    `--report=${preflightReportPath}`,
    "--strict",
  ]);
  const compileExecution = await runNode([
    "scripts/source-capture-compile.mjs",
    `--input=${candidate.path}`,
    "--input-kind=owner_p1_outcome_intake",
    `--output-dir=${compileOutputDir}`,
    `--status=${compileStatusPath}`,
    `--report=${compileReportPath}`,
    `--real-events=${tempRealEventsPath}`,
  ]);

  const preflightJson = await readOptionalJson(preflightJsonPath);
  const preflightStatus = await readOptionalJson(preflightStatusPath);
  const compileStatus = await readOptionalJson(compileStatusPath);
  const candidateValid = preflightExecution.exitCode === 0
    && compileExecution.exitCode === 0
    && preflightStatus?.ok === true
    && preflightStatus?.ready_for_source_compile === true
    && compileStatus?.ok === true
    && (compileStatus.issue_count ?? 0) === 0
    && (compileStatus.filled_rows ?? 0) > 0
    && compileStatus.data_lp_events_write_performed === false;

  const stage = await maybeStage({ candidateValid, candidate });
  const realEventsAfter = await countLines(REAL_EVENTS_PATH);
  return {
    ok: candidateValid || !OPTIONS.stage,
    generated_at: generatedAt.toISOString(),
    mode: "owner_p1_outcome_intake",
    status: statusName({ candidateValid, stage }),
    candidate_found: true,
    candidate_valid: candidateValid,
    candidate_path: candidate.path,
    candidate_source: candidate.source,
    candidate_paths_checked: candidatePaths().map((item) => item.path),
    candidate_sha256: createHash("sha256").update(raw).digest("hex"),
    candidate_bytes: raw.length,
    target_path: TARGET_PATH,
    temp_dir: tempDir,
    preflight_exit_code: preflightExecution.exitCode,
    preflight_status: preflightStatus?.status ?? "missing",
    preflight_ok: preflightStatus?.ok === true,
    preflight_ready_for_source_compile: preflightStatus?.ready_for_source_compile === true,
    expected_outcome_row_count: preflightStatus?.expected_outcome_row_count ?? 0,
    filled_outcome_row_count: preflightStatus?.filled_outcome_row_count ?? 0,
    pending_outcome_row_count: preflightStatus?.pending_outcome_row_count ?? 0,
    partial_outcome_row_count: preflightStatus?.partial_outcome_row_count ?? 0,
    invalid_outcome_row_count: preflightStatus?.invalid_outcome_row_count ?? 0,
    preflight_issue_count: preflightStatus?.issue_count ?? 0,
    preflight_warning_count: preflightStatus?.warning_count ?? 0,
    preflight_issues: preflightJson?.issues ?? [],
    preflight_warnings: preflightJson?.warnings ?? [],
    counts_by_event_type: preflightStatus?.counts_by_event_type ?? {},
    ready_rows_by_event_type: preflightStatus?.ready_rows_by_event_type ?? {},
    compile_exit_code: compileExecution.exitCode,
    compile_status: compileStatus?.status ?? "missing",
    compile_ok: compileStatus?.ok === true,
    compile_issue_count: compileStatus?.issue_count ?? 0,
    compile_warning_count: compileStatus?.warning_count ?? 0,
    compile_filled_rows: compileStatus?.filled_rows ?? 0,
    compile_funnel_rows: compileStatus?.funnel_rows ?? 0,
    compile_manual_rows: compileStatus?.manual_rows ?? 0,
    compile_data_lp_events_write_performed: compileStatus?.data_lp_events_write_performed === true,
    stage_requested: OPTIONS.stage === true,
    confirm_owner_reviewed: OPTIONS.confirmOwnerReviewed === true,
    stage_performed: stage.performed,
    stage_blocked_reason: stage.blockedReason,
    live_input_files_created: stage.performed,
    real_events_before: realEventsBefore,
    real_events_after: realEventsAfter,
    real_events_unchanged: realEventsBefore === realEventsAfter,
    next_safe_action: nextSafeAction({ candidateValid, stage }),
    ...RED_LINE_FALSE,
    note: "Local P1 outcome owner-download intake. It validates aggregate-only source_capture_ledger.filled.csv downloads with the North Star outcome preflight and source compiler. Weekly runs never stage files or append data/lp_events.jsonl.",
  };
}

async function waitingStatus({ generatedAt, realEventsBefore }) {
  const realEventsAfter = await countLines(REAL_EVENTS_PATH);
  return {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "owner_p1_outcome_intake",
    status: "waiting_for_p1_outcome_download",
    candidate_found: false,
    candidate_valid: false,
    candidate_paths_checked: candidatePaths().map((item) => item.path),
    target_path: TARGET_PATH,
    preflight_status: "not_run",
    preflight_ready_for_source_compile: false,
    expected_outcome_row_count: 24,
    filled_outcome_row_count: 0,
    pending_outcome_row_count: 24,
    partial_outcome_row_count: 0,
    invalid_outcome_row_count: 0,
    preflight_issue_count: 0,
    preflight_warning_count: 0,
    counts_by_event_type: {},
    ready_rows_by_event_type: {},
    compile_status: "not_run",
    compile_ok: false,
    compile_issue_count: 0,
    compile_warning_count: 0,
    compile_filled_rows: 0,
    compile_funnel_rows: 0,
    compile_manual_rows: 0,
    compile_data_lp_events_write_performed: false,
    stage_requested: OPTIONS.stage === true,
    confirm_owner_reviewed: OPTIONS.confirmOwnerReviewed === true,
    stage_performed: false,
    stage_blocked_reason: null,
    live_input_files_created: false,
    real_events_before: realEventsBefore,
    real_events_after: realEventsAfter,
    real_events_unchanged: realEventsBefore === realEventsAfter,
    next_safe_action: "Download source_capture_ledger.filled.csv from north_star_outcome_form.html, place it in data/source_capture/inbox/, or rerun owner:p1-outcome-intake with --input=<path>.",
    ...RED_LINE_FALSE,
    note: "No owner-downloaded P1 outcome CSV was found. This is a safe waiting state.",
  };
}

async function maybeStage({ candidateValid, candidate }) {
  if (!OPTIONS.stage) return { performed: false, blockedReason: null };
  if (!candidateValid) return { performed: false, blockedReason: "candidate_validation_failed" };
  if (!OPTIONS.confirmOwnerReviewed) return { performed: false, blockedReason: "stage_requires_confirm_owner_reviewed" };
  await mkdir(path.dirname(TARGET_PATH), { recursive: true });
  await copyFile(candidate.path, TARGET_PATH);
  return { performed: true, blockedReason: null };
}

function statusName({ candidateValid, stage }) {
  if (!candidateValid) return "blocked_invalid_p1_outcome_download";
  if (stage.performed) return "p1_outcome_download_staged_for_source_compile";
  if (OPTIONS.stage && stage.blockedReason === "stage_requires_confirm_owner_reviewed") {
    return "p1_outcome_download_ready_needs_confirmed_stage";
  }
  return "p1_outcome_download_ready_for_review";
}

function nextSafeAction({ candidateValid, stage }) {
  if (!candidateValid) {
    return "Fix the downloaded P1 outcome CSV. Keep only aggregate counts, non-sensitive evidence refs, reviewer alias, and pii_checked=yes.";
  }
  if (stage.performed) {
    return "Run npm run north-star:outcome-preflight, then npm run owner:p1-outcome-postfill-check or ./RUN-P1-OUTCOME-POST-FILL-CHECK.command.";
  }
  if (OPTIONS.stage && stage.blockedReason === "stage_requires_confirm_owner_reviewed") {
    return "Review owner_p1_outcome_intake.md, then rerun with --stage --confirm-owner-reviewed.";
  }
  return "Review owner_p1_outcome_intake.md, then stage with npm run owner:p1-outcome-intake -- --input=<path> --stage --confirm-owner-reviewed.";
}

async function selectCandidate() {
  for (const candidate of candidatePaths()) {
    if (await exists(candidate.path)) return candidate;
  }
  return null;
}

function candidatePaths() {
  if (OPTIONS.input) return [{ path: resolveProjectPath(OPTIONS.input), source: "explicit_input" }];
  const candidates = [{ path: PROJECT_INBOX_PATH, source: "project_inbox" }];
  if (!OPTIONS.noDownloads) candidates.push({ path: DOWNLOADS_PATH, source: "downloads" });
  return candidates;
}

async function runNode(args) {
  try {
    const result = await execFileAsync(process.execPath, args, { cwd: ROOT, maxBuffer: 1024 * 1024 * 12 });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      exitCode: Number.isInteger(error.code) ? error.code : 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? String(error.message ?? error),
    };
  }
}

function compactStatus(status) {
  return {
    ok: status.ok,
    generated_at: status.generated_at,
    mode: status.mode,
    status: status.status,
    candidate_found: status.candidate_found,
    candidate_valid: status.candidate_valid,
    candidate_source: status.candidate_source ?? null,
    target_path: status.target_path,
    preflight_status: status.preflight_status,
    preflight_ready_for_source_compile: status.preflight_ready_for_source_compile,
    expected_outcome_row_count: status.expected_outcome_row_count,
    filled_outcome_row_count: status.filled_outcome_row_count,
    pending_outcome_row_count: status.pending_outcome_row_count,
    partial_outcome_row_count: status.partial_outcome_row_count,
    invalid_outcome_row_count: status.invalid_outcome_row_count,
    preflight_issue_count: status.preflight_issue_count,
    preflight_warning_count: status.preflight_warning_count,
    counts_by_event_type: status.counts_by_event_type,
    ready_rows_by_event_type: status.ready_rows_by_event_type,
    compile_status: status.compile_status,
    compile_ok: status.compile_ok,
    compile_filled_rows: status.compile_filled_rows,
    compile_funnel_rows: status.compile_funnel_rows,
    compile_manual_rows: status.compile_manual_rows,
    stage_requested: status.stage_requested,
    confirm_owner_reviewed: status.confirm_owner_reviewed,
    stage_performed: status.stage_performed,
    stage_blocked_reason: status.stage_blocked_reason,
    live_input_files_created: status.live_input_files_created,
    real_events_unchanged: status.real_events_unchanged,
    next_safe_action: status.next_safe_action,
    ...RED_LINE_FALSE,
  };
}

function renderReport(status) {
  return `# 3Q Growth Loop P1 Outcome Download Intake

BLUF: ${status.status}. ${status.next_safe_action}

- Generated: ${status.generated_at}
- Mode: ${status.mode}
- Candidate found: ${status.candidate_found ? "yes" : "no"}
- Candidate valid: ${status.candidate_valid ? "yes" : "no"}
- Candidate source: ${status.candidate_source ?? "n/a"}
- Candidate path: ${status.candidate_path ?? "n/a"}
- Target path: ${status.target_path}
- Stage requested: ${status.stage_requested ? "yes" : "no"}
- Stage performed: ${status.stage_performed ? "yes" : "no"}
- Stage blocked reason: ${status.stage_blocked_reason ?? "n/a"}
- data/lp_events.jsonl write performed: ${status.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${status.external_effect ? "yes" : "no"}

## Outcome Preflight

- Status: ${status.preflight_status}
- Ready for source compile: ${status.preflight_ready_for_source_compile ? "yes" : "no"}
- Filled outcome rows: ${status.filled_outcome_row_count}/${status.expected_outcome_row_count}
- Pending outcome rows: ${status.pending_outcome_row_count}
- Partial outcome rows: ${status.partial_outcome_row_count}
- Invalid outcome rows: ${status.invalid_outcome_row_count}
- Issues: ${status.preflight_issue_count}
- Warnings: ${status.preflight_warning_count}

## Compile Preview

- Status: ${status.compile_status}
- OK: ${status.compile_ok ? "yes" : "no"}
- Filled rows: ${status.compile_filled_rows}
- Funnel preview rows: ${status.compile_funnel_rows}
- Manual conversion preview rows: ${status.compile_manual_rows}
- data/lp_events.jsonl write performed by compiler: ${status.compile_data_lp_events_write_performed ? "yes" : "no"}

## Counts By Event Type

| event_type | aggregate count | ready rows |
|---|---:|---:|
${["link_click", "lead_submit", "deal", "quality_flag"].map((eventType) => `| ${eventType} | ${status.counts_by_event_type?.[eventType] ?? 0} | ${status.ready_rows_by_event_type?.[eventType] ?? 0} |`).join("\n")}

## Next Safe Action

${status.next_safe_action}

## Stage Command

\`\`\`zsh
npm run owner:p1-outcome-intake -- --input=<reviewed-csv-path> --stage --confirm-owner-reviewed
\`\`\`

## Safety

- This is local-only and aggregate-only.
- It does not append \`data/lp_events.jsonl\`.
- It does not post, change public links, deploy production, push GitHub, send LINE, mutate customer data, process payments, or delete data.
- Weekly runs do not pass \`--stage\`, so they cannot create the owner-filled working file.
`;
}

async function countLines(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw.split(/\r?\n/).filter((line) => line.trim()).length;
  } catch {
    return 0;
  }
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function resolveProjectPath(value, fallback = null) {
  if (!value) return fallback;
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function parseArgs(args) {
  const result = {};
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [rawKey, ...rest] = arg.slice(2).split("=");
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    result[key] = rest.length > 0 ? rest.join("=") : true;
  }
  return result;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
