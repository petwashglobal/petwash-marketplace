/**
 * A PROOF NAMES A CONTACT, NOT AN ACCOUNT.
 *
 * POST /api/onboarding-verification/validate-tokens turned a verification proof
 * into a database write. The proof asserts "the holder controls THIS phone /
 * THIS email"; the write went to whatever `userId` the request BODY named, on a
 * router mounted with no auth middleware at all. Nothing connected the two.
 *
 * So a caller holding a completely legitimate proof for their OWN contact could
 * set phoneVerified / emailVerified — and, through markEmailVerified, the
 * acceptedTermsAt that records a terms acceptance the account holder never made
 * — on ANY account id, driving that account to `active`. It was reproduced
 * end-to-end against this handler: a valid proof for attacker@example.com
 * activated victim-uid, and the response cheerfully echoed the attacker's
 * address next to the victim's new active state.
 *
 * These pin BOTH bindings, because either alone still leaves a hole:
 *   IDENTITY — the write target is the authenticated caller, never the body.
 *   CONTACT  — the proof must be about the contact that account actually holds.
 * Adding auth and continuing to trust the body userId would pass an
 * identity-only test and still be broken; test 4/5 exist to fail in that world.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'validate-tokens-binding-test-secret-0123456789';

// ── Fake users table ────────────────────────────────────────────────────────
type Row = {
  id: string;
  phone: string | null;
  email: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  mobileVerifiedAt: Date | null;
  emailVerifiedAt: Date | null;
  acceptedTermsAt: Date | null;
  activationStatus: string;
};
const rows = new Map<string, Row>();
function addRow(id: string, phone: string | null, email: string | null) {
  rows.set(id, {
    id, phone, email,
    phoneVerified: false, emailVerified: false,
    mobileVerifiedAt: null, emailVerifiedAt: null,
    acceptedTermsAt: null, activationStatus: 'draft',
  });
}

// The value drizzle's `eq` was called with, so a test can assert WHICH row the
// handler looked up — trusting the body userId for the SELECT while writing to
// the authenticated uid would be a subtler version of the same defect.
let lastEqValue: unknown;
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    // Object.assign, not a spread: `eq` returns a SQL instance whose prototype
    // the rest of drizzle relies on. Tagging it preserves that instance.
    eq: (col: any, val: any) => Object.assign(actual.eq(col, val), { __eqValue: (lastEqValue = val) }),
  };
});

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (cond: any) => ({
          limit: async () => {
            const row = rows.get(cond?.__eqValue);
            return row ? [row] : [];
          },
        }),
      }),
    }),
  },
}));

// Faithful to server/services/ActivationService.ts: each write is
// `eq(users.id, userId)` with NO comparison against the contact the proof
// attests. That is exactly why the binding has to live in the caller.
const writes: Array<{ fn: string; userId: string }> = [];
vi.mock('../services/ActivationService', () => ({
  markMobileVerified: vi.fn(async (userId: string) => {
    writes.push({ fn: 'markMobileVerified', userId });
    const u = rows.get(userId);
    if (!u) throw new Error(`[Activation] User not found: ${userId}`);
    u.mobileVerifiedAt = new Date();
    u.phoneVerified = true;
    u.activationStatus = 'active';
  }),
  markEmailVerified: vi.fn(async (userId: string, opts: any = {}) => {
    writes.push({ fn: 'markEmailVerified', userId });
    const u = rows.get(userId);
    if (!u) throw new Error(`[Activation] User not found: ${userId}`);
    u.emailVerifiedAt = new Date();
    u.emailVerified = true;
    if (opts.acceptTerms) u.acceptedTermsAt = new Date();
    u.activationStatus = 'active';
  }),
  getActivationState: vi.fn(async (userId: string) => {
    const u = rows.get(userId)!;
    return {
      userId,
      activationStatus: u.activationStatus,
      mobileVerifiedAt: u.mobileVerifiedAt,
      emailVerifiedAt: u.emailVerifiedAt,
      accountActivatedAt: null,
      acceptedTermsAt: u.acceptedTermsAt,
      missingSteps: [],
      isFullyActive: true,
    };
  }),
}));

// The Bearer token IS the uid in this harness — resolveActivationUid's only job
// here is to turn a credential into a uid, and the real verification is
// Firebase's, not this route's.
vi.mock('../lib/firebase-admin', () => ({
  auth: {
    verifyIdToken: vi.fn(async (token: string) => {
      if (!token || token === 'invalid') throw new Error('bad token');
      return { uid: token };
    }),
    verifySessionCookie: vi.fn(async () => { throw new Error('no cookie'); }),
  },
}));

vi.mock('../services/redis', () => ({
  redis: {
    isConnected: () => false,
    get: async () => null,
    set: async () => {},
    del: async () => {},
    setNxStrict: async () => 'UNAVAILABLE',
    existsStrict: async () => 'UNAVAILABLE',
  },
}));
vi.mock('../emailService', () => ({ EmailService: { sendEmail: vi.fn() } }));
vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import router from '../routes/onboarding-verification';

const URL = '/api/onboarding-verification/validate-tokens';
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/onboarding-verification', router);
  return app;
}
// Real proofs, minted over the real secret and read back by the real
// validators — a rejection here can never be "the token was junk".
const smsProof = (phone: string) =>
  jwt.sign({ phone, type: 'sms-verified', nonce: 'n1' }, process.env.JWT_SECRET!, { expiresIn: '5m' });
const emailProof = (email: string) =>
  jwt.sign({ email, type: 'email-verified' }, process.env.JWT_SECRET!, { expiresIn: '5m' });

const VICTIM = 'victim-uid';
const ATTACKER = 'attacker-uid';

describe('validate-tokens — a proof is bound to its contact AND its account', () => {
  beforeEach(() => {
    rows.clear();
    writes.length = 0;
    lastEqValue = undefined;
    addRow(VICTIM, '+972500000001', 'victim@example.com');
    addRow(ATTACKER, '+972500000002', 'attacker@example.com');
  });

  // ── BINDING 1: identity ───────────────────────────────────────────────────

  it('THE DEFECT: a valid SMS proof for the attacker cannot mark the victim verified', async () => {
    const res = await request(makeApp())
      .post(URL)
      .set('Authorization', `Bearer ${ATTACKER}`)
      .send({ smsToken: smsProof('+972500000002'), userId: VICTIM });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_MISMATCH');
    expect(rows.get(VICTIM)!.phoneVerified).toBe(false);
    expect(rows.get(VICTIM)!.mobileVerifiedAt).toBe(null);
    // Not merely "the victim ended up unchanged" — no write was attempted at all.
    expect(writes).toEqual([]);
  });

  it('THE DEFECT: an email proof cannot mark another account verified, nor accept its terms', async () => {
    const res = await request(makeApp())
      .post(URL)
      .set('Authorization', `Bearer ${ATTACKER}`)
      .send({ emailToken: emailProof('attacker@example.com'), userId: VICTIM });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_MISMATCH');
    expect(rows.get(VICTIM)!.emailVerified).toBe(false);
    // acceptedTermsAt is the one that would have recorded a legal acceptance
    // the account holder never made.
    expect(rows.get(VICTIM)!.acceptedTermsAt).toBe(null);
    expect(rows.get(VICTIM)!.activationStatus).toBe('draft');
    expect(writes).toEqual([]);
  });

  it('refuses a write with no credential at all — the mount carries no auth, so the handler must', async () => {
    const res = await request(makeApp())
      .post(URL)
      .send({ smsToken: smsProof('+972500000001'), userId: VICTIM });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
    expect(writes).toEqual([]);
  });

  // ── BINDING 2: contact ────────────────────────────────────────────────────
  // These fail in a world where someone "fixed" this with auth alone and kept
  // trusting the proof: the caller is the legitimate owner of the account, and
  // the proof is still for a contact they do not hold.

  it("refuses a proof for someone else's phone even when the caller owns the account", async () => {
    const res = await request(makeApp())
      .post(URL)
      .set('Authorization', `Bearer ${VICTIM}`)
      .send({ smsToken: smsProof('+972500000002'), userId: VICTIM });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PHONE_PROOF_MISMATCH');
    expect(rows.get(VICTIM)!.phoneVerified).toBe(false);
    expect(writes).toEqual([]);
  });

  it("refuses a proof for someone else's email even when the caller owns the account", async () => {
    const res = await request(makeApp())
      .post(URL)
      .set('Authorization', `Bearer ${VICTIM}`)
      .send({ emailToken: emailProof('attacker@example.com'), userId: VICTIM });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_PROOF_MISMATCH');
    expect(rows.get(VICTIM)!.emailVerified).toBe(false);
    expect(rows.get(VICTIM)!.acceptedTermsAt).toBe(null);
    expect(writes).toEqual([]);
  });

  // ── The flow this route exists to serve still works ───────────────────────

  it('accepts the account holder proving their own contacts, and looks up THEIR row', async () => {
    const res = await request(makeApp())
      .post(URL)
      .set('Authorization', `Bearer ${VICTIM}`)
      // National format against a stored "+972…": a country-code difference is
      // not a mismatch, and must not read as one.
      .send({
        smsToken: smsProof('0500000001'),
        emailToken: emailProof('Victim@Example.com'),
        userId: VICTIM,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(rows.get(VICTIM)!.phoneVerified).toBe(true);
    expect(rows.get(VICTIM)!.emailVerified).toBe(true);
    expect(rows.get(VICTIM)!.acceptedTermsAt).not.toBe(null);
    expect(writes.map((w) => w.userId)).toEqual([VICTIM, VICTIM]);
    // The row read was keyed on the authenticated uid.
    expect(lastEqValue).toBe(VICTIM);
  });

  it('lets an email-first row with no phone yet verify a number — nothing stored to contradict', async () => {
    addRow('emailfirst-uid', null, 'first@example.com');
    const res = await request(makeApp())
      .post(URL)
      .set('Authorization', 'Bearer emailfirst-uid')
      .send({ smsToken: smsProof('+972500000009'), userId: 'emailfirst-uid' });

    expect(res.status).toBe(200);
    expect(rows.get('emailfirst-uid')!.phoneVerified).toBe(true);
    expect(writes).toEqual([{ fn: 'markMobileVerified', userId: 'emailfirst-uid' }]);
  });

  it('still inspects a token with no userId, writing nothing and requiring nothing', async () => {
    const res = await request(makeApp())
      .post(URL)
      .send({ smsToken: smsProof('+972500000001') });

    expect(res.status).toBe(200);
    expect(res.body.phoneVerified).toBe(true);
    expect(writes).toEqual([]);
  });

  it('reports an invalid proof as invalid rather than writing anything', async () => {
    const res = await request(makeApp())
      .post(URL)
      .set('Authorization', `Bearer ${VICTIM}`)
      .send({ smsToken: 'not-a-token', userId: VICTIM });

    expect(res.status).toBe(200);
    expect(res.body.phoneVerified).toBe(false);
    expect(rows.get(VICTIM)!.phoneVerified).toBe(false);
    expect(writes).toEqual([]);
  });
});

/**
 * SAME CLASS, ONE DOOR OVER — POST /api/registration/complete-registration.
 *
 * This route already bound the EMAIL proof to the address being registered
 * (`emailCheck.email !== normalizedEmail` → 400). The PHONE proof was only ever
 * checked for validity, so it worked as "the caller holds a valid proof of SOME
 * number" — a caller could clear the phone gate with a proof for their own
 * mobile while registering anybody's. The email half stops them registering
 * someone else's address, so the reachable damage is a registration whose phone
 * is unattested rather than an account takeover; it is the same missing binding
 * either way, and the email half is not a substitute for it.
 */
