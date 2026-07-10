import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalRates,
  completedTaipeiWeek,
  filterEventsForWeek,
} from "./lib/scoring-policy.mjs";

test("line-add rate always uses visits even when link clicks are lower", () => {
  const rates = canonicalRates({
    link_clicks: 20,
    visits: 150,
    cta_clicks: 25,
    line_adds: 6,
    leads: 3,
    deals: 1,
  });

  assert.equal(rates.line_add_rate, 0.04);
  assert.equal(rates.cta_rate, 25 / 150);
  assert.equal(rates.lead_rate, 0.5);
  assert.equal(rates.close_rate, 1 / 3);
});

test("missing page-view telemetry fails closed instead of falling back for line-add rate", () => {
  const rates = canonicalRates({ link_clicks: 20, visits: 0, line_adds: 6 });
  assert.equal(rates.line_add_rate, 0);
});

test("completedTaipeiWeek selects the previous Monday-Sunday window", () => {
  const week = completedTaipeiWeek(new Date("2026-07-12T17:00:00.000Z"));
  assert.deepEqual(week, {
    start: "2026-07-06",
    end: "2026-07-12",
    startUtc: "2026-07-05T16:00:00.000Z",
    endUtc: "2026-07-12T15:59:59.999Z",
  });
});

test("filterEventsForWeek excludes prior and in-progress week rows", () => {
  const week = completedTaipeiWeek(new Date("2026-07-12T17:00:00.000Z"));
  const events = [
    { event_id: "old", occurred_at: "2026-07-05T15:59:59.999Z" },
    { event_id: "start", occurred_at: "2026-07-05T16:00:00.000Z" },
    { event_id: "end", occurred_at: "2026-07-12T15:59:59.999Z" },
    { event_id: "new", occurred_at: "2026-07-12T16:00:00.000Z" },
    { event_id: "bad", occurred_at: "not-a-date" },
  ];

  assert.deepEqual(filterEventsForWeek(events, week).map((event) => event.event_id), ["start", "end"]);
});
