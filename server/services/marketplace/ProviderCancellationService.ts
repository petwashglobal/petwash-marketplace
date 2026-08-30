/**
 * ProviderCancellationService — CEO PROGRAM 14 (Provider Cancel).
 *
 * Pure evaluator. Provider cancellation is SEPARATE from customer
 * cancellation and cannot reuse the customer's fee logic. When a
 * provider cancels a CONFIRMED booking, downstream effects are:
 *   • customer notification,
 *   • FULL refund preview (customer never carries the cost of a
 *     provider cancellation),
 *   • replacement search hint,
 *   • calendar release,
 *   • provider integrity record,
 *   • support attention if patterns emerge.
 *
 * The evaluator decides:
 *   • CAN_CANCEL — the booking is still in a cancellable state,
 *   • OUTCOME_SHAPE — a preview record the client renders BEFORE
 *     the provider confirms the cancellation (money preview, per
 *     § Program 39 ActionConfirmationPolicy).
 */

export type ProviderCancelStatus =
  | 'REQUESTED' | 'QUOTED' | 'ACCEPTED' | 'CONFIRMED' | 'READY_TO_START'
  | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DECLINED' | 'EXPIRED';

const NON_CANCELLABLE: ReadonlySet<ProviderCancelStatus> = new Set<ProviderCancelStatus>([
  'COMPLETED', 'CANCELLED', 'DECLINED', 'EXPIRED',
]);

export interface ProviderCancelInput {
  status: ProviderCancelStatus;
  paymentCapturedCents: number;
  currency: 'ILS';
  providerCancelCountInLast30Days?: number;   // provider-integrity signal
}

export type ProviderCancelOutcome =
  | { code: 'NOT_CANCELLABLE'; reasonCode: string }
  | {
      code: 'PREVIEW';
      outcome: {
        customerRefundCents: number;         // ALWAYS full — provider fault
        currency: 'ILS';
        releaseCalendarSlot: boolean;
        notifyCustomer: boolean;
        triggerReplacementSearch: boolean;
        providerIntegrityImpact: 'LOW' | 'MEDIUM' | 'HIGH';
        reasonCode: 'PROVIDER_INITIATED_CANCELLATION';
      };
    };

export function previewProviderCancellation(input: ProviderCancelInput): ProviderCancelOutcome {
  if (NON_CANCELLABLE.has(input.status)) {
    return { code: 'NOT_CANCELLABLE', reasonCode: 'STATUS_NOT_CANCELLABLE' };
  }
  const wasPaid = input.paymentCapturedCents > 0;
  const cancelsThisMonth = input.providerCancelCountInLast30Days ?? 0;
  const integrity = cancelsThisMonth >= 3 ? 'HIGH' : cancelsThisMonth >= 1 ? 'MEDIUM' : 'LOW';

  return {
    code: 'PREVIEW',
    outcome: {
      customerRefundCents: wasPaid ? input.paymentCapturedCents : 0,
      currency: 'ILS',
      releaseCalendarSlot: true,
      notifyCustomer: true,
      // The doctrine: replacement search only when we can actually
      // help — for a booking that's already IN_PROGRESS, the customer
      // usually needs support, not a mass rebooking.
      triggerReplacementSearch: input.status !== 'IN_PROGRESS',
      providerIntegrityImpact: integrity,
      reasonCode: 'PROVIDER_INITIATED_CANCELLATION',
    },
  };
}
