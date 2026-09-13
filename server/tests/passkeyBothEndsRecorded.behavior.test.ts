/**
 * Passkey (Face ID / Touch ID) — works BOTH ENDS and every outcome is RECORDED.
 *
 * Production evidence (Cloud Run petwash-api, 30 days to 2026-09-13):
 *   - ZERO requests ever reached POST /api/webauthn/register/options,
 *     /register/verify or /login/verify — nobody has ever enrolled a passkey.
 *   - GET /api/webauthn/credentials: 14x 500,
 *     "9 FAILED_PRECONDITION: The query requires an index" (09-04, 09-09).
 *   - GET /api/auth/webauthn/devices: 404 (alias registered after its target).
 *   - CEO iPhone 07:14Z: discoverable options 200, then the client's failure
 *     beacon POST /api/audit/record-biometric-failure -> 403 invalid csrf token:
 *     the attempt left no record anywhere.
 *
 * Everything below runs through the REAL express handlers
 * (server/webauthn/routes.ts), the REAL WebAuthn service + device registry, the
 * REAL @simplewebauthn verifier (a real P-256 authenticator is simulated), the
 * REAL challenge store logic (in-memory GETDEL backend) and the REAL
 * logSecurityEvent writer. Only Firestore, Firebase Auth token verification,
 * e-mail alerts and geo lookup are faked.
 */
import { PASSKEY_CONSENT_VERSION, PASSKEY_CONSENT_TEXT } from '../../shared/lib/passkeyConsent';
import crypto from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';

const h = vi.hoisted(() => {
  process.env.IP_HASH_SALT = 'test-ip-hash-salt';
  process.env.SUPER_ADMIN_EMAILS = 'owner@petwash.co.il';

  // ── tiny in-memory Firestore ─────────────────────────────────────────────
  const docs = new Map<string, any>();
  let autoId = 0;
  const isIncrement = (v: any) => v && typeof v === 'object' && typeof v.operand === 'number';
  const parentOf = (p: string) => p.slice(0, p.lastIndexOf('/'));
  const idOf = (p: string) => p.slice(p.lastIndexOf('/') + 1);
  const snap = (p: string) => ({ id: idOf(p), exists: docs.has(p), data: () => docs.get(p) });

  const makeDocRef = (p: string): any => ({
    id: idOf(p),
    get: async () => snap(p),
    set: async (data: any, opts?: { merge?: boolean }) => {
      const prev = opts?.merge ? docs.get(p) || {} : {};
      const next: any = { ...prev };
      for (const [k, v] of Object.entries(data)) next[k] = isIncrement(v) ? (prev[k] || 0) + (v as any).operand : v;
      docs.set(p, next);
    },
    update: async (data: any) => {
      if (!docs.has(p)) throw Object.assign(new Error('5 NOT_FOUND'), { code: 5 });
      const prev = docs.get(p);
      const next: any = { ...prev };
      for (const [k, v] of Object.entries(data)) next[k] = isIncrement(v) ? (prev[k] || 0) + (v as any).operand : v;
      docs.set(p, next);
    },
    collection: (name: string) => makeCollection(`${p}/${name}`),
  });

  const makeQuery = (p: string, filters: any[], order: any, lim: number | null): any => ({
    where: (f: string, op: string, v: any) => makeQuery(p, [...filters, [f, op, v]], order, lim),
    orderBy: (f: string, dir = 'asc') => {
      // Production had no composite index for (isRevoked ==, lastUsedAt desc) on
      // webauthnCredentials — reproduce the exact failure mode.
      if (p.endsWith('/webauthnCredentials') && filters.length > 0) {
        throw Object.assign(new Error('9 FAILED_PRECONDITION: The query requires an index.'), { code: 9 });
      }
      return makeQuery(p, filters, [f, dir], lim);
    },
    limit: (n: number) => makeQuery(p, filters, order, n),
    get: async () => {
      let rows = [...docs.keys()]
        .filter((k) => parentOf(k) === p)
        .map((k) => snap(k))
        .filter((s) =>
          filters.every(([f, op, v]) => {
            const val = s.data()[f];
            if (op === '==') return val === v;
            if (op === '>=') return val >= v;
            throw new Error(`fake firestore: op ${op}`);
          }),
        );
      if (order) {
        const [f, dir] = order;
        rows.sort((a, b) => (a.data()[f] > b.data()[f] ? 1 : -1) * (dir === 'desc' ? -1 : 1));
      }
      if (lim !== null) rows = rows.slice(0, lim);
      return { docs: rows, size: rows.length, empty: rows.length === 0, forEach: (fn: any) => rows.forEach(fn) };
    },
  });

  const makeCollection = (p: string): any => ({
    ...makeQuery(p, [], null, null),
    doc: (id: string) => makeDocRef(`${p}/${id}`),
    add: async (data: any) => {
      const id = `auto${++autoId}`;
      docs.set(`${p}/${id}`, data);
      return { id };
    },
  });

  const db = { collection: (name: string) => makeCollection(name) };

  // ── Firebase Auth: ID tokens + session cookies ───────────────────────────
  const TOKENS: Record<string, any> = {
    'token-customer': { uid: 'cust1', email: 'member@example.com', email_verified: true },
    'token-phone': { uid: 'phone1', phone_number: '+972500000001' },
    'token-other': { uid: 'other1', email: 'other@example.com', email_verified: true },
    'token-owner': { uid: 'owner1', email: 'owner@petwash.co.il', email_verified: true },
  };
  const auth = {
    verifyIdToken: vi.fn(async (t: string) => {
      if (!TOKENS[t]) throw Object.assign(new Error('bad token'), { code: 'auth/argument-error' });
      return TOKENS[t];
    }),
    verifySessionCookie: vi.fn(async (c: string) => {
      if (c === 'cookie-customer') return TOKENS['token-customer'];
      throw Object.assign(new Error('session cookie expired'), { code: 'auth/session-cookie-expired' });
    }),
    createCustomToken: vi.fn(async (uid: string) => `custom:${uid}`),
  };

  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { docs, db, auth, log };
});

