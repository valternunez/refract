/**
 * Refract core — the library behind the CLI and MCP server.
 *
 * Renders a URL at N viewports using a single Chromium browser with one context
 * per viewport, rendered in parallel. See CLAUDE.md "V0.1".
 */

import { mkdir, readFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { join, resolve } from 'node:path';
import { type Browser, type Page, type Response, chromium } from 'playwright';
import { type Finding, collectFindings } from './findings';
import { type ResolvedViewport, resolveViewport } from './presets';

export type { Finding } from './findings';
export { collectFindings } from './findings';
export type { DiffResult, DiffStatus } from './diff';
export { diffShots, writeDiffReport } from './diff';

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
  /**
   * CSS injected into the page just before capture — hide dynamic/flaky elements
   * (clocks, live badges, ads) for stable diffs, or preview a style tweak. Applied
   * after `freeze` and before findings, so a hidden element stops being flagged.
   * @example injectCss: '#clock, .ad { visibility: hidden }'
   */
  injectCss?: string;
  /** Explicit gate: wait for this selector before capturing. */
  waitFor?: string;
  /**
   * Explicit gate: a JS expression polled in the page until it returns truthy
   * before capturing (e.g. `'window.__ready === true'`). For app-specific
   * readiness the smart waits can't detect. Throws a teaching error if it never
   * becomes truthy within 10s.
   */
  waitForFunction?: string;
  /** Cap (ms) for the best-effort network-idle wait. Defaults to `10000`. */
  networkIdleMs?: number;
  /** Output directory for full-res PNGs. Defaults to `./refract-shots`. */
  out?: string;
  /** Override each viewport's deviceScaleFactor (e.g. `1` for smaller files). */
  dpr?: number;
  /** Max viewports rendered in parallel. Defaults to `os.cpus().length`. */
  concurrency?: number;
  /**
   * Path to a Playwright storage-state JSON (cookies + localStorage) so the page
   * renders **logged in**. Use the standard Playwright format — generate one with
   * `npx playwright codegen --save-storage=auth.json <url>` or, in code,
   * `await context.storageState({ path: 'auth.json' })`. The file's cookies are
   * sent to `url`, so don't pair an auth file from one origin with an untrusted URL.
   */
  storageState?: string;
}

/** One rendered viewport. `image` is the full-resolution PNG buffer; `savedPath` is the absolute full-res path. */
export interface Shot {
  preset: string;
  width: number;
  height: number;
  image: Buffer;
  savedPath: string;
  /** Structured responsive/accessibility findings for this viewport. */
  findings: Finding[];
  /**
   * Other requested device names that render identically to this one (same
   * geometry + DPR + touch, differing only by user-agent) and were bundled into
   * this single result. Omitted when nothing else matched.
   */
  aliases?: string[];
}

/**
 * Render `url` at each viewport and return one {@link Shot} per **unique render**,
 * each carrying structured responsive/accessibility {@link Finding}s.
 *
 * Viewports that render identically (same geometry + DPR + touch, differing only
 * by user-agent — e.g. `iphone-17-pro` and `iphone-16-pro`) are bundled into one
 * result: rendered once, with the extra device names on {@link Shot.aliases}.
 *
 * Launches a single Chromium browser and creates one context per unique render,
 * in parallel (capped at `concurrency`). Throws a teaching error for unknown
 * viewport tokens, unreachable URLs, missing `waitFor` selectors, unresolved
 * `waitForFunction` predicates, and unreadable `storageState` files.
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
    injectCss,
    waitFor,
    waitForFunction,
    networkIdleMs,
    out = './refract-shots',
    dpr,
    concurrency = cpus().length,
    storageState,
  } = options;

  const resolved = viewports.map(resolveViewport); // throws teaching error on bad token
  const outDir = resolve(out);
  await mkdir(outDir, { recursive: true });

  // Validate the auth state once, up front, with an error that teaches — rather
  // than letting a raw Playwright ENOENT surface from inside each worker.
  let statePath: string | undefined;
  if (storageState) {
    statePath = resolve(storageState);
    try {
      JSON.parse(await readFile(statePath, 'utf8'));
    } catch (err) {
      throw new Error(
        `Could not read storage-state file "${storageState}": ${(err as Error).message}. Generate one by logging in once: \`npx playwright codegen --save-storage=auth.json <url>\` (or in code: \`await context.storageState({ path: 'auth.json' })\`), then pass its path.`,
      );
    }
  }

  // Bundle viewports that produce an identical render (same geometry + DPR + touch
  // + isMobile — they differ only by user-agent, which rarely affects layout). Each
  // group renders once; the first requested member is canonical, the rest aliases.
  const groups = new Map<string, { canonical: ResolvedViewport; aliases: string[] }>();
  for (const vp of resolved) {
    const key = `${vp.width}x${vp.height}@${dpr ?? vp.deviceScaleFactor}|${vp.hasTouch ? 't' : ''}${vp.isMobile ? 'm' : ''}`;
    const group = groups.get(key);
    if (!group) groups.set(key, { canonical: vp, aliases: [] });
    else if (vp.name !== group.canonical.name && !group.aliases.includes(vp.name))
      group.aliases.push(vp.name);
  }

  const browser = await chromium.launch(); // ONE browser, N contexts
  try {
    return await mapPool([...groups.values()], Math.max(1, concurrency), (g) =>
      renderOne(browser, url, g.canonical, g.aliases, {
        selector,
        freeze,
        injectCss,
        waitFor,
        waitForFunction,
        networkIdleMs,
        outDir,
        dpr,
        storageState: statePath,
      }),
    );
  } finally {
    await browser.close();
  }
}

interface RenderOneOpts {
  selector?: string;
  freeze: boolean;
  injectCss?: string;
  waitFor?: string;
  waitForFunction?: string;
  networkIdleMs?: number;
  outDir: string;
  dpr?: number;
  /** Absolute path to a validated Playwright storage-state JSON, or undefined. */
  storageState?: string;
}

