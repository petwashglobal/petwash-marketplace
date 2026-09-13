/**
 * CEO 2026-09-13: "be super smart, deep in the holes, nail them — any end, any
 * tricky old code". Every hole here was found by a five-lane read-only audit and
 * then re-verified line by line before being fixed. See memory
 * deep-audit-both-ends-2026-09-13.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { reserveOtpAttempt, type AttemptCounterStore } from '../lib/otpAttemptReservation';

const R = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

/** A store whose INCR is atomic, like Redis: concurrent callers get distinct values. */
function atomicStore(): AttemptCounterStore & { value: number } {
  const st = { value: 0 } as any;
  st.incr = async () => { await new Promise(r => setImmediate(r)); return ++st.value; };
  st.expire = async () => true;
  return st;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('A3 — login codes: parallel guessing cannot beat the attempt limit', () => {
  it('200 simultaneous wrong guesses get exactly 5 real code comparisons', async () => {
    const store = atomicStore();
    let compared = 0;
    await Promise.all(Array.from({ length: 200 }, async () => {
      const r = await reserveOtpAttempt(store, 'otp:k', 5, 300);
      if (r.ok) compared++;                       // only a reservation may compare
    }));
    expect(compared).toBe(5);
  });

  it('the wrapper returning 0 (Redis down / error) FAILS CLOSED — never "under the limit"', async () => {
    // server/services/redis.ts incr() returns 0 on any error. A successful INCR can
    // never return 0, so treating it as attempt #0 would silently remove the lock.
    const broken: AttemptCounterStore = { incr: async () => 0, expire: async () => false };
    const r = await reserveOtpAttempt(broken, 'k', 5, 300);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unavailable');
  });

  it('a thrown INCR also fails closed', async () => {
    const throws: AttemptCounterStore = { incr: async () => { throw new Error('ECONNRESET'); }, expire: async () => true };
    const r = await reserveOtpAttempt(throws, 'k', 5, 300);
    expect(r).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('the 6th attempt is refused as exhausted, and remaining counts down', async () => {
    const store = atomicStore();
    const seen = [];
    for (let i = 0; i < 6; i++) seen.push(await reserveOtpAttempt(store, 'k', 5, 300));
    expect(seen.slice(0, 5).map((x: any) => x.remaining)).toEqual([4, 3, 2, 1, 0]);
    expect(seen[5]).toMatchObject({ ok: false, reason: 'exhausted', attempt: 6 });
  });

  it('UnifiedVerificationService reserves BEFORE it compares the code', () => {
    const src = R('server/services/UnifiedVerificationService.ts');
    const fn = src.slice(src.indexOf('async verifyChallenge('));
    const reserveAt = fn.indexOf('attempts: sql`${verificationChallenges.attempts} + 1`');
    const guardAt = fn.indexOf('lt(verificationChallenges.attempts, challenge.maxAttempts)');
    const compareAt = fn.indexOf('timingSafeHashEqual(candidateHash');
    expect(reserveAt, 'atomic SQL increment missing').toBeGreaterThan(-1);
    expect(guardAt, 'reservation is not conditional on attempts < max').toBeGreaterThan(-1);
    expect(compareAt).toBeGreaterThan(-1);
    expect(reserveAt, 'code is compared before the attempt is reserved').toBeLessThan(compareAt);
    // and the stale read-then-write it replaced is gone
    expect(fn).not.toMatch(/const nextAttempts = challenge\.attempts \+ 1;/);
  });

  it('the SMS and email code checks both reserve BEFORE comparing, and reset per code', () => {
    const sms = R('server/services/TwilioSMSService.ts');
    const sFn = sms.slice(sms.indexOf('async verifyCode('));
    expect(sFn.indexOf('reserveOtpAttempt(')).toBeGreaterThan(-1);
    expect(sFn.indexOf('reserveOtpAttempt(')).toBeLessThan(sFn.indexOf('crypto.timingSafeEqual(hmacA, hmacB)'));
    // Pin the reset on the ISSUE path specifically. The same del also exists on the
    // success path, so a whole-file match passed even with the issue-path reset gone.
    const issueAt = sms.indexOf('{ codeHmac, attempts: 0, expiresAtMs: expiresAt.getTime() }');
    expect(issueAt, 'could not find where a new SMS code is stored').toBeGreaterThan(-1);
    const afterIssue = sms.slice(issueAt, sms.indexOf('async verifyCode('));
    expect(afterIssue, 'SMS attempt counter is not reset when a new code is issued')
      .toMatch(/redis\.del\(`otp:login:attempts:\$\{formattedPhone\}`\)/);
    const verifyBody = sms.slice(sms.indexOf('async verifyCode('));
    expect(verifyBody, 'SMS attempt counter is not cleared after a correct code')
      .toMatch(/Correct code[\s\S]{0,200}otp:login:attempts:\$\{formattedPhone\}/);

    const em = R('server/routes/onboarding-verification.ts');
    const eFn = em.slice(em.indexOf("router.post('/verify-email-code'"));
    expect(eFn.indexOf('reserveOtpAttempt(')).toBeGreaterThan(-1);
    expect(eFn.indexOf('reserveOtpAttempt(')).toBeLessThan(eFn.indexOf('crypto.timingSafeEqual(Buffer.from(stored.code)'));
    const del = em.slice(em.indexOf('async function deleteEmailCode('), em.indexOf('async function deleteEmailCode(') + 300);
    expect(del, 'email attempt counter does not die with its code').toContain('K_EMAIL_ATTEMPTS(email)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('A1 — any Google account could read every invoice', () => {
  const routes = () => R('server/routes.ts');

  it('the four finance routers require an admin AT THE MOUNT', () => {
    const src = routes();
    for (const [mount, router] of [
      ['/api/ita', 'itaApiRoutes'],
      ['/api/accounting-exports', 'accountingExportRoutes'],
      ['/api/gemini-watchdog', 'geminiWatchdogRoutes.default'],
      ['/api/campaigns', 'campaignsRoutes'],
    ]) {
      const re = new RegExp(`app\\.use\\('${mount.replace(/\//g, '\\/')}',[^;]*requireAdmin[^;]*${router.replace('.', '\\.')}\\);`);
      expect(re.test(src), `${mount} is mounted without requireAdmin`).toBe(true);
    }
  });

  it("the internal-route guard blocks 'customer' — the role mobile Google sign-in stamps", () => {
    const src = routes();
    expect(src).toMatch(/role === 'public' \|\| role === 'pet_parent' \|\| role === 'customer'/);
    // and the stamping really is 'customer', so this is not hypothetical
    expect(R('server/routes/mobile-auth.ts')).toMatch(/role:\s*'customer'/);
  });

  it('the internal-route guard FAILS CLOSED when the role lookup errors', () => {
    const src = routes();
    const at = src.indexOf("[RBAC Guard] Could not verify role claims");
    expect(at).toBeGreaterThan(-1);
    const tail = src.slice(at, at + 500);
    expect(tail, 'role lookup failure still falls through to next()').toMatch(/return res\.status\(503\)/);
    expect(src).not.toContain('Could not verify role claims, falling through');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("A4 — nobody may read or change another user's marketing consent", () => {
  it('all four /api/monitoring/notifications/*/:userId routes are self-only', () => {
    const src = R('server/routes.ts');
    for (const sig of [
      "app.get('/api/monitoring/notifications/preferences/:userId'",
      "app.put('/api/monitoring/notifications/preferences/:userId'",
      "app.post('/api/monitoring/notifications/revoke/:userId'",
      "app.get('/api/monitoring/notifications/audit/:userId'",
    ]) {
      const at = src.indexOf(sig);
      expect(at, `${sig} not found`).toBeGreaterThan(-1);
      // Search INSIDE the handler body only — the route path itself contains
      // 'revoke' / 'audit', and matching that made the check meaningless.
      const body = src.slice(src.indexOf('try {', at), at + 900);
      const guardAt = body.indexOf("if (req.params.userId !== (req as any).firebaseUser?.uid) return res.status(403)");
      const actionAt = body.search(/readNotificationPrefs\(|writeNotificationPrefs\(|revokeAllConsents\(|getConsentAuditLog\(/);
      expect(actionAt, `${sig}: could not find the consent operation`).toBeGreaterThan(-1);
      expect(guardAt, `${sig} has no self-only check`).toBeGreaterThan(-1);
      expect(guardAt, `${sig} acts before checking the caller`).toBeLessThan(actionAt);
    }
  });
});
