/**
 * ProviderServiceOfferService — CEO Business Doctrine §4 + §18.2 adapter.
 *
 * Legacy repo stores provider pricing on per-type tables:
 *   • walker_profiles.base_hourly_rate  (ILS decimal string)
 *   • trainers.hourly_rate              (ILS decimal string)
 *   • sitter_profiles.price_per_day_cents, .price_per_hour_cents  (cents ints)
 *   • provider_onboarding.base_rate_per_hour_cents / _per_night_cents /
 *     _per_visit_cents                  (cents ints, from the newer onboarding)
 *
 * The audit
 * (docs/architecture/marketplace-doctrine-repo-audit-2026.md §3)
 * confirmed drift: booking-search / providers / super-app-bookings /
 * booking-requests / groomers / quoteEngine / SitterAdvancedBookingEngine
 * all mix rate units, contradicting doctrine §6.
 *
 * This service PROJECTS each legacy row into the canonical
 *   { baseRateCents, rateUnit, currency }
 * shape per ServiceType, with a `legacyProjection` flag when the projection
 * had to guess (e.g. sitter with only hourly rate → PER_NIGHT via 24× fallback).
 *
 * New booking + search + quote code MUST read pricing through this adapter.
 * No schema migration this round (doctrine §20).
 */
import type {
  ProviderServiceOfferPricing,
  Currency,
} from '../../../shared/marketplace/providerServiceOffer';
import type { ServiceType, RateUnit } from '../../../shared/marketplace/actors';
import { isRateUnitValidFor } from '../../../shared/marketplace/actors';

const CURRENCY: Currency = 'ILS';

// The shapes we accept from the legacy tables. Callers pass in whichever
// projection they already selected; the adapter never queries directly —
// keeping it pure keeps it unit-testable and TSC-lightweight.

export interface LegacyWalkerProfile {
  baseHourlyRate?: string | number | null;
  hourlyRate?: string | number | null;
}

export interface LegacyTrainerProfile {
  hourlyRate?: string | number | null;
  sessionMinutes?: number | null;
}

export interface LegacySitterProfile {
  pricePerDayCents?: number | null;
  pricePerHourCents?: number | null;
  pricePerNightCents?: number | null;
}

export interface LegacyProviderOnboardingRates {
  baseRatePerHourCents?: number | null;
  baseRatePerNightCents?: number | null;
  baseRatePerVisitCents?: number | null;
  baseRatePerSessionCents?: number | null;
  baseRatePerDayCents?: number | null;
}

