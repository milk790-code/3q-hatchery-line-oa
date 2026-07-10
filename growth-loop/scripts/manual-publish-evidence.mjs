import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OPTIONS = parseArgs(process.argv.slice(2));
const PACKET_PATH = resolvePath(OPTIONS.packet, path.join(ROOT, "manual_publish_packet.json"));
const CAPTURE_PLAN_PATH = resolvePath(OPTIONS.capturePlan, path.join(ROOT, "manual_publish_capture_plan.json"));
const INPUT_PATH = resolvePath(OPTIONS.input, path.join(ROOT, "manual_publish_evidence.json"));
const EXAMPLE_PATH = resolvePath(OPTIONS.example, path.join(ROOT, "manual_publish_evidence.example.json"));
const REPORT_PATH = resolvePath(OPTIONS.report, path.join(ROOT, "manual_publish_evidence.md"));
const STATUS_PATH = resolvePath(OPTIONS.status, path.join(ROOT, "data", "manual_publish_evidence_status.json"));

const RED_LINE_FLAGS = {
  external_effect: false,
  data_lp_events_write_performed: false,
  public_link_change_performed: false,
  production_deploy_performed: false,
  github_push_or_pr_performed: false,
  formal_post_performed: false,
  line_push_performed: false,
  customer_data_mutation_performed: false,
  payment_action_performed: false,
  delete_action_performed: false,
};

const REQUIRED_FIELDS = [
  "packet_id",
  "published_at",
  "surface",
  "post_ref",
  "reviewer",
  "manual_publish_confirmed",
  "pii_checked",
  "published_packet_only",
];

const SENSITIVE_KEY_PATTERN = /phone|email|line_user_id|customer|name|address|payment|card|order|refund|chat|message|note|token|secret|api[_-]?key|password/i;
const SENSITIVE_VALUE_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9_-]+|line_user_id|phone=|email=|payment|credit card|customer_name|chat_text/i;

