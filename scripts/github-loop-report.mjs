#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { runGithubIssueFromLatestRun } from './lib/github-loop-bridge.mjs';

const args = new Set(process.argv.slice(2));
const projectRoot = process.cwd();
const stateDir = path.resolve(process.env.LOOPS_STATE_DIR || path.join(projectRoot, '.loops'));
const configPath = path.resolve(process.env.LOOPS_TASKS_FILE || path.join(projectRoot, 'scripts', 'loops.tasks.json'));

const config = await readJson(configPath);
const configuredTask = Array.isArray(config?.tasks)
  ? config.tasks.find((task) => task.task_type === 'github_issue_from_latest_run')
  : null;

const task = configuredTask || {
  payload: {
    title_prefix: '[LOOPS]',
    labels: ['loops', 'automation'],
    mode: 'draft',
    review_gate: 'manual_create_only',
  },
};

if (args.has('--create-issue')) {
  delete task.payload.mode;
  delete task.payload.review_gate;
}

const result = await runGithubIssueFromLatestRun({ stateDir, task, now: new Date() });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) process.exitCode = 1;

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}
