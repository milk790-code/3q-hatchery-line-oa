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
const reviewDir = path.join(stateDir, 'frontend-artifact-reviews');

const boundary = await readJson(path.join(stateDir, 'commit-boundaries', 'latest.json'), null);
if (!boundary) {
  throw new Error('No commit boundary plan found. Run scripts/loops-24/plan-commit-boundaries.mjs first.');
}

const statusLines = runGit(['status', '--short']).split(/\r?\n/).filter(Boolean);
const statusFingerprint = hash(statusLines.join('\n'));
if (boundary.statusFingerprint !== statusFingerprint) {
  throw new Error(`Commit boundary plan is stale. Expected ${statusFingerprint}, got ${boundary.statusFingerprint}. Re-run plan-commit-boundaries first.`);
}

const group = (boundary.groups || []).find(item => item.id === 'frontend_artifacts');
const paths = (group?.paths || []).slice().sort();
const now = new Date();
const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const reportPath = path.join(reviewDir, `${stamp}-frontend-artifacts.md`);
const jsonPath = path.join(reviewDir, `${stamp}-frontend-artifacts.json`);
const latestPath = path.join(reviewDir, 'latest.json');

const records = [];
for (const relPath of paths) {
  records.push(await inspectPath(relPath));
}

const packages = [];
for (const record of records.filter(item => item.basename === 'package.json' && item.exists)) {
  const parsed = await readJson(path.join(repoRoot, record.path), null);
  packages.push({
    path: record.path,
    name: parsed?.name || null,
    scripts: Object.keys(parsed?.scripts || {}).sort(),
    dependencies: Object.keys(parsed?.dependencies || {}).sort(),
    devDependencies: Object.keys(parsed?.devDependencies || {}).sort(),
  });
}

const wranglerConfigs = records
  .filter(item => item.basename.toLowerCase() === 'wrangler.toml' && item.exists)
  .map(item => item.path);

const textRecords = records.filter(item => item.exists && item.isTextLike && item.bytes <= 1_000_000);
const secretFindings = [];
const absolutePathFindings = [];
for (const record of textRecords) {
  const text = await fs.readFile(path.join(repoRoot, record.path), 'utf8').catch(() => '');
  scanText(record.path, text, secretFindings, absolutePathFindings);
}

const summary = summarize(records, packages, wranglerConfigs, secretFindings, absolutePathFindings);
const recommendations = buildRecommendations(summary, packages, wranglerConfigs);
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  statusFingerprint,
  groupFingerprint: hash(paths.join('\n')),
  boundaryReportPath: boundary.reportPath,
  reportPath,
  jsonPath,
  summary,
  recommendations,
  packages,
  wranglerConfigs,
  findings: {
    secrets: secretFindings,
    absolutePaths: absolutePathFindings,
  },
  records,
};

await fs.mkdir(reviewDir, { recursive: true });
await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  reportPath,
  jsonPath,
  statusFingerprint,
  summary,
}, null, 2));

async function inspectPath(relPath) {
  const full = path.join(repoRoot, relPath);
  const stat = await fs.stat(full).catch(() => null);
  const ext = path.extname(relPath).toLowerCase() || '(none)';
  const top = relPath.split('/')[0] || relPath;
  const basename = path.basename(relPath);
  const isTextLike = isTextExtension(ext) || isTextName(basename);
  return {
    path: relPath,
    exists: Boolean(stat),
    bytes: stat?.isFile() ? stat.size : 0,
    top,
    ext,
    basename,
    category: categorize(relPath, ext, basename),
    isTextLike,
  };
}

function summarize(inputRecords, inputPackages, inputWranglerConfigs, inputSecretFindings, inputAbsolutePathFindings) {
  const totalBytes = inputRecords.reduce((sum, item) => sum + item.bytes, 0);
  return {
    totalPaths: inputRecords.length,
    existingPaths: inputRecords.filter(item => item.exists).length,
    missingPaths: inputRecords.filter(item => !item.exists).length,
    totalBytes,
    totalMiB: round(totalBytes / 1024 / 1024, 3),
    byTop: groupStats(inputRecords, item => item.top),
    byCategory: groupStats(inputRecords, item => item.category),
    byExt: groupStats(inputRecords, item => item.ext),
    packages: inputPackages.length,
    packagePaths: inputPackages.map(item => item.path),
    wranglerConfigs: inputWranglerConfigs.length,
    wranglerConfigPaths: inputWranglerConfigs,
    secretFindings: inputSecretFindings.length,
    absolutePathFindings: inputAbsolutePathFindings.length,
    largestFiles: inputRecords
      .filter(item => item.exists)
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 15)
      .map(item => ({ path: item.path, bytes: item.bytes, miB: round(item.bytes / 1024 / 1024, 3), category: item.category })),
    entryCandidates: inputRecords
      .filter(item => /(^|\/)(index|app|hub|funnel|offer|apply|studio|content-scheduler)\.(html|tsx|jsx|js)$/i.test(item.path)
        || item.basename === 'package.json'
        || item.basename === 'wrangler.toml'
        || item.basename.toLowerCase().includes('readme')
        || item.basename.toLowerCase().includes('progress'))
      .map(item => item.path),
  };
}

