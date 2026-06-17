#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const automationId = process.env.LOOPS_AUTOMATION_ID || 'loops-24';
const taskName = process.env.LOOPS_TASK_NAME || 'LOOPS-24-3Q-Hatchery';
const staleMinutes = numberFromEnv('LOOPS_WAKEUP_STALE_MINUTES', 90);
const lockStaleMinutes = numberFromEnv('LOOPS_LOCK_STALE_MINUTES', 65);
const repoRoot = path.resolve(process.env.LOOPS_REPO_ROOT || process.cwd());
const codexHome = process.env.CODEX_HOME
  || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.codex') : path.join(os.homedir(), '.codex'));
const stateDir = path.resolve(process.env.LOOPS_STATE_DIR || path.join(codexHome, 'automations', automationId));
const healthDir = path.join(stateDir, 'wakeup-health');
const statePath = path.join(stateDir, 'state.json');
const lockPath = path.join(stateDir, 'lock.json');

const now = new Date();
const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const state = await readJson(statePath, null);
const runs = Array.isArray(state?.runs) ? state.runs : [];
const latestRun = runs[0] || null;
const latestSuccess = runs.find(run => run.status === 'success') || null;
const lock = await readJson(lockPath, null);
const task = queryScheduledTask(taskName);
const latestRunAgeMinutes = ageMinutes(latestRun?.finishedAt || latestRun?.startedAt, now);
const latestSuccessAgeMinutes = ageMinutes(latestSuccess?.finishedAt || latestSuccess?.startedAt, now);
const lockAgeMinutes = lock ? ageMinutes(lock.updatedAt || lock.acquiredAt || lock.startedAt, now) : null;
const nextRunInMinutes = minutesUntil(task?.nextRunTime, now);
const taskState = String(task?.state || '');
const taskLastResult = Number(task?.lastTaskResult);
const taskCurrentlyRunning = taskState === 'Running' && taskLastResult === 267009;
const taskIntervalMinutes = parseIsoDurationMinutes(task?.hourlyTrigger?.repetitionInterval);
const taskExecutionLimitMinutes = parseIsoDurationMinutes(task?.executionTimeLimit);
const expectedRunnerPath = path.join(repoRoot, 'scripts', 'loops-24', 'run.ps1').toLowerCase();
const taskAction = task?.action || {};
const taskArguments = String(taskAction.arguments || '').toLowerCase();
const taskWorkingDirectory = String(taskAction.workingDirectory || '').toLowerCase();

const checks = {
  stateFileExists: Boolean(state),
  latestSuccessFresh: latestSuccessAgeMinutes !== null && latestSuccessAgeMinutes <= staleMinutes,
  noStaleLock: !lock || (lockAgeMinutes !== null && lockAgeMinutes <= lockStaleMinutes),
  scheduledTaskReady: task.platform === 'win32'
    ? Boolean(task.found && ['Ready', 'Running'].includes(taskState))
    : null,
  scheduledTaskLastResultOk: task.platform === 'win32'
    ? Boolean(task.found && (taskLastResult === 0 || taskCurrentlyRunning))
    : null,
  scheduledTaskNextRunPlausible: task.platform === 'win32'
    ? Boolean(task.found && (nextRunInMinutes === null || nextRunInMinutes > -10))
    : null,
  scheduledTaskSafeLocalRunner: task.platform === 'win32'
    ? Boolean(task.found
      && taskArguments.includes(expectedRunnerPath)
      && taskArguments.includes('-onlysafelocal')
      && taskWorkingDirectory === repoRoot.toLowerCase())
    : null,
  scheduledTaskHourlyTrigger: task.platform === 'win32'
    ? Boolean(task.found && taskIntervalMinutes === 60)
    : null,
  scheduledTaskOverlapGuard: task.platform === 'win32'
    ? Boolean(task.found && task.multipleInstances === 'IgnoreNew')
    : null,
  scheduledTaskExecutionLimitBounded: task.platform === 'win32'
    ? Boolean(task.found && taskExecutionLimitMinutes !== null && taskExecutionLimitMinutes <= 45)
    : null,
  scheduledTaskCatchUpEnabled: task.platform === 'win32'
    ? Boolean(task.found && task.startWhenAvailable === true)
    : null,
};

