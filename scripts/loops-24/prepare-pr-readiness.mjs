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
const readinessDir = path.join(stateDir, 'pr-readiness');

const now = new Date();
const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const github = await readJson(path.join(stateDir, 'github-handoffs', 'latest.json'), null);
if (!github) {
  throw new Error('No GitHub handoff found. Run scripts/loops-24/prepare-github-handoff.mjs first.');
}

const branch = runGit(['branch', '--show-current']).trim();
const upstream = runGitMaybe(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']).stdout.trim();
const head = runGit(['rev-parse', '--short', 'HEAD']).trim();
const counts = upstream
  ? runGit(['rev-list', '--left-right', '--count', `${upstream}...HEAD`]).trim().split(/\s+/)
  : ['0', '0'];
const behind = Number.parseInt(counts[0] || '0', 10);
const ahead = Number.parseInt(counts[1] || '0', 10);
const staged = runGit(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean);
const dirtyTracked = runGit(['status', '--short', '--untracked-files=no']).split(/\r?\n/).filter(Boolean);
const statusFingerprint = hash(dirtyTracked.join('\n'));

const secretGates = await readJson(path.join(stateDir, 'secret-gates', 'latest.json'), null);
const workerDeploy = await readJson(path.join(stateDir, 'worker-deploy-reviews', 'latest.json'), null);
const wakeupHealth = await readJson(path.join(stateDir, 'wakeup-health', 'latest.json'), null);
const commitBoundary = await readJson(path.join(stateDir, 'commit-boundaries', 'latest.json'), null);
const frontendHandoffs = await readJson(path.join(stateDir, 'frontend-slice-handoffs', 'latest.json'), null);
const contentQueue = await readJson(path.join(stateDir, 'content-queue-reconciliations', 'latest.json'), null);

const expectedDirtyDeployFiles = [
  'webhook/worker.js',
  'webhook/wrangler.toml',
  'workers/social-publisher/worker.js',
  'workers/social-publisher/wrangler.toml',
];
const dirtyPaths = dirtyTracked.map(parseStatusLine).map(item => item.path);
const unexpectedDirty = dirtyPaths.filter(item => !expectedDirtyDeployFiles.includes(item));

const gates = [
  {
    id: 'local_branch',
    status: branch === github.branch && upstream === github.upstream && head === github.head && ahead === github.ahead && behind === github.behind
      ? 'pass'
      : 'attention',
    detail: `branch=${branch || '(unknown)'} upstream=${upstream || '(none)'} head=${head} ahead=${ahead} behind=${behind}`,
  },
  {
    id: 'index_clean',
    status: staged.length === 0 ? 'pass' : 'attention',
    detail: staged.length === 0 ? 'No staged files.' : `Staged files: ${staged.join(', ')}`,
  },
  {
    id: 'dirty_scope',
    status: unexpectedDirty.length === 0 ? 'pass' : 'attention',
    detail: unexpectedDirty.length === 0
      ? 'Dirty tracked files are limited to expected deploy-gated Worker slices.'
      : `Unexpected dirty tracked files: ${unexpectedDirty.join(', ')}`,
  },
  {
    id: 'github_handoff',
    status: github.gate === 'push-and-pr-approval' ? 'manual_approval' : 'attention',
    detail: `handoff=${github.reportPath || '(missing)'} gate=${github.gate || '(missing)'}`,
  },
  {
    id: 'secret_gates',
    status: secretGates?.summary?.readyForWrapper === secretGates?.summary?.totalGates ? 'pass' : 'manual_input',
    detail: secretGates
      ? `readyForWrapper=${secretGates.summary?.readyForWrapper}/${secretGates.summary?.totalGates} missing=${(secretGates.summary?.missing || []).join(', ') || '(none)'}`
      : 'No secret gate handoff found.',
  },
  {
    id: 'worker_deploy_review',
    status: workerDeploy?.summary?.allLocalChecksPass ? 'manual_approval' : 'attention',
    detail: workerDeploy
      ? `allLocalChecksPass=${workerDeploy.summary?.allLocalChecksPass} jsFailures=${workerDeploy.summary?.jsFailures} wranglerFailures=${workerDeploy.summary?.wranglerFailures} secretFindings=${workerDeploy.summary?.secretFindings}`
      : 'No worker deploy review found.',
  },
  {
    id: 'wakeup_health',
    status: wakeupHealth?.health?.ok ? 'pass' : 'attention',
    detail: wakeupHealth ? `overall_ok=${wakeupHealth.health?.ok} report=${wakeupHealth.reportPath}` : 'No wakeup health report found.',
  },
  {
    id: 'content_queue',
    status: contentQueue?.summary ? 'pass' : 'attention',
    detail: contentQueue?.summary
      ? `parsedRows=${contentQueue.summary.parsedRows} parseErrors=${contentQueue.summary.parseErrors} missingImages=${contentQueue.summary.missingImages}`
      : 'No content queue reconciliation found.',
  },
  {
    id: 'frontend_slices',
    status: frontendHandoffs?.slices ? 'manual_review' : 'manual_review',
    detail: frontendHandoffs?.slices
      ? `frontend slices prepared: ${frontendHandoffs.slices.map(slice => slice.id).join(', ')}`
      : 'Frontend artifact slices remain a manual review gate.',
  },
  {
    id: 'outbound_sending',
    status: 'manual_approval',
    detail: 'Cold outreach and public publishing remain manual-send only.',
  },
];

const attention = gates.filter(gate => gate.status === 'attention');
const manual = gates.filter(gate => gate.status.startsWith('manual_'));
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  branch,
  upstream,
  remoteUrl: github.remoteUrl || '',
  head,
  ahead,
  behind,
  statusFingerprint,
  reportPath: path.join(readinessDir, `${stamp}-pr-readiness.md`),
  jsonPath: path.join(readinessDir, `${stamp}-pr-readiness.json`),
  latestPath: path.join(readinessDir, 'latest.json'),
  gate: 'push-and-pr-approval',
  githubHandoffPath: github.reportPath,
  dirtyTracked,
  expectedDirtyDeployFiles,
  unexpectedDirty,
  artifacts: {
    githubHandoff: github.reportPath || null,
    secretGates: secretGates?.reportPath || null,
    workerDeployReview: workerDeploy?.reportPath || null,
    wakeupHealth: wakeupHealth?.reportPath || null,
    commitBoundary: commitBoundary?.reportPath || null,
    frontendHandoffs: frontendHandoffs?.reportPath || null,
    contentQueue: contentQueue?.reportPath || null,
  },
  gates,
  summary: {
    readyForApproval: attention.length === 0,
    attentionCount: attention.length,
    manualGateCount: manual.length,
    passCount: gates.filter(gate => gate.status === 'pass').length,
  },
  draftPr: {
    title: github.title || 'Add LOOPS 24 control plane and local automation guardrails',
    body: renderPrBody({ github, gates, attention, manual }),
  },
};

