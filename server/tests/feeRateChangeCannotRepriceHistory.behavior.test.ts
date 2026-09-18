/**
 * A FEE CHANGE MUST NOT RE-PRICE MONEY THAT WAS ALREADY TAKEN.
 *
 * The commission rate is a compile-time constant (shared/serviceDivisions.ts
 * DEFAULT_COMMISSION_RATE, mirrored by schema PETWASH_COMMISSION_RATE and
 * marketplaceMoney MARKETPLACE_SERVICE_FEE_RATE), so changing it is a deploy,
 * not a runtime flip. That is the safe half.
 *
 * The unsafe half is any settlement / refund / reconciliation path that
 * RECOMPUTES the fee from the current constant instead of reading the fee
 * stored on the booking. The day the rate moves, those paths silently re-price
 * history.
 *
 * Audited 2026-09-18: the live paths already prefer the stored fee and fall
 * back to the constant only for legacy rows that predate the field. These pin
 * that, and pin the one landmine found — UnifiedBookingEngine, dark behind
 * UNIFIED_BOOKING_ENABLED, still carrying the money model the CEO replaced.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const R = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

/** Source with comments stripped — a pin must not match its own explanation. */
const code = (src: string): string =>
  src.split('\n').filter((l) => {
    const t = l.trim();
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  }).join('\n');

describe('the rate is one constant, not several', () => {
  it('every commission constant resolves to the same number', () => {
    expect(R('shared/serviceDivisions.ts')).toMatch(/export const DEFAULT_COMMISSION_RATE = 0\.15;/);
    expect(R('shared/schema.ts')).toMatch(/export const PETWASH_COMMISSION_RATE = 0\.15;/);
    expect(R('shared/marketplaceMoney.ts')).toMatch(/export const MARKETPLACE_SERVICE_FEE_RATE = 0\.15;/);
  });

  it('no commission rate is read from the environment at runtime', () => {
    // A rate that can be flipped by an env var re-prices history without a
    // deploy, a review, or a trace.
    for (const f of ['shared/serviceDivisions.ts', 'shared/marketplaceMoney.ts']) {
      expect(code(R(f))).not.toMatch(/process\.env/);
    }
  });
});

describe('settlement paths read the STORED fee, not the current rate', () => {
  it('academy and prestige-pass derive the share from what was stored', () => {
    for (const f of ['server/routes/academy.ts', 'server/routes/prestige-pass.ts']) {
      expect(code(R(f))).toMatch(
        /storedTotal > 0 && storedFee >= 0 \? storedFee \/ storedTotal : PETWASH_COMMISSION_RATE/,
      );
    }
  });

  it('escrow reconciliation prefers the commission the escrow was created with', () => {
    const rec = code(R('server/routes/admin-escrow-reconciliation.ts'));
    expect(rec).toMatch(/typeof fs\.platformCommissionCents === 'number'/);
    // The constant appears only as the legacy fallback, on the other branch.
    expect(rec).toMatch(/: Math\.round\(amountCents \* PETWASH_COMMISSION_RATE\)/);
  });
});

describe('the dark unified engine no longer carries the abandoned model', () => {
  const eng = code(R('server/services/unified-booking/UnifiedBookingEngine.ts'));

  it('it computes the split with the canonical helper, not a hardcoded rate', () => {
    expect(eng).toMatch(/splitMarketplaceJob\(/);
    expect(eng).not.toMatch(/price \* 0\.15/);
  });

  it('the provider keeps their FULL rate — fee on top, not carved out', () => {
    expect(eng).toMatch(/providerPayout = split\.providerPayoutCents \/ 100/);
    expect(eng).not.toMatch(/providerPayout = Math\.round\(\(price - platformFee\)/);
  });

  it('Pet Wash owes VAT on its FEE, not on the whole booking', () => {
    expect(eng).toMatch(/vat = split\.serviceFeeVatCents \/ 100/);
  });

  it('it does not invent a promo discount it cannot evaluate', () => {
    // `promoCode ? price * 0.1 : 0` wrote a 10% discount for ANY code,
    // whatever that code was actually worth.
    expect(eng).not.toMatch(/promoCode \? price \* 0\.1/);
    expect(eng).toMatch(/promoDiscount: 0/);
  });

  it('and the router stays DARK until it is rebuilt', () => {
    const route = code(R('server/routes/unified-booking.ts'));
    expect(route).toMatch(/UNIFIED_BOOKING_ENABLED/);
    expect(route).toMatch(/ENGINE_DARK/);
    expect(route).toMatch(/res\.status\(503\)/);
  });
});
