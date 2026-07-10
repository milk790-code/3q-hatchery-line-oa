# 3Q Growth Loop Sample Gate Due Status

BLUF: day7_due_waiting_for_owner_counts. Today is 2026-07-11 in Asia/Taipei; the current sample gate is due now and the champion stays unchanged.

Generated: 2026-07-10T21:45:16.365Z
Mode: sample_gate_due_status
Week: 2026-06-29 to 2026-07-05
Minimum check: 2026-07-01
Preferred check: 2026-07-05
Due phase: preferred_check_due
Due event: preferred_sample_check_day7
Due now: yes
Days since minimum check: 10
Sample threshold met: no
Sample-rate win candidate: no
P0 inputs: 9
P0 pending: 18
Progress status: waiting_for_p0_sample_gate_counts
Owner sample-gate status: waiting_for_owner_sample_gate_counts
Capture calendar: waiting_for_owner_sample_gate_counts / next=2026-07-05 / event=preferred_sample_check_day7
Champion action: keep_champion_sample_insufficient
Challenger promotion allowed: no
Next variable rotation allowed: no
Calendar import performed: no
System reminder created: no
Browser open performed: no
data/lp_events.jsonl write performed: no
External effect: no

## Next Safe Actions

| action | command | artifact | why |
|---|---|---|---|
| collect_or_update_focused_p0_counts | `open next_p0_owner_form.html` | next_p0_owner_form.html | Capture only aggregate page_view, cta_click, and line_add counts for the current focused P0 rows. |
| preview_owner_download | `npm run next-p0:intake` | next_p0_owner_intake.md | Validate any owner-downloaded focused CSV without staging it or writing events. |
| refresh_due_status | `npm run sample-gate:due` | sample_gate_due_status.md | Recompute whether the current Day 3 / Day 7 sample gate is due, waiting, or ready for owner review. |

## Review Artifacts

- sample_gate_due_status.md
- sample_gate_capture_calendar.md
- owner_next_action.md
- data_collection_progress.md
- next_p0_owner_form.html
- next_p0_owner_intake.md
- owner_sample_gate_status.md

## Safety

- Aggregate counts only.
- Do not paste phone, email, LINE user ID, customer name, chat text, payment data, order IDs, refund details, or private notes.
- Day 3 / Day 7 due status is a local operator signal, not approval to promote, publish, deploy, or change links.
- Sample-insufficient status keeps the champion and current variable.
