---
"@getrefractjs/mcp": minor
---

Add a `diff_responsive` MCP tool: visual regression in-band. It renders a URL,
compares each viewport against a saved baseline (`pixelmatch`), and returns a
per-viewport status with the % of pixels changed, a downscaled diff image for each
changed viewport, and a `report.html` path. Call with `update: true` to (re)write the
baseline; a missing baseline returns teaching text. Accepts the same options as
`render_responsive` plus `baseline` and `threshold`.
