/**
 * Marketplace slot-lock must be RELEASED on every terminal transition.
 *
 * acquireSlotLock inserts a Postgres EXCLUDE-constraint row at booking-request
 * creation (at 'pending', before payment). releaseSlotLock() existed but had
 * ZERO callers, so cancel / decline / provider-emergency-cancel / auto-decline
 * left the lock row forever — permanently poisoning the provider's calendar
 * (a free DoS: lock a competitor's slots, then cancel). Money lost = every
 * blocked legitimate booking.
 *
 * Fix: call releaseSlotLock(db, requestId) on each terminal transition.
 * Source-introspection so a regression (dropping a release) fails CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SERVER = path.resolve(__dirname, '..');
const bookingReq = fs.readFileSync(path.join(SERVER, 'routes', 'booking-requests.ts'), 'utf8');
const timeoutJob = fs.readFileSync(path.join(SERVER, 'jobs', 'booking-accept-timeout.ts'), 'utf8');

describe('booking-requests.ts — releases slot-lock on terminal transitions', () => {
  it('imports releaseSlotLock', () => {
    expect(bookingReq).toMatch(/import\s*\{[^}]*releaseSlotLock[^}]*\}\s*from\s*['"]\.\.\/lib\/marketplaceSlotLock['"]/);
  });
  it('releases on decline, cancel, and emergency-cancel', () => {
    expect(bookingReq).toMatch(/release failed \(decline\)/);
    expect(bookingReq).toMatch(/release failed \(cancel\)/);
    expect(bookingReq).toMatch(/release failed \(emergency-cancel\)/);
  });
  it('calls releaseSlotLock(db, requestId) at least 3 times', () => {
    const calls = (bookingReq.match(/releaseSlotLock\(db, requestId\)/g) || []).length;
    expect(calls).toBeGreaterThanOrEqual(3);
  });
});

describe('booking-accept-timeout.ts — releases slot-lock on auto-decline', () => {
  it('imports and calls releaseSlotLock for the auto-declined request', () => {
    expect(timeoutJob).toMatch(/import\s*\{\s*releaseSlotLock\s*\}\s*from\s*['"]\.\.\/lib\/marketplaceSlotLock['"]/);
    expect(timeoutJob).toMatch(/releaseSlotLock\(db, booking\.requestId\)/);
  });
});
