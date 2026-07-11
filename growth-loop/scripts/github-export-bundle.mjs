import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const EXPORT_ROOT = path.join(ROOT, "github_export");
const STATUS_PATH = path.join(ROOT, "data", "github_export_status.json");
const REPORT_PATH = path.join(ROOT, "github_export_manifest.md");

const SKIP_DIRS = new Set([
  ".git",
  ".wrangler",
  "archive",
  "github_export",
  "logs",
  "node_modules",
]);

const LIVE_OR_OWNER_INPUTS = new Set([
  "data/lp_events.jsonl",
  "data/lp_events.d1-local.jsonl",
  "data/funnel_aggregates.csv",
  "data/manual_conversions.csv",
  "data/source_capture/source_capture_ledger.filled.csv",
  "data/source_capture/sample_gate_ledger.filled.csv",
  "data/github_export_status.json",
  "github_export_manifest.md",
  "owner_approval_input.json",
  "owner_gate_evidence.json",
  "manual_publish_evidence.json",
  "output/playwright",
]);

async function main() {
  const generatedAt = new Date();
  const bundleName = `repo-ready-${stamp(generatedAt)}`;
  const bundleDir = path.join(EXPORT_ROOT, "bundles", bundleName);
  const repoDir = path.join(bundleDir, "repo");
  const manifestPath = path.join(bundleDir, "manifest.json");
  const importGuidePath = path.join(bundleDir, "README-GITHUB-IMPORT.md");

  const files = await collectFiles(ROOT);
  const copied = [];
  const missing = [];

  for (const relativePath of files) {
    const sourcePath = path.join(ROOT, relativePath);
    const targetPath = path.join(repoDir, relativePath);
    try {
      const content = await readFile(sourcePath);
      const sourceStat = await stat(sourcePath);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
      copied.push({
        path: relativePath,
        bytes: sourceStat.size,
        sha256: createHash("sha256").update(content).digest("hex"),
      });
    } catch (error) {
      if (error.code === "ENOENT") {
        missing.push(relativePath);
        continue;
      }
      throw error;
    }
  }

  const rootHash = createHash("sha256")
    .update(copied.map((file) => `${file.path}:${file.sha256}`).join("\n"))
    .digest("hex");

  const manifest = {
    ok: missing.length === 0 && copied.length > 0,
    generated_at: generatedAt.toISOString(),
    mode: "github_export_bundle_local_only",
    bundle_dir: bundleDir,
    repo_dir: repoDir,
    manifest_path: manifestPath,
    import_guide_path: importGuidePath,
    file_count: copied.length,
    total_bytes: copied.reduce((sum, file) => sum + file.bytes, 0),
    root_sha256: rootHash,
    missing_files: missing,
    excluded_live_or_owner_inputs: Array.from(LIVE_OR_OWNER_INPUTS).sort(),
    external_effect: false,
    git_init_performed: false,
    git_add_performed: false,
    git_commit_performed: false,
    git_remote_add_performed: false,
    git_push_or_pr_performed: false,
    github_push_or_pr_performed: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
    note: "Local copy-only GitHub export bundle. It prepares a repo-ready snapshot but does not run git init, commit, push, PR creation, deploy, post, LINE, payment, customer-data, or delete actions.",
    files: copied,
  };

  await writeJson(manifestPath, manifest);
  await writeFile(importGuidePath, renderImportGuide(manifest));
  await writeFile(REPORT_PATH, renderReport(manifest));
  await writeJson(STATUS_PATH, {
    ok: manifest.ok,
    generated_at: manifest.generated_at,
    mode: manifest.mode,
    bundle_dir: bundleDir,
    repo_dir: repoDir,
    manifest_path: manifestPath,
    import_guide_path: importGuidePath,
    report_path: REPORT_PATH,
    file_count: manifest.file_count,
    total_bytes: manifest.total_bytes,
    root_sha256: manifest.root_sha256,
    missing_files: missing,
    excluded_live_or_owner_inputs: manifest.excluded_live_or_owner_inputs,
    external_effect: false,
    git_init_performed: false,
    git_add_performed: false,
    git_commit_performed: false,
    git_remote_add_performed: false,
    git_push_or_pr_performed: false,
    github_push_or_pr_performed: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  });

  console.log(JSON.stringify({
    ok: manifest.ok,
    mode: manifest.mode,
    bundle_dir: bundleDir,
    repo_dir: repoDir,
    file_count: manifest.file_count,
    missing_files: missing,
    external_effect: false,
    github_push_or_pr_performed: false,
  }, null, 2));
}