payload.readinessFingerprint = hash(JSON.stringify({
  branch,
  upstream,
  head,
  ahead,
  behind,
  statusFingerprint,
  gates,
  artifacts: payload.artifacts,
}));

await fs.mkdir(readinessDir, { recursive: true });
await fs.writeFile(payload.jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  reportPath: payload.reportPath,
  jsonPath: payload.jsonPath,
  readinessFingerprint: payload.readinessFingerprint,
  summary: payload.summary,
}, null, 2));

function renderMarkdown(payload) {
  const lines = [
    '# LOOPS PR Readiness',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- repo: ${payload.repoRoot}`,
    `- branch: ${payload.branch}`,
    `- upstream: ${payload.upstream || '(none)'}`,
    `- head: ${payload.head}`,
    `- ahead: ${payload.ahead}`,
    `- behind: ${payload.behind}`,
    `- gate: ${payload.gate}`,
    `- readiness_fingerprint: ${payload.readinessFingerprint}`,
    `- ready_for_approval: ${payload.summary.readyForApproval}`,
    '',
    '## Summary',
    '',
    `- pass: ${payload.summary.passCount}`,
    `- manual_gates: ${payload.summary.manualGateCount}`,
    `- attention: ${payload.summary.attentionCount}`,
    '',
    '## Gates',
    '',
  ];

  for (const gate of payload.gates) {
    lines.push(`- ${gate.status}: ${gate.id}`);
    lines.push(`  - ${gate.detail}`);
  }

  lines.push('');
  lines.push('## Artifact Evidence');
  lines.push('');
  for (const [name, value] of Object.entries(payload.artifacts)) {
    lines.push(`- ${name}: ${value || '(missing)'}`);
  }

  lines.push('');
  lines.push('## Dirty Tracked Worktree');
  lines.push('');
  if (payload.dirtyTracked.length) {
    for (const line of payload.dirtyTracked) lines.push(`- \`${line}\``);
  } else {
    lines.push('- none');
  }

  lines.push('');
  lines.push('## Draft PR Title');
  lines.push('');
  lines.push(payload.draftPr.title);
  lines.push('');
  lines.push('## Draft PR Body');
  lines.push('');
  lines.push('```markdown');
  lines.push(payload.draftPr.body);
  lines.push('```');
  lines.push('');
  lines.push('## Manual Commands');
  lines.push('');
  lines.push('Run only after explicit push/PR approval:');
  lines.push('');
  lines.push('```powershell');
  lines.push(`git push origin ${payload.branch}`);
  lines.push(`gh pr create --draft --title "${escapeDoubleQuoted(payload.draftPr.title)}" --body-file "${payload.reportPath}"`);
  lines.push('```');
  lines.push('');
  lines.push('## Hard Stops');
  lines.push('');
  lines.push('- This readiness report does not push, create a PR, deploy, merge, publish, or write secrets.');
  lines.push('- Manual gates remain manual even when `ready_for_approval` is true.');

  return lines.join('\n');
}

