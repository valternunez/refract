# Refract

> **Working name.** Swap for the final name everywhere before v0.1 publish.

Agent-first responsive screenshots. Give a coding agent (or yourself) one
primitive: *render this URL at N viewports, return the images, and tell me what
visually broke.* Built on Playwright, shipped as an **MCP server + CLI + Node
library**.

> 🚧 **Scaffold stage.** The three packages exist as compiling stubs. The render
> engine lands in v0.1 — see [`CLAUDE.md`](./CLAUDE.md) for the spec and roadmap.

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
exactly when and how to call it — no docs required.

## What this is *not*

- ❌ A browser extension or live-preview app (that's Responsively's job).
- ❌ A general-purpose browser-control MCP (that's `playwright-mcp`'s job). It
  renders URLs at viewports; it cannot click, type, or log in.
- ❌ A visual-regression engine reinvented from scratch (it wraps `pixelmatch`).
- ❌ A real-device cloud. Playwright **emulates** viewport, DPR, UA, and touch —
  not the GPU or iOS's actual WebKit. It does not replace BrowserStack.

## License

MIT
