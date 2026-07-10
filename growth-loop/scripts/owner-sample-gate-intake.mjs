import { access, copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OPTIONS = parseArgs(process.argv.slice(2));
const STATUS_PATH = resolveProjectPath(OPTIONS.status, path.join(ROOT, "data", "owner_sample_gate_intake_status.json"));
const REPORT_PATH = resolveProjectPath(OPTIONS.report, path.join(ROOT, "owner_sample_gate_intake.md"));
const TARGET_PATH = resolveProjectPath(OPTIONS.target, path.join(ROOT, "data", "source_capture", "sample_gate_ledger.filled.csv"));
const REAL_EVENTS_PATH = resolveProjectPath(OPTIONS.realEvents, path.join(ROOT, "data", "lp_events.jsonl"));
const PROJECT_INBOX_PATH = path.join(ROOT, "data", "source_capture", "inbox", "sample_gate_ledger.filled.csv");
const DOWNLOADS_PATH = path.join(os.homedir(), "Downloads", "sample_gate_ledger.filled.csv");

async function main() {
  const generatedAt = new Date();
  const realEventsBefore = await countLines(REAL_EVENTS_PATH);
  const candidate = await selectCandidate();
  let status;

  if (!candidate) {
    status = buildWaitingStatus(generatedAt, realEventsBefore, await countLines(REAL_EVENTS_PATH));
  } else {
    status = await inspectCandidate(candidate, generatedAt, realEventsBefore);
  }

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (OPTIONS.stage && !status.stage_performed) {
    process.exitCode = 1;
  }
}

async function inspectCandidate(candidate, generatedAt, realEventsBefore) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "3q-owner-sample-intake-"));
  const compileStatusPath = path.join(tempDir, "compile_status.json");
  const compileReportPath = path.join(tempDir, "compile_report.md");
  const compileOutputDir = path.join(tempDir, "compiled");
  const ownerStatusPath = path.join(tempDir, "owner_status.compact.json");
  const ownerJsonPath = path.join(tempDir, "owner_status.json");
  const ownerReportPath = path.join(tempDir, "owner_report.md");
  const tempRealEventsPath = path.join(tempDir, "lp_events.jsonl");

  const raw = await readFile(candidate.path);
  const compileExecution = await runNode([
    "scripts/source-capture-compile.mjs",
    `--input=${candidate.path}`,
    "--input-kind=owner_sample_gate_intake",
    `--output-dir=${compileOutputDir}`,
    `--status=${compileStatusPath}`,
    `--report=${compileReportPath}`,
    `--real-events=${tempRealEventsPath}`,
  ]);
  const ownerExecution = await runNode([
    "scripts/owner-sample-gate-status.mjs",
    `--input=${candidate.path}`,
    `--status=${ownerStatusPath}`,
    `--json=${ownerJsonPath}`,
    `--report=${ownerReportPath}`,
    `--real-events=${tempRealEventsPath}`,
  ]);

  const compileStatus = await readOptionalJson(compileStatusPath);
  const ownerStatus = await readOptionalJson(ownerStatusPath);
  const candidateValid = compileExecution.exitCode === 0
    && ownerExecution.exitCode === 0
    && compileStatus?.ok === true
    && ownerStatus?.ok === true
    && (compileStatus.issue_count ?? 0) === 0
    && (ownerStatus.issue_count ?? 0) === 0;

  let stagePerformed = false;
  let stageBlockedReason = null;
  let statusName = candidateValid ? "owner_download_ready_for_review" : "blocked_invalid_owner_download";

  if (OPTIONS.stage) {
    if (!candidateValid) {
      statusName = "blocked_invalid_owner_download";
      stageBlockedReason = "candidate_validation_failed";
    } else if (!OPTIONS.confirmOwnerReviewed) {
      statusName = "owner_download_ready_needs_confirmed_stage";
      stageBlockedReason = "stage_requires_confirm_owner_reviewed";
    } else {
      await mkdir(path.dirname(TARGET_PATH), { recursive: true });
      await copyFile(candidate.path, TARGET_PATH);
      stagePerformed = true;
      statusName = "owner_download_staged_for_sample_gate";
    }
  }

  const realEventsAfter = await countLines(REAL_EVENTS_PATH);
  return {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "owner_sample_gate_intake",
    status: statusName,
    candidate_found: true,
    candidate_valid: candidateValid,
    candidate_path: candidate.path,
    candidate_source: candidate.source,
    candidate_sha256: createHash("sha256").update(raw).digest("hex"),
    candidate_bytes: raw.length,
    target_path: TARGET_PATH,
    temp_dir: tempDir,
    compile_exit_code: compileExecution.exitCode,
    compile_status: compileStatus?.status ?? "missing",
    compile_ok: compileStatus?.ok === true,
    compile_issue_count: compileStatus?.issue_count ?? 0,
    compile_filled_rows: compileStatus?.filled_rows ?? 0,
    compile_data_lp_events_write_performed: compileStatus?.data_lp_events_write_performed === true,
    owner_exit_code: ownerExecution.exitCode,
    owner_status: ownerStatus?.status ?? "missing",
    owner_ok: ownerStatus?.ok === true,
    owner_issue_count: ownerStatus?.issue_count ?? 0,
    filled_rows: ownerStatus?.filled_rows ?? 0,
    pending_rows: ownerStatus?.pending_rows ?? 0,
    sample_threshold_met: ownerStatus?.sample_threshold_met === true,
    sample_rate_win_candidate: ownerStatus?.sample_rate_win_candidate === true,
    owner_review_required: ownerStatus?.owner_review_required === true,
    promotion_performed: ownerStatus?.promotion_performed === true,
    stage_requested: OPTIONS.stage === true,
    confirm_owner_reviewed: OPTIONS.confirmOwnerReviewed === true,
    stage_performed: stagePerformed,
    stage_blocked_reason: stageBlockedReason,
    live_input_files_created: stagePerformed,
    real_events_before: realEventsBefore,
    real_events_after: realEventsAfter,
    real_events_unchanged: realEventsBefore === realEventsAfter,
    data_lp_events_write_performed: false,
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    next_safe_action: nextSafeAction(statusName),
    note: "Local owner-download intake guard. It validates aggregate-only sample-gate CSV downloads through existing compile and owner sample-gate checks. Weekly runs do not stage files automatically.",
  };
}

