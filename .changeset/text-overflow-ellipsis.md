---
"@getrefractjs/core": patch
---

`text_overflow` findings no longer flag intentional ellipsis truncation: elements
with `text-overflow: ellipsis` (e.g. the `.truncate` utility) are designed to
truncate, so only hard clipping with no ellipsis affordance is reported now. Removes
a common false positive on dashboards while still catching genuine clipping.
