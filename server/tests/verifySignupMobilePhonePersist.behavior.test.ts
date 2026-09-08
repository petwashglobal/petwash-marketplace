/**
 * TWO STORES, ONE CLAIM — the residual of #2322, on the mirror-image route.
 *
 * "Persisted" in this repo is TWO questions: Postgres AND the Firebase auth
 * record. Firebase owns phone IDENTITY (/api/auth/phone-session resolves the
 * account through getUserByPhoneNumber), Postgres owns what the platform reads.
 * #2322 fixed a route that wrote Postgres but not Firebase. This is the other
 * half: /api/auth/verify-signup-mobile wrote Firebase, then wrote Postgres
 * BEST-EFFORT, with a fallback that dropped the contact and kept the flag:
 *
 *   catch { UPDATE users SET phone_verified = true WHERE id = $1 }
 *
 * The row then asserted a verified phone it could not produce.
 *
 * THE HARM IS A SILENT 2FA DOWNGRADE. /api/auth/login/2fa/start reads
 * `SELECT phone, two_factor_enabled` and, on a NULL phone, deliberately fails
 * open — "opted in but no phone on file → cannot challenge; ... they can
 * add/verify a phone later". That reasoning is sound under its own premise.
 * The drift violates the premise: the member DOES have a verified phone, on
 * their Firebase record, and has already done the thing the comment offers as
 * the remedy. So a security control they explicitly opted into switched itself
 * off, and nothing surfaced it. Not a read that fails — a safety valve firing
 * on a condition it was never designed to see.
 *
 * These pins hold both halves:
 *   - the write path may not keep the FLAG while dropping the CONTACT, and a
 *     failed persist must not reach markMobileVerified (which sets
 *     phoneVerified: true unconditionally, re-creating the same claim);
 *   - the read path may not conclude "no phone on file" from Postgres alone.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'test-jwt-secret-verify-signup-mobile-0123456789';

const MEMBER = 'uid_member';
const OTHER = 'uid_other_account';
const PHONE = '+972500000111';

// ── Firebase: the store that owns phone identity ────────────────────────────
type FbUser = { uid: string; phoneNumber: string | null };
let fbUsers: Record<string, FbUser>;
/** uid that updateUser should reject with auth/phone-number-already-exists */
let updateUserFailure: { code?: string; message?: string } | null = null;
let getUserThrows: Error | null = null;
let phoneOwnerProbe: (() => Promise<FbUser>) | null = null;

const updateUser = vi.fn(async (uid: string, patch: any) => {
  if (updateUserFailure) throw Object.assign(new Error('update failed'), updateUserFailure);
  fbUsers[uid] = { uid, phoneNumber: patch.phoneNumber ?? fbUsers[uid]?.phoneNumber ?? null };
  return fbUsers[uid];
});
const getUserByPhoneNumber = vi.fn(async (phone: string) => {
  if (phoneOwnerProbe) return phoneOwnerProbe();
  const hit = Object.values(fbUsers).find((u) => u.phoneNumber === phone);
  if (!hit) throw Object.assign(new Error('not found'), { code: 'auth/user-not-found' });
  return hit;
});
const getUser = vi.fn(async (uid: string) => {
  if (getUserThrows) throw getUserThrows;
  const u = fbUsers[uid];
  if (!u) throw Object.assign(new Error('not found'), { code: 'auth/user-not-found' });
  return u;
});

vi.mock('../lib/firebase-admin', () => ({
  auth: {
    verifyIdToken: async (t: string) => {
      if (!t || !String(t).startsWith('uid_')) throw new Error('bad token');
      return { uid: t };
    },
    verifySessionCookie: async (t: string) => ({ uid: t }),
    updateUser: (...a: any[]) => (updateUser as any)(...a),
    getUserByPhoneNumber: (...a: any[]) => (getUserByPhoneNumber as any)(...a),
    getUser: (...a: any[]) => (getUser as any)(...a),
  },
  db: { collection: () => ({ doc: () => ({ set: async () => undefined, get: async () => ({ exists: false }) }) }) },
}));

// ── SMS proof: token "sms:<phone>:<nonce>" proves that phone ────────────────
const sendVerificationCode = vi.fn(async (_p: string, _l?: string, _ip?: string) => ({ success: true }));
const verifyCode = vi.fn(async (_p: string, _c: string, _l?: string) => ({ success: true }));
vi.mock('../services/TwilioSMSService', () => ({
  twilioSMSService: {
    validateVerificationToken: (t: string) => {
      const m = /^sms:([^:]+):(.+)$/.exec(t || '');
      return m ? { valid: true, phone: m[1], nonce: m[2] } : { valid: false };
    },
    consumeVerificationNonce: vi.fn(async () => ({ ok: true })),
    sendVerificationCode: (...a: any[]) => (sendVerificationCode as any)(...a),
    verifyCode: (...a: any[]) => (verifyCode as any)(...a),
    sendSMS: vi.fn(async () => ({ success: true })),
  },
}));

