/**
 * PaymentResumeResolver — task #151 (CEO §12).
 *
 * The resume-time evaluator that keeps "PAY_AGAIN" off the table.
 */
import { describe, it, expect } from 'vitest';
import {
  resolvePaymentResume,
  type PaymentResumeVerdict,
} from '../services/marketplace/PaymentResumeResolver';
import type { UncertaintyVerdict } from '../services/marketplace/PaymentUncertaintyResolver';

describe('PaymentResumeResolver', () => {
  it('PRE_PAYMENT is always SAFE_TO_PROCEED', () => {
    const v = resolvePaymentResume({ phase: 'PRE_PAYMENT' });
    expect(v.code).toBe('SAFE_TO_PROCEED');
    if (v.code !== 'SAFE_TO_PROCEED') throw new Error();
    expect(v.reasonCode).toBe('PRE_PAYMENT_NO_CHARGE_YET');
  });

  it('POST_PAYMENT is always RESUME_POST_PAYMENT (no re-charge)', () => {
    const v = resolvePaymentResume({ phase: 'POST_PAYMENT' });
    expect(v.code).toBe('RESUME_POST_PAYMENT');
  });

  it('PAYMENT_IN_FLIGHT without an uncertaintyVerdict REFUSES to answer (fail-CLOSED)', () => {
    const v = resolvePaymentResume({ phase: 'PAYMENT_IN_FLIGHT' });
    expect(v.code).toBe('REFUSE_ANSWER');
    if (v.code !== 'REFUSE_ANSWER') throw new Error();
    expect(v.reasonCode).toBe('UNCERTAINTY_VERDICT_REQUIRED_FOR_IN_FLIGHT');
  });

  it('PAYMENT_IN_FLIGHT + PAID → RESUME_POST_PAYMENT (money moved, finish the tail)', () => {
    const u: UncertaintyVerdict = { code: 'PAID', reasonCode: 'GATEWAY_AND_LEDGER_AGREE' };
    const v = resolvePaymentResume({ phase: 'PAYMENT_IN_FLIGHT', uncertaintyVerdict: u });
    expect(v.code).toBe('RESUME_POST_PAYMENT');
    if (v.code !== 'RESUME_POST_PAYMENT') throw new Error();
    expect(v.reasonCode).toBe('POST_PAYMENT_LEDGER_CAPTURED');
  });

  it('PAYMENT_IN_FLIGHT + FAILED → MUST_CHECK_STATUS_FIRST (never silent re-charge)', () => {
    const u: UncertaintyVerdict = { code: 'FAILED', reasonCode: 'GATEWAY_AND_LEDGER_AGREE_FAILED' };
    const v = resolvePaymentResume({ phase: 'PAYMENT_IN_FLIGHT', uncertaintyVerdict: u });
    expect(v.code).toBe('MUST_CHECK_STATUS_FIRST');
  });

  it('PAYMENT_IN_FLIGHT + RECONCILE_STATUS → MUST_CHECK_STATUS_FIRST', () => {
    const u: UncertaintyVerdict = { code: 'RECONCILE_STATUS', reasonCode: 'PAYMENT_STATUS_UNCLEAR_SHORT_WINDOW' };
    const v = resolvePaymentResume({ phase: 'PAYMENT_IN_FLIGHT', uncertaintyVerdict: u });
    expect(v.code).toBe('MUST_CHECK_STATUS_FIRST');
    if (v.code !== 'MUST_CHECK_STATUS_FIRST') throw new Error();
    expect(v.reasonCode).toBe('PAYMENT_IN_FLIGHT_RECONCILE_WINDOW');
  });

  it('PAYMENT_IN_FLIGHT + ESCALATE_SUPPORT(GATEWAY_LEDGER_DISAGREE) preserves the disagreement reason', () => {
    const u: UncertaintyVerdict = { code: 'ESCALATE_SUPPORT', reasonCode: 'GATEWAY_LEDGER_DISAGREE' };
    const v = resolvePaymentResume({ phase: 'PAYMENT_IN_FLIGHT', uncertaintyVerdict: u });
    expect(v.code).toBe('ESCALATE_SUPPORT');
    if (v.code !== 'ESCALATE_SUPPORT') throw new Error();
    expect(v.reasonCode).toBe('GATEWAY_LEDGER_DISAGREE');
  });

  it('PAYMENT_IN_FLIGHT + ESCALATE_SUPPORT(LONG_WINDOW) → ESCALATE_SUPPORT / UNCERTAINTY_LONG_WINDOW', () => {
    const u: UncertaintyVerdict = { code: 'ESCALATE_SUPPORT', reasonCode: 'PAYMENT_STATUS_UNCLEAR_LONG_WINDOW' };
    const v = resolvePaymentResume({ phase: 'PAYMENT_IN_FLIGHT', uncertaintyVerdict: u });
    expect(v.code).toBe('ESCALATE_SUPPORT');
    if (v.code !== 'ESCALATE_SUPPORT') throw new Error();
    expect(v.reasonCode).toBe('UNCERTAINTY_LONG_WINDOW');
  });

  it('NEVER emits a "PAY_AGAIN" verdict — this is the whole point', () => {
    const inputs: Array<[
      Parameters<typeof resolvePaymentResume>[0]['phase'],
      UncertaintyVerdict | undefined,
    ]> = [
      ['PRE_PAYMENT', undefined],
      ['POST_PAYMENT', undefined],
      ['PAYMENT_IN_FLIGHT', { code: 'PAID', reasonCode: 'GATEWAY_AND_LEDGER_AGREE' }],
      ['PAYMENT_IN_FLIGHT', { code: 'FAILED', reasonCode: 'GATEWAY_AND_LEDGER_AGREE_FAILED' }],
      ['PAYMENT_IN_FLIGHT', { code: 'RECONCILE_STATUS', reasonCode: 'PAYMENT_STATUS_UNCLEAR_SHORT_WINDOW' }],
      ['PAYMENT_IN_FLIGHT', { code: 'ESCALATE_SUPPORT', reasonCode: 'GATEWAY_LEDGER_DISAGREE' }],
    ];
    for (const [phase, u] of inputs) {
      const v: PaymentResumeVerdict = resolvePaymentResume({ phase, uncertaintyVerdict: u });
      expect(JSON.stringify(v)).not.toContain('PAY_AGAIN');
    }
  });
});
