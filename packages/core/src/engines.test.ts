import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Engine, render } from './index';

const here = fileURLToPath(new URL('.', import.meta.url));
const demo = pathToFileURL(join(here, '../../../examples/demo-site/index.html')).href;

describe('engines', () => {
  let outDir: string;
  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), 'refract-engine-'));
  });
  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  it.each<Engine>(['chromium', 'webkit'])(
    'renders on %s at the requested pixel size',
    { timeout: 30000 },
    async (engine) => {
      const shots = await render({
        url: demo,
        viewports: ['400x800'],
        out: outDir,
        dpr: 1,
        engine,
      });
      expect(shots).toHaveLength(1);
      const buf = await readFile(shots[0]?.savedPath as string);
      // PNG IHDR: width at byte 16, height at byte 20 (big-endian). Capture is full-page, so
      // dims are ≥ the viewport. dpr:1 keeps width in CSS px (the demo overflows a bit past 400);
      // dpr:3 would be ~1560, so a width well under 800 proves both engines honored dpr.
      expect(buf.readUInt32BE(16)).toBeGreaterThanOrEqual(400);
      expect(buf.readUInt32BE(16)).toBeLessThan(800);
      expect(buf.readUInt32BE(20)).toBeGreaterThanOrEqual(800);
    },
  );

  it(
    'renders a mobile preset on webkit (shared context options apply)',
    { timeout: 30000 },
    async () => {
      // `mobile` carries isMobile/hasTouch/deviceScaleFactor — webkit accepts them all.
      const shots = await render({
        url: demo,
        viewports: ['mobile'],
        out: outDir,
        engine: 'webkit',
      });
      expect(shots).toHaveLength(1);
    },
  );

  it('teaches when the engine value is unknown', async () => {
    // @ts-expect-error — exercising the runtime guard a CLI/MCP misuse could hit.
    await expect(render({ url: demo, engine: 'safari' })).rejects.toThrow(
      /unknown engine.*chromium.*webkit/is,
    );
  });
});
