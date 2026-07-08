/**
 * Double-payout DB uniqueness guards — regression pins (2026-07-08).
 *
 * Completes the double-payout fix. #1334 leader-elected the payout crons (stops
 * the multi-replica double-fire). These DB unique indexes close the remaining
 * cross-path race — cron vs Nayax webhook vs confirm-completion route all call
 * the lockless SELECT-then-INSERT createEarningRecord / findFirst-then-insert
 * settlement path. With the constraint, a racing duplicate insert fails
 * (23505 / fail-closed) instead of double-creating.
 *
 * A prod duplicate-scan (read-only) confirmed BOTH tables were empty (0 rows,
 * 0 duplicate groups) before adding — so no provider was ever double-paid, and
 * the CREATE UNIQUE INDEX cannot fail on pre-existing dupes.
 *
 * Source-level pins on the canonical schema (synced to prod via drizzle-kit push).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SCHEMA = fs.readFileSync(path.resolve(__dirname, '..', '..', 'shared', 'schema.ts'), 'utf8');

describe('double-payout DB uniqueness guards (2026-07-08)', () => {
  it('contractor_earnings is unique per (booking_id, contractor_type)', () => {
    expect(SCHEMA).toMatch(
      /uniqueIndex\("uniq_contractor_earnings_booking_type"\)\.on\(table\.bookingId,\s*table\.contractorType\)/,
    );
  });

  it('settlements is unique per (partner_id, period_start, period_end)', () => {
    expect(SCHEMA).toMatch(
      /uniqueIndex\("uniq_settlements_partner_period"\)\.on\(table\.partnerId,\s*table\.periodStart,\s*table\.periodEnd\)/,
    );
  });
});
