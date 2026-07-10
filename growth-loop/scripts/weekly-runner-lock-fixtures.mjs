import { lstat, mkdir, mkdtemp, open, readFile, rename, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  existingRunLockDecision,
  recoveryClaimDecision,
} from "./lib/run-lock-policy.mjs";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const STATUS_PATH = path.join(ROOT, "data", "weekly_runner_lock_fixture_status.json");
const REPORT_PATH = path.join(ROOT, "weekly_runner_lock_fixtures.md");

const cases = [
  policyTest("active_owner_over_four_hours_is_never_recovered", { owner: { pid: 100 }, ownerActive: true, ownerIdentityStatus: "match", lockAgeMs: 5 * 60 * 60 * 1000 }, "keep_active_owner"),
  policyTest("active_owner_unknown_age_is_never_recovered", { owner: { pid: 100 }, ownerActive: true, ownerIdentityStatus: "match", lockAgeMs: null }, "keep_active_owner"),
  policyTest("active_owner_identity_unavailable_fails_closed", { owner: { pid: 100 }, ownerActive: true, ownerIdentityStatus: "unverified", lockAgeMs: 5 * 60 * 60 * 1000 }, "keep_active_owner_identity_unverified"),
  policyTest("pid_reuse_identity_mismatch_is_recovered", { owner: { pid: 100 }, ownerActive: true, ownerIdentityStatus: "mismatch", lockAgeMs: 5_000 }, "recover_pid_reused_owner"),
  policyTest("dead_owner_is_recovered", { owner: { pid: 100 }, ownerActive: false, ownerIdentityStatus: "not_applicable", lockAgeMs: 5_000 }, "recover_stale_or_dead_owner"),
  policyTest("fresh_partial_lock_gets_startup_grace", { owner: null, ownerActive: false, ownerIdentityStatus: "not_applicable", lockAgeMs: 5_000 }, "keep_fresh_unknown_owner"),
  policyTest("old_invalid_lock_is_recovered", { owner: null, ownerActive: false, ownerIdentityStatus: "not_applicable", lockAgeMs: 60_000 }, "recover_stale_or_dead_owner"),
  recoveryTest("recovery_claim_same_owner_is_recoverable", snapshot("old-token", 11), snapshot("old-token", 11), "recover_stale_or_dead_owner", "recover_claimed_owner"),
  recoveryTest("recovery_race_never_removes_replacement_owner", snapshot("old-token", 11), snapshot("new-token", 12), "recover_stale_or_dead_owner", "abort_lock_replaced"),
];
cases.push(await exclusiveRecoveryClaimFixture());
cases.push(await replacementOwnerFilesystemFixture());

const status = {
  ok: cases.every((item) => item.ok),
  generated_at: new Date().toISOString(),
  mode: "isolated_weekly_runner_lock_policy_fixtures",
  owner_identity_fields: ["pid", "process_start", "command_sha256"],
  recovery_compare_before_rename: true,
  replacement_owner_delete_prevented: cases.some((item) => item.id === "recovery_race_never_removes_replacement_owner" && item.ok),
  exclusive_recovery_claim_proven: cases.some((item) => item.id === "two_recoverers_have_one_exclusive_claim" && item.ok),
  filesystem_replacement_owner_preserved: cases.some((item) => item.id === "filesystem_recovery_race_preserves_replacement_owner" && item.ok),
  pid_reuse_detected: cases.some((item) => item.id === "pid_reuse_identity_mismatch_is_recovered" && item.ok),
  cases,
  external_effect: false,
  production_deploy_performed: false,
  github_push_or_pr_performed: false,
  delete_action_performed: false,
};

await mkdir(path.dirname(STATUS_PATH), { recursive: true });
await writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
const rows = cases.map((item) => `| ${item.id} | ${item.observed} | ${item.ok ? "pass" : "fail"} |`).join("\n");
await writeFile(REPORT_PATH, `# Weekly Runner Lock Fixtures\n\nBLUF: ${status.ok ? "PASS" : "FAIL"}. A matching live process retains ownership regardless of age; PID reuse is rejected and recovery aborts if the lock is replaced before the atomic rename.\n\n| case | observed | result |\n|---|---|---|\n${rows}\n\n- Owner identity: pid + process start + command SHA-256.\n- Exclusive recovery claim proven: ${status.exclusive_recovery_claim_proven ? "yes" : "no"}.\n- Replacement owner delete prevented: ${status.replacement_owner_delete_prevented ? "yes" : "no"}.\n- Filesystem replacement owner preserved: ${status.filesystem_replacement_owner_preserved ? "yes" : "no"}.\n- PID reuse detected: ${status.pid_reuse_detected ? "yes" : "no"}.\n- External effect: no.\n`);
console.log(JSON.stringify(status, null, 2));
if (!status.ok) process.exitCode = 1;

