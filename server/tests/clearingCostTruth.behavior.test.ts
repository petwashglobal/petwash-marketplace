/**
 * What the card clearing actually costs Pet Wash — and the number that shows
 * why the marketplace split matters.
 *
 * The acquirer charges on the WHOLE amount the card is charged (the provider's
 * rate AND Pet Wash's fee), but Pet Wash's income is only the fee. So on a
 * single charge the clearing cost is measured against a pot ~7.7x bigger than
 * the income it comes out of. These pin that arithmetic so nobody quietly
 * re-derives it wrong in a dashboard.
 *
 * NOTE ON THE RATE: Pet Wash's contract rate is NOT known. It is not published,
 * and SUMIT's clearing reports carry no fee column (verified 2026-09-18) — the
 * deduction appears on the acquirer's statement and in the bank deposit. Every
 * rate used below is a STATED ASSUMPTION for the arithmetic, never a claim
 * about what Pet Wash pays.
 */
import { describe, it, expect } from 'vitest';
import { splitMarketplaceJob, clearingCost } from '@shared/marketplaceMoney';

describe('unknown is a real answer', () => {
  it('no configured pricing → known:false, zero cost, and the fee left intact', () => {
    const split = splitMarketplaceJob(100_000);
    const c = clearingCost(split, null);
    expect(c.known).toBe(false);
    expect(c.feeCents).toBe(0);
    expect(c.feeNetCents).toBe(0);
    expect(c.shareOfFeeConsumed).toBeNull();
    // The caller must show "unknown", not a zero cost dressed up as a fact.
    expect(c.netToPetWashCents).toBe(split.serviceFeeNetCents);
  });

  it('a zero rate with no fixed fee is still unknown, not free clearing', () => {
    expect(clearingCost(splitMarketplaceJob(100_000), { rate: 0 }).known).toBe(false);
  });

  it('a fixed-only pricing IS known — some acquirers quote that way', () => {
    const c = clearingCost(splitMarketplaceJob(100_000), { rate: 0, fixedCents: 50 });
    expect(c.known).toBe(true);
    expect(c.feeCents).toBe(59); // ₪0.50 + 18% VAT
  });
});

describe('the fee carries VAT, and Pet Wash reclaims it', () => {
  it('an ex-VAT quote is grossed up, and the expense is the NET half', () => {
    const split = splitMarketplaceJob(100_000); // ₪1,000 job → ₪1,150 charged
    const c = clearingCost(split, { rate: 0.011 }); // 1.1% ex-VAT (assumption)

    expect(c.chargedCents).toBe(115_000);
    // 1.1% of ₪1,150 = ₪12.65 ex-VAT → ₪14.93 with VAT
    expect(c.feeCents).toBe(1_493);
    expect(c.feeNetCents).toBe(1_265);
    expect(c.feeVatCents).toBe(228);
    // The expense is the net; the VAT is reclaimable input tax, not a cost.
    expect(c.feeNetCents + c.feeVatCents).toBe(c.feeCents);
  });

  it('a VAT-inclusive quote is taken at face value, not grossed up twice', () => {
    const split = splitMarketplaceJob(100_000);
    const inc = clearingCost(split, { rate: 0.011, vatIncluded: true });
    expect(inc.feeCents).toBe(1_265);
    expect(inc.feeCents).toBeLessThan(clearingCost(split, { rate: 0.011 }).feeCents);
  });
});

describe('the number that argues for splitting the charge', () => {
  it('clearing eats ~10% of Pet Wash net income on a ₪1,000 job, because it is charged on ₪1,150', () => {
    const split = splitMarketplaceJob(100_000);
    const c = clearingCost(split, { rate: 0.011 });

    // Pet Wash earns ₪150 incl VAT → ₪127.12 net.
    expect(split.serviceFeeCents).toBe(15_000);
    expect(split.serviceFeeNetCents).toBe(12_712);

    // …and pays ₪12.65 net of clearing, on money that is mostly the PROVIDER'S.
    expect(c.feeNetCents).toBe(1_265);
    expect(c.netToPetWashCents).toBe(11_447);
    expect(c.shareOfFeeConsumed).toBeGreaterThan(0.09);
    expect(c.shareOfFeeConsumed).toBeLessThan(0.11);
  });

  it('charging ONLY the Pet Wash fee costs a fraction of that — the split-clearing case', () => {
    // Under SUMIT's marketplace split each side clears its own share, so Pet
    // Wash pays clearing on ₪150, not on ₪1,150.
    const whole = clearingCost(splitMarketplaceJob(100_000), { rate: 0.011 });
    const feeOnly = clearingCost(
      { ...splitMarketplaceJob(100_000), customerTotalCents: 15_000 },
      { rate: 0.011 },
    );

    expect(feeOnly.feeNetCents).toBe(165);
    // ~7.7x cheaper, which is the whole argument.
    expect(whole.feeNetCents / feeOnly.feeNetCents).toBeGreaterThan(7);
    expect(feeOnly.shareOfFeeConsumed).toBeLessThan(0.015);
  });

  it('a small job is hit hardest — the fixed fee, not the percentage', () => {
    // ₪30 bay wash: a ₪0.50 fixed fee dwarfs 1.1%.
    const small = clearingCost(splitMarketplaceJob(3_000), { rate: 0.011, fixedCents: 50 });
    const pctOnly = clearingCost(splitMarketplaceJob(3_000), { rate: 0.011 });
    expect(small.feeNetCents).toBeGreaterThan(pctOnly.feeNetCents * 1.9);
    // A percentage-only model would understate this charge by more than half.
  });
});

describe('it never invents money', () => {
  it('rubbish in does not produce a cost', () => {
    const split = splitMarketplaceJob(100_000);
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1] as number[]) {
      const c = clearingCost(split, { rate: bad });
      expect(c.known).toBe(false);
      expect(c.feeCents).toBe(0);
    }
  });

  it('a zero-value job cannot report a share of nothing', () => {
    const c = clearingCost(splitMarketplaceJob(0), { rate: 0.011 });
    expect(c.shareOfFeeConsumed).toBeNull();
  });
});
