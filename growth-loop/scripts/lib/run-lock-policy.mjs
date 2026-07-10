const INITIALIZATION_GRACE_MS = 30_000;

/** Decide whether an observed run-lock owner may be recovered. */
export function existingRunLockDecision({ owner, ownerActive, ownerIdentityStatus, lockAgeMs }) {
  if (ownerActive && ownerIdentityStatus === "match") return "keep_active_owner";
  if (ownerActive && ownerIdentityStatus === "mismatch") return "recover_pid_reused_owner";
  if (ownerActive) return "keep_active_owner_identity_unverified";
  if (!owner && lockAgeMs !== null && lockAgeMs < INITIALIZATION_GRACE_MS) {
    return "keep_fresh_unknown_owner";
  }
  return "recover_stale_or_dead_owner";
}

/** Compare the immutable directory identity and owner token seen before/after a recovery claim. */
export function sameLockSnapshot(expected, observed) {
  return expected?.kind === "directory"
    && observed?.kind === "directory"
    && expected.device === observed.device
    && expected.inode === observed.inode
    && (expected.owner?.token ?? null) === (observed.owner?.token ?? null);
}

/** A claimed directory is recoverable only if it is still the exact stale lock observed earlier. */
export function recoveryClaimDecision({ expectedSnapshot, claimedSnapshot, ownerDecision }) {
  if (!sameLockSnapshot(expectedSnapshot, claimedSnapshot)) return "abort_lock_replaced";
  if (!["recover_stale_or_dead_owner", "recover_pid_reused_owner"].includes(ownerDecision)) {
    return "abort_owner_not_recoverable";
  }
  return "recover_claimed_owner";
}