function buildWaitingStatus(generatedAt, realEventsBefore, realEventsAfter) {
  return {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "owner_sample_gate_intake",
    status: "waiting_for_owner_download",
    candidate_found: false,
    candidate_valid: false,
    candidate_paths_checked: candidatePaths().map((candidatePath) => candidatePath.path),
    target_path: TARGET_PATH,
    stage_requested: OPTIONS.stage === true,
    confirm_owner_reviewed: OPTIONS.confirmOwnerReviewed === true,
    stage_performed: false,
    live_input_files_created: false,
    real_events_before: realEventsBefore,
    real_events_after: realEventsAfter,
    real_events_unchanged: realEventsBefore === realEventsAfter,
    data_lp_events_write_performed: false,
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    next_safe_action: "Download sample_gate_ledger.filled.csv from sample_gate_owner_form.html, then place it in data/source_capture/inbox/ or run owner:intake with --input.",
    note: "No owner-downloaded sample gate CSV was found. This is a safe waiting state.",
  };
}

async function selectCandidate() {
  for (const candidate of candidatePaths()) {
    if (await exists(candidate.path)) {
      return candidate;
    }
  }
  return null;
}

function candidatePaths() {
  if (OPTIONS.input) {
    return [{ path: resolveProjectPath(OPTIONS.input), source: "explicit_input" }];
  }
  const candidates = [{ path: PROJECT_INBOX_PATH, source: "project_inbox" }];
  if (!OPTIONS.noDownloads) {
    candidates.push({ path: DOWNLOADS_PATH, source: "downloads" });
  }
  return candidates;
}

function nextSafeAction(statusName) {
  if (statusName === "owner_download_ready_for_review") {
    return "Review owner_sample_gate_intake.md, then stage with npm run owner:intake -- --input=<path> --stage --confirm-owner-reviewed.";
  }
  if (statusName === "owner_download_ready_needs_confirmed_stage") {
    return "Re-run the same command with --confirm-owner-reviewed after reviewing the aggregate CSV.";
  }
  if (statusName === "owner_download_staged_for_sample_gate") {
    return "Run npm run source:compile -- --input=data/source_capture/sample_gate_ledger.filled.csv --input-kind=sample_gate_filled, then npm run owner:sample-gate.";
  }
  if (statusName === "blocked_invalid_owner_download") {
    return "Fix the downloaded CSV. Keep only aggregate counts, non-sensitive evidence refs, reviewer alias, and pii_checked=yes.";
  }
  return "Download sample_gate_ledger.filled.csv from sample_gate_owner_form.html and rerun owner:intake.";
}

async function runNode(args) {
  try {
    const result = await execFileAsync(process.execPath, args, { cwd: ROOT, maxBuffer: 1024 * 1024 * 8 });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      exitCode: Number.isInteger(error.code) ? error.code : 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? String(error.message ?? error),
    };
  }
}

function renderReport(status) {
  return `# Owner Sample Gate Intake

BLUF: ${status.status}. This guard validates an owner-downloaded aggregate sample-gate CSV before it can become the local sample-gate working file.

- Generated: ${status.generated_at}
- Candidate found: ${status.candidate_found ? "yes" : "no"}
- Candidate valid: ${status.candidate_valid ? "yes" : "no"}
- Candidate source: ${status.candidate_source ?? "n/a"}
- Filled rows: ${status.filled_rows ?? 0}
- Pending rows: ${status.pending_rows ?? "n/a"}
- Sample threshold met: ${status.sample_threshold_met ? "yes" : "no"}
- Sample-rate win candidate: ${status.sample_rate_win_candidate ? "yes" : "no"}
- Stage requested: ${status.stage_requested ? "yes" : "no"}
- Stage performed: ${status.stage_performed ? "yes" : "no"}
- Target path: ${status.target_path}
- data/lp_events.jsonl write performed: ${status.data_lp_events_write_performed ? "yes" : "no"}
- External effect: ${status.external_effect ? "yes" : "no"}

## Validation

- Compile status: ${status.compile_status ?? "n/a"}
- Compile issues: ${status.compile_issue_count ?? "n/a"}
- Owner gate status: ${status.owner_status ?? "n/a"}
- Owner gate issues: ${status.owner_issue_count ?? "n/a"}

## Next Safe Action

${status.next_safe_action}

## Red Lines

This command does not post, change public links, deploy production, push GitHub, send LINE, mutate customer data, process payments, or delete data.
`;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function countLines(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw.split(/\r?\n/).filter((line) => line.trim()).length;
  } catch {
    return 0;
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

main();
