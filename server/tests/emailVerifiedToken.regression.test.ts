import { describe, it, expect, beforeAll } from 'vitest';

// Deterministic secret so the HMAC is stable across the test run.
beforeAll(() => { process.env.COOKIE_SECRET = 'test-cookie-secret-emailverified-0123456789'; });

// Import AFTER the env is set so the module reads the test secret.
async function load() {
  return await import('../lib/emailVerifiedToken');
}

describe('emailVerifiedToken — passwordless email login proof', () => {
  it('round-trips a valid token and returns the normalized email', async () => {
    const { mintEmailVerifiedToken, validateEmailVerifiedToken } = await load();
    const token = mintEmailVerifiedToken('User@Example.com');
    const r = validateEmailVerifiedToken(token);
    expect(r.valid).toBe(true);
    expect(r.email).toBe('user@example.com'); // normalized lowercase
  });

  it('rejects a tampered signature (cannot forge a session for any email)', async () => {
    const { mintEmailVerifiedToken, validateEmailVerifiedToken } = await load();
    const token = mintEmailVerifiedToken('victim@example.com');
    // Flip a MID-token char, not the last one: unpadded base64url discards the
    // final char's low bits, so a last-char "flip" decodes to the SAME bytes
    // whenever the HMAC ends in hex '0' (~1 in 16 mints) — that was the
    // "load-flaky" failure. A mid-token char always carries 6 significant
    // bits, so this tamper deterministically breaks the HMAC.
    const i = 10;
    const tampered = token.slice(0, i) + (token[i] === 'A' ? 'B' : 'A') + token.slice(i + 1);
    const r = validateEmailVerifiedToken(tampered);
    expect(r.valid).toBe(false);
  });

  it('rejects a token forged for a different email (no signature)', async () => {
    const { validateEmailVerifiedToken } = await load();
    const forged = Buffer.from('attacker@evil.com:deadbeef:' + Date.now() + ':' + 'f'.repeat(64), 'utf8').toString('base64url');
    const r = validateEmailVerifiedToken(forged);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('bad_signature');
  });

  it('rejects an expired token (> 5 min old)', async () => {
    const crypto = await import('node:crypto');
    const { validateEmailVerifiedToken } = await load();
    const email = 'old@example.com';
    const nonce = 'abcd1234';
    const issuedAt = Date.now() - (6 * 60 * 1000); // 6 minutes ago
    const payload = `${email}:${nonce}:${issuedAt}`;
    const hmac = crypto.createHmac('sha256', process.env.COOKIE_SECRET!).update(payload).digest('hex');
    const token = Buffer.from(`${payload}:${hmac}`, 'utf8').toString('base64url');
    const r = validateEmailVerifiedToken(token);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('expired');
  });

  it('rejects empty / malformed input', async () => {
    const { validateEmailVerifiedToken } = await load();
    expect(validateEmailVerifiedToken('').valid).toBe(false);
    expect(validateEmailVerifiedToken('not-a-token').valid).toBe(false);
  });
});
