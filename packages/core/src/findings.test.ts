import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { type Browser, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collectFindings } from './findings';
import { render } from './index';

const here = fileURLToPath(new URL('.', import.meta.url));
const demo = pathToFileURL(join(here, '../../../examples/demo-site/index.html')).href;

describe('collectFindings', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  it(
    'flags overflow, tiny tap targets, clipped text and missing alt on mobile',
    { timeout: 30000 },
    async () => {
      const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
      try {
        const page = await context.newPage();
        await page.goto(demo, { waitUntil: 'load' });
        const findings = await collectFindings(page, true);

        const overflow = findings.find((f) => f.type === 'horizontal_overflow');
        if (!overflow) throw new Error('expected a horizontal_overflow finding');

        const tap = findings.find((f) => f.type === 'tap_target_small');
        if (!tap) throw new Error('expected a tap_target_small finding');
        expect(tap.selector).toContain('tiny-btn');
        expect(tap.size).toBe('28x24');

        const text = findings.find((f) => f.type === 'text_overflow');
        if (!text) throw new Error('expected a text_overflow finding');
        expect(text.selector).toContain('clipped');

        const noAlt = findings.find((f) => f.type === 'image_no_alt');
        if (!noAlt) throw new Error('expected an image_no_alt finding');
        expect(noAlt.selector).toContain('hero-img');
      } finally {
        await context.close();
      }
    },
  );

  it('does not flag overflow or tap targets on desktop', { timeout: 30000 }, async () => {
    const context = await browser.newContext({ viewport: { width: 1512, height: 982 } });
    try {
      const page = await context.newPage();
      await page.goto(demo, { waitUntil: 'load' });
      const findings = await collectFindings(page, false);

      expect(findings.find((f) => f.type === 'horizontal_overflow')).toBeUndefined();
      expect(findings.find((f) => f.type === 'tap_target_small')).toBeUndefined();
    } finally {
      await context.close();
    }
  });

  it('surfaces findings through render() at the mobile preset', { timeout: 30000 }, async () => {
    // Guards the mobile-emulation quirk: findings compare against clientWidth, not
    // innerWidth (which balloons under emulation), so overflow is caught here too.
    const outDir = await mkdtemp(join(tmpdir(), 'refract-findings-'));
    try {
      const shots = await render({ url: demo, viewports: ['mobile'], out: outDir });
      const shot = shots[0];
      if (!shot) throw new Error('expected one shot');
      expect(shot.findings.find((f) => f.type === 'horizontal_overflow')).toBeDefined();
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
