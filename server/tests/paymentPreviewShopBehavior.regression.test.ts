/**
 * Payment-preview SHOP adapter invariants — CEO 2026-08-26
 * correction pass #2 §19-21.
 *
 * The composer must never invent a new pricing engine and must NEVER
 * promise split tender the checkout does not support. These tests
 * read the composer source and pin the invariants that a future
 * refactor cannot silently break.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'paymentPreview.ts'),
  'utf8',
);

describe('paymentPreview — shop adapter invariants (§19-21)', () => {
  it('delegates to shopService.validateCartForCheckout — does NOT re-price', () => {
    expect(SRC).toMatch(/shopService\.validateCartForCheckout\(/);
    // No inline "compute subtotal from items" pattern in the shop
    // composer — subtotal MUST come from cart.
    expect(SRC).toMatch(/subtotalCents\s*=\s*Number\(\(cart as any\)\.subtotalCents\)\s*\|\|\s*0/);
  });

  it('delegates delivery to shopService.calculateDelivery — does NOT re-derive', () => {
    expect(SRC).toMatch(/shopService\.calculateDelivery\(/);
  });

  it('reads ISRAEL_VAT_RATE for VAT extraction (never hard-codes 18)', () => {
    expect(SRC).toMatch(/import\s*\{\s*ISRAEL_VAT_RATE\s*\}\s*from\s*['"]@shared\/israel-compliance-config['"]/);
    // Same 18/118 extract formula the /api/shop/checkout handler uses.
    expect(SRC).toMatch(/grossCents\s*\*\s*ISRAEL_VAT_RATE\s*\/\s*\(1\s*\+\s*ISRAEL_VAT_RATE\)/);
  });

  it('never promises split tender — wallet chip appears only when wallet fully covers total', () => {
    // The shop composer defines walletCoversFullAmount and gates the
    // storedValue array on it. A future refactor that shows a partial
    // wallet slice (wallet ₪30 + card ₪70) breaks this pin.
    expect(SRC).toMatch(/walletCoversFullAmount\s*=\s*walletCents\s*>=\s*totalCents\s*&&\s*totalCents\s*>\s*0/);
    expect(SRC).toMatch(/storedValue.*=\s*walletCoversFullAmount\s*\?\s*\[/);
  });

  it('when wallet exists but cannot cover, surfaces honest warning + empty storedValue', () => {
    // The warning line must exist so the UI can render the honest
    // "wallet insufficient — pay by card or top up" note.
    expect(SRC).toMatch(/insufficient/i);
    // And the storedValue path for that branch is the empty array.
    expect(SRC).toMatch(/storedValue.*=\s*walletCoversFullAmount\s*\?\s*\[[^\]]*\]\s*:\s*\[\]/s);
  });

  it('paymentState is fully_covered when covered, quoted otherwise (never fake paid/paying)', () => {
    // The composer maps amountRemainingCents === 0 to fully_covered
    // and otherwise to 'quoted'. It never returns 'paid' — the shop
    // preview is a pre-payment quote.
    expect(SRC).toMatch(/paymentState:\s*PaymentState\s*=\s*amountRemainingCents\s*===\s*0\s*\?\s*'fully_covered'\s*:\s*'quoted'/);
    // No 'paid' produced from this adapter.
    const shopBlock = SRC.slice(SRC.indexOf('composeShop'), SRC.indexOf('composeStub'));
    expect(shopBlock).not.toMatch(/paymentState.*=\s*['"]paid['"]/);
  });

  it('adapter never mutates DB rows', () => {
    // Same read-only discipline as the provider-earnings composer.
    // We check only inside the shop composer body — the file may
    // legitimately mention these verbs in comments elsewhere.
    const shopBlock = SRC.slice(SRC.indexOf('async function composeShop'), SRC.indexOf('async function composeStub'));
    for (const verb of ['db.insert', 'db.update', 'db.delete']) {
      expect(shopBlock).not.toContain(verb);
    }
  });
});