vi.mock('../lib/firebase-admin', () => ({
  db: h.db,
  auth: h.auth,
  adminAuth: h.auth,
  default: { auth: () => h.auth, firestore: () => h.db },
}));
vi.mock('../lib/logger', () => ({ logger: h.log }));
vi.mock('../middleware/rateLimiter', () => ({ webauthnLimiter: (_q: any, _s: any, n: any) => n() }));
vi.mock('../middleware/sessionShadowVerify', () => ({ runSessionShadowCompareInline: async () => null }));
vi.mock('../services/SystemConfig', () => ({ getFeatureFlag: async () => false }));
vi.mock('../services/UserDeviceService', () => ({ UserDeviceService: {} }));
vi.mock('../services/alerts', () => ({
  getClientIP: (req: any) =>
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown',
  getCityFromIP: async () => 'Unknown',
  checkFailedBurst: vi.fn(async () => {}),
  alertNewDeviceIfUnusual: vi.fn(async () => {}),
  alertPasskeyRevoked: vi.fn(async () => {}),
}));

import { isoBase64URL, isoCBOR } from '@simplewebauthn/server/helpers';
import { registerWebAuthnRoutes } from '../webauthn/routes';
import devicesRouter from '../routes/devices';
import { __setChallengeBackendForTests, type ChallengeBackend } from '../webauthn/challengeStore';

// ── harness ────────────────────────────────────────────────────────────────

const ORIGIN = 'https://petwash.co.il';
const RP_ID = 'petwash.co.il';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1';
const CLIENT_IP = '203.0.113.77';

