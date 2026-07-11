import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OPTIONS = parseArgs(process.argv.slice(2));
const CONFIG_PATH = resolvePath(OPTIONS.config, path.join(ROOT, "config", "growth-loop.config.json"));
const OWNER_SAMPLE_GATE_PATH = resolvePath(OPTIONS.ownerSampleGate, path.join(ROOT, "data", "owner_sample_gate_status.json"));
const INPUT_PATH = resolvePath(OPTIONS.input, path.join(ROOT, "data", "owner_quality_review.filled.json"));
const STATUS_PATH = resolvePath(OPTIONS.status, path.join(ROOT, "data", "owner_quality_review_status.json"));
const REPORT_PATH = resolvePath(OPTIONS.report, path.join(ROOT, "owner_quality_review.md"));
const EXAMPLE_PATH = resolvePath(OPTIONS.example, path.join(ROOT, "owner_quality_review.example.json"));
const REAL_EVENTS_PATH = resolvePath(OPTIONS.realEvents, path.join(ROOT, "data", "lp_events.jsonl"));
const PII_CHECKED_VALUES = new Set(["yes", "true", "checked", "ok", "1"]);

async function main() {
  const generatedAt = new Date();
  const config = await readJson(CONFIG_PATH);
  const ownerSampleGate = await readJson(OWNER_SAMPLE_GATE_PATH);
  const realEventsBefore = await countLines(REAL_EVENTS_PATH);
  const inputExists = await exists(INPUT_PATH);
  const rules = qualityRules(config);
  let input = null;
  let validation = emptyValidation();

  if (inputExists) {
    input = await readJson(INPUT_PATH);
    validation = validateInput(input, rules);
  }

  const status = buildStatus({
    generatedAt,
    config,
    ownerSampleGate,
    inputExists,
    input,
    validation,
    realEventsBefore,
  });

  const realEventsAfter = await countLines(REAL_EVENTS_PATH);
  status.real_events_after = realEventsAfter;
  status.real_events_unchanged = realEventsBefore === realEventsAfter;

  await writeJson(EXAMPLE_PATH, exampleInput(config));
  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
}

