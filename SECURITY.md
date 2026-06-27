# Security Policy

## Reporting a vulnerability

Please report security issues **privately** via GitHub's "Report a vulnerability"
button (the repo's Security tab → Advisories), not a public issue. We'll
acknowledge within a few days and keep you posted on a fix.

## Security model — read before you point it at anything

Refract drives a headless Chromium browser to screenshot URLs. **By design it
loads any URL it is given**, including:

- `file://` URLs — it can render (and therefore read) local files.
- internal/private hosts and cloud-metadata endpoints (e.g. `169.254.169.254`).

There is **no URL allow/deny list by default**, and the rendered pixels are
returned to the caller. Treat Refract like `curl`:

- Don't pass untrusted or sensitive URLs.
- When exposing the MCP server (`render_responsive`) to an agent, remember the
  agent — or a page that prompt-injects it — could request a `file://` or internal
  URL and receive the contents back as an image. Run it only against URLs you trust.

Refract is a **local** tool for v1.x; there is no hosted or multi-tenant mode.
