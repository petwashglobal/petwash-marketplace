/**
 * THE THIRD WAY INTO ONE CLAIM — provider phone verification.
 *
 * "Persisted" in this repo is TWO questions: Postgres AND the Firebase auth
 * record (#2322, #2327). POST /api/provider/phone/verify-otp answered neither
 * properly. On success it wrote:
 *
 *   Firestore users/<uid>  { phone, phoneVerified: true }
 *   Postgres  users        SET phone_verified = true, phone_e164 = <number>
 *
 * and nothing else. `users.phone` — the UNIQUE column every identity reader
 * consults — stayed NULL, and admin.auth().updateUser() was never called, so
 * the Firebase auth record had no phoneNumber either. The row asserted a
 * verified phone that neither store the platform queries could produce.
 *
 * THREE CONSEQUENCES, in ascending order of how quickly a real provider hits
 * them:
 *
 *  1. THE WIZARD'S OWN NEXT STEP REJECTS THEM. POST /api/provider/onboarding
 *     gates on `authenticatedUser.phone_number` (the Firebase auth record, via
 *     the ID-token claim) OR `users.mobile_verified_at`. This route wrote
 *     neither — it set the bare `phone_verified` boolean that
 *     markMobileVerified's own comment calls drift. So the applicant verified
 *     their phone on one screen and was told PHONE_NOT_VERIFIED on the next,
 *     and the remedy the error offers is the thing they had just done.
 *
 *  2. A SILENT 2FA DOWNGRADE. /api/auth/login/2fa/start resolves the number
 *     from users.phone, falling back to the Firebase auth record (#2327).
 *     Neither holds anything here, so a provider who opted into 2-step login
 *     is told "no phone on file" and the control switches itself off.
 *
 *  3. A SECOND FIREBASE ACCOUNT. /api/auth/phone-session resolves accounts
 *     through getUserByPhoneNumber(). An unattached number cannot log its
 *     owner in, so signing in by it mints a duplicate account — the defect
 *     #2322 documents, reached from here.
 *
 * WHY users.phone AND NOT phone_e164. `users.phone_e164` has exactly one
 * reader in the repository (server/backgroundJobs.ts, the pet-birthday SMS)
 * and that reader already spells `phone_e164 || phone`. No migration in
 * migrations/ ever creates it. It is a shadow column, not a canonical contact,
 * and Firebase — which cannot be taught a second column — resolves on the real
 * number regardless. So the fix backfills the identity column and demotes
 * phone_e164 to the non-authoritative convenience it already is.
 *
 * These pins hold the whole contract: both stores or neither, E.164 so the
 * UNIQUE index can dedupe, ownership asked rather than assumed, and no
 * success reported for a write that did not land.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const MEMBER = 'uid_provider';
const OTHER = 'uid_other_account';
const PHONE_E164 = '+972541234567';
const PHONE_AS_TYPED = '0541234567';

// ── Firebase auth: the store that owns phone IDENTITY ───────────────────────
type FbUser = { uid: string; phoneNumber: string | null };
let fbUsers: Record<string, FbUser>;
/** When set, updateUser rejects with this error instead of writing. */
let updateUserFailure: { code?: string; message?: string } | null = null;
/** When set, the ownership probe runs this instead of reading fbUsers. */
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

// ── Firestore: an in-memory store with production's read semantics ──────────
// A Date written through .set() comes back as a Timestamp, and the handler
// calls otpData.expiresAt.toDate(). A mock that hands back a raw Date would
// throw where production works — so convert on read, as Firestore does.
type Doc = Record<string, any>;
const fsStore = new Map<string, Doc>();
let fsFailOn: RegExp | null = null;