function buildRecommendations(summary, inputPackages, inputWranglerConfigs) {
  const recommendations = [];
  if (summary.byTop['art-portfolio']?.count) {
    recommendations.push({
      slice: 'art-portfolio-static-preview',
      gate: inputWranglerConfigs.some(item => item.startsWith('art-portfolio/')) ? 'preview-before-deploy' : 'local-preview',
      paths: ['art-portfolio/'],
      reason: 'Large static/art portfolio bundle with many HTML entry points and image assets. Preview locally before deciding what belongs in repo history.',
    });
  }
  if (summary.byTop['design-showcase']?.count) {
    recommendations.push({
      slice: 'design-showcase-vite-app',
      gate: 'build-test-review',
      paths: ['design-showcase/'],
      reason: 'Separate Vite app. Validate package scripts and build output before committing or publishing.',
    });
  }
  if (summary.byTop['token-editor']?.count) {
    recommendations.push({
      slice: 'token-editor-app',
      gate: inputWranglerConfigs.some(item => item.startsWith('token-editor/')) ? 'deploy-approval' : 'build-test-review',
      paths: ['token-editor/'],
      reason: 'Full token editor app with package lock and possible Worker deployment config. Keep separate from art portfolio.',
    });
  }
  if (summary.byTop.shared?.count) {
    recommendations.push({
      slice: 'shared-helper',
      gate: 'local-review',
      paths: ['shared/'],
      reason: 'Shared helper should be reviewed against actual imports before committing.',
    });
  }
  if (summary.secretFindings > 0) {
    recommendations.unshift({
      slice: 'security-review',
      gate: 'hard-stop',
      paths: ['frontend_artifacts'],
      reason: 'Potential secret-like strings were detected. Do not stage until each finding is reviewed.',
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      slice: 'no-frontend-artifacts',
      gate: 'none',
      paths: [],
      reason: 'No frontend/artifact payload is currently present in the boundary plan.',
    });
  }
  return recommendations;
}

