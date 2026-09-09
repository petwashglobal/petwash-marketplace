/**
 * THE CONTROL THAT COULD BE TURNED ON BUT NEVER OFF — AND WAS REPORTED AS OFF
 * WHILE IT WAS ON.
 *
 * `users.two_factor_enabled` is the member's join-time choice that a password
 * alone must not be enough, and POST /api/auth/session enforces it on every
 * password sign-in. Two things were wrong with it, and they compounded:
 *
 *  1. NO EXIT. The column was written in exactly one place — verify-signup-email
 *     at join — and nowhere else. No route cleared it, PATCH /api/user/profile
 *     refuses it, and this file's enrolment routes operate on mfa_enrollments
 *     and never touch it. A member could not un-choose it. The refusal in
 *     user-profile.ts pointed at POST /api/mfa/enable and /api/mfa/disable,
 *     NEITHER OF WHICH EVER EXISTED, so the one place that says where to go
 *     sent the caller nowhere.
 *
 *  2. IT WAS INVISIBLE, AND WORSE THAN INVISIBLE. GET /api/mfa/status reported
 *     only `enrolled` (mfa_enrollments — step-up on sensitive ACTIONS, which
 *     gates no login at all). So a member with two_factor_enabled = true and no
 *     TOTP enrolment was told `enrolled: false`, and My Account rendered
 *     "Two-step verification is off" with an Off badge — while the session gate
 *     was actively challenging them for it. A live security control reported as
 *     the opposite of its state.
 *
 * The two together are why a member whose number vanished from both stores was
 * stuck: refused at password sign-in, told the control was off, and given no
 * way to change it.
 */
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const EMAIL = 'member@example.com';

// The route is rate limited (5 per 15 min per uid) by a module-level map that
// no test can reset. That limit is real behaviour worth keeping, so each test
// gets a FRESH uid instead — which also makes these cases independent.
let uidSeq = 0;
let UID = 'uid_member_0';

let twoFactorEnabled: boolean | null = true;
let updateRowCount = 1;
let pgThrows: Error | null = null;
const queries: Array<{ sql: string; params: any[] }> = [];

vi.mock('../db', () => ({
  pool: {
    query: async (sql: string, params: any[] = []) => {
      queries.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params });
      if (pgThrows) throw pgThrows;
      if (/UPDATE users SET two_factor_enabled/i.test(sql)) {
        return { rowCount: updateRowCount, rows: updateRowCount ? [{ id: UID }] : [] };
      }
      if (/SELECT two_factor_enabled/i.test(sql)) {
        return twoFactorEnabled === null ? { rows: [] } : { rows: [{ two_factor_enabled: twoFactorEnabled }] };
      }
      return { rows: [] };
    },
  },
  db: {},
}));

vi.mock('../middleware/firebase-auth', () => ({
  validateFirebaseToken: (req: any, _res: any, next: any) => {
    req.firebaseUser = { uid: UID, email: EMAIL };
    next();
  },
}));

// startChallenge REFUSES any purpose whose flag is off (PURPOSE_FLAG_DISABLED,
// 503). Modelled here because a mock that always succeeds would have declared
// this route working in a production that never set the flag — which is exactly
// how it shipped broken.
class FakeUnifiedVerificationError extends Error {
  constructor(public reasonCode: string, message: string, public statusCode: number) { super(message); }
}
const startChallenge = vi.fn(async (input: any) => {
  const { isUnifiedVerificationPurposeEnabled } = await import('../lib/feature-flags/unifiedVerification');
  if (!isUnifiedVerificationPurposeEnabled(input.purpose)) {
    throw new FakeUnifiedVerificationError('PURPOSE_FLAG_DISABLED', 'This verification purpose is disabled.', 503);
  }
  return { challenge: { challengeId: 'chal_1', expiresAt: new Date(Date.now() + 300_000) } };
});
let verifyMetadata: any = { action: 'disable_2fa', userId: UID };
const verifyChallenge = vi.fn(async () => ({ action: { metadata: verifyMetadata } }));
vi.mock('../services/UnifiedVerificationService', () => ({
  UnifiedVerificationError: FakeUnifiedVerificationError,
  unifiedVerificationService: {
    startChallenge: (...a: any[]) => (startChallenge as any)(...a),
    verifyChallenge: (...a: any[]) => (verifyChallenge as any)(...a),
  },
}));
vi.mock('../services/TOTPService', () => ({
  totpService: { getUserEnrollments: async () => [], enrollUser: vi.fn(), removeEnrollment: vi.fn() },
}));
vi.mock('../services/TwoFactorAuthService', () => ({ twoFactorAuth: {} }));

