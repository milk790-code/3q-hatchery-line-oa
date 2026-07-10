import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(ROOT, "integrations", "3q-site", "champion-integration.config.json");
const STATUS_PATH = path.join(ROOT, "data", "champion_local_branch_status.json");
const REPORT_PATH = path.join(ROOT, "champion_local_branch.md");

async function main() {
  const generatedAt = new Date();
  const prepare = process.argv.includes("--prepare");
  const refreshRemote = process.argv.includes("--refresh-remote");
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const repo = config.source_repo_path;
  const worktree = config.local_release_worktree;
  const branch = config.local_release_branch;
  const sourcePath = config.source_path;
  const workflowPath = config.deployment_workflow_path;
  const patchPath = path.join(ROOT, config.generated_patch);
  const candidatePath = path.join(ROOT, config.generated_worker);
  const previousStatus = await readOptionalJson(STATUS_PATH);

  await access(repo);
  await access(patchPath);
  await access(candidatePath);
  const sourceStatusBefore = await git(repo, ["status", "--porcelain=v1"]);
  let branchCreated = false;
  let worktreeCreated = false;
  let commitCreated = false;

  let branchCommit = await localBranchCommit(repo, branch);
  let registration = await registeredWorktree(repo, worktree);

  if (prepare && !branchCommit) {
    if (await exists(worktree)) {
      throw new Error(`Refusing to reuse unregistered path: ${worktree}`);
    }
    await mkdir(path.dirname(worktree), { recursive: true });
    await git(repo, ["worktree", "add", "-b", branch, worktree, config.expected_commit]);
    branchCreated = true;
    worktreeCreated = true;
    branchCommit = await localBranchCommit(repo, branch);
    registration = await registeredWorktree(repo, worktree);
  } else if (prepare && branchCommit && !registration) {
    if (await exists(worktree)) {
      throw new Error(`Refusing to reuse unregistered path: ${worktree}`);
    }
    await mkdir(path.dirname(worktree), { recursive: true });
    await git(repo, ["worktree", "add", worktree, branch]);
    worktreeCreated = true;
    registration = await registeredWorktree(repo, worktree);
  }

  if (prepare) {
    assert(registration?.branch === `refs/heads/${branch}`, "Worktree branch registration mismatch.");
    const currentStatus = await git(worktree, ["status", "--porcelain=v1"]);
    assert(currentStatus.trim() === "", "Release worktree must be clean before preparation.");
    const candidate = await readFile(candidatePath);
    const worktreeSource = path.join(worktree, sourcePath);
    const current = await readFile(worktreeSource);
    const currentSha = sha256(current);
    const candidateSha = sha256(candidate);

    if (currentSha !== candidateSha) {
      const head = (await git(worktree, ["rev-parse", "HEAD"])).trim();
      assert(head === config.expected_commit, `Release branch is not at the locked source commit: ${head}`);
      await git(worktree, ["apply", "--check", patchPath]);
      await git(worktree, ["apply", patchPath]);
      await runRequired(process.execPath, ["--check", worktreeSource], worktree);
      await git(worktree, ["diff", "--check"]);
      await git(worktree, ["add", "--", sourcePath]);
      const staged = lines(await git(worktree, ["diff", "--cached", "--name-only"]));
      assert(staged.length === 1 && staged[0] === sourcePath, "Only the locked Worker source may be committed.");
      await git(worktree, ["commit", "-m", config.local_release_commit_message]);
      commitCreated = true;
    }
  }

  branchCommit = await localBranchCommit(repo, branch);
  registration = await registeredWorktree(repo, worktree);
  const branchPrepared = Boolean(branchCommit && registration);
  const worktreeStatus = branchPrepared ? await git(worktree, ["status", "--porcelain=v1"]) : "";
  const committedSource = branchPrepared ? await readFile(path.join(worktree, sourcePath)) : null;
  const candidate = await readFile(candidatePath);
  const parentCommit = branchPrepared ? (await git(worktree, ["rev-parse", "HEAD^"])).trim() : null;
  const range = `${config.expected_commit}..HEAD`;
  const commitStack = branchPrepared
    ? parseCommitStack(await git(worktree, ["log", "--reverse", "--format=%H%x09%s", range]))
    : [];
  const workerCommits = branchPrepared
    ? lines(await git(worktree, ["log", "--format=%H", range, "--", sourcePath]))
    : [];
  const workflowCommits = branchPrepared && workflowPath
    ? lines(await git(worktree, ["log", "--format=%H", range, "--", workflowPath]))
    : [];
  // `git log -- <path>` is newest-first. Keep the original source-locked Worker
  // commit as the provenance anchor while allowing one later scoped hardening commit.
  const workerCommit = workerCommits.at(-1) ?? null;
  const workerHardeningCommits = workerCommits.slice(0, -1).reverse();
  const workflowCommit = workflowCommits[0] ?? null;
  const workerCommitParent = workerCommit ? (await git(worktree, ["rev-parse", `${workerCommit}^`])).trim() : null;
  const changedPaths = branchPrepared
    ? lines(await git(worktree, ["diff", "--name-only", config.expected_commit, "HEAD"])).sort()
    : [];
  const commitSubject = branchPrepared ? (await git(worktree, ["log", "-1", "--format=%s"])).trim() : null;
  const branchDescendsFromSourceLock = branchPrepared
    ? (await run("git", ["merge-base", "--is-ancestor", config.expected_commit, "HEAD"], worktree)).code === 0
    : false;
  const mergeCommits = branchPrepared
    ? lines(await git(worktree, ["rev-list", "--merges", range]))
    : [];
  const workflowChanged = Boolean(workflowPath && changedPaths.includes(workflowPath));
  const workflowSource = workflowChanged ? await readFile(path.join(worktree, workflowPath), "utf8") : "";
  const allowedChangedPaths = [sourcePath, workflowPath].filter(Boolean).sort();
  const commitPathSets = branchPrepared
    ? await Promise.all(commitStack.map(async ({ commit }) => ({
      commit,
      paths: lines(await git(worktree, ["diff-tree", "--no-commit-id", "--name-only", "-r", commit])).sort(),
    })))
    : [];
  const commitsIndividuallyScoped = commitPathSets.every(({ paths }) =>
    paths.length >= 1 && paths.every((changedPath) => allowedChangedPaths.includes(changedPath))
  );
  const workflowCommitSubject = workflowCommit
    ? (await git(worktree, ["log", "-1", "--format=%s", workflowCommit])).trim()
    : null;
  const changedPathsScoped = changedPaths.includes(sourcePath)
    && changedPaths.every((changedPath) => allowedChangedPaths.includes(changedPath))
    && changedPaths.length >= 1
    && changedPaths.length <= allowedChangedPaths.length;
  const workflowChangeValid = !workflowChanged || (
    workflowCommits.length === 1
    && workflowCommitSubject === config.deployment_workflow_commit_message
    && workflowSource.includes("/workers/scripts/${WORKER_NAME}")
    && workflowSource.includes("${api}/settings")
    && workflowSource.includes("${api}/content")
    && workflowSource.includes(`REQUIRED_BINDING: ${config.collector_env}`)
    && workflowSource.includes("binding_fingerprint")
  );

  let remoteObservation = previousStatus?.remote_observation ?? {
    checked_at: null,
    branch_present: null,
    read_performed: false,
  };
  if (refreshRemote) {
    const remote = await git(repo, ["ls-remote", "--heads", "origin", `refs/heads/${branch}`]);
    const remoteCommit = remote.trim().split(/\s+/)[0] || null;
    remoteObservation = {
      checked_at: generatedAt.toISOString(),
      branch_present: remote.trim().length > 0,
      commit: remoteCommit,
      read_performed: true,
    };
  }

  let remoteBranchState = remoteObservation.branch_present === true ? "present_unverified" : "absent";
  let remoteBranchMatchesReviewedHistory = remoteObservation.branch_present !== true;
  let localAheadCount = remoteObservation.branch_present === true ? null : commitStack.length;
  if (remoteObservation.branch_present === true && remoteObservation.commit) {
    remoteBranchMatchesReviewedHistory = (await run(
      "git",
      ["merge-base", "--is-ancestor", remoteObservation.commit, branchCommit],
      worktree,
    )).code === 0;
    if (remoteBranchMatchesReviewedHistory) {
      localAheadCount = Number((await git(worktree, ["rev-list", "--count", `${remoteObservation.commit}..HEAD`])).trim());
      remoteBranchState = localAheadCount === 0 ? "up_to_date_with_local" : "reviewed_ancestor_local_ahead";
    } else {
      remoteBranchState = "diverged_or_unknown";
    }
  }
  remoteObservation = {
    ...remoteObservation,
    state: remoteBranchState,
    local_ahead_count: localAheadCount,
  };

  const sourceStatusAfter = await git(repo, ["status", "--porcelain=v1"]);
  const originMainCommit = (await git(repo, ["rev-parse", "origin/main"])).trim();
  const integrationAlreadyMerged = sha256(candidate) === config.expected_sha256
    && originMainCommit === config.expected_commit;
  const checks = {
    branch_present: integrationAlreadyMerged || Boolean(branchCommit),
    worktree_registered: integrationAlreadyMerged || Boolean(registration),
    worktree_branch_matches: integrationAlreadyMerged || registration?.branch === `refs/heads/${branch}`,
    branch_descends_from_source_lock: integrationAlreadyMerged || branchDescendsFromSourceLock,
    commit_stack_scoped: integrationAlreadyMerged || (commitStack.length >= 1 && commitsIndividuallyScoped),
    no_merge_commits: mergeCommits.length === 0,
    worker_commit_parent_matches_source_lock: integrationAlreadyMerged || (workerCommits.length >= 1 && workerCommitParent === config.expected_commit),
    committed_source_matches_candidate: committedSource ? sha256(committedSource) === sha256(candidate) : false,
    changed_paths_scoped: integrationAlreadyMerged || changedPathsScoped,
    worker_commit_subject_matches: integrationAlreadyMerged || commitStack.some((item) => item.commit === workerCommit && item.subject === config.local_release_commit_message),
    deployment_workflow_change_valid: workflowChangeValid,
    worktree_clean: worktreeStatus.trim() === "",
    source_working_tree_unchanged: sourceStatusAfter === sourceStatusBefore,
    remote_branch_matches_reviewed_history: remoteBranchMatchesReviewedHistory,
  };
  const ok = Object.values(checks).every(Boolean);
  const status = {
    ok,
    generated_at: generatedAt.toISOString(),
    mode: "champion_local_feature_branch_review",
    status: ok
      ? integrationAlreadyMerged ? "integration_already_merged_at_source_lock" : "local_feature_commit_ready_owner_push_pr_gate"
      : "local_feature_branch_not_ready",
    source_lock: {
      repository: config.source_repository,
      repo_path: repo,
      commit: config.expected_commit,
      source_path: sourcePath,
      origin_main_commit: originMainCommit,
      integration_already_merged: integrationAlreadyMerged,
    },
    local_branch: {
      name: branch,
      commit: branchCommit,
      parent_commit: parentCommit,
      commit_subject: commitSubject,
      source_lock_base_commit: config.expected_commit,
      worker_commit: workerCommit,
      worker_commit_parent: workerCommitParent,
      worker_hardening_commits: workerHardeningCommits,
      workflow_commit: workflowCommit,
      commit_count: commitStack.length,
      commits: commitStack,
      worktree,
      changed_paths: changedPaths,
      committed_source_sha256: committedSource ? sha256(committedSource) : null,
      candidate_sha256: sha256(candidate),
    },
    checks,
    actions_this_run: {
      prepare_requested: prepare,
      branch_created: branchCreated,
      worktree_created: worktreeCreated,
      local_commit_created: commitCreated,
    },
    remote_observation: remoteObservation,
    source_status_before: lines(sourceStatusBefore),
    source_status_after: lines(sourceStatusAfter),
    outputs: {
      report: "champion_local_branch.md",
      status: "data/champion_local_branch_status.json",
    },
    external_read_performed: refreshRemote,
    external_github_write_observed_before_this_run: remoteObservation.branch_present === true,
    local_git_metadata_write_performed: branchCreated || worktreeCreated || commitCreated,
    local_commit_performed: commitCreated,
    git_push_performed: false,
    github_push_or_pr_performed: false,
    external_effect: false,
    data_lp_events_write_performed: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };

  await writeJson(STATUS_PATH, status);
  await writeFile(REPORT_PATH, renderReport(status));
  console.log(JSON.stringify(status, null, 2));
  if (!ok) process.exitCode = 1;
}

