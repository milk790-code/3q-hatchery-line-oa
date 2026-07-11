import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "config", "growth-loop.config.json");
const NEXT_P0_PATH = path.join(ROOT, "next_p0_owner_inputs.json");
const PROGRESS_PATH = path.join(ROOT, "data", "data_collection_progress_status.json");
const OWNER_ACTION_PATH = path.join(ROOT, "data", "owner_next_action_status.json");
const JSON_PATH = path.join(ROOT, "sample_gate_capture_calendar.json");
const MD_PATH = path.join(ROOT, "sample_gate_capture_calendar.md");
const ICS_PATH = path.join(ROOT, "sample_gate_capture_calendar.ics");
const STATUS_PATH = path.join(ROOT, "data", "sample_gate_capture_calendar_status.json");

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
  const config = await readJson(CONFIG_PATH);
  const nextP0 = await readJson(NEXT_P0_PATH);
  const progress = await readOptionalJson(PROGRESS_PATH, {});
  const ownerAction = await readOptionalJson(OWNER_ACTION_PATH, {});
  const thresholds = config.sample_thresholds ?? {};
  const week = nextP0.week ?? currentWeek(generatedAt);
  const weekStart = parseDate(week.start);
  const minDay = addDays(weekStart, Math.max(Number(thresholds.min_test_days ?? 3), 1) - 1);
  const preferredDay = addDays(weekStart, Math.max(Number(thresholds.preferred_test_days ?? 7), 1) - 1);
  const weekEnd = parseDate(week.end ?? isoDate(preferredDay));

  const rows = Array.isArray(nextP0.inputs) ? nextP0.inputs : [];
  const sourceGroups = Array.isArray(nextP0.source_groups) ? nextP0.source_groups : [];
  const events = [
    event({
      id: "week0_capture_open",
      date: week.start,
      title: "Open Week 0 P0 aggregate capture",
      purpose: "Confirm the current one-variable round, review the focused Next P0 rows, and start collecting aggregate counts.",
      command: "open next_p0_owner_form.html",
      artifact: "next_p0_owner_form.html",
      owner_gate: "Collect aggregate counts only; do not export customer rows.",
    }),
    event({
      id: "minimum_sample_check_day3",
      date: isoDate(minDay),
      title: "Day 3 minimum sample check",
      purpose: `Check whether min_visits=${thresholds.min_visits}, min_cta_clicks=${thresholds.min_cta_clicks}, min_line_adds=${thresholds.min_line_adds}, and min_test_days=${thresholds.min_test_days} are met before any winner review.`,
      command: "npm run data:progress && npm run next-p0:intake && npm run owner:next-action",
      artifact: "owner_next_action.md",
      owner_gate: "If a valid focused CSV exists, staging still requires --stage --confirm-owner-reviewed.",
    }),
    event({
      id: "preferred_sample_check_day7",
      date: isoDate(preferredDay),
      title: "Day 7 preferred weekly review",
      purpose: "Run the full local weekly loop, refresh scores, archive evidence, and review the approval queue without external actions.",
      command: "npm run weekly:local",
      artifact: "weekly_report.md",
      owner_gate: "Review approval_queue.json before any public route, deploy, GitHub, post, or LINE action.",
    }),
  ];

  if (isoDate(weekEnd) !== isoDate(preferredDay)) {
    events.push(event({
      id: "week_end_archive_review",
      date: isoDate(weekEnd),
      title: "Week-end archive review",
      purpose: "Confirm the immutable local archive exists for this weekly run.",
      command: "npm run archive:week",
      artifact: "data/week_archive_status.json",
      owner_gate: "Archive is local-only; do not treat it as proof of public publish or deploy.",
    }));
  }

  const today = taipeiDate(generatedAt);
  const nextDue = events.find((item) => item.date >= today) ?? events.at(-1) ?? null;
  const status = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "sample_gate_capture_calendar",
    status: progress.sample_threshold_met ? "sample_threshold_met_review_quality_gate" : "waiting_for_owner_sample_gate_counts",
    timezone: config.timezone ?? "Asia/Taipei",
    week,
    thresholds,
    p0_input_count: rows.length,
    source_group_count: sourceGroups.length,
    source_groups: sourceGroups.map((group) => ({
      source_surface: group.source_surface,
      input_count: group.input_count,
      event_types: group.event_types ?? [],
      external_effect: false,
    })),
    progress_status: progress.status ?? "unknown",
    p0_pending_count: progress.p0_pending_count ?? null,
    owner_next_action_status: ownerAction.status ?? "unknown",
    owner_next_action_command: ownerAction.primary_action_command ?? null,
    events,
    next_due_event: nextDue,
    outputs: {
      json: relative(JSON_PATH),
      markdown: relative(MD_PATH),
      ics: relative(ICS_PATH),
      status: relative(STATUS_PATH),
    },
    calendar_import_performed: false,
    system_reminder_created: false,
    browser_open_performed: false,
    ...RED_LINE_FALSE,
    note: "Local capture calendar only. It writes review artifacts and an importable ICS file, but it does not import into Calendar, create reminders, post, deploy, change links, push LINE, mutate customer data, touch payments, delete data, or push GitHub.",
  };

  await writeJson(JSON_PATH, status);
  await writeJson(STATUS_PATH, compactStatus(status));
  await writeFile(MD_PATH, renderMarkdown(status));
  await writeFile(ICS_PATH, renderIcs(status));
  console.log(JSON.stringify(compactStatus(status), null, 2));
}