function toReadShape(d: Doc): Doc {
  const out: Doc = {};
  for (const [k, v] of Object.entries(d)) out[k] = v instanceof Date ? { toDate: () => v } : v;
  return out;
}
const fsDoc = (path: string) => ({
  async set(data: Doc, opts?: { merge?: boolean }) {
    if (fsFailOn?.test(path)) throw new Error('firestore unavailable');
    fsStore.set(path, opts?.merge ? { ...(fsStore.get(path) ?? {}), ...data } : { ...data });
  },
  async get() {
    const d = fsStore.get(path);
    return { exists: !!d, data: () => (d ? toReadShape(d) : undefined) };
  },
  async update(patch: Doc) {
    if (fsFailOn?.test(path)) throw new Error('firestore unavailable');
    if (!fsStore.has(path)) throw new Error('no doc');
    fsStore.set(path, { ...fsStore.get(path)!, ...patch });
  },
  async delete() { fsStore.delete(path); },
});

vi.mock('../lib/firebase-admin', () => ({
  auth: {
    verifyIdToken: async (t: string) => {
      if (!t || !String(t).startsWith('uid_')) throw new Error('bad token');
      return { uid: t };
    },
    updateUser: (...a: any[]) => (updateUser as any)(...a),
    getUserByPhoneNumber: (...a: any[]) => (getUserByPhoneNumber as any)(...a),
  },
  db: { collection: (c: string) => ({ doc: (id: string) => fsDoc(`${c}/${id}`) }) },
}));

// ── SMS: the only place the plaintext code exists, exactly as in production ──
// The handler hashes the code and stores ONLY the HMAC, so the test cannot
// read it back out of Firestore. Capturing it off the wire keeps the real
// hashOtpCode/verifyOtpCode path under test instead of stubbing it out.
let lastSentCode: string | null = null;
let smsSucceeds = true;
const sendSMS = vi.fn(async (_to: string, body: string) => {
  lastSentCode = /(\d{6})/.exec(body)?.[1] ?? null;
  return { success: smsSucceeds };
});
vi.mock('../services/TwilioSMSService', () => ({ twilioSMSService: { sendSMS: (...a: any[]) => (sendSMS as any)(...a) } }));

// ── Postgres: every write is observable, and failures are programmable ───────
type DrizzleSet = { table: string; values: Record<string, any> };
const pgWrites: DrizzleSet[] = [];
let pgFailOn: ((values: Record<string, any>) => Error | null) | null = null;

vi.mock('../db', () => ({
  db: {
    update: (table: any) => ({
      set: (values: Record<string, any>) => ({
        where: async () => {
          const name = String(table?.[Symbol.for('drizzle:Name')] ?? 'users');
          const err = pgFailOn?.(values);
          if (err) throw err;
          pgWrites.push({ table: name, values });
        },
      }),
    }),
  },
  pool: { query: async () => ({ rows: [] }) },
}));

// ── Activation: the canonical write the onboarding gate actually reads ───────
const markMobileVerified = vi.fn(async (uid: string) => ({ userId: uid }));
vi.mock('../services/ActivationService', () => ({
  markMobileVerified: (...a: any[]) => (markMobileVerified as any)(...a),
  getActivationState: async (uid: string) => ({ userId: uid, activationStatus: 'active' }),
}));

const logged: Array<{ level: string; msg: string }> = [];
vi.mock('../lib/logger', () => ({
  logger: {
    info: (m: any) => logged.push({ level: 'info', msg: String(m) }),
    warn: (m: any) => logged.push({ level: 'warn', msg: String(m) }),
    error: (m: any) => logged.push({ level: 'error', msg: String(m) }),
    debug: () => undefined,
  },
}));
vi.mock('../lib/perUidSmsBudget', () => ({ SMS_PURPOSES: { PROVIDER_PHONE: 'provider_phone' } }));

const { providerPhoneRouter } = await import('../routes/provider-phone');

const app = express();
app.use(express.json());
app.use('/api/provider/phone', providerPhoneRouter);

const sendOtp = (uid: string, phone: string) =>
  request(app).post('/api/provider/phone/send-otp')
    .set('Authorization', `Bearer ${uid}`)
    .send({ phone });

const verifyOtp = (uid: string, otpId: string, code: string) =>
  request(app).post('/api/provider/phone/verify-otp')
    .set('Authorization', `Bearer ${uid}`)
    .send({ otpId, code });

/** Drive the real two-step flow and return the ids the verify step needs. */
async function startVerification(uid: string, phone = PHONE_AS_TYPED) {
  const res = await sendOtp(uid, phone);
  return { otpId: res.body.otpId as string, code: lastSentCode!, res };
}

