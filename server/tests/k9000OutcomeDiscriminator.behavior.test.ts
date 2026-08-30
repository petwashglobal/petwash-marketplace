/**
 * K9000OutcomeDiscriminator — Program 17.
 */
import { describe, it, expect } from 'vitest';
import { discriminateK9000 } from '../services/marketplace/K9000OutcomeDiscriminator';

describe('K9000OutcomeDiscriminator', () => {
  it('both success → RECEIPT_ONLY, no escalation', () => {
    const out = discriminateK9000({ payment: 'AUTHORIZED_AND_CAPTURED', machine: 'WASH_DELIVERED' });
    expect(out.verdict).toBe('RECEIPT_ONLY');
    expect(out.supportEscalation).toBe(false);
  });

  it('paid + wash failed → REFUND_PATH with escalation (§12 discipline)', () => {
    const out = discriminateK9000({ payment: 'AUTHORIZED_AND_CAPTURED', machine: 'WASH_FAILED' });
    expect(out.verdict).toBe('REFUND_PATH');
    expect(out.reasonCode).toBe('PAID_BUT_WASH_FAILED');
    expect(out.supportEscalation).toBe(true);
  });

  it('payment failed + wash never started → PAYMENT_ONLY_ISSUE, no escalation needed', () => {
    const out = discriminateK9000({ payment: 'FAILED', machine: 'WASH_NEVER_STARTED' });
    expect(out.verdict).toBe('PAYMENT_ONLY_ISSUE');
    expect(out.supportEscalation).toBe(false);
  });

  it('payment failed + machine unknown → still PAYMENT_ONLY_ISSUE', () => {
    expect(discriminateK9000({ payment: 'FAILED', machine: 'UNKNOWN' }).verdict).toBe('PAYMENT_ONLY_ISSUE');
  });

  it('authorized-not-captured + wash delivered → RECONCILIATION_REQUIRED', () => {
    const out = discriminateK9000({ payment: 'AUTHORIZED_NOT_CAPTURED', machine: 'WASH_DELIVERED' });
    expect(out.verdict).toBe('RECONCILIATION_REQUIRED');
    expect(out.supportEscalation).toBe(true);
  });

  it('paid + machine unknown → RECONCILIATION_REQUIRED (do not treat as receipt)', () => {
    expect(discriminateK9000({ payment: 'AUTHORIZED_AND_CAPTURED', machine: 'UNKNOWN' }).verdict).toBe('RECONCILIATION_REQUIRED');
  });

  it('unknown payment + wash delivered → RECONCILIATION_REQUIRED', () => {
    expect(discriminateK9000({ payment: 'UNKNOWN', machine: 'WASH_DELIVERED' }).verdict).toBe('RECONCILIATION_REQUIRED');
  });
});
