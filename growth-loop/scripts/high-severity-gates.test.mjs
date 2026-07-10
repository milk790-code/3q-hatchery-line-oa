import assert from "node:assert/strict";
import test from "node:test";

import { expectedRowsIssues, splitCountItems } from "./lib/gate-policy.mjs";

test("count parser discards whole comment lines before comma/semicolon splitting", () => {
  const raw = [
    "# Do not include name, email; LINE user ID, or private note.",
    "capture_date=2026-07-10",
    "1=12, 2=3; 3=0",
  ].join("\n");

  assert.deepEqual(splitCountItems(raw), [
    "capture_date=2026-07-10",
    "1=12",
    "2=3",
    "3=0",
  ]);
});

test("missing or empty all_rows fails the sample-gate batch closed", () => {
  assert.equal(expectedRowsIssues({}).some((issue) => issue.code === "missing_expected_p0_rows"), true);
  assert.equal(expectedRowsIssues({ all_rows: [] }).some((issue) => issue.code === "missing_expected_p0_rows"), true);
  assert.deepEqual(expectedRowsIssues({ all_rows: [{ rank: 1 }] }), []);
});
