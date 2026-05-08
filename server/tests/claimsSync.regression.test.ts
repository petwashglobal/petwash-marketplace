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

describe('PR-CLAIMS-SYNC — accountType added to provider claim write', () => {
  it('1. setCustomUserClaims now writes BOTH role and accountType for the provider escalation', () => {
    // Anchor on the audited block in postLoginDecider provider-active path.
    const idx = postLogin.indexOf("'[PostLogin] ✅ Firebase claims synced to role=provider");
    expect(idx).toBeGreaterThan(0);
    const block = postLogin.slice(Math.max(0, idx - 1500), idx + 500);
    // Both keys present in the same setCustomUserClaims call
    expect(block).toMatch(/setCustomUserClaims\(\s*userId\s*,\s*\{[\s\S]*?role:\s*['"]provider['"][\s\S]*?accountType:\s*['"]provider['"]/);
    // …and the existingClaims spread is preserved (no contract widening)
    expect(block).toMatch(/\.{3}existingClaims/);
  });

  it('2. The change-detection guard now re-fires when accountType differs (not only role)', () => {
    // Before PR-CLAIMS-SYNC, the guard was `existingClaims.role !== "provider"`.
    // After: it must ALSO check accountType so a user with role='provider'
    // but accountType='customer' still gets the second field synced on
    // the next post-login.
    const idx = postLogin.indexOf("'[PostLogin] ✅ Firebase claims synced to role=provider");
    const block = postLogin.slice(Math.max(0, idx - 1500), idx);
    expect(block).toMatch(/existingClaims\.role\s*!==\s*['"]provider['"]/);
    expect(block).toMatch(/existingClaims\.accountType\s*!==\s*['"]provider['"]/);
  });

  it('3. claimsWritten flag gates the follow-up notification — never fires on a no-op or failure', () => {
    expect(postLogin).toMatch(/let\s+claimsWritten\s*=\s*false/);
    const idx = postLogin.indexOf('let claimsWritten');
    expect(idx).toBeGreaterThan(0);
    const block = postLogin.slice(idx, idx + 1500);
    expect(block).toMatch(/claimsWritten\s*=\s*true/);
    expect(block).toMatch(/if\s*\(\s*claimsWritten\s*\)/);
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
  it('10. post-login provider-active escalation invokes the helper after claims-written', () => {
    const idx = postLogin.indexOf("'[PostLogin] ✅ Firebase claims synced to role=provider");
    const block = postLogin.slice(idx, idx + 2000);
    expect(block).toMatch(/sendForceTokenRefreshNotification/);
    expect(block).toMatch(/reason:\s*['"]provider_approved['"]/);
    expect(block).toMatch(/actionUrl:\s*['"]\/provider\/dashboard['"]/);
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
    const providerIdx = postLogin.indexOf("reason: 'provider_approved'");
    const providerBlock = postLogin.slice(Math.max(0, providerIdx - 500), providerIdx + 800);
    expect(providerBlock).toMatch(/try\s*\{[\s\S]*?sendForceTokenRefreshNotification/);
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
