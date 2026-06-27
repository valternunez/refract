/**
 * Refract visual diff — compare rendered {@link Shot}s against baseline PNGs and
 * emit a self-contained HTML report. Wraps `pixelmatch` (per CLAUDE.md: don't
 * reinvent visual regression). Used by the `refract diff` CLI command.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import type { Shot } from './index';

/** Outcome of comparing one viewport against its baseline. */
export type DiffStatus = 'unchanged' | 'changed' | 'size_changed' | 'no_baseline';

/** Result of diffing one {@link Shot} against its baseline PNG. */
export interface DiffResult {
  preset: string;
  status: DiffStatus;
  /** Current render dimensions (CSS px × DPR). */
  width: number;
  height: number;
  /** Absolute path to the baseline PNG (may not exist when `no_baseline`). */
  baselinePath: string;
  /** Absolute path to the current render PNG. */
  currentPath: string;
  /** Absolute path to the written diff PNG, when `changed`. */
  diffPath?: string;
  /** Number of differing pixels, when compared (`unchanged`/`changed`). */
  diffPixels?: number;
  /** `diffPixels / (width * height)`, when compared. */
  diffRatio?: number;
  /** Baseline dimensions, when `size_changed` (so the report can show old → new). */
  baselineWidth?: number;
  baselineHeight?: number;
  /** Other device names this render covers (carried from {@link Shot.aliases}). */
  aliases?: string[];
}

/**
 * Compare each {@link Shot} against `baselineDir/{preset}.png` with `pixelmatch`.
 *
 * Missing baseline → `no_baseline`. Different dimensions → `size_changed` (pixelmatch
 * needs equal sizes). Otherwise the per-pixel diff count decides `changed`/`unchanged`;
 * when changed, a highlighted diff PNG is written to `outDir/{preset}.diff.png`.
 *
 * @param threshold pixelmatch per-pixel color sensitivity (0–1, default 0.1).
 * @example
 * const shots = await render({ url, out, freeze: true });
 * const results = await diffShots(shots, { baselineDir: './refract-baseline', outDir: out });
 */
export async function diffShots(
  shots: Shot[],
  opts: { baselineDir: string; outDir: string; threshold?: number },
): Promise<DiffResult[]> {
  const threshold = opts.threshold ?? 0.1;
  return Promise.all(
    shots.map(async (shot): Promise<DiffResult> => {
      const baselinePath = join(opts.baselineDir, `${shot.preset}.png`);
      const base = {
        preset: shot.preset,
        width: shot.width,
        height: shot.height,
        baselinePath,
        currentPath: shot.savedPath,
        aliases: shot.aliases,
      };

      let baselineBuf: Buffer;
      try {
        baselineBuf = await readFile(baselinePath);
      } catch {
        // Errors teach: the CLI turns this into "run --update to create baselines".
        return { ...base, status: 'no_baseline' };
      }

      const baseline = PNG.sync.read(baselineBuf);
      const current = PNG.sync.read(shot.image);

      if (baseline.width !== current.width || baseline.height !== current.height) {
        return {
          ...base,
          status: 'size_changed',
          baselineWidth: baseline.width,
          baselineHeight: baseline.height,
        };
      }

      const { width, height } = current;
      const diff = new PNG({ width, height });
      const diffPixels = pixelmatch(baseline.data, current.data, diff.data, width, height, {
        threshold,
      });
      const diffRatio = diffPixels / (width * height);

      if (diffPixels === 0) {
        return { ...base, status: 'unchanged', diffPixels, diffRatio };
      }

      const diffPath = join(opts.outDir, `${shot.preset}.diff.png`);
      await writeFile(diffPath, PNG.sync.write(diff));
      return { ...base, status: 'changed', diffPixels, diffRatio, diffPath };
    }),
  );
}

/** Refract brand spectrum (BRAND.md) — a thin accent rule on the report. */
const SPECTRUM = '#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6';

const STATUS_COLOR: Record<DiffStatus, string> = {
  unchanged: '#22c55e',
  changed: '#f97316',
  size_changed: '#ef4444',
  no_baseline: '#94a3b8',
};

