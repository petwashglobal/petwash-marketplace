/**
 * Passkey (WebAuthn) sign-in behind Firebase Hosting -> Cloud Run.
 *
 * Production evidence (2026-09-13):
 *   POST https://petwash.co.il/api/webauthn/login/options {} -> 400 "Failed to generate options"
 *   [WebAuthn] Discoverable auth from unauthorized origin {"origin":"https://petwash-api-gphpd64opa-zf.a.run.app"}
 *   [WebAuthn Config] … "environment":"development"
 *
 * Stacked root causes pinned here BEHAVIOURALLY (real functions, fake request):
 *   1. expected origin / rpId came from the Host header (= run.app behind Hosting)
 *   2. isDev was true in production (APP_ENV unset) -> dev-only origin wildcard live
 *   3. challenge in a cookie Hosting strips -> now server-side, single-use, bound
 *   4. routes read error.status/error.message; bilingualError has statusCode/error
 *   5. credential id read via isoBase64URL.fromBuffer(<string>) -> always ""
 *
 * The round-trip test builds a REAL ES256 passkey assertion (P-256 key, COSE
 * public key, authenticatorData, clientDataJSON signed over by the key) and runs
 * it through the real @simplewebauthn verifier — so "expectedOrigin is the
 * browser origin" and "a challenge verifies exactly once" are proven, not assumed.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => {
  const docs = new Map<string, any>();
  const makeDocRef = (p: string): any => ({
    get: async () => ({ exists: docs.has(p), data: () => docs.get(p) }),
    collection: (name: string) => makeCollection(`${p}/${name}`),
  });
  const makeCollection = (p: string): any => ({
    doc: (id: string) => makeDocRef(`${p}/${id}`),
    where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }), get: async () => ({ empty: true, docs: [], size: 0 }) }),
    get: async () => ({ empty: true, docs: [], size: 0 }),
  });
  return {
    docs,
    db: { collection: (name: string) => makeCollection(name) },
    updateDeviceOnAuth: vi.fn(async () => {}),
    recordAuthFailure: vi.fn(async () => {}),
    logAuthEvent: vi.fn(async () => {}),
  };
});

vi.mock('../lib/firebase-admin', () => ({ db: h.db, auth: {}, default: {} }));
vi.mock('../lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../webauthn/deviceRegistry', () => ({
  registerDevice: vi.fn(),
  updateDeviceOnAuth: h.updateDeviceOnAuth,
  recordAuthFailure: h.recordAuthFailure,
  getUserDevices: vi.fn(),
  renameDevice: vi.fn(),
  setDeviceIcon: vi.fn(),
  revokeDevice: vi.fn(),
  checkReAuthRequired: vi.fn(),
  logAuthEvent: h.logAuthEvent,
}));

import { getExpectedOrigin, getRpId, isOriginAllowed, resolveCeremonyContext, webauthnConfig } from '../webauthn/config';
import {
  issueChallenge,
  consumeChallenge,
  __setChallengeBackendForTests,
  type ChallengeBackend,
} from '../webauthn/challengeStore';
import {
  generateDiscoverableAuthenticationOptions,
  verifyAuthentication,
  sendWebAuthnError,
  readCredentialId,
} from '../webauthn/service';
import { isoCBOR, isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';

// ── helpers ────────────────────────────────────────────────────────────────

function fakeReq(headers: Record<string, string>, protocol = 'https'): any {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return {
    headers: lower,
    protocol,
    ip: '203.0.113.7',
    query: {},
    get: (name: string) => lower[name.toLowerCase()],
  };
}

const RUN_APP_HOST = 'petwash-api-xyz.a.run.app';
const hostingReq = (extra: Record<string, string> = {}) =>
  fakeReq({ host: RUN_APP_HOST, origin: 'https://petwash.co.il', 'user-agent': 'vitest', ...extra });

/** In-memory backend with Redis GETDEL semantics (atomic read-and-delete). */
function memoryBackend() {
  const store = new Map<string, string>();
  const backend: ChallengeBackend & { store: Map<string, string>; down: boolean } = {
    store,
    down: false,
    async set(key, value) {
      if (backend.down) return false;
      store.set(key, value);
      return true;
    },
    async getDelStrict(key) {
      if (backend.down) return { state: 'UNAVAILABLE' };
      const v = store.get(key);
      if (v === undefined) return { state: 'MISSING' };
      store.delete(key);
      return { state: 'VALUE', value: v };
    },
  };
  return backend;
}

