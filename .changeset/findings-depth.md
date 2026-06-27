---
"@getrefractjs/core": minor
"@getrefractjs/cli": minor
"@getrefractjs/mcp": minor
---

Findings depth (0.2). `refract diff` / `diff_responsive` now report a per-viewport **findings
delta** — which findings were fixed (gone since the baseline) or regressed (new) — alongside
the pixel diff, so you can confirm a responsive fix landed without introducing a new issue. The
baseline stores a `findings.json` snapshot (written by `--update` / `update: true`); older
baselines without one simply omit the delta. New core exports `writeBaseline` + `findingLabel`
and `DiffResult.findingsDelta`. Every element-backed finding now carries a `rect` (the culprit's
box in document pixels, scroll-stable) and `horizontal_overflow` names the offending element.
