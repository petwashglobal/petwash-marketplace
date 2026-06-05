import { describe, expect, it } from 'vitest';
import {
  callerCanAdminMarketplaceRankings,
  isMarketplaceRankingSuperAdminEmail,
} from '../lib/marketplace-ranking-admin';

describe('marketplace ranking admin guard', () => {
  it('blocks ordinary authenticated Firebase users', () => {
    expect(
      callerCanAdminMarketplaceRankings({
        uid: 'customer-1',
        email: 'customer@example.com',
        email_verified: true,
      }),
    ).toBe(false);
  });

  it('allows canonical admin roles from decoded token claims', () => {
    expect(callerCanAdminMarketplaceRankings({ uid: 'admin-1', role: 'admin' })).toBe(true);
    expect(callerCanAdminMarketplaceRankings({ uid: 'ops-1', claims: { roles: ['ops'] } })).toBe(true);
  });

  it('does not treat ordinary dashboard roles as ranking administrators', () => {
    expect(callerCanAdminMarketplaceRankings({ uid: 'staff-1', role: 'staff' })).toBe(false);
    expect(callerCanAdminMarketplaceRankings({ uid: 'finance-1', claims: { roles: ['finance'] } })).toBe(false);
  });

  it('requires verified email before honoring the super-admin allowlist', () => {
    const allowlist = 'owner@petwash.co.il';

    expect(isMarketplaceRankingSuperAdminEmail('owner@petwash.co.il', true, allowlist)).toBe(true);
    expect(isMarketplaceRankingSuperAdminEmail('owner@petwash.co.il', false, allowlist)).toBe(false);
    expect(isMarketplaceRankingSuperAdminEmail('owner@petwash.co.il', undefined, allowlist)).toBe(false);
  });

  it('fails closed when the super-admin allowlist is missing or placeholder text', () => {
    expect(isMarketplaceRankingSuperAdminEmail('owner@petwash.co.il', true, '')).toBe(false);
    expect(isMarketplaceRankingSuperAdminEmail('owner@petwash.co.il', true, 'PLACEHOLDER')).toBe(false);
  });
});
