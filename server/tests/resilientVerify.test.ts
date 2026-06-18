import { describe, it, expect, vi } from 'vitest';
import { verifyIdTokenResilient, isHardTokenError } from '../lib/resilientVerify';

// A fake Firebase Admin verifyIdToken: succeeds only when checkRevoked is the
// value we say the credential supports.
function makeRaw(opts: {
  // error thrown when checkRevoked=true (simulates the broken Identity-Toolkit lookup)
  revokedError?: { code?: string; message?: string };
  // error thrown when checkRevoked=false (simulates a cryptographically bad token)
  baseError?: { code?: string; message?: string };
  decoded?: any;
}) {
  return vi.fn(async (idToken: string, checkRevoked: boolean) => {
    if (checkRevoked && opts.revokedError) throw opts.revokedError;
    if (!checkRevoked && opts.baseError) throw opts.baseError;
    return opts.decoded ?? { uid: 'u1', token: idToken, checkedRevoked: checkRevoked };
  });
}

describe('verifyIdTokenResilient', () => {
  it('returns the decoded token normally when revocation lookup works', async () => {
    const raw = makeRaw({ decoded: { uid: 'ok' } });
    const out = await verifyIdTokenResilient(raw, 'tok', true);
    expect(out).toEqual({ uid: 'ok' });
    expect(raw).toHaveBeenCalledTimes(1);
    expect(raw).toHaveBeenCalledWith('tok', true);
  });

  it('FALLS BACK and accepts when the revocation lookup fails for an infra reason', async () => {
    const onDegrade = vi.fn();
    const raw = makeRaw({
      revokedError: { code: 'auth/internal-error', message: 'getAccountInfo PERMISSION_DENIED' },
      decoded: { uid: 'rescued' },
    });
    const out = await verifyIdTokenResilient(raw, 'tok', true, onDegrade);
    expect(out).toEqual({ uid: 'rescued' });
    // second call must be WITHOUT checkRevoked
    expect(raw).toHaveBeenLastCalledWith('tok', false);
    expect(onDegrade).toHaveBeenCalledWith('auth/internal-error');
  });

  it('STILL REJECTS an expired token even when revocation lookup also fails', async () => {
    // checkRevoked path throws expired; fallback (no-revoke) ALSO throws expired
    const raw = makeRaw({
      revokedError: { code: 'auth/id-token-expired' },
    });
    await expect(verifyIdTokenResilient(raw, 'tok', true)).rejects.toMatchObject({
      code: 'auth/id-token-expired',
    });
    // hard error → no fallback attempt
    expect(raw).toHaveBeenCalledTimes(1);
  });

  it('STILL REJECTS a malformed/wrong-project token (argument-error)', async () => {
    const raw = makeRaw({ revokedError: { code: 'auth/argument-error' } });
    await expect(verifyIdTokenResilient(raw, 'bad', true)).rejects.toMatchObject({
      code: 'auth/argument-error',
    });
    expect(raw).toHaveBeenCalledTimes(1);
  });

  it('STILL REJECTS an explicitly revoked token (lookup succeeded and found revocation)', async () => {
    const raw = makeRaw({ revokedError: { code: 'auth/id-token-revoked' } });
    await expect(verifyIdTokenResilient(raw, 'tok', true)).rejects.toMatchObject({
      code: 'auth/id-token-revoked',
    });
    expect(raw).toHaveBeenCalledTimes(1);
  });

  it('does NOT fall back when caller did not request checkRevoked', async () => {
    const raw = makeRaw({ baseError: { code: 'auth/internal-error' } });
    await expect(verifyIdTokenResilient(raw, 'tok', false)).rejects.toMatchObject({
      code: 'auth/internal-error',
    });
    expect(raw).toHaveBeenCalledTimes(1);
  });

  it('fallback that hits a genuinely bad token still rejects', async () => {
    // infra failure on revoked path, but the token is ALSO cryptographically bad
    const raw = makeRaw({
      revokedError: { code: 'auth/internal-error' },
      baseError: { code: 'auth/argument-error' },
    });
    await expect(verifyIdTokenResilient(raw, 'tok', true)).rejects.toMatchObject({
      code: 'auth/argument-error',
    });
    expect(raw).toHaveBeenCalledTimes(2);
  });
});

describe('isHardTokenError', () => {
  it('classifies token-level errors as hard (no fallback)', () => {
    expect(isHardTokenError('auth/id-token-expired')).toBe(true);
    expect(isHardTokenError('auth/id-token-revoked')).toBe(true);
    expect(isHardTokenError('auth/argument-error')).toBe(true);
    expect(isHardTokenError('auth/user-disabled')).toBe(true);
  });
  it('classifies infra errors as soft (fallback allowed)', () => {
    expect(isHardTokenError('auth/internal-error')).toBe(false);
    expect(isHardTokenError('auth/insufficient-permission')).toBe(false);
    expect(isHardTokenError('')).toBe(false);
    expect(isHardTokenError(undefined)).toBe(false);
  });
});
