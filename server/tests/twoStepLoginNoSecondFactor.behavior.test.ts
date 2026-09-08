/**
 * A GATE MAY NOT DEMAND A PROOF IT HAS NOT ESTABLISHED CAN BE PRODUCED.
 *
 * `users.two_factor_enabled` records a member's CHOICE — "one-way verification
 * is not enough for me". It does not say a second factor can be PRODUCED. Three
 * parties disagreed about a member enrolled with no phone in either store:
 *
 *   POST /api/auth/session         gated on the flag ALONE      → 428 MFA_REQUIRED
 *   POST /api/auth/login/2fa/start meant to fail open           → { needed: false }
 *   SignUpLuxury.tsx               read needed:false as failure → "please try again"
 *
 * The start route's fail-open was sound reasoning in a route with no power to
 * act on it: it does not mint sessions, so the retry it invited hit the same 428.
 * Password sign-in was permanently blocked, and the reason was never stated.
 *
 * WHICH PARTY WAS WRONG: the session gate. It is the only one that mints a
 * session, so no fix confined to the start route or the client could work; and
 * it was the one holding an unchecked assumption — that an SMS proof is
 * obtainable. The refusal itself is CORRECT and is kept: password alone is
 * one-way verification, which is what this member opted out of. What changes is
 * that the gate now establishes which true thing it means, and says it:
 *
 *   a code can be sent          → 428 MFA_REQUIRED  (produce the proof)
 *   established there is none   → 403 MFA_NO_FACTOR (sign in another way)
 *
 * That is not a lockout. Email one-time-code is the primary login CTA on this
 * screen, it does not carry sign_in_provider 'password' so the gate never sees
 * it, and it is itself the second factor the member asked for.
 *
 * TWO STORES, ONE CLAIM (the invariant #2322/#2327 established): "no phone on
 * file" is a claim about Postgres AND the Firebase auth record. Concluding
 * `none` from Postgres alone would strip 2FA from a member holding a verified
 * number on their Firebase record — so a lookup that cannot establish the answer
 * yields `unresolved`, which keeps the 428 and never the no-factor refusal.
 */
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'test-jwt-secret-two-step-no-factor-0123456789';

const MEMBER = 'uid_member';
const PG_PHONE = '+972500000111';
const FB_PHONE = '+972500000222';

// ── Firebase: the store that owns phone identity ────────────────────────────
type FbUser = { uid: string; phoneNumber: string | null };
let fbUsers: Record<string, FbUser>;
let getUserThrows: Error | null = null;
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
    updateUser: vi.fn(async () => undefined),
    getUserByPhoneNumber: vi.fn(async () => { throw Object.assign(new Error('nf'), { code: 'auth/user-not-found' }); }),
    getUser: (...a: any[]) => (getUser as any)(...a),
  },
  db: { collection: () => ({ doc: () => ({ set: async () => undefined, get: async () => ({ exists: false }) }) }) },
}));

// ── SMS: the observable answer to "was this member actually challenged?" ────
const sendVerificationCode = vi.fn(async (_p: string, _l?: string, _ip?: string) => ({ success: true }));
const verifyCode = vi.fn(async (_p: string, _c: string, _l?: string) => ({ success: true }));
vi.mock('../services/TwilioSMSService', () => ({
  twilioSMSService: {
    validateVerificationToken: () => ({ valid: false }),
    consumeVerificationNonce: vi.fn(async () => ({ ok: true })),
    sendVerificationCode: (...a: any[]) => (sendVerificationCode as any)(...a),
    verifyCode: (...a: any[]) => (verifyCode as any)(...a),
    sendSMS: vi.fn(async () => ({ success: true })),
  },
}));

// ── Postgres: programmable, including failure ───────────────────────────────
type PgHandler = (sql: string, params: any[]) => any;
let pgHandler: PgHandler = () => ({ rows: [] });
vi.mock('../db', () => ({
  pool: { query: async (sql: string, params: any[] = []) => pgHandler(String(sql), params) },
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    insert: () => ({ values: async () => undefined, onConflictDoNothing: async () => undefined }),
    execute: async () => ({ rows: [] }),
  },
}));

