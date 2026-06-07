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
// 2026-06-07 衝刺模式:FB 1→3、IG 1→2(短期獲客衝刺,基線出來後可調回)
const DAILY_LIMITS = { threads: 3, instagram: 2, facebook: 3, tiktok: 1, google_biz: 1 };

// ─────────────────────────────────────────────────────────────────────────
// KV-backed token storage (permanent, auto-refreshed)
// ─────────────────────────────────────────────────────────────────────────

async function getToken(platform, key, env) {
  if (!env.SESSION) return env[key] || null;
  // Map binding name → KV suffix actually written by saveTokenToKV / fb-token-setup:
  //   *_ACCESS_TOKEN → "access", *_USER_ID → "user_id".
  // The old replace() built keys like "token:threads:threadsaccess", so KV reads
  // ALWAYS missed (and auto-refresh silently never worked). Fixed 2026-06-07.
  const suffix = key.endsWith('_ACCESS_TOKEN') ? 'access'
               : key.endsWith('_USER_ID')      ? 'user_id'
               : key.toLowerCase();
  const kvVal = await env.SESSION.get(`token:${platform}:${suffix}`);
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

  // Post a link as the FIRST COMMENT (keeps external links out of the body,
  // which FB's algorithm penalises for reach).
  async function firstComment(objectId) {
    if (!post.link_url || !objectId) return;
    try {
      await fetch(`https://graph.facebook.com/v21.0/${objectId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: post.link_url, access_token: token }),
      });
    } catch (e) { console.error('[fb] first comment failed:', e.message); }
  }

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
    const objectId = data.post_id || data.id;
    await firstComment(objectId);
    return { ok: true, platform_id: objectId };
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
    await firstComment(data.id);
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
// v3.7: daily growth content — self-refilling FB Page queue (public domain)
//   + FB Group paste-ready content in KV (private domain, semi-auto since
//   Meta closed the Groups API). Both drive traffic to LINE.
// ─────────────────────────────────────────────────────────────────────────

const FB_POSTER = '3q-campaign-poster-bowl-1080x1040.png';

function dailyFbCaption() {
  return [
    '今天的霸王餐與免費做圖，留給願意被看見的小店。',
    '',
    '你的店、你的產品，值得一張像樣的照片。',
    '想參加今天的抽選，在留言處告訴我們「+1」，我們私訊你。',
    '',
    '— 3Q 台灣在地品牌孵化所',
  ].join('\n');
}

function dailyGroupContent(joinUrl) {
  return [
    '【今日霸王餐 / 免費做圖】',
    '',
    '每天我們送一份霸王餐、一張免費做圖，給社團裡的小店。',
    '想抽就在下面留「+1」，晚上 8 點開獎，得主把好東西分享出去就能領。',
    '',
    '想直接拿你的專屬引薦連結（朋友完成諮詢，兩邊都有禮遇）：',
    joinUrl,
  ].join('\n');
}

async function seedDailyContent(env) {
  if (!env.CRM) return { ok: false, error: 'D1 not bound' };
  const today = new Date().toISOString().slice(0, 10);
  const joinUrl = env.LINE_JOIN_URL || 'https://lin.ee/UKKodJj';
  const base = env.PNG_BASE_URL || '';

  // 1) FB Page — ensure one post exists for today (self-accumulating queue)
  const fbToday = await env.CRM.prepare(
    "SELECT COUNT(*) AS n FROM content_queue WHERE platform='facebook' AND created_at >= ?"
  ).bind(today).first();
  let seeded = false;
  if ((fbToday?.n || 0) === 0) {
    await env.CRM.prepare(
      "INSERT INTO content_queue (platform, image_url, caption, link_url, status, source_oa) VALUES ('facebook', ?, ?, ?, 'pending', '3q-hatchery')"
    ).bind(base ? `${base}/${FB_POSTER}` : null, dailyFbCaption(), joinUrl).run();
    seeded = true;
  }

  // 2) FB Group — store paste-ready content in KV for one-tap admin posting
  if (env.SESSION) {
    const content = dailyGroupContent(joinUrl);
    await env.SESSION.put('fbgroup:today', JSON.stringify({ date: today, content }), { expirationTtl: 60 * 60 * 48 });
  }

  return { ok: true, date: today, fbPageSeeded: seeded };
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
    // Each stage is isolated: a seed failure must NEVER block the publish loop
    // (2026-06-06 incident: seed INSERT hit missing column → whole chain died silently).
    ctx.waitUntil((async () => {
      try {
        const r = await seedDailyContent(env);
        console.log('[social-publisher] seeded:', JSON.stringify(r));
      } catch (err) {
        console.error('[social-publisher] seed failed (non-fatal):', err.message);
      }
      try {
        const r = await runPublishLoop(env);
        console.log('[social-publisher] done:', JSON.stringify(r));
      } catch (err) {
        console.error('[social-publisher] publish loop error:', err.message);
      }
      await refreshTokensIfNeeded(env).catch(err => console.error('[social-publisher] refresh error:', err.message));
    })());
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const CORS = {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    };
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

    // CORS preflight (browser calls from the scheduler page send Authorization header)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // Shared auth check: Bearer header or ?token= query param
    const requireToken = () => {
      const auth = request.headers.get('Authorization') || '';
      const tok  = auth.startsWith('Bearer ') ? auth.slice(7) : url.searchParams.get('token');
      return tokensMatch(tok, env.TRIGGER_TOKEN);
    };

    // Health check
    if (url.pathname === '/health') {
      const [threadsToken, igToken, fbToken] = await Promise.all([
        getToken('threads', 'THREADS_ACCESS_TOKEN', env),
        getToken('ig', 'IG_ACCESS_TOKEN', env),
        getToken('fb', 'FB_PAGE_ACCESS_TOKEN', env),
      ]);
      return json({
        ok: true,
        worker: '3q-social-publisher',
        version: '2.1',
        platforms: Object.keys(DAILY_LIMITS),
        configured: {
          threads:    Boolean(threadsToken),
          instagram:  Boolean(igToken),
          facebook:   Boolean(fbToken && env.FB_PAGE_ID),
          tiktok:     Boolean(env.TIKTOK_ACCESS_TOKEN),
          google_biz: Boolean(env.GOOGLE_SERVICE_ACCOUNT && env.GOOGLE_LOCATION_NAME),
          crm_d1:     Boolean(env.CRM),
          ai:         Boolean(env.AI),
          auto_refresh: Boolean(env.THREADS_APP_SECRET && env.THREADS_APP_ID),
        },
      });
    }

    // Add posts to the content queue: POST /queue/add (TRIGGER_TOKEN protected)
    // Body: single post object, bare array, or { posts: [...] }
    // Fields: platform (required), caption | caption_seed (one required),
    //         image_url, topic_tag, link_url, scheduled_at, source_oa
    if (url.pathname === '/queue/add' && request.method === 'POST') {
      if (!requireToken()) return new Response('forbidden', { status: 403 });
      if (!env.CRM) return json({ ok: false, error: 'D1 not bound' }, 500);
      const body = await request.json().catch(() => null);
      if (!body) return json({ ok: false, error: 'invalid JSON body' }, 400);
      const items = Array.isArray(body) ? body : Array.isArray(body.posts) ? body.posts : [body];
      const ids = [], errors = [];
      for (let i = 0; i < items.length; i++) {
        const p = items[i] || {};
        if (!PLATFORM_FNS[p.platform]) { errors.push({ index: i, error: `unknown platform: ${p.platform}` }); continue; }
        if (!p.caption && !p.caption_seed) { errors.push({ index: i, error: 'caption or caption_seed required' }); continue; }
        try {
          const r = await env.CRM.prepare(
            "INSERT INTO content_queue (platform, image_url, caption_seed, caption, topic_tag, link_url, scheduled_at, status, source_oa) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)"
          ).bind(
            p.platform, p.image_url || null, p.caption_seed || null, p.caption || null,
            p.topic_tag || null, p.link_url || null, p.scheduled_at || null, p.source_oa || '3q-hatchery'
          ).run();
          ids.push(r.meta?.last_row_id ?? null);
        } catch (err) {
          errors.push({ index: i, error: err.message });
        }
      }
      const status = ids.length === 0 && errors.length > 0 ? 400 : 200;
      return json({ ok: errors.length === 0, added: ids.length, ids, errors }, status);
    }

    // Queue overview: GET /queue/list (TRIGGER_TOKEN protected)
    // Scheduler page contract: { rows: [{id, platform, preview, scheduled_at, status, error_msg}] }
    if ((url.pathname === '/queue/list' || url.pathname === '/queue') && request.method === 'GET') {
      if (!requireToken()) return new Response('forbidden', { status: 403 });
      if (!env.CRM) return json({ ok: false, error: 'D1 not bound' }, 500);
      const [rows, counts] = await Promise.all([
        env.CRM.prepare("SELECT id, platform, substr(COALESCE(caption, caption_seed), 1, 60) AS preview, scheduled_at, status, error_msg FROM content_queue ORDER BY id DESC LIMIT 50").all(),
        env.CRM.prepare('SELECT platform, status, COUNT(*) AS n FROM content_queue GROUP BY platform, status ORDER BY platform').all(),
      ]);
      return json({ ok: true, rows: rows.results, counts: counts.results });
    }

    // Delete a queued item: POST /queue/del?id=N (TRIGGER_TOKEN protected)
    // Only pending/failed can be deleted — published rows feed the daily-limit count.
    if (url.pathname === '/queue/del' && request.method === 'POST') {
      if (!requireToken()) return new Response('forbidden', { status: 403 });
      if (!env.CRM) return json({ ok: false, error: 'D1 not bound' }, 500);
      const id = Number(url.searchParams.get('id'));
      if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: 'valid id required' }, 400);
      const r = await env.CRM.prepare(
        "DELETE FROM content_queue WHERE id = ? AND status IN ('pending','failed')"
      ).bind(id).run();
      const deleted = r.meta?.changes ?? 0;
      return json({ ok: deleted > 0, deleted, ...(deleted === 0 ? { error: 'not found or already published' } : {}) });
    }

    // FB Group semi-auto: GET /fbgroup/today — paste-ready content for the admin
    // (Meta closed the Groups API; this is the one-tap-copy fallback).
    if (url.pathname === '/fbgroup/today') {
      let payload = null;
      if (env.SESSION) {
        const raw = await env.SESSION.get('fbgroup:today');
        if (!raw) { await seedDailyContent(env); }
        const fresh = await env.SESSION.get('fbgroup:today');
        payload = fresh ? JSON.parse(fresh) : null;
      }
      if (url.searchParams.get('format') === 'text') {
        return new Response(payload?.content || '', { headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS } });
      }
      return json(payload || { ok: false, error: 'no content' });
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

    return json({ service: '3q-social-publisher', ok: true, version: '2.1' });
  },
};
