/**
 * CancellationPreview — CEO Business Doctrine §14.6 + Action Brain §12.
 *
 * The typed shape the CANCEL_BOOKING_PAID action returns from its
 * preview() phase and consumes when the customer confirms. The
 * doctrine's cancellation legal engine (`CancellationPolicyRegistry`)
 * remains the source of truth for the cents math — this module is the
 * canonical WIRE shape that carries those numbers between preview and
 * execute.
 *
 * Rules:
 *   • Every cents field is server-computed (§54). Client never
 *     invents totals.
 *   • Preview carries `previewVersion` (§10) — a fresh recompute at
 *     execute time yielding a different snapshot returns STALE
 *     + QUOTE_CHANGED.
 *   • Refund destination is itemised (§56): card + eGift + wallet
 *     each with their own cents.
 *   • Provider impact + document effect surface for the customer BEFORE
 *     they commit (§12 the confirmation must explain what happens).
 */
import type { ActionPreview, MoneyEffect } from './action';

export type CancellationInitiator = 'CUSTOMER' | 'PROVIDER' | 'STAFF';

export interface CancellationRefundDestination {
  cardCents: number;                  // back to original card
  eGiftCents: number;                 // restored to eGift balance
  walletCents: number;                // back to PetWash wallet
}

export interface CancellationProviderImpact {
  payoutRolledBack: boolean;          // provider payout accrual reversed
  scheduleReleased: boolean;          // provider's calendar slot re-opens
  ratingImpact: 'NONE' | 'CANCEL_COUNT_INCREMENT';
}

export interface CancellationDocumentEffect {
  needsCreditNote: boolean;           // fiscal engine will issue a credit
  externalRef?: string;               // SUMIT credit-note handle when known
}

export interface CancellationPreviewData {
  bookingId: string;
  bookingRef: string;                 // PW-BKG-XXXX
  initiator: CancellationInitiator;
  policyVersion: string;              // CancellationPolicyRegistry version pin
  originalTotalCents: number;
  feeCents: number;                   // cancellation fee (non-refundable slice)
  refundCents: number;                // original - fee - already-consumed
  refundDestination: CancellationRefundDestination;
  providerImpact: CancellationProviderImpact;
  documentEffect: CancellationDocumentEffect;
  currency: 'ILS';
}

/**
 * Wrap the domain-specific data in the framework's ActionPreview
 * envelope so the client can render the standard preview UI.
 */
export interface CancellationPreview extends ActionPreview {
  actionType: 'BOOKING_CANCEL_PAID' | 'BOOKING_CANCEL_UNPAID';
  cancellation: CancellationPreviewData;
}

/**
 * Deterministic ActionPreview builder. Callers hand in the
 * server-computed CancellationPreviewData (from the registry) and this
 * helper stamps title / summary / warnings / financial in the framework's
 * shape. Kept pure so unit tests can lock the copy discipline.
 */
export function buildCancellationPreview(
  data: CancellationPreviewData,
  previewVersion: string,
  expiresAt: string,
): CancellationPreview {
  const actionType: CancellationPreview['actionType'] =
    data.originalTotalCents > 0 ? 'BOOKING_CANCEL_PAID' : 'BOOKING_CANCEL_UNPAID';

  const financial: MoneyEffect = {
    // Customer perspective: negative = refund back to them.
    netCents: -1 * data.refundCents,
    currency: data.currency,
    breakdown: [
      { label: 'Original', cents: data.originalTotalCents },
      { label: 'Cancellation fee', cents: -1 * data.feeCents },
      { label: 'Refund to you', cents: -1 * data.refundCents },
    ],
  };

  const warnings: string[] = [];
  if (data.providerImpact.payoutRolledBack) {
    warnings.push('The provider’s payout for this booking will be reversed.');
  }
  if (!data.documentEffect.needsCreditNote && data.refundCents > 0) {
    warnings.push('This refund does not require a fiscal credit note.');
  }
  if (data.feeCents > 0 && data.feeCents === data.originalTotalCents) {
    warnings.push('No refund is available under the applicable cancellation policy.');
  }

  return {
    actionType,
    title: 'Cancel booking',
    summary: buildSummary(data),
    affectedEntities: [
      { kind: 'BOOKING', id: data.bookingId, label: data.bookingRef },
    ],
    financial,
    warnings,
    expiresAt,
    previewVersion,
    cancellation: data,
  };
}

function buildSummary(data: CancellationPreviewData): string {
  if (data.feeCents === 0) {
    return 'Full refund back to your original payment method.';
  }
  if (data.feeCents === data.originalTotalCents) {
    return 'No refund is available for this cancellation.';
  }
  return `Partial refund after a ${data.currency} ${(data.feeCents / 100).toFixed(2)} cancellation fee.`;
}

/**
 * Runtime guard used by the CANCEL execute handler: refuses a client-
 * supplied preview whose refund/destination math doesn't add up.
 * A drift here should never reach the mutation — but if it did, this
 * final guard blocks it (§54 money-truth: server number wins).
 */
export function isRefundDestinationConsistent(
  data: CancellationPreviewData,
): boolean {
  const sum =
    data.refundDestination.cardCents +
    data.refundDestination.eGiftCents +
    data.refundDestination.walletCents;
  return sum === data.refundCents;
}
