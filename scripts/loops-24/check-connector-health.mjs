#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import fssync from 'node:fs';
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
const healthDir = path.join(stateDir, 'connector-health');
const secretsLocalPath = path.join(stateDir, 'secrets.local.ps1');
const pluginCache = path.join(codexHome, 'plugins', 'cache');
const onlySafeLocal = process.argv.includes('--only-safe-local') || truthy(process.env.LOOPS_ONLY_SAFE_LOCAL);
const now = new Date();
const stamp = toStamp(now);
const localSecretText = await readText(secretsLocalPath);

const connectors = [
  inspectCodexPlugin({
    id: 'github_app',
    label: 'GitHub app connector',
    pluginPath: path.join(pluginCache, 'openai-curated-remote', 'github'),
    authNote: 'Verified from Codex thread, not from local runner. Use thread-side connector checks for current app auth.',
  }),
  inspectCodexPlugin({
    id: 'gmail_app',
    label: 'Gmail app connector',
    pluginPath: path.join(pluginCache, 'openai-curated-remote', 'gmail'),
    authNote: 'Local runner cannot call Gmail app tools; mark stale if thread-side Gmail tools are unavailable.',
  }),
  inspectCodexPlugin({
    id: 'google_drive_app',
    label: 'Google Drive app connector',
    pluginPath: path.join(pluginCache, 'openai-curated-remote', 'google-drive'),
    authNote: 'Local runner cannot call Drive app tools; mark stale if Docs/Sheets/Drive tools are unavailable.',
  }),
  inspectCodexPlugin({
    id: 'slack_app',
    label: 'Slack app connector',
    pluginPath: path.join(pluginCache, 'openai-curated-remote', 'slack'),
    authNote: 'Local runner cannot call Slack app tools; mark stale if thread-side Slack tools are unavailable.',
  }),
  inspectCodexPlugin({
    id: 'chrome_plugin',
    label: 'Chrome plugin',
    pluginPath: path.join(pluginCache, 'openai-bundled', 'chrome'),
    authNote: 'Browser session state is user-controlled and may require manual login.',
  }),
  inspectCliConnector({
    id: 'github_cli',
    label: 'GitHub CLI',
    command: 'gh',
    args: ['auth', 'status'],
    externalProbe: true,
  }),
  inspectCliConnector({
    id: 'cloudflare_wrangler',
    label: 'Cloudflare Wrangler',
    command: 'wrangler',
    args: ['whoami'],
    externalProbe: true,
  }),
  inspectCliConnector({
    id: 'railway_cli',
    label: 'Railway CLI',
    command: 'railway',
    args: ['whoami'],
    externalProbe: true,
  }),
  inspectSecretGate({
    id: 'google_places_secret',
    label: 'Google Places API key',
    alternatives: ['GOOGLE_MAPS_API_KEY', 'GOOGLE_PLACES_API_KEY'],
    purpose: 'Revenue prospecting from public Google business listings.',
  }),
  inspectSecretGate({
    id: 'social_publisher_token',
    label: 'Social publisher queue token',
    alternatives: ['SOCIAL_PUBLISHER_TOKEN', 'TRIGGER_TOKEN'],
    optional: ['SOCIAL_PUBLISHER_URL'],
    purpose: 'Read-only /queue/list and /health verification after approval.',
  }),
  inspectSecretGate({
    id: 'line_admin_secrets',
    label: 'LINE admin/webhook secrets',
    alternatives: ['LINE_CHANNEL_ACCESS_TOKEN', 'ADMIN_LINE_USER_ID'],
    purpose: 'LINE admin notifications and webhook verification; sending remains manual-gated.',
    allRequired: true,
  }),
];

