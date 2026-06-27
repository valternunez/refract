# Contributing to Refract

Thanks for helping! Refract is a pnpm monorepo targeting Node 20+.

## Setup

```sh
corepack enable pnpm                     # pnpm via corepack
pnpm install
pnpm exec playwright install chromium    # one-time, ~280MB
```

## Develop

```sh
pnpm build     # build all three packages
pnpm test      # vitest — drives a real headless Chromium
pnpm lint      # biome check
pnpm format    # biome format --write
```

## Before opening a PR

- Add a changeset for any user-visible change: `pnpm changeset` (see
  [docs/RELEASING.md](docs/RELEASING.md)). `chore:`/`docs:`/`refactor:` usually don't need one.
- Keep it simple — Refract favors the smallest thing that works over speculative
  abstraction. Extract on the third duplicate, not the first.
- Update docs (README + JSDoc) in the **same** change as the code.
- Use conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).

## Packages

- `@getrefractjs/core` — the render engine + findings.
- `@getrefractjs/cli` — the `refract` command.
- `@getrefractjs/mcp` — the MCP server (`render_responsive`).
