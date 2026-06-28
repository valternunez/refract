---
"@getrefractjs/core": patch
"@getrefractjs/cli": patch
"@getrefractjs/mcp": patch
---

A sweep of real-site QA fixes:

- **No CSP crash** — `freeze`/`injectCss` set `bypassCSP`, so strict `style-src` pages (mastodon) render.
- **sr-only noise gone** — a small-size floor in the visibility check drops 1px screen-reader-only /
  tracking elements that were flooding `text_overflow` (airbnb/reddit 20+ → 0) and `tap_target_small`.
- **Shadow DOM coverage** — the findings scan descends into open shadow roots (web components).
- **RTL** — left-side horizontal overflow is detected on `dir="rtl"` pages.
- **`viewport_meta_missing`** also fires when the meta lacks `width=device-width`.
- **HTTP 401/403** teaches access-denied; generic load errors drop Playwright's `Call log:` tail.
- **`text_too_small`** skips `aria-hidden` subtrees; **`image_no_alt`** reports a helpful detail for a
  src-less image; saved paths use forward slashes; default full-page renders scroll-prefetch lazy content.
