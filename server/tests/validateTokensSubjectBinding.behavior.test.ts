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
const fbUpdateUser = vi.fn(async (_uid: string, _p: any) => undefined as any);
/** Who Firebase says owns a number. Only consulted after an "already exists". */
let fbPhoneOwnerUid: string | null = null;
const fbGetUserByPhoneNumber = vi.fn(async (_p: string) => {
  if (!fbPhoneOwnerUid) {
    throw Object.assign(new Error('not found'), { code: 'auth/user-not-found' });
  }
  return { uid: fbPhoneOwnerUid };
});
const phoneAlreadyExists = () =>
  Object.assign(new Error('taken'), { code: 'auth/phone-number-already-exists' });
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
    updateUser: (...a: any[]) => (fbUpdateUser as any)(...a),
    getUserByPhoneNumber: (...a: any[]) => (fbGetUserByPhoneNumber as any)(...a),
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
let dbUpdateThrows: any = null;
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
      update: () => ({
        set: (v: any) => {
          dbUpdateSet(v);
          return { where: async () => { if (dbUpdateThrows) throw dbUpdateThrows; } };
        },
      }),
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
  fbUpdateUser.mockResolvedValue(undefined as any);
  fbPhoneOwnerUid = null;
  dbUpdateThrows = null;
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

/**
 * RESIDUAL of the binding fix, closed here.
 *
 * The binding permits exactly one gap on purpose: a row with NO phone yet may
 * accept the attested number, because nothing stored contradicts it. That is
 * the email-first population — Google / Apple / email signup, whose users row
 * is born with `phone: decoded.phone_number || null` and therefore NULL, and
 * whom client/src/pages/AccountActivation.tsx sends here after prompting for a
 * number precisely because user.phoneNumber is null.
 *
 * The route persisted that number to users.phone but NOT to the Firebase
 * record, and Firebase owns the phone identifier: POST /api/auth/phone-session
 * resolves the account through fbAdminAuth.getUserByPhoneNumber(). So the
 * member finished activation with a verified mobile that phone login could not
 * find — it took the new-user branch and minted a SECOND account for the same
 * person, stranding their wallet, loyalty and history on the first.
 *
 * The three sibling routes have always written the attested contact through
 * updateUser (verify-signup-mobile, verify-signup-email) or derived the account
 * FROM it (phone-session). This one only flipped flags.
 */
describe('an attached number reaches the store that owns phone identity', () => {
  it('an email-first row persists the attested number to BOTH stores', async () => {
    const res = await post({ smsToken: smsTokenFor('+972500000009') }, NOPHONE.id);
    expect(res.status).toBe(200);
    // Postgres: users.phone now holds the number.
    expect(dbUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ phone: '+972500000009' }));
    // Firebase: the record phone-session resolves against holds it too.
    expect(fbUpdateUser).toHaveBeenCalledWith(NOPHONE.id, { phoneNumber: '+972500000009' });
  });

  it('a row that ALREADY holds the number attaches nothing — there is nothing to attach', async () => {
    const res = await post({ smsToken: smsTokenFor(VICTIM.phone!) }, VICTIM.id);
    expect(res.status).toBe(200);
    expect(fbUpdateUser).not.toHaveBeenCalled();
    expect(markMobileVerified).toHaveBeenCalledWith(VICTIM.id);
  });

  it('Firebase is the authoritative uniqueness check — its rejection is 409, not 500', async () => {
    // The users SELECT above is a courtesy that races; updateUser is atomic.
    // Firebase must also NAME the other owner: "already exists" alone is not
    // evidence of one (see the contradicted-probe case at the bottom).
    fbUpdateUser.mockRejectedValueOnce(
      Object.assign(new Error('taken'), { code: 'auth/phone-number-already-exists' }),
    );
    fbPhoneOwnerUid = 'uid_someone_else';
    const res = await post({ smsToken: smsTokenFor('+972500000009') }, NOPHONE.id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PHONE_IN_USE');
    // Nothing was flipped: no verified flag for a number we could not attach.
    expect(markMobileVerified).not.toHaveBeenCalled();
    expect(dbUpdateSet).not.toHaveBeenCalled();
  });

  it('a failed attach is NOT reported as success and flips no flag', async () => {
    fbUpdateUser.mockRejectedValueOnce(new Error('firebase down'));
    const res = await post({ smsToken: smsTokenFor('+972500000009') }, NOPHONE.id);
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.success).not.toBe(true);
    expect(markMobileVerified).not.toHaveBeenCalled();
  });

  it('email needs no attach — the binding already required it to match the row', async () => {
    const res = await post({ emailToken: emailTokenFor(VICTIM.email) }, VICTIM.id);
    expect(res.status).toBe(200);
    expect(fbUpdateUser).not.toHaveBeenCalled();
  });
});

