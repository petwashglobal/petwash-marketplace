/**
 * POST /api/onboarding-verification/validate-tokens — SUBJECT BINDING.
 *
 * A verification token answers exactly one question: "does the bearer control
 * THIS phone / THIS email?" It says nothing whatsoever about WHICH ACCOUNT the
 * answer applies to. This route treated the two as the same thing.
 *
 * PRE-FIX, the route:
 *   - was mounted with the api rate-limiter and NO authentication
 *   - took `userId` straight from the request BODY
 *   - validated an SMS token proving phone X, then called markMobileVerified(userId)
 *   - validated an email token proving email Y, then called markEmailVerified(userId)
 *
 * So possession of the attacker's OWN valid token, plus a victim's UID, mutated
 * the victim's identity state. Same class as the save-card `?uid=` IDOR
 * (saveCardReturnUidOwnership) and the `?userId=` read defect that was already
 * fixed on THIS FILE's sibling route /activation-status — the read path was
 * hardened, the WRITE path was missed.
 *
 * And it is not a decorative flag. markMobileVerified/markEmailVerified run
 * computeStatus(); with AUTH_REQUIRE_BOTH_CONTACTS unset — which is how
 * production is configured, verified 2026-09-08 — ONE verified contact yields
 * 'active', which stamps accountActivatedAt and fires _onFullActivation:
 * wallet seeding, loyalty profile creation with a 100-point join bonus, and
 * MOBILE_VERIFIED / EMAIL_ACTIVATED / WALLET_CREATED domain events. It is an
 * unauthorized identity + activation-state mutation, not a toggle.
 *
 * Fourth defect, in the same branch: markEmailVerified(uid, { acceptTerms: true })
 * writes acceptedTermsAt. Controlling an email address is not agreement to the
 * Terms. Possession is not consent.
 */
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'test-jwt-secret-validate-tokens-0123456789';

// ── Accounts under test ─────────────────────────────────────────────────────
const ATTACKER = { id: 'uid_attacker', email: 'attacker@example.com', phone: '+972500000001' };
const VICTIM   = { id: 'uid_victim',   email: 'victim@example.com',   phone: '+972500000002' };
const NOPHONE  = { id: 'uid_nophone',  email: 'nophone@example.com',  phone: null as string | null };

const ACCOUNTS: Record<string, { id: string; email: string | null; phone: string | null }> = {
  [ATTACKER.id]: { ...ATTACKER },
  [VICTIM.id]: { ...VICTIM },
  [NOPHONE.id]: { ...NOPHONE },
};

// ── Auth: Bearer "<uid>" resolves to that uid ───────────────────────────────
vi.mock('../lib/firebase-admin', () => ({
  auth: {
    verifyIdToken: async (t: string) => {
      if (!t || !ACCOUNTS[t]) throw new Error('bad token');
      return { uid: t };
    },
    verifySessionCookie: async (t: string) => {
      if (!t || !ACCOUNTS[t]) throw new Error('bad cookie');
      return { uid: t };
    },
  },
}));

// ── SMS proof: token "sms:<phone>:<nonce>" proves that phone ────────────────
let smsBurnResult: { ok: true } | { ok: false; reason: string } = { ok: true };
const consumeVerificationNonce = vi.fn(async () => smsBurnResult);
vi.mock('../services/TwilioSMSService', () => ({
  twilioSMSService: {
    validateVerificationToken: (t: string) => {
      const m = /^sms:([^:]+):(.+)$/.exec(t || '');
      return m ? { valid: true, phone: m[1], nonce: m[2] } : { valid: false };
    },
    consumeVerificationNonce,
    sendSMS: vi.fn(async () => ({ success: true })),
  },
}));

// ── Activation writes: spies, so "did the victim get mutated?" is observable ─
const markMobileVerified = vi.fn(async (uid: string) => ({ userId: uid }));
const markEmailVerified = vi.fn(async (uid: string, _o?: any) => ({ userId: uid }));
const getActivationState = vi.fn(async (uid: string) => ({
  userId: uid, activationStatus: 'active', isFullyActive: true,
  accountActivatedAt: new Date(), missingSteps: [],
}));
vi.mock('../services/ActivationService', () => ({
  markMobileVerified: (...a: any[]) => (markMobileVerified as any)(...a),
  markEmailVerified: (...a: any[]) => (markEmailVerified as any)(...a),
  getActivationState: (...a: any[]) => (getActivationState as any)(...a),
  isBothContactsRequired: () => false,
}));

