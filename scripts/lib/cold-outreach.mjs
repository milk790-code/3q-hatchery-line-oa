import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const BLOCKED_STATUSES = new Set([
  'sent',
  'replied',
  'booked',
  'won',
  'lost',
  'skip',
  'do_not_contact',
]);

const DEFAULT_CAMPAIGN = {
  id: '3q-cold-outreach',
  brand_name: '3Q Hatchery',
  sender_name: '3Q Hatchery',
  offer:
    '我可以先免費幫你整理一頁「陌生客看得懂、願意詢問」的品牌方向稿，包含第一屏賣點、LINE/IG/Google 承接、詢價或預約入口。',
  cta: '如果你願意，我先做 1 頁方向給你看；適合再聊，不適合就當作多一個外部視角。',
  review_gate: 'manual_send_only',
};

export async function runColdOutreachBatch({
  projectRoot,
  stateDir,
  task = {},
  now = new Date(),
  dryRun = false,
} = {}) {
  const plan = await planColdOutreachBatch({ projectRoot, stateDir, task, now });

  if (!plan.configFound) {
    return {
      ok: false,
      retryable: false,
      error: `cold outreach config not found: ${plan.configPath}`,
    };
  }

  if (plan.records.length === 0) {
    return {
      ok: true,
      generated_count: 0,
      review_gate: plan.campaign.review_gate,
      summary: plan.emptyReason || 'no eligible cold outreach prospects',
      config_path: relative(projectRoot, plan.configPath),
    };
  }

  if (!dryRun) {
    await fs.mkdir(plan.outreachDir, { recursive: true });
    await fs.writeFile(plan.markdownPath, renderMarkdown(plan), 'utf8');
    await fs.writeFile(plan.jsonPath, `${JSON.stringify(plan.records, null, 2)}\n`, 'utf8');
    await writeLedger(plan);
  }

  return {
    ok: true,
    generated_count: plan.records.length,
    review_gate: plan.campaign.review_gate,
    summary: `${dryRun ? 'would create' : 'created'} ${plan.records.length} cold outreach drafts`,
    batch_id: plan.batchId,
    config_path: relative(projectRoot, plan.configPath),
    artifact_paths: dryRun
      ? {
          markdown: relative(projectRoot, plan.markdownPath),
          json: relative(projectRoot, plan.jsonPath),
        }
      : {
          markdown: plan.markdownPath,
          json: plan.jsonPath,
        },
    prospects: plan.records.map((record) => ({
      id: record.prospect.id,
      name: record.prospect.name,
      channel: record.prospect.channel,
      source_url: record.prospect.source_url,
      contact_hint: record.prospect.contact_hint,
    })),
  };
}

export async function previewColdOutreachCandidate({
  projectRoot,
  stateDir,
  now = new Date(),
  payload = {},
} = {}) {
  const plan = await planColdOutreachBatch({
    projectRoot,
    stateDir,
    task: { payload },
    now,
  });

  if (!plan.configFound) {
    return {
      type: 'cold_outreach',
      id: 'cold-outreach-config-missing',
      title: 'Create cold outreach seed config',
      value: 0.82,
      urgency: 0.72,
      loopability: 0.9,
      freshness: 0.8,
      risk: 0.1,
      action:
        'Create scripts/outreach.prospects.json with target segments, public sources, and manual-send review rules before the outreach loop runs.',
      evidence: { expectedConfig: relative(projectRoot, plan.configPath) },
    };
  }

  if (plan.records.length === 0) {
    const hasProspects = Array.isArray(plan.prospects) && plan.prospects.length > 0;
    return {
      type: 'cold_outreach',
      id: hasProspects ? 'cold-outreach-cooldown-active' : 'cold-outreach-needs-prospects',
      title: hasProspects ? 'Review drafted outreach batch' : 'Add fresh cold outreach prospects',
      value: hasProspects ? 0.46 : 0.78,
      urgency: hasProspects ? 0.25 : 0.68,
      loopability: hasProspects ? 0.62 : 0.86,
      freshness: hasProspects ? 0.35 : 0.7,
      risk: 0.1,
      action: hasProspects
        ? 'Configured prospects are in cooldown; review the generated drafts before adding or sending anything.'
        : plan.emptyReason || 'Add new public-source prospects to scripts/outreach.prospects.json.',
      evidence: {
        config: relative(projectRoot, plan.configPath),
        reviewGate: plan.campaign.review_gate,
        configuredProspects: Array.isArray(plan.prospects) ? plan.prospects.length : 0,
        draftedProspects: Object.keys(plan.ledger?.prospects || {}).length,
      },
    };
  }

  return {
    type: 'cold_outreach',
    id: `cold-outreach-batch-${plan.batchId}`,
    title: `Draft ${plan.records.length} cold outreach first touches`,
    value: 0.92,
    urgency: 0.76,
    loopability: 0.9,
    freshness: 0.85,
    risk: 0.18,
    action:
      'Review the generated first-touch drafts, then manually send only after owner confirmation. Do not bulk-send from LOOPS.',
    evidence: {
      config: relative(projectRoot, plan.configPath),
      wouldWrite: {
        markdown: relative(projectRoot, plan.markdownPath),
        json: relative(projectRoot, plan.jsonPath),
      },
      reviewGate: plan.campaign.review_gate,
      prospects: plan.records.map((record) => ({
        id: record.prospect.id,
        name: record.prospect.name,
        channel: record.prospect.channel,
        source_url: record.prospect.source_url,
      })),
    },
  };
}

