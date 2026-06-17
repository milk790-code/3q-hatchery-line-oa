import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';

const gitTimeoutMs = Number.parseInt(process.env.LOOPS_GIT_TIMEOUT_MS || '30000', 10);

export function gitWorktreeFingerprint({ cwd, statusLines = [], includeUntracked }) {
  const cachedDiff = runGit(['diff', '--cached', '--no-ext-diff', '--binary'], cwd);
  const worktreeDiff = runGit(['diff', '--no-ext-diff', '--binary'], cwd);
  const shouldHashUntracked = includeUntracked ?? statusLines.some(line => line.startsWith('??'));
  const untracked = shouldHashUntracked ? hashUntrackedFiles(cwd) : '';
  return hash([
    'status',
    statusLines.join('\n'),
    'cached',
    cachedDiff,
    'worktree',
    worktreeDiff,
    'untracked',
    untracked,
  ].join('\0'));
}

function runGit(args, cwd) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 32,
    timeout: gitTimeoutMs,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.error?.message || result.stdout || result.signal || 'unknown error'}`);
  }
  return result.stdout || '';
}

function hashUntrackedFiles(cwd) {
  const output = runGitBuffer(['ls-files', '--others', '--exclude-standard', '-z'], cwd);
  const files = output.toString('utf8').split('\0').filter(Boolean).sort();
  const hasher = createHash('sha256');
  for (const file of files) {
    hasher.update('file\0');
    hasher.update(file);
    hasher.update('\0');
    try {
      const absolute = `${cwd.replace(/[\\/]+$/, '')}/${file}`;
      const stat = fs.statSync(absolute);
      hasher.update(String(stat.size));
      hasher.update('\0');
      if (stat.isFile()) {
        hasher.update(fs.readFileSync(absolute));
      } else {
        hasher.update(`non-file:${stat.mode}`);
      }
    } catch (error) {
      hasher.update(`unreadable:${error?.code || error?.message || error}`);
    }
    hasher.update('\0');
  }
  return hasher.digest('hex');
}

function runGitBuffer(args, cwd) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'buffer',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 32,
    timeout: gitTimeoutMs,
  });
  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString('utf8') : '';
    const stdout = result.stdout ? result.stdout.toString('utf8') : '';
    throw new Error(`git ${args.join(' ')} failed: ${stderr || result.error?.message || stdout || result.signal || 'unknown error'}`);
  }
  return result.stdout || Buffer.alloc(0);
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
}
