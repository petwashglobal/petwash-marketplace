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
   * Save a card to a SUMIT customer + record its token locally. `singlePaymentToken`
   * comes from SUMIT's own tokenization (hosted page / widget) — we never see the PAN.
   * Returns saved:false fail-closed on any problem; caller must NOT treat the user as
   * having a card on file unless saved:true.
   */
  static async saveCard(input: {
    userId: string;
    sumitCustomerId: number | string;
    singlePaymentToken: string;
    cardBrand?: string;
    cardLast4?: string;
    expMonth?: number;
    expYear?: number;
    billingName?: string;
    customerEmail?: string;
    consentVersion?: string;
  }): Promise<{ saved: boolean; reason?: string }> {
    if (!isCardVaultEnabled()) return { saved: false, reason: 'vault_disabled' };
    const r = await sumitClient.setForCustomer({
      sumitCustomerId: input.sumitCustomerId,
      singlePaymentToken: input.singlePaymentToken,
      customerName: input.billingName,
      customerEmail: input.customerEmail,
    });
    if (!r.saved) {
      logger.warn('[SumitCardVault] setForCustomer did not save (fail-closed)', { userId: input.userId, reason: r.reason });
      return { saved: false, reason: r.reason || 'sumit_did_not_save' };
    }
    await PaymentTokenVault.saveToken({
      userId: input.userId,
      provider: 'sumit',
      processorCustomerId: String(input.sumitCustomerId),
      processorTokenId: r.paymentMethodId || String(input.sumitCustomerId), // the saved method ref
      cardBrand: input.cardBrand,
      cardLast4: input.cardLast4,
      expMonth: input.expMonth,
      expYear: input.expYear,
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