function buildStatus({ generatedAt, config, ownerSampleGate, inputExists, input, validation, realEventsBefore }) {
  const sampleRateWinCandidate = Boolean(ownerSampleGate.sample_rate_win_candidate)
    || ownerSampleGate.status === "sample_rate_win_needs_quality_review";
  const sampleThresholdMet = Boolean(ownerSampleGate.sample_threshold_met);
  const rules = qualityRules(config);
  const base = {
    generated_at: generatedAt.toISOString(),
    mode: "owner_quality_review",
    input_path: INPUT_PATH,
    input_exists: inputExists,
    owner_sample_gate_path: OWNER_SAMPLE_GATE_PATH,
    owner_sample_gate_status: ownerSampleGate.status ?? "unknown",
    report_path: REPORT_PATH,
    example_path: EXAMPLE_PATH,
    thresholds: rules,
    current_round: config.current_round,
    sample_threshold_met: sampleThresholdMet,
    sample_rate_win_candidate: sampleRateWinCandidate,
    owner_review_required: sampleRateWinCandidate,
    issue_count: validation.issues.length,
    quality_regression_count: validation.qualityFailures.length,
    issues: validation.issues,
    quality_regressions: validation.qualityFailures,
    evidence: validation.evidence,
    real_events_before: realEventsBefore,
    example_written: true,
    live_input_files_created: false,
    apply_performed: false,
    append_performed: false,
    data_lp_events_write_performed: false,
    approval_queue_write_performed: false,
    external_effect: false,
    public_link_change_performed: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    promotion_performed: false,
  };

  if (!inputExists) {
    if (!sampleRateWinCandidate) {
      return {
        ...base,
        ok: true,
        status: "waiting_for_sample_rate_candidate",
        quality_guard_status: "not_evaluated_waiting_for_sample_rate_candidate",
        no_quality_regression: null,
        challenger_win_rule_met: false,
        promotion_review_queued: false,
        decision: "wait_for_sample_rate_candidate",
        next_safe_action: "Keep collecting owner sample-gate counts until the challenger clears sample thresholds and beats champion line_add_rate by the configured lift.",
      };
    }
    return {
      ...base,
      ok: true,
      status: "waiting_for_owner_quality_evidence",
      quality_guard_status: "owner_quality_review_required",
      no_quality_regression: null,
      challenger_win_rule_met: false,
      promotion_review_queued: false,
      decision: "collect_owner_quality_review_evidence",
      next_safe_action: "Fill data/owner_quality_review.filled.json with aggregate-only quality evidence, then rerun npm run owner:quality-review.",
    };
  }

  if (validation.issues.length > 0) {
    return {
      ...base,
      ok: false,
      status: "blocked_invalid_owner_quality_review",
      quality_guard_status: "blocked_invalid_owner_quality_review",
      no_quality_regression: false,
      challenger_win_rule_met: false,
      promotion_review_queued: false,
      decision: "fix_owner_quality_review_input",
      next_safe_action: "Fix data/owner_quality_review.filled.json. Keep only aggregate, non-PII evidence and rerun npm run owner:quality-review.",
    };
  }

  if (!sampleRateWinCandidate) {
    return {
      ...base,
      ok: true,
      status: "waiting_for_sample_rate_candidate",
      quality_guard_status: "quality_evidence_valid_but_not_actionable",
      no_quality_regression: null,
      challenger_win_rule_met: false,
      promotion_review_queued: false,
      decision: "hold_quality_review_until_sample_rate_candidate",
      next_safe_action: "Do not use this quality review until the owner sample gate reports sample_rate_win_candidate=true.",
    };
  }

  if (validation.qualityFailures.length > 0) {
    return {
      ...base,
      ok: true,
      status: "owner_quality_review_failed_keep_champion",
      quality_guard_status: "owner_quality_review_failed",
      no_quality_regression: false,
      challenger_win_rule_met: false,
      promotion_review_queued: false,
      decision: "keep_champion_due_quality_regression",
      next_safe_action: "Keep the current champion. Prepare a new local challenger or another one-variable round after owner review.",
    };
  }

  return {
    ...base,
    ok: true,
    status: "owner_quality_review_passed_no_auto_promotion",
    quality_guard_status: "owner_quality_review_passed",
    no_quality_regression: true,
    challenger_win_rule_met: sampleThresholdMet && sampleRateWinCandidate,
    promotion_review_queued: sampleThresholdMet && sampleRateWinCandidate,
    decision: "queue_owner_promotion_review_no_auto_promotion",
    next_safe_action: "Owner may review the prepared promotion evidence. Any challenger promotion, public link change, deploy, post, or LINE action remains a manual red-line gate.",
  };
}

