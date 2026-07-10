import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { auditOwnedFiles } from "./lib/mcp-review-audit.mjs";
import { inventoryWorkspace } from "./lib/mcp-review-core.mjs";

test("auditOwnedFiles reports syntax and JSON failures without exposing file contents", async (t) => {
  const root = path.join(tmpdir(), `mcp-review-audit-${process.pid}-${Date.now()}`);
  await mkdir(path.join(root, "scripts"), { recursive: true });
  await mkdir(path.join(root, "config"), { recursive: true });
  await writeFile(path.join(root, "scripts", "ok.mjs"), "export const ok = true;\n");
  await writeFile(path.join(root, "scripts", "bad.mjs"), "export const = true;\n");
  await writeFile(path.join(root, "config", "bad.json"), "{ nope }\n");
  t.after(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(root, { recursive: true, force: true });
  });

  const inventory = await inventoryWorkspace(root);
  const audit = await auditOwnedFiles(root, inventory);

  assert.equal(audit.javascript.checked, 2);
  assert.deepEqual(audit.javascript.failed.map((item) => item.path), ["scripts/bad.mjs"]);
  assert.equal(audit.json.checked, 1);
  assert.deepEqual(audit.json.failed.map((item) => item.path), ["config/bad.json"]);
  assert.equal(audit.source_manifest.length, 3);
  assert.match(audit.source_manifest[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(audit).includes("export const = true"), false);
});
