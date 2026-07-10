# 3Q Growth Loop P0 Sample-Gate Launcher

BLUF: This is the narrow local launcher for the current blocker: owner aggregate sample counts. It opens only the P0 sample-gate files needed to fill Batch 1, fill Batch 2, check preflight, and review recovery state. It performs no external action.

Generated: 2026-07-10T21:45:48.114Z
Command: OPEN-P0-SAMPLE-GATE.command
Current action: collect_owner_sample_gate_counts
Due status: day7_due_waiting_for_owner_counts / phase=preferred_check_due / due_now=yes / due_date=2026-07-05 / preferred=2026-07-05
P0 now: waiting_for_owner_sample_counts / focused=9/9 / full=18/18 / pending=18
Copy blocks: blocks=2 / lines=26 / batch1=9 / batch2=9
Quick count progress: waiting_for_quick_counts / filled=0/9 / missing=9 / partial=no
P0 counts preflight: waiting_for_owner_p0_counts / ready=no / filled=0/9 / placeholders=9 / issues=0
Full P0 batch handoff: p0_full_coverage_batched_for_owner_counts / focused=9 / remaining=9 / full=yes
Collection sprint: sample_gate_due_collection_sprint_active / pending=18/18 / steps=5
Full P0 form/intake: form=ready_local_browser_fill / rows=18 / intake=waiting_for_owner_download / intake_ready=no / staged=no
Sample count recovery: waiting_for_owner_sample_counts / full=18 / pending=18
Approval queue: approval_queue_ready_with_human_gates / pending_human=5 / next=approve-d1-create-and-migrate

## Open Targets

| target | local path | exists | purpose |
|---|---|---|---|
| P0 now cockpit | owner_p0_now.html | yes | Start here for the current P0 sample-count action. |
| P0 now markdown | owner_p0_now.md | yes | Review the same P0 action in Markdown. |
| Full P0 batch handoff | sample_gate_batch_handoff.md | yes | Keep the full 18-row P0 coverage requirement visible. |
| Collection sprint | sample_gate_collection_sprint.md | yes | Use the timeboxed Day 3 / Day 7 sprint before opening the paste blocks. |
| P0 batch 1 paste block | sample_gate_batch_1_paste_block.txt | yes | Copy the 9 focused champion, challenger, and LINE CTA aggregate keys first. |
| P0 batch 2 paste block | sample_gate_batch_2_paste_block.txt | yes | Copy the remaining 9 content-variant aggregate keys before treating P0 as covered. |
| Focused paste template | data/next_p0_quick_capture/next_p0_owner_inputs.counts-paste-template.txt | yes | Paste aggregate counts into the focused 9-row quick template. |
| P0 counts preflight | p0_counts_preflight.md | yes | Check waiting, partial, ready, or invalid state before quick preview. |
| Full P0 browser form | sample_gate_owner_form.html | yes | Fill all 18 P0 aggregate sample-gate rows through a browser-only local form. |
| Full P0 intake | owner_sample_gate_intake.md | yes | Review the full P0 owner-download intake before any local staging. |
| Sample count handoff | owner_sample_count_handoff.md | yes | Use after counts are filled to see the next local verification commands. |
| Sample count recovery | owner_sample_count_recovery.md | yes | Confirm whether quick capture, intake, preflight, and sample checks recovered. |
| Sample gate due status | sample_gate_due_status.md | yes | Check the current Day 3 or Day 7 timing state. |

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

1. Run or double-click OPEN-P0-SAMPLE-GATE.command.
2. Open owner_p0_now.html and fill Batch 1 first.
3. Fill Batch 2 before treating Week 0 P0 sample collection as covered.
4. Review p0_counts_preflight.md; it must be ready before quick preview can be trusted.
5. Use owner_sample_count_handoff.md and owner_sample_count_recovery.md to continue local verification after counts are filled.
