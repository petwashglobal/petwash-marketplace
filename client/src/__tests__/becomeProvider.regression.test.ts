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
// The standalone SignIn.tsx was consolidated into the single-door SignUpLuxury,
// which now backs /signin, /sign-in and /login (App.tsx). The redirect-race
// guarantee moved with it — see the second describe block below.
const SIGNIN_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'pages', 'SignUpLuxury.tsx'),
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

describe('Issue #153 PR-BPV-1 — consolidated /signin page honors ?redirect= without a race', () => {
  // The old SignIn.tsx had TWO already-signed-in effects and PR-BPV-1 added a
  // `if (customRedirect) return;` guard to the second so the async post-login
  // navigate could not overwrite the synchronous customRedirect navigation.
  // SignUpLuxury replaced it with a SINGLE effect that early-returns on the
  // redirect BEFORE the async post-login resolve — so the race is structurally
  // impossible, not merely guarded. These pins protect that structure.

  it('validates ?redirect=/?from= against open-redirects (internal single-slash paths only)', () => {
    // Blocks //evil.com and proto:// open redirects — must accept ?redirect= AND ?from=.
    expect(SIGNIN_SRC).toMatch(/params\.get\(['"]redirect['"]\)\s*\|\|\s*params\.get\(['"]from['"]\)/);
    expect(SIGNIN_SRC).toMatch(/\/\^\\\/\(\?!\\\/\)\//); // the /^\/(?!\/)/ guard literal
  });

  it('already-signed-in effect early-returns to the safe redirect BEFORE any async post-login navigate', () => {
    // The single effect: `if (!user) return;` then `if (safeRedirect) { navigate(safeRedirect); return; }`
    // The early return is what makes the old dual-effect race impossible.
    const userGuard = SIGNIN_SRC.indexOf('if (!user) return;');
    expect(userGuard).toBeGreaterThan(0);
    const effectBody = SIGNIN_SRC.slice(userGuard, userGuard + 400);
    expect(effectBody).toMatch(/if\s*\(\s*safeRedirect\s*\)\s*\{\s*navigate\(\s*safeRedirect\s*\)\s*;\s*return\s*;\s*\}/);
    // The async post-login resolve must appear AFTER the safeRedirect short-circuit.
    const asyncResolve = SIGNIN_SRC.indexOf('resolvePostLogin', userGuard);
    const safeRedirectReturn = SIGNIN_SRC.indexOf('navigate(safeRedirect)', userGuard);
    expect(safeRedirectReturn).toBeGreaterThan(0);
    expect(asyncResolve).toBeGreaterThan(safeRedirectReturn);
  });

  it('post-login resolution routes by the user\'s real role (no static flow→dest map)', () => {
    // Returning approved provider → /provider-os, member → /home, etc. — via the
    // server decider, not a hard-coded map that used to send providers to /home.
    expect(SIGNIN_SRC).toMatch(/resolvePostLogin/);
    expect(SIGNIN_SRC).toMatch(/data\?\.nextUrl/);
  });
});
