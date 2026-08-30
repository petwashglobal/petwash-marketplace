/**
 * PaymentUncertaintyResolver — CEO §12.
 */
import { describe, it, expect } from 'vitest';
import { resolvePaymentUncertainty } from '../services/marketplace/PaymentUncertaintyResolver';

describe('PaymentUncertaintyResolver — §12 discipline', () => {
  it('gateway captured + ledger captured → PAID', () => {
    const out = resolvePaymentUncertainty({
      gatewayResult: 'CAPTURED_CONFIRMED',
      hasCapturedLedgerRecord: true,
      hasPendingLedgerRecord: false,
      hasFailedLedgerRecord: false,
      hoursSinceInitiated: 0.1,
    });
    expect(out.code).toBe('PAID');
  });

  it('gateway failed + ledger failed → FAILED', () => {
    const out = resolvePaymentUncertainty({
      gatewayResult: 'FAILED',
      hasCapturedLedgerRecord: false,
      hasPendingLedgerRecord: false,
      hasFailedLedgerRecord: true,
      hoursSinceInitiated: 0.1,
    });
    expect(out.code).toBe('FAILED');
  });

  it('gateway captured but ledger has NO capture → ESCALATE_SUPPORT (money integrity)', () => {
    const out = resolvePaymentUncertainty({
      gatewayResult: 'CAPTURED_CONFIRMED',
      hasCapturedLedgerRecord: false,
      hasPendingLedgerRecord: false,
      hasFailedLedgerRecord: false,
      hoursSinceInitiated: 0.1,
    });
    expect(out.code).toBe('ESCALATE_SUPPORT');
    if (out.code !== 'ESCALATE_SUPPORT') throw new Error();
    expect(out.reasonCode).toBe('GATEWAY_LEDGER_DISAGREE');
  });

  it('gateway failed but ledger DOES have capture → ESCALATE_SUPPORT', () => {
    const out = resolvePaymentUncertainty({
      gatewayResult: 'FAILED',
      hasCapturedLedgerRecord: true,
      hasPendingLedgerRecord: false,
      hasFailedLedgerRecord: false,
      hoursSinceInitiated: 0.1,
    });
    expect(out.code).toBe('ESCALATE_SUPPORT');
  });

  it('gateway UNKNOWN inside short window → RECONCILE_STATUS (never PAY_AGAIN)', () => {
    const out = resolvePaymentUncertainty({
      gatewayResult: 'UNKNOWN',
      hasCapturedLedgerRecord: false,
      hasPendingLedgerRecord: true,
      hasFailedLedgerRecord: false,
      hoursSinceInitiated: 6,
    });
    expect(out.code).toBe('RECONCILE_STATUS');
  });

  it('gateway UNKNOWN past 24h → ESCALATE_SUPPORT (long-window)', () => {
    const out = resolvePaymentUncertainty({
      gatewayResult: 'UNKNOWN',
      hasCapturedLedgerRecord: false,
      hasPendingLedgerRecord: true,
      hasFailedLedgerRecord: false,
      hoursSinceInitiated: 48,
    });
    expect(out.code).toBe('ESCALATE_SUPPORT');
    if (out.code !== 'ESCALATE_SUPPORT') throw new Error();
    expect(out.reasonCode).toBe('PAYMENT_STATUS_UNCLEAR_LONG_WINDOW');
  });

  it('gateway NO_RESPONSE inside window → RECONCILE_STATUS (client sees VIEW_PAYMENT_STATUS)', () => {
    const out = resolvePaymentUncertainty({
      gatewayResult: 'NO_RESPONSE',
      hasCapturedLedgerRecord: false,
      hasPendingLedgerRecord: false,
      hasFailedLedgerRecord: false,
      hoursSinceInitiated: 1,
    });
    expect(out.code).toBe('RECONCILE_STATUS');
  });
});