function memoryBackend(): ChallengeBackend {
  const store = new Map<string, string>();
  return {
    async set(key, value) {
      store.set(key, value);
      return true;
    },
    async getDelStrict(key) {
      const v = store.get(key);
      if (v === undefined) return { state: 'MISSING' };
      store.delete(key);
      return { state: 'VALUE', value: v };
    },
  };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  // stand-in for cookie-parser + the __session -> pw_session alias in server/index.ts
  app.use((req: any, _res, next) => {
    const m = /(?:^|;\s*)__session=([^;]+)/.exec(String(req.headers.cookie || ''));
    req.cookies = m ? { pw_session: m[1] } : {};
    next();
  });
  registerWebAuthnRoutes(app);
  app.use('/api/devices', devicesRouter);
  return app;
}

const sha256 = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest();

/** A software P-256 platform authenticator producing real WebAuthn payloads. */
function makeAuthenticator() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' }) as any;
  const cose = new Map<number, number | Uint8Array>([
    [1, 2],
    [3, -7],
    [-1, 1],
    [-2, Buffer.from(jwk.x, 'base64url')],
    [-3, Buffer.from(jwk.y, 'base64url')],
  ]);
  const credId = crypto.randomBytes(32);
  const id = credId.toString('base64url');
  const coseB64 = isoBase64URL.fromBuffer(isoCBOR.encode(cose));
  let counter = 0;

  return {
    id,
    coseB64,
    attest(challenge: string) {
      const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge, origin: ORIGIN, crossOrigin: false }));
      const len = Buffer.alloc(2);
      len.writeUInt16BE(credId.length);
      const authData = Buffer.concat([
        sha256(RP_ID),
        Buffer.from([0x45]), // UP | UV | AT
        Buffer.alloc(4),
        Buffer.alloc(16), // aaguid
        len,
        credId,
        Buffer.from(isoCBOR.encode(cose)),
      ]);
      const attestationObject = isoCBOR.encode(
        new Map<string, any>([
          ['fmt', 'none'],
          ['attStmt', new Map()],
          ['authData', new Uint8Array(authData)],
        ]),
      );
      return {
        id,
        rawId: id,
        type: 'public-key',
        clientExtensionResults: {},
        response: {
          clientDataJSON: clientDataJSON.toString('base64url'),
          attestationObject: Buffer.from(attestationObject).toString('base64url'),
          transports: ['internal'],
        },
      };
    },
    assert(challenge: string, userHandleUid: string, opts: { badSignature?: boolean } = {}) {
      counter += 1;
      const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin: ORIGIN, crossOrigin: false }));
      const cnt = Buffer.alloc(4);
      cnt.writeUInt32BE(counter);
      const authData = Buffer.concat([sha256(RP_ID), Buffer.from([0x05]), cnt]);
      const signature = crypto.sign('sha256', Buffer.concat([authData, sha256(clientDataJSON)]), privateKey);
      if (opts.badSignature) signature[signature.length - 1] ^= 0xff;
      return {
        id,
        rawId: id,
        type: 'public-key',
        clientExtensionResults: {},
        response: {
          authenticatorData: authData.toString('base64url'),
          clientDataJSON: clientDataJSON.toString('base64url'),
          signature: signature.toString('base64url'),
          userHandle: Buffer.from(userHandleUid, 'utf8').toString('base64url'),
        },
      };
    },
  };
}

type Authn = ReturnType<typeof makeAuthenticator>;

let app: express.Express;

function events(): any[] {
  return [...h.docs.entries()]
    .filter(([k]) => k.startsWith('securityEvents/'))
    .map(([k, v]) => ({ id: k.split('/')[1], ...v }));
}

/** Run `fn`, return the securityEvents records it created. */
async function recorded<T>(fn: () => Promise<T>): Promise<{ result: T; created: any[] }> {
  const before = new Set(events().map((e) => e.id));
  const result = await fn();
  const created = events().filter((e) => !before.has(e.id));
  return { result, created };
}

