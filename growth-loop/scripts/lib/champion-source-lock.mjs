import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function inspectChampionSourceLock({ config, repoPath, ref, root }) {
  if (!(await exists(repoPath))) {
    const source = await readFile(resolveFromRoot(root, config.source_snapshot), "utf8");
    const blobSha = gitBlobSha(source);
    const sourceSha256 = sha256(source);
    return {
      source,
      sourceMode: "locked_snapshot_unverified",
      observedRefCommit: null,
      lockCommitIsAncestor: null,
      ancestryVerified: false,
      expectedTupleVerified: false,
      refFileMatchesLock: blobSha === config.expected_blob_sha && sourceSha256 === config.expected_sha256,
      blobSha,
      sourceSha256,
      lockedBlobSha: null,
      lockedSha256: null,
      releaseReady: false,
      failureReason: `Source repository is unavailable; ancestry for ${ref} cannot be verified.`,
    };
  }

  const lockedCommit = await revParseCommit(repoPath, config.expected_commit);
  assert(
    lockedCommit === config.expected_commit,
    `Configured source-lock commit did not resolve exactly: ${lockedCommit}`,
  );
  const lockedSource = await git(repoPath, ["show", `${lockedCommit}:${config.source_path}`]);
  const lockedBlobSha = gitBlobSha(lockedSource);
  const lockedSha256 = sha256(lockedSource);
  const expectedTupleVerified =
    lockedBlobSha === config.expected_blob_sha && lockedSha256 === config.expected_sha256;

  const observedRefCommit = await revParseCommit(repoPath, ref);
  const ancestry = await command(
    "git",
    ["merge-base", "--is-ancestor", lockedCommit, observedRefCommit],
    repoPath,
  );
  assert(
    ancestry.code === 0 || ancestry.code === 1,
    `Unable to verify source-lock ancestry: ${ancestry.output.trim() || `git exit ${ancestry.code}`}`,
  );
  const source = await git(repoPath, ["show", `${observedRefCommit}:${config.source_path}`]);
  const blobSha = gitBlobSha(source);
  const sourceSha256 = sha256(source);
  const lockCommitIsAncestor = ancestry.code === 0;
  const refFileMatchesLock =
    blobSha === config.expected_blob_sha && sourceSha256 === config.expected_sha256;

  return {
    source,
    sourceMode: "git_ref_pinned",
    observedRefCommit,
    lockCommitIsAncestor,
    ancestryVerified: true,
    expectedTupleVerified,
    refFileMatchesLock,
    blobSha,
    sourceSha256,
    lockedBlobSha,
    lockedSha256,
    releaseReady: expectedTupleVerified && lockCommitIsAncestor && refFileMatchesLock,
    failureReason: !expectedTupleVerified
      ? "The configured commit/path/blob/SHA-256 lock tuple is internally inconsistent."
      : !lockCommitIsAncestor
        ? `Source ref ${observedRefCommit} does not descend from locked commit ${lockedCommit}.`
        : !refFileMatchesLock
          ? `The pinned source ref changed ${config.source_path}.`
          : null,
  };
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function gitBlobSha(value) {
  const content = Buffer.isBuffer(value) ? value : Buffer.from(value);
  const header = Buffer.from(`blob ${content.length}\0`);
  return createHash("sha1").update(header).update(content).digest("hex");
}

async function revParseCommit(repoPath, ref) {
  return (await git(repoPath, ["rev-parse", "--verify", `${ref}^{commit}`])).trim();
}

async function git(repoPath, args) {
  const result = await command("git", args, repoPath);
  assert(result.code === 0, `git ${args.join(" ")} failed: ${result.output.trim()}`);
  return result.output;
}

async function command(bin, args, cwd) {
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, { cwd, maxBuffer: 10_000_000 });
    return { code: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    return {
      code: typeof error.code === "number" ? error.code : 1,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}`,
    };
  }
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveFromRoot(root, filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
