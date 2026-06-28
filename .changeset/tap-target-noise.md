---
"@getrefractjs/core": patch
"@getrefractjs/cli": patch
"@getrefractjs/mcp": patch
---

`tap_target_small` noise reduction: flag an interactive element only when it's small in **both**
dimensions (a wide-but-short link like 354×40 is tappable, so no longer flagged), and exempt **inline
text links** in a sentence (WCAG 2.5.8 inline exception). On real sites this cut the finding from
~90–99% of all controls to the genuinely tiny ones. Icon/image links still use their real (image) tap
area.
