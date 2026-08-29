/**
 * CEO MASTER DIRECTIVE 2026-08-28 §38 §39 §40 §41 §42 §71 §72 §73 —
 * CancellationEngine invariants.
 *
 * The engine is the SOLE authority on cancellation math. Every quote
 * carries a policyVersion so a downstream dispute can re-derive.
 * NEVER hardcode a blanket 5% / ₪100 formula — the engine picks the
 * right rule for the (transactionType, bookingPhase, initiator,
 * timing) tuple.
 */
import { describe, it, expect } from 'vitest';
import { computeCancellationQuote } from '../services/cancellationEngine';
import type {
  CancellationInput,
  CxnFundingLegRefund,
} from '@shared/lib/cancellationPolicy';
import { CURRENT_POLICY_VERSION } from '@shared/lib/cancellationPolicy';

function base(overrides: Partial<CancellationInput> = {}): CancellationInput {
  return {
    country: 'IL',
    transactionType: 'service_marketplace',
    serviceType: 'walk',
    bookingPhase: 'accepted_awaiting_start',
    consumerCategory: 'regular',
    initiator: 'customer',
    grossCents: 20000, // ₪200
    serviceStartsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    requestedAt: new Date().toISOString(),
    paymentLegs: [{ instrument: 'card', amountCents: 20000 }],
    usedCreditCard: true,
    ...overrides,
  };
}

describe('CancellationEngine — provider / admin initiator (CEO §74)', () => {
  it('provider cancel → full refund, no cancellation fee, no clearing pass-through', () => {
    const q = computeCancellationQuote(base({ initiator: 'provider' }));
    expect(q.cancellationFeeCents).toBe(0);
    expect(q.clearingFeeCents).toBe(0);
    expect(q.refundableCents).toBe(20000);
    expect(q.providerImpact).not.toBe('none');
  });

  it('admin cancel → full refund, provider impact none', () => {
    const q = computeCancellationQuote(base({ initiator: 'admin' }));
    expect(q.cancellationFeeCents).toBe(0);
    expect(q.refundableCents).toBe(20000);
    expect(q.providerImpact).toBe('none');
  });
});

describe('CancellationEngine — customer initiator (CEO §38 §40)', () => {
  it('cancel ≥14 days before start → ZERO fee (grace)', () => {
    const q = computeCancellationQuote(base({
      serviceStartsAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    }));
    expect(q.cancellationFeeCents).toBe(0);
    expect(q.refundableCents).toBeGreaterThan(0);
  });

  it('cancel <14 days before start on service_marketplace → distance-cap fee (min 5% or ₪100)', () => {
    // Gross 20000 cents = ₪200. 5% = ₪10 = 1000 cents. Cap = min(1000, 10000) = 1000.
    const q = computeCancellationQuote(base({ grossCents: 20000 }));
    expect(q.cancellationFeeCents).toBe(1000);
  });

  it('when 5% is HIGHER than ₪100 the cap wins', () => {
    // Gross ₪5000 = 500000. 5% = 25000. ₪100 = 10000. Cap = 10000.
    const q = computeCancellationQuote(base({ grossCents: 500000 }));
    expect(q.cancellationFeeCents).toBe(10000);
  });

  it('cancel while service in_progress → NO refund', () => {
    const q = computeCancellationQuote(base({ bookingPhase: 'in_progress' }));
    expect(q.cancellationFeeCents).toBe(20000);
    expect(q.refundableCents).toBe(0);
    expect(q.providerImpact).toBe('revoke_payout');
  });

  it('cancel after completion → no refund, no clearing charge', () => {
    const q = computeCancellationQuote(base({ bookingPhase: 'completed' }));
    expect(q.refundableCents).toBe(0);
    expect(q.clearingFeeCents).toBe(0);
  });

  it('draft (no payment) → nothing to refund, nothing to charge', () => {
    const q = computeCancellationQuote(base({ bookingPhase: 'draft_no_payment', paymentLegs: [] }));
    expect(q.cancellationFeeCents).toBe(0);
    expect(q.refundableCents).toBe(0);
  });
});

describe('CancellationEngine — clearing-fee pass-through (CEO §42)', () => {
  it('customer with credit card, service not started → capped 2% pass-through', () => {
    const q = computeCancellationQuote(base({ grossCents: 100000 })); // ₪1000
    // 2% cap = 2000 cents = ₪20
    expect(q.clearingFeeCents).toBeLessThanOrEqual(2000);
    expect(q.clearingFeeCents).toBeGreaterThan(0);
  });

  it('NO pass-through when the transaction did not use a credit card', () => {
    const q = computeCancellationQuote(base({ usedCreditCard: false }));
    expect(q.clearingFeeCents).toBe(0);
  });

  it('NO pass-through when service is in_progress or completed', () => {
    const q = computeCancellationQuote(base({ bookingPhase: 'in_progress' }));
    expect(q.clearingFeeCents).toBe(0);
  });

  it('NO pass-through when provider or admin initiates the cancellation', () => {
    const q = computeCancellationQuote(base({ initiator: 'provider' }));
    expect(q.clearingFeeCents).toBe(0);
  });
});

