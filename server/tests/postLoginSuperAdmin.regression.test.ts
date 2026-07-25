/**
 * Regression pin — fix #136-1 (CEO 2026-07-25): "gmail won't let me in".
 *
 * A super-admin allowlisted email that signs in via Google/OAuth is auto-created
 * with role='customer' and was routed to /home — locked out of the backend.
 * The decider now promotes it to super_admin and routes it to /admin/dashboard.
 *
 * Source-level pins (no live Firebase needed): they assert the promotion is
 * (a) present, (b) gated on the VERIFIED check (allowlist + email_verified),
 * not the bare email primitive, and (c) that the router fast-path lands on the
 * backend and trusts the already-verified role.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '..', 'routes', 'post-login.ts'), 'utf8');

describe('post-login super-admin promotion (#136-1)', () => {
  it('promotes a super-admin login to effectiveRole super_admin', () => {
    expect(src).toMatch(/effectiveRole\s*=\s*'super_admin'/);
  });

  it('gates the promotion on the VERIFIED check, never the bare email primitive', () => {
    // The promotion decision must use isSuperAdminVerified(req) — allowlist AND
    // Firebase email_verified — so an unverified impostor cannot self-promote.
    expect(src).toMatch(/isSuperAdminEmail\s*=\s*isSuperAdminVerified\(req\)/);
  });

  it('routes a super_admin straight to /admin/dashboard, bypassing profile gates', () => {
    // The fast-path must appear before the missing-fields / email-verify checks
    // and trust the promoted role rather than re-deriving from an unverified email.
    const fastPath = src.indexOf("if (role === 'super_admin')");
    const missingFieldsGate = src.indexOf('missingFields.length > 0');
    expect(fastPath).toBeGreaterThan(-1);
    expect(missingFieldsGate).toBeGreaterThan(-1);
    expect(fastPath).toBeLessThan(missingFieldsGate);
    const window = src.slice(fastPath, fastPath + 160);
    expect(window).toMatch(/\/admin\/dashboard/);
  });

  it('gives super_admin an empty required-fields list so it is never profile-gated', () => {
    expect(src).toMatch(/super_admin:\s*\[\]/);
  });

  it('audit-logs the promotion', () => {
    expect(src).toMatch(/POST_LOGIN_SUPER_ADMIN_SYNC/);
  });
});
