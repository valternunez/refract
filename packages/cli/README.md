# @refract/cli

The `refract` command — agent-first responsive screenshots from the terminal.

```sh
npx @refract/cli https://example.com --viewports mobile,tablet,desktop --out ./shots
```

Renders the URL at each viewport to `./shots/{preset}.png` and prints structured
findings (overflow, small tap targets, clipped text, missing `alt`) under each shot.

Flags: `--viewports`, `--out`, `--selector`, `--freeze`, `--dpr`, `--concurrency`.
Needs Chromium once: `npx playwright install chromium`. MIT licensed.