// ── 1. origin + rpId behind Hosting ────────────────────────────────────────

describe('origin / rpId are the BROWSER origin, not the Cloud Run Host', () => {
  it('Host=run.app + Origin=https://petwash.co.il -> origin petwash.co.il, rpId petwash.co.il, allowed', () => {
    const req = hostingReq();
    expect(getExpectedOrigin(req)).toBe('https://petwash.co.il');
    expect(getRpId(req)).toBe('petwash.co.il');
    expect(resolveCeremonyContext(req)).toEqual({
      origin: 'https://petwash.co.il',
      rpId: 'petwash.co.il',
      allowed: true,
    });
  });

  it('Origin=https://evil.example -> refused by the allowlist, rpId falls back to the configured default', () => {
    const req = hostingReq({ origin: 'https://evil.example' });
    expect(getExpectedOrigin(req)).toBe('https://evil.example');
    expect(isOriginAllowed(getExpectedOrigin(req))).toBe(false);
    expect(getRpId(req)).toBe(webauthnConfig.rpId);
    expect(resolveCeremonyContext(req).allowed).toBe(false);
  });

  it('an opaque Origin ("null") is refused and never falls through to X-Forwarded-Host', () => {
    const req = hostingReq({ origin: 'null', 'x-forwarded-host': 'petwash.co.il' });
    expect(resolveCeremonyContext(req).allowed).toBe(false);
  });

  it('no Origin header -> X-Forwarded-Host (https), then Host', () => {
    expect(getExpectedOrigin(fakeReq({ host: RUN_APP_HOST, 'x-forwarded-host': 'petwash.co.il' }))).toBe('https://petwash.co.il');
    expect(getExpectedOrigin(fakeReq({ host: 'localhost:5000' }, 'http'))).toBe('http://localhost:5000');
    // The raw run.app host is NOT an allowed origin.
    expect(isOriginAllowed(getExpectedOrigin(fakeReq({ host: RUN_APP_HOST })))).toBe(false);
  });

  it('the /api/webauthn/login/options probe from the real site returns options (not 400)', async () => {
    const backend = memoryBackend();
    __setChallengeBackendForTests(backend);
    try {
      const result = await generateDiscoverableAuthenticationOptions(hostingReq());
      expect(result.success).toBe(true);
      expect(result.options.rpId).toBe('petwash.co.il');
      expect(result.challengeId).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(backend.store.size).toBe(1);
    } finally {
      __setChallengeBackendForTests(null);
    }
  });
});

// ── 2. production detection ────────────────────────────────────────────────

describe('NODE_ENV=production always means NOT dev', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('NODE_ENV=production + APP_ENV unset -> isDev false, replit wildcard refused', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_ENV', '');
    delete process.env.APP_ENV;
    vi.resetModules();
    const cfg = await import('../webauthn/config');
    expect(cfg.isDev).toBe(false);
    expect(cfg.isOriginAllowed('https://anything.replit.dev')).toBe(false);
    expect(cfg.isOriginAllowed('https://petwash.co.il')).toBe(true);
  });

  it('NODE_ENV=production + APP_ENV=development -> still NOT dev', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_ENV', 'development');
    vi.resetModules();
    const cfg = await import('../webauthn/config');
    expect(cfg.isDev).toBe(false);
  });

  it('local dev (NODE_ENV=development, APP_ENV unset) keeps the dev wildcard, https only', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    delete process.env.APP_ENV;
    vi.resetModules();
    const cfg = await import('../webauthn/config');
    expect(cfg.isDev).toBe(true);
    expect(cfg.isOriginAllowed('https://abc.replit.dev')).toBe(true);
    expect(cfg.isOriginAllowed('https://replit.dev.evil.example')).toBe(false);
  });
});

// ── 3. challenge store: single-use, bound, fail-closed ─────────────────────

