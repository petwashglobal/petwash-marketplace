/**
 * Provider-earnings bucket logic pins — CEO 2026-08-26 correction
 * pass #2 §17-18.
 *
 * The composer queries booking_requests + contractor_earnings and
 * classifies each row into ONE bucket: expected / pending /
 * available / paid. These tests read the composer source and pin
 * the invariants that a future refactor cannot break silently:
 *
 * §17  — cents fall back to (subtotal - serviceFee) when
 *        provider_payout_cents is NULL (native marketplace bookings
 *        never populate it — the audit finding).
 * §17  — contractor_earnings.payout_status wins over
 *        booking_requests.payout_status. The mirror stays 'pending'
 *        forever today; the CE row is the honest evidence.
 * §18  — 'paid' requires payout_status='paid_out'. It is NEVER
 *        inferred from status='completed' or from a timestamp.
 * §18  — a failed payout does not become 'paid'. The composer only
 *        upgrades to 'paid' on an explicit 'paid_out'; 'failed' /
 *        'processing' / anything else stays in the current bucket.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'providerEarnings.ts'),
  'utf8',
);

describe('providerEarnings — bucket logic invariants (§17-18)', () => {
  it('cents fall back to (subtotal - serviceFee) when column is NULL', () => {
    // The SQL COALESCE(provider_payout_cents, GREATEST(0, subtotal - serviceFee))
    // handles the native-marketplace bug.
    expect(SRC).toMatch(/COALESCE\(\s*br\.provider_payout_cents/);
    expect(SRC).toMatch(/GREATEST\(0,\s*COALESCE\(br\.subtotal_cents,\s*0\)\s*-\s*COALESCE\(br\.service_fee_cents,\s*0\)\)/);
  });

  it('contractor_earnings.payout_status wins over the mirror row', () => {
    // effectivePayoutStatus = CE row when present, else mirror.
    expect(SRC).toMatch(/const\s+effectivePayoutStatus\s*=\s*ceStatus\s*\?\?\s*mirrorStatus/);
  });

  it("'paid' bucket requires payout_status = 'paid_out' explicitly", () => {
    // The bucketFor branch: paid iff effectivePayoutStatus === 'paid_out'.
    // A future refactor that adds an OR (paid_at != null) or an OR
    // (status='completed') is banned.
    expect(SRC).toMatch(/effectivePayoutStatus\s*===\s*'paid_out'\)\s*return\s*'paid'/);
    // No shortcut: no direct check on ce_paid_out_at OR status alone
    // to reach the 'paid' bucket.
    expect(SRC).not.toMatch(/status[^)]*===\s*'completed'.*return\s*'paid'/);
  });

  it("'available' bucket requires payout_status = 'released'", () => {
    expect(SRC).toMatch(/effectivePayoutStatus\s*===\s*'released'\)\s*return\s*'available'/);
  });

  it("'failed' / 'processing' payouts do NOT become 'paid' or 'available'", () => {
    // No branch that treats 'failed' or 'processing' as anything but
    // the default pending path.
    expect(SRC).not.toMatch(/effectivePayoutStatus.*['"]failed['"].*return\s*'paid'/);
    expect(SRC).not.toMatch(/effectivePayoutStatus.*['"]processing['"].*return\s*'available'/);
  });

  it('composer never mutates rows — read-only', () => {
    // 2026-09-18: this matched the bare word case-insensitively, so the column
    // `updated_at` inside a SELECT read as an UPDATE statement and the pin
    // failed a read-only file for being read-only. Match a write STATEMENT —
    // the verb followed by what a write actually needs next.
    const WRITE_STATEMENTS = [
      /\bINSERT\s+INTO\b/i,
      /\bUPDATE\s+[a-z_."]+\s+SET\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bTRUNCATE\s+(TABLE\s+)?[a-z_."]+/i,
      /\bALTER\s+TABLE\b/i,
      /\bDROP\s+TABLE\b/i,
    ];
    for (const re of WRITE_STATEMENTS) expect(SRC).not.toMatch(re);
    // And no Drizzle writer, which raw-SQL greps would never have caught.
    expect(SRC).not.toMatch(/\bdb\s*\.\s*(insert|update|delete)\s*\(/);
  });

  it('paid-out timestamp preference order: CE.paid_out_at → payout_date → service_completed_at', () => {
    // Composer's timestampFor for the 'paid' bucket.
    expect(SRC).toMatch(/if\s*\(bucket\s*===\s*'paid'\)\s*return\s+row\.ce_paid_out_at\s*\?\?\s*row\.payout_date\s*\?\?\s*row\.service_completed_at/);
  });
});
