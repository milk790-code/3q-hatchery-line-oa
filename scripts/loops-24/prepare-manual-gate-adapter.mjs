#!/usr/bin/env node
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const automationId = process.env.LOOPS_AUTOMATION_ID || 'loops-24';
const repoRoot = path.resolve(process.env.LOOPS_REPO_ROOT || process.cwd());
const codexHome = process.env.CODEX_HOME
  || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.codex') : path.join(os.homedir(), '.codex'));
const stateDir = path.resolve(process.env.LOOPS_STATE_DIR || path.join(codexHome, 'automations', automationId));
const outDir = path.join(stateDir, 'manual-gate-adapter');
const sharedMemoryDir = path.join(stateDir, 'shared-memory');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

const scanRoots = ['scripts', 'docs', '.github'];
const scanExts = new Set(['.js', '.mjs', '.json', '.md', '.ps1', '.yml', '.yaml', '.toml', '.txt']);
const maxFileBytes = 1024 * 1024;
const canonicalMemoryPath = path.join(repoRoot, 'docs', 'loopos-cross-agent-memory.md');

const gateRules = [
  {
    gate: 'secret-input',
    aliases: ['manual_secret_input', 'secret gate', 'secret-input'],
    match: /secret|token|api[_-]?key|password|manual_secret_input|secret-input/i,
    safeSubstitutes: [
      'Create or verify local placeholder files without values.',
      'Check env var presence as booleans only.',
      'Prepare redacted secret-gate handoffs.',
      'Show owner-side commands that keep secret values on the machine.',
    ],
    hardStop: 'Do not enter, print, write, modify, or store secret values.',
  },
  {
    gate: 'deploy-approval',
    aliases: ['manual_deploy_approval', 'manual-deploy-approval'],
    match: /deploy|wrangler|production|worker|cron|manual_deploy_approval|deploy-approval/i,
    safeSubstitutes: [
      'Run syntax checks and deploy-readiness checklists.',
      'Review wrangler/config locally.',
      'Use read-only public health probes when allowed.',
      'Prepare protected verification commands without running mutating calls.',
    ],
    hardStop: 'Do not deploy, change production settings, or call mutating protected endpoints.',
  },
  {
    gate: 'push-and-pr-approval',
    aliases: ['manual_create_only', 'github write gate'],
    match: /github|pull request|\bpr\b|push|merge|issue|label ack|manual_create_only|push-and-pr/i,
    safeSubstitutes: [
      'Prepare local GitHub handoffs, PR bodies, and issue drafts.',
      'Deduplicate local issue candidates.',
      'Read label-control signals into the local run plan.',
      'Prepare ack commands only when owner explicitly enables writes.',
    ],
    hardStop: 'Do not push, create PRs or issues, merge, mutate labels, or write GitHub comments.',
  },
  {
    gate: 'manual-send-approval',
    aliases: ['manual_send_only', 'manual-send-approval'],
    match: /manual_send|manual-send|outbound|\bsending\b|\bsend-only\b|email|publish|bulk|cold-outreach|outreach|manual owner review/i,
    safeSubstitutes: [
      'Generate drafts only.',
      'Prepare prospect evidence and cooldown/dedup reports.',
      'Create manual-send checklists.',
      'Keep all contact channels as owner-reviewed evidence.',
    ],
    hardStop: 'Do not send LINE, IG, email, forms, public posts, or bulk outbound messages.',
  },
  {
    gate: 'local-review',
    aliases: ['manual_review_only', 'manual-review'],
    match: /manual_review|manual-review|frontend artifact|frontend\/artifact|slice handoff|worktree|commit boundary|stage script|manual staging/i,
    safeSubstitutes: [
      'Snapshot the worktree.',
      'Plan commit boundaries.',
      'Generate slice handoffs and stage scripts.',
      'Review frontend artifacts locally.',
    ],
    hardStop: 'Do not stage unrelated changes, commit, or run generated stage scripts without review.',
  },
];

await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(sharedMemoryDir, { recursive: true });

const hits = await scanGateReferences();
const registry = await readTaskRegistries();
const classified = classifyHits(hits, registry.tasks);
const memoryStatus = await prepareSharedMemoryCopy();
const summary = buildSummary(classified, registry, memoryStatus);

const payload = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  stateDir,
  summary,
  gates: classified,
  registry,
  memoryStatus,
  redLines: gateRules.map(rule => ({ gate: rule.gate, hardStop: rule.hardStop })),
};

