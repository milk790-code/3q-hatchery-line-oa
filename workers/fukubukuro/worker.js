// 3Q Hatchery — daily fukubukuro push worker
// Taipei cron slots: 07:30 / 12:30 / 18:30 / 22:00
// UTC cron:          23:30 /  04:30 / 10:30 / 14:00

const SLOTS = {
  '30 23 * * *': { label: '晨光福袋', file: '01_0730.png' },
  '30 4 * * *':  { label: '午陽福袋', file: '02_1230.png' },
  '30 10 * * *': { label: '暮色福袋', file: '03_1830.png' },
  '0 14 * * *':  { label: '月光福袋', file: '04_2200.png' },
};

async function pushFukubukuro(env, file, label) {
  const imageUrl = `${env.PNG_BASE_URL}/fukubukuro/${file}`;
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
    const slot = SLOTS[controller.cron];
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
    // Manual trigger: GET /push?slot=0730|1230|1830|2200&token=SECRET
    if (url.pathname === '/push') {
      if (url.searchParams.get('token') !== env.TRIGGER_TOKEN) {
        return new Response('Unauthorized', { status: 401 });
      }
      const slotKey = url.searchParams.get('slot');
      const entry = Object.values(SLOTS).find(s => s.file.startsWith(`0${['0730','1230','1830','2200'].indexOf(slotKey) + 1}_`));
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
      return new Response(JSON.stringify({ ok: true, worker: '3q-fukubukuro-push', slots: Object.keys(SLOTS) }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('3q-fukubukuro-push worker', { status: 200 });
  },
};