const { default: mfaRouter } = await import('../routes/mfa');
const app = express();
app.use(express.json());
app.use('/api/mfa', mfaRouter);

const status = () => request(app).get('/api/mfa/status');
const disable = (body: any = {}) => request(app).post('/api/mfa/two-step/disable').send(body);

const ROOT = join(__dirname, '..', '..');
const userProfileSrc = readFileSync(join(ROOT, 'server/routes/user-profile.ts'), 'utf8');
const myAccount = readFileSync(join(ROOT, 'client/src/pages/MyAccount.tsx'), 'utf8');
const mfaSrc = readFileSync(join(ROOT, 'server/routes/mfa.ts'), 'utf8');

beforeEach(() => {
  vi.clearAllMocks();
  UID = `uid_member_${++uidSeq}`;
  queries.length = 0;
  twoFactorEnabled = true;
  updateRowCount = 1;
  pgThrows = null;
  verifyMetadata = { action: 'disable_2fa', userId: UID };
  process.env.UNIFIED_VERIFICATION_ENABLED = 'true';
  process.env.UNIFIED_VERIFICATION_DISABLE_2FA_ENABLED = 'true';
});

describe('status reports the control that actually gates password sign-in', () => {
  it('says two-step login is ON for a member with the column set and no enrolments', async () => {
    const r = await status();
    expect(r.status).toBe(200);
    // The exact false claim that sent members to a panel saying "off".
    expect(r.body.enrolled).toBe(false);
    expect(r.body.twoStepLogin).toEqual({ enabled: true });
  });

  it('says OFF only when the column really is off', async () => {
    twoFactorEnabled = false;
    expect((await status()).body.twoStepLogin).toEqual({ enabled: false });
  });

  it('reports an unreadable setting as unknown, never as off', async () => {
    pgThrows = Object.assign(new Error('connection terminated'), { code: '57P01' });
    const r = await status();
    expect(r.status).toBe(200);
    expect(r.body.twoStepLogin.enabled).toBeNull();
    expect(r.body.twoStepLogin.enabled).not.toBe(false);
  });
});

