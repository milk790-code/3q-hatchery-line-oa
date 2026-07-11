#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const evidence = JSON.parse(await readFile(path.join(root, "deployment-evidence.json"), "utf8"));
const expected = evidence.contract.expected;
let health = evidence.contract.observed.health;
let status = evidence.contract.observed.growth_loop_status;

if (process.argv.includes("--live")) {
  const [healthResponse, statusResponse] = await Promise.all([
    fetch(`${evidence.live_base_url}/health`),
    fetch(`${evidence.live_base_url}/growth-loop/status`),
  ]);
  if (!healthResponse.ok || !statusResponse.ok) throw new Error(`live endpoint failure: health=${healthResponse.status} status=${statusResponse.status}`);
  [health, status] = await Promise.all([healthResponse.json(), statusResponse.json()]);
}

const checks = {
  worker: health.worker === expected.worker,
  build: health.build === expected.build && status.build === expected.build,
  collector_configured: status.collector_configured === true,
  collector_url_matches_expected: status.collector_url_matches_expected === true,
  collector_origin: status.collector_origin === expected.collector_url,
  binding_preserved: evidence.cloudflare.binding_before === expected.collector_url
    && evidence.cloudflare.binding_after === expected.collector_url,
};
const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
process.stdout.write(`${JSON.stringify({ ok: failed.length === 0, mode: process.argv.includes("--live") ? "live" : "captured", checks, failed }, null, 2)}\n`);
if (failed.length > 0) process.exitCode = 1;
