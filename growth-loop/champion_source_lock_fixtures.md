# Champion Source Lock Fixtures

BLUF: PASS. Git ref pinning, ancestry, target drift, lock-tuple integrity, and missing-repo fail-closed behavior were tested in an isolated temporary repository.

| case | result |
|---|---|
| exact_lock_passes | pass |
| descendant_with_same_target_passes | pass |
| annotated_ref_is_pinned_to_commit | pass |
| ref_advances_between_checks_with_same_target_passes | pass |
| blob_match_with_sha_mismatch_fails | pass |
| missing_repo_fallback_is_unverified_and_blocked | pass |
| descendant_target_drift_fails | pass |
| non_ancestor_with_same_target_fails | pass |

External effect: no.