function policyTest(id, input, expected) {
  const observed = existingRunLockDecision(input);
  return { id, expected, observed, ok: observed === expected };
}

function recoveryTest(id, expectedSnapshot, claimedSnapshot, ownerDecision, expected) {
  const observed = recoveryClaimDecision({ expectedSnapshot, claimedSnapshot, ownerDecision });
  return { id, expected, observed, ok: observed === expected };
}

function snapshot(token, inode) {
  return { kind: "directory", device: 1, inode, owner: { token } };
}

async function exclusiveRecoveryClaimFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "3q-lock-claim-fixture-"));
  const lockPath = path.join(root, "run.lock");
  const claimPath = path.join(lockPath, ".recovery-claim.json");
  await mkdir(lockPath);
  const attempts = await Promise.all([tryExclusiveClaim(claimPath), tryExclusiveClaim(claimPath)]);
  const acquired = attempts.filter((item) => item === "acquired").length;
  const busy = attempts.filter((item) => item === "busy").length;
  await safeUnlink(claimPath);
  await safeRmdir(lockPath);
  await safeRmdir(root);
  const observed = acquired === 1 && busy === 1 ? "one_recoverer_claimed" : `acquired_${acquired}_busy_${busy}`;
  return { id: "two_recoverers_have_one_exclusive_claim", expected: "one_recoverer_claimed", observed, ok: observed === "one_recoverer_claimed" };
}

async function replacementOwnerFilesystemFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "3q-lock-replacement-fixture-"));
  const lockPath = path.join(root, "run.lock");
  const oldPath = path.join(root, "old.lock");
  const ownerName = "owner.json";
  const claimName = ".recovery-claim.json";
  await mkdir(lockPath);
  await writeFile(path.join(lockPath, ownerName), `${JSON.stringify({ token: "old-token" })}\n`);
  const expectedSnapshot = await filesystemSnapshot(lockPath, ownerName);
  await rename(lockPath, oldPath);
  await mkdir(lockPath);
  await writeFile(path.join(lockPath, ownerName), `${JSON.stringify({ token: "new-token" })}\n`);
  const claim = await open(path.join(lockPath, claimName), "wx");
  await claim.close();
  const claimedSnapshot = await filesystemSnapshot(lockPath, ownerName);
  const observedDecision = recoveryClaimDecision({ expectedSnapshot, claimedSnapshot, ownerDecision: "recover_stale_or_dead_owner" });
  if (observedDecision === "abort_lock_replaced") await safeUnlink(path.join(lockPath, claimName));
  const replacementOwner = JSON.parse(await readFile(path.join(lockPath, ownerName), "utf8"));
  await safeUnlink(path.join(lockPath, claimName));
  await safeUnlink(path.join(lockPath, ownerName));
  await safeUnlink(path.join(oldPath, ownerName));
  await safeRmdir(lockPath);
  await safeRmdir(oldPath);
  await safeRmdir(root);
  const observed = observedDecision === "abort_lock_replaced" && replacementOwner.token === "new-token"
    ? "replacement_owner_preserved"
    : `${observedDecision}_${replacementOwner.token ?? "missing"}`;
  return { id: "filesystem_recovery_race_preserves_replacement_owner", expected: "replacement_owner_preserved", observed, ok: observed === "replacement_owner_preserved" };
}

async function tryExclusiveClaim(claimPath) {
  try {
    const handle = await open(claimPath, "wx");
    await handle.close();
    return "acquired";
  } catch (error) {
    if (error?.code === "EEXIST") return "busy";
    throw error;
  }
}

async function filesystemSnapshot(lockPath, ownerName) {
  const info = await lstat(lockPath);
  return {
    kind: "directory",
    device: info.dev,
    inode: info.ino,
    owner: JSON.parse(await readFile(path.join(lockPath, ownerName), "utf8")),
  };
}

async function safeUnlink(filePath) {
  await unlink(filePath).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
}

async function safeRmdir(dirPath) {
  await rmdir(dirPath).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
}