// A proof token is valid only when it was minted FOR this uid (mfaLoginToken's
// real binding, reproduced so the gate's proof branch is exercised honestly).
vi.mock('../lib/mfaLoginToken', () => ({
  mintMfaLoginToken: (uid: string) => `mfa:${uid}`,
  validateMfaLoginToken: (token: string, uid: string) =>
    (token && token === `mfa:${uid}` ? { valid: true } : { valid: false, reason: 'missing' }),
}));

// ── Everything else publicAuthRoutes pulls in at import time ────────────────
vi.mock('../services/ActivationService', () => ({
  markMobileVerified: vi.fn(async () => undefined),
  markEmailVerified: vi.fn(async () => undefined),
  getActivationState: async (uid: string) => ({ userId: uid, activationStatus: 'active' }),
  isBothContactsRequired: () => false,
}));
vi.mock('../middleware/rateLimiter', () => ({ apiLimiter: (_r: any, _s: any, n: any) => n(), authLimiter: (_r: any, _s: any, n: any) => n() }));
vi.mock('../middleware/rateLimiterRedisStore', () => ({ redisRateLimitStore: () => undefined }));
vi.mock('express-rate-limit', () => ({ default: () => (_r: any, _s: any, n: any) => n(), ipKeyGenerator: (ip: string) => ip }));
vi.mock('../simpleAuth', () => ({ getCurrentUser: async () => null }));
vi.mock('../lib/phoneHmac', () => ({ phoneLookupHash: (p: string) => `h:${p}` }));
vi.mock('../lib/verifyCaptcha', () => ({ verifyCaptchaToken: async () => ({ success: true }) }));
vi.mock('../lib/verifyTurnstile', () => ({ verifyTurnstileToken: async () => ({ success: true }) }));
vi.mock('../lib/feature-flags/unifiedVerification', () => ({ isUnifiedVerificationSignupEnabled: () => false }));
vi.mock('../services/UnifiedVerificationService', () => ({ UnifiedVerificationError: class extends Error {}, unifiedVerificationService: {} }));
vi.mock('../storage', () => ({ storage: {} }));
vi.mock('../services/authBootstrap', () => ({ ensureUserProvisioned: async () => ({ ok: true }), AuthBootstrapUsersRowFailed: class extends Error {} }));
vi.mock('../lib/emailVerifiedToken', () => ({ redeemEmailVerifiedToken: async () => ({ ok: false }) }));
vi.mock('../services/RegistrationOTPService', () => ({ registrationOTPService: {} }));
vi.mock('../services/MembershipService', () => ({ assignCustomerMembership: async () => undefined }));
vi.mock('../sms/templates/welcome-sms-templates', () => ({ renderWelcomeSMS: () => 'hi', getTemplateId: () => 'welcome' }));
vi.mock('../services/redis', () => ({
  redis: {
    isConnected: () => true, get: async () => null, set: async () => true, setRaw: async () => true,
    getRaw: async () => null, del: async () => true, incr: async () => 1, expire: async () => true,
    ttl: async () => -2, setNxStrict: async () => 'SET', existsStrict: async () => 'NO',
  },
}));
vi.mock('../emailService', () => ({ EmailService: { sendEmail: vi.fn(async () => ({ success: true })) } }));

const { publicAuthRouter } = await import('../routes/publicAuthRoutes');
const { decidePasswordLoginTwoStep } = await import('../lib/twoStepLogin');

const app = express();
app.use(express.json());
app.use(publicAuthRouter);

const start2fa = () => request(app).post('/api/auth/login/2fa/start').send({ idToken: MEMBER });
const verify2fa = () => request(app).post('/api/auth/login/2fa/verify').send({ idToken: MEMBER, code: '123456' });

/** The users row this member has: enrolled or not, with or without a PG phone. */
const rowIs = (enrolled: boolean, phone: string | null) => {
  pgHandler = (sql) =>
    (/two_factor_enabled/i.test(sql) ? { rows: [{ phone, two_factor_enabled: enrolled }] } : { rows: [] });
};

const ROOT = join(__dirname, '..', '..');
const routesSrc = readFileSync(join(ROOT, 'server/routes.ts'), 'utf8');
const clientSrc = readFileSync(join(ROOT, 'client/src/pages/SignUpLuxury.tsx'), 'utf8');

beforeEach(() => {
  vi.clearAllMocks();
  getUserThrows = null;
  fbUsers = { [MEMBER]: { uid: MEMBER, phoneNumber: null } };
  rowIs(true, null);
});

