// 3Q Hatchery — Social Publisher Worker v2.0
// Auto-posts to Threads, Instagram, Facebook Page, TikTok, Google Business Profile
// Tokens stored in SESSION KV and auto-refreshed every 50 days — no manual renewal.
//
// Vars (wrangler.toml):
//   THREADS_APP_ID           — Meta App ID (public, safe in vars)
//   FB_PAGE_ID               — Facebook Page numeric ID (public)
//
// Secrets (wrangler secret put):
//   THREADS_APP_SECRET       — Meta App Secret (for token refresh)
//   TRIGGER_TOKEN            — For manual /publish and /oauth/callback endpoints
//   FB_PAGE_ACCESS_TOKEN     — Facebook Page Access Token (long-lived, page-scoped)
//
// KV keys (SESSION namespace):
//   token:threads:access     — Threads long-lived access token
//   token:threads:user_id    — Threads numeric user ID
//   token:threads:expires    — ISO expiry timestamp
//   token:ig:access          — Instagram long-lived access token
//   token:ig:user_id         — Instagram business user ID
//   token:ig:expires         — ISO expiry timestamp

// ─────────────────────────────────────────────────────────────────────────
// Platform daily limits (to avoid spam signals)
// ─────────────────────────────────────────────────────────────────────────
const DAILY_LIMITS = { threads: 3, instagram: 1, facebook: 1, tiktok: 1, google_biz: 1 };

// ─────────────────────────────────────────────────────────────────────────
// KV-backed token storage (permanent, auto-refreshed)
// ─────────────────────────────────────────────────────────────────────────

async function getToken(platform, key, env) {
  if (!env.SESSION) return env[key] || null;
  const kvVal = await env.SESSION.get(`token:${platform}:${key.toLowerCase().replace('_access_token','access').replace('_user_id','user_id')}`);
  return kvVal || env[key] || null;
}

async function saveTokenToKV(platform, access, userId, expiresInSecs, env) {
  if (!env.SESSION) return;
  const expires = new Date(Date.now() + expiresInSecs * 1000).toISOString();
  await Promise.all([
    env.SESSION.put(`token:${platform}:access`,   access,  { expirationTtl: expiresInSecs }),
    env.SESSION.put(`token:${platform}:user_id`,  userId,  { expirationTtl: expiresInSecs }),
    env.SESSION.put(`token:${platform}:expires`,  expires, { expirationTtl: expiresInSecs }),
  ]);
}

async function refreshMetaToken(platform, env) {
  const appId     = env.THREADS_APP_ID;
  const appSecret = env.THREADS_APP_SECRET;
  if (!appId || !appSecret) return null;

  const currentToken = await getToken(platform, platform === 'threads' ? 'THREADS_ACCESS_TOKEN' : 'IG_ACCESS_TOKEN', env);
  if (!currentToken) return null;

  const host = platform === 'threads' ? 'graph.threads.net' : 'graph.facebook.com';
  const resp = await fetch(
    `https://${host}/refresh_access_token?grant_type=th_refresh_token&access_token=${currentToken}&client_id=${appId}&client_secret=${appSecret}`
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data.access_token) return null;

  const userId = await env.SESSION?.get(`token:${platform}:user_id`) || '';
  await saveTokenToKV(platform, data.access_token, userId, data.expires_in || 5184000, env);
  return data.access_token;
}

async function refreshTokensIfNeeded(env) {
  if (!env.SESSION || !env.THREADS_APP_SECRET) return;
  const tenDays = 10 * 24 * 60 * 60 * 1000;
  for (const platform of ['threads', 'ig']) {
    const expires = await env.SESSION.get(`token:${platform}:expires`);
    if (!expires) continue;
    if (new Date(expires).getTime() - Date.now() < tenDays) {
      console.log(`[social-publisher] refreshing ${platform} token`);
      await refreshMetaToken(platform, env).catch(e => console.error(`refresh ${platform} failed:`, e.message));
    }
  }
}

