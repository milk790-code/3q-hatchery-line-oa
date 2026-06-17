#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { stringifyPortableJson } from './lib/portable-json.mjs';

const automationId = process.env.LOOPS_AUTOMATION_ID || 'loops-24';
const repoRoot = path.resolve(process.env.LOOPS_REPO_ROOT || process.cwd());
const codexHome = process.env.CODEX_HOME
  || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.codex') : path.join(os.homedir(), '.codex'));
const stateDir = path.resolve(process.env.LOOPS_STATE_DIR || path.join(codexHome, 'automations', automationId));
const args = parseArgs(process.argv.slice(2));
const dashboardJsonPath = path.resolve(args.dashboardJson || path.join(stateDir, 'dashboard', 'latest.json'));
const dashboardMarkdownPath = path.resolve(args.dashboardMarkdown || path.join(stateDir, 'dashboard', 'latest.md'));
const showDashboardPath = path.resolve(args.showDashboard || path.join(repoRoot, 'scripts', 'loops-24', 'show-dashboard.ps1'));
const verificationDir = path.join(stateDir, 'dashboard-display-verifications');
const showDashboardTimeoutMs = Number.parseInt(process.env.LOOPS_SHOW_DASHBOARD_TIMEOUT_MS || '60000', 10);
const now = new Date();
const stamp = toStamp(now);

const dashboard = await readJson(dashboardJsonPath);
const markdown = await readText(dashboardMarkdownPath);
const display = runShowDashboard(showDashboardPath);
const findings = verifyDisplay({ dashboard, markdown, display });
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  automationId,
  stateDir,
  dashboardJsonPath,
  dashboardMarkdownPath,
  showDashboardPath,
  reportPath: path.join(verificationDir, `${stamp}-dashboard-display.md`),
  jsonPath: path.join(verificationDir, `${stamp}-dashboard-display.json`),
  latestPath: path.join(verificationDir, 'latest.json'),
  ok: findings.failures.length === 0,
  summary: {
    exitCode: display.exitCode,
    stdoutBytes: Buffer.byteLength(display.stdout, 'utf8'),
    stderrBytes: Buffer.byteLength(display.stderr, 'utf8'),
    requiredSectionCount: findings.requiredSections.length,
    checkedProspectNameCount: findings.checkedProspectNames.length,
    checkedThreadAttentionCount: findings.checkedThreadAttentionIds.length,
    checkedDirtyDecisionOptionCount: findings.checkedDirtyDecisionOptionIds.length,
    checkedApprovalReadyCommandCount: findings.checkedApprovalReadyCommandIds.length,
    failureCount: findings.failures.length,
    warningCount: findings.warnings.length,
  },
  findings,
  statusFingerprint: hash(JSON.stringify({
    dashboardRunId: dashboard.runId || null,
    dashboardGeneratedAt: dashboard.generatedAt || null,
    showDashboardPath,
    findings,
  })),
};

await fs.mkdir(verificationDir, { recursive: true });
const payloadJson = stringifyPortableJson(payload);
await fs.writeFile(payload.jsonPath, payloadJson, 'utf8');
await fs.writeFile(payload.latestPath, payloadJson, 'utf8');
await fs.writeFile(payload.reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: payload.ok,
  reportPath: payload.reportPath,
  jsonPath: payload.jsonPath,
  summary: payload.summary,
}, null, 2));

