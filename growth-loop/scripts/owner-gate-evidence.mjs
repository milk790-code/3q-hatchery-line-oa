import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DEFAULT_LAUNCH_READINESS_PATH = path.join(ROOT, "launch_readiness.json");
const DEFAULT_INPUT_PATH = path.join(ROOT, "owner_gate_evidence.json");
const DEFAULT_EXAMPLE_PATH = path.join(ROOT, "owner_gate_evidence.example.json");
const DEFAULT_STATUS_PATH = path.join(ROOT, "data", "owner_gate_evidence_status.json");
const DEFAULT_REPORT_PATH = path.join(ROOT, "owner_gate_evidence.md");
const CHAMPION_GITHUB_HANDOFF_PATH = path.join(ROOT, "data", "champion_github_handoff_status.json");

const GATE_CONTRACTS = {
  remote_d1_create_and_migrate: {
    required: [
      "gate_id",
      "operator_alias",
      "executed_at",
      "cloudflare_account_alias",
      "d1_database_name",
      "d1_database_id",
      "schema_applied_at",
      "recurring_aggregate_read_approved",
      "verification_ref",
      "rollback_ref",
    ],
    optional: ["notes_ref"],
  },
  candidate_worker_production_deploy: {
    required: [
      "gate_id",
      "operator_alias",
      "executed_at",
      "worker_name",
      "worker_url",
      "health_status",
      "verification_ref",
      "rollback_ref",
    ],
    optional: ["route_ref", "notes_ref"],
  },
  public_ab_small_traffic_link: {
    required: [
      "gate_id",
      "operator_alias",
      "executed_at",
      "champion_url",
      "public_surface",
      "ab_url",
      "traffic_share_challenger",
      "rollback_url",
      "verification_ref",
    ],
    optional: ["notes_ref"],
  },
  github_repo_branch_pr: {
    required: [
      "gate_id",
      "operator_alias",
      "executed_at",
      "repo_url",
      "branch_name",
      "pr_url",
      "commit_ref",
    ],
    optional: ["notes_ref"],
  },
  formal_posts_line_push_payment_customer_data: {
    required: [
      "gate_id",
      "operator_alias",
      "executed_at",
      "manual_only_acknowledged",
      "notes_ref",
    ],
    optional: [],
    manualOnly: true,
  },
};

async function main() {
  const now = new Date();
  const paths = parseArgs(process.argv.slice(2));
  await mkdir(path.dirname(paths.status), { recursive: true });

  const launchReadiness = await readJson(paths.launchReadiness);
  const championGithubHandoff = await readJson(CHAMPION_GITHUB_HANDOFF_PATH);
  const expectedGithub = {
    repo_url: championGithubHandoff.repository?.url,
    branch_name: championGithubHandoff.local_branch?.name,
    commit_ref: championGithubHandoff.local_branch?.commit,
  };
  const evidenceInput = await readEvidenceInput(paths.input);
  const example = buildExampleInput(now, expectedGithub);
  const status = buildStatus(launchReadiness, evidenceInput, now, paths, expectedGithub);
  const report = renderReport(status, now, paths);

  await writeJson(paths.example, example);
  await writeJson(paths.status, status);
  await writeFile(paths.report, report);

  console.log(JSON.stringify(status, null, 2));

  if (evidenceInput.exists && !status.ok) {
    process.exitCode = 1;
  }
}

