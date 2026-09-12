/**
 * A VERIFIED PAYMENT IS NOT A PAYMENT FOR *THIS* ORDER (2026-09-13).
 *
 * All three SUMIT hosted-page return handlers re-verified the transaction id
 * with SUMIT and compared the amount — and then fulfilled whatever order the
 * QUERYSTRING named. Nothing bound the transaction to the order it was opened
 * for, so with no special access:
 *
 *   1. start two identical purchases (same amount) → ext=A, ext=B
 *   2. pay only A                                   → txn T is genuinely valid
 *   3. GET …/return?ID=T&ext=B   → T verifies, amount matches, B is fulfilled
 *
 * Repeat for as many unpaid orders as you like: unlimited wallet credit, wash
 * packages, shop orders, eGift vouchers, and confirmed bookings with escrow
 * stamped 'held' for money never collected.
 *
 * server/routes/save-card.ts has bound the ref since it was written; the three
 * money-in handlers did not. server/lib/sumitExternalRef.ts is now that one
 * check, shared.
 *
 * Also sealed here: POST /api/prestige-pass/issue-gift, which minted real gift
 * value with NO debit, NO payment and NO admin check.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sumitExternalRefMismatch, readSumitExternalRef } from '../lib/sumitExternalRef';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('the shared binding check', () => {
  it('reads the external ref under every name SUMIT uses', () => {
    expect(readSumitExternalRef({ ExternalIdentifier: 'A' })).toBe('A');
    expect(readSumitExternalRef({ Data: { ExternalID: 'B' } })).toBe('B');
    expect(readSumitExternalRef({ Payment: { ExternalIdentifier: 'C' } })).toBe('C');
    expect(readSumitExternalRef({})).toBeNull();
    expect(readSumitExternalRef(null)).toBeNull();
  });

  it('refuses a transaction opened for a DIFFERENT order', () => {
    expect(sumitExternalRefMismatch({ ExternalIdentifier: 'order-A' }, 'order-B')).toBe(true);
  });

  it('accepts the matching order', () => {
    expect(sumitExternalRefMismatch({ ExternalIdentifier: 'order-A' }, 'order-A')).toBe(false);
  });

  it('fails OPEN when SUMIT carried no identifier — never strand a real payer', () => {
    expect(sumitExternalRefMismatch({}, 'order-A')).toBe(false);
    expect(sumitExternalRefMismatch({ ExternalIdentifier: '' }, 'order-A')).toBe(false);
  });
});

describe('every money-in return handler binds the transaction', () => {
  it('POST-pay wallet / packages / eGift SKUs — /api/payments/sumit/return', () => {
    const src = R('server/routes/payments-sumit.ts');
    expect(src).toContain("import { sumitExternalRefMismatch, readSumitExternalRef } from '../lib/sumitExternalRef';");
    expect(src).toContain('if (ext && sumitExternalRefMismatch(verify.raw, ext)) {');
    // the check must sit BEFORE fulfilment (compare against the CALL, not the import)
    expect(src.indexOf('if (ext && sumitExternalRefMismatch(verify.raw, ext))'))
      .toBeLessThan(src.indexOf('await activateFromVerifiedPayment({'));
  });

  it('guest eGift — /api/egift/guest/return', () => {
    const src = R('server/routes/egift-guest.ts');
    expect(src).toContain('if (sumitExternalRefMismatch(verify.raw, ext)) {');
    expect(src.indexOf('if (sumitExternalRefMismatch(verify.raw, ext))')).toBeLessThan(src.indexOf('await issueVoucher({'));
  });

  it('marketplace booking — /api/booking-requests/:id/sumit-return', () => {
    expect(R('server/services/SumitBookingPayment.ts'))
      .toContain("if (ref !== null && !ref.startsWith(`bkg_${expectedRequestId}_`)) {");
    expect(R('server/routes/booking-requests.ts'))
      .toContain('verifySumitBookingPayment(String(txnId), String(requestId))');
  });
});

describe('the endpoint that minted gift value for free is sealed', () => {
  const src = R('server/routes/prestige-pass.ts');
  it('answers 410 before doing anything', () => {
    const at = src.indexOf("router.post('/issue-gift'");
    expect(at).toBeGreaterThan(-1);
    const body = src.slice(at, at + 2200);
    expect(body).toContain("error: 'ENDPOINT_SEALED'");
    expect(body.indexOf('ENDPOINT_SEALED')).toBeLessThan(body.indexOf('giftCode'));
  });
  it('nothing calls it, so nothing breaks', () => {
    // the route string appears only in its own file
    for (const f of ['client/src/pages/MyWallet.tsx', 'client/src/pages/EGift.tsx']) {
      expect(R(f)).not.toContain('issue-gift');
    }
  });
});