// Exchange OAuth auth code for tokens and store in KV
async function exchangeCodeAndStore(code, platform, redirectUri, env) {
  const appId     = env.THREADS_APP_ID;
  const appSecret = env.THREADS_APP_SECRET;
  if (!appId || !appSecret) throw new Error('THREADS_APP_ID or THREADS_APP_SECRET not set');

  const host = platform === 'threads' ? 'graph.threads.net' : 'graph.facebook.com';
  // Step 1: short-lived token
  const shortResp = await fetch(`https://${host}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: appId, client_secret: appSecret, grant_type: 'authorization_code', redirect_uri: redirectUri, code }).toString(),
  });
  const shortData = await shortResp.json();
  if (!shortData.access_token) throw new Error(`Code exchange failed: ${JSON.stringify(shortData)}`);

  // Step 2: long-lived token (60 days)
  const longResp = await fetch(`https://${host}/access_token?grant_type=th_exchange_token&client_id=${appId}&client_secret=${appSecret}&access_token=${shortData.access_token}`);
  const longData = await longResp.json();
  const finalToken = longData.access_token || shortData.access_token;
  const expiresIn  = longData.expires_in  || shortData.expires_in || 5184000;

  // Step 3: user ID
  const meResp = await fetch(`https://${host}/v1.0/me?access_token=${finalToken}`);
  const meData = await meResp.json();
  if (!meData.id) throw new Error(`Could not get user ID: ${JSON.stringify(meData)}`);

  await saveTokenToKV(platform, finalToken, meData.id, expiresIn, env);
  return { access_token: finalToken, user_id: meData.id, expires_in: expiresIn };
}

// Threads topic tag → 3Q brand territory (Mosseri advice: 1 tag per post)
const DEFAULT_TOPIC_TAGS = {
  brand:    '品牌孵化',
  product:  '品牌行銷',
  case:     '創業',
  general:  '品牌行銷',
};

const AUTOFILL_MIN_PENDING = 7;
const AUTOFILL_BATCH_SIZE = 5;
const AUTOFILL_CAMPAIGN = 'auto-refill';
const AUTOFILL_LAST_IDS_KEY = 'content_autofill:last_draft_ids';
const AUTOFILL_BRIEFS = [
  { industry: '美髮店', pain: '設計師作品很多，但陌生客只看到價格表。', angle: '把髮型案例變成可預約的入口。' },
  { industry: '健身教練', pain: '限動很勤勞，真正想報名的人卻不知道下一步。', angle: '把成果照、課程與 LINE 諮詢串成一條路。' },
  { industry: '早餐店', pain: '每天排隊的人很多，Google 上卻像沒有存在過。', angle: '用菜單頁和常客故事承接附近搜尋。' },
  { industry: '餐車', pain: '今天在哪裡賣，客人常常找不到。', angle: '把出車地點、招牌品項與預訂入口集中。' },
  { industry: '民宿', pain: '房型照片分散在平台，品牌記憶都留給 OTA。', angle: '做一頁能說故事、能導訂房的房型入口。' },
  { industry: '機車行', pain: '保養技術靠口碑，但新客搜尋時只看到地址。', angle: '用維修案例建立信任，再導 LINE 預約。' },
  { industry: '花店', pain: '作品很漂亮，但節日檔期前沒有固定承接頁。', angle: '把花禮情境、價格帶與預訂時間整理清楚。' },
  { industry: '補習班', pain: '家長看很多廣告，最後還是不知道適不適合孩子。', angle: '用課程成果與試聽流程降低第一次詢問門檻。' },
  { industry: '牙醫診所', pain: '專業感很強，病人卻只記得怕痛和價格不透明。', angle: '用療程說明與初診流程建立安心感。' },
  { industry: '寵物美容', pain: '作品照很可愛，但預約規則常常講不清楚。', angle: '把服務項目、注意事項與 LINE 預約放在同一頁。' },
];
const AUTOFILL_PLATFORMS = ['facebook', 'facebook', 'facebook', 'instagram', 'instagram'];

function taipeiDayKey(date = new Date()) {
  return new Date(date.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function simpleHash(input) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function contentSlug(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'post';
}

function buildTrackUrl(platform, brief, sequence) {
  const content = `${taipeiDayKey()}-${platform}-${sequence}-${contentSlug(brief.industry)}`;
  const params = new URLSearchParams({
    utm_source: platform,
    utm_medium: 'post',
    utm_campaign: AUTOFILL_CAMPAIGN,
    utm_content: content,
  });
  return `https://3q-hatchery-webhook.milk790.workers.dev/track?${params.toString()}`;
}

function fallbackAutofillCaption(brief, platform, url) {
  const lines = platform === 'instagram'
    ? [
      `${brief.industry}最吃虧的地方，常常不是產品不夠好。`,
      `是陌生客滑到你時，不知道該怎麼開始。`,
      '',
      brief.pain,
      brief.angle,
      '',
      `3Q 可以先幫你把第一個承接頁做出來，讓客人從看見到詢問只差一步。`,
      '',
      `揭露：本文由 3Q 內容補給機產生初稿，發布前由負責人審稿。`,
      url,
      '',
      '#品牌孵化 #在地店家 #數位獲客',
    ]
    : [
      `${brief.industry}不是沒有客人。`,
      `很多時候，是客人看見你之後，不知道下一步要做什麼。`,
      '',
      brief.pain,
      '',
      `我們會先看一件事：陌生客從貼文、Google 或朋友推薦進來時，有沒有一個清楚的地方可以理解你、信任你、聯絡你。`,
      '',
      brief.angle,
      '',
      `揭露：本文由 3Q 內容補給機產生初稿，發布前由負責人審稿。`,
      url,
    ];
  return lines.join('\n');
}

async function generateAutofillCaption(brief, platform, url, env) {
  if (!env.AI) return fallbackAutofillCaption(brief, platform, url);
  const prompt = [
    '你是 3Q Hatchery 的內容補給機，幫台灣在地小店寫獲客貼文初稿。',
    '請用繁體中文，台灣用語，不要浮誇，不要承諾保證成效。',
    '格式要求：',
    '- 開頭 2 行是痛點 hook。',
    '- 中段指出一個老闆會點頭的營運問題。',
    '- 結尾放清楚 CTA 與追蹤連結。',
    '- 必須包含揭露句：「揭露：本文由 3Q 內容補給機產生初稿，發布前由負責人審稿。」',
    platform === 'instagram' ? '- Instagram 150 字內，可加 3 個 hashtag。' : '- Facebook 220 字內，不要 hashtag 海。',
    '',
    `行業：${brief.industry}`,
    `痛點：${brief.pain}`,
    `角度：${brief.angle}`,
    `CTA 連結：${url}`,
  ].join('\n');

  try {
    const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
      messages: [
        { role: 'system', content: '只輸出貼文正文，不要解釋，不要 Markdown code block。' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 420,
    });
    const text = (result?.response || '').trim();
    if (!text || !text.includes('揭露：')) return fallbackAutofillCaption(brief, platform, url);
    return text.slice(0, 1200);
  } catch (err) {
    console.error('autofill caption failed:', err.message);
    return fallbackAutofillCaption(brief, platform, url);
  }
}

async function pushOwnerPreview(env, drafts) {
  const ownerId = env.OWNER_USER_ID || env.ADMIN_LINE_USER_ID;
  if (!ownerId || !env.LINE_CHANNEL_ACCESS_TOKEN || drafts.length === 0) {
    return { skipped: 'missing LINE owner push env' };
  }
  const lines = [
    '內容補給機產生新草稿',
    '',
    '回「發」：放行這批草稿',
    '回「發 123 124」：只放行指定 id',
    '',
    ...drafts.map(d => `#${d.id} ${d.platform}｜${d.industry}\n${d.caption.slice(0, 80).replace(/\s+/g, ' ')}...`),
  ];
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: ownerId, messages: [{ type: 'text', text: lines.join('\n') }] }),
  });
  return { ok: res.ok, status: res.status };
}

