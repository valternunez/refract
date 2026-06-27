---
"@getrefractjs/core": minor
"@getrefractjs/cli": minor
"@getrefractjs/mcp": minor
---

Wait helpers: gate capture on an app-specific JS predicate with `waitForFunction`
(`--wait-for-function` CLI) — polled in the page until truthy, with a teaching error
if it never resolves — and make the best-effort network-idle cap configurable with
`networkIdleMs` (`--wait-for-network-idle-ms` CLI). Exposed across core, CLI, and the
MCP `render_responsive` tool.
