#!/usr/bin/env node
import { promises as fs } from 'node:fs';
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
const outputDir = path.join(stateDir, 'dirty-worktree');
const now = new Date();
const stamp = toStamp(now);

const statusLines = runGit(['status', '--short']).split(/\r?\n/).filter(Boolean);
const detailStatusLines = runGit(['status', '--short', '--untracked-files=all']).split(/\r?\n/).filter(Boolean);
const records = detailStatusLines.map(parseStatusLine);
const groups = classify(records);
const statusFingerprint = gitWorktreeFingerprint({ cwd: repoRoot, statusLines });

const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  stateDir,
  reportPath: path.join(outputDir, `${stamp}-dirty-worktree.md`),
  jsonPath: path.join(outputDir, `${stamp}-dirty-worktree.json`),
  latestPath: path.join(outputDir, 'latest.json'),
  statusFingerprint,
  detailFingerprint: hash(detailStatusLines.join('\n')),
  summary: {
    total: records.length,
    deploy: groups.deploy.records.length,
    investor: groups.investor.records.length,
    repoHygiene: groups.repo_hygiene.records.length,
    debugArtifacts: groups.debug_artifacts.records.length,
    other: groups.other.records.length,
  },
  groups: Object.values(groups).map(group => ({
    id: group.id,
    title: group.title,
    gate: group.gate,
    recommendation: group.recommendation,
    counts: countsFor(group.records),
    paths: group.records.map(record => record.path),
  })),
};

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(payload.jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  reportPath: payload.reportPath,
  jsonPath: payload.jsonPath,
  statusFingerprint,
  summary: payload.summary,
}, null, 2));

function classify(inputRecords) {
  const groups = {
    deploy: {
      id: 'deploy',
      title: 'Deploy-gated Worker / runtime changes',
      gate: 'deploy-approval',
      recommendation: 'Review separately and do not deploy until owner approval, token input, and protected verification are ready.',
      records: [],
    },
    investor: {
      id: 'investor',
      title: 'Investor / fundraising materials',
      gate: 'investor-review',
      recommendation: 'Review separately before staging, sharing, sending, or publishing.',
      records: [],
    },
    repo_hygiene: {
      id: 'repo-hygiene',
      title: 'Repo hygiene / LoopOS control plane',
      gate: 'local-review',
      recommendation: 'Safe to review locally; commit separately from deploy and investor materials after verification.',
      records: [],
    },
    debug_artifacts: {
      id: 'debug-artifacts',
      title: 'Debug / deploy evidence artifacts',
      gate: 'local-review',
      recommendation: 'Review separately; if intentional, commit as cleanup, otherwise restore before PR publication or deploy approval.',
      records: [],
    },
    other: {
      id: 'other',
      title: 'Other changed paths',
      gate: 'manual-review',
      recommendation: 'Assign manually before staging or committing.',
      records: [],
    },
  };

  for (const record of inputRecords) {
    if (isDeployPath(record.path)) groups.deploy.records.push(record);
    else if (record.path.startsWith('investor-packet/')) groups.investor.records.push(record);
    else if (isRepoHygienePath(record.path)) groups.repo_hygiene.records.push(record);
    else if (isDebugArtifactPath(record.path)) groups.debug_artifacts.records.push(record);
    else groups.other.records.push(record);
  }
  return groups;
}

function isDeployPath(pathName) {
  return pathName.startsWith('webhook/')
    || pathName.startsWith('workers/')
    || pathName.startsWith('db/migrations/')
    || /(^|\/)wrangler\.toml$/.test(pathName)
    || /(^|\/)worker\.js$/.test(pathName);
}

function isRepoHygienePath(pathName) {
  return pathName === '.gitignore'
    || pathName === 'PROJECT-STATE.md'
    || pathName === 'docs/loops-24-runner.md'
    || pathName === 'scripts/loops-hourly-runner.mjs'
    || pathName === 'scripts/loops.tasks.json'
    || pathName === 'scripts/loops.cold-outreach.tasks.json'
    || pathName === 'scripts/outreach.prospects.json'
    || pathName === 'scripts/google-business-prospector.mjs'
    || pathName.startsWith('scripts/loops-24/')
    || pathName.startsWith('scripts/lib/')
    || pathName.startsWith('.agents/')
    || pathName.startsWith('.claude/');
}

function isDebugArtifactPath(pathName) {
  return pathName.startsWith('_debug/');
}

function renderMarkdown(payload) {
  const lines = [
    '# LOOPS Dirty Worktree Classification',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- repo: ${payload.repoRoot}`,
    `- status_fingerprint: ${payload.statusFingerprint}`,
    `- total_changed_paths: ${payload.summary.total}`,
    '',
    '## Summary',
    '',
    `- deploy: ${payload.summary.deploy}`,
    `- investor: ${payload.summary.investor}`,
    `- repo_hygiene: ${payload.summary.repoHygiene}`,
    `- debug_artifacts: ${payload.summary.debugArtifacts}`,
    `- other: ${payload.summary.other}`,
    '',
    '## Groups',
    '',
  ];

  for (const group of payload.groups) {
    lines.push(`### ${group.title}`);
    lines.push('');
    lines.push(`- id: ${group.id}`);
    lines.push(`- gate: ${group.gate}`);
    lines.push(`- recommendation: ${group.recommendation}`);
    lines.push(`- total: ${group.counts.total}; staged: ${group.counts.staged}; modified: ${group.counts.modified}; untracked: ${group.counts.untracked}`);
    lines.push('');
    if (group.paths.length === 0) {
      lines.push('- (none)');
    } else {
      for (const item of group.paths.slice(0, 80)) lines.push(`- \`${item}\``);
      if (group.paths.length > 80) lines.push(`- ... ${group.paths.length - 80} more paths omitted`);
    }
    lines.push('');
  }

  lines.push('## Hard Stops');
  lines.push('');
  lines.push('- Do not stage deploy paths until deploy approval exists.');
  lines.push('- Do not send, share, or publish investor paths without explicit investor-review approval.');
  lines.push('- Do not mix debug artifact cleanup with deploy, PR publication, or investor materials.');
  lines.push('- Keep repo-hygiene changes separate from deploy and investor slices.');
  return lines.join('\n');
}

function countsFor(inputRecords) {
  return {
    total: inputRecords.length,
    staged: inputRecords.filter(record => record.index !== ' ' && record.index !== '?').length,
    modified: inputRecords.filter(record => record.worktree !== ' ').length,
    untracked: inputRecords.filter(record => record.status === '??').length,
  };
}

function parseStatusLine(line) {
  const status = line.slice(0, 2);
  return {
    status,
    index: status[0],
    worktree: status[1],
    path: line.slice(3).replaceAll('\\', '/'),
    raw: line,
  };
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
