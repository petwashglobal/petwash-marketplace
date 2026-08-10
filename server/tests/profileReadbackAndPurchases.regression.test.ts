/**
 * Profile read-back + My-Purchases (CEO 2026-08-10 "yes take both"):
 *  · PATCH /api/user/profile SAVED gender / car plates / emergency contact /
 *    marketingConsent / twoFactorEnabled, but GET /profile did NOT return them —
 *    so the edit form (hydrated from that GET) rendered them blank after a reload
 *    and the user thought their save was lost. The data persisted fine; the
 *    read-back just omitted the fields. This pins them back in.
 *  · The canonical `purchases` table (system-of-record for every top-up / eGift /
 *    package sale) had NO user-facing list. Added a buyer-scoped, field-whitelisted
 *    GET /api/user/purchases. This pins the scoping + that raw jsonb blobs
 *    (feeSnapshotJson / metadataJson) are never leaked to the client.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const src = R('server/routes/user-profile.ts');

describe('profile read-back (edits must not "disappear")', () => {
  it('GET /profile returns every extended field that PATCH writes', () => {
    // Each of these is set by PATCH and must now be echoed by GET.
    for (const field of [
      'gender: user.gender',
      'carPlate: user.carPlate',
      'carPlate2: user.carPlate2',
      'emergencyContactName: user.emergencyContactName',
      'emergencyContactPhone: user.emergencyContactPhone',
      'marketingConsent: user.marketingConsent',
      'twoFactorEnabled: user.twoFactorEnabled',
    ]) {
      expect(src).toContain(field);
    }
  });

  it('idNumber stays OUT of the GET response — encrypted PII is never sent back', () => {
    // The raw ID must never be returned. (The encrypted columns may be written by
    // PATCH, but no plaintext idNumber is echoed to the client.)
    expect(src).not.toMatch(/idNumber:\s*user\.idNumber\b/);
    expect(src).not.toMatch(/idNumber:\s*decryptField/);
  });
});

describe('GET /api/user/purchases (buyer-scoped, field-whitelisted)', () => {
  it('exposes the purchases list endpoint', () => {
    expect(src).toMatch(/router\.get\(['"]\/purchases['"]/);
  });

  it('is scoped to the authenticated buyer only', () => {
    expect(src).toMatch(/eq\(purchases\.buyerUserId,\s*uid\)/);
  });

  it('requires auth (401 when no uid resolved)', () => {
    // The handler resolves uid then guards; the endpoint must not be anonymous.
    expect(src).toMatch(/Authentication required/);
  });

  it('never leaks the raw jsonb blobs to the client', () => {
    // feeSnapshotJson / metadataJson can hold internal routing + PII — the mapped
    // response object must not include them.
    expect(src).not.toMatch(/feeSnapshotJson:/);
    expect(src).not.toMatch(/metadataJson:/);
    // And the row must be field-mapped, not spread wholesale.
    expect(src).not.toMatch(/rows\.map\(\(p\)\s*=>\s*\(\{\s*\.\.\.p/);
  });
});
