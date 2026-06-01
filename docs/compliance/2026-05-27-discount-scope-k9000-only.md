# Discount Scope K9000-Only Doctrine

| | |
|---|---|
| **Status** | DOCTRINE — binding on every future PR |
| **Date** | 2026-05-27 |
| **Author** | Engineering, codifying operator directive |
| **Operator directive** | nir.h@petwash.co.il, 2026-05-27, verbatim: *"Critical legal breach , discounts never apply to Polatfkrms for members , it's only for k9000 units . Platforms and providers full price unless we say different"* |
| **Linked code** | `server/services/CouponService.ts:SCOPE_ORDER_MAP` |
| **Linked test** | `server/tests/coupon-k9000-only-scope.test.ts` |
| **Linked SDD** | `docs/design/2026-05-25-commerce-promotions-pricing.md` (merged — this doctrine amends §5.1 scope) |

---

## 1. The rule

**Discounts apply ONLY to K9000 kiosk transactions.**

"Discounts" includes — non-exhaustive list:

- Coupons (campaign + issued)
- Promo codes (any source)
- Member-tier rates (loyalty bronze/silver/gold pricing)
- Loyalty rewards (points redemption value)
- Comp codes
- Birthday discounts
- First-time-customer discounts
- Event-day discounts (Black Friday, special days, etc.)
- Any other mechanism that reduces the customer-facing price below the public retail price

**Allowed surfaces for discounts**:

- `kiosk_wash` — K9000 unit wash transaction
- `loyalty_reward` — loyalty-point redemption against K9000 wash (still a K9000 transaction at the meta level)
- `package_purchase` — wash-package purchase (consumed at K9000 only)

**Forbidden surfaces** (always full retail price):

- `sitter_booking` — pet sitter platform
- `walker_booking` — dog walker platform
- `trainer_booking` — trainer platform (Pet Wash Academy)
- `provider_marketplace` — any provider service
- `wallet_topup` — wallet top-up purchase
- Shop physical goods (any product purchase)
- Gift card PURCHASE (the buying side — redemption is not a discount, see §4)
- Franchise fees
- Any other platform surface introduced in the future

**Provider services**: any service rendered by a third-party provider (sitter, walker, trainer, groomer, driver, academy instructor, kiosk-station staff service) is FULL retail price. Providers are paid out of full price; discounts to platform bookings would erode provider revenue without explicit operator agreement.

## 2. Why this exists

Pre-fix audit (2026-05-27) discovered that `CouponService.SCOPE_ORDER_MAP.global` enumerated all eight orderTypes including `sitter_booking`, `walker_booking`, `trainer_booking`, `provider_marketplace`, `wallet_topup`. The scope check in `validateCoupon()` then explicitly skipped enforcement for `scopeType='global'` (which is the default when `scopeType` is null). Net effect: any campaign coupon, whether deliberate or accidental, could route a discount to a platform/provider booking. No test rejected the path. The commerce SDD (`docs/design/2026-05-25-commerce-promotions-pricing.md`) at line 22 documented this as an "8-platform scope map" — codifying the breach as intentional design.

This doctrine reverses that. K9000-only is the law of the platform until the operator says otherwise per-transaction.

## 3. Code enforcement

`server/services/CouponService.ts`:

- `SCOPE_ORDER_MAP` — only the four K9000-aligned scopes remain (`global` = `['kiosk_wash']`, `kiosk` = `['kiosk_wash']`, `loyalty_club` = `['loyalty_reward']`, `package` = `['package_purchase']`, `first_order` = `['kiosk_wash']`). The six illegal scope keys (`sitter`, `walker`, `trainer`, `provider_marketplace`, `booking`, `wallet_topup`) are removed.
- Scope check in `validateCoupon()` ALWAYS runs (no `if (scopeType !== 'global')` exemption).
- Non-K9000 attempts return `errorCode: 'SCOPE_NOT_K9000'` with a Hebrew error message identifying that K9000 is the only valid surface.
- Existing DB rows with the removed `scopeType` values will now fail validation with `SCOPE_NOT_K9000`. This is intentional — those coupons should never have been valid.

## 4. What is NOT a "discount" (and therefore not restricted)

Operator's directive scopes only DISCOUNTS — price reductions. The following mechanisms apply pre-paid balance and are **NOT** discounts; they remain allowed across surfaces:

