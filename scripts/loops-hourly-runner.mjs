#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { runColdOutreachBatch } from './lib/cold-outreach.mjs';
import { runGithubIssueFromLatestRun } from './lib/github-loop-bridge.mjs';
import { runGoogleBusinessProspecting } from './lib/google-business-prospector.mjs';

const projectRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const jsonOutput = args.has('--json');

const stateDir = path.resolve(process.env.LOOPS_STATE_DIR || path.join(projectRoot, '.loops'));
const configPath = path.resolve(process.env.LOOPS_TASKS_FILE || path.join(projectRoot, 'scripts', 'loops.tasks.json'));
const inboxPath = path.resolve(process.env.LOOPS_INBOX_FILE || path.join(stateDir, 'inbox.jsonl'));
const statePath = path.join(stateDir, 'state.json');
const runsPath = path.join(stateDir, 'runs.jsonl');
const lockPath = path.join(stateDir, 'runner.lock');

const now = new Date();
const runId = `${now.toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;

const lockTtlMs = intEnv('LOOPS_LOCK_TTL_SECONDS', 55 * 60) * 1000;
const budgetMs = intEnv('LOOPS_RUN_BUDGET_SECONDS', 45 * 60) * 1000;
const maxTasks = intEnv('LOOPS_MAX_TASKS', 3);
const defaultDedupMinutes = intEnv('LOOPS_DEDUP_WINDOW_MINUTES', 6 * 60);
const taskTimeoutMs = intEnv('LOOPS_TASK_TIMEOUT_SECONDS', 10 * 60) * 1000;

main().catch(async (error) => {
  const failure = {
    ok: false,
    run_id: runId,
    error: error.message,
    stack: process.env.LOOPS_DEBUG ? error.stack : undefined,
  };
  await safeAppendJson(runsPath, { ...failure, finished_at: new Date().toISOString() });
  print(failure);
  process.exitCode = 1;
});

async function main() {
  await fs.mkdir(stateDir, { recursive: true });

  const lock = dryRun ? { acquired: true, dry_run: true } : await acquireLock();
  if (!lock.acquired) {
    const standby = {
      ok: true,
      run_id: runId,
      status: 'standby',
      reason: lock.reason,
      lock: lock.lock,
      finished_at: new Date().toISOString(),
    };
    await safeAppendJson(runsPath, standby);
    print(standby);
    return;
  }

  let state = await loadState();
  const startedAt = Date.now();
  const run = {
    run_id: runId,
    started_at: now.toISOString(),
    dry_run: dryRun,
    selected: [],
    skipped: [],
    results: [],
  };

  try {
    compactState(state);
    const discovered = await discoverCandidates(state);
    const ready = normalizeAndFilter(discovered, state, run);
    const selected = selectTasks(ready, startedAt);
    run.selected = selected.map(taskView);

    if (!dryRun) {
      for (const task of selected) {
        const result = await runTaskSlice(task);
        run.results.push({ task: taskView(task), result });
        applyResult(state, task, result);
      }

      if (selected.length === 0) {
        state.last_success_timestamp = new Date().toISOString();
        run.empty_heartbeat = true;
      }

      state.runs.unshift({
        run_id: runId,
        started_at: run.started_at,
        finished_at: new Date().toISOString(),
        selected_count: selected.length,
        skipped_count: run.skipped.length,
        result_count: run.results.length,
      });
      state.runs = state.runs.slice(0, 50);
      await saveState(state);
    }

    run.ok = true;
    run.finished_at = new Date().toISOString();
    await safeAppendJson(runsPath, run);
    print(run);
  } finally {
    if (!dryRun) await releaseLock(lock);
  }
}

async function discoverCandidates(state) {
  const configTasks = await readConfigTasks();
  const inboxTasks = await readInboxTasks();
  const retryTasks = state.pending_tasks
    .filter((task) => !task.retry_at || new Date(task.retry_at).getTime() <= Date.now())
    .map((task) => ({ ...task, source: 'state' }));

  return [...retryTasks, ...configTasks, ...inboxTasks];
}

async function readConfigTasks() {
  const file = await readJsonIfExists(configPath);
  if (Array.isArray(file)) return file.map((task) => ({ ...task, source: 'config' }));
  if (file && Array.isArray(file.tasks)) return file.tasks.map((task) => ({ ...task, source: 'config' }));
  return defaultTasks();
}

async function readInboxTasks() {
  const raw = await readTextIfExists(inboxPath);
  if (!raw.trim()) return [];
  const tasks = [];
  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      tasks.push({ ...JSON.parse(line), source: 'inbox', source_line: index + 1 });
    } catch (error) {
      tasks.push({
        task_type: 'note',
        source_id: `invalid-inbox-line-${index + 1}`,
        priority_base: 5,
        payload: { error: error.message, line: line.slice(0, 200) },
        source: 'inbox',
      });
    }
  }
  return tasks;
}

function defaultTasks() {
  return [
    {
      task_type: 'cloudflare_worker_health',
      source_id: '3q-social-publisher-health',
      priority_base: 80,
      dedup_window_minutes: 55,
      loopability_score: 1,
      risk_score: 0.05,
      payload: {
        url: 'https://3q-social-publisher.milk790.workers.dev/health',
        expect_ok: true,
      },
    },
    {
      task_type: 'google_business_prospecting',
      source_id: '3q-google-business-prospecting',
      priority_base: 92,
      dedup_window_minutes: 720,
      loopability_score: 0.9,
      risk_score: 0.22,
      payload: {
        config_path: 'scripts/outreach.prospects.json',
        limit_per_query: 8,
        max_new: 20,
        review_gate: 'manual_send_only',
      },
    },
    {
      task_type: 'repo_status',
      source_id: 'repo-working-tree-status',
      priority_base: 60,
      dedup_window_minutes: 55,
      loopability_score: 1,
      risk_score: 0.05,
      payload: {
        cwd: '.',
      },
    },
  ];
}

function normalizeAndFilter(candidates, state, run) {
  const out = [];
  for (const candidate of candidates) {
    const task = normalizeTask(candidate);
    const dedupWindow = Number.isFinite(task.dedup_window_minutes)
      ? task.dedup_window_minutes
      : defaultDedupMinutes;

    if (dedupWindow > 0) {
      const previous = state.dedup_fingerprints[task.fingerprint];
      if (previous) {
        const ageMs = Date.now() - new Date(previous.last_seen_at).getTime();
        if (ageMs >= 0 && ageMs < dedupWindow * 60 * 1000) {
          run.skipped.push({
            task: taskView(task),
            reason: 'recent_duplicate',
            previous_run_id: previous.run_id,
            last_seen_at: previous.last_seen_at,
          });
          continue;
        }
      }
    }

    task.cycle_penalty = detectCyclePenalty(state, task);
    task.score = scoreTask(task);
    out.push(task);
  }
  return out;
}

function normalizeTask(input) {
  const payload = input.payload && typeof input.payload === 'object' ? input.payload : {};
  const task = {
    task_id: input.task_id || randomUUID(),
    task_type: input.task_type || 'note',
    source_id: input.source_id || input.name || 'unnamed',
    source: input.source || 'unknown',
    payload,
    created_at: input.created_at || now.toISOString(),
    deadline_at: input.deadline_at || null,
    retry_at: input.retry_at || null,
    attempt_count: input.attempt_count || 0,
    priority_base: numberOr(input.priority_base, 50),
    value_score: numberOr(input.value_score, null),
    loopability_score: numberOr(input.loopability_score, 0.7),
    freshness_score: numberOr(input.freshness_score, null),
    risk_score: numberOr(input.risk_score, 0.2),
    dedup_window_minutes: numberOr(input.dedup_window_minutes, null),
    max_attempts: numberOr(input.max_attempts, 6),
    lineage_hash: input.lineage_hash || '',
  };
  task.fingerprint = input.fingerprint || fingerprintTask(task);
  if (!task.lineage_hash) task.lineage_hash = fingerprintText(`${task.task_type}:${task.source_id}`);
  return task;
}

function scoreTask(task) {
  const value = clamp01(task.value_score ?? task.priority_base / 100);
  const urgency = urgencyScore(task);
  const starvation = starvationBoost(task);
  const loopability = clamp01(task.loopability_score);
  const freshness = clamp01(task.freshness_score ?? freshnessScore(task));
  const retryPenalty = clamp01(task.attempt_count * 0.15);
  const riskPenalty = clamp01(task.risk_score);
  const duplicatePenalty = 0;
  const cyclePenalty = clamp01(task.cycle_penalty || 0);

  return Math.round(1000 * (
    0.35 * value +
    0.20 * urgency +
    0.15 * starvation +
    0.10 * loopability +
    0.10 * freshness -
    0.05 * retryPenalty -
    0.05 * riskPenalty -
    0.10 * duplicatePenalty -
    0.10 * cyclePenalty
  )) / 10;
}

function selectTasks(tasks, startedAt) {
  return tasks
    .filter(() => Date.now() - startedAt < budgetMs)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxTasks);
}

async function runTaskSlice(task) {
  const startedAt = new Date().toISOString();
  try {
    let result;
    if (task.task_type === 'cloudflare_worker_health') {
      result = await runHttpGet(task, true);
    } else if (task.task_type === 'http_get') {
      result = await runHttpGet(task, false);
    } else if (task.task_type === 'repo_status') {
      result = await runRepoStatus(task);
    } else if (task.task_type === 'google_business_prospecting') {
      result = await runGoogleBusinessProspecting({ projectRoot, stateDir, task, now: new Date() });
    } else if (task.task_type === 'cold_outreach_batch') {
      result = await runColdOutreachBatch({ projectRoot, stateDir, task, now: new Date() });
    } else if (task.task_type === 'github_issue_from_latest_run') {
      result = await runGithubIssueFromLatestRun({ stateDir, task, now: new Date() });
    } else if (task.task_type === 'note') {
      result = { ok: true, summary: task.payload.summary || 'note recorded' };
    } else {
      result = { ok: false, retryable: false, error: `unsupported task_type: ${task.task_type}` };
    }
    return { started_at: startedAt, finished_at: new Date().toISOString(), ...result };
  } catch (error) {
    return {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      ok: false,
      retryable: isRetryableError(error),
      error: error.message,
    };
  }
}

async function runHttpGet(task, expectWorkerHealth) {
  const url = task.payload.url;
  if (!url || !/^https?:\/\//i.test(url)) {
    return { ok: false, retryable: false, error: 'payload.url must be http(s)' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), taskTimeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'loops-hourly-runner/0.1' },
    });
    const text = await response.text();
    const body = parseJsonMaybe(text);
    const retryAfter = response.headers.get('retry-after');
    const statusOk = response.status >= 200 && response.status < 300;
    const healthOk = !expectWorkerHealth || body?.ok === true;
    return {
      ok: statusOk && healthOk,
      retryable: response.status === 429 || response.status >= 500,
      status: response.status,
      retry_after_seconds: retryAfter ? parseRetryAfter(retryAfter) : null,
      summary: summarizeHttp(url, response.status, body, text),
      body_keys: body && typeof body === 'object' ? Object.keys(body).slice(0, 20) : [],
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runRepoStatus(task) {
  const cwd = path.resolve(projectRoot, task.payload.cwd || '.');
  if (!cwd.startsWith(projectRoot)) {
    return { ok: false, retryable: false, error: 'repo_status cwd must stay inside project root' };
  }
  const { code, stdout, stderr } = await execFile('git', ['status', '--short'], { cwd, timeoutMs: taskTimeoutMs });
  if (code !== 0) {
    return { ok: false, retryable: false, error: stderr || `git status exited ${code}` };
  }
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  return {
    ok: true,
    clean: lines.length === 0,
    changed_count: lines.length,
    summary: lines.length === 0 ? 'working tree clean' : `working tree has ${lines.length} changed paths`,
  };
}

function applyResult(state, task, result) {
  state.lineage_recent.unshift({
    run_id: runId,
    lineage_hash: task.lineage_hash,
    fingerprint: task.fingerprint,
    at: new Date().toISOString(),
    ok: Boolean(result.ok),
  });
  state.lineage_recent = state.lineage_recent.slice(0, 200);

  if (result.ok) {
    state.last_success_timestamp = new Date().toISOString();
    state.dedup_fingerprints[task.fingerprint] = {
      run_id: runId,
      last_seen_at: new Date().toISOString(),
      task_type: task.task_type,
      source_id: task.source_id,
    };
    state.pending_tasks = state.pending_tasks.filter((item) => item.fingerprint !== task.fingerprint);
    return;
  }

  if (result.retryable && task.attempt_count + 1 < task.max_attempts) {
    const retryAt = computeRetryAt(task, result);
    const retryTask = {
      ...task,
      attempt_count: task.attempt_count + 1,
      retry_at: retryAt,
      last_result_summary: result.error || result.summary || 'retryable failure',
    };
    state.pending_tasks = [
      retryTask,
      ...state.pending_tasks.filter((item) => item.fingerprint !== task.fingerprint),
    ].slice(0, 500);
    return;
  }

  state.dead_letters.unshift({
    task: taskView(task),
    result,
    run_id: runId,
    at: new Date().toISOString(),
  });
  state.dead_letters = state.dead_letters.slice(0, 100);
  state.pending_tasks = state.pending_tasks.filter((item) => item.fingerprint !== task.fingerprint);
}

function computeRetryAt(task, result) {
  if (result.retry_after_seconds && result.retry_after_seconds > 0) {
    return new Date(Date.now() + result.retry_after_seconds * 1000).toISOString();
  }
  const baseSeconds = Math.min(60 * 60, 30 * Math.pow(2, task.attempt_count));
  const jitter = Math.floor(Math.random() * 30);
  return new Date(Date.now() + (baseSeconds + jitter) * 1000).toISOString();
}

async function loadState() {
  const existing = await readJsonIfExists(statePath);
  return {
    version: 1,
    created_at: existing?.created_at || now.toISOString(),
    last_success_timestamp: existing?.last_success_timestamp || null,
    runs: Array.isArray(existing?.runs) ? existing.runs : [],
    pending_tasks: Array.isArray(existing?.pending_tasks) ? existing.pending_tasks : [],
    dead_letters: Array.isArray(existing?.dead_letters) ? existing.dead_letters : [],
    dedup_fingerprints: existing?.dedup_fingerprints || {},
    lineage_recent: Array.isArray(existing?.lineage_recent) ? existing.lineage_recent : [],
  };
}

async function saveState(state) {
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function compactState(state) {
  const cutoff = Date.now() - Math.max(defaultDedupMinutes * 2, 24 * 60) * 60 * 1000;
  for (const [key, value] of Object.entries(state.dedup_fingerprints)) {
    if (new Date(value.last_seen_at).getTime() < cutoff) delete state.dedup_fingerprints[key];
  }
  state.pending_tasks = state.pending_tasks.slice(0, 500);
}

async function acquireLock() {
  try {
    const handle = await fs.open(lockPath, 'wx');
    const lock = { run_id: runId, pid: process.pid, acquired_at: new Date().toISOString() };
    await handle.writeFile(JSON.stringify(lock));
    await handle.close();
    return { acquired: true, lock };
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const lock = await readJsonIfExists(lockPath);
    const acquiredAt = lock?.acquired_at ? new Date(lock.acquired_at).getTime() : 0;
    if (Date.now() - acquiredAt > lockTtlMs) {
      await fs.unlink(lockPath).catch(() => {});
      return acquireLock();
    }
    return { acquired: false, reason: 'lock_held', lock };
  }
}

async function releaseLock(lock) {
  const current = await readJsonIfExists(lockPath);
  if (current?.run_id === lock.lock?.run_id) {
    await fs.unlink(lockPath).catch(() => {});
  }
}

async function execFile(command, commandArgs, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd: options.cwd || projectRoot,
      shell: false,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), options.timeoutMs || taskTimeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function fingerprintTask(task) {
  return fingerprintText(stableJson({
    task_type: task.task_type,
    source_id: task.source_id,
    payload: task.payload,
  }));
}

function fingerprintText(text) {
  return createHash('sha256').update(text).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function detectCyclePenalty(state, task) {
  const recent = state.lineage_recent
    .filter((item) => item.lineage_hash === task.lineage_hash)
    .slice(0, 6);
  const repeats = recent.filter((item) => item.fingerprint === task.fingerprint).length;
  return repeats >= 3 ? 0.8 : 0;
}

function urgencyScore(task) {
  if (!task.deadline_at) return 0.2;
  const deadline = new Date(task.deadline_at).getTime();
  const hoursLeft = (deadline - Date.now()) / (60 * 60 * 1000);
  if (hoursLeft <= 0) return 1;
  if (hoursLeft >= 48) return 0.1;
  return clamp01(1 - hoursLeft / 48);
}

function starvationBoost(task) {
  const created = new Date(task.created_at).getTime();
  const hoursOld = Math.max(0, (Date.now() - created) / (60 * 60 * 1000));
  return clamp01(hoursOld / 24);
}

function freshnessScore(task) {
  const created = new Date(task.created_at).getTime();
  const hoursOld = Math.max(0, (Date.now() - created) / (60 * 60 * 1000));
  return clamp01(1 - hoursOld / 12);
}

function summarizeHttp(url, status, body, text) {
  const target = new URL(url);
  if (body && typeof body === 'object') {
    const service = body.worker || body.service || target.hostname;
    const configured = body.configured && typeof body.configured === 'object'
      ? ` configured=${Object.entries(body.configured).map(([key, val]) => `${key}:${Boolean(val)}`).join(',')}`
      : '';
    return `${service} status=${status}${configured}`;
  }
  return `${target.hostname} status=${status} bytes=${text.length}`;
}

function parseJsonMaybe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseRetryAfter(value) {
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds;
  const date = new Date(value).getTime();
  if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  return null;
}

function isRetryableError(error) {
  return error.name === 'AbortError' || /timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(error.message);
}

async function readJsonIfExists(filePath) {
  const text = await readTextIfExists(filePath);
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

async function safeAppendJson(filePath, value) {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, `${JSON.stringify(value)}\n`, 'utf8');
  } catch {
    // Logging must never break the runner.
  }
}

function taskView(task) {
  return {
    task_id: task.task_id,
    task_type: task.task_type,
    source_id: task.source_id,
    score: task.score,
    attempt_count: task.attempt_count,
    fingerprint: task.fingerprint.slice(0, 12),
  };
}

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function intEnv(name, fallback) {
  const n = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function print(value) {
  if (jsonOutput || process.env.LOOPS_JSON === '1') {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  const lines = [
    `LOOPS run ${value.run_id}`,
    `status: ${value.ok ? value.status || 'ok' : 'failed'}`,
  ];
  if (value.selected) lines.push(`selected: ${value.selected.length}`);
  if (value.skipped) lines.push(`skipped: ${value.skipped.length}`);
  if (value.results) {
    for (const item of value.results) {
      lines.push(`- ${item.task.task_type}/${item.task.source_id}: ${item.result.ok ? 'ok' : 'failed'} ${item.result.summary || item.result.error || ''}`);
    }
  }
  if (value.reason) lines.push(`reason: ${value.reason}`);
  process.stdout.write(`${lines.join('\n')}\n`);
}
