import assert from "node:assert/strict";
import { mkdir, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  calculateDeploymentGate,
  inventoryWorkspace,
  loadReviewFindings,
  resolveProjectPath,
} from "./lib/mcp-review-core.mjs";

async function fixtureRoot(t) {
  const root = path.join(tmpdir(), `mcp-review-${process.pid}-${Date.now()}-${Math.random()}`);
  await mkdir(path.join(root, "scripts"), { recursive: true });
  await mkdir(path.join(root, "integrations", "site", ".wrangler", "tmp"), { recursive: true });
  await mkdir(path.join(root, "node_modules", "pkg"), { recursive: true });
  await mkdir(path.join(root, "archive", "run"), { recursive: true });
  await writeFile(path.join(root, "scripts", "owned.mjs"), "export const ok = true;\n");
  await writeFile(path.join(root, "node_modules", "pkg", "index.js"), "module.exports = {};\n");
  await writeFile(path.join(root, "archive", "run", "status.json"), "{}\n");
  await writeFile(path.join(root, "integrations", "site", ".wrangler", "tmp", "bundle.js"), "export {};\n");
  t.after(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

test("inventory classifies every file while isolating owned source", async (t) => {
  const root = await fixtureRoot(t);
  const inventory = await inventoryWorkspace(root);

  assert.equal(inventory.total_files, 4);
  assert.equal(inventory.categories.owned, 1);
  assert.equal(inventory.categories.dependency, 1);
  assert.equal(inventory.categories.archive, 1);
  assert.equal(inventory.categories.cache, 1);
  assert.deepEqual(inventory.owned_source_files, ["scripts/owned.mjs"]);
});

test("resolveProjectPath rejects traversal and symlink escape", async (t) => {
  const root = await fixtureRoot(t);
  const canonicalRoot = await realpath(root);
  assert.equal(
    resolveProjectPath(root, "scripts/owned.mjs"),
    path.join(canonicalRoot, "scripts", "owned.mjs"),
  );
  assert.throws(() => resolveProjectPath(root, "../outside.txt"), /outside project root/);

  const outside = path.join(tmpdir(), `mcp-review-outside-${process.pid}.txt`);
  await writeFile(outside, "outside\n");
  await symlink(outside, path.join(root, "scripts", "escape.txt"));
  t.after(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(outside, { force: true });
  });
  assert.throws(
    () => resolveProjectPath(root, "scripts/escape.txt", { requireExisting: true }),
    /symlink|outside project root/,
  );
});

test("findings are normalized and unresolved confirmed high findings block deployment", async (t) => {
  const root = await fixtureRoot(t);
  await writeFile(
    path.join(root, "CLAUDE-REVIEW-FINDINGS-20260710.json"),
    JSON.stringify({
      confirmed: [
        { file: "scripts/owned.mjs", line: 1, severity: "HIGH", summary: "bad math" },
        { file: "scripts/owned.mjs", line: 2, severity: "medium", summary: "weak guard", status: "resolved" },
      ],
    }),
  );

  const findings = await loadReviewFindings(root);
  assert.equal(findings.counts.confirmed, 2);
  assert.equal(findings.counts.unresolved_high, 1);
  assert.equal(findings.items[0].severity, "high");

  const gate = calculateDeploymentGate({
    findings,
    verification: { tests_passed: true, syntax_passed: true, dependency_audit_passed: true },
    github: { merged: true },
    live: { deployed: true },
  });
  assert.equal(gate.status, "POST_DEPLOY_REVIEW_REQUIRED");
  assert.equal(gate.deploy_allowed, false);
  assert.match(gate.blockers.join("\n"), /1 unresolved confirmed high/);
});

test("deployment readiness requires zero high findings and every verification signal", () => {
  const findings = { counts: { unresolved_high: 0, unresolved_medium: 2 } };
  const blocked = calculateDeploymentGate({
    findings,
    verification: { tests_passed: true, syntax_passed: false, dependency_audit_passed: true },
    github: { merged: false },
    live: { deployed: false },
  });
  assert.equal(blocked.status, "REVIEW_BLOCKED");

  const ready = calculateDeploymentGate({
    findings,
    verification: { tests_passed: true, syntax_passed: true, dependency_audit_passed: true },
    github: { merged: false },
    live: { deployed: false },
  });
  assert.equal(ready.status, "DEPLOY_READY");
  assert.equal(ready.deploy_allowed, false, "MCP review never authorizes the external deploy action");
});

test("resolution ledger closes a finding only with dated test evidence", async (t) => {
  const root = await fixtureRoot(t);
  await writeFile(path.join(root, "CLAUDE-REVIEW-FINDINGS-20260710.json"), JSON.stringify({
    confirmed: [{ id: "confirmed-001", severity: "high", file: "scripts/owned.mjs", line: 1 }],
  }));
  await writeFile(path.join(root, "review-resolution-ledger.json"), JSON.stringify({
    entries: [{ finding_id: "confirmed-001", status: "fixed", fixed_at: "2026-07-11T00:00:00+08:00", evidence: ["scripts/fix.test.mjs"] }],
  }));
  await writeFile(path.join(root, "review-waiver-ledger.json"), JSON.stringify({ entries: [] }));
  const findings = await loadReviewFindings(root);
  assert.equal(findings.counts.unresolved_high, 0);
  assert.equal(findings.items[0].status, "resolved");
});

test("incomplete waiver fails closed", async (t) => {
  const root = await fixtureRoot(t);
  await writeFile(path.join(root, "CLAUDE-REVIEW-FINDINGS-20260710.json"), JSON.stringify({
    confirmed: [{ id: "confirmed-001", severity: "high", file: "scripts/owned.mjs", line: 1 }],
  }));
  await writeFile(path.join(root, "review-waiver-ledger.json"), JSON.stringify({
    entries: [{ finding_id: "confirmed-001", status: "approved", reason: "missing human approval" }],
  }));
  const findings = await loadReviewFindings(root);
  assert.equal(findings.counts.unresolved_high, 1);
});
