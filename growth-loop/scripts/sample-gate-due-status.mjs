import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "config", "growth-loop.config.json");
const NEXT_P0_PATH = path.join(ROOT, "next_p0_owner_inputs.json");
const PROGRESS_PATH = path.join(ROOT, "data", "data_collection_progress_status.json");
const OWNER_SAMPLE_GATE_PATH = path.join(ROOT, "data", "owner_sample_gate_status.json");
const CAPTURE_CALENDAR_PATH = path.join(ROOT, "data", "sample_gate_capture_calendar_status.json");
const OWNER_ACTION_PATH = path.join(ROOT, "data", "owner_next_action_status.json");
const JSON_PATH = path.join(ROOT, "sample_gate_due_status.json");
const MD_PATH = path.join(ROOT, "sample_gate_due_status.md");
const STATUS_PATH = path.join(ROOT, "data", "sample_gate_due_status_status.json");

const RED_LINE_FALSE = {
  live_input_files_created: false,
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
  const options = parseArgs(process.argv.slice(2));
  const paths = resolvePaths(options);
  const generatedAt = new Date();
  const config = await readJson(paths.configPath);
  const nextP0 = await readJson(paths.nextP0Path);
  const progress = await readOptionalJson(paths.progressPath, {});
  const ownerSampleGate = await readOptionalJson(paths.ownerSampleGatePath, {});
  const captureCalendar = await readOptionalJson(paths.captureCalendarPath, {});
  const ownerAction = await readOptionalJson(paths.ownerActionPath, {});

  const timezone = config.timezone ?? "Asia/Taipei";
  const thresholds = config.sample_thresholds ?? {};
  const week = nextP0.week ?? currentWeek(generatedAt, timezone);
  const weekStart = parseDate(week.start);
  const minCheckDate = isoDate(addDays(weekStart, Math.max(Number(thresholds.min_test_days ?? 3), 1) - 1));
  const preferredCheckDate = isoDate(addDays(weekStart, Math.max(Number(thresholds.preferred_test_days ?? 7), 1) - 1));
  const today = options.today ?? zonedDate(generatedAt, timezone);
  assertIsoDate(today, "today");
  const p0PendingCount = numberOr(progress.p0_pending_count, ownerSampleGate.pending_rows, nextP0.p0_pending_count, null);
  const p0InputCount = numberOr(nextP0.current_input_count, Array.isArray(nextP0.inputs) ? nextP0.inputs.length : null, 0);
  const sampleThresholdMet = progress.sample_threshold_met === true || ownerSampleGate.sample_threshold_met === true;
  const sampleRateWinCandidate = progress.sample_rate_win_candidate === true || ownerSampleGate.sample_rate_win_candidate === true;
  const dueState = classifyDueState({
    today,
    minCheckDate,
    preferredCheckDate,
    sampleThresholdMet,
    sampleRateWinCandidate,
    p0PendingCount,
  });

  const nextSafeActions = [
    {
      id: "collect_or_update_focused_p0_counts",
      command: "open next_p0_owner_form.html",
      artifact: "next_p0_owner_form.html",
      why: "Capture only aggregate page_view, cta_click, and line_add counts for the current focused P0 rows.",
      external_effect: false,
    },
    {
      id: "preview_owner_download",
      command: "npm run next-p0:intake",
      artifact: "next_p0_owner_intake.md",
      why: "Validate any owner-downloaded focused CSV without staging it or writing events.",
      external_effect: false,
    },
    {
      id: "refresh_due_status",
      command: "npm run sample-gate:due",
      artifact: "sample_gate_due_status.md",
      why: "Recompute whether the current Day 3 / Day 7 sample gate is due, waiting, or ready for owner review.",
      external_effect: false,
    },
  ];

  const status = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "sample_gate_due_status",
    status: dueState.status,
    timezone,
    today,
    week,
    thresholds,
    min_check_date: minCheckDate,
    preferred_check_date: preferredCheckDate,
    due_phase: dueState.phase,
    due_event_id: dueState.eventId,
    due_date: dueState.date,
    due_now: dueState.dueNow,
    days_since_week_start: Math.max(0, dateDiffDays(week.start, today) + 1),
    days_since_min_check: Math.max(0, dateDiffDays(minCheckDate, today)),
    days_until_min_check: dateDiffDays(today, minCheckDate),
    days_until_preferred_check: dateDiffDays(today, preferredCheckDate),
    sample_threshold_met: sampleThresholdMet,
    sample_rate_win_candidate: sampleRateWinCandidate,
    p0_input_count: p0InputCount,
    p0_pending_count: p0PendingCount,
    p0_task_count: progress.p0_task_count ?? nextP0.p0_pending_count ?? null,
    next_owner_input_count: progress.next_owner_input_count ?? nextP0.current_input_count ?? p0InputCount,
    progress_status: progress.status ?? "unknown",
    owner_sample_gate_status: ownerSampleGate.status ?? "unknown",
    owner_sample_gate_decision: ownerSampleGate.decision ?? "unknown",
    capture_calendar_status: captureCalendar.status ?? "unknown",
    capture_calendar_next_due_date: captureCalendar.next_due_date ?? null,
    capture_calendar_next_due_event_id: captureCalendar.next_due_event_id ?? null,
    owner_next_action_status: ownerAction.status ?? "unknown",
    owner_next_action_primary_id: ownerAction.primary_action_id ?? null,
    owner_next_action_command: ownerAction.primary_action_command ?? "open next_p0_owner_form.html",
    champion_action: sampleThresholdMet && sampleRateWinCandidate ? "hold_champion_until_quality_review" : "keep_champion_sample_insufficient",
    challenger_promotion_allowed: false,
    next_variable_rotation_allowed: false,
    owner_action_required: sampleThresholdMet !== true || sampleRateWinCandidate === true,
    next_safe_command: dueState.nextCommand,
    next_safe_actions: nextSafeActions,
    review_artifacts: [
      "sample_gate_due_status.md",
      "sample_gate_capture_calendar.md",
      "owner_next_action.md",
      "data_collection_progress.md",
      "next_p0_owner_form.html",
      "next_p0_owner_intake.md",
      "owner_sample_gate_status.md",
    ],
    calendar_import_performed: false,
    system_reminder_created: false,
    browser_open_performed: false,
    ...RED_LINE_FALSE,
    note: "Local due-status monitor only. It reads local sample-gate artifacts and writes JSON/Markdown status; it does not import calendars, create reminders, open browsers, stage data, write events, deploy, post, push LINE/GitHub, mutate customer data, touch payments, or delete data.",
  };

  await writeJson(paths.jsonPath, status);
  await writeJson(paths.statusPath, compactStatus(status));
  await writeFile(paths.reportPath, renderMarkdown(status));
  console.log(JSON.stringify(compactStatus(status), null, 2));
}

