/**
 * Issue #153 PR-BPV-1 — Become Provider straight-through + SignIn race
 * collapse regression pin.
 *
 * BEFORE this fix:
 *   App.tsx:2182-2194 — /become-provider unconditionally returned
 *     <Redirect to="/sign-in?redirect=/provider-onboarding"> for EVERY
 *     visitor including signed-in users. Visible /sign-in chrome flash
 *     on iPhone Safari.
 *   SignIn.tsx — TWO redirect useEffects watched (user, loading):
 *     • effect-1 (line 236-241): if customRedirect navigate(it),
 *                                else navigatePostLogin().  [SYNC]
 *     • effect-2 (line 489-494): always navigatePostLogin().   [ASYNC POST]
 *     Effect-2's async POST resolved ~300-1000ms after effect-1's
 *     synchronous navigation, overwriting /provider-onboarding with /home
 *     for returning customers (post-login decider V3 — separate fix).
 *
 *   Combined with V3 (post-login.ts:396-398 ignoring intent='provider'
 *   for role≠'new'), this produced the CEO-reported symptom: "Become
 *   Provider appears for ~1 second then disappears" on signed-in iPhone
 *   Safari users.
 *
 * AFTER this fix (PR-BPV-1, routing-only):
 *   1. App.tsx /become-provider → new BecomeProviderRedirect helper
 *      that branches on auth state:
 *        loading → null (no /sign-in flash)
 *        user    → Redirect directly to /provider-onboarding
 *        anon    → Redirect to /sign-in?redirect=… (canonical)
 *   2. SignIn.tsx effect-2 short-circuits with `if (customRedirect) return;`
 *      so the async navigatePostLogin no longer overrides effect-1's
 *      synchronous navigation when a ?redirect= is present.
 *
 * Out of scope (NOT touched per CEO PR-BPV-1 rules):
 *   - AuthProvider, useWhoami, /api/session/whoami, /api/auth/whoami
 *   - server/routes/post-login.ts (PR-BPV-2 will close V3)
 *   - schema, money/wallet/escrow, BookingEngine
 *   - K9000/Nayax/Tranzila, payment processors
 *   - provider approval logic, RoleProtectedRoute, RequireAuth signature
 *   - Prestige/loyalty sticky paths (PR-BPV-2 will close V4)
 *
 * This source-pin test fails if any of the seven guarantees regress.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const APP_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'App.tsx'),
  'utf8',
);
const SIGNIN_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'pages', 'SignIn.tsx'),
  'utf8',
);

describe('Issue #153 PR-BPV-1 — App.tsx /become-provider straight-through', () => {
  it('defines BecomeProviderRedirect helper that calls useFirebaseAuth', () => {
    expect(APP_SRC).toMatch(/function\s+BecomeProviderRedirect\s*\(\s*\)\s*\{/);
    // Helper must consume auth state — the whole point of the PR.
    const helper =
      APP_SRC.match(
        /function\s+BecomeProviderRedirect\s*\([\s\S]*?^\}/m,
      )?.[0] ?? '';
    expect(helper.length).toBeGreaterThan(0);
    expect(helper).toMatch(/useFirebaseAuth\(\)/);
    expect(helper).toMatch(/const\s*\{\s*user\s*,\s*loading\s*\}\s*=\s*useFirebaseAuth\(\)/);
  });

  it('helper branches on auth state: loading → null, user → direct, anon → /sign-in', () => {
    const helper =
      APP_SRC.match(
        /function\s+BecomeProviderRedirect\s*\([\s\S]*?^\}/m,
      )?.[0] ?? '';
    // loading short-circuit
    expect(helper).toMatch(/if\s*\(\s*loading\s*\)\s*return\s+null\s*;/);
    // signed-in direct
    expect(helper).toMatch(/if\s*\(\s*user\s*\)\s*return\s+<Redirect\s+to=\{redirectTarget\}\s*\/>/);
    // anon fallback retains canonical ?redirect= shape
    expect(helper).toMatch(
      /return\s+<Redirect\s+to=\{`\/sign-in\?redirect=\$\{encodeURIComponent\(redirectTarget\)\}`\}\s*\/>/,
    );
  });

  it('/become-provider route renders <BecomeProviderRedirect /> (no inline Redirect)', () => {
    // The route handler must dispatch into the helper. The pre-fix shape
    // (inline Redirect to /sign-in for ALL visitors) must be gone.
    expect(APP_SRC).toMatch(
      /<Route\s+path="\/become-provider">[\s\S]{0,2500}<BecomeProviderRedirect\s*\/>[\s\S]{0,200}<\/Route>/,
    );
    // Reject the prior shape: a bare `return <Redirect to={\`/sign-in\?redirect=…\`} />`
    // INSIDE the /become-provider route closure. That's the line PR-BPV-1
    // replaces.
    const becomeBlock =
      APP_SRC.match(/<Route\s+path="\/become-provider">[\s\S]{0,2500}<\/Route>/)?.[0] ?? '';
    expect(becomeBlock).not.toMatch(
      /return\s+<Redirect\s+to=\{`\/sign-in\?redirect=/,
    );
  });

  it('preserves ?type= query whitelist and redirectTarget shape', () => {
    const helper =
      APP_SRC.match(
        /function\s+BecomeProviderRedirect\s*\([\s\S]*?^\}/m,
      )?.[0] ?? '';
    // The 6 whitelisted provider types must remain in the allowed set.
    expect(helper).toMatch(/"walker"/);
    expect(helper).toMatch(/"sitter"/);
    expect(helper).toMatch(/"driver"/);
    expect(helper).toMatch(/"trainer"/);
    expect(helper).toMatch(/"station_operator"/);
    expect(helper).toMatch(/"pet_trek"/);
    // The redirectTarget must encode the whitelisted type when present.
    expect(helper).toMatch(
      /redirectTarget\s*=\s*safeType[\s\S]{0,200}\/provider-onboarding\?type=\$\{encodeURIComponent\(safeType\)\}/,
    );
  });
});

describe('Issue #153 PR-BPV-1 — SignIn.tsx redirect race collapse', () => {
  it('second already-signed-in effect short-circuits when customRedirect is set', () => {
    // We anchor on the existing `logger.info("User already logged in,
    // auto-redirecting to homepage")` log line — it's unique to the
    // second effect. The customRedirect guard MUST appear inside the
    // same effect, BEFORE the navigatePostLogin call.
    const homepageLog = SIGNIN_SRC.indexOf(
      'logger.info("User already logged in, auto-redirecting to homepage")',
    );
    expect(homepageLog).toBeGreaterThan(0);
    // Walk back ~600 chars to capture the effect body opening.
    const before = SIGNIN_SRC.slice(Math.max(0, homepageLog - 600), homepageLog);
    expect(before).toMatch(/if\s*\(\s*customRedirect\s*\)\s*return\s*;/);
  });

  it('second already-signed-in effect lists customRedirect in its dependency array', () => {
    // The deps array must include customRedirect now that the guard
    // reads it. Without the dep, ESLint exhaustive-deps would flag it
    // and a future PR could "fix" it by removing the guard.
    const homepageLog = SIGNIN_SRC.indexOf(
      'logger.info("User already logged in, auto-redirecting to homepage")',
    );
    expect(homepageLog).toBeGreaterThan(0);
    // Find the closing `}, [` after the log line — that's the deps array.
    const after = SIGNIN_SRC.slice(homepageLog, homepageLog + 600);
    expect(after).toMatch(
      /\}\s*,\s*\[[^\]]*customRedirect[^\]]*\]\s*\)/,
    );
  });

  it('first already-signed-in effect (customRedirect-aware) is preserved (regression)', () => {
    // PR-BPV-1 must NOT touch the FIRST already-signed-in effect — only
    // adds a guard to the second. Pin the canonical shape of the first
    // so a future PR that decides to "merge" the two effects flips the
    // test.
    expect(SIGNIN_SRC).toMatch(
      /\[Auth\] User already signed in, redirecting/,
    );
    expect(SIGNIN_SRC).toMatch(
      /if\s*\(\s*customRedirect\s*\)\s*\{\s*navigate\(\s*customRedirect\s*\)\s*;\s*\}\s*else\s*\{\s*navigatePostLogin\(\s*\)\s*;\s*\}/,
    );
  });
});
