/**
 * THE STRONGER PHONE-CHANGE FLOW, MADE REACHABLE — AND HONEST ABOUT WHEN IT IS.
 *
 * Two mechanisms can change the account's mobile number, and only one was
 * reachable:
 *
 *   firebase — client proves the handset via the Firebase SMS OTP, then
 *              POST /settings/phone/confirm-verification reads the number off
 *              the Firebase record. Wired in My Account, no flag. It is also
 *              the ONLY way to set a FIRST number: there is nothing to change
 *              from, so a "prove the new one" challenge has no old one to
 *              re-verify against.
 *   unified  — POST /settings/phone/request-change + /confirm-change. Checks
 *              the new number against BOTH stores before a code is sent and
 *              again at apply time, takes the number out of the verification
 *              result rather than the request body, and revokes every other
 *              session on success. Built, correct, and reachable by nobody:
 *              no client called it, and production never set
 *              UNIFIED_VERIFICATION_CHANGE_PHONE_ENABLED, so it answered 503.
 *
 * THE SAFETY PROPERTY THESE PINS PROTECT: the client must never drive the
 * unified flow on its own guess. The server publishes which mechanism is live
 * on /settings/phone/status, and the UI obeys it. A customer who has typed a
 * new number and is waiting for a code is the worst possible place to discover
 * a route is switched off — so the choice is made before anything is sent, and
 * ONLY an explicit 'unified' authorises it. A server too old to publish the
 * field, or one with the flag off, keeps everyone on the path that works.
 */
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const UID = 'uid_member';

let fbPhone: string | null = '+972500000111';
vi.mock('../lib/firebase-admin', () => {
  const auth = () => ({
    verifyIdToken: async (t: string) => {
      if (!t || !String(t).startsWith('uid_')) throw new Error('bad token');
      return { uid: t };
    },
    getUser: async (uid: string) => ({ uid, phoneNumber: fbPhone }),
    updateUser: vi.fn(async () => undefined),
    getUserByPhoneNumber: vi.fn(async () => { throw Object.assign(new Error('nf'), { code: 'auth/user-not-found' }); }),
  });
  return { default: { auth }, auth: auth(), db: {} };
});

let canonicalPhone: string | null = '+972500000111';
vi.mock('../db', () => ({
  pool: { query: async () => ({ rows: [] }) },
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ phone: canonicalPhone }] }) }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: async () => [{ id: UID }] }) }) }),
    insert: () => ({ values: async () => undefined }),
  },
}));

vi.mock('../services/UnifiedVerificationService', () => ({
  UnifiedVerificationError: class extends Error {},
  unifiedVerificationService: { startChallenge: vi.fn(), verifyChallenge: vi.fn() },
}));
vi.mock('../services/VerificationEmailDelivery', () => ({ sendVerificationEmailCode: vi.fn() }));
vi.mock('../services/SessionService', () => ({ revokeAllExceptForUser: vi.fn(async () => 0) }));
vi.mock('../services/AuthService', () => ({ authService: {} }));
vi.mock('../lib/phoneHmac', () => ({ phoneLookupHash: (p: string) => `h:${p}` }));
vi.mock('../lib/otpHmac', () => ({ hashOtpCode: (c: string) => c, verifyOtpCode: () => true }));
// The photo route builds its middleware at import time; without this the
// router fails to construct and no test in this file can run.
vi.mock('multer', () => {
  const m: any = () => ({ single: () => (_r: any, _s: any, n: any) => n() });
  m.memoryStorage = () => ({});
  return { default: m };
});
vi.mock('../lib/fileMagicValidation', () => ({
  // A middleware FACTORY — returning undefined makes router.post() throw at
  // import time, taking every test in this file with it.
  requireValidFileContent: () => (_r: any, _s: any, n: any) => n(),
  detectFileKind: vi.fn(),
  KIND_TO_MIME: {},
}));

const { default: profileSettingsRouter } = await import('../routes/profile-settings');
const app = express();
app.use(express.json());
app.use('/api/user', profileSettingsRouter);

const status = () =>
  request(app).get('/api/user/settings/phone/status').set('Authorization', `Bearer ${UID}`);

