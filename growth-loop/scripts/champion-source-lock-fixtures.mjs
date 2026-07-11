import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  gitBlobSha,
  inspectChampionSourceLock,
  sha256,
} from "./lib/champion-source-lock.mjs";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "champion_source_lock_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "champion_source_lock_fixtures.md");

async function main() {
  const generatedAt = new Date().toISOString();
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "3q-champion-source-lock-fixtures-"));
  const repoPath = path.join(fixtureRoot, "repo");
  const sourcePath = "workers/3q-site/worker.js";
  const source = "export default { async fetch() { return new Response('fixture'); } };\n";
  const snapshotPath = path.join(fixtureRoot, "worker.snapshot.js");
  const results = [];

  try {
    await mkdir(path.join(repoPath, path.dirname(sourcePath)), { recursive: true });
    await writeFile(path.join(repoPath, sourcePath), source);
    await writeFile(snapshotPath, source);
    await git(repoPath, ["init", "-b", "main"]);
    await git(repoPath, ["config", "user.name", "3Q fixture"]);
    await git(repoPath, ["config", "user.email", "fixture@example.invalid"]);
    await git(repoPath, ["add", sourcePath]);
    await git(repoPath, ["commit", "-m", "fixture: source lock"]);
    const lockedCommit = await revParse(repoPath, "HEAD");
    const config = {
      expected_commit: lockedCommit,
      expected_blob_sha: gitBlobSha(source),
      expected_sha256: sha256(source),
      source_path: sourcePath,
      source_snapshot: snapshotPath,
    };

    const exact = await inspectChampionSourceLock({ config, repoPath, ref: "main", root: ROOT });
    results.push(check("exact_lock_passes", exact.releaseReady && exact.expectedTupleVerified));

    await writeFile(path.join(repoPath, "README.md"), "unrelated change\n");
    await git(repoPath, ["add", "README.md"]);
    await git(repoPath, ["commit", "-m", "fixture: unrelated descendant"]);
    const descendantCommit = await revParse(repoPath, "main");
    const descendant = await inspectChampionSourceLock({ config, repoPath, ref: "main", root: ROOT });
    results.push(check(
      "descendant_with_same_target_passes",
      descendant.releaseReady && descendant.observedRefCommit === descendantCommit && descendant.refFileMatchesLock,
    ));

    await git(repoPath, ["tag", "-a", "pinned-release", "-m", "fixture annotated tag", "main"]);
    const annotated = await inspectChampionSourceLock({ config, repoPath, ref: "pinned-release", root: ROOT });
    results.push(check(
      "annotated_ref_is_pinned_to_commit",
      annotated.releaseReady && annotated.observedRefCommit === descendantCommit,
    ));

    await writeFile(path.join(repoPath, "SECOND.md"), "another unrelated change\n");
    await git(repoPath, ["add", "SECOND.md"]);
    await git(repoPath, ["commit", "-m", "fixture: ref advances again"]);
    const advanced = await inspectChampionSourceLock({ config, repoPath, ref: "main", root: ROOT });
    results.push(check(
      "ref_advances_between_checks_with_same_target_passes",
      advanced.releaseReady && advanced.observedRefCommit !== descendant.observedRefCommit,
    ));

    const wrongSha = await inspectChampionSourceLock({
      config: { ...config, expected_sha256: "0".repeat(64) },
      repoPath,
      ref: "main",
      root: ROOT,
    });
    results.push(check(
      "blob_match_with_sha_mismatch_fails",
      !wrongSha.releaseReady && !wrongSha.expectedTupleVerified,
    ));

    const missingRepo = await inspectChampionSourceLock({
      config,
      repoPath: path.join(fixtureRoot, "missing-repo"),
      ref: "main",
      root: ROOT,
    });
    results.push(check(
      "missing_repo_fallback_is_unverified_and_blocked",
      !missingRepo.releaseReady && missingRepo.ancestryVerified === false && missingRepo.lockCommitIsAncestor === null,
    ));

    await writeFile(path.join(repoPath, sourcePath), `${source}// target drift\n`);
    await git(repoPath, ["add", sourcePath]);
    await git(repoPath, ["commit", "-m", "fixture: target drift"]);
    const drift = await inspectChampionSourceLock({ config, repoPath, ref: "main", root: ROOT });
    results.push(check(
      "descendant_target_drift_fails",
      !drift.releaseReady && drift.lockCommitIsAncestor === true && !drift.refFileMatchesLock,
    ));

    await git(repoPath, ["switch", "--orphan", "unrelated"]);
    await mkdir(path.join(repoPath, path.dirname(sourcePath)), { recursive: true });
    await writeFile(path.join(repoPath, sourcePath), source);
    await git(repoPath, ["add", sourcePath]);
    await git(repoPath, ["commit", "-m", "fixture: unrelated root with same target"]);
    const nonAncestor = await inspectChampionSourceLock({ config, repoPath, ref: "unrelated", root: ROOT });
    results.push(check(
      "non_ancestor_with_same_target_fails",
      !nonAncestor.releaseReady && nonAncestor.lockCommitIsAncestor === false && nonAncestor.refFileMatchesLock,
    ));

    const ok = results.every((result) => result.ok);
    const status = {
      ok,
      generated_at: generatedAt,
      mode: "isolated_local_champion_source_lock_fixtures",
      cases: results,
      external_effect: false,
      production_deploy_performed: false,
      github_push_or_pr_performed: false,
      delete_action_performed: false,
    };
    await writeOutputs(status);
    console.log(JSON.stringify(status, null, 2));
    if (!ok) process.exitCode = 1;
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

function check(id, ok) {
  return { id, ok: Boolean(ok) };
}

async function git(repoPath, args) {
  const { stdout } = await execFileAsync("git", args, { cwd: repoPath, maxBuffer: 2_000_000 });
  return stdout;
}

async function revParse(repoPath, ref) {
  return (await git(repoPath, ["rev-parse", "--verify", `${ref}^{commit}`])).trim();
}

async function writeOutputs(status) {
  await mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
  const rows = status.cases.map((item) => `| ${item.id} | ${item.ok ? "pass" : "fail"} |`).join("\n");
  await writeFile(REPORT_PATH, `# Champion Source Lock Fixtures\n\nBLUF: ${status.ok ? "PASS" : "FAIL"}. Git ref pinning, ancestry, target drift, lock-tuple integrity, and missing-repo fail-closed behavior were tested in an isolated temporary repository.\n\n| case | result |\n|---|---|\n${rows}\n\nExternal effect: no.\n`);
}

main().catch(async (error) => {
  const status = {
    ok: false,
    generated_at: new Date().toISOString(),
    mode: "isolated_local_champion_source_lock_fixtures",
    error: error instanceof Error ? error.message : String(error),
    cases: [],
    external_effect: false,
    production_deploy_performed: false,
    github_push_or_pr_performed: false,
    delete_action_performed: false,
  };
  await writeOutputs(status);
  console.error(error);
  process.exitCode = 1;
});