/** The identity write: the contact and the flag, together or not at all. */
const identityWrite = () => pgWrites.find((w) => 'phone' in w.values);
const flagWrittenWithoutContact = () =>
  pgWrites.some((w) => w.values.phoneVerified === true && !('phone' in w.values));

beforeEach(() => {
  vi.clearAllMocks();
  fsStore.clear();
  pgWrites.length = 0;
  logged.length = 0;
  lastSentCode = null;
  smsSucceeds = true;
  fsFailOn = null;
  pgFailOn = null;
  updateUserFailure = null;
  phoneOwnerProbe = null;
  fbUsers = { [MEMBER]: { uid: MEMBER, phoneNumber: null }, [OTHER]: { uid: OTHER, phoneNumber: null } };
});

describe('provider phone verify: both stores, or no claim at all', () => {
  it('the happy path lands the number on the Firebase auth record AND in users.phone', async () => {
    const { otpId, code } = await startVerification(MEMBER);
    const res = await verifyOtp(MEMBER, otpId, code);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Firebase owns phone identity — phone-session resolves accounts through it.
    expect(fbUsers[MEMBER].phoneNumber).toBe(PHONE_E164);
    // Postgres owns what the platform reads — and users.phone is that column.
    expect(identityWrite()?.values.phone).toBe(PHONE_E164);
  });

  it('the wizard\'s OWN next step now accepts the provider it just verified', async () => {
    // POST /api/provider/onboarding gates on the Firebase phone_number claim
    // OR users.mobile_verified_at. The bare phone_verified boolean this route
    // used to write satisfies NEITHER, so the applicant was bounced with
    // PHONE_NOT_VERIFIED one screen after verifying.
    const { otpId, code } = await startVerification(MEMBER);
    await verifyOtp(MEMBER, otpId, code);

    expect(fbUsers[MEMBER].phoneNumber).toBe(PHONE_E164);      // arm 1 of the gate
    expect(markMobileVerified).toHaveBeenCalledWith(MEMBER);    // arm 2 (mobile_verified_at)
  });

  it('stores E.164, not the string the provider typed — users.phone is UNIQUE', async () => {
    // '0541234567' and '+972541234567' are one subscriber and two rows under a
    // UNIQUE index (server/lib/phoneE164.ts). The old ad-hoc normaliser here
    // (strip spaces, 00 -> +) left the national form untouched.
    const { otpId, code } = await startVerification(MEMBER, PHONE_AS_TYPED);
    await verifyOtp(MEMBER, otpId, code);
    expect(identityWrite()?.values.phone).toBe(PHONE_E164);
  });

  it('a failed Postgres write never leaves a verified flag standing alone', async () => {
    pgFailOn = (v) => ('phone' in v ? Object.assign(new Error('deadlock'), { code: '40P01' }) : null);
    const { otpId, code } = await startVerification(MEMBER);
    const res = await verifyOtp(MEMBER, otpId, code);

    // The claim is the harm — assert it before the status code.
    expect(flagWrittenWithoutContact()).toBe(false);
    expect(markMobileVerified).not.toHaveBeenCalled();
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.success).not.toBe(true);
  });

  it('a store that did not accept the write is never reported to the provider as success', async () => {
    pgFailOn = (v) => ('phone' in v ? Object.assign(new Error('deadlock'), { code: '40P01' }) : null);
    const { otpId, code } = await startVerification(MEMBER);
    const res = await verifyOtp(MEMBER, otpId, code);
    expect(res.body.success).not.toBe(true);
  });

  it('re-presenting an already-verified OTP finishes the write instead of rubber-stamping it', async () => {
    // The old handler answered { success: true, alreadyVerified: true } from
    // the Firestore flag alone, BEFORE any persistence ran. Once the write is
    // fail-closed that short-circuit becomes the bug it was hiding: the retry
    // that is supposed to heal a half-landed verification would report success
    // for a row still holding nothing.
    pgFailOn = (v) => ('phone' in v ? Object.assign(new Error('deadlock'), { code: '40P01' }) : null);
    const { otpId, code } = await startVerification(MEMBER);
    const first = await verifyOtp(MEMBER, otpId, code);
    expect(first.body.success).not.toBe(true);

    pgFailOn = null;
    const retry = await verifyOtp(MEMBER, otpId, code);
    expect(retry.status).toBe(200);
    expect(retry.body.success).toBe(true);
    expect(identityWrite()?.values.phone).toBe(PHONE_E164);
    expect(markMobileVerified).toHaveBeenCalledWith(MEMBER);
  });

  it('a replay of a verified OTP still has to present the right code', async () => {
    const { otpId, code } = await startVerification(MEMBER);
    await verifyOtp(MEMBER, otpId, code);
    pgWrites.length = 0;
    const res = await verifyOtp(MEMBER, otpId, code === '111111' ? '222222' : '111111');
    expect(res.status).toBe(400);
    expect(identityWrite()).toBeUndefined();
  });
});