/**
 * The attach returns BETWEEN the two stores, so a Firebase-succeeded /
 * Postgres-failed attempt is a reachable state: the number is on the Firebase
 * record, no flag is flipped, users.phone is still NULL. The member retries.
 *
 * Whether Identity Toolkit no-ops when the SAME uid re-sets the SAME number is
 * decided server-side and is not knowable from the SDK — firebase-admin only
 * relays the backend's PHONE_NUMBER_EXISTS. So the route must not depend on the
 * answer. A blind 409 on "already exists" would tell the member their OWN
 * number belongs to another account and wedge them out of activation for good.
 *
 * Note the probe asks FIREBASE, not Postgres: in this exact failure mode
 * users.phone is still NULL, so re-reading the users table would find nothing
 * and confirm the wrong thing.
 */
describe('a retry after a half-landed attach heals instead of wedging', () => {
  it('"already exists" on a number THIS account already holds is not 409 — it completes', async () => {
    fbUpdateUser.mockRejectedValueOnce(phoneAlreadyExists());
    fbPhoneOwnerUid = NOPHONE.id; // Firebase: the number is already ours.
    const res = await post({ smsToken: smsTokenFor('+972500000009') }, NOPHONE.id);
    expect(res.status).toBe(200);
    // The half that never landed now does.
    expect(dbUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ phone: '+972500000009' }));
    expect(markMobileVerified).toHaveBeenCalledWith(NOPHONE.id);
  });

  it('...but a number a DIFFERENT account holds is still 409, and flips nothing', async () => {
    fbUpdateUser.mockRejectedValueOnce(phoneAlreadyExists());
    fbPhoneOwnerUid = 'uid_someone_else';
    const res = await post({ smsToken: smsTokenFor('+972500000009') }, NOPHONE.id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PHONE_IN_USE');
    expect(markMobileVerified).not.toHaveBeenCalled();
  });

  it('an unreadable ownership probe says "try again", never "belongs to someone else"', async () => {
    fbUpdateUser.mockRejectedValueOnce(phoneAlreadyExists());
    fbGetUserByPhoneNumber.mockRejectedValueOnce(new Error('firebase unreachable'));
    const res = await post({ smsToken: smsTokenFor('+972500000009') }, NOPHONE.id);
    // Ownership was never established, so the terminal claim must not be made.
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.code).not.toBe('PHONE_IN_USE');
    expect(markMobileVerified).not.toHaveBeenCalled();
  });
});

describe('the Postgres half of the attach', () => {
  it('a UNIQUE violation on users.phone is 409, not an inherited constraint 500', async () => {
    // Firebase already accepted the number, so 23505 here means a stale row
    // holds it with no Firebase record — drift, not a second legitimate owner.
    dbUpdateThrows = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    const res = await post({ smsToken: smsTokenFor('+972500000009') }, NOPHONE.id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PHONE_IN_USE');
    expect(markMobileVerified).not.toHaveBeenCalled();
  });

  it('any other write failure is a retryable 500, not a 409', async () => {
    dbUpdateThrows = new Error('connection terminated');
    const res = await post({ smsToken: smsTokenFor('+972500000009') }, NOPHONE.id);
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('PHONE_ATTACH_FAILED');
    expect(markMobileVerified).not.toHaveBeenCalled();
  });
});

/**
 * The narrow edge in the already-exists branch: the probe may CONTRADICT the
 * error that triggered it. Firebase says the number exists, then says nobody
 * holds it (auth/user-not-found — reachable via a delete/merge race). That is
 * not evidence someone else owns it, so the terminal 409 must not be returned:
 * a branch may only say what it has established. Same rule as the unreadable
 * probe, and the asymmetry is the point — one is retryable, the other is not.
 */
describe('the attach only ever claims what it has established', () => {
  it('a probe that says NOBODY owns the number is not "it belongs to someone else"', async () => {
    fbUpdateUser.mockRejectedValueOnce(phoneAlreadyExists());
    fbPhoneOwnerUid = null; // → the mock throws auth/user-not-found
    const res = await post({ smsToken: smsTokenFor('+972500000009') }, NOPHONE.id);
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('PHONE_ATTACH_FAILED');
    expect(res.body.code).not.toBe('PHONE_IN_USE');
    expect(markMobileVerified).not.toHaveBeenCalled();
  });

  it('a probe returning a user with no uid is treated the same way', async () => {
    fbUpdateUser.mockRejectedValueOnce(phoneAlreadyExists());
    fbGetUserByPhoneNumber.mockResolvedValueOnce({} as any);
    const res = await post({ smsToken: smsTokenFor('+972500000009') }, NOPHONE.id);
    expect(res.status).toBe(500);
    expect(res.body.code).not.toBe('PHONE_IN_USE');
    expect(markMobileVerified).not.toHaveBeenCalled();
  });
});