function parseArgs(args) {
  const paths = {
    launchReadiness: DEFAULT_LAUNCH_READINESS_PATH,
    input: DEFAULT_INPUT_PATH,
    example: DEFAULT_EXAMPLE_PATH,
    status: DEFAULT_STATUS_PATH,
    report: DEFAULT_REPORT_PATH,
  };

  for (const arg of args) {
    if (arg.startsWith("--launch-readiness=")) paths.launchReadiness = path.resolve(ROOT, arg.slice("--launch-readiness=".length));
    if (arg.startsWith("--input=")) paths.input = path.resolve(ROOT, arg.slice("--input=".length));
    if (arg.startsWith("--example=")) paths.example = path.resolve(ROOT, arg.slice("--example=".length));
    if (arg.startsWith("--status=")) paths.status = path.resolve(ROOT, arg.slice("--status=".length));
    if (arg.startsWith("--report=")) paths.report = path.resolve(ROOT, arg.slice("--report=".length));
  }

  return paths;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readEvidenceInput(inputPath) {
  try {
    const value = await readJson(inputPath);
    return {
      exists: true,
      path: inputPath,
      value,
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return {
      exists: false,
      path: inputPath,
      value: { evidence: [] },
    };
  }
}

function buildStatus(launchReadiness, input, now, paths, expectedGithub) {
  const evidenceRows = Array.isArray(input.value.evidence) ? input.value.evidence : [];
  const topLevelIssues = topLevelValidationIssues(input.value);
  const launchGateIds = new Set((launchReadiness.owner_gates ?? []).map((gate) => gate.id));
  const knownGateIds = new Set(Object.keys(GATE_CONTRACTS));
  const unknownEvidence = evidenceRows
    .filter((row) => typeof row?.gate_id !== "string" || !knownGateIds.has(row.gate_id) || !launchGateIds.has(row.gate_id))
    .map((row) => row?.gate_id ?? "missing_gate_id");
  const duplicateGateIds = duplicateValues(evidenceRows.map((row) => row?.gate_id).filter(Boolean));

  const gates = (launchReadiness.owner_gates ?? []).map((gate) => {
    const contract = GATE_CONTRACTS[gate.id] ?? {
      required: ["gate_id", "operator_alias", "executed_at"],
      optional: [],
    };
    const evidence = evidenceRows.find((row) => row?.gate_id === gate.id) ?? null;
    const missingFields = evidence
      ? contract.required.filter((field) => field !== "gate_id" && isBlank(evidence[field]))
      : contract.required.filter((field) => field !== "gate_id");
    const placeholderFields = evidence ? contract.required.filter((field) => looksPlaceholder(evidence[field])) : [];
    const allowedFields = new Set([...contract.required, ...contract.optional]);
    const unknownFields = evidence ? Object.keys(evidence).filter((field) => !allowedFields.has(field)) : [];
    const sensitiveIssues = evidence ? sensitiveIssuesForObject(evidence) : [];
    const fieldValidationErrors = evidence ? validateGateFields(gate.id, evidence, contract, expectedGithub) : [];
    const blockedReasons = [];

    if (!evidence) {
      blockedReasons.push("owner_gate_evidence.json has no evidence entry for this gate.");
    }
    if (gate.status !== "owner_approval_required" && gate.status !== "manual_only") {
      blockedReasons.push(`launch_gate_status=${gate.status}`);
    }
    if (missingFields.length > 0) {
      blockedReasons.push(`missing_fields=${missingFields.join(",")}`);
    }
    if (placeholderFields.length > 0) {
      blockedReasons.push(`placeholder_fields=${placeholderFields.join(",")}`);
    }
    if (unknownFields.length > 0) {
      blockedReasons.push(`unknown_fields=${unknownFields.join(",")}`);
    }
    if (sensitiveIssues.length > 0) {
      blockedReasons.push(`sensitive_or_customer_fields=${sensitiveIssues.map((issue) => issue.field_path).join(",")}`);
    }
    for (const issue of fieldValidationErrors) {
      blockedReasons.push(issue.message);
    }

    const evidenceValid = Boolean(evidence) && blockedReasons.length === 0;
    return {
      gate_id: gate.id,
      approval_id: gate.approval_id,
      risk_tier: gate.risk_tier,
      prepared_artifact: gate.prepared_artifact,
      gate_status: gate.status,
      evidence_detected: Boolean(evidence),
      evidence_valid: evidenceValid,
      ready_for_post_gate_verification: evidenceValid && contract.manualOnly !== true,
      recurring_aggregate_read_approved: gate.id === "remote_d1_create_and_migrate"
        && evidenceValid
        && evidence?.recurring_aggregate_read_approved === true,
      manual_only: contract.manualOnly === true,
      required_fields: contract.required,
      optional_fields: contract.optional,
      missing_fields: missingFields,
      placeholder_fields: placeholderFields,
      unknown_fields: unknownFields,
      sensitive_or_customer_fields: sensitiveIssues,
      field_validation_errors: fieldValidationErrors,
      blocked_reasons: blockedReasons,
      gate_external_effect: gate.external_effect === true,
      evidence_intake_external_effect: false,
      execution_policy: contract.manualOnly ? "manual_only_no_autorun" : "owner_executed_evidence_only",
      executed_by_this_script: false,
    };
  });

  const invalidEvidenceIssues = [];
  for (const gateId of unknownEvidence) {
    invalidEvidenceIssues.push({ code: "unknown_gate_id", gate_id: gateId });
  }
  for (const gateId of duplicateGateIds) {
    invalidEvidenceIssues.push({ code: "duplicate_gate_id", gate_id: gateId });
  }
  for (const issue of topLevelIssues) {
    invalidEvidenceIssues.push(issue);
  }

  const gateIssues = gates.flatMap((gate) => {
    if (!input.exists || !gate.evidence_detected) return [];
    return gate.blocked_reasons.map((reason) => ({ code: "invalid_gate_evidence", gate_id: gate.gate_id, reason }));
  });
  const issueCount = invalidEvidenceIssues.length + gateIssues.length;
  const readyGateCount = gates.filter((gate) => gate.ready_for_post_gate_verification).length;
  const evidenceGateCount = gates.filter((gate) => gate.evidence_detected).length;
  const nonManualGateCount = gates.filter((gate) => gate.manual_only !== true).length;
  const allNonManualReady = nonManualGateCount > 0 && readyGateCount === nonManualGateCount;
  const ok = !input.exists || issueCount === 0;

  return {
    ok,
    generated_at: now.toISOString(),
    status: statusName({ inputExists: input.exists, ok, readyGateCount, allNonManualReady }),
    mode: "owner_gate_evidence_intake",
    input_path: paths.input,
    input_exists: input.exists,
    example_input_path: paths.example,
    report_path: paths.report,
    launch_readiness_path: paths.launchReadiness,
    expected_github_target: expectedGithub,
    evidence_only: true,
    owner_decision_required: true,
    ready_gate_count: readyGateCount,
    evidence_gate_count: evidenceGateCount,
    non_manual_gate_count: nonManualGateCount,
    ready_for_post_gate_verification: allNonManualReady,
    issue_count: issueCount,
    invalid_evidence_issues: invalidEvidenceIssues,
    gate_issues: gateIssues,
    sensitive_evidence_detected: gates.some((gate) => gate.sensitive_or_customer_fields.length > 0),
    execution_performed: false,
    external_effect: false,
    remote_d1_create_performed: false,
    remote_d1_migration_performed: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    github_push_or_pr_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    gates,
    next_safe_action: nextSafeAction(input.exists, gates, ok),
    note: "Evidence intake validates owner-supplied, non-secret post-gate metadata only. It never deploys, posts, pushes, changes public links, touches LINE, mutates customer data, handles payment, or deletes data.",
  };
}

function topLevelValidationIssues(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [{ code: "invalid_top_level_object", field_path: "$" }];
  }
  const allowed = new Set(["generated_at", "purpose", "evidence"]);
  const issues = Object.keys(value)
    .filter((field) => !allowed.has(field))
    .map((field) => ({ code: "unknown_top_level_field", field_path: field }));
  if (!Array.isArray(value.evidence)) {
    issues.push({ code: "missing_evidence_array", field_path: "evidence" });
  }
  return issues;
}

function validateGateFields(gateId, evidence, contract, expectedGithub) {
  const issues = [];
  if (evidence.gate_id !== gateId) {
    issues.push({ field: "gate_id", code: "gate_id_mismatch", message: `gate_id must be ${gateId}.` });
  }
  if (evidence.operator_alias && !/^[A-Za-z0-9_.-]{2,40}$/.test(evidence.operator_alias)) {
    issues.push({ field: "operator_alias", code: "invalid_operator_alias", message: "operator_alias must be a non-PII alias using letters, numbers, dots, underscores, or hyphens." });
  }
  if (evidence.executed_at && !isIsoDateString(evidence.executed_at)) {
    issues.push({ field: "executed_at", code: "invalid_datetime", message: "executed_at must be an ISO datetime string." });
  }
  if (evidence.schema_applied_at && !isIsoDateString(evidence.schema_applied_at)) {
    issues.push({ field: "schema_applied_at", code: "invalid_datetime", message: "schema_applied_at must be an ISO datetime string." });
  }

  if (gateId === "remote_d1_create_and_migrate") {
    if (evidence.d1_database_id && !isUuidLike(evidence.d1_database_id)) {
      issues.push({ field: "d1_database_id", code: "invalid_d1_database_id", message: "d1_database_id must be a UUID-like Cloudflare D1 database id." });
    }
    if (evidence.d1_database_name && !isCloudflareResourceName(evidence.d1_database_name)) {
      issues.push({ field: "d1_database_name", code: "invalid_d1_database_name", message: "d1_database_name must be a safe Cloudflare resource name." });
    }
    if (typeof evidence.recurring_aggregate_read_approved !== "boolean") {
      issues.push({ field: "recurring_aggregate_read_approved", code: "invalid_recurring_aggregate_read_scope", message: "recurring_aggregate_read_approved must be an explicit boolean; false keeps scheduled D1 reads disabled without invalidating schema evidence." });
    }
  }

  if (gateId === "candidate_worker_production_deploy") {
    if (evidence.worker_url && !isHttpsUrl(evidence.worker_url)) {
      issues.push({ field: "worker_url", code: "invalid_worker_url", message: "worker_url must be an absolute https URL." });
    }
    if (evidence.worker_name && !isCloudflareResourceName(evidence.worker_name)) {
      issues.push({ field: "worker_name", code: "invalid_worker_name", message: "worker_name must be a safe Cloudflare Worker name." });
    }
    if (evidence.health_status && !["ok", "healthy", "pass"].includes(String(evidence.health_status).toLowerCase())) {
      issues.push({ field: "health_status", code: "invalid_health_status", message: "health_status must be ok, healthy, or pass." });
    }
  }

  if (gateId === "public_ab_small_traffic_link") {
    for (const field of ["champion_url", "ab_url", "rollback_url"]) {
      if (evidence[field] && !isHttpsUrl(evidence[field])) {
        issues.push({ field, code: `invalid_${field}`, message: `${field} must be an absolute https URL.` });
      }
    }
    if (evidence.traffic_share_challenger !== undefined && !isSmallTrafficShare(evidence.traffic_share_challenger)) {
      issues.push({ field: "traffic_share_challenger", code: "invalid_traffic_share", message: "traffic_share_challenger must be a number from 1 to 10." });
    }
  }

  if (gateId === "github_repo_branch_pr") {
    if (evidence.repo_url && !isGithubRepoUrl(evidence.repo_url)) {
      issues.push({ field: "repo_url", code: "invalid_repo_url", message: "repo_url must be a GitHub repository URL." });
    } else if (evidence.repo_url && evidence.repo_url !== expectedGithub.repo_url) {
      issues.push({ field: "repo_url", code: "unexpected_repo_url", message: "repo_url must match milk790-code/3q-hatchery-line-oa." });
    }
    if (evidence.pr_url && !isGithubPrUrl(evidence.pr_url)) {
      issues.push({ field: "pr_url", code: "invalid_pr_url", message: "pr_url must be a GitHub pull request URL." });
    } else if (evidence.pr_url && !/^https:\/\/github\.com\/milk790-code\/3q-hatchery-line-oa\/pull\/\d+$/.test(evidence.pr_url)) {
      issues.push({ field: "pr_url", code: "unexpected_pr_url", message: "pr_url must belong to milk790-code/3q-hatchery-line-oa." });
    }
    if (evidence.branch_name && !isSafeGitBranchName(evidence.branch_name)) {
      issues.push({ field: "branch_name", code: "invalid_branch_name", message: "branch_name must be a safe git branch name." });
    } else if (evidence.branch_name && evidence.branch_name !== expectedGithub.branch_name) {
      issues.push({ field: "branch_name", code: "unexpected_branch_name", message: "branch_name must match codex/3q-growth-loop-champion-v1." });
    }
    if (evidence.commit_ref && !/^[0-9a-f]{7,64}$/i.test(evidence.commit_ref)) {
      issues.push({ field: "commit_ref", code: "invalid_commit_ref", message: "commit_ref must be a 7 to 64 character git SHA." });
    } else if (evidence.commit_ref && evidence.commit_ref !== expectedGithub.commit_ref) {
      issues.push({ field: "commit_ref", code: "unexpected_commit_ref", message: "commit_ref must match the prepared Champion commit." });
    }
  }

  if (contract.manualOnly && evidence.manual_only_acknowledged !== true) {
    issues.push({ field: "manual_only_acknowledged", code: "manual_only_not_acknowledged", message: "manual_only_acknowledged must be true." });
  }

  return issues;
}

function sensitiveIssuesForObject(value, prefix = "") {
  const issues = [];
  if (!value || typeof value !== "object") return issues;
  for (const [field, fieldValue] of Object.entries(value)) {
    const fieldPath = prefix ? `${prefix}.${field}` : field;
    if (isSensitiveField(field) || looksSensitiveValue(fieldValue)) {
      issues.push({ field_path: fieldPath, code: "sensitive_or_customer_value" });
    }
    if (fieldValue && typeof fieldValue === "object") {
      issues.push(...sensitiveIssuesForObject(fieldValue, fieldPath));
    }
  }
  return issues;
}

function isSensitiveField(field) {
  return /token|secret|password|passwd|cookie|session|authorization|bearer|api[_-]?key|private[_-]?key|client[_-]?secret|phone|email|line[_-]?user|customer|lead|payment|card|order|refund|address|tax|invoice/i.test(field);
}

function looksSensitiveValue(value) {
  if (typeof value !== "string") return false;
  return /\b(?:sk|pk|pat|ghp|gho|github_pat|xoxb|xoxp|cf)-[A-Za-z0-9_-]{12,}/.test(value)
    || /Bearer\s+[A-Za-z0-9._-]{12,}/i.test(value)
    || /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/.test(value)
    || /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value);
}

