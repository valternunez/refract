// Generates docs/hero.png — a side-by-side triptych of the demo site at mobile,
// tablet, and desktop, rendered by Refract itself. Regenerate with:
//   node scripts/gen-hero.mjs
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { render } from '@refract/core';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const demo = pathToFileURL(join(root, 'examples/demo-site/index.html')).href;
const outPng = join(root, 'docs/hero.png');

const H = 560; // uniform screenshot height
const LABEL_H = 44;
const GAP = 28;
const PAD = 36;
const BG = { r: 11, g: 16, b: 32 };

const tmp = await mkdtemp(join(tmpdir(), 'refract-hero-'));
try {
  const shots = await render({
    url: demo,
    viewports: ['mobile', 'tablet', 'desktop'],
    out: tmp,
    freeze: true,
    dpr: 1,
  });

  const composites = [];
  let x = PAD;
  for (const shot of shots) {
    const img = await sharp(shot.savedPath).resize({ height: H }).png().toBuffer();
    const { width = 0 } = await sharp(img).metadata();
    const label = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${LABEL_H}">
      <text x="2" y="30" fill="#e2e8f0" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="22" font-weight="700">${shot.preset} · ${shot.width}×${shot.height}</text>
    </svg>`;
    composites.push({ input: Buffer.from(label), left: Math.round(x), top: PAD });
    composites.push({ input: img, left: Math.round(x), top: PAD + LABEL_H });
    x += width + GAP;
  }

  const totalW = Math.round(x - GAP + PAD);
  const totalH = PAD * 2 + LABEL_H + H;
  await sharp({ create: { width: totalW, height: totalH, channels: 3, background: BG } })
    .composite(composites)
    .png()
    .toFile(outPng);

  console.log(`hero → ${outPng} (${totalW}×${totalH})`);
} finally {
  await rm(tmp, { recursive: true, force: true });
}
