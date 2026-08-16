/**
 * PR-AUTH-ADMIN-7 regression pins — Google-only admin login + verified
 * super_admin promotion.
 *
 * Two shapes must never come back:
 *
 *   1) An email+password form on /admin/login. Password-based admin login
 *      routes the trust to whatever password the operator picked (or
 *      re-used) instead of to the identity Google/Apple authenticated.
 *      Google SSO shifts that trust to the provider, so the
 *      SUPER_ADMIN_EMAILS + email_verified gate on /api/auth/session
 *      is the sole authorization boundary.
 *
 *   2) A super_admin Firebase claim written on a raw SUPER_ADMIN_EMAILS
 *      hit with no email_verified gate. That let anyone who registered
 *      an unverified Firebase account with an allowlisted email receive
 *      the super_admin claim on the next sign-in. Fix: gate the claim
 *      write on decoded.email_verified === true.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('PR-AUTH-ADMIN-7 — /api/admin/login endpoint retired', () => {
  const routes = read('server/routes.ts');

  it('POST /api/admin/login returns 410 with ENDPOINT_RETIRED (was a 400 stub)', () => {
    // The old handler returned 400 with USE_FIREBASE_AUTH — a permanent
    // stub that still read as an active endpoint. 410 Gone makes the
    // retirement explicit and matches the pattern used for other
    // deprecated auth surfaces (e.g. /api/messages/lookup-user retired
    // in PR-AUTH-INBOX-3).
    const handler = routes.match(
      /app\.post\('\/api\/admin\/login',[\s\S]*?\}\);\s*\n/,
    );
    expect(handler, '/api/admin/login handler missing').toBeTruthy();
    expect(handler![0]).toMatch(/return res\.status\(410\)\.json\(\{/);
    expect(handler![0]).toMatch(/error: 'ENDPOINT_RETIRED'/);
    expect(handler![0]).toMatch(/Google-only/);
    // The old stub shape must not resurface:
    expect(handler![0]).not.toMatch(/USE_FIREBASE_AUTH/);
    expect(handler![0]).not.toMatch(/status\(400\)/);
    // No password backdoor / hardcoded credentials must reappear inside
    // this handler even in comments:
    expect(handler![0]).not.toMatch(/CEO password/i);
    expect(handler![0]).not.toMatch(/generic 'admin' password/i);
  });
});

describe('PR-AUTH-ADMIN-7 — /api/auth/session super_admin claim requires email_verified', () => {
  const routes = read('server/routes.ts');

  it('scopes the claim write to (allowlist AND decoded.email_verified === true)', () => {
    // The block below was previously guarded only by isSuperAdmin(email).
    // Every branch that actually writes setCustomUserClaims must now sit
    // inside the (allowlisted && emailVerifiedForClaims) gate.
    const block = routes.match(
      /Super-admin custom claim — VERIFIED path only\.[\s\S]*?\}\s*catch \(claimsErr\)/,
    );
    expect(block, 'verified-path super-admin claim block missing').toBeTruthy();
    expect(block![0]).toMatch(/decodedForClaims\.email_verified === true/);
    expect(block![0]).toMatch(/if \(allowlisted && emailVerifiedForClaims\)/);
    // The setCustomUserClaims call must be inside the guarded branch:
    expect(block![0]).toMatch(/setCustomUserClaims\([\s\S]*?super_admin/);
  });

  it('logs a warning when an allowlist match is rejected for missing verification', () => {
    // Silent skip would hide the drift ("why did my super_admin claim
    // not land?" reads as a system fault). Loud warning surfaces the
    // real cause — the email is not verified.
    expect(routes).toMatch(/Super-admin allowlist match REJECTED — email not verified/);
  });

  it('never writes the super_admin claim on a raw isSuperAdmin(email) hit alone', () => {
    // Regression: an accidental refactor that hoists the setCustomUserClaims
    // call out of the (allowlisted && emailVerifiedForClaims) branch would
    // re-open the enumeration/impersonation door. The narrow shape below
    // (setCustomUserClaims for super_admin NOT preceded by an email_verified
    // check within the same source range) must not appear.
    const naiveShape = routes.match(
      /if \(checkSuperAdmin\(emailForClaims\)\) \{[\s\S]{0,200}?setCustomUserClaims\([\s\S]*?super_admin/,
    );
    expect(naiveShape, 'unguarded super_admin claim write reintroduced').toBeFalsy();
  });
});

describe('PR-AUTH-ADMIN-7 — /admin/login UI is Google + passkey only', () => {
  const login = read('client/src/pages/admin/AdminLoginV2.tsx');

  it('does NOT render an email+password form / Sign In submit', () => {
    // The retired handler, form, and password state must all be gone.
    expect(login).not.toMatch(/<form onSubmit=\{handleStandardLogin\}/);
    expect(login).not.toMatch(/handleStandardLogin\s*=\s*async/);
    expect(login).not.toMatch(/signInWithEmailAndPassword/);
    expect(login).not.toMatch(/const \[password, setPassword\]/);
    // The password Input by testid must be gone:
    expect(login).not.toMatch(/data-testid="input-password"/);
    // No submit button labelled Sign In:
    expect(login).not.toMatch(/data-testid="button-login"/);
  });

  it('does NOT render a Forgot password? path (no password to forget)', () => {
    // The reset flow only made sense while the email+password form
    // existed. Removing the flow also removes a code path that called
    // sendPasswordResetEmail, closing an enumeration side channel.
    expect(login).not.toMatch(/Forgot password\?/);
    expect(login).not.toMatch(/sendPasswordResetEmail/);
  });

  it('keeps the Google sign-in path as the primary admin entry', () => {
    // Google-only per the MASTER AUTH contract. The Continue with Google
    // button must remain wired to handleGoogleLogin.
    expect(login).toMatch(/Continue with Google/);
    expect(login).toMatch(/handleGoogleLogin/);
  });

  it('keeps the passkey/Touch-ID path (an additional strong-auth method)', () => {
    // The passkey path is not admin-specific — it reuses the general
    // /api/webauthn/login/* flow. Kept as a "sign in with what you
    // already enrolled" convenience for returning admins.
    expect(login).toMatch(/handleBiometricLogin/);
    expect(login).toMatch(/supportsWebAuthn/);
  });

  it('keeps an email input ONLY as a lookup hint for the passkey path (never required for Google)', () => {
    // Google SSO does not need an email typed by the user. The input is
    // only rendered when the browser has a platform authenticator
    // (nothing to look up otherwise), is intentionally not required,
    // and its help text points admins back to Continue with Google.
    // Regression: the input must never be marked `required` (which was
    // the old form's shape) — that would make the Google button feel
    // gated on typing an email.
    // The passkey-lookup email block is present and gated on supportsWebAuthn:
    expect(login).toMatch(/Admin email \(for Touch ID \/ Face ID\)/);
    // Look for the guard directly above the input block — anchored by the
    // exact label so a refactor that unmounts the guard flips the test.
    expect(login).toMatch(
      /\{supportsWebAuthn && \([\s\S]{0,80}<div className="mt-6">[\s\S]{0,120}Admin email \(for Touch ID \/ Face ID\)/,
    );
    // The email <Input> block anchored by data-testid MUST NOT carry a
    // `required` prop — the retired form's shape used `required` on both
    // email and password inputs; a refactor that copies that shape back
    // in would gate the Google button on typing an email.
    const inputTag = login.match(
      /<Input\b[\s\S]*?data-testid="input-email"[\s\S]*?\/>/,
    );
    expect(inputTag, 'email <Input> missing').toBeTruthy();
    expect(inputTag![0]).not.toMatch(/\brequired\b/);
    // Explicit help text points back at the Google button as primary:
    expect(login).toMatch(/Continue with Google above works without an email/);
  });
});
