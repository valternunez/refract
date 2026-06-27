import { copyFile, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { diffShots, render, writeDiffReport } from './index';

/** Write a minimal full-page solid-color fixture and return its file:// URL. */
async function fixture(dir: string, name: string, color: string): Promise<string> {
  const file = join(dir, `${name}.html`);
  await writeFile(
    file,
    `<!doctype html><html><body style="margin:0;background:${color};width:100%;height:100%"></body></html>`,
  );
  return pathToFileURL(file).href;
}

describe('diff', () => {
  let outDir: string;
  let baselineDir: string;
  let fixDir: string;

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), 'refract-diff-out-'));
    baselineDir = await mkdtemp(join(tmpdir(), 'refract-diff-base-'));
    fixDir = await mkdtemp(join(tmpdir(), 'refract-diff-fix-'));
  });

  afterEach(async () => {
    for (const d of [outDir, baselineDir, fixDir]) await rm(d, { recursive: true, force: true });
  });

  /** Render `url` at one fixed viewport and copy the result into the baseline dir. */
  async function seedBaseline(url: string, dpr = 1): Promise<void> {
    const shots = await render({ url, viewports: ['300x300'], out: outDir, dpr });
    for (const s of shots) await copyFile(s.savedPath, join(baselineDir, `${s.preset}.png`));
  }

  it('reports unchanged when the render matches the baseline', { timeout: 30000 }, async () => {
    const red = await fixture(fixDir, 'a', 'red');
    await seedBaseline(red);
    const shots = await render({ url: red, viewports: ['300x300'], out: outDir, dpr: 1 });

    const [r] = await diffShots(shots, { baselineDir, outDir });
    expect(r?.status).toBe('unchanged');
    expect(r?.diffPixels).toBe(0);
  });

  it('reports changed and writes a diff PNG when pixels differ', { timeout: 30000 }, async () => {
    const red = await fixture(fixDir, 'a', 'red');
    const blue = await fixture(fixDir, 'b', 'blue');
    await seedBaseline(red);
    const shots = await render({ url: blue, viewports: ['300x300'], out: outDir, dpr: 1 });

    const [r] = await diffShots(shots, { baselineDir, outDir });
    expect(r?.status).toBe('changed');
    expect(r?.diffPixels).toBeGreaterThan(0);
    expect(r?.diffPath).toBeDefined();
    expect((await stat(r?.diffPath as string)).isFile()).toBe(true);
  });

  it('reports size_changed when dimensions differ', { timeout: 30000 }, async () => {
    const red = await fixture(fixDir, 'a', 'red');
    await seedBaseline(red, 1); // baseline 300x300
    const shots = await render({ url: red, viewports: ['300x300'], out: outDir, dpr: 2 }); // 600x600

    const [r] = await diffShots(shots, { baselineDir, outDir });
    expect(r?.status).toBe('size_changed');
    expect(r?.diffPath).toBeUndefined();
  });

  it('reports no_baseline when the baseline is missing', { timeout: 30000 }, async () => {
    const red = await fixture(fixDir, 'a', 'red');
    const shots = await render({ url: red, viewports: ['300x300'], out: outDir, dpr: 1 });

    const [r] = await diffShots(shots, { baselineDir, outDir }); // empty baseline dir
    expect(r?.status).toBe('no_baseline');
  });

  it('writes an HTML report naming each preset', { timeout: 30000 }, async () => {
    const red = await fixture(fixDir, 'a', 'red');
    const shots = await render({ url: red, viewports: ['300x300'], out: outDir, dpr: 1 });
    const results = await diffShots(shots, { baselineDir, outDir });

    const reportPath = await writeDiffReport(results, outDir);
    const html = await readFile(reportPath, 'utf8');
    expect(html).toContain('300x300');
    expect(html).toContain('Refract diff report');
  });
});
