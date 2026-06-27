/**
 * Refract core — the library behind the CLI and MCP server.
 *
 * Renders a URL at N viewports using a single Chromium browser with one context
 * per viewport, rendered in parallel. See CLAUDE.md "V0.1".
 */

import { mkdir } from 'node:fs/promises';
import { cpus } from 'node:os';
import { join, resolve } from 'node:path';
import { type Browser, type Page, type Response, chromium } from 'playwright';
import { type ResolvedViewport, resolveViewport } from './presets';

/** A target viewport: either a preset name (`"iphone-15"`, `"mobile"`) or `WxH` (`"375x667"`). */
export type Viewport = string;

/** Options for {@link render}. Everything optional except `url` — defaults must be right. */
export interface RenderOptions {
  /** The URL to render. The only required option. */
  url: string;
  /** Viewports to render. Defaults to `["mobile", "tablet", "desktop"]`. */
  viewports?: Viewport[];
  /** CSS selector to clip the screenshot to a single element. */
  selector?: string;
  /** Disable animations/transitions and force eager image loading for deterministic shots. */
  freeze?: boolean;
  /** Explicit gate: wait for this selector before capturing. */
  waitFor?: string;
  /** Output directory for full-res PNGs. Defaults to `./refract-shots`. */
  out?: string;
  /** Override each viewport's deviceScaleFactor (e.g. `1` for smaller files). */
  dpr?: number;
  /** Max viewports rendered in parallel. Defaults to `os.cpus().length`. */
  concurrency?: number;
}

/** One rendered viewport. `image` is the full-resolution PNG buffer; `savedPath` is the absolute full-res path. */
export interface Shot {
  preset: string;
  width: number;
  height: number;
  image: Buffer;
  savedPath: string;
}

/**
 * Render `url` at each viewport and return one {@link Shot} per viewport.
 *
 * Launches a single Chromium browser and creates one context per viewport,
 * rendered in parallel (capped at `concurrency`). Throws a teaching error for
 * unknown viewport tokens, unreachable URLs, and missing `waitFor` selectors.
 *
 * @example
 * const shots = await render({ url: 'http://localhost:3000' });
 * // → screenshots saved to ./refract-shots/{mobile,tablet,desktop}.png
 */
export async function render(options: RenderOptions): Promise<Shot[]> {
  const {
    url,
    viewports = ['mobile', 'tablet', 'desktop'],
    selector,
    freeze = false,
    waitFor,
    out = './refract-shots',
    dpr,
    concurrency = cpus().length,
  } = options;

  const resolved = viewports.map(resolveViewport); // throws teaching error on bad token
  const outDir = resolve(out);
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch(); // ONE browser, N contexts
  try {
    return await mapPool(resolved, Math.max(1, concurrency), (vp) =>
      renderOne(browser, url, vp, { selector, freeze, waitFor, outDir, dpr }),
    );
  } finally {
    await browser.close();
  }
}

interface RenderOneOpts {
  selector?: string;
  freeze: boolean;
  waitFor?: string;
  outDir: string;
  dpr?: number;
}

/** Render a single viewport in its own context, always closing the context. */
async function renderOne(
  browser: Browser,
  url: string,
  vp: ResolvedViewport,
  opts: RenderOneOpts,
): Promise<Shot> {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: opts.dpr ?? vp.deviceScaleFactor,
    userAgent: vp.userAgent,
    hasTouch: vp.hasTouch,
    isMobile: vp.isMobile,
  });
  try {
    const page = await context.newPage();
    await navigate(page, url);
    await smartWaits(page, opts.waitFor);
    if (opts.freeze) await applyFreeze(page);

    const savedPath = join(opts.outDir, `${vp.name}.png`);
    const image = opts.selector
      ? await page.locator(opts.selector).screenshot({ path: savedPath })
      : await page.screenshot({ path: savedPath });

    return { preset: vp.name, width: vp.width, height: vp.height, image, savedPath };
  } finally {
    await context.close();
  }
}

/** Navigate to `url`, turning failures into messages that point at a fix. */
async function navigate(page: Page, url: string): Promise<void> {
  let response: Response | null;
  try {
    response = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('ERR_NAME_NOT_RESOLVED')) {
      throw new Error(`Could not resolve host for "${url}". Is the hostname spelled correctly?`);
    }
    if (message.includes('ERR_CONNECTION_REFUSED')) {
      throw new Error(`Connection refused for "${url}". Is the dev server running on that port?`);
    }
    if (message.includes('Timeout') || message.includes('timeout')) {
      throw new Error(
        `Navigation to "${url}" timed out after 30s. Is the server slow or stuck loading?`,
      );
    }
    throw new Error(`Failed to load "${url}": ${message}`);
  }

  if (response && response.status() >= 400) {
    throw new Error(
      `"${url}" returned HTTP ${response.status()} ${response.statusText()}. Check the path and that the server is healthy.`,
    );
  }
}

/** Apply the smart-wait stack: networkidle (best-effort), fonts, layout settle, optional selector. */
async function smartWaits(page: Page, waitFor?: string): Promise<void> {
  // networkidle is a lie — some apps poll forever, so swallow the timeout.
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await settleLayout(page);

  // Playwright's own timeout error already names the selector and the timeout.
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 10000 });
}

/** Wait until no layout-shift for 500ms, bounded at 3s. */
async function settleLayout(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((res) => {
        const start = performance.now();
        let last = start;
        let obs: PerformanceObserver;
        try {
          obs = new PerformanceObserver((l) => {
            if (l.getEntries().length) last = performance.now();
          });
          obs.observe({ type: 'layout-shift', buffered: true });
        } catch {
          res();
          return;
        }
        const check = () => {
          const now = performance.now();
          if (now - last >= 500 || now - start >= 3000) {
            obs.disconnect();
            res();
          } else {
            setTimeout(check, 100);
          }
        };
        setTimeout(check, 100);
      }),
  );
}

/** Disable animations/transitions and force eager image loading (per CLAUDE.md). */
async function applyFreeze(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;}',
  });
  await page.evaluate(() => {
    for (const img of document.querySelectorAll('img[loading="lazy"]'))
      (img as HTMLImageElement).loading = 'eager';
  });
}

/** Run `fn` over `items` with at most `limit` in flight, preserving input order. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  const queue = items.entries(); // shared iterator; each worker pulls the next [index, item]
  const worker = async () => {
    for (const [idx, item] of queue) {
      results[idx] = await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
