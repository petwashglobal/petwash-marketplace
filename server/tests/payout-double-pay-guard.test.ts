/**
 * Provider payout must be idempotent per (bookingId, contractorType).
 * contractor_earnings.booking_id has NO DB unique constraint, so a Nayax
 * webhook replay / admin retry / double-complete could insert a second
 * earning row and pay the provider TWICE. createEarningRecord() must
 * detect an existing earning and return it instead of inserting again.
 * Source-introspection guard (no DB needed in CI).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'payoutLedger.ts'),
  'utf8',
);

describe('payout double-pay guard', () => {
  it('createEarningRecord checks for an existing earning before inserting', () => {
    // the guard must run BEFORE the insert
    const guardIdx = src.indexOf('Earning already exists for booking');
    const insertIdx = src.indexOf('.insert(contractorEarnings)');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(insertIdx);
  });

  it('the guard keys on both bookingId and contractorType', () => {
    expect(src).toMatch(/eq\(contractorEarnings\.bookingId, bookingId\)/);
    expect(src).toMatch(/eq\(contractorEarnings\.contractorType, contractorType\)/);
  });
});
