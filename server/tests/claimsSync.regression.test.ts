/**
 * Issue #153 PR-CLAIMS-SYNC — claims/auth single-source-of-truth (Pillar B step 1).
 *
 * CEO-approved scope (locked):
 *   • add accountType to post-login provider claim write
 *   • send force_token_refresh notification on role/accountType changes
 *   • no broad auth rewrite
 *   • no whoami collapse
 *   • no role policy change
 *   • source-pin tests
 *
 * Lane B-B audit returned three drift scenarios. This PR closes the
 * two that don't require a server-side redesign:
 *   #2 P0  post-login.ts:577-581 set {role:'provider'} but NOT
 *           accountType → client RBAC at provider-applications.ts:
 *           1015-1023 reads accountType and 403s until next ID-token
 *           refresh.
 *   #3 P1  approveAccess (and the auto-promote provider escalation)
 *           wrote claims but did NOT push force_token_refresh →
 *           useWhoami served the old role for up to 2 min (PR #184
 *           closed half of this; the other half is the claims
 *           propagation gap closed here).
 *
 * The third drift scenario (Lane B-B P0 #1: provider-applications.ts
 * approval network-timeout race) is covered by the existing
 * force_token_refresh insert at provider-applications.ts:1318-1341 +
 * PR #184 whoami invalidation. No new code needed there.
 *
 * Pure source-pin tests + helper behaviour. No DB writes, no Firebase
 * boot.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const postLogin = readFileSync(resolve(ROOT, 'server/routes/post-login.ts'), 'utf8');
const helper = readFileSync(resolve(ROOT, 'server/lib/sendForceTokenRefresh.ts'), 'utf8');

// ── A. CLAIM-WRITE GAP CLOSED (Lane B-B P0 #2) ────────────────────────────

/**
 * 2026-09-18 — RETARGETED. These read server/routes/post-login.ts for a
 * provider-escalation block that writes Firebase claims on every login. The
 * write MOVED to where it belongs — server/routes/provider-applications.ts, at
 * APPROVAL — and got stronger on the way: the claim set is now additive (CEO
 * §1/§28), so approving a provider no longer clobbers the customer identity the
 * same person already has. It preserves an existing non-public role and an
 * existing non-pet_parent accountType, appends 'provider' to roles[], and
 * carries the per-service approval map.
 *
 * The pins were anchored on a log line that no longer exists, so they failed
 * regardless of whether the guarantee held. They now assert it where it lives.
 */
const providerApps = readFileSync(resolve(ROOT, 'server/routes/provider-applications.ts'), 'utf8');

