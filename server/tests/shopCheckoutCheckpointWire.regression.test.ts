/**
 * Lane C.3 · JourneyCheckpoint wire on the canonical web checkout
 * (post-release 2026-09-03).
 *
 * Fourth resumable customer journey after sitter (#2198), walk
 * (#2201), and marketplace (#2203). This wizard is a single-page
 * SKU picker + optional coupon; the pay button navigates the
 * browser to SUMIT's hosted page, which terminates the JS context.
 *
 * The endpoint + hook are already exercised behaviourally by the
 * supertest suite in server/tests/journeyCheckpointsRoute.behavior.test.ts.
 * This pin locks the checkout-specific wire.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(
    __dirname, '..', '..', 'client', 'src', 'pages', 'CheckoutCanon.tsx',
  ),
  'utf8',
);

describe('CheckoutCanon · JourneyCheckpoint wire (Lane C.3 shop_checkout)', () => {
  it('imports useJourneyCheckpoint from the canonical hook', () => {
    expect(SRC).toMatch(
      /import \{ useJourneyCheckpoint \} from ["']@\/hooks\/useJourneyCheckpoint["'];/,
    );
  });

  it('calls the hook with the shop_checkout domain, enabled only when signed in', () => {
    expect(SRC).toMatch(
      /useJourneyCheckpoint<ShopCheckoutCheckpointPayload>\(["']shop_checkout["'], \{\s*\n?\s*enabled: !!user,\s*\n?\s*\}\)/,
    );
  });

  it('hydrate effect respects a ?sku= URL param — never overrides intent', () => {
    // The hydrate guard is `if (!urlSku && !selectedSku && ...)`.
    expect(SRC).toMatch(/if \(!urlSku && !selectedSku && typeof p\.selectedSku === 'string'\)/);
    expect(SRC).toMatch(/if \(!couponInput && typeof p\.couponCode === 'string'\)/);
  });

  it('save effect skips while paying (SUMIT redirect in flight) and on the empty case', () => {
    expect(SRC).toMatch(/if \(paying\) return;/);
    expect(SRC).toMatch(/if \(!selectedSku && !couponInput\) return;/);
  });

  it('save payload carries ONLY SKU + coupon + updatedAt — no payment truth', () => {
    // Pin the exact save shape.
    expect(SRC).toMatch(
      /void checkpoint\.save\(\{\s*\n\s*selectedSku,\s*\n\s*couponCode: couponInput \|\| undefined,\s*\n\s*updatedAt: new Date\(\)\.toISOString\(\),\s*\n\s*\}\);/,
    );
    // The wider save region must not carry ANY of the forbidden keys.
    const region = SRC.match(/void checkpoint\.save\(\{[\s\S]*?\}\);/)?.[0] ?? '';
    for (const k of [
      'chargeId', 'paidAt', 'refundId', 'fiscalDocumentNumber',
      'settlementId', 'transactionId', 'redirectUrl', 'paymentUrl',
    ]) {
      expect(region).not.toContain(k);
    }
  });

  it('checkpoint.clear() fires BEFORE startSkuCheckout — SUMIT redirect terminates the JS context', () => {
    // The clear MUST be called before the checkout call so that even
    // if SUMIT's hosted-page navigation lands mid-cycle, the local
    // resume-card is already dropped.
    expect(SRC).toMatch(
      /setPaying\(true\);\s*\n[\s\S]{0,300}void checkpoint\.clear\(\);\s*\n\s*const result = await startSkuCheckout\(\{/,
    );
  });
});
