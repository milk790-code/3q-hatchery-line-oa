import { lstat, opendir, readFile, realpath } from "node:fs/promises";
import { realpathSync } from "node:fs";
import path from "node:path";

const FINDINGS_FILE = "CLAUDE-REVIEW-FINDINGS-20260710.json";
const RESOLUTION_LEDGER_FILE = "review-resolution-ledger.json";
const WAIVER_LEDGER_FILE = "review-waiver-ledger.json";
const SOURCE_ROOTS = new Set([
  ".github",
  "config",
  "integrations",
  "launchd",
  "schema",
  "scripts",
  "src",
]);
const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".command",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".md",
  ".mjs",
  ".patch",
  ".plist",
  ".sh",
  ".sql",
  ".ts",
  ".txt",
  ".yaml",
  ".yml",
]);

const EXCLUDED_PREFIXES = new Map([
  ["node_modules", "dependency"],
  ["archive", "archive"],
  ["github_export", "generated"],
  ["output", "generated"],
  [".wrangler", "cache"],
  ["logs", "logs"],
]);

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

export function resolveProjectPath(root, relativePath, options = {}) {
  if (typeof relativePath !== "string" || relativePath.trim() === "") {
    throw new Error("relative path is required");
  }
  const canonicalRoot = realpathSync(root);
  const lexicalCandidate = path.resolve(canonicalRoot, relativePath);
  if (!isWithin(canonicalRoot, lexicalCandidate)) {
    throw new Error("path is outside project root");
  }
  if (options.requireExisting) {
    const canonicalCandidate = realpathSync(lexicalCandidate);
    if (!isWithin(canonicalRoot, canonicalCandidate)) {
      throw new Error("symlink resolves outside project root");
    }
    return canonicalCandidate;
  }
  return lexicalCandidate;
}

function classifyPath(relativePath) {
  const segments = relativePath.split("/");
  if (segments.includes("node_modules")) return "dependency";
  if (segments.includes(".wrangler")) return "cache";
  const [first] = segments;
  return EXCLUDED_PREFIXES.get(first) ?? "owned";
}

function isOwnedSource(relativePath) {
  const [first] = relativePath.split("/");
  return SOURCE_ROOTS.has(first) && SOURCE_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}

export async function inventoryWorkspace(root) {
  const canonicalRoot = await realpath(root);
  const categories = {
    owned: 0,
    dependency: 0,
    archive: 0,
    generated: 0,
    cache: 0,
    logs: 0,
  };
  const ownedSourceFiles = [];
  const allFiles = [];
  const stack = [canonicalRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    const directory = await opendir(current);
    for await (const entry of directory) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(canonicalRoot, absolute).split(path.sep).join("/");
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      const category = classifyPath(relative);
      const stats = category === "owned" || entry.isSymbolicLink() ? await lstat(absolute) : null;
      if (stats && !stats.isFile() && !stats.isSymbolicLink()) continue;
      if (!stats && !entry.isFile()) continue;
      categories[category] += 1;
      allFiles.push({
        path: relative,
        category,
        bytes: stats?.size ?? null,
        symlink: stats?.isSymbolicLink() ?? false,
      });
      if (category === "owned" && isOwnedSource(relative)) ownedSourceFiles.push(relative);
    }
  }

  allFiles.sort((a, b) => a.path.localeCompare(b.path));
  ownedSourceFiles.sort();
  return {
    root: canonicalRoot,
    total_files: allFiles.length,
    categories,
    owned_source_count: ownedSourceFiles.length,
    owned_source_files: ownedSourceFiles,
    files: allFiles,
  };
}

function normalizeStatus(value) {
  const status = String(value ?? "unresolved").trim().toLowerCase();
  return ["fixed", "resolved", "closed", "dismissed"].includes(status) ? "resolved" : "unresolved";
}

