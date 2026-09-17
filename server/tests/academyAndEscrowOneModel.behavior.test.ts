/**
 * Academy and the Firestore escrow on the one money model
 * (shared/marketplaceMoney.ts): trainer keeps the whole rate, the customer pays
 * 15% on top, VAT inside the fee.
 *
 * Before 2026-09-17, a ₪100 training hour:
 *  - academy.ts charged ₪100 and paid the trainer ₪85
 *  - the booking screen (lib/vatCalculator) said the same, and sent a
 *    service fee of ₪17.25 (fee + its own VAT, counted twice)
 *  - TrainerProfile showed ₪117.70 (trainer's own rate + 18% VAT on top)
 *  - SitterAdvancedBookingEngine and /api/bookings escrowed a flat 15% of the
 *    total — ₪97.75 held for a provider owed ₪100
 *  - an academy receipt that failed inline was queued WITHOUT the receipt
 *    fields, so the retry could never produce the right document
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vatCalculator } from '../../client/src/lib/vatCalculator';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('client price helper (Academy, PetTrek screens)', () => {
  it('₪100 hour → customer ₪115, fee ₪15 (VAT ₪2.29 inside), trainer ₪100', () => {
    const p = vatCalculator.calculateVAT(100);
    expect(p).toMatchObject({
      baseAmount: 100, commission: 15, vatOnCommission: 2.29,
      netToProvider: 100, grossCollectedILS: 115, totalCharged: 115,
    });
    expect(vatCalculator.calculateTotalWithVAT(100)).toBe(115);
  });

  it('booking screen sends the fee once, not fee + VAT', () => {
    const src = read('client/src/pages/academy/BookingFlow.tsx');
    expect(src).not.toContain('pricing.commission + pricing.vatOnCommission');
    expect(src.match(/serviceFeeCents=\{Math\.round\(pricing\.commission \* 100\)\}/g)?.length).toBe(2);
  });

  it('trainer profile shows the same 15% on top — not their own rate + 18% VAT', () => {
    const src = read('client/src/pages/academy/TrainerProfile.tsx');
    expect(src).toContain('splitMarketplaceJob(Math.round(parseFloat(trainer.hourlyRate) * 100))');
    expect(src).not.toMatch(/commissionRate\) \/ 100 \* 0\.18/);
  });
});

describe('academy booking + receipt (server)', () => {
  const src = read('server/routes/academy.ts');

  it('prices through splitMarketplaceJob', () => {
    expect(src).toContain('const split = splitMarketplaceJob(Math.round(parseFloat(trainer.hourlyRate) * durationHours * 100));');
    expect(src).toContain('const totalAmount = split.customerTotalCents / 100;');
    expect(src).toContain('const trainerPayout = split.providerPayoutCents / 100;');
    expect(src).not.toContain('const trainerPayout = totalAmount - platformFee;');
  });

  it('the receipt fee is the booking\'s own stored share, and the outbox stores the full receipt', () => {
    expect(src).toContain('const feeShare = storedTotal > 0 && storedFee >= 0 ? storedFee / storedTotal : PETWASH_COMMISSION_RATE;');
    expect(src).toMatch(/kind: 'academy_receipt',\s+sourceKey: `booking:\$\{bookingId\}`,\s+payload: receiptInput,/);
    expect(src).toContain('await IsraeliDigitalReceiptService.generateReceipt(receiptInput);');
    // stored share reproduces both models
    expect(Math.round(115 * (15 / 115) * 100) / 100).toBe(15);
    expect(Math.round(100 * (15 / 100) * 100) / 100).toBe(15);
  });
});

describe('Firestore escrow holds the provider\'s whole rate', () => {
  it('sitter engine passes fee ÷ total as the commission share', () => {
    const src = read('server/services/SitterAdvancedBookingEngine.ts');
    expect(src).toContain('(pricing.platformFee / pricing.totalPrice) * 100');
  });

  it('/api/bookings passes fee ÷ total as the commission share', () => {
    const src = read('server/routes/bookings.ts');
    expect(src).toContain('(vatCalc.platformFeeGross / vatCalc.grossCollectedILS) * 100');
  });

  it('₪115 with a 15/115 share holds ₪100 (EscrowService arithmetic)', () => {
    const amountCents = 11500;
    const commission = Math.round(amountCents * (((15 / 115) * 100) / 100));
    expect(amountCents - commission).toBe(10000);
  });
});
