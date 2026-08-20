import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Regression pins for the 7 recurring runtime errors that Cloud Logging saw
// on revision petwash-api-04188-vil (2026-08-20). One assertion per error —
// each one references either the migration filename, the corrected schema
// column, or the Firestore-index entry. A future refactor that undoes any
// individual fix fails PR CI.

const ROOT              = join(__dirname, '..', '..');
const MIGRATION_PATH    = join(ROOT, 'migrations', '0119_prod_runtime_errors_2026_08_20.sql');
const MIGRATION         = readFileSync(MIGRATION_PATH, 'utf8');
const BOOKING_EXPIRY    = readFileSync(join(ROOT, 'server', 'jobs', 'booking-expiry.ts'), 'utf8');
const WALLET_RECONCILE  = readFileSync(join(ROOT, 'server', 'jobs', 'wallet-reconciliation.ts'), 'utf8');
const SCHEMA            = readFileSync(join(ROOT, 'shared', 'schema.ts'), 'utf8');
const FIRESTORE_INDEXES = JSON.parse(
  readFileSync(join(ROOT, 'firestore.indexes.json'), 'utf8'),
) as { indexes: Array<{ collectionGroup: string; fields: Array<{ fieldPath: string; order?: string }> }> };

const fieldOrders = (collection: string) =>
  FIRESTORE_INDEXES.indexes
    .filter((i) => i.collectionGroup === collection)
    .map((i) => i.fields.map((f) => `${f.fieldPath}:${f.order ?? 'ARRAY'}`).join('+'));

describe('Prod runtime errors 2026-08-20 — regression pins', () => {
  // ─── #1 MonitoringWatchdog — provider_workflow_events table missing ────────
  it('#1 migration 0119 creates provider_workflow_events table', () => {
    expect(MIGRATION).toMatch(/CREATE TABLE IF NOT EXISTS provider_workflow_events/);
    expect(MIGRATION).toMatch(/application_id\s+integer/);
    expect(MIGRATION).toMatch(/event_name\s+varchar/);
    expect(MIGRATION).toMatch(/severity\s+varchar/);
    expect(MIGRATION).toMatch(/payload\s+jsonb/);
  });

  // ─── #2 BookingExpiry — trainer_bookings column is booking_status ──────────
  it('#2 booking-expiry no longer queries trainer_bookings.status (uses booking_status)', () => {
    // Fenced to the "Unified stuck scan" area, but a global assertion is
    // safer against future refactors — every trainer_bookings WHERE clause
    // in this file must reference booking_status, never bare `status`.
    const trainerBlocks = BOOKING_EXPIRY.match(/FROM\s+trainer_bookings[\s\S]*?LIMIT/gi) ?? [];
    expect(trainerBlocks.length).toBeGreaterThan(0);
    for (const block of trainerBlocks) {
      expect(block).toMatch(/booking_status/);
      // `AND status IN` or `WHERE status IN` (loose) — must NOT appear
      expect(block).not.toMatch(/\b(?:AND|WHERE)\s+status\s+IN\b/i);
    }
  });

  // ─── #3 WalletReconciliation — stuck_hold_alert_sent_at column missing ─────
  it('#3 migration 0119 adds stuck_hold_alert_sent_at to booking_requests + trainer_bookings', () => {
    expect(MIGRATION).toMatch(
      /ALTER TABLE booking_requests[\s\S]*?ADD COLUMN IF NOT EXISTS stuck_hold_alert_sent_at\s+timestamp/,
    );
    expect(MIGRATION).toMatch(
      /ALTER TABLE trainer_bookings[\s\S]*?ADD COLUMN IF NOT EXISTS stuck_hold_alert_sent_at\s+timestamp/,
    );
    // Schema mirrors migration so drizzle-kit push sees no diff.
    expect(SCHEMA).toMatch(/stuckHoldAlertSentAt:\s*timestamp\("stuck_hold_alert_sent_at"\)/);
    // The reader still selects the column — the fix is the column, not the query.
    expect(WALLET_RECONCILE).toMatch(/stuck_hold_alert_sent_at/);
  });

  // ─── #4 KYC2026 RateLimit — kyc_rate_limits table missing ──────────────────
  it('#4 migration 0119 creates kyc_rate_limits with window_end + composite PK', () => {
    expect(MIGRATION).toMatch(/CREATE TABLE IF NOT EXISTS kyc_rate_limits/);
    expect(MIGRATION).toMatch(/window_start\s+timestamp/);
    expect(MIGRATION).toMatch(/window_end\s+timestamp/);
    // ON CONFLICT (bucket_name, rate_key, window_start) — matches KYCRateLimiter upsert
    expect(MIGRATION).toMatch(/PRIMARY KEY\s*\(\s*bucket_name,\s*rate_key,\s*window_start\s*\)/);
    // Cleanup DELETE FROM ... WHERE window_end < ... needs a supporting index.
    expect(MIGRATION).toMatch(/CREATE INDEX IF NOT EXISTS[\s\S]*?ON kyc_rate_limits \(window_end\)/);
  });

  // ─── #5 Firestore composite for escrow_payments (status + holdUntil) ──────
  it('#5 firestore.indexes.json declares escrow_payments composite (status + holdUntil)', () => {
    const orders = fieldOrders('escrow_payments');
    expect(orders).toContain('status:ASCENDING+holdUntil:ASCENDING');
  });

  // ─── #6 Firestore composite for wallet_telemetry (status + createdAt) ─────
  it('#6 firestore.indexes.json declares wallet_telemetry composite (status + createdAt)', () => {
    const orders = fieldOrders('wallet_telemetry');
    // The abandonment query uses .where('createdAt','<',_).where('status','in',_)
    // → equality on status, then range on createdAt → composite must lead with status.
    expect(orders).toEqual(
      expect.arrayContaining([expect.stringMatching(/^status:ASCENDING\+createdAt:ASCENDING/)]),
    );
  });

  // ─── #7 Firestore composite for station_alerts uptime calculation ─────────
  it('#7 firestore.indexes.json declares station_alerts composite (stationId + type + createdAt)', () => {
    const orders = fieldOrders('station_alerts');
    expect(orders).toContain('stationId:ASCENDING+type:ASCENDING+createdAt:ASCENDING');
  });
});
