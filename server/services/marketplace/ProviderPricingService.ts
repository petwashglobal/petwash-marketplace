/**
 * ProviderPricingService — CEO PROGRAM 22 (Provider Pricing).
 *
 * Pure evaluator. There is NO universal `pricePerHour` model in
 * PetWash. Each provider service publishes its own rate model, and
 * the price of a booking is composed from the model + the
 * booking's shape (pets, duration, add-ons, holiday flag,
 * distance where applicable).
 *
 * The evaluator returns a priced BREAKDOWN — never a single opaque
 * total — so the client can render the exact line items and the
 * server can idempotently store them against the booking.
 *
 * Doctrine (§ Program 22): "No universal pricePerHour assumption."
 * When the rate model doesn't cover a dimension the customer picked,
 * the evaluator returns `PRICING_INCOMPLETE` with the missing
 * dimension slug rather than silently defaulting to zero.
 */

export type RateModelKind =
  | 'PER_WALK'
  | 'PER_DURATION'
  | 'PER_VISIT'
  | 'PER_DAY'
  | 'PER_NIGHT';

export interface RateModelPerWalk {
  kind: 'PER_WALK';
  baseCents: number;
}

export interface RateModelPerDuration {
  kind: 'PER_DURATION';
  /** Rate in cents per minute of service. */
  perMinuteCents: number;
  /** Minimum billable minutes. */
  minMinutes?: number;
}

export interface RateModelPerVisit {
  kind: 'PER_VISIT';
  baseCents: number;
}

export interface RateModelPerDay {
  kind: 'PER_DAY';
  perDayCents: number;
}

export interface RateModelPerNight {
  kind: 'PER_NIGHT';
  perNightCents: number;
}

export type RateModel =
  | RateModelPerWalk
  | RateModelPerDuration
  | RateModelPerVisit
  | RateModelPerDay
  | RateModelPerNight;

export interface AddOnRate {
  code: 'ADDITIONAL_PET' | 'EXTRA_CARE' | 'HOME_VISIT' | 'MEDICATION' | 'BIRD_FEEDING' | 'HOLIDAY_SURCHARGE' | 'DISTANCE_KM';
  amountCents: number;
  /** For per-unit add-ons (additional pet count, km). Absent = charged once. */
  unitLabel?: 'PET' | 'KM';
}

export interface PricingInput {
  rateModel: RateModel;
  /** Optional add-ons declared by the provider for this service. */
  addOns?: AddOnRate[];
  /** Pets included in the booking (used for ADDITIONAL_PET line items). */
  petCount: number;
  /** For duration-based rates, the requested minutes. */
  durationMinutes?: number;
  /** For per-day rates, the requested number of days. */
  days?: number;
  /** For per-night rates, the requested number of nights. */
  nights?: number;
  /** Applied add-on codes; per-unit add-ons include the count. */
  appliedAddOns?: Array<{ code: AddOnRate['code']; units?: number }>;
  /** True if the booking date is a legally recognised holiday. */
  isHoliday?: boolean;
  /** For DISTANCE_KM add-on. */
  distanceKm?: number;
}

export interface PricingLine {
  code: string;                             // stable slug
  amountCents: number;
  units?: number;
  descriptionCode?: string;                 // stable slug for translation
}

export type PricingOutcome =
  | { code: 'OK'; lines: PricingLine[]; totalCents: number }
  | { code: 'PRICING_INCOMPLETE'; missingDimension: string };

export function priceBooking(input: PricingInput): PricingOutcome {
  const lines: PricingLine[] = [];
  const addOnCatalog = new Map((input.addOns ?? []).map((a) => [a.code, a]));

  switch (input.rateModel.kind) {
    case 'PER_WALK':
      lines.push({ code: 'BASE_WALK', amountCents: input.rateModel.baseCents });
      break;
    case 'PER_VISIT':
      lines.push({ code: 'BASE_VISIT', amountCents: input.rateModel.baseCents });
      break;
    case 'PER_DURATION': {
      if (typeof input.durationMinutes !== 'number' || input.durationMinutes <= 0) {
        return { code: 'PRICING_INCOMPLETE', missingDimension: 'DURATION_MINUTES' };
      }
      const billable = Math.max(input.durationMinutes, input.rateModel.minMinutes ?? 0);
      lines.push({ code: 'BASE_DURATION', amountCents: billable * input.rateModel.perMinuteCents, units: billable });
      break;
    }
    case 'PER_DAY': {
      if (typeof input.days !== 'number' || input.days <= 0) {
        return { code: 'PRICING_INCOMPLETE', missingDimension: 'DAYS' };
      }
      lines.push({ code: 'BASE_DAY', amountCents: input.days * input.rateModel.perDayCents, units: input.days });
      break;
    }
    case 'PER_NIGHT': {
      if (typeof input.nights !== 'number' || input.nights <= 0) {
        return { code: 'PRICING_INCOMPLETE', missingDimension: 'NIGHTS' };
      }
      lines.push({ code: 'BASE_NIGHT', amountCents: input.nights * input.rateModel.perNightCents, units: input.nights });
      break;
    }
    default: {
      // Exhaustiveness guard — new kinds must add a case above.
      const _exhaustive: never = input.rateModel;
      return { code: 'PRICING_INCOMPLETE', missingDimension: 'RATE_MODEL_KIND' };
    }
  }

  // Additional pets — only if the provider declared the add-on rate.
  if (input.petCount > 1) {
    const rate = addOnCatalog.get('ADDITIONAL_PET');
    if (!rate) return { code: 'PRICING_INCOMPLETE', missingDimension: 'ADDITIONAL_PET' };
    const additional = input.petCount - 1;
    lines.push({ code: 'ADDITIONAL_PET', amountCents: rate.amountCents * additional, units: additional });
  }

  // Applied add-ons.
  for (const applied of input.appliedAddOns ?? []) {
    const rate = addOnCatalog.get(applied.code);
    if (!rate) return { code: 'PRICING_INCOMPLETE', missingDimension: applied.code };
    const units = applied.units ?? 1;
    lines.push({ code: applied.code, amountCents: rate.amountCents * units, units });
  }

  // Holiday surcharge — only if the provider declared it.
  if (input.isHoliday) {
    const rate = addOnCatalog.get('HOLIDAY_SURCHARGE');
    if (rate) lines.push({ code: 'HOLIDAY_SURCHARGE', amountCents: rate.amountCents });
    // If the provider did NOT declare it, the evaluator refuses to
    // invent one (§ Program 22 — no universal pricePerHour, and by
    // extension no invented holiday markup).
  }

  // Distance km — only if the provider declared it AND the caller
  // provided a distance.
  if (typeof input.distanceKm === 'number' && input.distanceKm > 0) {
    const rate = addOnCatalog.get('DISTANCE_KM');
    if (rate) {
      const units = Math.ceil(input.distanceKm);
      lines.push({ code: 'DISTANCE_KM', amountCents: rate.amountCents * units, units });
    }
  }

  const totalCents = lines.reduce((s, l) => s + l.amountCents, 0);
  return { code: 'OK', lines, totalCents };
}
