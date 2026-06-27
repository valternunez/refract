# Refract — agent playbooks

Short recipes for when to reach for Refract and what to do with the output.
Each is 5–15 lines: when to use it, the calls in order, what to look for.

> `render_responsive` is live and returns, in one response: structured findings
> (JSON keyed by preset), absolute saved paths, and a downscaled preview per viewport.

## Playbook: verify a responsive bug fix

**When:** you changed CSS to fix a layout bug at a specific width.
1. `render_responsive({ url: "http://localhost:3000/page", viewports: ["iphone-15", "ipad-mini", "macbook-air-13"] })`
2. Look at the returned preview for the viewport you fixed.
3. Confirm the `horizontal_overflow` / `element_clipped` finding for that viewport
   is gone from the response. If it's still present, the fix didn't take.

## Playbook: visual-diff before merge

**When:** you want before/after proof a change didn't break the layout anywhere.
1. On the base branch — MCP: `diff_responsive({ url, update: true })`, or CLI:
   `refract diff <url> --update --freeze` — snapshots the baseline into
   `./refract-baseline/{preset}.png`.
2. Apply the change, then compare — MCP: `diff_responsive({ url })` (returns a status
   per viewport + a diff image for each change), or CLI: `refract diff <url> --freeze`.
3. `unchanged` everywhere → safe to merge. Any `changed` gives the % of pixels and a
   diff image/`report.html` (baseline │ current │ diff). The CLI exits non-zero on any
   change, so it drops straight into CI. Re-run with `update`/`--update` to accept.
   Tip: pass `injectCss` to hide live clocks/ads so they don't read as false changes.

## Playbook: screenshot a page behind a login

**When:** the page you need to verify is auth-gated (a dashboard, account settings).
1. Get a Playwright storage-state JSON. If the project has e2e auth states (e.g.
   `e2e/.auth/*.json`), use one of those. Otherwise a human runs once:
   `npx playwright codegen --save-storage=auth.json <login-url>`, logs in, closes it.
2. `render_responsive({ url: "https://app/dashboard", storageState: "./auth.json" })`
3. The previews show the logged-in page (not the login wall); read findings as usual.
   If you still see the login screen, the state is stale — regenerate it.

## Playbook: find horizontal overflow on a PR preview

**When:** a deployed preview URL might overflow on mobile.
1. `render_responsive({ url: "https://pr-123.preview.app", viewports: ["mobile"] })`
2. Read the findings for `type: "horizontal_overflow"` — the `detail` gives
   `scrollWidth` vs `viewport`. That's your offending width.
3. No human needs to open the page; everything actionable is in the response.

## Playbook: check a layout in the real Safari/WebKit engine

**When:** a bug reproduces on iOS Safari but not Chrome (flexbox/gap, sticky, `100vh`).
1. Install WebKit once: `npx playwright install webkit`.
2. `render_responsive({ url, viewports: ["iphone-15"], engine: "webkit" })` — renders
   with the actual WebKit engine (≈ iOS Safari), not Chromium emulation.
3. Compare against the default Chromium render to confirm it's engine-specific. For a
   before/after diff, keep the two engines in separate baselines (e.g. CLI
   `--baseline ./baseline-webkit --engine webkit`) so they never compare across engines.

## Playbook: gate a PR on visual regressions in CI

**When:** you want every PR to fail if it visually breaks a page.
1. Copy `examples/github-actions/visual-diff.yml` into `.github/workflows/`.
2. It renders the deployed preview with `refract diff <url> --freeze` against a committed
   baseline; `refract diff` exits non-zero on any `changed`/`size_changed`, failing the job.
3. The workflow uploads the `report.html` + diff PNGs as an artifact for review. To accept
   intended changes, re-run `refract diff <url> --update` and commit the new baselines.
