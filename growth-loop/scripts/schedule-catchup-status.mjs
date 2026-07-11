import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DEFAULT_WEEKLY_RUNNER_PATH = path.join(ROOT, "data", "weekly_runner_status.json");
const DEFAULT_LAUNCHAGENT_PATH = path.join(ROOT, "data", "launchagent_status.json");
const DEFAULT_STATUS_PATH = path.join(ROOT, "data", "schedule_catchup_status.json");
const DEFAULT_REPORT_PATH = path.join(ROOT, "schedule_catchup_status.md");
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const now = options.now ? new Date(options.now) : new Date();
  if (Number.isNaN(now.valueOf())) {
    throw new Error(`Invalid --now value: ${options.now}`);
  }

  const weeklyRunnerPath = path.resolve(ROOT, options.weeklyRunner ?? DEFAULT_WEEKLY_RUNNER_PATH);
  const launchAgentPath = path.resolve(ROOT, options.launchAgent ?? DEFAULT_LAUNCHAGENT_PATH);
  const statusPath = path.resolve(ROOT, options.status ?? DEFAULT_STATUS_PATH);
  const reportPath = path.resolve(ROOT, options.report ?? DEFAULT_REPORT_PATH);

  const weeklyRunner = await readJsonOrNull(weeklyRunnerPath);
  const launchAgent = await readJsonOrNull(launchAgentPath);
  const lastSchedule = lastScheduledRunUtc(now);
  const nextSchedule = new Date(lastSchedule.valueOf() + WEEK_MS);
  const lastSuccessAt = parseOptionalDate(weeklyRunner?.finished_at);
  const hasSuccessfulRun = weeklyRunner?.ok === true && weeklyRunner?.status === "success" && Boolean(lastSuccessAt);
  const runCoversLatestSchedule = hasSuccessfulRun && lastSuccessAt.valueOf() >= lastSchedule.valueOf();
  const launchAgentActive = launchAgent?.launchd_installed === true || launchAgent?.local_persistent_schedule === true;
  const missedScheduleWindows = hasSuccessfulRun
    ? Math.max(0, Math.floor((lastSchedule.valueOf() - lastSuccessAt.valueOf()) / WEEK_MS) + (lastSuccessAt.valueOf() < lastSchedule.valueOf() ? 1 : 0))
    : 1;

  const status = decideStatus({
    hasSuccessfulRun,
    runCoversLatestSchedule,
    launchAgentActive,
  });

  const payload = {
    ok: true,
    generated_at: now.toISOString(),
    mode: "weekly_schedule_catchup_monitor",
    status,
    timezone: "Asia/Taipei",
    schedule: {
      cadence: "weekly_sunday",
      weekday: "Sunday",
      hour: 0,
      minute: 10,
      timezone: "Asia/Taipei",
      utc_equivalent: "Saturday 16:10 UTC",
    },
    latest_expected_run: {
      utc: lastSchedule.toISOString(),
      taipei: formatTaipei(lastSchedule),
    },
    next_expected_run: {
      utc: nextSchedule.toISOString(),
      taipei: formatTaipei(nextSchedule),
    },
    weekly_runner: {
      path: relativeFromRoot(weeklyRunnerPath),
      file_found: Boolean(weeklyRunner),
      ok: weeklyRunner?.ok ?? false,
      status: weeklyRunner?.status ?? "missing",
      finished_at: weeklyRunner?.finished_at ?? null,
      log_path: weeklyRunner?.log_path ?? null,
      commands: Array.isArray(weeklyRunner?.commands) ? weeklyRunner.commands.length : 0,
      failed_commands: Array.isArray(weeklyRunner?.commands)
        ? weeklyRunner.commands.filter((command) => command.status === "failed").length
        : null,
      pending_commands: Array.isArray(weeklyRunner?.commands)
        ? weeklyRunner.commands.filter((command) => command.status === "pending").length
        : null,
      run_covers_latest_expected_run: runCoversLatestSchedule,
      missed_schedule_windows: missedScheduleWindows,
    },
    launchagent: {
      path: relativeFromRoot(launchAgentPath),
      file_found: Boolean(launchAgent),
      ok: launchAgent?.ok ?? false,
      launchd_installed: launchAgent?.launchd_installed ?? false,
      local_persistent_schedule: launchAgent?.local_persistent_schedule ?? false,
      rollback_command: launchAgent?.rollback_command ?? "npm run schedule:uninstall",
    },
    catchup_required: status !== "current_weekly_run_confirmed",
    next_safe_action: nextSafeAction(status),
    catchup_run_performed: false,
    weekly_runner_invoked: false,
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    note: "Local read-only monitor. It detects missed weekly windows and never runs weekly:local automatically.",
  };

  await mkdir(path.dirname(statusPath), { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(statusPath, `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(reportPath, renderReport(payload));
  console.log(JSON.stringify(payload, null, 2));
}

function decideStatus({ hasSuccessfulRun, runCoversLatestSchedule, launchAgentActive }) {
  if (!launchAgentActive) {
    return "schedule_not_active_owner_review";
  }
  if (!hasSuccessfulRun) {
    return "no_successful_weekly_run_owner_review";
  }
  if (!runCoversLatestSchedule) {
    return "missed_weekly_run_owner_review";
  }
  return "current_weekly_run_confirmed";
}

function nextSafeAction(status) {
  if (status === "current_weekly_run_confirmed") {
    return "No catch-up needed. Review owner_console.html and wait for the next Sunday local run.";
  }
  if (status === "schedule_not_active_owner_review") {
    return "Review data/launchagent_status.json, then run npm run schedule:install only if the local LaunchAgent should be re-enabled.";
  }
  return "Run npm run weekly:local locally, then run npm run schedule:catchup and review owner_console.html.";
}

function lastScheduledRunUtc(now) {
  const targetUtcDay = 6;
  const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 16, 10, 0, 0));
  const deltaDays = (now.getUTCDay() - targetUtcDay + 7) % 7;
  candidate.setUTCDate(candidate.getUTCDate() - deltaDays);
  if (candidate.valueOf() > now.valueOf()) {
    candidate.setTime(candidate.valueOf() - WEEK_MS);
  }
  return candidate;
}

function formatTaipei(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${formatter.format(date)} Asia/Taipei`;
}

async function readJsonOrNull(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function parseOptionalDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function parseArgs(args) {
  const options = {};
  for (const arg of args) {
    if (!arg.startsWith("--")) {
      throw new Error(`Unknown positional argument: ${arg}`);
    }
    const [key, value] = arg.slice(2).split("=", 2);
    if (!value) {
      throw new Error(`Expected --${key}=value`);
    }
    options[toCamelCase(key)] = value;
  }
  return options;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function relativeFromRoot(filePath) {
  const relative = path.relative(ROOT, filePath);
  return relative.startsWith("..") ? filePath : relative;
}

function renderReport(status) {
  const runner = status.weekly_runner;
  const launchAgent = status.launchagent;
  return `# 3Q Growth Loop Schedule Catch-Up Status

BLUF: ${status.status}. This local monitor checks whether the latest weekly run covers the most recent Sunday 00:10 Asia/Taipei schedule window. It never runs the weekly loop automatically.

Generated: ${status.generated_at}
External effect: no

## Schedule

- Cadence: ${status.schedule.cadence}
- Latest expected run: ${status.latest_expected_run.taipei} (${status.latest_expected_run.utc})
- Next expected run: ${status.next_expected_run.taipei} (${status.next_expected_run.utc})

## Current Evidence

- Weekly runner status: ${runner.status}
- Weekly runner finished at: ${runner.finished_at ?? "n/a"}
- Weekly runner log: ${runner.log_path ?? "n/a"}
- Run covers latest expected window: ${runner.run_covers_latest_expected_run ? "yes" : "no"}
- Missed schedule windows: ${runner.missed_schedule_windows}
- Failed commands: ${runner.failed_commands ?? "n/a"}
- Pending commands at monitor time: ${runner.pending_commands ?? "n/a"}
- LaunchAgent installed: ${launchAgent.launchd_installed ? "yes" : "no"}
- Local persistent schedule: ${launchAgent.local_persistent_schedule ? "yes" : "no"}

## Next Safe Action

${status.next_safe_action}

## Safety

- Catch-up run performed: no
- Weekly runner invoked: no
- Production deploy performed: no
- Public link change performed: no
- Formal post performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
`;
}

main().catch(async (error) => {
  const status = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "weekly_schedule_catchup_monitor",
    status: "failed",
    error: error instanceof Error ? error.message : "unknown_error",
    catchup_run_performed: false,
    weekly_runner_invoked: false,
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
  await mkdir(path.dirname(DEFAULT_STATUS_PATH), { recursive: true });
  await writeFile(DEFAULT_STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