const summary = summarize(connectors);
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  stateDir,
  onlySafeLocal,
  reportPath: path.join(healthDir, `${stamp}-connector-health.md`),
  jsonPath: path.join(healthDir, `${stamp}-connector-health.json`),
  latestPath: path.join(healthDir, 'latest.json'),
  statusFingerprint: hash(JSON.stringify(connectors.map(item => ({
    id: item.id,
    status: item.status,
    installed: item.installed,
    commandPresent: item.commandPresent,
    probeStatus: item.probeStatus,
    variables: item.variables,
  })))),
  summary,
  connectors,
};

await fs.mkdir(healthDir, { recursive: true });
await fs.writeFile(payload.jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: summary.failedCount === 0,
  reportPath: payload.reportPath,
  jsonPath: payload.jsonPath,
  statusFingerprint: payload.statusFingerprint,
  summary,
}, null, 2));

function inspectCodexPlugin({ id, label, pluginPath, authNote }) {
  const installed = fssync.existsSync(pluginPath);
  return {
    id,
    label,
    kind: 'codex_app_plugin',
    installed,
    status: installed ? 'installed_auth_unverified' : 'missing_plugin',
    attention: !installed,
    authNote,
    pluginPath,
  };
}

function inspectCliConnector({ id, label, command, args, externalProbe }) {
  const lookup = findCommand(command);
  const commandPresent = lookup.present;
  const base = {
    id,
    label,
    kind: 'cli_auth',
    command,
    commandPresent,
    commandPath: lookup.path || null,
    status: commandPresent ? 'cli_present' : 'missing_cli',
    attention: !commandPresent,
    probeStatus: commandPresent ? 'not_run' : 'missing_cli',
  };
  if (!commandPresent) return base;
  if (onlySafeLocal && externalProbe) {
    return {
      ...base,
      status: 'probe_skipped_safe_local',
      attention: false,
      probeStatus: 'skipped_safe_local',
    };
  }

  const probe = runCommand(command, args, 15_000);
  if (probe.timedOut) {
    return {
      ...base,
      status: 'auth_probe_timeout',
      attention: true,
      probeStatus: 'timeout',
    };
  }
  if (!probe.ok) {
    return {
      ...base,
      status: looksLikeAuthFailure(`${probe.stdout}\n${probe.stderr}`) ? 'auth_failed_or_expired' : 'auth_probe_failed',
      attention: true,
      probeStatus: 'failed',
      exitStatus: probe.status,
    };
  }
  return {
    ...base,
    status: 'ready',
    attention: false,
    probeStatus: 'ok',
  };
}

function inspectSecretGate({ id, label, alternatives, optional = [], purpose, allRequired = false }) {
  const variables = alternatives.map(name => inspectVariable(name));
  const optionalVariables = optional.map(name => inspectVariable(name));
  const ready = allRequired
    ? variables.every(item => item.currentProcessPresent || item.localFileNonEmptyAssignment)
    : variables.some(item => item.currentProcessPresent || item.localFileNonEmptyAssignment);
  return {
    id,
    label,
    kind: 'local_secret_gate',
    status: ready ? 'ready_for_runner_wrapper' : 'missing_secret',
    attention: !ready,
    purpose,
    alternatives,
    optional,
    variables,
    optionalVariables,
  };
}

function inspectVariable(name) {
  const assignment = localSecretText ? findPowerShellEnvAssignment(localSecretText, name) : null;
  return {
    name,
    currentProcessPresent: hasValue(process.env[name]),
    localFileAssignmentPresent: Boolean(assignment),
    localFileNonEmptyAssignment: Boolean(assignment?.nonEmpty),
    localFileLooksPlaceholder: Boolean(assignment?.placeholder),
  };
}

function summarize(items) {
  const attention = items.filter(item => item.attention);
  const missing = items.filter(item => ['missing_plugin', 'missing_cli', 'missing_secret'].includes(item.status));
  const failed = items.filter(item => /failed|expired|timeout/.test(item.status));
  const unverified = items.filter(item => item.status === 'installed_auth_unverified');
  const ready = items.filter(item => item.status === 'ready' || item.status === 'ready_for_runner_wrapper');
  return {
    total: items.length,
    readyCount: ready.length,
    attentionCount: attention.length,
    missingCount: missing.length,
    failedCount: failed.length,
    authUnverifiedCount: unverified.length,
    attentionIds: attention.map(item => item.id),
    missingIds: missing.map(item => item.id),
    failedIds: failed.map(item => item.id),
    authUnverifiedIds: unverified.map(item => item.id),
  };
}

