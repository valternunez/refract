// Roll the root CHANGELOG.md: turn the current `## [Unreleased]` section into a dated
// `## [<version>]` section and leave a fresh empty `## [Unreleased]` above it. Run as
// part of `version-packages` (after `changeset version` bumps the packages), so the
// human-curated root changelog tracks each release automatically. Idempotent.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'CHANGELOG.md');
const version = JSON.parse(readFileSync(join(root, 'packages/core/package.json'), 'utf8')).version;
const md = readFileSync(path, 'utf8');

if (md.includes(`## [${version}]`)) {
  console.log(`CHANGELOG.md already has [${version}] — nothing to roll.`);
  process.exit(0);
}

const marker = '## [Unreleased]';
const idx = md.indexOf(marker);
if (idx === -1) {
  console.error(`No "${marker}" heading in CHANGELOG.md — cannot roll.`);
  process.exit(1);
}

// Warn (don't fail) if Unreleased has no entries — releases normally do.
const rest = md.slice(idx + marker.length);
const next = rest.search(/\n## /);
if (!(next === -1 ? rest : rest.slice(0, next)).trim()) {
  console.warn('Warning: [Unreleased] has no entries; rolling an empty section.');
}

const date = new Date().toISOString().slice(0, 10);
writeFileSync(path, md.replace(marker, `${marker}\n\n## [${version}] - ${date}`));
console.log(`Rolled [Unreleased] → [${version}] - ${date}.`);
