import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 2026-09-13 — CEO rule: "only real data verified".
 *
 * 1. A Prestige membership is ACTIVE only on verified contacts (mobile by SMS
 *    code + verified email of the same account). Before, prestige-join rows
 *    stayed 'pending_verification' forever and the unauthenticated register
 *    form created rows 'active' with nothing verified.
 * 2. The K9000 bay prices a member from that verified, active membership —
 *    not from req.firebaseUser.loyaltyTier, a field that was never set.
 * 3. The franchise dashboard reports only real settlement rows, linked to the
 *    franchise through the owner's own account id.
 */

const queries: Array<{ text: string; params: unknown[] }> = [];
let nextResult: { rows: any[]; rowCount?: number } = { rows: [], rowCount: 0 };

vi.mock('../db', () => ({
  db: {},
  pool: {
    query: vi.fn(async (text: string, params: unknown[]) => {
      queries.push({ text, params });
      return nextResult;
    }),
  },
}));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const root = path.resolve(__dirname, '..', '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('activateVerifiedPrivilegeMember — verified contacts only', () => {
  beforeEach(() => { queries.length = 0; nextResult = { rows: [], rowCount: 0 }; });

  it('does nothing without a uid', async () => {
    const { activateVerifiedPrivilegeMember } = await import('../lib/privilegeMemberActivation');
    expect(await activateVerifiedPrivilegeMember('')).toBe(false);
    expect(queries).toHaveLength(0);
  });

  it('is one conditional UPDATE that requires every verified fact', async () => {
    const { activateVerifiedPrivilegeMember } = await import('../lib/privilegeMemberActivation');
    nextResult = { rows: [{ member_id: 'PWP-1' }], rowCount: 1 };
    expect(await activateVerifiedPrivilegeMember('uid-1', { email: 'A@B.co', emailVerified: true })).toBe(true);
    const { text, params } = queries[0];
    expect(params).toEqual(['uid-1', true, 'a@b.co']);
    for (const clause of [
      "SET status = 'active'",
      'pm.firebase_uid = $1',
      "pm.status = 'pending_verification'",   // never touches suspended/cancelled/active
      'u.phone_verified = true',                // mobile proven by SMS code
      'u.mobile_verified_at IS NOT NULL',
      'lower(u.email) = lower(pm.email)',       // membership email IS the account email
      'u.email_verified = true',
      'u.email_verified_at IS NOT NULL',
    ]) {
      expect(text, clause).toContain(clause);
    }
  });

  it('a token that does NOT say email_verified contributes nothing', async () => {
    const { activateVerifiedPrivilegeMember } = await import('../lib/privilegeMemberActivation');
    await activateVerifiedPrivilegeMember('uid-2', { email: 'x@y.co', emailVerified: false });
    expect(queries[0].params).toEqual(['uid-2', false, 'x@y.co']);
  });

  it('a database failure leaves the membership pending and does not throw', async () => {
    const { pool } = await import('../db');
    (pool.query as any).mockImplementationOnce(async () => { throw new Error('boom'); });
    const { activateVerifiedPrivilegeMember } = await import('../lib/privilegeMemberActivation');
    await expect(activateVerifiedPrivilegeMember('uid-3')).resolves.toBe(false);
  });

  it('is called when a join completes and whenever a contact becomes verified', () => {
    const join = read('server/routes/prestige-join.ts');
    expect(join).toContain('await activateVerifiedPrivilegeMember(userId, {');
    expect(join).toContain('membershipStatus,');
    const act = read('server/services/ActivationService.ts');
    expect((act.match(/await activateVerifiedPrivilegeMember\(userId\);/g) || []).length).toBe(2);
  });

  it('the unauthenticated register form no longer creates an active member', () => {
    const src = read('server/routes/privilege-loyalty.ts');
    expect(src).toMatch(/language, status\s*\n\s*\) VALUES \(/);
    expect(src).toContain("${'pending_verification'}");
  });

  it('the email fallback in the member lookup requires a verified account email', () => {
    const src = read('server/lib/privilegeMemberLookup.ts');
    expect(src).toContain('AND (u.email_verified = true OR u.email_verified_at IS NOT NULL)');
  });
});

describe('K9000 bay price — verified active membership only', () => {
  it('no membership → full price; a percent is capped at the member cap', async () => {
    const { calculatePriceCents } = await import('../routes/qr-activation');
    const machine = { priceCents: 5500 };
    expect(calculatePriceCents(machine, null)).toBe(5500);
    expect(calculatePriceCents(machine, 0)).toBe(5500);
    expect(calculatePriceCents(machine, 5)).toBe(5225);
    expect(calculatePriceCents(machine, 15)).toBe(4950); // capped at 10%
    expect(calculatePriceCents(machine, -20)).toBe(5500);
    expect(calculatePriceCents(machine, Number.NaN)).toBe(5500);
  });

  it('the price reads the shared resolver, never the unset token field', () => {
    const src = read('server/routes/qr-activation.ts');
    expect(src).not.toContain('firebaseUser?.loyaltyTier');
    expect(src).not.toContain('userLoyaltyTier');
    expect(src).toContain('const memberDiscount = await resolveMemberTierDiscount(userId);');
    expect(src).toContain('calculatePriceCents(machine, memberDiscount?.percent ?? 0)');
  });

  it('the online package purchase and the bay share ONE resolver', () => {
    const lib = read('server/lib/memberTierDiscount.ts');
    expect(lib).toContain('export async function resolveMemberTierDiscount');
    expect(lib).toContain("member.status !== 'active'");
    expect(read('server/routes.ts')).toContain("import('./lib/memberTierDiscount')");
  });
});

describe('franchise dashboard — real settlement rows only', () => {
  const src = read('server/routes/franchise.ts');
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  it('no longer reads the duplicate schema tables', () => {
    expect(code).not.toContain("from '@shared/super-app-schema'");
    expect(code).not.toContain('payments.');
    expect(code).not.toContain('stations.franchiseId');
  });

  it('links the franchise through the owner account id and reads station_settlements', () => {
    expect(code).toContain('FROM franchise_owners WHERE owner_user_id = $1');
    expect(code).toContain('FROM station_settlements ss');
    expect(code).toContain('ss.franchise_owner_id = $1');
    expect(code).toContain("dataSource: ownerId == null ? 'no_linked_franchise_owner' : 'station_settlements'");
  });

  it('all three transaction lists use the settlement reader', () => {
    expect((code.match(/await settlementTransactions\(await franchiseOwnerIdFor\(/g) || []).length).toBe(3);
  });

  it('settlement cents become shekels and an unlinked user gets nothing', async () => {
    const mod: any = await import('../routes/franchise');
    expect(mod.default).toBeTruthy();
    // The readers are module-private; their contract is pinned by source above
    // and by the cents→shekels conversion here.
    expect(code).toContain('(Number(x.total_amount_cents || 0) / 100).toFixed(2)');
    expect(code).toContain('if (ownerId == null) return [];');
  });
});
