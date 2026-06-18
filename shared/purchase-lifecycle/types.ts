/**
 * PetWash Commerce OS — shared purchase-lifecycle type pack.
 *
 * ONE checkout/commerce contract for every product type. This is the unified
 * vocabulary the CEO's "Commerce OS" requires and the 2026-05-26 "unified purchase
 * lifecycle" SDD defines — they are ONE program (CEO decision 2026-06-18). These are
 * PURE TYPES: no runtime, nothing imports them yet. The engine, router, state machine
 * and webhook-activation land in later PRs behind ff.commerce.unified_purchase_lifecycle.*
 *
 * Design refs:
 *   docs/design/2026-06-18-petwash-commerce-os.md
 *   docs/design/2026-05-26-payment-provider-routing-and-lifecycle.md
 */

/** Every sellable thing flows through the SAME checkout; only activation differs. */
export type ProductType =
  | 'SINGLE_WASH'
  | 'WASH_PACKAGE'
  | 'EGIFT_CARD'
  | 'MEMBERSHIP'
  | 'PET_SITTING_BOOKING'
  | 'DOG_WALKING_BOOKING'
  | 'GROOMING_BOOKING'
  | 'SAAS_SUBSCRIPTION';

export const PRODUCT_TYPES: readonly ProductType[] = [
  'SINGLE_WASH', 'WASH_PACKAGE', 'EGIFT_CARD', 'MEMBERSHIP',
  'PET_SITTING_BOOKING', 'DOG_WALKING_BOOKING', 'GROOMING_BOOKING', 'SAAS_SUBSCRIPTION',
] as const;

/** Which surface row this purchase shadows (maps to the existing per-surface table). */
export type Surface = 'shop' | 'booking' | 'gift_card' | 'wallet_topup' | 'franchise_fee' | 'kiosk';

/** Universal lifecycle status — webhook is the ONLY thing that flips to 'paid'. */
export type PurchaseStatus =
  | 'draft'
  | 'quoted'
  | 'payment_pending'
  | 'paid'
  | 'activated'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export type PaymentMethod = 'apple_pay' | 'google_pay' | 'credit_card' | 'bit' | 'wallet_credits';

/** Who/what the clearing runs through. SUMIT stays legal system-of-record regardless. */
export type Acquirer = 'upay_via_sumit' | 'upay_direct' | 'nayax' | 'wallet_only';

export type CustomerSegment = 'b2c' | 'b2b' | 'franchise' | 'provider';

/** Fee snapshot locked at quote time — read-only once payment_pending. */
export interface FeeSnapshot {
  acquirer: Acquirer;
  feeBps: number;
  feeVatBps: number;
  fixedFeeCents: number;
  ruleSetVersion: string;
}

/** Input to POST /api/checkout/create — same shape for every product. */
export interface PurchaseIntent {
  productType: ProductType;
  surface: Surface;
  surfaceRefId: string;        // pointer back to the surface row (shop_orders.id, bookings.id, …)
  buyerUserId: string;
  receiverUserId?: string;     // when buyer ≠ receiver (gift)
  amountCents: number;
  currency: 'ILS';
  paymentMethod: PaymentMethod;
  segment: CustomerSegment;
  metadata?: Record<string, unknown>;
}

/** Router output — which acquirer clears this purchase (pure function, no I/O). */
export interface RouterDecision {
  acquirer: Acquirer | null;   // null ⇒ no eligible acquirer ⇒ block checkout
  systemOfRecord: 'sumit';
  feeSnapshot: FeeSnapshot | null;
  reason: string;
}
