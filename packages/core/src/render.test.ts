import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from './index';

const here = fileURLToPath(new URL('.', import.meta.url));
const demo = pathToFileURL(join(here, '../../../examples/demo-site/index.html')).href;

describe('render', () => {
  let outDir: string;

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), 'refract-test-'));
  });

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  it('renders one viewport at the requested pixel size', { timeout: 30000 }, async () => {
    const shots = await render({ url: demo, viewports: ['400x800'], out: outDir, dpr: 1 });
    expect(shots).toHaveLength(1);
    const shot = shots[0];
    if (!shot) throw new Error('expected one shot');

    const buf = await readFile(shot.savedPath);
    // PNG IHDR: width at byte 16, height at byte 20 (big-endian).
    expect(buf.readUInt32BE(16)).toBe(400);
    expect(buf.readUInt32BE(20)).toBe(800);
  });

  it(
    'completes with freeze enabled and writes the deterministic filename',
    { timeout: 30000 },
    async () => {
      const shots = await render({
        url: demo,
        viewports: ['400x800'],
        out: outDir,
        dpr: 1,
        freeze: true,
      });
      expect(shots).toHaveLength(1);
      const shot = shots[0];
      if (!shot) throw new Error('expected one shot');
      expect(shot.savedPath).toMatch(/[/\\]400x800\.png$/);
    },
  );
});
