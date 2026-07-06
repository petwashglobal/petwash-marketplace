/**
 * requireTransactionOtp — step-up enforcement middleware (2026-07-06).
 * Proves the money/security gate is FAIL-CLOSED: only a valid, single-use token
 * bound to the same user AND the expected transaction type lets the action run.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const validateMock = vi.fn();
vi.mock('../services/TransactionOTPService', () => ({
  transactionOTPService: { validateTransactionToken: (...a: any[]) => validateMock(...a) },
}));
vi.mock('../lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { requireTransactionOtp } from '../middleware/requireTransactionOtp';

function mkRes(): any {
  const res: any = { statusCode: 200 };
  res.status = vi.fn((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn((b: any) => { res.body = b; return res; });
  return res;
}

const USER = 'user-123';
const TYPE = 'provider_payout' as const;

beforeEach(() => { validateMock.mockReset(); });

describe('requireTransactionOtp — fail-closed step-up', () => {
  it('401s when unauthenticated', async () => {
    const res = mkRes(); const next = vi.fn();
    await requireTransactionOtp(TYPE)({ headers: {}, body: {} } as any, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('auth_required');
    expect(next).not.toHaveBeenCalled();
  });

  it('401 otp_required when no token is supplied', async () => {
    const res = mkRes(); const next = vi.fn();
    await requireTransactionOtp(TYPE)({ userId: USER, headers: {}, body: {} } as any, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('otp_required');
    expect(res.body.transactionType).toBe(TYPE);
    expect(next).not.toHaveBeenCalled();
    expect(validateMock).not.toHaveBeenCalled();
  });

  it('401 otp_invalid when the token is not valid', async () => {
    validateMock.mockResolvedValue({ valid: false });
    const res = mkRes(); const next = vi.fn();
    await requireTransactionOtp(TYPE)({ userId: USER, headers: { 'x-transaction-otp': 'tok' }, body: {} } as any, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('otp_invalid');
    expect(next).not.toHaveBeenCalled();
  });

  it('401 when the token belongs to a DIFFERENT user', async () => {
    validateMock.mockResolvedValue({ valid: true, userId: 'someone-else', transactionType: TYPE });
    const res = mkRes(); const next = vi.fn();
    await requireTransactionOtp(TYPE)({ userId: USER, headers: { 'x-transaction-otp': 'tok' }, body: {} } as any, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401 when the token is for a DIFFERENT transaction type', async () => {
    validateMock.mockResolvedValue({ valid: true, userId: USER, transactionType: 'wallet_topup' });
    const res = mkRes(); const next = vi.fn();
    await requireTransactionOtp(TYPE)({ userId: USER, headers: { 'x-transaction-otp': 'tok' }, body: {} } as any, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() only for a valid token bound to the same user + type', async () => {
    validateMock.mockResolvedValue({ valid: true, userId: USER, transactionType: TYPE });
    const res = mkRes(); const next = vi.fn();
    const req: any = { userId: USER, headers: { 'x-transaction-otp': 'tok' }, body: {} };
    await requireTransactionOtp(TYPE)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.transactionOtpVerified?.transactionType).toBe(TYPE);
  });

  it('also accepts the token from the request body', async () => {
    validateMock.mockResolvedValue({ valid: true, userId: USER, transactionType: TYPE });
    const res = mkRes(); const next = vi.fn();
    await requireTransactionOtp(TYPE)({ userId: USER, headers: {}, body: { transactionToken: 'tok' } } as any, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
