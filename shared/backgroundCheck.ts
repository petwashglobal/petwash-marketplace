/**
 * Background-check status — ONE reading for the whole platform.
 *
 * The column is documented as `pending | passed | failed | waived`
 * (shared/schema.ts) and every approval path writes 'passed'
 * (provider-onboarding admin approve, provider-applications approve,
 * providerProfileSeed). But six readers compared against 'approved', a value
 * nothing writes — so no approved provider could accept a booking
 * (booking-requests + provider-dashboard-v2 respond), the payment deal gate
 * could never see an approved provider, and no one got the "background
 * checked" badge (2026-09-17). 'approved' stays accepted as a legacy spelling.
 */
export type BackgroundCheckStatus = 'pending' | 'passed' | 'failed' | 'waived' | 'approved';

/** Statuses that mean a check actually ran and cleared — the only ones that earn a badge. */
export const BACKGROUND_CHECK_PASSED: readonly string[] = ['passed', 'approved'];

/**
 * Statuses that let a provider take paid work: a cleared check, or an admin's
 * explicit waiver — the same set the admin approval itself requires
 * (provider-onboarding.ts `backgroundOk = ['passed','waived']`).
 */
export const BACKGROUND_CHECK_CLEARS_BOOKING: readonly string[] = ['passed', 'approved', 'waived'];

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

/** A check ran and cleared. Use for badges, trust scores and "police check" filters. */
export function backgroundCheckPassed(status: unknown): boolean {
  return BACKGROUND_CHECK_PASSED.includes(norm(status));
}

/** The provider may accept paid bookings (passed, or waived by an admin). */
export function backgroundCheckClearsBooking(status: unknown): boolean {
  return BACKGROUND_CHECK_CLEARS_BOOKING.includes(norm(status));
}
