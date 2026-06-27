# @getrefractjs/cli

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
- Updated dependencies [f8f39fa]
- Updated dependencies [8a4593d]
- Updated dependencies [0e23fd3]
- Updated dependencies [c5349ca]
- Updated dependencies [52b0004]
- Updated dependencies [0bb57f9]
- Updated dependencies [e9ca937]
- Updated dependencies [9c8b350]
  - @getrefractjs/core@0.1.0
