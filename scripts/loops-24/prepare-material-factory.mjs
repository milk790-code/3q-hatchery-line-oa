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
const factoryDir = path.join(stateDir, 'material-factory');
const inboxDir = path.join(stateDir, 'material-ideas', 'inbox');
const args = parseArgs(process.argv.slice(2));
const now = new Date();
const stamp = toStamp(now);

await fs.mkdir(factoryDir, { recursive: true });
await fs.mkdir(inboxDir, { recursive: true });

const ideaSource = await resolveIdeaSource(args);
const toolHealth = inspectToolHealth();
const pendingIdeas = await listPendingIdeas();
const basePayload = {
  generatedAt: now.toISOString(),
  repoRoot,
  stateDir,
  inboxDir,
  reportPath: path.join(factoryDir, `${stamp}-material-factory.md`),
  jsonPath: path.join(factoryDir, `${stamp}-material-factory.json`),
  latestPath: path.join(factoryDir, 'latest.json'),
  status: ideaSource.text ? 'material-pack-ready' : 'waiting-for-idea',
  ideaSource,
  toolHealth,
  pendingIdeas,
  hardStops: [
    'Do not download copyrighted or private media unless the owner confirms rights and source URLs.',
    'Do not upload, publish, send, or post generated materials automatically.',
    'Do not run Jianying export, GPT-SoVITS inference, yt-dlp download, or browser automation without owner review.',
    'Do not write secrets, cookies, login tokens, or private customer data into material artifacts.',
  ],
};

let materialPack = null;
if (ideaSource.text) {
  materialPack = await buildMaterialPack(ideaSource, toolHealth);
}

const payload = {
  ...basePayload,
  materialPack,
  summary: summarize(basePayload, materialPack),
};
payload.statusFingerprint = hash(JSON.stringify({
  status: payload.status,
  ideaHash: ideaSource.text ? hash(ideaSource.text) : null,
  pendingIdeas: pendingIdeas.map(item => item.path),
  toolHealth: toolHealth.summary,
  materialPack: materialPack?.packFingerprint || null,
}));

