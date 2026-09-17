import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Live 2026-09-17 (production, signed-out /signin): every passkey failure
 * report was rejected — 403 EBADCSRFTOKEN (Firebase Hosting strips the
 * pw.csrf cookie, so an anonymous caller can never pass the double-submit)
 * AND, underneath, 400 because the client sent authMethod "Face ID" where the
 * server accepts face_id. Not one biometric failure was ever recorded.
 */
const recordEvent = vi.fn(async () => ({ ok: true }));
vi.mock('../services/AuditLedgerService', () => ({ AuditLedgerService: { recordEvent } }));
vi.mock('../middleware/rateLimiterRedisStore', () => ({ redisRateLimitStore: () => undefined }));
vi.mock('../middleware/rbac', () => ({
  requireAdmin: (_q: any, _s: any, n: any) => n(),
  isSuperAdminVerified: () => false,
}));
vi.mock('../middleware/firebase-auth', () => ({ validateFirebaseToken: (_q: any, _s: any, n: any) => n() }));

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

async function app(withUid?: string) {
  const { default: router } = await import('../routes/audit');
  const a = express();
  a.use(express.json());
  a.use((req: any, _res, next) => { if (withUid) req.firebaseUser = { uid: withUid }; next(); });
  a.use('/api/audit', router);
  return a;
}

beforeEach(() => recordEvent.mockClear());

describe('the passkey failure report reaches the ledger', () => {
  it('an anonymous report with a canonical method is recorded once, as unauthenticated', async () => {
    const res = await request(await app()).post('/api/audit/record-biometric-failure').send({
      errorType: 'NotAllowedError', errorMessage: 'no matching credential', isCanceled: false, authMethod: 'face_id',
      metadata: { browser: 'Safari', platform: 'iPhone', timestamp: new Date().toISOString(), junk: 'x'.repeat(5000) },
    });
    expect(res.status).toBeLessThan(300);
    expect(recordEvent).toHaveBeenCalledTimes(1);
    const ev = recordEvent.mock.calls[0][0] as any;
    expect(ev.eventType).toBe('auth_biometric_failure');
    expect(ev.userId).toBe('unauthenticated');
    expect(JSON.stringify(ev)).not.toContain('x'.repeat(100)); // unknown metadata keys are stripped
  });

  it('the uid comes only from a verified token, never from the body', async () => {
    await request(await app('verified-uid')).post('/api/audit/record-biometric-failure').send({
      errorType: 'SecurityError', authMethod: 'passkey', userId: 'someone-else',
    });
    expect((recordEvent.mock.calls[0][0] as any).userId).toBe('verified-uid');
  });

  it('oversized or malformed input is refused and records nothing', async () => {
    const a = await app();
    expect((await request(a).post('/api/audit/record-biometric-failure').send({ errorType: 'E', errorMessage: 'y'.repeat(301) })).status).toBe(400);
    expect((await request(a).post('/api/audit/record-biometric-failure').send({ errorType: 'E', authMethod: 'Face ID' })).status).toBe(400);
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

describe('wiring', () => {
  it('the endpoint is CSRF-exempt (anonymous by nature) and rate-limited', () => {
    const idx = R('server/index.ts');
    const set = idx.slice(idx.indexOf('const AUTH_CSRF_EXEMPT = new Set(['), idx.indexOf(']);', idx.indexOf('const AUTH_CSRF_EXEMPT = new Set([')));
    expect(set).toContain("'/api/audit/record-biometric-failure'");
    expect(R('server/routes/audit.ts')).toContain("router.post('/record-biometric-failure', biometricFailureLimiter,");
  });

  it('the client sends the canonical method name and skips the probe\'s unsupported/cancel outcomes', () => {
    const src = R('client/src/auth/passkey.ts');
    expect(src).toContain('authMethod: toAuditMethod(authMethod),');
    expect(src).toContain("if (opts.silent && (isCanceled || errorType === 'NotSupportedError')) return;");
  });

  it('toAuditMethod maps display names to the server enum', async () => {
    const src = R('client/src/auth/passkey.ts');
    const body = src.slice(src.indexOf('function toAuditMethod('), src.indexOf('async function logBiometricFailure('));
    // eslint-disable-next-line no-new-func
    const fn = new Function(`${body.replace(/: 'passkey' \| 'face_id' \| 'touch_id' \| 'windows_hello' \| 'biometric'/, '').replace('(name: string)', '(name)')}; return toAuditMethod;`)();
    expect(fn('Face ID')).toBe('face_id');
    expect(fn('Touch ID')).toBe('touch_id');
    expect(fn('Windows Hello')).toBe('windows_hello');
    expect(fn('Biometric')).toBe('biometric');
    expect(fn('something odd')).toBe('passkey');
  });
});