- **Wallet redemption** — spending an existing `walletAccounts.cashWalletBalanceCents` against a booking is using money the user already paid in. Not a discount.
- **Gift card redemption** — applying a previously-purchased `eVoucher` / `petWashVoucher2025` against any surface. The discount-equivalent moment was at gift-card PURCHASE (which itself must be full price per §1).
- **Wash-package redemption** — spending a `walletAccounts.washPackageCredits` is consuming a pre-paid wash. The wash-package PURCHASE happens at full price + retail-discounted-per-bundle (a packaging discount that lives inside the K9000 surface). Redemption against subsequent K9000 washes is not a new discount.

A future PR may add an explicit `isPrePaidBalanceApplication` boolean to the order-pricing pipeline to make this distinction machine-checkable.

## 5. Override path (the "unless we say different")

Per-transaction operator override is permitted. The audit-friendly implementation pattern:

1. Operator (or finance, MFA-gated) creates a one-off coupon with a non-default scope explicitly allowing the surface.
2. The coupon is issued to ONE user (`couponType='issued'`) with explicit eligibility rule.
3. The override is recorded in `couponRedemptions.adminOverride*` with `reason`, `actorUserId`, `mfaProofId`.
4. Finance queue surfaces every override for after-the-fact audit.

A separate PR is required to add the override surface; today (2026-05-27) NO override path exists in code. Until that PR ships, **there is no legal way to apply a coupon to a non-K9000 surface**.

## 6. Historical audit (operator + finance action)

Before this fix, any coupon redemption recorded against a non-K9000 `orderType` is potentially a breach (if the customer received a discount on a platform booking). Recommended audit query (operator + finance to run):

```sql
SELECT
  cr.id, cr.coupon_id, cr.user_id, cr.order_type,
  cr.amount_before_cents, cr.discount_amount_cents,
  cr.created_at, c.code, c.scope_type
FROM coupon_redemptions cr
JOIN coupons c ON c.id = cr.coupon_id
WHERE cr.order_type NOT IN ('kiosk_wash', 'loyalty_reward', 'package_purchase')
  AND cr.cancelled_at IS NULL
ORDER BY cr.created_at DESC;
```

Any row returned is a customer who received a discount on a platform booking. Finance must decide per-row whether to:

- Refund the provider (if the discount eroded provider take)
- Re-bill the customer (unlikely — bad UX)
- Absorb the loss + flag the customer record + close out

The audit is operator-owned. Engineering's contribution stops at producing the query.

## 7. Test enforcement

`server/tests/coupon-k9000-only-scope.test.ts` runs on every CI build and asserts:

1. No scope routes to a non-K9000 orderType.
2. `global` is `['kiosk_wash']`.
3. `first_order` is `['kiosk_wash']`.
4. The six forbidden scope keys are absent.
5. Every value across the entire map is a K9000 orderType.

If any future PR re-adds a non-K9000 surface, CI fails with the explicit name of the breach. The test is the doctrine made executable.

## 8. Open follow-ups

These are NOT blockers for the hotfix PR but should be tracked:

1. **Override surface** — design + ship the MFA-gated per-transaction operator override (separate PR).
2. **Member-tier pricing audit** — confirm no `loyaltyTier`-based price reduction code applies to non-K9000 surfaces. Today the audit (2026-05-27) found tier pricing isolated to K9000 wash redemption, but a tier-pricing engine could regress this.
3. **Event-promotions audit** — `server/services/globalPromotions.ts:applyPromotionDiscount` has no surface guard. The callers today route only K9000 traffic, but the function itself should refuse non-K9000 callers (defensive). Follow-up PR.
4. **Coupon advertising compliance** — Israeli consumer-law (§9.1 of the merged commerce SDD) requires genuine prior-price-within-30-days for discount advertising. Coupons-for-K9000-only narrows the surface where this applies, but the rule still holds inside K9000. No change needed today.

## 9. Doctrine longevity

This doctrine binds every PR until the operator explicitly amends it. Amendments must:

1. Update this file with a new section + date.
2. Update `SCOPE_ORDER_MAP` in code with a comment citing the amended doctrine.
3. Update the regression test with the new invariants.
4. Be reviewed by operator + legal counsel.

The breach found on 2026-05-27 was dormant for an unknown period because the booking routes had not wired in `validateCoupon()` yet. Future fast-moving PRs could re-introduce the wiring; the test prevents that from becoming a runtime breach.

---

**End of doctrine.** Operator: keep this doc, the test, and the code change pinned together. They are one unit.
