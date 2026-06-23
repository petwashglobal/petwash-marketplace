/**
 * bookingPii.ts — customer-PII visibility gate for booking-request reads.
 *
 * CEO hard rule: a provider must NEVER see the customer's precise location before
 * they have ACCEPTED the booking. Before acceptance the provider gets only coarse
 * info needed to decide (city/area, dates, pet count, payout); the exact street,
 * apartment, postal code, lat/lng and place id are masked.
 *
 * FAIL-CLOSED: only the explicit post-accept statuses below reveal the full
 * address. Any other / unknown status keeps it masked for the provider. The OWNER
 * always sees their own data unchanged — this gate applies ONLY to the provider's
 * view. Pure function, no I/O, so it is the unit-test seam for the route.
 */

import type { BookingStatus } from './bookingStateMachine';

/**
 * Statuses at or after the provider has committed to the job. Only these reveal
 * the customer's precise location to the provider.
 */
export const PROVIDER_FULL_DETAIL_STATUSES: ReadonlySet<string> = new Set<BookingStatus>([
  'accepted',
  'meet_greet_scheduled',
  'meet_greet_completed',
  'payment_pending',
  'confirmed',
  'in_progress',
  'provider_marked_complete',
  'completed',
  'reviewed',
  'disputed',
]);

/** Precise-location fields frozen onto the booking row at create time. */
const PRECISE_LOCATION_FIELDS = [
  'customerAddress',
  'customerStreet',
  'customerStreetNumber',
  'customerApartment',
  'customerPostalCode',
  'customerLatitude',
  'customerLongitude',
  'customerPlaceId',
] as const;

/**
 * Mask the customer's precise-location fields on a booking row for a provider who
 * has not yet accepted. Coarse fields (city, cityKey, country) are kept so the
 * provider can still judge distance/area before committing. No-op for the owner's
 * own view and no-op once the provider has accepted (post-accept statuses).
 */
export function maskCustomerLocationForProvider<T extends Record<string, any>>(
  booking: T,
  viewerId: string | undefined | null,
): T & { addressMasked?: boolean } {
  const isProviderViewer =
    !!viewerId && booking.providerId === viewerId && booking.ownerId !== viewerId;
  if (!isProviderViewer) return booking;
  if (PROVIDER_FULL_DETAIL_STATUSES.has(String(booking.status))) return booking;

  const masked: Record<string, any> = { ...booking, addressMasked: true };
  for (const field of PRECISE_LOCATION_FIELDS) masked[field] = null;
  return masked as T & { addressMasked?: boolean };
}
