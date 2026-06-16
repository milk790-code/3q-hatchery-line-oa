#!/usr/bin/env node
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

const repoRoot = path.resolve(process.env.LOOPS_REPO_ROOT || process.cwd());
const automationId = process.env.LOOPS_AUTOMATION_ID || 'loops-24';
const codexHome = process.env.CODEX_HOME
  || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.codex') : path.join(os.homedir(), '.codex'));
const stateDir = path.resolve(process.env.LOOPS_STATE_DIR || path.join(codexHome, 'automations', automationId));
const canonicalPath = path.join(repoRoot, 'docs', 'loopos-cross-agent-memory.md');
const sharedMemoryDir = path.join(stateDir, 'shared-memory');
const codexNotesDir = path.join(codexHome, 'memories', 'extensions', 'ad_hoc', 'notes');
const claudeMemoryDir = process.env.LOOPS_CLAUDE_MEMORY_DIR
  || path.join(os.homedir(), 'Desktop', '天使.claude', 'memory');
const writeApproved = process.argv.includes('--write') || process.env.LOOPS_ALLOW_MEMORY_SYNC === '1';
const dryRun = process.argv.includes('--dry-run') || !writeApproved;

const source = await fs.readFile(canonicalPath, 'utf8');
const hash = createHash('sha256').update(source).digest('hex').slice(0, 16);
const content = [
  `<!-- loopos-memory-hash: ${hash} -->`,
  '',
  source.trimEnd(),
  '',
].join('\n');

const targets = [];
targets.push(await writeTarget({
  id: 'loopos-generated-copy',
  path: path.join(sharedMemoryDir, 'loopos-cross-agent-memory.md'),
  stable: true,
}));
targets.push(await writeCodexNote());
targets.push(await writeTarget({
  id: 'claude-memory',
  path: path.join(claudeMemoryDir, 'loopos-cross-agent-memory.md'),
  stable: true,
}));

console.log(JSON.stringify({
  ok: true,
  dryRun,
  writeApproved,
  canonicalPath,
  hash,
  targets,
}, null, 2));

async function writeCodexNote() {
  const existing = findExistingCodexNote(hash);
  if (existing) {
    return {
      id: 'codex-memory-note',
      path: existing,
      status: 'reused',
    };
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return writeTarget({
    id: 'codex-memory-note',
    path: path.join(codexNotesDir, `${stamp}-loopos-cross-agent-memory.md`),
    stable: false,
  });
}

async function writeTarget(target) {
  if (dryRun) {
    return { ...target, status: 'dry-run' };
  }
  await fs.mkdir(path.dirname(target.path), { recursive: true });
  await fs.writeFile(target.path, content);
  return { ...target, status: 'written' };
}

function findExistingCodexNote(hash) {
  if (!fssync.existsSync(codexNotesDir)) return null;
  for (const name of fssync.readdirSync(codexNotesDir)) {
    if (!name.endsWith('.md')) continue;
    const full = path.join(codexNotesDir, name);
    try {
      const text = fssync.readFileSync(full, 'utf8');
      if (text.includes(`loopos-memory-hash: ${hash}`)) return full;
    } catch {
      // Ignore unreadable memory notes.
    }
  }
  return null;
}
