import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export function gitWorktreeFingerprint({ cwd, statusLines = [] }) {
  const cachedDiff = runGit(['diff', '--cached', '--no-ext-diff', '--binary'], cwd);
  const worktreeDiff = runGit(['diff', '--no-ext-diff', '--binary'], cwd);
  return hash([
    'status',
    statusLines.join('\n'),
    'cached',
    cachedDiff,
    'worktree',
    worktreeDiff,
  ].join('\0'));
}

function runGit(args, cwd) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 32,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.error?.message || result.stdout}`);
  }
  return result.stdout || '';
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
}