async function planColdOutreachBatch({ projectRoot, stateDir, task = {}, now = new Date() }) {
  const payload = task.payload || {};
  const configPath = resolveProjectPath(
    projectRoot,
    payload.config_path || process.env.LOOPS_OUTREACH_CONFIG || path.join('scripts', 'outreach.prospects.json')
  );
  const outreachDir = path.resolve(stateDir || path.join(projectRoot, '.loops'), 'outreach');
  const config = await readJson(configPath, null);
  const campaign = { ...DEFAULT_CAMPAIGN, ...(config?.campaign || {}) };
  const batchSize = positiveInt(payload.batch_size ?? config?.batch_size ?? process.env.LOOPS_OUTREACH_BATCH_SIZE, 5);
  const cooldownDays = positiveInt(payload.cooldown_days ?? config?.cooldown_days, 14);
  const ledgerPath = path.join(outreachDir, 'ledger.json');
  const ledger = await readJson(ledgerPath, { prospects: {} });
  const segmentsById = normalizeSegments(config?.segments || []);
  const prospects = (Array.isArray(config?.prospects) ? config.prospects : [])
    .map((prospect) => normalizeProspect(prospect, segmentsById, now))
    .filter(Boolean);
  const eligible = selectEligibleProspects(prospects, ledger, batchSize, cooldownDays, now);
  const records = eligible.map((prospect, index) => buildRecord(prospect, campaign, index + 1, now));
  const batchSeed = records.map((record) => record.prospect.id).join('|') || randomUUID();
  const batchId = `${stamp(now)}-${hash(batchSeed).slice(0, 8)}`;
  const markdownPath = path.join(outreachDir, `${batchId}-drafts.md`);
  const jsonPath = path.join(outreachDir, `${batchId}-drafts.json`);

  return {
    projectRoot,
    stateDir,
    configFound: Boolean(config),
    configPath,
    config,
    campaign,
    batchSize,
    cooldownDays,
    outreachDir,
    ledger,
    ledgerPath,
    prospects,
    records,
    batchId,
    markdownPath,
    jsonPath,
    now,
    emptyReason: prospects.length === 0
      ? 'No prospects are configured yet.'
      : 'All configured prospects are inside cooldown or marked as sent/replied/skip.',
  };
}

function normalizeSegments(segments) {
  const out = {};
  for (const item of segments) {
    if (!item || !item.id) continue;
    out[item.id] = item;
  }
  return out;
}

function normalizeProspect(input, segmentsById, now) {
  if (!input || !input.name) return null;
  const id = input.id || slug(input.name);
  const segment = segmentsById[input.segment] || {};
  const status = String(input.status || 'new').toLowerCase();
  const discoveredAt = input.discovered_at || now.toISOString().slice(0, 10);
  const sourceUrl = input.source_url || input.google_maps_url || input.website_url || '';
  const contactHint = input.contact_hint || buildContactHint(input);

  return {
    id,
    name: input.name,
    segment_id: input.segment || segment.id || 'general',
    segment_label: segment.label || input.segment || 'general',
    channel: input.channel || inferChannel(input),
    source_url: sourceUrl,
    contact_hint: contactHint,
    public_signal: input.public_signal || '',
    fit_reason: input.fit_reason || '',
    outreach_angle: input.outreach_angle || segment.outreach_angle || '',
    status,
    discovered_at: discoveredAt,
    fit_score: numberOr(input.fit_score, numberOr(segment.fit_score, 0.7)),
    priority: numberOr(input.priority, numberOr(segment.priority, 0.6)),
    google_place_id: input.google_place_id || '',
    google_maps_url: input.google_maps_url || '',
    address: input.address || input.formatted_address || '',
    website_url: input.website_url || '',
    phone: input.phone || '',
    rating: numberOr(input.rating, null),
    user_rating_count: numberOr(input.user_rating_count, null),
    business_status: input.business_status || '',
    raw: input,
  };
}

