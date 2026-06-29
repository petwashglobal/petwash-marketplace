/**
 * Four HIGH-severity holes from the 2026-06-29 deep audit, closed:
 *  A) fraud isEmailVerified fails CLOSED on error
 *  B) /api/currency/virtual-account no longer serves fake bank/SWIFT details
 *  C) x-admin-booking geofence bypass requires a VERIFIED admin (not a spoofable header)
 *  D) /reprice enforces auth + ownership (no IDOR)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const R = (p) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const fraud = R('middleware/fraudDetection.ts');
const fx = R('routes/multi-currency.ts');
const br = R('routes/booking-requests.ts');

describe('HIGH security holes closed', () => {
  it('A: fraud email-verified fails closed', () => {
    expect(fraud).toMatch(/FAIL CLOSED[^]*return false/);
    expect(fraud).not.toMatch(/return true; \/\/ Assume verified on error/);
  });
  it('B: virtual-account returns 503, never fake bank details', () => {
    expect(fx).toMatch(/VIRTUAL_ACCOUNTS_DISABLED/);
    expect(fx).toMatch(/return res\.status\(503\)/);
    expect(fx).not.toMatch(/const account = getVirtualBankAccount\(userId, currency\);\s*\n\s*res\.json\(account\)/);
  });
  it('C: admin geofence bypass requires verified admin', () => {
    expect(br).toMatch(/x-admin-booking[^]*isSuperAdminVerified\(req as any\)/);
  });
  it('D: reprice enforces ownership', () => {
    expect(br).toMatch(/br\.ownerId !== userId && !isSuperAdminVerified\(req as any\)/);
    expect(br).toMatch(/Not authorized to reprice this booking/);
  });
});
