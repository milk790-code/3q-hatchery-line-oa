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
const auditDir = path.join(stateDir, 'wrangler-audits');

const statusLines = runGit(['status', '--short']).split(/\r?\n/).filter(Boolean);
const wranglerLines = statusLines.filter(line => /(^|[\\/])\.wrangler[\\/]/.test(line.slice(3)));
const records = wranglerLines.map(parseStatusLine);
const now = new Date();
const fingerprint = hash(records.map(record => `${record.status} ${record.path}`).join('\n'));
const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const reportPath = path.join(auditDir, `${stamp}-wrangler-audit.md`);
const latestPath = path.join(auditDir, 'latest.json');

const summary = {
  total: records.length,
  staged: records.filter(record => record.index !== ' ' && record.index !== '?').length,
  untracked: records.filter(record => record.status === '??').length,
  modified: records.filter(record => record.worktree !== ' ').length,
  cache: records.filter(record => /[\\/]\.wrangler[\\/]cache[\\/]/.test(record.path)).length,
  tmp: records.filter(record => /[\\/]\.wrangler[\\/]tmp[\\/]/.test(record.path)).length,
  accountJson: records.filter(record => /wrangler-account\.json$/i.test(record.path)).length,
};

await fs.mkdir(auditDir, { recursive: true });

const report = [
  '# Wrangler Cache Audit',
  '',
  `- generated_at: ${now.toISOString()}`,
  `- repo: ${repoRoot}`,
  `- fingerprint: ${fingerprint}`,
  `- total_wrangler_paths: ${summary.total}`,
  `- staged_or_index_changes: ${summary.staged}`,
  `- untracked: ${summary.untracked}`,
  `- cache_paths: ${summary.cache}`,
  `- tmp_paths: ${summary.tmp}`,
  `- wrangler_account_json_paths: ${summary.accountJson}`,
  '',
  '## Boundary',
  '',
  '- This audit is read-only. It does not delete files and does not change git staging.',
  '- `.wrangler/cache`, `.wrangler/tmp`, and `wrangler-account.json` should not be part of a public product commit.',
  '- `.gitignore` should ignore `.wrangler/`; already staged paths still need a separate staging decision.',
  '',
  '## Paths',
  '',
  ...records.map(record => `- \`${record.status} ${record.path}\``),
  '',
  '## Suggested Manual Cleanup',
  '',
  'Review first, then unstage generated Wrangler state without deleting local files:',
  '',
  '```powershell',
  "git restore --staged -- '.wrangler' 'art-portfolio/.wrangler' 'webhook/.wrangler' 'workers/social-publisher/.wrangler'",
  '```',
  '',
  'If any of those files are still untracked after unstaging, leave them ignored locally rather than committing them.',
  '',
];

await fs.writeFile(reportPath, `${report.join('\n')}\n`, 'utf8');
await fs.writeFile(latestPath, `${JSON.stringify({
  generatedAt: now.toISOString(),
  repoRoot,
  reportPath,
  fingerprint,
  summary,
  records,
}, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ ok: true, reportPath, fingerprint, summary }, null, 2));

function parseStatusLine(line) {
  const status = line.slice(0, 2);
  return {
    status,
    index: status[0],
    worktree: status[1],
    path: line.slice(3),
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
