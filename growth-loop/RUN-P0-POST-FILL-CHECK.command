#!/bin/zsh
set -eu

ROOT="/Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop"
cd "$ROOT"

echo "3Q Growth Loop P0 post-fill local check"
echo "Generated: 2026-07-10T21:45:49.199Z"
echo "Stage: waiting_for_owner_sample_counts"
echo "Local scripts only. No deploy, public link switch, formal post, LINE push, GitHub push, payment, customer-data mutation, or data removal."
echo "Review after run: source_trust_matrix.md, weekly_report.md, owner_sample_count_recovery.md, approval_queue.json, redline_priority.md"

run_step() {
  print ""
  print ">>> $*"
  "$@"
}

run_step npm run p0:counts-preflight
run_step npm run next-p0:quick
run_step npm run next-p0:intake
run_step npm run owner:intake
run_step npm run owner:data-preflight
run_step npm run data:progress
run_step npm run owner:sample-gate
run_step npm run source:trust
run_step npm run owner:sample-count-recovery
run_step npm run owner:next-action
run_step npm run sample-gate:recovery
run_step npm run owner:p0-now
run_step npm run owner:p0-launcher
run_step npm run weekly:local

echo ""
echo "Post-fill local check complete. Review weekly_report.md and approval_queue.json before any external action."
