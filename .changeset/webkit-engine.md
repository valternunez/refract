---
"@getrefractjs/core": minor
"@getrefractjs/cli": minor
"@getrefractjs/mcp": minor
---

Add a WebKit rendering engine: `engine: "webkit"` (core), `--engine webkit` (CLI,
including `refract diff`), and `engine` (MCP `render_responsive`/`diff_responsive`)
render with the real Safari/WebKit engine — the closest local proxy to iOS Safari.
Default stays `chromium`; install WebKit once with `npx playwright install webkit`. A
missing engine returns a teaching error. Firefox is intentionally not supported yet (it
can't emulate `isMobile` and ignores `deviceScaleFactor`).
