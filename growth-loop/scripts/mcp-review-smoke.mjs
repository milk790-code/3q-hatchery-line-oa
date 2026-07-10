#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = path.resolve(import.meta.dirname, "..");
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(root, "scripts", "mcp-review-server.mjs"), "--root", root],
  stderr: "pipe",
});
const client = new Client({ name: "3q-growth-loop-review-smoke", version: "0.1.0" });

try {
  await client.connect(transport);
  const listed = await client.listTools();
  const expected = ["deployment_gate", "review_file", "review_findings", "review_inventory"];
  assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), expected);
  for (const tool of listed.tools) {
    assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} must be read-only`);
    assert.equal(tool.annotations?.destructiveHint, false, `${tool.name} must be non-destructive`);
  }

  const inventory = await client.callTool({ name: "review_inventory", arguments: { include_files: false } });
  assert.equal(inventory.isError, undefined);
  const findings = await client.callTool({ name: "review_findings", arguments: { severity: "high", limit: 20 } });
  assert.equal(findings.isError, undefined);
  const file = await client.callTool({ name: "review_file", arguments: { path: "package.json", max_bytes: 262144 } });
  assert.equal(file.isError, undefined);
  const blockedFile = await client.callTool({ name: "review_file", arguments: { path: "../AGENTS.md" } });
  assert.equal(blockedFile.isError, true);
  const gate = await client.callTool({ name: "deployment_gate", arguments: {} });
  assert.equal(gate.isError, undefined);

  process.stdout.write(`${JSON.stringify({ ok: true, tools: expected, checks: 5 }, null, 2)}\n`);
} finally {
  await client.close();
}
