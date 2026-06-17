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
const args = parseArgs(process.argv.slice(2));
const wakeupJsonPath = path.resolve(args.wakeupJson || path.join(stateDir, 'wakeup-health', 'latest.json'));
const policyDir = path.join(stateDir, 'power-wake-policy');
const now = new Date();
const stamp = toStamp(now);

const wakeup = await readJson(wakeupJsonPath, null);
const task = wakeup?.scheduledTask || null;
const needsOwnerDecision = Boolean(task?.platform === 'win32' && task?.found === true && task?.wakeToRun === false);
const ready = Boolean(task?.platform !== 'win32' || task?.wakeToRun === true);
const status = needsOwnerDecision
  ? 'needs-owner-decision'
  : (ready ? 'ready' : 'attention');

const decisionOptions = [
  {
    id: 'keep_disabled',
    label: 'Keep current behavior',
    posture: 'lowest-risk',
    ownerEffect: 'LOOPS keeps running hourly when Windows is awake and catches up when available.',
    tradeoff: 'A sleeping machine may not wake specifically for the hourly loop.',
  },
  {
    id: 'approve_sleep_wake',
    label: 'Approve sleep wake policy',
    posture: 'higher-continuity',
    ownerEffect: 'Owner may separately approve a Windows setting change so LOOPS can wake a sleeping machine.',
    tradeoff: 'This changes local power behavior and must be handled outside the safe-local loop.',
  },
  {
    id: 'defer_24h',
    label: 'Defer for 24 hours',
    posture: 'observe-first',
    ownerEffect: 'Keep the current setting and review missed-run evidence after another day.',
    tradeoff: 'Does not improve sleep-time continuity immediately.',
  },
];

const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  automationId,
  stateDir,
  wakeupJsonPath,
  sourceWakeupHealthReportPath: wakeup?.reportPath || null,
  reportPath: path.join(policyDir, `${stamp}-power-wake-policy.md`),
  jsonPath: path.join(policyDir, `${stamp}-power-wake-policy.json`),
  latestPath: path.join(policyDir, 'latest.json'),
  status,
  manualGate: needsOwnerDecision ? 'power-wake-policy' : 'none_read_only',
  needsOwnerDecision,
  statusEvidence: {
    wakeupHealthOk: wakeup?.health?.ok === true,
    wakeupFreshUntil: wakeup?.freshUntil || null,
    wakeupWarningCount: Array.isArray(wakeup?.health?.warnings) ? wakeup.health.warnings.length : 0,
    taskName: wakeup?.taskName || task?.taskName || null,
    platform: task?.platform || process.platform,
    taskFound: task?.found ?? null,
    taskState: task?.state || null,
    wakeToRun: task?.wakeToRun ?? null,
    startWhenAvailable: task?.startWhenAvailable ?? null,
    lastTaskResult: task?.lastTaskResult ?? null,
    numberOfMissedRuns: task?.numberOfMissedRuns ?? null,
    nextRunTime: task?.nextRunTime || null,
    executionTimeLimit: task?.executionTimeLimit || null,
    multipleInstances: task?.multipleInstances || null,
  },
  decisionOptions,
  ownerRunbook: [
    'Review this packet and choose keep_disabled, approve_sleep_wake, or defer_24h.',
    'If approve_sleep_wake is chosen, make the Windows power wake change as a separate owner-approved maintenance step.',
    'After any separate maintenance step, rerun scripts/loops-24/check-wakeup-health.mjs and this policy verifier.',
  ],
  hardStops: [
    'This packet is local-only and does not modify Windows Task Scheduler or power settings.',
    'This packet must not include executable system-setting mutation commands.',
    'Do not run admin, deploy, GitHub publication, secret-input, protected verification, or outbound-send steps from this packet.',
    'Do not store secret values in this packet.',
  ],
  summary: {
    status,
    manualGate: needsOwnerDecision ? 'power-wake-policy' : 'none_read_only',
    needsOwnerDecision,
    wakeToRun: task?.wakeToRun ?? null,
    startWhenAvailable: task?.startWhenAvailable ?? null,
    taskFound: task?.found ?? null,
    wakeupHealthOk: wakeup?.health?.ok === true,
    recommendedOwnerOption: needsOwnerDecision ? 'keep_disabled_or_explicitly_approve_sleep_wake' : 'no_owner_action_required',
  },
};