// ── Postgres: every query is observable, and failures are programmable ──────
type PgHandler = (sql: string, params: any[]) => Promise<{ rows: any[] }> | { rows: any[] };
const pgCalls: Array<{ sql: string; params: any[] }> = [];
let pgHandler: PgHandler = () => ({ rows: [] });
const poolQuery = vi.fn(async (sql: string, params: any[] = []) => {
  pgCalls.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params });
  return await pgHandler(String(sql), params);
});
vi.mock('../db', () => ({
  pool: { query: (...a: any[]) => (poolQuery as any)(...a) },
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    insert: () => ({ values: async () => undefined, onConflictDoNothing: async () => undefined }),
    execute: async () => ({ rows: [] }),
  },
}));

// ── Activation: the spy that answers "did the row get told it's verified?" ──
const markMobileVerified = vi.fn(async (uid: string) => ({ userId: uid }));
const markEmailVerified = vi.fn(async (uid: string) => ({ userId: uid }));
vi.mock('../services/ActivationService', () => ({
  markMobileVerified: (...a: any[]) => (markMobileVerified as any)(...a),
  markEmailVerified: (...a: any[]) => (markEmailVerified as any)(...a),
  getActivationState: async (uid: string) => ({ userId: uid, activationStatus: 'active' }),
  isBothContactsRequired: () => false,
}));

// ── Everything else the module pulls in at import time ──────────────────────
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
vi.mock('../storage', () => ({ storage: {} }));
vi.mock('../services/authBootstrap', () => ({
  ensureUserProvisioned: async () => ({ ok: true }),
  AuthBootstrapUsersRowFailed: class extends Error {},
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

const attach = (uid: string, phone: string) =>
  request(app).post('/api/auth/verify-signup-mobile')
    .send({ idToken: uid, verificationToken: `sms:${phone}:nonce1` });

const start2fa = (uid: string) =>
  request(app).post('/api/auth/login/2fa/start').send({ idToken: uid });

const verify2fa = (uid: string) =>
  request(app).post('/api/auth/login/2fa/verify').send({ idToken: uid, code: '123456' });

/** Did any query flip the verified FLAG without also writing the CONTACT? */
const flagWrittenWithoutContact = () =>
  pgCalls.some(
    (c) => /UPDATE users SET/i.test(c.sql) && /phone_verified/i.test(c.sql) && !/SET phone =/i.test(c.sql),
  );

const phonePersisted = () =>
  pgCalls.some((c) => /UPDATE users SET phone = \$1, phone_verified = true/i.test(c.sql) && c.params[0] === PHONE);

beforeEach(() => {
  vi.clearAllMocks();
  pgCalls.length = 0;
  fbUsers = { [MEMBER]: { uid: MEMBER, phoneNumber: null }, [OTHER]: { uid: OTHER, phoneNumber: null } };
  updateUserFailure = null;
  getUserThrows = null;
  phoneOwnerProbe = null;
  pgHandler = () => ({ rows: [] });
});

// ── THE WRITE PATH ──────────────────────────────────────────────────────────
describe('verify-signup-mobile: the row may not claim a phone it did not record', () => {
  it('the happy path writes BOTH stores and only then marks mobile verified', async () => {
    const res = await attach(MEMBER, PHONE);
    expect(res.status).toBe(200);
    expect(fbUsers[MEMBER].phoneNumber).toBe(PHONE);
    expect(phonePersisted()).toBe(true);
    expect(markMobileVerified).toHaveBeenCalledWith(MEMBER);
  });

  it('a failed users write NEVER falls back to phone_verified-without-phone', async () => {
    pgHandler = (sql) => {
      if (/UPDATE users SET/i.test(sql)) throw Object.assign(new Error('deadlock'), { code: '40P01' });
      return { rows: [] };
    };
    const res = await attach(MEMBER, PHONE);
    // The claim is the harm: assert it before the status code.
    expect(flagWrittenWithoutContact()).toBe(false);
    expect(markMobileVerified).not.toHaveBeenCalled();
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.code).toBe('PHONE_PERSIST_FAILED');
  });

  it('a failed persist is retryable, and the retry heals the half that did not land', async () => {
    // Attempt 1: Firebase accepts, Postgres refuses.
    pgHandler = (sql) => {
      if (/UPDATE users SET/i.test(sql)) throw Object.assign(new Error('deadlock'), { code: '40P01' });
      return { rows: [] };
    };
    expect((await attach(MEMBER, PHONE)).status).toBeGreaterThanOrEqual(500);
    expect(fbUsers[MEMBER].phoneNumber).toBe(PHONE); // Firebase kept it

    // Attempt 2: re-attaching a number this uid ALREADY holds must not read as
    // "belongs to another account" — that would wedge the member out for good.
    pgCalls.length = 0;
    pgHandler = () => ({ rows: [] });
    updateUserFailure = { code: 'auth/phone-number-already-exists' };
    const res = await attach(MEMBER, PHONE);
    expect(res.status).toBe(200);
    expect(res.body.code).not.toBe('PHONE_IN_USE');
    expect(phonePersisted()).toBe(true);
    expect(markMobileVerified).toHaveBeenCalledWith(MEMBER);
  });

  it('a number a DIFFERENT account holds is still refused 409, and flips nothing', async () => {
    fbUsers[OTHER].phoneNumber = PHONE;
    updateUserFailure = { code: 'auth/phone-number-already-exists' };
    const res = await attach(MEMBER, PHONE);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PHONE_IN_USE');
    expect(markMobileVerified).not.toHaveBeenCalled();
    expect(flagWrittenWithoutContact()).toBe(false);
  });

  it('an UNREADABLE ownership probe is retryable, never "belongs to someone else"', async () => {
    updateUserFailure = { code: 'auth/phone-number-already-exists' };
    phoneOwnerProbe = async () => { throw new Error('identity toolkit unavailable'); };
    const res = await attach(MEMBER, PHONE);
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.code).not.toBe('PHONE_IN_USE');
    expect(markMobileVerified).not.toHaveBeenCalled();
  });

  it('a probe that names NOBODY has not established another owner', async () => {
    updateUserFailure = { code: 'auth/phone-number-already-exists' };
    phoneOwnerProbe = async () => ({ uid: '', phoneNumber: PHONE });
    const res = await attach(MEMBER, PHONE);
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.code).not.toBe('PHONE_IN_USE');
  });

  it('a 23505 on users.phone answers 409, not an inherited constraint 500', async () => {
    pgHandler = (sql) => {
      if (/UPDATE users SET/i.test(sql)) throw Object.assign(new Error('dup'), { code: '23505' });
      return { rows: [] };
    };
    const res = await attach(MEMBER, PHONE);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PHONE_IN_USE');
    expect(markMobileVerified).not.toHaveBeenCalled();
  });
});