function statusName({ inputExists, ok, readyGateCount, allNonManualReady }) {
  if (!inputExists) return "waiting_for_owner_evidence";
  if (!ok) return "blocked_invalid_owner_evidence";
  if (allNonManualReady) return "owner_evidence_validated_ready_for_post_gate_verification";
  if (readyGateCount > 0) return "partial_owner_evidence_validated";
  return "owner_evidence_detected_no_gate_ready";
}

function nextSafeAction(inputExists, gates, ok) {
  if (!inputExists) {
    return "Copy owner_gate_evidence.example.json to owner_gate_evidence.json only after owner-executed external gates are complete, then rerun npm run owner:evidence.";
  }
  if (!ok) {
    const firstIssueGate = gates.find((gate) => gate.evidence_detected && gate.blocked_reasons.length > 0);
    return firstIssueGate
      ? `Fix owner_gate_evidence.json for ${firstIssueGate.gate_id}: ${firstIssueGate.blocked_reasons[0]}`
      : "Fix owner_gate_evidence.json validation issues, then rerun npm run owner:evidence.";
  }
  const ready = gates.filter((gate) => gate.ready_for_post_gate_verification);
  if (ready.length > 0) {
    return `Run post-gate local verification for: ${ready.map((gate) => gate.gate_id).join(", ")}. Do not autorun external gates.`;
  }
  return "No post-gate verification is ready yet. Keep external gates in PreparedButBlocked.";
}

