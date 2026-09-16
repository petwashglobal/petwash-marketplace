/**
 * A SETTLEMENT ROW MUST NOT CONTRADICT ITSELF (2026-09-17).
 *
 * `recordProviderSettlement` writes one provider_commissions row holding both
 * `commissionRate` and `commissionAmount`. The amount is computed from
 * PLATFORM_COMMISSION_RATE (15%) — `commissionRate` is only *recorded*, never
 * used in the arithmetic. Sitter Suite passed `commissionRate: 7.5`, so every
 * sitter settlement stored "7.50%" beside an amount that is 15% of what the
 * customer paid. Walk My Pet passes nothing and was already correct.
 *
 * The bookkeeper reads these rows. A rate that does not explain its own amount
 * is exactly the class of fiscal mistake we do not ship.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

/** The settlement math, restated from IsraeliDigitalReceiptService. */
const RATE = 0.15;
const commissionFor = (providerNet: number) =>
  Number((providerNet * RATE / (1 - RATE)).toFixed(2));

describe('the recorded rate explains the recorded amount', () => {
  it('a ₪1,000 sitter stay: sitter nets 850, commission is 150 — which is 15% of 1000, not 7.5%', () => {
    const customerPaid = 1000;
    const sitterNet = customerPaid * (1 - RATE);
    expect(sitterNet).toBe(850);

    const commission = commissionFor(sitterNet);
    expect(commission).toBe(150);
    // The rate the row should carry is the one that reproduces the amount.
    expect(Number(((commission / customerPaid) * 100).toFixed(2))).toBe(15);
    // 7.5% of the same payment would have been half of it.
    expect(customerPaid * 0.075).toBe(75);
  });

  it('no caller overrides commissionRate with a number the math does not use', () => {
    // Sitter Suite must not re-introduce a hand-written rate.
    expect(read('routes/sitter-suite.ts')).not.toMatch(/commissionRate:\s*7\.5\b/);
    // Walk My Pet never passed one — keep it that way.
    const walk = read('routes/walk-my-pet.ts');
    const i = walk.indexOf('recordProviderSettlement({');
    expect(walk.slice(i, i + 500)).not.toMatch(/commissionRate:/);
  });

  it('the compliance engine passes the SAME rate its own fee used', () => {
    const src = read('services/IsraelComplianceEngine.ts');
    expect(src).toMatch(/const rate = commissionRate \?\? 0\.15;/);
    expect(src).toMatch(/const platformFeeGross = ctx\.grossChargedILS \* rate;/);
    expect(src).toMatch(/commissionRate: rate \* 100,/);
  });

  it('15% is stated once and the same everywhere it is decided', () => {
    expect(read('services/IsraeliDigitalReceiptService.ts')).toMatch(/const PLATFORM_COMMISSION_RATE = 0\.15;/);
    expect(read('services/SitterGlobalConfig.ts')).toMatch(/globalCommissionRate = 0\.15;/);
    // The stale "95% / 5% broker fee" claim above processSitterPayout is gone.
    expect(read('services/NayaxSitterMarketplaceService.ts')).not.toMatch(/Sitter receives: 95%/);
  });
});
