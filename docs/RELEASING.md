# Releasing

Refract uses [Changesets](https://github.com/changesets/changesets). The three
published packages (`@getrefractjs/core`, `@getrefractjs/cli`, `@getrefractjs/mcp`) are **locked
in step** (`fixed` in `.changeset/config.json`) — they always share one version
and bump together. `@getrefractjs/demo-site` and the root are private and never published.

## Day to day

When you make a user-visible change, record it:

```sh
pnpm changeset
```

Pick the bump (**patch** = fix, **minor** = feature, **major** = breaking — but
while we're `0.x`, treat **minor as the breaking slot** and **patch as features +
fixes**) and write a sentence. This drops a markdown file under `.changeset/`;
commit it with your change. `chore:`/`docs:`/`refactor:` changes usually need no changeset.

## Cutting a release (automated)

The release workflow (`.github/workflows/release.yml`) is **armed** — pushing to `main`
runs Changesets, which opens a **"Version Packages"** PR that consumes the pending
changesets (bumps `package.json`, writes the per-package `CHANGELOG.md`s, and rolls the
root `CHANGELOG.md` — see below). **Merging that PR publishes** the packages to npm and
tags + GitHub-releases them. So a release is just: write changesets → merge the bot's PR.

Publishing uses **OIDC trusted publishing**, so packages ship with **provenance** (no token
needed at publish time). An `NPM_TOKEN` repo secret remains as a fallback.

To run it by hand instead, the same scripts work locally:

```sh
pnpm version-packages   # changeset version → bumps + per-package CHANGELOGs + rolls root CHANGELOG
pnpm build
pnpm release            # changeset publish → publishes changed packages to npm
```

## Root CHANGELOG

Changesets writes a `CHANGELOG.md` per package. The root `CHANGELOG.md` is the
human-curated, repo-level summary — write entries under `## [Unreleased]` as you make
changes. The `version-packages` step then **auto-rolls** `[Unreleased]` into a dated
`## [<version>]` section via `scripts/roll-root-changelog.mjs` (idempotent), so the root
never drifts from the release. You curate; the roll is automatic.

## History

- `0.1.0` — first publish, **2026-06-27**, shipped from GitHub Actions via OIDC trusted
  publishing (with provenance). The `@getrefractjs` npm scope is owned (org: getrefractjs),
  `access` is `public`; the repo lives at `github.com/valternunez/refract`.
