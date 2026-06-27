---
"@getrefractjs/core": patch
"@getrefractjs/cli": patch
"@getrefractjs/mcp": patch
---

Two new findings heuristics (mobile-only): `text_too_small` (warn) flags body text under 12px on
a mobile viewport — short labels/badges are ignored so it stays low-noise — and
`viewport_meta_missing` (error) flags a page with no `<meta name="viewport">`, which makes phones
render it at a desktop width and scale down.
