/**
 * SumitBookingPayment — the SUMIT hosted-page card rail for marketplace bookings.
 *
 * WHY: the canonical booking /pay path used NayaxOnlinePaymentService, which is dark
 * (ONLINE_CARD_NOT_LIVE), so real bookings dead-ended at "accepted — pay to confirm".
 * SUMIT is already live (SUMIT_ENABLED=true) and its beginRedirect rail is verified
 * working in prod (2026-08-05: HTTP 200, real pay.sumit.co.il page, Data.RedirectURL).
 * This wraps beginRedirect in the SAME result shape NayaxOnlinePaymentService returns,
 * so booking-requests.ts /pay can swap rails behind a flag with no other change.
 *
 * SAFETY:
 *  - Off by default. /pay only uses this when BOOKING_CARD_RAIL === 'sumit'.
 *  - beginRedirect creates a hosted page only — NO money moves here. Confirmation +
 *    escrow-hold happen server-side in the /sumit-return verify (getTransaction), which
 *    re-checks amount against the booking (defence against price tampering).
 *  - No card data ever touches us — SUMIT hosts the card form.
 */
import { sumitClient } from './SumitClient';
import { logger } from '../lib/logger';

export interface SumitBookingSessionInput {
  requestId: string;
  amountCents: number;
  customerEmail?: string;
  customerName?: string;
  description: string;
  /** Where SUMIT returns the customer after payment (our verify endpoint). */
  returnUrl: string;
}

export interface SumitBookingSessionResult {
  success: boolean;
  sessionId?: string;   // our ExternalIdentifier — correlation + idempotency key
  paymentUrl?: string;  // SUMIT hosted page
  demoMode: false;
  error?: string;
}

/**
 * Create a SUMIT hosted-payment session for a booking. Returns the same shape as
 * NayaxOnlinePaymentService.createPaymentSession so /pay is a drop-in swap.
 * Never throws — returns { success:false, error } so /pay can respond honestly.
 */
export async function createSumitBookingSession(
  input: SumitBookingSessionInput,
): Promise<SumitBookingSessionResult> {
  // Unique per attempt so a retry can't collide, but prefixed with the booking id so
  // the SUMIT dashboard + our logs correlate to the booking at a glance.
  const externalId = `bkg_${input.requestId}_${Date.now().toString(36)}`;
  const amountIls = Math.round(input.amountCents) / 100;

  try {
    const res = await sumitClient.beginRedirect({
      externalId,
      amountIls,
      description: input.description,
      redirectUrl: input.returnUrl,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
    });

    if (!res.wired) {
      // SUMIT creds not present / disabled — honest "not live", mirrors Nayax's
      // ONLINE_CARD_NOT_LIVE so /pay's existing guard leaves the booking unchanged.
      logger.warn('[SumitBookingPayment] SUMIT not wired — card rail unavailable', { requestId: input.requestId, reason: res.reason });
      return { success: false, demoMode: false, error: 'ONLINE_CARD_NOT_LIVE' };
    }
    if (!res.redirectUrl) {
      logger.error('[SumitBookingPayment] beginRedirect returned no URL', { requestId: input.requestId, reason: res.reason });
      return { success: false, demoMode: false, error: 'PAYMENT_SESSION_FAILED' };
    }
    return { success: true, sessionId: externalId, paymentUrl: res.redirectUrl, demoMode: false };
  } catch (err: any) {
    logger.error('[SumitBookingPayment] createSumitBookingSession error', { requestId: input.requestId, err: err?.message });
    return { success: false, demoMode: false, error: 'PAYMENT_SESSION_FAILED' };
  }
}

/**
 * Verify a SUMIT redirect payment server-side. The redirect querystring is spoofable
 * (SumitClient.getTransaction re-checks with SUMIT). Returns a normalized verdict the
 * /sumit-return handler uses to decide whether to confirm the booking.
 *
 * transactionId comes from the SUMIT return query — the exact param name is one of the
 * items still to be pinned by the first real ₪20 payment; the caller passes whichever
 * id it found and getTransaction sends both PaymentID + TransactionID defensively.
 */
export async function verifySumitBookingPayment(transactionId: string): Promise<{
  valid: boolean;
  amountCents?: number;
  reason?: string;
}> {
  if (!transactionId) return { valid: false, reason: 'no_transaction_id' };
  const v = await sumitClient.getTransaction(transactionId);
  if (!v.wired) return { valid: false, reason: v.reason || 'sumit_not_wired' };
  return { valid: v.valid === true, amountCents: v.amountCents, reason: v.valid ? undefined : (v.reason || 'not_valid') };
}