// ── db: account lookup + phone persist ──────────────────────────────────────
let phoneOwnedByOther: string | null = null;
const dbUpdateSet = vi.fn();
vi.mock('../db', () => {
  const selectBuilder = (rows: any[]) => ({
    from: () => ({ where: () => ({ limit: async () => rows }) }),
  });
  return {
    db: {
      select: (cols?: any) => ({
        from: () => ({
          where: (pred: any) => ({
            limit: async () => {
              const key = String(pred?.__uid ?? pred ?? '');
              // Uniqueness probe (by phone) vs account lookup (by id).
              if (key.startsWith('phone:')) {
                const p = key.slice(6);
                return phoneOwnedByOther && p === phoneOwnedByOther ? [{ id: 'uid_someone_else' }] : [];
              }
              const row = ACCOUNTS[key];
              return row ? [row] : [];
            },
          }),
        }),
      }),
      update: () => ({ set: (v: any) => { dbUpdateSet(v); return { where: async () => undefined }; } }),
      insert: () => ({ values: async () => undefined }),
    },
    pool: { query: async () => ({ rows: [] }) },
  };
});

// Drizzle's eq() is stubbed so the mock db can tell the two lookups apart.
vi.mock('drizzle-orm', async (orig) => {
  const actual = await (orig as any)();
  return {
    ...actual,
    eq: (col: any, val: any) => {
      const name = String(col?.name ?? col?.columnName ?? '');
      return name === 'phone' ? `phone:${val}` : String(val);
    },
  };
});

vi.mock('../services/redis', () => ({
  redis: {
    isConnected: () => true,
    get: async () => null, set: async () => true, setRaw: async () => true,
    getRaw: async () => null, del: async () => true, incr: async () => 1,
    expire: async () => true, ttl: async () => -2,
    setNxStrict: async () => 'SET', existsStrict: async () => 'NO',
  },
}));
vi.mock('../emailService', () => ({ EmailService: { sendEmail: vi.fn(async () => ({ success: true })) } }));
vi.mock('../lib/verifyCaptcha', () => ({ verifyCaptchaToken: async () => ({ success: true }) }));
vi.mock('../lib/verifyTurnstile', () => ({ verifyTurnstileToken: async () => ({ success: true }) }));
vi.mock('../lib/luxuryActivationEmail', () => ({ buildActivationEmail: () => ({ subject: 's', html: 'h' }) }));

const router = (await import('../routes/onboarding-verification')).default;

const app = express();
app.use(express.json());
app.use('/api/onboarding-verification', router);

const emailTokenFor = (email: string) =>
  jwt.sign({ email, type: 'email-verified' }, process.env.JWT_SECRET!, { expiresIn: '10m' });
const smsTokenFor = (phone: string, nonce = 'n1') => `sms:${phone}:${nonce}`;

const post = (body: any, asUid?: string) => {
  const r = request(app).post('/api/onboarding-verification/validate-tokens');
  if (asUid) r.set('Authorization', `Bearer ${asUid}`);
  return r.send(body);
};

beforeEach(() => {
  vi.clearAllMocks();
  smsBurnResult = { ok: true };
  phoneOwnedByOther = null;
});

/** Nothing in this suite may ever mutate the victim. */
const expectVictimUntouched = () => {
  const touched = [...markMobileVerified.mock.calls, ...markEmailVerified.mock.calls]
    .some(([uid]) => uid === VICTIM.id);
  expect(touched).toBe(false);
};

