/**
 * ProviderServiceOfferService — behavior pins (business doctrine §4, §6, §11).
 *
 * Locks the rate-unit-per-service contract and the doctrine-compliant
 * priceBooking helper. A regression that surfaces `pricePerHour` on a
 * walker/trainer, or that prices multi-pet by `basePrice * petCount`
 * without honoring the offer's declared model, fails here.
 */
import { describe, it, expect } from 'vitest';
import {
  projectPricing,
  pricingForDogWalking,
  pricingForTraining,
  pricingForPetSitting,
  pricingForHomeVisit,
  pricingForDaycare,
} from '../services/marketplace/ProviderServiceOfferService';
import { priceBooking } from '../../shared/marketplace/providerServiceOffer';

describe('rate-unit per service (business doctrine §4.3, §6)', () => {
  it('DOG_WALKING projects to PER_DURATION (never PER_HOUR)', () => {
    const p = pricingForDogWalking({ baseHourlyRate: '60' });
    expect(p).not.toBeNull();
    expect(p!.rateUnit).toBe('PER_DURATION');
    expect(p!.baseRateCents).toBe(6000);
    expect(p!.legacyProjection).toBe(true);
    expect(p!.legacyNote).toMatch(/60-minute walk/i);
  });

  it('TRAINING projects to PER_SESSION', () => {
    const p = pricingForTraining({ hourlyRate: '150' });
    expect(p!.rateUnit).toBe('PER_SESSION');
    expect(p!.baseRateCents).toBe(15000);
  });

  it('PET_SITTING projects to PER_NIGHT — explicit night rate wins', () => {
    const p = pricingForPetSitting(
      { pricePerDayCents: 18000, pricePerHourCents: 3000 },
      { baseRatePerNightCents: 22000 },
    );
    expect(p!.rateUnit).toBe('PER_NIGHT');
    expect(p!.baseRateCents).toBe(22000);
    expect(p!.legacyProjection).toBe(false);
  });

  it('PET_SITTING falls back to legacy pricePerDayCents when no explicit night rate', () => {
    const p = pricingForPetSitting({ pricePerDayCents: 18000 });
    expect(p!.rateUnit).toBe('PER_NIGHT');
    expect(p!.baseRateCents).toBe(18000);
    expect(p!.legacyProjection).toBe(true);
    expect(p!.legacyNote).toMatch(/pricePerDayCents/);
  });

  it('PET_SITTING falls back to hourly × 24 with a legacyNote asking confirmation', () => {
    const p = pricingForPetSitting({ pricePerHourCents: 2500 });
    expect(p!.rateUnit).toBe('PER_NIGHT');
    expect(p!.baseRateCents).toBe(60000);
    expect(p!.legacyProjection).toBe(true);
    expect(p!.legacyNote).toMatch(/confirm with sitter/i);
    // Doctrine §12: booking UI should surface this before committing a snapshot.
  });

  it('HOME_VISIT is PER_VISIT — no legacy hourly fallback', () => {
    const missing = pricingForHomeVisit({});
    expect(missing).toBeNull();
    const p = pricingForHomeVisit({ baseRatePerVisitCents: 9000 });
    expect(p!.rateUnit).toBe('PER_VISIT');
    expect(p!.baseRateCents).toBe(9000);
  });

  it('DAYCARE is PER_DAY', () => {
    const p = pricingForDaycare({ baseRatePerDayCents: 14000 });
    expect(p!.rateUnit).toBe('PER_DAY');
    expect(p!.baseRateCents).toBe(14000);
  });

  it('returns null when the provider has not published a rate (§4.4 — never invent a price)', () => {
    expect(pricingForDogWalking({})).toBeNull();
    expect(pricingForTraining({})).toBeNull();
    expect(pricingForPetSitting({})).toBeNull();
    expect(pricingForHomeVisit({})).toBeNull();
    expect(pricingForDaycare({})).toBeNull();
  });

  it('projectPricing dispatches by ServiceType', () => {
    const walker = projectPricing({ service: 'DOG_WALKING', walker: { baseHourlyRate: '75' } });
    expect(walker!.rateUnit).toBe('PER_DURATION');

    const sitter = projectPricing({ service: 'PET_SITTING', sitter: { pricePerDayCents: 20000 } });
    expect(sitter!.rateUnit).toBe('PER_NIGHT');

    const transport = projectPricing({ service: 'PET_TRANSPORT' });
    // §6: PET_TRANSPORT not yet exposed — returns null so caller hides.
    expect(transport).toBeNull();
  });
});

describe('multi-pet pricing (business doctrine §11, §5.5)', () => {
  it('FLAT prices per unit only — pet count irrelevant', () => {
    const p = priceBooking({ model: 'FLAT', totalCents: 8000 }, 3, 2);
    expect(p.subtotalCents).toBe(24000); // 8000 * 3 units, ignores 2 pets
    expect(p.model).toBe('FLAT');
  });

  it('FLAT_PER_PET multiplies units × pets', () => {
    const p = priceBooking({ model: 'FLAT_PER_PET', perPetCents: 7500 }, 2, 2);
    expect(p.subtotalCents).toBe(30000); // 7500 * 2 * 2
  });

  it('FIRST_PLUS_EXTRA charges the first pet + extra pet extension', () => {
    // Doctrine §5.5 example: Daycare Dog1 ₪140 + Dog2 +₪90 = ₪230/day.
    const p = priceBooking(
      { model: 'FIRST_PLUS_EXTRA', firstPetCents: 14000, extraPetCents: 9000 },
      1, // one day
      2, // two pets
    );
    expect(p.subtotalCents).toBe(23000);
    expect(p.model).toBe('FIRST_PLUS_EXTRA');
    expect(p.breakdown).toHaveLength(2);
  });

  it('FIRST_PLUS_EXTRA scales by units', () => {
    // Same pricing, 3 nights: (14000 + 9000) × 3 = 69000.
    const p = priceBooking(
      { model: 'FIRST_PLUS_EXTRA', firstPetCents: 14000, extraPetCents: 9000 },
      3,
      2,
    );
    expect(p.subtotalCents).toBe(69000);
  });

  it('rejects units < 1 or petCount < 1', () => {
    expect(() =>
      priceBooking({ model: 'FLAT', totalCents: 1000 }, 0, 1),
    ).toThrow();
    expect(() =>
      priceBooking({ model: 'FLAT', totalCents: 1000 }, 1, 0),
    ).toThrow();
  });
});
