# Roadmap

Refract is an agent-first tool for responsive QA: render a URL at N viewports, return the
images, and tell you **what visually broke** as structured findings. This roadmap is
directional, not a set of promises — versions and order may change as real usage tells us
what matters.

Status: **`0.1.0` is on npm** (`@getrefractjs/core`, `/cli`, `/mcp`).

## Shipped (0.1.0)

- `render()` core — one browser, one context per viewport, rendered in parallel; smart waits,
  `freeze` mode, element-scoped capture, DPR override; teaching error messages.
- **Structured findings** per viewport — `horizontal_overflow`, `element_clipped`,
  `text_overflow`, `tap_target_small` (mobile), `image_no_alt`.
- **Visual diff** — `refract diff` / MCP `diff_responsive` against plain-folder baselines with a
  brand-styled `report.html`; exits non-zero on change for CI.
- **Authenticated pages** via Playwright `storageState`; **`injectCss`**; **wait helpers**
  (`waitForFunction`, `networkIdleMs`).
- **Cross-browser** — Chromium (default) + **WebKit** (`--engine webkit`, ≈ iOS Safari).
- 49 device presets. CLI + Node library + MCP server (one response: previews + findings + paths).

## 0.2 — Findings depth

Agents can't eyeball pixels; they act on structured findings, so this is where the leverage is.

- More high-signal heuristics — small text on mobile, overlapping/occluded interactive elements,
  missing viewport meta tag, and pinpointing the element that *causes* horizontal overflow.
- A bounding box on every finding (so you can zoom to exactly what broke).
- **Findings diff** — show how a change moved the findings ("fixed overflow on mobile, but
  introduced a small tap target on tablet"). The most actionable signal for verifying a fix.
- Opt-in **annotated screenshots** — outline the flagged elements on the image.

The findings JSON keys are a stable contract — they won't be renamed between minor versions.

## 0.3 — Shareable reports

- An **HTML report for a plain render** (not just diff): a grid of every viewport plus its
  findings — easy to share with non-technical reviewers.
- A published, reusable **GitHub Action** for visual-diff in CI.
- First-run convenience: offer to install the browser when it's missing.
- Refreshed demos and framework examples (Next.js / Vite / Astro).

## 0.4 — Breadth & coverage

- Preset library to 100+ devices.
- **Firefox** engine (`--engine firefox`) with documented emulation caveats.
- Multi-URL / sitemap mode — responsive QA across a whole site in one run.
- Diff against the last commit's screenshots.

## Deferred

- A local **live web UI** (multi-viewport iframes with hot reload) — parked until there's real
  demand; Refract's focus is the agent-first core, not a human preview app.
- Hosted/cloud rendering, and an N-engine matrix in a single run.

## What Refract is not

- Not a browser extension, and not a general-purpose browser-automation tool — it renders fixed
  viewports and reports findings; it can't click, type, or log in for you.
- Not a reinvention of visual regression — it wraps `pixelmatch`.
- Not a real-device cloud — it's local Playwright emulation (WebKit is the closest proxy to iOS
  Safari, but still desktop WebKit, not a real device).
