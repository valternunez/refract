import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { diffShots, render, writeDiffReport } from '@getrefractjs/core';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import sharp from 'sharp';
import { z } from 'zod';

/**
 * The tool description is the product: an agent reads this to decide whether and
 * how to call the tool. It (a) says what it does, (b) shows a runnable example,
 * (c) says what it does NOT do. Keep it that way — see CLAUDE.md "agent-first".
 */
export const RENDER_RESPONSIVE_DESCRIPTION = `Render a URL at multiple device viewports and return screenshots so you can verify responsive layout.

Use this to check that a page looks right across mobile, tablet, and desktop — e.g. after a CSS fix, before merging, or to find layout breakage on a deployed preview.

Example:
  render_responsive({ url: "http://localhost:3000" })
  → renders at mobile, tablet, and desktop; returns a downscaled preview image per
    viewport plus the absolute path to the full-resolution PNG saved on disk.

It also returns structured findings per viewport — horizontal overflow, elements clipped past the viewport, clipped or truncated text, tap targets under 44×44 on mobile, and images missing alt — so you can act on issues without eyeballing pixels. A finding looks like { type: "horizontal_overflow", severity: "error", detail: "scrollWidth=420 viewport=375", selector: "div.card" }.

You can narrow viewports (render_responsive({ url, viewports: ["iphone-15", "1440x900"] }))
and clip to one element (render_responsive({ url, selector: ".hero" })). If the page is
ready only after some app-specific signal, gate on it with waitForFunction (render_responsive({ url, waitForFunction: "window.__ready === true" })).

To screenshot pages behind a login, pass storageState — a saved Playwright auth state
(cookies + localStorage), e.g. render_responsive({ url, storageState: "./auth.json" }).
Generate one once with \`npx playwright codegen --save-storage=auth.json <url>\`.

To check the real Safari/WebKit engine (≈ iOS Safari), pass engine: "webkit"
(render_responsive({ url, engine: "webkit" })) — install it once with \`npx playwright install webkit\`.

This tool does NOT drive a general-purpose browser — it cannot click, type, navigate,
or perform a login flow. It can reuse a saved auth state (storageState) to render a
page that is already logged in, but it cannot log in for you. It renders a URL at fixed
viewports and returns images. For scripted browser interaction use a Playwright/Puppeteer MCP instead.

Security: it loads ANY url you give it — including file:// (local files) and internal/private hosts — and returns the rendered pixels. The storageState file's cookies are sent to url, so never pair an auth file from one origin with an untrusted url. Do not point it at untrusted or sensitive URLs.`;

/** Input shape for `render_responsive`, shared with the MCP tool registration. */
export const renderResponsiveSchema = {
  url: z.string().describe('The URL to render. The only required argument.'),
  viewports: z
    .array(z.string())
    .optional()
    .describe('Preset names or WxH. Defaults to mobile, tablet, desktop.'),
  selector: z.string().optional().describe('CSS selector to clip the screenshot to one element.'),
  freeze: z.boolean().optional().describe('Disable animations and force eager image loading.'),
  injectCss: z
    .string()
    .optional()
    .describe(
      'CSS injected before capture, e.g. to hide dynamic/flaky elements: "#clock{visibility:hidden}".',
    ),
  waitFor: z.string().optional().describe('Wait for this selector before capturing.'),
  waitForFunction: z
    .string()
    .optional()
    .describe(
      'JS expression polled in the page until truthy before capturing (e.g. "window.__ready === true").',
    ),
  networkIdleMs: z
    .number()
    .optional()
    .describe('Cap in ms for the best-effort network-idle wait (default 10000).'),
  storageState: z
    .string()
    .optional()
    .describe(
      'Path to a Playwright storage-state JSON (cookies + localStorage) to render the page logged in. Generate with `npx playwright codegen --save-storage=auth.json <url>`.',
    ),
  engine: z
    .enum(['chromium', 'webkit'])
    .optional()
    .describe(
      'Rendering engine — webkit ≈ iOS Safari. Default chromium. Needs `npx playwright install webkit` once.',
    ),
};

type RenderResponsiveArgs = z.infer<z.ZodObject<typeof renderResponsiveSchema>>;

/** Agent previews are capped at this width; the full-res PNG still lands on disk. */
const MAX_PREVIEW_WIDTH = 800;

/**
 * Downscale a PNG to at most {@link MAX_PREVIEW_WIDTH} wide so it doesn't blow the
 * agent's context window. Narrower images are returned untouched.
 */
export async function downscalePreview(png: Buffer): Promise<Buffer> {
  // One sharp instance for both the header read and the resize, so the buffer is
  // parsed once. Narrow images are returned untouched (no re-encode).
  const image = sharp(png);
  const { width } = await image.metadata();
  if (!width || width <= MAX_PREVIEW_WIDTH) return png;
  return image.resize({ width: MAX_PREVIEW_WIDTH }).png().toBuffer();
}

/**
 * Render `url` at each viewport and return one response containing: a text
 * manifest of absolute saved paths, then a labelled downscaled preview image per
 * viewport. Render failures come back as a teaching error the agent can act on.
 */
