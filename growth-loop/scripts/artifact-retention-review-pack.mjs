import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const RETENTION_STATUS_PATH = path.join(ROOT, "data", "artifact_retention_status.json");
const OUTPUT_JSON = path.join(ROOT, "artifact_retention_review_pack.json");
const OUTPUT_MD = path.join(ROOT, "artifact_retention_review_pack.md");
const STATUS_PATH = path.join(ROOT, "data", "artifact_retention_review_status.json");

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
  const retention = await readJson(RETENTION_STATUS_PATH);
  const sections = retention.sections ?? [];
  const reviewSections = sections.map(buildReviewSection);
  const reviewRequired = reviewSections.some((section) => section.review_required);
  const highPriority = reviewSections
    .filter((section) => section.review_required)
    .sort((a, b) => b.cleanup_candidate_count - a.cleanup_candidate_count || b.total_bytes - a.total_bytes);
  const nextOwnerActions = buildNextOwnerActions(reviewSections);
  const payload = {
    ok: true,
    generated_at: generatedAt.toISOString(),
    mode: "artifact_retention_review_pack_local_only",
    status: reviewRequired ? "owner_review_recommended" : "within_review_budget",
    source_status_path: relative(RETENTION_STATUS_PATH),
    report_path: relative(OUTPUT_MD),
    json_path: relative(OUTPUT_JSON),
    status_path: relative(STATUS_PATH),
    source_generated_at: retention.generated_at ?? null,
    source_status: retention.status ?? "unknown",
    source_warning_count: retention.warning_count ?? 0,
    total_bytes: retention.total_bytes ?? 0,
    total_human: retention.total_human ?? "0 B",
    cleanup_candidate_count: retention.cleanup_candidate_count ?? 0,
    cleanup_candidates_reviewed_count: reviewSections.reduce((sum, section) => sum + section.preview_candidates.length, 0),
    section_count: reviewSections.length,
    review_required: reviewRequired,
    highest_priority_section_id: highPriority[0]?.id ?? null,
    sections: reviewSections,
    next_owner_actions: nextOwnerActions,
    review_open_targets: [
      "artifact_retention.md",
      "data/artifact_retention_status.json",
      "artifact_retention_review_pack.md",
      "artifact_retention_review_pack.json",
      "github_export/bundles",
      "archive",
      "logs",
    ],
    acceptance_checks_after_owner_cleanup: [
      "npm run artifacts:retention",
      "npm run artifacts:retention-review",
      "npm run owner:console",
      "node scripts/verify-artifacts.mjs",
    ],
    cleanup_execution_policy: "owner_only_manual_after_review",
    cleanup_command_generated: false,
    cleanup_command_executed: false,
    filesystem_mutation_performed: false,
    live_data_touched: false,
    blocked_actions: [
      "automatic_cleanup",
      "delete_github_export_bundles",
      "delete_weekly_archives",
      "delete_logs",
      "compress_or_move_artifacts_without_owner_approval",
    ],
    ...RED_LINE_FALSE,
    note: "Local review pack only. It converts retention monitor output into owner review priorities and never creates cleanup commands or mutates files.",
  };

  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeJson(OUTPUT_JSON, payload);
  await writeJson(STATUS_PATH, compactStatus(payload));
  await writeFile(OUTPUT_MD, renderReport(payload));
  console.log(JSON.stringify(compactStatus(payload), null, 2));
}

function buildReviewSection(section) {
  const thresholds = section.thresholds ?? {};
  const reviewRequired = (section.warning_count ?? 0) > 0 || (section.cleanup_candidate_count ?? 0) > 0;
  const overCountBudget = Number.isFinite(thresholds.count_warn) && section.item_count > thresholds.count_warn;
  const overBytesBudget = Number.isFinite(thresholds.bytes_warn) && section.total_bytes > thresholds.bytes_warn;
  return {
    id: section.id,
    label: section.label,
    path: section.path,
    item_type: section.item_type,
    item_count: section.item_count ?? 0,
    total_bytes: section.total_bytes ?? 0,
    total_human: section.total_human ?? "0 B",
    keep_latest_recommended: thresholds.keep_latest_recommended ?? null,
    count_warn: thresholds.count_warn ?? null,
    bytes_warn: thresholds.bytes_warn ?? null,
    over_count_budget: Boolean(overCountBudget),
    over_bytes_budget: Boolean(overBytesBudget),
    warning_count: section.warning_count ?? 0,
    cleanup_candidate_count: section.cleanup_candidate_count ?? 0,
    review_required: reviewRequired,
    owner_decision_required: reviewRequired,
    recommended_decision: reviewRequired
      ? `Keep the newest ${thresholds.keep_latest_recommended ?? "review-approved"} ${section.item_type ?? "items"} and manually review older local-only artifacts.`
      : "No owner cleanup review needed for this section.",
    newest_item: section.newest_item ?? null,
    oldest_item: section.oldest_item ?? null,
    preview_candidates: (section.cleanup_candidates ?? []).slice(0, 8).map((candidate) => ({
      path: candidate.path,
      human: candidate.human,
      modified_at: candidate.modified_at,
      owner_only: true,
    })),
    cleanup_candidates_truncated: Boolean(section.cleanup_candidates_truncated),
    manual_review_only: true,
    cleanup_command_generated: false,
    cleanup_command_executed: false,
    delete_action_performed: false,
    external_effect: false,
  };
}

