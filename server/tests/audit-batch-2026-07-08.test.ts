/**
 * Audit-batch regression pins (2026-07-08).
 *
 * Parallel bug-hunt found four real, verified defects; this pins the fixes so
 * they can't silently regress. Source-level assertions (same style as
 * credit-wallet-confirm-idor.test.ts) — fast, no DB/mocks.
 *
 *  1. IDOR — GET /api/payments/nayax/transactions/:id and /customer/:customerUid
 *     returned ANY customer's payment rows (card last-4, amount, payment token)
 *     to any authenticated user. Now owner-scoped.
 *  2. Coupon farming — POST /api/coupons/restore/:id let the owning user
 *     self-restore a redeemed single-use coupon (redeem→restore→redeem…). Now
 *     admin-only.
 *  3/4. Auth bug — PetPassportHome + PrestigeHome fetched /api/pets with a raw
 *     credentials fetch (no bearer, no pw_session cookie) → 401 → "no pets" for
 *     every real owner. Now use apiRequest (attaches the Firebase bearer).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const server = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const client = (p: string) =>
  fs.readFileSync(path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', p), 'utf8');

const NAYAX = server('routes/nayax-payments.ts');
const COUPONS = server('routes/coupons.ts');
const PASSPORT = client('PetPassportHome.tsx');
const PRESTIGE = client('PrestigeHome.tsx');

describe('audit batch 2026-07-08 — regression pins', () => {
  it('IDOR: /transactions/:id is scoped to the calling user', () => {
    expect(NAYAX).toMatch(/customerUid !== \(req as any\)\.userId/);
  });

  it('IDOR: /transactions/customer/:customerUid rejects other users', () => {
    expect(NAYAX).toMatch(/if \(customerUid !== \(req as any\)\.userId\)\s*\{/);
  });

  it('coupon: user /restore/:id route is admin-gated (anti-farming)', () => {
    expect(COUPONS).toMatch(/router\.post\('\/restore\/:id',\s*requireAdmin,/);
    // the old self-restore owner-check must be gone
    expect(COUPONS).not.toMatch(/if \(check\.rows\[0\]\.user_id !== userId\) return res\.status\(403\)/);
  });

  it('auth: PetPassportHome fetches /api/pets via apiRequest (bearer), not a raw fetch', () => {
    expect(PASSPORT).toMatch(/apiRequest\('GET',\s*'\/api\/pets'\)/);
    expect(PASSPORT).not.toMatch(/fetch\(getApiUrl\('\/api\/pets'\)/);
  });

  it('auth: PrestigeHome fetches /api/pets + prestige-pass via apiRequest (bearer)', () => {
    expect(PRESTIGE).toMatch(/apiRequest\('GET',\s*'\/api\/pets'\)/);
    expect(PRESTIGE).toMatch(/apiRequest\('GET',\s*'\/api\/prestige-pass\/me'\)/);
    expect(PRESTIGE).not.toMatch(/fetch\(getApiUrl\('\/api\/(pets|prestige-pass)/);
  });
});
