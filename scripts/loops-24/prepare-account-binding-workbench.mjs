#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import fssync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { createHash } from 'node:crypto';

const automationId = process.env.LOOPS_AUTOMATION_ID || 'loops-24';
const repoRoot = path.resolve(process.env.LOOPS_REPO_ROOT || process.cwd());
const codexHome = process.env.CODEX_HOME
  || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.codex') : path.join(os.homedir(), '.codex'));
const stateDir = path.resolve(process.env.LOOPS_STATE_DIR || path.join(codexHome, 'automations', automationId));
const workbenchDir = path.join(stateDir, 'account-binding-workbench');
const connectorHealth = await readJson(path.join(stateDir, 'connector-health', 'latest.json'), null);
const secretChecklist = await readJson(path.join(stateDir, 'secret-checklists', 'latest.json'), null);
const now = new Date();
const stamp = toStamp(now);

const items = buildItems(connectorHealth, secretChecklist);
const summary = summarize(items);
const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  stateDir,
  reportPath: path.join(workbenchDir, `${stamp}-account-binding-workbench.md`),
  jsonPath: path.join(workbenchDir, `${stamp}-account-binding-workbench.json`),
  latestPath: path.join(workbenchDir, 'latest.json'),
  sourceConnectorHealthPath: connectorHealth?.reportPath || null,
  sourceConnectorHealthFingerprint: connectorHealth?.statusFingerprint || null,
  sourceSecretChecklistPath: secretChecklist?.reportPath || null,
  sourceSecretChecklistFingerprint: secretChecklist?.statusFingerprint || null,
  statusFingerprint: hash(JSON.stringify({
    connectorHealth: connectorHealth?.statusFingerprint || null,
    secretChecklist: secretChecklist?.statusFingerprint || null,
    items: items.map(item => ({
      id: item.id,
      status: item.status,
      connectorStatus: item.connectorStatus,
      secretStatus: item.secretStatus,
      priority: item.priority,
    })),
  })),
  summary,
  items,
  hardStops: [
    'LoopOS does not grant OAuth consent, log in to accounts, or change account permissions.',
    'LoopOS does not write, print, paste, or commit secret values.',
    'Login, install, permission, billing, deploy, GitHub write, and outbound-send actions require explicit owner action.',
    'Run verification after binding; do not assume a successful browser login updates CLI or Codex app auth.',
  ],
  rerunCommands: [
    'powershell -ExecutionPolicy Bypass -File .\\scripts\\loops-24\\check-connector-health.ps1 -OnlySafeLocal',
    'powershell -ExecutionPolicy Bypass -File .\\scripts\\loops-24\\prepare-account-binding-workbench.ps1',
    'powershell -ExecutionPolicy Bypass -File .\\scripts\\loops-24\\verify-account-binding-workbench.ps1',
    'powershell -ExecutionPolicy Bypass -File .\\scripts\\loops-24\\run.ps1 -OnlySafeLocal',
  ],
};

await fs.mkdir(workbenchDir, { recursive: true });
await fs.writeFile(payload.jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  reportPath: payload.reportPath,
  jsonPath: payload.jsonPath,
  statusFingerprint: payload.statusFingerprint,
  summary: payload.summary,
}, null, 2));

