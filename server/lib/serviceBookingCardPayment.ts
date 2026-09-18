/**
 * The card rail for a SERVICE booking that lives in its own table (walk, academy),
 * built on the rail booking_requests already uses (CEO 2026-09-18: "a" — put the
 * remaining services on the card payment the other bookings use).
 *
 * Why this exists: Walk and Academy showed a price and collected nothing. Walk
 * accepted a booking with an escrow document and no money at all; Academy took
 * only the wallet part. Both now send the customer to the same SUMIT hosted page
 * and confirm ONLY on a server-verified payment.
 *
 * The rules are the ones booking-requests.ts /sumit-return already enforces, in
 * this order, and every one of them can refuse:
 *   1. the rail is live (BOOKING_CARD_RAIL=sumit) — otherwise say so, charge
 *      nothing, and leave the booking alone
 *   2. SUMIT itself says the payment is valid (server-to-server getTransaction —
 *      never the redirect's query string)
 *   3. the external reference belongs to THIS booking (a paid transaction cannot
 *      be replayed against another booking of the same price)
 *   4. the amount paid matches what the booking says it costs (1 agora tolerance)
 *   5. one payment fulfils one order (durable claim row)
 * Only then may the caller mark the booking paid.
 *
 * No card data ever reaches us — SUMIT hosts the form.
 */
import { logger } from './logger';
import { claimSumitPayment, claimAllowsFulfil, readSumitPaymentIdFromReturn } from './sumitPaymentReturn';

export type ServiceBookingKind = 'walk' | 'academy';

export interface BeginServiceCardPaymentInput {
  kind: ServiceBookingKind;
  /** The booking's customer-facing id — also the external reference at SUMIT. */
  bookingRef: string;
  amountCents: number;
  description: string;
  /** Absolute URL of the verify endpoint SUMIT returns the customer to. */
  returnUrl: string;
  customerEmail?: string;
  customerName?: string;
  language?: string;
}

export type BeginServiceCardPaymentResult =
  | { ok: true; sessionId: string; paymentUrl: string }
  | { ok: false; code: 'ONLINE_CARD_NOT_LIVE' | 'INVALID_AMOUNT' | 'PAYMENT_SESSION_FAILED'; message: string };

/** True when the card rail is switched on in this environment. */
export function cardRailIsLive(): boolean {
  return (process.env.BOOKING_CARD_RAIL || 'nayax').trim().toLowerCase() === 'sumit';
}

export async function beginServiceCardPayment(
  input: BeginServiceCardPaymentInput,
): Promise<BeginServiceCardPaymentResult> {
  if (!cardRailIsLive()) {
    return {
      ok: false,
      code: 'ONLINE_CARD_NOT_LIVE',
      message: 'Online card payment is not available yet. Nothing was charged.',
    };
  }
  if (!Number.isFinite(input.amountCents) || Math.round(input.amountCents) <= 0) {
    return { ok: false, code: 'INVALID_AMOUNT', message: 'This booking has no amount to pay.' };
  }

  const { createSumitBookingSession } = await import('../services/SumitBookingPayment');
  const session = await createSumitBookingSession({
    requestId: input.bookingRef,
    amountCents: Math.round(input.amountCents),
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    description: input.description,
    returnUrl: input.returnUrl,
    language: input.language,
  });

  if (!session.success || !session.paymentUrl) {
    logger.error('[ServiceCardPayment] session creation failed', {
      kind: input.kind, bookingRef: input.bookingRef, error: session.error,
    });
    return session.error === 'ONLINE_CARD_NOT_LIVE'
      ? { ok: false, code: 'ONLINE_CARD_NOT_LIVE', message: 'Online card payment is not available yet. Nothing was charged.' }
      : { ok: false, code: 'PAYMENT_SESSION_FAILED', message: 'Payment gateway unavailable. Please try again.' };
  }

  logger.info('[ServiceCardPayment] hosted page created', {
    kind: input.kind, bookingRef: input.bookingRef, amountCents: Math.round(input.amountCents),
  });
  return { ok: true, sessionId: session.sessionId || '', paymentUrl: session.paymentUrl };
}

export interface VerifyServiceCardPaymentInput {
  kind: ServiceBookingKind;
  bookingRef: string;
  /** The redirect's query string — the transaction id is read from it, nothing else is trusted. */
  query: Record<string, unknown>;
  /** What the BOOKING says it costs, in agorot. */
  expectedAmountCents: number;
}

export type VerifyServiceCardPaymentResult =
  | { ok: true; transactionId: string; amountCents: number }
  | { ok: false; reason: string };

export async function verifyServiceCardPayment(
  input: VerifyServiceCardPaymentInput,
): Promise<VerifyServiceCardPaymentResult> {
  const txnId = readSumitPaymentIdFromReturn(input.query);
  if (!txnId) return { ok: false, reason: 'no_transaction_id' };

  const { verifySumitBookingPayment } = await import('../services/SumitBookingPayment');
  // Server-to-server, and bound to THIS booking's external reference.
  const verified = await verifySumitBookingPayment(String(txnId), String(input.bookingRef));
  if (!verified.valid) return { ok: false, reason: verified.reason || 'sumit_not_valid' };

  if (typeof verified.amountCents !== 'number') return { ok: false, reason: 'amount_missing' };
  if (Math.abs(verified.amountCents - Math.round(input.expectedAmountCents)) > 1) {
    logger.error('[ServiceCardPayment] amount mismatch — POTENTIAL FRAUD', {
      kind: input.kind, bookingRef: input.bookingRef,
      expected: Math.round(input.expectedAmountCents), received: verified.amountCents,
    });
    return { ok: false, reason: 'amount_mismatch' };
  }

  // One payment fulfils one order.
  const claim = await claimSumitPayment(String(txnId), `${input.kind}:${input.bookingRef}`, 'booking');
  if (!claimAllowsFulfil(claim)) return { ok: false, reason: `payment_claim_${claim}` };

  logger.info('[ServiceCardPayment] payment verified', {
    kind: input.kind, bookingRef: input.bookingRef, transactionId: String(txnId), amountCents: verified.amountCents,
  });
  return { ok: true, transactionId: String(txnId), amountCents: verified.amountCents };
}
