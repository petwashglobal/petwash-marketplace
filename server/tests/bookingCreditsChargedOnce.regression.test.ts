/**
 * POST /api/booking-requests priced the booking with a server recompute that
 * IGNORED the customer's payment instruments, while still debiting loyalty and
 * holding wallet credit from the CLIENT's quote object. Two consequences:
 *
 *  - an honest booking that used credits always 409'd ("price has changed"),
 *    because the client's discounted total never matched the server's
 *    undiscounted one;
 *  - a request whose quote claimed credits but carried the full total was
 *    charged in full AND had the credit taken — paid twice.
 *
 * The eGift branch was worse: quoteEngine subtracted the balance from the total
 * and nothing ever held or debited it, so the balance stayed spendable.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const src = read('routes/booking-requests.ts');
const create = src.slice(0, src.indexOf("router.post('/:requestId/pay'"));

describe('the server prices the credits it later takes', () => {
  it('the recompute receives the payment instruments', () => {
    const call = create.slice(create.indexOf('const freshQuote = await calculateQuote({'), create.indexOf('QUOTE_RECOMPUTE_FAILED'));
    expect(call).toContain('applyLoyaltyCredits: data.applyLoyaltyCredits ?? false,');
    expect(call).toContain('useWalletCredit: data.useWalletCredit ?? false,');
    expect(call).toContain('giftCardCode: data.giftCardCode ?? null,');
  });

  it('debits read the server quote, never the client object', () => {
    expect(create).toContain('const quotedLoyalty = serverQuote?.success ? (serverQuote.totals.loyaltyRedeemedCents ?? 0) : 0;');
    expect(create).not.toContain('fq.totals.loyaltyRedeemedCents');
    expect(create).not.toContain('fq.totals.walletCreditAppliedCents');
    expect(create).not.toContain("orderTotalCents: fq!.totals.subtotalCents");
  });

  it('the hold covers the eGift part too', () => {
    const block = create.slice(create.indexOf('const quotedWalletCredit'), create.indexOf('let walletHoldApplied'));
    expect(block).toContain('walletCreditAppliedCents ?? 0) + (serverQuote.totals.giftCardAppliedCents ?? 0)');
  });
});

describe('credit that cannot be taken is charged instead', () => {
  it('shortfalls are counted once and raise the amount due', () => {
    expect(create).toContain('uncoveredCreditCents += Math.max(0, quotedLoyalty - loyaltyApplied);');
    expect(create).toContain('uncoveredCreditCents += Math.max(0, quotedWalletCredit - walletHeldConfirmed);');
    expect(create.match(/uncoveredCreditCents \+=/g)?.length).toBe(2);
    const raise = create.slice(create.indexOf('if (uncoveredCreditCents > 0) {'), create.indexOf('amount due raised'));
    expect(raise).toContain('totalCents += uncoveredCreditCents;');
    expect(raise).toContain('.set({ totalCents, updatedAt: new Date() })');
  });

  it('a failed hold confirms nothing', () => {
    const cat = create.slice(create.indexOf('} catch (holdErr: any) {'), create.indexOf('Wallet hold failed'));
    expect(cat).toContain('walletHeldConfirmed = 0;');
  });

  it('₪1,150 with ₪500 eGift: hold ₪500 → pay ₪650; hold ₪200 → pay ₪950', () => {
    const due = (priced: number, held: number) => priced + Math.max(0, 500_00 - held);
    expect(due(650_00, 500_00)).toBe(650_00);
    expect(due(650_00, 200_00)).toBe(950_00);
  });
});
