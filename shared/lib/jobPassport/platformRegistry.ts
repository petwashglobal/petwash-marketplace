/**
 * PetWash Platform / Service Registry — CEO 2026-08-27 §5.
 *
 * ONE registry naming what each PetWash platform IS in the JobPassport
 * read model — the fulfiller kind, which authority owns booking /
 * pricing / payment, what completion proof the service requires,
 * whether live tracking exists, whether a human provider is required.
 *
 * "No React page should invent this independently." A composer /
 * client / admin surface asks THIS file, never hard-codes.
 *
 * TYPES-ONLY today (§60: Phase 1 is READ-ONLY adapters over existing
 * data — no new tables). The composer (server/services/jobPassport/*)
 * reads these definitions to pick the right authority to delegate to.
 */

import type { ActorKind } from './actorRegistry';

/** Every canonical PetWash platform. */
export const PLATFORM_CODES = [
  'SITTER_SUITE',
  'WALK_MY_PET',
  'ACADEMY',
  'PETTREK',
  'SHOP',
  'K9000',
  'EGIFT',
  'UNIFIED_REQUEST', // native booking_requests marketplace path
] as const;
export type PlatformCode = (typeof PLATFORM_CODES)[number];

/** Which authority owns the booking row for a given platform. */
export type BookingAuthority =
  | 'sitter_bookings'
  | 'walk_bookings'
  | 'trainer_bookings'
  | 'pettrek_bookings'
  | 'shop_orders'
  | 'k9000_redemptions'
  | 'egift_orders'
  | 'booking_requests';

/** Where the money authority lives for a completed transaction. */
export type PaymentAuthority =
  | 'nayax'
  | 'sumit'
  | 'wallet'
  | 'stripe_future'
  | 'none';

/**
 * How the service is proved complete — used later by the verification
 * policy registry (§45) to choose START / HANDOFF / COMPLETE methods.
 */
export type CompletionProof =
  | 'PROVIDER_MARK_THEN_CUSTOMER_CONFIRM' // sitter / walk / academy
  | 'STAFF_HANDOFF_CODE'                   // shop pickup
  | 'MACHINE_CYCLE_COMPLETE'               // K9000 (Nayax reports completion)
  | 'EGIFT_REDEMPTION'                     // when the eGift is used
  | 'NONE';                                // eGift purchase itself needs no completion

export interface PlatformDefinition {
  platformCode: PlatformCode;
  /** Which service types this platform issues (informational — routing
   *  authority still lives in the individual service handlers). */
  serviceTypes: readonly string[];
  fulfillerKind: ActorKind;
  bookingAuthority: BookingAuthority;
  paymentAuthority: readonly PaymentAuthority[];
  completionProof: CompletionProof;
  liveTrackingSupported: boolean;
  providerRequired: boolean;
  /**
   * A human-readable jobRef prefix under which this platform's
   * passports live. Never becomes an auth token — see §13. Just a
   * display / search hint (PW-W7H4K2 for a walk, PW-S8D2A for shop).
   */
  jobRefLetter: 'W' | 'S' | 'A' | 'D' | 'H' | 'K' | 'G' | 'B';
}