function validateInput(input, rules) {
  const issues = [];
  const qualityFailures = [];
  const evidence = {};

  if (!isPlainObject(input)) {
    return {
      issues: [{ field: "root", message: "owner quality review input must be a JSON object." }],
      qualityFailures,
      evidence,
    };
  }

  for (const field of [
    "reviewer",
    "pii_checked",
    "evidence_ref",
    "lead_rate_retention_vs_champion",
    "close_rate_retention_vs_champion",
    "spam_flag_rate",
  ]) {
    if (!(field in input) || String(input[field] ?? "").trim() === "") {
      issues.push({ field, message: `${field} is required.` });
    }
  }

  const blockedKeys = new Set((rules.blocked_metadata_keys ?? []).map(normalizeKey));
  walk(input, (keyPath, value) => {
    const leaf = keyPath.split(".").pop() ?? keyPath;
    if (blockedKeys.has(normalizeKey(leaf))) {
      issues.push({
        field: keyPath,
        message: "Sensitive metadata key is not allowed in owner quality review input.",
      });
    }
    if (typeof value === "string") {
      const sensitive = sensitiveMatch(value);
      if (sensitive) {
        issues.push({
          field: keyPath,
          message: `Sensitive-looking ${sensitive} detected. Use aggregate evidence refs only, never customer identifiers.`,
        });
      }
    }
  });

  const piiChecked = input.pii_checked === true || PII_CHECKED_VALUES.has(String(input.pii_checked ?? "").trim().toLowerCase());
  if (!piiChecked) {
    issues.push({ field: "pii_checked", message: "pii_checked must be yes/true/checked/ok/1." });
  }

  const leadRetention = parseFiniteNumber(input.lead_rate_retention_vs_champion);
  const closeRetention = parseFiniteNumber(input.close_rate_retention_vs_champion);
  const spamRate = parseFiniteNumber(input.spam_flag_rate);
  const lowQualityFlagCount = parseOptionalInteger(input.low_quality_flag_count ?? input.quality_flag_count ?? 0);

  evidence.lead_rate_retention_vs_champion = leadRetention;
  evidence.close_rate_retention_vs_champion = closeRetention;
  evidence.spam_flag_rate = spamRate;
  evidence.low_quality_flag_count = lowQualityFlagCount;
  evidence.evidence_ref = String(input.evidence_ref ?? "").trim();
  evidence.reviewer = String(input.reviewer ?? "").trim();
  evidence.pii_checked = piiChecked;

  if (!Number.isFinite(leadRetention)) {
    issues.push({ field: "lead_rate_retention_vs_champion", message: "lead_rate_retention_vs_champion must be a finite number." });
  }
  if (!Number.isFinite(closeRetention)) {
    issues.push({ field: "close_rate_retention_vs_champion", message: "close_rate_retention_vs_champion must be a finite number." });
  }
  if (!Number.isFinite(spamRate) || spamRate < 0 || spamRate > 1) {
    issues.push({ field: "spam_flag_rate", message: "spam_flag_rate must be a number from 0 to 1." });
  }
  if (!Number.isInteger(lowQualityFlagCount) || lowQualityFlagCount < 0) {
    issues.push({ field: "low_quality_flag_count", message: "low_quality_flag_count or quality_flag_count must be a non-negative integer when present." });
  }

  if (issues.length === 0) {
    if (leadRetention < rules.min_lead_rate_retention_vs_champion) {
      qualityFailures.push({
        field: "lead_rate_retention_vs_champion",
        expected: `>= ${rules.min_lead_rate_retention_vs_champion}`,
        actual: leadRetention,
      });
    }
    if (closeRetention < rules.min_close_rate_retention_vs_champion) {
      qualityFailures.push({
        field: "close_rate_retention_vs_champion",
        expected: `>= ${rules.min_close_rate_retention_vs_champion}`,
        actual: closeRetention,
      });
    }
    if (spamRate > rules.max_spam_flag_rate) {
      qualityFailures.push({
        field: "spam_flag_rate",
        expected: `<= ${rules.max_spam_flag_rate}`,
        actual: spamRate,
      });
    }
    if (input.no_quality_regression === false || input.quality_regression_observed === true) {
      qualityFailures.push({
        field: "no_quality_regression",
        expected: "true or omitted with passing aggregate metrics",
        actual: false,
      });
    }
  }

  return { issues, qualityFailures, evidence };
}

function emptyValidation() {
  return { issues: [], qualityFailures: [], evidence: {} };
}

function qualityRules(config) {
  return {
    min_lead_rate_retention_vs_champion: Number(config.quality_rules?.min_lead_rate_retention_vs_champion ?? 0.8),
    min_close_rate_retention_vs_champion: Number(config.quality_rules?.min_close_rate_retention_vs_champion ?? 0.8),
    max_spam_flag_rate: Number(config.quality_rules?.max_spam_flag_rate ?? 0.05),
    blocked_metadata_keys: config.quality_rules?.blocked_metadata_keys ?? ["phone", "email", "line_user_id", "customer_name", "address", "payment", "card"],
  };
}

function exampleInput(config) {
  const rules = qualityRules(config);
  return {
    reviewer: "owner",
    pii_checked: "yes",
    evidence_ref: "aggregate-quality-review/week0-cta-text",
    lead_rate_retention_vs_champion: rules.min_lead_rate_retention_vs_champion,
    close_rate_retention_vs_champion: rules.min_close_rate_retention_vs_champion,
    spam_flag_rate: Math.min(rules.max_spam_flag_rate, 0.05),
    low_quality_flag_count: 0,
    notes: "Aggregate-only. Do not include names, phone numbers, emails, LINE IDs, messages, payment data, or customer rows.",
  };
}

