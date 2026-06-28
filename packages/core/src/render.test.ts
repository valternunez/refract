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

  it(
    'renders one viewport at the requested width, full-page height',
    { timeout: 30000 },
    async () => {
      const shots = await render({ url: demo, viewports: ['400x800'], out: outDir, dpr: 1 });
      expect(shots).toHaveLength(1);
      const shot = shots[0];
      if (!shot) throw new Error('expected one shot');

      expect(shot.width).toBe(400); // logical viewport width
      const buf = await readFile(shot.savedPath);
      // PNG IHDR: width at byte 16, height at byte 20 (big-endian). Capture is full-page, so dims
      // are ≥ the viewport (the demo overflows slightly past 400 wide and is taller than 800).
      expect(buf.readUInt32BE(16)).toBeGreaterThanOrEqual(400);
      expect(buf.readUInt32BE(20)).toBeGreaterThanOrEqual(800);
    },
  );

  it('captures the full page, not just the viewport fold', { timeout: 30000 }, async () => {
    // A page taller than the viewport with content near the bottom — the shot must include it,
    // so findings rects and the annotation overlay (both document-coordinate) line up.
    const tall = join(outDir, 'tall.html');
    await writeFile(
      tall,
      '<!doctype html><meta name="viewport" content="width=device-width"><body style="margin:0">' +
        '<div style="height:2500px">top</div>' +
        '<div style="height:200px;background:red">bottom — below the fold</div></body>',
    );
    const [shot] = await render({
      url: pathToFileURL(tall).href,
      viewports: ['400x800'],
      out: outDir,
      dpr: 1,
    });
    if (!shot) throw new Error('expected one shot');
    const buf = await readFile(shot.savedPath);
    expect(buf.readUInt32BE(16)).toBe(400);
    // ~2700px of content, well past the 800px fold.
    expect(buf.readUInt32BE(20)).toBeGreaterThan(2000);
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

  it('captures once waitForFunction is truthy', { timeout: 30000 }, async () => {
    const shots = await render({
      url: demo,
      viewports: ['400x800'],
      out: outDir,
      dpr: 1,
      waitForFunction: 'document.readyState === "complete"',
    });
    expect(shots).toHaveLength(1);
  });

  it('teaches when waitForFunction never becomes truthy', { timeout: 15000 }, async () => {
    await expect(
      render({
        url: demo,
        viewports: ['400x800'],
        out: outDir,
        waitForFunction: 'window.__never_ever_xyz === 42',
      }),
    ).rejects.toThrow(/waitForFunction.*truthy/is);
  });

  it(
    'treats a tiny networkIdleMs cap as best-effort, not a failure',
    { timeout: 30000 },
    async () => {
      const shots = await render({
        url: demo,
        viewports: ['400x800'],
        out: outDir,
        dpr: 1,
        networkIdleMs: 1,
      });
      expect(shots).toHaveLength(1);
    },
  );

  it('applies injectCss before capture and findings', { timeout: 30000 }, async () => {
    const had = (s: Awaited<ReturnType<typeof render>>[number]) =>
      s.findings.some((f) => f.type === 'horizontal_overflow');

    // The demo's #overflow-card (fixed 480px) overflows a phone viewport.
    const [base] = await render({ url: demo, viewports: ['mobile'], out: outDir });
    if (!base) throw new Error('expected one shot');
    expect(had(base)).toBe(true);

    // Hiding it via injectCss removes the overflow → no finding for it.
    const [injected] = await render({
      url: demo,
      viewports: ['mobile'],
      out: outDir,
      injectCss: '#overflow-card{display:none}',
    });
    if (!injected) throw new Error('expected one shot');
    expect(had(injected)).toBe(false);
  });

  it('annotate draws finding boxes, changing the pixels', { timeout: 30000 }, async () => {
    // The demo overflows at mobile, so there are findings (with rects) to outline.
    // freeze on both so the only difference is the annotation overlay (not the badge animation).
    const [plain] = await render({ url: demo, viewports: ['mobile'], out: outDir, freeze: true });
    const [annotated] = await render({
      url: demo,
      viewports: ['mobile'],
      out: outDir,
      freeze: true,
      annotate: true,
    });
    if (!plain || !annotated) throw new Error('expected one shot each');
    // Same geometry, but the overlay boxes make the bytes differ.
    expect(annotated.width).toBe(plain.width);
    expect(annotated.image.equals(plain.image)).toBe(false);
  });

  it('throws a teaching error when the selector matches nothing', { timeout: 45000 }, async () => {
    // A no-match selector must name itself + the viewport, not surface a raw locator
    // timeout. This also pins mapPool's fail-fast: a failing viewport rejects render().
    await expect(
      render({ url: demo, viewports: ['400x800'], out: outDir, selector: '.does-not-exist' }),
    ).rejects.toThrow(/didn't match.*400×800|selector "\.does-not-exist"/is);
  });
});