async function runContentAutofill(env, force = false) {
  if (!env.CRM) return { skipped: 'D1 not bound' };
  if (!env.SESSION) return { skipped: 'KV not bound; daily lock unavailable' };

  const day = taipeiDayKey();
  const lockKey = `content_autofill:ran:${day}`;
  if (!force && await env.SESSION.get(lockKey)) return { skipped: 'already ran today' };

  const pending = await env.CRM.prepare(
    "SELECT COUNT(*) AS n FROM content_queue WHERE status = 'pending'"
  ).first();
  const pendingCount = pending?.n || 0;
  if (!force && pendingCount >= AUTOFILL_MIN_PENDING) {
    await env.SESSION.put(lockKey, JSON.stringify({ skipped: 'enough pending', pendingCount }), { expirationTtl: 36 * 3600 });
    return { skipped: 'enough pending', pendingCount };
  }

  const seed = simpleHash(`${day}:${pendingCount}`);
  const drafts = [];
  for (let i = 0; i < AUTOFILL_BATCH_SIZE; i++) {
    const brief = AUTOFILL_BRIEFS[(seed + i) % AUTOFILL_BRIEFS.length];
    const platform = AUTOFILL_PLATFORMS[i % AUTOFILL_PLATFORMS.length];
    const trackUrl = buildTrackUrl(platform, brief, i + 1);
    const caption = await generateAutofillCaption(brief, platform, trackUrl, env);
    const captionSeed = JSON.stringify({ type: 'industry_pain', industry: brief.industry, pain: brief.pain, angle: brief.angle, trackUrl });
    const r = await env.CRM.prepare(
      "INSERT INTO content_queue (platform, image_url, caption_seed, caption, topic_tag, scheduled_at, status, source_oa) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)"
    ).bind(platform, null, captionSeed, caption, null, null, '3q-hatchery').run();
    drafts.push({ id: r.meta?.last_row_id, platform, industry: brief.industry, caption });
  }

  const ids = drafts.map(d => d.id).filter(Boolean);
  await Promise.all([
    env.SESSION.put(lockKey, JSON.stringify({ generated: ids, pendingCount }), { expirationTtl: 36 * 3600 }),
    env.SESSION.put(AUTOFILL_LAST_IDS_KEY, JSON.stringify(ids), { expirationTtl: 7 * 24 * 3600 }),
  ]);
  const ownerPush = await pushOwnerPreview(env, drafts).catch(err => ({ error: err.message }));
  return { ok: true, generated: ids, pendingCount, ownerPush };
}

