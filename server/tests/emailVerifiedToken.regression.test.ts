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
    const token = mintEmailVerifiedToken('User@Example.com', 'login');
    const r = validateEmailVerifiedToken(token, ['login']);
    expect(r.valid).toBe(true);
    expect(r.email).toBe('user@example.com'); // normalized lowercase
  });

  it('rejects a tampered signature (cannot forge a session for any email)', async () => {
    const { mintEmailVerifiedToken, validateEmailVerifiedToken } = await load();
    const token = mintEmailVerifiedToken('victim@example.com', 'login');
    // Flip a MID-token char, not the last one: unpadded base64url discards the
    // final char's low bits, so a last-char "flip" decodes to the SAME bytes
    // whenever the HMAC ends in hex '0' (~1 in 16 mints) — that was the
    // "load-flaky" failure. A mid-token char always carries 6 significant
    // bits, so this tamper deterministically breaks the HMAC.
    const i = 10;
    const tampered = token.slice(0, i) + (token[i] === 'A' ? 'B' : 'A') + token.slice(i + 1);
    const r = validateEmailVerifiedToken(tampered, ['login']);
    expect(r.valid).toBe(false);
  });

  it('rejects a token forged for a different email (no signature)', async () => {
    const { validateEmailVerifiedToken } = await load();
    // Purpose-bound wire shape: email:purpose:nonce:issuedAt:hmac
    const forged = Buffer.from('attacker@evil.com:login:deadbeef:' + Date.now() + ':' + 'f'.repeat(64), 'utf8').toString('base64url');
    const r = validateEmailVerifiedToken(forged, ['login']);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('bad_signature');
  });

  it('rejects an expired token (> 5 min old)', async () => {
    const crypto = await import('node:crypto');
    const { validateEmailVerifiedToken } = await load();
    const email = 'old@example.com';
    const nonce = 'abcd1234';
    const issuedAt = Date.now() - (6 * 60 * 1000); // 6 minutes ago
    const payload = `${email}:login:${nonce}:${issuedAt}`;
    const hmac = crypto.createHmac('sha256', process.env.COOKIE_SECRET!).update(payload).digest('hex');
    const token = Buffer.from(`${payload}:${hmac}`, 'utf8').toString('base64url');
    const r = validateEmailVerifiedToken(token, ['login']);
    expect(r.valid).toBe(false);
    // TTL is checked before the purpose match, so an old token reads as
    // expired rather than as a purpose problem — the honest reason.
    expect(r.reason).toBe('expired');
  });

  it('rejects empty / malformed input', async () => {
    const { validateEmailVerifiedToken } = await load();
    expect(validateEmailVerifiedToken('', ['login']).valid).toBe(false);
    expect(validateEmailVerifiedToken('not-a-token', ['login']).valid).toBe(false);
  });

  /**
   * 2026-09-08 — the proof carries WHAT was confirmed, not only WHO.
   *
   * The token used to bind the address alone, so the proof minted from a
   * `signup` code and the proof minted from a `login` code were byte-identical
   * in meaning. Nothing downstream could tell what the customer had actually
   * been asked. The route's z.enum(['signup','login']) was the only thing
   * standing between that and a cross-purpose hole — an allowlist, not a
   * binding.
   */
  describe('purpose binding', () => {
    it('a signup proof does not satisfy a login-only consumer', async () => {
      const { mintEmailVerifiedToken, validateEmailVerifiedToken } = await load();
      const token = mintEmailVerifiedToken('user@example.com', 'signup');
      const r = validateEmailVerifiedToken(token, ['login']);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('purpose_mismatch');
    });

    it('a login proof does not satisfy a signup-only consumer', async () => {
      const { mintEmailVerifiedToken, validateEmailVerifiedToken } = await load();
      const token = mintEmailVerifiedToken('user@example.com', 'login');
      const r = validateEmailVerifiedToken(token, ['signup']);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('purpose_mismatch');
    });

    it('a consumer that accepts both still gets told which one it was', async () => {
      const { mintEmailVerifiedToken, validateEmailVerifiedToken } = await load();
      const token = mintEmailVerifiedToken('user@example.com', 'signup');
      const r = validateEmailVerifiedToken(token, ['signup', 'login']);
      expect(r.valid).toBe(true);
      expect(r.purpose).toBe('signup');
    });

    it('the purpose is inside the signature — swapping it invalidates the token', async () => {
      const { mintEmailVerifiedToken, validateEmailVerifiedToken } = await load();
      const token = mintEmailVerifiedToken('user@example.com', 'login');
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const swapped = Buffer.from(decoded.replace(':login:', ':signup:'), 'utf8').toString('base64url');
      const r = validateEmailVerifiedToken(swapped, ['signup']);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('bad_signature');
    });

    it('refuses to answer without being told what the proof is for', async () => {
      const { mintEmailVerifiedToken, validateEmailVerifiedToken } = await load();
      const token = mintEmailVerifiedToken('user@example.com', 'login');
      const r = validateEmailVerifiedToken(token, [] as any);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('no_accepted_purposes');
    });

    it('an old unbound (4-part) token is refused, not assumed', async () => {
      const { validateEmailVerifiedToken } = await load();
      const crypto = await import('crypto');
      const secret = process.env.COOKIE_SECRET!;
      const payload = 'user@example.com:deadbeefdeadbeef:' + Date.now();
      const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const legacy = Buffer.from(`${payload}:${hmac}`, 'utf8').toString('base64url');
      const r = validateEmailVerifiedToken(legacy, ['login']);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe('purpose_missing');
    });
  });
});
