#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { auditOwnedFiles } from "./lib/mcp-review-audit.mjs";
import {
  calculateDeploymentGate,
  inventoryWorkspace,
  loadReviewFindings,
  resolveProjectPath,
} from "./lib/mcp-review-core.mjs";

const root = path.resolve(import.meta.dirname, "..");

function runCheck(name, command, args, timeoutMs = 180_000) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, { cwd: root, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const append = (current, chunk) => `${current}${chunk}`.slice(-4000);
    child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk); });
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        name,
        ok: code === 0,
        exit_code: code,
        signal,
        duration_ms: Date.now() - startedAt,
        output_tail: `${stdout}\n${stderr}`.trim().slice(-2000),
      });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ name, ok: false, exit_code: null, signal: null, duration_ms: Date.now() - startedAt, error: error.message });
    });
  });
}

async function checkFindingLocations(findings) {
  const checks = [];
  for (const finding of findings.items) {
    try {
      const absolute = resolveProjectPath(root, finding.file, { requireExisting: true });
      const text = await readFile(absolute, "utf8");
      const lines = text.split("\n").length;
      checks.push({ id: finding.id, file: finding.file, line: finding.line, file_exists: true, line_in_range: finding.line === null || finding.line <= lines });
    } catch {
      checks.push({ id: finding.id, file: finding.file, line: finding.line, file_exists: false, line_in_range: false });
    }
  }
  return checks;
}

function markdownReport(report) {
  const categoryRows = Object.entries(report.inventory.categories)
    .map(([category, count]) => `| ${category} | ${count} |`)
    .join("\n");
  const checkRows = report.checks
    .map((check) => `| ${check.name} | ${check.ok ? "PASS" : "FAIL"} | ${check.exit_code ?? check.signal ?? "n/a"} | ${check.duration_ms} |`)
    .join("\n");
  const highRows = report.findings.items
    .filter((finding) => finding.status === "unresolved" && finding.severity === "high")
    .map((finding) => `- \`${finding.file}:${finding.line ?? "?"}\` — ${finding.summary}`)
    .join("\n");
  return `# 3Q Growth Loop MCP 全檔案／代碼審核

產生時間：${report.generated_at}

## 結論

- Gate：**${report.gate.status}**
- MCP 可否授權部署：**否**（此服務永遠唯讀；外部部署需人工批准）
- 全部檔案：${report.inventory.total_files}
- Owned source：${report.inventory.owned_source_count}
- Confirmed unresolved HIGH：${report.findings.counts.unresolved_high}
- Confirmed unresolved MEDIUM：${report.findings.counts.unresolved_medium}
- GitHub PR #74：${report.external.github.merged ? "已合併" : "未合併"}
- Live：${report.external.live.deployed ? "已觀察到部署" : "未證實部署"}

## 全檔分類

| 類別 | 檔案數 |
|---|---:|
${categoryRows}

完整逐檔清冊：\`mcp_review_file_inventory.jsonl\`  
Owned source SHA-256 manifest：\`mcp_review_report.json -> source_audit.source_manifest\`

## 驗證

| 檢查 | 結果 | Exit | ms |
|---|---|---:|---:|
${checkRows}

- JavaScript syntax：${report.source_audit.javascript.checked} checked / ${report.source_audit.javascript.failed.length} failed
- JSON parse：${report.source_audit.json.checked} checked / ${report.source_audit.json.failed.length} failed
- Finding locations：${report.finding_locations.filter((item) => item.file_exists && item.line_in_range).length}/${report.finding_locations.length} 可定位
- 敏感檔名候選：${report.source_audit.sensitive_filenames.length}（不輸出內容）

## 未解 HIGH

${highRows || "- 無"}

## 部署上限

本地 gate 狀態為 **${report.gate.status}**。即使所有 HIGH 已有修復與測試證據，最高安全上限仍是：產出新 PR、required check 與 rollback 建議；不得由 MCP 自動 deploy、merge、改 secrets、IAM 或 D1。

## MCP 工具

- \`review_inventory\`
- \`review_findings\`
- \`review_file\`
- \`deployment_gate\`

四者皆標記 read-only / non-destructive；沒有 deploy 或 write tool。
`;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const [inventory, findings, external] = await Promise.all([
    inventoryWorkspace(root),
    loadReviewFindings(root),
    readFile(path.join(root, "mcp_review_evidence.json"), "utf8").then(JSON.parse),
  ]);
  const sourceAudit = await auditOwnedFiles(root, inventory);
  const findingLocations = await checkFindingLocations(findings);

  const checks = [];
  checks.push(await runCheck("unit_tests", process.execPath, ["--test", "scripts/mcp-review-core.test.mjs", "scripts/mcp-review-audit.test.mjs"]));
  checks.push(await runCheck("mcp_stdio_smoke", process.execPath, ["scripts/mcp-review-smoke.mjs"]));
  checks.push(await runCheck("dependency_audit", "npm", ["audit", "--json"]));
  checks.push(await runCheck("worker_dry_run", "npm", ["run", "worker:dry-run"]));
  checks.push(await runCheck("artifact_verifier", process.execPath, ["scripts/verify-artifacts.mjs"]));

  const byName = Object.fromEntries(checks.map((check) => [check.name, check]));
  const verification = {
    tests_passed: byName.unit_tests.ok && byName.mcp_stdio_smoke.ok && byName.artifact_verifier.ok,
    syntax_passed: sourceAudit.javascript.failed.length === 0 && sourceAudit.json.failed.length === 0 && byName.worker_dry_run.ok,
    dependency_audit_passed: byName.dependency_audit.ok,
  };
  const evidence = { ...external, evidence_status: "external_and_local_verified", captured_at: generatedAt, verification };
  const gate = calculateDeploymentGate({ findings, ...evidence });
  const report = {
    schema_version: 1,
    generated_at: generatedAt,
    root,
    inventory: { ...inventory, files: undefined },
    source_audit: sourceAudit,
    finding_locations: findingLocations,
    findings,
    checks,
    external: { github: evidence.github, live: evidence.live },
    gate,
    exclusions: {
      dependency: "inventoried, not treated as owned source; assessed through lockfile and npm audit",
      archive: "inventoried, immutable historical evidence",
      generated: "inventoried, regenerated outputs or export bundles",
      cache: "inventoried, local Wrangler state",
      logs: "inventoried, runtime evidence",
    },
  };

  const inventoryLines = inventory.files.map((file) => JSON.stringify(file)).join("\n") + "\n";
  await writeFile(path.join(root, "mcp_review_file_inventory.jsonl"), inventoryLines, "utf8");
  await writeFile(path.join(root, "mcp_review_evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(path.join(root, "mcp_review_report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path.join(root, "mcp_review_report.md"), markdownReport(report), "utf8");

  await access(path.join(root, "mcp_review_report.json"));
  process.stdout.write(`${JSON.stringify({
    ok: checks.every((check) => check.ok) && sourceAudit.javascript.failed.length === 0 && sourceAudit.json.failed.length === 0,
    total_files: inventory.total_files,
    owned_source_files: inventory.owned_source_count,
    finding_counts: findings.counts,
    gate,
    checks: checks.map(({ name, ok, exit_code, duration_ms }) => ({ name, ok, exit_code, duration_ms })),
  }, null, 2)}\n`);
  if (checks.some((check) => !check.ok) || sourceAudit.javascript.failed.length > 0 || sourceAudit.json.failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
