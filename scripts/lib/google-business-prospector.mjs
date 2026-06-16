import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const DEFAULT_CONFIG = {
  api_key_env: 'GOOGLE_MAPS_API_KEY',
  fallback_api_key_env: 'GOOGLE_PLACES_API_KEY',
  language_code: 'zh-TW',
  region_code: 'TW',
  limit_per_query: 8,
  max_new: 20,
  min_rating: 0,
  min_user_rating_count: 0,
  review_gate: 'manual_send_only',
};

const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.businessStatus',
  'places.primaryType',
  'places.types',
  'places.googleMapsUri',
  'nextPageToken',
].join(',');

const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'businessStatus',
  'primaryType',
  'types',
  'googleMapsUri',
  'websiteUri',
  'nationalPhoneNumber',
  'rating',
  'userRatingCount',
].join(',');

export async function runGoogleBusinessProspecting({
  projectRoot,
  stateDir,
  task = {},
  now = new Date(),
  dryRun = false,
} = {}) {
  const plan = await planGoogleBusinessProspecting({ projectRoot, stateDir, task, now });

  if (!plan.configFound) {
    return {
      ok: false,
      retryable: false,
      error: `outreach config not found: ${plan.configPath}`,
    };
  }

  if (plan.queries.length === 0) {
    return {
      ok: true,
      generated_count: 0,
      summary: 'no Google prospecting queries configured',
      config_path: relative(projectRoot, plan.configPath),
    };
  }

  if (!plan.apiKey) {
    return {
      ok: true,
      generated_count: 0,
      needs_api_key: true,
      summary: `waiting for ${plan.settings.api_key_env} or ${plan.settings.fallback_api_key_env}; no external Google request made`,
      config_path: relative(projectRoot, plan.configPath),
      query_count: plan.queries.length,
    };
  }

  const fetched = [];
  const errors = [];

  for (const query of plan.queries) {
    if (fetched.length >= plan.settings.max_new) break;
    try {
      const searchResults = await searchText({
        apiKey: plan.apiKey,
        query,
        settings: plan.settings,
      });
      for (const item of searchResults) {
        if (fetched.length >= plan.settings.max_new) break;
        const placeId = item.id;
        if (!placeId) continue;
        if (plan.existingPlaceIds.has(placeId)) continue;

        const details = await placeDetails({
          apiKey: plan.apiKey,
          placeId,
          settings: plan.settings,
        });
        const prospect = normalizePlaceToProspect({ place: { ...item, ...details }, query, now });
        if (!prospect) continue;
        if (plan.existingKeys.has(dedupeKey(prospect))) continue;
        if (plan.settings.min_rating > 0 && (!prospect.rating || prospect.rating < plan.settings.min_rating)) continue;
        if (
          plan.settings.min_user_rating_count > 0 &&
          (!prospect.user_rating_count || prospect.user_rating_count < plan.settings.min_user_rating_count)
        ) continue;

        fetched.push(prospect);
        plan.existingPlaceIds.add(placeId);
        plan.existingKeys.add(dedupeKey(prospect));
      }
    } catch (error) {
      errors.push({ query: query.text_query, error: error.message });
    }
  }

  const prospects = fetched
    .map((prospect) => ({
      ...prospect,
      priority: prospect.priority ?? 0.78,
      fit_score: prospect.fit_score ?? 0.78,
    }))
    .sort((a, b) => scoreImportedProspect(b) - scoreImportedProspect(a))
    .slice(0, plan.settings.max_new);

  if (!dryRun && prospects.length > 0) {
    const nextConfig = {
      ...plan.config,
      google_prospecting: {
        ...(plan.config.google_prospecting || {}),
        last_imported_at: now.toISOString(),
      },
      prospects: [...(plan.config.prospects || []), ...prospects],
    };
    await fs.writeFile(plan.configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');
  }

  let artifactPaths = null;
  if (!dryRun) {
    await fs.mkdir(plan.prospectingDir, { recursive: true });
    artifactPaths = {
      json: plan.jsonPath,
      markdown: plan.markdownPath,
    };
    await fs.writeFile(plan.jsonPath, `${JSON.stringify({ generated_at: now.toISOString(), prospects, errors }, null, 2)}\n`, 'utf8');
    await fs.writeFile(plan.markdownPath, renderProspectingMarkdown({ plan, prospects, errors }), 'utf8');
  }

  return {
    ok: errors.length === 0 || prospects.length > 0,
    retryable: errors.length > 0 && prospects.length === 0,
    generated_count: prospects.length,
    error_count: errors.length,
    summary: `${dryRun ? 'would import' : 'imported'} ${prospects.length} Google business prospects`,
    config_path: relative(projectRoot, plan.configPath),
    artifact_paths: artifactPaths
      ? {
          json: artifactPaths.json,
          markdown: artifactPaths.markdown,
        }
      : {
          json: relative(projectRoot, plan.jsonPath),
          markdown: relative(projectRoot, plan.markdownPath),
        },
    prospects: prospects.map((prospect) => ({
      id: prospect.id,
      name: prospect.name,
      channel: prospect.channel,
      source_url: prospect.source_url,
      contact_hint: prospect.contact_hint,
    })),
    errors,
  };
}

export async function previewGoogleBusinessProspectingCandidate({
  projectRoot,
  stateDir,
  now = new Date(),
  payload = {},
} = {}) {
  const plan = await planGoogleBusinessProspecting({
    projectRoot,
    stateDir,
    task: { payload },
    now,
  });

  if (!plan.configFound) {
    return {
      type: 'google_business_prospecting',
      id: 'google-prospecting-config-missing',
      title: 'Create Google prospecting config',
      value: 0.84,
      urgency: 0.72,
      loopability: 0.9,
      freshness: 0.85,
      risk: 0.12,
      action: 'Create scripts/outreach.prospects.json before Google business prospecting can run.',
      evidence: { expectedConfig: relative(projectRoot, plan.configPath) },
    };
  }

  if (plan.queries.length === 0) {
    return {
      type: 'google_business_prospecting',
      id: 'google-prospecting-queries-missing',
      title: 'Add Google business search queries',
      value: 0.8,
      urgency: 0.7,
      loopability: 0.9,
      freshness: 0.8,
      risk: 0.1,
      action: 'Add google_prospecting.queries to scripts/outreach.prospects.json.',
      evidence: { config: relative(projectRoot, plan.configPath) },
    };
  }

  if (!plan.apiKey) {
    return {
      type: 'google_business_prospecting',
      id: 'google-prospecting-api-key-missing',
      title: 'Set Google Places API key for prospecting',
      value: 0.88,
      urgency: 0.78,
      loopability: 0.85,
      freshness: 0.9,
      risk: 0.18,
      action: `Set ${plan.settings.api_key_env} or ${plan.settings.fallback_api_key_env} in the runner environment, then run the prospecting loop. Do not store the key in repo files.`,
      evidence: {
        config: relative(projectRoot, plan.configPath),
        queryCount: plan.queries.length,
        reviewGate: plan.settings.review_gate,
      },
    };
  }

  return {
    type: 'google_business_prospecting',
    id: 'google-prospecting-ready',
    title: 'Import Google businesses into outreach prospects',
    value: 0.94,
    urgency: 0.82,
    loopability: 0.9,
    freshness: 0.9,
    risk: 0.22,
    action:
      'Run the Google business prospecting task to append deduped public business contacts, then generate manual-review outreach drafts.',
    evidence: {
      config: relative(projectRoot, plan.configPath),
      queryCount: plan.queries.length,
      maxNew: plan.settings.max_new,
      reviewGate: plan.settings.review_gate,
      artifactPreview: {
        json: relative(projectRoot, plan.jsonPath),
        markdown: relative(projectRoot, plan.markdownPath),
      },
    },
  };
}

async function planGoogleBusinessProspecting({ projectRoot, stateDir, task = {}, now = new Date() }) {
  const payload = task.payload || {};
  const configPath = resolveProjectPath(
    projectRoot,
    payload.config_path || process.env.LOOPS_OUTREACH_CONFIG || path.join('scripts', 'outreach.prospects.json')
  );
  const config = await readJson(configPath, null);
  const settings = normalizeSettings({ ...(config?.google_prospecting || {}), ...payload });
  const queries = normalizeQueries(payload.queries || config?.google_prospecting?.queries || []);
  const apiKey = process.env[settings.api_key_env] || process.env[settings.fallback_api_key_env] || '';
  const prospectingDir = path.resolve(stateDir || path.join(projectRoot, '.loops'), 'google-prospects');
  const batchId = `${stamp(now)}-${hash(queries.map((query) => query.text_query).join('|')).slice(0, 8)}`;
  const jsonPath = path.join(prospectingDir, `${batchId}-prospects.json`);
  const markdownPath = path.join(prospectingDir, `${batchId}-prospects.md`);
  const existing = Array.isArray(config?.prospects) ? config.prospects : [];

  return {
    projectRoot,
    stateDir,
    configFound: Boolean(config),
    configPath,
    config,
    settings,
    queries,
    apiKey,
    prospectingDir,
    batchId,
    jsonPath,
    markdownPath,
    existingPlaceIds: new Set(existing.map((item) => item.google_place_id).filter(Boolean)),
    existingKeys: new Set(existing.map(dedupeKey).filter(Boolean)),
  };
}

function normalizeSettings(input) {
  const cleanInput = Object.fromEntries(
    Object.entries(input || {}).filter(([, value]) => value !== undefined && value !== '')
  );
  return {
    ...DEFAULT_CONFIG,
    ...cleanInput,
    limit_per_query: positiveInt(cleanInput.limit_per_query, DEFAULT_CONFIG.limit_per_query),
    max_new: positiveInt(cleanInput.max_new, DEFAULT_CONFIG.max_new),
    min_rating: numberOr(cleanInput.min_rating, DEFAULT_CONFIG.min_rating),
    min_user_rating_count: positiveInt(cleanInput.min_user_rating_count, DEFAULT_CONFIG.min_user_rating_count),
  };
}

function normalizeQueries(input) {
  const raw = Array.isArray(input) ? input : [input].filter(Boolean);
  return raw
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          id: `query-${index + 1}`,
          text_query: item,
          segment: 'google-local-business',
          priority: 0.75,
          fit_score: 0.75,
        };
      }
      if (!item || !item.text_query) return null;
      return {
        id: item.id || slug(item.text_query),
        text_query: item.text_query,
        segment: item.segment || 'google-local-business',
        priority: numberOr(item.priority, 0.75),
        fit_score: numberOr(item.fit_score, 0.75),
        outreach_angle: item.outreach_angle || '',
      };
    })
    .filter(Boolean);
}

