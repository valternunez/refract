import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
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

  it('bundles viewports that render identically', { timeout: 30000 }, async () => {
    // iphone-17-pro and iphone-16-pro are both 402×874 @3; iphone-15 is 393×852.
    const shots = await render({
      url: demo,
      viewports: ['iphone-17-pro', 'iphone-16-pro', 'iphone-15'],
      out: outDir,
    });

    // Two unique renders, not three.
    expect(shots).toHaveLength(2);
    const bundled = shots.find((s) => s.preset === 'iphone-17-pro');
    if (!bundled) throw new Error('expected the canonical iphone-17-pro shot');
    expect(bundled.aliases).toEqual(['iphone-16-pro']);

    const solo = shots.find((s) => s.preset === 'iphone-15');
    if (!solo) throw new Error('expected the iphone-15 shot');
    expect(solo.aliases).toBeUndefined();

    // Only the two canonical files were written (no iphone-16-pro.png).
    const files = (await readdir(outDir)).sort();
    expect(files).toEqual(['iphone-15.png', 'iphone-17-pro.png']);
  });

  it('teaches how to fix a missing storage-state file', async () => {
    await expect(
      render({
        url: demo,
        viewports: ['400x800'],
        out: outDir,
        storageState: join(outDir, 'nope.json'),
      }),
    ).rejects.toThrow(/storage-state.*playwright codegen/is);
  });

  it('renders with a valid storage-state file', { timeout: 30000 }, async () => {
    const statePath = join(outDir, 'auth.json');
    await writeFile(statePath, JSON.stringify({ cookies: [], origins: [] }));

    const shots = await render({
      url: demo,
      viewports: ['400x800'],
      out: outDir,
      dpr: 1,
      storageState: statePath,
    });
    expect(shots).toHaveLength(1);
  });
});