const ROOT = join(__dirname, '..', '..');
const myAccount = readFileSync(join(ROOT, 'client/src/pages/MyAccount.tsx'), 'utf8');
const ciDeploy = readFileSync(join(ROOT, '.github/workflows/petwash-ci.yml'), 'utf8');
const cloudRun = readFileSync(join(ROOT, 'cloudrun-service.yaml'), 'utf8');

const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  fbPhone = '+972500000111';
  canonicalPhone = '+972500000111';
  process.env.UNIFIED_VERIFICATION_ENABLED = 'true';
  process.env.UNIFIED_VERIFICATION_CHANGE_PHONE_ENABLED = 'true';
});
afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

describe('the server publishes which change mechanism is live', () => {
  it('says unified when the flag is on', async () => {
    const r = await status();
    expect(r.status).toBe(200);
    expect(r.body.changeFlow).toBe('unified');
  });

  it('says firebase when the purpose flag is off — never unified', async () => {
    delete process.env.UNIFIED_VERIFICATION_CHANGE_PHONE_ENABLED;
    const r = await status();
    expect(r.body.changeFlow).toBe('firebase');
  });

  it('says firebase when the umbrella flag is off, even with the purpose flag on', async () => {
    // The purpose flags are AND-ed with the umbrella; a stale per-purpose var
    // must not switch a flow on by itself.
    delete process.env.UNIFIED_VERIFICATION_ENABLED;
    const r = await status();
    expect(r.body.changeFlow).toBe('firebase');
  });

  it('still reports the number and the two-store sync state it always did', async () => {
    canonicalPhone = '+972500000999';
    const r = await status();
    expect(r.body.phone).toBe('+972500000111');
    expect(r.body.canonicalPhone).toBe('+972500000999');
    expect(r.body.inSync).toBe(false);
  });
});

describe('the client obeys that answer instead of guessing', () => {
  it('routes Change to the unified dialog only on an explicit unified + an existing number', () => {
    expect(myAccount).toMatch(/phoneStatus\?\.verified && phoneStatus\?\.changeFlow === 'unified'/);
    expect(myAccount).toMatch(/setShowPhoneChangeDialog\(true\)/);
  });

  it('keeps the Firebase OTP path for first-set and for an old or flag-off server', () => {
    // The else branch is the whole safety story: absence of the field, or
    // 'firebase', or no number yet, all land on the path that works.
    const btn = /if \(phoneStatus\?\.verified && phoneStatus\?\.changeFlow === 'unified'\) \{[\s\S]{0,200}?\} else \{[\s\S]{0,120}?\}/.exec(myAccount);
    expect(btn, 'capability routing not found').toBeTruthy();
    expect(btn![0]).toMatch(/setShowPhoneVerifyDialog\(true\)/);
    // And first-set must still reach the live route.
    expect(myAccount).toMatch(/'\/api\/user\/settings\/phone\/confirm-verification'/);
  });

  it('drives both halves of the unified pair', () => {
    expect(myAccount).toMatch(/'\/api\/user\/settings\/phone\/request-change'/);
    expect(myAccount).toMatch(/'\/api\/user\/settings\/phone\/confirm-change'/);
  });

  it('shows the server-masked destination, not the raw number it just sent', () => {
    // The challenge API deliberately never echoes `destination`; rendering the
    // masked value keeps the client from re-deriving a raw one.
    expect(myAccount).toMatch(/setPhoneChangeMasked\(data\.maskedDestination/);
  });
});

describe('production actually has the flow switched on', () => {
  it('the Cloud Run deploy sets the change_phone flag', () => {
    // Without this the server answers 'firebase' forever and the wiring above
    // is dead code — built, correct, and reachable by nobody. Again.
    expect(ciDeploy).toMatch(/UNIFIED_VERIFICATION_CHANGE_PHONE_ENABLED=true/);
    expect(cloudRun).toMatch(/UNIFIED_VERIFICATION_CHANGE_PHONE_ENABLED/);
  });

  it('the umbrella flag it depends on is set too', () => {
    expect(ciDeploy).toMatch(/UNIFIED_VERIFICATION_ENABLED=true/);
  });
});
