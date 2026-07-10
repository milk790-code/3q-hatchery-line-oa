import { access, copyFile, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const LABEL = "com.angelia.3q-growth-loop.weekly";
const TEMPLATE_PATH = path.join(ROOT, "launchd", `${LABEL}.plist`);
const DEST_DIR = path.join(os.homedir(), "Library", "LaunchAgents");
const DEST_PATH = path.join(DEST_DIR, `${LABEL}.plist`);
const LAUNCHD_LOG_DIR = path.join(os.homedir(), "Library", "Logs", "Angelia", "3q-growth-loop");
const STDOUT_PATH = path.join(LAUNCHD_LOG_DIR, "weekly-runner.out.log");
const STDERR_PATH = path.join(LAUNCHD_LOG_DIR, "weekly-runner.err.log");
const STATUS_PATH = path.join(ROOT, "data", "launchagent_status.json");
const DOMAIN = `gui/${process.getuid?.() ?? ""}`;
const SERVICE = `${DOMAIN}/${LABEL}`;

async function main() {
  const action = process.argv[2] ?? "status";
  if (!["install", "uninstall", "status"].includes(action)) {
    throw new Error(`Unknown action: ${action}`);
  }

  if (action === "install") {
    await install();
    return;
  }
  if (action === "uninstall") {
    await uninstallLaunchAgent();
    return;
  }
  await writeAndPrintStatus("status");
}

async function install() {
  await mkdir(DEST_DIR, { recursive: true });
  await mkdir(LAUNCHD_LOG_DIR, { recursive: true });
  await copyFile(TEMPLATE_PATH, DEST_PATH);
  await runLaunchctl(["bootout", DOMAIN, DEST_PATH], { allowFailure: true });
  const bootstrap = await runLaunchctl(["bootstrap", DOMAIN, DEST_PATH], { allowFailure: false });
  await writeAndPrintStatus("install", { install_performed: true, bootstrap });
}

async function uninstallLaunchAgent() {
  const bootout = await runLaunchctl(["bootout", DOMAIN, DEST_PATH], { allowFailure: true });
  try {
    await unlink(DEST_PATH);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
  await writeAndPrintStatus("uninstall", { uninstall_performed: true, bootout });
}

async function writeAndPrintStatus(action, extra = {}) {
  const status = await buildStatus(action, extra);
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
  console.log(JSON.stringify(status, null, 2));
}

async function buildStatus(action, extra) {
  const fileInstalled = await exists(DEST_PATH);
  const template = await readFile(TEMPLATE_PATH, "utf8");
  const print = await runLaunchctl(["print", SERVICE], { allowFailure: true });
  const serviceLoaded = print.code === 0;
  const launchdInstalled = fileInstalled && serviceLoaded;
  const launchctlOutput = `${print.stdout}${print.stderr}`;
  const runtime = parseLaunchctlRuntime(launchctlOutput);
  const currentProcessDescendsFromService = await isDescendantProcess(runtime.service_pid);
  const currentLaunchdInvocationObserved = Boolean(
    process.env.XPC_SERVICE_NAME === LABEL
    && serviceLoaded
    && runtime.state === "running"
    && (runtime.active_count ?? 0) > 0
    && currentProcessDescendsFromService
    && template.includes("npm run weekly:local")
  );
  return {
    ok: action === "uninstall" ? !fileInstalled && !serviceLoaded : action === "install" ? launchdInstalled : true,
    action,
    label: LABEL,
    generated_at: new Date().toISOString(),
    domain: DOMAIN,
    service: SERVICE,
    plist_template_path: TEMPLATE_PATH,
    plist_installed_path: DEST_PATH,
    stdout_path: STDOUT_PATH,
    stderr_path: STDERR_PATH,
    file_installed: fileInstalled,
    service_loaded: serviceLoaded,
    launchd_installed: launchdInstalled,
    install_performed: Boolean(extra.install_performed),
    uninstall_performed: Boolean(extra.uninstall_performed),
    local_persistent_schedule: launchdInstalled,
    schedule: {
      weekday: "Sunday",
      hour: 0,
      minute: 10,
      timezone: "Asia/Taipei",
    },
    program_contains_weekly_runner: template.includes("npm run weekly:local"),
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    rollback_command: "npm run schedule:uninstall",
    launchctl_runtime: {
      ...runtime,
      current_launchd_invocation_observed: currentLaunchdInvocationObserved,
      current_process_descends_from_service: currentProcessDescendsFromService,
      proof_kind: runtime.observed_successful_run
        ? "completed_exit_zero"
        : currentLaunchdInvocationObserved
          ? "current_run_pending_exit"
          : "none",
    },
    launchctl_print: {
      code: print.code,
      output: trimOutput(launchctlOutput),
    },
    ...extra,
  };
}

function parseLaunchctlRuntime(output) {
  const activeCount = integerMatch(output, /^\s*active count = (\d+)\s*$/m);
  const runCount = integerMatch(output, /^\s*runs = (\d+)\s*$/m);
  const servicePid = integerMatch(output, /^\s*pid = (\d+)\s*$/m);
  const state = textMatch(output, /^\s*state = ([^\n]+?)\s*$/m);
  const lastExitValue = textMatch(output, /^\s*last exit code = ([^\n]+?)\s*$/m);
  const lastExitCode = /^-?\d+$/.test(lastExitValue ?? "") ? Number(lastExitValue) : null;
  return {
    state,
    active_count: activeCount,
    run_count: runCount,
    service_pid: servicePid,
    last_exit_code: lastExitCode,
    last_exit_value: lastExitValue,
    observed_successful_run: Number.isInteger(runCount) && runCount > 0 && lastExitCode === 0,
  };
}

async function isDescendantProcess(ancestorPid) {
  if (!Number.isInteger(ancestorPid) || ancestorPid <= 1) return false;
  let currentPid = process.pid;
  for (let depth = 0; depth < 32 && currentPid > 1; depth += 1) {
    if (currentPid === ancestorPid) return true;
    const result = await runProcess("/bin/ps", ["-o", "ppid=", "-p", String(currentPid)]);
    if (result.code !== 0) return false;
    const parentPid = Number(result.stdout.trim());
    if (!Number.isInteger(parentPid) || parentPid <= 0 || parentPid === currentPid) return false;
    currentPid = parentPid;
  }
  return false;
}

function integerMatch(value, pattern) {
  const match = value.match(pattern);
  return match ? Number(match[1]) : null;
}

function textMatch(value, pattern) {
  return value.match(pattern)?.[1]?.trim() ?? null;
}

async function exists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function runLaunchctl(args, { allowFailure }) {
  return new Promise((resolve, reject) => {
    const child = spawn("launchctl", args, {
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
    child.on("close", (code) => {
      const result = { args, code, stdout, stderr };
      if (code === 0 || allowFailure) {
        resolve(result);
        return;
      }
      reject(new Error(`launchctl ${args.join(" ")} failed with code ${code}: ${stderr || stdout}`));
    });
  });
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

function trimOutput(value) {
  return value.trim().split(/\r?\n/).slice(0, 40).join("\n");
}

main().catch(async (error) => {
  const status = {
    ok: false,
    action: process.argv[2] ?? "status",
    generated_at: new Date().toISOString(),
    error: error instanceof Error ? error.message : "unknown_error",
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
