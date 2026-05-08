/**
 * Issue #153 PR-BPV-2 — post-login intent re-honor + Prestige sticky paths.
 *
 * Closes diagnostic V3 + V4 from comment 4404078588.
 *
 * V3 — server/routes/post-login.ts:396-398 silently swallowed
 *      intent='provider' for returning customers (userRole !== 'new'),
 *      so no provider draft was created and buildRoutingResponse fell
 *      through to /home. Combined with V1+V2 (PR-BPV-1) this produced
 *      the visible "Become Provider appears for ~1s then disappears"
 *      symptom.
 *
 * V4 — client/src/lib/sticky-account-paths.ts did not include the
 *      Prestige / Privilege / Loyalty join routes, so PromoAdPopup
 *      (z-9999, 100dvh shell, body scroll-lock for 3.5s) covered those
 *      pages on every fresh visit, blocking first-tap on join CTAs.
 *
 * AFTER this fix:
 *   • post-login.ts — provider-draft creation HOISTED out of the
 *     `else if (safeIntent)` branch so it now runs in BOTH branches when
 *     safeIntent === 'provider' AND no existing provider application.
 *     Returning customers also get signupIntent='provider' persisted on
 *     their user row so buildRoutingResponse at line 508 picks
 *     /provider-onboarding instead of /home. ROLE ASSIGNMENT NOT TOUCHED.
 *     Admin logic NOT touched. buildRoutingResponse decision tree NOT
 *     touched.
 *   • sticky-account-paths.ts — five Prestige/Loyalty paths added so
 *     PromoAdPopup is suppressed on those routes (matches existing
 *     /become-provider behaviour).
 *
 * This source-pin test fails if any of the eight guarantees regress.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  STICKY_ACCOUNT_PATHS,
  isStickyAccountPath,
} from '@/lib/sticky-account-paths';

const POST_LOGIN_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', '..', 'server', 'routes', 'post-login.ts'),
  'utf8',
);
const STICKY_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'lib', 'sticky-account-paths.ts'),
  'utf8',
);

describe('Issue #153 PR-BPV-2 — post-login intent re-honor (V3)', () => {
  it('returning-customer branch persists signupIntent="provider" without changing role', () => {
    // Anchor: the `if (userRole && userRole !== 'new')` branch must now
    // contain a `signupIntent: 'provider'` updateUser call when safeIntent
    // is 'provider'. The block must NOT contain `role:` (no role change).
    const branchStart = POST_LOGIN_SRC.indexOf("if (userRole && userRole !== 'new')");
    expect(branchStart).toBeGreaterThan(0);
    // The branch ends at the next `} else if (safeIntent)` opener.
    const branchEnd = POST_LOGIN_SRC.indexOf('else if (safeIntent)', branchStart);
    expect(branchEnd).toBeGreaterThan(branchStart);
    const branch = POST_LOGIN_SRC.slice(branchStart, branchEnd);
    // PR-BPV-2: signupIntent persisted on the returning-customer path.
    expect(branch).toMatch(
      /storage\.updateUser\(\s*userId\s*,\s*\{\s*signupIntent:\s*['"]provider['"]\s*\}/,
    );
    // PR-BPV-2 hard rule: this branch must NOT change role assignment.
    expect(branch).not.toMatch(/role:\s*assignedRole/);
    expect(branch).not.toMatch(/role:\s*['"]provider['"]/);
  });

  it('provider-draft creation is HOISTED out of the else-if-safeIntent branch', () => {
    // The hoisted draft block must live AFTER the closing brace of the
    // outer if/else if/else block (the one that ends with the
    // /choose-role return) — not inside the `else if (safeIntent)` arm.
    // We anchor on the marker comment we left behind.
    expect(POST_LOGIN_SRC).toMatch(
      /Issue #153 PR-BPV-2:\s*HOISTED provider-draft/,
    );
    // The hoisted block must call createProviderApplicationDraft.
    const hoistMarker = POST_LOGIN_SRC.indexOf('HOISTED provider-draft');
    expect(hoistMarker).toBeGreaterThan(0);
    // Look forward from the marker to find the call.
    const after = POST_LOGIN_SRC.slice(hoistMarker, hoistMarker + 4000);
    expect(after).toMatch(/storage\.createProviderApplicationDraft\s*\(/);
  });

  it('hoisted draft block is gated on safeIntent="provider" AND !existingApp', () => {
    const hoistMarker = POST_LOGIN_SRC.indexOf('HOISTED provider-draft');
    const after = POST_LOGIN_SRC.slice(hoistMarker, hoistMarker + 4000);
    // safeIntent === 'provider' guard.
    expect(after).toMatch(/if\s*\(\s*safeIntent\s*===\s*['"]provider['"]\s*\)/);
    // existingApp check via getProviderApplicationByUser.
    expect(after).toMatch(/getProviderApplicationByUser\s*\(\s*userId\s*\)/);
    expect(after).toMatch(/if\s*\(\s*!\s*existingApp\s*\)/);
  });

  it('staff_request handling REMAINS in the role-assignment branch (no scope creep)', () => {
    // PR-BPV-2 only hoists the provider-draft block. The staff_request
    // logic must stay where it was — inside the `else if (safeIntent)`
    // arm, behind the role-update step.
    const elseIfStart = POST_LOGIN_SRC.indexOf("else if (safeIntent)");
    expect(elseIfStart).toBeGreaterThan(0);
    const elseIfEnd = POST_LOGIN_SRC.indexOf('} else {', elseIfStart);
    expect(elseIfEnd).toBeGreaterThan(elseIfStart);
    const elseIfBody = POST_LOGIN_SRC.slice(elseIfStart, elseIfEnd);
    expect(elseIfBody).toMatch(/staff_request/);
    expect(elseIfBody).toMatch(/createStaffAccessRequest/);
    // And: the role-assignment updateUser call (with role + signupIntent)
    // is preserved on this path.
    expect(elseIfBody).toMatch(
      /storage\.updateUser\(\s*userId\s*,\s*\{[\s\S]{0,200}role:\s*assignedRole/,
    );
  });

  it('PROVIDER_DRAFT_FAILED safety-net 500 response is preserved (no regression)', () => {
    // Pre-fix code returned a clean 500 with nextUrl='/provider-onboarding'
    // when createProviderApplicationDraft threw, to prevent the client
    // from silently navigating to /home. PR-BPV-2 must preserve this
    // catch even after hoisting the block.
    expect(POST_LOGIN_SRC).toMatch(/error:\s*['"]PROVIDER_DRAFT_FAILED['"]/);
    expect(POST_LOGIN_SRC).toMatch(/nextUrl:\s*['"]\/provider-onboarding['"]/);
  });

  it('out-of-scope items NOT touched: buildRoutingResponse + getMissingFields preserved', () => {
    // buildRoutingResponse decision tree (lines 124-200) and
    // getMissingFields helper MUST be untouched. We pin the canonical
    // phrases that live in those blocks.
    expect(POST_LOGIN_SRC).toMatch(/getMissingFields/);
    expect(POST_LOGIN_SRC).toMatch(/buildRoutingResponse/);
    // PR-BPV-2 must NOT introduce a NEW `role: assignedRole` write inside
    // the postLoginDecider function. Pre-existing writes elsewhere
    // (chooseRole etc.) are fine. Anchor specifically to the
    // returning-customer branch — it must not contain that pattern.
    const branchStart = POST_LOGIN_SRC.indexOf("if (userRole && userRole !== 'new')");
    const branchEnd = POST_LOGIN_SRC.indexOf('else if (safeIntent)', branchStart);
    const returningBranch = POST_LOGIN_SRC.slice(branchStart, branchEnd);
    expect(returningBranch).not.toMatch(/role:\s*assignedRole/);
    expect(returningBranch).not.toMatch(/role:\s*['"]provider['"]/);
  });
});

describe('Issue #153 PR-BPV-2 — Prestige / Loyalty sticky paths (V4)', () => {
  it('STICKY_ACCOUNT_PATHS exports the five new prestige/loyalty paths', () => {
    expect(STICKY_ACCOUNT_PATHS).toContain('/prestige-club');
    expect(STICKY_ACCOUNT_PATHS).toContain('/prestige-pass');
    expect(STICKY_ACCOUNT_PATHS).toContain('/privilege');
    expect(STICKY_ACCOUNT_PATHS).toContain('/loyalty');
    expect(STICKY_ACCOUNT_PATHS).toContain('/loyalty/join');
  });

  it('isStickyAccountPath returns true for the new prestige/loyalty routes', () => {
    expect(isStickyAccountPath('/prestige-club')).toBe(true);
    expect(isStickyAccountPath('/prestige-pass')).toBe(true);
    expect(isStickyAccountPath('/privilege')).toBe(true);
    expect(isStickyAccountPath('/loyalty')).toBe(true);
    expect(isStickyAccountPath('/loyalty/join')).toBe(true);
    // Sub-paths still match (e.g. /loyalty/dashboard inherits the
    // sticky guard via the startsWith check). This avoids the popup
    // mounting on any sub-page.
    expect(isStickyAccountPath('/loyalty/dashboard')).toBe(true);
    expect(isStickyAccountPath('/prestige-pass/wallet')).toBe(true);
  });

  it('existing /become-provider sticky behaviour preserved (regression)', () => {
    // PR-BPV-2 must not weaken the canonical V1/V2 sticky list; pin
    // the entries that already shipped.
    expect(isStickyAccountPath('/become-provider')).toBe(true);
    expect(isStickyAccountPath('/provider-onboarding')).toBe(true);
    expect(isStickyAccountPath('/sign-in')).toBe(true);
    expect(isStickyAccountPath('/complete-profile')).toBe(true);
    // Non-sticky routes still return false (regression — popup must
    // continue to mount on the homepage etc.).
    expect(isStickyAccountPath('/')).toBe(false);
    expect(isStickyAccountPath('/home')).toBe(false);
    expect(isStickyAccountPath('/bookings')).toBe(false);
  });

  it('source file records the V4 rationale comment (future-agent guard)', () => {
    // A cleanup PR removing the prestige paths must also remove this
    // comment — the source-pin will catch any silent removal.
    expect(STICKY_SRC).toMatch(/Issue #153 PR-BPV-2/);
    expect(STICKY_SRC).toMatch(/PromoAdPopup/);
  });
});
