import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  issueRedemptionFiscalDocument,
  buildRedemptionReceiptParams,
  redemptionFiscalEnabled,
  redemptionFiscalSourceKey,
  type RedemptionFiscalDeps,
  type RedemptionFiscalInput,
} from '../services/k9000RedemptionFiscal';

/**
 * SUMIT-on-redemption audit 2026-09-12:
 *  G1  a wash paid from stored value issued NO fiscal document (the CPA table
 *      puts the tax event at EGIFT_REDEMPTION — nothing ever issued it)
 *  G2  nothing linked a redemption to a document
 *  G7  reconciliation never noticed "value redeemed, no document"
 *  G10 paid wallet top-ups were credited as promo_credit → invisible to the bay
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

function input(over: Partial<RedemptionFiscalInput> = {}): RedemptionFiscalInput {
  return {
    redemptionType: 'gift_credit', userId: 'u1', txnId: 'TXN-1-abc', amountCents: 5500,
    washId: 'w1', kioskId: 'KS-1', bayId: 'bay-left', side: 'left', correlationId: 'c1', ...over,
  };
}
function deps(over: Partial<RedemptionFiscalDeps> = {}): RedemptionFiscalDeps & { calls: any[] } {
  const calls: any[] = [];
  return {
    calls,
    enabled: () => true,
    lookupCustomer: async () => ({ email: 'nir@example.com', name: 'Nir Hadad', phone: '+61419773360' }),
    generateReceipt: async (p) => { calls.push(['generateReceipt', p]); return { success: true, receiptNumber: 'PW-2026-000123', receiptId: 123 }; },
    runWithOutbox: async (_k, _p, run) => ({ enqueued: false, result: await run() }),
    recordLink: async (row) => { calls.push(['recordLink', row]); },
    ...over,
  };
}

describe('G1 — the document is issued per the CPA table, dark by default', () => {
  it('flag off → skipped, nothing called', async () => {
    const d = deps({ enabled: () => false });
    expect(await issueRedemptionFiscalDocument(input(), d)).toEqual({ status: 'skipped', reason: 'flag_off' });
    expect(d.calls).toEqual([]);
    expect(redemptionFiscalEnabled({} as any)).toBe(false);
    expect(redemptionFiscalEnabled({ K9000_REDEMPTION_FISCAL_ENABLED: 'true' } as any)).toBe(true);
  });

  it('wash_package and loyalty_benefit never issue (taxed at purchase / no money)', async () => {
    const d = deps();
    expect(await issueRedemptionFiscalDocument(input({ redemptionType: 'wash_package' }), d)).toEqual({ status: 'skipped', reason: 'not_stored_value' });
    expect(await issueRedemptionFiscalDocument(input({ redemptionType: 'loyalty_benefit', amountCents: 0 }), d)).toEqual({ status: 'skipped', reason: 'not_stored_value' });
    expect(d.calls).toEqual([]);
  });

  it('gift_credit / wallet_balance / promo_coupon → EGIFT_REDEMPTION, idempotent on the TXN id, then linked (G2)', async () => {
    for (const t of ['gift_credit', 'wallet_balance', 'promo_coupon'] as const) {
      const d = deps();
      const out = await issueRedemptionFiscalDocument(input({ redemptionType: t }), d);
      expect(out).toEqual({ status: 'issued', receiptNumber: 'PW-2026-000123', receiptId: 123, enqueued: false });
      const [, params] = d.calls[0];
      expect(params.paymentClass).toBe('EGIFT_REDEMPTION');
      expect(params.bookingId).toBe('k9000-redeem:TXN-1-abc');
      expect(params.totalAmount).toBe(55);
      expect(params.platformFeeAmount).toBe(0);
      expect(params.customerEmail).toBe('nir@example.com');
      expect(params.paymentMethod).toBe('stored_value');
      const [, link] = d.calls[1];
      expect(link).toMatchObject({ txnId: 'TXN-1-abc', receiptNumber: 'PW-2026-000123', receiptId: 123 });
    }
  });

  it('a SUMIT failure is enqueued to the outbox and never thrown into the money path', async () => {
    const d = deps({
      generateReceipt: async () => ({ success: false, error: 'sumit_down' }),
      runWithOutbox: async (_k, _p, run) => { try { await run(); return { enqueued: false, result: undefined }; } catch { return { enqueued: true }; } },
    });
    expect(await issueRedemptionFiscalDocument(input(), d)).toEqual({ status: 'enqueued' });
    expect(d.calls.some(([n]) => n === 'recordLink')).toBe(false);
  });

  it('an unexpected throw is swallowed as failed (recon G7 will flag it)', async () => {
    const d = deps({ lookupCustomer: async () => { throw new Error('db gone'); } });
    expect(await issueRedemptionFiscalDocument(input(), d)).toEqual({ status: 'failed', error: 'db gone' });
  });

  it('receipt params are stable', () => {
    const p = buildRedemptionReceiptParams(input({ amountCents: 4800 }), { email: 'a@b', name: 'A' });
    expect(p.subtotalAmount).toBe(48);
    expect(p.metadata.txnId).toBe('TXN-1-abc');
    expect(redemptionFiscalSourceKey('X')).toBe('k9000-redeem:X');
  });
});

describe('wiring pins', () => {
  it('debitAndLog calls the fiscal hook after the audit ledger, with the wash price for stored-value rails', () => {
    const s = R('server/services/K9000RedemptionService.ts');
    expect(s).toContain("import { issueRedemptionFiscalDocument } from './k9000RedemptionFiscal';");
    const at = s.indexOf('await issueRedemptionFiscalDocument({');
    expect(at).toBeGreaterThan(s.indexOf("eventType: 'package_redeemed'"));
    expect(s.slice(at, at + 600)).toContain("redemptionType === 'wash_package' || redemptionType === 'loyalty_benefit' ? 0 : WASH_PRICE_ILS_CENTS");
  });
  it('G7 — reconciliation has the redemption_without_document break', () => {
    const s = R('server/services/K9000ReconciliationService.ts');
    expect(s).toContain("breakType: 'redemption_without_document', severity: 'critical'");
    expect(s).toContain("ct.credit_type IN ('egift', 'cash_wallet', 'promo_credit')");
    expect(s).toContain('nayax_fiscal_document_links l');
  });
  it('G10 — paid top-ups are cash wallet, and addCredits knows the bucket', () => {
    expect(R('server/services/WalletService.ts')).toContain("case 'cash_wallet':\n        updateExpr.cashWalletBalanceCents = sql`COALESCE(cash_wallet_balance_cents, 0) + ${amount}`;");
    const pa = R('server/services/PurchaseActivationService.ts');
    const block = pa.slice(pa.indexOf("purchase.productType === 'ACCOUNT_CREDIT' && purchase.surface === 'wallet_topup'"), pa.indexOf("await issueDirectSaleReceipt(purchase, 'PW_WALLET_TOPUP')"));
    expect(block).toMatch(/addCredits\(\s*purchase\.buyerUserId,\s*'cash_wallet',\s*purchase\.amountCents,/);
    expect(block).not.toMatch(/addCredits\(\s*purchase\.buyerUserId,\s*'promo_credit'/);
  });
});
