# 3Q Growth Loop Owner Action Launcher

BLUF: This is a local one-click starting point for the current owner task. It opens the local console, next-action card, P0-now card, P1 North Star outcome preflight/form/guard/intake/post-fill status, PreparedButBlocked handoff, approval queue, approval queue status, sample-gate recovery pack, sample-count handoff, full P0 batch handoff, full P0 batch preflight, copy-only batch paste blocks, sample-count recovery status, P0 post-fill check report/status, Worker dry-run report/status, focused Next P0 form, focused Next P0 intake, focused paste template, sample-gate capture calendar, sample-gate due status, sample-gate form, manual publish packet, manual publish evidence form, and quality review form. It performs no external action and does not auto-stage P1 outcome downloads, auto-run RUN-P0-POST-FILL-CHECK.command, auto-run RUN-P1-OUTCOME-POST-FILL-CHECK.command, or run wrangler.

Generated: 2026-07-10T21:48:30.510Z
Command: OPEN-3Q-GROWTH-LOOP.command
Primary action: collect_owner_sample_gate_counts
Primary action command: open sample_gate_batch_handoff.md
P0 now: waiting_for_owner_sample_counts / focused=9/9 / full=18/18 / open_targets=9
Full P0 form/intake: form=ready_local_browser_fill / rows=18 / intake=waiting_for_owner_download / candidate=no / staged=no
Owner next-action status: waiting_for_owner_sample_gate_counts
Owner sample-gate status: waiting_for_owner_sample_gate_counts
Sample threshold met: no
Quick count status: waiting_for_quick_counts
Quick count progress: filled 0/9, missing 9, partial no
P0 counts preflight: waiting_for_owner_p0_counts / ready=no / filled=0/9 / placeholders=9 / issues=0
North Star outcome preflight: waiting_for_north_star_outcome_counts / input=template / filled=0/24 / pending=24 / invalid=0 / ready_compile=no / data_write=no / external=no
North Star outcome form: ready_local_browser_fill / rows=24 / browser=yes / network=no / data_write=no / external=no / guard=ok / checks=26
P1 outcome intake: waiting_for_p1_outcome_download / candidate=no / valid=no / filled=0/24 / pending=24 / staged=no / data_write=no / external=no
P1 outcome post-fill check: waiting_for_p1_outcome_counts / stage=waiting_for_p1_outcome_counts / ready=no / expected_advance=no / commands=8 / local_only=yes / data_write=no / external=no
Missing ranks: 1, 2, 3, 4, 5, 6, 7, 8, 9
Sample count handoff: waiting_for_owner_sample_counts / paste_keys=9 / paste_block_lines=13 / after_fill_commands=8
Sample count recovery: waiting_for_owner_sample_counts / full=18 / pending=18 / form=ready_local_browser_fill:18 / intake=waiting_for_owner_download / intake_ready=no / staged=no / after_commands=4 / redlines=0
P0 post-fill check: waiting_for_owner_sample_counts / stage=waiting_for_owner_sample_counts / ready=no / expected_advance=no / safe_commands=14 / local_only=yes / data_write=no / external=no
Source trust: waiting_for_trusted_scoring_input / trusted=0 / sample_gate=0 / scoring=no / real_rows=0 / p0_pending=18 / public_ready=no / data_write=no / external=no
P0 post-fill command: RUN-P0-POST-FILL-CHECK.command is intentionally not opened by this launcher; run it manually only after Batch 1 and Batch 2 aggregate counts are filled.
P1 outcome post-fill command: RUN-P1-OUTCOME-POST-FILL-CHECK.command is intentionally not opened by this launcher; run it manually only after the P1 outcome aggregate rows are filled and reviewed.
Worker dry run: ok / dry_run_exit=yes / bindings=yes / production_deploy=no / external=no / report=/Users/mac/Documents/Codex/control-center/worktrees/3q-growth-loop-high-fixes/growth-loop/worker_dry_run.md
Full P0 batch handoff: p0_full_coverage_batched_for_owner_counts / rows=18/18 / batches=2 / focused=9 / remaining=9 / pending=18 / full=yes
Full P0 batch preflight: waiting_for_full_p0_counts / input=template / filled=0/18 / pending=18 / invalid=0 / ready_compile=no / data_write=no / external=no
Collection sprint: sample_gate_due_collection_sprint_active / pending=18/18 / steps=5
PreparedButBlocked: prepared_but_blocked / blocked=8 / pending=5 / autorun=no
Approval queue: approval_queue_ready_with_human_gates / items=20 / ready=14 / pending=5 / high_risk=5 / next_ready=collect-first-real-events / next_human=approve-d1-create-and-migrate / policy_ok=yes
Manual publish evidence status: waiting_for_owner_manual_publish_evidence
Launch readiness: owner_approval_required

