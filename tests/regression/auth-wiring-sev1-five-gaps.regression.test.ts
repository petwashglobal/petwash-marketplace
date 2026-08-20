import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Auth-wiring SEV-1 five-gaps audit (2026-08-20).
//
// The CEO rule this file protects: "sync, verify, save, record through the
// canonical spine." Each pin locks the ONE exact anchor a prior audit
// identified as the silent-drift point — if any of these regress, we get
// back the exact SEV-1 the fix closed:
//
//   #1 /api/auth/session never returned isNewUser
//      → mandatory verify-BOTH-contacts step silently skipped for every
//        first-time Google/Apple social signup.
//
//   #2 provider approval wrote to the wrong table
//      → approved provider still routed to /provider/pending on next login
//        because storage.getProviderApplicationByUser reads a table whose
//        status column the approve path never touched.
//
//   #3 FLOW_REDIRECTS.prestige pointed to /member/dashboard (404)
//      → SignUpLuxury's default flow landed the user on a dead route
//        immediately after SMS verify.
//
//   #4 /api/mobile-auth/google returned 200 + customToken on Postgres
//      bootstrap failure and never called setCustomUserClaims
//      → mobile Google user lands with no users row (whoami/wallet 500s)
//        AND their token stays role='public'.
//
//   #5 authBootstrap silent-failed the users-row insert; phone-session /
//      auth-session still returned ok:true
//      → first-time phone-OTP user on a DB blip: Firebase account exists,
//        Postgres row does NOT; every subsequent request breaks.

const REPO = join(__dirname, '..', '..');
const ROUTES_TS = readFileSync(join(REPO, 'server', 'routes.ts'), 'utf8');
const AUTH_SMS = readFileSync(join(REPO, 'server', 'routes', 'auth-sms.ts'), 'utf8');
const MOBILE_AUTH = readFileSync(join(REPO, 'server', 'routes', 'mobile-auth.ts'), 'utf8');
const PUBLIC_AUTH = readFileSync(join(REPO, 'server', 'routes', 'publicAuthRoutes.ts'), 'utf8');
const AUTH_BOOTSTRAP = readFileSync(join(REPO, 'server', 'services', 'authBootstrap.ts'), 'utf8');
const ADMIN_REVIEW = readFileSync(
  join(REPO, 'server', 'services', 'AdminProviderReviewService.ts'),
  'utf8',
);

// Isolate the /api/auth/session handler body so the pin is anchored to the
// right route (not just to a matching string somewhere else in the giant
// routes.ts file).
function sessionHandlerBody(): string {
  const start = ROUTES_TS.indexOf("app.post('/api/auth/session'");
  expect(start).toBeGreaterThan(-1);
  // The handler is followed by app.post('/api/auth/signout', ...).
  const end = ROUTES_TS.indexOf("app.post('/api/auth/signout'", start);
  expect(end).toBeGreaterThan(start);
  return ROUTES_TS.slice(start, end);
}

// Isolate the /api/auth/phone-session handler body.
function phoneSessionHandlerBody(): string {
  const start = PUBLIC_AUTH.indexOf('publicAuthRouter.post("/api/auth/phone-session"');
  expect(start).toBeGreaterThan(-1);
  // The handler is followed by the /api/auth/email-session comment/route.
  const end = PUBLIC_AUTH.indexOf('/api/auth/email-session', start);
  expect(end).toBeGreaterThan(start);
  return PUBLIC_AUTH.slice(start, end);
}

// Isolate the mobile-google handler body.
function mobileGoogleHandlerBody(): string {
  const start = MOBILE_AUTH.indexOf("router.post('/google'");
  expect(start).toBeGreaterThan(-1);
  // Followed by router.post('/verify', ...).
  const end = MOBILE_AUTH.indexOf("router.post('/verify'", start);
  expect(end).toBeGreaterThan(start);
  return MOBILE_AUTH.slice(start, end);
}

