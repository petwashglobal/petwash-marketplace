/**
 * THE PROOF IS SPENT — the sibling route, and the same incoherence.
 *
 * #2327 fixed /api/auth/verify-signup-mobile: the client caches its SMS
 * verificationToken so a stage-2/3/4 hiccup does not cost a fresh code, the
 * server burns that token BEFORE it mutates anything, and every failure after
 * the burn now says `proofSpent: true` so the client stops replaying a nonce
 * that can never be claimed again. That commit named this route as the
 * residual and deliberately did not absorb it.
 *
 * /api/auth/phone-session is the FRESH-SIGNUP half of the same chain
 * (/sms/verify → /phone-session → signInWithCustomToken → /api/auth/session).
 * It burns the nonce and then does the most substantial work in the file:
 * Firebase lookup, account creation, wallet + loyalty + users rows, DOB,
 * activation, provisioning, custom-token mint. Every failure in that stretch
 * left the client holding a dead token and — worse — the client's copy for two
 * of those stages promised "your code is still valid", which stopped being
 * true the moment the burn returned ok.
 *
 * What these pins hold:
 *   - every exit AFTER the burn is marked spent, including the outer 500;
 *   - the exits BEFORE it are not — nothing was claimed, and telling the
 *     client to throw its token away would burn an SMS for a Redis blip;
 *   - a replay of a spent proof dies at the burn, before any account work;
 *   - a FRESH proof genuinely recovers;
 *   - and the client half actually drops the token, with copy that no longer
 *     claims a spent code is still good.
 *
 * The one-shot nonce mock here is STATEFUL on purpose. consumeVerificationNonce
 * delegates to consumeOneShotProof (Redis SETNX, server/lib/oneShotProof.ts):
 * first claim wins, every replay answers `already_used`. An always-ok mock is
 * not a simplification of that contract, it is a different one — it certifies
 * recovery paths that cannot run in production, which is exactly what let the
 * defect through review on the sibling route.
 */
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'test-jwt-secret-phone-session-proof-spent-0123456789';

const PHONE = '+972500000222';
const EXISTING_UID = 'uid_existing_phone_owner';
const ADULT_DOB = '1990-04-01';

// ── Firebase: the store phone-session resolves identity against ─────────────
type FbUser = { uid: string; phoneNumber: string | null; email?: string | null };
let fbUsers: Record<string, FbUser>;
/** Emails that already belong to an account (the EMAIL_HAS_ACCOUNT guard). */
let fbEmails: Record<string, FbUser>;
/** Programmable failure for the account-creation step. */
let createUserFailure: Error | null = null;
let createCustomTokenFailure: Error | null = null;
let uidSeq = 0;

const getUserByPhoneNumber = vi.fn(async (phone: string) => {
  const hit = Object.values(fbUsers).find((u) => u.phoneNumber === phone);
  if (!hit) throw Object.assign(new Error('not found'), { code: 'auth/user-not-found' });
  return hit;
});
const getUserByEmail = vi.fn(async (email: string) => {
  const hit = fbEmails[email.toLowerCase()];
  if (!hit) throw Object.assign(new Error('not found'), { code: 'auth/user-not-found' });
  return hit;
});
const createUser = vi.fn(async (patch: any) => {
  if (createUserFailure) throw createUserFailure;
  const uid = `uid_new_${++uidSeq}`;
  fbUsers[uid] = { uid, phoneNumber: patch.phoneNumber ?? null, email: null };
  return fbUsers[uid];
});
const createCustomToken = vi.fn(async (uid: string) => {
  if (createCustomTokenFailure) throw createCustomTokenFailure;
  return `custom:${uid}`;
});
const deleteUser = vi.fn(async (uid: string) => { delete fbUsers[uid]; });

