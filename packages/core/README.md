# @getrefractjs/core

Rendering engine behind **Refract** — agent-first responsive screenshots.

`render()` captures a URL at N device viewports (one Chromium browser, one
context per viewport, rendered in parallel) and returns screenshots **plus
structured findings**: horizontal overflow, clipped elements, truncated text,
sub-44px tap targets, and images missing `alt`.

```ts
import { render } from '@getrefractjs/core';

const shots = await render({ url: 'http://localhost:3000' });
for (const shot of shots) {
  console.log(shot.preset, shot.savedPath);
  for (const f of shot.findings) console.log(' ', f.severity, f.type, f.detail);
}
```

Everything is optional except `url`. Needs Chromium once:
`pnpm exec playwright install chromium` (add `webkit` for `engine: "webkit"`). MIT licensed.
