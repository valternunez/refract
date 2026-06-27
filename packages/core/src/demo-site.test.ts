import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { type Browser, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = fileURLToPath(new URL('.', import.meta.url));
const demo = pathToFileURL(join(here, '../../../examples/demo-site/index.html')).href;

// The demo site is broken on purpose; these assertions lock in each intentional
// bug so nobody "fixes" the fixture and silently breaks the v0.2 findings tests.
// Each assertion is the executable spec for the matching finding type.
describe('demo-site fixture (v0.2 findings spec)', () => {
  let browser: Browser;
  let page: Awaited<ReturnType<Browser['newPage']>>;

  beforeAll(async () => {
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    page = await context.newPage();
    await page.goto(demo, { waitUntil: 'load' });
  }, 30000);

  afterAll(async () => {
    await browser.close();
  });

  it('overflows horizontally at 375px (horizontal_overflow)', async () => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeGreaterThan(375);
  });

  it('has a tap target under 44×44 (tap_target_small)', async () => {
    const box = await page.locator('#tiny-btn').boundingBox();
    if (!box) throw new Error('#tiny-btn not found');
    expect(box.width).toBeLessThan(44);
    expect(box.height).toBeLessThan(44);
  });

  it('clips overflowing text (text_overflow)', async () => {
    const clipped = await page
      .locator('#clipped')
      .evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(clipped).toBe(true);
  });

  it('has an image with no alt (image_no_alt)', async () => {
    expect(await page.locator('#hero-img').getAttribute('alt')).toBeNull();
  });
});