/** A relative, forward-slashed href from the report dir to a file (for `<img src>`). */
function href(fromDir: string, file: string): string {
  return relative(fromDir, file).split('\\').join('/');
}

/** One image column in a result card, or an empty placeholder when absent. */
function imgCol(label: string, outDir: string, file: string | undefined): string {
  const body = file
    ? `<img loading="lazy" src="${href(outDir, file)}" alt="${label}">`
    : '<div class="missing">—</div>';
  return `<figure><figcaption>${label}</figcaption>${body}</figure>`;
}

/**
 * Write a self-contained `report.html` into `outDir` showing a baseline │ current │
 * diff grid per viewport, styled to match the Refract brand (BRAND.md).
 *
 * @returns the absolute path to the written report.
 */
export async function writeDiffReport(results: DiffResult[], outDir: string): Promise<string> {
  const changed = results.filter((r) => r.status !== 'unchanged').length;
  const cards = results
    .map((r) => {
      const pct = r.diffRatio !== undefined ? ` · ${(r.diffRatio * 100).toFixed(2)}%` : '';
      const size =
        r.status === 'size_changed'
          ? ` · ${r.baselineWidth}×${r.baselineHeight} → ${r.width}×${r.height}`
          : ` · ${r.width}×${r.height}`;
      const aliases = r.aliases?.length ? ` · also ${r.aliases.join(', ')}` : '';
      return `<section class="card">
      <header>
        <span class="badge" style="--c:${STATUS_COLOR[r.status]}">${r.status}</span>
        <h2>${r.preset}</h2>
        <span class="meta">${size}${pct}${aliases}</span>
      </header>
      <div class="cols">
        ${imgCol('baseline', outDir, r.status === 'no_baseline' ? undefined : r.baselinePath)}
        ${imgCol('current', outDir, r.currentPath)}
        ${imgCol('diff', outDir, r.diffPath)}
      </div>
    </section>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Refract diff report</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #0b1020; color: #e2e8f0;
    font-family: "Segoe UI", system-ui, Arial, sans-serif; }
  .spectrum { height: 4px; background: linear-gradient(90deg, ${SPECTRUM}); }
  header.top { padding: 24px 32px 8px; }
  header.top h1 { margin: 0; font-size: 20px; color: #f8fafc; }
  header.top .sub { color: #94a3b8; font-size: 13px; margin-top: 4px;
    font-family: Consolas, "DejaVu Sans Mono", monospace; }
  main { padding: 16px 32px 48px; display: grid; gap: 24px; }
  .card { background: #11182e; border: 1px solid #1e293b; border-radius: 12px;
    overflow: hidden; }
  .card header { display: flex; align-items: baseline; gap: 12px;
    padding: 14px 16px; border-bottom: 1px solid #1e293b; }
  .card h2 { margin: 0; font-size: 16px; color: #f8fafc; }
  .badge { font-size: 11px; text-transform: uppercase; letter-spacing: .04em;
    font-weight: 600; color: #0b1020; background: var(--c); padding: 2px 8px;
    border-radius: 999px; }
  .meta { color: #94a3b8; font-size: 12px;
    font-family: Consolas, "DejaVu Sans Mono", monospace; }
  .cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px;
    background: #1e293b; }
  figure { margin: 0; background: #0b1020; padding: 12px; text-align: center; }
  figcaption { color: #94a3b8; font-size: 11px; text-transform: uppercase;
    letter-spacing: .05em; margin-bottom: 8px; }
  figure img { max-width: 100%; height: auto; border-radius: 6px;
    background: #fff; }
  .missing { color: #475569; padding: 32px 0; }
</style>
</head>
<body>
<div class="spectrum"></div>
<header class="top">
  <h1>Refract diff report</h1>
  <div class="sub">${results.length} viewport(s) · ${changed} changed</div>
</header>
<main>
${cards}
</main>
</body>
</html>
`;

  const reportPath = join(outDir, 'report.html');
  await writeFile(reportPath, html);
  return reportPath;
}