describe('provider phone verify: ownership is asked, never assumed', () => {
  it('a number held by ANOTHER account is refused 409 — not a raw constraint 500', async () => {
    fbUsers[OTHER].phoneNumber = PHONE_E164;
    updateUserFailure = { code: 'auth/phone-number-already-exists' };
    const { otpId, code } = await startVerification(MEMBER);
    const res = await verifyOtp(MEMBER, otpId, code);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('PHONE_IN_USE');
    expect(markMobileVerified).not.toHaveBeenCalled();
  });

  it('a number already on THIS account HEALS — it does not accuse the owner', async () => {
    // Reachable whenever a previous attempt attached to Firebase and then
    // failed to persist. A blind 409 would tell the provider their own number
    // belongs to a stranger and wedge them out of onboarding permanently.
    fbUsers[MEMBER].phoneNumber = PHONE_E164;
    updateUserFailure = { code: 'auth/phone-number-already-exists' };
    const { otpId, code } = await startVerification(MEMBER);
    const res = await verifyOtp(MEMBER, otpId, code);

    expect(res.status).toBe(200);
    expect(identityWrite()?.values.phone).toBe(PHONE_E164);
    expect(markMobileVerified).toHaveBeenCalledWith(MEMBER);
  });

  it('an UNREADABLE ownership probe is a retryable 500, never a terminal 409', async () => {
    updateUserFailure = { code: 'auth/phone-number-already-exists' };
    phoneOwnerProbe = async () => { throw new Error('identity toolkit unreachable'); };
    const { otpId, code } = await startVerification(MEMBER);
    const res = await verifyOtp(MEMBER, otpId, code);

    expect(res.status).toBe(500);
    expect(res.body.error).not.toBe('PHONE_IN_USE');
  });

  it('a probe that names NOBODY has not established a second owner', async () => {
    // Firebase said the number exists, then said nobody holds it. That
    // contradicts the error that triggered the probe; it does not confirm it.
    updateUserFailure = { code: 'auth/phone-number-already-exists' };
    phoneOwnerProbe = async () => { throw Object.assign(new Error('nf'), { code: 'auth/user-not-found' }); };
    const { otpId, code } = await startVerification(MEMBER);
    const res = await verifyOtp(MEMBER, otpId, code);

    expect(res.status).toBe(500);
    expect(res.body.error).not.toBe('PHONE_IN_USE');
  });

  it('a UNIQUE violation on users.phone answers 409, not an inherited constraint 500', async () => {
    // Firebase already accepted the number for THIS uid, so a 23505 means a
    // stale row squats it with no auth record behind it — drift, not a rival.
    pgFailOn = (v) => ('phone' in v ? Object.assign(new Error('dup'), { code: '23505' }) : null);
    const { otpId, code } = await startVerification(MEMBER);
    const res = await verifyOtp(MEMBER, otpId, code);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('PHONE_IN_USE');
    expect(markMobileVerified).not.toHaveBeenCalled();
  });
});