function classifyDueState({ today, minCheckDate, preferredCheckDate, sampleThresholdMet, sampleRateWinCandidate, p0PendingCount }) {
  if (sampleThresholdMet && sampleRateWinCandidate) {
    return {
      status: "sample_rate_candidate_due_quality_review",
      phase: "quality_review",
      eventId: "quality_review_gate",
      date: today,
      dueNow: true,
      nextCommand: "npm run owner:quality-review",
    };
  }
  if (sampleThresholdMet) {
    return {
      status: "sample_threshold_met_quality_gate_next",
      phase: "quality_review",
      eventId: "quality_review_gate",
      date: today,
      dueNow: true,
      nextCommand: "npm run owner:quality-review",
    };
  }
  if (p0PendingCount === 0) {
    return {
      status: "counts_filled_sample_insufficient_continue_champion",
      phase: "sample_insufficient",
      eventId: "continue_current_round",
      date: today,
      dueNow: true,
      nextCommand: "npm run weekly:local",
    };
  }
  if (today < minCheckDate) {
    return {
      status: "waiting_until_day3",
      phase: "pre_minimum_check",
      eventId: "minimum_sample_check_day3",
      date: minCheckDate,
      dueNow: false,
      nextCommand: "open next_p0_owner_form.html",
    };
  }
  if (today > minCheckDate && today < preferredCheckDate) {
    return {
      status: "day3_overdue_waiting_for_owner_counts",
      phase: "minimum_check_overdue",
      eventId: "minimum_sample_check_day3_overdue",
      date: minCheckDate,
      dueNow: true,
      nextCommand: "open next_p0_owner_form.html",
    };
  }
  if (today >= preferredCheckDate) {
    return {
      status: "day7_due_waiting_for_owner_counts",
      phase: "preferred_check_due",
      eventId: "preferred_sample_check_day7",
      date: preferredCheckDate,
      dueNow: true,
      nextCommand: "open next_p0_owner_form.html",
    };
  }
  return {
    status: "day3_due_waiting_for_owner_counts",
    phase: "minimum_check_due",
    eventId: "minimum_sample_check_day3",
    date: minCheckDate,
    dueNow: true,
    nextCommand: "open next_p0_owner_form.html",
  };
}

