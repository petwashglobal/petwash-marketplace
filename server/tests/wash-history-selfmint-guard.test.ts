/**
 * Wash-history self-mint guard — regression pin (2026-07-08).
 *
 * Parallel money-integrity hunt, CRITICAL finding:
 * POST /api/wash-history was gated only by requireAuth. Any authenticated
 * caller could POST { packageId } and the handler called
 *   walletService.addCredits(user.id, 'wash_package', pkg.washCount,
 *                            'wash_history_create', String(history.id), …)
 * with ZERO payment verification — minting real, K9000-redeemable wash-package
 * credits to themselves. Because the credit sourceId was a fresh history.id on
 * every call, the in-app dedup never tripped → unlimited free washes. It also
 * bumped totalSpent/loyaltyTier, inflating the caller's tier for free.
 *
 * The ONLY legitimate rail for this credit is the payment-verified Nayax
 * checkout webhook (nayax-webhooks.ts), which validates the paid amount against
 * the wash-history finalPrice before crediting the identical sourceType.
 *
 * Fix: the POST route is now admin-only and grants no economic benefit.
 * Source-level pins (same style as credit-wallet-confirm-idor.test.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTES = fs.readFileSync(path.resolve(__dirname, '..', 'routes.ts'), 'utf8');
const WEBHOOK = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'nayax-webhooks.ts'),
  'utf8',
);

describe('wash-history self-mint guard (2026-07-08)', () => {
  it('POST /api/wash-history is admin-only (no customer reach)', () => {
    expect(ROUTES).toMatch(/app\.post\(\s*'\/api\/wash-history',\s*requireAdmin/);
    // and it must NOT have reverted to requireAuth on the POST
    expect(ROUTES).not.toMatch(/app\.post\(\s*'\/api\/wash-history',\s*requireAuth/);
  });

  it('the self-mint credit path is gone (no wash_history_create credit)', () => {
    expect(ROUTES).not.toMatch(/wash_history_create/);
  });

  it('the legit payment-verified webhook rail still credits wash packages', () => {
    // amount is validated before crediting, then addCredits fires
    expect(WEBHOOK).toMatch(/Amount mismatch/);
    expect(WEBHOOK).toMatch(/'wash_package_purchase'/);
  });
});
