/**
 * Gift-card double-spend: redeem after wallet-activation.
 *
 * `storage.redeemVoucher` (the station/Nayax-session spend path, live via
 * routes.ts /api/.../redeem) rejected only USED/CANCELLED/EXPIRED vouchers.
 * It did NOT reject 'REDEEMED' — the terminal state set when a gift card is
 * activated to a wallet (gift-cards.ts activate-wallet). So a voucher already
 * converted to wallet credit could ALSO be spent at a station = double-spend.
 *
 * Fix: block 'REDEEMED' too. Partial station redemptions set 'USED' (not
 * 'REDEEMED') at zero balance, so this breaks no legitimate flow.
 *
 * Source-introspection so the guard can't silently regress.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const storageSrc = fs.readFileSync(path.resolve(__dirname, '..', 'storage.ts'), 'utf8');

function sliceRedeemVoucher(s: string): string {
  const start = s.indexOf('async redeemVoucher(');
  if (start < 0) throw new Error('redeemVoucher not found');
  const end = s.indexOf('async getMyVouchers(', start);
  return end < 0 ? s.slice(start) : s.slice(start, end);
}

describe('storage.redeemVoucher — blocks already-consumed vouchers', () => {
  const body = sliceRedeemVoucher(storageSrc);

  it("rejects a voucher already activated to wallet (status 'REDEEMED')", () => {
    expect(body).toMatch(/voucher\.status === 'REDEEMED'/);
  });

  it('still rejects USED / CANCELLED / EXPIRED', () => {
    expect(body).toMatch(/voucher\.status === 'USED'/);
    expect(body).toMatch(/voucher\.status === 'CANCELLED'/);
    expect(body).toMatch(/voucher\.status === 'EXPIRED'/);
  });
});
