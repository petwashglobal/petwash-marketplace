/**
 * PR-SEARCH-FILTER-A / provider listings guard.
 *
 * ProviderListings must not expose PetTrek as an active provider category while
 * transport is legally frozen, and provider cards must route to the registered
 * marketplace provider detail route instead of the old ambiguous /providers/:id
 * route.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, 'ProviderListings.tsx'), 'utf8');

describe('ProviderListings navigation authority', () => {
  it('does not expose a PetTrek driver tab while transport is frozen', () => {
    expect(SRC).not.toContain("value=\"driver\"");
    expect(SRC).not.toContain("data-testid=\"tab-drivers\"");
    expect(SRC).not.toContain("driver: 'pettrek'");
  });

  it('routes provider cards to marketplace provider details', () => {
    expect(SRC).toContain('/marketplace/${platformMap[serviceType]}/${provider.id}');
    expect(SRC).not.toContain('/providers/${provider.id}');
  });
});
