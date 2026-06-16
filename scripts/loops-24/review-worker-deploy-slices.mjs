#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import fssync from 'node:fs';
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
const reviewDir = path.join(stateDir, 'worker-deploy-reviews');

const boundary = await readJson(path.join(stateDir, 'commit-boundaries', 'latest.json'), null);
if (!boundary) {
  throw new Error('No commit boundary plan found. Run scripts/loops-24/plan-commit-boundaries.mjs first.');
}

const statusLines = runGit(['status', '--short']).split(/\r?\n/).filter(Boolean);
const statusFingerprint = gitWorktreeFingerprint({ cwd: repoRoot, statusLines });
if (boundary.statusFingerprint !== statusFingerprint) {
  throw new Error(`Commit boundary plan is stale. Expected ${statusFingerprint}, got ${boundary.statusFingerprint}. Re-run plan-commit-boundaries first.`);
}

const deployGroups = (boundary.groups || []).filter(group => group.gate === 'deploy-approval');
if (deployGroups.length === 0) {
  throw new Error('No deploy-approval groups found in the current commit boundary plan.');
}

const now = new Date();
const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const reportPath = path.join(reviewDir, `${stamp}-worker-deploy-review.md`);
const jsonPath = path.join(reviewDir, `${stamp}-worker-deploy-review.json`);
const latestPath = path.join(reviewDir, 'latest.json');

const statusByPath = new Map(statusLines.map(parseStatusLine).map(record => [record.path, record]));
const groups = [];
for (const group of deployGroups) {
  groups.push(await inspectGroup(group, statusByPath));
}

const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  statusFingerprint,
  boundaryReportPath: boundary.reportPath,
  reportPath,
  jsonPath,
  deployApprovalRequired: true,
  groups,
  summary: summarize(groups),
};

payload.reviewFingerprint = hash(JSON.stringify({
  statusFingerprint,
  groups: groups.map(group => ({
    id: group.id,
    jsChecks: group.jsChecks.map(item => [item.path, item.ok, item.status]),
    wranglerChecks: group.wranglerChecks.map(item => [item.path, item.ok, item.name, item.main, item.compatibilityDate, item.crons]),
    secretFindings: group.secretFindings,
    capabilityFindings: group.capabilityFindings,
  })),
}));

const latest = await readJson(latestPath, null);
if (latest?.reviewFingerprint === payload.reviewFingerprint && latest?.reportPath && fssync.existsSync(latest.reportPath)) {
  console.log(JSON.stringify({
    ok: true,
    reused: true,
    reportPath: latest.reportPath,
    jsonPath: latest.jsonPath,
    reviewFingerprint: latest.reviewFingerprint,
    summary: latest.summary,
  }, null, 2));
  process.exit(0);
}

await fs.mkdir(reviewDir, { recursive: true });
await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  reused: false,
  reportPath,
  jsonPath,
  reviewFingerprint: payload.reviewFingerprint,
  summary: payload.summary,
}, null, 2));

async function inspectGroup(group, statusByPath) {
  const paths = (group.paths || []).slice().sort();
  const jsPaths = paths.filter(item => item.endsWith('.js'));
  const wranglerPaths = paths.filter(item => item.endsWith('wrangler.toml'));
  const jsChecks = jsPaths.map(checkJsSyntax);
  const wranglerChecks = await Promise.all(wranglerPaths.map(inspectWrangler));
  const secretFindings = [];
  const capabilityFindings = [];

  for (const filePath of paths) {
    const text = await readText(path.join(repoRoot, filePath));
    if (!text) continue;
    for (const finding of scanPotentialSecrets(text, filePath)) {
      secretFindings.push(finding);
    }
    for (const finding of scanManualGateCapabilities(text, filePath)) {
      capabilityFindings.push(finding);
    }
  }

  return {
    id: group.id,
    title: group.title,
    gate: group.gate,
    recommendation: group.recommendation,
    counts: group.counts,
    paths: paths.map(filePath => ({
      path: filePath,
      status: statusByPath.get(filePath)?.status || '??',
      exists: fssync.existsSync(path.join(repoRoot, filePath)),
    })),
    jsChecks,
    wranglerChecks,
    endpointSignals: await inspectEndpointSignals(paths),
    secretFindings,
    capabilityFindings,
    ok: jsChecks.every(item => item.ok)
      && wranglerChecks.every(item => item.ok)
      && secretFindings.length === 0,
  };
}

