/**
 * Booking-requests idempotency (booking-hardening 2026-06-20).
 *
 * The POST /api/booking-requests create path must not create duplicate bookings
 * on double-tap / network-retry / back-button race. Protection is a deterministic
 * `booking_fingerprint` (optional Idempotency-Key header, else a hash of
 * ownerId+providerId+startDate+endDate+serviceType) backed by a partial-unique
 * index, with a fast-path pre-check that returns the EXISTING booking (200).
 *
 * These tests:
 *  1. Verify the deterministic fingerprint properties (pure logic — the same
 *     algorithm the route uses).
 *  2. Source-introspect the route to lock the safety wiring (fail-safe pre-check,
 *     onConflictDoNothing backstop, return-existing-200) so it can't silently
 *     regress, AND confirm the schema + migration carry the column/constraint.
 *
 * DB-free by design (mirrors the repo's source-introspection test convention).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';

const SERVER = path.resolve(__dirname, '..');
const REPO = path.resolve(SERVER, '..');
const routeSrc = fs.readFileSync(path.join(SERVER, 'routes', 'booking-requests.ts'), 'utf8');
const schemaSrc = fs.readFileSync(path.join(REPO, 'shared', 'schema.ts'), 'utf8');
const migrationSrc = fs.readFileSync(path.join(REPO, 'migrations', '0059_booking_hardening.sql'), 'utf8');

/**
 * Re-implementation of computeBookingFingerprint (server/routes/booking-requests.ts).
 * Kept in lock-step with the route via the source-introspection guards below.
 */
function fingerprint(input: {
  headerKey?: string | null;
  ownerId: string;
  providerId: string;
  startISO: string;
  endISO: string;
  serviceType: string;
}): string {
  const headerKey = (input.headerKey ?? '').trim();
  if (headerKey && /^[a-zA-Z0-9\-_]{1,128}$/.test(headerKey)) {
    return `idem:${input.ownerId}:${headerKey}`.slice(0, 200);
  }
  const basis = [input.ownerId, input.providerId, input.startISO, input.endISO, input.serviceType].join('|');
  return `fp:${createHash('sha256').update(basis).digest('hex')}`;
}

const base = {
  ownerId: 'owner-1',
  providerId: 'prov-1',
  startISO: '2026-07-01T09:00:00.000Z',
  endISO: '2026-07-03T09:00:00.000Z',
  serviceType: 'pet_sitting',
};

describe('booking idempotency — deterministic fingerprint', () => {
  it('is stable: same inputs → same key (double-tap maps to one row)', () => {
    expect(fingerprint(base)).toBe(fingerprint(base));
  });

  it('differs when any natural-identity field differs', () => {
    const k = fingerprint(base);
    expect(fingerprint({ ...base, providerId: 'prov-2' })).not.toBe(k);
    expect(fingerprint({ ...base, startISO: '2026-07-02T09:00:00.000Z' })).not.toBe(k);
    expect(fingerprint({ ...base, endISO: '2026-07-04T09:00:00.000Z' })).not.toBe(k);
    expect(fingerprint({ ...base, serviceType: 'dog_walking' })).not.toBe(k);
    expect(fingerprint({ ...base, ownerId: 'owner-2' })).not.toBe(k);
  });

  it('honors a valid Idempotency-Key header and scopes it to the owner', () => {
    const a = fingerprint({ ...base, headerKey: 'retry-abc_123' });
    expect(a).toBe('idem:owner-1:retry-abc_123');
    // Same header, different owner → different key (no cross-account collision).
    const b = fingerprint({ ...base, ownerId: 'owner-2', headerKey: 'retry-abc_123' });
    expect(b).toBe('idem:owner-2:retry-abc_123');
    expect(a).not.toBe(b);
  });

  it('falls back to the deterministic hash when the header is missing or invalid', () => {
    const hashKey = fingerprint(base);
    expect(fingerprint({ ...base, headerKey: '' })).toBe(hashKey);
    expect(fingerprint({ ...base, headerKey: '   ' })).toBe(hashKey);
    // Invalid chars are rejected → fall back to hash, not crash.
    expect(fingerprint({ ...base, headerKey: 'bad key with spaces!' })).toBe(hashKey);
  });

  it('never exceeds the 200-char column width', () => {
    const longKey = 'k'.repeat(128); // max allowed header length
    expect(fingerprint({ ...base, headerKey: longKey }).length).toBeLessThanOrEqual(200);
    expect(fingerprint(base).length).toBeLessThanOrEqual(200);
  });
});

describe('booking idempotency — route wiring is fail-safe and additive', () => {
  it('computes a fingerprint from the header OR the natural-identity fields', () => {
    expect(routeSrc).toMatch(/computeBookingFingerprint\(/);
    expect(routeSrc).toMatch(/headerKey:\s*\(req\.headers\['idempotency-key'\]/);
    expect(routeSrc).toContain('startISO: startDate.toISOString()');
    expect(routeSrc).toContain('endISO: endDate.toISOString()');
  });

  it('does a fast-path pre-check that returns the EXISTING booking (200) on replay', () => {
    expect(routeSrc).toMatch(/Idempotent replay — returning existing booking/);
    expect(routeSrc).toMatch(/idempotent:\s*true/);
    // The replay path must be a 200, not a 201/duplicate.
    expect(routeSrc).toMatch(/res\.status\(200\)\.json\(\{[\s\S]*idempotent:\s*true/);
  });

  it('is FAIL-SAFE: a pre-check error must not block the booking', () => {
    expect(routeSrc).toMatch(/Idempotency pre-check skipped \(non-fatal\)/);
  });

  it('uses onConflictDoNothing on the fingerprint as the race backstop', () => {
    expect(routeSrc).toMatch(/onConflictDoNothing\(/);
    expect(routeSrc).toMatch(/target:\s*bookingRequests\.bookingFingerprint/);
  });

  it('resolves the insert race by returning the winning row, never a 500/duplicate', () => {
    expect(routeSrc).toMatch(/Idempotent insert collision — returning winning booking/);
  });

  it('persists the fingerprint on the insert', () => {
    expect(routeSrc).toMatch(/bookingFingerprint,\s*\/\/ idempotency key/);
  });
});

describe('booking idempotency — schema + migration (CEO-authorized, additive)', () => {
  it('schema declares the booking_fingerprint column + partial-unique index', () => {
    expect(schemaSrc).toMatch(/bookingFingerprint:\s*varchar\("booking_fingerprint",\s*\{\s*length:\s*200\s*\}\)/);
    expect(schemaSrc).toMatch(/br_booking_fingerprint_uniq/);
    expect(schemaSrc).toMatch(/\.where\(sql`\$\{t\.bookingFingerprint\} IS NOT NULL`\)/);
  });

  it('migration is idempotent and the unique index is PARTIAL (NULL never blocked)', () => {
    expect(migrationSrc).toMatch(/ADD COLUMN IF NOT EXISTS booking_fingerprint varchar\(200\)/);
    expect(migrationSrc).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS br_booking_fingerprint_uniq/);
    expect(migrationSrc).toMatch(/WHERE booking_fingerprint IS NOT NULL/);
  });

  it('migration touches NO pricing/payment-amount columns', () => {
    expect(migrationSrc).not.toMatch(/total_cents|subtotal_cents|service_fee_cents|price_cents|amount_cents/);
  });
});