async function searchText({ apiKey, query, settings }) {
  const pageSize = Math.max(1, Math.min(20, settings.limit_per_query));
  const body = {
    textQuery: query.text_query,
    pageSize,
    languageCode: settings.language_code,
    regionCode: settings.region_code,
  };
  const data = await googleFetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    apiKey,
    fieldMask: SEARCH_FIELD_MASK,
    body,
  });
  return Array.isArray(data.places) ? data.places : [];
}

async function placeDetails({ apiKey, placeId, settings }) {
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set('languageCode', settings.language_code);
  url.searchParams.set('regionCode', settings.region_code);
  return googleFetch(url.toString(), {
    method: 'GET',
    apiKey,
    fieldMask: DETAILS_FIELD_MASK,
  });
}

async function googleFetch(url, { method, apiKey, fieldMask, body }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const message = data?.error?.message || `${response.status} ${response.statusText}`;
      throw new Error(`Google Places request failed: ${message}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function normalizePlaceToProspect({ place, query, now }) {
  if (!place?.id || !place.displayName?.text) return null;
  if (place.businessStatus === 'CLOSED_PERMANENTLY') return null;

  const name = place.displayName.text;
  const rating = numberOr(place.rating, null);
  const ratingCount = numberOr(place.userRatingCount, null);
  const websiteUrl = place.websiteUri || '';
  const phone = place.nationalPhoneNumber || '';
  const googleMapsUrl = place.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(place.id)}`;
  const contactParts = [];
  if (phone) contactParts.push(`電話 ${phone}`);
  if (websiteUrl) contactParts.push(`官網 ${websiteUrl}`);
  contactParts.push('Google Maps 商家頁');

  const fit = computeFitScore({ place, query, hasWebsite: Boolean(websiteUrl), hasPhone: Boolean(phone) });
  const priority = computePriority({ rating, ratingCount, query });
  const signal = [
    place.formattedAddress ? `地址 ${place.formattedAddress}` : '',
    rating ? `Google 評分 ${rating}` : '',
    ratingCount ? `${ratingCount} 則評論` : '',
    place.primaryType ? `類型 ${place.primaryType}` : '',
  ].filter(Boolean).join('，');

  return {
    id: `gmap-${slug(name)}-${hash(place.id).slice(0, 8)}`,
    name,
    segment: query.segment,
    channel: websiteUrl ? 'website' : phone ? 'phone' : 'google_maps',
    source_type: 'google_places',
    source_url: googleMapsUrl,
    google_maps_url: googleMapsUrl,
    google_place_id: place.id,
    address: place.formattedAddress || '',
    website_url: websiteUrl,
    phone,
    contact_hint: contactParts.join(' / '),
    public_signal: signal || 'Google 商家頁有公開資訊，可先人工檢查品牌呈現與聯絡入口。',
    fit_reason:
      'Google 商家已有公開流量與信任證據，適合用一頁式入口把 Google/IG/LINE 的注意力接到詢問或預約。',
    outreach_angle: query.outreach_angle || defaultAngleForQuery(query),
    fit_score: fit,
    priority,
    rating,
    user_rating_count: ratingCount,
    business_status: place.businessStatus || '',
    google_primary_type: place.primaryType || '',
    google_types: place.types || [],
    status: 'new',
    discovered_at: now.toISOString().slice(0, 10),
  };
}

function computeFitScore({ place, query, hasWebsite, hasPhone }) {
  const typeText = `${place.primaryType || ''} ${(place.types || []).join(' ')} ${query.text_query}`.toLowerCase();
  let score = numberOr(query.fit_score, 0.75);
  if (/bakery|cafe|restaurant|food|meal|dessert|甜點|餐廳|咖啡|伴手禮|禮盒/.test(typeText)) score += 0.08;
  if (/beauty|hair|nail|spa|pet|clinic|美甲|美容|寵物|診所/.test(typeText)) score += 0.06;
  if (hasWebsite) score += 0.04;
  if (hasPhone) score += 0.03;
  return round(clamp01(score));
}

function computePriority({ rating, ratingCount, query }) {
  let score = numberOr(query.priority, 0.75);
  if (rating >= 4.3) score += 0.06;
  if (rating >= 4.7) score += 0.04;
  if (ratingCount >= 80) score += 0.04;
  if (ratingCount >= 250) score += 0.04;
  return round(clamp01(score));
}

function scoreImportedProspect(prospect) {
  return (
    0.4 * numberOr(prospect.fit_score, 0) +
    0.25 * numberOr(prospect.priority, 0) +
    0.15 * (prospect.website_url ? 1 : 0) +
    0.1 * (prospect.phone ? 1 : 0) +
    0.1 * (prospect.rating ? Math.min(1, prospect.rating / 5) : 0.5)
  );
}

function defaultAngleForQuery(query) {
  if (/餐|咖啡|甜|伴手禮|禮盒|food|gift|dessert|bakery|restaurant|cafe/i.test(query.text_query)) {
    return '菜單/商品照、Google 評價亮點、LINE 或官網詢問入口';
  }
  if (/美甲|美容|髮|spa|nail|beauty|hair/i.test(query.text_query)) {
    return '作品集、價目區間、預約流程與初次到店前的信任證據';
  }
  if (/寵物|pet/i.test(query.text_query)) {
    return '服務項目、案例照片、預約入口與回訪提醒';
  }
  return 'Google 商家頁、社群內容與一頁式詢問動線';
}

function renderProspectingMarkdown({ plan, prospects, errors }) {
  const lines = [
    `# Google Business Prospects ${plan.batchId}`,
    '',
    `- generated_at: ${new Date().toISOString()}`,
    `- config: ${relative(plan.projectRoot, plan.configPath)}`,
    `- review_gate: ${plan.settings.review_gate}`,
    `- imported_count: ${prospects.length}`,
    '',
    '## Send Gate',
    '',
    '- This file is a prospecting artifact only.',
    '- It does not send LINE, email, phone, or bulk messages.',
    '- Before contact, manually verify the Google listing and use only public business contact channels.',
    '',
    '## Prospects',
    '',
  ];

  if (prospects.length === 0) lines.push('- No new prospects imported.');

  for (const prospect of prospects) {
    lines.push(`### ${prospect.name}`);
    lines.push('');
    lines.push(`- id: ${prospect.id}`);
    lines.push(`- segment: ${prospect.segment}`);
    lines.push(`- channel: ${prospect.channel}`);
    lines.push(`- source: ${prospect.source_url}`);
    if (prospect.website_url) lines.push(`- website: ${prospect.website_url}`);
    if (prospect.phone) lines.push(`- phone: ${prospect.phone}`);
    if (prospect.rating) lines.push(`- rating: ${prospect.rating} (${prospect.user_rating_count || 0} reviews)`);
    lines.push(`- signal: ${prospect.public_signal}`);
    lines.push('');
  }

  if (errors.length > 0) {
    lines.push('## Errors');
    lines.push('');
    for (const error of errors) {
      lines.push(`- ${error.query}: ${error.error}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
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
    throw new Error('Google prospecting config_path must stay inside project root');
  }
  return resolved;
}

function relative(projectRoot, filePath) {
  const rel = path.relative(projectRoot, filePath);
  return rel && !rel.startsWith('..') ? rel.replaceAll(path.sep, '/') : filePath;
}

function dedupeKey(item) {
  if (!item) return '';
  if (item.google_place_id) return `place:${item.google_place_id}`;
  const name = String(item.name || '').trim().toLowerCase();
  const address = String(item.address || item.formatted_address || '').trim().toLowerCase();
  return name ? `name:${name}|${address}` : '';
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
  return Number.isFinite(n) && n >= 0 ? n : fallback;
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