function compactStatus(status) {
  return {
    ok: status.ok,
    generated_at: status.generated_at,
    mode: status.mode,
    status: status.status,
    timezone: status.timezone,
    today: status.today,
    week: status.week,
    min_check_date: status.min_check_date,
    preferred_check_date: status.preferred_check_date,
    due_phase: status.due_phase,
    due_event_id: status.due_event_id,
    due_date: status.due_date,
    due_now: status.due_now,
    days_since_min_check: status.days_since_min_check,
    sample_threshold_met: status.sample_threshold_met,
    sample_rate_win_candidate: status.sample_rate_win_candidate,
    p0_input_count: status.p0_input_count,
    p0_pending_count: status.p0_pending_count,
    progress_status: status.progress_status,
    owner_sample_gate_status: status.owner_sample_gate_status,
    capture_calendar_status: status.capture_calendar_status,
    capture_calendar_next_due_date: status.capture_calendar_next_due_date,
    capture_calendar_next_due_event_id: status.capture_calendar_next_due_event_id,
    champion_action: status.champion_action,
    challenger_promotion_allowed: status.challenger_promotion_allowed,
    next_variable_rotation_allowed: status.next_variable_rotation_allowed,
    next_safe_command: status.next_safe_command,
    calendar_import_performed: false,
    system_reminder_created: false,
    browser_open_performed: false,
    ...RED_LINE_FALSE,
  };
}