const post = (path: string, token?: string) => {
  const r = request(app).post(path).set('Origin', ORIGIN).set('User-Agent', IPHONE_UA).set('X-Forwarded-For', CLIENT_IP);
  return token ? r.set('Authorization', `Bearer ${token}`) : r;
};

async function enrol(token: string, authn: Authn) {
  const opts = await post('/api/webauthn/register/options', token).send({ consent: PASSKEY_CONSENT_VERSION });
  expect(opts.status).toBe(200);
  const verify = await post('/api/webauthn/register/verify', token).send({
    challengeId: opts.body.challengeId,
    response: authn.attest(opts.body.options.challenge),
    consent: PASSKEY_CONSENT_VERSION,
  });
  return { opts, verify };
}

async function signIn(authn: Authn, uid: string, opts: { token?: string; stepUp?: boolean; badSignature?: boolean } = {}) {
  const o = await post('/api/webauthn/login/options').send({});
  expect(o.status).toBe(200);
  expect(o.body.discoverable).toBe(true);
  return post('/api/webauthn/login/verify', opts.token).send({
    challengeId: o.body.challengeId,
    response: authn.assert(o.body.options.challenge, uid, { badSignature: opts.badSignature }),
    ...(opts.stepUp ? { purpose: 'step_up' } : {}),
  });
}

function expectAuditShape(e: any, expected: { uid: string | null; type: string; result: string; reason?: string | null; credentialId?: string }) {
  expect(e.uid).toBe(expected.uid);
  expect(e.type).toBe(expected.type);
  expect(e.result).toBe(expected.result);
  if (expected.reason !== undefined) expect(e.reason).toBe(expected.reason);
  if (expected.credentialId) expect(e.credentialId).toBe(expected.credentialId);
  expect(e.device).toEqual({ platform: 'ios', browser: 'safari' });
  expect(e.ipHash).toMatch(/^[0-9a-f]{64}$/);
  expect(e.maskedIp).toBe('203.0.113.xxx');
  expect(typeof e.createdAt).toBe('number');
  expect(new Date(e.timestamp).getTime()).toBe(e.createdAt);
  // never the raw IP, the raw user-agent, or any key material
  const blob = JSON.stringify(e);
  expect(blob).not.toContain(CLIENT_IP);
  expect(blob).not.toContain('iPhone OS');
  expect(e).not.toHaveProperty('ip');
  expect(e).not.toHaveProperty('userAgent');
  expect(blob).not.toMatch(/publicKey/i);
}

beforeAll(() => {
  __setChallengeBackendForTests(memoryBackend());
  app = buildApp();
});
afterAll(() => __setChallengeBackendForTests(null));
beforeEach(() => {
  h.log.info.mockClear();
  h.log.warn.mockClear();
});

// ── B. enrolment reachability ──────────────────────────────────────────────