describe('the exit exists, and it costs a proof', () => {
  it('does not disable on the first call — it sends a code to the EMAIL', async () => {
    const r = await disable();
    expect(r.status).toBe(202);
    expect(r.body.requiresVerification).toBe(true);
    expect(startChallenge).toHaveBeenCalledWith(expect.objectContaining({
      purpose: 'disable_2fa',
      // Email, not SMS: the member who most needs this route is the one with
      // no phone in either store.
      channel: 'email',
      destination: EMAIL,
    }));
    expect(queries.some(q => /UPDATE users SET two_factor_enabled/i.test(q.sql))).toBe(false);
  });

  it('disables the column once a matching code is verified', async () => {
    const r = await disable({ verificationChallengeId: 'chal_1', verificationCode: '123456' });
    expect(r.status).toBe(200);
    expect(r.body.disabled).toBe(true);
    expect(queries.some(q =>
      /UPDATE users SET two_factor_enabled = false/i.test(q.sql) && q.params[0] === UID)).toBe(true);
  });

  it('refuses a proof bound to a different account', async () => {
    verifyMetadata = { action: 'disable_2fa', userId: 'uid_someone_else' };
    const r = await disable({ verificationChallengeId: 'chal_1', verificationCode: '123456' });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('ACTOR_MISMATCH');
    expect(queries.some(q => /UPDATE users SET two_factor_enabled/i.test(q.sql))).toBe(false);
  });

  it('refuses a challenge that proved some other action', async () => {
    verifyMetadata = { action: 'close_account', userId: UID };
    const r = await disable({ verificationChallengeId: 'chal_1', verificationCode: '123456' });
    expect(r.status).toBe(400);
    expect(queries.some(q => /UPDATE users SET two_factor_enabled/i.test(q.sql))).toBe(false);
  });

  it('refuses HERE, plainly, when the disable_2fa purpose is switched off', async () => {
    // THE BUG THIS PIN EXISTS FOR. The route first guarded on the UMBRELLA
    // flag, which production sets — while UNIFIED_VERIFICATION_DISABLE_2FA_
    // ENABLED is not set at all. So it passed its own check and died inside
    // startChallenge: an exit that existed in the code and not in production.
    // The guard now calls the same predicate the service calls.
    delete process.env.UNIFIED_VERIFICATION_DISABLE_2FA_ENABLED;
    const r = await disable();
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('VERIFICATION_UNAVAILABLE');
    // Refused BEFORE the service was asked — not by falling into its error.
    expect(startChallenge).not.toHaveBeenCalled();
    expect(queries.some(q => /UPDATE users SET two_factor_enabled/i.test(q.sql))).toBe(false);
  });

  it('is reachable under the flag set production actually deploys', async () => {
    // The umbrella alone is what prod had, and it is NOT enough. This asserts
    // the route works under the exact env the deploy produces, so if the flag
    // is dropped from the Cloud Run config the pin fails rather than a member.
    const deploy = readFileSync(join(ROOT, '.github/workflows/petwash-ci.yml'), 'utf8');
    const setVars = /--set-env-vars=([^\s\\]+)/.exec(deploy);
    expect(setVars, 'Cloud Run --set-env-vars not found').toBeTruthy();
    const prodEnv: Record<string, string> = {};
    for (const pair of setVars![1].split(',')) {
      const [k, v] = pair.split('=');
      if (k?.startsWith('UNIFIED_VERIFICATION')) prodEnv[k] = v;
    }
    process.env = { ...process.env, ...prodEnv };
    delete process.env.UNIFIED_VERIFICATION_DISABLE_2FA_ENABLED;
    Object.assign(process.env, prodEnv);
    const r = await disable();
    expect(r.status, 'the deploy does not set UNIFIED_VERIFICATION_DISABLE_2FA_ENABLED, so this route 503s for every member').toBe(202);
  });

  it('REFUSES rather than downgrades when the challenge runtime is unavailable', async () => {
    // Enrolment removal falls back to session-only when the unified runtime is
    // off. Switching the account's whole login gate off is not the same act, so
    // this fails CLOSED — a security control may not be switched off by a
    // caller who proved nothing.
    delete process.env.UNIFIED_VERIFICATION_ENABLED;
    const r = await disable();
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('VERIFICATION_UNAVAILABLE');
    expect(queries.some(q => /UPDATE users SET two_factor_enabled/i.test(q.sql))).toBe(false);
  });

  it('does not claim success when the write changed no row', async () => {
    updateRowCount = 0;
    const r = await disable({ verificationChallengeId: 'chal_1', verificationCode: '123456' });
    expect(r.status).toBe(500);
    expect(r.body.code).toBe('TWO_STEP_DISABLE_FAILED');
    expect(r.body.disabled).toBeUndefined();
  });

  it('is a no-op, with no code emailed, when it is already off', async () => {
    twoFactorEnabled = false;
    const r = await disable();
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ disabled: true, alreadyDisabled: true });
    expect(startChallenge).not.toHaveBeenCalled();
  });
});

describe('the places that talk about this control now tell the truth', () => {
  it('the profile refusal names a route that exists', () => {
    expect(userProfileSrc).toMatch(/POST \/api\/mfa\/two-step\/disable/);
    // The two paths it used to name were never implemented.
    expect(userProfileSrc).not.toMatch(/\/api\/mfa\/enable or \/api\/mfa\/disable/);
    expect(mfaSrc).toMatch(/mfaRouter\.post\('\/two-step\/disable'/);
  });

  it('My Account renders the login control separately from enrolments', () => {
    expect(myAccount).toMatch(/mfaStatus\?\.twoStepLogin/);
    expect(myAccount).toMatch(/'\/api\/mfa\/two-step\/disable'/);
  });

  it('My Account shows unknown rather than Off when the setting cannot be read', () => {
    expect(myAccount).toMatch(/twoStepLogin\.enabled === null/);
  });
});
