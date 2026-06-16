import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

export async function runGithubIssueFromLatestRun({ stateDir, task, now }) {
  const payload = task.payload || {};
  const runsPath = path.join(stateDir, 'runs.jsonl');
  const outDir = path.join(stateDir, 'github');
  const latestRun = await readLatestRun(runsPath);

  if (!latestRun) {
    return { ok: true, summary: 'no loop runs found to report', skipped: true };
  }

  const action = classifyRunAction(latestRun);
  const dedupeKey = fingerprintText(`${action.title}:${action.reason}`);
  const titlePrefix = payload.title_prefix || '[LOOPS]';
  const title = `${titlePrefix} ${summarizeRunForTitle(latestRun, action)}`.slice(0, 240);
  const body = renderIssueBody(latestRun, now, action, dedupeKey);
  const draftPath = path.join(outDir, `${safeStamp(now)}-${latestRun.run_id || 'latest'}-issue.md`);

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(draftPath, `# ${title}\n\n${body}\n`, 'utf8');

  const issuePolicy = payload.issue_policy || 'actionable_only';
  if (!shouldCreateIssue(action, issuePolicy)) {
    return {
      ok: true,
      created: false,
      issue_policy: issuePolicy,
      actionable: action.actionable,
      action_reason: action.reason,
      summary: `created GitHub issue draft only; ${action.reason}`,
      artifact_paths: { markdown: draftPath },
    };
  }

  if (payload.mode === 'draft' || payload.review_gate === 'manual_create_only') {
    return {
      ok: true,
      created: false,
      actionable: action.actionable,
      action_reason: action.reason,
      review_gate: payload.review_gate || 'manual_create_only',
      summary: 'created GitHub issue draft only',
      artifact_paths: { markdown: draftPath },
    };
  }

  const repo = payload.repository || process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!repo || !token) {
    return {
      ok: true,
      created: false,
      actionable: action.actionable,
      action_reason: action.reason,
      dedupe_key: dedupeKey,
      review_gate: 'missing_github_token_or_repository',
      summary: 'created GitHub issue draft; GitHub token/repository not available',
      artifact_paths: { markdown: draftPath },
    };
  }

  if (payload.dedupe_open_issues !== false) {
    const existing = await findOpenIssueByDedupeKey({ repo, token, dedupeKey, labels: payload.labels });
    if (existing) {
      const comment = await createIssueComment({
        repo,
        token,
        issueNumber: existing.number,
        body: renderDedupeComment(latestRun, now, action, dedupeKey),
      });
      if (!comment.ok) return { ...comment, artifact_paths: { markdown: draftPath } };
      return {
        ok: true,
        created: false,
        updated: true,
        issue_url: existing.html_url,
        issue_number: existing.number,
        actionable: action.actionable,
        action_reason: action.reason,
        dedupe_key: dedupeKey,
        summary: `updated existing GitHub issue #${existing.number}`,
        artifact_paths: { markdown: draftPath },
      };
    }
  }

  const response = await githubRequest({
    repo,
    token,
    path: 'issues',
    method: 'POST',
    body: {
      title,
      body,
      labels: Array.isArray(payload.labels) ? payload.labels : ['loops'],
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      retryable: response.status === 429 || response.status >= 500,
      status: response.status,
      error: response.data?.message || response.text?.slice(0, 300) || `GitHub issue create failed with ${response.status}`,
      artifact_paths: { markdown: draftPath },
    };
  }

  return {
    ok: true,
    created: true,
    status: response.status,
    issue_url: response.data?.html_url,
    actionable: action.actionable,
    action_reason: action.reason,
    dedupe_key: dedupeKey,
    summary: `created GitHub issue ${response.data?.number ? `#${response.data.number}` : ''}`.trim(),
    artifact_paths: { markdown: draftPath },
  };
}

async function readLatestRun(runsPath) {
  let raw = '';
  try {
    raw = await fs.readFile(runsPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }

  const lines = raw.split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const run = parseJsonMaybe(lines[i]);
    if (run && !run.dry_run) return run;
  }
  return null;
}

function renderIssueBody(run, now, action, dedupeKey) {
  const selected = Array.isArray(run.selected) ? run.selected : [];
  const results = Array.isArray(run.results) ? run.results : [];
  const skipped = Array.isArray(run.skipped) ? run.skipped : [];

  const lines = [
    '## Loop Run',
    '',
    `- Run ID: \`${run.run_id || 'unknown'}\``,
    `- Started: \`${run.started_at || 'unknown'}\``,
    `- Finished: \`${run.finished_at || 'unknown'}\``,
    `- Reporter time: \`${now.toISOString()}\``,
    `- Status: \`${run.ok ? 'ok' : 'failed'}\``,
    `- Actionable: \`${action.actionable ? 'yes' : 'no'}\``,
    `- Reason: ${action.reason}`,
    `- Dedupe: \`LOOPS-DEDUPE:${dedupeKey}\``,
    '',
    '## Selected',
    '',
    ...listTaskViews(selected),
    '',
    '## Results',
    '',
    ...listResults(results),
  ];

  if (skipped.length > 0) {
    lines.push('', '## Skipped', '', ...listSkipped(skipped));
  }

  lines.push('', '## Next Action', '', '- Review this issue, close it if it is only a heartbeat, or convert a failed/retryable item into a concrete task.');
  return lines.join('\n');
}

