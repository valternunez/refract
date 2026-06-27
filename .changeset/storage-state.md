---
"@getrefractjs/core": minor
"@getrefractjs/cli": minor
"@getrefractjs/mcp": minor
---

Authenticated pages: render logged-in pages by reusing a Playwright storage-state
JSON (cookies + localStorage). Exposed as `storageState` (core), `--storage-state`
(CLI), and a `storageState` argument (MCP `render_responsive`). A missing or
malformed file fails fast with a teaching error showing how to generate one
(`playwright codegen --save-storage`).
