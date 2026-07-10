#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

import { loadReviewFindings } from "./lib/mcp-review-core.mjs";

const root = path.resolve(import.meta.dirname, "..");
const findings = await loadReviewFindings(root);
if (findings.counts.unresolved_high !== 0) {
  throw new Error(`review gate blocked: ${findings.counts.unresolved_high} unresolved HIGH finding(s)`);
}
const tests = [
  "scripts/high-severity-scoring.test.mjs",
  "scripts/high-severity-event-store.test.mjs",
  "scripts/high-severity-importers.test.mjs",
  "scripts/high-severity-gates.test.mjs",
  "scripts/mcp-review-core.test.mjs",
  "scripts/mcp-review-audit.test.mjs",
];
const testRun = spawnSync(process.execPath, ["--test", ...tests], { cwd: root, stdio: "inherit" });
if (testRun.status !== 0) process.exit(testRun.status ?? 1);
const invariantRun = spawnSync(process.execPath, ["scripts/live-local-invariant-diff.mjs"], { cwd: root, stdio: "inherit" });
if (invariantRun.status !== 0) process.exit(invariantRun.status ?? 1);
process.stdout.write(`growth-loop-review-gate: PASS (${tests.length} suites, 0 unresolved HIGH)\n`);