vi.mock('../lib/firebase-admin', () => ({
  auth: {
    verifyIdToken: async (t: string) => {
      if (!t || !String(t).startsWith('uid_')) throw new Error('bad token');
      return { uid: t };
    },
    verifySessionCookie: async (t: string) => ({ uid: t }),
    getUserByPhoneNumber: (...a: any[]) => (getUserByPhoneNumber as any)(...a),
    getUserByEmail: (...a: any[]) => (getUserByEmail as any)(...a),
    createUser: (...a: any[]) => (createUser as any)(...a),
    createCustomToken: (...a: any[]) => (createCustomToken as any)(...a),
    deleteUser: (...a: any[]) => (deleteUser as any)(...a),
    updateUser: vi.fn(async () => undefined),
    getUser: vi.fn(async (uid: string) => fbUsers[uid]),
  },
  db: { collection: () => ({ doc: () => ({ set: async () => undefined, get: async () => ({ exists: false }) }) }) },
}));

// ── SMS proof: token "sms:<phone>:<nonce>" proves that phone ────────────────
/**
 * STATEFUL one-shot nonce — see the header. `burnThrows` models a failure
 * BEFORE anything is claimed, which is the control case for "not spent".
 */
const burnedNonces = new Set<string>();
let burnStoreUnavailable = false;
const consumeVerificationNonce = vi.fn(async (nonce: string) => {
  if (burnStoreUnavailable) return { ok: false as const, reason: 'store_unavailable' as const };
  if (burnedNonces.has(nonce)) return { ok: false as const, reason: 'already_used' as const };
  burnedNonces.add(nonce);
  return { ok: true as const };
});

vi.mock('../services/TwilioSMSService', () => ({
  twilioSMSService: {
    validateVerificationToken: (t: string) => {
      // A token shaped "boom:<phone>:<nonce>" blows up BEFORE the burn — the
      // only way to reach the outer 500 with nothing claimed.
      if (String(t || '').startsWith('boom:')) throw new Error('pre-burn explosion');
      const m = /^sms:([^:]+):(.+)$/.exec(t || '');
      return m ? { valid: true, phone: m[1], nonce: m[2] } : { valid: false };
    },
    consumeVerificationNonce: (...a: any[]) => (consumeVerificationNonce as any)(...a),
    sendVerificationCode: vi.fn(async () => ({ success: true })),
    verifyCode: vi.fn(async () => ({ success: true })),
    sendSMS: vi.fn(async () => ({ success: true })),
  },
}));

// ── Postgres ───────────────────────────────────────────────────────────────
const poolQuery = vi.fn(async () => ({ rows: [] }));
vi.mock('../db', () => ({
  pool: { query: (...a: any[]) => (poolQuery as any)(...a) },
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    insert: () => ({ values: async () => undefined, onConflictDoNothing: async () => undefined }),
    execute: async () => ({ rows: [] }),
  },
}));

// ── Bootstrap: the post-burn failure this route reports as 502 ─────────────
class AuthBootstrapUsersRowFailed extends Error {}
let bootstrapFailure: Error | null = null;
const ensureUserProvisioned = vi.fn(async () => {
  if (bootstrapFailure) throw bootstrapFailure;
  return { ok: true };
});
vi.mock('../services/authBootstrap', () => ({
  ensureUserProvisioned: (...a: any[]) => (ensureUserProvisioned as any)(...a),
  get AuthBootstrapUsersRowFailed() { return AuthBootstrapUsersRowFailed; },
}));

const markMobileVerified = vi.fn(async (uid: string) => ({ userId: uid }));
vi.mock('../services/ActivationService', () => ({
  markMobileVerified: (...a: any[]) => (markMobileVerified as any)(...a),
  markEmailVerified: vi.fn(async () => undefined),
  getActivationState: async (uid: string) => ({ userId: uid, activationStatus: 'active' }),
  isBothContactsRequired: () => false,
}));

const upsertUser = vi.fn(async () => undefined);
vi.mock('../storage', () => ({ storage: { upsertUser: (...a: any[]) => (upsertUser as any)(...a) } }));