function buildExampleInput(now, expectedGithub) {
  return {
    generated_at: now.toISOString(),
    purpose: "Copy this file to owner_gate_evidence.json only after the owner manually completes an external gate. Keep secrets, customer data, payment data, LINE user IDs, and raw chat content out of this file.",
    evidence: [
      {
        gate_id: "remote_d1_create_and_migrate",
        operator_alias: "owner",
        executed_at: now.toISOString(),
        cloudflare_account_alias: "3q-production-account",
        d1_database_name: "3q-growth-loop-candidate",
        d1_database_id: "00000000-0000-4000-8000-000000000000",
        schema_applied_at: now.toISOString(),
        recurring_aggregate_read_approved: true,
        verification_ref: "wrangler remote SELECT count check, no customer rows included",
        rollback_ref: "Cloudflare dashboard owner review only; no automatic delete",
      },
      {
        gate_id: "candidate_worker_production_deploy",
        operator_alias: "owner",
        executed_at: now.toISOString(),
        worker_name: "3q-growth-loop-candidate",
        worker_url: "https://3q-growth-loop-candidate.example.workers.dev",
        health_status: "ok",
        verification_ref: "GET /health returned ok",
        rollback_ref: "Cloudflare dashboard rollback to previous owner-approved Worker version",
      },
      {
        gate_id: "public_ab_small_traffic_link",
        operator_alias: "owner",
        executed_at: now.toISOString(),
        champion_url: "https://example.com/3q-main",
        public_surface: "owner-approved small traffic surface",
        ab_url: "https://3q-growth-loop-candidate.example.workers.dev/ab/ab-week0-cta-text-001",
        traffic_share_challenger: 10,
        rollback_url: "https://example.com/3q-main",
        verification_ref: "Manual public surface check, no primary bio link change",
      },
      {
        gate_id: "github_repo_branch_pr",
        operator_alias: "owner",
        executed_at: now.toISOString(),
        repo_url: expectedGithub.repo_url,
        branch_name: expectedGithub.branch_name,
        pr_url: "https://github.com/milk790-code/3q-hatchery-line-oa/pull/1",
        commit_ref: expectedGithub.commit_ref,
      },
      {
        gate_id: "formal_posts_line_push_payment_customer_data",
        operator_alias: "owner",
        executed_at: now.toISOString(),
        manual_only_acknowledged: true,
        notes_ref: "Manual-only actions remain outside automation; no details or customer data stored here.",
      },
    ],
  };
}

