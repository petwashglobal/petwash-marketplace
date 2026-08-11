/**
 * Walk endpoints — cross-tenant IDOR via a second Drizzle .where() (2026-08-11).
 *
 * BUG (confirmed live): three ownership-scoped list endpoints built their query as
 *   db.select().from(walkBookings).where(eq(ownerId/walkerId, ...))
 *   if (status) query = query.where(eq(status, ...)) as any
 * Drizzle's .where() SETS config.where (it does not AND) — so the second call
 * OVERWROTE the ownership scope whenever ?status= was present, and the endpoint
 * returned EVERY user's walks (owner PII, addresses, pet details, amounts).
 * Verified empirically: the two-.where() form emitted `WHERE status = $1` with the
 * owner filter gone.
 *
 * FIX: build ONE combined condition with and(ownerScope, statusFilter) and pass it
 * to a single .where(). These pins lock that in.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';

const src = readFileSync(resolve(__dirname, '..', 'routes', 'walk-my-pet.ts'), 'utf8');

describe('walk list endpoints keep their ownership scope when ?status= is set', () => {
  it('the overwriting second-.where() footgun is gone from walk-my-pet.ts', () => {
    expect(src).not.toMatch(/query\s*=\s*query\.where\([^)]*\)\s*as any/);
  });

  it('each list endpoint ANDs the status filter into the ownership scope', () => {
    // ownerId scope (two endpoints) + walkerId scope (one) each combined via and(...eq(status...))
    expect(src).toMatch(/and\(eq\(walkBookings\.ownerId, userId\), eq\(walkBookings\.status/);
    expect(src).toMatch(/and\(eq\(walkBookings\.walkerId, walkerId\), eq\(walkBookings\.status/);
  });

  it('PROOF: a second .where() overwrites (why the bug existed) but and() preserves both', () => {
    const t = pgTable('walk_bookings', { ownerId: text('owner_id'), status: text('status') });
    const db = drizzle({ client: { query: async () => ({ rows: [] }) } as any });

    // The old, buggy shape — the owner scope is DROPPED: only the status param
    // survives, so the WHERE binds a single value and the query is unscoped.
    const buggy = (db.select().from(t).where(eq(t.ownerId, 'USER-A')) as any)
      .where(eq(t.status, 'confirmed')).toSQL();
    expect(buggy.params).toEqual(['confirmed']);              // owner 'USER-A' is gone
    expect(buggy.sql).not.toMatch(/where[\s\S]*owner_id/i);   // no owner_id in the WHERE

    // The fixed shape — BOTH survive: two params, owner_id present in the WHERE.
    const fixed = db.select().from(t)
      .where(and(eq(t.ownerId, 'USER-A'), eq(t.status, 'confirmed'))).toSQL();
    expect(fixed.params).toEqual(['USER-A', 'confirmed']);
    expect(fixed.sql).toMatch(/where[\s\S]*owner_id/i);
  });
});
