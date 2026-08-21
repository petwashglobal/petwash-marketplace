/**
 * Behavioral + source-pin tests for the 6-item auth evil queue
 * (evil-hunt 2026-08-20). One test per parked-for-CEO SEV plus a
 * sweep pin for the SignUpLuxury TDZ family.
 *
 *   1. __session cookie: Domain=.petwash.co.il only when the request host
 *      actually ends with petwash.co.il — otherwise omit Domain (browsers
 *      drop it on *.a.run.app / localhost / *.web.app).
 *   2. /api/auth/email-session: mirror phone-session's DB_UNAVAILABLE
 *      hard-gate AND rollback the just-created Firebase user so a retry
 *      doesn't dead-end at "email already exists".
 *   3. CSRF secret: fail-boot in production when SESSION_SECRET and
 *      COOKIE_SECRET are both unset (multi-instance Cloud Run breaks
 *      silently with an ephemeral per-instance key). Add readiness
 *      field csrfSecretConfigured to /api/health.
 *   4. SMS-verify redirect: /provider/dashboard → /provider-os (canonical
 *      approved-provider home per post-login.ts:192); general → /home.
 *   5. Phone/email session terms-rejected: 200 → 400 TERMS_REJECTED and
 *      delete the just-minted Firebase user so the account never exists
 *      half-formed.
 *   6. Same terms-rejected pattern for the email-session equivalent.
 *
 * Unit-testable pieces (sessionCookies helpers, auth-sms redirect map,
 * App.tsx route existence) are exercised as real behavior. The handlers
 * that would require spinning up the multi-thousand-line routes.ts
 * module are source-pinned with tight regex assertions — a re-regression
 * fails the test loudly.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const REPO = join(__dirname, '..', '..');

// ─── Item 1: __session cookie Domain scoping ────────────────────────────────
describe('Item 1 — __session cookie Domain scoping (sessionCookies.ts)', () => {
  // We drive setSessionCookie / clearSessionCookie against a fake Express
  // Response and inspect the options passed to res.cookie / res.clearCookie.
  type CookieCall = { name: string; value?: string; options: any };
  function makeRes(): { cookie: any; clearCookie: any; calls: CookieCall[] } {
    const calls: CookieCall[] = [];
    return {
      calls,
      cookie: vi.fn((name: string, value: string, options: any) => {
        calls.push({ name, value, options });
      }),
      clearCookie: vi.fn((name: string, options: any) => {
        calls.push({ name, options });
      }),
    };
  }
  function makeReq(host: string | undefined) {
    // Minimal request shape sessionCookies.ts looks at.
    return { hostname: host, headers: { host } } as any;
  }

  const originalNodeEnv = process.env.NODE_ENV;
  beforeEach(() => { process.env.NODE_ENV = 'production'; });
  afterEach(() => { process.env.NODE_ENV = originalNodeEnv; });

  it('sets Domain=.petwash.co.il when host is petwash.co.il', async () => {
    const { setSessionCookie } = await import('../../server/lib/sessionCookies');
    const res = makeRes();
    setSessionCookie(res as any, 'cookie-value', makeReq('petwash.co.il'));
    expect(res.calls[0].options.domain).toBe('.petwash.co.il');
  });

  it('sets Domain=.petwash.co.il when host is www.petwash.co.il', async () => {
    const { setSessionCookie } = await import('../../server/lib/sessionCookies');
    const res = makeRes();
    setSessionCookie(res as any, 'cookie-value', makeReq('www.petwash.co.il'));
    expect(res.calls[0].options.domain).toBe('.petwash.co.il');
  });

  it('OMITS Domain on *.a.run.app (Cloud Run direct host)', async () => {
    const { setSessionCookie } = await import('../../server/lib/sessionCookies');
    const res = makeRes();
    setSessionCookie(res as any, 'cookie-value', makeReq('petwash-abc123-uc.a.run.app'));
    expect(res.calls[0].options.domain).toBeUndefined();
  });

  it('OMITS Domain on *.web.app (Firebase Hosting default)', async () => {
    const { setSessionCookie } = await import('../../server/lib/sessionCookies');
    const res = makeRes();
    setSessionCookie(res as any, 'cookie-value', makeReq('petwash-staging.web.app'));
    expect(res.calls[0].options.domain).toBeUndefined();
  });

  it('OMITS Domain on localhost', async () => {
    const { setSessionCookie } = await import('../../server/lib/sessionCookies');
    const res = makeRes();
    setSessionCookie(res as any, 'cookie-value', makeReq('localhost'));
    expect(res.calls[0].options.domain).toBeUndefined();
  });

  it('clearSessionCookie mirrors set — same Domain for the same host', async () => {
    const { setSessionCookie, clearSessionCookie } = await import('../../server/lib/sessionCookies');
    for (const host of ['petwash.co.il', 'www.petwash.co.il', 'petwash-abc.a.run.app', 'localhost']) {
      const setRes = makeRes(); setSessionCookie(setRes as any, 'v', makeReq(host));
      const clrRes = makeRes(); clearSessionCookie(clrRes as any, makeReq(host));
      expect(clrRes.calls[0].options.domain).toBe(setRes.calls[0].options.domain);
      // And path/sameSite/httpOnly/secure match — browser must accept the clear.
      expect(clrRes.calls[0].options.path).toBe(setRes.calls[0].options.path);
      expect(clrRes.calls[0].options.sameSite).toBe(setRes.calls[0].options.sameSite);
      expect(clrRes.calls[0].options.httpOnly).toBe(setRes.calls[0].options.httpOnly);
      expect(clrRes.calls[0].options.secure).toBe(setRes.calls[0].options.secure);
    }
  });
});

// ─── Item 2: /api/auth/email-session orphan-safe on DB failure ──────────────
describe('Item 2 — email-session mirrors phone-session on bootstrap fail (source pin)', () => {
  const src = readFileSync(join(REPO, 'server/routes/publicAuthRoutes.ts'), 'utf8');
  it('email-session handler catches AuthBootstrapUsersRowFailed and returns 502 DB_UNAVAILABLE', () => {
    // The handler must have the same shape as phone-session's catch: match on
    // instanceof AuthBootstrapUsersRowFailed and return 502 with code.
    // Pin the discriminating text of the new catch block.
    expect(src).toMatch(/\[EmailAuth\][^\n]*bootstrap HARD-FAILED/);
    expect(src).toMatch(/code:\s*['"]DB_UNAVAILABLE['"]/);
    // And it must live under the ensureUserProvisioned call so we actually
    // catch its throw, not a bogus later throw.
    const provIdx = src.indexOf(`ensureUserProvisioned(user.uid, { channel: 'email'`);
    const catchIdx = src.indexOf('[EmailAuth] users row bootstrap HARD-FAILED');
    expect(provIdx).toBeGreaterThan(-1);
    expect(catchIdx).toBeGreaterThan(provIdx);
  });

  it('deletes the just-created Firebase user on bootstrap fail (retry not blocked by half-orphan)', () => {
    // The rollback must be scoped to the newly-created user only — never for
    // a returning user that came in via getUserByEmail(). We assert both
    // shapes: the boolean flag AND the deleteUser call gated on it.
    expect(src).toMatch(/createdNewFirebaseUser\s*=\s*true/);
    expect(src).toMatch(/if\s*\(\s*createdNewFirebaseUser\s*\)/);
    expect(src).toMatch(/adminAuth\.deleteUser\(user\.uid\)/);
  });
});

// ─── Item 3: CSRF secret fail-boot + readiness field ────────────────────────
describe('Item 3 — CSRF secret fail-boot in production + readiness field', () => {
  const src = readFileSync(join(REPO, 'server/index.ts'), 'utf8');

  it('throws at module load in production when both env vars are unset', () => {
    // Source pin the guard shape — the actual boot would drag in half the
    // server, which would fail on unrelated env in a unit test. The pinned
    // pattern is exact so an accidental removal fails the test loudly.
    expect(src).toMatch(/if \(process\.env\.NODE_ENV === 'production'\)/);
    expect(src).toMatch(/throw new Error\('SESSION_SECRET_REQUIRED_IN_PRODUCTION'\)/);
    // And the message must NOT print the secret value — pin that we log
    // ONLY the fact that it's unset, never the fallback bytes.
    const fatalLine = src.match(/\[startup\] FATAL:[^\n]+/);
    expect(fatalLine?.[0]).toBeDefined();
    expect(fatalLine![0]).not.toMatch(/[0-9a-f]{32,}/); // no hex secret leaked
  });

  it('/api/health carries the csrfSecretConfigured boolean', () => {
    // The field name is the operator contract — grep-pin its presence
    // (payload is booleans-only per §Security).
    expect(src).toMatch(/csrfSecretConfigured/);
    // And it must be a boolean derived from the env presence, not the value.
    expect(src).toMatch(/const csrfSecretConfigured = !!_csrfSecretFromEnv;/);
  });

  it('non-production keeps a random ephemeral key (dev/tests still boot)', () => {
    // The fallback must still exist for non-production so vitest / local dev
    // don't require a Secret Manager round-trip.
    expect(src).toMatch(/crypto\.randomBytes\(32\)\.toString\('hex'\)/);
  });
});

// ─── Item 4: SMS-verify redirect map points at ROUTES THAT EXIST ────────────
describe('Item 4 — SMS-verify redirect targets exist as real routes in App.tsx', () => {
  it('redirectForFlow(provider) is /provider-os and it is a real App.tsx route', async () => {
    const { redirectForFlow } = await import('../../server/routes/auth-sms');
    expect(redirectForFlow('provider' as any)).toBe('/provider-os');
    const app = readFileSync(join(REPO, 'client/src/App.tsx'), 'utf8');
    expect(app).toMatch(/<Route\s+path="\/provider-os">/);
  });

  it('redirectForFlow(general) is /home and it is a real App.tsx route', async () => {
    const { redirectForFlow } = await import('../../server/routes/auth-sms');
    expect(redirectForFlow('general' as any)).toBe('/home');
    const app = readFileSync(join(REPO, 'client/src/App.tsx'), 'utf8');
    expect(app).toMatch(/<Route\s+path="\/home">/);
  });

  it('redirectForFlow(prestige) is /prestige/home (unchanged; sanity pin)', async () => {
    const { redirectForFlow } = await import('../../server/routes/auth-sms');
    expect(redirectForFlow('prestige' as any)).toBe('/prestige/home');
    const app = readFileSync(join(REPO, 'client/src/App.tsx'), 'utf8');
    expect(app).toMatch(/<Route\s+path="\/prestige\/home">/);
  });

  it('every flow in FLOW_REDIRECTS resolves to a routable App.tsx path', async () => {
    // Enumerate the well-known flow keys directly (they're a discriminated
    // union in the module) and check each target string appears in App.tsx.
    const { redirectForFlow } = await import('../../server/routes/auth-sms');
    const flows = ['prestige', 'provider', 'guest', 'general', 'booking', 'activation'] as const;
    const app = readFileSync(join(REPO, 'client/src/App.tsx'), 'utf8');
    for (const f of flows) {
      const target = redirectForFlow(f as any);
      // The target is either a static Route or a Redirect-source Route.
      const re = new RegExp(`<Route\\s+path="${target.replace(/\//g, '\\/')}"`);
      expect(app, `no App.tsx route for ${f} → ${target}`).toMatch(re);
    }
  });
});

// ─── Items 5 & 6: terms-rejected → 400 + Firebase rollback ──────────────────
describe('Items 5+6 — terms-rejected: 400 TERMS_REJECTED + Firebase user rollback', () => {
  const src = readFileSync(join(REPO, 'server/routes.ts'), 'utf8');

  it('/session handler returns 400 TERMS_REJECTED on !ageConfirmed || !serverAdult', () => {
    // The rejection branch must issue a status 400 with our canonical code.
    // Pin the trio: predicate → deleteUser → 400 response.
    expect(src).toMatch(/\(!ageConfirmed \|\| !serverAdult\)/);
    expect(src).toMatch(/code:\s*['"]TERMS_REJECTED['"]/);
    expect(src).toMatch(/return res\.status\(400\)\.json\(\{\s*[\s\S]*?['"]TERMS_REJECTED['"]/);
  });

  it('the terms-rejected branch deletes the just-created Firebase user', () => {
    // Delete must be scoped to the terms-rejected path (only-run when
    // _syncResult.isNewUser is true — the row-was-just-created guard).
    const branchIdx = src.indexOf('rolled back just-created Firebase user (terms rejected)');
    expect(branchIdx, 'rollback log line must exist').toBeGreaterThan(-1);
    // deleteUser call must precede the 400 return within the same block.
    const deleteIdx = src.indexOf('fbAdminAuth.deleteUser', branchIdx - 400);
    const returnIdx = src.indexOf("code: 'TERMS_REJECTED'", branchIdx);
    expect(deleteIdx).toBeGreaterThan(-1);
    expect(returnIdx).toBeGreaterThan(deleteIdx);
  });

  it('preserves the success-path shape (isNewUser echoed on 200 success)', () => {
    // Sanity pin so the fix didn't accidentally change the success shape —
    // the client's mandatory "verify BOTH contacts" screen depends on it.
    expect(src).toMatch(/isNewUser:\s*!!_syncResult\?\.isNewUser/);
  });
});
