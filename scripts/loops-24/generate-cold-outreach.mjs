#!/usr/bin/env node
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { runColdOutreachBatch } from '../lib/cold-outreach.mjs';

const automationId = process.env.LOOPS_AUTOMATION_ID || 'loops-24';
const repoRoot = path.resolve(process.env.LOOPS_REPO_ROOT || process.cwd());
const codexHome = process.env.CODEX_HOME
  || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.codex') : path.join(os.homedir(), '.codex'));
const stateDir = path.resolve(
  process.env.LOOPS_STATE_DIR || path.join(codexHome, 'automations', automationId)
);

const task = {
  task_type: 'cold_outreach_batch',
  source_id: '3q-cold-outreach-draft-batch',
  payload: {
    config_path: process.env.LOOPS_OUTREACH_CONFIG || 'scripts/outreach.prospects.json',
    batch_size: process.env.LOOPS_OUTREACH_BATCH_SIZE || 5,
    cooldown_days: process.env.LOOPS_OUTREACH_COOLDOWN_DAYS || 14,
    review_gate: 'manual_send_only',
  },
};

const result = await runColdOutreachBatch({
  projectRoot: repoRoot,
  stateDir,
  task,
  now: new Date(),
  dryRun: process.argv.includes('--dry-run'),
});

console.log(JSON.stringify(result, null, 2));
process.exitCode = result.ok ? 0 : 1;
