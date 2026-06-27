---
"@getrefractjs/core": minor
"@getrefractjs/cli": minor
"@getrefractjs/mcp": minor
---

Initial release.

- Multi-viewport responsive rendering via `render()` — one Chromium browser, one
  context per viewport in parallel, with 20 device presets, freeze mode, smart
  waits, element-scoped capture, and teaching error messages.
- Structured findings per viewport: `horizontal_overflow`, `element_clipped`,
  `text_overflow`, `tap_target_small` (mobile), and `image_no_alt`.
- `refract` CLI and the `render_responsive` MCP server (one response with
  downscaled previews, absolute saved paths, and findings JSON).