const warnings = [];
if (task.platform === 'win32' && task.found && task.wakeToRun !== true) {
  warnings.push('scheduledTaskWakeToRun is disabled; hourly wakeups run when Windows is awake or catches up after availability, but may not wake a sleeping machine.');
}

const health = {
  ok: Object.values(checks).every(value => value === true || value === null),
  checks,
  warnings,
  staleMinutes,
  lockStaleMinutes,
};

const payload = {
  generatedAt: now.toISOString(),
  repoRoot,
  automationId,
  stateDir,
  taskName,
  reportPath: path.join(healthDir, `${stamp}-wakeup-health.md`),
  jsonPath: path.join(healthDir, `${stamp}-wakeup-health.json`),
  latestPath: path.join(healthDir, 'latest.json'),
  state: {
    stateFileExists: Boolean(state),
    runCount: runs.length,
    latestRun: latestRun ? summarizeRun(latestRun, latestRunAgeMinutes) : null,
    latestSuccess: latestSuccess ? summarizeRun(latestSuccess, latestSuccessAgeMinutes) : null,
  },
  lock: lock ? {
    exists: true,
    ageMinutes: round(lockAgeMinutes),
    owner: lock.owner || null,
    runId: lock.runId || null,
  } : { exists: false },
  scheduledTask: task,
  health,
};

payload.statusFingerprint = hash(JSON.stringify({
  task,
  latestRunId: latestRun?.runId || null,
  latestSuccessRunId: latestSuccess?.runId || null,
  lock: payload.lock,
  health,
}));

await fs.mkdir(healthDir, { recursive: true });
await fs.writeFile(payload.jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  reportPath: payload.reportPath,
  jsonPath: payload.jsonPath,
  health: payload.health,
  scheduledTask: payload.scheduledTask,
  latestRun: payload.state.latestRun,
  latestSuccess: payload.state.latestSuccess,
}, null, 2));

function queryScheduledTask(name) {
  if (process.platform !== 'win32') {
    return { platform: process.platform, found: null, note: 'Task Scheduler probe is Windows-only.' };
  }

  const script = `
$taskName = ${JSON.stringify(name)}
function Format-DateOrNull($value) {
  if ($null -eq $value) { return $null }
  if ($value.Year -lt 2000) { return $null }
  return $value.ToUniversalTime().ToString("o")
}
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $task) {
  [pscustomobject]@{ platform = 'win32'; found = $false; taskName = $taskName } | ConvertTo-Json -Depth 8
  exit 0
}
$info = Get-ScheduledTaskInfo -TaskName $taskName
$action = @($task.Actions)[0]
$hourlyTrigger = @($task.Triggers | Where-Object { $_.Repetition.Interval -eq 'PT1H' } | Select-Object -First 1)[0]
[pscustomobject]@{
  platform = 'win32'
  found = $true
  taskName = $task.TaskName
  state = [string]$task.State
  lastRunTime = Format-DateOrNull $info.LastRunTime
  nextRunTime = Format-DateOrNull $info.NextRunTime
  lastTaskResult = $info.LastTaskResult
  numberOfMissedRuns = $info.NumberOfMissedRuns
  executionTimeLimit = [string]$task.Settings.ExecutionTimeLimit
  multipleInstances = [string]$task.Settings.MultipleInstances
  startWhenAvailable = [bool]$task.Settings.StartWhenAvailable
  stopIfGoingOnBatteries = [bool]$task.Settings.StopIfGoingOnBatteries
  disallowStartIfOnBatteries = [bool]$task.Settings.DisallowStartIfOnBatteries
  wakeToRun = [bool]$task.Settings.WakeToRun
  action = if ($null -eq $action) { $null } else { [pscustomobject]@{
    execute = [string]$action.Execute
    arguments = [string]$action.Arguments
    workingDirectory = [string]$action.WorkingDirectory
  } }
  hourlyTrigger = if ($null -eq $hourlyTrigger) { $null } else { [pscustomobject]@{
    enabled = [bool]$hourlyTrigger.Enabled
    startBoundary = [string]$hourlyTrigger.StartBoundary
    endBoundary = [string]$hourlyTrigger.EndBoundary
    repetitionInterval = [string]$hourlyTrigger.Repetition.Interval
    repetitionDuration = [string]$hourlyTrigger.Repetition.Duration
  } }
} | ConvertTo-Json -Depth 8
`;

  const result = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.status !== 0) {
    return {
      platform: 'win32',
      found: null,
      error: trim(result.stderr || result.stdout, 1200),
    };
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    return {
      platform: 'win32',
      found: null,
      error: 'Failed to parse scheduled task JSON.',
      stdout: trim(result.stdout, 1200),
    };
  }
}

