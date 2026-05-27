/**
 * K9000-only discount scope — doctrine regression test.
 *
 * Operator directive 2026-05-27: "discounts never apply to Platforms for
 * members, it's only for k9000 units. Platforms and providers full price
 * unless we say different."
 *
 * Pre-fix history: `SCOPE_ORDER_MAP.global` listed all 8 orderTypes
 * including sitter_booking, walker_booking, trainer_booking,
 * provider_marketplace, wallet_topup. A coupon with `scopeType=null`
 * defaulted to 'global' and the validate-path explicitly SKIPPED the
 * scope check for 'global'. Net: any campaign coupon could apply to
 * any platform booking. Legal breach.
 *
 * Post-fix invariants enforced by this test:
 *   1. SCOPE_ORDER_MAP.global = ['kiosk_wash'] only.
 *   2. No scope in SCOPE_ORDER_MAP routes a discount to a non-K9000
 *      orderType (i.e., not in K9000_ONLY_ORDER_TYPES).
 *   3. The previously-illegal scope keys do not exist on the map.
 *   4. 'first_order' is restricted to kiosk_wash (was a breach).
 *
 * If any of these assertions fails, the K9000-only doctrine has been
 * regressed and a coupon could route a discount to a platform/provider
 * surface. Block the PR.
 *
 * Doctrine: docs/compliance/2026-05-27-discount-scope-k9000-only.md
 */
import { describe, it, expect } from 'vitest';
import { SCOPE_ORDER_MAP } from '../services/CouponService';

const K9000_ONLY_ORDER_TYPES = new Set([
  'kiosk_wash',
  'loyalty_reward',
  'package_purchase',
]);

const FORBIDDEN_SCOPE_KEYS = [
  'sitter',
  'walker',
  'trainer',
  'provider_marketplace',
  'booking',
  'wallet_topup',
];

describe('K9000-only discount scope doctrine (operator 2026-05-27)', () => {
  it('no scope key routes a discount to a non-K9000 orderType', () => {
    const violations: string[] = [];
    for (const [scopeName, orderTypes] of Object.entries(SCOPE_ORDER_MAP)) {
      for (const orderType of orderTypes) {
        if (!K9000_ONLY_ORDER_TYPES.has(orderType)) {
          violations.push(`scope='${scopeName}' → orderType='${orderType}'`);
        }
      }
    }
    expect(
      violations,
      `Legal breach — non-K9000 orderType in SCOPE_ORDER_MAP: ${violations.join(', ')}`,
    ).toEqual([]);
  });

  it("'global' scope is restricted to ['kiosk_wash']", () => {
    expect(SCOPE_ORDER_MAP.global).toEqual(['kiosk_wash']);
  });

  it("'first_order' scope is restricted to ['kiosk_wash'] (pre-fix breach)", () => {
    expect(SCOPE_ORDER_MAP.first_order).toEqual(['kiosk_wash']);
  });

  it("'kiosk' scope is restricted to ['kiosk_wash']", () => {
    expect(SCOPE_ORDER_MAP.kiosk).toEqual(['kiosk_wash']);
  });

  it.each(FORBIDDEN_SCOPE_KEYS)(
    "removed scope '%s' is no longer present in SCOPE_ORDER_MAP",
    (forbiddenKey) => {
      expect(
        SCOPE_ORDER_MAP[forbiddenKey],
        `Scope '${forbiddenKey}' has been re-added — legal breach`,
      ).toBeUndefined();
    },
  );

  it('every value in SCOPE_ORDER_MAP is a K9000 orderType', () => {
    const allOrderTypes = Object.values(SCOPE_ORDER_MAP).flat();
    const nonK9000 = allOrderTypes.filter((ot) => !K9000_ONLY_ORDER_TYPES.has(ot));
    expect(nonK9000).toEqual([]);
  });
});
