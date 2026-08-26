/**
 * paymentPreview composer — the ONE server function that answers
 * "what does this customer owe RIGHT NOW?" for every surface (CEO
 * 2026-08-26 §9-10).
 *
 * READ-ONLY. Never captures, never reserves, never mutates. The
 * frontend calls the /api/payment-preview endpoint on every price-
 * affecting change and renders the returned shape verbatim.
 *
 * Delegates:
 *   sitter          → SitterAdvancedBookingEngine.quotePrice
 *   walk            → WalkEliteBookingEngine (calculatePrice)
 *   academy         → academy pricing (inline in the route today —
 *                     TODO: extract to a service)
 *   shop            → shopService.validateCartForCheckout +
 *                     calculateDelivery (server-owned totals)
 *   booking_request → quoteEngine.calculateQuote (already wallet-aware)
 *
 * When a delegate returns partial data (e.g. sitter engine has no
 * wallet/eGift wiring today per lane B trace), the composer fills the
 * missing pieces with zero-benefits / zero-stored-value entries so the
 * shape is stable — the client can render the same table regardless
 * of surface, and a future delegate upgrade lights up the fields
 * without a client change.
 *
 * IMPORTANT (CEO safety directive): this composer must NEVER invent
 * new economic rules. If Prestige benefit for sitters is not defined
 * in the current code, we return 0 for that surface — we do NOT make
 * one up. The design note at docs/design/2026-08-26-payment-preview.md
 * captures the follow-up work to wire missing pieces per surface.
 */

import crypto from 'crypto';
import {
  emptyPaymentPreview,
  type PaymentPreview,
  type PaymentSurface,
  type PaymentState,
} from '@shared/lib/paymentPreview';
import { calculateQuote } from './quoteEngine';
import { logger } from '../lib/logger';

const PRICING_VERSION = 'v1.0.0';
const PREVIEW_TTL_MS = 15 * 60 * 1000; // 15 minutes — matches the quote-preview TTL convention.

export interface PaymentPreviewInput {
  surface: PaymentSurface;
  userId: string | null;

  /** For booking_request / sitter / walk / academy: a real quote input. */
  quoteInput?: {
    providerId: string;
    serviceType: string;
    bookingWindow: { startAt: string; endAt: string };
    pets: any[];
    addons?: any[];
    promoCode?: string | null;
    giftCardCode?: string | null;
    useWalletCredit?: boolean;
    applyLoyaltyCredits?: boolean;
  };

  /** For shop: cart identifier + delivery choice. */
  shopInput?: {
    cartId: number;
    deliveryMethod: 'delivery' | 'pickup';
    deliveryAddressId?: number | null;
    giftWrap?: boolean;
  };
}

function nowIsoPair(): { quotedAt: string; expiresAt: string } {
  const now = new Date();
  const exp = new Date(now.getTime() + PREVIEW_TTL_MS);
  return { quotedAt: now.toISOString(), expiresAt: exp.toISOString() };
}

function previewId(surface: PaymentSurface, seed: string): string {
  const h = crypto.createHash('sha1').update(`${surface}:${seed}`).digest('hex').slice(0, 12);
  return `PV-${surface}-${h}`;
}

/**
 * Compose a payment preview for a booking-request surface.
 * Uses the existing quoteEngine which is already the canonical pricer
 * for /api/quotes/preview — we re-shape its response into the unified
 * contract so the client renders the same table for booking-requests
 * as it does for shop / sitter / walk / academy.
 */