async function collectFiles(root) {
  const files = [];
  await walk(root, "", files);
  return files.sort();
}

async function walk(root, relativeDir, files) {
  const absoluteDir = path.join(root, relativeDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDir.split(path.sep).join(path.posix.sep), entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || shouldSkipPath(relativePath)) {
        continue;
      }
      await walk(root, relativePath, files);
      continue;
    }
    if (!entry.isFile() || shouldSkipPath(relativePath)) {
      continue;
    }
    files.push(relativePath);
  }
}

function shouldSkipPath(relativePath) {
  const normalized = relativePath.split(path.sep).join(path.posix.sep);
  const base = path.posix.basename(normalized);
  return LIVE_OR_OWNER_INPUTS.has(normalized)
    || normalized.startsWith("data/real_data_intake/")
    || normalized.endsWith(".filled.csv")
    || normalized.endsWith(".local")
    || normalized.endsWith(".log")
    || normalized.includes("/.DS_Store")
    || base === ".DS_Store"
    || base === ".dev.vars";
}

function renderImportGuide(manifest) {
  return `# GitHub Import Guide

BLUF: This is a local repo-ready snapshot. It does not initialize git, commit, push, open a PR, deploy, post, send LINE, mutate customer data, process payments, or delete data.

Generated: ${manifest.generated_at}
Repo-ready folder: ${manifest.repo_dir}
Manifest: ${manifest.manifest_path}
Files: ${manifest.file_count}
Root sha256: ${manifest.root_sha256}

## Owner-Gated Import Commands

Run only after the owner confirms the target repository and branch.

\`\`\`zsh
cd "${manifest.repo_dir}"
git init
git checkout -b ang/3q-growth-loop-week0
git add .
git commit -m "Build 3Q growth loop Week 0 local engine"
git remote add origin <OWNER_APPROVED_GITHUB_REPO_URL>
git push -u origin ang/3q-growth-loop-week0
gh pr create --draft --title "3Q Growth Loop Week 0 local engine" --body-file github_handoff.md
\`\`\`

## Excluded Inputs

${manifest.excluded_live_or_owner_inputs.map((item) => `- ${item}`).join("\n")}

## Safety

- External effect: no
- Git init performed: no
- Git commit performed: no
- Git push / PR performed: no
- Production deploy performed: no
- Public link change performed: no
- LINE push performed: no
- Customer data mutation performed: no
- Payment action performed: no
- Delete action performed: no
`;
}

function renderReport(manifest) {
  const sampleRows = manifest.files
    .slice(0, 40)
    .map((file) => `| ${file.path} | ${file.bytes} | ${file.sha256} |`)
    .join("\n");

  return `# GitHub Export Bundle Manifest

BLUF: GitHub repo-ready bundle is prepared locally, but no git repo, commit, push, PR, deploy, post, LINE action, payment, customer-data mutation, or deletion was performed.

Generated: ${manifest.generated_at}
Mode: ${manifest.mode}
Bundle dir: ${manifest.bundle_dir}
Repo dir: ${manifest.repo_dir}
Manifest: ${manifest.manifest_path}
Import guide: ${manifest.import_guide_path}
Files copied: ${manifest.file_count}
Total bytes: ${manifest.total_bytes}
Root sha256: ${manifest.root_sha256}
External effect: no

## Excluded Live / Owner Inputs

${manifest.excluded_live_or_owner_inputs.map((item) => `- ${item}`).join("\n")}

## First 40 Files

| path | bytes | sha256 |
|---|---:|---|
${sampleRows}

## Owner-Gated Next Step

Review README-GITHUB-IMPORT.md inside the bundle, then approve a target repo before any git init, commit, push, or draft PR.
`;
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function stamp(date) {
  return date.toISOString().replace(/[-:.]/g, "").replace("Z", "Z");
}

main();
