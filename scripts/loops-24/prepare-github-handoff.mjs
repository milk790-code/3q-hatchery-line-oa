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
const handoffDir = path.join(stateDir, 'github-handoffs');

const now = new Date();
const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const branch = runGit(['branch', '--show-current']).trim();
const upstreamResult = runGitMaybe(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);

if (!branch) {
  throw new Error('Current branch could not be resolved.');
}
if (!upstreamResult.ok) {
  throw new Error(`Current branch has no upstream. Set an upstream before preparing a GitHub handoff. Branch: ${branch}`);
}

const upstream = upstreamResult.stdout.trim();
const head = runGit(['rev-parse', '--short', 'HEAD']).trim();
const counts = runGit(['rev-list', '--left-right', '--count', `${upstream}...HEAD`]).trim().split(/\s+/);
const behind = Number.parseInt(counts[0] || '0', 10);
const ahead = Number.parseInt(counts[1] || '0', 10);

if (ahead <= 0) {
  throw new Error(`No local commits ahead of ${upstream}; GitHub handoff is not needed.`);
}

const statusTracked = runGit(['status', '--short', '--untracked-files=no'])
  .split(/\r?\n/)
  .filter(Boolean);
const statusFingerprint = hash(statusTracked.join('\n'));
const commits = runGit(['log', '--oneline', `${upstream}..HEAD`])
  .split(/\r?\n/)
  .filter(Boolean);
const diffStat = runGit(['diff', '--stat', `${upstream}..HEAD`]).trim();
const nameStatus = runGit(['diff', '--name-status', `${upstream}..HEAD`])
  .split(/\r?\n/)
  .filter(Boolean);
const remoteUrl = runGitMaybe(['remote', 'get-url', 'origin']).stdout.trim();
const safeBranch = branch.replace(/[^a-z0-9._-]+/gi, '-');
const reportPath = path.join(handoffDir, `${stamp}-${safeBranch}-local-pr-handoff.md`);
const jsonPath = path.join(handoffDir, `${stamp}-${safeBranch}-local-pr-handoff.json`);
const latestPath = path.join(handoffDir, 'latest.json');

const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  branch,
  upstream,
  remoteUrl,
  head,
  ahead,
  behind,
  statusFingerprint,
  reportPath,
  jsonPath,
  gate: 'push-and-pr-approval',
  commits,
  diffStat,
  nameStatus,
  dirtyTracked: statusTracked,
  title: 'Add LOOPS 24 control plane and local automation guardrails',
  blockers: [
    'Push and draft PR creation require explicit user approval.',
    'GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY is required before prospecting can run.',
    'SOCIAL_PUBLISHER_TOKEN or TRIGGER_TOKEN is required before /queue/list can be verified.',
    'Worker deploy slices require explicit deploy approval.',
    'Frontend artifact slices require manual staging and review.',
    'Cold outreach remains manual-send only.',
  ],
};

await fs.mkdir(handoffDir, { recursive: true });
await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  branch,
  upstream,
  ahead,
  behind,
  head,
  reportPath,
  jsonPath,
  statusFingerprint,
}, null, 2));

function renderMarkdown(payload) {
  const lines = [
    '# LOOPS GitHub Local PR Handoff',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- repo: ${payload.repoRoot}`,
    `- branch: ${payload.branch}`,
    `- upstream: ${payload.upstream}`,
    `- remote: ${payload.remoteUrl || '(unknown)'}`,
    `- head: ${payload.head}`,
    `- ahead: ${payload.ahead}`,
    `- behind: ${payload.behind}`,
    `- gate: ${payload.gate}`,
    `- status_fingerprint: ${payload.statusFingerprint}`,
    '',
    '## Summary',
    '',
    `This branch has ${payload.ahead} local commit(s) ahead of ${payload.upstream}. LOOPS prepared this handoff for review only; it did not push, create a pull request, deploy, merge, publish, or write secrets.`,
    '',
    '## Local Commits',
    '',
    ...payload.commits.map(item => `- ${item}`),
    '',
    '## Dirty Tracked Worktree',
    '',
    ...(payload.dirtyTracked.length ? payload.dirtyTracked.map(item => `- \`${item}\``) : ['- none']),
    '',
    '## Diff Stat',
    '',
    '```text',
    payload.diffStat || '(empty)',
    '```',
    '',
    '## Draft PR Title',
    '',
    payload.title,
    '',
    '## Draft PR Body',
    '',
    '```markdown',
    renderPrBody(payload),
    '```',
    '',
    '## Manual Commands',
    '',
    'Run only after explicit push/PR approval:',
    '',
    '```powershell',
    `git push origin ${payload.branch}`,
    `gh pr create --draft --title "${escapeDoubleQuoted(payload.title)}" --body-file "${payload.reportPath}"`,
    '```',
    '',
    '## Blockers',
    '',
    ...payload.blockers.map(item => `- ${item}`),
  ];
  return lines.join('\n');
}

function renderPrBody(payload) {
  return [
    '## Summary',
    '',
    '- Adds the LOOPS 24 local control plane and cross-session automation runner.',
    '- Adds local guardrails for commit boundaries, slice handoffs, frontend artifact review, content queue reconciliation, Wrangler cache audit, prospecting preview, and cold outreach drafts.',
    '- Keeps production Worker deploys, secrets, queue verification, public publishing, and outbound sends behind explicit manual gates.',
    '',
    '## Scope',
    '',
    `- Branch: \`${payload.branch}\``,
    `- Local commits ahead of upstream: ${payload.ahead}`,
    `- Head: \`${payload.head}\``,
    '',
    '## Not Included',
    '',
    '- Deploy-gated Worker changes still require separate review and approval.',
    '- Google Places and social publisher tokens are not stored in this repository.',
    '- Frontend artifact slices are prepared for review but not automatically staged.',
    '',
    '## Validation Notes',
    '',
    '- LOOPS auto-complete stops at expected secret, deploy, and manual-send gates.',
    '- No push, deploy, merge, production setting change, outbound send, or secret write is performed by LOOPS.',
  ].join('\n');
}

function runGit(args) {
  const result = runGitMaybe(args);
  if (!result.ok) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  }
  return result.stdout || '';
}

function runGitMaybe(args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', windowsHide: true });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

function escapeDoubleQuoted(value) {
  return String(value).replace(/(["`$])/g, '`$1');
}