async function approveDrafts(env, ids = [], limit = AUTOFILL_BATCH_SIZE) {
  if (!env.CRM) return { ok: false, error: 'D1 not bound' };
  let targetIds = ids.map(id => parseInt(id, 10)).filter(Boolean);
  if (targetIds.length === 0 && env.SESSION) {
    const raw = await env.SESSION.get(AUTOFILL_LAST_IDS_KEY);
    if (raw) targetIds = JSON.parse(raw).map(id => parseInt(id, 10)).filter(Boolean);
  }
  if (targetIds.length === 0) {
    const rows = await env.CRM.prepare(
      "SELECT id FROM content_queue WHERE status = 'draft' ORDER BY id ASC LIMIT ?"
    ).bind(Math.min(limit, 20)).all();
    targetIds = (rows.results || []).map(r => r.id);
  }

  const approved = [];
  for (const id of targetIds) {
    const r = await env.CRM.prepare(
      "UPDATE content_queue SET status = 'pending', error_msg = NULL WHERE id = ? AND status = 'draft'"
    ).bind(id).run();
    if ((r.meta?.changes || 0) > 0) approved.push(id);
  }
  return { ok: true, approved };
}

async function socialStats(env, days = 14) {
  if (!env.CRM) return { ok: false, error: 'D1 not bound' };
  const since = `-${Math.max(1, Math.min(days, 365))} days`;
  const [byContent, byCampaign, bySource] = await Promise.all([
    env.CRM.prepare(
      "SELECT COALESCE(utm_campaign,'(none)') AS utm_campaign, COALESCE(utm_content,'(none)') AS utm_content, event_type, COUNT(*) AS n, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen FROM social_events WHERE created_at >= datetime('now', ?) GROUP BY utm_campaign, utm_content, event_type ORDER BY n DESC LIMIT 100"
    ).bind(since).all(),
    env.CRM.prepare(
      "SELECT COALESCE(utm_campaign,'(none)') AS utm_campaign, event_type, COUNT(*) AS n FROM social_events WHERE created_at >= datetime('now', ?) GROUP BY utm_campaign, event_type ORDER BY n DESC LIMIT 100"
    ).bind(since).all(),
    env.CRM.prepare(
      "SELECT COALESCE(utm_source,'(none)') AS utm_source, event_type, COUNT(*) AS n FROM social_events WHERE created_at >= datetime('now', ?) GROUP BY utm_source, event_type ORDER BY n DESC LIMIT 100"
    ).bind(since).all(),
  ]);
  return {
    ok: true,
    days,
    attribution_note: 'This endpoint groups actual social_events rows. For 3Q, visit rows are the trusted UTM signal.',
    by_content: byContent.results || [],
    by_campaign: byCampaign.results || [],
    by_source: bySource.results || [],
  };
}

// ─────────────────────────────────────────────────────────────────────────
// AI caption generation (Workers AI)
// ─────────────────────────────────────────────────────────────────────────

