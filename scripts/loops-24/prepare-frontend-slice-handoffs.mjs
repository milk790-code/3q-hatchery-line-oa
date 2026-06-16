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
const handoffDir = path.join(stateDir, 'frontend-slice-handoffs');

const review = await readJson(path.join(stateDir, 'frontend-artifact-reviews', 'latest.json'), null);
if (!review) {
  throw new Error('No frontend artifact review found. Run scripts/loops-24/review-frontend-artifacts.mjs first.');
}

const statusLines = runGit(['status', '--short']).split(/\r?\n/).filter(Boolean);
const statusFingerprint = gitWorktreeFingerprint({ cwd: repoRoot, statusLines });
if (review.statusFingerprint !== statusFingerprint) {
  throw new Error(`Frontend artifact review is stale. Expected ${statusFingerprint}, got ${review.statusFingerprint}. Re-run review-frontend-artifacts first.`);
}

const now = new Date();
const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const slices = buildSlices(review);
const indexPayload = {
  generatedAt: now.toISOString(),
  repoRoot,
  statusFingerprint,
  groupFingerprint: review.groupFingerprint,
  reviewReportPath: review.reportPath,
  slices: [],
};

await fs.mkdir(handoffDir, { recursive: true });

for (const slice of slices) {
  const safeId = slice.id.replace(/[^a-z0-9_-]+/gi, '-');
  const reportPath = path.join(handoffDir, `${stamp}-${safeId}-handoff.md`);
  const jsonPath = path.join(handoffDir, `${stamp}-${safeId}-handoff.json`);
  const stageScriptPath = path.join(handoffDir, `${stamp}-${safeId}-stage.ps1`);
  const latestSlicePath = path.join(handoffDir, `${safeId}-latest.json`);
  const payload = {
    generatedAt: now.toISOString(),
    repoRoot,
    statusFingerprint,
    groupFingerprint: review.groupFingerprint,
    reviewReportPath: review.reportPath,
    reportPath,
    jsonPath,
    stageScriptPath,
    slice: {
      id: slice.id,
      gate: slice.gate,
      reason: slice.reason,
      prefixes: slice.prefixes,
    },
    summary: summarizeRecords(slice.records),
    paths: slice.records.map(item => item.path),
    packages: (review.packages || []).filter(item => slice.records.some(record => record.path === item.path)),
    wranglerConfigs: (review.wranglerConfigs || []).filter(item => slice.records.some(record => record.path === item)),
    findings: filterFindings(review.findings || {}, slice.records),
    verification: verificationFor(slice),
    commitMessage: commitMessageFor(slice),
    prDraft: prDraftFor(slice),
  };

  await fs.writeFile(stageScriptPath, renderStageScript(payload), 'utf8');
  await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(latestSlicePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

  indexPayload.slices.push({
    id: slice.id,
    gate: slice.gate,
    pathCount: slice.records.length,
    bytes: payload.summary.totalBytes,
    reportPath,
    jsonPath,
    stageScriptPath,
  });
}

await fs.writeFile(path.join(handoffDir, `${stamp}-frontend-slice-handoffs.json`), `${JSON.stringify(indexPayload, null, 2)}\n`, 'utf8');
await fs.writeFile(path.join(handoffDir, `${stamp}-frontend-slice-handoffs.md`), `${renderIndexMarkdown(indexPayload)}\n`, 'utf8');
await fs.writeFile(path.join(handoffDir, 'latest.json'), `${JSON.stringify(indexPayload, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  statusFingerprint,
  groupFingerprint: review.groupFingerprint,
  sliceCount: indexPayload.slices.length,
  totalPaths: indexPayload.slices.reduce((sum, item) => sum + item.pathCount, 0),
  handoffDir,
  slices: indexPayload.slices,
}, null, 2));

function buildSlices(reviewPayload) {
  const records = Array.isArray(reviewPayload.records) ? reviewPayload.records.slice() : [];
  const recommendations = Array.isArray(reviewPayload.recommendations) ? reviewPayload.recommendations : [];
  return recommendations
    .filter(item => item.slice && item.slice !== 'security-review' && item.slice !== 'no-frontend-artifacts')
    .map(item => {
      const prefixes = (item.paths || []).map(prefix => prefix.replace(/\\/g, '/'));
      return {
        id: item.slice,
        gate: item.gate,
        reason: item.reason,
        prefixes,
        records: records
          .filter(record => prefixes.some(prefix => record.path === prefix.replace(/\/$/, '') || record.path.startsWith(prefix)))
          .sort((a, b) => a.path.localeCompare(b.path)),
      };
    })
    .filter(item => item.records.length > 0);
}

function summarizeRecords(records) {
  const totalBytes = records.reduce((sum, item) => sum + (item.bytes || 0), 0);
  return {
    totalPaths: records.length,
    totalBytes,
    totalMiB: round(totalBytes / 1024 / 1024, 3),
    byCategory: groupStats(records, item => item.category || 'other'),
    byExt: groupStats(records, item => item.ext || '(none)'),
    largestFiles: records
      .slice()
      .sort((a, b) => (b.bytes || 0) - (a.bytes || 0))
      .slice(0, 12)
      .map(item => ({ path: item.path, bytes: item.bytes || 0, miB: round((item.bytes || 0) / 1024 / 1024, 3), category: item.category })),
    entryCandidates: records
      .filter(item => /(^|\/)(index|app|hub|funnel|offer|apply|studio|content-scheduler)\.(html|tsx|jsx|js)$/i.test(item.path)
        || item.basename === 'package.json'
        || item.basename === 'wrangler.toml'
        || item.basename?.toLowerCase().includes('readme')
        || item.basename?.toLowerCase().includes('progress'))
      .map(item => item.path),
  };
}

function filterFindings(findings, records) {
  const paths = new Set(records.map(item => item.path));
  return {
    secrets: (findings.secrets || []).filter(item => paths.has(item.file)),
    absolutePaths: (findings.absolutePaths || []).filter(item => paths.has(item.file)),
  };
}

function renderStageScript(payload) {
  const lines = [
    'param(',
    `  [string]$RepoRoot = '${escapePowerShellSingleQuoted(repoRoot)}'`,
    ')',
    '',
    "$ErrorActionPreference = 'Stop'",
    '',
    '# Generated by prepare-frontend-slice-handoffs.mjs.',
    '# Review this file before running. It only stages this frontend slice.',
    `# Slice: ${payload.slice.id}`,
    `# Gate: ${payload.slice.gate}`,
    '',
    'Push-Location $RepoRoot',
    'try {',
    '  $paths = @(',
  ];
  for (const item of payload.paths) {
    lines.push(`    '${escapePowerShellSingleQuoted(item)}'`);
  }
  lines.push('  )');
  lines.push('  git add -- $paths');
  lines.push('  git status --short');
  lines.push('}');
  lines.push('finally {');
  lines.push('  Pop-Location');
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

function renderMarkdown(payload) {
  const lines = [
    '# Frontend Slice Handoff',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- repo: ${payload.repoRoot}`,
    `- status_fingerprint: ${payload.statusFingerprint}`,
    `- group_fingerprint: ${payload.groupFingerprint}`,
    `- slice: ${payload.slice.id}`,
    `- gate: ${payload.slice.gate}`,
    `- review_report: ${payload.reviewReportPath}`,
    `- stage_script: ${payload.stageScriptPath}`,
    '',
    '## Recommendation',
    '',
    payload.slice.reason,
    '',
    '## Summary',
    '',
    `- paths: ${payload.summary.totalPaths}`,
    `- total_size_mib: ${payload.summary.totalMiB}`,
    `- package_json_files: ${payload.packages.length}`,
    `- wrangler_configs: ${payload.wranglerConfigs.length}`,
    `- secret_findings: ${payload.findings.secrets.length}`,
    `- absolute_path_findings: ${payload.findings.absolutePaths.length}`,
    '',
    '## Stage Command',
    '',
    'Review first; this command is intentionally not executed by LOOPS.',
    '',
    '```powershell',
    `powershell -ExecutionPolicy Bypass -File "${payload.stageScriptPath}"`,
    '```',
    '',
    '## Commit Message',
    '',
    '```text',
    payload.commitMessage,
    '```',
    '',
    '## Verification Commands',
    '',
    ...payload.verification.map(command => `- \`${command}\``),
    '',
    '## Largest Files',
    '',
    ...payload.summary.largestFiles.map(item => `- \`${item.path}\` ${item.miB} MiB (${item.category})`),
    '',
    '## Entry Candidates',
    '',
    ...(payload.summary.entryCandidates.length ? payload.summary.entryCandidates.map(item => `- \`${item}\``) : ['- none']),
    '',
    '## Package Manifests',
    '',
    ...(payload.packages.length ? payload.packages.map(item => `- \`${item.path}\`: name=${item.name || '(none)'} scripts=${item.scripts.join(', ') || '(none)'}`) : ['- none']),
    '',
    '## Wrangler Configs',
    '',
    ...(payload.wranglerConfigs.length ? payload.wranglerConfigs.map(item => `- \`${item}\``) : ['- none']),
    '',
    '## Hard Stops',
    '',
    '- This handoff does not push, deploy, merge, publish, or delete files.',
    '- Do not run the stage script until the slice has been reviewed.',
    '- Any slice with `wrangler.toml` needs deploy review before public deployment.',
    '- Any package slice should pass its build/type-check before commit.',
    '',
    '## Paths',
    '',
    ...payload.paths.map(item => `- \`${item}\``),
  ];
  return lines.join('\n');
}

function renderIndexMarkdown(payload) {
  const lines = [
    '# Frontend Slice Handoffs',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- repo: ${payload.repoRoot}`,
    `- status_fingerprint: ${payload.statusFingerprint}`,
    `- group_fingerprint: ${payload.groupFingerprint}`,
    `- review_report: ${payload.reviewReportPath}`,
    '',
    '## Slices',
    '',
  ];
  for (const slice of payload.slices) {
    lines.push(`- ${slice.id} [${slice.gate}]: ${slice.pathCount} paths, ${round(slice.bytes / 1024 / 1024, 3)} MiB`);
    lines.push(`  - report: ${slice.reportPath}`);
    lines.push(`  - stage_script: ${slice.stageScriptPath}`);
  }
  lines.push('');
  lines.push('## Hard Stops');
  lines.push('');
  lines.push('- Generated stage scripts are review artifacts only.');
  lines.push('- Keep these slices separate from Worker deploy-gated changes.');
  return lines.join('\n');
}

function verificationFor(slice) {
  if (slice.id === 'art-portfolio-static-preview') {
    return [
      'python -m http.server 8099 --directory art-portfolio',
      'Open http://127.0.0.1:8099/index.html and inspect key entry candidates before staging.',
      'Confirm art-portfolio/wrangler.toml is not deployed without approval.',
    ];
  }
  if (slice.id === 'design-showcase-vite-app') {
    return [
      'npm --prefix design-showcase install',
      'npm --prefix design-showcase run type-check',
      'npm --prefix design-showcase run build',
    ];
  }
  if (slice.id === 'token-editor-app') {
    return [
      'npm --prefix token-editor install',
      'npm --prefix token-editor/frontend install',
      'npm --prefix token-editor/frontend run type-check',
      'npm --prefix token-editor/frontend run build',
      'Confirm token-editor/wrangler.toml is not deployed without approval.',
    ];
  }
  if (slice.id === 'shared-helper') {
    return [
      'rg "claude_helper|shared/" .',
      'Review shared/claude_helper.js imports before staging.',
    ];
  }
  return ['Review paths and run the smallest relevant local validation before staging.'];
}

function commitMessageFor(slice) {
  if (slice.id === 'art-portfolio-static-preview') return 'Add art portfolio static preview bundle';
  if (slice.id === 'design-showcase-vite-app') return 'Add design showcase Vite app';
  if (slice.id === 'token-editor-app') return 'Add token editor app';
  if (slice.id === 'shared-helper') return 'Add shared helper script';
  return `Add ${slice.id}`;
}

function prDraftFor(slice) {
  return [
    '## Summary',
    `- Adds the ${slice.id} frontend slice.`,
    `- Gate: ${slice.gate}.`,
    '',
    '## Test Plan',
    ...verificationFor(slice).map(command => `- [ ] \`${command}\``),
    '',
    '## Notes',
    '- Keep this slice separate from Worker deploy-gated changes.',
  ].join('\n');
}

function groupStats(records, keyFn) {
  const out = {};
  for (const record of records) {
    const key = keyFn(record);
    out[key] = out[key] || { count: 0, bytes: 0 };
    out[key].count += 1;
    out[key].bytes += record.bytes || 0;
  }
  return out;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
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

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function escapePowerShellSingleQuoted(value) {
  return String(value).replace(/'/g, "''");
}
