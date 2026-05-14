// Render all 8 LINE OA export PNGs via headless Chromium.
// Used by .github/workflows/render-assets.yml. Local invocation:
//   npx http-server -p 8080 .   # in repo root, in another terminal
//   node scripts/render-pngs.mjs

import { chromium } from 'playwright';
import { mkdir, stat, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const BASE = process.env.RENDER_BASE_URL || 'http://localhost:8080/ui_kits/line_oa';
const OUT = process.env.RENDER_OUT_DIR || 'assets/exports';

const PAGES = [
  { url: `${BASE}/_avatar-export.html?download=1`,                      file: '3q-avatar-640.png'           },
  { url: `${BASE}/_cover-export.html?download=1&photo=bowl`,            file: '3q-cover-bowl-1080x878.png'  },
  { url: `${BASE}/_richmenu-export.html?download=1`,                    file: '3q-richmenu-2500x1686.png'   },
  { url: `${BASE}/_welcome-card-export.html?download=1`,                file: '3q-welcome-card-1040.png'    },
  { url: `${BASE}/_carousel-export.html?download=1&card=1`,             file: '3q-carousel-01-1040.png'     },
  { url: `${BASE}/_carousel-export.html?download=1&card=2`,             file: '3q-carousel-02-1040.png'     },
  { url: `${BASE}/_carousel-export.html?download=1&card=3`,             file: '3q-carousel-03-1040.png'     },
  { url: `${BASE}/_carousel-export.html?download=1&card=4`,             file: '3q-carousel-04-1040.png'     },
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