if (!payload.ok) process.exitCode = 1;

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dashboard-json') {
      parsed.dashboardJson = argv[index + 1];
      index += 1;
    } else if (arg === '--dashboard-markdown') {
      parsed.dashboardMarkdown = argv[index + 1];
      index += 1;
    } else if (arg === '--show-dashboard') {
      parsed.showDashboard = argv[index + 1];
      index += 1;
    }
  }
  return parsed;
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read JSON at ${file}: ${error.message}`);
  }
}

async function readText(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    throw new Error(`Unable to read text at ${file}: ${error.message}`);
  }
}

function runShowDashboard(file) {
  const command = [
    '$ErrorActionPreference = "Stop"',
    '$OutputEncoding = [System.Text.UTF8Encoding]::new($false)',
    '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)',
    `& ${quotePowerShell(file)} -NoSnapshotCheck`,
    'exit $LASTEXITCODE',
  ].join('; ');

  const result = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 5 * 1024 * 1024,
    timeout: showDashboardTimeoutMs,
  });

  return {
    exitCode: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? result.error.message : null,
  };
}

function verifyDisplay({ dashboard, markdown, display }) {
  const failures = [];
  const warnings = [];
  const requiredSections = [
    '# LoopOS Morning Decision Dashboard',
    '## Today First',
    '## Safe Local Actions Completed',
    '## Manual Red Lines',
    '## Next Approval Gate',
  ];

  if (display.error) failures.push(`show-dashboard process error: ${display.error}`);
  if (display.exitCode !== 0) failures.push(`show-dashboard exit code expected 0 got ${display.exitCode}`);
  if (display.stderr.trim()) failures.push(`show-dashboard stderr is not empty: ${display.stderr.trim().slice(0, 300)}`);

  for (const section of requiredSections) {
    if (!display.stdout.includes(section)) failures.push(`show-dashboard output missing section: ${section}`);
    if (!markdown.includes(section)) failures.push(`dashboard markdown missing section: ${section}`);
  }

  const forbiddenFragments = [
    'Could not read JSON',
    'Invalid object passed',
    'ConvertFrom-Json',
    'System.Management.Automation',
    '\uFFFD',
  ];
  for (const fragment of forbiddenFragments) {
    if (display.stdout.includes(fragment) || display.stderr.includes(fragment)) {
      failures.push(`show-dashboard output contains forbidden fragment: ${fragment}`);
    }
  }

  if (dashboard.runId && !display.stdout.includes(dashboard.runId)) {
    failures.push(`show-dashboard output missing run_id ${dashboard.runId}`);
  }
  if (dashboard.summary?.nextApproval && !display.stdout.includes(String(dashboard.summary.nextApproval))) {
    failures.push(`show-dashboard output missing summary nextApproval ${dashboard.summary.nextApproval}`);
  }

  const checkedProspectNames = (dashboard.manualSendReview?.prospects || [])
    .map(item => item.name)
    .filter(Boolean)
    .slice(0, 5);
  for (const name of checkedProspectNames) {
    if (!display.stdout.includes(name)) {
      failures.push(`show-dashboard output missing manual-send prospect name: ${name}`);
    }
  }

  const checkedThreadAttentionIds = (dashboard.connectorHealth?.threadAttention || [])
    .map(item => item.id)
    .filter(Boolean);
  if (checkedThreadAttentionIds.length && !display.stdout.includes('- thread_attention:')) {
    failures.push('show-dashboard output missing connector thread_attention summary.');
  }
  for (const id of checkedThreadAttentionIds) {
    if (!display.stdout.includes(`${id}(`) && !display.stdout.includes(`${id}:`)) {
      failures.push(`show-dashboard output missing thread attention connector id: ${id}`);
    }
  }

  const checkedDirtyDecisionOptionIds = (dashboard.dirtyReviewWorkbench?.decisionOptions || [])
    .map(item => item.id)
    .filter(Boolean);
  if (checkedDirtyDecisionOptionIds.length && !display.stdout.includes('- decision_option_details:')) {
    failures.push('show-dashboard output missing dirty review decision_option_details summary.');
  }
  for (const id of checkedDirtyDecisionOptionIds) {
    if (!display.stdout.includes(`${id}:`)) {
      failures.push(`show-dashboard output missing dirty review decision option id: ${id}`);
    }
  }

  const checkedApprovalReadyCommandIds = (dashboard.approvalWorkbench?.readyCommands || [])
    .map(item => item.id)
    .filter(Boolean);
  if (checkedApprovalReadyCommandIds.length && !display.stdout.includes('- ready_command_details:')) {
    failures.push('show-dashboard output missing approval workbench ready_command_details summary.');
  }
  for (const id of checkedApprovalReadyCommandIds) {
    if (!display.stdout.includes(`${id}:`)) {
      failures.push(`show-dashboard output missing approval ready command id: ${id}`);
    }
  }

  const markdownLineCount = markdown.split(/\r?\n/).length;
  const outputLineCount = display.stdout.split(/\r?\n/).length;
  if (outputLineCount < Math.max(20, Math.floor(markdownLineCount * 0.7))) {
    warnings.push(`show-dashboard output line count ${outputLineCount} is much smaller than markdown line count ${markdownLineCount}`);
  }

  return {
    failures,
    warnings,
    requiredSections,
    checkedProspectNames,
    checkedThreadAttentionIds,
    checkedDirtyDecisionOptionIds,
    checkedApprovalReadyCommandIds,
  };
}

function renderMarkdown(payload) {
  const lines = [
    '# LOOPS Dashboard Display Verification',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- ok: ${payload.ok}`,
    `- dashboard_json: ${payload.dashboardJsonPath}`,
    `- dashboard_markdown: ${payload.dashboardMarkdownPath}`,
    `- show_dashboard: ${payload.showDashboardPath}`,
    `- exit_code: ${payload.summary.exitCode}`,
    `- stdout_bytes: ${payload.summary.stdoutBytes}`,
    `- stderr_bytes: ${payload.summary.stderrBytes}`,
    `- checked_prospect_names: ${payload.summary.checkedProspectNameCount}`,
    `- checked_thread_attention: ${payload.summary.checkedThreadAttentionCount}`,
    `- checked_dirty_decision_options: ${payload.summary.checkedDirtyDecisionOptionCount}`,
    `- checked_approval_ready_commands: ${payload.summary.checkedApprovalReadyCommandCount}`,
    `- failures: ${payload.summary.failureCount}`,
    `- warnings: ${payload.summary.warningCount}`,
    '',
    '## Failures',
    '',
    ...(payload.findings.failures.length ? payload.findings.failures.map(item => `- ${item}`) : ['- none']),
    '',
    '## Warnings',
    '',
    ...(payload.findings.warnings.length ? payload.findings.warnings.map(item => `- ${item}`) : ['- none']),
    '',
    '## Safety Contract',
    '',
    '- This verifier reads local dashboard artifacts and runs the local dashboard display script only.',
    '- It does not push, create PRs, deploy, call protected endpoints, write secrets, change scheduled tasks, or send messages.',
  ];
  return lines.join('\n');
}

function quotePowerShell(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}