describe('complete-registration — the phone proof is bound to the phone submitted', () => {
  const REG_URL = '/api/registration/complete-registration';

  async function makeRegApp() {
    const mod = await import('../routes/complete-registration');
    const app = express();
    app.use(express.json());
    app.use('/api/registration', mod.default);
    return app;
  }

  const base = {
    userType: 'customer' as const,
    email: 'victim@example.com',
    firstName: 'Vic',
    lastName: 'Tim',
    language: 'he',
  };

  it("refuses a proof for the attacker's phone against a registration for another number", async () => {
    const app = await makeRegApp();
    const res = await request(app).post(REG_URL).send({
      ...base,
      phone: '+972500000001',
      emailToken: emailProof('victim@example.com'),
      smsToken: smsProof('+972500000002'), // a real proof — for a DIFFERENT number
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not match verified phone/i);
  });

  it('still refuses a proof for a different email (the binding that was already here)', async () => {
    const app = await makeRegApp();
    const res = await request(app).post(REG_URL).send({
      ...base,
      phone: '+972500000001',
      emailToken: emailProof('attacker@example.com'),
      smsToken: smsProof('+972500000001'),
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not match verified email/i);
  });

  it('accepts matching proofs across country-code / national formatting', async () => {
    const app = await makeRegApp();
    const res = await request(app).post(REG_URL).send({
      ...base,
      phone: '0500000001',
      emailToken: emailProof('victim@example.com'),
      smsToken: smsProof('+972500000001'),
    });

    // Past both proof gates — whatever happens downstream, it is not a
    // verification refusal.
    expect(res.body.message).not.toMatch(/does not match verified/i);
  });
});
