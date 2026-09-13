/**
 * SumitCardVault — the capture engine that ties the token store (PaymentTokenVault) to
 * SUMIT (SumitClient). CTO P0-2, 2026-08-01.
 *
 * PROTECTION (why this can't hurt the business):
 *  - FLAG-GATED: does nothing unless CARD_VAULT_ENABLED === 'true'. Default OFF.
 *  - FAIL-CLOSED at EVERY step: no saved card → no capture; SUMIT doesn't confirm →
 *    captured:false. It NEVER returns a fake "paid". The caller keeps the booking UNPAID
 *    on anything but a SUMIT-confirmed charge with a fiscal document.
 *  - No PAN/CVV ever touches us — SUMIT tokenizes the card; we store only its token.
 *
 * First real ₪-small booking is the live proof: if SUMIT's field shapes differ, the
 * charge fails CLOSED (booking stays unpaid, no wrong/double charge) and the real
 * response tells us the exact fields to lock in.
 */

import { PaymentTokenVault } from './PaymentTokenVault';
import { sumitClient } from './SumitClient';
import { logger } from '../lib/logger';

export function isCardVaultEnabled(): boolean {
  return String(process.env.CARD_VAULT_ENABLED || '').toLowerCase() === 'true';
}

export interface CaptureResult {
  captured: boolean;
  sumitDocumentId?: string;
  transactionId?: string;
  reason?: string;
}

export class SumitCardVault {
  /**
   * Record the card SUMIT saved during the ₪1 hosted-page payment.
   *
   * CORRECTED 2026-09-13 against SUMIT's official schema. The hosted payment page
   * saves the paying card on the SUMIT customer itself (BeginRedirect
   * `PreventSavingPaymentMethod` defaults to false). There is no one-time token to
   * hand to setforcustomer afterwards — the old code passed the payment's
   * PaymentMethod.ID (or even the customer id) as `SinglePaymentToken`, a field
   * SUMIT does not have, so every save failed after the customer had paid ₪1.
   *
   * Now: READ the customer's active method (getforcustomer → Data.PaymentMethod)
   * and record it only when it exists — and, when the payment named a method,
   * only when it is that same method. Fail-closed on anything else.
   */
  static async saveCard(input: {
    userId: string;
    sumitCustomerId: number | string;
    /** PaymentMethod.ID from the verified payment, when SUMIT returned one. */
    expectedPaymentMethodId?: string;
    cardBrand?: string;
    cardLast4?: string;
    expMonth?: number;
    expYear?: number;
    billingName?: string;
    customerEmail?: string;
    consentVersion?: string;
  }): Promise<{ saved: boolean; reason?: string }> {
    if (!isCardVaultEnabled()) return { saved: false, reason: 'vault_disabled' };
    const r = await sumitClient.getForCustomer(input.sumitCustomerId);
    const active = (r.items[0] ?? null) as { ID?: unknown; CreditCard_LastDigits?: unknown; CreditCard_ExpirationMonth?: unknown; CreditCard_ExpirationYear?: unknown } | null;
    if (!r.wired || !active || active.ID == null) {
      logger.warn('[SumitCardVault] no active SUMIT payment method after the save-card payment (fail-closed)', {
        userId: input.userId, reason: r.reason || 'no_active_method',
      });
      return { saved: false, reason: r.reason || 'sumit_has_no_active_method' };
    }
    const methodId = String(active.ID);
    if (input.expectedPaymentMethodId && input.expectedPaymentMethodId !== methodId) {
      logger.warn('[SumitCardVault] active SUMIT method is not the card just paid with (fail-closed)', { userId: input.userId });
      return { saved: false, reason: 'active_method_mismatch' };
    }
    await PaymentTokenVault.saveToken({
      userId: input.userId,
      provider: 'sumit',
      processorCustomerId: String(input.sumitCustomerId),
      processorTokenId: methodId,
      cardBrand: input.cardBrand,
      cardLast4: input.cardLast4 ?? (typeof active.CreditCard_LastDigits === 'string' ? active.CreditCard_LastDigits : undefined),
      expMonth: input.expMonth ?? (typeof active.CreditCard_ExpirationMonth === 'number' ? active.CreditCard_ExpirationMonth : undefined),
      expYear: input.expYear ?? (typeof active.CreditCard_ExpirationYear === 'number' ? active.CreditCard_ExpirationYear : undefined),
      billingName: input.billingName,
      consentVersion: input.consentVersion,
    });
    return { saved: true };
  }

  /**
   * Capture a booking amount from the user's saved card. FAIL-CLOSED: returns
   * captured:false (booking stays unpaid) unless SUMIT confirms the charge AND issues a
   * fiscal document. Never a fake success.
   */
  static async captureForBooking(input: {
    userId: string;
    amountIls: number;      // VAT-inclusive gross
    description: string;
    idempotencyKey: string; // e.g. `sitter:${bookingId}` — SUMIT dedups repeats
  }): Promise<CaptureResult> {
    if (!isCardVaultEnabled()) return { captured: false, reason: 'vault_disabled' };

    const token = await PaymentTokenVault.getActiveToken(input.userId, 'sumit');
    if (!token || !token.processorCustomerId) {
      return { captured: false, reason: 'no_saved_card' };
    }

    const r = await sumitClient.chargeSavedCard({
      idempotencyKey: input.idempotencyKey,
      sumitCustomerId: token.processorCustomerId,
      description: input.description,
      amountIls: input.amountIls,
    });

    if (!r.captured) {
      // Do NOT blindly kill the token on a transient/uncertain failure; only flag it when
      // SUMIT clearly rejected the saved method. Everything else stays 'active' to retry.
      if (r.wired && /declin|invalid|expired|not\s*found|no\s*payment\s*method/i.test(r.reason || '')) {
        await PaymentTokenVault.markFailed(token.id, input.userId).catch(() => {});
      }
      logger.warn('[SumitCardVault] capture fail-closed', { userId: input.userId, idempotencyKey: input.idempotencyKey, reason: r.reason });
      return { captured: false, reason: r.reason || 'sumit_not_confirmed' };
    }

    logger.info('[SumitCardVault] capture confirmed by SUMIT', {
      userId: input.userId, idempotencyKey: input.idempotencyKey, sumitDocumentId: r.sumitDocumentId,
    });
    return { captured: true, sumitDocumentId: r.sumitDocumentId, transactionId: r.transactionId };
  }
}

export const sumitCardVault = SumitCardVault;