function summarizeRun(run, age) {
  return {
    runId: run.runId,
    status: run.status,
    startedAt: run.startedAt || null,
    finishedAt: run.finishedAt || null,
    ageMinutes: round(age),
    reportPath: run.reportPath || null,
    autoComplete: run.autoComplete || null,
    topCandidate: run.topCandidate ? {
      id: run.topCandidate.id,
      title: run.topCandidate.title,
      score: run.topCandidate.score,
    } : null,
  };
}

function renderMarkdown(data) {
  const lines = [
    '# LOOPS Wakeup Health',
    '',
    `- generated_at: ${data.generatedAt}`,
    `- repo: ${data.repoRoot}`,
    `- automation_id: ${data.automationId}`,
    `- state_dir: ${data.stateDir}`,
    `- task_name: ${data.taskName}`,
    `- status_fingerprint: ${data.statusFingerprint}`,
    `- overall_ok: ${data.health.ok}`,
    `- warning_count: ${data.health.warnings?.length || 0}`,
    '',
    '## Checks',
    '',
  ];

  for (const [name, value] of Object.entries(data.health.checks)) {
    lines.push(`- ${name}: ${value}`);
  }

  lines.push('', '## Warnings', '');
  if (data.health.warnings?.length) {
    for (const warning of data.health.warnings) lines.push(`- ${warning}`);
  } else {
    lines.push('- None.');
  }

  lines.push('');
  lines.push('## Recent Runs');
  lines.push('');
  lines.push(`- state_file_exists: ${data.state.stateFileExists}`);
  lines.push(`- run_count: ${data.state.runCount}`);
  lines.push(`- latest_run: ${formatRun(data.state.latestRun)}`);
  lines.push(`- latest_success: ${formatRun(data.state.latestSuccess)}`);
  lines.push('');
  lines.push('## Lock');
  lines.push('');
  lines.push(`- exists: ${data.lock.exists}`);
  if (data.lock.exists) {
    lines.push(`- age_minutes: ${data.lock.ageMinutes}`);
    lines.push(`- owner: ${data.lock.owner || '(unknown)'}`);
    lines.push(`- run_id: ${data.lock.runId || '(unknown)'}`);
  }
  lines.push('');
  lines.push('## Scheduled Task');
  lines.push('');
  for (const [name, value] of Object.entries(data.scheduledTask || {})) {
    lines.push(`- ${name}: ${value === null ? '(null)' : value}`);
  }
  lines.push('');
  lines.push('## Red Lines');
  lines.push('');
  lines.push('- This report does not modify the scheduled task.');
  lines.push('- This report does not start a run, deploy, push, or write secrets.');
  lines.push('- If `overall_ok` is false, inspect the failing checks before relying on hourly wakeups.');

  return lines.join('\n');
}

function formatRun(run) {
  if (!run) return '(none)';
  return `${run.status} ${run.runId} age=${run.ageMinutes}m report=${run.reportPath || '(none)'}`;
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function ageMinutes(value, base) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return null;
  return (base.getTime() - timestamp) / 60_000;
}

function minutesUntil(value, base) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return null;
  return (timestamp - base.getTime()) / 60_000;
}

function parseIsoDurationMinutes(value) {
  const text = String(value || '');
  const match = text.match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)$/);
  if (!match) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 60 + minutes + seconds / 60;
}

function numberFromEnv(name, fallback) {
  const parsed = Number.parseFloat(process.env[name] || '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value) {
  return value === null ? null : Math.round(value * 10) / 10;
}

function trim(value, limit) {
  const text = String(value || '').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}