describe('enrolment works for a Firebase-ID-token user (no session cookie)', () => {
  const member = makeAuthenticator();

  it('register/options + register/verify with only a Bearer token -> credential stored, ONE success record', async () => {
    const { result, created } = await recorded(() => enrol('token-customer', member));
    expect(result.opts.body.options.user.name).toBe('member@example.com');
    expect(result.verify.status).toBe(200);
    expect(result.verify.body).toEqual({ ok: true, message: 'Passkey registered successfully' });

    const stored = h.docs.get(`users/cust1/webauthnCredentials/${member.id}`);
    expect(stored?.credId).toBe(member.id);
    expect(h.docs.get('users/cust1')?.hasPasskey).toBe(true);

    // consent accepted (options) + enrolment success (verify)
    expect(created.map((e) => e.type)).toEqual(['PASSKEY_CONSENT_ACCEPTED', 'PASSKEY_ENROLL_SUCCESS']);
    expect(created[0].meta?.consentVersion).toBe(PASSKEY_CONSENT_VERSION);
    expectAuditShape(created[1], { uid: 'cust1', type: 'PASSKEY_ENROLL_SUCCESS', result: 'success', reason: null, credentialId: member.id });
    expect(created[1].meta?.consentVersion).toBe(PASSKEY_CONSENT_VERSION);
    expect(h.log.info).toHaveBeenCalledWith('[Security Event]', expect.objectContaining({ uid: 'cust1', type: 'PASSKEY_ENROLL_SUCCESS' }));
  });

  it('a phone-OTP member with NO email can enrol too (email is no longer required)', async () => {
    const phoneKey = makeAuthenticator();
    const { result, created } = await recorded(() => enrol('token-phone', phoneKey));
    expect(result.opts.body.options.user.name).toBe('+972500000001');
    expect(result.verify.status).toBe(200);
    expect(created.map((e) => [e.uid, e.type])).toEqual([['phone1', 'PASSKEY_CONSENT_ACCEPTED'], ['phone1', 'PASSKEY_ENROLL_SUCCESS']]);
  });

  it('replaying the same registration challenge fails closed and writes ONE failure record with the reason', async () => {
    const again = makeAuthenticator();
    const opts = await post('/api/webauthn/register/options', 'token-customer').send({ consent: PASSKEY_CONSENT_VERSION });
    const body = { challengeId: opts.body.challengeId, response: again.attest(opts.body.options.challenge) };
    expect((await post('/api/webauthn/register/verify', 'token-customer').send(body)).status).toBe(200);

    const { result, created } = await recorded(() => post('/api/webauthn/register/verify', 'token-customer').send(body));
    expect(result.status).toBe(400);
    expect(created).toHaveLength(1);
    expectAuditShape(created[0], { uid: 'cust1', type: 'PASSKEY_ENROLL_FAILED', result: 'failure', reason: 'challenge_not_found' });
    expect(h.log.warn).toHaveBeenCalledWith('[Security Event]', expect.objectContaining({ type: 'PASSKEY_ENROLL_FAILED', reason: 'challenge_not_found' }));
  });

  it('a challenge issued to one account cannot enrol a passkey on another', async () => {
    const opts = await post('/api/webauthn/register/options', 'token-customer').send({ consent: PASSKEY_CONSENT_VERSION });
    const k = makeAuthenticator();
    const { result, created } = await recorded(() =>
      post('/api/webauthn/register/verify', 'token-other').send({ challengeId: opts.body.challengeId, response: k.attest(opts.body.options.challenge) }),
    );
    expect(result.status).toBe(400);
    expect(h.docs.has(`users/other1/webauthnCredentials/${k.id}`)).toBe(false);
    expect(created.map((e) => [e.uid, e.type, e.reason])).toEqual([['other1', 'PASSKEY_ENROLL_FAILED', 'challenge_mismatch']]);
  });

  it('no token -> 401; an expired session cookie -> 401 (it used to throw into a 500)', async () => {
    expect((await post('/api/webauthn/register/options').send({ consent: PASSKEY_CONSENT_VERSION })).status).toBe(401);
    const expired = await request(app).get('/api/webauthn/credentials').set('Cookie', '__session=expired-cookie');
    expect(expired.status).toBe(401);
    const cookie = await request(app).get('/api/webauthn/credentials').set('Cookie', '__session=cookie-customer');
    expect(cookie.status).toBe(200);
  });
});

