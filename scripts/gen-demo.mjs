// Generates docs/demo.gif — a synthesized terminal recording of `refract <url>`
// with its findings output appearing line by line. Regenerate with:
//   node scripts/gen-demo.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import gifenc from 'gifenc';
import sharp from 'sharp';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const root = fileURLToPath(new URL('..', import.meta.url));
const outGif = join(root, 'docs/demo.gif');

const W = 860;
const H = 470;
const TOP = 40;
const PAD_X = 22;
const LINE_H = 26;
const BASE_Y = TOP + 30;

// dim = gray, ink = near-white, err = red, warn = amber, ok = green, cmd = teal, url = blue
const dim = '#64748b';
const ink = '#e2e8f0';
const out = '#94a3b8';
// Each terminal line is a list of colored segments. `null` is a blank line.
const lines = [
  [
    ['$ ', '#5eead4'],
    ['refract ', ink],
    ['https://app.lumen.io ', '#93c5fd'],
    ['--viewports mobile,tablet,desktop', out],
  ],
  null,
  [
    ['mobile', ink],
    ['   402×874  ', dim],
    ['refract-shots/mobile.png', dim],
  ],
  [
    ['  [error] ', '#f87171'],
    ['horizontal_overflow  ', ink],
    ['scrollWidth=520 viewport=402', out],
  ],
  [
    ['  [warn]  ', '#fbbf24'],
    ['element_clipped  ', ink],
    ['div#overflow-card', out],
  ],
  [
    ['  [warn]  ', '#fbbf24'],
    ['text_overflow  ', ink],
    ['p#clipped', out],
  ],
  [
    ['  [warn]  ', '#fbbf24'],
    ['tap_target_small  ', ink],
    ['button#tiny-btn  28×24', out],
  ],
  [
    ['  [warn]  ', '#fbbf24'],
    ['image_no_alt  ', ink],
    ['img#hero-img', out],
  ],
  null,
  [
    ['tablet ', ink],
    ['  834×1210  ', dim],
    ['refract-shots/tablet.png  ', dim],
    ['3 findings', out],
  ],
  [
    ['desktop', ink],
    ['  1512×982  ', dim],
    ['refract-shots/desktop.png  ', dim],
    ['2 findings', out],
  ],
  null,
  [
    ['✓ ', '#34d399'],
    ['3 shots · 10 findings · ', ink],
    ['1 error, 9 warnings', out],
  ],
];

// Cumulative reveal: [linesShown, delayMs].
const steps = [
  [1, 900],
  [8, 1200],
  [11, 1000],
  [13, 2800],
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function frameSvg(show) {
  let body = '';
  for (let i = 0; i < show && i < lines.length; i++) {
    const segs = lines[i];
    if (!segs) continue;
    const y = BASE_Y + i * LINE_H;
    let spans = '';
    for (const [t, c] of segs) spans += `<tspan fill="${c}">${esc(t)}</tspan>`;
    body += `<text x="${PAD_X}" y="${y}" font-family="ui-monospace, DejaVu Sans Mono, monospace" font-size="18" xml:space="preserve">${spans}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" rx="10" fill="#0b1020"/>
    <rect width="${W}" height="${TOP}" fill="#11162a"/>
    <circle cx="22" cy="20" r="6" fill="#ff5f56"/><circle cx="44" cy="20" r="6" fill="#ffbd2e"/><circle cx="66" cy="20" r="6" fill="#27c93f"/>
    <text x="${W / 2}" y="25" text-anchor="middle" fill="#64748b" font-family="ui-monospace, monospace" font-size="14">refract</text>
    ${body}
  </svg>`;
}

const enc = GIFEncoder();
for (const [show, delay] of steps) {
  const { data } = await sharp(Buffer.from(frameSvg(show)))
    .resize(W, H)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const palette = quantize(data, 256);
  const index = applyPalette(data, palette);
  enc.writeFrame(index, W, H, { palette, delay });
}
enc.finish();
writeFileSync(outGif, enc.bytes());
console.log(`demo → ${outGif} (${W}×${H}, ${steps.length} frames)`);
