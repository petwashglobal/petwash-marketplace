/**
 * Provider-facing compliance tooling must not expose PetTrek Driver while
 * transport is legally frozen. HR/admin job filters are intentionally out of
 * scope; this guard is for provider-facing compliance only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, 'ProviderCompliance.tsx'), 'utf8');

describe('ProviderCompliance legal freeze', () => {
  it('does not expose PetTrek Driver as a provider compliance type', () => {
    expect(SRC).not.toContain("'driver'");
    expect(SRC).not.toContain('"driver"');
    expect(SRC).not.toContain('PetTrek Driver');
  });
});
