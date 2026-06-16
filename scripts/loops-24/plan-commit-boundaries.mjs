#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const automationId = process.env.LOOPS_AUTOMATION_ID || 'loops-24';
const repoRoot = path.resolve(process.env.LOOPS_REPO_ROOT || process.cwd());
const codexHome = process.env.CODEX_HOME
  || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.codex') : path.join(os.homedir(), '.codex'));
const stateDir = path.resolve(process.env.LOOPS_STATE_DIR || path.join(codexHome, 'automations', automationId));
const planDir = path.join(stateDir, 'commit-boundaries');

const statusLines = runGit(['status', '--short']).split(/\r?\n/).filter(Boolean);
const detailStatusLines = runGit(['status', '--short', '--untracked-files=all']).split(/\r?\n/).filter(Boolean);
const now = new Date();
const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const statusFingerprint = hash(statusLines.join('\n'));
const reportPath = path.join(planDir, `${stamp}-commit-boundaries.md`);
const jsonPath = path.join(planDir, `${stamp}-commit-boundaries.json`);
const latestPath = path.join(planDir, 'latest.json');

const records = detailStatusLines.map(parseStatusLine);
const groups = buildGroups(records);
const summary = {
  total: records.length,
  staged: records.filter(record => record.index !== ' ' && record.index !== '?').length,
  modified: records.filter(record => record.worktree !== ' ').length,
  untracked: records.filter(record => record.status === '??').length,
};

await fs.mkdir(planDir, { recursive: true });

const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  statusFingerprint,
  detailFingerprint: hash(detailStatusLines.join('\n')),
  summary,
  reportPath,
  jsonPath,
  groups: groups.map(group => ({
    id: group.id,
    title: group.title,
    gate: group.gate,
    recommendation: group.recommendation,
    counts: countsFor(group.records),
    paths: group.records.map(record => record.path),
  })),
};

await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  reportPath,
  jsonPath,
  statusFingerprint,
  changedPaths: records.length,
  groups: payload.groups.map(group => ({ id: group.id, count: group.counts.total, gate: group.gate })),
}, null, 2));

function buildGroups(inputRecords) {
  const definitions = [
    {
      id: 'loops_control_plane',
      title: 'LOOPS control plane and local automation',
      gate: 'local-review',
      recommendation: 'Commit separately. This slice is mostly local automation and docs; keep it away from Worker deploy changes.',
      match: pathName => [
        '.gitignore',
        'docs/loops-24-runner.md',
        'scripts/loops-hourly-runner.mjs',
        'scripts/loops.tasks.json',
        'scripts/loops.cold-outreach.tasks.json',
        'scripts/outreach.prospects.json',
        'scripts/google-business-prospector.mjs',
      ].includes(pathName)
        || pathName.startsWith('scripts/loops-24/')
        || pathName.startsWith('scripts/lib/'),
    },
    {
      id: 'webhook_cron_outcome',
      title: 'Webhook cron outcome instrumentation',
      gate: 'deploy-approval',
      recommendation: 'Review and commit separately. Deploy only after approval because this changes live Worker cron behavior.',
      match: pathName => pathName === 'webhook/worker.js' || pathName === 'webhook/wrangler.toml',
    },
    {
      id: 'content_queue_assets',
      title: 'Content queue and render manifest baseline',
      gate: 'content-review',
      recommendation: 'Commit separately from Worker code. Verify image filenames and queue reconciliation before publishing new posts.',
      match: pathName => pathName === 'assets/exports/_render-manifest.json'
        || pathName.startsWith('db/migrations/'),
    },
    {
      id: 'social_publisher_worker',
      title: 'Social publisher Worker changes',
      gate: 'deploy-approval',
      recommendation: 'Hold for a dedicated Worker review. Live queue verification still needs SOCIAL_PUBLISHER_TOKEN/TRIGGER_TOKEN.',
      match: pathName => pathName.startsWith('workers/social-publisher/'),
    },
    {
      id: 'project_state_docs',
      title: 'Project state documentation',
      gate: 'local-review',
      recommendation: 'Commit only after confirming the normalized text is the intended project-state source of truth.',
      match: pathName => pathName === 'PROJECT-STATE.md',
    },
    {
      id: 'frontend_artifacts',
      title: 'Frontend/art portfolio artifacts',
      gate: 'large-payload-review',
      recommendation: 'Do not mix with LOOPS. This is a broad payload and should be split, previewed, or parked before any public push.',
      match: pathName => [
        'art-portfolio/',
        'design-showcase/',
        'export/',
        'shared/',
        'token-editor/',
      ].some(prefix => pathName.startsWith(prefix)),
    },
    {
      id: 'agent_tooling',
      title: 'Agent/plugin/tooling workspace files',
      gate: 'local-review',
      recommendation: 'Review before committing. Some files may be local tooling rather than project source.',
      match: pathName => [
        '.agents/',
        '.claude/',
        'plugins/',
        'scripts/.agents/',
        'scripts/plugin-batch/',
      ].some(prefix => pathName.startsWith(prefix)),
    },
  ];

  const buckets = definitions.map(definition => ({ ...definition, records: [] }));
  const other = {
    id: 'other',
    title: 'Other changed paths',
    gate: 'manual-review',
    recommendation: 'Review manually before assigning to a commit slice.',
    records: [],
  };

  for (const record of inputRecords) {
    const bucket = buckets.find(group => group.match(record.path));
    if (bucket) bucket.records.push(record);
    else other.records.push(record);
  }

  return [...buckets, other].filter(group => group.records.length > 0);
}

function renderMarkdown(payload) {
  const lines = [
    '# LOOPS Commit Boundary Plan',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- repo: ${payload.repoRoot}`,
    `- status_fingerprint: ${payload.statusFingerprint}`,
    `- total_changed_paths: ${payload.summary.total}`,
    `- staged_or_index_changes: ${payload.summary.staged}`,
    `- worktree_modified: ${payload.summary.modified}`,
    `- untracked: ${payload.summary.untracked}`,
    '',
    '## Suggested Sequence',
    '',
    '1. Commit LOOPS control-plane changes by themselves after review.',
    '2. Commit content queue / manifest baseline separately after reconciliation stays clean.',
    '3. Hold webhook and social-publisher Worker changes until deploy approval and required tokens are available.',
    '4. Split the large frontend/artifacts payload into its own review path; do not mix it with automation or Worker changes.',
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
    for (const item of group.paths.slice(0, 80)) {
      lines.push(`- \`${item}\``);
    }
    if (group.paths.length > 80) {
      lines.push(`- ... ${group.paths.length - 80} more paths omitted`);
    }
    lines.push('');
  }

  lines.push('## Hard Stops');
  lines.push('');
  lines.push('- Do not deploy Workers from this worktree until the Worker slices are reviewed separately.');
  lines.push('- Do not add secrets to repo files. Use environment variables or platform secret stores only.');
  lines.push('- Do not push the broad frontend/artifacts payload until it has its own preview/review path.');
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

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}