describe('provider phone verify: phone_e164 is a convenience, not the contact', () => {
  it('the identity write does not depend on the shadow column landing', async () => {
    // No migration in migrations/ creates users.phone_e164, and its only
    // reader (backgroundJobs pet-birthday SMS) already falls back to
    // users.phone. Folding it into the fail-closed identity write would let an
    // unmigrated column take provider verification down entirely.
    pgFailOn = (v) => ('phoneE164' in v && !('phone' in v) ? new Error('column "phone_e164" does not exist') : null);
    const { otpId, code } = await startVerification(MEMBER);
    const res = await verifyOtp(MEMBER, otpId, code);

    expect(res.status).toBe(200);
    expect(identityWrite()?.values.phone).toBe(PHONE_E164);
    expect(markMobileVerified).toHaveBeenCalledWith(MEMBER);
  });

  it('the shadow column is never written INSTEAD of the contact', async () => {
    const { otpId, code } = await startVerification(MEMBER);
    await verifyOtp(MEMBER, otpId, code);
    const e164Only = pgWrites.find((w) => 'phoneE164' in w.values && !('phone' in w.values));
    // Writing it is fine; writing ONLY it is the defect.
    expect(identityWrite()).toBeDefined();
    if (e164Only) expect(e164Only.values.phoneVerified).toBeUndefined();
  });
});

describe('provider phone verify: the Firestore mirror', () => {
  it('does not hold a verified claim for a request that answered failure', async () => {
    pgFailOn = (v) => ('phone' in v ? Object.assign(new Error('deadlock'), { code: '40P01' }) : null);
    const { otpId, code } = await startVerification(MEMBER);
    await verifyOtp(MEMBER, otpId, code);
    expect(fsStore.get(`users/${MEMBER}`)?.phoneVerified).not.toBe(true);
  });

  it('a mirror that did not accept the write is not reported as success either', async () => {
    // The mirror is written LAST, so by the time it fails the authoritative
    // stores are already correct and only the mirror is behind. Answering
    // success anyway would be the same shape as the defect being fixed —
    // telling the provider a store holds something it does not. The retry
    // heals through the already-ours branch.
    fsFailOn = /^users\//;
    const { otpId, code } = await startVerification(MEMBER);
    const res = await verifyOtp(MEMBER, otpId, code);

    expect(res.body.success).not.toBe(true);
    expect(res.status).toBeGreaterThanOrEqual(500);
    // ...and the stores that DID accept it keep what they accepted.
    expect(fbUsers[MEMBER].phoneNumber).toBe(PHONE_E164);
    expect(identityWrite()?.values.phone).toBe(PHONE_E164);
  });

  it('records the same E.164 string the authoritative stores hold', async () => {
    const { otpId, code } = await startVerification(MEMBER);
    await verifyOtp(MEMBER, otpId, code);
    expect(fsStore.get(`users/${MEMBER}`)?.phone).toBe(PHONE_E164);
    expect(fsStore.get(`users/${MEMBER}`)?.phoneVerified).toBe(true);
  });
});

describe('provider phone verify: guards that must keep working', () => {
  it('an OTP belonging to another uid is refused', async () => {
    const { otpId, code } = await startVerification(MEMBER);
    const res = await verifyOtp(OTHER, otpId, code);
    expect(res.status).toBe(403);
    expect(identityWrite()).toBeUndefined();
  });

  it('an expired OTP is refused and nothing is written', async () => {
    const { otpId, code } = await startVerification(MEMBER);
    const doc = fsStore.get(`provider_phone_otps/${otpId}`)!;
    doc.expiresAt = new Date(Date.now() - 1000);
    const res = await verifyOtp(MEMBER, otpId, code);
    expect(res.status).toBe(410);
    expect(identityWrite()).toBeUndefined();
  });

  it('a wrong code is refused and nothing is written', async () => {
    const { otpId, code } = await startVerification(MEMBER);
    const res = await verifyOtp(MEMBER, otpId, code === '111111' ? '222222' : '111111');
    expect(res.status).toBe(400);
    expect(identityWrite()).toBeUndefined();
  });

  it('an unauthenticated caller cannot verify', async () => {
    const { otpId, code } = await startVerification(MEMBER);
    const res = await request(app).post('/api/provider/phone/verify-otp').send({ otpId, code });
    expect(res.status).toBe(401);
  });
});
