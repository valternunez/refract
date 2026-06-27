---
"@getrefractjs/core": patch
"@getrefractjs/cli": patch
"@getrefractjs/mcp": patch
---

Annotated screenshots: `render({ annotate: true })` (core), `--annotate` (CLI), and `annotate`
(MCP `render_responsive`) draw outline boxes over each finding — using its `rect`, errors red and
warnings amber — onto the screenshot, so the image itself shows what broke. Off by default;
full-page only (ignored when `selector` clips to one element).