const jsonPath = path.join(outDir, `${stamp}-manual-gate-adapter.json`);
const reportPath = path.join(outDir, `${stamp}-manual-gate-adapter.md`);
await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2));
await fs.writeFile(reportPath, renderMarkdown(payload));
await fs.copyFile(jsonPath, path.join(outDir, 'latest.json'));
await fs.copyFile(reportPath, path.join(outDir, 'latest.md'));

console.log(JSON.stringify({
  ok: true,
  reportPath,
  jsonPath,
  sharedMemoryPath: memoryStatus.generatedCopyPath,
  summary,
}, null, 2));

async function scanGateReferences() {
  const files = [];
  for (const root of scanRoots) {
    walk(path.join(repoRoot, root), files);
  }

  const hits = [];
  for (const file of files) {
    let text;
    try {
      text = await fs.readFile(file, 'utf8');
    } catch {
      continue;
    }
    const rel = relative(file);
    if (!isRelevantGateFile(rel)) continue;
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      const matched = gateRules.filter(rule => rule.match.test(line));
      if (!matched.length) return;
      hits.push({
        file: rel,
        line: index + 1,
        text: line.trim().slice(0, 220),
        gates: matched.map(rule => rule.gate),
      });
    });
  }
  return hits;
}

function walk(dir, files) {
  if (!fssync.existsSync(dir)) return;
  for (const ent of fssync.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['.git', 'node_modules', 'dist', 'build', '.wrangler'].includes(ent.name)) continue;
      walk(full, files);
      continue;
    }
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!scanExts.has(ext)) continue;
    const stat = fssync.statSync(full);
    if (stat.size > maxFileBytes) continue;
    files.push(full);
  }
}

function isRelevantGateFile(rel) {
  return [
    /^scripts\/loops-24\//,
    /^scripts\/loops-hourly-runner\.mjs$/,
    /^scripts\/loops(\.cold-outreach)?\.tasks\.json$/,
    /^scripts\/github-loop-report\.mjs$/,
    /^scripts\/lib\/github-/,
    /^scripts\/lib\/cold-outreach\.mjs$/,
    /^scripts\/lib\/google-business-prospector\.mjs$/,
    /^docs\/loops/i,
    /^docs\/loopos/i,
    /^\.github\/workflows\/loops-hourly\.yml$/,
  ].some(pattern => pattern.test(rel));
}

async function readTaskRegistries() {
  const registryFiles = [
    path.join(repoRoot, 'scripts', 'loops.tasks.json'),
    path.join(repoRoot, 'scripts', 'loops.cold-outreach.tasks.json'),
  ];
  const tasks = [];
  const warnings = [];
  for (const file of registryFiles) {
    const rel = relative(file);
    try {
      const raw = JSON.parse(await fs.readFile(file, 'utf8'));
      for (const task of raw.tasks || []) {
        tasks.push({
          registry: rel,
          sourceId: task.source_id || 'unknown',
          taskType: task.task_type || 'unknown',
          lane: task.lane || 'unknown',
          manualGate: task.manual_gate || task.payload?.review_gate || 'none_read_only',
          expectedArtifact: task.expected_artifact || '',
        });
      }
    } catch (error) {
      warnings.push({ registry: rel, error: error.message });
    }
  }
  return {
    taskCount: tasks.length,
    tasks,
    warnings,
  };
}

function classifyHits(hits, tasks) {
  return gateRules.map(rule => {
    const ruleHits = hits.filter(hit => hit.gates.includes(rule.gate));
    const ruleTasks = tasks.filter(task => {
      const text = `${task.manualGate} ${task.sourceId} ${task.taskType} ${task.expectedArtifact}`.toLowerCase();
      return rule.match.test(text);
    });
    return {
      gate: rule.gate,
      aliases: rule.aliases,
      safeSubstitutes: rule.safeSubstitutes,
      hardStop: rule.hardStop,
      referenceCount: ruleHits.length,
      taskCount: ruleTasks.length,
      files: Array.from(new Set(ruleHits.map(hit => hit.file))).sort(),
      tasks: ruleTasks,
      samples: ruleHits.slice(0, 12),
    };
  });
}

