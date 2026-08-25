/**
 * Regression pin — P0-1 / P0-2 double-booking guards (X-ray 2026-07-25).
 *
 * Pet Sitter had a check-then-insert race (no lock); Academy had NO availability
 * check at all. Both now acquire an atomic, DB-enforced slot lock
 * (marketplace_booking_slot_locks, EXCLUDE constraint) before the booking insert,
 * keyed on the provider's canonical userId so the guard also spans platforms.
 * These source pins assert the guard is present and wired to release on the
 * failure/decline paths so a failed booking never blocks the calendar forever.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', 'routes', p), 'utf8');
const academy = read('academy.ts');
const sitter = read('sitter-suite.ts');
const walk = read('walk-my-pet.ts');

describe('Academy double-booking guard (P0-2)', () => {
  it('acquires a slot lock before creating the trainer booking', () => {
    // Matches both the legacy `acquireSlotLock(db, {` and the newer, correct
    // `acquireSlotLock(tx, {` used inside a db.transaction((tx) => …) block
    // (see PR #2147 — lock + insert now share a tx so a failed insert
    // rolls back the lock instead of leaving a ghost row on the calendar).
    expect(academy).toMatch(/acquireSlotLock\(\w+,\s*\{/);
    const lockAt = academy.indexOf('acquireSlotLock(');
    const insertAt = academy.indexOf('.insert(trainerBookings)');
    expect(lockAt).toBeGreaterThan(-1);
    expect(insertAt).toBeGreaterThan(-1);
    expect(lockAt).toBeLessThan(insertAt);
  });
  it('returns 409 SLOT_TAKEN on conflict', () => {
    expect(academy).toMatch(/BookingSlotConflictError/);
    expect(academy).toMatch(/SLOT_TAKEN/);
  });
  it('releases the lock on cancel', () => {
    expect(academy).toMatch(/releaseSlotLock\(db,\s*bookingId\)/);
  });
});

describe('Pet Sitter double-booking guard (P0-1)', () => {
  it('acquires a slot lock before creating the sitter booking', () => {
    expect(sitter).toMatch(/acquireSlotLock\(db,\s*\{/);
    const lockAt = sitter.indexOf('acquireSlotLock(');
    const insertAt = sitter.indexOf('.insert(sitterBookings)');
    expect(lockAt).toBeGreaterThan(-1);
    expect(insertAt).toBeGreaterThan(-1);
    expect(lockAt).toBeLessThan(insertAt);
  });
  it('returns 409 SLOT_TAKEN on conflict', () => {
    expect(sitter).toMatch(/BookingSlotConflictError/);
    expect(sitter).toMatch(/SLOT_TAKEN/);
  });
  it('releases the lock when the provider declines', () => {
    expect(sitter).toMatch(/releaseSlotLock\(db,\s*bookingId\)/);
  });
  it('keys the lock on the sitter Firebase userId (cross-platform clash safety)', () => {
    expect(sitter).toMatch(/sitter\.userId\s*\|\|/);
  });
});

describe('Walk My Pet persistent double-booking guard (P1)', () => {
  it('acquires a persistent slot lock before creating the walk booking', () => {
    expect(walk).toMatch(/acquireSlotLock\(db,\s*\{/);
    const lockAt = walk.indexOf('acquireSlotLock(');
    const insertAt = walk.indexOf('.insert(walkBookings)');
    expect(lockAt).toBeGreaterThan(-1);
    expect(insertAt).toBeGreaterThan(-1);
    expect(lockAt).toBeLessThan(insertAt);
  });
  it('returns 409 SLOT_TAKEN on conflict', () => {
    expect(walk).toMatch(/BookingSlotConflictError/);
    expect(walk).toMatch(/SLOT_TAKEN/);
  });
  it('keys the lock on the walker Firebase userId, not the WALKER-UUID', () => {
    expect(walk).toMatch(/walkerProfile\.userId\s*\|\|/);
  });
  it('releases the lock on decline', () => {
    expect(walk).toMatch(/releaseSlotLock\(db,\s*bookingId\)/);
  });
});

// PR #2147 — the lock and the booking insert must live in one transaction
// so a failed insert rolls the lock back. Pin the pattern so no future
// edit regresses to `acquireSlotLock(db, …)` + separate `db.insert(…)`
// which silently leaked ghost locks onto provider calendars.
describe('Slot lock + insert share a transaction (PR #2147)', () => {
  it('sitter wraps acquireSlotLock + insert in db.transaction((tx) => …)', () => {
    expect(sitter).toMatch(/db\.transaction\s*\(\s*async\s*\(\s*tx\s*\)/);
    expect(sitter).toMatch(/acquireSlotLock\(\s*tx\s*,/);
  });
  it('walk wraps acquireSlotLock + insert in db.transaction((tx) => …)', () => {
    expect(walk).toMatch(/db\.transaction\s*\(\s*async\s*\(\s*tx\s*\)/);
    expect(walk).toMatch(/acquireSlotLock\(\s*tx\s*,/);
  });
  it('academy wraps acquireSlotLock + insert in db.transaction((tx) => …)', () => {
    expect(academy).toMatch(/db\.transaction\s*\(\s*async\s*\(\s*tx\s*\)/);
    expect(academy).toMatch(/acquireSlotLock\(\s*tx\s*,/);
  });
});