function scanText(file, text, secretFindings, absolutePathFindings) {
  const secretPatterns = [
    { name: 'google-api-key', regex: /AIza[0-9A-Za-z_-]{35}/g },
    { name: 'openai-key', regex: /sk-[A-Za-z0-9]{20,}/g },
    { name: 'github-token', regex: /gh[pousr]_[A-Za-z0-9_]{20,}/g },
    { name: 'bearer-token', regex: /bearer\s+[A-Za-z0-9._~+/-]{24,}/gi },
    { name: 'private-key', regex: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g },
  ];
  const absolutePathPatterns = [
    /[A-Za-z]:\\Users\\[^"'\s)]+/g,
    /(^|[\s"'(=])\/Users\/[^"'\s)]+/g,
    /(^|[\s"'(=])\/home\/[^"'\s)]+/g,
  ];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of secretPatterns) {
      if (pattern.regex.test(line)) {
        secretFindings.push({
          file,
          line: index + 1,
          type: pattern.name,
          sample: redact(line.trim()),
        });
      }
      pattern.regex.lastIndex = 0;
    }
    for (const pattern of absolutePathPatterns) {
      if (pattern.test(line)) {
        absolutePathFindings.push({
          file,
          line: index + 1,
          sample: redact(line.trim()),
        });
        pattern.lastIndex = 0;
        break;
      }
      pattern.lastIndex = 0;
    }
  });
}

function renderMarkdown(data) {
  const lines = [
    '# Frontend Artifact Review',
    '',
    `- generated_at: ${data.generatedAt}`,
    `- repo: ${data.repoRoot}`,
    `- status_fingerprint: ${data.statusFingerprint}`,
    `- group_fingerprint: ${data.groupFingerprint}`,
    `- boundary_report: ${data.boundaryReportPath}`,
    '',
    '## Summary',
    '',
    `- total_paths: ${data.summary.totalPaths}`,
    `- existing_paths: ${data.summary.existingPaths}`,
    `- total_size_mib: ${data.summary.totalMiB}`,
    `- package_json_files: ${data.summary.packages}`,
    `- wrangler_configs: ${data.summary.wranglerConfigs}`,
    `- secret_findings: ${data.summary.secretFindings}`,
    `- absolute_path_findings: ${data.summary.absolutePathFindings}`,
    '',
    '## Top-Level Groups',
    '',
    ...renderStatsTable(data.summary.byTop),
    '',
    '## Categories',
    '',
    ...renderStatsTable(data.summary.byCategory),
    '',
    '## Recommended Slices',
    '',
  ];

  for (const item of data.recommendations) {
    lines.push(`- ${item.slice} [${item.gate}]: ${item.reason}`);
  }

  lines.push('');
  lines.push('## Package Manifests');
  lines.push('');
  if (data.packages.length === 0) {
    lines.push('- none');
  } else {
    for (const item of data.packages) {
      lines.push(`- \`${item.path}\`: name=${item.name || '(none)'} scripts=${item.scripts.join(', ') || '(none)'}`);
    }
  }

  lines.push('');
  lines.push('## Wrangler Configs');
  lines.push('');
  if (data.wranglerConfigs.length === 0) {
    lines.push('- none');
  } else {
    for (const item of data.wranglerConfigs) lines.push(`- \`${item}\``);
  }

  lines.push('');
  lines.push('## Largest Files');
  lines.push('');
  for (const item of data.summary.largestFiles) {
    lines.push(`- \`${item.path}\` ${item.miB} MiB (${item.category})`);
  }

  lines.push('');
  lines.push('## Entry Candidates');
  lines.push('');
  for (const item of data.summary.entryCandidates.slice(0, 80)) {
    lines.push(`- \`${item}\``);
  }

  lines.push('');
  lines.push('## Findings');
  lines.push('');
  lines.push(`- potential_secrets: ${data.findings.secrets.length}`);
  for (const item of data.findings.secrets.slice(0, 20)) {
    lines.push(`  - \`${item.file}:${item.line}\` ${item.type}: ${item.sample}`);
  }
  lines.push(`- absolute_paths: ${data.findings.absolutePaths.length}`);
  for (const item of data.findings.absolutePaths.slice(0, 20)) {
    lines.push(`  - \`${item.file}:${item.line}\`: ${item.sample}`);
  }

  lines.push('');
  lines.push('## Hard Stops');
  lines.push('');
  lines.push('- This review is read-only. It does not stage, commit, push, deploy, or delete files.');
  lines.push('- Do not commit the full frontend/artifact payload as one unit.');
  lines.push('- Any slice with `wrangler.toml` needs deploy review before public deployment.');
  lines.push('- Any potential secret finding must be resolved before staging.');
  return lines.join('\n');
}

function renderStatsTable(stats) {
  const rows = ['| key | count | MiB |', '|---|---:|---:|'];
  for (const [key, value] of Object.entries(stats).sort((a, b) => b[1].bytes - a[1].bytes || b[1].count - a[1].count)) {
    rows.push(`| ${key} | ${value.count} | ${round(value.bytes / 1024 / 1024, 3)} |`);
  }
  return rows;
}

function groupStats(inputRecords, keyFn) {
  const out = {};
  for (const record of inputRecords) {
    const key = keyFn(record);
    out[key] = out[key] || { count: 0, bytes: 0 };
    out[key].count += 1;
    out[key].bytes += record.bytes;
  }
  return out;
}

function categorize(relPath, ext, basename) {
  if (basename === 'package.json' || basename === 'package-lock.json' || basename.startsWith('tsconfig') || basename === 'vite.config.ts') return 'node-app-config';
  if (basename === 'wrangler.toml') return 'deploy-config';
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico'].includes(ext)) return 'raster-asset';
  if (['.svg'].includes(ext)) return 'vector-asset';
  if (['.html'].includes(ext)) return 'static-html';
  if (['.css'].includes(ext)) return 'style';
  if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) return 'script';
  if (['.md', '.txt'].includes(ext)) return 'docs';
  if (relPath.startsWith('shared/')) return 'shared-helper';
  return 'other';
}

function isTextExtension(ext) {
  return ['.html', '.css', '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.toml', '.svg', '.txt', '.ignore'].includes(ext);
}

function isTextName(basename) {
  return ['README', 'LICENSE', '.assetsignore', '.gitignore'].includes(basename);
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

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function redact(value) {
  return value.replace(/[A-Za-z0-9_./+=-]{20,}/g, '[REDACTED]');
}
