/**
 * Payment-preview contract — the ONE authoritative answer to
 * "what does this customer owe RIGHT NOW?" (CEO 2026-08-26 §9-10).
 *
 * Rule: the frontend must NEVER compute this. Every checkout / booking
 * / shop / eGift surface reads the same shape below, so the customer
 * sees one honest breakdown — service price → extras → subtotal →
 * benefits (Prestige, promo, loyalty) → stored value (eGift, wallet)
 * → remaining to pay → amount due now → payment state.
 *
 * The shape is shared between server (composer) and client (renderers)
 * so no drift is possible. This file has NO logic — just the types.
 * The composer that fans out to the surface-specific pricers lives at
 * server/services/paymentPreview.ts.
 */

/** Which product surface the customer is looking at. */
export const PAYMENT_SURFACES = [
  'sitter',
  'walk',
  'academy',
  'shop',
  'booking_request',
  'k9000',
  'egift',
] as const;
export type PaymentSurface = (typeof PAYMENT_SURFACES)[number];

/**
 * A benefit reduces the amount owed BEFORE stored value is applied.
 * Includes Prestige entitlements, promo codes, and loyalty credits.
 * Order in the response array is significant — server applies in that
 * order so the client can render "why the total dropped" line-by-line.
 */
export type PaymentBenefitType =
  | 'prestige_basic'   // membership-tier discount (server rule; may be 0)
  | 'promo_code'       // validated coupon
  | 'loyalty_credit';  // redeemable loyalty points

export interface PaymentBenefit {
  type: PaymentBenefitType;
  amountCents: number;
  /** Human-readable one-line label, already localised. */
  label: string;
  /** Rule / code / redemption id for audit + reservation lookup. */
  ref?: string;
}

/**
 * Stored value the customer is spending from their own funds — eGift,
 * promo wallet, or cash wallet. Applied AFTER benefits so the client
 * shows the honest "you're spending from your balance" split.
 *
 * `cappedByBalance` = the customer's balance was the limit
 * `cappedByPolicy`  = a per-transaction / per-service policy limit
 *                     (e.g. wallet cannot cover more than 50% of a
 *                     booking subtotal) — the client should surface
 *                     this so the customer understands why.
 */
export type PaymentStoredValueType = 'egift' | 'promo_wallet' | 'cash_wallet';

export interface PaymentStoredValue {
  type: PaymentStoredValueType;
  amountCents: number;
  cappedByBalance: boolean;
  cappedByPolicy: boolean;
  capPercent?: number; // e.g. 50 when policy limits wallet to 50% of subtotal
  balanceCents: number; // the customer's total in this store (before this txn)
}

/**
 * Payment state — the state machine the client renders. Deliberately
 * DECOUPLED from booking.status. A booking can be `confirmed` in the
 * ops sense while the customer still owes money; that means the client
 * must show "pay to complete" not "you're done".
 *
 * Values are aligned with server/shared/purchase-lifecycle/types.ts
 * (which today only applies to Commerce OS shadow rows) — the payment-
 * preview composer widens the vocabulary to every surface.
 */
export type PaymentState =
  | 'quoted'            // priced but the customer hasn't chosen to pay
  | 'payment_pending'   // customer has approved; server is waiting on rail confirmation
  | 'fully_covered'     // benefits + stored value fully cover the total
  | 'paid'              // rail confirmed; customer owes nothing
  | 'not_due_yet';      // meet-greet-first surfaces: nothing owed until provider accepts

export interface PaymentPreview {
  /** Stable across (surface, cartHash, userId, intents) — safe to memo. */
  previewId: string;
  surface: PaymentSurface;
  currency: 'ILS';

  /** When this preview was minted (ISO) and how long it can be trusted. */
  quotedAt: string;
  expiresAt: string;

  /** Pricing rule version so a stale client can be told to refresh. */
  pricingVersion: string;

  /** Service price only, before add-ons. */
  baseCents: number;
  /** Add-ons + delivery + gift-wrap. */
  extrasCents: number;
  /** base + extras (never negative). */
  subtotalCents: number;
  /** VAT extracted from subtotal (18/118 in Israel today). */
  vatCents: number;
  /** PetWash platform fee that is part of the DISPLAYED price. */
  serviceFeeCents: number;

  /** Ordered: prestige → promo → loyalty. */
  benefits: PaymentBenefit[];
  /** Ordered: egift → promo_wallet → cash_wallet. */
  storedValue: PaymentStoredValue[];

  /** sum(benefits) + sum(storedValue). */
  amountCoveredCents: number;
  /** subtotal − amountCovered (never negative). */
  amountRemainingCents: number;
  /**
   * For capture-then-create surfaces this == remaining. For meet-greet-
   * first surfaces this is 0 until provider acceptance. Client uses
   * this for the primary CTA number.
   */
  amountDueNowCents: number;

  paymentState: PaymentState;

  /** Non-blocking notes: stale rate card, coupon not stackable, etc. */
  warnings: string[];
  /** Which benefit/stored-value combinations the server had to reject. */
  stackabilityConflicts: string[];
}

/** Empty-preview helper for error / not-authenticated fallbacks. */
export function emptyPaymentPreview(surface: PaymentSurface, previewId = 'PV-empty'): PaymentPreview {
  return {
    previewId,
    surface,
    currency: 'ILS',
    quotedAt: '',
    expiresAt: '',
    pricingVersion: 'v0',
    baseCents: 0,
    extrasCents: 0,
    subtotalCents: 0,
    vatCents: 0,
    serviceFeeCents: 0,
    benefits: [],
    storedValue: [],
    amountCoveredCents: 0,
    amountRemainingCents: 0,
    amountDueNowCents: 0,
    paymentState: 'quoted',
    warnings: [],
    stackabilityConflicts: [],
  };
}
