import { describe, it, expect, beforeAll } from 'vitest';

// The signed-redeem-token module reads PASS_TOKEN_SECRET at import time, so set it
// BEFORE the dynamic import. >=32 chars or token generation is disabled (fail-closed).
process.env.PASS_TOKEN_SECRET = 'test-pass-token-secret-at-least-32-characters-long';

let mod: typeof import('../lib/signedRedeemToken');
beforeAll(async () => { mod = await import('../lib/signedRedeemToken'); });

describe('K9000 QR redeem token — unique, tamper-proof, single-use ("cannot be used again")', () => {
  it('generates a valid token and verifies it (uid/passSerial round-trip)', () => {
    const token = mod.generateSignedRedeemToken({ userId: 'u123', passSerial: 'PW-1', machineId: 'K9-1' })!;
    expect(token).toBeTruthy();
    const r = mod.verifySignedRedeemToken(token);
    expect(r.valid).toBe(true);
    expect(r.payload?.uid).toBe('u123');
    expect(r.payload?.ps).toBe('PW-1');
    expect(r.payload?.nonce).toBeTruthy();
  });

  it('every token has a UNIQUE nonce', () => {
    const a = mod.verifySignedRedeemToken(mod.generateSignedRedeemToken({ userId: 'u', passSerial: 'p' })!);
    const b = mod.verifySignedRedeemToken(mod.generateSignedRedeemToken({ userId: 'u', passSerial: 'p' })!);
    expect(a.payload!.nonce).not.toBe(b.payload!.nonce);
  });

  it('REJECTS a tampered payload (signature mismatch)', () => {
    const token = mod.generateSignedRedeemToken({ userId: 'u', passSerial: 'p' })!;
    const [payloadB64, sig] = token.split('.');
    // flip the payload to a different uid, keep the old signature
    const evil = Buffer.from(JSON.stringify({ uid: 'attacker', ps: 'p', mid: null, iat: 1, exp: 9999999999, nonce: 'x', v: 1 })).toString('base64url');
    const r = mod.verifySignedRedeemToken(`${evil}.${sig}`);
    expect(r.valid).toBe(false);
    expect(r.error).toBe('INVALID_SIGNATURE');
  });

  it('REJECTS a tampered signature', () => {
    const token = mod.generateSignedRedeemToken({ userId: 'u', passSerial: 'p' })!;
    const r = mod.verifySignedRedeemToken(token.slice(0, -3) + 'AAA');
    expect(r.valid).toBe(false);
    expect(r.error).toBe('INVALID_SIGNATURE');
  });

  it('REJECTS an expired token', () => {
    const token = mod.generateSignedRedeemToken({ userId: 'u', passSerial: 'p', ttlSeconds: -5 })!;
    const r = mod.verifySignedRedeemToken(token);
    expect(r.valid).toBe(false);
    expect(r.error).toBe('EXPIRED');
  });

  it('CANNOT BE USED AGAIN — replay of a consumed nonce is rejected', () => {
    const token = mod.generateSignedRedeemToken({ userId: 'u', passSerial: 'p' })!;
    const first = mod.verifySignedRedeemToken(token);
    expect(first.valid).toBe(true);
    // simulate a successful redemption marking the nonce used
    mod.consumeNonce(first.payload!.nonce);
    // the SAME QR scanned again
    const second = mod.verifySignedRedeemToken(token);
    expect(second.valid).toBe(false);
    expect(second.error).toBe('REPLAYED');
  });

  it('REJECTS garbage / non-token input', () => {
    expect(mod.verifySignedRedeemToken('not-a-token').valid).toBe(false);
    expect(mod.verifySignedRedeemToken('').valid).toBe(false);
  });
});
