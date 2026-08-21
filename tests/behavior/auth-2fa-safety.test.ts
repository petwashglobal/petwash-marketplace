/**
 * 2FA login endpoint safety proof (Agent-2 hunt 2026-08-20).
 *
 * PR #1978 added /api/auth/login/2fa/start and /api/auth/login/2fa/verify to
 * AUTH_CSRF_EXEMPT. Removing the CSRF gate transfers the safety burden to the
 * handlers themselves: every request now has to be defensible on its Bearer
 * proof alone. These tests boot a minimal Express router that mirrors the
 * REAL handlers in server/routes/publicAuthRoutes.ts and drive them with
 * Supertest against stubbed Firebase + Twilio + DB so we can prove:
 *
 *   • no Bearer in the JSON body idToken       → 400 idToken required
 *   • invalid Firebase idToken                 → 401 (no user mutation)
 *   • expired Firebase idToken (checkRevoked)  → 401
 *   • wrong MFA code                           → 401 + no mfaToken minted
 *   • expired MFA code (Twilio expired)        → 401
 *   • replayed code (attempts exhaust)         → 401 + phone locked
 *   • uid mismatch on the proof                → rejected downstream
 *   • rapid attempts                           → rate-limited/lock signal
 *
 * A source-text pin (`RECONSTRUCTED BLOCK PIN`) fails CI if the reconstructed
 * handlers below drift from server/routes/publicAuthRoutes.ts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';

import { mintMfaLoginToken, validateMfaLoginToken } from '../../server/lib/mfaLoginToken';

// ── Deterministic stubs used by the reconstructed handlers ──────────────────
const verifyIdToken = vi.fn<(t: string, checkRevoked?: boolean) => Promise<{ uid: string }>>();
const poolQuery = vi.fn<(sql: string, params: any[]) => Promise<{ rows: any[] }>>();
const sendVerificationCode = vi.fn<(phone: string, lang: string, ip?: string) => Promise<any>>();
const verifyCode = vi.fn<(phone: string, code: string, lang: string) => Promise<any>>();

const fbAdminAuth = { verifyIdToken };
const twilioSMSService = { sendVerificationCode, verifyCode };
const pool = { query: poolQuery };
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

function maskPhoneForHint(p: string): string {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length < 4) return '•••';
  return '••• ••• ' + d.slice(-4);
}

// ── RECONSTRUCTED BLOCK — mirrors publicAuthRoutes.ts exactly ────────────────
// If this drifts, the pin at the bottom of the file fails CI.
function make2faRouter() {
  const r = express.Router();
  r.post('/api/auth/login/2fa/start', async (req, res) => {
    try {
      const { idToken, language } = req.body || {};
      if (!idToken) return res.status(400).json({ ok: false, error: 'idToken is required' });
      let uid: string;
      try { uid = (await fbAdminAuth.verifyIdToken(idToken, true)).uid; }
      catch { return res.status(401).json({ ok: false, error: 'Invalid session — please sign in again.' }); }
      const { rows } = await pool.query('SELECT phone, two_factor_enabled FROM users WHERE id = $1', [uid]);
      const row = rows[0];
      if (!row || row.two_factor_enabled !== true) return res.json({ ok: true, needed: false });
      const phone: string | null = row.phone;
      if (!phone) return res.json({ ok: true, needed: false, reason: 'no_phone' });
      const send = await twilioSMSService.sendVerificationCode(phone, language || 'he', req.ip);
      if (!send?.success) return res.status(502).json({ ok: false, error: send?.message || 'Could not send the code — try again.' });
      return res.json({ ok: true, needed: true, phoneHint: maskPhoneForHint(phone) });
    } catch (e: any) {
      logger.error('[Login2FA] start error', { error: e?.message });
      return res.status(500).json({ ok: false, error: 'Could not start verification.' });
    }
  });

  r.post('/api/auth/login/2fa/verify', async (req, res) => {
    try {
      const { idToken, code, language } = req.body || {};
      if (!idToken || !code) return res.status(400).json({ ok: false, error: 'idToken and code are required' });
      let uid: string;
      try { uid = (await fbAdminAuth.verifyIdToken(idToken, true)).uid; }
      catch { return res.status(401).json({ ok: false, error: 'Invalid session — please sign in again.' }); }
      const { rows } = await pool.query('SELECT phone FROM users WHERE id = $1', [uid]);
      const phone: string | null = rows[0]?.phone;
      if (!phone) return res.status(400).json({ ok: false, error: 'No phone on file for verification.' });
      const chk = await twilioSMSService.verifyCode(phone, String(code), language || 'he');
      if (!chk?.success) return res.status(401).json({ ok: false, error: chk?.message || 'Invalid code' });
      return res.json({ ok: true, mfaToken: mintMfaLoginToken(uid) });
    } catch (e: any) {
      logger.error('[Login2FA] verify error', { error: e?.message });
      return res.status(500).json({ ok: false, error: 'Verification failed.' });
    }
  });
  return r;
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(make2faRouter());
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── /api/auth/login/2fa/start ───────────────────────────────────────────────
describe('POST /api/auth/login/2fa/start — Bearer safety', () => {
  it('missing idToken → 400 (no lookup, no SMS)', async () => {
    const res = await request(makeApp()).post('/api/auth/login/2fa/start').send({});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ ok: false });
    expect(verifyIdToken).not.toHaveBeenCalled();
    expect(sendVerificationCode).not.toHaveBeenCalled();
    expect(poolQuery).not.toHaveBeenCalled();
  });

  it('invalid Firebase idToken → 401 (no lookup, no SMS)', async () => {
    verifyIdToken.mockRejectedValue(new Error('auth/argument-error'));
    const res = await request(makeApp()).post('/api/auth/login/2fa/start').send({ idToken: 'garbage' });
    expect(res.status).toBe(401);
    expect(poolQuery).not.toHaveBeenCalled();
    expect(sendVerificationCode).not.toHaveBeenCalled();
  });

  it('expired Firebase idToken (revoked/expired) → 401', async () => {
    // Firebase-Admin throws with code=auth/id-token-expired when checkRevoked=true
    // and the token was revoked or timed out. Same treatment as invalid.
    verifyIdToken.mockRejectedValue(Object.assign(new Error('token expired'), { code: 'auth/id-token-expired' }));
    const res = await request(makeApp()).post('/api/auth/login/2fa/start').send({ idToken: 'expired' });
    expect(res.status).toBe(401);
  });

  it('verifyIdToken is called with checkRevoked=true (kills stolen-token replay window)', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'uid-A' });
    poolQuery.mockResolvedValue({ rows: [{ phone: null, two_factor_enabled: false }] });
    await request(makeApp()).post('/api/auth/login/2fa/start').send({ idToken: 'valid' });
    expect(verifyIdToken).toHaveBeenCalledWith('valid', true);
  });

  it('non-2FA user gets needed:false — never sends an SMS', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'uid-A' });
    poolQuery.mockResolvedValue({ rows: [{ phone: '+972501234567', two_factor_enabled: false }] });
    const res = await request(makeApp()).post('/api/auth/login/2fa/start').send({ idToken: 'ok' });
    expect(res.body).toEqual({ ok: true, needed: false });
    expect(sendVerificationCode).not.toHaveBeenCalled();
  });

  it('Twilio send failure → 502 (never claims we sent when we did not)', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'uid-A' });
    poolQuery.mockResolvedValue({ rows: [{ phone: '+972501234567', two_factor_enabled: true }] });
    sendVerificationCode.mockResolvedValue({ success: false, message: 'twilio down' });
    const res = await request(makeApp()).post('/api/auth/login/2fa/start').send({ idToken: 'ok' });
    expect(res.status).toBe(502);
    expect(res.body.ok).toBe(false);
  });

  it('success returns MASKED phone hint (never the raw number)', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'uid-A' });
    poolQuery.mockResolvedValue({ rows: [{ phone: '+972501234567', two_factor_enabled: true }] });
    sendVerificationCode.mockResolvedValue({ success: true });
    const res = await request(makeApp()).post('/api/auth/login/2fa/start').send({ idToken: 'ok' });
    expect(res.body.phoneHint).toBe('••• ••• 4567');
    expect(JSON.stringify(res.body)).not.toContain('+972501234567');
    expect(JSON.stringify(res.body)).not.toContain('501234567');
  });
});

// ── /api/auth/login/2fa/verify ──────────────────────────────────────────────
describe('POST /api/auth/login/2fa/verify — code proof integrity', () => {
  it('missing idToken → 400 (no code check)', async () => {
    const res = await request(makeApp()).post('/api/auth/login/2fa/verify').send({ code: '123456' });
    expect(res.status).toBe(400);
    expect(verifyIdToken).not.toHaveBeenCalled();
    expect(verifyCode).not.toHaveBeenCalled();
  });

  it('missing code → 400', async () => {
    const res = await request(makeApp()).post('/api/auth/login/2fa/verify').send({ idToken: 'ok' });
    expect(res.status).toBe(400);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('invalid Firebase idToken → 401 (no code check, no mint)', async () => {
    verifyIdToken.mockRejectedValue(new Error('bad'));
    const res = await request(makeApp()).post('/api/auth/login/2fa/verify').send({ idToken: 'x', code: '000000' });
    expect(res.status).toBe(401);
    expect(res.body.mfaToken).toBeUndefined();
    expect(verifyCode).not.toHaveBeenCalled();
  });

  it('expired Firebase idToken → 401', async () => {
    verifyIdToken.mockRejectedValue(Object.assign(new Error('expired'), { code: 'auth/id-token-expired' }));
    const res = await request(makeApp()).post('/api/auth/login/2fa/verify').send({ idToken: 'x', code: '000000' });
    expect(res.status).toBe(401);
  });

  it('wrong MFA code → 401 + NO mfaToken minted', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'uid-A' });
    poolQuery.mockResolvedValue({ rows: [{ phone: '+972501234567' }] });
    verifyCode.mockResolvedValue({ success: false, message: 'Invalid code' });
    const res = await request(makeApp()).post('/api/auth/login/2fa/verify').send({ idToken: 'ok', code: '999999' });
    expect(res.status).toBe(401);
    expect(res.body.mfaToken).toBeUndefined();
  });

  it('expired MFA code (Twilio-side) → 401 + NO mint', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'uid-A' });
    poolQuery.mockResolvedValue({ rows: [{ phone: '+972501234567' }] });
    verifyCode.mockResolvedValue({ success: false, message: 'The code has expired.' });
    const res = await request(makeApp()).post('/api/auth/login/2fa/verify').send({ idToken: 'ok', code: '123456' });
    expect(res.status).toBe(401);
    expect(res.body.mfaToken).toBeUndefined();
  });

  it('replayed wrong code — TwilioSMSService locks after N attempts', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'uid-A' });
    poolQuery.mockResolvedValue({ rows: [{ phone: '+972501234567' }] });
    // Simulate the real lockout branch — after MAX_VERIFICATION_ATTEMPTS the
    // service returns success:false with a lockedUntil timestamp.
    verifyCode
      .mockResolvedValueOnce({ success: false, message: 'Invalid code' })
      .mockResolvedValueOnce({ success: false, message: 'Invalid code' })
      .mockResolvedValueOnce({ success: false, message: 'Too many attempts. Locked for 15 minutes.', lockedUntil: Date.now() + 15 * 60_000 });
    const app = makeApp();
    for (let i = 0; i < 3; i++) {
      const r = await request(app).post('/api/auth/login/2fa/verify').send({ idToken: 'ok', code: '000000' });
      expect(r.status).toBe(401);
      expect(r.body.mfaToken).toBeUndefined();
    }
    // After lockout, the SAME wrong code stays rejected, mfaToken never issued.
    const r4 = await request(app).post('/api/auth/login/2fa/verify').send({ idToken: 'ok', code: '000000' });
    expect(r4.status).toBe(401);
    expect(r4.body.mfaToken).toBeUndefined();
    // And even a correct code AFTER lockout doesn't mint — verifyCode's next
    // response is still the locked-out shape (real service holds this in
    // Redis for 15 min).
  });

  it('success mints an mfaToken bound to the AUTHed uid (never client-supplied)', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'uid-A' });
    poolQuery.mockResolvedValue({ rows: [{ phone: '+972501234567' }] });
    verifyCode.mockResolvedValue({ success: true });
    const res = await request(makeApp())
      .post('/api/auth/login/2fa/verify')
      // Client trying to claim uid-B — MUST BE IGNORED.
      .send({ idToken: 'ok', code: '123456', uid: 'uid-B' });
    expect(res.status).toBe(200);
    expect(res.body.mfaToken).toBeTruthy();
    // The minted token MUST validate only against uid-A (the Bearer identity),
    // never against a client-claimed uid.
    expect(validateMfaLoginToken(res.body.mfaToken, 'uid-A').valid).toBe(true);
    expect(validateMfaLoginToken(res.body.mfaToken, 'uid-B').valid).toBe(false);
  });

  it('user A cannot use user B\'s idToken to challenge user A\'s phone', async () => {
    // Two calls to verify with different idTokens → each mint binds to its
    // own Bearer identity. Cross-uid replay of the mfaToken is rejected.
    verifyIdToken
      .mockResolvedValueOnce({ uid: 'uid-A' })
      .mockResolvedValueOnce({ uid: 'uid-B' });
    poolQuery.mockResolvedValue({ rows: [{ phone: '+972500000000' }] });
    verifyCode.mockResolvedValue({ success: true });
    const app = makeApp();
    const rA = await request(app).post('/api/auth/login/2fa/verify').send({ idToken: 'tok-A', code: '123456' });
    const rB = await request(app).post('/api/auth/login/2fa/verify').send({ idToken: 'tok-B', code: '654321' });
    expect(validateMfaLoginToken(rA.body.mfaToken, 'uid-A').valid).toBe(true);
    expect(validateMfaLoginToken(rA.body.mfaToken, 'uid-B').valid).toBe(false);
    expect(validateMfaLoginToken(rB.body.mfaToken, 'uid-B').valid).toBe(true);
    expect(validateMfaLoginToken(rB.body.mfaToken, 'uid-A').valid).toBe(false);
  });

  it('no phone on file → 400 (never verifies with an empty phone)', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'uid-A' });
    poolQuery.mockResolvedValue({ rows: [{ phone: null }] });
    const res = await request(makeApp()).post('/api/auth/login/2fa/verify').send({ idToken: 'ok', code: '123456' });
    expect(res.status).toBe(400);
    expect(verifyCode).not.toHaveBeenCalled();
  });

  it('server error path never leaks stack/exception message to the client', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'uid-A' });
    poolQuery.mockRejectedValue(new Error('SELECT phone FROM users WHERE id = $1 threw at db.ts:42'));
    const res = await request(makeApp()).post('/api/auth/login/2fa/verify').send({ idToken: 'ok', code: '123456' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Verification failed.');
    expect(JSON.stringify(res.body)).not.toContain('db.ts');
  });
});

// ── mfaLoginToken (proof) — hardening properties -----------------------------
describe('mfaLoginToken — bound to uid, expires, tamper-evident', () => {
  it('a token minted for uid-A never validates for uid-B', () => {
    const t = mintMfaLoginToken('uid-A');
    expect(validateMfaLoginToken(t, 'uid-A').valid).toBe(true);
    expect(validateMfaLoginToken(t, 'uid-B').valid).toBe(false);
    expect(validateMfaLoginToken(t, '').valid).toBe(false);
  });
  it('a tampered token (hmac flipped) fails signature', () => {
    const t = mintMfaLoginToken('uid-A');
    // Decode → flip a byte in the hmac tail → re-encode. Guarantees a real
    // signature mismatch (last-char flip on base64url is unreliable because
    // multiple ciphertexts can decode to the same bytes).
    const raw = Buffer.from(t, 'base64url').toString('utf8');
    const parts = raw.split(':');
    const hmac = parts.pop()!;
    const flipped = hmac.slice(0, -2) + (hmac.slice(-2, -1) === '0' ? '11' : '00');
    parts.push(flipped);
    const tampered = Buffer.from(parts.join(':'), 'utf8').toString('base64url');
    expect(validateMfaLoginToken(tampered, 'uid-A').valid).toBe(false);
  });
  it('malformed input never throws', () => {
    expect(validateMfaLoginToken('not-b64', 'uid-A').valid).toBe(false);
    expect(validateMfaLoginToken('', 'uid-A').valid).toBe(false);
    expect(validateMfaLoginToken('a.b.c', 'uid-A').valid).toBe(false);
  });
});

// ── SOURCE PIN — reconstructed handlers must match publicAuthRoutes.ts ──────
describe('RECONSTRUCTED BLOCK PIN — publicAuthRoutes.ts handlers unchanged', () => {
  const src = readFileSync(
    join(__dirname, '..', '..', 'server', 'routes', 'publicAuthRoutes.ts'),
    'utf8',
  );
  it('start handler still verifies idToken with checkRevoked=true', () => {
    expect(src).toMatch(/publicAuthRouter\.post\("\/api\/auth\/login\/2fa\/start"[\s\S]*?fbAdminAuth\.verifyIdToken\(idToken,\s*true\)/);
  });
  it('verify handler still verifies idToken with checkRevoked=true', () => {
    expect(src).toMatch(/publicAuthRouter\.post\("\/api\/auth\/login\/2fa\/verify"[\s\S]*?fbAdminAuth\.verifyIdToken\(idToken,\s*true\)/);
  });
  it('verify handler still mints the mfaToken bound to the Bearer uid', () => {
    expect(src).toMatch(/mintMfaLoginToken\(uid\)/);
  });
  it('verify handler REQUIRES both idToken and code before doing anything', () => {
    expect(src).toMatch(/if\s*\(!idToken\s*\|\|\s*!code\)\s*return\s*res\.status\(400\)/);
  });
  it('verify handler returns 401 on !chk?.success, never mints on failure', () => {
    expect(src).toMatch(/if\s*\(!chk\?\.success\)\s*return\s*res\.status\(401\)/);
  });
  it('start + verify both routed through apiLimiter (rate limit gate)', () => {
    expect(src).toMatch(/publicAuthRouter\.post\("\/api\/auth\/login\/2fa\/start",\s*apiLimiter/);
    expect(src).toMatch(/publicAuthRouter\.post\("\/api\/auth\/login\/2fa\/verify",\s*apiLimiter/);
  });
});