function checkJsSyntax(filePath) {
  const fullPath = path.join(repoRoot, filePath);
  const result = spawnSync('node', ['--check', fullPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  return {
    path: filePath,
    ok: result.status === 0,
    status: result.status,
    stderr: trim(result.stderr, 1200),
  };
}

async function inspectWrangler(filePath) {
  const fullPath = path.join(repoRoot, filePath);
  const text = await readText(fullPath);
  if (!text) {
    return { path: filePath, ok: false, error: 'file-missing' };
  }

  const name = matchFirst(text, /^\s*name\s*=\s*"([^"]+)"/m);
  const main = matchFirst(text, /^\s*main\s*=\s*"([^"]+)"/m);
  const compatibilityDate = matchFirst(text, /^\s*compatibility_date\s*=\s*"([^"]+)"/m);
  const crons = extractCrons(text);
  const bindings = extractBindings(text);
  const errors = [];
  if (!name) errors.push('missing-name');
  if (!main) errors.push('missing-main');
  if (!compatibilityDate) errors.push('missing-compatibility-date');
  if (main && !fssync.existsSync(path.join(path.dirname(fullPath), main))) errors.push('main-file-missing');

  return {
    path: filePath,
    ok: errors.length === 0,
    name,
    main,
    compatibilityDate,
    crons,
    bindings,
    errors,
  };
}

async function inspectEndpointSignals(paths) {
  const signals = [];
  for (const filePath of paths.filter(item => item.endsWith('.js'))) {
    const text = await readText(path.join(repoRoot, filePath));
    if (!text) continue;
    signals.push({
      path: filePath,
      hasScheduledHandler: text.includes('async scheduled'),
      hasTriggerTokenCheck: text.includes('TRIGGER_TOKEN') && text.includes('tokensMatch'),
      hasQueueList: text.includes("url.pathname === '/queue/list'"),
      hasCronStatus: text.includes("url.pathname === '/api/cron-status'"),
      hasHealth: text.includes("url.pathname === '/health'"),
    });
  }
  return signals;
}

function summarize(groups) {
  const jsChecks = groups.flatMap(group => group.jsChecks);
  const wranglerChecks = groups.flatMap(group => group.wranglerChecks);
  const secretFindings = groups.flatMap(group => group.secretFindings);
  const capabilityFindings = groups.flatMap(group => group.capabilityFindings || []);
  return {
    groupCount: groups.length,
    pathCount: groups.reduce((total, group) => total + group.paths.length, 0),
    jsChecks: jsChecks.length,
    jsFailures: jsChecks.filter(item => !item.ok).length,
    wranglerChecks: wranglerChecks.length,
    wranglerFailures: wranglerChecks.filter(item => !item.ok).length,
    secretFindings: secretFindings.length,
    manualGateFindings: capabilityFindings.length,
    manualGateTypes: Array.from(new Set(capabilityFindings.map(item => item.gate))).sort(),
    allLocalChecksPass: groups.every(group => group.ok),
  };
}

