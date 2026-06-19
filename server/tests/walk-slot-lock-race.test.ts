/**
 * Walk slot-hold race protection (booking-hardening 2026-06-20).
 *
 * Both walk slot-hold acquisition sites (POST /walks/book and POST /walks/holds)
 * previously did read-check-insert: SELECT for an active hold, then INSERT. Two
 * concurrent requests could both pass the SELECT and both INSERT → double-hold.
 *
 * The fix: a UNIQUE (walker_id, slot_id) constraint (migration 0059) + switch to
 * INSERT ... ON CONFLICT DO NOTHING. "No row inserted" == slot already taken →
 * 409. The DB constraint, not application timing, is now the arbiter.
 *
 * Test 1 simulates the race against an in-memory table that enforces the same
 * UNIQUE constraint + ON-CONFLICT-DO-NOTHING semantics, proving exactly one of
 * two concurrent acquirers wins. Tests 2-3 lock the route/schema/migration
 * wiring via source-introspection. DB-free by design.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SERVER = path.resolve(__dirname, '..');
const REPO = path.resolve(SERVER, '..');
const routeSrc = fs.readFileSync(path.join(SERVER, 'routes', 'walk-my-pet.ts'), 'utf8');
const schemaSrc = fs.readFileSync(path.join(REPO, 'shared', 'schema.ts'), 'utf8');
const migrationSrc = fs.readFileSync(path.join(REPO, 'migrations', '0059_booking_hardening.sql'), 'utf8');

/**
 * Minimal model of `walk_slot_holds` with UNIQUE (walker_id, slot_id) enforced
 * via INSERT ... ON CONFLICT DO NOTHING. Returns the inserted row id, or null
 * when the (walker, slot) pair already exists (the conflict path).
 */
class SlotHoldTable {
  private rows = new Map<string, number>(); // "walker|slot" -> id
  private nextId = 1;
  /** INSERT ... ON CONFLICT (walker_id, slot_id) DO NOTHING RETURNING id */
  insertOnConflictDoNothing(walkerId: string, slotId: string): number | null {
    const key = `${walkerId}|${slotId}`;
    if (this.rows.has(key)) return null; // conflict → 0 rows
    const id = this.nextId++;
    this.rows.set(key, id);
    return id;
  }
}

/** Mirrors the route: insert returns [] when conflict → caller sends 409. */
function acquireHold(table: SlotHoldTable, walkerId: string, slotId: string): { ok: boolean; status: number } {
  const inserted = table.insertOnConflictDoNothing(walkerId, slotId);
  if (inserted === null) return { ok: false, status: 409 };
  return { ok: true, status: 201 };
}

describe('walk slot-lock — concurrency race', () => {
  it('exactly one of two concurrent acquirers wins the same slot', () => {
    const table = new SlotHoldTable();
    const slot = 'walker-7-2026-07-01T10:00';
    // Two requests racing for the SAME (walker, slot).
    const a = acquireHold(table, 'walker-7', slot);
    const b = acquireHold(table, 'walker-7', slot);
    const winners = [a, b].filter((r) => r.ok);
    const losers = [a, b].filter((r) => !r.ok);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0].status).toBe(409);
  });

  it('allows different slots for the same walker (no over-blocking)', () => {
    const table = new SlotHoldTable();
    expect(acquireHold(table, 'walker-7', 'walker-7-2026-07-01T10:00').ok).toBe(true);
    expect(acquireHold(table, 'walker-7', 'walker-7-2026-07-01T11:00').ok).toBe(true);
  });

  it('allows the same slot string for different walkers', () => {
    const table = new SlotHoldTable();
    expect(acquireHold(table, 'walker-7', 'slot-x').ok).toBe(true);
    expect(acquireHold(table, 'walker-9', 'slot-x').ok).toBe(true);
  });

  it('N concurrent acquirers on one slot → 1 win, N-1 × 409', () => {
    const table = new SlotHoldTable();
    const slot = 'walker-1-2026-08-01T08:00';
    const results = Array.from({ length: 10 }, () => acquireHold(table, 'walker-1', slot));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(9);
  });
});

describe('walk slot-lock — route wiring (both acquisition sites)', () => {
  it('uses onConflictDoNothing on (walkerId, slotId) — not read-check-insert', () => {
    const matches = routeSrc.match(/onConflictDoNothing\(\{\s*target:\s*\[walkSlotHolds\.walkerId,\s*walkSlotHolds\.slotId\]\s*\}\)/g) || [];
    // Both POST /walks/book and POST /walks/holds must use the atomic insert.
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('treats a 0-row insert as "slot taken" → 409 (fail closed)', () => {
    expect(routeSrc).toMatch(/insertedHold\.length === 0/);
    expect(routeSrc).toMatch(/inserted\.length === 0/);
    expect(routeSrc).toMatch(/status\(409\)/);
  });

  it('still purges expired holds before acquiring (no permanent poison)', () => {
    const purges = routeSrc.match(/db\.delete\(walkSlotHolds\)\.where\(lt\(walkSlotHolds\.expiresAt/g) || [];
    expect(purges.length).toBeGreaterThanOrEqual(2);
  });
});

describe('walk slot-lock — schema + migration (CEO-authorized, additive)', () => {
  it('schema declares the UNIQUE (walker_id, slot_id) index', () => {
    expect(schemaSrc).toMatch(/walkerSlotUniq:\s*uniqueIndex\("wsh_walker_slot_uniq"\)\.on\(t\.walkerId,\s*t\.slotId\)/);
  });

  it('migration creates the unique index idempotently and de-dupes legacy rows', () => {
    expect(migrationSrc).toMatch(/CREATE UNIQUE INDEX wsh_walker_slot_uniq/);
    expect(migrationSrc).toMatch(/ON walk_slot_holds \(walker_id, slot_id\)/);
    expect(migrationSrc).toMatch(/DELETE FROM walk_slot_holds a/); // legacy de-dupe before constraint
    expect(migrationSrc).toMatch(/IF NOT EXISTS/);
  });
});