async function localBranchCommit(repo, branch) {
  const result = await run("git", ["show-ref", "--verify", "--hash", `refs/heads/${branch}`], repo);
  return result.code === 0 ? result.stdout.trim() : null;
}

async function registeredWorktree(repo, expectedPath) {
  const output = await git(repo, ["worktree", "list", "--porcelain"]);
  const blocks = output.trim().split(/\n\n+/).filter(Boolean);
  for (const block of blocks) {
    const record = Object.fromEntries(block.split(/\r?\n/).map((line) => {
      const index = line.indexOf(" ");
      return index === -1 ? [line, true] : [line.slice(0, index), line.slice(index + 1)];
    }));
    if (path.resolve(String(record.worktree)) === path.resolve(expectedPath)) return record;
  }
  return null;
}

async function git(cwd, args) {
  const result = await run("git", args, cwd);
  if (result.code !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}

async function runRequired(command, args, cwd) {
  const result = await run(command, args, cwd);
  if (result.code !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}

async function run(command, args, cwd) {
  try {
    const result = await execFileAsync(command, args, { cwd, maxBuffer: 8 * 1024 * 1024 });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      code: Number.isInteger(error.code) ? error.code : 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? error.message ?? "unknown_error",
    };
  }
}

function renderReport(status) {
  const remote = status.remote_observation ?? {};
  const commitRows = (status.local_branch.commits ?? [])
    .map((item) => `- ${item.commit}: ${item.subject}`)
    .join("\n") || "- none";
  return `# Champion Local Feature Branch

BLUF: ${status.ok ? "The source-locked Champion release stack is scoped, clean, and ready for owner review." : "The local feature branch is not review-ready."} This audit performed no push, PR, deploy, public-link change, or external send. Prior remote state is reported separately.

- Branch: ${status.local_branch.name}
- Local head: ${status.local_branch.commit ?? "not prepared"}
- Source lock base: ${status.local_branch.source_lock_base_commit ?? "n/a"}
- Worker commit: ${status.local_branch.worker_commit ?? "n/a"}
- Workflow commit: ${status.local_branch.workflow_commit ?? "none"}
- Worktree: ${status.local_branch.worktree}
- Changed paths: ${status.local_branch.changed_paths.join(", ") || "n/a"}
- Candidate SHA-256: ${status.local_branch.candidate_sha256}
- Committed SHA-256: ${status.local_branch.committed_source_sha256 ?? "n/a"}
- Remote branch observed: ${remote.branch_present === null ? "not checked" : (remote.branch_present ? "present" : "absent")}
- Remote commit: ${remote.commit ?? "n/a"}
- Remote state: ${remote.state ?? "unknown"}
- Local commits ahead of remote: ${remote.local_ahead_count ?? "unknown"}
- GitHub push / PR performed by this audit: no
- Production deploy performed by this audit: no

## Commit Stack

${commitRows}

## Checks

${Object.entries(status.checks).map(([name, ok]) => `- ${name}: ${ok ? "pass" : "fail"}`).join("\n")}

## Owner Gate

Review this release stack and champion_release_owner_packet.md. Any remaining branch update, opening a PR, merging, or deploying remains an explicit owner action. A remote ancestor may already exist; this audit never treats prior external state as owner approval.
`;
}

function parseCommitStack(value) {
  return lines(value).map((line) => {
    const separator = line.indexOf("\t");
    return separator === -1
      ? { commit: line, subject: "" }
      : { commit: line.slice(0, separator), subject: line.slice(separator + 1) };
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function lines(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main().catch(async (error) => {
  const failed = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "champion_local_feature_branch_review",
    status: "local_feature_branch_failed",
    error: error instanceof Error ? error.message : "unknown_error",
    external_effect: false,
    git_push_performed: false,
    github_push_or_pr_performed: false,
    production_deploy_performed: false,
    public_link_change_performed: false,
    formal_post_performed: false,
    line_push_performed: false,
    customer_data_mutation_performed: false,
    payment_action_performed: false,
    delete_action_performed: false,
  };
  await writeJson(STATUS_PATH, failed);
  console.error(error);
  process.exitCode = 1;
});