function renderPrBody({ github, gates, attention, manual }) {
  const validationLines = gates
    .filter(gate => gate.status === 'pass' || gate.status === 'manual_approval' || gate.status === 'manual_input' || gate.status === 'manual_review')
    .map(gate => `- ${gate.status}: ${gate.id} - ${gate.detail}`);
  const attentionLines = attention.length
    ? attention.map(gate => `- ${gate.id}: ${gate.detail}`)
    : ['- None.'];
  const manualLines = manual.map(gate => `- ${gate.id}: ${gate.detail}`);

  return [
    '## Summary',
    '',
    '- Adds the LOOPS 24 local control plane and cross-session automation runner.',
    '- Adds guardrails for commit boundaries, slice handoffs, GitHub publication handoff, secret gates, Worker deploy review, wakeup health, content queue reconciliation, prospecting preview, and cold outreach drafts.',
    '- Keeps production deploys, secrets, queue verification, public publishing, and outbound sends behind explicit manual gates.',
    '',
    '## Scope',
    '',
    `- Branch: \`${github.branch}\``,
    `- Local commits ahead of upstream: ${github.ahead}`,
    `- Head: \`${github.head}\``,
    '',
    '## Validation Evidence',
    '',
    ...validationLines,
    '',
    '## Attention Items',
    '',
    ...attentionLines,
    '',
    '## Manual Gates',
    '',
    ...manualLines,
    '',
    '## Not Included',
    '',
    '- Production Worker deployment.',
    '- Secret values.',
    '- Outbound cold outreach or public publishing.',
  ].join('\n');
}

function parseStatusLine(line) {
  if (line.startsWith('?? ')) return { status: '??', path: line.slice(3) };
  return { status: line.slice(0, 2), path: line.slice(3) };
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function runGit(args) {
  const result = runGitMaybe(args);
  if (!result.ok) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
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
