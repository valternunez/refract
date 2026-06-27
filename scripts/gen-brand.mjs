// Generates the brand raster assets from docs/icon.svg:
//   docs/social-preview.png  (1280×640, for the GitHub repo "social preview")
//   docs/favicon.png         (256×256, transparent)
// Regenerate with:  node scripts/gen-brand.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const icon = readFileSync(join(root, 'docs/icon.svg'));

const W = 1280;
const H = 640;
const sans = 'Segoe UI, Arial, sans-serif';
const mono = 'Consolas, DejaVu Sans Mono, monospace';
const X = 560; // left edge of the text column

const card = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="spectrum" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ef4444"/><stop offset="0.2" stop-color="#f97316"/>
      <stop offset="0.4" stop-color="#eab308"/><stop offset="0.6" stop-color="#22c55e"/>
      <stop offset="0.8" stop-color="#3b82f6"/><stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.25" cy="0.5" r="0.4">
      <stop offset="0" stop-color="#6366f1" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#6366f1" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0b1020"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <text x="${X}" y="300" font-family="${sans}" font-size="120" font-weight="800" fill="#f8fafc">Refract</text>
  <rect x="${X + 4}" y="324" width="316" height="8" rx="4" fill="url(#spectrum)"/>
  <text x="${X}" y="392" font-family="${sans}" font-size="38" fill="#94a3b8">Agent-first responsive screenshots</text>
  <text x="${X}" y="452" font-family="${mono}" font-size="30" fill="#818cf8">npx @getrefractjs/cli https://your.app</text>
</svg>`;

const mark = await sharp(icon).resize(400, 400).png().toBuffer();

await sharp(Buffer.from(card))
  .composite([{ input: mark, left: 110, top: 120 }])
  .png()
  .toFile(join(root, 'docs/social-preview.png'));

await sharp(icon).resize(256, 256).png().toFile(join(root, 'docs/favicon.png'));

console.log('brand → docs/social-preview.png (1280×640), docs/favicon.png (256×256)');