// ── THE SESSION GATE — the party that was wrong ─────────────────────────────
describe('the session gate establishes a challenge is possible before demanding one', () => {
  it('refuses password sign-in as MFA_NO_FACTOR when neither store holds a number', async () => {
    const d = await decidePasswordLoginTwoStep(MEMBER, undefined);
    // The harm was the impossible demand, so assert what is NOT said first.
    expect(d.action).not.toBe('challenge');
    expect(d.action).toBe('no_factor');
  });

  it('still challenges when the number is on the users row', async () => {
    rowIs(true, PG_PHONE);
    expect(await decidePasswordLoginTwoStep(MEMBER, undefined)).toEqual({ action: 'challenge', reason: 'missing' });
  });

  it('still challenges when the number is ONLY on the Firebase record', async () => {
    // Postgres alone would read this member as "no phone" and wrongly wave the
    // 2FA they opted into. The other store is the one that holds their identity.
    fbUsers[MEMBER].phoneNumber = FB_PHONE;
    expect(await decidePasswordLoginTwoStep(MEMBER, undefined)).toEqual({ action: 'challenge', reason: 'missing' });
  });

  it('challenges rather than declaring "no factor" when the phone cannot be established', async () => {
    getUserThrows = Object.assign(new Error('firebase down'), { code: 'auth/internal-error' });
    const d = await decidePasswordLoginTwoStep(MEMBER, undefined);
    expect(d.action).toBe('challenge');       // status quo for this member
    expect(d.action).not.toBe('no_factor');   // guessing "none" IS the silent downgrade
    expect(d.action).not.toBe('allow');       // and it must never mint a session either
  });

  it('accepts a valid proof without needing to resolve a phone at all', async () => {
    expect(await decidePasswordLoginTwoStep(MEMBER, `mfa:${MEMBER}`)).toEqual({ action: 'allow', reason: 'proof_accepted' });
    expect(getUser).not.toHaveBeenCalled();
  });

  it('never gates a member who did not opt in', async () => {
    rowIs(false, null);
    expect(await decidePasswordLoginTwoStep(MEMBER, undefined)).toEqual({ action: 'allow', reason: 'not_enrolled' });
  });

  it('keeps the fail-safe: an unreadable users row allows the login, it does not block it', async () => {
    pgHandler = () => { throw Object.assign(new Error('connection terminated'), { code: '57P01' }); };
    expect(await decidePasswordLoginTwoStep(MEMBER, undefined)).toEqual({ action: 'allow', reason: 'state_unreadable' });
  });

  it('routes.ts reaches its verdict through the shared decision, not the flag alone', () => {
    // Anchored on the gate's own marker — 'password' alone also matches the
    // reCAPTCHA block above it — and bounded by the end of the pre-validation try.
    const from = routesSrc.indexOf('// 3. 2-STEP LOGIN gate');
    expect(from, '2-step gate block not found in server/routes.ts').toBeGreaterThan(-1);
    const block = routesSrc.slice(from, routesSrc.indexOf('} catch (preValidErr', from));
    expect(block).toMatch(/signInProvider === 'password'/);
    expect(block).toMatch(/decidePasswordLoginTwoStep/);
    expect(block).toMatch(/MFA_NO_FACTOR/);
    // The exact shape that produced the lockout: 428 emitted straight off the flag.
    expect(block).not.toMatch(/two_factor_enabled === true/);
  });
});

