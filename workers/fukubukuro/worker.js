// 3Q Hatchery — daily fukubukuro push worker
// Taipei cron slots: 07:30 / 12:30 / 18:30 / 22:00
// UTC cron:          23:30 /  04:30 / 10:30 / 14:00

const CRON_SLOTS = {
  '30 23 * * *': { label: '晨光福袋', file: '3q-lucky-bag-morning-1040.png' },
  '30 4 * * *':  { label: '午陽福袋', file: '3q-lucky-bag-noon-1040.png' },
  '30 10 * * *': { label: '暮色福袋', file: '3q-lucky-bag-evening-1040.png' },
  '0 14 * * *':  { label: '月光福袋', file: '3q-lucky-bag-night-1040.png' },
};

const HTTP_SLOTS = {
  '0730': { label: '晨光福袋', file: '3q-lucky-bag-morning-1040.png' },
  '1230': { label: '午陽福袋', file: '3q-lucky-bag-noon-1040.png' },
  '1830': { label: '暮色福袋', file: '3q-lucky-bag-evening-1040.png' },
  '2200': { label: '月光福袋', file: '3q-lucky-bag-night-1040.png' },
};

async function pushFukubukuro(env, file, label) {
  const imageUrl = `${env.PNG_BASE_URL}/${file}`;
  const body = {
    to: env.OWNER_LINE_USER_ID,
    messages: [
      {
        type: 'image',
        originalContentUrl: imageUrl,
        previewImageUrl: imageUrl,
      },
    ],
  };
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LINE push failed ${res.status}: ${text}`);
  }
  return label;
}

export default {
  async scheduled(controller, env, ctx) {
    const slot = CRON_SLOTS[controller.cron];
    if (!slot) {
      console.error('Unknown cron expression:', controller.cron);
      return;
    }
    ctx.waitUntil(
      pushFukubukuro(env, slot.file, slot.label)
        .then(label => console.log(`[fukubukuro] pushed: ${label}`))
        .catch(err => console.error('[fukubukuro] error:', err.message))
    );
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    // Manual trigger: GET /push?slot=0730|1230|1830|2200&token=TRIGGER_TOKEN
    if (url.pathname === '/push') {
      if (url.searchParams.get('token') !== env.TRIGGER_TOKEN) {
        return new Response('Unauthorized', { status: 401 });
      }
      const slotKey = url.searchParams.get('slot');
      const entry = HTTP_SLOTS[slotKey];
      if (!entry) {
        return new Response('Unknown slot. Use slot=0730|1230|1830|2200', { status: 400 });
      }
      try {
        const label = await pushFukubukuro(env, entry.file, entry.label);
        return new Response(JSON.stringify({ ok: true, pushed: label }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({ ok: true, worker: '3q-fukubukuro-push', slots: Object.keys(HTTP_SLOTS) }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('3q-fukubukuro-push worker', { status: 200 });
  },
};
