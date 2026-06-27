# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] - 2026-06-27

### Added
- **WebKit engine (`--engine`).** Render with the real Safari/WebKit engine (≈ iOS
  Safari) via `engine: "webkit"` (core), `--engine webkit` (CLI, incl. `refract diff`),
  or `engine` (MCP `render_responsive`/`diff_responsive`). Default stays `chromium`;
  install WebKit once with `npx playwright install webkit`. A missing engine returns a
  teaching error. Firefox is intentionally not supported yet.
- **CI recipe.** A copy-ready GitHub Actions workflow
  (`examples/github-actions/visual-diff.yml`) + README "Use in CI" section that run
  `refract diff` against a deployed preview on each PR, fail on a regression, and
  upload the report + diff PNGs as an artifact.
- **MCP `diff_responsive` tool.** Visual regression in-band for agents: renders,
  compares against a saved baseline, and returns a per-viewport status with the % of
  pixels changed, a downscaled diff image for each changed viewport, and a `report.html`
  path. `update: true` (re)writes the baseline; a missing baseline returns teaching text.
  Accepts the same options as `render_responsive` plus `baseline`, `threshold`.
- **`injectCss` / `--inject-css`.** Inject a CSS string into the page just before
  capture — hide dynamic/flaky elements (clocks, live badges, ads) for stable diffs,
  or preview a style tweak. Applied after `freeze` and before findings, so hidden
  elements stop being flagged. Available in core, CLI (incl. `refract diff`), and the
  MCP `render_responsive` tool.
- **Visual diff (`refract diff`).** Baseline visual-regression: render a URL and
  compare each viewport against a saved baseline PNG with `pixelmatch`. Plain-folder
  baselines (`./refract-baseline/{preset}.png`); `--update` (re)writes them. Per
  viewport reports `unchanged` / `changed` (with % and a `{preset}.diff.png`) /
  `size_changed` / `no_baseline`, writes a brand-styled `report.html`
  (baseline │ current │ diff grid), and **exits non-zero on any change** for CI.
  New core exports `diffShots` + `writeDiffReport`; adds `pixelmatch` + `pngjs`.
- **Wait helpers (`waitForFunction`, `networkIdleMs`).** Gate capture on an
  app-specific readiness predicate — a JS expression polled in the page until
  truthy (`waitForFunction` core, `--wait-for-function` CLI, `waitForFunction` MCP),
  with a teaching error if it never resolves. And make the best-effort network-idle
  wait's cap configurable (`networkIdleMs` core, `--wait-for-network-idle-ms` CLI,
  `networkIdleMs` MCP; default still 10000, still swallowed on expiry).
- **Authenticated pages (`storageState`).** Render logged-in pages by reusing a
  Playwright storage-state JSON (cookies + localStorage) — the standard format,
  generated with `playwright codegen --save-storage`. Exposed as `storageState`
  (core `render()`), `--storage-state <path>` (CLI), and a `storageState` argument
  (MCP `render_responsive`). A missing/malformed file fails fast with a teaching
  error that shows how to generate one. The file's cookies are sent to the target
  URL — documented in the README Security note and the MCP tool description.
- **Identical-render bundling.** Viewports that resolve to the same geometry + DPR
  + touch (differing only by user-agent — e.g. `iphone-17-pro`/`iphone-16-pro`,
  the four 412×915 Pixels) render **once** and come back as a single `Shot` with
  the other device names on `aliases`. Saves render time, disk, and (via MCP) the
  agent's context. The dedupe ignores user-agent (rarely affects layout).
- **Structured findings.** Every render now returns per-viewport `findings` (stable
  JSON) alongside the screenshots: `horizontal_overflow`, `element_clipped`,
  `text_overflow`, `tap_target_small` (mobile only), and `image_no_alt`. Surfaced
  on `Shot.findings` (core), printed under each shot (CLI), and returned as JSON
  keyed by preset (MCP `render_responsive`).
