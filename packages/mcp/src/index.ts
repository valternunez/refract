import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  DIFF_RESPONSIVE_DESCRIPTION,
  RENDER_RESPONSIVE_DESCRIPTION,
  diffResponsive,
  diffResponsiveSchema,
  renderResponsive,
  renderResponsiveSchema,
} from './tool';

// Keep the advertised server version in sync with the package (resolves in both
// the built dist/ and the published tarball, where package.json sits beside it).
const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

const server = new McpServer({ name: 'refract', version });

server.registerTool(
  'render_responsive',
  { description: RENDER_RESPONSIVE_DESCRIPTION, inputSchema: renderResponsiveSchema },
  renderResponsive,
);

server.registerTool(
  'diff_responsive',
  { description: DIFF_RESPONSIVE_DESCRIPTION, inputSchema: diffResponsiveSchema },
  diffResponsive,
);

await server.connect(new StdioServerTransport());
