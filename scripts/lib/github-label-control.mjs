const DEFAULT_LABELS = {
  retry: 'loop:retry',
  ignore: 'loop:ignore',
  promote: 'loop:promote',
};

export async function readGithubLabelControlTasks({ configTasks, now, dryRun = false }) {
  const control = configTasks.find((task) => task.task_type === 'github_label_control');
  if (!control || control.payload?.enabled === false) return emptyControl();

  const payload = control.payload || {};
  const repo = payload.repository || process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!repo || !token) {
    return {
      ...emptyControl(),
      warnings: ['missing GitHub repository or token; label control skipped'],
    };
  }

  const labels = { ...DEFAULT_LABELS, ...(payload.labels || {}) };
  const maxIssues = Number.isFinite(Number(payload.max_issues_per_label))
    ? Number(payload.max_issues_per_label)
    : 20;
  const acknowledgeRequested = payload.acknowledge_labels === true;
  const acknowledgeAllowed = process.env.LOOPS_ALLOW_GITHUB_LABEL_ACK === '1';
  const acknowledge = acknowledgeRequested && acknowledgeAllowed;
  const taskIndex = indexConfigTasks(configTasks);
  const generated = [];
  const ignoredKeys = new Set();
  const actions = [];
  const warnings = [];

  if (acknowledgeRequested && !acknowledgeAllowed) {
    warnings.push('acknowledge_labels requested but LOOPS_ALLOW_GITHUB_LABEL_ACK is not 1; running label control read-only');
  }

  for (const [action, label] of Object.entries(labels)) {
    const issues = await listOpenIssuesByLabel({ repo, token, label, maxIssues });
    if (!issues.ok) {
      warnings.push(`${label}: ${issues.error || 'failed to list issues'}`);
      continue;
    }

    for (const issue of issues.items) {
      const refs = parseTaskRefs(issue.body || '');
      if (refs.length === 0) {
        generated.push(noteTask({ action, label, issue, now, summary: 'No task reference found in issue body' }));
        actions.push({ action, label, issue_number: issue.number, matched: false });
        if (acknowledge && !dryRun) await acknowledgeControlLabel({ repo, token, issue, label, action, summary: 'No task reference found' });
        continue;
      }

      for (const ref of refs) {
        const key = taskKey(ref);
        if (action === 'ignore') {
          ignoredKeys.add(key);
          actions.push({ action, label, issue_number: issue.number, matched: true, task: ref });
          continue;
        }

        const template = taskIndex.get(key);
        if (!template) {
          generated.push(noteTask({ action, label, issue, now, summary: `No config task matched ${key}` }));
          actions.push({ action, label, issue_number: issue.number, matched: false, task: ref });
          continue;
        }

        generated.push(controlledTask({ action, label, issue, now, template }));
        actions.push({ action, label, issue_number: issue.number, matched: true, task: ref });
      }

      if (acknowledge && !dryRun) {
        await acknowledgeControlLabel({ repo, token, issue, label, action, summary: `Consumed ${refs.length} task reference(s)` });
      }
    }
  }

  return { tasks: generated, ignoredKeys, actions, warnings };
}

function emptyControl() {
  return { tasks: [], ignoredKeys: new Set(), actions: [], warnings: [] };
}

function indexConfigTasks(configTasks) {
  const out = new Map();
  for (const task of configTasks) {
    if (task.task_type === 'github_label_control') continue;
    out.set(taskKey(task), task);
  }
  return out;
}

function taskKey(task) {
  return `${task.task_type}:${task.source_id}`;
}

function controlledTask({ action, label, issue, now, template }) {
  const boost = action === 'promote' ? 99 : 96;
  return {
    ...template,
    task_id: undefined,
    source: 'github-label',
    source_id: `${template.source_id}#${action}-issue-${issue.number}`,
    priority_base: Math.max(Number(template.priority_base || 0), boost),
    dedup_window_minutes: 0,
    payload: {
      ...(template.payload || {}),
      github_control: {
        action,
        label,
        issue_number: issue.number,
        issue_url: issue.html_url,
        consumed_at: now.toISOString(),
        original_source_id: template.source_id,
      },
    },
  };
}

function noteTask({ action, label, issue, now, summary }) {
  return {
    task_type: 'note',
    source: 'github-label',
    source_id: `github-label-${action}-issue-${issue.number}`,
    priority_base: action === 'promote' ? 90 : 70,
    dedup_window_minutes: 60,
    risk_score: 0.05,
    payload: {
      summary,
      github_control: {
        action,
        label,
        issue_number: issue.number,
        issue_url: issue.html_url,
        consumed_at: now.toISOString(),
      },
    },
  };
}

function parseTaskRefs(body) {
  const refs = [];
  const seen = new Set();
  const pattern = /-\s+`([^`]+)`\s+\/\s+`([^`]+)`/g;
  for (const match of body.matchAll(pattern)) {
    const ref = { task_type: match[1], source_id: match[2] };
    const key = taskKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push(ref);
  }
  return refs;
}

async function listOpenIssuesByLabel({ repo, token, label, maxIssues }) {
  const query = new URLSearchParams({
    state: 'open',
    per_page: String(Math.min(Math.max(maxIssues, 1), 100)),
    labels: label,
  });
  const response = await githubRequest({ repo, token, path: `issues?${query.toString()}`, method: 'GET' });
  if (!response.ok || !Array.isArray(response.data)) {
    return {
      ok: false,
      error: response.data?.message || response.text?.slice(0, 300) || `GitHub issues list failed with ${response.status}`,
    };
  }
  return {
    ok: true,
    items: response.data.filter((issue) => !issue.pull_request),
  };
}

async function acknowledgeControlLabel({ repo, token, issue, label, action, summary }) {
  await githubRequest({
    repo,
    token,
    path: `issues/${issue.number}/comments`,
    method: 'POST',
    body: {
      body: [
        `LOOPS consumed \`${label}\` as \`${action}\`.`,
        '',
        summary,
        '',
        'Remove or re-add a loop control label to change the next run behavior.',
      ].join('\n'),
    },
  });
  await githubRequest({
    repo,
    token,
    path: `issues/${issue.number}/labels/${encodeURIComponent(label)}`,
    method: 'DELETE',
  });
}

async function githubRequest({ repo, token, path: requestPath, method, body }) {
  const response = await fetch(`https://api.github.com/repos/${repo}/${requestPath}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'loops-label-control/0.1',
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

function parseJsonMaybe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
