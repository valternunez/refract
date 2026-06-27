---
"@getrefractjs/core": patch
"@getrefractjs/cli": patch
"@getrefractjs/mcp": patch
---

Audit fixes. A corrupt/truncated baseline PNG is now reported as `no_baseline` for that
viewport instead of crashing the whole `refract diff` run; a `--selector`/`selector` that
matches nothing throws a teaching error naming the selector and viewport instead of a raw
30s locator timeout; HTTP errors distinguish 4xx ("the page isn't there") from 5xx ("the
server errored"); `--threshold` is validated to 0–1 in both the CLI (now accepts `0`,
rejects out-of-range) and the MCP `diff_responsive` schema; the diff `report.html` escapes
interpolated preset/alias text; and the MCP preview downscale parses each image once.
