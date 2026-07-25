/**
 * Regression pin — Emergency/ASAP walk double-booking (X-ray P1, 2026-07-25).
 *
 * The emergency walk path auto-matched a walker and inserted a 'confirmed' walk
 * with NO slot lock — two concurrent ASAP requests could both grab the same
 * walker. It now acquires the shared slot lock per candidate, keyed on the
 * walker's Firebase userId, and fails over to the next walker on conflict.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '..', 'services', 'EmergencyWalkService.ts'), 'utf8');

describe('emergency walk slot lock (P1)', () => {
  it('acquires a slot lock before inserting the emergency walk', () => {
    const lockAt = src.indexOf('acquireSlotLock(');
    const insertAt = src.indexOf('.insert(walkBookings)');
    expect(lockAt).toBeGreaterThan(-1);
    expect(insertAt).toBeGreaterThan(-1);
    expect(lockAt).toBeLessThan(insertAt);
  });
  it('keys the lock on the walker Firebase userId', () => {
    expect(src).toMatch(/candidate\.walkerUserId\s*\|\|/);
  });
  it('fails over to the next walker on a slot conflict (does not just error)', () => {
    const at = src.indexOf('instanceof BookingSlotConflictError');
    const window = src.slice(at, at + 400);
    expect(at).toBeGreaterThan(-1);
    expect(window).toMatch(/continue/);
  });
  it('releases the lock if the booking fails after locking', () => {
    expect(src).toMatch(/releaseSlotLock\(db,\s*lockedBookingRef\)/);
  });
});
