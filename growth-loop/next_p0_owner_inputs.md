# 3Q Growth Loop Next P0 Owner Inputs

BLUF: Fill these 9 aggregate-count rows first. They are the shortest path toward the sample gate, and this file performs no event write, deploy, post, LINE push, public link change, GitHub action, payment, customer-data mutation, or deletion.

Generated: 2026-07-10T21:44:53.826Z
Mode: next_p0_owner_inputs
Status: waiting_for_p0_owner_inputs
Source progress status: waiting_for_p0_sample_gate_counts
P0 pending: 18
P1 pending: 24
Total pending: 42
Sample threshold met: no
Owner sample gate status: waiting_for_owner_sample_gate_counts
Recommended open command: open next_p0_owner_form.html
Real events unchanged: yes
External effect: no
data/lp_events.jsonl write performed: no

## Source Groups

| source | inputs | event types | owner fill paths |
|---|---:|---|---|
| candidate Worker D1 / landing page analytics | 6 | page_view, cta_click | data/source_capture/source_capture_ledger.filled.csv |
| LINE OA 管理後台 / inbound customer-service aggregate | 3 | line_add | data/source_capture/source_capture_ledger.filled.csv |

## Inputs To Fill First

| rank | role | tracking_link_id | event_type | label | source | owner_fill_path |
|---:|---|---|---|---|---|---|
| 1 | champion | track-champion-3q-line-v0 | page_view | 落地頁瀏覽 | candidate Worker D1 / landing page analytics | data/source_capture/source_capture_ledger.filled.csv |
| 2 | champion | track-champion-3q-line-v0 | cta_click | CTA 點擊 | candidate Worker D1 / landing page analytics | data/source_capture/source_capture_ledger.filled.csv |
| 3 | champion | track-champion-3q-line-v0 | line_add | LINE 進線 / 加好友 | LINE OA 管理後台 / inbound customer-service aggregate | data/source_capture/source_capture_ledger.filled.csv |
| 4 | challenger | track-challenger-week0-cta-text-v1 | page_view | 落地頁瀏覽 | candidate Worker D1 / landing page analytics | data/source_capture/source_capture_ledger.filled.csv |
| 5 | challenger | track-challenger-week0-cta-text-v1 | cta_click | CTA 點擊 | candidate Worker D1 / landing page analytics | data/source_capture/source_capture_ledger.filled.csv |
| 6 | challenger | track-challenger-week0-cta-text-v1 | line_add | LINE 進線 / 加好友 | LINE OA 管理後台 / inbound customer-service aggregate | data/source_capture/source_capture_ledger.filled.csv |
| 7 | line_cta | track-challenger-week0-cta-text-v1-line | page_view | 落地頁瀏覽 | candidate Worker D1 / landing page analytics | data/source_capture/source_capture_ledger.filled.csv |
| 8 | line_cta | track-challenger-week0-cta-text-v1-line | cta_click | CTA 點擊 | candidate Worker D1 / landing page analytics | data/source_capture/source_capture_ledger.filled.csv |
| 9 | line_cta | track-challenger-week0-cta-text-v1-line | line_add | LINE 進線 / 加好友 | LINE OA 管理後台 / inbound customer-service aggregate | data/source_capture/source_capture_ledger.filled.csv |

## Owner Fill Rule

- Fill aggregate_count only after reviewing source totals.
- Add evidence_ref as a local screenshot/export reference or source label.
- Set pii_checked=yes only when no customer-level data is included.
- Do not paste phone, email, LINE user ID, customer name, chat text, payment data, private notes, order IDs, refund details, or customer-level exports.

## Safe Follow-Up Commands

```zsh
npm run source:compile
npm run real-data:intake
npm run owner:sample-gate
npm run owner:next-action
```

These commands are local review commands. Any apply command that appends to data/lp_events.jsonl remains owner-reviewed and must use explicit confirmation flags.
