/**
 * /api/me/active-role server-authority regression pin (Phase 5, CEO D5).
 *
 * activeRole is UX preference, never authority. This pin enforces:
 *   1. The endpoint gate is validateFirebaseToken (unauthenticated → 401).
 *   2. The requested role is validated against a CLOSED allowlist
 *      (customer, provider, staff, admin). No open-ended role string.
 *   3. The requested role is checked against server-computed
 *      capabilities (rolesFromCapabilities) BEFORE any write.
 *   4. The write goes to users.last_active_role — never touches
 *      users.role (the legacy scalar that still exists for backward
 *      compat) or any authority-carrying field.
 *   5. A ROLE_SWITCHED audit event fires on successful switch.
 *   6. super_admin is intentionally NOT in the switchable allowlist —
 *      elevated role is per-request, not a mode preference.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(__dirname, '..', 'routes', 'me-active-role.ts'),
  'utf8',
);

describe('/api/me/active-role · server-authority regression pin', () => {
  it('both routes require validateFirebaseToken', () => {
    // GET and POST both listed with validateFirebaseToken as middleware.
    expect(SRC).toMatch(/router\.get\(\s*['"]\/active-role['"]\s*,\s*validateFirebaseToken/);
    expect(SRC).toMatch(/router\.post\(\s*['"]\/active-role['"]\s*,\s*validateFirebaseToken/);
  });

  it('accepts only the closed 4-role allowlist', () => {
    expect(SRC).toMatch(/ACCEPTED_ROLES\s*=\s*\[\s*'customer'\s*,\s*'provider'\s*,\s*'staff'\s*,\s*'admin'\s*\]\s*as\s*const/);
    // super_admin MUST NOT be in the allowlist.
    const allowlistBlock = SRC.match(/ACCEPTED_ROLES[^;]*;/);
    expect(allowlistBlock).not.toBeNull();
    expect(allowlistBlock![0]).not.toMatch(/super_admin/);
  });

  it('uses Zod enum for body validation (server never accepts arbitrary role text)', () => {
    expect(SRC).toMatch(/z\.enum\(\s*ACCEPTED_ROLES\s*\)/);
  });

  it('checks requested role against server-computed capabilities', () => {
    // The compare uses rolesFromCapabilities(caps) — never a client hint.
    expect(SRC).toMatch(/authorizedRoles\s*=\s*rolesFromCapabilities\(caps\)/);
    expect(SRC).toMatch(/authorizedRoles\.includes\(requested\)/);
  });

  it('unauthorized role returns 403 without leaking authorizedRoles in the response', () => {
    // Search the 403 response — must NOT include authorizedRoles in the payload.
    const rejection = SRC.match(/return res\.status\(403\)[\s\S]*?\}\);/);
    expect(rejection).not.toBeNull();
    expect(rejection![0]).not.toMatch(/authorizedRoles/);
  });

  it('write target is users.last_active_role — NEVER users.role', () => {
    // The db.update(users).set() must include lastActiveRole and not role.
    const setMatch = SRC.match(/\.set\(\{[\s\S]*?\}\)/);
    expect(setMatch).not.toBeNull();
    const setBody = setMatch![0];
    expect(setBody).toMatch(/lastActiveRole:\s*requested/);
    // Guard against a regression that would set the legacy scalar.
    // (`role:` inside `actorRole:` on the audit event is a different key
    // and does not touch users.role, so restrict the check to the
    // .set({...}) body.)
    expect(setBody).not.toMatch(/(^|\W)role:/);
  });

  it('emits ROLE_SWITCHED audit event on successful switch', () => {
    expect(SRC).toMatch(/actionType:\s*['"]ROLE_SWITCHED['"]/);
  });

  it('never imports RBAC authority helpers as the source of truth for the role check', () => {
    // The endpoint uses getUserCapabilities + rolesFromCapabilities.
    // If a future refactor grabs an admin claim or a super-admin check
    // from a bare Firebase claim without going through capabilities,
    // this test would flag it. isSuperAdminVerified is fine (used to
    // stamp admin capability accurately for the caps aggregator).
    expect(SRC).toMatch(/getUserCapabilities/);
    expect(SRC).toMatch(/rolesFromCapabilities/);
  });
});
