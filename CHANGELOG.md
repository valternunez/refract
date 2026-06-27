# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Monorepo scaffold: `@refract/core`, `@refract/cli`, `@refract/mcp` as compiling
  stubs sharing a strict TypeScript config, tsup builds, Biome, and Vitest.
- Five role-specialized agent definitions under `.claude/agents/` (kiss-reviewer,
  senior-engineer, agent-qa, device-specialist, docs-writer).
- `render_responsive` MCP tool registered with its full agent-facing description
  (handler is a not-implemented stub pending v0.1).
- CI workflow: lint, build, and test on push/PR to `main`.