payload.statusFingerprint = hash(JSON.stringify({
  status: payload.status,
  manualGate: payload.manualGate,
  needsOwnerDecision: payload.needsOwnerDecision,
  statusEvidence: payload.statusEvidence,
  decisionOptions: payload.decisionOptions,
  hardStops: payload.hardStops,
}));

const latest = await readJson(payload.latestPath, null);
if (latest?.statusFingerprint === payload.statusFingerprint
  && latest?.reportPath
  && fssync.existsSync(latest.reportPath)) {
  console.log(JSON.stringify({
    ok: true,
    reused: true,
    reportPath: latest.reportPath,
    jsonPath: latest.jsonPath,
    summary: latest.summary,
  }, null, 2));
  process.exit(0);
}

await fs.mkdir(policyDir, { recursive: true });
await fs.writeFile(payload.jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  reused: false,
  reportPath: payload.reportPath,
  jsonPath: payload.jsonPath,
  summary: payload.summary,
}, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--wakeup-json') {
      parsed.wakeupJson = argv[index + 1];
      index += 1;
    }
  }
  return parsed;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (arguments.length > 1) return fallback;
    throw new Error(`Unable to read JSON at ${file}: ${error.message}`);
  }
}

function renderMarkdown(data) {
  const evidence = data.statusEvidence || {};
  const lines = [
    '# LOOPS Power Wake Policy Packet',
    '',
    `- generated_at: ${data.generatedAt}`,
    `- status: ${data.status}`,
    `- manual_gate: ${data.manualGate}`,
    `- needs_owner_decision: ${data.needsOwnerDecision}`,
    `- source_wakeup_health: ${data.sourceWakeupHealthReportPath || data.wakeupJsonPath}`,
    '',
    '## BLUF',
    '',
    data.needsOwnerDecision
      ? '- Windows WakeToRun is disabled. LOOPS is healthy while Windows is awake, but waking a sleeping machine needs explicit owner approval.'
      : '- No sleep-wake owner decision is currently required by the latest wakeup-health evidence.',
    '',
    '## Current Evidence',
    '',
    `- wakeup_health_ok: ${evidence.wakeupHealthOk === true}`,
    `- task_name: ${evidence.taskName || '(unknown)'}`,
    `- platform: ${evidence.platform || '(unknown)'}`,
    `- task_found: ${evidence.taskFound === true}`,
    `- task_state: ${evidence.taskState || '(unknown)'}`,
    `- wake_to_run: ${evidence.wakeToRun === true}`,
    `- start_when_available: ${evidence.startWhenAvailable === true}`,
    `- last_task_result: ${evidence.lastTaskResult ?? '(unknown)'}`,
    `- missed_runs: ${evidence.numberOfMissedRuns ?? '(unknown)'}`,
    `- next_run_time: ${evidence.nextRunTime || '(unknown)'}`,
    `- execution_time_limit: ${evidence.executionTimeLimit || '(unknown)'}`,
    `- multiple_instances: ${evidence.multipleInstances || '(unknown)'}`,
    '',
    '## Owner Decision Options',
    '',
    ...data.decisionOptions.flatMap(option => [
      `- ${option.id}: ${option.label}`,
      `  - posture: ${option.posture}`,
      `  - owner_effect: ${option.ownerEffect}`,
      `  - tradeoff: ${option.tradeoff}`,
    ]),
    '',
    '## Owner Runbook',
    '',
    ...data.ownerRunbook.map(item => `- ${item}`),
    '',
    '## Hard Stops',
    '',
    ...data.hardStops.map(item => `- ${item}`),
  ];
  return lines.join('\n');
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}