function renderDedupeComment(run, now, action, dedupeKey) {
  return [
    `## Repeat loop event: ${action.title}`,
    '',
    `- Run ID: \`${run.run_id || 'unknown'}\``,
    `- Finished: \`${run.finished_at || 'unknown'}\``,
    `- Reporter time: \`${now.toISOString()}\``,
    `- Reason: ${action.reason}`,
    `- Dedupe: \`LOOPS-DEDUPE:${dedupeKey}\``,
    '',
    'This event matched an existing open issue, so LOOPS updated this thread instead of opening a duplicate issue.',
  ].join('\n');
}

function listTaskViews(tasks) {
  if (tasks.length === 0) return ['- None'];
  return tasks.map((task) => `- \`${task.task_type || 'task'}\` / \`${task.source_id || 'unknown'}\` score=${task.score ?? 'n/a'}`);
}

function listResults(results) {
  if (results.length === 0) return ['- None'];
  return results.map((item) => {
    const task = item.task || {};
    const result = item.result || {};
    const status = result.ok ? 'ok' : 'failed';
    const summary = result.summary || result.error || 'no summary';
    return `- \`${task.task_type || 'task'}\` / \`${task.source_id || 'unknown'}\`: ${status} - ${summary}`;
  });
}

function listSkipped(skipped) {
  return skipped.map((item) => {
    const task = item.task || {};
    return `- \`${task.task_type || 'task'}\` / \`${task.source_id || 'unknown'}\`: ${item.reason || 'skipped'}`;
  });
}

function summarizeRunForTitle(run, action) {
  if (action.actionable) return `${action.title} ${run.run_id || ''}`.trim();
  if (!run.ok) return `failed run ${run.run_id || ''}`.trim();
  const resultCount = Array.isArray(run.results) ? run.results.length : 0;
  if (resultCount === 0) return `heartbeat ${run.run_id || ''}`.trim();
  return `${resultCount} result${resultCount === 1 ? '' : 's'} from ${run.run_id || 'latest run'}`;
}

function classifyRunAction(run) {
  if (!run.ok) {
    return { actionable: true, title: 'failed run', reason: 'loop run failed' };
  }

  const results = Array.isArray(run.results) ? run.results : [];
  const failed = results.find((item) => item?.result && item.result.ok === false);
  if (failed) {
    return {
      actionable: true,
      title: 'task failed',
      reason: `${failed.task?.task_type || 'task'} / ${failed.task?.source_id || 'unknown'} failed`,
    };
  }

  const retryable = results.find((item) => item?.result?.retryable);
  if (retryable) {
    return {
      actionable: true,
      title: 'retryable task',
      reason: `${retryable.task?.task_type || 'task'} / ${retryable.task?.source_id || 'unknown'} is retryable`,
    };
  }

  const generated = results.find((item) => {
    const result = item?.result || {};
    return Number(result.generated_count || 0) > 0 || Boolean(result.batch_id) || Boolean(result.issue_url);
  });
  if (generated) {
    return {
      actionable: true,
      title: 'new loop output',
      reason: `${generated.task?.task_type || 'task'} / ${generated.task?.source_id || 'unknown'} produced new output`,
    };
  }

  if (run.empty_heartbeat) {
    return { actionable: false, title: 'heartbeat', reason: 'empty heartbeat; no action needed' };
  }

  return { actionable: false, title: 'heartbeat', reason: 'all selected tasks completed without actionable output' };
}

function shouldCreateIssue(action, policy) {
  if (policy === 'always') return true;
  if (policy === 'failed_only') return action.actionable && /fail|retry/i.test(action.reason);
  return action.actionable;
}

async function findOpenIssueByDedupeKey({ repo, token, dedupeKey, labels }) {
  const query = new URLSearchParams({
    state: 'open',
    per_page: '100',
  });
  const labelList = Array.isArray(labels) && labels.length > 0 ? labels : ['loops'];
  if (labelList.length > 0) query.set('labels', labelList.join(','));

  const response = await githubRequest({ repo, token, path: `issues?${query.toString()}`, method: 'GET' });
  if (!response.ok || !Array.isArray(response.data)) return null;
  const marker = `LOOPS-DEDUPE:${dedupeKey}`;
  return response.data.find((issue) => {
    if (issue.pull_request) return false;
    return typeof issue.body === 'string' && issue.body.includes(marker);
  }) || null;
}

async function createIssueComment({ repo, token, issueNumber, body }) {
  const response = await githubRequest({
    repo,
    token,
    path: `issues/${issueNumber}/comments`,
    method: 'POST',
    body: { body },
  });
  if (response.ok) return { ok: true, status: response.status };
  return {
    ok: false,
    retryable: response.status === 429 || response.status >= 500,
    status: response.status,
    error: response.data?.message || response.text?.slice(0, 300) || `GitHub issue comment failed with ${response.status}`,
  };
}

async function githubRequest({ repo, token, path: requestPath, method, body }) {
  const response = await fetch(`https://api.github.com/repos/${repo}/${requestPath}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'loops-github-bridge/0.1',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    text,
    data: parseJsonMaybe(text),
  };
}

function fingerprintText(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function safeStamp(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function parseJsonMaybe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
