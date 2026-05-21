// Render all 8 LINE OA export PNGs via headless Chromium.
// Used by .github/workflows/render-assets.yml. Local invocation:
//   npx http-server -p 8080 .   # in repo root, in another terminal
//   node scripts/render-pngs.mjs

import { chromium } from 'playwright';
import { mkdir, stat, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const BASE = process.env.RENDER_BASE_URL || 'http://localhost:8080/ui_kits/line_oa';
const SOCIAL_BASE = process.env.RENDER_SOCIAL_BASE_URL || 'http://localhost:8080/ui_kits/social';
const OUT = process.env.RENDER_OUT_DIR || 'assets/exports';

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const REACTIONS = ['hot', 'recommend', 'thanks', 'wait', 'got-it', 'i-see', 'cheer', 'excellent', 'later', 'goodnight', 'order', 'seeyou', 'musthave', 'queue', 'hungry', 'empty', 'bold', 'stellar', 'hyper', 'done'];
const LUCKY_BAG_TIMES = ['main', 'morning', 'noon', 'evening', 'night'];

const PAGES = [
  { url: `${BASE}/_avatar-export.html?download=1`,                      file: '3q-avatar-640.png'           },
  { url: `${BASE}/_cover-export.html?download=1&photo=bowl`,            file: '3q-cover-bowl-1080x878.png'  },
  { url: `${BASE}/_richmenu-export.html?download=1`,                    file: '3q-richmenu-2500x1686.png'   },
  { url: `${BASE}/_welcome-card-export.html?download=1`,                file: '3q-welcome-card-1040.png'    },
  { url: `${BASE}/_chat-bg-export.html?download=1`,                     file: '3q-chat-bg-1080x2340.jpg'    },
  { url: `${BASE}/_carousel-export.html?download=1&card=1`,             file: '3q-carousel-01-1040.png'     },
  { url: `${BASE}/_carousel-export.html?download=1&card=2`,             file: '3q-carousel-02-1040.png'     },
  { url: `${BASE}/_carousel-export.html?download=1&card=3`,             file: '3q-carousel-03-1040.png'     },
  { url: `${BASE}/_carousel-export.html?download=1&card=4`,             file: '3q-carousel-04-1040.png'     },
  ...SEASONS.map(s => ({
    url:  `${BASE}/_seasonal-export.html?download=1&season=${s}`,
    file: `3q-seasonal-${s}-1080x878.png`,
  })),
  ...REACTIONS.map(n => ({
    url:  `${BASE}/_reaction-export.html?download=1&name=${n}`,
    file: `3q-reaction-${n}-480.png`,
  })),
  { url: `${BASE}/_campaign-poster-export.html?download=1&photo=bowl`, file: '3q-campaign-poster-1080x1040.png' },
  ...LUCKY_BAG_TIMES.map(t => ({
    url:  `${BASE}/_lucky-bag-export.html?download=1&time=${t}`,
    file: `3q-lucky-bag-${t}-1040.png`,
  })),

  // Social channel exports
  { url: `${SOCIAL_BASE}/_ig-avatar-export.html?download=1`, file: '3q-ig-avatar-1080.png' },
  ...[1,2,3,4].map(n => ({
    url:  `${SOCIAL_BASE}/_ig-feed-export.html?download=1&card=${n}`,
    file: `3q-ig-feed-${String(n).padStart(2,'0')}-1080x1350.png`,
  })),
  ...['00','01','02','03','04','05'].map(id => ({
    url:  `${SOCIAL_BASE}/_ig-highlight-export.html?download=1&id=${id}`,
    file: `3q-ig-highlight-${id}-1080x1920.png`,
  })),
  ...[1,2,3,4].map(n => ({
    url:  `${SOCIAL_BASE}/_threads-post-export.html?download=1&card=${n}`,
    file: `3q-threads-${String(n).padStart(2,'0')}-1080x1350.png`,
  })),
  ...['01','02','03','04'].map(ep => ({
    url:  `${SOCIAL_BASE}/_tiktok-cover-export.html?download=1&ep=${ep}`,
    file: `3q-tiktok-ep${ep}-1080x1920.png`,
  })),
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const manifest = { rendered_at: new Date().toISOString(), files: {} };

try {
  for (const p of PAGES) {
    const ctx = await browser.newContext({
      viewport: { width: 2600, height: 2000 },
      acceptDownloads: true,
    });
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => console.error(`  pageerror on ${p.file}:`, e.message));

    const dlPromise = pg.waitForEvent('download', { timeout: 90000 });
    await pg.goto(p.url, { waitUntil: 'networkidle', timeout: 90000 });
    const dl = await dlPromise;
    const dst = `${OUT}/${p.file}`;
    await dl.saveAs(dst);

    const buf = await readFile(dst);
    const sha = createHash('sha256').update(buf).digest('hex').slice(0, 16);
    const s = await stat(dst);
    manifest.files[p.file] = { bytes: s.size, sha256_16: sha };
    console.log(`OK  ${String(s.size).padStart(8)}B  sha256:${sha}  ${p.file}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

await writeFile(`${OUT}/_render-manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`\nManifest written to ${OUT}/_render-manifest.json`);