## Open Targets

| target | local path | exists | purpose |
|---|---|---|---|
| Owner console | owner_console.html | yes | Review current funnel, gates, red lines, archive, and weekly runner status. |
| Next action card | owner_next_action.md | yes | See the single safest next owner action before any external move. |
| North Star outcome preflight | north_star_outcome_preflight.md | yes | Check whether the P1 link-click, lead, deal, and quality aggregate rows are ready for local source compile. |
| North Star outcome preflight status | data/north_star_outcome_preflight_status.json | yes | Review compact P1 outcome filled, pending, invalid, and ready-for-compile state. |
| North Star outcome form | north_star_outcome_form.html | yes | Fill the 24 P1 link-click, lead, deal, and quality aggregate rows in a browser-only local form. |
| North Star outcome form guard | north_star_outcome_form_fixture_report.md | yes | Review the static local-only fixture guard for the P1 outcome browser form. |
| P1 outcome intake | owner_p1_outcome_intake.md | yes | Review any downloaded P1 outcome CSV before staging it as the local owner-filled working file. |
| P1 outcome intake JSON | owner_p1_outcome_intake.json | yes | Review full P1 outcome download validation, source compile preview, and red-line flags before staging. |
| P1 outcome intake status | data/owner_p1_outcome_intake_status.json | yes | Review compact P1 outcome intake status without staging the downloaded file. |
| P1 outcome post-fill check | owner_p1_outcome_postfill_check.md | yes | Review the local-only command sequence to run after the P1 outcome aggregate rows are filled. |
| P1 outcome post-fill check JSON | owner_p1_outcome_postfill_check.json | yes | Review full P1 outcome post-fill readiness, command whitelist, and red-line flags before running the checker. |
| P1 outcome post-fill check status | data/owner_p1_outcome_postfill_check_status.json | yes | Review compact P1 outcome post-fill checker status without executing the checker command. |
| P0 now cockpit | owner_p0_now.html | yes | Open the compact browser cockpit for the current P0 sample-count action before the full handoff set. |
| P0 now markdown | owner_p0_now.md | yes | Open the shortest current P0 sample-count action card as Markdown. |
| Collection sprint | sample_gate_collection_sprint.md | yes | Open the timeboxed local sprint for Day 3 / Day 7 P0 sample-count collection. |
| PreparedButBlocked handoff | prepared_but_blocked.md | yes | Review every human-only or external blocked action before any owner-approved move. |
| D1 schema contract | d1_schema_contract.md | yes | Review the isolated two-pass migration, integrity, seed, and constraint proof before any remote D1 approval. |
| D1 config guard | approved_d1_config.md | yes | Review the exact-name and exact-id guard that keeps wrangler.jsonc unchanged until explicit owner approval and live metadata match. |
| Champion GitHub handoff | champion_github_handoff.md | yes | Review the known repository, branch, commit, and draft PR commands without pushing, opening, merging, or deploying. |
| Champion draft PR body | champion_github_pr_body.md | yes | Review the exact draft PR description and downstream D1 and deploy gates. |
| Approval queue | approval_queue.json | yes | Review every local, owner, and external-gate approval item before any irreversible move. |
| Approval queue status | data/approval_queue_status.json | yes | Review compact approval queue counts, next local review, next human gate, and policy flags. |
| Sample gate recovery | sample_gate_recovery_pack.md | yes | Recover a Day 3 / Day 7 sample-gate miss with exact aggregate rows and local-only commands. |
| Sample count handoff | owner_sample_count_handoff.md | yes | Open the one-screen owner handoff for the exact missing aggregate counts and after-fill commands. |
| Sample count paste block | owner_sample_count_paste_block.txt | yes | Copy the exact aggregate-count keys into the focused paste template without copying Markdown. |
| Full P0 batch handoff | sample_gate_batch_handoff.md | yes | Review the full 18-row P0 handoff split into the focused batch and the remaining content-variant batch. |
| Full P0 batch preflight | sample_gate_batch_preflight.md | yes | Check whether the full 18-row owner-filled sample-gate ledger is ready for local source compile. |
| Full P0 batch preflight status | data/sample_gate_batch_preflight_status.json | yes | Review compact full-P0 batch filled, pending, invalid, and ready-for-compile state. |
| P0 batch 1 paste block | sample_gate_batch_1_paste_block.txt | yes | Copy the 9 focused champion / challenger / LINE CTA aggregate keys first. |
| P0 batch 2 paste block | sample_gate_batch_2_paste_block.txt | yes | Copy the remaining 9 content-variant aggregate keys before treating Week 0 P0 as fully covered. |
| Sample count recovery | owner_sample_count_recovery.md | yes | Review whether quick capture, focused intake, owner preflight, and weekly verification recovered after counts were filled. |
| P0 post-fill check | owner_p0_postfill_check.md | yes | Review the local-only command sequence to run after Batch 1 and Batch 2 aggregate counts are filled. |
| P0 post-fill check JSON | owner_p0_postfill_check.json | yes | Review full post-fill readiness, command whitelist, and red-line flags before running the checker. |
| P0 post-fill check status | data/owner_p0_postfill_check_status.json | yes | Review compact post-fill checker status without executing the checker command. |
| Worker dry-run report | worker_dry_run.md | yes | Review candidate Worker dry-run evidence before approving any production deploy. |
| Worker dry-run status | data/worker_dry_run_status.json | yes | Review compact Wrangler dry-run status; this launcher does not run Wrangler. |
| Next P0 form | next_p0_owner_form.html | yes | Fill only the current focused P0 aggregate rows in a browser-only local form. |
| Next P0 intake | next_p0_owner_intake.md | yes | Review the focused owner download intake and local preview CSVs before staging. |
| Next P0 quick capture | next_p0_quick_capture.md | yes | Use the local rank-count adapter when aggregate Day 3 counts are available as short text. |
| Next P0 paste template | data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt | yes | Fill the exact 9 focused aggregate count rows that the next weekly run can auto-read into preview. |
| P0 counts preflight | p0_counts_preflight.md | yes | Check whether the focused P0 paste template is waiting, partial, ready, or invalid before running quick capture. |
| Capture calendar | sample_gate_capture_calendar.md | yes | Review Day 3 / Day 7 sample-gate checkpoints before any winner or traffic decision. |
| Due status | sample_gate_due_status.md | yes | Review whether the current Day 3 / Day 7 sample gate is due, waiting, or still sample-insufficient. |
| Sample gate form | sample_gate_owner_form.html | yes | Fill the 18 P0 aggregate sample-gate rows in a browser-only local form. |
| Owner approval form | owner_approval_form.html | yes | Prepare non-secret owner approval metadata for external gates without executing them. |
| Manual publish packet | manual_publish_packet.md | yes | Review draft-only post packets before any manual platform publish. |
| Manual publish evidence form | manual_publish_evidence_form.html | yes | After an owner-manual post, capture one non-sensitive post evidence reference locally. |
| Quality review form | owner_quality_review_form.html | yes | After a sample-rate win candidate appears, capture aggregate no-quality-regression evidence locally. |