function event({ id, date, title, purpose, command, artifact, owner_gate }) {
  return {
    id,
    date,
    title,
    purpose,
    command,
    artifact,
    owner_gate,
    owner_review_required: true,
    external_effect: false,
  };
}

function compactStatus(status) {
  return {
    ok: status.ok,
    generated_at: status.generated_at,
    mode: status.mode,
    status: status.status,
    timezone: status.timezone,
    week: status.week,
    event_count: status.events.length,
    next_due_event_id: status.next_due_event?.id ?? null,
    next_due_date: status.next_due_event?.date ?? null,
    p0_input_count: status.p0_input_count,
    p0_pending_count: status.p0_pending_count,
    progress_status: status.progress_status,
    owner_next_action_status: status.owner_next_action_status,
    calendar_import_performed: false,
    system_reminder_created: false,
    browser_open_performed: false,
    ...RED_LINE_FALSE,
  };
}

function renderMarkdown(status) {
  const eventRows = status.events
    .map((item) => `| ${item.date} | ${item.title} | \`${item.command}\` | ${item.artifact} | ${item.owner_gate} |`)
    .join("\n");
  const sourceRows = status.source_groups.length > 0
    ? status.source_groups.map((group) => `| ${group.source_surface} | ${group.input_count} | ${(group.event_types ?? []).join(", ")} |`).join("\n")
    : "| - | 0 | - |";

  return `# 3Q Growth Loop Sample Gate Capture Calendar

BLUF: ${status.status}. This local calendar converts the Week 0 sample-gate thresholds into concrete owner review checkpoints without importing anything into Calendar or creating reminders.

Generated: ${status.generated_at}
Timezone: ${status.timezone}
Week: ${status.week.start} to ${status.week.end}
Next due: ${status.next_due_event?.date ?? "n/a"} / ${status.next_due_event?.title ?? "n/a"}
P0 inputs: ${status.p0_input_count}
P0 pending: ${status.p0_pending_count ?? "unknown"}
Owner next action: ${status.owner_next_action_status}
Calendar import performed: no
System reminder created: no
External effect: no

## Capture Checkpoints

| date | checkpoint | command | artifact | owner gate |
|---|---|---|---|---|
${eventRows}

## Source Groups

| source | inputs | event types |
|---|---:|---|
${sourceRows}

## Thresholds

- min_visits: ${status.thresholds.min_visits}
- min_cta_clicks: ${status.thresholds.min_cta_clicks}
- min_line_adds: ${status.thresholds.min_line_adds}
- min_test_days: ${status.thresholds.min_test_days}
- preferred_test_days: ${status.thresholds.preferred_test_days}

## Safety

- Aggregate counts only.
- Do not paste phone, email, LINE user ID, customer name, chat text, payment data, order IDs, or refund details.
- This file and \`sample_gate_capture_calendar.ics\` are local artifacts only.
- Importing the ICS into Calendar, creating reminders, publishing, deploying, pushing GitHub, changing links, or sending LINE remains owner-controlled.
`;
}

function renderIcs(status) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Angelia 3Q Growth Loop//Sample Gate Capture Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs("3Q Growth Loop Sample Gate")}`,
    `X-WR-TIMEZONE:${escapeIcs(status.timezone)}`,
  ];
  for (const item of status.events) {
    const start = item.date.replaceAll("-", "");
    const end = isoDate(addDays(parseDate(item.date), 1)).replaceAll("-", "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcs(`${item.id}@3q-growth-loop.local`)}`,
      `DTSTAMP:${icsDateTime(status.generated_at)}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${escapeIcs(item.title)}`,
      `DESCRIPTION:${escapeIcs(`${item.purpose}\\nCommand: ${item.command}\\nArtifact: ${item.artifact}\\nOwner gate: ${item.owner_gate}\\nExternal effect: no`)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

function currentWeek(date) {
  const today = parseDate(taipeiDate(date));
  const day = today.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = addDays(today, mondayOffset);
  const end = addDays(start, 6);
  return { start: isoDate(start), end: isoDate(end) };
}

function taipeiDate(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
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

function icsDateTime(value) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function relative(filePath) {
  return path.relative(ROOT, filePath);
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
  const status = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "sample_gate_capture_calendar",
    status: "failed",
    error: error instanceof Error ? error.message : "unknown_error",
    calendar_import_performed: false,
    system_reminder_created: false,
    browser_open_performed: false,
    ...RED_LINE_FALSE,
  };
  await writeJson(STATUS_PATH, status);
  console.error(error);
  process.exitCode = 1;
});
