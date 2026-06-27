import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RENDER_RESPONSIVE_DESCRIPTION, renderResponsive, renderResponsiveSchema } from './tool';

const server = new McpServer({ name: 'refract', version: '0.0.0' });

server.registerTool(
  'render_responsive',
  { description: RENDER_RESPONSIVE_DESCRIPTION, inputSchema: renderResponsiveSchema },
  renderResponsive,
);

await server.connect(new StdioServerTransport());