async function main() {
  const generatedAt = new Date();
  const [packet, capturePlan] = await Promise.all([
    readJson(PACKET_PATH),
    readJson(CAPTURE_PLAN_PATH),
  ]);
  await writeJson(EXAMPLE_PATH, buildExample(packet, generatedAt));

  const inputRead = await readOptionalJson(INPUT_PATH);
  const result = buildEvidenceStatus({ generatedAt, packet, capturePlan, inputRead });
  await writeFile(REPORT_PATH, renderMarkdown(result));
  await writeJson(STATUS_PATH, compactStatus(result));

  const status = compactStatus(result);
  console.log(JSON.stringify(status, null, 2));
  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildEvidenceStatus({ generatedAt, packet, capturePlan, inputRead }) {
  const issues = [];
  const packetMap = new Map((packet.packets ?? []).map((item) => [item.packet_id, item]));
  const captureMap = new Map((capturePlan.plans ?? []).map((item) => [item.packet_id, item]));
  const inputExists = inputRead.exists;
  const rawEvidence = inputExists ? normalizeEvidence(inputRead.value, issues) : [];

  if (rawEvidence.length > 1) {
    issues.push("Only one manually published packet can be active at a time for clean attribution.");
  }

  const evidence = rawEvidence.map((item, index) => validateEvidenceItem({
    item,
    index,
    generatedAt,
    packetMap,
    captureMap,
    issues,
  }));

  const validEvidence = evidence.filter((item) => item.valid);
  const active = validEvidence[0] ?? null;
  const waiting = !inputExists || rawEvidence.length === 0;
  const ok = issues.length === 0;
  const status = waiting
    ? "waiting_for_owner_manual_publish_evidence"
    : ok
      ? active?.checkpoint_status ?? "manual_publish_evidence_ready"
      : "blocked_invalid_manual_publish_evidence";

  return {
    ok,
    generated_at: generatedAt.toISOString(),
    mode: "manual_publish_evidence_local_only",
    status,
    input_path: relativeOrAbsolute(INPUT_PATH),
    input_exists: inputExists,
    example_path: relativeOrAbsolute(EXAMPLE_PATH),
    report_path: relativeOrAbsolute(REPORT_PATH),
    status_path: relativeOrAbsolute(STATUS_PATH),
    round_id: packet.round_id,
    changed_variable: packet.changed_variable,
    packet_count: packet.packet_count ?? (packet.packets ?? []).length,
    evidence_count: rawEvidence.length,
    valid_evidence_count: validEvidence.length,
    active_packet_id: active?.packet_id ?? null,
    active_content_id: active?.content_id ?? null,
    active_variant_id: active?.variant_id ?? null,
    published_at: active?.published_at ?? null,
    published_taipei_date: active?.published_taipei_date ?? null,
    day_3_capture_date: active?.day_3_capture_date ?? null,
    day_7_capture_date: active?.day_7_capture_date ?? null,
    days_since_publish: active?.days_since_publish ?? null,
    next_safe_action: nextSafeAction({ waiting, ok, active }),
    owner_manual_publish_evidence_detected: Boolean(active),
    owner_manual_publish_required: true,
    manual_publish_confirmed_by_owner: Boolean(active?.manual_publish_confirmed),
    pii_checked: Boolean(active?.pii_checked),
    live_input_files_created: false,
    evidence,
    issues,
    policy: {
      local_evidence_intake_only: true,
      no_network_read: true,
      no_post_url_fetch: true,
      aggregate_only_followup: true,
      one_packet_at_a_time_required: true,
      owner_manual_publish_required: true,
      input_file_is_owner_supplied: true,
    },
    outputs: {
      example_json: "manual_publish_evidence.example.json",
      report_md: "manual_publish_evidence.md",
      status_json: "data/manual_publish_evidence_status.json",
    },
    ...RED_LINE_FLAGS,
  };
}

function normalizeEvidence(value, issues) {
  if (Array.isArray(value)) {
    return value;
  }
  if (Array.isArray(value?.evidence)) {
    return value.evidence;
  }
  if (value && typeof value === "object" && value.packet_id) {
    return [value];
  }
  issues.push("manual_publish_evidence.json must be an object with evidence[] or a single evidence object.");
  return [];
}

function validateEvidenceItem({ item, index, generatedAt, packetMap, captureMap, issues }) {
  const itemIssues = [];
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    itemIssues.push("Evidence item must be an object.");
  }

  for (const field of REQUIRED_FIELDS) {
    if (item?.[field] === undefined || item?.[field] === null || String(item[field]).trim() === "") {
      itemIssues.push(`missing required field: ${field}`);
    }
  }

  for (const key of Object.keys(item ?? {})) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      itemIssues.push(`sensitive-looking field is not allowed: ${key}`);
    }
    const value = item[key];
    if (typeof value === "string" && SENSITIVE_VALUE_PATTERN.test(value)) {
      itemIssues.push(`sensitive-looking value is not allowed in field: ${key}`);
    }
  }

  if (item?.manual_publish_confirmed !== true) {
    itemIssues.push("manual_publish_confirmed must be true.");
  }
  if (item?.pii_checked !== true) {
    itemIssues.push("pii_checked must be true.");
  }
  if (item?.published_packet_only !== true) {
    itemIssues.push("published_packet_only must be true.");
  }

  const matchedPacket = packetMap.get(String(item?.packet_id ?? ""));
  if (!matchedPacket) {
    itemIssues.push("packet_id does not match manual_publish_packet.json.");
  }
  const matchedCapturePlan = captureMap.get(String(item?.packet_id ?? ""));
  if (!matchedCapturePlan) {
    itemIssues.push("packet_id does not match manual_publish_capture_plan.json.");
  }

  const parsedDate = parseOwnerDate(item?.published_at);
  if (!parsedDate.ok) {
    itemIssues.push(parsedDate.issue);
  } else if (parsedDate.date.getTime() > generatedAt.getTime() + 5 * 60 * 1000) {
    itemIssues.push("published_at cannot be in the future.");
  }

  const publishedTaipeiDate = parsedDate.ok ? taipeiDateString(parsedDate.date) : null;
  const day3 = publishedTaipeiDate ? addDaysTaipeiDate(publishedTaipeiDate, 3) : null;
  const day7 = publishedTaipeiDate ? addDaysTaipeiDate(publishedTaipeiDate, 7) : null;
  const today = taipeiDateString(generatedAt);
  const daysSincePublish = publishedTaipeiDate ? daysBetweenTaipeiDates(publishedTaipeiDate, today) : null;
  const checkpointStatus = day7 && compareDateStrings(today, day7) >= 0
    ? "ready_for_day_7_counts"
    : day3 && compareDateStrings(today, day3) >= 0
      ? "ready_for_day_3_counts"
      : "waiting_until_day_3";

  const valid = itemIssues.length === 0;
  if (!valid) {
    issues.push(`evidence[${index}]: ${itemIssues.join(" ")}`);
  }

  return {
    valid,
    row_number: index + 1,
    packet_id: String(item?.packet_id ?? ""),
    content_id: matchedPacket?.content_id ?? null,
    variant_id: matchedPacket?.variant_id ?? null,
    surface: stringOrNull(item?.surface),
    post_ref: stringOrNull(item?.post_ref),
    reviewer: stringOrNull(item?.reviewer),
    published_at: stringOrNull(item?.published_at),
    published_taipei_date: publishedTaipeiDate,
    day_3_capture_date: day3,
    day_7_capture_date: day7,
    days_since_publish: daysSincePublish,
    checkpoint_status: checkpointStatus,
    manual_publish_confirmed: item?.manual_publish_confirmed === true,
    pii_checked: item?.pii_checked === true,
    published_packet_only: item?.published_packet_only === true,
    sample_gate_rows: matchedCapturePlan?.sample_gate_rows?.length ?? 0,
    north_star_capture_rows: matchedCapturePlan?.north_star_capture_rows?.length ?? 0,
    next_counts_to_collect: nextCounts(checkpointStatus),
    issues: itemIssues,
    aggregate_only: true,
    customer_data_allowed: false,
    no_network_read_performed: true,
    post_url_fetch_performed: false,
    ...RED_LINE_FLAGS,
  };
}

