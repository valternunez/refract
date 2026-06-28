---
"@getrefractjs/core": patch
"@getrefractjs/cli": patch
"@getrefractjs/mcp": patch
---

Fixes from a second, independent black-box QA pass:

- **A hung subresource no longer fails the render** (navigate on `domcontentloaded`, cap `fonts.ready`,
  `window.stop()` stragglers before capture) — fixes real sites like cnn.com timing out.
- **Very tall pages don't crash the capture** — fall back to a height-capped image past Chromium's limit.
- **sr-only via `clip`/`clip-path:inset(50%)`/`text-indent:-9999px`** no longer false-fires overflow/text findings.
- **Long unbreakable token/URL** that makes the page scroll is now flagged `horizontal_overflow`.
- **`tap_target_small`** covers native checkboxes/radios.
- Teaching errors for file-download (PDF) and empty (204) URLs; clearer `element_clipped` wording.