function renderReport(status) {
  const issueRows = status.issues.length > 0
    ? status.issues.map((issue) => `| ${issue.field ?? "n/a"} | ${issue.message ?? "n/a"} |`).join("\n")
    : "| none | none |";
  const regressionRows = status.quality_regressions.length > 0
    ? status.quality_regressions.map((item) => `| ${item.field ?? "n/a"} | ${item.expected ?? "n/a"} | ${item.actual ?? "n/a"} |`).join("\n")
    : "| none | none | none |";

  return `# 3Q Growth Loop Owner Quality Review

BLUF: ${status.decision}. This is a local aggregate quality-review gate only. It does not write events, mutate customer data, promote a challenger, change public links, deploy, post, push LINE, process payments, or delete data.

Generated: ${status.generated_at}
Mode: ${status.mode}
Status: ${status.status}
Owner sample gate: ${status.owner_sample_gate_status}
Input exists: ${status.input_exists ? "yes" : "no"}
Sample threshold met: ${status.sample_threshold_met ? "yes" : "no"}
Sample-rate win candidate: ${status.sample_rate_win_candidate ? "yes" : "no"}
Quality guard: ${status.quality_guard_status}
No quality regression: ${status.no_quality_regression === null ? "not evaluated" : status.no_quality_regression ? "yes" : "no"}
Challenger final win rule met: ${status.challenger_win_rule_met ? "yes" : "no"}
Promotion review queued: ${status.promotion_review_queued ? "yes" : "no"}
Promotion performed: no
External effect: no

## Evidence

| field | value |
|---|---|
| evidence_ref | ${status.evidence.evidence_ref ?? "n/a"} |
| reviewer | ${status.evidence.reviewer ?? "n/a"} |
| pii_checked | ${status.evidence.pii_checked ? "yes" : "n/a"} |
| lead_rate_retention_vs_champion | ${formatValue(status.evidence.lead_rate_retention_vs_champion)} |
| close_rate_retention_vs_champion | ${formatValue(status.evidence.close_rate_retention_vs_champion)} |
| spam_flag_rate | ${formatValue(status.evidence.spam_flag_rate)} |
| low_quality_flag_count | ${formatValue(status.evidence.low_quality_flag_count)} |

## Thresholds

| rule | threshold |
|---|---:|
| min_lead_rate_retention_vs_champion | ${status.thresholds.min_lead_rate_retention_vs_champion} |
| min_close_rate_retention_vs_champion | ${status.thresholds.min_close_rate_retention_vs_champion} |
| max_spam_flag_rate | ${status.thresholds.max_spam_flag_rate} |

## Issues

| field | message |
|---|---|
${issueRows}

## Quality Regressions

| field | expected | actual |
|---|---|---|
${regressionRows}

## Safety

- Example template written: yes, ${status.example_path}
- Live input files created: no
- data/lp_events.jsonl write performed: no
- Approval queue write performed: no
- Public link change performed: no
- Production deploy performed: no
- Formal post or LINE push performed: no
- Customer data, payment, delete actions performed: no
`;
}

function parseArgs(args) {
  const options = {};
  for (const arg of args) {
    if (arg.startsWith("--config=")) options.config = arg.slice("--config=".length);
    if (arg.startsWith("--owner-sample-gate=")) options.ownerSampleGate = arg.slice("--owner-sample-gate=".length);
    if (arg.startsWith("--sample-gate=")) options.ownerSampleGate = arg.slice("--sample-gate=".length);
    if (arg.startsWith("--input=")) options.input = arg.slice("--input=".length);
    if (arg.startsWith("--status=")) options.status = arg.slice("--status=".length);
    if (arg.startsWith("--report=")) options.report = arg.slice("--report=".length);
    if (arg.startsWith("--example=")) options.example = arg.slice("--example=".length);
    if (arg.startsWith("--real-events=")) options.realEvents = arg.slice("--real-events=".length);
  }
  return options;
}

function walk(value, visitor, prefix = "") {
  if (!isPlainObject(value) && !Array.isArray(value)) return;
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item])
    : Object.entries(value);
  for (const [key, child] of entries) {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    visitor(keyPath, child);
    if (isPlainObject(child) || Array.isArray(child)) {
      walk(child, visitor, keyPath);
    }
  }
}

function sensitiveMatch(value) {
  const text = String(value);
  if (!text) return null;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) return "email";
  if (/\b(?:\+?886[- ]?)?0?9\d{2}[- ]?\d{3}[- ]?\d{3}\b/.test(text)) return "phone";
  if (/\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}\b/.test(text)) return "card-like number";
  if (/\bline[_ -]?user[_ -]?id\b/i.test(text)) return "LINE user id";
  return null;
}

function parseFiniteNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value === "string" && value.trim()) return Number(value.trim());
  return Number.NaN;
}

function parseOptionalInteger(value) {
  if (value === undefined || value === null || value === "") return 0;
  const number = Number(value);
  return Number.isInteger(number) ? number : Number.NaN;
}

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatValue(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return "n/a";
  return String(value);
}

function resolvePath(value, fallback) {
  if (!value) return fallback;
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
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

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main();