function nextCounts(checkpointStatus) {
  if (checkpointStatus === "ready_for_day_7_counts") {
    return ["link_click", "page_view", "cta_click", "line_add", "lead_submit", "deal", "quality_flag"];
  }
  if (checkpointStatus === "ready_for_day_3_counts") {
    return ["page_view", "cta_click", "line_add"];
  }
  return [];
}

function nextSafeAction({ waiting, ok, active }) {
  if (waiting) {
    return "After the owner manually publishes exactly one reviewed packet, copy manual_publish_evidence.example.json to manual_publish_evidence.json, fill non-sensitive evidence only, then rerun npm run manual:publish-evidence.";
  }
  if (!ok) {
    return "Fix manual_publish_evidence.json so it contains exactly one matching packet, true confirmation flags, non-sensitive fields, and no customer data.";
  }
  if (active?.checkpoint_status === "ready_for_day_7_counts") {
    return "Collect Day 7 aggregate counts, then update the sample-gate ledger and rerun npm run owner:sample-gate && npm run weekly:local.";
  }
  if (active?.checkpoint_status === "ready_for_day_3_counts") {
    return "Collect Day 3 aggregate page_view, cta_click, and line_add counts only; keep the champion until thresholds are met.";
  }
  return `Wait until Day 3 (${active?.day_3_capture_date ?? "unknown"}) before collecting minimum sample-gate counts.`;
}

function buildExample(packet, generatedAt) {
  const firstPacket = (packet.packets ?? [])[0] ?? {};
  return {
    generated_at: generatedAt.toISOString(),
    mode: "manual_publish_evidence_example",
    instructions: [
      "Copy this file to manual_publish_evidence.json only after the owner manually publishes exactly one reviewed packet.",
      "Do not include customer names, phone, email, LINE user IDs, chat text, order IDs, payment data, private notes, tokens, or secrets.",
      "This evidence is local-only. The runner will not fetch post URLs, publish, schedule, push LINE, change public links, deploy, or write real events.",
    ],
    evidence: [
      {
        packet_id: firstPacket.packet_id ?? "manual-publish-01-example",
        published_at: `${taipeiDateString(generatedAt)}T09:00:00+08:00`,
        surface: "Facebook Page manual post",
        post_ref: "owner-visible post URL or local screenshot reference",
        reviewer: "Angelia",
        manual_publish_confirmed: true,
        pii_checked: true,
        published_packet_only: true,
      },
    ],
  };
}

