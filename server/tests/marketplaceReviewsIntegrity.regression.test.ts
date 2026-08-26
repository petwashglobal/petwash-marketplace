/**
 * marketplace-reviews.ts trust-integrity rule pins (CEO §36).
 *
 * The submit-review handler has FOUR trust-integrity rules that
 * together prevent fake reviews. This file pins them structurally so
 * a future refactor cannot silently drop any one of them:
 *
 *   Rule 1 — reviewer MUST be the booking owner (booking.userId === uid).
 *   Rule 2 — provider CANNOT review their own booking (booking.providerId === uid).
 *   Rule 3 — only 'completed' or 'reviewed' bookings qualify.
 *   Rule 4 — one review per (bookingId, customerId) enforced via
 *            pg_advisory_xact_lock inside a transaction (there is no
 *            DB UNIQUE constraint to catch a race).
 *
 * KNOWN CAVEAT (documented, not pinned): booking.providerId on the
 * `bookings` table is a varchar and different pipelines write
 * different id namespaces there — walk-my-pet writes walker.walkerId
 * (WALKER-UUID) while unified booking_requests write Firebase uid.
 * Rule 2 assumes providerId is a Firebase uid; a pipeline that writes
 * a profile UUID there would let its own operator submit a review by
 * bypassing the equality check. §36 flagged this — a dedicated
 * remediation PR should either normalise providerId to Firebase uid
 * at write time OR resolve to uid before Rule 2 checks.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'marketplace-reviews.ts'),
  'utf8',
);

describe('marketplace-reviews submit handler — §36 trust integrity', () => {
  it('Rule 1: reviewer must be the booking owner (booking.userId === uid)', () => {
    // The check must be literal equality on the resolved server uid,
    // NOT a body-supplied userId.
    expect(SRC).toMatch(/booking\.userId\s*!==\s*uid/);
    expect(SRC).toMatch(/You can only review your own bookings/);
  });

  it('Rule 2: provider cannot review their own booking (booking.providerId === uid)', () => {
    expect(SRC).toMatch(/booking\.providerId\s*&&\s*booking\.providerId\s*===\s*uid/);
    expect(SRC).toMatch(/Providers cannot review their own bookings/);
  });

  it('Rule 3: only completed/reviewed bookings qualify', () => {
    expect(SRC).toMatch(/\[['"]completed['"]\s*,\s*['"]reviewed['"]\]\.includes\(booking\.status\)/);
    expect(SRC).toMatch(/Review available only after the service is completed/);
  });

  it('Rule 4: one review per (bookingId, customerId) enforced by pg_advisory_xact_lock', () => {
    // No DB UNIQUE on (bookingId, customerId), so the transaction lock
    // is the only serialisation. A refactor that removed the lock or
    // moved it outside the transaction would open the double-submit
    // hole.
    expect(SRC).toMatch(/db\.transaction/);
    expect(SRC).toMatch(/pg_advisory_xact_lock/);
    // The lock key is derived from (bookingId, uid), NOT from the
    // client body — a client-supplied key would let two different
    // customers claim to review the same booking concurrently.
    expect(SRC).toMatch(/marketplaceReviewLockKey\(bookingId,\s*uid\)/);
  });

  it('Rule 4 helper: re-check inside the lock (loser sees winner\'s row)', () => {
    // Inside the transaction, the handler MUST re-select the existing
    // review after taking the lock. Without the re-check, both racers
    // would still INSERT before releasing the lock.
    const txBlock = SRC.slice(SRC.indexOf('db.transaction'), SRC.indexOf('db.transaction') + 2000);
    expect(txBlock).toMatch(/tx\.select/);
    expect(txBlock).toMatch(/marketplaceReviews\.bookingId,\s*bookingId/);
    expect(txBlock).toMatch(/marketplaceReviews\.customerId,\s*uid/);
  });

  it('uid is server-derived via requireAuth (never req.body.userId)', () => {
    // A trust-critical check that keys off uid must never accept a
    // client-supplied uid. The handler calls requireAuth(req, res),
    // which returns the Firebase-verified uid. The assignment must
    // land BEFORE the trust rules fire.
    const authIdx = SRC.indexOf('const uid = await requireAuth(req, res)');
    const rule1Idx = SRC.indexOf('booking.userId !== uid');
    expect(authIdx).toBeGreaterThan(-1);
    expect(rule1Idx).toBeGreaterThan(-1);
    expect(authIdx).toBeLessThan(rule1Idx);
    // Ban a body-derived uid in the same handler window (defence
    // against a copy-paste that reads req.body.userId elsewhere in
    // the trust checks).
    const handlerBlock = SRC.slice(authIdx, rule1Idx + 200);
    expect(handlerBlock).not.toMatch(/uid\s*=\s*req\.body\.userId/);
  });
});
