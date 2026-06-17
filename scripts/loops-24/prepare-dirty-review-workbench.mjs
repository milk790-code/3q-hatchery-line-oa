#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import fssync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gitWorktreeFingerprint } from './lib/git-worktree-fingerprint.mjs';

const automationId = process.env.LOOPS_AUTOMATION_ID || 'loops-24';
const repoRoot = path.resolve(process.env.LOOPS_REPO_ROOT || process.cwd());
const codexHome = process.env.CODEX_HOME
  || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.codex') : path.join(os.homedir(), '.codex'));
const stateDir = path.resolve(process.env.LOOPS_STATE_DIR || path.join(codexHome, 'automations', automationId));
const args = parseArgs(process.argv.slice(2));
const dirtyJsonPath = path.resolve(args.dirtyJson || path.join(stateDir, 'dirty-worktree', 'latest.json'));
const outputDir = path.join(stateDir, 'dirty-review-workbench');
const now = new Date();
const stamp = toStamp(now);

const dirty = await readJson(dirtyJsonPath);
const currentStatusLines = runGit(['status', '--short']).split(/\r?\n/).filter(Boolean);
const currentStatusFingerprint = gitWorktreeFingerprint({ cwd: repoRoot, statusLines: currentStatusLines });
const sourceCurrent = dirty.statusFingerprint === currentStatusFingerprint;
const groups = new Map((dirty.groups || []).map(group => [group.id, group]));
const deploy = groupPaths(groups.get('deploy'));
const debugArtifacts = groupPaths(groups.get('debug-artifacts'));
const other = groupPaths(groups.get('other'));
const repoHygiene = groupPaths(groups.get('repo-hygiene'));
const hasUnknownScope = other.length > 0;

const reviewCommands = [
  'git status --short',
  ...(deploy.length ? [`git diff -- ${deploy.map(shellQuote).join(' ')}`] : []),
  ...(debugArtifacts.length ? ['git diff --name-status -- _debug/deploy'] : []),
];
const decisionOptions = [
  ...(deploy.length ? [{
    id: 'review_deploy_paths',
    label: 'Review deploy-gated Worker diff',
    status: 'manual_review',
    ownerAction: 'Review the deploy-gated diff separately from debug cleanup before any Worker deploy or PR publication decision.',
    commands: [`git diff -- ${deploy.map(shellQuote).join(' ')}`],
    affectedPaths: deploy,
  }] : []),
  ...(debugArtifacts.length ? [{
    id: 'restore_debug_artifacts',
    label: 'Restore tracked debug artifacts',
    status: 'owner_approval_required',
    ownerAction: 'Restore tracked _debug/deploy files from HEAD if the deletion was accidental.',
    commands: ['git restore -- _debug/deploy'],
    affectedPaths: debugArtifacts,
  }, {
    id: 'commit_debug_artifact_cleanup',
    label: 'Commit debug artifact cleanup separately',
    status: 'owner_approval_required',
    ownerAction: 'If the _debug/deploy deletion is intentional, commit it as a standalone cleanup slice before PR publication or deploy approval.',
    commands: [
      'git add -- _debug/deploy',
      'git commit -m "Clean up debug deploy artifacts"',
    ],
    affectedPaths: debugArtifacts,
  }] : []),
  ...(repoHygiene.length ? [{
    id: 'review_repo_hygiene_paths',
    label: 'Review repo-hygiene changes',
    status: 'manual_review',
    ownerAction: 'Keep LoopOS control-plane changes separate from deploy and debug cleanup.',
    commands: [`git diff -- ${repoHygiene.map(shellQuote).join(' ')}`],
    affectedPaths: repoHygiene,
  }] : []),
  ...(other.length ? [{
    id: 'triage_other_paths',
    label: 'Triage unknown dirty paths',
    status: 'owner_approval_required',
    ownerAction: 'Assign each unknown path to a named slice before staging, committing, deploy, or PR publication.',
    commands: [`git diff -- ${other.map(shellQuote).join(' ')}`],
    affectedPaths: other,
  }] : []),
];