function compactStatus(result) {
  return {
    ok: result.ok,
    generated_at: result.generated_at,
    mode: result.mode,
    status: result.status,
    input_exists: result.input_exists,
    evidence_count: result.evidence_count,
    valid_evidence_count: result.valid_evidence_count,
    active_packet_id: result.active_packet_id,
    active_content_id: result.active_content_id,
    active_variant_id: result.active_variant_id,
    published_taipei_date: result.published_taipei_date,
    day_3_capture_date: result.day_3_capture_date,
    day_7_capture_date: result.day_7_capture_date,
    days_since_publish: result.days_since_publish,
    owner_manual_publish_evidence_detected: result.owner_manual_publish_evidence_detected,
    owner_manual_publish_required: result.owner_manual_publish_required,
    manual_publish_confirmed_by_owner: result.manual_publish_confirmed_by_owner,
    pii_checked: result.pii_checked,
    issue_count: result.issues.length,
    issues: result.issues,
    next_safe_action: result.next_safe_action,
    outputs: result.outputs,
    live_input_files_created: false,
    ...RED_LINE_FLAGS,
  };
}

function renderMarkdown(result) {
  const evidenceRows = result.evidence.map((item) =>
    `| ${item.packet_id || "n/a"} | ${item.valid ? "yes" : "no"} | ${item.checkpoint_status ?? "n/a"} | ${item.published_taipei_date ?? "n/a"} | ${item.day_3_capture_date ?? "n/a"} | ${item.day_7_capture_date ?? "n/a"} | ${item.next_counts_to_collect.join(", ") || "wait"} |`
  ).join("\n") || "| n/a | n/a | waiting | n/a | n/a | n/a | wait |";
  const issues = result.issues.length > 0
    ? result.issues.map((issue) => `- ${issue}`).join("\n")
    : "- none";

  return `# Manual Publish Evidence Intake

BLUF: ${result.status}. This local intake reads owner-supplied proof that one reviewed packet was manually published, then calculates Day 3 and Day 7 aggregate-count checkpoints. It does not publish, schedule, fetch URLs, change links, push LINE, deploy, create GitHub activity, mutate customer data, process payments, delete data, or write data/lp_events.jsonl.

Generated: ${result.generated_at}
Mode: ${result.mode}
Status: ${result.status}
Input exists: ${result.input_exists ? "yes" : "no"}
Evidence count: ${result.evidence_count}
Valid evidence count: ${result.valid_evidence_count}
Active packet: ${result.active_packet_id ?? "none"}
Next safe action: ${result.next_safe_action}

External effect: no
Formal post performed by this runner: no
LINE push performed: no
Public link change performed: no
Production deploy performed: no
GitHub push or PR performed: no
Customer data mutation performed: no
Payment action performed: no
Delete action performed: no
data/lp_events.jsonl write performed: no
Post URL fetch performed: no

## Evidence

| packet | valid | checkpoint | published date | Day 3 | Day 7 | next counts |
|---|---|---|---|---|---|---|
${evidenceRows}

## Required Owner Fields

${REQUIRED_FIELDS.map((field) => `- ${field}`).join("\n")}

## Issues

${issues}
`;
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function readOptionalJson(filePath) {
  try {
    return { exists: true, value: await readJson(filePath) };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { exists: false, value: null };
    }
    throw error;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseOwnerDate(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return { ok: false, issue: "published_at is required." };
  }
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00+08:00` : text;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, issue: "published_at must be an ISO timestamp or YYYY-MM-DD." };
  }
  return { ok: true, date };
}

function taipeiDateString(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function addDaysTaipeiDate(dateString, days) {
  const date = new Date(`${dateString}T00:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return taipeiDateString(date);
}

function daysBetweenTaipeiDates(start, end) {
  const startMs = new Date(`${start}T00:00:00+08:00`).getTime();
  const endMs = new Date(`${end}T00:00:00+08:00`).getTime();
  return Math.floor((endMs - startMs) / 86400000);
}

function compareDateStrings(a, b) {
  return a.localeCompare(b);
}

function stringOrNull(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function parseArgs(argv) {
  const options = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }
    const [rawKey, ...rest] = arg.slice(2).split("=");
    options[rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = rest.join("=") || "true";
  }
  return options;
}

function resolvePath(value, fallback) {
  if (!value || value === "true") {
    return fallback;
  }
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function relativeOrAbsolute(filePath) {
  const relative = path.relative(ROOT, filePath);
  return relative.startsWith("..") ? filePath : relative;
}

main();