function buildContactHint(input) {
  const parts = [];
  if (input.phone) parts.push(`電話 ${input.phone}`);
  if (input.website_url) parts.push(`官網 ${input.website_url}`);
  if (input.google_maps_url) parts.push('Google Maps 商家頁');
  return parts.join(' / ');
}

function inferChannel(input) {
  if (input.channel) return input.channel;
  if (input.website_url) return 'website';
  if (input.phone) return 'phone';
  if (input.google_maps_url || input.google_place_id) return 'google_maps';
  return 'manual';
}

function selectEligibleProspects(prospects, ledger, batchSize, cooldownDays, now) {
  const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
  const seen = ledger?.prospects || {};
  return prospects
    .filter((prospect) => !BLOCKED_STATUSES.has(prospect.status))
    .filter((prospect) => {
      const last = seen[prospect.id]?.last_batched_at;
      if (!last) return true;
      const lastTs = Date.parse(last);
      return !Number.isFinite(lastTs) || now.getTime() - lastTs >= cooldownMs;
    })
    .map((prospect) => ({ ...prospect, outreach_score: scoreProspect(prospect, now) }))
    .sort((a, b) => b.outreach_score - a.outreach_score || a.name.localeCompare(b.name, 'zh-Hant'))
    .slice(0, batchSize);
}

function scoreProspect(prospect, now) {
  const hasSource = prospect.source_url ? 1 : 0;
  const hasContact = prospect.contact_hint || prospect.channel !== 'manual' ? 1 : 0;
  const hasGoogleProof = prospect.google_place_id || prospect.rating || prospect.user_rating_count ? 1 : 0;
  const discoveredTs = Date.parse(prospect.discovered_at);
  const ageDays = Number.isFinite(discoveredTs) ? Math.max(0, (now.getTime() - discoveredTs) / 86_400_000) : 30;
  const freshness = Math.max(0.2, Math.min(1, 1 - ageDays / 60));
  return round(
    0.38 * clamp01(prospect.fit_score) +
    0.22 * clamp01(prospect.priority) +
    0.12 * hasSource +
    0.12 * hasContact +
    0.08 * hasGoogleProof +
    0.08 * freshness
  );
}

function buildRecord(prospect, campaign, sequence, now) {
  const signal = prospect.public_signal || defaultSignal(prospect);
  const angle = prospect.outreach_angle || prospect.fit_reason || defaultAngle(prospect.segment_id);
  const contactLine = prospect.contact_hint ? `我會從你公開留的聯絡入口聯絡：${prospect.contact_hint}` : '';

  const dm = [
    `你好，我是 ${campaign.sender_name}。`,
    `剛看到「${prospect.name}」的公開資訊：${signal}`,
    `我的判斷是，你們不是缺一篇貼文，而是缺一個讓陌生客在 30 秒內看懂「為什麼選你」的入口。這個入口可以接 Google 商家頁、IG、LINE 或官網詢問。`,
    `我想先替你們整理一頁方向稿：${angle}。`,
    campaign.offer,
    campaign.cta,
    contactLine,
  ].filter(Boolean).join('\n\n');

  const followUp = [
    `你好，我前幾天有留一個小提案給「${prospect.name}」。`,
    '我補一句更白話的版本：我想先幫你們把 Google/IG/LINE 上零散的亮點，整理成一個能接詢問的一頁式入口。',
    '如果現在沒有要做也沒關係；我可以先給一頁方向，你看完再決定要不要聊。',
  ].join('\n\n');

  return {
    id: `${stamp(now)}-${String(sequence).padStart(2, '0')}-${prospect.id}`,
    generated_at: now.toISOString(),
    review_gate: campaign.review_gate,
    prospect,
    recommended_channel: prospect.channel,
    first_touch: {
      subject: `想替「${prospect.name}」整理一頁能接詢問的品牌入口`,
      body: dm,
    },
    follow_up_72h: {
      subject: `補一個「${prospect.name}」的小方向`,
      body: followUp,
    },
    owner_checklist: [
      '打開 source_url，確認商家仍營業且資訊沒有誤判。',
      '確認公開聯絡入口允許商務詢問；不使用私人帳號或非公開個資。',
      '手動補上一句真的看過對方店面的觀察，再發送。',
      '一次少量測試，不做自動大量發送；回覆後更新 ledger/status。',
    ],
  };
}

