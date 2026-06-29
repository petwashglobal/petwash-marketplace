/**
 * Two unauthenticated data-exposure holes closed:
 *  A) sitter /search/nearby — requires auth + uses SERVER loyalty tier (not client)
 *  B) walker /walks — requires auth + caller must own the walkerId (or be admin)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const sitter = readFileSync(resolve(__dirname, '..', 'routes', 'sitter-suite.ts'), 'utf8');
const walk = readFileSync(resolve(__dirname, '..', 'routes', 'walk-my-pet.ts'), 'utf8');

describe('unauth data-exposure closed', () => {
  it('A: sitter nearby requires auth + server-derived tier (ignores client loyaltyTier)', () => {
    expect(sitter).toMatch(/router\.post\('\/search\/nearby', requireAuth/);
    expect(sitter).toMatch(/serverLoyaltyTier/);
    expect(sitter).toMatch(/isEligibleToBook\(userId, serverLoyaltyTier\)/);
    expect(sitter).not.toMatch(/req\.session\?\.userId \|\| 'anonymous'/);
  });
  it('B: walker walks requires auth + ownership', () => {
    expect(walk).toMatch(/router\.get\('\/walkers\/:walkerId\/walks', requireAuth/);
    expect(walk).toMatch(/wp\.userId !== uid && !isSuperAdminVerified\(req\)/);
  });
});