describe('challenge store', () => {
  let backend: ReturnType<typeof memoryBackend>;
  beforeEach(() => {
    backend = memoryBackend();
    __setChallengeBackendForTests(backend);
  });
  afterEach(() => __setChallengeBackendForTests(null));

  const base = {
    challenge: 'Y2hhbGxlbmdl',
    type: 'authentication' as const,
    rpId: 'petwash.co.il',
    origin: 'https://petwash.co.il',
    uid: null,
    email: null,
    collection: null,
    discoverable: true,
  };
  const expectAuth = { type: 'authentication' as const, rpId: 'petwash.co.il', origin: 'https://petwash.co.il' };

  it('issue -> consume once succeeds -> second consume fails', async () => {
    const issued = await issueChallenge(base);
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    // ≥128-bit id: 32 random bytes base64url
    expect(Buffer.from(issued.challengeId, 'base64url').length).toBe(32);
    // the store key is a hash, never the usable id
    expect([...backend.store.keys()][0]).not.toContain(issued.challengeId);

    const first = await consumeChallenge(issued.challengeId, expectAuth);
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.record.challenge).toBe('Y2hhbGxlbmdl');

    const second = await consumeChallenge(issued.challengeId, expectAuth);
    expect(second).toEqual({ ok: false, reason: 'not_found' });
  });

  it('expired challenge is refused', async () => {
    const t0 = 1_000_000;
    const issued = await issueChallenge(base, t0);
    if (!issued.ok) throw new Error('issue failed');
    const late = await consumeChallenge(issued.challengeId, expectAuth, t0 + webauthnConfig.challengeExpiry + 1);
    expect(late).toEqual({ ok: false, reason: 'expired' });
  });

  it.each([
    ['type', { type: 'registration' as const }],
    ['rpId', { rpId: 'www.petwash.co.il' }],
    ['origin', { origin: 'https://www.petwash.co.il' }],
  ])('%s mismatch is refused (and the challenge is still burnt)', async (_label, override) => {
    const issued = await issueChallenge(base);
    if (!issued.ok) throw new Error('issue failed');
    const r = await consumeChallenge(issued.challengeId, { ...expectAuth, ...override });
    expect(r).toEqual({ ok: false, reason: 'mismatch' });
    expect(await consumeChallenge(issued.challengeId, expectAuth)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('registration challenge bound to uid A cannot be consumed by uid B', async () => {
    const issued = await issueChallenge({ ...base, type: 'registration', uid: 'uidA', email: 'a@x.co', collection: 'users', discoverable: false });
    if (!issued.ok) throw new Error('issue failed');
    const r = await consumeChallenge(issued.challengeId, { type: 'registration', rpId: 'petwash.co.il', origin: 'https://petwash.co.il', uid: 'uidB' });
    expect(r).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('malformed / missing ids never reach the store', async () => {
    const spy = vi.spyOn(backend, 'getDelStrict');
    expect(await consumeChallenge(undefined, expectAuth)).toEqual({ ok: false, reason: 'invalid_id' });
    expect(await consumeChallenge('short', expectAuth)).toEqual({ ok: false, reason: 'invalid_id' });
    expect(await consumeChallenge({ $gt: '' }, expectAuth)).toEqual({ ok: false, reason: 'invalid_id' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('store down -> FAIL CLOSED on issue and on consume', async () => {
    const issued = await issueChallenge(base);
    if (!issued.ok) throw new Error('issue failed');
    backend.down = true;
    expect(await issueChallenge(base)).toEqual({ ok: false, reason: 'store_unavailable' });
    expect(await consumeChallenge(issued.challengeId, expectAuth)).toEqual({ ok: false, reason: 'store_unavailable' });
  });

  it('store down -> options answer 503 with the bilingual message', async () => {
    backend.down = true;
    const result = await generateDiscoverableAuthenticationOptions(hostingReq());
    expect(result.success).toBe(false);
    expect(result.error?.statusCode).toBe(503);
    const res = mockRes();
    sendWebAuthnError(res, result.error, 400, 'fallback');
    expect(res.statusCode).toBe(503);
    expect(res.body.error_he).toBeTruthy();
    expect(res.body.error_en).toMatch(/temporarily unavailable/i);
  });
});

// ── 4. routes surface statusCode + bilingual error ─────────────────────────

function mockRes() {
  const res: any = { statusCode: 0, body: undefined };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  return res;
}

describe('route error mapping', () => {
  it('sendWebAuthnError uses bilingualError.statusCode and .error (not .status/.message)', async () => {
    const { bilingualError, webauthnMessages } = await import('../lib/i18n');
    const res = mockRes();
    sendWebAuthnError(res, bilingualError(webauthnMessages.originMismatch, 403, 'he'), 400, 'fallback');
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe(webauthnMessages.originMismatch.he);
    expect(res.body.error_en).toBe(webauthnMessages.originMismatch.en);
    expect(res.body).not.toHaveProperty('statusCode');
  });

  it('no /api/webauthn route still reads the non-existent error.status / error.message', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'routes.ts'), 'utf8');
    const start = src.indexOf("app.post('/api/webauthn/register/options'");
    const end = src.indexOf("app.get('/api/webauthn/credentials'");
    expect(start).toBeGreaterThan(0);
    const block = src.slice(start, end);
    expect(block).not.toMatch(/result\.error\?\.status\b/);
    expect(block).not.toMatch(/result\.error\?\.message\b/);
    expect(block).toMatch(/challengeId/);
  });
});

// ── 5. full options -> verify round trip with a REAL assertion ─────────────

function makePasskey(uid: string) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string };
  const cose = new Map<number, number | Uint8Array>([
    [1, 2], // kty EC2
    [3, -7], // alg ES256
    [-1, 1], // crv P-256
    [-2, new Uint8Array(Buffer.from(jwk.x, 'base64url'))],
    [-3, new Uint8Array(Buffer.from(jwk.y, 'base64url'))],
  ]);
  const credId = crypto.randomBytes(20).toString('base64url');
  return {
    credId,
    uid,
    publicKeyB64: isoBase64URL.fromBuffer(isoCBOR.encode(cose)),
    sign(challenge: string, origin: string, rpId: string, counter = 1) {
      const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin, crossOrigin: false }));
      const rpIdHash = crypto.createHash('sha256').update(rpId).digest();
      const flags = Buffer.from([0x05]); // UP | UV
      const cnt = Buffer.alloc(4);
      cnt.writeUInt32BE(counter);
      const authData = Buffer.concat([rpIdHash, flags, cnt]);
      const signed = Buffer.concat([authData, crypto.createHash('sha256').update(clientDataJSON).digest()]);
      const signature = crypto.sign('sha256', signed, privateKey); // DER, as authenticators emit
      return {
        id: credId,
        rawId: credId,
        type: 'public-key',
        clientExtensionResults: {},
        response: {
          clientDataJSON: clientDataJSON.toString('base64url'),
          authenticatorData: authData.toString('base64url'),
          signature: signature.toString('base64url'),
          userHandle: isoBase64URL.fromBuffer(isoUint8Array.fromUTF8String(uid)),
        },
      };
    },
  };
}