- `@getrefractjs/core`: `render()` — screenshots a URL at N viewports using a single
  browser (Chromium by default, WebKit via `engine`) with one context per viewport, rendered in parallel
  (concurrency capped at `os.cpus().length`, overridable). Smart waits
  (networkidle best-effort, fonts ready, layout-shift settle, optional `waitFor`
  selector), `freeze` mode (disables animations/transitions, forces eager image
  loading), element-scoped capture via `selector`, and a `dpr` override. Load
  failures become teaching errors (DNS / connection refused / timeout / HTTP
  ≥ 400). Full-res PNGs are saved to deterministic `{name}.png` paths.
- `@getrefractjs/core`: 49 device presets (`presets.json`) — iPhones (17/16
  families, SE, 13 mini), Galaxy (S26/S25/S24, A55, Z Fold/Flip), Pixels (10/9
  families, 8), Xiaomi 15, Redmi Note 14, OnePlus 13, iPads (Pro/Air/base/mini),
  Galaxy Tab S10/A9, Surface Pro, MacBooks, Chromebooks, and desktop sizes incl.
  ultrawide — with `resolveViewport()` accepting a preset key, the
  `mobile`/`tablet`/`desktop` groups, or a `WxH` token, and `listPresetNames()`.
- `@getrefractjs/cli`: `refract <url>` renders screenshots to disk, with `--viewports`,
  `--out`, `--selector`, `--freeze`, `--dpr`, and `--concurrency`.
- `@getrefractjs/mcp`: `render_responsive` renders the URL and returns, in one
  response, a text manifest of absolute saved paths plus a downscaled preview
  image (≤800px wide) per viewport; render failures surface as teaching errors.
  A repo-root `.mcp.json` registers the local server for use in Claude Code.
- `examples/demo-site`: an intentionally-broken responsive page (horizontal
  overflow, sub-44px tap target, clipped text, image without `alt`, plus an
  animated badge for `--freeze`) — a manual smoke target and the fixture for the
  v0.2 findings checks, locked by `demo-site.test.ts`.
- Monorepo scaffold: strict TypeScript, tsup builds, Biome, Vitest, and CI
  (lint/build/test on push/PR to `main`).
- README demo assets — a viewport montage (`docs/hero.png`) and a terminal GIF
  (`docs/demo.gif`), both regenerable via `scripts/gen-hero.mjs` / `gen-demo.mjs`.
- Publish-readiness: packages renamed to the `@getrefractjs` scope (npm org owned),
  with `keywords`, `author`, `repository`/`homepage`/`bugs`, `engines`, and
  `publishConfig.access: public`, plus per-package READMEs; `pnpm -r publish
  --dry-run` produces clean tarballs (`dist` + README + LICENSE). Published to npm
  as `0.1.0` via GitHub Actions (OIDC trusted publishing, with provenance).
- Security policy (`SECURITY.md`) and contributor docs (`CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`); the README documents that Refract loads any URL, including
  `file://` and internal hosts.

### Changed
- **`text_overflow` ignores intentional ellipsis truncation.** Elements with
  `text-overflow: ellipsis` (the `.truncate` utility) are designed to truncate, so
  they're no longer flagged — only hard clipping with no ellipsis is. Cuts the
  false-positive noise seen on real dashboards; genuine clipping is still caught.
- **HTTP error messages distinguish 4xx from 5xx.** A 4xx now teaches "the page isn't
  there — check the path/URL"; a 5xx teaches "the server errored — check its logs".

### Fixed
- **A corrupt baseline PNG no longer crashes `refract diff`.** A truncated/invalid
  baseline file is reported as `no_baseline` (re-create it with `--update`) for that
  viewport instead of throwing a raw decode error that aborted the whole run.
- **A `--selector` / `selector` that matches nothing now teaches.** Instead of a raw
  30s Playwright locator timeout, it reports which selector failed at which viewport.
- **`--threshold` is validated to 0–1.** The CLI now rejects out-of-range values (and
  accepts `0`) with a clear message; the MCP `diff_responsive` schema enforces the same
  bound. Previously `0` was wrongly rejected and values above `1` were silently accepted.
- **The diff `report.html` escapes interpolated preset/alias text** (defense-in-depth
  for the human-opened local report).
