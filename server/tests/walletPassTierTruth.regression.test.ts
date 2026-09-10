/** Every tier the wallet routes and pass services show comes from lib/memberTier. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
const read = (f: string) => fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');

describe('wallet pass tier truth', () => {
  it('wallet.ts derives every tier through resolveMemberTier (no raw loyaltyTier defaults)', () => {
    const s = read('server/routes/wallet.ts');
    expect(s).toContain("import { resolveMemberTier } from '../lib/memberTier';");
    expect(s).not.toMatch(/loyaltyTier \|\| '(new|gold|bronze)'/);
    expect((s.match(/await resolveMemberTier\(/g) || []).length).toBe(7);
  });
  it('both pass services print tierLabel, never tier.toUpperCase()', () => {
    for (const f of ['server/appleWallet.ts', 'server/googleWallet.ts']) {
      const s = read(f);
      expect(s).toContain("import { tierLabel } from './lib/memberTier';");
      expect(s).not.toContain('data.tier.toUpperCase()');
    }
    expect(read('server/appleWallet.ts')).toContain('?? this.TIER_COLORS.new');
  });
  it('credit-wallet.ts shares the helper instead of its own copy', () => {
    const s = read('server/routes/credit-wallet.ts');
    expect(s).toContain("import { isPrestigeEnrolled } from '../lib/memberTier';");
    expect(s).not.toContain('async function isPrestigeEnrolled');
  });
});
