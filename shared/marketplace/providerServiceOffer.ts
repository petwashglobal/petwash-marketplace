/**
 * Canonical ProviderServiceOffer types (Business doctrine §4).
 *
 * These are the SHAPES the doctrine expects the marketplace to converge on.
 * The current repo stores pricing on legacy per-provider-type tables
 * (walkerProfiles.baseHourlyRate, trainers.hourlyRate,
 * sitterProfiles.pricePerDayCents / pricePerHourCents, and provider-onboarding's
 * base_rate_per_hour_cents / base_rate_per_night_cents / base_rate_per_visit_cents).
 *
 * Rather than a schema migration this round (doctrine §20 non-goals),
 * `server/services/marketplace/ProviderServiceOfferService` projects each
 * legacy row into this shape. New booking + search + quote code READS through
 * that adapter — never the raw legacy field.
 */
import type { ServiceType, RateUnit, Species } from './actors';

export type Currency = 'ILS';

export interface ExtraPetPricing {
  /** Cents charged for each pet beyond the first (business doctrine §5.5 model A). */
  additionalPetCents: number;
  /** Cap on how many extra pets the offer prices this way. undefined = uncapped. */
  maxExtraPets?: number;
}

export interface ProviderServiceOfferPricing {
  baseRateCents: number;
  rateUnit: RateUnit;
  currency: Currency;
  extraPetPricing?: ExtraPetPricing;
  /**
   * True when this pricing was projected from a legacy field the adapter
   * had to guess about (e.g. sitter with only pricePerHourCents → PER_NIGHT
   * via day↔hour fallback). Callers can decide whether to render a "confirm
   * with provider" step before committing (business doctrine §12 quote
   * snapshot must record the real price, not an invented one).
   */
  legacyProjection: boolean;
  legacyNote?: string;
}

export interface ProviderServiceOfferMeta {
  providerUid: string;
  serviceType: ServiceType;
  approvalStatus: 'not_started' | 'pending' | 'approved' | 'rejected';
  active: boolean;
  acceptedSpecies: Species[];
  maxPets?: number;
}

export interface ProviderServiceOffer {
  meta: ProviderServiceOfferMeta;
  pricing: ProviderServiceOfferPricing;
}

/**
 * Business doctrine §11 — booking pricing model.
 *
 * The offer declares its pricing model; the pricer respects that model.
 * NEVER `basePrice * petCount` unless the offer's `model` is FLAT_PER_PET.
 */
export type BookingPricingModel =
  | { model: 'FIRST_PLUS_EXTRA'; firstPetCents: number; extraPetCents: number }
  | { model: 'FLAT_PER_PET'; perPetCents: number }
  | { model: 'FLAT'; totalCents: number };

export interface PricedBooking {
  subtotalCents: number;
  currency: Currency;
  breakdown: Array<{ label: string; cents: number }>;
  model: BookingPricingModel['model'];
}

/**
 * Deterministic pricing over an offer's declared model.
 * `petCount` is the BookingParty size (business doctrine §5.1).
 */
export function priceBooking(
  pricingModel: BookingPricingModel,
  units: number, // days for DAYCARE, nights for PET_SITTING, walks for DOG_WALKING, etc.
  petCount: number,
): PricedBooking {
  if (units < 1) throw new Error('units must be >= 1');
  if (petCount < 1) throw new Error('petCount must be >= 1');

  switch (pricingModel.model) {
    case 'FLAT': {
      return {
        subtotalCents: pricingModel.totalCents * units,
        currency: 'ILS',
        breakdown: [{ label: 'Flat rate', cents: pricingModel.totalCents * units }],
        model: 'FLAT',
      };
    }
    case 'FLAT_PER_PET': {
      const cents = pricingModel.perPetCents * units * petCount;
      return {
        subtotalCents: cents,
        currency: 'ILS',
        breakdown: [{ label: `${petCount} pet(s) × ${units} unit(s)`, cents }],
        model: 'FLAT_PER_PET',
      };
    }
    case 'FIRST_PLUS_EXTRA': {
      const firstCents = pricingModel.firstPetCents * units;
      const extraCents = pricingModel.extraPetCents * Math.max(0, petCount - 1) * units;
      return {
        subtotalCents: firstCents + extraCents,
        currency: 'ILS',
        breakdown: [
          { label: `First pet × ${units} unit(s)`, cents: firstCents },
          { label: `Extra pets × ${units} unit(s)`, cents: extraCents },
        ],
        model: 'FIRST_PLUS_EXTRA',
      };
    }
  }
}
