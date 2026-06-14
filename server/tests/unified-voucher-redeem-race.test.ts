/**
 * Unified-voucher redemption double-spend race fix.
 *
 * Before this fix, `redeemVoucher` did a plain SELECT, reconciled the balance
 * from the ledger, then wrote — with NO transaction and NO row lock. On the
 * WEB/APP channels the QR-jti replay guard is optional, so two concurrent
 * redeems could both read the same remaining balance and both succeed,
 * double-spending the voucher (e.g. spending the last wash twice, or driving
 * a PLATFORM_CREDIT balance negative).
 *
 * The fix wraps reconcile → validate → ledger-append → voucher-update in ONE
 * transaction that opens with `SELECT … FOR UPDATE` on the voucher row, so a
 * second concurrent redeem blocks until the first commits, then reconciles
 * against the now-committed ledger. Same pattern as confirmRedemption (#712).
 *
 * This test pins the guard in source so a future refactor that drops the
 * lock or moves the writes back outside the transaction fails CI.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SVC = path.resolve(__dirname, '..', 'services', 'unifiedVoucherService.ts');
const src = fs.readFileSync(SVC, 'utf8');

/** Slice the body of `redeemVoucher` so assertions only inspect that flow. */
function sliceRedeemVoucher(s: string): string {
  const start = s.indexOf('export async function redeemVoucher');
  if (start < 0) throw new Error('redeemVoucher declaration not found');
  // Ends at the next top-level export after it.
  const after = s.indexOf('export async function getVoucherWithBalance', start);
  return after < 0 ? s.slice(start) : s.slice(start, after);
}

describe('unifiedVoucherService.redeemVoucher — double-spend race guard', () => {
  const body = sliceRedeemVoucher(src);

  it('wraps the redemption write path in a transaction', () => {
    expect(body).toContain('.transaction(');
  });

  it('takes a FOR UPDATE row lock on the voucher before reconciling', () => {
    expect(body).toMatch(/FOR UPDATE/i);
    expect(body).toContain('unified_vouchers');
  });

  it('re-checks voucher status under the lock (not only the pre-lock fast-fail)', () => {
    // The locked re-read drives the authoritative status + balance checks.
    expect(body).toMatch(/locked\.status === "REDEEMED"/);
    expect(body).toMatch(/locked\.voucherType === "WASH_PACKAGE"/);
  });

  it('reconciles balance from the ledger inside the transaction (tx-scoped)', () => {
    expect(body).toContain('reconcileFromLedger(locked, tx)');
  });

  it('writes the ledger entry and voucher update through the transaction handle', () => {
    // appendLedgerEntry receives the tx as its second argument
    expect(body).toMatch(/appendLedgerEntry\(\{[\s\S]*?\},\s*tx\)/);
    // voucher cache update goes through tx, not the pooled db
    expect(body).toContain('tx\n      .update(unifiedVouchers)');
  });
});

describe('unifiedVoucherService — ledger helpers accept a transaction handle', () => {
  it('reconcileFromLedger, appendLedgerEntry, getLastLedgerEntry take an optional conn', () => {
    expect(src).toMatch(/async function reconcileFromLedger\(voucher: UnifiedVoucher, conn: any = db\)/);
    expect(src).toMatch(/async function getLastLedgerEntry\(voucherId: string, conn: any = db\)/);
    // appendLedgerEntry's params object is followed by the conn parameter
    expect(src).toMatch(/\}, conn: any = db\): Promise<UnifiedVoucherLedgerEntry>/);
  });
});