/** Render a single viewport in its own context, always closing the context. */
async function renderOne(
  browser: Browser,
  url: string,
  vp: ResolvedViewport,
  aliases: string[],
  opts: RenderOneOpts,
): Promise<Shot> {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: opts.dpr ?? vp.deviceScaleFactor,
    userAgent: vp.userAgent,
    hasTouch: vp.hasTouch,
    isMobile: vp.isMobile,
    storageState: opts.storageState,
  });
  try {
    const page = await context.newPage();
    await navigate(page, url);
    await smartWaits(page, opts);
    if (opts.freeze) await applyFreeze(page);
    // After freeze, before capture+findings: user CSS can hide flaky elements so
    // they neither show in the shot nor get flagged as findings.
    if (opts.injectCss) await page.addStyleTag({ content: opts.injectCss });

    const savedPath = join(opts.outDir, `${vp.name}.png`);
    const image = opts.selector
      ? await page.locator(opts.selector).screenshot({ path: savedPath })
      : await page.screenshot({ path: savedPath });

    const findings = await collectFindings(page, vp.isMobile);

    return {
      preset: vp.name,
      width: vp.width,
      height: vp.height,
      image,
      savedPath,
      findings,
      aliases: aliases.length ? aliases : undefined,
    };
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
    const status = response.statusText()
      ? `${response.status()} ${response.statusText()}`
      : `${response.status()}`;
    throw new Error(
      `"${url}" returned HTTP ${status}. Check the path and that the server is healthy.`,
    );
  }
}

interface WaitOpts {
  waitFor?: string;
  waitForFunction?: string;
  networkIdleMs?: number;
}

/**
 * Apply the smart-wait stack: networkidle (best-effort, capped by `networkIdleMs`),
 * fonts, layout settle, then optional selector and JS-predicate gates.
 */
async function smartWaits(page: Page, opts: WaitOpts): Promise<void> {
  // networkidle is a lie — some apps poll forever, so swallow the timeout.
  await page
    .waitForLoadState('networkidle', { timeout: opts.networkIdleMs ?? 10000 })
    .catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await settleLayout(page);

  if (opts.waitFor) {
    try {
      await page.waitForSelector(opts.waitFor, { timeout: 10000 });
    } catch {
      // Errors teach: name the selector and point at concrete fixes.
      throw new Error(
        `waitFor selector "${opts.waitFor}" never appeared within 10s — check it is spelled correctly and actually renders on this page (try freeze: true if it animates in).`,
      );
    }
  }

  if (opts.waitForFunction) {
    try {
      // A string pageFunction is polled as a JS expression in the page context.
      await page.waitForFunction(opts.waitForFunction, undefined, { timeout: 10000 });
    } catch {
      throw new Error(
        `waitForFunction "${opts.waitForFunction}" did not become truthy within 10s — check the expression is valid and eventually returns a truthy value on this page (it is polled as a JS expression in the page).`,
      );
    }
  }
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