const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  stateDir,
  dirtyJsonPath,
  dirtyReportPath: dirty.reportPath || null,
  reportPath: path.join(outputDir, `${stamp}-dirty-review-workbench.md`),
  jsonPath: path.join(outputDir, `${stamp}-dirty-review-workbench.json`),
  latestPath: path.join(outputDir, 'latest.json'),
  sourceStatusFingerprint: dirty.statusFingerprint || null,
  currentStatusFingerprint,
  sourceCurrent,
  status: sourceCurrent
    ? (hasUnknownScope ? 'needs-manual-triage' : (dirty.summary?.total ? 'ready-for-owner-review' : 'clean'))
    : 'stale-source',
  summary: {
    total: Number(dirty.summary?.total || 0),
    deploy: deploy.length,
    debugArtifacts: debugArtifacts.length,
    repoHygiene: repoHygiene.length,
    investor: Number(dirty.summary?.investor || 0),
    other: other.length,
    sourceCurrent,
    decisionOptionCount: decisionOptions.length,
    ownerApprovalRequiredCount: decisionOptions.filter(item => item.status === 'owner_approval_required').length,
  },
  reviewCommands,
  decisionOptions,
  hardStops: [
    'This workbench is a local review handoff only; it does not run git restore, git add, git commit, git push, gh pr create, wrangler deploy, or outbound sends.',
    'Do not mix debug artifact cleanup with Worker deploy, PR publication, investor materials, or outreach sending.',
    'Do not run owner_approval_required commands until Hsuehyi explicitly chooses that option.',
    'Do not print or store secret values in dirty review artifacts.',
  ],
};

payload.statusFingerprint = hash(JSON.stringify({
  dirtyReportPath: payload.dirtyReportPath,
  dirtyJsonPath: payload.dirtyJsonPath,
  sourceStatusFingerprint: payload.sourceStatusFingerprint,
  currentStatusFingerprint: payload.currentStatusFingerprint,
  status: payload.status,
  summary: payload.summary,
  decisionOptions: payload.decisionOptions.map(option => ({
    id: option.id,
    status: option.status,
    commands: option.commands,
    affectedPaths: option.affectedPaths,
  })),
}));

const latest = await readJson(payload.latestPath, null);
if (latest?.statusFingerprint === payload.statusFingerprint
  && latest?.reportPath
  && fssync.existsSync(latest.reportPath)) {
  console.log(JSON.stringify({
    ok: true,
    reused: true,
    reportPath: latest.reportPath,
    jsonPath: latest.jsonPath,
    status: latest.status,
    summary: latest.summary,
  }, null, 2));
  process.exit(0);
}

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(payload.jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  reused: false,
  reportPath: payload.reportPath,
  jsonPath: payload.jsonPath,
  status: payload.status,
  summary: payload.summary,
}, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--dirty-json') {
      parsed.dirtyJson = argv[index + 1];
      index += 1;
    }
  }
  return parsed;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (arguments.length > 1) return fallback;
    throw new Error(`Unable to read JSON at ${file}: ${error.message}`);
  }
}

function renderMarkdown(payload) {
  const lines = [
    '# LOOPS Dirty Review Workbench',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- repo: ${payload.repoRoot}`,
    `- status: ${payload.status}`,
    `- source_current: ${payload.sourceCurrent}`,
    `- dirty_report: ${payload.dirtyReportPath || '(missing)'}`,
    `- status_fingerprint: ${payload.statusFingerprint}`,
    '',
    '## Summary',
    '',
    `- total: ${payload.summary.total}`,
    `- deploy: ${payload.summary.deploy}`,
    `- debug_artifacts: ${payload.summary.debugArtifacts}`,
    `- repo_hygiene: ${payload.summary.repoHygiene}`,
    `- investor: ${payload.summary.investor}`,
    `- other: ${payload.summary.other}`,
    `- owner_approval_required: ${payload.summary.ownerApprovalRequiredCount}`,
    '',
    '## Read-Only Review Commands',
    '',
    '```powershell',
    ...payload.reviewCommands,
    '```',
    '',
    '## Owner Decision Options',
    '',
  ];

  if (!payload.decisionOptions.length) {
    lines.push('- No dirty paths need owner decision.');
  } else {
    for (const option of payload.decisionOptions) {
      lines.push(`### ${option.label}`);
      lines.push('');
      lines.push(`- id: ${option.id}`);
      lines.push(`- status: ${option.status}`);
      lines.push(`- owner_action: ${option.ownerAction}`);
      lines.push(`- affected_paths: ${option.affectedPaths.length}`);
      if (option.affectedPaths.length) {
        for (const item of option.affectedPaths.slice(0, 30)) lines.push(`  - \`${item}\``);
        if (option.affectedPaths.length > 30) lines.push(`  - ... ${option.affectedPaths.length - 30} more paths omitted`);
      }
      lines.push('');
      lines.push('```powershell');
      for (const command of option.commands) lines.push(command);
      lines.push('```');
      lines.push('');
    }
  }

  lines.push('## Hard Stops');
  lines.push('');
  for (const stop of payload.hardStops) lines.push(`- ${stop}`);
  return lines.join('\n');
}

function groupPaths(group) {
  return Array.isArray(group?.paths) ? group.paths.slice() : [];
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

function runGit(args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  }
  return result.stdout || '';
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}