describe('discoverable passkey round trip behind Hosting (real signature)', () => {
  let backend: ReturnType<typeof memoryBackend>;
  beforeEach(() => {
    backend = memoryBackend();
    __setChallengeBackendForTests(backend);
    h.docs.clear();
    h.updateDeviceOnAuth.mockClear();
    h.recordAuthFailure.mockClear();
  });
  afterEach(() => __setChallengeBackendForTests(null));

  function seed(passkey: ReturnType<typeof makePasskey>, collection: 'users' | 'employees' = 'users') {
    h.docs.set(`${collection}/${passkey.uid}/webauthnCredentials/${passkey.credId}`, {
      credId: passkey.credId,
      publicKey: passkey.publicKeyB64,
      counter: 0,
      transports: ['internal'],
      trustScore: 50,
      isRevoked: false,
    });
    h.docs.set(`${collection}/${passkey.uid}`, { email: 'owner@petwash.co.il' });
  }

  it('options -> sign -> verify succeeds with expectedOrigin https://petwash.co.il; the SAME challengeId replays -> refused', async () => {
    const passkey = makePasskey('uid_owner_1');
    seed(passkey);

    const opts = await generateDiscoverableAuthenticationOptions(hostingReq());
    expect(opts.success).toBe(true);
    const assertion = passkey.sign(opts.options.challenge, 'https://petwash.co.il', 'petwash.co.il');

    // Sanity for fix #5: the id is used as the base64url string it already is.
    expect(readCredentialId(assertion)).toBe(passkey.credId);

    const ok = await verifyAuthentication(assertion, opts.challengeId, hostingReq());
    expect(ok.error).toBeUndefined();
    expect(ok).toMatchObject({ verified: true, uid: 'uid_owner_1', isAdmin: false });
    expect(h.updateDeviceOnAuth).toHaveBeenCalledWith('uid_owner_1', false, passkey.credId, 1, '203.0.113.7', 'vitest');

    const replay = await verifyAuthentication(assertion, opts.challengeId, hostingReq());
    expect(replay.verified).toBe(false);
    expect(replay.error?.statusCode).toBe(400);
    expect(h.updateDeviceOnAuth).toHaveBeenCalledTimes(1);
  });

  it('the consumed challenge is the one checked: an assertion over a DIFFERENT challenge fails', async () => {
    const passkey = makePasskey('uid_owner_2');
    seed(passkey);
    const a = await generateDiscoverableAuthenticationOptions(hostingReq());
    const b = await generateDiscoverableAuthenticationOptions(hostingReq());
    // Signed over B's challenge, presented with A's challengeId.
    const assertion = passkey.sign(b.options.challenge, 'https://petwash.co.il', 'petwash.co.il');
    const r = await verifyAuthentication(assertion, a.challengeId, hostingReq());
    expect(r.verified).toBe(false);
    expect(h.updateDeviceOnAuth).not.toHaveBeenCalled();
    // A is burnt even though it failed.
    expect((await verifyAuthentication(passkey.sign(a.options.challenge, 'https://petwash.co.il', 'petwash.co.il'), a.challengeId, hostingReq())).verified).toBe(false);
  });

  it('an assertion signed for a foreign origin fails even with a valid challengeId', async () => {
    const passkey = makePasskey('uid_owner_3');
    seed(passkey);
    const opts = await generateDiscoverableAuthenticationOptions(hostingReq());
    const assertion = passkey.sign(opts.options.challenge, 'https://evil.example', 'petwash.co.il');
    const r = await verifyAuthentication(assertion, opts.challengeId, hostingReq());
    expect(r.verified).toBe(false);
    expect(h.updateDeviceOnAuth).not.toHaveBeenCalled();
  });

  it('verify from a different (still allowed) origin than options -> binding mismatch, no signature work', async () => {
    const passkey = makePasskey('uid_owner_4');
    seed(passkey);
    const opts = await generateDiscoverableAuthenticationOptions(hostingReq());
    const assertion = passkey.sign(opts.options.challenge, 'https://www.petwash.co.il', 'www.petwash.co.il');
    const r = await verifyAuthentication(assertion, opts.challengeId, hostingReq({ origin: 'https://www.petwash.co.il' }));
    expect(r.verified).toBe(false);
    expect(r.error?.error_en).toBe('Authentication challenge mismatch');
  });

  it('missing challengeId -> 400, store never consulted for a verdict', async () => {
    const passkey = makePasskey('uid_owner_5');
    seed(passkey);
    const r = await verifyAuthentication(passkey.sign('x', 'https://petwash.co.il', 'petwash.co.il'), undefined, hostingReq());
    expect(r.verified).toBe(false);
    expect(r.error?.statusCode).toBe(400);
  });

  it('store down at verify -> 503, never a pass', async () => {
    const passkey = makePasskey('uid_owner_6');
    seed(passkey);
    const opts = await generateDiscoverableAuthenticationOptions(hostingReq());
    backend.down = true;
    const r = await verifyAuthentication(passkey.sign(opts.options.challenge, 'https://petwash.co.il', 'petwash.co.il'), opts.challengeId, hostingReq());
    expect(r.verified).toBe(false);
    expect(r.error?.statusCode).toBe(503);
  });
});
