# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Structured findings.** Every render now returns per-viewport `findings` (stable
  JSON) alongside the screenshots: `horizontal_overflow`, `element_clipped`,
  `text_overflow`, `tap_target_small` (mobile only), and `image_no_alt`. Surfaced
  on `Shot.findings` (core), printed under each shot (CLI), and returned as JSON
  keyed by preset (MCP `render_responsive`).
- `@refract/core`: `render()` — screenshots a URL at N viewports using a single
  Chromium browser with one context per viewport, rendered in parallel
  (concurrency capped at `os.cpus().length`, overridable). Smart waits
  (networkidle best-effort, fonts ready, layout-shift settle, optional `waitFor`
  selector), `freeze` mode (disables animations/transitions, forces eager image
  loading), element-scoped capture via `selector`, and a `dpr` override. Load
  failures become teaching errors (DNS / connection refused / timeout / HTTP
  ≥ 400). Full-res PNGs are saved to deterministic `{name}.png` paths.
- `@refract/core`: 20 device presets (`presets.json`) — current flagships
  (iPhone 17 Pro Max, Galaxy S26 Ultra, Pixel 10 Pro, iPad Pro, MacBook Pro) plus
  common desktop sizes — with `resolveViewport()` accepting a preset key, the
  `mobile`/`tablet`/`desktop` groups, or a `WxH` token, and `listPresetNames()`.
- `@refract/cli`: `refract <url>` renders screenshots to disk, with `--viewports`,
  `--out`, `--selector`, `--freeze`, `--dpr`, and `--concurrency`.
- `@refract/mcp`: `render_responsive` renders via the engine and returns, in one
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
- Publish-readiness: `keywords`, `author`, and `publishConfig.access: public` on
  each package, plus per-package READMEs; `pnpm -r publish --dry-run` produces
  clean tarballs (`dist` + README + LICENSE). Not yet published — owning the
  `@refract` npm scope and bumping off `0.0.0` come at release time.