function buildItems(health, checklist) {
  const healthById = new Map((health?.connectors || []).map(item => [item.id, item]));
  const checklistById = new Map((checklist?.gates || []).map(item => [item.id, item]));
  const secretsLocalPath = path.join(stateDir, 'secrets.local.ps1');
  const secretsExamplePath = path.join(stateDir, 'secrets.example.ps1');
  const codexConnectorUrl = 'codex://connectors';

  const specs = [
    {
      id: 'google_places_secret',
      label: 'Google Places API key',
      category: 'local_secret',
      priority: 100,
      revenueImpact: 'high',
      sourceIds: ['google_places_secret', 'google_places'],
      ownerAction: 'Create or choose a restricted Google Places key, then paste it into the machine-local secrets file only.',
      bindingSurface: 'Google Cloud Console -> APIs & Services -> Credentials',
      why: 'Unlocks Google Places prospect scoring, the current highest-profit LoopOS gate.',
      setupCommands: [
        `notepad "${secretsLocalPath}"`,
      ],
      verificationCommands: [
        'powershell -ExecutionPolicy Bypass -File .\\scripts\\loops-24\\prepare-secret-gates.ps1',
        'powershell -ExecutionPolicy Bypass -File .\\scripts\\loops-24\\prepare-secret-checklist.ps1',
      ],
      notes: [
        'Use GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY.',
        'Restrict the key in Google Cloud; do not paste the value into chat, docs, reports, or repo files.',
      ],
    },
    {
      id: 'github_app',
      label: 'GitHub Codex app connector',
      category: 'codex_app_auth',
      priority: 92,
      revenueImpact: 'medium',
      sourceIds: ['github_app'],
      ownerAction: 'Reconnect GitHub in Codex app connectors, then run a read-only GitHub profile/repo check from the thread.',
      bindingSurface: `${codexConnectorUrl} -> GitHub`,
      why: 'Needed for PR/issue handoff verification without falling back to manual copy-paste.',
      verificationCommands: [
        'Use the Codex GitHub connector: read profile or fetch this repository metadata.',
      ],
      notes: [
        'Codex app OAuth cannot be completed by the local Node runner.',
      ],
    },
    {
      id: 'github_cli',
      label: 'GitHub CLI',
      category: 'cli_auth',
      priority: 88,
      revenueImpact: 'medium',
      sourceIds: ['github_cli'],
      ownerAction: 'Install GitHub CLI if missing, then sign in with the account allowed to publish this repo.',
      bindingSurface: 'PowerShell -> gh auth login',
      why: 'Useful fallback for PR publishing and CI/issue inspection after explicit owner approval.',
      setupCommands: [
        'winget install --id GitHub.cli -e',
        'gh auth login',
      ],
      verificationCommands: [
        'gh auth status',
      ],
      notes: [
        'Do not run git push or create PRs from this workbench.',
      ],
    },
    {
      id: 'google_drive_app',
      label: 'Google Drive / Docs / Sheets connector',
      category: 'codex_app_auth',
      priority: 82,
      revenueImpact: 'medium',
      sourceIds: ['google_drive_app'],
      ownerAction: 'Reconnect Google Drive in Codex app connectors and verify a read-only Drive file search.',
      bindingSurface: `${codexConnectorUrl} -> Google Drive`,
      why: 'Lets LoopOS turn local owner bundles, investor packets, and checklists into reviewable Drive artifacts when approved.',
      verificationCommands: [
        'Use the Codex Google Drive connector: list or search one non-sensitive file.',
      ],
      notes: [
        'Drive connector auth is separate from Google Places API key auth.',
      ],
    },
    {
      id: 'gmail_app',
      label: 'Gmail connector',
      category: 'codex_app_auth',
      priority: 78,
      revenueImpact: 'medium',
      sourceIds: ['gmail_app'],
      ownerAction: 'Reconnect Gmail in Codex app connectors and verify a read-only mailbox search.',
      bindingSurface: `${codexConnectorUrl} -> Gmail`,
      why: 'Supports reply triage and investor/customer follow-up drafting while sends remain manual.',
      verificationCommands: [
        'Use the Codex Gmail connector: run a read-only search query.',
      ],
      notes: [
        'Drafting is allowed; sending remains manual-review only.',
      ],
    },
    {
      id: 'social_publisher_token',
      label: 'Social publisher trigger token',
      category: 'local_secret',
      priority: 76,
      revenueImpact: 'medium',
      sourceIds: ['social_publisher_token', 'social_publisher_queue'],
      ownerAction: 'Paste SOCIAL_PUBLISHER_TOKEN or TRIGGER_TOKEN into the machine-local secrets file only.',
      bindingSurface: 'Local runner secrets',
      why: 'Unlocks protected queue verification after deploy approval; it still cannot publish automatically.',
      setupCommands: [
        `notepad "${secretsLocalPath}"`,
      ],
      verificationCommands: [
        'powershell -ExecutionPolicy Bypass -File .\\scripts\\loops-24\\prepare-secret-gates.ps1',
        'powershell -ExecutionPolicy Bypass -File .\\scripts\\loops-24\\prepare-secret-checklist.ps1',
      ],
      notes: [
        'Optional SOCIAL_PUBLISHER_URL can override the default worker URL.',
      ],
    },
    {
      id: 'cloudflare_wrangler',
      label: 'Cloudflare Wrangler',
      category: 'cli_auth',
      priority: 74,
      revenueImpact: 'medium',
      sourceIds: ['cloudflare_wrangler'],
      ownerAction: 'Log in to Wrangler only if Worker deploy/verification work is approved.',
      bindingSurface: 'PowerShell -> wrangler login',
      why: 'Needed for deploy and Cloudflare verification, both gated by owner approval.',
      setupCommands: [
        'wrangler login',
      ],
      verificationCommands: [
        'wrangler whoami',
      ],
      notes: [
        'This workbench never runs wrangler deploy.',
      ],
    },
    {
      id: 'line_admin_secrets',
      label: 'LINE admin/webhook secrets',
      category: 'local_secret',
      priority: 70,
      revenueImpact: 'medium',
      sourceIds: ['line_admin_secrets'],
      ownerAction: 'Paste LINE admin values into the machine-local secrets file only after deciding the LINE verification scope.',
      bindingSurface: 'LINE Developers console + local runner secrets',
      why: 'Allows admin/webhook checks after owner approval; LINE push/send remains manual-gated.',
      setupCommands: [
        `notepad "${secretsLocalPath}"`,
      ],
      verificationCommands: [
        'powershell -ExecutionPolicy Bypass -File .\\scripts\\loops-24\\check-connector-health.ps1 -OnlySafeLocal',
      ],
      notes: [
        'Requires LINE_CHANNEL_ACCESS_TOKEN and ADMIN_LINE_USER_ID.',
      ],
    },
    {
      id: 'slack_app',
      label: 'Slack connector',
      category: 'codex_app_auth',
      priority: 58,
      revenueImpact: 'low',
      sourceIds: ['slack_app'],
      ownerAction: 'Reconnect Slack in Codex app connectors and verify a read-only channel or profile check.',
      bindingSurface: `${codexConnectorUrl} -> Slack`,
      why: 'Useful for notification triage and status relay, not required for the current revenue gate.',
      verificationCommands: [
        'Use the Codex Slack connector: read profile or summarize a permitted channel.',
      ],
      notes: [
        'Posting messages remains explicit owner approval.',
      ],
    },
    {
      id: 'railway_cli',
      label: 'Railway CLI',
      category: 'cli_auth',
      priority: 54,
      revenueImpact: 'low',
      sourceIds: ['railway_cli'],
      ownerAction: 'Install and sign in only if Railway-backed surfaces are in scope.',
      bindingSurface: 'PowerShell -> railway login',
      why: 'Useful for Railway project inspection; not required for the current LoopOS highest-profit gate.',
      setupCommands: [
        'npm install -g @railway/cli',
        'railway login',
      ],
      verificationCommands: [
        'railway whoami',
      ],
      notes: [
        'Do not change Railway environment, service, or deployment settings from this workbench.',
      ],
    },
    {
      id: 'chrome_plugin',
      label: 'Chrome browser session',
      category: 'browser_session',
      priority: 46,
      revenueImpact: 'low',
      sourceIds: ['chrome_plugin'],
      ownerAction: 'Keep Chrome logged in manually where browser-based verification is needed.',
      bindingSurface: 'Chrome browser profile',
      why: 'Useful as a last-mile UI fallback when APIs/connectors cannot perform a read-only check.',
      verificationCommands: [
        'Open Chrome manually and verify the intended account is active before any UI automation.',
      ],
      notes: [
        'Browser UI automation must stop before permission grants, sends, form submits, payments, or destructive actions.',
      ],
    },
  ];

  return specs.map(spec => makeItem(spec, healthById, checklistById, secretsExamplePath));
}