/** The registry. Frozen — mutation is a source-pin failure. */
export const PLATFORMS: readonly PlatformDefinition[] = [
  {
    platformCode: 'SITTER_SUITE',
    serviceTypes: ['pet_sitting', 'home_sitting', 'boarding'],
    fulfillerKind: 'PROVIDER',
    bookingAuthority: 'sitter_bookings',
    paymentAuthority: ['nayax', 'sumit'],
    completionProof: 'PROVIDER_MARK_THEN_CUSTOMER_CONFIRM',
    liveTrackingSupported: false,
    providerRequired: true,
    jobRefLetter: 'H', // "Home / Hosting"
  },
  {
    platformCode: 'WALK_MY_PET',
    serviceTypes: ['dog_walk', 'group_walk'],
    fulfillerKind: 'PROVIDER',
    bookingAuthority: 'walk_bookings',
    paymentAuthority: ['nayax', 'sumit', 'wallet'],
    completionProof: 'PROVIDER_MARK_THEN_CUSTOMER_CONFIRM',
    liveTrackingSupported: true,
    providerRequired: true,
    jobRefLetter: 'W',
  },
  {
    platformCode: 'ACADEMY',
    serviceTypes: ['training_session', 'group_class'],
    fulfillerKind: 'PROVIDER',
    bookingAuthority: 'trainer_bookings',
    paymentAuthority: ['wallet'],
    completionProof: 'PROVIDER_MARK_THEN_CUSTOMER_CONFIRM',
    liveTrackingSupported: false,
    // §10 dispatcher policy: Academy today is non-symmetric — treat as
    // SERVICE_NOT_ACTIVE until unified. providerRequired stays true so
    // the composer names the trainer, but the dispatcher refuses to
    // move money.
    providerRequired: true,
    jobRefLetter: 'A',
  },
  {
    platformCode: 'PETTREK',
    serviceTypes: ['pet_transport'],
    fulfillerKind: 'PROVIDER',
    bookingAuthority: 'pettrek_bookings',
    paymentAuthority: ['nayax', 'sumit'],
    completionProof: 'PROVIDER_MARK_THEN_CUSTOMER_CONFIRM',
    liveTrackingSupported: true,
    providerRequired: true,
    jobRefLetter: 'D', // "Drive"
  },
  {
    platformCode: 'SHOP',
    serviceTypes: ['product_order'],
    fulfillerKind: 'PETWASH_MERCHANT',
    bookingAuthority: 'shop_orders',
    paymentAuthority: ['sumit', 'wallet'],
    completionProof: 'STAFF_HANDOFF_CODE',
    liveTrackingSupported: false,
    providerRequired: false,
    jobRefLetter: 'S',
  },
  {
    platformCode: 'K9000',
    serviceTypes: ['self_service_wash', 'single_wash'],
    fulfillerKind: 'MACHINE',
    bookingAuthority: 'k9000_redemptions',
    paymentAuthority: ['nayax', 'wallet'],
    completionProof: 'MACHINE_CYCLE_COMPLETE',
    liveTrackingSupported: false,
    providerRequired: false,
    jobRefLetter: 'K',
  },
  {
    platformCode: 'EGIFT',
    serviceTypes: ['egift_purchase', 'egift_redemption'],
    fulfillerKind: 'PETWASH_MERCHANT',
    bookingAuthority: 'egift_orders',
    paymentAuthority: ['sumit', 'wallet'],
    // Purchase itself has no completion event. Redemption uses
    // EGIFT_REDEMPTION — the composer picks the right one based on
    // serviceType.
    completionProof: 'EGIFT_REDEMPTION',
    liveTrackingSupported: false,
    providerRequired: false,
    jobRefLetter: 'G',
  },
  {
    platformCode: 'UNIFIED_REQUEST',
    serviceTypes: ['generic_marketplace'],
    fulfillerKind: 'PROVIDER',
    bookingAuthority: 'booking_requests',
    paymentAuthority: ['nayax', 'sumit', 'wallet'],
    completionProof: 'PROVIDER_MARK_THEN_CUSTOMER_CONFIRM',
    liveTrackingSupported: false,
    providerRequired: true,
    jobRefLetter: 'B',
  },
] as const;

export function getPlatform(code: PlatformCode): PlatformDefinition | null {
  return PLATFORMS.find((p) => p.platformCode === code) ?? null;
}

/**
 * Map a booking-authority table name (e.g. 'sitter_bookings') back to
 * the platform. The composer uses this when it starts from a raw
 * booking row and needs the platform to fill in the rest of the passport.
 */
export function platformFromBookingAuthority(authority: BookingAuthority): PlatformDefinition | null {
  return PLATFORMS.find((p) => p.bookingAuthority === authority) ?? null;
}

/**
 * Read-only stats for admin / support UIs. Never used for authorisation.
 */
export function platformStats() {
  const withProvider = PLATFORMS.filter((p) => p.providerRequired).length;
  const withLive = PLATFORMS.filter((p) => p.liveTrackingSupported).length;
  return {
    total: PLATFORMS.length,
    withProvider,
    withMachine: PLATFORMS.filter((p) => p.fulfillerKind === 'MACHINE').length,
    withMerchant: PLATFORMS.filter((p) => p.fulfillerKind === 'PETWASH_MERCHANT').length,
    withLiveTracking: withLive,
    byCompletionProof: PLATFORMS.reduce<Record<string, number>>((acc, p) => {
      acc[p.completionProof] = (acc[p.completionProof] ?? 0) + 1;
      return acc;
    }, {}),
  };
}
