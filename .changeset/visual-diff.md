---
"@getrefractjs/core": minor
"@getrefractjs/cli": minor
"@getrefractjs/mcp": minor
---

Visual diff: `refract diff <url>` compares a fresh render against plain-folder
baselines (`./refract-baseline/{preset}.png`) using `pixelmatch`. `--update` writes
the baseline; a bare run reports `unchanged`/`changed`/`size_changed`/`no_baseline`
per viewport, writes `{preset}.diff.png` for changes and a brand-styled `report.html`
(baseline │ current │ diff grid), and exits non-zero on any change for CI. New core
exports `diffShots` + `writeDiffReport`. Adds dependencies `pixelmatch` (v5, for CJS
compatibility) and `pngjs`.