describe('PR-CLAIMS-SYNC — approving a provider writes role AND accountType', () => {
  const idx = providerApps.indexOf("Firebase claims set for approved provider");
  const block = providerApps.slice(Math.max(0, idx - 2000), idx);

  it('1. the approval claim write carries BOTH role and accountType', () => {
    expect(idx).toBeGreaterThan(0);
    expect(block).toMatch(/setCustomUserClaims\(application\.userId,\s*\{[\s\S]*?role:\s*preservedRole[\s\S]*?accountType:\s*preservedAccountType/);
    // Existing claims are spread, never replaced — no contract widening.
    expect(block).toMatch(/\.{3}existingClaims/);
  });

  it('2. it is ADDITIVE — a provider who is also a customer keeps that identity', () => {
    // The bug this shape prevents: approving someone as a provider used to
    // overwrite role/accountType outright, so the same person lost the customer
    // surface they were already using.
    expect(block).toMatch(/existingClaims\.role\s*&&\s*existingClaims\.role\s*!==\s*'public'/);
    expect(block).toMatch(/existingClaims\.accountType\s*&&\s*existingClaims\.accountType\s*!==\s*'pet_parent'/);
    expect(block).toMatch(/nextRoles\s*=\s*Array\.from\(new Set\(\[\.\.\.priorRoles,\s*'provider'\]\)\)/);
  });

  it('3. a claims failure is non-fatal — approval still stands in Postgres', () => {
    const after = providerApps.slice(idx, idx + 600);
    expect(after).toMatch(/catch\s*\(claimsErr\)/);
    expect(after).toMatch(/Could not set Firebase claims \(non-fatal\)/);
  });
});

// ── B. FORCE-TOKEN-REFRESH NOTIFICATION (Lane B-B P1 #3) ──────────────────

describe('PR-CLAIMS-SYNC — force_token_refresh notification', () => {
  it('4. helper exists and exports sendForceTokenRefreshNotification', () => {
    expect(helper).toMatch(/export\s+async\s+function\s+sendForceTokenRefreshNotification\s*\(/);
    expect(helper).toMatch(/actionType:\s*['"]force_token_refresh['"]/);
  });

  it('5. helper inserts into super_app_notifications with channels=[in_app]', () => {
    expect(helper).toMatch(/superAppNotifications/);
    expect(helper).toMatch(/channels:\s*\[\s*['"]in_app['"]\s*\]/);
  });

  it('6. helper supports the four canonical reasons (provider/staff/role/account)', () => {
    expect(helper).toMatch(/'provider_approved'/);
    expect(helper).toMatch(/'staff_approved'/);
    expect(helper).toMatch(/'role_changed'/);
    expect(helper).toMatch(/'account_type_changed'/);
  });

  it('7. helper is fail-soft (catches errors and returns boolean — never throws)', () => {
    expect(helper).toMatch(/Promise<boolean>/);
    // Catch block contains a logger.warn + return false. The block can
    // be > 200 chars because of the structured-log fields; widen window.
    expect(helper).toMatch(/catch\s*\(\s*err[\s\S]{0,800}return\s+false/);
    expect(helper).toMatch(/return\s+true/);
  });

  it('8. helper provides Hebrew + English title/body for every reason', () => {
    // 4 reasons × (HE title + HE body + EN title + EN body) = 16 entries
    const titlesHe = helper.match(/TITLES_HE:[\s\S]*?\}/);
    const bodiesHe = helper.match(/BODIES_HE:[\s\S]*?\}/);
    expect(titlesHe).toBeTruthy();
    expect(bodiesHe).toBeTruthy();
    expect(helper).toMatch(/preferredLanguage === 'he'/);
  });

  it('9. helper warns on missing userId (defensive guard) and returns false', () => {
    expect(helper).toMatch(/if\s*\(\s*!notification\.userId\s*\)/);
  });
});

// ── C. WIRING — POST-LOGIN PROVIDER PROMOTION + APPROVE-ACCESS ────────────

describe('PR-CLAIMS-SYNC — wiring at the two server-side claim writers', () => {
  it('10. an approved provider is told to refresh, so the new claims take effect at once', () => {
    // Without this the provider's token still says 'customer' until Firebase
    // refreshes it on its own — they tap in and see the customer surface.
    // NOTE: provider-applications.ts hand-rolls the insert instead of calling
    // sendForceTokenRefreshNotification, which exists for exactly this and
    // already carries the HE/EN copy for 'provider_approved'. Same behaviour,
    // two copies. Pinned as-is rather than refactored inside a live approval
    // path; worth collapsing into the helper when that path is next touched.
    const idx = providerApps.indexOf("type: 'provider_approved'");
    expect(idx).toBeGreaterThan(0);
    const block = providerApps.slice(Math.max(0, idx - 400), idx + 900);
    expect(block).toMatch(/actionType:\s*['"]force_token_refresh['"]/);
    expect(block).toMatch(/actionUrl:\s*['"]\/provider\/dashboard['"]/);
    expect(block).toMatch(/channels:\s*\[\s*['"]in_app['"]\s*\]/);
    // Bilingual, chosen from the applicant's own language.
    expect(block).toMatch(/preferredLanguage === 'he'/);
  });

  it('11. approveAccess (staff approval) invokes the helper after claims-written', () => {
    const idx = postLogin.indexOf("[AdminApproval] Firebase claims sync failed");
    expect(idx).toBeGreaterThan(0);
    const block = postLogin.slice(Math.max(0, idx - 800), idx + 1500);
    expect(block).toMatch(/sendForceTokenRefreshNotification/);
    expect(block).toMatch(/reason:\s*['"]staff_approved['"]/);
    expect(block).toMatch(/actionUrl:\s*['"]\/admin\/dashboard['"]/);
    // staffClaimsWritten gate must be present so a sync failure does
    // not push a notification that finds no fresh claims.
    expect(block).toMatch(/staffClaimsWritten\s*=\s*true/);
    expect(block).toMatch(/if\s*\(\s*staffClaimsWritten\s*\)/);
  });

  it('12. Notification is fail-soft at every call site (try/catch, non-blocking)', () => {
    // Both call sites must wrap the helper invocation in try/catch and
    // log a warn but NEVER rethrow — mirrors the existing
    // provider-applications.ts:1338-1340 pattern.
    const providerIdx = providerApps.indexOf("type: 'provider_approved'");
    const providerBlock = providerApps.slice(Math.max(0, providerIdx - 700), providerIdx + 1200);
    expect(providerBlock).toMatch(/try\s*\{[\s\S]*?db\.insert\(notifTable\)/);
    expect(providerBlock).toMatch(/catch[\s\S]*?logger\.warn/);

    const staffIdx = postLogin.indexOf("reason: 'staff_approved'");
    const staffBlock = postLogin.slice(Math.max(0, staffIdx - 500), staffIdx + 800);
    expect(staffBlock).toMatch(/try\s*\{[\s\S]*?sendForceTokenRefreshNotification/);
    expect(staffBlock).toMatch(/catch[\s\S]*?logger\.warn/);
  });
});

// ── D. SCOPE GUARDS (lock the locked rules) ───────────────────────────────

describe('PR-CLAIMS-SYNC — scope guards', () => {
  it('13. No new role policy: the userStatus → role mapping is unchanged', () => {
    // The PR must NOT widen the scope to other transitions. Sentinel:
    // the original `userStatus === "provider_active"` gate must still
    // be the only auto-promote condition.
    expect(postLogin).toMatch(/userStatus\s*===\s*['"]provider_active['"]\s*&&\s*effectiveRole\s*!==\s*['"]provider['"]/);
  });

  it('14. No whoami contract change: useWhoami / /api/session/whoami still untouched here', () => {
    // The helper must not reach into whoami in CODE. Strip comments
    // before the check — the doc-comment is allowed to reference the
    // audit context (PR #184 already handles whoami invalidation).
    const noComments = helper
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(noComments).not.toMatch(/whoami/i);
    expect(noComments).not.toMatch(/useWhoami/);
  });

  it('15. No new persistent state: helper writes ONLY super_app_notifications + nothing else', () => {
    // Defensive: the helper imports must not include money / wallet /
    // K9000 / Nayax / KYC paths.
    expect(helper).not.toMatch(/wallet|escrow|nayax|k9000|tranzila|kyc/i);
    // Storage write must be the in-app notifications table only.
    const inserts = helper.match(/db\.insert\(\s*\w+/g) || [];
    expect(inserts.length).toBe(1);
    expect(inserts[0]).toContain('notifTable');
  });
});