describe('explicit consent before any passkey is created (2026-09-14)', () => {
  it('no consent -> 428 PASSKEY_CONSENT_REQUIRED, no challenge issued, ONE failure record', async () => {
    const { result, created } = await recorded(() => post('/api/webauthn/register/options', 'token-customer').send({}));
    expect(result.status).toBe(428);
    expect(result.body.error).toBe('PASSKEY_CONSENT_REQUIRED');
    expect(result.body.consentVersion).toBe(PASSKEY_CONSENT_VERSION);
    expect(result.body.options).toBeUndefined();
    expect(result.body.challengeId).toBeUndefined();
    expect(created.map((e) => [e.uid, e.type, e.reason])).toEqual([['cust1', 'PASSKEY_ENROLL_FAILED', 'consent_missing']]);
  });

  it('a stale or made-up consent version is refused the same way', async () => {
    const r = await post('/api/webauthn/register/options', 'token-customer').send({ consent: 'passkey-consent-2020-01-01' });
    expect(r.status).toBe(428);
    const t = await post('/api/webauthn/register/options', 'token-customer').send({ consent: true });
    expect(t.status).toBe(428);
  });

  it('with the current consent version -> 200 and the acceptance is recorded with the version', async () => {
    const { result, created } = await recorded(() => post('/api/webauthn/register/options', 'token-customer').send({ consent: PASSKEY_CONSENT_VERSION }));
    expect(result.status).toBe(200);
    expect(result.body.challengeId).toBeTruthy();
    expect(created.map((e) => [e.uid, e.type, e.result])).toEqual([['cust1', 'PASSKEY_CONSENT_ACCEPTED', 'success']]);
    expect(created[0].meta?.consentVersion).toBe(PASSKEY_CONSENT_VERSION);
  });

  it('every client entry point creates passkeys only through the consent flow', () => {
    const fs = require('fs');
    const path = require('path');
    const R = (f: string) => fs.readFileSync(path.resolve(__dirname, '..', '..', f), 'utf8');
    const flow = R('client/src/components/PasskeyCreateFlow.tsx');
    expect(flow).toContain('registerPasskey(token, name, PASSKEY_CONSENT_VERSION)');
    expect(flow).toContain('data-testid="passkey-consent-confirm"');
    expect(flow).toContain('data-testid="passkey-consent-cancel"');
    expect(flow).toContain('data-testid="passkey-consent-disclosure"');
    expect(R('client/src/auth/passkey.ts')).toContain('body: JSON.stringify({ consent: consentVersion })');
    for (const f of ['client/src/pages/MyAccount.tsx', 'client/src/pages/SecuritySettings.tsx', 'client/src/pages/DeviceManagement.tsx', 'client/src/pages/Settings.tsx', 'client/src/components/EnableFaceIDCard.tsx']) {
      const src = R(f);
      expect(src, f).toContain('<PasskeyCreateFlow');
      expect(src, f).not.toMatch(/register\/options/);
      expect(src, f).not.toMatch(/\bregisterPasskey\(/);
    }
    // removing a passkey in My Account asks to confirm first
    expect(R('client/src/pages/MyAccount.tsx')).toContain('onClick={() => setPasskeyToRemove(pk.id)}');
  });

  it('the consent text discloses device-unlock access and biometrics never leave the device, in both languages', () => {
    for (const lang of ['he', 'en'] as const) {
      const T = PASSKEY_CONSENT_TEXT[lang];
      expect(T.confirm.length).toBeGreaterThan(0);
      expect(T.cancel.length).toBeGreaterThan(0);
      expect(T.points.length).toBe(3);
      expect(T.successTitle.length).toBeGreaterThan(0);
    }
    expect(PASSKEY_CONSENT_TEXT.en.disclosure).toMatch(/anyone who can unlock this device/i);
    expect(PASSKEY_CONSENT_TEXT.he.disclosure).toContain('כל מי שיכול לפתוח את נעילת המכשיר');
    expect(PASSKEY_CONSENT_TEXT.en.points.join(' ')).toMatch(/never leaves your device/);
  });
});

// ── C. sign-in + step-up outcomes, each recorded exactly once ──────────────

describe('passkey sign-in and step-up outcomes', () => {
  const key = makeAuthenticator();
  beforeAll(async () => {
    expect((await enrol('token-customer', key)).verify.status).toBe(200);
  });

  it('successful sign-in -> custom token + ONE PASSKEY_AUTH_SUCCESS', async () => {
    const { result, created } = await recorded(() => signIn(key, 'cust1'));
    expect(result.status).toBe(200);
    expect(result.body.customToken).toBe('custom:cust1');
    expect(created).toHaveLength(1);
    expectAuditShape(created[0], { uid: 'cust1', type: 'PASSKEY_AUTH_SUCCESS', result: 'success', credentialId: key.id });
  });

  it('bad signature -> 401 that names no account, ONE PASSKEY_AUTH_FAILED with reason + uid (server-side only)', async () => {
    const { result, created } = await recorded(() => signIn(key, 'cust1', { badSignature: true }));
    expect(result.status).toBe(401);
    expect(JSON.stringify(result.body)).not.toContain('cust1');
    expect(result.body.customToken).toBeUndefined();
    expect(created).toHaveLength(1);
    expectAuditShape(created[0], { uid: 'cust1', type: 'PASSKEY_AUTH_FAILED', result: 'failure', credentialId: key.id });
    expect(['signature_invalid', 'verification_error']).toContain(created[0].reason);
  });

  it('a passkey the server does not know -> ONE failure with uid null (no account attribution)', async () => {
    const stranger = makeAuthenticator();
    const { result, created } = await recorded(() => signIn(stranger, 'nobody'));
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(created).toHaveLength(1);
    expectAuditShape(created[0], { uid: null, type: 'PASSKEY_AUTH_FAILED', result: 'failure', reason: 'credential_not_found' });
  });

  it('step-up while signed in as the owner of the passkey -> ONE PASSKEY_STEPUP_SUCCESS', async () => {
    const { result, created } = await recorded(() => signIn(key, 'cust1', { token: 'token-customer', stepUp: true }));
    expect(result.status).toBe(200);
    expect(created).toHaveLength(1);
    expectAuditShape(created[0], { uid: 'cust1', type: 'PASSKEY_STEPUP_SUCCESS', result: 'success', credentialId: key.id });
  });

  it('step-up with a passkey from a DIFFERENT account -> 401, no token, ONE PASSKEY_STEPUP_FAILED uid_mismatch', async () => {
    const { result, created } = await recorded(() => signIn(key, 'cust1', { token: 'token-other', stepUp: true }));
    expect(result.status).toBe(401);
    expect(result.body.customToken).toBeUndefined();
    expect(created).toHaveLength(1);
    expectAuditShape(created[0], { uid: 'other1', type: 'PASSKEY_STEPUP_FAILED', result: 'failure', reason: 'uid_mismatch' });
  });

  it('step-up while signed out -> 401, ONE PASSKEY_STEPUP_FAILED not_signed_in', async () => {
    const { result, created } = await recorded(() => signIn(key, 'cust1', { stepUp: true }));
    expect(result.status).toBe(401);
    expect(created).toHaveLength(1);
    expectAuditShape(created[0], { uid: null, type: 'PASSKEY_STEPUP_FAILED', result: 'failure', reason: 'not_signed_in' });
  });
});

// ── D. member + admin read paths, remove + rename recorded ─────────────────

describe('member device list, rename/remove, admin read', () => {
  const a = makeAuthenticator();
  const b = makeAuthenticator();
  let memberToken = 'token-other';
  beforeAll(async () => {
    expect((await enrol(memberToken, a)).verify.status).toBe(200);
    expect((await enrol(memberToken, b)).verify.status).toBe(200);
  });

  it('GET /api/webauthn/credentials no longer depends on a composite index (was 500 FAILED_PRECONDITION) and returns ISO dates', async () => {
    const res = await request(app).get('/api/webauthn/credentials').set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    expect(res.body.credentials.map((c: any) => c.credId).sort()).toEqual([a.id, b.id].sort());
    for (const c of res.body.credentials) {
      expect(c.deviceName).toBe('ios Device');
      expect(new Date(c.createdAt).toISOString()).toBe(c.createdAt);
      expect(new Date(c.lastUsedAt).toISOString()).toBe(c.lastUsedAt);
    }
    expect(JSON.stringify(res.body)).not.toMatch(/publicKey|attestation/i);
    // Settings.tsx reads `devices`; the alias path used to 404
    expect(res.body.devices).toEqual(res.body.credentials);
    const alias = await request(app).get('/api/auth/webauthn/devices').set('Authorization', `Bearer ${memberToken}`);
    expect(alias.status).toBe(200);
    expect(alias.body.devices).toEqual(res.body.credentials);
  });

  it('rename -> ONE DEVICE_RENAMED; unknown credential -> 404 and no record', async () => {
    const { result, created } = await recorded(() =>
      request(app).patch(`/api/webauthn/credentials/${a.id}/rename`).set('Authorization', `Bearer ${memberToken}`)
        .set('User-Agent', IPHONE_UA).set('X-Forwarded-For', CLIENT_IP).send({ newName: 'My iPhone' }),
    );
    expect(result.status).toBe(200);
    expect(created).toHaveLength(1);
    expectAuditShape(created[0], { uid: 'other1', type: 'DEVICE_RENAMED', result: 'success', credentialId: a.id });

    const missing = await recorded(() =>
      request(app).patch(`/api/webauthn/credentials/${'x'.repeat(40)}/rename`).set('Authorization', `Bearer ${memberToken}`).send({ newName: 'n' }),
    );
    expect(missing.result.status).toBe(404);
    expect(missing.created).toHaveLength(0);
  });

  it('remove -> ONE PASSKEY_REVOKED, credential marked revoked and gone from the member list', async () => {
    const { result, created } = await recorded(() =>
      request(app).delete(`/api/webauthn/credentials/${b.id}`).set('Authorization', `Bearer ${memberToken}`)
        .set('User-Agent', IPHONE_UA).set('X-Forwarded-For', CLIENT_IP),
    );
    expect(result.status).toBe(200);
    expect(created).toHaveLength(1);
    expectAuditShape(created[0], { uid: 'other1', type: 'PASSKEY_REVOKED', result: 'success', credentialId: b.id });
    expect(h.docs.get(`users/other1/webauthnCredentials/${b.id}`)?.isRevoked).toBe(true);

    const list = await request(app).get('/api/webauthn/credentials').set('Authorization', `Bearer ${memberToken}`);
    expect(list.body.credentials.map((c: any) => c.credId)).toEqual([a.id]);
    expect(list.body.credentials[0].deviceName).toBe('My iPhone');
  });

  it('admin reads a member\'s passkeys (incl. revoked) and passkey audit events; non-admin is refused', async () => {
    const res = await request(app).get('/api/devices/admin/user/other1/passkeys').set('Authorization', 'Bearer token-owner');
    expect(res.status).toBe(200);
    expect(res.body.uid).toBe('other1');
    expect(res.body.credentials.map((c: any) => [c.credId, c.isRevoked]).sort()).toEqual(
      [[a.id, false], [b.id, true]].sort(),
    );
    const types = res.body.events.map((e: any) => e.type);
    expect(types).toEqual(expect.arrayContaining(['PASSKEY_ENROLL_SUCCESS', 'PASSKEY_ENROLL_FAILED', 'PASSKEY_STEPUP_FAILED', 'DEVICE_RENAMED', 'PASSKEY_REVOKED']));
    for (const e of res.body.events) {
      expect(e).toEqual(expect.objectContaining({ result: expect.any(String), createdAt: expect.any(String) }));
      expect(e).not.toHaveProperty('ipHash');
    }
    expect(res.body.events[0].createdAt >= res.body.events[res.body.events.length - 1].createdAt).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/publicKey|attestation|203\.0\.113\.77/i);

    const mismatch = res.body.events.find((e: any) => e.type === 'PASSKEY_STEPUP_FAILED');
    expect(mismatch.reason).toBe('uid_mismatch');

    expect((await request(app).get('/api/devices/admin/user/other1/passkeys').set('Authorization', 'Bearer token-customer')).status).toBe(403);
    expect((await request(app).get('/api/devices/admin/user/other1/passkeys')).status).toBe(401);
  });
});
