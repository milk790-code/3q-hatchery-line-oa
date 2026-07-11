#!/bin/zsh
set -eu

ROOT="/Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop"
cd "$ROOT"

echo "3Q Growth Loop P1 outcome post-fill local check"
echo "Generated: 2026-07-10T21:45:02.495Z"
echo "Stage: waiting_for_p1_outcome_counts"
echo "Local scripts only. No deploy, public link switch, formal post, LINE push, GitHub push, payment, customer-data mutation, or data removal."
echo "Review after run: north_star_outcome_preflight.md, source_capture_compile_report.md, source_trust_matrix.md, weekly_report.md, approval_queue.json, redline_priority.md"

run_step() {
  print ""
  print ">>> $*"
  "$@"
}

run_step npm run north-star:outcome-preflight
run_step npm run source:compile
run_step npm run real-data:intake
run_step npm run data:progress
run_step npm run source:trust
run_step npm run north-star
run_step npm run owner:next-action
run_step npm run weekly:local

echo ""
echo "P1 outcome post-fill local check complete. Review source_trust_matrix.md and owner_approval_pack.md before any external action."