// ── THE READ PATH ───────────────────────────────────────────────────────────
describe('login 2FA: "no phone on file" is a claim about BOTH stores', () => {
  /** users row: opted into 2FA, but the contact never landed in Postgres. */
  const driftedRow = () => {
    pgHandler = (sql) =>
      /SELECT phone/i.test(sql) ? { rows: [{ phone: null, two_factor_enabled: true }] } : { rows: [] };
  };

  it('an opted-in member whose number is on the FIREBASE record is challenged, not downgraded', async () => {
    driftedRow();
    fbUsers[MEMBER].phoneNumber = PHONE;
    const res = await start2fa(MEMBER);
    expect(res.status).toBe(200);
    expect(res.body.needed).toBe(true);
    expect(res.body.reason).not.toBe('no_phone');
    expect(sendVerificationCode).toHaveBeenCalledWith(PHONE, expect.anything(), expect.anything());
  });

  it('a member with genuinely NO number in either store still fails open', async () => {
    driftedRow();
    fbUsers[MEMBER].phoneNumber = null;
    const res = await start2fa(MEMBER);
    expect(res.status).toBe(200);
    expect(res.body.needed).toBe(false);
    expect(res.body.reason).toBe('no_phone');
    expect(sendVerificationCode).not.toHaveBeenCalled();
  });

  it('an UNREADABLE Firebase record refuses visibly rather than switching 2FA off', async () => {
    driftedRow();
    getUserThrows = new Error('identity toolkit unavailable');
    const res = await start2fa(MEMBER);
    expect(res.body.needed).not.toBe(false);
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.code).toBe('TWO_FACTOR_UNAVAILABLE');
    expect(sendVerificationCode).not.toHaveBeenCalled();
  });

  it('a member who never opted in is untouched — and costs no Firebase read', async () => {
    pgHandler = (sql) =>
      /SELECT phone/i.test(sql) ? { rows: [{ phone: null, two_factor_enabled: false }] } : { rows: [] };
    const res = await start2fa(MEMBER);
    expect(res.status).toBe(200);
    expect(res.body.needed).toBe(false);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('verify checks the code against the SAME number start sent it to', async () => {
    pgHandler = (sql) => (/SELECT phone/i.test(sql) ? { rows: [{ phone: null }] } : { rows: [] });
    fbUsers[MEMBER].phoneNumber = PHONE;
    const res = await verify2fa(MEMBER);
    expect(res.status).toBe(200);
    expect(res.body.mfaToken).toBe(`mfa:${MEMBER}`);
    expect(verifyCode).toHaveBeenCalledWith(PHONE, '123456', expect.anything());
  });

  it('verify refuses visibly when the record is unreadable, and mints no proof', async () => {
    pgHandler = (sql) => (/SELECT phone/i.test(sql) ? { rows: [{ phone: null }] } : { rows: [] });
    getUserThrows = new Error('identity toolkit unavailable');
    const res = await verify2fa(MEMBER);
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.mfaToken).toBeUndefined();
    expect(verifyCode).not.toHaveBeenCalled();
  });
});