function renderMarkdown(data) {
  const lines = [
    '# LOOPS Connector Health',
    '',
    `- generated_at: ${data.generatedAt}`,
    `- repo: ${data.repoRoot}`,
    `- only_safe_local: ${data.onlySafeLocal}`,
    `- status_fingerprint: ${data.statusFingerprint}`,
    '',
    '## Summary',
    '',
    `- ready: ${data.summary.readyCount}/${data.summary.total}`,
    `- attention: ${data.summary.attentionCount}`,
    `- missing: ${data.summary.missingIds.length ? data.summary.missingIds.join(', ') : '(none)'}`,
    `- failed_or_expired: ${data.summary.failedIds.length ? data.summary.failedIds.join(', ') : '(none)'}`,
    `- app_auth_unverified_by_local_runner: ${data.summary.authUnverifiedIds.length ? data.summary.authUnverifiedIds.join(', ') : '(none)'}`,
    '',
    '## Connectors',
    '',
    '| Connector | Kind | Status | Attention |',
    '|---|---|---|---|',
  ];

  for (const item of data.connectors) {
    lines.push(`| ${item.label} | ${item.kind} | ${item.status} | ${item.attention ? 'yes' : 'no'} |`);
  }

  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- No secret values are printed or stored.');
  lines.push('- Codex app plugins can be installed locally while their app authorization is unavailable in a specific thread; verify thread-side tools before relying on them.');
  lines.push('- In only-safe-local mode, CLI probes that may touch external services are skipped and shown as `probe_skipped_safe_local`.');
  lines.push('- Failed, expired, missing, or timeout statuses should become LoopOS approval gates before any deploy or outbound workflow.');
  return lines.join('\n');
}

function runCommand(command, args, timeout) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    timeout,
  });
  return {
    ok: result.status === 0 && !result.error,
    status: result.status,
    timedOut: result.error?.code === 'ETIMEDOUT',
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function findCommand(command) {
  const where = runCommand('where.exe', [command], 8_000);
  if (where.ok) {
    return {
      present: true,
      path: where.stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean)[0] || null,
    };
  }
  const escaped = command.replaceAll("'", "''");
  const ps = runCommand('powershell', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `$cmd = Get-Command '${escaped}' -ErrorAction SilentlyContinue; if ($cmd) { $cmd.Source }`,
  ], 15_000);
  const found = ps.ok && ps.stdout.trim();
  return {
    present: Boolean(found),
    path: found ? ps.stdout.trim().split(/\r?\n/)[0] : null,
  };
}

function findPowerShellEnvAssignment(text, name) {
  const re = new RegExp(`^\\s*\\$env:${escapeRegExp(name)}\\s*=\\s*(.+?)\\s*$`, 'i');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = line.match(re);
    if (!match) continue;
    const raw = match[1].replace(/\s+#.*$/, '').trim();
    const value = unquote(raw);
    return {
      nonEmpty: hasValue(value),
      placeholder: isPlaceholder(value),
    };
  }
  return null;
}

async function readText(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function hasValue(value) {
  return typeof value === 'string' && value.trim() !== '' && !isPlaceholder(value);
}

function isPlaceholder(value) {
  return /^(<.*>|replace-me|changeme|todo|xxx|your-|paste locally; do not commit|same value as live trigger_token, paste locally)$/i.test(String(value || '').trim());
}

function unquote(value) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '');
}

function looksLikeAuthFailure(value) {
  return /(not\s+logged\s+in|not\s+authenticated|auth.*expired|login\s+required|unauthorized|forbidden|no\s+account|not\s+authorized)/i.test(value || '');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

function truthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || ''));
}