async function generateCaption(seed, platform, env) {
  if (!env.AI || !seed) return seed || '';

  const platformInstructions = {
    threads: [
      '你是 3Q Hatchery 的品牌孵化顧問，擅長在 Threads 上分享 B2B 觀點。',
      '請根據以下主題關鍵字，寫一篇 Threads 貼文。',
      '規則：',
      '- 前兩行必須吸引人停下來，可用數字、反差或提問',
      '- 結尾要引導留言（不能說「請按讚」或「請追蹤」）',
      '- 500 字以內，使用繁體中文',
      '- 語氣自然、有個人觀點，不像 AI 生成',
      '- 不要加 hashtag',
    ].join('\n'),
    instagram: [
      '你是 3Q Hatchery 的品牌孵化顧問。',
      '請根據以下主題，寫一段 Instagram 貼文說明文字。',
      '規則：',
      '- 150 字以內，繁體中文',
      '- 最後加 3–5 個相關中文 hashtag',
      '- 語氣溫暖、有質感',
    ].join('\n'),
    tiktok: [
      '你是 3Q Hatchery 的品牌孵化顧問。',
      '請根據以下主題，寫一段 TikTok 影片的說明字幕（15 秒腳本）。',
      '規則：',
      '- 3 句話以內，每句 15 字左右',
      '- 第一句要讓人想繼續看',
      '- 使用繁體中文',
    ].join('\n'),
    facebook: [
      '你是 3Q Hatchery 的品牌孵化顧問，管理品牌 Facebook 粉絲專頁。',
      '請根據以下主題，寫一篇 Facebook 貼文。',
      '規則：',
      '- 200–300 字，繁體中文',
      '- 語氣親切、有故事感，適合在 FB 上引發留言分享',
      '- 結尾可加 1–2 個 hashtag',
      '- 不用「按讚」「追蹤」等動詞',
    ].join('\n'),
    google_biz: [
      '你是 3Q Hatchery 的品牌孵化顧問。',
      '請根據以下主題，寫一篇 Google 商家貼文。',
      '規則：',
      '- 100–200 字，繁體中文',
      '- 說明服務或近況，結尾引導聯絡',
    ].join('\n'),
  };

  const systemPrompt = platformInstructions[platform] || platformInstructions.threads;

  try {
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: `主題關鍵字：${seed}` },
      ],
      max_tokens: 600,
    });
    return response?.response?.trim() || seed;
  } catch (err) {
    console.error('AI caption generation failed:', err.message);
    return seed;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Threads API (Meta, launched 2024/11)
// Docs: https://developers.facebook.com/docs/threads
// ─────────────────────────────────────────────────────────────────────────

async function publishToThreads(post, env) {
  const token  = await getToken('threads', 'THREADS_ACCESS_TOKEN', env);
  const userId = await getToken('threads', 'THREADS_USER_ID', env);
  if (!token || !userId) {
    return { ok: false, error: 'Threads token not set — authorize at /oauth/callback' };
  }
  const base   = 'https://graph.threads.net/v1.0';

  // Step 1: Create media container
  const containerParams = new URLSearchParams({
    access_token: token,
    text: post.caption,
    ...(post.topic_tag ? { hashtags: post.topic_tag } : {}),
  });

  if (post.image_url) {
    containerParams.set('media_type', 'IMAGE');
    containerParams.set('image_url', post.image_url);
  } else {
    containerParams.set('media_type', 'TEXT');
  }

  const containerRes = await fetch(`${base}/${userId}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: containerParams.toString(),
  });
  const containerData = await containerRes.json();
  if (!containerRes.ok || !containerData.id) {
    return { ok: false, error: `Container creation failed: ${JSON.stringify(containerData)}` };
  }

  // Step 2: Publish
  const publishRes = await fetch(`${base}/${userId}/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ access_token: token, creation_id: containerData.id }).toString(),
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok || !publishData.id) {
    return { ok: false, error: `Publish failed: ${JSON.stringify(publishData)}` };
  }

  return { ok: true, platform_id: publishData.id };
}

// ─────────────────────────────────────────────────────────────────────────
// Instagram Graph API
// ─────────────────────────────────────────────────────────────────────────

async function publishToInstagram(post, env) {
  const token  = await getToken('ig', 'IG_ACCESS_TOKEN', env);
  const userId = await getToken('ig', 'IG_USER_ID', env);
  if (!token || !userId) {
    return { ok: false, error: 'IG token not set — authorize at /oauth/callback' };
  }
  if (!post.image_url) {
    return { ok: false, error: 'Instagram requires an image_url' };
  }
  const base   = 'https://graph.facebook.com/v19.0';

  // Step 1: Create media object
  const mediaRes = await fetch(`${base}/${userId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url:   post.image_url,
      caption:     post.caption,
      access_token: token,
    }),
  });
  const mediaData = await mediaRes.json();
  if (!mediaRes.ok || !mediaData.id) {
    return { ok: false, error: `IG media create failed: ${JSON.stringify(mediaData)}` };
  }

  // Step 2: Publish
  const publishRes = await fetch(`${base}/${userId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: mediaData.id, access_token: token }),
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok || !publishData.id) {
    return { ok: false, error: `IG publish failed: ${JSON.stringify(publishData)}` };
  }

  return { ok: true, platform_id: publishData.id };
}

// ─────────────────────────────────────────────────────────────────────────
// TikTok Content Posting API v2
// ─────────────────────────────────────────────────────────────────────────

