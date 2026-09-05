/**
 * Prestige spend surfaces — the confirmation must be as real as the debit
 * (CEO closure sprint, Agent 7).
 *
 * Two defects on the Prestige spend/top-up surfaces, both of the same family:
 * the UI told the member something that the server had not done, or did not
 * tell them something it HAD done.
 *
 *  1. PrestigePassPaymentOption — REAL SPEND, NO CONFIRMATION.
 *     apiRequest() resolves to a Response, not parsed JSON. The mutation was
 *     typed <RedemptionResult> and onSuccess read
 *     result.deductionBreakdown.totalCovered, so `result` was a Response,
 *     deductionBreakdown was undefined, and reading .totalCovered threw a
 *     TypeError INSIDE onSuccess — after /api/prestige-pass/redeem-online had
 *     already debited the wallet. The throw landed before
 *     onRedemptionSuccess?.(result), so the parent booking flow never learned
 *     the payment succeeded, and the success receipt (which renders
 *     txnResult.deductionBreakdown.*) could not render either.
 *
 *  2. PrestigePassWallet — DEAD TOP-UP BUTTON.
 *     "Top up ₪X+" called setShowTopUpDialog(true); showTopUpDialog was never
 *     read anywhere, so nothing happened. There is no in-app top-up to wire it
 *     to on purpose — /api/prestige-pass/topup is deliberately 410 (self-mint)
 *     and /api/credit-wallet/topup needs a verified Nayax station transaction.
 *     The control is now non-interactive and truthful.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const OPTION = fs.readFileSync(
  path.resolve(__dirname, '..', 'components', 'PrestigePassPaymentOption.tsx'),
  'utf8',
);
const WALLET = fs.readFileSync(
  path.resolve(__dirname, '..', 'pages', 'PrestigePassWallet.tsx'),
  'utf8',
);

describe('PrestigePassPaymentOption — a real debit produces a real confirmation', () => {
  it('parses the response body before anything reads deductionBreakdown', () => {
    // The mutationFn must await res.json(); returning apiRequest(...) directly
    // hands a Response to onSuccess and reintroduces the TypeError.
    expect(OPTION).toMatch(/await res\.json\(\)/);
    expect(OPTION).not.toMatch(/mutationFn:\s*\(\)\s*=>\s*\n?\s*apiRequest\(/);
  });

  it('notifies the parent BEFORE rendering any cosmetic copy', () => {
    // Ordering is the actual guard: the booking flow depends on
    // onRedemptionSuccess to mark the booking paid, so a formatting slip must
    // never be able to pre-empt it again.
    const onSuccess = OPTION.slice(
      OPTION.indexOf('onSuccess: (result)'),
      OPTION.indexOf('onError:'),
    );
    expect(onSuccess).toContain('onRedemptionSuccess?.(result)');
    expect(onSuccess.indexOf('onRedemptionSuccess?.(result)'))
      .toBeLessThan(onSuccess.indexOf('toast({'));
  });

  it('reads the covered amount defensively', () => {
    expect(OPTION).toMatch(/result\?\.deductionBreakdown\?\.totalCovered/);
  });
});

describe('PrestigePassWallet — no dead top-up control', () => {
  it('the never-read showTopUpDialog state and its setter are gone', () => {
    // Allow the word inside the explanatory comment, but no live code.
    expect(WALLET).not.toMatch(/useState.*showTopUpDialog|const \[showTopUpDialog/);
    expect(WALLET).not.toMatch(/onClick=\{\(\) => setShowTopUpDialog\(true\)\}/);
    expect(WALLET).not.toMatch(/setShowTopUpDialog=\{/);
  });

  it('the shortfall control is non-interactive and points at the real remedy', () => {
    expect(WALLET).toMatch(/aria-disabled="true"/);
    expect(WALLET).toMatch(/Wallet top-up happens at the station/);
    // The live remedy (Nayax terminal) must still be present.
    expect(WALLET).toMatch(/Pay at Nayax terminal/);
  });
});