function makeItem(spec, healthById, checklistById, secretsExamplePath) {
  const health = spec.sourceIds.map(id => healthById.get(id)).find(Boolean) || null;
  const checklist = spec.sourceIds.map(id => checklistById.get(id)).find(Boolean) || null;
  const status = deriveStatus(spec, health, checklist);
  const attention = !['ready', 'ready_for_runner_wrapper', 'cli_present_unprobed'].includes(status);
  return {
    id: spec.id,
    label: spec.label,
    category: spec.category,
    priority: spec.priority,
    revenueImpact: spec.revenueImpact,
    status,
    attention,
    autoBindable: false,
    whyNotAutoBind: whyNotAutoBind(spec.category),
    ownerAction: spec.ownerAction,
    bindingSurface: spec.bindingSurface,
    why: spec.why,
    setupCommands: spec.setupCommands || [],
    verificationCommands: spec.verificationCommands || [],
    notes: spec.notes || [],
    sourceIds: spec.sourceIds,
    connectorStatus: health?.status || null,
    connectorKind: health?.kind || null,
    commandPresent: health?.commandPresent ?? null,
    probeStatus: health?.probeStatus || null,
    installed: health?.installed ?? null,
    secretStatus: checklist?.status || null,
    runnerWrapperReady: checklist?.runnerWrapperReady ?? null,
    acceptedEnvNames: checklist?.acceptedEnvNames || health?.alternatives || [],
    localSecretPath: spec.category === 'local_secret' ? path.join(stateDir, 'secrets.local.ps1') : null,
    localSecretExamplePath: spec.category === 'local_secret' && fssync.existsSync(secretsExamplePath) ? secretsExamplePath : null,
  };
}

