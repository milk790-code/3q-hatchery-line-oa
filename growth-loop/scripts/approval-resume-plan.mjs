import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DEFAULT_LAUNCH_READINESS_PATH = path.join(ROOT, "launch_readiness.json");
const DEFAULT_INPUT_PATH = path.join(ROOT, "owner_approval_input.json");
const DEFAULT_EXAMPLE_INPUT_PATH = path.join(ROOT, "owner_approval_input.example.json");
const DEFAULT_STATUS_PATH = path.join(ROOT, "data", "approval_resume_status.json");
const DEFAULT_PLAN_PATH = path.join(ROOT, "approval_resume_plan.md");

const REQUIRED_FIELDS = {
  remote_d1_create_and_migrate: ["approved_by", "approved_at", "cloudflare_account_alias", "d1_database_name", "d1_database_id"],
  candidate_worker_production_deploy: ["approved_by", "approved_at", "worker_name", "worker_url", "rollback_plan"],
  public_ab_small_traffic_link: ["approved_by", "approved_at", "champion_url", "public_surface", "rollback_url"],
  github_repo_branch_pr: ["approved_by", "approved_at", "repo_url", "branch_name"],
};

async function main() {
  const now = new Date();
  const paths = parseArgs(process.argv.slice(2));
  await mkdir(path.dirname(paths.status), { recursive: true });
  await mkdir(path.dirname(paths.example), { recursive: true });
  await mkdir(path.dirname(paths.plan), { recursive: true });
  const launchReadiness = JSON.parse(await readFile(paths.launchReadiness, "utf8"));
  const input = await readApprovalInput(paths.input);
  const exampleInput = buildExampleInput(now, launchReadiness);
  const resumeStatus = buildResumeStatus(launchReadiness, input, now, paths);
  const plan = renderResumePlan(launchReadiness, resumeStatus, input, now, paths);

  await writeJson(paths.example, exampleInput);
  await writeJson(paths.status, resumeStatus);
  await writeFile(paths.plan, plan);

  console.log(JSON.stringify(resumeStatus, null, 2));
}

function parseArgs(args) {
  const paths = {
    launchReadiness: DEFAULT_LAUNCH_READINESS_PATH,
    input: DEFAULT_INPUT_PATH,
    example: DEFAULT_EXAMPLE_INPUT_PATH,
    status: DEFAULT_STATUS_PATH,
    plan: DEFAULT_PLAN_PATH,
  };

  for (const arg of args) {
    if (arg.startsWith("--launch-readiness=")) paths.launchReadiness = path.resolve(ROOT, arg.slice("--launch-readiness=".length));
    if (arg.startsWith("--input=")) paths.input = path.resolve(ROOT, arg.slice("--input=".length));
    if (arg.startsWith("--example=")) paths.example = path.resolve(ROOT, arg.slice("--example=".length));
    if (arg.startsWith("--status=")) paths.status = path.resolve(ROOT, arg.slice("--status=".length));
    if (arg.startsWith("--plan=")) paths.plan = path.resolve(ROOT, arg.slice("--plan=".length));
  }

  return paths;
}