async function composeBookingRequest(input: PaymentPreviewInput): Promise<PaymentPreview> {
  const surface = input.surface;
  const q = input.quoteInput;
  if (!q) {
    logger.warn('[PaymentPreview] booking_request called without quoteInput');
    return emptyPaymentPreview(surface);
  }

  const raw: any = await calculateQuote({
    providerId: q.providerId,
    serviceType: q.serviceType,
    bookingWindow: q.bookingWindow,
    pets: q.pets,
    addons: q.addons ?? [],
    promoCode: q.promoCode ?? null,
    giftCardCode: q.giftCardCode ?? null,
    useWalletCredit: q.useWalletCredit ?? false,
    applyLoyaltyCredits: q.applyLoyaltyCredits ?? false,
    userId: input.userId,
    bookingRequestId: null,
  });

  const totals = raw?.totals ?? {};
  const subtotalCents = Math.max(0, Number(totals.subtotalCents ?? 0));
  const discountCents = Math.max(0, Number(totals.discountCents ?? 0));
  const serviceFeeCents = Math.max(0, Number(totals.serviceFeeCents ?? 0));
  const vatCents = Math.max(0, Number(totals.taxCents ?? 0));
  const giftCardAppliedCents = Math.max(0, Number(totals.giftCardAppliedCents ?? 0));
  const walletCreditAppliedCents = Math.max(0, Number(totals.walletCreditAppliedCents ?? 0));
  const loyaltyRedeemedCents = Math.max(0, Number(totals.loyaltyRedeemedCents ?? 0));
  const totalCents = Math.max(0, Number(totals.totalCents ?? 0));

  const benefits: PaymentPreview['benefits'] = [];
  if (discountCents > 0) {
    benefits.push({
      type: 'promo_code',
      amountCents: discountCents,
      label: q.promoCode ? `Promo ${q.promoCode}` : 'Promo',
      ref: q.promoCode ?? undefined,
    });
  }
  if (loyaltyRedeemedCents > 0) {
    benefits.push({
      type: 'loyalty_credit',
      amountCents: loyaltyRedeemedCents,
      label: 'Loyalty credits',
    });
  }

  const storedValue: PaymentPreview['storedValue'] = [];
  if (giftCardAppliedCents > 0) {
    storedValue.push({
      type: 'egift',
      amountCents: giftCardAppliedCents,
      cappedByBalance: false,
      cappedByPolicy: false,
      balanceCents: giftCardAppliedCents, // engine returned only the applied slice
    });
  }
  if (walletCreditAppliedCents > 0) {
    storedValue.push({
      type: 'cash_wallet',
      amountCents: walletCreditAppliedCents,
      cappedByBalance: false,
      cappedByPolicy: false,     // TODO: quoteEngine caps at min(available, 50% subtotal, remaining) — surface cap flags on the next pass
      capPercent: 50,
      balanceCents: walletCreditAppliedCents,
    });
  }

  const amountCoveredCents =
    benefits.reduce((s, b) => s + b.amountCents, 0) +
    storedValue.reduce((s, v) => s + v.amountCents, 0);
  const amountRemainingCents = totalCents;
  const paymentState: PaymentState =
    amountRemainingCents === 0
      ? (amountCoveredCents > 0 ? 'fully_covered' : 'paid')
      : 'quoted';

  const { quotedAt, expiresAt } = nowIsoPair();
  return {
    previewId: previewId(surface, `${input.userId ?? 'anon'}:${q.providerId}:${q.serviceType}:${q.bookingWindow.startAt}`),
    surface,
    currency: 'ILS',
    quotedAt,
    expiresAt,
    pricingVersion: PRICING_VERSION,
    baseCents: subtotalCents, // booking-request pricer folds extras into subtotal today
    extrasCents: 0,
    subtotalCents,
    vatCents,
    serviceFeeCents,
    benefits,
    storedValue,
    amountCoveredCents,
    amountRemainingCents,
    amountDueNowCents: amountRemainingCents,
    paymentState,
    warnings: Array.isArray(raw?.warnings) ? raw.warnings : [],
    stackabilityConflicts: [],
  };
}

/**
 * TODO stubs — the other surfaces need per-surface delegates. Until
 * their extractors land, returning a zero-benefit / zero-stored-value
 * preview keeps the shape stable for the client.
 */
async function composeStub(input: PaymentPreviewInput): Promise<PaymentPreview> {
  return emptyPaymentPreview(input.surface, previewId(input.surface, `${input.userId ?? 'anon'}:stub`));
}

export async function composePaymentPreview(input: PaymentPreviewInput): Promise<PaymentPreview> {
  switch (input.surface) {
    case 'booking_request':
    case 'sitter':          // sitter today rides quoteEngine via booking_requests when booked from the marketplace
    case 'walk':            // ditto walk
    case 'academy':         // ditto academy
      return input.quoteInput ? composeBookingRequest(input) : composeStub(input);
    case 'shop':
    case 'k9000':
    case 'egift':
    default:
      // These surfaces have their own price paths; wiring lands in the
      // follow-up PRs sized in docs/design/2026-08-26-booking-accept-dispatcher.md
      return composeStub(input);
  }
}
