import { describe, expect, it } from 'vitest';

// Scaffold smoke test. Keeps `pnpm test` green before any feature code lands.
// Replace with real core/cli/mcp tests as those ship.
describe('scaffold', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
