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

/**
 * 2026-09-18 — RETARGETED. This block pinned a `BecomeProviderRedirect`
 * helper declared inline in App.tsx. #1882-era work replaced it with
 * BecomeProviderResume, a STRONGER router: it still branches on auth state,
 * and then reads /api/provider-applications/my so a signed-in applicant lands
 * on their real state (pending / approved / rejected / draft) instead of being
 * shown the intake wizard again.
 *
 * The pin kept looking for the deleted helper, so all five cases failed and the
 * file went to the red baseline. The guarantees below are the same ones
 * PR-BPV-1 was defending — no /sign-in flash for a signed-in user, the
 * canonical ?redirect= shape, and the six-type whitelist — asserted against the
 * component that actually serves the route.
 */
const RESUME_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'pages', 'BecomeProviderResume.tsx'),
  'utf8',
);

describe('Issue #153 PR-BPV-1 — /become-provider resolves without a /sign-in flash', () => {
  it('the route renders BecomeProviderResume, never an inline Redirect', () => {
    const becomeBlock =
      APP_SRC.match(/<Route\s+path="\/become-provider">[\s\S]{0,2500}<\/Route>/)?.[0] ?? '';
    expect(becomeBlock.length).toBeGreaterThan(0);
    expect(becomeBlock).toMatch(/<BecomeProviderResume\s*\/>/);
    // The pre-fix shape: every visitor, signed in or not, bounced to /sign-in.
    expect(becomeBlock).not.toMatch(/return\s+<Redirect\s+to=\{`\/sign-in\?redirect=/);
  });

  it('consumes auth state and renders NOTHING while it is still loading', () => {
    // The loading short-circuit is what removes the /sign-in chrome flash on
    // iPhone Safari — the CEO-reported "appears for a second then disappears".
    expect(RESUME_SRC).toMatch(/const\s*\{\s*user\s*,\s*loading\s*\}\s*=\s*useFirebaseAuth\(\)/);
    expect(RESUME_SRC).toMatch(/if\s*\(\s*loading\s*\)\s*return\s*;/);
  });

  it('an anonymous visitor goes to /sign-in in the canonical ?redirect= shape, back through THIS route', () => {
    // Back to /become-provider, not straight to /provider-onboarding: the
    // resume decision has to run again once the user is authenticated.
    expect(RESUME_SRC).toMatch(/if\s*\(\s*!user\s*\)\s*\{/);
    expect(RESUME_SRC).toMatch(/`\/become-provider\$\{providerType \? `\?type=\$\{encodeURIComponent\(providerType\)\}` : ''\}`/);
    expect(RESUME_SRC).toMatch(/`\/sign-in\?redirect=\$\{encodeURIComponent\(back\)\}`/);
  });

  it('preserves the six-type whitelist and the ?type= passthrough', () => {
    for (const t of ['walker', 'sitter', 'driver', 'trainer', 'station_operator', 'pet_trek']) {
      expect(RESUME_SRC).toContain(`'${t}'`);
    }
    // An unlisted ?type= is dropped, never echoed into the next URL.
    expect(RESUME_SRC).toMatch(/PROVIDER_TYPE_WHITELIST\.has\(raw\)/);
    expect(RESUME_SRC).toMatch(/\/provider-onboarding\?type=\$\{encodeURIComponent\(type\)\}/);
  });

  it('a signed-in applicant is routed by their SERVER state, not shown the wizard again', () => {
    // The whole reason the helper was replaced.
    expect(RESUME_SRC).toMatch(/\/api\/provider-applications\/my/);
    expect(RESUME_SRC).toMatch(/resumeTargetFromApplication/);
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
    // ORDER, not a fixed-size text window. The old form sliced 400 characters
    // after the guard and broke the moment a comment was added between them —
    // a pin failing on prose while the guarantee held (2026-09-18).
    expect(SIGNIN_SRC).toMatch(/if\s*\(\s*safeRedirect\s*\)\s*\{\s*navigate\(\s*safeRedirect\s*\)\s*;\s*return\s*;\s*\}/);
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
