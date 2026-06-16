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
const snapDir = path.join(stateDir, 'worktree-snapshots');

const status = runGit(['status', '--short']).split(/\r?\n/).filter(Boolean);
const loopsStatus = runGit([
  'status',
  '--short',
  '--',
  '.gitignore',
  'docs/loops-24-runner.md',
  'scripts/loops-hourly-runner.mjs',
  'scripts/loops.tasks.json',
  'scripts/outreach.prospects.json',
  'scripts/lib',
  'scripts/loops-24',
]).split(/\r?\n/).filter(Boolean);

const now = new Date();
const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const reportPath = path.join(snapDir, `${stamp}-worktree.md`);
const latestPath = path.join(snapDir, 'latest.json');
const statusFingerprint = hash(status.join('\n'));

const staged = status.filter(line => line[0] && line[0] !== ' ' && !line.startsWith('??'));
const modified = status.filter(line => line[1] && line[1] !== ' ');
const untracked = status.filter(line => line.startsWith('??'));
const wrangler = status.filter(line => /\.wrangler[\\/]/.test(line));

await fs.mkdir(snapDir, { recursive: true });

const lines = [
  '# LOOPS Worktree Snapshot',
  '',
  `- generated_at: ${now.toISOString()}`,
  `- repo: ${repoRoot}`,
  `- status_fingerprint: ${statusFingerprint}`,
  `- total_changed_paths: ${status.length}`,
  `- staged_or_index_changes: ${staged.length}`,
  `- worktree_modified: ${modified.length}`,
  `- untracked: ${untracked.length}`,
  `- wrangler_cache_paths_visible: ${wrangler.length}`,
  '',
  '## Boundary',
  '',
  '- Existing staged work is broad and predates this snapshot; do not mix it with LOOPS commits without review.',
  '- LOOPS-related files are listed separately below.',
  '- `.wrangler/cache` and `.wrangler/tmp` paths are present in git status; inspect before any public push.',
  '',
  '## LOOPS-related status',
  '',
  ...loopsStatus.map(line => `- \`${line}\``),
  '',
  '## First 80 changed paths',
  '',
  ...status.slice(0, 80).map(line => `- \`${line}\``),
  ...(status.length > 80 ? [`- ... ${status.length - 80} more paths omitted`] : []),
  '',
  '## Suggested next handling',
  '',
  '1. Review whether `.wrangler/cache` and `.wrangler/tmp` should be ignored or removed from staging before any push.',
  '2. Keep LOOPS files in a separate commit/PR from the broad art-portfolio/token-editor payload.',
  '3. Only after that, decide whether the large staged payload should be committed, split, or parked.',
  '',
];

await fs.writeFile(reportPath, `${lines.join('\n')}\n`, 'utf8');
await fs.writeFile(latestPath, `${JSON.stringify({
  generatedAt: now.toISOString(),
  repoRoot,
  reportPath,
  statusFingerprint,
  counts: {
    total: status.length,
    staged: staged.length,
    modified: modified.length,
    untracked: untracked.length,
    wrangler: wrangler.length,
  },
}, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ ok: true, reportPath, statusFingerprint, changedPaths: status.length }, null, 2));

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