async function prepareSharedMemoryCopy() {
  const generatedCopyPath = path.join(sharedMemoryDir, 'loopos-cross-agent-memory.md');
  let canonicalExists = false;
  let copied = false;
  try {
    await fs.access(canonicalMemoryPath);
    canonicalExists = true;
    await fs.copyFile(canonicalMemoryPath, generatedCopyPath);
    copied = true;
  } catch {
    await fs.writeFile(generatedCopyPath, renderFallbackMemory());
  }

  return {
    canonicalMemoryPath: relative(canonicalMemoryPath),
    canonicalExists,
    generatedCopyPath,
    copied,
    codexNotesDir: path.join(codexHome, 'memories', 'extensions', 'ad_hoc', 'notes'),
    claudeMemoryDir: process.env.LOOPS_CLAUDE_MEMORY_DIR
      || path.join(os.homedir(), 'Desktop', '天使.claude', 'memory'),
  };
}

function buildSummary(classified, registry, memoryStatus) {
  const totalReferences = classified.reduce((sum, gate) => sum + gate.referenceCount, 0);
  const gatedTaskKeys = new Set();
  for (const gate of classified) {
    for (const task of gate.tasks) gatedTaskKeys.add(`${task.registry}:${task.sourceId}`);
  }
  return {
    gateClasses: classified.length,
    totalReferences,
    totalRegistryTasks: registry.taskCount,
    gatedRegistryTasks: gatedTaskKeys.size,
    safeAutoFirst: true,
    sharedMemoryReady: Boolean(memoryStatus.generatedCopyPath),
    nextOwnerGate: 'only remaining hard stops after safe substitutes run',
  };
}

function renderMarkdown(data) {
  const lines = [
    '# LOOPS Manual Gate Adapter',
    '',
    `- generated_at: ${data.generatedAt}`,
    `- repo_root: ${data.repoRoot}`,
    `- state_dir: ${data.stateDir}`,
    `- gate_classes: ${data.summary.gateClasses}`,
    `- total_references: ${data.summary.totalReferences}`,
    `- total_registry_tasks: ${data.summary.totalRegistryTasks}`,
    `- safe_auto_first: ${data.summary.safeAutoFirst}`,
    '',
    '## Operating rule',
    '',
    'When a gate looks manual, LoopOS must first try safe automatic substitutes: local, reversible, draft-only, read-only, or report-only. Only the remaining hard stop should be escalated to Hsuehyi.',
    '',
    '## Gate matrix',
    '',
    '| Gate | References | Registry tasks | Safe substitutes | Hard stop |',
    '| --- | ---: | ---: | --- | --- |',
  ];

  for (const gate of data.gates) {
    lines.push(`| ${gate.gate} | ${gate.referenceCount} | ${gate.taskCount} | ${gate.safeSubstitutes.join('<br>')} | ${gate.hardStop} |`);
  }

  lines.push('', '## Files by gate', '');
  for (const gate of data.gates) {
    lines.push(`### ${gate.gate}`, '');
    if (!gate.files.length) {
      lines.push('- No direct references found.');
    } else {
      for (const file of gate.files.slice(0, 40)) lines.push(`- ${file}`);
      if (gate.files.length > 40) lines.push(`- ... ${gate.files.length - 40} more`);
    }
    if (gate.samples.length) {
      lines.push('', 'Sample references:');
      for (const sample of gate.samples.slice(0, 6)) {
        lines.push(`- ${sample.file}:${sample.line} ${sample.text}`);
      }
    }
    lines.push('');
  }

  lines.push(
    '## Cross-agent memory',
    '',
    `- canonical: ${data.memoryStatus.canonicalMemoryPath}`,
    `- generated_copy: ${data.memoryStatus.generatedCopyPath}`,
    `- codex_notes_dir: ${data.memoryStatus.codexNotesDir}`,
    `- claude_memory_dir: ${data.memoryStatus.claudeMemoryDir}`,
    '',
    'Run `scripts/loops-24/sync-agent-memory.ps1 --dry-run` after changing the canonical memory contract. Use `--write` only after explicit owner approval for memory writes.',
    '',
    '## Red lines',
    '',
    ...data.redLines.map(item => `- ${item.gate}: ${item.hardStop}`),
    ''
  );

  return lines.join('\n');
}

function renderFallbackMemory() {
  return [
    '# LoopOS cross-agent memory contract',
    '',
    'When LoopOS appears to need manual owner action, first look for safe automatic substitutes.',
    'Try local, reversible, draft-only, read-only, and report-only paths before asking Hsuehyi.',
    'Stop before secrets, production deploys, GitHub writes, outbound sends, payments, deletion, permission changes, and irreversible actions.',
    '',
  ].join('\n');
}

function relative(file) {
  return path.relative(repoRoot, file).replace(/\\/g, '/');
}
