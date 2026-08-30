/**
 * BookAgainPrefillEvaluator — Program 29.
 */
import { describe, it, expect } from 'vitest';
import {
  buildBookAgainPrefill,
  type PriorBookingSnapshot,
} from '../services/marketplace/BookAgainPrefillEvaluator';

const prior: PriorBookingSnapshot = {
  bookingId: 'B-1',
  providerUid: 'maya',
  serviceCode: 'DOG_WALK',
  petIds: ['bruno', 'charlie'],
  areaCode: 'TLV_CENTER',
  addressCode: 'ADDR-1',
  careNotesCode: 'STANDARD_CARE',
  historicTotalCents: 15000,
};

describe('BookAgainPrefillEvaluator', () => {
  it('returns provider + service + pets prefilled', () => {
    const out = buildBookAgainPrefill({ prior });
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.prefill.providerUid).toBe('maya');
    expect(out.prefill.serviceCode).toBe('DOG_WALK');
    expect(out.prefill.petIds).toEqual(['bruno', 'charlie']);
  });

  it('carries location + care slugs forward', () => {
    const out = buildBookAgainPrefill({ prior });
    if (out.code !== 'OK') throw new Error();
    expect(out.prefill.areaCode).toBe('TLV_CENTER');
    expect(out.prefill.addressCode).toBe('ADDR-1');
    expect(out.prefill.careNotesCode).toBe('STANDARD_CARE');
  });

  it('historic price is HIDDEN — must revalidate (§ Program 29 doctrine)', () => {
    const out = buildBookAgainPrefill({ prior });
    if (out.code !== 'OK') throw new Error();
    expect(out.prefill.historicPriceCode).toBe('HIDDEN_MUST_REVALIDATE');
  });

  it('flag requiresNewDates is TRUE and the checklist enforces the four revalidations', () => {
    const out = buildBookAgainPrefill({ prior });
    if (out.code !== 'OK') throw new Error();
    expect(out.prefill.requiresNewDates).toBe(true);
    expect(out.prefill.revalidationChecklist).toEqual([
      'PROVIDER_ACTIVE',
      'SERVICE_BOOKABLE',
      'AVAILABILITY_MATCHES_NEW_DATES',
      'CURRENT_PRICE_FROM_PROVIDER',
    ]);
  });

  it('prior with no pets → BLOCKED(PRIOR_BOOKING_INCOMPLETE)', () => {
    const out = buildBookAgainPrefill({ prior: { ...prior, petIds: [] } });
    expect(out.code).toBe('BLOCKED');
  });

  it('petIds array is copied — mutating returned array does not touch input', () => {
    const out = buildBookAgainPrefill({ prior });
    if (out.code !== 'OK') throw new Error();
    out.prefill.petIds.push('MUTATED');
    expect(prior.petIds).toEqual(['bruno', 'charlie']);
  });
});
