# Refract

Agent-first responsive screenshots. Give a coding agent (or yourself) one
primitive: *render this URL at N viewports, return the images, and tell me what
visually broke.* Built on Playwright, shipped as an **MCP server + CLI + Node
library**.

![Refract renders one URL across mobile, tablet, and desktop](docs/hero.png)

![refract rendering a URL and reporting findings in the terminal](docs/demo.gif)

> 🚧 **Pre-release.** The engine, CLI, and MCP tool work; npm packages aren't
> published yet, so install from source (`pnpm install && pnpm build`).

## Install

```sh
pnpm add @refract/core        # library
pnpm add -g @refract/cli      # CLI
# one-time browser download (deferred until first render):
pnpm exec playwright install chromium
```

## CLI quickstart

```sh
refract https://example.com --viewports mobile,tablet,desktop --out ./shots
```

Outputs `./shots/{preset}.png`, one per viewport.

## Library quickstart

```ts
import { render } from '@refract/core';

const shots = await render({ url: 'http://localhost:3000' });
for (const shot of shots) {
  console.log(shot.preset, shot.savedPath);
  for (const f of shot.findings) {
    console.log(`  [${f.severity}] ${f.type} ${f.detail}`);
  }
}
```

## MCP config block

```json
{
  "mcpServers": {
    "refract": {
      "command": "npx",
      "args": ["-y", "@refract/mcp"]
    }
  }
}
```

The server exposes one tool, `render_responsive`, whose description tells an agent
exactly when and how to call it — no docs required. One call returns a text
manifest of absolute saved paths, structured findings as JSON (see below), and a
downscaled preview image per viewport (≤800px wide, so it won't blow the agent's
context window); full-resolution PNGs are written to disk. Load failures come back
as teaching errors the agent can act on.

Working in this repo? A committed `.mcp.json` registers the local server
(`node packages/mcp/dist/index.js`) — run `pnpm build` first and restart your
client so it picks the tool up.

## Findings

Every render returns structured findings per viewport **alongside** the
screenshots — agents act on these instead of eyeballing pixels:

```ts
{ preset: "mobile", findings: [
  { type: "horizontal_overflow", severity: "error", detail: "scrollWidth=480 viewport=402" },
  { type: "tap_target_small", severity: "warn", selector: "button#tiny-btn", size: "28x24" },
]}
```

| type | severity | fires when |
|---|---|---|
| `horizontal_overflow` | error | the page scrolls wider than the viewport |
| `element_clipped` | warn | an element sticks out past the viewport edge |
| `text_overflow` | warn | text is clipped/truncated (`scrollWidth > clientWidth`) |
| `tap_target_small` | warn | an interactive element is under 44×44 (mobile viewports) |
| `image_no_alt` | warn | an `<img>` is missing its `alt` attribute |

The CLI prints them under each shot; the MCP tool returns them as JSON keyed by preset.

## What this is *not*

- ❌ A browser extension or live-preview app (that's Responsively's job).
- ❌ A general-purpose browser-control MCP (that's `playwright-mcp`'s job). It
  renders URLs at viewports; it cannot click, type, or log in.
- ❌ A visual-regression engine reinvented from scratch (it wraps `pixelmatch`).
- ❌ A real-device cloud. Playwright **emulates** viewport, DPR, UA, and touch —
  not the GPU or iOS's actual WebKit. It does not replace BrowserStack.

## License

MIT