function deriveStatus(spec, health, checklist) {
  if (spec.category === 'local_secret') {
    if (checklist?.runnerWrapperReady === true || health?.status === 'ready_for_runner_wrapper') return 'ready_for_runner_wrapper';
    if (health?.status === 'ready') return 'ready';
    return 'secret_missing';
  }
  if (spec.category === 'codex_app_auth') {
    if (health?.status === 'missing_plugin') return 'plugin_missing';
    return 'manual_oauth_required';
  }
  if (spec.category === 'browser_session') {
    if (health?.status === 'missing_plugin') return 'plugin_missing';
    return 'manual_session_required';
  }
  if (spec.category === 'cli_auth') {
    if (health?.status === 'missing_cli' || health?.commandPresent === false) return 'cli_missing';
    if (health?.status === 'ready') return 'ready';
    if (health?.status === 'probe_skipped_safe_local') return 'cli_present_unprobed';
    if (health?.status && /failed|expired|timeout/.test(health.status)) return 'cli_auth_failed_or_expired';
    return 'manual_cli_auth_required';
  }
  return 'manual_review_required';
}

function whyNotAutoBind(category) {
  if (category === 'local_secret') return 'Secret entry is sensitive and must be done by the owner on this machine.';
  if (category === 'codex_app_auth') return 'OAuth consent and account scope grants must be completed by the owner in the Codex app.';
  if (category === 'browser_session') return 'Browser login and permission prompts require owner control.';
  if (category === 'cli_auth') return 'CLI login can open browser/device-code flows and change account state.';
  return 'Account binding is a permission-changing action.';
}

function summarize(items) {
  const sortedAttention = items
    .filter(item => item.attention)
    .sort((a, b) => b.priority - a.priority);
  const ready = items.filter(item => !item.attention);
  const byStatus = {};
  const byCategory = {};
  for (const item of items) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    byCategory[item.category] = (byCategory[item.category] || 0) + 1;
  }
  return {
    total: items.length,
    readyCount: ready.length,
    attentionCount: sortedAttention.length,
    manualOauthRequiredCount: items.filter(item => item.status === 'manual_oauth_required').length,
    manualSessionRequiredCount: items.filter(item => item.status === 'manual_session_required').length,
    cliMissingCount: items.filter(item => item.status === 'cli_missing').length,
    secretMissingCount: items.filter(item => item.status === 'secret_missing').length,
    cliPresentUnprobedCount: items.filter(item => item.status === 'cli_present_unprobed').length,
    byStatus,
    byCategory,
    nextBindingId: sortedAttention[0]?.id || null,
    nextBindingLabel: sortedAttention[0]?.label || null,
    nextBindingOwnerAction: sortedAttention[0]?.ownerAction || null,
    topRevenueUnlockId: sortedAttention.find(item => item.revenueImpact === 'high')?.id || null,
    topRevenueUnlockLabel: sortedAttention.find(item => item.revenueImpact === 'high')?.label || null,
  };
}

