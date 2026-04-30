import { describe, it } from 'vitest';

/**
 * STUB — to be filled in by Calendar Agent (Batch 3B).
 *
 * Required scenarios (mock googleapis):
 *   1. Provider accept → calendarIntegrationService.createBookingEvent called
 *      with idempotency key derived from bookingId/requestId.
 *   2. Customer cancel → calendarIntegrationService.deleteBookingEvent called.
 *   3. Provider cancel → calendarIntegrationService.deleteBookingEvent called.
 *   4. Calendar create when GOOGLE_SERVICE_ACCOUNT_JSON unset → returns null,
 *      booking still succeeds (no throw).
 *   5. Re-running accept on same booking → does NOT create duplicate event.
 */
describe.skip('google calendar sync', () => {
  it('creates calendar event on provider accept', () => {});
  it('deletes calendar event on customer cancel', () => {});
  it('deletes calendar event on provider cancel', () => {});
  it('fails safely when service account env var is missing', () => {});
  it('is idempotent — re-accept does not duplicate event', () => {});
});
