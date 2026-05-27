// 3Q Hatchery — Social Publisher Worker v1.0
// Auto-posts to Threads, Instagram, TikTok, Google Business Profile
// Cron schedule (Taipei time):
//   01:00 UTC = 09:00 TW (weekday morning — best engagement)
//   04:00 UTC = 12:00 TW (Wednesday lunch peak)
//   12:30 UTC = 20:30 TW (evening light content)
//
// Required secrets (wrangler secret put):
//   THREADS_ACCESS_TOKEN     — Threads API long-lived token
//   THREADS_USER_ID          — Numeric Threads user ID
//   IG_ACCESS_TOKEN          — Instagram Graph API long-lived token
//   IG_USER_ID               — Instagram business account user ID
//   TIKTOK_ACCESS_TOKEN      — TikTok Content Posting API token (optional)
//   GOOGLE_SERVICE_ACCOUNT   — JSON string of Google service account (optional)
//   GOOGLE_LOCATION_NAME     — e.g. accounts/123/locations/456 (optional)
//   TRIGGER_TOKEN            — For manual /publish?token=... HTTP trigger

// ─────────────────────────────────────────────────────────────────────────
// Platform daily limits (to avoid spam signals)
// ─────────────────────────────────────────────────────────────────────────
const DAILY_LIMITS = { threads: 3, instagram: 1, tiktok: 1, google_biz: 1 };

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
  if (!env.THREADS_ACCESS_TOKEN || !env.THREADS_USER_ID) {
    return { ok: false, error: 'THREADS_ACCESS_TOKEN or THREADS_USER_ID not set' };
  }

  const userId = env.THREADS_USER_ID;
  const token  = env.THREADS_ACCESS_TOKEN;
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
  if (!env.IG_ACCESS_TOKEN || !env.IG_USER_ID) {
    return { ok: false, error: 'IG_ACCESS_TOKEN or IG_USER_ID not set' };
  }
  if (!post.image_url) {
    return { ok: false, error: 'Instagram requires an image_url' };
  }

  const userId = env.IG_USER_ID;
  const token  = env.IG_ACCESS_TOKEN;
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
// Platform dispatch
// ─────────────────────────────────────────────────────────────────────────

const PLATFORM_FNS = {
  threads:    publishToThreads,
  instagram:  publishToInstagram,
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
      runPublishLoop(env)
        .then(r => console.log('[social-publisher] done:', JSON.stringify(r)))
        .catch(err => console.error('[social-publisher] error:', err.message))
    );
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const CORS = { 'Access-Control-Allow-Origin': '*' };
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

    // Health check
    if (url.pathname === '/health') {
      return json({
        ok: true,
        worker: '3q-social-publisher',
        version: '1.0',
        platforms: Object.keys(DAILY_LIMITS),
        configured: {
          threads:    Boolean(env.THREADS_ACCESS_TOKEN && env.THREADS_USER_ID),
          instagram:  Boolean(env.IG_ACCESS_TOKEN && env.IG_USER_ID),
          tiktok:     Boolean(env.TIKTOK_ACCESS_TOKEN),
          google_biz: Boolean(env.GOOGLE_SERVICE_ACCOUNT && env.GOOGLE_LOCATION_NAME),
          crm_d1:     Boolean(env.CRM),
          ai:         Boolean(env.AI),
        },
      });
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

    return json({ service: '3q-social-publisher', ok: true, version: '1.0' });
  },
};
