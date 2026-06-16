// 3Q Hatchery — Social Publisher Worker v2.6
// Auto-posts to Threads, Instagram, Facebook Page, TikTok, Google Business Profile
// Tokens stored in SESSION KV and auto-refreshed every 50 days — no manual renewal.
//
// v2.6 (2026-06-17):
//   - /queue/list gains filters, status counts, overdue counts, and a read-only
//     dashboard at /queue/dashboard so queue state no longer depends on Actions logs.
//   - /queue/add skipped rows include reason + duplicate fields.
//
// v2.5 (2026-06-17):
//   - /queue/add 去重納入 link_url + scheduled_at，允許同文不同日期/UTM 的
//     30 天 campaign feed 正常排入，仍防止完全相同 pending row 雙投。
//
// v2.3 (2026-06-12):
//   - /queue/add 去重:platform+caption+seed+image 與 pending 列完全相同 → skip
//     (6/1 雙跑 seed 造成 q40-46 / q48-54 同文重發風險)
//   - 每日 FB seed 防堆積:已有相同 caption 的 pending 列就不再 seed
//     (積壓期間 NULL 排程被餓死,舊邏輯每天疊一份,id 87-89 事故)
//   - getToken 接受 fb-token-setup 寫入的 token:fb:page_token 鍵名
//   - IG token 續期改用 fb_exchange_token grant;KV 缺 expires 鍵時立即補刷
//     (舊邏輯 th_refresh_token 打 graph.facebook.com 必 400,IG 從未真正續期)
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
  // fb-token-setup.yml writes "token:fb:page_token" (not "access") — accept both,
  // otherwise FB silently depends on the env secret alone. Added in v2.3.
  const suffixes = key.endsWith('_ACCESS_TOKEN') ? ['access']
                 : key.endsWith('_USER_ID')      ? ['user_id']
                 : [key.toLowerCase()];
  if (platform === 'fb' && key === 'FB_PAGE_ACCESS_TOKEN') suffixes.push('page_token');
  for (const suffix of suffixes) {
    const kvVal = await env.SESSION.get(`token:${platform}:${suffix}`);
    if (kvVal) return kvVal;
  }
  return env[key] || null;
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

  // Threads refreshes with th_refresh_token on graph.threads.net; FB/IG long-lived
  // tokens use the fb_exchange_token grant on graph.facebook.com — th_refresh_token
  // there always 400'd, so IG auto-refresh never actually worked before v2.3.
  const url = platform === 'threads'
    ? `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${currentToken}`
    : `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${currentToken}`;
  const resp = await fetch(url);
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
    const access = await env.SESSION.get(`token:${platform}:access`);
    if (!access) continue; // platform not connected yet
    const expires = await env.SESSION.get(`token:${platform}:expires`);
    // No expires key = token imported outside the OAuth flow (e.g. fb-token-setup
    // wrote access without expires) — refresh now so a real expiry lands in KV,
    // instead of skipping forever and letting the token die at day 60.
    if (expires && new Date(expires).getTime() - Date.now() >= tenDays) continue;
    console.log(`[social-publisher] refreshing ${platform} token`);
    await refreshMetaToken(platform, env).catch(e => console.error(`refresh ${platform} failed:`, e.message));
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
    const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
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
  // 2026-06-07 fix: comment API needs pages_manage_engagement (token may lack it)
  // → on failure, FALL BACK to editing the post and appending the link to the
  //   caption (uses pages_manage_posts, which we definitely have). A slightly
  //   penalised reach with a link beats full reach with no funnel.
  async function firstComment(objectId) {
    if (!post.link_url || !objectId) return;
    try {
      const r = await fetch(`https://graph.facebook.com/v21.0/${objectId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `免費診斷+AI 接待:${post.link_url}`, access_token: token }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.id) return; // comment landed
      console.error('[fb] first comment rejected:', JSON.stringify(d.error || d));
    } catch (e) { console.error('[fb] first comment failed:', e.message); }
    // Fallback: append link to the post body via edit
    try {
      const newMsg = `${post.caption || ''}\n\n— 免費診斷+AI 接待 —\n${post.link_url}`;
      const r2 = await fetch(`https://graph.facebook.com/v21.0/${objectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMsg, access_token: token }),
      });
      const d2 = await r2.json().catch(() => ({}));
      console.log('[fb] link appended via edit:', r2.ok, JSON.stringify(d2).slice(0, 120));
    } catch (e) { console.error('[fb] edit fallback failed:', e.message); }
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
  // v2.3: also skip while an identical daily post is still pending — during a
  // backlog the COALESCE ordering starves NULL-scheduled rows, and the old
  // created_at-only check stacked one duplicate per day (id 87-89 incident).
  const fbPendingDaily = await env.CRM.prepare(
    "SELECT COUNT(*) AS n FROM content_queue WHERE platform='facebook' AND status='pending' AND caption = ?"
  ).bind(dailyFbCaption()).first();
  const fbToday = await env.CRM.prepare(
    "SELECT COUNT(*) AS n FROM content_queue WHERE platform='facebook' AND created_at >= ?"
  ).bind(today).first();
  let seeded = false;
  if ((fbPendingDaily?.n || 0) === 0 && (fbToday?.n || 0) === 0) {
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
    // 2026-06-11 fix: SQLite ASC 排序 NULL 排最前,每日 seed 的 NULL 列永遠插隊,
    // 餓死所有帶 scheduled_at 的排程貼文(6/3 起全部卡 pending)。
    // 改用 COALESCE 把 NULL 視為「現在」:過期排程貼文(越早越優先)先發。
    const post = await env.CRM.prepare(
      "SELECT * FROM content_queue WHERE platform = ? AND status = 'pending' AND (scheduled_at IS NULL OR scheduled_at <= ?) ORDER BY COALESCE(scheduled_at, ?) ASC, id ASC LIMIT 1"
    ).bind(platform, nowIso, nowIso).first();

    if (!post) {
      results.push({ platform, skipped: true, reason: 'no pending posts' });
      continue;
    }

    let outcome;
    try {
      outcome = await publishPost(post, env);
    } catch (err) {
      outcome = { ok: false, error: `exception: ${err.message}` }; // 2026-06-11: 單篇例外不殺整輪
    }

    if (outcome.ok) {
      await env.CRM.prepare(
        "UPDATE content_queue SET status = 'published', published_at = ?, platform_post_id = ?, error_msg = NULL WHERE id = ?"
      ).bind(nowIso, outcome.platform_id || null, post.id).run();
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

function clampLimit(value, fallback = 100, max = 500) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function bindQuery(stmt, values) {
  return values.length ? stmt.bind(...values) : stmt;
}

async function queueSnapshot(env, url) {
  const limit = clampLimit(url.searchParams.get('limit'), 100, 500);
  const platform = url.searchParams.get('platform');
  const status = url.searchParams.get('status');
  const source = url.searchParams.get('source_oa');
  const nowIso = new Date().toISOString();
  const where = [];
  const binds = [];
  if (platform) { where.push('platform = ?'); binds.push(platform); }
  if (status) { where.push('status = ?'); binds.push(status); }
  if (source) { where.push('source_oa = ?'); binds.push(source); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rowStmt = env.CRM.prepare(
      `SELECT id, platform, substr(COALESCE(caption, caption_seed), 1, 80) AS preview,
              link_url, scheduled_at, status, source_oa, error_msg, created_at, published_at
       FROM content_queue ${whereSql}
       ORDER BY id DESC LIMIT ?`
    );
  const countStmt = env.CRM.prepare(
      `SELECT platform, status, COUNT(*) AS n
       FROM content_queue ${whereSql}
       GROUP BY platform, status
       ORDER BY platform, status`
    );

  const [rows, counts, overdue] = await Promise.all([
    rowStmt.bind(...binds, limit).all(),
    bindQuery(countStmt, binds).all(),
    env.CRM.prepare(
      `SELECT platform, COUNT(*) AS n
       FROM content_queue
       WHERE status='pending' AND scheduled_at IS NOT NULL AND scheduled_at <= ?
       GROUP BY platform
       ORDER BY platform`
    ).bind(nowIso).all(),
  ]);

  return {
    ok: true,
    generated_at: nowIso,
    filters: { platform: platform || null, status: status || null, source_oa: source || null, limit },
    rows: rows.results,
    counts: counts.results,
    overdue: overdue.results,
  };
}

function queueDashboardHtml() {
  return `<!doctype html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>3Q Social Queue</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:24px;background:#0f1115;color:#e8eaed}
input,select,button{background:#171b22;color:#e8eaed;border:1px solid #3a414d;border-radius:6px;padding:8px}
button{cursor:pointer}
.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:16px}
.card{border:1px solid #2b313a;border-radius:8px;padding:12px;margin:12px 0;background:#151922}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border-bottom:1px solid #2b313a;padding:8px;text-align:left;vertical-align:top}
th{color:#aab2bf}
.err{color:#ff8b8b}.muted{color:#9aa4b2}code{color:#ffd479}
</style>
</head>
<body>
<h1>3Q Social Queue</h1>
<div class="bar">
  <label>Token<br><input id="token" type="password" autocomplete="off" placeholder="TRIGGER_TOKEN"></label>
  <label>Platform<br><select id="platform"><option value="">all</option><option>facebook</option><option>instagram</option><option>threads</option><option>tiktok</option><option>google_biz</option></select></label>
  <label>Status<br><select id="status"><option value="">all</option><option>pending</option><option>published</option><option>failed</option></select></label>
  <label>Limit<br><input id="limit" type="number" min="1" max="500" value="100"></label>
  <button id="load">Load</button>
</div>
<div id="out" class="card muted">Enter token and load queue.</div>
<script>
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
document.getElementById('load').onclick = async () => {
  const token = document.getElementById('token').value;
  const qs = new URLSearchParams({
    format: 'json',
    limit: document.getElementById('limit').value || '100',
  });
  for (const id of ['platform','status']) {
    const v = document.getElementById(id).value;
    if (v) qs.set(id, v);
  }
  const res = await fetch('/queue/list?' + qs, { headers: { Authorization: 'Bearer ' + token } });
  const data = await res.json().catch(() => ({ ok:false, error:'invalid JSON response' }));
  if (!res.ok || !data.ok) {
    document.getElementById('out').innerHTML = '<span class="err">' + esc(data.error || res.status) + '</span>';
    return;
  }
  const counts = data.counts.map(c => '<code>' + esc(c.platform + '/' + c.status + '=' + c.n) + '</code>').join(' ');
  const overdue = data.overdue.length ? data.overdue.map(c => '<code>' + esc(c.platform + '=' + c.n) + '</code>').join(' ') : '<span class="muted">none</span>';
  const rows = data.rows.map(r => '<tr><td>'+r.id+'</td><td>'+esc(r.platform)+'</td><td>'+esc(r.status)+'</td><td>'+esc(r.scheduled_at || '')+'</td><td>'+esc(r.preview)+'</td><td>'+esc(r.source_oa || '')+'</td><td>'+esc(r.error_msg || '')+'</td></tr>').join('');
  document.getElementById('out').innerHTML = '<p>Generated: '+esc(data.generated_at)+'</p><p>Counts: '+counts+'</p><p>Overdue pending: '+overdue+'</p><table><thead><tr><th>ID</th><th>Platform</th><th>Status</th><th>Scheduled</th><th>Preview</th><th>Source</th><th>Error</th></tr></thead><tbody>'+rows+'</tbody></table>';
};
</script>
</body>
</html>`;
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
        version: '2.6',
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
      const ids = [], errors = [], skipped = [];
      for (let i = 0; i < items.length; i++) {
        const p = items[i] || {};
        if (!PLATFORM_FNS[p.platform]) { errors.push({ index: i, error: `unknown platform: ${p.platform}` }); continue; }
        if (!p.caption && !p.caption_seed) { errors.push({ index: i, error: 'caption or caption_seed required' }); continue; }
        try {
          // v2.5 dedup: only skip a truly identical pending row. Campaign feeds may
          // reuse a caption across different days or UTM links; those are distinct
          // scheduled posts and must not collapse into one pending row.
          const dup = await env.CRM.prepare(
            "SELECT id FROM content_queue WHERE status='pending' AND platform=? AND COALESCE(caption,'')=COALESCE(?,'') AND COALESCE(caption_seed,'')=COALESCE(?,'') AND COALESCE(image_url,'')=COALESCE(?,'') AND COALESCE(link_url,'')=COALESCE(?,'') AND COALESCE(scheduled_at,'')=COALESCE(?,'') LIMIT 1"
          ).bind(
            p.platform,
            p.caption || null,
            p.caption_seed || null,
            p.image_url || null,
            p.link_url || null,
            p.scheduled_at || null,
          ).first();
          if (dup) {
            skipped.push({
              index: i,
              reason: 'duplicate_pending_row',
              duplicate_of: dup.id,
              duplicate_fields: ['platform', 'caption', 'caption_seed', 'image_url', 'link_url', 'scheduled_at'],
            });
            continue;
          }
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
      return json({ ok: errors.length === 0, added: ids.length, ids, skipped, errors }, status);
    }

    // Queue overview: GET /queue/list (TRIGGER_TOKEN protected)
    // Scheduler page contract: { rows, counts, overdue, filters }
    if ((url.pathname === '/queue/list' || url.pathname === '/queue') && request.method === 'GET') {
      if (!requireToken()) return new Response('forbidden', { status: 403 });
      if (!env.CRM) return json({ ok: false, error: 'D1 not bound' }, 500);
      return json(await queueSnapshot(env, url));
    }

    // Read-only dashboard shell. Data still requires TRIGGER_TOKEN in the UI,
    // sent as an Authorization header instead of a query string.
    if (url.pathname === '/queue/dashboard' && request.method === 'GET') {
      return new Response(queueDashboardHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS } });
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

    // One-shot repair: POST /admin/backfill-links (TRIGGER_TOKEN protected)
    // Finds recent FB posts that match published queue rows whose link never
    // landed (comment was silently rejected), and appends the link via edit.
    if (url.pathname === '/admin/backfill-links' && request.method === 'POST') {
      if (!requireToken()) return new Response('forbidden', { status: 403 });
      if (!env.CRM) return json({ ok: false, error: 'D1 not bound' }, 500);
      const token = await getToken('fb', 'FB_PAGE_ACCESS_TOKEN', env);
      const pageId = env.FB_PAGE_ID;
      if (!token || !pageId) return json({ ok: false, error: 'FB token/page not configured' }, 500);

      const postsResp = await fetch(`https://graph.facebook.com/v21.0/${pageId}/posts?fields=id,message&limit=15&access_token=${token}`);
      const postsData = await postsResp.json().catch(() => ({}));
      if (!postsResp.ok) return json({ ok: false, error: postsData.error?.message || 'posts fetch failed' }, 502);
      const fbPosts = postsData.data || [];

      const rows = await env.CRM.prepare(
        "SELECT id, caption, link_url, platform_post_id FROM content_queue WHERE platform='facebook' AND status='published' AND link_url IS NOT NULL ORDER BY id DESC LIMIT 15"
      ).all();

      const results = [];
      for (const row of rows.results || []) {
        const head = (row.caption || '').slice(0, 18);
        if (!head) { results.push({ id: row.id, skipped: 'no caption' }); continue; }
        const match = fbPosts.find(p => (p.message || '').startsWith(head));
        if (!match) { results.push({ id: row.id, skipped: 'no matching fb post' }); continue; }
        if ((match.message || '').includes(row.link_url)) {
          results.push({ id: row.id, ok: true, already: true });
          continue;
        }
        // try comment first
        let done = false;
        try {
          const c = await fetch(`https://graph.facebook.com/v21.0/${match.id}/comments`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `免費診斷+AI 接待:${row.link_url}`, access_token: token }),
          });
          const cd = await c.json().catch(() => ({}));
          if (c.ok && cd.id) done = 'comment';
        } catch (_) {}
        if (!done) {
          const e = await fetch(`https://graph.facebook.com/v21.0/${match.id}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `${row.caption}\n\n— 免費診斷+AI 接待 —\n${row.link_url}`, access_token: token }),
          });
          const ed = await e.json().catch(() => ({}));
          done = (e.ok && (ed.success === true || ed.id)) ? 'edit' : false;
          if (!done) { results.push({ id: row.id, failed: ed.error?.message || 'edit failed' }); continue; }
        }
        await env.CRM.prepare('UPDATE content_queue SET platform_post_id = ? WHERE id = ?').bind(match.id, row.id).run();
        results.push({ id: row.id, ok: true, via: done, fb: match.id });
      }
      return json({ ok: true, results });
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

    return json({ service: '3q-social-publisher', ok: true, version: '2.3' });
  },
};