describe('auth-wiring 2026-08-20 SEV-1 five-gaps fixes', () => {
  // ── #1 isNewUser in /api/auth/session response ──────────────────────
  describe('SEV-1 #1 — /api/auth/session emits isNewUser', () => {
    it('the JSON response body construction includes isNewUser sourced from the sync result', () => {
      const body = sessionHandlerBody();
      // The response used to be { ok, cookie, expiresInMs }. The pin locks
      // the exact new field name AND that its value comes from _syncResult,
      // not a hardcoded false — otherwise the verify-BOTH-contacts step is
      // silently skipped again for every Google/Apple first-time signup.
      expect(body).toMatch(/res\.json\(\s*\{[\s\S]*?isNewUser:\s*!!\s*_syncResult\?\.isNewUser[\s\S]*?\}\s*\)/);
    });
  });

  // ── #2 provider approval mirror-writes provider_applications ────────
  describe('SEV-1 #2 — AdminProviderReviewService writes provider_applications', () => {
    it('imports the providerApplications drizzle symbol from @shared/schema', () => {
      // Grep-safe: single line, matches even if the import list wraps.
      expect(ADMIN_REVIEW).toMatch(/providerApplications/);
      expect(ADMIN_REVIEW).toMatch(/from ['"]@shared\/schema['"]/);
    });

    it('approveApplication includes an UPDATE against provider_applications', () => {
      const start = ADMIN_REVIEW.indexOf('async approveApplication');
      expect(start).toBeGreaterThan(-1);
      const end = ADMIN_REVIEW.indexOf('async rejectApplication', start);
      expect(end).toBeGreaterThan(start);
      const body = ADMIN_REVIEW.slice(start, end);
      // The approve path must UPDATE the providerApplications table (the
      // reader in post-login.ts uses this table via storage.getProviderApplicationByUser).
      expect(body).toMatch(/\.update\(\s*providerApplications\s*\)/);
      expect(body).toMatch(/status:\s*['"]approved['"]/);
    });

    it('rejectApplication mirror-writes provider_applications with rejected', () => {
      const start = ADMIN_REVIEW.indexOf('async rejectApplication');
      expect(start).toBeGreaterThan(-1);
      const end = ADMIN_REVIEW.indexOf('async putOnHold', start);
      expect(end).toBeGreaterThan(start);
      const body = ADMIN_REVIEW.slice(start, end);
      expect(body).toMatch(/\.update\(\s*providerApplications\s*\)/);
      expect(body).toMatch(/status:\s*['"]rejected['"]/);
    });

    it('putOnHold mirror-writes provider_applications so the reader stays consistent', () => {
      const start = ADMIN_REVIEW.indexOf('async putOnHold');
      expect(start).toBeGreaterThan(-1);
      // The next method after putOnHold is isProviderApproved.
      const end = ADMIN_REVIEW.indexOf('async isProviderApproved', start);
      expect(end).toBeGreaterThan(start);
      const body = ADMIN_REVIEW.slice(start, end);
      expect(body).toMatch(/\.update\(\s*providerApplications\s*\)/);
    });
  });

  // ── #3 SMS default-flow redirect target ─────────────────────────────
  describe('SEV-1 #3 — auth-sms FLOW_REDIRECTS.prestige points to /prestige/home', () => {
    it('the map literal binds prestige to /prestige/home exactly', () => {
      const start = AUTH_SMS.indexOf('const FLOW_REDIRECTS');
      expect(start).toBeGreaterThan(-1);
      const end = AUTH_SMS.indexOf('};', start);
      expect(end).toBeGreaterThan(start);
      const block = AUTH_SMS.slice(start, end);
      expect(block).toMatch(/prestige:\s*['"]\/prestige\/home['"]/);
      // Regression guard: the buggy value must NOT reappear.
      expect(block).not.toMatch(/prestige:\s*['"]\/member\/dashboard['"]/);
    });
  });

  // ── #4 mobile-auth Google: 502 on bootstrap fail + setCustomUserClaims ─
  describe('SEV-1 #4 — mobile-auth/google fails hard + stamps role claim', () => {
    it('returns HTTP 502 on the failed-pg-bootstrap branch (was silent 200)', () => {
      const body = mobileGoogleHandlerBody();
      // The pin locks BOTH the status code AND the discriminated error code
      // so a caller can retry deterministically.
      expect(body).toMatch(/res\.status\(502\)\.json\(\s*\{[\s\S]*?success:\s*false[\s\S]*?code:\s*['"]DB_UNAVAILABLE['"][\s\S]*?\}\s*\)/);
      expect(body).toMatch(/error:\s*['"]user_bootstrap_failed['"]/);
    });

    it('calls setCustomUserClaims on the success path so whoami sees role=customer', () => {
      const body = mobileGoogleHandlerBody();
      expect(body).toMatch(/setCustomUserClaims\(\s*uid\s*,/);
      expect(body).toMatch(/role:\s*['"]customer['"]/);
      expect(body).toMatch(/accountType:\s*['"]pet_parent['"]/);
    });
  });

  // ── #5 authBootstrap hard-fail + callers convert to 502 ────────────
  describe('SEV-1 #5 — authBootstrap throws a typed error the callers convert to 502', () => {
    it('authBootstrap exports the AuthBootstrapUsersRowFailed error class', () => {
      expect(AUTH_BOOTSTRAP).toMatch(/export class AuthBootstrapUsersRowFailed/);
      // The typed error carries a DB_UNAVAILABLE code so callers pattern-match
      // on the class OR the code without stringly-typing on the message.
      expect(AUTH_BOOTSTRAP).toMatch(/readonly code = ['"]DB_UNAVAILABLE['"]/);
    });

    it('authBootstrap THROWS AuthBootstrapUsersRowFailed when the users row invariant is not met', () => {
      // The signal is raised from the re-check block after the insert branch —
      // either the insert threw, or the row still isn't visible.
      expect(AUTH_BOOTSTRAP).toMatch(/throw new AuthBootstrapUsersRowFailed/);
    });

    it('authBootstrap keeps wallet/loyalty writes best-effort (logger.warn, not throw)', () => {
      // Guard against over-fixing: only the users row is a hard gate; wallet
      // and loyalty must remain non-blocking or a Redis blip locks out login.
      expect(AUTH_BOOTSTRAP).toMatch(/\[authBootstrap\] wallet ensure failed \(non-blocking\)/);
      expect(AUTH_BOOTSTRAP).toMatch(/\[authBootstrap\] loyalty ensure failed \(non-blocking\)/);
    });

    it('/api/auth/phone-session imports AuthBootstrapUsersRowFailed and catches it into a 502', () => {
      expect(PUBLIC_AUTH).toMatch(/AuthBootstrapUsersRowFailed/);
      const body = phoneSessionHandlerBody();
      expect(body).toMatch(/AuthBootstrapUsersRowFailed/);
      expect(body).toMatch(/res\.status\(502\)\.json\(\s*\{[\s\S]*?code:\s*['"]DB_UNAVAILABLE['"][\s\S]*?\}\s*\)/);
      expect(body).toMatch(/error:\s*['"]user_bootstrap_failed['"]/);
    });

    it('/api/auth/session imports AuthBootstrapUsersRowFailed and 502s on the same failure', () => {
      expect(ROUTES_TS).toMatch(/AuthBootstrapUsersRowFailed/);
      const body = sessionHandlerBody();
      expect(body).toMatch(/AuthBootstrapUsersRowFailed/);
      expect(body).toMatch(/res\.status\(502\)\.json\(\s*\{[\s\S]*?code:\s*['"]DB_UNAVAILABLE['"][\s\S]*?\}\s*\)/);
      expect(body).toMatch(/error:\s*['"]user_bootstrap_failed['"]/);
    });

    it('routes.ts uses a named DB_BOOTSTRAP_TIMEOUT_MS constant of 8000 (was inlined 3000)', () => {
      // The named constant is the grep anchor + prevents a silent revert to
      // the 3-second race that made a slow-but-successful insert look like
      // a failure.
      expect(ROUTES_TS).toMatch(/const\s+DB_BOOTSTRAP_TIMEOUT_MS\s*=\s*8000/);
      // And the race has to use it — not a fresh magic number.
      expect(ROUTES_TS).toMatch(/setTimeout\(\(\)\s*=>\s*resolve\(null\),\s*DB_BOOTSTRAP_TIMEOUT_MS\)/);
    });
  });
});