function defaultSignal(prospect) {
  const parts = [];
  if (prospect.address) parts.push(`位置在 ${prospect.address}`);
  if (prospect.rating) parts.push(`Google 評分 ${prospect.rating}`);
  if (prospect.user_rating_count) parts.push(`${prospect.user_rating_count} 則評論`);
  if (prospect.business_status) parts.push(`狀態 ${prospect.business_status}`);
  return parts.length
    ? parts.join('，')
    : `${prospect.segment_label}的公開品牌呈現很適合被整理成一頁可轉換的故事`;
}

function renderMarkdown(plan) {
  const lines = [
    `# 3Q Cold Outreach Drafts ${plan.batchId}`,
    '',
    `- generated_at: ${plan.now.toISOString()}`,
    `- campaign: ${plan.campaign.id}`,
    `- review_gate: ${plan.campaign.review_gate}`,
    `- config: ${relative(plan.projectRoot, plan.configPath)}`,
    '',
    '## Send Gate',
    '',
    '- This file is a draft queue only.',
    '- Do not bulk send from automation.',
    '- Manual owner review is required before LINE, IG, email, phone, or any outbound send.',
    '- Use only public business contact channels and stop if the business asks not to be contacted.',
    '',
    '## Drafts',
    '',
  ];

  for (const [index, record] of plan.records.entries()) {
    const p = record.prospect;
    lines.push(`### ${index + 1}. ${p.name}`);
    lines.push('');
    lines.push(`- prospect_id: ${p.id}`);
    lines.push(`- channel: ${p.channel}`);
    lines.push(`- segment: ${p.segment_label}`);
    lines.push(`- score: ${p.outreach_score}`);
    if (p.source_url) lines.push(`- source: ${p.source_url}`);
    if (p.google_place_id) lines.push(`- google_place_id: ${p.google_place_id}`);
    if (p.website_url) lines.push(`- website: ${p.website_url}`);
    if (p.phone) lines.push(`- phone: ${p.phone}`);
    if (p.contact_hint) lines.push(`- contact_hint: ${p.contact_hint}`);
    if (p.fit_reason) lines.push(`- fit: ${p.fit_reason}`);
    lines.push('');
    lines.push('First touch:');
    lines.push('');
    lines.push('```text');
    lines.push(record.first_touch.body);
    lines.push('```');
    lines.push('');
    lines.push('72h follow-up:');
    lines.push('');
    lines.push('```text');
    lines.push(record.follow_up_72h.body);
    lines.push('```');
    lines.push('');
    lines.push('Owner checklist:');
    for (const item of record.owner_checklist) lines.push(`- ${item}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function writeLedger(plan) {
  const next = {
    ...plan.ledger,
    updated_at: plan.now.toISOString(),
    prospects: { ...(plan.ledger.prospects || {}) },
    batches: [...(plan.ledger.batches || [])],
  };

  for (const record of plan.records) {
    const current = next.prospects[record.prospect.id] || { count: 0 };
    next.prospects[record.prospect.id] = {
      ...current,
      name: record.prospect.name,
      status: 'drafted',
      count: (current.count || 0) + 1,
      last_batched_at: plan.now.toISOString(),
      last_batch_id: plan.batchId,
    };
  }

  next.batches.unshift({
    batch_id: plan.batchId,
    generated_at: plan.now.toISOString(),
    count: plan.records.length,
    markdown: plan.markdownPath,
    json: plan.jsonPath,
  });
  next.batches = next.batches.slice(0, 50);

  await fs.writeFile(plan.ledgerPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

function defaultAngle(segmentId) {
  if (/food|gift|dessert|bakery|restaurant|coffee/.test(segmentId)) {
    return '菜單/商品照、招牌賣點、節慶禮盒或預約詢問入口';
  }
  if (/beauty|nail|hair|clinic|spa/.test(segmentId)) {
    return '作品集、價目範圍、預約動線與第一次到店前的信任證據';
  }
  if (/pet/.test(segmentId)) {
    return '服務項目、案例照片、預約入口與回訪提醒';
  }
  if (/experience|course|studio/.test(segmentId)) {
    return '體驗流程、預約頁、團體包場與短影音素材入口';
  }
  return '品牌故事、服務賣點、社群入口與一頁式詢問動線';
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function resolveProjectPath(projectRoot, filePath) {
  const root = path.resolve(projectRoot);
  const resolved = path.resolve(root, filePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('cold outreach config_path must stay inside project root');
  }
  return resolved;
}

function relative(projectRoot, filePath) {
  const rel = path.relative(projectRoot, filePath);
  return rel && !rel.startsWith('..') ? rel.replaceAll(path.sep, '/') : filePath;
}

function stamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || randomUUID().slice(0, 8);
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function positiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function numberOr(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