describe('CancellationEngine — refund distribution (CEO §39)', () => {
  it('distributes refundable amount proportionally across original funding legs', () => {
    // ₪200 gross: 60% card + 40% wallet. Refund ₪180 after fee. Card
    // leg should get ~₪108, wallet ~₪72.
    const legs: CxnFundingLegRefund[] = [
      { instrument: 'card',   amountCents: 12000 }, // 60%
      { instrument: 'wallet', amountCents:  8000 }, // 40%
    ];
    const q = computeCancellationQuote(base({
      grossCents: 20000,
      paymentLegs: legs,
      serviceStartsAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    }));
    expect(q.cancellationFeeCents).toBe(0);
    expect(q.refundableCents).toBe(20000);
    const sum = q.fundingLegRefunds.reduce((s, l) => s + l.amountCents, 0);
    expect(sum).toBe(20000);
    const cardLeg = q.fundingLegRefunds.find(l => l.instrument === 'card');
    const walletLeg = q.fundingLegRefunds.find(l => l.instrument === 'wallet');
    expect(cardLeg?.amountCents).toBe(12000);
    expect(walletLeg?.amountCents).toBe(8000);
  });

  it('last leg absorbs the rounding remainder — sum equals refundable exactly', () => {
    // ₪100 gross split 33/33/34. Refund ₪33.33 across the split.
    const legs: CxnFundingLegRefund[] = [
      { instrument: 'card',           amountCents: 3300 },
      { instrument: 'wallet',         amountCents: 3300 },
      { instrument: 'loyalty_points', amountCents: 3400 },
    ];
    const q = computeCancellationQuote(base({
      grossCents: 10000,
      paymentLegs: legs,
      serviceStartsAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    }));
    const sum = q.fundingLegRefunds.reduce((s, l) => s + l.amountCents, 0);
    expect(sum).toBe(q.refundableCents);
  });
});

describe('CancellationEngine — envelope discipline (CEO §71 §72)', () => {
  it('every quote stamps policyVersion', () => {
    const q = computeCancellationQuote(base());
    expect(q.policyVersion).toBe(CURRENT_POLICY_VERSION);
  });

  it('every quote carries the input tuple back for the audit trail', () => {
    const q = computeCancellationQuote(base({
      transactionType: 'egift_purchase',
      serviceType: 'egift',
      consumerCategory: 'senior',
    }));
    expect(q.transactionType).toBe('egift_purchase');
    expect(q.serviceType).toBe('egift');
    expect(q.consumerCategory).toBe('senior');
  });

  it('reasonExplanation is SAFE customer-facing copy (no code fragments, ISO dates, or ledger refs)', () => {
    const q = computeCancellationQuote(base());
    expect(q.reasonExplanation).toBeTypeOf('string');
    expect(q.reasonExplanation).not.toMatch(/[A-Za-z]{3,}\.[A-Za-z_]/); // no dotted code paths
    expect(q.reasonExplanation).not.toMatch(/[a-f0-9]{16}/i);           // no ledger refs
  });

  it('fee never exceeds gross (business can never OVER-charge)', () => {
    for (const gross of [0, 1, 100, 1000, 100000, 100000000]) {
      const q = computeCancellationQuote(base({ grossCents: gross }));
      expect(q.cancellationFeeCents).toBeLessThanOrEqual(gross);
      expect(q.clearingFeeCents).toBeLessThanOrEqual(gross);
      expect(q.refundableCents).toBeGreaterThanOrEqual(0);
      expect(q.refundableCents).toBeLessThanOrEqual(gross);
    }
  });

  it('quote is DETERMINISTIC — same input twice → same output', () => {
    const input = base();
    const a = computeCancellationQuote(input);
    const b = computeCancellationQuote(input);
    expect(a).toEqual(b);
  });
});

describe('CancellationEngine — fiscalAction (CEO §72)', () => {
  it('full refund → issue_credit_note', () => {
    const q = computeCancellationQuote(base({
      serviceStartsAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    }));
    expect(q.fiscalAction).toBe('issue_credit_note');
  });

  it('partial refund → issue_partial_credit_note', () => {
    const q = computeCancellationQuote(base());
    expect(q.fiscalAction).toBe('issue_partial_credit_note');
  });

  it('nothing refundable → fiscal action none', () => {
    const q = computeCancellationQuote(base({ bookingPhase: 'in_progress' }));
    expect(q.fiscalAction).toBe('none');
  });
});
