# @getrefractjs/core

## 0.2.0

### Minor Changes

- d0c3aa3: Findings depth (0.2). `refract diff` / `diff_responsive` now report a per-viewport **findings
  delta** — which findings were fixed (gone since the baseline) or regressed (new) — alongside
  the pixel diff, so you can confirm a responsive fix landed without introducing a new issue. The
  baseline stores a `findings.json` snapshot (written by `--update` / `update: true`); older
  baselines without one simply omit the delta. New core exports `writeBaseline` + `findingLabel`
  and `DiffResult.findingsDelta`. Every element-backed finding now carries a `rect` (the culprit's
  box in document pixels, scroll-stable) and `horizontal_overflow` names the offending element.

### Patch Changes

- 03e924b: Annotated screenshots: `render({ annotate: true })` (core), `--annotate` (CLI), and `annotate`
  (MCP `render_responsive`) draw outline boxes over each finding — using its `rect`, errors red and
  warnings amber — onto the screenshot, so the image itself shows what broke. Off by default;
  full-page only (ignored when `selector` clips to one element).
- 079d56e: Two new findings heuristics (mobile-only): `text_too_small` (warn) flags body text under 12px on
  a mobile viewport — short labels/badges are ignored so it stays low-noise — and
  `viewport_meta_missing` (error) flags a page with no `<meta name="viewport">`, which makes phones
  render it at a desktop width and scale down.
- 371824e: A sweep of real-site QA fixes:

  - **No CSP crash** — `freeze`/`injectCss` set `bypassCSP`, so strict `style-src` pages (mastodon) render.
  - **sr-only noise gone** — a small-size floor in the visibility check drops 1px screen-reader-only /
    tracking elements that were flooding `text_overflow` (airbnb/reddit 20+ → 0) and `tap_target_small`.
  - **Shadow DOM coverage** — the findings scan descends into open shadow roots (web components).
  - **RTL** — left-side horizontal overflow is detected on `dir="rtl"` pages.
  - **`viewport_meta_missing`** also fires when the meta lacks `width=device-width`.
  - **HTTP 401/403** teaches access-denied; generic load errors drop Playwright's `Call log:` tail.
  - **`text_too_small`** skips `aria-hidden` subtrees; **`image_no_alt`** reports a helpful detail for a
    src-less image; saved paths use forward slashes; default full-page renders scroll-prefetch lazy content.

- 6ab535a: Fixes from a second, independent black-box QA pass:

  - **A hung subresource no longer fails the render** (navigate on `domcontentloaded`, cap `fonts.ready`,
    `window.stop()` stragglers before capture) — fixes real sites like cnn.com timing out.
  - **Very tall pages don't crash the capture** — fall back to a height-capped image past Chromium's limit.
  - **sr-only via `clip`/`clip-path:inset(50%)`/`text-indent:-9999px`** no longer false-fires overflow/text findings.
  - **Long unbreakable token/URL** that makes the page scroll is now flagged `horizontal_overflow`.
  - **`tap_target_small`** covers native checkboxes/radios.
  - Teaching errors for file-download (PDF) and empty (204) URLs; clearer `element_clipped` wording.

- e47da73: QA fixes from a full-surface shake-down:

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

- 3f74885: `tap_target_small` noise reduction: flag an interactive element only when it's small in **both**
  dimensions (a wide-but-short link like 354×40 is tappable, so no longer flagged), and exempt **inline
  text links** in a sentence (WCAG 2.5.8 inline exception). On real sites this cut the finding from
  ~90–99% of all controls to the genuinely tiny ones. Icon/image links still use their real (image) tap
  area.

## 0.1.0

### Minor Changes

- 8a4593d: Initial release.

  - Multi-viewport responsive rendering via `render()` — one Chromium browser, one
    context per viewport in parallel, with 20 device presets, freeze mode, smart
    waits, element-scoped capture, and teaching error messages.
  - Structured findings per viewport: `horizontal_overflow`, `element_clipped`,
    `text_overflow`, `tap_target_small` (mobile), and `image_no_alt`.
  - `refract` CLI and the `render_responsive` MCP server (one response with
    downscaled previews, absolute saved paths, and findings JSON).

- 0e23fd3: Add `injectCss` (core), `--inject-css` (CLI, including `refract diff`), and
  `injectCss` (MCP `render_responsive`): a CSS string injected into the page just
  before capture, to hide dynamic/flaky elements for stable diffs or preview a style
  tweak. Applied after `freeze` and before findings, so hidden elements aren't flagged.
- c5349ca: Authenticated pages: render logged-in pages by reusing a Playwright storage-state
  JSON (cookies + localStorage). Exposed as `storageState` (core), `--storage-state`
  (CLI), and a `storageState` argument (MCP `render_responsive`). A missing or
  malformed file fails fast with a teaching error showing how to generate one
  (`playwright codegen --save-storage`).
- 0bb57f9: Visual diff: `refract diff <url>` compares a fresh render against plain-folder
  baselines (`./refract-baseline/{preset}.png`) using `pixelmatch`. `--update` writes
  the baseline; a bare run reports `unchanged`/`changed`/`size_changed`/`no_baseline`
  per viewport, writes `{preset}.diff.png` for changes and a brand-styled `report.html`
  (baseline │ current │ diff grid), and exits non-zero on any change for CI. New core
  exports `diffShots` + `writeDiffReport`. Adds dependencies `pixelmatch` (v5, for CJS
  compatibility) and `pngjs`.
- e9ca937: Wait helpers: gate capture on an app-specific JS predicate with `waitForFunction`
  (`--wait-for-function` CLI) — polled in the page until truthy, with a teaching error
  if it never resolves — and make the best-effort network-idle cap configurable with
  `networkIdleMs` (`--wait-for-network-idle-ms` CLI). Exposed across core, CLI, and the
  MCP `render_responsive` tool.
- 9c8b350: Add a WebKit rendering engine: `engine: "webkit"` (core), `--engine webkit` (CLI,
  including `refract diff`), and `engine` (MCP `render_responsive`/`diff_responsive`)
  render with the real Safari/WebKit engine — the closest local proxy to iOS Safari.
  Default stays `chromium`; install WebKit once with `npx playwright install webkit`. A
  missing engine returns a teaching error. Firefox is intentionally not supported yet (it
  can't emulate `isMobile` and ignores `deviceScaleFactor`).

### Patch Changes

- f8f39fa: Audit fixes. A corrupt/truncated baseline PNG is now reported as `no_baseline` for that
  viewport instead of crashing the whole `refract diff` run; a `--selector`/`selector` that
  matches nothing throws a teaching error naming the selector and viewport instead of a raw
  30s locator timeout; HTTP errors distinguish 4xx ("the page isn't there") from 5xx ("the
  server errored"); `--threshold` is validated to 0–1 in both the CLI (now accepts `0`,
  rejects out-of-range) and the MCP `diff_responsive` schema; the diff `report.html` escapes
  interpolated preset/alias text; and the MCP preview downscale parses each image once.
- 52b0004: `text_overflow` findings no longer flag intentional ellipsis truncation: elements
  with `text-overflow: ellipsis` (e.g. the `.truncate` utility) are designed to
  truncate, so only hard clipping with no ellipsis affordance is reported now. Removes
  a common false positive on dashboards while still catching genuine clipping.