async function readApprovalInput(inputPath) {
  try {
    const raw = await readFile(inputPath, "utf8");
    return {
      exists: true,
      path: inputPath,
      value: JSON.parse(raw),
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return {
      exists: false,
      path: inputPath,
      value: {
        approvals: [],
      },
    };
  }
}

function buildResumeStatus(launchReadiness, input, now, paths) {
  const approvals = Array.isArray(input.value.approvals) ? input.value.approvals : [];
  const sensitiveIssues = approvalSensitiveIssues(approvals);
  const ownerGatePlans = launchReadiness.owner_gates.map((gate) => {
    const approval = approvals.find((item) => item.gate_id === gate.id) ?? null;
    const requiredFields = REQUIRED_FIELDS[gate.id] ?? ["approved_by", "approved_at"];
    const missingFields = approval ? requiredFields.filter((field) => !approval[field]) : requiredFields;
    const placeholderFields = approval ? requiredFields.filter((field) => looksPlaceholder(approval[field])) : [];
    const gateSensitiveIssues = sensitiveIssues.filter((issue) => issue.gate_id === gate.id);
    const gateValidationIssues = approval ? approvalValidationIssues(gate.id, approval) : [];
    const blockedReasons = [];
    if (!approval) {
      blockedReasons.push("owner_approval_input.json has no approval entry for this gate.");
    }
    if (gate.status !== "owner_approval_required") {
      blockedReasons.push(`gate_status=${gate.status}; execution is not automated.`);
    }
    if (missingFields.length > 0) {
      blockedReasons.push(`missing_fields=${missingFields.join(",")}`);
    }
    if (placeholderFields.length > 0) {
      blockedReasons.push(`placeholder_fields=${placeholderFields.join(",")}`);
    }
    if (gateSensitiveIssues.length > 0) {
      blockedReasons.push(`sensitive_approval_fields=${gateSensitiveIssues.map((issue) => issue.field).join(",")}`);
    }
    for (const issue of gateValidationIssues) {
      blockedReasons.push(issue.message);
    }
    if (approval?.d1_database_id === "00000000-0000-0000-0000-000000000000") {
      blockedReasons.push("d1_database_id is still the placeholder value.");
    }
    if (gate.id === "public_ab_small_traffic_link" && approval?.champion_url && !/^https?:\/\//.test(approval.champion_url)) {
      blockedReasons.push("champion_url must be an absolute http(s) URL.");
    }

    return {
      gate_id: gate.id,
      approval_id: gate.approval_id,
      risk_tier: gate.risk_tier,
      prepared_artifact: gate.prepared_artifact,
      owner_approval_detected: Boolean(approval),
      required_fields: requiredFields,
      missing_fields: missingFields,
      placeholder_fields: placeholderFields,
      sensitive_approval_fields: gateSensitiveIssues.map((issue) => issue.field),
      field_validation_errors: gateValidationIssues,
      ready_for_owner_execution: Boolean(approval) && blockedReasons.length === 0,
      blocked_reasons: blockedReasons,
      resume_command_preview: gate.resume_commands,
      external_effect: true,
      executed: false,
      execution_policy: "dry_run_plan_only",
    };
  });

  const readyCount = ownerGatePlans.filter((item) => item.ready_for_owner_execution).length;

  return {
    generated_at: now.toISOString(),
    status: readyCount > 0 ? "owner_approval_detected_plan_only" : "prepared_but_blocked",
    input_path: paths.input,
    input_exists: input.exists,
    example_input_path: paths.example,
    plan_path: paths.plan,
    owner_decision_required: true,
    sensitive_approval_detected: sensitiveIssues.length > 0,
    sensitive_approval_issues: sensitiveIssues,
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
    ready_gate_count: readyCount,
    owner_gate_plans: ownerGatePlans,
    note: "This script only prepares a resume plan. It never runs remote D1, wrangler deploy, GitHub push/PR, public link changes, posting, LINE, payment, customer-data, or delete actions.",
  };
}

function approvalSensitiveIssues(approvals) {
  const issues = [];
  for (const approval of approvals) {
    const gateId = typeof approval.gate_id === "string" ? approval.gate_id : "unknown_gate";
    for (const [field, value] of Object.entries(approval)) {
      if (field === "gate_id") continue;
      if (isSensitiveField(field) || looksSecretValue(value)) {
        issues.push({ gate_id: gateId, field, code: "sensitive_approval_value" });
      }
    }
  }
  return issues;
}

function isSensitiveField(field) {
  return /token|secret|password|passwd|cookie|session|authorization|bearer|api[_-]?key|private[_-]?key|client[_-]?secret/i.test(field);
}

function looksSecretValue(value) {
  if (typeof value !== "string") return false;
  return /\b(?:sk|pk|pat|ghp|gho|github_pat|xoxb|xoxp|cf)-[A-Za-z0-9_-]{12,}/.test(value)
    || /Bearer\s+[A-Za-z0-9._-]{12,}/i.test(value)
    || /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/.test(value);
}

function approvalValidationIssues(gateId, approval) {
  const issues = [];
  if (approval.approved_at && !isIsoDateString(approval.approved_at)) {
    issues.push({ field: "approved_at", code: "invalid_datetime", message: "approved_at must be an ISO datetime string." });
  }

  if (gateId === "remote_d1_create_and_migrate") {
    if (approval.d1_database_id && !isUuidLike(approval.d1_database_id)) {
      issues.push({ field: "d1_database_id", code: "invalid_d1_database_id", message: "d1_database_id must be a UUID-like Cloudflare D1 database id." });
    }
    if (approval.d1_database_name && !isCloudflareResourceName(approval.d1_database_name)) {
      issues.push({ field: "d1_database_name", code: "invalid_d1_database_name", message: "d1_database_name must be a safe Cloudflare resource name." });
    }
  }

  if (gateId === "candidate_worker_production_deploy") {
    if (approval.worker_url && !isHttpUrl(approval.worker_url)) {
      issues.push({ field: "worker_url", code: "invalid_worker_url", message: "worker_url must be an absolute http(s) URL." });
    }
    if (approval.worker_name && !isCloudflareResourceName(approval.worker_name)) {
      issues.push({ field: "worker_name", code: "invalid_worker_name", message: "worker_name must be a safe Cloudflare Worker name." });
    }
  }

  if (gateId === "public_ab_small_traffic_link") {
    if (approval.champion_url && !isHttpUrl(approval.champion_url)) {
      issues.push({ field: "champion_url", code: "invalid_champion_url", message: "champion_url must be an absolute http(s) URL." });
    }
    if (approval.rollback_url && !isHttpUrl(approval.rollback_url)) {
      issues.push({ field: "rollback_url", code: "invalid_rollback_url", message: "rollback_url must be an absolute http(s) URL." });
    }
  }

  if (gateId === "github_repo_branch_pr") {
    if (approval.repo_url && !isGithubRepoUrl(approval.repo_url)) {
      issues.push({ field: "repo_url", code: "invalid_repo_url", message: "repo_url must be a GitHub repository URL." });
    } else if (approval.repo_url && !isExpectedChampionRepo(approval.repo_url)) {
      issues.push({ field: "repo_url", code: "unexpected_repo_url", message: "repo_url must target milk790-code/3q-hatchery-line-oa for the prepared Champion commit." });
    }
    if (approval.branch_name && !isSafeGitBranchName(approval.branch_name)) {
      issues.push({ field: "branch_name", code: "invalid_branch_name", message: "branch_name must be a safe git branch name." });
    } else if (approval.branch_name && approval.branch_name !== "codex/3q-growth-loop-champion-v1") {
      issues.push({ field: "branch_name", code: "unexpected_branch_name", message: "branch_name must match codex/3q-growth-loop-champion-v1." });
    }
  }

  return issues;
}

function isIsoDateString(value) {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

function isUuidLike(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isHttpUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isGithubRepoUrl(value) {
  if (typeof value !== "string") return false;
  return /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(value)
    || /^git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/.test(value);
}

function isExpectedChampionRepo(value) {
  return /^(?:https:\/\/github\.com\/|git@github\.com:)milk790-code\/3q-hatchery-line-oa(?:\.git)?$/.test(value);
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

function looksPlaceholder(value) {
  if (typeof value !== "string") return false;
  return /OWNER_|REPLACE_WITH|PLACEHOLDER|<OWNER|YOUR_|EXAMPLE_|TODO/i.test(value);
}

function buildExampleInput(now, launchReadiness) {
  const defaults = Object.fromEntries((launchReadiness.owner_gates ?? []).map((gate) => [gate.id, gate.approval_defaults ?? {}]));
  return {
    generated_at: now.toISOString(),
    purpose: "Copy this file to owner_approval_input.json only after the owner approves specific external gates. Keep secrets out of this file.",
    approvals: [
      {
        gate_id: "remote_d1_create_and_migrate",
        approved_by: "OWNER_NAME",
        approved_at: now.toISOString(),
        cloudflare_account_alias: "OWNER_APPROVED_ACCOUNT_ALIAS",
        d1_database_name: defaults.remote_d1_create_and_migrate?.d1_database_name ?? "3q-growth-loop-candidate",
        d1_database_id: defaults.remote_d1_create_and_migrate?.d1_database_id ?? "REPLACE_WITH_REAL_D1_DATABASE_ID",
      },
      {
        gate_id: "candidate_worker_production_deploy",
        approved_by: "OWNER_NAME",
        approved_at: now.toISOString(),
        worker_name: "3q-growth-loop-candidate",
        worker_url: "https://OWNER_APPROVED_WORKER_URL",
        rollback_plan: "Use Cloudflare dashboard rollback or redeploy previous approved revision.",
      },
      {
        gate_id: "public_ab_small_traffic_link",
        approved_by: "OWNER_NAME",
        approved_at: now.toISOString(),
        champion_url: "https://OWNER_APPROVED_CURRENT_CHAMPION_URL",
        public_surface: "OWNER_APPROVED_SMALL_TRAFFIC_SURFACE",
        rollback_url: "https://OWNER_APPROVED_PREVIOUS_PUBLIC_URL",
      },
      {
        gate_id: "github_repo_branch_pr",
        approved_by: "OWNER_NAME",
        approved_at: now.toISOString(),
        repo_url: defaults.github_repo_branch_pr?.repo_url ?? "https://github.com/milk790-code/3q-hatchery-line-oa.git",
        branch_name: defaults.github_repo_branch_pr?.branch_name ?? "codex/3q-growth-loop-champion-v1",
      },
    ],
  };
}

function renderResumePlan(launchReadiness, resumeStatus, input, now, paths) {
  const rows = resumeStatus.owner_gate_plans
    .map((gate) => `| ${gate.gate_id} | ${gate.risk_tier} | ${gate.owner_approval_detected ? "yes" : "no"} | ${gate.ready_for_owner_execution ? "yes" : "no"} | ${gate.blocked_reasons.join("; ") || "n/a"} |`)
    .join("\n");

  const commandSections = resumeStatus.owner_gate_plans
    .map((gate) => `## ${gate.gate_id}

Ready for owner execution: ${gate.ready_for_owner_execution ? "yes" : "no"}
Execution policy: ${gate.execution_policy}
External effect: yes
Executed by this script: no
Blocked reasons: ${gate.blocked_reasons.join("; ") || "n/a"}

\`\`\`zsh
${gate.resume_command_preview.length > 0 ? gate.resume_command_preview.join("\n") : "# Manual-only gate. No automated command preview."}
\`\`\`
`)
    .join("\n");

  return `# 3Q Growth Loop Approval Resume Plan

BLUF: This is a dry-run resume plan. It validates whether owner approval input exists and lists the next commands, but it does not execute remote D1, production deploy, GitHub push/PR, public link changes, posting, LINE, payment, customer-data, or delete actions.

Generated: ${now.toISOString()}
Launch readiness status: ${launchReadiness.status}
Approval input exists: ${input.exists ? "yes" : "no"}
Approval input path: ${path.relative(ROOT, paths.input)}
Example input path: ${path.relative(ROOT, paths.example)}
Ready gate count: ${resumeStatus.ready_gate_count}
Execution performed: no
Sensitive approval detected: ${resumeStatus.sensitive_approval_detected ? "yes" : "no"}

## Gate Status

| gate | tier | approval_detected | ready | blocked_reasons |
|---|---:|---|---|---|
${rows}

## Command Preview

${commandSections}

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

## Recovery Rule

After the owner approves a gate, copy owner_approval_input.example.json to owner_approval_input.json, fill only non-secret approval metadata, rerun:

\`\`\`zsh
npm run approval:plan
npm run verify:artifacts
\`\`\`

Then execute only the owner-approved command block manually or in a separately approved deploy turn.
`;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