export async function renderResponsive(args: RenderResponsiveArgs): Promise<CallToolResult> {
  let shots: Awaited<ReturnType<typeof render>>;
  try {
    shots = await render(args);
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: `render_responsive failed: ${(err as Error).message}` }],
    };
  }

  // Identical renders (same geometry, different device) are bundled by render().
  const also = (s: (typeof shots)[number]) =>
    s.aliases?.length ? ` [also: ${s.aliases.join(', ')}]` : '';

  const manifest = [
    `Rendered ${args.url} at ${shots.length} unique render(s). Full-resolution PNGs saved to:`,
    ...shots.map((s) => `- ${s.preset} (${s.width}×${s.height}) → ${s.savedPath}${also(s)}`),
  ].join('\n');

  const content: CallToolResult['content'] = [{ type: 'text', text: manifest }];
  content.push({
    type: 'text',
    text: `Findings:\n${JSON.stringify(
      shots.map((s) => ({ preset: s.preset, aliases: s.aliases, findings: s.findings })),
      null,
      2,
    )}`,
  });
  for (const shot of shots) {
    const preview = await downscalePreview(shot.image);
    content.push({
      type: 'text',
      text: `${shot.preset} (${shot.width}×${shot.height})${also(shot)}:`,
    });
    content.push({ type: 'image', data: preview.toString('base64'), mimeType: 'image/png' });
  }
  return { content };
}

/**
 * Like render_responsive's description, this is product copy an agent reads to
 * decide when to call diff_responsive. See CLAUDE.md "agent-first".
 */
export const DIFF_RESPONSIVE_DESCRIPTION = `Compare a URL's current rendering against a saved baseline and report what changed visually, per viewport.

Use this to verify a change did NOT break layout — e.g. after a CSS fix, before merge, or against a deployed preview.

Example:
  diff_responsive({ url: "http://localhost:3000" })
  → renders mobile/tablet/desktop, compares each against ./refract-baseline/{preset}.png,
    and returns a per-viewport status (unchanged | changed | size_changed | no_baseline)
    with the % of pixels changed, a downscaled diff image for each changed viewport, and
    the path to a report.html (baseline | current | diff grid).

First run, no baseline yet: call once with update:true to save the current renders as the
baseline (diff_responsive({ url, update: true })), then call again after your change to compare.

It takes the same options as render_responsive (viewports, selector, freeze, injectCss,
waitFor, waitForFunction, storageState, …) plus baseline (dir, default ./refract-baseline),
threshold (0-1 pixel sensitivity, default 0.1), and update (rewrite the baseline). Tip:
injectCss to hide dynamic/flaky elements (clocks, ads) so they don't show as false changes.

This tool does NOT click, type, navigate, or log in — it renders fixed viewports and diffs pixels.

Security: it loads ANY url and reads/writes PNG files under the baseline and output dirs; the storageState file's cookies are sent to url. Don't point it at untrusted URLs.`;

/** Input shape for `diff_responsive`: the render params plus baseline controls. */
export const diffResponsiveSchema = {
  ...renderResponsiveSchema,
  baseline: z
    .string()
    .optional()
    .describe('Directory of baseline PNGs to compare against (default ./refract-baseline).'),
  update: z
    .boolean()
    .optional()
    .describe('Write the current renders as the new baseline instead of comparing.'),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('pixelmatch per-pixel sensitivity, 0-1 (default 0.1).'),
};

type DiffResponsiveArgs = z.infer<z.ZodObject<typeof diffResponsiveSchema>>;

/**
 * Render `url` and either (update) save the shots as the baseline, or compare against
 * it and return a per-viewport status summary, a downscaled diff image for each changed
 * viewport, and the path to an HTML report. Failures come back as a teaching error.
 */
export async function diffResponsive(args: DiffResponsiveArgs): Promise<CallToolResult> {
  const { baseline = './refract-baseline', update, threshold, ...renderArgs } = args;
  let shots: Awaited<ReturnType<typeof render>>;
  try {
    shots = await render(renderArgs);
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: `diff_responsive failed: ${(err as Error).message}` }],
    };
  }

  const baselineDir = resolve(baseline);
  const outDir = shots[0] ? dirname(shots[0].savedPath) : resolve('./refract-shots');

  if (update) {
    await mkdir(baselineDir, { recursive: true });
    for (const s of shots) await copyFile(s.savedPath, join(baselineDir, `${s.preset}.png`));
    return {
      content: [
        {
          type: 'text',
          text: `Wrote ${shots.length} baseline(s) to ${baselineDir}. Call diff_responsive again (without update) after your change to compare.`,
        },
      ],
    };
  }

  const results = await diffShots(shots, { baselineDir, outDir, threshold });
  const reportPath = await writeDiffReport(results, outDir);
  const changed = results.filter((r) => r.status !== 'unchanged');

  const summary = results
    .map((r) => {
      if (r.status === 'changed')
        return `- ${r.preset}: changed (${((r.diffRatio ?? 0) * 100).toFixed(2)}%)`;
      if (r.status === 'size_changed')
        return `- ${r.preset}: size_changed (${r.baselineWidth}×${r.baselineHeight} → ${r.width}×${r.height})`;
      if (r.status === 'no_baseline') return `- ${r.preset}: no_baseline`;
      return `- ${r.preset}: unchanged`;
    })
    .join('\n');

  const noBaseline = results.some((r) => r.status === 'no_baseline');
  const header = noBaseline
    ? `No baseline for some viewport(s) in ${baselineDir}. Call diff_responsive({ ..., update: true }) once to create it, then compare.`
    : changed.length === 0
      ? `No visual changes across ${results.length} viewport(s).`
      : `${changed.length} of ${results.length} viewport(s) changed.`;

  const content: CallToolResult['content'] = [
    { type: 'text', text: `${header}\n${summary}\n\nReport: ${reportPath}` },
  ];
  for (const r of changed) {
    if (!r.diffPath) continue; // size_changed/no_baseline have no diff image
    const preview = await downscalePreview(await readFile(r.diffPath));
    content.push({ type: 'text', text: `${r.preset} diff:` });
    content.push({ type: 'image', data: preview.toString('base64'), mimeType: 'image/png' });
  }
  return { content };
}