## Safety Contract

- Opens local files only: yes
- External URLs: no
- Network calls: no
- Browser persistence: no
- Live input files created by generator: no
- data/lp_events.jsonl write: no
- Formal post / schedule / send: no
- LINE push: no
- Production deploy: no
- GitHub push / PR: no
- Public link change: no
- Customer data mutation: no
- Payment action: no
- Delete action: no

## Intended Use

1. Run or double-click OPEN-3Q-GROWTH-LOOP.command.
2. Check sample_gate_capture_calendar.md for the current Day 3 / Day 7 sample-gate review timing.
3. Check sample_gate_due_status.md to see whether the current checkpoint is due now.
4. Open sample_gate_batch_handoff.md. Fill sample_gate_batch_1_paste_block.txt first, then sample_gate_batch_2_paste_block.txt before treating P0 as fully covered.
5. Open p0_counts_preflight.md before running quick capture; it must be ready before npm run next-p0:quick can create a preview from the paste template.
6. Copy owner_sample_count_paste_block.txt into the focused paste template when using the quick path, then replace only aggregate placeholders; or use the focused Next P0 form / full sample-gate form when you need a browser export.
7. Use north_star_outcome_form.html for the P1 outcome rows only after P0 sample-count collection is clear enough to protect the click -> LINE -> lead -> deal funnel.
8. Open owner_p1_outcome_intake.md after downloading source_capture_ledger.filled.csv from the P1 form. Stage only after review with npm run owner:p1-outcome-intake -- --input=<reviewed-csv-path> --stage --confirm-owner-reviewed.
9. Open owner_p1_outcome_postfill_check.md and confirm it is still local-only. After the P1 outcome aggregate rows are staged, run ./RUN-P1-OUTCOME-POST-FILL-CHECK.command manually; this launcher does not auto-run it.
10. Open owner_p0_postfill_check.md and confirm it is still local-only. After Batch 1 and Batch 2 aggregate counts are filled, run ./RUN-P0-POST-FILL-CHECK.command manually; this launcher does not auto-run it.
11. Follow the refreshed local reports after the post-fill commands finish: weekly_report.md, owner_sample_count_recovery.md, source_trust_matrix.md, approval_queue.json, and redline_priority.md.
12. Keep all external actions in owner_approval_pack.md as separate owner gates.
