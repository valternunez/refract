# @getrefractjs/mcp

Refract's MCP server — one tool, `render_responsive`, so coding agents can do
responsive QA without scripting a browser.

```json
{ "mcpServers": { "refract": { "command": "npx", "args": ["-y", "@getrefractjs/mcp"] } } }
```

`render_responsive({ url })` renders the URL across viewports and returns, in one
response: structured **findings** (JSON keyed by preset), absolute saved paths, and
a downscaled preview image per viewport. Load failures come back as teaching errors.

Needs Chromium once: `npx playwright install chromium`. MIT licensed.
