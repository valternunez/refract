---
"@getrefractjs/core": patch
"@getrefractjs/cli": patch
"@getrefractjs/mcp": patch
---

QA fixes from a full-surface shake-down:

- **Full-page screenshots.** Captures are now the whole page (`fullPage`), not just the first
  viewport fold — so the shot shows what broke below the fold and the document-coordinate finding
  `rect`s and `--annotate` overlay line up with the image. (The README/MCP/JSDoc already documented
  full-page; only the screenshot call had regressed to viewport-only.) MCP previews are now bounded to
  an 800×2400 box so a long page doesn't blow the agent's context; the full-res PNG on disk stays full.
- **Tap-target false positive on icon/image links fixed.** An inline `<a>` wrapping an image/icon was
  measured by its line-box height (e.g. 120×21 around a 120×120 image) and wrongly flagged
  `tap_target_small`. Tap size is now the union of the control and its replaced children (`img`, `svg`,
  `picture`, `canvas`, `video`); genuinely small controls still fire.
- **CSS containment respected.** A child clipped by `contain: paint | strict | content` is no longer a
  false `element_clipped` / `horizontal_overflow`.
- **Near-zero opacity ignored.** An effectively-invisible element (e.g. `opacity:0.001`) no longer trips
  `text_too_small`.
- **`--viewports <number>` teaches instead of crashing.** `--viewports 1280` (or hex like `0x0`) used to
  throw `flags.viewports.split is not a function`; it now reaches the unknown-viewport teaching error.
- **Dash-prefixed flag values don't dump a stack.** `--concurrency -1` / `--dpr -1` now print a clean
  `refract:` message instead of a raw `CACError` (use `--concurrency=-1` to hit the positive-number hint).
- **A no-match `--selector` fails in ~10s instead of 30s**, with the same teaching message.