async function readOptionalLedger(root, filename) {
  try {
    const ledgerPath = resolveProjectPath(root, filename, { requireExisting: true });
    const parsed = JSON.parse(await readFile(ledgerPath, "utf8"));
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function validResolution(entry) {
  return entry?.status === "fixed"
    && typeof entry?.fixed_at === "string"
    && Array.isArray(entry?.evidence)
    && entry.evidence.length > 0;
}

function validWaiver(entry) {
  return entry?.status === "approved"
    && typeof entry?.approved_by === "string"
    && entry.approved_by.trim() !== ""
    && typeof entry?.approved_at === "string"
    && typeof entry?.expires_at === "string"
    && Date.parse(entry.expires_at) > Date.now()
    && typeof entry?.reason === "string"
    && entry.reason.trim() !== "";
}

export async function loadReviewFindings(root, filename = FINDINGS_FILE) {
  const findingsPath = resolveProjectPath(root, filename, { requireExisting: true });
  const raw = JSON.parse(await readFile(findingsPath, "utf8"));
  const confirmed = Array.isArray(raw.confirmed) ? raw.confirmed : [];
  const [resolutions, waivers] = await Promise.all([
    readOptionalLedger(root, RESOLUTION_LEDGER_FILE),
    readOptionalLedger(root, WAIVER_LEDGER_FILE),
  ]);
  const resolutionById = new Map(resolutions.filter(validResolution).map((entry) => [entry.finding_id, entry]));
  const waiverById = new Map(waivers.filter(validWaiver).map((entry) => [entry.finding_id, entry]));
  const items = confirmed.map((finding, index) => {
    const id = finding.id ?? `confirmed-${String(index + 1).padStart(3, "0")}`;
    const resolution = resolutionById.get(id);
    const waiver = waiverById.get(id);
    return ({
    id,
    file: String(finding.file ?? "unknown"),
    line: Number.isInteger(finding.line) ? finding.line : null,
    severity: String(finding.severity ?? "unknown").trim().toLowerCase(),
    category: String(finding.category ?? "uncategorized"),
    summary: String(finding.summary ?? ""),
    failure_scenario: String(finding.failure_scenario ?? ""),
    status: resolution ? "resolved" : waiver ? "waived" : normalizeStatus(finding.status),
    resolution: resolution ?? null,
    waiver: waiver ?? null,
  });
  });
  const unresolved = items.filter((item) => item.status === "unresolved");
  return {
    source: filename,
    generated_by: raw.generated_by ?? null,
    note: raw.note ?? null,
    counts: {
      confirmed: items.length,
      unresolved: unresolved.length,
      unresolved_high: unresolved.filter((item) => item.severity === "high").length,
      unresolved_medium: unresolved.filter((item) => item.severity === "medium").length,
      unresolved_low: unresolved.filter((item) => item.severity === "low").length,
    },
    items,
  };
}

export function calculateDeploymentGate({ findings, verification = {}, github = {}, live = {} }) {
  const blockers = [];
  const unresolvedHigh = Number(findings?.counts?.unresolved_high ?? 0);
  if (unresolvedHigh > 0) blockers.push(`${unresolvedHigh} unresolved confirmed high finding(s)`);

  const requiredSignals = ["tests_passed", "syntax_passed", "dependency_audit_passed"];
  for (const signal of requiredSignals) {
    if (verification[signal] !== true) blockers.push(`verification signal not green: ${signal}`);
  }

  let status = "DEPLOY_READY";
  if (blockers.length > 0) {
    status = unresolvedHigh > 0 && (github.merged === true || live.deployed === true)
      ? "POST_DEPLOY_REVIEW_REQUIRED"
      : "REVIEW_BLOCKED";
  }

  return {
    status,
    deploy_allowed: false,
    external_action_required: status === "DEPLOY_READY",
    blockers,
    warnings: Number(findings?.counts?.unresolved_medium ?? 0) > 0
      ? [`${findings.counts.unresolved_medium} unresolved confirmed medium finding(s)`]
      : [],
    rationale: status === "DEPLOY_READY"
      ? "Local review checks are green; deployment remains a human-authorized external action."
      : "Fail-closed review gate: deployment approval cannot be inferred from stale artifacts or partial checks.",
  };
}
