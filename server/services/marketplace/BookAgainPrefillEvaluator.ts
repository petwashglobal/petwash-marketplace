/**
 * BookAgainPrefillEvaluator — CEO PROGRAM 29 (Book Again).
 *
 * Pure evaluator. Doctrine: one-tap repeat prefills provider,
 * service, pets, care/location; asks the user for new dates;
 * REVALIDATES provider active, service active, availability,
 * and CURRENT price at book-time. NEVER silently use historic
 * price.
 *
 * This service produces the PREFILL shape + the revalidation
 * checklist. It does NOT perform the revalidation — the caller
 * hands the checklist to the corresponding services
 * (ProviderServiceApprovalEvaluator, ProviderAvailabilityService,
 * ProviderPricingService).
 */

export interface PriorBookingSnapshot {
  bookingId: string;
  providerUid: string;
  serviceCode: string;
  petIds: string[];
  areaCode?: string;
  addressCode?: string;                     // stable slug
  careNotesCode?: string;                   // stable slug
  historicTotalCents: number;               // discarded from the prefill (§ Program 29 doctrine)
}

export interface BookAgainPrefill {
  providerUid: string;
  serviceCode: string;
  petIds: string[];
  areaCode?: string;
  addressCode?: string;
  careNotesCode?: string;
  requiresNewDates: true;
  historicPriceCode: 'HIDDEN_MUST_REVALIDATE';
  revalidationChecklist: readonly (
    | 'PROVIDER_ACTIVE'
    | 'SERVICE_BOOKABLE'
    | 'AVAILABILITY_MATCHES_NEW_DATES'
    | 'CURRENT_PRICE_FROM_PROVIDER'
  )[];
}

export type PrefillOutcome =
  | { code: 'OK'; prefill: BookAgainPrefill }
  | { code: 'BLOCKED'; reasonCode: 'PRIOR_BOOKING_INCOMPLETE' };

const CHECKLIST = [
  'PROVIDER_ACTIVE',
  'SERVICE_BOOKABLE',
  'AVAILABILITY_MATCHES_NEW_DATES',
  'CURRENT_PRICE_FROM_PROVIDER',
] as const;

export function buildBookAgainPrefill(input: { prior: PriorBookingSnapshot }): PrefillOutcome {
  const p = input.prior;
  if (!p.providerUid || !p.serviceCode || !p.petIds || p.petIds.length === 0) {
    return { code: 'BLOCKED', reasonCode: 'PRIOR_BOOKING_INCOMPLETE' };
  }
  return {
    code: 'OK',
    prefill: {
      providerUid: p.providerUid,
      serviceCode: p.serviceCode,
      petIds: [...p.petIds],
      areaCode: p.areaCode,
      addressCode: p.addressCode,
      careNotesCode: p.careNotesCode,
      requiresNewDates: true,
      historicPriceCode: 'HIDDEN_MUST_REVALIDATE',
      revalidationChecklist: CHECKLIST,
    },
  };
}
