/**
 * Rails-truth batch (2026-09-13) — pins for the three audits (booking fiscal,
 * shop + credit-redeem fiscal, K9000 QR chain).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('one redeem-token guard for both K9000 rails', () => {
  it('the guard checks qr_token_version and burns into petwash_pass_nonce_registry', () => {
    const g = R('server/lib/redeemTokenGuard.ts');
    expect(g).toContain('export async function enforceRedeemTokenFreshness(');
    expect(g).toContain("throw new Error('TOKEN_REVOKED')");
    expect(g).toContain("throw new Error('TOKEN_REPLAYED')");
    expect(g).toContain('INSERT INTO petwash_pass_nonce_registry');
  });
  it('Cortina bay rail and kiosk /redeem-wash both call it before money moves', () => {
    expect(R('server/routes/nayax-cortina.ts')).toContain('await enforceRedeemTokenFreshness(p);');
    const k = R('server/routes/k9000.ts');
    const guardAt = k.indexOf('await enforceRedeemTokenFreshness(payload);');
    const debitAt = k.indexOf('authorization = await authorizeRedemption({');
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(debitAt);
    expect(k).toContain("if (reason === 'TOKEN_REVOKED')");
    expect(k).toContain("status: 'NONCE_STORE_UNAVAILABLE'");
  });
});

describe('wallet-paid bookings can complete and their receipt names the wallet', () => {
  const src = R('server/routes/booking-requests.ts');
  it('completion gate accepts a committed wallet debit as the held payment', () => {
    expect(src).toContain("const walletPaid = Number((booking as any).walletDebitedCents) > 0;");
    expect(src).toContain('if (!booking.paymentHeldAt && !walletPaid) {');
  });
  it('receipt tender is derived, never hard-coded "Escrow (card)" alone', () => {
    expect(src).not.toContain("paymentMethod: 'Escrow (card)',");
    expect(src).toContain("? (booking.paymentHeldAt ? 'PetWash Wallet + card' : 'PetWash Wallet')");
  });
});

describe('SUMIT dispatch of a customer receipt is durable', () => {
  const svc = R('server/services/IsraeliDigitalReceiptService.ts');
  it('generateReceipt routes the SUMIT leg through the fiscal outbox', () => {
    expect(svc).toContain("kind: 'sumit_receipt_dispatch'");
    expect(svc).toContain('runNow: () => IsraeliDigitalReceiptService.dispatchReceiptToSumit({ receiptId: receipt.id, paymentClass: params.paymentClass })');
  });
  it('the dispatcher is idempotent (skips a stamped row) and throws on transport failure so the drainer retries', () => {
    expect(svc).toContain('static async dispatchReceiptToSumit(');
    expect(svc).toContain("if (row.sumitDocumentId) return { status: 'already_issued'");
    expect(svc).toContain('idempotencyKey: receiptNumber');
  });
  it('the drainer has handlers for the new kinds', () => {
    const idx = R('server/index.ts');
    expect(idx).toContain('sumit_receipt_dispatch: async (p: any) => {');
    expect(idx).toContain('shop_receipt: async (p: any) => {');
    const kinds = R('server/services/fiscalDocumentOutbox.ts');
    expect(kinds).toContain("| 'sumit_receipt_dispatch'");
    expect(kinds).toContain("| 'shop_receipt'");
  });
});

describe('shop receipt and admin force-confirm receipt are durable too', () => {
  it('ShopService.generateTaxInvoice wraps issueShopReceiptNow in the outbox', () => {
    const s = R('server/services/ShopService.ts');
    expect(s).toContain("kind: 'shop_receipt'");
    expect(s).toContain('runNow: () => this.issueShopReceiptNow(orderId)');
    expect(s).toContain('async issueShopReceiptNow(orderId: number): Promise<void>');
  });
  it('admin force-confirm (Academy) issues the same PROVIDER_BOOKING_COMMISSION receipt as trainer-confirm', () => {
    const p = R('server/routes/prestige-pass.ts');
    const at = p.indexOf("logger.info('[AdminWallet][ForceConfirm] Wallet debited'");
    const rc = p.indexOf("kind: 'academy_receipt'", at);
    expect(rc).toBeGreaterThan(at);
    expect(p.slice(rc, rc + 2500)).toContain("paymentClass: 'PROVIDER_BOOKING_COMMISSION'");
  });
});