vi.mock('../services/bookingEventLogger', () => ({ logNewUserRegistration: async () => undefined }));
vi.mock('../services/SystemConfig', () => ({ getFeatureFlag: async () => false }));

// ── Everything else the module pulls in at import time ─────────────────────
vi.mock('../middleware/rateLimiter', () => ({
  apiLimiter: (_r: any, _s: any, n: any) => n(),
  authLimiter: (_r: any, _s: any, n: any) => n(),
}));
vi.mock('../middleware/rateLimiterRedisStore', () => ({ redisRateLimitStore: () => undefined }));
vi.mock('express-rate-limit', () => ({
  default: () => (_r: any, _s: any, n: any) => n(),
  ipKeyGenerator: (ip: string) => ip,
}));
vi.mock('../simpleAuth', () => ({ getCurrentUser: async () => null }));
vi.mock('../lib/phoneHmac', () => ({ phoneLookupHash: (p: string) => `h:${p}` }));
vi.mock('../lib/verifyCaptcha', () => ({ verifyCaptchaToken: async () => ({ success: true }) }));
vi.mock('../lib/verifyTurnstile', () => ({ verifyTurnstileToken: async () => ({ success: true }) }));
vi.mock('../lib/feature-flags/unifiedVerification', () => ({
  isUnifiedVerificationSignupEnabled: () => false,
}));
vi.mock('../services/UnifiedVerificationService', () => ({
  UnifiedVerificationError: class extends Error {},
  unifiedVerificationService: {},
}));
vi.mock('../lib/emailVerifiedToken', () => ({ redeemEmailVerifiedToken: async () => ({ ok: false }) }));
vi.mock('../lib/mfaLoginToken', () => ({ mintMfaLoginToken: (uid: string) => `mfa:${uid}` }));
vi.mock('../services/RegistrationOTPService', () => ({ registrationOTPService: {} }));
vi.mock('../services/MembershipService', () => ({ assignCustomerMembership: async () => undefined }));
vi.mock('../sms/templates/welcome-sms-templates', () => ({
  renderWelcomeSMS: () => 'hi', getTemplateId: () => 'welcome',
}));
vi.mock('../services/redis', () => ({
  redis: {
    isConnected: () => true, get: async () => null, set: async () => true,
    setRaw: async () => true, getRaw: async () => null, del: async () => true,
    incr: async () => 1, expire: async () => true, ttl: async () => -2,
    setNxStrict: async () => 'SET', existsStrict: async () => 'NO',
  },
}));
vi.mock('../emailService', () => ({ EmailService: { sendEmail: vi.fn(async () => ({ success: true })) } }));

const { publicAuthRouter } = await import('../routes/publicAuthRoutes');

const app = express();
app.use(express.json());
app.use(publicAuthRouter);

/** Each call presents a DISTINCT proof unless a nonce is passed explicitly. */
let nonceSeq = 0;
const session = (body: Record<string, unknown> = {}, nonce?: string) =>
  request(app).post('/api/auth/phone-session').send({
    verificationToken: `sms:${PHONE}:${nonce ?? `n${++nonceSeq}`}`,
    dateOfBirth: ADULT_DOB,
    firstName: 'Nir',
    lastName: 'Hadad',
    ...body,
  });

beforeEach(() => {
  vi.clearAllMocks();
  burnedNonces.clear();
  burnStoreUnavailable = false;
  bootstrapFailure = null;
  createUserFailure = null;
  createCustomTokenFailure = null;
  fbUsers = {};
  fbEmails = {};
  uidSeq = 0;
});

