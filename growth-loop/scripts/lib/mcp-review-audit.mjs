import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { resolveProjectPath } from "./mcp-review-core.mjs";

const execFileAsync = promisify(execFile);
const JAVASCRIPT_EXTENSIONS = new Set([".cjs", ".js", ".mjs"]);

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

export async function auditOwnedFiles(root, inventory) {
  const sourceFiles = inventory.owned_source_files;
  const javascriptFiles = sourceFiles.filter((file) => JAVASCRIPT_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const jsonFiles = inventory.files
    .filter((file) => file.category === "owned" && path.extname(file.path).toLowerCase() === ".json")
    .map((file) => file.path);

  const javascriptResults = await mapWithConcurrency(javascriptFiles, 8, async (relativePath) => {
    const absolute = resolveProjectPath(root, relativePath, { requireExisting: true });
    try {
      await execFileAsync(process.execPath, ["--check", absolute], { maxBuffer: 1024 * 1024 });
      return null;
    } catch {
      return { path: relativePath, error: "syntax_check_failed" };
    }
  });

  const jsonResults = await mapWithConcurrency(jsonFiles, 16, async (relativePath) => {
    try {
      const absolute = resolveProjectPath(root, relativePath, { requireExisting: true });
      JSON.parse(await readFile(absolute, "utf8"));
      return null;
    } catch {
      return { path: relativePath, error: "invalid_json" };
    }
  });

  const sourceManifest = await mapWithConcurrency(sourceFiles, 16, async (relativePath) => {
    const absolute = resolveProjectPath(root, relativePath, { requireExisting: true });
    const buffer = await readFile(absolute);
    return {
      path: relativePath,
      bytes: buffer.byteLength,
      sha256: createHash("sha256").update(buffer).digest("hex"),
    };
  });

  const sensitiveFilenames = inventory.files
    .filter((file) => {
      const name = path.basename(file.path).toLowerCase();
      return name === ".env" || name.startsWith(".env.") || ["auth.json", "credentials.json", "id_rsa", "id_ed25519"].includes(name);
    })
    .map((file) => ({ path: file.path, category: file.category }));

  return {
    javascript: {
      checked: javascriptFiles.length,
      failed: javascriptResults.filter(Boolean),
    },
    json: {
      checked: jsonFiles.length,
      failed: jsonResults.filter(Boolean),
    },
    source_manifest: sourceManifest,
    sensitive_filenames: sensitiveFilenames,
  };
}