function renderMarkdown(status) {
  const actionRows = status.next_safe_actions
    .map((item) => `| ${item.id} | \`${item.command}\` | ${item.artifact} | ${item.why} |`)
    .join("\n");
  const artifactRows = status.review_artifacts.map((artifact) => `- ${artifact}`).join("\n");

  return `# 3Q Growth Loop Sample Gate Due Status

BLUF: ${status.status}. Today is ${status.today} in ${status.timezone}; the current sample gate ${status.due_now ? "is due now" : `is next due on ${status.due_date}`} and the champion stays unchanged.

Generated: ${status.generated_at}
Mode: ${status.mode}
Week: ${status.week.start} to ${status.week.end}
Minimum check: ${status.min_check_date}
Preferred check: ${status.preferred_check_date}
Due phase: ${status.due_phase}
Due event: ${status.due_event_id}
Due now: ${status.due_now ? "yes" : "no"}
Days since minimum check: ${status.days_since_min_check}
Sample threshold met: ${status.sample_threshold_met ? "yes" : "no"}
Sample-rate win candidate: ${status.sample_rate_win_candidate ? "yes" : "no"}
P0 inputs: ${status.p0_input_count}
P0 pending: ${status.p0_pending_count ?? "unknown"}
Progress status: ${status.progress_status}
Owner sample-gate status: ${status.owner_sample_gate_status}
Capture calendar: ${status.capture_calendar_status} / next=${status.capture_calendar_next_due_date ?? "n/a"} / event=${status.capture_calendar_next_due_event_id ?? "n/a"}
Champion action: ${status.champion_action}
Challenger promotion allowed: no
Next variable rotation allowed: no
Calendar import performed: no
System reminder created: no
Browser open performed: no
data/lp_events.jsonl write performed: no
External effect: no

## Next Safe Actions

| action | command | artifact | why |
|---|---|---|---|
${actionRows}

## Review Artifacts

${artifactRows}

## Safety

- Aggregate counts only.
- Do not paste phone, email, LINE user ID, customer name, chat text, payment data, order IDs, refund details, or private notes.
- Day 3 / Day 7 due status is a local operator signal, not approval to promote, publish, deploy, or change links.
- Sample-insufficient status keeps the champion and current variable.
`;
}

function currentWeek(date, timezone) {
  const today = parseDate(zonedDate(date, timezone));
  const day = today.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = addDays(today, mondayOffset);
  const end = addDays(start, 6);
  return { start: isoDate(start), end: isoDate(end) };
}

function zonedDate(date, timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateDiffDays(fromDate, toDate) {
  return Math.round((parseDate(toDate).getTime() - parseDate(fromDate).getTime()) / 86400000);
}

function numberOr(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function parseArgs(args) {
  const options = {};
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rawValue] = arg.slice(2).split("=");
    const value = rawValue.length > 0 ? rawValue.join("=") : "true";
    if (key === "today") options.today = value;
    if (key === "json") options.jsonPath = value;
    if (key === "status") options.statusPath = value;
    if (key === "report") options.reportPath = value;
    if (key === "config") options.configPath = value;
    if (key === "next-p0") options.nextP0Path = value;
    if (key === "progress") options.progressPath = value;
    if (key === "owner-sample-gate") options.ownerSampleGatePath = value;
    if (key === "capture-calendar") options.captureCalendarPath = value;
    if (key === "owner-action") options.ownerActionPath = value;
  }
  return options;
}

function resolvePaths(options) {
  return {
    configPath: resolveInputPath(options.configPath, CONFIG_PATH),
    nextP0Path: resolveInputPath(options.nextP0Path, NEXT_P0_PATH),
    progressPath: resolveInputPath(options.progressPath, PROGRESS_PATH),
    ownerSampleGatePath: resolveInputPath(options.ownerSampleGatePath, OWNER_SAMPLE_GATE_PATH),
    captureCalendarPath: resolveInputPath(options.captureCalendarPath, CAPTURE_CALENDAR_PATH),
    ownerActionPath: resolveInputPath(options.ownerActionPath, OWNER_ACTION_PATH),
    jsonPath: resolveInputPath(options.jsonPath, JSON_PATH),
    reportPath: resolveInputPath(options.reportPath, MD_PATH),
    statusPath: resolveInputPath(options.statusPath, STATUS_PATH),
  };
}

function resolveInputPath(value, fallback) {
  if (!value) return fallback;
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function assertIsoDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readOptionalJson(filePath, fallback) {
  try {
    return await readJson(filePath);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch(async (error) => {
  const options = parseArgs(process.argv.slice(2));
  const paths = resolvePaths(options);
  const status = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "sample_gate_due_status",
    status: "failed",
    error: error instanceof Error ? error.message : "unknown_error",
    calendar_import_performed: false,
    system_reminder_created: false,
    browser_open_performed: false,
    ...RED_LINE_FALSE,
  };
  await writeJson(paths.statusPath, status);
  console.error(error);
  process.exitCode = 1;
});
