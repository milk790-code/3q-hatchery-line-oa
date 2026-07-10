import { lstat, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "artifact_retention_status.json");
const REPORT_PATH = path.join(ROOT, "artifact_retention.md");

const THRESHOLDS = {
  github_export_bundles: {
    count_warn: 24,
    bytes_warn: 512 * 1024 * 1024,
    keep_latest_recommended: 12,
  },
  archive_snapshots: {
    count_warn: 16,
    bytes_warn: 1024 * 1024 * 1024,
    keep_latest_recommended: 12,
  },
  logs: {
    count_warn: 250,
    bytes_warn: 256 * 1024 * 1024,
    keep_latest_recommended: 120,
  },
};

const RED_LINE_FALSE = {
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

async function main() {
  const generatedAt = new Date();
  const githubExport = await summarizeNamedDirs("github_export/bundles", THRESHOLDS.github_export_bundles);
  const archive = await summarizeArchive("archive", THRESHOLDS.archive_snapshots);
  const logs = await summarizeFiles("logs", THRESHOLDS.logs);
  const sections = [githubExport, archive, logs];
  const warnings = sections.flatMap((section) => section.warnings);
  const cleanupCandidateCount = sections.reduce((sum, section) => sum + section.cleanup_candidate_count, 0);
  const cleanupCandidatePreview = sections.flatMap((section) => section.cleanup_candidates.map((candidate) => ({
    ...candidate,
    section: section.id,
  })));

  const status = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "artifact_retention_monitor_local_only",
    status: warnings.length > 0 ? "owner_cleanup_review_recommended" : "within_review_budget",
    report_path: REPORT_PATH,
    status_path: STATUS_PATH,
    thresholds: THRESHOLDS,
    total_bytes: sections.reduce((sum, section) => sum + section.total_bytes, 0),
    total_human: formatBytes(sections.reduce((sum, section) => sum + section.total_bytes, 0)),
    sections,
    warning_count: warnings.length,
    warnings,
    cleanup_candidate_count: cleanupCandidateCount,
    cleanup_candidates_preview_count: cleanupCandidatePreview.length,
    cleanup_candidates: cleanupCandidatePreview.slice(0, 80),
    cleanup_candidates_truncated: cleanupCandidateCount > cleanupCandidatePreview.length || cleanupCandidatePreview.length > 80,
    owner_review_required: warnings.length > 0,
    cleanup_execution_policy: "owner_only_manual_cleanup_after_review",
    blocked_actions: [
      "delete_github_export_bundles",
      "delete_weekly_archives",
      "delete_logs",
      "compress_or_move_artifacts_without_owner_approval",
    ],
    next_safe_action: warnings.length > 0
      ? "Review artifact_retention.md and decide whether to manually archive or delete old local-only artifacts. The monitor does not run cleanup commands."
      : "No cleanup review needed. Keep the monitor in the weekly loop.",
    cleanup_command_generated: false,
    cleanup_command_executed: false,
    ...RED_LINE_FALSE,
    note: "Local retention monitor only. It reads artifact sizes and counts, suggests owner review when local bundles grow, and never deletes, moves, compresses, uploads, deploys, posts, pushes, pays, mutates customer data, or changes public links.",
  };

  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));
}

async function summarizeNamedDirs(relativeDir, thresholds) {
  const absoluteDir = path.join(ROOT, relativeDir);
  const entries = await safeReaddir(absoluteDir);
  const dirs = [];
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const relativePath = path.posix.join(relativeDir, entry.name);
    const absolutePath = path.join(ROOT, relativePath);
    const stats = await lstat(absolutePath);
    dirs.push({
      path: relativePath,
      bytes: await sizeOfPath(absolutePath),
      modified_at: stats.mtime.toISOString(),
    });
  }
  dirs.sort((a, b) => a.path.localeCompare(b.path));
  return buildSection({
    id: relativeDir.replaceAll("/", "_"),
    label: relativeDir,
    path: relativeDir,
    item_type: "directory",
    items: dirs,
    thresholds,
  });
}

async function summarizeArchive(relativeDir, thresholds) {
  const absoluteDir = path.join(ROOT, relativeDir);
  const weeks = await safeReaddir(absoluteDir);
  const snapshots = [];
  for (const week of weeks.filter((item) => item.isDirectory())) {
    const weekDir = path.join(absoluteDir, week.name);
    const runs = await safeReaddir(weekDir);
    for (const run of runs.filter((item) => item.isDirectory())) {
      const relativePath = path.posix.join(relativeDir, week.name, run.name);
      const absolutePath = path.join(ROOT, relativePath);
      const stats = await lstat(absolutePath);
      snapshots.push({
        path: relativePath,
        week: week.name,
        bytes: await sizeOfPath(absolutePath),
        modified_at: stats.mtime.toISOString(),
      });
    }
  }
  snapshots.sort((a, b) => a.path.localeCompare(b.path));
  return buildSection({
    id: "archive_snapshots",
    label: relativeDir,
    path: relativeDir,
    item_type: "archive_snapshot",
    items: snapshots,
    thresholds,
  });
}

async function summarizeFiles(relativeDir, thresholds) {
  const absoluteDir = path.join(ROOT, relativeDir);
  const files = await collectFiles(absoluteDir, relativeDir);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return buildSection({
    id: "logs",
    label: relativeDir,
    path: relativeDir,
    item_type: "file",
    items: files,
    thresholds,
  });
}

