#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  calculateDeploymentGate,
  inventoryWorkspace,
  loadReviewFindings,
  resolveProjectPath,
} from "./lib/mcp-review-core.mjs";

const DEFAULT_ROOT = path.resolve(import.meta.dirname, "..");
const EXCLUDED_READ_PREFIXES = ["node_modules/", "archive/", "github_export/", "output/", ".wrangler/", "logs/"];

function parseRoot(argv) {
  const rootIndex = argv.indexOf("--root");
  return rootIndex >= 0 && argv[rootIndex + 1] ? path.resolve(argv[rootIndex + 1]) : DEFAULT_ROOT;
}

function result(payload, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    ...(isError ? { isError: true } : {}),
  };
}

async function loadEvidence(root) {
  try {
    const evidencePath = resolveProjectPath(root, "mcp_review_evidence.json", { requireExisting: true });
    return JSON.parse(await readFile(evidencePath, "utf8"));
  } catch {
    return {
      verification: {},
      github: {},
      live: {},
      evidence_status: "missing_or_invalid",
    };
  }
}

function assertReviewablePath(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\.\//, "");
  if (EXCLUDED_READ_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    throw new Error("path category is not exposed by this review server");
  }
}

export function createReviewServer(root) {
  const server = new McpServer(
    { name: "3q-growth-loop-review", version: "0.1.0" },
    {
      instructions: [
        "Use review_inventory before reading files.",
        "Use review_findings and deployment_gate before recommending any release action.",
        "This server is read-only and never authorizes deploy, merge, publish, secrets, IAM, or data mutation.",
      ].join(" "),
    },
  );

  server.registerTool(
    "review_inventory",
    {
      title: "Review workspace inventory",
      description: "Inventory every workspace file by ownership category and return the owned-source manifest.",
      inputSchema: z.object({ include_files: z.boolean().default(false) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ include_files }) => {
      const inventory = await inventoryWorkspace(root);
      if (!include_files) delete inventory.files;
      return result(inventory);
    },
  );

  server.registerTool(
    "review_findings",
    {
      title: "Read confirmed review findings",
      description: "Return normalized confirmed findings, optionally filtered by severity and resolution status.",
      inputSchema: z.object({
        severity: z.enum(["high", "medium", "low", "unknown"]).optional(),
        status: z.enum(["unresolved", "resolved", "waived"]).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ severity, status, limit }) => {
      const findings = await loadReviewFindings(root);
      const items = findings.items
        .filter((item) => !severity || item.severity === severity)
        .filter((item) => !status || item.status === status)
        .slice(0, limit);
      return result({ source: findings.source, counts: findings.counts, returned: items.length, items });
    },
  );

  server.registerTool(
    "review_file",
    {
      title: "Read an owned project file",
      description: "Read a UTF-8 project file with containment, symlink, category, and size guards.",
      inputSchema: z.object({
        path: z.string().min(1),
        max_bytes: z.number().int().min(1).max(262_144).default(131_072),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ path: relativePath, max_bytes }) => {
      try {
        assertReviewablePath(relativePath);
        const absolute = resolveProjectPath(root, relativePath, { requireExisting: true });
        const fileStat = await stat(absolute);
        if (!fileStat.isFile()) throw new Error("path is not a regular file");
        if (fileStat.size > max_bytes) throw new Error(`file exceeds max_bytes (${fileStat.size} > ${max_bytes})`);
        const text = await readFile(absolute, "utf8");
        return result({ path: relativePath, bytes: fileStat.size, text });
      } catch (error) {
        return result({ error: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  );

  server.registerTool(
    "deployment_gate",
    {
      title: "Evaluate deployment review gate",
      description: "Combine confirmed findings with current local/GitHub/live evidence and return a fail-closed decision.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const [findings, evidence] = await Promise.all([loadReviewFindings(root), loadEvidence(root)]);
      const gate = calculateDeploymentGate({ findings, ...evidence });
      return result({ gate, finding_counts: findings.counts, evidence_status: evidence.evidence_status ?? "loaded" });
    },
  );

  return server;
}

async function main() {
  const root = parseRoot(process.argv.slice(2));
  const server = createReviewServer(root);
  const transport = new StdioServerTransport();
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
  console.error(`3Q Growth Loop MCP review server: ${root}`);
  await server.connect(transport);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
