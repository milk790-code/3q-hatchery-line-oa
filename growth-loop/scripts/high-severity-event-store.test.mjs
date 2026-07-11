import assert from "node:assert/strict";
import test from "node:test";

import {
  planIdempotentAppend,
  replaceAggregateWindow,
} from "./lib/idempotent-event-store.mjs";
import { aggregateSql } from "./export-d1-aggregate-events.mjs";

test("repeated apply skips event IDs already in the event store", () => {
  const existing = [{ event_id: "event-1" }];
  const incoming = [{ event_id: "event-1" }, { event_id: "event-2" }];
  const plan = planIdempotentAppend(existing, incoming);

  assert.deepEqual(plan.append.map((event) => event.event_id), ["event-2"]);
  assert.deepEqual(plan.skipped_event_ids, ["event-1"]);
});

test("duplicate deterministic IDs inside one input batch fail before append", () => {
  assert.throws(
    () => planIdempotentAppend([], [{ event_id: "same" }, { event_id: "same" }]),
    /duplicate event_id inside input batch: same/,
  );
});

test("D1 refresh replaces only the matching aggregate campaign and week", () => {
  const existing = [
    {
      event_id: "manual-deal",
      occurred_at: "2026-07-08T12:00:00.000+08:00",
      campaign: "week0-cta-text",
      event_type: "deal",
      metadata_json: { aggregate_only: true, source: "owner_reviewed" },
    },
    {
      event_id: "old-d1-week",
      occurred_at: "2026-07-08T12:00:00.000+08:00",
      campaign: "week0-cta-text",
      event_type: "page_view",
      metadata_json: { collection: "remote_d1_grouped_count" },
    },
    {
      event_id: "prior-d1-week",
      occurred_at: "2026-07-01T12:00:00.000+08:00",
      campaign: "week0-cta-text",
      event_type: "page_view",
      metadata_json: { collection: "remote_d1_grouped_count" },
    },
  ];
  const replacement = [{
    event_id: "new-d1-week",
    occurred_at: "2026-07-09T12:00:00.000+08:00",
    campaign: "week0-cta-text",
    event_type: "page_view",
    metadata_json: { collection: "remote_d1_grouped_count" },
  }];

  const result = replaceAggregateWindow(existing, replacement, {
    campaign: "week0-cta-text",
    startUtc: "2026-07-05T16:00:00.000Z",
    endUtc: "2026-07-12T15:59:59.999Z",
  });

  assert.deepEqual(result.events.map((event) => event.event_id), [
    "manual-deal",
    "prior-d1-week",
    "new-d1-week",
  ]);
  assert.equal(result.replaced_count, 1);
  assert.equal(result.preserved_count, 2);
});

test("aggregate SQL is completed-week bounded and reserves a truncation sentinel row", () => {
  const sql = aggregateSql(10001, "week0-cta-text", {
    startUtc: "2026-07-05T16:00:00.000Z",
    endUtc: "2026-07-12T15:59:59.999Z",
  });
  assert.match(sql, /occurred_at >= '2026-07-05T16:00:00.000Z'/);
  assert.match(sql, /occurred_at <= '2026-07-12T15:59:59.999Z'/);
  assert.match(sql, /LIMIT 10001/);
});
