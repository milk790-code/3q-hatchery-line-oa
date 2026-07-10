# Weekly Runner Lock Fixtures

BLUF: PASS. A matching live process retains ownership regardless of age; PID reuse is rejected and recovery aborts if the lock is replaced before the atomic rename.

| case | observed | result |
|---|---|---|
| active_owner_over_four_hours_is_never_recovered | keep_active_owner | pass |
| active_owner_unknown_age_is_never_recovered | keep_active_owner | pass |
| active_owner_identity_unavailable_fails_closed | keep_active_owner_identity_unverified | pass |
| pid_reuse_identity_mismatch_is_recovered | recover_pid_reused_owner | pass |
| dead_owner_is_recovered | recover_stale_or_dead_owner | pass |
| fresh_partial_lock_gets_startup_grace | keep_fresh_unknown_owner | pass |
| old_invalid_lock_is_recovered | recover_stale_or_dead_owner | pass |
| recovery_claim_same_owner_is_recoverable | recover_claimed_owner | pass |
| recovery_race_never_removes_replacement_owner | abort_lock_replaced | pass |
| two_recoverers_have_one_exclusive_claim | one_recoverer_claimed | pass |
| filesystem_recovery_race_preserves_replacement_owner | replacement_owner_preserved | pass |

- Owner identity: pid + process start + command SHA-256.
- Exclusive recovery claim proven: yes.
- Replacement owner delete prevented: yes.
- Filesystem replacement owner preserved: yes.
- PID reuse detected: yes.
- External effect: no.
