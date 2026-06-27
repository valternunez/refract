import { render } from '@getrefractjs/core';
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
};

type RenderResponsiveArgs = z.infer<z.ZodObject<typeof renderResponsiveSchema>>;

/** Agent previews are capped at this width; the full-res PNG still lands on disk. */
const MAX_PREVIEW_WIDTH = 800;

/**
 * Downscale a PNG to at most {@link MAX_PREVIEW_WIDTH} wide so it doesn't blow the
 * agent's context window. Narrower images are returned untouched.
 */
export async function downscalePreview(png: Buffer): Promise<Buffer> {
  const { width } = await sharp(png).metadata();
  if (!width || width <= MAX_PREVIEW_WIDTH) return png;
  return sharp(png).resize({ width: MAX_PREVIEW_WIDTH }).png().toBuffer();
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