function renderMarkdown(data) {
  const lines = [
    '# LOOPS Worker Deploy Review',
    '',
    `- generated_at: ${data.generatedAt}`,
    `- repo: ${data.repoRoot}`,
    `- status_fingerprint: ${data.statusFingerprint}`,
    `- review_fingerprint: ${data.reviewFingerprint}`,
    `- boundary_report: ${data.boundaryReportPath}`,
    `- deploy_approval_required: ${data.deployApprovalRequired}`,
    '',
    '## Summary',
    '',
    `- deploy_groups: ${data.summary.groupCount}`,
    `- paths: ${data.summary.pathCount}`,
    `- js_checks: ${data.summary.jsChecks}`,
    `- js_failures: ${data.summary.jsFailures}`,
    `- wrangler_checks: ${data.summary.wranglerChecks}`,
    `- wrangler_failures: ${data.summary.wranglerFailures}`,
    `- potential_secret_findings: ${data.summary.secretFindings}`,
    `- manual_gate_findings: ${data.summary.manualGateFindings}`,
    `- manual_gate_types: ${data.summary.manualGateTypes.length ? data.summary.manualGateTypes.join(', ') : '(none)'}`,
    `- all_local_checks_pass: ${data.summary.allLocalChecksPass}`,
    '',
    'This review is local-only. It does not run Wrangler deploy, mutate Cloudflare settings, call protected endpoints, push, merge, or publish.',
    '',
  ];

  for (const group of data.groups) {
    lines.push(`## ${group.title}`);
    lines.push('');
    lines.push(`- id: ${group.id}`);
    lines.push(`- gate: ${group.gate}`);
    lines.push(`- recommendation: ${group.recommendation}`);
    lines.push(`- local_checks_pass: ${group.ok}`);
    lines.push('');
    lines.push('### Paths');
    lines.push('');
    for (const item of group.paths) {
      lines.push(`- \`${item.status} ${item.path}\` exists=${item.exists}`);
    }
    lines.push('');
    lines.push('### JavaScript Syntax');
    lines.push('');
    if (group.jsChecks.length === 0) {
      lines.push('- No JavaScript files in this deploy group.');
    } else {
      for (const check of group.jsChecks) {
        lines.push(`- ${check.ok ? 'OK' : 'FAIL'} \`${check.path}\` status=${check.status}`);
        if (check.stderr) lines.push(`  - stderr: \`${check.stderr.replace(/`/g, "'")}\``);
      }
    }
    lines.push('');
    lines.push('### Wrangler Config');
    lines.push('');
    if (group.wranglerChecks.length === 0) {
      lines.push('- No Wrangler config in this deploy group.');
    } else {
      for (const check of group.wranglerChecks) {
        lines.push(`- ${check.ok ? 'OK' : 'FAIL'} \`${check.path}\``);
        lines.push(`  - name: ${check.name || '(missing)'}`);
        lines.push(`  - main: ${check.main || '(missing)'}`);
        lines.push(`  - compatibility_date: ${check.compatibilityDate || '(missing)'}`);
        lines.push(`  - crons: ${check.crons.length ? check.crons.join(', ') : '(none)'}`);
        lines.push(`  - bindings: ${check.bindings.length ? check.bindings.join(', ') : '(none)'}`);
        if (check.errors?.length) lines.push(`  - errors: ${check.errors.join(', ')}`);
      }
    }
    lines.push('');
    lines.push('### Endpoint Signals');
    lines.push('');
    for (const signal of group.endpointSignals) {
      lines.push(`- \`${signal.path}\`: scheduled=${signal.hasScheduledHandler}, trigger_token=${signal.hasTriggerTokenCheck}, queue_list=${signal.hasQueueList}, cron_status=${signal.hasCronStatus}, health=${signal.hasHealth}`);
    }
    lines.push('');
    lines.push('### Secret Scan');
    lines.push('');
    if (group.secretFindings.length === 0) {
      lines.push('- No obvious secret literals detected in this deploy group.');
    } else {
      for (const finding of group.secretFindings) {
        lines.push(`- ${finding.file}:${finding.line} ${finding.kind}`);
      }
    }
    lines.push('');
    lines.push('### Manual Gate Capabilities');
    lines.push('');
    if ((group.capabilityFindings || []).length === 0) {
      lines.push('- No deploy red-line capabilities detected in this deploy group.');
    } else {
      for (const finding of group.capabilityFindings) {
        lines.push(`- ${finding.file}:${finding.line} ${finding.kind} -> ${finding.gate}`);
        lines.push(`  - ${finding.detail}`);
      }
    }
    lines.push('');
  }

  lines.push('## Hard Stops');
  lines.push('');
  lines.push('- Deployment still requires explicit approval.');
  lines.push('- Queue-list and cron-status live verification still require a local token.');
  lines.push('- Do not add secrets to staged files.');

  return lines.join('\n');
}

