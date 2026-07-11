import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "worker_dry_run_status.json");
const REPORT_PATH = path.join(ROOT, "worker_dry_run.md");
const LOG_DIR = path.join(ROOT, "logs");

const REQUIRED_MARKERS = [
  "--dry-run: exiting now.",
  "Total Upload:",
  "env.DB",
  "3q-growth-loop-candidate",
  "env.ENVIRONMENT",
  "env.PUBLIC_BASE_URL",
  "env.CHAMPION_URL",
  "env.CHAMPION_ORIGIN",
  "env.CHALLENGER_URL",
  "env.LINE_URL",
  "env.AB_TEST_ID",
  "env.CHAMPION_ASSET_ID",
  "env.CHALLENGER_ASSET_ID",
  "env.AB_CHALLENGER_PERCENT",
];

async function main() {
  const startedAt = new Date();
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await mkdir(LOG_DIR, { recursive: true });
  const logPath = path.join(LOG_DIR, `worker-dry-run-${stamp(startedAt)}.log`);

  const result = await runWranglerDryRun();
  await writeFile(logPath, result.combinedOutput);

  const finishedAt = new Date();
  const markerStatus = Object.fromEntries(
    REQUIRED_MARKERS.map((marker) => [marker, result.combinedOutput.includes(marker)]),
  );
  const failedMarkers = Object.entries(markerStatus)
    .filter(([, present]) => !present)
    .map(([marker]) => marker);
  const ok = result.exitCode === 0 && failedMarkers.length === 0;
  const status = {
    ok,
    generated_at: finishedAt.toISOString(),
    started_at: startedAt.toISOString(),
    duration_ms: finishedAt.valueOf() - startedAt.valueOf(),
    mode: "worker_deploy_dry_run_status",
    command: "wrangler deploy --dry-run",
    exit_code: result.exitCode,
    signal: result.signal,
    log_path: logPath,
    report_path: REPORT_PATH,
    stdout_bytes: result.stdout.length,
    stderr_bytes: result.stderr.length,
    total_upload_line: firstMatchingLine(result.combinedOutput, /^Total Upload:/m),
    dry_run_exit_observed: markerStatus["--dry-run: exiting now."],
    required_markers_present: failedMarkers.length === 0,
    failed_markers: failedMarkers,
    markers: markerStatus,
    external_effect: false,
    data_lp_events_write_performed: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    note: "Local Wrangler dry-run only. It validates the candidate Worker bundle and bindings, then exits before upload/deploy.",
  };

  await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (!ok) {
    process.exitCode = 1;
  }
}

function runWranglerDryRun() {
  const bin = process.platform === "win32"
    ? path.join(ROOT, "node_modules", ".bin", "wrangler.cmd")
    : path.join(ROOT, "node_modules", ".bin", "wrangler");

  return new Promise((resolve, reject) => {
    const child = spawn(bin, ["deploy", "--dry-run"], {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode, signal) => {
      resolve({
        exitCode,
        signal,
        stdout,
        stderr,
        combinedOutput: `${stdout}${stderr}`,
      });
    });
  });
}

function renderReport(status) {
  const markerRows = Object.entries(status.markers)
    .map(([marker, present]) => `| \`${marker}\` | ${present ? "yes" : "no"} |`)
    .join("\n");

  return `# Candidate Worker Dry Run

BLUF: ${status.ok ? "worker_dry_run_ok" : "worker_dry_run_failed"}. The candidate Worker bundle and expected bindings were checked with \`wrangler deploy --dry-run\`; no production deploy, upload, public link change, LINE action, payment, customer-data mutation, or deletion was performed.

Generated: ${status.generated_at}
Command: \`${status.command}\`
Exit code: ${status.exit_code}
Log: ${status.log_path}
Total upload: ${status.total_upload_line ?? "n/a"}

## Safety

- External effect: no
- Production deploy performed: no
- Public link change performed: no
- Formal post performed: no
- LINE push performed: no
- Customer-data mutation performed: no
- Payment action performed: no
- Delete action performed: no

## Required Markers

| marker | present |
|---|---|
${markerRows}
`;
}

function firstMatchingLine(value, pattern) {
  return value.split(/\r?\n/).find((line) => pattern.test(line)) ?? null;
}

function stamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

main().catch(async (error) => {
  const failed = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "worker_deploy_dry_run_status",
    error: error instanceof Error ? error.message : "unknown_error",
    external_effect: false,
    production_deploy_performed: false,
    deploy_performed: false,
    public_link_change_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeFile(STATUS_PATH, `${JSON.stringify(failed, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
