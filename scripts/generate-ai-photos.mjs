// Generate AI photography via Cloudflare Workers AI (SDXL).
// Reads scripts/ai-prompts.json, generates each image, resizes to target_size with sharp.
// Runs in GitHub Actions (so network access works); save outputs to assets/photography/ai/.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import sharp from 'sharp';

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const TOKEN      = process.env.CF_API_TOKEN;
const OUT_DIR    = process.env.OUT_DIR || 'assets/photography/ai';
const MODEL      = process.env.CF_MODEL || '@cf/stabilityai/stable-diffusion-xl-base-1.0';
const NEGATIVE   = 'text, watermark, signature, logo, harsh flash, blurry, low quality, deformed, distorted, ugly, oversaturated, neon colors';

if (!ACCOUNT_ID || !TOKEN) {
  console.error('Missing CF_ACCOUNT_ID or CF_API_TOKEN');
  process.exit(1);
}

const prompts = JSON.parse(await readFile('scripts/ai-prompts.json', 'utf8'));
await mkdir(OUT_DIR, { recursive: true });

const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;

async function generateOne(p) {
  const [genW, genH] = p.gen_size.split('x').map(Number);
  const [tgtW, tgtH] = p.target_size.split('x').map(Number);

  const body = {
    prompt: p.prompt,
    width: genW,
    height: genH,
    num_steps: 20,
    negative_prompt: NEGATIVE,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status} (${ct}): ${errText.slice(0, 300)}`);
  }

  let buf;
  if (ct.includes('application/json')) {
    // FLUX and some newer models return JSON with base64
    const j = await res.json();
    const b64 = j.result?.image || j.image || j.result?.data || j.data;
    if (!b64) throw new Error(`JSON response missing image field: ${JSON.stringify(j).slice(0, 200)}`);
    buf = Buffer.from(b64, 'base64');
  } else {
    // Binary PNG (SDXL classic)
    buf = Buffer.from(await res.arrayBuffer());
  }

  if (buf.length < 100) throw new Error(`Output too small (${buf.length} bytes)`);

  const resized = await sharp(buf)
    .resize(tgtW, tgtH, { fit: 'cover', position: 'center' })
    .png({ quality: 92, compressionLevel: 9 })
    .toBuffer();

  await writeFile(`${OUT_DIR}/${p.file}`, resized);
  return resized.length;
}

const results = [];
for (let i = 0; i < prompts.length; i++) {
  const p = prompts[i];
  const label = `[${i + 1}/${prompts.length}] ${p.file}`;
  try {
    const start = Date.now();
    const bytes = await generateOne(p);
    const sec = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✓ ${label} → ${bytes} bytes in ${sec}s`);
    results.push({ file: p.file, bytes, ok: true });
  } catch (e) {
    console.error(`✗ ${label} → ${e.message}`);
    results.push({ file: p.file, error: e.message, ok: false });
  }
  // Small delay to avoid rate-limit
  await new Promise(r => setTimeout(r, 1000));
}

await writeFile(`${OUT_DIR}/_manifest.json`, JSON.stringify({
  generated_at: new Date().toISOString(),
  model: MODEL,
  results,
}, null, 2));

const failed = results.filter(r => !r.ok);
console.log(`\n=== Done: ${results.length - failed.length}/${results.length} succeeded ===`);
if (failed.length) {
  console.error('Failures:');
  for (const f of failed) console.error(`  - ${f.file}: ${f.error}`);
  // Don't exit 1 — let the workflow commit the manifest with errors
}

