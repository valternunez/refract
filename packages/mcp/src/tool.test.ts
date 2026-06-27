import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { diffResponsive, downscalePreview, renderResponsive } from './tool';

const here = fileURLToPath(new URL('.', import.meta.url));
const demo = pathToFileURL(join(here, '../../../examples/demo-site/index.html')).href;

const makePng = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .png()
    .toBuffer();

describe('downscalePreview', () => {
  it('shrinks a wide PNG to 800px', async () => {
    const out = await downscalePreview(await makePng(1000, 600));
    expect((await sharp(out).metadata()).width).toBe(800);
  });

  it('leaves a sub-800px PNG untouched', async () => {
    const small = await makePng(400, 300);
    const out = await downscalePreview(small);
    expect(out).toBe(small);
  });
});

describe('renderResponsive', () => {
  // The default trio writes to ./refract-shots in the test cwd; clean it up.
  afterAll(async () => {
    await rm('refract-shots', { recursive: true, force: true });
  });

  it('returns a manifest plus a downscaled image per viewport', async () => {
    const result = await renderResponsive({ url: demo });

    let imageCount = 0;
    for (const c of result.content) {
      if (c.type !== 'image') continue;
      expect(c.mimeType).toBe('image/png');
      const meta = await sharp(Buffer.from(c.data, 'base64')).metadata();
      expect(meta.width ?? 0).toBeLessThanOrEqual(800);
      imageCount++;
    }
    expect(imageCount).toBe(3);

    const first = result.content[0];
    expect(first?.type).toBe('text');
    const manifest = first?.type === 'text' ? first.text : '';
    expect(manifest).toContain('Rendered');
    const savedPath = manifest.split('→')[1]?.split('\n')[0]?.trim() ?? '';
    expect(isAbsolute(savedPath)).toBe(true);
  }, 30000);

  it('reports a teaching error for an unreachable host', async () => {
    const result = await renderResponsive({
      url: 'https://no-such-host.invalid',
      viewports: ['400x800'],
    });
    expect(result.isError).toBe(true);
    const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
    expect(text).toMatch(/resolve|host/i);
  }, 30000);
});

const firstText = (r: Awaited<ReturnType<typeof diffResponsive>>) =>
  r.content[0]?.type === 'text' ? r.content[0].text : '';

describe('diffResponsive', () => {
  afterAll(async () => {
    await rm('refract-shots', { recursive: true, force: true });
  });

  it('writes a baseline with update, then reports unchanged', async () => {
    const baseline = await mkdtemp(join(tmpdir(), 'refract-mcp-base-'));
    try {
      const updated = await diffResponsive({
        url: demo,
        viewports: ['400x800'],
        baseline,
        update: true,
      });
      expect(firstText(updated)).toMatch(/wrote 1 baseline/i);
      expect((await stat(join(baseline, '400x800.png'))).isFile()).toBe(true);

      const compared = await diffResponsive({ url: demo, viewports: ['400x800'], baseline });
      expect(firstText(compared)).toMatch(/no visual changes/i);
    } finally {
      await rm(baseline, { recursive: true, force: true });
    }
  }, 40000);

  it('teaches how to create a baseline when none exists', async () => {
    const baseline = await mkdtemp(join(tmpdir(), 'refract-mcp-empty-'));
    try {
      const result = await diffResponsive({ url: demo, viewports: ['400x800'], baseline });
      const text = firstText(result);
      expect(text).toMatch(/no_baseline/);
      expect(text).toMatch(/update/i);
    } finally {
      await rm(baseline, { recursive: true, force: true });
    }
  }, 30000);
});