function buildNextOwnerActions(reviewSections) {
  const sectionsNeedingReview = reviewSections.filter((section) => section.review_required);
  if (sectionsNeedingReview.length === 0) {
    return [
      {
        id: "keep_monitoring",
        priority: "P2",
        summary: "Keep artifact retention monitor in the weekly loop.",
        artifact: "artifact_retention.md",
        owner_only: false,
      },
    ];
  }
  return sectionsNeedingReview.map((section, index) => ({
    id: `review_${section.id}`,
    priority: index === 0 ? "P1" : "P2",
    summary: `Review ${section.label}: ${section.item_count} items, ${section.total_human}, ${section.cleanup_candidate_count} owner-only cleanup candidates.`,
    artifact: "artifact_retention.md",
    open_path: section.path,
    recommended_keep_latest: section.keep_latest_recommended,
    owner_only: true,
  }));
}

function renderReport(payload) {
  const sectionRows = payload.sections
    .map((section) => `| ${section.label} | ${section.item_count} | ${section.total_human} | ${section.warning_count} | ${section.cleanup_candidate_count} | ${section.keep_latest_recommended ?? "n/a"} | ${section.owner_decision_required ? "yes" : "no"} |`)
    .join("\n");
  const actionRows = payload.next_owner_actions
    .map((action) => `| ${action.priority} | ${action.id} | ${action.summary} | ${action.owner_only ? "yes" : "no"} |`)
    .join("\n");
  const candidateRows = payload.sections
    .flatMap((section) => section.preview_candidates.map((candidate) => ({
      section: section.label,
      ...candidate,
    })))
    .map((candidate) => `| ${candidate.section} | ${candidate.path} | ${candidate.human} | ${candidate.modified_at} |`)
    .join("\n");

  return `# Artifact Retention Review Pack

BLUF: ${payload.status}. The weekly engine is locally healthy, but artifact growth needs owner review before it slows the 7-day loop. This pack does not create cleanup commands and does not mutate files.

Generated: ${payload.generated_at}
Mode: ${payload.mode}
Source: ${payload.source_status_path}
Total local artifact footprint: ${payload.total_human}
Warnings: ${payload.source_warning_count}
Owner cleanup candidates: ${payload.cleanup_candidate_count}
Review required: ${payload.review_required ? "yes" : "no"}

## Sections

| section | items | total size | warnings | owner-only candidates | keep latest | owner decision |
|---|---:|---:|---:|---:|---:|---|
${sectionRows}

## Owner Review Queue

| priority | action | summary | owner-only |
|---|---|---|---|
${actionRows}

## Candidate Preview

These are preview rows only. Review in Finder before any manual cleanup decision.

| section | path | size | modified |
|---|---|---:|---|
${candidateRows || "| none | none | n/a | n/a |"}

## After Owner Cleanup

Run these local checks only after the owner manually reviews and changes local artifacts:

${payload.acceptance_checks_after_owner_cleanup.map((command) => `- \`${command}\``).join("\n")}

## Safety

- Cleanup command generated: no
- Cleanup command executed: no
- Filesystem mutation performed: no
- External effect: no
- Production deploy performed: no
- GitHub push / PR performed: no
- Formal post performed: no
- LINE push performed: no
- Customer-data mutation performed: no
- Payment action performed: no
- Delete action performed: no
`;
}

function compactStatus(payload) {
  return {
    ok: payload.ok,
    generated_at: payload.generated_at,
    mode: payload.mode,
    status: payload.status,
    source_status_path: payload.source_status_path,
    report_path: payload.report_path,
    json_path: payload.json_path,
    section_count: payload.section_count,
    review_required: payload.review_required,
    highest_priority_section_id: payload.highest_priority_section_id,
    total_human: payload.total_human,
    warning_count: payload.source_warning_count,
    cleanup_candidate_count: payload.cleanup_candidate_count,
    cleanup_candidates_reviewed_count: payload.cleanup_candidates_reviewed_count,
    next_owner_action_count: payload.next_owner_actions.length,
    cleanup_execution_policy: payload.cleanup_execution_policy,
    cleanup_command_generated: false,
    cleanup_command_executed: false,
    filesystem_mutation_performed: false,
    live_data_touched: false,
    ...RED_LINE_FALSE,
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function relative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join(path.posix.sep);
}

main().catch(async (error) => {
  const status = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "artifact_retention_review_pack_local_only",
    status: "failed",
    error: error instanceof Error ? error.message : "unknown_error",
    cleanup_command_generated: false,
    cleanup_command_executed: false,
    filesystem_mutation_performed: false,
    live_data_touched: false,
    ...RED_LINE_FALSE,
  };
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeJson(STATUS_PATH, status);
  console.error(JSON.stringify(status, null, 2));
  process.exitCode = 1;
});
