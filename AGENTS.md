# Refract — agent playbooks

Short recipes for when to reach for Refract and what to do with the output.
Each is 5–15 lines: when to use it, the calls in order, what to look for.

> 🚧 Scaffold stage. These playbooks describe the v0.1 surface; the render
> handler is not implemented yet. They double as the spec for what "done" means.

## Playbook: verify a responsive bug fix

**When:** you changed CSS to fix a layout bug at a specific width.
1. `render_responsive({ url: "http://localhost:3000/page", viewports: ["iphone-15", "ipad-mini", "macbook-13"] })`
2. Look at the returned preview for the viewport you fixed.
3. Once findings ship: confirm the `horizontal_overflow` / `clipped` finding for
   that viewport is gone. If it's still present, the fix didn't take.

## Playbook: screenshot-diff before merge

**When:** you want before/after proof a change is visually safe.
1. On the base branch: `render_responsive({ url, freeze: true })` — note the saved paths.
2. Apply the change, re-render with the same args (filenames are deterministic `{preset}.png`).
3. Diff the two `{preset}.png` sets. `freeze: true` removes animation flakiness.

## Playbook: find horizontal overflow on a PR preview

**When:** a deployed preview URL might overflow on mobile.
1. `render_responsive({ url: "https://pr-123.preview.app", viewports: ["mobile"] })`
2. Once findings ship: read findings for `type: "horizontal_overflow"` — the
   `detail` gives `scrollWidth` vs `viewport`. That's your offending width.
3. No human needs to open the page; everything actionable is in the response.