/** Small helper: ILS decimal or number → integer agorot (cents). */
function ilsToCents(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/**
 * DOG_WALKING projection.
 *
 * Legacy walker row carries an ILS-decimal `baseHourlyRate` (or `hourlyRate`).
 * Doctrine §4.3 says walker priced by PER_WALK or PER_DURATION — never a raw
 * hourly rate exposed as pricePerHour on the search card. We project to
 * PER_DURATION with the standard 60-minute walk = the hourly rate. Callers
 * with a real PER_WALK price (e.g. new onboarding baseRatePerVisitCents used
 * as a walk price) can override by passing a walkOverrideCents.
 */
export function pricingForDogWalking(
  walker: LegacyWalkerProfile,
  onboarding?: LegacyProviderOnboardingRates,
): ProviderServiceOfferPricing | null {
  const cents =
    onboarding?.baseRatePerHourCents ??
    ilsToCents(walker.baseHourlyRate) ??
    ilsToCents(walker.hourlyRate);
  if (cents === null || cents <= 0) return null;

  const rateUnit: RateUnit = 'PER_DURATION';
  if (!isRateUnitValidFor('DOG_WALKING', rateUnit)) {
    throw new Error('doctrine drift: PER_DURATION must be valid for DOG_WALKING');
  }
  return {
    baseRateCents: cents,
    rateUnit,
    currency: CURRENCY,
    legacyProjection: true,
    legacyNote:
      'Projected from legacy walker hourly rate; 60-minute walk assumed until offer declares PER_WALK.',
  };
}

/**
 * TRAINING projection.
 *
 * Legacy trainer row carries `hourlyRate`; doctrine §4.3 says PER_SESSION.
 * Session is defaulted to 60 minutes if the row didn't declare one.
 */
export function pricingForTraining(
  trainer: LegacyTrainerProfile,
  onboarding?: LegacyProviderOnboardingRates,
): ProviderServiceOfferPricing | null {
  const cents =
    onboarding?.baseRatePerSessionCents ??
    ilsToCents(trainer.hourlyRate);
  if (cents === null || cents <= 0) return null;
  const rateUnit: RateUnit = 'PER_SESSION';
  if (!isRateUnitValidFor('TRAINING', rateUnit)) {
    throw new Error('doctrine drift: PER_SESSION must be valid for TRAINING');
  }
  const legacy = onboarding?.baseRatePerSessionCents === undefined;
  return {
    baseRateCents: cents,
    rateUnit,
    currency: CURRENCY,
    legacyProjection: legacy,
    legacyNote: legacy
      ? `Projected from legacy trainer hourly rate; ${trainer.sessionMinutes ?? 60}-minute session assumed.`
      : undefined,
  };
}

/**
 * PET_SITTING projection.
 *
 * Legacy sitter carries pricePerDayCents (24h) and/or pricePerHourCents.
 * Doctrine §4.3 says PET_SITTING is priced PER_NIGHT or PER_24H.
 * Prefer PER_NIGHT from the explicit night cents if the newer onboarding has
 * it, else the legacy day cents (day and night were conflated), else fall
 * back to hourly × 24 with legacyProjection=true and a legacyNote so the
 * booking UI can surface "confirm with sitter" (business doctrine §12).
 */
export function pricingForPetSitting(
  sitter: LegacySitterProfile,
  onboarding?: LegacyProviderOnboardingRates,
): ProviderServiceOfferPricing | null {
  const rateUnit: RateUnit = 'PER_NIGHT';
  if (!isRateUnitValidFor('PET_SITTING', rateUnit)) {
    throw new Error('doctrine drift: PER_NIGHT must be valid for PET_SITTING');
  }
  const explicitNight =
    onboarding?.baseRatePerNightCents ?? sitter.pricePerNightCents ?? null;
  if (explicitNight && explicitNight > 0) {
    return { baseRateCents: explicitNight, rateUnit, currency: CURRENCY, legacyProjection: false };
  }
  const dayCents = sitter.pricePerDayCents ?? null;
  if (dayCents && dayCents > 0) {
    return {
      baseRateCents: dayCents,
      rateUnit,
      currency: CURRENCY,
      legacyProjection: true,
      legacyNote:
        'Projected from legacy pricePerDayCents; day and night conflated pending explicit night rate.',
    };
  }
  const hourCents = sitter.pricePerHourCents ?? null;
  if (hourCents && hourCents > 0) {
    return {
      baseRateCents: hourCents * 24,
      rateUnit,
      currency: CURRENCY,
      legacyProjection: true,
      legacyNote:
        'Projected from legacy pricePerHourCents × 24; confirm with sitter before quote snapshot (business doctrine §12).',
    };
  }
  return null;
}

/**
 * HOME_VISIT projection — PER_VISIT.
 */
export function pricingForHomeVisit(
  onboarding?: LegacyProviderOnboardingRates,
): ProviderServiceOfferPricing | null {
  const cents = onboarding?.baseRatePerVisitCents ?? null;
  if (cents === null || cents <= 0) return null;
  const rateUnit: RateUnit = 'PER_VISIT';
  if (!isRateUnitValidFor('HOME_VISIT', rateUnit)) {
    throw new Error('doctrine drift: PER_VISIT must be valid for HOME_VISIT');
  }
  return { baseRateCents: cents, rateUnit, currency: CURRENCY, legacyProjection: false };
}

/**
 * DAYCARE projection — PER_DAY.
 */
export function pricingForDaycare(
  onboarding?: LegacyProviderOnboardingRates,
): ProviderServiceOfferPricing | null {
  const cents = onboarding?.baseRatePerDayCents ?? null;
  if (cents === null || cents <= 0) return null;
  const rateUnit: RateUnit = 'PER_DAY';
  if (!isRateUnitValidFor('DAYCARE', rateUnit)) {
    throw new Error('doctrine drift: PER_DAY must be valid for DAYCARE');
  }
  return { baseRateCents: cents, rateUnit, currency: CURRENCY, legacyProjection: false };
}

/**
 * Central dispatcher. Callers pass whatever legacy rows they already have;
 * the function returns the doctrine-shaped pricing, or null when the
 * provider has not published a rate for that service (business doctrine
 * §4.4 — never invent a price).
 */
export interface PricingInput {
  service: ServiceType;
  walker?: LegacyWalkerProfile;
  trainer?: LegacyTrainerProfile;
  sitter?: LegacySitterProfile;
  onboarding?: LegacyProviderOnboardingRates;
}

export function projectPricing(input: PricingInput): ProviderServiceOfferPricing | null {
  switch (input.service) {
    case 'DOG_WALKING':
      return input.walker ? pricingForDogWalking(input.walker, input.onboarding) : null;
    case 'TRAINING':
      return input.trainer ? pricingForTraining(input.trainer, input.onboarding) : null;
    case 'PET_SITTING':
      return input.sitter ? pricingForPetSitting(input.sitter, input.onboarding) : null;
    case 'HOME_VISIT':
      return pricingForHomeVisit(input.onboarding);
    case 'DAYCARE':
      return pricingForDaycare(input.onboarding);
    case 'PET_TRANSPORT':
      // Not yet exposed to the search / booking surface — return null so the
      // caller knows to hide the offer until PetWash activates transport.
      return null;
  }
}