function buildSection({ id, label, path: relativePath, item_type, items, thresholds }) {
  const totalBytes = items.reduce((sum, item) => sum + item.bytes, 0);
  const cleanupCount = Math.max(0, items.length - thresholds.keep_latest_recommended);
  const cleanupCandidates = items.slice(0, cleanupCount).map((item) => ({
    path: item.path,
    bytes: item.bytes,
    human: formatBytes(item.bytes),
    modified_at: item.modified_at,
    owner_only: true,
  }));
  const warnings = [];
  if (items.length > thresholds.count_warn) {
    warnings.push({
      id: `${id}_count_over_review_budget`,
      severity: "review",
      message: `${label} count ${items.length} exceeds review threshold ${thresholds.count_warn}.`,
      owner_only: true,
    });
  }
  if (totalBytes > thresholds.bytes_warn) {
    warnings.push({
      id: `${id}_bytes_over_review_budget`,
      severity: "review",
      message: `${label} uses ${formatBytes(totalBytes)}, above review threshold ${formatBytes(thresholds.bytes_warn)}.`,
      owner_only: true,
    });
  }
  return {
    id,
    label,
    path: relativePath,
    item_type,
    exists: true,
    item_count: items.length,
    total_bytes: totalBytes,
    total_human: formatBytes(totalBytes),
    newest_item: items.at(-1) ?? null,
    oldest_item: items[0] ?? null,
    thresholds,
    warning_count: warnings.length,
    warnings,
    cleanup_candidate_count: cleanupCandidates.length,
    cleanup_candidates: cleanupCandidates.slice(0, 20),
    cleanup_candidates_truncated: cleanupCandidates.length > 20,
    delete_action_performed: false,
    external_effect: false,
  };
}

async function collectFiles(absoluteDir, relativeDir) {
  const entries = await safeReaddir(absoluteDir);
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name);
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath, relativePath));
      continue;
    }
    if (!entry.isFile()) continue;
    const stats = await lstat(absolutePath);
    files.push({
      path: relativePath,
      bytes: stats.size,
      modified_at: stats.mtime.toISOString(),
    });
  }
  return files;
}

async function safeReaddir(absoluteDir) {
  try {
    return await readdir(absoluteDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function sizeOfPath(absolutePath) {
  const stats = await lstat(absolutePath);
  if (!stats.isDirectory()) return stats.size;
  let total = 0;
  const entries = await readdir(absolutePath, { withFileTypes: true });
  for (const entry of entries) {
    total += await sizeOfPath(path.join(absolutePath, entry.name));
  }
  return total;
}

function renderReport(status) {
  return `# Artifact Retention Monitor

BLUF: ${status.status}. Local artifacts currently use ${status.total_human}; ${status.warning_count} review warning(s) and ${status.cleanup_candidate_count} owner-only cleanup candidate(s) were found.

Generated: ${status.generated_at}
Mode: ${status.mode}
External effect: no
Delete action performed: no
Cleanup command generated: no
Cleanup command executed: no

## Summary

| area | count | size | warning | owner-only candidates |
|---|---:|---:|---:|---:|
${status.sections.map((section) => `| ${section.label} | ${section.item_count} | ${section.total_human} | ${section.warning_count} | ${section.cleanup_candidate_count} |`).join("\n")}

## Warnings

${status.warnings.length > 0 ? status.warnings.map((warning) => `- ${warning.id}: ${warning.message}`).join("\n") : "- none"}

## Owner-Only Cleanup Candidates

This monitor never deletes, moves, compresses, or uploads artifacts. Review these candidates manually if local disk pressure matters.

| section | path | size | modified |
|---|---|---:|---|
${status.cleanup_candidates.length > 0 ? status.cleanup_candidates.map((candidate) => `| ${candidate.section} | \`${candidate.path}\` | ${candidate.human} | ${candidate.modified_at} |`).join("\n") : "| none | n/a | n/a | n/a |"}

${status.cleanup_candidates_truncated ? "\nCandidate list is preview-only; section counts show the full owner-only candidate estimate.\n" : ""}

## Safety

- Owner review required: ${status.owner_review_required ? "yes" : "no"}
- Cleanup execution policy: ${status.cleanup_execution_policy}
- Blocked actions: ${status.blocked_actions.join(", ")}
- Production deploy performed: no
- Public link change performed: no
- GitHub push / PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
`;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

main().catch(async (error) => {
  const status = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "artifact_retention_monitor_local_only",
    status: "failed",
    error: error instanceof Error ? error.message : "unknown_error",
    cleanup_command_generated: false,
    cleanup_command_executed: false,
    ...RED_LINE_FALSE,
  };
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport({
    ...status,
    total_human: "0 B",
    warning_count: 1,
    warnings: [{ id: "artifact_retention_monitor_failed", message: status.error }],
    cleanup_candidate_count: 0,
    cleanup_candidates: [],
    cleanup_candidates_truncated: false,
    sections: [],
    owner_review_required: true,
    cleanup_execution_policy: "owner_only_manual_cleanup_after_review",
    blocked_actions: ["delete_github_export_bundles", "delete_weekly_archives", "delete_logs"],
  }));
  console.error(error);
  process.exitCode = 1;
});