function renderMarkdown(payload) {
  const attention = payload.items.filter(item => item.attention).sort((a, b) => b.priority - a.priority);
  const ready = payload.items.filter(item => !item.attention).sort((a, b) => b.priority - a.priority);
  const lines = [
    '# LOOPS Account Binding Workbench',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- repo: ${payload.repoRoot}`,
    `- source_connector_health: ${payload.sourceConnectorHealthPath || '(missing)'}`,
    `- source_secret_checklist: ${payload.sourceSecretChecklistPath || '(missing)'}`,
    `- status_fingerprint: ${payload.statusFingerprint}`,
    '',
    '## BLUF',
    '',
    `- next_binding: ${payload.summary.nextBindingLabel || '(none)'}`,
    `- owner_action: ${payload.summary.nextBindingOwnerAction || '(none)'}`,
    `- ready: ${payload.summary.readyCount}/${payload.summary.total}`,
    `- attention: ${payload.summary.attentionCount}`,
    `- top_revenue_unlock: ${payload.summary.topRevenueUnlockLabel || '(none)'}`,
    '',
    '## Owner Binding Queue',
    '',
    '| Priority | Item | Category | Status | Auto bind | Owner action |',
    '|---:|---|---|---|---|---|',
  ];

  for (const item of attention) {
    lines.push(`| ${item.priority} | ${escapeCell(item.label)} | ${item.category} | ${item.status} | no | ${escapeCell(item.ownerAction)} |`);
  }
  if (!attention.length) lines.push('| 0 | None | - | ready | no | No owner action currently required. |');

  lines.push('', '## Ready Or Verification-Only', '');
  if (ready.length) {
    lines.push('| Priority | Item | Category | Status | Verification |');
    lines.push('|---:|---|---|---|---|');
    for (const item of ready) {
      lines.push(`| ${item.priority} | ${escapeCell(item.label)} | ${item.category} | ${item.status} | ${escapeCell(item.verificationCommands.join(' ; ') || '(none)')} |`);
    }
  } else {
    lines.push('- None.');
  }

  lines.push('', '## Binding Details', '');
  for (const item of payload.items.sort((a, b) => b.priority - a.priority)) {
    lines.push(`### ${item.label}`, '');
    lines.push(`- id: ${item.id}`);
    lines.push(`- status: ${item.status}`);
    lines.push(`- category: ${item.category}`);
    lines.push(`- binding_surface: ${item.bindingSurface}`);
    lines.push(`- owner_action: ${item.ownerAction}`);
    lines.push(`- why: ${item.why}`);
    lines.push(`- why_not_auto_bind: ${item.whyNotAutoBind}`);
    if (item.acceptedEnvNames.length) lines.push(`- accepted_env_names: ${item.acceptedEnvNames.join(', ')}`);
    if (item.connectorStatus) lines.push(`- connector_health_status: ${item.connectorStatus}`);
    if (item.probeStatus) lines.push(`- probe_status: ${item.probeStatus}`);
    if (item.localSecretPath) lines.push(`- local_secret_file: ${item.localSecretPath}`);
    if (item.setupCommands.length) {
      lines.push('', 'Setup commands for owner review only:', '', '```powershell');
      for (const command of item.setupCommands) lines.push(command);
      lines.push('```');
    }
    if (item.verificationCommands.length) {
      lines.push('', 'Verification after owner binding:', '', '```powershell');
      for (const command of item.verificationCommands) lines.push(command);
      lines.push('```');
    }
    if (item.notes.length) {
      lines.push('', 'Notes:');
      for (const note of item.notes) lines.push(`- ${note}`);
    }
    lines.push('');
  }

  lines.push('## Recommended Owner Sequence', '');
  lines.push('1. Unlock revenue first: set the Google Places key locally, then rerun the safe-local loop.');
  lines.push('2. Reconnect Codex app connectors: GitHub, Google Drive, Gmail, Slack, and Chrome session as needed.');
  lines.push('3. Add only the local secrets needed for approved live verification; keep values out of repo and reports.');
  lines.push('4. Sign in CLI tools only when their lane is in scope: gh for PR work, wrangler for approved Worker work, railway for Railway surfaces.');
  lines.push('5. Rerun connector health and this workbench before any deploy, PR, send, or protected verification decision.');
  lines.push('', '## Rerun After Binding', '', '```powershell');
  for (const command of payload.rerunCommands) lines.push(command);
  lines.push('```');

  lines.push('', '## Hard Stops', '');
  for (const stop of payload.hardStops) lines.push(`- ${stop}`);
  return lines.join('\n');
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (arguments.length > 1) return fallback;
    throw error;
  }
}

function escapeCell(value) {
  return String(value || '').replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
}