function renderReport(status, now, paths) {
  const rows = status.gates
    .map((gate) => `| ${gate.gate_id} | ${gate.evidence_detected ? "yes" : "no"} | ${gate.evidence_valid ? "yes" : "no"} | ${gate.recurring_aggregate_read_approved ? "yes" : "no"} | ${gate.ready_for_post_gate_verification ? "yes" : "no"} | ${gate.blocked_reasons.join("; ") || "n/a"} |`)
    .join("\n");
  const issues = [...status.invalid_evidence_issues, ...status.gate_issues]
    .map((issue) => `- ${issue.gate_id ? `${issue.gate_id}: ` : ""}${issue.reason ?? issue.code}`)
    .join("\n") || "- n/a";

  return `# 3Q Growth Loop Owner Gate Evidence

BLUF: This is an evidence-only intake. It validates non-secret metadata after the owner manually completes external gates, but it does not execute D1, deploy Workers, change public links, push GitHub branches, post, push LINE, mutate customer data, touch payment, or delete data.

Generated: ${now.toISOString()}
Status: ${status.status}
OK: ${status.ok ? "yes" : "no"}
Input exists: ${status.input_exists ? "yes" : "no"}
Input path: ${path.relative(ROOT, paths.input)}
Example path: ${path.relative(ROOT, paths.example)}
Ready gate count: ${status.ready_gate_count}/${status.non_manual_gate_count}
Evidence only: yes
Execution performed: no
External effect: no

## Gate Evidence

| gate | evidence_detected | evidence_valid | recurring_aggregate_read | ready_for_post_gate_verification | blocked_reasons |
|---|---|---|---|---|---|
${rows}

## Issues

${issues}

## Safety Invariants

- Remote D1 create performed: no
- Remote D1 migration performed: no
- Production deploy performed: no
- Public link change performed: no
- GitHub push or PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no

## Next Safe Action

${status.next_safe_action}

## Recovery Rule

After the owner manually completes an external gate, copy owner_gate_evidence.example.json to owner_gate_evidence.json, fill only non-secret evidence metadata, and rerun:

\`\`\`zsh
npm run owner:evidence
npm run verify:artifacts
\`\`\`
`;
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function isBlank(value) {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function looksPlaceholder(value) {
  if (typeof value !== "string") return false;
  return /OWNER_|REPLACE_WITH|PLACEHOLDER|<OWNER|YOUR_|TODO|example\.com|00000000-0000-4000-8000-000000000000/i.test(value);
}

function isIsoDateString(value) {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

function isUuidLike(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isHttpsUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function isGithubRepoUrl(value) {
  if (typeof value !== "string") return false;
  return /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(value)
    || /^git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/.test(value);
}

function isGithubPrUrl(value) {
  return typeof value === "string" && /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/[1-9][0-9]*$/.test(value);
}

function isSafeGitBranchName(value) {
  if (typeof value !== "string") return false;
  if (value.length < 1 || value.length > 160) return false;
  if (value.startsWith("/") || value.endsWith("/") || value.startsWith("-") || value.endsWith(".")) return false;
  if (value.includes("..") || value.includes("//") || value.includes("@{")) return false;
  return !/[\s~^:?*[\]\\\x00-\x20\x7f]/.test(value);
}

function isCloudflareResourceName(value) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/i.test(value);
}

function isSmallTrafficShare(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 10;
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
