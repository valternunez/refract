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

- The `@getrefractjs` npm scope is **owned** (org: getrefractjs); `access` is `public`.
  Publishing needs `npm login` + 2FA, or an Automation `NPM_TOKEN` in CI.
- The initial changeset bumps `0.0.0 → 0.1.0`. Run `pnpm changeset status` to preview.
- Confirm the `repository`/`homepage` URLs in each package.json match the real GitHub repo.

> Note: Changesets generates a `CHANGELOG.md` per package. The root `CHANGELOG.md`
> is the human-curated, repo-level summary — keep it for the big picture.
