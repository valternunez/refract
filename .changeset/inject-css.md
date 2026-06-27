---
"@getrefractjs/core": minor
"@getrefractjs/cli": minor
"@getrefractjs/mcp": minor
---

Add `injectCss` (core), `--inject-css` (CLI, including `refract diff`), and
`injectCss` (MCP `render_responsive`): a CSS string injected into the page just
before capture, to hide dynamic/flaky elements for stable diffs or preview a style
tweak. Applied after `freeze` and before findings, so hidden elements aren't flagged.
