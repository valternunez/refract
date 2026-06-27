# Releasing

Refract uses [Changesets](https://github.com/changesets/changesets). The three
published packages (`@refract/core`, `@refract/cli`, `@refract/mcp`) are **locked
in step** (`fixed` in `.changeset/config.json`) — they always share one version
and bump together. `@refract/demo-site` and the root are private and never published.

## Day to day

When you make a user-visible change, record it:

```sh
pnpm changeset
```

Pick the bump (**patch** = fix, **minor** = feature, **major** = breaking — but
while we're `0.x`, treat **minor as the breaking slot** and **patch as features +
fixes**) and write a sentence. This drops a markdown file under `.changeset/`;
commit it with your change. `chore:`/`docs:`/`refactor:` changes usually need no changeset.

## Cutting a release

```sh
pnpm version-packages   # consumes changesets → bumps package.json + writes per-package CHANGELOGs
pnpm build
pnpm release            # publishes the changed packages to npm
```

On a repo with a GitHub remote, `.github/workflows/release.yml` automates this:
push to `main` opens a "Version Packages" PR; merging it publishes. It needs an
`NPM_TOKEN` repo secret.

## Before the first publish (not done yet)

- **Own the `@refract` npm scope** (or switch the packages to unscoped names /
  your own scope). `access` is already set to `public`.
- The initial changeset bumps `0.0.0 → 0.1.0`. Run `pnpm changeset status` to preview.
- Add a GitHub remote, then `repository`/`homepage` fields to each package.json.

> Note: Changesets generates a `CHANGELOG.md` per package. The root `CHANGELOG.md`
> is the human-curated, repo-level summary — keep it for the big picture.
