import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// The tool description is the product: an agent reads this to decide whether and
// how to call the tool. It (a) says what it does, (b) shows a runnable example,
// (c) says what it does NOT do. Keep it that way — see CLAUDE.md "agent-first".
const RENDER_RESPONSIVE_DESCRIPTION = `Render a URL at multiple device viewports and return screenshots so you can verify responsive layout.

Use this to check that a page looks right across mobile, tablet, and desktop — e.g. after a CSS fix, before merging, or to find layout breakage on a deployed preview.

Example:
  render_responsive({ url: "http://localhost:3000" })
  → renders at mobile, tablet, and desktop; returns a downscaled preview image per
    viewport plus the absolute path to the full-resolution PNG saved on disk.

You can narrow viewports (render_responsive({ url, viewports: ["iphone-15", "1440x900"] }))
and clip to one element (render_responsive({ url, selector: ".hero" })).

This tool does NOT drive a general-purpose browser — it cannot click, type, log in,
or navigate. It renders a URL at fixed viewports and returns images. For scripted
browser interaction use a Playwright/Puppeteer MCP instead.`;

const server = new McpServer({ name: 'refract', version: '0.0.0' });

server.registerTool(
  'render_responsive',
  {
    description: RENDER_RESPONSIVE_DESCRIPTION,
    inputSchema: {
      url: z.string().describe('The URL to render. The only required argument.'),
      viewports: z
        .array(z.string())
        .optional()
        .describe('Preset names or WxH. Defaults to mobile, tablet, desktop.'),
      selector: z
        .string()
        .optional()
        .describe('CSS selector to clip the screenshot to one element.'),
      freeze: z.boolean().optional().describe('Disable animations and force eager image loading.'),
      waitFor: z.string().optional().describe('Wait for this selector before capturing.'),
    },
  },
  async () => ({
    // Scaffold stub. Wires the tool into the MCP surface; the render handler
    // lands with v0.1. Errors teach — this points at the spec, not "internal error".
    isError: true,
    content: [
      {
        type: 'text',
        text: 'render_responsive is not implemented yet — scaffold stub. See CLAUDE.md V0.1.',
      },
    ],
  }),
);

await server.connect(new StdioServerTransport());