async function publishToTikTok(post, env) {
  if (!env.TIKTOK_ACCESS_TOKEN) {
    return { ok: false, error: 'TIKTOK_ACCESS_TOKEN not set' };
  }
  if (!post.image_url) {
    return { ok: false, error: 'TikTok photo post requires image_url' };
  }

  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.TIKTOK_ACCESS_TOKEN}`,
      'Content-Type':  'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title:       post.caption.slice(0, 150),
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_comment: false,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        photo_images: [post.image_url],
        photo_cover_index: 0,
      },
      post_mode: 'DIRECT_POST',
      media_type: 'PHOTO',
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error?.code !== 'ok') {
    return { ok: false, error: `TikTok post failed: ${JSON.stringify(data)}` };
  }

  return { ok: true, platform_id: data.data?.publish_id };
}

// ─────────────────────────────────────────────────────────────────────────
// Google Business Profile API
// ─────────────────────────────────────────────────────────────────────────

async function getGoogleAccessToken(serviceAccountJson) {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/business.manage',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const sigInput = `${header}.${payload}`;

  // Import private key
  const pemKey = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const keyData = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(sigInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  const jwt = `${sigInput}.${sigB64}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function publishToGoogleBiz(post, env) {
  if (!env.GOOGLE_SERVICE_ACCOUNT || !env.GOOGLE_LOCATION_NAME) {
    return { ok: false, error: 'GOOGLE_SERVICE_ACCOUNT or GOOGLE_LOCATION_NAME not set' };
  }

  let accessToken;
  try {
    accessToken = await getGoogleAccessToken(env.GOOGLE_SERVICE_ACCOUNT);
  } catch (err) {
    return { ok: false, error: `Google auth failed: ${err.message}` };
  }

  const localPost = {
    languageCode: 'zh-TW',
    summary: post.caption,
    callToAction: { actionType: 'LEARN_MORE', url: 'https://line.me/R/ti/p/@121LKSPE' },
    topicType: 'STANDARD',
    ...(post.image_url ? {
      media: [{ mediaFormat: 'PHOTO', sourceUrl: post.image_url }]
    } : {}),
  };

  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/${env.GOOGLE_LOCATION_NAME}/localPosts`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(localPost),
    }
  );
  const data = await res.json();
  if (!res.ok || !data.name) {
    return { ok: false, error: `Google Biz post failed: ${JSON.stringify(data)}` };
  }

  return { ok: true, platform_id: data.name };
}

// ─────────────────────────────────────────────────────────────────────────
// Facebook Page — Graph API v21.0
// Docs: https://developers.facebook.com/docs/graph-api/reference/page/feed
//       https://developers.facebook.com/docs/graph-api/reference/page/photos
// Requires: FB_PAGE_ACCESS_TOKEN secret, FB_PAGE_ID var
// ─────────────────────────────────────────────────────────────────────────

async function publishToFacebook(post, env) {
  const token  = await getToken('fb', 'FB_PAGE_ACCESS_TOKEN', env);
  const pageId = env.FB_PAGE_ID;
  if (!token)  return { ok: false, error: 'FB_PAGE_ACCESS_TOKEN not set' };
  if (!pageId) return { ok: false, error: 'FB_PAGE_ID not set in vars' };

  const base = `https://graph.facebook.com/v21.0/${pageId}`;

  if (post.image_url) {
    // Photo post: /photos endpoint attaches image + caption
    const res = await fetch(`${base}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url:          post.image_url,
        caption:      post.caption || '',
        access_token: token,
      }),
    });
    const data = await res.json();
    if (!res.ok || (!data.id && !data.post_id)) {
      return { ok: false, error: `FB photo post failed: ${JSON.stringify(data)}` };
    }
    return { ok: true, platform_id: data.post_id || data.id };
  } else {
    // Text-only post: /feed endpoint
    const res = await fetch(`${base}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message:      post.caption || '',
        access_token: token,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.id) {
      return { ok: false, error: `FB feed post failed: ${JSON.stringify(data)}` };
    }
    return { ok: true, platform_id: data.id };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Platform dispatch
// ─────────────────────────────────────────────────────────────────────────

const PLATFORM_FNS = {
  threads:    publishToThreads,
  instagram:  publishToInstagram,
  facebook:   publishToFacebook,
  tiktok:     publishToTikTok,
  google_biz: publishToGoogleBiz,
};

async function publishPost(post, env) {
  const fn = PLATFORM_FNS[post.platform];
  if (!fn) return { ok: false, error: `Unknown platform: ${post.platform}` };

  // Generate caption if not already set
  if (!post.caption && post.caption_seed) {
    post.caption = await generateCaption(post.caption_seed, post.platform, env);
    // Save generated caption to D1
    await env.CRM.prepare(
      'UPDATE content_queue SET caption = ? WHERE id = ?'
    ).bind(post.caption, post.id).run();
  }

  return await fn(post, env);
}

// ─────────────────────────────────────────────────────────────────────────
// Main publish loop (called from cron and /publish HTTP trigger)
// ─────────────────────────────────────────────────────────────────────────

async function runPublishLoop(env, targetPlatform = null) {
  if (!env.CRM) return { ok: false, error: 'D1 not bound' };

  const nowIso = new Date().toISOString();
  const results = [];

  const platforms = targetPlatform
    ? [targetPlatform]
    : Object.keys(DAILY_LIMITS);

  for (const platform of platforms) {
    // Check how many have been published today for this platform
    const today = nowIso.slice(0, 10); // YYYY-MM-DD
    const todayCount = await env.CRM.prepare(
      "SELECT COUNT(*) AS n FROM content_queue WHERE platform = ? AND status = 'published' AND published_at >= ?"
    ).bind(platform, today).first();

    const limit = DAILY_LIMITS[platform] || 1;
    if ((todayCount?.n || 0) >= limit) {
      results.push({ platform, skipped: true, reason: `daily limit ${limit} reached` });
      continue;
    }

    // Get next pending post (scheduled_at <= now OR null)
    const post = await env.CRM.prepare(
      "SELECT * FROM content_queue WHERE platform = ? AND status = 'pending' AND (scheduled_at IS NULL OR scheduled_at <= ?) ORDER BY scheduled_at ASC, id ASC LIMIT 1"
    ).bind(platform, nowIso).first();

    if (!post) {
      results.push({ platform, skipped: true, reason: 'no pending posts' });
      continue;
    }

    const outcome = await publishPost(post, env);

    if (outcome.ok) {
      await env.CRM.prepare(
        "UPDATE content_queue SET status = 'published', published_at = ?, error_msg = NULL WHERE id = ?"
      ).bind(nowIso, post.id).run();
      results.push({ platform, published: true, id: post.id, platform_id: outcome.platform_id });
    } else {
      await env.CRM.prepare(
        "UPDATE content_queue SET status = 'failed', error_msg = ? WHERE id = ?"
      ).bind(outcome.error, post.id).run();
      results.push({ platform, published: false, id: post.id, error: outcome.error });
    }
  }

  return { ok: true, results };
}

// ─────────────────────────────────────────────────────────────────────────
// Token match (constant-time)
// ─────────────────────────────────────────────────────────────────────────

function tokensMatch(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ─────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────

export default {
  async scheduled(controller, env, ctx) {
    console.log(`[social-publisher] cron triggered: ${controller.cron}`);
    ctx.waitUntil(
      Promise.allSettled([
        runPublishLoop(env).then(r => console.log('[social-publisher] publish:', JSON.stringify(r))),
        runContentAutofill(env).then(r => console.log('[social-publisher] autofill:', JSON.stringify(r))),
        refreshTokensIfNeeded(env),
      ]).catch(err => console.error('[social-publisher] error:', err.message))
    );
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const CORS = { 'Access-Control-Allow-Origin': '*' };
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
    }

    // Health check
    if (url.pathname === '/health') {
      const [threadsToken, igToken] = await Promise.all([
        getToken('threads', 'THREADS_ACCESS_TOKEN', env),
        getToken('ig', 'IG_ACCESS_TOKEN', env),
      ]);
      return json({
        ok: true,
        worker: '3q-social-publisher',
        version: '2.0',
        platforms: Object.keys(DAILY_LIMITS),
        configured: {
          threads:    Boolean(threadsToken),
          instagram:  Boolean(igToken),
          tiktok:     Boolean(env.TIKTOK_ACCESS_TOKEN),
          google_biz: Boolean(env.GOOGLE_SERVICE_ACCOUNT && env.GOOGLE_LOCATION_NAME),
          crm_d1:     Boolean(env.CRM),
          ai:         Boolean(env.AI),
          auto_refresh: Boolean(env.THREADS_APP_SECRET),
          owner_push: Boolean(env.LINE_CHANNEL_ACCESS_TOKEN && (env.OWNER_USER_ID || env.ADMIN_LINE_USER_ID)),
        },
      });
    }

    // OAuth callback: POST /oauth/callback (TRIGGER_TOKEN protected)
    // Body: { platform: "threads"|"ig", code: "...", redirect_uri: "..." }
    if (url.pathname === '/oauth/callback' && request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      const tok  = auth.startsWith('Bearer ') ? auth.slice(7) : url.searchParams.get('token');
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return new Response('forbidden', { status: 403 });
      const body = await request.json().catch(() => ({}));
      const platform    = body.platform || 'threads';
      const code        = body.code;
      const redirectUri = body.redirect_uri || 'https://milk790-code.github.io/3q-hatchery-line-oa/assets/threads-auth.html';
      if (!code) return json({ ok: false, error: 'code required' }, 400);
      try {
        const result = await exchangeCodeAndStore(code, platform, redirectUri, env);
        return json({ ok: true, platform, user_id: result.user_id, expires_in: result.expires_in });
      } catch (err) {
        return json({ ok: false, error: err.message }, 400);
      }
    }

    // Manual publish trigger: POST /publish?token=TRIGGER_TOKEN[&platform=threads]
    if (url.pathname === '/publish' && request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      const tok  = auth.startsWith('Bearer ') ? auth.slice(7) : url.searchParams.get('token');
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return new Response('forbidden', { status: 403 });
      const platform = url.searchParams.get('platform') || null;
      const result = await runPublishLoop(env, platform);
      return json(result);
    }

    // Generate caption preview: POST /preview-caption
    if (url.pathname === '/preview-caption' && request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      const tok  = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return new Response('forbidden', { status: 403 });
      const body = await request.json().catch(() => ({}));
      const caption = await generateCaption(body.seed || '', body.platform || 'threads', env);
      return json({ ok: true, caption });
    }

    // Content autofill: POST /autofill?token=TRIGGER_TOKEN[&force=1]
    if (url.pathname === '/autofill' && request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      const tok  = auth.startsWith('Bearer ') ? auth.slice(7) : url.searchParams.get('token');
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return json({ ok: false, error: 'forbidden' }, 403);
      const result = await runContentAutofill(env, url.searchParams.get('force') === '1');
      return json(result);
    }

    // Approve draft rows: POST /queue/approve?token=TRIGGER_TOKEN&ids=1,2
    if (url.pathname === '/queue/approve' && request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      const tok  = auth.startsWith('Bearer ') ? auth.slice(7) : url.searchParams.get('token');
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return json({ ok: false, error: 'forbidden' }, 403);
      const body = await request.json().catch(() => ({}));
      const ids = body.ids || (url.searchParams.get('ids') || '').split(',');
      const result = await approveDrafts(env, Array.isArray(ids) ? ids : String(ids).split(','));
      return json(result);
    }

    // UTM stats: GET /admin/stats?key=TRIGGER_TOKEN&days=14
    if (url.pathname === '/admin/stats' && request.method === 'GET') {
      const auth = request.headers.get('Authorization') || '';
      const tok  = auth.startsWith('Bearer ') ? auth.slice(7) : (url.searchParams.get('key') || url.searchParams.get('token'));
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return json({ ok: false, error: 'forbidden' }, 403);
      const days = parseInt(url.searchParams.get('days') || '14', 10);
      return json(await socialStats(env, Number.isFinite(days) ? days : 14));
    }

    // Add to content queue: POST /queue/add (token-protected)
    if (url.pathname === '/queue/add' && request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      const tok  = auth.startsWith('Bearer ') ? auth.slice(7) : url.searchParams.get('token');
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return json({ ok: false, error: 'forbidden' }, 403);
      if (!env.CRM) return json({ ok: false, error: 'D1 not bound' });
      const b = await request.json().catch(() => ({}));
      const platform = (b.platform || '').trim();
      if (!platform) return json({ ok: false, error: 'platform required' }, 400);
      const r = await env.CRM.prepare(
        "INSERT INTO content_queue (platform, image_url, caption_seed, caption, topic_tag, scheduled_at, status, source_oa) VALUES (?,?,?,?,?,?,?, ?)"
      ).bind(platform, b.image_url || null, b.caption_seed || null, b.caption || null, b.topic_tag || null, b.scheduled_at || null, b.status || 'pending', b.source_oa || '3q-hatchery').run();
      return json({ ok: true, id: r.meta && r.meta.last_row_id });
    }

    // Soft-delete a queue row: POST /queue/del?id= (token-protected)
    if (url.pathname === '/queue/del' && request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      const tok  = auth.startsWith('Bearer ') ? auth.slice(7) : url.searchParams.get('token');
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return json({ ok: false, error: 'forbidden' }, 403);
      if (!env.CRM) return json({ ok: false, error: 'D1 not bound' });
      const id = parseInt(url.searchParams.get('id') || '0', 10);
      if (!id) return json({ ok: false, error: 'id required' }, 400);
      const result = await env.CRM.prepare(
        "UPDATE content_queue SET status = 'deleted', scheduled_at = NULL, error_msg = 'soft-deleted by admin queue control' WHERE id = ?"
      ).bind(id).run();
      return json({ ok: true, soft_deleted: id, changes: result.meta?.changes || 0 });
    }
    if (url.pathname === '/queue/del') {
      return json({ ok: false, error: 'method not allowed' }, 405);
    }

    // List queue: GET /queue/list?token=
    if (url.pathname === '/queue/list') {
      const tok = url.searchParams.get('token');
      if (!tokensMatch(tok, env.TRIGGER_TOKEN)) return json({ ok: false, error: 'forbidden' }, 403);
      if (!env.CRM) return json({ ok: false, error: 'D1 not bound' });
      const rows = await env.CRM.prepare(
        "SELECT id, platform, substr(coalesce(caption,caption_seed,''),1,80) AS preview, scheduled_at, status, error_msg FROM content_queue ORDER BY id DESC LIMIT 50"
      ).all();
      return json({ ok: true, rows: rows.results });
    }

    return json({ service: '3q-social-publisher', ok: true, version: '1.0' });
  },
};