describe('the attack: someone else\'s proof, the victim\'s UID', () => {
  it('an attacker SMS token + the victim UID does NOT mark the victim mobile-verified', async () => {
    const res = await post({ userId: VICTIM.id, smsToken: smsTokenFor(ATTACKER.phone) });
    // The mutation is the harm; assert it FIRST so the failure names the real
    // problem rather than the status code. Pre-fix this route answered 200 and
    // called markMobileVerified('uid_victim').
    expectVictimUntouched();
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('an attacker EMAIL token + the victim UID does NOT mark the victim email-verified', async () => {
    const res = await post({ userId: VICTIM.id, emailToken: emailTokenFor(ATTACKER.email) });
    expectVictimUntouched();
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('unauthenticated is refused outright — the route is not public', async () => {
    const res = await post({ userId: VICTIM.id, smsToken: smsTokenFor(ATTACKER.phone) });
    expectVictimUntouched();
    expect(res.status).toBe(401);
  });
});

describe('the body userId carries no authority', () => {
  it('authenticated as the attacker, body userId = victim → the victim is untouched', async () => {
    const res = await post(
      { userId: VICTIM.id, smsToken: smsTokenFor(ATTACKER.phone) },
      ATTACKER.id,
    );
    expectVictimUntouched();
    // Either refused outright, or the body userId is ignored and only the
    // authenticated subject can ever be acted on. Both are safe; silently
    // acting on the victim is not.
    if (res.status < 400) {
      expect(markMobileVerified).toHaveBeenCalledWith(ATTACKER.id);
    }
  });

  it('authenticated as the attacker with NO body userId still works on the attacker', async () => {
    const res = await post({ smsToken: smsTokenFor(ATTACKER.phone) }, ATTACKER.id);
    expect(res.status).toBe(200);
    expect(markMobileVerified).toHaveBeenCalledWith(ATTACKER.id);
  });
});

describe('the verified contact must belong to the account', () => {
  it('a valid SMS token for a DIFFERENT phone than the account holds is refused', async () => {
    // Authenticated as the victim, presenting a genuine proof for someone
    // else's number. Auth alone does not make this legitimate.
    const res = await post({ smsToken: smsTokenFor(ATTACKER.phone) }, VICTIM.id);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(markMobileVerified).not.toHaveBeenCalled();
  });

  it('a valid EMAIL token for a DIFFERENT address than the account holds is refused', async () => {
    const res = await post({ emailToken: emailTokenFor(ATTACKER.email) }, VICTIM.id);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(markEmailVerified).not.toHaveBeenCalled();
  });

  it('the matching contact on the right account succeeds', async () => {
    const res = await post({ smsToken: smsTokenFor(VICTIM.phone!) }, VICTIM.id);
    expect(res.status).toBe(200);
    expect(markMobileVerified).toHaveBeenCalledWith(VICTIM.id);
  });

  it('an account with no phone on file may attach the verified one', async () => {
    const res = await post({ smsToken: smsTokenFor('+972500000009') }, NOPHONE.id);
    expect(res.status).toBe(200);
    expect(markMobileVerified).toHaveBeenCalledWith(NOPHONE.id);
  });

  it('...but not one already belonging to someone else', async () => {
    phoneOwnedByOther = '+972500000009';
    const res = await post({ smsToken: smsTokenFor('+972500000009') }, NOPHONE.id);
    expect(res.status).toBe(409);
    expect(markMobileVerified).not.toHaveBeenCalled();
  });
});

describe('possession of an email is not consent to the Terms', () => {
  it('verifying an email does NOT stamp acceptedTermsAt', async () => {
    const res = await post({ emailToken: emailTokenFor(VICTIM.email) }, VICTIM.id);
    expect(res.status).toBe(200);
    expect(markEmailVerified).toHaveBeenCalled();
    const opts = markEmailVerified.mock.calls[0]?.[1];
    // Terms acceptance needs its own affirmative act, version and evidence.
    expect(opts?.acceptTerms).toBeFalsy();
  });
});

describe('this is a MUTATION boundary, so the proof is one-use', () => {
  it('the SMS proof is burned when it authorises a write', async () => {
    await post({ smsToken: smsTokenFor(VICTIM.phone!, 'nonce-abc') }, VICTIM.id);
    expect(consumeVerificationNonce).toHaveBeenCalledWith('nonce-abc');
  });

  it('a replayed proof is refused and mutates nothing', async () => {
    smsBurnResult = { ok: false, reason: 'already_used' };
    const res = await post({ smsToken: smsTokenFor(VICTIM.phone!) }, VICTIM.id);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('VERIFICATION_ALREADY_USED');
    expect(markMobileVerified).not.toHaveBeenCalled();
  });

  it('an unreachable one-shot store is 503 and mutates nothing — fail closed', async () => {
    smsBurnResult = { ok: false, reason: 'store_unavailable' };
    const res = await post({ smsToken: smsTokenFor(VICTIM.phone!) }, VICTIM.id);
    expect(res.status).toBe(503);
    expect(markMobileVerified).not.toHaveBeenCalled();
  });
});

describe('the route reports the truth about what it did', () => {
  it('a failed activation write is NOT reported as success', async () => {
    // Pre-fix this was caught and swallowed as "non-fatal", returning
    // success:true for a write that never landed.
    markMobileVerified.mockRejectedValueOnce(new Error('db down'));
    const res = await post({ smsToken: smsTokenFor(VICTIM.phone!) }, VICTIM.id);
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.success).not.toBe(true);
  });
});
