import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { callerRole, callerIsAdmin } from '../lib/callerRole';

/**
 * 2026-09-19: six surfaces gated on `req.user?.role` — a field nothing assigns.
 *
 * bridgeFirebaseUser (server/middleware/firebase-auth.ts) writes exactly
 * `{ uid, id, email }`; customAuth and adminAuth write `{ uid, email }`. No
 * middleware anywhere sets req.user.role, req.user.customClaims or
 * req.user.franchiseId — those names exist only on local AuthenticatedRequest
 * interfaces, which is why it all compiled.
 *
 * So each gate evaluated undefined, took the deny branch, and answered 403 to
 * EVERY authenticated caller, the super admin included:
 *
 *   /api/admin/finance/israel-compliance        403
 *   /api/admin/finance/payout-reconciliation    403
 *   /api/admin/finance/manual-adjustment        403
 *   /api/v2/vouchers issue|cancel|adjust|ledger 403
 *   /api/chat/... every admin bypass            403
 *   /api/walk-my-pet/users/:id/walks support    403
 *
 * The role lives on req.firebaseUser.claims.role — what treasury-settings.ts
 * already read correctly.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const R = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('callerRole reads the claim that actually exists', () => {
  it('finds the verified Firebase claim', () => {
    expect(callerRole({ firebaseUser: { claims: { role: 'super_admin' } } } as any)).toBe('super_admin');
    expect(callerIsAdmin({ firebaseUser: { claims: { role: 'admin' } } } as any)).toBe(true);
  });

  it('returns empty — never undefined — when there is no role', () => {
    expect(callerRole({} as any)).toBe('');
    expect(callerRole({ user: { uid: 'u1', email: 'a@b.c' } } as any)).toBe('');
    expect(callerIsAdmin({ user: { uid: 'u1' } } as any)).toBe(false);
  });

  it('a customer is not an admin', () => {
    expect(callerIsAdmin({ firebaseUser: { claims: { role: 'customer' } } } as any)).toBe(false);
  });

  it('legacy shapes still work, so no older path regresses', () => {
    expect(callerRole({ user: { role: 'management' } } as any)).toBe('management');
    expect(callerRole({ user: { customClaims: { role: 'staff' } } } as any)).toBe('staff');
  });
});

describe('no surface still asks req.user for a role', () => {
  it.each([
    'server/routes/finance/israel-compliance.ts',
    'server/routes/finance/payout-reconciliation.ts',
    'server/routes/finance/manual-adjustment.ts',
    'server/routes/unified-vouchers.ts',
    'server/routes/chat-history.ts',
  ])('%s', (rel) => {
    const src = R(rel);
    expect(src).not.toMatch(/req\.user!?\s*\??\.\s*role/);
    expect(src).not.toMatch(/req\.user[^)]{0,20}customClaims\?\.role/);
    expect(src).toMatch(/caller(Role|IsAdmin)\(/);
  });

  it('walk-my-pet uses callerRole for its support bypass', () => {
    const src = R('server/routes/walk-my-pet.ts');
    expect(src).toContain('callerRole(req)');
  });
});