describe('phone-session: a failure after the burn must say the proof is spent', () => {
  it('the happy path mints a custom token and claims nothing about spentness', async () => {
    const res = await session();
    expect(res.status).toBe(200);
    expect(res.body.customToken).toBeTruthy();
    expect(res.body.isNewUser).toBe(true);
    expect(res.body.proofSpent).toBeUndefined();
  });

  it('EMAIL_HAS_ACCOUNT is a POST-burn refusal, and says so', async () => {
    fbEmails['taken@example.com'] = { uid: 'uid_email_owner', phoneNumber: null };
    const res = await session({ email: 'taken@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_HAS_ACCOUNT');
    // The nonce was already claimed two branches earlier, so the token the
    // client cached is dead even though this refusal reads like a pre-flight.
    expect(consumeVerificationNonce).toHaveBeenCalledTimes(1);
    expect(res.body.proofSpent).toBe(true);
  });

  it('the 18+ refusal is post-burn too', async () => {
    const res = await session({ dateOfBirth: '2015-01-01' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AGE_REQUIREMENT');
    expect(res.body.proofSpent).toBe(true);
  });

  it('a users-row bootstrap hard-fail (502 DB_UNAVAILABLE) is marked spent, and asks for a new code', async () => {
    bootstrapFailure = new AuthBootstrapUsersRowFailed('users row not provable');
    const res = await session();
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('DB_UNAVAILABLE');
    expect(res.body.proofSpent).toBe(true);
    // The client renders `message || error`; "user_bootstrap_failed" is not
    // something a member can act on, and "try again" would be a lie.
    expect(String(res.body.message)).toMatch(/new code/i);
  });

  it('an unexpected bootstrap failure (502 BOOTSTRAP_UNAVAILABLE) is marked spent', async () => {
    bootstrapFailure = new Error('firestore down');
    const res = await session();
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('BOOTSTRAP_UNAVAILABLE');
    expect(res.body.proofSpent).toBe(true);
    expect(String(res.body.message)).toMatch(/new code/i);
  });

  it('the outer 500 is marked spent when it lands AFTER the burn', async () => {
    // The custom-token mint is the last thing this route does; a throw there
    // is invisible to every named branch and falls to the catch-all.
    createCustomTokenFailure = new Error('signBlob unavailable');
    const res = await session();
    expect(res.status).toBe(500);
    expect(res.body.proofSpent).toBe(true);
  });

  it('...and is NOT marked when it lands BEFORE the burn — nothing was claimed', async () => {
    const res = await request(app).post('/api/auth/phone-session')
      .send({ verificationToken: `boom:${PHONE}:n0`, dateOfBirth: ADULT_DOB });
    expect(res.status).toBe(500);
    expect(consumeVerificationNonce).not.toHaveBeenCalled();
    expect(res.body.proofSpent).toBeUndefined();
  });

  it("the burn's OWN fail-closed refusal is not marked — that would burn an SMS for a Redis blip", async () => {
    burnStoreUnavailable = true;
    const res = await session();
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('VERIFICATION_UNAVAILABLE');
    expect(res.body.proofSpent).toBeUndefined();
  });

  it('REPLAYING a spent proof dies at the burn, before any account work', async () => {
    bootstrapFailure = new Error('firestore down');
    await session({}, 'reused');
    bootstrapFailure = null;
    createUser.mockClear();
    createCustomToken.mockClear();

    const replay = await session({}, 'reused');
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('VERIFICATION_ALREADY_USED');
    // This is the whole point: no recovery branch downstream can ever run for
    // a retry that reuses the cached token.
    expect(createUser).not.toHaveBeenCalled();
    expect(createCustomToken).not.toHaveBeenCalled();
  });

  it('a FRESH proof recovers — the account created before the failure is found, not duplicated', async () => {
    // Attempt 1: Firebase account created, bootstrap fails, orphan rolled back.
    bootstrapFailure = new Error('firestore down');
    expect((await session()).status).toBe(502);

    // Attempt 2 with a NEW code, which is what the client now does.
    bootstrapFailure = null;
    const res = await session();
    expect(res.status).toBe(200);
    expect(res.body.customToken).toBeTruthy();
  });

  it('an EXISTING phone owner needs no account creation, and still burns exactly one proof', async () => {
    fbUsers[EXISTING_UID] = { uid: EXISTING_UID, phoneNumber: PHONE };
    const res = await session();
    expect(res.status).toBe(200);
    expect(res.body.isNewUser).toBe(false);
    expect(createUser).not.toHaveBeenCalled();
    expect(consumeVerificationNonce).toHaveBeenCalledTimes(1);
  });
});

// ── THE CLIENT HALF ────────────────────────────────────────────────────────
// The server can only ANNOUNCE that the proof is spent; the loop is broken
// only if the caller drops its cached token. Source-level pin, in the style
// this repo already uses for cross-file contracts (verifiedEmailOwnershipSweep,
// phoneHmac, and the sibling suite in #2327): mounting the signup page in jsdom
// to assert a couple of setStates would cost far more than it proves.
describe('the client stops reusing a phone proof the server already burned', () => {
  const SRC = readFileSync(
    resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'SignUpLuxury.tsx'),
    'utf8',
  );
  /** The fresh-signup chain: /phone-session through the end of stage 4. */
  const chain = (() => {
    const i = SRC.indexOf("getApiUrl('/api/auth/phone-session')");
    expect(i).toBeGreaterThan(-1);
    const end = SRC.indexOf('Success — clear the cached token', i);
    expect(end).toBeGreaterThan(i);
    return SRC.slice(i, end);
  })();
  const slice = (from: string, to: string) => {
    const a = chain.indexOf(from);
    expect(a).toBeGreaterThan(-1);
    const b = chain.indexOf(to, a);
    expect(b).toBeGreaterThan(a);
    return chain.slice(a, b);
  };

  it('no stage of this chain still promises that a spent code is valid', () => {
    // Stages 3 and 4 run entirely after the burn, and the network branch of
    // stage 2 may too. "Your code is still valid — press verify again" sent
    // members into a loop that could not terminate.
    expect(chain).not.toMatch(/code is still valid/i);
    expect(chain).not.toMatch(/הקוד עדיין תקף/);
  });

  it('the generic server-failure branch clears the token when the server says it is spent', () => {
    const branch = slice('if (!sd?.customToken)', '// ── Stage 3');
    expect(branch).toMatch(/sd\??\.proofSpent === true/);
    expect(branch).toContain('setCachedPhoneVerificationToken(null)');
  });

  it('...and on VERIFICATION_ALREADY_USED — the lost-response case', () => {
    // A burn that succeeded but whose reply never arrived leaves the client
    // holding a spent token with no `proofSpent` to read. Converging on the
    // replay refusal costs one tap and no extra SMS.
    const branch = slice('if (!sd?.customToken)', '// ── Stage 3');
    expect(branch).toMatch(/sd\??\.code === 'VERIFICATION_ALREADY_USED'/);
  });

  it('the Firebase sign-in failure clears unconditionally — a customToken proves the burn landed', () => {
    const branch = slice('signInWithCustomToken(auth, sd.customToken)', 'getIdToken(true)');
    expect(branch).toContain('setCachedPhoneVerificationToken(null)');
    expect(branch).toMatch(/new code|קוד חדש/);
  });

  it('both /api/auth/session failure exits clear too — stage 4 is past the burn by definition', () => {
    const stage4 = chain.slice(chain.indexOf("getApiUrl('/api/auth/session')"));
    // network catch AND the non-ok response branch
    const clears = stage4.match(/setCachedPhoneVerificationToken\(null\)/g) || [];
    expect(clears.length).toBe(2);
    expect(stage4).toMatch(/new code|קוד חדש/);
  });

  it('the phone-session NETWORK error does NOT clear — that request may never have left', () => {
    const branch = slice("logger.error('[signup] phone-session network'", 'const sd =');
    expect(branch).not.toContain('setCachedPhoneVerificationToken(null)');
  });
});