// ── THE START ROUTE — same verdict, in terms the client can act on ──────────
describe('/api/auth/login/2fa/start states the same verdict as the gate', () => {
  it('no longer answers a bare needed:false to an enrolled member with no phone', async () => {
    const r = await start2fa();
    expect(r.body.code).toBe('MFA_NO_FACTOR');
    expect(r.status).toBe(403);
    expect(sendVerificationCode).not.toHaveBeenCalled();
    // The old reply the client could only read as failure.
    expect(r.body).not.toEqual({ ok: true, needed: false, reason: 'no_phone' });
  });

  it('sends the code to the number on the users row', async () => {
    rowIs(true, PG_PHONE);
    const r = await start2fa();
    expect(r.status).toBe(200);
    expect(r.body.needed).toBe(true);
    expect(sendVerificationCode).toHaveBeenCalledWith(PG_PHONE, 'he', expect.anything());
  });

  it('challenges a member whose number is only on their Firebase record', async () => {
    fbUsers[MEMBER].phoneNumber = FB_PHONE;
    const r = await start2fa();
    expect(r.status).toBe(200);
    expect(r.body.needed).toBe(true);
    expect(sendVerificationCode).toHaveBeenCalledWith(FB_PHONE, 'he', expect.anything());
  });

  it('refuses visibly, never as "no factor", when the phone cannot be established', async () => {
    getUserThrows = Object.assign(new Error('firebase down'), { code: 'auth/internal-error' });
    const r = await start2fa();
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('TWO_FACTOR_UNAVAILABLE');
    expect(r.body.code).not.toBe('MFA_NO_FACTOR');
  });

  it('stays a no-op for a member who did not opt in', async () => {
    rowIs(false, null);
    const r = await start2fa();
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, needed: false });
    expect(sendVerificationCode).not.toHaveBeenCalled();
  });

  it('verify accepts the code against the SAME number start sent it to (Firebase-only)', async () => {
    // Reading Postgres alone here would reject a correct code.
    fbUsers[MEMBER].phoneNumber = FB_PHONE;
    await start2fa();
    const r = await verify2fa();
    expect(verifyCode).toHaveBeenCalledWith(FB_PHONE, '123456', 'he');
    expect(r.status).toBe(200);
    expect(r.body.mfaToken).toBeTruthy();
  });

  it('verify accepts the code against the SAME number start sent it to (Postgres-only)', async () => {
    // The mirror case, and the one a resolver that skipped Postgres when handed
    // no row would break: start texts the users-row number, verify must match it.
    rowIs(true, PG_PHONE);
    await start2fa();
    expect(sendVerificationCode).toHaveBeenCalledWith(PG_PHONE, 'he', expect.anything());
    const r = await verify2fa();
    expect(verifyCode).toHaveBeenCalledWith(PG_PHONE, '123456', 'he');
    expect(r.status).toBe(200);
  });
});

// ── THE CLIENT — guidance, not a retry that cannot succeed ──────────────────
describe('the client turns the refusal into the path that works', () => {
  it('handles MFA_NO_FACTOR from the session gate instead of "Sign-in failed — try again"', () => {
    const login = /async function loginWithPassword\(\)[\s\S]*?\n  \}/.exec(clientSrc);
    expect(login, 'loginWithPassword not found').toBeTruthy();
    const block = login![0];
    expect(block).toMatch(/r\.status === 403/);
    expect(block).toMatch(/errorCode === 'MFA_NO_FACTOR'/);
    expect(block).toMatch(/showNoSecondFactor\(\)/);
  });

  it('offers the one-time-code path rather than telling the member to try again', () => {
    const helper = /function showNoSecondFactor\(\)[\s\S]*?\n  \}/.exec(clientSrc);
    expect(helper, 'showNoSecondFactor not found').toBeTruthy();
    // usePassword=false makes the primary CTA "Email me a one-time code".
    expect(helper![0]).toMatch(/setUsePassword\(false\)/);
    expect(helper![0]).not.toMatch(/try again|נסו שוב/);
  });

  it('names ONLY a remedy the member can actually perform', async () => {
    // An earlier draft of this very fix said "then add a mobile number in your
    // account". A member cannot: no screen calls
    // /api/user/settings/phone/request-change, and production does not set
    // UNIFIED_VERIFICATION_CHANGE_PHONE_ENABLED, so it answers 503. Replacing a
    // retry that cannot succeed with an instruction that cannot be followed is
    // the same fault one step along. Restore this only with the flow live.
    const { MFA_NO_FACTOR_MESSAGE } = await import('../lib/twoStepLogin');
    const helper = /function showNoSecondFactor\(\)[\s\S]*?\n  \}/.exec(clientSrc)![0];
    for (const copy of [MFA_NO_FACTOR_MESSAGE, helper]) {
      expect(copy).not.toMatch(/add a mobile number|הוסיפו מספר נייד/);
    }
    // What it DOES say is the path that works, and that path is real.
    expect(MFA_NO_FACTOR_MESSAGE).toMatch(/one-time code/);
    expect(helper).toMatch(/קוד חד-פעמי/);
  });
});