function extractCrons(text) {
  const block = text.match(/crons\s*=\s*\[([\s\S]*?)\]/m);
  if (!block) return [];
  return Array.from(block[1].matchAll(/"([^"]+)"/g)).map(match => match[1]);
}

function extractBindings(text) {
  return Array.from(text.matchAll(/^\s*binding\s*=\s*"([^"]+)"/gm)).map(match => match[1]);
}

function scanPotentialSecrets(text, file) {
  const findings = [];
  const patterns = [
    ['openai-key', /sk-[A-Za-z0-9_-]{20,}/],
    ['google-api-key', /AIza[0-9A-Za-z_-]{20,}/],
    ['bearer-token', /Bearer\s+[A-Za-z0-9._-]{16,}/i],
  ];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const [kind, pattern] of patterns) {
      if (pattern.test(line)) findings.push({ file, line: index + 1, kind });
    }
  });
  return findings;
}

function scanManualGateCapabilities(text, file) {
  const findings = [];
  const rules = [
    {
      kind: 'line-push-side-effect',
      gate: 'manual-send-approval',
      detail: 'Worker can push LINE messages. Owner/test pushes and customer-facing sends require manual approval before deployment.',
      pattern: /https:\/\/api\.line\.me\/v2\/bot\/message\/push|bot\/message\/push/,
    },
    {
      kind: 'broadcast-control-surface',
      gate: 'manual-send-approval',
      detail: 'Worker contains broadcast or scheduled broadcast control paths. Public/bulk messaging must remain human-approved.',
      pattern: /\/admin\/broadcast|BROADCAST_|broadcastHandler|sendBroadcastMessages|runDueBroadcasts/,
    },
    {
      kind: 'd1-delete-capability',
      gate: 'manual-data-delete-approval',
      detail: 'Worker can delete D1 rows. Any production delete path needs explicit review and rollback evidence.',
      pattern: /\bDELETE\s+FROM\b/i,
    },
    {
      kind: 'cron-side-effect',
      gate: 'manual-deploy-approval',
      detail: 'Scheduled handlers can mutate production state after deployment. Cron behavior must be reviewed before wrangler deploy.',
      pattern: /async\s+scheduled\s*\(|runDueBroadcasts|runContentAutofill|runWeeklyDigest|runFollowUps/,
    },
    {
      kind: 'ai-generated-publishing-draft',
      gate: 'manual-content-review',
      detail: 'Worker can generate publication drafts with AI. Drafts require human review before public posting.',
      pattern: /env\.AI\.run|generateAutofillCaption|content_autofill|autofill/i,
    },
    {
      kind: 'protected-admin-endpoint',
      gate: 'manual-token-verification',
      detail: 'Worker exposes protected admin/control endpoints. Live verification needs a local token and must not print secrets.',
      pattern: /TRIGGER_TOKEN|adminTokenFrom|\/admin\/|\/queue\/approve|\/queue\/del|\/autofill/,
    },
  ];

  text.split(/\r?\n/).forEach((line, index) => {
    for (const rule of rules) {
      if (rule.pattern.test(line)) {
        findings.push({
          file,
          line: index + 1,
          kind: rule.kind,
          gate: rule.gate,
          detail: rule.detail,
        });
      }
    }
  });

  return dedupeFindings(findings);
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter(finding => {
    const key = `${finding.file}:${finding.line}:${finding.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseStatusLine(line) {
  if (line.startsWith('?? ')) return { status: '??', path: line.slice(3) };
  return { status: line.slice(0, 2), path: line.slice(3) };
}

function matchFirst(text, pattern) {
  const match = text.match(pattern);
  return match ? match[1] : null;
}

async function readText(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function trim(value, limit) {
  const text = String(value || '').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}
