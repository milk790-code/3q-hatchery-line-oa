# 3Q Growth Loop Sample Gate Capture Calendar

BLUF: waiting_for_owner_sample_gate_counts. This local calendar converts the Week 0 sample-gate thresholds into concrete owner review checkpoints without importing anything into Calendar or creating reminders.

Generated: 2026-07-10T21:45:15.764Z
Timezone: Asia/Taipei
Week: 2026-06-29 to 2026-07-05
Next due: 2026-07-05 / Day 7 preferred weekly review
P0 inputs: 9
P0 pending: 18
Owner next action: waiting_for_owner_sample_gate_counts
Calendar import performed: no
System reminder created: no
External effect: no

## Capture Checkpoints

| date | checkpoint | command | artifact | owner gate |
|---|---|---|---|---|
| 2026-06-29 | Open Week 0 P0 aggregate capture | `open next_p0_owner_form.html` | next_p0_owner_form.html | Collect aggregate counts only; do not export customer rows. |
| 2026-07-01 | Day 3 minimum sample check | `npm run data:progress && npm run next-p0:intake && npm run owner:next-action` | owner_next_action.md | If a valid focused CSV exists, staging still requires --stage --confirm-owner-reviewed. |
| 2026-07-05 | Day 7 preferred weekly review | `npm run weekly:local` | weekly_report.md | Review approval_queue.json before any public route, deploy, GitHub, post, or LINE action. |

## Source Groups

| source | inputs | event types |
|---|---:|---|
| candidate Worker D1 / landing page analytics | 6 | page_view, cta_click |
| LINE OA 管理後台 / inbound customer-service aggregate | 3 | line_add |

## Thresholds

- min_visits: 100
- min_cta_clicks: 20
- min_line_adds: 5
- min_test_days: 3
- preferred_test_days: 7

## Safety

- Aggregate counts only.
- Do not paste phone, email, LINE user ID, customer name, chat text, payment data, order IDs, or refund details.
- This file and `sample_gate_capture_calendar.ics` are local artifacts only.
- Importing the ICS into Calendar, creating reminders, publishing, deploying, pushing GitHub, changing links, or sending LINE remains owner-controlled.