await fs.writeFile(payload.jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.latestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
await fs.writeFile(payload.reportPath, `${renderMarkdown(payload)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  status: payload.status,
  reportPath: payload.reportPath,
  jsonPath: payload.jsonPath,
  packDir: materialPack?.packDir || null,
  summary: payload.summary,
}, null, 2));

function parseArgs(argv) {
  const parsed = { fromInbox: false, demo: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--idea') {
      parsed.idea = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--idea-file') {
      parsed.ideaFile = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--from-inbox') {
      parsed.fromInbox = true;
    } else if (arg === '--demo') {
      parsed.demo = true;
    } else if (arg === '--format') {
      parsed.format = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--duration') {
      parsed.duration = Number.parseInt(argv[index + 1] || '', 10);
      index += 1;
    }
  }
  return parsed;
}

async function resolveIdeaSource(parsed) {
  const envIdea = process.env.LOOPS_MATERIAL_IDEA || '';
  if (parsed.idea?.trim()) {
    return sourcePayload('cli', parsed.idea, null, parsed);
  }
  if (parsed.ideaFile) {
    const filePath = path.resolve(parsed.ideaFile);
    return sourcePayload('file', await fs.readFile(filePath, 'utf8'), filePath, parsed);
  }
  if (envIdea.trim()) {
    return sourcePayload('env', envIdea, null, parsed);
  }
  if (parsed.fromInbox) {
    const pending = await listPendingIdeas();
    if (pending.length) {
      const newest = pending[0];
      return sourcePayload('inbox', await fs.readFile(newest.path, 'utf8'), newest.path, parsed);
    }
  }
  if (parsed.demo) {
    return sourcePayload(
      'demo',
      'Make a 45 second vertical video that explains how 3Q Hatchery turns a local shop idea into a LINE intake page and first customer lead.',
      null,
      parsed
    );
  }
  return sourcePayload('none', '', null, parsed);
}

function sourcePayload(source, text, filePath, parsed) {
  const clean = normalizeWhitespace(text);
  return {
    source,
    path: filePath,
    text: clean,
    textHash: clean ? hash(clean) : null,
    format: parsed.format || 'vertical-9x16',
    durationSeconds: Number.isFinite(parsed.duration) && parsed.duration > 0 ? parsed.duration : 45,
  };
}

async function listPendingIdeas() {
  try {
    const entries = await fs.readdir(inboxDir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (!entry.isFile() || !/\.(txt|md)$/i.test(entry.name)) continue;
      const filePath = path.join(inboxDir, entry.name);
      const stat = await fs.stat(filePath);
      files.push({
        path: filePath,
        name: entry.name,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
    }
    return files.sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt));
  } catch {
    return [];
  }
}

function inspectToolHealth() {
  const home = os.homedir();
  const googleDriveName = `Google \u96f2\u7aef\u786c\u789f`;
  const ytDlpZip = process.env.LOOPS_YT_DLP_ZIP || path.join(home, 'Documents', 'yt-dlp-master.zip');
  const jianyingSkillZip = process.env.LOOPS_JIANYING_SKILL_ZIP || path.join(home, googleDriveName, 'jianying-editor-skill-main.zip');
  const jianyingSkillRootCandidates = [
    process.env.JY_SKILL_ROOT,
    path.join(repoRoot, 'skills', 'jianying-editor'),
    path.join(codexHome, 'skills', 'jianying-editor'),
    path.join(home, '.codex', 'skills', 'jianying-editor'),
  ].filter(Boolean);
  const gptSovitsRootCandidates = [
    process.env.GPT_SOVITS_ROOT,
    process.env.GPT_SOVITS_HOME,
    path.join(home, 'GPT-SoVITS'),
    path.join(home, 'Documents', 'GPT-SoVITS'),
    'C:\\GPT-SoVITS',
  ].filter(Boolean);
  const tools = {
    python: findCommand('python'),
    node: findCommand('node'),
    ffmpeg: findCommand('ffmpeg'),
    ytDlpCommand: findCommand('yt-dlp'),
    ytDlpZip: fileStatus(ytDlpZip),
    jianyingSkillZip: fileStatus(jianyingSkillZip),
    jianyingSkillRoot: firstExistingRoot(jianyingSkillRootCandidates, ['SKILL.md', path.join('scripts', 'jy_wrapper.py')]),
    gptSovitsRoot: firstExistingRoot(gptSovitsRootCandidates, []),
  };
  const missing = [];
  if (!tools.ytDlpCommand.present && !tools.ytDlpZip.exists) missing.push('yt-dlp');
  if (!tools.ffmpeg.present) missing.push('ffmpeg');
  if (!tools.jianyingSkillRoot.exists && !tools.jianyingSkillZip.exists) missing.push('jianying-editor-skill');
  if (!tools.gptSovitsRoot.exists) missing.push('gpt-sovits-root');
  return {
    tools,
    summary: {
      materialPlanningReady: true,
      localAssetSelectionReady: true,
      ytDlpSourceAvailable: tools.ytDlpCommand.present || tools.ytDlpZip.exists,
      jianyingSkillAvailable: tools.jianyingSkillRoot.exists || tools.jianyingSkillZip.exists,
      gptSovitsAvailable: tools.gptSovitsRoot.exists,
      ffmpegAvailable: tools.ffmpeg.present,
      missing,
      missingCount: missing.length,
    },
  };
}

async function buildMaterialPack(idea, toolHealth) {
  const slug = slugify(idea.text).slice(0, 48) || 'idea';
  const packDir = path.join(factoryDir, `${stamp}-${slug}`);
  await fs.mkdir(packDir, { recursive: true });
  const analysis = analyzeIdea(idea.text, idea.durationSeconds);
  const assets = await selectLocalAssets(analysis);
  const storyboard = buildStoryboard(analysis, assets, idea);
  const voiceover = buildVoiceover(analysis, storyboard);
  const jianyingPlan = buildJianyingPlan(analysis, storyboard, assets, voiceover, toolHealth);
  const ytDlpPlan = buildYtDlpPlan(analysis, packDir);
  const paths = {
    brief: path.join(packDir, 'brief.md'),
    script: path.join(packDir, 'script.md'),
    storyboard: path.join(packDir, 'storyboard.json'),
    voiceover: path.join(packDir, 'voiceover-gpt-sovits.txt'),
    jianyingPlan: path.join(packDir, 'jianying-assembly-plan.json'),
    jianyingScaffold: path.join(packDir, 'jianying-draft-scaffold.py'),
    ytDlpUrls: path.join(packDir, 'yt-dlp-broll-urls.txt'),
    ownerCommands: path.join(packDir, 'OWNER_RUN_COMMANDS.ps1'),
    manifest: path.join(packDir, 'manifest.json'),
  };

  await fs.writeFile(paths.brief, renderBrief(analysis, assets, idea, toolHealth), 'utf8');
  await fs.writeFile(paths.script, renderScript(analysis, storyboard, voiceover), 'utf8');
  await fs.writeFile(paths.storyboard, `${JSON.stringify(storyboard, null, 2)}\n`, 'utf8');
  await fs.writeFile(paths.voiceover, `${voiceover.fullText}\n`, 'utf8');
  await fs.writeFile(paths.jianyingPlan, `${JSON.stringify(jianyingPlan, null, 2)}\n`, 'utf8');
  await fs.writeFile(paths.jianyingScaffold, renderJianyingScaffold(jianyingPlan), 'utf8');
  await fs.writeFile(paths.ytDlpUrls, renderYtDlpUrls(ytDlpPlan), 'utf8');
  await fs.writeFile(paths.ownerCommands, renderOwnerCommands(paths, toolHealth), 'utf8');

  const manifest = {
    generatedAt: now.toISOString(),
    idea,
    analysis,
    assets,
    storyboardPath: paths.storyboard,
    voiceoverPath: paths.voiceover,
    jianyingPlanPath: paths.jianyingPlan,
    jianyingScaffoldPath: paths.jianyingScaffold,
    ytDlpUrlsPath: paths.ytDlpUrls,
    ownerCommandsPath: paths.ownerCommands,
    outputs: paths,
    toolSummary: toolHealth.summary,
  };
  manifest.packFingerprint = hash(JSON.stringify({
    idea: idea.text,
    storyboard,
    assets,
    toolSummary: toolHealth.summary,
  }));
  await fs.writeFile(paths.manifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    packDir,
    packFingerprint: manifest.packFingerprint,
    title: analysis.title,
    format: idea.format,
    durationSeconds: idea.durationSeconds,
    files: paths,
    selectedLocalAssetCount: assets.length,
    storyboardSceneCount: storyboard.scenes.length,
    ownerCommandsPath: paths.ownerCommands,
    nextOwnerActions: nextOwnerActions(toolHealth),
  };
}

function analyzeIdea(text, durationSeconds) {
  const sentences = splitSentences(text);
  const keywords = extractKeywords(text);
  const title = titleFromText(text, keywords);
  const promise = sentences[0] || text;
  const pain = detectPain(text);
  const audience = detectAudience(text);
  const cta = /line|LINE/i.test(text)
    ? 'DM or tap LINE to get the first draft.'
    : 'Send one idea and get the first material pack.';
  return {
    originalIdea: text,
    title,
    keywords,
    audience,
    pain,
    promise,
    angle: chooseAngle(text),
    durationSeconds,
    hook: buildHook(text, keywords),
    cta,
    tone: chooseTone(text),
    deliverables: [
      'short-video script',
      'storyboard',
      'GPT-SoVITS voiceover text',
      'Jianying assembly plan',
      'yt-dlp B-roll URL intake list',
    ],
  };
}

function buildStoryboard(analysis, assets, idea) {
  const durationSeconds = idea.durationSeconds;
  const sceneDurations = splitDurations(durationSeconds, 6);
  const sceneLabels = ['hook', 'problem', 'mechanism', 'proof', 'offer', 'cta'];
  const lines = [
    analysis.hook,
    `The pain: ${analysis.pain}.`,
    `The system: turn one idea into script, voice, scenes, and edit plan.`,
    `Proof: show the local asset pack and timeline structure.`,
    `Offer: ${analysis.promise}.`,
    analysis.cta,
  ];
  const scenes = sceneLabels.map((label, index) => ({
    id: `scene_${String(index + 1).padStart(2, '0')}`,
    label,
    startSecond: sceneDurations[index].start,
    durationSecond: sceneDurations[index].duration,
    voiceover: lines[index],
    visual: visualForScene(label, analysis, assets[index % Math.max(assets.length, 1)]),
    localAsset: assets[index % Math.max(assets.length, 1)] || null,
    textOverlay: overlayForScene(label, analysis),
    motion: motionForScene(label),
  }));
  return {
    format: idea.format,
    targetResolution: resolutionForFormat(idea.format),
    fps: 30,
    scenes,
  };
}

function buildVoiceover(analysis, storyboard) {
  const lines = storyboard.scenes.map(scene => scene.voiceover);
  return {
    speakerProfile: 'GPT-SoVITS local voice; use a warm, direct founder/operator tone.',
    pace: 'medium-fast',
    emotion: analysis.tone,
    lines,
    fullText: lines.join('\n'),
  };
}

function buildJianyingPlan(analysis, storyboard, assets, voiceover, toolHealth) {
  return {
    projectName: safeName(`LOOPS_${analysis.title}`),
    format: storyboard.format,
    resolution: storyboard.targetResolution,
    fps: storyboard.fps,
    timeline: storyboard.scenes.map(scene => ({
      sceneId: scene.id,
      startSecond: scene.startSecond,
      durationSecond: scene.durationSecond,
      media: scene.localAsset?.path || '<replace with generated or downloaded media>',
      voiceoverText: scene.voiceover,
      textOverlay: scene.textOverlay,
      motion: scene.motion,
    })),
    audio: {
      voiceoverTextPath: 'voiceover-gpt-sovits.txt',
      generatedVoiceoverPath: '<owner-generated GPT-SoVITS wav/mp3>',
      bgm: 'choose from Jianying cloud music or local brand-safe music after owner review',
    },
    requiredOwnerTools: {
      jianyingSkillAvailable: toolHealth.summary.jianyingSkillAvailable,
      gptSovitsAvailable: toolHealth.summary.gptSovitsAvailable,
      ffmpegAvailable: toolHealth.summary.ffmpegAvailable,
    },
  };
}

function buildYtDlpPlan(analysis, packDir) {
  return {
    purpose: 'Optional B-roll intake from owner-approved public/licensed URLs only.',
    packDir,
    suggestedQueries: [
      `${analysis.keywords.slice(0, 3).join(' ')} shop process b-roll`,
      `${analysis.keywords.slice(0, 3).join(' ')} product closeup`,
      'local business behind the scenes vertical video',
    ],
  };
}

async function selectLocalAssets(analysis) {
  const assetDirs = [
    path.join(repoRoot, 'assets', 'exports'),
    path.join(repoRoot, 'assets', 'photography', 'ai'),
    path.join(repoRoot, 'assets', 'photography'),
  ];
  const files = [];
  for (const dir of assetDirs) {
    files.push(...await listMediaFiles(dir));
  }
  return files
    .map(file => ({ ...file, score: scoreAsset(file, analysis.keywords) }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 12);
}

async function listMediaFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await listMediaFiles(fullPath));
      } else if (/\.(png|jpe?g|webp|svg|mp4|mov)$/i.test(entry.name)) {
        const stat = await fs.stat(fullPath);
        files.push({
          path: fullPath,
          relativePath: path.relative(repoRoot, fullPath),
          name: entry.name,
          size: stat.size,
        });
      }
    }
    return files;
  } catch {
    return [];
  }
}

function scoreAsset(file, keywords) {
  const haystack = `${file.relativePath} ${file.name}`.toLowerCase();
  let score = 0;
  for (const keyword of keywords) {
    if (keyword.length >= 2 && haystack.includes(keyword.toLowerCase())) score += 8;
  }
  if (/3q|line|welcome|richmenu|tiktok|ig|feed|carousel/i.test(haystack)) score += 4;
  if (/\.(png|jpg|jpeg|webp)$/i.test(file.name)) score += 2;
  if (/1080|1920|1040|1350/i.test(file.name)) score += 1;
  return score;
}

function renderBrief(analysis, assets, idea, toolHealth) {
  const lines = [
    '# LOOPS Material Brief',
    '',
    `- title: ${analysis.title}`,
    `- idea_source: ${idea.source}`,
    `- format: ${idea.format}`,
    `- duration_seconds: ${idea.durationSeconds}`,
    `- audience: ${analysis.audience}`,
    `- angle: ${analysis.angle}`,
    `- tone: ${analysis.tone}`,
    '',
    '## Core',
    '',
    `- hook: ${analysis.hook}`,
    `- pain: ${analysis.pain}`,
    `- promise: ${analysis.promise}`,
    `- cta: ${analysis.cta}`,
    '',
    '## Tool Health',
    '',
    `- yt_dlp_source_available: ${toolHealth.summary.ytDlpSourceAvailable}`,
    `- jianying_skill_available: ${toolHealth.summary.jianyingSkillAvailable}`,
    `- gpt_sovits_available: ${toolHealth.summary.gptSovitsAvailable}`,
    `- ffmpeg_available: ${toolHealth.summary.ffmpegAvailable}`,
    `- missing: ${toolHealth.summary.missing.length ? toolHealth.summary.missing.join(', ') : '(none)'}`,
    '',
    '## Selected Local Assets',
    '',
  ];
  if (assets.length) {
    for (const asset of assets) lines.push(`- ${asset.relativePath} score=${asset.score}`);
  } else {
    lines.push('- No local media assets found.');
  }
  lines.push('', '## Rights And Safety', '');
  lines.push('- Use local brand assets first.');
  lines.push('- Use yt-dlp only for owner-approved public/licensed URLs.');
  lines.push('- Keep export/posting manual.');
  return `${lines.join('\n')}\n`;
}

function renderScript(analysis, storyboard, voiceover) {
  const lines = [
    '# Short Video Script',
    '',
    `Title: ${analysis.title}`,
    `Tone: ${voiceover.emotion}`,
    '',
  ];
  for (const scene of storyboard.scenes) {
    lines.push(`## ${scene.id} ${scene.label}`);
    lines.push(`- time: ${scene.startSecond}s +${scene.durationSecond}s`);
    lines.push(`- voiceover: ${scene.voiceover}`);
    lines.push(`- visual: ${scene.visual}`);
    lines.push(`- overlay: ${scene.textOverlay}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function renderJianyingScaffold(plan) {
  return `# Generated by LoopOS material factory.
# Owner review required before running. This script assumes JY_SKILL_ROOT points
# to an extracted jianying-editor skill that contains scripts/jy_wrapper.py.
import json
import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
skill_root = os.getenv("JY_SKILL_ROOT", "").strip()
if not skill_root:
    raise SystemExit("Set JY_SKILL_ROOT to the extracted jianying-editor skill root before running.")
sys.path.insert(0, os.path.join(skill_root, "scripts"))

from jy_wrapper import JyProject  # noqa: E402

plan_path = os.path.join(current_dir, "jianying-assembly-plan.json")
with open(plan_path, "r", encoding="utf-8") as handle:
    plan = json.load(handle)

project = JyProject(plan["projectName"])
for item in plan["timeline"]:
    media = item["media"]
    if os.path.exists(media):
        project.add_media_safe(media, f'{item["startSecond"]}s')
    project.add_text_simple(
        item["textOverlay"],
        start_time=f'{item["startSecond"]}s',
        duration=f'{item["durationSecond"]}s',
        anim_in="typewriter",
    )
project.save()
print(json.dumps({"ok": True, "project": plan["projectName"]}, ensure_ascii=False))
`;
}

function renderYtDlpUrls(plan) {
  const lines = [
    '# Owner-approved public/licensed B-roll URLs only.',
    '# Add one URL per line. Empty lines and comments are ignored.',
    '# Suggested search directions:',
    ...plan.suggestedQueries.map(query => `# - ${query}`),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderOwnerCommands(paths, toolHealth) {
  const lines = [
    '# Owner-run commands. Review paths and rights before executing.',
    '$ErrorActionPreference = "Stop"',
    `$PackDir = "${path.dirname(paths.manifest)}"`,
    '',
    '# 1. Optional: inspect generated plan.',
    'notepad (Join-Path $PackDir "brief.md")',
    'notepad (Join-Path $PackDir "script.md")',
    '',
    '# 2. Optional: generate/download B-roll only after adding owner-approved URLs.',
    '# yt-dlp -a (Join-Path $PackDir "yt-dlp-broll-urls.txt") -P (Join-Path $PackDir "source-media") -f "bv*+ba/b"',
    '',
    '# 3. Optional: generate voiceover with your local GPT-SoVITS workflow.',
    '# Set GPT_SOVITS_ROOT first, then use voiceover-gpt-sovits.txt as input.',
    '',
    '# 4. Optional: create a Jianying draft after extracting the skill and setting JY_SKILL_ROOT.',
    '# python (Join-Path $PackDir "jianying-draft-scaffold.py")',
    '',
    '# Tool availability at generation time:',
    `# yt_dlp_source_available=${toolHealth.summary.ytDlpSourceAvailable}`,
    `# ffmpeg_available=${toolHealth.summary.ffmpegAvailable}`,
    `# jianying_skill_available=${toolHealth.summary.jianyingSkillAvailable}`,
    `# gpt_sovits_available=${toolHealth.summary.gptSovitsAvailable}`,
  ];
  return `${lines.join('\n')}\n`;
}

function renderMarkdown(payload) {
  const lines = [
    '# LOOPS Material Factory',
    '',
    `- generated_at: ${payload.generatedAt}`,
    `- status: ${payload.status}`,
    `- inbox: ${payload.inboxDir}`,
    `- pending_ideas: ${payload.pendingIdeas.length}`,
    `- report: ${payload.reportPath}`,
    '',
    '## Summary',
    '',
    `- idea_present: ${payload.summary.ideaPresent}`,
    `- pack_ready: ${payload.summary.packReady}`,
    `- pack_dir: ${payload.materialPack?.packDir || '(none)'}`,
    `- selected_local_assets: ${payload.materialPack?.selectedLocalAssetCount ?? 0}`,
    `- storyboard_scenes: ${payload.materialPack?.storyboardSceneCount ?? 0}`,
    `- missing_tools: ${payload.summary.missingTools.length ? payload.summary.missingTools.join(', ') : '(none)'}`,
    '',
  ];
  if (!payload.ideaSource.text) {
    lines.push('## How To Use', '');
    lines.push('Drop a `.txt` or `.md` idea file into the inbox, then rerun safe-local LoopOS.');
    lines.push('');
    lines.push('```powershell');
    lines.push(`notepad "${path.join(payload.inboxDir, 'new-idea.txt')}"`);
    lines.push('powershell -ExecutionPolicy Bypass -File .\\scripts\\loops-24\\run.ps1 -OnlySafeLocal');
    lines.push('```');
    lines.push('');
  } else {
    lines.push('## Material Pack', '');
    lines.push(`- title: ${payload.materialPack.title}`);
    lines.push(`- manifest: ${payload.materialPack.files.manifest}`);
    lines.push(`- brief: ${payload.materialPack.files.brief}`);
    lines.push(`- script: ${payload.materialPack.files.script}`);
    lines.push(`- storyboard: ${payload.materialPack.files.storyboard}`);
    lines.push(`- voiceover: ${payload.materialPack.files.voiceover}`);
    lines.push(`- jianying_plan: ${payload.materialPack.files.jianyingPlan}`);
    lines.push(`- owner_commands: ${payload.materialPack.ownerCommandsPath}`);
    lines.push('');
    lines.push('## Next Owner Actions', '');
    for (const action of payload.materialPack.nextOwnerActions) lines.push(`- ${action}`);
    lines.push('');
  }
  lines.push('## Hard Stops', '');
  for (const stop of payload.hardStops) lines.push(`- ${stop}`);
  return lines.join('\n');
}

function summarize(base, pack) {
  return {
    ideaPresent: Boolean(base.ideaSource.text),
    packReady: Boolean(pack),
    status: base.status,
    pendingIdeaCount: base.pendingIdeas.length,
    missingTools: base.toolHealth.summary.missing,
    missingToolCount: base.toolHealth.summary.missingCount,
    ytDlpSourceAvailable: base.toolHealth.summary.ytDlpSourceAvailable,
    jianyingSkillAvailable: base.toolHealth.summary.jianyingSkillAvailable,
    gptSovitsAvailable: base.toolHealth.summary.gptSovitsAvailable,
    ffmpegAvailable: base.toolHealth.summary.ffmpegAvailable,
    packDir: pack?.packDir || null,
    selectedLocalAssetCount: pack?.selectedLocalAssetCount || 0,
    storyboardSceneCount: pack?.storyboardSceneCount || 0,
  };
}

function nextOwnerActions(toolHealth) {
  const actions = [];
  if (!toolHealth.summary.ytDlpSourceAvailable) actions.push('Install or extract yt-dlp before owner-approved B-roll downloads.');
  if (!toolHealth.summary.ffmpegAvailable) actions.push('Install ffmpeg before reliable audio/video conversion.');
  if (!toolHealth.summary.gptSovitsAvailable) actions.push('Set GPT_SOVITS_ROOT to your local GPT-SoVITS folder before voice inference.');
  if (!toolHealth.summary.jianyingSkillAvailable) actions.push('Extract jianying-editor-skill-main.zip and set JY_SKILL_ROOT before draft assembly.');
  if (!actions.length) actions.push('Review OWNER_RUN_COMMANDS.ps1 and run only the stages you approve.');
  return actions;
}

function splitSentences(text) {
  return normalizeWhitespace(text)
    .split(/(?<=[.!?。！？])\s+|[;\n]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function extractKeywords(text) {
  const words = normalizeWhitespace(text)
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map(item => item.trim())
    .filter(item => item.length >= 2);
  const stop = new Set(['this', 'that', 'with', 'into', 'from', 'make', 'video', '素材', '想法', '文字']);
  const counts = new Map();
  for (const word of words) {
    const lower = word.toLowerCase();
    if (stop.has(lower)) continue;
    counts.set(lower, (counts.get(lower) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([word]) => word).slice(0, 10);
}

function titleFromText(text, keywords) {
  const first = splitSentences(text)[0] || text;
  const clean = first.replace(/[^\p{L}\p{N}\s-]/gu, '').trim();
  if (clean.length <= 36 && clean.length >= 4) return clean;
  return keywords.length ? keywords.slice(0, 5).join(' ') : 'Idea Material Pack';
}

function buildHook(text, keywords) {
  if (/客戶|成交|lead|sale|營收|revenue/i.test(text)) return 'One idea should become a lead machine, not another note.';
  if (/教學|tutorial|demo|操作/i.test(text)) return 'Show the exact workflow in under one minute.';
  return `Turn "${keywords.slice(0, 3).join(' ') || 'one idea'}" into usable content before it cools down.`;
}

function detectPain(text) {
  if (/剪|剪輯|capcut|jianying|素材/i.test(text)) return 'ideas die between writing, sourcing, voice, and editing';
  if (/店|商家|lead|客戶/i.test(text)) return 'shops need a sellable page before they care about automation';
  return 'the idea is not packaged into a visible, reusable asset';
}

function detectAudience(text) {
  if (/店|餐|咖啡|商家|local shop/i.test(text)) return 'local shop owners';
  if (/投資|investor|募資/i.test(text)) return 'investors and strategic partners';
  if (/教學|tutorial|demo/i.test(text)) return 'operators who need a clear demo';
  return 'prospects who need to understand the offer quickly';
}

function chooseAngle(text) {
  if (/便宜|快速|fast|一天|today/i.test(text)) return 'speed-to-output';
  if (/高級|品牌|質感|premium/i.test(text)) return 'premium execution';
  if (/自動|loop|workflow|pipeline/i.test(text)) return 'automation leverage';
  return 'clear before-after transformation';
}

function chooseTone(text) {
  if (/高級|premium|投資|investor/i.test(text)) return 'calm, credible, precise';
  if (/爆|viral|短影音|tiktok/i.test(text)) return 'direct, fast, energetic';
  return 'warm, pragmatic, operator-like';
}

function visualForScene(label, analysis, asset) {
  const assetText = asset ? `use local asset ${asset.relativePath}` : 'use generated or owner-approved media';
  if (label === 'hook') return `fast visual proof; ${assetText}`;
  if (label === 'mechanism') return 'show pipeline blocks: idea, script, voice, footage, edit timeline';
  if (label === 'proof') return 'show generated files, storyboard, and timeline plan';
  return assetText;
}

function overlayForScene(label, analysis) {
  const map = {
    hook: analysis.title,
    problem: 'The bottleneck is not ideas. It is packaging.',
    mechanism: 'Idea -> Script -> Voice -> Shots -> Draft',
    proof: 'Local artifacts. Manual approval. No unsafe posting.',
    offer: 'First material pack before full production.',
    cta: 'Send the idea. Review the pack. Then produce.',
  };
  return map[label] || analysis.title;
}

function motionForScene(label) {
  const map = {
    hook: 'quick push-in, 0.95x to 1.08x',
    problem: 'slow pan over messy notes',
    mechanism: 'left-to-right block reveal',
    proof: 'screen capture zooms on generated files',
    offer: 'clean product-card reveal',
    cta: 'hold frame with clear CTA',
  };
  return map[label] || 'subtle motion';
}

function splitDurations(total, count) {
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  let cursor = 0;
  return Array.from({ length: count }, (_, index) => {
    const duration = base + (index < remainder ? 1 : 0);
    const segment = { start: cursor, duration };
    cursor += duration;
    return segment;
  });
}

function resolutionForFormat(format) {
  const normalized = String(format || '').toLowerCase();
  if (/^(square|1x1|1:1)$/.test(normalized)) return { width: 1080, height: 1080 };
  if (/^(horizontal|landscape|16x9|16:9)$/.test(normalized)) return { width: 1920, height: 1080 };
  return { width: 1080, height: 1920 };
}

function safeName(value) {
  return String(value || 'LoopOS Material Pack').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function findCommand(command) {
  const result = spawnSync('where.exe', [command], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 8_000,
  });
  return {
    present: result.status === 0,
    path: result.status === 0 ? result.stdout.split(/\r?\n/).map(item => item.trim()).filter(Boolean)[0] || null : null,
  };
}

function fileStatus(filePath) {
  return {
    path: filePath,
    exists: fssync.existsSync(filePath),
  };
}

function firstExistingRoot(candidates, requiredChildren) {
  for (const candidate of candidates) {
    if (!candidate || !fssync.existsSync(candidate)) continue;
    const ok = requiredChildren.every(child => fssync.existsSync(path.join(candidate, child)));
    if (ok) return { exists: true, path: candidate };
  }
  return { exists: false, path: candidates[0] || null };
}

function toStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
}
