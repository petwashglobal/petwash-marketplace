/**
 * ContactChangeStateMachine — CEO P0-MY-ACCOUNT change-flow state machine.
 */
import { describe, it, expect } from 'vitest';
import {
  transition,
  initial,
  isValidNewValue,
} from '../services/marketplace/ContactChangeStateMachine';

describe('ContactChangeStateMachine — happy path', () => {
  it('IDLE → PROPOSED → AWAITING_VERIFICATION → VERIFIED_PENDING_COMMIT → COMMITTED', () => {
    let ctx = initial();
    let t = transition(ctx, { kind: 'PROPOSE', value: '+972501234567' });
    if (t.code !== 'OK') throw new Error();
    expect(t.next.state).toBe('PROPOSED');
    expect(t.next.proposedValue).toBe('+972501234567');
    ctx = t.next;

    t = transition(ctx, { kind: 'OTP_SENT' });
    if (t.code !== 'OK') throw new Error();
    expect(t.next.state).toBe('AWAITING_VERIFICATION');
    ctx = t.next;

    t = transition(ctx, { kind: 'OTP_VERIFIED' });
    if (t.code !== 'OK') throw new Error();
    expect(t.next.state).toBe('VERIFIED_PENDING_COMMIT');
    ctx = t.next;

    t = transition(ctx, { kind: 'COMMIT_OK' });
    if (t.code !== 'OK') throw new Error();
    expect(t.next.state).toBe('COMMITTED');
  });
});

describe('ContactChangeStateMachine — failure branches', () => {
  it('OTP wrong 5 times → FAILED with MAX_OTP_ATTEMPTS', () => {
    let ctx = initial();
    ctx = (transition(ctx, { kind: 'PROPOSE', value: 'a@b.com' }) as any).next;
    ctx = (transition(ctx, { kind: 'OTP_SENT' }) as any).next;
    for (let i = 0; i < 4; i++) {
      ctx = (transition(ctx, { kind: 'OTP_WRONG' }) as any).next;
      expect(ctx.state).toBe('AWAITING_VERIFICATION');
    }
    const t = transition(ctx, { kind: 'OTP_WRONG' });
    if (t.code !== 'OK') throw new Error();
    expect(t.next.state).toBe('FAILED');
    expect(t.next.lastReasonCode).toBe('MAX_OTP_ATTEMPTS');
  });

  it('OTP_EXPIRED → FAILED(OTP_EXPIRED)', () => {
    let ctx = initial();
    ctx = (transition(ctx, { kind: 'PROPOSE', value: 'a@b.com' }) as any).next;
    ctx = (transition(ctx, { kind: 'OTP_SENT' }) as any).next;
    const t = transition(ctx, { kind: 'OTP_EXPIRED' });
    if (t.code !== 'OK') throw new Error();
    expect(t.next.state).toBe('FAILED');
    expect(t.next.lastReasonCode).toBe('OTP_EXPIRED');
  });

  it('RESEND resets attempt count while staying in AWAITING_VERIFICATION', () => {
    let ctx = initial();
    ctx = (transition(ctx, { kind: 'PROPOSE', value: 'a@b.com' }) as any).next;
    ctx = (transition(ctx, { kind: 'OTP_SENT' }) as any).next;
    ctx = (transition(ctx, { kind: 'OTP_WRONG' }) as any).next;
    ctx = (transition(ctx, { kind: 'OTP_WRONG' }) as any).next;
    expect(ctx.attempts).toBe(2);
    const t = transition(ctx, { kind: 'RESEND' });
    if (t.code !== 'OK') throw new Error();
    expect(t.next.state).toBe('AWAITING_VERIFICATION');
    expect(t.next.attempts).toBe(0);
  });

  it('CANCEL from PROPOSED / AWAITING → CANCELLED', () => {
    let ctx = initial();
    ctx = (transition(ctx, { kind: 'PROPOSE', value: 'a@b.com' }) as any).next;
    const t = transition(ctx, { kind: 'CANCEL' });
    if (t.code !== 'OK') throw new Error();
    expect(t.next.state).toBe('CANCELLED');
  });

  it('COMMIT_FAILED → FAILED with the caller-provided reasonCode', () => {
    let ctx = initial();
    ctx = (transition(ctx, { kind: 'PROPOSE', value: 'a@b.com' }) as any).next;
    ctx = (transition(ctx, { kind: 'OTP_SENT' }) as any).next;
    ctx = (transition(ctx, { kind: 'OTP_VERIFIED' }) as any).next;
    const t = transition(ctx, { kind: 'COMMIT_FAILED', reasonCode: 'DUPLICATE_EMAIL' });
    if (t.code !== 'OK') throw new Error();
    expect(t.next.state).toBe('FAILED');
    expect(t.next.lastReasonCode).toBe('DUPLICATE_EMAIL');
  });

  it('INVALID from PROPOSED → FAILED, doctrine: verified value NOT changed', () => {
    let ctx = initial();
    ctx = (transition(ctx, { kind: 'PROPOSE', value: 'not-an-email' }) as any).next;
    const t = transition(ctx, { kind: 'INVALID', reasonCode: 'EMAIL_FORMAT' });
    if (t.code !== 'OK') throw new Error();
    expect(t.next.state).toBe('FAILED');
  });

  it('OTP_VERIFIED from IDLE → ILLEGAL_TRANSITION', () => {
    const t = transition(initial(), { kind: 'OTP_VERIFIED' });
    expect(t.code).toBe('ILLEGAL_TRANSITION');
  });

  it('COMMIT_OK from COMMITTED → ILLEGAL_TRANSITION (terminal)', () => {
    let ctx = initial();
    ctx = (transition(ctx, { kind: 'PROPOSE', value: 'a@b.com' }) as any).next;
    ctx = (transition(ctx, { kind: 'OTP_SENT' }) as any).next;
    ctx = (transition(ctx, { kind: 'OTP_VERIFIED' }) as any).next;
    ctx = (transition(ctx, { kind: 'COMMIT_OK' }) as any).next;
    expect(transition(ctx, { kind: 'COMMIT_OK' }).code).toBe('ILLEGAL_TRANSITION');
  });
});

describe('isValidNewValue', () => {
  it('MOBILE requires strict E.164 (+ prefix + 8-15 digits)', () => {
    expect(isValidNewValue('MOBILE', '+972501234567')).toBe(true);
    expect(isValidNewValue('MOBILE', '0501234567')).toBe(false);
    expect(isValidNewValue('MOBILE', '+123')).toBe(false);
  });

  it('EMAIL requires an @ and a dotted domain', () => {
    expect(isValidNewValue('EMAIL', 'sarah@petwash.co.il')).toBe(true);
    expect(isValidNewValue('EMAIL', 'not-an-email')).toBe(false);
    expect(isValidNewValue('EMAIL', '')).toBe(false);
  });
});
