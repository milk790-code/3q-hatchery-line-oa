# LoopOS cross-agent memory contract

This file is the canonical LoopOS memory contract for Codex, Claude, and any extra
operator accounts that work on the 3Q LoopOS fleet.

## Core owner preference

When LoopOS appears to need manual owner action, first look for a safe automatic
substitute.

Default behavior:

- Try reversible, local, draft-only, read-only, or report-only substitutes before
  asking Hsuehyi to act.
- If the substitute succeeds, use that path as the future default for the same
  gate class.
- Keep hard stops for secrets, production deploys, GitHub writes, outbound sends,
  payments, deletion, permission changes, customer PII, and irreversible actions.
- Never ask Hsuehyi to paste secret values into chat. Prefer local placeholders,
  local wrappers, redacted readiness probes, and owner-side environment setup.

## Shared gate taxonomy

| Gate | Safe automatic substitute | Hard stop |
| --- | --- | --- |
| `secret-input` / `manual_secret_input` | Create local placeholder files, check env presence booleans, prepare redacted secret-gate handoffs, show owner-side commands. | Entering, printing, writing, modifying, or storing secret values. |
| `deploy-approval` / `manual_deploy_approval` | Run syntax checks, deploy-readiness checklists, local config reviews, and read-only public health probes. | `wrangler deploy`, production settings, protected endpoint calls that mutate state. |
| `push-and-pr-approval` / `manual_create_only` | Prepare local GitHub handoff, PR body, issue draft, dedup report, and label-control run plan. | `git push`, PR or issue creation, merge, protected-branch action, label acknowledgement write. |
| `manual-send-approval` / `manual_send_only` | Generate drafts, prospect evidence, cooldown/dedup reports, and manual-send checklist. | LINE, IG, email, public post, form submit, or bulk outbound send. |
| `local-review` / `manual_review_only` | Snapshot worktree, plan commit boundaries, produce slice handoffs and stage scripts. | Staging unrelated changes, committing, or running generated stage scripts without review. |

## Cross-account sync rule

Use this file as the single source of truth. Each account may keep local evidence,
but the operating rule should not fork.

Default sync targets:

- Canonical repo file: `docs/loopos-cross-agent-memory.md`
- LoopOS generated copy: `%USERPROFILE%\.codex\automations\loops-24\shared-memory\loopos-cross-agent-memory.md`
- Codex memory note: `%USERPROFILE%\.codex\memories\extensions\ad_hoc\notes\*-loopos-cross-agent-memory.md`
- Claude memory file: `%USERPROFILE%\Desktop\天使.claude\memory\loopos-cross-agent-memory.md`

If Hsuehyi runs three or four accounts, copy this exact contract into each
account-level memory store. Account-specific evidence belongs in separate local
run reports, not inside this shared rule.

Memory sync is a write gate. The default command must run as dry-run; write to
Codex or Claude memory only after explicit owner approval.

## Required operating loop

1. Read the latest LoopOS dashboard and local state.
2. Classify every blocker by the shared gate taxonomy.
3. Attempt safe substitutes for each blocker class.
4. Write a local adapter report that says what was auto-completed and what still
   needs owner approval.
5. Ask Hsuehyi only for the remaining hard-stop decision.
