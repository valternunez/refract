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

describe('collectFindings false positives', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  // Runs `html` in a mobile (375×667) or desktop (1280×800) page and returns the findings.
  async function findingsFor(html: string, isMobile = true) {
    const viewport = isMobile ? { width: 375, height: 667 } : { width: 1280, height: 800 };
    const context = await browser.newContext({ viewport });
    try {
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      return { findings: await collectFindings(page, isMobile), page, context };
    } catch (err) {
      await context.close();
      throw err;
    }
  }

  it('ignores a visibility:hidden wide element', { timeout: 30000 }, async () => {
    const { findings, context } = await findingsFor(
      '<div style="visibility:hidden;width:5000px;height:40px">hidden</div>',
    );
    try {
      expect(findings.find((f) => f.type === 'horizontal_overflow')).toBeUndefined();
      expect(findings.find((f) => f.type === 'element_clipped')).toBeUndefined();
    } finally {
      await context.close();
    }
  });

  it('still flags a genuinely visible wide block', { timeout: 30000 }, async () => {
    const { findings, context } = await findingsFor(
      '<div style="width:5000px;height:40px;background:red">visible</div>',
    );
    try {
      expect(findings.find((f) => f.type === 'horizontal_overflow')).toBeDefined();
      expect(findings.find((f) => f.type === 'element_clipped')).toBeDefined();
    } finally {
      await context.close();
    }
  });

  it('names the overflow culprit and carries an integer rect', { timeout: 30000 }, async () => {
    const { findings, context } = await findingsFor(
      '<div id="wide" style="width:5000px;height:40px;background:red">visible</div>',
    );
    try {
      const overflow = findings.find((f) => f.type === 'horizontal_overflow');
      if (!overflow) throw new Error('expected a horizontal_overflow finding');
      // Page-level finding now points at the worst offender.
      expect(overflow.selector).toContain('wide');
      const rect = overflow.rect;
      if (!rect) throw new Error('expected a rect on the overflow finding');
      expect(Number.isInteger(rect.x)).toBe(true);
      expect(Number.isInteger(rect.width)).toBe(true);
      expect(rect.width).toBeGreaterThan(375); // the 5000px block
    } finally {
      await context.close();
    }
  });

  it('does not flag text in an overflow:auto container', { timeout: 30000 }, async () => {
    const { findings, context } = await findingsFor(
      '<div style="width:200px;overflow:auto;white-space:nowrap">' +
        'this is a very long line of text that exceeds the container width significantly indeed' +
        '</div>',
    );
    try {
      expect(findings.find((f) => f.type === 'text_overflow')).toBeUndefined();
    } finally {
      await context.close();
    }
  });

  it('does not flag intentional ellipsis truncation', { timeout: 30000 }, async () => {
    const { findings, context } = await findingsFor(
      '<div style="width:120px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' +
        'a very long single line that gets truncated with an ellipsis on purpose' +
        '</div>',
    );
    try {
      expect(findings.find((f) => f.type === 'text_overflow')).toBeUndefined();
    } finally {
      await context.close();
    }
  });

  it('still flags hard clipping with no ellipsis', { timeout: 30000 }, async () => {
    const { findings, context } = await findingsFor(
      '<div style="width:120px;overflow:hidden;white-space:nowrap;text-overflow:clip">' +
        'a very long single line that is hard-clipped with no ellipsis affordance' +
        '</div>',
    );
    try {
      expect(findings.find((f) => f.type === 'text_overflow')).toBeDefined();
    } finally {
      await context.close();
    }
  });

  it('does not flag an offscreen left:-9999px element', { timeout: 30000 }, async () => {
    const { findings, context } = await findingsFor(
      '<div style="position:absolute;left:-9999px;width:200px;height:40px">skip link</div>',
    );
    try {
      expect(findings.find((f) => f.type === 'element_clipped')).toBeUndefined();
    } finally {
      await context.close();
    }
  });

  it('emits a valid selector for a Tailwind-classed overflower', { timeout: 30000 }, async () => {
    const { findings, page, context } = await findingsFor(
      '<div class="md:flex" style="width:5000px;height:40px;background:red">wide</div>',
    );
    try {
      const clipped = findings.find((f) => f.type === 'element_clipped');
      if (!clipped?.selector) throw new Error('expected an element_clipped finding with selector');
      const matched = await page.$(clipped.selector);
      expect(matched).not.toBeNull();
    } finally {
      await context.close();
    }
  });

  it('flags a small paragraph as text_too_small', { timeout: 30000 }, async () => {
    const { findings, context } = await findingsFor(
      '<p style="font-size:10px">a full sentence of body copy that is too small to read</p>',
    );
    try {
      expect(findings.find((f) => f.type === 'text_too_small')).toBeDefined();
    } finally {
      await context.close();
    }
  });

  it('does not flag 16px body text or a short tiny label', { timeout: 30000 }, async () => {
    const big = await findingsFor(
      '<p style="font-size:16px">a full sentence of readable body copy</p>',
    );
    try {
      expect(big.findings.find((f) => f.type === 'text_too_small')).toBeUndefined();
    } finally {
      await big.context.close();
    }
    const label = await findingsFor('<span style="font-size:10px">Hi</span>'); // short → not body text
    try {
      expect(label.findings.find((f) => f.type === 'text_too_small')).toBeUndefined();
    } finally {
      await label.context.close();
    }
  });

  it('does not flag an icon/image link whose wrapped image is large enough', async () => {
    // An inline <a> measures its line-box height (~21px), not the 100×100 image it wraps —
    // the real tap area. Union with replaced children so it isn't a false tap_target_small.
    const px = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
    const { findings, context } = await findingsFor(
      `<a href="#"><img src="${px}" width="100" height="100" alt="logo"></a>`,
    );
    try {
      expect(findings.find((f) => f.type === 'tap_target_small')).toBeUndefined();
    } finally {
      await context.close();
    }
  });

  it('still flags a genuinely small interactive control', async () => {
    const { findings, context } = await findingsFor(
      '<button style="width:30px;height:30px">x</button>',
    );
    try {
      const tap = findings.find((f) => f.type === 'tap_target_small');
      if (!tap) throw new Error('expected a tap_target_small finding');
      expect(tap.size).toBe('30x30');
    } finally {
      await context.close();
    }
  });

  it('does not flag a wide-but-short link (tappable horizontally)', async () => {
    const { findings, context } = await findingsFor(
      '<a href="#" style="display:inline-block;width:200px;height:30px">wide nav link</a>',
    );
    try {
      expect(findings.find((f) => f.type === 'tap_target_small')).toBeUndefined();
    } finally {
      await context.close();
    }
  });

  it('does not flag an inline text link in a sentence (WCAG inline exception)', async () => {
    const { findings, context } = await findingsFor(
      '<p style="font-size:16px">please see <a href="#">this inline link</a> in a sentence of text</p>',
    );
    try {
      expect(findings.find((f) => f.type === 'tap_target_small')).toBeUndefined();
    } finally {
      await context.close();
    }
  });

  it('does not flag a child clipped by CSS containment (contain:paint)', async () => {
    const { findings, context } = await findingsFor(
      '<section style="contain:paint">' +
        '<div style="width:2000px;height:30px;background:red">contained</div></section>',
    );
    try {
      expect(findings.find((f) => f.type === 'element_clipped')).toBeUndefined();
      expect(findings.find((f) => f.type === 'horizontal_overflow')).toBeUndefined();
    } finally {
      await context.close();
    }
  });

  it('does not flag near-zero-opacity text as too small', async () => {
    const { findings, context } = await findingsFor(
      '<p style="opacity:0.005;font-size:9px">a full sentence of effectively invisible body copy</p>',
    );
    try {
      expect(findings.find((f) => f.type === 'text_too_small')).toBeUndefined();
    } finally {
      await context.close();
    }
  });

  it('does not flag visually-hidden sr-only text as text_overflow', async () => {
    const { findings, context } = await findingsFor(
      '<h1 style="position:absolute;width:1px;height:1px;overflow:hidden;white-space:nowrap">a long screen-reader-only heading</h1>',
    );
    try {
      expect(findings.find((f) => f.type === 'text_overflow')).toBeUndefined();
    } finally {
      await context.close();
    }
  });

  it('does not flag a 1px skip link as a tap target', async () => {
    const { findings, context } = await findingsFor(
      '<a href="#main" style="position:absolute;width:1px;height:1px;overflow:hidden">skip to content</a>',
    );
    try {
      expect(findings.find((f) => f.type === 'tap_target_small')).toBeUndefined();
    } finally {
      await context.close();
    }
  });

  it('reports a helpful detail for an alt-less image with no src yet', async () => {
    const { findings, context } = await findingsFor('<img width="40" height="40">');
    try {
      const noAlt = findings.find((f) => f.type === 'image_no_alt');
      if (!noAlt) throw new Error('expected an image_no_alt finding');
      expect(noAlt.detail).toMatch(/no src/i);
    } finally {
      await context.close();
    }
  });

  it('flags a viewport meta that lacks width=device-width', async () => {
    const bad = await findingsFor('<meta name="viewport" content="width=1024"><p>hi</p>');
    try {
      const f = bad.findings.find((x) => x.type === 'viewport_meta_missing');
      if (!f) throw new Error('expected a viewport_meta_missing finding');
      expect(f.detail).toMatch(/device-width/);
    } finally {
      await bad.context.close();
    }
    const ok = await findingsFor(
      '<meta name="viewport" content="width=device-width, initial-scale=1"><p>hi</p>',
    );
    try {
      expect(ok.findings.find((x) => x.type === 'viewport_meta_missing')).toBeUndefined();
    } finally {
      await ok.context.close();
    }
  });

  it('finds overflow inside an open shadow root', async () => {
    const { findings, context } = await findingsFor(
      '<wide-card></wide-card><script>customElements.define("wide-card",' +
        'class extends HTMLElement{connectedCallback(){this.attachShadow({mode:"open"})' +
        '.innerHTML="<div style=\\"width:2000px;height:40px;background:red\\">shadow overflow</div>"}})</script>',
    );
    try {
      expect(findings.find((f) => f.type === 'horizontal_overflow')).toBeDefined();
      expect(findings.find((f) => f.type === 'element_clipped')).toBeDefined();
    } finally {
      await context.close();
    }
  });

  it('flags left-side overflow on an RTL page', async () => {
    const { findings, context } = await findingsFor(
      '<script>document.documentElement.dir="rtl"</script>' +
        '<div style="width:600px;height:40px;background:red">wide block in an RTL document</div>',
    );
    try {
      expect(findings.find((f) => f.type === 'horizontal_overflow')).toBeDefined();
      const clipped = findings.find((f) => f.type === 'element_clipped');
      if (!clipped) throw new Error('expected an element_clipped finding');
      expect(clipped.detail).toMatch(/left=/);
    } finally {
      await context.close();
    }
  });

  it('does not flag sr-only text hidden via clip-path / text-indent (full-size box)', async () => {
    const cp = await findingsFor(
      '<h1 style="position:absolute;clip-path:inset(50%);white-space:nowrap">a long screen-reader-only heading hidden by clip-path</h1>',
    );
    try {
      expect(cp.findings.find((f) => f.type === 'horizontal_overflow')).toBeUndefined();
      expect(cp.findings.find((f) => f.type === 'element_clipped')).toBeUndefined();
    } finally {
      await cp.context.close();
    }
    const ti = await findingsFor(
      '<a href="#" style="display:block;text-indent:-9999px;overflow:hidden;white-space:nowrap">skip to main content</a>',
    );
    try {
      expect(ti.findings.find((f) => f.type === 'text_overflow')).toBeUndefined();
    } finally {
      await ti.context.close();
    }
  });

  it('flags horizontal scroll caused by an unbreakable token (no element offender)', async () => {
    const { findings, context } = await findingsFor(
      '<div style="white-space:nowrap;font-size:20px">https://example.com/a-very-long-unbreakable-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa</div>',
    );
    try {
      expect(findings.find((f) => f.type === 'horizontal_overflow')).toBeDefined();
    } finally {
      await context.close();
    }
  });

  it('flags a tiny native checkbox as a small tap target', async () => {
    const { findings, context } = await findingsFor('<input type="checkbox"> <label>agree</label>');
    try {
      expect(findings.find((f) => f.type === 'tap_target_small')).toBeDefined();
    } finally {
      await context.close();
    }
  });

  it('does not flag tiny text inside an aria-hidden subtree', async () => {
    const { findings, context } = await findingsFor(
      '<div aria-hidden="true"><span style="font-size:9px">a full sentence of decorative copy</span></div>',
    );
    try {
      expect(findings.find((f) => f.type === 'text_too_small')).toBeUndefined();
    } finally {
      await context.close();
    }
  });

  it(
    'flags a missing viewport meta on mobile, but not when present or on desktop',
    { timeout: 30000 },
    async () => {
      const missing = await findingsFor('<div>hello</div>');
      try {
        expect(missing.findings.find((f) => f.type === 'viewport_meta_missing')).toBeDefined();
      } finally {
        await missing.context.close();
      }
      const present = await findingsFor(
        '<meta name="viewport" content="width=device-width"><div>hello</div>',
      );
      try {
        expect(present.findings.find((f) => f.type === 'viewport_meta_missing')).toBeUndefined();
      } finally {
        await present.context.close();
      }
      const desktop = await findingsFor('<div>hello</div>', false);
      try {
        expect(desktop.findings.find((f) => f.type === 'viewport_meta_missing')).toBeUndefined();
      } finally {
        await desktop.context.close();
      }
    },
  );
});
