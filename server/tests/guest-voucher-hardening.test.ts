/**
 * Guest eGift voucher hardening (2026-08-01).
 *
 * A guest eGift is issued with NO owner (ownerUserId + purchasedByUserId both null)
 * and its human serial doubles as the redemption bearer value. Two properties must
 * hold so an unclaimed guest voucher can't be enumerated or hijacked:
 *
 *   1. The serial is high-entropy (80-bit CSPRNG), not the old 32-bit value that was
 *      both collision-prone and brute-forceable.
 *   2. issueVoucher retries on a UNIQUE collision so a PAID guest order is never
 *      stranded as "paid-but-not-issued".
 *   3. Web redemption of an OWNER-LESS voucher is bound to the intended recipient:
 *      the caller's verified email must equal the voucher's recipientEmail (admins
 *      exempt), else 403 — otherwise any signed-in user could redeem by serial.
 *
 * Source-pinned (no DB) so a future edit that regresses any of these fails the gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const svc = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'unifiedVoucherService.ts'),
  'utf8',
);
const redeemRoute = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'unified-vouchers.ts'),
  'utf8',
);

describe('guest eGift voucher hardening', () => {
  it('serial uses 80-bit entropy (randomBytes(10)), not the old 32-bit randomBytes(2)', () => {
    // The generator must draw 10 CSPRNG bytes for the serial.
    expect(svc).toMatch(/PWV-2026-\$\{crypto\.randomBytes\(10\)\.toString\("hex"\)/);
    // The old weak form must be gone.
    expect(svc).not.toMatch(/const seg = \(\) => crypto\.randomBytes\(2\)/);
  });

  it('issueVoucher retries the insert on a UNIQUE (serial/id) collision', () => {
    expect(svc).toMatch(/for \(let attempt = 0; ; attempt\+\+\)/);
    expect(svc).toMatch(/isUniqueViolation/);
    expect(svc).toMatch(/e\?\.code === "23505"/);
  });

  it('owner-less (guest) voucher redemption is bound to the recipient email', () => {
    // The redeem handler must capture recipientEmail...
    expect(redeemRoute).toMatch(/recipientEmail = v\.recipientEmail \?\? null/);
    // ...and gate owner-less redemption on a caller/recipient email match (admins exempt).
    expect(redeemRoute).toMatch(/if \(!ownerId && !isAdmin\(req\)\)/);
    expect(redeemRoute).toMatch(/callerEmail !== intendedEmail/);
  });
});
