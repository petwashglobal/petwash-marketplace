import { describe, it } from 'vitest';

/**
 * STUB — to be filled in by Booking Agent (Batch 3A).
 *
 * Required scenarios:
 *   1. Customer creates booking → status='pending'.
 *   2. Same provider/slot booked twice → second 409.
 *   3. Cross-store double-book: bookings.ts (Firestore-canonical) and
 *      booking_requests (Postgres) for same provider/time → conflict.
 *   4. Provider accept with backgroundCheckStatus !== 'approved' → 403.
 *   5. Provider accept with backgroundCheckStatus === 'approved' → 200.
 *   6. Pending request older than 24h → auto-decline + wallet hold released.
 *   7. Cancel by customer → status='cancelled' + escrow refund triggered.
 *   8. Reviewer must have a 'completed' booking before review write.
 */
describe.skip('booking lifecycle', () => {
  it('creates pending booking', () => {});
  it('rejects double-book on same slot', () => {});
  it('rejects cross-store double-book', () => {});
  it('blocks provider accept without approved BGC', () => {});
  it('allows provider accept with approved BGC', () => {});
  it('auto-declines stale pending requests after 24h', () => {});
  it('cancels and refunds', () => {});
  it('blocks review without completed booking', () => {});
});
